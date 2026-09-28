// ===== Patternflow pattern =====
// Title:    Mirrored Fractal
// Author:   @WollyMeister
// Date:     2026-09-12
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @knobs Shape=0..1, Speed=0.1..8, Palette=0..1, Symmetry=0..1
// @matrix 128x64


//
// A kaleidoscopic "Kali" fold field — NOT an escape-time set. Each pixel's
// coordinate is folded and sphere-inverted a fixed number of times; the orbit
// leaves a trap that we colour into glowing self-similar webs. There's no dead
// black interior like the Mandelbrot: structure blooms everywhere, at every
// scale, and a mirror-fold gives it a living mandala symmetry.
//
// Knob 1 (Shape):    Morphs the fold constant through 6 hand-picked "creatures".
//                    THE trippy knob — tiny changes rewire the whole web.
// Knob 2 (Speed):    Spin / drift / colour-flow speed (0.1 = hypnotic, 8 = wild).
// Knob 3 (Palette):  Colour mood — blends 8 looks: rainbow · neon-CMY · electric
//                    · toxic · fire · ocean · sunset · aurora.
// Knob 4 (Symmetry): Mandala mirror count, 1 (none) → 10 wedges.

const TAU = 6.28318530718;

// ── Tunables (quality / performance) ───────────────────────────────────────────
// SS: supersampling factor (SS×SS samples per pixel). The thin threads shimmer
//     hard on a moving 128×64 image; SS=2 calms it. This field is cheap (a fixed
//     ITER loop, no deep zoom) so 2 is basically free. 1 = off, 3 = for stills.
const SS   = 2;
const ITER = 14;   // fold iterations — more = finer filigree, linear cost

// Tone shaping (found by sweeping for "glow on dark", no LED white-out):
const GLOW_FALLOFF = 14.0;  // node glow tightness (higher = smaller hot cores)
const WEB_FALLOFF  = 60.0;  // thread thinness   (higher = finer threads)
const AMBIENT      = 0.03;  // faint base colour so voids aren't pure black
const GLOW_GAIN    = 2.4;   // brightness of the glowing nodes
const WEB_GAIN     = 1.8;   // brightness of the web threads
const SATURATION   = 1.40;  // colour pop: 1.0 = neutral, >1 pushes vividness (1.3–1.6 sweet spot)

// ── Fold constants — the "shapes" Knob 1 morphs through ─────────────────────────
// Ordered so every adjacent blend stays lush — no dark dead spots as you sweep.
const SHAPES = [
  [0.20, 1.00],
  [0.40, 1.00],
  [0.60, 1.00],
  [0.20, 0.30],
  [0.90, 0.20],
  [0.30, 0.50],
  [0.70, 0.20],
  [1.00, 0.40],
];
const N_SHAPE = SHAPES.length;

// ── Palette presets (IQ cosine): a,b,c,d packed as 12 numbers ───────────────────
const PAL = [
  [0.50,0.50,0.50, 0.50,0.50,0.50, 1.00,1.00,1.00, 0.00,0.33,0.67], // 0 rainbow  (full spectrum)
  [0.50,0.50,0.50, 0.50,0.50,0.50, 1.00,1.00,1.00, 0.50,0.20,0.25], // 1 neon CMY (electric cyan/magenta/yellow)
  [0.50,0.50,0.50, 0.50,0.50,0.50, 2.00,1.00,1.00, 0.00,0.25,0.50], // 2 electric (high-freq neon bands)
  [0.50,0.50,0.50, 0.50,0.50,0.50, 1.00,1.00,0.50, 0.80,0.90,0.30], // 3 toxic    (acid green/magenta)
  [0.55,0.30,0.20, 0.45,0.35,0.30, 1.00,1.00,1.00, 0.00,0.12,0.20], // 4 fire     (deep red/amber)
  [0.20,0.45,0.55, 0.30,0.40,0.42, 1.00,1.00,1.00, 0.55,0.60,0.65], // 5 ocean    (navy/teal/aqua)
  [0.60,0.35,0.42, 0.40,0.36,0.36, 1.00,1.00,1.00, 0.00,0.16,0.42], // 6 sunset   (coral/amber/violet)
  [0.28,0.50,0.42, 0.42,0.40,0.38, 1.00,1.20,1.00, 0.10,0.25,0.55], // 7 aurora   (green/blue/violet)
];
const N_PAL = PAL.length;

