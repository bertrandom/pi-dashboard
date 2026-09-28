// ===== Patternflow pattern =====
// Title:    HUSH Grid
// Author:   @dydydynamiths1312
// Date:     2026-09-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @knobs Size=1..12, Speed=0.1..4, Phase=0..1, Color=1..5
// @matrix 128x64




function pseudoHash(n) {
  let sinVal = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
  return sinVal - Math.floor(sinVal);
}

export function setup(params) {
  params.size = 1.0;     // Knob 1: Grid Density
  params.speed = 0.1;        // Knob 2: Animation Speed
  params.phaseShift = 1.728; // Knob 3: Pattern Seed
  params.colorCycles = 1.0;  // Knob 4: Pseudorandom Color Shifter
  params.timeAcc = 0;
}

export function update(dt, input, params) {
  if (input && input.knobValues) {
    params.size = input.knobValues[0];    // 1.0 to 12.0
    params.speed = input.knobValues[1];       // 0.1 to 10.0
    params.phaseShift = input.knobValues[2];  // 0.0 to 5.0
    params.colorCycles = input.knobValues[3]; // 1.0 to 10.0
  }
  params.timeAcc += dt * (params.speed * 0.15) * 10;
}

// 20 non-grid textile tape prints
function sampleMotif(type, x, y) {
  let ix = Math.floor(x);
  let iy = Math.floor(y);

  switch (type % 20) {
    case 0: { // 1. Concentric Chevrons
      let cy = (((iy + Math.abs((((ix % 12) + 12) % 12) - 6)) % 8) + 8) % 8;
      return cy < 4 ? 1 : 0;
    }
    case 1: { // 2. Floral Petal Blossoms
      let fx = (((ix % 6) + 6) % 6) - 3;
      let fy = (((iy % 6) + 6) % 6) - 3;
      let r2 = fx * fx + fy * fy;
      let petal = (Math.abs(fx) === 1 || Math.abs(fy) === 1) && r2 < 8;
      let center = r2 <= 1;
      return (petal && !center) ? 1 : 0;
    }
    case 2: { // 3. Harlequin Sawtooth Chains
      let tx = (((ix % 6) + 6) % 6);
      let ty = (((iy % 8) + 8) % 8);
      let h = ty < 4 ? ty : 7 - ty;
      return tx <= h ? 1 : 0;
    }
    case 3: { // 4. Bold Graffiti / Camo Stroke
      let v1 = Math.sin(ix * 0.35 + Math.cos(iy * 0.25));
      let v2 = Math.cos(iy * 0.3 + Math.sin(ix * 0.4));
      return (v1 + v2 > 0.2) ? 1 : 0;
    }
    case 4: { // 5. Zebra / Bark Warp Stripes
      let wave = Math.floor(Math.sin(iy * 0.25) * 2.5);
      let sx = (((ix + wave) % 6) + 6) % 6;
      return sx < 3 ? 1 : 0;
    }
    case 5: { // 6. Ornamental Vine Lace
      let dx = Math.abs((((ix % 8) + 8) % 8) - 4);
      let dy = Math.abs((((iy % 8) + 8) % 8) - 4);
      return (dx + dy === 3 || dx + dy === 1) ? 1 : 0;
    }
    case 6: { // 7. Interlocking Herringbone Ribbon
      let hx = (((ix % 8) + 8) % 8);
      let hy = (((iy % 8) + 8) % 8);
      let dir = Math.floor(hx / 4) === 0 ? 1 : -1;
      return (((hy + hx * dir) % 4 + 4) % 4) < 2 ? 1 : 0;
    }
    case 7: { // 8. Micro Chevron Chain / Stitched Zig-Zag
      let zx = (((ix % 6) + 6) % 6);
      let zy = (((iy % 6) + 6) % 6);
      let offset = zx < 3 ? zx : 5 - zx;
      return ((zy + offset) % 3 < 1) ? 1 : 0;
    }
    case 8: { // 9. Bold Diagonal Barcode Slashes
      let s = (((ix * 2 + iy) % 8) + 8) % 8;
      return s < 4 ? 1 : 0;
    }
    case 9: { // 10. Scallop / Fish Scale Weave
      let sx = (((ix % 6) + 6) % 6) - 3;
      let sy = (((iy % 4) + 4) % 4);
      return (sx * sx + sy * sy <= 5) ? 1 : 0;
    }
    case 10: { // 11. Ikat Woven Diamond Argyle
      let dx = Math.abs((((ix % 8) + 8) % 8) - 4);
      let dy = Math.abs((((iy % 8) + 8) % 8) - 4);
      return (dx + dy <= 3) ? 1 : 0;
    }
    case 11: { // 12. Sunburst Radiating Rays
      let rx = (((ix % 10) + 10) % 10) - 5;
      let ry = (((iy % 10) + 10) % 10) - 5;
      let angle = Math.atan2(ry, rx);
      return (Math.floor((angle + Math.PI) * 2.5) % 2 === 0) ? 1 : 0;
    }
    case 12: { // 13. Flame / Wavy Ripple Stripes
      let wave = Math.floor(Math.sin(ix * 0.4) * 2.0);
      let sy = (((iy + wave) % 6) + 6) % 6;
      return sy < 3 ? 1 : 0;
    }
    case 13: { // 14. Interlocking Loop Chain
      let lx = (((ix % 6) + 6) % 6) - 3;
      let ly = (((iy % 6) + 6) % 6) - 3;
      let dist = lx * lx + ly * ly;
      return (dist >= 2 && dist <= 7) ? 1 : 0;
    }
    case 14: { // 15. Cross-Hatch Ribbon Weave
      let h1 = (((ix + iy) % 6) + 6) % 6;
      let h2 = (((ix - iy + 12) % 6) + 6) % 6;
      return (h1 < 2 || h2 < 2) ? 1 : 0;
    }
    case 15: { // 16. Hourglass / Bowtie Stack
      let bx = Math.abs((((ix % 6) + 6) % 6) - 3);
      let by = Math.abs((((iy % 6) + 6) % 6) - 3);
      return bx >= by ? 1 : 0;
    }
    case 16: { // 17. Houndstooth Splatter
      let hx = (((ix % 8) + 8) % 8);
      let hy = (((iy % 8) + 8) % 8);
      let qX = Math.floor(hx / 4);
      let qY = Math.floor(hy / 4);
      if (qX === 0 && qY === 0) return 1;
      if (qX === 1 && qY === 1) return 0;
      return ((hx % 4) + (hy % 4) >= 4) ? 1 : 0;
    }
    case 17: { // 18. Vertical Pin-Stripe Ribs
      let px = (((ix % 5) + 5) % 5);
      return px < 2 ? 1 : 0;
    }
    case 18: { // 19. Concentric Ring Target Waves
      let rx = (((ix % 10) + 10) % 10) - 5;
      let ry = (((iy % 10) + 10) % 10) - 5;
      let dist = Math.floor(Math.sqrt(rx * rx + ry * ry));
      return (dist % 2 === 0) ? 1 : 0;
    }
    default: { // 20. Abstract Splatter Hatch
      let h1 = (((ix + iy * 0.7) % 6) + 6) % 6;
      let h2 = (((ix * 0.7 - iy) % 6) + 6) % 6;
      return (h1 < 2.0 || h2 < 2.0) ? 1 : 0;
    }
  }
}

