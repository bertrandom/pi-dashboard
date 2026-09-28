// ===== Patternflow pattern =====
// Title:    flower_0917
// Author:   @engmung
// Date:     2026-09-16
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp linear 0:#000000 0.994:#ffea00 0.023:#00f01c 0.177:#005c39 0.373:#34ad58 0.399:#a95191 0.506:#b568a0 0.532:#fdff7a
// @knobs PetalCount=3..12, SpireSpeed=0.2..4, FloretScale=1.2..3.5, SwayAmp=0.5..3.5
// @matrix 128x128


// Knob 1 (PetalCount): Blossom symmetry and fold count
// Knob 2 (SpireSpeed): Overall animation rate for breeze and spores
// Knob 3 (FloretScale): Floret crown radius and lower stalk width
// Knob 4 (SwayAmp): Organic stem displacement range

export function setup(params) {
  params.time = 0;
  params.spires = [
    { x: 16, baseY: 127, tipY: 28, seed: 1.2, baseAmp: 5.0, flex: 1.15 },
    { x: 32, baseY: 127, tipY: 14, seed: 2.8, baseAmp: 6.5, flex: 1.05 },
    { x: 48, baseY: 127, tipY: 34, seed: 4.5, baseAmp: 4.5, flex: 1.25 },
    { x: 24, baseY: 127, tipY: 52, seed: 0.7, baseAmp: 3.5, flex: 1.30 },
    { x: 40, baseY: 127, tipY: 48, seed: 3.3, baseAmp: 3.8, flex: 1.20 }
  ];
}

export function update(dt, input, params) {
  params.time += dt * input.knobValues[1];
  params.petals = input.knobValues[0];
  params.scale = input.knobValues[2];
  params.swayAmp = input.knobValues[3];
}

export function draw(display, params, time) {
  const w = display.width;
  const h = display.height;
  const t = params.time;
  const petals = params.petals;
  const scale = params.scale;
  const ampMult = params.swayAmp;
  const glow = 0.68;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      display.setValue(x, y, 0.0);
    }
  }

  function addVal(px, py, v) {
    const ix = Math.floor(px);
    const iy = Math.floor(py);
    if (ix >= 0 && ix < w && iy >= 0 && iy < h) {
      display.setValue(ix, iy, Math.min(1.0, Math.max(v, 0.0)));
    }
  }

  function getSilkDisplacement(frac, sp) {
    const lagPhase = frac * 1.55;
    const wave = Math.sin(t * 1.05 + sp.seed - lagPhase);
    const counterWave = Math.sin(t * 0.52 + sp.seed * 0.5) * 0.35;
    const curve = Math.pow(frac, 1.8) * sp.flex;
    return (wave + counterWave) * (sp.baseAmp * ampMult) * curve;
  }

  for (let s = 0; s < params.spires.length; s++) {
    const sp = params.spires[s];
    const totalHeight = sp.baseY - sp.tipY;
    const steps = 75;

    for (let i = 0; i <= steps; i++) {
      const frac = i / steps;
      const py = sp.baseY - frac * totalHeight;
      const bend = getSilkDisplacement(frac, sp);
      const px = sp.x + bend;

      const stalkVal = 0.18 + frac * 0.18;
      addVal(px, py, stalkVal);
      addVal(px + 1, py, stalkVal * 0.7);
    }

    const nodeCount = 11;
    for (let n = 0; n < nodeCount; n++) {
      const nFrac = 0.35 + (n / nodeCount) * 0.65;
      const fy = sp.baseY - nFrac * totalHeight;

      const bend = getSilkDisplacement(nFrac, sp);
      const microSway = Math.sin(t * 1.4 + n * 0.5) * 0.4 * ampMult * nFrac;
      const fx = sp.x + bend + microSway;

      const fRad = (1.5 + nFrac * 2.5) * (scale * 0.45);
      const radLimit = Math.ceil(fRad * 1.8);

      for (let dy = -radLimit; dy <= radLimit; dy++) {
        for (let dx = -radLimit; dx <= radLimit; dx++) {
          const dist = Math.hypot(dx, dy);
          if (dist <= fRad * 1.7) {
            const angle = Math.atan2(dy, dx);
            const petalWave = 0.5 + 0.5 * Math.cos(angle * petals + t + n);
            const edgeDrop = Math.max(0.0, 1.0 - dist / (fRad * (0.8 + 0.6 * petalWave)));

            if (edgeDrop > 0.05) {
              const ringVal = Math.pow(edgeDrop, 1.3) * (0.45 + 0.55 * glow);
              const px = Math.floor(fx + dx);
              const py = Math.floor(fy + dy);
              if (px >= 0 && px < w && py >= 0 && py < h) {
                display.setValue(px, py, Math.min(1.0, ringVal));
              }
            }
          }
        }
      }

      addVal(fx, fy, Math.min(1.0, 0.85 + glow * 0.15));
      addVal(fx + 1, fy, 0.7 * glow);
    }
  }

  for (let p = 0; p < 24; p++) {
    const py = (h + 20 - ((t * 18 + p * 19) % (h + 30))) % h;
    const px = (p * 17 + Math.sin(t + p) * 12 + w) % w;
    const pVal = 0.4 + 0.6 * Math.sin(p + t * 3.0);
    addVal(px, py, Math.max(0.0, pVal * glow));
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
