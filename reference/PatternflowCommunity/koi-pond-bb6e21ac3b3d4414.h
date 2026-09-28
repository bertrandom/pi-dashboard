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

namespace KoiPond {

    const char* NAME = "koi pond";
    const char* const KNOB_LABELS[4] = {"KoiCount", "Leaves", "Speed", "InkMode"};
    constexpr bool ABSOLUTE_READY = true;

    // Knob parameters & internal state
    static float rawKoiCount = 5.56f;
    static float rawLeaves   = 15.72f;
    static float rawSpeed    = 1.88f;
    static float rawInkMode  = 0.0f;

    static float speedScale = 1.0f;
    static float ink        = 0.85f;
    static float lastRawInk = 0.0f;

    static bool  inkOverrideActive = false;
    static float inkOverrideVal    = 0.0f;

    static float reverseFlow = 1.0f;
    static float fright      = 0.0f;
    static float feed        = 0.0f;
    static float t           = 0.0f;

    static uint32_t prngSeed = 91517u;

    inline float nextRandom() {
        prngSeed = prngSeed * 1664525u + 1013904223u;
        return (float)prngSeed * (1.0f / 4294967296.0f);
    }

    struct Food {
        float x;
        float y;
        float age;
    };
    static Food food = {67.0f, 31.0f, 0.0f};

    struct Ring {
        float x;
        float y;
        float age;
        float strength;
    };
    static constexpr int MAX_RINGS = 16;
    static Ring rings[MAX_RINGS];
    static int ringCount = 0;

    inline void addRing(float x, float y, float strength) {
        if (ringCount >= MAX_RINGS) {
            for (int i = 0; i < MAX_RINGS - 1; i++) {
                rings[i] = rings[i + 1];
            }
            ringCount = MAX_RINGS - 1;
        }
        rings[ringCount].x = x;
        rings[ringCount].y = y;
        rings[ringCount].age = 0.0f;
        rings[ringCount].strength = strength;
        ringCount++;
    }

    struct Fish {
        float x;
        float y;
        float a;
        float len;
        int   id;
        float phase;
        float turn;
        float speed;
        float speedBase;
        float speedPhase;
        float trailX[11];
        float trailY[11];
        int   trailCount;
        float trailClock;
    };
    static Fish allFish[8];

    struct Leaf {
        float baseX;
        float baseY;
        float x;
        float y;
        float r;
        float a;
        float driftPhase;
        int   id;
    };
    static Leaf allLeaves[24];

    // Power lookup tables
    static float pow065_LUT[256];
    static float pow22_LUT[256];

    // Framebuffer pointer (allocated in PSRAM)
    static float* rgbBuf = nullptr;

    inline void mixColor(const float a[3], const float b[3], float mixVal, float out[3]) {
        out[0] = a[0] + (b[0] - a[0]) * mixVal;
        out[1] = a[1] + (b[1] - a[1]) * mixVal;
        out[2] = a[2] + (b[2] - a[2]) * mixVal;
    }

    inline float angleDiff(float a, float b) {
        float diff = a - b;
        return PFMath::fastAtan2(PFMath::fastSin(diff), PFMath::fastCos(diff));
    }

    inline void dab(float x, float y, const float c[3], float alpha) {
        int ix = (int)floorf(x);
        int iy = (int)floorf(y);
        if (ix < 0 || iy < 0 || ix >= PANEL_RES_W || iy >= PANEL_RES_H) return;
        int idx = (iy * PANEL_RES_W + ix) * 3;
        float a = fmaxf(0.0f, fminf(1.0f, alpha));
        rgbBuf[idx + 0] += (c[0] - rgbBuf[idx + 0]) * a;
        rgbBuf[idx + 1] += (c[1] - rgbBuf[idx + 1]) * a;
        rgbBuf[idx + 2] += (c[2] - rgbBuf[idx + 2]) * a;
    }

    inline void line(float x1, float y1, float x2, float y2, const float c[3], float a) {
        float dx = x2 - x1;
        float dy = y2 - y1;
        int n = (int)ceilf(sqrtf(dx * dx + dy * dy) * 1.4f);
        if (n < 1) n = 1;
        float invN = 1.0f / (float)n;
        for (int i = 0; i <= n; i++) {
            float frac = (float)i * invN;
            dab(x1 + dx * frac, y1 + dy * frac, c, a);
        }
    }

