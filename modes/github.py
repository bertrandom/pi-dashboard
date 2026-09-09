import math
import re
import threading
import time
from datetime import date, timedelta

import requests
from PIL import Image, ImageDraw, ImageFont

from modes.base import BaseMode, image_to_canvas

W, H = 64, 32
COLS = 26        # weeks shown (~6 months)
ROWS = 7         # days per week (Sun–Sat)
CELL = 2         # pixels per side (square cells)
GRID_W = COLS * CELL   # 52
GRID_H = ROWS * CELL   # 14
GRID_X = (W - GRID_W) // 2   # 6
GRID_Y = (H - GRID_H) // 2   # 9

LEVEL_FACTORS = [0.12, 0.35, 0.57, 0.78, 1.0]
_FONT = ImageFont.load_default()


def _level_color(level, base_color):
    f = LEVEL_FACTORS[max(0, min(4, level))]
    return tuple(max(0, min(255, int(c * f))) for c in base_color)


def _fetch_contributions(username):
    url = f'https://github.com/users/{username}/contributions'
    resp = requests.get(
        url,
        headers={
            'User-Agent': 'Mozilla/5.0 (compatible; LED-Matrix/1.0)',
            'Accept': 'text/html,application/xhtml+xml',
        },
        timeout=15,
    )
    resp.raise_for_status()
    data = {}
    # Modern GitHub uses <td data-date="..." data-level="...">
    for m in re.finditer(r'data-date="(\d{4}-\d{2}-\d{2})"[^>]*data-level="(\d)"', resp.text):
        data[m.group(1)] = int(m.group(2))
    if not data:
        # Fallback: reversed attribute order
        for m in re.finditer(r'data-level="(\d)"[^>]*data-date="(\d{4}-\d{2}-\d{2})"', resp.text):
            data[m.group(2)] = int(m.group(1))
    if not data:
        # Legacy: SVG <rect> elements
        for rect in re.findall(r'<rect[^>]+>', resp.text):
            date_m = re.search(r'data-date="(\d{4}-\d{2}-\d{2})"', rect)
            level_m = re.search(r'data-level="(\d)"', rect)
            if date_m and level_m:
                data[date_m.group(1)] = int(level_m.group(1))
    return data


def _build_grid(contributions):
    today = date.today()
    # days_since_sunday: Sun=0, Mon=1, …, Sat=6
    days_since_sunday = (today.weekday() + 1) % 7
    current_week_start = today - timedelta(days=days_since_sunday)
    grid_start = current_week_start - timedelta(weeks=COLS - 1)
    today_col, today_row = COLS - 1, days_since_sunday
    grid = []
    for col in range(COLS):
        week = []
        for row in range(ROWS):
            d = grid_start + timedelta(weeks=col, days=row)
            if d <= today:
                week.append(contributions.get(d.strftime('%Y-%m-%d'), 0))
            else:
                week.append(-1)  # future cell
        grid.append(week)
    return grid, today_col, today_row


class GitHubMode(BaseMode):
    def __init__(self, config):
        super().__init__(config)
        self._lock = threading.Lock()
        self._contributions = {}
        self._fetched_for = ''     # username for which data was successfully fetched
        self._last_fetch = 0.0
        self._last_error = ''
        self._fetch_stop = threading.Event()
        self._fetch_thread = None
        self._t = 0.0
        self._last_mono = 0.0

    def start(self):
        super().start()
        self._t = 0.0
        self._last_mono = time.monotonic()
        self._fetch_stop = threading.Event()
        self._fetch_thread = threading.Thread(
            target=self._fetch_loop, args=(self._fetch_stop,),
            daemon=True, name='github-fetch'
        )
        self._fetch_thread.start()

    def stop(self):
        super().stop()
        self._fetch_stop.set()

    def refresh(self):
        """Force immediate re-fetch — call when username changes."""
        self._last_fetch = 0.0
        with self._lock:
            self._fetched_for = ''
            self._last_error = ''

    # ── Background fetch ──────────────────────────────────────────────────────

    def _fetch_loop(self, stop_event):
        while not stop_event.is_set():
            cfg = self.config.get_section('github')
            username = cfg.get('username', '').strip()
            interval = max(300, int(cfg.get('refresh_interval', 3600)))
            now = time.monotonic()
            if username and now - self._last_fetch >= interval:
                self._do_fetch(username)
            stop_event.wait(60)

    def _do_fetch(self, username):
        try:
            data = _fetch_contributions(username)
            with self._lock:
                self._contributions = data
                self._fetched_for = username
                self._last_error = ''
            self._last_fetch = time.monotonic()
        except Exception as e:
            with self._lock:
                self._last_error = str(e)[:40]

    # ── Render ────────────────────────────────────────────────────────────────

    def render(self, canvas):
        mono = time.monotonic()
        dt = min(mono - self._last_mono, 0.1)
        self._last_mono = mono
        self._t += dt

        cfg = self.config.get_section('github')
        username = cfg.get('username', '').strip()
        base_color = list(cfg.get('color', [0, 255, 0]))

        img = Image.new('RGB', (W, H), (0, 0, 0))
        draw = ImageDraw.Draw(img)

        with self._lock:
            contribs = dict(self._contributions)
            fetched_for = self._fetched_for
            error = self._last_error

        if not username:
            self._draw_no_user(draw)
        elif fetched_for != username:
            self._draw_loading(draw, username, error)
        else:
            grid, today_col, today_row = _build_grid(contribs)
            self._draw_grid(draw, grid, base_color, today_col, today_row)

        image_to_canvas(canvas, img)

    def _draw_grid(self, draw, grid, base_color, today_col, today_row):
        pulse = 0.5 + 0.5 * math.sin(self._t * 3.0)
        for col in range(COLS):
            for row in range(ROWS):
                level = grid[col][row]
                if level < 0:
                    continue
                x = GRID_X + col * CELL
                y = GRID_Y + row * CELL
                color = _level_color(level, base_color)
                if col == today_col and row == today_row:
                    color = tuple(int(c + (255 - c) * pulse * 0.85) for c in color)
                draw.rectangle([x, y, x + CELL - 1, y + CELL - 1], fill=color)

    def _draw_no_user(self, draw):
        pulse = int(80 + 80 * math.sin(self._t * 1.5))
        draw.text([2, 2], 'GitHub', font=_FONT, fill=(pulse, pulse, pulse))
        draw.text([2, 12], 'Set username', font=_FONT, fill=(50, 70, 90))
        draw.text([2, 22], 'in settings', font=_FONT, fill=(50, 70, 90))

    def _draw_loading(self, draw, username, error):
        pulse = int(60 + 80 * math.sin(self._t * 2.0))
        if error:
            draw.text([2, 2], 'GitHub', font=_FONT, fill=(pulse, 0, 0))
            draw.text([2, 12], 'Error:', font=_FONT, fill=(160, 40, 40))
            draw.text([2, 20], error[:10], font=_FONT, fill=(130, 30, 30))
            if len(error) > 10:
                draw.text([2, 27], error[10:20], font=_FONT, fill=(130, 30, 30))
        else:
            draw.text([2, 2], 'GitHub', font=_FONT, fill=(0, pulse, 0))
            draw.text([2, 12], (username or '?')[:10], font=_FONT, fill=(30, 100, 30))
            draw.text([2, 22], 'Loading...', font=_FONT, fill=(20, 60, 20))
