"""Kinect depth wireframe.

Reads the Xbox 360 Kinect depth stream through the kernel's gspca_kinect
driver (loaded with ``depth_mode=1``, see kinect-depth.conf) and renders it
as a slowly swaying 3D wireframe mesh.
"""

import colorsys
import ctypes
import fcntl
import glob
import logging
import math
import os
import select
import threading
import time

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

from modes.base import BaseMode

logger = logging.getLogger('kinect')

W, H = 128, 128

# Depth stream from gspca_kinect in depth mode: 640x480 Y10B (10-bit packed).
CAM_W, CAM_H = 640, 480
FRAME_BYTES = CAM_W * CAM_H * 10 // 8
RAW_INVALID = 1023

# Kinect depth camera intrinsics (approximate, from libfreenect calibration).
FX, FY = 594.2, 591.0
CX, CY = 320.0, 240.0

MIN_DEPTH = 0.45   # metres; the sensor can't see closer than this
# Raw values below this would be nearer than MIN_DEPTH. The sensor reports
# such junk (raw ~1-50) where IR is swamped, e.g. by sunlight on a window.
RAW_MIN = int(math.ceil((3.3309495161 - 1 / MIN_DEPTH) / 0.0030711016))

# Learned empty-scene depth, kept across restarts (the Kinect doesn't move).
BACKGROUND_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                               'kinect_background.npy')

try:
    _FONT = ImageFont.load_default(size=10)
except TypeError:                           # Pillow < 10
    _FONT = ImageFont.load_default()


def _gradient(stops):
    """256-entry RGB LUT interpolated through evenly spaced colour stops."""
    stops = np.array(stops, dtype=np.float32)
    pos = np.linspace(0, 255, len(stops))
    idx = np.arange(256)
    return np.stack(
        [np.interp(idx, pos, stops[:, c]) for c in range(3)], axis=1
    ).astype(np.uint8)


def _rainbow():
    lut = np.zeros((256, 3), dtype=np.uint8)
    for i in range(1, 256):
        t = i / 255.0
        r, g, b = colorsys.hsv_to_rgb(0.7 * (1.0 - t), 1.0, 0.25 + 0.75 * t)
        lut[i] = (int(r * 255), int(g * 255), int(b * 255))
    return lut


# Index 0 is background; higher indices are nearer (and brighter).
PALETTES = {
    'synth': _gradient([(0, 0, 0), (50, 0, 110), (230, 0, 210), (0, 220, 255), (225, 255, 255)]),
    'cyan': _gradient([(0, 0, 0), (0, 40, 90), (0, 170, 255), (190, 255, 255)]),
    'green': _gradient([(0, 0, 0), (0, 60, 0), (0, 230, 50), (190, 255, 190)]),
    'heat': _gradient([(0, 0, 0), (90, 0, 60), (255, 70, 0), (255, 255, 140)]),
    'white': _gradient([(0, 0, 0), (40, 40, 40), (255, 255, 255)]),
    'rainbow': _rainbow(),
}


def unpack_y10b(data):
    """Unpack a big-endian 10-bit packed bitstream into a (480, 640) uint16 array."""
    b = np.frombuffer(data, dtype=np.uint8).reshape(-1, 5).astype(np.uint16)
    out = np.empty((b.shape[0], 4), dtype=np.uint16)
    out[:, 0] = (b[:, 0] << 2) | (b[:, 1] >> 6)
    out[:, 1] = ((b[:, 1] & 0x3F) << 4) | (b[:, 2] >> 4)
    out[:, 2] = ((b[:, 2] & 0x0F) << 6) | (b[:, 3] >> 2)
    out[:, 3] = ((b[:, 3] & 0x03) << 8) | b[:, 4]
    return out.reshape(CAM_H, CAM_W)


def raw_to_metres(raw):
    """Kinect raw disparity → metres (NaN where invalid)."""
    raw = raw.astype(np.float32)
    denom = 3.3309495161 - 0.0030711016 * raw
    with np.errstate(divide='ignore', invalid='ignore'):
        z = 1.0 / denom
    z[(raw < RAW_MIN) | (raw >= RAW_INVALID) | (denom <= 0)] = np.nan
    return z


def find_device():
    """Return the /dev/video* node belonging to the Kinect camera, or None."""
    for path in sorted(glob.glob('/sys/class/video4linux/video*')):
        try:
            # .../videoN/device is the USB interface; its parent is the device.
            dev_dir = os.path.realpath(os.path.join(path, 'device', '..'))
            with open(os.path.join(dev_dir, 'idVendor')) as f:
                vendor = f.read().strip()
            with open(os.path.join(dev_dir, 'idProduct')) as f:
                product = f.read().strip()
        except OSError:
            continue
        if vendor == '045e' and product == '02ae':
            return '/dev/' + os.path.basename(path)
    return None


# ── Status LED ───────────────────────────────────────────────────────────────
# The LED hangs off the Kinect's motor device (045e:02b0), which has no kernel
# driver; it's set with a vendor control request (as libfreenect does) sent
# through usbfs. Needs root, which the service runs as.

LED_COLORS = {'off': 0, 'green': 1, 'red': 2, 'yellow': 3, 'blink': 4}


class _UsbCtrlTransfer(ctypes.Structure):
    _fields_ = [
        ('bRequestType', ctypes.c_uint8),
        ('bRequest', ctypes.c_uint8),
        ('wValue', ctypes.c_uint16),
        ('wIndex', ctypes.c_uint16),
        ('wLength', ctypes.c_uint16),
        ('timeout', ctypes.c_uint32),
        ('data', ctypes.c_void_p),
    ]


# _IOWR('U', 0, struct usbdevfs_ctrltransfer)
USBDEVFS_CONTROL = (3 << 30) | (ctypes.sizeof(_UsbCtrlTransfer) << 16) | (ord('U') << 8)


