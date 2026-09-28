// ===== Patternflow pattern =====
// Title:    DefectCascade
// Author:   @engmung
// Date:     2026-08-14
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp oklab 0:#000000 1:#ffffff
// @knobs DefectRate=0..1, FanSpread=0.2..5, ShockAngle=0.2..2.5, DensityFilter=0.1..1
// @matrix 128x128

// Critical knob = DefectRate (Knob 1), turning it crosses Clean Hyperbolic Waves ↔ Turbulent Rarefaction Cascades

/*
  Controls:
  Knob 1 (DefectRate): Internal localized hopping rate defect/quenched disorder (0.0 to 1.0). Seeds wandering backward shock waves.
  Knob 2 (FanSpread): Rarefaction opening fan angle and characteristic wave dispersion.
  Knob 3 (ShockAngle): Spatial curvature and shearing of trailing shock structures.
  Knob 4 (DensityFilter): High-pass density gradient filter (soft liquid vs metallic shock bands).
*/

export function setup(params) {
  params.W = 64;
  params.H = 128;
  const N = params.W * params.H;

  params.t = 0;
  params.seed = 5543217;

  params.rnd = function() {
    params.seed = (params.seed * 1664525 + 1013904223) >>> 0;
    return params.seed / 4294967296;
  };

  // State buffers
  params.occupancy = new Float32Array(params.W);
  params.defects = new Float32Array(params.W);
  params.history = new Float32Array(N);
  params.filterBuf = new Float32Array(N);

  // Generate fixed quenched defect landscape
  for (let x = 0; x < params.W; x++) {
    params.occupancy[x] = (x % 3 === 0) ? 1.0 : 0.0;
    // Multi-frequency defect pockets
    params.defects[x] = 0.5 + 0.5 * Math.sin(x * 0.45) * Math.cos(x * 1.15);
  }

  // Pre-seed density history
  for (let y = 0; y < params.H; y++) {
    for (let x = 0; x < params.W; x++) {
      const v = 0.5 + 0.4 * Math.sin(y * 0.15 - x * 0.08);
      params.history[y * params.W + x] = v;
    }
  }
}

export function update(dt, input, params) {
  const safeDt = Math.min(dt || 0.016, 0.05);
  params.t += safeDt;

  const defectRate  = input.knobValues ? input.knobValues[0] : 0.5;
  const fanSpread   = input.knobValues ? input.knobValues[1] : 2.2;
  const shockAngle  = input.knobValues ? input.knobValues[2] : 1.0;
  const filtGain    = input.knobValues ? input.knobValues[3] : 0.6;

  if (input.btnPressed && input.btnPressed[0]) {
    for (let x = 0; x < params.W; x++) {
      params.defects[x] = params.rnd();
    }
  }

  // Incommensurate boundary wave driving injection rates
  const alphaTime = 0.5 + 0.42 * Math.sin(params.t * 1.37);
  const betaTime = 0.5 + 0.42 * Math.cos(params.t * 0.91);

  // Number of micro-steps per frame
  const iters = 240;
  for (let it = 0; it < iters; it++) {
    const r = params.rnd();
    if (r < 0.1) {
      if (params.occupancy[0] === 0.0 && params.rnd() < alphaTime) {
        params.occupancy[0] = 1.0;
      }
    } else if (r < 0.2) {
      if (params.occupancy[params.W - 1] === 1.0 && params.rnd() < betaTime) {
        params.occupancy[params.W - 1] = 0.0;
      }
    } else {
      const idx = Math.floor(params.rnd() * (params.W - 1));
      // Local defect throttles the hopping rate at this position
      const localHopRate = 1.0 - defectRate * (1.0 - params.defects[idx]);
      if (params.occupancy[idx] === 1.0 && params.occupancy[idx + 1] === 0.0) {
        if (params.rnd() < localHopRate) {
          params.occupancy[idx] = 0.0;
          params.occupancy[idx + 1] = 1.0;
        }
      }
    }
  }

  // Downward cascade shift with rarefaction angular fan displacement
  for (let y = params.H - 1; y > 0; y--) {
    const rowDest = y * params.W;
    const rowSrc = (y - 1) * params.W;
    const shift = Math.floor(shockAngle * Math.sin(y * 0.08 + params.t * 0.7));

    for (let x = 0; x < params.W; x++) {
      const srcX = (x - shift + params.W) % params.W;
      params.history[rowDest + x] = params.history[rowSrc + srcX];
    }
  }

  // Coarse-grain the 1D top boundary and feed y=0
  for (let x = 0; x < params.W; x++) {
    let acc = 0;
    let wSum = 0;
    const radius = Math.floor(fanSpread * 1.5) + 1;
    for (let dx = -radius; dx <= radius; dx++) {
      const sx = Math.max(0, Math.min(params.W - 1, x + dx));
      const w = 1.0 / (1.0 + Math.abs(dx));
      acc += params.occupancy[sx] * w;
      wSum += w;
    }
    params.history[x] = acc / wSum;
  }

  // Check stability
  if (!isFinite(params.history[0])) {
    setup(params);
  }

  params.r_filtGain = filtGain;
}

export function draw(display, params, time) {
  const W = display.width;
  const H = display.height;
  const pW = params.W;
  const pH = params.H;
  const filt = params.r_filtGain !== undefined ? params.r_filtGain : 0.6;

  // Background slow field breathing
  const drift = 0.06 * Math.cos(params.t * 0.25);

  for (let y = 0; y < H; y++) {
    const py = Math.floor((y / H) * pH);
    const row = py * pW;

    for (let x = 0; x < W; x++) {
      const px = Math.floor((x / W) * pW);
      const val = params.history[row + px];

      // Horizontal and vertical Laplacian to isolate rarefaction wavefront boundaries
      const pL = px > 0 ? px - 1 : pW - 1;
      const pR = px < pW - 1 ? px + 1 : 0;
      const pU = py > 0 ? py - 1 : 0;
      const pD = py < pH - 1 ? py + 1 : pH - 1;

      const gradX = Math.abs(params.history[row + pR] - params.history[row + pL]);
      const gradY = Math.abs(params.history[pD * pW + px] - params.history[pU * pW + px]);
      const edge = (gradX + gradY) * 2.2;

      // Blend density baseline with edge-boosted wavefronts
      let composite = (1.0 - filt) * val + filt * edge + drift;

      // Dynamic range clamp & S-curve compression
      let v = composite < 0 ? 0 : (composite > 1 ? 1 : composite);
      v = v * v * (3.0 - 2.0 * v);

      display.setValue(x, y, v);
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
