// ===== Patternflow pattern =====
// Title:    DefectStorm
// Author:   @engmung
// Based on: "Defect Storm" by @engmung — https://patternflow.work/community/p/d9ffc906a89847a5
// Date:     2026-08-10
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp oklchShort 0:#ff42c3 1:#4c00ff 0.621:#000000
// @knobs Alpha=0..1.8, Beta=-1..0, Pace=1..6, Core=0.6..3
// @matrix 64x128





// Knobs: Alpha, Beta = the CGL equation's own coefficients — LIVE.
//                      When 1 + Alpha*Beta > 0: calm rotating wave stripes.
//                      Cross below zero: spiral breakup, defect turbulence.
//        Pace = integration steps per frame
//        Core = defect-core darkness emphasis
// Button: btn1 = reseed the field with fresh noise
// Dark dots are real topological defects (zero-amplitude phase singularities).

export function setup(params) {
  params.ar = null;
  params.W = 0; params.H = 0;
  params.seed = 60221;
  params.reseed = true;
}

function rnd(p) { p.seed = (p.seed * 1664525 + 1013904223) >>> 0; return p.seed / 4294967296; }

export function update(dt, input, params) {
  if (input.btnPressed[0]) params.reseed = true;
}

export function draw(display, params, time) {
  const W = display.width, H = display.height;
  if (!params.ar || params.W !== W || params.H !== H) {
    params.ar = new Float32Array(W * H);
    params.ai = new Float32Array(W * H);
    params.br = new Float32Array(W * H);
    params.bi = new Float32Array(W * H);
    params.W = W; params.H = H;
    params.reseed = true;
  }
  const k = params.knobValues || [1.6, -1.4, 2, 1.5];
  const al = k[0], be = k[1];
  const steps = Math.max(1, Math.round(k[2]));
  const core = k[3];
  let ar = params.ar, ai = params.ai, br = params.br, bi = params.bi;
  const len = W * H;

  if (params.reseed) {
    for (let i = 0; i < len; i++) {
      ar[i] = (rnd(params) - 0.5) * 0.4;
      ai[i] = (rnd(params) - 0.5) * 0.4;
    }
    params.reseed = false;
  }

  const dt = 0.06;
  for (let s = 0; s < steps; s++) {
    for (let y = 0; y < H; y++) {
      const row = y * W;
      const up = (y > 0 ? y - 1 : H - 1) * W;
      const dn = (y < H - 1 ? y + 1 : 0) * W;
      for (let x = 0; x < W; x++) {
        const i = row + x;
        const xl = row + (x > 0 ? x - 1 : W - 1);
        const xr = row + (x < W - 1 ? x + 1 : 0);
        const cr = ar[i], ci = ai[i];
        const lr = ar[xl] + ar[xr] + ar[up + x] + ar[dn + x] - 4 * cr;
        const li = ai[xl] + ai[xr] + ai[up + x] + ai[dn + x] - 4 * ci;
        const r2 = cr * cr + ci * ci;
        br[i] = cr + dt * (cr + (lr - al * li) - r2 * (cr - be * ci));
        bi[i] = ci + dt * (ci + (li + al * lr) - r2 * (ci + be * cr));
      }
    }
    const t1 = ar; ar = br; br = t1;
    const t2 = ai; ai = bi; bi = t2;
  }
  params.ar = ar; params.ai = ai; params.br = br; params.bi = bi;

  for (let y = 0, i = 0; y < H; y++) {
    for (let x = 0; x < W; x++, i++) {
      const cr = ar[i], ci = ai[i];
      const amp = Math.sqrt(cr * cr + ci * ci);
      let m = amp * core; if (m > 1) m = 1;
      const ph = amp > 0.001 ? cr / amp : 0;
      const v = (0.5 + 0.5 * ph) * m;
      display.setValue(x, y, v);
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
