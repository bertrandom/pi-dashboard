// ===== Patternflow pattern =====
// Title:    Black Rock City
// Author:   @Jon
// Date:     2026-08-10
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @knobs Glitch=0..1, Speed=0.05..5, Freq=10..120, Quantize=2..10
// @matrix 128x128
// Pattern: Black Rock City — Night (v4)
// Author: (variation seeded from "Origin" by Seunghun LEE)
// SPDX-License-Identifier: CC-BY-SA-4.0
//
// Aerial Burning Man at night. Fixed horseshoe street grid drawn in white,
// randomly-colored flashing camps, stationary art on the playa, the Temple
// out in deep playa, and bikes / art cars that follow the streets inside the
// city and roam freely once out on the open / deep playa.
//
// Layout: the Man sits at the center of an open inner playa. 8 concentric
// ring-streets curve around it; radial "clock" streets run out from the
// center from 2:00 to 10:00. The city opening faces RIGHT, so the dark area
// on the right is the open / deep playa, where the Temple stands. City is
// placed down-left. Camp counts are FIXED (not knob-controlled).
//
// Knob 1 (0..1, wraps): Camp flash chaos — 0 steady, 1 frantic random blinking.
// Knob 2 (0.1..10):     Speed — traffic motion, flash + Man flicker rate.
// Knob 3 (0..4.9):      Traffic — how many bikes / art cars are moving.
// Knob 4 (0..1, wraps): Trail length for bikes / art cars — 0 none .. 1 long.
// Encoder button (short press): resets that knob to its default value.

var TWO_PI = Math.PI * 2;
var GAP_HALF = Math.PI / 3;        // 60deg -> city spans 2:00..10:00 (240deg)
var RINGS = 8;                     // concentric ring-streets (white lines)
var RADIALS = 9;                   // clock hands 2:00..10:00 (hourly)
var CAMPS_PER_BLOCK = [20, 18, 16, 14, 12, 10, 9]; // inner denser, 7 blocks
var NART = 24;                     // stationary art pieces on the playa
var MAXV = 40;                     // max moving vehicles (bikes + art cars)
var MAXTRAIL = 10;                 // max stored trail points per vehicle
var STREET_BRIGHT = 0.5;           // fixed white-grid brightness

function hash1(n) {
    var s = Math.sin(n * 127.1 + 0.7) * 43758.5453;
    return s - Math.floor(s);
}

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function norm(a) { // wrap to [-PI, PI]
    a = a % TWO_PI;
    if (a > Math.PI) a -= TWO_PI;
    if (a < -Math.PI) a += TWO_PI;
    return a;
}

// Additive HSV glow into the float framebuffer. No allocations.
function addGlowHSV(fb, w, h, fx, fy, hue, sat, val, rad, core) {
    hue = hue - Math.floor(hue);
    var i = Math.floor(hue * 6);
    var f = hue * 6 - i;
    var p = val * (1 - sat);
    var q = val * (1 - f * sat);
    var tcol = val * (1 - (1 - f) * sat);
    var cr, cg, cb;
    switch (((i % 6) + 6) % 6) {
        case 0: cr = val; cg = tcol; cb = p; break;
        case 1: cr = q; cg = val; cb = p; break;
        case 2: cr = p; cg = val; cb = tcol; break;
        case 3: cr = p; cg = q; cb = val; break;
        case 4: cr = tcol; cg = p; cb = val; break;
        default: cr = val; cg = p; cb = q; break;
    }
    var x0 = Math.max(0, Math.floor(fx - rad));
    var x1 = Math.min(w - 1, Math.ceil(fx + rad));
    var y0 = Math.max(0, Math.floor(fy - rad));
    var y1 = Math.min(h - 1, Math.ceil(fy + rad));
    var r2 = rad * rad + 0.0001;
    for (var yy = y0; yy <= y1; yy++) {
        for (var xx = x0; xx <= x1; xx++) {
            var dx = xx - fx, dy = yy - fy;
            var d2 = dx * dx + dy * dy;
            if (d2 > r2) continue;
            var fall = 1 - d2 / r2;
            fall = fall * fall * core;
            var idx = (yy * w + xx) * 3;
            fb[idx] += cr * fall;
            fb[idx + 1] += cg * fall;
            fb[idx + 2] += cb * fall;
        }
    }
}