def _motor_device():
    for path in glob.glob('/sys/bus/usb/devices/*'):
        try:
            with open(os.path.join(path, 'idVendor')) as f:
                vendor = f.read().strip()
            with open(os.path.join(path, 'idProduct')) as f:
                product = f.read().strip()
            if vendor != '045e' or product != '02b0':
                continue
            with open(os.path.join(path, 'busnum')) as f:
                bus = int(f.read())
            with open(os.path.join(path, 'devnum')) as f:
                dev = int(f.read())
        except (OSError, ValueError):
            continue
        return f'/dev/bus/usb/{bus:03d}/{dev:03d}'
    return None


def set_led(color):
    """Set the Kinect's front LED; returns True on success."""
    value = LED_COLORS.get(color, LED_COLORS['off'])
    device = _motor_device()
    if not device:
        return False
    try:
        fd = os.open(device, os.O_RDWR)
    except OSError as e:
        logger.warning("Kinect LED: can't open %s: %s", device, e)
        return False
    try:
        req = _UsbCtrlTransfer(bRequestType=0x40, bRequest=0x06, wValue=value,
                               wIndex=0, wLength=0, timeout=1000, data=None)
        fcntl.ioctl(fd, USBDEVFS_CONTROL, req)
        return True
    except OSError as e:
        logger.warning("Kinect LED: control request failed: %s", e)
        return False
    finally:
        os.close(fd)


class _Stabilizer:
    """Temporal filter that keeps sensor noise from making dots jump.

    - A cell appears only after 2 consecutive valid frames and is held
      through up to 2 missing frames before it disappears.
    - Small changes are smoothed (EMA); a big jump is taken only once the
      next frame confirms it, so single-frame spikes are dropped.
    """

    APPEAR_FRAMES = 2
    HOLD_FRAMES = 3

    def __init__(self, shape):
        self.shown = np.full(shape, np.nan, dtype=np.float32)
        self.pending = np.full(shape, np.nan, dtype=np.float32)
        self.seen = np.zeros(shape, dtype=np.int16)
        self.missing = np.zeros(shape, dtype=np.int16)

    def update(self, z, alpha):
        valid = ~np.isnan(z)
        self.seen = np.where(valid, np.minimum(self.seen + 1, 100), 0)
        self.missing = np.where(valid, 0, np.minimum(self.missing + 1, 100))
        shown_ok = ~np.isnan(self.shown)

        with np.errstate(invalid='ignore'):
            tol = 0.1 + 0.05 * z
            jump = valid & shown_ok & (np.abs(z - self.shown) > tol)
            confirmed = jump & (np.abs(z - self.pending) <= tol)
        blend = valid & shown_ok & ~jump
        appear = valid & ~shown_ok & (self.seen >= self.APPEAR_FRAMES)

        new = self.shown.copy()
        new[blend] = alpha * self.shown[blend] + (1 - alpha) * z[blend]
        new[confirmed | appear] = z[confirmed | appear]
        new[~valid & (self.missing >= self.HOLD_FRAMES)] = np.nan
        self.pending = np.where(jump, z, np.nan).astype(np.float32)
        self.shown = new
        return new


