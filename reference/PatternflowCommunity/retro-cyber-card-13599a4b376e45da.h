#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_params.h"
#include "src/core_math.h"
#include "src/core_noise.h"

namespace RetroCyberCard {

    const char* NAME = "Retro Cyber Card";
    const char* const KNOB_LABELS[4] = {"MotifSpeed", "ScrollSpeed", "GlitchChaos", "ColorShift"};
    constexpr bool ABSOLUTE_READY = true;

    constexpr int FRAME_W = 64;
    constexpr int FRAME_H = 128;

    // Knob parameters & state
    static float motifSpeed = 0.2f;
    static float scrollSpeed = 2.0f;
    static float glitchChaos = 1.0f;
    static float colorShift = 1.0f;

    // Animated time accumulator
    static float timeAcc = 0.0f;

    // Fixed Frame Dimensions & Dividers
    static constexpr int cardX0 = 10; // max(4, floor(64 * 0.16)) = 10
    static constexpr int cardX1 = 54; // 64 - 10 = 54
    static constexpr int cardY0 = 12; // max(4, floor(128 * 0.10)) = 12
    static constexpr int cardY1 = 116; // 128 - 12 = 116

    static constexpr int cardW = cardX1 - cardX0; // 44
    static constexpr int cardH = cardY1 - cardY0; // 104
    static constexpr int cx = FRAME_W / 2; // 32
    static constexpr int cy = FRAME_H / 2; // 64

    // Badge Dimensions (emblemScale = 1.4)
    // badgeHW = floor(44 * 0.14 * 1.4) = floor(8.624) = 8
    // badgeHH = floor(104 * 0.08 * 1.4) = floor(11.648) = 11
    static constexpr int badgeHW = 8;
    static constexpr int badgeHH = 11;

    // Tier Horizontal Dividing Rows
    // yRow1 = 12 + floor(104 * 0.19) = 12 + 19 = 31
    // yRow2 = 12 + floor(104 * 0.36) = 12 + 37 = 49
    // yRow3 = 12 + floor(104 * 0.64) = 12 + 66 = 78
    // yRow4 = 12 + floor(104 * 0.82) = 12 + 85 = 97
    static constexpr int yRow1 = 31;
    static constexpr int yRow2 = 49;
    static constexpr int yRow3 = 78;
    static constexpr int yRow4 = 97;

    // Tier Vertical Dividing Columns
    // xCol1 = 10 + floor(44 * 0.28) = 10 + 12 = 22
    // xCol2 = 10 + floor(44 * 0.50) = 10 + 22 = 32
    // xCol3 = 10 + floor(44 * 0.72) = 10 + 31 = 41
    static constexpr int xCol1 = 22;
    static constexpr int xCol2 = 32;
    static constexpr int xCol3 = 41;

    // Precomputed helper coordinates
    static constexpr float boxCenterY_top = (cardY0 + yRow1) * 0.5f; // 21.5f
    static constexpr float boxCenterY_bottom = (yRow4 + cardY1) * 0.5f; // 106.5f

    // RGB Base Palette
    static constexpr uint8_t rGreen = 16,  gGreen = 245, bGreen = 90;
    static constexpr uint8_t rPurp  = 185, gPurp  = 25,  bPurp  = 230;
    static constexpr uint8_t rPlum  = 65,  gPlum  = 10,  bPlum  = 48;
    static constexpr uint8_t rMint  = 35,  gMint  = 235, bMint  = 195;
    static constexpr uint8_t rDark  = 15,  gDark  = 15,  bDark  = 20;

    void setup() {
        PFMath::buildSinLUT();
    }

    void update(float dt, const InputFrame& input) {
        PFParams::apply(input, 0, &motifSpeed, 0.2f, 2.0f, 0.038f);
        PFParams::apply(input, 1, &scrollSpeed, 0.2f, 3.0f, 0.058f);
        PFParams::apply(input, 2, &glitchChaos, 0.0f, 1.0f, 0.021f);
        PFParams::apply(input, 3, &colorShift, 0.0f, 1.0f, 0.021f);

        timeAcc += dt * scrollSpeed;
        // All scroll modulos (3, 4, 5) and sin period wrap cleanly at lcm(3, 4, 5) * 2pi = 120 * pi
        constexpr float TIME_PERIOD = 376.9911184f; // 120 * PI
        if (timeAcc >= TIME_PERIOD) {
            timeAcc -= TIME_PERIOD;
        }
    }

