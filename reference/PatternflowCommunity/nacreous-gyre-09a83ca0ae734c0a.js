// ===== Patternflow pattern =====
// Title:    Nacreous Gyre
// Author:   @martinnlopez
// Date:     2026-09-09
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @knobs Swirl=1..5, FlowSpeed=0.05..5, Filaments=1..5, Grain=0.5..2
// @matrix 64x128


const BAYER4 = [
   0,  8,  2, 10,
  12,  4, 14,  6,
   3, 11,  1,  9,
  15,  7, 13,  5
];

export function setup(params) {
  params.t = 0;
  params.k = [2.2, 0.25, 2.5, 1.1];
}

export function update(dt, input, params) {
  params.k = input.knobValues;
  // Slow, meditative fluid evolution
  params.t += dt * params.k[1] * 0.35;
}

export function draw(display, params, time) {
  const w = display.width;
  const h = display.height;
  const t = params.t;

  const swirlTightness = params.k[0];
  const filFreq = params.k[2];
  const grainContrast = params.k[3];

  // Off-center vortex eye matching the reference artwork (roughly right-of-center)
  const eyeX = w * 0.68;
  const eyeY = h * 0.50;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // 1. Normalized space relative to the vortex eye
      const dx = (x - eyeX) / (w * 0.45);
      const dy = (y - eyeY) / (h * 0.45);
      const r = Math.sqrt(dx * dx + dy * dy);
      const theta = Math.atan2(dy, dx);

      // 2. Swirling Log-Spiral Coordinate Field
      // Ribbons accelerate and coil as they approach the center
      const swirlTheta = theta + (swirlTightness / (r + 0.35)) - t * 0.3;

      // 3. Wispy Silk Filaments (Layered directional wave harmonics)
      const p1 = Math.sin(dx * 3.5 + Math.sin(dy * 4.5 + t * 0.4) * 1.8);
      const p2 = Math.cos(dy * 3.5 + Math.cos(dx * 4.5 - t * 0.3) * 1.8);

      const wisp1 = Math.sin(swirlTheta * 3.0 + r * (4.0 * filFreq) + p1 * 1.2 + t * 0.2);
      const wisp2 = Math.cos(swirlTheta * 5.0 - r * (7.0 * filFreq) + p2 * 1.5 - t * 0.15);
      const wisp3 = Math.sin((dx + dy) * (2.5 * filFreq) + wisp1 * 1.4);

      // Composite fluid flow scalar
      const flow = (wisp1 * 0.5 + wisp2 * 0.35 + wisp3 * 0.25);

      // 4. White Vortex Eye Core (the clean, glowing opening in the image)
      const ovalDist = Math.sqrt(dx * dx * 1.3 + dy * dy * 0.9);
      const eyeCore = Math.exp(-Math.pow(ovalDist / 0.28, 4.0));

      // 5. Iridescent Spectral Color Mapping (Exact palette sequence from reference)
      // Cycle: Golden Amber -> Coral Pink -> Hot Magenta -> Deep Violet -> Ultramarine -> Cyan -> Lime Green
      let spec = ((swirlTheta * 0.45 + flow * 0.38 + r * 0.55 + t * 0.08) % 1.0 + 1.0) % 1.0;

      let rInk = 0, gInk = 0, bInk = 0;
      if (spec < 0.20) {
        // Golden Amber -> Bright Coral Orange
        const f = spec / 0.20;
        rInk = 255;
        gInk = Math.floor(165 - f * 90);
        bInk = Math.floor(20 + f * 25);
      } else if (spec < 0.45) {
        // Coral Pink -> Hot Magenta -> Deep Violet
        const f = (spec - 0.20) / 0.25;
        rInk = Math.floor(245 - f * 125);
        gInk = Math.floor(30 + f * 15);
        bInk = Math.floor(160 + f * 75);
      } else if (spec < 0.68) {
        // Deep Violet / Ultramarine -> Electric Cyan
        const f = (spec - 0.45) / 0.23;
        rInk = Math.floor(30 + f * 10);
        gInk = Math.floor(70 + f * 135);
        bInk = Math.floor(235 + f * 20);
      } else if (spec < 0.88) {
        // Electric Cyan -> Emerald / Lime Green
        const f = (spec - 0.68) / 0.20;
        rInk = Math.floor(40 + f * 130);
        gInk = Math.floor(205 + f * 35);
        bInk = Math.floor(245 - f * 195);
      } else {
        // Lime Green -> Soft Lemon -> Golden Amber
        const f = (spec - 0.88) / 0.12;
        rInk = Math.floor(170 + f * 85);
        gInk = Math.floor(240 - f * 75);
        bInk = Math.floor(50 - f * 30);
      }

      // 6. Filament Density & Thread Masking
      // Sharp, hair-like ridges layered on top of delicate color washes
      const ridge = 1.0 - Math.abs(flow);
      const density = Math.pow(ridge, 1.4) * (1.0 - eyeCore);

      // 7. Multi-Plate Halftone / Stipple Dither Screen
      // Slightly rotated offsets simulate multi-color lithographic print registration
      const ditherR = BAYER4[(y & 3) * 4 + (x & 3)] / 16.0;
      const ditherG = BAYER4[((y + 1) & 3) * 4 + ((x + 2) & 3)] / 16.0;
      const ditherB = BAYER4[((y + 2) & 3) * 4 + ((x + 1) & 3)] / 16.0;

      // Clean off-white paper canvas background
      const paperR = 252, paperG = 250, paperB = 254;

      // Effective ink coverage per channel modulated by the filament density
      const covR = Math.max(0, Math.min(1, (1.0 - (rInk / 255)) * density * grainContrast));
      const covG = Math.max(0, Math.min(1, (1.0 - (gInk / 255)) * density * grainContrast));
      const covB = Math.max(0, Math.min(1, (1.0 - (bInk / 255)) * density * grainContrast));

      // Subtractive stipple deposition
      const finalR = (covR < ditherR) ? paperR : rInk;
      const finalG = (covG < ditherG) ? paperG : gInk;
      const finalB = (covB < ditherB) ? paperB : bInk;

      // Center eye shines as pure luminous white void
      if (eyeCore > 0.05) {
        const glow = Math.min(1.0, eyeCore * 1.5);
        display.setPixel(
          x, y,
          Math.floor(finalR * (1.0 - glow) + 255 * glow),
          Math.floor(finalG * (1.0 - glow) + 255 * glow),
          Math.floor(finalB * (1.0 - glow) + 255 * glow)
        );
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
