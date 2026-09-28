// ===== Patternflow pattern =====
// Title:   CrystalCascade
// Author:  @engmung
// Date:    2026-07-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp linear 0:#000000 0.743:#ffffff 0.364:#002aff 0.718:#ffcb5c
// @matrix 64x128
// Pattern: Crystal Cascade
// Author: your name here
// SPDX-License-Identifier: CC-BY-SA-4.0
// Date: 2026-07-25
// Made with Patternflow Pattern Lab — https://patternflow.work/pattern-lab


// @knobs CellSize=4..16, DownSpeed=0.2..3, PhaseWarp=0.5..4, EdgeGlow=0.1..0.9

export function setup(params) {
  params.t = 0;
  params.knobValues = [8, 1.5, 2.0, 0.5];
}

export function update(dt, input, params) {
  params.knobValues = input.knobValues;
  params.t += dt * params.knobValues[1];
}

export function draw(display, params, time) {
  const w = display.width;
  const h = display.height;
  const size = params.knobValues[0];
  const warp = params.knobValues[2];
  const glow = params.knobValues[3];
  const t = params.t;

  for (let y = 0; y < h; y++) {
    const yShift = y + t * 20.0;
    for (let x = 0; x < w; x++) {
      const row = Math.floor(yShift / size);
      const col = Math.floor((x + (row % 2) * (size * 0.5)) / size);
      
      const cx = col * size + (row % 2) * (size * 0.5) + size * 0.5;
      const cy = row * size + size * 0.5;
      
      const dx = Math.abs(x - (cx % w));
      const dy = Math.abs(yShift - cy);
      const edgeDist = Math.max(dx, dy) / (size * 0.5);
      
      const phase = Math.sin(col * 0.7 + row * 0.5 + t * warp);
      let v = Math.exp(-Math.abs(edgeDist - 0.8) / (glow * 0.4));
      v *= (0.5 + 0.5 * phase);
      
      display.setValue(x, y, Math.min(1.0, Math.max(0.0, v)));
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
