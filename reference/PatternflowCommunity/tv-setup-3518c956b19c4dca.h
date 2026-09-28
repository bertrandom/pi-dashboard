#pragma once

// ===== Patternflow pattern =====
// Title:   TV setup
// Seven broadcast test cards with a tunable vertical hold, a sweeping hum
// bar, snow and RGB convergence error.
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_params.h"
#include "src/core_math.h"
#include "src/core_color.h"
#include "src/core_noise.h"
#include "src/core_mem.h"

namespace TvTestCard {

const char* NAME = "TV setup";
const char* const KNOB_LABELS[4] = {"Channel", "Interference", "Noise", "Aberration"};
constexpr bool ABSOLUTE_READY = true;

// ---------------------------------------------------------------- constants

static constexpr float TVT_STEP_CHANNEL      = 0.146f;
static constexpr float TVT_STEP_INTERFERENCE = 0.083f;
static constexpr float TVT_STEP_NOISE        = 0.021f;
static constexpr float TVT_STEP_ABERRATION   = 0.042f;

static constexpr int   TVT_CHANNELS = 7;
static constexpr float TVT_CX = (PANEL_RES_W - 1) * 0.5f;
static constexpr float TVT_CY = (PANEL_RES_H - 1) * 0.5f;
static constexpr int   TVT_PIX = PANEL_RES_W * PANEL_RES_H;

// t only ever feeds fastSin through the multipliers 0.9, 3.1, 0.7, 0.12, 0.19
// and the noise frame counter 30. Every one of those times 100 is a whole
// number of cycles, so wrapping at 100 s is seamless.
static constexpr float TVT_T_PERIOD = 100.0f;

// ---------------------------------------------------------------- knob state

// Channel starts at 1.8: card 3 (FuBK), detuned by -0.2 so the set boots
// out of sync and has to be tuned in. Every channel still has a reachable
// lock detent on the grid anchored here; the tightest is 1.0708 for card 2.
static float knobChannel      = 1.8f;
static float knobInterference = 1.002f;
static float knobNoise        = 0.49f;
static float knobAberration   = 0.596f;

static float humAmt    = 0.2505f;
static float snowAmt   = 0.49f;
static float fringeAmt = 0.596f;

// ---------------------------------------------------------------- run state

static float tAcc     = 0.0f;
static int   chanIdx  = 2;
static float detune   = -0.2f;
static float lockE    = 0.0f;   // 0 = channel held, 1 = fully off tune
static float vphase   = 0.0f;
static float gPrev    = 0.0f;
static float holdOff  = 0.0f;
static float tearAmt  = 0.0f;
static float rollPos  = 0.0f;
static float rollVel  = 34.0f;  // tune in on load, the way a set warms up
static float swAmt    = 0.85f;
static float flashAmt = 1.0f;
static uint32_t lcgState = 20260921u;

// ---------------------------------------------------------------- buffers

// The card is rendered once per frame, then resampled with per-row shift and
// per-column convergence offsets, so it needs a real framebuffer.
static float* card = nullptr;

static int16_t rowShift[PANEL_RES_H];
static float   rowGain[PANEL_RES_H];
static int16_t rowOff[PANEL_RES_H];
static int16_t colOff[PANEL_RES_W];
static float   colDx2[PANEL_RES_W];      // (x - centre)^2, baked in setup
static uint8_t huePal[PANEL_RES_W * 3];  // hue sweep column palette

// 75 % EBU bars, then the reversed chroma row underneath them
static const uint8_t TVT_BARS75[24] = {
    191, 191, 191,  191, 191,   0,    0, 191, 191,    0, 191,   0,
    191,   0, 191,  191,   0,   0,    0,   0, 191,    0,   0,   0,
};
static const uint8_t TVT_BARSREV[24] = {
      0,   0, 191,   14,  14,  14,  191,   0, 191,   14,  14,  14,
      0, 191, 191,   14,  14,  14,  191, 191, 191,    0,   0,   0,
};
// FuBK rows: 75 % bars ending in grey, then 100 % bars ending in black
static const uint8_t TVT_FUBK_TOP[24] = {
    191, 191, 191,  191, 191,   0,    0, 191, 191,    0, 191,   0,
    191,   0, 191,  191,   0,   0,    0,   0, 191,   72,  72,  72,
};
static const uint8_t TVT_FUBK_100[24] = {
    245, 238, 238,  255, 255,   0,    0, 255, 255,    0, 220,   0,
    255,   0, 255,  235,   0,   0,    0,   0, 255,    0,   0,   0,
};
static const uint8_t TVT_BURST[7] = {4, 3, 2, 1, 2, 3, 4};

// 5x7 glyphs: P, F
static const uint8_t TVT_GLYPHS[14] = {
    0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10,
    0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10,
};

// ---------------------------------------------------------------- helpers

static inline void put(int x, int y, float r, float g, float b) {
    const int i = (y * PANEL_RES_W + x) * 3;
    card[i] = r;
    card[i + 1] = g;
    card[i + 2] = b;
}

static inline void putGrey(int x, int y, float v) {
    const int i = (y * PANEL_RES_W + x) * 3;
    card[i] = v;
    card[i + 1] = v;
    card[i + 2] = v;
}

static inline uint8_t to8(float v) {
    if (v <= 0.0f) return 0;
    if (v >= 255.0f) return 255;
    return (uint8_t)(int)v;
}

static inline int iround(float v) {
    return PFMath::ifloor(v + 0.5f);
}

// Plain LCG for the retune shake. Runs a handful of times per channel change,
// never per pixel.
static inline float rnd01() {
    lcgState = lcgState * 1664525u + 1013904223u;
    return (float)((lcgState >> 8) & 0xFFFFFFu) * (1.0f / 16777216.0f);
}

static void retune() {
    swAmt = 1.0f;
    flashAmt = 1.0f;
    const float v = 48.0f + rnd01() * 62.0f;
    rollVel = (rnd01() < 0.5f) ? -v : v;
}

// ---------------------------------------------------------------- test cards

// 0 - EBU / SMPTE colour bars
static void cardBars() {
    for (int y = 0; y < PANEL_RES_H; y++) {
        for (int x = 0; x < PANEL_RES_W; x++) {
            const int c = (x >> 4) * 3;
            if (y < 42) {
                put(x, y, TVT_BARS75[c], TVT_BARS75[c + 1], TVT_BARS75[c + 2]);
            } else if (y < 49) {
                put(x, y, TVT_BARSREV[c], TVT_BARSREV[c + 1], TVT_BARSREV[c + 2]);
            } else if (x < 16)  { put(x, y, 0.0f, 33.0f, 76.0f); }      // -I
            else if (x < 32)    { put(x, y, 255.0f, 255.0f, 255.0f); }  // 100 % white
            else if (x < 48)    { put(x, y, 61.0f, 0.0f, 92.0f); }      // +Q
            else if (x < 80)    { putGrey(x, y, 14.0f); }
            else if (x < 91)    { putGrey(x, y, 3.0f); }                // PLUGE -
            else if (x < 101)   { putGrey(x, y, 14.0f); }               // PLUGE 0
            else if (x < 112)   { putGrey(x, y, 30.0f); }               // PLUGE +
            else                { putGrey(x, y, 14.0f); }
        }
    }
}

// 1 - Philips PM5544 style card
static void cardPhilips() {
    const int botCast = PANEL_RES_H - 4;
    for (int y = 0; y < PANEL_RES_H; y++) {
        const float dy = (float)y - TVT_CY;
        const float dy2 = dy * dy;
        for (int x = 0; x < PANEL_RES_W; x++) {
            const float r2 = colDx2[x] + dy2;
            float r = 16.0f, g = 16.0f, b = 24.0f;
            if ((x & 7) == 0 || (y & 7) == 0) { r = 96.0f; g = 96.0f; b = 106.0f; }
            if (r2 > 720.0f && r2 < 860.0f) { r = 228.0f; g = 228.0f; b = 232.0f; }
            if (y < 3 || y > botCast) {                       // castellations
                const float v = ((x >> 3) & 1) ? 235.0f : 4.0f;
                r = v; g = v; b = v;
            }
            if (y >= 24 && y < 40) {                          // colour band
                const int c = (x >> 4) * 3;
                r = TVT_BARS75[c]; g = TVT_BARS75[c + 1]; b = TVT_BARS75[c + 2];
                if (x >= 48 && x < 80) {
                    const bool edge = (x == 48 || x == 79 || y == 24 || y == 39);
                    const float v = edge ? 220.0f : 2.0f;
                    r = v; g = v; b = v;
                }
            }
            put(x, y, r, g, b);
        }
    }
    for (int i = 0; i < 2; i++) {                             // "PF" nameplate
        const int ox = 55 + i * 11;
        for (int gy = 0; gy < 7; gy++) {
            const uint8_t row = TVT_GLYPHS[i * 7 + gy];
            for (int gx = 0; gx < 5; gx++) {
                if ((row >> (4 - gx)) & 1) putGrey(ox + gx, 28 + gy, 235.0f);
            }
        }
    }
}

// 2 - FuBK / PM5644 full service card
static void cardFubk() {
    for (int y = 0; y < PANEL_RES_H; y++) {                   // grid field + circle
        const float dy = (float)y - TVT_CY;
        const float dy2 = dy * dy;
        for (int x = 0; x < PANEL_RES_W; x++) {
            const float r2 = colDx2[x] + dy2;
            if (r2 > 806.0f && r2 < 930.0f) put(x, y, 240.0f, 232.0f, 232.0f);
            else putGrey(x, y, ((x & 7) == 0 || (y & 7) == 0) ? 170.0f : 120.0f);
        }
    }
    for (int y = 4; y < 11; y++) {                            // upper nameplate
        if (y == 7) continue;
        for (int x = 54; x < 75; x++) put(x, y, 34.0f, 34.0f, 38.0f);
    }
    for (int y = 53; y < 60; y++) {                           // lower nameplate
        if (y == 56) continue;
        for (int x = 54; x < 75; x++) put(x, y, 34.0f, 34.0f, 38.0f);
    }
    for (int y = 15; y < 24; y++) {                           // 75 % bars
        for (int x = 0; x < PANEL_RES_W; x++) {
            const int c = (x >> 4) * 3;
            put(x, y, TVT_FUBK_TOP[c], TVT_FUBK_TOP[c + 1], TVT_FUBK_TOP[c + 2]);
        }
    }
    for (int y = 24; y < 29; y++) {                           // greyscale staircase
        for (int x = 0; x < PANEL_RES_W; x++) putGrey(x, y, (float)((x >> 4) * 255 / 7));
    }
    for (int y = 29; y < 33; y++) {                           // chroma checks
        for (int x = 30; x < 98; x++) {
            const int k = (x - 30) / 3;
            if (k & 1) { putGrey(x, y, 6.0f); }
            else {
                const int c = (((k >> 1) % 6) + 1) * 3;
                put(x, y, TVT_FUBK_100[c], TVT_FUBK_100[c + 1], TVT_FUBK_100[c + 2]);
            }
        }
    }
    for (int y = 33; y < 38; y++) {                           // black boxes + grey block
        for (int x = 22; x < 56; x++) putGrey(x, y, 4.0f);
        for (int x = 56; x < 72; x++) putGrey(x, y, 120.0f);
        for (int x = 72; x < 106; x++) putGrey(x, y, 4.0f);
    }
    for (int i = 0; i < 34; i++) {                            // the two diagonals
        const int d = (i * 4) / 33;
        putGrey(22 + i, 37 - d, 235.0f);
        putGrey(72 + i, 33 + d, 235.0f);
    }
    for (int y = 38; y < 42; y++) {                           // green - white - magenta
        for (int x = 30; x < 98; x++) {
            const float t = (float)(x - 30) * (1.0f / 67.0f);
            if (t < 0.5f) {
                const float u = (float)(int)(510.0f * t);
                put(x, y, u, 255.0f, u);
            } else {
                const float u = (float)(int)(255.0f - 510.0f * (t - 0.5f));
                put(x, y, 255.0f, u, 255.0f);
            }
        }
    }
    for (int s = 0; s < 7; s++) {                             // multiburst
        const int x0 = 2 + s * 18;
        const int per = TVT_BURST[s];
        for (int y = 42; y < 46; y++) {
            for (int x = x0; x < x0 + 18 && x < PANEL_RES_W; x++) {
                putGrey(x, y, (((x - x0) / per) & 1) ? 8.0f : 250.0f);
            }
        }
    }
    for (int y = 46; y < 53; y++) {                           // 100 % bars
        for (int x = 0; x < PANEL_RES_W; x++) {
            const int c = (x >> 4) * 3;
            put(x, y, TVT_FUBK_100[c], TVT_FUBK_100[c + 1], TVT_FUBK_100[c + 2]);
        }
    }
    for (int d = 0; d < 4; d++) {                             // corner aspect discs
        const int cx = (d & 1) ? (PANEL_RES_W - 14) : 13;
        const int cy = (d < 2) ? 8 : (PANEL_RES_H - 7);
        const int rr = (d < 2) ? 30 : 20;
        for (int y = cy - 6; y <= cy + 6; y++) {
            if (y < 0 || y >= PANEL_RES_H) continue;
            const int ey = y - cy;
            for (int x = cx - 6; x <= cx + 6; x++) {
                if (x < 0 || x >= PANEL_RES_W) continue;
                const int ex = x - cx;
                if (ex * ex + ey * ey > rr) continue;
                putGrey(x, y, (x & 1) ? 62.0f : 242.0f);
            }
        }
    }
    for (int y = 0; y < PANEL_RES_H; y++) {                   // side castellation
        const float v = ((y >> 3) & 1) ? 6.0f : 245.0f;
        for (int k = 0; k < 3; k++) {
            putGrey(k, y, v);
            putGrey(PANEL_RES_W - 3 + k, y, v);
        }
    }
    for (int x = 0; x < PANEL_RES_W; x++) {                   // top/bottom castellation
        const float v = ((x >> 3) & 1) ? 6.0f : 245.0f;
        for (int k = 0; k < 3; k++) {
            putGrey(x, k, v);
            putGrey(x, PANEL_RES_H - 3 + k, v);
        }
    }
}

// 3 - Monoscope: crosshatch, circle, frequency bursts
static void cardMono() {
    const int cxA = PANEL_RES_W / 2 - 1, cxB = PANEL_RES_W / 2;
    const int cyA = PANEL_RES_H / 2 - 1, cyB = PANEL_RES_H / 2;
    for (int y = 0; y < PANEL_RES_H; y++) {
        const float dy = (float)y - TVT_CY;
        const float dy2 = dy * dy;
        for (int x = 0; x < PANEL_RES_W; x++) {
            const float r2 = colDx2[x] + dy2;
            float v = 0.0f;
            if ((x & 7) == 4 || (y & 7) == 4) v = 150.0f;
            if (x == 0 || x == PANEL_RES_W - 1 || y == 0 || y == PANEL_RES_H - 1) v = 255.0f;
            if (r2 > 812.0f && r2 < 961.0f) v = 255.0f;
            if (x == cxA || x == cxB || y == cyA || y == cyB) v = 255.0f;
            putGrey(x, y, v);
        }
    }
    static const int per[4] = {4, 3, 2, 1};
    for (int k = 0; k < 4; k++) {
        const int x0 = 15 + k * 25;
        for (int y = 45; y < 56; y++) {
            for (int x = x0 - 2; x < x0; x++) putGrey(x, y, 0.0f);
            for (int x = x0; x < x0 + 23 && x < PANEL_RES_W; x++) {
                putGrey(x, y, (((x - x0) / per[k]) & 1) ? 255.0f : 0.0f);
            }
        }
    }
}

// 4 - Zone plate: sin(r^2), the moire generator
static void cardZone() {
    const float ph = tAcc * 0.12f;
    for (int y = 0; y < PANEL_RES_H; y++) {
        const float dy = (float)y - TVT_CY;
        const float dy2 = dy * dy;
        for (int x = 0; x < PANEL_RES_W; x++) {
            const float turns = PFMath::fract((colDx2[x] + dy2) * 0.0021f + ph);
            const float v = 0.5f + 0.5f * PFMath::fastSin(turns * TWO_PI);
            const float s = (float)(int)(v * 255.0f);
            put(x, y, (float)(int)(s * 0.88f), s, (float)(int)(s * 0.96f));
        }
    }
}

// 5 - Greyscale staircase, ramp and hue sweep
static void cardGrey() {
    for (int y = 0; y < PANEL_RES_H; y++) {
        for (int x = 0; x < PANEL_RES_W; x++) {
            if (y < 20) {
                putGrey(x, y, (float)((x >> 4) * 255 / 7));
            } else if (y == 20 || y == 41) {
                putGrey(x, y, 0.0f);
            } else if (y < 41) {
                putGrey(x, y, (float)((x * 255) / (PANEL_RES_W - 1)));
            } else {
                const int c = x * 3;
                put(x, y, huePal[c], huePal[c + 1], huePal[c + 2]);
            }
        }
    }
}

// 6 - No signal
static void cardSnow() {
    const int f = PFMath::ifloor(tAcc * 30.0f);
    for (int y = 0; y < PANEL_RES_H; y++) {
        const float streak = 0.72f + 0.56f * PFNoise::cellHash(911, y, f);
        for (int x = 0; x < PANEL_RES_W; x++) {
            const float n = PFNoise::cellHash(x, y, f);
            float v = (28.0f + n * 214.0f) * streak;
            if (v > 255.0f) v = 255.0f;
            const float g = (float)(int)v;
            const float c = PFNoise::cellHash(x + 7, y, f + 3);
            put(x, y,
                (c > 0.94f) ? (float)(int)(g * 0.72f) : g,
                g,
                (c < 0.06f) ? (float)(int)(g * 0.78f) : g);
        }
    }
}

// ---------------------------------------------------------------- lifecycle

void setup() {
    PFMath::buildSinLUT();
    if (!card) card = PFMem::allocFloats(TVT_PIX * 3);

    for (int x = 0; x < PANEL_RES_W; x++) {
        const float dx = (float)x - TVT_CX;
        colDx2[x] = dx * dx;
    }
    for (int x = 0; x < PANEL_RES_W; x++) {
        uint8_t r, g, b;
        PFColor::hsvToRgb((float)x / (float)PANEL_RES_W, 1.0f, 1.0f, r, g, b);
        huePal[x * 3] = r;
        huePal[x * 3 + 1] = g;
        huePal[x * 3 + 2] = b;
    }
    for (int y = 0; y < PANEL_RES_H; y++) {
        rowShift[y] = 0;
        rowGain[y] = 1.0f;
        rowOff[y] = 0;
    }
    for (int x = 0; x < PANEL_RES_W; x++) colOff[x] = 0;

    tAcc = 0.0f;
    chanIdx = 2;
    detune = -0.2f;
    lockE = 0.0f;
    vphase = 0.0f;
    gPrev = 0.0f;
    holdOff = 0.0f;
    tearAmt = 0.0f;
    rollPos = 0.0f;
    rollVel = 34.0f;
    swAmt = 0.85f;
    flashAmt = 1.0f;
    lcgState = 20260921u;
}

void update(float dt, const InputFrame& input) {
    if (!card) return;
    if (dt > 0.1f) dt = 0.1f;

    PFParams::apply(input, 0, &knobChannel, 0.0f, 7.0f, TVT_STEP_CHANNEL);
    PFParams::apply(input, 1, &knobInterference, 0.0f, 4.0f, TVT_STEP_INTERFERENCE);
    PFParams::apply(input, 2, &knobNoise, 0.0f, 1.0f, TVT_STEP_NOISE);
    PFParams::apply(input, 3, &knobAberration, -1.0f, 1.0f, TVT_STEP_ABERRATION);

    if (input.btnPressed[0] && !input.paramAbsoluteActive[0] && !input.knobAudioActive[0]) {
        retune();
    }
    if (input.btnPressed[1] && !input.paramAbsoluteActive[1] && !input.knobAudioActive[1]) {
        knobInterference = 2.0f;
    }
    if (input.btnPressed[2] && !input.paramAbsoluteActive[2] && !input.knobAudioActive[2]) {
        knobNoise = 0.0f;
    }
    if (input.btnPressed[3] && !input.paramAbsoluteActive[3] && !input.knobAudioActive[3]) {
        knobAberration = 0.0f;
    }

    float raw = knobChannel;
    if (raw >= (float)TVT_CHANNELS) raw -= (float)TVT_CHANNELS;
    int ch = iround(raw);
    detune = raw - (float)ch;                 // -0.5 .. +0.5 around the lock point
    if (ch >= TVT_CHANNELS) ch -= TVT_CHANNELS;
    if (ch != chanIdx) { chanIdx = ch; retune(); }

    humAmt = knobInterference * 0.25f;
    snowAmt = knobNoise;
    fringeAmt = knobAberration;

    tAcc += dt;
    if (tAcc > TVT_T_PERIOD) tAcc -= TVT_T_PERIOD;

    // Vertical hold: off the lock point the frame creeps and then jumps a whole
    // field. The phase runs at a steady rate; raising it to the sixth power is
    // what makes the picture dwell and then bolt.
    const float ad = (detune < 0.0f) ? -detune : detune;
    float e = (ad - 0.10f) * 2.5f;            // (ad - 0.10) / 0.40
    e = PFMath::clamp01(e);
    lockE = e;
    if (e <= 0.0f) {
        vphase = 0.0f;
        gPrev = 0.0f;
        holdOff = 0.0f;
        tearAmt = 0.0f;
    } else {
        vphase = PFMath::fract(vphase + dt * (0.18f + 2.0f * e * e));
        const float u = vphase;
        const float u2 = u * u;
        const float u6 = u2 * u2 * u2;
        const float g = u6 + (u - u6) * e * e;
        float dg = g - gPrev;
        if (dg < -0.5f) dg += 1.0f;
        gPrev = g;
        if (dg < 0.0f) dg = -dg;
        tearAmt = (dg > 0.16f) ? 1.0f : dg * 6.25f;
        holdOff = ((detune < 0.0f) ? -(float)PANEL_RES_H : (float)PANEL_RES_H) * g;
    }

    if (swAmt > 0.0f) { swAmt -= dt / 0.6f; if (swAmt < 0.0f) swAmt = 0.0f; }
    if (flashAmt > 0.0f) { flashAmt -= dt / 0.09f; if (flashAmt < 0.0f) flashAmt = 0.0f; }

    float decay = 1.0f - dt * 4.0f;
    if (decay < 0.0f) decay = 0.0f;
    rollVel *= decay;
    rollPos += rollVel * dt;
    if (swAmt <= 0.0f && rollVel < 3.0f && rollVel > -3.0f) {
        const float target = (rollPos < PANEL_RES_H * 0.5f) ? 0.0f : (float)PANEL_RES_H;
        float k = dt * 8.0f;
        if (k > 1.0f) k = 1.0f;
        rollPos += (target - rollPos) * k;
    }
    rollPos = PFMath::jsMod(rollPos, (float)PANEL_RES_H);
    if (rollPos < 0.0f) rollPos += (float)PANEL_RES_H;
}

void draw() {
    if (!card) { PFCanvas::present(); return; }

    // 1. the card itself
    switch (chanIdx) {
        case 0:  cardBars();    break;
        case 1:  cardPhilips(); break;
        case 2:  cardFubk();    break;
        case 3:  cardMono();    break;
        case 4:  cardZone();    break;
        case 5:  cardGrey();    break;
        default: cardSnow();    break;
    }

    // 2. per-row interference, per-column convergence
    const float hum = humAmt;
    const float sw = swAmt;
    const float snow = snowAmt;
    const int frame = PFMath::ifloor(tAcc * 30.0f);

    const float bandH = 13.0f + 11.0f * hum;
    const float bandY = (PANEL_RES_H + 14.0f)
                      - PFMath::fract(tAcc * 0.19f) * (PANEL_RES_H + 40.0f);
    const float swing = PFMath::fastSin(tAcc * 0.7f * TWO_PI);
    const float flashGain = 1.0f + 0.75f * flashAmt;
    const float tear = tearAmt;

    for (int y = 0; y < PANEL_RES_H; y++) {
        const float fy = (float)y;
        const float d = (fy - bandY) / bandH;
        const bool inBand = (d > -1.0f && d < 1.0f);
        float env = 0.0f;
        if (inBand) { env = 1.0f - d * d; env *= env; }

        float s = PFMath::fastSin((tAcc * 0.9f + fy * 0.013f) * TWO_PI) * 1.1f
                + PFMath::fastSin((tAcc * 3.1f + fy * 0.11f) * TWO_PI) * 1.5f;
        s *= hum;
        s += env * hum * 20.0f * swing;

        // bright crest above the band, dark trough below - smooth, no seam
        float gain = 1.0f + hum * (inBand ? (-d * (1.0f - d * d) * 1.95f) : 0.0f);

        if (sw > 0.0f) {
            s += (PFNoise::cellHash(y, 31, frame) - 0.5f) * 26.0f * sw * sw;
            gain *= 1.0f - 0.35f * sw * PFNoise::cellHash(y, 57, frame);
        }
        if (tear > 0.0f) {
            s += (PFNoise::cellHash(y, 71, frame) - 0.5f) * 24.0f * tear;
            gain *= 1.0f - 0.3f * tear * PFNoise::cellHash(y, 83, frame);
        }
        if (snow > 0.0f && PFNoise::cellHash(y, 13, frame) < snow * 0.05f) {
            s += (PFNoise::cellHash(y, 99, frame) - 0.5f) * 34.0f;
            gain *= 0.45f;
        }
        rowShift[y] = (int16_t)iround(s);
        rowGain[y] = gain * flashGain;
        rowOff[y] = (int16_t)iround(fringeAmt * 1.8f * ((fy - TVT_CY) / TVT_CY));
    }

    for (int x = 0; x < PANEL_RES_W; x++) {
        colOff[x] = (int16_t)iround(fringeAmt * 4.6f * (((float)x - TVT_CX) / TVT_CX));
    }

    // 3. compose: roll, convergence, static, snow
    int rollI = iround(rollPos + holdOff) % PANEL_RES_H;
    if (rollI < 0) rollI += PANEL_RES_H;
    const float stat = (sw > 0.55f) ? (sw - 0.55f) * (1.0f / 0.45f) : 0.0f;
    float blank = (sw > 0.0f) ? PFMath::clamp01(sw * 1.7f) : 0.0f;
    if (lockE > 0.0f && blank < 0.92f) blank = 0.92f;
    const int xMax = PANEL_RES_W - 1;
    const int yMax = PANEL_RES_H - 1;

    for (int y = 0; y < PANEL_RES_H; y++) {
        int sy = y + rollI;
        if (sy >= PANEL_RES_H) sy -= PANEL_RES_H;
        const int sh = rowShift[y];
        const float gain = rowGain[y];
        const int vo = rowOff[y];

        int syR = sy + vo; if (syR < 0) syR = 0; else if (syR > yMax) syR = yMax;
        int syB = sy - vo; if (syB < 0) syB = 0; else if (syB > yMax) syB = yMax;
        const int rowR = syR * PANEL_RES_W;
        const int rowG = sy * PANEL_RES_W;
        const int rowB = syB * PANEL_RES_W;

        const float vbl = (blank > 0.0f && sy < 3) ? blank : 0.0f;
        const float vblK = 1.0f - vbl;

        for (int x = 0; x < PANEL_RES_W; x++) {
            const int co = colOff[x];
            int xr = x + sh + co; if (xr < 0) xr = 0; else if (xr > xMax) xr = xMax;
            int xg = x + sh;      if (xg < 0) xg = 0; else if (xg > xMax) xg = xMax;
            int xb = x + sh - co; if (xb < 0) xb = 0; else if (xb > xMax) xb = xMax;

            float r = card[(rowR + xr) * 3] * gain;
            float g = card[(rowG + xg) * 3 + 1] * gain;
            float b = card[(rowB + xb) * 3 + 2] * gain;

            if (vbl > 0.0f) { r *= vblK; g *= vblK; b *= vblK; }

            if (stat > 0.0f) {
                const float n = 20.0f + PFNoise::cellHash(x, y, frame + 4096) * 235.0f;
                r += (n - r) * stat;
                g += (n - g) * stat;
                b += (n - b) * stat;
            }

            if (snow > 0.0f) {
                const float n = PFNoise::cellHash(x, y, frame);
                const float grain = (n - 0.5f) * 95.0f * snow;
                r += grain; g += grain; b += grain;
                if (PFNoise::cellHash(x + 3, y + 5, frame) > 1.0f - snow * 0.09f) {
                    const float v = 150.0f + n * 105.0f;
                    r = v; g = v; b = v;
                }
            }

            PFCanvas::setPixel(x, y, to8(r), to8(g), to8(b));
        }
    }

    PFCanvas::present();
}

} // namespace TvTestCard