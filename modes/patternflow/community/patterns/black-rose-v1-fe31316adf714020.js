// ===== Patternflow pattern =====
// Title:    Black Rose v1
// Author:   @mondkim
// Date:     2026-08-12
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp step recolor 0:#000000 1:#ffffff 0:#0e0e0e 0:#ffffff 1:#ffffff 0.957:#363636 0.623:#ffffff
// @knobs Glitch=-24.001..-24, Speed=0.05..5, Freq=10..120, Quantize=2..10
// @matrix 128x128
// Pattern: Black Rose — True Silhouette
// The rose silhouette is not procedural — it's a 100x64 bitmap traced
// directly from the reference artwork (petal masses, spiral bud vein-lines,
// and the lower-right drip nubs are all baked into the mask), bilinear-
// sampled and scaled to fit the matrix. Same slow melt-collapse + bouncy
// rebloom-flash cycle as before, plus slow independent paint drips that
// extend from the mask's own drip points.
// Knob 1: Hue / glow color (0..1)
// Knob 2: Overall speed (cycle + drip fall speed)
// Knob 3: Edge glow thickness (0..4.9)
// Knob 4: Drip weight / melt distance / erosion chaos (0..1)

const MASK_W = 100;
const MASK_H = 64;
const MASK_HEX = [
"00000000001f803f000000000","0000000000fff0ffc00000000","000000007ffff8fff00000000",
"00000003fffffe07f80000000","00000007fffffe70ff0000000","0000000fffffff7c7ffe00000",
"0000000fffffff7e1fffc0000","0000000fffffff7e1ffff0000","0000001fffffbf3f0ffff0000",
"0000001ffff80e3f8ffff8000","0000003ffff0e07f8ffff8000","000000fffdc3e0ff8ffffc000",
"000001fffd87e1ffcffffc000","000003fffd0fc3ffcffffc000","000003fffc1f0fffcffffc600",
"0003f7fffc1c3fffcffffcf80","001fe7fffc1fffffcffffcfc0","003fe7fffc1fffff8efffcfe0",
"007fe7fffe1fffff80fff8ff0","00ffe7fffe1fffff01fff1ff8","01ffe7ffff0ffffe03ffe1ffc",
"01ffc7ffffcffff80fff03ffc","03ffc7ffffefffe03ffc07ffc","03ffc3ffffffff81fff03fffc",
"01ffe3fffffffe0fffe0ffffc","01fff3fffffff07fffc1ffffc","00fff9fffeff81ffff807fff8",
"00fff9fffc0003ffff8f7ffe0","01fffcfffe000fffff8ffff80","07fffeffff801fffff9fffe70",
"1ffffe7ffff83fffff1fffcfc","3ffffe7ffffc3ffffe3fff1fe","7ffffe3ffffe7ffffcfffe3fe",
"7ffffe1ffffffffffffffc7ff","fffffc0ffffffffffffffcfff","fffff80387fffffffffff9fff",
"ffffff0000fffffffffff3fff","ffffffc0003fffffffffe3fff","fffffffff81fffffffffe7ffe",
"7ffffffffe0fffffffffc7ffe","7fffffffff87ffffffffcfffc","3fffffffffc7ffffffff8fff8",
"1fffffffffffffffc7ff1fff0","07ffffffffffffffc0fe1ffe0","01ffffffffffffffe0003ffc0",
"0007fffffffffffffe00fff80","0033fffffffffffffffffff00","0079ffffffffffffffffffe00",
"00f8ffffffffffffffffffe00","01fc3fffffffffffffffffe00","01fe007fffffffffffffffe00",
"01ff80ffffffffffffffffe00","01ffffffffffffffffffff300","03ffffffffffffffffffff300",
"03ffffffffffffffffffff800","01ffffffffffff1f7ff003800","01fffffffffff80c038003800",
"01ffffffffffe00c000003800","00ffffffffff800c000003800","00fffffffffe000c000007800",
"007ffffffffc000c000007800","003fff81fff80000000003000","000ffc007ff00000000000000",
"0001c0000fc00000000000000"
];

