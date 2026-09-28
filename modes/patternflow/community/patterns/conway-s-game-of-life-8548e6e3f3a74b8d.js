// ===== Patternflow pattern =====
// Title:   Conway's Game of Life
// Author:  @AchillesPDX
// Date:    2026-07-02
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================
// @matrix 128x128

// Conway's Game of Life — 128x64 LED matrix
// @knobs Speed=0.0..10.0, Color=0.1..10.0, Mutation=0..4.9, Afterglow=0..1.0
//
// Knob 1 (index 0, 0.0-10.0 wrap):
//   Simulation speed. Controls how many generations advance per second
//   (roughly 1 gen/sec at minimum up to ~24 gens/sec at maximum).
//
// Knob 2 (index 1, 0.1-10.0 clamp):
//   In "Rainbow Drift" / "Age-based" color modes: hue cycle speed
//   (higher = faster color shifting over time).
//   In "Solid" color mode: directly sets the fixed hue itself (no
//   auto-rotation) — turning the knob is the only way the color changes.
//
// Knob 3 (index 2, 0.0-4.9 clamp):
//   Spontaneous mutation rate. Chance per generation that a random dead
//   cell springs to life, keeping the board from ever fully dying out
//   or freezing into a static/still-life state.
//
// Knob 4 (index 3, 0.0-1.0 wrap):
//   Afterglow / fade trail. At 0, cells are strictly ON or OFF with no
//   lingering trail (instant death). Turning it up adds a slow fade-out
//   glow after a cell dies.
//
// Button 1 (btnPressed[0]):
//   Reseed. Randomizes the grid with a fresh ~35% density of live cells.
//
// Button 2 (btnPressed[1]):
//   Cycle color mode: Rainbow Drift (hue flows across space/time) ->
//   Age-based (each cell keeps a random hue from the moment it's born) ->
//   Solid (every live cell shares one fixed hue, set by knob 2).
//
// Button 3 (btnPressed[2]):
//   Pause / resume the simulation. While paused, the grid freezes but
//   color animation and fading still run.
//
// Button 4 (btnPressed[3]):
//   Toggle grid edges between wrap-around (torus, patterns cross edges)
//   and bounded (dead border, patterns die out at the edges).

const GRID_W = 128;
const GRID_H = 128;
const CELL_COUNT = GRID_W * GRID_H;

let cells = new Uint8Array(CELL_COUNT);
let nextCells = new Uint8Array(CELL_COUNT);
let brightness = new Float32Array(CELL_COUNT);
let cellHue = new Float32Array(CELL_COUNT);

let hue = 0;
let genTimer = 0;
let genInterval = 0.1;
let mutationChance = 0;
let fadeFactor = 0;

let colorMode = 0; // 0 = rainbow drift, 1 = age-based, 2 = solid
const COLOR_MODE_COUNT = 3;

let paused = false;
let wrapEdges = true;

let prevBtn1 = false;
let prevBtn2 = false;
let prevBtn3 = false;

function clamp(v, min, max) {
  return v < min ? min : (v > max ? max : v);
}

function reseed() {
  for (let i = 0; i < CELL_COUNT; i++) {
    const alive = Math.random() < 0.35 ? 1 : 0;
    cells[i] = alive;
    nextCells[i] = 0;
    brightness[i] = alive ? 1.0 : 0.0;
    cellHue[i] = Math.random();
  }
}

function stepGeneration() {
  const leftEdgeMaskGlobal = wrapEdges ? 1 : 0;

  for (let y = 0; y < GRID_H; y++) {
    let ny0 = y - 1;
    if (ny0 < 0) ny0 = GRID_H - 1;
    let ny2 = y + 1;
    if (ny2 >= GRID_H) ny2 = 0;

    const row0 = ny0 * GRID_W;
    const row1 = y * GRID_W;
    const row2 = ny2 * GRID_W;

    const topMask = wrapEdges ? 1 : (y > 0 ? 1 : 0);
    const bottomMask = wrapEdges ? 1 : (y < GRID_H - 1 ? 1 : 0);

    for (let x = 0; x < GRID_W; x++) {
      let nx0 = x - 1;
      if (nx0 < 0) nx0 = GRID_W - 1;
      let nx2 = x + 1;
      if (nx2 >= GRID_W) nx2 = 0;

      const leftMask = wrapEdges ? 1 : (x > 0 ? 1 : 0);
      const rightMask = wrapEdges ? 1 : (x < GRID_W - 1 ? 1 : 0);

      const n =
        cells[row0 + nx0] * topMask * leftMask +
        cells[row0 + x] * topMask +
        cells[row0 + nx2] * topMask * rightMask +
        cells[row1 + nx0] * leftMask +
        cells[row1 + nx2] * rightMask +
        cells[row2 + nx0] * bottomMask * leftMask +
        cells[row2 + x] * bottomMask +
        cells[row2 + nx2] * bottomMask * rightMask;

      const idx = row1 + x;
      const wasAlive = cells[idx] === 1;
      let next;
      if (wasAlive) {
        next = (n === 2 || n === 3) ? 1 : 0;
      } else {
        next = (n === 3) ? 1 : 0;
        if (next === 0 && Math.random() < mutationChance) next = 1;
      }
      nextCells[idx] = next;

      // Assign a fresh random hue whenever a cell is born (for age-based mode)
      if (next === 1 && !wasAlive) {
        cellHue[idx] = Math.random();
      }
    }
  }

  for (let i = 0; i < CELL_COUNT; i++) {
    if (nextCells[i] === 1) {
      brightness[i] = 1.0;
    } else if (fadeFactor <= 0) {
      brightness[i] = 0;
    } else {
      brightness[i] *= fadeFactor;
      if (brightness[i] < 0.02) brightness[i] = 0;
    }
  }

  const tmp = cells;
  cells = nextCells;
  nextCells = tmp;
}

