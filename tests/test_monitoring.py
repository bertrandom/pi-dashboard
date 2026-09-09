import unittest
from unittest.mock import patch

from modes.monitoring import MonitoringMode, ROW_H


class _MonitoringConfig:
    def __init__(self, endpoints, speed=20):
        self._section = {
            'endpoints': endpoints,
            'scroll_speed': speed,
        }

    def get_section(self, _section):
        return self._section


class _Canvas:
    def SetPixel(self, *_args):
        pass


class MonitoringRenderTests(unittest.TestCase):
    def test_every_scroll_offset_renders_partial_rows(self):
        endpoints = [
            {'id': str(i), 'name': f'endpoint-{i}', 'url': f'host-{i}'}
            for i in range(4)
        ]
        mode = MonitoringMode(_MonitoringConfig(endpoints))
        mode._cached_endpoints = endpoints
        mode._cached_speed = 20
        mode._last_cfg_mono = 100
        canvas = _Canvas()

        with patch('modes.monitoring.time.monotonic', return_value=100):
            for offset in range(len(endpoints) * ROW_H):
                with self.subTest(offset=offset):
                    mode._scroll_y = float(offset)
                    mode._last_mono = 100
                    mode.render(canvas)


if __name__ == '__main__':
    unittest.main()
