#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_math.h"

namespace HexagonalHivePulse {

constexpr int FRAME_W = 64;
constexpr int FRAME_H = 128;

const char* NAME = "Hex Hive Pulse";
const char* const KNOB_LABELS[4] = {"HexSize", "PulseSpeed", "RingFreq", "Sharpness"};

// Knob state initialized to Pattern Lab default values
static float hexSizeParam = 2.236f;
static float speedParam = 1.269f;
static float ringFreqParam = 6.63f;
static float sharpParam = 1.0f;

static float timeAcc = 0.0f;

static const uint8_t RAMP_LUT[256][3] = {
  {255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},
  {255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},
  {255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},
  {255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},
  {255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},
  {255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{251,0,0},
  {245,0,0},{239,0,0},{233,0,0},{227,0,0},{221,0,0},{215,0,0},{209,0,0},{203,0,0},
  {197,0,0},{190,0,0},{184,0,0},{178,0,0},{172,0,0},{166,0,0},{160,0,0},{154,0,0},
  {148,0,0},{142,0,0},{136,0,0},{129,0,0},{123,0,0},{117,0,0},{111,0,0},{105,0,0},
  {99,0,0},{93,0,0},{87,0,0},{81,0,0},{75,0,0},{68,0,0},{62,0,0},{56,0,0},
  {50,0,0},{44,0,0},{38,0,0},{32,0,0},{26,0,0},{20,0,0},{14,0,0},{7,0,0},
  {1,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
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
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
  {8,8,8},{16,16,16},{24,24,24},{32,32,32},{40,40,40},{48,48,48},{56,56,56},{65,65,65},
  {73,73,73},{81,81,81},{89,89,89},{97,97,97},{105,105,105},{113,113,113},{121,121,121},{130,130,130},
  {138,138,138},{146,146,146},{154,154,154},{162,162,162},{170,170,170},{178,178,178},{187,187,187},{195,195,195},
  {203,203,203},{211,211,211},{219,219,219},{227,227,227},{235,235,235},{243,243,243},{252,252,252},{255,255,255},
  {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
  {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
};

void setup() {
  PFMath::buildSinLUT();
}

void update(float dt, const InputFrame& input) {
  hexSizeParam += input.knobDeltas[0] * 0.05f;
  hexSizeParam = fminf(fmaxf(hexSizeParam, 2.0f), 6.0f);

  speedParam += input.knobDeltas[1] * 0.1f;
  speedParam = fminf(fmaxf(speedParam, 0.5f), 5.0f);

  ringFreqParam += input.knobDeltas[2] * 0.05f;
  ringFreqParam = fminf(fmaxf(ringFreqParam, 1.0f), 15.0f);

  sharpParam += input.knobDeltas[3] * 0.05f;
  sharpParam = fminf(fmaxf(sharpParam, 1.0f), 6.0f);

  timeAcc += dt * speedParam;
  if (timeAcc > TWO_PI) {
    timeAcc -= TWO_PI;
  }
}

void draw() {
  PFCanvas::setFrame(FRAME_W, FRAME_H);

  const float invHexSize = 1.0f / fmaxf(hexSizeParam, 0.001f);
  const float sqrt3_over_3 = 0.57735026919f; // Math.sqrt(3) / 3

  for (int y = 0; y < FRAME_H; y++) {
    const float y_float = (float)y;
    const float rx = (y_float * (2.0f / 3.0f)) * invHexSize;
    const float r_float = roundf(rx);
    const float y_term = (y_float / 3.0f) * invHexSize;

    for (int x = 0; x < FRAME_W; x++) {
      const float x_float = (float)x;
      const float qx = (x_float * sqrt3_over_3) * invHexSize - y_term;
      const float q_float = roundf(qx);

      const float distFromCenter = sqrtf(q_float * q_float + r_float * r_float + q_float * r_float);
      const float angle = distFromCenter * ringFreqParam - timeAcc;

      const float rawSin = PFMath::fastSin(angle);
      const float baseVal = (rawSin + 1.0f) * 0.5f;

      const float wave = PFMath::fastPow(baseVal, sharpParam);
      const float clampedWave = fminf(1.0f, fmaxf(0.0f, wave));

      const int li = (int)(clampedWave * 255.0f + 0.5f);
      PFCanvas::setPixel(x, y, RAMP_LUT[li][0], RAMP_LUT[li][1], RAMP_LUT[li][2]);
    }
  }

  PFCanvas::present();
}

} // namespace HexagonalHivePulse