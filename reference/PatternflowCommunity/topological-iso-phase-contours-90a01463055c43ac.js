// ===== Patternflow pattern =====
// Title:    Topological Iso-Phase Contours
// Author:   @engmung
// Date:     2026-08-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp oklab 0:#000000 1:#ffffff
// @knobs Drive=0.15..2, Damping=0.02..0.1, ContourDensity=1..4, Ribbons=0.1..0.9
// @matrix 64x128

// Critical knob = Drive (Knob 1), turning it crosses calm laminar phase bands ↔ topological defect turbulence.
// Knobs:
//   1. Drive: Drives phase slip vortex generation. (Push Button: Reset/Reseed Field)
//   2. Damping: Dissipation stabilizing stable contour orbits.
//   3. ContourDensity: Number of quantized phase lines per 2PI winding.
//   4. Ribbons: Width/sharpness of the iso-phase contour lines.

export function setup(params) {
  const W = 64;
  const H = 128;
  const N = W * H;

  params.W = W;
  params.H = H;
  params.t = 0;

  params.phi = new Float32Array(N);
  params.phiOld = new Float32Array(N);

  params.sinLUT = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    params.sinLUT[i] = Math.sin((i / 256) * Math.PI * 2);
  }

  let s = 5519213;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return (s & 0xffff) / 65536.0;
  };

  params.reseed = function () {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = y * W + x;
        const u = (x / W) * Math.PI * 3;
        const v = (y / H) * Math.PI * 6;
        params.phi[idx] = Math.sin(u) * Math.cos(v) * 3.0 + (rand() - 0.5) * 0.3;
        params.phiOld[idx] = params.phi[idx];
      }
    }
  };

  params.reseed();
}

export function update(dt, input, params) {
  // 노브 1 버튼 클릭 시 필드 즉시 초기화
  if (input.btnPressed && input.btnPressed[0]) {
    params.reseed();
    params.t = 0;
    return;
  }

  const safeDt = Math.min(Math.max(dt, 0.001), 0.05);
  params.t += safeDt;

  const drive = input.knobValues[0];
  const damping = input.knobValues[1];
  params.density = input.knobValues[2];
  params.ribbon = input.knobValues[3];

  const W = params.W;
  const H = params.H;
  const phi = params.phi;
  const phiOld = params.phiOld;
  const sinLUT = params.sinLUT;

  const subSteps = 3;
  const hdt = safeDt / subSteps;
  const hdt2 = hdt * hdt;
  const denom = 1.0 / (1.0 + 0.5 * damping * hdt);
  const dampCoeff = 1.0 - 0.5 * damping * hdt;

  const morph = Math.sin(params.t * 0.33) * 0.06;
  const effDrive = drive + morph;

  for (let s = 0; s < subSteps; s++) {
    for (let y = 0; y < H; y++) {
      const yOff = y * W;
      const up = ((y + H - 1) % H) * W;
      const dn = ((y + 1) % H) * W;

      for (let x = 0; x < W; x++) {
        const i = yOff + x;
        const l = yOff + ((x + W - 1) % W);
        const r = yOff + ((x + 1) % W);

        const lap = (phi[l] + phi[r] + phi[up + x] + phi[dn + x] - 4.0 * phi[i]) * 9.5;
        const lutIdx = ((phi[i] * 40.74366543) & 255) >>> 0;
        const accel = lap - sinLUT[lutIdx] + effDrive;

        const pNext = (2.0 * phi[i] - phiOld[i] * dampCoeff + accel * hdt2) * denom;
        phiOld[i] = phi[i];
        phi[i] = pNext;
      }
    }
  }

  if (!Number.isFinite(phi[0]) || Math.abs(phi[0]) > 500.0) {
    params.reseed();
  }
}

export function draw(display, params, time) {
  const W = params.W;
  const H = params.H;
  const phi = params.phi;
  const density = params.density;
  const ribbonWidth = params.ribbon;
  const sinLUT = params.sinLUT;

  for (let y = 0; y < H; y++) {
    const yOff = y * W;
    for (let x = 0; x < W; x++) {
      const p = phi[yOff + x];
      // Map continuous phi to periodic sub-bands
      const phaseCycle = (p * density * 0.5) % (Math.PI * 2);
      const lutIdx = ((phaseCycle * 40.74366543) & 255) >>> 0;
      const s = sinLUT[lutIdx];
      const band = (s + 1.0) * 0.5;

      // Pulse shaping for crisp topography lines
      let v = Math.exp(-Math.pow((band - 0.5) / (ribbonWidth * 0.35 + 0.05), 2.0));
      if (v < 0.0) v = 0.0;
      else if (v > 1.0) v = 1.0;

      display.setValue(x, y, v);
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