// Anti-clustering motif selector
function getConstrainedMotif(col, row, seed) {
  let baseHash = pseudoHash(col * 17.3 + row * 31.7 + seed * 11.1);
  let motifIndex = Math.floor(baseHash * 20);

  if (col > 0) {
    let leftHash = pseudoHash((col - 1) * 17.3 + row * 31.7 + seed * 11.1);
    let leftMotif = Math.floor(leftHash * 20);
    if (motifIndex === leftMotif) {
      motifIndex = (motifIndex + 7) % 20;
    }
  }

  if (row > 0) {
    let topHash = pseudoHash(col * 17.3 + (row - 1) * 31.7 + seed * 11.1);
    let topMotif = Math.floor(topHash * 20);
    if (motifIndex === topMotif) {
      motifIndex = (motifIndex + 11) % 20;
    }
  }

  return motifIndex;
}

export function draw(display, params, time) {
  let w = display.width;
  let h = display.height;

  let numRows = Math.floor(1 + ((params.size - 1.0) / 11.0) * 5); // 1 to 6 rows
  let tileSize = h / numRows; 

  let numCols = Math.max(1, Math.round(w / tileSize));
  let actualTileWidth = w / numCols;

  let seed = params.phaseShift;

  let themes = [
    { fg: [210, 35, 35],   bg: [240, 238, 232] }, // Crimson on Cream
    { fg: [20, 20, 22],    bg: [240, 238, 232] }, // Black on Cream
    { fg: [35, 165, 185],  bg: [240, 238, 232] }, // Cyan/Teal on Cream
    { fg: [210, 35, 35],   bg: [20, 20, 22] },    // Crimson on Black
    { fg: [230, 160, 195], bg: [20, 20, 22] },    // Rose Pink on Black
    { fg: [35, 165, 185],  bg: [210, 35, 35] },   // Teal on Crimson
    { fg: [240, 238, 232], bg: [60, 65, 75] },    // Cream on Dark Slate
    { fg: [20, 20, 22],    bg: [35, 165, 185] },  // Black on Cyan
    { fg: [220, 175, 50],  bg: [20, 20, 22] },    // Ochre Gold on Black
    { fg: [240, 238, 232], bg: [210, 35, 35] }   // Cream on Crimson
  ];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let colIdx = Math.floor(x / actualTileWidth);
      let rowIdx = Math.floor(y / tileSize);

      let localX = x % actualTileWidth;
      let localY = y % tileSize;

      // Anti-clustered motif selection
      let motifType = getConstrainedMotif(colIdx, rowIdx, seed);

      // PSEUDORANDOM COLOR SELECTION (Knob 4 introduces non-linear hash permutations)
      let colorStep = Math.floor(params.colorCycles * 4.0); // size knob to distinct steps
      let knobHash = pseudoHash(colorStep * 13.37 + 42.0); // Turn Knob 4 step into a random seed
      
      let tileUniqueSeed = pseudoHash(colIdx * 23.5 + rowIdx * 41.3 + seed * 9.3);
      
      // Combine knob random state with tile uniqueness hash to pick completely scattered themes
      let randomThemeIndex = Math.floor(pseudoHash(knobHash * 100.0 + tileUniqueSeed * 10.0) * themes.length);
      let theme = themes[randomThemeIndex];

      // Movement direction assignment
      let dirHash = pseudoHash(colIdx * 13.1 + rowIdx * 19.3 + seed * 3.7);
      let dir = Math.floor(dirHash * 4);
      let speedMult = 0.8 + pseudoHash(colIdx * 3.3 + rowIdx * 5.5) * 0.4;
      let moveAmount = Math.floor(params.timeAcc * 6.0 * speedMult);

      let offsetX = 0;
      let offsetY = 0;

      switch (dir) {
        case 0: offsetY = -moveAmount; break; // Up
        case 1: offsetY =  moveAmount; break; // Down
        case 2: offsetX = -moveAmount; break; // Left
        case 3: offsetX =  moveAmount; break; // Right
      }

      let patternScale = 0.85;

      let phaseX = Math.floor(pseudoHash(colIdx * 11.3 + rowIdx * 5.7) * 16);
      let phaseY = Math.floor(pseudoHash(colIdx * 3.7 + rowIdx * 13.1) * 16);

      let sampleX = (localX - actualTileWidth / 2 + offsetX) * patternScale + phaseX;
      let sampleY = (localY - tileSize / 2 + offsetY) * patternScale + phaseY;

      let bit = sampleMotif(motifType, sampleX, sampleY);

      if (bit > 0) {
        display.setPixel(x, y, theme.fg[0], theme.fg[1], theme.fg[2]);
      } else {
        display.setPixel(x, y, theme.bg[0], theme.bg[1], theme.bg[2]);
      }
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
