#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_params.h"
#include "src/core_math.h"
#include "src/core_noise.h"
#include "src/core_mem.h"

namespace rolllll {

const char* NAME = "rolllll";
const char* const KNOB_LABELS[4] = {"Zoom", "MoonFlow", "Wind", "Light"};
constexpr bool ABSOLUTE_READY = true;

constexpr int FRAME_W = 64;
constexpr int FRAME_H = 128;
constexpr int TOTAL_PIXELS = FRAME_W * FRAME_H;

struct RGBColor {
    uint8_t r, g, b;
};

constexpr RGBColor COLOR_INK      = {0, 0, 0};
constexpr RGBColor COLOR_NIGHT    = {7, 7, 6};
constexpr RGBColor COLOR_DEEP     = {13, 12, 9};
constexpr RGBColor COLOR_SHADOW   = {38, 30, 18};
constexpr RGBColor COLOR_OLIVE    = {74, 67, 38};
constexpr RGBColor COLOR_BRONZE   = {118, 88, 42};
constexpr RGBColor COLOR_GOLD     = {196, 143, 58};
constexpr RGBColor COLOR_PALEGOLD = {232, 190, 105};
constexpr RGBColor COLOR_IVORY    = {246, 226, 169};
constexpr RGBColor COLOR_MOON     = {255, 236, 184};
constexpr RGBColor COLOR_PAPER    = {218, 186, 116};
constexpr RGBColor COLOR_WATER    = {18, 17, 13};

static inline RGBColor rgbMix(const RGBColor& a, const RGBColor& b, float t) {
    t = PFMath::clamp01(t);
    return {
        (uint8_t)PFMath::clamp((int)roundf((float)a.r + ((float)b.r - (float)a.r) * t), 0, 255),
        (uint8_t)PFMath::clamp((int)roundf((float)a.g + ((float)b.g - (float)a.g) * t), 0, 255),
        (uint8_t)PFMath::clamp((int)roundf((float)a.b + ((float)b.b - (float)a.b) * t), 0, 255)
    };
}

static inline float pseudoHash(float n) {
    return PFNoise::cellHash((int)n, (int)(n * 7.13f + 1.0f));
}

struct Petal {
    float x;
    float y;
    float speed;
    float wobble;
    float size;
};

static Petal petals[13];

static float zoomKnob = 1.0f;
static float moonFlowKnob = 1.0f;
static float windKnob = 10.0f;
static float lightKnob = 1.0f;

static float currentZoom = 1.0f;
static float currentMoonFlow = 1.0f;
static float currentWind = 0.0f;
static float currentLight = 0.72f;

static bool autoFlow = true;
static bool zoomHome = false;

static float gust = 0.0f;
static float moonPulse = 0.0f;
static float flow = 0.0f;
static float drift = 0.0f;
static float moonDrift = 0.0f;
static float simTime = 0.0f;
static float cameraY = 64.0f;

static float* rgbBuffer = nullptr;

static inline void projectPt(float x, float y, float depth, float& px, float& py) {
    float z = 1.0f + (currentZoom - 1.0f) * depth;
    float cy = 64.0f + (cameraY - 64.0f) * depth;
    px = (32.0f + (x - 32.0f) * z);
    py = (64.0f + (y - cy) * z);
}

static inline void setBufPixel(int x, int y, const RGBColor& c) {
    if (x < 0 || y < 0 || x >= FRAME_W || y >= FRAME_H || !rgbBuffer) return;
    int idx = (y * FRAME_W + x) * 3;
    rgbBuffer[idx]     = c.r;
    rgbBuffer[idx + 1] = c.g;
    rgbBuffer[idx + 2] = c.b;
}

static void drawRect(float x, float y, float w, float h, const RGBColor& c, float depth = 1.0f) {
    float ax, ay, bx, by;
    projectPt(x, y, depth, ax, ay);
    projectPt(x + w, y + h, depth, bx, by);

    int x0 = PFMath::clamp((int)roundf(ax), 0, FRAME_W);
    int x1 = PFMath::clamp((int)roundf(bx), 0, FRAME_W);
    int y0 = PFMath::clamp((int)roundf(ay), 0, FRAME_H);
    int y1 = PFMath::clamp((int)roundf(by), 0, FRAME_H);

    for (int yy = y0; yy < y1; yy++) {
        for (int xx = x0; xx < x1; xx++) {
            setBufPixel(xx, yy, c);
        }
    }
}

static void drawPoly(const float pts[][2], int count, const RGBColor& c, float depth = 1.0f) {
    if (count < 3 || count > 32) return;
    float proj[32][2];
    float minPy = 9999.0f, maxPy = -9999.0f;

    for (int i = 0; i < count; i++) {
        projectPt(pts[i][0], pts[i][1], depth, proj[i][0], proj[i][1]);
        if (proj[i][1] < minPy) minPy = proj[i][1];
        if (proj[i][1] > maxPy) maxPy = proj[i][1];
    }

    int ymin = PFMath::clamp((int)PFMath::floorF(minPy), 0, FRAME_H);
    int ymax = PFMath::clamp((int)ceilf(maxPy), 0, FRAME_H);

    for (int y = ymin; y < ymax; y++) {
        float cy = (float)y + 0.5f;
        float hits[32];
        int hitCount = 0;

        for (int i = 0, j = count - 1; i < count; j = i++) {
            float ay = proj[i][1];
            float by = proj[j][1];
            if ((ay > cy) != (by > cy)) {
                float ax = proj[i][0];
                float bx = proj[j][0];
                hits[hitCount++] = ax + (cy - ay) * (bx - ax) / (by - ay);
            }
        }

        for (int i = 0; i < hitCount - 1; i++) {
            for (int j = i + 1; j < hitCount; j++) {
                if (hits[j] < hits[i]) {
                    float tmp = hits[i];
                    hits[i] = hits[j];
                    hits[j] = tmp;
                }
            }
        }

        for (int i = 0; i + 1 < hitCount; i += 2) {
            int startX = PFMath::clamp((int)ceilf(hits[i] - 0.5f), 0, FRAME_W);
            int endX   = PFMath::clamp((int)PFMath::floorF(hits[i + 1] - 0.5f) + 1, 0, FRAME_W);
            for (int x = startX; x < endX; x++) {
                setBufPixel(x, y, c);
            }
        }
    }
}

static void drawStroke(float x1, float y1, float x2, float y2, const RGBColor& c, float width = 0.55f, float depth = 1.0f) {
    float ax, ay, bx, by;
    projectPt(x1, y1, depth, ax, ay);
    projectPt(x2, y2, depth, bx, by);

    float z = 1.0f + (currentZoom - 1.0f) * depth;
    int size = (int)roundf(width * z);
    if (size < 1) size = 1;

    float dx = bx - ax;
    float dy = by - ay;
    int n = (int)ceilf(sqrtf(dx * dx + dy * dy));
    if (n < 1) n = 1;

    int halfSize = size >> 1;
    for (int i = 0; i <= n; i++) {
        float t = (float)i / (float)n;
        int x = (int)roundf(ax + dx * t);
        int y = (int)roundf(ay + dy * t);

        for (int sy = 0; sy < size; sy++) {
            for (int sx = 0; sx < size; sx++) {
                setBufPixel(x + sx - halfSize, y + sy - halfSize, c);
            }
        }
    }
}

static void drawEllipse(float x, float y, float rx, float ry, const RGBColor& c, float depth = 1.0f) {
    float ax, ay;
    projectPt(x, y, depth, ax, ay);

    float z = 1.0f + (currentZoom - 1.0f) * depth;
    rx *= z;
    ry *= z;
    if (rx <= 0.01f || ry <= 0.01f) return;

    int yStart = PFMath::clamp((int)ceilf(ay - ry), 0, FRAME_H - 1);
    int yEnd   = PFMath::clamp((int)PFMath::floorF(ay + ry), 0, FRAME_H - 1);

    for (int yy = yStart; yy <= yEnd; yy++) {
        float v = ((float)yy - ay) / ry;
        if (fabsf(v) > 1.0f) continue;
        float span = rx * sqrtf(1.0f - v * v);

        int xStart = PFMath::clamp((int)ceilf(ax - span), 0, FRAME_W - 1);
        int xEnd   = PFMath::clamp((int)PFMath::floorF(ax + span), 0, FRAME_W - 1);

        for (int xx = xStart; xx <= xEnd; xx++) {
            setBufPixel(xx, yy, c);
        }
    }
}

static void drawCurve(float x0, float y0, float cx, float cy, float x1, float y1,
                      const RGBColor& c, float width = 0.45f, float depth = 1.0f, int steps = 22) {
    float px = x0;
    float py = y0;
    for (int i = 1; i <= steps; i++) {
        float t = (float)i / (float)steps;
        float u = 1.0f - t;
        float x = u * u * x0 + 2.0f * u * t * cx + t * t * x1;
        float y = u * u * y0 + 2.0f * u * t * cy + t * t * y1;
        drawStroke(px, py, x, y, c, width, depth);
        px = x;
        py = y;
    }
}

static void drawStar(float x, float y, bool big = false) {
    RGBColor c = big ? COLOR_PALEGOLD : rgbMix(COLOR_SHADOW, COLOR_PALEGOLD, 0.55f);
    drawRect(x, y, 0.7f, 0.7f, c, 0.12f);
    if (big) {
        drawStroke(x - 1.1f, y + 0.35f, x + 1.8f, y + 0.35f, c, 0.3f, 0.12f);
        drawStroke(x + 0.35f, y - 1.1f, x + 0.35f, y + 1.8f, c, 0.3f, 0.12f);
    }
}

static void drawCloud(float x, float y, float s, float depth = 0.25f) {
    constexpr RGBColor c1 = {24, 21, 15};
    constexpr RGBColor c2 = {42, 34, 21};
    constexpr float rawPts[17][2] = {
        {-18, 1}, {-14, 0}, {-11, -2}, {-8, -1}, {-6, -4}, {-2, -3},
        {1, -5}, {4, -2}, {8, -2}, {11, 0}, {17, 1}, {12, 3},
        {7, 4}, {2, 3}, {-4, 5}, {-10, 4}, {-14, 2}
    };

    float pts[17][2];
    for (int i = 0; i < 17; i++) {
        pts[i][0] = x + rawPts[i][0] * s;
        pts[i][1] = y + rawPts[i][1] * s;
    }
    drawPoly(pts, 17, c1, depth);

    for (int i = 1; i < 17 - 3; i += 3) {
        drawStroke(x + rawPts[i - 1][0] * s, y + rawPts[i - 1][1] * s,
                   x + rawPts[i][0] * s,     y + rawPts[i][1] * s,
                   c2, 0.28f, depth);
    }
}

static void drawMoon() {
    float pulse = (moonPulse > 0.0f) ? PFMath::fastSin((moonPulse / 4.0f) * PI) : 0.0f;
    float lightVal = PFMath::fastPow(PFMath::clamp01(currentLight + pulse * 0.38f), 1.35f);
    float phase = PFMath::clamp01(currentMoonFlow);

    float x = 15.2f;
    float y = 20.5f;
    float r = 10.4f;
    float depth = 0.18f;

    float ax, ay;
    projectPt(x, y, depth, ax, ay);

    float z = 1.0f + (currentZoom - 1.0f) * depth;
    float rx = r * z;
    float ry = r * z;

    float shapedPhase = PFMath::fastPow(phase, 1.08f);
    float shadowOffset = 0.35f + (r * 2.08f - 0.35f) * shapedPhase;
    float shadowR = r * 1.015f;

    RGBColor darkMoon = {10, 9, 7};
    RGBColor moonBody = rgbMix(darkMoon, COLOR_MOON, 0.03f + lightVal * 0.97f);

    constexpr float craterDefs[9][5] = {
        {-4.8f, -4.0f, 2.6f, 1.8f, 0.55f},
        {-1.2f, -5.1f, 1.9f, 1.4f, 0.35f},
        { 3.0f, -4.2f, 2.1f, 1.7f, 0.38f},
        {-4.0f,  0.2f, 2.2f, 1.5f, 0.28f},
        { 0.8f, -0.8f, 3.1f, 2.2f, 0.42f},
        { 4.6f,  0.3f, 1.7f, 1.2f, 0.46f},
        {-3.2f,  4.1f, 2.6f, 1.7f, 0.36f},
        { 1.9f,  4.2f, 1.5f, 1.2f, 0.50f},
        { 4.7f,  4.5f, 1.1f, 0.9f, 0.38f}
    };

    int minX = PFMath::clamp((int)PFMath::floorF(ax - rx - 3.0f), 0, FRAME_W - 1);
    int maxX = PFMath::clamp((int)ceilf(ax + rx + 3.0f), 0, FRAME_W - 1);
    int minY = PFMath::clamp((int)PFMath::floorF(ay - ry - 3.0f), 0, FRAME_H - 1);
    int maxY = PFMath::clamp((int)ceilf(ay + ry + 3.0f), 0, FRAME_H - 1);

    float invZ = 1.0f / z;
    float rSq = r * r;
    float shadowRSq = shadowR * shadowR;

    for (int yy = minY; yy <= maxY; yy++) {
        float ly = ((float)yy + 0.5f - ay) * invZ;
        float lySq = ly * ly;
        for (int xx = minX; xx <= maxX; xx++) {
            float lx = ((float)xx + 0.5f - ax) * invZ;
            float moonD = lx * lx + lySq;
            if (moonD > rSq) continue;

            float offX = lx + shadowOffset;
            bool inShadow = (phase < 0.995f) && (offX * offX + lySq < shadowRSq);
            if (inShadow) continue;

            RGBColor col = moonBody;

            for (int i = 0; i < 9; i++) {
                float cdx = craterDefs[i][0];
                float cdy = craterDefs[i][1];
                float crx = craterDefs[i][2];
                float cry = craterDefs[i][3];
                float strength = craterDefs[i][4];

                float edx = lx - cdx;
                float edy = ly - cdy;
                float cv = (edx * edx) / (crx * crx) + (edy * edy) / (cry * cry);

                if (cv <= 1.0f) {
                    col = rgbMix(col, COLOR_BRONZE, strength * 0.78f);
                    if (i % 2 == 0 && lightVal > 0.25f && cv < 0.42f) {
                        col = rgbMix(col, COLOR_IVORY, 0.12f + lightVal * 0.22f);
                    }
                }
            }

            float edgeBand = moonD / rSq;
            if (edgeBand > 0.84f) {
                col = rgbMix(col, COLOR_IVORY, 0.12f + lightVal * 0.42f);
            }

            float shadowEdgeDist = fabsf((offX * offX + lySq) - shadowRSq);
            if (phase < 0.995f && shadowEdgeDist < 1.15f) {
                col = rgbMix(col, COLOR_IVORY, 0.08f + lightVal * 0.20f);
            }

            setBufPixel(xx, yy, col);
        }
    }

    float rimBrightness = 0.18f + lightVal * 0.82f;
    float visibleThreshRim = 0.93f + (-1.05f - 0.93f) * phase;

    for (int i = 0; i < 28; i++) {
        float ang = (float)i * TWO_PI / 28.0f;
        float px = PFMath::fastCos(ang);
        if (px < visibleThreshRim) continue;

        float jitter = (pseudoHash((float)i + 60.0f) - 0.5f) * 0.6f;
        float cosA = PFMath::fastCos(ang);
        float sinA = PFMath::fastSin(ang);

        drawRect(x + cosA * (r + jitter) - 0.3f,
                 y + sinA * (r + jitter) - 0.3f,
                 0.6f, 0.6f,
                 rgbMix(COLOR_GOLD, COLOR_IVORY, rimBrightness),
                 0.182f);
    }

    float visibleThreshGlow = 0.90f + (-0.95f - 0.90f) * phase;
    for (int i = 0; i < 22; i++) {
        float ang = (float)i * TWO_PI / 22.0f;
        float px = PFMath::fastCos(ang);
        if (px < visibleThreshGlow) continue;

        float cosA = PFMath::fastCos(ang);
        float sinA = PFMath::fastSin(ang);

        drawRect(x + cosA * (r + 1.2f) - 0.3f,
                 y + sinA * (r + 1.2f) - 0.3f,
                 0.55f, 0.55f,
                 rgbMix(COLOR_NIGHT, COLOR_PALEGOLD, 0.18f + lightVal * 0.22f),
                 0.181f);
    }
}

static void drawWindowGlow() {
    float x0 = 27.5f;
    float y0 = 37.0f;
    float x1 = 62.0f;
    float y1 = 84.0f;
    float s = 5.6f;

    float shape[8][2] = {
        {x0 + s, y0}, {x1 - s, y0}, {x1, y0 + s}, {x1, y1 - s},
        {x1 - s, y1}, {x0 + s, y1}, {x0, y1 - s}, {x0, y0 + s}
    };

    float pulse = (moonPulse > 0.0f) ? PFMath::fastSin((moonPulse / 4.0f) * PI) : 0.0f;
    float lightVal = PFMath::fastPow(PFMath::clamp01(currentLight + pulse * 0.38f), 1.7f);

    drawPoly(shape, 8, rgbMix(COLOR_SHADOW, COLOR_PAPER, 0.03f + 0.94f * lightVal), 0.42f);

    for (int i = 0; i < 40; i++) {
        int side = i % 4;
        float px = 0, py = 0;
        float h1 = pseudoHash((float)(i * 3 + 1));
        float h2 = pseudoHash((float)(i * 3 + 2));

        if (side == 0) {
            px = (x0 + 5.0f) + (x1 - 5.0f - (x0 + 5.0f)) * h1;
            py = y0 + h2 * 3.0f;
        } else if (side == 1) {
            px = x1 - h1 * 3.0f;
            py = (y0 + 5.0f) + (y1 - 5.0f - (y0 + 5.0f)) * h2;
        } else if (side == 2) {
            px = (x0 + 5.0f) + (x1 - 5.0f - (x0 + 5.0f)) * h1;
            py = y1 - h2 * 3.0f;
        } else if (side == 3) {
            px = x0 + h1 * 3.0f;
            py = (y0 + 5.0f) + (y1 - 5.0f - (y0 + 5.0f)) * h2;
        }

        drawRect(px, py, 0.6f, 0.6f, rgbMix(COLOR_SHADOW, COLOR_PAPER, 0.05f + 0.75f * lightVal), 0.42f);
    }

    RGBColor frame = rgbMix(COLOR_SHADOW, COLOR_INK, 0.58f);

    drawStroke(31.0f, 38.5f, 31.0f, 82.5f, frame, 0.65f, 0.44f);
    drawStroke(36.0f, 38.5f, 36.0f, 82.5f, frame, 0.55f, 0.44f);
    drawStroke(57.8f, 39.5f, 57.8f, 82.5f, frame, 0.55f, 0.44f);
    drawStroke(27.8f, 49.0f, 61.4f, 49.0f, frame, 0.55f, 0.44f);
    drawStroke(27.8f, 72.0f, 61.4f, 72.0f, frame, 0.55f, 0.44f);

    drawStroke(28.5f, 43.0f, 35.5f, 43.0f, frame, 0.5f,  0.44f);
    drawStroke(31.0f, 49.0f, 31.0f, 43.0f, frame, 0.5f,  0.44f);
    drawStroke(28.5f, 55.0f, 35.5f, 55.0f, frame, 0.5f,  0.44f);
    drawStroke(36.0f, 49.0f, 36.0f, 55.0f, frame, 0.5f,  0.44f);
    drawStroke(54.0f, 44.0f, 60.8f, 44.0f, frame, 0.45f, 0.44f);
    drawStroke(57.8f, 44.0f, 57.8f, 50.0f, frame, 0.45f, 0.44f);
    drawStroke(54.0f, 66.0f, 60.8f, 66.0f, frame, 0.45f, 0.44f);
    drawStroke(57.8f, 66.0f, 57.8f, 72.0f, frame, 0.45f, 0.44f);

    float fx = 31.8f;
    float fy = 61.0f;
    drawEllipse(fx, fy, 0.8f, 0.8f, frame, 0.45f);

    for (int i = 0; i < 8; i++) {
        float ang = (float)i * TWO_PI / 8.0f;
        drawEllipse(fx + PFMath::fastCos(ang) * 2.0f,
                    fy + PFMath::fastSin(ang) * 2.0f,
                    0.95f, 0.65f, frame, 0.45f);
    }

    drawStroke(fx, 63.2f, fx, 69.3f, frame, 0.45f, 0.45f);
    drawCurve(fx, 66.0f, 29.8f, 65.5f, 29.1f, 64.5f, frame, 0.4f, 0.45f, 12);
    drawCurve(fx, 67.4f, 33.2f, 66.6f, 34.0f, 65.5f, frame, 0.4f, 0.45f, 12);
}

static void drawBranchAndBird() {
    float sway = PFMath::fastSin(simTime * 0.35f + moonDrift * 0.04f) * 0.42f +
                 PFMath::clamp(flow, -4.0f, 4.0f) * 0.045f;

    RGBColor c = rgbMix(COLOR_INK, COLOR_SHADOW, 0.22f);

    drawCurve(61.5f, 82.0f, 58.3f + sway, 66.0f, 50.0f + sway, 52.0f, c, 1.9f,  0.47f, 20);
    drawCurve(50.0f, 52.0f, 47.0f + sway, 45.0f, 41.0f + sway, 43.0f, c, 1.15f, 0.47f, 14);
    drawCurve(54.0f, 60.0f, 48.0f + sway, 57.0f, 43.0f + sway, 55.0f, c, 0.75f, 0.47f, 14);
    drawCurve(58.4f, 68.0f, 54.0f + sway, 65.0f, 49.0f + sway, 63.0f, c, 0.7f,  0.47f, 14);

    constexpr float clusters[8][2] = {
        {41, 43}, {44, 45}, {48, 48}, {43, 55},
        {49, 55}, {51, 62}, {54, 63}, {46, 64}
    };

    for (int k = 0; k < 8; k++) {
        float cx = clusters[k][0];
        float cy = clusters[k][1];
        float rr = 1.6f + (float)(k % 3) * 0.15f;
        float kHash = pseudoHash((float)k);

        for (int i = 0; i < 6; i++) {
            float ang = (float)i * TWO_PI / 6.0f + kHash * 0.7f;
            drawEllipse(cx + PFMath::fastCos(ang) * rr,
                        cy + PFMath::fastSin(ang) * rr * 0.72f,
                        0.72f, 0.45f, c, 0.47f);
        }
        drawEllipse(cx, cy, 0.55f, 0.55f, c, 0.47f);
    }

    float bx = 44.8f + sway * 0.35f;
    float by = 69.1f;

    drawEllipse(bx, by, 1.9f, 1.35f, c, 0.49f);
    drawEllipse(bx - 1.1f, by - 0.8f, 0.85f, 0.75f, c, 0.49f);

    float poly1[3][2] = {
        {bx - 1.85f, by - 0.9f},
        {bx - 2.80f, by - 0.55f},
        {bx - 1.90f, by - 0.25f}
    };
    drawPoly(poly1, 3, c, 0.49f);

    float poly2[3][2] = {
        {bx + 1.1f, by + 0.7f},
        {bx + 2.8f, by + 1.6f},
        {bx + 0.8f, by + 1.3f}
    };
    drawPoly(poly2, 3, c, 0.49f);

    drawStroke(bx - 0.5f,  by + 1.1f,  bx - 0.45f, by + 2.2f, c, 0.35f, 0.49f);
    drawStroke(bx + 0.25f, by + 1.05f, bx + 0.15f, by + 2.1f, c, 0.35f, 0.49f);
    drawStroke(40.2f, 71.1f, 51.3f, 70.5f, c, 0.7f, 0.47f);
}

static void drawDistantHills() {
    constexpr float hill1[11][2] = {
        {-5, 93}, {4, 88}, {11, 90}, {18, 86}, {26, 91}, {34, 88},
        {42, 92}, {52, 89}, {70, 94}, {70, 104}, {-5, 104}
    };
    drawPoly(hill1, 11, COLOR_DEEP, 0.48f);

    constexpr float hill2[11][2] = {
        {-4, 97}, {7, 93}, {14, 96}, {23, 92}, {31, 97}, {40, 94},
        {49, 97}, {58, 94}, {68, 98}, {68, 105}, {-4, 105}
    };
    drawPoly(hill2, 11, rgbMix(COLOR_DEEP, COLOR_SHADOW, 0.2f), 0.52f);
}

static void drawWater() {
    drawRect(0, 96, 64, 32, COLOR_WATER, 0.56f);

    for (int i = 0; i < 52; i++) {
        float y = 98.0f + (float)i * 0.55f;
        float driftWave = PFMath::fastSin(y * 0.8f + moonDrift * 0.55f + (float)i) *
                          (0.7f + fabsf(flow) * 0.03f);

        float x0 = 2.0f + pseudoHash((float)(i * 7)) * 45.0f + driftWave;
        float len = 3.0f + pseudoHash((float)(i * 7 + 2)) * 13.0f;

        RGBColor base = (i % 5 == 0)
            ? rgbMix(COLOR_SHADOW, COLOR_GOLD, 0.55f)
            : rgbMix(COLOR_NIGHT, COLOR_OLIVE, 0.35f);

        float xEnd = x0 + len;
        if (xEnd > 63.0f) xEnd = 63.0f;
        drawStroke(x0, y, xEnd, y, base, 0.28f, 0.58f);
    }

    float lightVal = PFMath::fastPow(PFMath::clamp01(currentLight), 1.8f);

    for (int i = 0; i < 26; i++) {
        float y = 99.0f + (float)i * 1.02f;
        float width = 3.0f + (float)i * 0.18f + pseudoHash((float)(i + 90)) * 4.0f;
        float center = 15.0f + PFMath::fastSin((float)i * 0.83f + moonDrift * 0.75f) * 1.9f;
        float flicker = 0.62f + 0.38f * PFMath::fastSin(simTime * 2.2f + (float)i * 1.7f);

        float visibility = PFMath::clamp01(lightVal * (0.45f + flicker * 0.55f));
        RGBColor c = rgbMix(COLOR_WATER, COLOR_IVORY, visibility);

        drawStroke(center - width * 0.5f, y, center + width * 0.5f, y, c, 0.35f, 0.61f);
    }
}

static void drawPlume(float baseX, float baseY, float tipX, float tipY,
                      int seed, float depth = 1.0f, float scale = 1.0f) {
    float windPower = fabsf(flow);
    float sway = PFMath::fastSin(simTime * (0.48f + (float)seed * 0.008f) + (float)seed) *
                 (0.18f + windPower * 0.34f) * scale + flow * 0.52f * scale;

    float cx = baseX + (tipX - baseX) * 0.52f + sway * 1.85f;
    float cy = baseY + (tipY - baseY) * 0.5f + 2.0f;

    RGBColor stemC = (seed % 3 == 0) ? COLOR_OLIVE : rgbMix(COLOR_OLIVE, COLOR_GOLD, 0.28f);

    drawCurve(baseX, baseY, cx, cy, tipX + sway, tipY, stemC, 0.48f * scale, depth, 16);

    float tx = tipX + sway;
    float ty = tipY;
    float dx = tx - cx;
    float dy = ty - cy;
    float L = sqrtf(dx * dx + dy * dy);
    if (L < 1.0f) L = 1.0f;

    float nx = -dy / L;
    float ny =  dx / L;
    float ux =  dx / L;
    float uy =  dy / L;

    float plumeLen = 9.2f * scale;
    float sx = tx - ux * plumeLen;
    float sy = ty - uy * plumeLen;

    drawStroke(sx, sy, tx, ty, COLOR_PALEGOLD, 0.55f * scale, depth);

    for (int i = 0; i < 11; i++) {
        float t = (float)i / 10.0f;
        float px = sx + (tx - sx) * t;
        float py = sy + (ty - sy) * t;

        float sideLen = (2.5f * (1.0f - t) + 0.4f) * scale *
                        (0.8f + pseudoHash((float)(seed * 31 + i)) * 0.45f);

        float fuzz = (pseudoHash((float)(seed * 71 + i)) - 0.5f) * 0.7f * scale;

        RGBColor c = (i % 3 == 0) ? COLOR_IVORY : COLOR_PALEGOLD;

        drawStroke(px, py, px + nx * (sideLen + fuzz), py + ny * (sideLen + fuzz), c, 0.34f * scale, depth);
        drawStroke(px, py, px - nx * (sideLen * 0.72f - fuzz), py - ny * (sideLen * 0.72f - fuzz), COLOR_GOLD, 0.3f * scale, depth);
    }
}

static void drawSilverGrass() {
    constexpr float backGrass[7][6] = {
        {4, 127, 6, 93, 1, 0.78f},
        {10, 127, 16, 88, 2, 0.78f},
        {19, 127, 26, 96, 3, 0.74f},
        {26, 127, 35, 88, 4, 0.82f},
        {39, 127, 43, 82, 5, 0.78f},
        {46, 127, 49, 85, 6, 0.82f},
        {54, 127, 60, 78, 7, 0.86f}
    };
    for (int i = 0; i < 7; i++) {
        drawPlume(backGrass[i][0], backGrass[i][1], backGrass[i][2], backGrass[i][3],
                  (int)backGrass[i][4], 0.78f, backGrass[i][5]);
    }

    constexpr float frontGrass[9][6] = {
        {26, 130, 39, 87, 10, 1.02f},
        {33, 130, 45, 82, 11, 1.08f},
        {40, 130, 51, 75, 12, 1.15f},
        {46, 130, 58, 72, 13, 1.20f},
        {52, 130, 64, 80, 14, 1.12f},
        {57, 130, 68, 88, 15, 1.02f},
        {8, 130, 20, 105, 16, 0.92f},
        {14, 130, 27, 101, 17, 0.98f},
        {2, 130, 13, 111, 18, 0.88f}
    };
    for (int i = 0; i < 9; i++) {
        drawPlume(frontGrass[i][0], frontGrass[i][1], frontGrass[i][2], frontGrass[i][3],
                  (int)frontGrass[i][4], 1.02f, frontGrass[i][5]);
    }
}

static void drawPetalsAndSparks() {
    float windMag = PFMath::clamp01(fabsf(flow) / 7.0f);

    for (int i = 0; i < 13; i++) {
        const Petal& q = petals[i];
        float x = q.x + PFMath::fastSin(simTime * 1.1f + q.wobble) * (0.7f + windMag * 2.6f);
        float y = q.y + PFMath::fastSin(simTime * 0.6f + q.wobble) * 0.35f;

        RGBColor c = (i % 4 == 0) ? COLOR_PALEGOLD : COLOR_GOLD;

        if (i % 3 == 0) {
            float tri[4][2] = {
                {x, y},
                {x + q.size * 1.2f, y + 0.35f},
                {x + 0.35f, y + q.size * 1.55f},
                {x - 0.35f, y + 0.55f}
            };
            drawPoly(tri, 4, c, 0.7f);
        } else {
            drawRect(x, y, 0.6f * q.size, 0.85f * q.size, c, 0.7f);
        }
    }
}

static void drawSky() {
    drawRect(0, 0, 64, 128, COLOR_NIGHT, 0.05f);

    float driftVal = moonDrift * 0.05f;

    for (int i = 0; i < 34; i++) {
        float x = PFMath::jsMod(pseudoHash((float)(i * 13 + 2)) * 68.0f - 2.0f + driftVal, 68.0f);
        if (x < 0.0f) x += 68.0f;

        float y = 3.0f + pseudoHash((float)(i * 13 + 5)) * 77.0f;

        float dx = x - 15.2f;
        float dy = y - 20.5f;
        if (sqrtf(dx * dx + dy * dy) < 13.0f) continue;

        drawStar(x, y, (i % 9 == 0));
    }

    constexpr float cloudDefs[5][3] = {
        {-5, 31, 0.70f},
        {52, 27, 0.72f},
        {-9, 46, 0.92f},
        {58, 48, 0.85f},
        {14, 79, 0.85f}
    };

    for (int i = 0; i < 5; i++) {
        float baseD = moonDrift * (0.55f + (float)i * 0.05f) + (float)i * 23.0f + 95.0f;
        float dd = PFMath::jsMod(PFMath::jsMod(baseD, 190.0f) + 190.0f, 190.0f) - 95.0f;

        drawCloud(cloudDefs[i][0] + dd,
                  cloudDefs[i][1] + PFMath::fastSin(simTime * 0.08f + (float)i) * 0.45f,
                  cloudDefs[i][2],
                  0.22f + (float)i * 0.015f);
    }

    drawMoon();
    drawWindowGlow();
    drawBranchAndBird();
    drawDistantHills();
}

void setup() {
    PFMath::buildSinLUT();

    simTime = 0.0f;
    currentZoom = 1.0f;
    currentMoonFlow = 1.0f;
    currentWind = 0.0f;
    currentLight = 0.72f;

    autoFlow = true;
    zoomHome = false;

    gust = 0.0f;
    moonPulse = 0.0f;
    flow = 0.0f;
    drift = 0.0f;
    moonDrift = 0.0f;

    for (int i = 0; i < 13; i++) {
        petals[i].x = pseudoHash((float)(i * 11 + 2)) * 78.0f - 7.0f;
        petals[i].y = pseudoHash((float)(i * 11 + 7)) * 112.0f + 5.0f;
        petals[i].speed = 1.4f + pseudoHash((float)(i * 11 + 5)) * 2.2f;
        petals[i].wobble = pseudoHash((float)(i * 11 + 9)) * TWO_PI;
        petals[i].size = (i % 4 == 0) ? 1.0f : 0.65f;
    }

    if (!rgbBuffer) {
        rgbBuffer = PFMem::allocFloats(TOTAL_PIXELS * 3);
    }
}

void update(float dt, const InputFrame& input) {
    if (!rgbBuffer) return;

    dt = PFMath::clamp(dt, 0.0f, 0.05f);

    PFParams::apply(input, 0, &zoomKnob, 1.0f, 3.5f, 0.052f);
    PFParams::apply(input, 1, &moonFlowKnob, 0.0f, 1.0f, 0.021f);
    PFParams::apply(input, 2, &windKnob, -10.0f, 10.0f, 0.417f);
    PFParams::apply(input, 3, &lightKnob, 0.0f, 1.0f, 0.021f);

    float ease = 1.0f - expf(-dt * 6.0f);

    float targetZoom = zoomHome ? 1.0f : PFMath::clamp(zoomKnob, 1.0f, 3.5f);
    currentZoom = currentZoom + (targetZoom - currentZoom) * ease;

    currentMoonFlow = currentMoonFlow + (PFMath::clamp01(moonFlowKnob) - currentMoonFlow) * ease;

    float rawWind = PFMath::clamp(windKnob, -10.0f, 10.0f);
    float windSign = (rawWind < 0.0f) ? -1.0f : 1.0f;
    float windNorm = fabsf(rawWind) / 10.0f;
    float dramaticWind = windSign * PFMath::fastPow(windNorm, 1.45f) * 10.0f;
    currentWind = currentWind + (dramaticWind - currentWind) * ease;

    float rawLight = PFMath::clamp01(lightKnob);
    float dramaticLight = PFMath::fastPow(rawLight, 1.65f);
    currentLight = currentLight + (dramaticLight - currentLight) * ease;

    if (input.btnPressed[0] && !input.paramAbsoluteActive[0] && !input.knobAudioActive[0]) {
        zoomHome = true;
    }
    if (input.btnPressed[1] && !input.paramAbsoluteActive[1] && !input.knobAudioActive[1]) {
        autoFlow = !autoFlow;
    }
    if (input.btnPressed[2] && !input.paramAbsoluteActive[2] && !input.knobAudioActive[2]) {
        gust = 4.6f;
    }
    if (input.btnPressed[3] && !input.paramAbsoluteActive[3] && !input.knobAudioActive[3]) {
        moonPulse = 4.0f;
    }

    simTime += dt;
    if (simTime > 120.0f * PI) simTime -= 120.0f * PI;

    gust = (gust > dt) ? (gust - dt) : 0.0f;
    moonPulse = (moonPulse > dt) ? (moonPulse - dt) : 0.0f;

    float gustWave = PFMath::fastSin(PFMath::clamp01(gust / 4.6f) * PI);
    float gustSign = (currentWind < 0.0f) ? -1.0f : 1.0f;
    flow = currentWind * 1.28f + gustSign * gustWave * 4.2f;

    drift += dt * flow;
    if (drift > 1000.0f || drift < -1000.0f) drift = PFMath::jsMod(drift, 1000.0f);

    if (autoFlow) {
        moonDrift += dt * 0.42f;
        if (moonDrift > 190.0f * TWO_PI) moonDrift -= 190.0f * TWO_PI;
    }

    for (int i = 0; i < 13; i++) {
        Petal& q = petals[i];
        q.x += (q.speed + flow * 1.15f) * dt;
        q.y += (0.18f + fabsf(flow) * 0.09f) * dt;

        if (q.x > 76.0f) q.x = -10.0f;
        if (q.x < -11.0f) q.x = 75.0f;
        if (q.y > 128.0f) q.y = 5.0f;
    }
}

void draw() {
    PFCanvas::setFrame(FRAME_W, FRAME_H);

    if (!rgbBuffer) {
        PFCanvas::present();
        return;
    }

    memset(rgbBuffer, 0, TOTAL_PIXELS * 3 * sizeof(float));

    float approach = PFMath::clamp01((currentZoom - 1.0f) / 1.8f);
    float smoothApproach = approach * approach * (3.0f - 2.0f * approach);
    cameraY = 64.0f + (58.0f - 64.0f) * smoothApproach;

    drawSky();
    drawWater();
    drawPetalsAndSparks();
    drawSilverGrass();

    for (int y = 0; y < FRAME_H; y++) {
        int rowIdx = y * FRAME_W * 3;
        for (int x = 0; x < FRAME_W; x++) {
            int idx = rowIdx + x * 3;
            uint8_t r = (uint8_t)PFMath::clamp(rgbBuffer[idx],     0.0f, 255.0f);
            uint8_t g = (uint8_t)PFMath::clamp(rgbBuffer[idx + 1], 0.0f, 255.0f);
            uint8_t b = (uint8_t)PFMath::clamp(rgbBuffer[idx + 2], 0.0f, 255.0f);
            PFCanvas::setPixel(x, y, r, g, b);
        }
    }

    PFCanvas::present();
}

} // namespace rolllll