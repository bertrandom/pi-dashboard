#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_math.h"

namespace LedSpiralWave {

const char* NAME = "LedSpiralWave";
const char* const KNOB_LABELS[4] = {"Spiral", "Speed", "Zoom", "Turbulence"};

constexpr int FRAME_W = 64;
constexpr int FRAME_H = 128;

// Knob parameters
static float spiralKnob = 11.988f;
static float speedKnob = 5.0f;
static float zoomKnob = 1.083f;
static float turbKnob = 1.303f;

constexpr float SPIRAL_MIN = 1.0f;
constexpr float SPIRAL_MAX = 15.0f;
constexpr float SPIRAL_STEP = 0.292f;

constexpr float SPEED_MIN = 0.2f;
constexpr float SPEED_MAX = 5.0f;
constexpr float SPEED_STEP = 0.1f;

constexpr float ZOOM_MIN = 0.4f;
constexpr float ZOOM_MAX = 3.0f;
constexpr float ZOOM_STEP = 0.054f;

constexpr float TURB_MIN = 0.0f;
constexpr float TURB_MAX = 2.0f;
constexpr float TURB_STEP = 0.042f;

// Time accumulator
static float angle = 0.0f;

// Color ramp LUT — baked, do not modify
static const uint8_t RAMP_LUT[256][3] = {
  {0,0,0},{1,1,1},{2,2,2},{3,3,3},{4,4,4},{5,5,5},{6,6,6},{7,7,7},
  {8,8,8},{9,9,9},{10,10,10},{11,11,11},{12,12,12},{13,13,13},{14,14,14},{15,15,15},
  {16,16,16},{17,17,17},{18,18,18},{19,19,19},{20,20,20},{21,21,21},{22,22,22},{23,23,23},
  {24,24,24},{25,25,25},{26,26,26},{27,27,27},{28,28,28},{29,29,29},{30,30,30},{31,31,31},
  {32,32,32},{33,33,33},{34,34,34},{35,35,35},{36,36,36},{37,37,37},{38,38,38},{39,39,39},
  {40,40,40},{41,41,41},{42,42,42},{43,43,43},{44,44,44},{45,45,45},{46,46,46},{47,47,47},
  {48,48,48},{49,49,49},{50,50,50},{51,51,51},{52,52,52},{53,53,53},{54,54,54},{55,55,55},
  {56,56,56},{57,57,57},{58,58,58},{59,59,59},{60,60,60},{61,61,61},{62,62,62},{63,63,63},
  {64,64,64},{65,65,65},{66,66,66},{67,67,67},{68,68,68},{69,69,69},{70,70,70},{71,71,71},
  {72,72,72},{73,73,73},{74,74,74},{75,75,75},{76,76,76},{77,77,77},{78,78,78},{79,79,79},
  {80,80,80},{81,81,81},{82,82,82},{83,83,83},{84,84,84},{85,85,85},{86,86,86},{87,87,87},
  {88,88,88},{89,89,89},{90,90,90},{91,91,91},{92,92,92},{93,93,93},{94,94,94},{95,95,95},
  {96,96,96},{97,97,97},{98,98,98},{99,99,99},{100,100,100},{101,101,101},{102,102,102},{103,103,103},
  {104,104,104},{105,105,105},{106,106,106},{107,107,107},{108,108,108},{109,109,109},{110,110,110},{111,111,111},
  {112,112,112},{113,113,113},{114,114,114},{115,115,115},{116,116,116},{117,117,117},{118,118,118},{119,119,119},
  {120,120,120},{121,121,121},{122,122,122},{123,123,123},{124,124,124},{125,125,125},{126,126,126},{127,127,127},
  {128,128,128},{129,129,129},{130,130,130},{131,131,131},{132,132,132},{133,133,133},{134,134,134},{135,135,135},
  {136,136,136},{137,137,137},{138,138,138},{139,139,139},{140,140,140},{141,141,141},{142,142,142},{143,143,143},
  {144,144,144},{145,145,145},{146,146,146},{147,147,147},{148,148,148},{149,149,149},{150,150,150},{151,151,151},
  {152,152,152},{153,153,153},{154,154,154},{155,155,155},{156,156,156},{157,157,157},{158,158,158},{159,159,159},
  {160,160,160},{161,161,161},{162,162,162},{163,163,163},{164,164,164},{165,165,165},{166,166,166},{167,167,167},
  {168,168,168},{169,169,169},{170,170,170},{171,171,171},{172,172,172},{173,173,173},{174,174,174},{175,175,175},
  {176,176,176},{177,177,177},{178,178,178},{179,179,179},{180,180,180},{181,181,181},{182,182,182},{183,183,183},
  {184,184,184},{185,185,185},{186,186,186},{187,187,187},{188,188,188},{189,189,189},{190,190,190},{191,191,191},
  {192,192,192},{193,193,193},{194,194,194},{195,195,195},{196,196,196},{197,197,197},{198,198,198},{199,199,199},
  {200,200,200},{201,201,201},{202,202,202},{203,203,203},{204,204,204},{205,205,205},{206,206,206},{207,207,207},
  {208,208,208},{209,209,209},{210,210,210},{211,211,211},{212,212,212},{213,213,213},{214,214,214},{215,215,215},
  {216,216,216},{217,217,217},{218,218,218},{219,219,219},{220,220,220},{221,221,221},{222,222,222},{223,223,223},
  {224,224,224},{225,225,225},{226,226,226},{227,227,227},{228,228,228},{229,229,229},{230,230,230},{231,231,231},
  {232,232,232},{233,233,233},{234,234,234},{235,235,235},{236,236,236},{237,237,237},{238,238,238},{239,239,239},
  {240,240,240},{241,241,241},{242,242,242},{243,243,243},{244,244,244},{245,245,245},{246,246,246},{247,247,247},
  {248,248,248},{249,249,249},{250,250,250},{251,251,251},{252,252,252},{253,253,253},{254,254,254},{255,255,255},
};

void setup() {
  PFMath::buildSinLUT();
}

void update(float dt, const InputFrame& input) {
  spiralKnob += input.knobDeltas[0] * SPIRAL_STEP;
  if (spiralKnob < SPIRAL_MIN) spiralKnob = SPIRAL_MIN;
  if (spiralKnob > SPIRAL_MAX) spiralKnob = SPIRAL_MAX;

  speedKnob += input.knobDeltas[1] * SPEED_STEP;
  if (speedKnob < SPEED_MIN) speedKnob = SPEED_MIN;
  if (speedKnob > SPEED_MAX) speedKnob = SPEED_MAX;

  zoomKnob += input.knobDeltas[2] * ZOOM_STEP;
  if (zoomKnob < ZOOM_MIN) zoomKnob = ZOOM_MIN;
  if (zoomKnob > ZOOM_MAX) zoomKnob = ZOOM_MAX;

  turbKnob += input.knobDeltas[3] * TURB_STEP;
  if (turbKnob < TURB_MIN) turbKnob = TURB_MIN;
  if (turbKnob > TURB_MAX) turbKnob = TURB_MAX;

  angle += dt * speedKnob;
  // Wrap at TWO_PI — used with integer multipliers (arms, 4, 8, 10, 6) so TWO_PI is sufficient
  if (angle > TWO_PI) angle -= TWO_PI;
  if (angle < 0.0f) angle += TWO_PI;
}

void draw() {
  PFCanvas::setFrame(FRAME_W, FRAME_H);

  const float arms = spiralKnob;
  const float zoom = zoomKnob;
  const float turb = turbKnob;
  const float a = angle;
  const float halfW = FRAME_W * 0.5f;
  const float halfH = FRAME_H * 0.5f;

  for (int y = 0; y < FRAME_H; y++) {
    const float ny = (static_cast<float>(y) / FRAME_H - 0.5f) * 2.0f * zoom;
    for (int x = 0; x < FRAME_W; x++) {
      const float nx = (static_cast<float>(x) / FRAME_W - 0.5f) * 1.0f * zoom;

      float r = sqrtf(nx * nx + ny * ny);
      float theta = PFMath::fastAtan2(ny, nx);

      // Domain remapping / warping
      r += PFMath::fastSin(theta * 4.0f + a) * 0.1f * turb;
      theta += PFMath::fastSin(r * 8.0f - a) * 0.2f * turb;

      // Spiral wave synthesis
      const float wave1 = PFMath::fastSin(theta * arms + r * 10.0f - a * 2.0f);
      const float wave2 = PFMath::fastCos(theta * arms - r * 6.0f + a);

      const float amp = sqrtf(wave1 * wave1 + wave2 * wave2);
      const float phase = PFMath::fastAtan2(wave2, wave1);

      // Contrast and core mapping
      float v = (PFMath::fastSin(phase) * 0.5f + 0.5f) * fminf(1.0f, r * 2.0f);
      v *= fminf(1.0f, amp);

      // Clamp to 0..1
      if (v < 0.0f) v = 0.0f;
      if (v > 1.0f) v = 1.0f;

      const int li = (int)(v * 255.0f + 0.5f);
      PFCanvas::setPixel(x, y, RAMP_LUT[li][0], RAMP_LUT[li][1], RAMP_LUT[li][2]);
    }
  }

  PFCanvas::present();
}

} // namespace LedSpiralWave