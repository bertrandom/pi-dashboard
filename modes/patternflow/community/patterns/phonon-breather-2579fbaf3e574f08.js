// ===== Patternflow pattern =====
// Title:    Phonon Breather
// Author:   @engmung
// Date:     2026-09-12
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp oklab 0:#000001 0.151:#2408a4 0.162:#62104d 0.179:#4f1e46 0.411:#9a979e 0.497:#171813 0.626:#1e122b 0.655:#827183
// @knobs BreathingFreq=0.2..4.5, LatticeDrift=0.2..3, ResonanceHarmo=1..6, CavityEcho=0.35..0.98
// @matrix 128x128



// Critical knob = BreathingFreq: switches between solitary wave envelopes, harmonic phonon splitting, and diamond cages

/*
  Knobs:
    BreathingFreq (0.2..4.5)      : Internal breathing frequency (omega). Higher values induce rapid phonon emission.
    LatticeDrift (0.2..3.0)       : Superlattice cavity drift and phase descent speed.
    ResonanceHarmonics (1.0..6.0) : Harmonic order of the resonant diamond interference lattice.
    CavityEcho (0.35..0.98)       : Feedback reflectivity within the hyperbolic acoustic cavity.
*/

export function setup(params) {
  params.W = 128;
  params.H = 128;
  const N = params.W * params.H;

  params.t = 0;
  params.maxNorm = 1.0;

  params.psi = new Float32Array(N);
  params.psiVel = new Float32Array(N);
  params.echo = new Float32Array(N);

  params.sampleEcho = function(xNorm, yNorm) {
    const x = (xNorm + 0.5) * params.W - 0.5;
    const y = (yNorm + 0.5) * params.H - 0.5;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const cx0 = Math.max(0, Math.min(params.W - 1, x0));
    const cx1 = Math.max(0, Math.min(params.W - 1, x0 + 1));
    const cy0 = Math.max(0, Math.min(params.H - 1, y0));
    const cy1 = Math.max(0, Math.min(params.H - 1, y0 + 1));

    const v00 = params.echo[cy0 * params.W + cx0];
    const v10 = params.echo[cy0 * params.W + cx1];
    const v01 = params.echo[cy1 * params.W + cx0];
    const v11 = params.echo[cy1 * params.W + cx1];

    return (v00 * (1 - fx) + v10 * fx) * (1 - fy) + (v01 * (1 - fx) + v11 * fx) * fy;
  };

  for (let i = 0; i < N; i++) {
    params.psi[i] = 0;
    params.psiVel[i] = 0;
    params.echo[i] = 0;
  }
}

export function update(dt, input, params) {
  const safeDt = Math.min(dt || 0.016, 0.05);
  params.t += safeDt;

  const bFreq    = input.knobValues ? input.knobValues[0] : 2.5;
  const speed    = input.knobValues ? input.knobValues[1] : 1.3;
  const harmonic = input.knobValues ? input.knobValues[2] : 3.0;
  const decay    = input.knobValues ? input.knobValues[3] : 0.88;

  if (input.btnPressed && input.btnPressed[0]) {
    for (let i = 0; i < params.W * params.H; i++) {
      params.psi[i] = 0;
      params.psiVel[i] = 0;
      params.echo[i] = 0;
    }
  }

  const W = params.W;
  const H = params.H;
  const t = params.t * speed;

  let maxInt = 0.01;

  for (let y = 0; y < H; y++) {
    const ny = (y / H) * 2.0 - 1.0;
    const yU = y > 0 ? y - 1 : H - 1;
    const yD = y < H - 1 ? y + 1 : 0;
    const row = y * W;

    for (let x = 0; x < W; x++) {
      const nx = (x / W) * 2.0 - 1.0;
      const xL = x > 0 ? x - 1 : W - 1;
      const xR = x < W - 1 ? x + 1 : 0;
      const idx = row + x;

      const p = params.psi[idx];
      const lap = params.psi[row + xL] + params.psi[row + xR] + params.psi[yU * W + x] + params.psi[yD * W + x] - 4.0 * p;

      // Sine-Gordon potential coupled to phononic superlattice
      const force = 0.38 * lap - Math.sin(p);
      let vel = (params.psiVel[idx] + safeDt * force) * 0.985;
      let nextPsi = p + safeDt * vel;

      // Analytical-numerical Polaron Breather Solution:
      // u_breather = -4 * atan( (sqrt(1-w^2)/w) * sin(w*t) / cosh(sqrt(1-w^2)*x) )
      const om = Math.min(0.95, Math.max(0.1, bFreq * 0.25));
      const eta = Math.sqrt(1.0 - om * om);
      const breathPhase = om * (t * 4.0);

      const kx1 = (nx + 0.35 * Math.sin(t * 0.8)) * harmonic * 1.5;
      const ky1 = (ny - (t * 0.3) % 2.0 + 0.5) * harmonic * 1.5;
      const breather1 = -4.0 * Math.atan((eta / om) * Math.sin(breathPhase) / (Math.cosh(eta * kx1) * Math.cosh(eta * ky1)));

      const kx2 = (nx - 0.35 * Math.sin(t * 0.8)) * harmonic * 1.5;
      const breather2 = -4.0 * Math.atan((eta / om) * Math.sin(breathPhase + Math.PI) / (Math.cosh(eta * kx2) * Math.cosh(eta * ky1)));

      nextPsi += (breather1 + breather2) * 0.03;
      if (!isFinite(nextPsi)) { nextPsi = 0; vel = 0; }

      params.psi[idx] = nextPsi;
      params.psiVel[idx] = vel;

      // Acoustic energy concentration
      const gradX = (params.psi[row + xR] - params.psi[row + xL]) * 0.5;
      const gradY = (params.psi[yD * W + x] - params.psi[yU * W + x]) * 0.5;
      const polaronEnergy = (vel * vel) + (gradX * gradX + gradY * gradY) * 0.6 + (1.0 - Math.cos(nextPsi));

      // Hyperbolic cavity reflection warp
      const uCoord = nx * 0.48 + 0.015 * Math.sin(nextPsi * 3.0);
      const vCoord = ny * 0.48 + 0.008 * Math.cos(nextPsi * 3.0) + 0.006;

      const prevEcho = params.sampleEcho(uCoord, vCoord);
      const nextEcho = prevEcho * decay + polaronEnergy * 0.38;

      params.echo[idx] = isFinite(nextEcho) ? nextEcho : 0;
      if (nextEcho > maxInt) maxInt = nextEcho;
    }
  }

  params.maxNorm += (maxInt - params.maxNorm) * 0.08;
}

export function draw(display, params, time) {
  const W = display.width;
  const H = display.height;
  const norm = 1.0 / Math.max(0.001, params.maxNorm);

  for (let y = 0; y < H; y++) {
    const row = y * W;
    for (let x = 0; x < W; x++) {
      const idx = row + x;
      const e = params.echo[idx] * norm;
      const p = params.psi[idx];

      // Diamond interference nodes
      const diamond = Math.abs(Math.sin(p * harmonicNode(params)));
      let tonal = e * 0.72 + diamond * 0.4;
      tonal = Math.max(0.0, Math.min(1.0, tonal));

      const v = tonal * tonal * (3.0 - 2.0 * tonal);
      display.setValue(x, y, v);
    }
  }
}

function harmonicNode(params) {
  return 1.5;
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
