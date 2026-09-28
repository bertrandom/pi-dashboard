// ===== Patternflow pattern =====
// Title:   Pattern 0515-3
// Author:  @engmung
// Date:    2026-05-15
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================
// @matrix 128x128

// @knobs hue=0..1, speed=0.1..10, complexity=0..4.9, invert=0..1

// Pattern: 0515-3
// Author: Seunghun LEE
// SPDX-License-Identifier: CC-BY-SA-4.0
// Date: 2026-05-15
// Lineage: AI generated and curated
//
// Variation 2: Grid Interference
function hsvToRgb(h, s, v) {
  h = h - Math.floor(h);
  let i = Math.floor(h * 6);
  let f = h * 6 - i;
  let p = v * (1 - s);
  let q = v * (1 - f * s);
  let t = v * (1 - (1 - f) * s);
  let r, g, b;
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    default: r = v; g = p; b = q; break;
  }
  return [Math.floor(r * 255), Math.floor(g * 255), Math.floor(b * 255)];
}
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

export function setup(params) {
  params.hueBase = 0.6;
  params.speed = 1.0;
  params.freq = 0.1;
  params.chaos = 1.0;
  params.timeAcc = 0.0;
}

// Knob1: Hue, Knob2: Speed, Knob3: Frequency, Knob4: Chaos
export function update(dt, input, params) {
  if (input && input.knobValues) {
    params.hueBase = input.knobValues[0];
    params.speed = input.knobValues[1] * 4 + 0.4;
    params.freq = input.knobValues[2] * 0.15 + 0.05;
    params.chaos = input.knobValues[3] * 3;
  }
  params.timeAcc += dt * params.speed;
}

export function draw(display, params, time) {
  let t = params.timeAcc;
  let f = params.freq;

  for (let y = 0; y < display.height; y++) {
    for (let x = 0; x < display.width; x++) {
      let v1 = Math.sin(x * f + t);
      let v2 = Math.sin(y * f * 1.3 - t * 1.1);
      let v3 = Math.sin((x + y) * f * 0.7 + t * 0.8);
      let v4 = Math.sin((x - y) * f * 1.2 - t * 0.9);

      let field = Math.abs(v1 + v2 + v3 + v4) * (0.4 + params.chaos * 0.1);
      let val = Math.pow(clamp(1.2 - field, 0.0, 1.0), 3.0);

      let hue = (params.hueBase + (x + y) * 0.003 + field * 0.4) % 1;
      let rgb = hsvToRgb(hue, 0.9, val * 0.9 + 0.1);
      display.setPixel(x, y, rgb[0], rgb[1], rgb[2]);
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
