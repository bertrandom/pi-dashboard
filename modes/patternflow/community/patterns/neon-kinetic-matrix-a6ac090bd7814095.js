// ===== Patternflow pattern =====
// Title:    Neon Kinetic Matrix
// Author:   @martinnlopez
// Date:     2026-09-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @knobs Speed=0.1..8, Bars=1..4, Bloom=0..10, HueShift=0..360
// @matrix 128x128
// Neon Kinetic Matrix — diagonal LED equalizer arrays with traveling chromatic surges.
// Knob 1: Palette Offset & Dual-Hue Split (0.0 to 1.0, wraps)
// Knob 2: Surge Speed & Pulse Velocity (0.1 to 10.0, clamps)
// Knob 3: Track Density & LED Grid Pitch (0.0 to 4.9, clamps)
// Knob 4: Harmonic Dispersion & Packet Frequency (0.0 to 1.0, wraps)

let rOut = 0;
let gOut = 0;
let bOut = 0;

function computeHsv(h, s, v) {
    let fH = ((h % 1.0) + 1.0) % 1.0;
    let i = Math.floor(fH * 6.0);
    let f = fH * 6.0 - i;
    let p = v * (1.0 - s);
    let q = v * (1.0 - f * s);
    let t = v * (1.0 - (1.0 - f) * s);
    switch (i % 6) {
        case 0: rOut = v; gOut = t; bOut = p; break;
        case 1: rOut = q; gOut = v; bOut = p; break;
        case 2: rOut = p; gOut = v; bOut = t; break;
        case 3: rOut = p; gOut = q; bOut = v; break;
        case 4: rOut = t; gOut = p; bOut = v; break;
        case 5: rOut = v; gOut = p; bOut = q; break;
    }
}

function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

export function setup(params) {
    params.palette = 0.55;
    params.speed = 2.4;
    params.density = 2.2;
    params.resonance = 0.45;
    params.timeAcc = 0.0;
}

export function update(dt, input, params) {
    if (input && input.knobValues) {
        let v = input.knobValues;
        params.palette = v[0];
        params.speed = v[1];
        params.density = v[2];
        params.resonance = v[3];
    }

    if (input && input.btnPressed) {
        if (input.btnPressed[0]) params.palette = 0.55;
        if (input.btnPressed[1]) params.speed = 2.4;
        if (input.btnPressed[2]) params.density = 2.2;
        if (input.btnPressed[3]) params.resonance = 0.45;
    }

    params.timeAcc += dt * params.speed;
}

export function draw(display, params, time) {
    let w = display.width;
    let h = display.height;
    let t = params.timeAcc;

    // Angle of diagonal LED tracks (~35 degrees)
    let cosA = 0.819;
    let sinA = 0.574;

    // Physical dimensions of the modular LED strips
    let trackPitch = 7.0 + (4.9 - params.density) * 1.8;
    let trackWidth = trackPitch * 0.76;
    let segPitch = 3.2 + (4.9 - params.density) * 0.45;
    let segHeight = segPitch * 0.78;

    let baseFreq = 0.04 + params.resonance * 0.08;
    let palBase = params.palette;

    let r = 0;
    let g = 0;
    let b = 0;

    for (let y = 0; y < h; y++) {
        let uRow = y * sinA;
        let vRow = y * cosA;

        for (let x = 0; x < w; x++) {
            let u = x * cosA + uRow;
            let v = -x * sinA + vRow;

            let trackFloat = u / trackPitch;
            let trackIdx = Math.floor(trackFloat);
            let uIn = u - trackIdx * trackPitch;

            // Inter-track channel (dark separation)
            if (uIn >= trackWidth) {
                // Subtle ambient glow in the gutter
                display.setPixel(x, y, 4, 2, 8);
                continue;
            }

            // Stagger each track along its length for dynamic asynchronous waves
            let vShift = v + trackIdx * 13.7;
            let segFloat = vShift / segPitch;
            let segIdx = Math.floor(segFloat);
            let vIn = vShift - segIdx * segPitch;

            let isSeam = (vIn >= segHeight);

            // Sample wave energy at the discrete cell level for hardware LED look
            let sampleV = segIdx * segPitch;
            let phase1 = sampleV * baseFreq - t * 3.4 + trackIdx * 0.85;
            let phase2 = sampleV * (baseFreq * 0.52) + t * 1.6 - trackIdx * 1.35;
            let crossPhase = trackIdx * 0.65 - t * 1.1;

            let w1 = Math.sin(phase1);
            let w2 = Math.sin(phase2);
            let w3 = Math.cos(crossPhase);

            let rawSignal = w1 * 0.55 + w2 * 0.35 + w3 * 0.25;
            let pulse = Math.max(0.0, (rawSignal + 0.32) / 1.32);
            let energy = pulse * pulse * 1.35;

            // Palette responds to track index split and localized wave phase
            let trackHueShift = (trackIdx % 2 === 0) ? 0.0 : 0.36;
            let cellHue = palBase + trackHueShift + (sampleV * 0.003) + (rawSignal * 0.08);

            computeHsv(cellHue, 0.95, 1.0);

            if (energy < 0.2) {
                // Dim idle background matrix
                let dim = energy / 0.2;
                r = Math.floor(rOut * 50 * dim + 6);
                g = Math.floor(gOut * 50 * dim + 4);
                b = Math.floor(bOut * 80 * dim + 14);
            } else if (energy < 0.72) {
                // Saturated neon body
                let tNorm = (energy - 0.2) / 0.52;
                let boost = 0.35 + 0.65 * tNorm;
                r = clamp(Math.floor(rOut * 255 * boost), 0, 255);
                g = clamp(Math.floor(gOut * 255 * boost), 0, 255);
                b = clamp(Math.floor(bOut * 255 * boost), 0, 255);
            } else {
                // White-hot fiery core and bloom threshold
                let tHot = Math.min(1.0, (energy - 0.72) / 0.45);
                let hotR = 255;
                let hotG = Math.floor(130 + 125 * tHot);
                let hotB = Math.floor(40 + 215 * tHot);

                r = clamp(Math.floor(rOut * 255 * (1.0 - tHot) + hotR * tHot), 0, 255);
                g = clamp(Math.floor(gOut * 255 * (1.0 - tHot) + hotG * tHot), 0, 255);
                b = clamp(Math.floor(bOut * 255 * (1.0 - tHot) + hotB * tHot), 0, 255);
            }

            // Sub-segment bezel / micro-seam modeling
            if (isSeam) {
                r = Math.floor(r * 0.16);
                g = Math.floor(g * 0.16);
                b = Math.floor(b * 0.16);
            } else if (uIn < 0.65 || uIn > trackWidth - 0.65 || vIn < 0.45) {
                // Outer pixel bezel on each LED segment
                r = Math.floor(r * 0.72);
                g = Math.floor(g * 0.72);
                b = Math.floor(b * 0.72);
            }

            display.setPixel(x, y, r, g, b);
        }
    }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
