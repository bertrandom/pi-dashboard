// ===== Patternflow pattern =====
// Title:    Fractal Storm
// Author:   @WollyMeister
// Date:     2026-09-12
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @knobs Chaos=0..1, Speed=0.1..8, Palette=0..1, Symmetry=0..1
// @matrix 128x64


//
// A ridged-turbulence storm folded through a spinning kaleidoscope. Unlike the
// smooth nebula, this uses RIDGED fractal noise — sharp creases stacked octave on
// octave — then warps the field through itself so filaments tangle into filaments.
// A mirror fold multiplies it into a churning mandala. It's dense, fast, and busy
// on purpose. NOTE: the motion is local colour churn, not full-frame flashing —
// intense but not a strobe. Turn Speed down to calm the whole thing instantly.
//
// Knob 1 (Chaos):    Turbulence + fold strength — 0 = restless, 1 = full maelstrom.
// Knob 2 (Speed):    Everything's tempo (also your brake — low = slow, hypnotic).
// Knob 3 (Palette):  rainbow · neon-CMY · electric · acid · cyan-magenta · blue-pink.
// Knob 4 (Symmetry): Kaleidoscope mirror count, 1 (raw storm) → 12 (tight mandala).

const TAU = 6.28318530718;

// ── Tunables ────────────────────────────────────────────────────────────────────
const OCT        = 5;      // ridged octaves — the fractal depth (main cost dial)
const WARP_MAX   = 5.0;    // how violently Chaos=1 folds the domain
const LIT_LO     = 0.36;   // field value where light begins (higher = more black)
const LIT_HI     = 0.82;   // field value at full glow
const SOFT_GAIN  = 0.55;   // soft body brightness
const CORE_GAIN  = 4.5;    // hot core brightness
const EDGE_GAIN  = 1.1;    // brightness of the "lightning" filaments where fields cross
const EDGE_SHARP = 20.0;   // filament thinness (higher = thinner)
const SATURATION = 1.50;   // colour pop

// ── Palettes (IQ cosine a,b,c,d) — rainbow/neon-weighted for maximum chaos ───────
const PAL = [
  [0.50,0.50,0.50, 0.50,0.50,0.50, 1.00,1.00,1.00, 0.00,0.33,0.67], // 0 rainbow
  [0.50,0.50,0.50, 0.50,0.50,0.50, 1.00,1.00,1.00, 0.50,0.20,0.25], // 1 neon CMY
  [0.50,0.50,0.50, 0.50,0.50,0.50, 2.00,1.00,1.00, 0.00,0.25,0.50], // 2 electric (hi-freq)
  [0.50,0.50,0.50, 0.50,0.50,0.50, 1.00,1.00,0.50, 0.80,0.90,0.30], // 3 acid green/magenta
  [0.50,0.50,1.00, -0.50,0.50,0.00,1.00,1.00,1.00, 0.00,0.00,0.00], // 4 cyan/magenta
  [0.55,0.20,0.80, -0.45,0.10,0.20,1.00,1.00,1.00, 0.00,0.00,0.00], // 5 blue/pink
];
const N_PAL = PAL.length;

// ── Helpers ─────────────────────────────────────────────────────────────────────
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function fract(v)          { return v - Math.floor(v); }
function mix(a, b, t)      { return a + (b - a) * t; }
function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

