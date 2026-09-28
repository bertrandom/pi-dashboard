// ===== Patternflow pattern =====
// Title:    Understory
// Author:   @martinnlopez
// Date:     2026-09-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @knobs Folds=3..12, Speed=0.1..10, Zoom=2..17, Contrast=0.1..1
// @matrix 64x128


export function setup(params) {
  params.t = 0;
  params.folds    = 6;
  params.speed    = 3.0;
  params.zoom     = 8;
  params.contrast = 0.5;
}

export function update(dt, input, params) {
  // Read knobs here where input is available, store on params
  params.folds    = input.knobValues[0];
  params.speed    = input.knobValues[1];
  params.zoom     = input.knobValues[2];
  params.contrast = input.knobValues[3];

  params.t += dt * params.speed;

  if (input.btnPressed[0]) params.t = 0; // tap knob 1 to reset time
}

export function draw(display, params) {
  const W = display.width;
  const H = display.height;
  const { folds, zoom, contrast, t } = params;

  function noise2(x, y, s) {
    return Math.sin(x * 1.3 + s) * Math.cos(y * 0.9 + s * 0.7)
         + Math.sin(x * 2.1 + s * 1.3) * Math.cos(y * 2.3 + s * 0.4) * 0.5
         + Math.sin(x * 0.4 + s * 2.1) * Math.cos(y * 1.7 + s * 1.1) * 0.25;
  }

  function leafVein(xi, yi, lt, folds, zoom) {
    const fx = xi / zoom, fy = yi / zoom;
    const sway = Math.sin(fy * 0.4 + lt * 0.7) * 0.8
               + Math.sin(fy * 0.15 + lt * 0.3) * 1.5;
    const cx = fx - sway;
    const midrib = Math.exp(-cx * cx * folds * 2.0) * 1.2;
    const vein = noise2(cx * folds * 0.8, fy * 2.0, lt * 0.1) * 0.5 + 0.5;
    const period = 14.0 / folds;
    const yOff = ((fy * folds * 0.5) % period + period) % period;
    const leafMask = Math.max(0, 1.0 - (yOff / (period * 0.5) - 1.0) ** 2);
    const xMask = Math.exp(-cx * cx * 0.4);
    return { base: vein * leafMask * xMask, midrib: midrib * leafMask * xMask, leafMask, xMask };
  }

  const layers = [
    { rg: [10, 60, 15, 40, 160, 30],  fade: 0.55 },
    { rg: [5,  80, 20, 20, 200, 50],  fade: 0.80 },
    { rg: [15,100, 10, 80, 220, 40],  fade: 1.00 },
  ];

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const xi = x - W / 2, yi = y - H / 2;
      let r = 0, g = 0, b = 0;

      for (let l = 0; l < 3; l++) {
        const lt = t + l * 1.7;
        const lx = xi + Math.sin(lt * 0.23 + l * 2.1) * 6;
        const ly = yi + (l - 1) * (H / 3) + Math.cos(lt * 0.17 + l) * 4;
        const v = leafVein(lx, ly, lt, folds, zoom);
        const gc = layers[l].rg;
        const shaft = Math.max(0, Math.sin(lx / zoom * 0.5 + lt * 0.4 + l * 1.3))
                    * Math.max(0, Math.sin(ly / zoom * 0.3 + lt * 0.2));
        const shimmer = shaft * shaft * 0.5;
        const intensity = Math.pow(Math.max(0, v.base * 0.7 + v.midrib * 0.3),
                                   1.0 / Math.max(0.1, contrast));
        const alpha = intensity * v.leafMask * v.xMask * layers[l].fade;
        r += (gc[0] + (gc[3] - gc[0]) * intensity + shimmer * 120) * alpha;
        g += (gc[1] + (gc[4] - gc[1]) * intensity + shimmer * 200) * alpha;
        b += (gc[2] + (gc[5] - gc[2]) * intensity + shimmer *  60) * alpha;
      }

      display.setPixel(x, y,
        Math.min(255, r + 5),
        Math.min(255, g + 20),
        Math.min(255, b + 8)
      );
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
