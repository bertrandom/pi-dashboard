// ===== Patternflow pattern =====
// Title:    Vega222
// Author:   @WollyMeister
// Date:     2026-09-18
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @matrix 128x128
// @knobs Grid=4..16, Bulge=0..1.4, Depth=0..1.5, Palette=0..1
// Patternflow layer-stack composition — flattened by Pattern Lab.
// Layers (bottom → top):
//   1. Code 2 (code, normal, 100%)
//   2. Code 3 (code, normal, 100%)
const __PW = 128, __PH = 64;
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

// Run-length coded RGBA: base64 of {count-1, r, g, b, a} tuples.
function __rle(s, n) {
  const t = __b64(s, (s.length * 3) >> 2), out = new Uint8ClampedArray(n);
  let o = 0;
  for (let i = 0; i + 4 < t.length && o < n; i += 5) {
    for (let k = t[i] + 1; k > 0 && o < n; k--) {
      out[o++] = t[i + 1]; out[o++] = t[i + 2]; out[o++] = t[i + 3]; out[o++] = t[i + 4];
    }
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
// New layer — draws a scrolling value field, colored by this layer's ramp.
// Replace with your own pattern. Only draw() is required.
function draw(display, params, time) {
  for (let y = 0; y < display.height; y++) {
    for (let x = 0; x < display.width; x++) {
      const v = (x / display.width + time * 0.12) % 1;
      display.setValue(x, y, v);
    }
  }
}

  __stack.push({
    kind: "code", opacity: 1, blend: "normal", recolor: false, role: "paint", maskInvert: false,
    lut: [0,0,0,255,1,1,1,255,2,2,2,255,3,3,3,255,4,4,4,255,5,5,5,255,6,6,6,255,7,7,7,255,8,8,8,255,9,9,9,255,10,10,10,255,11,11,11,255,12,12,12,255,13,13,13,255,14,14,14,255,15,15,15,255,16,16,16,255,17,17,17,255,18,18,18,255,19,19,19,255,20,20,20,255,21,21,21,255,22,22,22,255,23,23,23,255,24,24,24,255,25,25,25,255,26,26,26,255,27,27,27,255,28,28,28,255,29,29,29,255,30,30,30,255,31,31,31,255,32,32,32,255,33,33,33,255,34,34,34,255,35,35,35,255,36,36,36,255,37,37,37,255,38,38,38,255,39,39,39,255,40,40,40,255,41,41,41,255,42,42,42,255,43,43,43,255,44,44,44,255,45,45,45,255,46,46,46,255,47,47,47,255,48,48,48,255,49,49,49,255,50,50,50,255,51,51,51,255,52,52,52,255,53,53,53,255,54,54,54,255,55,55,55,255,56,56,56,255,57,57,57,255,58,58,58,255,59,59,59,255,60,60,60,255,61,61,61,255,62,62,62,255,63,63,63,255,64,64,64,255,65,65,65,255,66,66,66,255,67,67,67,255,68,68,68,255,69,69,69,255,70,70,70,255,71,71,71,255,72,72,72,255,73,73,73,255,74,74,74,255,75,75,75,255,76,76,76,255,77,77,77,255,78,78,78,255,79,79,79,255,80,80,80,255,81,81,81,255,82,82,82,255,83,83,83,255,84,84,84,255,85,85,85,255,86,86,86,255,87,87,87,255,88,88,88,255,89,89,89,255,90,90,90,255,91,91,91,255,92,92,92,255,93,93,93,255,94,94,94,255,95,95,95,255,96,96,96,255,97,97,97,255,98,98,98,255,99,99,99,255,100,100,100,255,101,101,101,255,102,102,102,255,103,103,103,255,104,104,104,255,105,105,105,255,106,106,106,255,107,107,107,255,108,108,108,255,109,109,109,255,110,110,110,255,111,111,111,255,112,112,112,255,113,113,113,255,114,114,114,255,115,115,115,255,116,116,116,255,117,117,117,255,118,118,118,255,119,119,119,255,120,120,120,255,121,121,121,255,122,122,122,255,123,123,123,255,124,124,124,255,125,125,125,255,126,126,126,255,127,127,127,255,128,128,128,255,129,129,129,255,130,130,130,255,131,131,131,255,132,132,132,255,133,133,133,255,134,134,134,255,135,135,135,255,136,136,136,255,137,137,137,255,138,138,138,255,139,139,139,255,140,140,140,255,141,141,141,255,142,142,142,255,143,143,143,255,144,144,144,255,145,145,145,255,146,146,146,255,147,147,147,255,148,148,148,255,149,149,149,255,150,150,150,255,151,151,151,255,152,152,152,255,153,153,153,255,154,154,154,255,155,155,155,255,156,156,156,255,157,157,157,255,158,158,158,255,159,159,159,255,160,160,160,255,161,161,161,255,162,162,162,255,163,163,163,255,164,164,164,255,165,165,165,255,166,166,166,255,167,167,167,255,168,168,168,255,169,169,169,255,170,170,170,255,171,171,171,255,172,172,172,255,173,173,173,255,174,174,174,255,175,175,175,255,176,176,176,255,177,177,177,255,178,178,178,255,179,179,179,255,180,180,180,255,181,181,181,255,182,182,182,255,183,183,183,255,184,184,184,255,185,185,185,255,186,186,186,255,187,187,187,255,188,188,188,255,189,189,189,255,190,190,190,255,191,191,191,255,192,192,192,255,193,193,193,255,194,194,194,255,195,195,195,255,196,196,196,255,197,197,197,255,198,198,198,255,199,199,199,255,200,200,200,255,201,201,201,255,202,202,202,255,203,203,203,255,204,204,204,255,205,205,205,255,206,206,206,255,207,207,207,255,208,208,208,255,209,209,209,255,210,210,210,255,211,211,211,255,212,212,212,255,213,213,213,255,214,214,214,255,215,215,215,255,216,216,216,255,217,217,217,255,218,218,218,255,219,219,219,255,220,220,220,255,221,221,221,255,222,222,222,255,223,223,223,255,224,224,224,255,225,225,225,255,226,226,226,255,227,227,227,255,228,228,228,255,229,229,229,255,230,230,230,255,231,231,231,255,232,232,232,255,233,233,233,255,234,234,234,255,235,235,235,255,236,236,236,255,237,237,237,255,238,238,238,255,239,239,239,255,240,240,240,255,241,241,241,255,242,242,242,255,243,243,243,255,244,244,244,255,245,245,245,255,246,246,246,255,247,247,247,255,248,248,248,255,249,249,249,255,250,250,250,255,251,251,251,255,252,252,252,255,253,253,253,255,254,254,254,255,255,255,255,255],
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



//
// Knob 1 (Grid):    Dot count across the sphere — coarse to fine lattice
// Knob 2 (Bulge):   Spherical swell (0 = flat op-art grid, 1 = full dome)
// Knob 3 (Depth):   Ripple strength — outward waves of swelling dots (0 = still)
// Knob 4 (Palette): Colour scheme — 0 is Vega 222 exactly, then variations

const R        = 0.92;   // sphere radius, in vertical (ny) units. Centered, fixed.
const RD_INNER = 0.27;   // red core radius   (cell units, 0.5 = cell edge)
const RD_OUTER = 0.40;   // green ring radius (cell units)
const AA       = 0.055;  // edge softness for the LEDs
const NUM_PAL  = 5;

// Outward ripple (driven by the Depth knob). Concentric waves of swelling
// and shrinking dots travel from the centre out to the panel edges.
const WAVE_FREQ   = 6.0;   // number of wave rings across the field
const WAVE_SPEED  = 3.2;   // how fast crests travel outward
const RIPPLE_SIZE = 0.22;  // how much the dots swell/shrink at full Depth
const RIPPLE_LUM  = 0.07;  // subtle brightness pulse so the flat field ripples too

// Each palette is one dot (core + ring) plus a background gradient sampled
// from the sphere centre (t=0) out past the silhouette (t>1 = the flat field).
const PALETTES = [
  { // 0 - Vega 222
    core: [0.85, 0.16, 0.16],   // vermilion
    ring: [0.14, 0.64, 0.38],   // viridian
    bg: [
      [0.00, [0.90, 0.91, 0.95]],  // white pole
      [0.20, [0.66, 0.76, 0.93]],  // light blue
      [0.42, [0.34, 0.48, 0.84]],  // blue
      [0.64, [0.18, 0.30, 0.66]],  // royal
      [0.86, [0.11, 0.17, 0.44]],  // indigo
      [1.00, [0.06, 0.09, 0.24]],  // dark silhouette
      [1.10, [0.15, 0.54, 0.40]],  // green flat field
      [2.00, [0.15, 0.54, 0.40]],
    ],
  },
  { // 1 - Ember
    core: [0.98, 0.80, 0.28],   // amber
    ring: [0.55, 0.08, 0.05],   // dark red
    bg: [
      [0.00, [0.98, 0.95, 0.86]],
      [0.24, [0.97, 0.66, 0.28]],
      [0.50, [0.86, 0.30, 0.12]],
      [0.78, [0.48, 0.10, 0.10]],
      [1.00, [0.16, 0.03, 0.05]],
      [1.10, [0.55, 0.32, 0.06]],
      [2.00, [0.55, 0.32, 0.06]],
    ],
  },
  { // 2 - Ice
    core: [0.96, 0.98, 1.00],   // white
    ring: [0.10, 0.48, 0.72],   // teal
    bg: [
      [0.00, [0.94, 0.98, 1.00]],
      [0.24, [0.60, 0.86, 0.95]],
      [0.50, [0.26, 0.56, 0.86]],
      [0.78, [0.12, 0.26, 0.62]],
      [1.00, [0.04, 0.08, 0.24]],
      [1.10, [0.14, 0.46, 0.52]],
      [2.00, [0.14, 0.46, 0.52]],
    ],
  },
  { // 3 - Orchid
    core: [0.96, 0.32, 0.66],   // pink
    ring: [0.92, 0.84, 0.24],   // yellow
    bg: [
      [0.00, [0.97, 0.93, 0.98]],
      [0.24, [0.78, 0.60, 0.90]],
      [0.50, [0.52, 0.28, 0.78]],
      [0.78, [0.30, 0.12, 0.52]],
      [1.00, [0.10, 0.04, 0.22]],
      [1.10, [0.46, 0.16, 0.52]],
      [2.00, [0.46, 0.16, 0.52]],
    ],
  },
  { // 4 - Inverted Vega
    core: [0.13, 0.62, 0.40],   // green core
    ring: [0.85, 0.16, 0.16],   // red ring
    bg: [
      [0.00, [0.92, 0.95, 0.92]],
      [0.22, [0.60, 0.84, 0.68]],
      [0.46, [0.24, 0.62, 0.46]],
      [0.72, [0.10, 0.34, 0.28]],
      [1.00, [0.04, 0.12, 0.10]],
      [1.10, [0.62, 0.14, 0.14]],
      [2.00, [0.62, 0.14, 0.14]],
    ],
  },
];

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function mix(a, b, t) { return a + (b - a) * t; }
function smoothstep(e0, e1, x) {
  let t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

// Sample a background gradient (array of [pos, [r,g,b]] stops) at t.
function sampleBg(stops, t, out) {
  if (t <= stops[0][0]) { const c = stops[0][1]; out[0]=c[0]; out[1]=c[1]; out[2]=c[2]; return; }
  const last = stops[stops.length - 1];
  if (t >= last[0]) { out[0]=last[1][0]; out[1]=last[1][1]; out[2]=last[1][2]; return; }
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const a = stops[i - 1], b = stops[i];
      const f = (t - a[0]) / (b[0] - a[0]);
      out[0] = mix(a[1][0], b[1][0], f);
      out[1] = mix(a[1][1], b[1][1], f);
      out[2] = mix(a[1][2], b[1][2], f);
      return;
    }
  }
}

function setup(params) {
  params.timeAcc  = 0.0;
  params.numCells = 12;   // dots across the sphere
  params.bulge    = 1.05; // full dome
  params.depth    = 0.7;  // gentle outward ripple by default (0 = still print)
  params.palette  = 0.0;  // Vega 222
  params.bg = [0, 0, 0];  // scratch (avoid per-pixel allocation)
}

function update(dt, input, params) {
  if (input && input.knobValues) {
    params.numCells = Math.max(4, Math.min(16, Math.round(input.knobValues[0])));
    params.bulge    = input.knobValues[1];
    params.depth    = input.knobValues[2];
    params.palette  = input.knobValues[3];
  }
  params.timeAcc += dt;
}

function draw(display, params, time) {
  const w = display.width;
  const h = display.height;
  const t = params.timeAcc;
  const n = params.numCells;
  const palId = Math.max(0, Math.min(NUM_PAL - 1, Math.floor(params.palette * NUM_PAL)));
  const pal   = PALETTES[palId];
  const core  = pal.core;
  const ring  = pal.ring;
  const bg    = params.bg;

  // Pixel-isotropic coords: one pixel is the same step in nx and ny, so the
  // sphere stays perfectly round. Centre of the panel = (0,0) = the sphere.
  const aspect = w / Math.max(1, h);

  // The sphere itself never moves, never leaves the centre, never changes
  // shape. The motion is a ripple layered on top (see the wave below), so the
  // composition stays exactly the print. Depth=0 freezes it completely.
  const bulge     = params.bulge;
  const rippleAmp = RIPPLE_SIZE * params.depth;
  const lumAmp    = RIPPLE_LUM  * params.depth;

  const s          = (2.0 * R) / n;      // lattice cell size
  const invHalfPi  = 1.0 / (Math.PI * 0.5);

  for (let y = 0; y < h; y++) {
    const ny = (y / h - 0.5) * 2.0;
    for (let x = 0; x < w; x++) {
      const nx = (x / w - 0.5) * 2.0 * aspect;

      const r = Math.sqrt(nx * nx + ny * ny);   // distance from centre

      // Spherical bulge (inverse warp), centred at the origin
      let gx, gy;
      const inside = r < R;
      if (inside && r > 1e-4) {
        const ratio    = r / R;
        const asinPart = invHalfPi * Math.asin(clamp(ratio, 0, 1));
        const rgNorm   = mix(ratio, asinPart, bulge);
        const scale    = rgNorm / ratio;
        gx = nx * scale;
        gy = ny * scale;
      } else if (inside) {
        gx = 0; gy = 0;
      } else {
        gx = nx; gy = ny;   // flat field, fixed
      }

      // Which dot, and where within its cell
      const cu = gx / s, cv = gy / s;
      const iu = Math.round(cu), iv = Math.round(cv);
      const ou = cu - iu, ov = cv - iv;
      const dCell = Math.sqrt(ou * ou + ov * ov);

      // Cell BACKGROUND from the sphere gradient.
      // Distance of this cell's centre from the sphere centre draws the
      // volume: small = white pole, ~1 = dark silhouette, >1 = green field.
      const gcx = iu * s, gcy = iv * s;
      const rc  = Math.sqrt(gcx * gcx + gcy * gcy);
      sampleBg(pal.bg, rc / R, bg);

      // Outward ripple: a wave in screen-space radius so crests march from
      // the centre to the panel edges, out past the sphere into the flat
      // field. It swells and shrinks the dots and gives a faint light pulse.
      const wave    = Math.sin(r * WAVE_FREQ - t * WAVE_SPEED);
      const rdScale = 1.0 + rippleAmp * wave;
      const rdOut   = RD_OUTER * rdScale;
      const rdIn    = RD_INNER * rdScale;

      // One dot on top: green ring, then red core
      const ringMask = smoothstep(rdOut + AA, rdOut - AA, dCell);
      const coreMask = smoothstep(rdIn + AA, rdIn - AA, dCell);

      let rr = bg[0], gg = bg[1], bb = bg[2];
      rr = mix(rr, ring[0], ringMask); gg = mix(gg, ring[1], ringMask); bb = mix(bb, ring[2], ringMask);
      rr = mix(rr, core[0], coreMask); gg = mix(gg, core[1], coreMask); bb = mix(bb, core[2], coreMask);

      const lum = 1.0 + lumAmp * wave;
      rr *= lum; gg *= lum; bb *= lum;

      display.setPixel(
        x, y,
        Math.floor(clamp(rr, 0, 1) * 255),
        Math.floor(clamp(gg, 0, 1) * 255),
        Math.floor(clamp(bb, 0, 1) * 255)
      );
    }
  }
}

// -- Made with Patternflow Pattern Lab - https://patternflow.work/pattern-lab --
// Shared under CC-BY-SA-4.0. Attribution is part of this licence -
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern.
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
