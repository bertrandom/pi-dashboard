#pragma once

#include <Arduino.h>
#include <math.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_params.h"
#include "src/core_math.h"
#include "src/core_mem.h"

namespace PorousPercolation {

constexpr int FRAME_W = 64;
constexpr int FRAME_H = 128;

const char* NAME = "Percolation";
const char* const KNOB_LABELS[4] = {"Dissolution", "Seepage", "Deposit", "Pore Scale"};
constexpr bool ABSOLUTE_READY = true;

// Knob parameters with current Pattern Lab values
static float kDissolution = 0.563f;
static float kSpeed       = 0.783f;
static float kDeposition  = 0.993f;
static float kPoreScale   = 8.0f;

static float* rock = nullptr;
static float tAccum = 0.0f;
static float maxAmpEMA = 1.0f;

// Pre-baked Color Ramp LUT (256 entries)
static const uint8_t RAMP_LUT[][3] = {
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
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,1,0},{0,2,0},
  {0,3,0},{0,5,0},{0,8,0},{0,12,0},{0,16,0},{0,20,0},{0,24,0},{0,29,1},
  {0,33,1},{0,38,1},{0,42,1},{0,47,1},{0,52,2},{0,56,2},{0,61,2},{0,66,3},
  {0,71,3},{0,76,4},{0,81,4},{0,87,5},{0,92,6},{0,97,6},{0,102,7},{0,103,7},
  {1,104,7},{1,105,7},{1,107,8},{1,108,8},{2,109,8},{2,110,8},{2,111,8},{3,112,8},
  {3,113,8},{3,115,9},{4,116,9},{4,117,9},{4,118,9},{5,119,9},{5,120,9},{6,122,9},
  {6,123,9},{7,124,10},{7,125,10},{8,126,10},{8,127,10},{9,128,10},{9,130,10},{10,131,10},
  {10,132,10},{11,133,11},{11,134,11},{12,136,11},{12,137,11},{13,138,11},{14,139,11},{14,140,11},
  {15,141,11},{15,143,11},{16,144,12},{16,145,12},{17,146,12},{17,147,12},{18,149,12},{19,150,12},
  {19,151,12},{20,152,12},{20,153,12},{21,155,12},{21,156,12},{22,157,12},{22,158,13},{23,159,13},
  {24,161,13},{24,162,13},{25,163,13},{25,164,13},{26,166,13},{26,167,13},{27,168,13},{27,169,13},
  {28,170,13},{29,172,13},{29,173,13},{30,174,13},{30,175,13},{31,177,13},{31,178,13},{32,179,13},
  {32,180,13},{33,182,13},{34,183,13},{34,184,13},{35,185,13},{35,187,13},{36,188,13},{36,189,13},
  {37,190,13},{38,192,13},{38,193,13},{39,194,13},{39,195,13},{40,197,13},{41,198,13},{41,199,12},
  {42,200,12},{42,202,12},{43,203,12},{43,204,12},{44,205,12},{45,207,12},{45,208,12},{46,209,12},
  {46,211,11},{47,212,11},{48,213,11},{48,214,11},{49,216,11},{49,217,10},{50,218,10},{51,219,10},
  {51,221,10},{52,222,10},{53,223,9},{53,225,9},{54,226,9},{54,227,9},{55,228,8},{56,230,8},
  {56,231,8},{57,232,7},{58,234,7},{58,235,7},{59,236,6},{59,238,6},{60,239,6},{61,240,5},
  {61,241,5},{62,243,4},{63,244,4},{63,245,4},{64,247,3},{65,248,3},{65,249,2},{66,251,2},
  {66,252,1},{67,253,1},{68,255,0},{68,255,0},{68,255,0},{68,255,0},{68,255,0},{68,255,0},
  {68,255,0},{68,255,0},{68,255,0},{68,255,0},{68,255,0},{68,255,0},{68,255,0},{68,255,0},
  {68,255,0},{68,255,0},{68,255,0},{68,255,0},{68,255,0},{68,255,0},{68,255,0},{68,255,0},
};

static inline float fastSech2(float u) {
  float au = fabsf(u);
  if (au > 6.0f) return 0.0f;
  float eu = expf(au);
  float coshu = (eu + 1.0f / eu) * 0.5f;
  return 1.0f / (coshu * coshu);
}

static inline float wrapVal(float v, float m) {
  float r = fmodf(v, m);
  if (r < 0.0f) r += m;
  return r;
}

void setup() {
  PFMath::buildSinLUT();

  if (!rock) {
    rock = PFMem::allocFloats(FRAME_W * FRAME_H);
  }
  if (!rock) return;

  uint32_t seed = 67104u;
  for (int y = 0; y < FRAME_H; y++) {
    float ny = ((float)y / (float)FRAME_H) * 16.0f;
    for (int x = 0; x < FRAME_W; x++) {
      float nx = ((float)x / (float)FRAME_W) * 8.0f;

      seed = seed * 1664525u + 1013904223u;
      float rnd = (float)seed / 4294967296.0f;

      float c1 = PFMath::fastSin(nx * 3.0f + PFMath::fastSin(ny * 2.0f));
      float c2 = PFMath::fastCos(ny * 3.0f + PFMath::fastCos(nx * 2.0f));
      float val = (c1 * c2) * 0.5f + 0.5f + rnd * 0.15f;

      rock[y * FRAME_W + x] = fmaxf(0.0f, fminf(1.0f, val));
    }
  }
}

