// ===== Patternflow pattern =====
// Title:    Pong 1v1
// Author:   @Enerjoy
// Date:     2026-08-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @knobs PaddleS1=0..1, Hue=0..1, PaddleS2=0..1, Difficulty=0..1
// @matrix 128x128
// Pattern: Pong 1v1
// SPDX-License-Identifier: CC-BY-SA-4.0
//
// To-spillers Pong
// Encoder-knapp (kort trykk): resetter paddle til midten / hue og vanskelighet til origin.


const PANEL_W = 128;
const PANEL_H = 128;

const PADDLE_H = 12;
const PADDLE_W = 2;
const PADDLE_MARGIN = 4;
const BASE_SPEED = 34;
const MAX_SPEED = 130;
const SPEED_RAMP = 6;
const BALL_SIZE = 2;
const DECAY = 0.80; // hvor fort bufferet falmer, styrer glow/trail-lengde

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

function setBuf(params, x, y, r, g, b) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || x >= PANEL_W || y < 0 || y >= PANEL_H) return;
    const idx = (y * PANEL_W + x) * 3;
    params.buf[idx] = r; params.buf[idx + 1] = g; params.buf[idx + 2] = b;
}

function addBuf(params, x, y, r, g, b) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || x >= PANEL_W || y < 0 || y >= PANEL_H) return;
    const idx = (y * PANEL_W + x) * 3;
    params.buf[idx] = Math.min(255, params.buf[idx] + r);
    params.buf[idx + 1] = Math.min(255, params.buf[idx + 1] + g);
    params.buf[idx + 2] = Math.min(255, params.buf[idx + 2] + b);
}

function resetBall(params, dir) {
    params.ball.x = PANEL_W / 2;
    params.ball.y = PANEL_H / 2;
    const baseSpd = BASE_SPEED + params.difficulty * 40;
    const angle = Math.random() * 0.6 - 0.3;
    params.ball.vx = baseSpd * dir * Math.cos(angle);
    params.ball.vy = baseSpd * Math.sin(angle) * 2;
    params.timeSinceScore = 0;
}

function spawnSplatter(params, x, y, hue) {
    for (let i = 0; i < 46; i++) {
        const a = Math.random() * Math.PI * 2;
        const spd = 20 + Math.random() * 90;
        params.particles.push({
            x, y,
            vx: Math.cos(a) * spd,
            vy: Math.sin(a) * spd,
            life: 0.5 + Math.random() * 0.55,
            age: 0,
            size: 1 + Math.random() * 2.2,
            hue: (hue + (Math.random() * 0.16 - 0.08) + 1) % 1
        });
    }
    for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2;
        const spd = 55 + Math.random() * 15;
        params.particles.push({
            x, y,
            vx: Math.cos(a) * spd,
            vy: Math.sin(a) * spd,
            life: 0.35 + Math.random() * 0.2,
            age: 0,
            size: 1.4,
            hue: (hue + 0.5 + Math.random() * 0.05) % 1
        });
    }
}

const DIGIT_GLYPHS = {
    0: [1,1,1, 1,0,1, 1,0,1, 1,0,1, 1,1,1],
    1: [0,1,0, 1,1,0, 0,1,0, 0,1,0, 1,1,1],
    2: [1,1,1, 0,0,1, 1,1,1, 1,0,0, 1,1,1],
    3: [1,1,1, 0,0,1, 1,1,1, 0,0,1, 1,1,1],
    4: [1,0,1, 1,0,1, 1,1,1, 0,0,1, 0,0,1],
    5: [1,1,1, 1,0,0, 1,1,1, 0,0,1, 1,1,1],
    6: [1,1,1, 1,0,0, 1,1,1, 1,0,1, 1,1,1],
    7: [1,1,1, 0,0,1, 0,1,0, 0,1,0, 0,1,0],
    8: [1,1,1, 1,0,1, 1,1,1, 1,0,1, 1,1,1],
    9: [1,1,1, 1,0,1, 1,1,1, 0,0,1, 1,1,1]
};

function drawDigit(params, x, y, n, r, g, b) {
    const glyph = DIGIT_GLYPHS[n] || DIGIT_GLYPHS[0];
    for (let row = 0; row < 5; row++) {
        for (let col = 0; col < 3; col++) {
            if (glyph[row * 3 + col]) setBuf(params, x + col, y + row, r, g, b);
        }
    }
}

export function setup(params) {
    params.buf = new Float32Array(PANEL_W * PANEL_H * 3);
    params.ball = { x: PANEL_W / 2, y: PANEL_H / 2, vx: 0, vy: 0, size: BALL_SIZE };
    params.score = { p1: 0, p2: 0 };
    params.timeSinceScore = 0;
    params.particles = [];

    params.paddle1 = 0.5;
    params.paddle2 = 0.5;
    params.hue = 0.0;
    params.difficulty = 0.3;

    resetBall(params, Math.random() < 0.5 ? 1 : -1);
}

