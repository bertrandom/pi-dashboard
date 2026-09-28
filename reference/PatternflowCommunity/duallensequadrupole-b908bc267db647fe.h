#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_math.h"
#include "src/core_mem.h"

namespace DualLenseQuadrupole {

const char* NAME = "Quad Lens";
const char* const KNOB_LABELS[4] = {"ShearStrength", "Rotation", "SourceScale", "Memory"};

constexpr int FRAME_W = 64;
constexpr int FRAME_H = 128;
constexpr int FRAME_SIZE = FRAME_W * FRAME_H;

// Knob parameter state
static float paramShearStrength = 1.73f;
static float paramRotation = 5.0f;
static float paramSourceScale = 3.772f;
static float paramMemory = 0.938f;

// Step sizes per detent
static constexpr float SHEAR_STEP = 0.115f;
static constexpr float ROTATION_STEP = 0.208f;
static constexpr float SOURCESCALE_STEP = 0.188f;
static constexpr float MEMORY_STEP = 0.003f;

// Time accumulator – unbounded; phase continuity ensured by pre‑wrapping per‑frame terms
static float tAccum = 0.0f;
static float peakEma = 1.0f;

// Field buffer (PSRAM)
static float* canvas = nullptr;

// Pre‑baked ramp LUT
static const uint8_t RAMP_LUT[256][3] = {
  {163,163,163},{154,154,154},{145,145,145},{136,136,136},{127,127,127},{119,119,119},{110,110,110},{101,101,101},
  {92,92,92},{83,83,83},{74,74,74},{65,65,65},{56,56,56},{48,48,48},{39,39,39},{30,30,30},
  {21,21,21},{12,12,12},{3,3,3},{1,0,0},{3,0,0},{5,0,0},{6,0,0},{8,0,0},
  {10,0,0},{11,0,0},{13,0,0},{15,0,0},{16,0,0},{18,0,0},{20,0,0},{22,0,0},
  {23,0,0},{25,0,0},{27,0,0},{28,0,0},{30,0,0},{32,0,0},{34,0,0},{35,0,0},
  {37,0,0},{39,0,0},{40,0,0},{42,0,0},{44,0,0},{45,0,0},{47,0,0},{49,0,0},
  {51,0,0},{52,0,0},{54,0,0},{56,0,0},{57,0,0},{59,0,0},{61,0,0},{63,0,0},
  {64,0,0},{66,0,0},{68,0,0},{69,0,0},{71,0,0},{73,0,0},{74,0,0},{76,0,0},
  {78,0,0},{80,0,0},{81,0,0},{83,0,0},{85,0,0},{86,0,0},{88,0,0},{90,0,0},
  {92,0,0},{93,0,0},{95,0,0},{97,0,0},{98,0,0},{100,0,0},{102,0,0},{103,0,0},
  {105,0,0},{107,0,0},{109,0,0},{110,0,0},{112,0,0},{114,0,0},{115,0,0},{117,0,0},
  {119,0,0},{121,0,0},{122,0,0},{124,0,0},{126,0,0},{127,0,0},{129,0,0},{131,0,0},
  {132,0,0},{134,0,0},{136,0,0},{138,0,0},{139,0,0},{141,0,0},{143,0,0},{144,0,0},
  {146,0,0},{148,0,0},{150,0,0},{151,0,0},{153,0,0},{155,0,0},{156,0,0},{158,0,0},
  {160,0,0},{162,0,0},{163,0,0},{165,0,0},{167,0,0},{168,0,0},{170,0,0},{172,0,0},
  {173,0,0},{175,0,0},{177,0,0},{179,0,0},{180,0,0},{182,0,0},{184,0,0},{185,0,0},
  {187,0,0},{189,0,0},{191,0,0},{192,0,0},{194,0,0},{196,0,0},{197,0,0},{199,0,0},
  {201,0,0},{202,0,0},{204,0,0},{206,0,0},{208,0,0},{209,0,0},{211,0,0},{213,0,0},
  {214,0,0},{216,0,0},{218,0,0},{220,0,0},{221,0,0},{223,0,0},{225,0,0},{226,0,0},
  {228,0,0},{230,0,0},{231,0,0},{233,0,0},{235,0,0},{237,0,0},{238,0,0},{240,0,0},
  {242,0,0},{243,0,0},{245,0,0},{247,0,0},{249,0,0},{250,0,0},{252,0,0},{254,0,0},
  {255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},
  {255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},
  {255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},
  {255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},
  {255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},
  {255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},
  {255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},
  {255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},
  {255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},
  {255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},
  {255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},
};

// Utility: wrap angle to [0, TWO_PI) cheaply (used only outside the pixel loop)
static inline float wrapAngleFast(float a) {
  while (a >= TWO_PI) a -= TWO_PI;
  while (a < 0.0f)   a += TWO_PI;
  return a;
}

void setup() {
  PFMath::buildSinLUT();

  if (!canvas) {
    canvas = PFMem::allocFloats(FRAME_SIZE);
  }

  if (canvas) {
    peakEma = 1.0f;
    tAccum  = 0.0f;

    const float warmShear   = 3.0f;
    const float warmRot     = 0.6f;
    const float warmScale   = 2.5f;
    const float warmMemory  = 0.93f;

    const float invW = 2.0f / (FRAME_W - 1);
    const float invH = 2.0f / (FRAME_H - 1);

    for (int step = 0; step < 50; ++step) {
      const float dt = 0.033f;
      tAccum += dt * warmRot;

      const float shear  = warmShear;
      const float scale  = warmScale;
      const float memory = warmMemory;
      const float t      = tAccum;

      // Decay buffer
      const float fade = fmaxf(0.70f, fminf(0.99f, memory));
      for (int i = 0; i < FRAME_SIZE; ++i) {
        canvas[i] *= fade;
      }

      // Quadrupole lens orientation — pre‑wrap cos/sin arguments
      const float tWrapped = wrapAngleFast(t);
      const float cosA = PFMath::fastCos(tWrapped);
      const float sinA = PFMath::fastSin(tWrapped);

      // Pre‑compute per‑row sin/cos for source waves
      const float t2  = wrapAngleFast(t * 2.0f);

      for (int y = 0; y < FRAME_H; ++y) {
        const float ny = y * invH - 1.0f;

        // Row‑dependent source term
        const float srcY = ny; // initial, will be modified per pixel
        const float wave2Base = PFMath::fastCos(srcY * scale * 12.0f - tWrapped);

        for (int x = 0; x < FRAME_W; ++x) {
          const float nx = x * invW - 1.0f;

          // Rotate to lens frame
          const float lx = nx * cosA - ny * sinA;
          const float ly = nx * sinA + ny * cosA;

          // Quadrupole deflection potentials
          const float rSq = lx * lx + ly * ly + 0.05f;
          const float invR4 = 1.0f / (rSq * rSq);
          const float defX = (shear * 0.15f * (lx * lx - ly * ly)) * invR4;
          const float defY = (-shear * 0.3f * lx * ly) * invR4;

          // Back‑projected source plane coordinates
          const float srcX = nx + defX;
          const float srcYDef = ny + defY;

          // Source sheet wave interference
          const float wave1 = PFMath::fastSin(srcX * scale * 6.0f + t2);
          const float wave2 = PFMath::fastCos(srcYDef * scale * 12.0f - tWrapped);
          const float photonDensity = sqrtf(fabsf(wave1 * wave2));

          // Caustic magnification
          const float detJ = fabsf(1.0f + (defX / (rSq + 0.01f))) * fabsf(1.0f + (defY / (rSq + 0.01f)));
          const float magnification = 0.2f / (detJ + 0.08f);

          const int idx = y * FRAME_W + x;
          canvas[idx] += photonDensity * magnification * 0.12f;

          if (!isfinite(canvas[idx])) {
            canvas[idx] = 0.0f;
          }
        }
      }

      // Dynamic scale tracking
      float maxV = 0.001f;
      for (int i = 0; i < FRAME_SIZE; ++i) {
        if (canvas[i] > maxV) maxV = canvas[i];
      }
      peakEma = peakEma * 0.94f + maxV * 0.06f;
    }
  }
}

void update(float dt, const InputFrame& input) {
  if (!canvas) return;

  paramShearStrength += input.knobDeltas[0] * SHEAR_STEP;
  paramRotation      += input.knobDeltas[1] * ROTATION_STEP;
  paramSourceScale   += input.knobDeltas[2] * SOURCESCALE_STEP;
  paramMemory        += input.knobDeltas[3] * MEMORY_STEP;

  paramShearStrength = fmaxf(0.5f, fminf(6.0f, paramShearStrength));
  paramRotation      = fmaxf(-5.0f, fminf(5.0f, paramRotation));
  paramSourceScale   = fmaxf(1.0f, fminf(10.0f, paramSourceScale));
  paramMemory        = fmaxf(0.82f, fminf(0.98f, paramMemory));

  const float safeDt = fminf(0.1f, dt);
  tAccum += safeDt * paramRotation;

  const float shear  = paramShearStrength;
  const float scale  = paramSourceScale;
  const float memory = paramMemory;
  const float t      = tAccum;

  // Decay buffer
  const float fade = fmaxf(0.70f, fminf(0.99f, memory));
  for (int i = 0; i < FRAME_SIZE; ++i) {
    canvas[i] *= fade;
  }

  // Quadrupole lens orientation — pre‑wrap cos/sin arguments
  const float tWrapped = wrapAngleFast(t);
  const float cosA = PFMath::fastCos(tWrapped);
  const float sinA = PFMath::fastSin(tWrapped);

  // Pre‑compute per‑frame time terms
  const float t2 = wrapAngleFast(t * 2.0f);

  const float invW = 2.0f / (FRAME_W - 1);
  const float invH = 2.0f / (FRAME_H - 1);

  for (int y = 0; y < FRAME_H; ++y) {
    const float ny = y * invH - 1.0f;

    for (int x = 0; x < FRAME_W; ++x) {
      const float nx = x * invW - 1.0f;

      // Rotate to lens frame
      const float lx = nx * cosA - ny * sinA;
      const float ly = nx * sinA + ny * cosA;

      // Quadrupole deflection potentials
      const float rSq = lx * lx + ly * ly + 0.05f;
      const float invR4 = 1.0f / (rSq * rSq);
      const float defX = (shear * 0.15f * (lx * lx - ly * ly)) * invR4;
      const float defY = (-shear * 0.3f * lx * ly) * invR4;

      // Back‑projected source plane coordinates
      const float srcX = nx + defX;
      const float srcY = ny + defY;

      // Source sheet wave interference
      const float wave1 = PFMath::fastSin(wrapAngleFast(srcX * scale * 6.0f + t2));
      const float wave2 = PFMath::fastCos(wrapAngleFast(srcY * scale * 12.0f - tWrapped));
      const float photonDensity = sqrtf(fabsf(wave1 * wave2));

      // Caustic magnification
      const float detJ = fabsf(1.0f + (defX / (rSq + 0.01f))) * fabsf(1.0f + (defY / (rSq + 0.01f)));
      const float magnification = 0.2f / (detJ + 0.08f);

      const int idx = y * FRAME_W + x;
      canvas[idx] += photonDensity * magnification * 0.12f;

      if (!isfinite(canvas[idx])) {
        canvas[idx] = 0.0f;
      }
    }
  }

  // Dynamic scale tracking
  float maxV = 0.001f;
  for (int i = 0; i < FRAME_SIZE; ++i) {
    if (canvas[i] > maxV) maxV = canvas[i];
  }
  peakEma = peakEma * 0.94f + maxV * 0.06f;
}

void draw() {
  PFCanvas::setFrame(FRAME_W, FRAME_H);

  if (!canvas) {
    PFCanvas::present();
    return;
  }

  const float peak    = fmaxf(0.001f, peakEma);
  const float invPeak = 1.0f / peak;

  for (int y = 0; y < FRAME_H; ++y) {
    for (int x = 0; x < FRAME_W; ++x) {
      const int idx = y * FRAME_W + x;
      float val = canvas[idx] * invPeak;

      if (!isfinite(val) || val < 0.0f) val = 0.0f;
      if (val > 1.0f) val = 1.0f;

      // Tone shaping
      val = val * val * (3.0f - 2.0f * val);

      int li = (int)(val * 255.0f + 0.5f);
      if (li < 0) li = 0;
      if (li > 255) li = 255;

      PFCanvas::setPixel(x, y, RAMP_LUT[li][0], RAMP_LUT[li][1], RAMP_LUT[li][2]);
    }
  }

  PFCanvas::present();
}

} // namespace DualLenseQuadrupole