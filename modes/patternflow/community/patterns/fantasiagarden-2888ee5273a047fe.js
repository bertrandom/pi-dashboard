// ===== Patternflow pattern =====
// Title:    FantasiaGarden
// Author:   @engmung
// Date:     2026-08-11
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp oklchLong 0:#000000 0.792:#66ff00 0.119:#c54c44
// @knobs CorrLength=0..10, Speed=1..120, Contrast=0.3..2.5, AgeDecay=0.85..0.998
// @matrix 128x128



export function setup(params) {
  const W = 128;
  const H = 128;
  const N = W * H;

  // Knob 0: CorrLength — spatial smoothing of resistance (critical: thin ↔ blunt)
  // Knob 1: Speed — invasion steps per frame
  // Knob 2: Contrast — tonal contrast of age field
  // Knob 3: AgeDecay — how fast old territory fades
  // Knob 0 push → reseed with new resistance field

  params.W = W;
  params.H = H;
  params.N = N;

  params.resistance = new Float32Array(N);
  params.invaded = new Uint8Array(N);
  params.age = new Float32Array(N);
  params.frontier = [];

  params.t = 0;
  params.stepCounter = 0;
  params.maxAge = 1.0;
  params.scrollAccum = 0;
  params.resistanceOffset = 0; // scrolls the resistance field downward

  let seed = 0x7f3a1b2c;
  function rand() {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  }
  params.rand = rand;

  // Pre-generate a larger resistance bank (H*2 tall) for seamless scrolling
  params.resistanceBank = new Float32Array(W * H * 2);

  params.generateResistanceBank = function(corrLen) {
    const W = params.W, H = params.H;
    const bankH = H * 2;
    const totalN = W * bankH;

    // Raw noise
    for (let i = 0; i < totalN; i++) {
      params.resistanceBank[i] = rand();
    }

    // Smooth with box blur
    const radius = Math.max(1, Math.floor(corrLen));
    const temp = new Float32Array(totalN);
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < bankH; y++) {
        for (let x = 0; x < W; x++) {
          let sum = 0, count = 0;
          for (let dy = -radius; dy <= radius; dy++) {
            for (let dx = -radius; dx <= radius; dx++) {
              const sx = x + dx, sy = y + dy;
              if (sx >= 0 && sx < W && sy >= 0 && sy < bankH) {
                sum += params.resistanceBank[sy * W + sx];
                count++;
              }
            }
          }
          temp[y * W + x] = sum / count;
        }
      }
      for (let i = 0; i < totalN; i++) {
        params.resistanceBank[i] = temp[i];
      }
    }
  };

  // Map display y to resistance bank y with offset
  params.getResistance = function(x, y) {
    const W = params.W;
    const bankH = params.H * 2;
    let bankY = (y + params.resistanceOffset) % bankH;
    if (bankY < 0) bankY += bankH;
    return params.resistanceBank[bankY * W + x];
  };

  params.reseedSimulation = function(corrLen) {
    const W = params.W, H = params.H;
    params.generateResistanceBank(corrLen);
    params.invaded.fill(0);
    params.age.fill(0);
    params.frontier.length = 0;
    params.stepCounter = 0;
    params.maxAge = 1.0;

    // Map resistance bank slice into active resistance buffer
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        params.resistance[y * W + x] = params.getResistance(x, y);
      }
    }

    // Seed: invade bottom row
    for (let x = 5; x < W - 5; x++) {
      const idx = (H - 1) * W + x;
      if (rand() < 0.15) {
        params.invaded[idx] = 1;
        params.stepCounter++;
        params.age[idx] = params.stepCounter;
        if (params.stepCounter > params.maxAge) params.maxAge = params.stepCounter;
        addNeighbors(idx);
      }
    }
  };

  function addNeighbors(idx) {
    const W = params.W, H = params.H;
    const x = idx % W, y = Math.floor(idx / W);
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    for (let d = 0; d < 4; d++) {
      const nx = x + dirs[d][0], ny = y + dirs[d][1];
      if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
        const nidx = ny * W + nx;
        if (!params.invaded[nidx]) {
          let found = false;
          for (let f = 0; f < params.frontier.length; f++) {
            if (params.frontier[f].idx === nidx) { found = true; break; }
          }
          if (!found) {
            params.frontier.push({ idx: nidx, resistance: params.resistance[nidx] });
          }
        }
      }
    }
  }

  params.invadeOneSite = function() {
    if (params.frontier.length === 0) return false;

    // Find minimum resistance in frontier
    let minIdx = 0, minRes = params.frontier[0].resistance;
    for (let i = 1; i < params.frontier.length; i++) {
      if (params.frontier[i].resistance < minRes) {
        minRes = params.frontier[i].resistance;
        minIdx = i;
      }
    }

    const site = params.frontier[minIdx];
    params.frontier[minIdx] = params.frontier[params.frontier.length - 1];
    params.frontier.pop();

    params.invaded[site.idx] = 1;
    params.stepCounter++;
    params.age[site.idx] = params.stepCounter;
    if (params.stepCounter > params.maxAge) params.maxAge = params.stepCounter;

    addNeighbors(site.idx);
    return true;
  };

  // Scroll everything down by one row — the core infinite-flow mechanic
  params.scrollDown = function() {
    const W = params.W, H = params.H;
    // Shift invaded, age, and frontier indices down by one row
    for (let y = H - 1; y >= 1; y--) {
      for (let x = 0; x < W; x++) {
        const srcIdx = (y - 1) * W + x;
        const dstIdx = y * W + x;
        params.invaded[dstIdx] = params.invaded[srcIdx];
        params.age[dstIdx] = params.age[srcIdx] * 0.95; // slight decay on scroll
      }
    }
    // Clear top row
    for (let x = 0; x < W; x++) {
      params.invaded[x] = 0;
      params.age[x] = 0;
    }

    // Update resistance from scrolled bank
    params.resistanceOffset = (params.resistanceOffset + 1) % (H * 2);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        params.resistance[y * W + x] = params.getResistance(x, y);
      }
    }

    // Rebuild frontier from scratch
    params.frontier.length = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = y * W + x;
        if (params.invaded[idx]) {
          const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
          for (let d = 0; d < 4; d++) {
            const nx = x + dirs[d][0], ny = y + dirs[d][1];
            if (nx >= 0 && nx < W && ny >= 0 && ny < H) {
              const nidx = ny * W + nx;
              if (!params.invaded[nidx]) {
                let found = false;
                for (let f = 0; f < params.frontier.length; f++) {
                  if (params.frontier[f].idx === nidx) { found = true; break; }
                }
                if (!found) {
                  params.frontier.push({ idx: nidx, resistance: params.resistance[nidx] });
                }
              }
            }
          }
        }
      }
    }

    // Re-seed bottom row randomly to keep invasion going
    for (let x = 3; x < W - 3; x++) {
      const idx = (H - 1) * W + x;
      if (!params.invaded[idx] && rand() < 0.12) {
        params.invaded[idx] = 1;
        params.stepCounter++;
        params.age[idx] = params.stepCounter;
        if (params.stepCounter > params.maxAge) params.maxAge = params.stepCounter;
        addNeighbors(idx);
      }
    }
  };

  // Check if front has reached top — trigger scroll
  params.checkScroll = function() {
    const W = params.W, H = params.H;
    // Count invaded pixels in top 8 rows
    let topCount = 0;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < W; x++) {
        if (params.invaded[y * W + x]) topCount++;
      }
    }
    return topCount > 20; // threshold to trigger scroll
  };

  // Initial setup
  params.reseedSimulation(3.0);

  // Warmup
  const warmup = 1500;
  for (let i = 0; i < warmup; i++) {
    params.invadeOneSite();
  }
}

