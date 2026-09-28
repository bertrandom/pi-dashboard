// ===== Patternflow pattern =====
// Title:   HexagonalHivePulse
// Author:  @engmung
// Date:    2026-07-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp linear 0.935:#ffffff 0.182:#ff0000 0.346:#000000 0.812:#000000
// @matrix 64x128
// Pattern: Hexagonal Hive Pulse
// Author: your name here
// SPDX-License-Identifier: CC-BY-SA-4.0
// Date: 2026-07-26
// Made with Patternflow Pattern Lab — https://patternflow.work/pattern-lab


// @knobs HexSize=2..6, PulseSpeed=0.5..5, RingFreq=1..15, Sharpness=1..1

export function setup(params) {}

export function update(dt, input, params) {
  params.hexSize = input.knobValues[0];
  params.speed = input.knobValues[1];
  params.ringFreq = input.knobValues[2];
  params.sharp = input.knobValues[3];
}

export function draw(display, params, time) {
  const w = display.width;
  const h = display.height;
  const hexSize = params.hexSize || 8;
  const speed = params.speed || 2;
  const ringFreq = params.ringFreq || 3;
  const sharp = params.sharp || 3;
  const t = time * speed;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const qx = (x * Math.sqrt(3) / 3 - y / 3) / hexSize;
      const rx = (y * 2 / 3) / hexSize;
      const q = Math.round(qx);
      const r = Math.round(rx);
      const distFromCenter = Math.sqrt(q * q + r * r + q * r);
      let wave = Math.sin(distFromCenter * ringFreq - t);
      wave = Math.pow((wave + 1) * 0.5, sharp);
      display.setValue(x, y, Math.min(1, Math.max(0, wave)));
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
