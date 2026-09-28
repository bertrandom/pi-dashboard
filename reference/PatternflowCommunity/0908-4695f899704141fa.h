#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_params.h"
#include "src/core_math.h"
#include "src/core_mem.h"

// Reference only: stops 0.000:#000000, 0.231:#ff0066, 0.309:#fb00ff, 0.629:#ffffff; mode oklchShort; wrap off.

namespace Pattern0908 {

const char* NAME = "0908";
const char* const KNOB_LABELS[4] = {"Activity", "Agility", "Density", "Persistence"};
constexpr bool ABSOLUTE_READY = true;

constexpr int FRAME_W = 64;
constexpr int FRAME_H = 128;
constexpr int MAX_DEFECTS = 48;

static float kActivity = 50.248f;
static float kAgility = 3.086f;
static float kDensity = 36.259f;
static float kPersistence = 0.906f;

struct Defect {
  float x;
  float y;
  float vx;
  float vy;
  float charge;
  float orientation;
  bool active;
};

static Defect defects[MAX_DEFECTS];
static float* trail = nullptr;
static float simT = 0.0f;
static uint32_t rngSeed = 4242;

static inline float rnd() {
  rngSeed = (rngSeed * 1664525u + 1013904223u);
  return (float)rngSeed / 4294967296.0f;
}

static const uint8_t RAMP_LUT[256][3] = {
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{1,0,0},{2,0,0},{3,0,0},{6,0,1},
  {8,0,1},{12,0,2},{15,0,2},{19,0,3},{23,0,4},{27,0,5},{31,0,6},{35,0,7},
  {39,0,9},{43,0,11},{47,0,12},{51,0,14},{56,0,16},{60,0,18},{65,0,20},{69,0,22},
  {74,0,24},{78,0,26},{83,0,28},{87,0,30},{92,0,32},{97,0,34},{102,0,36},{107,0,38},
  {111,0,40},{116,0,42},{121,0,44},{126,0,47},{131,0,49},{136,0,51},{142,0,53},{147,0,55},
  {152,0,57},{157,0,60},{162,0,62},{168,0,64},{173,0,67},{178,0,69},{183,0,71},{189,0,73},
  {194,0,76},{200,0,78},{205,0,81},{211,0,83},{216,0,85},{222,0,88},{227,0,90},{233,0,92},
  {239,0,95},{244,0,97},{250,0,100},{255,1,103},{255,7,110},{255,13,118},{255,17,125},{255,21,132},
  {255,23,139},{255,25,146},{255,27,153},{255,28,160},{255,28,168},{255,28,175},{255,28,182},{255,27,190},
  {255,25,198},{255,22,206},{255,16,214},{255,7,223},{255,0,231},{253,0,240},{252,0,248},{251,5,255},
  {251,24,255},{252,35,255},{252,43,255},{252,50,255},{252,56,255},{252,62,255},{253,67,255},{253,72,255},
  {253,76,255},{253,80,255},{253,84,255},{254,88,255},{254,92,255},{254,96,255},{254,99,255},{254,102,255},
  {254,106,255},{255,109,255},{255,112,255},{255,115,255},{255,118,255},{255,121,255},{255,124,255},{255,127,255},
  {255,130,254},{255,133,254},{255,136,254},{255,139,254},{255,141,254},{255,144,254},{255,147,254},{255,149,254},
  {255,152,254},{255,154,254},{255,157,253},{255,159,253},{255,162,253},{255,164,253},{255,167,253},{255,169,253},
  {255,171,253},{255,174,253},{255,176,253},{255,178,253},{255,181,253},{255,183,253},{255,185,253},{255,187,253},
  {255,189,253},{255,192,253},{255,194,253},{255,196,253},{255,198,253},{255,200,253},{255,202,253},{255,204,253},
  {255,207,253},{255,209,253},{255,211,253},{255,213,253},{255,215,253},{255,217,253},{255,219,253},{255,221,253},
  {255,223,253},{255,225,254},{255,227,254},{255,229,254},{255,231,254},{255,233,254},{255,235,254},{255,237,254},
  {255,239,254},{255,241,254},{255,243,254},{255,245,254},{255,247,254},{255,248,255},{255,250,255},{255,252,255},
  {255,254,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
  {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
  {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
  {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
  {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
  {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
  {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
  {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
  {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
  {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
  {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
  {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
};

void setup() {
  PFMath::buildSinLUT();

  if (!trail) {
    trail = PFMem::allocFloats(FRAME_W * FRAME_H);
  }
  if (!trail) return;

  simT = 0.0f;
  rngSeed = 4242;

  for (int i = 0; i < MAX_DEFECTS; i++) {
    defects[i].x = rnd() * (float)FRAME_W;
    defects[i].y = rnd() * (float)FRAME_H;
    defects[i].vx = 0.0f;
    defects[i].vy = 0.0f;
    defects[i].charge = (i % 2 == 0) ? 0.5f : -0.5f;
    defects[i].orientation = rnd() * TWO_PI;
    defects[i].active = true;
  }
}

void update(float dt, const InputFrame& input) {
  if (!trail) return;

  PFParams::apply(input, 0, &kActivity, 0.2f, 58.8f, 1.221f);
  PFParams::apply(input, 1, &kAgility, 0.5f, 15.0f, 0.302f);
  PFParams::apply(input, 2, &kDensity, 12.0f, 46.0f, 0.708f);
  PFParams::apply(input, 3, &kPersistence, 0.88f, 0.98f, 0.002f);

  const float dtClamped = fminf(dt, 0.1f);
  simT += dtClamped;
  if (simT > TWO_PI * 100.0f) {
    simT -= TWO_PI * 100.0f;
  }

  int targetCount = (int)kDensity;
  if (targetCount < 0) targetCount = 0;
  if (targetCount > MAX_DEFECTS) targetCount = MAX_DEFECTS;

  for (int i = 0; i < MAX_DEFECTS; i++) {
    defects[i].active = (i < targetCount);
  }

  for (int i = 0; i < targetCount; i++) {
    Defect& d1 = defects[i];
    if (!d1.active) continue;

    float fx = 0.0f;
    float fy = 0.0f;

    if (d1.charge == 0.5f) {
      const float vProp = 12.0f * kActivity;
      fx += PFMath::fastCos(d1.orientation) * vProp;
      fy += PFMath::fastSin(d1.orientation) * vProp;
    }

    for (int j = 0; j < targetCount; j++) {
      if (i == j) continue;
      Defect& d2 = defects[j];
      if (!d2.active) continue;

      float dx = d2.x - d1.x;
      float dy = d2.y - d1.y;

      if (dx > (float)FRAME_W * 0.5f) dx -= (float)FRAME_W;
      if (dx < -(float)FRAME_W * 0.5f) dx += (float)FRAME_W;
      if (dy > (float)FRAME_H * 0.5f) dy -= (float)FRAME_H;
      if (dy < -(float)FRAME_H * 0.5f) dy += (float)FRAME_H;

      const float distSq = dx * dx + dy * dy + 1.0f;
      const float dist = sqrtf(distSq);

      if (dist < 20.0f) {
        const float force = ((d1.charge * d2.charge > 0.0f) ? -15.0f : 25.0f) / distSq;
        fx += (dx / dist) * force * kAgility;
        fy += (dy / dist) * force * kAgility;

        if (dist < 2.5f && d1.charge != d2.charge) {
          d1.x = rnd() * (float)FRAME_W;
          d1.y = rnd() * (float)FRAME_H;
          d1.orientation = rnd() * TWO_PI;

          d2.x = rnd() * (float)FRAME_W;
          d2.y = rnd() * (float)FRAME_H;
          d2.orientation = rnd() * TWO_PI;
        }
      }
    }

    d1.vx = d1.vx * 0.8f + fx * dtClamped * 2.0f;
    d1.vy = d1.vy * 0.8f + fy * dtClamped * 2.0f;

    d1.orientation += (rnd() - 0.5f) * 2.0f * kAgility * dtClamped;
    if (d1.orientation > TWO_PI) d1.orientation -= TWO_PI;
    else if (d1.orientation < -TWO_PI) d1.orientation += TWO_PI;

    d1.x = PFMath::jsMod(d1.x + d1.vx * dtClamped + (float)FRAME_W, (float)FRAME_W);
    d1.y = PFMath::jsMod(d1.y + d1.vy * dtClamped + (float)FRAME_H, (float)FRAME_H);

    if (!isfinite(d1.x) || !isfinite(d1.y)) {
      d1.x = rnd() * (float)FRAME_W;
      d1.y = rnd() * (float)FRAME_H;
      d1.vx = 0.0f;
      d1.vy = 0.0f;
    }
  }

  const float decay = powf(kPersistence, dtClamped * 30.0f);
  const int totalPixels = FRAME_W * FRAME_H;
  for (int idx = 0; idx < totalPixels; idx++) {
    trail[idx] *= decay;
  }

  for (int i = 0; i < targetCount; i++) {
    const Defect& d = defects[i];
    if (!d.active) continue;

    const int px = (int)floorf(d.x);
    const int py = (int)floorf(d.y);
    const int radius = (d.charge == 0.5f) ? 2 : 1;
    const float intensity = (d.charge == 0.5f) ? 0.9f : 0.4f;
    const float denomInv = 1.0f / (float)(radius * radius + 1);

    for (int ry = -radius; ry <= radius; ry++) {
      for (int rx = -radius; rx <= radius; rx++) {
        const int gx = (px + rx + FRAME_W) % FRAME_W;
        const int gy = (py + ry + FRAME_H) % FRAME_H;
        const int idx = gy * FRAME_W + gx;

        const float deposit = intensity * (1.0f - (float)(rx * rx + ry * ry) * denomInv);
        trail[idx] = fminf(1.0f, trail[idx] + deposit);
      }
    }
  }
}

void draw() {
  PFCanvas::setFrame(FRAME_W, FRAME_H);

  if (!trail) {
    PFCanvas::present();
    return;
  }

  for (int y = 0; y < FRAME_H; y++) {
    const int row = y * FRAME_W;
    for (int x = 0; x < FRAME_W; x++) {
      const int idx = row + x;
      const float v = fminf(1.0f, fmaxf(0.0f, trail[idx]));
      const float smoothVal = v * v * (3.0f - 2.0f * v);
      const float clampedVal = fminf(1.0f, fmaxf(0.0f, smoothVal));
      const int li = (int)(clampedVal * 255.0f + 0.5f);

      PFCanvas::setPixel(x, y, RAMP_LUT[li][0], RAMP_LUT[li][1], RAMP_LUT[li][2]);
    }
  }

  PFCanvas::present();
}

} // namespace Pattern0908