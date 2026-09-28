// ===== Patternflow pattern =====
// Title:    Black Rose V5, Adrift
// Author:   @mondkim
// Based on: "Black Rose V4, Adrift" by @mondkim — https://patternflow.work/community/p/136448fc75284712
// Date:     2026-08-13
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp linear 0:#000000 1:#ffffff
// @knobs Float=-3..5, Calm=0..1, Wavelength=3..40, Reflect=0..1
// @matrix 64x128





// Two black elements on a white background, no dividing line: a floating
// rose, and a rippling lake beneath it. Turning any knob sends a burst of
// energy through the scene: the lake turns choppy/turbulent and the rose
// shoots upward, both settling back down afterward.
// Knob 1: floating speed (how fast it bobs/sways/tilts)
// Knob 2: lake calmness -> roughness (baseline ripple strength)
// Knob 3: ripple wavelength (tight ripples vs. wide slow waves)
// Knob 4: reflection strength (how bright/clear the white reflection is)

var MASK_W = 100;
var MASK_H = 64;
var MASK_HEX = [
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

function buildMask() {
    var arr = new Array(MASK_W * MASK_H);
    for (var y = 0; y < MASK_H; y++) {
        var row = MASK_HEX[y];
        for (var i = 0; i < row.length; i++) {
            var nibble = parseInt(row[i], 16);
            for (var b = 0; b < 4; b++) {
                var bitIndex = i * 4 + b;
                if (bitIndex >= MASK_W) break;
                arr[y * MASK_W + bitIndex] = (nibble >> (3 - b)) & 1;
            }
        }
    }
    return arr;
}

function maskAt(mask, mx, my) {
    var x0 = Math.floor(mx), y0 = Math.floor(my);
    var x1 = x0 + 1, y1 = y0 + 1;
    if (x0 < 0 || y0 < 0 || x1 >= MASK_W || y1 >= MASK_H) return 0.0;
    var fx = mx - x0, fy = my - y0;
    var v00 = mask[y0 * MASK_W + x0];
    var v10 = mask[y0 * MASK_W + x1];
    var v01 = mask[y1 * MASK_W + x0];
    var v11 = mask[y1 * MASK_W + x1];
    var top = v00 + (v10 - v00) * fx;
    var bot = v01 + (v11 - v01) * fx;
    return top + (bot - top) * fy;
}

// 4-sample box filter, spread scaled to the current minification level, so
// small on-screen rose sizes don't alias into speckles.
function maskAtAA(mask, mx, my, spread) {
    var s1 = maskAt(mask, mx - spread, my - spread);
    var s2 = maskAt(mask, mx + spread, my - spread);
    var s3 = maskAt(mask, mx - spread, my + spread);
    var s4 = maskAt(mask, mx + spread, my + spread);
    return (s1 + s2 + s3 + s4) * 0.25;
}

function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

export function setup(params) {
    params.speed = 1.0;
    params.calmTarget = 0.3;
    params.currentCalm = 0.3;
    params.wavelengthTarget = 14;
    params.currentWavelength = 14;
    params.reflectAmt = 0.6;

    params.rippleEnergy = 0.0;
    params.liftEnergy = 0.0;
    params.lastKnob = null;
    params.timeAcc = 0.0;

    params.mask = buildMask();
}

export function update(dt, input, params) {
    if (input && input.knobValues) {
        var v = input.knobValues;
        params.speed = v[0];
        params.calmTarget = v[1];
        params.wavelengthTarget = v[2];
        params.reflectAmt = v[3];

        // Any knob turning at all injects both ripple energy (dramatic
        // waves) and lift energy (the rose shoots upward), decaying
        // afterward.
        if (params.lastKnob) {
            var delta = Math.abs(v[0] - params.lastKnob[0]) +
                        Math.abs(v[1] - params.lastKnob[1]) * 4.0 +
                        Math.abs(v[2] - params.lastKnob[2]) * 0.15 +
                        Math.abs(v[3] - params.lastKnob[3]) * 2.0;
            params.rippleEnergy += delta;
            params.liftEnergy += delta * 0.6;
        }
        params.lastKnob = [v[0], v[1], v[2], v[3]];
    }

    params.currentCalm += (params.calmTarget - params.currentCalm) * 0.1;
    params.currentWavelength += (params.wavelengthTarget - params.currentWavelength) * 0.1;

    params.rippleEnergy *= Math.exp(-dt * 0.9);
    if (params.rippleEnergy > 5.0) params.rippleEnergy = 5.0;

    params.liftEnergy *= Math.exp(-dt * 1.1);
    if (params.liftEnergy > 3.0) params.liftEnergy = 3.0;

    params.timeAcc += dt * (0.4 + Math.abs(params.speed) * 0.35);
}

export function draw(display, params, time) {
    var mask = params.mask;
    var w = display.width;
    var h = display.height;
    var t = params.timeAcc;

    // rose sized to nearly fill the matrix width (works for narrow/tall
    // matrices where the rose would otherwise render too small)
    var scale = (w * 0.85) / MASK_W;
    var roseH = MASK_H * scale;
    var invScale = 1.0 / scale;
    var aaSpread = invScale * 0.35;

    var bobAmp = h * 0.045;
    var bobY = Math.sin(t * 1.1) * bobAmp;
    var swayX = Math.sin(t * 0.55 + 1.3) * w * 0.02;
    var rotAngle = Math.sin(t * 0.5) * 0.06;

    var launchOffset = params.liftEnergy * h * 0.16;

    var waterLine = h * 0.60;
    var fadeBand = h * 0.10;

    var gapAboveWater = h * 0.05;
    var restingCenterY = waterLine - gapAboveWater - roseH * 0.5;
    var centerY = restingCenterY + bobY - launchOffset;
    var minCenterY = roseH * 0.5 + h * 0.02;
    if (centerY < minCenterY) centerY = minCenterY;
    var centerX = w * 0.5 + swayX;

    var cosA = Math.cos(-rotAngle), sinA = Math.sin(-rotAngle);

    var wavelength = Math.max(params.currentWavelength, 3.0);
    var freq = (2.0 * Math.PI) / wavelength;

    var rippleAmp = clamp01(params.currentCalm * 0.5 + Math.min(params.rippleEnergy, 5.0) * 0.16);
    var turbulence = clamp01((params.rippleEnergy - 1.0) / 4.0);

    for (var y = 0; y < h; y++) {
        var relY = y - centerY;
        var distBelow = y - waterLine;
        var fadeIn = clamp01(distBelow / fadeBand);

        for (var x = 0; x < w; x++) {
            var relX = x - centerX;
            var rx = relX * cosA - relY * sinA;
            var ry = relX * sinA + relY * cosA;
            var mx = rx / scale + MASK_W / 2.0;
            var my = ry / scale + MASK_H / 2.0;
            var roseVal = clamp01(maskAtAA(mask, mx, my, aaSpread));

            var rippleVal = 0.0;
            if (fadeIn > 0.0) {
                var rdx = x - centerX;
                var radial = Math.sqrt(rdx * rdx + distBelow * distBelow * 2.2);
                var ringWave = Math.sin(radial * freq - t * 2.6) * 0.5 + 0.5;
                var ambientWave = Math.sin(distBelow * 0.35 + x * 0.12 + t * 1.8) * 0.5 + 0.5;
                var mixed = ambientWave * 0.4 + ringWave * 0.6;

                if (turbulence > 0.0) {
                    var chop1 = Math.sin(x * 0.5 + distBelow * 0.9 + t * 6.0) * 0.5 + 0.5;
                    var chop2 = Math.sin(x * 0.23 - distBelow * 0.6 + t * 9.0 + radial * 0.3) * 0.5 + 0.5;
                    var chaos = chop1 * 0.5 + chop2 * 0.5;
                    mixed = mixed * (1.0 - turbulence) + chaos * turbulence;
                }

                var waterVal = clamp01(0.08 + mixed * rippleAmp * 0.75);

                if (params.reflectAmt > 0.01) {
                    var displace = (ringWave - 0.5) * 2.0 * (8.0 + turbulence * 10.0) * rippleAmp;
                    var mirrorY = 2.0 * waterLine - y;
                    var relYR = mirrorY - centerY;
                    var relXR = (x + displace) - centerX;
                    var rxR = relXR * cosA + relYR * sinA;
                    var ryR = -relXR * sinA + relYR * cosA;
                    var mxR = rxR / scale + MASK_W / 2.0;
                    var myR = ryR / scale + MASK_H / 2.0;
                    var mvalR = maskAtAA(mask, mxR, myR, aaSpread);
                    waterVal = waterVal * (1.0 - mvalR * params.reflectAmt * 0.9);
                }

                rippleVal = waterVal * fadeIn;
            }

            var value = Math.max(roseVal, rippleVal);
            display.setValue(x, y, clamp01(value));
        }
    }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
