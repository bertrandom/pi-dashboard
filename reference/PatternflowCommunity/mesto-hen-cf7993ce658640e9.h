#pragma once
// SPDX-License-Identifier: CC-BY-SA-4.0
// Pattern: MESTO Hens Crossing
// Author:  Stasik / NASHE MESTO
// Lineage: original (C++ port of mesto_hens_crossing.js)
//
// A line of hens in pots walks right to left, coupled like train cars. The
// pots spell NASHEMESTO left to right.
//
// Knob 1 (wraps):  idle-bounce stagger between neighbouring hens
// Knob 2 (clamps): stretch strength; past halfway the hens tint + glow
// Knob 3 (clamps): squash strength; past halfway the pots tint + glow
// Knob 4 (wraps):  spacing between hens, live
// Button 2 / 3:    randomize the stretch tint / squash tint

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_mem.h"
#include "src/core_math.h"
#include "src/core_params.h"

namespace MestoHensCrossing {

const char* NAME = "MESTO Hens Crossing";
const char* const KNOB_LABELS[4] = {"stagger", "stretch", "squash", "spacing"};
constexpr bool ABSOLUTE_READY = true;

constexpr int HC_W = PANEL_RES_W;
constexpr int HC_H = PANEL_RES_H;

// ---- hen-in-a-pot sprite: 16x26, 9-color palette, '.' is transparent ----
constexpr int HEN_W = 16, HEN_H = 26;
static const char* const HEN_SRC[HEN_H] = {
  ".............L..",
  "..........L.L...",
  "........LY.L.Y..",
  "...........L..L.",
  ".....R.R.BLL..L.",
  ".....RBDD.L.....",
  ".....GWWWGLL....",
  ".PPPPWWLLWGN.Y..",
  "....BWLWWLGNL.Y.",
  "...RDWWWWWGN..L.",
  "...DDWWWWWGN..L.",
  "....WWWWWWGN.W..",
  "....WWWWWGGGWW..",
  "....WWGWWWWWWG..",
  ".NL.WWGWWWWWGG..",
  "..NLWWGWWWWGGGNL",
  "LL.LGWGGWWGGGNLN",
  ".LLNNGGGGGGGNL..",
  "..PPPPPPPPPPPP..",
  "..PPPPPPPPPPPP..",
  "..BBBBBBBBBBBB..",
  "...BBBDDDDBBB...",
  "...PPBDDDDBPP...",
  "...PPBDDDDBPP...",
  "...BPBDDDDBPB...",
  "...BBBBBBBBBB..."
};

struct HcRGB { uint8_t r, g, b; };
static inline HcRGB paletteOf(char c) {
  switch (c) {
    case 'W': return {255, 255, 255};  // body
    case 'G': return {195, 195, 195};  // shading
    case 'R': return {255, 60, 45};    // flower petals
    case 'N': return {30, 35, 55};     // outline
    case 'L': return {92, 110, 60};    // leaves
    case 'Y': return {170, 150, 55};   // flower centers
    case 'P': return {207, 125, 90};   // pot light
    case 'B': return {156, 83, 60};    // pot mid
    case 'D': return {119, 63, 47};    // pot dark band
  }
  return {0, 0, 0};
}

// ---- 4x5 letters stamped on the pot ----
struct Glyph4 { char ch; const char* rows[5]; };
static const Glyph4 POT_FONT[] = {
  {'N', {"X..X", "XX.X", "X.XX", "X..X", "X..X"}},
  {'A', {".XX.", "X..X", "XXXX", "X..X", "X..X"}},
  {'S', {".XXX", "X...", ".XX.", "...X", "XXX."}},
  {'H', {"X..X", "X..X", "XXXX", "X..X", "X..X"}},
  {'E', {"XXXX", "X...", "XXX.", "X...", "XXXX"}},
  {'M', {"X..X", "XXXX", "X..X", "X..X", "X..X"}},
  {'T', {"XXXX", ".XX.", ".XX.", ".XX.", ".XX."}},
  {'O', {".XX.", "X..X", "X..X", "X..X", ".XX."}}
};
constexpr int POT_FONT_N = sizeof(POT_FONT) / sizeof(POT_FONT[0]);
static const char MESSAGE[] = "NASHEMESTO";
constexpr int MESSAGE_LEN = 10;
constexpr int LETTER_W = 4, LETTER_H = 5;
constexpr int LETTER_ROW = 20, LETTER_COL = 6;

// ---- 3x5 debug font: knob letters A-D and digits ----
struct Glyph3 { char ch; const char* rows[5]; };
static const Glyph3 DEBUG_FONT[] = {
  {'A', {".X.", "X.X", "XXX", "X.X", "X.X"}},
  {'B', {"XX.", "X.X", "XX.", "X.X", "XX."}},
  {'C', {"XXX", "X..", "X..", "X..", "XXX"}},
  {'D', {"XX.", "X.X", "X.X", "X.X", "XX."}},
  {'0', {"XXX", "X.X", "X.X", "X.X", "XXX"}},
  {'1', {".X.", "XX.", ".X.", ".X.", "XXX"}},
  {'2', {"XXX", "..X", "XXX", "X..", "XXX"}},
  {'3', {"XXX", "..X", "XXX", "..X", "XXX"}},
  {'4', {"X.X", "X.X", "XXX", "..X", "..X"}},
  {'5', {"XXX", "X..", "XXX", "..X", "XXX"}},
  {'6', {"XXX", "X..", "XXX", "X.X", "XXX"}},
  {'7', {"XXX", "..X", "..X", "..X", "..X"}},
  {'8', {"XXX", "X.X", "XXX", "X.X", "XXX"}},
  {'9', {"XXX", "X.X", "XXX", "..X", "XXX"}}
};
constexpr int DEBUG_FONT_N = sizeof(DEBUG_FONT) / sizeof(DEBUG_FONT[0]);
constexpr int DEBUG_GLYPH_W = 3, DEBUG_GLYPH_H = 5, DEBUG_GAP = 1;

// ---- tuning ----
constexpr float TAU_F = 6.28318530718f;
constexpr float WALK_CYCLE = 0.5f;
constexpr float HC_SPEED = 16.0f;
constexpr int MAX_HENS = 80;
constexpr float MAX_OFFSET_PX = HEN_W + 50;
constexpr float MIN_OFFSET_PX = 3.0f;
constexpr float SPAWN_INTERVAL = 0.35f;
constexpr int GLOW_RADIUS = 2;
constexpr float MAX_STAGGER = 12.0f;

constexpr int BIRD_ROWS = 18;
constexpr int POT_ROWS = HEN_H - BIRD_ROWS;
constexpr float BIRD_DELAY = 1.0f / 12.0f;
constexpr float LEAF_DELAY = 2.0f / 12.0f;

constexpr float LEAF_DROP_MIN = 0.2f, LEAF_DROP_MAX = 0.6f;
constexpr float LEAF_PARTICLE_DURATION = 0.9f;
constexpr float LEAF_PARTICLE_RISE_FRAC = 0.3f;
constexpr float LEAF_PARTICLE_RISE_HEIGHT = 3.0f;
constexpr float LEAF_PARTICLE_RISE_MULT_MAX = 8.0f;
constexpr float LEAF_PARTICLE_RISE_CURVE = 2.5f;
constexpr float LEAF_PARTICLE_RISE_OVERSHOOT_CHANCE = 0.06f;
constexpr float LEAF_PARTICLE_RISE_OVERSHOOT_MULT = 1.5f;
constexpr float LEAF_PARTICLE_FALL_DISTANCE = 6.0f;
constexpr float LEAF_PARTICLE_PAIR_CHANCE = 0.08f;
constexpr float LEAF_PARTICLE_BURST_CHANCE = 0.6f;
constexpr float LEAF_PARTICLE_FEATHER_CHANCE = 0.1f;
constexpr float LEAF_PARTICLE_KNOB_RATE_BOOST = 12.0f;
constexpr float LEAF_PARTICLE_KNOB_CHANCE_BOOST = 0.4f;

// ---- state ----
struct HcHen { float x, y; int seq; char letter; float leafIn; };
struct HcPt { float dx, dy; uint8_t r, g, b; };
struct HcParticle { bool used; float age, x, y, riseHeight; int n; HcPt pts[4]; };

constexpr int MAX_PARTICLES = 128;
constexpr int GLOW_CAP = 3000;   // max glow-mask cells per part
constexpr int GLOW_SLOTS = 4;    // leaf, bird, pot, letter

static float staggerKnob = 0.0f, stretchRaw = 0.0f, squashRaw = 0.0f, gapKnob = 0.7f;
static char debugText[6] = "";
static int tintColor[3] = {5, 45, 190};      // stretch tint (hen/plant)
static int squashColor[3] = {190, 15, 15};   // squash tint (pot)
static float walkT = 0.0f, spawnIn = 0.0f;
static int henCount = 0, henCounter = 0;
static HcHen hens[MAX_HENS];
static HcParticle* particles = nullptr;
static int particleNext = 0;
static uint8_t* occupied = nullptr;
static uint8_t occStamp = 0;
static uint8_t* glowBufs = nullptr;

// ---- helpers ----
static inline int roundI(float v) { return PFMath::ifloor(v + 0.5f); }
static inline float clampf(float v, float lo, float hi) { return v < lo ? lo : (v > hi ? hi : v); }
static inline uint8_t to8(float v) { return (uint8_t)roundI(clampf(v, 0.0f, 255.0f)); }
static inline float hcMin(float a, float b) { return a < b ? a : b; }
static inline float hcMax(float a, float b) { return a > b ? a : b; }
static inline float rnd01() { return (float)random(0, 10000) / 10000.0f; }

static void hcClear() {
  for (int y = 0; y < HC_H; y++)
    for (int x = 0; x < HC_W; x++) PFCanvas::setPixel(x, y, 0, 0, 0);
}

static void setDebug(char letter, float v) {
  int n = roundI(clampf(v, 0.0f, 1.0f) * 100.0f);
  int i = 0;
  debugText[i++] = letter;
  if (n >= 100) { debugText[i++] = '1'; debugText[i++] = '0'; debugText[i++] = '0'; }
  else if (n >= 10) { debugText[i++] = (char)('0' + n / 10); debugText[i++] = (char)('0' + n % 10); }
  else { debugText[i++] = (char)('0' + n); }
  debugText[i] = 0;
}

static void drawDebugText() {
  int len = 0;
  while (len < 5 && debugText[len]) len++;
  if (len == 0) return;
  int totalW = len * (DEBUG_GLYPH_W + DEBUG_GAP) - DEBUG_GAP;
  int x0 = HC_W - 2 - totalW, y0 = 2;
  for (int i = 0; i < len; i++) {
    for (int g = 0; g < DEBUG_FONT_N; g++) {
      if (DEBUG_FONT[g].ch != debugText[i]) continue;
      for (int ry = 0; ry < DEBUG_GLYPH_H; ry++)
        for (int rx = 0; rx < DEBUG_GLYPH_W; rx++)
          if (DEBUG_FONT[g].rows[ry][rx] == 'X')
            PFCanvas::setPixel(x0 + rx, y0 + ry, 255, 255, 255);
      break;
    }
    x0 += DEBUG_GLYPH_W + DEBUG_GAP;
  }
}

// ---- rig ----
struct HcPart {
  float scaleX, scaleY, tintStrength, glowMult, originXf, originYf;
  bool squashing;
  const int* color;
};

struct HcGlow {
  bool valid;
  int gx0, gy0, gw, gh;
  const uint8_t* src;
  const int* color;
  float glowMult, tintStrength;
};

static HcPart computePhaseState(float phase, float stretchAmt, float squashAmt,
                              float stretchGate, float squashGate,
                              const int* stretchCol, const int* squashCol) {
  HcPart p;
  p.originXf = 0.0f;
  p.originYf = 0.0f;
  if (phase >= 0.0f) {
    p.scaleX = 1.0f + squashAmt * phase * 1.2f;
    p.scaleY = 1.0f - squashAmt * phase;
    p.tintStrength = clampf(phase * squashGate * 1.35f, 0.0f, 1.0f);
    p.color = squashCol;
    p.glowMult = 1.0f;
    p.squashing = true;
  } else {
    float s = -phase;
    p.scaleX = 1.0f - stretchAmt * (0.5f * s + 0.15f * s * s * s);
    p.scaleY = 1.0f + stretchAmt * 2.0f * s * 1.2f;
    p.tintStrength = clampf(s * stretchGate * 1.35f, 0.0f, 1.0f);
    p.color = stretchCol;
    p.glowMult = 1.6f;
    p.squashing = false;
  }
  return p;
}

enum { CODE_ANY = 0, CODE_LEAF = 1, CODE_NOT_LEAF = 2 };
static inline bool codeIncluded(int mode, char c) {
  bool leaf = (c == 'L' || c == 'Y');
  if (mode == CODE_LEAF) return leaf;
  if (mode == CODE_NOT_LEAF) return !leaf;
  return true;
}

static HcGlow drawPart(int rowStart, int rowEnd, const HcPart& part, int mode, int slot) {
  HcGlow none = {false, 0, 0, 0, 0, nullptr, nullptr, 0.0f, 0.0f};
  int minPx = 1 << 30, minPy = 1 << 30, maxPx = -(1 << 30), maxPy = -(1 << 30);
  for (int ry = rowStart; ry < rowEnd; ry++) {
    int local = ry - rowStart;
    int py0 = roundI(part.originYf + local * part.scaleY);
    int py1 = roundI(part.originYf + (local + 1) * part.scaleY);
    for (int rx = 0; rx < HEN_W; rx++) {
      char c = HEN_SRC[ry][rx];
      if (c == '.' || !codeIncluded(mode, c)) continue;
      int px0 = roundI(part.originXf + rx * part.scaleX);
      int px1 = roundI(part.originXf + (rx + 1) * part.scaleX);
      if (px1 <= px0 || py1 <= py0) continue;
      if (px0 < minPx) minPx = px0;
      if (px1 - 1 > maxPx) maxPx = px1 - 1;
      if (py0 < minPy) minPy = py0;
      if (py1 - 1 > maxPy) maxPy = py1 - 1;
    }
  }
  if (maxPx < minPx) return none;

  bool doGlow = part.tintStrength > 0.01f;
  int gx0 = minPx - GLOW_RADIUS, gy0 = minPy - GLOW_RADIUS;
  int gw = (maxPx - minPx + 1) + GLOW_RADIUS * 2;
  int gh = (maxPy - minPy + 1) + GLOW_RADIUS * 2;
  if (doGlow && gw * gh > GLOW_CAP) doGlow = false;
  uint8_t* gsrc = nullptr;
  if (doGlow) {
    gsrc = glowBufs + slot * GLOW_CAP;
    memset(gsrc, 0, (size_t)gw * gh);
  }

  for (int ry = rowStart; ry < rowEnd; ry++) {
    int local = ry - rowStart;
    int py0 = roundI(part.originYf + local * part.scaleY);
    int py1 = roundI(part.originYf + (local + 1) * part.scaleY);
    for (int rx = 0; rx < HEN_W; rx++) {
      char c = HEN_SRC[ry][rx];
      if (c == '.' || !codeIncluded(mode, c)) continue;
      HcRGB base = paletteOf(c);
      float r = base.r, g = base.g, b = base.b;
      if (part.tintStrength > 0.0f) {
        r = hcMin(255.0f, r + part.color[0] * part.tintStrength);
        g = hcMin(255.0f, g + part.color[1] * part.tintStrength);
        b = hcMin(255.0f, b + part.color[2] * part.tintStrength);
      }
      uint8_t r8 = to8(r), g8 = to8(g), b8 = to8(b);
      int px0 = roundI(part.originXf + rx * part.scaleX);
      int px1 = roundI(part.originXf + (rx + 1) * part.scaleX);
      for (int py = py0; py < py1; py++) {
        if (doGlow) {
          int gy = py - gy0;
          if (gy >= 0 && gy < gh)
            for (int px = px0; px < px1; px++) {
              int gx = px - gx0;
              if (gx >= 0 && gx < gw) gsrc[gy * gw + gx] = 1;
            }
        }
        if (py < 0 || py >= HC_H) continue;
        for (int px = px0; px < px1; px++) {
          if (px < 0 || px >= HC_W) continue;
          occupied[py * HC_W + px] = occStamp;
          PFCanvas::setPixel(px, py, r8, g8, b8);
        }
      }
    }
  }
  if (!doGlow) return none;
  return {true, gx0, gy0, gw, gh, gsrc, part.color, part.glowMult, part.tintStrength};
}

static const Glyph4* findPotGlyph(char c) {
  for (int i = 0; i < POT_FONT_N; i++)
    if (POT_FONT[i].ch == c) return &POT_FONT[i];
  return nullptr;
}

static HcGlow drawLetter(const HcHen& hen, const HcPart& pot, const HcPart& bird, int slot) {
  HcGlow none = {false, 0, 0, 0, 0, nullptr, nullptr, 0.0f, 0.0f};
  const Glyph4* glyph = findPotGlyph(hen.letter);
  if (!glyph) return none;

  int minPx = 1 << 30, minPy = 1 << 30, maxPx = -(1 << 30), maxPy = -(1 << 30);
  for (int ry = 0; ry < LETTER_H; ry++) {
    int rowIdx = LETTER_ROW + ry - BIRD_ROWS;
    int py0 = roundI(pot.originYf + rowIdx * pot.scaleY);
    int py1 = roundI(pot.originYf + (rowIdx + 1) * pot.scaleY);
    for (int rx = 0; rx < LETTER_W; rx++) {
      if (glyph->rows[ry][rx] != 'X') continue;
      int colIdx = LETTER_COL + rx;
      int px0 = roundI(pot.originXf + colIdx * pot.scaleX);
      int px1 = roundI(pot.originXf + (colIdx + 1) * pot.scaleX);
      if (px1 <= px0 || py1 <= py0) continue;
      if (px0 < minPx) minPx = px0;
      if (px1 - 1 > maxPx) maxPx = px1 - 1;
      if (py0 < minPy) minPy = py0;
      if (py1 - 1 > maxPy) maxPy = py1 - 1;
    }
  }
  if (maxPx < minPx) return none;

  bool doGlow = bird.tintStrength > 0.01f;
  int gx0 = minPx - GLOW_RADIUS, gy0 = minPy - GLOW_RADIUS;
  int gw = (maxPx - minPx + 1) + GLOW_RADIUS * 2;
  int gh = (maxPy - minPy + 1) + GLOW_RADIUS * 2;
  if (doGlow && gw * gh > GLOW_CAP) doGlow = false;
  uint8_t* gsrc = nullptr;
  if (doGlow) {
    gsrc = glowBufs + slot * GLOW_CAP;
    memset(gsrc, 0, (size_t)gw * gh);
  }

  float r = 255.0f, g = 255.0f, b = 255.0f;
  if (bird.tintStrength > 0.0f) {
    r = hcMin(255.0f, r + bird.color[0] * bird.tintStrength);
    g = hcMin(255.0f, g + bird.color[1] * bird.tintStrength);
    b = hcMin(255.0f, b + bird.color[2] * bird.tintStrength);
  }
  uint8_t r8 = to8(r), g8 = to8(g), b8 = to8(b);

  for (int ry = 0; ry < LETTER_H; ry++) {
    int rowIdx = LETTER_ROW + ry - BIRD_ROWS;
    int py0 = roundI(pot.originYf + rowIdx * pot.scaleY);
    int py1 = roundI(pot.originYf + (rowIdx + 1) * pot.scaleY);
    for (int rx = 0; rx < LETTER_W; rx++) {
      if (glyph->rows[ry][rx] != 'X') continue;
      int colIdx = LETTER_COL + rx;
      int px0 = roundI(pot.originXf + colIdx * pot.scaleX);
      int px1 = roundI(pot.originXf + (colIdx + 1) * pot.scaleX);
      for (int py = py0; py < py1; py++) {
        if (doGlow) {
          int gy = py - gy0;
          if (gy >= 0 && gy < gh)
            for (int px = px0; px < px1; px++) {
              int gx = px - gx0;
              if (gx >= 0 && gx < gw) gsrc[gy * gw + gx] = 1;
            }
        }
        if (py < 0 || py >= HC_H) continue;
        for (int px = px0; px < px1; px++) {
          if (px < 0 || px >= HC_W) continue;
          occupied[py * HC_W + px] = occStamp;
          PFCanvas::setPixel(px, py, r8, g8, b8);
        }
      }
    }
  }
  if (!doGlow) return none;
  return {true, gx0, gy0, gw, gh, gsrc, bird.color, bird.glowMult, bird.tintStrength};
}

// HcGlow mask codes: 1 = sprite cell, 2..4 = nearest sprite cell is 1 / 1.41 / 2
// px away. Spreading out from the (few) sprite cells is far cheaper than
// searching a 5x5 neighbourhood around every cell of the padded box.
static const uint8_t GLOW_CODE[2 * GLOW_RADIUS + 1][2 * GLOW_RADIUS + 1] = {
  {0, 0, 4, 0, 0},
  {0, 3, 2, 3, 0},
  {4, 2, 1, 2, 4},
  {0, 3, 2, 3, 0},
  {0, 0, 4, 0, 0}
};
static const float GLOW_CODE_DIST[5] = {0.0f, 0.0f, 1.0f, 1.41421356f, 2.0f};

static void applyGlow(const HcGlow& gl) {
  if (!gl.valid) return;
  uint8_t* m = (uint8_t*)gl.src;
  const int gw = gl.gw, gh = gl.gh;

  for (int gy = 0; gy < gh; gy++)
    for (int gx = 0; gx < gw; gx++) {
      if (m[gy * gw + gx] != 1) continue;
      for (int dy = -GLOW_RADIUS; dy <= GLOW_RADIUS; dy++) {
        int ny = gy + dy;
        if (ny < 0 || ny >= gh) continue;
        for (int dx = -GLOW_RADIUS; dx <= GLOW_RADIUS; dx++) {
          uint8_t code = GLOW_CODE[dy + GLOW_RADIUS][dx + GLOW_RADIUS];
          if (!code || code == 1) continue;
          int nx = gx + dx;
          if (nx < 0 || nx >= gw) continue;
          uint8_t& cell = m[ny * gw + nx];
          if (cell == 0 || cell > code) cell = code;
        }
      }
    }

  for (int gy = 0; gy < gh; gy++) {
    int py = gy + gl.gy0;
    if (py < 0 || py >= HC_H) continue;
    for (int gx = 0; gx < gw; gx++) {
      uint8_t code = m[gy * gw + gx];
      if (code < 2) continue;
      int px = gx + gl.gx0;
      if (px < 0 || px >= HC_W) continue;
      if (occupied[py * HC_W + px] == occStamp) continue;
      float falloff = 1.0f - GLOW_CODE_DIST[code] / ((float)GLOW_RADIUS + 0.5f);
      float strength = gl.tintStrength * clampf(falloff, 0.0f, 1.0f);
      if (strength <= 0.02f) continue;
      float k = gl.glowMult * strength;
      PFCanvas::setPixel(px, py, to8(gl.color[0] * k), to8(gl.color[1] * k), to8(gl.color[2] * k));
    }
  }
}

// ---- falling-leaf debris ----
static void maybeSpawnLeafParticle(HcHen& hen, const HcPart& leaf,
                                   float stretchGate, float squashGate) {
  if (hen.leafIn > 0.0f) return;

  float rawIntensity = hcMax(stretchRaw, squashRaw);
  float rateMult = rawIntensity <= 0.1f
      ? (1.0f / 3.0f) + (rawIntensity / 0.1f) * (1.0f - 1.0f / 3.0f)
      : 1.0f + ((rawIntensity - 0.1f) / 0.9f) * LEAF_PARTICLE_KNOB_RATE_BOOST;
  float gateIntensity = hcMax(stretchGate, squashGate);
  float chanceMult = 1.0f + gateIntensity * LEAF_PARTICLE_KNOB_CHANCE_BOOST;

  hen.leafIn = (LEAF_DROP_MIN + rnd01() * (LEAF_DROP_MAX - LEAF_DROP_MIN)) / rateMult;

  // find a free slot; if the pool is full the drop is simply skipped
  HcParticle* p = nullptr;
  for (int i = 0; i < MAX_PARTICLES; i++) {
    int idx = (particleNext + i) % MAX_PARTICLES;
    if (!particles[idx].used) { p = &particles[idx]; particleNext = (idx + 1) % MAX_PARTICLES; break; }
  }
  if (!p) return;

  p->used = true;
  p->age = 0.0f;
  p->x = leaf.originXf + (HEN_W / 2.0f) * leaf.scaleX;
  p->y = leaf.originYf + 1.5f * leaf.scaleY;
  p->n = 0;

  bool isFeather = rnd01() < hcMin(1.0f, LEAF_PARTICLE_FEATHER_CHANCE * chanceMult);
  if (isFeather) {
    int count = 2 + (rnd01() < 0.5f ? 1 : 0);
    for (int i = 0; i < count; i++) {
      p->pts[p->n++] = {(float)i - (count - 1) / 2.0f, 0.0f, 255, 255, 255};
    }
  } else {
    int count = 1 + (rnd01() < hcMin(1.0f, LEAF_PARTICLE_PAIR_CHANCE * chanceMult) ? 1 : 0);
    if (rnd01() < hcMin(1.0f, LEAF_PARTICLE_BURST_CHANCE * chanceMult)) count += 1 + (int)(rnd01() * 2.0f);
    if (count > 4) count = 4;
    for (int i = 0; i < count; i++) {
      HcRGB c = paletteOf(rnd01() < 0.5f ? 'L' : 'Y');
      p->pts[p->n++] = {(rnd01() - 0.5f) * 3.0f, (rnd01() - 0.5f) * 2.0f, c.r, c.g, c.b};
    }
  }

  float launchRoll = PFMath::fastPow(rnd01(), LEAF_PARTICLE_RISE_CURVE);
  float launchMult = 1.0f + launchRoll * (LEAF_PARTICLE_RISE_MULT_MAX - 1.0f);
  if (rnd01() < LEAF_PARTICLE_RISE_OVERSHOOT_CHANCE)
    launchMult *= 1.0f + rnd01() * (LEAF_PARTICLE_RISE_OVERSHOOT_MULT - 1.0f);
  p->riseHeight = LEAF_PARTICLE_RISE_HEIGHT * launchMult;
}

static void drawLeafParticles() {
  for (int i = 0; i < MAX_PARTICLES; i++) {
    HcParticle& p = particles[i];
    if (!p.used) continue;
    float progress = p.age / LEAF_PARTICLE_DURATION;
    if (progress >= 1.0f) { p.used = false; continue; }
    if (progress < 0.0f) continue;

    float yOff, alpha;
    if (progress < LEAF_PARTICLE_RISE_FRAC) {
      float rp = progress / LEAF_PARTICLE_RISE_FRAC;
      float eased = 1.0f - (1.0f - rp) * (1.0f - rp);
      yOff = -p.riseHeight * eased;
      alpha = 1.0f;
    } else {
      float fp = (progress - LEAF_PARTICLE_RISE_FRAC) / (1.0f - LEAF_PARTICLE_RISE_FRAC);
      float eased = fp * fp;
      yOff = -p.riseHeight + (p.riseHeight + LEAF_PARTICLE_FALL_DISTANCE) * eased;
      alpha = 1.0f - fp;
    }
    if (alpha <= 0.02f) continue;

    for (int k = 0; k < p.n; k++) {
      int px = roundI(p.x + p.pts[k].dx);
      int py = roundI(p.y + p.pts[k].dy + yOff);
      if (px < 0 || px >= HC_W || py < 0 || py >= HC_H) continue;
      PFCanvas::setPixel(px, py, to8(p.pts[k].r * alpha), to8(p.pts[k].g * alpha), to8(p.pts[k].b * alpha));
    }
  }
}

static void drawHen(HcHen& hen, float t, float stretchAmt, float squashAmt,
                    float stretchGate, float squashGate, float staggerLevel) {
  float phaseOffset = (hen.seq * staggerLevel * WALK_CYCLE) / 12.0f;
  float potPhase  = PFMath::fastSin(TAU_F * PFMath::fract((t + phaseOffset) / WALK_CYCLE));
  float birdPhase = PFMath::fastSin(TAU_F * PFMath::fract((t - BIRD_DELAY + phaseOffset) / WALK_CYCLE));
  float leafPhase = PFMath::fastSin(TAU_F * PFMath::fract((t - LEAF_DELAY + phaseOffset) / WALK_CYCLE));

  HcPart pot  = computePhaseState(potPhase,  stretchAmt, squashAmt, stretchGate, squashGate, tintColor, squashColor);
  HcPart bird = computePhaseState(birdPhase, stretchAmt, squashAmt, stretchGate, squashGate, tintColor, squashColor);
  HcPart leaf = computePhaseState(leafPhase, stretchAmt, squashAmt, stretchGate, squashGate, tintColor, squashColor);
  // pot tints only on its squash phase; hen/plant only on their stretch phase
  if (!pot.squashing) pot.tintStrength = 0.0f;
  if (bird.squashing) bird.tintStrength = 0.0f;
  if (leaf.squashing) leaf.tintStrength = 0.0f;

  float centerX = hen.x + HEN_W / 2.0f;
  float baseBottom = hen.y + HEN_H;
  pot.originYf = baseBottom - POT_ROWS * pot.scaleY;
  pot.originXf = centerX - (HEN_W * pot.scaleX) / 2.0f;
  bird.originYf = pot.originYf - BIRD_ROWS * bird.scaleY;
  bird.originXf = centerX - (HEN_W * bird.scaleX) / 2.0f;
  leaf.originYf = pot.originYf - BIRD_ROWS * leaf.scaleY;
  leaf.originXf = centerX - (HEN_W * leaf.scaleX) / 2.0f;

  maybeSpawnLeafParticle(hen, leaf, stretchGate, squashGate);

  // fresh occupancy per hen via a stamp instead of clearing the whole grid
  occStamp++;
  if (occStamp == 0) { memset(occupied, 0, (size_t)HC_W * HC_H); occStamp = 1; }

  HcGlow leafGlow   = drawPart(0, BIRD_ROWS, leaf, CODE_LEAF, 0);
  HcGlow birdGlow   = drawPart(0, BIRD_ROWS, bird, CODE_NOT_LEAF, 1);
  HcGlow potGlow    = drawPart(BIRD_ROWS, HEN_H, pot, CODE_ANY, 2);
  HcGlow letterGlow = drawLetter(hen, pot, bird, 3);

  applyGlow(leafGlow);
  applyGlow(birdGlow);
  applyGlow(potGlow);
  applyGlow(letterGlow);
}

// ---- interface ----
void setup() {
  PFMath::buildSinLUT();

  if (!particles) particles = (HcParticle*)PFMem::allocFloats((int)((sizeof(HcParticle) * MAX_PARTICLES + 3) / 4));
  if (!occupied)  occupied  = (uint8_t*)PFMem::allocFloats((HC_W * HC_H + 3) / 4);
  if (!glowBufs)  glowBufs  = (uint8_t*)PFMem::allocFloats((GLOW_SLOTS * GLOW_CAP + 3) / 4);
  if (particles) memset(particles, 0, sizeof(HcParticle) * MAX_PARTICLES);
  if (occupied)  memset(occupied, 0, (size_t)HC_W * HC_H);
  occStamp = 0;
  particleNext = 0;

  staggerKnob = 0.0f; stretchRaw = 0.0f; squashRaw = 0.0f; gapKnob = 0.7f;
  debugText[0] = 0;
  tintColor[0] = 5;    tintColor[1] = 45;   tintColor[2] = 190;
  squashColor[0] = 190; squashColor[1] = 15; squashColor[2] = 15;
  walkT = 0.0f; spawnIn = 0.0f;
  henCount = 0; henCounter = 0;
}

void update(float dt, const InputFrame& input) {
  float prev[4] = {staggerKnob, stretchRaw, squashRaw, gapKnob};

  PFParams::applyUnit(input, 0, &staggerKnob, 0.05f);
  PFParams::apply(input, 1, &stretchRaw, 0.0f, 1.0f, 1.0f / 48.0f);
  PFParams::apply(input, 2, &squashRaw, 0.0f, 1.0f, 1.0f / 48.0f);
  PFParams::applyUnit(input, 3, &gapKnob, 0.05f);

  float cur[4] = {staggerKnob, stretchRaw, squashRaw, gapKnob};
  for (int i = 0; i < 4; i++)
    if (fabsf(cur[i] - prev[i]) > 1e-6f) setDebug((char)('A' + i), cur[i]);

  if (input.btnPressed[1] && !input.paramAbsoluteActive[1] && !input.knobAudioActive[1]) for (int i = 0; i < 3; i++) tintColor[i] = (int)random(256);
  if (input.btnPressed[2] && !input.paramAbsoluteActive[2] && !input.knobAudioActive[2]) for (int i = 0; i < 3; i++) squashColor[i] = (int)random(256);

  if (!particles || !occupied || !glowBufs) return;

  walkT += dt;
  if (walkT >= WALK_CYCLE) walkT -= WALK_CYCLE;
  spawnIn -= dt;
  for (int i = 0; i < henCount; i++) hens[i].leafIn -= dt;
  for (int i = 0; i < MAX_PARTICLES; i++) if (particles[i].used) particles[i].age += dt;
  float offsetPx = MIN_OFFSET_PX + gapKnob * (MAX_OFFSET_PX - MIN_OFFSET_PX);

  if (spawnIn <= 0.0f && henCount < MAX_HENS) {
    float x = henCount ? hens[henCount - 1].x + offsetPx : (float)HC_W;
    HcHen& h = hens[henCount++];
    h.x = x;
    h.y = (float)(HC_H - HEN_H - 4);
    h.seq = henCounter;
    h.letter = MESSAGE[henCounter % MESSAGE_LEN];
    h.leafIn = LEAF_DROP_MIN + rnd01() * (LEAF_DROP_MAX - LEAF_DROP_MIN);
    henCounter++;
    spawnIn = SPAWN_INTERVAL;
  }

  // train coupling: only the lead moves freely
  if (henCount > 0) {
    hens[0].x -= HC_SPEED * dt;
    for (int i = 1; i < henCount; i++) hens[i].x = hens[i - 1].x + offsetPx;
  }

  int k = 0;
  for (int i = 0; i < henCount; i++)
    if (hens[i].x > -HEN_W) hens[k++] = hens[i];
  henCount = k;
}

void draw() {
  if (!particles || !occupied || !glowBufs) {
    hcClear();
    PFCanvas::present();
    return;
  }
  hcClear();

  float t = walkT;
  float stretchAmt = 0.1f + stretchRaw * 0.8f;
  float squashAmt = 0.1f + squashRaw * 0.8f;
  float stretchGate = clampf((stretchRaw - 0.5f) * 2.0f, 0.0f, 1.0f);
  float squashGate = clampf((squashRaw - 0.5f) * 2.0f, 0.0f, 1.0f);

  drawLeafParticles();

  float staggerLevel = staggerKnob * MAX_STAGGER;
  for (int i = 0; i < henCount; i++)
    drawHen(hens[i], t, stretchAmt, squashAmt, stretchGate, squashGate, staggerLevel);

  drawDebugText();
  PFCanvas::present();
}

} // namespace MestoHensCrossing