#pragma once
#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_math.h"
#include "src/core_color.h"

namespace BouncyBeholder {

const char* NAME = "Bouncy Beholder";
const char* const KNOB_LABELS[4] = {"Count", "LookSpeed", "AnimSpeed", "Bounce"};

constexpr int FRAME_W = 64;
constexpr int FRAME_H = 128;

// Knob parameter ranges and defaults
constexpr float COUNT_MIN = 1.0f;
constexpr float COUNT_MAX = 6.0f;
constexpr float COUNT_STEP = 0.104f;

constexpr float LOOKSPEED_MIN = 0.1f;
constexpr float LOOKSPEED_MAX = 10.0f;
constexpr float LOOKSPEED_STEP = 0.206f;

constexpr float ANIMSPEED_MIN = 0.1f;
constexpr float ANIMSPEED_MAX = 10.0f;
constexpr float ANIMSPEED_STEP = 0.206f;

constexpr float BOUNCE_MIN = 0.0f;
constexpr float BOUNCE_MAX = 1.0f;
constexpr float BOUNCE_STEP = 0.021f;

// Internal state
static float t = 0.0f;
static float countParam = 1.0f;
static float lookSpeedParam = 2.0f;
static float animSpeedParam = 10.0f;
static float bounceParam = 1.0f;

void setup() {
    PFMath::buildSinLUT();
}

void update(float dt, const InputFrame& input) {
    // Consume encoder deltas
    countParam     += input.knobDeltas[0] * COUNT_STEP;
    lookSpeedParam += input.knobDeltas[1] * LOOKSPEED_STEP;
    animSpeedParam += input.knobDeltas[2] * ANIMSPEED_STEP;
    bounceParam    += input.knobDeltas[3] * BOUNCE_STEP;

    // Constrain to parameter ranges
    if (countParam < COUNT_MIN) countParam = COUNT_MIN;
    if (countParam > COUNT_MAX) countParam = COUNT_MAX;
    if (lookSpeedParam < LOOKSPEED_MIN) lookSpeedParam = LOOKSPEED_MIN;
    if (lookSpeedParam > LOOKSPEED_MAX) lookSpeedParam = LOOKSPEED_MAX;
    if (animSpeedParam < ANIMSPEED_MIN) animSpeedParam = ANIMSPEED_MIN;
    if (animSpeedParam > ANIMSPEED_MAX) animSpeedParam = ANIMSPEED_MAX;
    if (bounceParam < BOUNCE_MIN) bounceParam = BOUNCE_MIN;
    if (bounceParam > BOUNCE_MAX) bounceParam = BOUNCE_MAX;

    // Accumulate time and wrap at a common period that works for all sine/cosine multipliers
    // Multipliers used: 0.5, 0.8, 1.0, 0.4, 0.8*lookSpeed (variable), lookSpeed (variable)
    // Base period: 2*PI for integer multipliers. For lookSpeed (max 10), worst-case 0.1*10 = 1.0 factor.
    // Common multiple of all periods: 2*PI works for all integer-based multipliers.
    // Variable lookSpeed: product with t gives t*lookSpeed. If we wrap t at TWO_PI, t*lookSpeed wraps at lookSpeed*TWO_PI.
    // Since lookSpeed is not an integer, we need a period that's a multiple of TWO_PI for all lookSpeed values.
    // But t*lookSpeed feeds sin/cos, so wrapping t at TWO_PI works: sin(t*lookSpeed + TWO_PI*lookSpeed) = sin(t*lookSpeed).
    // So wrapping t at TWO_PI is correct.
    t += dt;
    if (t > TWO_PI) t -= TWO_PI;
}

void draw() {
    PFCanvas::setFrame(FRAME_W, FRAME_H);

    const int count = (int)fmaxf(1.0f, floorf(countParam));
    const float lookSpeed = lookSpeedParam;
    const float animSpeed = animSpeedParam;
    const float bounceAmt = bounceParam;

    const float fw = (float)FRAME_W;
    const float fh = (float)FRAME_H;
    const float halfW = fw * 0.5f;
    const float quarterW = fw * 0.25f;
    const float bounceHeightFactor = fh * 0.2f;

    // Clear background (dark fleshy/veiny purple)
    for (int y = 0; y < FRAME_H; y++) {
        for (int x = 0; x < FRAME_W; x++) {
            PFCanvas::setPixel(x, y, 25, 5, 15);
        }
    }

    // Draw each eye
    for (int e = 0; e < count; e++) {
        // 1. Base Position
        float baseCX = halfW;
        if (count > 1) {
            baseCX += PFMath::fastSin(e * 2.0f + t * 0.5f) * quarterW;
        }
        const float baseCY = (fh / (float)(count + 1)) * (float)(e + 1);

        // 2. Bounce Physics
        const float bouncePhase = t * animSpeed * 0.8f + (e * 0.5f);
        const float sinBounce = PFMath::fastSin(bouncePhase);
        const float verticalOffset = fabsf(sinBounce) * (bounceHeightFactor * bounceAmt);
        const float cy = baseCY - verticalOffset;

        // 3. Squash and Stretch
        const float vel = PFMath::fastCos(bouncePhase);
        const float stretch = 1.0f + (vel * 0.15f * bounceAmt);
        const float squash = 1.0f / stretch;

        // 4. Animation: Throb and Blink
        const float throbSin = PFMath::fastSin(t * animSpeed);
        const float throb = throbSin * 0.08f + 1.0f;
        const float blinkPhase = t * animSpeed * 0.4f + (float)e;
        const float blinkSin = PFMath::fastSin(blinkPhase);
        // pow(sin, 15) — use fastPow for variable exponent
        const float blinkAbs = fabsf(blinkSin);
        const float blink = PFMath::fastPow(blinkAbs, 15.0f);
        const float lidPos = (1.0f - blink) * (18.0f * throb * stretch);

        // 5. Looking around
        const float lookX = PFMath::fastSin(t * lookSpeed + (float)e) * 5.0f;
        const float lookY = PFMath::fastCos(t * lookSpeed * 0.8f + (float)e) * 3.0f;

        // Render Bounding Box
        const float boundW = 22.0f * throb * squash;
        const float boundH = 22.0f * throb * stretch;
        const int startX = (int)fmaxf(0.0f, floorf(baseCX - boundW));
        const int endX   = (int)fminf(fw, ceilf(baseCX + boundW));
        const int startY = (int)fmaxf(0.0f, floorf(cy - boundH));
        const int endY   = (int)fminf(fh, ceilf(cy + boundH));

        // Precompute eye center offsets
        const float irisCenterX = baseCX + lookX;
        const float irisCenterY = cy + lookY;

        for (int py = startY; py < endY; py++) {
            const float dy_raw = (float)py - cy;
            const float dy = dy_raw / stretch;
            if (fabsf(dy) > lidPos) continue;

            for (int px = startX; px < endX; px++) {
                const float dx_raw = (float)px - baseCX;
                const float dx = dx_raw / squash;
                const float dist = sqrtf(dx * dx + dy * dy);

                const float eyeRadius = 16.0f * throb;
                const float irisRadius = 8.0f * throb;
                const float pupilRadius = 3.5f * throb;

                if (dist < eyeRadius) {
                    float r = 245.0f, g = 245.0f, b = 245.0f; // Sclera

                    // Red Veins
                    const float angle = PFMath::fastAtan2(dy, dx);
                    const float vein = PFMath::fastSin(angle * 10.0f + dist * 0.4f + t);
                    if (dist > irisRadius && vein > 0.85f) {
                        r = 220.0f; g = 40.0f; b = 40.0f;
                    }

                    // Blue Iris Logic
                    const float idx = ((float)px - irisCenterX) / squash;
                    const float idy = ((float)py - irisCenterY) / stretch;
                    const float iDist = sqrtf(idx * idx + idy * idy);

                    if (iDist < irisRadius) {
                        r = 20.0f; g = 80.0f; b = 200.0f;

                        // Iris Radial Texture
                        const float irisAngle = PFMath::fastAtan2(idy, idx);
                        const float irisTex = PFMath::fastSin(irisAngle * 16.0f) * 40.0f;
                        r += irisTex; g += irisTex; b += irisTex;

                        // Pupil
                        if (iDist < pupilRadius) {
                            r = 0.0f; g = 0.0f; b = 0.0f;
                        }

                        // Specular Reflection
                        const float sx = idx + 2.5f;
                        const float sy = idy + 2.5f;
                        if (sqrtf(sx * sx + sy * sy) < 1.8f) {
                            r = 255.0f; g = 255.0f; b = 255.0f;
                        }
                    }

                    // Edge Vignette
                    if (dist > eyeRadius - 2.0f) {
                        const float edgeAlpha = (eyeRadius - dist) * 0.5f;
                        r *= edgeAlpha; g *= edgeAlpha; b *= edgeAlpha;
                    }

                    // Clamp and output
                    uint8_t r8 = (uint8_t)fmaxf(0.0f, fminf(255.0f, r));
                    uint8_t g8 = (uint8_t)fmaxf(0.0f, fminf(255.0f, g));
                    uint8_t b8 = (uint8_t)fmaxf(0.0f, fminf(255.0f, b));
                    PFCanvas::setPixel(px, py, r8, g8, b8);
                }
            }
        }
    }

    PFCanvas::present();
}

} // namespace BouncyBeholder