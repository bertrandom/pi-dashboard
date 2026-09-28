// ===== Patternflow pattern =====
// Title:    RUSH
// Author:   @engmung
// Date:     2026-08-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp oklchLong 0:#000000 0.657:#66ff00 0.077:#c54c44
// @knobs RibDiv=3..16, FallSpeed=5..30, PinchExp=0.3..2.5, RingGlow=0.4..2.5
// @matrix 128x128



export function setup(params) {
  const W = 64;
  const H = 128;
  params.W = W;
  params.H = H;
  params.depth = 0;
  params.bend = 1.0;
}

export function update(dt, input, params) {
  const speed = input.knobValues[1];
  params.depth += dt * speed * 0.12;

  if (input.btnPressed[0]) {
    params.bend = -params.bend;
  }
}

export function draw(display, params, time) {
  const W = display.width;
  const H = display.height;

  const ribDiv = params.knobValues ? params.knobValues[0] : 8.0;
  const pinch = params.knobValues ? params.knobValues[2] : 1.2;
  const glow = params.knobValues ? params.knobValues[3] : 1.4;

  const cx = (W - 1) * 0.5;

  for (let y = 0; y < H; y++) {
    const ny = (y / H);
    const z = Math.pow(ny, pinch);

    const bendX = Math.sin(ny * Math.PI * 2.0 + params.depth * 0.3) * (W * 0.15) * params.bend;

    for (let x = 0; x < W; x++) {
      const nx = (x - cx - bendX) / (W * 0.5);

      const u = Math.atan2(z, nx) / Math.PI;
      const v = (1.0 / (z + 0.08) - params.depth * 2.0) % 1.0;

      const ribWave = Math.cos(u * ribDiv * Math.PI) * 0.5 + 0.5;
      const ringWave = Math.cos(v * Math.PI * 2.0) * 0.5 + 0.5;

      let val = (ribWave * 0.5 + ringWave * 0.5) * (0.3 + z * 0.7);
      val = Math.pow(Math.min(1.0, Math.max(0.0, val)), 1.0 / glow);

      display.setValue(x, y, val);
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
