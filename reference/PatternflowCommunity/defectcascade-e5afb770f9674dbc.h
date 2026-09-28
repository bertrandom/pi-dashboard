#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_math.h"
#include "src/core_mem.h"

namespace DefectCascade {

constexpr int FRAME_W = 64;
constexpr int FRAME_H = 128;

const char* NAME = "DefectCascade";
const char* const KNOB_LABELS[4] = {"DefectRate", "FanSpread", "ShockAngle", "DensityFilter"};

// Knob parameters and limits
static float knobDefectRate = 0.914f;
static float knobFanSpread = 2.61f;
static float knobShockAngle = 0.653f;
static float knobDensityFilter = 0.5f;

constexpr float DEFECT_MIN = 0.0f, DEFECT_MAX = 1.0f, DEFECT_STEP = 0.021f;
constexpr float FAN_MIN = 0.2f, FAN_MAX = 5.0f, FAN_STEP = 0.1f;
constexpr float SHOCK_MIN = 0.0f, SHOCK_MAX = 2.5f, SHOCK_STEP = 0.052f;
constexpr float FILT_MIN = 0.1f, FILT_MAX = 1.0f, FILT_STEP = 0.019f;

// Simulation state
static uint32_t rngSeed = 5543217;
static float simTime = 0.0f;

static float occupancy[FRAME_W];
static float defects[FRAME_W];

// Framebuffer-sized buffer in PSRAM
static float* history = nullptr;

// Pre-baked Color Ramp LUT (256 entries)
static const uint8_t RAMP_LUT[256][3] = {
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{1,1,1},
  {1,1,1},{1,1,1},{1,1,1},{1,1,1},{1,1,1},{2,2,2},{2,2,2},{2,2,2},
  {3,3,3},{3,3,3},{3,3,3},{4,4,4},{4,4,4},{4,4,4},{5,5,5},{5,5,5},
  {6,6,6},{7,7,7},{7,7,7},{8,8,8},{8,8,8},{9,9,9},{10,10,10},{11,11,11},
  {12,12,12},{12,12,12},{13,13,13},{14,14,14},{15,15,15},{16,16,16},{16,16,16},{17,17,17},
  {18,18,18},{19,19,19},{20,20,20},{21,21,21},{21,21,21},{22,22,22},{23,23,23},{24,24,24},
  {25,25,25},{26,26,26},{27,27,27},{28,28,28},{28,28,28},{29,29,29},{30,30,30},{31,31,31},
  {32,32,32},{33,33,33},{34,34,34},{35,35,35},{36,36,36},{37,37,37},{37,37,37},{38,38,38},
  {39,39,39},{40,40,40},{41,41,41},{42,42,42},{43,43,43},{44,44,44},{45,45,45},{46,46,46},
  {47,47,47},{48,48,48},{49,49,49},{50,50,50},{51,51,51},{52,52,52},{53,53,53},{54,54,54},
  {54,54,54},{55,55,55},{56,56,56},{57,57,57},{58,58,58},{59,59,59},{60,60,60},{61,61,61},
  {62,62,62},{63,63,63},{64,64,64},{65,65,65},{66,66,66},{67,67,67},{68,68,68},{69,69,69},
  {70,70,70},{71,71,71},{72,72,72},{73,73,73},{74,74,74},{76,76,76},{77,77,77},{78,78,78},
  {79,79,79},{80,80,80},{81,81,81},{82,82,82},{83,83,83},{84,84,84},{85,85,85},{86,86,86},
  {87,87,87},{88,88,88},{89,89,89},{90,90,90},{91,91,91},{92,92,92},{93,93,93},{94,94,94},
  {95,95,95},{96,96,96},{98,98,98},{99,99,99},{100,100,100},{101,101,101},{102,102,102},{103,103,103},
  {104,104,104},{105,105,105},{106,106,106},{107,107,107},{108,108,108},{109,109,109},{111,111,111},{112,112,112},
  {113,113,113},{114,114,114},{115,115,115},{116,116,116},{117,117,117},{118,118,118},{119,119,119},{121,121,121},
  {122,122,122},{123,123,123},{124,124,124},{125,125,125},{126,126,126},{127,127,127},{128,128,128},{129,129,129},
  {131,131,131},{132,132,132},{133,133,133},{134,134,134},{135,135,135},{136,136,136},{137,137,137},{139,139,139},
  {140,140,140},{141,141,141},{142,142,142},{143,143,143},{144,144,144},{145,145,145},{147,147,147},{148,148,148},
  {149,149,149},{150,150,150},{151,151,151},{152,152,152},{154,154,154},{155,155,155},{156,156,156},{157,157,157},
  {158,158,158},{159,159,159},{161,161,161},{162,162,162},{163,163,163},{164,164,164},{165,165,165},{166,166,166},
  {168,168,168},{169,169,169},{170,170,170},{171,171,171},{172,172,172},{174,174,174},{175,175,175},{176,176,176},
  {177,177,177},{178,178,178},{180,180,180},{181,181,181},{182,182,182},{183,183,183},{184,184,184},{186,186,186},
  {187,187,187},{188,188,188},{189,189,189},{190,190,190},{192,192,192},{193,193,193},{194,194,194},{195,195,195},
  {196,196,196},{198,198,198},{199,199,199},{200,200,200},{201,201,201},{203,203,203},{204,204,204},{205,205,205},
  {206,206,206},{207,207,207},{209,209,209},{210,210,210},{211,211,211},{212,212,212},{214,214,214},{215,215,215},
  {216,216,216},{217,217,217},{219,219,219},{220,220,220},{221,221,221},{222,222,222},{224,224,224},{225,225,225},
  {226,226,226},{227,227,227},{229,229,229},{230,230,230},{231,231,231},{232,232,232},{234,234,234},{235,235,235},
  {236,236,236},{237,237,237},{239,239,239},{240,240,240},{241,241,241},{242,242,242},{244,244,244},{245,245,245},
};

static inline float nextRand() {
  rngSeed = (rngSeed * 1664525u + 1013904223u);
  return (float)rngSeed * (1.0f / 4294967296.0f);
}

static void initGridState() {
  for (int x = 0; x < FRAME_W; x++) {
    occupancy[x] = (x % 3 == 0) ? 1.0f : 0.0f;
    float fx = (float)x;
    defects[x] = 0.5f + 0.5f * PFMath::fastSin(fx * 0.45f) * PFMath::fastCos(fx * 1.15f);
  }

  for (int y = 0; y < FRAME_H; y++) {
    float fy = (float)y;
    int rowIdx = y * FRAME_W;
    for (int x = 0; x < FRAME_W; x++) {
      float fx = (float)x;
      history[rowIdx + x] = 0.5f + 0.4f * PFMath::fastSin(fy * 0.15f - fx * 0.08f);
    }
  }
}

void setup() {
  PFMath::buildSinLUT();

  if (!history) {
    history = PFMem::allocFloats(FRAME_W * FRAME_H);
  }

  if (!history) return;

  simTime = 0.0f;
  rngSeed = 5543217;
  initGridState();
}

void update(float dt, const InputFrame& input) {
  if (!history) return;

  float safeDt = dt;
  if (safeDt < 0.001f) safeDt = 0.001f;
  if (safeDt > 0.05f)  safeDt = 0.05f;

  simTime += safeDt;
  // Wrap time accumulator at common period for multipliers (1.37, 0.91, 0.7, 0.25)
  constexpr float TIME_PERIOD = 200.0f * TWO_PI;
  if (simTime >= TIME_PERIOD) {
    simTime -= TIME_PERIOD;
  }

  // Encoder updates
  knobDefectRate += (float)input.knobDeltas[0] * DEFECT_STEP;
  if (knobDefectRate < DEFECT_MIN) knobDefectRate = DEFECT_MIN;
  if (knobDefectRate > DEFECT_MAX) knobDefectRate = DEFECT_MAX;

  knobFanSpread += (float)input.knobDeltas[1] * FAN_STEP;
  if (knobFanSpread < FAN_MIN) knobFanSpread = FAN_MIN;
  if (knobFanSpread > FAN_MAX) knobFanSpread = FAN_MAX;

  knobShockAngle += (float)input.knobDeltas[2] * SHOCK_STEP;
  if (knobShockAngle < SHOCK_MIN) knobShockAngle = SHOCK_MIN;
  if (knobShockAngle > SHOCK_MAX) knobShockAngle = SHOCK_MAX;

  knobDensityFilter += (float)input.knobDeltas[3] * FILT_STEP;
  if (knobDensityFilter < FILT_MIN) knobDensityFilter = FILT_MIN;
  if (knobDensityFilter > FILT_MAX) knobDensityFilter = FILT_MAX;

  if (input.btnPressed[0]) {
    for (int x = 0; x < FRAME_W; x++) {
      defects[x] = nextRand();
    }
  }

  float alphaTime = 0.5f + 0.42f * PFMath::fastSin(simTime * 1.37f);
  float betaTime = 0.5f + 0.42f * PFMath::fastCos(simTime * 0.91f);

  constexpr int iters = 240;
  for (int it = 0; it < iters; it++) {
    float r = nextRand();
    if (r < 0.1f) {
      if (occupancy[0] == 0.0f && nextRand() < alphaTime) {
        occupancy[0] = 1.0f;
      }
    } else if (r < 0.2f) {
      if (occupancy[FRAME_W - 1] == 1.0f && nextRand() < betaTime) {
        occupancy[FRAME_W - 1] = 0.0f;
      }
    } else {
      int idx = (int)(nextRand() * (float)(FRAME_W - 1));
      if (idx < 0) idx = 0;
      if (idx >= FRAME_W - 1) idx = FRAME_W - 2;

      float localHopRate = 1.0f - knobDefectRate * (1.0f - defects[idx]);
      if (occupancy[idx] == 1.0f && occupancy[idx + 1] == 0.0f) {
        if (nextRand() < localHopRate) {
          occupancy[idx] = 0.0f;
          occupancy[idx + 1] = 1.0f;
        }
      }
    }
  }

  // Downward cascade shift with rarefaction angular fan displacement
  float phaseOffset = simTime * 0.7f;
  for (int y = FRAME_H - 1; y > 0; y--) {
    int rowDest = y * FRAME_W;
    int rowSrc = (y - 1) * FRAME_W;
    int shift = (int)floorf(knobShockAngle * PFMath::fastSin((float)y * 0.08f + phaseOffset));

    for (int x = 0; x < FRAME_W; x++) {
      int srcX = (x - shift) % FRAME_W;
      if (srcX < 0) srcX += FRAME_W;
      history[rowDest + x] = history[rowSrc + srcX];
    }
  }

  // Coarse-grain top boundary and feed y = 0
  int radius = (int)floorf(knobFanSpread * 1.5f) + 1;
  for (int x = 0; x < FRAME_W; x++) {
    float acc = 0.0f;
    float wSum = 0.0f;
    for (int dx = -radius; dx <= radius; dx++) {
      int sx = x + dx;
      if (sx < 0) sx = 0;
      if (sx > FRAME_W - 1) sx = FRAME_W - 1;
      float w = 1.0f / (1.0f + (float)abs(dx));
      acc += occupancy[sx] * w;
      wSum += w;
    }
    history[x] = (wSum > 0.0001f) ? (acc / wSum) : 0.0f;
  }

  // Check numerical stability
  if (!isfinite(history[0])) {
    initGridState();
  }
}

void draw() {
  PFCanvas::setFrame(FRAME_W, FRAME_H);

  if (!history) {
    PFCanvas::present();
    return;
  }

  float filt = knobDensityFilter;
  float oneMinusFilt = 1.0f - filt;
  float drift = 0.06f * PFMath::fastCos(simTime * 0.25f);

  for (int y = 0; y < FRAME_H; y++) {
    int row = y * FRAME_W;
    int pU = (y > 0) ? (y - 1) : 0;
    int pD = (y < FRAME_H - 1) ? (y + 1) : (FRAME_H - 1);
    int rowU = pU * FRAME_W;
    int rowD = pD * FRAME_W;

    for (int x = 0; x < FRAME_W; x++) {
      float val = history[row + x];

      int pL = (x > 0) ? (x - 1) : (FRAME_W - 1);
      int pR = (x < FRAME_W - 1) ? (x + 1) : 0;

      float gradX = fabsf(history[row + pR] - history[row + pL]);
      float gradY = fabsf(history[rowD + x] - history[rowU + x]);
      float edge = (gradX + gradY) * 2.2f;

      float composite = oneMinusFilt * val + filt * edge + drift;

      float v = composite;
      if (v < 0.0f) v = 0.0f;
      if (v > 1.0f) v = 1.0f;

      // S-curve smoothstep compression
      v = v * v * (3.0f - 2.0f * v);

      int li = (int)(v * 255.0f + 0.5f);
      if (li < 0)   li = 0;
      if (li > 255) li = 255;

      PFCanvas::setPixel(x, y, RAMP_LUT[li][0], RAMP_LUT[li][1], RAMP_LUT[li][2]);
    }
  }

  PFCanvas::present();
}

} // namespace DefectCascade