function hash2(x, y) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3.0 - 2.0 * fx);
  const uy = fy * fy * (3.0 - 2.0 * fy);
  const a = hash2(ix,     iy);
  const b = hash2(ix + 1, iy);
  const c = hash2(ix,     iy + 1);
  const d = hash2(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
// Ridged fractal: fold each octave to a sharp crease (1 - |2n-1|) and stack them.
// The 2.03 lacunarity (not 2.0) keeps octaves from lining up — busier, less griddy.
function rfbm(x, y) {
  let v = 0.0, amp = 0.5, fx = x, fy = y, tot = 0.0;
  for (let o = 0; o < OCT; o++) {
    const n = vnoise(fx, fy);
    v   += amp * (1.0 - Math.abs(2.0 * n - 1.0));
    tot += amp;
    fx *= 2.03; fy *= 2.03; amp *= 0.5;
  }
  return v / tot;   // ~[0,1)
}

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

// ── Setup ──────────────────────────────────────────────────────────────────────
export function setup(params) {
  params.timeAcc = 0.0;
  params.warp    = 0.60;
  params.speed   = 1.0;
  params.mood    = 0.0;
  params.sym     = 0.40;
  params.rgb     = [0, 0, 0];
  params.col     = [0, 0, 0];   // scratch
  params.acc     = [0, 0, 0];   // scratch
}

// ── Update ─────────────────────────────────────────────────────────────────────
export function update(dt, input, params) {
  if (input && input.knobValues) {
    params.warp  = clamp(input.knobValues[0], 0.0, 1.0);
    params.speed = clamp(input.knobValues[1], 0.1, 8.0);
    params.mood  = clamp(input.knobValues[2], 0.0, 1.0);
    params.sym   = clamp(input.knobValues[3], 0.0, 1.0);
  } else if (input && input.knobDeltas) {
    params.warp  = clamp(params.warp  + input.knobDeltas[0] * 0.03, 0.0, 1.0);
    params.speed = clamp(params.speed + input.knobDeltas[1] * 0.25, 0.1, 8.0);
    params.mood  = clamp(params.mood  + input.knobDeltas[2] * 0.02, 0.0, 1.0);
    params.sym   = clamp(params.sym   + input.knobDeltas[3] * 0.03, 0.0, 1.0);
  }
  params.timeAcc += dt * params.speed;
}

// ── Draw ───────────────────────────────────────────────────────────────────────
export function draw(display, params, time) {
  const w   = display.width;
  const h   = display.height;
  const t   = params.timeAcc;
  const rgb = params.rgb;
  const col = params.col;
  const acc = params.acc;
  const aspect = w / Math.max(1, h);

  const scale = 2.6 + Math.sin(t * 0.08) * 0.8;   // breathing zoom
  const WARP  = params.warp * WARP_MAX;
  const sym   = Math.floor(1 + params.sym * 11.0); // 1..12 mirror wedges
  const seg   = TAU / sym;
  const spin  = t * 0.15;
  const cs = Math.cos(spin), sn = Math.sin(spin);
  const dx = t * 0.09, dy = t * 0.06;   // drift
  const cd = t * 0.14;                   // fast hue churn

  for (let py = 0; py < h; py++) {
    const vy0 = (py / h - 0.5) * scale;
    for (let px = 0; px < w; px++) {
      const vx0 = (px / w - 0.5) * scale * aspect;

      // spin
      let ux = vx0 * cs - vy0 * sn;
      let uy = vx0 * sn + vy0 * cs;

      // kaleidoscope mirror fold → mandala density
      if (sym > 1) {
        let a = Math.atan2(uy, ux);
        const r = Math.sqrt(ux * ux + uy * uy);
        a = a - seg * Math.floor(a / seg);
        if (a > seg * 0.5) a = seg - a;
        ux = r * Math.cos(a);
        uy = r * Math.sin(a);
      }

      // ── Ridged turbulence, warped through itself ───────────────────────────
      const bx = ux + dx, by = uy + dy;
      const q1 = rfbm(bx,       by);
      const q2 = rfbm(bx + 3.2, by + 1.7);
      const r1 = rfbm(bx + WARP * q1 + 1.7 + t * 0.10, by + WARP * q2 + 9.2);
      const r2 = rfbm(bx + WARP * q1 + 8.3,            by + WARP * q2 + 2.8 + t * 0.08);
      const f  = rfbm(bx + WARP * r1,                  by + WARP * r2);

      // tone: black gaps + soft body + hot cores
      const e      = smoothstep(LIT_LO, LIT_HI, f);
      const lum    = e * e * (3.0 - 2.0 * e);
      const bright = lum * SOFT_GAIN + lum * lum * lum * CORE_GAIN;

      // "lightning": bright thin filaments where the two warp fields cross
      const edge = Math.exp(-Math.abs(r1 - r2) * EDGE_SHARP);

      const hue = fract(f * 1.3 + r1 * 0.7 + q1 * 0.4 + cd);
      palette(hue, params.mood, col);
      palette(fract(hue + 0.4), params.mood, acc);   // accent hue for the filaments

      let r = col[0] * bright + acc[0] * edge * EDGE_GAIN;
      let g = col[1] * bright + acc[1] * edge * EDGE_GAIN;
      let b = col[2] * bright + acc[2] * edge * EDGE_GAIN;
      r = r / (1.0 + r); g = g / (1.0 + g); b = b / (1.0 + b);
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
