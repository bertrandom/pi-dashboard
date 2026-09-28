#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_params.h"
#include "src/core_math.h"
#include "src/core_mem.h"

namespace AscenderPattern {

    const char* NAME = "Ascender";
    const char* const KNOB_LABELS[4] = {"Lantern", "Ascent", "Tower", "Magic"};
    constexpr bool ABSOLUTE_READY = true;

    constexpr int FRAME_W = 64;
    constexpr int FRAME_H = 128;

    // Knob states
    static float kLantern = 0.341f;
    static float kAscent  = 9.802f;
    static float kTower   = 0.407f;
    static float kMagic   = 1.0f;

    // Animation & user interaction state
    static float scroll = 0.0f;
    static float t = 0.0f;
    static float reverseDir = 1.0f;
    static int seed = 7;
    static float pulse = 0.0f;
    static float invert = 0.0f;

    // Framebuffer index array (allocated via PSRAM / PFMem)
    static uint8_t* pixels = nullptr;
    static uint8_t palette[32 * 3];

    // Static color references
    static const uint8_t stone[12][3] = {
        {0, 0, 0},
        {5, 10, 18},
        {10, 18, 30},
        {18, 32, 50},
        {38, 64, 88},
        {80, 120, 140},
        {135, 178, 188},
        {215, 242, 246},
        {0, 0, 0},
        {18, 32, 50},
        {38, 64, 88},
        {80, 120, 140}
    };

    static const uint8_t baseHues[4][3] = {
        {255, 110, 10},
        {20, 225, 255},
        {240, 45, 255},
        {255, 110, 10}
    };

    static inline float hashN(uint32_t n) {
        n = (n ^ 0x45d9f3bu) * 1597334677u;
        n ^= (n >> 16);
        return (float)n * (1.0f / 4294967296.0f);
    }

    static inline void box(int x, int y, int w, int h, uint8_t c) {
        int x0 = x < 0 ? 0 : x;
        int x1 = (x + w) > FRAME_W ? FRAME_W : (x + w);
        int y0 = y < 0 ? 0 : y;
        int y1 = (y + h) > FRAME_H ? FRAME_H : (y + h);
        if (x0 >= x1 || y0 >= y1) return;

        for (int row = y0; row < y1; ++row) {
            uint8_t* rowPtr = &pixels[row * FRAME_W + x0];
            int len = x1 - x0;
            memset(rowPtr, c, len);
        }
    }

    static inline void dot(int x, int y, uint8_t c) {
        if (x >= 0 && x < FRAME_W && y >= 0 && y < FRAME_H) {
            pixels[y * FRAME_W + x] = c;
        }
    }

    static inline void line(int x0, int y0, int x1, int y1, uint8_t c) {
        int dx = abs(x1 - x0);
        int sx = x0 < x1 ? 1 : -1;
        int dy = -abs(y1 - y0);
        int sy = y0 < y1 ? 1 : -1;
        int err = dx + dy;

        for (int i = 0; i < 300; ++i) {
            dot(x0, y0, c);
            if (x0 == x1 && y0 == y1) break;
            int e2 = 2 * err;
            if (e2 >= dy) {
                err += dy;
                x0 += sx;
            }
            if (e2 <= dx) {
                err += dx;
                y0 += sy;
            }
        }
    }

    static inline void circle(int cx, int cy, int r, uint8_t c) {
        int x = 0;
        int y = r;
        int d = 3 - 2 * r;
        while (x <= y) {
            dot(cx + x, cy + y, c);
            dot(cx - x, cy + y, c);
            dot(cx + x, cy - y, c);
            dot(cx - x, cy - y, c);
            dot(cx + y, cy + x, c);
            dot(cx - y, cy + x, c);
            dot(cx + y, cy - x, c);
            dot(cx - y, cy - x, c);
            if (d < 0) {
                d = d + 4 * x + 6;
            } else {
                d = d + 4 * (x - y) + 10;
                y--;
            }
            x++;
        }
    }

    static inline void arch(int cx, int y, int half, int h, uint8_t c) {
        box(cx - half, y + half, half * 2 + 1, h - half, c);
        for (int row = 0; row < half; ++row) {
            int span = PFMath::ifloor(row * 0.72f + half * 0.28f);
            box(cx - span, y + row, span * 2 + 1, 1, c);
        }
    }

