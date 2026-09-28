// ===== Patternflow pattern =====
// Title:   Memphis 1.0
// Author:  @AchillesPDX
// Date:    2026-07-02
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @matrix 128x64
// Knob 1 (0.0-1.0, wraps): Palette Shift - rotates which Memphis colors
//   (pink/yellow/cyan/red/violet) are used across the ring, triangle, and dots.
// Knob 2 (0.1-10.0, clamps): Speed - overall animation speed multiplier for
//   the squiggle wave, drifting grid, and orbiting accent shapes.
// Knob 3 (0.0-4.9, clamps): Density - number of scattered accent circles
//   floating over the composition (0 = none, up to 4).
// Knob 4 (0.0-1.0, wraps): Scale - overall size of the ring and triangle
//   shapes, mapped to a friendly 0.7x-1.3x range.
//
// No buttons are used by this pattern.

let t = 0;
let paletteShift = 0;
let speedMult = 1;
let densityVal = 3;
let scaleMult = 1;

const PALETTE = [
  { r: 255, g: 20,  b: 147 }, // hot pink
  { r: 255, g: 214, b: 0   }, // sunshine yellow
  { r: 0,   g: 229, b: 255 }, // cyan
  { r: 255, g: 59,  b: 48  }, // coral red
  { r: 191, g: 64,  b: 255 }, // violet
];

function clamp(v, lo, hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

function hsvToRgb(h, s, v) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const w = v * (1 - (1 - f) * s);
  let r, g, b;
  switch (i % 6) {
    case 0: r = v; g = w; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = w; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = w; g = p; b = v; break;
    default: r = v; g = p; b = q; break;
  }
  return { r: r * 255, g: g * 255, b: b * 255 };
}

function paletteColor(offset) {
  const n = PALETTE.length;
  const pos = (paletteShift * n + offset) % n;
  const i0 = Math.floor(pos) % n;
  const i1 = (i0 + 1) % n;
  const f = pos - Math.floor(pos);
  const c0 = PALETTE[i0];
  const c1 = PALETTE[i1];
  return {
    r: c0.r + (c1.r - c0.r) * f,
    g: c0.g + (c1.g - c0.g) * f,
    b: c0.b + (c1.b - c0.b) * f,
  };
}

