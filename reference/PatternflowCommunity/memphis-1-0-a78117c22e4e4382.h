#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_math.h"
#include "src/core_color.h"
#include "src/core_noise.h"

namespace MemphisPattern {

const char* NAME = "Memphis";
const char* const KNOB_LABELS[4] = {"Palette Shift", "Speed", "Density", "Scale"};

// ---- Pattern Lab knob ranges / current values ----
static const float MEMPHIS_K0_MIN = 0.0f,   MEMPHIS_K0_MAX = 1.0f,   MEMPHIS_K0_STEP = 0.05f, MEMPHIS_K0_CURRENT = 0.0f;
static const float MEMPHIS_K1_MIN = 0.05f,  MEMPHIS_K1_MAX = 5.0f,   MEMPHIS_K1_STEP = 0.1f,  MEMPHIS_K1_CURRENT = 2.0f;
static const float MEMPHIS_K2_MIN = 10.0f,  MEMPHIS_K2_MAX = 120.0f, MEMPHIS_K2_STEP = 0.05f, MEMPHIS_K2_CURRENT = 10.0f;
static const float MEMPHIS_K3_MIN = 2.0f,   MEMPHIS_K3_MAX = 10.0f,  MEMPHIS_K3_STEP = 0.05f, MEMPHIS_K3_CURRENT = 2.0f;

// t feeds fastSin/fastCos through multipliers 0.35, 1.3, 0.8 (all multiples of 1/20).
// Common wrap period so all three stay phase-continuous: 40*PI.
static const float MEMPHIS_T_PERIOD = 40.0f * PI;

struct MemphisRGBf { float r, g, b; };
static const MemphisRGBf MEMPHIS_PALETTE[5] = {
  { 255.0f, 20.0f,  147.0f }, // hot pink
  { 255.0f, 214.0f, 0.0f   }, // sunshine yellow
  { 0.0f,   229.0f, 255.0f }, // cyan
  { 255.0f, 59.0f,  48.0f  }, // coral red
  { 191.0f, 64.0f,  255.0f }, // violet
};

struct MemphisAccent {
  float x, y, r;
  uint8_t cr, cg, cb;
};

// ---- state ----
static float paletteShift = MEMPHIS_K0_CURRENT;
static float speedParam   = MEMPHIS_K1_CURRENT;
static float densityParam = MEMPHIS_K2_CURRENT;
static float scaleParam   = MEMPHIS_K3_CURRENT;
static float scaleMult    = 0.7f + ((MEMPHIS_K3_CURRENT - MEMPHIS_K3_MIN) / (MEMPHIS_K3_MAX - MEMPHIS_K3_MIN)) * 0.6f;
static float t = 0.0f;
static float huePhase = 0.0f;

static MemphisAccent accents[4];

static inline float memphisClamp(float v, float lo, float hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

static inline float memphisWrap(float v, float lo, float hi) {
  float range = hi - lo;
  if (range <= 0.0f) return lo;
  float w = fmodf(v - lo, range);
  if (w < 0.0f) w += range;
  return w + lo;
}

static MemphisRGBf paletteColor(float offset) {
  const int n = 5;
  float pos = fmodf(paletteShift * n + offset, (float)n);
  if (pos < 0.0f) pos += (float)n;
  int i0 = ((int)floorf(pos)) % n;
  if (i0 < 0) i0 += n;
  int i1 = (i0 + 1) % n;
  float f = pos - floorf(pos);
  MemphisRGBf c0 = MEMPHIS_PALETTE[i0];
  MemphisRGBf c1 = MEMPHIS_PALETTE[i1];
  MemphisRGBf out;
  out.r = c0.r + (c1.r - c0.r) * f;
  out.g = c0.g + (c1.g - c0.g) * f;
  out.b = c0.b + (c1.b - c0.b) * f;
  return out;
}

void setup() {
  PFMath::buildSinLUT();
  t = 0.0f;
  huePhase = 0.0f;
  paletteShift = MEMPHIS_K0_CURRENT;
  speedParam   = MEMPHIS_K1_CURRENT;
  densityParam = MEMPHIS_K2_CURRENT;
  scaleParam   = MEMPHIS_K3_CURRENT;
  scaleMult    = 0.7f + ((scaleParam - MEMPHIS_K3_MIN) / (MEMPHIS_K3_MAX - MEMPHIS_K3_MIN)) * 0.6f;
}

void update(float dt, const InputFrame& input) {
  paletteShift += input.knobDeltas[0] * MEMPHIS_K0_STEP;
  paletteShift = memphisWrap(paletteShift, MEMPHIS_K0_MIN, MEMPHIS_K0_MAX);

  speedParam += input.knobDeltas[1] * MEMPHIS_K1_STEP;
  speedParam = memphisClamp(speedParam, MEMPHIS_K1_MIN, MEMPHIS_K1_MAX);

  densityParam += input.knobDeltas[2] * MEMPHIS_K2_STEP;
  densityParam = memphisClamp(densityParam, MEMPHIS_K2_MIN, MEMPHIS_K2_MAX);

  scaleParam += input.knobDeltas[3] * MEMPHIS_K3_STEP;
  scaleParam = memphisWrap(scaleParam, MEMPHIS_K3_MIN, MEMPHIS_K3_MAX);

  float scaleNorm = (scaleParam - MEMPHIS_K3_MIN) / (MEMPHIS_K3_MAX - MEMPHIS_K3_MIN);
  scaleMult = 0.7f + scaleNorm * 0.6f;

  t += dt * speedParam;
  if (t > MEMPHIS_T_PERIOD) t -= MEMPHIS_T_PERIOD;

  huePhase = PFMath::fract(huePhase + dt * 0.02f);
}

void draw() {
  const float bgR = 245.0f, bgG = 238.0f, bgB = 222.0f;

  const float ringCx = PANEL_RES_W * 0.26f;
  const float ringCy = PANEL_RES_H * 0.36f;
  const float ringOuter = PANEL_RES_H * 0.30f * scaleMult;
  const float ringInner = ringOuter * 0.62f;
  const float ringOuter2 = ringOuter * ringOuter;
  const float ringInner2 = ringInner * ringInner;
  const MemphisRGBf ringColor = paletteColor(0.0f);

  const float triCx = PANEL_RES_W * 0.72f;
  const float triCy = PANEL_RES_H * 0.30f;
  const float triSize = PANEL_RES_H * 0.30f * scaleMult;
  const float triAngle = t * 0.35f;
  const float cosA = PFMath::fastCos(triAngle);
  const float sinA = PFMath::fastSin(triAngle);
  const MemphisRGBf triColor = paletteColor(1.6f);
  const float triH = triSize;

  struct EdgeNormal { float nx, ny, d; };
  const EdgeNormal edgeNormals[3] = {
    { 0.0f,    -1.0f, triH * 0.6f },
    { 0.866f,   0.5f, triH * 0.6f },
    { -0.866f,  0.5f, triH * 0.6f },
  };

  const float squiggleAmp = PANEL_RES_H * 0.07f * scaleMult;
  const float squiggleFreq = 0.16f;
  const float squiggleSpeed = 1.3f;
  const float squiggleBaseY = PANEL_RES_H * 0.78f;
  const float squiggleThickness = PANEL_RES_H * 0.045f * scaleMult + 1.5f;
  const float squiggleColorR = 20.0f, squiggleColorG = 20.0f, squiggleColorB = 24.0f;

  const float dotSpacing = 10.0f;
  const float dotRadius = 1.6f;
  const float dotRadius2 = dotRadius * dotRadius;
  const MemphisRGBf dotColorA = paletteColor(3.2f);
  const MemphisRGBf dotColorB = paletteColor(4.1f);
  const float gridOffsetX = t * 1.4f;
  const float gridOffsetY = t * 0.9f;

  int accentCount = (int)memphisClamp(floorf(densityParam), 0.0f, 4.0f);

  for (int i = 0; i < accentCount; i++) {
    float hx = PFNoise::cellHash(i, 0, 1);
    float hy = PFNoise::cellHash(i, 0, 2);
    float hs = PFNoise::cellHash(i, 0, 3);
    float hue = PFMath::fract(paletteShift + i * 0.19f + huePhase);

    uint8_t cr, cg, cb;
    PFColor::hsvToRgb(hue, 0.85f, 1.0f, cr, cg, cb);

    float baseX = PANEL_RES_W * (0.08f + hx * 0.84f);
    float baseY = PANEL_RES_H * (0.55f + hy * 0.4f);
    float orbitPhase = i * 1.9f + hs * 6.28f;
    float orbitRadius = (PANEL_RES_H * 0.035f) * scaleMult;
    float orbitX = PFMath::fastCos(t * 0.8f + orbitPhase) * orbitRadius;
    float orbitY = PFMath::fastSin(t * 0.8f + orbitPhase) * orbitRadius;

    accents[i].x = baseX + orbitX;
    accents[i].y = baseY + orbitY;
    accents[i].r = (PANEL_RES_H * 0.045f + hs * PANEL_RES_H * 0.03f) * scaleMult;
    accents[i].cr = cr;
    accents[i].cg = cg;
    accents[i].cb = cb;
  }

  for (int x = 0; x < PANEL_RES_W; x++) {
    float dxRing = (float)x - ringCx;
    float dxTri = (float)x - triCx;

    float colPhase = x * squiggleFreq + t * squiggleSpeed;
    float squiggleY = squiggleBaseY + PFMath::fastSin(colPhase) * squiggleAmp;

    float gridX = (float)x + gridOffsetX;
    float cellXf = floorf(gridX / dotSpacing);
    float gridLocalX = gridX - cellXf * dotSpacing - dotSpacing * 0.5f;
    int cellX = (int)cellXf;

    for (int y = 0; y < PANEL_RES_H; y++) {
      float r = bgR, g = bgG, b = bgB;

      float gridY = (float)y + gridOffsetY;
      float cellYf = floorf(gridY / dotSpacing);
      float gridLocalY = gridY - cellYf * dotSpacing - dotSpacing * 0.5f;
      int cellY = (int)cellYf;
      float dSq = gridLocalX * gridLocalX + gridLocalY * gridLocalY;
      if (dSq < dotRadius2) {
        bool useA = ((cellX + cellY) & 1) == 0;
        const MemphisRGBf& dc = useA ? dotColorA : dotColorB;
        r = dc.r; g = dc.g; b = dc.b;
      }

      for (int i = 0; i < accentCount; i++) {
        const MemphisAccent& a = accents[i];
        float adx = (float)x - a.x;
        float ady = (float)y - a.y;
        if (adx * adx + ady * ady < a.r * a.r) {
          r = a.cr; g = a.cg; b = a.cb;
        }
      }

      float dyRing = (float)y - ringCy;
      float distR2 = dxRing * dxRing + dyRing * dyRing;
      if (distR2 < ringOuter2 && distR2 > ringInner2) {
        r = ringColor.r; g = ringColor.g; b = ringColor.b;
      } else if (distR2 <= ringInner2 * 0.18f) {
        r = 30.0f; g = 30.0f; b = 34.0f;
      }

      float dyTri = (float)y - triCy;
      float rdx = dxTri * cosA + dyTri * sinA;
      float rdy = -dxTri * sinA + dyTri * cosA;
      bool insideTri = true;
      for (int e = 0; e < 3; e++) {
        const EdgeNormal& en = edgeNormals[e];
        if (en.nx * rdx + en.ny * rdy > en.d) { insideTri = false; break; }
      }
      if (insideTri) {
        r = triColor.r; g = triColor.g; b = triColor.b;
      }

      if (fabsf((float)y - squiggleY) < squiggleThickness) {
        r = squiggleColorR; g = squiggleColorG; b = squiggleColorB;
      }

      PFCanvas::setPixel(x, y, (uint8_t)r, (uint8_t)g, (uint8_t)b);
    }
  }

  PFCanvas::present();
}

} // namespace MemphisPattern