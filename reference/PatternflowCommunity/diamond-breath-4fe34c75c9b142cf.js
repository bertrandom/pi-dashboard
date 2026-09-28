// ===== Patternflow pattern =====
// Title:    Diamond Breath
// Author:   @martinnlopez
// Date:     2026-09-01
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp oklchShort recolor 0:#000000 1:#ffffff 0.441:#fefb00 0.599:#0432ff 0.708:#00fcff 0.04:#000000 0.206:#d783ff 0.309:#ff2600
// @knobs Zoom=8..30, Breathe=0..3, Hue=0..360, Scroll=-80..80
// @matrix 64x128
// Breathing Diamond Lattice
// A woven diamond/argyle lattice (big double-outline diamonds with a small
// diamond stud at every crossing point) that slowly pulses in and out,
// like breathing.
//
// Knob 1 — Zoom:     grid cell size in pixels. Low = many small diamonds
//                     (zoomed out), high = a few large diamonds (zoomed in).
// Knob 2 — Breathe:   picks the breathing style —
//                       0–1  wave breathing (diagonal sweep)
//                       1–2  radial breathing (pulses out from center)
//                       2–3  shifting breathing (sweeps left to right)
// Knob 3 — Hue:      rotates the whole palette around the color wheel.
// Knob 4 — Scroll:   shifts the pattern up/down.
//


function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hp < 1)      { r = c; g = x; b = 0; }
  else if (hp < 2) { r = x; g = c; b = 0; }
  else if (hp < 3) { r = 0; g = c; b = x; }
  else if (hp < 4) { r = 0; g = x; b = c; }
  else if (hp < 5) { r = x; g = 0; b = c; }
  else             { r = c; g = 0; b = x; }
  const m = l - c / 2;
  return {
    r: (r + m) * 255,
    g: (g + m) * 255,
    b: (b + m) * 255
  };
}

export function setup(params) {
  params.zoom = 16;
  params.breatheMode = 0;
  params.hueDeg = 0;
  params.scrollY = 0;
}

export function update(dt, input, params) {
  const kv = input.knobValues;
  params.zoom = kv[0];
  params.breatheMode = Math.min(2, Math.max(0, Math.floor(kv[1])));
  params.hueDeg = kv[2];
  params.scrollY = kv[3];
}

export function draw(display, params, time) {
  const w = display.width;
  const h = display.height;
  const S = params.zoom;
  const mode = params.breatheMode;
  const scrollY = params.scrollY;

  const omega = 0.9;   // breathing speed (rad/s) — slow and calm
  const freq = 0.55;   // how quickly the breathing phase changes across space

  const baseHue = (1 + params.hueDeg) % 360;
  const fg = hslToRgb(baseHue, 0.42, 0.35);        // diamond line color
  const bg = hslToRgb(baseHue + 180, 0.4, 0.035);  // near-black complementary bg

  const halfW = Math.min(1.2 / S, 0.045);   // big-diamond line half-thickness
  const halfWs = Math.min(1.0 / S, 0.05);   // small-diamond line half-thickness

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const gx = x / S;
      const gy = (y + scrollY) / S;

      // --- big diamond lattice ---
      const cellX = Math.floor(gx);
      const cellY = Math.floor(gy);
      const fx = (gx - cellX) - 0.5;
      const fy = (gy - cellY) - 0.5;
      const d1 = Math.abs(fx) + Math.abs(fy); // 0 at cell center, 1 at cell corner

      // --- small diamond lattice, offset half a cell so it sits at the crossings ---
      const gx2 = gx - 0.5;
      const gy2 = gy - 0.5;
      const cellX2 = Math.floor(gx2);
      const cellY2 = Math.floor(gy2);
      const fx2 = (gx2 - cellX2) - 0.5;
      const fy2 = (gy2 - cellY2) - 0.5;
      const d2 = Math.abs(fx2) + Math.abs(fy2);

      // breathing phase, computed in screen space (so it holds still even
      // while the "scroll" knob moves the pattern underneath it)
      const ccx = (cellX + 0.5) * S;
      const ccy = (cellY + 0.5) * S - scrollY;
      let phase;
      if (mode === 0) {
        phase = (ccx + ccy) / S * freq;                        // diagonal wave
      } else if (mode === 1) {
        const ddx = ccx - w / 2, ddy = ccy - h / 2;
        phase = Math.sqrt(ddx * ddx + ddy * ddy) / S * freq;    // radial
      } else {
        phase = ccx / S * freq;                                 // left-to-right
      }
      const breathL = Math.sin(time * omega - phase);

      const ccx2 = (cellX2 + 0.5) * S;
      const ccy2 = (cellY2 + 0.5) * S - scrollY;
      let phase2;
      if (mode === 0) {
        phase2 = (ccx2 + ccy2) / S * freq;
      } else if (mode === 1) {
        const ddx2 = ccx2 - w / 2, ddy2 = ccy2 - h / 2;
        phase2 = Math.sqrt(ddx2 * ddx2 + ddy2 * ddy2) / S * freq;
      } else {
        phase2 = ccx2 / S * freq;
      }
      const breathS = Math.sin(time * omega - phase2);

      // big diamond = two thin nested rings (the double-outline look)
      const outerR = 0.46 + 0.05 * breathL;
      const innerR = outerR - 0.09;
      const dOut = Math.abs(d1 - outerR);
      const vOut = dOut < halfW ? 1 - dOut / halfW : 0;
      const dIn = Math.abs(d1 - innerR);
      const vIn = dIn < halfW ? 1 - dIn / halfW : 0;
      const largeVal = vOut > vIn ? vOut : vIn;

      // small diamond stud at each crossing point
      const rSmall = 0.16 + 0.04 * breathS;
      const dSm = Math.abs(d2 - rSmall);
      const smallVal = dSm < halfWs ? 1 - dSm / halfWs : 0;

      let inten = largeVal > smallVal ? largeVal : smallVal;
      if (inten > 1) inten = 1;

      // a soft brightness pulse that rides along with the size pulse
      const glow = 0.85 + 0.15 * ((breathL + 1) * 0.5);
      inten *= glow;
      if (inten > 1) inten = 1;

      const r = bg.r + (fg.r - bg.r) * inten;
      const g = bg.g + (fg.g - bg.g) * inten;
      const b = bg.b + (fg.b - bg.b) * inten;

      display.setPixel(x, y, r | 0, g | 0, b | 0);
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