function hash1(i) {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function setup(params) {
  t = 0;
  paletteShift = 0;
  speedMult = 1;
  densityVal = 3;
  scaleMult = 1;
}

export function update(dt, input, params) {
  const kv = input.knobValues;
  paletteShift = kv[0];                       // 0.0-1.0 wrap: rotates the memphis color palette
  speedMult = kv[1];                          // 0.1-10.0: overall animation speed
  densityVal = kv[2];                         // 0.0-4.9: number of scattered accent shapes
  const scaleNorm = input.knobNormalized[3];  // designer-friendly mapping, raw calibration preserved
  scaleMult = 0.7 + scaleNorm * 0.6;           // 0.7 - 1.3 overall shape scale

  t += dt * speedMult;
}

export function draw(display, params, time) {
  const width = display.width;
  const height = display.height;

  const bgR = 245, bgG = 238, bgB = 222;

  // ---- shape configuration, computed once per frame outside the pixel loop ----
  const ringCx = width * 0.26;
  const ringCy = height * 0.36;
  const ringOuter = height * 0.30 * scaleMult;
  const ringInner = ringOuter * 0.62;
  const ringOuter2 = ringOuter * ringOuter;
  const ringInner2 = ringInner * ringInner;
  const ringColor = paletteColor(0);

  const triCx = width * 0.72;
  const triCy = height * 0.30;
  const triSize = height * 0.30 * scaleMult;
  const triAngle = t * 0.35;
  const cosA = Math.cos(triAngle);
  const sinA = Math.sin(triAngle);
  const triColor = paletteColor(1.6);
  const triH = triSize;
  const edgeNormals = [
    { nx: 0, ny: -1, d: triH * 0.6 },
    { nx: 0.866, ny: 0.5, d: triH * 0.6 },
    { nx: -0.866, ny: 0.5, d: triH * 0.6 },
  ];

  const squiggleAmp = height * 0.07 * scaleMult;
  const squiggleFreq = 0.16;
  const squiggleSpeed = 1.3;
  const squiggleBaseY = height * 0.78;
  const squiggleThickness = height * 0.045 * scaleMult + 1.5;
  const squiggleColor = { r: 20, g: 20, b: 24 };

  // background dot grid slowly drifts diagonally so it never sits static
  const dotSpacing = 10;
  const dotRadius = 1.6;
  const dotRadius2 = dotRadius * dotRadius;
  const dotColorA = paletteColor(3.2);
  const dotColorB = paletteColor(4.1);
  const gridOffsetX = t * 1.4;
  const gridOffsetY = t * 0.9;

  const accentCount = clamp(Math.floor(densityVal), 0, 4);
  const accents = [];
  for (let i = 0; i < accentCount; i++) {
    const hx = hash1(i * 3.1 + 1.0);
    const hy = hash1(i * 5.7 + 2.0);
    const hs = hash1(i * 7.3 + 3.0);
    const hue = (paletteShift + i * 0.19 + time * 0.02) % 1;
    const col = hsvToRgb(hue, 0.85, 1.0);

    // base position plus a small per-circle orbiting drift so accents
    // gently float instead of staying pinned in place
    const baseX = width * (0.08 + hx * 0.84);
    const baseY = height * (0.55 + hy * 0.4);
    const orbitPhase = i * 1.9 + hs * 6.28;
    const orbitRadius = (height * 0.035) * scaleMult;
    const orbitX = Math.cos(t * 0.8 + orbitPhase) * orbitRadius;
    const orbitY = Math.sin(t * 0.8 + orbitPhase) * orbitRadius;

    accents.push({
      x: baseX + orbitX,
      y: baseY + orbitY,
      r: (height * 0.045 + hs * height * 0.03) * scaleMult,
      col: col,
    });
  }

  for (let x = 0; x < width; x++) {
    const dxRing = x - ringCx;
    const dxTri = x - triCx;

    const colPhase = x * squiggleFreq + t * squiggleSpeed;
    const squiggleY = squiggleBaseY + Math.sin(colPhase) * squiggleAmp;

    const gridX = x + gridOffsetX;
    const cellX = Math.floor(gridX / dotSpacing);
    const gridLocalX = gridX - cellX * dotSpacing - dotSpacing * 0.5;

    for (let y = 0; y < height; y++) {
      let r = bgR, g = bgG, b = bgB;

      // confetti dot grid, background layer, drifting diagonally over time
      const gridY = y + gridOffsetY;
      const cellY = Math.floor(gridY / dotSpacing);
      const gridLocalY = gridY - cellY * dotSpacing - dotSpacing * 0.5;
      const dSq = gridLocalX * gridLocalX + gridLocalY * gridLocalY;
      if (dSq < dotRadius2) {
        const useA = (cellX + cellY) % 2 === 0;
        const dc = useA ? dotColorA : dotColorB;
        r = dc.r; g = dc.g; b = dc.b;
      }

      // scattered accent shapes, each gently orbiting its base position
      for (let i = 0; i < accentCount; i++) {
        const a = accents[i];
        const adx = x - a.x;
        const ady = y - a.y;
        if (adx * adx + ady * ady < a.r * a.r) {
          r = a.col.r; g = a.col.g; b = a.col.b;
        }
      }

      // big ring shape
      const dyRing = y - ringCy;
      const distR2 = dxRing * dxRing + dyRing * dyRing;
      if (distR2 < ringOuter2 && distR2 > ringInner2) {
        r = ringColor.r; g = ringColor.g; b = ringColor.b;
      } else if (distR2 <= ringInner2 * 0.18) {
        r = 30; g = 30; b = 34;
      }

      // rotating triangle
      const dyTri = y - triCy;
      const rdx = dxTri * cosA + dyTri * sinA;
      const rdy = -dxTri * sinA + dyTri * cosA;
      let insideTri = true;
      for (let e = 0; e < 3; e++) {
        const en = edgeNormals[e];
        if (en.nx * rdx + en.ny * rdy > en.d) { insideTri = false; break; }
      }
      if (insideTri) {
        r = triColor.r; g = triColor.g; b = triColor.b;
      }

      // bold black squiggle band, topmost layer
      if (Math.abs(y - squiggleY) < squiggleThickness) {
        r = squiggleColor.r; g = squiggleColor.g; b = squiggleColor.b;
      }

      display.setPixel(x, y, r | 0, g | 0, b | 0);
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
