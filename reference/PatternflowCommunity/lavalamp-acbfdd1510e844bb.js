// ===== Patternflow pattern =====
// Title:    LavaLamp
// Author:   @WollyMeister
// Date:     2026-09-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @matrix 64x128
// @knobs Speed=0.1..2, Blobs=3..12, Goo=0..1, Palette=0..1
// Patternflow layer-stack composition — flattened by Pattern Lab.
// Layers (bottom → top):
//   1. Code 2 (code, normal, 100%)
//   2. Code 3 (code, normal, 100%)
const __W = 64, __H = 128;
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
// Knob 1 (Speed):   How fast the wax moves (1 = relaxed lamp pace)
// Knob 2 (Blobs):   Number of blobs; fewer blobs are bigger
// Knob 3 (Goo):     How readily blobs melt into each other
// Knob 4 (Palette): Classic, Lagoon, Sunset, Emerald, Twilight, Moonlight —
//                   each knob position settles on one, gliding between them

const MAX_BLOBS    = 12;
const OUTPUT_GAMMA = 2.0;   // LED gamma (see Vega). 1.0 for a true-colour browser preview

// Blob cycle (vertical units: the panel spans y = -1 (top) .. +1 (bottom))
const RISE_MIN   = 0.13, RISE_MAX = 0.26;   // rising speed range
const SINK_MIN   = 0.07, SINK_MAX = 0.14;   // sinking is slower, like cooling wax
const TURN_TOP_MIN = -0.82, TURN_TOP_MAX = -0.05;  // where a rising blob turns back
const REST_Y     = 0.96;   // blobs rest here, sunk into the pool
const REST_MIN   = 1.0,  REST_MAX = 9.0;    // seconds spent warming at the bottom
const ACCEL      = 0.55;   // how gently blobs change speed (lower = floatier)
const STRETCH    = 2.2;    // moving blobs elongate vertically (per unit of speed)
const STRETCH_MAX = 0.40;

// Shape: every blob wobbles through its own slowly turning lobes (2- and
// 3-fold ripples of its outline), has its own resting proportions, and
// trails a teardrop tail behind it while it moves.
const LOBE2_MIN  = 0.06, LOBE2_MAX = 0.24;  // oval / peanut-ness
const LOBE3_MIN  = 0.00, LOBE3_MAX = 0.14;  // three-cornered lumpiness
const LOBE_TURN  = 0.16;   // max turning speed of the lobes (radians/s)
const ASPECT_VAR = 0.18;   // resting proportions: up to this much taller or wider
const TAIL       = 2.0;    // teardrop tail per unit of speed
const TAIL_MAX   = 0.45;
const DRIFT_AMP  = 0.35;   // horizontal wandering
const BREATHE    = 0.08;   // how much each blob's radius swells and shrinks
const BLOB_R     = 0.19;    // base blob radius (the lamp is 1 unit wide, 2 tall)
const SPREAD     = 0.90;   // how much of the width the blobs' home columns use

// Shape and light
const AA         = 0.035;  // edge softness (~1 LED)
const POOL_Y     = 0.84;   // wax pool along the bottom edge
const POOL_WAVE  = 0.05;
const GLOW_FALL  = 5.0;    // how quickly the halo fades into the liquid
const GLOW_AMT   = 0.55;
const CORE_DEPTH = 0.22;   // how far inside the wax the bright core is reached
const LIQ_BREATHE = 0.10;  // slow brightness breathing of the lit liquid

