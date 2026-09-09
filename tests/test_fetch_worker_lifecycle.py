import unittest

from modes.github import GitHubMode
from modes.weather import WeatherMode


class _EmptyConfig:
    def get_section(self, _section):
        return {}


class FetchWorkerLifecycleTests(unittest.TestCase):
    def _assert_restart_uses_new_stop_event(self, mode):
        mode.start()
        first_event = mode._fetch_stop
        mode.stop()
        self.assertTrue(first_event.is_set())

        mode.start()
        try:
            self.assertIsNot(first_event, mode._fetch_stop)
            self.assertTrue(first_event.is_set())
            self.assertFalse(mode._fetch_stop.is_set())
        finally:
            mode.stop()

    def test_github_worker_cannot_be_revived(self):
        self._assert_restart_uses_new_stop_event(GitHubMode(_EmptyConfig()))

    def test_weather_worker_cannot_be_revived(self):
        self._assert_restart_uses_new_stop_event(WeatherMode(_EmptyConfig()))


if __name__ == '__main__':
    unittest.main()
