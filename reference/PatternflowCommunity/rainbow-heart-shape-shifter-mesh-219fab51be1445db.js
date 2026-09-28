// ===== Patternflow pattern =====
// Title:    Rainbow Heart Shape Shifter Mesh
// Author:   @martinnlopez
// Date:     2026-09-02
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @knobs Glow=0..1, WaveCycles=0.5..10, ShapeShifter=0..4.9, HeartScale=0.5..3
// @matrix 64x128

// Pattern: Rainbow Heart Shape Shifter Mesh
// Features fixed 5.705px mesh size, constant speed, 5 shape-shifter modes (Triangle, 5-Star, Diamond, Circle, 8/3 Octagram), and a Glow Boost knob.

function getComponent(h, s, v, offset) {
    let k = ((offset + h * 6.0) % 6.0 + 6.0) % 6.0;
    let c = Math.max(0.0, Math.min(k, 4.0 - k, 1.0));
    return Math.floor(255.0 * v * (1.0 - s * c));
}

export function setup(params) {
    // Knob 1: Glow Increase Effect (0.0 to 1.0)
    // Knob 2: Concentric Rainbow Heart Wave Frequency (0.5 to 10.0)
    // Knob 3: Shape Shifter (0: Triangle, 1: 5-Star, 2: Diamond, 3: Circle, 4: 8/3 Octagram Star)
    // Knob 4: Central Heart Scale Factor (0.5 to 3.0)
    params.k1 = 0.5;
    params.k2 = 3.0;
    params.k3 = 0.0; // Default: Original Triangle
    params.k4 = 1.2;
    params.timeAcc = 0.0;
}

export function update(dt, input, params) {
    if (input) {
        if (input.knobNormalized) {
            let norm = input.knobNormalized;
            params.k1 = norm[0];
            params.k2 = 0.5 + norm[1] * 9.5;
            params.k3 = norm[2] * 4.9;
            params.k4 = 0.5 + norm[3] * 2.5;
        } else if (input.knobValues) {
            let v = input.knobValues;
            params.k1 = v[0] > 1.0 ? v[0] / 1.0 : v[0];
            params.k2 = v[1];
            params.k3 = v[2] > 4.9 ? (v[2] / 120.0) * 4.9 : v[2];
            params.k4 = v[3];
        }
    }

    // Speed fixed at constant 1.0 speed
    params.timeAcc += dt * 1.0;
}

