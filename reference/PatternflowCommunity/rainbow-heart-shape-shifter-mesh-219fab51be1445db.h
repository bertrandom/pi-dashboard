#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_params.h"
#include "src/core_math.h"
#include "src/core_color.h"

namespace RainbowHeartShapeShifterMesh {

constexpr int FRAME_W = 64;
constexpr int FRAME_H = 128;

const char* NAME = "Rainbow Heart Shape Shifter Mesh";
const char* const KNOB_LABELS[4] = {"Glow", "WaveCycles", "ShapeShifter", "HeartScale"};

constexpr bool ABSOLUTE_READY = true;

// Knob state initialized from Pattern Lab values
static float kGlow = 0.0f;          // Min: 0.0, Max: 1.0, Step: 0.021
static float kWaveCycles = 2.0f;    // Min: 0.5, Max: 10.0, Step: 0.198
static float kShapeShifter = 4.9f;  // Min: 0.0, Max: 4.9, Step: 0.102
static float kHeartScale = 2.0f;    // Min: 0.5, Max: 3.0, Step: 0.052

static float timeAcc = 0.0f;

// Precomputed geometry grid to avoid recalculating col/row & mesh coordinates
static constexpr float GRID_SIZE = 5.705f;
static constexpr float INV_GRID_SIZE = 1.0f / 5.705f;
static constexpr float MAX_SHAPE_SIZE = 5.705f * 0.48f;

struct PixelGeo {
    float cellCx;
    float cellCy;
    float lx;
    float ly;
    int col;
    int row;
};

static PixelGeo geoGrid[FRAME_W * FRAME_H];

void setup() {
    PFMath::buildSinLUT();

    for (int y = 0; y < FRAME_H; y++) {
        int row = static_cast<int>(y * INV_GRID_SIZE);
        float cellCy = (row + 0.5f) * GRID_SIZE;

        for (int x = 0; x < FRAME_W; x++) {
            int col = static_cast<int>(x * INV_GRID_SIZE);
            float cellCx = (col + 0.5f) * GRID_SIZE;

            int idx = y * FRAME_W + x;
            geoGrid[idx].cellCx = cellCx;
            geoGrid[idx].cellCy = cellCy;
            geoGrid[idx].lx = x - cellCx;
            geoGrid[idx].ly = y - cellCy;
            geoGrid[idx].col = col;
            geoGrid[idx].row = row;
        }
    }
}

void update(float dt, const InputFrame& input) {
    PFParams::apply(input, 0, &kGlow, 0.0f, 1.0f, 0.021f);
    PFParams::apply(input, 1, &kWaveCycles, 0.5f, 10.0f, 0.198f);
    PFParams::apply(input, 2, &kShapeShifter, 0.0f, 4.9f, 0.102f);
    PFParams::apply(input, 3, &kHeartScale, 0.5f, 3.0f, 0.052f);

    timeAcc += dt * 1.0f;
    // Multipliers for time in radians: 5.0, 2.0, 0.3*TWO_PI
    // Wrap at 200.0 * PI to ensure seamless precision preservation across days
    constexpr float TIME_PERIOD = 200.0f * PI;
    if (timeAcc > TIME_PERIOD) {
        timeAcc -= TIME_PERIOD;
    }
}

void draw() {
    PFCanvas::setFrame(FRAME_W, FRAME_H);

    float glowBoost = kGlow;
    float waveCycles = kWaveCycles * 0.15f;
    int shapeMode = static_cast<int>(fmaxf(0.0f, fminf(4.0f, kShapeShifter)));
    float heartScale = fmaxf(0.2f, kHeartScale) * (fminf(FRAME_W, FRAME_H) * 0.08f);
    float invHeartScale = 1.0f / heartScale;

    constexpr float cx = FRAME_W * 0.5f;
    constexpr float cy = FRAME_H * 0.5f;

    float t = timeAcc;
    float t5 = t * 5.0f;
    float t2 = t * 2.0f;
    float tHue = t * 0.3f;

    for (int y = 0; y < FRAME_H; y++) {
        for (int x = 0; x < FRAME_W; x++) {
            int idx = y * FRAME_W + x;
            const PixelGeo& geo = geoGrid[idx];

            // 1. Calculate Heart Distance Metric for cell & pixel
            float cdx = (geo.cellCx - cx) * invHeartScale;
            float cdy = -(geo.cellCy - cy) * invHeartScale;
            float sqrtCdx = sqrtf(fabsf(cdx));
            float diffCellY = cdy - sqrtCdx;
            float cellHeartDist = sqrtf(cdx * cdx + diffCellY * diffCellY);

            float dx = (x - cx) * invHeartScale;
            float dy = -(y - cy) * invHeartScale;
            float sqrtDx = sqrtf(fabsf(dx));
            float diffPixY = dy - sqrtDx;
            float pixelHeartDist = sqrtf(dx * dx + diffPixY * diffPixY);

            // 2. Wave Phase & Rainbow Hue
            float wavePhase = pixelHeartDist * waveCycles * 10.0f - t5;
            float waveVal = PFMath::fastSin(wavePhase) * 0.5f + 0.5f;

            float rawHue = pixelHeartDist * waveCycles * 0.15f - tHue;
            float hue = PFMath::fract(rawHue);
            if (hue < 0.0f) hue += 1.0f;

            // 3. Rotating Shape Shifter Mesh Grid
            float rotAngle = (geo.col * 0.35f + geo.row * 0.35f) + t2 + PFMath::fastSin(cellHeartDist * 0.3f);
            float cosA = PFMath::fastCos(-rotAngle);
            float sinA = PFMath::fastSin(-rotAngle);

            float rx = geo.lx * cosA - geo.ly * sinA;
            float ry = geo.lx * sinA + geo.ly * cosA;

            float shapePulse = PFMath::fastSin(cellHeartDist * waveCycles * 10.0f - t5) * 0.5f + 0.5f;
            float shapeSize = (0.25f + shapePulse * 0.75f) * MAX_SHAPE_SIZE;

            // Shape Shifter SDF / Membership Test
            bool inShape = false;
            float distR = sqrtf(rx * rx + ry * ry);
            float angle = PFMath::fastAtan2(ry, rx);

            if (shapeMode == 0) {
                // Mode 0: Equilateral Triangle
                inShape = (ry < shapeSize * 0.5f) &&
                          (ry > -shapeSize) &&
                          (fabsf(rx) < (shapeSize - ry) * 0.57735f);
            } else if (shapeMode == 1) {
                // Mode 1: 5-Point Star
                float starMod = fabsf(PFMath::fastSin(angle * 2.5f)) * 0.5f + 0.5f;
                inShape = (distR < shapeSize * starMod * 0.95f);
            } else if (shapeMode == 2) {
                // Mode 2: Diamond (Rhombus)
                inShape = (fabsf(rx) + fabsf(ry) < shapeSize * 0.85f);
            } else if (shapeMode == 3) {
                // Mode 3: Circle
                inShape = (distR < shapeSize * 0.75f);
            } else {
                // Mode 4: 8/3 Eight-Pointed Star (Octagram)
                float octagramMod = fabsf(PFMath::fastSin(angle * 4.0f)) * 0.65f + 0.35f;
                inShape = (distR < shapeSize * octagramMod * 0.9f);
            }

            uint8_t r = 0, g = 0, b = 0;

            if (inShape) {
                // Shape foreground element with Glow Boost (Knob 1)
                float shapeSat = 0.85f - glowBoost * 0.3f;
                float shapeVal = fminf(1.0f, 0.75f + waveVal * 0.25f + glowBoost * 0.25f);

                PFColor::hsvToRgb(hue, shapeSat, shapeVal, r, g, b);

                // Glow boost bloom core
                if (glowBoost > 0.05f) {
                    float gb = fminf(1.0f, glowBoost * 0.8f);
                    float invGb = 1.0f - gb;
                    r = static_cast<uint8_t>(r * invGb + 255.0f * gb);
                    g = static_cast<uint8_t>(g * invGb + 255.0f * gb);
                    b = static_cast<uint8_t>(b * invGb + 255.0f * gb);
                }
            } else {
                // Background Concentric Pulsating Heart Rainbow Wave
                float bgSat = 0.95f;
                float bgVal = fminf(1.0f, (0.22f + waveVal * 0.58f) * (0.8f + glowBoost * 0.4f));

                PFColor::hsvToRgb(hue, bgSat, bgVal, r, g, b);
            }

            PFCanvas::setPixel(x, y, r, g, b);
        }
    }

    PFCanvas::present();
}

} // namespace RainbowHeartShapeShifterMesh