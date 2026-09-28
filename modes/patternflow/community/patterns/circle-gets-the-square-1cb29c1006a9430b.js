// ===== Patternflow pattern =====
// Title:   Circle Gets the Square
// Author:  @AchillesPDX
// Date:    2026-07-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @matrix 128x128

// @knobs PaletteShift=0..1, Speed=0.0..25, GridDensity=-1.25..10.0, EdgeThickness=-1.5..1.5
//
// Knob 1: PaletteShift - Cell ID hue distribution shift
// Knob 2: Speed - Orbiting movement velocity of cell seeds
// Knob 3: GridDensity - Number of cellular Voronoi blocks
// Knob 4: EdgeThickness - Boundary width between graphic texture fills

function hsvToRgb(h, s, v) {
    let r, g, b;
    let i = Math.floor(h * 6);
    let f = h * 6 - i;
    let p = v * (1 - s);
    let q = v * (1 - f * s);
    let t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        case 5: r = v; g = p; b = q; break;
    }
    return [Math.floor(r * 255), Math.floor(g * 255), Math.floor(b * 255)];
}

export function setup(params) {
    params.timeAcc = 0.0;
    params.k1 = 0.0;
    params.k2 = 1.0;
    params.k3 = 2.0;
    params.k4 = 0.5;
}

export function update(dt, input, params) {
    params.k1 = input.knobValues ? input.knobValues[0] : 0.0;
    params.k2 = input.knobValues ? input.knobValues[1] : 1.0;
    params.k3 = input.knobValues ? input.knobValues[2] : 2.0;
    params.k4 = input.knobValues ? input.knobValues[3] : 0.5;

    params.timeAcc += dt * params.k2 * 0.7;
}

export function draw(display, params, time) {
    let k1 = params.k1;
    let k3 = params.k3;
    let k4 = params.k4;

    let t = params.timeAcc;
    let gridSize = 16.0 + k3 * 12.0; // Cell size in pixels
    let edgeGate = 0.1 + k4 * 0.3;

    for (let y = 0; y < display.height; y++) {
        let cellY = Math.floor(y / gridSize);
        let localY = (y % gridSize) / gridSize;

        for (let x = 0; x < display.width; x++) {
            let cellX = Math.floor(x / gridSize);
            let localX = (x % gridSize) / gridSize;

            // Seed center animated per cell
            let seedX = 0.5 + 0.3 * Math.sin(t + cellX * 2.1 + cellY * 1.4);
            let seedY = 0.5 + 0.3 * Math.cos(t * 0.8 + cellX * 1.7 + cellY * 2.5);

            let dx = localX - seedX;
            let dy = localY - seedY;
            let dist = Math.sqrt(dx * dx + dy * dy); // 0.0 to ~1.0

            let cellID = (cellX * 7 + cellY * 13) % 11;
            let r = 0, g = 0, b = 0;

            if (dist < edgeGate) {
                // Bright cell center spot
                let rgb = hsvToRgb((k1 + cellID * 0.09) % 1.0, 0.9, 1.0);
                r = rgb[0]; g = rgb[1]; b = rgb[2];
            } else if (dist < edgeGate + 0.25) {
                // Halftone dot ring
                if (x % 2 === 0 && y % 2 === 0) {
                    let rgb = hsvToRgb((k1 + cellID * 0.09 + 0.2) % 1.0, 0.85, 1.0);
                    r = rgb[0]; g = rgb[1]; b = rgb[2];
                }
            } else if (dist < edgeGate + 0.45) {
                // Gap
                r = 0; g = 0; b = 0;
            } else {
                // Outer diagonal lines
                if ((x + y) % 3 === 0) {
                    let rgb = hsvToRgb((k1 + cellID * 0.09 + 0.5) % 1.0, 0.95, 1.0);
                    r = rgb[0]; g = rgb[1]; b = rgb[2];
                }
            }

            display.setPixel(x, y, r, g, b);
        }
    }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
