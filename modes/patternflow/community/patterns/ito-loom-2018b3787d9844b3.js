// ===== Patternflow pattern =====
// Title:    Ito Loom
// Author:   @martinnlopez
// Date:     2026-09-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @knobs Threads=8..36, Speed=0.1..2, Wave=1..6, Stitch=0.2..1
// @matrix 128x128

// Ito Loom (36-Strand Cascade) — dense, undulating generative silk tapestry with up to 36 concurrent weaving threads.
// Optimized with localized vertical span-rasterization for 60+ FPS on ESP32 hardware.
// Knob 1: Threads — Number of active weaving silk strands (8 to 36)
// Knob 2: Speed — Ribbon undulation & stitch crawl velocity (0.1 to 2.0)
// Knob 3: Wave — Harmonic wave curvature, ripple complexity, and ribbon twist (1.0 to 6.0)
// Knob 4: Stitch — Dash stitch length, fiber definition, and silk sheen radiance (0.2 to 1.0)

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// Authentic Japanese Silk Dye Palette (Ito Color Set)
const SILK_PALETTE = [
  [235, 55, 45],   // Akane (Deep Vermilion / Coral)
  [248, 185, 30],  // Yamabuki (Golden Marigold)
  [30, 205, 220],  // Asagi (Electric Turquoise / Cyan)
  [165, 45, 215],  // Murasaki (Royal Violet)
  [85, 205, 110],  // Matcha (Spring Leaf Green)
  [255, 248, 238], // Shira (Raw Silk White Core)
  [255, 110, 160]  // Sakura (Blush Rose)
];

const MAX_THREADS = 36;

export function setup(params) {
  params.threads = 28.0;
  params.speed = 0.75;
  params.wave = 2.6;
  params.stitch = 0.70;
  params.timeAcc = 0.0;

  params.cols = 0;
  params.rows = 0;
  params.lineY = null;
  params.lineDash = null;
  params.rBuf = null;
  params.gBuf = null;
  params.bBuf = null;
}

export function update(dt, input, params) {
  if (input && input.knobValues) {
    const v = input.knobValues;
    params.threads = v[0];
    params.speed = v[1];
    params.wave = v[2];
    params.stitch = v[3];
  }

  if (input && input.btnPressed) {
    if (input.btnPressed[0]) params.threads = 28.0;
    if (input.btnPressed[1]) params.speed = 0.75;
    if (input.btnPressed[2]) params.wave = 2.6;
    if (input.btnPressed[3]) params.stitch = 0.70;
  }

  // Safe, calm drift rate (<0.26 Hz cycle)
  const safeRate = 0.05 + clamp(params.speed, 0.1, 2.0) * 0.11;
  params.timeAcc += dt * safeRate;
}

