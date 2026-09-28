#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_params.h"
#include "src/core_math.h"
#include "src/core_mem.h"

namespace BurgersShockWeb {

constexpr int FRAME_W = 64;
constexpr int FRAME_H = 128;
constexpr int NUM_PIXELS = FRAME_W * FRAME_H;

const char* NAME = "2D Burgers shock web";
const char* const KNOB_LABELS[4] = {"Viscosity", "Speed", "Drift", "Persistence"};
constexpr bool ABSOLUTE_READY = true;

// Knob parameters
static float viscosity = 0.6f;
static float speed = 5.0f;
static float drift = 1.418f;
static float persistence = 0.85f;

// Simulation buffers (PSRAM-allocated)
static float* u = nullptr;
static float* v = nullptr;
static float* uNext = nullptr;
static float* vNext = nullptr;
static float* trail = nullptr;

// Precomputed coordinate index tables
static int xm_tab[FRAME_W];
static int xp_tab[FRAME_W];
static int ym_tab[FRAME_H];
static int yp_tab[FRAME_H];

// Time & normalization state
static float phaseY = 0.0f;
static float phaseX = 0.0f;
static float emaPeak = 0.5f;

// Baked color ramp lookup table (256 RGB entries)
static const uint8_t RAMP_LUT[256][3] = {
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,1},{1,1,2},{1,1,3},{2,1,5},
  {4,2,7},{6,3,9},{9,4,12},{12,4,14},{16,6,16},{20,7,18},{25,8,19},{29,10,21},
  {34,12,21},{38,13,22},{42,15,22},{47,18,22},{51,20,21},{55,22,20},{59,25,18},{63,28,17},
  {67,31,14},{70,35,11},{72,39,8},{75,43,4},{77,47,1},{78,52,0},{78,57,0},{79,62,0},
  {79,67,0},{78,72,0},{76,77,5},{73,82,14},{70,88,23},{65,93,32},{60,98,41},{52,103,50},
  {43,108,60},{31,113,71},{9,118,81},{0,121,93},{0,124,104},{0,128,114},{0,131,124},{0,134,134},
  {0,137,144},{0,140,155},{0,143,166},{0,145,178},{0,148,191},{0,149,205},{38,150,216},{61,151,225},
  {71,151,229},{75,150,231},{79,150,233},{83,149,234},{87,149,236},{91,148,237},{95,148,239},{99,147,240},
  {103,147,241},{107,146,242},{110,145,243},{114,145,244},{118,144,245},{121,143,246},{125,143,247},{129,142,248},
  {132,141,248},{136,141,249},{139,140,249},{143,139,250},{146,139,250},{150,138,250},{153,137,250},{157,136,250},
  {160,136,250},{163,135,250},{167,134,249},{170,133,249},{173,133,248},{177,132,248},{180,131,247},{183,130,246},
  {186,130,246},{190,129,245},{193,128,244},{196,127,242},{199,127,241},{202,126,240},{205,125,238},{208,124,237},
  {211,124,235},{214,123,234},{217,122,232},{220,121,230},{223,121,228},{226,120,226},{229,119,224},{231,119,221},
  {234,118,219},{237,117,217},{240,117,214},{242,116,212},{245,116,209},{247,115,206},{250,114,204},{252,114,201},
  {255,113,198},{255,115,194},{255,117,191},{255,120,187},{255,121,184},{255,123,181},{255,125,178},{255,127,175},
  {255,128,172},{255,130,170},{255,132,167},{255,133,165},{255,134,162},{255,136,160},{255,137,158},{255,139,156},
  {255,140,154},{255,141,152},{255,143,150},{255,144,148},{255,145,146},{255,146,144},{255,147,142},{255,149,140},
  {255,150,138},{255,151,137},{255,152,135},{255,153,133},{255,154,131},{255,155,129},{255,157,128},{255,158,126},
  {255,159,124},{255,160,122},{255,161,120},{255,162,118},{255,163,116},{255,164,114},{255,165,112},{255,166,109},
  {255,167,107},{255,168,104},{255,169,102},{255,170,99},{255,171,96},{255,172,93},{255,173,89},{255,175,85},
  {255,176,81},{255,177,76},{255,178,71},{255,179,65},{255,180,57},{255,181,48},{255,182,35},{255,183,12},
  {254,185,0},{252,187,0},{250,189,0},{248,191,0},{246,192,0},{244,194,0},{242,196,0},{240,198,0},
  {237,200,0},{235,202,0},{233,203,0},{230,205,0},{228,207,0},{225,209,0},{223,211,0},{220,212,0},
  {217,214,0},{214,216,0},{211,218,0},{207,220,0},{204,222,0},{200,224,0},{196,226,0},{191,228,0},
  {186,230,0},{181,232,0},{175,235,0},{169,237,0},{162,239,0},{154,242,0},{145,244,0},{135,247,0},
  {123,249,0},{108,252,0},{89,255,0},{89,255,0},{89,255,0},{89,255,0},{89,255,0},{89,255,0},
  {89,255,0},{89,255,0},{89,255,0},{89,255,0},{89,255,0},{89,255,0},{89,255,0},{89,255,0},
  {89,255,0},{89,255,0},{89,255,0},{89,255,0},{89,255,0},{89,255,0},{89,255,0},{89,255,0},
  {89,255,0},{89,255,0},{89,255,0},{89,255,0},{89,255,0},{89,255,0},{89,255,0},{89,255,0},
  {89,255,0},{89,255,0},{89,255,0},{89,255,0},{89,255,0},{89,255,0},{89,255,0},{89,255,0},
  {89,255,0},{89,255,0},{89,255,0},{89,255,0},{89,255,0},{89,255,0},{89,255,0},{89,255,0},
  {89,255,0},{89,255,0},{89,255,0},{89,255,0},{89,255,0},{89,255,0},{89,255,0},{89,255,0},
};

