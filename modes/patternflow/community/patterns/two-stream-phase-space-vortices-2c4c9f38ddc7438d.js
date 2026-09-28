// ===== Patternflow pattern =====
// Title:    Two-stream phase-space vortices
// Author:   @engmung
// Date:     2026-09-06
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp oklchShort 0:#000000 0.717:#71dbfe 0.342:#545454 0.495:#ffffff 0.557:#fbff00 0.88:#000000
// @knobs AspectScale=0.3..3, SimSpeed=0.4..8, CoreEccentrici=0.2..2.5, Persistence=0.75..0.96
// @matrix 128x128

// critical knob = AspectScale (Knob 1), turning it crosses flattened horizontal discs ↔ tall stretched vertical blade vortices

function stepPicAspect(params, simDt, aspect, ecc, persistence) {
  const w = 128;
  const h = 128;
  const N = params.nParticles;
  const py = params.py;
  const pv = params.pv;
  const rho = params.rho;
  const efield = params.efield;
  const pBuf = params.phaseBuf;

  for (let y = 0; y < h; y++) rho[y] = 0.0;

  const qScale = 128.0 / N;
  for (let i = 0; i < N; i++) {
    let y = py[i];
    if (!Number.isFinite(y)) {
      params.initParticle(i);
      y = py[i];
    }
    const y0 = Math.floor(y);
    const fy = y - y0;
    const idx0 = (y0 % h + h) % h;
    const idx1 = (idx0 + 1) % h;
    rho[idx0] += (1.0 - fy) * qScale;
    rho[idx1] += fy * qScale;
  }

  let sumRho = 0.0;
  for (let y = 0; y < h; y++) sumRho += rho[y];
  const meanRho = sumRho / h;

  let accum = 0.0;
  let eSum = 0.0;
  for (let y = 0; y < h; y++) {
    accum += (rho[y] - meanRho) * 1.7 * ecc;
    efield[y] = accum;
    eSum += accum;
  }
  const meanE = eSum / h;
  for (let y = 0; y < h; y++) efield[y] -= meanE;

  const len = w * h;
  for (let i = 0; i < len; i++) pBuf[i] *= persistence;

  // AspectScale을 적용한 속도(X축) 스케일 계산
  const vMax = params.vMax * Math.max(0.2, aspect);
  const vToX = (w - 1) / (2.0 * vMax);

  for (let i = 0; i < N; i++) {
    if (params.rnd() < 0.0035) params.initParticle(i);

    let y = py[i];
    let v = pv[i];

    const y0 = Math.floor(y);
    const fy = y - y0;
    const idx0 = (y0 % h + h) % h;
    const idx1 = (idx0 + 1) % h;
    const E = (1.0 - fy) * efield[idx0] + fy * efield[idx1];

    v -= E * simDt;
    y += v * simDt * 8.5;
    y = (y % h + h) % h;

    if (!Number.isFinite(v) || Math.abs(v) > vMax * 3.0) {
      params.initParticle(i);
      y = py[i];
      v = pv[i];
    }

    py[i] = y;
    pv[i] = v;

    const xExact = (v + vMax) * vToX;
    const xi = Math.floor(xExact);
    const fx = xExact - xi;
    const yi = Math.floor(y);

    if (yi >= 0 && yi < h && xi >= 0 && xi < w - 1) {
      const baseIdx = yi * w + xi;
      pBuf[baseIdx] += 0.45 * (1.0 - fx);
      pBuf[baseIdx + 1] += 0.45 * fx;
    }
  }
}

export function setup(params) {
  params.w = 128;
  params.h = 128;
  params.nParticles = 6500;
  params.t = 0;
  params.runningMax = 1.0;

  params.py = new Float32Array(params.nParticles);
  params.pv = new Float32Array(params.nParticles);
  params.rho = new Float32Array(128);
  params.efield = new Float32Array(128);
  params.phaseBuf = new Float32Array(128 * 128);

  let seed = 88223344;
  params.rnd = function() {
    seed = (seed * 1664525 + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };

  params.v0 = 1.25;
  params.vMax = 4.8;

  params.initParticle = function(i) {
    const isDown = (i & 1) === 0;
    const dir = isDown ? 1.0 : -1.0;
    const u1 = Math.max(1e-6, params.rnd());
    const u2 = params.rnd();
    const gauss = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(6.2831853 * u2);

    const yPos = params.rnd() * 128.0;
    const wave = Math.sin((yPos / 128.0) * 18.8495) * 0.2; // 3주기 체인

    params.py[i] = yPos;
    params.pv[i] = dir * params.v0 + wave * dir + gauss * 0.08;
  };

  for (let i = 0; i < params.nParticles; i++) params.initParticle(i);

  for (let step = 0; step < 180; step++) {
    stepPicAspect(params, 0.08, 1.0, 1.0, 0.88);
  }
}

export function update(dt, input, params) {
  const clampedDt = Math.min(dt, 0.05);
  params.t += clampedDt;

  // Knob 0: AspectScale (가로세로 비율 왜곡 0.3 ~ 3.0)
  // Knob 1: SimSpeed (속도)
  // Knob 2: CoreEccentricity (포텐셜 타원 강도)
  // Knob 3: Persistence (잔상 길이)
  const aspect = input.knobValues[0];
  const simSpeed = input.knobValues[1];
  const ecc = input.knobValues[2];
  const persistence = input.knobValues[3];

  if (input.btnPressed[0]) {
    for (let i = 0; i < params.nParticles; i++) params.initParticle(i);
  }

  const steps = 2;
  const simDt = (clampedDt * simSpeed * 0.85) / steps;
  for (let s = 0; s < steps; s++) {
    stepPicAspect(params, simDt, aspect, ecc, persistence);
  }
}

export function draw(display, params, time) {
  const w = display.width;
  const h = display.height;
  const pBuf = params.phaseBuf;

  let frameMax = 0.01;
  const len = w * h;
  for (let i = 0; i < len; i++) {
    const val = pBuf[i];
    if (val > frameMax && Number.isFinite(val)) frameMax = val;
  }
  params.runningMax = params.runningMax * 0.92 + frameMax * 0.08;
  const invNorm = 1.0 / Math.max(0.001, params.runningMax);

  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let raw = pBuf[row + x] * invNorm;
      if (!Number.isFinite(raw)) raw = 0.0;
      let val = Math.pow(Math.min(1.0, Math.max(0.0, raw)), 0.65);
      val = (val - 0.06) * 1.08 * 1.7; // Contrast 1.7 고정
      val = Math.min(1.0, Math.max(0.0, val));
      display.setValue(x, y, val * val * (3.0 - 2.0 * val));
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
