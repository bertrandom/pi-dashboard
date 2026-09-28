#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_params.h"
#include "src/core_math.h"

namespace Launching {

const char* NAME = "Launching";
const char* const KNOB_LABELS[4] = {"Rows", "Size", "Angle", "Warp"};
constexpr bool ABSOLUTE_READY = true;

constexpr int FRAME_W = 64;
constexpr int FRAME_H = 128;

constexpr float FIXED_SPEED = 5.0f;
constexpr float BASE_MULTIPLIER = 7.0f;

// Knobs: Rows=1..12, Size=0..3, Angle=-90..90, Warp=0..12
static float knobRows = 1.0f;
static float knobSize = 1.133f;
static float knobAngle = 10.0f;
static float knobWarp = 0.0f;

constexpr float KNOB_STEP_ROWS = 0.229f;
constexpr float KNOB_STEP_SIZE = 0.063f;
constexpr float KNOB_STEP_ANGLE = 3.75f;
constexpr float KNOB_STEP_WARP = 0.25f;

static float baseTime = 0.0f;
static float angleOffset = 0.0f;
static float animTime = 0.0f;

static const char TEXT[] = "Patternflow is live!   ";
constexpr int TEXT_LEN = 23;

static const uint8_t FONT[15][7] = {
  {0x0e, 0x11, 0x11, 0x0e, 0x10, 0x10, 0x10}, // 'P' (0)
  {0x00, 0x00, 0x0e, 0x01, 0x0f, 0x11, 0x0e}, // 'a' (1)
  {0x04, 0x0e, 0x04, 0x04, 0x04, 0x04, 0x02}, // 't' (2)
  {0x00, 0x00, 0x0e, 0x11, 0x1e, 0x10, 0x0e}, // 'e' (3)
  {0x00, 0x00, 0x16, 0x19, 0x10, 0x10, 0x10}, // 'r' (4)
  {0x00, 0x00, 0x16, 0x19, 0x11, 0x11, 0x11}, // 'n' (5)
  {0x06, 0x09, 0x08, 0x1c, 0x08, 0x08, 0x08}, // 'f' (6)
  {0x0c, 0x04, 0x04, 0x04, 0x04, 0x04, 0x02}, // 'l' (7)
  {0x00, 0x00, 0x0e, 0x11, 0x11, 0x11, 0x0e}, // 'o' (8)
  {0x00, 0x00, 0x11, 0x11, 0x15, 0x15, 0x0a}, // 'w' (9)
  {0x04, 0x00, 0x0c, 0x04, 0x04, 0x04, 0x0e}, // 'i' (10)
  {0x00, 0x00, 0x0e, 0x10, 0x0e, 0x01, 0x1e}, // 's' (11)
  {0x00, 0x00, 0x11, 0x11, 0x11, 0x0a, 0x04}, // 'v' (12)
  {0x04, 0x04, 0x04, 0x04, 0x00, 0x00, 0x04}, // '!' (13)
  {0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00}  // ' ' (14)
};

static uint8_t charToFontIndex(char c) {
  switch (c) {
    case 'P': return 0;
    case 'a': return 1;
    case 't': return 2;
    case 'e': return 3;
    case 'r': return 4;
    case 'n': return 5;
    case 'f': return 6;
    case 'l': return 7;
    case 'o': return 8;
    case 'w': return 9;
    case 'i': return 10;
    case 's': return 11;
    case 'v': return 12;
    case '!': return 13;
    default:  return 14;
  }
}

static const float ROW_WEIGHTS[9] = {1.1f, 0.8f, 1.5f, 0.9f, 1.4f, 1.2f, 1.6f, 1.0f, 1.3f};

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
  {248,248,248},{249,249,249},{250,250,250},{251,251,251},{252,252,252},{253,253,253},{254,254,254},{255,255,255}
};

