// ===== Patternflow pattern =====
// Title:   I love Truchets
// Author:  @SimonePDA
// Date:    2026-07-28
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @matrix 128x128


// Pattern: Origin - Variation 3: Anti-Aliased Truchet Labyrinth (Unified Speed Control)
// Author: Patternflow
// Knob 1: Glitch -> Mutation Density
// Knob 2: Speed -> Linked Path Mutation & Palette Rotation Speed
// Knob 3: Freq -> Grid Division / Tile Size
// Knob 4: Quantize -> Palette Angle Orientation Offset

function hsvToRgb(h, s, v) {
    let r, g, b;
    let i = Math.floor(h * 6);
    let f = h * 6 - i;
    let p = v * (1 - s);
    let q = v * (1 - f * s);
    let t = v * (1 - (1 - f) * s);
    switch (((i % 6) + 6) % 6) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        case 5: r = v; g = p; b = q; break;
    }
    return [Math.floor(r * 255), Math.floor(g * 255), Math.floor(b * 255)];
}

function clamp(val, min, max) { 
    return Math.max(min, Math.min(max, val)); 
}

function hash21(x, y) {
    let h = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453123;
    return h - Math.floor(h);
}

export function setup(params) {
    params.glitch = 0.1;
    params.speed = 1.0;
    params.gridNorm = 0.2;
    params.quantize = 0.0;
    params.timeAcc = 0.0;
}

export function update(dt, input, params) {
    if (input) {
        if (input.knobNormalized && input.knobNormalized.length >= 4) {
            params.glitch = input.knobNormalized[0];
            params.speed = input.knobNormalized[1] * 2.5; // Linked master speed controller
            params.gridNorm = input.knobNormalized[2];
            params.quantize = input.knobNormalized[3];
        } else if (input.knobValues && input.knobValues.length >= 4) {
            params.glitch = clamp(input.knobValues[0], 0.0, 1.0);
            params.speed = input.knobValues[1] * 0.5;
            params.gridNorm = clamp((input.knobValues[2] - 10.0) / 110.0, 0.0, 1.0);
            params.quantize = clamp((input.knobValues[3] - 2.0) / 8.0, 0.0, 1.0);
        }
    }

    if (input && input.btnPressed) {
        if (input.btnPressed[0]) params.glitch = 0.1;
        if (input.btnPressed[1]) params.speed = 1.0;
        if (input.btnPressed[2]) params.gridNorm = 0.2;
        if (input.btnPressed[3]) params.quantize = 0.0;
    }

    let delta = (dt !== undefined && dt !== null) ? dt : 0.016;
    params.timeAcc += delta * params.speed;
}

export function draw(display, params, time) {
    let w = display.width;
    let h = display.height;
    let t = params.timeAcc;

    let tileSize = Math.floor(4 + params.gridNorm * 8);
    if (tileSize < 4) tileSize = 4;

    let cols = Math.floor(w / tileSize);
    let rows = Math.floor(h / tileSize);
    if (cols < 1) cols = 1;
    if (rows < 1) rows = 1;

    let totalCells = cols * rows;
    let halfTile = tileSize / 2;

    // Stroke width parameters for sub-pixel anti-aliasing
    let lineRadius = 0.4 + params.gridNorm * 0.4;
    let aaFeather = 0.75;

    // Dynamic rotation angle linked to timeAcc (driven by Speed) + Quantize angular offset
    let paletteAngle = (params.quantize * Math.PI * 2.0) + (t * 0.15);
    let cosA = Math.cos(paletteAngle);
    let sinA = Math.sin(paletteAngle);

    let mutationFraction = (1.0 / totalCells) + params.glitch * 0.30;
    let stepCount = Math.floor(t * 8.0);

    for (let y = 0; y < h; y++) {
        let gy = Math.min(Math.floor(y / tileSize), rows - 1);
        let py = y - gy * tileSize;
        let ny = (y / h) - 0.5;

        for (let x = 0; x < w; x++) {
            let gx = Math.min(Math.floor(x / tileSize), cols - 1);
            let px = x - gx * tileSize;
            let nx = (x / w) - 0.5;

            // Accumulated random cell flips
            let baseSeed = hash21(gx + 1.0, gy * 1.7 + 1.0);
            let flips = baseSeed > 0.5 ? 1 : 0;

            for (let s = 1; s <= 16; s++) {
                let pastStep = stepCount - s;
                if (pastStep < 0) continue;
                let stepCellHash = hash21(gx * 12.989 + pastStep * 3.141, gy * 78.233 + pastStep * 1.618);
                if (stepCellHash < mutationFraction) {
                    flips += 1;
                }
            }

            let tileType = (flips % 2 === 0) ? 0 : 1;

            // Distance to Truchet arc centers
            let d1 = 0, d2 = 0;
            if (tileType === 0) {
                d1 = Math.sqrt(px * px + py * py);
                d2 = Math.sqrt((px - tileSize) * (px - tileSize) + (py - tileSize) * (py - tileSize));
            } else {
                d1 = Math.sqrt((px - tileSize) * (px - tileSize) + py * py);
                d2 = Math.sqrt(px * px + (py - tileSize) * (py - tileSize));
            }

            let distFromArc = Math.min(Math.abs(d1 - halfTile), Math.abs(d2 - halfTile));

            // Anti-Aliasing Alpha Calculation
            let lineAlpha = 1.0 - clamp((distFromArc - lineRadius) / aaFeather, 0.0, 1.0);
            lineAlpha = lineAlpha * lineAlpha * (3.0 - 2.0 * lineAlpha);

            // Palette orientation projection combined with master time flow
            let rotatedProj = nx * cosA + ny * sinA;
            let pixelHue = ((rotatedProj + 0.5) + t * 0.05) % 1.0;
            if (pixelHue < 0) pixelHue += 1.0;

            let baseRgb = hsvToRgb(pixelHue, 1.0, 1.0);

            // Smooth Composite output
            let ambientFactor = 0.05;
            let finalAlpha = ambientFactor + lineAlpha * (1.0 - ambientFactor);

            let r = Math.floor(baseRgb[0] * finalAlpha);
            let g = Math.floor(baseRgb[1] * finalAlpha);
            let b = Math.floor(baseRgb[2] * finalAlpha);

            display.setPixel(x, y, clamp(r, 0, 255), clamp(g, 0, 255), clamp(b, 0, 255));
        }
    }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
