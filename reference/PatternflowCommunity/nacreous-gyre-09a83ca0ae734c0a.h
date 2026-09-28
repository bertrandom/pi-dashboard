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

namespace NacreousGyre {

    const char* NAME = "Nacreous Gyre";
    const char* const KNOB_LABELS[4] = {"Swirl", "FlowSpeed", "Filaments", "Grain"};
    constexpr bool ABSOLUTE_READY = true;

    constexpr int FRAME_W = 64;
    constexpr int FRAME_H = 128;
    constexpr int PIXEL_COUNT = FRAME_W * FRAME_H;

    static float swirl     = 1.0f;
    static float flowSpeed = 2.0f;
    static float filaments = 5.0f;
    static float grain     = 2.0f;

    static float timeAcc = 0.0f;

    // Bayer 4x4 dither matrix normalized to 0..1
    static const float BAYER4_F[16] = {
         0.0f / 16.0f,  8.0f / 16.0f,  2.0f / 16.0f, 10.0f / 16.0f,
        12.0f / 16.0f,  4.0f / 16.0f, 14.0f / 16.0f,  6.0f / 16.0f,
         3.0f / 16.0f, 11.0f / 16.0f,  1.0f / 16.0f,  9.0f / 16.0f,
        15.0f / 16.0f,  7.0f / 16.0f, 13.0f / 16.0f,  5.0f / 16.0f
    };

    // Precomputed 1D coordinate tables
    static float dxTable[FRAME_W];
    static float dx35Table[FRAME_W];
    static float dx45Table[FRAME_W];

    static float dyTable[FRAME_H];
    static float dy35Table[FRAME_H];
    static float dy45Table[FRAME_H];

    // Precomputed 2D geometry buffer (PSRAM-first: theta, r, invR)
    struct PixelGeom {
        float theta;
        float r;
        float invR;
    };
    static float* geomBuffer = nullptr;

    // Precomputed eye core sub-grid (centered near x=43.52, y=64)
    static constexpr int EYE_MIN_X = 29;
    static constexpr int EYE_MAX_X = 58;
    static constexpr int EYE_MIN_Y = 39;
    static constexpr int EYE_MAX_Y = 89;
    static constexpr int EYE_GRID_W = EYE_MAX_X - EYE_MIN_X + 1; // 30
    static constexpr int EYE_GRID_H = EYE_MAX_Y - EYE_MIN_Y + 1; // 51
    static float eyeCoreLUT[EYE_GRID_H][EYE_GRID_W];

    // Precomputed palettes & LUTs
    static float pow14_LUT[256];
    static uint8_t specR[256];
    static uint8_t specG[256];
    static uint8_t specB[256];
    static float invInkR[256];
    static float invInkG[256];
    static float invInkB[256];

