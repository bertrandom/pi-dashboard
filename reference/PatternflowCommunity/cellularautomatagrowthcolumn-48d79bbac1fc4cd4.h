#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_mem.h"

namespace CellularAutomataGrowthColumn {

    const char* NAME = "Growth Column";
    const char* const KNOB_LABELS[4] = {"Rule", "Speed", "Trail", "Density"};

    constexpr int FRAME_W = 64;
    constexpr int FRAME_H = 128;

    // Knob parameters & calibration steps
    // RuleSet: min 1, max 5, current 2.004, step 0.05
    // Speed: min 0.5, max 5, current 5, step 0.1
    // TrailLen: min 0, max 10, current 0.896, step 0.05
    // Density: min 0, max 6, current 3.14, step 0.05
    static float ruleSetParam = 2.004f;
    static float speedParam = 5.0f;
    static float trailLenParam = 0.896f;
    static float densityParam = 3.14f;

    static float* grid = nullptr;
    static float timer = 0.0f;

    static const uint8_t RULES[8] = {30, 90, 110, 150, 182, 22, 126, 54};

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
      {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
      {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
      {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
      {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
      {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
      {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
      {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
      {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
    };

    void setup() {
        if (!grid) {
            grid = PFMem::allocFloats(FRAME_W * FRAME_H);
        }
        if (grid) {
            memset(grid, 0, FRAME_W * FRAME_H * sizeof(float));
            grid[32] = 1.0f; // Seed at row 0, x = 32
        }
        timer = 0.0f;
    }

    void update(float dt, const InputFrame& input) {
        ruleSetParam += input.knobDeltas[0] * 0.05f;
        ruleSetParam = fminf(fmaxf(ruleSetParam, 1.0f), 5.0f);

        speedParam += input.knobDeltas[1] * 0.1f;
        speedParam = fminf(fmaxf(speedParam, 0.5f), 5.0f);

        trailLenParam += input.knobDeltas[2] * 0.05f;
        trailLenParam = fminf(fmaxf(trailLenParam, 0.0f), 10.0f);

        densityParam += input.knobDeltas[3] * 0.05f;
        densityParam = fminf(fmaxf(densityParam, 0.0f), 6.0f);

        if (!grid) return;

        int ruleIdx = ((int)floorf(ruleSetParam)) - 1;
        if (ruleIdx < 0) ruleIdx = 0;
        if (ruleIdx > 7) ruleIdx = 7;
        uint8_t ruleNum = RULES[ruleIdx];

        timer += dt * speedParam * 20.0f;

        while (timer >= 1.0f) {
            timer -= 1.0f;

            // Scroll rows down
            for (int y = FRAME_H - 1; y > 0; y--) {
                for (int x = 0; x < FRAME_W; x++) {
                    grid[y * FRAME_W + x] = grid[(y - 1) * FRAME_W + x];
                }
            }

            // Compute new generation at row 0 from row 1
            float* prevRow = &grid[1 * FRAME_W];
            float* newRow = &grid[0 * FRAME_W];

            for (int x = 0; x < FRAME_W; x++) {
                int left = prevRow[(x - 1 + FRAME_W) % FRAME_W] > 0.5f ? 1 : 0;
                int center = prevRow[x] > 0.5f ? 1 : 0;
                int right = prevRow[(x + 1) % FRAME_W] > 0.5f ? 1 : 0;

                int neighborhood = (left << 2) | (center << 1) | right;
                float state = (ruleNum & (1 << neighborhood)) ? 1.0f : 0.0f;
                newRow[x] = state;
            }

            // Inject random noise based on density
            float rndVal = (float)rand() / (float)RAND_MAX;
            if (rndVal < (densityParam * 0.03f)) {
                int injectX = rand() % FRAME_W;
                newRow[injectX] = 1.0f;
            }
        }
    }

    void draw() {
        PFCanvas::setFrame(FRAME_W, FRAME_H);

        if (!grid) {
            PFCanvas::present();
            return;
        }

        float trail = trailLenParam / 10.0f;

        for (int y = 0; y < FRAME_H; y++) {
            for (int x = 0; x < FRAME_W; x++) {
                float val = grid[y * FRAME_W + x];

                if (val == 0.0f && y > 0) {
                    val = grid[(y - 1) * FRAME_W + x] * trail;
                }

                val = fminf(fmaxf(val, 0.0f), 1.0f);

                int li = (int)(val * 255.0f + 0.5f);
                if (li < 0) li = 0;
                if (li > 255) li = 255;

                PFCanvas::setPixel(x, y, RAMP_LUT[li][0], RAMP_LUT[li][1], RAMP_LUT[li][2]);
            }
        }

        PFCanvas::present();
    }

} // namespace CellularAutomataGrowthColumn