    inline void oval(float x, float y, float rx, float ry, float angle, const float c[3], float alpha) {
        float cs = PFMath::fastCos(angle);
        float sn = PFMath::fastSin(angle);
        float r = fmaxf(rx, ry) + 1.0f;

        int yStart = (int)floorf(y - r);
        if (yStart < 0) yStart = 0;
        int yEnd = (int)ceilf(y + r);
        if (yEnd > PANEL_RES_H) yEnd = PANEL_RES_H;

        int xStart = (int)floorf(x - r);
        if (xStart < 0) xStart = 0;
        int xEnd = (int)ceilf(x + r);
        if (xEnd > PANEL_RES_W) xEnd = PANEL_RES_W;

        float invRx = 1.0f / rx;
        float invRy = 1.0f / ry;
        float minR  = fminf(rx, ry);

        for (int iy = yStart; iy < yEnd; iy++) {
            float dyVal = ((float)iy + 0.5f) - y;
            for (int ix = xStart; ix < xEnd; ix++) {
                float dxVal = ((float)ix + 0.5f) - x;
                float u = (dxVal * cs + dyVal * sn) * invRx;
                float v = (-dxVal * sn + dyVal * cs) * invRy;
                float edge = (1.0f - u * u - v * v) * minR;
                if (edge > 0.0f) {
                    float a = fmaxf(0.0f, fminf(1.0f, alpha * fminf(1.0f, edge)));
                    int idx = (iy * PANEL_RES_W + ix) * 3;
                    rgbBuf[idx + 0] += (c[0] - rgbBuf[idx + 0]) * a;
                    rgbBuf[idx + 1] += (c[1] - rgbBuf[idx + 1]) * a;
                    rgbBuf[idx + 2] += (c[2] - rgbBuf[idx + 2]) * a;
                }
            }
        }
    }

    inline void drawPolygon(const float pts[][2], int numPts, const float c[3], float alpha) {
        float minY = pts[0][1];
        float maxY = pts[0][1];
        for (int i = 1; i < numPts; i++) {
            if (pts[i][1] < minY) minY = pts[i][1];
            if (pts[i][1] > maxY) maxY = pts[i][1];
        }

        int ymin = (int)floorf(minY);
        if (ymin < 0) ymin = 0;
        int ymax = (int)ceilf(maxY);
        if (ymax > PANEL_RES_H) ymax = PANEL_RES_H;

        float aClamped = fmaxf(0.0f, fminf(1.0f, alpha));

        for (int iy = ymin; iy < ymax; iy++) {
            float yVal = (float)iy + 0.5f;
            float hits[8];
            int hitCount = 0;

            for (int i = 0, j = numPts - 1; i < numPts; j = i++) {
                const float* ptA = pts[i];
                const float* ptB = pts[j];
                if ((ptA[1] > yVal) != (ptB[1] > yVal)) {
                    float hitX = ptA[0] + (yVal - ptA[1]) * (ptB[0] - ptA[0]) / (ptB[1] - ptA[1]);
                    hits[hitCount++] = hitX;
                }
            }

            for (int i = 1; i < hitCount; i++) {
                float key = hits[i];
                int k = i - 1;
                while (k >= 0 && hits[k] > key) {
                    hits[k + 1] = hits[k];
                    k--;
                }
                hits[k + 1] = key;
            }

            for (int i = 0; i + 1 < hitCount; i += 2) {
                int xStart = (int)ceilf(hits[i] - 0.5f);
                if (xStart < 0) xStart = 0;
                int xEnd = (int)ceilf(hits[i + 1] - 0.5f);
                if (xEnd > PANEL_RES_W) xEnd = PANEL_RES_W;

                for (int ix = xStart; ix < xEnd; ix++) {
                    int idx = (iy * PANEL_RES_W + ix) * 3;
                    rgbBuf[idx + 0] += (c[0] - rgbBuf[idx + 0]) * aClamped;
                    rgbBuf[idx + 1] += (c[1] - rgbBuf[idx + 1]) * aClamped;
                    rgbBuf[idx + 2] += (c[2] - rgbBuf[idx + 2]) * aClamped;
                }
            }
        }
    }

    inline float spine(const Fish& f, float q) {
        float q2_len = q * q * f.len;
        return PFMath::fastSin(f.phase - q * 5.6f) * q2_len * 0.115f - f.turn * q2_len * 0.13f;
    }

    inline void fishPoint(const Fish& f, float q, float side, float& outX, float& outY) {
        float x = (0.53f - q) * f.len;
        float y = spine(f, q) + side;
        float cs = PFMath::fastCos(f.a);
        float sn = PFMath::fastSin(f.a);
        outX = f.x + x * cs - y * sn;
        outY = f.y + x * sn + y * cs;
    }

