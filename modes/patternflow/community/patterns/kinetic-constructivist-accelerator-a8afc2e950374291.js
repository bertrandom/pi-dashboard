// ===== Patternflow pattern =====
// Title:    Kinetic Constructivist Accelerator
// Author:   @martinnlopez
// Date:     2026-09-09
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @knobs SpiroRatio=1..7, Speed=0.1..2, OrbitRadius=14..36, WindowDetail=1..4
// @matrix 128x128

// Knob 1: SpiroRatio - Harmonic loop multiplier for the particle trajectory
// Knob 2: Speed - Overall animation speed for orbits, core pulse, and texture drift
// Knob 3: OrbitRadius - Scale of the caliper rings and orbital paths
// Knob 4: WindowDetail - Density of the woven cellular pattern inside the specimen windows

export function setup(params) {
  params.t = 0;
  params.k = [3.0, 1.2, 26, 2.0];
}

export function update(dt, input, params) {
  params.k = input.knobValues;
  params.t += dt * params.k[1];
}

export function draw(display, params, time) {
  const w = display.width;
  const h = display.height;
  const t = params.t;

  const ratio = params.k[0];
  const orbitR = params.k[2];
  const winDetail = params.k[3];

  const cx = w * 0.48;
  const cy = h * 0.52;

  // Breathing pulse for the central core
  const pulse = 1.0 + Math.sin(t * 1.8) * 0.12;

  // Specimen window bounding coordinates
  const b1_x0 = Math.floor(w * 0.04), b1_x1 = Math.floor(w * 0.32);
  const b1_y0 = Math.floor(h * 0.05), b1_y1 = Math.floor(h * 0.28);

  const b2_x0 = Math.floor(w * 0.46), b2_x1 = Math.floor(w * 0.72);
  const b2_y0 = Math.floor(h * 0.02), b2_y1 = Math.floor(h * 0.26);

  const b3_x0 = Math.floor(w * 0.28), b3_x1 = Math.floor(w * 0.65);
  const b3_y0 = Math.floor(h * 0.78), b3_y1 = Math.floor(h * 0.96);

  const b4_x0 = Math.floor(w * 0.02), b4_x1 = Math.floor(w * 0.36);
  const b4_y0 = Math.floor(h * 0.38), b4_y1 = Math.floor(h * 0.52);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // 1. Warm ivory canvas background
      let r = 224, g = 220, b = 208;

      // 2. Specimen Windows with Woven Cellular Texture
      const inBox1 = (x >= b1_x0 && x <= b1_x1 && y >= b1_y0 && y <= b1_y1);
      const inBox2 = (x >= b2_x0 && x <= b2_x1 && y >= b2_y0 && y <= b2_y1);
      const inBox3 = (x >= b3_x0 && x <= b3_x1 && y >= b3_y0 && y <= b3_y1);
      const inBox4 = (x >= b4_x0 && x <= b4_x1 && y >= b4_y0 && y <= b4_y1);

      if (inBox1 || inBox2 || inBox3 || inBox4) {
        const nx = x * (0.20 * winDetail);
        const ny = y * (0.20 * winDetail);
        const n1 = Math.sin(nx + Math.cos(ny * 1.4 + t * 0.25));
        const n2 = Math.cos(ny + Math.sin(nx * 1.4 - t * 0.25));
        const cell = Math.pow(Math.abs(n1 * n2), 0.7);
        const gray = Math.floor(cell * 255);

        // Clean dark outline around the windows
        const isBorder = (inBox1 && (x === b1_x0 || x === b1_x1 || y === b1_y0 || y === b1_y1)) ||
                         (inBox2 && (x === b2_x0 || x === b2_x1 || y === b2_y0 || y === b2_y1)) ||
                         (inBox3 && (x === b3_x0 || x === b3_x1 || y === b3_y0 || y === b3_y1)) ||
                         (inBox4 && (x === b4_x0 || x === b4_x1 || y === b4_y0 || y === b4_y1));

        if (isBorder) {
          r = 30; g = 30; b = 30;
        } else {
          r = gray; g = gray; b = gray;
        }
      }

      // 3. Central Acid-Yellow Organic Core
      const dxB = x - cx;
      const dyB = y - cy;
      const distB = Math.sqrt(dxB * dxB + dyB * dyB);
      const angB = Math.atan2(dyB, dxB);

      const blobLimit = (w * 0.34 * pulse) * (1.0 + Math.sin(angB * 2.0 + 1.1) * 0.22 + Math.cos(angB * 3.0 - 0.5) * 0.14);

      if (distB < blobLimit) {
        r = 238; g = 255; b = 10;
      }

      // 4. Concentric Red Vector Caliper Rings (Horizontal line removed)
      const isInnerRing = Math.abs(distB - (orbitR * 0.72)) < 0.85;
      const isOuterRing = Math.abs(distB - (orbitR * 1.28)) < 0.75;

      if (isInnerRing || isOuterRing) {
        r = 230; g = 30; b = 35;
      }

      display.setPixel(x, y, r, g, b);
    }
  }

  // 5. Kinetic Orbital Swarm (Harmonic Epicycloid Particle Loops)
  const particleCount = 160;
  const rad1 = orbitR * 0.85;
  const rad2 = orbitR * 0.42;

  for (let i = 0; i < particleCount; i++) {
    const phase = (i / particleCount) * 6.28318;
    const movingT = t * 1.1 + phase;

    // Epicycloid orbital formula
    const posX = cx + Math.cos(movingT) * rad1 + Math.cos(movingT * ratio) * rad2;
    const posY = cy + Math.sin(movingT) * rad1 - Math.sin(movingT * ratio) * rad2;

    const jx = Math.sin(i * 87.13) * 3.5;
    const jy = Math.cos(i * 49.71) * 3.5;

    const px = Math.floor(posX + jx);
    const py = Math.floor(posY + jy);

    if (px >= 0 && px < w && py >= 0 && py < h) {
      display.setPixel(px, py, 240, 20, 30);
      // Particle head accent
      if ((i & 7) === 0 && px + 1 < w) {
        display.setPixel(px + 1, py, 255, 15, 20);
      }
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
