// ===== Patternflow pattern =====
// Title:    forAudioIntro
// Author:   @engmung
// Date:     2026-09-06
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @knobs Breath=0..1, Spin=0..3, Color=0..1, Petals=3..9
// @matrix 64x128
// Bloom — layered petals, inner layer always on top. LOW: petals open  MID: spin speed  HIGH: grey → colour  Knob4: petal count
// No smoothing: every knob value is used the frame it arrives.



export function setup(params) {
  params.t = 0; params.rot = 0;
  params.w = 0; params.ang = null; params.rad = null;
  params.tables = function (w, h) {
    const ang = new Float32Array(w * h), rad = new Float32Array(w * h), cx = (w - 1) / 2, cy = (h - 1) / 2;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const dx = x - cx, dy = y - cy, i = y * w + x;
      ang[i] = Math.atan2(dy, dx);
      rad[i] = Math.sqrt(dx * dx + dy * dy);
    }
    params.ang = ang; params.rad = rad; params.w = w;
  };
  params.rgb = [0, 0, 0];
  params.hue = function (hue, o) {
    const h6 = (hue - Math.floor(hue)) * 6, i = Math.floor(h6), f = h6 - i;
    if (i === 0) { o[0] = 1; o[1] = f; o[2] = 0; } else if (i === 1) { o[0] = 1 - f; o[1] = 1; o[2] = 0; }
    else if (i === 2) { o[0] = 0; o[1] = 1; o[2] = f; } else if (i === 3) { o[0] = 0; o[1] = 1 - f; o[2] = 1; }
    else if (i === 4) { o[0] = f; o[1] = 0; o[2] = 1; } else { o[0] = 1; o[1] = 0; o[2] = 1 - f; }
  };
}

export function update(dt, input, params) {
  if (dt > 0.1) dt = 0.1;
  params.t += dt;
  const k = input.knobValues || [0.5, 0.5, 0.5, 5];
  params.breath = k[0];
  params.rot += dt * (0.1 + 5 * k[1] * k[1]);
  params.sat = k[2];
  params.n = Math.round(k[3]);
}

export function draw(display, params, time) {
  const w = display.width, h = display.height;
  if (params.w !== w) params.tables(w, h);
  const ang = params.ang, rad = params.rad, rot = params.rot, n = params.n, rgb = params.rgb;
  const br = params.breath === undefined ? 0.5 : params.breath;
  const sat = params.sat === undefined ? 0.5 : params.sat;
  const open = w * (0.28 + 0.5 * br);
  const scale = [1.0, 0.68, 0.4];
  const off = [0, 0.5, 1.0];

  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, a = ang[i], r = rad[i];
    let R = 0, G = 0, B = 0;
    for (let L = 0; L < 3; L++) {
      const petal = 0.5 + 0.5 * Math.cos((a + rot * (1 - 0.3 * L) + off[L]) * n);
      const edge = open * scale[L] * (0.5 + 0.5 * petal);
      let c = (edge - r) * 0.5 + 0.5;
      if (c <= 0) continue;
      if (c > 1) c = 1;
      const lum = 1 - 0.35 * (r / (edge + 1));          // 1 at the centre, ~0.65 at the petal edge
      params.hue(L * 0.3 + a / 6.283 + rot * 0.05, rgb);
      const cr = lum * (1 + sat * (rgb[0] - 1)), cg = lum * (1 + sat * (rgb[1] - 1)), cb = lum * (1 + sat * (rgb[2] - 1));
      R += (cr - R) * c; G += (cg - G) * c; B += (cb - B) * c;
    }
    display.setPixel(x, y, R * 255, G * 255, B * 255);
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
