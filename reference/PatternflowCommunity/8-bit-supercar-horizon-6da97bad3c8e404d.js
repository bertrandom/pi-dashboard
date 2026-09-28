// ===== Patternflow pattern =====
// Title:    8-Bit Supercar Horizon
// Author:   @martinnlopez
// Date:     2026-08-06
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @matrix 64x128
// @knobs Steering=0..1, Speed=0.1..10, DayNight=0..1, HueShift=0..1
export function setup(params) {
  params.t = 0;
  params.k = [0.5, 2, 0, 0];
}

export function update(dt, input, params) {
  params.k = input.knobValues;
  params.t += dt * params.k[1] * 5;
}

function applyHue(r, g, b, h) {
  if (h === 0) return [r, g, b];
  const a = h * 6.28;
  const c = Math.cos(a), s = Math.sin(a);
  const nr = (.299 + .701 * c + .168 * s) * r + (.587 - .587 * c + .330 * s) * g + (.114 - .114 * c - .497 * s) * b;
  const ng = (.299 - .299 * c - .328 * s) * r + (.587 + .413 * c + .035 * s) * g + (.114 - .114 * c + .292 * s) * b;
  const nb = (.299 - .3 * c + 1.25 * s) * r + (.587 - .588 * c - 1.05 * s) * g + (.114 + .886 * c - .203 * s) * b;
  return [Math.max(0, Math.min(255, nr)), Math.max(0, Math.min(255, ng)), Math.max(0, Math.min(255, nb))];
}

export function draw(display, params, time) {
  const w = display.width, h = display.height;
  const horizon = 48; 
  const timeOfDay = params.k[2]; 
  const hueShift = params.k[3];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0;

      if (y < horizon) {
        // --- SKY ---
        const rSky = (1 - timeOfDay) * (255 - y * 3) + (timeOfDay * 5);
        const gSky = (1 - timeOfDay) * (80 - y) + (timeOfDay * 5);
        const bSky = (1 - timeOfDay) * (40) + (timeOfDay * (30 - y / 2));
        r = rSky; g = gSky; b = bSky;

        if (timeOfDay > 0.6 && Math.sin(x * 543 + y * 123) > 0.998) {
           r = g = b = 255 * (Math.sin(time * 5 + x) * 0.5 + 0.5);
        }

        // --- CITY ---
        const bx = Math.floor(x / 5) * 5;
        const bH = Math.abs(Math.sin(bx * 0.7)) * 18 + 4;
        if (y > (horizon - bH)) {
          const win = Math.sin(x * 1.1 + y * 0.6);
          if (timeOfDay > 0.5 && win > 0.96) { r = 255; g = 240; b = 150; }
          else { r = 15; g = 10; b = 25; }
        }
      } else {
        // --- WIDE ROAD ---
        const fy = (y - horizon) / (h - horizon);
        const depth = 1.0 / (fy + 0.04);
        // Widened road calculation
        const roadW = fy * w * 1.6; 
        const roadX = w / 2 - roadW / 2;

        if (x > roadX && x < roadX + roadW) {
          const z = depth + params.t;
          const stripe = Math.sin(z * 1.2) > 0;
          const centerL = Math.abs(x - w / 2) < (fy * 3) && Math.sin(z * 2.5) > 0;

          if (centerL) { r = 255; g = 255; b = 255; }
          else { r = g = b = stripe ? 65 : 55; }
          
          // Red/White shoulders
          if (x < roadX + (fy * 8) || x > roadX + roadW - (fy * 8)) {
             const side = Math.sin(z * 2.5) > 0;
             r = 255; g = side ? 20 : 255; b = side ? 20 : 255;
          }
        } else {
          // Grass
          const gZ = Math.sin(depth * 1.8 + params.t) > 0;
          r = 10; g = gZ ? 70 : 50; b = 20;
        }
      }

      // --- SUPERCAR SPRITE (Rear View) ---
      const carX = Math.floor(w * 0.15 + params.k[0] * (w * 0.7));
      const carY = 112;
      const dx = x - carX;
      const dy = y - carY;

      // Aventador-style dimensions (Width: 26, Height: 12)
      if (Math.abs(dx) < 13 && dy >= 0 && dy < 12) {
        const adx = Math.abs(dx);
        // Body (Orange/Yellow)
        r = 255; g = 140; b = 0; 
        
        // Roof & Engine Slats
        if (dy < 4 && adx < 8) {
          const slat = (dy % 2 === 0);
          r = slat ? 30 : 230; g = slat ? 30 : 120; b = slat ? 30 : 0;
        }
        // Taillights (Y-shape red)
        if (dy >= 4 && dy <= 6 && adx > 7 && adx < 12) {
          r = 255; g = 0; b = 0;
        }
        // Rear Vents & Diffuser (Black)
        if (dy >= 7) {
          r = 20; g = 20; b = 25;
          // License plate
          if (dy == 8 && adx < 3) { r = 240; g = 240; b = 240; }
          // Exhaust (Center)
          if (dy == 9 && adx < 4 && adx > 1) { r = 100; g = 100; b = 100; }
        }
        // Windshield side mirrors
        if (dy == 3 && adx > 10) { r = 255; g = 140; b = 0; }
        // Tires
        if (dy >= 10 && adx > 9) { r = 10; g = 10; b = 10; }
      }

      const final = applyHue(r, g, b, hueShift);
      display.setPixel(x, y, final[0], final[1], final[2]);
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
