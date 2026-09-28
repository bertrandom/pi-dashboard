#pragma once

#include <Arduino.h>
#include <cstring>
#include <cstdio>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_math.h"

namespace Invaders {

const char* NAME = "Space Invaders";
const char* const KNOB_LABELS[4] = {"Reset", "Reset", "Unused", "Move"};

static constexpr int VW = 64;
static constexpr int VH = 128;
static constexpr int OX = 4;
static constexpr int OY = 16;
static constexpr int FIELD_W = 56;
static constexpr int FIELD_H = 100;

static constexpr int COLS = 6;
static constexpr int ROWS = 4;
static constexpr int INV_W = 6;
static constexpr int INV_H = 4;
static constexpr int INV_GAP_X = 2;
static constexpr int INV_GAP_Y = 3;
static constexpr int INV_COUNT = COLS * ROWS;

static constexpr int SHIP_W = 7;
static constexpr int SHIP_H = 4;
static constexpr int SHIP_Y = OY + FIELD_H - 8;

static constexpr int BUNKER_COUNT = 3;
static constexpr int BUNKER_W = 10;
static constexpr int BUNKER_H = 6;
static constexpr int BUNKER_Y = SHIP_Y - 16;
static constexpr int BUNKER_CELLS = BUNKER_COUNT * BUNKER_W * BUNKER_H;

static constexpr int MAX_BULLETS = 16;

struct Invader {
    int16_t x;
    int16_t y;
    uint8_t alive;
    uint8_t rank; // 0 top, 1 mid, 2 bottom
};

struct Bullet {
    float x;
    float y;
    float dy;
    uint8_t friendly;
    uint8_t active;
};

static Invader inv[INV_COUNT];
static Bullet bullets[MAX_BULLETS];
static uint8_t bunkers[BUNKER_CELLS];

static int score = 0;
static int lives = 3;
static int wave = 1;
static bool gameOver = false;

static float shipX = 0.0f;
static float coolT = 0.0f;
static float flash = 0.0f;
static float t = 0.0f;
static float invStepT = 0.0f;
static float invStepEvery = 0.55f;
static float alienShotT = 0.0f;
static int invDir = 1;
static int rngState = 12345;

// 3x5: 0-9 S C O R E :
static constexpr uint8_t FONT3x5[][5] = {
    {7,5,5,5,7}, {2,6,2,2,7}, {7,1,7,4,7}, {7,1,7,1,7}, {5,5,7,1,1},
    {7,4,7,1,7}, {7,4,7,5,7}, {7,1,1,1,1}, {7,5,7,5,7}, {7,5,7,1,7},
    {7,4,7,1,7}, {7,4,4,4,7}, {7,5,5,5,7}, {6,5,6,5,5}, {7,4,7,4,7}, {0,2,0,2,0}
};

static uint32_t invRnd() {
    int32_t x = rngState;
    constexpr int32_t a = 48271;
    constexpr int32_t m = 2147483647;
    constexpr int32_t q = 44488;
    constexpr int32_t r = 3399;
    int32_t tt = a * (x % q) - r * (x / q);
    if (tt <= 0) tt += m;
    rngState = tt;
    return static_cast<uint32_t>(rngState);
}

static float invRndF() {
    return static_cast<float>(invRnd()) / 2147483647.0f;
}

static void mapUV(int u, int v, int& x, int& y) {
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

static void drawTextUV(int u, int v, const char* s, uint8_t r, uint8_t g, uint8_t b) {
    int x = u;
    for (; *s; ++s) {
        const int idx = fontIndex(*s);
        if (idx >= 0) {
            for (int row = 0; row < 5; ++row) {
                const uint8_t bits = FONT3x5[idx][row];
                for (int col = 0; col < 3; ++col) {
                    if (bits & (1 << (2 - col))) {
                        setUV(x + col, v + row, r, g, b);
                    }
                }
            }
        }
        x += 4;
    }
}

static bool invaderPixel(int rank, int lx, int ly) {
    static constexpr uint8_t A[4][6] = {
        {0,1,1,1,1,0},
        {1,1,1,1,1,1},
        {1,0,1,1,0,1},
        {0,1,0,0,1,0}
    };
    static constexpr uint8_t B[4][6] = {
        {0,1,0,0,1,0},
        {1,1,1,1,1,1},
        {1,0,1,1,0,1},
        {1,0,0,0,0,1}
    };
    static constexpr uint8_t C[4][6] = {
        {0,0,1,1,0,0},
        {0,1,1,1,1,0},
        {1,1,1,1,1,1},
        {1,0,1,1,0,1}
    };
    if (lx < 0 || lx >= INV_W || ly < 0 || ly >= INV_H) return false;
    if (rank == 0) return A[ly][lx] != 0;
    if (rank == 1) return B[ly][lx] != 0;
    return C[ly][lx] != 0;
}

static int bunkerIndex(int b, int lx, int ly) {
    return b * BUNKER_W * BUNKER_H + ly * BUNKER_W + lx;
}

static int bunkerX(int b) {
    constexpr int margin = 3;
    const int usable = FIELD_W - margin * 2 - BUNKER_W;
    return OX + margin + (b * usable) / (BUNKER_COUNT - 1);
}

static void clearBullets() {
    for (int i = 0; i < MAX_BULLETS; ++i) bullets[i].active = 0;
}

static int spawnBullet(float x, float y, float dy, bool friendly) {
    for (int i = 0; i < MAX_BULLETS; ++i) {
        if (bullets[i].active) continue;
        bullets[i].active = 1;
        bullets[i].x = x;
        bullets[i].y = y;
        bullets[i].dy = dy;
        bullets[i].friendly = friendly ? 1 : 0;
        return i;
    }
    return -1;
}

static int countPlayerShots() {
    int n = 0;
    for (int i = 0; i < MAX_BULLETS; ++i) {
        if (bullets[i].active && bullets[i].friendly) ++n;
    }
    return n;
}

static int aliveCount() {
    int n = 0;
    for (int i = 0; i < INV_COUNT; ++i) if (inv[i].alive) ++n;
    return n;
}

static void boundsAlive(int& minX, int& maxX, int& maxY) {
    minX = 999;
    maxX = -999;
    maxY = -999;
    for (int i = 0; i < INV_COUNT; ++i) {
        if (!inv[i].alive) continue;
        if (inv[i].x < minX) minX = inv[i].x;
        if (inv[i].x + INV_W > maxX) maxX = inv[i].x + INV_W;
        if (inv[i].y + INV_H > maxY) maxY = inv[i].y + INV_H;
    }
}

static void resetWave() {
    const int gridW = COLS * (INV_W + INV_GAP_X) - INV_GAP_X;
    const int startX = OX + (FIELD_W - gridW) / 2;
    const int startY = OY + 6;

    for (int r = 0; r < ROWS; ++r) {
        for (int c = 0; c < COLS; ++c) {
            const int i = r * COLS + c;
            inv[i].x = static_cast<int16_t>(startX + c * (INV_W + INV_GAP_X));
            inv[i].y = static_cast<int16_t>(startY + r * (INV_H + INV_GAP_Y));
            inv[i].alive = 1;
            inv[i].rank = (r < 1) ? 0 : ((r < 3) ? 1 : 2);
        }
    }

    invDir = 1;
    invStepT = 0.0f;
    invStepEvery = fmaxf(0.18f, 0.55f - (wave - 1) * 0.06f);
}

static void resetBunkers() {
    memset(bunkers, 1, sizeof(bunkers));
}

static void resetGame() {
    score = 0;
    lives = 3;
    wave = 1;
    gameOver = false;
    shipX = OX + FIELD_W * 0.5f;
    coolT = 0.0f;
    flash = 0.0f;
    t = 0.0f;
    alienShotT = 0.0f;
    clearBullets();
    resetWave();
    resetBunkers();
}

static bool hitBunker(int ix, int iy) {
    for (int b = 0; b < BUNKER_COUNT; ++b) {
        const int bx = bunkerX(b);
        if (ix >= bx && ix < bx + BUNKER_W &&
            iy >= BUNKER_Y && iy < BUNKER_Y + BUNKER_H) {
            const int lx = ix - bx;
            const int ly = iy - BUNKER_Y;
            const int idx = bunkerIndex(b, lx, ly);
            if (!bunkers[idx]) continue;

            bunkers[idx] = 0;
            if (lx + 1 < BUNKER_W) bunkers[bunkerIndex(b, lx + 1, ly)] = 0;
            if (ly + 1 < BUNKER_H) bunkers[bunkerIndex(b, lx, ly + 1)] = 0;
            return true;
        }
    }
    return false;
}

static void killPlayer() {
    --lives;
    flash = 1.0f;
    for (int i = 0; i < MAX_BULLETS; ++i) {
        if (bullets[i].active && bullets[i].friendly) bullets[i].active = 0;
    }
    shipX = OX + FIELD_W * 0.5f;
    coolT = 0.6f;
    if (lives <= 0) gameOver = true;
}

static int moveTicks(float delta) {
    if (fabsf(delta) < 0.12f) return 0;
    const int n = static_cast<int>(fabsf(delta) + 0.5f);
    return n < 1 ? 1 : n;
}

void setup() {
    PFMath::buildSinLUT();
    rngState = 12345;
    resetGame();
}

void update(float dt, const InputFrame& input) {
    // Knobs 1 & 2 click = restart
    if (input.btnPressed[0] || input.btnPressed[1]) {
        resetGame();
        return;
    }

    t += dt;
    if (t > 20.0f * PI) t -= 20.0f * PI;
    flash = fmaxf(0.0f, flash - dt * 2.5f);
    coolT = fmaxf(0.0f, coolT - dt);

    if (gameOver) return;

    // Knob 4 turn = move
    if (input.knobDeltas[3] < -0.1f) {
        shipX -= static_cast<float>(moveTicks(input.knobDeltas[3])) * 2.0f;
    } else if (input.knobDeltas[3] > 0.1f) {
        shipX += static_cast<float>(moveTicks(input.knobDeltas[3])) * 2.0f;
    }
    shipX = fminf(
        static_cast<float>(OX + FIELD_W) - SHIP_W * 0.5f,
        fmaxf(static_cast<float>(OX) + SHIP_W * 0.5f, shipX)
    );

    // Knob 4 click = shoot
    if (input.btnPressed[3] && coolT <= 0.0f && countPlayerShots() < 1) {
        spawnBullet(shipX, static_cast<float>(SHIP_Y - 1), -70.0f, true);
        coolT = 0.22f;
    }

    int alive = aliveCount();
    if (alive == 0) {
        ++wave;
        resetWave();
        flash = fmaxf(flash, 0.8f);
        alive = aliveCount();
    }

    // Invader step
    invStepEvery = fmaxf(
        0.16f,
        0.55f - static_cast<float>(INV_COUNT - alive) * 0.012f - static_cast<float>(wave - 1) * 0.05f
    );
    invStepT += dt;
    if (invStepT >= invStepEvery) {
        invStepT = 0.0f;

        int minX, maxX, maxY;
        boundsAlive(minX, maxX, maxY);

        constexpr int step = 2;
        constexpr int leftLimit = OX;
        constexpr int rightLimit = OX + FIELD_W;

        bool doDrop = false;
        if (invDir > 0 && maxX + step > rightLimit) doDrop = true;
        if (invDir < 0 && minX - step < leftLimit) doDrop = true;

        for (int i = 0; i < INV_COUNT; ++i) {
            if (!inv[i].alive) continue;
            if (doDrop) inv[i].y = static_cast<int16_t>(inv[i].y + 3);
            else inv[i].x = static_cast<int16_t>(inv[i].x + invDir * step);
        }
        if (doDrop) invDir = -invDir;

        boundsAlive(minX, maxX, maxY);
        if (maxY >= SHIP_Y - 2) {
            gameOver = true;
            flash = 1.0f;
        }
    }

    // Alien shots
    alienShotT -= dt;
    if (alienShotT <= 0.0f && alive > 0) {
        alienShotT = 0.55f + invRndF() * 0.7f;

        const int col = static_cast<int>(invRnd() % static_cast<uint32_t>(COLS));
        Invader* shooter = nullptr;

        for (int r = ROWS - 1; r >= 0; --r) {
            Invader& cand = inv[r * COLS + col];
            if (cand.alive) { shooter = &cand; break; }
        }
        if (!shooter) {
            for (int i = INV_COUNT - 1; i >= 0; --i) {
                if (inv[i].alive) { shooter = &inv[i]; break; }
            }
        }
        if (shooter) {
            spawnBullet(
                shooter->x + INV_W * 0.5f,
                shooter->y + INV_H,
                42.0f + wave * 3.0f,
                false
            );
        }
    }

    // Bullets
    for (int i = 0; i < MAX_BULLETS; ++i) {
        if (!bullets[i].active) continue;

        bullets[i].y += bullets[i].dy * dt;
        const int bx = static_cast<int>(bullets[i].x);
        const int by = static_cast<int>(bullets[i].y);

        if (by < OY - 2 || by > OY + FIELD_H + 4) {
            bullets[i].active = 0;
            continue;
        }

        if (hitBunker(bx, by)) {
            bullets[i].active = 0;
            continue;
        }

        if (bullets[i].friendly) {
            bool hit = false;
            for (int j = 0; j < INV_COUNT; ++j) {
                if (!inv[j].alive) continue;
                if (bx >= inv[j].x && bx < inv[j].x + INV_W &&
                    by >= inv[j].y && by < inv[j].y + INV_H) {
                    inv[j].alive = 0;
                    score += (inv[j].rank == 0) ? 3 : ((inv[j].rank == 1) ? 2 : 1);
                    flash = fmaxf(flash, 0.35f);
                    hit = true;
                    break;
                }
            }
            if (hit) bullets[i].active = 0;
        } else {
            if (by >= SHIP_Y && by <= SHIP_Y + SHIP_H &&
                fabsf(bullets[i].x - shipX) < SHIP_W * 0.5f) {
                bullets[i].active = 0;
                killPlayer();
            }
        }
    }
}

void draw() {
    for (int y = 0; y < PANEL_RES_H; ++y) {
        for (int x = 0; x < PANEL_RES_W; ++x) {
            const int u = y;
            const int v = PANEL_RES_W - 1 - x;

            uint8_t r = 2, g = 2, b = 8;
            if ((u * 13 + v * 7) % 47 == 0) {
                r = 40; g = 40; b = 70;
            }

            if (flash > 0.0f) {
                r = static_cast<uint8_t>(fminf(255.0f, r + flash * 50.0f));
                g = static_cast<uint8_t>(fminf(255.0f, g + flash * 30.0f));
                b = static_cast<uint8_t>(fminf(255.0f, b + flash * 30.0f));
            }

            if (u >= OX - 1 && u <= OX + FIELD_W &&
                v >= OY - 1 && v <= OY + FIELD_H) {
                if (u == OX - 1 || u == OX + FIELD_W ||
                    v == OY - 1 || v == OY + FIELD_H) {
                    r = 30; g = 60; b = 40;
                }
            }

            PFCanvas::setPixel(x, y, r, g, b);
        }
    }

    // Bunkers
    for (int bi = 0; bi < BUNKER_COUNT; ++bi) {
        const int bx = bunkerX(bi);
        for (int ly = 0; ly < BUNKER_H; ++ly) {
            for (int lx = 0; lx < BUNKER_W; ++lx) {
                if (!bunkers[bunkerIndex(bi, lx, ly)]) continue;
                if (ly == 0 && (lx < 2 || lx >= BUNKER_W - 2)) continue;
                if (ly >= BUNKER_H - 2 && lx >= 3 && lx <= 6) continue;
                setUV(bx + lx, BUNKER_Y + ly, 40, 200, 70);
            }
        }
    }

    // Invaders
    for (int i = 0; i < INV_COUNT; ++i) {
        if (!inv[i].alive) continue;
        uint8_t rr, gg, bb;
        if (inv[i].rank == 0) { rr = 255; gg = 80; bb = 180; }
        else if (inv[i].rank == 1) { rr = 80; gg = 220; bb = 255; }
        else { rr = 120; gg = 255; bb = 120; }

        for (int ly = 0; ly < INV_H; ++ly) {
            for (int lx = 0; lx < INV_W; ++lx) {
                if (invaderPixel(inv[i].rank, lx, ly)) {
                    setUV(inv[i].x + lx, inv[i].y + ly, rr, gg, bb);
                }
            }
        }
    }

    // Ship
    if (!gameOver) {
        const int sx = static_cast<int>(shipX - SHIP_W * 0.5f);
        for (int ly = 0; ly < SHIP_H; ++ly) {
            for (int lx = 0; lx < SHIP_W; ++lx) {
                const int mid = abs(lx - 3);
                if (ly == 0 && mid > 0) continue;
                if (ly == 1 && mid > 2) continue;
                setUV(sx + lx, SHIP_Y + ly, 240, 240, 80);
            }
        }
    }

    // Bullets
    for (int i = 0; i < MAX_BULLETS; ++i) {
        if (!bullets[i].active) continue;
        const int bx = static_cast<int>(bullets[i].x);
        const int by = static_cast<int>(bullets[i].y);
        if (bullets[i].friendly) {
            setUV(bx, by, 255, 255, 180);
        } else {
            setUV(bx, by, 255, 60, 60);
            setUV(bx, by + 1, 255, 60, 60);
        }
    }

    // Score
    char buf[24];
    const char* prefix = "SCORE:";
    int i = 0;
    while (prefix[i]) {
        buf[i] = prefix[i];
        ++i;
    }

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
    while (nd > 0) buf[i++] = digits[--nd];
    buf[i] = '\0';

    drawTextUV(OX, 4, buf, 180, 220, 255);

    // Lives
    for (int i = 0; i < lives; ++i) {
        const int lx = OX + FIELD_W - 8 - i * 8;
        setUV(lx + 2, OY + FIELD_H + 4, 240, 240, 80);
        setUV(lx + 1, OY + FIELD_H + 5, 240, 240, 80);
        setUV(lx + 2, OY + FIELD_H + 5, 240, 240, 80);
        setUV(lx + 3, OY + FIELD_H + 5, 240, 240, 80);
    }

    if (gameOver) {
        const float pulse = 0.4f + 0.4f * PFMath::fastSin(t * 6.0f);
        const uint8_t rr = static_cast<uint8_t>(255.0f * pulse);
        for (int x = OX; x < OX + FIELD_W; ++x) {
            setUV(x, OY + FIELD_H / 2, rr, 40, 40);
        }
    }

    PFCanvas::present();
}

} // namespace Invaders