#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_params.h"
#include "src/core_math.h"
#include "src/core_mem.h"

namespace PhononBreatherPattern {

const char* NAME = "Phonon Breather";
const char* const KNOB_LABELS[4] = {"BreathingFreq", "LatticeDrift", "ResonanceHarmo", "CavityEcho"};
constexpr bool ABSOLUTE_READY = true;

constexpr int FRAME_W = 64;
constexpr int FRAME_H = 128;
constexpr int TOTAL_PIXELS = FRAME_W * FRAME_H;

// Knobs
static float kBreathingFreq = 2.525f;
static float kLatticeDrift  = 1.681f;
static float kResonanceHarmo= 6.0f;
static float kCavityEcho    = 0.98f;

// State buffers allocated via PFMem
static float* psi = nullptr;
static float* psiVel = nullptr;
static float* echo = nullptr;

static float simTime = 0.0f;
static float maxNorm = 1.0f;

// Precomputed coordinate grids (-1.0 to 1.0)
static float normX[FRAME_W];
static float normY[FRAME_H];

// Fast hyperbolic cosine LUT for range [0, 8.0]
constexpr int COSH_LUT_SIZE = 512;
constexpr float COSH_LUT_MAX = 8.0f;
constexpr float COSH_LUT_SCALE = (COSH_LUT_SIZE - 1) / COSH_LUT_MAX;
static float coshLUT[COSH_LUT_SIZE];

static inline float fastCosh(float x) {
  float ax = fabsf(x);
  if (ax >= COSH_LUT_MAX) {
    return 1490.479f; // cosh(8.0)
  }
  float fi = ax * COSH_LUT_SCALE;
  int i = PFMath::ifloor(fi);
  float frac = fi - (float)i;
  return coshLUT[i] + frac * (coshLUT[i + 1] - coshLUT[i]);
}

// 256-entry baked color ramp
static const uint8_t RAMP_LUT[256][3] = {
  {0,0,1},{0,0,2},{0,0,3},{0,0,5},{0,0,8},{0,0,12},{0,0,15},{1,0,19},
  {1,0,23},{1,0,26},{2,0,30},{2,0,34},{2,0,39},{3,0,43},{4,1,47},{4,1,51},
  {5,1,55},{6,1,60},{7,1,64},{8,1,69},{10,1,73},{11,2,78},{12,2,82},{14,2,87},
  {15,2,92},{16,2,97},{18,3,101},{19,3,106},{21,3,111},{22,4,116},{23,4,121},{25,4,126},
  {26,5,131},{28,5,136},{29,6,141},{31,6,146},{32,7,151},{34,7,157},{35,8,162},{49,23,147},
  {70,29,118},{90,23,89},{95,19,76},{91,23,74},{87,26,73},{82,28,71},{79,31,70},{81,33,72},
  {82,35,73},{83,37,75},{85,39,76},{86,41,78},{87,43,79},{89,45,80},{90,47,82},{91,49,83},
  {93,51,85},{94,53,86},{95,55,88},{97,57,89},{98,59,90},{99,61,92},{101,63,93},{102,65,95},
  {103,67,96},{105,69,98},{106,71,99},{107,73,101},{108,75,102},{110,77,104},{111,79,105},{112,81,107},
  {113,83,108},{115,85,110},{116,87,111},{117,89,113},{119,91,114},{120,93,115},{121,95,117},{122,97,118},
  {124,99,120},{125,101,121},{126,103,123},{127,105,125},{129,107,126},{130,109,128},{131,111,129},{132,113,131},
  {134,116,132},{135,118,134},{136,120,135},{137,122,137},{138,124,138},{140,126,140},{141,128,141},{142,130,143},
  {143,132,144},{145,134,146},{146,136,147},{147,139,149},{148,141,151},{149,143,152},{151,145,154},{152,147,155},
  {153,149,157},{153,150,157},{146,143,149},{139,137,142},{133,131,135},{126,124,128},{120,118,122},{113,112,115},
  {107,106,108},{101,100,101},{95,94,95},{89,88,88},{83,82,82},{77,76,76},{71,70,69},{65,65,63},
  {59,59,57},{53,54,51},{48,48,45},{42,43,40},{37,38,34},{32,33,28},{27,28,23},{23,24,19},
  {23,24,20},{23,24,21},{24,24,22},{24,24,22},{24,23,23},{24,23,24},{24,23,25},{25,23,25},
  {25,23,26},{25,23,27},{25,23,28},{26,22,28},{26,22,29},{26,22,30},{26,22,31},{26,22,31},
  {27,22,32},{27,21,33},{27,21,33},{27,21,34},{27,21,35},{28,21,36},{28,20,36},{28,20,37},
  {28,20,38},{29,20,38},{29,19,39},{29,19,40},{29,19,41},{29,19,41},{30,18,42},{30,18,43},
  {36,24,48},{48,35,59},{60,47,71},{73,59,82},{87,72,94},{101,85,106},{115,99,118},{129,112,130},
  {129,112,129},{128,111,127},{127,109,125},{126,108,123},{125,107,122},{124,106,120},{123,105,118},{122,103,116},
  {121,102,114},{120,101,112},{119,100,110},{118,99,108},{117,97,107},{116,96,105},{115,95,103},{114,94,101},
  {113,93,99},{112,91,97},{111,90,95},{110,89,94},{109,88,92},{108,87,90},{107,86,88},{106,84,86},
  {105,83,85},{104,82,83},{103,81,81},{102,80,79},{101,79,77},{100,77,75},{99,76,74},{98,75,72},
  {97,74,70},{96,73,68},{96,72,67},{95,70,65},{94,69,63},{93,68,61},{92,67,59},{91,66,58},
  {90,65,56},{89,63,54},{88,62,52},{87,61,50},{86,60,49},{85,59,47},{84,58,45},{83,57,43},
  {82,55,42},{81,54,40},{80,53,38},{79,52,36},{78,51,34},{77,50,33},{76,49,31},{75,47,29},
  {74,46,27},{73,45,25},{72,44,23},{71,43,21},{70,42,19},{70,41,17},{69,40,16},{67,39,17},
  {66,38,18},{65,37,18},{64,37,19},{63,36,20},{62,35,20},{61,34,21},{60,34,21},{59,33,21},
  {58,32,22},{57,31,22},{56,31,23},{55,30,23},{54,29,23},{53,28,24},{52,28,24},{51,27,24},
  {50,26,25},{49,26,25},{48,25,25},{47,24,25},{46,23,25},{45,23,26},{44,22,26},{43,21,26},
};

static inline float sampleEchoField(float xNorm, float yNorm) {
  float x = (xNorm + 0.5f) * (float)FRAME_W - 0.5f;
  float y = (yNorm + 0.5f) * (float)FRAME_H - 0.5f;
  int x0 = PFMath::ifloor(x);
  int y0 = PFMath::ifloor(y);
  float fx = x - (float)x0;
  float fy = y - (float)y0;

  int cx0 = PFMath::clamp(x0, 0, FRAME_W - 1);
  int cx1 = PFMath::clamp(x0 + 1, 0, FRAME_W - 1);
  int cy0 = PFMath::clamp(y0, 0, FRAME_H - 1);
  int cy1 = PFMath::clamp(y0 + 1, 0, FRAME_H - 1);

  float v00 = echo[cy0 * FRAME_W + cx0];
  float v10 = echo[cy0 * FRAME_W + cx1];
  float v01 = echo[cy1 * FRAME_W + cx0];
  float v11 = echo[cy1 * FRAME_W + cx1];

  return (v00 * (1.0f - fx) + v10 * fx) * (1.0f - fy) +
         (v01 * (1.0f - fx) + v11 * fx) * fy;
}

void setup() {
  PFMath::buildSinLUT();

  if (!psi)    psi    = PFMem::allocFloats(TOTAL_PIXELS);
  if (!psiVel) psiVel = PFMem::allocFloats(TOTAL_PIXELS);
  if (!echo)   echo   = PFMem::allocFloats(TOTAL_PIXELS);

  for (int x = 0; x < FRAME_W; x++) {
    normX[x] = ((float)x / (float)FRAME_W) * 2.0f - 1.0f;
  }
  for (int y = 0; y < FRAME_H; y++) {
    normY[y] = ((float)y / (float)FRAME_H) * 2.0f - 1.0f;
  }

  for (int i = 0; i < COSH_LUT_SIZE; i++) {
    float v = (float)i / COSH_LUT_SCALE;
    coshLUT[i] = coshf(v);
  }

  simTime = 0.0f;
  maxNorm = 1.0f;
}

void update(float dt, const InputFrame& input) {
  if (!psi || !psiVel || !echo) return;

  PFParams::apply(input, 0, &kBreathingFreq, 0.2f, 4.5f, 0.09f);
  PFParams::apply(input, 1, &kLatticeDrift,  0.2f, 3.0f, 0.058f);
  PFParams::apply(input, 2, &kResonanceHarmo,1.0f, 6.0f, 0.104f);
  PFParams::apply(input, 3, &kCavityEcho,    0.35f, 0.98f, 0.013f);

  if (input.btnPressed[0] && !input.paramAbsoluteActive[0] && !input.knobAudioActive[0]) {
    memset(psi, 0, TOTAL_PIXELS * sizeof(float));
    memset(psiVel, 0, TOTAL_PIXELS * sizeof(float));
    memset(echo, 0, TOTAL_PIXELS * sizeof(float));
    maxNorm = 1.0f;
  }

  float safeDt = fminf(dt > 0.0f ? dt : 0.016f, 0.05f);
  simTime += safeDt;
  if (simTime > 1256.63706f) { // Wrap at ~400*PI
    simTime -= 1256.63706f;
  }

  float t = simTime * kLatticeDrift;
  float maxInt = 0.01f;

  float om = PFMath::clamp(kBreathingFreq * 0.25f, 0.1f, 0.95f);
  float eta = sqrtf(1.0f - om * om);
  float breathPhase = om * (t * 4.0f);
  float etaOverOm = eta / om;

  float sinBreath = etaOverOm * PFMath::fastSin(breathPhase);
  float sinBreathPi = etaOverOm * PFMath::fastSin(breathPhase + PI);

  float harmonicScale = kResonanceHarmo * 1.5f;
  float sinOffset = 0.35f * PFMath::fastSin(t * 0.8f);
  float yPhase = PFMath::jsMod(t * 0.3f, 2.0f);

  for (int y = 0; y < FRAME_H; y++) {
    float ny = normY[y];
    int yU = (y > 0) ? (y - 1) : (FRAME_H - 1);
    int yD = (y < FRAME_H - 1) ? (y + 1) : 0;
    int row = y * FRAME_W;
    int rowU = yU * FRAME_W;
    int rowD = yD * FRAME_W;

    float ky1 = (ny - yPhase + 0.5f) * harmonicScale;
    float coshKy1 = fastCosh(eta * ky1);

    for (int x = 0; x < FRAME_W; x++) {
      float nx = normX[x];
      int xL = (x > 0) ? (x - 1) : (FRAME_W - 1);
      int xR = (x < FRAME_W - 1) ? (x + 1) : 0;
      int idx = row + x;

      float p = psi[idx];
      float lap = psi[row + xL] + psi[row + xR] + psi[rowU + x] + psi[rowD + x] - 4.0f * p;

      float force = 0.38f * lap - PFMath::fastSin(p);
      float vel = (psiVel[idx] + safeDt * force) * 0.985f;
      float nextPsi = p + safeDt * vel;

      float kx1 = (nx + sinOffset) * harmonicScale;
      float breather1 = -4.0f * PFMath::fastAtan2(sinBreath, fastCosh(eta * kx1) * coshKy1);

      float kx2 = (nx - sinOffset) * harmonicScale;
      float breather2 = -4.0f * PFMath::fastAtan2(sinBreathPi, fastCosh(eta * kx2) * coshKy1);

      nextPsi += (breather1 + breather2) * 0.03f;
      if (!isfinite(nextPsi)) {
        nextPsi = 0.0f;
        vel = 0.0f;
      }

      psi[idx] = nextPsi;
      psiVel[idx] = vel;

      float gradX = (psi[row + xR] - psi[row + xL]) * 0.5f;
      float gradY = (psi[rowD + x] - psi[rowU + x]) * 0.5f;
      float polaronEnergy = (vel * vel) + (gradX * gradX + gradY * gradY) * 0.6f + (1.0f - PFMath::fastCos(nextPsi));

      float uCoord = nx * 0.48f + 0.015f * PFMath::fastSin(nextPsi * 3.0f);
      float vCoord = ny * 0.48f + 0.008f * PFMath::fastCos(nextPsi * 3.0f) + 0.006f;

      float prevEcho = sampleEchoField(uCoord, vCoord);
      float nextEcho = prevEcho * kCavityEcho + polaronEnergy * 0.38f;

      if (!isfinite(nextEcho)) nextEcho = 0.0f;
      echo[idx] = nextEcho;
      if (nextEcho > maxInt) maxInt = nextEcho;
    }
  }

  maxNorm += (maxInt - maxNorm) * 0.08f;
}

void draw() {
  PFCanvas::setFrame(FRAME_W, FRAME_H);

  if (!psi || !echo) {
    PFCanvas::present();
    return;
  }

  float norm = 1.0f / fmaxf(0.001f, maxNorm);

  for (int y = 0; y < FRAME_H; y++) {
    int row = y * FRAME_W;
    for (int x = 0; x < FRAME_W; x++) {
      int idx = row + x;
      float e = echo[idx] * norm;
      float p = psi[idx];

      float diamond = fabsf(PFMath::fastSin(p * 1.5f));
      float tonal = e * 0.72f + diamond * 0.4f;
      tonal = PFMath::clamp01(tonal);

      float v = tonal * tonal * (3.0f - 2.0f * tonal);
      v = PFMath::clamp01(v);

      int li = (int)(v * 255.0f + 0.5f);
      PFCanvas::setPixel(x, y, RAMP_LUT[li][0], RAMP_LUT[li][1], RAMP_LUT[li][2]);
    }
  }

  PFCanvas::present();
}

} // namespace PhononBreatherPattern