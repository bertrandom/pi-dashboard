#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_params.h"
#include "src/core_math.h"
#include "src/core_mem.h"

namespace Soundsqure {

constexpr int FRAME_W = 64;
constexpr int FRAME_H = 128;

const char* NAME = "Soundsqure";
const char* const KNOB_LABELS[4] = {"StepSize", "PhaseStep", "Contour", "Scale"};
constexpr bool ABSOLUTE_READY = true;

static float knobStepSize = 1.0f;
static float knobPhaseStep = 15.0f;
static float knobContour = 1.0f;
static float knobScale = 1.0f;

static float* bufA = nullptr;
static float* bufB = nullptr;
static float maxEma = 1.0f;
static int prevPhaseStep = -1;

static const uint8_t RAMP_LUT[256][3] = {
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
  {1,1,1},{1,1,1},{1,1,1},{1,1,1},{1,1,1},{1,1,1},{1,1,1},{1,1,1},
  {2,2,2},{2,2,2},{2,2,2},{2,2,2},{3,3,3},{3,3,3},{3,3,3},{4,4,4},
  {4,4,4},{4,4,4},{5,5,5},{5,5,5},{6,6,6},{6,6,6},{7,7,7},{7,7,7},
  {8,8,8},{8,8,8},{9,9,9},{10,10,10},{10,10,10},{11,11,11},{12,12,12},{13,13,13},
  {13,13,13},{14,14,14},{15,15,15},{15,15,15},{16,16,16},{17,17,17},{18,18,18},{18,18,18},
  {19,19,19},{20,20,20},{20,20,20},{21,21,21},{22,22,22},{23,23,23},{23,23,23},{24,24,24},
  {25,25,25},{26,26,26},{27,27,27},{27,27,27},{28,28,28},{29,29,29},{30,30,30},{30,30,30},
  {31,31,31},{32,32,32},{33,33,33},{34,34,34},{34,34,34},{35,35,35},{36,36,36},{37,37,37},
  {38,38,38},{38,38,38},{39,39,39},{40,40,40},{41,41,41},{42,42,42},{42,42,42},{43,43,43},
  {44,44,44},{45,45,45},{46,46,46},{47,47,47},{47,47,47},{48,48,48},{49,49,49},{50,50,50},
  {51,51,51},{52,52,52},{52,52,52},{53,53,53},{54,54,54},{55,55,55},{56,56,56},{57,57,57},
  {58,58,58},{58,58,58},{59,59,59},{60,60,60},{61,61,61},{62,62,62},{63,63,63},{64,64,64},
  {65,65,65},{65,65,65},{66,66,66},{67,67,67},{68,68,68},{69,69,69},{70,70,70},{71,71,71},
  {72,72,72},{73,73,73},{73,73,73},{74,74,74},{75,75,75},{76,76,76},{77,77,77},{79,82,78},
  {79,88,81},{78,93,85},{76,99,92},{73,104,99},{70,109,109},{67,114,119},{66,118,131},{68,121,143},
  {73,123,155},{81,125,167},{93,126,178},{106,127,187},{121,126,195},{138,126,200},{154,124,203},{171,123,202},
  {188,122,199},{205,120,193},{221,119,183},{236,119,171},{249,120,156},{255,127,141},{255,138,130},{255,148,120},
  {255,158,111},{255,167,100},{255,176,85},{255,185,56},{250,196,0},{238,209,0},{223,222,0},{201,236,0},
  {164,253,0},{103,253,83},{0,246,130},{0,233,165},{0,220,182},{0,208,192},{0,196,198},{0,184,202},
  {0,172,205},{0,160,209},{0,147,216},{21,132,225},{65,117,215},{85,103,202},{97,90,185},{105,78,167},
  {108,67,147},{109,57,127},{107,49,107},{103,41,87},{97,34,68},{89,29,51},{80,24,36},{70,21,22},
  {60,18,9},{49,15,1},{37,13,0},{25,10,0},{16,7,0},{8,4,0},{3,2,0},{1,1,0},
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{1,0,0},{2,0,0},{3,0,0},{4,1,0},
  {5,2,0},{6,4,0},{8,5,0},{9,8,0},{10,11,0},{11,15,0},{10,19,0},{7,24,0},
  {0,29,0},{0,32,9},{0,35,18},{0,38,25},{0,41,32},{0,44,38},{0,48,45},{0,51,52},
  {0,54,59},{0,57,66},{0,60,74},{0,63,83},{0,66,93},{0,68,105},{0,69,121},{0,67,143},
  {25,63,164},{49,61,170},{68,58,176},{84,56,179},{100,53,181},{115,50,181},{130,46,179},{145,42,174},
  {159,38,168},{173,32,160},{187,25,150},{200,14,139},{213,0,125},{223,0,110},{232,0,92},{242,0,71},
  {251,0,38},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},
  {255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},
};

void setup() {
    PFMath::buildSinLUT();

    if (!bufA) bufA = PFMem::allocFloats(FRAME_W * FRAME_H);
    if (!bufB) bufB = PFMem::allocFloats(FRAME_W * FRAME_H);
    if (!bufA || !bufB) return;

    maxEma = 1.0f;
    prevPhaseStep = -1;

    constexpr int cx = FRAME_W / 2;
    constexpr int cy = FRAME_H / 2;
    for (int y = 0; y < FRAME_H; y++) {
        for (int x = 0; x < FRAME_W; x++) {
            int d = abs(x - cx) + abs(y - cy);
            bufA[y * FRAME_W + x] = ((d % 16) < 4) ? 1.0f : 0.0f;
        }
    }
}

