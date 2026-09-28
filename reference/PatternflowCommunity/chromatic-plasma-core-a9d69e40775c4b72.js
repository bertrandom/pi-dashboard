// ===== Patternflow pattern =====
// Title:    Chromatic Plasma Core
// Author:   @martinnlopez
// Date:     2026-07-31
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp hsvLong recolor 0:#000000 0.173:#00fcff 0.091:#8df900 0:#00fcff
// @matrix 64x128
// New layer — draws a scrolling value field, colored by this layer's ramp.
// Replace with your own pattern. Only draw() is required.
// @knobs Twist=0..5, Spin=0.1..5, Detail=1..10, Range=10..60
export function setup(params) {
  params.k = [0, 0, 0, 0];
}

export function update(dt, input, params) {
  params.k = input.knobValues;
}

export function draw(display, params, time) {
  const w = display.width, h = display.height;
  const cx = w / 2, cy = h / 2;
  const twist = params.k[0];
  const t = time * params.k[1];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx, dy = y - cy;
      const d = Math.sqrt(dx * dx + dy * dy);
      
      // Remap angle based on distance for spiral effect
      let a = Math.atan2(dy, dx) + d * 0.1 * twist;
      
      const beamId = Math.floor(a * 1.5);
      const wave = Math.sin(a * params.k[2] + d * 0.5 - t);
      const intensity = Math.pow(Math.max(0, wave), 30.0) * Math.exp(-d * 0.05);
      
      if (d < params.k[3]) {
        const bri = intensity * 255;
        const r = Math.floor(bri * 0.8);
        const g = Math.floor(bri * 0.4);
        const b = Math.floor(bri);
        display.setPixel(x, y, r, g, b);
      } else {
        display.setPixel(x, y, 0, 0, 0);
      }
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
