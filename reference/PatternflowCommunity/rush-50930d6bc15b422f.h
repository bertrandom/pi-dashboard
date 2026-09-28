#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_params.h"
#include "src/core_math.h"

namespace RushPattern {

const char* NAME = "RUSH";
const char* const KNOB_LABELS[4] = {"RibDiv", "FallSpeed", "PinchExp", "RingGlow"};
constexpr bool ABSOLUTE_READY = true;

constexpr int FRAME_W = 64;
constexpr int FRAME_H = 128;

// Knob state defaults
static float g_ribDiv = 10.033f;
static float g_fallSpeed = 24.877f;
static float g_pinchExp = 1.31f;
static float g_ringGlow = 0.882f;

// Dynamic state
static float g_depth = 0.0f;
static float g_bend = 1.0f;

// Pre-baked Color Ramp LUT
static const uint8_t RAMP_LUT[256][3] = {
  {0,0,0},{0,0,0},{2,0,0},{4,2,0},{7,5,0},{9,12,0},{6,21,1},{0,30,12},
  {0,37,28},{0,44,43},{0,51,58},{0,57,77},{0,62,104},{39,63,122},{68,64,132},{96,63,137},
  {122,63,134},{146,63,125},{169,65,109},{188,70,86},{197,76,69},{198,76,73},{199,76,77},{200,76,80},
  {201,75,84},{202,75,88},{203,75,91},{204,76,95},{204,76,99},{205,76,102},{205,76,106},{206,76,110},
  {206,77,113},{207,77,117},{207,77,121},{207,78,125},{208,78,128},{208,79,132},{208,79,136},{208,80,140},
  {208,81,143},{208,81,147},{208,82,151},{207,83,155},{207,84,159},{207,84,162},{206,85,166},{206,86,170},
  {205,87,174},{205,88,178},{204,89,181},{204,90,185},{203,91,189},{202,93,193},{201,94,196},{200,95,200},
  {199,96,204},{198,97,207},{197,99,211},{195,100,214},{194,101,218},{193,102,222},{191,104,225},{190,105,228},
  {188,107,232},{186,108,235},{185,110,239},{183,111,242},{181,113,245},{179,114,248},{177,116,251},{175,117,254},
  {172,120,255},{169,123,255},{166,126,255},{164,129,255},{161,131,255},{158,134,255},{156,136,255},{153,138,255},
  {151,141,255},{149,143,255},{146,145,255},{144,147,255},{142,149,255},{139,151,255},{137,153,255},{135,154,255},
  {133,156,255},{130,158,255},{128,160,255},{126,161,255},{123,163,255},{121,165,255},{119,166,255},{116,168,255},
  {114,170,255},{111,171,255},{108,173,255},{106,174,255},{103,176,255},{100,177,255},{97,179,255},{94,180,255},
  {90,182,255},{87,183,255},{83,185,255},{78,187,255},{74,188,255},{68,190,255},{62,191,255},{55,193,255},
  {47,194,255},{36,196,255},{18,198,255},{0,199,254},{0,200,252},{0,202,250},{0,203,248},{0,204,246},
  {0,205,245},{0,206,243},{0,208,241},{0,209,239},{0,210,238},{0,211,236},{0,212,234},{0,213,233},
  {0,214,231},{0,215,230},{0,217,228},{0,218,226},{0,219,225},{0,220,223},{0,221,221},{0,222,219},
  {0,223,217},{0,224,216},{0,225,214},{0,226,212},{0,228,209},{0,229,207},{0,230,205},{0,231,203},
  {0,232,200},{0,233,198},{0,234,195},{0,235,192},{0,237,189},{0,238,186},{0,239,183},{0,240,179},
  {0,241,175},{0,243,171},{0,244,166},{0,245,161},{0,246,155},{0,248,149},{0,249,143},{0,250,135},
  {0,252,126},{0,253,115},{0,254,103},{30,255,91},{56,255,81},{72,255,70},{85,255,54},{96,255,30},
  {102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},
  {102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},
  {102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},
  {102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},
  {102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},
  {102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},
  {102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},
  {102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},
  {102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},
  {102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},
  {102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},
};

void setup() {
  PFMath::buildSinLUT();
}

void update(float dt, const InputFrame& input) {
  PFParams::apply(input, 0, &g_ribDiv, 3.0f, 16.0f, 0.271f);
  PFParams::apply(input, 1, &g_fallSpeed, 5.0f, 30.0f, 0.521f);
  PFParams::apply(input, 2, &g_pinchExp, 0.3f, 2.5f, 0.046f);
  PFParams::apply(input, 3, &g_ringGlow, 0.4f, 2.5f, 0.044f);

  g_depth += dt * g_fallSpeed * 0.12f;
  constexpr float DEPTH_PERIOD = 100.0f * TWO_PI;
  if (g_depth > DEPTH_PERIOD) {
    g_depth -= DEPTH_PERIOD;
  }

  if (input.btnPressed[0] && !input.paramAbsoluteActive[0] && !input.knobAudioActive[0]) {
    g_bend = -g_bend;
  }
}

void draw() {
  PFCanvas::setFrame(FRAME_W, FRAME_H);

  const float cx = (FRAME_W - 1) * 0.5f;
  const float invW05 = 1.0f / (FRAME_W * 0.5f);
  const float invH = 1.0f / (float)FRAME_H;
  const float invGlowExp = 1.0f / fmaxf(0.001f, g_ringGlow);
  const float invPi = 1.0f / PI;
  const float ribFreq = g_ribDiv * PI;
  const float depth2 = g_depth * 2.0f;

  for (int y = 0; y < FRAME_H; y++) {
    const float ny = y * invH;
    const float z = PFMath::fastPow(ny, g_pinchExp);

    const float bendPhase = ny * TWO_PI + g_depth * 0.3f;
    const float bendX = PFMath::fastSin(bendPhase) * (FRAME_W * 0.15f) * g_bend;

    const float zPlusOffset = z + 0.08f;
    const float invZOffset = 1.0f / zPlusOffset;
    const float rawV = invZOffset - depth2;
    const float v = PFMath::fract(rawV);
    const float ringWave = PFMath::fastCos(v * TWO_PI) * 0.5f + 0.5f;
    const float zFactor = 0.3f + z * 0.7f;

    for (int x = 0; x < FRAME_W; x++) {
      const float nx = (x - cx - bendX) * invW05;

      const float u = PFMath::fastAtan2(z, nx) * invPi;

      const float ribWave = PFMath::fastCos(u * ribFreq) * 0.5f + 0.5f;

      float val = (ribWave * 0.5f + ringWave * 0.5f) * zFactor;
      val = fminf(1.0f, fmaxf(0.0f, val));
      val = PFMath::fastPow(val, invGlowExp);

      int li = (int)(val * 255.0f + 0.5f);
      if (li < 0) li = 0;
      if (li > 255) li = 255;

      PFCanvas::setPixel(x, y, RAMP_LUT[li][0], RAMP_LUT[li][1], RAMP_LUT[li][2]);
    }
  }

  PFCanvas::present();
}

} // namespace RushPattern