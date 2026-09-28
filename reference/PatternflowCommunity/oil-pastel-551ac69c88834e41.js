// ===== Patternflow pattern =====
// Title:    Oil pastel
// Author:   @engmung
// Based on: "1" by @engmung — https://patternflow.work/community/p/41873a0865224fb9
// Date:     2026-08-16
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp oklab 0:#000000 1:#ffffff 0.254:#000000 0.744:#1eff00 0.237:#ff0000 0.487:#001eff 0.504:#000000 0.752:#000000
// @knobs Detune=0..0.12, Speed=0.2..3, Glow=1..5, Fade=0.75..0.98
// @matrix 64x128




// critical knob = Detune, turning it crosses isolated stationary loops <-> interlocking vertical caustic tapestry

/*
  Controls:
    Knob 1 (Detune): Inter-tier frequency detuning (0.000..0.120). Crosses harmonic closure into an entangled multi-tier tapestry.
    Knob 2 (Speed): Simulation integration rate & orbital velocity (0.20..3.00).
    Knob 3 (Glow): Core filament luster & HDR exposure gain (1.00..5.00).
    Knob 4 (Fade): Phosphor ink persistence decay rate (0.75..0.98).
    Btn 1: Phase-stagger impulse across all 4 pendulum heads.

  Output Bands (with 0.01+ safety gaps around 0.25, 0.50, 0.75):
    - Background = 0.000
    - Tier 0     = 0.010 .. 0.240
    - Tier 1     = 0.260 .. 0.490
    - Tier 2     = 0.510 .. 0.740
    - Tier 3     = 0.760 .. 0.990
*/

export function setup(params) {
  const w = 64;
  const h = 128;
  params.w = w;
  params.h = h;
  params.t = 0;
  params.simT = 0;
  params.phaseKick = 0;
  params.ampEma = new Float32Array([0.3, 0.3, 0.3, 0.3]);

  // 4개 티어 독립 잉크 버퍼 (4 * 64 * 128)
  params.tierInk = new Float32Array(4 * w * h);

  // 3x3 소프트 스플랫 잉크 침착
  params.deposit = function (tier, px, py, weight) {
    if (px < 1 || px >= 62 || py < 1 || py >= 126) return;
    const x0 = px | 0;
    const y0 = py | 0;
    const fx = px - x0;
    const fy = py - y0;

    const tierOffset = tier * 64 * 128;
    const ink = params.tierInk;

    for (let dy = -1; dy <= 1; dy++) {
      const wy = Math.max(0.0, 1.0 - Math.abs(dy - fy));
      const row = (y0 + dy) * 64;
      for (let dx = -1; dx <= 1; dx++) {
        const wx = Math.max(0.0, 1.0 - Math.abs(dx - fx));
        ink[tierOffset + row + (x0 + dx)] += wx * wy * weight;
      }
    }
  };

  // 사전 워밍업
  const dtStep = 0.005;
  let tSim = 0;
  for (let s = 0; s < 6000; s++) {
    tSim += dtStep;
    for (let tier = 0; tier < 4; tier++) {
      const cy = 16.0 + tier * 32.0;
      const f1 = 2.0 + tier * 0.5;
      const f2 = 3.0 + 0.035;
      const env = 0.85 + 0.15 * Math.sin(tSim * 0.4 + tier);
      const px = 31.5 + (22.0 * Math.sin(f1 * tSim) + 8.0 * Math.cos(f2 * tSim + tier)) * env;
      const py = cy + (15.0 * Math.sin(3.0 * tSim + tier * 0.7) + 6.0 * Math.cos(1.5 * tSim)) * env;
      params.deposit(tier, px, py, 0.03);
    }
  }
}

export function update(dt, input, params) {
  const safeDt = Math.min(dt || 0.016, 0.1);
  params.t += safeDt;

  const kv = input.knobValues || [0.035, 1.20, 2.50, 0.92];
  const detune = kv[0];
  const speed = kv[1];
  const glow = kv[2];
  const fade = Math.max(0.65, Math.min(0.99, kv[3]));

  params.glow = glow;

  if (input.btnPressed && input.btnPressed[0]) {
    params.phaseKick += Math.PI * 0.5;
  }

  // 잉크 감쇄
  const ink = params.tierInk;
  const totalLen = 4 * params.w * params.h;
  for (let i = 0; i < totalLen; i++) {
    ink[i] *= fade;
  }

  // 서브스텝 시뮬레이션
  const steps = 300;
  const subDt = (safeDt * 5.0 * speed) / steps;
  const deposit = params.deposit;

  for (let s = 0; s < steps; s++) {
    params.simT += subDt;

    for (let tier = 0; tier < 4; tier++) {
      const cy = 16.0 + tier * 32.0;
      const f1 = 2.0 + tier * 0.5;
      const f2 = 3.0 + detune;
      const pMod = params.t * 0.1 + tier * 1.57 + params.phaseKick;

      const env = 0.85 + 0.15 * Math.sin(params.simT * 0.35 + tier * 0.8);
      const px = 31.5 + (22.0 * Math.sin(f1 * params.simT + pMod) + 8.0 * Math.cos(f2 * params.simT + tier)) * env;
      const py = cy + (15.0 * Math.sin(3.0 * params.simT + tier * 0.7) + 6.0 * Math.cos(1.5 * params.simT)) * env;

      if (!Number.isFinite(px) || !Number.isFinite(py)) {
        params.simT = 0;
        params.tierInk.fill(0);
        return;
      }

      deposit(tier, px, py, 0.035);
    }
  }
}

export function draw(display, params, time) {
  const w = display.width;
  const h = display.height;
  const tierInk = params.tierInk;
  const glow = params.glow || 2.5;
  const planeSize = w * h;

  // 티어별 최대 밝기 정규화 추적
  const norm = [0, 0, 0, 0];
  for (let tier = 0; tier < 4; tier++) {
    const offset = tier * planeSize;
    let maxV = 0.001;
    for (let i = 0; i < planeSize; i += 8) {
      const val = tierInk[offset + i];
      if (val > maxV) maxV = val;
    }
    params.ampEma[tier] = params.ampEma[tier] * 0.90 + maxV * 0.10;
    norm[tier] = (1.0 / Math.max(params.ampEma[tier], 0.04)) * glow;
  }

  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const idx = row + x;

      // 주도 티어 찾기
      let bestTier = -1;
      let maxTierVal = 0.005;

      for (let tier = 0; tier < 4; tier++) {
        const v = tierInk[tier * planeSize + idx] * norm[tier];
        if (v > maxTierVal && Number.isFinite(v)) {
          maxTierVal = v;
          bestTier = tier;
        }
      }

      // 배경
      if (bestTier === -1) {
        display.setValue(x, y, 0.0);
        continue;
      }

      // 내부 명암 쉐이핑 (0.0 ~ 1.0)
      let shaped = 1.0 - Math.exp(-maxTierVal * 1.4);
      shaped = shaped * shaped * (3.0 - 2.0 * shaped);
      shaped = Math.max(0.0, Math.min(1.0, shaped));

      // 0.01의 간격을 보장하는 분할 매핑:
      // Tier 0: 0.01 + [0 .. 0.23] -> 0.01 .. 0.24
      // Tier 1: 0.26 + [0 .. 0.23] -> 0.26 .. 0.49
      // Tier 2: 0.51 + [0 .. 0.23] -> 0.51 .. 0.74
      // Tier 3: 0.76 + [0 .. 0.23] -> 0.76 .. 0.99
      const bandBase = 0.01 + bestTier * 0.25;
      const bandVal = bandBase + shaped * 0.23;

      display.setValue(x, y, bandVal);
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
