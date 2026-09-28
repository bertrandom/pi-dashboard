// ===== Patternflow pattern =====
// Title:    GliderCascade
// Author:   @engmung
// Date:     2026-08-17
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp oklchShort 0:#000000 1:#ffffff 0.472:#ff0000
// @knobs Injection=0.001..0.08, Speed=1..12, SpiralTwist=0..2, Accordion=0..0.85
// @matrix 128x128

// critical knob = Injection (Knob 1), turning it crosses sparse ballistic rays <-> dense scattering braid <-> chaotic turbulence
//
// Knob 1 (Injection): Probability per step of generating active glider defects
// Knob 2 (Speed): Evolution rate per second
// Knob 3 (SpiralTwist): Continuous helical twist shear along the waterfall column
// Knob 4 (Accordion): Monotonic vertical elastic breathing (smooth expansion/compression without folding)

export function setup(params) {
  params.W = 64;
  params.H = 128;
  const N = params.W * params.H;

  params.curRow = new Uint8Array(params.W);
  params.nextRow = new Uint8Array(params.W);
  params.bgRow = new Uint8Array(params.W);
  params.nextBg = new Uint8Array(params.W);

  // Type: 0=Void, 1=Diagonal (0.46), 2=Vertical (0.80), 3=Collision (1.00)
  params.typeGrid = new Uint8Array(N);
  params.rawGrid = new Uint8Array(N);

  params.stepAccum = 0.0;
  params.t = 0.0;
  params.head = 0;

  // Pre-allocated monotonic mapping table to eliminate runtime foldovers
  params.yMap = new Float32Array(params.H);

  params.rngState = 123456789;
  params.rnd = function() {
    params.rngState = (1103515245 * params.rngState + 12345) & 0x7fffffff;
    return params.rngState / 2147484800.0;
  };

  params.rule54 = new Uint8Array([0, 1, 1, 0, 1, 1, 0, 0]);

  // Standard period-4 ether: 1 0 0 0
  for (let x = 0; x < params.W; x++) {
    const val = ((x % 4) === 0) ? 1 : 0;
    params.bgRow[x] = val;
    params.curRow[x] = val;
  }

  // Pre-fill history buffer
  for (let s = 0; s < 256; s++) {
    if (params.rnd() < 0.03) {
      params.curRow[Math.floor(params.rnd() * params.W)] ^= 1;
    }
    for (let x = 0; x < params.W; x++) {
      const L = params.bgRow[(x - 1 + params.W) % params.W];
      const C = params.bgRow[x];
      const R = params.bgRow[(x + 1) % params.W];
      params.nextBg[x] = params.rule54[(L << 2) | (C << 1) | R];
    }
    for (let x = 0; x < params.W; x++) {
      const L = params.curRow[(x - 1 + params.W) % params.W];
      const C = params.curRow[x];
      const R = params.curRow[(x + 1) % params.W];
      params.nextRow[x] = params.rule54[(L << 2) | (C << 1) | R];
    }
    params.bgRow.set(params.nextBg);
    params.curRow.set(params.nextRow);

    const rowOffset = (s % params.H) * params.W;
    const prevOffset = ((s - 1 + params.H) % params.H) * params.W;

    for (let x = 0; x < params.W; x++) {
      const raw = params.curRow[x];
      const defect = raw ^ params.bgRow[x];
      params.rawGrid[rowOffset + x] = raw;

      if (!defect) {
        params.typeGrid[rowOffset + x] = 0;
      } else {
        const xL = (x - 1 + params.W) % params.W;
        const xR = (x + 1) % params.W;
        const prevC = params.typeGrid[prevOffset + x] > 0;
        const prevL = params.typeGrid[prevOffset + xL] > 0;
        const prevR = params.typeGrid[prevOffset + xR] > 0;

        if ((prevL && prevR) || (prevC && (prevL || prevR))) {
          params.typeGrid[rowOffset + x] = 3;
        } else if (prevC && !prevL && !prevR) {
          params.typeGrid[rowOffset + x] = 2;
        } else {
          params.typeGrid[rowOffset + x] = 1;
        }
      }
    }
  }
}

