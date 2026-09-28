// ===== Patternflow pattern =====
// Title:    SandglassHopper
// Author:   @engmung
// Date:     2026-08-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp oklchShort 0:#000000 0.926:#ffd500 0.46:#829af7 1:#000000
// @knobs FeedRate=1..122, SwirlTorque=0.2..0.9, FunnelAngle=0..20, JamResistance=0.8..0.99
// @matrix 64x128

// Critical knob = FeedRate (knob 1), turning it crosses intermittent stuttering bursts ↔ smooth vortex draining.
// Knob mapping:
// - Knob 1 (FeedRate): Rate of grains pouring into hopper
// - Knob 2 (SwirlTorque): Angular rotation of the vortex
// - Knob 3 (FunnelAngle): Geometry angle of the constriction funnel
// - Knob 4 (JamResistance): Dissipation rate of friction memory

export function setup(params) {
  params.W = 64;
  params.H = 128;
  params.t = 0;

  params.R = 32;
  params.pile = new Int32Array(params.R);
  params.zc = new Int8Array(params.R);
  params.flux = new Float32Array(params.R);
  params.hopperCanvas = new Float32Array(params.W * params.H);
  params.peak = 1.0;

  let seed = 817263;
  params.rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  for (let r = 0; r < params.R; r++) {
    params.zc[r] = params.rnd() < 0.5 ? 1 : 2;
  }
}

export function update(dt, input, params) {
  const safeDt = Math.min(dt || 0.016, 0.1);
  params.t += safeDt;

  const feed = Math.max(1, Math.round(input.knobValues[0]));
  const swirl = input.knobValues[1];
  const angle = input.knobValues[2];
  const decay = input.knobValues[3];

  params.flux.fill(0);
  params.pile[params.R - 1] += feed;

  // Inward Oslo topple (from rim r=31 down to nozzle r=0)
  let unstable = true;
  let guard = 0;
  while (unstable && guard++ < 300) {
    unstable = false;
    for (let r = params.R - 1; r > 0; r--) {
      const slope = params.pile[r] - params.pile[r - 1];
      if (slope > params.zc[r]) {
        unstable = true;
        params.pile[r] -= 1;
        params.pile[r - 1] += 1;
        params.zc[r] = params.rnd() < 0.5 ? 1 : 2;
        params.flux[r] += 1.0;
      }
    }
  }
  // Exit nozzle
  params.pile[0] = Math.floor(params.pile[0] * 0.7);

  // Decay field
  for (let i = 0; i < params.hopperCanvas.length; i++) {
    params.hopperCanvas[i] *= decay;
  }

  // Render hopper stream into 64x128
  const cx = 31.5;
  const cy = 63.5;
  const phase = params.t * swirl * 4.0;

  for (let y = 0; y < params.H; y++) {
    const row = y * params.W;
    const dy = (y - cy);
    const funnelWidth = Math.max(4, Math.abs(dy) * (angle * 0.15) + 6);

    for (let x = 0; x < params.W; x++) {
      const dx = x - cx;
      const distFromCenter = Math.abs(dx);

      if (distFromCenter < funnelWidth) {
        const normR = Math.min(params.R - 1, Math.floor((distFromCenter / funnelWidth) * params.R));
        const theta = Math.atan2(dy, dx) + phase + (normR * 0.2);
        const spiralRib = 0.5 + 0.5 * Math.sin(theta * 4.0);
        const toppleEnergy = params.flux[normR];

        const grain = toppleEnergy * 1.5 * spiralRib + (params.pile[normR] > 3 ? 0.25 : 0.05);
        params.hopperCanvas[row + x] = Math.max(params.hopperCanvas[row + x], grain);
      }
    }
  }

  let top = 0.05;
  for (let i = 0; i < params.hopperCanvas.length; i += 16) {
    const val = params.hopperCanvas[i];
    if (val > top && isFinite(val)) top = val;
  }
  params.peak = params.peak * 0.94 + top * 0.06;
}

export function draw(display, params, time) {
  const w = display.width;
  const h = display.height;
  const invNorm = 1.0 / Math.max(0.001, params.peak);

  for (let y = 0; y < h; y++) {
    const row = y * params.W;
    for (let x = 0; x < w; x++) {
      let v = params.hopperCanvas[row + x] * invNorm;
      if (!isFinite(v)) v = 0;
      v = Math.max(0, Math.min(1, v));
      // Tonal compression
      v = v * v * (3.0 - 2.0 * v);
      display.setValue(x, y, v);
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