    void setup() {
        PFMath::buildSinLUT();
        PFColor::buildPowLUTf(1.4f, pow14_LUT);

        const float eyeX = (float)FRAME_W * 0.68f;
        const float eyeY = (float)FRAME_H * 0.50f;
        const float invW045 = 1.0f / ((float)FRAME_W * 0.45f);
        const float invH045 = 1.0f / ((float)FRAME_H * 0.45f);

        for (int x = 0; x < FRAME_W; ++x) {
            const float dx = ((float)x - eyeX) * invW045;
            dxTable[x]   = dx;
            dx35Table[x] = dx * 3.5f;
            dx45Table[x] = dx * 4.5f;
        }

        for (int y = 0; y < FRAME_H; ++y) {
            const float dy = ((float)y - eyeY) * invH045;
            dyTable[y]   = dy;
            dy35Table[y] = dy * 3.5f;
            dy45Table[y] = dy * 4.5f;
        }

        // Allocate per-pixel static geometry: 3 floats per pixel
        if (!geomBuffer) {
            geomBuffer = PFMem::allocFloats(PIXEL_COUNT * 3);
        }

        if (geomBuffer) {
            PixelGeom* geom = reinterpret_cast<PixelGeom*>(geomBuffer);
            int idx = 0;
            for (int y = 0; y < FRAME_H; ++y) {
                const float dy = dyTable[y];
                const float dy2 = dy * dy;
                for (int x = 0; x < FRAME_W; ++x) {
                    const float dx = dxTable[x];
                    const float r = sqrtf(dx * dx + dy2);
                    geom[idx].theta = PFMath::fastAtan2(dy, dx);
                    geom[idx].r     = r;
                    geom[idx].invR  = 1.0f / (r + 0.35f);
                    idx++;
                }
            }
        }

        // Precompute eyeCore in its active bounding box
        for (int y = EYE_MIN_Y; y <= EYE_MAX_Y; ++y) {
            const float dy = dyTable[y];
            const float dy2_term = dy * dy * 0.9f;
            for (int x = EYE_MIN_X; x <= EYE_MAX_X; ++x) {
                const float dx = dxTable[x];
                const float u = (dx * dx * 1.3f + dy2_term) * 12.755102f; // 1 / (0.28^2)
                const float u2 = u * u;
                float core = 0.0f;
                if (u2 < 6.0f) {
                    core = expf(-u2);
                }
                eyeCoreLUT[y - EYE_MIN_Y][x - EYE_MIN_X] = core;
            }
        }

        // Precompute iridescent spectral color palette & coverage terms
        for (int i = 0; i < 256; ++i) {
            const float spec = (float)i * (1.0f / 255.0f);
            int r = 0, g = 0, b = 0;

            if (spec < 0.20f) {
                const float f = spec * 5.0f;
                r = 255;
                g = (int)(165.0f - f * 90.0f);
                b = (int)(20.0f + f * 25.0f);
            } else if (spec < 0.45f) {
                const float f = (spec - 0.20f) * 4.0f;
                r = (int)(245.0f - f * 125.0f);
                g = (int)(30.0f + f * 15.0f);
                b = (int)(160.0f + f * 75.0f);
            } else if (spec < 0.68f) {
                const float f = (spec - 0.45f) * (1.0f / 0.23f);
                r = (int)(30.0f + f * 10.0f);
                g = (int)(70.0f + f * 135.0f);
                b = (int)(235.0f + f * 20.0f);
            } else if (spec < 0.88f) {
                const float f = (spec - 0.68f) * 5.0f;
                r = (int)(40.0f + f * 130.0f);
                g = (int)(205.0f + f * 35.0f);
                b = (int)(245.0f - f * 195.0f);
            } else {
                const float f = (spec - 0.88f) * (1.0f / 0.12f);
                r = (int)(170.0f + f * 85.0f);
                g = (int)(240.0f - f * 75.0f);
                b = (int)(50.0f - f * 30.0f);
            }

            specR[i] = (uint8_t)fmaxf(0.0f, fminf(255.0f, (float)r));
            specG[i] = (uint8_t)fmaxf(0.0f, fminf(255.0f, (float)g));
            specB[i] = (uint8_t)fmaxf(0.0f, fminf(255.0f, (float)b));

            invInkR[i] = 1.0f - ((float)specR[i] * (1.0f / 255.0f));
            invInkG[i] = 1.0f - ((float)specG[i] * (1.0f / 255.0f));
            invInkB[i] = 1.0f - ((float)specB[i] * (1.0f / 255.0f));
        }
    }

    void update(float dt, const InputFrame& input) {
        if (!geomBuffer) return;

        PFParams::apply(input, 0, &swirl,     1.0f,  5.0f, 0.083f);
        PFParams::apply(input, 1, &flowSpeed, 0.05f, 5.0f, 0.103f);
        PFParams::apply(input, 2, &filaments, 1.0f,  5.0f, 0.083f);
        PFParams::apply(input, 3, &grain,     0.5f,  2.0f, 0.031f);

        timeAcc += dt * flowSpeed * 0.35f;

        constexpr float TIME_PERIOD = 1256.6370614f; // 200 * TWO_PI
        if (timeAcc >= TIME_PERIOD) {
            timeAcc -= TIME_PERIOD;
        }
    }

