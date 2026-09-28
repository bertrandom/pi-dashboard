// ===== Patternflow pattern =====
// Title:    DualLenseQuadrupole
// Author:   @engmung
// Date:     2026-08-10
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp linear 0.072:#000000 0:#a3a3a3 0.658:#ff0000
// @knobs ShearStrength=0.5..6, Rotation=0.1..2, SourceScale=1..6, Memory=0.82..0.98
// @matrix 128x128
// @atlas mirror

// critical knob = ShearStrength, turning it crosses gentle hyperbolic distortion ↔ critical quad-cusp lensing caustic collapse

/*
  Pattern 8: Dual-Lense Quadrupole Shearing Photons
  Simulates relativistic photon deflection under a rotating quadrupole gravitational lens.
  Photons emitted from a dynamic planar background stream vertically through the sheared space,
  forming shifting hyperbolic arc tangencies and multiple image caustics along the 1:2 frame.

  Knobs:
  Knob 1 (ShearStrength): Quadrupole mass tensor intensity (critical phase transition knob).
  Knob 2 (Rotation): Quadrupole lens system rotation speed.
  Knob 3 (SourceScale): Emitted background wave texture scale.
  Knob 4 (Memory): Frame persistence / sensor buffer retention.
*/

export function setup(params) {
  const w = 128;
  const h = 128;
  params.w = w;
  params.h = h;
  params.t = 0;

  params.canvas = new Float32Array(w * h);
  params.peakEma = 1.0;

  // Warmup simulation
  for (let i = 0; i < 50; i++) {
    stepQuadrupole(params, 0.033, [3.0, 0.6, 2.5, 0.93]);
  }
}

function stepQuadrupole(params, dt, knobValues) {
  const w = params.w;
  const h = params.h;
  const canvas = params.canvas;

  const shear = knobValues[0];
  const rotSpeed = knobValues[1];
  const scale = knobValues[2];
  const memory = knobValues[3];

  params.t += dt * rotSpeed;
  const t = params.t;

  // Decay buffer
  const fade = Math.max(0.70, Math.min(0.99, memory));
  for (let i = 0; i < w * h; i++) {
    canvas[i] *= fade;
  }

  // Quadrupole lens orientation
  const cosA = Math.cos(t);
  const sinA = Math.sin(t);

  for (let y = 0; y < h; y++) {
    const ny = (y / (h - 1)) * 2.0 - 1.0; // -1..1 along tall axis

    for (let x = 0; x < w; x++) {
      const nx = (x / (w - 1)) * 2.0 - 1.0; // -1..1

      // Rotate to lens frame
      const lx = nx * cosA - ny * sinA;
      const ly = nx * sinA + ny * cosA;

      // Quadrupole deflection potentials: dX = Q * (x^2 - y^2), dY = -2 * Q * x * y
      const rSq = lx * lx + ly * ly + 0.05;
      const defX = (shear * 0.15 * (lx * lx - ly * ly)) / (rSq * rSq);
      const defY = (-shear * 0.3 * lx * ly) / (rSq * rSq);

      // Back-projected source plane coordinates
      const srcX = nx + defX;
      const srcY = ny + defY;

      // Source sheet wave interference
      const wave1 = Math.sin(srcX * scale * 6.0 + t * 2.0);
      const wave2 = Math.cos(srcY * scale * 12.0 - t);
      const photonDensity = Math.pow(Math.abs(wave1 * wave2), 0.5);

      // Caustic magnification = inverse of Jacobian determinant of lens mapping
      const detJ = Math.abs(1.0 + (defX / (rSq + 0.01))) * Math.abs(1.0 + (defY / (rSq + 0.01)));
      const magnification = 0.2 / (detJ + 0.08);

      const idx = y * w + x;
      canvas[idx] += photonDensity * magnification * 0.12;

      if (!Number.isFinite(canvas[idx])) {
        canvas[idx] = 0;
      }
    }
  }

  // Dynamic scale tracking
  let maxV = 0.001;
  for (let i = 0; i < w * h; i++) {
    if (canvas[i] > maxV) maxV = canvas[i];
  }
  params.peakEma = params.peakEma * 0.94 + maxV * 0.06;
}

export function update(dt, input, params) {
  const safeDt = Math.min(0.1, dt);
  stepQuadrupole(params, safeDt, input.knobValues);
}

export function draw(display, params, time) {
  const w = display.width;
  const h = display.height;
  const canvas = params.canvas;
  const peak = Math.max(0.001, params.peakEma);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      let val = canvas[idx] / peak;

      if (!Number.isFinite(val) || val < 0) val = 0;
      if (val > 1) val = 1;

      // Tone shaping
      val = val * val * (3 - 2 * val);

      display.setValue(x, y, val);
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