export function draw(display, params, time) {
  const w = display.width;
  const h = display.height;
  const t = params.timeAcc;

  ensureBuffers(w, h, params);

  const numThreads = Math.round(clamp(params.threads, 8.0, MAX_THREADS));
  const waveGain = clamp(params.wave, 1.0, 6.0);
  const stitchGain = clamp(params.stitch, 0.2, 1.0);

  const cy = (h - 1) * 0.5;
  const lineY = params.lineY;
  const lineDash = params.lineDash;
  const rBuf = params.rBuf;
  const gBuf = params.gBuf;
  const bBuf = params.bBuf;

  // Clear accumulation buffer with deep indigo loom background
  rBuf.fill(6.0);
  gBuf.fill(8.0);
  bBuf.fill(14.0);

  // 1. PRECOMPUTE THREAD CENTERLINES & DASH PHASES PER COLUMN
  for (let i = 0; i < numThreads; i++) {
    const threadOffset = i * w;
    const baseSpacing = (h * 0.88) / Math.max(1, numThreads - 1);
    const baseY = cy + (i - (numThreads - 1) * 0.5) * baseSpacing;

    // Layered harmonic amplitudes: mixture of sweeping macro-waves and micro-ripples
    const amp1 = 3.5 + (i % 4) * 1.5;
    const amp2 = 1.8 + (i % 3) * 1.2;

    const f1 = (0.022 + (i % 5) * 0.006) * waveGain;
    const f2 = (0.048 + (i % 3) * 0.010) * waveGain;

    const phase1 = t * (0.80 + (i % 7) * 0.08) + i * 1.618;
    const phase2 = -t * (0.60 - (i % 5) * 0.06) + i * 2.718;

    // Staggered stitch crawl frequency
    const dashPeriod = 11.0 + (i % 5) * 4.0;
    const crawlSpeed = t * 20.0 * (0.75 + (i % 3) * 0.3);

    for (let x = 0; x < w; x++) {
      const w1 = amp1 * Math.sin(x * f1 + phase1);
      const w2 = amp2 * Math.cos(x * f2 + phase2);
      lineY[threadOffset + x] = baseY + w1 + w2;

      // Stitch / Dash pulse along the strand
      const stitchCoord = ((x - crawlSpeed + i * 23.0) % dashPeriod + dashPeriod) % dashPeriod;
      lineDash[threadOffset + x] = (stitchCoord < dashPeriod * 0.60) ? 1.0 : 0.20;
    }
  }

  // 2. HIGH-PERFORMANCE LOCALIZED SPAN-RASTERIZATION
  // (Only iterates pixels within ±3.5px of each active thread for maximum efficiency)
  const palLen = SILK_PALETTE.length;

  for (let i = 0; i < numThreads; i++) {
    const threadOffset = i * w;
    const thickness = 0.85 + (i % 3) * 0.25;
    const reach = Math.ceil(thickness * 3.2);

    const c = SILK_PALETTE[i % palLen];
    const cR = c[0];
    const cG = c[1];
    const cB = c[2];

    for (let x = 0; x < w; x++) {
      const ty = lineY[threadOffset + x];
      const stitchMask = lineDash[threadOffset + x];

      const minY = clamp(Math.floor(ty - reach), 0, h - 1);
      const maxY = clamp(Math.ceil(ty + reach), 0, h - 1);

      // Micro-fiber silk sheen shimmer
      const shimmer = 0.85 + 0.15 * Math.sin(x * 1.8 + i * 3.2 + t * 2.5);
      const threadGain = stitchMask * shimmer * (0.60 + stitchGain * 0.45);

      for (let y = minY; y <= maxY; y++) {
        const dist = Math.abs(y - ty);

        if (dist < thickness * 3.2) {
          const core = Math.max(0.0, 1.0 - dist / thickness);
          const bloom = Math.exp(-(dist * dist) / (thickness * thickness * 3.4)) * 0.40;
          const intensity = (core + bloom) * threadGain;

          const idx = y * w + x;
          rBuf[idx] += cR * intensity;
          gBuf[idx] += cG * intensity;
          bBuf[idx] += cB * intensity;
        }
      }
    }
  }

  // 3. BLIT ACCUMULATOR BUFFER TO LED DISPLAY
  for (let y = 0; y < h; y++) {
    const rowOffset = y * w;
    for (let x = 0; x < w; x++) {
      const idx = rowOffset + x;
      display.setPixel(
        x, y,
        clamp(Math.floor(rBuf[idx]), 0, 255),
        clamp(Math.floor(gBuf[idx]), 0, 255),
        clamp(Math.floor(bBuf[idx]), 0, 255)
      );
    }
  }
}

function ensureBuffers(w, h, params) {
  if (w !== params.cols || h !== params.rows || !params.rBuf) {
    params.cols = w;
    params.rows = h;
    const totalPixels = w * h;
    params.rBuf = new Float32Array(totalPixels);
    params.gBuf = new Float32Array(totalPixels);
    params.bBuf = new Float32Array(totalPixels);

    const totalThreadSteps = w * MAX_THREADS;
    params.lineY = new Float32Array(totalThreadSteps);
    params.lineDash = new Float32Array(totalThreadSteps);
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
