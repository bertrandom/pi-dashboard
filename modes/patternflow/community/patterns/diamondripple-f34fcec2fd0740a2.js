// ===== Patternflow pattern =====
// Title:   DiamondRipple
// Author:  @engmung
// Date:    2026-07-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================
// @matrix 128x128

// @ramp linear 0.581:#ffffff 0.783:#000000
// @knobs Speed=0.1..5, Size=3..20, Ripple=0..5, Width=2..6

// Knobs: 1=animation speed, 2=diamond spacing, 3=ripple intensity, 4=line width
export function setup(params) {
  params.speed = 1.0;
  params.size = 8.0;
  params.ripple = 1.5;
  params.width = 0.4;
  params.t = 0.0;
}

export function update(dt, input, params) {
  if (input && input.knobValues) {
    params.speed = input.knobValues[0];
    params.size = input.knobValues[1];
    params.ripple = input.knobValues[2];
    params.width = input.knobValues[3];
  }
  params.t += dt * params.speed;
}

export function draw(display, params, time) {
  const w = display.width;
  const h = display.height;
  const cx = w / 2;
  const cy = h / 2;
  const t = params.t;
  
  const spacing = params.size * 3;
  const lineWidth = params.width * 6;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let dx = x - cx;
      let dy = y - cy;
      
      let dist = Math.sqrt(dx * dx + dy * dy);
      let angle = Math.atan2(dy, dx);
      let rippleOffset = params.ripple * 4 * Math.sin(dist * 0.08 - t * 1.5);
      
      let rx = (dist + rippleOffset) * Math.cos(angle);
      let ry = (dist + rippleOffset) * Math.sin(angle);

      // 다이아몬드 패턴 (회전된 격자)
      let u = (rx + ry) / spacing;
      let v = (rx - ry) / spacing;
      
      let fu = Math.abs((u % 1.0 + 1.0) % 1.0 - 0.5) * 2;
      let fv = Math.abs((v % 1.0 + 1.0) % 1.0 - 0.5) * 2;
      
      let val = 0.06;
      if (fu < lineWidth * 0.02 || fv < lineWidth * 0.02) {
        val = 1.0;
      }

      display.setValue(x, y, Math.max(0.0, Math.min(1.0, val)));
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
