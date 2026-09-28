// ===== Patternflow pattern =====
// Title:    Telemetry Bloom
// Author:   @martinnlopez
// Date:     2026-09-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp oklchLong recolor 0:#000000 0.531:#ff9300 0.195:#ff2600 0.794:#fefb00
// @knobs Speed=0..0.5, Density=1..4, Depth=2..5, Glow=0.2..1
// @matrix 64x128

// Telemetry Bloom — seamless infinite-zoom fly-through of an RGB cybernetic circuit board.
// Designed with calm, soothing, photosafe motion dynamics strictly below 0.35 Hz.
// Knob 1: Speed — Forward zoom velocity into the mainframe (0.1 to 2.0)
// Knob 2: Density — Conduit density & circuit trace complexity (1.0 to 4.0)
// Knob 3: Depth — Number of concurrent recursive scale planes (2.0 to 5.0)
// Knob 4: Glow — Optical trace bloom & additive color radiance (0.2 to 1.0)

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function setup(params) {
  params.speed = 0.65;
  params.density = 2.4;
  params.depth = 3.5;
  params.glow = 0.65;
  params.timeAcc = 0.0;
}

export function update(dt, input, params) {
  if (input && input.knobValues) {
    let v = input.knobValues;
    params.speed = v[0];
    params.density = v[1];
    params.depth = v[2];
    params.glow = v[3];
  }

  if (input && input.btnPressed) {
    if (input.btnPressed[0]) params.speed = 0.65;
    if (input.btnPressed[1]) params.density = 2.4;
    if (input.btnPressed[2]) params.depth = 3.5;
    if (input.btnPressed[3]) params.glow = 0.65;
  }

  // Safe, calm flight velocity (~0.12 Hz octave cycle)
  let safeSpeed = 0.06 + clamp(params.speed, 0.1, 2.0) * 0.14;
  params.timeAcc += dt * safeSpeed;
}

