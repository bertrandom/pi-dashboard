#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_math.h"
#include "src/core_mem.h"

namespace ParabolicWavefront {

const char* NAME = "Wave Cascade";
const char* const KNOB_LABELS[4] = {"Curvature", "FlowSpeed", "WaveFreq", "Dissipation"};

constexpr int FRAME_W = 64;
constexpr int FRAME_H = 128;
constexpr int FRAME_SIZE = FRAME_W * FRAME_H;

// Knob parameter state
static float paramCurvature = 0.405f;
static float paramFlowSpeed = 1.691f;
static float paramWaveFreq = 6.315f;
static float paramDissipation = 0.97f;

// Step sizes per detent
static constexpr float CURVATURE_STEP = 0.069f;
static constexpr float FLOWSPEED_STEP = 0.123f;
static constexpr float WAVEFREQ_STEP = 0.208f;
static constexpr float DISSIPATION_STEP = 0.004f;

// Time accumulator – unbounded; phase continuity ensured by pre‑wrapping per‑frame terms
static float tAccum = 0.0f;
static float peakEma = 1.0f;

// Wave field buffer (PSRAM)
static float* waveBuf = nullptr;

// Pre‑baked ramp LUT
static const uint8_t RAMP_LUT[256][3] = {
  {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
  {0,0,0},{0,0,1},{0,0,1},{0,0,1},{1,0,1},{1,0,2},{1,0,2},{1,0,3},
  {1,0,4},{1,0,4},{2,0,5},{2,0,6},{2,0,7},{3,0,8},{3,0,9},{4,0,10},
  {4,0,12},{5,0,13},{5,0,14},{6,0,16},{6,0,17},{7,0,19},{8,0,20},{9,0,21},
  {10,0,23},{11,0,24},{11,0,26},{12,0,27},{13,0,29},{14,0,30},{15,0,32},{16,0,33},
  {17,0,35},{18,0,36},{19,0,38},{20,0,39},{21,0,41},{22,0,43},{23,0,44},{24,0,46},
  {25,0,47},{26,0,49},{27,0,51},{28,0,52},{29,0,54},{30,0,55},{31,0,57},{32,0,59},
  {34,0,60},{35,0,62},{36,0,64},{37,0,65},{38,0,67},{39,0,69},{40,0,70},{41,0,72},
  {42,0,74},{43,0,76},{44,0,77},{46,0,79},{47,0,81},{48,0,83},{49,0,84},{50,0,86},
  {51,0,88},{52,0,90},{53,0,91},{55,0,93},{56,0,95},{57,0,97},{58,0,99},{59,0,100},
  {60,0,102},{61,0,104},{63,0,106},{64,0,108},{65,0,109},{66,0,111},{67,0,113},{68,0,115},
  {70,0,117},{71,0,119},{72,0,121},{73,1,123},{73,3,125},{73,6,128},{73,10,130},{72,13,133},
  {72,16,135},{72,19,138},{71,21,140},{71,24,143},{70,26,145},{70,28,148},{69,31,150},{68,33,153},
  {68,35,155},{67,38,157},{66,40,159},{65,42,162},{64,44,164},{62,46,166},{61,48,168},{60,51,170},
  {58,53,172},{57,55,174},{55,57,176},{53,59,178},{51,61,180},{48,64,182},{46,66,184},{43,68,186},
  {39,70,187},{36,72,189},{31,74,191},{26,77,192},{19,79,194},{10,81,195},{0,84,196},{0,87,192},
  {0,90,189},{0,93,186},{0,96,184},{0,98,182},{0,100,181},{0,102,180},{0,104,179},{0,106,178},
  {0,108,177},{0,110,177},{0,112,176},{0,114,176},{0,116,175},{0,118,175},{0,119,175},{0,121,175},
  {0,123,175},{0,124,175},{0,126,175},{0,128,175},{0,130,175},{0,131,175},{0,133,175},{0,135,175},
  {0,136,175},{0,138,175},{0,140,176},{0,141,176},{0,143,176},{0,144,176},{0,146,176},{0,148,177},
  {0,149,177},{0,151,177},{0,153,177},{0,154,177},{0,156,177},{0,158,178},{0,159,178},{0,161,178},
  {0,162,178},{0,164,178},{0,166,178},{0,167,178},{0,169,179},{0,171,179},{0,172,179},{0,174,179},
  {0,176,179},{0,177,179},{0,179,178},{0,181,178},{0,182,178},{0,184,178},{0,186,178},{0,188,178},
  {0,189,177},{0,191,177},{0,193,177},{0,194,176},{0,196,176},{0,198,175},{0,200,174},{0,201,174},
  {0,203,173},{0,205,172},{0,207,171},{0,208,170},{0,210,169},{0,212,168},{0,214,166},{0,216,165},
  {0,217,163},{0,219,161},{0,221,159},{0,223,157},{0,225,155},{0,227,152},{0,229,149},{0,230,146},
  {0,232,142},{0,234,138},{0,236,134},{0,238,129},{0,240,124},{0,242,117},{0,244,110},{34,245,106},
  {53,246,102},{68,247,97},{79,248,93},{90,249,89},{99,249,84},{108,250,79},{116,251,74},{124,252,68},
  {132,252,62},{139,253,55},{146,253,47},{153,254,37},{160,255,24},{166,255,0},{166,255,0},{166,255,0},
  {166,255,0},{166,255,0},{166,255,0},{166,255,0},{166,255,0},{166,255,0},{166,255,0},{166,255,0},
  {166,255,0},{166,255,0},{166,255,0},{166,255,0},{166,255,0},{166,255,0},{166,255,0},{166,255,0},
  {166,255,0},{166,255,0},{166,255,0},{166,255,0},{166,255,0},{166,255,0},{166,255,0},{166,255,0},
};

// Utility: wrap angle to [0, TWO_PI) cheaply (used only outside the pixel loop)
static inline float wrapAngleFast(float a) {
  while (a >= TWO_PI) a -= TWO_PI;
  while (a < 0.0f)   a += TWO_PI;
  return a;
}

void setup() {
  PFMath::buildSinLUT();

  if (!waveBuf) {
    waveBuf = PFMem::allocFloats(FRAME_SIZE);
  }

  if (waveBuf) {
    peakEma = 1.0f;
    tAccum  = 0.0f;

    const float warmCurvature   = 0.405f;
    const float warmSpeed       = 1.691f;
    const float warmFreq        = 6.315f;
    const float warmDissipation = 0.97f;

    const float invW = 2.0f / (FRAME_W - 1);
    const float invH = 2.0f / (FRAME_H - 1);

    for (int step = 0; step < 40; ++step) {
      const float dt = 0.033f;
      tAccum += dt * warmSpeed;

      const float curvature   = warmCurvature;
      const float freq        = warmFreq;
      const float dissipation = warmDissipation;
      const float t           = tAccum;

      // -- dissipation --
      const float decay = fmaxf(0.75f, fminf(0.98f, dissipation));
      for (int i = 0; i < FRAME_SIZE; ++i) waveBuf[i] *= decay;

      // -- per‑frame wrapped time terms --
      const float slowMorph = PFMath::fastSin(wrapAngleFast(t * 0.13f)) * 0.3f + 1.0f;
      const float t3        = wrapAngleFast(t * 3.0f);

      // Pre‑compute sin(nx*4 + t) for each x
      float sinX[FRAME_W];
      for (int x = 0; x < FRAME_W; ++x) {
        const float nx = x * invW - 1.0f;
        sinX[x] = PFMath::fastSin(wrapAngleFast(nx * 4.0f + t));
      }

      // -- wave field update --
      for (int y = 0; y < FRAME_H; ++y) {
        const float ny = y * invH - 1.0f;
        for (int x = 0; x < FRAME_W; ++x) {
          const float nx = x * invW - 1.0f;

          const float mirrorShape = curvature * (nx * nx - ny * ny * 0.5f) + sinX[x] * 0.15f;
          const float pathDist    = sqrtf(nx * nx + (ny + 1.5f) * (ny + 1.5f)) * slowMorph;
          const float phase       = pathDist * freq - t3 + mirrorShape * 4.0f;

          // Wrap phase to [0, TWO_PI) – at most a few iterations
          float ph = phase;
          while (ph >= TWO_PI) ph -= TWO_PI;
          while (ph < 0.0f)    ph += TWO_PI;

          const float amplitude = PFMath::fastCos(ph)
                                + PFMath::fastCos(wrapAngleFast(ph * 0.5f + mirrorShape));

          const float causticIntensity = 1.0f / (0.1f + fabsf(amplitude));
          const int idx = y * FRAME_W + x;
          waveBuf[idx] += causticIntensity * 0.08f;
          if (!isfinite(waveBuf[idx])) waveBuf[idx] = 0.0f;
        }
      }

      // -- peak tracking --
      float maxV = 0.001f;
      for (int i = 0; i < FRAME_SIZE; ++i) {
        if (waveBuf[i] > maxV) maxV = waveBuf[i];
      }
      peakEma = peakEma * 0.93f + maxV * 0.07f;
    }
  }
}

void update(float dt, const InputFrame& input) {
  if (!waveBuf) return;

  paramCurvature   += input.knobDeltas[0] * CURVATURE_STEP;
  paramFlowSpeed   += input.knobDeltas[1] * FLOWSPEED_STEP;
  paramWaveFreq    += input.knobDeltas[2] * WAVEFREQ_STEP;
  paramDissipation += input.knobDeltas[3] * DISSIPATION_STEP;

  paramCurvature   = fmaxf(0.2f,  fminf(3.5f,  paramCurvature));
  paramFlowSpeed   = fmaxf(0.1f,  fminf(6.0f,  paramFlowSpeed));
  paramWaveFreq    = fmaxf(1.999f,fminf(12.0f, paramWaveFreq));
  paramDissipation = fmaxf(0.8f,  fminf(0.97f, paramDissipation));

  const float safeDt = fminf(0.1f, dt);
  tAccum += safeDt * paramFlowSpeed;

  const float curvature   = paramCurvature;
  const float freq        = paramWaveFreq;
  const float dissipation = paramDissipation;
  const float t           = tAccum;

  // -- dissipation --
  const float decay = fmaxf(0.75f, fminf(0.98f, dissipation));
  for (int i = 0; i < FRAME_SIZE; ++i) waveBuf[i] *= decay;

  // -- per‑frame wrapped time terms --
  const float invW      = 2.0f / (FRAME_W - 1);
  const float invH      = 2.0f / (FRAME_H - 1);
  const float slowMorph = PFMath::fastSin(wrapAngleFast(t * 0.13f)) * 0.3f + 1.0f;
  const float t3        = wrapAngleFast(t * 3.0f);

  // Pre‑compute sin(nx*4 + t) for each x
  float sinX[FRAME_W];
  for (int x = 0; x < FRAME_W; ++x) {
    const float nx = x * invW - 1.0f;
    sinX[x] = PFMath::fastSin(wrapAngleFast(nx * 4.0f + t));
  }

  // -- wave field update --
  for (int y = 0; y < FRAME_H; ++y) {
    const float ny = y * invH - 1.0f;
    for (int x = 0; x < FRAME_W; ++x) {
      const float nx = x * invW - 1.0f;

      const float mirrorShape = curvature * (nx * nx - ny * ny * 0.5f) + sinX[x] * 0.15f;
      const float pathDist    = sqrtf(nx * nx + (ny + 1.5f) * (ny + 1.5f)) * slowMorph;
      const float phase       = pathDist * freq - t3 + mirrorShape * 4.0f;

      // Wrap phase to [0, TWO_PI) cheaply (at most ~7 iterations)
      float ph = phase;
      while (ph >= TWO_PI) ph -= TWO_PI;
      while (ph < 0.0f)    ph += TWO_PI;

      const float amplitude = PFMath::fastCos(ph)
                            + PFMath::fastCos(wrapAngleFast(ph * 0.5f + mirrorShape));

      const float causticIntensity = 1.0f / (0.1f + fabsf(amplitude));
      const int idx = y * FRAME_W + x;
      waveBuf[idx] += causticIntensity * 0.08f;
      if (!isfinite(waveBuf[idx])) waveBuf[idx] = 0.0f;
    }
  }

  // -- peak tracking --
  float maxV = 0.001f;
  for (int i = 0; i < FRAME_SIZE; ++i) {
    if (waveBuf[i] > maxV) maxV = waveBuf[i];
  }
  peakEma = peakEma * 0.93f + maxV * 0.07f;
}

void draw() {
  PFCanvas::setFrame(FRAME_W, FRAME_H);

  if (!waveBuf) {
    PFCanvas::present();
    return;
  }

  const float peak    = fmaxf(0.001f, peakEma);
  const float invPeak = 1.0f / peak;

  for (int y = 0; y < FRAME_H; ++y) {
    for (int x = 0; x < FRAME_W; ++x) {
      const int idx = y * FRAME_W + x;
      float val = waveBuf[idx] * invPeak;

      if (!isfinite(val) || val < 0.0f) val = 0.0f;
      if (val > 1.0f) val = 1.0f;

      // Smooth contrast mapping
      val = val * val * (3.0f - 2.0f * val);

      int li = (int)(val * 255.0f + 0.5f);
      if (li < 0) li = 0;
      if (li > 255) li = 255;

      PFCanvas::setPixel(x, y, RAMP_LUT[li][0], RAMP_LUT[li][1], RAMP_LUT[li][2]);
    }
  }

  PFCanvas::present();
}

} // namespace ParabolicWavefront