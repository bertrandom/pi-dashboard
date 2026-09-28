// ===== Patternflow pattern =====
// Title:    Controlled Burn
// Author:   @martinnlopez
// Date:     2026-08-27
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp oklchShort recolor 0:#320e34 0.037:#c42614 0.894:#00dcfd 0.216:#fd9e00 0.358:#e9e187 1:#0f8edf 0.529:#e7db67
// @knobs Speed=0.2..3, Cooling=0.3..6, Turbulence=0..3, Fuel=15..90
// @matrix 128x128

//
// Fire simulation, ported from a cols/rows ASCII-fire effect to the
// encoder pattern API. The simulation grid is the same size as the
// display, so each buffer cell maps 1:1 to a pixel.
//
// Knobs
//   1 Speed       how fast the base flicker (noise) evolves
//   2 Cooling     how much heat is lost per row as flame rises (higher = shorter flame)
//   3 Turbulence  horizontal drift/wind while the flame rises
//   4 Fuel        max heat injected at the bottom row (higher = hotter/taller flame)
//
// Buttons (push the knob to fire)
//   Knob 1 tap    reset  - clear the fire and let it rebuild
//   Knob 2 hold   freeze - pause the simulation, keep drawing the last frame
//   Knob 3 tap    cycle  - switch to the next color palette
//   Knob 4 hold   boost  - blast full fuel across the bottom row

const { floor, round, min, max, random } = Math

// Intensity (0..N) -> palette index. Long plateaus = the color "lingers"
// as the flame cools, short runs = quick transitions.
const flame = '011222233334444444455566667'.split('').map(Number)

// A few color ramps to cycle through with knob 3's button.
const PALETTES = [
  // classic fire
  [[0, 0, 0], [128, 0, 128], [139, 0, 0], [255, 0, 0], [255, 69, 0], [255, 215, 0], [255, 250, 205], [255, 255, 255]],
  // blue flame
  [[0, 0, 0], [75, 0, 130], [0, 0, 139], [0, 0, 255], [30, 144, 255], [0, 255, 255], [224, 255, 255], [255, 255, 255]],
  // toxic green flame
  [[0, 0, 0], [75, 0, 130], [0, 100, 0], [0, 200, 0], [124, 252, 0], [173, 255, 47], [240, 255, 240], [255, 255, 255]],
  // violet flame
  [[0, 0, 0], [25, 0, 51], [139, 0, 139], [199, 21, 133], [255, 20, 147], [255, 105, 180], [255, 228, 225], [255, 255, 255]],
]

export function setup(params) {
  params.noise = valueNoise()
  params.data = null           // grid buffer, sized lazily once we know display dims
  params.cols = 0
  params.rows = 0
  params.paletteIndex = 0
  params.frozen = false
  params.boost = false
  params.resetRequested = false
  params.speed = 1
  params.cooling = 2
  params.turbulence = 1
  params.fuel = 50
  // scratch buffer reused every pixel so draw() never allocates per-pixel
  params.rgb = [0, 0, 0]
}

export function update(dt, input, params) {
  params.speed = input.knobValues[0]
  params.cooling = input.knobValues[1]
  params.turbulence = input.knobValues[2]
  params.fuel = input.knobValues[3]

  if (input.btnPressed[0]) params.resetRequested = true
  if (input.btnPressed[2]) params.paletteIndex = (params.paletteIndex + 1) % PALETTES.length

  params.frozen = input.btnHeld[1]
  params.boost = input.btnHeld[3]
}

export function draw(display, params, time) {
  ensureBuffer(display, params)

  if (params.resetRequested) {
    params.data.fill(0)
    params.resetRequested = false
  }

  if (!params.frozen) {
    stepFire(params, display.width, display.height, time)
  }

  const palette = PALETTES[params.paletteIndex]
  const cols = display.width
  const rows = display.height
  const data = params.data
  const rgb = params.rgb

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      colorForValue(data[y * cols + x], palette, rgb)
      display.setPixel(x, y, rgb[0], rgb[1], rgb[2])
    }
  }
}

// ---- simulation -----------------------------------------------------

function ensureBuffer(display, params) {
  const cols = display.width
  const rows = display.height
  if (cols !== params.cols || rows !== params.rows || !params.data) {
    params.cols = cols
    params.rows = rows
    params.data = new Float32Array(cols * rows)
  }
}

