// ===== Patternflow pattern =====
// Title:    Beating Blob
// Author:   @martinnlopez
// Date:     2026-08-04
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @matrix 64x128
// @knobs Density=2..8, Speed=0.1..4, Beat=0..1.5, ColorShift=0..1
export function setup(params) {
  params.t = 0;
  params.k = [4, 1, 0.8, 0];
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
      
      // We check the blob in our current cell and the 8 neighboring cells
      // to allow large blobs to overlap into adjacent spaces.
      const cellX = Math.floor(x / cellSize);
      const cellY = Math.floor(y / cellSize);
      
      let finalR = 0, finalG = 0, finalB = 0;

      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          const cx = cellX + i;
          const cy = cellY + j;

          // Unique seed for this specific blob
          const seed = (cx * 17.1 + cy * 23.3);
          
          // 1. Position: Center of cell + random drift/float
          const floatX = Math.sin(params.t * 0.5 + seed) * (cellSize * 0.3);
          const floatY = Math.cos(params.t * 0.4 + seed) * (cellSize * 0.3);
          
          const centerX = (cx + 0.5) * cellSize + floatX;
          const centerY = (cy + 0.5) * cellSize + floatY;

          // 2. Local coordinates relative to blob center
          // Normalized so that 1.0 is roughly the edge of a cell
          const lx = (x - centerX) / (cellSize * 0.8);
          const ly = (centerY - y) / (cellSize * 0.8); // Invert Y for math

          // 3. Heart Beat Physics
          // Double-pulse: Thump-thump... Thump-thump...
          const localTime = params.t * 2.5 + seed;
          const pulse = Math.pow(Math.sin(localTime), 10) + Math.pow(Math.sin(localTime - 0.4), 10) * 0.5;
          const scale = 0.5 + pulse * beatIntensity;

          // 4. Blob Shape SDF
          // (x^2 + y^2 - 1)^3 - x^2 * y^3 = 0
          const x2 = lx * lx;
          const y2 = ly * ly;
          const shape = Math.pow(x2 + y2 - scale, 3) - x2 * y2 * scale;

          if (shape < 0) {
            // Individual blinking
            const blink = Math.sin(params.t + seed) * 0.3 + 0.7;
            
            // 5. Color and Shading
            const hue = seed * 0.2 + globalHue + params.t * 0.1;
            
            // Brightness increases toward the center of the blob
            const distBri = (1.0 - Math.abs(shape) * 2.0) * blink;
            
            const r = (Math.sin(hue) * 0.5 + 0.5) * 255 * distBri;
            const g = (Math.sin(hue + 2.1) * 0.5 + 0.5) * 255 * distBri;
            const b = (Math.sin(hue + 4.2) * 0.5 + 0.5) * 255 * distBri;

            // Simple additive blend for overlaps
            finalR = Math.max(finalR, r);
            finalG = Math.max(finalG, g);
            finalB = Math.max(finalB, b);
          }
        }
      }

      // Add a slight dark vignette/background texture
      if (finalR + finalG + finalB < 10) {
        const bg = Math.sin(x * 0.1) * Math.cos(y * 0.1) * 5 + 5;
        display.setPixel(x, y, bg, 0, bg * 1.5);
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
