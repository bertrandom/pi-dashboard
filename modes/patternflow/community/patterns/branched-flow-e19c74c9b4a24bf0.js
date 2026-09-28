// ===== Patternflow pattern =====
// Title:    Branched flow
// Author:   @engmung
// Date:     2026-09-06
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp oklchShort 0:#000000 0.526:#00b3ff 0.542:#000000 0.879:#ffffff 0.149:#0400ff 0.681:#ffdd00
// @knobs Curvature=0.04..0.7, PulseFreq=0.2..2.5, Torsion=0.5..5, Persistence=0.82..0.985
// @matrix 128x128

// Critical knob = Curvature, turning it crosses geometric 3-lobe star ↔ complex interleaved 3/6-fold caustic mandala.
// Knob 1: Curvature strength
// Knob 2: Breathing rate
// Knob 3: Harmonic torsion amplitude
// Knob 4: Memory persistence

export function setup(params) {
  params.W = 128;
  params.H = 128;
  params.cx = 63.5;
  params.cy = 63.5;
  params.t = 0;
  params.peakEMA0 = 1.0;
  params.peakEMA1 = 1.0;

  params.N_ANGLES = 32;
  params.N_RINGS = 16;
  params.potMajor = new Float32Array(params.N_ANGLES * params.N_RINGS);
  params.potMinor = new Float32Array(params.N_ANGLES * params.N_RINGS);

  params.bufMinor = new Float32Array(params.W * params.H);
  params.bufMajor = new Float32Array(params.W * params.H);

  params.RAY_COUNT = 2800;
  params.rayAngle = new Float32Array(params.RAY_COUNT);
  params.rayDist = new Float32Array(params.RAY_COUNT);
  params.rayVAngle = new Float32Array(params.RAY_COUNT);
  params.isMajor = new Uint8Array(params.RAY_COUNT);

  let seed = 38471;
  params.rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  params.spawn = (i) => {
    const isMaj = i >= (params.RAY_COUNT >> 1) ? 1 : 0;
    params.isMajor[i] = isMaj;
    params.rayAngle[i] = (i / params.RAY_COUNT) * 6.2831853;
    params.rayDist[i] = 1.0 + params.rand() * 2.5;
    params.rayVAngle[i] = 0;
  };

  for (let i = 0; i < params.RAY_COUNT; i++) {
    params.spawn(i);
    params.rayDist[i] = params.rand() * 90.0;
  }

  bakeHarmonics(params, 0.35, 2.5);
  for (let i = 0; i < 160; i++) stepHarmonics(params, 2.5, 0.94);
}

function bakeHarmonics(params, curv, torsion) {
  const na = params.N_ANGLES;
  const nr = params.N_RINGS;
  const t = params.t;

  for (let ir = 0; ir < nr; ir++) {
    const rNorm = ir / (nr - 1);
    const twist = Math.sin(t * 1.2) * torsion * (1.0 - rNorm * 0.7);
    for (let ia = 0; ia < na; ia++) {
      const th = (ia / na) * 6.2831853;
      
      // Major: 3-fold dominant caustic potential
      params.potMajor[ir * na + ia] = Math.sin(th * 3.0 + twist) * Math.cos(rNorm * 4.5 - t * 1.5) * curv;
      
      // Minor: 6-fold interleaved phase-shifted potential
      params.potMinor[ir * na + ia] = Math.sin(th * 6.0 - twist * 1.2 + Math.PI / 3.0) * Math.cos(rNorm * 6.0 + t * 1.8) * curv * 0.8;
    }
  }
}

