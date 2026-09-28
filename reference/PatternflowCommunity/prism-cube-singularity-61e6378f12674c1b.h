#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_math.h"

namespace PrismCubeSingularity {

constexpr int FRAME_W = 64;
constexpr int FRAME_H = 128;

const char* NAME = "Prism-Cube Singularity";
const char* const KNOB_LABELS[4] = {"Rot Speed", "Scale", "Prism Split", "Complexity"};

static float rotSpeed = 0.056f;
static float scale = 5.554f;
static float prismSplit = 10.0f;
static float complexity = 7.273f;

static float t = 0.0f;

inline float getChannelValue(float nx_off, float ny, float cosZ, float sinZ, float inv_scale, float t_10, int steps_int, float inv_steps) {
    float rx = nx_off * cosZ - ny * sinZ;
    float ry = nx_off * sinZ + ny * cosZ;

    float dist = fmaxf(fabsf(rx), fabsf(ry));

    int gx = (int)floorf(rx * inv_scale);
    int gy = (int)floorf(ry * inv_scale);

    int rings = (int)floorf(dist * inv_scale - t_10);
    int checker = (gx ^ gy ^ rings);

    int mod = checker % steps_int;
    return (float)mod * inv_steps;
}

void setup() {
    PFMath::buildSinLUT();
    t = 0.0f;
}

void update(float dt, const InputFrame& input) {
    rotSpeed   = fminf(fmaxf(rotSpeed   + input.knobDeltas[0] * 0.004f, 0.01f), 0.200f);
    scale      = fminf(fmaxf(scale      + input.knobDeltas[1] * 0.271f, 2.00f), 15.000f);
    prismSplit = fminf(fmaxf(prismSplit + input.knobDeltas[2] * 0.208f, 0.00f), 10.000f);
    complexity = fminf(fmaxf(complexity + input.knobDeltas[3] * 0.167f, 2.00f), 10.000f);

    t += dt * rotSpeed;
    constexpr float TIME_PERIOD = 20.0f * PI;
    if (t >= TIME_PERIOD) {
        t -= TIME_PERIOD;
    }
}

void draw() {
    PFCanvas::setFrame(FRAME_W, FRAME_H);

    const float scale_val = scale;
    const float inv_scale = 1.0f / scale_val;
    const float split_val = prismSplit;
    const int steps_int = (int)fmaxf(1.0f, floorf(complexity));
    const float inv_steps = 1.0f / (float)steps_int;

    const float rotZ = t;
    const float tiltX = PFMath::fastSin(t * 0.5f) * 0.2f;
    const float tiltY = PFMath::fastCos(t * 0.7f) * 0.2f;

    const float cosZ = PFMath::fastCos(rotZ);
    const float sinZ = PFMath::fastSin(rotZ);

    const float tiltX_w = tiltX * (float)FRAME_W * 0.2f;
    const float tiltY_h = tiltY * (float)FRAME_H * 0.2f;

    const float center_x = (float)FRAME_W * 0.5f;
    const float center_y = (float)FRAME_H * 0.5f;
    const float inv_center_x = 1.0f / center_x;
    const float inv_center_y = 1.0f / center_y;

    const float t_10 = t * 10.0f;

    for (int y = 0; y < FRAME_H; ++y) {
        float ny_base = ((float)y - center_y) + tiltY_h;

        float ny_norm = fabsf(((float)y - center_y) * inv_center_y);
        float py = ny_norm * ny_norm;
        py = py * py;

        for (int x = 0; x < FRAME_W; ++x) {
            float nx_base = ((float)x - center_x) + tiltX_w;

            float nx_norm = fabsf(((float)x - center_x) * inv_center_x);
            float px = nx_norm * nx_norm;
            px = px * px;

            float edgeFade = 1.0f - fmaxf(px, py);
            if (edgeFade < 0.0f) edgeFade = 0.0f;

            float rVal = getChannelValue(nx_base + split_val, ny_base, cosZ, sinZ, inv_scale, t_10, steps_int, inv_steps);
            float gVal = getChannelValue(nx_base,              ny_base, cosZ, sinZ, inv_scale, t_10, steps_int, inv_steps);
            float bVal = getChannelValue(nx_base - split_val, ny_base, cosZ, sinZ, inv_scale, t_10, steps_int, inv_steps);

            float sin_r = PFMath::fastSin(rVal * 6.28f + t);
            float sin_g = PFMath::fastSin(gVal * 6.28f + 2.0f);
            float sin_b = PFMath::fastSin(bVal * 6.28f + 4.0f);

            float r_f = (127.0f + 127.0f * sin_r) * edgeFade;
            float g_f = (127.0f + 127.0f * sin_g) * edgeFade;
            float b_f = (127.0f + 127.0f * sin_b) * edgeFade;

            uint8_t r8 = (uint8_t)fmaxf(0.0f, fminf(255.0f, r_f));
            uint8_t g8 = (uint8_t)fmaxf(0.0f, fminf(255.0f, g_f));
            uint8_t b8 = (uint8_t)fmaxf(0.0f, fminf(255.0f, b_f));

            PFCanvas::setPixel(x, y, r8, g8, b8);
        }
    }

    PFCanvas::present();
}

} // namespace PrismCubeSingularity