// ===== Patternflow pattern =====
// Title:    Heart's illumination
// Author:   @martinnlopez
// Date:     2026-08-03
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @matrix 64x128
// @knobs Density=2..6, Speed=0.1..4, BeatForce=0..1.5, HueRange=0..1
export function setup(params) {
  params.t = 0;
  params.k = [3, 1, 0.8, 0.5];
}

export function update(dt, input, params) {
  params.k = input.knobValues;
  params.t += dt * params.k[1];
}

export function draw(display, params, time) {
  const w = display.width;
  const h = display.height;
  
  const density = Math.floor(params.k[0]);
  const cellSize = w / density;
  const beatIntensity = params.k[2];
  const globalHue = params.k[3] * 6.28;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      
      const cellX = Math.floor(x / cellSize);
      const cellY = Math.floor(y / cellSize);
      
      let finalR = 0, finalG = 0, finalB = 0;

      // Check 3x3 neighborhood for overlapping
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          const cx = cellX + i;
          const cy = cellY + j;
          const seed = (cx * 13.7 + cy * 21.4);
          
          // 1. Position with drifting "float"
          const floatX = Math.sin(params.t * 0.4 + seed) * (cellSize * 0.2);
          const floatY = Math.cos(params.t * 0.3 + seed) * (cellSize * 0.2);
          const centerX = (cx + 0.5) * cellSize + floatX;
          const centerY = (cy + 0.5) * cellSize + floatY;

          // 2. Local coordinates (Normalized -1 to 1)
          let lx = (x - centerX) / (cellSize * 0.5);
          let ly = (centerY - y) / (cellSize * 0.5); // Screen Y is down, so invert

          // 3. Heart Beat Physics (Double Thump)
          const localTime = params.t * 3.0 + seed;
          const pulse = Math.pow(Math.sin(localTime), 8) + Math.pow(Math.sin(localTime - 0.5), 8) * 0.4;
          const scale = 0.7 + pulse * beatIntensity;
          
          lx /= scale;
          ly /= scale;

          // 4. Refined Heart Math (Geometric Warp)
          // We warp the Y coordinate based on X to create the "dip" and the "point"
          // ly = ly - constant * sqrt(|lx|)
          const warpedY = ly - 0.5 * Math.sqrt(Math.abs(lx));
          const dist = Math.sqrt(lx * lx + warpedY * warpedY);

          // 5. Rendering the Shape
          if (dist < 0.8) {
            const blink = Math.sin(params.t + seed) * 0.4 + 0.6;
            const hue = seed * 0.5 + globalHue + params.t * 0.2;
            
            // Internal gradient for soft glow look
            const edgeSoftness = 0.2;
            const brightness = Math.max(0, 1.0 - (dist / 0.8)) * blink;
            
            const r = (Math.sin(hue) * 0.5 + 0.5) * 255 * brightness;
            const g = (Math.sin(hue + 2.1) * 0.5 + 0.5) * 255 * brightness;
            const b = (Math.sin(hue + 4.2) * 0.5 + 0.5) * 255 * brightness;

            // Simple additive blend
            finalR = Math.min(255, finalR + r);
            finalG = Math.min(255, finalG + g);
            finalB = Math.min(255, finalB + b);
          }
        }
      }

      // Deep purple background wash
      if (finalR + finalG + finalB < 5) {
        display.setPixel(x, y, 15, 0, 25);
      } else {
        display.setPixel(x, y, finalR, finalG, finalB);
      }
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
