// ===== Patternflow pattern =====
// Title:    green
// Author:   @engmung
// Date:     2026-08-16
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp oklchShort 0.325:#000000 0.919:#44ff00 0.431:#006607
// @knobs DissolutionPot=0.1..2, SeepageSpeed=0.3..2.5, MineralDeposit=0.985..1, PoreScale=2..8
// @matrix 128x128

//
// Porous Percolation Lattice
// Critical knob = DissolutionPot (Knob 1), turning it crosses choked pore seepage ↔ runaway wormhole dissolution channels.
// Knob 2 = SeepageSpeed (Upward percolation velocity)
// Knob 3 = MineralDeposition (Pore calcification & clog rate)
// Knob 4 = PoreScale (Lattice grain packing density)

export function setup(params) {
  const W = 128;
  const H = 128;
  params.W = W;
  params.H = H;
  params.t = 0;
  params.rock = new Float32Array(W * H);
  params.maxAmpEMA = 1.0;

  let seed = 67104;
  function rnd() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296.0;
  }

  // Pre-seed porous cellular rock matrix (Voronoi/harmonic cellular field)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = (x / W) * 8.0;
      const ny = (y / H) * 16.0;
      const c1 = Math.sin(nx * 3.0 + Math.sin(ny * 2.0));
      const c2 = Math.cos(ny * 3.0 + Math.cos(nx * 2.0));
      params.rock[y * W + x] = Math.max(0.0, Math.min(1.0, (c1 * c2) * 0.5 + 0.5 + rnd() * 0.15));
    }
  }
}

export function update(dt, input, params) {
  const clampedDt = Math.min(dt, 0.1);
  const kv = input.knobValues;
  const acidPot = kv[0];
  const speed = kv[1];
  const deposition = kv[2];
  const poreScale = kv[3];

  params.t += clampedDt * speed;

  const W = params.W;
  const H = params.H;
  const t = params.t;
  const rock = params.rock;

  for (let y = 0; y < H; y++) {
    const ny = ((H - 1 - y) / H) * 8.0;

    for (let x = 0; x < W; x++) {
      const nx = (x / W) * 4.0 - 2.0;
      const idx = y * W + x;

      // Calcification/mineral regrowth
      rock[idx] = Math.min(1.0, rock[idx] * deposition + 0.002);

      let percolationFlux = 0.0;
      for (let p = 0; p < 4; p++) {
        const pathTilt = Math.sin(p * 1.57 + t * 0.3) * 0.8;
        const wavePos = ny - (t * (1.3 + p * 0.4) + p * 2.0);
        const wrapped = ((wavePos % 8.0) + 8.0) % 8.0 - 4.0;

        const xPos = nx - pathTilt;
        const sechX = 1.0 / Math.cosh(xPos / 0.4);
        const sechY = 1.0 / Math.cosh(wrapped / 0.35);

        // Fluid concentrates in existing pores (1 - rock)
        const localPermeability = (1.0 - rock[idx] * 0.8);
        percolationFlux += (sechX * sechX) * (sechY * sechY) * (1.8 + p * 0.6) * localPermeability;
      }

      // Acidic dissolution of rock throat channels
      if (percolationFlux > acidPot) {
        const dissolve = (percolationFlux - acidPot) * 0.15;
        rock[idx] = Math.max(0.0, rock[idx] - dissolve);
      }
    }
  }
}

export function draw(display, params, time) {
  const W = display.width;
  const H = display.height;
  const rock = params.rock;
  let peak = 0.01;

  for (let y = 0; y < H; y++) {
    const row = y * W;
    for (let x = 0; x < W; x++) {
      const r = rock[row + x];

      const left = rock[row + ((x - 1 + W) % W)];
      const right = rock[row + ((x + 1) % W)];
      const up = y > 0 ? rock[(y - 1) * W + x] : r;
      const down = y < H - 1 ? rock[(y + 1) * W + x] : r;

      const poreBoundary = Math.abs(right - left) + Math.abs(down - up);
      // Fluid-filled channels (1 - r) glowing against dark rock skeleton
      const view = (1.0 - r) * 0.8 + poreBoundary * 2.0;

      if (view > peak && Number.isFinite(view)) peak = view;

      const norm = view / Math.max(0.01, params.maxAmpEMA);
      let out = Math.max(0.0, Math.min(1.0, norm));
      out = out * out * (3.0 - 2.0 * out);

      display.setValue(x, y, out);
    }
  }

  params.maxAmpEMA = params.maxAmpEMA * 0.93 + peak * 0.07;
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
