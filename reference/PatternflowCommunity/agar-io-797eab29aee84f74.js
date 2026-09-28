// ===== Patternflow pattern =====
// Title:    AGAR.IO
// Author:   @Jon
// Based on: "Agar.IO" by @Jon — https://patternflow.work/community/p/849739d06d854d24
// Date:     2026-08-10
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @knobs Glitch=0..1, Speed=5..30, Freq=0..4.9, Quantize=1..100
// @matrix 128x64
// Pattern: Petri — an Agar.io-style cell arena (autonomous, no cursor)
// Author: variation on "Origin" seed
// SPDX-License-Identifier: CC-BY-SA-4.0
//
// Cells graze food to grow, big eats small, size-capped cells reset.
// Knob 1: Aggression — graze vs hunt & how easily big eats small (0..1, wraps)
// Knob 2: Simulation speed (0.1..10)
// Knob 3: MAX active cells (0..4.9 -> 3..14, array-capped at 14)
// Knob 4: R_MAX — max cell radius before reset (0..1 -> ~6..22 px, wraps)
// All knobs are RELATIVE: a twist nudges the value from its current position
// (no absolute snap), so button resets and first-touch don't jump.
// Hue base is a fixed constant (HUE_BASE).

const MAX_CELLS = 14;
const FOOD_N = 40;
const R_BASE = 1;
const BASE_SPEED = 14.0;
const SENSOR = 42.0;
const FOOD_MASS = 15;
const HUE_BASE = 0.0;

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
function wrap01(x) { return ((x % 1) + 1) % 1; }
function frand(a, b) { return a + Math.random() * (b - a); }

function respawnCell(c, w, h) {
    c.x = frand(R_BASE + 2, w - R_BASE - 2);
    c.y = frand(R_BASE + 2, h - R_BASE - 2);
    c.r = R_BASE + frand(0, 1.2);
    c.mass = Math.PI * c.r * c.r;
    c.vx = 0; c.vy = 0;
    c.seed = frand(0, 100);
    c.hueOff = frand(0, 1);
}

function respawnFood(f, w, h) {
    f.x = frand(1, w - 1);
    f.y = frand(1, h - 1);
    f.hueOff = frand(0, 1);
}

export function setup(params) {
    params.aggrKnob = 0.5; // aggression   (0..1)
    params.speed = 2.0;    // speed        (0.1..10)
    params.cellKnob = 0.0; // cell count   (0..4.9 -> 3 cells at start)
    params.rmaxKnob = 0.5; // max radius   (0..1)
    params.timeAcc = 0.0;
    params.w = 128;
    params.h = 64;
    params.prevActive = 0;
    params.init = false;

    params.cells = [];
    for (let i = 0; i < MAX_CELLS; i++) {
        params.cells.push({ x: 0, y: 0, r: R_BASE, mass: Math.PI * R_BASE * R_BASE, vx: 0, vy: 0, seed: 0, hueOff: 0 });
    }
    params.food = [];
    for (let i = 0; i < FOOD_N; i++) {
        params.food.push({ x: 0, y: 0, hueOff: 0 });
    }
    params.order = [];
    for (let i = 0; i < MAX_CELLS; i++) params.order.push(0);
}

