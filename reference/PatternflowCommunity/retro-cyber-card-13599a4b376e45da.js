// ===== Patternflow pattern =====
// Title:    Retro Cyber Card
// Author:   @martinnlopez
// Date:     2026-09-09
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @knobs MotifSpeed=0.2..2, ScrollSpeed=0.2..3, GlitchChaos=0..1, ColorShift=0..1
// @matrix 64x128

// Knob 1: MotifSpeed - Speed at which geometric patterns evolve
// Knob 2: ScrollSpeed - Smooth continuous animation speed of lines and chevrons
// Knob 3: GlitchChaos - Digital noise and pixel glitch intensity
// Knob 4: ColorShift - Modulates palette balance between Lime, Magenta, and Mint

export function setup(params) {
  params.t = 0;
  params.k = [1.0, 1.5, 0.5, 0.0];
}

export function update(dt, input, params) {
  params.k = input.knobValues;
  params.t += dt * params.k[1];
}

export function draw(display, params, time) {
  const w = display.width;
  const h = display.height;
  const t = params.t;

  const cycleSpeed = params.k[0];
  const glitchChaos = params.k[2];
  const colorShift = params.k[3] * 6.28;
  const emblemScale = 1.4; // Fixed badge scale

  // Smooth continuous motif morphing phase
  const floatPhase = t * cycleSpeed * 0.3;
  const motifA = Math.floor(floatPhase) % 7;
  const motifB = (motifA + 1) % 7;
  const motifBlend = floatPhase - Math.floor(floatPhase);

  // Increased Outer Card Margins to make the border size much larger (like the video)
  const mX = Math.max(4, Math.floor(w * 0.16));
  const mY = Math.max(4, Math.floor(h * 0.10));
  const cardX0 = mX;
  const cardX1 = w - mX;
  const cardY0 = mY;
  const cardY1 = h - mY;

  const cardW = cardX1 - cardX0;
  const cardH = cardY1 - cardY0;
  const cx = Math.floor(w * 0.5);
  const cy = Math.floor(h * 0.5);

  // Central Badge Dimensions
  const badgeHW = Math.floor(cardW * 0.14 * emblemScale);
  const badgeHH = Math.floor(cardH * 0.08 * emblemScale);

  // Tier horizontal dividing rows (4 internal seams creating 5 tiers)
  const yRow1 = cardY0 + Math.floor(cardH * 0.19);
  const yRow2 = cardY0 + Math.floor(cardH * 0.36);
  const yRow3 = cardY0 + Math.floor(cardH * 0.64);
  const yRow4 = cardY0 + Math.floor(cardH * 0.82);

  // Tier vertical dividing columns
  const xCol1 = cardX0 + Math.floor(cardW * 0.28);
  const xCol2 = cardX0 + Math.floor(cardW * 0.50);
  const xCol3 = cardX0 + Math.floor(cardW * 0.72);

  // Base Palette
  const rGreen = 16,  gGreen = 245, bGreen = 90;
  const rPurp  = 185, gPurp  = 25,  bPurp  = 230;
  const rPlum  = 65,  gPlum  = 10,  bPlum  = 48;
  const rMint  = 35,  gMint  = 235, bMint  = 195;
  const rDark  = 15,  gDark  = 15,  bDark  = 20;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // 1. OUTER MARGIN (Thick green and pixelated border field matching video)
      if (x < cardX0 || x >= cardX1 || y < cardY0 || y >= cardY1) {
        const edgeNoise = glitchChaos > 0.1 && ((x * 17 ^ y * 37 ^ Math.floor(t * 4)) & 15) === 0;
        if (edgeNoise) {
          display.setPixel(x, y, rDark, gDark, bDark);
        } else {
          display.setPixel(x, y, rGreen, gGreen, bGreen);
        }
        continue;
      }

      // 2. MAIN CARD PERIMETER FRAME (Thicker 3px dark border matching video)
      const isCardBorder = (x <= cardX0 + 2 || x >= cardX1 - 3 || y <= cardY0 + 2 || y >= cardY1 - 3);
      if (isCardBorder) {
        display.setPixel(x, y, rDark, gDark, bDark);
        continue;
      }

      // 3. CENTRAL HERO BADGE / MICROCHIP EMBLEM
      const dxBadge = Math.abs(x - cx);
      const dyBadge = Math.abs(y - cy);

      if (dxBadge <= badgeHW && dyBadge <= badgeHH) {
        const isBadgeBorder = (dxBadge >= badgeHW - 1 || dyBadge >= badgeHH - 1);
        const isBadgeRim = (dxBadge === badgeHW - 2 || dyBadge === badgeHH - 2);

        if (isBadgeBorder) {
          display.setPixel(x, y, rDark, gDark, bDark);
        } else if (isBadgeRim) {
          display.setPixel(x, y, rGreen, gGreen, bGreen);
        } else {
          const bBit = (((x + y + t * 3.5) % 4 + 4) % 4) < 2;
          if (bBit) {
            display.setPixel(x, y, rGreen, gGreen, bGreen);
          } else {
            display.setPixel(x, y, rPlum, gPlum, bPlum);
          }
        }
        continue;
      }

      // 4. COMPARTMENT BORDERS
      const isSeam = (y === yRow1 || y === yRow2 || y === yRow3 || y === yRow4) ||
                     (y < yRow1 && (x === xCol1 || x === xCol3)) ||
                     (y >= yRow1 && y < yRow2 && x === xCol2) ||
                     (y >= yRow2 && y < yRow3 && (x === cx - badgeHW - 1 || x === cx + badgeHW + 1)) ||
                     (y >= yRow3 && y < yRow4 && x === xCol2) ||
                     (y >= yRow4 && (x === xCol1 || x === xCol3));

      if (isSeam) {
        display.setPixel(x, y, rDark, gDark, bDark);
        continue;
      }

      // 5. COMPARTMENT IDENTIFICATION & SMOOTH MOTIF RENDERING
      let tier = 0;
      if (y < yRow1) tier = 0;
      else if (y < yRow2) tier = 1;
      else if (y < yRow3) tier = 2;
      else if (y < yRow4) tier = 3;
      else tier = 4;

      const isLeft = x < cx;
      const panelSeed = tier * 3 + (isLeft ? 1 : 2);

      const mIdA = (motifA + panelSeed) % 7;
      const mIdB = (motifB + panelSeed) % 7;

      const lx = x - cardX0;
      const ly = y - cardY0;

      function evaluateMotif(mId, px, py) {
        switch (mId) {
          case 0: {
            const boxDist = Math.max(Math.abs(px - (isLeft ? xCol1 : xCol3)), Math.abs(py - (tier < 2 ? (cardY0 + yRow1)/2 : (yRow4 + cardY1)/2)));
            return ((boxDist - t * 2.0) % 3.0 + 3.0) % 3.0 < 1.5;
          }
          case 1: {
            return (((px + py + t * 2.5) % 4.0 + 4.0) % 4.0) < 2.0;
          }
          case 2: {
            return (((px - py + t * 2.5) % 4.0 + 4.0) % 4.0) < 2.0;
          }
          case 3: {
            const vDist = Math.abs(px - cx);
            return (((vDist * 1.4 + py + t * 2.5) % 5.0 + 5.0) % 5.0) < 2.5;
          }
          case 4: {
            return (((py + t * 2.0) % 3.0 + 3.0) % 3.0) < 1.5;
          }
          case 5: {
            return (((Math.floor(px / 2) ^ Math.floor(py / 2)) & 1) === 0);
          }
          case 6: {
            if (glitchChaos < 0.05) return false;
            const noise = Math.sin(Math.floor(px / 2) * 12.9898 + Math.floor(py / 2) * 78.233 + t * 1.2) * 43758.5453;
            return (Math.abs(noise) % 1.0) > 0.5;
          }
        }
        return false;
      }

      const bitA = evaluateMotif(mIdA, x, y);
      const bitB = evaluateMotif(mIdB, x, y);
      const bit = (motifBlend < 0.5) ? bitA : bitB;

      // 6. COMPARTMENT COLOR ASSIGNMENTS
      let fgR = rGreen, fgG = gGreen, fgB = bGreen;
      let bgR = rPlum,  bgG = gPlum,  bgB = bPlum;

      if (tier === 0) {
        if (!isLeft && mIdA === 0) {
          fgR = rMint; fgG = gMint; fgB = bMint;
          bgR = rDark; bgG = gDark; bgB = bDark;
        } else {
          fgR = rPurp; fgG = gPurp; fgB = bPurp;
        }
      } else if (tier === 1) {
        fgR = rPurp; fgG = gPurp; fgB = bPurp;
        bgR = rPlum; bgG = gPlum; bgB = bPurp;
      } else if (tier === 2) {
        fgR = rGreen; fgG = gGreen; fgB = bGreen;
        bgR = rDark;  bgG = gDark;  bgB = bDark;
      } else if (tier === 3) {
        fgR = rPurp;  fgG = gPurp;  fgB = bPurp;
        bgR = rPlum;  bgG = gPlum;  bgB = bPurp;
      } else {
        fgR = rMint; fgG = gMint; fgB = bMint;
        bgR = rPlum; bgG = gPlum; bgB = bPurp;
      }

      if (colorShift > 0.05) {
        const swap = Math.sin(colorShift + tier);
        if (swap > 0.3) {
          const tr = fgR; fgR = bgR; bgR = tr;
        }
      }

      if (bit) {
        display.setPixel(x, y, fgR, fgG, fgB);
      } else {
        display.setPixel(x, y, bgR, bgG, bgB);
      }
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
