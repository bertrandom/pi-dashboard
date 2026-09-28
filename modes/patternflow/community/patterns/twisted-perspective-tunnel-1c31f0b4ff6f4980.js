// ===== Patternflow pattern =====
// Title:    Twisted Perspective Tunnel
// Author:   @martinnlopez
// Date:     2026-08-05
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @matrix 128x128
// @knobs Count=2..12, Speed=1..5, Strobe=0..4.9, StepSize=0.1..1
// Patternflow layer-stack composition — flattened by Pattern Lab.
// Layers (bottom → top):
//   1. Code 2 (code, screen, 100%)
//   2. Code 3 (code, screen, 100%)
//   3. Code 4 (code, normal, 100%)
//   4. Code 5 (code, add, 100%)
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

// ── code layer: Code 2 ──
(function () {
  // Shadow the wrapper's own exports: a layer that defines no setup/update
  // must yield undefined here, not capture the OUTER setup (infinite loop).
  var setup, update, draw;

function setup(params) {
  params.timeAcc = 0;
}

function update(dt, input, params) {
  params.k = input.knobValues;
  params.timeAcc += dt * params.k[1];
}

function draw(display, params, time) {
  const w = display.width, h = display.height;
  const t = params.timeAcc;
  const rings = params.k[0];
  const elastic = params.k[2];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x - w / 2), dy = (y - h / 2);
      const d = Math.sqrt(dx * dx + dy * dy);
      const normD = d / (h * 0.6);
      
      // Calculate a phase offset based on distance
      const phase = normD * rings;
      const motion = Math.sin(t - phase * elastic);
      
      // Creating "rings" by thresholding a sine wave over distance
      const ringSignal = Math.sin(phase * 3.14 + motion);
      
      if (ringSignal > 0.8) {
        // Color shifts from Red/White at center to Blue/Cyan at edges
        const r = 255 * (1 - normD);
        const g = 150 * Math.abs(motion);
        const b = 255 * normD;
        
        const bri = (ringSignal - 0.8) * 5.0; // Anti-aliased look
        display.setPixel(x, y, r * bri, g * bri, b * bri);
      }
    }
  }
}
  __stack.push({
    kind: "code", opacity: 1, blend: "screen", recolor: false, role: "paint", maskInvert: false,
    lut: null,
    buf: new Uint8ClampedArray(__W * __H * 4),
    params: {},
    fSetup: typeof setup === "function" ? setup : null,
    fUpdate: typeof update === "function" ? update : null,
    fDraw: typeof draw === "function" ? draw : null,
  });
})();

// ── code layer: Code 3 ──
(function () {
  // Shadow the wrapper's own exports: a layer that defines no setup/update
  // must yield undefined here, not capture the OUTER setup (infinite loop).
  var setup, update, draw;

function setup(params) {
  params.timeAcc = 0;
}

function update(dt, input, params) {
  params.k = input.knobValues;
  params.timeAcc += dt * params.k[1] * 0.2;
}

function draw(display, params, time) {
  const w = display.width, h = display.height;
  const t = params.timeAcc;
  const thick = params.k[3] * 5;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - w/2, dy = y - h/2;
      const d = Math.sqrt(dx * dx + dy * dy);
      
      // We use a math-heavy approach to determine color without an inner loop
      const ringCoord = (d + Math.sin(t + d * 0.1) * 10) / 10;
      const fract = ringCoord - Math.floor(ringCoord);
      
      if (fract < thick / 10) {
        const perc = 1.0 - (d / w);
        const cycle = (t + perc * params.k[2]) % 2;
        
        let r = 0, g = 0, b = 0;
        // Logic inspired by: border-color: rgb(255 * (1 - perc), 125 * perc, 255 * (1 - perc))
        if (cycle < 1) {
          r = 255 * perc;
          g = 255 * (1 - perc);
          b = 255 * Math.sin(t);
        } else {
          r = 125 * perc;
          g = 255 * perc;
          b = 255 * (1 - perc);
        }
        
        display.setPixel(x, y, r, g, b);
      }
    }
  }
}
  __stack.push({
    kind: "code", opacity: 1, blend: "screen", recolor: false, role: "paint", maskInvert: false,
    lut: null,
    buf: new Uint8ClampedArray(__W * __H * 4),
    params: {},
    fSetup: typeof setup === "function" ? setup : null,
    fUpdate: typeof update === "function" ? update : null,
    fDraw: typeof draw === "function" ? draw : null,
  });
})();

// ── code layer: Code 4 ──
(function () {
  // Shadow the wrapper's own exports: a layer that defines no setup/update
  // must yield undefined here, not capture the OUTER setup (infinite loop).
  var setup, update, draw;

function setup(params) {
  params.timeAcc = 0;
}

function update(dt, input, params) {
  params.k = input.knobValues;
  params.timeAcc += dt * params.k[1] * 0.4;
}

function draw(display, params, time) {
  const w = display.width, h = display.height;
  const t = params.timeAcc;
  const fov = params.k[2];
  const twist = params.k[0];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let nx = (x - w/2) / h;
      let ny = (y - h/2) / h;
      
      const z = 1.0 / (Math.sqrt(nx*nx + ny*ny) * fov + 0.1);
      const ang = Math.atan2(ny, nx) + z * twist + t;
      
      // Use the Z depth to simulate concentric ring layers
      const val = Math.sin(z - t * 2) * Math.cos(ang * 2);
      
      if (val > 0.5) {
        const depthCol = Math.min(255, z * 20);
        // Interior/exterior split colors
        if (z > 5) {
          display.setPixel(x, y, 255, depthCol, 100);
        } else {
          display.setPixel(x, y, depthCol, 200, 255);
        }
      }
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

// ── code layer: Code 5 ──
(function () {
  // Shadow the wrapper's own exports: a layer that defines no setup/update
  // must yield undefined here, not capture the OUTER setup (infinite loop).
  var setup, update, draw;

function setup(params) {
  params.timeAcc = 0;
}

function update(dt, input, params) {
  params.k = input.knobValues;
  params.timeAcc += dt * params.k[1];
}

function draw(display, params, time) {
  const w = display.width, h = display.height;
  const t = params.timeAcc;
  const count = Math.floor(params.k[0]);
  const strobe = params.k[2];

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - w/2, dy = y - h/2;
      const d = Math.max(Math.abs(dx), Math.abs(dy)); // Square distance
      
      const ringIdx = Math.floor((d / (h * 0.5)) * count);
      if (ringIdx < 1 || ringIdx >= count) continue;

      // Stepped rotation
      const step = params.k[3] * Math.PI;
      const angle = Math.floor((t + ringIdx) / step) * step;
      
      const rx = dx * Math.cos(angle) - dy * Math.sin(angle);
      const ry = dx * Math.sin(angle) + dy * Math.cos(angle);
      
      // Draw sharp mechanical borders
      const border = Math.max(Math.abs(rx), Math.abs(ry));
      const targetSize = (h * 0.4) * (ringIdx / count);
      
      if (Math.abs(border - targetSize) < 1.5) {
        // Flash based on strobe knob
        const flash = Math.sin(t * strobe + ringIdx) > 0 ? 255 : 50;
        
        // Red for outer, Blue for inner
        const r = ringIdx > count/2 ? flash : 0;
        const b = ringIdx <= count/2 ? flash : 0;
        
        display.setPixel(x, y, r, flash/2, b);
      }
    }
  }
}
  __stack.push({
    kind: "code", opacity: 1, blend: "add", recolor: false, role: "paint", maskInvert: false,
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
