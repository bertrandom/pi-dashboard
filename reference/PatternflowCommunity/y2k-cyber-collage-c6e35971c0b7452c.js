// ===== Patternflow pattern =====
// Title:    Y2K Cyber Collage
// Author:   @martinnlopez
// Date:     2026-09-09
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @knobs StaticGrain=0.2..0.8, FlowSpeed=0.1..2, CheckerScale=1..6, Bounce=0..1.5
// @matrix 64x128

// Knob 1: StaticGrain - Density threshold of white vs black in 1-pixel TV static
// Knob 2: FlowSpeed - Tempo of background plasma, star twinkles, and bounce rhythm
// Knob 3: CheckerScale - Tile size of checkerboard ribbons (down to 1x1 micro-pixels)
// Knob 4: Bounce - Elastic vertical bounce and jelly squash-and-stretch of the blobs

export function setup(params) {
  params.t = 0;
  params.k = [0.5, 1.2, 1.0, 0.8];
}

export function update(dt, input, params) {
  params.k = input.knobValues;
  params.t += dt * params.k[1];
}

export function draw(display, params, time) {
  const w = display.width;
  const h = display.height;
  const t = params.t;

  const staticThresh = params.k[0];
  const cSize = Math.max(1, Math.floor(params.k[2]));
  const bounceAmt = params.k[3];

  // 24 FPS stepped clock for authentic analog TV noise
  const staticFrame = Math.floor(time * 24.0);

  // Elastic vertical bounce with independent phase per blob
  const bounceHeight = h * 0.032 * bounceAmt;
  const bY1 = Math.abs(Math.sin(t * 2.2)) * bounceHeight;
  const bY2 = Math.abs(Math.sin(t * 2.2 + 1.2)) * bounceHeight;
  const bY3 = Math.abs(Math.sin(t * 2.2 + 2.4)) * bounceHeight;

  // Elastic gelatinous squash-and-stretch
  const stretch1 = 1.0 + Math.cos(t * 4.4) * (0.10 * bounceAmt);
  const squash1 = 1.0 / stretch1;
  const stretch2 = 1.0 + Math.cos(t * 4.4 + 2.4) * (0.10 * bounceAmt);
  const squash2 = 1.0 / stretch2;
  const stretch3 = 1.0 + Math.cos(t * 4.4 + 4.8) * (0.10 * bounceAmt);
  const squash3 = 1.0 / stretch3;

  // Blob base positions and radii
  const blob1_x = w * 0.42, blob1_y = h * 0.22 - bY1, blob1_r = w * 0.36;
  const blob2_x = w * 0.60, blob2_y = h * 0.48 - bY2, blob2_r = w * 0.39;
  const blob3_x = w * 0.38, blob3_y = h * 0.74 - bY3, blob3_r = w * 0.37;

  // Checkerboard ribbon parameters
  const rib1_x = w * 0.58, rib1_y = h * 0.11, rib1_rx = w * 0.32, rib1_ry = h * 0.034;
  const rib2_x = w * 0.48, rib2_y = h * 0.35, rib2_rx = w * 0.28, rib2_ry = h * 0.031;
  const rib3_x = w * 0.45, rib3_y = h * 0.62, rib3_rx = w * 0.30, rib3_ry = h * 0.033;
  const rib4_x = w * 0.52, rib4_y = h * 0.88, rib4_rx = w * 0.34, rib4_ry = h * 0.034;

  // 1-pixel precision sparkle star positions
  const s1x = Math.floor(w * 0.18), s1y = Math.floor(h * 0.16);
  const s2x = Math.floor(w * 0.34), s2y = Math.floor(h * 0.21);
  const s3x = Math.floor(w * 0.74), s3y = Math.floor(h * 0.42);
  const s4x = Math.floor(w * 0.62), s4y = Math.floor(h * 0.76);
  const s5x = Math.floor(w * 0.78), s5y = Math.floor(h * 0.94);

  for (let y = 0; y < h; y++) {
    const ny = y / h;

    for (let x = 0; x < w; x++) {
      const nx = x / w;

      // 1. LAYER 1: Shifting Psychedelic Thermal Plasma (1-Pixel Dither Overlay)
      const p1 = Math.sin(nx * 4.0 + t * 0.8) * Math.cos(ny * 3.5 - t * 0.6);
      const p2 = Math.sin((nx + ny) * 3.0 + p1 * 1.5 + t * 0.4);

      let r = Math.floor(180 + Math.sin(p2 * 2.5 + t * 0.3) * 65);
      let g = Math.floor(20 + Math.sin(p2 * 3.0 + 1.2) * 20);
      let b = Math.floor(160 + Math.cos(p2 * 2.0 - t * 0.5) * 85);

      // Single-pixel checkerboard halftone stipple (1x1 micro-texture)
      if ((x ^ y) & 1) {
        r = Math.min(255, r + 24);
        g = Math.min(255, g + 24);
        b = Math.min(255, b + 30);
      } else {
        r = Math.floor(r * 0.84);
        g = Math.floor(g * 0.84);
        b = Math.floor(b * 0.88);
      }

      // 2. LAYER 2: 1-Pixel Crisp Red-and-Black Hazard Scanlines
      if (x < w * 0.34 && y > h * 0.84) {
        const isRed = ((y + Math.floor(t * 3.0)) & 1) === 0;
        if (isRed) {
          r = 245; g = 20; b = 30;
        } else {
          r = 15; g = 15; b = 20;
        }
      }

      // 3. LAYER 3: 1-Pixel Vertical Glitch / Data-Mosh Column
      if (x > w * 0.83 && y < h * 0.30) {
        const tearShift = Math.sin(x * 12.3 + t * 4.0) * 8.0;
        const gy = (y + Math.floor(tearShift)) & 7;
        if (gy < 3) {
          r = 245; g = 20; b = 150; // Hot Magenta
        } else if (gy < 5) {
          r = 15; g = 15; b = 20;   // Dark
        } else {
          r = 20; g = 50; b = 230;  // Electric Blue
        }
      }

      // 4. LAYER 4: Organic Amoeba / Jelly Blobs (Multi-Lobed Shape Math)
      // Blob 1
      const b1_dx = (x - blob1_x) * squash1;
      const b1_dy = (y - blob1_y) * stretch1;
      const b1_dist = Math.sqrt(b1_dx * b1_dx + b1_dy * b1_dy);
      const b1_ang = Math.atan2(b1_dy, b1_dx);
      const b1_limit = (blob1_r * 0.68) * (1.0 + Math.sin(b1_ang * 2.0 + t * 0.8) * 0.18 + Math.cos(b1_ang * 3.0 - t * 0.6) * 0.14 + Math.sin(b1_ang * 5.0) * 0.06);

      // Blob 2
      const b2_dx = (x - blob2_x) * squash2;
      const b2_dy = (y - blob2_y) * stretch2;
      const b2_dist = Math.sqrt(b2_dx * b2_dx + b2_dy * b2_dy);
      const b2_ang = Math.atan2(b2_dy, b2_dx);
      const b2_limit = (blob2_r * 0.68) * (1.0 + Math.cos(b2_ang * 2.0 - t * 0.7) * 0.20 + Math.sin(b2_ang * 4.0 + t * 0.5) * 0.12 + Math.cos(b2_ang * 5.0) * 0.05);

      // Blob 3
      const b3_dx = (x - blob3_x) * squash3;
      const b3_dy = (y - blob3_y) * stretch3;
      const b3_dist = Math.sqrt(b3_dx * b3_dx + b3_dy * b3_dy);
      const b3_ang = Math.atan2(b3_dy, b3_dx);
      const b3_limit = (blob3_r * 0.66) * (1.0 + Math.sin(b3_ang * 3.0 + t * 0.9) * 0.16 + Math.cos(b3_ang * 2.0 - t * 0.4) * 0.15 + Math.sin(b3_ang * 6.0) * 0.06);

      const inBlob = (b1_dist < b1_limit) || (b2_dist < b2_limit) || (b3_dist < b3_limit);
      const isBlobEdge = (!inBlob) && (
        (b1_dist < b1_limit + 1.2) || (b2_dist < b2_limit + 1.2) || (b3_dist < b3_limit + 1.2)
      );

      if (isBlobEdge) {
        // Crisp 1-pixel dark contour boundary around the jelly blob
        r = 15; g = 15; b = 20;
      } else if (inBlob) {
        // Native 1-pixel television static noise
        let hVal = (x * 1597334677 ^ y * 3812015801 ^ staticFrame * 1274126177) >>> 0;
        hVal = Math.imul(hVal ^ (hVal >>> 13), 1274126177);
        const noise = ((hVal ^ (hVal >>> 16)) >>> 0) / 4294967296;

        const val = noise > staticThresh ? 235 : 20;
        r = val; g = val; b = val;
      }

      // 5. LAYER 5: Interleaved Checkerboard Capsules (Supports 1x1 Micro-Pixels)
      const r1 = Math.pow((x - rib1_x) / rib1_rx, 2) + Math.pow((y - rib1_y) / rib1_ry, 2);
      const r2 = Math.pow((x - rib2_x) / rib2_rx, 2) + Math.pow((y - rib2_y) / rib2_ry, 2);
      const r3 = Math.pow((x - rib3_x) / rib3_rx, 2) + Math.pow((y - rib3_y) / rib3_ry, 2);
      const r4 = Math.pow((x - rib4_x) / rib4_rx, 2) + Math.pow((y - rib4_y) / rib4_ry, 2);

      const inRibbon = (r1 < 1.0 || r2 < 1.0 || r3 < 1.0 || r4 < 1.0);
      const isRibbonEdge = (!inRibbon) && (r1 < 1.14 || r2 < 1.15 || r3 < 1.14 || r4 < 1.14);

      if (isRibbonEdge) {
        // 1-pixel black rim around checkerboard capsules
        r = 15; g = 15; b = 20;
      } else if (inRibbon) {
        // 1-pixel micro-checkers when cSize = 1
        const check = ((Math.floor(x / cSize) ^ Math.floor(y / cSize)) & 1) === 0;
        if (check) {
          r = 255; g = 255; b = 255;
        } else {
          r = 15; g = 15; b = 20;
        }
      }

      // 6. LAYER 6: Crisp 1-Pixel Arm 4-Pointed Sparkle Stars
      const testStar = (sx, sy, seed) => {
        const dxs = Math.abs(x - sx);
        const dys = Math.abs(y - sy);
        const twinkle = Math.sin(t * 3.5 + seed) * 0.35 + 0.65;
        if (dxs === 0 && dys < 4) return Math.floor((1.0 - dys / 4) * 255 * twinkle);
        if (dys === 0 && dxs < 4) return Math.floor((1.0 - dxs / 4) * 255 * twinkle);
        if (dxs === 1 && dys === 1) return Math.floor(180 * twinkle);
        return 0;
      };

      const starBri = Math.max(
        testStar(s1x, s1y, 1.1),
        testStar(s2x, s2y, 2.7),
        testStar(s3x, s3y, 4.3),
        testStar(s4x, s4y, 5.9),
        testStar(s5x, s5y, 7.2)
      );

      if (starBri > 0) {
        r = Math.max(r, starBri);
        g = Math.max(g, starBri);
        b = Math.max(b, starBri);
      }

      display.setPixel(x, y, r, g, b);
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
