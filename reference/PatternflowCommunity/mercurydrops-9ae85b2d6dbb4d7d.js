// ===== Patternflow pattern =====
// Title:    MercuryDrops
// Author:   @engmung
// Date:     2026-08-17
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp oklchShort 0:#000000 1:#ffffff 0.755:#6600ff
// @knobs Condensation=0.5..36, Speed=0.1..8, SurfaceTension=0.8..4, DropletRadius=4..18
// @matrix 64x128

// critical knob = Condensation (b), turning it crosses pulverized mist droplets (b < 2) <-> massive unified mercury fluid bodies (b > 2)

export function setup(params) {
  const w = 64;
  const h = 128;
  params.w = w;
  params.h = h;
  params.t = 0;

  params.seed = 202608;
  params.rand = function() {
    params.seed = (params.seed * 1664525 + 1013904223) | 0;
    return (params.seed >>> 0) / 4294967296;
  };

  // 12개 주요 액적 앵커
  params.numDrops = 12;
  params.sites = new Int32Array(params.numDrops);
  params.dropX = new Float32Array(params.numDrops);
  params.dropY = new Float32Array(params.numDrops);
  params.smoothMass = new Float32Array(params.numDrops);

  for (let i = 0; i < params.numDrops; i++) {
    params.sites[i] = 4;
    params.smoothMass[i] = 2.0;
    params.dropX[i] = 16 + params.rand() * 32;
    params.dropY[i] = 16 + params.rand() * 96;
  }

  params.substepAcc = 0;
}

// Knob 1: Condensation (b 응축 지수: 질량 흡수 및 합체 상전이)
// Knob 2: Speed (시뮬레이션 전반의 물리 연산 및 액적 공전 속도)
// Knob 3: SurfaceTension (액체 표면 장력 및 림 하이라이트 강도)
// Knob 4: DropletRadius (기본 액적 덩어리 볼륨 크기)
export function update(dt, input, params) {
  const safeDt = Math.min(dt, 0.05);

  const b = input.knobValues[0];
  const speed = input.knobValues[1];
  const tension = input.knobValues[2];
  const radius = input.knobValues[3];

  // Knob 2(Speed)로 절대 클록 진행 속도 제어
  params.t += safeDt * speed;

  const nDrops = params.numDrops;
  const sites = params.sites;
  const rand = params.rand;
  const w = params.w;
  const h = params.h;

  // ZRP 질량 호핑 속도도 Speed에 연동 (차분한 질량 교환)
  params.substepAcc += 200 * speed * safeDt;
  const steps = Math.min(Math.floor(params.substepAcc), 50);
  params.substepAcc -= steps;

  for (let s = 0; s < steps; s++) {
    const i = (rand() * nDrops) | 0;
    const n = sites[i];
    if (n > 0) {
      const rate = 1.0 + b / n;
      if (rand() * (1.0 + b) < rate) {
        sites[i]--;
        const dir = rand() < 0.5 ? -1 : 1;
        const target = (i + dir + nDrops) % nDrops;
        sites[target]++;
        if (sites[target] > 70) {
          const split = (sites[target] * 0.45) | 0;
          sites[target] -= split;
          sites[(target + 1) % nDrops] += split;
        }
      }
    }
  }

  // 부드러운 질량 보간 및 유체 궤도 이동
  const cx = w * 0.5;
  const cy = h * 0.5;
  for (let i = 0; i < nDrops; i++) {
    const targetMass = Math.log2(1.0 + sites[i]);
    params.smoothMass[i] += (targetMass - params.smoothMass[i]) * 0.04;

    const mass = params.smoothMass[i];
    const orbitR = Math.max(6.0, 36.0 - mass * 5.5);
    // Speed가 반영된 params.t를 기반으로 한 부드러운 각속도
    const ang = params.t * (0.3 + (i * 0.08)) / Math.max(0.6, mass * 0.5) + i * (6.283 / nDrops);

    const targetX = cx + Math.cos(ang) * (orbitR * 0.75);
    const targetY = cy + Math.sin(ang * 1.2 + i * 0.5) * (orbitR * 1.45);

    // 높은 점성(0.94)을 부여해 급격한 튐 없이 쫀득하게 수렴
    params.dropX[i] += (targetX - params.dropX[i]) * 0.06;
    params.dropY[i] += (targetY - params.dropY[i]) * 0.06;
  }

  params.tension = tension;
  params.radius = radius;
}

export function draw(display, params, time) {
  const w = display.width;
  const h = display.height;
  const nDrops = params.numDrops;
  const xs = params.dropX;
  const ys = params.dropY;
  const masses = params.smoothMass;
  const tension = params.tension || 2.0;
  const baseR = params.radius || 10.0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let field = 0.0;

      // 64x128 비율에 맞춘 연속 유체 전위장
      for (let i = 0; i < nDrops; i++) {
        const dx = x - xs[i];
        const dy = (y - ys[i]) * 0.65;
        const d2 = dx * dx + dy * dy;
        const r = baseR * (0.6 + masses[i] * 0.5);
        field += (r * r) / (d2 + 1.0);
      }

      // 표면 장력 기반 액체 림 셰이딩
      const threshold = 8.0;
      let v = 0.0;
      if (field > threshold) {
        const distInside = (field - threshold) * 0.08 * tension;
        const core = Math.min(1.0, distInside);
        const rim = Math.pow(Math.sin(Math.min(3.14159, distInside * 1.5)), 2.0) * 0.45;
        v = core * 0.65 + rim + 0.2;
      } else {
        v = Math.pow(field / threshold, 3.0) * 0.22;
      }

      const clamped = v < 0.0 ? 0.0 : v > 1.0 ? 1.0 : v;
      display.setValue(x, y, clamped * clamped * (3.0 - 2.0 * clamped));
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
