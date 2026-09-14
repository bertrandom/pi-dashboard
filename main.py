#!/usr/bin/env python3
"""
LED Matrix Controller — main entry point.
Must run as root: sudo python3 main.py
"""

import logging
import os
import pprint
import signal
import sys
import threading
import time

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s %(name)s %(levelname)s %(message)s',
)
logger = logging.getLogger('main')

try:
    from rgbmatrix import RGBMatrix, RGBMatrixOptions
    MATRIX_AVAILABLE = True
except ImportError:
    MATRIX_AVAILABLE = False
    logger.warning("rgbmatrix not found — running in simulation mode (no display output)")

try:
    import RPi.GPIO as GPIO
    GPIO_AVAILABLE = True
except ImportError:
    GPIO_AVAILABLE = False
    logger.warning("RPi.GPIO not found — GPIO shutdown disabled")

try:
    from evdev import InputDevice, categorize, ecodes
    EVDEV_AVAILABLE = True
except ImportError:
    EVDEV_AVAILABLE = False
    logger.warning("evdev not found — keyboard input disabled")

from config import Config
from modes.clock import ClockMode
from modes.draw import DrawMode
from modes.gameoflife import GameOfLifeMode
from modes.github import GitHubMode
from modes.image import ImageMode
from modes.library import LibraryMode
from modes.monitoring import MonitoringMode
from modes.onair import OnAirMode
from modes.patternflow import PatternflowMode
from modes.pomodoro import PomodoroMode
from modes.reminder import ReminderMode
from modes.spotify import SpotifyMode
from modes.text import TextMode
from modes.weather import WeatherMode
from modes.wheel import WheelMode
from modes.workout import WorkoutMode

# ── Simulation canvas (dev/non-Pi use) ──────────────────────────────────────

class SimCanvas:
    def SetPixel(self, x, y, r, g, b): pass
    def SetImage(self, image, offset_x=0, offset_y=0, unsafe=True): pass
    def Clear(self): pass


# ── Controller ───────────────────────────────────────────────────────────────