    static inline void lamp(int x, int y, float timeVal, int id, int type) {
        if (type == 0) {
            dot(x, y + 2, 3);
            dot(x, y + 1, 4);
            int flick = PFMath::fastSin(timeVal * 12.0f + (float)id * 7.0f) > 0.0f ? 1 : 0;
            int sway  = PFMath::fastCos(timeVal * 15.0f + (float)id * 3.0f) > 0.2f ? 1 : 0;
            box(x - 1, y - 1 - flick, 3, 2 + flick, 14);
            dot(x, y - 2 - flick, 14);
            dot(x, y - flick, 15);
            if (sway) dot(x + 1, y - 2 - flick, 14);
        } else if (type == 1) {
            box(x - 2, y + 2, 5, 2, 4);
            box(x - 1, y + 4, 3, 2, 3);
            dot(x, y + 6, 3);

            int flick  = PFMath::fastSin(timeVal * 11.0f + (float)id * 7.0f) > 0.0f ? 1 : 0;
            int sway   = PFMath::fastSin(timeVal * 15.0f + (float)id * 3.0f) > 0.2f ? 1 : -1;
            int hSpike = PFMath::fastCos(timeVal * 13.0f + (float)id * 5.0f) > 0.3f ? 1 : 0;

            box(x - 2, y - 2 - flick, 5, 4 + flick, 14);
            box(x - 1, y - 4 - flick - hSpike, 3, 3, 14);
            dot(x + sway, y - 5 - flick - hSpike, 14);

            box(x - 1, y - 1 - flick, 3, 3 + flick, 15);
            box(x, y - 3 - flick, 1, 3, 15);
            dot(x, y - 4 - flick, 15);

            if (flick && hSpike) {
                dot(x - 2, y - 3, 14);
                dot(x + 2, y - 4, 15);
            }
        } else {
            box(x - 2, y + 2, 5, 2, 4);
            box(x - 1, y + 4, 3, 2, 3);
            dot(x, y + 6, 3);

            int flick = PFMath::fastSin(timeVal * 13.0f + (float)id * 9.0f) > 0.0f ? 1 : 0;
            int sway  = PFMath::fastCos(timeVal * 16.0f + (float)id * 4.0f) > 0.1f ? 1 : -1;
            int blast = PFMath::fastSin(timeVal * 10.0f + (float)id * 3.0f) > 0.2f ? 1 : 0;

            box(x - 2, y - 3 - flick, 5, 5 + flick, 14);
            box(x - 1, y - 5 - flick - blast, 3, 3 + blast, 14);
            dot(x + sway, y - 6 - flick - blast, 14);

            box(x - 1, y - 2 - flick, 3, 3 + flick, 15);
            box(x, y - 4 - flick, 1, 3, 15);
            dot(x, y - 5 - flick, 15);

            if (flick) {
                dot(x - 3, y - 2 - blast, 14);
                dot(x + 3, y - 4 - flick, 15);
            }
        }
    }

    void setup() {
        PFMath::buildSinLUT();
        if (!pixels) {
            float* mem = PFMem::allocFloats((FRAME_W * FRAME_H + sizeof(float) - 1) / sizeof(float));
            pixels = reinterpret_cast<uint8_t*>(mem);
        }
        scroll = 0.0f;
        t = 0.0f;
        reverseDir = 1.0f;
        seed = 7;
        pulse = 0.0f;
        invert = 0.0f;
        kLantern = 0.341f;
        kAscent  = 9.802f;
        kTower   = 0.407f;
        kMagic   = 1.0f;
    }

    void update(float dt, const InputFrame& input) {
        dt = PFMath::clamp(dt, 0.0f, 0.05f);

        PFParams::apply(input, 0, &kLantern, 0.0f, 1.0f, 0.021f);
        PFParams::apply(input, 1, &kAscent, -12.0f, 20.0f, 0.667f);
        PFParams::apply(input, 2, &kTower, 0.0f, 2.0f, 0.042f);
        PFParams::apply(input, 3, &kMagic, 0.0f, 1.0f, 0.021f);

        t += dt;
        if (t > 720.0f * PI) {
            t -= 720.0f * PI;
        }

        scroll += dt * kAscent * 6.0f * reverseDir;
        if (scroll > 100000.0f || scroll < -100000.0f) {
            scroll = PFMath::jsMod(scroll, 2160.0f);
        }

        pulse = PFMath::clamp01(pulse - dt * 0.7f);

        if (input.btnPressed[0] && !input.paramAbsoluteActive[0] && !input.knobAudioActive[0]) {
            invert = 1.0f - invert;
        }
        if (input.btnPressed[1] && !input.paramAbsoluteActive[1] && !input.knobAudioActive[1]) {
            reverseDir = -reverseDir;
        }
        if (input.btnPressed[2] && !input.paramAbsoluteActive[2] && !input.knobAudioActive[2]) {
            seed += 13;
        }
        if (input.btnPressed[3] && !input.paramAbsoluteActive[3] && !input.knobAudioActive[3]) {
            pulse = 1.0f;
        }
    }

