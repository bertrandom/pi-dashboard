#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_math.h"
#include "src/core_mem.h"

namespace ThomasLabyrinth {

const char* NAME = "Thomas Labyrinth (3D Pitch Edition)";
const char* const KNOB_LABELS[4] = {"B", "Spin", "Pitch", "Fade"};

constexpr int FRAME_W = 64;
constexpr int FRAME_H = 128;

static const uint8_t RAMP_LUT[256][3] = {
  {0,0,0},{3,3,3},{5,5,5},{8,8,8},{10,10,10},{13,13,13},{15,15,15},{18,18,18},
  {21,21,21},{23,23,23},{26,26,26},{28,28,28},{31,31,31},{34,34,34},{36,36,36},{39,39,39},
  {41,41,41},{44,44,44},{46,46,46},{49,49,49},{52,52,52},{54,54,54},{57,57,57},{59,59,59},
  {62,62,62},{65,65,65},{67,67,67},{70,70,70},{72,72,72},{75,75,75},{77,77,77},{80,80,80},
  {83,83,83},{85,85,85},{88,88,88},{90,90,90},{93,93,93},{96,96,96},{98,98,98},{101,101,101},
  {103,103,103},{106,106,106},{108,108,108},{111,111,111},{114,114,114},{116,116,116},{119,119,119},{121,121,121},
  {124,124,124},{127,127,127},{129,129,129},{132,132,132},{133,133,133},{134,134,134},{134,134,134},{135,135,135},
  {136,136,136},{136,136,136},{137,137,137},{137,137,137},{138,138,138},{139,139,139},{139,139,139},{140,140,140},
  {140,140,140},{141,141,141},{142,142,142},{142,142,142},{143,143,143},{143,143,143},{144,144,144},{145,145,145},
  {145,145,145},{146,146,146},{146,146,146},{147,147,147},{148,148,148},{148,148,148},{149,149,149},{149,149,149},
  {150,150,150},{151,151,151},{151,151,151},{152,152,152},{152,152,152},{153,153,153},{154,154,154},{154,154,154},
  {155,155,155},{155,155,155},{156,156,156},{157,157,157},{157,157,157},{158,158,158},{158,158,158},{159,159,159},
  {160,160,160},{160,160,160},{161,161,161},{161,161,161},{162,162,162},{163,163,163},{163,163,163},{164,164,164},
  {164,164,164},{165,165,165},{166,166,166},{166,166,166},{167,167,167},{167,167,167},{168,168,168},{169,169,169},
  {169,169,169},{170,170,170},{170,170,170},{171,171,171},{172,172,172},{172,172,172},{173,173,173},{173,173,173},
  {174,174,174},{175,175,175},{175,175,175},{176,176,176},{176,176,176},{177,177,177},{178,178,178},{178,178,178},
  {179,179,179},{179,179,179},{180,180,180},{181,181,181},{181,181,181},{182,182,182},{182,182,182},{183,183,183},
  {184,184,184},{184,184,184},{185,185,185},{185,185,185},{186,186,186},{187,187,187},{187,187,187},{188,188,188},
  {188,188,188},{189,189,189},{190,190,190},{190,190,190},{191,191,191},{191,191,191},{192,192,192},{193,193,193},
  {193,193,193},{194,194,194},{194,194,194},{195,195,195},{196,196,196},{196,196,196},{197,197,197},{197,197,197},
  {198,198,198},{199,199,199},{199,199,199},{200,200,200},{200,200,200},{201,201,201},{202,202,202},{202,202,202},
  {203,203,203},{203,203,203},{204,204,204},{205,205,205},{205,205,205},{206,206,206},{206,206,206},{207,207,207},
  {208,208,208},{208,208,208},{209,209,209},{209,209,209},{210,210,210},{211,211,211},{211,211,211},{212,212,212},
  {212,212,212},{213,213,213},{214,214,214},{214,214,214},{215,215,215},{215,215,215},{216,216,216},{217,217,217},
  {217,217,217},{218,218,218},{218,218,218},{219,219,219},{220,220,220},{220,220,220},{221,221,221},{221,221,221},
  {222,222,222},{223,223,223},{223,223,223},{224,224,224},{224,224,224},{225,225,225},{226,226,226},{226,226,226},
  {227,227,227},{227,227,227},{228,228,228},{229,229,229},{229,229,229},{230,230,230},{230,230,230},{231,231,231},
  {232,232,232},{232,232,232},{233,233,233},{233,233,233},{234,234,234},{235,235,235},{235,235,235},{236,236,236},
  {236,236,236},{237,237,237},{238,238,238},{238,238,238},{239,239,239},{239,239,239},{240,240,240},{241,241,241},
  {241,241,241},{242,242,242},{242,242,242},{243,243,243},{244,244,244},{244,244,244},{245,245,245},{245,245,245},
  {246,246,246},{247,247,247},{247,247,247},{248,248,248},{248,248,248},{249,249,249},{250,250,250},{250,250,250},
  {251,251,251},{251,251,251},{252,252,252},{253,253,253},{253,253,253},{254,254,254},{254,254,254},{255,255,255},
};

static float* buf = nullptr;

static float bVal     = 0.1f;
static float spinVal  = 1.108f;
static float pitchVal = -0.133f;
static float fadeVal  = 0.911f;

static float x   = 0.5f;
static float y   = 0.3f;
static float z   = -0.2f;
static float rad = 4.0f;

static uint32_t rngSeed = 8712;
static float rotAngle   = 0.0f;   // accumulated Spin angle
static float dtAccum    = 0.0f;
static bool  kick       = false;

inline float rnd() {
    rngSeed = rngSeed * 1664525u + 1013904223u;
    return (float)rngSeed / 4294967296.0f;
}

void setup() {
    PFMath::buildSinLUT();
    if (!buf) buf = PFMem::allocFloats(FRAME_W * FRAME_H);
}

void update(float dt, const InputFrame& input) {
    if (!buf) return;

    bVal += input.knobDeltas[0] * 0.002f;
    if (bVal < 0.1f) bVal = 0.1f;
    if (bVal > 0.2f) bVal = 0.2f;

    spinVal += input.knobDeltas[1] * 0.125f;
    if (spinVal < -3.0f) spinVal = -3.0f;
    if (spinVal > 3.0f)  spinVal = 3.0f;

    pitchVal += input.knobDeltas[2] * 0.05f;
    if (pitchVal < -1.2f) pitchVal = -1.2f;
    if (pitchVal > 1.2f)  pitchVal = 1.2f;

    fadeVal += input.knobDeltas[3] * 0.003f;
    if (fadeVal < 0.84f) fadeVal = 0.84f;
    if (fadeVal > 0.975f) fadeVal = 0.975f;

    if (input.btnPressed[0]) kick = true;

    rotAngle += spinVal * dt;
    while (rotAngle > TWO_PI)  rotAngle -= TWO_PI;
    while (rotAngle < -TWO_PI) rotAngle += TWO_PI;

    dtAccum += dt;
}

void draw() {
    if (!buf) {
        PFCanvas::present();
        return;
    }

    PFCanvas::setFrame(FRAME_W, FRAME_H);

    // Consume accumulated dt, cap at 0.08 s
    float dt = dtAccum;
    dtAccum = 0.0f;
    if (dt > 0.08f) dt = 0.08f;

    const float fade = fadeVal;
    const float b    = bVal;
    const float pitch = pitchVal;

    // Fixed ink rate
    constexpr float fixedInk = 4000.0f;
    int steps = (int)(fixedInk * dt * 60.0f + 0.5f);
    if (steps < 1)    steps = 1;
    if (steps > 5000) steps = 5000;

    // Kick walker
    if (kick) {
        x = (rnd() - 0.5f) * 4.0f;
        y = (rnd() - 0.5f) * 4.0f;
        z = (rnd() - 0.5f) * 4.0f;
        kick = false;
    }

    // Fade trail
    for (int i = 0; i < FRAME_W * FRAME_H; ++i) {
        buf[i] *= fade;
    }

    const float csY = PFMath::fastCos(rotAngle);
    const float snY = PFMath::fastSin(rotAngle);
    const float csX = PFMath::fastCos(pitch);
    const float snX = PFMath::fastSin(pitch);

    const float cx = FRAME_W * 0.5f;
    const float cy = FRAME_H * 0.5f;
    const float halfW = (FRAME_W * 0.5f - 2.0f);
    const float halfH = (FRAME_H * 0.5f - 2.0f);
    const float h = 0.045f;

    float lx = x, ly = y, lz = z;
    float lrad = rad;

    for (int j = 0; j < steps; ++j) {
        const float dx = PFMath::fastSin(ly) - b * lx;
        const float dy = PFMath::fastSin(lz) - b * ly;
        const float dz = PFMath::fastSin(lx) - b * lz;
        lx += dx * h;
        ly += dy * h;
        lz += dz * h;

        if (!isfinite(lx + ly + lz)) {
            lx = 0.5f; ly = 0.3f; lz = -0.2f;
            continue;
        }

        // Auto zoom / autoscaling
        float ax = fabsf(lx), ay = fabsf(ly), az = fabsf(lz);
        float r = (ax > ay) ? ax : ay;
        if (az > r) r = az;
        if (r < 2.5f) r = 2.5f;
        float lerpSpeed = (r > lrad) ? 0.004f : 0.00025f;
        lrad += (r - lrad) * lerpSpeed;

        // Spin rotation (Y-axis)
        float x1 = lx * csY + lz * snY;
        float y1 = ly;
        float z1 = -lx * snY + lz * csY;

        // Pitch rotation (X-axis)
        float x2 = x1;
        float y2 = y1 * csX - z1 * snX;
        float z2 = y1 * snX + z1 * csX;

        float dep = z2 / lrad;
        int ix = (int)(cx + (x2 / lrad) * halfW);
        int iy = (int)(cy + (y2 / lrad) * halfH);

        if (ix >= 0 && ix < FRAME_W && iy >= 0 && iy < FRAME_H) {
            int idx = iy * FRAME_W + ix;
            float val = buf[idx] + 0.05f + 0.06f * (dep + 1.0f) * 0.5f;
            if (val > 1.0f) val = 1.0f;
            buf[idx] = val;
        }
    }

    // Update persistent state
    x   = lx;
    y   = ly;
    z   = lz;
    rad = lrad;

    // Render through colour ramp
    for (int yy = 0; yy < FRAME_H; ++yy) {
        for (int xx = 0; xx < FRAME_W; ++xx) {
            int i = yy * FRAME_W + xx;
            float t = buf[i];
            float v = t * t * (3.0f - 2.0f * t) * 1.15f;
            if (v > 1.0f) v = 1.0f;
            int li = (int)(v * 255.0f + 0.5f);
            if (li > 255) li = 255;
            else if (li < 0) li = 0;
            PFCanvas::setPixel(xx, yy, RAMP_LUT[li][0], RAMP_LUT[li][1], RAMP_LUT[li][2]);
        }
    }

    PFCanvas::present();
}

} // namespace ThomasLabyrinth