export function setup(params) {
    params.flash = 0.6;    // Knob 1
    params.speed = 2.0;    // Knob 2
    params.traffic = 2.5;  // Knob 3
    params.trail = 0.4;    // Knob 4
    params.timeAcc = 0.0;
    params.prevAcc = 0.0;
}

export function update(dt, input, params) {
    if (input && input.knobValues) {
        var v = input.knobValues;
        if (!params.lastKnob) params.lastKnob = [v[0], v[1], v[2], v[3]];
        if (Math.abs(v[0] - params.lastKnob[0]) > 1e-6) params.flash = v[0];
        if (Math.abs(v[1] - params.lastKnob[1]) > 1e-6) params.speed = v[1];
        if (Math.abs(v[2] - params.lastKnob[2]) > 1e-6) params.traffic = v[2];
        if (Math.abs(v[3] - params.lastKnob[3]) > 1e-6) params.trail = v[3];
        params.lastKnob = [v[0], v[1], v[2], v[3]];
    }
    if (input && input.btnPressed) {
        if (input.btnPressed[0]) params.flash = 0.6;
        if (input.btnPressed[1]) params.speed = 2.0;
        if (input.btnPressed[2]) params.traffic = 2.5;
        if (input.btnPressed[3]) params.trail = 0.4;
    }
    params.timeAcc += dt * params.speed;
}

function initVehicles(params, cx, cy, Ri, Ro) {
    var arr = [];
    for (var i = 0; i < MAXV; i++) {
        var s = i * 13 + 5;
        var isCar = hash1(s + 4) < 0.35 ? 1 : 0;
        var v = {
            pref: hash1(s) < 0.5 ? 0 : 1,          // preferred city behavior: 0 ring, 1 spoke
            mode: 2,                                // 0 ring, 1 spoke, 2 playa
            dir: hash1(s + 1) < 0.5 ? -1 : 1,
            spd: 16 + hash1(s + 2) * 26,
            hue: hash1(s + 3),
            isCar: isCar,
            fph: hash1(s + 5) * TWO_PI,
            hx: hash1(s + 9) * TWO_PI,
            x: 0, y: 0,
            hist: new Float32Array(MAXTRAIL * 2),
            hp: 0
        };
        var spawnPlaya = isCar ? (hash1(s + 6) < 0.6) : (hash1(s + 6) < 0.25);
        if (spawnPlaya) {
            var xLeft = cx + Ro * 0.7;
            v.x = xLeft + hash1(s + 7) * (128 - xLeft - 4);
            v.y = 4 + hash1(s + 8) * 56;
            v.mode = 2;
        } else {
            var a = GAP_HALF + hash1(s + 7) * (TWO_PI - 2 * GAP_HALF);
            var rr = Ri + hash1(s + 8) * (Ro - Ri);
            v.x = cx + Math.cos(a) * rr;
            v.y = cy + Math.sin(a) * rr;
            v.mode = v.pref;
        }
        for (var j = 0; j < MAXTRAIL; j++) { v.hist[j * 2] = v.x; v.hist[j * 2 + 1] = v.y; }
        arr.push(v);
    }
    params.veh = arr;
}

