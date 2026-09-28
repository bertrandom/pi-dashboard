#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_math.h"

namespace PulsatingSolarFlare {

constexpr int FRAME_W = 64;
constexpr int FRAME_H = 128;

const char* NAME = "Pulsating Solar Flare";
const char* const KNOB_LABELS[4] = {"Density", "Pulse Speed", "Wave Freq", "Glow"};

static float g_density = 50.0f;
static float g_pulseSpeed = 2.0f;
static float g_waveFreq = 10.0f;
static float g_glow = 1.0f;
static float g_t = 0.0f;

static float s_rBase[401];

void setup() {
    PFMath::buildSinLUT();
    for (int i = 0; i <= 400; i++) {
        s_rBase[i] = 3.0f * sqrtf((float)i);
    }
}

void update(float dt, const InputFrame& input) {
    g_density += input.knobDeltas[0] * 7.292f;
    g_density = fminf(fmaxf(g_density, 50.0f), 400.0f);

    g_pulseSpeed += input.knobDeltas[1] * 0.206f;
    g_pulseSpeed = fminf(fmaxf(g_pulseSpeed, 0.1f), 10.0f);

    g_waveFreq += input.knobDeltas[2] * 0.188f;
    g_waveFreq = fminf(fmaxf(g_waveFreq, 1.0f), 10.0f);

    g_glow += input.knobDeltas[3] * 0.021f;
    g_glow = fminf(fmaxf(g_glow, 0.0f), 1.0f);

    g_t += dt * g_pulseSpeed;

    constexpr float WRAP_PERIOD = 5.0f * TWO_PI;
    if (g_t >= WRAP_PERIOD) {
        g_t -= WRAP_PERIOD;
    }
}

void draw() {
    PFCanvas::setFrame(FRAME_W, FRAME_H);

    for (int y = 0; y < FRAME_H; y++) {
        for (int x = 0; x < FRAME_W; x++) {
            PFCanvas::setPixel(x, y, 0, 0, 0);
        }
    }

    const float cx = FRAME_W * 0.5f;
    const float cy = FRAME_H * 0.5f;
    const int count = (int)g_density;
    const float freq = g_waveFreq;
    const float glow = g_glow;
    constexpr float GOLDEN_ANGLE = 2.39996f;

    const float t02 = g_t * 0.2f;

    for (int i = 1; i < count; i++) {
        const float rBase = s_rBase[i];
        const float pulse = PFMath::fastSin(rBase * 0.2f - g_t) * freq;
        const float radius = rBase + pulse;
        const float angle = (float)i * GOLDEN_ANGLE + t02;

        const int x = (int)floorf(cx + PFMath::fastCos(angle) * radius);
        const int y = (int)floorf(cy + PFMath::fastSin(angle) * radius);

        if (x >= 0 && x < FRAME_W && y >= 0 && y < FRAME_H) {
            const int bri = (int)(150.0f + 105.0f * PFMath::fastSin(pulse * 0.5f));
            const uint8_t r8 = (uint8_t)fminf(fmaxf((float)bri, 0.0f), 255.0f);
            const uint8_t g8 = (uint8_t)fminf(fmaxf((float)bri * glow, 0.0f), 255.0f);

            PFCanvas::setPixel(x, y, r8, g8, 0);

            if (glow > 0.5f) {
                const uint8_t bloomR = r8 / 2;
                if (x + 1 < FRAME_W) {
                    PFCanvas::setPixel(x + 1, y, bloomR, 0, 0);
                }
                if (y + 1 < FRAME_H) {
                    PFCanvas::setPixel(x, y + 1, bloomR, 0, 0);
                }
            }
        }
    }

    PFCanvas::present();
}

} // namespace PulsatingSolarFlare