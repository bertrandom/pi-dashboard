#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_math.h"
#include "src/core_mem.h"

namespace IsingModelPattern {

constexpr int FRAME_W = 64;
constexpr int FRAME_H = 128;
constexpr int FRAME_N = FRAME_W * FRAME_H;

const char* NAME = "Ising Model";
const char* const KNOB_LABELS[4] = {"Temp", "Speed", "Window", "Fade"};

// Knob parameters with default values
static float tempParam = 2.936f;  // Temp: min 0.8, max 3.5
static float speedParam = 1.818f; // Speed: min 0.2, max 4.0
static float winParam = 6.373f;   // Window: min 1.0, max 7.0
static float fadeParam = 0.05f;   // Fade: min 0.05, max 0.6

// Framebuffer-scale state buffers allocated via PSRAM/DRAM helper
static int8_t* spins = nullptr;
static float* mag = nullptr;
static float* buf = nullptr;
static float* tempBlur = nullptr; // Intermediate 1D buffer for separable box blur

static uint32_t seed = 123456789;
static float tAcc = 0.0f;
static int phase = 0;
static float amp = 0.5f;

static const uint8_t RAMP_LUT[256][3] = {
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
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{1,1,1},{1,1,2},{3,2,3},{5,4,5},
  {7,6,8},{11,8,11},{15,11,14},{20,15,18},{24,18,21},{29,22,24},{34,26,28},{39,29,31},
  {44,33,34},{48,38,37},{53,42,39},{58,46,42},{62,50,45},{67,55,48},{71,60,51},{76,65,54},
  {80,70,58},{83,75,61},{87,80,65},{90,86,69},{93,91,73},{96,97,78},{99,102,83},{102,108,88},
  {104,114,94},{106,120,100},{109,125,107},{111,131,114},{113,137,121},{115,143,129},{118,148,137},{121,154,145},
  {124,159,154},{127,165,162},{131,170,171},{136,175,180},{141,180,189},{146,185,197},{153,190,206},{159,194,215},
  {167,199,223},{175,203,231},{183,207,238},{192,211,245},{202,216,252},{204,208,245},{201,195,230},{197,182,214},
  {193,170,197},{186,159,180},{179,148,163},{169,138,146},{159,129,130},{148,120,116},{136,112,103},{123,104,91},
  {110,96,81},{97,88,72},{84,80,64},{71,72,58},{60,64,52},{49,56,46},{39,48,41},{30,39,35},
  {22,31,29},{15,23,22},{9,15,16},{5,8,9},{2,3,4},{1,1,1},{0,0,0},{0,0,0},
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

static inline uint32_t nextRng() {
  seed = seed * 1664525u + 1013904223u;
  return seed;
}

void setup() {
  PFMath::buildSinLUT();

  if (!spins) spins = (int8_t*)PFMem::allocFloats(FRAME_N);
  if (!mag) mag = PFMem::allocFloats(FRAME_N);
  if (!buf) buf = PFMem::allocFloats(FRAME_N);
  if (!tempBlur) tempBlur = PFMem::allocFloats(FRAME_N);

  if (!spins || !mag || !buf || !tempBlur) return;

  seed = 123456789;
  tAcc = 0.0f;
  phase = 0;
  amp = 0.5f;

  for (int i = 0; i < FRAME_N; i++) {
    spins[i] = (nextRng() & 1) ? 1 : -1;
  }

  // Warm-up sweeps
  const float J = 1.0f;
  for (int s = 0; s < 80; s++) {
    const int even = s & 1;
    for (int y = 0; y < FRAME_H; y++) {
      for (int x = (y + even) & 1; x < FRAME_W; x += 2) {
        const int i = y * FRAME_W + x;
        int sum = 0;
        if (x > 0) sum += spins[i - 1];
        if (x < FRAME_W - 1) sum += spins[i + 1];
        if (y > 0) sum += spins[i - FRAME_W];
        if (y < FRAME_H - 1) sum += spins[i + FRAME_W];

        const float dE = 2.0f * spins[i] * sum * J;
        const float T = 2.3f;
        if (dE <= 0.0f || ((float)nextRng() / 4294967296.0f) < expf(-dE / T)) {
          spins[i] = -spins[i];
        }
      }
    }
  }

  // Initial local magnetization via 1D separable sliding window
  const int win = 2;
  for (int y = 0; y < FRAME_H; y++) {
    const int rowOffset = y * FRAME_W;
    int sum = 0;
    for (int xx = 0; xx <= win; xx++) sum += spins[rowOffset + xx];
    tempBlur[rowOffset] = (float)sum;
    for (int x = 1; x < FRAME_W; x++) {
      if (x + win < FRAME_W) sum += spins[rowOffset + x + win];
      if (x - 1 - win >= 0) sum -= spins[rowOffset + x - 1 - win];
      tempBlur[rowOffset + x] = (float)sum;
    }
  }
  for (int x = 0; x < FRAME_W; x++) {
    float sum = 0.0f;
    for (int yy = 0; yy <= win; yy++) sum += tempBlur[yy * FRAME_W + x];
    for (int y = 0; y < FRAME_H; y++) {
      if (y > 0) {
        if (y + win < FRAME_H) sum += tempBlur[(y + win) * FRAME_W + x];
        if (y - 1 - win >= 0) sum -= tempBlur[(y - 1 - win) * FRAME_W + x];
      }
      const int cX = ((x + win < FRAME_W - 1) ? (x + win) : (FRAME_W - 1)) - ((x - win > 0) ? (x - win) : 0) + 1;
      const int cY = ((y + win < FRAME_H - 1) ? (y + win) : (FRAME_H - 1)) - ((y - win > 0) ? (y - win) : 0) + 1;
      mag[y * FRAME_W + x] = sum / (float)(cX * cY);
    }
  }
}

void update(float dt, const InputFrame& input) {
  if (!spins || !mag || !buf || !tempBlur) return;

  tempParam += input.knobDeltas[0] * 0.056f;
  tempParam = fminf(fmaxf(tempParam, 0.8f), 3.5f);

  speedParam += input.knobDeltas[1] * 0.079f;
  speedParam = fminf(fmaxf(speedParam, 0.2f), 4.0f);

  winParam += input.knobDeltas[2] * 0.125f;
  winParam = fminf(fmaxf(winParam, 1.0f), 7.0f);

  fadeParam += input.knobDeltas[3] * 0.011f;
  fadeParam = fminf(fmaxf(fadeParam, 0.05f), 0.6f);

  dt = fminf(dt, 0.1f);
  tAcc += dt;
  if (tAcc > 20000.0f * TWO_PI) {
    tAcc -= 20000.0f * TWO_PI;
  }

  const float T = tempParam;
  const float speed = speedParam;
  const int win = (int)fmaxf(1.0f, roundf(winParam));
  const float fade = fadeParam;

  const int sweeps = (int)fmaxf(1.0f, floorf(speed * 4.0f));

  const float J = 0.85f + 0.3f * PFMath::fastSin(tAcc * 0.07f) + 0.15f * PFMath::fastSin(tAcc * 0.031f);

  // Pre-calculate expf probabilities outside pixel loops (0 expf inside loop)
  const float effT = fmaxf(T, 0.05f);
  const float p1 = expf(-2.0f * J / effT);
  const float p2 = p1 * p1;
  const float p3 = p1 * p2;
  const float p4 = p2 * p2;

  // Checkerboard Metropolis Sweep
  for (int s = 0; s < sweeps; s++) {
    const int even = (phase + s) & 1;
    for (int y = 0; y < FRAME_H; y++) {
      const int rowOffset = y * FRAME_W;
      for (int x = (y + even) & 1; x < FRAME_W; x += 2) {
        const int i = rowOffset + x;
        int sum = 0;
        if (x > 0) sum += spins[i - 1];
        if (x < FRAME_W - 1) sum += spins[i + 1];
        if (y > 0) sum += spins[i - FRAME_W];
        if (y < FRAME_H - 1) sum += spins[i + FRAME_W];

        const int net = spins[i] * sum;
        if (net <= 0) {
          spins[i] = -spins[i];
        } else {
          const float r = (float)nextRng() / 4294967296.0f;
          float prob = p4;
          if (net == 1) prob = p1;
          else if (net == 2) prob = p2;
          else if (net == 3) prob = p3;

          if (r < prob) {
            spins[i] = -spins[i];
          }
        }
      }
    }
  }
  phase ^= 1;

  // Optimized O(1) Separable Sliding Window Box Blur for Local Magnetization
  // 1. Horizontal Pass
  for (int y = 0; y < FRAME_H; y++) {
    const int rowOffset = y * FRAME_W;
    int sum = 0;
    const int rEnd = (win < FRAME_W - 1) ? win : (FRAME_W - 1);
    for (int xx = 0; xx <= rEnd; xx++) {
      sum += spins[rowOffset + xx];
    }
    tempBlur[rowOffset] = (float)sum;

    for (int x = 1; x < FRAME_W; x++) {
      if (x + win < FRAME_W) {
        sum += spins[rowOffset + x + win];
      }
      if (x - 1 - win >= 0) {
        sum -= spins[rowOffset + x - 1 - win];
      }
      tempBlur[rowOffset + x] = (float)sum;
    }
  }

  // 2. Vertical Pass + Max Amplitude Accumulation
  float maxAbs = 1e-6f;
  for (int x = 0; x < FRAME_W; x++) {
    float sum = 0.0f;
    const int bEnd = (win < FRAME_H - 1) ? win : (FRAME_H - 1);
    for (int yy = 0; yy <= bEnd; yy++) {
      sum += tempBlur[yy * FRAME_W + x];
    }

    for (int y = 0; y < FRAME_H; y++) {
      if (y > 0) {
        if (y + win < FRAME_H) {
          sum += tempBlur[(y + win) * FRAME_W + x];
        }
        if (y - 1 - win >= 0) {
          sum -= tempBlur[(y - 1 - win) * FRAME_W + x];
        }
      }

      const int cX = ((x + win < FRAME_W - 1) ? (x + win) : (FRAME_W - 1)) - ((x - win > 0) ? (x - win) : 0) + 1;
      const int cY = ((y + win < FRAME_H - 1) ? (y + win) : (FRAME_H - 1)) - ((y - win > 0) ? (y - win) : 0) + 1;

      const float m = sum / (float)(cX * cY);
      const int idx = y * FRAME_W + x;
      mag[idx] = m;

      const float a = fabsf(m);
      if (a > maxAbs) maxAbs = a;
    }
  }

  // EMA amplitude + decay into display buffer
  amp = amp * 0.92f + maxAbs * 0.08f;
  const float inv = 1.0f / fmaxf(amp, 0.05f);
  for (int i = 0; i < FRAME_N; i++) {
    float v = mag[i] * inv * 0.5f + 0.5f;
    v = fminf(1.0f, fmaxf(0.0f, v));
    buf[i] = buf[i] * (1.0f - fade) + v * fade;
  }

  // Divergence guard
  if (isnan(buf[0]) || isinf(buf[0]) || isnan(amp) || isinf(amp)) {
    amp = 0.5f;
    for (int i = 0; i < FRAME_N; i++) {
      spins[i] = (nextRng() & 1) ? 1 : -1;
      buf[i] = 0.5f;
    }
  }
}

void draw() {
  PFCanvas::setFrame(FRAME_W, FRAME_H);

  if (!spins || !mag || !buf || !tempBlur) {
    PFCanvas::present();
    return;
  }

  for (int y = 0; y < FRAME_H; y++) {
    const float yy = (float)y / (float)FRAME_H;
    const float contrastMult = 0.85f + 0.3f * PFMath::fastSin(yy * PI);
    const int rowOffset = y * FRAME_W;

    for (int x = 0; x < FRAME_W; x++) {
      float v = buf[rowOffset + x];

      // Mild vertical stretch of contrast
      v = v * contrastMult;
      v = fminf(1.0f, fmaxf(0.0f, v));

      // Smoothstep tone
      v = v * v * (3.0f - 2.0f * v);

      const int li = (int)(v * 255.0f + 0.5f);
      const int idx = fminf(255, fmaxf(0, li));

      PFCanvas::setPixel(x, y, RAMP_LUT[idx][0], RAMP_LUT[idx][1], RAMP_LUT[idx][2]);
    }
  }

  PFCanvas::present();
}

} // namespace IsingModelPattern