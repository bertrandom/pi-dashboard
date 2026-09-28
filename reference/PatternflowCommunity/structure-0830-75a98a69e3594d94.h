#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_params.h"
#include "src/core_math.h"

namespace Structure_0830 {

const char* NAME = "Structure_0830";
const char* const KNOB_LABELS[4] = {"WireFreq", "DropSpeed", "NoiseDepth", "PlateGain"};
constexpr bool ABSOLUTE_READY = true;

constexpr int FRAME_W = 64;
constexpr int FRAME_H = 128;

// Knob parameter states initialized to Pattern Lab defaults
static float wireFreq   = 1.0f;
static float dropSpeed  = 16.962f;
static float noiseDepth = 0.338f;
static float plateGain  = 1.481f;

static float yOffset = 0.0f;
static int gridMode = 0;

// Precomputed perspective geometry tables along the tall frame
static float depthZ_LUT[FRAME_H];
static float invDepthZ_LUT[FRAME_H];
static float wallSpread_LUT[FRAME_H];
static float invWallSpread_LUT[FRAME_H];
static float uScale_LUT[FRAME_H];

// Pre-baked color ramp LUT (stops: 0.000:#ffffff, 0.246:#ff0000, 0.465:#00bfff, 0.648:#000000; mode oklchShort; wrap off)
static const uint8_t RAMP_LUT[256][3] = {
  {255,255,255},{255,252,252},{255,250,249},{255,247,246},{255,244,243},{255,242,240},{255,239,236},{255,237,233},
  {255,234,230},{255,231,227},{255,228,224},{255,226,221},{255,223,218},{255,220,215},{255,218,211},{255,215,208},
  {255,212,205},{255,209,202},{255,207,199},{255,204,195},{255,201,192},{255,198,189},{255,195,186},{255,193,182},
  {255,190,179},{255,187,176},{255,184,173},{255,181,169},{255,178,166},{255,175,163},{255,172,159},{255,169,156},
  {255,166,152},{255,163,149},{255,160,146},{255,157,142},{255,154,139},{255,151,135},{255,147,132},{255,144,128},
  {255,141,124},{255,137,121},{255,134,117},{255,130,113},{255,127,110},{255,123,106},{255,119,102},{255,115,98},
  {255,112,94},{255,107,90},{255,103,86},{255,99,82},{255,94,77},{255,90,73},{255,85,68},{255,80,63},
  {255,74,58},{255,68,53},{255,61,47},{255,54,41},{255,46,33},{255,35,25},{255,20,13},{255,1,14},
  {255,6,41},{255,11,57},{255,14,69},{255,19,81},{254,24,91},{253,29,101},{252,34,111},{251,39,120},
  {250,43,128},{248,47,137},{246,52,145},{244,56,153},{242,60,161},{240,64,168},{238,67,176},{235,71,183},
  {232,75,190},{229,78,196},{226,82,203},{223,85,209},{220,89,215},{217,92,221},{213,96,226},{210,99,231},
  {206,102,236},{202,106,241},{198,109,245},{194,112,250},{189,115,253},{184,120,255},{179,125,255},{174,129,255},
  {170,133,255},{165,137,255},{161,140,255},{156,143,255},{152,146,255},{148,149,255},{144,152,255},{140,155,255},
  {136,157,255},{131,160,255},{127,162,255},{123,165,255},{118,167,255},{113,169,255},{108,172,255},{103,174,255},
  {97,176,255},{90,178,255},{83,180,255},{74,183,255},{64,185,255},{50,187,255},{29,190,255},{0,189,252},
  {0,183,245},{0,178,238},{0,172,231},{0,167,223},{0,162,216},{0,156,210},{0,151,203},{0,146,196},
  {0,141,189},{0,135,182},{0,130,175},{0,125,169},{0,120,162},{0,115,155},{0,110,149},{0,105,142},
  {0,100,136},{0,95,130},{0,91,123},{0,86,117},{0,81,111},{0,76,105},{0,72,99},{0,67,93},
  {0,63,87},{0,58,81},{0,54,75},{0,49,69},{0,45,63},{0,41,58},{0,37,52},{0,32,47},
  {0,28,42},{0,24,36},{0,21,31},{0,17,26},{0,13,22},{0,9,17},{0,6,12},{0,4,8},
  {0,2,5},{0,1,2},{0,1,1},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
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

void setup() {
  PFMath::buildSinLUT();

  for (int y = 0; y < FRAME_H; y++) {
    float ny = (float)y / (float)FRAME_H;
    float depthZ = powf(ny, 1.8f) + 0.05f;
    depthZ_LUT[y] = depthZ;
    invDepthZ_LUT[y] = 1.0f / depthZ;

    float wallSpread = (1.0f - depthZ * 0.7f) * ((float)FRAME_W * 0.38f);
    wallSpread_LUT[y] = wallSpread;
    invWallSpread_LUT[y] = (wallSpread > 0.001f) ? (1.0f / wallSpread) : 0.0f;
    uScale_LUT[y] = 1.0f / (depthZ * ((float)FRAME_W * 0.5f));
  }
}

void update(float dt, const InputFrame& input) {
  PFParams::apply(input, 0, &wireFreq, 1.0f, 24.0f, 0.479f);
  PFParams::apply(input, 1, &dropSpeed, 3.0f, 25.0f, 0.458f);
  PFParams::apply(input, 2, &noiseDepth, 0.1f, 2.0f, 0.04f);
  PFParams::apply(input, 3, &plateGain, 0.2f, 2.0f, 0.038f);

  if (input.btnPressed[0] && !input.paramAbsoluteActive[0] && !input.knobAudioActive[0]) {
    gridMode = (gridMode + 1) % 2;
  }

  yOffset += dt * dropSpeed * 0.3f;
  constexpr float Y_WRAP_PERIOD = 200.0f * TWO_PI;
  if (yOffset > Y_WRAP_PERIOD) {
    yOffset -= Y_WRAP_PERIOD;
  }
}

void draw() {
  PFCanvas::setFrame(FRAME_W, FRAME_H);

  constexpr float cx = ((float)FRAME_W - 1.0f) * 0.5f;

  for (int y = 0; y < FRAME_H; y++) {
    const float invDepthZ = invDepthZ_LUT[y];
    const float wallSpread = wallSpread_LUT[y];
    const float invWallSpread = invWallSpread_LUT[y];
    const float uScale = uScale_LUT[y];

    const float vCoord = invDepthZ + yOffset;
    const float cosV3 = PFMath::fastCos(vCoord * 3.0f);
    const float sinV2 = PFMath::fastSin(vCoord * 2.0f) * 0.5f + 0.5f;

    for (int x = 0; x < FRAME_W; x++) {
      const float dx = (float)x - cx;
      const float xDist = fabsf(dx);
      const bool isWall = xDist > wallSpread;

      const float uCoord = dx * uScale;

      // Geological strata noise
      const float rockNoise = PFMath::fastSin(uCoord * 5.0f + cosV3) * noiseDepth;

      // Wireframe grid lines (pow 8 -> (x^2)^2)^2)
      const float latBase = PFMath::fastCos((vCoord + rockNoise * 0.2f) * wireFreq * 0.5f) * 0.5f + 0.5f;
      const float lat2 = latBase * latBase;
      const float lat4 = lat2 * lat2;
      const float latLine = lat4 * lat4;

      const float longBase = PFMath::fastCos(uCoord * 8.0f) * 0.5f + 0.5f;
      const float long2 = longBase * longBase;
      const float long4 = long2 * long2;
      const float longLine = long4 * long4;

      const float gridVal = fmaxf(latLine, longLine);

      float val = 0.0f;
      if (isWall) {
        // High-contrast stepped strata for the walls
        float terrace = (vCoord * 4.0f + rockNoise);
        terrace = terrace - floorf(terrace);
        val = (terrace > 0.6f ? 0.9f : 0.2f) * plateGain + gridVal * 0.4f;
      } else {
        // Deep glowing chasm bottom
        float floorGrad = 1.0f - (xDist * invWallSpread);
        if (floorGrad < 0.0f) floorGrad = 0.0f;
        floorGrad = floorGrad * floorGrad;
        val = floorGrad * (0.4f + 0.6f * sinV2) * plateGain + gridVal * 0.3f;
      }

      val = fminf(1.0f, fmaxf(0.0f, val));
      int li = (int)(val * 255.0f + 0.5f);
      PFCanvas::setPixel(x, y, RAMP_LUT[li][0], RAMP_LUT[li][1], RAMP_LUT[li][2]);
    }
  }

  PFCanvas::present();
}

} // namespace Structure_0830