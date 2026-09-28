#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_math.h"
#include "src/core_mem.h"

namespace FantasiaGarden {

const char* NAME = "Fantasia Garden";
const char* const KNOB_LABELS[4] = {"CorrLength", "Speed", "Contrast", "AgeDecay"};

constexpr int FRAME_W = 64;
constexpr int FRAME_H = 128;
constexpr int FRAME_N = FRAME_W * FRAME_H;
constexpr int BANK_H = FRAME_H * 2;
constexpr int BANK_N = FRAME_W * BANK_H;

// Knob parameters
static float g_corrLen = 1.022f;       // Knob 0
static float g_speed = 54.418f;        // Knob 1
static float g_contrast = 2.5f;        // Knob 2
static float g_ageDecay = 0.998f;      // Knob 3

static constexpr float CORRLEN_MIN = 0.0f;
static constexpr float CORRLEN_MAX = 10.0f;
static constexpr float CORRLEN_STEP = 0.208f;
static constexpr float SPEED_MIN = 1.0f;
static constexpr float SPEED_MAX = 120.0f;
static constexpr float SPEED_STEP = 2.479f;
static constexpr float CONTRAST_MIN = 0.3f;
static constexpr float CONTRAST_MAX = 2.5f;
static constexpr float CONTRAST_STEP = 0.046f;
static constexpr float AGEDECAY_MIN = 0.85f;
static constexpr float AGEDECAY_MAX = 0.998f;
static constexpr float AGEDECAY_STEP = 0.003f;

// Simulation state
static float* resistanceBank = nullptr; // BANK_N
static float* resistance = nullptr;     // FRAME_N
static uint8_t* invaded = nullptr;      // FRAME_N
static float* age = nullptr;            // FRAME_N
static int* frontierIdx = nullptr;      // FRAME_N
static float* frontierRes = nullptr;    // FRAME_N
static int frontierCount = 0;
static float stepCounter = 0;
static float maxAge = 1.0f;
static float resistanceOffset = 0;
static uint32_t randSeed = 0x7f3a1b2c;

// Time accumulator for speed-driven steps
static float stepAccum = 0.0f;

// RAMP LUT — verbatim
static const uint8_t RAMP_LUT[256][3] = {
  {0,0,0},{0,0,0},{0,0,0},{2,0,0},{3,1,0},{5,2,0},{7,5,0},{9,9,0},
  {9,14,0},{7,20,1},{3,26,5},{0,31,15},{0,35,25},{0,40,34},{0,44,44},{0,49,54},
  {0,53,65},{0,57,77},{0,61,93},{12,62,111},{38,63,121},{57,64,129},{75,64,134},{92,63,137},
  {109,63,136},{126,63,133},{142,63,127},{157,64,118},{171,65,107},{184,68,92},{194,74,75},{198,76,70},
  {199,76,73},{199,76,76},{200,76,80},{201,75,83},{202,75,86},{202,75,89},{203,75,92},{204,76,95},
  {204,76,99},{205,76,102},{205,76,105},{206,76,108},{206,76,111},{207,77,114},{207,77,118},{207,77,121},
  {207,78,124},{208,78,127},{208,79,131},{208,79,134},{208,79,137},{208,80,140},{208,81,144},{208,81,147},
  {208,82,150},{208,82,153},{207,83,157},{207,84,160},{207,85,163},{206,85,166},{206,86,170},{206,87,173},
  {205,88,176},{205,89,179},{204,90,183},{203,91,186},{203,91,189},{202,92,192},{201,93,196},{200,94,199},
  {199,95,202},{199,97,205},{198,98,208},{197,99,211},{195,100,214},{194,101,217},{193,102,220},{192,103,223},
  {191,104,226},{189,106,229},{188,107,232},{186,108,235},{185,109,238},{183,111,241},{182,112,244},{180,113,246},
  {178,115,249},{176,116,252},{175,117,254},{172,120,255},{170,122,255},{167,125,255},{165,127,255},{163,130,255},
  {160,132,255},{158,134,255},{156,136,255},{154,138,255},{152,140,255},{150,142,255},{148,144,255},{146,145,255},
  {144,147,255},{142,149,255},{140,150,255},{138,152,255},{136,154,255},{134,155,255},{132,157,255},{130,158,255},
  {128,160,255},{126,161,255},{124,163,255},{122,164,255},{120,165,255},{118,167,255},{116,168,255},{114,170,255},
  {111,171,255},{109,172,255},{107,174,255},{104,175,255},{102,176,255},{99,178,255},{97,179,255},{94,180,255},
  {91,182,255},{88,183,255},{85,184,255},{81,186,255},{77,187,255},{73,188,255},{69,190,255},{63,191,255},
  {58,192,255},{51,194,255},{43,195,255},{32,196,255},{14,198,255},{0,199,254},{0,200,252},{0,201,251},
  {0,202,249},{0,203,247},{0,204,246},{0,205,244},{0,206,243},{0,207,241},{0,208,240},{0,209,238},
  {0,210,237},{0,211,236},{0,212,234},{0,213,233},{0,214,231},{0,215,230},{0,216,228},{0,217,227},
  {0,218,226},{0,219,224},{0,220,223},{0,221,221},{0,222,220},{0,223,218},{0,224,216},{0,225,215},
  {0,226,213},{0,227,211},{0,228,210},{0,229,208},{0,229,206},{0,230,204},{0,231,202},{0,232,200},
  {0,233,197},{0,234,195},{0,235,193},{0,236,190},{0,237,187},{0,238,184},{0,239,181},{0,240,178},
  {0,241,175},{0,242,171},{0,244,167},{0,245,163},{0,246,158},{0,247,153},{0,248,148},{0,249,142},
  {0,250,135},{0,251,128},{0,252,119},{0,254,109},{0,255,97},{39,255,89},{58,255,80},{72,255,70},
  {83,255,57},{93,255,39},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},
  {102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},
  {102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},
  {102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},
  {102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},
  {102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},
  {102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},{102,255,0},
};

