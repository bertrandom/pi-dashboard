// ===== Patternflow pattern =====
// Title:    flower_0920
// Author:   @engmung
// Date:     2026-09-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp oklab 0:#000000 0.835:#ffea00 0.023:#00f01c 0.136:#005c39 0.272:#34ad58 0.42:#b568a0 0.68:#2b00ff
// @knobs BoughCount=4..12, WindBias=-3..3, DrapeLength=0.5..2.5, SwayAmp=0.4..3
// @matrix 128x128



// Knob 1 (BoughCount): Number of willow boughs hanging from canopy
// Knob 2 (WindBias): Directional DC bias tilting the harmonic envelope
// Knob 3 (DrapeLength): Vertical drop and reach of the hanging boughs
// Knob 4 (SwayAmp): Multi-harmonic modal summation amplitude

export function setup(params) {
  params.time = 0;
  params.boughs = 7;
  params.windBias = 0.0;
  params.drape = 1.6;
  params.swayAmp = 1.0;
}

export function update(dt, input, params) {
  const fixedSpeed = 4.0;
  params.time += dt * fixedSpeed;
  params.boughs = Math.floor(input.knobValues[0]);
  params.windBias = input.knobValues[1];
  params.drape = input.knobValues[2];
  params.swayAmp = input.knobValues[3];
}

export function draw(display, params, time) {
  const w = display.width;
  const h = display.height;
  const t = params.time;
  const boughCount = params.boughs;
  const windBias = params.windBias;
  const drape = params.drape;
  const swayAmp = params.swayAmp;
  const twinkle = 6.0;

  const phi = 1.618033;
  const e = 2.718281;
  const pi = 3.141592;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      display.setValue(x, y, 0.0);
    }
  }

  function addPixel(px, py, v) {
    const ix = Math.floor(px);
    const iy = Math.floor(py);
    if (ix >= 0 && ix < w && iy >= 0 && iy < h) {
      display.setValue(ix, iy, Math.min(1.0, Math.max(0.0, v)));
    }
  }

  // 1. 떨어지는 꽃가루/먼지 (줄기와 동일한 푸리에 바람장 적용)
  const dustCount = 14;
  for (let p = 0; p < dustCount; p++) {
    const py = (t * (7.0 + (p % 5) * 1.25) + p * 37.3) % (h + 10) - 5;
    const normY = Math.max(0.0, Math.min(1.0, py / h));

    // 높이와 파티클 고유 위상에 맞춘 복합 바람장 계산
    const pLag = normY * 1.6;
    const pPhase = p * 0.45;
    const pw1 = Math.sin(t * 0.75 - pLag + pPhase) * 3.8;
    const pw2 = Math.sin(t * 0.75 * phi - pLag * 1.4 + pPhase * 0.7) * 2.4;
    const pw3 = Math.sin(t * 0.75 * e - pLag * 2.1 + pPhase * 0.3) * 1.2;
    const pw4 = Math.sin(t * 0.75 * pi - pLag * 2.8) * 0.5;

    const windDisplacement = (pw1 + pw2 + pw3 + pw4) * swayAmp * (0.8 + normY * 0.5);
    const driftBias = windBias * 8.5 * (0.4 + normY * 0.7);

    const px = (p * 27.1 + windDisplacement + driftBias + w * 4.0) % w;

    const flashWave = Math.pow(0.5 + 0.5 * Math.sin(t * 2.5 + p * 2.1), 1.8);
    const coreVal = 0.55 + flashWave * 0.45;
    const haloVal = coreVal * 0.4;

    addPixel(px, py, coreVal);
    addPixel(px, py - 1, haloVal);
    if (p % 2 === 0) {
      addPixel(px + 1, py, haloVal * 0.7);
    }
  }

  // 2. 상단 캐노피 아치
  for (let x = 0; x < w; x++) {
    const arch = Math.sin((x / w) * Math.PI) * 5.0;
    addPixel(x, arch, 0.4);
    addPixel(x, arch + 1, 0.2);
  }

  // 3. 길이 보존(Arc Length Conservation) 버들가지
  for (let b = 0; b < boughCount; b++) {
    const baseFrac = (b + 0.5) / boughCount;
    const naturalShift = Math.sin(b * 3.7 + 1.2) * (0.32 / boughCount);
    const rootX = (baseFrac + naturalShift) * w;
    const rootY = Math.sin((rootX / w) * Math.PI) * 5.0;

    const lengthJitter = Math.sin(b * 2.1) * 14.0 + ((b * 5) % 3) * 8.0;
    const branchLen = (h * 0.45 + lengthJitter) * (drape * 0.65);
    const bPhase = b * 0.5;

    const steps = 70;
    for (let s = 0; s <= steps; s++) {
      const frac = s / steps;
      const nominalDist = frac * branchLen;

      const lag = frac * 1.9;
      const h1 = Math.sin(t * 0.75 - lag + bPhase) * 3.8;
      const h2 = Math.sin(t * 0.75 * phi - lag * 1.4 + bPhase * 0.7) * 2.4;
      const h3 = Math.sin(t * 0.75 * e - lag * 2.1 + bPhase * 0.3) * 1.2;
      const h4 = Math.sin(t * 0.75 * pi - lag * 2.8) * 0.5;

      const fourierSum = (h1 + h2 + h3 + h4) * swayAmp * Math.pow(frac, 1.3);
      const biasOffset = windBias * 7.5 * Math.pow(frac, 1.45);
      const totalDx = biasOffset + fourierSum;

      // 호의 길이 보존 (수평 변위에 따라 수직 높이 리프트)
      const clampedDx = Math.min(Math.abs(totalDx), nominalDist * 0.95);
      const liftY = nominalDist - Math.sqrt(Math.max(0.0, nominalDist * nominalDist - clampedDx * clampedDx));

      const px = rootX + totalDx;
      const py = rootY + nominalDist - liftY;

      const stemTone = 0.25 + (1.0 - frac) * 0.35;
      addPixel(px, py, stemTone);

      // 버들잎 마디
      if (s % 5 === 0 && frac > 0.1) {
        const leafDir = ((s / 5) % 2 === 0) ? 1 : -1;
        const nodeIdx = Math.floor(s / 5);
        const isBigTwinkle = (nodeIdx + b) % 2 === 0;

        const sparkle = Math.pow(0.5 + 0.5 * Math.sin(t * 3.6 + s + b * 2.0), 1.5);
        const leafTone = Math.min(1.0, (0.35 + sparkle * 0.65) * (twinkle * 0.55));

        if (isBigTwinkle) {
          addPixel(px + leafDir, py, leafTone);
          addPixel(px + leafDir * 2, py, leafTone * 0.85);
          addPixel(px + leafDir, py + 1, leafTone * 0.75);
          addPixel(px + leafDir * 2, py + 1, leafTone * 0.6);
          addPixel(px + leafDir * 3, py + 1, leafTone * 0.35);
          addPixel(px + leafDir, py - 1, leafTone * 0.4);
        } else {
          addPixel(px + leafDir, py, leafTone * 0.85);
          addPixel(px + leafDir * 2, py + 1, leafTone * 0.45);
        }
      }
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