// ── Helpers ─────────────────────────────────────────────────────────────────────
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function fract(v)          { return v - Math.floor(v); }
function mix(a, b, t)      { return a + (b - a) * t; }

// Blend two adjacent presets by mood (0..1) and evaluate at t.
function palette(t, mood, out) {
  const h = mood * N_PAL;
  const i = Math.floor(h) % N_PAL;
  const j = (i + 1) % N_PAL;
  let f = h - Math.floor(h);
  f = f * f * (3.0 - 2.0 * f);
  const A = PAL[i], B = PAL[j];
  for (let k = 0; k < 3; k++) {
    const a = mix(A[k],   B[k],   f);
    const b = mix(A[3+k], B[3+k], f);
    const c = mix(A[6+k], B[6+k], f);
    const d = mix(A[9+k], B[9+k], f);
    out[k] = Math.max(0.0, a + b * Math.cos(TAU * (c * t + d)));
  }
}

// ── One folded sample → linear (pre-tonemap) RGB in `out` ───────────────────────
// ux,uy are already spun + kaleidoscope-folded. col/acc are reused scratch buffers.
function kaliColor(ux, uy, cx, cy, mood, colPhase, col, acc, out) {
  let zx = ux, zy = uy;
  let trapPt = 1e9;   // closest the orbit came to the origin -> glowing nodes
  let trapLn = 1e9;   // closest the orbit hugged an axis     -> web threads
  for (let i = 0; i < ITER; i++) {
    zx = Math.abs(zx);
    zy = Math.abs(zy);
    const d2 = zx * zx + zy * zy + 1e-6;   // sphere inversion (the "Kali" magic)
    zx = zx / d2 - cx;
    zy = zy / d2 - cy;
    const rr = zx * zx + zy * zy;
    if (rr < trapPt) trapPt = rr;
    const ln = Math.min(Math.abs(zx), Math.abs(zy));
    if (ln < trapLn) trapLn = ln;
  }
  trapPt = Math.sqrt(trapPt);

  const glow = Math.exp(-trapPt * GLOW_FALLOFF);
  const web  = Math.exp(-trapLn * WEB_FALLOFF);

  const tCol = fract(trapPt * 0.6 + colPhase);
  palette(tCol, mood, col);                 // node colour
  palette(fract(tCol + 0.35), mood, acc);   // thread accent colour

  out[0] = col[0] * AMBIENT + col[0] * glow * GLOW_GAIN + acc[0] * web * WEB_GAIN;
  out[1] = col[1] * AMBIENT + col[1] * glow * GLOW_GAIN + acc[1] * web * WEB_GAIN;
  out[2] = col[2] * AMBIENT + col[2] * glow * GLOW_GAIN + acc[2] * web * WEB_GAIN;
}

// ── Setup ──────────────────────────────────────────────────────────────────────
export function setup(params) {
  params.timeAcc = 0.0;
  params.shape   = 0.0;
  params.speed   = 1.0;
  params.mood    = 0.0;
  params.sym     = 0.0;
  params.rgb     = [0, 0, 0];
  params.col     = [0, 0, 0];        // scratch
  params.acc     = [0, 0, 0];        // scratch
  params.samp    = [0, 0, 0];        // scratch
  params.subY    = new Array(SS);    // per-row pre-spin y coords
}

// ── Update ─────────────────────────────────────────────────────────────────────
export function update(dt, input, params) {
  if (input && input.knobValues) {
    params.shape = clamp(input.knobValues[0], 0.0, 1.0);
    params.speed = clamp(input.knobValues[1], 0.1, 8.0);
    params.mood  = clamp(input.knobValues[2], 0.0, 1.0);
    params.sym   = clamp(input.knobValues[3], 0.0, 1.0);
  } else if (input && input.knobDeltas) {
    params.shape = clamp(params.shape + input.knobDeltas[0] * 0.03, 0.0, 1.0);
    params.speed = clamp(params.speed + input.knobDeltas[1] * 0.25, 0.1, 8.0);
    params.mood  = clamp(params.mood  + input.knobDeltas[2] * 0.02, 0.0, 1.0);
    params.sym   = clamp(params.sym   + input.knobDeltas[3] * 0.03, 0.0, 1.0);
  }
  params.timeAcc += dt * params.speed;
}

