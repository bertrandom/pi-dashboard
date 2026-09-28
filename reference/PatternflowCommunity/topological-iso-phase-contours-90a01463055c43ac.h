#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_params.h"
#include "src/core_math.h"
#include "src/core_mem.h"

namespace TopologicalIsoPhaseContours {

const char* NAME = "Iso-Phase";
const char* const KNOB_LABELS[4] = {"Drive", "Damping", "Density", "Ribbons"};
constexpr bool ABSOLUTE_READY = true;

constexpr int FRAME_W = 64;
constexpr int FRAME_H = 128;
constexpr int TOTAL_PIXELS = FRAME_W * FRAME_H;

static float* phi = nullptr;
static float* phiOld = nullptr;

static float t = 0.0f;
static float drive = 0.15f;
static float damping = 0.1f;
static float density = 4.0f;
static float ribbon = 0.9f;

static uint32_t rng_state = 5519213u;

static const uint8_t RAMP_LUT[256][3] = {
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{1,1,1},{1,1,1},
  {1,1,1},{1,1,1},{1,1,1},{1,1,1},{2,2,2},{2,2,2},{2,2,2},{2,2,2},
  {3,3,3},{3,3,3},{3,3,3},{4,4,4},{4,4,4},{5,5,5},{5,5,5},{6,6,6},
  {7,7,7},{7,7,7},{8,8,8},{9,9,9},{9,9,9},{10,10,10},{11,11,11},{12,12,12},
  {13,13,13},{13,13,13},{14,14,14},{15,15,15},{16,16,16},{17,17,17},{18,18,18},{18,18,18},
  {19,19,19},{20,20,20},{21,21,21},{22,22,22},{23,23,23},{24,24,24},{25,25,25},{26,26,26},
  {26,26,26},{27,27,27},{28,28,28},{29,29,29},{30,30,30},{31,31,31},{32,32,32},{33,33,33},
  {34,34,34},{35,35,35},{36,36,36},{37,37,37},{38,38,38},{38,38,38},{39,39,39},{40,40,40},
  {41,41,41},{42,42,42},{43,43,43},{44,44,44},{45,45,45},{46,46,46},{47,47,47},{48,48,48},
  {49,49,49},{50,50,50},{51,51,51},{52,52,52},{53,53,53},{54,54,54},{55,55,55},{56,56,56},
  {57,57,57},{58,58,58},{59,59,59},{60,60,60},{61,61,61},{62,62,62},{63,63,63},{64,64,64},
  {65,65,65},{66,66,66},{67,67,67},{68,68,68},{69,69,69},{71,71,71},{72,72,72},{73,73,73},
  {74,74,74},{75,75,75},{76,76,76},{77,77,77},{78,78,78},{79,79,79},{80,80,80},{81,81,81},
  {82,82,82},{83,83,83},{84,84,84},{85,85,85},{86,86,86},{88,88,88},{89,89,89},{90,90,90},
  {91,91,91},{92,92,92},{93,93,93},{94,94,94},{95,95,95},{96,96,96},{97,97,97},{99,99,99},
  {100,100,100},{101,101,101},{102,102,102},{103,103,103},{104,104,104},{105,105,105},{106,106,106},{107,107,107},
  {109,109,109},{110,110,110},{111,111,111},{112,112,112},{113,113,113},{114,114,114},{115,115,115},{117,117,117},
  {118,118,118},{119,119,119},{120,120,120},{121,121,121},{122,122,122},{123,123,123},{125,125,125},{126,126,126},
  {127,127,127},{128,128,128},{129,129,129},{130,130,130},{132,132,132},{133,133,133},{134,134,134},{135,135,135},
  {136,136,136},{137,137,137},{139,139,139},{140,140,140},{141,141,141},{142,142,142},{143,143,143},{144,144,144},
  {146,146,146},{147,147,147},{148,148,148},{149,149,149},{150,150,150},{152,152,152},{153,153,153},{154,154,154},
  {155,155,155},{156,156,156},{158,158,158},{159,159,159},{160,160,160},{161,161,161},{162,162,162},{164,164,164},
  {165,165,165},{166,166,166},{167,167,167},{169,169,169},{170,170,170},{171,171,171},{172,172,172},{173,173,173},
  {175,175,175},{176,176,176},{177,177,177},{178,178,178},{180,180,180},{181,181,181},{182,182,182},{183,183,183},
  {185,185,185},{186,186,186},{187,187,187},{188,188,188},{190,190,190},{191,191,191},{192,192,192},{193,193,193},
  {195,195,195},{196,196,196},{197,197,197},{198,198,198},{200,200,200},{201,201,201},{202,202,202},{203,203,203},
  {205,205,205},{206,206,206},{207,207,207},{208,208,208},{210,210,210},{211,211,211},{212,212,212},{213,213,213},
  {215,215,215},{216,216,216},{217,217,217},{219,219,219},{220,220,220},{221,221,221},{222,222,222},{224,224,224},
  {225,225,225},{226,226,226},{228,228,228},{229,229,229},{230,230,230},{231,231,231},{233,233,233},{234,234,234},
  {235,235,235},{237,237,237},{238,238,238},{239,239,239},{241,241,241},{242,242,242},{243,243,243},{244,244,244},
  {246,246,246},{247,247,247},{248,248,248},{250,250,250},{251,251,251},{252,252,252},{254,254,254},{255,255,255},
};

static void reseed() {
  rng_state = 5519213u;
  for (int y = 0; y < FRAME_H; y++) {
    float v = ((float)y / (float)FRAME_H) * (PI * 6.0f);
    int yOff = y * FRAME_W;
    for (int x = 0; x < FRAME_W; x++) {
      float u = ((float)x / (float)FRAME_W) * (PI * 3.0f);
      rng_state = (rng_state * 1664525u + 1013904223u);
      float randVal = (float)(rng_state & 0xffff) / 65536.0f;
      float val = sinf(u) * cosf(v) * 3.0f + (randVal - 0.5f) * 0.3f;
      int idx = yOff + x;
      phi[idx] = val;
      phiOld[idx] = val;
    }
  }
}

void setup() {
  PFMath::buildSinLUT();
  if (!phi) phi = PFMem::allocFloats(TOTAL_PIXELS);
  if (!phiOld) phiOld = PFMem::allocFloats(TOTAL_PIXELS);
  if (phi && phiOld) {
    reseed();
  }
}

void update(float dt, const InputFrame& input) {
  if (!phi || !phiOld) return;

  PFParams::apply(input, 0, &drive, 0.15f, 2.0f, 0.039f);
  PFParams::apply(input, 1, &damping, 0.02f, 0.1f, 0.002f);
  PFParams::apply(input, 2, &density, 1.0f, 4.0f, 0.063f);
  PFParams::apply(input, 3, &ribbon, 0.1f, 0.9f, 0.017f);

  if (input.btnPressed[0] && !input.paramAbsoluteActive[0] && !input.knobAudioActive[0]) {
    reseed();
    t = 0.0f;
    return;
  }

  float safeDt = fminf(fmaxf(dt, 0.001f), 0.05f);
  t += safeDt;
  constexpr float T_PERIOD = TWO_PI / 0.33f;
  if (t > T_PERIOD) {
    t -= T_PERIOD;
  }

  constexpr int SUB_STEPS = 3;
  float hdt = safeDt / (float)SUB_STEPS;
  float hdt2 = hdt * hdt;
  float denom = 1.0f / (1.0f + 0.5f * damping * hdt);
  float dampCoeff = 1.0f - 0.5f * damping * hdt;

  float morph = PFMath::fastSin(t * 0.33f) * 0.06f;
  float effDrive = drive + morph;

  for (int s = 0; s < SUB_STEPS; s++) {
    for (int y = 0; y < FRAME_H; y++) {
      int yOff = y * FRAME_W;
      int up = ((y + FRAME_H - 1) % FRAME_H) * FRAME_W;
      int dn = ((y + 1) % FRAME_H) * FRAME_W;

      for (int x = 0; x < FRAME_W; x++) {
        int i = yOff + x;
        int l = yOff + ((x + FRAME_W - 1) % FRAME_W);
        int r = yOff + ((x + 1) % FRAME_W);

        float lap = (phi[l] + phi[r] + phi[up + x] + phi[dn + x] - 4.0f * phi[i]) * 9.5f;
        float sinVal = PFMath::fastSin(phi[i]);
        float accel = lap - sinVal + effDrive;

        float pNext = (2.0f * phi[i] - phiOld[i] * dampCoeff + accel * hdt2) * denom;
        phiOld[i] = phi[i];
        phi[i] = pNext;
      }
    }
  }

  if (!isfinite(phi[0]) || fabsf(phi[0]) > 500.0f) {
    reseed();
  }
}

void draw() {
  PFCanvas::setFrame(FRAME_W, FRAME_H);
  if (!phi || !phiOld) {
    PFCanvas::present();
    return;
  }

  float invWidth = 1.0f / (ribbon * 0.35f + 0.05f);
  float halfDensity = density * 0.5f;

  for (int y = 0; y < FRAME_H; y++) {
    int yOff = y * FRAME_W;
    for (int x = 0; x < FRAME_W; x++) {
      float p = phi[yOff + x];
      float s = PFMath::fastSin(p * halfDensity);
      float band = (s + 1.0f) * 0.5f;

      float norm = (band - 0.5f) * invWidth;
      float v = expf(-norm * norm);
      if (v < 0.0f) v = 0.0f;
      else if (v > 1.0f) v = 1.0f;

      int li = (int)(v * 255.0f + 0.5f);
      PFCanvas::setPixel(x, y, RAMP_LUT[li][0], RAMP_LUT[li][1], RAMP_LUT[li][2]);
    }
  }

  PFCanvas::present();
}

} // namespace TopologicalIsoPhaseContours