// --- Helpers ---
static float frand() {
  randSeed = (randSeed * 1103515245 + 12345) & 0x7fffffff;
  return (float)randSeed / 2147483647.0f;
}

static float getResistance(int x, int y) {
  int bankY = (int)((float)y + resistanceOffset) % BANK_H;
  if (bankY < 0) bankY += BANK_H;
  return resistanceBank[bankY * FRAME_W + x];
}

static void addNeighbors(int idx) {
  int x = idx % FRAME_W;
  int y = idx / FRAME_W;
  const int dirs[4][2] = {{-1,0},{1,0},{0,-1},{0,1}};
  for (int d = 0; d < 4; d++) {
    int nx = x + dirs[d][0];
    int ny = y + dirs[d][1];
    if (nx >= 0 && nx < FRAME_W && ny >= 0 && ny < FRAME_H) {
      int nidx = ny * FRAME_W + nx;
      if (!invaded[nidx]) {
        bool found = false;
        for (int f = 0; f < frontierCount; f++) {
          if (frontierIdx[f] == nidx) { found = true; break; }
        }
        if (!found) {
          frontierIdx[frontierCount] = nidx;
          frontierRes[frontierCount] = resistance[nidx];
          frontierCount++;
        }
      }
    }
  }
}

static void generateResistanceBank(float corrLen) {
  for (int i = 0; i < BANK_N; i++) {
    resistanceBank[i] = frand();
  }
  int radius = (int)corrLen;
  if (radius < 1) radius = 1;
  float* temp = PFMem::allocFloats(BANK_N);
  if (!temp) return;
  for (int pass = 0; pass < 2; pass++) {
    for (int y = 0; y < BANK_H; y++) {
      for (int x = 0; x < FRAME_W; x++) {
        float sum = 0;
        int count = 0;
        for (int dy = -radius; dy <= radius; dy++) {
          for (int dx = -radius; dx <= radius; dx++) {
            int sx = x + dx;
            int sy = y + dy;
            if (sx >= 0 && sx < FRAME_W && sy >= 0 && sy < BANK_H) {
              sum += resistanceBank[sy * FRAME_W + sx];
              count++;
            }
          }
        }
        temp[y * FRAME_W + x] = sum / (float)count;
      }
    }
    for (int i = 0; i < BANK_N; i++) {
      resistanceBank[i] = temp[i];
    }
  }
  free(temp);
}

