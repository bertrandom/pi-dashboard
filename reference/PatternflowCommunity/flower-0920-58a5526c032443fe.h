#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_params.h"
#include "src/core_math.h"
#include "src/core_mem.h"

namespace flower_0920 {

const char* NAME = "flower_0920";
const char* const KNOB_LABELS[4] = {"Boughs", "WindBias", "Drape", "SwayAmp"};
constexpr bool ABSOLUTE_READY = true;

constexpr int FRAME_W = 64;
constexpr int FRAME_H = 128;
constexpr int BUFFER_SIZE = FRAME_W * FRAME_H;

// Pre-baked color ramp LUT (OkLab gradient, 256 stops)
static const uint8_t RAMP_LUT[256][3] = {
  {0,0,0},{0,14,0},{0,52,2},{0,96,5},{0,143,12},{0,194,20},{0,239,29},{0,234,34},
  {0,228,38},{0,223,41},{0,217,44},{0,212,47},{0,207,49},{0,201,51},{0,196,53},{0,191,54},
  {0,185,56},{0,180,57},{0,175,58},{0,170,58},{0,164,59},{0,159,59},{0,154,60},{0,149,60},
  {0,144,60},{0,139,60},{0,134,60},{0,129,60},{0,124,60},{0,119,60},{0,114,60},{0,109,59},
  {0,105,59},{0,100,58},{0,95,57},{0,93,57},{2,95,58},{3,97,59},{5,99,60},{6,102,61},
  {8,104,62},{10,106,63},{12,108,64},{13,111,65},{15,113,65},{17,115,66},{18,117,67},{20,120,68},
  {22,122,69},{23,124,70},{25,127,71},{26,129,72},{28,131,73},{29,134,74},{30,136,74},{32,138,75},
  {33,141,76},{35,143,77},{36,146,78},{38,148,79},{39,150,80},{40,153,81},{42,155,82},{43,158,82},
  {45,160,83},{46,162,84},{47,165,85},{49,167,86},{50,170,87},{51,172,88},{58,172,90},{65,171,92},
  {72,169,95},{78,168,97},{84,166,99},{89,165,102},{94,163,104},{98,162,106},{102,160,108},{106,159,110},
  {110,157,112},{114,155,114},{118,154,116},{121,152,118},{124,151,120},{127,149,122},{131,147,124},{134,146,126},
  {136,144,128},{139,142,130},{142,140,132},{145,138,133},{147,137,135},{150,135,137},{152,133,139},{155,131,140},
  {157,129,142},{160,127,144},{162,125,145},{164,123,147},{166,121,149},{168,118,150},{171,116,152},{173,114,154},
  {175,112,155},{177,109,157},{179,107,158},{181,104,160},{179,104,161},{177,104,163},{175,103,165},{172,103,166},
  {170,103,168},{168,102,170},{166,102,171},{163,102,173},{161,101,174},{159,101,176},{157,101,178},{155,100,179},
  {152,100,181},{150,99,182},{148,99,184},{146,98,185},{144,98,187},{142,97,188},{139,97,190},{137,96,191},
  {135,95,193},{133,95,194},{131,94,196},{128,93,197},{126,93,198},{124,92,200},{122,91,201},{120,90,203},
  {118,89,204},{115,89,206},{113,88,207},{111,87,208},{109,86,210},{107,85,211},{105,84,213},{103,83,214},
  {100,82,215},{98,81,217},{96,80,218},{94,78,220},{92,77,221},{90,76,222},{88,75,224},{86,73,225},
  {84,72,227},{81,70,228},{79,69,229},{77,67,231},{75,65,232},{73,64,233},{71,62,235},{69,60,236},
  {67,58,237},{65,56,239},{63,54,240},{61,51,241},{59,49,243},{57,46,244},{56,43,245},{54,40,247},
  {52,36,248},{50,32,249},{48,27,251},{47,22,252},{45,15,253},{44,4,254},{43,24,254},{42,43,251},
  {43,56,248},{45,67,246},{47,76,243},{50,84,240},{53,92,238},{57,98,235},{62,105,232},{67,111,229},
  {72,116,226},{77,122,223},{83,127,220},{88,132,216},{94,137,213},{100,142,210},{106,147,206},{112,151,202},
  {118,156,199},{124,160,195},{130,164,191},{137,168,187},{143,172,182},{149,176,178},{156,180,173},{162,184,168},
  {169,188,163},{175,192,157},{182,196,152},{188,199,145},{195,203,139},{202,207,132},{208,210,124},{215,214,116},
  {222,217,106},{228,221,96},{235,224,83},{242,228,68},{249,231,46},{255,234,0},{255,234,0},{255,234,0},
  {255,234,0},{255,234,0},{255,234,0},{255,234,0},{255,234,0},{255,234,0},{255,234,0},{255,234,0},
  {255,234,0},{255,234,0},{255,234,0},{255,234,0},{255,234,0},{255,234,0},{255,234,0},{255,234,0},
  {255,234,0},{255,234,0},{255,234,0},{255,234,0},{255,234,0},{255,234,0},{255,234,0},{255,234,0},
  {255,234,0},{255,234,0},{255,234,0},{255,234,0},{255,234,0},{255,234,0},{255,234,0},{255,234,0},
  {255,234,0},{255,234,0},{255,234,0},{255,234,0},{255,234,0},{255,234,0},{255,234,0},{255,234,0},
};

// Pattern parameters initialized with current Pattern Lab values
static float g_boughCount = 10.248f;
static float g_windBias   = 3.0f;
static float g_drape      = 1.991f;
static float g_swayAmp    = 1.223f;

static float g_time = 0.0f;
static float* g_vBuffer = nullptr;

// Precomputed canopy ceiling arch
static float g_archY[FRAME_W];

void setup() {
  PFMath::buildSinLUT();

  if (!g_vBuffer) {
    g_vBuffer = PFMem::allocFloats(BUFFER_SIZE);
  }

  for (int x = 0; x < FRAME_W; x++) {
    float normX = (float)x / (float)FRAME_W;
    g_archY[x] = PFMath::fastSin(normX * PI) * 5.0f;
  }
}

void update(float dt, const InputFrame& input) {
  if (!g_vBuffer) return;

  constexpr float FIXED_SPEED = 4.0f;
  g_time += dt * FIXED_SPEED;

  constexpr float TIME_WRAP = TWO_PI * 1000.0f;
  if (g_time > TIME_WRAP) {
    g_time -= TIME_WRAP;
  }

  PFParams::apply(input, 0, &g_boughCount, 4.0f, 12.0f, 0.167f);
  PFParams::apply(input, 1, &g_windBias, -3.0f, 3.0f, 0.125f);
  PFParams::apply(input, 2, &g_drape, 0.5f, 2.5f, 0.042f);
  PFParams::apply(input, 3, &g_swayAmp, 0.4f, 3.0f, 0.054f);
}

static inline void addPixel(float px, float py, float v) {
  int ix = PFMath::ifloor(px);
  int iy = PFMath::ifloor(py);
  if (ix >= 0 && ix < FRAME_W && iy >= 0 && iy < FRAME_H) {
    int idx = iy * FRAME_W + ix;
    float cur = g_vBuffer[idx];
    if (v > cur) {
      g_vBuffer[idx] = (v > 1.0f) ? 1.0f : v;
    }
  }
}

void draw() {
  PFCanvas::setFrame(FRAME_W, FRAME_H);

  if (!g_vBuffer) {
    PFCanvas::present();
    return;
  }

  memset(g_vBuffer, 0, BUFFER_SIZE * sizeof(float));

  const float t = g_time;
  const int boughCount = (int)g_boughCount;
  const float windBias = g_windBias;
  const float drape = g_drape;
  const float swayAmp = g_swayAmp;
  constexpr float TWINKLE = 6.0f;

  constexpr float PHI = 1.618033f;
  constexpr float E_CONST = 2.718281f;

  // 1. Falling pollen/dust particles influenced by Fourier wind field
  constexpr int DUST_COUNT = 14;
  for (int p = 0; p < DUST_COUNT; p++) {
    float py = PFMath::jsMod(t * (7.0f + (p % 5) * 1.25f) + p * 37.3f, (float)(FRAME_H + 10)) - 5.0f;
    float normY = PFMath::clamp01(py / (float)FRAME_H);

    float pLag = normY * 1.6f;
    float pPhase = p * 0.45f;
    float pw1 = PFMath::fastSin(t * 0.75f - pLag + pPhase) * 3.8f;
    float pw2 = PFMath::fastSin(t * 0.75f * PHI - pLag * 1.4f + pPhase * 0.7f) * 2.4f;
    float pw3 = PFMath::fastSin(t * 0.75f * E_CONST - pLag * 2.1f + pPhase * 0.3f) * 1.2f;
    float pw4 = PFMath::fastSin(t * 0.75f * PI - pLag * 2.8f) * 0.5f;

    float windDisplacement = (pw1 + pw2 + pw3 + pw4) * swayAmp * (0.8f + normY * 0.5f);
    float driftBias = windBias * 8.5f * (0.4f + normY * 0.7f);

    float px = PFMath::jsMod(p * 27.1f + windDisplacement + driftBias + (float)FRAME_W * 4.0f, (float)FRAME_W);

    float sinFlash = 0.5f + 0.5f * PFMath::fastSin(t * 2.5f + p * 2.1f);
    float flashWave = PFMath::fastPow(sinFlash, 1.8f);
    float coreVal = 0.55f + flashWave * 0.45f;
    float haloVal = coreVal * 0.4f;

    addPixel(px, py, coreVal);
    addPixel(px, py - 1.0f, haloVal);
    if ((p % 2) == 0) {
      addPixel(px + 1.0f, py, haloVal * 0.7f);
    }
  }

  // 2. Canopy arch
  for (int x = 0; x < FRAME_W; x++) {
    float arch = g_archY[x];
    addPixel((float)x, arch, 0.4f);
    addPixel((float)x, arch + 1.0f, 0.2f);
  }

  // 3. Hanging boughs with arc-length conservation
  constexpr int STEPS = 70;
  for (int b = 0; b < boughCount; b++) {
    float baseFrac = ((float)b + 0.5f) / (float)boughCount;
    float naturalShift = PFMath::fastSin(b * 3.7f + 1.2f) * (0.32f / (float)boughCount);
    float rootX = (baseFrac + naturalShift) * (float)FRAME_W;
    int rxIdx = PFMath::clamp(PFMath::ifloor(rootX), 0, FRAME_W - 1);
    float rootY = g_archY[rxIdx];

    float lengthJitter = PFMath::fastSin(b * 2.1f) * 14.0f + (float)((b * 5) % 3) * 8.0f;
    float branchLen = ((float)FRAME_H * 0.45f + lengthJitter) * (drape * 0.65f);
    float bPhase = (float)b * 0.5f;

    for (int s = 0; s <= STEPS; s++) {
      float frac = (float)s / (float)STEPS;
      float nominalDist = frac * branchLen;

      float lag = frac * 1.9f;
      float h1 = PFMath::fastSin(t * 0.75f - lag + bPhase) * 3.8f;
      float h2 = PFMath::fastSin(t * 0.75f * PHI - lag * 1.4f + bPhase * 0.7f) * 2.4f;
      float h3 = PFMath::fastSin(t * 0.75f * E_CONST - lag * 2.1f + bPhase * 0.3f) * 1.2f;
      float h4 = PFMath::fastSin(t * 0.75f * PI - lag * 2.8f) * 0.5f;

      float fracPow13 = frac * sqrtf(frac) * 0.794f; // Approximation for frac^1.3
      float fourierSum = (h1 + h2 + h3 + h4) * swayAmp * fracPow13;

      float fracPow145 = frac * sqrtf(frac); // Close approximation for frac^1.45
      float biasOffset = windBias * 7.5f * fracPow145;
      float totalDx = biasOffset + fourierSum;

      float clampedDx = fabsf(totalDx);
      float maxDx = nominalDist * 0.95f;
      if (clampedDx > maxDx) clampedDx = maxDx;

      float diffSq = nominalDist * nominalDist - clampedDx * clampedDx;
      float liftY = (diffSq > 0.0f) ? (nominalDist - sqrtf(diffSq)) : nominalDist;

      float px = rootX + totalDx;
      float py = rootY + nominalDist - liftY;

      float stemTone = 0.25f + (1.0f - frac) * 0.35f;
      addPixel(px, py, stemTone);

      // Leaves and twinkle flashes
      if ((s % 5) == 0 && frac > 0.1f) {
        float leafDir = (((s / 5) % 2) == 0) ? 1.0f : -1.0f;
        int nodeIdx = s / 5;
        bool isBigTwinkle = ((nodeIdx + b) % 2) == 0;

        float sinSparkle = 0.5f + 0.5f * PFMath::fastSin(t * 3.6f + (float)s + (float)b * 2.0f);
        float sparkle = sinSparkle * sqrtf(sinSparkle); // sinSparkle^1.5
        float leafTone = PFMath::clamp01((0.35f + sparkle * 0.65f) * (TWINKLE * 0.55f));

        if (isBigTwinkle) {
          addPixel(px + leafDir, py, leafTone);
          addPixel(px + leafDir * 2.0f, py, leafTone * 0.85f);
          addPixel(px + leafDir, py + 1.0f, leafTone * 0.75f);
          addPixel(px + leafDir * 2.0f, py + 1.0f, leafTone * 0.6f);
          addPixel(px + leafDir * 3.0f, py + 1.0f, leafTone * 0.35f);
          addPixel(px + leafDir, py - 1.0f, leafTone * 0.4f);
        } else {
          addPixel(px + leafDir, py, leafTone * 0.85f);
          addPixel(px + leafDir * 2.0f, py + 1.0f, leafTone * 0.45f);
        }
      }
    }
  }

  // 4. Map value field to panel pixels via pre-baked color ramp LUT
  for (int y = 0; y < FRAME_H; y++) {
    int rowOffset = y * FRAME_W;
    for (int x = 0; x < FRAME_W; x++) {
      float v = PFMath::clamp01(g_vBuffer[rowOffset + x]);
      int li = (int)(v * 255.0f + 0.5f);
      PFCanvas::setPixel(x, y, RAMP_LUT[li][0], RAMP_LUT[li][1], RAMP_LUT[li][2]);
    }
  }

  PFCanvas::present();
}

} // namespace flower_0920