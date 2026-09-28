#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_params.h"
#include "src/core_math.h"
#include "src/core_mem.h"

// Reference color ramp: stops 0.402:#000000, 0.728:#00aaff, 1.000:#ffffff; mode oklchLong; wrap off.

namespace MembraneWave {

    const char* NAME = "Membrane";
    const char* const KNOB_LABELS[4] = {"Tension", "Damp", "Cadence", "Gain"};
    constexpr bool ABSOLUTE_READY = true;

    constexpr int FRAME_W = 64;
    constexpr int FRAME_H = 128;
    constexpr int NUM_PIXELS = FRAME_W * FRAME_H;

    static const uint8_t RAMP_LUT[256][3] = {
      {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
      {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
      {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
      {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
      {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
      {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
      {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
      {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
      {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
      {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
      {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
      {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
      {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
      {0,0,0},{0,0,0},{0,0,0},{0,0,1},{0,0,1},{0,0,2},{1,1,3},{1,1,4},
      {1,1,5},{2,2,7},{3,2,9},{5,3,11},{6,3,13},{8,4,15},{11,5,17},{14,5,19},
      {17,6,20},{20,7,22},{23,8,23},{26,9,25},{30,10,26},{33,11,27},{36,12,27},{40,13,28},
      {43,14,28},{47,16,28},{50,17,28},{54,18,28},{57,20,27},{60,21,27},{64,23,26},{67,25,24},
      {70,27,23},{73,29,21},{76,31,19},{79,33,17},{81,36,14},{84,38,10},{86,41,6},{88,44,1},
      {89,48,0},{89,51,0},{90,55,0},{91,58,0},{91,62,0},{91,66,0},{92,69,0},{92,73,0},
      {91,77,0},{91,80,0},{90,84,0},{89,88,0},{87,92,0},{84,96,0},{81,101,6},{77,105,18},
      {72,109,28},{66,113,37},{60,117,46},{52,121,54},{42,125,62},{29,128,71},{1,132,79},{0,134,90},
      {0,137,99},{0,139,108},{0,141,116},{0,143,124},{0,146,131},{0,148,139},{0,150,146},{0,152,154},
      {0,154,161},{0,157,169},{0,159,177},{0,161,185},{0,163,193},{0,165,202},{0,166,212},{0,168,222},
      {0,169,234},{0,170,246},{35,169,255},{71,168,255},{92,166,255},{108,165,255},{122,163,255},{134,162,255},
      {144,161,255},{154,159,255},{164,158,255},{173,156,255},{182,154,254},{191,153,250},{199,153,246},{206,152,241},
      {213,152,236},{220,152,231},{225,152,225},{231,153,219},{236,153,213},{240,154,207},{244,156,201},{247,157,195},
      {250,159,190},{252,161,184},{254,163,179},{255,166,174},{255,169,170},{255,172,166},{255,175,162},{255,178,158},
      {255,180,155},{254,184,153},{252,187,151},{250,191,150},{248,194,150},{246,197,151},{243,201,152},{240,204,153},
      {237,208,156},{234,211,159},{231,214,162},{229,217,166},{226,220,170},{223,222,174},{220,225,179},{218,227,184},
      {216,230,189},{214,232,194},{213,234,199},{212,235,204},{211,237,209},{211,239,214},{211,240,219},{212,241,223},
      {213,242,228},{214,243,232},{216,244,235},{218,245,239},{221,246,242},{224,247,245},{227,247,247},{230,248,249},
      {233,249,251},{236,250,252},{240,250,253},{243,251,254},{246,252,255},{249,253,255},{252,254,255},{255,255,255},
    };

    static float tension = 0.247f;
    static float damp = 0.007f;
    static float cadence = 0.932f;
    static float gain = 1.409f;

    static float* u0 = nullptr;
    static float* u1 = nullptr;

    static float strikeT = 0.0f;
    static float signVal = 1.0f;
    static int whichMallet = 0;
    static bool clapTrigger = false;
    static float dtAcc = 0.0f;
    static float timeAcc = 0.0f;

    static void poke(float* u, int W, int H, float x, float y, float amp) {
        int ix = (int)x;
        int iy = (int)y;
        for (int dy = -1; dy <= 1; dy++) {
            for (int dx = -1; dx <= 1; dx++) {
                int px = ix + dx;
                int py = iy + dy;
                if (px > 0 && px < W - 1 && py > 0 && py < H - 1) {
                    float weight = (dx == 0 && dy == 0) ? 1.0f : 0.5f;
                    u[py * W + px] += amp * weight;
                }
            }
        }
    }

    void setup() {
        PFMath::buildSinLUT();
        if (!u0) u0 = PFMem::allocFloats(NUM_PIXELS);
        if (!u1) u1 = PFMem::allocFloats(NUM_PIXELS);
        strikeT = 0.0f;
        signVal = 1.0f;
        whichMallet = 0;
        clapTrigger = false;
        dtAcc = 0.0f;
        timeAcc = 0.0f;
    }

    void update(float dt, const InputFrame& input) {
        if (!u0 || !u1) return;

        PFParams::apply(input, 0, &tension, 0.08f, 0.45f, 0.008f);
        PFParams::apply(input, 1, &damp, 0.001f, 0.03f, 0.001f);
        PFParams::apply(input, 2, &cadence, 0.3f, 5.0f, 0.098f);
        PFParams::apply(input, 3, &gain, 1.0f, 6.0f, 0.104f);

        if (input.btnPressed[0] && !input.paramAbsoluteActive[0] && !input.knobAudioActive[0]) {
            clapTrigger = true;
        }

        dtAcc += dt;
        timeAcc += dt;
        if (timeAcc > 6283.1853f) {
            timeAcc -= 6283.1853f;
        }
    }

    void draw() {
        PFCanvas::setFrame(FRAME_W, FRAME_H);
        if (!u0 || !u1) {
            PFCanvas::present();
            return;
        }

        float dt = dtAcc;
        dtAcc = 0.0f;
        if (dt > 0.1f) dt = 0.1f;

        strikeT -= dt * cadence;
        if (strikeT <= 0.0f || clapTrigger) {
            if (clapTrigger) {
                poke(u1, FRAME_W, FRAME_H, FRAME_W * 0.5f, FRAME_H * 0.5f, 5.0f);
                clapTrigger = false;
            } else {
                float sx2 = 0.0f;
                float sy2 = 0.0f;
                if (whichMallet == 0) {
                    sx2 = FRAME_W * (0.5f + 0.34f * PFMath::fastSin(timeAcc * 0.41f));
                    sy2 = FRAME_H * (0.22f + 0.10f * PFMath::fastSin(timeAcc * 0.29f));
                } else if (whichMallet == 1) {
                    sx2 = FRAME_W * (0.5f + 0.34f * PFMath::fastSin(timeAcc * 0.33f + 2.1f));
                    sy2 = FRAME_H * (0.50f + 0.12f * PFMath::fastCos(timeAcc * 0.24f));
                } else {
                    sx2 = FRAME_W * (0.5f + 0.34f * PFMath::fastCos(timeAcc * 0.37f + 4.4f));
                    sy2 = FRAME_H * (0.78f + 0.10f * PFMath::fastSin(timeAcc * 0.31f + 1.2f));
                }
                poke(u1, FRAME_W, FRAME_H, sx2, sy2, 2.6f * signVal);
                signVal = -signVal;
                whichMallet = (whichMallet + 1) % 3;
            }
            strikeT += 1.0f;
            if (strikeT < 0.0f) strikeT = 0.2f;
        }

        const float dd = 1.0f - damp;
        for (int s = 0; s < 2; s++) {
            for (int y = 1; y < FRAME_H - 1; y++) {
                const int row = y * FRAME_W;
                for (int x = 1; x < FRAME_W - 1; x++) {
                    const int i = row + x;
                    const float lap = u1[i - 1] + u1[i + 1] + u1[i - FRAME_W] + u1[i + FRAME_W] - 4.0f * u1[i];
                    u0[i] = (2.0f * u1[i] - u0[i] + tension * lap) * dd;
                }
            }
            float* tmp = u0;
            u0 = u1;
            u1 = tmp;
        }

        const float halfGain = gain * 0.5f;
        for (int y = 0, i = 0; y < FRAME_H; y++) {
            for (int x = 0; x < FRAME_W; x++, i++) {
                float v = 0.5f + u1[i] * halfGain;
                if (v > 0.92f) v = 1.0f;
                else if (v < 0.06f) v = 0.0f;

                if (v < 0.0f) v = 0.0f;
                else if (v > 1.0f) v = 1.0f;

                int li = (int)(v * 255.0f + 0.5f);
                PFCanvas::setPixel(x, y, RAMP_LUT[li][0], RAMP_LUT[li][1], RAMP_LUT[li][2]);
            }
        }

        PFCanvas::present();
    }

} // namespace MembraneWave