#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_params.h"
#include "src/core_math.h"
#include "src/core_mem.h"

namespace SandglassHopper {

const char* NAME = "Sandglass";
const char* const KNOB_LABELS[4] = {"FeedRate", "Swirl", "Angle", "JamResist"};
constexpr bool ABSOLUTE_READY = true;

constexpr int FRAME_W = 64;
constexpr int FRAME_H = 128;
constexpr int R_COUNT = 32;

// Precomputed static lookup table for fixed frame geometry
static float anglePrecalc[FRAME_H][FRAME_W];

// State & parameters
static float feedRate = 83.95f;
static float swirlTorque = 0.2f;
static float funnelAngle = 20.0f;
static float jamResistance = 0.99f;

static float timeAcc = 0.0f;
static float peak = 1.0f;

static int32_t pile[R_COUNT];
static int8_t zc[R_COUNT];
static float flux[R_COUNT];
static float* hopperCanvas = nullptr;

static uint32_t rngState = 817263u;

static inline float nextRnd() {
  rngState = rngState * 1664525u + 1013904223u;
  return (float)(rngState >> 8) * (1.0f / 16777216.0f);
}

// Baked Color Ramp LUT (verbatim)
static const uint8_t RAMP_LUT[256][3] = {
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,1},
  {0,0,1},{0,0,1},{0,1,2},{1,1,3},{1,1,3},{1,1,4},{1,2,5},{2,2,6},
  {2,3,8},{2,3,9},{3,4,11},{3,5,13},{4,5,15},{4,6,16},{5,7,18},{6,8,20},
  {6,9,22},{7,10,24},{8,12,26},{9,13,28},{10,14,30},{11,15,31},{12,17,33},{13,18,35},
  {14,19,37},{15,20,39},{17,22,41},{18,23,44},{19,24,46},{20,26,48},{21,27,50},{22,28,52},
  {24,30,54},{25,31,56},{26,33,58},{27,34,60},{28,35,63},{29,37,65},{31,38,67},{32,40,69},
  {33,41,71},{34,42,74},{36,44,76},{37,45,78},{38,47,80},{39,48,83},{41,50,85},{42,51,87},
  {43,53,90},{44,54,92},{46,56,94},{47,57,97},{48,59,99},{50,60,101},{51,62,104},{52,63,106},
  {54,65,108},{55,66,111},{56,68,113},{57,69,116},{59,71,118},{60,73,120},{62,74,123},{63,76,125},
  {64,77,128},{66,79,130},{67,80,133},{68,82,135},{70,84,138},{71,85,140},{72,87,143},{74,88,145},
  {75,90,148},{77,92,150},{78,93,153},{79,95,155},{81,97,158},{82,98,160},{84,100,163},{85,102,166},
  {87,103,168},{88,105,171},{89,107,173},{91,108,176},{92,110,179},{94,112,181},{95,113,184},{97,115,187},
  {98,117,189},{100,118,192},{101,120,194},{102,122,197},{104,124,200},{105,125,202},{107,127,205},{108,129,208},
  {110,131,211},{111,132,213},{113,134,216},{114,136,219},{116,138,221},{117,139,224},{119,141,227},{120,143,230},
  {122,145,232},{123,146,235},{125,148,238},{126,150,241},{128,152,243},{130,153,246},{128,155,248},{126,156,248},
  {124,157,249},{121,159,250},{119,160,251},{116,161,251},{113,162,252},{110,164,252},{108,165,253},{105,166,253},
  {102,168,253},{98,169,253},{95,170,254},{92,171,254},{88,173,254},{85,174,254},{81,175,254},{77,177,254},
  {73,178,253},{69,179,253},{64,180,253},{59,182,252},{54,183,252},{48,184,252},{41,185,251},{33,187,250},
  {23,188,250},{7,189,249},{0,190,247},{0,191,245},{0,192,244},{0,193,242},{0,194,240},{0,195,238},
  {0,196,237},{0,197,235},{0,198,233},{0,199,232},{0,200,230},{0,201,229},{0,201,227},{0,202,226},
  {0,203,224},{0,204,223},{0,205,221},{0,206,220},{0,207,218},{0,207,217},{0,208,215},{0,209,213},
  {0,210,212},{0,211,210},{0,212,209},{0,212,207},{0,213,205},{0,214,204},{0,215,202},{0,216,200},
  {0,217,198},{0,217,196},{0,218,194},{0,219,192},{0,220,190},{0,221,188},{0,222,185},{0,222,183},
  {0,223,180},{0,224,178},{0,225,175},{11,226,172},{29,226,169},{41,227,167},{50,227,164},{58,227,161},
  {65,227,158},{72,228,155},{78,228,152},{84,228,150},{90,228,147},{96,228,144},{101,228,141},{106,228,138},
  {111,228,135},{116,229,132},{121,228,129},{126,228,126},{131,228,123},{135,228,120},{140,228,116},{144,228,113},
  {149,228,110},{153,228,107},{157,227,104},{162,227,100},{166,227,97},{170,227,94},{174,226,90},{178,226,87},
  {182,225,84},{186,225,80},{190,225,77},{194,224,73},{198,224,70},{202,223,66},{206,223,63},{209,222,59},
  {213,221,55},{217,221,51},{220,220,47},{224,220,44},{228,219,39},{231,218,35},{235,218,31},{238,217,27},
  {241,216,22},{245,215,17},{248,215,11},{251,214,5},{255,213,1},{240,200,0},{222,185,0},{205,171,0},
  {188,156,0},{171,142,0},{155,128,0},{139,115,0},{123,102,0},{108,89,0},{93,76,0},{78,64,0},
  {64,52,0},{50,40,0},{37,29,0},{25,19,0},{13,9,0},{4,3,0},{0,0,0},{0,0,0},
};

