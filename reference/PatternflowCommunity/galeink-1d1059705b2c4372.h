#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_math.h"
#include "src/core_mem.h"

namespace GaleInk {

const char* NAME = "Gale Ink (Symmetric Flow)";
const char* const KNOB_LABELS[4] = {"Eddies", "Gale", "Curl", "Fade"};

constexpr int FRAME_W = 64;
constexpr int FRAME_H = 128;
constexpr int N_PARTICLES = 900;

static const uint8_t RAMP_LUT[256][3] = {
  {0,225,255},{0,223,254},{0,222,254},{0,220,253},{0,218,252},{0,217,251},{0,215,251},{1,214,250},
  {1,212,249},{1,210,249},{1,209,248},{1,207,247},{1,205,247},{1,204,246},{1,202,245},{1,200,244},
  {1,199,244},{1,197,243},{1,195,242},{2,194,242},{2,192,241},{2,191,240},{2,189,239},{2,187,239},
  {2,186,238},{2,184,237},{2,182,237},{2,181,236},{2,179,235},{2,177,234},{2,176,234},{2,174,233},
  {3,173,232},{3,171,232},{3,169,231},{3,168,230},{3,166,230},{3,164,229},{3,163,228},{3,161,227},
  {3,159,227},{3,158,226},{3,156,225},{3,154,225},{4,153,224},{4,151,223},{4,150,222},{4,148,222},
  {4,146,221},{4,145,220},{4,143,220},{4,141,219},{4,140,218},{4,138,218},{4,136,217},{4,135,216},
  {4,133,215},{5,132,215},{5,130,214},{5,128,213},{5,127,213},{5,125,212},{5,123,211},{5,122,210},
  {5,120,210},{5,118,209},{5,117,208},{5,115,208},{5,113,207},{6,112,206},{6,110,206},{6,109,205},
  {6,107,204},{6,105,203},{6,104,203},{6,102,202},{6,100,201},{6,99,201},{6,97,200},{6,95,199},
  {6,94,198},{6,92,198},{7,91,197},{7,89,196},{7,87,196},{7,86,195},{7,84,194},{7,82,193},
  {7,81,193},{7,79,192},{7,77,191},{7,76,191},{7,74,190},{7,72,189},{8,71,189},{8,69,188},
  {8,68,187},{8,66,186},{8,64,186},{8,63,185},{8,61,184},{8,59,184},{8,58,183},{8,56,182},
  {8,54,181},{8,53,181},{8,51,180},{9,50,179},{9,48,179},{9,46,178},{9,45,177},{9,43,177},
  {9,41,176},{9,40,175},{9,38,174},{9,36,174},{9,35,173},{9,33,172},{9,31,172},{10,30,171},
  {10,28,170},{10,27,169},{10,25,169},{10,23,168},{10,22,167},{10,20,167},{10,18,166},{10,17,165},
  {10,15,164},{10,13,164},{10,12,163},{11,10,162},{11,9,162},{11,7,161},{11,5,160},{11,4,160},
  {11,2,159},{11,0,158},{10,0,150},{10,0,140},{9,0,129},{8,0,119},{8,0,109},{7,0,99},
  {6,0,89},{5,0,79},{5,0,69},{4,0,58},{3,0,48},{3,0,38},{2,0,28},{1,0,18},
  {1,0,8},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
};

static float* buf = nullptr;
static float* px = nullptr;
static float* py = nullptr;

static float eddiesVal = 56.53f;
static float galeVal    = 116.323f;
static float curlVal    = 0.477f;
static float fadeVal    = 0.874f;

static uint32_t rngSeed = 8888;
static bool scatter = true;
static float dtAccum = 0.0f;
static float globalTime = 0.0f;

inline float rnd() {
    rngSeed = rngSeed * 1664525u + 1013904223u;
    return (float)rngSeed / 4294967296.0f;
}

void setup() {
    PFMath::buildSinLUT();
    if (!buf) buf = PFMem::allocFloats(FRAME_W * FRAME_H);
    if (!px)  px  = PFMem::allocFloats(N_PARTICLES);
    if (!py)  py  = PFMem::allocFloats(N_PARTICLES);
    scatter = true;
}

void update(float dt, const InputFrame& input) {
    if (!buf || !px || !py) return;

    eddiesVal += input.knobDeltas[0] * 2.042f;
    if (eddiesVal < 20.0f) eddiesVal = 20.0f;
    if (eddiesVal > 118.0f) eddiesVal = 118.0f;

    galeVal += input.knobDeltas[1] * 2.375f;
    if (galeVal < 6.0f) galeVal = 6.0f;
    if (galeVal > 120.0f) galeVal = 120.0f;

    curlVal += input.knobDeltas[2] * 0.021f;
    if (curlVal < 0.0f) curlVal = 0.0f;
    if (curlVal > 1.0f) curlVal = 1.0f;

    fadeVal += input.knobDeltas[3] * 0.003f;
    if (fadeVal < 0.85f) fadeVal = 0.85f;
    if (fadeVal > 0.98f) fadeVal = 0.98f;

    if (input.btnPressed[0]) scatter = true;

    dtAccum += dt;
    globalTime += dt;
    // Prevent unbounded time growth
    if (globalTime > 10000.0f * TWO_PI) globalTime -= 10000.0f * TWO_PI;
}

void draw() {
    if (!buf || !px || !py) {
        PFCanvas::present();
        return;
    }

    PFCanvas::setFrame(FRAME_W, FRAME_H);

    // Consume accumulated dt, cap at 0.08
    float dt = dtAccum;
    dtAccum = 0.0f;
    if (dt > 0.08f) dt = 0.08f;

    // Reseed particles if requested
    if (scatter) {
        for (int i = 0; i < N_PARTICLES; ++i) {
            px[i] = rnd() * FRAME_W;
            py[i] = rnd() * FRAME_H;
        }
        scatter = false;
    }

    // Fade trail buffer
    for (int i = 0; i < FRAME_W * FRAME_H; ++i) {
        buf[i] *= fadeVal;
    }

    // Knob values
    const float eddies = eddiesVal;
    const float gale   = galeVal;
    const float curl   = curlVal;
    const float fade   = fadeVal; // already used

    const float ka = TWO_PI / eddies;
    const float kb = ka * 1.618f;

    const float t1 = globalTime * 0.5f;
    const float t2 = globalTime * 0.37f;
    const float t3 = globalTime * 0.13f;

    // Sub-stepping
    int sub = (int)ceilf((gale * dt) / 1.1f);
    if (sub < 1) sub = 1;
    if (sub > 6) sub = 6;
    const float sdt = dt / sub;
    const float dep = 0.55f / sub;

    for (int i = 0; i < N_PARTICLES; ++i) {
        float x = px[i];
        float y = py[i];

        for (int s = 0; s < sub; ++s) {
            const float sy = y * ka + t1 + PFMath::fastSin(t3) * 2.0f;
            const float sx = x * kb - t2;

            const float vx = PFMath::fastSin(sy) * PFMath::fastSin(sx) * curl * 1.4f;
            const float vy = PFMath::fastCos(sy) * PFMath::fastCos(sx) * curl * 1.4f + (1.15f - curl);

            x += vx * gale * sdt;
            y += vy * gale * sdt;

            int ix = (int)x;
            int iy = (int)y;
            if (ix >= 0 && ix < FRAME_W && iy >= 0 && iy < FRAME_H) {
                int idx = iy * FRAME_W + ix;
                float v = buf[idx] + dep;
                if (v > 1.0f) v = 1.0f;
                buf[idx] = v;
            }
        }

        // Horizontal wrap
        if (x < 0.0f) x += FRAME_W;
        else if (x >= FRAME_W) x -= FRAME_W;

        // Vertical respawn
        if (y > FRAME_H + 3.0f || y < -4.0f) {
            x = rnd() * FRAME_W;
            if (curl > 0.85f)
                y = rnd() * FRAME_H;
            else
                y = -1.0f - rnd() * 6.0f;
        }

        px[i] = x;
        py[i] = y;
    }

    // Render the field
    for (int yy = 0; yy < FRAME_H; ++yy) {
        for (int xx = 0; xx < FRAME_W; ++xx) {
            int i = yy * FRAME_W + xx;
            float t = buf[i];
            float v = t * t * (3.0f - 2.0f * t) * 1.12f;
            if (v > 1.0f) v = 1.0f;
            int li = (int)(v * 255.0f + 0.5f);
            if (li > 255) li = 255;
            else if (li < 0) li = 0;
            PFCanvas::setPixel(xx, yy, RAMP_LUT[li][0], RAMP_LUT[li][1], RAMP_LUT[li][2]);
        }
    }

    PFCanvas::present();
}

} // namespace GaleInk