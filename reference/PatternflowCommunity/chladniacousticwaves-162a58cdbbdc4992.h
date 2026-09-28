#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_math.h"

namespace ChladniAcousticWaves {

constexpr int FRAME_W = 64;
constexpr int FRAME_H = 128;

const char* NAME = "Chladni Waves";
const char* const KNOB_LABELS[4] = {"Mode N", "Mode M", "Speed", "Sharpness"};

// Knob range defaults & steps
// ModeN: min 1, max 11, current 4.584, step 0.208
// ModeM: min 1, max 12, current 10.581, step 0.229
// Speed: min 0.2, max 5, current 2.196, step 0.1
// EdgeSharp: min 1, max 20, current 2.362, step 0.396
static float knobModeN = 4.584f;
static float knobModeM = 10.581f;
static float knobSpeed = 2.196f;
static float knobSharp = 2.362f;

static float timeAcc = 0.0f;

static const uint8_t RAMP_LUT[256][3] = {
  {0,0,0},{0,0,1},{1,0,3},{2,0,5},{3,0,7},{4,0,9},{5,0,11},{5,0,13},
  {6,0,15},{7,0,17},{8,0,19},{9,0,21},{9,0,24},{10,0,26},{11,0,28},{12,0,30},
  {13,0,32},{14,0,34},{14,0,36},{15,0,38},{16,0,40},{17,0,42},{18,0,44},{18,0,46},
  {19,0,48},{20,0,50},{21,0,52},{22,0,54},{23,0,56},{23,0,58},{24,0,60},{25,0,62},
  {26,0,65},{27,0,67},{27,0,69},{28,0,71},{29,0,73},{30,0,75},{31,0,77},{32,0,79},
  {32,0,81},{33,0,83},{34,0,85},{35,0,87},{36,0,89},{36,0,91},{37,0,93},{38,0,95},
  {39,0,97},{40,0,99},{41,0,101},{41,0,103},{42,0,106},{43,0,108},{44,0,110},{45,0,112},
  {45,0,114},{46,0,116},{47,0,118},{48,0,120},{49,0,122},{50,0,124},{50,0,126},{51,0,128},
  {52,0,130},{53,0,132},{54,0,134},{55,0,136},{55,0,138},{56,0,140},{57,0,142},{58,0,144},
  {59,0,146},{59,0,149},{60,0,151},{61,0,153},{62,0,155},{63,0,157},{64,0,159},{64,0,161},
  {65,0,163},{66,0,165},{67,0,167},{68,0,169},{68,0,171},{69,0,173},{70,0,175},{71,0,177},
  {72,0,179},{73,0,181},{73,0,183},{74,0,185},{75,0,187},{76,0,190},{77,0,192},{77,0,194},
  {78,0,196},{79,0,198},{80,0,200},{81,0,202},{82,0,204},{82,0,206},{83,0,208},{84,0,210},
  {85,0,212},{86,0,214},{86,0,216},{87,0,218},{88,0,220},{89,0,222},{90,0,224},{91,0,226},
  {91,0,228},{92,0,231},{93,0,233},{94,0,235},{95,0,237},{95,0,239},{96,0,241},{97,0,243},
  {98,0,245},{99,0,247},{100,0,249},{100,0,251},{101,0,253},{102,0,255},{103,0,253},{104,0,251},
  {106,0,249},{107,0,247},{108,0,245},{109,0,243},{110,0,241},{111,0,239},{113,0,237},{114,0,235},
  {115,0,233},{116,0,231},{117,0,229},{119,0,227},{120,0,225},{121,0,224},{122,0,222},{123,0,220},
  {124,0,218},{126,0,216},{127,0,214},{128,0,212},{129,0,210},{130,0,208},{131,0,206},{133,0,204},
  {134,0,202},{135,0,200},{136,0,198},{137,0,196},{139,0,194},{140,0,192},{141,0,190},{142,0,188},
  {143,0,186},{144,0,184},{146,0,182},{147,0,180},{148,0,178},{149,0,176},{150,0,175},{151,0,173},
  {153,0,171},{154,0,169},{155,0,167},{156,0,165},{157,0,163},{159,0,161},{160,0,159},{161,0,157},
  {162,0,155},{163,0,153},{164,0,151},{166,0,149},{167,0,147},{168,0,145},{169,0,143},{170,0,141},
  {171,0,139},{173,0,137},{174,0,135},{175,0,133},{176,0,131},{177,0,129},{179,0,127},{180,0,125},
  {181,0,124},{182,0,122},{183,0,120},{184,0,118},{186,0,116},{187,0,114},{188,0,112},{189,0,110},
  {190,0,108},{191,0,106},{193,0,104},{194,0,102},{195,0,100},{196,0,98},{197,0,96},{199,0,94},
  {200,0,92},{201,0,90},{202,0,88},{203,0,86},{204,0,84},{206,0,82},{207,0,80},{208,0,78},
  {209,0,76},{210,0,75},{211,0,73},{213,0,71},{214,0,69},{215,0,67},{216,0,65},{217,0,63},
  {219,0,61},{220,0,59},{221,0,57},{222,0,55},{223,0,53},{224,0,51},{226,0,49},{227,0,47},
  {228,0,45},{229,0,43},{230,0,41},{231,0,39},{233,0,37},{234,0,35},{235,0,33},{236,0,31},
  {237,0,29},{239,0,27},{240,0,25},{241,0,24},{242,0,22},{243,0,20},{244,0,18},{246,0,16},
  {247,0,14},{248,0,12},{249,0,10},{250,0,8},{251,0,6},{253,0,4},{254,0,2},{255,0,0},
};

void setup() {
  PFMath::buildSinLUT();
}

void update(float dt, const InputFrame& input) {
  knobModeN = fminf(11.0f, fmaxf(1.0f, knobModeN + input.knobDeltas[0] * 0.208f));
  knobModeM = fminf(12.0f, fmaxf(1.0f, knobModeM + input.knobDeltas[1] * 0.229f));
  knobSpeed = fminf(5.0f, fmaxf(0.2f, knobSpeed + input.knobDeltas[2] * 0.1f));
  knobSharp = fminf(20.0f, fmaxf(1.0f, knobSharp + input.knobDeltas[3] * 0.396f));

  timeAcc += dt * knobSpeed;
  // Multipliers in trig calls are 1.0 and 0.8 -> common period 10 * TWO_PI (5 * TWO_PI / 0.8)
  constexpr float PERIOD = 10.0f * TWO_PI;
  if (timeAcc >= PERIOD) {
    timeAcc -= PERIOD;
  }
}

void draw() {
  PFCanvas::setFrame(FRAME_W, FRAME_H);

  const float nMod = knobModeN + PFMath::fastSin(timeAcc) * 0.5f;
  const float mMod = knobModeM + PFMath::fastCos(timeAcc * 0.8f) * 0.5f;
  const float sharp = knobSharp;

  const float nPi = nMod * PI;
  const float mPi = mMod * PI;

  constexpr float INV_W = 2.0f / (float)FRAME_W;
  constexpr float INV_H = 2.0f / (float)FRAME_H;

  for (int y = 0; y < FRAME_H; y++) {
    const float ny = ((float)y * INV_H) - 1.0f;
    const float cos_mPi_ny = PFMath::fastCos(mPi * ny);
    const float cos_nPi_ny = PFMath::fastCos(nPi * ny);

    for (int x = 0; x < FRAME_W; x++) {
      const float nx = ((float)x * INV_W) - 1.0f;

      const float cos_nPi_nx = PFMath::fastCos(nPi * nx);
      const float cos_mPi_nx = PFMath::fastCos(mPi * nx);

      const float chladni = (cos_nPi_nx * cos_mPi_ny) - (cos_mPi_nx * cos_nPi_ny);
      const float nodeLine = expf(-fabsf(chladni) * sharp);

      const float v = fminf(1.0f, fmaxf(0.0f, nodeLine));
      const int li = (int)(v * 255.0f + 0.5f);

      PFCanvas::setPixel(x, y, RAMP_LUT[li][0], RAMP_LUT[li][1], RAMP_LUT[li][2]);
    }
  }

  PFCanvas::present();
}

} // namespace ChladniAcousticWaves