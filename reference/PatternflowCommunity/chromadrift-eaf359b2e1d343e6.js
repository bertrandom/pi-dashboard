// ===== Patternflow pattern =====
// Title:    Chromadrift
// Author:   @Enerjoy
// Date:     2026-08-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @knobs Hue=0..12, Speed=0.1..10, Warp=0..2, Zoom=0.1..2
// @matrix 128x64
// Pattern: ChromaDrift
// Inspired by: PhoenixEmber by @Engmung (chaos-game / fractal-flame log-density accumulation)
// but built around a completely different mechanism:
//   - 4 non-linear "movement types" (Linear / Swirl / Horseshoe / Handkerchief)
//     are cross-faded against each other by the Warp knob, so turning it
//     smoothly walks the whole pattern from calm mirror symmetry, through
//     vortex spirals, into folded horseshoe loops and rippling handkerchief
//     waves - and back again.
//   - a second buffer remembers *which* movement type painted each pixel,
//     so old trails keep the colour of whatever motion made them while new
//     growth reacts to the current Warp position - the pattern's colour
//     literally reflects its recent movement history.
//   - a slow auto-follow "camera" (running centroid) pans to keep the
//     attractor centred as it drifts, adding a second layer of motion on
//     top of the shape morphing itself.

// Knob 1: Hue        - base colour (local colour is offset from this by the movement-history buffer)
// Knob 2: Speed      - affine morph rate + trail decay (fast = snappier/shorter trails)
// Knob 3: Warp       - crossfades Linear -> Swirl -> Horseshoe -> Handkerchief -> (loops back to Linear)
// Knob 4: Zoom       - camera scale into the auto-following attractor centroid

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

function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

// Cyclic "hat" weight: 1 at center, 0 at distance 0.25, wraps around the 0..1 domain.
function tent(w, center) {
    let d = Math.abs(w - center);
    d = Math.min(d, 1 - d);
    return Math.max(0, 1 - d / 0.25);
}

function varLinear(x, y) { return [x, y]; }

function varSwirl(x, y) {
    const r2 = x * x + y * y;
    const s = Math.sin(r2 * 2.0);
    const c = Math.cos(r2 * 2.0);
    return [x * s - y * c, x * c + y * s];
}

function varHorseshoe(x, y) {
    const r = Math.sqrt(x * x + y * y) + 1e-6;
    return [(x - y) * (x + y) / r, (2.0 * x * y) / r];
}

function varHandkerchief(x, y) {
    const r = Math.sqrt(x * x + y * y);
    const theta = Math.atan2(y, x);
    return [r * Math.sin(theta + r), r * Math.cos(theta - r)];
}

function stepAttractor(dt, params) {
    const w = params.w;
    const h = params.h;
    const density = params.densityBuf;
    const colorBuf = params.colorBuf;

    const speedMul = 0.2 + params.speed * 3.0;
    const persistence = 0.99 - params.speed * 0.15;

    params.timeAcc += dt * speedMul;
    const t = params.timeAcc;

    // Decay density (trails fade); colorBuf is NOT decayed - it holds the
    // "which movement type was this pixel last painted by" memory.
    for (let i = 0; i < density.length; i++) {
        density[i] *= persistence;
    }

    // Two slowly morphing affine coefficient sets - the underlying
    // kaleidoscopic symmetry that the 4 movement-type variations then warp.
    const morph = t * 0.35;
    const a1 = 0.5 * Math.cos(morph * 0.3);
    const b1 = -0.5 * Math.sin(morph * 0.42);
    const c1 = 0.5 * Math.sin(morph * 0.31);
    const d1 = 0.5 * Math.cos(morph * 0.37);

    const a2 = 0.42 * Math.sin(morph * 0.5);
    const b2 = 0.42 * Math.cos(morph * 0.23);
    const c2 = -0.42 * Math.cos(morph * 0.47);
    const d2 = 0.42 * Math.sin(morph * 0.21);

    // The encoder keeps sending values past 1.0 the longer it's turned.
    // Past 1.0 the tent weights below deliberately overshoot (same trick
    // as the original's SwirlWeight going up to 4.2) which is what gives
    // the exaggerated, punchier look between roughly 1.0 and 1.6 - that
    // part stays as-is. Just hold still past 1.6 instead of continuing on.
    const warpPos = clamp(params.warp, 0.0, 1.6);
    const wLin = tent(warpPos, 0.0);
    const wSwirl = tent(warpPos, 0.25);
    const wHorse = tent(warpPos, 0.5);
    const wHanky = tent(warpPos, 0.75);

    let x = params.px;
    let y = params.py;

    const ITER = 2200;
    for (let i = 0; i < ITER; i++) {
        const r = params.rand();
        let nx, ny;
        if (r < 0.5) {
            nx = a1 * x + b1 * y;
            ny = c1 * x + d1 * y + 0.3;
        } else {
            nx = a2 * x + b2 * y - 0.2;
            ny = c2 * x + d2 * y - 0.4;
        }

        const vLin = varLinear(nx, ny);
        const vSwirl = varSwirl(nx, ny);
        const vHorse = varHorseshoe(nx, ny);
        const vHanky = varHandkerchief(nx, ny);

        x = vLin[0] * wLin + vSwirl[0] * wSwirl + vHorse[0] * wHorse + vHanky[0] * wHanky;
        y = vLin[1] * wLin + vSwirl[1] * wSwirl + vHorse[1] * wHorse + vHanky[1] * wHanky;

        if (!isFinite(x) || !isFinite(y) || Math.abs(x) > 12.0 || Math.abs(y) > 12.0) {
            x = params.rand() * 0.2 - 0.1;
            y = params.rand() * 0.2 - 0.1;
        }

        // Slow auto-follow camera: chase the attractor's running centroid.
        params.cx += (x - params.cx) * 0.0003;
        params.cy += (y - params.cy) * 0.0003;

        // The underlying IFS naturally spreads more along y than x; swapping
        // which axis drives width vs height fits a wide 128x64 panel far
        // better than mapping them straight through.
        const scale = 18.0 + params.zoom * 70.0;
        const px = Math.floor(w / 2 + (y - params.cy) * scale);
        const py = Math.floor(h / 2 + (x - params.cx) * scale);

        if (px >= 0 && px < w && py >= 0 && py < h) {
            const idx = py * w + px;
            density[idx] += 1.0;
            colorBuf[idx] += (warpPos - colorBuf[idx]) * 0.25;
        }
    }

    params.px = x;
    params.py = y;
}

