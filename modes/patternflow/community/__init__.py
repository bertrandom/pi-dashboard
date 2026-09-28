"""
Patternflow community patterns (https://community.patternflow.work/community).

The patterns are JavaScript written against the website's pattern runtime, so
they run unmodified-in-spirit inside a Node subprocess (runner.mjs), which
returns 128x128 RGB frames. Each .js file in patterns/ becomes one entry in
PATTERNS with the same NAME / KNOB_LABELS / setup / update / draw interface as
the Python patterns. Requires `node` on PATH; without it no community patterns
are registered.
"""
import json
import logging
import os
import re
import select
import shutil
import subprocess
import time

import numpy as np

from .. import core_canvas as pf_canvas

logger = logging.getLogger(__name__)

_DIR = os.path.dirname(os.path.abspath(__file__))
_PATTERN_DIR = os.path.join(_DIR, 'patterns')
_RUNNER = os.path.join(_DIR, 'runner.mjs')

_TITLE_RE = re.compile(r'^//\s*Title:\s*(.+?)\s*$', re.M)
_KNOBS_RE = re.compile(r'^[ \t]*//[ \t]*@knobs[ \t]+(.+)$', re.M)
_KNOB_RE = re.compile(r'^(.+?)\s*=\s*(-?\d*\.?\d+)\s*\.\.\s*(-?\d*\.?\d+)$')

_FRAME_BYTES = pf_canvas.W * pf_canvas.H * 3
_TIMEOUT_S = 2.0        # a frame or load taking longer than this kills the runner
_RETRY_AFTER_S = 5.0    # back-off before retrying a pattern that failed


class _Runner:
    """One shared Node process; holds whichever pattern is currently loaded."""

    def __init__(self, node: str):
        self._node = node
        self._proc: subprocess.Popen | None = None
        self.loaded: str | None = None

    def _start(self):
        self._proc = subprocess.Popen(
            [self._node, _RUNNER],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            cwd=_DIR, bufsize=0,
        )
        self.loaded = None

    def stop(self):
        if self._proc:
            self._proc.kill()
            self._proc.wait()
        self._proc = None
        self.loaded = None

    def _read(self, n: int, deadline: float) -> bytes:
        fd = self._proc.stdout.fileno()
        chunks, got = [], 0
        while got < n:
            remaining = deadline - time.monotonic()
            if remaining <= 0 or not select.select([fd], [], [], remaining)[0]:
                raise TimeoutError('pattern runner timed out')
            chunk = os.read(fd, n - got)
            if not chunk:
                raise EOFError('pattern runner exited')
            chunks.append(chunk)
            got += len(chunk)
        return b''.join(chunks)

    def _read_line(self, deadline: float) -> dict:
        buf = b''
        while not buf.endswith(b'\n'):
            buf += self._read(1, deadline)
        return json.loads(buf)

    def request(self, msg: dict, payload_bytes: int = 0) -> bytes | None:
        """Send one command; return the payload (or None). Raises on failure."""
        if not self._proc or self._proc.poll() is not None:
            self._start()
        deadline = time.monotonic() + _TIMEOUT_S
        try:
            self._proc.stdin.write((json.dumps(msg) + '\n').encode())
            header = self._read_line(deadline)
            if not header.get('ok'):
                raise RuntimeError(header.get('error', 'unknown error'))
            return self._read(payload_bytes, deadline) if payload_bytes else None
        except (TimeoutError, EOFError, BrokenPipeError, ValueError):
            # The process is hung or out of sync; start fresh next time.
            self.stop()
            raise


_runner: _Runner | None = None


class CommunityPattern:
    def __init__(self, path: str, title: str, knob_labels: list[str]):
        self.path = path
        self.NAME = title
        self.KNOB_LABELS = knob_labels
        self._dt = 0.0
        self._deltas = [0, 0, 0, 0]
        self._pressed = [False] * 4
        self._held = [False] * 4
        self._failed_at = 0.0

    def setup(self):
        # Loading happens lazily in draw(), when the pattern is actually shown.
        pass

    def update(self, dt: float, inp) -> None:
        # Knob presses are the pattern's own buttons, as on the Patternflow device.
        self._dt += dt
        for i in range(4):
            self._deltas[i] += inp.knob_deltas[i]
            self._pressed[i] = self._pressed[i] or bool(inp.btn_pressed[i])
            self._held[i] = bool(inp.btn_held[i])

    def draw(self) -> None:
        if self._failed_at and time.monotonic() - self._failed_at < _RETRY_AFTER_S:
            pf_canvas.clear()
            return
        try:
            if _runner.loaded != self.path:
                _runner.loaded = None
                _runner.request({'cmd': 'load', 'file': self.path})
                _runner.loaded = self.path
                self._dt = 0.0
            rgb = _runner.request({
                'cmd': 'frame', 'dt': self._dt, 'deltas': self._deltas,
                'pressed': self._pressed, 'held': self._held,
            }, _FRAME_BYTES)
            self._failed_at = 0.0
        except Exception as e:
            logger.error(f"Community pattern {self.NAME!r} failed: {e}")
            self._failed_at = time.monotonic()
            _runner.loaded = None
            pf_canvas.clear()
            return
        finally:
            self._dt = 0.0
            self._deltas = [0, 0, 0, 0]
            self._pressed = [False] * 4
        pf_canvas.blit(np.frombuffer(rgb, dtype=np.uint8).reshape(pf_canvas.H, pf_canvas.W, 3))
        pf_canvas.present()


def _knob_labels(code: str) -> list[str]:
    labels = ['Knob 1', 'Knob 2', 'Knob 3', 'Knob 4']
    m = _KNOBS_RE.search(code)
    if m:
        for i, part in enumerate(m.group(1).split(',')[:4]):
            k = _KNOB_RE.match(part.strip())
            if k and float(k.group(3)) > float(k.group(2)):
                labels[i] = k.group(1).strip()[:14]
    return labels


def _discover() -> list[CommunityPattern]:
    patterns = []
    for name in sorted(os.listdir(_PATTERN_DIR)):
        if not name.endswith('.js'):
            continue
        path = os.path.join(_PATTERN_DIR, name)
        with open(path, encoding='utf-8') as f:
            code = f.read()
        m = _TITLE_RE.search(code)
        title = m.group(1) if m else name[:-3]
        patterns.append(CommunityPattern(path, title, _knob_labels(code)))
    return sorted(patterns, key=lambda p: p.NAME.lower())


def shutdown():
    if _runner:
        _runner.stop()


_node = shutil.which('node') or shutil.which('nodejs')
if _node:
    _runner = _Runner(_node)
    PATTERNS = _discover()
else:
    logger.warning("Node.js not found; Patternflow community patterns disabled")
    PATTERNS = []
