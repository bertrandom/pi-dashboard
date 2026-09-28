// ===== Patternflow pattern =====
// Title:    Spectral Mosaic Rings
// Author:   @martinnlopez
// Date:     2026-08-06
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @matrix 128x128
// @knobs CellSize=4..12, Speed=0.1..5, RingThick=0.305..1.001, HueShift=0..1
// Patternflow layer-stack composition — flattened by Pattern Lab.
// Layers (bottom → top):
//   1. Spectral Mosaic Rings 1 (code, normal, 100%)
//   2. Spectral Mosaic Rings (code, multiply, 100%)
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

// ── code layer: Spectral Mosaic Rings 1 ──
(function () {
  // Shadow the wrapper's own exports: a layer that defines no setup/update
  // must yield undefined here, not capture the OUTER setup (infinite loop).
  var setup, update, draw;

function setup(params) {
  params.timeAcc = 0;
  params.k = [6, 1, 0.3, 0];
}

function update(dt, input, params) {
  params.k = input.knobValues;
  params.timeAcc += dt * params.k[1];
}

function draw(display, params, time) {
  const w = display.width, h = display.height;
  const cellSize = Math.floor(params.k[0]);
  const thick = params.k[2];
  const t = params.timeAcc;
  const globalHue = params.k[3] * 6.28;

  // Clear background
  for (let i = 0; i < w * h; i++) display.setPixel(i % w, Math.floor(i / w), 0, 0, 0);

  for (let y = 0; y < h; y++) {
    // Identify current cell row
    const cellY = Math.floor(y / cellSize);
    const localY = (y % cellSize) - (cellSize / 2);

    for (let x = 0; x < w; x++) {
      // Identify current cell column
      const cellX = Math.floor(x / cellSize);
      const localX = (x % cellSize) - (cellSize / 2);

      // Distance from center of the current grid cell
      const dist = Math.sqrt(localX * localX + localY * localY);
      
      // Ring logic: Only draw if within the radial band
      const innerRad = cellSize * 0.2;
      const outerRad = cellSize * (0.2 + thick);
      
      if (dist >= innerRad && dist <= outerRad) {
        // Sample a fluid field at the cell coordinate (not pixel coordinate)
        // to give each ring a solid, singular color
        const noiseX = cellX * 0.2 + t;
        const noiseY = cellY * 0.2 - t * 0.5;
        const sig = Math.sin(noiseX) * Math.cos(noiseY) + Math.sin(cellX * 0.1 - t);
        
        // Intensity thresholding to create the "patchy" look of the mosaic
        const intensity = Math.sin(cellX * 0.5 + cellY * 0.3 + t) * 0.5 + 0.5;
        
        if (intensity > 0.3) {
          const hue = sig * 3.0 + cellX * 0.1 + cellY * 0.1 + globalHue;
          
          // High-saturation spectrum colors
          const r = Math.floor(127 + 127 * Math.sin(hue));
          const g = Math.floor(127 + 127 * Math.sin(hue + 2.1));
          const b = Math.floor(127 + 127 * Math.sin(hue + 4.2));

          // Soften edges of the ring based on distance for a glow effect
          const edge = 1.0 - Math.abs((innerRad + outerRad) / 2 - dist) / (thick * cellSize);
          const finalR = Math.floor(r * edge);
          const finalG = Math.floor(g * edge);
          const finalB = Math.floor(b * edge);

          display.setPixel(x, y, finalR, finalG, finalB);
        }
      }
      
      // Add a subtle background "off" ring for the unlit cells
      else if (dist > innerRad - 1 && dist < outerRad + 1) {
        if (x % cellSize === 0 || y % cellSize === 0) continue; // Skip grid lines
        display.setPixel(x, y, 10, 10, 15);
      }
    }
  }
}
  __stack.push({
    kind: "code", opacity: 1, blend: "normal", recolor: true, role: "paint", maskInvert: false,
    lut: [148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,148,22,81,0,149,24,82,2,151,28,86,7,153,33,89,12,155,37,92,17,157,42,96,22,159,46,99,27,161,51,102,31,163,55,106,36,165,60,109,41,167,64,112,46,169,69,116,51,171,73,119,56,173,77,122,61,176,82,126,66,178,86,129,70,180,91,132,75,182,95,136,80,184,100,139,85,186,104,142,90,188,109,146,95,190,113,149,100,192,118,152,105,194,122,156,109,196,126,159,114,198,131,162,119,200,135,166,124,202,140,169,129,204,144,172,134,206,149,176,139,208,153,179,144,210,158,182,148,212,162,186,153,214,167,189,158,216,171,192,163,218,176,196,168,221,180,199,173,223,184,202,178,225,189,206,183,227,193,209,188,229,198,212,192,231,202,216,197,233,207,219,202,235,211,222,207,237,216,226,212,239,220,229,217,241,225,232,222,243,229,236,227,245,233,239,231,247,238,242,236,249,242,246,241,251,247,249,246,253,251,252,251,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255],
    buf: new Uint8ClampedArray(__W * __H * 4),
    params: {},
    fSetup: typeof setup === "function" ? setup : null,
    fUpdate: typeof update === "function" ? update : null,
    fDraw: typeof draw === "function" ? draw : null,
  });
})();

