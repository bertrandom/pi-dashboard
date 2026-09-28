#pragma once
#include <Arduino.h>
#include <math.h>
#include <stdint.h>
#include <string.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_math.h"
#include "src/core_color.h"

namespace HypnoticRedTrailPattern {

const char* NAME = "Hypnotic Red Trail";
const char* const KNOB_LABELS[4] = {"HUE", "SPEED", "WARP", "ZOOM"};

const float HRT_SPEED_MIN  = 0.1f;
const float HRT_SPEED_MAX  = 5.0f;
const float HRT_SPEED_STEP = 0.05f;

const float HRT_WARP_MIN   = 0.0f;
const float HRT_WARP_MAX   = 1.0f;
const float HRT_WARP_STEP  = 0.01f;

const float HRT_ZOOM_MIN   = 0.0f;
const float HRT_ZOOM_MAX   = 1.0f;
const float HRT_ZOOM_STEP  = 0.01f;

const int HRT_SECTORS = 6;
const int HRT_NUM_BLOBS = 5;
const float HRT_TWO_PI = 6.28318530718f;

// Eksakte konstanter for 6 like store sektorer (60 grader mellomrom).
// Ingen trig-kall nødvendig siden vinklene alltid er de samme.
const float HRT_SECTOR_COS[HRT_SECTORS] = {1.0f, 0.5f, -0.5f, -1.0f, -0.5f, 0.5f};
const float HRT_SECTOR_SIN[HRT_SECTORS] = {0.0f, 0.8660254f, 0.8660254f, 0.0f, -0.8660254f, -0.8660254f};

struct Params {
    float hueBase;
    float speed;
    float warp;
    float zoom;
    float timeAcc;
    // uint8_t trail-buffer i stedet for float, 24KB i stedet for 96KB.
    // Persistent mellom frames, gir hver blob et fadende spøkelsesspor.
    uint8_t trail[PANEL_RES_W * PANEL_RES_H * 3];
};

Params params;

static inline void hrtSplat(uint8_t* trail, int cx, int cy, uint8_t r, uint8_t g, uint8_t b, float radius) {
    int minX = (int)(cx - radius); if (minX < 0) minX = 0;
    int maxX = (int)(cx + radius); if (maxX > PANEL_RES_W - 1) maxX = PANEL_RES_W - 1;
    int minY = (int)(cy - radius); if (minY < 0) minY = 0;
    int maxY = (int)(cy + radius); if (maxY > PANEL_RES_H - 1) maxY = PANEL_RES_H - 1;

    for (int y = minY; y <= maxY; y++) {
        for (int x = minX; x <= maxX; x++) {
            float dx = (float)(x - cx);
            float dy = (float)(y - cy);
            float dist = PFMath::approxLength(dx, dy);
            if (dist > radius) continue;

            float falloffBase = 1.0f - dist / radius;
            float falloff = falloffBase * falloffBase;

            int idx = (y * PANEL_RES_W + x) * 3;
            uint16_t sr = (uint16_t)trail[idx]     + (uint16_t)(r * falloff);
            uint16_t sg = (uint16_t)trail[idx + 1] + (uint16_t)(g * falloff);
            uint16_t sb = (uint16_t)trail[idx + 2] + (uint16_t)(b * falloff);

            trail[idx]     = sr > 255 ? 255 : (uint8_t)sr;
            trail[idx + 1] = sg > 255 ? 255 : (uint8_t)sg;
            trail[idx + 2] = sb > 255 ? 255 : (uint8_t)sb;
        }
    }
}

void setup() {
    PFMath::buildSinLUT();
    params.hueBase = 0.3f;
    params.speed   = 1.2f;
    params.warp    = 0.5f;
    params.zoom    = 0.5f;
    params.timeAcc = 0.0f;
    memset(params.trail, 0, sizeof(params.trail));
}

void update(float dt, const InputFrame& input) {
    // Hue er en evig roterende encoder uten endepunkt, wrapper rundt via fmodf
    params.hueBase += input.knobDeltas[0] * 0.05f;
    params.hueBase  = fmodf(params.hueBase, 1.0f);
    if (params.hueBase < 0.0f) params.hueBase += 1.0f;

    params.speed = constrain(params.speed + input.knobDeltas[1] * HRT_SPEED_STEP, HRT_SPEED_MIN, HRT_SPEED_MAX);
    params.warp  = constrain(params.warp  + input.knobDeltas[2] * HRT_WARP_STEP,  HRT_WARP_MIN,  HRT_WARP_MAX);
    params.zoom  = constrain(params.zoom  + input.knobDeltas[3] * HRT_ZOOM_STEP,  HRT_ZOOM_MIN,  HRT_ZOOM_MAX);

    if (dt <= 0.0f || isnan(dt)) return;
    params.timeAcc += dt * params.speed;
}

void draw() {
    const float t = params.timeAcc;
    const float chaos = params.warp;
    const float hueBase = params.hueBase;
    const float zoomFactor = 0.25f + params.zoom * 1.55f;

    // Decay i Q8 fastpunkt (heltallsmultiplikasjon + skift) i stedet for
    // float-multiplikasjon over hele bufferet. Saturating add under splat
    // holder verdiene innenfor 0-255, så ingen separat clamp-passering trengs.
    uint16_t decayQ8 = (uint16_t)(204.0f + chaos * 46.0f);
    const int bufSize = PANEL_RES_W * PANEL_RES_H * 3;
    for (int i = 0; i < bufSize; i++) {
        params.trail[i] = (uint8_t)(((uint16_t)params.trail[i] * decayQ8) >> 8);
    }

    const float cx = PANEL_RES_W / 2.0f;
    const float cy = PANEL_RES_H / 2.0f;
    const float scaleX = (PANEL_RES_W / 2.0f) * 0.9f * zoomFactor;
    const float scaleY = (PANEL_RES_H / 2.0f) * 0.9f * zoomFactor;
    const float minRadius = (scaleX < scaleY ? scaleX : scaleY) * 0.25f;

    for (int i = 0; i < HRT_NUM_BLOBS; i++) {
        float fi = (float)i;
        float phase = (fi / (float)HRT_NUM_BLOBS) * HRT_TWO_PI;

        float freqX = 2.0f + fi * 0.3f;
        float freqY = 3.0f + fi * 0.2f + chaos * 1.5f;
        float wobble = PFMath::fastSin(t * 1.7f + phase * 3.0f) * chaos * 0.6f;

        float ang = t * (0.6f + fi * 0.05f) + phase;
        float px = PFMath::fastCos(ang * freqX * 0.3f + wobble) * scaleX;
        float py = PFMath::fastSin(ang * freqY * 0.3f - wobble) * scaleY;

        float radialPulse = 1.0f + PFMath::fastSin(t * 1.3f + phase) * chaos * 0.35f;
        px *= radialPulse;
        py *= radialPulse;

        float distFromCenter = PFMath::approxLength(px, py);
        if (distFromCenter < minRadius) {
            float factor = minRadius / (distFromCenter + 0.0001f);
            px *= factor;
            py *= factor;
        }

        // Rødt fargebånd: fra burgunder via ren rød til oransje-rød
        float hueSpread = 0.07f;
        float hueOffset = (fi / (float)HRT_NUM_BLOBS - 0.5f) * hueSpread;
        float hue = hueBase * 0.10f + 0.98f + hueOffset;
        hue -= floorf(hue);

        float sat = 0.75f + (fi / (float)HRT_NUM_BLOBS) * 0.2f;
        float val = 0.9f + PFMath::fastSin(phase) * 0.1f;

        uint8_t r, g, b;
        PFColor::hsvToRgb(hue, sat, val, r, g, b);

        for (int s = 0; s < HRT_SECTORS; s++) {
            float mx = px * HRT_SECTOR_COS[s] - py * HRT_SECTOR_SIN[s];
            float my = px * HRT_SECTOR_SIN[s] + py * HRT_SECTOR_COS[s];
            hrtSplat(params.trail, (int)(cx + mx), (int)(cy + my), r, g, b, 2.2f);
        }
    }

    for (int y = 0; y < PANEL_RES_H; y++) {
        for (int x = 0; x < PANEL_RES_W; x++) {
            int idx = (y * PANEL_RES_W + x) * 3;
            PFCanvas::setPixel(x, y, params.trail[idx], params.trail[idx + 1], params.trail[idx + 2]);
        }
    }
    PFCanvas::present();
}

} // namespace HypnoticRedTrailPattern