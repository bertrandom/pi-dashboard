import json
import os
import tempfile
import unittest
from unittest.mock import patch

import config as config_module


class ConfigTests(unittest.TestCase):
    def test_unchanged_values_do_not_rewrite_config(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, 'config.json')
            with patch.object(config_module, 'CONFIG_FILE', path):
                cfg = config_module.Config()
                self.assertTrue(cfg.set('brightness', 60))
                first_mtime = os.stat(path).st_mtime_ns
                self.assertFalse(cfg.set('brightness', 60))
                self.assertEqual(first_mtime, os.stat(path).st_mtime_ns)

    def test_save_replaces_file_with_valid_json(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, 'config.json')
            with patch.object(config_module, 'CONFIG_FILE', path):
                cfg = config_module.Config()
                cfg.set_section('clock', {'show_seconds': False})
                with open(path, 'r') as saved:
                    data = json.load(saved)
                self.assertFalse(data['clock']['show_seconds'])
                self.assertFalse(os.path.exists(f'{path}.tmp'))


if __name__ == '__main__':
    unittest.main()
