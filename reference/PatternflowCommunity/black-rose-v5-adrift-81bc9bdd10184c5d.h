#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_math.h"
#include "src/core_mem.h"

namespace BlackRoseAdriftPattern {

constexpr int FRAME_W = 64;
constexpr int FRAME_H = 128;

const char* NAME = "Black Rose";
const char* const KNOB_LABELS[4] = {"Float", "Calm", "Wavelength", "Reflect"};

constexpr int MASK_W = 100;
constexpr int MASK_H = 64;

static const char* const MASK_HEX[MASK_H] = {
  "00000000001f803f000000000","0000000000fff0ffc00000000","000000007ffff8fff00000000",
  "00000003fffffe07f80000000","00000007fffffe70ff0000000","0000000fffffff7c7ffe00000",
  "0000000fffffff7e1fffc0000","0000000fffffff7e1ffff0000","0000001fffffbf3f0ffff0000",
  "0000001ffff80e3f8ffff8000","0000003ffff0e07f8ffff8000","000000fffdc3e0ff8ffffc000",
  "000001fffd87e1ffcffffc000","000003fffd0fc3ffcffffc000","000003fffc1f0fffcffffc600",
  "0003f7fffc1c3fffcffffcf80","001fe7fffc1fffffcffffcfc0","003fe7fffc1fffff8efffcfe0",
  "007fe7fffe1fffff80fff8ff0","00ffe7fffe1fffff01fff1ff8","01ffe7ffff0ffffe03ffe1ffc",
  "01ffc7ffffcffff80fff03ffc","03ffc7ffffefffe03ffc07ffc","03ffc3ffffffff81fff03fffc",
  "01ffe3fffffffe0fffe0ffffc","01fff3fffffff07fffc1ffffc","00fff9fffeff81ffff807fff8",
  "00fff9fffc0003ffff8f7ffe0","01fffcfffe000fffff8ffff80","07fffeffff801fffff9fffe70",
  "1ffffe7ffff83fffff1fffcfc","3ffffe7ffffc3ffffe3fff1fe","7ffffe3ffffe7ffffcfffe3fe",
  "7ffffe1ffffffffffffffc7ff","fffffc0ffffffffffffffcfff","fffff80387fffffffffff9fff",
  "ffffff0000fffffffffff3fff","ffffffc0003fffffffffe3fff","fffffffff81fffffffffe7ffe",
  "7ffffffffe0fffffffffc7ffe","7fffffffff87ffffffffcfffc","3fffffffffc7ffffffff8fff8",
  "1fffffffffffffffc7ff1fff0","07ffffffffffffffc0fe1ffe0","01ffffffffffffffe0003ffc0",
  "0007fffffffffffffe00fff80","0033fffffffffffffffffff00","0079ffffffffffffffffffe00",
  "00f8ffffffffffffffffffe00","01fc3fffffffffffffffffe00","01fe007fffffffffffffffe00",
  "01ff80ffffffffffffffffe00","01ffffffffffffffffffff300","03ffffffffffffffffffff300",
  "03ffffffffffffffffffff800","01ffffffffffff1f7ff003800","01fffffffffff80c038003800",
  "01ffffffffffe00c000003800","00ffffffffff800c000003800","00fffffffffe000c000007800",
  "007ffffffffc000c000007800","003fff81fff80000000003000","000ffc007ff00000000000000",
  "0001c0000fc00000000000000"
};

static uint8_t maskBits[MASK_W * MASK_H];

static float speedTarget = 5.0f;
static float currentSpeed = 5.0f;
static float calmTarget = 0.206f;
static float currentCalm = 0.206f;
static float wavelengthTarget = 9.891f;
static float currentWavelength = 9.891f;
static float reflectAmt = 0.567f;

static float rippleEnergy = 0.0f;
static float timeAcc = 0.0f;
static float lastKnob[4] = {5.0f, 0.206f, 9.891f, 0.567f};
static bool hasLastKnob = false;

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
  {248,248,248},{249,249,249},{250,250,250},{251,251,251},{252,252,252},{253,253,253},{254,254,254},{255,255,255},
};

static inline int parseHexNibble(char c) {
  if (c >= '0' && c <= '9') return c - '0';
  if (c >= 'a' && c <= 'f') return c - 'a' + 10;
  if (c >= 'A' && c <= 'F') return c - 'A' + 10;
  return 0;
}

