// ===== Patternflow pattern =====
// Title:    Fractured Grid Fluid Cells
// Author:   @martinnlopez
// Date:     2026-07-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @matrix 128x128
// @knobs Glitch=0..1, Speed=0.05..5.037, Freq=10..120, Quantize=2..10
// Patternflow layer-stack composition — flattened by Pattern Lab.
// Layers (bottom → top):
//   1. Code 1 -- Fractured Fluid Cells (code, normal, 100%)
//   2. Code 2 -- Cyber-Grid Gravity Well (code, screen, 100%)
const __PW = 64, __PH = 128;
const __W = 128, __H = 128;
const __OX = (__W - __PW) >> 1, __OY = (__H - __PH) >> 1;
const __stack = [];

function __b64(s, n) {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const out = new Uint8ClampedArray(n);
  let o = 0, buf = 0, bits = 0;
  for (let i = 0; i < s.length && o < n; i++) {
    const v = A.indexOf(s[i]);
    if (v < 0) continue;
    buf = (buf << 6) | v; bits += 6;
    if (bits >= 8) { bits -= 8; out[o++] = (buf >> bits) & 255; }
  }
  return out;
}

function __mkDisplay(L) {
  return {
    width: __W, height: __H,
    setPixel(x, y, r, g, b) {
      const xi = x | 0, yi = y | 0;
      if (xi < 0 || xi >= __W || yi < 0 || yi >= __H) return;
      const i = (yi * __W + xi) * 4, B = L.buf;
      if (Array.isArray(r)) { B[i] = r[0] || 0; B[i + 1] = r[1] || 0; B[i + 2] = r[2] || 0; }
      else { B[i] = r; B[i + 1] = g || 0; B[i + 2] = b || 0; }
      B[i + 3] = 255;
    },
    setValue(x, y, v) {
      const xi = x | 0, yi = y | 0;
      if (xi < 0 || xi >= __W || yi < 0 || yi >= __H) return;
      v = Number.isFinite(v) ? (v < 0 ? 0 : v > 1 ? 1 : v) : 0;
      const i = (yi * __W + xi) * 4, B = L.buf, T = L.lut;
      if (T) {
        const li = Math.round(v * 255) * 4;
        B[i] = T[li]; B[i + 1] = T[li + 1]; B[i + 2] = T[li + 2]; B[i + 3] = T[li + 3];
      } else {
        const byte = Math.round(v * 255);
        B[i] = byte; B[i + 1] = byte; B[i + 2] = byte; B[i + 3] = 255;
      }
    },
  };
}

// ── code layer: Code 1 -- Fractured Fluid Cells ──
(function () {
  // Shadow the wrapper's own exports: a layer that defines no setup/update
  // must yield undefined here, not capture the OUTER setup (infinite loop).
  var setup, update, draw;
// Pattern: Fractured Fluid Cells
// A structural remix that divides the fluid into a grid of independent cells.
// Knob 1: Cell Density (0-1) - Controls how many tiles the screen is split into.
// Knob 2: Flow Speed (0.1-10) - Adjusts the rate of the fluid evolution.
// Knob 3: Tile Jitter (0-4.9) - Randomizes the offset of each cell.
// Knob 4: Color Mutation (0-1) - Shifts the color relationship between cells.

function setup(params) {
  params.timeAcc = 0;
}

function update(dt, input, params) {
  const speed = input.knobValues[1];
  params.timeAcc += dt * speed;
  params.density = input.knobValues[0];
  params.jitter = input.knobValues[2];
  params.colorShift = input.knobValues[3];
}

function draw(display, params, time) {
  const w = display.width;
  const h = display.height;
  const t = params.timeAcc * 0.5;
  
  // Calculate cell size based on Knob 1
  const cellSize = 4 + Math.floor(params.density * 28);
  const jitterAmt = params.jitter * 10;

  for (let y = 0; y < h; y++) {
    const cellY = Math.floor(y / cellSize);
    for (let x = 0; x < w; x++) {
      const cellX = Math.floor(x / cellSize);
      
      // Unique offset for each cell based on coordinates and Knob 3
      const offX = Math.sin(cellX * 0.5 + t) * jitterAmt;
      const offY = Math.cos(cellY * 0.5 - t) * jitterAmt;
      
      const sampleX = x + offX;
      const sampleY = y + offY;
      
      // Core fluid logic
      const val = Math.sin(sampleX * 0.05 + t) + Math.cos(sampleY * 0.08 - t);
      const ring = Math.sin(val * 4.0 + (cellX + cellY) * params.colorShift);
      
      // Localized coloring: High peaks are warm, low peaks are cold
      let r, g, b;
      if (ring > 0.5) {
        r = 255;
        g = Math.floor(128 + 127 * Math.sin(t + cellX));
        b = 50;
      } else if (ring > -0.2) {
        r = 0;
        g = Math.floor(100 + 155 * Math.abs(Math.cos(t)));
        b = 200;
      } else {
        r = 100;
        g = 0;
        b = Math.floor(150 + 105 * Math.sin(t * 0.5));
      }

      // Brighten edges of cells
      if (x % cellSize === 0 || y % cellSize === 0) {
        r = Math.min(255, r + 100);
        g = Math.min(255, g + 100);
        b = Math.min(255, b + 100);
      }

      display.setPixel(x, y, r, g, b);
    }
  }
}
  __stack.push({
    kind: "code", opacity: 1, blend: "normal", recolor: false, role: "paint", maskInvert: false,
    lut: null,
    buf: new Uint8ClampedArray(__W * __H * 4),
    params: {},
    fSetup: typeof setup === "function" ? setup : null,
    fUpdate: typeof update === "function" ? update : null,
    fDraw: typeof draw === "function" ? draw : null,
  });
})();