export function setup(params) {
    params.w = 128;
    params.h = 64;
    const size = params.w * params.h;

    params.densityBuf = new Float32Array(size);
    params.colorBuf = new Float32Array(size);

    params.px = 0.1;
    params.py = 0.1;
    params.cx = 0.0;
    params.cy = 0.0;
    params.timeAcc = 0.0;

    // Default values used until each knob has actually been touched once.
    params.hue = 0.0;
    params.speed = 0.4;
    params.warp = 0.15;
    params.zoom = 0.45;

    let seed = 918273;
    params.rand = () => {
        seed = (seed * 1664525 + 1013904223) % 4294967296;
        return seed / 4294967296;
    };

    for (let i = 0; i < 60; i++) {
        stepAttractor(0.016, params);
    }
}

export function update(dt, input, params) {
    if (input && input.knobValues) {
        const v = input.knobValues;
        if (!params.lastKnob) params.lastKnob = [v[0], v[1], v[2], v[3]];
        if (Math.abs(v[0] - params.lastKnob[0]) > 1e-6) params.hue = v[0];
        if (Math.abs(v[1] - params.lastKnob[1]) > 1e-6) params.speed = v[1];
        if (Math.abs(v[2] - params.lastKnob[2]) > 1e-6) params.warp = v[2];
        if (Math.abs(v[3] - params.lastKnob[3]) > 1e-6) params.zoom = v[3];
        params.lastKnob = [v[0], v[1], v[2], v[3]];
    }

    if (input && input.btnPressed) {
        if (input.btnPressed[0]) params.hue = 0.0;
        if (input.btnPressed[1]) params.speed = 0.0;
        if (input.btnPressed[2]) params.warp = 0.0;
        if (input.btnPressed[3]) params.zoom = 0.0;
    }

    const safeDt = Math.min(dt, 0.1);
    stepAttractor(safeDt, params);
}

export function draw(display, params, time) {
    const w = display.width;
    const h = display.height;
    const density = params.densityBuf;
    const colorBuf = params.colorBuf;

    let maxLog = 0.001;
    for (let i = 0; i < density.length; i++) {
        const lv = Math.log1p(density[i]);
        if (lv > maxLog) maxLog = lv;
    }
    const norm = 1.0 / Math.max(maxLog, 0.1);

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const idx = y * w + x;
            let val = Math.log1p(density[idx]) * norm;
            val = clamp(val, 0, 1);
            val = val * val * (3 - 2 * val);

            let hue = params.hue + colorBuf[idx] * 0.6;
            hue = hue - Math.floor(hue);

            const sat = clamp(1.0 - val * 0.55, 0.35, 1.0);
            const bri = val;

            const rgb = hsvToRgb(hue, sat, bri);
            display.setPixel(x, y, rgb[0], rgb[1], rgb[2]);
        }
    }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
