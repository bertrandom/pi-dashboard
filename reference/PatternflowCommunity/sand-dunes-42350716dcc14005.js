// ===== Patternflow pattern =====
// Title:   Sand Dunes
// Author:  @AchillesPDX
// Date:    2026-07-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// ============================================================
// SAND / DUNE PILE SIMULATOR (cellular automaton, not physics)
// ============================================================
// @knobs Fall Rate=0.0..1.0, Angle Threshold=0.1..10.0, Saturation=0.0..4.9, EmitVariation=0.0..1.0
// Knob 1 (index 0, 0.0-1.0 wrap):  FALL RATE
//   Controls both how often new grains spawn (base rate, before
//   per-emitter scaling) and how many settle-steps run per second.
// Knob 2 (index 1, 0.1-10.0 clamp): PILE ANGLE THRESHOLD
//   Low = shallow, spread-out dunes (grains actively roll to the
//   nearest low spot within reach). High = tall, steep pyramids
//   that hold their shape (little to no sideways leveling).
// Knob 3 (index 2, 0.0-4.9 clamp): EMITTER SATURATION
//   Each active emitter (stream) has its own fixed hue, assigned
//   when it's created. At 0, every grain looks sandy/amber
//   regardless of which emitter it fell from. At 4.9, each
//   emitter's grains are fully saturated in its assigned hue.
// Knob 4 (index 3, 0.0-1.0 wrap):  EMITTER RATE CONTRAST
//   Each emitter has a fixed random rate weight, assigned when
//   it's created. At 0, every emitter ticks at the exact same
//   steady rate. At 1 (times RATE_CONTRAST_BOOST below), that
//   spread is fully revealed - each emitter still spawns at its
//   own constant, metronomic rate, but some are much faster than
//   others.
// Button 0: RESET  - clears the entire pile back to empty.
// Button 1: TILT   - kicks off a temporary avalanche by making
//                    grains slide and spread much more easily.
// Button 2: EMITTER COUNT - cycles active emitter count 1->2->3->
//                    4->5->1, re-randomizing positions, hues, rate
//                    weights, and brightness baselines each press.
// Button 3: SIM ORIENTATION - toggles the simulation itself
//                    between a wide 128x64 grid and a narrow
//                    64x128 grid (gravity always falls along the
//                    simulation's own "tall" axis). Resets the
//                    pile and re-randomizes emitters each toggle,
//                    since the old layout doesn't carry over.
// ============================================================

const DEBUG_SPEED_MULTIPLIER = 1; // set higher (e.g. 8) for fast-forward testing
const BRIGHTNESS_CONTRAST = 0.5;  // fixed emitter brightness contrast (0 = uniform, 1 = full spread)
const RATE_CONTRAST_BOOST = 1.0;  // >1.0 pushes emitter rate spread beyond what knob 4 alone can reach

const MAX_CELLS = 128 * 64; // fixed backing buffer size, reused for either orientation
const MAX_DIM = 128;        // largest possible simW or simH, used to size scratch arrays
const SPREAD_REACH = 8;     // how many columns either side the spread pass can scan
const MAX_STREAMS = 5;      // maximum number of simultaneous fall points
const SANDY_HUE = 32;       // warm amber base hue used at low saturation
const BRIGHTNESS_CENTER = 10.0; // baseline brightness all emitters converge to at 0 contrast

let simW = 128; // current simulation width (128 = wide, 64 = narrow)
let simH = 64;  // current simulation height (64 = wide, 128 = narrow)

let grid = null;      // occupancy grid, 1 = sand, 0 = empty (indexed with current simW)
let cellHue = null;   // per-cell hue byte (0-255 -> 0-360deg), set at grain birth
let cellSat = null;   // per-cell saturation byte (0-255), set at grain birth
let cellVal = null;   // per-cell brightness byte (0-255), set at grain birth
let colTop = null;    // per-column topmost RESTING row (scratch buffer, sized MAX_DIM)