void setup() {
  PFMath::buildSinLUT();

  if (!hopperCanvas) {
    hopperCanvas = PFMem::allocFloats(FRAME_W * FRAME_H);
  }

  for (int r = 0; r < R_COUNT; r++) {
    pile[r] = 0;
    zc[r] = nextRnd() < 0.5f ? 1 : 2;
    flux[r] = 0.0f;
  }

  constexpr float cx = 31.5f;
  constexpr float cy = 63.5f;
  for (int y = 0; y < FRAME_H; y++) {
    const float dy = (float)y - cy;
    for (int x = 0; x < FRAME_W; x++) {
      const float dx = (float)x - cx;
      anglePrecalc[y][x] = PFMath::fastAtan2(dy, dx);
    }
  }
}

void update(float dt, const InputFrame& input) {
  if (!hopperCanvas) return;

  PFParams::apply(input, 0, &feedRate, 1.0f, 122.0f, 2.521f);
  PFParams::apply(input, 1, &swirlTorque, 0.2f, 0.9f, 0.015f);
  PFParams::apply(input, 2, &funnelAngle, 0.0f, 20.0f, 0.417f);
  PFParams::apply(input, 3, &jamResistance, 0.8f, 0.99f, 0.004f);

  const float safeDt = fminf(dt > 0.0f ? dt : 0.016f, 0.1f);
  timeAcc += safeDt;
  if (timeAcc > 100.0f * TWO_PI) {
    timeAcc -= 100.0f * TWO_PI;
  }

  const int feed = (int)feedRate;

  for (int r = 0; r < R_COUNT; r++) {
    flux[r] = 0.0f;
  }
  pile[R_COUNT - 1] += feed;

  bool unstable = true;
  int guard = 0;
  while (unstable && guard++ < 300) {
    unstable = false;
    for (int r = R_COUNT - 1; r > 0; r--) {
      const int32_t slope = pile[r] - pile[r - 1];
      if (slope > zc[r]) {
        unstable = true;
        pile[r] -= 1;
        pile[r - 1] += 1;
        zc[r] = nextRnd() < 0.5f ? 1 : 2;
        flux[r] += 1.0f;
      }
    }
  }

  pile[0] = (int32_t)((float)pile[0] * 0.7f);

  const int totalPixels = FRAME_W * FRAME_H;
  for (int i = 0; i < totalPixels; i++) {
    hopperCanvas[i] *= jamResistance;
  }

  constexpr float cx = 31.5f;
  constexpr float cy = 63.5f;
  const float phase = timeAcc * swirlTorque * 4.0f;
  const float angleScale = funnelAngle * 0.15f;

  for (int y = 0; y < FRAME_H; y++) {
    const int row = y * FRAME_W;
    const float dy = (float)y - cy;
    const float funnelWidth = fmaxf(4.0f, fabsf(dy) * angleScale + 6.0f);
    const float invFunnelWidth = 1.0f / funnelWidth;

    for (int x = 0; x < FRAME_W; x++) {
      const float dx = (float)x - cx;
      const float distFromCenter = fabsf(dx);

      if (distFromCenter < funnelWidth) {
        int normR = (int)((distFromCenter * invFunnelWidth) * (float)R_COUNT);
        if (normR >= R_COUNT) normR = R_COUNT - 1;

        const float theta = anglePrecalc[y][x] + phase + ((float)normR * 0.2f);
        const float spiralRib = 0.5f + 0.5f * PFMath::fastSin(theta * 4.0f);
        const float toppleEnergy = flux[normR];

        const float grain = toppleEnergy * 1.5f * spiralRib + (pile[normR] > 3 ? 0.25f : 0.05f);
        if (grain > hopperCanvas[row + x]) {
          hopperCanvas[row + x] = grain;
        }
      }
    }
  }

  float top = 0.05f;
  for (int i = 0; i < totalPixels; i += 16) {
    const float val = hopperCanvas[i];
    if (val > top && !isnan(val) && !isinf(val)) {
      top = val;
    }
  }
  peak = peak * 0.94f + top * 0.06f;
}

void draw() {
  PFCanvas::setFrame(FRAME_W, FRAME_H);

  if (!hopperCanvas) {
    PFCanvas::present();
    return;
  }

  const float invNorm = 1.0f / fmaxf(0.001f, peak);

  for (int y = 0; y < FRAME_H; y++) {
    const int row = y * FRAME_W;
    for (int x = 0; x < FRAME_W; x++) {
      float v = hopperCanvas[row + x] * invNorm;
      if (isnan(v) || isinf(v)) v = 0.0f;
      v = fmaxf(0.0f, fminf(1.0f, v));

      // Tonal compression
      v = v * v * (3.0f - 2.0f * v);

      const int li = (int)(v * 255.0f + 0.5f);
      const int clampedLi = li < 0 ? 0 : (li > 255 ? 255 : li);
      PFCanvas::setPixel(x, y, RAMP_LUT[clampedLi][0], RAMP_LUT[clampedLi][1], RAMP_LUT[clampedLi][2]);
    }
  }

  PFCanvas::present();
}

} // namespace SandglassHopper