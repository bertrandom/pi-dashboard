// ===== Patternflow pattern =====
// Title:    Launching
// Author:   @engmung
// Date:     2026-08-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp linear 0:#000000 1:#ffffff
// @knobs Rows=1..12, Size=0..3, Angle=-90..90, Warp=0..12
// @matrix 64x128


const TEXT = "Patternflow is live!   ";
const FIXED_SPEED = 5;
const BASE_MULTIPLIER = 7;

const FONT = {
  'P': [0x0e, 0x11, 0x11, 0x0e, 0x10, 0x10, 0x10],
  'a': [0x00, 0x00, 0x0e, 0x01, 0x0f, 0x11, 0x0e],
  't': [0x04, 0x0e, 0x04, 0x04, 0x04, 0x04, 0x02],
  'e': [0x00, 0x00, 0x0e, 0x11, 0x1e, 0x10, 0x0e],
  'r': [0x00, 0x00, 0x16, 0x19, 0x10, 0x10, 0x10],
  'n': [0x00, 0x00, 0x16, 0x19, 0x11, 0x11, 0x11],
  'f': [0x06, 0x09, 0x08, 0x1c, 0x08, 0x08, 0x08],
  'l': [0x0c, 0x04, 0x04, 0x04, 0x04, 0x04, 0x02],
  'o': [0x00, 0x00, 0x0e, 0x11, 0x11, 0x11, 0x0e],
  'w': [0x00, 0x00, 0x11, 0x11, 0x15, 0x15, 0x0a],
  'i': [0x04, 0x00, 0x0c, 0x04, 0x04, 0x04, 0x0e],
  's': [0x00, 0x00, 0x0e, 0x10, 0x0e, 0x01, 0x1e],
  'v': [0x00, 0x00, 0x11, 0x11, 0x11, 0x0a, 0x04],
  '!': [0x04, 0x04, 0x04, 0x04, 0x00, 0x00, 0x04],
  ' ': [0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]
};

const ROW_WEIGHTS = [1.1, 0.8, 1.5, 0.9, 1.4, 1.2, 1.6, 1.0, 1.3];

function sampleScaledChar(px, py, scale) {
  const scaledH = 7 * scale;
  if (py < 0 || py >= scaledH) return 0;
  const slotW = 6 * scale;
  const loopWidth = TEXT.length * slotW;
  let nx = Math.floor(px) % loopWidth;
  if (nx < 0) nx += loopWidth;

  const charIdx = Math.floor(nx / slotW);
  const lx = Math.floor((nx % slotW) / scale);
  const ly = Math.floor(py / scale);

  if (lx >= 5 || ly >= 7) return 0;
  const ch = TEXT[charIdx];
  const glyph = FONT[ch] || FONT[' '];
  return (glyph[ly] >> (4 - lx)) & 1;
}

export function setup(params) {
  params.baseTime = 0;
  params.angleOffset = 0;
}

export function update(dt, input, params) {
  params.baseTime += dt * FIXED_SPEED;
  params.rows = Math.floor(input.knobValues[0]);
  params.size = Math.floor(input.knobValues[1]);

  if (input.btnPressed && input.btnPressed[2]) {
    params.angleOffset = -input.knobValues[2];
  }

  const currentDeg = input.knobValues[2] + params.angleOffset;
  params.angle = (currentDeg * Math.PI) / 180;
  params.warp = input.knobValues[3];
}

export function draw(display, params, time) {
  const w = display.width;
  const h = display.height;
  const scale = params.size;

  if (scale <= 0) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        display.setValue(x, y, 0.0);
      }
    }
    return;
  }

  const numRows = Math.max(1, params.rows || 8);
  const rowHeight = h / numRows;
  const rad = params.angle;
  const cosA = Math.cos(rad);
  const sinA = Math.sin(rad);
  const cx = w * 0.5;
  const cy = h * 0.5;
  const warpAmp = params.warp;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const rx = dx * cosA - dy * sinA + cx;
      const ry = dx * sinA + dy * cosA + cy;

      const waveY = Math.sin(rx * 0.08 + time * 3) * warpAmp;
      const finalRy = ry + waveY;

      const rowIdx = Math.floor(finalRy / rowHeight);
      const localY = Math.floor(finalRy % rowHeight);
      const textY = localY - Math.floor((rowHeight - 7 * scale) / 2);
      const weight = ROW_WEIGHTS[Math.abs(rowIdx) % ROW_WEIGHTS.length] || 1.0;
      const scroll = params.baseTime * BASE_MULTIPLIER * weight;

      const isSet = sampleScaledChar(rx + scroll, textY, scale);
      display.setValue(x, y, isSet ? 1.0 : 0.0);
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
