#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_params.h"
#include "src/core_math.h"
#include "src/core_color.h"

namespace DiamondBreath {

const char* NAME = "Diamond Breath";
const char* const KNOB_LABELS[4] = {"Zoom", "Breathe", "Hue", "Scroll"};
constexpr bool ABSOLUTE_READY = true;

constexpr int FRAME_W = 64;
constexpr int FRAME_H = 128;

// Recolor ramp lookup table (OKLCH ramp baked to 256 RGB entries)
static const uint8_t RAMP_LUT[256][3] = {
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{1,0,1},{2,1,2},{3,1,5},
  {6,2,8},{9,3,13},{14,5,18},{18,7,24},{23,9,29},{28,12,35},{32,15,40},{37,18,46},
  {42,22,52},{48,25,58},{53,28,64},{58,32,71},{64,35,77},{69,39,84},{75,42,90},{80,46,97},
  {86,49,103},{92,53,110},{97,57,117},{103,60,124},{109,64,131},{115,68,138},{121,72,145},{127,76,152},
  {134,79,159},{140,83,167},{146,87,174},{152,91,182},{159,95,189},{165,100,197},{172,104,204},{178,108,212},
  {185,112,220},{191,116,227},{198,120,235},{205,124,243},{211,129,251},{217,129,253},{220,126,248},{223,122,242},
  {227,118,237},{230,114,231},{233,111,225},{235,107,218},{238,103,211},{241,99,204},{243,96,197},{245,92,190},
  {247,88,182},{249,84,174},{251,80,166},{252,76,158},{254,73,149},{255,69,140},{255,67,131},{255,64,122},
  {255,62,112},{255,59,103},{255,57,92},{255,53,81},{255,50,68},{255,46,53},{255,42,33},{255,43,0},
  {254,60,0},{253,73,0},{252,83,0},{252,92,0},{252,100,0},{252,107,0},{252,114,0},{253,120,0},
  {253,126,0},{254,132,0},{255,137,0},{255,143,4},{255,148,14},{255,154,22},{255,159,29},{255,165,35},
  {255,170,41},{255,175,46},{255,180,52},{255,185,56},{255,190,61},{255,195,66},{255,200,70},{255,205,74},
  {255,209,77},{255,214,80},{255,219,83},{255,223,84},{255,228,84},{255,233,82},{255,238,76},{255,243,61},
  {255,249,0},{247,251,3},{233,250,16},{218,250,29},{203,249,41},{187,248,52},{169,247,63},{151,246,73},
  {130,245,83},{106,243,93},{76,242,102},{18,240,111},{0,234,129},{0,229,142},{0,223,152},{0,218,159},
  {0,213,165},{0,208,169},{0,203,172},{0,198,175},{0,193,177},{0,188,178},{0,183,179},{0,178,180},
  {0,174,181},{0,169,181},{0,164,181},{0,160,181},{0,155,181},{0,150,181},{0,145,181},{0,141,181},
  {0,136,181},{0,131,181},{0,126,182},{0,121,184},{0,115,186},{0,110,189},{0,103,194},{0,95,202},
  {0,82,219},{0,63,245},{0,85,223},{0,96,216},{0,104,212},{0,112,210},{0,118,210},{0,125,210},
  {0,131,211},{0,137,213},{0,143,215},{0,149,216},{0,155,219},{0,160,221},{0,166,223},{0,172,225},
  {0,178,228},{0,184,230},{0,189,233},{0,195,235},{0,201,238},{0,207,240},{0,213,242},{0,219,245},
  {0,225,247},{0,231,249},{0,237,251},{0,243,253},{0,249,254},{15,252,255},{33,252,255},{44,252,255},
  {53,252,255},{61,252,255},{68,253,255},{74,253,255},{80,253,255},{85,253,255},{90,253,255},{94,253,255},
  {99,253,255},{103,253,255},{107,253,255},{111,253,255},{114,253,255},{118,253,255},{122,254,255},{125,254,255},
  {128,254,255},{132,254,255},{135,254,255},{138,254,255},{141,254,255},{144,254,255},{147,254,255},{149,254,255},
  {152,254,255},{155,254,255},{158,254,255},{160,254,255},{163,254,255},{166,254,255},{168,254,255},{171,255,255},
  {173,255,255},{176,255,255},{178,255,255},{180,255,255},{183,255,255},{185,255,255},{187,255,255},{190,255,255},
  {192,255,255},{194,255,255},{196,255,255},{199,255,255},{201,255,255},{203,255,255},{205,255,255},{208,255,255},
  {210,255,255},{212,255,255},{214,255,255},{216,255,255},{218,255,255},{220,255,255},{222,255,255},{224,255,255},
  {226,255,255},{228,255,255},{230,255,255},{232,255,255},{234,255,255},{236,255,255},{238,255,255},{240,255,255},
  {242,255,255},{244,255,255},{246,255,255},{248,255,255},{250,255,255},{251,255,255},{253,255,255},{255,255,255},
};

// Knobs
static float knobZoom = 8.0f;
static float knobBreathe = 2.0f;
static float knobHue = 10.0f;
static float knobScroll = 2.0f;

// Phase accumulator wrapped at TWO_PI
static float timeAngle = 0.0f;

struct ColCoord {
  float abs_fx;
  float abs_fx2;
  float ccx;
  float ccx2;
  float ddx_sq;
  float ddx2_sq;
};

struct RowCoord {
  float abs_fy;
  float abs_fy2;
  float ccy;
  float ccy2;
  float ddy_sq;
  float ddy2_sq;
};

static ColCoord cols[FRAME_W];
static RowCoord rows[FRAME_H];
static float breathL_col[FRAME_W];
static float breathS_col[FRAME_W];

static void hslToRgb(float hDeg, float s, float l, float& outR, float& outG, float& outB) {
  float c = (1.0f - fabsf(2.0f * l - 1.0f)) * s;
  float v = l + 0.5f * c;
  float sv = (v > 1e-6f) ? (c / v) : 0.0f;
  float h01 = PFMath::fract(hDeg * (1.0f / 360.0f));
  if (h01 < 0.0f) h01 += 1.0f;
  uint8_t r8 = 0, g8 = 0, b8 = 0;
  PFColor::hsvToRgb(h01, sv, v, r8, g8, b8);
  outR = (float)r8;
  outG = (float)g8;
  outB = (float)b8;
}

void setup() {
  PFMath::buildSinLUT();
}

void update(float dt, const InputFrame& input) {
  PFParams::apply(input, 0, &knobZoom, 8.0f, 30.0f, 0.458f);
  PFParams::apply(input, 1, &knobBreathe, 0.0f, 3.0f, 0.063f);
  PFParams::apply(input, 2, &knobHue, 0.0f, 360.0f, 7.5f);
  PFParams::apply(input, 3, &knobScroll, -80.0f, 80.0f, 3.333f);

  constexpr float OMEGA = 0.9f;
  timeAngle += dt * OMEGA;
  while (timeAngle >= TWO_PI) timeAngle -= TWO_PI;
  while (timeAngle < 0.0f) timeAngle += TWO_PI;
}

void draw() {
  PFCanvas::setFrame(FRAME_W, FRAME_H);

  float S = knobZoom;
  int mode = (int)knobBreathe;
  if (mode < 0) mode = 0;
  if (mode > 2) mode = 2;
  float scrollY = knobScroll;

  constexpr float FREQ = 0.55f;

  float baseHue = PFMath::jsMod(1.0f + knobHue, 360.0f);
  float fgR, fgG, fgB;
  float bgR, bgG, bgB;
  hslToRgb(baseHue, 0.42f, 0.35f, fgR, fgG, fgB);
  hslToRgb(baseHue + 180.0f, 0.4f, 0.035f, bgR, bgG, bgB);

  float invS = 1.0f / S;
  float invS_freq = invS * FREQ;
  float halfW = fminf(1.2f * invS, 0.045f);
  float halfWs = fminf(1.0f * invS, 0.05f);
  float invHalfW = 1.0f / halfW;
  float invHalfWs = 1.0f / halfWs;

  constexpr float HALF_W_SCREEN = FRAME_W * 0.5f;
  constexpr float HALF_H_SCREEN = FRAME_H * 0.5f;

  // Precompute 1D coordinate terms across width
  for (int x = 0; x < FRAME_W; ++x) {
    float gx = (float)x * invS;
    float cellX = PFMath::floorF(gx);
    cols[x].abs_fx = fabsf((gx - cellX) - 0.5f);

    float gx2 = gx - 0.5f;
    float cellX2 = PFMath::floorF(gx2);
    cols[x].abs_fx2 = fabsf((gx2 - cellX2) - 0.5f);

    float ccx = (cellX + 0.5f) * S;
    float ccx2 = (cellX2 + 0.5f) * S;
    cols[x].ccx = ccx;
    cols[x].ccx2 = ccx2;

    float ddx = ccx - HALF_W_SCREEN;
    float ddx2 = ccx2 - HALF_W_SCREEN;
    cols[x].ddx_sq = ddx * ddx;
    cols[x].ddx2_sq = ddx2 * ddx2;
  }

  // Precompute 1D coordinate terms across height
  for (int y = 0; y < FRAME_H; ++y) {
    float gy = ((float)y + scrollY) * invS;
    float cellY = PFMath::floorF(gy);
    rows[y].abs_fy = fabsf((gy - cellY) - 0.5f);

    float gy2 = gy - 0.5f;
    float cellY2 = PFMath::floorF(gy2);
    rows[y].abs_fy2 = fabsf((gy2 - cellY2) - 0.5f);

    float ccy = (cellY + 0.5f) * S - scrollY;
    float ccy2 = (cellY2 + 0.5f) * S - scrollY;
    rows[y].ccy = ccy;
    rows[y].ccy2 = ccy2;

    float ddy = ccy - HALF_H_SCREEN;
    float ddy2 = ccy2 - HALF_H_SCREEN;
    rows[y].ddy_sq = ddy * ddy;
    rows[y].ddy2_sq = ddy2 * ddy2;
  }

  auto drawCell = [&](int x, int y, float breathL, float breathS, float d1, float d2) {
    // Big diamond: double-outline rings
    float outerR = 0.46f + 0.05f * breathL;
    float innerR = outerR - 0.09f;
    float dOut = fabsf(d1 - outerR);
    float vOut = (dOut < halfW) ? (1.0f - dOut * invHalfW) : 0.0f;
    float dIn = fabsf(d1 - innerR);
    float vIn = (dIn < halfW) ? (1.0f - dIn * invHalfW) : 0.0f;
    float largeVal = (vOut > vIn) ? vOut : vIn;

    // Small diamond stud at crossings
    float rSmall = 0.16f + 0.04f * breathS;
    float dSm = fabsf(d2 - rSmall);
    float smallVal = (dSm < halfWs) ? (1.0f - dSm * invHalfWs) : 0.0f;

    float inten = (largeVal > smallVal) ? largeVal : smallVal;
    if (inten > 1.0f) inten = 1.0f;

    // Soft brightness pulse
    float glow = 0.85f + 0.15f * ((breathL + 1.0f) * 0.5f);
    inten *= glow;
    if (inten > 1.0f) inten = 1.0f;

    float r = bgR + (fgR - bgR) * inten;
    float g = bgG + (fgG - bgG) * inten;
    float b = bgB + (fgB - bgB) * inten;

    int ir = (int)r;
    int ig = (int)g;
    int ib = (int)b;
    int lum = (int)(0.2126f * (float)ir + 0.7152f * (float)ig + 0.0722f * (float)ib + 0.5f);
    if (lum < 0) lum = 0;
    else if (lum > 255) lum = 255;

    PFCanvas::setPixel(x, y, RAMP_LUT[lum][0], RAMP_LUT[lum][1], RAMP_LUT[lum][2]);
  };

  if (mode == 0) {
    // Diagonal wave breathing
    for (int y = 0; y < FRAME_H; ++y) {
      const RowCoord& row = rows[y];
      for (int x = 0; x < FRAME_W; ++x) {
        const ColCoord& col = cols[x];
        float phase = (col.ccx + row.ccy) * invS_freq;
        float phase2 = (col.ccx2 + row.ccy2) * invS_freq;
        float breathL = PFMath::fastSin(timeAngle - phase);
        float breathS = PFMath::fastSin(timeAngle - phase2);
        drawCell(x, y, breathL, breathS, col.abs_fx + row.abs_fy, col.abs_fx2 + row.abs_fy2);
      }
    }
  } else if (mode == 1) {
    // Radial breathing
    for (int y = 0; y < FRAME_H; ++y) {
      const RowCoord& row = rows[y];
      for (int x = 0; x < FRAME_W; ++x) {
        const ColCoord& col = cols[x];
        float phase = sqrtf(col.ddx_sq + row.ddy_sq) * invS_freq;
        float phase2 = sqrtf(col.ddx2_sq + row.ddy2_sq) * invS_freq;
        float breathL = PFMath::fastSin(timeAngle - phase);
        float breathS = PFMath::fastSin(timeAngle - phase2);
        drawCell(x, y, breathL, breathS, col.abs_fx + row.abs_fy, col.abs_fx2 + row.abs_fy2);
      }
    }
  } else {
    // Shifting breathing (left-to-right) — phase is row-independent
    for (int x = 0; x < FRAME_W; ++x) {
      float phase = cols[x].ccx * invS_freq;
      float phase2 = cols[x].ccx2 * invS_freq;
      breathL_col[x] = PFMath::fastSin(timeAngle - phase);
      breathS_col[x] = PFMath::fastSin(timeAngle - phase2);
    }
    for (int y = 0; y < FRAME_H; ++y) {
      const RowCoord& row = rows[y];
      for (int x = 0; x < FRAME_W; ++x) {
        const ColCoord& col = cols[x];
        drawCell(x, y, breathL_col[x], breathS_col[x], col.abs_fx + row.abs_fy, col.abs_fx2 + row.abs_fy2);
      }
    }
  }

  PFCanvas::present();
}

} // namespace DiamondBreath