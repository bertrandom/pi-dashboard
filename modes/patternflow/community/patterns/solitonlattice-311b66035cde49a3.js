// ===== Patternflow pattern =====
// Title:    SolitonLattice
// Author:   @engmung
// Date:     2026-08-16
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp oklab 0:#000000 0.878:#00eeff 0.759:#ff0000
// @knobs Nonlin=0.2..9, Speed=0.3..6, Width=0.08..0.35, Sharpness=0.5..3
// @matrix 128x128

// critical knob = Nonlin, turning it crosses linear wave packet dispersion ↔ elastic KdV soliton diamond lattice ↔ shockwave fragmentation

export function setup(params) {
  // Knobs mapping:
  // Knob 1 (Nonlin): Nonlinear stiffness (controls solitary wave steepening and phase shift during collisions)
  // Knob 2 (Speed): Wave propagation speed
  // Knob 3 (Width): Seed wave-packet spatial envelope width
  // Knob 4 (Sharpness): Wavefront gradient enhancement

  params.N = 64;
  params.H = 128;
  const N = params.N;
  const H = params.H;

  params.t = 0;
  params.head = 0;

  params.q = new Float32Array(N);
  params.v = new Float32Array(N);
  params.a = new Float32Array(N);
  params.history = new Float32Array(N * H);
  params.ampEma = 0.5;

  params.seedCollidingPulses = (w) => {
    const width = w || 0.15;
    for (let i = 0; i < N; i++) {
      const x = i / (N - 1);
      // Two counter-propagating localized Gaussian displacement pulses
      const p1 = Math.exp(-Math.pow((x - 0.28) / width, 2));
      const p2 = Math.exp(-Math.pow((x - 0.72) / width, 2));
      params.q[i] = 1.5 * (p1 + p2);
      // Velocity directed towards each other to initiate collision
      const dp1 = -((x - 0.28) / (width * width)) * p1;
      const dp2 = ((x - 0.72) / (width * width)) * p2;
      params.v[i] = 1.2 * (dp1 + dp2);
      params.a[i] = 0;
    }
    // Fixed boundary conditions at endpoints
    params.q[0] = 0;
    params.q[N - 1] = 0;
    params.v[0] = 0;
    params.v[N - 1] = 0;
  };

  params.seedCollidingPulses(0.15);

  // Warm up collision history
  const dtSub = 0.02;
  const nonlin = 4.2;
  for (let step = 0; step < H; step++) {
    for (let s = 0; s < 6; s++) {
      for (let i = 1; i < N - 1; i++) {
        const dL = params.q[i] - params.q[i - 1];
        const dR = params.q[i + 1] - params.q[i];
        params.a[i] = (dR - dL) + nonlin * (dR * dR * dR - dL * dL * dL);
      }
      for (let i = 1; i < N - 1; i++) {
        params.v[i] += params.a[i] * dtSub;
        params.q[i] += params.v[i] * dtSub;
      }
    }
    const rowOffset = step * N;
    for (let i = 0; i < N; i++) {
      params.history[rowOffset + i] = params.q[i];
    }
  }
}

export function update(dt, input, params) {
  const safeDt = Math.min(dt, 0.08);
  params.t += safeDt;

  const N = params.N;
  const H = params.H;
  const nonlin = input.knobValues[0];
  const speed = input.knobValues[1];
  const width = input.knobValues[2];
  const sharpness = input.knobValues[3];

  if (input.btnPressed && input.btnPressed[0]) {
    params.seedCollidingPulses(width);
  }

  const substeps = 6;
  const dtSub = (safeDt * speed * 2.4) / substeps;

  let totalE = 0;
  let maxAbs = 0.001;

  for (let s = 0; s < substeps; s++) {
    for (let i = 1; i < N - 1; i++) {
      const dL = params.q[i] - params.q[i - 1];
      const dR = params.q[i + 1] - params.q[i];
      params.a[i] = (dR - dL) + nonlin * (dR * dR * dR - dL * dL * dL);
    }
    for (let i = 1; i < N - 1; i++) {
      params.v[i] += params.a[i] * dtSub;
      params.q[i] += params.v[i] * dtSub;
    }
  }

  for (let i = 1; i < N - 1; i++) {
    const dq = params.q[i] - params.q[i - 1];
    totalE += 0.5 * params.v[i] * params.v[i] + 0.5 * dq * dq;
    const a = Math.abs(params.q[i]);
    if (a > maxAbs) maxAbs = a;
  }

  if (!Number.isFinite(totalE) || totalE > 6000 || !Number.isFinite(params.q[1])) {
    params.seedCollidingPulses(width);
    return;
  }

  params.ampEma = params.ampEma * 0.95 + maxAbs * 0.05;
  const scale = 1.0 / Math.max(0.2, params.ampEma);

  const rowOffset = params.head * N;
  for (let i = 0; i < N; i++) {
    params.history[rowOffset + i] = params.q[i] * scale;
  }
  params.head = (params.head + 1) % H;

  params.currentSharpness = sharpness;
}

export function draw(display, params, time) {
  const N = params.N;
  const H = params.H;
  const head = params.head;
  const sharpness = params.currentSharpness || 1.0;

  for (let y = 0; y < display.height; y++) {
    const histY = Math.floor((y / display.height) * H);
    const rowIdx = (head - 1 - histY + H * 2) % H;
    const rowOffset = rowIdx * N;

    for (let x = 0; x < display.width; x++) {
      const histX = Math.floor((x / display.width) * N);
      const val = params.history[rowOffset + histX];

      // Second spatial difference (curvature) highlights collision intersection nodes
      const left = params.history[rowOffset + Math.max(0, histX - 1)];
      const right = params.history[rowOffset + Math.min(N - 1, histX + 1)];
      const curvature = Math.abs(right - 2.0 * val + left) * 2.5;

      const baseIntensity = Math.abs(val);
      let v = baseIntensity * 0.6 + curvature * 0.4 * sharpness;

      v = Math.min(1.0, Math.max(0.0, v));
      v = v * v * (3.0 - 2.0 * v);

      display.setValue(x, y, v);
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
