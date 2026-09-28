#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_params.h"
#include "src/core_math.h"
#include "src/core_noise.h"

namespace DayAndNightDreamyBeach {

const char* NAME = "Dreamy Beach";
const char* const KNOB_LABELS[4] = {"Waves", "Speed", "Plankton", "TimeOfDay"};
constexpr bool ABSOLUTE_READY = true;

// ── Layout & Constants ────────────────────────────────────────────────────────
constexpr float HORIZON_FRAC = 0.40f;
constexpr float COAST_FRAC   = 0.78f;

constexpr float LH_X_FRAC    = 0.820f;
constexpr int   LH_HEIGHT    = 13;
constexpr float LH_BEAM_SPD  = 0.50f;

constexpr float WAVE_SPEEDS[4]  = {0.28f, 0.22f, 0.36f, 0.18f};
constexpr float WAVE_SLOPES[4]  = {0.05f, -0.04f, 0.08f, -0.06f};
constexpr float WAVE_OFFSETS[4] = {0.00f, 0.25f, 0.50f, 0.75f};
constexpr float WAVE_AMPS[4]    = {1.00f, 0.80f, 0.62f, 0.42f};

// Sky colour keypoints: midnight / dawn / noon / dusk
const float SKY_KEYS[4][6] = {
    {0.005f, 0.008f, 0.045f,  0.040f, 0.050f, 0.090f},
    {0.070f, 0.030f, 0.120f,  0.900f, 0.420f, 0.120f},
    {0.045f, 0.165f, 0.520f,  0.270f, 0.570f, 0.920f},
    {0.090f, 0.022f, 0.060f,  0.820f, 0.270f, 0.055f},
};

// Sea colour keypoints: deep / shore
const float SEA_KEYS[4][6] = {
    {0.010f, 0.038f, 0.065f,  0.020f, 0.068f, 0.105f},
    {0.030f, 0.060f, 0.090f,  0.090f, 0.120f, 0.150f},
    {0.035f, 0.190f, 0.420f,  0.060f, 0.300f, 0.600f},
    {0.055f, 0.040f, 0.030f,  0.140f, 0.080f, 0.040f},
};

struct BirdDef {
    float spd, yf, off, wf;
};

const BirdDef BIRD_DEFS[6] = {
    { 0.040f, 0.22f, 0.08f, 2.0f},
    {-0.027f, 0.50f, 0.55f, 1.7f},
    { 0.053f, 0.34f, 0.72f, 2.4f},
    {-0.019f, 0.66f, 0.30f, 1.5f},
    { 0.033f, 0.14f, 0.42f, 2.2f},
    {-0.046f, 0.44f, 0.88f, 1.9f},
};

struct CelestialBody {
    float x, y;
    float r, g, b;
    float radius;
    float brightness;
    bool valid;
};

struct ActiveStar {
    bool active;
    float tipX, tipY;
    float dirX, dirY;
    float timeFade;
};

struct SeagullState {
    int bx, by;
    int tipDY;
};

struct SkyStar {
    uint8_t x, y;
    float brFactor;
    float speed;
    float phase;
    float rMul, gMul;
};

struct ColumnWaveData {
    float crestY[4];
    float negThresh[4];
    float invSigmaSq[4];
    float invSigmaSqAsym[4];
    float ampShoaling[4];
    float surge;
    float maxUp;
    float str0, str1;
    float foamFade0, foamFade1;
};

// ── State ─────────────────────────────────────────────────────────────────────
static float waveIntensity = 0.0f;
static float speed         = 3.0f;
static float bioIntensity  = 0.762f;
static float tod           = 1.0f;
static float timeAcc       = 0.0f;

// ── Precomputed Lookup Tables (~33 KB total static RAM) ──────────────────────
static float   s_coastY[PANEL_RES_W];
static float   s_invSeaH[PANEL_RES_W];
static float   s_invBeachH[PANEL_RES_W];
static float   s_skyT2[26];
static float   s_expLUT[512];
static float   s_beamLUT[128];
static uint8_t s_lhAngle[PANEL_RES_W * PANEL_RES_H];
static uint8_t s_lhFade[PANEL_RES_W * PANEL_RES_H];
static uint8_t s_beachBaseBr[PANEL_RES_W * PANEL_RES_H];
static uint8_t s_mwR[26 * PANEL_RES_W];
static uint8_t s_mwG[26 * PANEL_RES_W];
static uint8_t s_mwB[26 * PANEL_RES_W];

static SkyStar s_skyStars[180];
static int     s_numSkyStars = 0;
static ColumnWaveData s_colWaves[PANEL_RES_W];

// ── Inline Helpers ────────────────────────────────────────────────────────────
inline float mix(float a, float b, float t) {
    return a + (b - a) * t;
}

inline float smoothstep(float e0, float e1, float x) {
    float t = fminf(fmaxf((x - e0) / (e1 - e0), 0.0f), 1.0f);
    return t * t * (3.0f - 2.0f * t);
}

inline float fastExpNeg(float v) {
    if (v <= 0.0f) return 1.0f;
    int idx = (int)(v * 50.0f);
    if (idx >= 512) return 0.0f;
    return s_expLUT[idx];
}

inline float fbm3_setup(float x, float y) {
    return PFNoise::valueNoise2D(x, y) * 0.500f
         + PFNoise::valueNoise2D(x * 2.1f, y * 2.1f) * 0.250f
         + PFNoise::valueNoise2D(x * 4.4f, y * 4.4f) * 0.125f;
}

inline float interpKey(const float keys[4][6], float tVal, int ch) {
    float t4 = PFMath::fract(tVal) * 4.0f;
    int i = (int)t4 % 4;
    float f = t4 - (int)t4;
    float s = f * f * (3.0f - 2.0f * f);
    return mix(keys[i][ch], keys[(i + 1) % 4][ch], s);
}

inline float nightness(float tVal) {
    return smoothstep(0.12f, 0.34f, fabsf(PFMath::fract(tVal) - 0.5f));
}

inline float goldenness(float tVal) {
    float d = fabsf(PFMath::fract(tVal + 0.5f) - 0.5f);
    return smoothstep(0.20f, 0.27f, d) * (1.0f - smoothstep(0.38f, 0.50f, d));
}

inline CelestialBody getSunPos(float tVal, float w, float h, float horizY) {
    CelestialBody sun;
    float phase = (PFMath::fract(tVal) - 0.25f) / 0.50f;
    if (phase < 0.0f || phase > 1.0f) {
        sun.valid = false;
        return sun;
    }
    sun.valid = true;
    float sinPhase = sinf(phase * PI);
    sun.x = w * phase;
    sun.y = horizY - horizY * 0.88f * sinPhase;
    sun.r = 1.00f;
    sun.g = mix(0.38f, 0.78f, sinPhase);
    sun.b = mix(0.05f, 0.18f, sinPhase);
    sun.radius = h * 0.062f;
    sun.brightness = 1.0f;
    return sun;
}

inline CelestialBody getMoonPos(float tVal, float w, float h, float horizY) {
    CelestialBody moon;
    float moonTod = PFMath::fract(tVal + 0.5f);
    float phase   = (moonTod - 0.25f) / 0.50f;
    if (phase < 0.0f || phase > 1.0f) {
        moon.valid = false;
        return moon;
    }
    moon.valid = true;
    float sinPhase = sinf(phase * PI);
    moon.x = w * (1.0f - phase);
    moon.y = horizY - horizY * 0.84f * sinPhase;
    moon.r = mix(0.92f, 0.88f, sinPhase);
    moon.g = mix(0.68f, 0.92f, sinPhase);
    moon.b = mix(0.30f, 1.00f, sinPhase);
    moon.radius = h * 0.090f;
    moon.brightness = nightness(tVal);
    return moon;
}

// ── Setup ─────────────────────────────────────────────────────────────────────
void setup() {
    PFMath::buildSinLUT();

    // 1. Exponential & Lighthouse Beam lookup tables
    for (int i = 0; i < 512; i++) {
        s_expLUT[i] = expf(-(float)i * 0.02f);
    }
    for (int i = 0; i < 128; i++) {
        float d = (float)i * (TWO_PI / 256.0f);
        s_beamLUT[i] = smoothstep(0.20f, 0.04f, d);
    }

    // 2. Coastline, Sky, and Height reciprocal tables
    const float horizY = (float)PANEL_RES_H * HORIZON_FRAC;
    for (int y = 0; y < 26; y++) {
        float skyT = (float)y / horizY;
        s_skyT2[y] = skyT * skyT;
    }
    for (int x = 0; x < PANEL_RES_W; x++) {
        float nx    = (float)x / (float)PANEL_RES_W;
        float base  = (float)PANEL_RES_H * COAST_FRAC;
        float slow  = sinf(nx * PI * 1.9f + 0.5f) * ((float)PANEL_RES_H * 0.032f);
        float rocky = (fbm3_setup(nx * 3.2f, 0.84f) - 0.5f) * ((float)PANEL_RES_H * 0.055f);
        s_coastY[x] = base + slow + rocky;
        s_invSeaH[x]   = 1.0f / fmaxf(1.0f, s_coastY[x] - horizY);
        s_invBeachH[x] = 1.0f / fmaxf(1.0f, (float)PANEL_RES_H - s_coastY[x]);
    }

    // 3. Lighthouse spatial tables
    const int lhX    = (int)roundf((float)PANEL_RES_W * LH_X_FRAC);
    const int lhGndY = (int)roundf(s_coastY[lhX]);
    const int lhTopY = lhGndY - LH_HEIGHT;

    for (int y = 0; y < PANEL_RES_H; y++) {
        for (int x = 0; x < PANEL_RES_W; x++) {
            int idx = y * PANEL_RES_W + x;
            float dx = (float)(x - lhX);
            float dy = (float)(y - lhTopY);
            float dist = sqrtf(dx * dx + dy * dy);
            if (dist < 2.0f) {
                s_lhFade[idx]  = 0;
                s_lhAngle[idx] = 0;
            } else {
                float angle = atan2f(dy, dx);
                float normAngle = (angle < 0.0f ? angle + TWO_PI : angle) / TWO_PI;
                s_lhAngle[idx] = (uint8_t)(normAngle * 256.0f);
                s_lhFade[idx]  = (uint8_t)(fminf(expf(-dist * 0.055f), 1.0f) * 255.0f);
            }

            // Beach static base brightness
            if ((float)y >= s_coastY[x]) {
                float rockN  = fbm3_setup((float)x * 0.112f, (float)y * 0.112f);
                bool isRock  = rockN > 0.598f;
                float baseBr = isRock ? (0.210f + rockN * 0.150f) : (0.155f + rockN * 0.120f);
                s_beachBaseBr[idx] = (uint8_t)(fminf(baseBr, 1.0f) * 255.0f);
            } else {
                s_beachBaseBr[idx] = 0;
            }
        }
    }

    // 4. Milky Way static color field (sky rows 0..25)
    for (int y = 0; y < 26; y++) {
        for (int x = 0; x < PANEL_RES_W; x++) {
            int idx = y * PANEL_RES_W + x;
            float mwCY   = horizY * (0.68f - 0.60f * (float)x / (float)PANEL_RES_W);
            float mwDist = (float)y - mwCY;
            float mwW    = horizY * 0.26f;
            float mwFall = expf(-mwDist * mwDist / (mwW * mwW));
            float mwN1   = fbm3_setup((float)x * 0.021f + 8.0f, (float)y * 0.058f + 12.0f);
            float mwN2   = PFNoise::valueNoise2D((float)x * 0.065f + 3.0f, (float)y * 0.18f + 22.0f);
            float mwN    = mwN1 * 0.65f + mwN2 * 0.35f;

            float dustN    = PFNoise::valueNoise2D((float)x * 0.080f + 1.5f, (float)y * 0.16f + 7.0f);
            float dustMask = 1.0f - smoothstep(0.40f, 0.55f, dustN) * 0.55f;
            float mwStr    = mwFall * mwN * dustMask * 2.0f;

            float mwR, mwG, mwB;
            if (mwN1 < 0.42f) {
                float f = mwN1 / 0.42f;
                mwR = mix(0.18f, 0.52f, f); mwG = mix(0.10f, 0.08f, f); mwB = mix(0.72f, 0.88f, f);
            } else if (mwN1 < 0.68f) {
                float f = (mwN1 - 0.42f) / 0.26f;
                mwR = mix(0.52f, 0.82f, f); mwG = mix(0.08f, 0.12f, f); mwB = mix(0.88f, 0.60f, f);
            } else {
                float f = (mwN1 - 0.68f) / 0.32f;
                mwR = mix(0.82f, 0.65f, f); mwG = mix(0.12f, 0.05f, f); mwB = mix(0.60f, 0.85f, f);
            }

            float rTot = mwStr * mwR;
            float gTot = mwStr * mwG;
            float bTot = mwStr * mwB;

            if (mwFall > 0.10f) {
                float mwStar = PFNoise::cellHash(x * 3 + 70, y * 7 + 1100);
                if (mwStar > 0.948f) {
                    float sBr   = (mwStar - 0.948f) / 0.052f * mwFall * 0.80f;
                    float starC = PFNoise::cellHash(x * 7 + 33, y * 11 + 1500);
                    rTot += sBr * mix(0.95f, 0.72f, starC);
                    gTot += sBr * mix(0.72f, 0.78f, starC);
                    bTot += sBr * mix(0.88f, 1.00f, starC);
                }
            }

            s_mwR[idx] = (uint8_t)(fminf(rTot, 1.0f) * 255.0f);
            s_mwG[idx] = (uint8_t)(fminf(gTot, 1.0f) * 255.0f);
            s_mwB[idx] = (uint8_t)(fminf(bTot, 1.0f) * 255.0f);
        }
    }

    // 5. Sky Stars catalogue
    s_numSkyStars = 0;
    for (int y = 0; y < 26; y++) {
        for (int x = 0; x < PANEL_RES_W; x++) {
            float sh = PFNoise::cellHash(x, y);
            if (sh > 0.958f && s_numSkyStars < 180) {
                s_skyStars[s_numSkyStars].x = (uint8_t)x;
                s_skyStars[s_numSkyStars].y = (uint8_t)y;
                s_skyStars[s_numSkyStars].brFactor = (sh - 0.958f) / 0.042f;
                s_skyStars[s_numSkyStars].speed    = 1.2f + sh * 2.1f;
                s_skyStars[s_numSkyStars].phase    = (float)x * 0.73f + (float)y * 1.17f;
                s_skyStars[s_numSkyStars].rMul     = mix(0.84f, 1.0f, PFNoise::cellHash(x + 1, y));
                s_skyStars[s_numSkyStars].gMul     = mix(0.87f, 1.0f, PFNoise::cellHash(x, y + 1));
                s_numSkyStars++;
            }
        }
    }
}

// ── Update ────────────────────────────────────────────────────────────────────
void update(float dt, const InputFrame& input) {
    PFParams::apply(input, 0, &waveIntensity, 0.0f, 1.0f, 0.021f);
    PFParams::apply(input, 1, &speed, 0.1f, 3.0f, 0.06f);
    PFParams::apply(input, 2, &bioIntensity, 0.0f, 1.0f, 0.021f);
    PFParams::applyUnit(input, 3, &tod, 0.021f);

    timeAcc += dt * speed;
    constexpr float PERIOD_WRAP = 1100.0f * TWO_PI;
    if (timeAcc > PERIOD_WRAP) {
        timeAcc -= PERIOD_WRAP;
    }
}

// ── Draw ──────────────────────────────────────────────────────────────────────
void draw() {
    const float w = (float)PANEL_RES_W;
    const float h = (float)PANEL_RES_H;
    const float t = timeAcc;
    const float wI = waveIntensity;
    const float bI = bioIntensity;

    const float horizY = h * HORIZON_FRAC;
    const float night  = nightness(tod);
    const float golden = goldenness(tod);

    const CelestialBody sun  = getSunPos(tod, w, h, horizY);
    const CelestialBody moon = getMoonPos(tod, w, h, horizY);

    const float bioMult = night * bI;
    const float dayBr   = mix(0.06f, 1.0f, 1.0f - night);

    // Hoisted Sky Keypoints
    const float skyTopR = interpKey(SKY_KEYS, tod, 0);
    const float skyTopG = interpKey(SKY_KEYS, tod, 1);
    const float skyTopB = interpKey(SKY_KEYS, tod, 2);
    const float skyHorR = interpKey(SKY_KEYS, tod, 3);
    const float skyHorG = interpKey(SKY_KEYS, tod, 4);
    const float skyHorB = interpKey(SKY_KEYS, tod, 5);

    // Hoisted Sea Keypoints
    const float seaDeepR = interpKey(SEA_KEYS, tod, 0);
    const float seaDeepG = interpKey(SEA_KEYS, tod, 1);
    const float seaDeepB = interpKey(SEA_KEYS, tod, 2);
    const float seaShorR = interpKey(SEA_KEYS, tod, 3);
    const float seaShorG = interpKey(SEA_KEYS, tod, 4);
    const float seaShorB = interpKey(SEA_KEYS, tod, 5);

    // Hoisted Tint Factors
    const float cloudR = night * 0.022f + golden * 0.18f + (1.0f - night - golden) * 0.22f;
    const float cloudG = night * 0.018f + golden * 0.10f + (1.0f - night - golden) * 0.20f;
    const float cloudB = night * 0.024f + golden * 0.04f + (1.0f - night - golden) * 0.22f;

    const float hGR = golden * 0.90f + night * 0.08f + (1.0f - golden - night) * 0.30f;
    const float hGG = golden * 0.40f + night * 0.09f + (1.0f - golden - night) * 0.55f;
    const float hGB = golden * 0.05f + night * 0.09f + (1.0f - golden - night) * 0.85f;

    const float tR = night * 0.90f + golden * 1.00f + (1.0f - night - golden) * 0.98f;
    const float tG = night * 0.70f + golden * 0.68f + (1.0f - night - golden) * 0.84f;
    const float tB = night * 0.52f + golden * 0.28f + (1.0f - night - golden) * 0.46f;

    const float invSunGlow  = sun.valid  ? (1.0f / (sun.radius * 6.5f)) : 0.0f;
    const float invMoonGlow = (moon.valid && moon.brightness > 0.01f) ? (1.0f / (moon.radius * 4.2f)) : 0.0f;

    // Lighthouse geometry & pulses
    const int   lhX    = (int)roundf(w * LH_X_FRAC);
    const int   lhGndY = (int)roundf(s_coastY[lhX]);
    const int   lhTopY = lhGndY - LH_HEIGHT;
    const float lanternPulse = 0.65f + 0.35f * PFMath::fastSin(t * (LH_BEAM_SPD * 2.0f) + 1.57f);
    const uint8_t curBeamU8  = (uint8_t)(PFMath::fract(t * (LH_BEAM_SPD / TWO_PI)) * 256.0f);

    // Fishing vessel geometry
    const int   shipX = (int)roundf(PFMath::fract(0.28f + t * 0.0055f) * (w + 28.0f) - 14.0f);
    const int   shipY = (int)roundf(horizY) - 1;
    const float navP  = 0.70f + 0.30f * PFMath::fastSin(t * 1.8f + 0.7f);

    // Hoist Column Wave & Surf Calculations (128 columns)
    for (int x = 0; x < PANEL_RES_W; x++) {
        float nx  = (float)x * (1.0f / w);
        float shY = s_coastY[x];
        auto& cw  = s_colWaves[x];

        for (int i = 0; i < 4; i++) {
            float phase = PFMath::fract(t * WAVE_SPEEDS[i] - nx * WAVE_SLOPES[i] + WAVE_OFFSETS[i]);
            cw.crestY[i] = horizY + (shY - horizY) * phase;
            float sigma  = 2.8f + phase * 5.5f;
            cw.negThresh[i]       = -sigma * 0.4f;
            cw.invSigmaSq[i]      = 1.0f / (sigma * sigma);
            cw.invSigmaSqAsym[i]  = 1.0f / (sigma * sigma * 0.35f);
            float shoaling        = smoothstep(0.0f, 0.85f, phase) * (0.35f + phase * 0.85f);
            cw.ampShoaling[i]     = shoaling * WAVE_AMPS[i] * wI;
        }

        // Shoreline surf
        float surgePhase1 = PFMath::fract(t * WAVE_SPEEDS[0] - nx * WAVE_SLOPES[0] + WAVE_OFFSETS[0]);
        float surgePhase2 = PFMath::fract(t * WAVE_SPEEDS[1] - nx * WAVE_SLOPES[1] + WAVE_OFFSETS[1]);
        float surge = smoothstep(0.68f, 0.94f, surgePhase1) * smoothstep(1.00f, 0.82f, surgePhase1)
                    + smoothstep(0.72f, 0.96f, surgePhase2) * smoothstep(1.00f, 0.84f, surgePhase2) * 0.60f;
        cw.surge = fminf(fmaxf(surge, 0.0f), 1.0f) * wI * 0.42f;

        // Controlled, natural beach swash run-up (swash reach proportional to wave height)
        cw.maxUp = (shY * (COAST_FRAC - HORIZON_FRAC)) * 0.18f;
        cw.str0  = smoothstep(0.78f, 0.98f, surgePhase1) * smoothstep(1.00f, 0.96f, surgePhase1) * WAVE_AMPS[0] * wI;
        cw.str1  = smoothstep(0.78f, 0.98f, surgePhase2) * smoothstep(1.00f, 0.96f, surgePhase2) * WAVE_AMPS[1] * wI;

        float a0 = (surgePhase1 < 0.5f) ? surgePhase1 : (1.0f - surgePhase1);
        float a1 = (surgePhase2 < 0.5f) ? surgePhase2 : (1.0f - surgePhase2);
        cw.foamFade0 = (a0 < 0.38f) ? (smoothstep(0.38f, 0.02f, a0) * WAVE_AMPS[0] * wI) : 0.0f;
        cw.foamFade1 = (a1 < 0.38f) ? (smoothstep(0.38f, 0.02f, a1) * WAVE_AMPS[1] * wI) : 0.0f;
    }

    // Precomputed Shooting Stars
    ActiveStar stars[3];
    int numActiveStars = 0;
    if (night >= 0.25f) {
        constexpr int NS = 3;
        constexpr float PERIOD = 11.0f;
        constexpr float ACTIVE = 0.09f;
        for (int s = 0; s < NS; s++) {
            stars[s].active = false;
            float slotT = t * (1.0f / PERIOD) + (float)s * (1.0f / (float)NS);
            int epoch = (int)floorf(slotT);
            float phase = PFMath::fract(slotT);
            if (phase > ACTIVE) continue;
            float h1 = PFNoise::cellHash(epoch * 127 + s * 31, s * 53 + epoch * 7);
            if (h1 > 0.55f) continue;
            float h2 = PFNoise::cellHash(epoch * 61 + s * 19, epoch * 37 + s * 11);
            float h3 = PFNoise::cellHash(epoch * 89 + s * 43, epoch * 17 + s * 3);
            float startX = h2 * (w + 10.0f) - 5.0f;
            float startY = h3 * horizY * 0.65f + 2.0f;
            float dirX = (h3 > 0.5f) ? 1.0f : -1.0f;
            float dirY = 0.18f + h2 * 0.26f;
            float dLen = sqrtf(dirX * dirX + dirY * dirY);
            dirX /= dLen;
            dirY /= dLen;
            float traveled = (phase * (1.0f / ACTIVE)) * (65.0f + h1 * 55.0f) * ACTIVE * PERIOD;
            stars[s].tipX = startX + dirX * traveled;
            stars[s].tipY = startY + dirY * traveled;
            stars[s].dirX = dirX;
            stars[s].dirY = dirY;
            stars[s].timeFade = smoothstep(ACTIVE, ACTIVE * 0.15f, phase);
            stars[s].active = true;
            numActiveStars++;
        }
    }

    // Precomputed Seagulls
    SeagullState seagulls[6];
    if (night <= 0.80f) {
        for (int i = 0; i < 6; i++) {
            const auto& bd = BIRD_DEFS[i];
            seagulls[i].bx = (int)roundf(PFMath::fract(bd.off + t * bd.spd) * (w + 8.0f) - 4.0f);
            seagulls[i].by = (int)roundf(bd.yf * horizY);
            seagulls[i].tipDY = (int)roundf(-PFMath::fastSin(t * bd.wf + (float)i * 1.9f));
        }
    }

    // ── Main Pixel Raster Loop ────────────────────────────────────────────────
    for (int y = 0; y < PANEL_RES_H; y++) {
        for (int x = 0; x < PANEL_RES_W; x++) {
            const int idx   = y * PANEL_RES_W + x;
            const float shY = s_coastY[x];
            const auto& cw  = s_colWaves[x];
            float r = 0.0f, g = 0.0f, b = 0.0f;

            // Lighthouse beam lookup
            float lhBeam = 0.0f;
            if (night > 0.01f && s_lhFade[idx] > 0) {
                uint8_t diff    = (uint8_t)(s_lhAngle[idx] - curBeamU8);
                uint8_t diff1   = (diff > 128) ? (256 - diff) : diff;
                uint8_t opp     = (uint8_t)(diff + 128);
                uint8_t diff2   = (opp > 128) ? (256 - opp) : opp;
                uint8_t minDiff = (diff1 < diff2) ? diff1 : diff2;
                lhBeam = s_beamLUT[minDiff] * ((float)s_lhFade[idx] * (1.0f / 255.0f)) * night;
            }

            // ═══════════════════════════════════════════════════════════
            // ZONE 1 — SKY
            // ═══════════════════════════════════════════════════════════
            if ((float)y < horizY) {
                float skyT2 = s_skyT2[y];
                r = mix(skyTopR, skyHorR, skyT2);
                g = mix(skyTopG, skyHorG, skyT2);
                b = mix(skyTopB, skyHorB, skyT2);

                // Milky Way (table lookup)
                if (night > 0.50f) {
                    float mwFactor = (night - 0.50f);
                    r += ((float)s_mwR[idx] * (1.0f / 255.0f)) * mwFactor;
                    g += ((float)s_mwG[idx] * (1.0f / 255.0f)) * mwFactor;
                    b += ((float)s_mwB[idx] * (1.0f / 255.0f)) * mwFactor;
                }

                // Clouds
                float c1 = PFNoise::valueNoise2D((float)x * 0.022f + t * 0.003f, (float)y * 0.11f + 0.6f);
                float c2 = PFNoise::valueNoise2D((float)x * 0.016f - t * 0.002f, (float)y * 0.07f + 4.3f);
                float cloud = smoothstep(0.62f, 0.82f, c1 + c2 * 0.35f) * (1.0f - ((float)y / horizY) * 0.5f);
                r += cloud * cloudR; g += cloud * cloudG; b += cloud * cloudB;

                // Horizon glow
                float hGlowStr = fastExpNeg((horizY - 1.0f - (float)y) * 0.20f) * 0.065f;
                r += hGlowStr * hGR; g += hGlowStr * hGG; b += hGlowStr * hGB;

                // Sun (Natural, full-sky continuous atmospheric glow)
                if (sun.valid) {
                    float dx   = (float)x - sun.x;
                    float dy   = (float)y - sun.y;
                    float dist = sqrtf(dx * dx + dy * dy);
                    float disk = smoothstep(sun.radius, sun.radius * 0.72f, dist) * sun.brightness;
                    float glow = fastExpNeg(dist * invSunGlow) * 0.45f * sun.brightness;
                    float tot  = disk + glow;
                    r += sun.r * tot; g += sun.g * tot; b += sun.b * tot;
                }

                // Moon (Natural atmosphere glow)
                if (moon.valid && moon.brightness > 0.01f) {
                    float dx   = (float)x - moon.x;
                    float dy   = (float)y - moon.y;
                    float dist = sqrtf(dx * dx + dy * dy);
                    float disk = smoothstep(moon.radius, moon.radius * 0.72f, dist) * moon.brightness;
                    float glow = fastExpNeg(dist * invMoonGlow) * 0.45f * moon.brightness;
                    float tot  = disk + glow;
                    r += moon.r * tot; g += moon.g * tot; b += moon.b * tot;
                }

                // Shooting stars
                if (night >= 0.25f && numActiveStars > 0) {
                    float starGlow = 0.0f;
                    for (int s = 0; s < 3; s++) {
                        if (!stars[s].active) continue;
                        float px = (float)x - stars[s].tipX;
                        float py = (float)y - stars[s].tipY;
                        if (fabsf(px) > 15.0f || fabsf(py) > 15.0f) continue;
                        float along = px * stars[s].dirX + py * stars[s].dirY;
                        if (along < -0.5f || along > 12.0f) continue;
                        float perpX = px - along * stars[s].dirX;
                        float perpY = py - along * stars[s].dirY;
                        float perp2 = perpX * perpX + perpY * perpY;
                        if (perp2 > 1.0f) continue;
                        float tailFade = (along <= 0.0f) ? fastExpNeg(along * along * 5.0f) : smoothstep(12.0f, 0.0f, along);
                        float perpFade = fastExpNeg(perp2 * 4.0f);
                        float sVal = tailFade * perpFade * stars[s].timeFade;
                        if (sVal > starGlow) starGlow = sVal;
                    }
                    starGlow = fminf(fmaxf(starGlow * night, 0.0f), 1.0f);
                    r += starGlow * 1.00f; g += starGlow * 0.97f; b += starGlow * 0.92f;
                }

                // Lighthouse beam in Sky
                r += lhBeam; g += lhBeam * 0.90f; b += lhBeam * 0.52f;

                // Seagulls
                if (night <= 0.80f) {
                    for (int i = 0; i < 6; i++) {
                        int dx = x - seagulls[i].bx;
                        int dy = y - seagulls[i].by;
                        if (abs(dx) <= 2 && abs(dy) <= 1) {
                            if ((dx == 0 && dy == 0) || (abs(dx) == 1 && dy == 0) || (abs(dx) == 2 && dy == seagulls[i].tipDY)) {
                                r *= 0.08f; g *= 0.09f; b *= 0.10f;
                                break;
                            }
                        }
                    }
                }

            // ═══════════════════════════════════════════════════════════
            // ZONE 2 — SEA
            // ═══════════════════════════════════════════════════════════
            } else if ((float)y < shY) {
                float seaDepth = ((float)y - horizY) * s_invSeaH[x];
                seaDepth = fminf(fmaxf(seaDepth, 0.0f), 1.0f);

                float seaN = PFNoise::valueNoise2D((float)x * 0.045f + t * 0.028f, (float)y * 0.075f);
                float tex  = 0.75f + seaN * 0.50f;

                float sd2 = seaDepth * seaDepth;
                r = mix(seaDeepR, seaShorR, sd2) * tex;
                g = mix(seaDeepG, seaShorG, sd2) * tex;
                b = mix(seaDeepB, seaShorB, sd2) * tex;

                // Sun reflection
                if (sun.valid) {
                    float dx  = (float)x - sun.x;
                    float wid = 1.5f + seaDepth * 10.0f;
                    float u   = (dx * dx) / (wid * wid);
                    if (u < 8.0f) {
                        float col  = fastExpNeg(u);
                        float shim = 0.55f + 0.45f * PFMath::fastSin(t * 3.8f + (float)y * 0.55f + (float)x * 0.22f)
                                                   * PFMath::fastCos(t * 2.1f - (float)y * 0.28f + (float)x * 0.14f);
                        float fade = smoothstep(0.0f, 0.35f, seaDepth);
                        float mStr = col * shim * fade;
                        r += mStr * sun.r * 0.60f;
                        g += mStr * sun.g * 0.55f;
                        b += mStr * sun.b * 0.45f;
                    }
                }

                // Moon reflection
                if (moon.valid && moon.brightness > 0.02f) {
                    float dx  = (float)x - moon.x;
                    float wid = 1.8f + seaDepth * 11.0f;
                    float u   = (dx * dx) / (wid * wid);
                    if (u < 8.0f) {
                        float col  = fastExpNeg(u);
                        float shim = 0.60f + 0.40f * PFMath::fastSin(t * 3.2f + (float)y * 0.50f + (float)x * 0.20f);
                        float fade = smoothstep(0.0f, 0.38f, seaDepth);
                        float mStr = col * shim * fade * moon.brightness;
                        r += mStr * moon.r * 0.50f;
                        g += mStr * moon.g * 0.44f;
                        b += mStr * moon.b * 0.38f;
                    }
                }

                // Bioluminescent wave crests
                float waveGlow = 0.0f;
                for (int i = 0; i < 4; i++) {
                    float distY = (float)y - cw.crestY[i];
                    float distY2 = distY * distY;
                    float u = (distY >= cw.negThresh[i]) ? (distY2 * cw.invSigmaSq[i]) : (distY2 * cw.invSigmaSqAsym[i]);
                    if (u < 8.0f) {
                        waveGlow += fastExpNeg(u) * cw.ampShoaling[i];
                    }
                }
                waveGlow = fminf(fmaxf(waveGlow, 0.0f), 1.0f);

                float bioShift = 0.06f * PFMath::fastSin(t * 0.36f + (float)x * 0.030f);
                r += waveGlow * bioMult * 0.020f;
                g += waveGlow * bioMult * (0.68f + bioShift);
                b += waveGlow * bioMult * (0.90f - bioShift * 0.30f);

                // Daytime wave sheen
                if (night < 0.92f) {
                    float dayFactor = (1.0f - night) * 0.20f;
                    r += waveGlow * dayFactor * 0.62f;
                    g += waveGlow * dayFactor * 0.88f;
                    b += waveGlow * dayFactor * 1.00f;
                }

                // Foam whitecaps
                float nx_    = (float)x * (1.0f / w);
                float fmN    = PFNoise::valueNoise2D(nx_ * 7.0f - t * 1.0f + 0.4f, seaDepth * 2.5f + 2.0f);
                float cap    = smoothstep(0.56f, 0.76f, fmN);
                float capStr = cap * smoothstep(0.18f, 0.85f, seaDepth) * 0.18f * wI;
                r += capStr * mix(0.68f, 1.00f, 1.0f - night * 0.45f);
                g += capStr * mix(0.72f, 1.00f, 1.0f - night * 0.28f);
                b += capStr * mix(0.78f, 1.00f, 1.0f - night * 0.10f);

                // Breaking surf right at coastline
                float surfDist = shY - (float)y;
                if (surfDist < 7.0f) {
                    float surfFade = smoothstep(7.0f, 0.5f, surfDist);
                    float sStr     = surfFade * cw.surge;
                    r += sStr * 1.00f; g += sStr * 0.97f; b += sStr * 0.92f;
                }

                // Horizon line blend
                float hBlend = smoothstep(0.0f, 0.22f, seaDepth);
                r = mix(skyHorR * 0.55f, r, hBlend);
                g = mix(skyHorG * 0.55f, g, hBlend);
                b = mix(skyHorB * 0.55f, b, hBlend);

                // Reflected star flecks
                if (night > 0.50f && PFNoise::cellHash((int)((float)x * 0.68f), (int)((float)y * 0.58f) + 100) > 0.977f) {
                    float sR = 0.055f * (0.5f + 0.5f * PFMath::fastSin(t * 2.1f + (float)x * 0.88f)) * night;
                    r += sR; g += sR; b += sR * 1.05f;
                }

                // Lighthouse beam in Sea
                r += lhBeam * 0.90f; g += lhBeam * 0.82f; b += lhBeam * 0.42f;

            // ═══════════════════════════════════════════════════════════
            // ZONE 3 — BEACH
            // ═══════════════════════════════════════════════════════════
            } else {
                float shoreT = ((float)y - shY) * s_invBeachH[x];
                shoreT = fminf(fmaxf(shoreT, 0.0f), 1.0f);

                float baseBr = ((float)s_beachBaseBr[idx] * (1.0f / 255.0f)) * dayBr;
                r = baseBr * tR;
                g = baseBr * tG;
                b = baseBr * tB;

                // Wet sand transition at coastline
                float wetDist = (float)y - shY;
                float wetness = smoothstep(4.5f, 0.0f, wetDist);
                if (wetness > 0.01f) {
                    float wMix = wetness * 0.72f * dayBr;
                    r = mix(r, r * 0.40f + seaShorR * 0.35f, wMix);
                    g = mix(g, g * 0.40f + seaShorG * 0.35f, wMix);
                    b = mix(b, b * 0.35f + seaShorB * 0.52f, wMix);

                    float sheen = smoothstep(0.4f, 1.0f, wetness) * 0.06f * dayBr
                                * (0.5f + 0.5f * PFMath::fastSin(t * 1.9f + (float)x * 0.15f));
                    r += sheen * 0.80f; g += sheen * 0.88f; b += sheen;
                }

                // Gentle bioluminescent swash (contained at coastline)
                if (wetDist >= 0.0f && wetDist <= cw.maxUp) {
                    float w0 = smoothstep(cw.maxUp, 0.0f, wetDist) * cw.str0;
                    float w1 = smoothstep(cw.maxUp, 0.0f, wetDist) * cw.str1;
                    float best = (w0 > w1) ? w0 : w1;
                    float wash = fminf(fmaxf(best, 0.0f), 1.0f) * bioMult;
                    r += wash * 0.012f;
                    g += wash * 0.300f;
                    b += wash * 0.560f;
                }

                // Tide pools
                if (night > 0.30f && shoreT < 0.30f) {
                    float tpH = PFNoise::cellHash((x / 4) * 7, (y / 3) * 11 + 200);
                    if (tpH > 0.936f) {
                        float glow   = (tpH - 0.936f) * (1.0f / 0.064f) * bioMult * 0.55f;
                        float tpPuls = 0.70f + 0.30f * PFMath::fastSin(t * 1.1f + tpH * 9.0f);
                        r += glow * 0.012f * tpPuls;
                        g += glow * 0.210f * tpPuls;
                        b += glow * 0.400f * tpPuls;
                    }
                }

                // Pebble specks
                if (shoreT > 0.04f && PFNoise::cellHash(x / 2, y / 2 + 300) > 0.963f) {
                    r += 0.028f * dayBr; g += 0.024f * dayBr; b += 0.018f * dayBr;
                }

                // Lingering wave foam deposits on shore
                if (shoreT < 0.35f) {
                    float beachFoamFade = smoothstep(0.35f, 0.0f, shoreT);
                    if (cw.foamFade0 > 0.0f) {
                        float foamH = PFNoise::cellHash((x / 2) * 13, (int)(y - shY) * 17 + 550);
                        if (foamH >= 0.48f) {
                            float fc = cw.foamFade0 * (foamH - 0.48f) * 1.9f * beachFoamFade * dayBr * 0.30f;
                            r += fc; g += fc * 0.97f; b += fc * 0.94f;
                        }
                    }
                    if (cw.foamFade1 > 0.0f) {
                        float foamH = PFNoise::cellHash((x / 2) * 13 + 29, (int)(y - shY) * 17 + 550);
                        if (foamH >= 0.48f) {
                            float fc = cw.foamFade1 * (foamH - 0.48f) * 1.9f * beachFoamFade * dayBr * 0.30f;
                            r += fc; g += fc * 0.97f; b += fc * 0.94f;
                        }
                    }
                }

                // Lighthouse beam in Beach
                r += lhBeam * 0.80f; g += lhBeam * 0.62f; b += lhBeam * 0.18f;
            }

            // ── Lighthouse tower ──────────────────────────────────────────────
            int towerHW = (y >= lhGndY - 3) ? 2 : 1;
            if (abs(x - lhX) <= towerHW && y >= lhTopY && y < lhGndY) {
                float towerT  = fminf(fmaxf(((float)y - (float)lhTopY) * (1.0f / (float)(LH_HEIGHT - 1)), 0.0f), 1.0f);
                float bandT   = PFMath::fract(towerT * 3.5f);
                bool isRed    = (bandT < 0.5f && towerT > 0.15f && towerT < 0.88f);
                float towerBr = mix(0.38f, 0.18f, towerT);

                r = isRed ? towerBr * 1.00f : towerBr;
                g = isRed ? towerBr * 0.22f : towerBr * 0.95f;
                b = isRed ? towerBr * 0.18f : towerBr * 0.87f;

                if (y <= lhTopY + 1) {
                    r = mix(towerBr, 1.00f, night * 0.72f * lanternPulse);
                    g = mix(towerBr * 0.95f, 0.85f, night * 0.72f * lanternPulse);
                    b = mix(towerBr * 0.87f, 0.20f, night * 0.72f * lanternPulse);
                }
            }

            // ── Lighthouse ambient halo (bounded) ─────────────────────────────
            int lhDx = x - lhX;
            int lhDy = y - lhTopY;
            if (abs(lhDx) <= 15 && abs(lhDy) <= 15) {
                float dist = sqrtf((float)(lhDx * lhDx + lhDy * lhDy));
                float lhAmb = fastExpNeg(dist * 0.32f) * night * 0.42f;
                r += lhAmb; g += lhAmb * 0.80f; b += lhAmb * 0.32f;
            }

            // ── Fishing vessel (silhouette on horizon) ────────────────────────
            int sdx = x - shipX;
            int sdy = y - shipY;
            if (abs(sdx) <= 5 && abs(sdy) <= 7) {
                bool isHull  = (abs(sdx) <= 5 && sdy == 0)
                            || (abs(sdx) <= 4 && sdy == 1)
                            || (abs(sdx) <= 2 && sdy == 2);
                bool isMast  = (sdx == 0 && sdy >= -6 && sdy <= -1);
                bool isCabin = (abs(sdx) <= 2 && sdy >= -2 && sdy <= -1);
                bool isBoom  = (abs(sdx) <= 2 && sdy == -4);

                if (isHull || isMast || isCabin || isBoom) {
                    float dayColor = 1.0f - night;
                    r = r * 0.06f + dayColor * 0.14f;
                    g = g * 0.07f + dayColor * 0.16f;
                    b = b * 0.08f + dayColor * 0.22f;

                    if (isHull && sdy >= 1) {
                        r += dayColor * 0.10f;
                        g += dayColor * 0.02f;
                    }

                    if (sdx == 0 && sdy == -6) {
                        float navStr = mix(0.20f, 1.00f, night) * navP;
                        r += navStr * 1.00f;
                        g += navStr * 0.62f;
                        b += navStr * 0.06f;
                    }
                }
            }

            uint8_t pr = (uint8_t)(fminf(fmaxf(r, 0.0f), 1.0f) * 255.0f);
            uint8_t pg = (uint8_t)(fminf(fmaxf(g, 0.0f), 1.0f) * 255.0f);
            uint8_t pb = (uint8_t)(fminf(fmaxf(b, 0.0f), 1.0f) * 255.0f);
            PFCanvas::setPixel(x, y, pr, pg, pb);
        }
    }

    // ── Twinkling Sky Stars (direct blit) ─────────────────────────────────────
    if (night > 0.05f) {
        for (int i = 0; i < s_numSkyStars; i++) {
            const auto& st = s_skyStars[i];
            float twinkle = 0.45f + 0.55f * PFMath::fastSin(t * st.speed + st.phase);
            float br = st.brFactor * twinkle * night;
            float addR = br * st.rMul * 255.0f;
            float addG = br * st.gMul * 255.0f;
            float addB = br * 255.0f;

            float skyT2 = s_skyT2[st.y];
            float rBase = mix(skyTopR, skyHorR, skyT2) * 255.0f;
            float gBase = mix(skyTopG, skyHorG, skyT2) * 255.0f;
            float bBase = mix(skyTopB, skyHorB, skyT2) * 255.0f;

            uint8_t pr = (uint8_t)fminf(rBase + addR, 255.0f);
            uint8_t pg = (uint8_t)fminf(gBase + addG, 255.0f);
            uint8_t pb = (uint8_t)fminf(bBase + addB, 255.0f);
            PFCanvas::setPixel(st.x, st.y, pr, pg, pb);
        }
    }

    PFCanvas::present();
}

} // namespace DayAndNightDreamyBeach