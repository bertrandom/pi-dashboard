// ===== Patternflow pattern =====
// Title:    Thermal Oil Blob
// Author:   @martinnlopez
// Date:     2026-07-31
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @matrix 64x128
// @knobs Scale=2..15, Speed=0.1..4, Turbulence=1..8, HueShift=0..1
export function setup(params) {
  params.t = 0;
  params.k = [5, 1, 4, 0];
}

export function update(dt, input, params) {
  params.k = input.knobValues;
  params.t += dt * params.k[1];
}

export function draw(display, params, time) {
  const w = display.width, h = display.height;
  const scale = params.k[0] * 0.01;
  const turb = params.k[2];
  const hShift = params.k[3] * 6.28;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Layered sine-based pseudo-noise (FBM)
      let v = 0;
      let amp = 1.0;
      let freq = scale;
      for (let i = 0; i < 3; i++) {
        v += Math.sin(x * freq + params.t + i) * Math.cos(y * freq - params.t * 0.5 + i) * amp;
        freq *= 2.1;
        amp *= 0.5;
      }

      // Distort the value to create "blobs"
      v = Math.sin(v * turb + params.t);

      // Color mapping: local value drives vibrant neon shifts
      const r = Math.floor(128 + 127 * Math.sin(v * 3 + hShift));
      const g = Math.floor(128 + 127 * Math.sin(v * 3 + 2 + hShift));
      const b = Math.floor(128 + 127 * Math.sin(v * 3 + 4 + hShift));

      // High contrast thresholding (look for edges)
      const edge = Math.abs(v) < 0.1 ? 0 : 1;
      display.setPixel(x, y, r * edge, g * edge, b * edge);
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
