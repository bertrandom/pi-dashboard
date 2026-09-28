#pragma once

// Relaxes strict IEEE float rounding (division, sqrt, trig) so the FPU can use
// its fast reciprocal/rsqrt paths. The Kali fold loop below is division-bound,
// so this matters here; the trap-based colouring is visually forgiving of the
// resulting rounding differences.
#pragma GCC optimize ("O3", "fast-math")

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_params.h"
#include "src/core_math.h"
#include "src/core_tables.h"

namespace KaliBloom {

const char* NAME = "Kali Bloom";
const char* const KNOB_LABELS[4] = {"Shape", "Speed", "Palette", "Symmetry"};
constexpr bool ABSOLUTE_READY = true;

// ===== Patternflow pattern =====
// Title:   KaliBloom
// Author:  (your name / handle)
// Date:    2026-09-12
// SPDX-License-Identifier: CC-BY-SA-4.0
//
// Made with Patternflow Pattern Lab · https://patternflow.work/pattern-lab
// Shared under CC-BY-SA-4.0. Attribution is part of this licence.

// Fixed field quality.
//
// Perf note: cost per frame is ~ PANEL_RES_W * PANEL_RES_H * SS^2 * ITER
// divisions (the Kali fold loop does one float division per iteration, and
// the ESP32-S3 FPU has no single-cycle divide). SS is squared in that product,
// so it dominates. SS=1 is the on-device default; SS=2 is only worth it if a
// future faster core (or half-res render) buys back the headroom. ITER=10 is
// a mild trim from the original 14 — the finest filigree is barely visible at
// this resolution, but push it back up if you have cycles to spare.
static constexpr int KALIBLOOM_SS = 1;
static constexpr int KALIBLOOM_ITER = 10;

// Tone shaping.
static constexpr float KALIBLOOM_GLOW_FALLOFF = 14.0f;
static constexpr float KALIBLOOM_WEB_FALLOFF = 60.0f;
static constexpr float KALIBLOOM_AMBIENT = 0.03f;
static constexpr float KALIBLOOM_GLOW_GAIN = 2.4f;
static constexpr float KALIBLOOM_WEB_GAIN = 1.8f;
static constexpr float KALIBLOOM_SATURATION = 1.40f;

// The animation uses t * {0.11, 0.09, 0.07, 0.05}.
// TWO_PI * 100 is a common seamless period for every multiplier.
static constexpr float KALIBLOOM_TIME_PERIOD = TWO_PI * 100.0f;

static constexpr int KALIBLOOM_SHAPE_COUNT = 8;
static constexpr int KALIBLOOM_PALETTE_COUNT = 8;

static constexpr int KALIBLOOM_PALETTE_LUT_SIZE = 1024;
static constexpr int KALIBLOOM_GLOW_LUT_SIZE = 1024;
static constexpr int KALIBLOOM_WEB_LUT_SIZE = 1024;
static constexpr int KALIBLOOM_TONE_LUT_SIZE = 1024;

static constexpr float KALIBLOOM_GLOW_LUT_LIMIT = 2.0f;
static constexpr float KALIBLOOM_WEB_LUT_LIMIT = 0.25f;
static constexpr float KALIBLOOM_TONE_LUT_LIMIT = 4.5f;

static constexpr float KALIBLOOM_INV_255 = 1.0f / 255.0f;

// Fold constants.
static constexpr float KALIBLOOM_SHAPES[KALIBLOOM_SHAPE_COUNT][2] = {
    {0.20f, 1.00f},
    {0.40f, 1.00f},
    {0.60f, 1.00f},
    {0.20f, 0.30f},
    {0.90f, 0.20f},
    {0.30f, 0.50f},
    {0.70f, 0.20f},
    {1.00f, 0.40f},
};

// IQ cosine palette presets: a,b,c,d packed as 12 floats.
static constexpr float KALIBLOOM_PALETTES[KALIBLOOM_PALETTE_COUNT][12] = {
    {0.50f,0.50f,0.50f, 0.50f,0.50f,0.50f, 1.00f,1.00f,1.00f, 0.00f,0.33f,0.67f},
    {0.50f,0.50f,0.50f, 0.50f,0.50f,0.50f, 1.00f,1.00f,1.00f, 0.50f,0.20f,0.25f},
    {0.50f,0.50f,0.50f, 0.50f,0.50f,0.50f, 2.00f,1.00f,1.00f, 0.00f,0.25f,0.50f},
    {0.50f,0.50f,0.50f, 0.50f,0.50f,0.50f, 1.00f,1.00f,0.50f, 0.80f,0.90f,0.30f},
    {0.55f,0.30f,0.20f, 0.45f,0.35f,0.30f, 1.00f,1.00f,1.00f, 0.00f,0.12f,0.20f},
    {0.20f,0.45f,0.55f, 0.30f,0.40f,0.42f, 1.00f,1.00f,1.00f, 0.55f,0.60f,0.65f},
    {0.60f,0.35f,0.42f, 0.40f,0.36f,0.36f, 1.00f,1.00f,1.00f, 0.00f,0.16f,0.42f},
    {0.28f,0.50f,0.42f, 0.42f,0.40f,0.38f, 1.00f,1.20f,1.00f, 0.10f,0.25f,0.55f},
};

// Pattern Lab knob state.
static float kaliBloomShape = 0.645f;
static float kaliBloomSpeed = 3.731f;
static float kaliBloomPalette = 0.418f;
static float kaliBloomSymmetry = 0.786f;

static float kaliBloomTime = 0.0f;

// Static subpixel coordinates before zoom.
// Two entries per panel coordinate correspond to SS=2 offsets 0.25 and 0.75.
static float kaliBloomBaseX[PANEL_RES_W][KALIBLOOM_SS];
static float kaliBloomBaseY[PANEL_RES_H][KALIBLOOM_SS];

// Frame-scaled coordinates. Rebuilt once per draw when breathing zoom changes.
static float kaliBloomFrameX[PANEL_RES_W][KALIBLOOM_SS];
static float kaliBloomFrameY[PANEL_RES_H][KALIBLOOM_SS];

// Mood-dependent palette LUT. Rebuilt only when Palette changes.
static uint8_t kaliBloomPaletteLUT[KALIBLOOM_PALETTE_LUT_SIZE][3];
static float kaliBloomPaletteBuiltFor = -1.0f;

// Constant nonlinearities baked once in setup().
static float kaliBloomGlowLUT[KALIBLOOM_GLOW_LUT_SIZE];
static float kaliBloomWebLUT[KALIBLOOM_WEB_LUT_SIZE];
static float kaliBloomToneLUT[KALIBLOOM_TONE_LUT_SIZE];

static float kaliBloomLookup(
    const float* table,
    int count,
    float value,
    float upperLimit
) {
    if (value <= 0.0f) {
        return table[0];
    }

    if (value >= upperLimit) {
        return table[count - 1];
    }

    const float scaled =
        value * ((float)(count - 1) / upperLimit);

    int index = PFMath::ifloor(scaled);

    if (index < 0) {
        index = 0;
    }

    if (index >= count - 1) {
        return table[count - 1];
    }

    const float blend = scaled - (float)index;

    return table[index] +
        (table[index + 1] - table[index]) * blend;
}

static float kaliBloomGlow(float trapDistance) {
    return kaliBloomLookup(
        kaliBloomGlowLUT,
        KALIBLOOM_GLOW_LUT_SIZE,
        trapDistance,
        KALIBLOOM_GLOW_LUT_LIMIT
    );
}

static float kaliBloomWeb(float axisDistance) {
    return kaliBloomLookup(
        kaliBloomWebLUT,
        KALIBLOOM_WEB_LUT_SIZE,
        axisDistance,
        KALIBLOOM_WEB_LUT_LIMIT
    );
}

static float kaliBloomTone(float value) {
    return kaliBloomLookup(
        kaliBloomToneLUT,
        KALIBLOOM_TONE_LUT_SIZE,
        value,
        KALIBLOOM_TONE_LUT_LIMIT
    );
}

static int kaliBloomPaletteIndex(float value) {
    const float wrapped = PFMath::fract(value);

    int index = PFMath::ifloor(
        wrapped * (float)KALIBLOOM_PALETTE_LUT_SIZE
    );

    if (index < 0) {
        index = 0;
    }

    if (index >= KALIBLOOM_PALETTE_LUT_SIZE) {
        index = KALIBLOOM_PALETTE_LUT_SIZE - 1;
    }

    return index;
}

static void kaliBloomBuildPalette() {
    const float mood = PFMath::fract(kaliBloomPalette);
    const float moodPosition =
        mood * (float)KALIBLOOM_PALETTE_COUNT;

    int first = PFMath::ifloor(moodPosition);

    if (first < 0) {
        first = 0;
    }

    if (first >= KALIBLOOM_PALETTE_COUNT) {
        first = 0;
    }

    const int second =
        (first + 1 < KALIBLOOM_PALETTE_COUNT)
            ? first + 1
            : 0;

    float blend =
        moodPosition - PFMath::floorF(moodPosition);

    blend =
        blend * blend * (3.0f - 2.0f * blend);

    const float* firstPalette = KALIBLOOM_PALETTES[first];
    const float* secondPalette = KALIBLOOM_PALETTES[second];

    float pa[12];

    for (int i = 0; i < 12; ++i) {
        pa[i] =
            firstPalette[i] +
            (secondPalette[i] - firstPalette[i]) * blend;
    }

    const float invCount =
        1.0f / (float)KALIBLOOM_PALETTE_LUT_SIZE;

    for (int i = 0; i < KALIBLOOM_PALETTE_LUT_SIZE; ++i) {
        const float paletteT = (float)i * invCount;

        for (int channel = 0; channel < 3; ++channel) {
            const float a = pa[channel];
            const float b = pa[3 + channel];
            const float c = pa[6 + channel];
            const float d = pa[9 + channel];

            float value =
                a + b * PFMath::fastCos(
                    TWO_PI * (c * paletteT + d)
                );

            if (value < 0.0f) {
                value = 0.0f;
            }

            value = PFMath::clamp01(value);

            kaliBloomPaletteLUT[i][channel] =
                (uint8_t)(value * 255.0f);
        }
    }

    kaliBloomPaletteBuiltFor = kaliBloomPalette;
}

static void kaliBloomSample(
    float ux,
    float uy,
    float foldX,
    float foldY,
    float colorPhase,
    float& outR,
    float& outG,
    float& outB
) {
    float zx = ux;
    float zy = uy;

    float trapPointSquared = 1.0e9f;
    float trapLine = 1.0e9f;

    for (int iteration = 0; iteration < KALIBLOOM_ITER; ++iteration) {
        zx = fabsf(zx);
        zy = fabsf(zy);

        const float distanceSquared =
            zx * zx + zy * zy + 1.0e-6f;

        const float inverseDistanceSquared =
            1.0f / distanceSquared;

        zx = zx * inverseDistanceSquared - foldX;
        zy = zy * inverseDistanceSquared - foldY;

        const float radiusSquared =
            zx * zx + zy * zy;

        if (radiusSquared < trapPointSquared) {
            trapPointSquared = radiusSquared;
        }

        const float absX = fabsf(zx);
        const float absY = fabsf(zy);
        const float lineDistance =
            absX < absY ? absX : absY;

        if (lineDistance < trapLine) {
            trapLine = lineDistance;
        }
    }

    // Dynamic orbit distance: sqrtf is retained here because the trap is
    // iteration-dependent and is also part of the palette coordinate.
    const float trapPoint = sqrtf(trapPointSquared);

    const float glow = kaliBloomGlow(trapPoint);
    const float web = kaliBloomWeb(trapLine);

    const float colorT =
        PFMath::fract(trapPoint * 0.6f + colorPhase);

    const int nodeIndex =
        kaliBloomPaletteIndex(colorT);

    const int accentIndex =
        kaliBloomPaletteIndex(colorT + 0.35f);

    const float nodeWeight =
        KALIBLOOM_AMBIENT +
        glow * KALIBLOOM_GLOW_GAIN;

    const float webWeight =
        web * KALIBLOOM_WEB_GAIN;

    outR =
        (
            (float)kaliBloomPaletteLUT[nodeIndex][0] * nodeWeight +
            (float)kaliBloomPaletteLUT[accentIndex][0] * webWeight
        ) * KALIBLOOM_INV_255;

    outG =
        (
            (float)kaliBloomPaletteLUT[nodeIndex][1] * nodeWeight +
            (float)kaliBloomPaletteLUT[accentIndex][1] * webWeight
        ) * KALIBLOOM_INV_255;

    outB =
        (
            (float)kaliBloomPaletteLUT[nodeIndex][2] * nodeWeight +
            (float)kaliBloomPaletteLUT[accentIndex][2] * webWeight
        ) * KALIBLOOM_INV_255;
}

void setup() {
    PFMath::buildSinLUT();
    PFTables::init();

    kaliBloomShape = 0.645f;
    kaliBloomSpeed = 3.731f;
    kaliBloomPalette = 0.418f;
    kaliBloomSymmetry = 0.786f;
    kaliBloomTime = 0.0f;
    kaliBloomPaletteBuiltFor = -1.0f;

    const float invWidth =
        1.0f / (float)PANEL_RES_W;

    const float invHeight =
        1.0f / (float)PANEL_RES_H;

    const float aspect =
        (float)PANEL_RES_W / (float)PANEL_RES_H;

    const float invSamples =
        1.0f / (float)KALIBLOOM_SS;

    for (int x = 0; x < PANEL_RES_W; ++x) {
        for (int sx = 0; sx < KALIBLOOM_SS; ++sx) {
            const float sampleOffset =
                ((float)sx + 0.5f) * invSamples;

            kaliBloomBaseX[x][sx] =
                (
                    ((float)x + sampleOffset) *
                    invWidth -
                    0.5f
                ) * 2.0f * aspect;
        }
    }

    for (int y = 0; y < PANEL_RES_H; ++y) {
        for (int sy = 0; sy < KALIBLOOM_SS; ++sy) {
            const float sampleOffset =
                ((float)sy + 0.5f) * invSamples;

            kaliBloomBaseY[y][sy] =
                (
                    ((float)y + sampleOffset) *
                    invHeight -
                    0.5f
                ) * 2.0f;
        }
    }

    for (int i = 0; i < KALIBLOOM_GLOW_LUT_SIZE; ++i) {
        const float x =
            (float)i *
            (
                KALIBLOOM_GLOW_LUT_LIMIT /
                (float)(KALIBLOOM_GLOW_LUT_SIZE - 1)
            );

        kaliBloomGlowLUT[i] =
            expf(-x * KALIBLOOM_GLOW_FALLOFF);
    }

    for (int i = 0; i < KALIBLOOM_WEB_LUT_SIZE; ++i) {
        const float x =
            (float)i *
            (
                KALIBLOOM_WEB_LUT_LIMIT /
                (float)(KALIBLOOM_WEB_LUT_SIZE - 1)
            );

        kaliBloomWebLUT[i] =
            expf(-x * KALIBLOOM_WEB_FALLOFF);
    }

    for (int i = 0; i < KALIBLOOM_TONE_LUT_SIZE; ++i) {
        const float x =
            (float)i *
            (
                KALIBLOOM_TONE_LUT_LIMIT /
                (float)(KALIBLOOM_TONE_LUT_SIZE - 1)
            );

        kaliBloomToneLUT[i] =
            x / (1.0f + x);
    }

    kaliBloomBuildPalette();
}

void update(float dt, const InputFrame& input) {
    PFParams::applyUnit(
        input,
        0,
        &kaliBloomShape,
        0.021f
    );

    PFParams::apply(
        input,
        1,
        &kaliBloomSpeed,
        0.1f,
        8.0f,
        0.165f
    );

    PFParams::applyUnit(
        input,
        2,
        &kaliBloomPalette,
        0.021f
    );

    PFParams::apply(
        input,
        3,
        &kaliBloomSymmetry,
        0.0f,
        1.0f,
        0.021f
    );

    if (kaliBloomPalette != kaliBloomPaletteBuiltFor) {
        kaliBloomBuildPalette();
    }

    kaliBloomTime += dt * kaliBloomSpeed;

    if (kaliBloomTime >= KALIBLOOM_TIME_PERIOD) {
        kaliBloomTime =
            PFMath::jsMod(
                kaliBloomTime,
                KALIBLOOM_TIME_PERIOD
            );
    }
}

void draw() {
    const float t = kaliBloomTime;

    // Fold constant: interpolate around the cyclic shape list.
    const float shapePosition =
        kaliBloomShape * (float)KALIBLOOM_SHAPE_COUNT;

    int shapeIndexA =
        PFMath::ifloor(shapePosition);

    if (shapeIndexA < 0) {
        shapeIndexA = 0;
    }

    if (shapeIndexA >= KALIBLOOM_SHAPE_COUNT) {
        shapeIndexA = 0;
    }

    const int shapeIndexB =
        (shapeIndexA + 1 < KALIBLOOM_SHAPE_COUNT)
            ? shapeIndexA + 1
            : 0;

    float shapeBlend =
        shapePosition -
        PFMath::floorF(shapePosition);

    shapeBlend =
        shapeBlend * shapeBlend *
        (3.0f - 2.0f * shapeBlend);

    const float baseFoldX =
        KALIBLOOM_SHAPES[shapeIndexA][0] +
        (
            KALIBLOOM_SHAPES[shapeIndexB][0] -
            KALIBLOOM_SHAPES[shapeIndexA][0]
        ) * shapeBlend;

    const float baseFoldY =
        KALIBLOOM_SHAPES[shapeIndexA][1] +
        (
            KALIBLOOM_SHAPES[shapeIndexB][1] -
            KALIBLOOM_SHAPES[shapeIndexA][1]
        ) * shapeBlend;

    const float foldX =
        baseFoldX +
        PFMath::fastSin(t * 0.11f) * 0.05f;

    const float foldY =
        baseFoldY +
        PFMath::fastCos(t * 0.09f) * 0.05f;

    int symmetryCount =
        1 + PFMath::ifloor(kaliBloomSymmetry * 9.0f);

    if (symmetryCount < 1) {
        symmetryCount = 1;
    }

    if (symmetryCount > 10) {
        symmetryCount = 10;
    }

    const float segment =
        TWO_PI / (float)symmetryCount;

    const float halfSegment =
        segment * 0.5f;

    const float inverseSegment =
        (float)symmetryCount / TWO_PI;

    const float spin =
        t * 0.05f;

    const float breathingZoom =
        1.30f +
        PFMath::fastSin(t * 0.07f) * 0.15f;

    const float colorPhase =
        PFMath::fract(t * 0.05f);

    // Scale constant subpixel coordinates only once per frame.
    for (int x = 0; x < PANEL_RES_W; ++x) {
        for (int sx = 0; sx < KALIBLOOM_SS; ++sx) {
            kaliBloomFrameX[x][sx] =
                kaliBloomBaseX[x][sx] *
                breathingZoom;
        }
    }

    for (int y = 0; y < PANEL_RES_H; ++y) {
        for (int sy = 0; sy < KALIBLOOM_SS; ++sy) {
            kaliBloomFrameY[y][sy] =
                kaliBloomBaseY[y][sy] *
                breathingZoom;
        }
    }

    // Matrices for every possible wedge. This replaces per-sample
    // atan2/sqrt/cos/sin in the kaleidoscope fold.
    float normalM00[10];
    float normalM01[10];
    float normalM10[10];
    float normalM11[10];

    float mirrorM00[10];
    float mirrorM01[10];
    float mirrorM10[10];
    float mirrorM11[10];

    const float reflectionCos =
        PFMath::fastCos(segment);

    const float reflectionSin =
        PFMath::fastSin(segment);

    for (int sector = 0; sector < symmetryCount; ++sector) {
        const float rotationAngle =
            spin - (float)sector * segment;

        const float rotationCos =
            PFMath::fastCos(rotationAngle);

        const float rotationSin =
            PFMath::fastSin(rotationAngle);

        normalM00[sector] = rotationCos;
        normalM01[sector] = -rotationSin;
        normalM10[sector] = rotationSin;
        normalM11[sector] = rotationCos;

        // Reflection across the half-segment axis, composed with the
        // spin/sector rotation.
        mirrorM00[sector] =
            reflectionCos * rotationCos +
            reflectionSin * rotationSin;

        mirrorM01[sector] =
            -reflectionCos * rotationSin +
            reflectionSin * rotationCos;

        mirrorM10[sector] =
            reflectionSin * rotationCos -
            reflectionCos * rotationSin;

        mirrorM11[sector] =
            -reflectionSin * rotationSin -
            reflectionCos * rotationCos;
    }

    constexpr float KALIBLOOM_SAMPLE_NORM =
        1.0f /
        (float)(KALIBLOOM_SS * KALIBLOOM_SS);

    for (int py = 0; py < PANEL_RES_H; ++py) {
        for (int px = 0; px < PANEL_RES_W; ++px) {
            int selectedSector = 0;
            bool useMirror = false;

            if (symmetryCount > 1) {
                const int pixelIndex =
                    py * PANEL_RES_W + px;

                const float centerAngle =
                    PFTables::thetaT[pixelIndex] + spin;

                const int rawSector =
                    PFMath::ifloor(
                        centerAngle * inverseSegment
                    );

                const float localAngle =
                    centerAngle -
                    (float)rawSector * segment;

                useMirror =
                    localAngle > halfSegment;

                selectedSector =
                    rawSector % symmetryCount;

                if (selectedSector < 0) {
                    selectedSector += symmetryCount;
                }
            }

            const float matrix00 =
                useMirror
                    ? mirrorM00[selectedSector]
                    : normalM00[selectedSector];

            const float matrix01 =
                useMirror
                    ? mirrorM01[selectedSector]
                    : normalM01[selectedSector];

            const float matrix10 =
                useMirror
                    ? mirrorM10[selectedSector]
                    : normalM10[selectedSector];

            const float matrix11 =
                useMirror
                    ? mirrorM11[selectedSector]
                    : normalM11[selectedSector];

            float accumulatedR = 0.0f;
            float accumulatedG = 0.0f;
            float accumulatedB = 0.0f;

            for (int sy = 0; sy < KALIBLOOM_SS; ++sy) {
                const float sourceY =
                    kaliBloomFrameY[py][sy];

                for (int sx = 0; sx < KALIBLOOM_SS; ++sx) {
                    const float sourceX =
                        kaliBloomFrameX[px][sx];

                    const float foldedX =
                        sourceX * matrix00 +
                        sourceY * matrix01;

                    const float foldedY =
                        sourceX * matrix10 +
                        sourceY * matrix11;

                    float sampleR;
                    float sampleG;
                    float sampleB;

                    kaliBloomSample(
                        foldedX,
                        foldedY,
                        foldX,
                        foldY,
                        colorPhase,
                        sampleR,
                        sampleG,
                        sampleB
                    );

                    accumulatedR += sampleR;
                    accumulatedG += sampleG;
                    accumulatedB += sampleB;
                }
            }

            float red =
                kaliBloomTone(
                    accumulatedR * KALIBLOOM_SAMPLE_NORM
                );

            float green =
                kaliBloomTone(
                    accumulatedG * KALIBLOOM_SAMPLE_NORM
                );

            float blue =
                kaliBloomTone(
                    accumulatedB * KALIBLOOM_SAMPLE_NORM
                );

            const float luminance =
                0.30f * red +
                0.59f * green +
                0.11f * blue;

            red =
                luminance +
                (red - luminance) *
                KALIBLOOM_SATURATION;

            green =
                luminance +
                (green - luminance) *
                KALIBLOOM_SATURATION;

            blue =
                luminance +
                (blue - luminance) *
                KALIBLOOM_SATURATION;

            red = PFMath::clamp01(red);
            green = PFMath::clamp01(green);
            blue = PFMath::clamp01(blue);

            PFCanvas::setPixel(
                px,
                py,
                (uint8_t)(red * 255.0f),
                (uint8_t)(green * 255.0f),
                (uint8_t)(blue * 255.0f)
            );
        }
    }

    PFCanvas::present();
}

} // namespace KaliBloom