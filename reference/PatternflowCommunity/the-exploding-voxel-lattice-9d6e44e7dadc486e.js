// ===== Patternflow pattern =====
// Title:    The Exploding Voxel Lattice
// Author:   @martinnlopez
// Date:     2026-07-30
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp linear 0:#0432ff 1:#ffffff 0.291:#1903a4 0.97:#ff40ff
// @matrix 64x128

// @knobs Glitch=0..1, Speed=0.05..5, Freq=10..120, Quantize=2..10
//
// Knob 1 (Glitch): Phase displacement and row slippage amount
// Knob 2 (Speed): Base time flow rate
// Knob 3 (Freq): Spatial frequency of the wave generation
// Knob 4 (Quantize): Level discretization steps for a stepped material feel

export function setup(params) {
    params.angle = 0;
}

export function update(dt, input, params) {
    const knob = input.knobValues;
    params.exp = knob[0];
    params.speed = knob[1];
    params.morph = knob[2];
    params.detail = Math.floor(knob[3]);
    params.angle += dt * params.speed;
}

export function draw(display, params, time) {
    const w = display.width;
    const h = display.height;
    const d = params.detail;
    const wave = Math.sin(params.angle) * params.exp;

    for (let i = 0; i < d; i++) {
        for (let j = 0; j < d; j++) {
            for (let k = 0; k < d; k++) {
                let x = (i / (d - 1)) * 2 - 1;
                let y = (j / (d - 1)) * 2 - 1;
                let z = (k / (d - 1)) * 2 - 1;

                // Explode logic
                let mag = Math.sqrt(x*x + y*y + z*z);
                let offset = (mag * params.morph) * wave;
                x += x * offset;
                y += y * offset;
                z += z * offset;

                // Projection
                let rot = params.angle * 0.5;
                let cr = Math.cos(rot), sr = Math.sin(rot);
                let x1 = x * cr - z * sr;
                let z1 = x * sr + z * cr;
                
                let px = Math.floor(w / 2 + x1 * 15);
                let py = Math.floor(h / 2 - y * 15);
                let val = (z1 + 2) / 4;

                if (px >= 0 && px < w && py >= 0 && py < h) {
                    display.setValue(px, py, Math.max(display.getValue?.(px, py) || 0, val));
                }
            }
        }
    }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
