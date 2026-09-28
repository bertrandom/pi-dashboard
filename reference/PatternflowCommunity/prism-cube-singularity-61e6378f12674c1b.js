// ===== Patternflow pattern =====
// Title:    Prism-Cube Singularity
// Author:   @martinnlopez
// Date:     2026-07-31
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @matrix 64x128
// @knobs RotSpeed=0.01..0.2, Scale=2..15, PrismSplit=0..10, Complexity=2..10
export function setup(params) {
  params.t = 0;
  params.k = [0.05, 5, 3, 5];
}

export function update(dt, input, params) {
  params.k = input.knobValues;
  // Slow accumulation of time for minimal movement
  params.t += dt * params.k[0];
}

export function draw(display, params, time) {
  const w = display.width, h = display.height;
  const scale = params.k[1];
  const split = params.k[2];
  const steps = Math.floor(params.k[3]);

  // Subtle rotation angles for X, Y, and Z axes
  const rotZ = params.t;
  const tiltX = Math.sin(params.t * 0.5) * 0.2;
  const tiltY = Math.cos(params.t * 0.7) * 0.2;

  const cosZ = Math.cos(rotZ);
  const sinZ = Math.sin(rotZ);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // 1. Center and apply subtle X/Y perspective tilt
      let nx = (x - w / 2) + (tiltX * w * 0.2);
      let ny = (y - h / 2) + (tiltY * h * 0.2);

      // 2. Perform RGB Channel Splitting (Chromatic Aberration)
      const getChannelValue = (offset) => {
        // Apply Z-rotation per channel for the "Prism" look
        const rx = (nx + offset) * cosZ - ny * sinZ;
        const ry = (nx + offset) * sinZ + ny * cosZ;

        // Square distance (Cubic Tunnel logic)
        const dist = Math.max(Math.abs(rx), Math.abs(ry));
        
        // Pixelated Grid Logic
        const gx = Math.floor(rx / scale);
        const gy = Math.floor(ry / scale);
        
        // Combined Interference: Tunnel Rings + XOR Checkerboard
        const rings = Math.floor(dist / scale - params.t * 10);
        const checker = (gx ^ gy ^ rings);
        
        // Quantize signal into discrete color bands
        return (checker % steps) / steps;
      };

      // Calculate R, G, B with slight spatial offsets
      const rVal = getChannelValue(split);
      const gVal = getChannelValue(0);
      const bVal = getChannelValue(-split);

      // 3. Map to vibrant palette
      const r = Math.floor(127 + 127 * Math.sin(rVal * 6.28 + params.t));
      const g = Math.floor(127 + 127 * Math.sin(gVal * 6.28 + 2));
      const b = Math.floor(127 + 127 * Math.sin(bVal * 6.28 + 4));

      // 4. Edge Enhancement (Stationary Frame logic)
      // Darkens the "recesses" of the tunnel to emphasize the cube structure
      const nx_norm = (x - w / 2) / (w / 2);
      const ny_norm = (y - h / 2) / (h / 2);
      const edgeFade = 1.0 - Math.pow(Math.max(Math.abs(nx_norm), Math.abs(ny_norm)), 4);

      display.setPixel(x, y, r * edgeFade, g * edgeFade, b * edgeFade);
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
