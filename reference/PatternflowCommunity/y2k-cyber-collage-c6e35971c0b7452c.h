#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_params.h"
#include "src/core_math.h"

namespace Y2KCyberCollage {

    const char* NAME = "Y2K Cyber Collage";
    const char* const KNOB_LABELS[4] = {"StaticGrain", "FlowSpeed", "CheckerScale", "Bounce"};
    constexpr bool ABSOLUTE_READY = true;

    constexpr int FRAME_W = 64;
    constexpr int FRAME_H = 128;

    static float staticGrain  = 0.2f;
    static float flowSpeed    = 2.0f;
    static float checkerScale = 6.0f;
    static float bounce       = 1.5f;

    static float timeAcc   = 0.0f;
    static float wallClock = 0.0f;

    // Fixed star coordinates
    static constexpr int s1x = (int)(FRAME_W * 0.18f); // 11
    static constexpr int s1y = (int)(FRAME_H * 0.16f); // 20
    static constexpr int s2x = (int)(FRAME_W * 0.34f); // 21
    static constexpr int s2y = (int)(FRAME_H * 0.21f); // 26
    static constexpr int s3x = (int)(FRAME_W * 0.74f); // 47
    static constexpr int s3y = (int)(FRAME_H * 0.42f); // 53
    static constexpr int s4x = (int)(FRAME_W * 0.62f); // 39
    static constexpr int s4y = (int)(FRAME_H * 0.76f); // 97
    static constexpr int s5x = (int)(FRAME_W * 0.78f); // 49
    static constexpr int s5y = (int)(FRAME_H * 0.94f); // 120

    // Ribbon constants
    static constexpr float rib1_x  = FRAME_W * 0.58f;
    static constexpr float rib1_y  = FRAME_H * 0.11f;
    static constexpr float rib1_rx = FRAME_W * 0.32f;
    static constexpr float rib1_ry = FRAME_H * 0.034f;
    static constexpr float inv_rib1_rx2 = 1.0f / (rib1_rx * rib1_rx);
    static constexpr float inv_rib1_ry2 = 1.0f / (rib1_ry * rib1_ry);

    static constexpr float rib2_x  = FRAME_W * 0.48f;
    static constexpr float rib2_y  = FRAME_H * 0.35f;
    static constexpr float rib2_rx = FRAME_W * 0.28f;
    static constexpr float rib2_ry = FRAME_H * 0.031f;
    static constexpr float inv_rib2_rx2 = 1.0f / (rib2_rx * rib2_rx);
    static constexpr float inv_rib2_ry2 = 1.0f / (rib2_ry * rib2_ry);

    static constexpr float rib3_x  = FRAME_W * 0.45f;
    static constexpr float rib3_y  = FRAME_H * 0.62f;
    static constexpr float rib3_rx = FRAME_W * 0.30f;
    static constexpr float rib3_ry = FRAME_H * 0.033f;
    static constexpr float inv_rib3_rx2 = 1.0f / (rib3_rx * rib3_rx);
    static constexpr float inv_rib3_ry2 = 1.0f / (rib3_ry * rib3_ry);

    static constexpr float rib4_x  = FRAME_W * 0.52f;
    static constexpr float rib4_y  = FRAME_H * 0.88f;
    static constexpr float rib4_rx = FRAME_W * 0.34f;
    static constexpr float rib4_ry = FRAME_H * 0.034f;
    static constexpr float inv_rib4_rx2 = 1.0f / (rib4_rx * rib4_rx);
    static constexpr float inv_rib4_ry2 = 1.0f / (rib4_ry * rib4_ry);

    void setup() {
        PFMath::buildSinLUT();
    }

    void update(float dt, const InputFrame& input) {
        PFParams::apply(input, 0, &staticGrain,  0.2f, 0.8f, 0.013f);
        PFParams::apply(input, 1, &flowSpeed,    0.1f, 2.0f, 0.040f);
        PFParams::apply(input, 2, &checkerScale, 1.0f, 6.0f, 0.104f);
        PFParams::apply(input, 3, &bounce,       0.0f, 1.5f, 0.031f);

        timeAcc += dt * flowSpeed;
        wallClock += dt;

        constexpr float TIME_PERIOD = 628.3185307f; // 100 * TWO_PI
        if (timeAcc >= TIME_PERIOD) {
            timeAcc -= TIME_PERIOD;
        }
        if (wallClock >= 10000.0f) {
            wallClock -= 10000.0f;
        }
    }

