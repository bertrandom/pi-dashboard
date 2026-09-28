// ===== Patternflow pattern =====
// Title:   TileWaves
// Author:  @engmung
// Date:    2026-07-10
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp linear 0.0:#000000 0.2:#270dff 0.4:#0782ff 0.6:#ff0000 1.0:#ff0000
// @knobs Quantize=1..12, Speed=0.1..10, PhaseShift=0..5, Sharpness=1..10
//
// Knob 1: Quantize - The stepping threshold of the time updates
// Knob 2: Speed - Master flow rate of the pattern clock
// Knob 3: PhaseShift - Geometric lag spreading outwards from the center
// Knob 4: Sharpness - Value profile modulation between smooth ramp and hard step

export function setup(params) {
    params.timeAcc = 0;
}

export function update(dt, input, params) {
    let v = input.knobValues;
    params.quantize = v[0];
    params.speed = v[1];
    params.phaseShift = v[2];
    params.sharpness = v[3];
    params.timeAcc += dt * params.speed;
}

export function draw(display, params, time) {
    let w = display.width;
    let h = display.height;
    
    let tileSize = 8;
    let cx = w / 2;
    let cy = h / 2;

    for (let y = 0; y < h; y++) {
        let gridY = Math.floor(y / tileSize);
        for (let x = 0; x < w; x++) {
            let gridX = Math.floor(x / tileSize);
            
            // Core coordinate metrics based on tile centers
            let tx = gridX * tileSize + tileSize / 2;
            let ty = gridY * tileSize + tileSize / 2;
            let dx = tx - cx;
            let dy = ty - cy;
            let dist = Math.sqrt(dx * dx + dy * dy);

            // Phase delayed, time-quantized motion pipeline
            let localTime = params.timeAcc - dist * params.phaseShift * 0.08;
            if (params.quantize > 1.0) {
                let step = 1.0 / params.quantize;
                localTime = Math.floor(localTime / step) * step;
            }

            // Generate concentric tile waves derived from custom time
            let wave = Math.sin(dist * 0.25 - localTime * 3.0);
            let val = (wave + 1) * 0.5;

            // Apply high-contrast sharpening curves via power scaling
            val = Math.pow(val, params.sharpness);
            
            // Add tile frame borders to retain the structural matrix grid
            if (x % tileSize === 0 || y % tileSize === 0) {
                val = 0.0;
            }

            display.setValue(x, y, Math.max(0.0, Math.min(1.0, val)));
        }
    }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
