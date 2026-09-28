// ===== Patternflow pattern =====
// Title:    Trippy Mandelbrot
// Author:   @WollyMeister
// Date:     2026-09-12
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @knobs Depth=0..1, Speed=0.1..10, Palette=0..1, Target=0..1
// @matrix 128x64


//
// Knob 1 (Depth):   Zoom range — shallow pass to deep abyss
// Knob 2 (Speed):   Dive and colour-cycle speed (slower = more meditative, higher = frenetic)
// Knob 3 (Palette): Colour mood — blends through 6 distinct looks:
//                     0.00 · Neon    — electric cyan / magenta / yellow
//                     0.17 · Ocean   — deep navy, teal, soft aqua
//                     0.33 · Sunset  — coral, amber, violet dusk
//                     0.50 · Aurora  — emerald, electric blue, soft purple
//                     0.67 · Ember   — deep crimson, amber, dark red
//                     0.83 · Ice     — pale silver-blue, cold white
//                     (wraps back to Neon at 1.0)
// Knob 4 (Target):  One of 8 iconic Mandelbrot landmarks

// ── Eight hand-picked Mandelbrot landmarks ─────────────────────────────────────
const TARGETS = [
  [-0.7453,  0.1127],   // 0 · Seahorse Valley
  [-0.7269,  0.1889],   // 1 · Double Spiral Arms
  [ 0.2929,  0.0113],   // 2 · Elephant Valley
  [-0.1592,  1.0317],   // 3 · Top Filament
  [-0.5250,  0.5260],   // 4 · Feather / Lightning
  [ 0.3602, -0.6413],   // 5 · Triple Spiral
  [-1.7491,  0.0001],   // 6 · Deep Antenna
  [-0.1010,  0.9562],   // 7 · Boundary Jewels
];

// ── Math helpers ───────────────────────────────────────────────────────────────
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function fract(v)          { return v - Math.floor(v); }
function mix(a, b, t)      { return a + (b - a) * t; }

// ── Six palette presets ────────────────────────────────────────────────────────
// Each entry uses the Íñigo Quílez cosine-palette formula:
//   colour(t) = a + b · cos(TAU · (c·t + d))
// stored as [aR,aG,aB, bR,bG,bB, cR,cG,cB, dR,dG,dB, gamma]
// gamma < 1  → sharp neon spikes;  gamma close to 1 → soft, calm gradients.
const PALETTES = [
  // 0 · Neon — electric cyan / magenta / yellow
  [0.50,0.50,0.50, 0.50,0.50,0.50, 1.00,1.15,0.82, 0.00,0.35,0.65, 0.38],
  // 1 · Ocean — deep navy, teal, soft aqua
  [0.15,0.35,0.55, 0.15,0.25,0.35, 0.80,0.90,1.10, 0.00,0.15,0.30, 0.65],
  // 2 · Sunset — coral, amber, violet dusk
  [0.60,0.28,0.30, 0.40,0.28,0.22, 0.85,1.00,0.75, 0.00,0.28,0.60, 0.55],
  // 3 · Aurora — emerald green, electric blue, soft lavender
  [0.20,0.50,0.40, 0.30,0.40,0.30, 1.00,0.80,1.20, 0.10,0.20,0.50, 0.50],
  // 4 · Ember — deep crimson, amber, dark red glow
  [0.55,0.18,0.08, 0.45,0.20,0.08, 0.70,0.90,1.10, 0.00,0.08,0.40, 0.42],
  // 5 · Ice — pale silver-blue, cold white, muted cyan
  [0.40,0.48,0.60, 0.22,0.22,0.32, 1.00,1.10,0.88, 0.00,0.10,0.20, 0.72],
];
const N_PAL = PALETTES.length; // 6