function stepHarmonics(params, torsion, fade) {
  const W = params.W;
  const H = params.H;
  const cx = params.cx;
  const cy = params.cy;
  const na = params.N_ANGLES;
  const nr = params.N_RINGS;
  const pMaj = params.potMajor;
  const pMin = params.potMinor;
  const bMin = params.bufMinor;
  const bMaj = params.bufMajor;
  const nRays = params.RAY_COUNT;
  const maxR = 92.0; // reaches the corners of a 128x128 panel

  for (let i = 0; i < bMin.length; i++) {
    bMin[i] *= fade;
    bMaj[i] *= fade;
  }

  for (let step = 0; step < 2; step++) {
    for (let i = 0; i < nRays; i++) {
      let th = params.rayAngle[i];
      let r = params.rayDist[i];
      let vth = params.rayVAngle[i];
      const isMaj = params.isMajor[i];

      const normTh = ((th % 6.2831853) + 6.2831853) % 6.2831853;
      const gAngle = (normTh / 6.2831853) * na;
      const gR = Math.min(nr - 1.001, (r / maxR) * nr);

      const ia0 = (gAngle | 0) % na;
      const ia1 = (ia0 + 1) % na;
      const ir0 = gR | 0;

      const potGrid = isMaj ? pMaj : pMin;
      const p0 = potGrid[ir0 * na + ia0];
      const p1 = potGrid[ir0 * na + ia1];
      const dVdth = (p1 - p0) * (na / 6.2831853);

      const spd = isMaj ? 1.2 : 0.9;
      const torque = isMaj ? (dVdth * 0.35) : (-dVdth * 0.25);

      vth = (vth - torque / (r * 0.2 + 2.0)) * 0.975;
      th += vth;
      r += spd;

      const px = (cx + Math.cos(th) * r) | 0;
      const py = (cy + Math.sin(th) * r) | 0;

      if (r >= maxR || px < 0 || px >= W || py < 0 || py >= H) {
        params.spawn(i);
      } else {
        params.rayAngle[i] = th;
        params.rayDist[i] = r;
        params.rayVAngle[i] = vth;

        const idx = py * W + px;
        if (isMaj) {
          bMaj[idx] += 1.4;
        } else {
          bMin[idx] += 0.85;
        }
      }
    }
  }
}

export function update(dt, input, params) {
  const delta = Math.min(dt, 0.1);
  const curv = input.knobValues[0];
  const pulse = input.knobValues[1];
  const torsion = input.knobValues[2];
  const fade = input.knobValues[3];

  params.t += delta * pulse;

  bakeHarmonics(params, curv, torsion);
  stepHarmonics(params, torsion, fade);

  let m0 = 0.01, m1 = 0.01;
  const bMin = params.bufMinor, bMaj = params.bufMajor;
  for (let i = 0; i < bMin.length; i++) {
    if (bMin[i] > m0) m0 = bMin[i];
    if (bMaj[i] > m1) m1 = bMaj[i];
  }
  params.peakEMA0 = params.peakEMA0 * 0.90 + m0 * 0.10;
  params.peakEMA1 = params.peakEMA1 * 0.90 + m1 * 0.10;
}

export function draw(display, params, time) {
  const W = display.width;
  const H = display.height;
  const bMin = params.bufMinor;
  const bMaj = params.bufMajor;
  const inv0 = 1.0 / Math.max(0.01, params.peakEMA0);
  const inv1 = 1.0 / Math.max(0.01, params.peakEMA1);

  for (let y = 0; y < H; y++) {
    const row = y * W;
    for (let x = 0; x < W; x++) {
      const idx = row + x;

      // 6-Fold Minor Petals mapped to [0.0 .. 0.48]
      let nMin = bMin[idx] * inv0;
      nMin = nMin > 1 ? 1 : (nMin < 0 ? 0 : nMin);
      const valMin = Math.pow(nMin, 0.75) * 0.48;

      // 3-Fold Major Petals mapped to [0.52 .. 1.0]
      let nMaj = bMaj[idx] * inv1;
      nMaj = nMaj > 1 ? 1 : (nMaj < 0 ? 0 : nMaj);
      const valMaj = nMaj > 0.04 ? (0.52 + Math.pow(nMaj, 0.65) * 0.48) : 0;

      const finalVal = Math.max(valMin, valMaj);
      display.setValue(x, y, finalVal > 1.0 ? 1.0 : finalVal);
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
