#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_params.h"
#include "src/core_math.h"
#include "src/core_mem.h"

namespace Feeling {

    const char* NAME = "Feeling";
    const char* const KNOB_LABELS[4] = {"BreakBifur", "Tension", "StressGain", "FractureFade"};
    constexpr bool ABSOLUTE_READY = true;

    constexpr int FRAME_W = 64;
    constexpr int FRAME_H = 128;
    constexpr int NUM_PIXELS = FRAME_W * FRAME_H;

    static float knobBreakBifur = 0.054f;
    static float knobTension = 1.086f;
    static float knobStressGain = 0.5f;
    static float knobFractureFade = 0.96f;

    static float* u = nullptr;
    static float* v = nullptr;
    static float* uNext = nullptr;
    static float* vNext = nullptr;
    static float* stress = nullptr;

    static const uint8_t RAMP_LUT[256][3] = {
      {0,0,0},{1,1,3},{9,5,17},{32,13,29},{58,23,31},{82,37,23},{97,59,0},{97,88,0},
      {75,119,45},{0,145,108},{0,163,168},{0,177,235},{0,181,235},{0,181,213},{0,181,195},{0,180,177},
      {0,179,159},{0,179,138},{0,178,108},{56,174,70},{97,167,14},{129,156,0},{147,146,0},{160,137,0},
      {170,128,0},{179,118,0},{188,107,0},{200,92,0},{215,66,0},{217,51,52},{214,45,65},{211,46,52},
      {207,47,35},{203,49,11},{194,59,0},{184,68,0},{175,74,0},{166,78,0},{159,80,0},{152,82,0},
      {145,84,0},{139,85,0},{132,85,0},{127,86,0},{121,86,0},{115,86,0},{110,86,0},{104,85,0},
      {99,85,0},{93,85,0},{88,84,0},{82,84,0},{76,83,0},{69,83,0},{62,82,0},{54,82,0},
      {45,82,0},{32,82,0},{8,82,0},{0,79,20},{0,77,32},{0,74,38},{0,72,43},{0,69,46},
      {0,67,48},{0,64,50},{0,62,51},{0,60,52},{0,57,52},{0,55,52},{0,53,52},{0,51,52},
      {0,49,52},{0,46,52},{0,44,51},{0,42,51},{0,40,50},{0,38,50},{0,36,49},{0,34,49},
      {0,31,49},{0,29,48},{0,27,49},{0,24,49},{0,22,50},{1,19,50},{3,17,48},{6,14,45},
      {7,12,42},{8,10,39},{9,8,36},{10,7,33},{10,5,30},{10,4,27},{10,3,23},{9,3,20},
      {9,2,17},{8,2,14},{7,1,11},{6,1,9},{5,1,6},{4,0,5},{4,0,3},{3,0,2},
      {2,0,1},{2,0,1},{1,0,1},{1,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
      {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
      {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{1,1,1},{1,1,1},
      {1,1,1},{1,1,1},{1,1,1},{2,2,2},{2,2,2},{2,2,2},{3,3,3},{3,3,3},
      {3,3,3},{4,4,4},{4,4,4},{5,5,5},{5,5,5},{6,6,6},{7,7,7},{7,7,7},
      {8,8,8},{9,9,9},{10,10,10},{11,11,11},{12,12,12},{12,12,12},{13,13,13},{14,14,14},
      {15,15,15},{16,16,16},{17,17,17},{18,18,18},{19,19,19},{20,20,20},{21,21,21},{22,22,22},
      {23,23,23},{24,24,24},{25,25,25},{26,26,26},{27,27,27},{28,28,28},{29,29,29},{30,30,30},
      {31,31,31},{32,32,32},{33,33,33},{34,34,34},{35,35,35},{36,36,36},{37,37,37},{38,38,38},
      {39,39,39},{40,40,40},{41,41,41},{42,42,42},{43,43,43},{45,45,45},{46,46,46},{47,47,47},
      {48,48,48},{49,49,49},{50,50,50},{51,51,51},{52,52,52},{53,53,53},{54,54,54},{56,56,56},
      {57,57,57},{58,58,58},{59,59,59},{60,60,60},{61,61,61},{62,62,62},{63,63,63},{65,65,65},
      {66,66,66},{67,67,67},{68,68,68},{69,69,69},{70,70,70},{71,71,71},{73,73,73},{74,74,74},
      {75,75,75},{76,76,76},{77,77,77},{78,78,78},{80,80,80},{81,81,81},{82,82,82},{83,83,83},
      {84,84,84},{86,86,86},{87,87,87},{88,88,88},{89,89,89},{90,90,90},{92,92,92},{93,93,93},
      {94,94,94},{95,95,95},{96,96,96},{98,98,98},{99,99,99},{100,100,100},{101,101,101},{103,103,103},
      {104,104,104},{105,105,105},{106,106,106},{108,108,108},{109,109,109},{110,110,110},{111,111,111},{113,113,113},
      {114,114,114},{115,115,115},{116,116,116},{118,118,118},{119,119,119},{120,120,120},{121,121,121},{123,123,123},
      {124,124,124},{125,125,125},{127,127,127},{128,128,128},{129,129,129},{130,130,130},{132,132,132},{133,133,133},
    };

    static void reseed() {
        if (!u || !v || !stress) return;
        for (int y = 0; y < FRAME_H; y++) {
            const float ny = (float)y / (float)FRAME_H;
            for (int x = 0; x < FRAME_W; x++) {
                const int idx = y * FRAME_W + x;
                const float nx = (float)x / (float)FRAME_W;
                const float wave = PFMath::fastSin(ny * 18.84f + nx * 6.28f) * PFMath::fastCos(nx * 12.56f);
                u[idx] = (wave > 0.3f) ? 0.95f : 0.0f;
                v[idx] = (ny > 0.4f && ny < 0.8f) ? 0.4f : 0.0f;
                stress[idx] = 0.0f;
            }
        }
    }

    void setup() {
        PFMath::buildSinLUT();
        if (!u) u = PFMem::allocFloats(NUM_PIXELS);
        if (!v) v = PFMem::allocFloats(NUM_PIXELS);
        if (!uNext) uNext = PFMem::allocFloats(NUM_PIXELS);
        if (!vNext) vNext = PFMem::allocFloats(NUM_PIXELS);
        if (!stress) stress = PFMem::allocFloats(NUM_PIXELS);
        reseed();
    }

    void update(float dt, const InputFrame& input) {
        if (!u || !v || !uNext || !vNext || !stress) return;

        PFParams::apply(input, 0, &knobBreakBifur, 0.04f, 0.059f, 0.0f);
        PFParams::apply(input, 1, &knobTension, 0.8f, 1.3f, 0.01f);
        PFParams::apply(input, 2, &knobStressGain, 0.5f, 2.0f, 0.031f);
        PFParams::apply(input, 3, &knobFractureFade, 0.96f, 0.98f, 0.0f);

        if (input.btnPressed[0] && !input.paramAbsoluteActive[0] && !input.knobAudioActive[0]) {
            reseed();
            return;
        }

        const float b = knobBreakBifur;
        const float tension = knobTension;
        const float fade = knobFractureFade;

        const float a = 0.75f;
        const float eps = 0.02f;
        const float dtSim = 0.32f * tension;
        const float Du = 0.38f;

        for (int y = 0; y < FRAME_H; y++) {
            const int ym1 = (y == 0 ? FRAME_H - 1 : y - 1) * FRAME_W;
            const int y0 = y * FRAME_W;
            const int yp1 = (y == FRAME_H - 1 ? 0 : y + 1) * FRAME_W;

            for (int x = 0; x < FRAME_W; x++) {
                const int xm1 = (x == 0 ? FRAME_W - 1 : x - 1);
                const int xp1 = (x == FRAME_W - 1 ? 0 : x + 1);
                const int idx = y0 + x;

                const float uVal = u[idx];
                const float vVal = v[idx];

                const float lapU = u[y0 + xm1] + u[y0 + xp1] + u[ym1 + x] + u[yp1 + x] - 4.0f * uVal;
                const float f = (uVal * (1.0f - uVal) * (uVal - (vVal + b) / a)) / eps;
                const float g = uVal - vVal;

                const float uN = uVal + dtSim * (f + Du * lapU);
                const float vN = vVal + dtSim * g;

                if (!isfinite(uN) || !isfinite(vN)) {
                    reseed();
                    return;
                }

                uNext[idx] = (uN < 0.0f) ? 0.0f : ((uN > 1.0f) ? 1.0f : uN);
                vNext[idx] = (vN < 0.0f) ? 0.0f : ((vN > 1.0f) ? 1.0f : vN);

                const float dx = (u[y0 + xp1] - u[y0 + xm1]) * 0.5f;
                const float dy = (u[yp1 + x] - u[ym1 + x]) * 0.5f;
                const float gradSq = dx * dx + dy * dy;
                const float localStress = fabsf(lapU) * sqrtf(gradSq) * 12.0f;

                stress[idx] = stress[idx] * fade + localStress * (1.0f - fade);
            }
        }

        memcpy(u, uNext, NUM_PIXELS * sizeof(float));
        memcpy(v, vNext, NUM_PIXELS * sizeof(float));
    }

    void draw() {
        PFCanvas::setFrame(FRAME_W, FRAME_H);

        if (!u || !stress) {
            PFCanvas::present();
            return;
        }

        const float gain = knobStressGain;

        for (int y = 0; y < FRAME_H; y++) {
            const int row = y * FRAME_W;
            for (int x = 0; x < FRAME_W; x++) {
                const int idx = row + x;
                float val = u[idx] * 0.3f + stress[idx] * gain * 0.8f;
                val = (val < 0.0f) ? 0.0f : ((val > 1.0f) ? 1.0f : val);
                const float smoothVal = val * val * (3.0f - 2.0f * val);

                int li = (int)(smoothVal * 255.0f + 0.5f);
                if (li < 0) li = 0;
                if (li > 255) li = 255;

                PFCanvas::setPixel(x, y, RAMP_LUT[li][0], RAMP_LUT[li][1], RAMP_LUT[li][2]);
            }
        }

        PFCanvas::present();
    }

} // namespace Feeling