static void stepBurgers(float subDt, float nu, float driftVal) {
  const float fY = PFMath::fastSin(phaseY) * 0.3f;
  const float fX = PFMath::fastCos(phaseX) * 0.3f;
  constexpr float invH = 1.0f / (float)FRAME_H;
  constexpr float invW = 1.0f / (float)FRAME_W;

  // Precompute 1D stirring terms per substep
  float stirU_tab[FRAME_H];
  for (int y = 0; y < FRAME_H; ++y) {
    const float ny = (float)y * invH;
    stirU_tab[y] = PFMath::fastSin((ny * 3.0f + fY) * TWO_PI) * 0.2f;
  }

  float stirV_tab[FRAME_W];
  for (int x = 0; x < FRAME_W; ++x) {
    const float nx = (float)x * invW;
    stirV_tab[x] = PFMath::fastCos((nx * 2.0f + fX) * TWO_PI) * 0.2f + driftVal;
  }

  for (int y = 0; y < FRAME_H; ++y) {
    const int ym = ym_tab[y];
    const int yp = yp_tab[y];

    const float* __restrict uc_row = &u[y * FRAME_W];
    const float* __restrict um_row = &u[ym * FRAME_W];
    const float* __restrict up_row = &u[yp * FRAME_W];

    const float* __restrict vc_row = &v[y * FRAME_W];
    const float* __restrict vm_row = &v[ym * FRAME_W];
    const float* __restrict vp_row = &v[yp * FRAME_W];

    float* __restrict un_row = &uNext[y * FRAME_W];
    float* __restrict vn_row = &vNext[y * FRAME_W];

    const float stirU = stirU_tab[y];

    for (int x = 0; x < FRAME_W; ++x) {
      const int xm = xm_tab[x];
      const int xp = xp_tab[x];

      const float uc = uc_row[x];
      const float vc = vc_row[x];

      const float du_dx = uc > 0.0f ? (uc - uc_row[xm]) : (uc_row[xp] - uc);
      const float du_dy = vc > 0.0f ? (uc - um_row[x]) : (up_row[x] - uc);
      const float dv_dx = uc > 0.0f ? (vc - vc_row[xm]) : (vc_row[xp] - vc);
      const float dv_dy = vc > 0.0f ? (vc - vm_row[x]) : (vp_row[x] - vc);

      const float lapU = uc_row[xm] + uc_row[xp] + um_row[x] + up_row[x] - 4.0f * uc;
      const float lapV = vc_row[xm] + vc_row[xp] + vm_row[x] + vp_row[x] - 4.0f * vc;

      const float stirV = stirV_tab[x];

      float nuVal = uc + subDt * (-(uc * du_dx + vc * du_dy) + nu * lapU + stirU);
      float nvVal = vc + subDt * (-(uc * dv_dx + vc * dv_dy) + nu * lapV + stirV);

      if (!(nuVal >= -10.0f && nuVal <= 10.0f)) nuVal = 0.0f;
      if (!(nvVal >= -10.0f && nvVal <= 10.0f)) nvVal = 0.0f;

      un_row[x] = nuVal;
      vn_row[x] = nvVal;
    }
  }

  // Zero-copy buffer pointer swap
  float* tmpU = u; u = uNext; uNext = tmpU;
  float* tmpV = v; v = vNext; vNext = tmpV;
}

