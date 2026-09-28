#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_params.h"
#include "src/core_math.h"

namespace M4R10Pattern {

const char* NAME = "M4R10";
const char* const KNOB_LABELS[4] = {"Speed", "Jump", "Coins", "Time"};
constexpr bool ABSOLUTE_READY = true;

// Knob parameters
static float p_speed = 0.2f;
static float p_jump  = 1.0f;
static float p_coins = 1.0f;
static float p_night = 1.0f;

// Simulation state
static float p_t = 0.0f;
static float p_world = 0.0f;
static bool  p_paused = false;
static float p_extra = 0.0f;
static float p_burst = 0.0f;

// Sprites
static const char* const MARIO_SPRITE[16] = {
    ".....RRRRR......",
    "....RRRRRRRRR...",
    "....HHHSSK......",
    "...HSHSSSKSS....",
    "...HSHHSSSKSS...",
    "....HSSSSKKKK...",
    ".....SSSSSS.....",
    "....RRBRR.......",
    "...RRRBRRBRRR...",
    "..RRRRBBBBRRRR..",
    "..SSRBYYBYBRSS..",
    "..SSSBBBBBBSSS..",
    "....BBBBBBBB....",
    "....BBB..BBB....",
    "...HHH....HHH...",
    "..HHHH....HHHH.."
};

static const char* const GOOMBA_SPRITE[11] = {
    "....HHHH....",
    "...HHHHHH...",
    "..HHHHHHHH..",
    ".HHHHHHHHHH.",
    "HHWKH H KWHH",
    "HHWKKHHKKWHH",
    "HHHHHHHHHHHH",
    "..SSSSSSSS..",
    "...SSSSSS...",
    "..KKK.KKK...",
    ".KKKK.KKKK.."
};

static const char* const QUESTION_SPRITE[7] = {
    "01110",
    "11011",
    "00011",
    "00110",
    "00100",
    "00000",
    "00100"
};

void setup() {
    PFMath::buildSinLUT();
    p_speed = 0.2f;
    p_jump  = 1.0f;
    p_coins = 1.0f;
    p_night = 1.0f;
    p_t = 0.0f;
    p_world = 0.0f;
    p_paused = false;
    p_extra = 0.0f;
    p_burst = 0.0f;
}

void update(float dt, const InputFrame& input) {
    PFParams::apply(input, 0, &p_speed, 0.2f, 2.0f, 0.038f);
    PFParams::apply(input, 1, &p_jump,  0.0f, 1.0f, 0.021f);
    PFParams::apply(input, 2, &p_coins, 0.0f, 1.0f, 0.021f);
    PFParams::apply(input, 3, &p_night, 0.0f, 1.0f, 0.021f);

    if (input.btnPressed[0] && !input.paramAbsoluteActive[0] && !input.knobAudioActive[0]) {
        p_paused = !p_paused;
    }
    if (input.btnPressed[1] && !input.paramAbsoluteActive[1] && !input.knobAudioActive[1]) {
        p_extra = 0.001f;
    }
    if (input.btnPressed[2] && !input.paramAbsoluteActive[2] && !input.knobAudioActive[2]) {
        p_burst = 1.0f;
    }
    if (input.btnPressed[3] && !input.paramAbsoluteActive[3] && !input.knobAudioActive[3]) {
        p_world = 0.0f;
        p_t = 0.0f;
        p_extra = 0.0f;
        p_burst = 0.0f;
    }

    if (!p_paused) {
        p_t += dt;
        if (p_t > TWO_PI * 100.0f) {
            p_t -= TWO_PI * 100.0f;
        }

        p_world += dt * p_speed * 19.0f;
        // World coordinates wrap periodically every 3780 units (lcm of 120, 105, 90, 37)
        if (p_world > 378000.0f) {
            p_world -= 378000.0f;
        }

        if (p_extra > 0.0f) {
            p_extra += dt * 1.5f;
            if (p_extra >= 1.0f) p_extra = 0.0f;
        }

        p_burst = fmaxf(0.0f, p_burst - dt * 0.65f);
    }
}

void draw() {
    const float scale = fminf((float)PANEL_RES_W / 128.0f, (float)PANEL_RES_H / 64.0f);
    const float invScale = 1.0f / scale;
    const int ground = 53;
    const int marioX = 33;

    const float playerWorld = p_world + (float)(marioX + 8);
    const float phase = PFMath::jsMod(playerWorld, 120.0f);

    // Auto pipe jump
    const float pipeDelta = phase - 74.0f;
    float jumpHeight = 0.0f;
    if (pipeDelta > -27.0f && pipeDelta < 27.0f) {
        jumpHeight = PFMath::fastSin((pipeDelta + 27.0f) / 54.0f * PI) * (23.0f + p_jump * 5.0f);
    }

    // Question block jump
    const float blockDelta = phase - 20.0f;
    if (blockDelta > -17.0f && blockDelta < 17.0f) {
        jumpHeight = fmaxf(jumpHeight, PFMath::fastSin((blockDelta + 17.0f) / 34.0f * PI) * 15.0f);
    }

    // Button-triggered extra jump
    if (p_extra > 0.0f) {
        jumpHeight = fmaxf(jumpHeight, PFMath::fastSin(p_extra * PI) * (24.0f + p_jump * 8.0f));
    }

    const int marioY = ground - 16 - PFMath::ifloor(jumpHeight);
    const int runningFrame = PFMath::ifloor(p_world / 3.0f) & 1;
    const bool airborne = jumpHeight > 2.0f;

    // Precalculate coin cos animations
    const float blockCoinCos = fabsf(PFMath::fastCos(p_t * 10.0f));
    const float blockCoinWidth = 0.8f + blockCoinCos * 2.0f;
    const float invBlockCoinWidthSq = 1.0f / (blockCoinWidth * blockCoinWidth);

    float coinWidths[5];
    float invCoinWidthsSq[5];
    const int maxCoinIdx = PFMath::ifloor(p_coins * 4.0f);
    for (int i = 0; i < 5; ++i) {
        if (i <= maxCoinIdx) {
            coinWidths[i] = 0.7f + 1.6f * fabsf(PFMath::fastCos(p_t * 5.0f + (float)i));
            invCoinWidthsSq[i] = 1.0f / (coinWidths[i] * coinWidths[i]);
        }
    }

    const float centerW = (float)PANEL_RES_W * 0.5f;
    const float centerH = (float)PANEL_RES_H * 0.5f;

    for (int y = 0; y < PANEL_RES_H; ++y) {
        const int Y = PFMath::ifloor(((float)y - centerH) * invScale + 32.0f);
        const float dyGround = (float)(Y - ground);
        const float dyGroundSqTerm = (dyGround * dyGround) / 400.0f;

        for (int x = 0; x < PANEL_RES_W; ++x) {
            const int X = PFMath::ifloor(((float)x - centerW) * invScale + 64.0f);
            const float wx = (float)X + p_world;

            // Sky background
            float r = 85.0f - p_night * 78.0f;
            float g = 165.0f - p_night * 153.0f;
            float b = 245.0f - p_night * 211.0f;

            // Night stars
            const int starX = PFMath::ifloor(PFMath::jsMod((float)PFMath::ifloor((float)X + p_world * 0.06f), 37.0f));
            const int starY = PFMath::ifloor(PFMath::jsMod((float)Y, 19.0f));
            if (p_night > 0.35f && ((starX == 7 && starY == 5) || (starX == 24 && starY == 12)) && Y < 32) {
                const float light = p_night * 190.0f;
                r += light;
                g += light;
                b += light;
            }

            // Clouds
            const float cloudX = PFMath::jsMod((float)X + p_world * 0.17f, 105.0f);
            const bool cloud = (cloudX > 12.0f && cloudX < 39.0f && Y >= 10 && Y < 15) ||
                               (cloudX > 18.0f && cloudX < 32.0f && Y >= 6 && Y < 15);
            if (cloud) {
                r = 250.0f - p_night * 160.0f;
                g = 250.0f - p_night * 155.0f;
                b = 242.0f - p_night * 135.0f;
            }

            // Background hills
            const float hillX = PFMath::jsMod((float)X + p_world * 0.3f, 90.0f) - 45.0f;
            if (Y < ground && (hillX * hillX / 900.0f + dyGroundSqTerm < 1.0f)) {
                r = 39.0f - p_night * 20.0f;
                g = 158.0f - p_night * 85.0f;
                b = 65.0f - p_night * 23.0f;
            }

            // Brick ground
            if (Y >= ground) {
                const int row = PFMath::ifloor(dyGround / 5.0f);
                const bool mortar = (PFMath::ifloor(PFMath::jsMod(dyGround, 5.0f)) == 0) ||
                                    (PFMath::ifloor(PFMath::jsMod((float)PFMath::ifloor(wx) + (float)((row & 1) * 6), 12.0f)) == 0);
                r = mortar ? 94.0f : 189.0f;
                g = mortar ? 43.0f : 90.0f;
                b = mortar ? 25.0f : 43.0f;

                if (Y == ground) {
                    r = 246.0f;
                    g = 170.0f;
                    b = 90.0f;
                }
            }

            const float tile = PFMath::jsMod(wx, 120.0f);
            const int section = PFMath::ifloor(wx / 120.0f);

            // Pipe stem
            if (tile >= 66.0f && tile < 83.0f && Y >= 39 && Y < ground) {
                const float u = tile - 66.0f;
                r = 17.0f; g = 146.0f; b = 37.0f;
                if (u > 2.0f && u < 6.0f) {
                    r = 119.0f; g = 234.0f; b = 78.0f;
                } else if (u >= 6.0f && u < 13.0f) {
                    r = 42.0f; g = 187.0f; b = 42.0f;
                }
                if (u < 1.0f || u > 15.0f) {
                    r = 8.0f; g = 75.0f; b = 22.0f;
                }
            }

            // Pipe rim
            if (tile >= 63.0f && tile < 86.0f && Y >= 35 && Y < 41) {
                r = 35.0f; g = 182.0f; b = 42.0f;
                if (tile < 64.0f || tile >= 85.0f || Y == 35 || Y == 40) {
                    r = 8.0f; g = 76.0f; b = 22.0f;
                } else if (tile < 70.0f) {
                    r = 123.0f; g = 241.0f; b = 85.0f;
                }
            }

            // Question block
            const float blockCenter = (float)(section * 120 + 20);
            const float passed = playerWorld - blockCenter;
            const bool hit = passed > -3.0f;
            const float bump = (passed > -3.0f && passed < 7.0f)
                ? PFMath::fastSin((passed + 3.0f) / 10.0f * PI) * 3.0f
                : 0.0f;
            const int blockTop = 18 - PFMath::ifloor(bump);

            if (tile >= 13.0f && tile < 27.0f && Y >= blockTop && Y < blockTop + 14) {
                const int u = PFMath::ifloor(tile - 13.0f);
                const int v = Y - blockTop;

                r = hit ? 157.0f : 246.0f;
                g = hit ? 92.0f  : 174.0f;
                b = hit ? 48.0f  : 31.0f;

                if (u == 0 || u == 13 || v == 13) {
                    r = 105.0f; g = 56.0f; b = 23.0f;
                }
                if (v == 0) {
                    r = hit ? 193.0f : 255.0f;
                    g = hit ? 125.0f : 226.0f;
                    b = hit ? 70.0f  : 120.0f;
                }

                const int qx = u - 4;
                const int qy = v - 3;
                if (!hit && qx >= 0 && qx < 5 && qy >= 0 && qy < 7) {
                    if (QUESTION_SPRITE[qy][qx] == '1') {
                        r = 255.0f; g = 248.0f; b = 193.0f;
                    }
                }
            }

            // Block coin pop
            if (passed > -3.0f && passed < 21.0f) {
                const float progress = (passed + 3.0f) / 24.0f;
                const float coinY = 13.0f - PFMath::fastSin(progress * PI) * 10.0f;
                const float coinX = tile - 20.0f;
                const float dyCoin = (float)Y - coinY;
                if ((coinX * coinX * invBlockCoinWidthSq + (dyCoin * dyCoin) / 12.0f) < 1.0f) {
                    r = 255.0f; g = 225.0f; b = 65.0f;
                }
            }

            // Collectible coins along jump trajectory
            for (int i = 0; i <= maxCoinIdx && i < 5; ++i) {
                const float coinWorld = (float)(section * 120 + 53 + i * 11);
                const float coinScreen = coinWorld - p_world;
                const float coinY = 25.0f - PFMath::fastSin((float)i / 4.0f * PI) * 9.0f;
                const bool collected = playerWorld > (coinWorld + 2.0f);

                if (!collected) {
                    const float dx = (float)X - coinScreen;
                    const float dy = (float)Y - coinY;
                    if ((dx * dx * invCoinWidthsSq[i] + (dy * dy) / 10.0f) < 1.0f) {
                        r = 255.0f; g = 210.0f; b = 35.0f;
                        if (fabsf(dx) < 0.6f) {
                            r = 255.0f; g = 249.0f; b = 164.0f;
                        }
                    }
                }
            }

            // Goomba
            const float enemyCenter = (float)(section * 120 + 93);
            const float enemyPassed = playerWorld - enemyCenter;
            const float enemyX = enemyCenter - p_world - 6.0f;
            const int ex = PFMath::ifloor((float)X - enemyX);
            const bool stomped = enemyPassed > -2.0f;

            if (stomped && enemyPassed < 12.0f) {
                if (ex >= 0 && ex < 12 && Y >= 50 && Y < ground) {
                    r = 132.0f; g = 74.0f; b = 35.0f;
                }
            } else if (!stomped) {
                const int ey = Y - (ground - 11);
                if (ex >= 0 && ex < 12 && ey >= 0 && ey < 11) {
                    const char pixel = GOOMBA_SPRITE[ey][ex];
                    if (pixel == 'H') {
                        r = 143.0f; g = 77.0f; b = 35.0f;
                    } else if (pixel == 'S') {
                        r = 238.0f; g = 194.0f; b = 133.0f;
                    } else if (pixel == 'W') {
                        r = 255.0f; g = 247.0f; b = 218.0f;
                    } else if (pixel == 'K') {
                        r = 29.0f;  g = 20.0f;  b = 17.0f;
                    }
                }
            }

            // Mario sprite
            int mx = X - marioX;
            const int my = Y - marioY;
            if (my >= 13 && !airborne && runningFrame == 1) {
                mx += (my == 15) ? 2 : -1;
            }

            if (mx >= 0 && mx < 16 && my >= 0 && my < 16) {
                const char pixel = MARIO_SPRITE[my][mx];
                if (pixel == 'R') {
                    r = 238.0f; g = 44.0f;  b = 39.0f;
                } else if (pixel == 'B') {
                    r = 35.0f;  g = 75.0f;  b = 208.0f;
                } else if (pixel == 'S') {
                    r = 255.0f; g = 191.0f; b = 133.0f;
                } else if (pixel == 'H') {
                    r = 100.0f; g = 48.0f;  b = 24.0f;
                } else if (pixel == 'K') {
                    r = 25.0f;  g = 19.0f;  b = 17.0f;
                } else if (pixel == 'Y') {
                    r = 255.0f; g = 224.0f; b = 60.0f;
                }
            }

            // Burst sparkles
            if (p_burst > 0.0f) {
                const float radius = (1.0f - p_burst) * 29.0f;
                for (int i = 0; i < 8; ++i) {
                    const float angle = (float)i * (PI / 4.0f);
                    const float px = (float)(marioX + 8) + PFMath::fastCos(angle) * radius;
                    const float py = (float)(marioY + 6) + PFMath::fastSin(angle) * radius;
                    const float dx = fabsf((float)X - px);
                    const float dy = fabsf((float)Y - py);
                    if ((dx < 0.8f && dy < 2.0f) || (dy < 0.8f && dx < 2.0f)) {
                        r = 255.0f;
                        g = 225.0f;
                        b = 90.0f;
                    }
                }
            }

            const uint8_t ur = (uint8_t)PFMath::clamp(PFMath::ifloor(r), 0, 255);
            const uint8_t ug = (uint8_t)PFMath::clamp(PFMath::ifloor(g), 0, 255);
            const uint8_t ub = (uint8_t)PFMath::clamp(PFMath::ifloor(b), 0, 255);
            PFCanvas::setPixel(x, y, ur, ug, ub);
        }
    }

    PFCanvas::present();
}

} // namespace M4R10Pattern