export function draw(display, params, time) {
    let w = display.width;
    let h = display.height;
    let t = params.timeAcc;

    let glowBoost = params.k1; // Knob 1: Glow Boost
    let waveCycles = params.k2 * 0.15;
    let shapeMode = Math.floor(Math.max(0.0, Math.min(4.0, params.k3))); // Knob 3: Shape Shifter
    let heartScale = Math.max(0.2, params.k4) * (Math.min(w, h) * 0.08);

    // Fixed mesh grid size = 5.705 pixels
    let gridSize = 5.705;

    let cx = w * 0.5;
    let cy = h * 0.5;

    for (let y = 0; y < h; y++) {
        let row = Math.floor(y / gridSize);
        let cellCy = (row + 0.5) * gridSize;

        for (let x = 0; x < w; x++) {
            let col = Math.floor(x / gridSize);
            let cellCx = (col + 0.5) * gridSize;

            // 1. Calculate Heart Distance Metric for cell & pixel
            let cdx = (cellCx - cx) / heartScale;
            let cdy = -(cellCy - cy) / heartScale;
            let sqrtCdx = Math.sqrt(Math.abs(cdx));
            let cellHeartDist = Math.sqrt(cdx * cdx + Math.pow(cdy - sqrtCdx, 2));

            let dx = (x - cx) / heartScale;
            let dy = -(y - cy) / heartScale;
            let sqrtDx = Math.sqrt(Math.abs(dx));
            let pixelHeartDist = Math.sqrt(dx * dx + Math.pow(dy - sqrtDx, 2));

            // 2. Wave Phase & Rainbow Hue
            let wavePhase = pixelHeartDist * waveCycles * 10.0 - t * 5.0;
            let waveVal = Math.sin(wavePhase) * 0.5 + 0.5;

            let hue = (pixelHeartDist * waveCycles * 0.15 - t * 0.3) % 1.0;
            if (hue < 0) hue += 1.0;

            // 3. Rotating Shape Shifter Mesh Grid
            let lx = x - cellCx;
            let ly = y - cellCy;

            let rotAngle = (col * 0.35 + row * 0.35) + t * 2.0 + Math.sin(cellHeartDist * 0.3);
            let cosA = Math.cos(-rotAngle);
            let sinA = Math.sin(-rotAngle);

            let rx = lx * cosA - ly * sinA;
            let ry = lx * sinA + ly * cosA;

            let shapePulse = Math.sin(cellHeartDist * waveCycles * 10.0 - t * 5.0) * 0.5 + 0.5;
            let maxShapeSize = gridSize * 0.48;
            let shapeSize = (0.25 + shapePulse * 0.75) * maxShapeSize;

            // Shape Shifter SDF / Membership Test
            let inShape = false;
            let distR = Math.sqrt(rx * rx + ry * ry);
            let angle = Math.atan2(ry, rx);

            if (shapeMode === 0) {
                // Mode 0: Original Equilateral Triangle
                inShape = (ry < shapeSize * 0.5) &&
                          (ry > -shapeSize) &&
                          (Math.abs(rx) < (shapeSize - ry) * 0.57735);
            } else if (shapeMode === 1) {
                // Mode 1: 5-Point Star
                let starMod = Math.abs(Math.sin(angle * 2.5)) * 0.5 + 0.5;
                inShape = (distR < shapeSize * starMod * 0.95);
            } else if (shapeMode === 2) {
                // Mode 2: Diamond (Rhombus)
                inShape = (Math.abs(rx) + Math.abs(ry) < shapeSize * 0.85);
            } else if (shapeMode === 3) {
                // Mode 3: Circle
                inShape = (distR < shapeSize * 0.75);
            } else {
                // Mode 4: 8/3 Eight-Pointed Star (Octagram)
                let octagramMod = Math.abs(Math.sin(angle * 4.0)) * 0.65 + 0.35;
                inShape = (distR < shapeSize * octagramMod * 0.9);
            }

            let r = 0, g = 0, b = 0;

            if (inShape) {
                // Shape foreground element with Glow Boost (Knob 1)
                let shapeSat = 0.85 - glowBoost * 0.3;
                let shapeVal = 0.75 + waveVal * 0.25 + glowBoost * 0.25;

                r = getComponent(hue, shapeSat, Math.min(1.0, shapeVal), 5);
                g = getComponent(hue, shapeSat, Math.min(1.0, shapeVal), 3);
                b = getComponent(hue, shapeSat, Math.min(1.0, shapeVal), 1);

                // Glow boost bloom core
                if (glowBoost > 0.05) {
                    let gb = Math.min(1.0, glowBoost * 0.8);
                    r = Math.floor(r * (1.0 - gb) + 255 * gb);
                    g = Math.floor(g * (1.0 - gb) + 255 * gb);
                    b = Math.floor(b * (1.0 - gb) + 255 * gb);
                }
            } else {
                // Background Concentric Pulsating Heart Rainbow Wave
                let bgSat = 0.95;
                let bgVal = (0.22 + waveVal * 0.58) * (0.8 + glowBoost * 0.4);

                r = getComponent(hue, bgSat, Math.min(1.0, bgVal), 5);
                g = getComponent(hue, bgSat, Math.min(1.0, bgVal), 3);
                b = getComponent(hue, bgSat, Math.min(1.0, bgVal), 1);
            }

            display.setPixel(x, y, r, g, b);
        }
    }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