void setup() {
  PFMath::buildSinLUT();

  for (int x = 0; x < FRAME_W; ++x) {
    xm_tab[x] = x > 0 ? x - 1 : FRAME_W - 1;
    xp_tab[x] = x < FRAME_W - 1 ? x + 1 : 0;
  }
  for (int y = 0; y < FRAME_H; ++y) {
    ym_tab[y] = y > 0 ? y - 1 : FRAME_H - 1;
    yp_tab[y] = y < FRAME_H - 1 ? y + 1 : 0;
  }

  if (!u) u = PFMem::allocFloats(NUM_PIXELS);
  if (!v) v = PFMem::allocFloats(NUM_PIXELS);
  if (!uNext) uNext = PFMem::allocFloats(NUM_PIXELS);
  if (!vNext) vNext = PFMem::allocFloats(NUM_PIXELS);
  if (!trail) trail = PFMem::allocFloats(NUM_PIXELS);

  if (!u || !v || !uNext || !vNext || !trail) return;

  uint32_t seed = 4242;
  for (int i = 0; i < NUM_PIXELS; ++i) {
    seed = (seed * 1664525u + 1013904223u);
    float rnd1 = (float)seed / 4294967296.0f;
    seed = (seed * 1664525u + 1013904223u);
    float rnd2 = (float)seed / 4294967296.0f;

    u[i] = (rnd1 - 0.5f) * 0.2f;
    v[i] = (rnd2 - 0.5f) * 0.2f;
    trail[i] = 0.0f;
  }

  phaseY = 0.0f;
  phaseX = 0.0f;
  emaPeak = 0.5f;

  for (int i = 0; i < 50; ++i) {
    stepBurgers(0.1f, 0.1f, 0.4f);
    phaseY += 0.1f * 0.41f;
    if (phaseY >= TWO_PI) phaseY -= TWO_PI;
    phaseX += 0.1f * 0.29f;
    if (phaseX >= TWO_PI) phaseX -= TWO_PI;
  }
}

void update(float dt, const InputFrame& input) {
  PFParams::apply(input, 0, &viscosity, 0.03f, 0.6f, 0.012f);
  PFParams::apply(input, 1, &speed, 0.2f, 5.0f, 0.1f);
  PFParams::apply(input, 2, &drift, 0.0f, 2.0f, 0.042f);
  PFParams::apply(input, 3, &persistence, 0.85f, 0.99f, 0.003f);

  if (!u || !v || !uNext || !vNext || !trail) return;

  const float effectiveDt = fminf(dt, 0.1f) * speed;
  constexpr int STEPS = 4;
  const float subDt = effectiveDt / (float)STEPS;

  for (int s = 0; s < STEPS; ++s) {
    phaseY += subDt * 0.41f;
    if (phaseY >= TWO_PI) phaseY -= TWO_PI;

    phaseX += subDt * 0.29f;
    if (phaseX >= TWO_PI) phaseX -= TWO_PI;

    stepBurgers(subDt, viscosity, drift);
  }

  float frameMax = 0.001f;

  for (int y = 0; y < FRAME_H; ++y) {
    const int ym = ym_tab[y];
    const int yp = yp_tab[y];

    const float* __restrict uc_row = &u[y * FRAME_W];
    const float* __restrict vm_row = &v[ym * FRAME_W];
    const float* __restrict vp_row = &v[yp * FRAME_W];
    float* __restrict tr_row = &trail[y * FRAME_W];

    for (int x = 0; x < FRAME_W; ++x) {
      const int xm = xm_tab[x];
      const int xp = xp_tab[x];

      const float du_dx = (uc_row[xp] - uc_row[xm]) * 0.5f;
      const float dv_dy = (vp_row[x] - vm_row[x]) * 0.5f;

      const float negDiv = fmaxf(0.0f, -(du_dx + dv_dy));

      const float tVal = tr_row[x] * persistence + negDiv * 0.3f;
      tr_row[x] = tVal;
      if (tVal > frameMax) {
        frameMax = tVal;
      }
    }
  }

  emaPeak = emaPeak * 0.95f + frameMax * 0.05f;

  for (int i = 0; i < 4; ++i) {
    if (input.btnPressed[i] && !input.paramAbsoluteActive[i] && !input.knobAudioActive[i]) {
      memset(trail, 0, NUM_PIXELS * sizeof(float));
      break;
    }
  }
}

void draw() {
  PFCanvas::setFrame(FRAME_W, FRAME_H);

  if (!u || !v || !uNext || !vNext || !trail) {
    PFCanvas::present();
    return;
  }

  const float norm = 1.0f / fmaxf(0.0001f, emaPeak);

  for (int y = 0; y < FRAME_H; ++y) {
    const float* __restrict tr_row = &trail[y * FRAME_W];
    for (int x = 0; x < FRAME_W; ++x) {
      float val = fminf(1.0f, tr_row[x] * norm);
      if (val < 0.0f) val = 0.0f;
      val = val * val * (3.0f - 2.0f * val);

      int li = (int)(val * 255.0f + 0.5f);
      if (li < 0) li = 0;
      if (li > 255) li = 255;

      PFCanvas::setPixel(x, y, RAMP_LUT[li][0], RAMP_LUT[li][1], RAMP_LUT[li][2]);
    }
  }

  PFCanvas::present();
}

} // namespace BurgersShockWeb