export function update(dt, input, params) {
    // RELATIVE knob control: derive the per-frame delta from consecutive
    // absolute knobValues (knob-native units) and add it to the current value.
    // Wrapping knobs (1 & 4) correct the 1.0->0.0 rollover so it isn't read as
    // a large negative jump. On first frame the delta is 0 (no load snap).
    if (input && input.knobValues) {
        let v = input.knobValues;
        if (!params.lastKnob) params.lastKnob = [v[0], v[1], v[2], v[3]];

        let d0 = v[0] - params.lastKnob[0];        // Knob 1: aggression (wraps)
        if (d0 > 0.5) d0 -= 1.0; else if (d0 < -0.5) d0 += 1.0;
        params.aggrKnob = wrap01(params.aggrKnob + d0);

        let d1 = v[1] - params.lastKnob[1];        // Knob 2: speed (clamps)
        params.speed = clamp(params.speed + d1, 0.1, 10.0);

        let d2 = v[2] - params.lastKnob[2];        // Knob 3: cell count (clamps)
        params.cellKnob = clamp(params.cellKnob + d2, 0.0, 4.9);

        let d3 = v[3] - params.lastKnob[3];        // Knob 4: max radius (wraps)
        if (d3 > 0.5) d3 -= 1.0; else if (d3 < -0.5) d3 += 1.0;
        params.rmaxKnob = wrap01(params.rmaxKnob + d3);

        params.lastKnob = [v[0], v[1], v[2], v[3]];
    }

    // Button (short press): reset that knob to its default. Because control is
    // relative, the next twist nudges from here instead of snapping.
    if (input && input.btnPressed) {
        if (input.btnPressed[0]) params.aggrKnob = 0.5;
        if (input.btnPressed[1]) params.speed = 2.0;
        if (input.btnPressed[2]) params.cellKnob = 0.0; // -> 3 cells
        if (input.btnPressed[3]) params.rmaxKnob = 0.5;
    }

    let w = params.w, h = params.h;
    let speedMul = clamp(params.speed, 0.1, 10.0);
    let aggr = clamp(params.aggrKnob, 0.0, 1.0);
    params.timeAcc += dt * speedMul;
    let t = params.timeAcc;

    let rmax = 6.0 + clamp(params.rmaxKnob, 0.0, 1.0) * 16.0;

    let cells = params.cells;
    let food = params.food;

    if (!params.init) {
        for (let i = 0; i < MAX_CELLS; i++) respawnCell(cells[i], w, h);
        for (let i = 0; i < FOOD_N; i++) respawnFood(food[i], w, h);
        params.init = true;
        params.prevActive = 0;
    }

    let activeCount = Math.round(3 + (clamp(params.cellKnob, 0.0, 4.9) / 4.9) * (MAX_CELLS - 3));
    activeCount = clamp(activeCount, 3, MAX_CELLS);
    if (activeCount > params.prevActive) {
        for (let i = params.prevActive; i < activeCount; i++) respawnCell(cells[i], w, h);
    }
    params.prevActive = activeCount;

    let eatRatio = 1.15 - aggr * 0.10;
    let huntBias = 0.4 + aggr * 1.6;

    // --- Pass A: steering velocity ---
    for (let i = 0; i < activeCount; i++) {
        let c = cells[i];
        let dirx = 0, diry = 0;

        let bf = -1, bfd2 = 1e9;
        for (let k = 0; k < FOOD_N; k++) {
            let dx = food[k].x - c.x, dy = food[k].y - c.y;
            let d2 = dx * dx + dy * dy;
            if (d2 < bfd2) { bfd2 = d2; bf = k; }
        }
        let bpd2 = 1e9, btd2 = 1e9, bp = -1, bt = -1;
        for (let j = 0; j < activeCount; j++) {
            if (j === i) continue;
            let o = cells[j];
            let dx = o.x - c.x, dy = o.y - c.y;
            let d2 = dx * dx + dy * dy;
            if (d2 > SENSOR * SENSOR) continue;
            if (c.r > o.r * eatRatio) { if (d2 < bpd2) { bpd2 = d2; bp = j; } }
            else if (o.r > c.r * eatRatio) { if (d2 < btd2) { btd2 = d2; bt = j; } }
        }

        if (bt >= 0) {
            let o = cells[bt];
            let dx = c.x - o.x, dy = c.y - o.y;
            let d = Math.sqrt(dx * dx + dy * dy) + 1e-3;
            let close = 1 - Math.sqrt(btd2) / SENSOR;
            dirx += (dx / d) * (2.0 * close);
            diry += (dy / d) * (2.0 * close);
        } else if (bp >= 0 && aggr > 0.15) {
            let o = cells[bp];
            let dx = o.x - c.x, dy = o.y - c.y;
            let d = Math.sqrt(dx * dx + dy * dy) + 1e-3;
            dirx += (dx / d) * huntBias;
            diry += (dy / d) * huntBias;
        } else if (bf >= 0) {
            let dx = food[bf].x - c.x, dy = food[bf].y - c.y;
            let d = Math.sqrt(dx * dx + dy * dy) + 1e-3;
            dirx += (dx / d) * 1.0;
            diry += (dy / d) * 1.0;
        }

        dirx += Math.sin(t * 0.9 + c.seed) * 0.5;
        diry += Math.cos(t * 0.8 + c.seed * 1.7) * 0.5;

        let m = c.r + 3;
        if (c.x < m) dirx += 0.8;
        if (c.x > w - m) dirx -= 0.8;
        if (c.y < m) diry += 0.8;
        if (c.y > h - m) diry -= 0.8;

        let dl = Math.sqrt(dirx * dirx + diry * diry) + 1e-6;
        let speedPx = BASE_SPEED * speedMul * Math.pow(R_BASE / c.r, 0.5);
        c.vx = (dirx / dl) * speedPx;
        c.vy = (diry / dl) * speedPx;
    }

    // --- Pass B: integrate ---
    for (let i = 0; i < activeCount; i++) {
        let c = cells[i];
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.x = clamp(c.x, c.r, w - c.r);
        c.y = clamp(c.y, c.r, h - c.r);
    }

    // --- Pass C: eat food ---
    for (let i = 0; i < activeCount; i++) {
        let c = cells[i];
        let reach = (c.r + 1.0) * (c.r + 1.0);
        for (let k = 0; k < FOOD_N; k++) {
            let dx = food[k].x - c.x, dy = food[k].y - c.y;
            if (dx * dx + dy * dy < reach) {
                c.mass += FOOD_MASS;
                c.r = Math.sqrt(c.mass / Math.PI);
                if (c.r > rmax) respawnCell(c, w, h);
                respawnFood(food[k], w, h);
            }
        }
    }

    // --- Pass D: eat cells ---
    for (let i = 0; i < activeCount; i++) {
        for (let j = i + 1; j < activeCount; j++) {
            let a = cells[i], b = cells[j];
            let dx = b.x - a.x, dy = b.y - a.y;
            let d2 = dx * dx + dy * dy;
            let rad = Math.max(a.r, b.r);
            if (d2 < rad * rad * 0.81) {
                let big = a.r >= b.r ? a : b;
                let small = a.r >= b.r ? b : a;
                if (big.r > small.r * eatRatio) {
                    big.mass += small.mass;
                    big.r = Math.sqrt(big.mass / Math.PI);
                    if (big.r > rmax) respawnCell(big, w, h);
                    respawnCell(small, w, h);
                }
            }
        }
    }
}

