// ===== Patternflow pattern =====
// Title:    Fractal Depth Fields
// Author:   @martinnlopez
// Date:     2026-09-01
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp oklchLong 0:#000000 1:#fbdc04 0.55:#4be879 0.159:#81177f
// @knobs Order=1..5.9, Speed=0.1..4, Depth=0.1..1, Softness=0.01..0.5
// @matrix 128x128

// Structural Remix — Recursive subdivision visualization using Hilbert quadrant logic.

export function setup(params) {
    params.t = 0;
}

export function update(dt, input, params) {
    const speed = input.knobValues[1];
    params.t += dt * speed;
    params.order = Math.floor(input.knobValues[0]);
    params.depthScale = input.knobValues[2];
    params.softness = input.knobValues[3];
}

export function draw(display, params, time) {
    const w = display.width;
    const h = display.height;
    const order = params.order;
    const N = 1 << order;
    
    // Scale to fit the tall aspect ratio
    const cellSize = w / N;
    const t = params.t;

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            // Find local coordinates in the N x N Hilbert space
            let lx = Math.floor(x / cellSize);
            let ly = Math.floor(y / (h / N));
            
            // Re-use Hilbert rotation logic to find "Quadrant Depth"
            let depthValue = 0;
            let s = N / 2;
            let curX = lx;
            let curY = ly;
            
            while (s > 0) {
                let rx = (curX & s) > 0 ? 1 : 0;
                let ry = (curY & s) > 0 ? 1 : 0;
                
                // Add brightness based on which quadrant we are in at this level
                let quadIdx = (3 * rx) ^ ry;
                depthValue += Math.sin(t + quadIdx * params.depthScale + s);
                
                // Rotation logic
                if (ry === 0) {
                    if (rx === 1) {
                        curX = s - 1 - curX;
                        curY = s - 1 - curY;
                    }
                    let temp = curX;
                    curX = curY;
                    curY = temp;
                }
                s = Math.floor(s / 2);
            }

            // Create a soft-edged cell effect
            let cellX = (x % cellSize) / cellSize;
            let cellY = (y % (h / N)) / (h / N);
            let edge = Math.min(cellX, 1 - cellX, cellY, 1 - cellY);
            let mask = Math.min(1.0, edge / params.softness);

            let val = (Math.sin(depthValue) * 0.5 + 0.5) * mask;
            display.setValue(x, y, val);
        }
    }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
