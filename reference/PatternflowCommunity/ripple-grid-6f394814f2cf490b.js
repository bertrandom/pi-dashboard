// ===== Patternflow pattern =====
// Title:   Ripple Grid
// Author:  @engmung
// Date:    2026-07-21
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp linear 0.0:#000000 0.2:#133869 0.4:#00669c 0.6:#2aaac3 0.8:#e0f4f8 1.0:#ffffff
// @knobs Speed=0.2..3, Size=0.5..5, Ripple=0..5, Mirror=1..6

export function setup(params) {
  params.speed = 1.0;
  params.size = 1.0;
  params.ripple = 1.0;
  params.mirror = 2.0;
  params.t = 0;
}

export function update(dt, input, params) {
  if (input && input.knobValues) {
    params.speed = input.knobValues[0];
    params.size = input.knobValues[1];
    params.ripple = input.knobValues[2];
    params.mirror = input.knobValues[3];
  }
  params.t += dt * params.speed;
}

export function draw(display, params, time) {
  const w = display.width;
  const h = display.height;
  const cx = w * 0.5;
  const cy = h * 0.5;
  const t = params.t;
  const mirror = Math.max(1, Math.floor(params.mirror));

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let dx = x - cx;
      let dy = y - cy;
      let dist = Math.sqrt(dx * dx + dy * dy);
      let angle = Math.atan2(dy, dx);
      let rippleOffset = params.ripple * 4.0 * Math.sin(dist * 0.08 - t * 1.5);
      let rx = (dist + rippleOffset) * Math.cos(angle);
      let ry = (dist + rippleOffset) * Math.sin(angle);

      let mx = Math.floor(Math.abs(rx * params.size * 0.1));
      let my = Math.floor(Math.abs(ry * params.size * 0.1));

      let val = 0.0;
      if (((mx & my) % mirror) === 0) {
        val = 1.0 - ((mx ^ my) % 8) / 8.0;
      }
      display.setValue(x, y, Math.max(0.0, Math.min(1.0, val)));
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