static uint8_t sampleScaledChar(float px, int py, int scale) {
  int scaledH = 7 * scale;
  if (py < 0 || py >= scaledH) return 0;
  int slotW = 6 * scale;
  int loopWidth = TEXT_LEN * slotW;
  
  int ipx = (int)floorf(px);
  int nx = ipx % loopWidth;
  if (nx < 0) nx += loopWidth;

  int charIdx = nx / slotW;
  int lx = (nx % slotW) / scale;
  int ly = py / scale;

  if (lx >= 5 || ly >= 7 || charIdx >= TEXT_LEN) return 0;
  uint8_t fontIdx = charToFontIndex(TEXT[charIdx]);
  return (FONT[fontIdx][ly] >> (4 - lx)) & 1;
}

void setup() {
  PFMath::buildSinLUT();
}

void update(float dt, const InputFrame& input) {
  baseTime += dt * FIXED_SPEED;
  constexpr float BASE_PERIOD = 55440.0f;
  if (baseTime >= BASE_PERIOD) {
    baseTime -= BASE_PERIOD;
  }

  animTime += dt;
  if (animTime >= TWO_PI) {
    animTime -= TWO_PI;
  }

  PFParams::apply(input, 0, &knobRows, 1.0f, 12.0f, KNOB_STEP_ROWS);
  PFParams::apply(input, 1, &knobSize, 0.0f, 3.0f, KNOB_STEP_SIZE);
  PFParams::apply(input, 2, &knobAngle, -90.0f, 90.0f, KNOB_STEP_ANGLE);
  PFParams::apply(input, 3, &knobWarp, 0.0f, 12.0f, KNOB_STEP_WARP);

  if (input.btnPressed[2] && !input.paramAbsoluteActive[2] && !input.knobAudioActive[2]) {
    angleOffset = -knobAngle;
  }
}

void draw() {
  PFCanvas::setFrame(FRAME_W, FRAME_H);

  int scale = (int)floorf(knobSize);
  if (scale <= 0) {
    for (int y = 0; y < FRAME_H; ++y) {
      for (int x = 0; x < FRAME_W; ++x) {
        PFCanvas::setPixel(x, y, RAMP_LUT[0][0], RAMP_LUT[0][1], RAMP_LUT[0][2]);
      }
    }
    PFCanvas::present();
    return;
  }

  int numRows = (int)floorf(knobRows);
  if (numRows < 1) numRows = 1;
  if (numRows > 12) numRows = 12;

  float rowHeight = (float)FRAME_H / (float)numRows;
  float currentDeg = knobAngle + angleOffset;
  float rad = (currentDeg * PI) / 180.0f;
  float cosA = PFMath::fastCos(rad);
  float sinA = PFMath::fastSin(rad);

  float cx = (float)FRAME_W * 0.5f;
  float cy = (float)FRAME_H * 0.5f;
  float warpAmp = knobWarp;
  float time3 = animTime * 3.0f;
  int textTopOffset = (int)floorf((rowHeight - 7.0f * (float)scale) * 0.5f);

  for (int y = 0; y < FRAME_H; ++y) {
    float dy = (float)y - cy;
    for (int x = 0; x < FRAME_W; ++x) {
      float dx = (float)x - cx;
      float rx = dx * cosA - dy * sinA + cx;
      float ry = dx * sinA + dy * cosA + cy;

      float waveY = PFMath::fastSin(rx * 0.08f + time3) * warpAmp;
      float finalRy = ry + waveY;

      int rowIdx = (int)floorf(finalRy / rowHeight);
      float localYF = finalRy - floorf(finalRy / rowHeight) * rowHeight;
      int localY = (int)floorf(localYF);
      int textY = localY - textTopOffset;

      int weightIdx = (rowIdx % 9 + 9) % 9;
      float weight = ROW_WEIGHTS[weightIdx];
      float scroll = baseTime * BASE_MULTIPLIER * weight;

      uint8_t isSet = sampleScaledChar(rx + scroll, textY, scale);
      int li = isSet ? 255 : 0;
      PFCanvas::setPixel(x, y, RAMP_LUT[li][0], RAMP_LUT[li][1], RAMP_LUT[li][2]);
    }
  }

  PFCanvas::present();
}

} // namespace Launching