// Evaluate the blended palette at position t in [0,1].
// pal: 0..1 selects and smoothly interpolates between the 6 presets.
function blendedPal(t, pal, out) {
  const TAU = 6.28318530718;
  // Which two presets to blend
  const h  = pal * N_PAL;
  const i  = Math.floor(h) % N_PAL;
  const j  = (i + 1) % N_PAL;
  const f  = h - Math.floor(h);
  const sf = f * f * (3.0 - 2.0 * f);   // smoothstep — no snap at preset boundaries
  const pa = PALETTES[i];
  const pb = PALETTES[j];
  // Interpolate all IQ parameters
  const aR = mix(pa[0],pb[0],sf), aG = mix(pa[1],pb[1],sf), aB = mix(pa[2],pb[2],sf);
  const bR = mix(pa[3],pb[3],sf), bG = mix(pa[4],pb[4],sf), bB = mix(pa[5],pb[5],sf);
  const cR = mix(pa[6],pb[6],sf), cG = mix(pa[7],pb[7],sf), cB = mix(pa[8],pb[8],sf);
  const dR = mix(pa[9],pb[9],sf), dG = mix(pa[10],pb[10],sf), dB = mix(pa[11],pb[11],sf);
  const gamma = mix(pa[12], pb[12], sf);
  // Evaluate
  const r = aR + bR * Math.cos(TAU * (cR * t + dR));
  const g = aG + bG * Math.cos(TAU * (cG * t + dG));
  const b = aB + bB * Math.cos(TAU * (cB * t + dB));
  // pow-shaping: gamma < 1 sharpens peaks; gamma near 1 stays soft
  out[0] = Math.pow(Math.max(r, 0.0), gamma);
  out[1] = Math.pow(Math.max(g, 0.0), gamma);
  out[2] = Math.pow(Math.max(b, 0.0), gamma);
}

// ── Setup ──────────────────────────────────────────────────────────────────────
export function setup(params) {
  params.timeAcc = 0.0;
  params.zoomAcc = 0.0;
  params.depth   = 0.5;
  params.speed   = 1.0;
  params.pal     = 0.0;   // palette selector 0..1
  params.target  = 0;
  params.rgb     = [0, 0, 0];
  params.c1      = [0, 0, 0];   // primary colour buffer
  params.c2      = [0, 0, 0];   // secondary colour buffer
}

// ── Update ─────────────────────────────────────────────────────────────────────
export function update(dt, input, params) {
  if (input && input.knobValues) {
    params.depth  = clamp(input.knobValues[0], 0.0, 1.0);
    params.speed  = clamp(input.knobValues[1], 0.1, 10.0);
    params.pal    = clamp(input.knobValues[2], 0.0, 1.0);
    params.target = Math.floor(clamp(input.knobValues[3], 0.0, 1.0) * 7.9999);
  } else if (input && input.knobDeltas) {
    params.depth  = clamp(params.depth + input.knobDeltas[0] * 0.05, 0.0, 1.0);
    params.speed  = clamp(params.speed + input.knobDeltas[1] * 0.30, 0.1, 10.0);
    params.pal    = clamp(params.pal   + input.knobDeltas[2] * 0.02, 0.0, 1.0);
  }
  params.timeAcc += dt * params.speed;
  params.zoomAcc += dt * params.speed;
}

