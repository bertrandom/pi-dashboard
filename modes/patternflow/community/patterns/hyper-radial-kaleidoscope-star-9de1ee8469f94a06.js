// ===== Patternflow pattern =====
// Title:    Hyper-Radial Kaleidoscope Star
// Author:   @engmung
// Date:     2026-08-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp oklab 0:#000000 1:#ffffff
// @knobs FeedSplit=0.016..0.044, Petals=2..14, Gain=1.5..8, PhosphorDecay=0.85..0.98
// @matrix 128x128

// critical knob = Petals, turning it alters symmetry 2-fold ↔ 4-fold ↔ 8-fold starburst

export function setup(params) {
  params.W = 128;
  params.H = 128;
  const N = 64;
  params.N = N;
  const total = params.W * params.H;

  params.u = new Float32Array(N);
  params.v = new Float32Array(N);
  params.nextU = new Float32Array(N);
  params.nextV = new Float32Array(N);
  params.buf = new Float32Array(total);

  params.t = 0;
  params.rngState = 987654321;

  params.rand = () => {
    params.rngState = (1664525 * params.rngState + 1013904223) | 0;
    return ((params.rngState >>> 0) / 4294967296);
  };

  params.reseed = () => {
    for (let i = 0; i < N; i++) {
      params.u[i] = 1.0;
      params.v[i] = 0.0;
    }
    const c = N >> 1;
    for (let d = -3; d <= 3; d++) {
      params.u[c + d] = 0.35;
      params.v[c + d] = 0.6 + 0.2 * params.rand();
    }
  };

  params.step1D = (feed) => {
    const N = params.N;
    const u = params.u;
    const v = params.v;
    const nu = params.nextU;
    const nv = params.nextV;
    const Du = 0.16;
    const Dv = 0.08;
    const k = 0.062;
    const dt = 0.8;

    for (let x = 0; x < N; x++) {
      const left = (x - 1 + N) % N;
      const right = (x + 1) % N;
      const u0 = u[x];
      const v0 = v[x];

      const lapU = u[left] + u[right] - 2.0 * u0;
      const lapV = v[left] + v[right] - 2.0 * v0;
      const uvv = u0 * v0 * v0;

      let next_u = u0 + (Du * lapU - uvv + feed * (1.0 - u0)) * dt;
      let next_v = v0 + (Dv * lapV + uvv - (feed + k) * v0) * dt;

      if (!isFinite(next_u) || !isFinite(next_v)) {
        params.reseed();
        return;
      }
      nu[x] = next_u < 0 ? 0 : (next_u > 1 ? 1 : next_u);
      nv[x] = next_v < 0 ? 0 : (next_v > 1 ? 1 : next_v);
    }
    u.set(nu);
    v.set(nv);
  };

  params.reseed();
}

export function update(dt, input, params) {
  const dtClamped = dt > 0.1 ? 0.1 : dt;
  params.t += dtClamped;

  const kv = input.knobValues;
  const feed = kv[0];
  const petals = Math.floor(kv[1]);
  const gain = kv[2];
  const decay = kv[3];

  if (input.btnPressed[0]) {
    params.reseed();
  }

  for (let s = 0; s < 12; s++) {
    params.step1D(feed);
  }

  // Auto-revival
  let sumV = 0;
  for (let i = 0; i < params.N; i++) sumV += params.v[i];
  if (sumV < 0.1) {
    const rx = ((params.rand() * 40) | 0) + 12;
    params.v[rx] = 0.6;
    params.u[rx] = 0.3;
  }

  // Decay
  const W = params.W;
  const H = params.H;
  const total = W * H;
  const buf = params.buf;
  for (let i = 0; i < total; i++) {
    buf[i] *= decay;
  }

  const cx = 31.5;
  const cy = 63.5;
  const N = params.N;
  const v = params.v;

  for (let i = 0; i < N; i++) {
    const vVal = v[i];
    if (vVal > 0.02) {
      const baseAngle = (i / N) * Math.PI * 2.0;
      const radius = vVal * 45.0 + 3.0;

      // N-fold symmetry 매핑
      for (let p = 0; p < petals; p++) {
        const angle = baseAngle + (p * Math.PI * 2.0 / petals) + params.t * 0.2;
        const px = Math.floor(cx + Math.cos(angle) * radius);
        const py = Math.floor(cy + Math.sin(angle) * radius * 1.8);

        if (px >= 1 && px < W - 1 && py >= 1 && py < H - 1) {
          const energy = vVal * gain * 0.35;
          const idx = py * W + px;
          buf[idx] += energy;
          buf[idx + 1] += energy * 0.4;
          buf[idx - 1] += energy * 0.4;
          buf[idx + W] += energy * 0.4;
          buf[idx - W] += energy * 0.4;
        }
      }
    }
  }
}

export function draw(display, params, time) {
  const W = display.width;
  const H = display.height;
  const buf = params.buf;

  for (let y = 0; y < H; y++) {
    const yRow = y * W;
    for (let x = 0; x < W; x++) {
      let val = buf[yRow + x];
      val = val < 0 ? 0 : (val > 1 ? 1 : val);
      display.setValue(x, y, Math.sqrt(val));
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
