// ===== Patternflow pattern =====
// Title:    PhoenixEmber
// Author:   @engmung
// Date:     2026-08-11
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp oklab 0:#000000 1:#ffffff 0.323:#ff0000
// @knobs SwirlWeight=0..4.2, Speed=0.2..12.5, Density=1000..3000, TrailPersisten=0.82..0.985
// @matrix 64x128
// critical knob = SwirlWeight, turning it crosses Linear Affine Symmetry ↔ Nonlinear Swirling Chaos



// Knob 1: Non-linear variation blend weight (0 = pure linear affine symmetry, 1.2 = turbulent vortex spirals)
// Knob 2: Dynamic IFS coefficient morphing rate
// Knob 3: Chaos game iterations per frame
// Knob 4: Log-density buffer decay persistence

export function setup(params) {
  params.t = 0;
  params.w = 64;
  params.h = 128;
  const size = params.w * params.h;

  params.histBuf = new Float32Array(size);

  // Chaos game state variables
  params.px = 0.1;
  params.py = 0.1;

  setupHelpers(params);

  let seed = 771029;
  params.rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  // Warmup chaos game iterations to pre-populate log-density buffer
  for (let warmup = 0; warmup < 100; warmup++) {
    const mockInput = { knobValues: [0.6, 1.0, 8000, 0.92] };
    params.stepFlame(0.016, mockInput);
  }
}

export function update(dt, input, params) {
  const safeDt = Math.min(dt, 0.1);
  params.t += safeDt;
  params.knobValues = input.knobValues;

  params.stepFlame(safeDt, input);
}

export function setupHelpers(params) {
  params.stepFlame = (dt, input) => {
    const kv = input.knobValues;
    const swirlW = kv[0];
    const speed = kv[1];
    const iterCount = Math.floor(kv[2]);
    const persistence = kv[3];

    const w = params.w;
    const h = params.h;
    const buf = params.histBuf;

    // Decay existing log-density buffer
    for (let i = 0; i < buf.length; i++) {
      buf[i] *= persistence;
    }

    // Slowly morphing affine coefficients
    const morph = params.t * speed * 0.4;
    const a1 = 0.5 * Math.cos(morph * 0.3);
    const b1 = -0.5 * Math.sin(morph * 0.4);
    const c1 = 0.5 * Math.sin(morph * 0.3);
    const d1 = 0.5 * Math.cos(morph * 0.4);

    const a2 = 0.4 * Math.sin(morph * 0.5);
    const b2 = 0.4 * Math.cos(morph * 0.2);
    const c2 = -0.4 * Math.cos(morph * 0.5);
    const d2 = 0.4 * Math.sin(morph * 0.2);

    let x = params.px;
    let y = params.py;

    for (let i = 0; i < iterCount; i++) {
      const r = params.rand();

      let nx, ny;
      if (r < 0.5) {
        nx = a1 * x + b1 * y;
        ny = c1 * x + d1 * y + 0.3;
      } else {
        nx = a2 * x + b2 * y - 0.2;
        ny = c2 * x + d2 * y - 0.4;
      }

      // Variation 1: Linear + Variation 2: Swirl
      if (swirlW > 0.001) {
        const r2 = nx * nx + ny * ny + 1e-6;
        const sinR2 = Math.sin(r2 * 2.0);
        const cosR2 = Math.cos(r2 * 2.0);

        const sx = nx * sinR2 - ny * cosR2;
        const sy = nx * cosR2 + ny * sinR2;

        x = nx * (1.0 - swirlW) + sx * swirlW;
        y = ny * (1.0 - swirlW) + sy * swirlW;
      } else {
        x = nx;
        y = ny;
      }

      // Map transformed point into 1:2 vertical frame coordinates
      const px = Math.floor((x + 0.9) * 0.55 * w);
      const py = Math.floor((y + 1.1) * 0.45 * h);

      if (px >= 0 && px < w && py >= 0 && py < h) {
        const idx = py * w + px;
        buf[idx] += 1.0;
      }

      if (!isFinite(x) || !isFinite(y) || Math.abs(x) > 10.0 || Math.abs(y) > 10.0) {
        x = params.rand() * 0.2 - 0.1;
        y = params.rand() * 0.2 - 0.1;
      }
    }

    params.px = x;
    params.py = y;
  };
}

export function draw(display, params, time) {
  if (!params.stepFlame) setupHelpers(params);

  const buf = params.histBuf;
  const w = display.width;
  const h = display.height;

  // Logarithmic density tone mapping
  let maxLog = 0.001;
  for (let i = 0; i < buf.length; i++) {
    const logVal = Math.log1p(buf[i]);
    if (logVal > maxLog) maxLog = logVal;
  }

  const norm = 1.0 / Math.max(maxLog, 0.1);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      let val = Math.log1p(buf[idx]) * norm;

      val = Math.max(0, Math.min(1, val));
      val = val * val * (3 - 2 * val);

      display.setValue(x, y, val);
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
