# Pattern: Waves on Chain #494
# Original: "Waves on chain" by Chromalita (https://twitter.com/chromalita),
# published by Chromorphs. Ported from the p5.js source for token #494.
#
# The original draws each wave as a p5 curveVertex() shape at the viewer's
# window size. We replay the same Catmull-Rom geometry in a fixed reference
# space, rasterise it supersampled with PIL, and alpha-composite in numpy.
import math

import numpy as np
from PIL import Image, ImageDraw

from .. import core_canvas as pf_canvas

NAME = "Waves on Chain"
KNOB_LABELS = ["speed", "height", "spacing", "amp"]

# Token #494 parameters, taken from the original's xorshift RNG seeded with
# hash 0x5f7c6d0920705db7…  (palette "Island sunset", reversed).
_BG_TOP    = (0x00, 0x4E, 0x98)   # palette[0]
_STROKE    = (0x00, 0x4E, 0x98)   # palette[1]
_FILL      = (0xFF, 0x85, 0x33)   # palette[2]
_BG_BOTTOM = (0xAD, 0xD8, 0xFF)   # palette[3]
_ALPHA     = 0x74 / 255.0         # op=74, appended to the hex colour strings
_STROKE_W  = 1.4128               # sW
_Y_H       = 0.5256               # yH: first wave's baseline, fraction of height
_DIST      = 8.624                # dist: wave spacing, percent of height
_FREQ      = 44.92                # freq: vertex step (px) and time divisor
_FREQ2     = 24.125
_SIN_AMP   = 51.5
_AMP       = 14.926
_AMP2      = 13.086

_REF   = 1000.0   # reference canvas size the p5 pixel constants assume
_SS    = 4        # supersampling factor for anti-aliased edges
_SEG_STEPS = 8    # samples per Bezier segment
_FPS   = 60.0     # p5 frameCount rate

_speed = 1.0
_y_h = _Y_H
_dist = _DIST
_sin_amp = _SIN_AMP
_frame = 0.0

_bg: np.ndarray
_bez_t: np.ndarray


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def setup():
    global _speed, _y_h, _dist, _sin_amp, _frame, _bg, _bez_t
    _speed = 1.0; _y_h = _Y_H; _dist = _DIST; _sin_amp = _SIN_AMP; _frame = 0.0

    # setGradient(): lerpColor from palette[0] at the top to palette[3] at the bottom
    t = np.linspace(0.0, 1.0, pf_canvas.H, dtype=np.float32)[:, None, None]
    top = np.array(_BG_TOP, dtype=np.float32)
    bot = np.array(_BG_BOTTOM, dtype=np.float32)
    _bg = np.broadcast_to(top + (bot - top) * t, (pf_canvas.H, pf_canvas.W, 3)).copy()

    _bez_t = np.linspace(0.0, 1.0, _SEG_STEPS + 1, dtype=np.float32)[1:, None]


def update(dt: float, inp) -> None:
    global _speed, _y_h, _dist, _sin_amp, _frame
    if inp.knob_deltas[0]: _speed = _clamp(_speed + inp.knob_deltas[0] * 0.1, 0.0, 5.0)
    if inp.btn_pressed[0]: _speed = 1.0
    if inp.knob_deltas[1]: _y_h = _clamp(_y_h + inp.knob_deltas[1] * 0.02, 0.1, 0.9)
    if inp.btn_pressed[1]: _y_h = _Y_H
    if inp.knob_deltas[2]: _dist = _clamp(_dist + inp.knob_deltas[2] * 0.5, 2.0, 30.0)
    if inp.btn_pressed[2]: _dist = _DIST
    # sinAmp divides the amplitude, so turning clockwise shrinks it; invert the knob
    if inp.knob_deltas[3]: _sin_amp = _clamp(_sin_amp - inp.knob_deltas[3] * 4.0, 15.0, 200.0)
    if inp.btn_pressed[3]: _sin_amp = _SIN_AMP
    _frame += dt * _FPS * _speed


def _wave_path(y: float, i: float) -> np.ndarray:
    """Replicates one waves() shape: vertex list + p5's Catmull-Rom endShape(CLOSE)."""
    w = h = _REF
    xs = np.arange(-150.0, w + 150.0, _FREQ)
    ys = y + w / _sin_amp * (
        np.sin(-0.5 * xs / w * _AMP + _frame / _FREQ) +
        np.sin(-0.7 * xs / w * _AMP2 + _frame / _FREQ2)
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
    size = pf_canvas.W * _SS
    scale = size / _REF
    mask = Image.new('L', (size, size), 0)
    draw = ImageDraw.Draw(mask)
    pts = [tuple(p) for p in (path * scale).tolist()]
    if fill:
        draw.polygon(pts, fill=255)
    else:
        width = max(1, round(_STROKE_W * scale))
        draw.line(pts + [pts[0]], fill=255, width=width)
    small = mask.resize((pf_canvas.W, pf_canvas.H), Image.BOX)
    return np.asarray(small, dtype=np.float32)[:, :, None] * (_ALPHA / 255.0)


def draw() -> None:
    out = _bg.copy()
    fill = np.array(_FILL, dtype=np.float32)
    stroke = np.array(_STROKE, dtype=np.float32)

    y = _REF * _y_h
    i = 1.0
    while y <= _REF:
        path = _wave_path(y, i)
        a = _coverage(path, fill=True)
        out += (fill - out) * a
        a = _coverage(path, fill=False)
        out += (stroke - out) * a
        y += (_REF / 100.0) * _dist * i
        i += 0.2

    pf_canvas.blit(out.astype(np.uint8))
    pf_canvas.present()