    inline bool evaluateMotif(int mId, int px, int py, float t, bool isLeft, int tier, float chaos) {
        switch (mId) {
            case 0: {
                const float refX = isLeft ? (float)xCol1 : (float)xCol3;
                const float refY = (tier < 2) ? boxCenterY_top : boxCenterY_bottom;
                const float boxDist = fmaxf(fabsf((float)px - refX), fabsf((float)py - refY));
                return PFMath::jsMod(boxDist - t * 2.0f, 3.0f) < 1.5f;
            }
            case 1: {
                return PFMath::jsMod((float)(px + py) + t * 2.5f, 4.0f) < 2.0f;
            }
            case 2: {
                return PFMath::jsMod((float)(px - py) + t * 2.5f, 4.0f) < 2.0f;
            }
            case 3: {
                const float vDist = fabsf((float)(px - cx));
                return PFMath::jsMod(vDist * 1.4f + (float)py + t * 2.5f, 5.0f) < 2.5f;
            }
            case 4: {
                return PFMath::jsMod((float)py + t * 2.0f, 3.0f) < 1.5f;
            }
            case 5: {
                return (((px / 2) ^ (py / 2)) & 1) == 0;
            }
            case 6: {
                if (chaos < 0.05f) return false;
                const int seed = (int)(t * 1.2f);
                return PFNoise::cellHash(px / 2, py / 2, seed) > 0.5f;
            }
        }
        return false;
    }

