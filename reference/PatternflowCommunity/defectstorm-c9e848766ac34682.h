#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_mem.h"

namespace DefectStorm {

const char* NAME = "Defect Storm";
const char* const KNOB_LABELS[4] = {"Alpha", "Beta", "Pace", "Core"};

constexpr int FRAME_W = 64;
constexpr int FRAME_H = 128;
constexpr int FRAME_SIZE = FRAME_W * FRAME_H;

// Knob parameter state
static float paramAlpha = 1.8f;
static float paramBeta  = -0.712f;
static float paramPace  = 3.403f;
static float paramCore  = 3.0f;

// Step sizes per detent
static constexpr float ALPHA_STEP = 0.038f;
static constexpr float BETA_STEP  = 0.021f;
static constexpr float PACE_STEP  = 0.104f;
static constexpr float CORE_STEP  = 0.05f;

// Complex field buffers (PSRAM)
static float* ar = nullptr;
static float* ai = nullptr;
static float* br = nullptr;
static float* bi = nullptr;

// PRNG state
static uint32_t rngSeed = 60221;
static bool needReseed = true;

// Pre-baked ramp LUT
static const uint8_t RAMP_LUT[256][3] = {
  {255,66,195},{253,65,193},{251,65,192},{249,64,190},{247,63,188},{244,63,187},{242,62,185},{240,62,184},
  {238,61,182},{236,60,180},{234,60,179},{232,59,177},{230,58,175},{228,58,174},{226,57,172},{224,57,171},
  {221,56,169},{219,55,167},{217,55,166},{215,54,164},{213,54,163},{211,53,161},{209,52,159},{207,52,158},
  {205,51,156},{203,51,155},{201,50,153},{199,49,151},{197,49,150},{195,48,148},{193,48,147},{191,47,145},
  {189,46,144},{187,46,142},{185,45,140},{183,45,139},{181,44,137},{179,43,136},{177,43,134},{175,42,133},
  {173,42,131},{171,41,130},{169,40,128},{167,40,127},{165,39,125},{163,39,124},{161,38,122},{159,38,121},
  {157,37,119},{155,36,118},{153,36,116},{151,35,115},{150,35,113},{148,34,112},{146,33,110},{144,33,109},
  {142,32,107},{140,32,106},{138,31,104},{136,31,103},{134,30,101},{132,30,100},{131,29,98},{129,28,97},
  {127,28,95},{125,27,94},{123,27,93},{121,26,91},{119,26,90},{118,25,88},{116,25,87},{114,24,85},
  {112,23,84},{110,23,83},{108,22,81},{107,22,80},{105,21,78},{103,21,77},{101,20,75},{99,20,74},
  {98,19,73},{96,19,71},{94,18,70},{92,18,69},{91,17,67},{89,17,66},{87,16,64},{85,16,63},
  {84,15,62},{82,14,60},{80,14,59},{78,13,58},{77,13,56},{75,12,55},{73,12,54},{72,11,52},
  {70,11,51},{68,10,50},{67,10,49},{65,9,47},{63,9,46},{62,9,45},{60,8,43},{58,8,42},
  {57,7,41},{55,7,40},{53,6,38},{52,6,37},{50,6,36},{49,5,35},{47,5,33},{45,5,32},
  {44,5,31},{42,4,30},{41,4,29},{39,4,27},{38,3,26},{36,3,25},{35,3,24},{33,3,23},
  {32,3,21},{30,2,20},{29,2,19},{27,2,18},{26,2,17},{24,2,16},{23,2,15},{22,1,14},
  {20,1,12},{19,1,11},{17,1,10},{16,1,9},{15,1,8},{13,1,7},{12,1,7},{11,1,6},
  {9,1,5},{8,0,4},{7,0,4},{6,0,3},{5,0,3},{4,0,2},{4,0,2},{3,0,2},
  {2,0,1},{2,0,1},{2,0,1},{1,0,1},{1,0,1},{1,0,0},{0,0,0},{0,0,0},
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,1},{0,0,1},{0,0,2},{0,0,2},
  {0,0,3},{0,0,4},{0,0,6},{1,0,7},{1,0,9},{1,0,11},{1,0,14},{1,0,16},
  {1,0,18},{2,0,20},{2,0,23},{2,0,25},{3,0,27},{3,0,30},{3,0,32},{4,0,35},
  {4,0,37},{5,0,40},{6,0,42},{6,0,45},{7,0,47},{8,0,50},{8,0,53},{9,0,55},
  {10,0,58},{11,0,61},{12,0,63},{13,0,66},{14,0,69},{15,0,72},{16,0,74},{16,0,77},
  {17,0,80},{18,0,83},{19,0,86},{20,0,88},{21,0,91},{22,0,94},{23,0,97},{24,0,100},
  {25,0,103},{26,0,106},{27,0,109},{28,0,112},{29,0,115},{30,0,118},{31,0,121},{32,0,124},
  {33,0,127},{34,0,130},{35,0,133},{36,0,136},{37,0,139},{38,0,142},{39,0,146},{40,0,149},
  {41,0,152},{43,0,155},{44,0,158},{45,0,161},{46,0,165},{47,0,168},{48,0,171},{49,0,174},
  {50,0,178},{51,0,181},{52,0,184},{53,0,187},{54,0,191},{56,0,194},{57,0,197},{58,0,201},
  {59,0,204},{60,0,207},{61,0,211},{62,0,214},{63,0,217},{65,0,221},{66,0,224},{67,0,227},
  {68,0,231},{69,0,234},{70,0,238},{71,0,241},{73,0,245},{74,0,248},{75,0,252},{76,0,255},
};

