// ===== Patternflow pattern =====
// Title:    Monochromatic Perspective Flow
// Author:   @martinnlopez
// Date:     2026-08-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp hsvLong recolor 0.114:#000000 0.904:#ffffff 0.482:#737373
// @knobs Density=2.3..5, Amplitude=15..60, Speed=0.1..5, Detail=3..12
// @matrix 64x128
// Pattern: Monochromatic Perspective Flow

export function setup(params) {
  params.t = 0;
  params.k = [10, 15, 1, 2];
}

export function update(dt, input, params) {
  params.k = input.knobValues;
  params.t += dt * params.k[2];
}

export function draw(display, params, time) {
  const w = display.width, h = display.height;
  const density = params.k[0];
  const amp = params.k[1];
  const detail = params.k[3];
  const t = params.t;

  // Clear background
  for (let i = 0; i < w * h; i++) display.setPixel(i % w, Math.floor(i / w), 0, 0, 0);

  // Iterate through lines. Perspective: lines are closer at the top (y near 0)
  for (let ly = 0; ly < h; ly += density) {
    // Normalize line height for perspective calculation
    const perspective = Math.pow(ly / h, 1.5);
    const lineYBase = ly;

    for (let x = 0; x < w; x++) {
      // Sum multiple sines for organic "Detail"
      let height = 0;
      for (let i = 1; i <= detail; i++) {
        height += Math.sin(x * 0.05 * i + t + ly * 0.1) * (amp / i);
      }
      
      // Apply height and perspective
      const finalY = Math.floor(lineYBase + height * perspective);

      if (finalY >= 0 && finalY < h) {
        // Brightness based on height (peaks are whiter)
        const bri = Math.floor(150 + (height / amp) * 105);
        display.setPixel(x, finalY, bri, bri, bri);
      }
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
