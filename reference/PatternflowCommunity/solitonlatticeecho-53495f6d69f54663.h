#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_params.h"
#include "src/core_math.h"
#include "src/core_mem.h"

namespace SolitonLatticeEcho {

const char* NAME = "Soliton Echo";
const char* const KNOB_LABELS[4] = {"Energy", "Pace", "Count", "Decay"};
constexpr bool ABSOLUTE_READY = true;

constexpr int FRAME_W = 64;
constexpr int FRAME_H = 128;
constexpr int TOTAL_PIXELS = FRAME_W * FRAME_H;

// State and parameters
static float kinkEnergy   = 100.0f; // min: 0.3, max: 100.0
static float relPace      = 8.26f;  // min: 0.2, max: 12.0
static float solitonCount = 5.0f;   // min: 1.0, max: 5.0
static float echoDecay    = 0.98f;  // min: 0.4, max: 0.98

static float maxNorm = 1.0f;
static float angle13 = 0.0f;
static float kyDrift = 0.0f;

// Framebuffer-scale state buffers (allocated in PSRAM)
static float* phi    = nullptr;
static float* phiVel = nullptr;
static float* echo   = nullptr;

// Precomputed coordinate and neighbor LUTs
static float nxLUT[FRAME_W];
static float nyLUT[FRAME_H];
static int   xLLUT[FRAME_W];
static int   xRLUT[FRAME_W];
static int   yULUT[FRAME_H];
static int   yDLUT[FRAME_H];

// 1D Kink function LUT: 4.0 * atan(exp(z))
constexpr int   KINK_LUT_SIZE = 1024;
constexpr float KINK_Z_MIN    = -16.0f;
constexpr float KINK_Z_MAX    = 16.0f;
constexpr float KINK_Z_SPAN   = KINK_Z_MAX - KINK_Z_MIN;
static float    kinkLUT[KINK_LUT_SIZE];

// Baked color ramp LUT
static const uint8_t RAMP_LUT[256][3] = {
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{1,1,1},{2,2,2},{3,3,3},
  {4,4,4},{5,5,5},{7,7,7},{10,10,10},{13,13,13},{16,16,16},{18,18,18},{21,21,21},
  {24,24,24},{27,27,27},{30,30,30},{33,33,33},{37,37,37},{40,40,40},{43,43,43},{46,46,46},
  {50,50,50},{53,53,53},{56,56,56},{60,60,60},{63,63,63},{66,66,66},{70,70,70},{74,74,74},
  {77,77,77},{81,81,81},{84,84,84},{88,88,88},{91,91,91},{95,95,95},{99,99,99},{103,103,103},
  {106,106,106},{110,110,110},{114,114,114},{118,118,118},{122,122,122},{125,125,125},{129,129,129},{133,133,133},
  {137,137,137},{141,141,141},{145,145,145},{149,149,149},{153,153,153},{157,157,157},{161,161,161},{165,165,165},
  {169,169,169},{173,173,173},{177,177,177},{182,182,182},{186,186,186},{190,190,190},{194,194,194},{194,194,194},
  {194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},
  {194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},
  {194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},
  {194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},
  {194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},
  {194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},
  {194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},
  {194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},
  {194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},
  {194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},
  {194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},
  {194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},
  {194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},
  {194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},
  {194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},
  {194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},
  {194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},
  {194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},
  {194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},
  {194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},
  {194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},
  {194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},
  {194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},
  {194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},{194,194,194},
};

static inline float fastKink(float z) {
  if (z <= KINK_Z_MIN) return 0.0f;
  if (z >= KINK_Z_MAX) return TWO_PI;
  float norm = (z - KINK_Z_MIN) * ((float)(KINK_LUT_SIZE - 1) / KINK_Z_SPAN);
  int idx = (int)norm;
  float frac = norm - (float)idx;
  return kinkLUT[idx] * (1.0f - frac) + kinkLUT[idx + 1] * frac;
}

static inline float sampleEcho(float u, float v) {
  float x = (u + 0.5f) * (float)FRAME_W - 0.5f;
  float y = (v + 0.5f) * (float)FRAME_H - 0.5f;
  int x0 = (int)floorf(x);
  int y0 = (int)floorf(y);
  float fx = x - (float)x0;
  float fy = y - (float)y0;

  int cx0 = (x0 < 0) ? 0 : ((x0 >= FRAME_W) ? FRAME_W - 1 : x0);
  int cx1 = (x0 + 1 < 0) ? 0 : ((x0 + 1 >= FRAME_W) ? FRAME_W - 1 : x0 + 1);
  int cy0 = (y0 < 0) ? 0 : ((y0 >= FRAME_H) ? FRAME_H - 1 : y0);
  int cy1 = (y0 + 1 < 0) ? 0 : ((y0 + 1 >= FRAME_H) ? FRAME_H - 1 : y0 + 1);

  float v00 = echo[cy0 * FRAME_W + cx0];
  float v10 = echo[cy0 * FRAME_W + cx1];
  float v01 = echo[cy1 * FRAME_W + cx0];
  float v11 = echo[cy1 * FRAME_W + cx1];

  return (v00 * (1.0f - fx) + v10 * fx) * (1.0f - fy) + (v01 * (1.0f - fx) + v11 * fx) * fy;
}

void setup() {
  PFMath::buildSinLUT();

  for (int i = 0; i < KINK_LUT_SIZE; i++) {
    float z = KINK_Z_MIN + (float)i / (float)(KINK_LUT_SIZE - 1) * KINK_Z_SPAN;
    kinkLUT[i] = 4.0f * atanf(expf(z));
  }

  for (int x = 0; x < FRAME_W; x++) {
    nxLUT[x] = ((float)x / (float)FRAME_W) * 2.0f - 1.0f;
    xLLUT[x] = (x > 0) ? x - 1 : FRAME_W - 1;
    xRLUT[x] = (x < FRAME_W - 1) ? x + 1 : 0;
  }
  for (int y = 0; y < FRAME_H; y++) {
    nyLUT[y] = ((float)y / (float)FRAME_H) * 2.0f - 1.0f;
    yULUT[y] = (y > 0) ? y - 1 : FRAME_H - 1;
    yDLUT[y] = (y < FRAME_H - 1) ? y + 1 : 0;
  }

  if (!phi)    phi    = PFMem::allocFloats(TOTAL_PIXELS);
  if (!phiVel) phiVel = PFMem::allocFloats(TOTAL_PIXELS);
  if (!echo)   echo   = PFMem::allocFloats(TOTAL_PIXELS);

  if (!phi || !phiVel || !echo) return;

  for (int y = 0; y < FRAME_H; y++) {
    float nyInit = ((float)y / (float)FRAME_H) * 4.0f - 2.0f;
    for (int x = 0; x < FRAME_W; x++) {
      float nxInit = ((float)x / (float)FRAME_W) * 2.0f - 1.0f;
      int idx = y * FRAME_W + x;
      phi[idx]    = 4.0f * atanf(expf(nxInit * 3.0f)) * PFMath::fastSin(nyInit * 2.0f);
      phiVel[idx] = 0.0f;
      echo[idx]   = 0.0f;
    }
  }
}

void update(float dt, const InputFrame& input) {
  if (!phi || !phiVel || !echo) return;

  PFParams::apply(input, 0, &kinkEnergy, 0.3f, 100.0f, 2.077f);
  PFParams::apply(input, 1, &relPace, 0.2f, 12.0f, 0.246f);
  PFParams::apply(input, 2, &solitonCount, 1.0f, 5.0f, 0.083f);
  PFParams::apply(input, 3, &echoDecay, 0.4f, 0.98f, 0.012f);

  if (input.btnPressed[0] && !input.paramAbsoluteActive[0] && !input.knobAudioActive[0]) {
    memset(phi, 0, TOTAL_PIXELS * sizeof(float));
    memset(phiVel, 0, TOTAL_PIXELS * sizeof(float));
    memset(echo, 0, TOTAL_PIXELS * sizeof(float));
    maxNorm = 1.0f;
  }

  const float safeDt = fminf(dt > 0.0f ? dt : 0.016f, 0.05f);

  angle13 += safeDt * relPace * 1.3f;
  if (angle13 > TWO_PI) angle13 = fmodf(angle13, TWO_PI);

  kyDrift += safeDt * relPace * 0.3f;
  if (kyDrift >= 2.0f) kyDrift = fmodf(kyDrift, 2.0f);

  const float sinTimeOffset = 0.35f * PFMath::fastSin(angle13);
  const float zScale = solitonCount * kinkEnergy;

  float maxInt = 0.01f;

  for (int y = 0; y < FRAME_H; y++) {
    const float ny = nyLUT[y];
    const int   yU = yULUT[y];
    const int   yD = yDLUT[y];
    const int   row   = y * FRAME_W;
    const int   rowU  = yU * FRAME_W;
    const int   rowD  = yD * FRAME_W;
    const float ky    = ny - kyDrift;

    for (int x = 0; x < FRAME_W; x++) {
      const float nx = nxLUT[x];
      const int   xL = xLLUT[x];
      const int   xR = xRLUT[x];
      const int   idx = row + x;

      const float p = phi[idx];
      const float lap = phi[row + xL] + phi[row + xR] + phi[rowU + x] + phi[rowD + x] - 4.0f * p;

      const float force = 0.35f * lap - PFMath::fastSin(p);
      float vel = (phiVel[idx] + safeDt * force) * 0.985f;
      float nextPhi = p + safeDt * vel;

      const float kx = nx + sinTimeOffset;
      const float z1 = (kx * 2.0f - ky * 1.5f) * zScale;
      const float z2 = (-kx * 2.0f - ky * 1.5f) * zScale;
      const float kink1 = fastKink(z1);
      const float kink2 = fastKink(z2);
      nextPhi += (kink1 - kink2) * 0.035f;

      if (isnan(nextPhi) || isinf(nextPhi)) {
        nextPhi = 0.0f;
        vel = 0.0f;
      }

      phi[idx] = nextPhi;
      phiVel[idx] = vel;

      const float u = nx * 0.48f + 0.02f * PFMath::fastSin(nextPhi * 2.0f);
      const float v = ny * 0.48f + 0.008f * PFMath::fastCos(nextPhi * 2.0f) + 0.006f;
      const float prevEcho = sampleEcho(u, v);

      const float gradX = (phi[row + xR] - phi[row + xL]) * 0.5f;
      const float gradY = (phi[rowD + x] - phi[rowU + x]) * 0.5f;
      const float energyDensity = vel * vel + (gradX * gradX + gradY * gradY) * 0.5f + (1.0f - PFMath::fastCos(nextPhi));

      const float nextEcho = prevEcho * echoDecay + energyDensity * 0.3f;
      const float validEcho = (isnan(nextEcho) || isinf(nextEcho)) ? 0.0f : nextEcho;
      echo[idx] = validEcho;

      if (validEcho > maxInt) maxInt = validEcho;
    }
  }

  maxNorm += (maxInt - maxNorm) * 0.08f;
}

void draw() {
  PFCanvas::setFrame(FRAME_W, FRAME_H);

  if (!phi || !phiVel || !echo) {
    PFCanvas::present();
    return;
  }

  const float norm = 1.0f / fmaxf(0.001f, maxNorm);

  for (int y = 0; y < FRAME_H; y++) {
    const int row = y * FRAME_W;
    for (int x = 0; x < FRAME_W; x++) {
      const int idx = row + x;
      const float e = echo[idx] * norm;
      const float p = phi[idx];

      const float crest = fabsf(PFMath::fastSin(p * 0.5f));
      float tonal = e * 0.7f + crest * 0.35f;
      tonal = fminf(fmaxf(tonal, 0.0f), 1.0f);

      const float v = tonal * tonal * (3.0f - 2.0f * tonal);
      const float vClamped = fminf(fmaxf(v, 0.0f), 1.0f);
      const int li = (int)(vClamped * 255.0f + 0.5f);

      PFCanvas::setPixel(x, y, RAMP_LUT[li][0], RAMP_LUT[li][1], RAMP_LUT[li][2]);
    }
  }

  PFCanvas::present();
}

} // namespace SolitonLatticeEcho