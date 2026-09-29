// ===== Patternflow pattern =====
// Title:    heart
// Author:   @engmung
// Date:     2026-08-15
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp oklchShort 0:#000000 0.919:#ff0000
// @knobs Detune=0..0.12, Speed=0.2..3, Lace=1..6, Fade=0.75..0.98
// @matrix 128x128

// critical knob = Detune, turning it crosses static resonant cardioid loop <-> precessing caustic lace heart

/*
  Controls:
    Knob 1 (Detune): Harmonic frequency offset (0.000..0.120). Unwinds closed cardioid lines into sweeping caustic webs.
    Knob 2 (Speed): Simulation tracing & harmonic precession velocity (0.20..3.00).
    Knob 3 (Lace): High-frequency harmonic fold order (1.00..6.00). Pure laser contour <-> dense filigree lace.
    Knob 4 (Fade): Phosphor ink persistence / buffer decay rate (0.75..0.98).
    Btn 1: Trigger an immediate high-amplitude cardiac shockwave.
*/

export function setup(params) {
  const w = 128;
  const h = 128;
  params.w = w;
  params.h = h;
  params.t = 0;
  params.simT = 0;
  params.shock = 1.0;
  params.ampEma = 0.3;

  // 2D accumulation ink buffer (w x h)
  params.ink = new Float32Array(w * h);

  // 3x3 soft-splat footprint for thick, luminous, non-faint glowing lines
  params.deposit = function (px, py, weight) {
    if (px < 1 || px >= w - 2 || py < 1 || py >= h - 2) return;
    const x0 = px | 0;
    const y0 = py | 0;
    const fx = px - x0;
    const fy = py - y0;

    const ink = params.ink;
    for (let dy = -1; dy <= 1; dy++) {
      const wy = Math.max(0.0, 1.0 - Math.abs(dy - fy));
      const row = (y0 + dy) * w;
      for (let dx = -1; dx <= 1; dx++) {
        const wx = Math.max(0.0, 1.0 - Math.abs(dx - fx));
        ink[row + (x0 + dx)] += wx * wy * weight;
      }
    }
  };

  // Prefill buffer so the heart is fully blazing on frame 1
  let tSim = 0;
  const defaultLace = 3.5;
  for (let s = 0; s < 7000; s++) {
    tSim += 0.006;
    const u = tSim * 1.5;

    // Precision parametric heart geometry
    const sinU = Math.sin(u);
    const hx = 16.0 * (sinU * sinU * sinU);
    const hy = -(13.0 * Math.cos(u) - 5.0 * Math.cos(2.0 * u) - 2.0 * Math.cos(3.0 * u) - Math.cos(4.0 * u));

    // Dynamic lace ripples
    const rx = (2.2 + 0.6 * defaultLace) * Math.sin((2.0 + defaultLace + 0.035) * tSim + 0.8);
    const ry = (3.2 + 0.9 * defaultLace) * Math.cos((1.0 + defaultLace) * tSim);

    const px = 63.5 + (hx * 1.25 + rx) * 1.9;
    const py = 60.0 + (hy * 1.60 + ry) * 1.45;

    params.deposit(px, py, 0.022);
  }
}

export function update(dt, input, params) {
  const safeDt = Math.min(dt || 0.016, 0.1);
  params.t += safeDt;

  const kv = input.knobValues || [0.035, 1.20, 3.50, 0.93];
  const detune = kv[0];
  const speed = kv[1];
  const lace = kv[2];
  const fade = Math.max(0.65, Math.min(0.99, kv[3]));

  // Cardiac shockwave trigger on Button 1
  if (input.btnPressed && input.btnPressed[0]) {
    params.shock = 2.4;
  }
  params.shock = params.shock * 0.94 + 1.0 * 0.06;

  // Exponential ink fade driven directly by Knob 4
  const ink = params.ink;
  const len = params.w * params.h;
  for (let i = 0; i < len; i++) {
    ink[i] *= fade;
  }

  // Multi-tracer sub-step integration
  const steps = 320;
  const subDt = (safeDt * 5.0 * speed) / steps;
  const deposit = params.deposit;

  // Harmonic frequencies driven by Lace & Detune
  const fHarmX = 2.0 + lace + detune;
  const fHarmY = 1.0 + lace + detune * 0.5;
  const ampX = 2.0 + 0.7 * lace;
  const ampY = 3.0 + 1.0 * lace;

  const pMod1 = params.t * 0.12;
  const pMod2 = params.t * 0.08 + 0.8;

  for (let s = 0; s < steps; s++) {
    params.simT += subDt * 2.8;

    // Organic background pulse (Fixed beat at 1.0)
    const heartPulse = 1.0 + (0.12 * Math.sin(params.simT * 1.5) * Math.sin(params.simT * 0.75)) * params.shock;

    // 3 parallel harmonic strands for volumetric depth
    for (let tr = -1; tr <= 1; tr++) {
      const dPhase = tr * 0.035;
      const u = (params.simT + dPhase) * 1.5;

      const sinU = Math.sin(u);
      const hx = 16.0 * (sinU * sinU * sinU);
      const hy = -(13.0 * Math.cos(u) - 5.0 * Math.cos(2.0 * u) - 2.0 * Math.cos(3.0 * u) - Math.cos(4.0 * u));

      // Filigree lace whiskers
      const rx = ampX * Math.sin(fHarmX * params.simT + pMod1 + tr * 0.22);
      const ry = ampY * Math.cos(fHarmY * params.simT + pMod2 + tr * 0.16);

      const px = 63.5 + (hx * 1.25 + rx) * (1.9 * heartPulse);
      const py = 60.0 + (hy * 1.60 + ry) * (1.45 * heartPulse);

      if (!Number.isFinite(px) || !Number.isFinite(py)) {
        params.simT = 0;
        params.ink.fill(0);
        return;
      }

      deposit(px, py, 0.026);
    }
  }
}

export function draw(display, params, time) {
  const w = display.width;
  const h = display.height;
  const ink = params.ink;

  // Maximum HDR glow gain fixed at 5.0
  const FIXED_GLOW = 5.0;

  // Running peak amplitude tracking for consistent high dynamic range
  let maxV = 0.001;
  for (let i = 0; i < w * h; i += 8) {
    if (ink[i] > maxV) maxV = ink[i];
  }
  params.ampEma = params.ampEma * 0.90 + maxV * 0.10;
  const norm = (1.0 / Math.max(params.ampEma, 0.04)) * FIXED_GLOW;

  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      let v = ink[row + x] * norm;
      if (!Number.isFinite(v)) v = 0;

      // Filmic exposure response: creates solid burning white filaments with deep soft aura
      let out = 1.0 - Math.exp(-v * 1.4);
      out = out * out * (3.0 - 2.0 * out); // Smoothstep

      display.setValue(x, y, Math.max(0.0, Math.min(1.0, out)));
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
