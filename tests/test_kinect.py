import os
import tempfile
import unittest
from unittest.mock import patch

import numpy as np

from modes.kinect import (
    CAM_H, CAM_W, FRAME_BYTES, H, RAW_INVALID, W, KinectMode, _Background, _Stabilizer,
    raw_to_metres, unpack_y10b,
)


def pack_y10b(pixels):
    """Reference packer: big-endian 10-bit bitstream."""
    bits = ''.join(format(int(p), '010b') for p in pixels.ravel())
    return bytes(int(bits[i:i + 8], 2) for i in range(0, len(bits), 8))


class _Config:
    def __init__(self, section=None):
        self.section = section or {}

    def get_section(self, _name):
        return self.section


def synthetic_depth(gw=40):
    """Back wall at 3.5 m with a 'person' block at 1.5 m and a floor."""
    gh = round(gw * CAM_H / CAM_W)
    z = np.full((gh, gw), 3.5, dtype=np.float32)
    rows = np.arange(gh)[:, None]
    floor = rows > gh * 0.65
    z = np.where(floor, 3.5 - (rows - gh * 0.65) / (gh * 0.35) * 2.5, z)
    z[gh // 5:gh * 4 // 5, gw * 2 // 5:gw * 3 // 5] = 1.5
    z[:2, :3] = np.nan
    return z.astype(np.float32)


class KinectTests(unittest.TestCase):
    def test_unpack_roundtrip(self):
        rng = np.random.default_rng(0)
        pixels = rng.integers(0, 1024, size=CAM_W * 4, dtype=np.uint16)
        packed = pack_y10b(pixels) + bytes(FRAME_BYTES - CAM_W * 4 * 10 // 8)
        out = unpack_y10b(packed)
        self.assertEqual(out.shape, (CAM_H, CAM_W))
        np.testing.assert_array_equal(out.ravel()[:pixels.size], pixels)

    def test_raw_to_metres_marks_invalid(self):
        z = raw_to_metres(np.array([0, 20, 600, 900, 1023], dtype=np.uint16))
        self.assertTrue(np.isnan(z[0]) and np.isnan(z[1]) and np.isnan(z[4]))
        self.assertLess(z[2], z[3])

    def test_downsample_takes_median_and_ignores_outliers(self):
        raw = np.full((CAM_H, CAM_W), 900, dtype=np.uint16)
        raw[0, 0] = 500                 # a lone spike doesn't move the cell
        raw[16:32, 16:32] = RAW_INVALID  # mostly-invalid cell drops out
        raw[16, 16] = 700
        raw[32:48, 32:48] = 15           # sensor junk counts as invalid
        grid = KinectMode._downsample(raw, 40)
        self.assertEqual(grid.shape, (30, 40))
        self.assertEqual(grid[0, 0], 900)
        self.assertEqual(grid[1, 1], RAW_INVALID)
        self.assertEqual(grid[2, 2], RAW_INVALID)

    def test_stabilizer_ignores_single_frame_noise(self):
        stab = _Stabilizer((1, 3))
        nan = np.nan
        frames = [
            [2.0, 2.0, nan],
            [2.0, 2.0, 3.0],    # cell 2 seen once: not shown yet
            [3.5, nan, 3.0],    # cell 0 spikes, cell 1 drops one frame
            [2.0, 2.0, 3.0],
        ]
        for f in frames:
            out = stab.update(np.array([f], dtype=np.float32), alpha=0.0)
        np.testing.assert_allclose(out, [[2.0, 2.0, 3.0]])

        stab.update(np.array([[3.5, nan, 3.0]], dtype=np.float32), alpha=0.0)
        out = stab.update(np.array([[3.5, nan, 3.0]], dtype=np.float32), alpha=0.0)
        self.assertAlmostEqual(out[0, 0], 3.5)   # a confirmed move is taken
        out = stab.update(np.array([[3.5, nan, 3.0]], dtype=np.float32), alpha=0.0)
        self.assertTrue(np.isnan(out[0, 1]))     # gone after 3 missing frames

    def test_render_frame_draws_something_for_each_style(self):
        mode = KinectMode(_Config())
        for style in ('dots', 'vr', 'wire', 'mesh', 'rows', 'cols'):
            with self.subTest(style=style):
                frame = mode.render_frame(synthetic_depth(), {'style': style}, t=1.0)
                self.assertEqual(frame.shape, (H, W, 3))
                self.assertGreater((frame.sum(axis=2) > 0).sum(), 500)

    def test_scroll_colours_move_down_over_time(self):
        mode = KinectMode(_Config())
        depth = np.full((48, 64), 2.0, dtype=np.float32)
        cfg = {'style': 'dots', 'color_mode': 'scroll', 'glow': 0, 'sway': 0, 'bob': 0,
               'yaw': 0, 'pitch': 0}
        a = mode.render_frame(depth, cfg, t=0.0).astype(int)
        b = mode.render_frame(depth, cfg, t=0.5).astype(int)
        self.assertGreater(np.abs(a - b).sum(), 0)
        # A flat wall at one depth still gets several colours top to bottom.
        rows = a.sum(axis=1)
        self.assertGreater(len({tuple(r) for r in rows[rows.sum(axis=1) > 0]}), 5)

    def test_trails_follow_movement_but_not_a_still_subject(self):
        depth = np.full((48, 64), np.nan, dtype=np.float32)
        depth[10:40, 40:50] = 2.0
        cfg = {'backdrop': 'none', 'glow': 0, 'sway': 0, 'bob': 0, 'yaw': 0, 'pitch': 0}

        def lit_after(moving, trails):
            mode = KinectMode(_Config())
            mode._pivot = 2.0
            for i in range(20):
                shift = -i if moving else 0
                frame = mode.render_frame(np.roll(depth, shift, axis=1),
                                          dict(cfg, trails=trails), t=10 + i / 30)
            return (frame.sum(axis=2) > 0).sum()

        self.assertGreater(lit_after(True, 0.6), 1.5 * lit_after(True, 0))
        self.assertLess(lit_after(False, 0.6), 1.1 * lit_after(False, 0))

    def test_render_frame_handles_empty_depth(self):
        mode = KinectMode(_Config())
        depth = np.full((30, 40), np.nan, dtype=np.float32)
        frame = mode.render_frame(depth, {'backdrop': 'none'}, t=0.0)
        self.assertEqual(frame.sum(), 0)

    def test_grid_backdrop_is_green_and_hidden_behind_subject(self):
        mode = KinectMode(_Config())
        empty = np.full((48, 64), np.nan, dtype=np.float32)
        grid = mode.render_frame(empty, {}, t=0.0).astype(int)
        self.assertGreater((grid[:, :, 1] > 40).sum(), 300)
        self.assertTrue((grid[:, :, 1] >= grid[:, :, 0]).all())

        person = empty.copy()
        person[10:40, 25:40] = 2.0
        cfg = {'color_mode': 'depth', 'glow': 0}
        frame = mode.render_frame(person, cfg, t=0.0).astype(int)
        body = frame[50:90, 55:75]
        # Inside the body: subject colours, no pure-green grid pixels.
        self.assertFalse(((body[:, :, 1] > 60) & (body[:, :, 0] < 10) & (body[:, :, 2] < 120)).any())


class BackgroundTests(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.TemporaryDirectory()
        self.path = os.path.join(self.dir.name, 'bg.npy')
        self.room = np.full((CAM_H, CAM_W), 950, dtype=np.uint16)   # ~3.5 m wall
        self.room[360:, :] = 850                                     # nearer floor
        self.person = self.room.copy()
        self.person[100:400, 250:350] = 600                          # ~0.7 m in front

    def tearDown(self):
        self.dir.cleanup()

    def _learn(self, bg, frame):
        with patch('modes.kinect.time.monotonic', return_value=100.0):
            bg.capture(countdown=0)
        with patch('modes.kinect.time.monotonic', return_value=100.5):
            self.assertIsNone(bg.mask(frame))
        with patch('modes.kinect.time.monotonic', return_value=103.0):
            return bg.mask(frame)

    def test_only_foreground_survives_and_model_persists(self):
        bg = _Background(self.path)
        self.assertFalse(self._learn(bg, self.room).any())
        self.assertTrue(os.path.exists(self.path))

        with patch('modes.kinect.time.monotonic', return_value=104.0):
            fg = _Background(self.path).mask(self.person)
        self.assertTrue(fg[150:350, 270:330].all())
        self.assertFalse(fg[:, :200].any())
        self.assertFalse(fg[370:, 400:].any())

    def test_revealed_background_is_learned(self):
        bg = _Background(self.path)
        self._learn(bg, self.person)          # captured with someone in view
        for i in range(_Background.REVEAL_FRAMES + 1):
            with patch('modes.kinect.time.monotonic', return_value=104.0 + i):
                fg = bg.mask(self.room)
        with patch('modes.kinect.time.monotonic', return_value=200.0):
            fg = bg.mask(self.person)
        self.assertTrue(fg[150:350, 270:330].all())


if __name__ == '__main__':
    unittest.main()