    void paintFish(const Fish& f) {
        float bodyBase[3], accentRed[3], darkDetail[3], finColor[3];
        const float cBody1[3] = {255.0f, 230.0f, 180.0f};
        const float cBody2[3] = {25.0f, 28.0f, 26.0f};
        mixColor(cBody1, cBody2, ink, bodyBase);

        const float cRed1[3] = {255.0f, 120.0f, 80.0f};
        const float cRed2[3] = {160.0f, 25.0f, 20.0f};
        mixColor(cRed1, cRed2, ink, accentRed);

        const float cDark1[3] = {100.0f, 130.0f, 120.0f};
        const float cDark2[3] = {10.0f, 15.0f, 12.0f};
        mixColor(cDark1, cDark2, ink, darkDetail);

        const float cFin1[3] = {180.0f, 220.0f, 200.0f};
        const float cFin2[3] = {60.0f, 75.0f, 68.0f};
        mixColor(cFin1, cFin2, ink, finColor);

        // Pectoral fins
        for (int sIdx = 0; sIdx < 2; sIdx++) {
            float side = (sIdx == 0) ? -1.0f : 1.0f;
            float reach = (2.4f + 0.7f * PFMath::fastSin(f.phase * 0.72f + side)) * side;
            float aPt[2], bPt[2], cPt[2];
            fishPoint(f, 0.25f, side * 1.3f, aPt[0], aPt[1]);
            fishPoint(f, 0.37f, reach + side * 1.8f, bPt[0], bPt[1]);
            fishPoint(f, 0.54f, side * 1.5f, cPt[0], cPt[1]);

            float finPoly[3][2] = { {aPt[0], aPt[1]}, {bPt[0], bPt[1]}, {cPt[0], cPt[1]} };
            drawPolygon(finPoly, 3, finColor, 0.65f);
            line(aPt[0], aPt[1], bPt[0], bPt[1], bodyBase, 0.42f);
        }

        // Tail
        float tail[4][2];
        fishPoint(f, 0.88f, 0.0f, tail[0][0], tail[0][1]);
        fishPoint(f, 1.25f, -3.3f, tail[1][0], tail[1][1]);
        fishPoint(f, 1.18f, 0.0f, tail[2][0], tail[2][1]);
        fishPoint(f, 1.25f, 3.3f, tail[3][0], tail[3][1]);
        drawPolygon(tail, 4, bodyBase, 0.76f);

        float p92[2];
        fishPoint(f, 0.92f, 0.0f, p92[0], p92[1]);
        const float tailS[4] = {-2.8f, -1.4f, 1.4f, 2.8f};
        for (int k = 0; k < 4; k++) {
            float p123[2];
            fishPoint(f, 1.23f, tailS[k], p123[0], p123[1]);
            line(p92[0], p92[1], p123[0], p123[1], finColor, 0.68f);
        }

        // Body rasterization
        float cs = PFMath::fastCos(f.a);
        float sn = PFMath::fastSin(f.a);
        float r = f.len * 0.78f;
        int yStart = (int)floorf(f.y - r);
        if (yStart < 0) yStart = 0;
        int yEnd = (int)ceilf(f.y + r);
        if (yEnd > PANEL_RES_H) yEnd = PANEL_RES_H;

        int xStart = (int)floorf(f.x - r);
        if (xStart < 0) xStart = 0;
        int xEnd = (int)ceilf(f.x + r);
        if (xEnd > PANEL_RES_W) xEnd = PANEL_RES_W;

        float invLen = 1.0f / f.len;

        for (int iy = yStart; iy < yEnd; iy++) {
            float yVal = (float)iy + 0.5f;
            float dy = yVal - f.y;
            for (int ix = xStart; ix < xEnd; ix++) {
                float xVal = (float)ix + 0.5f;
                float dx = xVal - f.x;
                float q = 0.53f - (dx * cs + dy * sn) * invLen;
                if (q < 0.0f || q > 1.0f) continue;

                float cross = -dx * sn + dy * cs - spine(f, q);
                float sinVal = PFMath::fastSin(PI * (q + 0.07f) * (1.0f / 1.07f));
                if (sinVal < 0.0f) sinVal = 0.0f;
                else if (sinVal > 1.0f) sinVal = 1.0f;

                int sinIdx = (int)(sinVal * 255.0f);
                float width = f.len * 0.19f * pow065_LUT[sinIdx] * (1.0f - 0.68f * q);
                float edge = width - fabsf(cross);
                if (edge <= 0.0f) continue;

                float side = cross / (width > 0.001f ? width : 0.001f);
                float patch = PFMath::fastSin(q * 18.0f + (float)f.id * 2.3f)
                            + 0.62f * PFMath::fastCos(side * 3.3f + q * 13.0f + (float)f.id)
                            + 0.3f * PFMath::fastSin(q * 39.0f - side * 5.0f);

                const float* c = bodyBase;
                if (f.id % 3 == 2) {
                    c = (patch > 0.15f) ? bodyBase : darkDetail;
                } else if (patch > 0.23f || (q < 0.19f && (f.id % 2 == 0))) {
                    c = accentRed;
                }

                float light = 0.74f + 0.26f * sqrtf(fmaxf(0.0f, 1.0f - side * side));
                float rim = fminf(1.0f, edge * 0.8f);
                float shade = light * (0.60f + 0.40f * rim);

                float col[3] = { c[0] * shade, c[1] * shade, c[2] * shade };
                float a = fminf(1.0f, edge + 0.25f);

                int idx = (iy * PANEL_RES_W + ix) * 3;
                rgbBuf[idx + 0] += (col[0] - rgbBuf[idx + 0]) * a;
                rgbBuf[idx + 1] += (col[1] - rgbBuf[idx + 1]) * a;
                rgbBuf[idx + 2] += (col[2] - rgbBuf[idx + 2]) * a;
            }
        }

        // Seams, eyes & barbels
        float p30[2], p66[2];
        fishPoint(f, 0.30f, 0.0f, p30[0], p30[1]);
        fishPoint(f, 0.66f, 0.1f, p66[0], p66[1]);
        line(p30[0], p30[1], p66[0], p66[1], bodyBase, 0.32f);

        for (int sIdx = 0; sIdx < 2; sIdx++) {
            float side = (sIdx == 0) ? -1.0f : 1.0f;
            float p23[2], p29[2], eye[2], p015[2], pm055[2];
            fishPoint(f, 0.23f, side * 1.6f, p23[0], p23[1]);
            fishPoint(f, 0.29f, side * 1.8f, p29[0], p29[1]);
            line(p23[0], p23[1], p29[0], p29[1], darkDetail, 0.50f);

            fishPoint(f, 0.105f, side * f.len * 0.070f, eye[0], eye[1]);
            oval(eye[0], eye[1], 0.48f, 0.45f, f.a, darkDetail, 0.98f);

            fishPoint(f, 0.015f, side * 0.45f, p015[0], p015[1]);
            fishPoint(f, -0.055f, side * 0.95f, pm055[0], pm055[1]);
            line(p015[0], p015[1], pm055[0], pm055[1], bodyBase, 0.58f);
        }
    }

