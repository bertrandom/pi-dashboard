// ===== Patternflow pattern =====
// Title:    Hyper-Glitch Tunnel
// Author:   @martinnlopez
// Date:     2026-07-31
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @matrix 64x128
// @knobs Speed=0.1..5, Zoom=1..10, Glitch=0..1, Color=0..1
export function setup(params) {
  params.t = 0;
  params.k = [1, 5, 0.5, 0.5];
}

export function update(dt, input, params) {
  params.k = input.knobValues;
  params.t += dt * params.k[0];
}

export function draw(display, params, time) {
  const w = display.width, h = display.height;
  const zoom = params.k[1];
  const glitch = params.k[2];
  const hShift = params.k[3] * 6.28;

  for (let y = 0; y < h; y++) {
    // Horizontal slicing glitch
    let xOffset = 0;
    if (Math.sin(y * 0.5 + params.t * 10) > 1.0 - glitch) {
      xOffset = Math.sin(params.t * 20) * 10 * glitch;
    }

    for (let x = 0; x < w; x++) {
      const nx = (x + xOffset - w / 2) / (h / 2) * zoom;
      const ny = (y - h / 2) / (h / 2) * zoom;

      // Square distance (Chebyshev)
      const dist = Math.max(Math.abs(nx), Math.abs(ny));
      
      // Ring logic with high-frequency interference
      const rings = Math.floor(dist - params.t * 2);
      const checker = (Math.floor(nx * 4) ^ Math.floor(ny * 4)) % 2;
      
      // Noise/Dither
      const noise = Math.random() < glitch * 0.3 ? 1 : 0;

      if (noise && glitch > 0.1) {
        display.setPixel(x, y, Math.random() * 255, Math.random() * 255, Math.random() * 255);
      } else {
        const val = Math.sin(dist * 10 - params.t * 5);
        const r = Math.floor(127 + 127 * Math.sin(rings + hShift + checker));
        const g = Math.floor(127 + 127 * Math.sin(rings + hShift + 2 + checker));
        const b = Math.floor(127 + 127 * Math.sin(rings + hShift + 4 + checker));

        const edge = Math.abs(val) > 0.5 ? 1 : 0.2;
        display.setPixel(x, y, r * edge, g * edge, b * edge);
      }
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