export function update(dt, input, params) {
  params.t += Math.min(dt, 0.1);

  const corrLen = input.knobValues[0];
  const speed = input.knobValues[1];
  const contrast = input.knobValues[2];
  const ageDecay = input.knobValues[3];

  // Knob 0 push → regenerate resistance bank and reseed
  if (input.btnPressed[0]) {
    params.reseedSimulation(corrLen);
    return;
  }

  const steps = Math.max(1, Math.floor(speed));
  for (let s = 0; s < steps; s++) {
    if (params.frontier.length === 0 || params.checkScroll()) {
      params.scrollDown();
    }
    if (!params.invadeOneSite()) {
      params.scrollDown();
    }
  }

  // Decay age field
  const decayBase = Math.pow(ageDecay, steps * 0.05);
  for (let i = 0; i < params.N; i++) {
    if (params.invaded[i]) {
      params.age[i] *= decayBase;
    }
  }

  // Slow maxAge decay so old territory gradually dims
  params.maxAge *= 0.9995;

  // Guard
  for (let i = 0; i < params.N; i++) {
    if (!isFinite(params.age[i]) || !isFinite(params.resistance[i])) {
      params.reseedSimulation(corrLen);
      break;
    }
  }
}

export function draw(display, params, time) {
  const W = display.width;
  const H = display.height;
  const age = params.age;
  const invaded = params.invaded;
  const contrast = params.knobValues ? params.knobValues[2] : 1.5;

  const invMaxAge = params.maxAge > 1.0 ? 1.0 / params.maxAge : 1.0;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      let v = 0;
      if (invaded[idx]) {
        // Normalize age: freshest = brightest
        v = age[idx] * invMaxAge;
        // Apply contrast curve
        v = Math.pow(Math.min(1, Math.max(0, v)), 1.0 / contrast);
      }
      display.setValue(x, y, v);
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
