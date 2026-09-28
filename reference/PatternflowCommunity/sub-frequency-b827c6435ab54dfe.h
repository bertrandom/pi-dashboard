#pragma once
#include <Arduino.h>
#include <math.h>
#include <stdint.h>
#include "src/core_mem.h"
#include <string.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_math.h"
#include "src/core_color.h"

// Pattern: Sub.Frequency
// Hypnotic acid-techno tunnel with a rotating feedback buffer for delay/fade
// trails. Analogous (nabo-hue) duotone palette plus a dim shadow tone for a
// soft fade at the edges of shapes, instead of a hard cutoff.
// Knob 1: Hue · Knob 2: Speed · Knob 3: Warp · Knob 4: Zoom

namespace SubFrequencyPattern {

const char* NAME = "Sub.Frequency";
const char* const KNOB_LABELS[4] = {"HUE", "SPEED", "WARP", "ZOOM"};

// Speed capped low on purpose — this pattern reads as far too frantic above ~0.8x.
const float SF_SPEED_MIN  = 0.05f;
const float SF_SPEED_MAX  = 0.80f;
const float SF_SPEED_STEP = 0.01f;

// Warp is 0..1 raw, cubed internally (see draw()) so almost all of the knob's
// travel stays subtle and the strong end only shows up in the last sliver.
const float SF_WARP_MIN  = 0.0f;
const float SF_WARP_MAX  = 1.0f;
const float SF_WARP_STEP = 0.01f;

const float SF_ZOOM_MIN  = 0.3f;
const float SF_ZOOM_MAX  = 3.0f;
const float SF_ZOOM_STEP = 0.05f;

struct Params {
    float hueBase;
    float speed;
    float warpRaw;
    float zoom;
    float timeAcc;
    float feedbackAngleAcc;
};

Params params;

// Persistent feedback buffer (delay/fade trail). 128x64x3 = 24576 bytes,
// right at the "allocate from PSRAM" threshold, so per project rules this
// is PFMem::alloc'd from PSRAM in setup(), not a static DRAM array —
// a static array here reserves that space in every pattern's build
// permanently, which can starve the firmware's boot regardless of which
// pattern is actually selected. Pointer, with a null-guard in draw() in
// case the allocation fails.
uint8_t* sfBuffer = nullptr;

static inline float sfClamp01(float v) { return v < 0.0f ? 0.0f : (v > 1.0f ? 1.0f : v); }

static inline uint32_t sfHashI(uint32_t x, uint32_t y) {
    uint32_t h = x * 1664525u + y * 1013904223u;
    h ^= h >> 16;
    h *= 0x45d9f3bu;
    h ^= h >> 16;
    return h;
}

static inline float sfHash(int x, int y) {
    return (float)(sfHashI((uint32_t)x, (uint32_t)y) & 0xFFFF) / 65535.0f;
}

static float sfNoise(float x, float y) {
    int   ix = (int)floorf(x), iy = (int)floorf(y);
    float fx = x - ix,         fy = y - iy;
    float ux = fx*fx*(3-2*fx), uy = fy*fy*(3-2*fy);
    return sfHash(ix,   iy  )*(1-ux)*(1-uy)
         + sfHash(ix+1, iy  )*ux*(1-uy)
         + sfHash(ix,   iy+1)*(1-ux)*uy
         + sfHash(ix+1, iy+1)*ux*uy;
}

// The core tunnel wave field. n1/n2 are passed in (already sampled from
// sfNoise by the caller) so this stays cheap.
static float sfWaveHeight(float nx, float ny, float n1, float n2, float t,
                           float warpAmtR, float warpAmtA, float scale, float speed) {
    float radius = sqrtf(nx*nx + ny*ny);
    float angle  = atan2f(ny, nx);

    // Hard-clamped regardless of the coefficients above — a safety net so no
    // knob combination can push this into per-pixel aliasing/noise.
    float radiusPerturb = n1 * warpAmtR * scale;
    radiusPerturb = radiusPerturb < -0.55f ? -0.55f : (radiusPerturb > 0.55f ? 0.55f : radiusPerturb);
    float anglePerturb = n2 * warpAmtA;
    anglePerturb = anglePerturb < -0.18f ? -0.18f : (anglePerturb > 0.18f ? 0.18f : anglePerturb);

    radius += radiusPerturb;
    angle  += anglePerturb;

    float rings = PFMath::fastSin(radius * 10.0f - t * (1.2f + speed * 2.2f));
    float arms  = PFMath::fastSin(angle * 5.0f + t * (0.6f + speed * 1.4f) + radius * 2.0f);
    return 0.5f + 0.5f * (rings * 0.65f + arms * 0.35f);
}

void setup() {
    PFMath::buildSinLUT();

    params.hueBase = 0.62f;
    params.speed   = 0.30f;
    params.warpRaw = 0.35f;
    params.zoom    = 1.0f;
    params.timeAcc = 0.0f;
    params.feedbackAngleAcc = 0.0f;

    const size_t bytes = sizeof(uint8_t) * PANEL_RES_W * PANEL_RES_H * 3;
    if (!sfBuffer) {
        sfBuffer = (uint8_t*)PFMem::alloc(bytes);
    }
}

void update(float dt, const InputFrame& input) {
    params.hueBase += input.knobDeltas[0] * 0.05f;
    params.hueBase  = fmodf(params.hueBase, 1.0f);
    if (params.hueBase < 0.0f) params.hueBase += 1.0f;

    params.speed   = constrain(params.speed   + input.knobDeltas[1] * SF_SPEED_STEP, SF_SPEED_MIN, SF_SPEED_MAX);
    params.warpRaw = constrain(params.warpRaw + input.knobDeltas[2] * SF_WARP_STEP,  SF_WARP_MIN,  SF_WARP_MAX);
    params.zoom    = constrain(params.zoom    + input.knobDeltas[3] * SF_ZOOM_STEP,  SF_ZOOM_MIN,  SF_ZOOM_MAX);

    params.timeAcc += dt * params.speed;
}

void draw() {
    if (!sfBuffer) return; // allocation failed — degrade safely instead of crashing

    float t = params.timeAcc;

    // Cubic curve: most of the knob's travel stays close to zero, the
    // forvrengning only ramps up hard in the last part of the turn.
    float warpCurve = params.warpRaw * params.warpRaw * params.warpRaw;
    float warpAmtR  = 1.0f + warpCurve * 5.0f;
    float warpAmtA  = 0.02f + warpCurve * 0.16f;

    // More delay: higher feedback mix + slower decay than the original
    // version, so trails hang around longer and fade out more gradually.
    // Fixed constants, deliberately not tied to any knob — a rotating
    // feedback buffer can drift into a self-reinforcing blow-up over time
    // if its gain is allowed to vary, so gain and warp stay decoupled.
    const float feedbackMix = 0.55f;
    const float feedbackDecay = 0.988f;

    float scale = 0.06f / params.zoom;

    params.feedbackAngleAcc += 0.006f * (0.4f + params.speed);
    const float fbShrink = 1.006f;
    float cosA = PFMath::fastCos(params.feedbackAngleAcc);
    float sinA = PFMath::fastSin(params.feedbackAngleAcc);

    // Harmonic, analogous palette: hueB sits close to hueA on the colour
    // wheel instead of near-opposite, so the two tones read as one family.
    // hueShadow fills the gap between black and the main colour for a
    // softer, more gradual fade at the edges of shapes.
    float hueA = params.hueBase;
    float hueB = fmodf(params.hueBase + 0.085f, 1.0f);
    float hueShadow = fmodf(params.hueBase - 0.05f + 1.0f, 1.0f);

    float halfW = PANEL_RES_W * 0.5f;
    float halfH = PANEL_RES_H * 0.5f;

    for (int y = 0; y < PANEL_RES_H; y++) {
        float dyPix = y - halfH;
        for (int x = 0; x < PANEL_RES_W; x++) {
            float dxPix = x - halfW;

            float nx = dxPix * scale;
            float ny = dyPix * scale;

            float n1 = sfNoise(nx * 1.6f + t * 0.6f,        ny * 1.6f - t * 0.4f)        - 0.5f;
            float n2 = sfNoise(nx * 1.6f + 5.2f + t * 0.5f, ny * 1.6f + 3.1f + t * 0.55f) - 0.5f;

            float valC = sfWaveHeight(nx, ny, n1, n2, t, warpAmtR, warpAmtA, scale, params.speed);

            float shaped = sfClamp01(valC);
            shaped = shaped * shaped * shaped;

            // Four-step ramp: black -> dim shadow tone -> blended mid tone
            // -> bright core. The shadow band gives shapes a soft fading
            // edge instead of a hard cutoff.
            uint8_t rr = 0, gg = 0, bb = 0;
            if (shaped > 0.62f) {
                float bri = sfClamp01((shaped - 0.62f) / 0.38f);
                PFColor::hsvToRgb(hueA, 0.85f, bri, rr, gg, bb);
            } else if (shaped > 0.40f) {
                float blend = (shaped - 0.40f) / 0.22f;
                PFColor::hsvToRgb(hueB, 0.9f, blend * 0.65f, rr, gg, bb);
            } else if (shaped > 0.20f) {
                float blend = (shaped - 0.20f) / 0.20f;
                PFColor::hsvToRgb(hueShadow, 0.8f, blend * 0.22f, rr, gg, bb);
            }

            // Sample the feedback buffer at a slowly rotated + shrunk
            // position — gives the "sucking into the tunnel" feel instead
            // of static ghosting.
            float rx = (dxPix * cosA - dyPix * sinA) / fbShrink;
            float ry = (dxPix * sinA + dyPix * cosA) / fbShrink;
            int sx = (int)constrain(roundf(halfW + rx), 0, PANEL_RES_W - 1);
            int sy = (int)constrain(roundf(halfH + ry), 0, PANEL_RES_H - 1);
            int pi = (sy * PANEL_RES_W + sx) * 3;
            float pr = (float)sfBuffer[pi], pg = (float)sfBuffer[pi+1], pb = (float)sfBuffer[pi+2];

            // Hard-clamped every frame so numerical drift can never build
            // into a white blow-up over time.
            float fr = constrain(((float)rr * (1.0f - feedbackMix) + pr * feedbackMix) * feedbackDecay, 0.0f, 255.0f);
            float fg = constrain(((float)gg * (1.0f - feedbackMix) + pg * feedbackMix) * feedbackDecay, 0.0f, 255.0f);
            float fb = constrain(((float)bb * (1.0f - feedbackMix) + pb * feedbackMix) * feedbackDecay, 0.0f, 255.0f);

            int idx3 = (y * PANEL_RES_W + x) * 3;
            sfBuffer[idx3]   = (uint8_t)roundf(fr);
            sfBuffer[idx3+1] = (uint8_t)roundf(fg);
            sfBuffer[idx3+2] = (uint8_t)roundf(fb);

            PFCanvas::setPixel(x, y, (uint8_t)roundf(fr), (uint8_t)roundf(fg), (uint8_t)roundf(fb));
        }
    }

    PFCanvas::present();
}

} // namespace SubFrequencyPattern