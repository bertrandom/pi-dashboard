#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_math.h"
#include "src/core_color.h"
#include "src/core_mem.h"

namespace GameOfLifePattern {

const char* NAME = "Conway's Life";
const char* const KNOB_LABELS[4] = {"Speed", "Hue/Color", "Mutation", "Fade"};

// ---- Knob ranges (Pattern Lab authoritative ranges, positional by index) ----
static const float GOL_KNOB0_MIN = 0.0f;
static const float GOL_KNOB0_MAX = 10.0f;
static const float GOL_KNOB0_STEP = 0.05f;
static const float GOL_KNOB0_DEFAULT = 0.5f;

static const float GOL_KNOB1_MIN = 0.1f;
static const float GOL_KNOB1_MAX = 10.0f;
static const float GOL_KNOB1_STEP = 0.1f;
static const float GOL_KNOB1_DEFAULT = 1.99f;

static const float GOL_KNOB2_MIN = 0.1f;
static const float GOL_KNOB2_MAX = 4.9f;
static const float GOL_KNOB2_STEP = 0.05f;
static const float GOL_KNOB2_DEFAULT = 0.34f;

static const float GOL_KNOB3_MIN = 0.0f;
static const float GOL_KNOB3_MAX = 1.0f;
static const float GOL_KNOB3_STEP = 0.05f;
static const float GOL_KNOB3_DEFAULT = 0.034f;

static const int GOL_COLOR_MODE_COUNT = 3; // 0 rainbow drift, 1 age-based, 2 solid
static const int GOL_MAX_CATCHUP_STEPS = 3;

// ---- Per-pixel buffers (PSRAM-first pointers, never static arrays) ----
static float* golCells = nullptr;
static float* golNextCells = nullptr;
static float* golBrightness = nullptr;
static float* golCellHue = nullptr;

// ---- Small scalar state ----
static float golKnobParam[4] = {GOL_KNOB0_DEFAULT, GOL_KNOB1_DEFAULT, GOL_KNOB2_DEFAULT, GOL_KNOB3_DEFAULT};
static float golHue = 0.0f;
static float golGenTimer = 0.0f;
static float golGenInterval = 0.1f;
static float golMutationChance = 0.0f;
static float golFadeFactor = 0.0f;
static int golColorMode = 0;
static bool golPaused = false;
static bool golWrapEdges = true;
static bool golPrevBtn1 = false;
static bool golPrevBtn2 = false;
static bool golPrevBtn3 = false;
static uint32_t golRngState = 0x9E3779B9;

static inline float golRandom01() {
  golRngState ^= golRngState << 13;
  golRngState ^= golRngState >> 17;
  golRngState ^= golRngState << 5;
  return (golRngState & 0xFFFFFF) / (float)0xFFFFFF;
}

static void golReseed() {
  if (!golCells || !golNextCells || !golBrightness || !golCellHue) return;
  const int count = PANEL_RES_W * PANEL_RES_H;
  for (int i = 0; i < count; i++) {
    const bool alive = golRandom01() < 0.35f;
    golCells[i] = alive ? 1.0f : 0.0f;
    golNextCells[i] = 0.0f;
    golBrightness[i] = alive ? 1.0f : 0.0f;
    golCellHue[i] = golRandom01();
  }
}

// Wrap-edge (torus) path: no boundary masks needed, pure additions.
static void golStepGenerationWrap() {
  const int w = PANEL_RES_W;
  const int h = PANEL_RES_H;
  const bool doMutate = golMutationChance > 0.0f;

  for (int y = 0; y < h; y++) {
    int ny0 = y - 1; if (ny0 < 0) ny0 = h - 1;
    int ny2 = y + 1; if (ny2 >= h) ny2 = 0;
    const int row0 = ny0 * w;
    const int row1 = y * w;
    const int row2 = ny2 * w;

    for (int x = 0; x < w; x++) {
      int nx0 = x - 1; if (nx0 < 0) nx0 = w - 1;
      int nx2 = x + 1; if (nx2 >= w) nx2 = 0;

      const float n =
          golCells[row0 + nx0] + golCells[row0 + x] + golCells[row0 + nx2] +
          golCells[row1 + nx0]                      + golCells[row1 + nx2] +
          golCells[row2 + nx0] + golCells[row2 + x] + golCells[row2 + nx2];

      const int idx = row1 + x;
      const bool wasAlive = (golCells[idx] == 1.0f);
      int next;
      if (wasAlive) {
        next = (n == 2.0f || n == 3.0f) ? 1 : 0;
      } else {
        next = (n == 3.0f) ? 1 : 0;
        if (next == 0 && doMutate && golRandom01() < golMutationChance) next = 1;
      }
      golNextCells[idx] = (float)next;

      if (next == 1 && !wasAlive) {
        golCellHue[idx] = golRandom01();
      }

      if (next == 1) {
        golBrightness[idx] = 1.0f;
      } else if (golFadeFactor <= 0.0f) {
        golBrightness[idx] = 0.0f;
      } else {
        float br = golBrightness[idx] * golFadeFactor;
        if (br < 0.02f) br = 0.0f;
        golBrightness[idx] = br;
      }
    }
  }

  float* tmp = golCells;
  golCells = golNextCells;
  golNextCells = tmp;
}

// Bounded-edge path: dead border, masks still needed.
static void golStepGenerationBounded() {
  const int w = PANEL_RES_W;
  const int h = PANEL_RES_H;
  const bool doMutate = golMutationChance > 0.0f;

  for (int y = 0; y < h; y++) {
    int ny0 = y - 1; if (ny0 < 0) ny0 = h - 1;
    int ny2 = y + 1; if (ny2 >= h) ny2 = 0;
    const int row0 = ny0 * w;
    const int row1 = y * w;
    const int row2 = ny2 * w;
    const int topMask = (y > 0) ? 1 : 0;
    const int bottomMask = (y < h - 1) ? 1 : 0;

    for (int x = 0; x < w; x++) {
      int nx0 = x - 1; if (nx0 < 0) nx0 = w - 1;
      int nx2 = x + 1; if (nx2 >= w) nx2 = 0;
      const int leftMask = (x > 0) ? 1 : 0;
      const int rightMask = (x < w - 1) ? 1 : 0;

      const float n =
          golCells[row0 + nx0] * topMask * leftMask +
          golCells[row0 + x] * topMask +
          golCells[row0 + nx2] * topMask * rightMask +
          golCells[row1 + nx0] * leftMask +
          golCells[row1 + nx2] * rightMask +
          golCells[row2 + nx0] * bottomMask * leftMask +
          golCells[row2 + x] * bottomMask +
          golCells[row2 + nx2] * bottomMask * rightMask;

      const int idx = row1 + x;
      const bool wasAlive = (golCells[idx] == 1.0f);
      int next;
      if (wasAlive) {
        next = (n == 2.0f || n == 3.0f) ? 1 : 0;
      } else {
        next = (n == 3.0f) ? 1 : 0;
        if (next == 0 && doMutate && golRandom01() < golMutationChance) next = 1;
      }
      golNextCells[idx] = (float)next;

      if (next == 1 && !wasAlive) {
        golCellHue[idx] = golRandom01();
      }

      if (next == 1) {
        golBrightness[idx] = 1.0f;
      } else if (golFadeFactor <= 0.0f) {
        golBrightness[idx] = 0.0f;
      } else {
        float br = golBrightness[idx] * golFadeFactor;
        if (br < 0.02f) br = 0.0f;
        golBrightness[idx] = br;
      }
    }
  }

  float* tmp = golCells;
  golCells = golNextCells;
  golNextCells = tmp;
}

static inline void golStepGeneration() {
  if (golWrapEdges) golStepGenerationWrap();
  else golStepGenerationBounded();
}

void setup() {
  if (!golCells) golCells = PFMem::allocFloats(PANEL_RES_W * PANEL_RES_H);
  if (!golNextCells) golNextCells = PFMem::allocFloats(PANEL_RES_W * PANEL_RES_H);
  if (!golBrightness) golBrightness = PFMem::allocFloats(PANEL_RES_W * PANEL_RES_H);
  if (!golCellHue) golCellHue = PFMem::allocFloats(PANEL_RES_W * PANEL_RES_H);

  // Stack address as a cheap source of per-boot entropy (varies with RAM
  // layout/call stack depth), mixed with a fixed constant. No timing API needed.
  uint32_t seedMix = (uint32_t)(uintptr_t)&golRngState;
  seedMix ^= 0x9E3779B9u;
  seedMix ^= seedMix << 13;
  seedMix ^= seedMix >> 17;
  seedMix ^= seedMix << 5;
  golRngState = seedMix ? seedMix : 0x9E3779B9u;

  golHue = 0.0f;
  golGenTimer = 0.0f;
  golGenInterval = 0.1f;
  golMutationChance = 0.0f;
  golFadeFactor = 0.0f;
  golColorMode = 0;
  golPaused = false;
  golWrapEdges = true;
  golPrevBtn1 = false;
  golPrevBtn2 = false;
  golPrevBtn3 = false;

  golKnobParam[0] = GOL_KNOB0_DEFAULT;
  golKnobParam[1] = GOL_KNOB1_DEFAULT;
  golKnobParam[2] = GOL_KNOB2_DEFAULT;
  golKnobParam[3] = GOL_KNOB3_DEFAULT;

  golReseed();
}

void update(float dt, const InputFrame& input) {
  if (!golCells || !golNextCells || !golBrightness || !golCellHue) return;

  golKnobParam[0] += input.knobDeltas[0] * GOL_KNOB0_STEP;
  golKnobParam[0] = fminf(fmaxf(golKnobParam[0], GOL_KNOB0_MIN), GOL_KNOB0_MAX);

  golKnobParam[1] += input.knobDeltas[1] * GOL_KNOB1_STEP;
  golKnobParam[1] = fminf(fmaxf(golKnobParam[1], GOL_KNOB1_MIN), GOL_KNOB1_MAX);

  golKnobParam[2] += input.knobDeltas[2] * GOL_KNOB2_STEP;
  golKnobParam[2] = fminf(fmaxf(golKnobParam[2], GOL_KNOB2_MIN), GOL_KNOB2_MAX);

  golKnobParam[3] += input.knobDeltas[3] * GOL_KNOB3_STEP;
  golKnobParam[3] = fminf(fmaxf(golKnobParam[3], GOL_KNOB3_MIN), GOL_KNOB3_MAX);

  const float speedRaw = golKnobParam[0];
  const float genPerSec = 1.0f + speedRaw * 23.0f;
  golGenInterval = 1.0f / genPerSec;

  const float hueKnobRaw = golKnobParam[1];
  const float normalized1 = (golKnobParam[1] - GOL_KNOB1_MIN) / (GOL_KNOB1_MAX - GOL_KNOB1_MIN);

  if (golColorMode == 2) {
    golHue = normalized1;
  } else {
    golHue += hueKnobRaw * dt * 0.05f;
    golHue = PFMath::fract(golHue);
  }

  const float normalized2 = (golKnobParam[2] - GOL_KNOB2_MIN) / (GOL_KNOB2_MAX - GOL_KNOB2_MIN);
  golMutationChance = normalized2 * 0.03f;

  const float fadeRaw = golKnobParam[3];
  golFadeFactor = fadeRaw * 0.99f;

  const bool btn0 = input.btnPressed[0];
  const bool btn1 = input.btnPressed[1];
  const bool btn2 = input.btnPressed[2];
  const bool btn3 = input.btnPressed[3];

  if (btn0) {
    golReseed();
  }

  if (btn1 && !golPrevBtn1) {
    golColorMode = (golColorMode + 1) % GOL_COLOR_MODE_COUNT;
  }
  golPrevBtn1 = btn1;

  if (btn2 && !golPrevBtn2) {
    golPaused = !golPaused;
  }
  golPrevBtn2 = btn2;

  if (btn3 && !golPrevBtn3) {
    golWrapEdges = !golWrapEdges;
  }
  golPrevBtn3 = btn3;

  if (!golPaused) {
    golGenTimer += dt;
    int steps = 0;
    while (golGenTimer >= golGenInterval && steps < GOL_MAX_CATCHUP_STEPS) {
      golGenTimer -= golGenInterval;
      golStepGeneration();
      steps++;
    }
  }
}

void draw() {
  if (!golCells || !golNextCells || !golBrightness || !golCellHue) {
    PFCanvas::present();
    return;
  }

  const int w = PANEL_RES_W;
  const int h = PANEL_RES_H;

  for (int y = 0; y < h; y++) {
    const int row = y * w;
    for (int x = 0; x < w; x++) {
      const int idx = row + x;
      const float b = golBrightness[idx];
      if (b <= 0.001f) {
        PFCanvas::setPixel(x, y, 0, 0, 0);
        continue;
      }

      float pixelHue;
      if (golColorMode == 0) {
        pixelHue = golHue + (x + y) * 0.0015f;
        pixelHue = PFMath::fract(pixelHue);
      } else if (golColorMode == 1) {
        pixelHue = golCellHue[idx] + golHue;
        pixelHue = PFMath::fract(pixelHue);
      } else {
        pixelHue = golHue;
      }

      uint8_t r8, g8, b8;
      PFColor::hsvToRgb(pixelHue, 0.85f, b, r8, g8, b8);
      PFCanvas::setPixel(x, y, r8, g8, b8);
    }
  }

  PFCanvas::present();
}

} // namespace GameOfLifePattern