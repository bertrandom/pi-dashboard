#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_params.h"
#include "src/core_math.h"
#include "src/core_tables.h"
#include "src/core_mem.h"

namespace BloomingBioluminescence {

    const char* NAME = "Bioluminescence";
    const char* const KNOB_LABELS[4] = {"Cells", "Speed", "Plasma", "Hue"};
    constexpr bool ABSOLUTE_READY = true;

    constexpr int BIO_MAX_CELLS = 10;
    constexpr float BIO_TIME_PERIOD = 200.0f * PI;

    constexpr int EXP_LUT_SIZE = 2048;
    constexpr float EXP_LUT_MAX = 16.0f;
    constexpr float EXP_LUT_SCALE = (float)(EXP_LUT_SIZE - 1) / EXP_LUT_MAX;

    constexpr int PAL_LUT_SIZE = 1024;
    constexpr int PAL_LUT_MASK = PAL_LUT_SIZE - 1;

    const float ORBIT_A[BIO_MAX_CELLS]  = {1.30f, 0.71f, 1.13f, 0.92f, 1.47f, 0.63f, 1.21f, 0.84f, 1.38f, 1.05f};
    const float ORBIT_B[BIO_MAX_CELLS]  = {0.94f, 1.23f, 0.81f, 1.41f, 0.73f, 1.32f, 1.02f, 1.51f, 0.62f, 1.17f};
    const float ORBIT_PH[BIO_MAX_CELLS] = {0.00f, 0.63f, 1.26f, 1.89f, 2.51f, 3.14f, 3.77f, 4.40f, 5.03f, 5.65f};
    const float ORBIT_R[BIO_MAX_CELLS]  = {0.52f, 0.47f, 0.60f, 0.41f, 0.56f, 0.50f, 0.44f, 0.58f, 0.49f, 0.55f};

    static float numCellsParam = 2.0f;
    static float speedParam = 2.0f;
    static float plasmaParam = 3.0f;
    static float hueParam = 1.0f;

    static float timeAcc = 0.0f;

    static float* exp_lut   = nullptr;
    static float* pal_r     = nullptr;
    static float* pal_g     = nullptr;
    static float* pal_b     = nullptr;
    static float* lut_nx    = nullptr;
    static float* lut_ny    = nullptr;
    static float* dx2_table = nullptr;

    static inline float fastExpNeg(float x) {
        if (x <= 0.0f) return 1.0f;
        int idx = (int)(x * EXP_LUT_SCALE);
        if (idx >= EXP_LUT_SIZE) return 0.0f;
        return exp_lut[idx];
    }

    void setup() {
        PFMath::buildSinLUT();
        PFTables::init();

        if (!exp_lut)   exp_lut   = PFMem::allocFloats(EXP_LUT_SIZE);
        if (!pal_r)     pal_r     = PFMem::allocFloats(PAL_LUT_SIZE);
        if (!pal_g)     pal_g     = PFMem::allocFloats(PAL_LUT_SIZE);
        if (!pal_b)     pal_b     = PFMem::allocFloats(PAL_LUT_SIZE);
        if (!lut_nx)    lut_nx    = PFMem::allocFloats(PANEL_RES_W);
        if (!lut_ny)    lut_ny    = PFMem::allocFloats(PANEL_RES_H);
        if (!dx2_table) dx2_table = PFMem::allocFloats(BIO_MAX_CELLS * PANEL_RES_W);

        if (exp_lut) {
            for (int i = 0; i < EXP_LUT_SIZE; i++) {
                exp_lut[i] = expf(-(float)i / EXP_LUT_SCALE);
            }
        }

        if (pal_r && pal_g && pal_b) {
            for (int i = 0; i < PAL_LUT_SIZE; i++) {
                float frac = (float)i / (float)PAL_LUT_SIZE;
                pal_r[i] = 0.5f + 0.5f * PFMath::fastCos(TWO_PI * frac);
                pal_g[i] = 0.5f + 0.5f * PFMath::fastCos(TWO_PI * (frac * 1.10f + 0.33f));
                pal_b[i] = 0.5f + 0.5f * PFMath::fastCos(TWO_PI * (frac * 0.90f + 0.67f));
            }
        }

        const float w = (float)PANEL_RES_W;
        const float h = (float)PANEL_RES_H;
        const float aspect = w / (h > 1.0f ? h : 1.0f);

        if (lut_nx) {
            for (int x = 0; x < PANEL_RES_W; x++) {
                lut_nx[x] = ((float)x / w - 0.5f) * 2.0f * aspect;
            }
        }

        if (lut_ny) {
            for (int y = 0; y < PANEL_RES_H; y++) {
                lut_ny[y] = ((float)y / h - 0.5f) * 2.0f;
            }
        }
    }

    void update(float dt, const InputFrame& input) {
        PFParams::apply(input, 0, &numCellsParam, 2.0f, 10.0f, 0.167f);
        PFParams::apply(input, 1, &speedParam, 0.1f, 3.0f, 0.06f);
        PFParams::apply(input, 2, &plasmaParam, 0.0f, 3.0f, 0.063f);
        PFParams::applyUnit(input, 3, &hueParam, 0.021f);

        timeAcc += dt * speedParam;
        if (timeAcc > BIO_TIME_PERIOD) {
            timeAcc -= BIO_TIME_PERIOD;
        }
    }

