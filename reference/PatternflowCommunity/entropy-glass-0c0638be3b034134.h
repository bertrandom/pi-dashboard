#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_params.h"
#include "src/core_math.h"
#include "src/core_mem.h"

namespace EntropyGlass {

const char* NAME = "Entropy Glass";
const char* const KNOB_LABELS[4] = {"Neck", "Demon", "Gravity", "Blind"};
constexpr bool ABSOLUTE_READY = true;

constexpr int FRAME_W = 64;
constexpr int FRAME_H = 128;
constexpr int TOTAL_PIXELS = FRAME_W * FRAME_H;

constexpr uint8_t EG_FLOW = 0;
constexpr uint8_t EG_REST = 1;
constexpr uint8_t EG_TURN = 2;

const uint8_t EG_SAND[8][3] = {
    {0, 0, 0},
    {255, 240, 205}, // ivory
    {255, 176, 0},   // saffron
    {255, 78, 52},   // coral
    {255, 40, 140},  // magenta
    {170, 60, 255},  // violet
    {40, 90, 255},   // cobalt
    {0, 205, 190}    // teal
};

const float EG_BLIND[3] = {230.0f, 196.0f, 140.0f};

// Knob parameters
static float knobNeck = 1.0f;
static float knobDemon = 0.0f;
static float knobGravity = 1.0f;
static float knobBlind = 1.0f;

// Framebuffer-scale buffers
static float* memPool = nullptr;
static uint8_t* openMask = nullptr;
static uint8_t* glassMask = nullptr;
static uint8_t* frameMask = nullptr;
static uint8_t* cells = nullptr;
static uint8_t* spark = nullptr;

static int builtNeck = -1;
static uint8_t phase = EG_FLOW;
static float phaseT = 0.0f;
static int tick = 0;
static int sortParity = 0;
static float stepAcc = 0.0f;
static float sortAcc = 0.0f;
static int sortBudget = 0;
static bool sorted = false;
static bool turnNow = false;
static bool pourNow = false;

// 1~2 cycle Xorshift32 PRNG (replaces slow esp_random)
static inline uint32_t fastRand() {
    static uint32_t rngState = 0x8a5b3c1d;
    rngState ^= rngState << 13;
    rngState ^= rngState >> 17;
    rngState ^= rngState << 5;
    return rngState;
}

inline float egSmooth(float a, float b, float v) {
    float t = PFMath::clamp01((v - a) / (b - a));
    return t * t * (3.0f - 2.0f * t);
}

void egBuild(int neck) {
    memset(openMask, 0, TOTAL_PIXELS);
    memset(glassMask, 0, TOTAL_PIXELS);
    memset(frameMask, 0, TOTAL_PIXELS);

    constexpr int cap = (FRAME_H * 0.03f + 0.5f) < 3.0f ? 3 : (int)(FRAME_H * 0.03f + 0.5f);
    constexpr float mid = FRAME_H * 0.5f;
    constexpr float len = mid - (float)cap - 1.0f;
    constexpr int widest = (FRAME_W >> 1) - 6;

    for (int y = cap + 1; y < FRAME_H - cap - 1; y++) {
        float t = fabsf((float)y + 0.5f - mid) / len;
        float bulb = egSmooth(0.03f, 0.75f, t) * (1.0f - 0.28f * egSmooth(0.8f, 1.02f, t));
        int half = (int)(neck + (widest - neck) * bulb + 0.5f);
        if (half < neck) half = neck;
        int x0 = (FRAME_W >> 1) - half;
        int x1 = (FRAME_W >> 1) + half;
        for (int x = x0; x < x1; x++) {
            openMask[y * FRAME_W + x] = 1;
        }
    }

    for (int y = 0; y < FRAME_H; y++) {
        for (int x = 0; x < FRAME_W; x++) {
            int i = y * FRAME_W + x;
            if (openMask[i]) continue;

            bool nearOpen = false;
            for (int dy = -1; dy <= 1 && !nearOpen; dy++) {
                for (int dx = -1; dx <= 1; dx++) {
                    int xx = x + dx;
                    int yy = y + dy;
                    if (xx >= 0 && xx < FRAME_W && yy >= 0 && yy < FRAME_H && openMask[yy * FRAME_W + xx]) {
                        nearOpen = true;
                        break;
                    }
                }
            }
            if (nearOpen) glassMask[i] = 1;

            if (y < cap || y >= FRAME_H - cap) {
                if (x >= 1 && x < FRAME_W - 1) {
                    frameMask[i] = (y == 0 || y == FRAME_H - cap) ? 2 : 1;
                }
            } else if (x == 1 || x == 2 || x == FRAME_W - 3 || x == FRAME_W - 2) {
                frameMask[i] = (x == 1 || x == FRAME_W - 3) ? 4 : 3;
            }
        }
    }
    builtNeck = neck;
}

void egPour() {
    memset(cells, 0, TOTAL_PIXELS);
    int capacity = 0;
    for (int i = 0; i < (FRAME_H >> 1) * FRAME_W; i++) {
        capacity += openMask[i];
    }
    int total = (int)((float)capacity * 0.62f);
    int placed = 0;

    for (int y = (FRAME_H >> 1) - 1; y >= 0 && placed < total; y--) {
        for (int x = 0; x < FRAME_W && placed < total; x++) {
            int i = y * FRAME_W + x;
            if (!openMask[i]) continue;
            int bandIdx = total > 0 ? (placed * 7) / total : 0;
            if (bandIdx > 6) bandIdx = 6;
            int band = 7 - bandIdx;
            int shade = (int)(fastRand() & 31);
            cells[i] = (uint8_t)(band | (shade << 3));
            placed++;
        }
    }
    phase = EG_FLOW;
    phaseT = 0.0f;
}

int egFall() {
    int moves = 0;
    tick = (tick + 1) & 1;

    // Skip upper and lower decorative cap margins
    constexpr int startY = FRAME_H - 5;
    constexpr int endY = 4;

    for (int y = startY; y >= endY; y--) {
        bool ltr = ((y + tick) & 1) == 0;
        int rowIdx = y * FRAME_W;
        for (int n = 0; n < FRAME_W; n++) {
            int x = ltr ? n : FRAME_W - 1 - n;
            int i = rowIdx + x;
            uint8_t c = cells[i];
            if (!c) continue;

            int below = i + FRAME_W;
            if (openMask[below] && !cells[below]) {
                cells[below] = c;
                cells[i] = 0;
                moves++;
                continue;
            }

            int d = (fastRand() & 1) ? 1 : -1;
            int x1 = x + d;
            if (x1 >= 0 && x1 < FRAME_W && openMask[below + d] && !cells[below + d]) {
                cells[below + d] = c;
                cells[i] = 0;
                moves++;
                continue;
            }

            int x2 = x - d;
            if (x2 >= 0 && x2 < FRAME_W && openMask[below - d] && !cells[below - d]) {
                cells[below - d] = c;
                cells[i] = 0;
                moves++;
            }
        }
    }
    return moves;
}

int egSort() {
    int swaps = 0;
    sortParity ^= 1;
    for (int y = sortParity; y < FRAME_H - 1; y += 2) {
        for (int x = 0; x < FRAME_W; x++) {
            int i = y * FRAME_W + x;
            uint8_t a = cells[i];
            uint8_t b = cells[i + FRAME_W];
            if (a && b && ((a & 7) > (b & 7))) {
                cells[i] = b;
                cells[i + FRAME_W] = a;
                spark[i] = 255;
                spark[i + FRAME_W] = 255;
                swaps++;
            }
        }
    }
    return swaps;
}

void egTurnOver() {
    for (int y = 0; y < (FRAME_H >> 1); y++) {
        int a = y * FRAME_W;
        int b = (FRAME_H - 1 - y) * FRAME_W;
        for (int x = 0; x < FRAME_W; x++) {
            uint8_t t = cells[a + x];
            cells[a + x] = cells[b + x];
            cells[b + x] = t;
        }
    }
}

void setup() {
    PFMath::buildSinLUT();

    constexpr int totalBytes = 5 * TOTAL_PIXELS;
    constexpr int floatCount = (totalBytes + sizeof(float) - 1) / sizeof(float);
    if (!memPool) {
        memPool = PFMem::allocFloats(floatCount);
    }
    if (!memPool) return;

    uint8_t* ptr = reinterpret_cast<uint8_t*>(memPool);
    openMask  = ptr;
    glassMask = ptr + TOTAL_PIXELS;
    frameMask = ptr + 2 * TOTAL_PIXELS;
    cells     = ptr + 3 * TOTAL_PIXELS;
    spark     = ptr + 4 * TOTAL_PIXELS;

    egBuild((int)knobNeck);
    egPour();
}

void update(float dt, const InputFrame& input) {
    if (!memPool) return;

    PFParams::apply(input, 0, &knobNeck, 1.0f, 3.0f, 0.042f);
    PFParams::apply(input, 1, &knobDemon, 0.0f, 1.0f, 0.021f);
    PFParams::apply(input, 2, &knobGravity, 1.0f, 5.0f, 0.083f);
    PFParams::apply(input, 3, &knobBlind, 0.0f, 1.0f, 0.021f);

    if (input.btnPressed[0] && !input.paramAbsoluteActive[0] && !input.knobAudioActive[0]) turnNow = true;
    if (input.btnPressed[1] && !input.paramAbsoluteActive[1] && !input.knobAudioActive[1]) pourNow = true;
    if (input.btnPressed[2] && !input.paramAbsoluteActive[2] && !input.knobAudioActive[2]) turnNow = true;
    if (input.btnPressed[3] && !input.paramAbsoluteActive[3] && !input.knobAudioActive[3]) turnNow = true;

    int neck = PFMath::clamp((int)(knobNeck + 0.5f), 1, 3);
    if (neck != builtNeck) {
        egBuild(neck);
    }
    if (pourNow) {
        egPour();
        pourNow = false;
    }
    if (turnNow && phase != EG_TURN) {
        phase = EG_TURN;
        phaseT = 0.0f;
    }
    turnNow = false;

    float fade = expf(-dt * 14.0f);
    for (int i = 0; i < TOTAL_PIXELS; i++) {
        if (spark[i]) {
            spark[i] = (uint8_t)((float)spark[i] * fade);
        }
    }

    phaseT += dt;
    if (phase == EG_FLOW) {
        stepAcc += dt * knobGravity * 55.0f;
        if (stepAcc > 4.0f) stepAcc = 4.0f; // Prevent death spiral

        int steps = 0;
        while (stepAcc >= 1.0f && steps < 4) {
            stepAcc -= 1.0f;
            steps++;
            if (egFall() == 0) {
                phase = EG_REST;
                phaseT = 0.0f;
                sortBudget = (int)(PFMath::clamp01(knobDemon) * 36.0f + 0.5f);
                sorted = (sortBudget == 0);
                stepAcc = 0.0f;
                break;
            }
        }
    } else if (phase == EG_REST) {
        if (!sorted) {
            sortAcc += dt * 25.0f;
            while (sortAcc >= 1.0f && sortBudget > 0 && !sorted) {
                sortAcc -= 1.0f;
                sortBudget--;
                int swaps = egSort() + egSort();
                if (swaps == 0 || sortBudget <= 0) {
                    sorted = true;
                    phaseT = 0.0f;
                }
            }
        } else if (phaseT > 0.9f) {
            phase = EG_TURN;
            phaseT = 0.0f;
        }
    } else if (phaseT >= 0.8f) {
        egTurnOver();
        phase = EG_FLOW;
        phaseT = 0.0f;
        stepAcc = 0.0f;
    }
}

void draw() {
    PFCanvas::setFrame(FRAME_W, FRAME_H);

    if (!memPool) {
        PFCanvas::present();
        return;
    }

    const float blind = PFMath::clamp01(knobBlind);
    constexpr float mid = (float)FRAME_H * 0.5f;

    float scale = 1.0f;
    if (phase == EG_TURN) {
        float angle = PI * PFMath::clamp01(phaseT / 0.8f);
        scale = PFMath::fastCos(angle);
    }
    const bool turning = (phase == EG_TURN);
    const float dim = turning ? (0.5f + 0.5f * fabsf(scale)) : 1.0f;

    for (int y = 0; y < FRAME_H; y++) {
        int sy = y;
        if (turning) {
            if (fabsf(scale) < 0.02f) {
                sy = -1;
            } else {
                sy = PFMath::ifloor(mid + ((float)y + 0.5f - mid) / scale);
            }
        }

        for (int x = 0; x < FRAME_W; x++) {
            if (sy < 0 || sy >= FRAME_H) {
                PFCanvas::setPixel(x, y, 0, 0, 0);
                continue;
            }

            int i = sy * FRAME_W + x;
            float r = 0.0f;
            float g = 0.0f;
            float bl = 0.0f;

            uint8_t c = cells[i];
            if (c) {
                const uint8_t* col = EG_SAND[c & 7];
                float shade = 0.7f + 0.3f * ((float)(c >> 3) * (1.0f / 31.0f));
                r = ((float)col[0] + (EG_BLIND[0] - (float)col[0]) * blind) * shade;
                g = ((float)col[1] + (EG_BLIND[1] - (float)col[1]) * blind) * shade;
                bl = ((float)col[2] + (EG_BLIND[2] - (float)col[2]) * blind) * shade;
                float sp = (float)spark[i] * (1.0f / 3.0f);
                r += sp;
                g += sp;
                bl += sp;
            } else if (frameMask[i]) {
                uint8_t f = frameMask[i];
                if (f == 2) {
                    r = 255.0f; g = 205.0f; bl = 110.0f;
                } else if (f == 1) {
                    r = 190.0f; g = 130.0f; bl = 40.0f;
                } else if (f == 4) {
                    r = 230.0f; g = 165.0f; bl = 70.0f;
                } else {
                    r = 140.0f; g = 92.0f;  bl = 28.0f;
                }
            } else if (glassMask[i]) {
                r = 55.0f; g = 110.0f; bl = 140.0f;
            }

            int ir = (int)(r * dim + 0.5f);
            int ig = (int)(g * dim + 0.5f);
            int ib = (int)(bl * dim + 0.5f);

            PFCanvas::setPixel(x, y, PFMath::clamp(ir, 0, 255), PFMath::clamp(ig, 0, 255), PFMath::clamp(ib, 0, 255));
        }
    }

    PFCanvas::present();
}

} // namespace EntropyGlass