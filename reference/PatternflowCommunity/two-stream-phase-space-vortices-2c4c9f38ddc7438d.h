#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_params.h"
#include "src/core_math.h"
#include "src/core_color.h"
#include "src/core_mem.h"

namespace TwoStreamPhaseSpaceVortices {

const char* NAME = "Two-stream phase-space vortices";
const char* const KNOB_LABELS[4] = {"Aspect", "Speed", "Eccentricity", "Persistence"};
constexpr bool ABSOLUTE_READY = true;

constexpr int FRAME_W = 64;
constexpr int FRAME_H = 128;
constexpr int N_PARTICLES = 6500;

// Knob state defaults & ranges
static float aspectScale = 0.971f;
static float simSpeed = 2.421f;
static float coreEccentricity = 0.2f;
static float persistence = 0.954f;

// Pre-baked ramp LUT from spec
static const uint8_t RAMP_LUT[256][3] = {
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
  {0,0,0},{0,0,0},{0,0,0},{1,1,1},{1,1,1},{1,1,1},{1,1,1},{1,1,1},
  {2,2,2},{2,2,2},{3,3,3},{3,3,3},{4,4,4},{4,4,4},{5,5,5},{5,5,5},
  {6,6,6},{7,7,7},{8,8,8},{9,9,9},{10,10,10},{11,11,11},{12,12,12},{13,13,13},
  {14,14,14},{15,15,15},{16,16,16},{17,17,17},{18,18,18},{20,20,20},{21,21,21},{22,22,22},
  {23,23,23},{24,24,24},{25,25,25},{26,26,26},{28,28,28},{29,29,29},{30,30,30},{31,31,31},
  {32,32,32},{34,34,34},{35,35,35},{36,36,36},{37,37,37},{39,39,39},{40,40,40},{41,41,41},
  {42,42,42},{44,44,44},{45,45,45},{46,46,46},{47,47,47},{49,49,49},{50,50,50},{51,51,51},
  {53,53,53},{54,54,54},{55,55,55},{56,56,56},{58,58,58},{59,59,59},{60,60,60},{62,62,62},
  {63,63,63},{64,64,64},{66,66,66},{67,67,67},{69,69,69},{70,70,70},{71,71,71},{73,73,73},
  {74,74,74},{75,75,75},{77,77,77},{78,78,78},{80,80,80},{81,81,81},{82,82,82},{84,84,84},
  {87,87,87},{91,91,91},{95,95,95},{99,99,99},{103,103,103},{107,107,107},{111,111,111},{115,115,115},
  {119,119,119},{124,124,124},{128,128,128},{132,132,132},{136,136,136},{140,140,140},{145,145,145},{149,149,149},
  {153,153,153},{158,158,158},{162,162,162},{167,167,167},{171,171,171},{175,175,175},{180,180,180},{184,184,184},
  {189,189,189},{193,193,193},{198,198,198},{203,203,203},{207,207,207},{212,212,212},{216,216,216},{221,221,221},
  {226,226,226},{230,230,230},{235,235,235},{240,240,240},{244,244,244},{249,249,249},{254,254,254},{255,255,250},
  {254,255,243},{253,255,236},{253,255,229},{252,255,221},{252,255,213},{251,255,205},{251,255,196},{251,255,186},
  {250,255,175},{250,255,162},{250,255,148},{250,255,132},{250,255,111},{250,255,82},{251,255,6},{242,255,94},
  {235,255,117},{229,255,130},{223,255,139},{218,255,145},{212,255,151},{206,255,155},{200,255,159},{195,255,163},
  {188,255,166},{182,255,169},{176,255,173},{169,255,176},{162,255,179},{154,255,182},{146,255,185},{137,255,188},
  {128,255,192},{117,255,195},{105,255,199},{91,255,203},{78,254,207},{73,253,212},{69,252,216},{66,250,220},
  {64,249,224},{63,247,228},{63,245,231},{65,243,234},{67,242,237},{70,240,240},{73,238,243},{77,236,245},
  {81,234,247},{86,232,249},{91,229,250},{95,227,251},{100,225,252},{105,223,253},{109,221,254},{112,218,253},
  {109,211,245},{105,204,237},{101,197,229},{97,190,221},{94,183,213},{90,177,205},{86,170,198},{83,163,190},
  {79,157,182},{75,150,175},{72,144,167},{68,137,160},{65,131,152},{61,124,145},{58,118,138},{55,112,131},
  {51,106,124},{48,100,117},{45,94,110},{41,88,103},{38,82,96},{35,76,89},{32,70,83},{29,64,76},
  {26,59,70},{23,53,63},{20,48,57},{17,43,51},{14,37,45},{11,32,39},{9,27,33},{6,22,28},
  {4,18,22},{3,13,17},{2,9,12},{1,5,7},{1,3,4},{0,1,2},{0,0,1},{0,0,0},
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
};

// Gamma / transfer curve pre-baked LUT for tone mapping in draw()
// raw normalized 0..1 mapped through: val = clamp((raw^0.65 - 0.06) * 1.08 * 1.7, 0, 1), then smoothstep(val)
static uint8_t TONE_MAP_LUT[256];

// Simulation buffers
static float* phaseBuf = nullptr;
static float py[N_PARTICLES];
static float pv[N_PARTICLES];
static float rho[FRAME_H];
static float efield[FRAME_H];

static float runningMax = 1.0f;
static uint32_t rngState = 88223344;

constexpr float V0 = 1.25f;
constexpr float V_MAX = 4.8f;

static inline float rnd() {
  rngState = rngState * 1664525u + 1013904223u;
  return (float)rngState * (1.0f / 4294967296.0f);
}

static void initParticle(int i) {
  const bool isDown = (i & 1) == 0;
  const float dir = isDown ? 1.0f : -1.0f;
  const float u1 = fmaxf(1e-6f, rnd());
  const float u2 = rnd();
  const float gauss = sqrtf(-2.0f * logf(u1)) * PFMath::fastCos(TWO_PI * u2);

  const float yPos = rnd() * 128.0f;
  const float wave = PFMath::fastSin((yPos * (1.0f / 128.0f)) * 18.8495f) * 0.2f;

  py[i] = yPos;
  pv[i] = dir * V0 + wave * dir + gauss * 0.08f;
}

static void stepPicAspect(float simDt, float aspect, float ecc, float persist) {
  constexpr int w = FRAME_W;
  constexpr int h = FRAME_H;
  constexpr int len = w * h;

  for (int y = 0; y < h; y++) {
    rho[y] = 0.0f;
  }

  constexpr float qScale = 128.0f / (float)N_PARTICLES;
  for (int i = 0; i < N_PARTICLES; i++) {
    float y = py[i];
    if (!isfinite(y)) {
      initParticle(i);
      y = py[i];
    }
    const int y0 = (int)floorf(y);
    const float fy = y - (float)y0;
    int idx0 = y0 % h;
    if (idx0 < 0) idx0 += h;
    int idx1 = idx0 + 1;
    if (idx1 >= h) idx1 -= h;

    rho[idx0] += (1.0f - fy) * qScale;
    rho[idx1] += fy * qScale;
  }

  float sumRho = 0.0f;
  for (int y = 0; y < h; y++) {
    sumRho += rho[y];
  }
  const float meanRho = sumRho * (1.0f / (float)h);

  float accum = 0.0f;
  float eSum = 0.0f;
  const float eccScale = 1.7f * ecc;
  for (int y = 0; y < h; y++) {
    accum += (rho[y] - meanRho) * eccScale;
    efield[y] = accum;
    eSum += accum;
  }
  const float meanE = eSum * (1.0f / (float)h);
  for (int y = 0; y < h; y++) {
    efield[y] -= meanE;
  }

  for (int i = 0; i < len; i++) {
    phaseBuf[i] *= persist;
  }

  const float curVMax = V_MAX * fmaxf(0.2f, aspect);
  const float vToX = (float)(w - 1) / (2.0f * curVMax);
  const float maxVBound = curVMax * 3.0f;

  for (int i = 0; i < N_PARTICLES; i++) {
    if (rnd() < 0.0035f) {
      initParticle(i);
    }

    float y = py[i];
    float v = pv[i];

    const int y0 = (int)floorf(y);
    const float fy = y - (float)y0;
    int idx0 = y0 % h;
    if (idx0 < 0) idx0 += h;
    int idx1 = idx0 + 1;
    if (idx1 >= h) idx1 -= h;

    const float E = (1.0f - fy) * efield[idx0] + fy * efield[idx1];

    v -= E * simDt;
    y += v * simDt * 8.5f;
    
    // y = (y % h + h) % h
    y = fmodf(y, (float)h);
    if (y < 0.0f) y += (float)h;

    if (!isfinite(v) || fabsf(v) > maxVBound) {
      initParticle(i);
      y = py[i];
      v = pv[i];
    }

    py[i] = y;
    pv[i] = v;

    const float xExact = (v + curVMax) * vToX;
    const int xi = (int)floorf(xExact);
    const float fx = xExact - (float)xi;
    const int yi = (int)floorf(y);

    if (yi >= 0 && yi < h && xi >= 0 && xi < w - 1) {
      const int baseIdx = yi * w + xi;
      phaseBuf[baseIdx] += 0.45f * (1.0f - fx);
      phaseBuf[baseIdx + 1] += 0.45f * fx;
    }
  }
}

void setup() {
  PFMath::buildSinLUT();

  if (!phaseBuf) {
    phaseBuf = PFMem::allocFloats(FRAME_W * FRAME_H);
  }

  // Pre-calculate tone map table from raw 0..1 inputs mapped to 0..255 RAMP_LUT indices
  for (int i = 0; i < 256; i++) {
    const float raw = (float)i / 255.0f;
    float val = powf(raw, 0.65f);
    val = (val - 0.06f) * (1.08f * 1.7f);
    val = fminf(1.0f, fmaxf(0.0f, val));
    const float mapped = val * val * (3.0f - 2.0f * val);
    TONE_MAP_LUT[i] = (uint8_t)(fminf(1.0f, fmaxf(0.0f, mapped)) * 255.0f + 0.5f);
  }

  rngState = 88223344;
  for (int i = 0; i < N_PARTICLES; i++) {
    initParticle(i);
  }

  runningMax = 1.0f;

  if (phaseBuf) {
    for (int step = 0; step < 180; step++) {
      stepPicAspect(0.08f, 1.0f, 1.0f, 0.88f);
    }
  }
}

void update(float dt, const InputFrame& input) {
  if (!phaseBuf) return;

  PFParams::apply(input, 0, &aspectScale, 0.3f, 3.0f, 0.056f);
  PFParams::apply(input, 1, &simSpeed, 0.4f, 8.0f, 0.158f);
  PFParams::apply(input, 2, &coreEccentricity, 0.2f, 2.5f, 0.048f);
  PFParams::apply(input, 3, &persistence, 0.75f, 0.96f, 0.004f);

  if (input.btnPressed[0] && !input.paramAbsoluteActive[0] && !input.knobAudioActive[0]) {
    for (int i = 0; i < N_PARTICLES; i++) {
      initParticle(i);
    }
  }

  const float clampedDt = fminf(dt, 0.05f);
  constexpr int steps = 2;
  const float simDt = (clampedDt * simSpeed * 0.85f) / (float)steps;
  for (int s = 0; s < steps; s++) {
    stepPicAspect(simDt, aspectScale, coreEccentricity, persistence);
  }
}

void draw() {
  PFCanvas::setFrame(FRAME_W, FRAME_H);

  if (!phaseBuf) {
    PFCanvas::present();
    return;
  }

  constexpr int len = FRAME_W * FRAME_H;
  float frameMax = 0.01f;
  for (int i = 0; i < len; i++) {
    const float val = phaseBuf[i];
    if (val > frameMax && isfinite(val)) {
      frameMax = val;
    }
  }

  runningMax = runningMax * 0.92f + frameMax * 0.08f;
  const float invNorm = 1.0f / fmaxf(0.001f, runningMax);
  const float normScale = invNorm * 255.0f;

  for (int y = 0; y < FRAME_H; y++) {
    const int row = y * FRAME_W;
    for (int x = 0; x < FRAME_W; x++) {
      float raw = phaseBuf[row + x];
      if (!isfinite(raw) || raw <= 0.0f) {
        PFCanvas::setPixel(x, y, RAMP_LUT[0][0], RAMP_LUT[0][1], RAMP_LUT[0][2]);
        continue;
      }

      int rawIdx = (int)(raw * normScale + 0.5f);
      if (rawIdx > 255) rawIdx = 255;

      const uint8_t lutIdx = TONE_MAP_LUT[rawIdx];
      PFCanvas::setPixel(x, y, RAMP_LUT[lutIdx][0], RAMP_LUT[lutIdx][1], RAMP_LUT[lutIdx][2]);
    }
  }

  PFCanvas::present();
}

} // namespace TwoStreamPhaseSpaceVortices