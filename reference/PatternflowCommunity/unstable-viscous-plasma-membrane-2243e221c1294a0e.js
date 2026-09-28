// ===== Patternflow pattern =====
// Title:    Unstable Viscous Plasma Membrane
// Author:   @martinnlopez
// Date:     2026-07-31
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @matrix 64x128
// @knobs Ooze=1..20, Speed=0.2..5, Zoom=0.5..3, Unstable=0..5
export function setup(params) {
  params.t = 0;
  params.k = [10, 1, 1, 0];
}

export function update(dt, input, params) {
  params.k = input.knobValues;
  // Speed is modified by the "Unstable" knob to create jittery flow
  const jitter = (Math.random() - 0.5) * params.k[3] * 0.1;
  params.t += dt * (params.k[1] + jitter);
}

export function draw(display, params, time) {
  const w = display.width, h = display.height;
  const zoom = params.k[2];
  const ooze = params.k[0];
  const unstable = params.k[3];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Normalized coordinates
      let nx = (x / w - 0.5) * zoom;
      let ny = (y / h - 0.5) * zoom;

      // Knob 4: Random Ooze Effect (Spatial Jitter)
      // This adds high-frequency "boiling" noise to the coordinates
      if (unstable > 0) {
        const noise = Math.sin(x * 1.5 + y * 1.5 + params.t * 10) * unstable * 0.02;
        nx += noise;
        ny += noise;
      }

      // Knob 1: Heavy Ooze (Layered Domain Warping)
      // We displace the coordinates by a function of the coordinates themselves
      const dx = Math.sin(ny * ooze * 0.5 + params.t) * (ooze * 0.1);
      const dy = Math.cos(nx * ooze * 0.5 - params.t) * (ooze * 0.1);
      
      // Secondary warp for extra "viscosity"
      const v = Math.sin((nx + dx) * 4) * Math.cos((ny + dy) * 4 + dx);
      
      // Posterized color mapping to create thick fluid boundaries
      let r = 0, g = 0, b = 0;
      
      // We use the absolute value to create "ring" edges
      const edge = Math.abs(v);
      
      if (edge > 0.8) {
        // Thick "Hot" tendrils
        r = 255; g = 30; b = 100; 
      } else if (edge > 0.4) {
        // Electric blue fill
        r = 30; g = 100; b = 255;
      } else if (edge > 0.1) {
        // Deep purple transition
        r = 100; g = 0; b = 200;
      } else {
        // Negative space/Void
        r = 0; g = 0; b = 0;
      }

      // Final brightening of the "hot" spots
      display.setPixel(x, y, r, g, b);
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