// ── Draw ───────────────────────────────────────────────────────────────────────
export function draw(display, params, time) {
  const w    = display.width;
  const h    = display.height;
  const t    = params.timeAcc;
  const rgb  = params.rgb;
  const col  = params.col;
  const acc  = params.acc;
  const samp = params.samp;
  const subY = params.subY;
  const aspect = w / Math.max(1, h);

  // Fold constant: blend along the shape list + a slow Lissajous drift so it
  // never sits perfectly still (this is what keeps it hypnotically alive).
  const sh = params.shape * N_SHAPE;
  const si = Math.floor(sh) % N_SHAPE;
  const sj = (si + 1) % N_SHAPE;
  let sf = sh - Math.floor(sh);
  sf = sf * sf * (3.0 - 2.0 * sf);
  const cx = mix(SHAPES[si][0], SHAPES[sj][0], sf) + Math.sin(t * 0.11) * 0.05;
  const cy = mix(SHAPES[si][1], SHAPES[sj][1], sf) + Math.cos(t * 0.09) * 0.05;

  // Mandala symmetry + slow spin + breathing zoom
  const sym  = Math.floor(1 + params.sym * 9.0);   // 1..10
  const seg  = TAU / sym;
  const spin = t * 0.05;
  const cs   = Math.cos(spin), sn = Math.sin(spin);
  const zoom = 1.30 + Math.sin(t * 0.07) * 0.15;
  const colPhase = t * 0.05;

  const invW  = 1.0 / w;
  const invH  = 1.0 / h;
  const invSS = 1.0 / SS;
  const norm  = 1.0 / (SS * SS);

  for (let py = 0; py < h; py++) {
    // pre-spin y of each sub-row
    for (let sy = 0; sy < SS; sy++) {
      subY[sy] = ((py + (sy + 0.5) * invSS) * invH - 0.5) * 2.0 * zoom;
    }

    for (let px = 0; px < w; px++) {
      let rA = 0.0, gA = 0.0, bA = 0.0;

      for (let sy = 0; sy < SS; sy++) {
        const vy0 = subY[sy];
        for (let sx = 0; sx < SS; sx++) {
          const vx0 = ((px + (sx + 0.5) * invSS) * invW - 0.5) * 2.0 * zoom * aspect;

          // global spin
          let ux = vx0 * cs - vy0 * sn;
          let uy = vx0 * sn + vy0 * cs;

          // kaleidoscope mirror fold → mandala symmetry
          if (sym > 1) {
            let a = Math.atan2(uy, ux);
            const r = Math.sqrt(ux * ux + uy * uy);
            a = a - seg * Math.floor(a / seg);
            if (a > seg * 0.5) a = seg - a;
            ux = r * Math.cos(a);
            uy = r * Math.sin(a);
          }

          kaliColor(ux, uy, cx, cy, params.mood, colPhase, col, acc, samp);
          rA += samp[0];
          gA += samp[1];
          bA += samp[2];
        }
      }

      // average, then soft highlight rolloff — bright areas glow & compress
      // instead of clipping to flat white (important on the LED panel).
      let r = rA * norm, g = gA * norm, b = bA * norm;
      r = r / (1.0 + r);
      g = g / (1.0 + g);
      b = b / (1.0 + b);

      // Saturation pop: push each channel away from the pixel's luminance so the
      // glowing cores stay vividly coloured instead of the rolloff greying them.
      const L = 0.30 * r + 0.59 * g + 0.11 * b;
      r = L + (r - L) * SATURATION;
      g = L + (g - L) * SATURATION;
      b = L + (b - L) * SATURATION;

      rgb[0] = Math.floor(clamp(r, 0.0, 1.0) * 255);
      rgb[1] = Math.floor(clamp(g, 0.0, 1.0) * 255);
      rgb[2] = Math.floor(clamp(b, 0.0, 1.0) * 255);
      display.setPixel(px, py, rgb[0], rgb[1], rgb[2]);
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