void update(float dt, const InputFrame& input) {
    if (!bufA || !bufB) return;

    PFParams::apply(input, 0, &knobStepSize, 1.0f, 5.0f, 0.083f);
    PFParams::apply(input, 1, &knobPhaseStep, 0.0f, 15.0f, 0.313f);
    PFParams::apply(input, 2, &knobContour, 1.0f, 12.0f, 0.229f);
    PFParams::apply(input, 3, &knobScale, 1.0f, 2.1f, 0.023f);

    const int baseStep = (int)lroundf(knobStepSize);
    const int currentPhaseStep = (int)floorf(fminf(15.0f, fmaxf(0.0f, knobPhaseStep)));

    if (currentPhaseStep != prevPhaseStep) {
        prevPhaseStep = currentPhaseStep;

        const float t = (float)currentPhaseStep * (PI / 4.0f);
        constexpr int halfW = FRAME_W >> 1;
        constexpr int halfH = FRAME_H >> 1;

        float* src = bufA;
        float* dst = bufB;

        constexpr int diamondBoundary = halfW - 4;

        for (int y = 0; y < FRAME_H; y++) {
            const int dstRow = y * FRAME_W;
            const int dy = y - halfH;

            for (int x = 0; x < FRAME_W; x++) {
                const int dx = x - halfW;
                const bool isOutside = (abs(dx) + abs(dy)) > diamondBoundary;
                const int dir = isOutside ? -baseStep : baseStep;

                const int sx = (x + (dx > 0 ? -dir : dir) + FRAME_W * 16) % FRAME_W;
                const int sy = (y + (dy > 0 ? -dir : dir) + FRAME_H * 16) % FRAME_H;
                dst[dstRow + x] = src[sy * FRAME_W + sx];
            }
        }

        constexpr float viscosity = 5.0f;
        constexpr float blend = viscosity / (viscosity + 4.0f);
        constexpr float invBlend = 1.0f - blend;

        for (int y = 1; y < FRAME_H - 1; y++) {
            const int row = y * FRAME_W;
            for (int x = 1; x < FRAME_W - 1; x++) {
                const int idx = row + x;
                const float neighbors = (dst[idx - FRAME_W] + dst[idx + FRAME_W] + dst[idx - 1] + dst[idx + 1]) * 0.25f;
                dst[idx] = dst[idx] * invBlend + neighbors * blend;
            }
        }

        const float wave = PFMath::fastSin(t * 3.0f) * 0.5f + 0.5f;
        constexpr int coreRadius = 4;

        for (int i = -coreRadius; i <= coreRadius; i++) {
            const int px1 = halfW + i;
            const int py1 = halfH + (coreRadius - abs(i));
            const int py2 = halfH - (coreRadius - abs(i));
            if (px1 >= 0 && px1 < FRAME_W) {
                if (py1 >= 0 && py1 < FRAME_H) dst[py1 * FRAME_W + px1] = wave;
                if (py2 >= 0 && py2 < FRAME_H) dst[py2 * FRAME_W + px1] = 1.0f - wave;
            }
        }

        bufA = dst;
        bufB = src;
    }

    float frameMax = 0.001f;
    constexpr int totalPixels = FRAME_W * FRAME_H;
    for (int i = 0; i < totalPixels; i++) {
        const float val = bufA[i];
        if (val > frameMax) frameMax = val;
    }
    maxEma = maxEma * 0.95f + frameMax * 0.05f;
}

void draw() {
    PFCanvas::setFrame(FRAME_W, FRAME_H);

    if (!bufA || !bufB) {
        PFCanvas::present();
        return;
    }

    const float invMax = 1.0f / fmaxf(0.0001f, maxEma);
    const float steps = knobContour;
    const float scale = knobScale;

    constexpr int halfW = FRAME_W >> 1;
    constexpr int halfH = FRAME_H >> 1;
    const float invScale = 1.0f / scale;

    for (int y = 0; y < FRAME_H; y++) {
        const float dy = ((float)y - (float)halfH) * invScale;

        for (int x = 0; x < FRAME_W; x++) {
            const float dx = ((float)x - (float)halfW) * invScale;

            const int sampleX = (int)lroundf((float)halfW + dx);
            const int sampleY = (int)lroundf((float)halfH + dy);

            float normVal = 0.0f;
            if (sampleX >= 0 && sampleX < FRAME_W && sampleY >= 0 && sampleY < FRAME_H) {
                normVal = bufA[sampleY * FRAME_W + sampleX] * invMax;
            }

            normVal = fminf(1.0f, fmaxf(0.0f, normVal));

            if (steps > 1.01f) {
                normVal = floorf(normVal * steps) / (steps - 1.0f);
                normVal = fminf(1.0f, fmaxf(0.0f, normVal));
            }

            const float v = normVal * normVal * (3.0f - 2.0f * normVal);
            const int li = (int)(v * 255.0f + 0.5f);

            PFCanvas::setPixel(x, y, RAMP_LUT[li][0], RAMP_LUT[li][1], RAMP_LUT[li][2]);
        }
    }

    PFCanvas::present();
}

} // namespace Soundsqure