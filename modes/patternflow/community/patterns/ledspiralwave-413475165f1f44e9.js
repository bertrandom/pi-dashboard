// ===== Patternflow pattern =====
// Title:    LedSpiralWave
// Author:   @engmung
// Based on: "Defect Storm" by @engmung — https://patternflow.work/community/p/d9ffc906a89847a5
// Date:     2026-08-09
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp hsvShort 0:#000000 1:#ffffff
// @knobs Spiral=1..15, Speed=0.2..5, Zoom=0.4..3, Turbulence=0..2
// @matrix 128x128


// Knobs:
// 1: Spiral — Arms/folds in polar coordinate space
// 2: Speed — Angular spin velocity
// 3: Zoom — Spatial zoom scaled for tall ratio
// 4: Turbulence — Coordinate domain warper

export function setup(params) {
  params.angle = 0;
}

export function update(dt, input, params) {
  const speed = input.knobValues ? input.knobValues[1] : 1;
  params.angle += dt * speed;
  params.knobValues = input.knobValues;
}

export function draw(display, params, time) {
  const W = display.width, H = display.height;
  const k = params.knobValues || [3, 1, 1, 0.5];
  const arms = k[0];
  const zoom = k[2];
  const turb = k[3];
  const a = params.angle;

  for (let y = 0; y < H; y++) {
    // Map to aspect-corrected polar coordinates
    const ny = (y / H - 0.5) * 2.0 * zoom;
    for (let x = 0; x < W; x++) {
      const nx = (x / W - 0.5) * 1.0 * zoom;

      let r = Math.sqrt(nx * nx + ny * ny);
      let theta = Math.atan2(ny, nx);

      // Domain remapping / warping
      r += Math.sin(theta * 4 + a) * 0.1 * turb;
      theta += Math.sin(r * 8 - a) * 0.2 * turb;

      // Spiral wave synthesis
      const wave1 = Math.sin(theta * arms + r * 10 - a * 2);
      const wave2 = Math.cos(theta * arms - r * 6 + a);

      const amp = Math.sqrt(wave1 * wave1 + wave2 * wave2);
      const phase = Math.atan2(wave2, wave1);

      // Contrast and core mapping
      let v = (Math.sin(phase) * 0.5 + 0.5) * Math.min(1, r * 2);
      v *= Math.min(1, amp);

      display.setValue(x, y, Math.max(0, Math.min(1, v)));
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