    void draw() {
        PFCanvas::setFrame(FRAME_W, FRAME_H);

        const float t = timeAcc;
        const uint32_t staticThreshUint = (uint32_t)(staticGrain * 4294967296.0f);
        const int cSize = (int)checkerScale < 1 ? 1 : (int)checkerScale;
        const float bounceAmt = bounce;

        const uint32_t staticFrame = (uint32_t)(wallClock * 24.0f);
        const uint32_t staticFrameHash = staticFrame * 1274126177u;

        // Blob dynamics
        const float bounceHeight = (float)FRAME_H * 0.032f * bounceAmt;
        const float bY1 = fabsf(PFMath::fastSin(t * 2.2f)) * bounceHeight;
        const float bY2 = fabsf(PFMath::fastSin(t * 2.2f + 1.2f)) * bounceHeight;
        const float bY3 = fabsf(PFMath::fastSin(t * 2.2f + 2.4f)) * bounceHeight;

        const float stretch1 = 1.0f + PFMath::fastCos(t * 4.4f) * (0.10f * bounceAmt);
        const float squash1  = 1.0f / stretch1;
        const float stretch2 = 1.0f + PFMath::fastCos(t * 4.4f + 2.4f) * (0.10f * bounceAmt);
        const float squash2  = 1.0f / stretch2;
        const float stretch3 = 1.0f + PFMath::fastCos(t * 4.4f + 4.8f) * (0.10f * bounceAmt);
        const float squash3  = 1.0f / stretch3;

        const float blob1_x = (float)FRAME_W * 0.42f;
        const float blob1_y = (float)FRAME_H * 0.22f - bY1;
        const float blob1_r = (float)FRAME_W * 0.36f;
        const float b1_base = blob1_r * 0.68f;

        const float blob2_x = (float)FRAME_W * 0.60f;
        const float blob2_y = (float)FRAME_H * 0.48f - bY2;
        const float blob2_r = (float)FRAME_W * 0.39f;
        const float b2_base = blob2_r * 0.68f;

        const float blob3_x = (float)FRAME_W * 0.38f;
        const float blob3_y = (float)FRAME_H * 0.74f - bY3;
        const float blob3_r = (float)FRAME_W * 0.37f;
        const float b3_base = blob3_r * 0.66f;

        // Blob bounding radii: max reach and guaranteed inner reach
        const float b1_max_reach = b1_base * 1.38f + 1.25f;
        const float b1_max_sq    = b1_max_reach * b1_max_reach;
        const float b1_min_reach = b1_base * 0.62f;
        const float b1_min_sq    = b1_min_reach * b1_min_reach;

        const float b2_max_reach = b2_base * 1.37f + 1.25f;
        const float b2_max_sq    = b2_max_reach * b2_max_reach;
        const float b2_min_reach = b2_base * 0.63f;
        const float b2_min_sq    = b2_min_reach * b2_min_reach;

        const float b3_max_reach = b3_base * 1.37f + 1.25f;
        const float b3_max_sq    = b3_max_reach * b3_max_reach;
        const float b3_min_reach = b3_base * 0.63f;
        const float b3_min_sq    = b3_min_reach * b3_min_reach;

        // Twinkle amplitudes
        const float tw1 = PFMath::fastSin(t * 3.5f + 1.1f) * 0.35f + 0.65f;
        const float tw2 = PFMath::fastSin(t * 3.5f + 2.7f) * 0.35f + 0.65f;
        const float tw3 = PFMath::fastSin(t * 3.5f + 4.3f) * 0.35f + 0.65f;
        const float tw4 = PFMath::fastSin(t * 3.5f + 5.9f) * 0.35f + 0.65f;
        const float tw5 = PFMath::fastSin(t * 3.5f + 7.2f) * 0.35f + 0.65f;

        const int hazardTShift = (int)(t * 3.0f);
        const float t_03 = t * 0.3f;
        const float t_05 = t * 0.5f;

        // Hoisted X tables
        int moshShift[FRAME_W];
        float sinNX[FRAME_W];
        float nx_3[FRAME_W];
        float rib1_dx2[FRAME_W], rib2_dx2[FRAME_W], rib3_dx2[FRAME_W], rib4_dx2[FRAME_W];

        for (int x = 0; x < FRAME_W; ++x) {
            moshShift[x] = (int)(PFMath::fastSin((float)x * 12.3f + t * 4.0f) * 8.0f);
            sinNX[x]     = PFMath::fastSin((float)x * (4.0f / (float)FRAME_W) + t * 0.8f);
            nx_3[x]      = (float)x * (3.0f / (float)FRAME_W);

            const float dx1 = (float)x - rib1_x;
            rib1_dx2[x] = dx1 * dx1 * inv_rib1_rx2;
            const float dx2 = (float)x - rib2_x;
            rib2_dx2[x] = dx2 * dx2 * inv_rib2_rx2;
            const float dx3 = (float)x - rib3_x;
            rib3_dx2[x] = dx3 * dx3 * inv_rib3_rx2;
            const float dx4 = (float)x - rib4_x;
            rib4_dx2[x] = dx4 * dx4 * inv_rib4_rx2;
        }

        // Hoisted Y terms
        float rib1_y_term[FRAME_H], rib2_y_term[FRAME_H], rib3_y_term[FRAME_H], rib4_y_term[FRAME_H];
        for (int y = 0; y < FRAME_H; ++y) {
            const float dy1 = (float)y - rib1_y;
            rib1_y_term[y] = dy1 * dy1 * inv_rib1_ry2;
            const float dy2 = (float)y - rib2_y;
            rib2_y_term[y] = dy2 * dy2 * inv_rib2_ry2;
            const float dy3 = (float)y - rib3_y;
            rib3_y_term[y] = dy3 * dy3 * inv_rib3_ry2;
            const float dy4 = (float)y - rib4_y;
            rib4_y_term[y] = dy4 * dy4 * inv_rib4_ry2;
        }

        for (int y = 0; y < FRAME_H; ++y) {
            const float ny = (float)y / (float)FRAME_H;
            const float cosNY = PFMath::fastCos(ny * 3.5f - t * 0.6f);
            const float row_ny_term = ny * 3.0f + t * 0.4f;

            const bool hazardY = (y > (int)(FRAME_H * 0.84f));
            const bool moshY   = (y < (int)(FRAME_H * 0.30f));

            // Ribbon vertical reach culling
            const float r1_y = rib1_y_term[y];
            const float r2_y = rib2_y_term[y];
            const float r3_y = rib3_y_term[y];
            const float r4_y = rib4_y_term[y];
            const bool canRib1 = (r1_y < 1.14f);
            const bool canRib2 = (r2_y < 1.15f);
            const bool canRib3 = (r3_y < 1.14f);
            const bool canRib4 = (r4_y < 1.14f);
            const bool canAnyRib = canRib1 || canRib2 || canRib3 || canRib4;

            // Blob vertical reach culling
            const float b1_dy  = ((float)y - blob1_y) * stretch1;
            const float b1_dy2 = b1_dy * b1_dy;
            const bool canB1   = (b1_dy2 <= b1_max_sq);

            const float b2_dy  = ((float)y - blob2_y) * stretch2;
            const float b2_dy2 = b2_dy * b2_dy;
            const bool canB2   = (b2_dy2 <= b2_max_sq);

            const float b3_dy  = ((float)y - blob3_y) * stretch3;
            const float b3_dy2 = b3_dy * b3_dy;
            const bool canB3   = (b3_dy2 <= b3_max_sq);

            const bool canAnyBlob = canB1 || canB2 || canB3;

            // Star row culling
            const int dys1 = abs(y - s1y);
            const int dys2 = abs(y - s2y);
            const int dys3 = abs(y - s3y);
            const int dys4 = abs(y - s4y);
            const int dys5 = abs(y - s5y);
            const bool activeStar1 = (dys1 < 4);
            const bool activeStar2 = (dys2 < 4);
            const bool activeStar3 = (dys3 < 4);
            const bool activeStar4 = (dys4 < 4);
            const bool activeStar5 = (dys5 < 4);
            const bool rowHasStar  = activeStar1 || activeStar2 || activeStar3 || activeStar4 || activeStar5;

            const uint32_t yHash = (uint32_t)y * 3812015801u;

            for (int x = 0; x < FRAME_W; ++x) {
                int r = 0, g = 0, b = 0;

                // LAYER 5: Check capsules first (top-level opaque geometric layer)
                if (canAnyRib) {
                    const float r1 = canRib1 ? (rib1_dx2[x] + r1_y) : 2.0f;
                    const float r2 = canRib2 ? (rib2_dx2[x] + r2_y) : 2.0f;
                    const float r3 = canRib3 ? (rib3_dx2[x] + r3_y) : 2.0f;
                    const float r4 = canRib4 ? (rib4_dx2[x] + r4_y) : 2.0f;

                    const bool inRibbon = (r1 < 1.0f || r2 < 1.0f || r3 < 1.0f || r4 < 1.0f);
                    if (inRibbon) {
                        const bool check = (((x / cSize) ^ (y / cSize)) & 1) == 0;
                        if (check) {
                            r = 255; g = 255; b = 255;
                        } else {
                            r = 15;  g = 15;  b = 20;
                        }
                        goto apply_star;
                    }

                    const bool isRibbonEdge = (r1 < 1.14f || r2 < 1.15f || r3 < 1.14f || r4 < 1.14f);
                    if (isRibbonEdge) {
                        r = 15; g = 15; b = 20;
                        goto apply_star;
                    }
                }

                // LAYER 4: Amoeba / Jelly Blobs
                if (canAnyBlob) {
                    bool inBlob = false;
                    bool isBlobEdge = false;

                    // Blob 1 check
                    if (canB1) {
                        const float b1_dx = ((float)x - blob1_x) * squash1;
                        const float dsq1  = b1_dx * b1_dx + b1_dy2;
                        if (dsq1 < b1_min_sq) {
                            inBlob = true;
                        } else if (dsq1 < b1_max_sq) {
                            const float b1_dist  = sqrtf(dsq1);
                            const float b1_ang   = PFMath::fastAtan2(b1_dy, b1_dx);
                            const float b1_limit = b1_base * (1.0f + PFMath::fastSin(b1_ang * 2.0f + t * 0.8f) * 0.18f +
                                                                     PFMath::fastCos(b1_ang * 3.0f - t * 0.6f) * 0.14f +
                                                                     PFMath::fastSin(b1_ang * 5.0f) * 0.06f);
                            if (b1_dist < b1_limit) {
                                inBlob = true;
                            } else if (b1_dist < b1_limit + 1.2f) {
                                isBlobEdge = true;
                            }
                        }
                    }

                    // Blob 2 check (only if not already inside Blob 1)
                    if (!inBlob && canB2) {
                        const float b2_dx = ((float)x - blob2_x) * squash2;
                        const float dsq2  = b2_dx * b2_dx + b2_dy2;
                        if (dsq2 < b2_min_sq) {
                            inBlob = true;
                            isBlobEdge = false;
                        } else if (dsq2 < b2_max_sq) {
                            const float b2_dist  = sqrtf(dsq2);
                            const float b2_ang   = PFMath::fastAtan2(b2_dy, b2_dx);
                            const float b2_limit = b2_base * (1.0f + PFMath::fastCos(b2_ang * 2.0f - t * 0.7f) * 0.20f +
                                                                     PFMath::fastSin(b2_ang * 4.0f + t * 0.5f) * 0.12f +
                                                                     PFMath::fastCos(b2_ang * 5.0f) * 0.05f);
                            if (b2_dist < b2_limit) {
                                inBlob = true;
                                isBlobEdge = false;
                            } else if (b2_dist < b2_limit + 1.2f) {
                                isBlobEdge = true;
                            }
                        }
                    }

                    // Blob 3 check (only if not already inside Blob 1 or 2)
                    if (!inBlob && canB3) {
                        const float b3_dx = ((float)x - blob3_x) * squash3;
                        const float dsq3  = b3_dx * b3_dx + b3_dy2;
                        if (dsq3 < b3_min_sq) {
                            inBlob = true;
                            isBlobEdge = false;
                        } else if (dsq3 < b3_max_sq) {
                            const float b3_dist  = sqrtf(dsq3);
                            const float b3_ang   = PFMath::fastAtan2(b3_dy, b3_dx);
                            const float b3_limit = b3_base * (1.0f + PFMath::fastSin(b3_ang * 3.0f + t * 0.9f) * 0.16f +
                                                                     PFMath::fastCos(b3_ang * 2.0f - t * 0.4f) * 0.15f +
                                                                     PFMath::fastSin(b3_ang * 6.0f) * 0.06f);
                            if (b3_dist < b3_limit) {
                                inBlob = true;
                                isBlobEdge = false;
                            } else if (b3_dist < b3_limit + 1.2f) {
                                isBlobEdge = true;
                            }
                        }
                    }

                    if (isBlobEdge) {
                        r = 15; g = 15; b = 20;
                        goto apply_star;
                    } else if (inBlob) {
                        uint32_t hVal = (uint32_t)x * 1597334677u ^ yHash ^ staticFrameHash;
                        hVal = (hVal ^ (hVal >> 13)) * 1274126177u;
                        const uint32_t noiseVal = (hVal ^ (hVal >> 16));
                        const int val = (noiseVal > staticThreshUint) ? 235 : 20;
                        r = val; g = val; b = val;
                        goto apply_star;
                    }
                }

                // LAYER 3: Data-Mosh Column (top-right)
                if (moshY && x > (int)(FRAME_W * 0.83f)) {
                    const int gy = (y + moshShift[x]) & 7;
                    if (gy < 3) {
                        r = 245; g = 20; b = 150;
                    } else if (gy < 5) {
                        r = 15;  g = 15; b = 20;
                    } else {
                        r = 20;  g = 50; b = 230;
                    }
                    goto apply_star;
                }

                // LAYER 2: Hazard Scanlines (bottom-left)
                if (hazardY && x < (int)(FRAME_W * 0.34f)) {
                    const bool isRed = ((y + hazardTShift) & 1) == 0;
                    if (isRed) {
                        r = 245; g = 20; b = 30;
                    } else {
                        r = 15;  g = 15; b = 20;
                    }
                    goto apply_star;
                }

                // LAYER 1: Thermal Plasma Background (only evaluated when background is visible)
                {
                    const float p1 = sinNX[x] * cosNY;
                    const float p2 = PFMath::fastSin(nx_3[x] + row_ny_term + p1 * 1.5f);

                    r = (int)(180.0f + PFMath::fastSin(p2 * 2.5f + t_03) * 65.0f);
                    g = (int)(20.0f  + PFMath::fastSin(p2 * 3.0f + 1.2f) * 20.0f);
                    b = (int)(160.0f + PFMath::fastCos(p2 * 2.0f - t_05) * 85.0f);

                    if ((x ^ y) & 1) {
                        r = (r + 24 > 255) ? 255 : (r + 24);
                        g = (g + 24 > 255) ? 255 : (g + 24);
                        b = (b + 30 > 255) ? 255 : (b + 30);
                    } else {
                        r = (r * 215) >> 8;
                        g = (g * 215) >> 8;
                        b = (b * 225) >> 8;
                    }
                }

            apply_star:
                // LAYER 6: Sparkle Stars
                if (rowHasStar) {
                    int starBri = 0;

                    if (activeStar1) {
                        const int dxs = abs(x - s1x);
                        if (dxs == 0) starBri = (int)((1.0f - (float)dys1 * 0.25f) * 255.0f * tw1);
                        else if (dys1 == 0 && dxs < 4) starBri = (int)((1.0f - (float)dxs * 0.25f) * 255.0f * tw1);
                        else if (dxs == 1 && dys1 == 1) starBri = (int)(180.0f * tw1);
                    }
                    if (activeStar2) {
                        const int dxs = abs(x - s2x);
                        int bVal = 0;
                        if (dxs == 0) bVal = (int)((1.0f - (float)dys2 * 0.25f) * 255.0f * tw2);
                        else if (dys2 == 0 && dxs < 4) bVal = (int)((1.0f - (float)dxs * 0.25f) * 255.0f * tw2);
                        else if (dxs == 1 && dys2 == 1) bVal = (int)(180.0f * tw2);
                        if (bVal > starBri) starBri = bVal;
                    }
                    if (activeStar3) {
                        const int dxs = abs(x - s3x);
                        int bVal = 0;
                        if (dxs == 0) bVal = (int)((1.0f - (float)dys3 * 0.25f) * 255.0f * tw3);
                        else if (dys3 == 0 && dxs < 4) bVal = (int)((1.0f - (float)dxs * 0.25f) * 255.0f * tw3);
                        else if (dxs == 1 && dys3 == 1) bVal = (int)(180.0f * tw3);
                        if (bVal > starBri) starBri = bVal;
                    }
                    if (activeStar4) {
                        const int dxs = abs(x - s4x);
                        int bVal = 0;
                        if (dxs == 0) bVal = (int)((1.0f - (float)dys4 * 0.25f) * 255.0f * tw4);
                        else if (dys4 == 0 && dxs < 4) bVal = (int)((1.0f - (float)dxs * 0.25f) * 255.0f * tw4);
                        else if (dxs == 1 && dys4 == 1) bVal = (int)(180.0f * tw4);
                        if (bVal > starBri) starBri = bVal;
                    }
                    if (activeStar5) {
                        const int dxs = abs(x - s5x);
                        int bVal = 0;
                        if (dxs == 0) bVal = (int)((1.0f - (float)dys5 * 0.25f) * 255.0f * tw5);
                        else if (dys5 == 0 && dxs < 4) bVal = (int)((1.0f - (float)dxs * 0.25f) * 255.0f * tw5);
                        else if (dxs == 1 && dys5 == 1) bVal = (int)(180.0f * tw5);
                        if (bVal > starBri) starBri = bVal;
                    }

                    if (starBri > 0) {
                        if (starBri > r) r = starBri;
                        if (starBri > g) g = starBri;
                        if (starBri > b) b = starBri;
                    }
                }

                PFCanvas::setPixel(x, y, (uint8_t)r, (uint8_t)g, (uint8_t)b);
            }
        }

        PFCanvas::present();
    }

} // namespace Y2KCyberCollage