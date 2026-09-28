#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_params.h"
#include "src/core_math.h"
#include "src/core_color.h"
#include "src/core_mem.h"

namespace forAudioIntro {

const char* NAME = "forAudioIntro";
const char* const KNOB_LABELS[4] = {"Breath", "Spin", "Color", "Petals"};
constexpr bool ABSOLUTE_READY = true;

constexpr int FRAME_W = 64;
constexpr int FRAME_H = 128;
constexpr int NUM_PIXELS = FRAME_W * FRAME_H;

static float* g_ang = nullptr;
static float* g_rad = nullptr;

static float g_breath = 0.794f;
static float g_spin   = 0.0f;
static float g_color  = 1.0f;
static float g_petals = 3.994f;

static float g_rot = 0.0f;

void setup() {
    PFMath::buildSinLUT();

    if (!g_ang) g_ang = PFMem::allocFloats(NUM_PIXELS);
    if (!g_rad) g_rad = PFMem::allocFloats(NUM_PIXELS);

    if (g_ang && g_rad) {
        constexpr float cx = (FRAME_W - 1) * 0.5f;
        constexpr float cy = (FRAME_H - 1) * 0.5f;
        for (int y = 0; y < FRAME_H; ++y) {
            for (int x = 0; x < FRAME_W; ++x) {
                int i = y * FRAME_W + x;
                float dx = (float)x - cx;
                float dy = (float)y - cy;
                g_ang[i] = PFMath::fastAtan2(dy, dx);
                g_rad[i] = sqrtf(dx * dx + dy * dy);
            }
        }
    }
}

void update(float dt, const InputFrame& input) {
    if (dt > 0.1f) dt = 0.1f;

    PFParams::apply(input, 0, &g_breath, 0.0f, 1.0f, 0.021f);
    PFParams::apply(input, 1, &g_spin,   0.0f, 3.0f, 0.063f);
    PFParams::apply(input, 2, &g_color,  0.0f, 1.0f, 0.021f);
    PFParams::apply(input, 3, &g_petals, 3.0f, 9.0f, 0.125f);

    g_rot += dt * (0.1f + 5.0f * g_spin * g_spin);
    if (g_rot > TWO_PI * 100.0f) {
        g_rot -= TWO_PI * 100.0f;
    }
}

void draw() {
    PFCanvas::setFrame(FRAME_W, FRAME_H);

    if (!g_ang || !g_rad) {
        PFCanvas::present();
        return;
    }

    const float open = (float)FRAME_W * (0.28f + 0.5f * g_breath);
    const float n = roundf(g_petals);
    const float sat = g_color;

    constexpr float scale[3] = {1.0f, 0.68f, 0.4f};
    constexpr float off[3]   = {0.0f, 0.5f, 1.0f};

    const float rot = g_rot;
    const float rot_term_0 = rot * 1.0f + off[0];
    const float rot_term_1 = rot * 0.7f + off[1];
    const float rot_term_2 = rot * 0.4f + off[2];
    const float rot_hue = rot * 0.05f;

    for (int y = 0; y < FRAME_H; ++y) {
        for (int x = 0; x < FRAME_W; ++x) {
            int i = y * FRAME_W + x;
            float a = g_ang[i];
            float r = g_rad[i];

            float R = 0.0f, G = 0.0f, B = 0.0f;
            float inv_two_pi_a = a * (1.0f / TWO_PI);

            for (int L = 0; L < 3; ++L) {
                float rot_term = (L == 0) ? rot_term_0 : ((L == 1) ? rot_term_1 : rot_term_2);
                float angle = (a + rot_term) * n;
                float petal = 0.5f + 0.5f * PFMath::fastCos(angle);
                float edge = open * scale[L] * (0.5f + 0.5f * petal);

                float c = (edge - r) * 0.5f + 0.5f;
                if (c <= 0.0f) continue;
                if (c > 1.0f) c = 1.0f;

                float lum = 1.0f - 0.35f * (r / (edge + 1.0f));

                float h = PFMath::fract(L * 0.3f + inv_two_pi_a + rot_hue);
                uint8_t rgb_r, rgb_g, rgb_b;
                PFColor::hsvToRgb(h, 1.0f, 1.0f, rgb_r, rgb_g, rgb_b);

                float base_r = (float)rgb_r * (1.0f / 255.0f);
                float base_g = (float)rgb_g * (1.0f / 255.0f);
                float base_b = (float)rgb_b * (1.0f / 255.0f);

                float cr = lum * (1.0f + sat * (base_r - 1.0f));
                float cg = lum * (1.0f + sat * (base_g - 1.0f));
                float cb = lum * (1.0f + sat * (base_b - 1.0f));

                R += (cr - R) * c;
                G += (cg - G) * c;
                B += (cb - B) * c;
            }

            PFCanvas::setPixel(x, y,
                               (uint8_t)(fminf(fmaxf(R * 255.0f, 0.0f), 255.0f)),
                               (uint8_t)(fminf(fmaxf(G * 255.0f, 0.0f), 255.0f)),
                               (uint8_t)(fminf(fmaxf(B * 255.0f, 0.0f), 255.0f)));
        }
    }

    PFCanvas::present();
}

} // namespace forAudioIntro