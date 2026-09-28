// ===== Patternflow pattern =====
// Title:    Standing Wave
// Author:   @martinnlopez
// Date:     2026-08-31
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp hsvShort 0.26:#0e80df 1:#ffffff 0:#1320cf 0.478:#12b0d7 0.089:#1251f8 0.073:#105ada
// @knobs Multiplier=1..8, Glow=0.5..4, Wiggler=1..20, Current=0.1..2
// @matrix 128x128


export function setup(params) {}
export function update(dt, input, params) {
  params.vals = input.knobValues;
}
export function draw(display, params, time) {
  const [mult, glow, wiggle, current] = params.vals;
  const w = display.width, h = display.height;
  const ringR = 0.6;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let ux = (x / w - 0.5) * 2;
      let uy = (y / h - 0.5) * 4;

      // Wiggler: wave interference distortion
      ux += Math.sin(uy * wiggle + time * current) * 0.05;
      uy += Math.cos(ux * wiggle - time * current) * 0.05;

      let r = Math.sqrt(ux * ux + uy * uy);
      let a = Math.atan2(uy, ux);
      let aSym = (a * mult) / Math.PI;

      // Central kaleidoscope pattern
      let v = Math.abs(Math.sin(r * 12 - time * current * 5));
      v *= Math.abs(Math.cos(aSym * 4 + r * 5));
      const core = Math.pow(v, 4.0 / glow);

      // Mask for the central ring band
      const mask = Math.exp(-Math.pow(r - ringR, 2) * 20);

      // --- Ocean-style ripples radiating from the ring ---
      const dist = Math.abs(r - ringR);
      const rippleFreq = wiggle * 1.2;
      const rippleSpeed = current * 4;
      let wave = Math.sin(dist * rippleFreq - time * rippleSpeed);
      wave = Math.max(0, wave);              // crest-only, like light catching a swell
      const decay = 1 / (1 + dist * 3.5);    // waves lose energy as they travel
      let bg = wave * decay;
      bg *= 0.8 + 0.2 * Math.sin(aSym * 2 + time * 0.5); // faint tie to the symmetry
      bg *= 0.35 * glow;                     // Glow brightens the ripples too

      // Electric current flicker — kept local to the ring
      const noise = (Math.sin(x * 0.5 + time * 20) * Math.cos(y * 0.5 - time * 15)) * 0.08;

      let final = core * mask + bg * (1 - mask) + noise * mask;
      display.setValue(x, y, Math.max(0, Math.min(1, final)));
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
