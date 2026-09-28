// ===== Patternflow pattern =====
// Title:    Welcome to Mesto Koh Phangan
// Author:   @kraseva
// Date:     2026-09-06
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @knobs Glitch=0..1, Speed=0.05..5, Freq=10..120, Quantize=2..10
// @matrix 128x128
// Pattern: MESTO Marquee
// Author: Stasik / NASHE MESTO
// SPDX-License-Identifier: CC-BY-SA-4.0
// Date: 2026
//
// Scrolling marquee, hand-drawn 5x7 pixel font (no canvas/DOM — pure pixel
// math so it converts cleanly to C++). Text bobs on a sine wave; each glyph
// fires an expanding, jittering outline-echo of itself plus a few sparks
// as it crosses fixed trigger points on screen.
// Knob 1: Color gamut (hue rolls inside the selected group, not the full wheel)
// Knob 2: Sine wave strength
// Knob 3: Number of ripple trigger points (more = more frequent waves)
// Knob 4: Ripple sustain (how long a wave lives / how far it travels)
// Encoder button (short press): resets that knob to its origin value.

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
function hueToUnit(h) { return (((h % 360) + 360) % 360) / 360; }

// ---- fixed reference geometry (Patternflow matrix is 128x64) ----
const W = 128, H = 128;
const SCROLL_SPEED = 30; // px/sec, fixed

// ---- hand-drawn 5x7 pixel font, only the glyphs this text needs ----
const GLYPH_W = 5, GLYPH_H = 7, SCALE = 3;
const GAP_PX = 1 * SCALE, SPACE_PX = 3 * SCALE, GLYPH_PX = GLYPH_W * SCALE;

const FONT_SRC = {
    'W': ["X...X", "X...X", "X...X", "X.X.X", "X.X.X", "XX.XX", "X...X"],
    'e': [".....", ".....", ".XXX.", "X...X", "XXXXX", "X....", ".XXXX"],
    'l': [".X...", ".X...", ".X...", ".X...", ".X...", ".X...", ".XXX."],
    'c': [".....", ".....", ".XXXX", "X....", "X....", "X....", ".XXXX"],
    'o': [".....", ".....", ".XXX.", "X...X", "X...X", "X...X", ".XXX."],
    'm': [".....", ".....", "XX.X.", "X.X.X", "X.X.X", "X...X", "X...X"],
    't': ["..X..", ".XXX.", "..X..", "..X..", "..X..", "..X..", "...XX"],
    'M': ["X...X", "XX.XX", "X.X.X", "X...X", "X...X", "X...X", "X...X"],
    'E': ["XXXXX", "X....", "X....", "XXXX.", "X....", "X....", "XXXXX"],
    'S': [".XXXX", "X....", "X....", ".XXX.", "....X", "....X", "XXXX."],
    'T': ["XXXXX", "..X..", "..X..", "..X..", "..X..", "..X..", "..X.."],
    'O': [".XXX.", "X...X", "X...X", "X...X", "X...X", "X...X", ".XXX."],
    'K': ["X...X", "X..X.", "X.X..", "XX...", "X.X..", "X..X.", "X...X"],
    'h': ["X....", "X....", "X.XX.", "XX..X", "X...X", "X...X", "X...X"],
    'P': ["XXXX.", "X...X", "X...X", "XXXX.", "X....", "X....", "X...."],
    'a': [".....", ".....", ".XXX.", "....X", ".XXXX", "X...X", ".XXXX"],
    'n': [".....", ".....", "X.XX.", "XX..X", "X...X", "X...X", "X...X"],
    'g': [".....", ".....", ".XXXX", "X...X", ".XXXX", "....X", ".XXX."],
    '\uD83D\uDC25': [".XXX.", "XXXXX", "XXXXX", ".XXX.", "..X..", ".X.X.", "....."], // 🐥 chick (simplified icon)
    '\uD83E\uDEB4': [".X.X.", "XXXXX", ".XXX.", "..X..", ".XXX.", "XXXXX", "XXXXX"]  // 🪴 potted plant (simplified icon)
};
function parseGlyph(rows) { return rows.map(row => row.split('').map(c => c === 'X' ? 1 : 0)); }
const FONT = {};
for (const k in FONT_SRC) FONT[k] = parseGlyph(FONT_SRC[k]);

function computeOutline(bitmap) {
    const cells = [];
    for (let r = 0; r < GLYPH_H; r++) {
        for (let c = 0; c < GLYPH_W; c++) {
            if (bitmap[r][c] !== 1) continue;
            const nb = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
            let edge = false;
            for (const [nr, nc] of nb) {
                if (nr < 0 || nr >= GLYPH_H || nc < 0 || nc >= GLYPH_W || bitmap[nr][nc] !== 1) { edge = true; break; }
            }
            if (edge) cells.push({ r, c });
        }
    }
    return cells;
}
const OUTLINES = {};
for (const k in FONT) OUTLINES[k] = computeOutline(FONT[k]);

