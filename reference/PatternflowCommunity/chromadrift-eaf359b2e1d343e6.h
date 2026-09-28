#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_params.h"
#include "src/core_math.h"
#include "src/core_color.h"
#include "src/core_mem.h"

namespace Chromadrift {

const char* NAME = "Chromadrift";
const char* const KNOB_LABELS[4] = {"Hue", "Speed", "Warp", "Zoom"};
constexpr bool ABSOLUTE_READY = true;

static float* densityBuf = nullptr;
static float* colorBuf = nullptr;

static float px = 0.1f;
static float py = 0.1f;
static float cx = 0.0f;
static float cy = 0.0f;
static float timeAcc = 0.0f;

// Knobs: Hue=0..12, Speed=0.1..10, Warp=0..2, Zoom=0.1..2
static float knobHue = 0.0f;
static float knobSpeed = 2.0f;
static float knobWarp = 2.0f;
static float knobZoom = 2.0f;

static uint32_t rngSeed = 918273;

static inline float fastRand() {
    rngSeed = rngSeed * 1664525u + 1013904223u;
    return (float)rngSeed * (1.0f / 4294967296.0f);
}

static inline float tent(float w, float center) {
    float d = fabsf(w - center);
    d = fminf(d, 1.0f - d);
    return fmaxf(0.0f, 1.0f - d * 4.0f);
}

static void stepAttractor(float dt) {
    const float speedMul = 0.2f + knobSpeed * 3.0f;
    const float persistence = 0.99f - knobSpeed * 0.15f;

    timeAcc += dt * speedMul;
    // morph period is (2π / 0.35) * common denominator ≈ 600π
    if (timeAcc > 1884.95559f) {
        timeAcc -= 1884.95559f;
    }

    const int totalPixels = PANEL_RES_W * PANEL_RES_H;
    for (int i = 0; i < totalPixels; ++i) {
        densityBuf[i] *= persistence;
    }

    const float morph = timeAcc * 0.35f;
    const float a1 =  0.50f * PFMath::fastCos(morph * 0.30f);
    const float b1 = -0.50f * PFMath::fastSin(morph * 0.42f);
    const float c1 =  0.50f * PFMath::fastSin(morph * 0.31f);
    const float d1 =  0.50f * PFMath::fastCos(morph * 0.37f);

    const float a2 =  0.42f * PFMath::fastSin(morph * 0.50f);
    const float b2 =  0.42f * PFMath::fastCos(morph * 0.23f);
    const float c2 = -0.42f * PFMath::fastCos(morph * 0.47f);
    const float d2 =  0.42f * PFMath::fastSin(morph * 0.21f);

    const float warpPos = fminf(fmaxf(knobWarp, 0.0f), 1.6f);
    const float wLin   = tent(warpPos, 0.00f);
    const float wSwirl = tent(warpPos, 0.25f);
    const float wHorse = tent(warpPos, 0.50f);
    const float wHanky = tent(warpPos, 0.75f);

    float currX = px;
    float currY = py;

    const float scale = 18.0f + knobZoom * 70.0f;
    const float halfW = (float)PANEL_RES_W * 0.5f;
    const float halfH = (float)PANEL_RES_H * 0.5f;

    constexpr int ITER = 2200;
    for (int i = 0; i < ITER; ++i) {
        const float r = fastRand();
        float nx, ny;
        if (r < 0.5f) {
            nx = a1 * currX + b1 * currY;
            ny = c1 * currX + d1 * currY + 0.3f;
        } else {
            nx = a2 * currX + b2 * currY - 0.2f;
            ny = c2 * currX + d2 * currY - 0.4f;
        }

        // varLinear
        const float linX = nx;
        const float linY = ny;

        // varSwirl
        const float r2 = nx * nx + ny * ny;
        const float sSwirl = PFMath::fastSin(r2 * 2.0f);
        const float cSwirl = PFMath::fastCos(r2 * 2.0f);
        const float swirlX = nx * sSwirl - ny * cSwirl;
        const float swirlY = nx * cSwirl + ny * sSwirl;

        // varHorseshoe
        const float rHorse = sqrtf(r2) + 1e-6f;
        const float invRHorse = 1.0f / rHorse;
        const float horseX = (nx - ny) * (nx + ny) * invRHorse;
        const float horseY = (2.0f * nx * ny) * invRHorse;

        // varHandkerchief
        const float rHanky = sqrtf(r2);
        const float thetaHanky = PFMath::fastAtan2(ny, nx);
        const float hankyX = rHanky * PFMath::fastSin(thetaHanky + rHanky);
        const float hankyY = rHanky * PFMath::fastCos(thetaHanky - rHanky);

        currX = linX * wLin + swirlX * wSwirl + horseX * wHorse + hankyX * wHanky;
        currY = linY * wLin + swirlY * wSwirl + horseY * wHorse + hankyY * wHanky;

        if (!isfinite(currX) || !isfinite(currY) || fabsf(currX) > 12.0f || fabsf(currY) > 12.0f) {
            currX = fastRand() * 0.2f - 0.1f;
            currY = fastRand() * 0.2f - 0.1f;
        }

        cx += (currX - cx) * 0.0003f;
        cy += (currY - cy) * 0.0003f;

        const int pX = (int)floorf(halfW + (currY - cy) * scale);
        const int pY = (int)floorf(halfH + (currX - cx) * scale);

        if (pX >= 0 && pX < PANEL_RES_W && pY >= 0 && pY < PANEL_RES_H) {
            const int idx = pY * PANEL_RES_W + pX;
            densityBuf[idx] += 1.0f;
            colorBuf[idx] += (warpPos - colorBuf[idx]) * 0.25f;
        }
    }

    px = currX;
    py = currY;
}

void setup() {
    PFMath::buildSinLUT();

    const int totalPixels = PANEL_RES_W * PANEL_RES_H;
    if (!densityBuf) densityBuf = PFMem::allocFloats(totalPixels);
    if (!colorBuf)   colorBuf   = PFMem::allocFloats(totalPixels);

    if (!densityBuf || !colorBuf) return;

    px = 0.1f;
    py = 0.1f;
    cx = 0.0f;
    cy = 0.0f;
    timeAcc = 0.0f;
    rngSeed = 918273;

    for (int i = 0; i < 60; ++i) {
        stepAttractor(0.016f);
    }
}

void update(float dt, const InputFrame& input) {
    PFParams::apply(input, 0, &knobHue,   0.0f, 12.0f, 0.250f);
    PFParams::apply(input, 1, &knobSpeed, 0.1f, 10.0f, 0.206f);
    PFParams::apply(input, 2, &knobWarp,  0.0f,  2.0f, 0.042f);
    PFParams::apply(input, 3, &knobZoom,  0.1f,  2.0f, 0.040f);

    if (input.btnPressed[0] && !input.paramAbsoluteActive[0] && !input.knobAudioActive[0]) knobHue = 0.0f;
    if (input.btnPressed[1] && !input.paramAbsoluteActive[1] && !input.knobAudioActive[1]) knobSpeed = 0.1f;
    if (input.btnPressed[2] && !input.paramAbsoluteActive[2] && !input.knobAudioActive[2]) knobWarp = 0.0f;
    if (input.btnPressed[3] && !input.paramAbsoluteActive[3] && !input.knobAudioActive[3]) knobZoom = 0.1f;

    if (!densityBuf || !colorBuf) return;

    const float safeDt = fminf(dt, 0.1f);
    stepAttractor(safeDt);
}

void draw() {
    if (!densityBuf || !colorBuf) {
        PFCanvas::present();
        return;
    }

    const int totalPixels = PANEL_RES_W * PANEL_RES_H;
    float maxLog = 0.001f;
    for (int i = 0; i < totalPixels; ++i) {
        const float lv = log1pf(densityBuf[i]);
        if (lv > maxLog) maxLog = lv;
    }
    const float norm = 1.0f / fmaxf(maxLog, 0.1f);

    for (int y = 0; y < PANEL_RES_H; ++y) {
        const int rowOffset = y * PANEL_RES_W;
        for (int x = 0; x < PANEL_RES_W; ++x) {
            const int idx = rowOffset + x;
            float val = log1pf(densityBuf[idx]) * norm;
            val = fminf(fmaxf(val, 0.0f), 1.0f);
            val = val * val * (3.0f - 2.0f * val);

            float hue = knobHue + colorBuf[idx] * 0.6f;
            hue = PFMath::fract(hue);

            const float sat = fminf(fmaxf(1.0f - val * 0.55f, 0.35f), 1.0f);
            const float bri = val;

            uint8_t r8, g8, b8;
            PFColor::hsvToRgb(hue, sat, bri, r8, g8, b8);
            PFCanvas::setPixel(x, y, r8, g8, b8);
        }
    }

    PFCanvas::present();
}

} // namespace Chromadrift