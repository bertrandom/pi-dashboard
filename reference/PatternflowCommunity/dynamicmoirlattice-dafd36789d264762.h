#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_math.h"

namespace DynamicMoirLattice {

constexpr int FRAME_W = 64;
constexpr int FRAME_H = 128;

const char* NAME = "Dynamic Moiré";
const char* const KNOB_LABELS[4] = {"Speed", "LatticeScale", "Angle", "DynamicGlow"};

// State initialized to Pattern Lab default values
static float speedParam = 3.543f;
static float latticeScaleParam = 4.758f;
static float angleParam = 94.929f;
static float dynamicGlowParam = 3.0f;

static float timeAcc = 0.0f;

static const uint8_t RAMP_LUT[256][3] = {
  {0,191,255},{0,182,254},{0,173,253},{0,165,252},{0,156,251},{0,147,250},{0,139,248},{0,130,247},
  {0,122,246},{0,113,245},{0,105,244},{0,97,243},{0,89,242},{0,81,241},{0,73,240},{0,65,239},
  {0,57,237},{0,49,236},{0,42,235},{0,34,234},{0,26,233},{0,19,232},{0,11,231},{0,4,230},
  {3,0,229},{11,0,228},{18,0,226},{25,0,225},{32,0,224},{39,0,223},{46,0,222},{52,0,221},
  {59,0,220},{66,0,219},{72,0,218},{79,0,217},{85,0,215},{92,0,214},{98,0,213},{104,0,212},
  {110,0,210},{117,0,210},{123,0,209},{129,0,208},{134,0,207},{140,0,206},{146,0,205},{152,0,203},
  {157,0,202},{163,0,201},{168,0,200},{174,0,199},{179,0,198},{184,0,197},{190,0,196},{195,0,195},
  {194,0,187},{192,0,180},{191,0,173},{190,0,166},{189,0,159},{188,0,152},{187,0,145},{186,0,138},
  {185,0,132},{184,0,125},{183,0,119},{181,0,112},{180,0,106},{179,0,99},{178,0,93},{177,0,87},
  {176,0,81},{175,0,75},{174,0,69},{173,0,63},{172,0,57},{170,0,51},{169,0,45},{168,0,40},
  {167,0,34},{166,0,29},{165,0,23},{164,0,18},{163,0,13},{162,0,7},{161,0,2},{160,3,0},
  {158,8,0},{157,13,0},{156,18,0},{155,23,0},{154,27,0},{153,32,0},{152,37,0},{151,41,0},
  {150,46,0},{149,50,0},{147,54,0},{146,59,0},{145,63,0},{144,67,0},{143,71,0},{142,75,0},
  {141,79,0},{140,83,0},{139,86,0},{138,90,0},{136,94,0},{135,97,0},{134,101,0},{133,104,0},
  {132,107,0},{131,111,0},{130,114,0},{129,117,0},{128,120,0},{127,123,0},{125,125,0},{120,124,0},
  {115,123,0},{110,122,0},{105,121,0},{100,120,0},{96,119,0},{91,118,0},{87,117,0},{82,116,0},
  {78,115,0},{73,113,0},{69,112,0},{65,111,0},{61,110,0},{57,109,0},{53,108,0},{49,107,0},
  {45,106,0},{41,105,0},{37,104,0},{34,102,0},{30,101,0},{26,100,0},{23,99,0},{20,98,0},
  {16,97,0},{13,96,0},{10,95,0},{7,94,0},{4,93,0},{1,91,0},{0,90,2},{0,89,5},
  {0,88,8},{0,87,10},{0,86,13},{0,85,15},{0,84,18},{0,83,20},{0,82,23},{0,80,25},
  {0,79,27},{0,78,29},{0,77,31},{0,76,33},{0,75,35},{0,74,37},{0,73,39},{0,72,40},
  {0,71,42},{0,70,44},{0,68,45},{0,67,46},{0,66,48},{0,65,49},{0,64,50},{0,63,51},
  {0,62,52},{0,61,53},{0,60,54},{0,59,55},{0,57,56},{0,56,56},{1,49,55},{2,40,54},
  {3,32,52},{5,25,51},{6,18,50},{7,13,48},{8,8,47},{14,9,45},{20,9,44},{25,10,43},
  {29,11,41},{32,11,40},{36,12,39},{37,12,36},{36,13,32},{34,13,28},{33,14,24},{32,14,21},
  {30,14,18},{29,14,15},{28,15,14},{26,17,14},{25,18,14},{23,19,14},{22,19,13},{21,19,13},
  {19,19,13},{17,18,12},{15,17,12},{14,15,11},{12,14,10},{11,12,10},{9,11,9},{8,10,8},
  {7,8,7},{6,7,6},{5,6,5},{4,4,4},{3,3,3},{1,2,2},{0,0,0},{0,0,0},
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
};

void setup() {
  PFMath::buildSinLUT();
}

void update(float dt, const InputFrame& input) {
  speedParam += input.knobDeltas[0] * 0.05f;
  speedParam = fminf(fmaxf(speedParam, 0.1f), 6.0f);

  latticeScaleParam += input.knobDeltas[1] * 0.1f;
  latticeScaleParam = fminf(fmaxf(latticeScaleParam, 2.0f), 10.0f);

  angleParam += input.knobDeltas[2] * 0.05f;
  angleParam = fminf(fmaxf(angleParam, 90.0f), 100.0f);

  dynamicGlowParam += input.knobDeltas[3] * 0.05f;
  dynamicGlowParam = fminf(fmaxf(dynamicGlowParam, 0.2f), 3.0f);

  timeAcc += dt * speedParam;
  constexpr float PERIOD = 20.0f * PI;
  if (timeAcc > PERIOD) {
    timeAcc -= PERIOD;
  }
}

void draw() {
  PFCanvas::setFrame(FRAME_W, FRAME_H);

  constexpr float cx = FRAME_W * 0.5f;
  constexpr float cy = FRAME_H * 0.5f;
  constexpr float invNormDist = 1.0f / (FRAME_W * 0.8f);

  const float scale = fmaxf(0.001f, latticeScaleParam);
  const float invScale = 1.0f / scale;

  const float rot = angleParam + PFMath::fastSin(timeAcc * 0.5f) * 0.2f;
  const float cosA = PFMath::fastCos(rot);
  const float sinA = PFMath::fastSin(rot);

  const float glowFactor = 1.0f - dynamicGlowParam;

  for (int y = 0; y < FRAME_H; y++) {
    const float dy = (float)y - cy;
    const float dy_05 = dy * 0.5f;
    const float dy_sq = dy_05 * dy_05;
    const float sin_dy_scale = PFMath::fastSin(dy * invScale);

    for (int x = 0; x < FRAME_W; x++) {
      const float dx = (float)x - cx;

      const float l1 = PFMath::fastSin(dx * invScale) * sin_dy_scale;

      const float rx = dx * cosA - dy * sinA;
      const float ry = dx * sinA + dy * cosA;
      const float l2 = PFMath::fastSin(rx * invScale + timeAcc) * PFMath::fastSin(ry * invScale + timeAcc);

      const float interference = fabsf((l1 + l2) * 0.5f);

      float val = PFMath::fastPow(interference, 1.5f) * 1.8f;

      const float distFromCenter = sqrtf(dx * dx + dy_sq) * invNormDist;
      const float vignette = fmaxf(0.1f, 1.0f - distFromCenter * glowFactor);
      val *= vignette;

      const float clampedVal = fminf(1.0f, fmaxf(0.0f, val));
      const int li = (int)(clampedVal * 255.0f + 0.5f);

      PFCanvas::setPixel(x, y, RAMP_LUT[li][0], RAMP_LUT[li][1], RAMP_LUT[li][2]);
    }
  }

  PFCanvas::present();
}

} // namespace DynamicMoirLattice