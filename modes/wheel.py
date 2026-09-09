import math
import random
import time

from PIL import Image, ImageDraw, ImageFont

from modes.base import BaseMode, image_to_canvas

W, H = 64, 32

# Wheel geometry — slightly left of centre so pointer fits on the right
CX, CY, R = 24, 16, 13
_R2 = R * R
_R_RIM2 = (R - 1.5) ** 2
_R_HUB2 = 2.5 ** 2

# Segment colour palette (8 vivid hues, cycles for N > 8)
PALETTE = [
    (220, 40,  40),   # red
    (220, 130, 30),   # orange
    (205, 195, 30),   # yellow
    (40,  175, 40),   # green
    (30,  165, 210),  # cyan
    (40,  65,  215),  # blue
    (140, 40,  215),  # purple
    (215, 40,  155),  # pink
]

# Rainbow used for the scrolling result text
RAINBOW = [
    (255, 60,  60),
    (255, 160, 0),
    (240, 225, 0),
    (50,  210, 50),
    (0,   175, 220),
    (60,  60,  255),
    (195, 0,   215),
]

_FONT = ImageFont.load_default()

PHASE_IDLE     = 'idle'
PHASE_SPINNING = 'spinning'
PHASE_RESULT   = 'result'
PHASE_SHOWTEXT = 'showtext'