// ── Draw ───────────────────────────────────────────────────────────────────────
export function draw(display, params, time) {
  const w      = display.width;
  const h      = display.height;
  const t      = params.timeAcc;
  const pal    = params.pal;
  const rgb    = params.rgb;
  const c1     = params.c1;
  const c2     = params.c2;
  const aspect = w / Math.max(1, h);

  // ── Infinite zoom via modular logarithm ────────────────────────────────────
  //
  // The zoom grows as 10^logZoom. logZoom increases linearly then wraps back
  // to 0 — giving the illusion of endlessly falling into the fractal.
  // Because the Mandelbrot set is self-similar (mini-copies appear deeper),
  // the reset is visually seamless when the colour phase is also aligned.
  //
  // ZOOM_RATE: log-units per time-unit.  ZOOM_RANGE: total log-depth per dive.
  // Dive duration at speed=1: ZOOM_RANGE / ZOOM_RATE = 240 s per cycle.
  // At speed=0.1 that is 2 400 s (40 min) — effectively infinite to a viewer.
  const ZOOM_RATE  = 0.0125;                              // log-units / time-unit
  const ZOOM_RANGE = 3.0 + params.depth * 4.0;           // 3..7 log-units of depth
  const logZoom    = fract(params.zoomAcc * ZOOM_RATE / ZOOM_RANGE) * ZOOM_RANGE;
  const zoomLevel  = Math.pow(10.0, logZoom);

  // Iteration count scales with depth so detail stays sharp on the way down
  const maxIter = Math.min(360, Math.round(72 + 288 * (logZoom / Math.max(ZOOM_RANGE, 1.0))));

  // ── View window ────────────────────────────────────────────────────────────
  const [tCx, tCy] = TARGETS[params.target];
  // Lock phase: first quarter of the cycle pans toward target; rest is pure dive
  const zoomPhase = logZoom / ZOOM_RANGE;
  const lockS     = zoomPhase < 0.25
    ? (zoomPhase / 0.25) ** 2 * (3.0 - 2.0 * (zoomPhase / 0.25))   // smoothstep
    : 1.0;
  const viewCx = mix(-0.5, tCx, lockS);
  const viewCy = mix( 0.0, tCy, lockS);
  const halfW  = 2.0 * aspect / zoomLevel;
  const halfH  = 2.0          / zoomLevel;

  // Colour cycling: fast enough that the view is always animated, two
  // independent rates so the two neon layers never lock in phase.
  const cycle1 = t * 0.10;   // primary layer — sweeps roughly 1 full hue/10s
  const cycle2 = t * 0.07;   // secondary layer — slower, creates interference

  for (let py = 0; py < h; py++) {
    const ci = viewCy + (py / h - 0.5) * 2.0 * halfH;

    for (let px = 0; px < w; px++) {
      const cr = viewCx + (px / w - 0.5) * 2.0 * halfW;

      // ── Mandelbrot iteration ───────────────────────────────────────────────
      // z_{n+1} = z_n² + c,  z_0 = 0.  We also accumulate the orbit trap
      // (minimum |z|²) which reveals fine filament structure inside the set.
      let zr = 0.0, zi = 0.0;
      let iter = 0;
      let minDist2 = 1e9;

      while (iter < maxIter) {
        const zr2 = zr * zr;
        const zi2 = zi * zi;
        const d2  = zr2 + zi2;
        if (d2 < minDist2) minDist2 = d2;
        if (d2 > 4.0) break;
        const newZr = zr2 - zi2 + cr;
        zi = 2.0 * zr * zi + ci;
        zr = newZr;
        iter++;
      }

      let r_out = 0.0, g_out = 0.0, b_out = 0.0;

      if (iter < maxIter) {
        // ── Smooth iteration count (Bernstein / normalized) ─────────────────
        // Eliminates integer banding: gives a continuous value that maps
        // the gradient perfectly from boundary tendrils to deep-escaped voids.
        const modZ2  = zr * zr + zi * zi;
        const smooth = iter + 2.0 - Math.log2(Math.log2(Math.max(modZ2, 1.0001)));

        // Angle of escaped z: fine hue shimmer along boundary filaments
        const angle = Math.atan2(zi, zr) * (1.0 / (2.0 * Math.PI));

        // Orbit trap → controls blend between the two neon layers
        // Pixels whose orbits came close to the origin glow with layer 2;
        // far-escaping orbits stay in layer 1.  This paints the feathery
        // structure in a contrasting accent colour.
        const trapDist = Math.sqrt(minDist2);
        const trapBlend = 1.0 - Math.exp(-trapDist * 3.0);  // 0=close, 1=far

        // ── Layer 1: primary colour ──────────────────────────────────────────
        // smooth * 0.030 maps one palette period ≈ every 33 iteration bands
        const palT1 = fract(smooth * 0.030 + angle * 0.08 + cycle1);
        blendedPal(palT1, pal, c1);

        // ── Layer 2: accent colour (faster spatial frequency, offset phase) ─
        // Runs at 2.1× spatial frequency → finer interference stripes
        const palT2 = fract(smooth * 0.063 - angle * 0.12 + cycle2 + 0.38);
        blendedPal(palT2, fract(pal + 0.08), c2);  // slight palette offset for contrast

        // Luminance: the boundary region (large smooth, close to max iter) is
        // brightest — that's where the fractal detail lives.  Far-escaped
        // pixels fade to black so the set interior reads as dark void.
        const lum = 1.0 - Math.exp(-smooth * 0.20);

        // BRIGHT: additive blend of both layers.  Values can exceed 1 before
        // the final clamp, which gives a natural bloom / hot-spot effect.
        const w1 = 1.00;
        const w2 = 0.65 * (1.0 - trapBlend * 0.5);  // accent stronger near origin
        r_out = (c1[0] * w1 + c2[0] * w2) * lum;
        g_out = (c1[1] * w1 + c2[1] * w2) * lum;
        b_out = (c1[2] * w1 + c2[2] * w2) * lum;

      } else {
        // ── Interior (true set member) — pure black ────────────────────────
        r_out = 0.0;
        g_out = 0.0;
        b_out = 0.0;
      }

      rgb[0] = Math.floor(clamp(r_out, 0.0, 1.0) * 255);
      rgb[1] = Math.floor(clamp(g_out, 0.0, 1.0) * 255);
      rgb[2] = Math.floor(clamp(b_out, 0.0, 1.0) * 255);
      display.setPixel(px, py, rgb[0], rgb[1], rgb[2]);
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
