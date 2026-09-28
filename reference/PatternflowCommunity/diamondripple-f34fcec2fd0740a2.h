#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_math.h"
#include "src/core_tables.h"

namespace DiamondRipple {

const char* NAME = "Diamond Ripple";
const char* const KNOB_LABELS[4] = {"Speed", "Size", "Ripple", "Width"};

static const uint8_t RAMP_LUT[256][3] = {
  {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
  {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
  {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
  {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
  {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
  {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
  {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
  {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
  {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
  {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
  {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
  {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
  {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
  {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
  {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
  {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
  {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
  {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
  {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{251,251,251},{246,246,246},{241,241,241},
  {236,236,236},{231,231,231},{226,226,226},{221,221,221},{216,216,216},{211,211,211},{206,206,206},{201,201,201},
  {196,196,196},{191,191,191},{186,186,186},{182,182,182},{177,177,177},{172,172,172},{167,167,167},{162,162,162},
  {157,157,157},{152,152,152},{147,147,147},{142,142,142},{137,137,137},{132,132,132},{127,127,127},{122,122,122},
  {117,117,117},{112,112,112},{107,107,107},{102,102,102},{97,97,97},{92,92,92},{87,87,87},{83,83,83},
  {78,78,78},{73,73,73},{68,68,68},{63,63,63},{58,58,58},{53,53,53},{48,48,48},{43,43,43},
  {38,38,38},{33,33,33},{28,28,28},{23,23,23},{18,18,18},{13,13,13},{8,8,8},{3,3,3},
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
};

static float speedParam  = 6.0f;
static float sizeParam   = 13.689f;
static float rippleParam = 2.371f;
static float widthParam  = 3.399f;

static constexpr float DIAMOND_SPEED_STEP  = 0.05f;
static constexpr float DIAMOND_SIZE_STEP   = 0.1f;
static constexpr float DIAMOND_RIPPLE_STEP = 0.05f;
static constexpr float DIAMOND_WIDTH_STEP  = 0.05f;

static constexpr float DIAMOND_SPEED_MIN   = 0.1f;
static constexpr float DIAMOND_SPEED_MAX   = 6.0f;
static constexpr float DIAMOND_SIZE_MIN    = 3.0f;
static constexpr float DIAMOND_SIZE_MAX    = 20.0f;
static constexpr float DIAMOND_RIPPLE_MIN  = 0.0f;
static constexpr float DIAMOND_RIPPLE_MAX  = 5.0f;
static constexpr float DIAMOND_WIDTH_MIN   = 1.0f;
static constexpr float DIAMOND_WIDTH_MAX   = 5.0f;

static constexpr float DIAMOND_T_WRAP = 4.0f * PI;

static float t = 0.0f;

void setup() {
  PFMath::buildSinLUT();
  PFTables::init();
}

void update(float dt, const InputFrame& input) {
  speedParam  += input.knobDeltas[0] * DIAMOND_SPEED_STEP;
  if (speedParam < DIAMOND_SPEED_MIN) speedParam = DIAMOND_SPEED_MIN;
  if (speedParam > DIAMOND_SPEED_MAX) speedParam = DIAMOND_SPEED_MAX;

  sizeParam   += input.knobDeltas[1] * DIAMOND_SIZE_STEP;
  if (sizeParam < DIAMOND_SIZE_MIN) sizeParam = DIAMOND_SIZE_MIN;
  if (sizeParam > DIAMOND_SIZE_MAX) sizeParam = DIAMOND_SIZE_MAX;

  rippleParam += input.knobDeltas[2] * DIAMOND_RIPPLE_STEP;
  if (rippleParam < DIAMOND_RIPPLE_MIN) rippleParam = DIAMOND_RIPPLE_MIN;
  if (rippleParam > DIAMOND_RIPPLE_MAX) rippleParam = DIAMOND_RIPPLE_MAX;

  widthParam  += input.knobDeltas[3] * DIAMOND_WIDTH_STEP;
  if (widthParam < DIAMOND_WIDTH_MIN) widthParam = DIAMOND_WIDTH_MIN;
  if (widthParam > DIAMOND_WIDTH_MAX) widthParam = DIAMOND_WIDTH_MAX;

  t += dt * speedParam;
  if (t > DIAMOND_T_WRAP) t -= DIAMOND_T_WRAP;
}

void draw() {
  const float t_local = t;
  const float ripple = rippleParam;
  const float spacing = sizeParam * 3.0f;
  const float threshold = widthParam * 0.2f;   // 1~5 → threshold 0.2~1.0, much stronger
  const int total = PANEL_RES_W * PANEL_RES_H;

  for (int i = 0; i < total; i++) {
    float r = PFTables::rT[i] * (float)PANEL_RES_H;
    float th = PFTables::thetaT[i];

    float rippleOffset = ripple * 4.0f * PFMath::fastSin(r * 0.08f - t_local * 1.5f);
    float rr = r + rippleOffset;

    float rx = rr * PFMath::fastCos(th);
    float ry = rr * PFMath::fastSin(th);

    float u = (rx + ry) / spacing;
    float v = (rx - ry) / spacing;

    u -= floorf(u);
    v -= floorf(v);

    float fu = fabsf(u - 0.5f) * 2.0f;
    float fv = fabsf(v - 0.5f) * 2.0f;

    float val = 0.06f;
    if (fu < threshold || fv < threshold) {
      val = 1.0f;
    }

    if (val < 0.0f) val = 0.0f;
    if (val > 1.0f) val = 1.0f;

    int li = (int)(val * 255.0f + 0.5f);
    int y = i / PANEL_RES_W;
    int x = i - y * PANEL_RES_W;
    PFCanvas::setPixel(x, y, RAMP_LUT[li][0], RAMP_LUT[li][1], RAMP_LUT[li][2]);
  }

  PFCanvas::present();
}

} // namespace DiamondRipple