    void draw() {
        if (!exp_lut || !pal_r || !pal_g || !pal_b || !lut_nx || !lut_ny || !dx2_table) {
            PFCanvas::present();
            return;
        }

        const float w = (float)PANEL_RES_W;
        const float h = (float)PANEL_RES_H;
        const float aspect = w / (h > 1.0f ? h : 1.0f);
        const float t = timeAcc;
        const int n = (int)(numCellsParam + 0.5f);
        const float plasmaStr = plasmaParam;
        const float baseHue = hueParam;

        float cx[BIO_MAX_CELLS];
        float cy[BIO_MAX_CELLS];
        float pulse_sq[BIO_MAX_CELLS];

        for (int i = 0; i < n; i++) {
            const float ph = ORBIT_PH[i];
            cx[i] = PFMath::fastSin(t * ORBIT_A[i] + ph) * ORBIT_R[i] * aspect;
            cy[i] = PFMath::fastCos(t * ORBIT_B[i] + ph + 1.0f) * ORBIT_R[i];
            const float p = 0.88f + 0.12f * PFMath::fastSin(t * 2.1f + ph * 3.7f);
            pulse_sq[i] = p * p;

            float* dx2_cell = &dx2_table[i * PANEL_RES_W];
            const float cxi = cx[i];
            for (int x = 0; x < PANEL_RES_W; x++) {
                const float dx = lut_nx[x] - cxi;
                dx2_cell[x] = dx * dx;
            }
        }

        const float invN = 1.0f / (float)(n > 1 ? n : 1);
        const float t_plasma1 = t * 1.3f;
        const float t_plasma2 = -t * 1.0f;
        const float t_plasma3 = t * 0.8f;
        const float t_plasma4 = -t * 1.7f;
        const float t_bg1 = t * 0.2f;
        const float t_bg2 = -t * 0.15f;
        const float t_hue = t * 0.03f;
        const bool hasPlasma = (plasmaStr > 0.01f);
        const float plasmaScale = 0.04f * plasmaStr;

        float sin_plasma_x[PANEL_RES_W];
        float nx_5_lut[PANEL_RES_W];
        float sin_bg_x[PANEL_RES_W];

        for (int x = 0; x < PANEL_RES_W; x++) {
            const float nx = lut_nx[x];
            sin_plasma_x[x] = PFMath::fastSin(nx * 7.0f + t_plasma1);
            nx_5_lut[x] = nx * 5.0f + t_plasma3;
            sin_bg_x[x] = PFMath::fastSin(nx * 12.0f + t_bg1);
        }

        for (int y = 0; y < PANEL_RES_H; y++) {
            const float ny = lut_ny[y];
            const float sin_ny_plasma = PFMath::fastSin(ny * 6.0f + t_plasma2);
            const float ny_5 = ny * 5.0f;
            const float cos_bg_y = PFMath::fastCos(ny * 11.0f + t_bg2);
            const float bg_scale_y = cos_bg_y * 0.015f;
            const int y_offset = y * PANEL_RES_W;

            float dy2[BIO_MAX_CELLS];
            for (int i = 0; i < n; i++) {
                const float dy = ny - cy[i];
                dy2[i] = dy * dy;
            }

            for (int x = 0; x < PANEL_RES_W; x++) {
                const int idx = y_offset + x;

                float f1_sq = 1e18f;
                float f2_sq = 1e18f;
                int f1i = 0;

                for (int i = 0; i < n; i++) {
                    const float d_sq = (dx2_table[i * PANEL_RES_W + x] + dy2[i]) * pulse_sq[i];
                    if (d_sq < f1_sq) {
                        f2_sq = f1_sq;
                        f1_sq = d_sq;
                        f1i = i;
                    } else if (d_sq < f2_sq) {
                        f2_sq = d_sq;
                    }
                }

                const float f1 = sqrtf(f1_sq);
                const float f2 = sqrtf(f2_sq);
                const float border = f2 - f1;

                float plasma = 0.0f;
                if (hasPlasma) {
                    const float r18 = 18.0f * PFTables::rT[idx];
                    plasma = (sin_plasma_x[x]
                            + sin_ny_plasma
                            + PFMath::fastSin(nx_5_lut[x] + ny_5)
                            + PFMath::fastSin(r18 + t_plasma4)) * plasmaScale;
                }

                const float dc = f1 + plasma;

                const float cellHue = PFMath::fract(baseHue + ((float)f1i * invN) + border * 0.3f + plasma * 0.12f + t_hue);
                const int pal_idx = (int)(cellHue * (float)PAL_LUT_SIZE) & PAL_LUT_MASK;

                const float colR = pal_r[pal_idx];
                const float colG = pal_g[pal_idx];
                const float colB = pal_b[pal_idx];

                const float glow = fastExpNeg(dc * 4.0f);
                const float core = fastExpNeg(dc * 14.0f);
                const float rim  = fastExpNeg(border * 9.0f) * 0.7f;

                const float bg = sin_bg_x[x] * bg_scale_y + 0.015f;

                float brightness = glow * 1.1f + rim;
                if (brightness > 1.0f) brightness = 1.0f;

                float invSat = core * 0.85f;
                if (invSat > 0.85f) invSat = 0.85f;

                const float bright_sat = brightness * (1.0f - invSat);
                const float bright_invSat_bg = brightness * invSat + bg;

                const int r_out = (int)((colR * bright_sat + bright_invSat_bg) * 255.0f);
                const int g_out = (int)((colG * bright_sat + bright_invSat_bg) * 255.0f);
                const int b_out = (int)((colB * bright_sat + bright_invSat_bg) * 255.0f);

                const uint8_t r8 = (uint8_t)(r_out > 255 ? 255 : (r_out < 0 ? 0 : r_out));
                const uint8_t g8 = (uint8_t)(g_out > 255 ? 255 : (g_out < 0 ? 0 : g_out));
                const uint8_t b8 = (uint8_t)(b_out > 255 ? 255 : (b_out < 0 ? 0 : b_out));

                PFCanvas::setPixel(x, y, r8, g8, b8);
            }
        }

        PFCanvas::present();
    }

} // namespace BloomingBioluminescence