    void draw() {
        PFCanvas::setFrame(FRAME_W, FRAME_H);

        const float t = timeAcc;
        const float cycleSpd = motifSpeed;
        const float chaos = glitchChaos;
        const float cShift = colorShift * 6.28f;

        const float floatPhase = t * cycleSpd * 0.3f;
        const int motifA = ((int)floatPhase) % 7;
        const int motifB = (motifA + 1) % 7;
        const float motifBlend = floatPhase - (float)((int)floatPhase);

        const int edgeNoiseTimeInt = (int)(t * 4.0f);
        const float badgeTimeTerm = t * 3.5f;

        // Precompute color swap per tier
        bool tierSwap[5];
        if (cShift > 0.05f) {
            for (int tr = 0; tr < 5; ++tr) {
                tierSwap[tr] = (PFMath::fastSin(cShift + (float)tr) > 0.3f);
            }
        } else {
            for (int tr = 0; tr < 5; ++tr) {
                tierSwap[tr] = false;
            }
        }

        for (int y = 0; y < FRAME_H; ++y) {
            // 1 & 2. Vertical card boundaries check
            const bool yInOuterMargin = (y < cardY0 || y >= cardY1);
            const bool yIsCardBorder = (y <= cardY0 + 2 || y >= cardY1 - 3);

            // Determine tier for y
            int tier = 0;
            if (y < yRow1) tier = 0;
            else if (y < yRow2) tier = 1;
            else if (y < yRow3) tier = 2;
            else if (y < yRow4) tier = 3;
            else tier = 4;

            const bool isHorizontalSeam = (y == yRow1 || y == yRow2 || y == yRow3 || y == yRow4);
            const int dyBadge = abs(y - cy);

            for (int x = 0; x < FRAME_W; ++x) {
                // 1. OUTER MARGIN
                if (x < cardX0 || x >= cardX1 || yInOuterMargin) {
                    const bool edgeNoise = (chaos > 0.1f) && (((x * 17 ^ y * 37 ^ edgeNoiseTimeInt) & 15) == 0);
                    if (edgeNoise) {
                        PFCanvas::setPixel(x, y, rDark, gDark, bDark);
                    } else {
                        PFCanvas::setPixel(x, y, rGreen, gGreen, bGreen);
                    }
                    continue;
                }

                // 2. MAIN CARD PERIMETER FRAME
                if (x <= cardX0 + 2 || x >= cardX1 - 3 || yIsCardBorder) {
                    PFCanvas::setPixel(x, y, rDark, gDark, bDark);
                    continue;
                }

                // 3. CENTRAL HERO BADGE / MICROCHIP EMBLEM
                const int dxBadge = abs(x - cx);
                if (dxBadge <= badgeHW && dyBadge <= badgeHH) {
                    const bool isBadgeBorder = (dxBadge >= badgeHW - 1 || dyBadge >= badgeHH - 1);
                    const bool isBadgeRim = (dxBadge == badgeHW - 2 || dyBadge == badgeHH - 2);

                    if (isBadgeBorder) {
                        PFCanvas::setPixel(x, y, rDark, gDark, bDark);
                    } else if (isBadgeRim) {
                        PFCanvas::setPixel(x, y, rGreen, gGreen, bGreen);
                    } else {
                        const bool bBit = PFMath::jsMod((float)(x + y) + badgeTimeTerm, 4.0f) < 2.0f;
                        if (bBit) {
                            PFCanvas::setPixel(x, y, rGreen, gGreen, bGreen);
                        } else {
                            PFCanvas::setPixel(x, y, rPlum, gPlum, bPlum);
                        }
                    }
                    continue;
                }

                // 4. COMPARTMENT BORDERS / SEAMS
                const bool isSeam = isHorizontalSeam ||
                    (y < yRow1 && (x == xCol1 || x == xCol3)) ||
                    (y >= yRow1 && y < yRow2 && x == xCol2) ||
                    (y >= yRow2 && y < yRow3 && (x == cx - badgeHW - 1 || x == cx + badgeHW + 1)) ||
                    (y >= yRow3 && y < yRow4 && x == xCol2) ||
                    (y >= yRow4 && (x == xCol1 || x == xCol3));

                if (isSeam) {
                    PFCanvas::setPixel(x, y, rDark, gDark, bDark);
                    continue;
                }

                // 5. COMPARTMENT MOTIFS
                const bool isLeft = (x < cx);
                const int panelSeed = tier * 3 + (isLeft ? 1 : 2);
                const int mIdA = (motifA + panelSeed) % 7;
                const int mIdB = (motifB + panelSeed) % 7;

                const bool bitA = evaluateMotif(mIdA, x, y, t, isLeft, tier, chaos);
                const bool bitB = evaluateMotif(mIdB, x, y, t, isLeft, tier, chaos);
                const bool bit = (motifBlend < 0.5f) ? bitA : bitB;

                // 6. COMPARTMENT COLOR ASSIGNMENTS
                uint8_t fgR = rGreen, fgG = gGreen, fgB = bGreen;
                uint8_t bgR = rPlum,  bgG = gPlum,  bgB = bPlum;

                if (tier == 0) {
                    if (!isLeft && mIdA == 0) {
                        fgR = rMint; fgG = gMint; fgB = bMint;
                        bgR = rDark; bgG = gDark; bgB = bDark;
                    } else {
                        fgR = rPurp; fgG = gPurp; fgB = bPurp;
                    }
                } else if (tier == 1) {
                    fgR = rPurp; fgG = gPurp; fgB = bPurp;
                    bgR = rPlum; bgG = gPlum; bgB = bPurp;
                } else if (tier == 2) {
                    fgR = rGreen; fgG = gGreen; fgB = bGreen;
                    bgR = rDark;  bgG = gDark;  bgB = bDark;
                } else if (tier == 3) {
                    fgR = rPurp;  fgG = gPurp;  fgB = bPurp;
                    bgR = rPlum;  bgG = gPlum;  bgB = bPurp;
                } else {
                    fgR = rMint; fgG = gMint; fgB = bMint;
                    bgR = rPlum; bgG = gPlum; bgB = bPurp;
                }

                if (tierSwap[tier]) {
                    const uint8_t trR = fgR; const uint8_t trG = fgG; const uint8_t trB = fgB;
                    fgR = bgR; fgG = bgG; fgB = bgB;
                    bgR = trR; bgG = trG; bgB = trB;
                }

                if (bit) {
                    PFCanvas::setPixel(x, y, fgR, fgG, fgB);
                } else {
                    PFCanvas::setPixel(x, y, bgR, bgG, bgB);
                }
            }
        }

        PFCanvas::present();
    }

} // namespace RetroCyberCard