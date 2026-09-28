// ===== Patternflow pattern =====
// Title:    ForSoundTest
// Author:   @engmung
// Date:     2026-08-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp oklchLong 0:#000000 1:#ffffff
// @knobs Bar1=0..100, Bar2=0..100, Bar3=0..100, Bar4=0..100
// @matrix 64x128



export function setup(params) {}

export function update(dt, input, params) {
  // Knob 1~4: 각 막대의 높이 (0..100)
}

export function draw(display, params, time) {
  const W = display.width;
  const H = display.height;

  const kv = params.knobValues || [50, 50, 50, 50];

  const colWidth = W / 4;
  const barWidth = colWidth * 0.75;
  const margin = (colWidth - barWidth) * 0.5;

  for (let y = 0; y < H; y++) {
    const currentY = H - 1 - y;

    for (let x = 0; x < W; x++) {
      const colIndex = Math.min(3, Math.floor(x / colWidth));
      const colX = x % colWidth;

      const barHeightPx = (kv[colIndex] / 100) * H;
      let val = 0.0;

      // 막대 가로/세로 영역 안쪽인지 확인
      if (colX >= margin && colX < margin + barWidth && currentY < barHeightPx) {
        const isLeftEdge = (colX === Math.floor(margin));
        const isRightEdge = (colX === Math.floor(margin + barWidth - 1));
        const isTopEdge = (currentY >= Math.floor(barHeightPx) - 1);
        const isBottomEdge = (currentY === 0);

        // 테두리는 진하게(1.0), 중간 내부 영역은 연하게(0.25)
        if (isLeftEdge || isRightEdge || isTopEdge || isBottomEdge) {
          val = 1.0;
        } else {
          val = 0.25;
        }
      }

      display.setValue(x, y, val);
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
