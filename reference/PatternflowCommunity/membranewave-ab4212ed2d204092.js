// ===== Patternflow pattern =====
// Title:    MembraneWave
// Author:   @engmung
// Date:     2026-08-22
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp oklchLong 0.402:#000000 1:#ffffff 0.728:#00aaff
// @knobs Tension=0.08..0.45, Damp=0.001..0.03, Cadence=0.3..5, Gain=1..6
// @matrix 64x128



// Knobs: Tension = membrane wave speed: syrup ripples vs glassy shimmer
//        Damp    = energy loss: long-reverb chamber vs dead studio
//        Cadence = strikes per second from the wandering mallets
//        Gain    = render amplification (soft swells vs hard clipped crests)
// Button: btn1 = thunderclap at the center
// Waves genuinely reflect off the frame edges and interfere on the way back.

export function setup(params) {
  params.u0 = null; params.u1 = null;
  params.W = 0; params.H = 0;
  params.strikeT = 0;
  params.sign = 1;
  params.which = 0;
  params.clap = false;
  params.dtAcc = 0;
}

export function update(dt, input, params) {
  if (input.btnPressed[0]) params.clap = true;
  params.dtAcc += dt;
}

function poke(u, W, H, x, y, amp) {
  const ix = x | 0, iy = y | 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const px = ix + dx, py = iy + dy;
      if (px > 0 && px < W - 1 && py > 0 && py < H - 1) {
        u[py * W + px] += amp * (dx === 0 && dy === 0 ? 1 : 0.5);
      }
    }
  }
}

export function draw(display, params, time) {
  const W = display.width, H = display.height;
  if (!params.u0 || params.W !== W || params.H !== H) {
    params.u0 = new Float32Array(W * H);
    params.u1 = new Float32Array(W * H);
    params.W = W; params.H = H;
  }
  const k = params.knobValues || [0.3, 0.006, 1.5, 3];
  const c2 = k[0], damp = k[1], cadence = k[2], gain = k[3];
  let u0 = params.u0, u1 = params.u1;
  let dt = params.dtAcc; params.dtAcc = 0; if (dt > 0.1) dt = 0.1;

  // three mallets wandering the tall chamber on incommensurate paths
  params.strikeT -= dt * cadence;
  if (params.strikeT <= 0 || params.clap) {
    if (params.clap) {
      poke(u1, W, H, W * 0.5, H * 0.5, 5);
      params.clap = false;
    } else {
      const w = params.which;
      let sx2, sy2;
      if (w === 0) {
        sx2 = W * (0.5 + 0.34 * Math.sin(time * 0.41));
        sy2 = H * (0.22 + 0.1 * Math.sin(time * 0.29));
      } else if (w === 1) {
        sx2 = W * (0.5 + 0.34 * Math.sin(time * 0.33 + 2.1));
        sy2 = H * (0.5 + 0.12 * Math.cos(time * 0.24));
      } else {
        sx2 = W * (0.5 + 0.34 * Math.cos(time * 0.37 + 4.4));
        sy2 = H * (0.78 + 0.1 * Math.sin(time * 0.31 + 1.2));
      }
      poke(u1, W, H, sx2, sy2, 2.6 * params.sign);
      params.sign = -params.sign;
      params.which = (w + 1) % 3;
    }
    params.strikeT += 1;
    if (params.strikeT < 0) params.strikeT = 0.2;
  }

  // two integration substeps; edges held at zero -> reflection
  const dd = 1 - damp;
  for (let s = 0; s < 2; s++) {
    for (let y = 1; y < H - 1; y++) {
      const row = y * W;
      for (let x = 1; x < W - 1; x++) {
        const i = row + x;
        const lap = u1[i - 1] + u1[i + 1] + u1[i - W] + u1[i + W] - 4 * u1[i];
        u0[i] = (2 * u1[i] - u0[i] + c2 * lap) * dd;
      }
    }
    const t = u0; u0 = u1; u1 = t;
  }
  params.u0 = u0; params.u1 = u1;

  for (let y = 0, i = 0; y < H; y++) {
    for (let x = 0; x < W; x++, i++) {
      let v = 0.5 + u1[i] * gain * 0.5;
      if (v > 0.92) v = 1;        // hard crest glint
      else if (v < 0.06) v = 0;   // trough floor
      display.setValue(x, y, v < 0 ? 0 : v > 1 ? 1 : v);
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