// Each palette: wax edge, wax core (hot centre), liquid top, liquid bottom
// (the lit end), and the halo colour the wax casts.
const PALETTES = [
  { // Classic: orange wax in purple liquid
    edge: [0.88, 0.16, 0.04], core: [1.00, 0.70, 0.16],
    top:  [0.05, 0.01, 0.09], bot:  [0.40, 0.06, 0.32], halo: [0.95, 0.30, 0.10],
  },
  { // Lagoon: aqua wax in deep blue
    edge: [0.02, 0.52, 0.62], core: [0.55, 1.00, 0.88],
    top:  [0.01, 0.02, 0.10], bot:  [0.10, 0.12, 0.45], halo: [0.10, 0.70, 0.80],
  },
  { // Sunset: rose and amber in indigo
    edge: [0.92, 0.20, 0.42], core: [1.00, 0.80, 0.40],
    top:  [0.04, 0.02, 0.14], bot:  [0.50, 0.14, 0.18], halo: [1.00, 0.40, 0.30],
  },
  { // Emerald: lime wax in dark sea-green
    edge: [0.08, 0.58, 0.18], core: [0.82, 1.00, 0.40],
    top:  [0.00, 0.04, 0.05], bot:  [0.04, 0.26, 0.28], halo: [0.40, 0.90, 0.30],
  },
  { // Twilight: lavender wax over a teal glow
    edge: [0.52, 0.18, 0.90], core: [0.96, 0.80, 1.00],
    top:  [0.02, 0.01, 0.10], bot:  [0.04, 0.30, 0.38], halo: [0.60, 0.40, 1.00],
  },
  { // Moonlight: pale silver-blue wax in near-black
    edge: [0.34, 0.46, 0.76], core: [0.94, 0.97, 1.00],
    top:  [0.00, 0.00, 0.03], bot:  [0.08, 0.10, 0.20], halo: [0.60, 0.70, 1.00],
  },
];
const NUM_PAL = PALETTES.length;

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function mix(a, b, t) { return a + (b - a) * t; }
function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}
function mix3(a, b, t, out) {
  out[0] = mix(a[0], b[0], t); out[1] = mix(a[1], b[1], t); out[2] = mix(a[2], b[2], t);
}
// Polynomial smooth-min: blends two distances with a rounded "neck" of size k.
function smin(a, b, k) {
  if (k <= 1e-5) return a < b ? a : b;
  const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1);
  return mix(b, a, h) - k * h * (1 - h);
}

// Small deterministic PRNG so every run (and the firmware port) starts alike.
function makeRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function setup(params) {
  params.t        = 0.0;
  params.speed    = 1.0;
  params.nBlobs   = 5;
  params.goo      = 0.5;
  params.palette  = 0.0;
  params.palS     = 0.0;   // smoothed palette position
  params.sizeS    = 1.0;   // smoothed size scale

  const rnd = makeRng(20260925);
  params.rnd = rnd;
  params.blobs = [];
  for (let i = 0; i < MAX_BLOBS; i++) {
    const rising = rnd() < 0.5;
    params.blobs.push({
      baseX: ((((i * 7) % MAX_BLOBS) + 0.5) / MAX_BLOBS * 2 - 1) * SPREAD, // shuffled columns
      y:     mix(-0.7, REST_Y, ((i * 5) % MAX_BLOBS + rnd()) / MAX_BLOBS),
      vy:    0,
      mode:  rising ? 1 : 2,          // 0 = resting, 1 = rising, 2 = sinking
      timer: 0,
      vRise: mix(RISE_MIN, RISE_MAX, rnd()),
      vSink: mix(SINK_MIN, SINK_MAX, rnd()),
      turn:  mix(TURN_TOP_MIN, TURN_TOP_MAX, rnd()),
      size:  mix(0.75, 1.25, rnd()),
      phX:   rnd() * 6.2832,
      frX:   mix(0.05, 0.11, rnd()),
      phR:   rnd() * 6.2832,
      frR:   mix(0.20, 0.40, rnd()),
      vis:   i < 5 ? 1 : 0,
      a2:    mix(LOBE2_MIN, LOBE2_MAX, rnd()),
      a3:    mix(LOBE3_MIN, LOBE3_MAX, rnd()),
      ph2:   rnd() * 6.2832,
      ph3:   rnd() * 6.2832,
      w2:    mix(-LOBE_TURN, LOBE_TURN, rnd()),
      w3:    mix(-LOBE_TURN, LOBE_TURN, rnd()),
      phA:   rnd() * 6.2832,
      frA:   mix(0.04, 0.10, rnd()),
      asp:   1 + mix(-ASPECT_VAR, ASPECT_VAR, rnd()),
      x: 0, r: 0, sx: 1, sy: 1,
      c2: 1, s2: 0, c3: 1, s3: 0, amp: 1, tail: 0, tdir: 1,
    });
  }
  params.cols = { edge: [0,0,0], core: [0,0,0], top: [0,0,0], bot: [0,0,0], halo: [0,0,0] };
  params.rowBg = null;
}

