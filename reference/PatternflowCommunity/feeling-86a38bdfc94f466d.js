// ===== Patternflow pattern =====
// Title:    Feeling
// Author:   @engmung
// Date:     2026-08-31
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp oklchLong 0.116:#d72d47 1:#858585 0.443:#000000 0:#000000 0.044:#00b3ff
// @knobs BreakBifur=0.04..0.059, Tension=0.8..1.3, StressGain=0.5..2, FractureFade=0.96..0.98
// @matrix 64x128

// critical knob = BreakBifur, turning it crosses smooth curling spirals ↔ explosive crackling filament breakup
// Knob 1 (BreakBifur): Barkley excitability 'b' parameter (Btn 1 resets field)
// Knob 2 (Tension): Elastic wavefront deformation & time step
// Knob 3 (StressGain): Gain on spatial curvature stress / crack tensor
// Knob 4 (FractureFade): Phosphor memory decay of structural fracture lines

export function setup(params) {
  params.W = 64;
  params.H = 128;
  const N = params.W * params.H;

  params.u = new Float32Array(N);
  params.v = new Float32Array(N);
  params.uNext = new Float32Array(N);
  params.vNext = new Float32Array(N);
  params.stress = new Float32Array(N);

  params.t = 0;
  params.seed = 109283;

  params.rnd = function() {
    params.seed = (params.seed * 1664525 + 1013904223) >>> 0;
    return params.seed / 4294967296;
  };

  params.reseed = function() {
    const W = params.W;
    const H = params.H;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = y * W + x;
        const ny = y / H;
        const nx = x / W;
        const wave = Math.sin(ny * 18.84 + nx * 6.28) * Math.cos(nx * 12.56);
        params.u[idx] = wave > 0.3 ? 0.95 : 0.0;
        params.v[idx] = (ny > 0.4 && ny < 0.8) ? 0.4 : 0.0;
        params.stress[idx] = 0.0;
      }
    }
  };

  params.reseed();
}

export function update(dt, input, params) {
  params.t += Math.min(dt, 0.1);

  if (input.btnPressed && input.btnPressed[0]) {
    params.reseed();
    return;
  }

  const kv = input.knobValues;
  const b = kv[0];
  const tension = kv[1];
  const stressGain = kv[2];
  const fade = kv[3];

  const a = 0.75;
  const eps = 0.02;
  const dtSim = 0.32 * tension;
  const Du = 0.38;

  const W = params.W;
  const H = params.H;
  const u = params.u;
  const v = params.v;
  const uNext = params.uNext;
  const vNext = params.vNext;
  const stress = params.stress;

  for (let y = 0; y < H; y++) {
    const ym1 = (y === 0 ? H - 1 : y - 1) * W;
    const y0 = y * W;
    const yp1 = (y === H - 1 ? 0 : y + 1) * W;

    for (let x = 0; x < W; x++) {
      const xm1 = x === 0 ? W - 1 : x - 1;
      const xp1 = x === W - 1 ? 0 : x + 1;
      const idx = y0 + x;

      const uVal = u[idx];
      const vVal = v[idx];

      const lapU = u[y0 + xm1] + u[y0 + xp1] + u[ym1 + x] + u[yp1 + x] - 4.0 * uVal;
      const f = (uVal * (1.0 - uVal) * (uVal - (vVal + b) / a)) / eps;
      const g = uVal - vVal;

      let uN = uVal + dtSim * (f + Du * lapU);
      let vN = vVal + dtSim * g;

      if (!isFinite(uN) || !isFinite(vN)) {
        params.reseed();
        return;
      }

      uNext[idx] = uN < 0.0 ? 0.0 : (uN > 1.0 ? 1.0 : uN);
      vNext[idx] = vN < 0.0 ? 0.0 : (vN > 1.0 ? 1.0 : vN);

      // Curvature stress: Laplacian modulated by gradient magnitude
      const dx = (u[y0 + xp1] - u[y0 + xm1]) * 0.5;
      const dy = (u[yp1 + x] - u[ym1 + x]) * 0.5;
      const gradSq = dx * dx + dy * dy;
      const localStress = Math.abs(lapU) * Math.sqrt(gradSq) * 12.0;

      stress[idx] = stress[idx] * fade + localStress * (1.0 - fade);
    }
  }

  u.set(uNext);
  v.set(vNext);
  params.stressGain = stressGain;
}

export function draw(display, params, time) {
  const W = params.W;
  const H = params.H;
  const u = params.u;
  const stress = params.stress;
  const gain = params.stressGain || 2.0;

  for (let y = 0; y < H; y++) {
    const row = y * W;
    for (let x = 0; x < W; x++) {
      const idx = row + x;
      // High-contrast electric fracture render
      let val = u[idx] * 0.3 + stress[idx] * gain * 0.8;
      val = val < 0.0 ? 0.0 : (val > 1.0 ? 1.0 : val);
      display.setValue(x, y, val * val * (3.0 - 2.0 * val));
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
