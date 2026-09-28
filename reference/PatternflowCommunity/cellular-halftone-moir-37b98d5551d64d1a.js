// ===== Patternflow pattern =====
// Title:    Cellular Halftone Moiré
// Author:   @martinnlopez
// Date:     2026-09-09
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @knobs CellScale=0.5..3, DriftSpeed=1..5, DotPitch=3..8, Polarity=0..1
// @matrix 64x128

export function setup(params) {
  params.t = 0;
  params.k = [1.2, 0.25, 4, 0];
}

export function update(dt, input, params) {
  params.k = input.knobValues;
  // Slow, meditative temporal drift
  params.t += dt * params.k[1] * 0.4;
}

export function draw(display, params, time) {
  const w = display.width;
  const h = display.height;
  const t = params.t;

  const cellScale = params.k[0] * 0.035;
  const pitch = Math.max(3, Math.floor(params.k[2]));
  const polarity = params.k[3];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // 1. Organic Membrane Simulation (Image 1: Amoeba-like cell boundaries)
      // Domain warping creates the slow, viscous curling of the veins
      const warpX = Math.sin(y * cellScale * 0.8 + t * 0.4) * 2.2;
      const warpY = Math.cos(x * cellScale * 0.8 - t * 0.35) * 2.2;

      const sx = (x + warpX * 4) * cellScale;
      const sy = (y + warpY * 4) * cellScale;

      const wave1 = Math.sin(sx + t * 0.15);
      const wave2 = Math.cos(sy - t * 0.12);
      const wave3 = Math.sin((sx * 0.707 + sy * 0.707) + t * 0.2);

      // Distance to zero-contour forms branching, organic boundaries
      const rawField = (wave1 + wave2 + wave3) / 3.0;
      const membrane = Math.exp(-Math.pow(Math.abs(rawField) * 4.2, 2.0));

      // 2. Micro-Lattice & Moiré Weave (Image 2: Intersecting square/diamond mesh)
      // Fine-grained orthogonal wave matrix
      const microWaveX = Math.cos(x * 1.5708 + t * 0.08);
      const microWaveY = Math.sin(y * 1.5708 - t * 0.06);
      const moireLattice = (microWaveX * microWaveY + 1.0) * 0.5;

      // 3. Halftone Dot Screen Rasterization
      // Find local coordinates within the halftone raster cell
      const cellCenterX = (Math.floor(x / pitch) + 0.5) * pitch;
      const cellCenterY = (Math.floor(y / pitch) + 0.5) * pitch;
      const lx = x - cellCenterX;
      const ly = y - cellCenterY;
      const dotDist = Math.sqrt(lx * lx + ly * ly);

      // Target dot radius: swells thick along the membrane lines,
      // and creates delicate cross-hatch beads in the open voids
      const maxRadius = pitch * 0.65;
      const targetRadius = (membrane * 0.85 + moireLattice * 0.22) * maxRadius;

      // Smooth dot edge transition (anti-aliasing)
      const edge = Math.max(0, Math.min(1, (targetRadius - dotDist) * 1.8 + 0.5));

      // 4. Color / Polarity Composition
      // Polarity = 0: Radiant silver/cyan ink on pitch black (optimized for LED punch)
      // Polarity = 1: Authentic print (black halftone ink on warm white paper)
      let r = 0, g = 0, b = 0;

      if (polarity < 0.5) {
        // Luminous Dark Mode
        const blend = polarity * 2.0;
        const dotBri = edge;
        // Core is stark white, fading softly to cool silver-cyan at dot margins
        const core = Math.pow(dotBri, 3.0);
        r = Math.floor(core * 255 + dotBri * 40 * (1 - blend));
        g = Math.floor(core * 255 + dotBri * 70 * (1 - blend));
        b = Math.floor(core * 255 + dotBri * 110 * (1 - blend));
      } else {
        // Authentic Print Mode (Image 1 & 2 reproduction)
        const blend = (polarity - 0.5) * 2.0;
        // Paper base is clean off-white / light cream
        const paperR = 240, paperG = 242, paperB = 245;
        // Ink is dense charcoal black
        const inkR = 12, inkG = 14, inkB = 18;

        r = Math.floor(paperR * (1.0 - edge) + inkR * edge);
        g = Math.floor(paperG * (1.0 - edge) + inkG * edge);
        b = Math.floor(paperB * (1.0 - edge) + inkB * edge);
      }

      display.setPixel(x, y, r, g, b);
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
