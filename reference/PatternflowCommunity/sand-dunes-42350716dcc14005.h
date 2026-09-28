#pragma once

// ============================================================
// SAND / DUNE PILE SIMULATOR (cellular automaton)
// Ported from the Pattern Lab JS preview.
//   Knob 0: fall rate (spawn + settle frequency)
//   Knob 1: pile angle threshold (shallow dunes -> steep pyramids)
//   Knob 2: emitter saturation (sandy amber -> per-emitter hue)
//   Knob 3: emitter rate contrast (uniform -> wide rate spread)
//   Btn 0: reset pile   Btn 1: tilt/avalanche
//   Btn 2: cycle emitter count 1..5   Btn 3: swap sim orientation
// ============================================================

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_color.h"
#include "src/core_noise.h"
#include "src/core_mem.h"

namespace SandPile {

const char* NAME = "Sand Pile";
const char* const KNOB_LABELS[4] = {"Fall Rate", "Pile Angle", "Emit Sat", "Rate Vary"};

// ---------------- constants ----------------
static const int   SAND_MAX_CELLS      = PANEL_RES_W * PANEL_RES_H;
static const int   SAND_MAX_DIM        = (PANEL_RES_W > PANEL_RES_H) ? PANEL_RES_W : PANEL_RES_H;
static const int   SAND_SPREAD_REACH   = 8;
static const int   SAND_MAX_STREAMS    = 5;
static const int   SAND_MAX_SUBSTEPS   = 6;
static const float SAND_BASE_HUE_DEG   = 32.0f;   // warm amber base
static const float SAND_BRIGHT_CENTER  = 1.0f;
static const float SAND_BRIGHT_CONTRAST= 0.5f;
static const float SAND_RATE_BOOST     = 1.0f;
static const float SAND_TIME_MUL       = 1.0f;    // sim fast-forward multiplier
static const float SAND_INV255         = 1.0f / 255.0f;

// knob steps (calibrated to Pattern Lab detents)
static const float SAND_STEP_FALL  = 0.05f;
static const float SAND_STEP_ANGLE = 0.10f;
static const float SAND_STEP_SAT   = 0.05f;
static const float SAND_STEP_VARY  = 0.05f;

// ---------------- state ----------------
static float pFallRate = 1.0f;    // 0 .. 1
static float pAngle    = 3.598f;  // 0.1 .. 10
static float pSat      = 3.279f;  // 0 .. 4.9
static float pRateVary = 0.947f;  // 0 .. 1

// framebuffer-scale buffers: PSRAM-first pointers, never static arrays
static uint8_t* gGrid = nullptr;  // 1 = sand, 0 = empty
static uint8_t* gHue  = nullptr;  // per-grain birth hue byte
static uint8_t* gSat  = nullptr;  // per-grain birth saturation byte
static uint8_t* gVal  = nullptr;  // per-grain birth brightness byte

static int16_t colTop[SAND_MAX_DIM];        // small scratch, stays static
static int16_t sPos[SAND_MAX_STREAMS];
static float   sHueDeg[SAND_MAX_STREAMS];
static float   sBright[SAND_MAX_STREAMS];
static float   sRateBias[SAND_MAX_STREAMS];
static float   sAccum[SAND_MAX_STREAMS];

static int   simW = PANEL_RES_W;
static int   simH = PANEL_RES_H;
static int   streamCount = 1;
static int   regenSeed = 0;
static int   frameCounter = 0;
static float simAccum = 0.0f;
static float avalancheTimer = 0.0f;

// ---------------- small helpers ----------------
static inline float sandClampf(float v, float lo, float hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

static inline int sandClampi(int v, int lo, int hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

static inline int sandRound(float v) {
  return (int)floorf(v + 0.5f);
}

// PFMem gives zeroed, PSRAM-first storage; four bytes per float slot.
static uint8_t* sandAllocBytes(int byteCount) {
  float* f = PFMem::allocFloats((byteCount + 3) / 4);
  return (uint8_t*)f;
}

static inline bool sandReady() {
  return gGrid != nullptr && gHue != nullptr && gSat != nullptr && gVal != nullptr;
}

static void clearGrid() {
  if (!gGrid) return;
  for (int i = 0; i < SAND_MAX_CELLS; i++) gGrid[i] = 0;
}

// ---------------- grain birth color ----------------
// Blends the shared sandy base hue toward the emitter's fixed hue by the
// saturation knob, and the shared brightness center toward the emitter's
// fixed brightness by the fixed contrast constant.
static void assignGrainColor(int idx, int streamIdx, float saturation) {
  float diff = sHueDeg[streamIdx] - SAND_BASE_HUE_DEG;
  if (diff > 180.0f) diff -= 360.0f;
  if (diff < -180.0f) diff += 360.0f;

  float hue = SAND_BASE_HUE_DEG + diff * saturation;
  while (hue < 0.0f) hue += 360.0f;
  while (hue >= 360.0f) hue -= 360.0f;

  const float sat = 0.12f + saturation * 0.78f;   // sandy -> vivid
  const float baseVal = SAND_BRIGHT_CENTER +
                        (sBright[streamIdx] - SAND_BRIGHT_CENTER) * SAND_BRIGHT_CONTRAST;

  gHue[idx] = (uint8_t)sandClampi(sandRound((hue / 360.0f) * 255.0f), 0, 255);
  gSat[idx] = (uint8_t)sandClampi(sandRound(sandClampf(sat, 0.0f, 1.0f) * 255.0f), 0, 255);
  gVal[idx] = (uint8_t)sandClampi(sandRound(sandClampf(baseVal, 0.0f, 1.0f) * 255.0f), 0, 255);
}

// ---------------- settle pass ----------------
// Grains fall straight down when possible, otherwise slide diagonally when a
// clear diagonal run of length angleT is open. Birth color travels with them.
static void settleStep(int angleT, int seed) {
  for (int y = simH - 2; y >= 0; y--) {
    const int rowIdx = y * simW;
    const int belowRowIdx = rowIdx + simW;
    for (int x = 0; x < simW; x++) {
      const int idx = rowIdx + x;
      if (gGrid[idx] == 0) continue;

      const int belowIdx = belowRowIdx + x;
      if (gGrid[belowIdx] == 0) {
        gGrid[belowIdx] = 1;
        gGrid[idx] = 0;
        gHue[belowIdx] = gHue[idx];
        gSat[belowIdx] = gSat[idx];
        gVal[belowIdx] = gVal[idx];
        continue;
      }

      const bool leftOk  = (x > 0) && (gGrid[belowIdx - 1] == 0);
      const bool rightOk = (x < simW - 1) && (gGrid[belowIdx + 1] == 0);
      if (!leftOk && !rightOk) continue;

      int dir;
      if (leftOk && rightOk) {
        dir = (PFNoise::cellHash(x, y, seed) < 0.5f) ? -1 : 1;
      } else {
        dir = leftOk ? -1 : 1;
      }

      bool clearPath = true;
      for (int k = 1; k <= angleT; k++) {
        const int cx = x + dir * k;
        const int cy = y + k;
        if (cx < 0 || cx >= simW || cy >= simH) break;
        if (gGrid[cy * simW + cx] != 0) { clearPath = false; break; }
      }

      if (clearPath) {
        const int destIdx = belowIdx + dir;
        gGrid[destIdx] = 1;
        gGrid[idx] = 0;
        gHue[destIdx] = gHue[idx];
        gSat[destIdx] = gSat[idx];
        gVal[destIdx] = gVal[idx];
      }
    }
  }
}

// Topmost RESTING grain per column; grains still falling through open air are
// skipped so the spread pass never grabs an in-flight grain.
static void computeColTop() {
  for (int x = 0; x < simW; x++) {
    int top = simH;
    for (int y = 0; y < simH; y++) {
      if (gGrid[y * simW + x] == 1) {
        const bool resting = (y + 1 >= simH) || (gGrid[(y + 1) * simW + x] == 1);
        if (resting) { top = y; break; }
      }
    }
    colTop[x] = (int16_t)top;
  }
}

// Lateral leveling: move one grain from a column top to the lowest nearby
// column within SPREAD_REACH when the height difference clears minDiff.
static void spreadPass(float prob, int minDiff, int seed) {
  if (prob <= 0.0f) return;
  computeColTop();

  const bool leftToRight = ((seed & 1) == 0);
  const int start = leftToRight ? 0 : simW - 1;
  const int end   = leftToRight ? simW : -1;
  const int step  = leftToRight ? 1 : -1;

  for (int x = start; x != end; x += step) {
    const int topX = colTop[x];
    if (topX >= simH) continue;
    if (PFNoise::cellHash(x, seed, 991) > prob) continue;

    int bestCol = -1;
    int bestTop = topX;
    for (int d = 1; d <= SAND_SPREAD_REACH; d++) {
      const int l = x - d;
      const int r = x + d;
      if (l >= 0 && colTop[l] > bestTop)    { bestTop = colTop[l]; bestCol = l; }
      if (r < simW && colTop[r] > bestTop)  { bestTop = colTop[r]; bestCol = r; }
    }

    if (bestCol >= 0 && (bestTop - topX) >= minDiff) {
      const int destTop = bestTop - 1;
      if (destTop >= 0) {
        const int srcIdx  = topX * simW + x;
        const int destIdx = destTop * simW + bestCol;
        gGrid[srcIdx] = 0;
        gGrid[destIdx] = 1;
        gHue[destIdx] = gHue[srcIdx];
        gSat[destIdx] = gSat[srcIdx];
        gVal[destIdx] = gVal[srcIdx];
        colTop[x] = (int16_t)(topX + 1);
        colTop[bestCol] = (int16_t)destTop;
      }
    }
  }
}

// Re-roll emitter positions, hues (golden-angle spaced), brightness baselines
// and rate weights against the CURRENT simW. Also resets every metronome so a
// count/orientation change never causes an instant catch-up burst.
static void regenerateStreams(int count) {
  regenSeed++;
  streamCount = sandClampi(count, 1, SAND_MAX_STREAMS);

  const float startHue = PFNoise::cellHash(regenSeed * 733 + 1, 17) * 360.0f;
  for (int i = 0; i < SAND_MAX_STREAMS; i++) sAccum[i] = 0.0f;

  for (int i = 0; i < streamCount; i++) {
    const int pos = (int)(PFNoise::cellHash(frameCounter * 131 + i * 977, regenSeed * 733) * (float)simW);
    sPos[i] = (int16_t)sandClampi(pos, 0, simW - 1);

    float h = startHue + (float)i * 137.5f;   // golden angle spacing
    while (h >= 360.0f) h -= 360.0f;
    sHueDeg[i] = h;

    sBright[i]   = PFNoise::cellHash(i * 601 + 7, regenSeed * 911, 3);
    sRateBias[i] = PFNoise::cellHash(i * 449 + 21, regenSeed * 353, 5) * 2.0f; // 0..2, 1 = neutral
  }
}

// ---------------- required interface ----------------
void setup() {
  if (!gGrid) gGrid = sandAllocBytes(SAND_MAX_CELLS);
  if (!gHue)  gHue  = sandAllocBytes(SAND_MAX_CELLS);
  if (!gSat)  gSat  = sandAllocBytes(SAND_MAX_CELLS);
  if (!gVal)  gVal  = sandAllocBytes(SAND_MAX_CELLS);

  simW = PANEL_RES_W;
  simH = PANEL_RES_H;
  streamCount = 1;
  regenSeed = 0;
  frameCounter = 0;
  simAccum = 0.0f;
  avalancheTimer = 0.0f;

  for (int i = 0; i < SAND_MAX_DIM; i++) colTop[i] = (int16_t)simH;
  for (int i = 0; i < SAND_MAX_STREAMS; i++) {
    sPos[i] = 0;
    sHueDeg[i] = SAND_BASE_HUE_DEG;
    sBright[i] = SAND_BRIGHT_CENTER;
    sRateBias[i] = 1.0f;
    sAccum[i] = 0.0f;
  }

  clearGrid();
  regenerateStreams(5);
}

void update(float dt, const InputFrame& input) {
  if (!sandReady()) return;

  dt *= SAND_TIME_MUL;

  // knobs: accumulate detents, constrain to the Pattern Lab ranges
  pFallRate = sandClampf(pFallRate + input.knobDeltas[0] * SAND_STEP_FALL,  0.0f, 1.0f);
  pAngle    = sandClampf(pAngle    + input.knobDeltas[1] * SAND_STEP_ANGLE, 0.1f, 10.0f);
  pSat      = sandClampf(pSat      + input.knobDeltas[2] * SAND_STEP_SAT,   0.0f, 4.9f);
  pRateVary = sandClampf(pRateVary + input.knobDeltas[3] * SAND_STEP_VARY,  0.0f, 1.0f);

  // Btn 0: reset the pile
  if (input.btnPressed[0]) clearGrid();

  // Btn 1: tilt -> temporary avalanche
  if (input.btnPressed[1]) avalancheTimer = 1.2f;

  // Btn 2: cycle emitter count 1->2->3->4->5->1
  if (input.btnPressed[2]) regenerateStreams((streamCount % SAND_MAX_STREAMS) + 1);

  // Btn 3: swap simulation orientation (real physics change -> reset + re-roll)
  if (input.btnPressed[3]) {
    const int newW = simH;
    const int newH = simW;
    simW = newW;
    simH = newH;
    clearGrid();
    for (int i = 0; i < SAND_MAX_DIM; i++) colTop[i] = (int16_t)simH;
    regenerateStreams(streamCount);
  }

  if (avalancheTimer > 0.0f) {
    avalancheTimer -= dt;
    if (avalancheTimer < 0.0f) avalancheTimer = 0.0f;
  }

  // higher raw angle = steeper pile before it slides
  int angleT = sandClampi(sandRound(pAngle * 0.5f), 1, 5);
  if (avalancheTimer > 0.0f) angleT = 1;

  // shallow dunes level aggressively; steep pyramids barely level at all
  float spreadProb = sandClampf((10.0f - pAngle) / 10.0f, 0.0f, 1.0f) * 0.5f;
  int spreadMinDiff = sandClampi(sandRound(1.0f + pAngle * 0.6f), 1, 8);
  if (avalancheTimer > 0.0f) { spreadProb = 0.5f; spreadMinDiff = 1; }

  const float saturation   = sandClampf(pSat / 4.9f, 0.0f, 1.0f);
  const float rateContrast = sandClampf(pRateVary, 0.0f, 1.0f) * SAND_RATE_BOOST;

  const float stepInterval      = sandClampf(0.12f - pFallRate * 0.11f, 0.01f, 0.12f);
  const float baseSpawnInterval = sandClampf(0.50f - pFallRate * 0.45f, 0.02f, 0.50f);

  frameCounter++;
  if (frameCounter > 1000000) frameCounter = 0;   // keep hash seeds bounded

  simAccum += dt;
  int steps = 0;
  while (simAccum >= stepInterval && steps < SAND_MAX_SUBSTEPS) {
    const uint32_t mixed = (uint32_t)frameCounter * 7919u + (uint32_t)steps * 104729u;
    settleStep(angleT, (int)(mixed & 0x7fffffffu));
    spreadPass(spreadProb, spreadMinDiff, frameCounter * 7 + steps);
    simAccum -= stepInterval;
    steps++;
  }
  // never let the sim clock run away when the substep cap is hit
  if (simAccum > stepInterval * (float)SAND_MAX_SUBSTEPS) simAccum = 0.0f;

  // Each emitter runs its own steady metronome; the weight scales its interval,
  // so weight 2 fires twice as often (regularly, not randomly).
  for (int i = 0; i < streamCount; i++) {
    const float weight = sandClampf(1.0f + (sRateBias[i] - 1.0f) * rateContrast, 0.02f, 8.0f);
    const float streamInterval = sandClampf(baseSpawnInterval / weight, 0.02f, 2.0f);

    sAccum[i] += dt;
    int spawns = 0;
    while (sAccum[i] >= streamInterval && spawns < SAND_MAX_SUBSTEPS) {
      const int spawnIdx = sPos[i];   // row 0 of the current orientation
      if (gGrid[spawnIdx] == 0) {
        gGrid[spawnIdx] = 1;
        assignGrainColor(spawnIdx, i, saturation);
      }
      sAccum[i] -= streamInterval;
      spawns++;
    }
    if (sAccum[i] > streamInterval * (float)SAND_MAX_SUBSTEPS) sAccum[i] = 0.0f;
  }
}

void draw() {
  if (!sandReady()) { PFCanvas::present(); return; }

  // Direct map when the sim matches the panel shape; otherwise the sim is the
  // panel's transpose, so rotate 90 degrees to fill the frame exactly.
  const bool direct = (simW == PANEL_RES_W && simH == PANEL_RES_H);

  for (int dy = 0; dy < PANEL_RES_H; dy++) {
    for (int dx = 0; dx < PANEL_RES_W; dx++) {
      int sx, sy;
      if (direct) {
        sx = dx;
        sy = dy;
      } else {
        sx = dy;
        sy = PANEL_RES_W - 1 - dx;
      }

      if (sx < 0 || sx >= simW || sy < 0 || sy >= simH) {
        PFCanvas::setPixel(dx, dy, 0, 0, 0);
        continue;
      }

      const int idx = sy * simW + sx;
      if (gGrid[idx] == 0) {
        PFCanvas::setPixel(dx, dy, 0, 0, 0);
        continue;
      }

      const float h01  = (float)gHue[idx] * SAND_INV255;
      const float s01  = (float)gSat[idx] * SAND_INV255;
      const float base = (float)gVal[idx] * SAND_INV255;
      const float tex  = PFNoise::cellHash(sx, sy, 7717);
      const float v01  = sandClampf(base + (tex - 0.5f) * 0.2f, 0.0f, 1.0f);

      uint8_t r, g, b;
      PFColor::hsvToRgb(h01, s01, v01, r, g, b);
      PFCanvas::setPixel(dx, dy, r, g, b);
    }
  }

  PFCanvas::present();
}

} // namespace SandPile