function update(dt, input, params) {
  if (input && input.knobValues) {
    params.speed   = input.knobValues[0];
    params.nBlobs  = Math.round(input.knobValues[1]);
    params.goo     = input.knobValues[2];
    params.palette = input.knobValues[3];
  }
  const sdt = Math.min(dt, 0.1) * params.speed;   // simulation time step
  params.t += sdt;

  // Ease the palette position and the blob size, so knob turns glide.
  const ease = 1 - Math.exp(-3.0 * dt);
  const palTarget = Math.round(clamp(params.palette, 0, 1) * (NUM_PAL - 1)) / (NUM_PAL - 1);
  const palEase = 1 - Math.exp(-1.2 * dt);   // slow, dreamy crossfade
  params.palS += (palTarget - params.palS) * palEase;
  const n = clamp(params.nBlobs, 3, MAX_BLOBS);
  const targetSize = Math.sqrt(5 / n);            // fewer blobs -> bigger blobs
  params.sizeS += (targetSize - params.sizeS) * ease;

  const fade = 1 - Math.exp(-1.5 * dt);
  for (let i = 0; i < MAX_BLOBS; i++) {
    const b = params.blobs[i];
    b.vis += ((i < n ? 1 : 0) - b.vis) * fade;

    // The lamp cycle: rest (warming) -> rise -> turn -> sink -> rest ...
    const rnd = params.rnd;
    let target;
    if (b.mode === 0) {
      target = (REST_Y - b.y) * 0.8;               // settle into the pool
      b.timer -= sdt;
      if (b.timer <= 0) {
        b.mode = 1;
        b.vRise = mix(RISE_MIN, RISE_MAX, rnd());
        b.turn  = mix(TURN_TOP_MIN, TURN_TOP_MAX, rnd());
      }
    } else if (b.mode === 1) {
      target = -b.vRise;                            // up (negative y)
      if (b.y < b.turn) { b.mode = 2; b.vSink = mix(SINK_MIN, SINK_MAX, rnd()); }
    } else {
      target = b.vSink;                             // down
      if (b.y > REST_Y) { b.mode = 0; b.timer = mix(REST_MIN, REST_MAX, rnd()); }
    }
    b.vy += (target - b.vy) * (1 - Math.exp(-ACCEL * sdt));
    b.y  += b.vy * sdt;

    // Elongate while moving; the vertical radius grows, the horizontal shrinks a bit.
    const st = Math.min(STRETCH_MAX, Math.abs(b.vy) * STRETCH);
    b.sy = 1 / ((1 + st) * b.asp);   // smaller = taller
    b.sx = (1 + st * 0.35) * b.asp;  // larger = narrower

    // Slowly turning lobes, whose strength itself ebbs and flows.
    const a2 = b.ph2 + params.t * b.w2, a3 = b.ph3 + params.t * b.w3;
    b.c2 = Math.cos(a2); b.s2 = Math.sin(a2);
    b.c3 = Math.cos(a3); b.s3 = Math.sin(a3);
    b.amp = 0.6 + 0.4 * Math.sin(params.t * b.frA * 6.2832 + b.phA);

    // Teardrop tail trailing behind the direction of travel (y points down).
    b.tail = Math.min(TAIL_MAX, Math.abs(b.vy) * TAIL);
    b.tdir = b.vy < 0 ? 1 : -1;
    b.x = b.baseX + DRIFT_AMP * Math.sin(params.t * b.frX * 6.2832 + b.phX) * 0.5;
    b.r = BLOB_R * b.size * params.sizeS * b.vis *
          (1 + BREATHE * Math.sin(params.t * b.frR * 6.2832 + b.phR));
  }
}

