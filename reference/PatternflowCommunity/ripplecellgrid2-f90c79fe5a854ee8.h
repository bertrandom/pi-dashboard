#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_params.h"
#include "src/core_math.h"
#include "src/core_tables.h"

namespace RippleCellGrid2 {

const char* NAME = "RippleCellGrid2";
const char* const KNOB_LABELS[4] = {"Speed", "Size", "Ripple", "Density"};
constexpr bool ABSOLUTE_READY = true;

// Pre-baked color ramp LUT (stops 0.157:#000000, 0.409:#ff0000, 0.562:#ff0000, 0.669:#eeff00, 0.822:#000000; mode oklab; wrap off)
static const uint8_t RAMP_LUT[256][3] = {
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{1,0,0},{2,0,0},{3,0,0},{4,0,0},
  {6,0,0},{9,0,0},{12,0,0},{15,0,0},{19,0,0},{22,0,0},{26,0,0},{29,0,0},
  {33,0,0},{37,0,0},{41,0,0},{44,0,0},{48,0,0},{52,0,0},{56,0,0},{60,0,0},
  {64,0,0},{68,0,0},{73,0,0},{77,0,0},{81,0,0},{85,0,0},{90,0,0},{94,0,0},
  {98,0,0},{103,0,0},{107,0,0},{112,0,0},{116,0,0},{121,0,0},{125,0,0},{130,0,0},
  {135,0,0},{139,0,0},{144,0,0},{149,0,0},{153,0,0},{158,0,0},{163,0,0},{168,0,0},
  {173,0,0},{177,0,0},{182,0,0},{187,0,0},{192,0,0},{197,0,0},{202,0,0},{207,0,0},
  {212,0,0},{217,0,0},{222,0,0},{228,0,0},{233,0,0},{238,0,0},{243,0,0},{248,0,0},
  {253,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},
  {255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},
  {255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},
  {255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},
  {255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},
  {255,32,4},{255,53,10},{255,69,16},{255,81,20},{255,92,24},{255,102,28},{255,111,31},{255,119,34},
  {255,127,36},{255,135,39},{255,143,40},{255,150,42},{255,157,42},{255,164,43},{255,171,42},{255,177,40},
  {255,184,35},{255,190,27},{255,197,6},{254,204,0},{252,211,0},{251,217,0},{249,224,0},{247,231,0},
  {245,238,0},{242,244,0},{240,251,0},{235,252,0},{227,243,0},{219,234,0},{211,226,0},{203,218,0},
  {195,209,0},{187,201,0},{180,193,0},{172,185,0},{165,177,0},{157,169,0},{150,161,0},{142,153,0},
  {135,145,0},{128,137,0},{120,130,0},{113,122,0},{106,115,0},{99,107,0},{93,100,0},{86,93,0},
  {79,86,0},{73,78,0},{66,72,0},{60,65,0},{54,58,0},{47,52,0},{41,45,0},{35,39,0},
  {30,33,0},{24,27,0},{19,21,0},{13,15,0},{8,10,0},{5,5,0},{2,3,0},{1,1,0},
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
};

static float speed = 0.698f;
static float size = 4.349f;
static float ripple = 2.442f;
static float density = 2.283f;
static float t = 0.0f;

void setup() {
  PFMath::buildSinLUT();
  PFTables::init();
}

void update(float dt, const InputFrame& input) {
  PFParams::apply(input, 0, &speed, 0.0f, 2.0f, 0.042f);
  PFParams::apply(input, 1, &size, 3.0f, 6.0f, 0.063f);
  PFParams::apply(input, 2, &ripple, 0.0f, 5.0f, 0.104f);
  PFParams::apply(input, 3, &density, 0.5f, 3.0f, 0.052f);

  t += dt * speed;
  if (t >= 4.0f * PI) {
    t -= 4.0f * PI;
  }
}

void draw() {
  const float cellSpacing = size * 2.5f;
  const float invCellSpacing = 1.0f / cellSpacing;
  const float halfCellSpacing = cellSpacing * 0.5f;
  const float edgeWidth = density * 2.5f;
  const float invEdgeWidth = 1.0f / edgeWidth;
  const float rippleAmp = ripple * 4.0f;
  const float t15 = t * 1.5f;

  for (int y = 0; y < PANEL_RES_H; ++y) {
    const int rowOffset = y * PANEL_RES_W;
    for (int x = 0; x < PANEL_RES_W; ++x) {
      const int idx = rowOffset + x;
      const float dist = PFTables::rT[idx] * (float)PANEL_RES_H;
      const float angle = PFTables::thetaT[idx];

      const float rippleOffset = rippleAmp * PFMath::fastSin(dist * 0.08f - t15);
      const float r_dist = dist + rippleOffset;

      const float rx = r_dist * PFMath::fastCos(angle);
      const float ry = r_dist * PFMath::fastSin(angle);

      const float cx2 = floorf(rx * invCellSpacing) * cellSpacing + halfCellSpacing;
      const float cy2 = floorf(ry * invCellSpacing) * cellSpacing + halfCellSpacing;

      const float ox = rx - cx2;
      const float oy = ry - cy2;
      const float minDist = sqrtf(ox * ox + oy * oy);

      float val = (minDist < edgeWidth) ? (1.0f - (minDist * invEdgeWidth) * 0.9f) : 0.05f;

      if (val < 0.0f) val = 0.0f;
      else if (val > 1.0f) val = 1.0f;

      const int li = (int)(val * 255.0f + 0.5f);
      PFCanvas::setPixel(x, y, RAMP_LUT[li][0], RAMP_LUT[li][1], RAMP_LUT[li][2]);
    }
  }

  PFCanvas::present();
}

} // namespace RippleCellGrid2