class _Background:
    """Background subtraction against a learned depth map of the empty scene.

    The model is an 80x60 grid of metres (NaN = never seen). It's learned
    during an explicit capture (countdown so you can step out of view, then
    a couple of seconds of the farthest depth per cell) and saved to disk.
    Afterwards, a cell whose depth stays clearly *farther* than the model for
    REVEAL_FRAMES is taken as newly revealed background (e.g. a chair moved).
    """

    COLS = 80                   # 8x8 camera pixels per cell
    CELL = CAM_W // COLS
    REVEAL_FRAMES = 15
    COUNTDOWN_S = 5.0
    LEARN_S = 2.0

    def __init__(self, path=BACKGROUND_FILE):
        self.path = path
        self.bg = None
        self._farther = None
        self._countdown_until = 0.0
        self._learn_until = 0.0
        self._fresh = False             # next learning frame starts a new model
        self._dirty_since = None
        self._load()

    def _load(self):
        try:
            bg = np.load(self.path)
        except (OSError, ValueError):
            return
        if bg.shape == (CAM_H // self.CELL, self.COLS):
            bg = bg.astype(np.float32)
            bg[bg < MIN_DEPTH] = np.nan     # from before junk readings were rejected
            self.bg = bg

    def _save(self):
        tmp = self.path + '.tmp.npy'
        try:
            np.save(tmp, self.bg)
            os.replace(tmp, self.path)
        except OSError:
            pass
        self._dirty_since = None

    def capture(self, countdown=COUNTDOWN_S):
        now = time.monotonic()
        self._countdown_until = now + countdown
        self._learn_until = now + countdown + self.LEARN_S
        self._fresh = True

    def status_lines(self):
        """Text to show instead of the render while capturing, else None."""
        now = time.monotonic()
        if now < self._countdown_until:
            return ['STEP OUT', 'OF VIEW', str(math.ceil(self._countdown_until - now))]
        if now < self._learn_until:
            return ['LEARNING', 'BACKGROUND']
        return None

    def mask(self, raw):
        """Return a (480, 640) foreground mask for this frame, or None while capturing."""
        now = time.monotonic()
        if now < self._countdown_until:
            return None
        z = raw_to_metres(KinectMode._downsample(raw, self.COLS))
        if now < self._learn_until:
            if self._fresh or self.bg is None:
                self.bg = np.full(z.shape, np.nan, dtype=np.float32)
                self._fresh = False
            self.bg = np.fmax(self.bg, z)
            self._dirty_since = now
            self._farther = None
            return None
        if self._dirty_since is not None and self._learn_until and now >= self._learn_until:
            self._learn_until = 0.0
            self._save()

        if self.bg is None:
            return None

        valid = ~np.isnan(z)
        known = ~np.isnan(self.bg)
        with np.errstate(invalid='ignore'):
            margin = 0.15 + 0.05 * self.bg
            fg = valid & (~known | (z < self.bg - margin))
            farther = valid & known & (z > self.bg + margin)

        # Learn background that turns out to be further away than we thought.
        if self._farther is None or self._farther.shape != z.shape:
            self._farther = np.zeros(z.shape, dtype=np.int16)
        self._farther = np.where(farther, self._farther + 1, 0).astype(np.int16)
        reveal = self._farther >= self.REVEAL_FRAMES
        if reveal.any():
            self.bg[reveal] = z[reveal]
            self._farther[reveal] = 0
            self._dirty_since = self._dirty_since or now
        if self._dirty_since is not None and now - self._dirty_since > 60:
            self._save()

        fg = self._open(fg)
        return np.repeat(np.repeat(fg, self.CELL, axis=0), self.CELL, axis=1)

    @staticmethod
    def _open(m):
        """Morphological opening (4-neighbour erode then dilate): drops specks."""
        p = np.pad(m, 1)
        e = m & p[:-2, 1:-1] & p[2:, 1:-1] & p[1:-1, :-2] & p[1:-1, 2:]
        p = np.pad(e, 1)
        return e | p[:-2, 1:-1] | p[2:, 1:-1] | p[1:-1, :-2] | p[1:-1, 2:]


class KinectMode(BaseMode):
    def __init__(self, config):
        super().__init__(config)
        self._lock = threading.Lock()
        self._depth = None          # {name: (gh, gw) float32 metres, NaN = no data}
        self._status = 'starting'
        self._capture_stop = threading.Event()
        self._capture_thread = None
        self._cfg = {}
        self._last_cfg_load = 0.0
        self._pivot = 2.0
        self._background = _Background()
        set_led('off')      # stop the power-on blinking until the mode runs

    def capture_background(self):
        """Re-learn the empty scene after a step-out-of-view countdown."""
        self._background.capture()

    def start(self):
        super().start()
        self._last_cfg_load = 0.0
        set_led(self._get_cfg().get('led', 'green'))
        with self._lock:
            self._depth = None
            self._status = 'starting'
        self._capture_stop = threading.Event()
        self._capture_thread = threading.Thread(
            target=self._capture_loop, args=(self._capture_stop,),
            daemon=True, name='kinect-capture',
        )
        self._capture_thread.start()

    def stop(self):
        super().stop()
        self._capture_stop.set()
        set_led('off')

    def _get_cfg(self):
        now = time.time()
        if now - self._last_cfg_load >= 0.5 or not self._cfg:
            self._cfg = self.config.get_section('kinect')
            self._last_cfg_load = now
        return self._cfg

    def _set_status(self, status):
        with self._lock:
            self._status = status

    # ── Capture ──────────────────────────────────────────────────────────────

    def _capture_loop(self, stop):
        while not stop.is_set():
            device = self._get_cfg().get('device') or find_device()
            if not device:
                self._set_status('no kinect')
                stop.wait(2.0)
                continue
            try:
                fd = os.open(device, os.O_RDONLY | os.O_NONBLOCK)
            except OSError:
                self._set_status('no kinect')
                stop.wait(2.0)
                continue
            try:
                self._read_frames(fd, stop)
            except OSError:
                self._set_status('no kinect')
                stop.wait(1.0)
            finally:
                os.close(fd)

    def _read_frames(self, fd, stop):
        smooth = {}
        while not stop.is_set():
            ready, _, _ = select.select([fd], [], [], 1.0)
            if not ready:
                continue
            try:
                data = os.read(fd, 4 * 1024 * 1024)
            except BlockingIOError:
                continue
            if len(data) != FRAME_BYTES:
                # Driver is in RGB/IR mode (depth_mode=0) or format changed.
                self._set_status('not in depth mode')
                stop.wait(2.0)
                continue

            cfg = self._get_cfg()
            raw = unpack_y10b(data)
            if cfg.get('remove_background', True):
                if self._background.bg is None and not self._background.status_lines():
                    self._background.capture()      # first run: learn the room
                fg = self._background.mask(raw)
                if fg is None:
                    continue                        # capturing; render shows status
                raw = np.where(fg, raw, RAW_INVALID)
            gw = max(8, min(80, int(cfg.get('density', 32))))
            max_depth = float(cfg.get('max_depth', 4.0))
            alpha = max(0.0, min(0.95, float(cfg.get('smoothing', 0.5))))

            # Only build the grids the current style draws from: 'dots' uses
            # one at 2x density; meshes use a coarse grid plus a 4x finer one
            # for silhouettes.
            if cfg.get('style', 'dots') == 'dots':
                grids = {'dots': (min(160, gw * 2), 1.0)}
            else:
                grids = {'coarse': (gw, 0.3), 'fine': (min(160, gw * 4), 1.0)}
            depth = {}
            for name, (cols, core) in grids.items():
                z = raw_to_metres(self._downsample(raw, cols, core))
                z[(z > max_depth) | (z < MIN_DEPTH)] = np.nan
                if name not in smooth or smooth[name].shown.shape != z.shape:
                    smooth[name] = _Stabilizer(z.shape)
                depth[name] = smooth[name].update(z, alpha)

            with self._lock:
                self._depth = depth
                self._status = 'ok'

    @staticmethod
    def _downsample(raw, gw, core=1.0):
        """Block-reduce to a gw-wide grid using the median valid sample.

        A block with fewer than half its samples valid comes back invalid
        (RAW_INVALID). ``core`` < 1 only looks at that central fraction of
        each block, so a vertex isn't pulled onto something at the edge of
        its block (which would bloat silhouettes on coarse grids).
        """
        gh = max(6, round(gw * CAM_H / CAM_W))
        bh, bw = CAM_H // gh, CAM_W // gw
        blocks = raw[:gh * bh, :gw * bw].reshape(gh, bh, gw, bw)
        if core < 1.0:
            mh = max(0, int(bh * (1 - core) / 2))
            mw = max(0, int(bw * (1 - core) / 2))
            blocks = blocks[:, mh:bh - mh, :, mw:bw - mw]
        # Subsample to at most ~5x5 samples per block to keep the sort cheap.
        sh = -(-blocks.shape[1] // 5)
        sw = -(-blocks.shape[3] // 5)
        samples = blocks[:, ::sh, :, ::sw].transpose(0, 2, 1, 3).reshape(gh, gw, -1)

        valid = (samples >= RAW_MIN) & (samples < RAW_INVALID)
        n = valid.sum(axis=2)
        ordered = np.sort(np.where(valid, samples, RAW_INVALID), axis=2)
        med = np.take_along_axis(ordered, np.maximum(n - 1, 0)[:, :, None] // 2, axis=2)[:, :, 0]
        return np.where(n * 2 >= samples.shape[2], med, RAW_INVALID).astype(np.uint16)

    # ── Render ───────────────────────────────────────────────────────────────

    def render(self, canvas):
        cfg = self._get_cfg()
        with self._lock:
            depth = self._depth
            status = self._status

        lines = cfg.get('remove_background', True) and self._background.status_lines()
        if lines:
            canvas.SetImage(self._status_image(lines))
            return
        if depth is None:
            if status == 'starting':
                lines = ['reticulating', 'splines...']
            else:
                lines = ['KINECT', status.upper()]
            canvas.SetImage(self._status_image(lines))
            return

        # Right after a style change the capture thread may not have built
        # the new grids yet; draw from whatever grid is there.
        if cfg.get('style', 'dots') == 'dots':
            grid, fine = depth.get('dots', depth.get('fine')), None
        else:
            grid, fine = depth.get('coarse', depth.get('dots')), depth.get('fine')
        canvas.SetImage(Image.fromarray(self.render_frame(grid, cfg, fine=fine), 'RGB'))

    def render_frame(self, depth, cfg, t=None, fine=None):
        """Rasterise the depth grid; returns an (H, W, 3) uint8 array.

        ``fine`` is an optional higher-resolution grid used to outline
        silhouettes in the 'vr' and 'wire' styles.
        """
        if t is None:
            t = time.monotonic()
        style = cfg.get('style', 'dots')
        if style == 'dots':
            fg = self._render_dots(depth, cfg, t)
        elif style in ('vr', 'wire'):
            fg = self._render_vr(depth, cfg, t, faces=(style == 'vr'), fine=fine)
        else:
            fg = self._render_lines(depth, cfg, t, style)

        if cfg.get('backdrop', 'grid') != 'grid':
            return fg
        # Put the grid behind the subject: it shows through only where the
        # foreground is dark.
        # Dilate the coverage so the grid doesn't peek between dots.
        lum = Image.fromarray(fg.max(axis=2)).filter(ImageFilter.MaxFilter(5))
        cover = np.clip(np.asarray(lum, dtype=np.float32)[:, :, None] / 60.0, 0, 1)
        out = fg.astype(np.float32) + self._render_grid(cfg, t) * (1 - cover)
        return np.clip(out, 0, 255).astype(np.uint8)

    def _project(self, depth, cfg, t, update_pivot=True):
        """Back-project the grid, orbit it, and project to screen space."""
        gh, gw = depth.shape
        bh, bw = CAM_H // gh, CAM_W // gw   # matches _downsample's blocks
        max_depth = float(cfg.get('max_depth', 4.0))

        # Back-project grid cell centres to camera space.
        u = (np.arange(gw) + 0.5) * bw
        v = (np.arange(gh) + 0.5) * bh
        z = depth
        x = (u[None, :] - CX) * z / FX
        y = (v[:, None] - CY) * z / FY

        valid = ~np.isnan(z)
        if update_pivot and valid.any():
            target = float(np.median(z[valid]))
            self._pivot += (target - self._pivot) * 0.05

        xr, yr, zr, sx, sy = self._view(x, y, z, cfg, t)
        valid &= zr > 0.1

        if cfg.get('color_mode', 'scroll') == 'scroll':
            # Palette bands tied to height in the scene (metres, so they stay
            # put on a body), drifting downward and ping-ponging so there's
            # no seam where the palette wraps.
            period = max(0.1, float(cfg.get('color_period', 1.2)))
            phase = (y / period - float(cfg.get('color_speed', 0.3)) * t) % 1.0
            shade = np.nan_to_num(48 + 207 * (1 - np.abs(2 * phase - 1))).astype(np.float32)
        else:
            # Nearer → higher LUT index → brighter.
            near = np.clip((max_depth - z) / (max_depth - MIN_DEPTH), 0, 1)
            shade = np.nan_to_num(48 + 207 * near).astype(np.float32)

        # Neighbours further apart than this (relative depth) aren't joined.
        jump = float(cfg.get('edge_jump', 6.0)) * max(bw / FX, bh / FY)
        return xr, yr, zr, sx, sy, valid, shade, jump

    @staticmethod
    def _angles(cfg, t):
        """Current (yaw, pitch) in radians.

        A fixed view angle (yaw around a vertical axis through the scene's
        middle, pitch around the horizontal one), plus an optional sway and
        slower nod around that angle.
        """
        speed = float(cfg.get('sway_speed', 0.1))
        a = math.radians(float(cfg.get('yaw', 20))
                         + float(cfg.get('sway', 0)) * math.sin(2 * math.pi * speed * t))
        b = math.radians(float(cfg.get('pitch', -8))
                         + float(cfg.get('bob', 0)) * math.sin(2 * math.pi * speed * 0.63 * t))
        return a, b

    def _view(self, x, y, z, cfg, t):
        """Camera-space points → orbited points and screen coordinates."""
        a, b = self._angles(cfg, t)
        ca, sa = math.cos(a), math.sin(a)
        cb, sb = math.cos(b), math.sin(b)
        zc = z - self._pivot
        xr = x * ca + zc * sa
        zc = -x * sa + zc * ca
        yr = y * cb - zc * sb
        zr = y * sb + zc * cb + self._pivot

        zoom = float(cfg.get('zoom', 1.0))
        f = zoom * H / CAM_H * FY
        with np.errstate(invalid='ignore', divide='ignore'):
            sx = W / 2 + f * xr / zr
            sy = H / 2 + f * yr / zr
        return xr, yr, zr, sx, sy

    # ── Backdrop ─────────────────────────────────────────────────────────────

    GRID_COLOR = np.array([30, 255, 80], dtype=np.float32)
    GRID_STEP = 0.5     # metres between grid lines
    GRID_HALF_W = 6.0   # grid spans ±this many metres sideways
    GRID_WALL_H = 5.0

    def _grid_segments(self, floor, wall_z):
        """World-space line pieces for a floor grid and back-wall grid."""
        key = (floor, wall_z)
        if getattr(self, '_grid_key', None) == key:
            return self._grid_cache
        step, hw = self.GRID_STEP, self.GRID_HALF_W
        lines = []
        xs = np.arange(-hw, hw + 1e-6, step)
        for x in xs:                                            # floor, receding
            lines.append(((x, floor, 0.3), (x, floor, wall_z)))
        for z in np.arange(step, wall_z + 1e-6, step):          # floor, across
            lines.append(((-hw, floor, z), (hw, floor, z)))
        top = floor - self.GRID_WALL_H
        for x in xs:                                            # wall, vertical
            lines.append(((x, floor, wall_z), (x, top, wall_z)))
        for y in np.arange(floor, top - 1e-6, -step):           # wall, horizontal
            lines.append(((-hw, y, wall_z), (hw, y, wall_z)))

        # Cut into short pieces so lines that pass behind the camera after
        # the view rotation can be dropped piecewise.
        p0, p1 = [], []
        for a, b in lines:
            a, b = np.array(a), np.array(b)
            n = max(1, int(np.ceil(np.linalg.norm(b - a) / 0.25)))
            t = np.linspace(0, 1, n + 1)[:, None]
            pts = a + (b - a) * t
            p0.append(pts[:-1])
            p1.append(pts[1:])
        self._grid_key = key
        self._grid_cache = (np.concatenate(p0).astype(np.float32),
                            np.concatenate(p1).astype(np.float32))
        return self._grid_cache

    def _render_grid(self, cfg, t):
        """Glowing green floor + back-wall grid in the same 3D view; float RGB.

        Cached until the view moves noticeably, so a still camera costs
        nothing per frame.
        """
        a, b = self._angles(cfg, t)
        # The pivot jitters with the scene; draw the grid around a rounded
        # one so a still camera keeps hitting the cache.
        pivot = round(self._pivot * 10) / 10
        key = (round(math.degrees(a), 1), round(math.degrees(b), 1), pivot,
               cfg.get('grid_floor', 1.2), cfg.get('grid_distance', 8.0),
               cfg.get('grid_brightness', 0.6), cfg.get('glow', 0.6), cfg.get('zoom', 1.0))
        if getattr(self, '_grid_img_key', None) != key:
            live, self._pivot = self._pivot, pivot
            try:
                self._grid_img = self._draw_grid(cfg, t)
            finally:
                self._pivot = live
            self._grid_img_key = key
        return self._grid_img

    def _draw_grid(self, cfg, t):
        floor = float(cfg.get('grid_floor', 1.2))
        wall_z = float(cfg.get('grid_distance', 8.0))
        p0, p1 = self._grid_segments(floor, wall_z)
        _, _, z0, sx0, sy0 = self._view(p0[:, 0], p0[:, 1], p0[:, 2], cfg, t)
        _, _, z1, sx1, sy1 = self._view(p1[:, 0], p1[:, 1], p1[:, 2], cfg, t)
        ok = (z0 > 0.3) & (z1 > 0.3)
        if not ok.any():
            return np.zeros((H, W, 3), dtype=np.float32)
        z0, z1 = z0[ok], z1[ok]
        s0 = np.stack([sx0[ok], sy0[ok]], axis=1)
        s1 = np.stack([sx1[ok], sy1[ok]], axis=1)
        # Fog: lines fade with distance.
        fog0 = np.clip(1.15 - z0 / (wall_z + 1.0), 0.12, 1.0) * 255
        fog1 = np.clip(1.15 - z1 / (wall_z + 1.0), 0.12, 1.0) * 255
        inten, lvl = self._draw_aa_lines(s0, s1, z0, z1, fog0, fog1,
                                         np.full(H * W, np.inf, dtype=np.float32))
        brightness = np.where(inten > 1e-3, lvl / np.maximum(inten, 1e-3), 0) / 255
        level = float(cfg.get('grid_brightness', 0.6))
        img = self.GRID_COLOR * (np.minimum(inten, 1.2) * brightness * level)[:, :, None]
        return self._with_glow(img, cfg)

    @staticmethod
    def _joinable(z, valid, a_idx, b_idx, jump):
        za, zb = z[a_idx], z[b_idx]
        with np.errstate(invalid='ignore'):
            return (valid[a_idx] & valid[b_idx]
                    & (np.abs(za - zb) < jump * np.fmax(za, zb)))

    def _render_lines(self, depth, cfg, t, style):
        """Plain grid wireframe ('mesh', 'rows', 'cols')."""
        lut = PALETTES.get(cfg.get('palette', 'cyan'), PALETTES['cyan'])
        _, _, _, sx, sy, valid, shade, jump = self._project(depth, cfg, t)
        z = depth

        edges = []
        if style in ('mesh', 'rows'):
            edges.append((np.s_[:, :-1], np.s_[:, 1:]))
        if style in ('mesh', 'cols'):
            edges.append((np.s_[:-1, :], np.s_[1:, :]))

        img = np.zeros(H * W, dtype=np.uint8)
        for a_idx, b_idx in edges:
            ok = self._joinable(z, valid, a_idx, b_idx, jump)
            if not ok.any():
                continue
            self._draw_lines(
                img,
                sx[a_idx][ok], sy[a_idx][ok], shade[a_idx][ok],
                sx[b_idx][ok], sy[b_idx][ok], shade[b_idx][ok],
            )

        return lut[img].reshape(H, W, 3)

    def _render_vr(self, depth, cfg, t, faces, fine=None):
        """Flat-shaded triangle mesh with hidden-line removal and glowing edges."""
        lut = PALETTES.get(cfg.get('palette', 'synth'), PALETTES['synth']).astype(np.float32)
        xr, yr, zr, sx, sy, valid, shade, jump = self._project(depth, cfg, t)
        gh, gw = depth.shape
        z = depth

        # Each grid cell splits into two triangles along its a–d diagonal:
        #   a b
        #   c d
        a_, b_ = np.s_[:-1, :-1], np.s_[:-1, 1:]
        c_, d_ = np.s_[1:, :-1], np.s_[1:, 1:]
        idx = np.arange(gh * gw).reshape(gh, gw)
        ab = self._joinable(z, valid, a_, b_, jump)
        ac = self._joinable(z, valid, a_, c_, jump)
        bd = self._joinable(z, valid, b_, d_, jump)
        cd = self._joinable(z, valid, c_, d_, jump)
        ad = self._joinable(z, valid, a_, d_, jump * 1.5)
        tri_ok = np.concatenate([(ab & bd & ad).ravel(), (ac & cd & ad).ravel()])
        tris = np.stack([
            np.concatenate([idx[a_].ravel(), idx[a_].ravel()]),
            np.concatenate([idx[b_].ravel(), idx[c_].ravel()]),
            np.concatenate([idx[d_].ravel(), idx[d_].ravel()]),
        ], axis=1)[tri_ok]

        P = np.stack([xr.ravel(), yr.ravel(), zr.ravel()], axis=1)
        S = np.stack([sx.ravel(), sy.ravel()], axis=1)
        Z = zr.ravel()
        shade = shade.ravel()

        # z-buffer holding (depth_mm << 20 | triangle id) per pixel.
        zkey = np.full(H * W, np.iinfo(np.int64).max, dtype=np.int64)
        if len(tris):
            self._raster_tris(zkey, S[tris], Z[tris].mean(axis=1))
        hit = zkey != np.iinfo(np.int64).max
        zbuf = np.full(H * W, np.inf, dtype=np.float32)
        zbuf[hit] = (zkey[hit] >> 20) / 1000.0

        out = np.zeros((H * W, 3), dtype=np.float32)
        if faces and len(tris):
            # Flat Lambert shading from a light above-left of the viewer.
            n = np.cross(P[tris[:, 1]] - P[tris[:, 0]], P[tris[:, 2]] - P[tris[:, 0]])
            n /= np.linalg.norm(n, axis=1, keepdims=True) + 1e-9
            light = np.array([-0.45, -0.6, -0.66], dtype=np.float32)
            diffuse = np.abs(n @ light)
            level = shade[tris].mean(axis=1).astype(np.int32)
            face_rgb = lut[level] * (0.06 + 0.4 * diffuse ** 1.5)[:, None]
            out[hit] = face_rgb[zkey[hit] & 0xFFFFF]

        # Edges: every triangle edge, drawn antialiased, hidden behind
        # nearer faces.
        e = np.concatenate([tris[:, [0, 1]], tris[:, [1, 2]], tris[:, [0, 2]]])
        e = np.unique(e.min(axis=1) * (gh * gw) + e.max(axis=1))
        e = np.stack([e // (gh * gw), e % (gh * gw)], axis=1)
        edges = np.zeros((H, W, 3), dtype=np.float32)
        if len(e):
            inten, lvl = self._draw_aa_lines(S[e[:, 0]], S[e[:, 1]], Z[e[:, 0]], Z[e[:, 1]],
                                             shade[e[:, 0]], shade[e[:, 1]], zbuf)
            drawn = inten > 1e-3
            level = np.zeros((H, W), dtype=np.int32)
            level[drawn] = np.clip(lvl[drawn] / inten[drawn], 0, 255)
            edges = lut[level] * (0.8 * inten)[:, :, None]

        outline = float(cfg.get('outline', 1.0))
        if fine is not None and outline > 0:
            edges += self._silhouette(fine, cfg, t, jump, zbuf, lut) * outline

        out = out.reshape(H, W, 3) + self._with_glow(edges, cfg)
        return np.clip(out, 0, 255).astype(np.uint8)

    def _render_dots(self, depth, cfg, t):
        """Point cloud: one antialiased dot per depth sample."""
        lut = PALETTES.get(cfg.get('palette', 'synth'), PALETTES['synth']).astype(np.float32)
        _, _, zr, sx, sy, valid, shade, _ = self._project(depth, cfg, t)
        # Fade dots out over the last half metre before max_depth so things
        # hovering at the cutoff dim rather than pop.
        max_depth = float(cfg.get('max_depth', 4.0))
        fade = np.clip((max_depth - depth[valid]) / 0.5, 0, 1).astype(np.float32)
        if cfg.get('color_mode', 'scroll') == 'scroll':
            # Colour no longer encodes depth, so keep a gentle brightness cue.
            near = np.clip((max_depth - depth[valid]) / (max_depth - MIN_DEPTH), 0, 1)
            fade *= (0.55 + 0.45 * near).astype(np.float32)
        sx, sy, zr, shade = sx[valid], sy[valid], zr[valid], shade[valid]
        if not len(sx):
            return np.zeros((H, W, 3), dtype=np.uint8)

        # Perspective dot size: each dot is four sub-dots spread further
        # apart the nearer it is (they coincide for distant dots).
        size = np.clip(float(cfg.get('dot_size', 0.6)) * self._pivot / zr, 0.6, 3.0)
        r = (0.3 * (size - 0.6)).astype(np.float32)
        fx = np.concatenate([sx - r, sx + r, sx - r, sx + r]).astype(np.float32)
        fy = np.concatenate([sy - r, sy - r, sy + r, sy + r]).astype(np.float32)
        level = np.tile(shade, 4).astype(np.int32)
        fade = np.tile(fade, 4)

        ix, iy = np.floor(fx).astype(np.int32), np.floor(fy).astype(np.int32)
        keep = (ix >= -1) & (ix < W) & (iy >= -1) & (iy < H)
        fx, fy, ix, iy, level, fade = fx[keep], fy[keep], ix[keep], iy[keep], level[keep], fade[keep]
        ax, ay = fx - ix, fy - iy

        # Bilinear splat into a buffer padded by one pixel on every side.
        PW = W + 2
        base = (iy + 1) * PW + (ix + 1)
        pix = np.concatenate([base, base + 1, base + PW, base + PW + 1])
        w = np.concatenate([(1 - ax) * (1 - ay), ax * (1 - ay), (1 - ax) * ay, ax * ay])
        w *= np.tile(fade, 4)
        size_ = (H + 2) * PW
        inten = np.bincount(pix, weights=w, minlength=size_)
        # Where dots overlap, the nearest one sets the colour.
        lvl = np.zeros(size_, dtype=np.int32)
        np.maximum.at(lvl, pix[w > 0.05], np.tile(level, 4)[w > 0.05])
        inten = inten.reshape(H + 2, PW)[1:-1, 1:-1]
        lvl = lvl.reshape(H + 2, PW)[1:-1, 1:-1]

        dots = lut[lvl] * np.minimum(inten, 1.0)[:, :, None]
        return np.clip(self._with_glow(dots, cfg), 0, 255).astype(np.uint8)

    @staticmethod
    def _with_glow(img, cfg):
        """Add a soft bloom of ``img`` (float RGB) onto itself."""
        glow = float(cfg.get('glow', 0.6))
        if glow <= 0:
            return img
        blurred = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), 'RGB')
        blurred = np.asarray(blurred.filter(ImageFilter.GaussianBlur(1.6)), dtype=np.float32)
        return img + glow * 1.6 * blurred

    def _silhouette(self, fine, cfg, t, jump, zbuf, lut):
        """Bright contour along depth discontinuities, from the fine grid."""
        _, _, zr, sx, sy, valid, shade, _ = self._project(fine, cfg, t, update_pivot=False)

        # A cell is on the silhouette if any 4-neighbour is missing or
        # clearly further away. Edge padding keeps the frame border quiet.
        zf = np.where(valid, fine, np.inf)
        pad = np.pad(zf, 1, mode='edge')
        with np.errstate(invalid='ignore'):
            boundary = np.zeros_like(valid)
            for nb in (pad[:-2, 1:-1], pad[2:, 1:-1], pad[1:-1, :-2], pad[1:-1, 2:]):
                boundary |= nb - zf > jump * zf
        boundary &= valid

        # Chain neighbouring boundary cells (8-connected) into line segments.
        gh, gw = fine.shape
        idx = np.arange(gh * gw).reshape(gh, gw)
        pairs = []
        for a_idx, b_idx in ((np.s_[:, :-1], np.s_[:, 1:]),
                             (np.s_[:-1, :], np.s_[1:, :]),
                             (np.s_[:-1, :-1], np.s_[1:, 1:]),
                             (np.s_[:-1, 1:], np.s_[1:, :-1])):
            ok = (boundary[a_idx] & boundary[b_idx]
                  & self._joinable(fine, valid, a_idx, b_idx, jump))
            pairs.append(np.stack([idx[a_idx][ok], idx[b_idx][ok]], axis=1))
        e = np.concatenate(pairs)
        if not len(e):
            return np.zeros((H, W, 3), dtype=np.float32)

        S = np.stack([sx.ravel(), sy.ravel()], axis=1)
        Z, shade = zr.ravel(), shade.ravel()
        inten, lvl = self._draw_aa_lines(S[e[:, 0]], S[e[:, 1]], Z[e[:, 0]], Z[e[:, 1]],
                                         shade[e[:, 0]], shade[e[:, 1]], zbuf)
        drawn = inten > 1e-3
        level = np.zeros((H, W), dtype=np.int32)
        # Lift the outline up the palette so it reads brighter than the mesh.
        level[drawn] = np.clip(lvl[drawn] / inten[drawn] + 40, 0, 255)
        return lut[level] * np.minimum(inten, 1.5)[:, :, None]

    @staticmethod
    def _raster_tris(zkey, s, tz):
        """Scanline-fill triangles into zkey, keeping the nearest per pixel.

        s: (T, 3, 2) screen vertices; tz: (T,) depth in metres.
        Pixel centres sit on integer coordinates.
        """
        key = ((np.clip(tz * 1000, 0, 2 ** 30).astype(np.int64) << 20)
               | np.arange(len(s), dtype=np.int64))

        # One entry per (triangle, covered row).
        ys = s[:, :, 1]
        y_lo = np.clip(np.ceil(ys.min(axis=1)), 0, H).astype(np.int64)
        y_hi = np.clip(np.floor(ys.max(axis=1)), -1, H - 1).astype(np.int64)
        rows = np.maximum(y_hi - y_lo + 1, 0)
        tri = np.repeat(np.arange(len(s)), rows)
        y = y_lo[tri] + np.arange(rows.sum()) - np.repeat(np.cumsum(rows) - rows, rows)
        yf = y.astype(np.float32)

        # Span of each row = extent of its intersections with the 3 edges.
        xl = np.full(len(y), np.inf, dtype=np.float32)
        xr = np.full(len(y), -np.inf, dtype=np.float32)
        for i, j in ((0, 1), (1, 2), (2, 0)):
            xa, ya = s[tri, i, 0], s[tri, i, 1]
            xb, yb = s[tri, j, 0], s[tri, j, 1]
            hit = (yf >= np.minimum(ya, yb)) & (yf <= np.maximum(ya, yb)) & (ya != yb)
            with np.errstate(invalid='ignore', divide='ignore'):
                x = xa + (xb - xa) * (yf - ya) / (yb - ya)
            xl = np.where(hit, np.minimum(xl, x), xl)
            xr = np.where(hit, np.maximum(xr, x), xr)

        ok = xr >= xl
        x0 = np.clip(np.ceil(np.where(ok, xl, 0)), 0, W).astype(np.int64)
        x1 = np.clip(np.floor(np.where(ok, xr, -1)), -1, W - 1).astype(np.int64)
        span = np.maximum(x1 - x0 + 1, 0)
        row = np.repeat(np.arange(len(y)), span)
        x = x0[row] + np.arange(span.sum()) - np.repeat(np.cumsum(span) - span, span)
        np.minimum.at(zkey, y[row] * W + x, key[tri[row]])

    @staticmethod
    def _draw_aa_lines(p0, p1, z0, z1, s0, s1, zbuf):
        """Antialiased lines (bilinear splats) with a z-test.

        Returns per-pixel (intensity, intensity-weighted shade) buffers, each
        (H, W); the caller turns them into colour.
        """
        p0, p1 = p0.astype(np.float32), p1.astype(np.float32)
        length = np.hypot(*(p1 - p0).T)
        n = np.clip(np.ceil(length / 0.75), 1, 80).astype(np.int64) + 1
        seg = np.repeat(np.arange(len(n)), n)
        t = ((np.arange(n.sum()) - np.repeat(np.cumsum(n) - n, n)) / (n[seg] - 1)).astype(np.float32)

        fx = p0[seg, 0] + (p1[seg, 0] - p0[seg, 0]) * t
        fy = p0[seg, 1] + (p1[seg, 1] - p0[seg, 1]) * t
        ix, iy = np.floor(fx).astype(np.int32), np.floor(fy).astype(np.int32)

        # Cull per sample: on screen (allowing a 1px border for the taps) and
        # not clearly behind a face at its nearest pixel.
        keep = (ix >= -1) & (ix < W) & (iy >= -1) & (iy < H)
        seg, t, fx, fy, ix, iy = seg[keep], t[keep], fx[keep], fy[keep], ix[keep], iy[keep]
        near = np.clip(np.rint(fy), 0, H - 1).astype(np.int32) * W + np.clip(np.rint(fx), 0, W - 1).astype(np.int32)
        fz = z0[seg] + (z1[seg] - z0[seg]) * t
        keep = fz <= zbuf[near] * 1.03 + 0.03
        seg, t, fx, fy, ix, iy = seg[keep], t[keep], fx[keep], fy[keep], ix[keep], iy[keep]

        level = s0[seg] + (s1[seg] - s0[seg]) * t
        # Scale each splat by sample spacing so brightness is length-independent.
        weight = (length / (n - 1)).astype(np.float32)[seg]
        ax, ay = fx - ix, fy - iy

        # Splat into a buffer padded by one pixel on every side.
        PW = W + 2
        base = (iy + 1) * PW + (ix + 1)
        pix = np.concatenate([base, base + 1, base + PW, base + PW + 1])
        w = np.concatenate([(1 - ax) * (1 - ay), ax * (1 - ay), (1 - ax) * ay, ax * ay])
        w *= np.tile(weight, 4)
        size = (H + 2) * PW
        inten = np.bincount(pix, weights=w, minlength=size)
        lvl = np.bincount(pix, weights=w * np.tile(level, 4), minlength=size)
        inten = inten.reshape(H + 2, PW)[1:-1, 1:-1]
        lvl = lvl.reshape(H + 2, PW)[1:-1, 1:-1]
        return inten, lvl

    @staticmethod
    def _draw_lines(img, x0, y0, s0, x1, y1, s1):
        """Vectorised line rasteriser; overlapping pixels keep the nearest shade."""
        length = np.maximum(np.abs(x1 - x0), np.abs(y1 - y0))
        steps = int(min(32, max(1, math.ceil(length.max())))) + 1
        t = np.linspace(0.0, 1.0, steps, dtype=np.float32)[None, :]
        px = np.rint(x0[:, None] + (x1 - x0)[:, None] * t).astype(np.int32)
        py = np.rint(y0[:, None] + (y1 - y0)[:, None] * t).astype(np.int32)
        ps = (s0[:, None] + (s1 - s0)[:, None] * t).astype(np.uint8)
        inside = (px >= 0) & (px < W) & (py >= 0) & (py < H)
        np.maximum.at(img, py[inside] * W + px[inside], ps[inside])

    @staticmethod
    def _status_image(lines):
        img = Image.new('RGB', (W, H), (0, 0, 0))
        draw = ImageDraw.Draw(img)
        y = H // 2 - 7 * len(lines)
        for line in lines:
            try:
                tw = draw.textlength(line, font=_FONT)
            except AttributeError:
                tw = len(line) * 6
            draw.text(((W - tw) / 2, y), line, font=_FONT, fill=(0, 120, 200))
            y += 14
        return img