static void reseedSimulation(float corrLen) {
  generateResistanceBank(corrLen);
  memset(invaded, 0, FRAME_N * sizeof(uint8_t));
  memset(age, 0, FRAME_N * sizeof(float));
  frontierCount = 0;
  stepCounter = 0;
  maxAge = 1.0f;

  for (int y = 0; y < FRAME_H; y++) {
    for (int x = 0; x < FRAME_W; x++) {
      resistance[y * FRAME_W + x] = getResistance(x, y);
    }
  }

  for (int x = 5; x < FRAME_W - 5; x++) {
    if (frand() < 0.15f) {
      int idx = (FRAME_H - 1) * FRAME_W + x;
      invaded[idx] = 1;
      stepCounter++;
      age[idx] = stepCounter;
      if (stepCounter > maxAge) maxAge = stepCounter;
      addNeighbors(idx);
    }
  }
}

static bool invadeOneSite() {
  if (frontierCount == 0) return false;
  int minIdx = 0;
  float minRes = frontierRes[0];
  for (int i = 1; i < frontierCount; i++) {
    if (frontierRes[i] < minRes) {
      minRes = frontierRes[i];
      minIdx = i;
    }
  }
  int siteIdx = frontierIdx[minIdx];
  frontierCount--;
  frontierIdx[minIdx] = frontierIdx[frontierCount];
  frontierRes[minIdx] = frontierRes[frontierCount];

  invaded[siteIdx] = 1;
  stepCounter++;
  age[siteIdx] = stepCounter;
  if (stepCounter > maxAge) maxAge = stepCounter;
  addNeighbors(siteIdx);
  return true;
}

static void scrollDown() {
  for (int y = FRAME_H - 1; y >= 1; y--) {
    for (int x = 0; x < FRAME_W; x++) {
      int src = (y - 1) * FRAME_W + x;
      int dst = y * FRAME_W + x;
      invaded[dst] = invaded[src];
      age[dst] = age[src] * 0.95f;
    }
  }
  for (int x = 0; x < FRAME_W; x++) {
    invaded[x] = 0;
    age[x] = 0;
  }

  resistanceOffset = fmodf(resistanceOffset + 1.0f, (float)(BANK_H));
  for (int y = 0; y < FRAME_H; y++) {
    for (int x = 0; x < FRAME_W; x++) {
      resistance[y * FRAME_W + x] = getResistance(x, y);
    }
  }

  frontierCount = 0;
  for (int y = 0; y < FRAME_H; y++) {
    for (int x = 0; x < FRAME_W; x++) {
      int idx = y * FRAME_W + x;
      if (invaded[idx]) {
        const int dirs[4][2] = {{-1,0},{1,0},{0,-1},{0,1}};
        for (int d = 0; d < 4; d++) {
          int nx = x + dirs[d][0];
          int ny = y + dirs[d][1];
          if (nx >= 0 && nx < FRAME_W && ny >= 0 && ny < FRAME_H) {
            int nidx = ny * FRAME_W + nx;
            if (!invaded[nidx]) {
              bool found = false;
              for (int f = 0; f < frontierCount; f++) {
                if (frontierIdx[f] == nidx) { found = true; break; }
              }
              if (!found) {
                frontierIdx[frontierCount] = nidx;
                frontierRes[frontierCount] = resistance[nidx];
                frontierCount++;
              }
            }
          }
        }
      }
    }
  }

  for (int x = 3; x < FRAME_W - 3; x++) {
    int idx = (FRAME_H - 1) * FRAME_W + x;
    if (!invaded[idx] && frand() < 0.12f) {
      invaded[idx] = 1;
      stepCounter++;
      age[idx] = stepCounter;
      if (stepCounter > maxAge) maxAge = stepCounter;
      addNeighbors(idx);
    }
  }
}

static bool checkScroll() {
  int topCount = 0;
  for (int y = 0; y < 8; y++) {
    for (int x = 0; x < FRAME_W; x++) {
      if (invaded[y * FRAME_W + x]) topCount++;
    }
  }
  return topCount > 20;
}