// ── code layer: Code 2 -- Cyber-Grid Gravity Well ──
(function () {
  // Shadow the wrapper's own exports: a layer that defines no setup/update
  // must yield undefined here, not capture the OUTER setup (infinite loop).
  var setup, update, draw;
// Pattern: Cyber-Grid Gravity Well
// A structural remix focusing on the perspective geometry of the wireframe funnel.
// Knob 1: Radial Density (0-1) - Number of lines converging on the center.
// Knob 2: Animation Speed (0.1-10) - Rate at which the rings collapse inward.
// Knob 3: Warp Intensity (0-4.9) - The "depth" of the gravitational funnel.
// Knob 4: Ring Density (0-1) - How many concentric circles are visible.

function setup(params) {
  params.timeAcc = 0;
}

function update(dt, input, params) {
  params.k1 = input.knobValues[0];
  params.k2 = input.knobValues[1];
  params.k3 = input.knobValues[2];
  params.k4 = input.knobValues[3];
  params.timeAcc += dt * params.k2 * 0.5;
}

function draw(display, params, time) {
  const w = display.width;
  const h = display.height;
  const t = params.timeAcc;
  
  const radialCount = 4 + Math.floor(params.k1 * 24);
  const ringSpacing = 0.05 + (1.0 - params.k4) * 0.2;
  const warp = params.k3 * 2.0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Normalize coordinates to -1 to 1 range
      const nx = (x - w / 2) / (h / 2);
      const ny = (y - h / 2) / (h / 2);
      
      const dist = Math.sqrt(nx * nx + ny * ny);
      const angle = Math.atan2(ny, nx) + Math.PI;

      // Apply perspective warp: distances get "stretched" towards the center
      const warpedDist = Math.pow(dist, 1.0 / (1.0 + warp));
      
      // Calculate Radial Lines
      const radialLine = Math.abs(Math.sin(angle * radialCount));
      const isRadial = radialLine > 0.95;

      // Calculate Concentric Rings (moving inward)
      const ringLogic = (warpedDist - t * 0.2) % ringSpacing;
      const isRing = Math.abs(ringLogic) < 0.015;

      // Glow Falloff
      const coreGlow = Math.exp(-dist * 4.0);
      
      let r = 0, g = 0, b = 0;

      if (isRadial || isRing) {
        // Grid color: Blue to Cyan based on distance
        r = 20;
        g = 100 + warpedDist * 155;
        b = 255;
      }

      // Add Core Glow
      r = Math.min(255, r + coreGlow * 255);
      g = Math.min(255, g + coreGlow * 150);
      b = Math.min(255, b + coreGlow * 50);

      // CRT Scanline effect
      const scanline = (y % 2 === 0) ? 1.0 : 0.7;
      
      display.setPixel(x, y, r * scanline, g * scanline, b * scanline);
    }
  }
}
  __stack.push({
    kind: "code", opacity: 1, blend: "screen", recolor: false, role: "paint", maskInvert: true,
    lut: null,
    buf: new Uint8ClampedArray(__W * __H * 4),
    params: {},
    fSetup: typeof setup === "function" ? setup : null,
    fUpdate: typeof update === "function" ? update : null,
    fDraw: typeof draw === "function" ? draw : null,
  });
})();