    void paintLeaf(const Leaf& l) {
        float cs = PFMath::fastCos(l.a);
        float sn = PFMath::fastSin(l.a);

        float base[3], rim[3];
        const float cBase1[3] = {20.0f, 70.0f, 50.0f};
        const float cBase2[3] = {55.0f, 85.0f, 60.0f};
        mixColor(cBase1, cBase2, ink, base);

        const float cRim1[3] = {40.0f, 110.0f, 80.0f};
        const float cRim2[3] = {90.0f, 130.0f, 95.0f};
        mixColor(cRim1, cRim2, ink, rim);

        int yStart = (int)floorf(l.y - l.r - 1.0f);
        if (yStart < 0) yStart = 0;
        int yEnd = (int)ceilf(l.y + l.r + 1.0f);
        if (yEnd > PANEL_RES_H) yEnd = PANEL_RES_H;

        int xStart = (int)floorf(l.x - l.r - 1.0f);
        if (xStart < 0) xStart = 0;
        int xEnd = (int)ceilf(l.x + l.r + 1.0f);
        if (xEnd > PANEL_RES_W) xEnd = PANEL_RES_W;

        float inv088 = 1.0f / 0.88f;

        for (int iy = yStart; iy < yEnd; iy++) {
            float yVal = (float)iy + 0.5f;
            float dy = (yVal - l.y) * inv088;
            for (int ix = xStart; ix < xEnd; ix++) {
                float xVal = (float)ix + 0.5f;
                float dx = xVal - l.x;
                float u = dx * cs + dy * sn;
                float v = -dx * sn + dy * cs;
                float d = sqrtf(u * u + v * v);
                if (d > l.r || (u > -0.35f && fabsf(v) < (u + 0.4f) * 0.29f)) continue;

                float a = PFMath::fastAtan2(v, u);
                float cosTerm = fmaxf(0.0f, PFMath::fastCos(a * 7.0f + 0.3f * PFMath::fastSin(d)));
                int cosIdx = (int)(cosTerm * 255.0f);
                float vein = pow22_LUT[cosIdx] * 0.13f;
                float shade = 0.91f + 0.09f * PFMath::fastSin(a - 1.0f) + vein;
                const float* c = (d > l.r - 0.65f) ? rim : base;

                float col[3] = { c[0] * shade, c[1] * shade, c[2] * shade };
                float alpha = fmaxf(0.0f, fminf(1.0f, (l.r - d) + 0.3f));

                int idx = (iy * PANEL_RES_W + ix) * 3;
                rgbBuf[idx + 0] += (col[0] - rgbBuf[idx + 0]) * alpha;
                rgbBuf[idx + 1] += (col[1] - rgbBuf[idx + 1]) * alpha;
                rgbBuf[idx + 2] += (col[2] - rgbBuf[idx + 2]) * alpha;
            }
        }
        oval(l.x - 0.5f, l.y, 0.65f, 0.6f, 0.0f, rim, 0.7f);
    }

