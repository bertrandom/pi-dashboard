#pragma once

#include <Arduino.h>
#include <string.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_params.h"
#include "src/core_math.h"
#include "src/core_mem.h"

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
// Color ramp: stops 0.000:#000000, 0.129:#1100ff, 0.513:#ff0000; mode linear; wrap off.

namespace Poolside {

    const char* NAME = "Poolside";
    const char* const KNOB_LABELS[4] = {"Depth", "Drift", "Chop", "Swell"};
    constexpr bool ABSOLUTE_READY = true;

    constexpr int FRAME_W = 64;
    constexpr int FRAME_H = 128;
    constexpr int TOTAL_PIXELS = FRAME_W * FRAME_H;

    // Knob states initialized from Pattern Lab values
    static float paramDepth = 23.415f; // min 3, max 30
    static float paramDrift = 2.077f;  // min 0.2, max 4
    static float paramChop  = 1.034f;  // min 0.4, max 2
    static float paramSwell = 80.0f;   // min 20, max 80

    // Time phase accumulators wrapped at TWO_PI to avoid precision loss
    static float phase1 = 0.0f;
    static float phase2 = 0.0f;
    static float phase3 = 0.0f;

    // Per-pixel buffers allocated from PSRAM
    static float* nb = nullptr;
    static float* acc = nullptr;

