// ===== Patternflow pattern =====
// Title:    Strange Ink
// Author:   @engmung
// Date:     2026-08-05
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp linear 0.036:#000000 0.27:#ff0000 0.129:#0062ff
// @matrix 64x128
// @knobs Morph=0..2, Ink=500..6000, Fade=0.80..0.975, Warp=0.6..2.2

// Knobs: Morph = how far/fast the attractor coefficients breathe
//        Ink   = points traced per frame (line weight / density)
//        Fade  = ink persistence: crisp wire vs deep smoky wash
//        Warp  = coefficient scale -> whole different attractor families
// Button: btn1 = jump to a fresh parameter basin

export function setup(params) {
  params.buf = null; params.W = 0; params.H = 0;
  params.px = 0.1; params.py = 0.0;
  params.ph = new Float64Array([0.7, 2.1, 4.4, 1.3]);
  params.seed = 2718;
  params.jump = false;
}

function rnd(p) { p.seed = (p.seed * 1664525 + 1013904223) >>> 0; return p.seed / 4294967296; }

export function update(dt, input, params) {
  if (input.btnPressed[0]) params.jump = true;
}

export function draw(display, params, time) {
  const W = display.width, H = display.height;
  if (!params.buf || params.W !== W || params.H !== H) {
    params.buf = new Float32Array(W * H);
    params.W = W; params.H = H;
  }
  const k = params.knobValues || [0.25, 3000, 0.9, 1.4];
  const m = k[0];
  const n = Math.max(100, Math.round(k[1]));
  const fade = k[2];
  const warp = k[3];
  const buf = params.buf;
  const len = W * H;

  if (params.jump) {
    for (let i = 0; i < 4; i++) params.ph[i] = rnd(params) * 6.28318;
    params.px = rnd(params) - 0.5; params.py = rnd(params) - 0.5;
    params.jump = false;
  }
  const ph = params.ph;
  const a = -1.4 * warp + 0.9 * m * Math.sin(time * 0.47 + ph[0]);
  const b =  1.6 * warp + 0.9 * m * Math.sin(time * 0.36 + ph[1]);
  const c =  1.05 + 0.7 * m * Math.sin(time * 0.29 + ph[2]);
  const d =  0.74 + 0.7 * m * Math.sin(time * 0.53 + ph[3]);

  for (let i = 0; i < len; i++) buf[i] *= fade;

  // attractor is rotated 90deg: its x-axis runs down the tall frame
  const cx = W * 0.5, cy = H * 0.5;
  const sx = (W * 0.5 - 1) / 2.6, sy = (H * 0.5 - 1) / 2.6;
  let px = params.px, py = params.py;

  for (let j = 0; j < n; j++) {
    const nx = Math.sin(a * py) + c * Math.cos(a * px);
    const ny = Math.sin(b * px) + d * Math.cos(b * py);
    if (Math.abs(nx - px) + Math.abs(ny - py) < 0.002) {
      px = nx + (rnd(params) - 0.5) * 0.2;
      py = ny + (rnd(params) - 0.5) * 0.2;
      continue;
    }
    px = nx; py = ny;
    const ix = (cx + py * sx) | 0;
    const iy = (cy + px * sy) | 0;
    if (ix >= 0 && ix < W && iy >= 0 && iy < H) {
      const idx = iy * W + ix;
      const v = buf[idx] + 0.22;
      buf[idx] = v > 1 ? 1 : v;
    }
  }
  params.px = px; params.py = py;

  for (let y = 0, i = 0; y < H; y++) {
    for (let x = 0; x < W; x++, i++) {
      const t = buf[i];
      let v = t * t * (3 - 2 * t) * 1.15;
      display.setValue(x, y, v > 1 ? 1 : v);
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