// --- Interface ---
void setup() {
  PFMath::buildSinLUT();

  resistanceBank = PFMem::allocFloats(BANK_N);
  resistance = PFMem::allocFloats(FRAME_N);
  age = PFMem::allocFloats(FRAME_N);
  invaded = (uint8_t*)PFMem::allocFloats(FRAME_N);
  frontierIdx = (int*)PFMem::allocFloats(FRAME_N);
  frontierRes = PFMem::allocFloats(FRAME_N);

  if (!resistanceBank || !resistance || !age || !invaded || !frontierIdx || !frontierRes) return;
  reseedSimulation(3.0f);

  for (int i = 0; i < 1500; i++) {
    invadeOneSite();
  }
}

void update(float dt, const InputFrame& input) {
  if (!resistanceBank || !resistance || !age || !invaded || !frontierIdx || !frontierRes) return;

  dt = fminf(dt, 0.1f);

  if (input.btnPressed[0]) {
    reseedSimulation(g_corrLen);
    return;
  }

  // Knob deltas
  g_corrLen += input.knobDeltas[0] * CORRLEN_STEP;
  if (g_corrLen < CORRLEN_MIN) g_corrLen = CORRLEN_MIN;
  if (g_corrLen > CORRLEN_MAX) g_corrLen = CORRLEN_MAX;

  g_speed += input.knobDeltas[1] * SPEED_STEP;
  if (g_speed < SPEED_MIN) g_speed = SPEED_MIN;
  if (g_speed > SPEED_MAX) g_speed = SPEED_MAX;

  g_contrast += input.knobDeltas[2] * CONTRAST_STEP;
  if (g_contrast < CONTRAST_MIN) g_contrast = CONTRAST_MIN;
  if (g_contrast > CONTRAST_MAX) g_contrast = CONTRAST_MAX;

  g_ageDecay += input.knobDeltas[3] * AGEDECAY_STEP;
  if (g_ageDecay < AGEDECAY_MIN) g_ageDecay = AGEDECAY_MIN;
  if (g_ageDecay > AGEDECAY_MAX) g_ageDecay = AGEDECAY_MAX;

  int steps = (int)g_speed;
  if (steps < 1) steps = 1;

  for (int s = 0; s < steps; s++) {
    if (frontierCount == 0 || checkScroll()) {
      scrollDown();
    }
    if (!invadeOneSite()) {
      scrollDown();
    }
  }

  float decayBase = PFMath::fastPow(g_ageDecay, (float)steps * 0.05f);
  for (int i = 0; i < FRAME_N; i++) {
    if (invaded[i]) {
      age[i] *= decayBase;
    }
  }
  maxAge *= 0.9995f;

  for (int i = 0; i < FRAME_N; i++) {
    if (!isfinite(age[i]) || !isfinite(resistance[i])) {
      reseedSimulation(g_corrLen);
      break;
    }
  }
}

void draw() {
  if (!resistanceBank || !resistance || !age || !invaded) {
    PFCanvas::present();
    return;
  }

  PFCanvas::setFrame(FRAME_W, FRAME_H);

  float invMaxAge = (maxAge > 1.0f) ? (1.0f / maxAge) : 1.0f;
  float contrastInv = 1.0f / g_contrast;

  for (int y = 0; y < FRAME_H; y++) {
    for (int x = 0; x < FRAME_W; x++) {
      int idx = y * FRAME_W + x;
      float v = 0.0f;
      if (invaded[idx]) {
        v = age[idx] * invMaxAge;
        if (v < 0.0f) v = 0.0f;
        if (v > 1.0f) v = 1.0f;
        v = PFMath::fastPow(v, contrastInv);
      }
      int li = (int)(v * 255.0f + 0.5f);
      if (li < 0) li = 0;
      if (li > 255) li = 255;
      PFCanvas::setPixel(x, y, RAMP_LUT[li][0], RAMP_LUT[li][1], RAMP_LUT[li][2]);
    }
  }

  PFCanvas::present();
}

} // namespace FantasiaGarden