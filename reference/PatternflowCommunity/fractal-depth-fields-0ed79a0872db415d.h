#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_params.h"
#include "src/core_math.h"

namespace FractalDepthFields {

const char* NAME = "Fractal Depth Fields";
const char* const KNOB_LABELS[4] = {"Order", "Speed", "Depth", "Softness"};
constexpr bool ABSOLUTE_READY = true;

constexpr int FRAME_W = 64;
constexpr int FRAME_H = 128;

// Stops 0.000:#000000, 0.159:#81177f, 0.550:#4be879, 1.000:#fbdc04; mode oklchLong; wrap off.
static const uint8_t RAMP_LUT[256][3] = {
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{1,0,0},{2,0,0},{4,0,0},{6,0,0},
  {8,0,0},{9,1,0},{10,2,0},{12,4,0},{13,5,0},{14,8,0},{16,10,0},{16,14,0},
  {16,17,0},{16,20,0},{13,24,0},{6,29,0},{0,32,5},{0,35,16},{0,37,24},{0,40,30},
  {0,42,37},{0,45,43},{0,47,49},{0,49,56},{0,52,63},{0,54,71},{0,55,81},{0,57,92},
  {0,56,109},{8,50,133},{36,48,139},{54,45,143},{69,42,145},{83,38,144},{97,35,142},{110,31,138},
  {122,26,131},{130,23,126},{133,23,125},{136,23,123},{139,23,122},{142,24,120},{144,24,119},{147,24,117},
  {150,24,115},{152,25,113},{155,25,111},{158,26,109},{160,26,107},{163,27,105},{165,27,103},{168,28,101},
  {170,29,99},{172,30,96},{175,31,94},{177,32,92},{179,33,89},{181,34,87},{183,35,84},{185,37,81},
  {187,38,78},{189,40,76},{191,41,73},{193,43,70},{195,45,66},{197,47,63},{198,48,59},{200,50,56},
  {201,52,52},{203,55,48},{204,57,43},{205,59,38},{207,61,32},{208,64,25},{209,66,17},{210,68,3},
  {209,73,0},{208,78,0},{207,82,0},{206,86,0},{205,90,0},{204,94,0},{203,97,0},{202,100,0},
  {202,103,0},{201,106,0},{201,109,0},{200,112,0},{200,114,0},{199,117,0},{199,120,0},{198,122,0},
  {198,125,0},{197,127,0},{197,130,0},{196,132,0},{196,134,0},{195,137,0},{195,139,0},{194,141,0},
  {194,144,0},{193,146,0},{192,148,0},{192,151,0},{191,153,0},{190,155,0},{189,158,0},{188,160,0},
  {187,162,0},{186,165,0},{185,167,0},{183,169,0},{182,172,0},{180,174,0},{179,177,0},{177,179,0},
  {175,182,0},{172,184,0},{170,187,0},{167,190,0},{164,192,0},{160,195,0},{157,198,0},{152,201,0},
  {148,204,13},{143,206,32},{139,209,44},{134,211,54},{129,214,63},{124,216,71},{119,218,79},{113,221,86},
  {107,223,93},{101,225,100},{94,227,106},{86,229,113},{77,231,119},{62,233,127},{39,234,135},{0,235,143},
  {0,234,153},{0,234,162},{0,233,169},{0,233,176},{0,232,183},{0,232,189},{0,232,195},{0,231,200},
  {0,231,205},{0,230,210},{0,230,215},{0,230,219},{0,229,224},{0,229,228},{0,229,233},{0,228,237},
  {0,228,242},{0,227,246},{0,227,250},{0,227,255},{57,225,255},{80,223,255},{96,221,255},{107,220,255},
  {117,218,255},{125,217,255},{132,216,255},{138,215,255},{143,214,255},{148,213,255},{152,212,255},{156,211,255},
  {160,211,255},{164,210,255},{167,209,255},{170,208,255},{173,208,255},{176,207,255},{179,206,255},{182,206,255},
  {185,205,255},{187,205,255},{190,204,255},{192,203,255},{195,203,255},{197,202,255},{200,201,255},{203,201,255},
  {205,200,255},{208,199,255},{210,199,255},{213,198,255},{216,197,255},{219,196,255},{222,195,255},{225,194,255},
  {228,192,255},{232,191,255},{236,189,255},{240,187,255},{244,185,255},{249,183,255},{255,180,255},{255,182,249},
  {255,183,244},{255,184,239},{255,186,235},{255,187,231},{255,188,228},{255,189,224},{255,189,221},{255,190,219},
  {255,191,216},{255,192,214},{255,192,211},{255,193,209},{255,194,207},{255,195,205},{255,195,203},{255,196,201},
  {255,196,199},{255,197,197},{255,198,196},{255,198,194},{255,199,192},{255,199,190},{255,200,189},{255,200,187},
  {255,201,185},{255,201,183},{255,202,182},{255,203,180},{255,203,178},{255,204,175},{255,204,173},{255,205,171},
  {255,205,168},{255,206,166},{255,207,163},{255,207,160},{255,208,156},{255,209,152},{255,209,148},{255,210,143},
  {255,211,137},{255,212,129},{255,213,121},{255,214,110},{255,215,95},{255,216,73},{255,218,25},{251,220,4},
};

static float knobOrder = 1.0f;
static float knobSpeed = 2.0f;
static float knobDepth = 1.0f;
static float knobSoftness = 0.5f;

static float animTime = 0.0f;

void setup() {
  PFMath::buildSinLUT();
}

void update(float dt, const InputFrame& input) {
  PFParams::apply(input, 0, &knobOrder, 1.0f, 5.9f, 0.102f);
  PFParams::apply(input, 1, &knobSpeed, 0.1f, 4.0f, 0.081f);
  PFParams::apply(input, 2, &knobDepth, 0.1f, 1.0f, 0.019f);
  PFParams::apply(input, 3, &knobSoftness, 0.01f, 0.5f, 0.01f);

  animTime += dt * knobSpeed;
  if (animTime > TWO_PI * 100.0f) {
    animTime -= TWO_PI * 100.0f;
  }
}

void draw() {
  PFCanvas::setFrame(FRAME_W, FRAME_H);

  const int order = (int)knobOrder;
  const int N = 1 << order;
  const float cellSizeX = (float)FRAME_W / (float)N;
  const float cellSizeY = (float)FRAME_H / (float)N;
  const float invCellSizeX = 1.0f / cellSizeX;
  const float invCellSizeY = 1.0f / cellSizeY;
  const float invSoftness = 1.0f / knobSoftness;
  const float depthScale = knobDepth;
  const float t = animTime;

  // Precompute depth value per Hilbert cell in N x N grid
  float cellDepth[32][32];
  for (int ly = 0; ly < N; ly++) {
    for (int lx = 0; lx < N; lx++) {
      float depthValue = 0.0f;
      int s = N / 2;
      int curX = lx;
      int curY = ly;

      while (s > 0) {
        int rx = (curX & s) ? 1 : 0;
        int ry = (curY & s) ? 1 : 0;

        int quadIdx = (3 * rx) ^ ry;
        depthValue += PFMath::fastSin(t + (float)quadIdx * depthScale + (float)s);

        if (ry == 0) {
          if (rx == 1) {
            curX = s - 1 - curX;
            curY = s - 1 - curY;
          }
          int temp = curX;
          curX = curY;
          curY = temp;
        }
        s >>= 1;
      }
      cellDepth[ly][lx] = depthValue;
    }
  }

  for (int y = 0; y < FRAME_H; y++) {
    int ly = (int)((float)y * invCellSizeY);
    if (ly >= N) ly = N - 1;
    float cellY = ((float)y - (float)ly * cellSizeY) * invCellSizeY;
    float edgeY = fminf(cellY, 1.0f - cellY);

    for (int x = 0; x < FRAME_W; x++) {
      int lx = (int)((float)x * invCellSizeX);
      if (lx >= N) lx = N - 1;
      float cellX = ((float)x - (float)lx * cellSizeX) * invCellSizeX;
      float edgeX = fminf(cellX, 1.0f - cellX);

      float edge = fminf(edgeX, edgeY);
      float mask = fminf(1.0f, edge * invSoftness);

      float depthValue = cellDepth[ly][lx];
      float val = (PFMath::fastSin(depthValue) * 0.5f + 0.5f) * mask;

      if (val < 0.0f) val = 0.0f;
      else if (val > 1.0f) val = 1.0f;

      int li = (int)(val * 255.0f + 0.5f);
      PFCanvas::setPixel(x, y, RAMP_LUT[li][0], RAMP_LUT[li][1], RAMP_LUT[li][2]);
    }
  }

  PFCanvas::present();
}

} // namespace FractalDepthFields