// ===== Patternflow pattern =====
// Title:    Ink Drop Topology
// Author:   @martinnlopez
// Date:     2026-07-31
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @matrix 128x128
// @knobs Swirl=1..12, Speed=0.1..3, Rings=5..30, PaletteSweep=0..1
export function setup(params) {
  params.t = 0;
  params.k = [6, 1, 15, 0];
}

export function update(dt, input, params) {
  params.k = input.knobValues;
  params.t += dt * params.k[1];
}

export function draw(display, params, time) {
  const w = display.width, h = display.height;
  const swirl = params.k[0];
  const rings = params.k[2];
  // Widen the color range by multiplying the 0-1 knob into a multi-rotation phase
  const colorBase = params.k[3] * 12.56; // Two full rotations of the color wheel

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = (x - w / 2) / w;
      const ny = (y - h / 2) / h;
      
      const d = Math.sqrt(nx * nx + ny * ny);
      const angle = Math.atan2(ny, nx);
      
      // Create swirling fluid interference pattern
      const v = Math.sin(d * rings - params.t) + Math.sin(angle * swirl + params.t);
      
      // Binary ink logic: creates sharp topology-style "cutouts"
      const threshold = Math.sin(v * 3.0) > 0;
      
      if (threshold) {
        // Wide-spectrum color logic tied to Knob 4 and distance
        // This creates a rainbow spiral effect that spans the full LED gamut
        const hue = colorBase + d * 5.0 + v * 0.5;
        
        const r = Math.floor(127 + 127 * Math.sin(hue));
        const g = Math.floor(127 + 127 * Math.sin(hue + 2.09)); // 120 degrees
        const b = Math.floor(127 + 127 * Math.sin(hue + 4.18)); // 240 degrees

        // Boost brightness for the matrix
        display.setPixel(x, y, Math.min(255, r * 1.2), Math.min(255, g * 1.2), Math.min(255, b * 1.2));
      } else {
        // Draw the "ink void"
        display.setPixel(x, y, 0, 0, 0);
      }
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
