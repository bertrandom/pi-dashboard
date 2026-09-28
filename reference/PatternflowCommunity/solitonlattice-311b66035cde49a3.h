#pragma once

#include <Arduino.h>
#include <math.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_params.h"
#include "src/core_mem.h"

namespace SolitonLattice {

constexpr int FRAME_W = 64;
constexpr int FRAME_H = 128;

const char* NAME = "Soliton";
const char* const KNOB_LABELS[4] = {"Nonlin", "Speed", "Width", "Sharpness"};
constexpr bool ABSOLUTE_READY = true;

// Knob parameters initialized to Pattern Lab values
static float kNonlin    = 3.352f;
static float kSpeed     = 6.0f;
static float kWidth     = 0.185f;
static float kSharpness = 0.5f;

static float q[FRAME_W];
static float v[FRAME_W];
static float a[FRAME_W];

static float* history = nullptr;
static int head = 0;
static float ampEma = 0.5f;
static float tAccum = 0.0f;

// Pre-baked Color Ramp LUT (verbatim)
static const uint8_t RAMP_LUT[][3] = {
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
  {0,0,0},{0,0,0},{0,0,0},{1,0,0},{1,0,0},{1,0,0},{1,0,0},{2,0,0},
  {2,0,0},{2,0,0},{3,0,0},{3,0,0},{4,0,0},{4,0,0},{5,0,0},{6,0,0},
  {6,0,0},{7,0,0},{8,0,0},{9,0,0},{10,0,0},{11,0,0},{12,0,0},{13,0,0},
  {14,0,0},{15,0,0},{17,0,0},{18,0,0},{19,0,0},{20,0,0},{21,0,0},{22,0,0},
  {23,0,0},{25,0,0},{26,0,0},{27,0,0},{28,0,0},{29,0,0},{31,0,0},{32,0,0},
  {33,0,0},{34,0,0},{36,0,0},{37,0,0},{38,0,0},{39,0,0},{41,0,0},{42,0,0},
  {43,0,0},{44,0,0},{46,0,0},{47,0,0},{48,0,0},{50,0,0},{51,0,0},{52,0,0},
  {53,0,0},{55,0,0},{56,0,0},{57,0,0},{59,0,0},{60,0,0},{61,0,0},{63,0,0},
  {64,0,0},{65,0,0},{67,0,0},{68,0,0},{70,0,0},{71,0,0},{72,0,0},{74,0,0},
  {75,0,0},{77,0,0},{78,0,0},{79,0,0},{81,0,0},{82,0,0},{84,0,0},{85,0,0},
  {86,0,0},{88,0,0},{89,0,0},{91,0,0},{92,0,0},{94,0,0},{95,0,0},{97,0,0},
  {98,0,0},{99,0,0},{101,0,0},{102,0,0},{104,0,0},{105,0,0},{107,0,0},{108,0,0},
  {110,0,0},{111,0,0},{113,0,0},{114,0,0},{116,0,0},{117,0,0},{119,0,0},{120,0,0},
  {122,0,0},{123,0,0},{125,0,0},{126,0,0},{128,0,0},{129,0,0},{131,0,0},{132,0,0},
  {134,0,0},{136,0,0},{137,0,0},{139,0,0},{140,0,0},{142,0,0},{143,0,0},{145,0,0},
  {146,0,0},{148,0,0},{150,0,0},{151,0,0},{153,0,0},{154,0,0},{156,0,0},{157,0,0},
  {159,0,0},{161,0,0},{162,0,0},{164,0,0},{165,0,0},{167,0,0},{169,0,0},{170,0,0},
  {172,0,0},{173,0,0},{175,0,0},{177,0,0},{178,0,0},{180,0,0},{182,0,0},{183,0,0},
  {185,0,0},{187,0,0},{188,0,0},{190,0,0},{191,0,0},{193,0,0},{195,0,0},{196,0,0},
  {198,0,0},{200,0,0},{201,0,0},{203,0,0},{205,0,0},{206,0,0},{208,0,0},{210,0,0},
  {211,0,0},{213,0,0},{215,0,0},{216,0,0},{218,0,0},{220,0,0},{221,0,0},{223,0,0},
  {225,0,0},{227,0,0},{228,0,0},{230,0,0},{232,0,0},{233,0,0},{235,0,0},{237,0,0},
  {239,0,0},{240,0,0},{242,0,0},{244,0,0},{245,0,0},{247,0,0},{249,0,0},{251,0,0},
  {252,0,0},{254,0,0},{254,23,15},{252,47,34},{249,62,46},{247,75,57},{244,85,67},{242,94,75},
  {239,103,84},{236,111,92},{232,118,100},{229,125,107},{225,132,115},{222,139,122},{218,145,129},{213,151,137},
  {209,157,144},{204,163,151},{199,168,158},{193,174,165},{188,179,172},{181,185,179},{175,190,186},{167,195,193},
  {159,200,200},{151,205,207},{141,210,214},{130,215,221},{118,220,228},{103,224,235},{85,229,242},{58,234,249},
  {0,238,255},{0,238,255},{0,238,255},{0,238,255},{0,238,255},{0,238,255},{0,238,255},{0,238,255},
  {0,238,255},{0,238,255},{0,238,255},{0,238,255},{0,238,255},{0,238,255},{0,238,255},{0,238,255},
  {0,238,255},{0,238,255},{0,238,255},{0,238,255},{0,238,255},{0,238,255},{0,238,255},{0,238,255},
  {0,238,255},{0,238,255},{0,238,255},{0,238,255},{0,238,255},{0,238,255},{0,238,255},{0,238,255},
};

static void seedCollidingPulses(float width) {
  float w = (width > 0.001f) ? width : 0.15f;
  float invWidthSq = 1.0f / (w * w);

  for (int i = 0; i < FRAME_W; i++) {
    float x = (float)i / (float)(FRAME_W - 1);
    float d1 = (x - 0.28f) / w;
    float d2 = (x - 0.72f) / w;
    float p1 = expf(-(d1 * d1));
    float p2 = expf(-(d2 * d2));
    q[i] = 1.5f * (p1 + p2);

    float dp1 = -((x - 0.28f) * invWidthSq) * p1;
    float dp2 = ((x - 0.72f) * invWidthSq) * p2;
    v[i] = 1.2f * (dp1 + dp2);
    a[i] = 0.0f;
  }

  q[0] = 0.0f;
  q[FRAME_W - 1] = 0.0f;
  v[0] = 0.0f;
  v[FRAME_W - 1] = 0.0f;
}

void setup() {
  if (!history) {
    history = PFMem::allocFloats(FRAME_W * FRAME_H);
  }
  if (!history) return;

  head = 0;
  ampEma = 0.5f;
  tAccum = 0.0f;

  seedCollidingPulses(0.15f);

  const float dtSub = 0.02f;
  const float nonlin = 4.2f;
  for (int step = 0; step < FRAME_H; step++) {
    for (int s = 0; s < 6; s++) {
      for (int i = 1; i < FRAME_W - 1; i++) {
        float dL = q[i] - q[i - 1];
        float dR = q[i + 1] - q[i];
        a[i] = (dR - dL) + nonlin * (dR * dR * dR - dL * dL * dL);
      }
      for (int i = 1; i < FRAME_W - 1; i++) {
        v[i] += a[i] * dtSub;
        q[i] += v[i] * dtSub;
      }
    }
    int rowOffset = step * FRAME_W;
    for (int i = 0; i < FRAME_W; i++) {
      history[rowOffset + i] = q[i];
    }
  }
}

void update(float dt, const InputFrame& input) {
  PFParams::apply(input, 0, &kNonlin, 0.2f, 9.0f, 0.183f);
  PFParams::apply(input, 1, &kSpeed, 0.3f, 6.0f, 0.119f);
  PFParams::apply(input, 2, &kWidth, 0.08f, 0.35f, 0.006f);
  PFParams::apply(input, 3, &kSharpness, 0.5f, 3.0f, 0.052f);

  if (input.btnPressed[0] && !input.paramAbsoluteActive[0] && !input.knobAudioActive[0]) {
    seedCollidingPulses(kWidth);
  }

  if (!history) return;

  float safeDt = fminf(dt > 0.0f ? dt : 0.016f, 0.08f);
  tAccum += safeDt;
  constexpr float T_PERIOD = 240.0f * PI;
  if (tAccum > T_PERIOD) tAccum -= T_PERIOD;

  constexpr int substeps = 6;
  float dtSub = (safeDt * kSpeed * 2.4f) / (float)substeps;

  for (int s = 0; s < substeps; s++) {
    for (int i = 1; i < FRAME_W - 1; i++) {
      float dL = q[i] - q[i - 1];
      float dR = q[i + 1] - q[i];
      a[i] = (dR - dL) + kNonlin * (dR * dR * dR - dL * dL * dL);
    }
    for (int i = 1; i < FRAME_W - 1; i++) {
      v[i] += a[i] * dtSub;
      q[i] += v[i] * dtSub;
    }
  }

  float totalE = 0.0f;
  float maxAbs = 0.001f;
  for (int i = 1; i < FRAME_W - 1; i++) {
    float dq = q[i] - q[i - 1];
    totalE += 0.5f * v[i] * v[i] + 0.5f * dq * dq;
    float absQ = fabsf(q[i]);
    if (absQ > maxAbs) maxAbs = absQ;
  }

  if (!isfinite(totalE) || totalE > 6000.0f || !isfinite(q[1])) {
    seedCollidingPulses(kWidth);
    return;
  }

  ampEma = ampEma * 0.95f + maxAbs * 0.05f;
  float scale = 1.0f / fmaxf(0.2f, ampEma);

  int rowOffset = head * FRAME_W;
  for (int i = 0; i < FRAME_W; i++) {
    history[rowOffset + i] = q[i] * scale;
  }
  head = (head + 1) % FRAME_H;
}

void draw() {
  PFCanvas::setFrame(FRAME_W, FRAME_H);

  if (!history) {
    PFCanvas::present();
    return;
  }

  for (int y = 0; y < FRAME_H; y++) {
    int rowIdx = (head - 1 - y + FRAME_H * 2) % FRAME_H;
    const float* row = &history[rowIdx * FRAME_W];

    for (int x = 0; x < FRAME_W; x++) {
      float val = row[x];
      float left = row[(x > 0) ? (x - 1) : 0];
      float right = row[(x < FRAME_W - 1) ? (x + 1) : (FRAME_W - 1)];

      float curvature = fabsf(right - 2.0f * val + left) * 2.5f;
      float baseIntensity = fabsf(val);
      float v = baseIntensity * 0.6f + curvature * 0.4f * kSharpness;

      if (v < 0.0f) v = 0.0f;
      else if (v > 1.0f) v = 1.0f;
      v = v * v * (3.0f - 2.0f * v);

      int li = (int)(v * 255.0f + 0.5f);
      if (li < 0) li = 0;
      else if (li > 255) li = 255;

      PFCanvas::setPixel(x, y, RAMP_LUT[li][0], RAMP_LUT[li][1], RAMP_LUT[li][2]);
    }
  }

  PFCanvas::present();
}

} // namespace SolitonLattice