import threading
import time

import requests
from PIL import Image, ImageDraw, ImageFont

from modes.base import BaseMode, image_to_canvas

W, H = 64, 32

try:
    _FONT = ImageFont.load_default(size=8)
except TypeError:                           # Pillow < 10
    _FONT = ImageFont.load_default()

try:
    _bb = _FONT.getbbox('A')
    _FTOP = _bb[1]
    _FBOT = _bb[3]
except AttributeError:                      # Pillow < 8
    try:
        _FBOT = _FONT.getsize('A')[1]
        _FTOP = 0
    except Exception:
        _FTOP, _FBOT = 0, 8

_FMID  = (_FTOP + _FBOT) // 2
_FH    = _FBOT - _FTOP

PILL_D = max(3, _FH - 1)
ROW_H  = _FBOT + 3

_UP   = (0, 200, 60)
_DOWN = (220, 40, 40)
_PEND = (80, 80, 80)
_TEXT = (180, 180, 200)
_BG   = (0, 0, 12)


class MonitoringMode(BaseMode):
    def __init__(self, config):
        super().__init__(config)
        self._lock = threading.Lock()
        self._status = {}            # ep_id -> {up, last_check, latency_ms}
        self._fetch_stop = threading.Event()
        self._fetch_thread = None
        self._scroll_y = 0.0
        self._last_mono = 0.0
        # Config cache — updated at most once per second in render(), not every frame.
        # Avoids holding Config._lock (deepcopy) at 100 Hz, which was causing
        # brief GIL stalls and stuttering scroll.
        self._cached_endpoints = []
        self._cached_speed = 20.0
        self._last_cfg_mono = 0.0

    def start(self):
        super().start()
        self._scroll_y = 0.0
        self._last_mono = time.monotonic()
        self._last_cfg_mono = 0.0   # force immediate cache refresh
        self._fetch_stop = threading.Event()
        self._fetch_thread = threading.Thread(
            target=self._fetch_loop, daemon=True, name='monitoring-fetch'
        )
        self._fetch_thread.start()

    def stop(self):
        super().stop()
        self._fetch_stop.set()

    def get_status(self):
        with self._lock:
            return dict(self._status)

    # ── Background checker ────────────────────────────────────────────────────

    def _fetch_loop(self):
        last_check = {}     # ep_id -> monotonic timestamp of last check start
        check_threads = {}  # ep_id -> Thread (concurrent per-endpoint checks)

        while not self._fetch_stop.is_set():
            cfg = self.config.get_section('monitoring')
            endpoints = cfg.get('endpoints', [])
            now = time.monotonic()

            for ep in endpoints:
                ep_id = ep.get('id', '')
                if not ep_id:
                    continue
                interval_s = max(1, int(ep.get('interval', 5))) * 60
                t = check_threads.get(ep_id)
                if (t is None or not t.is_alive()) and \
                        now - last_check.get(ep_id, 0) >= interval_s:
                    # Each endpoint gets its own thread so a slow host doesn't
                    # block checks for the others.
                    t = threading.Thread(
                        target=self._check, args=(ep,), daemon=True,
                        name=f'mon-check-{ep_id[:6]}'
                    )
                    t.start()
                    check_threads[ep_id] = t
                    last_check[ep_id] = now

            # Prune finished threads and stale status entries.
            check_threads = {k: v for k, v in check_threads.items() if v.is_alive()}
            current_ids = {ep.get('id', '') for ep in endpoints}
            with self._lock:
                for gone in set(self._status) - current_ids:
                    del self._status[gone]

            self._fetch_stop.wait(10)

    def _check(self, ep):
        ep_id = ep.get('id', '')
        url = ep.get('url', '').strip()
        if not url:
            return
        if not url.startswith(('http://', 'https://')):
            url = 'http://' + url
        t0 = time.monotonic()
        try:
            # HEAD: only headers, minimal body parsing → shorter GIL hold.
            r = requests.head(url, timeout=10, allow_redirects=True)
            latency = (time.monotonic() - t0) * 1000
            up = r.status_code < 500
        except Exception:
            latency = (time.monotonic() - t0) * 1000
            up = False
        with self._lock:
            self._status[ep_id] = {
                'up': up,
                'last_check': time.time(),
                'latency_ms': round(latency, 1),
            }

    # ── Render ────────────────────────────────────────────────────────────────

    def render(self, canvas):
        mono = time.monotonic()
        dt = min(mono - self._last_mono, 0.1)
        self._last_mono = mono

        # Refresh config cache once per second — not every frame.
        if mono - self._last_cfg_mono >= 1.0:
            cfg = self.config.get_section('monitoring')
            self._cached_endpoints = cfg.get('endpoints', [])
            self._cached_speed = max(0.0, float(cfg.get('scroll_speed', 20)))
            self._last_cfg_mono = mono

        endpoints = self._cached_endpoints
        speed = self._cached_speed

        with self._lock:
            status = dict(self._status)

        def _key(ep):
            up = status.get(ep.get('id', ''), {}).get('up', None)
            return ({False: 0, None: 1, True: 2}.get(up, 1), ep.get('name', '').lower())

        eps = sorted(endpoints, key=_key)
        n = len(eps)

        img = Image.new('RGB', (W, H), _BG)
        draw = ImageDraw.Draw(img)

        if not n:
            draw.text([2, H // 2 - _FMID], 'No endpoints',
                      font=_FONT, fill=(60, 60, 80))
            image_to_canvas(canvas, img)
            return

        total_h = n * ROW_H
        if total_h > H and speed > 0:
            self._scroll_y = (self._scroll_y + dt * speed) % total_h
        else:
            self._scroll_y = 0.0

        offset = int(self._scroll_y)
        r = PILL_D // 2

        for i, ep in enumerate(eps):
            row_y = i * ROW_H - offset
            if row_y < -ROW_H:
                row_y += total_h
            if row_y < -ROW_H or row_y >= H:
                continue

            cy = row_y + ROW_H // 2

            up = status.get(ep.get('id', ''), {}).get('up', None)
            color = _UP if up is True else (_DOWN if up is False else _PEND)

            dot_cx = 1 + r
            # Pillow clips primitives to the image bounds.  Keep the ellipse's
            # coordinates ordered and let it clip naturally; clamping each
            # edge independently creates an inverted box while a row is
            # leaving through the top and raises ValueError, dropping frames.
            draw.ellipse([dot_cx - r, cy - r,
                          dot_cx + r, cy + r], fill=color)

            ty = cy - _FMID
            name = ep.get('name', ep.get('url', '?'))[:10]
            if ty < H and ty + _FH > 0:
                draw.text([dot_cx + r + 3, ty], name, font=_FONT, fill=_TEXT)

        image_to_canvas(canvas, img)