void update(float dt, const InputFrame& input) {
  PFParams::apply(input, 0, &kDissolution, 0.1f, 2.0f, 0.04f);
  PFParams::apply(input, 1, &kSpeed, 0.3f, 2.5f, 0.046f);
  PFParams::apply(input, 2, &kDeposition, 0.99f, 1.0f, 0.0f);
  PFParams::apply(input, 3, &kPoreScale, 2.0f, 8.0f, 0.125f);

  if (!rock) return;

  float clampedDt = fminf(dt, 0.1f);
  tAccum += clampedDt * kSpeed;
  constexpr float T_PERIOD = 240.0f * PI;
  if (tAccum > T_PERIOD) tAccum -= T_PERIOD;

  // 1. Precalculate X slices (1D LUT per frame)
  float sechX2_amp[4][FRAME_W];
  for (int p = 0; p < 4; p++) {
    float pathTilt = PFMath::fastSin((float)p * 1.57f + tAccum * 0.3f) * 0.8f;
    float amp = 1.8f + (float)p * 0.6f;
    for (int x = 0; x < FRAME_W; x++) {
      float nx = ((float)x / (float)FRAME_W) * 4.0f - 2.0f;
      float xPos = nx - pathTilt;
      sechX2_amp[p][x] = fastSech2(xPos / 0.4f) * amp;
    }
  }

  // 2. Precalculate Y slices (1D LUT per frame)
  float sechY2[4][FRAME_H];
  for (int p = 0; p < 4; p++) {
    float tOff = tAccum * (1.3f + (float)p * 0.4f) + (float)p * 2.0f;
    for (int y = 0; y < FRAME_H; y++) {
      float ny = ((float)(FRAME_H - 1 - y) / (float)FRAME_H) * 8.0f;
      float wavePos = ny - tOff;
      float wrapped = wrapVal(wavePos, 8.0f) - 4.0f;
      sechY2[p][y] = fastSech2(wrapped / 0.35f);
    }
  }

  // 3. 2D grid update via hoisted terms
  for (int y = 0; y < FRAME_H; y++) {
    const float sy0 = sechY2[0][y];
    const float sy1 = sechY2[1][y];
    const float sy2 = sechY2[2][y];
    const float sy3 = sechY2[3][y];

    float* rRow = &rock[y * FRAME_W];

    for (int x = 0; x < FRAME_W; x++) {
      float currentRock = rRow[x] * kDeposition + 0.002f;
      if (currentRock > 1.0f) currentRock = 1.0f;

      float localPerm = 1.0f - currentRock * 0.8f;

      float percolationFlux = (sechX2_amp[0][x] * sy0 +
                               sechX2_amp[1][x] * sy1 +
                               sechX2_amp[2][x] * sy2 +
                               sechX2_amp[3][x] * sy3) * localPerm;

      if (percolationFlux > kDissolution) {
        float dissolve = (percolationFlux - kDissolution) * 0.15f;
        currentRock -= dissolve;
        if (currentRock < 0.0f) currentRock = 0.0f;
      }

      rRow[x] = currentRock;
    }
  }
}

void draw() {
  PFCanvas::setFrame(FRAME_W, FRAME_H);

  if (!rock) {
    PFCanvas::present();
    return;
  }

  float peak = 0.01f;
  const float scaleEMA = 1.0f / fmaxf(0.01f, maxAmpEMA);

  for (int y = 0; y < FRAME_H; y++) {
    const int row = y * FRAME_W;
    const int upRow = (y > 0) ? (y - 1) * FRAME_W : row;
    const int downRow = (y < FRAME_H - 1) ? (y + 1) * FRAME_W : row;

    const float* rRow = &rock[row];
    const float* uRow = &rock[upRow];
    const float* dRow = &rock[downRow];

    for (int x = 0; x < FRAME_W; x++) {
      float r = rRow[x];

      int leftX = (x > 0) ? (x - 1) : (FRAME_W - 1);
      int rightX = (x < FRAME_W - 1) ? (x + 1) : 0;

      float left = rRow[leftX];
      float right = rRow[rightX];
      float up = uRow[x];
      float down = dRow[x];

      float poreBoundary = fabsf(right - left) + fabsf(down - up);
      float view = (1.0f - r) * 0.8f + poreBoundary * 2.0f;

      if (view > peak) {
        peak = view;
      }

      float norm = view * scaleEMA;
      if (norm < 0.0f) norm = 0.0f;
      else if (norm > 1.0f) norm = 1.0f;

      float out = norm * norm * (3.0f - 2.0f * norm);

      int li = (int)(out * 255.0f + 0.5f);
      if (li < 0) li = 0;
      if (li > 255) li = 255;

      PFCanvas::setPixel(x, y, RAMP_LUT[li][0], RAMP_LUT[li][1], RAMP_LUT[li][2]);
    }
  }

  maxAmpEMA = maxAmpEMA * 0.93f + peak * 0.07f;
  PFCanvas::present();
}

} // namespace PorousPercolation