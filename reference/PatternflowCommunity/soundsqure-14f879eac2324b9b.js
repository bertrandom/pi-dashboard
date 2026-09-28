// ===== Patternflow pattern =====
// Title:    Soundsqure
// Author:   @engmung
// Date:     2026-08-31
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp oklchLong 0:#000000 0.943:#ff0000 0.494:#4d4d4d 0.628:#9dff00 0.757:#000000
// @knobs StepSize=1..5, PhaseStep=0..15, Contour=1..12, Scale=1..2.1
// @matrix 64x128

// critical knob = PhaseStep, turning it scrubs directly through 16 discrete timing keyframes

export function setup(params) {
  params.w = 64;
  params.h = 128;
  params.t = 0;
  
  const size = params.w * params.h;
  params.bufA = new Float32Array(size);
  params.bufB = new Float32Array(size);
  params.maxEma = 1.0;

  params.prevPhaseStep = -1;

  // 원본 마름모 대각 반사 초기 패턴
  const cx = params.w / 2;
  const cy = params.h / 2;
  for (let y = 0; y < params.h; y++) {
    for (let x = 0; x < params.w; x++) {
      const d = Math.abs(x - cx) + Math.abs(y - cy);
      params.bufA[y * params.w + x] = (d % 16 < 4) ? 1.0 : 0.0;
    }
  }
}

// Knob 1 (StepSize): 대각선 피드백 이동 스텝
// Knob 2 (PhaseStep): [비트 스크럽] 0~15단계 타이밍 피드백 트리거
// Knob 3 (Contour): [실시간] 등고선 계단 분할 수 (즉시 반영)
// Knob 4 (Scale): [실시간] 마름모 크기 조절 (피드백 없이 즉시 반영)
export function update(dt, input, params) {
  const baseStep = Math.round(input.knobValues[0]);
  const phaseStepInput = input.knobValues[1];
  const contourSteps = input.knobValues[2];
  const scale = input.knobValues[3]; // 1.0 ~ 1.5 범위
  const viscosity = 5.0; // Viscosity 5로 고정

  const w = params.w;
  const h = params.h;

  const currentPhaseStep = Math.floor(Math.min(15, Math.max(0, phaseStepInput)));

  // PhaseStep이 변경될 때만 1비트 피드백 수행
  if (currentPhaseStep !== params.prevPhaseStep) {
    params.prevPhaseStep = currentPhaseStep;

    params.t = currentPhaseStep * (Math.PI / 4.0);
    const t = params.t;

    const halfW = w >> 1;
    const halfH = h >> 1;

    const src = params.bufA;
    const dst = params.bufB;

    const diamondBoundary = halfW - 4;

    for (let y = 0; y < h; y++) {
      const dstRow = y * w;
      const dy = y - halfH;

      for (let x = 0; x < w; x++) {
        const dx = x - halfW;
        const isOutside = (Math.abs(dx) + Math.abs(dy)) > diamondBoundary;
        const dir = isOutside ? -baseStep : baseStep;

        const sx = (x + (dx > 0 ? -dir : dir) + w * 16) % w;
        const sy = (y + (dy > 0 ? -dir : dir) + h * 16) % h;
        dst[dstRow + x] = src[sy * w + sx];
      }
    }

    // 확산 필터 (Viscosity = 5.0 고정)
    const blend = viscosity / (viscosity + 4.0);
    for (let y = 1; y < h - 1; y++) {
      const row = y * w;
      for (let x = 1; x < w - 1; x++) {
        const idx = row + x;
        const neighbors = (dst[idx - w] + dst[idx + w] + dst[idx - 1] + dst[idx + 1]) * 0.25;
        dst[idx] = dst[idx] * (1.0 - blend) + neighbors * blend;
      }
    }

    // 중앙 마름모 코어 주입
    const wave = Math.sin(t * 3.0) * 0.5 + 0.5;
    const coreRadius = 4;

    for (let i = -coreRadius; i <= coreRadius; i++) {
      const px1 = halfW + i;
      const py1 = halfH + (coreRadius - Math.abs(i));
      const py2 = halfH - (coreRadius - Math.abs(i));
      if (px1 >= 0 && px1 < w) {
        if (py1 >= 0 && py1 < h) dst[py1 * w + px1] = wave;
        if (py2 >= 0 && py2 < h) dst[py2 * w + px1] = 1.0 - wave;
      }
    }

    // 버퍼 스왑
    params.bufA = dst;
    params.bufB = src;
  }

  // Scale과 Contour 파라미터는 실시간 렌더링을 위해 상시 파라미터로 저장
  params.contourSteps = contourSteps;
  params.scale = scale;

  // Normalization
  let frameMax = 0.001;
  for (let i = 0; i < w * h; i++) {
    const val = params.bufA[i];
    if (val > frameMax) frameMax = val;
  }
  params.maxEma = params.maxEma * 0.95 + frameMax * 0.05;
}

export function draw(display, params, time) {
  const w = display.width;
  const h = display.height;
  const buf = params.bufA;
  const invMax = 1.0 / Math.max(0.0001, params.maxEma);
  const steps = params.contourSteps || 1.0;
  const scale = params.scale || 1.0;

  const halfW = w >> 1;
  const halfH = h >> 1;

  for (let y = 0; y < h; y++) {
    const row = y * w;
    const dy = (y - halfH) / scale; // Scale에 따른 Y 샘플링 거리 실시간 변형

    for (let x = 0; x < w; x++) {
      const dx = (x - halfW) / scale; // Scale에 따른 X 샘플링 거리 실시간 변형

      // 실시간 확대/축소 좌표 매핑 (중심점 기준 Scale 적용)
      const sampleX = Math.round(halfW + dx);
      const sampleY = Math.round(halfH + dy);

      let normVal = 0;
      if (sampleX >= 0 && sampleX < w && sampleY >= 0 && sampleY < h) {
        normVal = buf[sampleY * w + sampleX] * invMax;
      }

      normVal = normVal < 0 ? 0 : (normVal > 1 ? 1 : normVal);

      // Quantize (Contour) 즉시 반영
      if (steps > 1.01) {
        normVal = Math.floor(normVal * steps) / (steps - 1.0);
        normVal = normVal < 0 ? 0 : (normVal > 1 ? 1 : normVal);
      }

      const v = normVal * normVal * (3.0 - 2.0 * normVal);
      display.setValue(x, y, v);
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
