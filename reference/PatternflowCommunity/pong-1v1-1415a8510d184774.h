#pragma once
#include <Arduino.h>
#include <math.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_math.h"
#include "src/core_color.h"

namespace PongPattern {

const char* NAME = "Pong 1v1";
const char* const KNOB_LABELS[4] = {"PADDLE S1", "FARGE", "PADDLE S2", "VANSKELIGHET"};

// Avviker fra standard Hue/Speed/Warp/Zoom siden dette er et 1v1-spill, ikke en ambient visual:
// Knob 1: Paddle spiller 1 · Knob 2: Farge · Knob 3: Paddle spiller 2 · Knob 4: Vanskelighet
// Paddlene ligger på knob 1 og 3 (ikke 1 og 2) for mer fysisk avstand mellom hendene.

const float PONG_PADDLE_MIN  = 0.0f;
const float PONG_PADDLE_MAX  = 1.0f;
const float PONG_PADDLE_STEP = 0.035f;

const float PONG_DIFF_MIN  = 0.0f;
const float PONG_DIFF_MAX  = 1.0f;
const float PONG_DIFF_STEP = 0.03f;

const float PONG_HUE_STEP = 0.05f;

const int   PONG_PADDLE_H      = 12;
const int   PONG_PADDLE_W      = 2;
const int   PONG_PADDLE_MARGIN = 4;
const float PONG_BASE_SPEED    = 34.0f;
const float PONG_MAX_SPEED     = 130.0f;
const float PONG_SPEED_RAMP    = 6.0f;
const int   PONG_BALL_SIZE     = 2;
const float PONG_DECAY         = 0.80f; // falmetempo på splatter-glowbuffer
const int   PONG_MAX_PARTICLES = 160;

struct Particle {
    float x, y, vx, vy;
    float age, life, size, hue;
    bool  active;
};

struct Params {
    float paddle1;
    float paddle2;
    float hue;
    float difficulty;

    float ballX, ballY, ballVX, ballVY;
    int   scoreP1;
    int   scoreP2;
    float timeSinceScore;

