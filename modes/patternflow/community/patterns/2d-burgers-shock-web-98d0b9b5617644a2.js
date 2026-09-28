// ===== Patternflow pattern =====
// Title:    2D Burgers shock web
// Author:   @engmung
// Date:     2026-09-07
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp oklchLong 0:#000000 0.792:#59ff00 0.217:#4497e4
// @knobs Viscosity=0.03..0.6, Speed=0.2..5, Drift=0..2, Persistence=0.85..0.99
// @matrix 128x128

// critical knob = Viscosity, turning it crosses soft diffuse smoke ↔ crystalline converging filigree

export function setup(params) {
  const W = 64, H = 128, N = W * H;
  params.W = W;
  params.H = H;
  params.t = 0;
  params.emaPeak = 0.5;

  let seed = 4242;
  params.rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  params.u = new Float32Array(N);
  params.v = new Float32Array(N);
  params.uNext = new Float32Array(N);
  params.vNext = new Float32Array(N);
  params.trail = new Float32Array(N);

  for (let i = 0; i < N; i++) {
    params.u[i] = (params.rnd() - 0.5) * 0.2;
    params.v[i] = (params.rnd() - 0.5) * 0.2;
  }

  params.stepBurgers = (subDt, nu, drift) => {
    const u = params.u, v = params.v;
    const uN = params.uNext, vN = params.vNext;
    const t = params.t;

    // Slow organic stirring harmonics
    const fY = Math.sin(t * 0.41) * 0.3;
    const fX = Math.cos(t * 0.29) * 0.3;

    for (let y = 0; y < H; y++) {
      const ym = y > 0 ? y - 1 : H - 1;
      const yp = y < H - 1 ? y + 1 : 0;
      const yW = y * W, ymW = ym * W, ypW = yp * W;
      const ny = y / H;

      for (let x = 0; x < W; x++) {
        const xm = x > 0 ? x - 1 : W - 1;
        const xp = x < W - 1 ? x + 1 : 0;
        const idx = yW + x;
        const nx = x / W;

        const uc = u[idx], vc = v[idx];

        const du_dx = uc > 0 ? (uc - u[yW + xm]) : (u[yW + xp] - uc);
        const du_dy = vc > 0 ? (uc - u[ymW + x]) : (u[ypW + x] - uc);
        const dv_dx = uc > 0 ? (vc - v[yW + xm]) : (v[yW + xp] - vc);
        const dv_dy = vc > 0 ? (vc - v[ymW + x]) : (v[ypW + x] - vc);

        const lapU = u[yW + xm] + u[yW + xp] + u[ymW + x] + u[ypW + x] - 4 * uc;
        const lapV = v[yW + xm] + v[yW + xp] + v[ymW + x] + v[ypW + x] - 4 * vc;

        // Upward/downward flow bias for vertical tall composition
        const stirU = Math.sin((ny * 3 + fY) * Math.PI * 2) * 0.2;
        const stirV = Math.cos((nx * 2 + fX) * Math.PI * 2) * 0.2 + drift;

        let nuVal = uc + subDt * (-(uc * du_dx + vc * du_dy) + nu * lapU + stirU);
        let nvVal = vc + subDt * (-(uc * dv_dx + vc * dv_dy) + nu * lapV + stirV);

        if (!Number.isFinite(nuVal) || Math.abs(nuVal) > 10) nuVal = 0;
        if (!Number.isFinite(nvVal) || Math.abs(nvVal) > 10) nvVal = 0;

        uN[idx] = nuVal;
        vN[idx] = nvVal;
      }
    }

    params.u.set(uN);
    params.v.set(vN);
  };

  // Warmup simulation
  for (let i = 0; i < 50; i++) {
    params.stepBurgers(0.1, 0.1, 0.4);
    params.t += 0.1;
  }
}

export function update(dt, input, params) {
  // Knobs: 1: Viscosity, 2: Speed, 3: Drift, 4: Persistence
  const kv = input.knobValues;
  const nu = kv[0];
  const speed = kv[1];
  const drift = kv[2];
  const persistence = kv[3];

  const effectiveDt = Math.min(dt, 0.1) * speed;
  const steps = 4;
  const subDt = effectiveDt / steps;

  for (let s = 0; s < steps; s++) {
    params.t += subDt;
    params.stepBurgers(subDt, nu, drift);
  }

  // Accumulate negative divergence into persistent decay trail buffer
  const W = params.W, H = params.H;
  const u = params.u, v = params.v;
  const trail = params.trail;

  let frameMax = 0.001;

  for (let y = 0; y < H; y++) {
    const ym = y > 0 ? y - 1 : H - 1;
    const yp = y < H - 1 ? y + 1 : 0;
    const yW = y * W, ymW = ym * W, ypW = yp * W;

    for (let x = 0; x < W; x++) {
      const xm = x > 0 ? x - 1 : W - 1;
      const xp = x < W - 1 ? x + 1 : 0;
      const idx = yW + x;

      const du_dx = (u[yW + xp] - u[yW + xm]) * 0.5;
      const dv_dy = (v[ypW + x] - v[ymW + x]) * 0.5;

      const negDiv = Math.max(0, -(du_dx + dv_dy));

      // Decay previous ink and add fresh shock divergence
      trail[idx] = trail[idx] * persistence + negDiv * 0.3;
      if (trail[idx] > frameMax) frameMax = trail[idx];
    }
  }

  params.emaPeak = params.emaPeak * 0.95 + frameMax * 0.05;

  // Momentary clear/reset button
  if (input.btnPressed[0] || input.btnPressed[1] || input.btnPressed[2] || input.btnPressed[3]) {
    params.trail.fill(0);
  }
}

export function draw(display, params, time) {
  const W = display.width, H = display.height;
  const trail = params.trail;
  const norm = 1 / Math.max(0.0001, params.emaPeak);

  for (let y = 0; y < H; y++) {
    const yW = y * W;
    for (let x = 0; x < W; x++) {
      let val = Math.min(1, trail[yW + x] * norm);
      // Contrast shaping curve
      val = val * val * (3 - 2 * val);
      display.setValue(x, y, val);
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
