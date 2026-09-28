#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_params.h"
#include "src/core_math.h"

namespace ChladniPlasma {

const char* NAME = "Chladni Plasma";
const char* const KNOB_LABELS[4] = {"Nonlin", "Harmonic", "ModeRatio", "Speed"};
constexpr bool ABSOLUTE_READY = true;

constexpr int FRAME_W = 64;
constexpr int FRAME_H = 128;

static float k_nonlin = 1.98f;
static float k_harmonic = 1.789f;
static float k_modeRatio = 1.634f;
static float k_speed = 1.485f;

static float t_accum = 0.0f;
static float simAcc = 0.0f;
static float ampEma = 0.5f;
static uint32_t seed = 391824;

static float xC[FRAME_W];
static float xP1[FRAME_W];
static float xP2[FRAME_W];
static float xN[FRAME_W];
static float fx[FRAME_W];
static float rMetric[FRAME_W];

static const uint8_t RAMP_LUT[256][3] = {
  {255,255,255},{254,254,254},{252,252,252},{251,251,251},{250,250,250},{248,248,248},{247,247,247},{246,246,246},
  {244,244,244},{243,243,243},{242,242,242},{241,241,241},{239,239,239},{238,238,238},{237,237,237},{235,235,235},
  {234,234,234},{233,233,233},{231,231,231},{230,230,230},{229,229,229},{228,228,228},{226,226,226},{225,225,225},
  {224,224,224},{222,222,222},{221,221,221},{220,220,220},{219,219,219},{217,217,217},{216,216,216},{215,215,215},
  {213,213,213},{212,212,212},{211,211,211},{210,210,210},{208,208,208},{207,207,207},{206,206,206},{205,205,205},
  {203,203,203},{202,202,202},{201,201,201},{200,200,200},{198,198,198},{197,197,197},{196,196,196},{195,195,195},
  {193,193,193},{192,192,192},{191,191,191},{190,190,190},{188,188,188},{187,187,187},{186,186,186},{185,185,185},
  {183,183,183},{182,182,182},{181,181,181},{180,180,180},{178,178,178},{177,177,177},{176,176,176},{175,175,175},
  {173,173,173},{172,172,172},{171,171,171},{170,170,170},{169,169,169},{167,167,167},{166,166,166},{165,165,165},
  {164,164,164},{162,162,162},{161,161,161},{160,160,160},{159,159,159},{158,158,158},{156,156,156},{155,155,155},
  {154,154,154},{153,153,153},{152,152,152},{150,150,150},{149,149,149},{148,148,148},{147,147,147},{146,146,146},
  {144,144,144},{143,143,143},{142,142,142},{141,141,141},{140,140,140},{139,139,139},{137,137,137},{136,136,136},
  {135,135,135},{134,134,134},{133,133,133},{132,132,132},{130,130,130},{129,129,129},{128,128,128},{127,127,127},
  {126,126,126},{125,125,125},{123,123,123},{122,122,122},{121,121,121},{120,120,120},{119,119,119},{118,118,118},
  {117,117,117},{115,115,115},{114,114,114},{113,113,113},{112,112,112},{111,111,111},{110,110,110},{109,109,109},
  {107,107,107},{106,106,106},{105,105,105},{104,104,104},{103,103,103},{102,102,102},{101,101,101},{100,100,100},
  {99,99,99},{97,97,97},{96,96,96},{95,95,95},{94,94,94},{93,93,93},{92,92,92},{91,91,91},
  {90,90,90},{89,89,89},{88,88,88},{86,86,86},{85,85,85},{84,84,84},{83,83,83},{82,82,82},
  {81,81,81},{80,80,80},{79,79,79},{78,78,78},{77,77,77},{76,76,76},{75,75,75},{74,74,74},
  {73,73,73},{72,72,72},{71,71,71},{69,69,69},{68,68,68},{67,67,67},{66,66,66},{65,65,65},
  {64,64,64},{63,63,63},{62,62,62},{61,61,61},{60,60,60},{59,59,59},{58,58,58},{57,57,57},
  {56,56,56},{55,55,55},{54,54,54},{53,53,53},{52,52,52},{51,51,51},{50,50,50},{49,49,49},
  {48,48,48},{47,47,47},{46,46,46},{45,45,45},{44,44,44},{43,43,43},{42,42,42},{41,41,41},
  {40,40,40},{39,39,39},{38,38,38},{38,38,38},{37,37,37},{36,36,36},{35,35,35},{34,34,34},
  {33,33,33},{32,32,32},{31,31,31},{30,30,30},{29,29,29},{28,28,28},{27,27,27},{26,26,26},
  {26,26,26},{25,25,25},{24,24,24},{23,23,23},{22,22,22},{21,21,21},{20,20,20},{19,19,19},
  {18,18,18},{18,18,18},{17,17,17},{16,16,16},{15,15,15},{14,14,14},{13,13,13},{13,13,13},
  {12,12,12},{11,11,11},{10,10,10},{9,9,9},{9,9,9},{8,8,8},{7,7,7},{7,7,7},
  {6,6,6},{5,5,5},{5,5,5},{4,4,4},{4,4,4},{3,3,3},{3,3,3},{3,3,3},
  {2,2,2},{2,2,2},{2,2,2},{2,2,2},{1,1,1},{1,1,1},{1,1,1},{1,1,1},
  {1,1,1},{1,1,1},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
};

static inline float rng() {
  seed = seed * 1664525u + 1013904223u;
  return (float)seed * (1.0f / 4294967296.0f);
}

static void reseed() {
  for (int i = 0; i < FRAME_W; i++) {
    float r = (rng() - 0.5f) * 1.8f;
    xC[i] = r;
    xP1[i] = 1.0f - 1.7f * r * r;
    xP2[i] = 1.0f - 1.7f * xP1[i] * xP1[i];
  }
}

static void stepCML(float a, float eps) {
  for (int i = 0; i < FRAME_W; i++) {
    float v = xC[i];
    if (!isfinite(v) || fabsf(v) > 2.2f) {
      reseed();
      return;
    }
    fx[i] = 1.0f - a * v * v;
  }

  float halfEps = eps * 0.5f;
  float centerWeight = 1.0f - eps;
  for (int i = 0; i < FRAME_W; i++) {
    float left = (i == 0) ? fx[FRAME_W - 1] : fx[i - 1];
    float right = (i == FRAME_W - 1) ? fx[0] : fx[i + 1];
    xN[i] = centerWeight * fx[i] + halfEps * (left + right);
  }

  for (int i = 0; i < FRAME_W; i++) {
    rMetric[i] = fabsf(xN[i] - xP1[i]);
  }

  for (int i = 0; i < FRAME_W; i++) {
    xP2[i] = xP1[i];
    xP1[i] = xC[i];
    xC[i] = xN[i];
  }
}

void setup() {
  PFMath::buildSinLUT();
  reseed();
  for (int s = 0; s < 180; s++) {
    stepCML(1.72f, 0.28f);
  }
}

void update(float dt, const InputFrame& input) {
  PFParams::apply(input, 0, &k_nonlin, 1.45f, 1.98f, 0.011f);
  PFParams::apply(input, 1, &k_harmonic, 1.0f, 3.0f, 0.042f);
  PFParams::apply(input, 2, &k_modeRatio, 1.0f, 2.8f, 0.038f);
  PFParams::apply(input, 3, &k_speed, 0.2f, 4.0f, 0.079f);

  float safeDt = (dt > 0.1f) ? 0.1f : ((dt < 0.001f) ? 0.016f : dt);

  constexpr float TIME_WRAP = 200.0f * PI;
  t_accum += safeDt * k_speed;
  if (t_accum >= TIME_WRAP) {
    t_accum -= TIME_WRAP;
  }

  float dynCoupling = 0.28f + 0.08f * PFMath::fastSin(t_accum * 0.43f);

  simAcc += safeDt * 32.0f * k_speed;
  int maxSteps = 5;
  int steps = 0;
  while (simAcc >= 1.0f && steps < maxSteps) {
    stepCML(k_nonlin, dynCoupling);
    simAcc -= 1.0f;
    steps++;
  }
  if (simAcc > 1.0f) simAcc = 0.0f;
}

void draw() {
  PFCanvas::setFrame(FRAME_W, FRAME_H);

  float maxV = 0.001f;
  for (int i = 0; i < FRAME_W; i += 2) {
    if (rMetric[i] > maxV) maxV = rMetric[i];
  }
  ampEma = ampEma * 0.92f + maxV * 0.08f;
  float norm = 1.0f / fmaxf(ampEma, 0.04f);

  float rVal[FRAME_W];
  for (int x = 0; x < FRAME_W; x++) {
    rVal[x] = rMetric[x] * norm;
  }

  float tPhase = t_accum * 0.9f;
  float k1 = k_harmonic * PI;
  float k2 = (k_harmonic * k_modeRatio) * PI;
  constexpr float frac = 0.15f;

  for (int y = 0; y < FRAME_H; y++) {
    float ny = ((float)y / (float)FRAME_H) * 2.0f - 1.0f;
    int yIdx = y % FRAME_W;
    float localR = rMetric[yIdx] * norm;

    float cos_k2_ny = PFMath::fastCos(k2 * ny - tPhase);
    float sin_k1_ny = PFMath::fastSin(k1 * ny + tPhase * 0.6f);

    for (int x = 0; x < FRAME_W; x++) {
      float nx = ((float)x / (float)FRAME_W) * 2.0f - 1.0f;
      float rV = rVal[x];

      float phaseDistort = (rV - localR) * (frac * 2.5f);

      float w1 = PFMath::fastSin(k1 * nx + phaseDistort + tPhase) * cos_k2_ny;
      float w2 = PFMath::fastCos(k2 * nx - phaseDistort) * sin_k1_ny;
      float cymaticField = w1 - w2;

      float nodalLine = 1.0f - fminf(1.0f, fabsf(cymaticField));
      float defectGleam = (rV * rV) * (frac * 0.6f);

      float v = nodalLine + defectGleam;
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

} // namespace ChladniPlasma