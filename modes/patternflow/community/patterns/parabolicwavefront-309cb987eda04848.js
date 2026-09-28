// ===== Patternflow pattern =====
// Title:    ParabolicWavefront
// Author:   @engmung
// Date:     2026-08-10
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp oklchShort 0:#000000 0.898:#a6ff00 0.356:#49007a
// @knobs Curvature=0.2..3.5, FlowSpeed=0.1..6, WaveFreq=1.999..12, Dissipation=0.8..0.97
// @matrix 128x128
// @atlas mirror

// critical knob = Curvature, turning it crosses linear planar reflection ↔ cascading focal envelope singularities

/*
  Pattern 3: Parabolic Wavefront Focus Cascade
  Models continuous wave interference fields reflecting off undulating curved boundaries down 
  the vertical column. Reflected fronts envelope into sharp, bright caustic lines and cusps 
  that descend and cascade continuously.

  Knobs:
  Knob 1 (Curvature): Reflector curvature intensity (critical phase transition knob).
  Knob 2 (FlowSpeed): Downward cascade propagation speed.
  Knob 3 (WaveFreq): Spatial wave frequency of incoming fronts.
  Knob 4 (Dissipation): Field trail decay rate.
*/

export function setup(params) {
  const w = 128;
  const h = 128;
  params.w = w;
  params.h = h;
  params.t = 0;

  params.waveBuf = new Float32Array(w * h);
  params.peakEma = 1.0;

  // Prefill warmup
  for (let i = 0; i < 40; i++) {
    stepWave(params, 0.033, [1.8, 0.8, 6.0, 0.90]);
  }
}

function stepWave(params, dt, knobValues) {
  const w = params.w;
  const h = params.h;
  const buf = params.waveBuf;

  const curvature = knobValues[0];
  const speed = knobValues[1];
  const freq = knobValues[2];
  const dissipation = knobValues[3];

  params.t += dt * speed;
  const t = params.t;

  // Dissipate trail energy
  const decay = Math.max(0.75, Math.min(0.98, dissipation));
  for (let i = 0; i < w * h; i++) {
    buf[i] *= decay;
  }

  // Morphing secondary parameters
  const slowMorph = Math.sin(t * 0.13) * 0.3 + 1.0;

  for (let y = 0; y < h; y++) {
    const ny = (y / (h - 1)) * 2 - 1; // -1..1
    
    for (let x = 0; x < w; x++) {
      const nx = (x / (w - 1)) * 2 - 1; // -1..1

      // Mirror reflection surface deformation Z(x, y)
      const mirrorShape = curvature * (nx * nx - ny * ny * 0.5) + Math.sin(nx * 4 + t) * 0.15;
      
      // Phase delay caused by geometric optical path distance
      const pathDist = Math.sqrt(nx * nx + (ny + 1.5) * (ny + 1.5)) * slowMorph;
      const phase = pathDist * freq - t * 3.0 + mirrorShape * 4.0;

      // Wavefront interference amplitude (caustic envelopes form near phase stationary points)
      const amplitude = Math.cos(phase) + Math.cos(phase * 0.5 + mirrorShape);
      
      // Focus sharpening near caustic envelope condition
      const causticIntensity = 1.0 / (0.1 + Math.abs(amplitude));

      const idx = y * w + x;
      buf[idx] += causticIntensity * 0.08;

      // Divergence check
      if (!Number.isFinite(buf[idx])) {
        buf[idx] = 0;
      }
    }
  }

  // Tracking dynamic amplitude maximum
  let maxV = 0.001;
  for (let i = 0; i < w * h; i++) {
    if (buf[i] > maxV) maxV = buf[i];
  }
  params.peakEma = params.peakEma * 0.93 + maxV * 0.07;
}

export function update(dt, input, params) {
  const safeDt = Math.min(0.1, dt);
  stepWave(params, safeDt, input.knobValues);
}

export function draw(display, params, time) {
  const w = display.width;
  const h = display.height;
  const buf = params.waveBuf;
  const peak = Math.max(0.001, params.peakEma);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      let val = buf[idx] / peak;

      if (!Number.isFinite(val) || val < 0) val = 0;
      if (val > 1) val = 1;

      // Smooth contrast mapping
      val = val * val * (3 - 2 * val);

      display.setValue(x, y, val);
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
