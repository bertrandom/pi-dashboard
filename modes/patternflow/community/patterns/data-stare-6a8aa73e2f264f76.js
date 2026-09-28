// ===== Patternflow pattern =====
// Title:    Data Stare
// Author:   @martinnlopez
// Date:     2026-08-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @knobs Density=1.634..5.7, Speed=0.1..4, RGBSplit=1..15, Warp=-0.2..12.801
// @matrix 128x128

export function setup(params) {
  params.t = 0;
  params.k = [6, 1, 5, 0.5];
}

export function update(dt, input, params) {
  params.k = input.knobValues;
  params.t += dt * params.k[1];
}

export function draw(display, params, time) {
  const w = display.width, h = display.height;
  const t = params.t;
  const density = params.k[0];
  const split = params.k[2] * 0.015;
  const warpAmt = params.k[3];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let rOut = 0, gOut = 0, bOut = 0;
      
      const nx_base = (x - w / 2) / (w / 2);
      const ny_base = (y - h / 2) / (w / 2);
      const dist_base = Math.sqrt(nx_base * nx_base + ny_base * ny_base);

      for (let channel = 0; channel < 3; channel++) {
        const offset = (channel - 1) * split * dist_base;
        let nx = nx_base + offset;
        let ny = ny_base;

        const d = Math.sqrt(nx * nx + ny * ny);
        const pWarp = 1.0 + d * d * warpAmt * (Math.sin(t * 0.5) * 0.5 + 0.5);
        nx *= pWarp; ny *= pWarp;

        const u = nx * (density * 0.5);
        const v = ny * (density * 0.5);
        const lx = (u - Math.floor(u)) - 0.5;
        const ly = (v - Math.floor(v)) - 0.5;

        // --- BLINK LOGIC ---
        // We use the tile coordinates (floor u/v) to give each eye a different blink timing
        const tileID = Math.floor(u) + Math.floor(v) * 13; 
        // Create a "slow" breathing openness value (0 = closed, 1 = open)
        // We use Math.pow to make the "closed" state happen quickly like a real blink
        let openness = Math.pow(Math.sin(t * 0.5 + tileID * 0.5) * 0.5 + 0.5, 0.2);
        
        // Increase the vertical multiplier as the eye closes
        const verticalSqueeze = 18.0 / Math.max(0.01, openness);

        // --- EYE GEOMETRY LOGIC ---
        const distFromCenter = Math.sqrt(lx * lx + ly * ly);
        // Apply the blink squeeze to the ly (vertical) component
        const eyeArea = (lx * lx) * 4.0 + (ly * ly) * verticalSqueeze; 
        
        let chanVal = 0;

        if (eyeArea < 1.0) {
          if (eyeArea > 0.8) {
            chanVal = 0; // Black Outline
          } 
          else if (distFromCenter < 0.08) {
            chanVal = 0; // Pupil
          }
          else if (lx > 0.02 && lx < 0.07 && ly < -0.02 && ly > -0.07) {
            chanVal = 255; // Highlight
          }
          else if (distFromCenter < 0.22) {
            // Iris (Cyan/Blue)
            if (channel === 0) chanVal = 40;
            if (channel === 1) chanVal = 180;
            if (channel === 2) chanVal = 255;
          }
          else {
            chanVal = 255; // Sclera (White)
          }
        } else {
          chanVal = 0; // Background
        }

        if (channel === 0) rOut = chanVal;
        if (channel === 1) gOut = chanVal;
        if (channel === 2) bOut = chanVal;
      }
      display.setPixel(x, y, rOut, gOut, bOut);
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
