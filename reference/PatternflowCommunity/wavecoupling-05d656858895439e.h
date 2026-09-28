#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_math.h"
#include "src/core_mem.h"

namespace WaveCoupling {

const char* NAME = "Wave Coupling";
const char* const KNOB_LABELS[4] = {"Coupling", "Speed", "Freq", "Glow"};

constexpr int FRAME_W = 64;
constexpr int FRAME_H = 128;

// Calibrated encoder steps per detent
constexpr float STEP_COUPLING  = 0.005f;
constexpr float STEP_SPEED     = 0.11f;
constexpr float STEP_FREQ      = 0.135f;
constexpr float STEP_GLOW      = 0.005f;

// Knob parameter ranges
constexpr float COUPLING_MIN  = 0.02f;
constexpr float COUPLING_MAX  = 0.25f;
constexpr float SPEED_MIN     = 0.2f;
constexpr float SPEED_MAX     = 5.5f;
constexpr float FREQ_MIN      = 1.5f;
constexpr float FREQ_MAX      = 8.0f;
constexpr float GLOW_MIN      = 0.75f;
constexpr float GLOW_MAX      = 0.98f;

// Knob state (initialized to current Pattern Lab values)
static float coupling     = 0.136f;
static float speed        = 3.112f;
static float freq         = 8.0f;
static float persistence  = 0.944f;

// Phase accumulators (individual to avoid discontinuity)
static float phaseInj1   = 0.0f;
static float phaseInj2   = 0.0f;
static float phaseThresh = 0.0f;

// Simulation state
static float maxVal = 0.001f;
static uint32_t seed = 2026;

// Per-pixel buffers (PSRAM-first)
static float* potential = nullptr;
static float* phase     = nullptr;
static float* fronts    = nullptr;
static float* renderBuf = nullptr;

// Color ramp LUT (verbatim from user ramp)
static const uint8_t RAMP_LUT[256][3] = {
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
  {0,0,0},{0,0,0},{0,1,0},{0,1,0},{0,1,0},{0,1,0},{1,2,0},{1,2,0},
  {1,3,1},{1,3,1},{1,4,1},{1,4,1},{1,5,1},{1,6,2},{1,7,2},{1,8,3},
  {0,9,3},{0,10,4},{0,11,5},{0,13,6},{0,14,7},{0,15,8},{0,16,10},{0,18,11},
  {0,19,13},{0,20,14},{0,21,16},{0,22,18},{0,24,19},{0,25,21},{0,26,23},{0,27,25},
  {0,29,26},{0,30,28},{0,31,30},{0,32,32},{0,34,34},{0,35,36},{0,36,38},{0,37,40},
  {0,39,42},{0,40,44},{0,41,46},{0,43,49},{0,44,51},{0,45,53},{0,46,55},{0,48,58},
  {0,49,60},{0,50,63},{0,51,66},{0,53,68},{0,54,71},{0,55,74},{0,56,77},{0,57,80},
  {0,58,83},{0,60,87},{1,61,90},{4,62,92},{8,63,95},{13,63,97},{17,64,100},{21,65,103},
  {24,66,105},{27,67,108},{31,68,110},{34,69,112},{37,70,115},{41,70,117},{44,71,120},{47,72,122},
  {50,73,124},{53,74,126},{57,74,128},{60,75,130},{63,76,133},{66,76,135},{70,77,136},{73,78,138},
  {76,78,140},{80,79,142},{83,80,144},{86,80,145},{90,81,147},{93,82,148},{97,82,150},{100,83,151},
  {103,83,152},{107,84,153},{110,84,155},{114,85,156},{117,86,156},{121,86,157},{124,87,158},{128,87,159},
  {131,88,159},{135,88,160},{138,89,160},{142,90,161},{145,90,161},{149,91,161},{153,91,161},{156,92,161},
  {160,92,161},{163,93,161},{167,94,160},{170,94,160},{174,95,160},{177,96,159},{181,96,158},{184,97,158},
  {187,98,157},{191,98,156},{194,99,155},{198,100,154},{201,101,153},{204,101,151},{207,102,150},{211,103,149},
  {214,104,147},{217,105,146},{220,106,144},{223,107,142},{226,108,140},{229,110,138},{232,111,136},{235,112,134},
  {238,113,132},{241,115,130},{243,116,128},{246,118,125},{248,119,123},{251,121,120},{253,122,117},{255,125,115},
  {255,128,114},{255,132,114},{255,135,113},{255,139,113},{255,142,113},{255,145,112},{255,149,112},{255,152,112},
  {255,155,113},{255,158,113},{255,161,113},{255,164,114},{255,167,114},{255,170,115},{255,173,116},{255,175,116},
  {255,178,117},{255,181,118},{255,184,119},{255,187,120},{255,189,121},{255,192,122},{255,195,123},{255,197,124},
  {255,200,125},{255,203,126},{255,205,127},{255,208,128},{255,211,128},{255,213,129},{255,216,130},{255,218,130},
  {255,221,130},{255,224,130},{255,226,130},{255,229,128},{255,232,126},{255,234,123},{255,237,118},{255,240,110},
  {255,244,97},{255,247,71},{254,251,0},{252,254,0},{243,255,63},{234,255,81},{225,255,91},{216,255,98},
  {207,255,103},{197,255,107},{187,255,111},{176,255,115},{164,255,119},{152,255,123},{138,255,127},{122,255,131},
  {103,255,135},{78,255,140},{37,255,144},{0,253,154},{0,250,163},{0,247,171},{0,244,178},{0,241,184},
  {0,238,189},{0,235,194},{0,233,198},{0,230,201},{0,227,205},{0,225,207},{0,222,210},{0,219,213},
  {0,216,215},{0,214,217},{0,211,219},{0,209,221},{0,206,223},{0,203,225},{0,201,226},{0,198,228},
  {0,195,230},{0,192,232},{0,190,234},{0,187,236},{0,184,238},{0,181,241},{0,178,243},{0,175,247},
  {0,171,250},{0,168,254},{27,164,255},{43,161,255},{55,157,255},{64,153,255},{72,149,255},{79,145,255},
  {85,141,255},{91,137,255},{97,133,255},{102,128,255},{107,123,255},{112,118,255},{117,113,255},{122,108,255},
  {127,102,255},{132,95,255},{137,88,255},{143,79,255},{148,69,255},{154,57,255},{160,40,255},{166,0,255},
};

// Local random number generator (same algorithm as JS)
static float localRand() {
  seed = (seed * 16807) % 2147483647;
  return (float)(seed - 1) / 2147483646.0f;
}

static void initState() {
  int N = FRAME_W * FRAME_H;
  for (int i = 0; i < N; i++) {
    potential[i] = 0.0f;
    phase[i]     = 0.0f;
    fronts[i]    = 0.0f;
    renderBuf[i] = 0.0f;
  }
  for (int y = 0; y < FRAME_H; y++) {
    for (int x = 0; x < FRAME_W; x++) {
      int idx = y * FRAME_W + x;
      potential[idx] = localRand() * 2.5f;
      phase[idx]     = localRand() * TWO_PI;
    }
  }
  maxVal = 0.001f;
  phaseInj1 = 0.0f;
  phaseInj2 = 0.0f;
  phaseThresh = 0.0f;
}

void setup() {
  PFMath::buildSinLUT();

  int N = FRAME_W * FRAME_H;
  if (!potential) potential = PFMem::allocFloats(N);
  if (!phase)     phase     = PFMem::allocFloats(N);
  if (!fronts)    fronts    = PFMem::allocFloats(N);
  if (!renderBuf) renderBuf = PFMem::allocFloats(N);

  if (potential && phase && fronts && renderBuf) {
    initState();
  }
}

void update(float dt, const InputFrame& input) {
  if (!potential || !phase || !fronts || !renderBuf) return;

  if (input.btnPressed[0]) {
    initState();
  }

  coupling    += input.knobDeltas[0] * STEP_COUPLING;
  speed       += input.knobDeltas[1] * STEP_SPEED;
  freq        += input.knobDeltas[2] * STEP_FREQ;
  persistence += input.knobDeltas[3] * STEP_GLOW;

  if (coupling < COUPLING_MIN) coupling = COUPLING_MIN;
  if (coupling > COUPLING_MAX) coupling = COUPLING_MAX;
  if (speed < SPEED_MIN) speed = SPEED_MIN;
  if (speed > SPEED_MAX) speed = SPEED_MAX;
  if (freq < FREQ_MIN) freq = FREQ_MIN;
  if (freq > FREQ_MAX) freq = FREQ_MAX;
  if (persistence < GLOW_MIN) persistence = GLOW_MIN;
  if (persistence > GLOW_MAX) persistence = GLOW_MAX;

  float clampedDt = fminf(dt, 0.1f);

  // Individual phase accumulators — wrap each at TWO_PI
  phaseInj1 += clampedDt * speed * 1.2f;
  if (phaseInj1 > TWO_PI) phaseInj1 -= TWO_PI;

  phaseInj2 += clampedDt * speed * 2.0f;
  if (phaseInj2 > TWO_PI) phaseInj2 -= TWO_PI;

  phaseThresh += clampedDt * speed * freq;
  while (phaseThresh > TWO_PI) phaseThresh -= TWO_PI;

  const int W = FRAME_W;
  const int H = FRAME_H;
  const int N = W * H;

  // Continuous sand injection: symmetric around mid-height
  float halfH = H * 0.5f;
  float halfW = W * 0.5f;
  float ampH  = H * 0.35f;
  float ampW  = W * 0.35f;

  for (int k = 0; k < 3; k++) {
    int sy = (int)(halfH + PFMath::fastSin(phaseInj1 + k * 2.0f) * ampH);
    int sx = (int)(halfW + PFMath::fastCos(phaseInj2 + k * 1.5f) * ampW);
    if (sy >= 0 && sy < H && sx >= 0 && sx < W) {
      int idx = sy * W + sx;
      potential[idx] += 1.8f * speed;
    }
  }

  // Coupled wave collapse
  for (int y = 1; y < H - 1; y++) {
    for (int x = 1; x < W - 1; x++) {
      int idx = y * W + x;
      float pot = potential[idx];

      if (!isfinite(pot)) {
        potential[idx] = 0.0f;
        continue;
      }

      float threshArg = phase[idx] + phaseThresh;
      if (threshArg > TWO_PI) threshArg -= TWO_PI;

      float thresh = 3.0f + PFMath::fastSin(threshArg) * 0.8f;

      if (pot >= thresh) {
        potential[idx] -= thresh * 0.7f;
        fronts[idx] = 1.0f;

        float pass = thresh * coupling;
        potential[idx - 1] += pass;
        potential[idx + 1] += pass;
        potential[idx - W] += pass * 0.95f;
        potential[idx + W] += pass * 1.05f;

        phase[idx] += 0.4f;
        if (phase[idx] > TWO_PI) phase[idx] -= TWO_PI;
      }
    }
  }

  // Trail persistence and front blending
  maxVal = 0.001f;
  for (int i = 0; i < N; i++) {
    fronts[i] *= persistence;
    renderBuf[i] = renderBuf[i] * 0.15f + fronts[i] * 0.85f;
    if (renderBuf[i] > maxVal) maxVal = renderBuf[i];
  }
}

void draw() {
  if (!renderBuf) {
    PFCanvas::present();
    return;
  }

  PFCanvas::setFrame(FRAME_W, FRAME_H);

  float invMax = 1.0f / (maxVal > 0.001f ? maxVal : 0.001f);

  for (int y = 0; y < FRAME_H; y++) {
    for (int x = 0; x < FRAME_W; x++) {
      int idx = y * FRAME_W + x;
      float norm = renderBuf[idx] * invMax;

      float v = fminf(1.0f, fmaxf(0.0f, norm));
      float v2 = v * v;
      float v3 = v2 * v;
      v = v3 * (v * (v * 6.0f - 15.0f) + 10.0f);

      int li = (int)(v * 255.0f + 0.5f);
      PFCanvas::setPixel(x, y, RAMP_LUT[li][0], RAMP_LUT[li][1], RAMP_LUT[li][2]);
    }
  }

  PFCanvas::present();
}

} // namespace WaveCoupling