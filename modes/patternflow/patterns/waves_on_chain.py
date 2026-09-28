# Pattern: Waves on Chain
# Original: "Waves on chain" by Chromalita (https://twitter.com/chromalita),
# published by Chromorphs. Ported from the p5.js source.
#
# Every token of the collection runs the same sketch; the token's hash seeds
# an xorshift RNG that picks the palette, opacity, wave height/spacing/shape,
# background style and stars. We replay that RNG so the token knob shows any
# of the 1024 outputs, then replay the sketch's Catmull-Rom geometry in a
# fixed reference space, rasterise supersampled with PIL, and composite in numpy.
import logging

import numpy as np
from PIL import Image, ImageDraw

from .. import core_canvas as pf_canvas
from .waves_on_chain_seeds import SEEDS

logger = logging.getLogger(__name__)

NAME = "Waves on Chain"
KNOB_LABELS = ["token", "speed", "palette", "amp"]

# (primary/background, stroke, wave fill, secondary/gradient end), verbatim
_PALETTES = [
    ("#BF160D", "#B73E15", "#F56416", "#F00699"),
    ("#F56416", "#B73E15", "#BF160D", "#F00699"),
    ("#F56416", "#D36060", "#E8B321", "#D00000"),
    ("#E8B321", "#E8B321", "#D00000", "#F56416"),
    ("#119DA4", "#119DA4", "#155145", "#042325"),
    ("#155145", "#155145", "#119DA4", "#130208"),
    ("#0A2342", "#7D77CF", "#9893DA", "#000000"),
    ("#9893DA", "#7D77CF", "#0A2342", "#C5FFFD"),
    ("#6E0E0A", "#6E0E0A", "#FF8552", "#130208"),
    ("#FF8552", "#FF8552", "#6E0E0A", "#6E0E0A"),
    ("#FF8533", "#FF8533", "#004E98", "#DB162F"),
    ("#004E98", "#004E98", "#FF8533", "#ADD8FF"),
    ("#FFE156", "#FFE156", "#DC7F9B", "#DD614A"),
    ("#DC7F9B", "#DC7F9B", "#FFE156", "#EA1F4B"),
    ("#130201", "#130201", "#EF271B", "#666666"),
    ("#BF160D", "#BF160D", "#130201", "#130201"),
    ("#F45B69", "#141D29", "#114B5F", "#FF206E"),
    ("#114B5F", "#141D29", "#F45B69", "#16CAB2"),
    ("#DC3F2E", "#DC3F2E", "#1B2CC1", "#FF0A58"),
    ("#1B2CC1", "#1B2CC1", "#DC3F2E", "#080C36"),
    ("#E87EA1", "#DA2F68", "#98C1D9", "#AD1F4E"),
    ("#98C1D9", "#DA2F68", "#E87EA1", "#FFFFfF"),
    ("#FDEFED", "#FFFFFF", "#002922", "#002922"),
    ("#002922", "#FFFFFF", "#FDEFED", "#000000"),
    ("#60063F", "#74074C", "#06BCC1", "#F218A2"),
    ("#06BCC1", "#6D466B", "#74074C", "#60063F"),
    ("#8A1C7C", "#8A1C7C", "#DA4167", "#CF1259"),
    ("#DA4167", "#DA4167", "#8A1C7C", "#DC56CA"),
    ("#72E3FD", "#C2F3FE", "#1FB1D6", "#FFFFFF"),
    ("#1FB1D6", "#1FB1D6", "#C2F3FE", "#0D4A59"),
    ("#FFFFFF", "#000000", "#000000", "#2F2F2F"),
    ("#000000", "#F4FAFF", "#FFFFFF", "#A3A3A3"),
]

_DEFAULT_TOKEN = 494

_REF   = 1000.0   # reference canvas size the p5 pixel constants assume
_SS    = 4        # supersampling factor for anti-aliased edges
_SEG_STEPS = 8    # samples per Bezier segment
_FPS   = 60.0     # p5 frameCount rate