let streamPositions = null;   // Int16Array(MAX_STREAMS), fixed until regenerated
let streamHues = null;        // Float32Array(MAX_STREAMS), fixed alongside positions
let streamBrightness = null;  // Float32Array(MAX_STREAMS), fixed alongside positions
let streamRateBias = null;    // Float32Array(MAX_STREAMS), fixed alongside positions
let streamSpawnAccum = null;  // Float32Array(MAX_STREAMS), each emitter's own metronome accumulator
let streamCount = 1;
let streamRegenSeed = 0;

let simAccum = 0;
let frameCounter = 0;
let avalancheTimer = 0;
let spawnSeed = 0;
let prevBtn0 = false;
let prevBtn1 = false;
let prevBtn2 = false;
let prevBtn3 = false;

function clamp(v, lo, hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

// 32-bit integer hash (Murmur3-style finalizer). Cheap: just
// multiplies and shifts, well-distributed for both small
// sequential inputs and large mixed products.
function hash1(n) {
  n = n | 0;
  n = Math.imul(n ^ (n >>> 16), 2246822519);
  n = Math.imul(n ^ (n >>> 13), 3266489917);
  n = (n ^ (n >>> 16)) >>> 0;
  return n & 0x7fffffff;
}

function hash01(n) {
  return hash1(n) / 0x7fffffff;
}

function hsvToRgb(h, s, v) {
  h = ((h % 360) + 360) % 360;
  const c = v * s;
  const hh = h / 60;
  const x = c * (1 - Math.abs((hh % 2) - 1));
  let r = 0, g = 0, b = 0;
  if (hh < 1)      { r = c; g = x; b = 0; }
  else if (hh < 2) { r = x; g = c; b = 0; }
  else if (hh < 3) { r = 0; g = c; b = x; }
  else if (hh < 4) { r = 0; g = x; b = c; }
  else if (hh < 5) { r = x; g = 0; b = c; }
  else             { r = c; g = 0; b = x; }
  const m = v - c;
  return {
    r: clamp(Math.floor((r + m) * 255), 0, 255),
    g: clamp(Math.floor((g + m) * 255), 0, 255),
    b: clamp(Math.floor((b + m) * 255), 0, 255)
  };
}

function clearGrid() {
  for (let i = 0; i < grid.length; i++) grid[i] = 0;
}

// Assigns a permanent birth color to a newly spawned grain, blended
// between the shared sandy base hue and its emitter's fixed hue
// (by saturation knob), and between a shared brightness center and
// its emitter's fixed brightness (by the fixed brightness contrast).
function assignGrainColor(idx, streamIdx, saturation) {
  const targetHue = streamHues[streamIdx];
  let diff = targetHue - SANDY_HUE;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  let hue = SANDY_HUE + diff * saturation;
  hue = ((hue % 360) + 360) % 360;
  const sat = 0.12 + saturation * 0.78; // 0.12 sandy -> 0.90 vivid

  const baseVal = BRIGHTNESS_CENTER + (streamBrightness[streamIdx] - BRIGHTNESS_CENTER) * BRIGHTNESS_CONTRAST;

  cellHue[idx] = clamp(Math.round((hue / 360) * 255), 0, 255);
  cellSat[idx] = clamp(Math.round(sat * 255), 0, 255);
  cellVal[idx] = clamp(Math.round(clamp(baseVal, 0, 1) * 255), 0, 255);
}

// One discrete settle pass: grains fall straight down if possible,
// otherwise slide diagonally if a clear diagonal path of length
// angleT is open. Moves each grain's stored birth color along with it.
// Always operates against the CURRENT simW/simH.
function settleStep(angleT, seed) {
  for (let y = simH - 2; y >= 0; y--) {
    const rowIdx = y * simW;
    const belowRowIdx = rowIdx + simW;
    for (let x = 0; x < simW; x++) {
      const idx = rowIdx + x;
      if (grid[idx] === 0) continue;

      const belowIdx = belowRowIdx + x;
      if (grid[belowIdx] === 0) {
        grid[belowIdx] = 1;
        grid[idx] = 0;
        cellHue[belowIdx] = cellHue[idx];
        cellSat[belowIdx] = cellSat[idx];
        cellVal[belowIdx] = cellVal[idx];
        continue;
      }

      const leftOk = x > 0 && grid[belowIdx - 1] === 0;
      const rightOk = x < simW - 1 && grid[belowIdx + 1] === 0;
      if (!leftOk && !rightOk) continue;

      let dir;
      if (leftOk && rightOk) {
        dir = (hash1(x * 928371 + y * 128371 + seed) & 1) ? -1 : 1;
      } else {
        dir = leftOk ? -1 : 1;
      }

      let clearPath = true;
      for (let k = 1; k <= angleT; k++) {
        const cx = x + dir * k;
        const cy = y + k;
        if (cx < 0 || cx >= simW || cy >= simH) break;
        if (grid[cy * simW + cx] !== 0) { clearPath = false; break; }
      }

      if (clearPath) {
        const destIdx = belowIdx + dir;
        grid[destIdx] = 1;
        grid[idx] = 0;
        cellHue[destIdx] = cellHue[idx];
        cellSat[destIdx] = cellSat[idx];
        cellVal[destIdx] = cellVal[idx];
      }
    }
  }
}

// Compute each column's topmost RESTING grain (touching the floor,
// or sitting on another grain directly below it). A grain still
// falling through open air is skipped over so the spread pass
// never grabs an in-flight grain.
function computeColTop() {
  for (let x = 0; x < simW; x++) {
    let top = simH;
    for (let y = 0; y < simH; y++) {
      if (grid[y * simW + x] === 1) {
        const resting = (y + 1 >= simH) || grid[(y + 1) * simW + x] === 1;
        if (resting) { top = y; break; }
      }
    }
    colTop[x] = top;
  }
}

// Lateral leveling pass: for each resting column top, looks up to
// SPREAD_REACH columns either side for the lowest nearby spot; if
// the height difference clears minDiff, moves one grain (and its
// birth color) directly there.
function spreadPass(prob, minDiff, seed) {
  if (prob <= 0) return;
  computeColTop();

  const leftToRight = (seed & 1) === 0;
  const start = leftToRight ? 0 : simW - 1;
  const end = leftToRight ? simW : -1;
  const step = leftToRight ? 1 : -1;

  for (let x = start; x !== end; x += step) {
    const topX = colTop[x];
    if (topX >= simH) continue;
    if (hash01(x * 97 + seed * 13) > prob) continue;

    let bestCol = -1;
    let bestTop = topX;
    for (let d = 1; d <= SPREAD_REACH; d++) {
      const l = x - d;
      const r = x + d;
      if (l >= 0 && colTop[l] > bestTop) { bestTop = colTop[l]; bestCol = l; }
      if (r < simW && colTop[r] > bestTop) { bestTop = colTop[r]; bestCol = r; }
    }

    if (bestCol >= 0 && (bestTop - topX) >= minDiff) {
      const destTop = bestTop - 1;
      if (destTop >= 0) {
        const srcIdx = topX * simW + x;
        const destIdx = destTop * simW + bestCol;
        grid[srcIdx] = 0;
        grid[destIdx] = 1;
        cellHue[destIdx] = cellHue[srcIdx];
        cellSat[destIdx] = cellSat[srcIdx];
        cellVal[destIdx] = cellVal[srcIdx];
        colTop[x] = topX + 1;
        colTop[bestCol] = destTop;
      }
    }
  }
}

// Re-rolls the active stream positions, hues, brightness baselines,
// and rate-bias weights against the CURRENT simW. Hues use the
// golden angle from a random start so they stay visually distinct.
// Also resets every emitter's spawn-metronome so switching counts
// or positions never causes an instant catch-up burst of grains.
function regenerateStreams(count) {
  streamRegenSeed++;
  streamCount = count;
  const startHue = hash01(streamRegenSeed * 733 + 1) * 360;
  for (let i = 0; i < MAX_STREAMS; i++) {
    streamSpawnAccum[i] = 0;
  }
  for (let i = 0; i < streamCount; i++) {
    const pos = Math.floor(hash01(frameCounter * 131 + i * 977 + streamRegenSeed * 733) * simW);
    streamPositions[i] = clamp(pos, 0, simW - 1);
    streamHues[i] = (startHue + i * 137.5) % 360; // golden angle spacing
    streamBrightness[i] = hash01(streamRegenSeed * 911 + i * 601 + 7);
    streamRateBias[i] = hash01(streamRegenSeed * 353 + i * 449 + 21) * 2; // 0..2, 1 = neutral
  }
}

export function setup(params) {
  simW = 128;
  simH = 64;
  grid = new Uint8Array(MAX_CELLS);
  cellHue = new Uint8Array(MAX_CELLS);
  cellSat = new Uint8Array(MAX_CELLS);
  cellVal = new Uint8Array(MAX_CELLS);
  colTop = new Int16Array(MAX_DIM);
  streamPositions = new Int16Array(MAX_STREAMS);
  streamHues = new Float32Array(MAX_STREAMS);
  streamBrightness = new Float32Array(MAX_STREAMS);
  streamRateBias = new Float32Array(MAX_STREAMS);
  streamSpawnAccum = new Float32Array(MAX_STREAMS);
  streamCount = 1;
  streamRegenSeed = 0;
  simAccum = 0;
  frameCounter = 0;
  avalancheTimer = 0;
  spawnSeed = 0;
  prevBtn0 = false;
  prevBtn1 = false;
  prevBtn2 = false;
  prevBtn3 = false;
  regenerateStreams(5);
}

export function update(dt, input, params) {
  dt *= DEBUG_SPEED_MULTIPLIER;

  if (!grid) {
    simW = 128; simH = 64;
    grid = new Uint8Array(MAX_CELLS);
    cellHue = new Uint8Array(MAX_CELLS);
    cellSat = new Uint8Array(MAX_CELLS);
    cellVal = new Uint8Array(MAX_CELLS);
    colTop = new Int16Array(MAX_DIM);
    streamPositions = new Int16Array(MAX_STREAMS);
    streamHues = new Float32Array(MAX_STREAMS);
    streamBrightness = new Float32Array(MAX_STREAMS);
    streamRateBias = new Float32Array(MAX_STREAMS);
    streamSpawnAccum = new Float32Array(MAX_STREAMS);
    regenerateStreams(1);
  }

  const fallRateRaw = input.knobValues[0];    // 0.0 - 1.0 wrap
  const angleRaw = input.knobValues[1];       // 0.1 - 10.0 clamp
  const saturationRaw = input.knobValues[2];  // 0.0 - 4.9 clamp
  const rateContrastRaw = input.knobValues[3];// 0.0 - 1.0 wrap

  // Reset button (edge-triggered)
  const btn0 = !!(input.btnPressed && input.btnPressed[0]);
  if (btn0 && !prevBtn0) {
    clearGrid();
  }
  prevBtn0 = btn0;

  // Tilt button (edge-triggered) kicks off a temporary avalanche
  const btn1 = !!(input.btnPressed && input.btnPressed[1]);
  if (btn1 && !prevBtn1) {
    avalancheTimer = 1.2;
  }
  prevBtn1 = btn1;

  // Emitter count button (edge-triggered): cycles 1->2->3->4->5->1
  const btn2 = !!(input.btnPressed && input.btnPressed[2]);
  if (btn2 && !prevBtn2) {
    const nextCount = (streamCount % MAX_STREAMS) + 1;
    regenerateStreams(nextCount);
  }
  prevBtn2 = btn2;

  // Sim orientation button (edge-triggered): swap 128x64 <-> 64x128.
  // This is a real physics change, so the pile resets and emitters
  // re-randomize against the new width.
  const btn3 = !!(input.btnPressed && input.btnPressed[3]);
  if (btn3 && !prevBtn3) {
    const newW = simH;
    const newH = simW;
    simW = newW;
    simH = newH;
    clearGrid();
    regenerateStreams(streamCount);
  }
  prevBtn3 = btn3;

  if (avalancheTimer > 0) avalancheTimer = Math.max(0, avalancheTimer - dt);

  // angle threshold: higher raw = steeper pile before it slides
  let angleT = clamp(Math.round(angleRaw * 0.5), 1, 5);
  if (avalancheTimer > 0) angleT = 1;

  // lateral spread: high probability / low min-diff at the low end
  // of the knob (shallow dunes), zero at the high end (steep pyramids)
  let spreadProb = clamp((10 - angleRaw) / 10, 0, 1) * 0.5;
  let spreadMinDiff = clamp(Math.round(1 + angleRaw * 0.6), 1, 8);
  if (avalancheTimer > 0) { spreadProb = 0.5; spreadMinDiff = 1; }

  // saturation: 0 = every emitter looks sandy, 1 = full emitter hue
  const saturation = clamp(saturationRaw / 4.9, 0, 1);
  // rate contrast: 0 = all emitters tick at the same steady rate, 1 (x boost) = full spread
  const rateContrast = clamp(rateContrastRaw, 0, 1) * RATE_CONTRAST_BOOST;

  // fall rate drives settle-step frequency and the SHARED base spawn interval
  const stepInterval = clamp(0.12 - fallRateRaw * 0.11, 0.01, 0.12);
  const baseSpawnInterval = clamp(0.5 - fallRateRaw * 0.45, 0.02, 0.5);

  simAccum += dt;
  frameCounter++;

  let steps = 0;
  while (simAccum >= stepInterval && steps < 6) {
    settleStep(angleT, frameCounter * 7919 + steps * 104729);
    spreadPass(spreadProb, spreadMinDiff, frameCounter * 7 + steps);
    simAccum -= stepInterval;
    steps++;
  }

  // Each active emitter runs its OWN steady metronome: weight scales
  // that emitter's interval, so a weight of 2 fires twice as often
  // (regularly, not randomly), and a weight near 0 fires rarely.
  for (let i = 0; i < streamCount; i++) {
    const weight = clamp(1 + (streamRateBias[i] - 1) * rateContrast, 0.02, 8);
    const streamInterval = clamp(baseSpawnInterval / weight, 0.02, 2.0);

    streamSpawnAccum[i] += dt;
    let spawnsForStream = 0;
    while (streamSpawnAccum[i] >= streamInterval && spawnsForStream < 6) {
      const sx = streamPositions[i];
      const spawnIdx = sx; // row 0 of the current orientation
      if (grid[spawnIdx] === 0) {
        grid[spawnIdx] = 1;
        assignGrainColor(spawnIdx, i, saturation);
      }
      spawnSeed++;
      streamSpawnAccum[i] -= streamInterval;
      spawnsForStream++;
    }
  }
}

export function draw(display, params, time) {
  const dispW = display.width;
  const dispH = display.height;

  for (let dy = 0; dy < dispH; dy++) {
    for (let dx = 0; dx < dispW; dx++) {
      // If the sim matches the display's own shape, map directly.
      // If the sim is the display's transpose (narrow sim on a
      // wide display, or vice versa), rotate 90 degrees so the
      // sim's full frame exactly fills the physical display.
      let sx, sy;
      if (simW === dispW && simH === dispH) {
        sx = dx;
        sy = dy;
      } else {
        sx = dy;
        sy = dispW - 1 - dx;
      }

      if (sx < 0 || sx >= simW || sy < 0 || sy >= simH) {
        display.setPixel(dx, dy, 0, 0, 0);
        continue;
      }

      const idx = sy * simW + sx;
      if (!grid || grid[idx] === 0) {
        display.setPixel(dx, dy, 0, 0, 0);
        continue;
      }

      const hue = (cellHue[idx] / 255) * 360;
      const sat = cellSat[idx] / 255;
      const baseVal = cellVal[idx] / 255;
      const texture = hash01(sx * 92821 + sy * 68917);
      const val = clamp(baseVal + (texture - 0.5) * 0.2, 0, 1);

      const c = hsvToRgb(hue, sat, val);
      display.setPixel(dx, dy, c.r, c.g, c.b);
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