static void buildMask() {
  for (int y = 0; y < MASK_H; y++) {
    const char* row = MASK_HEX[y];
    for (int i = 0; row[i] != '\0'; i++) {
      int nibble = parseHexNibble(row[i]);
      for (int b = 0; b < 4; b++) {
        int bitIndex = i * 4 + b;
        if (bitIndex >= MASK_W) break;
        maskBits[y * MASK_W + bitIndex] = (nibble >> (3 - b)) & 1;
      }
    }
  }
}

static inline float maskAt(float mx, float my) {
  int x0 = (int)floorf(mx);
  int y0 = (int)floorf(my);
  int x1 = x0 + 1;
  int y1 = y0 + 1;

  if (x0 < 0 || y0 < 0 || x1 >= MASK_W || y1 >= MASK_H) return 0.0f;

  float fx = mx - (float)x0;
  float fy = my - (float)y0;

  float v00 = maskBits[y0 * MASK_W + x0];
  float v10 = maskBits[y0 * MASK_W + x1];
  float v01 = maskBits[y1 * MASK_W + x0];
  float v11 = maskBits[y1 * MASK_W + x1];

  float top = v00 + (v10 - v00) * fx;
  float bot = v01 + (v11 - v01) * fx;
  return top + (bot - top) * fy;
}

static inline float maskAtAA(float mx, float my, float spread) {
  float s1 = maskAt(mx - spread, my - spread);
  float s2 = maskAt(mx + spread, my - spread);
  float s3 = maskAt(mx - spread, my + spread);
  float s4 = maskAt(mx + spread, my + spread);
  return (s1 + s2 + s3 + s4) * 0.25f;
}

void setup() {
  PFMath::buildSinLUT();
  buildMask();

  speedTarget = 5.0f;
  currentSpeed = 5.0f;
  calmTarget = 0.206f;
  currentCalm = 0.206f;
  wavelengthTarget = 9.891f;
  currentWavelength = 9.891f;
  reflectAmt = 0.567f;

  rippleEnergy = 0.0f;
  timeAcc = 0.0f;
  hasLastKnob = false;
}

void update(float dt, const InputFrame& input) {
  speedTarget += input.knobDeltas[0] * 0.167f;
  speedTarget = fminf(fmaxf(speedTarget, -3.0f), 5.0f);

  calmTarget += input.knobDeltas[1] * 0.021f;
  calmTarget = fminf(fmaxf(calmTarget, 0.0f), 1.0f);

  wavelengthTarget += input.knobDeltas[2] * 0.771f;
  wavelengthTarget = fminf(fmaxf(wavelengthTarget, 3.0f), 40.0f);

  reflectAmt += input.knobDeltas[3] * 0.021f;
  reflectAmt = fminf(fmaxf(reflectAmt, 0.0f), 1.0f);

  if (hasLastKnob) {
    float delta = fabsf(calmTarget - lastKnob[1]) * 3.0f +
                  fabsf(wavelengthTarget - lastKnob[2]) * 0.1f +
                  fabsf(reflectAmt - lastKnob[3]) * 1.5f;
    rippleEnergy += delta;
  }
  lastKnob[0] = speedTarget;
  lastKnob[1] = calmTarget;
  lastKnob[2] = wavelengthTarget;
  lastKnob[3] = reflectAmt;
  hasLastKnob = true;

  currentSpeed += (speedTarget - currentSpeed) * 0.08f;
  currentCalm += (calmTarget - currentCalm) * 0.1f;
  currentWavelength += (wavelengthTarget - currentWavelength) * 0.1f;

  rippleEnergy *= expf(-dt * 1.2f);
  if (rippleEnergy > 4.0f) rippleEnergy = 4.0f;

  timeAcc += dt * (0.4f + fabsf(currentSpeed) * 0.35f);
  if (timeAcc > 200.0f * TWO_PI) {
    timeAcc -= 200.0f * TWO_PI;
  }
}