export function draw(display, params, time) {
    let w = display.width;
    let h = display.height;
    params.w = w;
    params.h = h;

    let hueBase = HUE_BASE;
    let t = params.timeAcc;

    let gridOff = Math.floor(t * 3) % 8;
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let on = (((x + gridOff) % 8) === 0) || (((y + gridOff) % 8) === 0);
            if (on) display.setPixel(x, y, 10, 10, 18);
            else display.setPixel(x, y, 3, 3, 6);
        }
    }

    let cells = params.cells;
    let food = params.food;
    let activeCount = clamp(params.prevActive, 0, MAX_CELLS);

    for (let k = 0; k < FOOD_N; k++) {
        let f = food[k];
        let fc = hsvToRgb(hueBase + f.hueOff, 0.9, 1.0);
        let fx = Math.floor(f.x), fy = Math.floor(f.y);
        for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                if (dx * dx + dy * dy > 1) continue;
                let px = fx + dx, py = fy + dy;
                if (px < 0 || px >= w || py < 0 || py >= h) continue;
                display.setPixel(px, py, fc[0], fc[1], fc[2]);
            }
        }
    }

    let order = params.order;
    for (let i = 0; i < activeCount; i++) order[i] = i;
    for (let i = 1; i < activeCount; i++) {
        let key = order[i];
        let kr = cells[key].r;
        let j = i - 1;
        while (j >= 0 && cells[order[j]].r > kr) { order[j + 1] = order[j]; j--; }
        order[j + 1] = key;
    }

    let largest = activeCount > 0 ? order[activeCount - 1] : -1;

    for (let n = 0; n < activeCount; n++) {
        let ci = order[n];
        let c = cells[ci];
        let cx = c.x, cy = c.y, cr = c.r;
        let fill = hsvToRgb(hueBase + c.hueOff, 0.85, 0.82);
        let rimR = clamp(fill[0] + 90, 0, 255);
        let rimG = clamp(fill[1] + 90, 0, 255);
        let rimB = clamp(fill[2] + 90, 0, 255);

        let x0 = Math.max(0, Math.floor(cx - cr - 1));
        let x1 = Math.min(w - 1, Math.ceil(cx + cr + 1));
        let y0 = Math.max(0, Math.floor(cy - cr - 1));
        let y1 = Math.min(h - 1, Math.ceil(cy + cr + 1));

        for (let py = y0; py <= y1; py++) {
            for (let px = x0; px <= x1; px++) {
                let dx = px + 0.5 - cx, dy = py + 0.5 - cy;
                let d = Math.sqrt(dx * dx + dy * dy);
                if (d > cr + 0.4) continue;
                let edge = cr - d;
                if (edge < 1.3) {
                    display.setPixel(px, py, rimR, rimG, rimB);
                } else if (ci === largest && d < cr * 0.35) {
                    display.setPixel(px, py, 255, 255, 255);
                } else {
                    display.setPixel(px, py, fill[0], fill[1], fill[2]);
                }
            }
        }
    }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