    void paintRipple(const Ring& r) {
        constexpr float maxAge = 2.8f;
        if (r.age >= maxAge) return;

        float progress = r.age / maxAge;
        float fade = powf(1.0f - progress, 1.8f) * r.strength;
        if (fade <= 0.01f) return;

        float mainR = r.age * 18.0f;

        float crestCol[3], troughCol[3];
        const float cCrest1[3] = {210.0f, 210.0f, 210.0f};
        const float cCrest2[3] = {245.0f, 240.0f, 225.0f};
        mixColor(cCrest1, cCrest2, ink, crestCol);

        const float cTrough1[3] = {30.0f, 30.0f, 30.0f};
        const float cTrough2[3] = {140.0f, 135.0f, 130.0f};
        mixColor(cTrough1, cTrough2, ink, troughCol);

        for (int w = 0; w < 2; w++) {
            float R = mainR - (float)w * 4.8f;
            if (R <= 1.0f) continue;

            float amp = fade * (w == 0 ? 1.0f : 0.5f);

            float rOuter = R + 1.8f;
            float rInner = fmaxf(0.0f, R - 2.4f);
            float rOuterSq = rOuter * rOuter;
            float rInnerSq = rInner * rInner;

            int minY = (int)floorf(r.y - rOuter);
            if (minY < 0) minY = 0;
            int maxY = (int)ceilf(r.y + rOuter);
            if (maxY > PANEL_RES_H) maxY = PANEL_RES_H;

            for (int y = minY; y < maxY; y++) {
                float dyVal = ((float)y + 0.5f) - r.y;
                float dy2 = dyVal * dyVal;
                if (dy2 >= rOuterSq) continue;

                float dxMax = sqrtf(rOuterSq - dy2);

                if (dy2 >= rInnerSq) {
                    int xStart = (int)floorf(r.x - dxMax);
                    if (xStart < 0) xStart = 0;
                    int xEnd = (int)ceilf(r.x + dxMax);
                    if (xEnd > PANEL_RES_W) xEnd = PANEL_RES_W;

                    for (int x = xStart; x < xEnd; x++) {
                        float dxVal = ((float)x + 0.5f) - r.x;
                        float dist = sqrtf(dxVal * dxVal + dy2);
                        float diff = fabsf(dist - R);

                        if (diff < 1.8f) {
                            float ringIntensity = expf(-diff * diff * 1.5f) * amp;
                            dab((float)x + 0.5f, (float)y + 0.5f, crestCol, ringIntensity * 0.45f);

                            float innerDiff = fabsf(dist - (R - 0.9f));
                            if (innerDiff < 1.5f) {
                                float troughIntensity = expf(-innerDiff * innerDiff * 1.8f) * amp;
                                dab((float)x + 0.5f, (float)y + 0.5f, troughCol, troughIntensity * 0.25f);
                            }
                        }
                    }
                } else {
                    float dxMin = sqrtf(rInnerSq - dy2);

                    // Left segment
                    int xStartL = (int)floorf(r.x - dxMax);
                    if (xStartL < 0) xStartL = 0;
                    int xEndL = (int)ceilf(r.x - dxMin);
                    if (xEndL > PANEL_RES_W) xEndL = PANEL_RES_W;

                    for (int x = xStartL; x < xEndL; x++) {
                        float dxVal = ((float)x + 0.5f) - r.x;
                        float dist = sqrtf(dxVal * dxVal + dy2);
                        float diff = fabsf(dist - R);

                        if (diff < 1.8f) {
                            float ringIntensity = expf(-diff * diff * 1.5f) * amp;
                            dab((float)x + 0.5f, (float)y + 0.5f, crestCol, ringIntensity * 0.45f);

                            float innerDiff = fabsf(dist - (R - 0.9f));
                            if (innerDiff < 1.5f) {
                                float troughIntensity = expf(-innerDiff * innerDiff * 1.8f) * amp;
                                dab((float)x + 0.5f, (float)y + 0.5f, troughCol, troughIntensity * 0.25f);
                            }
                        }
                    }

                    // Right segment
                    int xStartR = (int)floorf(r.x + dxMin);
                    if (xStartR < 0) xStartR = 0;
                    int xEndR = (int)ceilf(r.x + dxMax);
                    if (xEndR > PANEL_RES_W) xEndR = PANEL_RES_W;

                    for (int x = xStartR; x < xEndR; x++) {
                        float dxVal = ((float)x + 0.5f) - r.x;
                        float dist = sqrtf(dxVal * dxVal + dy2);
                        float diff = fabsf(dist - R);

                        if (diff < 1.8f) {
                            float ringIntensity = expf(-diff * diff * 1.5f) * amp;
                            dab((float)x + 0.5f, (float)y + 0.5f, crestCol, ringIntensity * 0.45f);

                            float innerDiff = fabsf(dist - (R - 0.9f));
                            if (innerDiff < 1.5f) {
                                float troughIntensity = expf(-innerDiff * innerDiff * 1.8f) * amp;
                                dab((float)x + 0.5f, (float)y + 0.5f, troughCol, troughIntensity * 0.25f);
                            }
                        }
                    }
                }
            }
        }
    }

