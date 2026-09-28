#pragma once

#include <Arduino.h>
#include <math.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_math.h"

namespace Kaleidoscope {

const char* NAME = "Kaleidoscope";
const char* const KNOB_LABELS[4] = {"Hue", "Speed", "ZoomOut", "Sectors"};

static constexpr float HUE_STEP = 0.05f;
static constexpr float SPEED_STEP = 0.05f;
static constexpr float ZOOM_STEP = 0.03f;
static constexpr float SECTOR_STEP = 0.2f;

static float hueBase = 0.7f;
static float speed = 1.0f;
static float zoomOut = 0.35f;   // ~2x2-ish start
static float sectors = 6.0f;
static float timeAcc = 0.0f;

static float clampf(float v, float lo, float hi) {
    return fminf(hi, fmaxf(lo, v));
}

static void hsvToRgb(float h, float s, float v, uint8_t& r, uint8_t& g, uint8_t& b) {
    if (h < 0.0f) h += 1.0f;
    h = fmodf(h, 1.0f);
    if (h < 0.0f) h += 1.0f;

    const float i = floorf(h * 6.0f);
    const float f = h * 6.0f - i;
    const float p = v * (1.0f - s);
    const float q = v * (1.0f - f * s);
    const float t = v * (1.0f - (1.0f - f) * s);

    float rf = 0, gf = 0, bf = 0;
    switch (static_cast<int>(i) % 6) {
        case 0: rf = v; gf = t; bf = p; break;
        case 1: rf = q; gf = v; bf = p; break;
        case 2: rf = p; gf = v; bf = t; break;
        case 3: rf = p; gf = q; bf = v; break;
        case 4: rf = t; gf = p; bf = v; break;
        default: rf = v; gf = p; bf = q; break;
    }

    r = static_cast<uint8_t>(rf * 255.0f);
    g = static_cast<uint8_t>(gf * 255.0f);
    b = static_cast<uint8_t>(bf * 255.0f);
}

static float fastCos(float x) {
    return PFMath::fastSin(x + static_cast<float>(PI) * 0.5f);
}

void setup() {
    PFMath::buildSinLUT();

    hueBase = 0.7f;
    speed = 1.0f;
    zoomOut = 0.35f;
    sectors = 6.0f;
    timeAcc = 0.0f;
}

void update(float dt, const InputFrame& input) {
    hueBase = fmodf(hueBase + input.knobDeltas[0] * HUE_STEP, 1.0f);
    if (hueBase < 0.0f) hueBase += 1.0f;

    speed = fmaxf(0.0f, speed + input.knobDeltas[1] * SPEED_STEP);
    zoomOut = clampf(zoomOut + input.knobDeltas[2] * ZOOM_STEP, 0.0f, 1.0f);
    sectors = clampf(sectors + input.knobDeltas[3] * SECTOR_STEP, 2.0f, 12.0f);

    timeAcc += dt * speed;
    if (timeAcc > 1000.0f) timeAcc -= 1000.0f;
}

void draw() {
    const float t = timeAcc;

    // zoomOut 0 → 1 tile, zoomOut 1 → 4 tiles (4x4 max)
    const float tiles = 1.0f + zoomOut * 3.0f;
    const float plasmaZoom = 1.6f + zoomOut * 2.5f;

    const int sectorCount = static_cast<int>(fmaxf(2.0f, floorf(sectors + 0.5f)));
    const float sectorAngle = static_cast<float>(PI) * 2.0f / static_cast<float>(sectorCount);
    const float rotate = t * 0.15f;

    const float invW = 1.0f / static_cast<float>(PANEL_RES_W);
    const float invH = 1.0f / static_cast<float>(PANEL_RES_H);

    for (int y = 0; y < PANEL_RES_H; ++y) {
        for (int x = 0; x < PANEL_RES_W; ++x) {
            // Tile local coords in [0,1)
            float tx = static_cast<float>(x) * invW * tiles;
            float ty = static_cast<float>(y) * invH * tiles;
            const float tileX = floorf(tx);
            const float tileY = floorf(ty);
            const float fx = tx - tileX;
            const float fy = ty - tileY;

            // Kaleidoscope centered in tile
            const float dx = fx - 0.5f;
            const float dy = fy - 0.5f;
            const float r = sqrtf(dx * dx + dy * dy) * 2.0f;

            float a = atan2f(dy, dx) + rotate;
            a = fmodf(a, sectorAngle);
            if (a < 0.0f) a += sectorAngle;
            if (a > sectorAngle * 0.5f) a = sectorAngle - a;

            const float nx = fastCos(a) * r * plasmaZoom;
            const float ny = PFMath::fastSin(a) * r * plasmaZoom;

            const float warpX = PFMath::fastSin(ny * 2.0f + t) * 0.8f;
            const float warpY = fastCos(nx * 2.0f - t * 1.2f) * 0.8f;

            const float v1 = PFMath::fastSin(nx + t);
            const float v2 = fastCos(ny - t * 0.8f);
            const float v3 = PFMath::fastSin((nx + warpX) * 1.5f + t * 1.5f);
            const float v4 = fastCos((ny + warpY) * 1.5f - t);

            float field = fabsf(v1 + v2 + v3 + v4);
            float val = 1.0f - field * 0.5f;
            val = clampf(val, 0.0f, 1.0f);
            val = val * val * val; // pow 3
            val = clampf(val * 2.4f, 0.0f, 1.0f);

            const float edge = clampf(1.0f - r * 1.05f, 0.0f, 1.0f);
            val *= 0.35f + edge * 0.65f;

            const float tileId = tileX * 0.07f + tileY * 0.11f;
            float hue = hueBase + r * 0.4f + field * 0.05f + a * 0.1f + tileId;
            hue = fmodf(hue, 1.0f);
            if (hue < 0.0f) hue += 1.0f;

            uint8_t r8, g8, b8;
            hsvToRgb(hue, 1.0f - val * 0.2f, val, r8, g8, b8);
            PFCanvas::setPixel(x, y, r8, g8, b8);
        }
    }

    PFCanvas::present();
}

} // namespace Kaleidoscope