function hsvToRgb(h, s, v) {
  h = h - Math.floor(h);
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - s * f);
  const t = v * (1 - s * (1 - f));
  let r, g, b;
  switch (i % 6) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    default: r = v; g = p; b = q; break;
  }
  return [
    clamp(Math.floor(r * 255), 0, 255),
    clamp(Math.floor(g * 255), 0, 255),
    clamp(Math.floor(b * 255), 0, 255)
  ];
}

export function setup(params) {
  hue = 0;
  genTimer = 0;
  genInterval = 0.1;
  mutationChance = 0;
  fadeFactor = 0;
  colorMode = 0;
  paused = false;
  wrapEdges = true;
  prevBtn1 = false;
  prevBtn2 = false;
  prevBtn3 = false;
  reseed();
}

export function update(dt, input, params) {
  const speedRaw = input.knobValues[0]; // 0.0-1.0 wrap, absolute
  const genPerSec = 1 + speedRaw * 23;  // 1 to 24 generations/sec
  genInterval = 1 / genPerSec;

  const hueKnobRaw = input.knobValues[1]; // 0.1-10.0 clamp, absolute

  if (colorMode === 2) {
    // Solid mode: knob 2 directly sets the fixed hue, no auto-rotation
    hue = input.knobNormalized[1];
  } else {
    hue += hueKnobRaw * dt * 0.05;
    hue = hue - Math.floor(hue);
  }

  const mutationNorm = input.knobNormalized[2]; // designer-friendly 0-3% range
  mutationChance = mutationNorm * 0.03;

  // 0 at knob min = strictly on/off, no trail. Ramps up to a slow fade.
  const fadeRaw = input.knobValues[3]; // 0.0-1.0 wrap, absolute
  fadeFactor = fadeRaw * 0.99;

  const btn0 = !!(input.btnPressed && input.btnPressed[0]);
  const btn1 = !!(input.btnPressed && input.btnPressed[1]);
  const btn2 = !!(input.btnPressed && input.btnPressed[2]);
  const btn3 = !!(input.btnPressed && input.btnPressed[3]);

  if (btn0) {
    reseed();
  }

  if (btn1 && !prevBtn1) {
    colorMode = (colorMode + 1) % COLOR_MODE_COUNT;
  }
  prevBtn1 = btn1;

  if (btn2 && !prevBtn2) {
    paused = !paused;
  }
  prevBtn2 = btn2;

  if (btn3 && !prevBtn3) {
    wrapEdges = !wrapEdges;
  }
  prevBtn3 = btn3;

  if (!paused) {
    genTimer += dt;
    let steps = 0;
    while (genTimer >= genInterval && steps < 8) {
      genTimer -= genInterval;
      stepGeneration();
      steps++;
    }
  }
}

export function draw(display, params, time) {
  const w = display.width;
  const h = display.height;
  const stride = GRID_W;

  for (let y = 0; y < h; y++) {
    const row = y * stride;
    for (let x = 0; x < w; x++) {
      const idx = row + x;
      const b = brightness[idx];
      if (b <= 0.001) {
        display.setPixel(x, y, 0, 0, 0);
        continue;
      }

      let pixelHue;
      if (colorMode === 0) {
        // Rainbow drift: hue flows across space and time
        pixelHue = hue + (x + y) * 0.0015;
        pixelHue = pixelHue - Math.floor(pixelHue);
      } else if (colorMode === 1) {
        // Age-based: each cell keeps its birth hue, gently rotated by the hue knob
        pixelHue = cellHue[idx] + hue;
        pixelHue = pixelHue - Math.floor(pixelHue);
      } else {
        // Solid: every live cell shares the same fixed hue
        pixelHue = hue;
      }

      const rgb = hsvToRgb(pixelHue, 0.85, b);
      display.setPixel(x, y, rgb[0], rgb[1], rgb[2]);
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