class WheelMode(BaseMode):
    def __init__(self, config):
        super().__init__(config)
        self._phase        = PHASE_IDLE
        self._angle        = 0.0
        self._spin_start   = 0.0
        self._target       = 0.0
        self._spin_dur     = 4.0
        self._spin_elapsed = 0.0
        self._result_idx   = -1
        self._phase_t      = 0.0
        self._text_x       = float(W)
        self._text_content = ''
        self._t            = 0.0
        self._last_mono    = 0.0

        # Pre-compute which pixels lie inside the wheel and their angle + flags
        self._wpx = []
        for y in range(H):
            for x in range(W):
                dx, dy = x - CX, y - CY
                d2 = dx * dx + dy * dy
                if d2 <= _R2:
                    self._wpx.append((x, y, math.atan2(dy, dx), d2 > _R_RIM2, d2 < _R_HUB2))

    def start(self):
        super().start()
        self._t = 0.0
        self._last_mono = time.monotonic()

    # ── Public API ────────────────────────────────────────────────────────────

    def spin(self):
        """Trigger a spin. Returns the chosen label, or None if not possible."""
        choices = self._choices()
        if not choices or self._phase == PHASE_SPINNING:
            return None

        n = len(choices)
        result_idx = random.randint(0, n - 1)
        seg = 2 * math.pi / n
        # Choose target angle so result_idx lands at the pointer (3-o'clock, angle 0)
        n_rot = 7 + random.randint(0, 4)
        target = -(result_idx + 0.5) * seg + n_rot * 2 * math.pi
        while target < self._angle + 2 * math.pi:
            target += 2 * math.pi

        self._spin_start   = self._angle
        self._target       = target
        self._spin_dur     = 3.5 + random.uniform(0.0, 1.5)
        self._spin_elapsed = 0.0
        self._result_idx   = result_idx
        self._phase        = PHASE_SPINNING
        self._phase_t      = 0.0
        return choices[result_idx]

    def get_state(self):
        choices = self._choices()
        result = choices[self._result_idx] if 0 <= self._result_idx < len(choices) else None
        return {'phase': self._phase, 'result': result, 'choices': choices}

    # ── Render loop ───────────────────────────────────────────────────────────

    def render(self, canvas):
        mono = time.monotonic()
        dt = min(mono - self._last_mono, 0.1)
        self._last_mono = mono
        self._t     += dt
        self._phase_t += dt

        choices = self._choices()
        n = len(choices)

        img  = Image.new('RGB', (W, H), (0, 0, 0))
        draw = ImageDraw.Draw(img)

        if not choices:
            self._draw_no_choices(draw)
        elif self._phase == PHASE_IDLE:
            idle_pulse = 0.82 + 0.18 * math.sin(self._t * 1.1)
            self._draw_wheel(draw, self._angle, n, self._result_idx, 0.0, idle_pulse)
            self._draw_pointer(draw)
        elif self._phase == PHASE_SPINNING:
            self._spin_elapsed += dt
            p    = min(1.0, self._spin_elapsed / self._spin_dur)
            ease = 1.0 - (1.0 - p) ** 5          # quintic ease-out
            self._angle = self._spin_start + (self._target - self._spin_start) * ease
            self._draw_wheel(draw, self._angle, n, -1, 0.0, 1.0)
            self._draw_pointer(draw)
            self._draw_spin_fx(draw, 1.0 - p)
            if p >= 1.0:
                self._phase   = PHASE_RESULT
                self._phase_t = 0.0
        elif self._phase == PHASE_RESULT:
            hl = 0.5 + 0.5 * math.sin(self._phase_t * 10.0)
            self._draw_wheel(draw, self._angle, n, self._result_idx, hl, 1.0)
            self._draw_pointer(draw)
            self._draw_result_fx(draw)
            if self._phase_t >= 2.0:
                label = choices[self._result_idx] if 0 <= self._result_idx < len(choices) else '?'
                self._text_content = label
                self._text_x       = float(W)
                self._phase        = PHASE_SHOWTEXT
                self._phase_t      = 0.0
        elif self._phase == PHASE_SHOWTEXT:
            text   = self._text_content
            text_w = len(text) * 6
            self._text_x -= 40.0 * dt
            self._draw_showtext(draw, text, int(self._text_x))
            if self._text_x < -text_w:
                self._phase   = PHASE_IDLE
                self._phase_t = 0.0

        image_to_canvas(canvas, img)

    # ── Draw helpers ──────────────────────────────────────────────────────────

    def _draw_wheel(self, draw, angle, n, result_idx, highlight, idle_pulse):
        seg = 2 * math.pi / n
        div = 0.06   # angular width (rad) of divider lines between segments

        for (x, y, pa, is_rim, is_hub) in self._wpx:
            if is_rim:
                draw.point([x, y], fill=(145, 145, 145))
            elif is_hub:
                draw.point([x, y], fill=(200, 200, 200))
            else:
                frac = ((pa - angle) % (2 * math.pi)) / seg
                si   = int(frac) % n
                sf   = frac - int(frac)
                if n > 1 and (sf < div or sf > 1.0 - div):
                    draw.point([x, y], fill=(0, 0, 0))
                else:
                    base = PALETTE[si % len(PALETTE)]
                    if si == result_idx and highlight > 0:
                        # Pulse winning segment towards white
                        col = tuple(min(255, int(c + (255 - c) * highlight * 0.88)) for c in base)
                    elif result_idx >= 0 and si != result_idx:
                        # Dim non-winners during idle-after-spin
                        col = tuple(int(c * idle_pulse * 0.55) for c in base)
                    else:
                        col = tuple(int(c * idle_pulse) for c in base)
                    draw.point([x, y], fill=col)

    def _draw_pointer(self, draw):
        # Right-pointing indicator arrow (tip at wheel edge, opening rightward)
        tx = CX + R + 2
        ty = CY
        draw.polygon([(tx, ty), (tx + 6, ty - 4), (tx + 6, ty + 4)], fill=(255, 255, 255))

    def _draw_spin_fx(self, draw, intensity):
        """Particles flying off the wheel edge while spinning."""
        count = max(1, int(intensity * 9))
        for _ in range(count):
            a     = random.uniform(0, 2 * math.pi)
            r_off = R + random.randint(1, 5)
            x = int(CX + r_off * math.cos(a))
            y = int(CY + r_off * math.sin(a))
            if 0 <= x < W and 0 <= y < H:
                draw.point([x, y], fill=random.choice(PALETTE))

    def _draw_result_fx(self, draw):
        """Orbiting sparkle ring around the wheel when result is shown."""
        t = self._phase_t
        for i in range(10):
            a     = t * 2.8 + i * 2 * math.pi / 10
            r_off = R + 2 + int(3 * math.sin(t * 7.0 + i))
            x = int(CX + r_off * math.cos(a))
            y = int(CY + r_off * math.sin(a))
            if 0 <= x < W and 0 <= y < H:
                draw.point([x, y], fill=RAINBOW[i % len(RAINBOW)])

    def _draw_showtext(self, draw, text, x):
        """Full-screen result reveal: gradient bg + sparkles + rainbow scrolling text."""
        # Dark gradient background
        for row in range(H):
            f = row / (H - 1)
            draw.line([(0, row), (W - 1, row)],
                      fill=(int(8 + 14 * f), int(4 + 7 * f), int(22 + 16 * f)))
        # Twinkle particles
        t = self._phase_t
        for i in range(12):
            sx = int(W * ((i * 0.317 + t * 0.23) % 1.0))
            sy = int(H * ((i * 0.471 + t * 0.17) % 1.0))
            b  = max(0, int(70 + 130 * math.sin(t * 4.5 + i * 1.6)))
            draw.point([sx, sy], fill=(b, b, b))
        # Rainbow scrolling text (vertically centred)
        ty = (H - 8) // 2
        cy_off = int(self._phase_t * 3)
        for i, ch in enumerate(text):
            cx = x + i * 6
            if -6 <= cx < W:
                col = RAINBOW[(i + cy_off) % len(RAINBOW)]
                # Shadow
                draw.text([cx + 1, ty + 1], ch, font=_FONT, fill=(0, 0, 0))
                draw.text([cx, ty], ch, font=_FONT, fill=col)

    def _draw_no_choices(self, draw):
        p = int(75 + 75 * math.sin(self._t * 1.5))
        draw.text([2,  2], 'Wheel',      font=_FONT, fill=(p, p, p))
        draw.text([2, 12], 'No choices', font=_FONT, fill=(55, 65, 85))
        draw.text([2, 22], 'Add in UI',  font=_FONT, fill=(55, 65, 85))

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _choices(self):
        cfg = self.config.get_section('wheel')
        return [str(c).strip() for c in cfg.get('choices', []) if str(c).strip()]