const MASK = (function () {
    let arr = new Array(MASK_W * MASK_H);
    for (let y = 0; y < MASK_H; y++) {
        let row = MASK_HEX[y];
        for (let i = 0; i < row.length; i++) {
            let nibble = parseInt(row[i], 16);
            for (let b = 0; b < 4; b++) {
                let bitIndex = i * 4 + b;
                if (bitIndex >= MASK_W) break;
                arr[y * MASK_W + bitIndex] = (nibble >> (3 - b)) & 1;
            }
        }
    }
    return arr;
})();

function maskAt(mx, my) {
    let x0 = Math.floor(mx), y0 = Math.floor(my);
    let x1 = x0 + 1, y1 = y0 + 1;
    if (x0 < 0 || y0 < 0 || x1 >= MASK_W || y1 >= MASK_H) return 0.0;
    let fx = mx - x0, fy = my - y0;
    let v00 = MASK[y0 * MASK_W + x0];
    let v10 = MASK[y0 * MASK_W + x1];
    let v01 = MASK[y1 * MASK_W + x0];
    let v11 = MASK[y1 * MASK_W + x1];
    let top = v00 + (v10 - v00) * fx;
    let bot = v01 + (v11 - v01) * fx;
    return top + (bot - top) * fy;
}

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

function hash1(n) {
    let s = Math.sin(n * 12.9898 + 4.1414) * 43758.5453;
    return s - Math.floor(s);
}

function easeIn3(p) { return p * p * p; }
function easeOutBack(p) {
    let c1 = 1.70158, c3 = c1 + 1.0;
    let x = p - 1.0;
    return 1.0 + c3 * x * x * x + c1 * x * x;
}

export function setup(params) {
    params.hue = 0.98;
    params.speed = 1.0;
    params.softness = 0.6;
    params.dripAmt = 0.6;
    params.timeAcc = 0.0;
}

export function update(dt, input, params) {
    if (input && input.knobValues) {
        let v = input.knobValues;
        params.hue = v[0];
        params.speed = v[1];
        params.softness = v[2];
        params.dripAmt = v[3];
    }
    params.timeAcc += dt * params.speed;
}

