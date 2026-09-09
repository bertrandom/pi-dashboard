import time
from PIL import Image, ImageDraw
from modes.base import BaseMode, image_to_canvas
from modes.spotify import TEXT_GLYPHS, _draw_glyph_text, _glyph_width

W, H = 64, 32
_BLINK_INTERVAL = 0.6


class OnAirMode(BaseMode):
    def __init__(self, config):
        super().__init__(config)
        self._blink_on = True
        self._blink_t = 0.0
        self._base_frame = None

    def start(self):
        super().start()
        self._blink_on = True
        self._blink_t = time.time()
        self._base_frame = self._build_base()

    def _build_base(self):
        img = Image.new('RGB', (W, H), (10, 0, 0))
        draw = ImageDraw.Draw(img)
        draw.rectangle([0, 0, W - 1, H - 1], outline=(140, 0, 0))
        draw.rectangle([1, 1, W - 2, H - 2], outline=(80, 0, 0))
        text = 'ON AIR'
        tw = _glyph_width(text, TEXT_GLYPHS)
        tx = (W - tw) // 2
        ty = (H - 7) // 2
        _draw_glyph_text(draw, tx, ty, text, (255, 255, 255), TEXT_GLYPHS)
        return img

    def render(self, canvas):
        now = time.time()
        if now - self._blink_t >= _BLINK_INTERVAL:
            self._blink_on = not self._blink_on
            self._blink_t = now

        if self._base_frame is None:
            self._base_frame = self._build_base()

        img = self._base_frame.copy()
        draw = ImageDraw.Draw(img)

        dot_y = H // 2
        dot_color = (255, 40, 40) if self._blink_on else (50, 0, 0)
        for dot_x in (5, W - 6):
            draw.ellipse([dot_x - 2, dot_y - 2, dot_x + 2, dot_y + 2], fill=dot_color)

        image_to_canvas(canvas, img)