// 🐥 and 🪴 stand in for chick / potted-plant emoji, redrawn as simple pixel icons
const CHICK = '\uD83D\uDC25', PLANT = '\uD83E\uDEB4';
const TEXT_SEQUENCE = ['W','e','l','c','o','m','e',' ','t','o',' ','M','E','S','T','O',' ','K','o','h',' ','P','h','a','n','g','a','n',' ',CHICK,' ',PLANT,' ',' ',' ',' '];

let CYCLE = 0;
const chars = [];
{
    let cum = 0;
    for (const ch of TEXT_SEQUENCE) {
        chars.push({ ch, cumX: cum });
        cum += (ch === ' ' ? SPACE_PX : GLYPH_PX) + GAP_PX;
    }
    CYCLE = cum;
}

// ---- color gamuts: knob 1 glides across these, hue rolls inside the current one ----
const GAMUTS = [
    { c: 18, spread: 28 },
    { c: 70, spread: 30 },
    { c: 150, spread: 38 },
    { c: 205, spread: 32 },
    { c: 265, spread: 34 },
    { c: 320, spread: 32 }
];
function currentGamut(knobVal) {
    const pos = clamp(knobVal, 0, 1) * (GAMUTS.length - 1);
    const i0 = Math.floor(pos), i1 = Math.min(i0 + 1, GAMUTS.length - 1), f = pos - i0;
    return {
        c: GAMUTS[i0].c + (GAMUTS[i1].c - GAMUTS[i0].c) * f,
        spread: GAMUTS[i0].spread + (GAMUTS[i1].spread - GAMUTS[i0].spread) * f
    };
}
function hueAt(gamut, screenX, t) { return gamut.c + Math.sin(t * 0.6 + screenX * 0.04) * gamut.spread; }
function sustainLife(params) { return 0.4 + params.sustain * 3.2; }

function spawnParticles(params, x, y, hue, count, t) {
    for (let i = 0; i < count; i++) {
        const ang = Math.random() * Math.PI * 2;
        const speed = 12 + Math.random() * 70;
        params.particles.push({
            x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
            born: t, life: 0.25 + Math.random() * 0.9,
            hue: hue + (Math.random() - 0.5) * 26,
            size: 1 + Math.round(Math.random())
        });
    }
}

export function setup(params) {
    params.gamut = 0.35;
    params.sine = 0.45;
    params.waves = 0.5;
    params.sustain = 0.5;
    params.lastKnob = null;
    params.timeAcc = 0;
    params.scrollDist = 0;
    params.ripples = [];
    params.particles = [];
    params.prevX = {};
}

export function update(dt, input, params) {
    if (input && input.knobValues) {
        const v = input.knobValues;
        if (!params.lastKnob) params.lastKnob = [v[0], v[1], v[2], v[3]];
        if (Math.abs(v[0] - params.lastKnob[0]) > 1e-6) params.gamut = v[0];
        if (Math.abs(v[1] - params.lastKnob[1]) > 1e-6) params.sine = v[1];
        if (Math.abs(v[2] - params.lastKnob[2]) > 1e-6) params.waves = v[2];
        if (Math.abs(v[3] - params.lastKnob[3]) > 1e-6) params.sustain = v[3];
        params.lastKnob = [v[0], v[1], v[2], v[3]];
    }
    if (input && input.btnPressed) {
        if (input.btnPressed[0]) params.gamut = 0.35;
        if (input.btnPressed[1]) params.sine = 0.45;
        if (input.btnPressed[2]) params.waves = 0.5;
        if (input.btnPressed[3]) params.sustain = 0.5;
    }

    params.timeAcc += dt;
    params.scrollDist += dt * SCROLL_SPEED;

    const t = params.timeAcc;
    const gamut = currentGamut(params.gamut);
    const offset = params.scrollDist % CYCLE;
    const amp = 2 + params.sine * 15;
    const freq = 0.02 + params.sine * 0.02;

    const numTriggers = 1 + Math.round(params.waves * 7);
    const triggers = [];
    for (let k = 0; k < numTriggers; k++) triggers.push(((k + 0.5) / numTriggers) * W);

    for (let copyIndex = 0; copyIndex < 2; copyIndex++) {
        const copyBase = W - offset + copyIndex * CYCLE;
        for (let i = 0; i < chars.length; i++) {
            const c = chars[i];
            const screenX = copyBase + c.cumX;
            const key = i + '_' + copyIndex;
            const prev = (key in params.prevX) ? params.prevX[key] : screenX;
            if (c.ch !== ' ' && Math.abs(screenX - prev) < W) {
                for (const tx of triggers) {
                    if (prev > tx && screenX <= tx) {
                        const yOff = Math.sin(screenX * freq + t * 1.6) * amp;
                        const drawY = H / 2 + yOff;
                        const hue = hueAt(gamut, screenX, t);
                        params.ripples.push({
                            x: screenX, y: drawY, born: t, hue, ch: c.ch,
                            lifeMul: 0.55 + Math.random() * 0.9,
                            growthMul: 0.6 + Math.random() * 0.9,
                            ringDelay: 0.06 + Math.random() * 0.14
                        });
                        spawnParticles(params, screenX, drawY, hue, 3 + Math.round(params.waves * 7), t);
                    }
                }
            }
            params.prevX[key] = screenX;
        }
    }

    const life = sustainLife(params);
    if (params.ripples.length > 200) params.ripples.splice(0, params.ripples.length - 200);
    params.ripples = params.ripples.filter(r => (t - r.born) < life * r.lifeMul + 0.9);
    params.particles = params.particles.filter(p => (t - p.born) < p.life);
}

