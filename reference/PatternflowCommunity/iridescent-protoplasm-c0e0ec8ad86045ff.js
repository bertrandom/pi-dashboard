// ===== Patternflow pattern =====
// Title:    Iridescent Protoplasm
// Author:   @martinnlopez
// Date:     2026-08-12
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @knobs Cell_Count=10..60, Speed=0.1..2, Glow=0.5..2, Zoom=0.5..2
// @matrix 64x128

export function setup(params) {
  params.t = 0;
  params.k = [30, 0.5, 1, 1];
  
  // Pre-generate random seeds for 128 potential cells
  params.seeds = [];
  for (let i = 0; i < 128; i++) {
    params.seeds.push({
      x: Math.random() * 1.5,
      y: Math.random() * 2.0,
      spX: 0.5 + Math.random() * 0.5,
      spY: 0.6 + Math.random() * 0.4,
      phsX: Math.random() * 6.28,
      phsY: Math.random() * 6.28,
      baseR: 0.02 + Math.random() * 0.01,
      pulseSp: 1.0 + Math.random() * 3.0
    });
  }
}

export function update(dt, input, params) {
  params.k = input.knobValues;
  params.t += dt * params.k[1];
}

// Shader Math Helpers
const clamp = (val, min, max) => Math.max(min, Math.min(max, val));
const mix = (a, b, t) => a * (1 - t) + b * t;
const softField = (d, r) => {
  let x = clamp(d / r, 0.25, 1.0);
  return Math.pow(1.0 - x, 0.25);
};

export function draw(display, params, time) {
  const w = display.width, h = display.height;
  const t = params.t;
  const [count, speed, glow, zoom] = params.k;
  const cellCount = Math.floor(count);

  // 1. PRE-CALCULATE CELL POSITIONS (Optimization)
  const activeCells = [];
  for (let i = 0; i < cellCount; i++) {
    const s = params.seeds[i];
    const px = s.x + Math.sin(t * s.spX + s.phsX) * 0.25;
    const py = s.y + Math.cos(t * s.spY + s.phsY) * 0.25;
    const pulse = Math.sin(t * s.pulseSp) * 0.00625;
    activeCells.push({ x: px, y: py, r: s.baseR - pulse });
  }

  // 2. PIXEL LOOP
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Normalize UVs and handle aspect ratio like the frag
      const ux = (x / w) * (w / h) * zoom;
      const uy = (y / h) * zoom;

      let field = 0.1;
      let nucleusField = 0.025;

      // 3. ACCUMULATE FIELDS
      for (let i = 0; i < cellCount; i++) {
        const c = activeCells[i];
        const dx = ux - c.x;
        const dy = uy - c.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Membrane Field (Additive)
        field += softField(dist, c.r * 6.25);
        // Nucleus Field (Multiplicative)
        nucleusField *= softField(dist, c.r * 0.25);
      }

      // 4. SHADING & COLOR (Translated from frag GLSL)
      field = clamp(field * 0.2 * glow, 0, 1);
      nucleusField = clamp(nucleusField * 16.0, 0, 1);

      // Iridescent Rainbow logic
      const iriX = uy * 4.0 + field * 32.0 + t * 0.5;
      const getIri = (phase) => 0.25 + 0.5 * Math.sin(phase * iriX);
      
      let cellR = getIri(0.5);
      let cellG = getIri(2.1);
      let cellB = getIri(0.1);

      // Mix Nucleus Color (White/Pinkish tint)
      let nR = mix(cellR, 1.0, nucleusField);
      let nG = mix(cellG, 0.9, nucleusField);
      let nB = mix(cellB, 1.0, nucleusField);

      // Mix Membrane Color (Greenish tint)
      let mR = mix(cellR, 0.2, field * 0.75);
      let mG = mix(cellG, 0.5, field * 0.75);
      let mB = mix(cellB, 0.2, field * 0.75);

      // Final Color composition
      const r = (mR * 0.5 + nR * 0.525) * 255;
      const g = (mG * 0.5 + nG * 0.525) * 255;
      const b = (mB * 0.5 + nB * 0.525) * 255;

      display.setPixel(x, y, r, g, b);
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