    void draw() {
        PFCanvas::setFrame(FRAME_W, FRAME_H);

        if (!geomBuffer) {
            PFCanvas::present();
            return;
        }

        const PixelGeom* geom = reinterpret_cast<const PixelGeom*>(geomBuffer);

        const float t = timeAcc;
        const float swirlTightness = swirl;
        const float filFreq = filaments;
        const float grainContrast = grain;

        const float filFreq4  = 4.0f * filFreq;
        const float filFreq7  = 7.0f * filFreq;
        const float filFreq25 = 2.5f * filFreq;

        const float t_swirl = -t * 0.3f;
        const float t_04    =  t * 0.4f;
        const float t_03    = -t * 0.3f;
        const float t_02    =  t * 0.2f;
        const float t_015   = -t * 0.15f;
        const float t_008   =  t * 0.08f;

        // Hoist x-dependent trig terms once per frame
        float cos_dx[FRAME_W];
        for (int x = 0; x < FRAME_W; ++x) {
            cos_dx[x] = PFMath::fastCos(dx45Table[x] + t_03) * 1.8f;
        }

        constexpr uint8_t paperR = 252, paperG = 250, paperB = 254;
        int pixelIdx = 0;

        float p1_row[FRAME_W];
        float p2_row[FRAME_W];

        for (int y = 0; y < FRAME_H; ++y) {
            const float dy35 = dy35Table[y];
            const float sin_dy_val = PFMath::fastSin(dy45Table[y] + t_04) * 1.8f;

            // Precompute p1 and p2 for the entire row (hoisted from inner pixel loop)
            for (int x = 0; x < FRAME_W; ++x) {
                p1_row[x] = PFMath::fastSin(dx35Table[x] + sin_dy_val) * 1.2f;
                p2_row[x] = PFMath::fastCos(dy35 + cos_dx[x]) * 1.5f;
            }

            // Bayer matrix offsets for row
            const int y_bayerR = (y & 3) * 4;
            const int y_bayerG = ((y + 1) & 3) * 4;
            const int y_bayerB = ((y + 2) & 3) * 4;

            float ditherR_row[4], ditherG_row[4], ditherB_row[4];
            for (int k = 0; k < 4; ++k) {
                ditherR_row[k] = BAYER4_F[y_bayerR + k];
                ditherG_row[k] = BAYER4_F[y_bayerG + ((k + 2) & 3)];
                ditherB_row[k] = BAYER4_F[y_bayerB + ((k + 1) & 3)];
            }

            const bool yInEye = (y >= EYE_MIN_Y && y <= EYE_MAX_Y);
            const int eyeRowIdx = y - EYE_MIN_Y;
            const float dyVal = dyTable[y];

            for (int x = 0; x < FRAME_W; ++x) {
                const PixelGeom& g = geom[pixelIdx++];

                const float swirlTheta = g.theta + (swirlTightness * g.invR) + t_swirl;

                const float wisp1 = PFMath::fastSin(swirlTheta * 3.0f + g.r * filFreq4 + p1_row[x] + t_02);
                const float wisp2 = PFMath::fastCos(swirlTheta * 5.0f - g.r * filFreq7 + p2_row[x] + t_015);
                const float wisp3 = PFMath::fastSin((dxTable[x] + dyVal) * filFreq25 + wisp1 * 1.4f);

                const float flow = (wisp1 * 0.5f + wisp2 * 0.35f + wisp3 * 0.25f);

                // Vortex eye core lookup (instant O(1) table, 0.0 outside bounds)
                float eyeCore = 0.0f;
                if (yInEye && x >= EYE_MIN_X && x <= EYE_MAX_X) {
                    eyeCore = eyeCoreLUT[eyeRowIdx][x - EYE_MIN_X];
                }

                // Spectral color index lookup
                const float spec = PFMath::fract(swirlTheta * 0.45f + flow * 0.38f + g.r * 0.55f + t_008);
                int specIdx = (int)(spec * 255.0f);
                if (specIdx > 255) specIdx = 255;
                else if (specIdx < 0) specIdx = 0;

                const uint8_t rInk = specR[specIdx];
                const uint8_t gInk = specG[specIdx];
                const uint8_t bInk = specB[specIdx];

                // Ridge & density calculation via pow14_LUT
                const float ridge = 1.0f - fabsf(flow);
                const int ridgeIdx = (int)(ridge * 255.0f);
                const int rClamped = (ridgeIdx < 0) ? 0 : ((ridgeIdx > 255) ? 255 : ridgeIdx);
                const float density = pow14_LUT[rClamped] * (1.0f - eyeCore);

                // Bayer dither thresholds
                const int mod4 = x & 3;
                const float ditherR = ditherR_row[mod4];
                const float ditherG = ditherG_row[mod4];
                const float ditherB = ditherB_row[mod4];

                const float dGC = density * grainContrast;
                const float covR = invInkR[specIdx] * dGC;
                const float covG = invInkG[specIdx] * dGC;
                const float covB = invInkB[specIdx] * dGC;

                uint8_t finalR = (covR < ditherR) ? paperR : rInk;
                uint8_t finalG = (covG < ditherG) ? paperG : gInk;
                uint8_t finalB = (covB < ditherB) ? paperB : bInk;

                // Center eye luminous white glow
                if (eyeCore > 0.05f) {
                    const float glow = fminf(1.0f, eyeCore * 1.5f);
                    const float oneMinusGlow = 1.0f - glow;
                    finalR = (uint8_t)((float)finalR * oneMinusGlow + 255.0f * glow);
                    finalG = (uint8_t)((float)finalG * oneMinusGlow + 255.0f * glow);
                    finalB = (uint8_t)((float)finalB * oneMinusGlow + 255.0f * glow);
                }

                PFCanvas::setPixel(x, y, finalR, finalG, finalB);
            }
        }

        PFCanvas::present();
    }

} // namespace NacreousGyre