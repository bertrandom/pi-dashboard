#pragma once

// ===== Patternflow pattern =====
// Title:    Tetris
// Author:   @akacoda
// Date:     2026-08-06
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_math.h"

namespace Tetris {

const char* NAME = "Tetris";
const char* const KNOB_LABELS[4] = {"Reset", "Reset", "Rotate", "Move"};

static constexpr int TETRIS_COLS = 10;
static constexpr int TETRIS_ROWS = 20;
static constexpr int TETRIS_CELL = 4;
static constexpr int TETRIS_BOARD_W = TETRIS_COLS * TETRIS_CELL;
static constexpr int TETRIS_BOARD_H = TETRIS_ROWS * TETRIS_CELL;
static constexpr int TETRIS_OX = 12;
static constexpr int TETRIS_OY = 24;

static constexpr uint8_t TETRIS_SHAPES[7][4][16] = {
    {
        {0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0},
        {0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0},
        {0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0},
        {0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0}
    },
    {
        {0,1,1,0,0,1,1,0,0,0,0,0,0,0,0,0},
        {0,1,1,0,0,1,1,0,0,0,0,0,0,0,0,0},
        {0,1,1,0,0,1,1,0,0,0,0,0,0,0,0,0},
        {0,1,1,0,0,1,1,0,0,0,0,0,0,0,0,0}
    },
    {
        {0,1,0,0,1,1,1,0,0,0,0,0,0,0,0,0},
        {0,1,0,0,0,1,1,0,0,1,0,0,0,0,0,0},
        {0,0,0,0,1,1,1,0,0,1,0,0,0,0,0,0},
        {0,1,0,0,1,1,0,0,0,1,0,0,0,0,0,0}
    },
    {
        {0,1,1,0,1,1,0,0,0,0,0,0,0,0,0,0},
        {0,1,0,0,0,1,1,0,0,0,1,0,0,0,0,0},
        {0,0,0,0,0,1,1,0,1,1,0,0,0,0,0,0},
        {1,0,0,0,1,1,0,0,0,1,0,0,0,0,0,0}
    },
    {
        {1,1,0,0,0,1,1,0,0,0,0,0,0,0,0,0},
        {0,0,1,0,0,1,1,0,0,1,0,0,0,0,0,0},
        {0,0,0,0,1,1,0,0,0,1,1,0,0,0,0,0},
        {0,1,0,0,1,1,0,0,1,0,0,0,0,0,0,0}
    },
    {
        {1,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0},
        {0,1,1,0,0,1,0,0,0,1,0,0,0,0,0,0},
        {0,0,0,0,1,1,1,0,0,0,1,0,0,0,0,0},
        {0,1,0,0,0,1,0,0,1,1,0,0,0,0,0,0}
    },
    {
        {0,0,1,0,1,1,1,0,0,0,0,0,0,0,0,0},
        {0,1,0,0,0,1,0,0,0,1,1,0,0,0,0,0},
        {0,0,0,0,1,1,1,0,1,0,0,0,0,0,0,0},
        {1,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0}
    }
};

static constexpr uint8_t TETRIS_TYPE_RGB[8][3] = {
    {0,0,0},
    {0,240,240},
    {240,240,0},
    {160,0,240},
    {0,240,0},
    {240,0,0},
    {0,0,240},
    {240,160,0}
};

// 3x5 font: 0-9, S, C, O, R, E, :
// bit2 = left pixel. R uses {6,5,6,4,5} so it reads as R, not B.
static constexpr uint8_t FONT3x5[][5] = {
    {7,5,5,5,7}, {2,6,2,2,7}, {7,1,7,4,7}, {7,1,7,1,7}, {5,5,7,1,1},
    {7,4,7,1,7}, {7,4,7,5,7}, {7,1,1,1,1}, {7,5,7,5,7}, {7,5,7,1,7},
    {7,4,7,1,7}, {7,4,4,4,7}, {7,5,5,5,7}, {6,5,6,4,5}, {7,4,7,4,7}, {0,2,0,2,0}
};

static uint8_t grid[TETRIS_COLS * TETRIS_ROWS];
static uint8_t bag[7];
static int bagN = 0;
static int32_t rngState = 12345;

static int pType = 0;
static int pRot = 0;
static int pX = 3;
static int pY = -1;
static int nextPiece = 0;

static int score = 0;
static int lines = 0;
static int level = 1;
static int startLevel = 1;
static bool gameOver = false;

static float gravityMul = 0.8f;
static float ghostK = 0.7f;
static float fallT = 0.0f;
static float lockT = 0.0f;
static float flash = 0.0f;
static float t = 0.0f;
static float resetHoldT = 0.0f;

static float tetrisClamp(float v, float a, float b) {
    return fmaxf(a, fminf(b, v));
}

static uint32_t tetrisRnd() {
    int32_t x = rngState;
    constexpr int32_t a = 48271;
    constexpr int32_t m = 2147483647;
    constexpr int32_t q = 44488;
    constexpr int32_t r = 3399;

    int32_t nt = a * (x % q) - r * (x / q);
    if (nt <= 0) nt += m;
    rngState = nt;
    return static_cast<uint32_t>(rngState);
}

static bool shapeCell(int type, int rot, int cx, int cy) {
    return TETRIS_SHAPES[type][rot & 3][cy * 4 + cx] != 0;
}

static bool collides(int type, int rot, int px, int py) {
    for (int cy = 0; cy < 4; ++cy) {
        for (int cx = 0; cx < 4; ++cx) {
            if (!shapeCell(type, rot, cx, cy)) continue;

            const int x = px + cx;
            const int y = py + cy;

            if (x < 0 || x >= TETRIS_COLS || y >= TETRIS_ROWS) return true;
            if (y >= 0 && grid[y * TETRIS_COLS + x]) return true;
        }
    }
    return false;
}

static void lockPiece() {
    for (int cy = 0; cy < 4; ++cy) {
        for (int cx = 0; cx < 4; ++cx) {
            if (!shapeCell(pType, pRot, cx, cy)) continue;

            const int x = pX + cx;
            const int y = pY + cy;

            if (y >= 0 && y < TETRIS_ROWS && x >= 0 && x < TETRIS_COLS) {
                grid[y * TETRIS_COLS + x] = static_cast<uint8_t>(pType + 1);
            }
        }
    }
}

static void clearLines() {
    int cleared = 0;

    for (int y = TETRIS_ROWS - 1; y >= 0; --y) {
        bool full = true;
        for (int x = 0; x < TETRIS_COLS; ++x) {
            if (!grid[y * TETRIS_COLS + x]) {
                full = false;
                break;
            }
        }

        if (full) {
            ++cleared;
            for (int yy = y; yy > 0; --yy) {
                for (int x = 0; x < TETRIS_COLS; ++x) {
                    grid[yy * TETRIS_COLS + x] = grid[(yy - 1) * TETRIS_COLS + x];
                }
            }
            for (int x = 0; x < TETRIS_COLS; ++x) grid[x] = 0;
            ++y;
        }
    }

    if (cleared) {
        score += cleared;
        lines += cleared;
        level = lines / 10 + startLevel;
        flash = 1.0f;
    }
}

static int nextType() {
    if (bagN <= 0) {
        for (int i = 0; i < 7; ++i) bag[i] = static_cast<uint8_t>(i);
        for (int i = 6; i > 0; --i) {
            const int j = static_cast<int>(tetrisRnd() % static_cast<uint32_t>(i + 1));
            const uint8_t tmp = bag[i];
            bag[i] = bag[j];
            bag[j] = tmp;
        }
        bagN = 7;
    }
    return bag[--bagN];
}

static void spawn() {
    pType = nextPiece;
    nextPiece = nextType();
    pRot = 0;
    pX = 3;
    pY = -1;
    fallT = 0.0f;
    lockT = 0.0f;

    if (collides(pType, pRot, pX, pY)) {
        gameOver = true;
    }
}

static int hardDropY() {
    int y = pY;
    while (!collides(pType, pRot, pX, y + 1)) ++y;
    return y;
}

static bool tryMove(int dx, int dy) {
    if (!collides(pType, pRot, pX + dx, pY + dy)) {
        pX += dx;
        pY += dy;
        lockT = 0.0f;
        return true;
    }
    return false;
}

static bool tryRot(int dir) {
    const int nr = (pRot + dir + 4) & 3;
    static constexpr int kicks[5] = {0, -1, 1, -2, 2};

    for (int i = 0; i < 5; ++i) {
        const int kx = kicks[i];
        if (!collides(pType, nr, pX + kx, pY)) {
            pRot = nr;
            pX += kx;
            lockT = 0.0f;
            return true;
        }
    }
    return false;
}

static void resetGame() {
    memset(grid, 0, sizeof(grid));
    score = 0;
    lines = 0;
    level = startLevel;
    gameOver = false;
    bagN = 0;
    nextPiece = nextType();
    spawn();
    flash = 1.0f;
    resetHoldT = 0.0f;
}

static float gravityInterval() {
    const float base = fmaxf(0.08f, 0.75f - (level - 1) * 0.04f);
    return base / fmaxf(0.3f, gravityMul);
}

static int ticksFromDelta(float delta) {
    if (fabsf(delta) < 0.1f) return 0;
    const int n = static_cast<int>(fabsf(delta) + 0.5f);
    return n < 1 ? 1 : n;
}

static void mapUV(int u, int v, int& x, int& y) {
    // JS logical canvas is 64x128 portrait; Patternflow panel is 128x64.
    x = PANEL_RES_W - 1 - v;
    y = u;
}

static void setUV(int u, int v, uint8_t r, uint8_t g, uint8_t b) {
    int x, y;
    mapUV(u, v, x, y);
    if (x >= 0 && x < PANEL_RES_W && y >= 0 && y < PANEL_RES_H) {
        PFCanvas::setPixel(x, y, r, g, b);
    }
}

static uint8_t scaleChannel(uint8_t value, float mul) {
    return static_cast<uint8_t>(tetrisClamp(value * mul, 0.0f, 255.0f));
}

static void paintType(int type, int rot, int px, int py, float mul) {
    const uint8_t* base = TETRIS_TYPE_RGB[type + 1];

    for (int cy = 0; cy < 4; ++cy) {
        for (int cx = 0; cx < 4; ++cx) {
            if (!shapeCell(type, rot, cx, cy)) continue;

            const int bx = px + cx;
            const int by = py + cy;
            if (by < 0) continue;

            for (int ly = 0; ly < TETRIS_CELL; ++ly) {
                for (int lx = 0; lx < TETRIS_CELL; ++lx) {
                    const bool border = (lx == 0 || ly == 0);
                    const float brightness = mul * (border ? 0.55f : 1.0f);
                    setUV(
                        TETRIS_OX + bx * TETRIS_CELL + lx,
                        TETRIS_OY + by * TETRIS_CELL + ly,
                        scaleChannel(base[0], brightness),
                        scaleChannel(base[1], brightness),
                        scaleChannel(base[2], brightness)
                    );
                }
            }
        }
    }
}

static int fontIndex(char c) {
    if (c >= '0' && c <= '9') return c - '0';
    if (c == 'S') return 10;
    if (c == 'C') return 11;
    if (c == 'O') return 12;
    if (c == 'R') return 13;
    if (c == 'E') return 14;
    if (c == ':') return 15;
    return -1;
}

static void drawCharUV(int u, int v, char c, uint8_t r, uint8_t g, uint8_t b) {
    const int idx = fontIndex(c);
    if (idx < 0) return;

    for (int row = 0; row < 5; ++row) {
        const uint8_t bits = FONT3x5[idx][row];
        for (int col = 0; col < 3; ++col) {
            if (bits & (1 << (2 - col))) {
                setUV(u + col, v + row, r, g, b);
            }
        }
    }
}

static void formatScore(char* buf, int n) {
    static const char prefix[] = {'S','C','O','R','E',':'};
    int i = 0;
    for (; i < 6 && i < n - 1; ++i) buf[i] = prefix[i];

    int s = score;
    if (s < 0) s = 0;

    char digits[12];
    int nd = 0;
    if (s == 0) {
        digits[nd++] = '0';
    } else {
        while (s > 0 && nd < 11) {
            digits[nd++] = static_cast<char>('0' + (s % 10));
            s /= 10;
        }
    }

    while (nd > 0 && i < n - 1) buf[i++] = digits[--nd];
    buf[i] = 0;
}

static void drawScore() {
    char buf[24];
    formatScore(buf, static_cast<int>(sizeof(buf)));

    int len = 0;
    while (buf[len]) ++len;

    const int scale = 1;
    const int textW = len * (3 * scale + scale) - scale;
    int tu = TETRIS_OX + (TETRIS_BOARD_W - textW) / 2;
    const int tv = TETRIS_OY + TETRIS_BOARD_H + 4;

    for (int i = 0; i < len; ++i) {
        drawCharUV(tu, tv, buf[i], 180, 220, 255);
        tu += 3 * scale + scale;
    }
}

void setup() {
    PFMath::buildSinLUT();

    rngState = 12345;
    bagN = 0;
    startLevel = 1;
    gravityMul = 0.8f;
    ghostK = 0.7f;
    fallT = 0.0f;
    lockT = 0.0f;
    flash = 0.0f;
    t = 0.0f;
    resetHoldT = 0.0f;

    resetGame();
}

void update(float dt, const InputFrame& input) {
    // Knobs 1 & 2: short press resets in Lab; hold ~0.8s resets on device
    if (input.btnPressed[0] || input.btnPressed[1]) {
        resetGame();
        return;
    }

    const bool resetHeld = (input.btnHeld[0] || input.btnHeld[1]);
    if (resetHeld) {
        resetHoldT += dt;
        if (resetHoldT >= 0.8f) {
            resetGame();
            resetHoldT = 0.0f;
            return;
        }
    } else {
        resetHoldT = 0.0f;
    }

    if (gameOver) {
        flash = fmaxf(0.0f, flash - dt * 2.0f);
        t += dt;
        if (t > TWO_PI) t -= TWO_PI;
        return;
    }

    // Knob 4 [3]: move
    if (input.knobDeltas[3] < -0.1f) {
        const int n = ticksFromDelta(input.knobDeltas[3]);
        for (int i = 0; i < n; ++i) tryMove(-1, 0);
    } else if (input.knobDeltas[3] > 0.1f) {
        const int n = ticksFromDelta(input.knobDeltas[3]);
        for (int i = 0; i < n; ++i) tryMove(1, 0);
    }

    // Knob 3 [2]: rotate
    if (input.knobDeltas[2] < -0.1f) {
        const int n = ticksFromDelta(input.knobDeltas[2]);
        for (int i = 0; i < n; ++i) tryRot(-1);
    } else if (input.knobDeltas[2] > 0.1f) {
        const int n = ticksFromDelta(input.knobDeltas[2]);
        for (int i = 0; i < n; ++i) tryRot(1);
    }

    // Knob 4 click: hard drop
    if (input.btnPressed[3]) {
        pY = hardDropY();
        lockPiece();
        clearLines();
        spawn();
        flash = fmaxf(flash, 0.6f);
    }

    fallT += dt;
    const float interval = gravityInterval();
    while (fallT >= interval) {
        fallT -= interval;
        if (!tryMove(0, 1)) {
            lockT += interval;
            if (lockT > 0.45f) {
                lockPiece();
                clearLines();
                spawn();
            }
            break;
        } else {
            lockT = 0.0f;
        }
    }

    flash = fmaxf(0.0f, flash - dt * 2.5f);
    t += dt;
    if (t > TWO_PI) t -= TWO_PI;
}

void draw() {
    const int ghostY = hardDropY();

    for (int y = 0; y < PANEL_RES_H; ++y) {
        for (int x = 0; x < PANEL_RES_W; ++x) {
            const int u = y;
            const int v = PANEL_RES_W - 1 - x;

            uint8_t r = 4;
            uint8_t g = 6;
            uint8_t b = 14;

            if (((v + u) & 1) == 0) {
                r = 6;
                g = 8;
                b = 18;
            }

            if (flash > 0.0f) {
                r = static_cast<uint8_t>(tetrisClamp(r + flash * 40.0f, 0.0f, 255.0f));
                g = static_cast<uint8_t>(tetrisClamp(g + flash * 40.0f, 0.0f, 255.0f));
                b = static_cast<uint8_t>(tetrisClamp(b + flash * 50.0f, 0.0f, 255.0f));
            }

            if (u >= TETRIS_OX - 2 &&
                u < TETRIS_OX + TETRIS_BOARD_W + 2 &&
                v >= TETRIS_OY - 2 &&
                v < TETRIS_OY + TETRIS_BOARD_H + 2) {
                const bool inside =
                    u >= TETRIS_OX &&
                    u < TETRIS_OX + TETRIS_BOARD_W &&
                    v >= TETRIS_OY &&
                    v < TETRIS_OY + TETRIS_BOARD_H;
                if (!inside) {
                    r = 40;
                    g = 48;
                    b = 70;
                }
            }

            if (u >= TETRIS_OX &&
                u < TETRIS_OX + TETRIS_BOARD_W &&
                v >= TETRIS_OY &&
                v < TETRIS_OY + TETRIS_BOARD_H) {
                const int cx = (u - TETRIS_OX) / TETRIS_CELL;
                const int cy = (v - TETRIS_OY) / TETRIS_CELL;
                const uint8_t id = grid[cy * TETRIS_COLS + cx];

                if (id) {
                    const int lu = (u - TETRIS_OX) % TETRIS_CELL;
                    const int lv = (v - TETRIS_OY) % TETRIS_CELL;
                    const bool border = (lu == 0 || lv == 0);
                    const float mul = border ? 0.55f : 1.0f;
                    r = scaleChannel(TETRIS_TYPE_RGB[id][0], mul);
                    g = scaleChannel(TETRIS_TYPE_RGB[id][1], mul);
                    b = scaleChannel(TETRIS_TYPE_RGB[id][2], mul);
                } else {
                    r = 8;
                    g = 10;
                    b = 22;
                }
            }

            PFCanvas::setPixel(x, y, r, g, b);
        }
    }

    if (!gameOver && ghostK > 0.05f) {
        paintType(pType, pRot, pX, ghostY, 0.15f + ghostK * 0.35f);
    }
    if (!gameOver) {
        paintType(pType, pRot, pX, pY, 1.0f);
    }

    // NEXT preview
    for (int cy = 0; cy < 4; ++cy) {
        for (int cx = 0; cx < 4; ++cx) {
            if (!shapeCell(nextPiece, 0, cx, cy)) continue;
            const uint8_t* rgb = TETRIS_TYPE_RGB[nextPiece + 1];
            setUV(2 + cx * 2, 4 + cy * 2, rgb[0], rgb[1], rgb[2]);
        }
    }

    drawScore();

    if (gameOver) {
        const float pulse = 0.4f + 0.4f * PFMath::fastSin(t * 6.0f);
        const uint8_t rr = static_cast<uint8_t>(255.0f * pulse);
        for (int x = TETRIS_OX; x < TETRIS_OX + TETRIS_BOARD_W; ++x) {
            setUV(x, TETRIS_OY + TETRIS_BOARD_H / 2, rr, 40, 40);
        }
    }

    PFCanvas::present();
}

} // namespace Tetris