function draw(display, params, time) {
  const w = display.width, h = display.height;
  const aspect = w / Math.max(1, h);
  const t = params.t;

  // Crossfade the palette once per frame.
  const pf = clamp(params.palS, 0, 1) * (NUM_PAL - 1);
  const p0 = Math.floor(pf), p1 = Math.min(NUM_PAL - 1, p0 + 1), pt = pf - p0;
  const A = PALETTES[p0], B = PALETTES[p1], C = params.cols;
  mix3(A.edge, B.edge, pt, C.edge); mix3(A.core, B.core, pt, C.core);
  mix3(A.top,  B.top,  pt, C.top);  mix3(A.bot,  B.bot,  pt, C.bot);
  mix3(A.halo, B.halo, pt, C.halo);

  const k = mix(0.03, 0.26, clamp(params.goo, 0, 1));   // smooth-union size (narrow lamp)
  const breathe = 1 + LIQ_BREATHE * Math.sin(t * 0.35);
  const poolFreq = 3.4 / aspect;   // about one gentle wave across the width

  // Only blobs that are at least a little visible take part.
  const blobs = params.blobs;
  const active = [];
  for (let i = 0; i < MAX_BLOBS; i++) if (blobs[i].r > 0.005) active.push(blobs[i]);

  for (let y = 0; y < h; y++) {
    const ny = ((y + 0.5) / h - 0.5) * 2.0;
    // Liquid: dark at the top, lit from below.
    const lit = smoothstep(-1.0, 1.0, ny);
    const lit2 = lit * lit * breathe;
    const lr = mix(C.top[0], C.bot[0], lit2);
    const lg = mix(C.top[1], C.bot[1], lit2);
    const lb = mix(C.top[2], C.bot[2], lit2);

    for (let x = 0; x < w; x++) {
      const nx = ((x + 0.5) / w - 0.5) * 2.0 * aspect;

      // Wax pool along the bottom, gently undulating.
      // (distance is negative inside the wax: below the pool surface)
      let d = (POOL_Y + POOL_WAVE * Math.sin(nx * poolFreq + t * 0.30)) - ny;

      for (let i = 0; i < active.length; i++) {
        const b = active[i];
        const dx = (nx - b.x * aspect) * b.sx, dy = (ny - b.y) * b.sy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        let def = 0;
        if (dist > 1e-4) {
          // Direction from the blob centre, and its 2x / 3x multiples
          // (angle-addition, so no atan2 is needed).
          const c = dx / dist, sn = dy / dist;
          const c2 = c * c - sn * sn, s2 = 2 * c * sn;
          const c3 = c * c2 - sn * s2, s3 = sn * c2 + c * s2;
          def = b.amp * (b.a2 * (c2 * b.c2 + s2 * b.s2) + b.a3 * (c3 * b.c3 + s3 * b.s3));
          const ts = sn * b.tdir;
          if (ts > 0) def += b.tail * ts * ts;
        }
        const di = dist - b.r * (1 + def);
        d = smin(d, di, k);
      }

      // Wax body: soft edge, hot bright core deeper inside.
      const wax   = smoothstep(AA, -AA, d);
      const depth = clamp(-d / CORE_DEPTH, 0, 1);
      const cw    = depth * (2 - depth);   // ease-out into the core
      const wr = mix(C.edge[0], C.core[0], cw);
      const wg = mix(C.edge[1], C.core[1], cw);
      const wb = mix(C.edge[2], C.core[2], cw);

      // Halo the wax casts into the liquid.
      const dd   = d > 0 ? d : 0;
      const fall = 1 / (1 + dd * GLOW_FALL);
      const glow = GLOW_AMT * fall * fall;
      const br = lr + C.halo[0] * glow * (0.4 + 0.6 * lit);
      const bg = lg + C.halo[1] * glow * (0.4 + 0.6 * lit);
      const bb = lb + C.halo[2] * glow * (0.4 + 0.6 * lit);

      let r = mix(br, wr, wax), g = mix(bg, wg, wax), bl = mix(bb, wb, wax);
      r = clamp(r, 0, 1); g = clamp(g, 0, 1); bl = clamp(bl, 0, 1);

      display.setPixel(
        x, y,
        Math.floor(Math.pow(r,  OUTPUT_GAMMA) * 255),
        Math.floor(Math.pow(g,  OUTPUT_GAMMA) * 255),
        Math.floor(Math.pow(bl, OUTPUT_GAMMA) * 255)
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
      const B = L.buf;
      const a = (B[j + 3] / 255) * L.opacity;
      if (a <= 0) continue;
      const sr = B[j], sg = B[j + 1], sb = B[j + 2], inv = 1 - a;
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
