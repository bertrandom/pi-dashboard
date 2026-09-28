// ===== Patternflow pattern =====
// Title:    Melty Thermal Fluid Bands
// Author:   @martinnlopez
// Date:     2026-07-31
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @matrix 64x128
// @knobs Density=2..20, Flow=0.1..5, Detail=1..5, Melt=0..20
export function setup(params) {
  params.t = 0;
  params.k = [10, 1, 2, 0];
}

export function update(dt, input, params) {
  params.k = input.knobValues;
  params.t += dt * params.k[1];
}

export function draw(display, params, time) {
  const w = display.width, h = display.height;
  const density = params.k[0];
  const detail = Math.floor(params.k[2]);
  const melt = params.k[3];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Step 1: Calculate a base fluid value at this coordinate
      let v = 0;
      for (let i = 1; i <= detail; i++) {
        v += Math.sin(x * 0.05 * i + params.t) + Math.cos(y * 0.05 * i - params.t);
      }

      // Step 2: Apply the Melting effect
      // We displace the Y sampling coordinate downward based on the intensity (v)
      // This causes "hot" areas to appear to stretch and drip down the screen.
      let sampleY = y - (Math.max(0, v) * melt);
      
      // Step 3: Re-calculate value at the melted coordinate for the contours
      let mv = 0;
      for (let i = 1; i <= detail; i++) {
        mv += Math.sin(x * 0.05 * i + params.t) + Math.cos(sampleY * 0.05 * i - params.t);
      }

      // Create the sharp "band" contour lines
      const val = Math.sin(mv * density);
      const sharp = Math.pow(Math.abs(val), 12); 
      
      // Color logic: Higher heat (v) is bright red/orange, lower is blue/purple
      // Using the original 'v' for color creates a "ghostly" trail behind the melt
      let r = 0, g = 0, b = 0;
      
      if (sharp > 0.4) {
        // High thermal zones (Red to Yellow)
        if (mv > 0.5) {
          r = 255;
          g = Math.floor(100 + 155 * Math.sin(mv));
          b = 0;
        } 
        // Mid thermal zones (Blue to Magenta)
        else if (mv > -0.5) {
          r = Math.floor(128 + 127 * Math.sin(mv * 2));
          g = 0;
          b = 255;
        }
        // Cold thermal zones (Deep Blue)
        else {
          r = 0;
          g = Math.floor(50 + 50 * Math.cos(mv));
          b = Math.floor(150 + 105 * Math.abs(val));
        }
      }

      // Add a slight brightness boost based on vertical position to emphasize the "drip"
      const fade = Math.min(1, (y / h) + 0.5);
      
      display.setPixel(x, y, r * fade, g * fade, b * fade);
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
