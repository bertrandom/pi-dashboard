// ===== Patternflow pattern =====
// Title:    Digital Lava Lamp
// Author:   @martinnlopez
// Date:     2026-08-12
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @knobs Speed=0.1..2, Gloom=-1.172..3, Variety=1..5, Scale=0.5..2
// @matrix 128x128

export function setup(params) {
  params.t = 0;
  // We define "centers" that will move around
  params.blobs = [];
  for (let i = 0; i < 8; i++) {
    params.blobs.push({
      x: Math.random() * 2 - 1,
      y: Math.random() * 2 - 1,
      seedX: Math.random() * 10,
      seedY: Math.random() * 10
    });
  }
}

export function update(dt, input, params) {
  params.k = input.knobValues;
  params.t += dt * params.k[0];
}

export function draw(display, params, time) {
  const w = display.width, h = display.height;
  const t = params.t;
  const [speed, gloom, variety, scale] = params.k;

  // Move the blobs behind the scenes
  const activeBlobs = [];
  for (let b of params.blobs) {
    activeBlobs.push({
      x: Math.sin(t + b.seedX) * 0.8,
      y: Math.cos(t * 0.7 + b.seedY) * 0.8
    });
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Normalize coordinates (-1 to 1)
      const nx = (x / w - 0.5) * 2.0 * scale;
      const ny = (y / h - 0.5) * 2.0 * scale;

      let sum = 0;

      // --- FRAG MATH (SDF logic) ---
      for (let b of activeBlobs) {
        const dx = nx - b.x;
        const dy = ny - b.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        
        // This math is the "magic" of metaballs: 
        // The closer a pixel is to a center, the higher the sum.
        sum += 0.1 / (d * d); 
      }

      // We use the 'sum' to decide the color
      if (sum > gloom) {
        // Pixel is "Inside" a blob
        const hue = (sum * 0.1 + t * 0.2 * variety) % 1.0;
        
        // Create a glowing holographic edge
        const edge = Math.sin(sum * 2.0 - t * 5.0) * 0.5 + 0.5;
        
        // Color shifts based on variety knob
        display.setPixel(x, y, 
          100 + edge * 155, 
          50 + hue * 100, 
          200 - hue * 150
        );
      } else {
        // Background
        display.setPixel(x, y, 10, 5, 20);
      }
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