export function update(dt, input, params) {
    if (input && input.knobValues) {
        let v = input.knobValues;
        if (!params.lastKnob) params.lastKnob = [v[0], v[1], v[2], v[3]];
        if (Math.abs(v[0] - params.lastKnob[0]) > 1e-6) params.paddle1 = v[0];
        if (Math.abs(v[1] - params.lastKnob[1]) > 1e-6) params.hue = v[1];
        if (Math.abs(v[2] - params.lastKnob[2]) > 1e-6) params.paddle2 = v[2];
        if (Math.abs(v[3] - params.lastKnob[3]) > 1e-6) params.difficulty = v[3];
        params.lastKnob = [v[0], v[1], v[2], v[3]];
    }
    if (input && input.btnPressed) {
        if (input.btnPressed[0]) params.paddle1 = 0.5;
        if (input.btnPressed[1]) params.hue = 0.0;
        if (input.btnPressed[2]) params.paddle2 = 0.5;
        if (input.btnPressed[3]) params.difficulty = 0.3;
    }

    // falm forrige frame, gir glow/trail på splatter og bevegelse
    for (let i = 0; i < params.buf.length; i++) params.buf[i] *= DECAY;

    params.timeSinceScore += dt;

    const ball = params.ball;
    const dirLen = Math.hypot(ball.vx, ball.vy) || 1;
    const targetSpeed = Math.min(MAX_SPEED,
        (BASE_SPEED + params.difficulty * 40) + params.timeSinceScore * SPEED_RAMP);
    const scale = targetSpeed / dirLen;
    ball.vx *= (1 + (scale - 1) * Math.min(1, dt * 3));
    ball.vy *= (1 + (scale - 1) * Math.min(1, dt * 3));

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.y <= 2) { ball.y = 2; ball.vy *= -1; spawnSplatter(params, ball.x, ball.y, params.hue); }
    if (ball.y >= PANEL_H - 2) { ball.y = PANEL_H - 2; ball.vy *= -1; spawnSplatter(params, ball.x, ball.y, params.hue); }

    const p1y = params.paddle1 * (PANEL_H - PADDLE_H) + PADDLE_H / 2;
    const p2y = params.paddle2 * (PANEL_H - PADDLE_H) + PADDLE_H / 2;
    const p1x = PADDLE_MARGIN;
    const p2x = PANEL_W - PADDLE_MARGIN - PADDLE_W;

    if (ball.x - ball.size <= p1x + PADDLE_W && ball.x > p1x &&
        ball.y >= p1y - PADDLE_H / 2 && ball.y <= p1y + PADDLE_H / 2 && ball.vx < 0) {
        ball.x = p1x + PADDLE_W + ball.size;
        const rel = (ball.y - p1y) / (PADDLE_H / 2);
        ball.vx = Math.abs(ball.vx);
        ball.vy += rel * 30;
        spawnSplatter(params, ball.x, ball.y, params.hue);
    }
    if (ball.x + ball.size >= p2x && ball.x < p2x + PADDLE_W &&
        ball.y >= p2y - PADDLE_H / 2 && ball.y <= p2y + PADDLE_H / 2 && ball.vx > 0) {
        ball.x = p2x - ball.size;
        const rel = (ball.y - p2y) / (PADDLE_H / 2);
        ball.vx = -Math.abs(ball.vx);
        ball.vy += rel * 30;
        spawnSplatter(params, ball.x, ball.y, params.hue);
    }

    if (ball.x < -4) { params.score.p2++; spawnSplatter(params, 2, ball.y, params.hue); resetBall(params, 1); }
    if (ball.x > PANEL_W + 4) { params.score.p1++; spawnSplatter(params, PANEL_W - 2, ball.y, params.hue); resetBall(params, -1); }

    for (const p of params.particles) {
        p.age += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.96;
        p.vy *= 0.96;
    }
    params.particles = params.particles.filter(p => p.age < p.life);

    // -- tegn alt inn i bufferet --

    // midtlinje, stiplet
    for (let y = 0; y < PANEL_H; y += 6) {
        setBuf(params, PANEL_W / 2, y, 30, 30, 30);
        setBuf(params, PANEL_W / 2, y + 1, 30, 30, 30);
    }

    // score, øverst, side ved side (liggende layout)
    drawDigit(params, PANEL_W / 2 - 10, 3, Math.min(9, params.score.p1), 232, 230, 225);
    drawDigit(params, PANEL_W / 2 + 6, 3, Math.min(9, params.score.p2), 232, 230, 225);

    const [pr, pg, pb] = hsvToRgb(params.hue, 0.55, 1);
    for (let dy = -PADDLE_H / 2; dy < PADDLE_H / 2; dy++) {
        for (let dx = 0; dx < PADDLE_W; dx++) {
            setBuf(params, p1x + dx, p1y + dy, pr, pg, pb);
            setBuf(params, p2x + dx, p2y + dy, pr, pg, pb);
        }
    }

    const [br, bg, bb] = hsvToRgb((params.hue + 0.5) % 1, 0.4, 1);
    for (let dy = 0; dy < ball.size; dy++) {
        for (let dx = 0; dx < ball.size; dx++) {
            setBuf(params, ball.x - ball.size / 2 + dx, ball.y - ball.size / 2 + dy, br, bg, bb);
        }
    }

    // splatter, additiv slik at overlapp lyser sterkere, falmer via age og buffer-decay sammen
    for (const p of params.particles) {
        const t = p.age / p.life;
        const alpha = (1 - t) * (1 - t * 0.3);
        const [r, g, b] = hsvToRgb(p.hue, 0.7, 1);
        addBuf(params, p.x, p.y, r * alpha, g * alpha, b * alpha);
    }
}

export function draw(display, params, time) {
    for (let y = 0; y < PANEL_H; y++) {
        for (let x = 0; x < PANEL_W; x++) {
            const idx = (y * PANEL_W + x) * 3;
            display.setPixel(x, y, params.buf[idx] | 0, params.buf[idx + 1] | 0, params.buf[idx + 2] | 0);
        }
    }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
