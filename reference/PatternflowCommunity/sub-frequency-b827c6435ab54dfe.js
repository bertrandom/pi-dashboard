// ===== Patternflow pattern =====
// Title:    Sub.Frequency
// Author:   @Enerjoy
// Date:     2026-08-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @knobs Hue=0..1, Speed=0.1..10, Warp=0..2, Zoom=0.1..2
// @matrix 128x64
// Pattern: Sub.Frequency
// SPDX-License-Identifier: CC-BY-SA-4.0
//
// Sub.Frequency — hypnotic acid tunnel with a rotating feedback buffer

// Knob 1: Hue · Knob 2: Speed · Knob 3: Warp (forvrengning) · Knob 4: Zoom
// Encoder button (short press): resets that knob to its origin value.

function hsvToRgb(h, s, v) {
    h = ((h % 1) + 1) % 1;
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

// Integer hash noise, no sinf/cosf inside (portable to a C++ hash later).
function hashI(x, y) {
    let h = (Math.imul(x, 1664525) + Math.imul(y, 1013904223)) >>> 0;
    h ^= h >>> 16;
    h = Math.imul(h, 0x45d9f3b) >>> 0;
    h ^= h >>> 16;
    return h;
}
function hash01(x, y) {
    return (hashI(x | 0, y | 0) & 0xFFFF) / 65535.0;
}
function noise2D(x, y) {
    let ix = Math.floor(x), iy = Math.floor(y);
    let fx = x - ix, fy = y - iy;
    let ux = fx * fx * (3 - 2 * fx);
    let uy = fy * fy * (3 - 2 * fy);
    let a = hash01(ix, iy), b = hash01(ix + 1, iy);
    let c = hash01(ix, iy + 1), d = hash01(ix + 1, iy + 1);
    return a * (1 - ux) * (1 - uy) + b * ux * (1 - uy) + c * (1 - ux) * uy + d * ux * uy;
}

// The core tunnel wave field, factored out so it can be sampled at three
// nearby points to build a fake surface normal for the plastic "shine".
function waveHeight(nx, ny, n1, n2, t, warpAmtR, warpAmtA, scale, speed) {
    let radius = Math.sqrt(nx * nx + ny * ny);
    let angle = Math.atan2(ny, nx);

    // Hard-clamped regardless of the coefficients below, a safety net so no
    // knob position can push this into per-pixel aliasing/noise.
    radius += clamp(n1 * warpAmtR * scale, -0.55, 0.55);
    angle += clamp(n2 * warpAmtA, -0.18, 0.18);

    let rings = Math.sin(radius * 10.0 - t * (1.2 + speed * 2.2));
    let arms = Math.sin(angle * 5.0 + t * (0.6 + speed * 1.4) + radius * 2.0);
    return 0.5 + 0.5 * (rings * 0.65 + arms * 0.35);
}

export function setup(params) {
    // Raw knob-normalized fields (0..1), scaled to usable ranges inside draw()
    params.hue = 0.62;
    params.speedRaw = 0.25;
    params.warpRaw = 0.35;
    params.zoomRaw = 0.35;
    params.timeAcc = 0.0;

    params.feedbackAngleAcc = 0.0;
    params.prevBuffer = null;   // lazily sized to display.width/height on first draw
    params.newBuffer = null;
}

export function update(dt, input, params) {
    // Only follow a knob while it's actually moving, so a button reset
    // persists until the knob is touched again (mirrors hardware encoders).
    if (input && input.knobValues) {
        let v = input.knobValues;
        if (!params.lastKnob) params.lastKnob = [v[0], v[1], v[2], v[3]];
        if (Math.abs(v[0] - params.lastKnob[0]) > 1e-6) params.hue = v[0];
        if (Math.abs(v[1] - params.lastKnob[1]) > 1e-6) params.speedRaw = v[1];
        if (Math.abs(v[2] - params.lastKnob[2]) > 1e-6) params.warpRaw = v[2];
        if (Math.abs(v[3] - params.lastKnob[3]) > 1e-6) params.zoomRaw = v[3];
        params.lastKnob = [v[0], v[1], v[2], v[3]];
    }

    if (input && input.btnPressed) {
        if (input.btnPressed[0]) params.hue = 0.0;
        if (input.btnPressed[1]) params.speedRaw = 0.0;
        if (input.btnPressed[2]) params.warpRaw = 0.0;
        if (input.btnPressed[3]) params.zoomRaw = 0.0;
    }

    let speed = 0.05 + params.speedRaw * 0.75; // capped 0.05x .. 0.8x
    params.timeAcc += dt * speed;
}

export function draw(display, params, time) {
    let w = display.width;
    let h = display.height;
    let t = params.timeAcc;

    // Lazy-init feedback buffers to the actual panel size
    if (!params.prevBuffer || params.prevBuffer.length !== w * h * 3) {
        params.prevBuffer = new Float64Array(w * h * 3);
        params.newBuffer = new Float64Array(w * h * 3);
    }
    let prevBuffer = params.prevBuffer;
    let newBuffer = params.newBuffer;

    let speed = 0.05 + params.speedRaw * 0.75; // capped 0.05x .. 0.8x
    let warpNorm = params.warpRaw;                  // 0..1
    let zoomVal = 0.3 + params.zoomRaw * 2.7;        // 0.3..3.0

    // Cubic curve: the first ~80% of the knob's travel stays close to zero,
    // the forvrengning ramps up harder than before in the last part of the
    // turn (raised ceiling from the previous version, still hard-clamped
    // inside waveHeight() so it can't tip into pure noise/aliasing).
    let warpCurve = warpNorm * warpNorm * warpNorm;
    let warpAmtR = 1.0 + warpCurve * 5.0;      // was 1.0..4.0
    let warpAmtA = 0.02 + warpCurve * 0.16;    // was 0.02..0.10 rad

    // More delay: higher feedback mix (longer memory of past frames) and a
    // slower decay (0.988 vs 0.985), so trails hang around noticeably longer
    // and fade out more gradually instead of snapping to black.
    let feedbackMix = 0.55;
    let feedbackDecay = 0.988;
    let scale = 0.06 / zoomVal;

    params.feedbackAngleAcc += 0.006 * (0.4 + speed);
    let fbShrink = 1.006;
    let cosA = Math.cos(params.feedbackAngleAcc), sinA = Math.sin(params.feedbackAngleAcc);

    // Harmonic, analogous palette: hueB sits close to hueA on the colour
    // wheel (not near-opposite like before), so the two tones read as
    // "belonging together" instead of clashing. A third, dim shadow tone
    // (same family, low brightness) fills the gap between black and the
    // main colour for a softer, more gradual fade at the edges of shapes.
    let hueA = params.hue;
    let hueB = (params.hue + 0.085) % 1.0;
    let hueShadow = (params.hue - 0.05 + 1.0) % 1.0;

    let halfW = w / 2, halfH = h / 2;

    for (let y = 0; y < h; y++) {
        let dyPix = y - halfH;
        for (let x = 0; x < w; x++) {
            let dxPix = x - halfW;

            let nx = dxPix * scale;
            let ny = dyPix * scale;

            let n1 = noise2D(nx * 1.6 + t * 0.6, ny * 1.6 - t * 0.4) - 0.5;
            let n2 = noise2D(nx * 1.6 + 5.2 + t * 0.5, ny * 1.6 + 3.1 + t * 0.55) - 0.5;

            let valC = waveHeight(nx, ny, n1, n2, t, warpAmtR, warpAmtA, scale, speed);

            let shaped = clamp(valC, 0.0, 1.0);
            shaped = shaped * shaped * shaped;

            // Four-step ramp instead of three: black -> dim shadow tone ->
            // blended mid tone -> bright core. The shadow band is what
            // gives shapes a soft, fading edge rather than a hard cutoff.
            let r = 0, g = 0, b = 0;
            if (shaped > 0.62) {
                let bri = clamp((shaped - 0.62) / 0.38, 0.0, 1.0);
                [r, g, b] = hsvToRgb(hueA, 0.85, bri);
            } else if (shaped > 0.40) {
                let blend = (shaped - 0.40) / 0.22;
                [r, g, b] = hsvToRgb(hueB, 0.9, blend * 0.65);
            } else if (shaped > 0.20) {
                let blend = (shaped - 0.20) / 0.20;
                [r, g, b] = hsvToRgb(hueShadow, 0.8, blend * 0.22);
            }

            let rx = (dxPix * cosA - dyPix * sinA) / fbShrink;
            let ry = (dxPix * sinA + dyPix * cosA) / fbShrink;
            let sx = clamp(Math.round(halfW + rx), 0, w - 1);
            let sy = clamp(Math.round(halfH + ry), 0, h - 1);
            let pi = (sy * w + sx) * 3;
            let pr = prevBuffer[pi], pg = prevBuffer[pi + 1], pb = prevBuffer[pi + 2];

            let fr = clamp((r * (1 - feedbackMix) + pr * feedbackMix) * feedbackDecay, 0, 255);
            let fg = clamp((g * (1 - feedbackMix) + pg * feedbackMix) * feedbackDecay, 0, 255);
            let fb = clamp((b * (1 - feedbackMix) + pb * feedbackMix) * feedbackDecay, 0, 255);

            let idx3 = (y * w + x) * 3;
            newBuffer[idx3] = fr; newBuffer[idx3 + 1] = fg; newBuffer[idx3 + 2] = fb;

            display.setPixel(x, y, Math.round(fr), Math.round(fg), Math.round(fb));
        }
    }

    params.prevBuffer = newBuffer;
    params.newBuffer = prevBuffer; // swap buffers, avoids reallocating every frame
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