static inline float rnd() {
  rngSeed = rngSeed * 1664525 + 1013904223;
  return (float)(rngSeed) / 4294967296.0f;
}

void setup() {
  if (!ar) ar = PFMem::allocFloats(FRAME_SIZE);
  if (!ai) ai = PFMem::allocFloats(FRAME_SIZE);
  if (!br) br = PFMem::allocFloats(FRAME_SIZE);
  if (!bi) bi = PFMem::allocFloats(FRAME_SIZE);

  needReseed = true;
}

void update(float dt, const InputFrame& input) {
  if (input.btnPressed[0]) needReseed = true;

  paramAlpha += input.knobDeltas[0] * ALPHA_STEP;
  paramBeta  += input.knobDeltas[1] * BETA_STEP;
  paramPace  += input.knobDeltas[2] * PACE_STEP;
  paramCore  += input.knobDeltas[3] * CORE_STEP;

  paramAlpha = fmaxf(0.0f, fminf(1.8f, paramAlpha));
  paramBeta  = fmaxf(-1.0f, fminf(0.0f, paramBeta));
  paramPace  = fmaxf(1.0f, fminf(6.0f, paramPace));
  paramCore  = fmaxf(0.6f, fminf(3.0f, paramCore));

  if (!ar || !ai || !br || !bi) return;

  const float al = paramAlpha;
  const float be = paramBeta;
  const int steps = (int)fmaxf(1.0f, roundf(paramPace));

  if (needReseed) {
    for (int i = 0; i < FRAME_SIZE; i++) {
      ar[i] = (rnd() - 0.5f) * 0.4f;
      ai[i] = (rnd() - 0.5f) * 0.4f;
    }
    needReseed = false;
  }

  const float dtStep = 0.06f;

  for (int s = 0; s < steps; s++) {
    for (int y = 0; y < FRAME_H; y++) {
      const int row = y * FRAME_W;
      const int up  = (y > 0 ? y - 1 : FRAME_H - 1) * FRAME_W;
      const int dn  = (y < FRAME_H - 1 ? y + 1 : 0) * FRAME_W;

      for (int x = 0; x < FRAME_W; x++) {
        const int i   = row + x;
        const int xl  = row + (x > 0 ? x - 1 : FRAME_W - 1);
        const int xr  = row + (x < FRAME_W - 1 ? x + 1 : 0);

        const float cr = ar[i];
        const float ci = ai[i];

        const float lr = ar[xl] + ar[xr] + ar[up + x] + ar[dn + x] - 4.0f * cr;
        const float li = ai[xl] + ai[xr] + ai[up + x] + ai[dn + x] - 4.0f * ci;

        const float r2 = cr * cr + ci * ci;

        br[i] = cr + dtStep * (cr + (lr - al * li) - r2 * (cr - be * ci));
        bi[i] = ci + dtStep * (ci + (li + al * lr) - r2 * (ci + be * cr));
      }
    }

    float* tmp;
    tmp = ar; ar = br; br = tmp;
    tmp = ai; ai = bi; bi = tmp;
  }
}

void draw() {
  PFCanvas::setFrame(FRAME_W, FRAME_H);

  if (!ar || !ai) {
    PFCanvas::present();
    return;
  }

  const float coreVal = paramCore;

  for (int y = 0, i = 0; y < FRAME_H; y++) {
    for (int x = 0; x < FRAME_W; x++, i++) {
      const float cr = ar[i];
      const float ci = ai[i];
      const float amp = sqrtf(cr * cr + ci * ci);

      float m = amp * coreVal;
      if (m > 1.0f) m = 1.0f;

      const float ph = (amp > 0.001f) ? cr / amp : 0.0f;
      float v = (0.5f + 0.5f * ph) * m;
      if (v < 0.0f) v = 0.0f;
      if (v > 1.0f) v = 1.0f;

      int li = (int)(v * 255.0f + 0.5f);
      if (li < 0) li = 0;
      if (li > 255) li = 255;

      PFCanvas::setPixel(x, y, RAMP_LUT[li][0], RAMP_LUT[li][1], RAMP_LUT[li][2]);
    }
  }

  PFCanvas::present();
}

} // namespace DefectStorm