export function draw(display, params, time) {
    let w = display.width;
    let h = display.height;
    let t = params.timeAcc;

    let scale = (h * 0.80) / MASK_H;
    let originX = w * 0.50 - (MASK_W * scale) / 2.0;
    let originY = h * 0.44 - (MASK_H * scale) / 2.0;

    let hueBase = params.hue;
    let dripAmt = clamp(params.dripAmt, 0.0, 1.0);
    let edgeSoft = 1.4 + (clamp(params.softness, 0.0, 4.9) / 4.9) * 2.4;

    // --- slow collapse / rebloom cycle ---
    let cycleLen = 30.0;
    let cyclePos = ((t % cycleLen) + cycleLen) % cycleLen / cycleLen;
    let flow = 0.0;
    if (cyclePos < 0.22) {
        flow = 0.0;
    } else if (cyclePos < 0.45) {
        flow = easeIn3((cyclePos - 0.22) / 0.23);
    } else if (cyclePos < 0.58) {
        flow = 1.0;
    } else if (cyclePos < 0.85) {
        flow = 1.0 - easeOutBack((cyclePos - 0.58) / 0.27);
    } else {
        flow = 0.0;
    }

    let flashIntensity = 0.0;
    if (cyclePos > 0.83 && cyclePos < 0.95) {
        let t2 = (cyclePos - 0.83) / 0.12;
        flashIntensity = Math.sin(t2 * Math.PI);
    }

    let maxMeltPx = h * (1.1 + dripAmt * 1.7);

    // --- slow independent paint drips, attached to the mask's own bottom edge ---
    let dripXFrac = [0.10, 0.28, 0.46, 0.63, 0.80, 0.94];
    let nDrips = dripXFrac.length;
    let dropX = new Array(nDrips);
    let dropY0 = new Array(nDrips);
    let dripLen = new Array(nDrips);
    let dripWidth = scale * (0.7 + dripAmt * 0.6);
    let maxDripLen = h * (0.20 + dripAmt * 0.55);

    for (let i = 0; i < nDrips; i++) {
        let mxSample = dripXFrac[i] * (MASK_W - 1);
        let bottomRow = 0;
        for (let my = MASK_H - 1; my >= 0; my--) {
            if (maskAt(mxSample, my) > 0.5) { bottomRow = my; break; }
        }
        dropX[i] = originX + mxSample * scale;
        dropY0[i] = originY + bottomRow * scale;

        let speedI = 0.10 + 0.14 * hash1(i * 3.1 + 1.0) + dripAmt * 0.10;
        let phaseI = hash1(i * 7.7 + 2.0);
        let cyc = ((t * speedI + phaseI) % 1.0 + 1.0) % 1.0;
        let grow = 0.75;
        let len;
        if (cyc < grow) { len = cyc / grow; } else { len = 1.0 - (cyc - grow) / (1.0 - grow); }
        dripLen[i] = maxDripLen * clamp(len, 0.0, 1.0) * (1.0 - flow * 0.7);
    }

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let colHash = hash1(x + 91.7);
            let meltOffsetPx = flow * maxMeltPx * (0.25 + 0.85 * colHash);
            let swayPx = flow * 3.0 * Math.sin(y * 0.28 + t * 1.3 + colHash * 6.28);

            let mx = (x - swayPx - originX) / scale;
            let my = (y - meltOffsetPx - originY) / scale;

            let mval = maskAt(mx, my);
            let erosionNoise = hash1(x * 0.7 + y * 1.3 + Math.floor(t * 1.2) * 5.1);
            let eroded = (flow > 0.02 && flow < 0.98 && erosionNoise < flow * 0.55);

            let rr = 0, gg = 0, bb = 0;

            if (mval > 0.5 && !eroded) {
                let rimGlow = clamp(1.0 - Math.abs(mval - 0.5) * 2.0 * edgeSoft, 0.0, 1.0);

                let v = clamp(0.06 + rimGlow * 0.85, 0.0, 1.0);
                let s = clamp(0.85 - rimGlow * 0.55, 0.0, 1.0);
                let hue = hueBase;

                v = clamp(v + flashIntensity * rimGlow * 0.9, 0.0, 1.0);
                s = clamp(s - flashIntensity * rimGlow * 0.5, 0.0, 1.0);

                let c = hsvToRgb(hue, s, v * (1.0 - flow * 0.3));
                rr = c[0]; gg = c[1]; bb = c[2];
            } else {
                for (let i = 0; i < nDrips; i++) {
                    if (dripLen[i] <= 0.5) continue;
                    let dY = y - dropY0[i];
                    if (dY < 0.0 || dY > dripLen[i]) continue;
                    let wobble = Math.sin(dY * 0.30 + t * 1.2 + i * 2.1) * 1.2;
                    let ddx = x - (dropX[i] + wobble);
                    let tipDist = dripLen[i] - dY;
                    let curW = dripWidth * (0.6 + 0.4 * (dY / Math.max(dripLen[i], 1.0)));
                    let isTip = tipDist < dripWidth * 2.2;
                    if (isTip) curW = dripWidth * 2.0 * clamp(tipDist / (dripWidth * 2.2), 0.4, 1.0);

                    if (Math.abs(ddx) < curW) {
                        let v = isTip ? 0.6 : 0.24;
                        let c = hsvToRgb(hueBase, 0.82, v);
                        rr = c[0]; gg = c[1]; bb = c[2];
                    }
                }
            }

            display.setPixel(x, y, rr, gg, bb);
        }
    }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
