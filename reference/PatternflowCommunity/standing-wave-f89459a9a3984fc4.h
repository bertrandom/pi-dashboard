#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_params.h"
#include "src/core_math.h"

namespace StandingWave {

const char* NAME = "Standing Wave";
const char* const KNOB_LABELS[4] = {"Multiplier", "Glow", "Wiggler", "Current"};
constexpr bool ABSOLUTE_READY = true;

constexpr int FRAME_W = 64;
constexpr int FRAME_H = 128;

static float paramMultiplier = 1.0f;
static float paramGlow = 2.0f;
static float paramWiggler = 10.0f;
static float paramCurrent = 2.0f;

static float timeVal = 0.0f;

// Precomputed base coordinate grids
static float baseUx[FRAME_W];
static float baseUy[FRAME_H];

// Precomputed fast exponential decay for gaussian ring mask: exp(-d^2 * 20)
// d = r - ringR ranges from approx 0 to 4.5; d^2 * 20 ranges from 0 to ~405
constexpr int MASK_LUT_SIZE = 512;
constexpr float MASK_LUT_MAX_D2 = 5.0f; // Beyond d^2 = 5, exp(-5*20) = exp(-100) ≈ 0
static float maskExpLUT[MASK_LUT_SIZE];

static inline float getMask(float rMinusRingR) {
    float d2 = rMinusRingR * rMinusRingR;
    if (d2 >= MASK_LUT_MAX_D2) return 0.0f;
    float idxF = d2 * ((MASK_LUT_SIZE - 1) / MASK_LUT_MAX_D2);
    int idx = (int)idxF;
    float fractPart = idxF - (float)idx;
    return maskExpLUT[idx] + fractPart * (maskExpLUT[idx + 1] - maskExpLUT[idx]);
}

// Baked Color Ramp (stops 0.000:#1320cf, 0.073:#105ada, 0.089:#1251f8, 0.260:#0e80df, 0.478:#12b0d7, 1.000:#ffffff; mode hsvShort; wrap off.)
static const uint8_t RAMP_LUT[256][3] = {
  {19,32,207},{19,35,208},{19,38,208},{19,41,209},{18,44,209},{18,47,210},{18,50,211},{18,53,211},
  {18,56,212},{18,59,212},{17,62,213},{17,65,214},{17,68,214},{17,72,215},{17,75,215},{17,78,216},
  {16,81,216},{16,85,217},{16,88,218},{16,89,221},{17,88,228},{17,85,236},{18,83,243},{18,81,248},
  {18,83,247},{18,84,247},{18,85,246},{18,86,246},{17,87,245},{17,88,244},{17,90,244},{17,91,243},
  {17,92,243},{17,93,242},{17,94,242},{17,95,241},{17,97,240},{17,98,240},{17,99,239},{16,100,239},
  {16,101,238},{16,102,238},{16,103,237},{16,104,236},{16,105,236},{16,106,235},{16,108,235},{16,109,234},
  {16,110,233},{16,111,233},{15,112,232},{15,113,232},{15,114,231},{15,115,231},{15,116,230},{15,117,229},
  {15,118,229},{15,119,228},{15,120,228},{15,121,227},{15,122,227},{14,123,226},{14,124,225},{14,125,225},
  {14,126,224},{14,127,224},{14,128,223},{14,129,223},{14,130,223},{14,130,223},{14,131,222},{14,132,222},
  {14,133,222},{14,134,222},{15,135,222},{15,136,222},{15,137,222},{15,138,221},{15,139,221},{15,140,221},
  {15,140,221},{15,141,221},{15,142,221},{15,143,221},{15,144,220},{15,145,220},{15,146,220},{16,147,220},
  {16,147,220},{16,148,220},{16,149,220},{16,150,219},{16,151,219},{16,152,219},{16,153,219},{16,154,219},
  {16,154,219},{16,155,219},{16,156,218},{16,157,218},{16,158,218},{17,159,218},{17,160,218},{17,160,218},
  {17,161,218},{17,162,217},{17,163,217},{17,164,217},{17,165,217},{17,165,217},{17,166,217},{17,167,217},
  {17,168,216},{17,169,216},{17,170,216},{18,170,216},{18,171,216},{18,172,216},{18,173,216},{18,174,215},
  {18,174,215},{18,175,215},{18,176,215},{20,177,215},{21,177,216},{23,178,216},{24,178,216},{26,179,217},
  {27,179,217},{29,180,217},{30,180,217},{32,181,218},{33,181,218},{35,182,218},{37,183,219},{38,183,219},
  {40,184,219},{41,184,220},{43,185,220},{44,185,220},{46,186,220},{48,186,221},{49,187,221},{51,188,221},
  {52,188,222},{54,189,222},{55,189,222},{57,190,223},{59,190,223},{60,191,223},{62,191,223},{64,192,224},
  {65,193,224},{67,193,224},{68,194,225},{70,194,225},{72,195,225},{73,195,226},{75,196,226},{77,197,226},
  {78,197,226},{80,198,227},{82,198,227},{83,199,227},{85,199,228},{87,200,228},{88,201,228},{90,201,229},
  {92,202,229},{93,202,229},{95,203,229},{97,203,230},{99,204,230},{100,205,230},{102,205,231},{104,206,231},
  {105,206,231},{107,207,232},{109,208,232},{111,208,232},{112,209,232},{114,209,233},{116,210,233},{118,210,233},
  {119,211,234},{121,212,234},{123,212,234},{125,213,235},{127,213,235},{128,214,235},{130,215,235},{132,215,236},
  {134,216,236},{135,216,236},{137,217,237},{139,218,237},{141,218,237},{143,219,238},{145,219,238},{146,220,238},
  {148,221,238},{150,221,239},{152,222,239},{154,222,239},{156,223,240},{157,224,240},{159,224,240},{161,225,241},
  {163,225,241},{165,226,241},{167,227,241},{169,227,242},{170,228,242},{172,229,242},{174,229,243},{176,230,243},
  {178,230,243},{180,231,244},{182,232,244},{184,232,244},{186,233,244},{187,233,245},{189,234,245},{191,235,245},
  {193,235,246},{195,236,246},{197,237,246},{199,237,247},{201,238,247},{203,238,247},{205,239,247},{207,240,248},
  {209,240,248},{211,241,248},{213,242,249},{215,242,249},{217,243,249},{219,243,250},{221,244,250},{223,245,250},
  {225,245,250},{227,246,251},{229,247,251},{231,247,251},{233,248,252},{235,249,252},{237,249,252},{239,250,253},
  {241,250,253},{243,251,253},{245,252,253},{247,252,254},{249,253,254},{251,254,254},{253,254,255},{255,255,255},
};

void setup() {
    PFMath::buildSinLUT();

    for (int x = 0; x < FRAME_W; ++x) {
        baseUx[x] = ((float)x / (float)FRAME_W - 0.5f) * 2.0f;
    }
    for (int y = 0; y < FRAME_H; ++y) {
        baseUy[y] = ((float)y / (float)FRAME_H - 0.5f) * 4.0f;
    }

    for (int i = 0; i < MASK_LUT_SIZE; ++i) {
        float d2 = ((float)i / (float)(MASK_LUT_SIZE - 1)) * MASK_LUT_MAX_D2;
        maskExpLUT[i] = expf(-d2 * 20.0f);
    }
}

void update(float dt, const InputFrame& input) {
    PFParams::apply(input, 0, &paramMultiplier, 1.0f, 8.0f, 0.146f);
    PFParams::apply(input, 1, &paramGlow, 0.5f, 4.0f, 0.073f);
    PFParams::apply(input, 2, &paramWiggler, 1.0f, 20.0f, 0.396f);
    PFParams::apply(input, 3, &paramCurrent, 0.1f, 2.0f, 0.04f);

    timeVal += dt;
    constexpr float TIME_PERIOD = 200.0f * PI; // Common period covering fractional time multipliers
    if (timeVal > TIME_PERIOD) {
        timeVal -= TIME_PERIOD;
    }
}

void draw() {
    PFCanvas::setFrame(FRAME_W, FRAME_H);

    const float mult = paramMultiplier;
    const float glow = paramGlow;
    const float wiggle = paramWiggler;
    const float current = paramCurrent;

    constexpr float ringR = 0.6f;
    const float coreExponent = 4.0f / glow;
    const float rippleFreq = wiggle * 1.2f;
    const float rippleSpeed = current * 4.0f;

    const float tCurrent = timeVal * current;
    const float tCore = tCurrent * 5.0f;
    const float tRipple = timeVal * rippleSpeed;
    const float tSym = timeVal * 0.5f;
    const float tNoiseX = timeVal * 20.0f;
    const float tNoiseY = timeVal * 15.0f;

    const float multOverPi = mult / PI;
    const float bgGlowScale = 0.35f * glow;

    // Precalculate row-dependent terms to hoist out of the inner loop
    float rowSinWiggle[FRAME_H];
    float rowNoiseCos[FRAME_H];
    for (int y = 0; y < FRAME_H; ++y) {
        rowSinWiggle[y] = PFMath::fastSin(baseUy[y] * wiggle + tCurrent) * 0.05f;
        rowNoiseCos[y] = PFMath::fastCos((float)y * 0.5f - tNoiseY);
    }

    // Precalculate column-dependent terms
    float colCosWiggle[FRAME_W];
    float colNoiseSin[FRAME_W];
    for (int x = 0; x < FRAME_W; ++x) {
        colCosWiggle[x] = PFMath::fastCos(baseUx[x] * wiggle - tCurrent) * 0.05f;
        colNoiseSin[x] = PFMath::fastSin((float)x * 0.5f + tNoiseX) * 0.08f;
    }

    for (int y = 0; y < FRAME_H; ++y) {
        const float uyBase = baseUy[y];
        const float sinWiggleY = rowSinWiggle[y];
        const float noiseCosY = rowNoiseCos[y];

        for (int x = 0; x < FRAME_W; ++x) {
            float ux = baseUx[x] + sinWiggleY;
            float uy = uyBase + colCosWiggle[x];

            float r = sqrtf(ux * ux + uy * uy);
            float a = PFMath::fastAtan2(uy, ux);
            float aSym = a * multOverPi;

            // Central kaleidoscope pattern
            float v = fabsf(PFMath::fastSin(r * 12.0f - tCore));
            v *= fabsf(PFMath::fastCos(aSym * 4.0f + r * 5.0f));
            float core = PFMath::fastPow(v, coreExponent);

            // Mask for the central ring band
            float rDiff = r - ringR;
            float mask = getMask(rDiff);

            // Ocean-style ripples radiating from the ring
            float dist = fabsf(rDiff);
            float wave = PFMath::fastSin(dist * rippleFreq - tRipple);
            if (wave < 0.0f) wave = 0.0f;

            float decay = 1.0f / (1.0f + dist * 3.5f);
            float bg = wave * decay;
            bg *= 0.8f + 0.2f * PFMath::fastSin(aSym * 2.0f + tSym);
            bg *= bgGlowScale;

            // Electric current flicker — kept local to the ring
            float noise = colNoiseSin[x] * noiseCosY;

            float finalVal = core * mask + bg * (1.0f - mask) + noise * mask;
            if (finalVal < 0.0f) finalVal = 0.0f;
            else if (finalVal > 1.0f) finalVal = 1.0f;

            int li = (int)(finalVal * 255.0f + 0.5f);
            PFCanvas::setPixel(x, y, RAMP_LUT[li][0], RAMP_LUT[li][1], RAMP_LUT[li][2]);
        }
    }

    PFCanvas::present();
}

} // namespace StandingWave