export function draw(display, params, time) {
  const w = display.width;
  const h = display.height;
  const t = params.timeAcc;

  const cx = (w - 1) * 0.5;
  const cy = (h - 1) * 0.5;

  const glowGain = clamp(params.glow, 0.2, 1.0);
  const density = clamp(params.density, 1.0, 4.0);
  const numLayers = Math.round(clamp(params.depth, 2.0, 5.0));

  // Infinite zoom logarithmic cycle
  const octaveScale = 2.6;
  const cycleFrac = (t * 0.35) % 1.0;
  const cycleEpoch = Math.floor(t * 0.35);

  // Precompute recursive layer transforms (avoids per-pixel allocations)
  // Layer weights use a smooth sine window to ensure 100% seamless appearance/disappearance
  let s0 = 0, s1 = 0, s2 = 0, s3 = 0, s4 = 0;
  let w0 = 0, w1 = 0, w2 = 0, w3 = 0, w4 = 0;
  let id0 = 0, id1 = 0, id2 = 0, id3 = 0, id4 = 0;

  for (let m = 0; m < numLayers; m++) {
    let layerFrac = (m - cycleFrac + numLayers) % numLayers;
    let scaleVal = Math.pow(octaveScale, layerFrac - 1.5);
    let weightVal = Math.sin(Math.PI * (layerFrac / numLayers));
    let layerIdVal = (cycleEpoch * numLayers + m) % 997;

    if (m === 0) { s0 = scaleVal; w0 = weightVal; id0 = layerIdVal; }
    else if (m === 1) { s1 = scaleVal; w1 = weightVal; id1 = layerIdVal; }
    else if (m === 2) { s2 = scaleVal; w2 = weightVal; id2 = layerIdVal; }
    else if (m === 3) { s3 = scaleVal; w3 = weightVal; id3 = layerIdVal; }
    else if (m === 4) { s4 = scaleVal; w4 = weightVal; id4 = layerIdVal; }
  }

  const basePitch = (h * 0.36) / density;
  const traceThickness = 0.085 * (0.6 + glowGain * 0.75);

  for (let y = 0; y < h; y++) {
    const dyScreen = y - cy;

    for (let x = 0; x < w; x++) {
      const dxScreen = x - cx;

      // Additive RGB accumulators
      let rAcc = 0.0;
      let gAcc = 0.0;
      let bAcc = 0.0;

      // Evaluate each active depth layer
      for (let m = 0; m < numLayers; m++) {
        let lScale = (m === 0) ? s0 : (m === 1) ? s1 : (m === 2) ? s2 : (m === 3) ? s3 : s4;
        let lWeight = (m === 0) ? w0 : (m === 1) ? w1 : (m === 2) ? w2 : (m === 3) ? w3 : w4;
        let lId = (m === 0) ? id0 : (m === 1) ? id1 : (m === 2) ? id2 : (m === 3) ? id3 : id4;

        if (lWeight <= 0.01) continue;

        // Coordinates on this circuit layer
        const px = dxScreen * lScale;
        const py = dyScreen * lScale;

        const gx = px / basePitch;
        const gy = py / basePitch;

        const ix = Math.floor(gx);
        const iy = Math.floor(gy);

        const fx = gx - ix;
        const fy = gy - iy;

        const dx = fx - 0.5;
        const dy = fy - 0.5;

        // Deterministic pseudo-random seed per PCB cell
        const cellHash = Math.sin(ix * 12.9898 + iy * 78.233 + lId * 19.317) * 43758.5453;
        const rnd = cellHash - Math.floor(cellHash);
        const rnd2 = (cellHash * 9.17) - Math.floor(cellHash * 9.17);

        // Continuous horizontal & vertical bus lanes
        const hasHBus = ((Math.abs(iy + lId) % 3 === 0) || (rnd > 0.42));
        const hasVBus = ((Math.abs(ix + lId * 2) % 3 === 0) || (rnd2 > 0.42));

        // 45-degree diagonal chamfers connecting traces
        const hasDiag = (rnd > 0.58 && (hasHBus || hasVBus));

        // Circular solder pads & open terminal via rings
        const hasPad = (rnd2 > 0.62);

        // Distance to circuit elements in this cell
        let minD = 99.0;

        if (hasHBus) {
          minD = Math.min(minD, Math.abs(dy));
        }

        if (hasVBus) {
          minD = Math.min(minD, Math.abs(dx));
        }

        if (hasDiag) {
          const dDiag = (rnd2 < 0.5) ? Math.abs(dx - dy) * 0.7071 : Math.abs(dx + dy) * 0.7071;
          minD = Math.min(minD, dDiag);
        }

        if (hasPad) {
          const rDist = Math.sqrt(dx * dx + dy * dy);
          // Hollow via eyelet or solid terminal pad
          const padDist = (rnd > 0.78) ? Math.abs(rDist - 0.24) : Math.max(0.0, rDist - 0.22);
          minD = Math.min(minD, padDist);
        }

        // Trace anti-aliasing & optical bloom profile
        if (minD < traceThickness * 3.6) {
          const core = Math.max(0.0, 1.0 - minD / traceThickness);
          const bloom = Math.exp(-(minD * minD) / (traceThickness * traceThickness * 4.2)) * 0.55;
          const bright = (core + bloom) * lWeight * glowGain;

          // Assign color channel: 0: Neon Red, 1: Electric Green, 2: Deep Cobalt Blue
          const colType = ((Math.abs(ix * 2 + iy + lId)) % 3);

          if (colType === 0) {
            // Neon Red conduit (with subtle optical warm bleed)
            rAcc += bright * 255.0;
            bAcc += bright * 18.0;
          } else if (colType === 1) {
            // Electric Lime-Green conduit
            gAcc += bright * 255.0;
            rAcc += bright * 22.0;
          } else {
            // Cobalt Blue conduit (with subtle cyan core)
            bAcc += bright * 255.0;
            gAcc += bright * 35.0;
          }
        }
      }

      // Additive color overlapping naturally yields:
      // Red + Green = Neon Yellow
      // Green + Blue = Electric Cyan
      // Red + Blue = Vivid Magenta
      // Multi-conduit junctions = Blinding White Core
      display.setPixel(
        x, y,
        clamp(Math.floor(rAcc), 0, 255),
        clamp(Math.floor(gAcc), 0, 255),
        clamp(Math.floor(bAcc), 0, 255)
      );
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
