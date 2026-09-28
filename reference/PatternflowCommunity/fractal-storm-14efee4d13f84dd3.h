#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_params.h"
#include "src/core_math.h"
#include "src/core_noise.h"
#include "src/core_tables.h"

namespace FractalStorm {

const char* NAME = "Fractal Storm";
const char* const KNOB_LABELS[4] = {"Chaos", "Speed", "Palette", "Symmetry"};
constexpr bool ABSOLUTE_READY = true;

// ===== Patternflow pattern =====
// Title:   FractalStorm
// Author:  (your name / handle)
// Date:    2026-09-12
// SPDX-License-Identifier: CC-BY-SA-4.0
//
// ESP32-S3 optimized version, pass 3:
// - 2x2 half-resolution rendering (original detail level — see note below)
// - q1/q2: 2 ridged octaves, r1/r2: 3 ridged octaves, field: 4 ridged octaves
//   (all original counts — full detail restored)
// - palette / brightness / edge / tonemap LUTs
// - fixed-center angle from PFTables::thetaT
// - FIX: palette LUT rebuild is now gated by an epsilon instead of exact
//   float equality, so it no longer rebuilds the full 1024x3 cosine LUT
//   every single frame from analog knob jitter. This was almost certainly
//   the actual cause of the original lag (~3000+ fastCos calls/frame that
//   had nothing to do with rendering the storm itself) — so full sampling
//   resolution and octave counts are restored here rather than also cutting
//   detail that likely wasn't the problem.
//
// If it's STILL laggy after this fix alone, raise FRACTALSTORM_BLOCK_SIZE to
// 3 before touching octave counts — try one dial at a time and measure (e.g.
// wrap draw() in micros() timestamps) rather than stacking changes, so you
// know what's actually buying you the speed.
//
// If block size alone isn't enough, the next suspect is PFNoise::valueNoise2D
// itself: this pattern calls it up to 14 times per rendered sample. If that
// hash uses sinf()/transcendentals per lattice corner rather than an integer
// bit-mixing hash, that's likely the largest remaining cost — worth checking
// core_noise.h.
//
// Shared under CC-BY-SA-4.0.

// ── Pattern constants ──────────────────────────────────────────────────────────

static constexpr float FRACTALSTORM_LACUNARITY = 2.03f;
static constexpr float FRACTALSTORM_WARP_LIMIT = 5.0f;

static constexpr float FRACTALSTORM_LIT_LO = 0.36f;
static constexpr float FRACTALSTORM_LIT_HI = 0.82f;
static constexpr float FRACTALSTORM_INV_LIT_RANGE =
    1.0f / (FRACTALSTORM_LIT_HI - FRACTALSTORM_LIT_LO);

static constexpr float FRACTALSTORM_SOFT_GAIN = 0.55f;
static constexpr float FRACTALSTORM_CORE_GAIN = 4.5f;
static constexpr float FRACTALSTORM_EDGE_GAIN = 1.1f;
static constexpr float FRACTALSTORM_EDGE_SHARPNESS = 20.0f;
static constexpr float FRACTALSTORM_SATURATION = 1.50f;

static constexpr int FRACTALSTORM_PALETTE_COUNT = 6;

static constexpr int FRACTALSTORM_PALETTE_LUT_SIZE = 1024;
static constexpr int FRACTALSTORM_BRIGHT_LUT_SIZE = 1024;
static constexpr int FRACTALSTORM_EDGE_LUT_SIZE = 1024;
static constexpr int FRACTALSTORM_TONE_LUT_SIZE = 2048;

static constexpr float FRACTALSTORM_TONE_LIMIT = 6.5f;
static constexpr float FRACTALSTORM_INV_255 = 1.0f / 255.0f;

// t feeds multipliers 0.06, 0.08, 0.09, 0.10, 0.14 and 0.15.
// TWO_PI * 100 is a common seamless period for all of them.
static constexpr float FRACTALSTORM_TIME_PERIOD = TWO_PI * 100.0f;

// Ridged octave normalization (sum of weights, inverted):
// 2 octaves: 0.5 + 0.25 = 0.75
// 3 octaves: +0.125      = 0.875
// 4 octaves: +0.0625     = 0.9375
static constexpr float FRACTALSTORM_RIDGE_INV_2 = 1.3333333333f;
static constexpr float FRACTALSTORM_RIDGE_INV_3 = 1.1428571429f;
static constexpr float FRACTALSTORM_RIDGE_INV_4 = 1.0666666667f;

// How many source samples to compute per axis before replicating the colour
// across a BLOCK_SIZE x BLOCK_SIZE tile of output pixels. Cost scales with
// 1/BLOCK_SIZE^2. Back to the original 2x2 (full detail) now that the real
// bottleneck — the palette LUT rebuilding every frame, see update() below —
// is fixed. Only raise this if you profile and find you still need the
// headroom; each step up costs visible sharpness. Must evenly divide
// PANEL_RES_W/H for clean tiling (128x64 divides cleanly by 2, 4, and 8).
static constexpr int FRACTALSTORM_BLOCK_SIZE = 2;

// ── IQ cosine palettes ─────────────────────────────────────────────────────────
// aR,aG,aB, bR,bG,bB, cR,cG,cB, dR,dG,dB

static constexpr float FRACTALSTORM_PALETTES[FRACTALSTORM_PALETTE_COUNT][12] = {
    {
        0.50f,0.50f,0.50f,
        0.50f,0.50f,0.50f,
        1.00f,1.00f,1.00f,
        0.00f,0.33f,0.67f
    },
    {
        0.50f,0.50f,0.50f,
        0.50f,0.50f,0.50f,
        1.00f,1.00f,1.00f,
        0.50f,0.20f,0.25f
    },
    {
        0.50f,0.50f,0.50f,
        0.50f,0.50f,0.50f,
        2.00f,1.00f,1.00f,
        0.00f,0.25f,0.50f
    },
    {
        0.50f,0.50f,0.50f,
        0.50f,0.50f,0.50f,
        1.00f,1.00f,0.50f,
        0.80f,0.90f,0.30f
    },
    {
        0.50f,0.50f,1.00f,
       -0.50f,0.50f,0.00f,
        1.00f,1.00f,1.00f,
        0.00f,0.00f,0.00f
    },
    {
        0.55f,0.20f,0.80f,
       -0.45f,0.10f,0.20f,
        1.00f,1.00f,1.00f,
        0.00f,0.00f,0.00f
    },
};

// ── Knob state ─────────────────────────────────────────────────────────────────

static float fractalStormChaos = 0.052f;
static float fractalStormSpeed = 1.625f;
static float fractalStormPalette = 0.23f;
static float fractalStormSymmetry = 0.357f;

static float fractalStormTime = 0.0f;

// ── Coordinate lookup tables ───────────────────────────────────────────────────

// Sample at the centre of each BLOCK_SIZE x BLOCK_SIZE rendering block.
// These depend only on panel geometry and are built once.
static float fractalStormBaseX[PANEL_RES_W];
static float fractalStormBaseY[PANEL_RES_H];

// ── Colour / tone lookup tables ────────────────────────────────────────────────

static uint8_t fractalStormPaletteLUT[FRACTALSTORM_PALETTE_LUT_SIZE][3];
static float fractalStormPaletteBuiltFor = -1.0f;

// How much fractalStormPalette must move before the LUT is worth rebuilding.
// Set to roughly one LUT slot's worth of resolution — smaller changes than
// this wouldn't visibly change the LUT anyway, so there's no point rebuilding
// on knob jitter. This is what stops the pattern from redoing ~3000 fastCos
// calls every single frame the knob is merely sitting still but noisy.
static constexpr float FRACTALSTORM_PALETTE_REBUILD_EPS =
    1.0f / (float)FRACTALSTORM_PALETTE_LUT_SIZE;

static float fractalStormBrightLUT[FRACTALSTORM_BRIGHT_LUT_SIZE];
static float fractalStormEdgeLUT[FRACTALSTORM_EDGE_LUT_SIZE];
static float fractalStormToneLUT[FRACTALSTORM_TONE_LUT_SIZE];

// ── Ridged turbulence helpers ──────────────────────────────────────────────────

static inline float fractalStormRidgeValue(float x, float y) {
    const float noiseValue = PFNoise::valueNoise2D(x, y);
    return 1.0f - fabsf(2.0f * noiseValue - 1.0f);
}

static inline float fractalStormRidged2(float x, float y) {
    const float ridge0 =
        fractalStormRidgeValue(x, y);

    x *= FRACTALSTORM_LACUNARITY;
    y *= FRACTALSTORM_LACUNARITY;

    const float ridge1 =
        fractalStormRidgeValue(x, y);

    return (
        ridge0 * 0.5f +
        ridge1 * 0.25f
    ) * FRACTALSTORM_RIDGE_INV_2;
}

static inline float fractalStormRidged3(float x, float y) {
    const float ridge0 =
        fractalStormRidgeValue(x, y);

    x *= FRACTALSTORM_LACUNARITY;
    y *= FRACTALSTORM_LACUNARITY;

    const float ridge1 =
        fractalStormRidgeValue(x, y);

    x *= FRACTALSTORM_LACUNARITY;
    y *= FRACTALSTORM_LACUNARITY;

    const float ridge2 =
        fractalStormRidgeValue(x, y);

    return (
        ridge0 * 0.5f +
        ridge1 * 0.25f +
        ridge2 * 0.125f
    ) * FRACTALSTORM_RIDGE_INV_3;
}

static inline float fractalStormRidged4(float x, float y) {
    const float ridge0 =
        fractalStormRidgeValue(x, y);

    x *= FRACTALSTORM_LACUNARITY;
    y *= FRACTALSTORM_LACUNARITY;

    const float ridge1 =
        fractalStormRidgeValue(x, y);

    x *= FRACTALSTORM_LACUNARITY;
    y *= FRACTALSTORM_LACUNARITY;

    const float ridge2 =
        fractalStormRidgeValue(x, y);

    x *= FRACTALSTORM_LACUNARITY;
    y *= FRACTALSTORM_LACUNARITY;

    const float ridge3 =
        fractalStormRidgeValue(x, y);

    return (
        ridge0 * 0.5f +
        ridge1 * 0.25f +
        ridge2 * 0.125f +
        ridge3 * 0.0625f
    ) * FRACTALSTORM_RIDGE_INV_4;
}

// ── LUT helpers ────────────────────────────────────────────────────────────────

static inline int fractalStormPaletteIndex(float value) {
    const float wrapped = PFMath::fract(value);

    int index =
        PFMath::ifloor(
            wrapped * (float)FRACTALSTORM_PALETTE_LUT_SIZE
        );

    if (index < 0) {
        index = 0;
    }

    if (index >= FRACTALSTORM_PALETTE_LUT_SIZE) {
        index = FRACTALSTORM_PALETTE_LUT_SIZE - 1;
    }

    return index;
}

static inline float fractalStormBright(float fieldValue) {
    const float bounded = PFMath::clamp01(fieldValue);

    int index =
        PFMath::ifloor(
            bounded *
            (float)(FRACTALSTORM_BRIGHT_LUT_SIZE - 1) +
            0.5f
        );

    if (index < 0) {
        index = 0;
    }

    if (index >= FRACTALSTORM_BRIGHT_LUT_SIZE) {
        index = FRACTALSTORM_BRIGHT_LUT_SIZE - 1;
    }

    return fractalStormBrightLUT[index];
}

static inline float fractalStormEdge(float difference) {
    const float bounded = PFMath::clamp01(difference);

    int index =
        PFMath::ifloor(
            bounded *
            (float)(FRACTALSTORM_EDGE_LUT_SIZE - 1) +
            0.5f
        );

    if (index < 0) {
        index = 0;
    }

    if (index >= FRACTALSTORM_EDGE_LUT_SIZE) {
        index = FRACTALSTORM_EDGE_LUT_SIZE - 1;
    }

    return fractalStormEdgeLUT[index];
}

static inline float fractalStormTone(float value) {
    if (value <= 0.0f) {
        return 0.0f;
    }

    if (value >= FRACTALSTORM_TONE_LIMIT) {
        return fractalStormToneLUT[
            FRACTALSTORM_TONE_LUT_SIZE - 1
        ];
    }

    const float scaled =
        value *
        (
            (float)(FRACTALSTORM_TONE_LUT_SIZE - 1) /
            FRACTALSTORM_TONE_LIMIT
        );

    int index = PFMath::ifloor(scaled);

    if (index < 0) {
        index = 0;
    }

    if (index >= FRACTALSTORM_TONE_LUT_SIZE - 1) {
        return fractalStormToneLUT[
            FRACTALSTORM_TONE_LUT_SIZE - 1
        ];
    }

    const float blend =
        scaled - (float)index;

    return fractalStormToneLUT[index] +
        (
            fractalStormToneLUT[index + 1] -
            fractalStormToneLUT[index]
        ) * blend;
}

// ── Palette generation ─────────────────────────────────────────────────────────

static void fractalStormBuildPalette() {
    const float moodPosition =
        fractalStormPalette *
        (float)FRACTALSTORM_PALETTE_COUNT;

    int firstIndex =
        PFMath::ifloor(moodPosition);

    if (firstIndex < 0) {
        firstIndex = 0;
    }

    if (firstIndex >= FRACTALSTORM_PALETTE_COUNT) {
        firstIndex = 0;
    }

    const int secondIndex =
        (firstIndex + 1 < FRACTALSTORM_PALETTE_COUNT)
            ? firstIndex + 1
            : 0;

    float blend =
        moodPosition -
        PFMath::floorF(moodPosition);

    blend =
        blend * blend *
        (3.0f - 2.0f * blend);

    const float* firstPalette =
        FRACTALSTORM_PALETTES[firstIndex];

    const float* secondPalette =
        FRACTALSTORM_PALETTES[secondIndex];

    float blended[12];

    for (int i = 0; i < 12; ++i) {
        blended[i] =
            firstPalette[i] +
            (
                secondPalette[i] -
                firstPalette[i]
            ) * blend;
    }

    const float inverseTableSize =
        1.0f / (float)FRACTALSTORM_PALETTE_LUT_SIZE;

    for (
        int index = 0;
        index < FRACTALSTORM_PALETTE_LUT_SIZE;
        ++index
    ) {
        const float paletteT =
            (float)index * inverseTableSize;

        for (int channel = 0; channel < 3; ++channel) {
            const float base =
                blended[channel];

            const float amplitude =
                blended[3 + channel];

            const float frequency =
                blended[6 + channel];

            const float phase =
                blended[9 + channel];

            float value =
                base +
                amplitude *
                PFMath::fastCos(
                    TWO_PI *
                    (
                        frequency * paletteT +
                        phase
                    )
                );

            if (value < 0.0f) {
                value = 0.0f;
            }

            value = PFMath::clamp01(value);

            fractalStormPaletteLUT[index][channel] =
                (uint8_t)(value * 255.0f);
        }
    }

    fractalStormPaletteBuiltFor =
        fractalStormPalette;
}

// ── Setup ──────────────────────────────────────────────────────────────────────

void setup() {
    PFMath::buildSinLUT();
    PFTables::init();

    fractalStormChaos = 0.052f;
    fractalStormSpeed = 1.625f;
    fractalStormPalette = 0.23f;
    fractalStormSymmetry = 0.357f;

    fractalStormTime = 0.0f;
    fractalStormPaletteBuiltFor = -1.0f;

    const float inverseWidth =
        1.0f / (float)PANEL_RES_W;

    const float inverseHeight =
        1.0f / (float)PANEL_RES_H;

    const float aspect =
        (float)PANEL_RES_W /
        (float)PANEL_RES_H;

    // Centre the coordinate sample inside each block.
    for (int x = 0; x < PANEL_RES_W; ++x) {
        fractalStormBaseX[x] =
            (
                ((float)x + 0.5f) *
                inverseWidth -
                0.5f
            ) * aspect;
    }

    for (int y = 0; y < PANEL_RES_H; ++y) {
        fractalStormBaseY[y] =
            (
                ((float)y + 0.5f) *
                inverseHeight -
                0.5f
            );
    }

    // Field → brightness LUT.
    for (
        int index = 0;
        index < FRACTALSTORM_BRIGHT_LUT_SIZE;
        ++index
    ) {
        const float fieldValue =
            (float)index /
            (float)(FRACTALSTORM_BRIGHT_LUT_SIZE - 1);

        float ease =
            (fieldValue - FRACTALSTORM_LIT_LO) *
            FRACTALSTORM_INV_LIT_RANGE;

        ease = PFMath::clamp01(ease);

        ease =
            ease * ease *
            (3.0f - 2.0f * ease);

        const float luminance =
            ease * ease *
            (3.0f - 2.0f * ease);

        const float luminanceSquared =
            luminance * luminance;

        const float luminanceCubed =
            luminanceSquared * luminance;

        fractalStormBrightLUT[index] =
            luminance *
            FRACTALSTORM_SOFT_GAIN +
            luminanceCubed *
            FRACTALSTORM_CORE_GAIN;
    }

    // |r1-r2| → lightning edge intensity LUT.
    for (
        int index = 0;
        index < FRACTALSTORM_EDGE_LUT_SIZE;
        ++index
    ) {
        const float difference =
            (float)index /
            (float)(FRACTALSTORM_EDGE_LUT_SIZE - 1);

        fractalStormEdgeLUT[index] =
            expf(
                -difference *
                FRACTALSTORM_EDGE_SHARPNESS
            );
    }

    // x / (1+x) highlight rolloff LUT.
    for (
        int index = 0;
        index < FRACTALSTORM_TONE_LUT_SIZE;
        ++index
    ) {
        const float value =
            (float)index *
            (
                FRACTALSTORM_TONE_LIMIT /
                (float)(FRACTALSTORM_TONE_LUT_SIZE - 1)
            );

        fractalStormToneLUT[index] =
            value / (1.0f + value);
    }

    fractalStormBuildPalette();
}

// ── Update ─────────────────────────────────────────────────────────────────────

void update(float dt, const InputFrame& input) {
    PFParams::apply(
        input,
        0,
        &fractalStormChaos,
        0.0f,
        1.0f,
        0.021f
    );

    PFParams::apply(
        input,
        1,
        &fractalStormSpeed,
        0.1f,
        8.0f,
        0.165f
    );

    PFParams::apply(
        input,
        2,
        &fractalStormPalette,
        0.0f,
        1.0f,
        0.021f
    );

    PFParams::apply(
        input,
        3,
        &fractalStormSymmetry,
        0.0f,
        1.0f,
        0.021f
    );

    // FIX: was an exact float equality check, which meant every frame of
    // analog knob jitter rebuilt the entire 1024-entry x 3-channel cosine
    // LUT (~3000+ fastCos calls) even with the knob untouched. Now only
    // rebuilds once the knob has moved far enough to actually change the
    // LUT's output.
    if (
        fabsf(fractalStormPalette - fractalStormPaletteBuiltFor) >
        FRACTALSTORM_PALETTE_REBUILD_EPS
    ) {
        fractalStormBuildPalette();
    }

    fractalStormTime +=
        dt * fractalStormSpeed;

    if (
        fractalStormTime >=
        FRACTALSTORM_TIME_PERIOD
    ) {
        fractalStormTime =
            PFMath::jsMod(
                fractalStormTime,
                FRACTALSTORM_TIME_PERIOD
            );
    }
}

// ── Draw ───────────────────────────────────────────────────────────────────────

void draw() {
    const float t =
        fractalStormTime;

    const float fieldScale =
        2.6f +
        PFMath::fastSin(t * 0.08f) *
        0.8f;

    const float warpStrength =
        fractalStormChaos *
        FRACTALSTORM_WARP_LIMIT;

    int symmetryCount =
        1 +
        PFMath::ifloor(
            fractalStormSymmetry * 11.0f
        );

    if (symmetryCount < 1) {
        symmetryCount = 1;
    }

    if (symmetryCount > 12) {
        symmetryCount = 12;
    }

    const float segment =
        TWO_PI /
        (float)symmetryCount;

    const float halfSegment =
        segment * 0.5f;

    const float inverseSegment =
        (float)symmetryCount /
        TWO_PI;

    const float spin =
        t * 0.15f;

    const float driftX =
        t * 0.09f;

    const float driftY =
        t * 0.06f;

    const float colorDrift =
        PFMath::fract(
            t * 0.14f
        );

    const float r1TimeOffset =
        t * 0.10f;

    const float r2TimeOffset =
        t * 0.08f;

    // Precompute all possible kaleidoscope transform matrices once per frame.
    float normalM00[12];
    float normalM01[12];
    float normalM10[12];
    float normalM11[12];

    float mirrorM00[12];
    float mirrorM01[12];
    float mirrorM10[12];
    float mirrorM11[12];

    const float reflectionCos =
        PFMath::fastCos(segment);

    const float reflectionSin =
        PFMath::fastSin(segment);

    for (
        int sector = 0;
        sector < symmetryCount;
        ++sector
    ) {
        const float rotation =
            spin -
            (float)sector *
            segment;

        const float rotationCos =
            PFMath::fastCos(rotation);

        const float rotationSin =
            PFMath::fastSin(rotation);

        normalM00[sector] =
            rotationCos;

        normalM01[sector] =
            -rotationSin;

        normalM10[sector] =
            rotationSin;

        normalM11[sector] =
            rotationCos;

        // Reflection across the wedge axis composed with rotation.
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

    // Downsampled render: evaluate one storm sample for every
    // BLOCK_SIZE x BLOCK_SIZE output block, then replicate it across the
    // block. This is the main cost lever — see FRACTALSTORM_BLOCK_SIZE above.
    for (int py = 0; py < PANEL_RES_H; py += FRACTALSTORM_BLOCK_SIZE) {
        const float sourceY =
            fractalStormBaseY[py] *
            fieldScale;

        for (int px = 0; px < PANEL_RES_W; px += FRACTALSTORM_BLOCK_SIZE) {
            const float sourceX =
                fractalStormBaseX[px] *
                fieldScale;

            float ux;
            float uy;

            if (symmetryCount > 1) {
                // Fixed-centre angle comes from the shared firmware table.
                const int tableIndex =
                    py * PANEL_RES_W + px;

                const float spunAngle =
                    PFTables::thetaT[tableIndex] +
                    spin;

                const int rawSector =
                    PFMath::ifloor(
                        spunAngle *
                        inverseSegment
                    );

                const float localAngle =
                    spunAngle -
                    (float)rawSector *
                    segment;

                const bool mirrored =
                    localAngle >
                    halfSegment;

                int sector =
                    rawSector %
                    symmetryCount;

                if (sector < 0) {
                    sector +=
                        symmetryCount;
                }

                if (mirrored) {
                    ux =
                        sourceX *
                            mirrorM00[sector] +
                        sourceY *
                            mirrorM01[sector];

                    uy =
                        sourceX *
                            mirrorM10[sector] +
                        sourceY *
                            mirrorM11[sector];
                } else {
                    ux =
                        sourceX *
                            normalM00[sector] +
                        sourceY *
                            normalM01[sector];

                    uy =
                        sourceX *
                            normalM10[sector] +
                        sourceY *
                            normalM11[sector];
                }
            } else {
                ux =
                    sourceX *
                        normalM00[0] +
                    sourceY *
                        normalM01[0];

                uy =
                    sourceX *
                        normalM10[0] +
                    sourceY *
                        normalM11[0];
            }

            const float baseX =
                ux + driftX;

            const float baseY =
                uy + driftY;

            // First-level domain warp: 2 octaves. These only steer the
            // deeper fields, so this stays lighter than the final field.
            const float q1 =
                fractalStormRidged2(
                    baseX,
                    baseY
                );

            const float q2 =
                fractalStormRidged2(
                    baseX + 3.2f,
                    baseY + 1.7f
                );

            const float warpedQ1 =
                warpStrength * q1;

            const float warpedQ2 =
                warpStrength * q2;

            // Secondary warp fields: 3 octaves.
            const float r1 =
                fractalStormRidged3(
                    baseX +
                        warpedQ1 +
                        1.7f +
                        r1TimeOffset,
                    baseY +
                        warpedQ2 +
                        9.2f
                );

            const float r2 =
                fractalStormRidged3(
                    baseX +
                        warpedQ1 +
                        8.3f,
                    baseY +
                        warpedQ2 +
                        2.8f +
                        r2TimeOffset
                );

            // Final visible field: 4 octaves for fine structure.
            const float field =
                fractalStormRidged4(
                    baseX +
                        warpStrength * r1,
                    baseY +
                        warpStrength * r2
                );

            const float brightness =
                fractalStormBright(
                    field
                );

            const float edge =
                fractalStormEdge(
                    fabsf(r1 - r2)
                );

            const float hue =
                PFMath::fract(
                    field * 1.3f +
                    r1 * 0.7f +
                    q1 * 0.4f +
                    colorDrift
                );

            const int mainPaletteIndex =
                fractalStormPaletteIndex(
                    hue
                );

            const int accentPaletteIndex =
                fractalStormPaletteIndex(
                    hue + 0.4f
                );

            const float edgeBrightness =
                edge *
                FRACTALSTORM_EDGE_GAIN;

            float red =
                (
                    (float)
                    fractalStormPaletteLUT
                        [mainPaletteIndex][0] *
                    brightness +
                    (float)
                    fractalStormPaletteLUT
                        [accentPaletteIndex][0] *
                    edgeBrightness
                ) *
                FRACTALSTORM_INV_255;

            float green =
                (
                    (float)
                    fractalStormPaletteLUT
                        [mainPaletteIndex][1] *
                    brightness +
                    (float)
                    fractalStormPaletteLUT
                        [accentPaletteIndex][1] *
                    edgeBrightness
                ) *
                FRACTALSTORM_INV_255;

            float blue =
                (
                    (float)
                    fractalStormPaletteLUT
                        [mainPaletteIndex][2] *
                    brightness +
                    (float)
                    fractalStormPaletteLUT
                        [accentPaletteIndex][2] *
                    edgeBrightness
                ) *
                FRACTALSTORM_INV_255;

            // Soft highlight compression.
            red =
                fractalStormTone(red);

            green =
                fractalStormTone(green);

            blue =
                fractalStormTone(blue);

            // Saturation pop.
            const float luminance =
                0.30f * red +
                0.59f * green +
                0.11f * blue;

            red =
                luminance +
                (
                    red -
                    luminance
                ) *
                FRACTALSTORM_SATURATION;

            green =
                luminance +
                (
                    green -
                    luminance
                ) *
                FRACTALSTORM_SATURATION;

            blue =
                luminance +
                (
                    blue -
                    luminance
                ) *
                FRACTALSTORM_SATURATION;

            red =
                PFMath::clamp01(red);

            green =
                PFMath::clamp01(green);

            blue =
                PFMath::clamp01(blue);

            const uint8_t red8 =
                (uint8_t)(
                    red * 255.0f
                );

            const uint8_t green8 =
                (uint8_t)(
                    green * 255.0f
                );

            const uint8_t blue8 =
                (uint8_t)(
                    blue * 255.0f
                );

            // Expand the single calculated sample across the whole
            // BLOCK_SIZE x BLOCK_SIZE output block.
            const int blockHeight =
                (py + FRACTALSTORM_BLOCK_SIZE <= PANEL_RES_H)
                    ? FRACTALSTORM_BLOCK_SIZE
                    : (PANEL_RES_H - py);

            const int blockWidth =
                (px + FRACTALSTORM_BLOCK_SIZE <= PANEL_RES_W)
                    ? FRACTALSTORM_BLOCK_SIZE
                    : (PANEL_RES_W - px);

            for (int by = 0; by < blockHeight; ++by) {
                for (int bx = 0; bx < blockWidth; ++bx) {
                    PFCanvas::setPixel(
                        px + bx,
                        py + by,
                        red8,
                        green8,
                        blue8
                    );
                }
            }
        }
    }

    PFCanvas::present();
}

} // namespace FractalStorm