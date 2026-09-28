// ===== Patternflow pattern =====
// Title:    IsingModelPattern
// Author:   @engmung
// Date:     2026-08-14
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp oklchLong 0.317:#000000 0.623:#000000 0.519:#cdd9fe
// @knobs Temp=0.8..3.5, Speed=0.2..4, Window=1..7, Fade=0.05..0.6
// @matrix 64x128

// critical knob = Temp, turning it crosses ordered (frozen domains) ↔ disordered (melted noise)
// Knobs: Temp = Ising temperature (critical ~2.27), Speed = sweeps per second, Window = magnetization average radius, Fade = display buffer persistence

export function setup(params) {
  const W = 64, H = 128, N = W * H;
  params.W = W; params.H = H;
  params.spins = new Int8Array(N);
  params.mag = new Float32Array(N);
  params.buf = new Float32Array(N);
  params.seed = 123456789;
  params.t = 0;
  params.phase = 0;
  params.amp = 0.5;
  // seed spins with mild bias so domains form quickly
  for (let i = 0; i < N; i++) {
    params.spins[i] = (params.seed = (params.seed * 1664525 + 1013904223) >>> 0) & 1 ? 1 : -1;
  }
  // warm-up sweeps at near-critical T so first frame is already textured
  const J = 1.0;
  for (let s = 0; s < 80; s++) {
    const even = s & 1;
    for (let y = 0; y < H; y++) {
      for (let x = (y + even) & 1; x < W; x += 2) {
        const i = y * W + x;
        let sum = 0;
        if (x > 0) sum += params.spins[i - 1];
        if (x < W - 1) sum += params.spins[i + 1];
        if (y > 0) sum += params.spins[i - W];
        if (y < H - 1) sum += params.spins[i + W];
        const dE = 2 * params.spins[i] * sum * J;
        const T = 2.3;
        if (dE <= 0 || Math.random() < Math.exp(-dE / T)) {
          params.spins[i] = -params.spins[i];
        }
      }
    }
  }
  // initial local magnetization
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let s = 0, c = 0;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx >= 0 && xx < W && yy >= 0 && yy < H) {
            s += params.spins[yy * W + xx];
            c++;
          }
        }
      }
      params.mag[y * W + x] = s / c;
    }
  }
}

export function update(dt, input, params) {
  dt = Math.min(dt, 0.1);
  params.t += dt;
  const kn = input.knobValues;
  const T = kn[0];
  const speed = kn[1];
  const win = Math.max(1, Math.round(kn[2]));
  const fade = kn[3];
  const W = params.W, H = params.H, N = W * H;
  const sweeps = Math.max(1, Math.floor(speed * 4));
  // autonomous slow morph of secondary coupling (harmless axis)
  const J = 0.85 + 0.3 * Math.sin(params.t * 0.07) + 0.15 * Math.sin(params.t * 0.031);
  // checkerboard Metropolis
  for (let s = 0; s < sweeps; s++) {
    const even = (params.phase + s) & 1;
    for (let y = 0; y < H; y++) {
      for (let x = (y + even) & 1; x < W; x += 2) {
        const i = y * W + x;
        let sum = 0;
        if (x > 0) sum += params.spins[i - 1];
        if (x < W - 1) sum += params.spins[i + 1];
        if (y > 0) sum += params.spins[i - W];
        if (y < H - 1) sum += params.spins[i + W];
        const dE = 2 * params.spins[i] * sum * J;
        params.seed = (params.seed * 1664525 + 1013904223) >>> 0;
        const r = (params.seed >>> 0) / 4294967296;
        if (dE <= 0 || r < Math.exp(-dE / Math.max(T, 0.05))) {
          params.spins[i] = -params.spins[i];
        }
      }
    }
  }
  params.phase ^= 1;
  // local magnetization average
  let maxAbs = 1e-6;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let s = 0, c = 0;
      for (let dy = -win; dy <= win; dy++) {
        for (let dx = -win; dx <= win; dx++) {
          const xx = x + dx, yy = y + dy;
          if (xx >= 0 && xx < W && yy >= 0 && yy < H) {
            s += params.spins[yy * W + xx];
            c++;
          }
        }
      }
      const m = s / c;
      params.mag[y * W + x] = m;
      const a = Math.abs(m);
      if (a > maxAbs) maxAbs = a;
    }
  }
  // EMA amplitude + decay into display buffer
  params.amp = params.amp * 0.92 + maxAbs * 0.08;
  const inv = 1 / Math.max(params.amp, 0.05);
  for (let i = 0; i < N; i++) {
    let v = params.mag[i] * inv * 0.5 + 0.5;
    v = Math.max(0, Math.min(1, v));
    params.buf[i] = params.buf[i] * (1 - fade) + v * fade;
  }
  // divergence guard
  if (!isFinite(params.buf[0]) || !isFinite(params.amp)) {
    params.amp = 0.5;
    for (let i = 0; i < N; i++) {
      params.spins[i] = (params.seed = (params.seed * 1664525 + 1013904223) >>> 0) & 1 ? 1 : -1;
      params.buf[i] = 0.5;
    }
  }
}

export function draw(display, params, time) {
  const W = display.width, H = display.height;
  const buf = params.buf;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let v = buf[y * params.W + x];
      // mild vertical stretch of contrast so tall axis reads stronger
      const yy = y / H;
      v = v * (0.85 + 0.3 * Math.sin(yy * Math.PI));
      v = Math.max(0, Math.min(1, v));
      // smoothstep tone
      v = v * v * (3 - 2 * v);
      display.setValue(x, y, v);
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