    void setup() {
        PFMath::buildSinLUT();
        PFColor::buildPowLUTf(0.65f, pow065_LUT);
        PFColor::buildPowLUTf(22.0f, pow22_LUT);

        if (!rgbBuf) {
            rgbBuf = PFMem::allocFloats(PANEL_RES_W * PANEL_RES_H * 3);
        }

        prngSeed = 91517u;
        t = 0.0f;
        speedScale = 1.0f;
        ink = 0.85f;
        reverseFlow = 1.0f;
        inkOverrideActive = false;
        food = {67.0f, 31.0f, 0.0f};
        fright = 0.0f;
        feed = 0.0f;
        ringCount = 0;

        // Fish pool initialization (max 8)
        for (int i = 0; i < 8; i++) {
            float angle = nextRandom() * TWO_PI;
            allFish[i].x = 20.0f + nextRandom() * 88.0f;
            allFish[i].y = 15.0f + nextRandom() * 34.0f;
            allFish[i].a = angle;
            allFish[i].len = 18.0f + nextRandom() * 5.0f;
            allFish[i].id = i;
            allFish[i].phase = (float)i * 1.9f;
            allFish[i].turn = 0.0f;
            allFish[i].speed = 3.0f;
            allFish[i].speedBase = 0.8f + nextRandom() * 0.5f;
            allFish[i].speedPhase = nextRandom() * TWO_PI;
            allFish[i].trailCount = 0;
            allFish[i].trailClock = 0.0f;
        }

        // Leaves pool initialization (max 24)
        for (int i = 0; i < 24; i++) {
            allLeaves[i].baseX = 10.0f + nextRandom() * 108.0f;
            allLeaves[i].baseY = 8.0f + nextRandom() * 48.0f;
            allLeaves[i].x = 0.0f;
            allLeaves[i].y = 0.0f;
            allLeaves[i].r = 4.0f + nextRandom() * 3.5f;
            allLeaves[i].a = nextRandom() * TWO_PI;
            allLeaves[i].driftPhase = nextRandom() * TWO_PI;
            allLeaves[i].id = i;
        }
    }