export function update(dt, input, params) {
  const clampedDt = Math.min(dt, 0.1);
  params.t += clampedDt;

  const injectionRate = input.knobValues[0];
  const stepsPerSec = input.knobValues[1] * 8.0;

  if (input.btnPressed[0]) {
    for (let x = 0; x < params.W; x++) {
      const b = ((x % 4) === 0) ? 1 : 0;
      params.bgRow[x] = b;
      params.curRow[x] = b;
    }
    params.curRow[16] ^= 1;
    params.curRow[48] ^= 1;
    params.typeGrid.fill(0);
  }

  params.stepAccum += clampedDt * stepsPerSec;
  const stepsToRun = Math.min(Math.floor(params.stepAccum), 16);
  params.stepAccum -= stepsToRun;

  for (let s = 0; s < stepsToRun; s++) {
    if (params.rnd() < injectionRate) {
      const rx = (params.rnd() < 0.5) ? Math.floor(params.rnd() * 8) : (params.W - 1 - Math.floor(params.rnd() * 8));
      params.curRow[rx] ^= 1;
    }

    for (let x = 0; x < params.W; x++) {
      const L = params.bgRow[(x - 1 + params.W) % params.W];
      const C = params.bgRow[x];
      const R = params.bgRow[(x + 1) % params.W];
      params.nextBg[x] = params.rule54[(L << 2) | (C << 1) | R];
    }
    for (let x = 0; x < params.W; x++) {
      const L = params.curRow[(x - 1 + params.W) % params.W];
      const C = params.curRow[x];
      const R = params.curRow[(x + 1) % params.W];
      params.nextRow[x] = params.rule54[(L << 2) | (C << 1) | R];
    }

    params.bgRow.set(params.nextBg);
    params.curRow.set(params.nextRow);

    const prevHead = params.head;
    params.head = (params.head + 1) % params.H;

    const rowOffset = params.head * params.W;
    const prevOffset = prevHead * params.W;

    for (let x = 0; x < params.W; x++) {
      const raw = params.curRow[x];
      const defect = (raw ^ params.bgRow[x]);

      params.rawGrid[rowOffset + x] = raw;

      if (!defect) {
        params.typeGrid[rowOffset + x] = 0;
      } else {
        const xL = (x - 1 + params.W) % params.W;
        const xR = (x + 1) % params.W;
        const prevC = params.typeGrid[prevOffset + x] > 0;
        const prevL = params.typeGrid[prevOffset + xL] > 0;
        const prevR = params.typeGrid[prevOffset + xR] > 0;

        if ((prevL && prevR) || (prevC && (prevL || prevR))) {
          params.typeGrid[rowOffset + x] = 3;
        } else if (prevC && !prevL && !prevR) {
          params.typeGrid[rowOffset + x] = 2;
        } else {
          params.typeGrid[rowOffset + x] = 1;
        }
      }
    }
  }
}

export function draw(display, params, time) {
  const spiral = params.knobValues ? params.knobValues[2] : 1.2;
  const accordion = params.knobValues ? Math.max(0.0, Math.min(0.85, params.knobValues[3])) : 0.4;
  const W = display.width;
  const H = display.height;
  const head = params.head;

  // Build strictly monotonic cumulative mapping: d(mappedY)/dy > 0 always!
  // Local stretching factor is always strictly positive (min rate >= 1.0 - 0.85 = 0.15)
  let accumY = 0.0;
  for (let y = 0; y < H; y++) {
    const rate = 1.0 + accordion * Math.sin(y * 0.05 + time * 1.6);
    accumY += rate;
    params.yMap[y] = accumY;
  }
  const totalScale = (H - 1) / Math.max(0.001, accumY);

  for (let y = 0; y < H; y++) {
    // Smoothly stretched Y without any direction reversal
    const mappedY = params.yMap[y] * totalScale;
    const intY = Math.floor(mappedY);
    const bufY = (((head - intY) % params.H) + params.H) % params.H;
    const rowOffset = bufY * params.W;

    // Spiral twist continuous with mapped vertical position
    const twistAngle = (mappedY / H) * spiral * params.W;
    const intShift = Math.round(twistAngle);

    for (let x = 0; x < W; x++) {
      const sampleX = (((x - intShift) % params.W) + params.W) % params.W;

      const type = params.typeGrid[rowOffset + sampleX];
      const raw = params.rawGrid[rowOffset + sampleX];

      // Exact plateaus:
      // 0.00: Void
      // 0.06: Ether substrate
      // 0.46: Diagonal Gliders
      // 0.80: Vertical Breathers
      // 1.00: Collision Vertices
      let v = 0.0;
      if (type === 1) {
        v = 0.46;
      } else if (type === 2) {
        v = 0.80;
      } else if (type === 3) {
        v = 1.00;
      } else if (raw === 1) {
        v = 0.06;
      }

      display.setValue(x, y, v);
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