    static const uint8_t RAMP_LUT[256][3] = {
      {0,0,0},{1,0,8},{1,0,16},{2,0,23},{2,0,31},{3,0,39},{3,0,47},{4,0,54},
      {4,0,62},{5,0,70},{5,0,78},{6,0,85},{6,0,93},{7,0,101},{7,0,109},{8,0,116},
      {8,0,124},{9,0,132},{9,0,140},{10,0,147},{10,0,155},{11,0,163},{11,0,171},{12,0,178},
      {12,0,186},{13,0,194},{13,0,202},{14,0,209},{14,0,217},{15,0,225},{16,0,233},{16,0,240},
      {17,0,248},{17,0,255},{20,0,252},{22,0,250},{25,0,247},{27,0,244},{29,0,242},{32,0,239},
      {34,0,236},{37,0,234},{39,0,231},{42,0,229},{44,0,226},{46,0,223},{49,0,221},{51,0,218},
      {54,0,216},{56,0,213},{59,0,210},{61,0,208},{63,0,205},{66,0,203},{68,0,200},{71,0,197},
      {73,0,195},{76,0,192},{78,0,190},{80,0,187},{83,0,184},{85,0,182},{88,0,179},{90,0,177},
      {93,0,174},{95,0,171},{97,0,169},{100,0,166},{102,0,164},{105,0,161},{107,0,158},{110,0,156},
      {112,0,153},{114,0,151},{117,0,148},{119,0,145},{122,0,143},{124,0,140},{127,0,138},{129,0,135},
      {131,0,132},{134,0,130},{136,0,127},{139,0,125},{141,0,122},{144,0,119},{146,0,117},{149,0,114},
      {151,0,111},{153,0,109},{156,0,106},{158,0,104},{161,0,101},{163,0,98},{166,0,96},{168,0,93},
      {170,0,91},{173,0,88},{175,0,85},{178,0,83},{180,0,80},{183,0,78},{185,0,75},{187,0,72},
      {190,0,70},{192,0,67},{195,0,65},{197,0,62},{200,0,59},{202,0,57},{204,0,54},{207,0,52},
      {209,0,49},{212,0,46},{214,0,44},{217,0,41},{219,0,39},{221,0,36},{224,0,33},{226,0,31},
      {229,0,28},{231,0,26},{234,0,23},{236,0,20},{238,0,18},{241,0,15},{243,0,13},{246,0,10},
      {248,0,7},{251,0,5},{253,0,2},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},
      {255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},
      {255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},
      {255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},
      {255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},
      {255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},
      {255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},
      {255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},
      {255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},
      {255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},
      {255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},
      {255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},
      {255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},
      {255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},
      {255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},
      {255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},{255,0,0},
    };

    void setup() {
        PFMath::buildSinLUT();
        if (!nb) nb = PFMem::allocFloats(TOTAL_PIXELS);
        if (!acc) acc = PFMem::allocFloats(TOTAL_PIXELS);
    }

    void update(float dt, const InputFrame& input) {
        PFParams::apply(input, 0, &paramDepth, 3.0f, 30.0f, 0.563f);
        PFParams::apply(input, 1, &paramDrift, 0.2f, 4.0f, 0.079f);
        PFParams::apply(input, 2, &paramChop, 0.4f, 2.0f, 0.033f);
        PFParams::apply(input, 3, &paramSwell, 20.0f, 80.0f, 1.25f);

        if (!nb || !acc) return;

        // t1 = time * drift * 1.9, t2 = -time * drift * 2.6, t3 = time * drift * 4.1
        phase1 += dt * paramDrift * 1.9f;
        while (phase1 >= TWO_PI) phase1 -= TWO_PI;
        while (phase1 < 0.0f) phase1 += TWO_PI;

        phase2 -= dt * paramDrift * 2.6f;
        while (phase2 >= TWO_PI) phase2 -= TWO_PI;
        while (phase2 < 0.0f) phase2 += TWO_PI;

        phase3 += dt * paramDrift * 4.1f;
        while (phase3 >= TWO_PI) phase3 -= TWO_PI;
        while (phase3 < 0.0f) phase3 += TWO_PI;
    }

    void draw() {
        PFCanvas::setFrame(FRAME_W, FRAME_H);

        if (!nb || !acc) {
            PFCanvas::present();
            return;
        }

        memset(nb, 0, TOTAL_PIXELS * sizeof(float));

        const float k1 = 6.2831853f / paramSwell;
        const float k2 = 6.2831853f / (paramSwell * 0.57f);
        const float k3 = 6.2831853f / (paramSwell * 0.31f);

        constexpr float d1x = 0.14f;
        constexpr float d1y = 0.99f;
        constexpr float d2x = -0.42f;
        constexpr float d2y = 0.91f;
        constexpr float d3x = 0.88f;
        constexpr float d3y = 0.47f;

        const float kx1 = k1 * d1x;
        const float ky1 = k1 * d1y;
        const float kx2 = k2 * d2x;
        const float ky2 = k2 * d2y;
        const float kx3 = k3 * d3x;
        const float ky3 = k3 * d3y;

        const float a1 = paramChop * 0.55f;
        const float a2 = paramChop * 0.40f;
        const float a3 = paramChop * 0.26f;

        for (int y = 0; y < FRAME_H; ++y) {
            const float p1r = (float)y * ky1 + phase1;
            const float p2r = (float)y * ky2 + phase2;
            const float p3r = (float)y * ky3 + phase3;

            for (int x = 0; x < FRAME_W; ++x) {
                const float c1 = PFMath::fastCos((float)x * kx1 + p1r);
                const float c2 = PFMath::fastCos((float)x * kx2 + p2r);
                const float c3 = PFMath::fastCos((float)x * kx3 + p3r);

                const float gx = a1 * c1 * d1x + a2 * c2 * d2x + a3 * c3 * d3x;
                const float gy = a1 * c1 * d1y + a2 * c2 * d2y + a3 * c3 * d3y;

                int tx = PFMath::ifloor((float)x + gx * paramDepth);
                int ty = PFMath::ifloor((float)y + gy * paramDepth);

                tx = ((tx % FRAME_W) + FRAME_W) % FRAME_W;
                ty = ((ty % FRAME_H) + FRAME_H) % FRAME_H;

                nb[ty * FRAME_W + tx] += 0.2f;
            }
        }

        // Temporal blend & value mapping to color ramp
        int idx = 0;
        for (int y = 0; y < FRAME_H; ++y) {
            for (int x = 0; x < FRAME_W; ++x, ++idx) {
                acc[idx] = acc[idx] * 0.45f + nb[idx] * 0.55f;
                const float a = acc[idx];

                float v = (a > 0.1f) ? (((a - 0.1f) * 1.6f) / (1.0f + a)) : 0.0f;
                v = PFMath::clamp01(v);

                const int li = (int)(v * 255.0f + 0.5f);
                PFCanvas::setPixel(x, y, RAMP_LUT[li][0], RAMP_LUT[li][1], RAMP_LUT[li][2]);
            }
        }

        PFCanvas::present();
    }

} // namespace Poolside