// Mask grouping: a mask layer paints nothing — it gates the nearest paint
// layer BELOW it (stacked masks intersect). Binary threshold: pixel-art masks
// switch on where alpha >= 0.5, code masks where luminance × alpha >= 0.5.
const __groups = [];
{
  let last = null;
  for (const L of __stack) {
    if (L.role === "mask") { if (last) last.masks.push(L); continue; }
    L.masks = [];
    last = L;
    if (L.opacity > 0) __groups.push(L);
  }
}

// Pixel-art layers keep their authored size and sit centred on the 128x128
// panel; code layers render at the full panel size.
function __pix(i) {
  const x = (i % __W) - __OX, y = ((i / __W) | 0) - __OY;
  return x < 0 || x >= __PW || y < 0 || y >= __PH ? -1 : (y * __PW + x) * 4;
}

function __maskOn(M, j) {
  const B = M.buf;
  let on;
  if (M.kind === "pixel") on = B[j + 3] >= 128;
  else on = (0.2126 * B[j] + 0.7152 * B[j + 1] + 0.0722 * B[j + 2]) * (B[j + 3] / 255) >= 127.5;
  return M.maskInvert ? !on : on;
}

// One shared knob set: every layer receives the same input, exactly like
// patterns running on the device's four physical encoders.
function __mirror(L) {
  const inp = L.lastInput;
  if (!inp) return;
  L.params.knobValues = inp.knobValues;
  L.params.knobNormalized = inp.knobNormalized;
  L.params.knobDeltas = inp.knobDeltas;
  L.params.knobRanges = inp.knobRanges;
  L.params.btnPressed = inp.btnPressed;
  L.params.btnHeld = inp.btnHeld;
}

export function setup(params) {
  for (const L of __stack) {
    if (L.kind !== "code") continue;
    L.display = __mkDisplay(L);
    if (L.fSetup) L.fSetup(L.params);
  }
}

export function update(dt, input, params) {
  for (const L of __stack) {
    if (L.kind !== "code") continue;
    L.lastInput = input;
    __mirror(L);
    if (L.fUpdate) L.fUpdate(dt, input, L.params);
  }
}

export function draw(display, params, time) {
  for (const L of __stack) {
    if (L.kind !== "code" || !L.fDraw) continue;
    L.buf.fill(0);
    __mirror(L);
    L.fDraw(L.display, L.params, time);
    if (L.recolor && L.lut) {
      const B = L.buf, T = L.lut;
      for (let i = 0; i < B.length; i += 4) {
        if (B[i + 3] === 0) continue;
        const lum = Math.round(0.2126 * B[i] + 0.7152 * B[i + 1] + 0.0722 * B[i + 2]) * 4;
        B[i] = T[lum]; B[i + 1] = T[lum + 1]; B[i + 2] = T[lum + 2]; B[i + 3] = T[lum + 3];
      }
    }
  }

  // Composite bottom → top over the panel's opaque black.
  const count = __W * __H;
  for (let i = 0; i < count; i++) {
    const j = i * 4;
    let r = 0, g = 0, b = 0;
    for (const L of __groups) {
      let hidden = false;
      for (let m = 0; m < L.masks.length; m++) {
        if (!__maskOn(L.masks[m], j)) { hidden = true; break; }
      }
      if (hidden) continue;
      const B = L.buf, k = L.kind === "pixel" ? __pix(i) : j;
      if (k < 0) continue;
      const a = (B[k + 3] / 255) * L.opacity;
      if (a <= 0) continue;
      const sr = B[k], sg = B[k + 1], sb = B[k + 2], inv = 1 - a;
      if (L.blend === "add") { r += sr * a; g += sg * a; b += sb * a; }
      else if (L.blend === "multiply") {
        r = r * inv + ((r * sr) / 255) * a;
        g = g * inv + ((g * sg) / 255) * a;
        b = b * inv + ((b * sb) / 255) * a;
      } else if (L.blend === "screen") {
        r = r * inv + (255 - ((255 - r) * (255 - sr)) / 255) * a;
        g = g * inv + (255 - ((255 - g) * (255 - sg)) / 255) * a;
        b = b * inv + (255 - ((255 - b) * (255 - sb)) / 255) * a;
      } else {
        r = r * inv + sr * a;
        g = g * inv + sg * a;
        b = b * inv + sb * a;
      }
    }
    display.setPixel(i % __W, (i / __W) | 0, r, g, b);
  }
}

// @stack v1 d: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

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