// ── code layer: Spectral Mosaic Rings ──
(function () {
  // Shadow the wrapper's own exports: a layer that defines no setup/update
  // must yield undefined here, not capture the OUTER setup (infinite loop).
  var setup, update, draw;

function setup(params) {
  params.timeAcc = 0;
  params.k = [6, 1, 0.3, 0];
}

function update(dt, input, params) {
  params.k = input.knobValues;
  params.timeAcc += dt * params.k[1];
}

function draw(display, params, time) {
  const w = display.width, h = display.height;
  const cellSize = Math.floor(params.k[0]);
  const thick = params.k[2];
  const t = params.timeAcc;
  const globalHue = params.k[3] * 6.28;

  // Clear background
  for (let i = 0; i < w * h; i++) display.setPixel(i % w, Math.floor(i / w), 0, 0, 0);

  for (let y = 0; y < h; y++) {
    // Identify current cell row
    const cellY = Math.floor(y / cellSize);
    const localY = (y % cellSize) - (cellSize / 2);

    for (let x = 0; x < w; x++) {
      // Identify current cell column
      const cellX = Math.floor(x / cellSize);
      const localX = (x % cellSize) - (cellSize / 2);

      // Distance from center of the current grid cell
      const dist = Math.sqrt(localX * localX + localY * localY);
      
      // Ring logic: Only draw if within the radial band
      const innerRad = cellSize * 0.2;
      const outerRad = cellSize * (0.2 + thick);
      
      if (dist >= innerRad && dist <= outerRad) {
        // Sample a fluid field at the cell coordinate (not pixel coordinate)
        // to give each ring a solid, singular color
        const noiseX = cellX * 0.2 + t;
        const noiseY = cellY * 0.2 - t * 0.5;
        const sig = Math.sin(noiseX) * Math.cos(noiseY) + Math.sin(cellX * 0.1 - t);
        
        // Intensity thresholding to create the "patchy" look of the mosaic
        const intensity = Math.sin(cellX * 0.5 + cellY * 0.3 + t) * 0.5 + 0.5;
        
        if (intensity > 0.3) {
          const hue = sig * 3.0 + cellX * 0.1 + cellY * 0.1 + globalHue;
          
          // High-saturation spectrum colors
          const r = Math.floor(127 + 127 * Math.sin(hue));
          const g = Math.floor(127 + 127 * Math.sin(hue + 2.1));
          const b = Math.floor(127 + 127 * Math.sin(hue + 4.2));

          // Soften edges of the ring based on distance for a glow effect
          const edge = 1.0 - Math.abs((innerRad + outerRad) / 2 - dist) / (thick * cellSize);
          const finalR = Math.floor(r * edge);
          const finalG = Math.floor(g * edge);
          const finalB = Math.floor(b * edge);

          display.setPixel(x, y, finalR, finalG, finalB);
        }
      }
      
      // Add a subtle background "off" ring for the unlit cells
      else if (dist > innerRad - 1 && dist < outerRad + 1) {
        if (x % cellSize === 0 || y % cellSize === 0) continue; // Skip grid lines
        display.setPixel(x, y, 10, 10, 15);
      }
    }
  }
}
  __stack.push({
    kind: "code", opacity: 1, blend: "multiply", recolor: true, role: "paint", maskInvert: false,
    lut: [255,38,0,255,255,45,1,255,255,52,2,255,255,58,3,255,255,65,4,255,255,72,5,255,255,78,6,255,255,85,7,255,255,91,8,255,255,98,9,255,255,104,10,255,255,111,11,255,255,117,12,255,255,123,13,255,255,129,14,255,255,135,15,255,255,142,16,255,255,148,17,255,255,154,18,255,255,160,19,255,255,166,20,255,255,171,21,255,255,177,22,255,255,183,23,255,255,189,24,255,255,195,25,255,255,200,26,255,255,206,27,255,255,211,28,255,255,217,29,255,255,222,30,255,255,228,31,255,255,233,32,255,255,238,33,255,255,244,34,255,255,249,35,255,255,254,36,255,251,255,37,255,246,255,38,255,241,255,39,255,236,255,40,255,231,255,41,255,226,255,42,255,221,255,43,255,216,255,44,255,211,255,45,255,207,255,46,255,202,255,47,255,197,255,48,255,193,255,49,255,188,255,50,255,184,255,51,255,179,255,52,255,175,255,53,255,171,255,54,255,166,255,55,255,162,255,56,255,158,255,57,255,154,255,58,255,150,255,59,255,146,255,60,255,142,255,61,255,138,255,62,255,134,255,63,255,130,255,64,255,126,255,65,255,122,255,66,255,119,255,67,255,115,255,68,255,111,255,69,255,108,255,70,255,104,255,71,255,101,255,72,255,97,255,73,255,94,255,74,255,91,255,75,255,87,255,76,255,84,255,77,255,81,255,78,255,79,255,80,255,80,255,85,255,81,255,91,255,82,255,96,255,83,255,101,255,84,255,105,255,85,255,110,255,86,255,115,255,87,255,120,255,88,255,125,255,89,255,129,255,90,255,134,255,91,255,139,255,92,255,143,255,93,255,148,255,94,255,152,255,95,255,156,255,96,255,161,255,97,255,165,255,98,255,169,255,99,255,174,255,100,255,178,255,101,255,182,255,102,255,186,255,103,255,190,255,104,255,194,255,105,255,198,255,106,255,202,255,107,255,206,255,108,255,209,255,109,255,213,255,110,255,217,255,111,255,221,255,112,255,224,255,113,255,228,255,114,255,231,255,115,255,235,255,116,255,238,255,117,255,241,255,118,255,245,255,119,255,248,255,120,255,251,255,121,255,254,255,122,252,255,255,123,249,255,255,124,246,255,255,125,243,255,255,126,240,255,255,127,237,255,255,128,235,255,255,129,232,255,255,130,229,255,255,131,226,255,255,132,224,255,255,133,221,255,255,134,218,255,255,135,216,255,255,136,213,255,255,137,211,255,255,138,209,255,255,139,206,255,255,140,204,255,255,141,202,255,255,142,200,255,255,143,197,255,255,144,195,255,255,145,193,255,255,146,191,255,255,147,189,255,255,148,187,255,255,149,186,255,255,150,184,255,255,151,182,255,255,152,180,255,255,153,179,255,255,154,177,255,255,155,175,255,255,156,174,255,255,157,172,255,255,158,171,255,255,159,170,255,255,160,168,255,255,161,167,255,255,162,166,255,255,163,164,255,255,165,164,255,255,168,165,255,255,171,166,255,255,174,167,255,255,177,168,255,255,180,169,255,255,183,170,255,255,185,171,255,255,188,172,255,255,191,173,255,255,194,174,255,255,196,175,255,255,199,176,255,255,201,177,255,255,204,178,255,255,206,179,255,255,209,180,255,255,211,181,255,255,213,182,255,255,216,183,255,255,218,184,255,255,220,185,255,255,222,186,255,255,224,187,255,255,226,188,255,255,228,189,255,255,230,190,255,255,232,191,255,255,234,192,255,255,236,193,255,255,238,194,255,255,239,195,255,255,241,196,255,255,242,197,255,255,244,198,255,255,246,199,255,255,247,200,255,255,248,201,255,255,250,202,255,255,251,203,255,255,252,204,255,255,254,205,255,255,255,206,255,255,255,207,254,255,255,208,253,255,255,209,252,255,255,210,251,255,255,211,250,255,255,212,249,255,255,213,248,255,255,214,247,255,255,215,247,255,255,216,246,255,255,217,245,255,255,218,245,255,255,219,244,255,255,220,244,255,255,221,243,255,255,222,243,255,255,223,242,255,255,224,242,255,255,225,242,255,255,226,241,255,255,227,241,255,255,228,241,255,255,229,241,255,255,230,241,255,255,231,241,255,255,232,241,255,255,233,241,255,255,234,241,255,255,235,241,255,255,236,242,255,255,237,242,255,255,238,242,255,255,239,243,255,255,240,243,255,255,241,244,255,255,242,244,255,255,243,245,255,255,244,245,255,255,245,246,255,255,246,247,255,255,247,247,255,255,248,248,255,255,249,249,255,255,250,250,255,255,251,251,255,255,252,252,255,255,253,253,255,255,254,254,255,255,255,255,255],
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