    void draw() {
        PFCanvas::setFrame(FRAME_W, FRAME_H);

        if (!pixels) {
            PFCanvas::present();
            return;
        }

        float travel = scroll;
        float magic = PFMath::clamp01(kMagic + pulse * 0.7f);
        float widen = kTower * 5.0f;
        int left = PFMath::ifloor(13.0f - widen + 0.5f);
        int right = 63 - left;

        // Base stone palette (indices 0..11)
        for (int i = 0; i < 12; ++i) {
            palette[i * 3 + 0] = stone[i][0];
            palette[i * 3 + 1] = stone[i][1];
            palette[i * 3 + 2] = stone[i][2];
        }

        // Dynamic light palette (indices 12..15)
        float hue = PFMath::fract(kLantern + invert * 0.5f);
        float huePos = hue * 3.0f;
        int seg = PFMath::ifloor(huePos);
        if (seg > 2) seg = 2;
        float m = huePos - (float)seg;

        const uint8_t* a = baseHues[seg];
        const uint8_t* b = baseHues[seg + 1];
        float rCol = (float)a[0] + ((float)b[0] - (float)a[0]) * m;
        float gCol = (float)a[1] + ((float)b[1] - (float)a[1]) * m;
        float bCol = (float)a[2] + ((float)b[2] - (float)a[2]) * m;

        palette[12 * 3 + 0] = (uint8_t)PFMath::clamp(rCol * 0.75f + 0.5f, 0.0f, 255.0f);
        palette[12 * 3 + 1] = (uint8_t)PFMath::clamp(gCol * 0.75f + 0.5f, 0.0f, 255.0f);
        palette[12 * 3 + 2] = (uint8_t)PFMath::clamp(bCol * 0.75f + 0.5f, 0.0f, 255.0f);

        palette[13 * 3 + 0] = (uint8_t)PFMath::clamp(rCol * 0.4f + 255.0f * 0.6f + 0.5f, 0.0f, 255.0f);
        palette[13 * 3 + 1] = (uint8_t)PFMath::clamp(gCol * 0.4f + 255.0f * 0.6f + 0.5f, 0.0f, 255.0f);
        palette[13 * 3 + 2] = (uint8_t)PFMath::clamp(bCol * 0.4f + 255.0f * 0.6f + 0.5f, 0.0f, 255.0f);

        palette[14 * 3 + 0] = (uint8_t)PFMath::clamp(rCol + 0.5f, 0.0f, 255.0f);
        palette[14 * 3 + 1] = (uint8_t)PFMath::clamp(gCol + 0.5f, 0.0f, 255.0f);
        palette[14 * 3 + 2] = (uint8_t)PFMath::clamp(bCol + 0.5f, 0.0f, 255.0f);

        palette[15 * 3 + 0] = 255;
        palette[15 * 3 + 1] = 255;
        palette[15 * 3 + 2] = 255;

        // Static highlight/accent palette (indices 16..21)
        static const uint8_t accentPalette[18] = {
            255, 18, 45,
            255, 80, 95,
            0, 0, 0,
            190, 245, 255,
            255, 190, 30,
            255, 255, 185
        };
        memcpy(&palette[48], accentPalette, 18);

        // Clear screen buffer
        memset(pixels, 0, FRAME_W * FRAME_H);

        // 1. Far shaft
        box(left + 3, 0, right - left - 6, FRAME_H, 1);
        box(24, 0, 16, FRAME_H, 2);
        box(26, 0, 12, FRAME_H, 3);
        float backOffset = PFMath::jsMod(PFMath::jsMod(travel * 0.38f, 40.0f) + 40.0f, 40.0f);
        int backStartY = PFMath::ifloor(backOffset) - 40;
        for (int y = backStartY; y < FRAME_H; y += 40) {
            arch(32, y + 5, 5, 22, 4);
            arch(32, y + 6, 4, 20, 1);
            arch(32, y + 8, 2, 15, 6);
            arch(32, y + 9, 1, 13, 19);

            box(31, y + 9, 1, 14, 3);
            box(33, y + 9, 1, 14, 3);
            box(30, y + 17, 5, 1, 3);

            box(24, y + 29, 16, 2, 4);
            box(23, y + 31, 18, 1, 2);
            for (int x = 25; x < 41; x += 3) {
                box(x, y + 26, 1, 3, 5);
            }
            box(23, y + 25, 18, 1, 6);

            for (int by = 0; by < 40; by += 8) {
                line(left + 4, y + by, 23, y + by, 2);
                line(41, y + by, right - 4, y + by, 2);
            }
        }

        // 2. Mid-distance
        float middle = PFMath::jsMod(PFMath::jsMod(travel * 0.64f, 54.0f) + 54.0f, 54.0f);
        int leftCol = left + 5;
        int rightCol = right - 5;
        int spanW = rightCol - leftCol;

        box(leftCol - 1, 0, 3, FRAME_H, 0);
        box(leftCol - 1, 0, 1, FRAME_H, 5);
        box(rightCol - 1, 0, 3, FRAME_H, 0);
        box(rightCol - 1, 0, 1, FRAME_H, 5);

        int midStartY = PFMath::ifloor(middle) - 54;
        for (int y = midStartY; y < FRAME_H; y += 54) {
            int bY = y + 22;

            box(leftCol, bY, spanW, 2, 4);
            box(leftCol, bY, spanW, 1, 7);

            line(leftCol, bY - 3, rightCol, bY - 3, 6);
            for (int x = leftCol + 2; x < rightCol; x += 3) {
                box(x, bY - 3, 1, 3, 5);
            }

            if (spanW > 0) {
                float invSpanW = 1.0f / (float)spanW;
                for (int x = leftCol; x <= rightCol; ++x) {
                    float norm = ((float)(x - leftCol) * invSpanW) * 2.0f - 1.0f;
                    int archDrop = PFMath::ifloor((1.0f - norm * norm) * 4.0f + 0.5f);
                    dot(x, bY + 2 + archDrop, 0);
                }
            }

            for (int side = 0; side < 2; ++side) {
                int cx = side ? rightCol : leftCol;
                box(cx - 2, y + 34, 5, 11, 16);
                box(cx - 2, y + 34, 1, 10, 17);
                dot(cx, y + 45, 0);
                line(cx, y + 36, cx, y + 42, 0);
                line(cx - 1, y + 38, cx + 1, y + 38, 0);
                lamp(cx, y + 12, t, side + PFMath::ifloor(((float)y - middle) / 54.0f), 0);
            }
        }

        // 3. Foreground stonework
        constexpr int floorH = 48;
        float offset = PFMath::jsMod(PFMath::jsMod(travel, (float)floorH) + (float)floorH, (float)floorH);
        for (int side = 0; side < 2; ++side) {
            int edge = side ? right : left;
            int x0 = side ? right + 3 : 0;
            int bw = left - 2;

            box(x0, 0, bw, FRAME_H, 3);

            int fgStartY = PFMath::ifloor(offset) - floorH * 2;
            for (int y = fgStartY; y < FRAME_H; y += floorH) {
                int id = PFMath::ifloor(((float)y - travel) / (float)floorH + 0.5f) + seed + side * 31;
                int center = side ? right + 7 : left - 7;

                arch(center, y + 6, 6, 24, 5);
                arch(center, y + 8, 4, 21, 0);

                dot(center, y + 5, 7);
                dot(center - 1, y + 6, 6);
                dot(center + 1, y + 6, 6);

                for (int q = 0; q < 3; ++q) {
                    dot(center - 5, y + 13 + q * 4, 6);
                    dot(center + 5, y + 13 + q * 4, 4);
                    box(center - 4, y + 14 + q * 4, 1, 1, 4);
                    box(center + 4, y + 15 + q * 4, 1, 1, 4);
                }
                box(center - 5, y + 28, 11, 1, 5);

                for (int by = 0; by < floorH; by += 5) {
                    box(edge - 1, y + by, 4, 4, 4);
                    box(edge - 1, y + by, 1, 4, 7);
                    if (((by / 5) & 1) == 0) {
                        box(edge + 1, y + by + 1, 1, 3, 3);
                    }
                    if (hashN((uint32_t)(id * 19 + by)) > 0.5f) {
                        dot(edge, y + by + 2, 7);
                    }
                }

                int shelf = y + 34;
                int shelfW = side ? (FRAME_W - x0) : (left + 2);
                box(x0, shelf, shelfW, 3, 4);
                box(x0, shelf, shelfW, 1, 7);
                for (int x = x0 + 1; x < x0 + bw; x += 3) {
                    box(x, shelf - 4, 1, 4, 5);
                    dot(x, shelf - 4, 7);
                }
                box(x0, shelf - 5, bw, 1, 6);
                line(edge, shelf + 3, side ? (FRAME_W - 1) : 0, shelf + 9, 4);

                lamp(center, y + 29, t, id, 1);

                if (hashN((uint32_t)id) > 0.32f) {
                    int fy = y + floorH - 4;
                    box(center - 2, fy, 5, 11, 16);
                    box(center - 2, fy, 1, 10, 17);
                    dot(center, fy + 10, 0);
                    dot(center - 1, fy + 10, 16);
                    dot(center + 1, fy + 10, 16);
                    line(center, fy + 2, center, fy + 7, 0);
                    line(center - 2, fy + 3, center + 2, fy + 3, 0);
                }
            }
        }

        // 4. Chains
        float chainY = PFMath::jsMod(PFMath::jsMod(travel * 1.2f, 4.0f) + 4.0f, 4.0f);
        int chainStartY = PFMath::ifloor(chainY) - 4;
        const int chainX[2] = {22, 42};
        for (int cIdx = 0; cIdx < 2; ++cIdx) {
            int x = chainX[cIdx];
            box(x, 0, 2, FRAME_H, 0);
            for (int y = chainStartY; y < FRAME_H; y += 4) {
                box(x, y, 1, 2, 6);
                dot(x, y, 7);
                dot(x + 1, y + 2, 0);
            }
        }

        // 5. Suspended lift & Character
        int py = 90 + PFMath::ifloor(PFMath::fastSin(t * 1.7f) * 0.8f + 0.5f);

        box(20, py + 4, 25, 3, 0);
        box(21, py + 6, 23, 2, 3);
        box(23, py + 8, 19, 2, 3);
        box(25, py + 10, 15, 2, 4);
        box(19, py, 27, 4, 4);
        box(19, py, 1, 4, 7);
        box(20, py + 3, 25, 1, 3);
        for (int cIdx = 0; cIdx < 2; ++cIdx) {
            int x = (cIdx == 0) ? 20 : 44;
            box(x, py + 1, 2, 2, 0);
            dot(x, py + 1, 14);
        }

        // Magic glyphs above lift
        if (magic > 0.1f) {
            int hx = 32;
            int hy = py - 44;
            int r = PFMath::ifloor(7.0f + magic * 6.0f + 0.5f);
            float rot = t * 0.45f;

            circle(hx, hy, r, 20);

            if (magic > 0.35f) {
                int starR = r - 1;
                int vx[6];
                int vy[6];
                for (int i = 0; i < 6; ++i) {
                    float a = rot + (float)i * (PI / 3.0f);
                    vx[i] = PFMath::ifloor((float)hx + PFMath::fastCos(a) * (float)starR + 0.5f);
                    vy[i] = PFMath::ifloor((float)hy + PFMath::fastSin(a) * (float)starR + 0.5f);
                }

                line(vx[0], vy[0], vx[2], vy[2], 20);
                line(vx[2], vy[2], vx[4], vy[4], 20);
                line(vx[4], vy[4], vx[0], vy[0], 20);

                line(vx[1], vy[1], vx[3], vy[3], 20);
                line(vx[3], vy[3], vx[5], vy[5], 20);
                line(vx[5], vy[5], vx[1], vy[1], 20);

                for (int i = 0; i < 6; ++i) {
                    dot(vx[i], vy[i], 21);
                }

                dot(hx, hy, 21);
                dot(hx - 1, hy, 20);
                dot(hx + 1, hy, 20);
                dot(hx, hy - 1, 20);
                dot(hx, hy + 1, 20);
            }

            int dropCount = 3 + PFMath::ifloor(magic * 6.0f);
            constexpr float dropLifeDist = 26.0f;

            for (int i = 0; i < dropCount; ++i) {
                float startAngle = (PI * 0.5f) + (PFMath::fastSin((float)i * 1.9f + (float)seed) * 0.7f);
                float originX = (float)hx + PFMath::fastCos(startAngle) * (float)r;
                float originY = (float)hy + PFMath::fastSin(startAngle) * (float)r;

                float dropSpeed = 6.0f + (float)(i % 3) * 2.0f;
                float progress = PFMath::jsMod(t * dropSpeed + (float)i * 5.7f, dropLifeDist);

                float driftX = PFMath::fastSin(progress * 0.35f + (float)i * 1.4f) * 1.2f;
                int currentX = PFMath::ifloor(originX + driftX + 0.5f);
                int currentY = PFMath::ifloor(originY + progress + 0.5f);

                uint8_t emberCol = (progress < 6.0f) ? 21 : 20;
                dot(currentX, currentY, emberCol);

                if (progress > 2.0f && progress < dropLifeDist - 3.0f) {
                    dot(currentX, currentY - 1, 20);
                }
            }

            if (pulse > 0.0f) {
                int pr = PFMath::ifloor((float)r + (1.0f - pulse) * 22.0f + 0.5f);
                circle(hx, hy, pr, 21);
            }
        }

        // Magic spell orbit
        if (magic > 0.08f) {
            float radius = 11.0f + magic * 5.0f;
            for (int i = 0; i < 16; ++i) {
                float a = t * (0.6f + magic * 0.4f) + (float)i * (PI / 8.0f);
                int x = PFMath::ifloor(32.0f + PFMath::fastCos(a) * radius + 0.5f);
                int y = PFMath::ifloor((float)(py - 9) + PFMath::fastSin(a) * (radius * 0.38f) + 0.5f);
                if (((float)i * (1.0f / 16.0f)) > magic) continue;
                line(x - 1, y, x + 1, y, 14);
                dot(x, y - 1, 19);
                if (magic > 0.5f) dot(x, y + 1, 15);
            }
        }

        // Passenger character
        box(30, py - 4, 2, 4, 0);
        box(33, py - 4, 2, 4, 0);
        for (int row = 0; row < 9; ++row) {
            int sway = PFMath::ifloor(PFMath::fastSin(t * 3.0f + (float)row * 0.2f) * ((float)row * 0.125f) + 0.5f);
            int rowOffset = PFMath::ifloor((float)row * 0.25f);
            box(31 - rowOffset + sway, py - 12 + row, 4 + PFMath::ifloor((float)row * 0.3f), 1, 16);
            dot(30 - rowOffset + sway, py - 12 + row, 17);
        }

        box(31, py - 15, 3, 2, 0);
        box(30, py - 13, 5, 3, 0);
        box(32, py - 12, 2, 1, 13);
        dot(33, py - 12, 15);

        line(37, py - 13, 36, py - 1, 6);
        dot(37, py - 13, 19);

        for (int x = 23; x <= 41; x += 5) {
            box(x, py - 4, 1, 4, 6);
        }
        box(22, py - 4, 21, 1, 7);

        lamp(20, py - 5, t, 21, 2);
        lamp(44, py - 5, t, 29, 2);

        // 6. Depth particles
        int nParticles = 8 + PFMath::ifloor(magic * 16.0f);
        for (int i = 0; i < nParticles; ++i) {
            int x = 4 + PFMath::ifloor(hashN((uint32_t)(i * 73 + seed)) * 56.0f + 0.5f);
            float pY = PFMath::jsMod(
                PFMath::jsMod(hashN((uint32_t)(i * 127)) * (float)FRAME_H + travel * (0.3f + hashN((uint32_t)i) * 0.7f) - t * 3.0f, (float)FRAME_H) + (float)FRAME_H,
                (float)FRAME_H
            );
            int y = PFMath::ifloor(pY + 0.5f);
            dot(x, y, (i % 4 == 0) ? 19 : 6);
            if (magic > 0.35f && (i % 3 == 0)) {
                dot(x, y + 1, 14);
            }
        }

        // Present framebuffer pixels to display canvas
        for (int y = 0; y < FRAME_H; ++y) {
            int rowOffset = y * FRAME_W;
            for (int x = 0; x < FRAME_W; ++x) {
                int palIdx = pixels[rowOffset + x] * 3;
                PFCanvas::setPixel(x, y, palette[palIdx], palette[palIdx + 1], palette[palIdx + 2]);
            }
        }

        PFCanvas::present();
    }

} // namespace AscenderPattern