    void update(float dt, const InputFrame& input) {
        if (!rgbBuf) return;

        float dtClamped = fmaxf(0.0f, fminf(0.05f, dt));

        PFParams::apply(input, 0, &rawKoiCount, 1.0f, 8.0f,  0.146f);
        PFParams::apply(input, 1, &rawLeaves,   1.0f, 24.0f, 0.479f);
        PFParams::apply(input, 2, &rawSpeed,    0.2f, 3.0f,  0.058f);
        PFParams::apply(input, 3, &rawInkMode,  0.0f, 1.0f,  0.021f);

        if (fabsf(rawInkMode - lastRawInk) > 1e-5f) {
            inkOverrideActive = false;
        }
        lastRawInk = rawInkMode;

        if (input.btnPressed[0] && !input.paramAbsoluteActive[0] && !input.knobAudioActive[0]) {
            fright = 2.0f;
            addRing(64.0f, 32.0f, 1.4f);
        }
        if (input.btnPressed[1] && !input.paramAbsoluteActive[1] && !input.knobAudioActive[1]) {
            reverseFlow *= -1.0f;
            for (int i = 0; i < 24; i++) {
                allLeaves[i].baseX = 10.0f + nextRandom() * 108.0f;
                allLeaves[i].baseY = 8.0f + nextRandom() * 48.0f;
                allLeaves[i].driftPhase = nextRandom() * TWO_PI;
                allLeaves[i].a = nextRandom() * TWO_PI;
            }
        }
        if (input.btnPressed[2] && !input.paramAbsoluteActive[2] && !input.knobAudioActive[2]) {
            food.x = 30.0f + nextRandom() * 68.0f;
            food.y = 17.0f + nextRandom() * 30.0f;
            food.age = 0.0f;
            feed = 10.0f;
            addRing(food.x, food.y, 1.0f);
        }
        if (input.btnPressed[3] && !input.paramAbsoluteActive[3] && !input.knobAudioActive[3]) {
            inkOverrideActive = true;
            inkOverrideVal = (ink > 0.5f) ? 0.0f : 1.0f;
        }

        speedScale = fmaxf(0.2f, fminf(3.0f, rawSpeed));
        float targetInk = inkOverrideActive ? inkOverrideVal : rawInkMode;
        float ease = 1.0f - expf(-dtClamped * 6.0f);
        ink += (targetInk - ink) * ease;

        float simDt = dtClamped * speedScale;
        t += simDt;
        if (t >= 6283.185307f) t -= 6283.185307f;

        fright   = fmaxf(0.0f, fright - simDt);
        feed     = fmaxf(0.0f, feed - simDt);
        food.age += simDt;

        float boostRatio = fmaxf(0.0f, fminf(1.0f, fright * 0.5f));
        float currentSpeedScale = speedScale + (2.5f - speedScale) * boostRatio;

        int curKoiCount = (int)roundf(rawKoiCount);
        if (curKoiCount < 1) curKoiCount = 1;
        if (curKoiCount > 8) curKoiCount = 8;

        float positions[8][2];
        for (int i = 0; i < curKoiCount; i++) {
            positions[i][0] = allFish[i].x;
            positions[i][1] = allFish[i].y;
        }

        for (int i = 0; i < curKoiCount; i++) {
            Fish& f = allFish[i];
            float roamAngle = f.a + 0.65f * PFMath::fastSin(t * 0.21f + (float)i * 2.4f)
                                  + 0.32f * PFMath::fastSin(t * 0.47f + (float)i * 0.7f);
            float orbit = t * 0.23f + ((float)i * TWO_PI) / (float)curKoiCount;
            float tx = food.x + PFMath::fastCos(orbit) * 16.0f;
            float ty = food.y + PFMath::fastSin(orbit) * 12.0f;
            float toTx = tx - f.x;
            float toTy = ty - f.y;
            float distance = sqrtf(toTx * toTx + toTy * toTy);
            if (distance < 1.0f) distance = 1.0f;

            float gathering = (feed > 0.0f) ? 0.8f : 0.2f;
            float invDist = 1.0f / distance;
            float dx = PFMath::fastCos(roamAngle) * (0.8f - gathering * 0.6f) + toTx * invDist * gathering * 1.2f;
            float dy = PFMath::fastSin(roamAngle) * (0.8f - gathering * 0.6f) + toTy * invDist * gathering * 1.2f;

            for (int j = 0; j < curKoiCount; j++) {
                if (i != j) {
                    float sx = f.x - positions[j][0];
                    float sy = f.y - positions[j][1];
                    float d2 = sx * sx + sy * sy;
                    if (d2 < 576.0f) {
                        float d = sqrtf(fmaxf(d2, 1.0f));
                        float rep = (((24.0f - d) * (1.0f / 24.0f)) * 2.8f) / d;
                        dx += sx * rep;
                        dy += sy * rep;
                    }
                }
            }

            float aheadX = f.x + PFMath::fastCos(f.a) * 7.0f;
            float aheadY = f.y + PFMath::fastSin(f.a) * 7.0f;
            dx += fmaxf(0.0f, 18.0f - aheadX) * 0.26f - fmaxf(0.0f, aheadX - 110.0f) * 0.26f;
            dy += fmaxf(0.0f, 16.0f - aheadY) * 0.30f - fmaxf(0.0f, aheadY - 48.0f) * 0.30f;

            if (fright > 0.0f) {
                float ax = f.x - 64.0f;
                float ay = f.y - 32.0f;
                float d = sqrtf(ax * ax + ay * ay);
                if (d < 1.0f) d = 1.0f;
                dx += (ax / d) * boostRatio * 2.0f;
                dy += (ay / d) * boostRatio * 2.0f;
            }

            float desired = PFMath::fastAtan2(dy, dx);
            float turn = fmaxf(-1.2f, fminf(1.2f, angleDiff(desired, f.a) * 1.5f));
            f.turn += (turn - f.turn) * (1.0f - expf(-simDt * 4.0f));
            f.a += f.turn * simDt;

            float speedNoise = PFMath::fastSin(t * 0.6f + f.speedPhase) * 0.4f + PFMath::fastSin(t * 1.3f + (float)f.id * 2.1f) * 0.2f;
            float targetSpeed = (2.8f * f.speedBase + speedNoise) * currentSpeedScale;
            f.speed += (targetSpeed - f.speed) * (1.0f - expf(-simDt * 4.0f));

            f.x += PFMath::fastCos(f.a) * f.speed * simDt;
            f.y += PFMath::fastSin(f.a) * f.speed * simDt;
            f.x = fmaxf(8.0f, fminf(120.0f, f.x));
            f.y = fmaxf(7.0f, fminf(57.0f, f.y));

            f.phase += simDt * (3.2f + f.speed * 0.8f);
            if (f.phase >= 6283.185307f) f.phase -= 6283.185307f;

            f.trailClock += simDt;
            if (f.trailClock > 0.2f) {
                f.trailClock = 0.0f;
                for (int k = 9; k > 0; k--) {
                    f.trailX[k] = f.trailX[k - 1];
                    f.trailY[k] = f.trailY[k - 1];
                }
                f.trailX[0] = f.x;
                f.trailY[0] = f.y;
                if (f.trailCount < 10) f.trailCount++;
            }
        }

        int curLeafCount = (int)roundf(rawLeaves);
        if (curLeafCount < 1) curLeafCount = 1;
        if (curLeafCount > 24) curLeafCount = 24;

        const float driftSpeed = 0.12f * reverseFlow;
        for (int i = 0; i < curLeafCount; i++) {
            Leaf& l = allLeaves[i];
            l.driftPhase += simDt * 0.15f;
            if (l.driftPhase >= 6283.185307f) l.driftPhase -= 6283.185307f;

            l.x = l.baseX + PFMath::fastSin(t * 0.1f * driftSpeed + l.driftPhase) * 4.5f;
            l.y = l.baseY + PFMath::fastCos(t * 0.07f * driftSpeed + l.driftPhase) * 3.0f;
            l.a += simDt * 0.03f * driftSpeed;
            if (l.a >= 6283.185307f) l.a -= 6283.185307f;
            else if (l.a <= -6283.185307f) l.a += 6283.185307f;
        }

        for (int i = 0; i < ringCount; i++) {
            rings[i].age += simDt;
        }
        int activeRings = 0;
        for (int i = 0; i < ringCount; i++) {
            if (rings[i].age < 2.8f) {
                if (activeRings != i) rings[activeRings] = rings[i];
                activeRings++;
            }
        }
        ringCount = activeRings;
    }

