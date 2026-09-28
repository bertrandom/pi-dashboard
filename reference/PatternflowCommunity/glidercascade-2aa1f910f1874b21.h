#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_params.h"
#include "src/core_math.h"
#include "src/core_mem.h"

namespace GliderCascade {

const char* NAME = "Glider Cascade";
const char* const KNOB_LABELS[4] = {"Inject", "Speed", "Twist", "Accordion"};
constexpr bool ABSOLUTE_READY = true;

constexpr int FRAME_W = 64;
constexpr int FRAME_H = 128;
constexpr int GRID_CELLS = FRAME_W * FRAME_H;

// Knob states initialized to Pattern Lab defaults
static float kInjection = 0.018f;
static float kSpeed = 12.0f;
static float kSpiralTwist = 1.1606666666666667f;
static float kAccordion = 0.797f;

// Color ramp (stops 0.000:#000000, 0.472:#ff0000, 1.000:#ffffff; mode oklchShort; wrap off)
static const uint8_t RAMP_LUT[256][3] = {
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{1,0,0},
  {1,0,0},{1,0,0},{2,0,0},{3,0,0},{3,0,0},{4,0,0},{5,0,0},{6,0,0},
  {8,0,0},{9,0,0},{11,0,0},{13,0,0},{15,0,0},{16,0,0},{18,0,0},{20,0,0},
  {22,0,0},{24,0,0},{26,0,0},{28,0,0},{29,0,0},{31,0,0},{33,0,0},{35,0,0},
  {37,0,0},{39,0,0},{41,0,0},{43,0,0},{45,0,0},{48,0,0},{50,0,0},{52,0,0},
  {54,0,0},{56,0,0},{58,0,0},{60,0,0},{62,0,0},{65,0,0},{67,0,0},{69,0,0},
  {71,0,0},{73,0,0},{76,0,0},{78,0,0},{80,0,0},{82,0,0},{85,0,0},{87,0,0},
  {89,0,0},{92,0,0},{94,0,0},{96,0,0},{99,0,0},{101,0,0},{103,0,0},{106,0,0},
  {108,0,0},{111,0,0},{113,0,0},{115,0,0},{118,0,0},{120,0,0},{123,0,0},{125,0,0},
  {128,0,0},{130,0,0},{132,0,0},{135,0,0},{137,0,0},{140,0,0},{142,0,0},{145,0,0},
  {147,0,0},{150,0,0},{152,0,0},{155,0,0},{158,0,0},{160,0,0},{163,0,0},{165,0,0},
  {168,0,0},{170,0,0},{173,0,0},{176,0,0},{178,0,0},{181,0,0},{183,0,0},{186,0,0},
  {189,0,0},{191,0,0},{194,0,0},{197,0,0},{199,0,0},{202,0,0},{205,0,0},{207,0,0},
  {210,0,0},{213,0,0},{215,0,0},{218,0,0},{221,0,0},{224,0,0},{226,0,0},{229,0,0},
  {232,0,0},{235,0,0},{237,0,0},{240,0,0},{243,0,0},{246,0,0},{248,0,0},{251,0,0},
  {254,0,0},{255,9,5},{255,21,13},{255,28,19},{255,35,24},{255,40,29},{255,45,33},{255,49,36},
  {255,53,39},{255,56,43},{255,60,45},{255,63,48},{255,66,51},{255,69,54},{255,72,56},{255,75,59},
  {255,77,61},{255,80,63},{255,82,66},{255,85,68},{255,87,70},{255,89,72},{255,91,74},{255,94,76},
  {255,96,78},{255,98,80},{255,100,82},{255,102,84},{255,104,86},{255,106,88},{255,108,90},{255,110,92},
  {255,112,94},{255,113,96},{255,115,98},{255,117,100},{255,119,101},{255,121,103},{255,122,105},{255,124,107},
  {255,126,109},{255,127,110},{255,129,112},{255,131,114},{255,132,116},{255,134,117},{255,136,119},{255,137,121},
  {255,139,122},{255,140,124},{255,142,126},{255,144,128},{255,145,129},{255,147,131},{255,148,132},{255,150,134},
  {255,151,136},{255,153,137},{255,154,139},{255,156,141},{255,157,142},{255,159,144},{255,160,146},{255,161,147},
  {255,163,149},{255,164,150},{255,166,152},{255,167,154},{255,169,155},{255,170,157},{255,171,158},{255,173,160},
  {255,174,161},{255,176,163},{255,177,165},{255,178,166},{255,180,168},{255,181,169},{255,182,171},{255,184,172},
  {255,185,174},{255,186,175},{255,188,177},{255,189,178},{255,190,180},{255,192,181},{255,193,183},{255,194,185},
  {255,196,186},{255,197,188},{255,198,189},{255,200,191},{255,201,192},{255,202,194},{255,204,195},{255,205,197},
  {255,206,198},{255,208,200},{255,209,201},{255,210,203},{255,211,204},{255,213,206},{255,214,207},{255,215,208},
  {255,216,210},{255,218,211},{255,219,213},{255,220,214},{255,222,216},{255,223,217},{255,224,219},{255,225,220},
  {255,227,222},{255,228,223},{255,229,225},{255,230,226},{255,232,228},{255,233,229},{255,234,230},{255,235,232},
  {255,237,233},{255,238,235},{255,239,236},{255,240,238},{255,242,239},{255,243,241},{255,244,242},{255,245,244},
  {255,246,245},{255,248,246},{255,249,248},{255,250,249},{255,251,251},{255,253,252},{255,254,254},{255,255,255},
};

// CA & Ring Buffer State
static uint8_t curRow[FRAME_W];
static uint8_t nextRow[FRAME_W];
static uint8_t bgRow[FRAME_W];
static uint8_t nextBg[FRAME_W];
static float yMap[FRAME_H];

// Framebuffer-scale buffers allocated in PSRAM
static float* typeGridMem = nullptr;
static float* rawGridMem = nullptr;
static uint8_t* typeGrid = nullptr;
static uint8_t* rawGrid = nullptr;

static float stepAccum = 0.0f;
static float animTime = 0.0f;
static int head = 0;
static uint32_t rngState = 123456789;

static const uint8_t RULE_54[8] = {0, 1, 1, 0, 1, 1, 0, 0};

static inline float nextRnd() {
  rngState = (1103515245U * rngState + 12345U) & 0x7fffffffU;
  return (float)rngState / 2147484800.0f;
}

void setup() {
  PFMath::buildSinLUT();

  if (!typeGridMem) {
    typeGridMem = PFMem::allocFloats(GRID_CELLS);
    typeGrid = (uint8_t*)typeGridMem;
  }
  if (!rawGridMem) {
    rawGridMem = PFMem::allocFloats(GRID_CELLS);
    rawGrid = (uint8_t*)rawGridMem;
  }
  if (!typeGrid || !rawGrid) return;

  stepAccum = 0.0f;
  animTime = 0.0f;
  head = 0;
  rngState = 123456789;

  for (int x = 0; x < FRAME_W; ++x) {
    uint8_t val = ((x % 4) == 0) ? 1 : 0;
    bgRow[x] = val;
    curRow[x] = val;
  }

  // Pre-fill history buffer so frame 0 is fully populated
  for (int s = 0; s < 256; ++s) {
    if (nextRnd() < 0.03f) {
      int rx = (int)(nextRnd() * (float)FRAME_W);
      if (rx >= 0 && rx < FRAME_W) {
        curRow[rx] ^= 1;
      }
    }

    for (int x = 0; x < FRAME_W; ++x) {
      uint8_t L = bgRow[(x - 1 + FRAME_W) % FRAME_W];
      uint8_t C = bgRow[x];
      uint8_t R = bgRow[(x + 1) % FRAME_W];
      nextBg[x] = RULE_54[(L << 2) | (C << 1) | R];
    }
    for (int x = 0; x < FRAME_W; ++x) {
      uint8_t L = curRow[(x - 1 + FRAME_W) % FRAME_W];
      uint8_t C = curRow[x];
      uint8_t R = curRow[(x + 1) % FRAME_W];
      nextRow[x] = RULE_54[(L << 2) | (C << 1) | R];
    }
    memcpy(bgRow, nextBg, FRAME_W);
    memcpy(curRow, nextRow, FRAME_W);

    int rowOffset = (s % FRAME_H) * FRAME_W;
    int prevOffset = ((s - 1 + FRAME_H) % FRAME_H) * FRAME_W;

    for (int x = 0; x < FRAME_W; ++x) {
      uint8_t raw = curRow[x];
      uint8_t defect = raw ^ bgRow[x];
      rawGrid[rowOffset + x] = raw;

      if (!defect) {
        typeGrid[rowOffset + x] = 0;
      } else {
        int xL = (x - 1 + FRAME_W) % FRAME_W;
        int xR = (x + 1) % FRAME_W;
        bool prevC = typeGrid[prevOffset + x] > 0;
        bool prevL = typeGrid[prevOffset + xL] > 0;
        bool prevR = typeGrid[prevOffset + xR] > 0;

        if ((prevL && prevR) || (prevC && (prevL || prevR))) {
          typeGrid[rowOffset + x] = 3;
        } else if (prevC && !prevL && !prevR) {
          typeGrid[rowOffset + x] = 2;
        } else {
          typeGrid[rowOffset + x] = 1;
        }
      }
    }
  }
}

void update(float dt, const InputFrame& input) {
  PFParams::apply(input, 0, &kInjection, 0.001f, 0.08f, 0.002f);
  PFParams::apply(input, 1, &kSpeed, 1.0f, 12.0f, 0.229f);
  PFParams::apply(input, 2, &kSpiralTwist, 0.0f, 2.0f, 0.042f);
  PFParams::apply(input, 3, &kAccordion, 0.0f, 0.85f, 0.018f);

  if (!typeGrid || !rawGrid) return;

  float clampedDt = fminf(dt, 0.1f);
  animTime += clampedDt;
  // Period wrapping for sin(1.6 * animTime) -> period = 2*PI / 1.6 = 1.25*PI
  if (animTime >= 20.0f * PI) {
    animTime -= 20.0f * PI;
  }

  // Momentary button 0: Reset with bilateral colliding pair
  if (input.btnPressed[0] && !input.paramAbsoluteActive[0] && !input.knobAudioActive[0]) {
    for (int x = 0; x < FRAME_W; ++x) {
      uint8_t b = ((x % 4) == 0) ? 1 : 0;
      bgRow[x] = b;
      curRow[x] = b;
    }
    curRow[16] ^= 1;
    curRow[48] ^= 1;
    memset(typeGrid, 0, GRID_CELLS);
  }

  float stepsPerSec = kSpeed * 8.0f;
  stepAccum += clampedDt * stepsPerSec;
  int stepsToRun = (int)stepAccum;
  if (stepsToRun > 16) stepsToRun = 16;
  stepAccum -= (float)stepsToRun;

  for (int s = 0; s < stepsToRun; ++s) {
    if (nextRnd() < kInjection) {
      int rx = (nextRnd() < 0.5f) ? (int)(nextRnd() * 8.0f) : (FRAME_W - 1 - (int)(nextRnd() * 8.0f));
      if (rx >= 0 && rx < FRAME_W) {
        curRow[rx] ^= 1;
      }
    }

    // Step unperturbed ether
    for (int x = 0; x < FRAME_W; ++x) {
      uint8_t L = bgRow[(x - 1 + FRAME_W) % FRAME_W];
      uint8_t C = bgRow[x];
      uint8_t R = bgRow[(x + 1) % FRAME_W];
      nextBg[x] = RULE_54[(L << 2) | (C << 1) | R];
    }

    // Step automaton
    for (int x = 0; x < FRAME_W; ++x) {
      uint8_t L = curRow[(x - 1 + FRAME_W) % FRAME_W];
      uint8_t C = curRow[x];
      uint8_t R = curRow[(x + 1) % FRAME_W];
      nextRow[x] = RULE_54[(L << 2) | (C << 1) | R];
    }

    memcpy(bgRow, nextBg, FRAME_W);
    memcpy(curRow, nextRow, FRAME_W);

    int prevHead = head;
    head = (head + 1) % FRAME_H;

    int rowOffset = head * FRAME_W;
    int prevOffset = prevHead * FRAME_W;

    for (int x = 0; x < FRAME_W; ++x) {
      uint8_t raw = curRow[x];
      uint8_t defect = raw ^ bgRow[x];
      rawGrid[rowOffset + x] = raw;

      if (!defect) {
        typeGrid[rowOffset + x] = 0;
      } else {
        int xL = (x - 1 + FRAME_W) % FRAME_W;
        int xR = (x + 1) % FRAME_W;
        bool prevC = typeGrid[prevOffset + x] > 0;
        bool prevL = typeGrid[prevOffset + xL] > 0;
        bool prevR = typeGrid[prevOffset + xR] > 0;

        if ((prevL && prevR) || (prevC && (prevL || prevR))) {
          typeGrid[rowOffset + x] = 3; // Collision Vertex
        } else if (prevC && !prevL && !prevR) {
          typeGrid[rowOffset + x] = 2; // Vertical Breather
        } else {
          typeGrid[rowOffset + x] = 1; // Diagonal Glider Ray
        }
      }
    }
  }
}

void draw() {
  PFCanvas::setFrame(FRAME_W, FRAME_H);

  if (!typeGrid || !rawGrid) {
    PFCanvas::present();
    return;
  }

  float accordionVal = fminf(fmaxf(kAccordion, 0.0f), 0.85f);
  float tPhase = animTime * 1.6f;

  // Build strictly monotonic cumulative mapping
  float accumY = 0.0f;
  for (int y = 0; y < FRAME_H; ++y) {
    float rate = 1.0f + accordionVal * PFMath::fastSin((float)y * 0.05f + tPhase);
    accumY += rate;
    yMap[y] = accumY;
  }
  float totalScale = (float)(FRAME_H - 1) / fmaxf(0.001f, accumY);
  float twistScale = (kSpiralTwist * (float)FRAME_W) / (float)FRAME_H;

  for (int y = 0; y < FRAME_H; ++y) {
    float mappedY = yMap[y] * totalScale;
    int intY = (int)floorf(mappedY);
    int bufY = (((head - intY) % FRAME_H) + FRAME_H) % FRAME_H;
    int rowOffset = bufY * FRAME_W;

    float twistAngle = mappedY * twistScale;
    int intShift = (int)roundf(twistAngle);

    for (int x = 0; x < FRAME_W; ++x) {
      int sampleX = (((x - intShift) % FRAME_W) + FRAME_W) % FRAME_W;

      uint8_t type = typeGrid[rowOffset + sampleX];
      uint8_t raw = rawGrid[rowOffset + sampleX];

      float v = 0.0f;
      if (type == 1) {
        v = 0.46f;
      } else if (type == 2) {
        v = 0.80f;
      } else if (type == 3) {
        v = 1.00f;
      } else if (raw == 1) {
        v = 0.06f;
      }

      int li = (int)(v * 255.0f + 0.5f);
      PFCanvas::setPixel(x, y, RAMP_LUT[li][0], RAMP_LUT[li][1], RAMP_LUT[li][2]);
    }
  }

  PFCanvas::present();
}

} // namespace GliderCascade