class _Random:
    """The sketch's xorshift RNG, with JS int32 bitwise semantics."""

    def __init__(self, seed: int):
        self.seed = seed

    @staticmethod
    def _i32(v: int) -> int:
        return (v + 0x80000000) % 0x100000000 - 0x80000000

    def random_dec(self) -> float:
        s = self.seed
        s = self._i32(s ^ (s << 13))
        s = s ^ (s >> 17)
        s = self._i32(s ^ (s << 5))
        self.seed = s
        return (abs(s) % 1000) / 1000

    def random_between(self, a: float, b: float) -> float:
        return a + (b - a) * self.random_dec()

    def random_int(self, a: int, b: int) -> int:
        return int(self.random_between(a, b + 1) // 1)

    def random_choice_index(self, n: int) -> int:
        return int(self.random_between(0, n * 0.99) // 1)


class _Params:
    """Token traits, drawn from the RNG in the same order as the sketch."""

    def __init__(self, token: int):
        rng = _Random(SEEDS[token])
        self.palette = rng.random_choice_index(len(_PALETTES))
        self.op = rng.random_int(50, 80)
        self.sw = rng.random_between(0.1, 2.5)
        self.y_h = rng.random_between(0.3, 0.6)
        self.dist = rng.random_between(2, 20)
        self.freq = rng.random_between(10, 50)
        self.freq2 = rng.random_between(15, 40)
        self.sin_amp = rng.random_between(40, 140)
        self.amp = rng.random_between(2, 25)
        self.amp2 = rng.random_between(2, 25)
        self.single_wave = rng.random_between(0, 100) > 99
        self.background = rng.random_between(0, 100)
        self.num_stars = rng.random_int(5, 8)
        # (diameter, x, y) — diameter in 1/500ths, position in percent
        self.stars = [(rng.random_int(2, 10), rng.random_int(10, 90), rng.random_int(10, 30))
                      for _ in range(8)]


_token = _DEFAULT_TOKEN
_palette_shift = 0
_speed = 1.0
_amp_scale = 1.0
_frame = 0.0

_p: _Params
_bg: np.ndarray
_fill: np.ndarray
_fill_alpha = 1.0
_stroke: np.ndarray
_stroke_alpha = 1.0
_bez_t = np.linspace(0.0, 1.0, _SEG_STEPS + 1, dtype=np.float32)[1:, None]


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _rgb(hex_str: str) -> np.ndarray:
    v = int(hex_str.lstrip('#'), 16)
    return np.array([(v >> 16) & 255, (v >> 8) & 255, v & 255], dtype=np.float32)


def _new_mask() -> tuple[Image.Image, ImageDraw.ImageDraw]:
    size = pf_canvas.W * _SS
    mask = Image.new('L', (size, size), 0)
    return mask, ImageDraw.Draw(mask)


def _mask_coverage(mask: Image.Image) -> np.ndarray:
    small = mask.resize((pf_canvas.W, pf_canvas.H), Image.BOX)
    return np.asarray(small, dtype=np.float32)[:, :, None] / 255.0


def _apply_token():
    """Rebuild colours and the static background (gradient/solid + stars)."""
    global _p, _bg, _fill, _fill_alpha, _stroke, _stroke_alpha
    _p = _Params(_token)
    primary, s_color, w_color, secondary = _PALETTES[(_p.palette + _palette_shift) % len(_PALETTES)]
    # The sketch appends the decimal opacity to the hex string, so op=74 means 0x74
    op_alpha = int(str(_p.op), 16) / 255.0

    c1 = _rgb(primary)
    if 60 <= _p.background < 79.5 or _p.background >= 99:
        # setGradient(): lerpColor from primary at the top to secondary at the bottom
        t = np.linspace(0.0, 1.0, pf_canvas.H, dtype=np.float32)[:, None, None]
        bg = c1 + (_rgb(secondary) - c1) * t
    else:
        bg = c1[None, None, :]
    bg = np.broadcast_to(bg, (pf_canvas.H, pf_canvas.W, 3)).copy()

    if _p.background >= 79.5:
        mask, draw = _new_mask()
        scale = pf_canvas.W * _SS / _REF
        for d, x, y in _p.stars[:_p.num_stars]:
            cx, cy, r = x / 100 * _REF * scale, y / 100 * _REF * scale, d / 1000 * _REF * scale
            draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=255)
        bg += (_rgb(w_color) - bg) * _mask_coverage(mask)
    _bg = bg

    _fill = _rgb(w_color)
    _fill_alpha = 1.0 if _p.single_wave else op_alpha
    _stroke = _rgb(s_color)
    _stroke_alpha = op_alpha
    logger.info("Waves on Chain: token #%d, palette %d%s", _token,
                (_p.palette + _palette_shift) % len(_PALETTES),
                " (single wave)" if _p.single_wave else "")


def setup():
    global _token, _palette_shift, _speed, _amp_scale, _frame
    _token = _DEFAULT_TOKEN; _palette_shift = 0; _speed = 1.0; _amp_scale = 1.0; _frame = 0.0
    _apply_token()


def update(dt: float, inp) -> None:
    global _token, _palette_shift, _speed, _amp_scale, _frame
    token, shift = _token, _palette_shift
    if inp.knob_deltas[0]: _token = (_token + inp.knob_deltas[0]) % len(SEEDS)
    if inp.btn_pressed[0]: _token = _DEFAULT_TOKEN
    if inp.knob_deltas[1]: _speed = _clamp(_speed + inp.knob_deltas[1] * 0.1, 0.0, 5.0)
    if inp.btn_pressed[1]: _speed = 1.0
    if inp.knob_deltas[2]: _palette_shift = (_palette_shift + inp.knob_deltas[2]) % len(_PALETTES)
    if inp.btn_pressed[2]: _palette_shift = 0
    if inp.knob_deltas[3]: _amp_scale = _clamp(_amp_scale + inp.knob_deltas[3] * 0.1, 0.0, 3.0)
    if inp.btn_pressed[3]: _amp_scale = 1.0
    if (_token, _palette_shift) != (token, shift):
        _apply_token()
    _frame += dt * _FPS * _speed


def _wave_path(y: float, i: float) -> np.ndarray:
    """Replicates one waves() shape: vertex list + p5's Catmull-Rom endShape(CLOSE)."""
    w = h = _REF
    xs = np.arange(-150.0, w + 150.0, _p.freq)
    ys = y + w / _p.sin_amp * _amp_scale * (
        np.sin(-0.5 * xs / w * _p.amp + _frame / _p.freq) +
        np.sin(-0.7 * xs / w * _p.amp2 + _frame / _p.freq2)
    )
    v = np.concatenate([
        [[-150.0, h], [-150.0, y]],
        np.column_stack([xs * i, ys]),
        [[w + 600.0, y], [w + 600.0, h + 150.0]],
        [[-150.0, h]],   # CLOSE pushes vertices[0]
    ])

    # p5 draws Bezier segments v[k] → v[k+1] for k = 1..n-3, first/last are controls
    p0, p1, p2, p3 = v[:-3], v[1:-2], v[2:-1], v[3:]
    b1 = p1 + (p2 - p0) / 6.0
    b2 = p2 + (p1 - p3) / 6.0
    t = _bez_t[None]                      # (1, steps, 1)
    mt = 1.0 - t
    pts = (mt ** 3 * p1[:, None] + 3 * mt * mt * t * b1[:, None] +
           3 * mt * t * t * b2[:, None] + t ** 3 * p2[:, None]).reshape(-1, 2)
    # then lineTo(-150, h) and closePath back to v[1]
    return np.concatenate([v[1:2], pts, v[-1:]])


def _coverage(path: np.ndarray, fill: bool) -> np.ndarray:
    mask, draw = _new_mask()
    scale = pf_canvas.W * _SS / _REF
    pts = [tuple(p) for p in (path * scale).tolist()]
    if fill:
        draw.polygon(pts, fill=255)
    else:
        width = max(1, round(_p.sw * scale))
        draw.line(pts + [pts[0]], fill=255, width=width)
    return _mask_coverage(mask)


def draw() -> None:
    out = _bg.copy()
    step = 100.0 if _p.single_wave else _p.dist

    y = _REF * _p.y_h
    i = 1.0
    while y <= _REF:
        path = _wave_path(y, i)
        out += (_fill - out) * (_coverage(path, fill=True) * _fill_alpha)
        out += (_stroke - out) * (_coverage(path, fill=False) * _stroke_alpha)
        y += (_REF / 100.0) * step * i
        i += 0.2

    pf_canvas.blit(out.astype(np.uint8))
    pf_canvas.present()