    void draw() {
        if (!rgbBuf) {
            PFCanvas::present();
            return;
        }

        const bool isPureDark = (ink < 0.01f);

        float water[3], glint[3], shadow[3];
        if (isPureDark) {
            water[0] = 0.0f; water[1] = 0.0f; water[2] = 0.0f;
            glint[0] = 0.0f; glint[1] = 0.0f; glint[2] = 0.0f;
            shadow[0] = 0.0f; shadow[1] = 0.0f; shadow[2] = 0.0f;
        } else {
            const float cZero[3] = {0.0f, 0.0f, 0.0f};
            const float cWaterTarget[3] = {230.0f, 226.0f, 205.0f};
            mixColor(cZero, cWaterTarget, ink, water);

            const float cGlintTarget[3] = {242.0f, 238.0f, 220.0f};
            mixColor(cZero, cGlintTarget, ink, glint);

            const float cShadowTarget[3] = {100.0f, 115.0f, 105.0f};
            mixColor(cZero, cShadowTarget, ink, shadow);
        }

        // Clear & render water surface tone
        for (int y = 0; y < PANEL_RES_H; y++) {
            int rowIdx = y * PANEL_RES_W * 3;
            if (isPureDark) {
                for (int x = 0; x < PANEL_RES_W; x++) {
                    int i = rowIdx + x * 3;
                    rgbBuf[i + 0] = 0.0f;
                    rgbBuf[i + 1] = 0.0f;
                    rgbBuf[i + 2] = 0.0f;
                }
            } else {
                uint32_t gy = (uint32_t)(y * 2 + 9) * 668265263u;
                for (int x = 0; x < PANEL_RES_W; x++) {
                    uint32_t gx = (uint32_t)(x * 2 + 1) * 374761393u;
                    float grain = (float)(((gx ^ gy) >> 8) & 255) * (1.0f / 255.0f) - 0.5f;
                    float tone = grain * 1.5f;

                    int i = rowIdx + x * 3;
                    rgbBuf[i + 0] = fmaxf(0.0f, water[0] + tone);
                    rgbBuf[i + 1] = fmaxf(0.0f, water[1] + tone);
                    rgbBuf[i + 2] = fmaxf(0.0f, water[2] + tone);
                }
            }
        }

        // Ripple waves
        for (int i = 0; i < ringCount; i++) {
            paintRipple(rings[i]);
        }

        int curKoiCount = (int)roundf(rawKoiCount);
        if (curKoiCount < 1) curKoiCount = 1;
        if (curKoiCount > 8) curKoiCount = 8;

        int curLeafCount = (int)roundf(rawLeaves);
        if (curLeafCount < 1) curLeafCount = 1;
        if (curLeafCount > 24) curLeafCount = 24;

        // Fish shadows & swimming trails
        for (int i = 0; i < curKoiCount; i++) {
            const Fish& f = allFish[i];
            if (!isPureDark) {
                oval(f.x + 1.6f, f.y + 2.0f, f.len * 0.54f, f.len * 0.13f, f.a, shadow, 0.25f);
            }
            for (int k = 1; k < f.trailCount; k++) {
                float a = 0.08f * (1.0f - (float)k / (float)f.trailCount);
                line(f.trailX[k - 1], f.trailY[k - 1], f.trailX[k], f.trailY[k], glint, a);
            }
        }

        // Fish bodies
        for (int i = 0; i < curKoiCount; i++) {
            paintFish(allFish[i]);
        }

        // Leaves & shadows
        for (int i = 0; i < curLeafCount; i++) {
            const Leaf& l = allLeaves[i];
            if (!isPureDark) {
                oval(l.x + 0.9f, l.y + 1.3f, l.r, l.r * 0.86f, l.a, shadow, 0.30f);
            }
            paintLeaf(l);
        }

        // Floating food bait
        if (feed > 0.0f) {
            const float foodCol[3] = {255.0f, 180.0f, 60.0f};
            for (int i = 0; i < 5; i++) {
                float a = (float)i * 2.4f + t * 0.12f;
                float rDist = 1.5f + (float)i * 0.65f;
                dab(food.x + PFMath::fastCos(a) * rDist,
                    food.y + PFMath::fastSin(a) * rDist * 0.6f,
                    foodCol, 0.9f);
            }
        }

        // Final display writeout
        for (int y = 0; y < PANEL_RES_H; y++) {
            int rowIdx = y * PANEL_RES_W * 3;
            for (int x = 0; x < PANEL_RES_W; x++) {
                int i = rowIdx + x * 3;
                int rVal = (int)(rgbBuf[i + 0] + 0.5f);
                int gVal = (int)(rgbBuf[i + 1] + 0.5f);
                int bVal = (int)(rgbBuf[i + 2] + 0.5f);

                uint8_t rOut = (uint8_t)(rVal < 0 ? 0 : (rVal > 255 ? 255 : rVal));
                uint8_t gOut = (uint8_t)(gVal < 0 ? 0 : (gVal > 255 ? 255 : gVal));
                uint8_t bOut = (uint8_t)(bVal < 0 ? 0 : (bVal > 255 ? 255 : bVal));

                PFCanvas::setPixel(x, y, rOut, gOut, bOut);
            }
        }

        PFCanvas::present();
    }

} // namespace KoiPond