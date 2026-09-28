// ===== Patternflow pattern =====
// Title:   Warped Wave
// Author:  @engmung
// Date:    2026-07-18
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================
// @matrix 128x128

// @knobs Hue=0..1, Speed=-20..20, Warp Amp=0.1..1, Warp Freq=0..30

// Variation 4 — Warped Wave (Domain Remix)
// Full-screen concentric wave with coordinate warping — no tile grid.
// Knob 1: Hue · Knob 2: Speed · Knob 3: Warp amplitude · Knob 4: Warp frequency
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

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export function setup(params) {
    params.hue = 0.0;
    params.speed = 2.0;
    params.warpAmp = 0.2;   // will be set by K3
    params.warpFreq = 0.5;   // K4
    params.timeAcc = 0.0;
}

export function update(dt, input, params) {
    if (input && input.knobValues) {
        let v = input.knobValues;
        params.hue = v[0];
        params.speed = v[1];
        params.warpAmp = v[2];
        params.warpFreq = v[3];
    }
    if (input && input.btnPressed) {
        if (input.btnPressed[0]) params.hue = 0.0;
        if (input.btnPressed[1]) params.speed = 2.0;
        if (input.btnPressed[2]) params.warpAmp = 0.2;
        if (input.btnPressed[3]) params.warpFreq = 0.5;
    }
    params.timeAcc += dt * params.speed;
}

export function draw(display, params, time) {
    let w = display.width;
    let h = display.height;
    let t = params.timeAcc;

    let waveFreq = 15.0;
    let warpAmp = params.warpAmp * 0.25;
    let warpFreqBase = 3.0 + params.warpFreq * 8.0;

    let hc = hsvToRgb(params.hue, 1.0, 1.0);

    for (let y = 0; y < h; y++) {
        let ny = (y / h - 0.5) * 2; // -1..1
        for (let x = 0; x < w; x++) {
            let nx = (x / w - 0.5) * 2;
            // warp coordinates
            let wx = nx + warpAmp * Math.sin(ny * warpFreqBase + t * 0.3);
            let wy = ny + warpAmp * Math.cos(nx * warpFreqBase * 1.3 + t * 0.4);
            let dist = Math.sqrt(wx * wx + wy * wy);
            let wave = Math.sin(dist * waveFreq + t);

            let tt = clamp((wave * 0.8 + 1.0) * 0.5, 0.0, 1.0);
            let r = 0, g = 0, b = 0;
            if (tt >= 0.154) { r = 10; g = 10; b = 10; }
            if (tt >= 0.556) {
                r = clamp(Math.floor(hc[0] * 1.5), 0, 255);
                g = clamp(Math.floor(hc[1] * 1.5), 0, 255);
                b = clamp(Math.floor(hc[2] * 1.5), 0, 255);
            }
            if (tt >= 0.816) { r = 255; g = 255; b = 255; }
            display.setPixel(x, y, r, g, b);
        }
    }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
