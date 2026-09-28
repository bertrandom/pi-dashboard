#pragma once
#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_math.h"
#include "src/core_mem.h"

namespace Murmuration2x {

const char* NAME = "Murmuration 2x";
const char* const KNOB_LABELS[4] = {"Flock", "Fear", "Bond", "Falcons"};

constexpr int FRAME_W = 64;
constexpr int FRAME_H = 128;

// Knob parameter ranges, defaults, and steps
constexpr float FLOCK_MIN   = 20.0f;
constexpr float FLOCK_MAX   = 1000.0f;
constexpr float FLOCK_STEP  = 20.417f;
static float flockParam     = 482.264f;

constexpr float FEAR_MIN    = 6.0f;
constexpr float FEAR_MAX    = 40.0f;
constexpr float FEAR_STEP   = 0.708f;
static float fearParam      = 33.072f;

constexpr float BOND_MIN    = 0.2f;
constexpr float BOND_MAX    = 2.5f;
constexpr float BOND_STEP   = 0.048f;
static float bondParam      = 1.719f;

constexpr float FALCONS_MIN = 1.0f;
constexpr float FALCONS_MAX = 10.0f;
constexpr float FALCONS_STEP= 0.188f;
static float falconsParam   = 3.038f;

// Pre-baked color ramp LUT — 256 entries, verbatim
static const uint8_t RAMP_LUT[256][3] = {
  {0,0,0},{2,0,0},{4,0,0},{6,0,0},{8,0,0},{10,0,0},{12,0,0},{14,0,0},
  {16,0,0},{18,0,0},{20,0,0},{22,0,0},{24,0,0},{26,0,0},{28,0,0},{30,0,0},
  {32,0,0},{34,0,0},{36,0,0},{38,0,0},{40,0,0},{42,0,0},{43,0,0},{45,0,0},
  {47,0,0},{49,0,0},{51,0,0},{53,0,0},{55,0,0},{57,0,0},{59,0,0},{61,0,0},
  {63,0,0},{65,0,0},{67,0,0},{69,0,0},{71,0,0},{73,0,0},{75,0,0},{77,0,0},
  {79,0,0},{81,0,0},{83,0,0},{85,0,0},{87,0,0},{89,0,0},{91,0,0},{93,0,0},
  {95,0,0},{97,0,0},{99,0,0},{101,0,0},{103,0,0},{105,0,0},{107,0,0},{109,0,0},
  {111,0,0},{113,0,0},{115,0,0},{117,0,0},{119,0,0},{121,0,0},{123,0,0},{125,0,0},
  {126,0,0},{128,0,0},{130,0,0},{132,0,0},{134,0,0},{136,0,0},{138,0,0},{140,0,0},
  {142,0,0},{144,0,0},{146,0,0},{148,0,0},{150,0,0},{152,0,0},{154,0,0},{156,0,0},
  {158,0,0},{160,0,0},{162,0,0},{164,0,0},{166,0,0},{168,0,0},{170,0,0},{172,0,0},
  {174,0,0},{176,0,0},{178,0,0},{180,0,0},{182,0,0},{184,0,0},{186,0,0},{188,0,0},
  {190,0,0},{192,0,0},{194,0,0},{196,0,0},{198,0,0},{200,0,0},{202,0,0},{204,0,0},
  {206,0,0},{208,0,0},{209,0,0},{211,0,0},{213,0,0},{215,0,0},{217,0,0},{219,0,0},
  {221,0,0},{223,0,0},{225,0,0},{227,0,0},{229,0,0},{231,0,0},{233,0,0},{235,0,0},
  {237,0,0},{239,0,0},{241,0,0},{243,0,0},{245,0,0},{247,0,0},{249,0,0},{251,0,0},
  {253,0,0},{255,0,0},{0,0,10},{0,1,33},{0,2,56},{0,2,79},{0,3,101},{0,4,124},
  {0,5,147},{0,5,170},{0,6,192},{0,7,215},{0,7,238},{1,9,255},{3,11,255},{5,13,255},
  {8,15,255},{10,18,255},{12,20,255},{14,22,255},{17,24,255},{19,27,255},{21,29,255},{24,31,255},
  {26,33,255},{28,36,255},{31,38,255},{33,40,255},{35,42,255},{38,44,255},{40,47,255},{42,49,255},
  {45,51,255},{47,53,255},{49,56,255},{52,58,255},{54,60,255},{56,62,255},{59,65,255},{61,67,255},
  {63,69,255},{66,71,255},{68,74,255},{70,76,255},{72,78,255},{75,80,255},{77,83,255},{79,85,255},
  {82,87,255},{84,89,255},{86,92,255},{89,94,255},{91,96,255},{93,98,255},{96,101,255},{98,103,255},
  {100,105,255},{103,107,255},{105,110,255},{107,112,255},{110,114,255},{112,116,255},{114,119,255},{117,121,255},
  {119,123,255},{121,125,255},{124,128,255},{126,130,255},{128,132,255},{130,134,255},{133,137,255},{135,139,255},
  {137,141,255},{140,143,255},{142,146,255},{144,148,255},{147,150,255},{149,152,255},{151,155,255},{154,157,255},
  {156,159,255},{158,161,255},{161,164,255},{163,166,255},{165,168,255},{168,170,255},{170,173,255},{172,175,255},
  {175,177,255},{177,179,255},{179,182,255},{182,184,255},{184,186,255},{186,188,255},{188,191,255},{191,193,255},
  {193,195,255},{195,197,255},{198,200,255},{200,202,255},{202,204,255},{205,206,255},{207,209,255},{209,211,255},
  {212,213,255},{214,215,255},{216,218,255},{219,220,255},{221,222,255},{223,224,255},{226,227,255},{228,229,255},
  {230,231,255},{233,233,255},{235,236,255},{237,238,255},{240,240,255},{242,242,255},{244,245,255},{246,247,255},
  {249,249,255},{251,251,255},{253,254,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
};

// Maximum counts
constexpr int MAXB = 1000;
constexpr int MAXF = 10;

// PSRAM-allocated per-pixel buffers
static float* buf  = nullptr;
static float* fbuf = nullptr;

// Bird state arrays
static float bx[MAXB];
static float by[MAXB];
static float vx[MAXB];
static float vy[MAXB];

// Falcon state arrays
static float fx[MAXF];
static float fy[MAXF];
static float fvx[MAXF];
static float fvy[MAXF];

// Simulation state
static uint32_t seed = 3141;
static float dtAcc = 0.0f;
static bool scatter = true;

static float rnd() {
    seed = seed * 1664525 + 1013904223;
    return (float)(seed) / 4294967296.0f;
}

void setup() {
    PFMath::buildSinLUT();
    const int len = FRAME_W * FRAME_H;
    if (!buf)  buf  = PFMem::allocFloats(len);
    if (!fbuf) fbuf = PFMem::allocFloats(len);
}

void update(float dt, const InputFrame& input) {
    if (!buf || !fbuf) return;

    flockParam   += input.knobDeltas[0] * FLOCK_STEP;
    fearParam    += input.knobDeltas[1] * FEAR_STEP;
    bondParam    += input.knobDeltas[2] * BOND_STEP;
    falconsParam += input.knobDeltas[3] * FALCONS_STEP;

    if (flockParam < FLOCK_MIN) flockParam = FLOCK_MIN;
    if (flockParam > FLOCK_MAX) flockParam = FLOCK_MAX;
    if (fearParam < FEAR_MIN) fearParam = FEAR_MIN;
    if (fearParam > FEAR_MAX) fearParam = FEAR_MAX;
    if (bondParam < BOND_MIN) bondParam = BOND_MIN;
    if (bondParam > BOND_MAX) bondParam = BOND_MAX;
    if (falconsParam < FALCONS_MIN) falconsParam = FALCONS_MIN;
    if (falconsParam > FALCONS_MAX) falconsParam = FALCONS_MAX;

    if (input.btnPressed[0]) scatter = true;

    dtAcc += dt;
    if (dtAcc > 0.05f) dtAcc = 0.05f;
}

void draw() {
    PFCanvas::setFrame(FRAME_W, FRAME_H);

    if (!buf || !fbuf) {
        PFCanvas::present();
        return;
    }

    const int W = FRAME_W;
    const int H = FRAME_H;
    const int len = W * H;

    const int n = (int)fmaxf(3.0f, fminf((float)MAXB, roundf(flockParam)));
    const float fear = fearParam * 1.5f;   // scaled fear for 2x falcon size
    const float bond = bondParam;
    const int numFalcons = (int)fmaxf(1, fminf(MAXF, roundf(falconsParam)));

    const float fade = 0.86f;
    float dt = dtAcc;
    dtAcc = 0.0f;

    if (scatter) {
        for (int i = 0; i < MAXB; i++) {
            bx[i] = rnd() * (float)W;
            by[i] = rnd() * (float)H;
            const float a = rnd() * TWO_PI;
            vx[i] = PFMath::fastCos(a) * 20.0f;
            vy[i] = PFMath::fastSin(a) * 20.0f;
        }
        for (int f = 0; f < MAXF; f++) {
            fx[f] = rnd() * (float)W;
            fy[f] = rnd() * (float)H;
            fvx[f] = 0.0f;
            fvy[f] = 0.0f;
        }
        scatter = false;
    }

    for (int i = 0; i < len; i++) {
        buf[i] *= fade;
        fbuf[i] *= 0.82f;
    }

    float cx = 0.0f, cy = 0.0f;
    for (int i = 0; i < n; i++) { cx += bx[i]; cy += by[i]; }
    cx /= (float)n;
    cy /= (float)n;

    static float falconTime = 0.0f;
    falconTime += dt;
    if (falconTime > TWO_PI) falconTime -= TWO_PI;

    for (int f = 0; f < numFalcons; f++) {
        const float offset = (float)f * 1.3f;
        float ax = (cx - fx[f]) * 1.6f + PFMath::fastSin(falconTime * 1.7f + offset) * 35.0f;
        float ay = (cy - fy[f]) * 1.6f + PFMath::fastCos(falconTime * 1.3f + offset) * 35.0f;

        fvx[f] = (fvx[f] + ax * dt) * 0.995f;
        fvy[f] = (fvy[f] + ay * dt) * 0.995f;

        const float fsp = sqrtf(fvx[f] * fvx[f] + fvy[f] * fvy[f]);
        if (fsp > 55.0f) {
            const float scale = 55.0f / fsp;
            fvx[f] *= scale;
            fvy[f] *= scale;
        }

        fx[f] += fvx[f] * dt;
        fy[f] += fvy[f] * dt;

        // 2x falcon size: write to a 2x2 block
        const int ffx = (int)fx[f];
        const int ffy = (int)fy[f];
        for (int dx = 0; dx <= 1; dx++) {
            for (int dy = 0; dy <= 1; dy++) {
                const int px = ffx + dx;
                const int py = ffy + dy;
                if (px >= 0 && px < W && py >= 0 && py < H) {
                    fbuf[py * W + px] = 1.0f;
                }
            }
        }
    }

    const float R = 13.0f, R2 = R * R, S2 = 16.0f;
    const float fear2 = fear * fear;

    for (int i = 0; i < n; i++) {
        float ncx = 0.0f, ncy = 0.0f, nvx = 0.0f, nvy = 0.0f, sx2 = 0.0f, sy2 = 0.0f;
        int cnt = 0;
        const float xi = bx[i], yi = by[i];

        for (int j = 0; j < n; j++) {
            if (j == i) continue;
            const float dx = bx[j] - xi;
            const float dy = by[j] - yi;
            const float d2 = dx * dx + dy * dy;
            if (d2 < R2) {
                ncx += dx; ncy += dy;
                nvx += vx[j]; nvy += vy[j];
                cnt++;
                if (d2 < S2 && d2 > 0.01f) {
                    const float inv = 1.0f / d2;
                    sx2 -= dx * inv;
                    sy2 -= dy * inv;
                }
            }
        }

        float fxx = 0.0f, fyy = 0.0f;
        if (cnt > 0) {
            const float invCnt = 1.0f / (float)cnt;
            fxx += (ncx * invCnt) * bond * 2.2f + (nvx * invCnt - vx[i]) * bond * 1.4f;
            fyy += (ncy * invCnt) * bond * 2.2f + (nvy * invCnt - vy[i]) * bond * 1.4f;
        }
        fxx += sx2 * 130.0f;
        fyy += sy2 * 130.0f;

        for (int f = 0; f < numFalcons; f++) {
            const float pdx = xi - fx[f];
            const float pdy = yi - fy[f];
            const float pd2 = pdx * pdx + pdy * pdy;
            if (pd2 < fear2 && pd2 > 0.01f) {
                const float pd = sqrtf(pd2);
                const float p = (1.0f - pd / fear) * 850.0f / pd;
                fxx += pdx * p;
                fyy += pdy * p;
            }
        }

        if (xi < 8.0f)       fxx += (8.0f - xi) * 9.0f;
        else if (xi > W - 8) fxx -= (xi - (float)W + 8.0f) * 9.0f;
        if (yi < 10.0f)      fyy += (10.0f - yi) * 9.0f;
        else if (yi > H - 10)fyy -= (yi - (float)H + 10.0f) * 9.0f;

        vx[i] += fxx * dt;
        vy[i] += fyy * dt;

        const float sp = sqrtf(vx[i] * vx[i] + vy[i] * vy[i]);
        if (sp > 34.0f) {
            const float scale = 34.0f / sp;
            vx[i] *= scale; vy[i] *= scale;
        } else if (sp < 13.0f && sp > 0.01f) {
            const float scale = 13.0f / sp;
            vx[i] *= scale; vy[i] *= scale;
        }

        bx[i] += vx[i] * dt;
        by[i] += vy[i] * dt;

        const int ix = (int)bx[i];
        const int iy = (int)by[i];
        if (ix >= 0 && ix < W && iy >= 0 && iy < H) {
            const int idx = iy * W + ix;
            float v = buf[idx] + 0.34f;
            if (v > 1.0f) v = 1.0f;
            buf[idx] = v;
        }
    }

    for (int y = 0; y < H; y++) {
        for (int x = 0; x < W; x++) {
            const int i = y * W + x;
            const float birdVal = buf[i];
            const float falconVal = fbuf[i];
            float finalV = 0.0f;

            if (birdVal > 0.01f) {
                const float t = birdVal * birdVal * (3.0f - 2.0f * birdVal);
                finalV = 0.51f + t * 0.48f;
            }

            if (falconVal > 0.01f) {
                finalV = 0.05f + falconVal * 0.44f;
            }

            if (finalV < 0.0f) finalV = 0.0f;
            if (finalV > 1.0f) finalV = 1.0f;
            const int li = (int)(finalV * 255.0f + 0.5f);
            PFCanvas::setPixel(x, y, RAMP_LUT[li][0], RAMP_LUT[li][1], RAMP_LUT[li][2]);
        }
    }

    PFCanvas::present();
}

} // namespace Murmuration2x