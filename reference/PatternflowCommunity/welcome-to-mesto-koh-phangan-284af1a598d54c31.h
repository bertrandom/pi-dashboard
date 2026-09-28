#pragma once
// Welcome to Mesto Koh Phangan
// Author: @kraseva (marquee by Stasik / NASHE MESTO)
// SPDX-License-Identifier: CC-BY-SA-4.0
// Made with Patternflow Community · https://patternflow.work/community
// Shared under CC-BY-SA-4.0. Keep this notice and the author credit.
//
// Knobs are 0..1 parameters with the same defaults as the JS setup():
// Gamut 0.35, Sine 0.45, Waves 0.5, Sustain 0.5.

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_params.h"
#include "src/core_math.h"
#include "src/core_color.h"

namespace MestoMarquee {

const char* NAME = "Welcome to Mesto Koh Phangan";
const char* const KNOB_LABELS[4] = {"Gamut", "Sine", "Waves", "Sustain"};
constexpr bool ABSOLUTE_READY = true;

// ---- constants ----
static constexpr int MQ_GLYPH_W = 5;
static constexpr int MQ_GLYPH_H = 7;
static constexpr int MQ_SCALE = 3;
static constexpr int MQ_GAP_PX = 3;
static constexpr int MQ_SPACE_PX = 9;
static constexpr int MQ_GLYPH_PX = 15;
static constexpr int MQ_NCHARS = 36;
static constexpr int MQ_NGLYPHS = 20;
static constexpr int MQ_MAX_OUT = 35;
static constexpr int MQ_MAX_RIPPLES = 200;
static constexpr int MQ_MAX_PARTICLES = 256;
static constexpr float MQ_SCROLL_SPEED = 30.0f;
static constexpr float MQ_BASE_GROWTH = 26.0f;
static constexpr int MQ_RING_COUNT = 3;
static constexpr float MQ_STEP = 0.021f;

static constexpr float MQ_DEF_GAMUT = 0.35f;
static constexpr float MQ_DEF_SINE = 0.45f;
static constexpr float MQ_DEF_WAVES = 0.5f;
static constexpr float MQ_DEF_SUSTAIN = 0.5f;

// ---- glyph ids ----
enum {
    MQG_W = 0, MQG_e, MQG_l, MQG_c, MQG_o, MQG_m, MQG_t, MQG_M, MQG_E, MQG_S,
    MQG_T, MQG_O, MQG_K, MQG_h, MQG_P, MQG_a, MQG_n, MQG_g, MQG_CHICK, MQG_PLANT,
    MQG_SP = -1
};

// 5x7 bitmaps, bit 4 = leftmost column
static const uint8_t MQ_FONT[MQ_NGLYPHS][MQ_GLYPH_H] = {
    {0x11, 0x11, 0x11, 0x15, 0x15, 0x1B, 0x11}, // W
    {0x00, 0x00, 0x0E, 0x11, 0x1F, 0x10, 0x0F}, // e
    {0x08, 0x08, 0x08, 0x08, 0x08, 0x08, 0x0E}, // l
    {0x00, 0x00, 0x0F, 0x10, 0x10, 0x10, 0x0F}, // c
    {0x00, 0x00, 0x0E, 0x11, 0x11, 0x11, 0x0E}, // o
    {0x00, 0x00, 0x1A, 0x15, 0x15, 0x11, 0x11}, // m
    {0x04, 0x0E, 0x04, 0x04, 0x04, 0x04, 0x03}, // t
    {0x11, 0x1B, 0x15, 0x11, 0x11, 0x11, 0x11}, // M
    {0x1F, 0x10, 0x10, 0x1E, 0x10, 0x10, 0x1F}, // E
    {0x0F, 0x10, 0x10, 0x0E, 0x01, 0x01, 0x1E}, // S
    {0x1F, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04}, // T
    {0x0E, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0E}, // O
    {0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11}, // K
    {0x10, 0x10, 0x16, 0x19, 0x11, 0x11, 0x11}, // h
    {0x1E, 0x11, 0x11, 0x1E, 0x10, 0x10, 0x10}, // P
    {0x00, 0x00, 0x0E, 0x01, 0x0F, 0x11, 0x0F}, // a
    {0x00, 0x00, 0x16, 0x19, 0x11, 0x11, 0x11}, // n
    {0x00, 0x00, 0x0F, 0x11, 0x0F, 0x01, 0x0E}, // g
    {0x0E, 0x1F, 0x1F, 0x0E, 0x04, 0x0A, 0x00}, // chick icon
    {0x0A, 0x1F, 0x0E, 0x04, 0x0E, 0x1F, 0x1F}  // potted plant icon
};

static const int8_t MQ_TEXT[MQ_NCHARS] = {
    MQG_W, MQG_e, MQG_l, MQG_c, MQG_o, MQG_m, MQG_e, MQG_SP,
    MQG_t, MQG_o, MQG_SP,
    MQG_M, MQG_E, MQG_S, MQG_T, MQG_O, MQG_SP,
    MQG_K, MQG_o, MQG_h, MQG_SP,
    MQG_P, MQG_h, MQG_a, MQG_n, MQG_g, MQG_a, MQG_n, MQG_SP,
    MQG_CHICK, MQG_SP, MQG_PLANT, MQG_SP, MQG_SP, MQG_SP, MQG_SP
};

static const float MQ_GAMUT_C[6] = {18.0f, 70.0f, 150.0f, 205.0f, 265.0f, 320.0f};
static const float MQ_GAMUT_S[6] = {28.0f, 30.0f, 38.0f, 32.0f, 34.0f, 32.0f};

// ---- precomputed tables ----
static uint8_t MQ_OUT[MQ_NGLYPHS][MQ_MAX_OUT]; // packed (row << 3) | col
static uint8_t MQ_OUT_N[MQ_NGLYPHS];
static int MQ_CHAR_X[MQ_NCHARS];
static int MQ_CYCLE = 1;

// ---- state ----
struct MqRipple {
    float x, y, age, hue, lifeMul, growthMul, ringDelay;
    int8_t g;
};
struct MqParticle {
    float x, y, vx, vy, age, life, hue;
    int8_t size;
};

static MqRipple mqRip[MQ_MAX_RIPPLES];
static int mqRipCount = 0;
static MqParticle mqPart[MQ_MAX_PARTICLES];
static int mqPartCount = 0;

static float mqPrevX[2][MQ_NCHARS];
static bool mqPrevValid[2][MQ_NCHARS];

static float mqGamutK = MQ_DEF_GAMUT;
static float mqSine = MQ_DEF_SINE;
static float mqWaves = MQ_DEF_WAVES;
static float mqSustain = MQ_DEF_SUSTAIN;

static float mqScrollDist = 0.0f;
static float mqHuePh = 0.0f;  // radians, drives hue roll (t * 0.6)
static float mqWavePh = 0.0f; // radians, drives sine bob (t * 1.6)

// ---- helpers ----
static inline float mqRand() { return (float)random(0, 10000) * 0.0001f; }

static inline float mqHue01(float deg) {
    float u = PFMath::jsMod(deg, 360.0f);
    if (u < 0.0f) u += 360.0f;
    return u * (1.0f / 360.0f);
}

static inline int mqRound(float v) { return PFMath::ifloor(v + 0.5f); }

static inline uint8_t mqFade8(uint8_t v, float f) { return (uint8_t)((float)v * f + 0.5f); }

static void mqCurrentGamut(float knob, float& c, float& spread) {
    float pos = PFMath::clamp01(knob) * 5.0f;
    int i0 = PFMath::ifloor(pos);
    int i1 = (i0 + 1 > 5) ? 5 : (i0 + 1);
    float f = pos - (float)i0;
    c = MQ_GAMUT_C[i0] + (MQ_GAMUT_C[i1] - MQ_GAMUT_C[i0]) * f;
    spread = MQ_GAMUT_S[i0] + (MQ_GAMUT_S[i1] - MQ_GAMUT_S[i0]) * f;
}

static inline float mqHueAt(float c, float spread, float screenX) {
    return c + PFMath::fastSin(mqHuePh + screenX * 0.04f) * spread;
}

static inline float mqSustainLife() { return 0.4f + mqSustain * 3.2f; }

// filled square with clipping to the panel
static inline void mqFillSq(int x, int y, int size, uint8_t r, uint8_t g, uint8_t b) {
    int xs = x < 0 ? 0 : x;
    int ys = y < 0 ? 0 : y;
    int xe = x + size;
    int ye = y + size;
    if (xe > PANEL_RES_W) xe = PANEL_RES_W;
    if (ye > PANEL_RES_H) ye = PANEL_RES_H;
    for (int py = ys; py < ye; py++) {
        for (int px = xs; px < xe; px++) {
            PFCanvas::setPixel(px, py, r, g, b);
        }
    }
}

static void mqSpawnRipple(float x, float y, float hue, int8_t g) {
    if (mqRipCount >= MQ_MAX_RIPPLES) {
        memmove(&mqRip[0], &mqRip[1], sizeof(MqRipple) * (MQ_MAX_RIPPLES - 1));
        mqRipCount = MQ_MAX_RIPPLES - 1;
    }
    MqRipple& r = mqRip[mqRipCount++];
    r.x = x;
    r.y = y;
    r.age = 0.0f;
    r.hue = hue;
    r.g = g;
    r.lifeMul = 0.55f + mqRand() * 0.9f;
    r.growthMul = 0.6f + mqRand() * 0.9f;
    r.ringDelay = 0.06f + mqRand() * 0.14f;
}

static void mqSpawnParticles(float x, float y, float hue, int count) {
    for (int i = 0; i < count; i++) {
        if (mqPartCount >= MQ_MAX_PARTICLES) break;
        float ang = mqRand() * TWO_PI;
        float speed = 12.0f + mqRand() * 70.0f;
        MqParticle& p = mqPart[mqPartCount++];
        p.x = x;
        p.y = y;
        p.vx = PFMath::fastCos(ang) * speed;
        p.vy = PFMath::fastSin(ang) * speed;
        p.age = 0.0f;
        p.life = 0.25f + mqRand() * 0.9f;
        p.hue = hue + (mqRand() - 0.5f) * 26.0f;
        p.size = (mqRand() < 0.5f) ? 1 : 2;
    }
}

// ---- interface ----
void setup() {
    PFMath::buildSinLUT();

    // outline cells (edge pixels of each glyph)
    for (int g = 0; g < MQ_NGLYPHS; g++) {
        int n = 0;
        for (int r = 0; r < MQ_GLYPH_H; r++) {
            for (int c = 0; c < MQ_GLYPH_W; c++) {
                if (!((MQ_FONT[g][r] >> (MQ_GLYPH_W - 1 - c)) & 1)) continue;
                bool edge = false;
                for (int k = 0; k < 4 && !edge; k++) {
                    int nr = r + (k == 0 ? -1 : (k == 1 ? 1 : 0));
                    int nc = c + (k == 2 ? -1 : (k == 3 ? 1 : 0));
                    if (nr < 0 || nr >= MQ_GLYPH_H || nc < 0 || nc >= MQ_GLYPH_W) {
                        edge = true;
                    } else if (!((MQ_FONT[g][nr] >> (MQ_GLYPH_W - 1 - nc)) & 1)) {
                        edge = true;
                    }
                }
                if (edge && n < MQ_MAX_OUT) MQ_OUT[g][n++] = (uint8_t)((r << 3) | c);
            }
        }
        MQ_OUT_N[g] = (uint8_t)n;
    }

    // character positions along the marquee
    int cum = 0;
    for (int i = 0; i < MQ_NCHARS; i++) {
        MQ_CHAR_X[i] = cum;
        cum += (MQ_TEXT[i] < 0 ? MQ_SPACE_PX : MQ_GLYPH_PX) + MQ_GAP_PX;
    }
    MQ_CYCLE = cum;

    mqGamutK = MQ_DEF_GAMUT;
    mqSine = MQ_DEF_SINE;
    mqWaves = MQ_DEF_WAVES;
    mqSustain = MQ_DEF_SUSTAIN;
    mqScrollDist = 0.0f;
    mqHuePh = 0.0f;
    mqWavePh = 0.0f;
    mqRipCount = 0;
    mqPartCount = 0;
    for (int k = 0; k < 2; k++) {
        for (int i = 0; i < MQ_NCHARS; i++) {
            mqPrevValid[k][i] = false;
            mqPrevX[k][i] = 0.0f;
        }
    }
}

void update(float dt, const InputFrame& input) {
    PFParams::apply(input, 0, &mqGamutK, 0.0f, 1.0f, MQ_STEP);
    PFParams::apply(input, 1, &mqSine, 0.0f, 1.0f, MQ_STEP);
    PFParams::apply(input, 2, &mqWaves, 0.0f, 1.0f, MQ_STEP);
    PFParams::apply(input, 3, &mqSustain, 0.0f, 1.0f, MQ_STEP);

    if (input.btnPressed[0] && !input.paramAbsoluteActive[0] && !input.knobAudioActive[0]) mqGamutK = MQ_DEF_GAMUT;
    if (input.btnPressed[1] && !input.paramAbsoluteActive[1] && !input.knobAudioActive[1]) mqSine = MQ_DEF_SINE;
    if (input.btnPressed[2] && !input.paramAbsoluteActive[2] && !input.knobAudioActive[2]) mqWaves = MQ_DEF_WAVES;
    if (input.btnPressed[3] && !input.paramAbsoluteActive[3] && !input.knobAudioActive[3]) mqSustain = MQ_DEF_SUSTAIN;

    // age existing effects
    for (int i = 0; i < mqRipCount; i++) mqRip[i].age += dt;
    for (int i = 0; i < mqPartCount; i++) mqPart[i].age += dt;

    // advance clocks (wrapped at their periods)
    mqHuePh += dt * 0.6f;
    if (mqHuePh > TWO_PI) mqHuePh -= TWO_PI;
    mqWavePh += dt * 1.6f;
    if (mqWavePh > TWO_PI) mqWavePh -= TWO_PI;
    mqScrollDist += dt * MQ_SCROLL_SPEED;
    if (mqScrollDist >= (float)MQ_CYCLE) mqScrollDist -= (float)MQ_CYCLE;

    float gc, gs;
    mqCurrentGamut(mqGamutK, gc, gs);
    const float offset = mqScrollDist;
    const float amp = 2.0f + mqSine * 15.0f;
    const float freq = 0.02f + mqSine * 0.02f;
    const float panelW = (float)PANEL_RES_W;
    const float halfH = (float)PANEL_RES_H * 0.5f;

    const int numTriggers = 1 + mqRound(mqWaves * 7.0f);
    const int sparkCount = 3 + mqRound(mqWaves * 7.0f);

    for (int copyIndex = 0; copyIndex < 2; copyIndex++) {
        const float copyBase = panelW - offset + (float)(copyIndex * MQ_CYCLE);
        for (int i = 0; i < MQ_NCHARS; i++) {
            const int8_t g = MQ_TEXT[i];
            const float screenX = copyBase + (float)MQ_CHAR_X[i];
            const float prev = mqPrevValid[copyIndex][i] ? mqPrevX[copyIndex][i] : screenX;
            if (g >= 0 && fabsf(screenX - prev) < panelW) {
                for (int k = 0; k < numTriggers; k++) {
                    const float tx = ((float)k + 0.5f) / (float)numTriggers * panelW;
                    if (prev > tx && screenX <= tx) {
                        const float yOff = PFMath::fastSin(screenX * freq + mqWavePh) * amp;
                        const float drawY = halfH + yOff;
                        const float hue = mqHueAt(gc, gs, screenX);
                        mqSpawnRipple(screenX, drawY, hue, g);
                        mqSpawnParticles(screenX, drawY, hue, sparkCount);
                    }
                }
            }
            mqPrevX[copyIndex][i] = screenX;
            mqPrevValid[copyIndex][i] = true;
        }
    }

    // expire
    const float life = mqSustainLife();
    int n = 0;
    for (int i = 0; i < mqRipCount; i++) {
        if (mqRip[i].age < life * mqRip[i].lifeMul + 0.9f) {
            if (n != i) mqRip[n] = mqRip[i];
            n++;
        }
    }
    mqRipCount = n;
    n = 0;
    for (int i = 0; i < mqPartCount; i++) {
        if (mqPart[i].age < mqPart[i].life) {
            if (n != i) mqPart[n] = mqPart[i];
            n++;
        }
    }
    mqPartCount = n;
}

void draw() {
    float gc, gs;
    mqCurrentGamut(mqGamutK, gc, gs);
    const float offset = mqScrollDist;
    const float amp = 2.0f + mqSine * 15.0f;
    const float freq = 0.02f + mqSine * 0.02f;
    const float panelW = (float)PANEL_RES_W;
    const float halfH = (float)PANEL_RES_H * 0.5f;

    for (int y = 0; y < PANEL_RES_H; y++) {
        for (int x = 0; x < PANEL_RES_W; x++) {
            PFCanvas::setPixel(x, y, 0, 0, 0);
        }
    }

    // glyphs
    for (int copyIndex = 0; copyIndex < 2; copyIndex++) {
        const float copyBase = panelW - offset + (float)(copyIndex * MQ_CYCLE);
        for (int i = 0; i < MQ_NCHARS; i++) {
            const int8_t g = MQ_TEXT[i];
            if (g < 0) continue;
            const float screenX = copyBase + (float)MQ_CHAR_X[i];
            if (screenX < (float)(-MQ_GLYPH_PX - 10) || screenX > panelW + 10.0f) continue;
            const float yOff = PFMath::fastSin(screenX * freq + mqWavePh) * amp;
            const int originX = mqRound(screenX);
            const int originY = mqRound(halfH + yOff - (float)(MQ_GLYPH_H * MQ_SCALE) * 0.5f);
            uint8_t r, gg, b;
            PFColor::hsvToRgb(mqHue01(mqHueAt(gc, gs, screenX)), 1.0f, 1.0f, r, gg, b);
            for (int ry = 0; ry < MQ_GLYPH_H; ry++) {
                const uint8_t rowBits = MQ_FONT[g][ry];
                if (!rowBits) continue;
                for (int rx = 0; rx < MQ_GLYPH_W; rx++) {
                    if (!((rowBits >> (MQ_GLYPH_W - 1 - rx)) & 1)) continue;
                    mqFillSq(originX + rx * MQ_SCALE, originY + ry * MQ_SCALE, MQ_SCALE, r, gg, b);
                }
            }
        }
    }

    // ripples: growing outline echoes of the glyph that spawned them
    const float life = mqSustainLife();
    for (int ri = 0; ri < mqRipCount; ri++) {
        const MqRipple& rp = mqRip[ri];
        const int nOut = MQ_OUT_N[rp.g];
        if (nOut == 0) continue;
        const float rpLife = life * rp.lifeMul;
        const float rpGrowth = MQ_BASE_GROWTH * rp.growthMul;
        for (int ring = 0; ring < MQ_RING_COUNT; ring++) {
            const float effAge = rp.age - (float)ring * rp.ringDelay;
            if (effAge <= 0.0f) continue;
            const float fade = 1.0f - effAge / rpLife;
            if (fade <= 0.0f) continue;
            int cellPx = mqRound((float)MQ_SCALE + (effAge * rpGrowth) / (float)MQ_GLYPH_W);
            if (cellPx < 1) cellPx = 1;
            uint8_t r, g, b;
            PFColor::hsvToRgb(mqHue01(rp.hue + (float)(ring * 15)), 1.0f, 1.0f, r, g, b);
            const uint8_t fr = mqFade8(r, fade);
            const uint8_t fg = mqFade8(g, fade);
            const uint8_t fb = mqFade8(b, fade);
            const int originX = mqRound(rp.x - (float)(MQ_GLYPH_W * cellPx) * 0.5f);
            const int originY = mqRound(rp.y - (float)(MQ_GLYPH_H * cellPx) * 0.5f);
            for (int k = 0; k < nOut; k++) {
                const uint8_t cell = MQ_OUT[rp.g][k];
                const int cr = cell >> 3;
                const int cc = cell & 7;
                mqFillSq(originX + cc * cellPx, originY + cr * cellPx, cellPx, fr, fg, fb);
            }
        }
    }

    // sparks
    for (int i = 0; i < mqPartCount; i++) {
        const MqParticle& p = mqPart[i];
        const float fade = 1.0f - p.age / p.life;
        if (fade <= 0.0f) continue;
        const int px = mqRound(p.x + p.vx * p.age);
        const int py = mqRound(p.y + p.vy * p.age);
        uint8_t r, g, b;
        PFColor::hsvToRgb(mqHue01(p.hue), 1.0f, 1.0f, r, g, b);
        mqFillSq(px, py, p.size, mqFade8(r, fade), mqFade8(g, fade), mqFade8(b, fade));
    }

    PFCanvas::present();
}

} // namespace MestoMarquee