// ===== Patternflow pattern =====
// Title:    WaveCoupling
// Author:   @engmung
// Date:     2026-08-12
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp oklchLong 0:#000000 1:#a600ff 0.734:#fbff00
// @knobs WaveCoupling=0.02..0.25, Speed=0.2..5.5, Frequency=1.5..8, FrontGlow=0.75..0.98
// @matrix 128x128

// critical knob = WaveCoupling, turning it crosses localized ripple dissipation ↔ global phase-locked avalanche waves

export function setup(params) {
  params.W = 128;
  params.H = 128;
  params.N = params.W * params.H;
  params.t = 0;

  params.potential = new Float32Array(params.N);
  params.phase = new Float32Array(params.N);
  params.fronts = new Float32Array(params.N);
  params.renderBuf = new Float32Array(params.N);

  params.seed = 2026;
  params.rand = () => {
    params.seed = (params.seed * 16807) % 2147483647;
    return (params.seed - 1) / 2147483646;
  };

  params.init = () => {
    params.potential.fill(0);
    params.phase.fill(0);
    params.fronts.fill(0);
    params.renderBuf.fill(0);
    for (let y = 0; y < params.H; y++) {
      for (let x = 0; x < params.W; x++) {
        let idx = y * params.W + x;
        params.potential[idx] = params.rand() * 2.5;
        params.phase[idx] = params.rand() * Math.PI * 2;
      }
    }
  };

  params.init();
}

export function update(dt, input, params) {
  if (input.btnPressed && input.btnPressed[0]) {
    params.init();
  }

  const coupling = input.knobValues[0];
  const speed = input.knobValues[1];
  const freq = input.knobValues[2];
  const persistence = input.knobValues[3];

  const clampedDt = Math.min(dt, 0.1);
  params.t += clampedDt * speed;

  const W = params.W;
  const H = params.H;

  // 연속적 모래 주입: 프레임의 중앙 높이(H * 0.5)를 중심으로 위아래 대칭적으로 파동 형성
  for (let k = 0; k < 3; k++) {
    let sy = Math.floor(H * 0.5 + Math.sin(params.t * 1.2 + k * 2.0) * (H * 0.35));
    let sx = Math.floor(W * 0.5 + Math.cos(params.t * 2.0 + k * 1.5) * (W * 0.35));
    let idx = sy * W + sx;
    if (idx >= 0 && idx < params.N) {
      params.potential[idx] += 1.8 * speed;
    }
  }

  // 결합 파동 붕괴 연산
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      let idx = y * W + x;
      let pot = params.potential[idx];

      if (!Number.isFinite(pot)) {
        params.potential[idx] = 0;
        continue;
      }

      // 위상 연동형 문턱값
      let thresh = 3.0 + Math.sin(params.phase[idx] + params.t * freq) * 0.8;

      if (pot >= thresh) {
        params.potential[idx] -= thresh * 0.7;
        params.fronts[idx] = 1.0;

        let pass = thresh * coupling;
        params.potential[idx - 1] += pass;
        params.potential[idx + 1] += pass;
        // 위아래 전달 비율을 동일하게 맞춰 중심이 위로 치우치지 않게 균형 조정
        params.potential[idx - W] += pass * 0.95;
        params.potential[idx + W] += pass * 1.05;

        params.phase[idx] += 0.4;
      }
    }
  }

  // 잔상 잔류 및 전면부 정밀화
  let maxVal = 0.001;
  for (let i = 0; i < params.N; i++) {
    params.fronts[i] *= persistence;
    params.renderBuf[i] = params.renderBuf[i] * 0.15 + params.fronts[i] * 0.85;
    if (params.renderBuf[i] > maxVal) maxVal = params.renderBuf[i];
  }

  params.maxVal = maxVal;
}

export function draw(display, params, time) {
  const W = display.width;
  const H = display.height;
  const invMax = 1.0 / (params.maxVal || 1.0);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let idx = y * W + x;
      let norm = params.renderBuf[idx] * invMax;
      
      // 선명한 파동 전면을 위한 S-자 톤 곡선
      let v = Math.min(1.0, Math.max(0.0, norm));
      v = v * v * v * (v * (v * 6 - 15) + 10);
      
      display.setValue(x, y, v);
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