export function draw(display, params, time) {
    const w = display.width, h = display.height;
    const t = params.timeAcc;
    const gamut = currentGamut(params.gamut);
    const offset = params.scrollDist % CYCLE;
    const amp = 2 + params.sine * 15;
    const freq = 0.02 + params.sine * 0.02;

    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) display.setPixel(x, y, 0, 0, 0);

    // glyphs
    for (let copyIndex = 0; copyIndex < 2; copyIndex++) {
        const copyBase = w - offset + copyIndex * CYCLE;
        for (let i = 0; i < chars.length; i++) {
            const c = chars[i];
            const screenX = copyBase + c.cumX;
            if (screenX < -GLYPH_PX - 10 || screenX > w + 10) continue;
            const bitmap = FONT[c.ch];
            if (!bitmap) continue;
            const yOff = Math.sin(screenX * freq + t * 1.6) * amp;
            const originX = Math.round(screenX);
            const originY = Math.round(h / 2 + yOff - (GLYPH_H * SCALE) / 2);
            const [r, g, b] = hsvToRgb(hueToUnit(hueAt(gamut, screenX, t)), 1, 1);
            for (let ry = 0; ry < GLYPH_H; ry++) {
                for (let rx = 0; rx < GLYPH_W; rx++) {
                    if (bitmap[ry][rx] !== 1) continue;
                    for (let by = 0; by < SCALE; by++) {
                        for (let bx = 0; bx < SCALE; bx++) {
                            const px = originX + rx * SCALE + bx;
                            const py = originY + ry * SCALE + by;
                            if (px >= 0 && px < w && py >= 0 && py < h) display.setPixel(px, py, r, g, b);
                        }
                    }
                }
            }
        }
    }

    // ripples: growing, jittered outline-echoes of the glyph that spawned them
    const baseGrowth = 26; // px/sec
    const ringCount = 3;
    const life = sustainLife(params);
    for (const rp of params.ripples) {
        const outline = OUTLINES[rp.ch];
        if (!outline || outline.length === 0) continue;
        const rpLife = life * rp.lifeMul;
        const rpGrowth = baseGrowth * rp.growthMul;
        for (let ring = 0; ring < ringCount; ring++) {
            const effAge = (t - rp.born) - ring * rp.ringDelay;
            if (effAge <= 0) continue;
            const fade = 1 - effAge / rpLife;
            if (fade <= 0) continue;
            const cellPx = Math.max(1, Math.round(SCALE + (effAge * rpGrowth) / GLYPH_W));
            const [r, g, b] = hsvToRgb(hueToUnit(rp.hue + ring * 15), 1, 1);
            const originX = Math.round(rp.x - (GLYPH_W * cellPx) / 2);
            const originY = Math.round(rp.y - (GLYPH_H * cellPx) / 2);
            for (const cell of outline) {
                const px0 = originX + cell.c * cellPx;
                const py0 = originY + cell.r * cellPx;
                for (let by = 0; by < cellPx; by++) {
                    for (let bx = 0; bx < cellPx; bx++) {
                        const px = px0 + bx, py = py0 + by;
                        if (px >= 0 && px < w && py >= 0 && py < h) {
                            display.setPixel(px, py, Math.round(r * fade), Math.round(g * fade), Math.round(b * fade));
                        }
                    }
                }
            }
        }
    }

    // scattering sparks
    for (const p of params.particles) {
        const age = t - p.born;
        const fade = 1 - age / p.life;
        if (fade <= 0) continue;
        const px = Math.round(p.x + p.vx * age);
        const py = Math.round(p.y + p.vy * age);
        const [r, g, b] = hsvToRgb(hueToUnit(p.hue), 1, 1);
        for (let oy = 0; oy < p.size; oy++) {
            for (let ox = 0; ox < p.size; ox++) {
                const wx = px + ox, wy = py + oy;
                if (wx >= 0 && wx < w && wy >= 0 && wy < h) {
                    display.setPixel(wx, wy, Math.round(r * fade), Math.round(g * fade), Math.round(b * fade));
                }
            }
        }
    }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
