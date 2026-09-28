// ===== Patternflow pattern =====
// Title:    ChladniPlasma
// Author:   @engmung
// Date:     2026-08-15
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp oklab 1:#000000 0:#ffffff
// @knobs Nonlin=1.45..1.98, Harmonic=1..3, ModeRatio=1..2.8, Speed=0.2..4
// @matrix 64x128


// critical knob = Nonlin, turning it crosses pristine sacred Chladni geometry <-> intermittent defect cracks <-> boiling acoustic plasma

export function setup(params) {
  params.w = 64;
  params.h = 128;
  params.t = 0;
  params.simAcc = 0;
  params.seed = 391824;

  const w = params.w;

  // 1D CML Ring state history
  params.xC = new Float32Array(w);
  params.xP1 = new Float32Array(w);
  params.xP2 = new Float32Array(w);
  params.xN = new Float32Array(w);
  params.fx = new Float32Array(w);
  params.rMetric = new Float32Array(w);

  params.ampEma = 0.5;

  params.rng = function () {
    params.seed = (params.seed * 1664525 + 1013904223) | 0;
    return (params.seed >>> 0) / 4294967296;
  };

  params.reseed = function () {
    for (let i = 0; i < w; i++) {
      const r = (params.rng() - 0.5) * 1.8;
      params.xC[i] = r;
      params.xP1[i] = 1.0 - 1.7 * r * r;
      params.xP2[i] = 1.0 - 1.7 * params.xP1[i] * params.xP1[i];
    }
  };

  params.stepCML = function (a, eps) {
    const xc = params.xC;
    const xp1 = params.xP1;
    const xn = params.xN;
    const fx = params.fx;

    for (let i = 0; i < w; i++) {
      const v = xc[i];
      if (!Number.isFinite(v) || Math.abs(v) > 2.2) {
        params.reseed();
        return;
      }
      fx[i] = 1.0 - a * v * v;
    }

    const halfEps = eps * 0.5;
    const centerWeight = 1.0 - eps;
    for (let i = 0; i < w; i++) {
      const left = i === 0 ? fx[w - 1] : fx[i - 1];
      const right = i === w - 1 ? fx[0] : fx[i + 1];
      xn[i] = centerWeight * fx[i] + halfEps * (left + right);
    }

    // Spatiotemporal recurrence distance metric |x(t) - x(t-2)|
    for (let i = 0; i < w; i++) {
      params.rMetric[i] = Math.abs(xn[i] - xp1[i]);
    }

    for (let i = 0; i < w; i++) {
      params.xP2[i] = params.xP1[i];
      params.xP1[i] = params.xC[i];
      params.xC[i] = xn[i];
    }
  };

  params.reseed();
  for (let s = 0; s < 180; s++) {
    params.stepCML(1.72, 0.28);
  }
}

// Knob 1: Nonlin (Bifurcation parameter a - controls laminar stability vs defect cascades)
// Knob 2: Harmonic (Fundamental acoustic nodal mode frequency: 1.0 to 3.0)
// Knob 3: ModeRatio (Modal frequency ratio k2/k1 - morphs nodal symmetry from square to harmonic lace)
// Knob 4: Speed (Animation phase drift and kinetic turbulence propagation rate)
export function update(dt, input, params) {
  const safeDt = Math.min(dt, 0.1);

  const a = input.knobValues[0];
  const harmonic = input.knobValues[1];
  const modeRatio = input.knobValues[2];
  const speed = input.knobValues[3];

  params.harmonic = harmonic;
  params.modeRatio = modeRatio;
  params.speed = speed;

  // Kinetic phase clock driven by Speed
  params.t += safeDt * speed;

  // Autonomous breathing modulation on coupling
  const dynCoupling = 0.28 + 0.08 * Math.sin(params.t * 0.43);

  params.simAcc += safeDt * 32 * speed;
  const maxSteps = 5;
  let steps = 0;
  while (params.simAcc >= 1.0 && steps < maxSteps) {
    params.stepCML(a, dynCoupling);
    params.simAcc -= 1.0;
    steps++;
  }
  if (params.simAcc > 1.0) params.simAcc = 0;
}

export function draw(display, params, time) {
  const w = display.width;
  const h = display.height;
  const rM = params.rMetric;
  const harm = params.harmonic || 2.0;
  const ratio = params.modeRatio || 1.618;
  const frac = 0.15; // Fixed fracture constant

  // Adaptive amplitude normalization
  let maxV = 0.001;
  for (let i = 0; i < w; i += 2) {
    if (rM[i] > maxV) maxV = rM[i];
  }
  params.ampEma = params.ampEma * 0.92 + maxV * 0.08;
  const norm = 1.0 / Math.max(params.ampEma, 0.04);

  const tPhase = params.t * 0.9;
  const k1 = harm * Math.PI;
  const k2 = (harm * ratio) * Math.PI;

  for (let y = 0; y < h; y++) {
    const ny = (y / h) * 2.0 - 1.0;
    const yIdx = y % w;
    const localR = rM[yIdx] * norm;

    for (let x = 0; x < w; x++) {
      const nx = (x / w) * 2.0 - 1.0;
      const rVal = rM[x] * norm;

      // CML recurrence acts as an acoustic defect field with fixed 0.15 fracture tearing
      const phaseDistort = (rVal - localR) * frac * 2.5;

      // 2D Chladni standing wave field
      const w1 = Math.sin(k1 * nx + phaseDistort + tPhase) * Math.cos(k2 * ny - tPhase);
      const w2 = Math.cos(k2 * nx - phaseDistort) * Math.sin(k1 * ny + tPhase * 0.6);
      const cymaticField = w1 - w2;

      // Fixed 1.0 NodalGain (zero-crossings as crisp ridges)
      const nodalLine = 1.0 - Math.min(1.0, Math.abs(cymaticField) * 1.0);
      const defectGleam = Math.pow(rVal, 2.0) * frac * 0.6;

      let v = nodalLine + defectGleam;
      v = Math.max(0.0, Math.min(1.0, v));
      v = v * v * (3.0 - 2.0 * v); // smoothstep

      display.setValue(x, y, v);
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
