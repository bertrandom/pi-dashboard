#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_math.h"
#include "src/core_color.h"
#include "src/core_noise.h"

namespace TruchetsAA {

constexpr int FRAME_W = 64;
constexpr int FRAME_H = 128;

const char* NAME = "I Love Truchets";
const char* const KNOB_LABELS[4] = {"Glitch", "Speed", "Freq", "Quantize"};

// Knob ranges / calibrated steps (Pattern Lab)
constexpr float PATT_GLITCH_MIN = 0.0f, PATT_GLITCH_MAX = 1.0f, PATT_GLITCH_STEP = 0.05f;
constexpr float PATT_SPEED_MIN  = 0.05f, PATT_SPEED_MAX  = 5.0f, PATT_SPEED_STEP  = 0.1f;
constexpr float PATT_FREQ_MIN   = 10.0f, PATT_FREQ_MAX   = 120.0f, PATT_FREQ_STEP  = 0.05f;
constexpr float PATT_QUANT_MIN  = 2.0f, PATT_QUANT_MAX  = 10.0f, PATT_QUANT_STEP  = 0.05f;

// Raw knob state (Pattern Lab current values)
static float s_glitchRaw = 0.0f;
static float s_speedRaw  = 2.0f;
static float s_freqRaw   = 111.816f;
static float s_quantRaw  = 3.194f;

// Derived state consumed by draw()
static float s_glitchNorm = 0.0f;
static float s_gridNorm   = 0.0f;
static float s_quantNorm  = 0.0f;
static float s_timeAcc    = 0.0f;
static float s_hueAcc     = 0.0f;

void setup() {
    PFMath::buildSinLUT();
}

void update(float dt, const InputFrame& input) {
    s_glitchRaw += input.knobDeltas[0] * PATT_GLITCH_STEP;
    s_speedRaw  += input.knobDeltas[1] * PATT_SPEED_STEP;
    s_freqRaw   += input.knobDeltas[2] * PATT_FREQ_STEP;
    s_quantRaw  += input.knobDeltas[3] * PATT_QUANT_STEP;

    if (input.btnPressed[0]) s_glitchRaw = 0.1f;   // -> normalized 0.1
    if (input.btnPressed[1]) s_speedRaw  = 2.03f;  // -> normalized ~0.4 => speed multiplier 1.0
    if (input.btnPressed[2]) s_freqRaw   = 32.0f;  // -> normalized 0.2
    if (input.btnPressed[3]) s_quantRaw  = 2.0f;   // -> normalized 0.0

    s_glitchRaw = fminf(fmaxf(s_glitchRaw, PATT_GLITCH_MIN), PATT_GLITCH_MAX);
    s_speedRaw  = fminf(fmaxf(s_speedRaw,  PATT_SPEED_MIN),  PATT_SPEED_MAX);
    s_freqRaw   = fminf(fmaxf(s_freqRaw,   PATT_FREQ_MIN),   PATT_FREQ_MAX);
    s_quantRaw  = fminf(fmaxf(s_quantRaw,  PATT_QUANT_MIN),  PATT_QUANT_MAX);

    s_glitchNorm = (s_glitchRaw - PATT_GLITCH_MIN) / (PATT_GLITCH_MAX - PATT_GLITCH_MIN);
    float speedNorm = (s_speedRaw - PATT_SPEED_MIN) / (PATT_SPEED_MAX - PATT_SPEED_MIN);
    s_gridNorm  = (s_freqRaw - PATT_FREQ_MIN) / (PATT_FREQ_MAX - PATT_FREQ_MIN);
    s_quantNorm = (s_quantRaw - PATT_QUANT_MIN) / (PATT_QUANT_MAX - PATT_QUANT_MIN);

    float speedMultiplier = speedNorm * 2.5f;

    s_timeAcc += dt * speedMultiplier;
    constexpr float PATT_T_PERIOD = TWO_PI / 0.15f;
    if (s_timeAcc > PATT_T_PERIOD) s_timeAcc -= PATT_T_PERIOD;

    s_hueAcc += dt * speedMultiplier * 0.05f;
    s_hueAcc = PFMath::fract(s_hueAcc);
}

void draw() {
    PFCanvas::setFrame(FRAME_W, FRAME_H);

    float t = s_timeAcc;
    float gridNorm = s_gridNorm;
    float glitchNorm = s_glitchNorm;
    float quantNorm = s_quantNorm;
    float hue0 = s_hueAcc;

    int tileSize = (int)(4.0f + gridNorm * 8.0f);
    if (tileSize < 4) tileSize = 4;

    int cols = FRAME_W / tileSize; if (cols < 1) cols = 1;
    int rows = FRAME_H / tileSize; if (rows < 1) rows = 1;
    int totalCells = cols * rows;
    float halfTile = tileSize * 0.5f;

    float lineRadius = 0.4f + gridNorm * 0.4f;
    constexpr float PATT_AA_FEATHER = 0.75f;

    float paletteAngle = quantNorm * TWO_PI + t * 0.15f;
    float cosA = PFMath::fastCos(paletteAngle);
    float sinA = PFMath::fastSin(paletteAngle);

    float mutationFraction = (1.0f / (float)totalCells) + glitchNorm * 0.30f;
    int stepCount = (int)(t * 8.0f);

    for (int y = 0; y < FRAME_H; y++) {
        int gy = y / tileSize; if (gy > rows - 1) gy = rows - 1;
        int py = y - gy * tileSize;
        float ny = ((float)y / (float)FRAME_H) - 0.5f;

        for (int x = 0; x < FRAME_W; x++) {
            int gx = x / tileSize; if (gx > cols - 1) gx = cols - 1;
            int px = x - gx * tileSize;
            float nx = ((float)x / (float)FRAME_W) - 0.5f;

            float baseSeed = PFNoise::cellHash(gx, gy);
            int flips = (baseSeed > 0.5f) ? 1 : 0;

            for (int s = 1; s <= 16; s++) {
                int pastStep = stepCount - s;
                if (pastStep < 0) continue;
                float stepCellHash = PFNoise::cellHash(gx, gy, pastStep + 1);
                if (stepCellHash < mutationFraction) flips++;
            }

            int tileType = (flips % 2 == 0) ? 0 : 1;

            float fpx = (float)px, fpy = (float)py, fts = (float)tileSize;
            float d1, d2;
            if (tileType == 0) {
                d1 = sqrtf(fpx * fpx + fpy * fpy);
                d2 = sqrtf((fpx - fts) * (fpx - fts) + (fpy - fts) * (fpy - fts));
            } else {
                d1 = sqrtf((fpx - fts) * (fpx - fts) + fpy * fpy);
                d2 = sqrtf(fpx * fpx + (fpy - fts) * (fpy - fts));
            }

            float distFromArc = fminf(fabsf(d1 - halfTile), fabsf(d2 - halfTile));

            float lineAlpha = 1.0f - fminf(fmaxf((distFromArc - lineRadius) / PATT_AA_FEATHER, 0.0f), 1.0f);
            lineAlpha = lineAlpha * lineAlpha * (3.0f - 2.0f * lineAlpha);

            float rotatedProj = nx * cosA + ny * sinA;
            float pixelHue = PFMath::fract(rotatedProj + 0.5f + hue0);

            uint8_t br, bg, bb;
            PFColor::hsvToRgb(pixelHue, 1.0f, 1.0f, br, bg, bb);

            constexpr float PATT_AMBIENT = 0.05f;
            float finalAlpha = PATT_AMBIENT + lineAlpha * (1.0f - PATT_AMBIENT);

            int r = (int)((float)br * finalAlpha);
            int g = (int)((float)bg * finalAlpha);
            int b = (int)((float)bb * finalAlpha);
            r = r < 0 ? 0 : (r > 255 ? 255 : r);
            g = g < 0 ? 0 : (g > 255 ? 255 : g);
            b = b < 0 ? 0 : (b > 255 ? 255 : b);

            PFCanvas::setPixel(x, y, (uint8_t)r, (uint8_t)g, (uint8_t)b);
        }
    }

    PFCanvas::present();
}

} // namespace TruchetsAA