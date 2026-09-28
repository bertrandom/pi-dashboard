// ===== Patternflow pattern =====
// Title:    Geometric Singularity
// Author:   @martinnlopez
// Date:     2026-07-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp hsvLong wrap recolor 0:#24243b 0.626:#fefb00
// @matrix 128x128
// Pattern: The Geometric Singularity
// A structural remix focusing on the exact perspective geometry of a 3D funnel.
// Knob 1: Radial Density (0-1) - Number of lines converging on the singularity.
// Knob 2: Collapse Speed (0.1-10) - How fast the rings fall into the void.
// Knob 3: Funnel Depth (0-4.9) - Curvature of the perspective warp.
// Knob 4: Ring Frequency (0-1) - Spacing of the concentric rings.

export function setup(params) {
  params.timeAcc = 0;
}

export function update(dt, input, params) {
  params.timeAcc += dt * input.knobValues[1] * 0.5;
  params.radialCount = 8 + Math.floor(input.knobValues[0] * 32);
  params.depth = input.knobValues[2] + 0.5;
  params.ringFreq = 5 + input.knobValues[3] * 20;
}

export function draw(display, params, time) {
  const w = display.width;
  const h = display.height;
  const t = params.timeAcc;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Normalize to center
      const nx = (x - w / 2) / (h / 2);
      const ny = (y - h / 2) / (h / 2);
      const dist = Math.sqrt(nx * nx + ny * ny);
      const angle = Math.atan2(ny, nx);

      // Perspective warp: the further in, the more compressed the space
      // warpedDist creates the "infinite" feel of the hole
      const warpedDist = Math.pow(dist, 1.0 / params.depth);
      
      // Radial lines (spokes)
      const radial = Math.abs(Math.sin(angle * params.radialCount));
      // Concentric rings (moving inward)
      const rings = Math.sin(warpedDist * params.ringFreq - t);
      
      let intensity = 0;
      // Draw grid lines with thresholding
      if (radial > 0.96 || Math.abs(rings) > 0.94) {
        intensity = 1.0 - Math.min(1.0, dist * 0.5); // Fade out at edges
      }
      
      // Core glow
      const glow = Math.exp(-dist * 8.0);
      
      // Color logic: Outer is blue, inner is white-hot
      const r = Math.floor(glow * 255 + intensity * 100);
      const g = Math.floor(glow * 200 + intensity * 150);
      const b = Math.floor(glow * 100 + intensity * 255);

      display.setPixel(x, y, r, g, b);
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