    Particle particles[PONG_MAX_PARTICLES];
    uint8_t  buf[PANEL_RES_W * PANEL_RES_H * 3];
};

Params params;

static void resetBall(float dir) {
    params.ballX = PANEL_RES_W / 2.0f;
    params.ballY = PANEL_RES_H / 2.0f;
    float baseSpd = PONG_BASE_SPEED + params.difficulty * 40.0f;
    float angle = ((float)rand() / (float)RAND_MAX) * 0.6f - 0.3f;
    params.ballVX = baseSpd * dir * PFMath::fastCos(angle);
    params.ballVY = baseSpd * PFMath::fastSin(angle) * 2.0f;
    params.timeSinceScore = 0.0f;
}

static void spawnParticle(float x, float y, float vx, float vy, float life, float size, float hue) {
    // finn ledig slot, overskriv eldste aktive hvis full. Ingen dynamisk allokering.
    int slot = 0;
    float oldestAge = -1.0f;
    bool found = false;
    for (int i = 0; i < PONG_MAX_PARTICLES; i++) {
        if (!params.particles[i].active) { slot = i; found = true; break; }
        if (params.particles[i].age > oldestAge) { oldestAge = params.particles[i].age; slot = i; }
    }
    (void)found;
    Particle& pt = params.particles[slot];
    pt.x = x; pt.y = y; pt.vx = vx; pt.vy = vy;
    pt.age = 0.0f; pt.life = life; pt.size = size; pt.hue = hue;
    pt.active = true;
}

static void spawnSplatter(float x, float y, float hue) {
    for (int i = 0; i < 46; i++) {
        float a = ((float)rand() / (float)RAND_MAX) * 6.2831853f;
        float spd = 20.0f + ((float)rand() / (float)RAND_MAX) * 90.0f;
        float h = fmodf(hue + (((float)rand() / (float)RAND_MAX) * 0.16f - 0.08f) + 1.0f, 1.0f);
        spawnParticle(x, y, PFMath::fastCos(a) * spd, PFMath::fastSin(a) * spd,
                      0.5f + ((float)rand() / (float)RAND_MAX) * 0.55f,
                      1.0f + ((float)rand() / (float)RAND_MAX) * 2.2f, h);
    }
    for (int i = 0; i < 18; i++) {
        float a = ((float)i / 18.0f) * 6.2831853f;
        float spd = 55.0f + ((float)rand() / (float)RAND_MAX) * 15.0f;
        float h = fmodf(hue + 0.5f + ((float)rand() / (float)RAND_MAX) * 0.05f, 1.0f);
        spawnParticle(x, y, PFMath::fastCos(a) * spd, PFMath::fastSin(a) * spd,
                      0.35f + ((float)rand() / (float)RAND_MAX) * 0.2f, 1.4f, h);
    }
}

static inline void setBuf(int x, int y, uint8_t r, uint8_t g, uint8_t b) {
    if (x < 0 || x >= PANEL_RES_W || y < 0 || y >= PANEL_RES_H) return;
    int idx = (y * PANEL_RES_W + x) * 3;
    params.buf[idx] = r; params.buf[idx + 1] = g; params.buf[idx + 2] = b;
}

static inline void addBuf(int x, int y, float r, float g, float b) {
    if (x < 0 || x >= PANEL_RES_W || y < 0 || y >= PANEL_RES_H) return;
    int idx = (y * PANEL_RES_W + x) * 3;
    params.buf[idx]     = (uint8_t)fminf(255.0f, params.buf[idx]     + r);
    params.buf[idx + 1] = (uint8_t)fminf(255.0f, params.buf[idx + 1] + g);
    params.buf[idx + 2] = (uint8_t)fminf(255.0f, params.buf[idx + 2] + b);
}

static const uint8_t DIGIT_GLYPHS[10][15] = {
    {1,1,1, 1,0,1, 1,0,1, 1,0,1, 1,1,1},
    {0,1,0, 1,1,0, 0,1,0, 0,1,0, 1,1,1},
    {1,1,1, 0,0,1, 1,1,1, 1,0,0, 1,1,1},
    {1,1,1, 0,0,1, 1,1,1, 0,0,1, 1,1,1},
    {1,0,1, 1,0,1, 1,1,1, 0,0,1, 0,0,1},
    {1,1,1, 1,0,0, 1,1,1, 0,0,1, 1,1,1},
    {1,1,1, 1,0,0, 1,1,1, 1,0,1, 1,1,1},
    {1,1,1, 0,0,1, 0,1,0, 0,1,0, 0,1,0},
    {1,1,1, 1,0,1, 1,1,1, 1,0,1, 1,1,1},
    {1,1,1, 1,0,1, 1,1,1, 0,0,1, 1,1,1}
};

static void drawDigit(int x, int y, int n, uint8_t r, uint8_t g, uint8_t b) {
    if (n < 0 || n > 9) n = 0;
    for (int row = 0; row < 5; row++) {
        for (int col = 0; col < 3; col++) {
            if (DIGIT_GLYPHS[n][row * 3 + col]) setBuf(x + col, y + row, r, g, b);
        }
    }
}

void setup() {
    PFMath::buildSinLUT();
    memset(params.buf, 0, sizeof(params.buf));
    for (int i = 0; i < PONG_MAX_PARTICLES; i++) params.particles[i].active = false;
    params.paddle1 = 0.5f;
    params.paddle2 = 0.5f;
    params.hue = 0.0f;
    params.difficulty = 0.3f;
    params.scoreP1 = 0;
    params.scoreP2 = 0;
    resetBall((rand() % 2 == 0) ? 1.0f : -1.0f);
}

void update(float dt, const InputFrame& input) {
    params.paddle1 = constrain(params.paddle1 + input.knobDeltas[0] * PONG_PADDLE_STEP, PONG_PADDLE_MIN, PONG_PADDLE_MAX);
    params.paddle2 = constrain(params.paddle2 + input.knobDeltas[2] * PONG_PADDLE_STEP, PONG_PADDLE_MIN, PONG_PADDLE_MAX);

    params.hue += input.knobDeltas[1] * PONG_HUE_STEP;
    params.hue = fmodf(params.hue, 1.0f);
    if (params.hue < 0.0f) params.hue += 1.0f;

    params.difficulty = constrain(params.difficulty + input.knobDeltas[3] * PONG_DIFF_STEP, PONG_DIFF_MIN, PONG_DIFF_MAX);

    // kort trykk på encoder: resett den knobben til origin, samme prinsipp som andre patterns
    if (input.btnPressed[0]) params.paddle1 = 0.5f;
    if (input.btnPressed[1]) params.hue = 0.0f;
    if (input.btnPressed[2]) params.paddle2 = 0.5f;
    if (input.btnPressed[3]) params.difficulty = 0.3f;

    params.timeSinceScore += dt;

    float dirLen = sqrtf(params.ballVX * params.ballVX + params.ballVY * params.ballVY);
    if (dirLen < 0.0001f) dirLen = 1.0f;
    float targetSpeed = PONG_BASE_SPEED + params.difficulty * 40.0f + params.timeSinceScore * PONG_SPEED_RAMP;
    if (targetSpeed > PONG_MAX_SPEED) targetSpeed = PONG_MAX_SPEED;
    float scale = targetSpeed / dirLen;
    float lerp = fminf(1.0f, dt * 3.0f);
    params.ballVX *= (1.0f + (scale - 1.0f) * lerp);
    params.ballVY *= (1.0f + (scale - 1.0f) * lerp);

    params.ballX += params.ballVX * dt;
    params.ballY += params.ballVY * dt;

    if (params.ballY <= 2.0f) { params.ballY = 2.0f; params.ballVY *= -1.0f; spawnSplatter(params.ballX, params.ballY, params.hue); }
    if (params.ballY >= PANEL_RES_H - 2.0f) { params.ballY = PANEL_RES_H - 2.0f; params.ballVY *= -1.0f; spawnSplatter(params.ballX, params.ballY, params.hue); }

    float p1y = params.paddle1 * (PANEL_RES_H - PONG_PADDLE_H) + PONG_PADDLE_H / 2.0f;
    float p2y = params.paddle2 * (PANEL_RES_H - PONG_PADDLE_H) + PONG_PADDLE_H / 2.0f;
    float p1x = (float)PONG_PADDLE_MARGIN;
    float p2x = (float)(PANEL_RES_W - PONG_PADDLE_MARGIN - PONG_PADDLE_W);

    if (params.ballX - PONG_BALL_SIZE / 2.0f <= p1x + PONG_PADDLE_W && params.ballX > p1x &&
        params.ballY >= p1y - PONG_PADDLE_H / 2.0f && params.ballY <= p1y + PONG_PADDLE_H / 2.0f && params.ballVX < 0) {
        params.ballX = p1x + PONG_PADDLE_W + PONG_BALL_SIZE / 2.0f;
        float rel = (params.ballY - p1y) / (PONG_PADDLE_H / 2.0f);
        params.ballVX = fabsf(params.ballVX);
        params.ballVY += rel * 30.0f;
        spawnSplatter(params.ballX, params.ballY, params.hue);
    }
    if (params.ballX + PONG_BALL_SIZE / 2.0f >= p2x && params.ballX < p2x + PONG_PADDLE_W &&
        params.ballY >= p2y - PONG_PADDLE_H / 2.0f && params.ballY <= p2y + PONG_PADDLE_H / 2.0f && params.ballVX > 0) {
        params.ballX = p2x - PONG_BALL_SIZE / 2.0f;
        float rel = (params.ballY - p2y) / (PONG_PADDLE_H / 2.0f);
        params.ballVX = -fabsf(params.ballVX);
        params.ballVY += rel * 30.0f;
        spawnSplatter(params.ballX, params.ballY, params.hue);
    }

    if (params.ballX < -4.0f) {
        params.scoreP2++;
        spawnSplatter(2.0f, params.ballY, params.hue);
        resetBall(1.0f);
    }
    if (params.ballX > PANEL_RES_W + 4.0f) {
        params.scoreP1++;
        spawnSplatter(PANEL_RES_W - 2.0f, params.ballY, params.hue);
        resetBall(-1.0f);
    }

    for (int i = 0; i < PONG_MAX_PARTICLES; i++) {
        Particle& pt = params.particles[i];
        if (!pt.active) continue;
        pt.age += dt;
        if (pt.age >= pt.life) { pt.active = false; continue; }
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.vx *= 0.96f;
        pt.vy *= 0.96f;
    }
}

void draw() {
    // falm forrige frame, gir glow/trail-effekt på splatteren uten alpha-blending i setPixel
    for (int i = 0; i < PANEL_RES_W * PANEL_RES_H * 3; i++) {
        params.buf[i] = (uint8_t)(params.buf[i] * PONG_DECAY);
    }

    // midtlinje, stiplet
    for (int y = 0; y < PANEL_RES_H; y += 6) {
        setBuf(PANEL_RES_W / 2, y,     30, 30, 30);
        setBuf(PANEL_RES_W / 2, y + 1, 30, 30, 30);
    }

    // score, øverst, side ved side (liggende layout)
    drawDigit(PANEL_RES_W / 2 - 10, 3, params.scoreP1 > 9 ? 9 : params.scoreP1, 232, 230, 225);
    drawDigit(PANEL_RES_W / 2 + 6,  3, params.scoreP2 > 9 ? 9 : params.scoreP2, 232, 230, 225);

    uint8_t pr, pg, pb;
    PFColor::hsvToRgb(params.hue, 0.55f, 1.0f, pr, pg, pb);

    float p1y = params.paddle1 * (PANEL_RES_H - PONG_PADDLE_H) + PONG_PADDLE_H / 2.0f;
    float p2y = params.paddle2 * (PANEL_RES_H - PONG_PADDLE_H) + PONG_PADDLE_H / 2.0f;
    int p1x = PONG_PADDLE_MARGIN;
    int p2x = PANEL_RES_W - PONG_PADDLE_MARGIN - PONG_PADDLE_W;

    for (int dy = -PONG_PADDLE_H / 2; dy < PONG_PADDLE_H / 2; dy++) {
        for (int dx = 0; dx < PONG_PADDLE_W; dx++) {
            setBuf(p1x + dx, (int)p1y + dy, pr, pg, pb);
            setBuf(p2x + dx, (int)p2y + dy, pr, pg, pb);
        }
    }

    uint8_t br, bg, bb;
    PFColor::hsvToRgb(fmodf(params.hue + 0.5f, 1.0f), 0.4f, 1.0f, br, bg, bb);
    int bx = (int)(params.ballX - PONG_BALL_SIZE / 2.0f);
    int by = (int)(params.ballY - PONG_BALL_SIZE / 2.0f);
    for (int dy = 0; dy < PONG_BALL_SIZE; dy++) {
        for (int dx = 0; dx < PONG_BALL_SIZE; dx++) {
            setBuf(bx + dx, by + dy, br, bg, bb);
        }
    }

    // splatter, additiv slik at overlapp lyser sterkere
    for (int i = 0; i < PONG_MAX_PARTICLES; i++) {
        Particle& pt = params.particles[i];
        if (!pt.active) continue;
        float t = pt.age / pt.life;
        float alpha = (1.0f - t) * (1.0f - t * 0.3f);
        uint8_t r, g, b;
        PFColor::hsvToRgb(pt.hue, 0.7f, 1.0f, r, g, b);
        addBuf((int)pt.x, (int)pt.y, r * alpha, g * alpha, b * alpha);
    }

    for (int y = 0; y < PANEL_RES_H; y++) {
        for (int x = 0; x < PANEL_RES_W; x++) {
            int idx = (y * PANEL_RES_W + x) * 3;
            PFCanvas::setPixel(x, y, params.buf[idx], params.buf[idx + 1], params.buf[idx + 2]);
        }
    }
    PFCanvas::present();
}

} // namespace PongPattern