class MatrixController:
    MODES = {
        'clock': ClockMode,
        'spotify': SpotifyMode,
        'gameoflife': GameOfLifeMode,
        'text': TextMode,
        'patternflow': PatternflowMode,
        'draw': DrawMode,
        'pomodoro': PomodoroMode,
        'reminder': ReminderMode,
        'image': ImageMode,
        'library': LibraryMode,
        'weather': WeatherMode,
        'workout': WorkoutMode,
        'onair': OnAirMode,
        'github': GitHubMode,
        'wheel': WheelMode,
        'monitoring': MonitoringMode,
    }

    def __init__(self):
        self.config = Config()
        self.matrix = self._init_matrix()
        self.current_mode = None
        self.current_mode_name = None
        self.modes = {name: cls(self.config) for name, cls in self.MODES.items()}
        self.running = False

        self._mode_lock = threading.Lock()

        self._carousel_thread = None
        self._carousel_stop = threading.Event()
        self._carousel_index = 0
        self._carousel_manual_until = 0.0

        self._keyboard_thread = None
        self._keyboard_stop = threading.Event()

        self._reminder_last_fired = {}
        self._screen_on = True
        self._last_applied_brightness = None
        self._clear_next_frame = False
        self._dnd = False
        self._dnd_return_mode = None

        self._setup_gpio()
        self._setup_keyboard()
        self._apply_auto_brightness()
        self.set_mode(self.config.get('mode', 'clock'))
        self._start_carousel()

    def _init_matrix(self):
        if not MATRIX_AVAILABLE:
            return None

        opts = RGBMatrixOptions()

        opts.rows = 64
        opts.cols = 64
        opts.chain_length = 2
        opts.parallel = 2
        opts.row_address_type = 0
        opts.multiplexing = 0
        opts.pwm_bits = 11
        opts.brightness = 100
        opts.pwm_lsb_nanoseconds = 130
        opts.led_rgb_sequence = 'RGB'
        opts.pixel_mapper_config = ''
        opts.panel_type = ''
        opts.pwm_dither_bits = 0
        opts.limit_refresh_rate_hz = 0

        opts.gpio_slowdown = 3

        opts.drop_privileges = False

        logger.info(
            "Matrix options: gpio_slowdown=%s pwm_bits=%s limit_refresh_rate_hz=%s "
            "disable_hardware_pulsing=%s",
            opts.gpio_slowdown,
            opts.pwm_bits,
            opts.limit_refresh_rate_hz,
            opts.disable_hardware_pulsing,
        )

        return RGBMatrix(options=opts)

    def _setup_gpio(self):
        if not GPIO_AVAILABLE:
            return

        pin = self.config.get('shutdown_gpio', 21)

        try:
            GPIO.setmode(GPIO.BCM)
            GPIO.setup(pin, GPIO.IN, pull_up_down=GPIO.PUD_UP)
            GPIO.add_event_detect(
                pin,
                GPIO.FALLING,
                callback=self._gpio_press,
                bouncetime=200,
            )
            logger.info(f"Shutdown button on GPIO{pin}")
        except Exception as e:
            logger.warning(f"GPIO setup failed: {e}")

    def _gpio_press(self, channel):
        press_start = time.time()

        while GPIO_AVAILABLE and GPIO.input(channel) == GPIO.LOW:
            held = time.time() - press_start

            if held >= 3.0:
                logger.info("Long press → shutdown")
                self.trigger_shutdown()
                return

            time.sleep(0.05)

    # ── Keyboard ─────────────────────────────────────────────────────────────

    def _setup_keyboard(self):
        if not EVDEV_AVAILABLE:
            return

        device_path = '/dev/input/by-id/usb-Binepad_KnobX1_vial:f64c2b3c-event-kbd'

        try:
            device = InputDevice(device_path)

            logger.info(
                "Keyboard connected: %s (%s)",
                device.name,
                device.path,
            )

            self._keyboard_stop.clear()
            self._keyboard_thread = threading.Thread(
                target=self._keyboard_loop,
                args=(device,),
                daemon=True,
                name='keyboard',
            )
            self._keyboard_thread.start()

        except Exception as e:
            logger.warning(f"Keyboard setup failed: {e}")

    def _keyboard_loop(self, device):
        logger.info("Keyboard listener started")

        try:
            for event in device.read_loop():
                if self._keyboard_stop.is_set():
                    break

                if event.type != ecodes.EV_KEY:
                    continue

                key_event = categorize(event)

                # 0 = key up
                # 1 = key down
                # 2 = key repeat
                #
                # Only respond to the initial key-down event.
                if key_event.keystate != 1:
                    continue

                self._keyboard_press(key_event.keycode)

        except Exception as e:
            if not self._keyboard_stop.is_set():
                logger.error(f"Keyboard error: {e}")

        finally:
            device.close()

        logger.info("Keyboard listener stopped")

    def _keyboard_press(self, key):
        if key == 'KEY_Q':
            self._set_mode_to_patternflow()
            self._patternflow_prev()
        elif key == 'KEY_E':
            self._set_mode_to_patternflow()
            self._patternflow_next()
        elif key == 'KEY_W':
            self._toggle_mode_from_patternflow_to_gameoflife()

        elif key == 'KEY_A':
            self._patternflow_knob_delta(0, -1)
        elif key == 'KEY_S':
            self._patternflow_knob_button(0)
        elif key == 'KEY_D':
            self._patternflow_knob_delta(0, 1)

        elif key == 'KEY_Z':
            self._patternflow_knob_delta(1, -1)
        elif key == 'KEY_X':
            self._patternflow_knob_button(1)
        elif key == 'KEY_C':
            self._patternflow_knob_delta(1, 1)

        elif key == 'KEY_F':
            self._patternflow_knob_delta(2, -1)
        elif key == 'KEY_G':
            self._patternflow_knob_button(2)
        elif key == 'KEY_H':
            self._patternflow_knob_delta(2, 1)

        elif key == 'KEY_V':
            self._patternflow_knob_delta(3, -1)
        elif key == 'KEY_N':
            self._patternflow_knob_button(3)
        elif key == 'KEY_B':
            self._patternflow_knob_delta(3, 1)



    def _set_mode_to_patternflow(self):
        logger.info(f"Keyboard: q → mode patternflow")
        if (self.get_mode() != 'patternflow'):
            self.set_mode('patternflow')

    def _patternflow_prev(self):
        pf = self.modes.get('patternflow')
        names = pf.get_pattern_names()

        current_pattern = pf.get_current_pattern()
        new_index = current_pattern['index'] - 1
        if new_index < 0:
            new_index = len(names) - 1

        pf.set_pattern(new_index)

    def _patternflow_next(self):
        pf = self.modes.get('patternflow')
        names = pf.get_pattern_names()

        current_pattern = pf.get_current_pattern()
        new_index = current_pattern['index'] + 1
        if new_index >= len(names):
            new_index = 0

        pf.set_pattern(new_index)

    def _patternflow_knob_delta(self, knob_index, delta):
        self._set_mode_to_patternflow()
        pf = self.modes.get('patternflow')
        pf.web_knob(knob_index, delta)

    def _patternflow_knob_button(self, knob_index):
        self._set_mode_to_patternflow()
        pf = self.modes.get('patternflow')
        pf.web_button(knob_index)

    def _toggle_mode_from_patternflow_to_gameoflife(self):
        if self.get_mode() == 'patternflow':
            logger.info(f"Keyboard: w → mode gameoflife")
            self.set_mode('gameoflife')
        else:
            logger.info(f"Keyboard: w → mode patternflow")
            self.set_mode('patternflow')

    # ── Mode management ──────────────────────────────────────────────────────

    def set_mode(self, name, manual=True, **kwargs):
        if name not in self.modes:
            logger.error(f"Unknown mode '{name}'")
            return False

        if self._dnd and name != 'onair':
            logger.debug(f"set_mode '{name}' blocked by DND")
            return False

        if manual:
            self._carousel_manual_until = time.monotonic() + 1.0

        with self._mode_lock:
            if self.current_mode:
                self.current_mode.stop()

            self.current_mode = self.modes[name]
            self.current_mode_name = name

            if kwargs:
                self.config.set_section(name, kwargs)

            self.current_mode.start()
            self._clear_next_frame = True

        self.config.set('mode', name)
        logger.info(f"Mode → {name}")

        return True

    def get_mode(self):
        return self.current_mode_name

    def enable_dnd(self):
        if self._dnd:
            return

        self._dnd_return_mode = self.get_mode()
        self._dnd = True
        self.set_mode('onair', manual=True)
        logger.info("DND enabled")

    def disable_dnd(self):
        if not self._dnd:
            return

        self._dnd = False
        return_mode = self._dnd_return_mode or 'clock'
        self._dnd_return_mode = None
        self.set_mode(return_mode, manual=True)
        logger.info(f"DND disabled → {return_mode}")

    def get_dnd(self):
        return self._dnd

    def get_mode_names(self):
        return list(self.modes.keys())

    def _carousel_cfg(self):
        cfg = self.config.get_section('carousel')
        enabled = bool(cfg.get('enabled', False))
        selected = [m for m in cfg.get('modes', []) if m in self.modes]
        durations = cfg.get('durations', {})
        return enabled, selected, durations

    @staticmethod
    def _reminder_id(reminder):
        rid = str(reminder.get('id', '') or '').strip()

        if rid:
            return rid

        return f"{reminder.get('time', '')}|{reminder.get('text', '')}"

    def _check_reminders(self):
        if self.get_mode() == 'reminder':
            return

        if self._dnd:
            return

        if not self._screen_on:
            return

        cfg = self.config.get_section('reminders')

        if not bool(cfg.get('enabled', False)):
            return

        now = time.localtime()
        current_time = f"{now.tm_hour:02d}:{now.tm_min:02d}"
        today = f"{now.tm_year:04d}-{now.tm_mon:02d}-{now.tm_mday:02d}"

        for reminder in cfg.get('items', []):
            if not bool(reminder.get('enabled', True)):
                continue

            if str(reminder.get('time', '')).strip() != current_time:
                continue

            rid = self._reminder_id(reminder)

            if self._reminder_last_fired.get(rid) == today:
                continue

            return_mode = self.get_mode()
            mode = self.modes.get('reminder')

            if not mode:
                return

            mode.show(reminder, return_mode)
            self._reminder_last_fired[rid] = today
            self.set_mode('reminder', manual=False)
            break

    @staticmethod
    def _carousel_duration(mode_name, durations):
        try:
            value = durations.get(mode_name, 30)
        except AttributeError:
            value = 30

        return max(2, min(3600, int(value or 30)))

    def _start_carousel(self):
        self._carousel_stop.clear()

        self._carousel_thread = threading.Thread(
            target=self._carousel_loop,
            daemon=True,
            name='carousel',
        )
        self._carousel_thread.start()

    def _carousel_loop(self):
        last_switch = time.monotonic()

        while not self._carousel_stop.wait(0.5):
            enabled, selected, durations = self._carousel_cfg()

            if not enabled or len(selected) < 2:
                last_switch = time.monotonic()
                continue

            now = time.monotonic()

            if now < self._carousel_manual_until:
                last_switch = now
                continue

            # Hold carousel while a workout is in progress
            workout_mode = self.modes.get('workout')

            if workout_mode and workout_mode.is_active():
                last_switch = now
                continue

            # Hold carousel while a reminder is displaying
            if self.get_mode() == 'reminder':
                last_switch = now
                continue

            interval = self._carousel_duration(self.get_mode(), durations)

            if now - last_switch < interval:
                continue

            current = self.get_mode()

            if current in selected:
                next_idx = (selected.index(current) + 1) % len(selected)
            else:
                next_idx = self._carousel_index % len(selected)

            # Skip spotify when idle if that option is enabled
            carousel_cfg = self.config.get_section('carousel')
            skip_idle = bool(carousel_cfg.get('skip_spotify_if_idle', False))

            if skip_idle and 'spotify' in selected:
                spotify_mode = self.modes.get('spotify')

                # Walk forward past spotify when nothing is playing, but never
                # skip it when the user landed on it manually.
                attempts = 0

                while (
                    selected[next_idx] == 'spotify'
                    and spotify_mode
                    and not spotify_mode.is_playing()
                    and attempts < len(selected)
                ):
                    next_idx = (next_idx + 1) % len(selected)
                    attempts += 1

            self._carousel_index = next_idx
            self.set_mode(selected[self._carousel_index], manual=False)
            last_switch = time.monotonic()

    def set_screen(self, on: bool):
        self._screen_on = bool(on)

    def get_screen(self) -> bool:
        return self._screen_on

    def night_mode_active(self) -> bool:
        cfg = self.config.get_section('night_mode')

        if not cfg.get('enabled'):
            return False

        now = time.localtime()
        current = now.tm_hour * 60 + now.tm_min

        try:
            sh, sm = map(
                int,
                str(cfg.get('start', '22:00')).split(':'),
            )
            eh, em = map(
                int,
                str(cfg.get('end', '05:00')).split(':'),
            )
        except Exception:
            return False

        start_min = sh * 60 + sm
        end_min = eh * 60 + em

        if start_min <= end_min:
            return start_min <= current < end_min

        return current >= start_min or current < end_min

    def _apply_auto_brightness(self):
        if not self.matrix:
            return

        if self.night_mode_active():
            cfg = self.config.get_section('night_mode')
            target = max(
                1,
                min(100, int(cfg.get('brightness', 20))),
            )
        else:
            target = max(
                1,
                min(100, int(self.config.get('brightness', 50))),
            )

        if self._last_applied_brightness != target:
            self.matrix.brightness = target
            self._last_applied_brightness = target

    def refresh_brightness(self):
        self._last_applied_brightness = None
        self._apply_auto_brightness()

    def set_brightness(self, value):
        value = max(1, min(100, int(value)))
        self.config.set('brightness', value)
        self._last_applied_brightness = None
        self._apply_auto_brightness()

    # ── Main render loop ─────────────────────────────────────────────────────

    def run(self):
        self.running = True
        logger.info("Render loop started")

        if self.matrix:
            canvas = self.matrix.CreateFrameCanvas()
        else:
            canvas = SimCanvas()

        try:
            perf_frames = 0
            perf_render_s = 0.0
            perf_swap_s = 0.0
            perf_last_log = time.monotonic()
            brightness_check_t = 0.0

            while self.running:
                self._check_reminders()

                now_t = time.monotonic()

                if now_t - brightness_check_t >= 30.0:
                    self._apply_auto_brightness()
                    brightness_check_t = now_t

                if not self._screen_on:
                    canvas.Clear()

                    if self.matrix:
                        canvas = self.matrix.SwapOnVSync(canvas)
                    else:
                        time.sleep(0.033)

                    continue

                if self._clear_next_frame:
                    canvas.Clear()
                    self._clear_next_frame = False

                render_start = time.monotonic()

                with self._mode_lock:
                    mode = self.current_mode

                    if mode:
                        try:
                            mode.render(canvas)
                        except Exception as e:
                            logger.error(f"Render error: {e}")

                render_end = time.monotonic()

                requested_mode = None

                if mode and hasattr(mode, 'consume_requested_mode'):
                    try:
                        requested_mode = mode.consume_requested_mode()
                    except Exception as e:
                        logger.warning(
                            f"Mode switch request error: {e}"
                        )

                if self.matrix:
                    swap_start = time.monotonic()
                    canvas = self.matrix.SwapOnVSync(canvas)
                    swap_end = time.monotonic()
                else:
                    time.sleep(0.033)
                    swap_start = render_end
                    swap_end = time.monotonic()

                if requested_mode and requested_mode in self.modes:
                    self.set_mode(requested_mode, manual=False)

                perf_frames += 1
                perf_render_s += render_end - render_start
                perf_swap_s += swap_end - swap_start

                now = time.monotonic()

                if now - perf_last_log >= 5.0:
                    total_s = max(0.001, now - perf_last_log)

                    logger.info(
                        "Perf: mode=%s fps=%.1f render_ms=%.1f swap_ms=%.1f frames=%d",
                        self.current_mode_name,
                        perf_frames / total_s,
                        perf_render_s * 1000.0 / max(1, perf_frames),
                        perf_swap_s * 1000.0 / max(1, perf_frames),
                        perf_frames,
                    )

                    perf_frames = 0
                    perf_render_s = 0.0
                    perf_swap_s = 0.0
                    perf_last_log = now

        except KeyboardInterrupt:
            pass

        finally:
            self._cleanup()

    def _cleanup(self):
        self.running = False

        self._carousel_stop.set()
        self._keyboard_stop.set()

        with self._mode_lock:
            if self.current_mode:
                self.current_mode.stop()

        if self.matrix:
            self.matrix.Clear()
            time.sleep(0.15)  # give refresh thread time to push blank frame

        if GPIO_AVAILABLE:
            try:
                GPIO.cleanup()
            except Exception:
                pass

        logger.info("Controller stopped")

    def trigger_shutdown(self):
        """Shut down the Pi. Called from GPIO or API."""
        logger.info("System shutdown requested")
        self._cleanup()
        os.system("sudo shutdown -h now")


# ── Entry point ───────────────────────────────────────────────────────────────

controller: MatrixController | None = None


def get_controller() -> MatrixController | None:
    return controller


if __name__ == '__main__':
    controller = MatrixController()

    from api import create_app
    flask_app = create_app(get_controller)

    def _run_api():
        flask_app.run(
            host='0.0.0.0',
            port=8080,
            debug=False,
            use_reloader=False,
        )

    api_thread = threading.Thread(
        target=_run_api,
        daemon=True,
        name='api',
    )
    api_thread.start()

    def _sig(sig, frame):
        logger.info(f"Signal {sig} received")
        controller._cleanup()
        sys.exit(0)

    signal.signal(signal.SIGTERM, _sig)
    signal.signal(signal.SIGINT, _sig)

    controller.run()