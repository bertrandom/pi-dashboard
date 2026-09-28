#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_params.h"
#include "src/core_math.h"

namespace FractalAbyssMandelbrot {

const char* NAME = "AbyssMandelbrot";
const char* const KNOB_LABELS[4] = {"Depth", "Speed", "Palette", "Target"};
constexpr bool ABSOLUTE_READY = true;

// ===== Patternflow pattern =====
// Title:   FractalAbyss
// Author:  travel@adchieve.com
// Date:    2026-08-20
// SPDX-License-Identifier: CC-BY-SA-4.0
//
// Made with Patternflow Pattern Lab · https://patternflow.work/pattern-lab
// Shared under CC-BY-SA-4.0. Attribution is part of this licence.

// Eight hand-picked Mandelbrot landmarks.
static constexpr float FRACTAL_ABYSS_TARGETS[8][2] = {
    {-0.7453f,  0.1127f},
    {-0.7269f,  0.1889f},
    { 0.2929f,  0.0113f},
    {-0.1592f,  1.0317f},
    {-0.5250f,  0.5260f},
    { 0.3602f, -0.6413f},
    {-1.7491f,  0.0001f},
    {-0.1010f,  0.9562f},
};

static constexpr int FRACTAL_ABYSS_PALETTE_COUNT = 6;
static constexpr int FRACTAL_ABYSS_PALETTE_LUT_SIZE = 512;
static constexpr int FRACTAL_ABYSS_SMOOTH_LUT_SIZE = 2048;
static constexpr int FRACTAL_ABYSS_LUM_LUT_SIZE = 2048;

static constexpr float FRACTAL_ABYSS_ZOOM_RATE = 0.0125f;
static constexpr float FRACTAL_ABYSS_SMOOTH_MOD_LO = 4.0f;
static constexpr float FRACTAL_ABYSS_SMOOTH_MOD_HI = 128.0f;
static constexpr float FRACTAL_ABYSS_SMOOTH_MAX = 362.0f;
static constexpr float FRACTAL_ABYSS_INV_TWO_PI = 0.15915494309189535f;

// IQ cosine-palette parameters:
// aR,aG,aB, bR,bG,bB, cR,cG,cB, dR,dG,dB, gamma
static constexpr float FRACTAL_ABYSS_PALETTES[FRACTAL_ABYSS_PALETTE_COUNT][13] = {
    {0.50f,0.50f,0.50f, 0.50f,0.50f,0.50f, 1.00f,1.15f,0.82f, 0.00f,0.35f,0.65f, 0.38f},
    {0.15f,0.35f,0.55f, 0.15f,0.25f,0.35f, 0.80f,0.90f,1.10f, 0.00f,0.15f,0.30f, 0.65f},
    {0.60f,0.28f,0.30f, 0.40f,0.28f,0.22f, 0.85f,1.00f,0.75f, 0.00f,0.28f,0.60f, 0.55f},
    {0.20f,0.50f,0.40f, 0.30f,0.40f,0.30f, 1.00f,0.80f,1.20f, 0.10f,0.20f,0.50f, 0.50f},
    {0.55f,0.18f,0.08f, 0.45f,0.20f,0.08f, 0.70f,0.90f,1.10f, 0.00f,0.08f,0.40f, 0.42f},
    {0.40f,0.48f,0.60f, 0.22f,0.22f,0.32f, 1.00f,1.10f,0.88f, 0.00f,0.10f,0.20f, 0.72f},
};

// Pattern Lab knob state.
static float fractalAbyssDepth = 1.0f;
static float fractalAbyssSpeed = 10.0f;
static float fractalAbyssPalette = 0.177f;
static float fractalAbyssTargetRaw = 0.176f;

// Wrapped animation phases.
static float fractalAbyssZoomPhase = 0.0f;
static float fractalAbyssCycle1 = 0.0f;
static float fractalAbyssCycle2 = 0.0f;

// Cheap coordinate tables; these depend only on x/y.
static float fractalAbyssXNorm[PANEL_RES_W];
static float fractalAbyssYNorm[PANEL_RES_H];

// Per-pattern lookup tables. Total static footprint remains well below 32 KB.
static uint8_t fractalAbyssPalettePrimary[FRACTAL_ABYSS_PALETTE_LUT_SIZE][3];
static uint8_t fractalAbyssPaletteSecondary[FRACTAL_ABYSS_PALETTE_LUT_SIZE][3];
static float fractalAbyssSmoothCorrection[FRACTAL_ABYSS_SMOOTH_LUT_SIZE];
static uint8_t fractalAbyssLuminance[FRACTAL_ABYSS_LUM_LUT_SIZE];

static float fractalAbyssPaletteBuiltFor = -1.0f;

static void fractalAbyssBuildPaletteTable(
    float palettePosition,
    uint8_t table[FRACTAL_ABYSS_PALETTE_LUT_SIZE][3]
) {
    const float wrappedPalette = PFMath::fract(palettePosition);
    const float paletteCoord = wrappedPalette * (float)FRACTAL_ABYSS_PALETTE_COUNT;

    int firstIndex = PFMath::ifloor(paletteCoord);
    if (firstIndex < 0) firstIndex = 0;
    if (firstIndex >= FRACTAL_ABYSS_PALETTE_COUNT) firstIndex = 0;

    const int secondIndex =
        (firstIndex + 1 < FRACTAL_ABYSS_PALETTE_COUNT) ? firstIndex + 1 : 0;

    const float blendLinear = paletteCoord - (float)firstIndex;
    const float blend =
        blendLinear * blendLinear * (3.0f - 2.0f * blendLinear);

    const float* pa = FRACTAL_ABYSS_PALETTES[firstIndex];
    const float* pb = FRACTAL_ABYSS_PALETTES[secondIndex];

    const float aR = PFMath::lerp(pa[0], pb[0], blend);
    const float aG = PFMath::lerp(pa[1], pb[1], blend);
    const float aB = PFMath::lerp(pa[2], pb[2], blend);

    const float bR = PFMath::lerp(pa[3], pb[3], blend);
    const float bG = PFMath::lerp(pa[4], pb[4], blend);
    const float bB = PFMath::lerp(pa[5], pb[5], blend);

    const float cR = PFMath::lerp(pa[6], pb[6], blend);
    const float cG = PFMath::lerp(pa[7], pb[7], blend);
    const float cB = PFMath::lerp(pa[8], pb[8], blend);

    const float dR = PFMath::lerp(pa[9],  pb[9],  blend);
    const float dG = PFMath::lerp(pa[10], pb[10], blend);
    const float dB = PFMath::lerp(pa[11], pb[11], blend);

    const float gammaValue = PFMath::lerp(pa[12], pb[12], blend);
    const float invLast =
        1.0f / (float)(FRACTAL_ABYSS_PALETTE_LUT_SIZE - 1);

    for (int k = 0; k < FRACTAL_ABYSS_PALETTE_LUT_SIZE; ++k) {
        const float paletteT = (float)k * invLast;

        float redValue =
            aR + bR * PFMath::fastCos(TWO_PI * (cR * paletteT + dR));
        float greenValue =
            aG + bG * PFMath::fastCos(TWO_PI * (cG * paletteT + dG));
        float blueValue =
            aB + bB * PFMath::fastCos(TWO_PI * (cB * paletteT + dB));

        redValue =
            redValue > 0.0f ? PFMath::fastPow(redValue, gammaValue) : 0.0f;
        greenValue =
            greenValue > 0.0f ? PFMath::fastPow(greenValue, gammaValue) : 0.0f;
        blueValue =
            blueValue > 0.0f ? PFMath::fastPow(blueValue, gammaValue) : 0.0f;

        redValue = PFMath::clamp01(redValue);
        greenValue = PFMath::clamp01(greenValue);
        blueValue = PFMath::clamp01(blueValue);

        table[k][0] = (uint8_t)(redValue * 255.0f);
        table[k][1] = (uint8_t)(greenValue * 255.0f);
        table[k][2] = (uint8_t)(blueValue * 255.0f);
    }
}

static void fractalAbyssRebuildPalettes() {
    fractalAbyssBuildPaletteTable(
        fractalAbyssPalette,
        fractalAbyssPalettePrimary
    );
    fractalAbyssBuildPaletteTable(
        PFMath::fract(fractalAbyssPalette + 0.08f),
        fractalAbyssPaletteSecondary
    );
    fractalAbyssPaletteBuiltFor = fractalAbyssPalette;
}

static float fractalAbyssSmoothCorrectionAt(float modZ2) {
    const float bounded = PFMath::clamp(
        modZ2,
        FRACTAL_ABYSS_SMOOTH_MOD_LO,
        FRACTAL_ABYSS_SMOOTH_MOD_HI
    );

    const float scale =
        (float)(FRACTAL_ABYSS_SMOOTH_LUT_SIZE - 1) /
        (FRACTAL_ABYSS_SMOOTH_MOD_HI - FRACTAL_ABYSS_SMOOTH_MOD_LO);

    const float position =
        (bounded - FRACTAL_ABYSS_SMOOTH_MOD_LO) * scale;

    int lutIndex = PFMath::ifloor(position);
    if (lutIndex < 0) lutIndex = 0;

    if (lutIndex >= FRACTAL_ABYSS_SMOOTH_LUT_SIZE - 1) {
        return fractalAbyssSmoothCorrection[
            FRACTAL_ABYSS_SMOOTH_LUT_SIZE - 1
        ];
    }

    const float blend = position - (float)lutIndex;

    return PFMath::lerp(
        fractalAbyssSmoothCorrection[lutIndex],
        fractalAbyssSmoothCorrection[lutIndex + 1],
        blend
    );
}

static uint8_t fractalAbyssLuminanceAt(float smoothValue) {
    const float bounded =
        PFMath::clamp(smoothValue, 0.0f, FRACTAL_ABYSS_SMOOTH_MAX);

    const float scale =
        (float)(FRACTAL_ABYSS_LUM_LUT_SIZE - 1) /
        FRACTAL_ABYSS_SMOOTH_MAX;

    int lutIndex = PFMath::ifloor(bounded * scale + 0.5f);

    if (lutIndex < 0) lutIndex = 0;
    if (lutIndex >= FRACTAL_ABYSS_LUM_LUT_SIZE) {
        lutIndex = FRACTAL_ABYSS_LUM_LUT_SIZE - 1;
    }

    return fractalAbyssLuminance[lutIndex];
}

static int fractalAbyssPaletteIndex(float paletteT) {
    const float wrapped = PFMath::fract(paletteT);
    int lutIndex = PFMath::ifloor(
        wrapped * (float)FRACTAL_ABYSS_PALETTE_LUT_SIZE
    );

    if (lutIndex < 0) lutIndex = 0;
    if (lutIndex >= FRACTAL_ABYSS_PALETTE_LUT_SIZE) {
        lutIndex = FRACTAL_ABYSS_PALETTE_LUT_SIZE - 1;
    }

    return lutIndex;
}

void setup() {
    PFMath::buildSinLUT();

    fractalAbyssDepth = 1.0f;
    fractalAbyssSpeed = 10.0f;
    fractalAbyssPalette = 0.177f;
    fractalAbyssTargetRaw = 0.176f;

    fractalAbyssZoomPhase = 0.0f;
    fractalAbyssCycle1 = 0.0f;
    fractalAbyssCycle2 = 0.0f;
    fractalAbyssPaletteBuiltFor = -1.0f;

    const float invWidth = 1.0f / (float)PANEL_RES_W;
    for (int x = 0; x < PANEL_RES_W; ++x) {
        fractalAbyssXNorm[x] =
            ((float)x * invWidth - 0.5f) * 2.0f;
    }

    const float invHeight = 1.0f / (float)PANEL_RES_H;
    for (int y = 0; y < PANEL_RES_H; ++y) {
        fractalAbyssYNorm[y] =
            ((float)y * invHeight - 0.5f) * 2.0f;
    }

    const float smoothStep =
        (FRACTAL_ABYSS_SMOOTH_MOD_HI -
         FRACTAL_ABYSS_SMOOTH_MOD_LO) /
        (float)(FRACTAL_ABYSS_SMOOTH_LUT_SIZE - 1);

    for (int i = 0; i < FRACTAL_ABYSS_SMOOTH_LUT_SIZE; ++i) {
        const float modValue =
            FRACTAL_ABYSS_SMOOTH_MOD_LO + smoothStep * (float)i;

        fractalAbyssSmoothCorrection[i] =
            2.0f - log2f(log2f(modValue));
    }

    const float lumStep =
        FRACTAL_ABYSS_SMOOTH_MAX /
        (float)(FRACTAL_ABYSS_LUM_LUT_SIZE - 1);

    for (int i = 0; i < FRACTAL_ABYSS_LUM_LUT_SIZE; ++i) {
        const float smoothValue = lumStep * (float)i;
        const float lumValue =
            1.0f - expf(-smoothValue * 0.20f);

        fractalAbyssLuminance[i] =
            (uint8_t)(PFMath::clamp01(lumValue) * 255.0f);
    }

    fractalAbyssRebuildPalettes();
}

void update(float dt, const InputFrame& input) {
    PFParams::apply(
        input,
        0,
        &fractalAbyssDepth,
        0.0f,
        1.0f,
        0.021f
    );

    PFParams::apply(
        input,
        1,
        &fractalAbyssSpeed,
        0.1f,
        10.0f,
        0.206f
    );

    PFParams::applyUnit(
        input,
        2,
        &fractalAbyssPalette,
        0.021f
    );

    PFParams::apply(
        input,
        3,
        &fractalAbyssTargetRaw,
        0.0f,
        1.0f,
        0.021f
    );

    if (fractalAbyssPalette != fractalAbyssPaletteBuiltFor) {
        fractalAbyssRebuildPalettes();
    }

    const float zoomRange =
        3.0f + fractalAbyssDepth * 4.0f;

    // Keep the dive phase bounded permanently. Integrating normalized phase
    // avoids the long-running precision loss of an unbounded zoom clock.
    fractalAbyssZoomPhase +=
        dt * fractalAbyssSpeed *
        FRACTAL_ABYSS_ZOOM_RATE / zoomRange;

    fractalAbyssZoomPhase =
        PFMath::fract(fractalAbyssZoomPhase);

    // These two drifts feed fract() directly, so each is its own wrapped
    // 0..1 accumulator.
    fractalAbyssCycle1 =
        PFMath::fract(
            fractalAbyssCycle1 +
            dt * fractalAbyssSpeed * 0.10f
        );

    fractalAbyssCycle2 =
        PFMath::fract(
            fractalAbyssCycle2 +
            dt * fractalAbyssSpeed * 0.07f
        );
}

void draw() {
    const float zoomRange =
        3.0f + fractalAbyssDepth * 4.0f;

    const float logZoom =
        fractalAbyssZoomPhase * zoomRange;

    const float zoomLevel =
        PFMath::fastPow(10.0f, logZoom);

    int maxIter =
        (int)(72.0f + 288.0f * fractalAbyssZoomPhase + 0.5f);

    if (maxIter > 360) maxIter = 360;
    if (maxIter < 1) maxIter = 1;

    int targetIndex =
        (int)(fractalAbyssTargetRaw * 7.9999f);

    if (targetIndex < 0) targetIndex = 0;
    if (targetIndex > 7) targetIndex = 7;

    const float targetCx =
        FRACTAL_ABYSS_TARGETS[targetIndex][0];
    const float targetCy =
        FRACTAL_ABYSS_TARGETS[targetIndex][1];

    float lockValue = 1.0f;

    if (fractalAbyssZoomPhase < 0.25f) {
        const float lockLinear =
            fractalAbyssZoomPhase * 4.0f;

        lockValue =
            lockLinear * lockLinear *
            (3.0f - 2.0f * lockLinear);
    }

    const float viewCx =
        -0.5f + (targetCx + 0.5f) * lockValue;

    const float viewCy =
        targetCy * lockValue;

    const float aspect =
        (float)PANEL_RES_W / (float)PANEL_RES_H;

    const float invZoom = 1.0f / zoomLevel;
    const float halfW = 2.0f * aspect * invZoom;
    const float halfH = 2.0f * invZoom;

    constexpr float FRACTAL_ABYSS_ACCENT_WEIGHT = 0.65f;

    for (int py = 0; py < PANEL_RES_H; ++py) {
        const float ci =
            viewCy + fractalAbyssYNorm[py] * halfH;

        const float ci2 = ci * ci;

        for (int px = 0; px < PANEL_RES_W; ++px) {
            const float cr =
                viewCx + fractalAbyssXNorm[px] * halfW;

            // Fast exact-inside tests for the main cardioid and period-2 bulb.
            // They only skip pixels that are guaranteed Mandelbrot members.
            const float cardioidX = cr - 0.25f;
            const float cardioidQ =
                cardioidX * cardioidX + ci2;

            const float bulbX = cr + 1.0f;

            const bool guaranteedInterior =
                cardioidQ * (cardioidQ + cardioidX) <=
                    0.25f * ci2 ||
                bulbX * bulbX + ci2 <= 0.0625f;

            if (guaranteedInterior) {
                PFCanvas::setPixel(px, py, 0, 0, 0);
                continue;
            }

            float zr = 0.0f;
            float zi = 0.0f;
            int iter = 0;

            while (iter < maxIter) {
                const float zr2 = zr * zr;
                const float zi2 = zi * zi;
                const float distance2 = zr2 + zi2;

                if (distance2 > 4.0f) {
                    break;
                }

                const float newZr =
                    zr2 - zi2 + cr;

                zi =
                    2.0f * zr * zi + ci;

                zr = newZr;
                ++iter;
            }

            if (iter >= maxIter) {
                PFCanvas::setPixel(px, py, 0, 0, 0);
                continue;
            }

            const float modZ2 =
                zr * zr + zi * zi;

            const float smooth =
                (float)iter +
                fractalAbyssSmoothCorrectionAt(modZ2);

            const float angle =
                PFMath::fastAtan2(zi, zr) *
                FRACTAL_ABYSS_INV_TWO_PI;

            const float paletteT1 =
                PFMath::fract(
                    smooth * 0.030f +
                    angle * 0.08f +
                    fractalAbyssCycle1
                );

            const float paletteT2 =
                PFMath::fract(
                    smooth * 0.063f -
                    angle * 0.12f +
                    fractalAbyssCycle2 +
                    0.38f
                );

            const int paletteIndex1 =
                fractalAbyssPaletteIndex(paletteT1);

            const int paletteIndex2 =
                fractalAbyssPaletteIndex(paletteT2);

            const uint8_t lumByte =
                fractalAbyssLuminanceAt(smooth);

            const float lum =
                (float)lumByte * (1.0f / 255.0f);

            // In the source, minDist2 includes z0=(0,0), so the orbit-trap
            // minimum is always zero. Therefore trapBlend is always zero and
            // the layer-2 weight is always 0.65. Keeping that behavior here
            // preserves the JavaScript output while removing sqrt/exp work.
            float redOut =
                (
                    (float)fractalAbyssPalettePrimary[paletteIndex1][0] +
                    FRACTAL_ABYSS_ACCENT_WEIGHT *
                    (float)fractalAbyssPaletteSecondary[paletteIndex2][0]
                ) * lum;

            float greenOut =
                (
                    (float)fractalAbyssPalettePrimary[paletteIndex1][1] +
                    FRACTAL_ABYSS_ACCENT_WEIGHT *
                    (float)fractalAbyssPaletteSecondary[paletteIndex2][1]
                ) * lum;

            float blueOut =
                (
                    (float)fractalAbyssPalettePrimary[paletteIndex1][2] +
                    FRACTAL_ABYSS_ACCENT_WEIGHT *
                    (float)fractalAbyssPaletteSecondary[paletteIndex2][2]
                ) * lum;

            redOut = PFMath::clamp(redOut, 0.0f, 255.0f);
            greenOut = PFMath::clamp(greenOut, 0.0f, 255.0f);
            blueOut = PFMath::clamp(blueOut, 0.0f, 255.0f);

            PFCanvas::setPixel(
                px,
                py,
                (uint8_t)redOut,
                (uint8_t)greenOut,
                (uint8_t)blueOut
            );
        }
    }

    PFCanvas::present();
}

} // namespace FractalAbyssMandelbrot