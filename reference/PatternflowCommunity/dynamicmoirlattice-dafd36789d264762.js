// ===== Patternflow pattern =====
// Title:   DynamicMoirLattice
// Author:  @engmung
// Date:    2026-07-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp hsvLong 0.03:#00b3ff 0.84:#000000 0.465:#ff5900
// @matrix 64x128
// @knobs Speed=0.1..6, LatticeScale=2..10, Angle=90..100, DynamicGlow=0.2..3

// Knob 1 (Speed): 회전 및 이동 속도
// Knob 2 (LatticeScale): 기본 격자 세밀도
// Knob 3 (Angle): 두 격자 간의 교차 각도
// Knob 4 (DynamicGlow): 중앙 스팟라이트 대비

export function setup(params) {
  params.speed = 0.5;
  params.scale = 5.0;
  params.angle = 0.4;
  params.glow = 0.7;
  params.t = 0.0;
}

export function update(dt, input, params) {
  if (input && input.knobValues) {
    params.speed = input.knobValues[0];
    params.scale = input.knobValues[1];
    params.angle = input.knobValues[2];
    params.glow = input.knobValues[3];
  }
  params.t += dt * params.speed;
}

export function draw(display, params, time) {
  const w = display.width;
  const h = display.height;
  const cx = w / 2;
  const cy = h / 2;
  const scale = params.scale;
  const rot = params.angle + Math.sin(params.t * 0.5) * 0.2;

  const cosA = Math.cos(rot);
  const sinA = Math.sin(rot);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx;
      const dy = y - cy;

      // 레이어 1: 직선 격자
      const l1 = Math.sin(dx / scale) * Math.sin(dy / scale);

      // 레이어 2: 회전된 격자
      const rx = dx * cosA - dy * sinA;
      const ry = dx * sinA + dy * cosA;
      const l2 = Math.sin(rx / scale + params.t) * Math.sin(ry / scale + params.t);

      // 간섭 유도
      let interference = (l1 + l2) * 0.5;
      
      // 하드 콘트라스트 전환
      let val = Math.pow(Math.abs(interference), 1.5) * 1.8;

      // 세로 비넷팅
      const distFromCenter = Math.sqrt(dx * dx + (dy * 0.5) * (dy * 0.5)) / (w * 0.8);
      val *= Math.max(0.1, 1.0 - distFromCenter * (1.0 - params.glow));

      display.setValue(x, y, Math.max(0.0, Math.min(1.0, val)));
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
