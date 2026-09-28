// ===== Patternflow pattern =====
// Title:    Tectonic Mosaic Pulse
// Author:   @martinnlopez
// Date:     2026-09-09
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp hsvLong recolor 0.586:#0432ff 0.697:#73fdff 0.186:#feffff 0.301:#00f900 0.996:#feffff
// @knobs TileSize=3..5, DriftSpeed=0.05..1.2, PulseDepth=0..1, FaultChaos=0..1
// @matrix 64x128


export function setup(params) {
  params.t = 0;
  params.k = [5, 0.35, 0.6, 0.4];
}

export function update(dt, input, params) {
  params.k = input.knobValues;
  // Slow, deliberate geological tempo
  params.t += dt * params.k[1] * 0.5;
}

export function draw(display, params, time) {
  const w = display.width;
  const h = display.height;
  const t = params.t;

  const tileSize = Math.max(3, Math.floor(params.k[0]));
  const pulseDepth = params.k[2];
  const chaos = params.k[3];

  // Rhythmic breathing expansion wave
  const pulse = Math.sin(t * 2.2) * 0.5 + 0.5;
  const groutBevel = 0.55 + pulse * 0.25 * pulseDepth;

  // Tectonic fault-zone dimensions
  const faultW = w * 0.25;
  const faultH = h * 0.20;

  for (let y = 0; y < h; y++) {
    // Horizontal tectonic band shear
    const bandIdY = Math.floor(y / faultH);
    const slipDirX = (bandIdY & 1) === 0 ? 1.0 : -1.0;
    const shearX = slipDirX * (t * 5.0) * chaos;

    for (let x = 0; x < w; x++) {
      // 1. Tectonic Plate Shifting & Shear Faults
      const bandIdX = Math.floor((x + shearX) / faultW);
      // Adjacent vertical plates slip past each other in opposite directions
      const slipDirY = (bandIdX & 1) === 0 ? -1.0 : 1.0;
      const shearY = slipDirY * (t * 8.0) * chaos;

      // Jagged fault displacement
      const faultJitterX = Math.sin(y * 0.18 + t * 0.7) * (chaos * 4.0);
      const faultJitterY = Math.cos(x * 0.18 - t * 0.7) * (chaos * 4.0);

      const shiftedX = x + shearX + faultJitterX;
      const shiftedY = y + shearY + faultJitterY;

      // 2. Discrete Mosaic Tile Coordinates
      const tx = Math.floor(shiftedX / tileSize);
      const ty = Math.floor(shiftedY / tileSize);

      // Local coordinates within the current tile (-0.5 to 0.5)
      const lx = ((shiftedX % tileSize + tileSize) % tileSize) / tileSize - 0.5;
      const ly = ((shiftedY % tileSize + tileSize) % tileSize) / tileSize - 0.5;

      // 3. Fast PRNG Hash per Tile for Deterministic Color Assignment
      let hVal = (tx * 1597334677 ^ ty * 3812015801) >>> 0;
      hVal = Math.imul(hVal ^ (hVal >>> 13), 1274126177);
      const tileHash = ((hVal ^ (hVal >>> 16)) >>> 0) / 4294967296;

      // 4. Macro Composition (Matching the artwork's color layout)
      // Central vertical column is predominantly Magenta/Violet, sides are Lime/Green
      const normCenterX = ((shiftedX - w * 0.5) / (w * 0.5));
      const spineWaver = Math.sin(ty * 0.18 + t * 0.6) * 0.2;
      const distFromSpine = Math.abs(normCenterX + spineWaver);

      let r = 0, g = 0, b = 0;

      if (distFromSpine < 0.38) {
        // === CENTRAL MAGENTA / VIOLET SPINE ===
        if (tileHash < 0.45) {
          // Vibrant Electric Magenta
          r = 215; g = 35; b = 210;
        } else if (tileHash < 0.72) {
          // Deep Orchid / Violet
          r = 150; g = 20; b = 200;
        } else if (tileHash < 0.85) {
          // Soft Lilac / Lavender
          r = 190; g = 90; b = 230;
        } else if (tileHash < 0.94) {
          // Cobalt / Ultramarine tile accent
          r = 45; g = 60; b = 225;
        } else {
          // Hot Coral / Ruby accent
          r = 235; g = 25; b = 65;
        }
      } else {
        // === FLANKING ACID LIME / GREEN FIELDS ===
        if (tileHash < 0.50) {
          // Saturated Acid Lime Green
          r = 85; g = 230; b = 25;
        } else if (tileHash < 0.70) {
          // Fluorescent Chartreuse / Yellow-Green
          r = 145; g = 245; b = 20;
        } else if (tileHash < 0.83) {
          // Vivid Cyan / Turquoise tile
          r = 15; g = 195; b = 240;
        } else if (tileHash < 0.92) {
          // Sunny Amber / Mustard
          r = 245; g = 210; b = 25;
        } else if (tileHash < 0.97) {
          // Warm Tangerine Orange
          r = 245; g = 115; b = 20;
        } else {
          // Stray Violet / Magenta tile
          r = 200; g = 40; b = 190;
        }
      }

      // 5. Rounded Mosaic Cell Bevel & Dark Grout Line
      // Rounded square metric: max(|x|, |y|) with corner radius
      const cornerR = 0.15;
      const qx = Math.max(0, Math.abs(lx) - (0.5 - cornerR));
      const qy = Math.max(0, Math.abs(ly) - (0.5 - cornerR));
      const distToCellEdge = Math.sqrt(qx * qx + qy * qy);

      // Inner tile highlight vs dark grout seam
      const isGrout = (distToCellEdge > cornerR * groutBevel) ||
                      (Math.abs(lx) > 0.44) || (Math.abs(ly) > 0.44);

      if (isGrout) {
        // Translucent dark grout border matching the stained-glass look
        r = Math.floor(r * 0.28 + 12);
        g = Math.floor(g * 0.28 + 16);
        b = Math.floor(b * 0.28 + 18);
      } else {
        // Subtle 3D pillow/bevel highlight in the upper-left of each tile
        const bevel = Math.max(0, (-lx - ly) * 0.35);
        // Seismic breathing brightness pulse
        const tilePulse = Math.sin(t * 3.0 + tileHash * 6.28) * 0.12 * pulseDepth;

        r = Math.min(255, Math.floor(r * (1.0 + bevel + tilePulse)));
        g = Math.min(255, Math.floor(g * (1.0 + bevel + tilePulse)));
        b = Math.min(255, Math.floor(b * (1.0 + bevel + tilePulse)));
      }

      display.setPixel(x, y, r, g, b);
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