void draw() {
  PFCanvas::setFrame(FRAME_W, FRAME_H);

  float w = (float)FRAME_W;
  float h = (float)FRAME_H;
  float t = timeAcc;

  float scale = (w * 0.85f) / (float)MASK_W;
  float roseH = (float)MASK_H * scale;
  float invScale = 1.0f / scale;
  float aaSpread = invScale * 0.35f;

  float bobAmp = h * 0.045f;
  float bobY = PFMath::fastSin(t * 1.1f) * bobAmp;
  float swayX = PFMath::fastSin(t * 0.55f + 1.3f) * w * 0.02f;
  float rotAngle = PFMath::fastSin(t * 0.5f) * 0.06f;

  float waterLine = h * 0.60f;
  float fadeBand = h * 0.10f;
  float invFadeBand = 1.0f / fadeBand;

  float gapAboveWater = h * 0.05f;
  float restingCenterY = waterLine - gapAboveWater - roseH * 0.5f;

  float centerY = restingCenterY + bobY;
  float minCenterY = roseH * 0.5f + h * 0.02f;
  if (centerY < minCenterY) centerY = minCenterY;
  float centerX = w * 0.5f + swayX;

  float cosA = PFMath::fastCos(-rotAngle);
  float sinA = PFMath::fastSin(-rotAngle);

  float wavelength = fmaxf(currentWavelength, 3.0f);
  float freq = TWO_PI / wavelength;

  float rippleEnergyClamped = fminf(rippleEnergy, 4.0f);
  float rippleAmp = fminf(fmaxf(currentCalm * 0.5f + rippleEnergyClamped * 0.12f, 0.0f), 1.0f);
  float turbulence = fminf(fmaxf((rippleEnergy - 1.0f) / 3.0f, 0.0f), 1.0f);

  for (int y = 0; y < FRAME_H; y++) {
    float fy = (float)y;
    float relY = fy - centerY;
    float distBelow = fy - waterLine;
    float fadeIn = fminf(fmaxf(distBelow * invFadeBand, 0.0f), 1.0f);

    for (int x = 0; x < FRAME_W; x++) {
      float fx = (float)x;
      float relX = fx - centerX;

      float rx = relX * cosA - relY * sinA;
      float ry = relX * sinA + relY * cosA;
      float mx = rx * invScale + (float)MASK_W * 0.5f;
      float my = ry * invScale + (float)MASK_H * 0.5f;

      float roseVal = fminf(fmaxf(maskAtAA(mx, my, aaSpread), 0.0f), 1.0f);
      float rippleVal = 0.0f;

      if (fadeIn > 0.0f) {
        float rdx = fx - centerX;
        float radial = sqrtf(rdx * rdx + distBelow * distBelow * 2.2f);
        float ringWave = PFMath::fastSin(radial * freq - t * 2.6f) * 0.5f + 0.5f;
        float ambientWave = PFMath::fastSin(distBelow * 0.35f + fx * 0.12f + t * 1.8f) * 0.5f + 0.5f;
        float mixed = ambientWave * 0.4f + ringWave * 0.6f;

        if (turbulence > 0.0f) {
          float chop1 = PFMath::fastSin(fx * 0.5f + distBelow * 0.9f + t * 6.0f) * 0.5f + 0.5f;
          float chop2 = PFMath::fastSin(fx * 0.23f - distBelow * 0.6f + t * 9.0f + radial * 0.3f) * 0.5f + 0.5f;
          float chaos = chop1 * 0.5f + chop2 * 0.5f;
          mixed = mixed * (1.0f - turbulence) + chaos * turbulence;
        }

        float waterVal = fminf(fmaxf(0.08f + mixed * rippleAmp * 0.75f, 0.0f), 1.0f);

        if (reflectAmt > 0.01f) {
          float displace = (ringWave - 0.5f) * 2.0f * (8.0f + turbulence * 10.0f) * rippleAmp;
          float mirrorY = 2.0f * waterLine - fy;
          float relYR = mirrorY - centerY;
          float relXR = (fx + displace) - centerX;

          float rxR = relXR * cosA + relYR * sinA;
          float ryR = -relXR * sinA + relYR * cosA;
          float mxR = rxR * invScale + (float)MASK_W * 0.5f;
          float myR = ryR * invScale + (float)MASK_H * 0.5f;

          float mvalR = maskAtAA(mxR, myR, aaSpread);
          waterVal = waterVal * (1.0f - mvalR * reflectAmt * 0.9f);
        }

        rippleVal = waterVal * fadeIn;
      }

      float value = fmaxf(roseVal, rippleVal);
      value = fminf(fmaxf(value, 0.0f), 1.0f);

      int li = (int)(value * 255.0f + 0.5f);
      int idx = fminf(fmaxf(li, 0), 255);

      PFCanvas::setPixel(x, y, RAMP_LUT[idx][0], RAMP_LUT[idx][1], RAMP_LUT[idx][2]);
    }
  }

  PFCanvas::present();
}

} // namespace BlackRoseAdriftPattern