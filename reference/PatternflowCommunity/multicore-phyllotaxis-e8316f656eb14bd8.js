// ===== Patternflow pattern =====
// Title:    Multicore Phyllotaxis
// Author:   @martinnlopez
// Date:     2026-08-03
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @matrix 64x128
// @knobs Divergence=0.1..1, SpiralCount=1..5, Speed=0..5, Morph=0..1
export function setup(params) {
  params.t = 0;
  params.k = [0.3819, 1, 1, 0];
}

export function update(dt, input, params) {
  params.k = input.knobValues;
  // Accumulate time for rotation
  params.t += dt * params.k[2];
}

export function draw(display, params, time) {
  const w = display.width;
  const h = display.height;
  
  // Knob 2: Number of spirals (1 to 5)
  const count = Math.floor(params.k[1]);
  // Knob 1: Divergence angle fraction
  const divergence = params.k[0] * Math.PI * 2;
  const morph = params.k[3];

  // Clear background
  for (let i = 0; i < w * h; i++) display.setPixel(i % w, Math.floor(i / w), 0, 0, 0);

  // Divide the total height by the number of spirals
  const segmentHeight = h / count;
  // Scale the radius so spirals don't overlap too much
  const baseScale = (segmentHeight / 2) / 10; 

  for (let s = 0; s < count; s++) {
    // Calculate the center for this specific spiral
    const cx = w / 2;
    const cy = (segmentHeight / 2) + (s * segmentHeight);
    
    // Distribute total seeds among spirals to keep performance stable
    const seedsPerSpiral = Math.floor(400 / count);

    for (let i = 1; i < seedsPerSpiral; i++) {
      // Rotation: Every other spiral rotates in the opposite direction
      const dir = (s % 2 === 0) ? 1 : -1;
      const angle = i * divergence + (params.t * dir);
      
      // Fermat's Spiral: r = c * sqrt(n)
      const radius = baseScale * Math.sqrt(i);
      
      const x = Math.floor(cx + Math.cos(angle) * radius);
      const y = Math.floor(cy + Math.sin(angle) * radius);

      // Boundary check
      if (x >= 0 && x < w && y >= 0 && y < h) {
        // Color logic: unique per spiral and index
        const hue = (i * 0.05) + (params.t * 0.3) + (s * 1.5);
        
        const r = Math.floor(127 + 127 * Math.sin(hue));
        const g = Math.floor(127 + 127 * Math.sin(hue + 2 + morph * 4));
        const b = Math.floor(127 + 127 * Math.sin(hue + 4));

        display.setPixel(x, y, r, g, b);
        
        // Add a highlight core for the first few seeds of each spiral
        if (i < 5) {
          display.setPixel(x, y, 255, 255, 255);
        }
      }
      
      // Optimization: if we've filled the segment, move to next spiral
      if (radius > segmentHeight) break;
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
