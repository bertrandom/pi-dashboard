#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_params.h"
#include "src/core_math.h"
#include "src/core_noise.h"
#include "src/core_mem.h"

namespace CryptfireBeacon {

const char* NAME = "Cryptfire Beacon";
const char* const KNOB_LABELS[4] = {"Flame", "SkullSize", "FlameHue", "EyeBeams"};
constexpr bool ABSOLUTE_READY = true;

constexpr int FRAME_W = 64;
constexpr int FRAME_H = 128;
constexpr int FRAME_PIXELS = FRAME_W * FRAME_H;

static float flame = 0.0f;
static float skullSize = 2.0f;
static float flameHue = 1.0f;
static float eyeBeams = 1.0f;

static float timeAcc = 0.0f;
static float fireSimTime = 0.0f;
static float* fireData = nullptr;

struct RGBColor {
  uint8_t r, g, b;
};

static const RGBColor ORANGE_FIRE_PALETTE[14] = {
  {0, 0, 0},
  {45, 5, 8},
  {105, 12, 10},
  {155, 26, 6},
  {195, 48, 6},
  {225, 75, 5},
  {245, 105, 8},
  {255, 135, 12},
  {255, 162, 18},
  {255, 188, 25},
  {255, 212, 45},
  {255, 230, 85},
  {255, 245, 160},
  {255, 252, 220}
};

static const RGBColor BLUE_FIRE_PALETTE[14] = {
  {0, 0, 0},
  {21, 34, 92},
  {13, 57, 76},
  {44, 63, 137},
  {29, 89, 115},
  {64, 90, 186},
  {46, 117, 148},
  {75, 119, 215},
  {58, 145, 183},
  {108, 148, 225},
  {94, 177, 215},
  {161, 183, 246},
  {153, 215, 246},
  {210, 229, 250}
};

// 256-step precalculated exponential table for expf(-x) [0..8]
static float expNegLUT[256];
static inline float fastExpNeg(float v) {
  if (v <= 0.0f) return 1.0f;
  if (v >= 8.0f) return 0.0f;
  return expNegLUT[(int)(v * (255.0f / 8.0f))];
}

// 256-step frame-baked flame palette LUT
static RGBColor flameLUT[256];

// Fast 32-bit Xorshift PRNG
static uint32_t fastRngState = 0x8A5CD791;
static inline uint32_t fastRng() {
  fastRngState ^= fastRngState << 13;
  fastRngState ^= fastRngState >> 17;
  fastRngState ^= fastRngState << 5;
  return fastRngState;
}

// Skull discrete raymarching cache: qy [-18..18] -> 37, qx [-16..16] -> 33
struct SkullVoxel {
  int8_t hitType; // 0: None, 1: Bone, 2: Teeth, 3: Cavity
  float hitZ;
};
static SkullVoxel skullGrid[37][33];

static void updateFlameLUT(float hueParam) {
  bool isBlueMode = (hueParam > 0.45f && hueParam < 0.85f);
  const RGBColor* activePalette = isBlueMode ? BLUE_FIRE_PALETTE : ORANGE_FIRE_PALETTE;

  float m00 = 1.0f, m01 = 0.0f, m02 = 0.0f;
  float m10 = 0.0f, m11 = 1.0f, m12 = 0.0f;
  float m20 = 0.0f, m21 = 0.0f, m22 = 1.0f;
  bool doRot = (hueParam > 0.05f && !isBlueMode);

  if (doRot) {
    float shift = hueParam * TWO_PI;
    float cosS = PFMath::fastCos(shift);
    float sinS = PFMath::fastSin(shift);
    m00 = 0.299f + 0.701f * cosS + 0.168f * sinS;
    m01 = 0.587f - 0.587f * cosS + 0.330f * sinS;
    m02 = 0.114f - 0.114f * cosS - 0.497f * sinS;
    m10 = 0.299f - 0.299f * cosS - 0.328f * sinS;
    m11 = 0.587f + 0.413f * cosS + 0.035f * sinS;
    m12 = 0.114f - 0.114f * cosS + 0.288f * sinS;
    m20 = 0.299f - 0.300f * cosS + 1.250f * sinS;
    m21 = 0.587f - 0.588f * cosS - 1.050f * sinS;
    m22 = 0.114f + 0.886f * cosS - 0.203f * sinS;
  }

  constexpr int maxIdx = 13;
  for (int idx = 0; idx < 256; idx++) {
    float u = (float)idx * (75.0f / 255.0f);
    if (u <= 0.05f) {
      flameLUT[idx] = {0, 0, 0};
      continue;
    }

    float scaled = (u / 75.0f) * (float)maxIdx;
    float uc = PFMath::clamp(scaled, 0.0f, (float)maxIdx);
    int i0 = PFMath::ifloor(uc);
    int i1 = (i0 + 1 < maxIdx) ? (i0 + 1) : maxIdx;
    float f = uc - (float)i0;

    const RGBColor& c0 = activePalette[i0];
    const RGBColor& c1 = activePalette[i1];

    float rBase = (float)c0.r + ((float)c1.r - (float)c0.r) * f;
    float gBase = (float)c0.g + ((float)c1.g - (float)c0.g) * f;
    float bBase = (float)c0.b + ((float)c1.b - (float)c0.b) * f;

    if (doRot) {
      float rRot = rBase * m00 + gBase * m01 + bBase * m02;
      float gRot = rBase * m10 + gBase * m11 + bBase * m12;
      float bRot = rBase * m20 + gBase * m21 + bBase * m22;
      flameLUT[idx] = {
        (uint8_t)PFMath::clamp(rRot, 0.0f, 255.0f),
        (uint8_t)PFMath::clamp(gRot, 0.0f, 255.0f),
        (uint8_t)PFMath::clamp(bRot, 0.0f, 255.0f)
      };
    } else {
      flameLUT[idx] = {
        (uint8_t)PFMath::clamp(rBase, 0.0f, 255.0f),
        (uint8_t)PFMath::clamp(gBase, 0.0f, 255.0f),
        (uint8_t)PFMath::clamp(bBase, 0.0f, 255.0f)
      };
    }
  }
}

static void precomputeSkull(float cosRot, float sinRot, float jawOpen) {
  constexpr float inv105 = 1.0f / 105.0f;
  constexpr float inv115 = 1.0f / 115.0f;
  float chinY = 9.2f + jawOpen;
  float lowerTeethY = 7.0f + jawOpen;

  for (int qyIdx = 0; qyIdx < 37; qyIdx++) {
    int qy = qyIdx - 18;
    float mY = (float)qy;
    float cyAdj = mY + 3.0f;
    float cyAdjTerm = cyAdj * cyAdj * inv115;

    bool inMaxillaY = (mY >= -1.0f && mY <= 7.2f);
    float maxW = inMaxillaY ? ((mY < 3.0f) ? 8.6f : (8.6f - (mY - 3.0f) * 0.75f)) : 0.0f;

    bool inMandibleRearY = (mY >= 4.5f && mY <= (8.5f + jawOpen * 0.28f));
    bool inMandibleChinY = (mY >= (7.0f + jawOpen * 0.45f) && mY <= (chinY + 2.5f));

    bool inEyeY = (mY >= -0.8f && mY <= 2.8f);
    bool inNoseY = (mY >= 3.0f && mY <= 5.8f);
    float nW = inNoseY ? PFMath::clamp((mY - 3.0f) * 0.5f, 0.5f, 10.0f) : 0.0f;

    bool inMouthCavernY = (jawOpen > 0.8f && mY > 6.8f && mY < (6.8f + jawOpen));
    bool inUpperTeethY = (mY >= 5.8f && mY <= 7.0f);
    bool inLowerTeethY = (mY >= (lowerTeethY - 0.4f) && mY <= (lowerTeethY + 1.0f));

    for (int qxIdx = 0; qxIdx < 33; qxIdx++) {
      int qx = qxIdx - 16;
      SkullVoxel voxel = {0, -99.0f};

      for (float z = 12.0f; z >= -12.0f; z -= 1.4f) {
        float mX = (float)qx * cosRot - z * sinRot;
        float mZ = (float)qx * sinRot + z * cosRot;

        float czAdj = (mZ < 0.0f) ? mZ * 0.9f : mZ;
        float craniumDist = (mX * mX + czAdj * czAdj) * inv105 + cyAdjTerm;
        bool inCranium = (craniumDist <= 1.0f);

        bool inMaxilla = inMaxillaY && (mZ >= -1.5f && mZ <= 6.5f) && (fabsf(mX) <= maxW);

        bool inMandible = false;
        if (inMandibleRearY && (mZ >= -2.5f && mZ <= 1.5f)) {
          if (fabsf(fabsf(mX) - 5.5f) <= 1.3f) {
            inMandible = true;
          }
        }

        if (!inMandible && inMandibleChinY && (mZ >= -1.5f && mZ <= 6.8f)) {
          float jawFrac = PFMath::clamp01((mZ + 1.5f) * 0.125f);
          float expectedY = 7.5f + jawFrac * (chinY - 7.5f);
          if (fabsf(mY - expectedY) <= 1.8f) {
            float jawWidth = 5.8f - jawFrac * 1.5f;
            if (fabsf(mX) <= jawWidth) {
              inMandible = true;
            }
          }
        }

        if (inCranium || inMaxilla || inMandible) {
          if (mZ >= 2.0f && inEyeY) {
            float browSlant = (fabsf(mX) - 3.8f) * 0.25f;
            float eDx = fabsf(mX) - 3.8f;
            float eDy = mY - (1.0f + browSlant);
            if (eDx * eDx + eDy * eDy <= 6.8f) {
              voxel = {3, z};
              break;
            }
          }

          if (mZ >= 2.8f && inNoseY) {
            if (fabsf(mX) <= nW) {
              voxel = {3, z};
              break;
            }
          }

          if (inMouthCavernY && mZ >= 1.0f) {
            if (fabsf(mX) <= 4.8f) {
              voxel = {3, z};
              break;
            }
          }

          bool isUpperTeeth = inUpperTeethY && (mZ >= 3.4f && fabsf(mX) <= 4.2f);
          bool isLowerTeeth = inLowerTeethY && (mZ >= 3.0f && fabsf(mX) <= 3.8f);

          voxel = {(int8_t)((isUpperTeeth || isLowerTeeth) ? 2 : 1), z};
          break;
        }
      }
      skullGrid[qyIdx][qxIdx] = voxel;
    }
  }
}

static void stepSeamlessFire(float flameGain, float t) {
  if (!fireData) return;

  float fuelMax = 25.0f + flameGain * 60.0f;

  for (int x = 0; x < FRAME_W; x++) {
    float nTop = PFNoise::valueNoise2D((float)x * 0.08f, t);
    float targetTop = PFMath::floorF(4.0f + nTop * (fuelMax - 4.0f));
    float curTop = fireData[x] + 4.0f;
    fireData[x] = (targetTop < curTop) ? targetTop : curTop;

    int botIdx = (FRAME_H - 1) * FRAME_W + x;
    float nBot = PFNoise::valueNoise2D((float)x * 0.08f + 10.0f, t);
    float targetBot = PFMath::floorF(4.0f + nBot * (fuelMax - 4.0f));
    float curBot = fireData[botIdx] + 4.0f;
    fireData[botIdx] = (targetBot < curBot) ? targetBot : curBot;
  }

  for (int y = 0; y < FRAME_H; y++) {
    int leftIdx = y * FRAME_W;
    float nLeft = PFNoise::valueNoise2D((float)y * 0.08f + 20.0f, t);
    float targetLeft = PFMath::floorF(4.0f + nLeft * (fuelMax - 4.0f));
    float curLeft = fireData[leftIdx] + 4.0f;
    fireData[leftIdx] = (targetLeft < curLeft) ? targetLeft : curLeft;

    int rightIdx = y * FRAME_W + (FRAME_W - 1);
    float nRight = PFNoise::valueNoise2D((float)y * 0.08f + 30.0f, t);
    float targetRight = PFMath::floorF(4.0f + nRight * (fuelMax - 4.0f));
    float curRight = fireData[rightIdx] + 4.0f;
    fireData[rightIdx] = (targetRight < curRight) ? targetRight : curRight;
  }

  float coolingDistTerm = (2.8f - flameGain * 1.4f) * (1.0f / 13.0f);

  for (int y = 1; y < FRAME_H - 1; y++) {
    int distY = (y < FRAME_H - 1 - y) ? y : (FRAME_H - 1 - y);
    int rowOffset = y * FRAME_W;
    int stepY = (y < (FRAME_H / 2)) ? -1 : 1;

    for (int x = 1; x < FRAME_W - 1; x++) {
      int distX = (x < FRAME_W - 1 - x) ? x : (FRAME_W - 1 - x);
      int stepX = (x < (FRAME_W / 2)) ? -1 : 1;

      float invDenom = 1.0f / ((float)(distX + distY) + 0.001f);
      float weightH = (float)distY * invDenom;
      float weightV = (float)distX * invDenom;

      uint32_t r = fastRng();
      int randDrift = (int)(r & 1) - (int)((r >> 1) & 1);

      int srcHX = PFMath::clamp(x + stepX, 0, FRAME_W - 1);
      int srcHY = PFMath::clamp(y + randDrift, 0, FRAME_H - 1);
      float heatH = fireData[srcHY * FRAME_W + srcHX];

      int srcVX = PFMath::clamp(x + randDrift, 0, FRAME_W - 1);
      int srcVY = PFMath::clamp(y + stepY, 0, FRAME_H - 1);
      float heatV = fireData[srcVY * FRAME_W + srcVX];

      int srcDiagX = PFMath::clamp(x + stepX, 0, FRAME_W - 1);
      int srcDiagY = PFMath::clamp(y + stepY, 0, FRAME_H - 1);
      float heatDiag = fireData[srcDiagY * FRAME_W + srcDiagX];

      float cornerFactor = 4.0f * weightH * weightV;
      float edgeBlend = heatH * weightH + heatV * weightV;
      float srcHeat = edgeBlend * (1.0f - cornerFactor * 0.45f) + heatDiag * (cornerFactor * 0.45f);

      int minEdgeDist = (distX < distY) ? distX : distY;
      float cooling = 1.4f + (float)(r & 0x3FF) * (1.8f / 1023.0f) + (float)minEdgeDist * coolingDistTerm;
      float val = srcHeat - cooling;
      fireData[rowOffset + x] = (val > 0.0f) ? val : 0.0f;
    }
  }
}

void setup() {
  PFMath::buildSinLUT();

  for (int i = 0; i < 256; i++) {
    expNegLUT[i] = expf(- (float)i * (8.0f / 255.0f));
  }

  if (!fireData) {
    fireData = PFMem::allocFloats(FRAME_PIXELS);
  }
}

void update(float dt, const InputFrame& input) {
  PFParams::apply(input, 0, &flame, 0.0f, 1.0f, 0.021f);
  PFParams::apply(input, 1, &skullSize, 0.6f, 2.0f, 0.029f);
  PFParams::apply(input, 2, &flameHue, 0.0f, 1.0f, 0.021f);
  PFParams::apply(input, 3, &eyeBeams, 0.0f, 1.0f, 0.021f);

  if (input.btnPressed[0] && !input.paramAbsoluteActive[0] && !input.knobAudioActive[0]) flame = 0.75f;
  if (input.btnPressed[1] && !input.paramAbsoluteActive[1] && !input.knobAudioActive[1]) skullSize = 1.05f;
  if (input.btnPressed[2] && !input.paramAbsoluteActive[2] && !input.knobAudioActive[2]) flameHue = 0.0f;
  if (input.btnPressed[3] && !input.paramAbsoluteActive[3] && !input.knobAudioActive[3]) eyeBeams = 0.85f;

  timeAcc += dt * 0.42f;
  if (timeAcc > TWO_PI * 50.0f) {
    timeAcc -= TWO_PI * 50.0f;
  }

  fireSimTime += dt * 2.4f;
  if (fireSimTime > 1000.0f) {
    fireSimTime -= 1000.0f;
  }
}

void draw() {
  PFCanvas::setFrame(FRAME_W, FRAME_H);

  if (!fireData) {
    PFCanvas::present();
    return;
  }

  float flameGain = PFMath::clamp01(flame);
  stepSeamlessFire(flameGain, fireSimTime);
  updateFlameLUT(flameHue);

  constexpr float cx = (float)(FRAME_W - 1) * 0.5f;
  constexpr float cy = (float)(FRAME_H - 1) * 0.5f;

  float scale = PFMath::clamp(skullSize, 0.5f, 2.2f);
  float invScale = 1.0f / scale;
  float beamGain = PFMath::clamp01(eyeBeams);

  float rotAngle = timeAcc * 2.20f;
  float cosRot = PFMath::fastCos(rotAngle);
  float sinRot = PFMath::fastSin(rotAngle);

  float sinLaugh = PFMath::fastSin(timeAcc * 12.5f);
  float posLaugh = (sinLaugh > 0.0f) ? sinLaugh : 0.0f;
  float laughMain = PFMath::fastPow(posLaugh, 1.2f) * 4.2f;

  float sinBounce = PFMath::fastSin(timeAcc * 25.0f);
  float laughBounce = (sinBounce > 0.0f ? sinBounce : 0.0f) * 0.5f;
  float jawOpen = laughMain + laughBounce;
  float headBobY = -jawOpen * 0.22f;

  precomputeSkull(cosRot, sinRot, jawOpen);

  constexpr float eyeModelY = 1.0f;
  constexpr float eye1ModelX = -3.8f;
  constexpr float eye2ModelX =  3.8f;
  constexpr float eyeModelZ = 4.8f;

  float eyeScreenY = cy + (eyeModelY + headBobY) * scale;
  float eye1ScreenX = cx + (eye1ModelX * cosRot + eyeModelZ * sinRot) * scale;
  float eye1Depth = -eye1ModelX * sinRot + eyeModelZ * cosRot;

  float eye2ScreenX = cx + (eye2ModelX * cosRot + eyeModelZ * sinRot) * scale;
  float eye2Depth = -eye2ModelX * sinRot + eyeModelZ * cosRot;

  float facingZ = cosRot;
  float facingX = sinRot;
  float absFacingX = fabsf(facingX);
  float signFacingX = (facingX >= 0.0f) ? 1.0f : -1.0f;

  float maxBeamLen = 30.0f + beamGain * 90.0f;
  float invMaxBeamLen = 1.0f / maxBeamLen;
  float posFacingZ = (facingZ > 0.0f) ? facingZ : 0.0f;
  float lateralConeK = 6.0f + 8.0f * posFacingZ;
  float maxLateralConeW = (1.2f + lateralConeK) * 2.6f;

  float frontFlareDistDiv = 1.0f / (32.0f + beamGain * 45.0f);
  float facingZ2 = facingZ * facingZ;
  bool beamsActive = (beamGain > 0.02f && facingZ > -0.35f);

  for (int y = 0; y < FRAME_H; y++) {
    int rowOffset = y * FRAME_W;
    float dyEye = fabsf((float)y - eyeScreenY);
    float dyEyeSq = dyEye * dyEye;
    float dy1 = (float)y - eyeScreenY;
    float dy1Sq = dy1 * dy1;
    bool rowCanHaveLateralBeam = (dyEye < maxLateralConeW);

    for (int x = 0; x < FRAME_W; x++) {
      float heat = fireData[rowOffset + x];
      int hIdx = (int)(heat * (255.0f / 75.0f));
      if (hIdx < 0) hIdx = 0;
      else if (hIdx > 255) hIdx = 255;

      uint8_t bgR = flameLUT[hIdx].r;
      uint8_t bgG = flameLUT[hIdx].g;
      uint8_t bgB = flameLUT[hIdx].b;

      if (beamsActive) {
        float beamLight = 0.0f;
        float flareLight = 0.0f;

        if (eye1Depth > -2.0f) {
          float dx1 = (float)x - eye1ScreenX;
          float dist1Sq = dx1 * dx1 + dy1Sq;

          if (absFacingX > 0.08f && rowCanHaveLateralBeam) {
            float proj1 = dx1 * signFacingX;
            if (proj1 > 0.0f && proj1 < maxBeamLen) {
              float coneWidth = 1.2f + (proj1 * invMaxBeamLen) * lateralConeK;
              if (dyEye < coneWidth * 2.6f) {
                float profile = fastExpNeg(dyEyeSq / (2.0f * coneWidth * coneWidth));
                float falloff = 1.0f - (proj1 * invMaxBeamLen);
                beamLight += profile * falloff * falloff * absFacingX;
              }
            }
          }

          if (facingZ > 0.05f) {
            float dist1 = sqrtf(dist1Sq);
            float frontConeW = 2.0f + dist1 * 0.42f;
            float frontFlare = fastExpNeg(dy1Sq / (2.0f * frontConeW * frontConeW))
                             * fastExpNeg(dist1 * frontFlareDistDiv)
                             * facingZ2;
            beamLight += frontFlare * 1.5f;
          }

          if (dist1Sq < 64.0f) {
            flareLight += fastExpNeg(dist1Sq * (1.0f / 5.5f)) * (1.0f + 1.5f * posFacingZ);
          }
        }

        if (eye2Depth > -2.0f) {
          float dx2 = (float)x - eye2ScreenX;
          float dist2Sq = dx2 * dx2 + dy1Sq;

          if (absFacingX > 0.08f && rowCanHaveLateralBeam) {
            float proj2 = dx2 * signFacingX;
            if (proj2 > 0.0f && proj2 < maxBeamLen) {
              float coneWidth = 1.2f + (proj2 * invMaxBeamLen) * lateralConeK;
              if (dyEye < coneWidth * 2.6f) {
                float profile = fastExpNeg(dyEyeSq / (2.0f * coneWidth * coneWidth));
                float falloff = 1.0f - (proj2 * invMaxBeamLen);
                beamLight += profile * falloff * falloff * absFacingX;
              }
            }
          }

          if (facingZ > 0.05f) {
            float dist2 = sqrtf(dist2Sq);
            float frontConeW = 2.0f + dist2 * 0.42f;
            float frontFlare = fastExpNeg(dy1Sq / (2.0f * frontConeW * frontConeW))
                             * fastExpNeg(dist2 * frontFlareDistDiv)
                             * facingZ2;
            beamLight += frontFlare * 1.5f;
          }

          if (dist2Sq < 64.0f) {
            flareLight += fastExpNeg(dist2Sq * (1.0f / 5.5f)) * (1.0f + 1.5f * posFacingZ);
          }
        }

        float totalBeam = (beamLight * 1.35f + flareLight * 1.6f) * beamGain;
        if (totalBeam > 0.01f) {
          bgR = (uint8_t)PFMath::clamp((float)bgR + totalBeam * 255.0f, 0.0f, 255.0f);
          bgG = (uint8_t)PFMath::clamp((float)bgG + totalBeam * 28.0f + flareLight * 190.0f, 0.0f, 255.0f);
          bgB = (uint8_t)PFMath::clamp((float)bgB + totalBeam * 22.0f + flareLight * 120.0f, 0.0f, 255.0f);
        }
      }

      float sx = ((float)x - cx) * invScale;
      float sy = ((float)y - cy) * invScale - headBobY;
      int qx = (int)roundf(sx);
      int qy = (int)roundf(sy);

      bool hit = false;
      float hitZ = -99.0f;
      int hitType = 0;

      if (abs(qx) <= 16 && abs(qy) <= 18) {
        const SkullVoxel& sp = skullGrid[qy + 18][qx + 16];
        hitType = sp.hitType;
        if (hitType != 0) {
          hit = true;
          hitZ = sp.hitZ;
        }
      }

      if (hit) {
        if (hitType == 3) {
          uint8_t cavR = 10;
          uint8_t cavG = 8;
          uint8_t cavB = 14;

          if (facingZ > -0.35f) {
            float d1 = ((float)x - eye1ScreenX) * ((float)x - eye1ScreenX) + dy1Sq;
            float d2 = ((float)x - eye2ScreenX) * ((float)x - eye2ScreenX) + dy1Sq;
            if (d1 < 7.0f || d2 < 7.0f) {
              cavR = 255;
              cavG = (uint8_t)PFMath::clamp(180.0f * beamGain, 0.0f, 255.0f);
              cavB = (uint8_t)PFMath::clamp(80.0f * beamGain, 0.0f, 255.0f);
            }
          }

          PFCanvas::setPixel(x, y, cavR, cavG, cavB);
        } else if (hitType == 2) {
          float mX = (float)qx * cosRot - hitZ * sinRot;
          bool toothSeam = (PFMath::jsMod(fabsf(mX), 1.4f) < 0.28f);
          if (toothSeam) {
            PFCanvas::setPixel(x, y, 42, 38, 35);
          } else {
            PFCanvas::setPixel(x, y, 250, 248, 236);
          }
        } else {
          float diffuse = 0.52f + 0.48f * (hitZ * (1.0f / 12.0f)) - 0.12f * ((float)qy * (1.0f / 14.0f));
          diffuse = PFMath::clamp(diffuse, 0.35f, 1.0f);

          float boneStep = PFMath::floorF(diffuse * 4.0f) * 0.25f;
          uint8_t boneR = (uint8_t)(230.0f * boneStep);
          uint8_t boneG = (uint8_t)(224.0f * boneStep);
          uint8_t boneB = (uint8_t)(210.0f * boneStep);

          if (fabsf(hitZ) < 0.9f) {
            PFCanvas::setPixel(x, y, 35, 30, 28);
          } else {
            PFCanvas::setPixel(x, y, boneR, boneG, boneB);
          }
        }
      } else {
        PFCanvas::setPixel(x, y, bgR, bgG, bgB);
      }
    }
  }

  PFCanvas::present();
}

} // namespace CryptfireBeacon