// ===== Patternflow pattern =====
// Title:   CellularAutomataGrowthColumn
// Author:  @engmung
// Date:    2026-07-29
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp step 0.448:#000000 0.752:#ffffff
// @matrix 64x128
// Pattern: Cellular Automata Growth Column
// Author: Patternflow Creator
// SPDX-License-Identifier: CC-BY-SA-4.0
// Date: 2026-07-29
// Made with Patternflow Pattern Lab — https://patternflow.work/pattern-lab


// @knobs RuleSet=1..8, Speed=0.5..5, TrailLen=0..10, Density=1..6

export function setup(params) {
  // 128 x 64 고정 그리드 할당 (메모리 재할당 최소화)
  params.grid = [];
  for (let y = 0; y < 128; y++) {
    params.grid.push(new Float32Array(64));
  }
  
  // 시드(초기 중앙 점) 설정
  params.grid[0][32] = 1.0;
  params.timer = 0;
  params.knobValues = [1, 1, 5, 3];
}

export function update(dt, input, params) {
  if (input && input.knobValues) {
    params.knobValues = input.knobValues;
  }

  const kv = params.knobValues || [1, 1, 5, 3];
  const ruleIdx = Math.floor(kv[0]) - 1; // 1~8 노브 값을 대표적인 Rule로 매핑
  const speed = kv[1];
  const density = kv[3];

  // 흥미롭고 대표적인 1D 셀룰러 오토마타 8가지 규칙 (Rule 30, 90, 110, 150, 182, 22, 126, 54)
  const RULES = [30, 90, 110, 150, 182, 22, 126, 54];
  const ruleNum = RULES[Math.min(7, Math.max(0, ruleIdx))];

  // 속도 조절 타이머 (dt * speed * 프레임 수)
  params.timer += dt * speed * 20.0;

  while (params.timer >= 1.0) {
    params.timer -= 1.0;
    const grid = params.grid;

    // 행 전체를 아래로 1칸씩 이동 (스클롤)
    for (let y = 127; y > 0; y--) {
      for (let x = 0; x < 64; x++) {
        grid[y][x] = grid[y - 1][x];
      }
    }

    // 0번째 행(최상단)에 새로운 오토마타 세대 계산
    const prevRow = grid[1];
    const newRow = grid[0];

    for (let x = 0; x < 64; x++) {
      const left = prevRow[(x - 1 + 64) % 64] > 0.5 ? 1 : 0;
      const center = prevRow[x] > 0.5 ? 1 : 0;
      const right = prevRow[(x + 1) % 64] > 0.5 ? 1 : 0;

      const neighborhood = (left << 2) | (center << 1) | right;
      const state = (ruleNum & (1 << neighborhood)) ? 1.0 : 0.0;
      newRow[x] = state;
    }

    // Density 노브 값에 따른 랜덤 노이즈 노드 주입 (자연스러운 패턴 유도)
    if (Math.random() < (density * 0.03)) {
      newRow[Math.floor(Math.random() * 64)] = 1.0;
    }
  }
}

export function draw(display, params, time) {
  const kv = params.knobValues || [1, 1, 5, 3];
  const trail = kv[2] / 10.0;

  const w = display.width;
  const h = display.height;
  const grid = params.grid;

  for (let y = 0; y < h; y++) {
    // 64x128 그리드 위치 매핑
    const gy = Math.floor((y / h) * 128);
    
    for (let x = 0; x < w; x++) {
      const gx = Math.floor((x / w) * 64);
      let val = grid[gy] ? grid[gy][gx] : 0;

      // TrailLen 노브: 아래로 내려갈수록 스치는 잔상 페이드 효과
      if (val === 0 && gy > 0 && grid[gy - 1]) {
        val = grid[gy - 1][gx] * trail;
      }

      display.setValue(x, y, Math.max(0.0, Math.min(1.0, val)));
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
