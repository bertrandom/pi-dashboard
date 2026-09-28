#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_math.h"
#include "src/core_mem.h"

namespace PhoenixEmber {

const char* NAME = "Phoenix Ember";
const char* const KNOB_LABELS[4] = {"SwirlWeight", "Speed", "Density", "TrailPersisten"};

constexpr int FRAME_W = 64;
constexpr int FRAME_H = 128;
constexpr int FRAME_N = FRAME_W * FRAME_H;

// Knob parameters
static float g_swirlWeight = 1.649f;      // Knob 0
static float g_speed = 10.703f;           // Knob 1
static float g_density = 3000.0f;         // Knob 2
static float g_trailPersistence = 0.944f; // Knob 3

static constexpr float SWIRL_MIN = 0.0f;
static constexpr float SWIRL_MAX = 4.2f;
static constexpr float SWIRL_STEP = 0.088f;
static constexpr float SPEED_MIN = 0.2f;
static constexpr float SPEED_MAX = 12.5f;
static constexpr float SPEED_STEP = 0.256f;
static constexpr float DENSITY_MIN = 1000.0f;
static constexpr float DENSITY_MAX = 3000.0f;
static constexpr float DENSITY_STEP = 41.667f;
static constexpr float TRAIL_MIN = 0.82f;
static constexpr float TRAIL_MAX = 0.985f;
static constexpr float TRAIL_STEP = 0.003f;

// Simulation state
static float* histBuf = nullptr; // FRAME_N
static float t = 0.0f;
static float px = 0.1f;
static float py = 0.1f;
static uint32_t randSeed = 771029;

// RAMP LUT — verbatim
static const uint8_t RAMP_LUT[256][3] = {
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{1,0,0},{1,0,0},{2,0,0},
  {3,0,0},{4,0,0},{6,0,0},{8,0,0},{10,0,0},{13,0,0},{15,0,0},{18,0,0},
  {21,0,0},{23,0,0},{26,0,0},{29,0,0},{32,0,0},{35,0,0},{38,0,0},{41,0,0},
  {44,0,0},{47,0,0},{50,0,0},{53,0,0},{56,0,0},{59,0,0},{62,0,0},{65,0,0},
  {68,0,0},{72,0,0},{75,0,0},{78,0,0},{82,0,0},{85,0,0},{88,0,0},{92,0,0},
  {95,0,0},{98,0,0},{102,0,0},{105,0,0},{109,0,0},{112,0,0},{116,0,0},{119,0,0},
  {123,0,0},{127,0,0},{130,0,0},{134,0,0},{137,0,0},{141,0,0},{145,0,0},{148,0,0},
  {152,0,0},{156,0,0},{160,0,0},{163,0,0},{167,0,0},{171,0,0},{175,0,0},{178,0,0},
  {182,0,0},{186,0,0},{190,0,0},{194,0,0},{198,0,0},{202,0,0},{206,0,0},{209,0,0},
  {213,0,0},{217,0,0},{221,0,0},{225,0,0},{229,0,0},{233,0,0},{237,0,0},{241,0,0},
  {245,0,0},{249,0,0},{254,0,0},{255,7,4},{255,17,10},{255,24,16},{255,30,20},{255,34,24},
  {255,39,28},{255,42,31},{255,46,34},{255,49,36},{255,52,39},{255,55,41},{255,58,44},{255,60,46},
  {255,63,48},{255,65,50},{255,68,52},{255,70,54},{255,72,56},{255,74,58},{255,76,60},{255,78,62},
  {255,80,64},{255,82,66},{255,84,67},{255,86,69},{255,88,71},{255,89,72},{255,91,74},{255,93,76},
  {255,95,77},{255,96,79},{255,98,81},{255,100,82},{255,101,84},{255,103,85},{255,104,87},{255,106,88},
  {255,107,90},{255,109,91},{255,110,93},{255,112,94},{255,113,96},{255,115,97},{255,116,99},{255,117,100},
  {255,119,101},{255,120,103},{255,121,104},{255,123,106},{255,124,107},{255,125,108},{255,127,110},{255,128,111},
  {255,129,112},{255,131,114},{255,132,115},{255,133,117},{255,135,118},{255,136,119},{255,137,121},{255,138,122},
  {255,140,123},{255,141,124},{255,142,126},{255,143,127},{255,144,128},{255,146,130},{255,147,131},{255,148,132},
  {255,149,134},{255,150,135},{255,151,136},{255,153,137},{255,154,139},{255,155,140},{255,156,141},{255,157,143},
  {255,158,144},{255,160,145},{255,161,146},{255,162,148},{255,163,149},{255,164,150},{255,165,151},{255,166,153},
  {255,167,154},{255,168,155},{255,170,156},{255,171,157},{255,172,159},{255,173,160},{255,174,161},{255,175,162},
  {255,176,164},{255,177,165},{255,178,166},{255,179,167},{255,180,168},{255,181,170},{255,182,171},{255,184,172},
  {255,185,173},{255,186,174},{255,187,176},{255,188,177},{255,189,178},{255,190,179},{255,191,180},{255,192,182},
  {255,193,183},{255,194,184},{255,195,185},{255,196,186},{255,197,188},{255,198,189},{255,199,190},{255,200,191},
  {255,201,192},{255,202,193},{255,203,195},{255,204,196},{255,205,197},{255,206,198},{255,207,199},{255,208,200},
  {255,209,202},{255,210,203},{255,211,204},{255,212,205},{255,213,206},{255,214,207},{255,215,209},{255,216,210},
  {255,217,211},{255,218,212},{255,219,213},{255,220,214},{255,221,215},{255,222,217},{255,223,218},{255,224,219},
  {255,225,220},{255,226,221},{255,227,222},{255,228,223},{255,229,225},{255,230,226},{255,231,227},{255,232,228},
  {255,233,229},{255,234,230},{255,235,231},{255,236,233},{255,237,234},{255,238,235},{255,239,236},{255,240,237},
  {255,241,238},{255,242,239},{255,243,240},{255,244,242},{255,244,243},{255,245,244},{255,246,245},{255,247,246},
  {255,248,247},{255,249,248},{255,250,249},{255,251,251},{255,252,252},{255,253,253},{255,254,254},{255,255,255},
};

// --- Helpers ---
static float frand() {
  randSeed = (randSeed * 1664525 + 1013904223) % 4294967296;
  return (float)randSeed / 4294967296.0f;
}

static void stepFlame(float dt) {
  if (!histBuf) return;

  const float swirlW = g_swirlWeight;
  const float speed = g_speed;
  const int iterCount = (int)g_density;
  const float persistence = g_trailPersistence;

  // Decay existing log-density buffer
  for (int i = 0; i < FRAME_N; i++) {
    histBuf[i] *= persistence;
  }

  // Slowly morphing affine coefficients
  const float morph = t * speed * 0.4f;
  const float a1 = 0.5f * PFMath::fastCos(morph * 0.3f);
  const float b1 = -0.5f * PFMath::fastSin(morph * 0.4f);
  const float c1 = 0.5f * PFMath::fastSin(morph * 0.3f);
  const float d1 = 0.5f * PFMath::fastCos(morph * 0.4f);

  const float a2 = 0.4f * PFMath::fastSin(morph * 0.5f);
  const float b2 = 0.4f * PFMath::fastCos(morph * 0.2f);
  const float c2 = -0.4f * PFMath::fastCos(morph * 0.5f);
  const float d2 = 0.4f * PFMath::fastSin(morph * 0.2f);

  float x = px;
  float y = py;

  const float wf = (float)FRAME_W;
  const float hf = (float)FRAME_H;
  const float scaleX = 0.55f * wf;
  const float scaleY = 0.45f * hf;
  const float offsetX = 0.9f;
  const float offsetY = 1.1f;

  for (int i = 0; i < iterCount; i++) {
    const float r = frand();

    float nx, ny;
    if (r < 0.5f) {
      nx = a1 * x + b1 * y;
      ny = c1 * x + d1 * y + 0.3f;
    } else {
      nx = a2 * x + b2 * y - 0.2f;
      ny = c2 * x + d2 * y - 0.4f;
    }

    // Variation blend: linear + swirl
    if (swirlW > 0.001f) {
      const float r2 = nx * nx + ny * ny + 1e-6f;
      const float sinR2 = PFMath::fastSin(r2 * 2.0f);
      const float cosR2 = PFMath::fastCos(r2 * 2.0f);

      const float sx = nx * sinR2 - ny * cosR2;
      const float sy = nx * cosR2 + ny * sinR2;

      x = nx * (1.0f - swirlW) + sx * swirlW;
      y = ny * (1.0f - swirlW) + sy * swirlW;
    } else {
      x = nx;
      y = ny;
    }

    // Map to pixel coordinates
    int pxInt = (int)((x + offsetX) * scaleX);
    int pyInt = (int)((y + offsetY) * scaleY);

    if (pxInt >= 0 && pxInt < FRAME_W && pyInt >= 0 && pyInt < FRAME_H) {
      histBuf[pyInt * FRAME_W + pxInt] += 1.0f;
    }

    if (!isfinite(x) || !isfinite(y) || fabsf(x) > 10.0f || fabsf(y) > 10.0f) {
      x = frand() * 0.2f - 0.1f;
      y = frand() * 0.2f - 0.1f;
    }
  }

  px = x;
  py = y;
}

// --- Interface ---
void setup() {
  PFMath::buildSinLUT();

  histBuf = PFMem::allocFloats(FRAME_N);
  if (!histBuf) return;

  px = 0.1f;
  py = 0.1f;
  t = 0.0f;

  // Warmup: run with default-ish parameters
  const float saveSwirl = g_swirlWeight;
  const float saveSpeed = g_speed;
  const float saveDensity = g_density;
  const float saveTrail = g_trailPersistence;
  g_swirlWeight = 0.6f;
  g_speed = 1.0f;
  g_density = 1000.0f;
  g_trailPersistence = 0.92f;

  for (int w = 0; w < 100; w++) {
    stepFlame(0.016f);
  }

  g_swirlWeight = saveSwirl;
  g_speed = saveSpeed;
  g_density = saveDensity;
  g_trailPersistence = saveTrail;
}

void update(float dt, const InputFrame& input) {
  if (!histBuf) return;

  dt = fminf(dt, 0.1f);
  t += dt;
  // t feeds only fastSin/fastCos with multipliers 0.2, 0.3, 0.4, 0.5
  // common period: 2π / 0.1 = 20π
  const float T_PERIOD = 20.0f * PI;
  if (t > T_PERIOD) t -= T_PERIOD;

  // Knob deltas
  g_swirlWeight += input.knobDeltas[0] * SWIRL_STEP;
  if (g_swirlWeight < SWIRL_MIN) g_swirlWeight = SWIRL_MIN;
  if (g_swirlWeight > SWIRL_MAX) g_swirlWeight = SWIRL_MAX;

  g_speed += input.knobDeltas[1] * SPEED_STEP;
  if (g_speed < SPEED_MIN) g_speed = SPEED_MIN;
  if (g_speed > SPEED_MAX) g_speed = SPEED_MAX;

  g_density += input.knobDeltas[2] * DENSITY_STEP;
  if (g_density < DENSITY_MIN) g_density = DENSITY_MIN;
  if (g_density > DENSITY_MAX) g_density = DENSITY_MAX;

  g_trailPersistence += input.knobDeltas[3] * TRAIL_STEP;
  if (g_trailPersistence < TRAIL_MIN) g_trailPersistence = TRAIL_MIN;
  if (g_trailPersistence > TRAIL_MAX) g_trailPersistence = TRAIL_MAX;

  stepFlame(dt);
}

void draw() {
  if (!histBuf) {
    PFCanvas::present();
    return;
  }

  PFCanvas::setFrame(FRAME_W, FRAME_H);

  // Logarithmic density tone mapping
  float maxLog = 0.001f;
  for (int i = 0; i < FRAME_N; i++) {
    float logVal = logf(1.0f + histBuf[i]);
    if (logVal > maxLog) maxLog = logVal;
  }

  float norm = 1.0f / fmaxf(maxLog, 0.1f);

  for (int y = 0; y < FRAME_H; y++) {
    for (int x = 0; x < FRAME_W; x++) {
      int idx = y * FRAME_W + x;
      float val = logf(1.0f + histBuf[idx]) * norm;

      if (val < 0.0f) val = 0.0f;
      if (val > 1.0f) val = 1.0f;
      // Smoothstep
      val = val * val * (3.0f - 2.0f * val);

      int li = (int)(val * 255.0f + 0.5f);
      if (li < 0) li = 0;
      if (li > 255) li = 255;
      PFCanvas::setPixel(x, y, RAMP_LUT[li][0], RAMP_LUT[li][1], RAMP_LUT[li][2]);
    }
  }

  PFCanvas::present();
}

} // namespace PhoenixEmber