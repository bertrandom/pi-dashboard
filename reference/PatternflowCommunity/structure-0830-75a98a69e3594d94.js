// ===== Patternflow pattern =====
// Title:    Structure_0830
// Author:   @engmung
// Date:     2026-08-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp oklchShort 0:#ffffff 0.648:#000000 0.246:#ff0000 0.465:#00bfff
// @knobs WireFreq=1..24, DropSpeed=3..25, NoiseDepth=0.1..2, PlateGain=0.2..2
// @matrix 64x128


export function setup(params) {
  params.yOffset = 0;
  params.gridMode = 0;
}

// Knob 1 (WireFreq): Density of horizontal scanlines and vertical seismic strata
// Knob 2 (DropSpeed): Falling plunge speed into the chasm
// Knob 3 (NoiseDepth): Topographical roughness and fracture amplitude
// Knob 4 (PlateGain): Plateau contrast separating sheer walls from deep abyss
export function update(dt, input, params) {
  const speed = input.knobValues[1];
  params.yOffset += dt * speed * 0.3;

  if (input.btnPressed[0]) {
    params.gridMode = (params.gridMode + 1) % 2;
  }
}

export function draw(display, params, time) {
  const W = display.width;
  const H = display.height;

  const wireFreq = params.knobValues ? params.knobValues[0] : 12.0;
  const noiseDepth = params.knobValues ? params.knobValues[2] : 0.8;
  const plateGain = params.knobValues ? params.knobValues[3] : 1.0;

  const cx = (W - 1) * 0.5;

  for (let y = 0; y < H; y++) {
    const ny = y / H;
    const depthZ = Math.pow(ny, 1.8) + 0.05;

    // Lateral rock face curvature
    const wallSpread = (1.0 - depthZ * 0.7) * (W * 0.38);

    for (let x = 0; x < W; x++) {
      const xDist = Math.abs(x - cx);
      const isWall = xDist > wallSpread;

      // Coordinate projections
      const vCoord = (1.0 / depthZ + params.yOffset);
      const uCoord = (x - cx) / (depthZ * (W * 0.5));

      // Geological strata noise
      const rockNoise = Math.sin(uCoord * 5.0 + Math.cos(vCoord * 3.0)) * noiseDepth;

      // Wireframe grid lines with high tonal separation
      const latLine = Math.pow(Math.cos((vCoord + rockNoise * 0.2) * wireFreq * 0.5) * 0.5 + 0.5, 8.0);
      const longLine = Math.pow(Math.cos(uCoord * 8.0) * 0.5 + 0.5, 8.0);
      const gridVal = Math.max(latLine, longLine);

      let val = 0;
      if (isWall) {
        // High-contrast stepped strata for the walls
        const terrace = ((vCoord * 4.0 + rockNoise) % 1.0);
        val = (terrace > 0.6 ? 0.9 : 0.2) * plateGain + gridVal * 0.4;
      } else {
        // Deep glowing chasm bottom
        const floorGrad = Math.pow(1.0 - (xDist / wallSpread), 2.0);
        val = floorGrad * (0.4 + 0.6 * Math.sin(vCoord * 2.0) * 0.5 + 0.5) * plateGain + gridVal * 0.3;
      }

      display.setValue(x, y, Math.min(1.0, Math.max(0.0, val)));
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