function stepFire(params, cols, rows, time) {
  const data = params.data
  const noise = params.noise
  const cooling = params.cooling
  const turbulence = params.turbulence
  const fuelMax = params.fuel
  const t = time * params.speed * 1.5

  // Seed the bottom row with fuel, rise-limited so it flickers instead of
  // popping to the new value every frame - unless boosted, which slams
  // the whole row to near-max heat for a burst.
  const last = cols * (rows - 1)
  for (let x = 0; x < cols; x++) {
    const idx = last + x
    if (params.boost) {
      data[idx] = rndf(fuelMax * 0.7, fuelMax)
    } else {
      const target = floor(mapRange(noise(x * 0.05, t), 0, 1, 5, fuelMax))
      data[idx] = min(target, data[idx] + 2)
    }
  }

  // Propagate upward (toward row 0) with a little horizontal drift and cooling.
  for (let i = 0; i < data.length; i++) {
    const row = floor(i / cols)
    const col = i - row * cols
    const drift = round(rndf(-turbulence, turbulence))
    const dcol = clampInt(col + drift, 0, cols - 1)
    const dest = row * cols + dcol
    const srcRow = min(rows - 1, row + 1)
    const src = srcRow * cols + col
    data[dest] = max(0, data[src] - rndf(0, cooling))
  }
}

// ---- color ------------------------------------------------------------

// Writes into `out` (reused array) instead of returning a new one, so the
// render loop never allocates per pixel.
function colorForValue(u, palette, out) {
  const maxIdx = flame.length - 1
  const uc = clampNum(u, 0, maxIdx)
  const i0 = floor(uc)
  const i1 = min(maxIdx, i0 + 1)
  const f = uc - i0
  const c0 = palette[min(palette.length - 1, flame[i0])]
  const c1 = palette[min(palette.length - 1, flame[i1])]
  out[0] = lerp(c0[0], c1[0], f) | 0
  out[1] = lerp(c0[1], c1[1], f) | 0
  out[2] = lerp(c0[2], c1[2], f) | 0
}

// ---- helpers ------------------------------------------------------------

function lerp(a, b, t) { return a + (b - a) * t }
function clampNum(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v }
function clampInt(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v }
function mapRange(v, inMin, inMax, outMin, outMax) {
  return outMin + (v - inMin) * (outMax - outMin) / (inMax - inMin)
}
function rndf(a, b) { if (a > b) { const tmp = a; a = b; b = tmp } return a + random() * (b - a) }

// Value noise: https://www.scratchapixel.com/lessons/procedural-generation-virtual-worlds/procedural-patterns-noise-part-1
function valueNoise() {
  const tableSize = 256
  const r = new Array(tableSize)
  const permutationTable = new Array(tableSize * 2)
  for (let k = 0; k < tableSize; k++) {
    r[k] = random()
    permutationTable[k] = k
  }
  for (let k = 0; k < tableSize; k++) {
    const i = floor(random() * tableSize)
    const tmp = permutationTable[k]
    permutationTable[k] = permutationTable[i]
    permutationTable[i] = tmp
    permutationTable[k + tableSize] = permutationTable[k]
  }
  return function (px, py) {
    const xi = floor(px)
    const yi = floor(py)
    const tx = px - xi
    const ty = py - yi
    const rx0 = ((xi % tableSize) + tableSize) % tableSize
    const rx1 = (rx0 + 1) % tableSize
    const ry0 = ((yi % tableSize) + tableSize) % tableSize
    const ry1 = (ry0 + 1) % tableSize
    const c00 = r[permutationTable[permutationTable[rx0] + ry0]]
    const c10 = r[permutationTable[permutationTable[rx1] + ry0]]
    const c01 = r[permutationTable[permutationTable[rx0] + ry1]]
    const c11 = r[permutationTable[permutationTable[rx1] + ry1]]
    const sx = smoothstepFn(0, 1, tx)
    const sy = smoothstepFn(0, 1, ty)
    const nx0 = lerp(c00, c10, sx)
    const nx1 = lerp(c01, c11, sx)
    return lerp(nx0, nx1, sy)
  }
}

function smoothstepFn(edge0, edge1, x) {
  const t = clampNum((x - edge0) / (edge1 - edge0), 0, 1)
  return t * t * (3 - 2 * t)
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