export function draw(display, params, time) {
    var w = display.width;
    var h = display.height;
    var t = params.timeAcc;

    if (!params.fb || params.fbw !== w || params.fbh !== h) {
        params.fb = new Float32Array(w * h * 3);
        params.fbw = w; params.fbh = h;
        params.veh = null;
    }
    var fb = params.fb;
    fb.fill(0);

    // Fixed geometry: city down-left, opening faces +x (right), open inner playa.
    var cx = w * 0.25;
    var cy = h * 0.5;
    var Ro = Math.min(cx, cy, h - cy) - 2;
    var Ri = Ro * 0.32;                 // larger -> open inner playa (inner rings removed)
    var rstep = (Ro - Ri) / (RINGS - 1);
    var radSpan = TWO_PI - 2 * GAP_HALF;

    if (!params.veh) initVehicles(params, cx, cy, Ri, Ro);

    var step = clamp(t - params.prevAcc, 0, 0.2);
    params.prevAcc = t;

    var flash = params.flash;

    // ---- White street grid: concentric rings + radial clock streets ----
    var gx0 = Math.max(0, Math.floor(cx - Ro - 1));
    var gx1 = Math.min(w - 1, Math.ceil(cx + Ro * 0.55 + 1));
    var gy0 = Math.max(0, Math.floor(cy - Ro - 1));
    var gy1 = Math.min(h - 1, Math.ceil(cy + Ro + 1));
    for (var y = gy0; y <= gy1; y++) {
        for (var x = gx0; x <= gx1; x++) {
            var dx = x - cx, dy = y - cy;
            var r = Math.sqrt(dx * dx + dy * dy);
            if (r < Ri - 0.6 || r > Ro + 0.6) continue;
            var aa = Math.atan2(dy, dx);
            if (Math.abs(norm(aa)) < GAP_HALF - 0.02) continue; // inside the opening
            var kNear = Math.round((r - Ri) / rstep);
            var Rk = Ri + kNear * rstep;
            var onRing = Math.abs(r - Rk) < 0.5;
            var onRad = false;
            for (var sIdx = 0; sIdx < RADIALS; sIdx++) {
                var ra = GAP_HALF + sIdx * radSpan / (RADIALS - 1);
                if (Math.abs(norm(aa - ra)) * r < 0.6) { onRad = true; break; }
            }
            if (onRing || onRad) {
                var idx = (y * w + x) * 3;
                fb[idx] += STREET_BRIGHT * 0.8;
                fb[idx + 1] += STREET_BRIGHT * 0.8;
                fb[idx + 2] += STREET_BRIGHT * 0.9;
            }
        }
    }

    // ---- Promenade road: Center Camp -> Man -> Temple (the 6:00/12:00 axis) ----
    var roadX0 = Math.max(0, Math.round(cx - Ro * 0.62));  // Center Camp end (left)
    var roadX1 = Math.min(w - 1, Math.round(cx + Ro * 1.6)); // Temple end (right)
    var roadY = Math.round(cy);
    for (var rx = roadX0; rx <= roadX1; rx++) {
        for (var dyr = -1; dyr <= 1; dyr++) {
            var ry = roadY + dyr;
            if (ry < 0 || ry >= h) continue;
            var wv = dyr === 0 ? 1.0 : 0.375;
            var ridx = (ry * w + rx) * 3;
            fb[ridx] += STREET_BRIGHT * 0.8 * wv;
            fb[ridx + 1] += STREET_BRIGHT * 0.8 * wv;
            fb[ridx + 2] += STREET_BRIGHT * 0.9 * wv;
        }
    }

    // ---- Camps: fixed count, random colors, random flash frequencies ----
    for (var k = 0; k < CAMPS_PER_BLOCK.length; k++) {
        var blockR = Ri + (k + 0.5) * rstep;
        var N = CAMPS_PER_BLOCK[k];
        for (var ci = 0; ci < N; ci++) {
            var seed = k * 97 + ci * 7 + 11;
            var a2 = GAP_HALF + (ci + 0.5) / N * (TWO_PI - 2 * GAP_HALF);
            var rr2 = blockR + (hash1(seed) - 0.5) * rstep * 0.5;
            var px = cx + Math.cos(a2) * rr2;
            var py = cy + Math.sin(a2) * rr2;
            var freq = 0.6 + hash1(seed + 2) * 4.0;
            var phase = hash1(seed + 3) * TWO_PI;
            var fl = 0.5 + 0.5 * Math.sin(t * freq + phase);
            var val = clamp(0.9 * (1 - flash * (1 - fl)), 0, 1);
            addGlowHSV(fb, w, h, px, py, hash1(seed + 1), 0.95, val, 1.3, 0.95);
        }
    }

    // ---- Stationary art on the open / deep playa ----
    for (var ai = 0; ai < NART; ai++) {
        var as = ai * 29 + 300;
        var axp, ayp;
        if (hash1(as) < 0.6) {                 // deep playa (right side)
            var xL = cx + Ro * 0.7;
            axp = xL + hash1(as + 1) * (w - xL - 4);
            ayp = 4 + hash1(as + 2) * (h - 8);
        } else {                                // open / inner playa (the opening)
            var aa2 = (hash1(as + 1) - 0.5) * 2 * GAP_HALF;
            var arr2 = 6 + hash1(as + 2) * (Ro * 1.2);
            axp = cx + Math.cos(aa2) * arr2;
            ayp = cy + Math.sin(aa2) * arr2;
        }
        var afreq = 0.3 + hash1(as + 5) * 1.2;
        var aph = hash1(as + 6) * TWO_PI;
        var afl = 0.6 + 0.4 * Math.sin(t * afreq + aph);
        var aval = clamp(0.8 * (1 - flash * 0.5 * (1 - afl)), 0, 1);
        if (hash1(as + 3) < 0.2) addGlowHSV(fb, w, h, axp, ayp, 0.12, 0.05, aval, 1.6, 1.0);
        else addGlowHSV(fb, w, h, axp, ayp, hash1(as + 4), 0.95, aval, 1.4, 1.0);
    }

    // ---- Center Camp plaza marker (at 6:00, toward -x) ----
    addGlowHSV(fb, w, h, cx - Ro * 0.62, cy, 0.11, 0.05, 0.7, 2.0, 0.8);

    // ---- The Temple: out in deep playa on the 12:00 axis (opening side, +x) ----
    var templeX = cx + Ro * 1.6;
    var templeY = cy;
    var tPulse = 0.7 + 0.3 * Math.sin(t * 0.7);          // slow breathing
    addGlowHSV(fb, w, h, templeX, templeY, 0.09, 0.30, tPulse, 3.2, 1.0); // warm-amber halo
    addGlowHSV(fb, w, h, templeX, templeY, 0.10, 0.04, 1.0, 1.3, 1.4);    // white core

    // ---- The Man (center of the open playa, warm flicker + white core) ----
    var flick = 0.7 + 0.3 * Math.sin(t * 6.0) * Math.sin(t * 2.3 + 1.0);
    addGlowHSV(fb, w, h, cx, cy, 0.06, 0.9, 1.0, 3.0, 1.4 * flick);
    addGlowHSV(fb, w, h, cx, cy, 0.10, 0.05, 1.0, 1.2, 1.7);

    // ---- Moving vehicles: follow streets in the city, wander on the playa ----
    var activeV = clamp(Math.round(params.traffic / 4.9 * MAXV), 0, MAXV);
    var trailCount = clamp(Math.round(params.trail * MAXTRAIL), 0, MAXTRAIL - 1);
    for (var vi = 0; vi < activeV; vi++) {
        var v = params.veh[vi];

        var vdx = v.x - cx, vdy = v.y - cy;
        var vr = Math.sqrt(vdx * vdx + vdy * vdy);
        var va = Math.atan2(vdy, vdx);
        var inArc = Math.abs(norm(va)) >= GAP_HALF;
        var inBand = vr >= Ri - 1 && vr <= Ro + 1;

        if (v.mode === 2) {                          // free wander on the playa
            v.hx += Math.sin(t * (0.7 + (vi % 5) * 0.2) + v.fph) * 0.15;
            if (v.x < 3 || v.x > w - 3 || v.y < 3 || v.y > h - 3 || vr > Ro * 2.0) {
                var toC = Math.atan2(cy - v.y, cx - v.x);
                v.hx += norm(toC - v.hx) * 0.3;
            }
            v.x += Math.cos(v.hx) * v.spd * step;
            v.y += Math.sin(v.hx) * v.spd * step;
            var ndx = v.x - cx, ndy = v.y - cy;
            var nr0 = Math.sqrt(ndx * ndx + ndy * ndy);
            var na0 = Math.atan2(ndy, ndx);
            if (nr0 >= Ri && nr0 <= Ro && Math.abs(norm(na0)) >= GAP_HALF) {
                v.mode = v.pref;                     // re-enter and pick up a street
            }
        } else if (v.mode === 0) {                   // ring rider (along an arc)
            if (!inArc || !inBand) {
                v.mode = 2;                          // reached the opening -> peel off
            } else {
                var kk = clamp(Math.round((vr - Ri) / rstep), 0, RINGS - 1);
                var Rk2 = Ri + kk * rstep;
                vr += (Rk2 - vr) * 0.4;
                var omega = (v.spd / Math.max(vr, 6)) * v.dir;
                va += omega * step;
                v.x = cx + Math.cos(va) * vr;
                v.y = cy + Math.sin(va) * vr;
            }
        } else {                                     // spoke rider (along a radial)
            if (!inArc) {
                v.mode = 2;
            } else {
                var best = 1e9, ba = Math.PI;        // nearest INTERIOR radial (skip gap edges)
                for (var sr = 1; sr < RADIALS - 1; sr++) {
                    var ra2 = GAP_HALF + sr * radSpan / (RADIALS - 1);
                    var d = Math.abs(norm(va - ra2));
                    if (d < best) { best = d; ba = ra2; }
                }
                var nr = vr + v.dir * v.spd * step * 0.6;
                if (nr >= Ro) { nr = Ro; v.mode = 2; }       // outer end -> playa
                else if (nr <= Ri) { nr = Ri; v.mode = 0; }  // inner end -> circulate
                var na = va + norm(ba - va) * 0.4;
                v.x = cx + Math.cos(na) * nr;
                v.y = cy + Math.sin(na) * nr;
            }
        }

        // push current position into the trail history ring buffer
        v.hp = (v.hp + 1) % MAXTRAIL;
        v.hist[v.hp * 2] = v.x;
        v.hist[v.hp * 2 + 1] = v.y;

        var rad = v.isCar ? 2.0 : 1.3;
        var core = v.isCar ? 1.1 : 0.9;
        var sat = v.isCar ? 0.95 : 0.7;
        addGlowHSV(fb, w, h, v.x, v.y, v.hue, sat, 1.0, rad, core);
        for (var jt = 1; jt <= trailCount; jt++) {
            var hi = ((v.hp - jt) % MAXTRAIL + MAXTRAIL) % MAXTRAIL;
            var tx = v.hist[hi * 2], ty = v.hist[hi * 2 + 1];
            var frac = 1 - jt / (trailCount + 1);
            addGlowHSV(fb, w, h, tx, ty, v.hue, sat, 1.0, rad * (1 - 0.4 * (jt / (trailCount + 1))), core * frac * 0.8);
        }
    }

    // ---- Blit ----
    for (var by = 0; by < h; by++) {
        for (var bx = 0; bx < w; bx++) {
            var bi = (by * w + bx) * 3;
            var rr3 = fb[bi], gg = fb[bi + 1], bb = fb[bi + 2];
            var R = rr3 > 1 ? 255 : Math.floor(rr3 * 255);
            var G = gg > 1 ? 255 : Math.floor(gg * 255);
            var B = bb > 1 ? 255 : Math.floor(bb * 255);
            display.setPixel(bx, by, R, G, B);
        }
    }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
