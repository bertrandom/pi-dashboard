#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_params.h"
#include "src/core_math.h"
#include "src/core_noise.h"

namespace GelatinousLavaPour {

    const char* NAME = "Gelatinous Lava Pour";
    const char* const KNOB_LABELS[4] = {"FillRate", "BlobCount", "Wobble", "Separation"};
    constexpr bool ABSOLUTE_READY = true;

    constexpr int FRAME_W = 64;
    constexpr int FRAME_H = 128;

    constexpr int COLS = 8;
    constexpr int ROWS = 16;
    constexpr int MAX_BLOBS = COLS * ROWS; // 128

    // Knob states and calibrated steps
    static float kFillRate   = 0.1f;  // min 0.1, max 5, step 0.102
    static float kBlobCount  = 16.0f; // min 16, max 128, step 2.333
    static float kWobble     = 10.0f; // min 0.1, max 10, step 0.206
    static float kSeparation = 2.0f;  // min 0, max 10, step 0.208

    constexpr float STEP_FILL_RATE   = 0.102f;
    constexpr float STEP_BLOB_COUNT  = 2.333f;
    constexpr float STEP_WOBBLE      = 0.206f;
    constexpr float STEP_SEPARATION  = 0.208f;

    static const uint8_t PALETTE[6][3] = {
        {255, 92,  138}, // Raspberry
        {88,  210, 255}, // Sky blue
        {255, 205, 64},  // Honey gold
        {140, 255, 132}, // Lime
        {200, 122, 255}, // Grape
        {255, 150, 64}   // Tangerine
    };

    static const uint8_t RAMP_LUT[256][3] = {
      {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
      {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
      {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
      {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
      {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
      {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
      {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
      {0,0,0},{0,0,0},{0,0,0},{4,4,4},{9,9,9},{13,13,13},{18,18,18},{22,22,22},
      {27,27,27},{31,31,31},{36,36,36},{41,41,41},{45,45,45},{50,50,50},{54,54,54},{59,59,59},
      {64,64,64},{68,68,68},{73,73,73},{77,77,77},{82,82,82},{87,87,87},{91,91,91},{96,96,96},
      {100,100,100},{105,105,105},{110,110,110},{114,114,114},{119,119,119},{123,123,123},{128,128,128},{132,132,132},
      {137,137,137},{142,142,142},{146,146,146},{151,151,151},{155,155,155},{160,160,160},{165,165,165},{169,169,169},
      {174,174,174},{178,178,178},{183,183,183},{188,188,188},{192,192,192},{193,193,190},{193,194,187},{192,195,185},
      {191,196,183},{189,197,180},{186,198,178},{182,200,175},{178,201,173},{173,202,170},{168,203,169},{165,204,170},
      {162,205,172},{160,206,175},{157,207,179},{154,208,183},{151,209,189},{149,210,195},{146,211,201},{143,212,209},
      {140,209,213},{137,202,214},{134,194,216},{131,185,217},{128,175,218},{125,165,219},{121,153,220},{118,141,221},
      {115,128,222},{112,113,223},{118,108,224},{128,105,225},{138,102,226},{149,98,227},{162,95,228},{175,91,229},
      {189,88,230},{204,84,231},{219,80,233},{234,77,231},{235,73,215},{236,69,199},{237,66,181},{238,62,162},
      {239,58,142},{240,54,122},{241,50,100},{242,46,77},{243,42,53},{244,48,38},{245,66,34},{246,85,30},
      {247,105,26},{249,127,22},{250,149,18},{251,172,13},{252,196,9},{253,222,5},{254,248,0},{254,215,4},
      {254,177,9},{254,140,13},{254,105,18},{254,71,22},{254,38,27},{254,32,56},{254,36,95},{254,41,132},
      {254,45,168},{254,50,202},{254,55,235},{242,59,255},{212,64,255},{184,68,255},{157,73,255},{131,78,255},
      {107,82,255},{87,90,255},{92,120,255},{96,149,255},{101,177,255},{105,203,255},{110,228,255},{115,251,255},
      {117,242,255},{119,231,255},{121,220,255},{123,209,255},{125,199,255},{127,189,255},{129,179,255},{131,170,255},
      {132,161,255},{134,152,255},{136,144,255},{141,138,255},{152,140,255},{164,142,255},{175,144,255},{185,146,255},
      {195,148,255},{205,150,255},{215,152,255},{224,154,255},{233,156,255},{242,158,255},{250,160,255},{255,162,252},
      {255,164,244},{255,166,237},{255,168,230},{255,170,223},{255,172,217},{255,174,211},{255,176,205},{255,178,200},
      {255,180,195},{255,181,190},{255,183,186},{255,189,185},{255,196,187},{255,203,189},{255,210,191},{255,217,193},
      {255,223,195},{255,229,197},{255,235,199},{255,240,201},{255,245,203},{255,250,205},{255,254,207},{252,255,209},
      {249,255,211},{245,255,213},{242,255,215},{240,255,217},{238,255,219},{236,255,221},{234,255,223},{233,255,225},
      {232,255,227},{231,255,229},{231,255,231},{232,255,234},{234,255,238},{236,255,241},{238,255,244},{240,255,246},
      {242,255,249},{244,255,250},{246,255,252},{248,255,253},{250,255,254},{252,255,255},{254,255,255},{254,255,255},
    };

    // 8 KB Field LUT replacing per-pixel float division
    constexpr int FIELD_LUT_SIZE = 2048;
    constexpr float FIELD_LUT_MAX_NDSQ = 32.0f;
    constexpr float FIELD_LUT_SCALE = (float)(FIELD_LUT_SIZE - 1) / FIELD_LUT_MAX_NDSQ;
    static float fieldLUT[FIELD_LUT_SIZE];

    struct Blob {
        float x, y;
        float vx, vy;
        float txFrac, tyFrac;
        float sizeFactor;
        float r;
        float activateAt;
        int   born;
        float phase;
        int   colorIdx;

        // Per-frame draw precomputed state
        float cosA, sinA;
        float invRx2, invRy2;
        float curR;
        float reach;
        int   minY, maxY;
        int   minX, maxX;
        float hx, hy;
        float hRadSq;
        float invHRad;
        float cR, cG, cB;
    };

    struct RowBlob {
        int i;
        int minX, maxX;
        float bx;
        float cosA, sinA;
        float dy_sinA, dy_cosA;
        float invRx2, invRy2;
        float cR, cG, cB;
    };

    static Blob blobs[MAX_BLOBS];
    static int activeList[MAX_BLOBS];
    static RowBlob rowBlobs[MAX_BLOBS];

    // Row accumulation buffers (1.3 KB in statics, zero heap/stack pressure)
    static float row_total[FRAME_W];
    static float row_colR[FRAME_W];
    static float row_colG[FRAME_W];
    static float row_colB[FRAME_W];
    static float row_bestField[FRAME_W];
    static int16_t row_best[FRAME_W];

    static float animT = 0.0f;
    static float fillTimer = 0.0f;

    static void seedBlobs() {
        for (int i = 0; i < MAX_BLOBS; i++) {
            Blob& bl = blobs[i];
            int col = i % COLS;
            int row = i / COLS;

            float jx = PFNoise::cellHash(i * 3, 1);
            float jy = PFNoise::cellHash(i * 7, 2);

            bl.txFrac = (col + 0.5f) / (float)COLS + (jx - 0.5f) * (1.0f / (float)COLS) * 0.55f;
            bl.tyFrac = (row + 0.5f) / (float)ROWS + (jy - 0.5f) * (1.0f / (float)ROWS) * 0.55f;

            bl.activateAt = (float)row / (float)ROWS;
            bl.sizeFactor = 0.82f + PFNoise::cellHash(i * 5, 3) * 0.4f;
            bl.colorIdx = i % 6;
            bl.phase = PFNoise::cellHash(i * 9, 4) * TWO_PI;

            bl.vx = 0.0f;
            bl.vy = 0.0f;
            bl.born = 0;
        }
        fillTimer = 0.0f;
    }

    void setup() {
        PFMath::buildSinLUT();

        // Precompute Field LUT: 1.0f / (ndSq + 0.05f)
        for (int i = 0; i < FIELD_LUT_SIZE; i++) {
            float ndSq = (float)i * (FIELD_LUT_MAX_NDSQ / (float)(FIELD_LUT_SIZE - 1));
            fieldLUT[i] = 1.0f / (ndSq + 0.05f);
        }

        seedBlobs();
    }

    void update(float dt, const InputFrame& input) {
        if (input.btnPressed[0] && !input.paramAbsoluteActive[0] && !input.knobAudioActive[0]) {
            seedBlobs();
        }

        PFParams::apply(input, 0, &kFillRate,   0.1f,  5.0f,   STEP_FILL_RATE);
        PFParams::apply(input, 1, &kBlobCount,  16.0f, 128.0f, STEP_BLOB_COUNT);
        PFParams::apply(input, 2, &kWobble,     0.1f,  10.0f,  STEP_WOBBLE);
        PFParams::apply(input, 3, &kSeparation, 0.0f,  10.0f,  STEP_SEPARATION);

        float w = (float)FRAME_W;
        float h = (float)FRAME_H;
        float cellSize = fminf(w / (float)COLS, h / (float)ROWS);

        int activeCount = (int)(kBlobCount + 0.5f);
        if (activeCount < 1) activeCount = 1;
        if (activeCount > MAX_BLOBS) activeCount = MAX_BLOBS;

        animT += dt;
        constexpr float ANIM_PERIOD = 20.0f * PI;
        if (animT >= ANIM_PERIOD) animT -= ANIM_PERIOD;

        fillTimer += dt * kFillRate / 7.0f;
        if (fillTimer > 1.0f) fillTimer = 1.0f;

        float sumX = 0.0f, sumY = 0.0f;
        int bornN = 0;
        for (int i = 0; i < activeCount; i++) {
            if (blobs[i].born) {
                sumX += blobs[i].x;
                sumY += blobs[i].y;
                bornN++;
            }
        }
        float cx = (bornN > 0) ? (sumX / (float)bornN) : (w * 0.5f);
        float cy = (bornN > 0) ? (sumY / (float)bornN) : (h * 0.5f);

        for (int i = 0; i < MAX_BLOBS; i++) {
            Blob& bl = blobs[i];

            if (i >= activeCount) {
                bl.born = 0;
                continue;
            }

            bl.r = cellSize * bl.sizeFactor;

            if (!bl.born && fillTimer >= bl.activateAt) {
                bl.born = 1;
                bl.x = bl.txFrac * w + (PFNoise::cellHash(i * 11, 5) - 0.5f) * cellSize * 0.5f;
                bl.y = -bl.r * 2.0f;
                bl.vx = 0.0f;
                bl.vy = 0.0f;
            }
            if (!bl.born) continue;

            float targetX = bl.txFrac * w;
            float targetY = bl.tyFrac * h;

            float sepNorm = fminf(1.0f, kSeparation / 10.0f);
            float stiffness = 9.0f * (1.0f - sepNorm * 0.88f);
            float dx = targetX - bl.x;
            float dy = targetY - bl.y;
            float ax = dx * stiffness;
            float ay = dy * stiffness;

            if (kSeparation > 0.05f) {
                float ox = bl.x - cx;
                float oy = bl.y - cy;
                float od = sqrtf(ox * ox + oy * oy);
                if (od < 0.5f) {
                    ox = PFNoise::cellHash(i, 6) - 0.5f;
                    oy = PFNoise::cellHash(i, 7) - 0.5f;
                    od = 0.5f;
                }
                float push = kSeparation * 3.2f;
                ax += (ox / od) * push;
                ay += (oy / od) * push;
            }

            float wob = kWobble * cellSize * 0.3f;
            ax += PFMath::fastSin(animT * 3.1f + bl.phase) * wob;
            ay += PFMath::fastCos(animT * 2.4f + bl.phase * 1.31f) * wob;

            bl.vx = (bl.vx + ax * dt) * 0.90f;
            bl.vy = (bl.vy + ay * dt) * 0.90f;

            bl.x += bl.vx * dt;
            bl.y += bl.vy * dt;

            float rad = bl.r;
            if (bl.x < rad) {
                bl.x = rad;
                bl.vx *= -0.6f;
            } else if (bl.x > w - rad) {
                bl.x = w - rad;
                bl.vx *= -0.6f;
            }

            if (bl.y < -rad * 3.0f) {
                bl.y = -rad * 3.0f;
                bl.vy *= -0.4f;
            } else if (bl.y > h - rad) {
                bl.y = h - rad;
                bl.vy *= -0.6f;
            }
        }
    }

    void draw() {
        PFCanvas::setFrame(FRAME_W, FRAME_H);

        int activeLen = 0;
        for (int i = 0; i < MAX_BLOBS; i++) {
            Blob& bl = blobs[i];
            if (!bl.born) continue;

            float speed = sqrtf(bl.vx * bl.vx + bl.vy * bl.vy);
            float stretch = fminf(1.0f, speed / 40.0f);
            float ang = (speed > 0.6f) ? PFMath::fastAtan2(bl.vy, bl.vx) : 0.0f;

            float pulse = 1.0f + PFMath::fastSin(animT * 4.0f + bl.phase) * (0.06f + kWobble * 0.01f);
            float baseR = bl.r * pulse;

            float rx = baseR * (1.0f + stretch * 0.9f);
            float ry = baseR * (1.0f - stretch * 0.35f);
            if (ry < baseR * 0.4f) ry = baseR * 0.4f;

            float cosA = PFMath::fastCos(ang);
            float sinA = PFMath::fastSin(ang);

            bl.cosA = cosA;
            bl.sinA = sinA;
            bl.invRx2 = 1.0f / (rx * rx);
            bl.invRy2 = 1.0f / (ry * ry);
            bl.curR = fmaxf(rx, ry);
            bl.reach = bl.curR * 3.4f;

            // Frame-level AABB bounds
            bl.minY = (int)(bl.y - bl.reach + 0.999f);
            bl.maxY = (int)(bl.y + bl.reach);
            int bMinX = (int)(bl.x - bl.reach + 0.999f);
            int bMaxX = (int)(bl.x + bl.reach);
            if (bMinX < 0) bMinX = 0;
            if (bMaxX >= FRAME_W) bMaxX = FRAME_W - 1;
            bl.minX = bMinX;
            bl.maxX = bMaxX;

            float hlx = -rx * 0.32f;
            float hly = -ry * 0.32f;
            bl.hx = bl.x + (hlx * cosA - hly * sinA);
            bl.hy = bl.y + (hlx * sinA + hly * cosA);

            float hRad = bl.curR * 0.42f;
            bl.hRadSq = hRad * hRad;
            bl.invHRad = 1.0f / hRad;

            bl.cR = (float)PALETTE[bl.colorIdx][0];
            bl.cG = (float)PALETTE[bl.colorIdx][1];
            bl.cB = (float)PALETTE[bl.colorIdx][2];

            activeList[activeLen++] = i;
        }

        constexpr float bgR = 13.0f;
        constexpr float bgG = 11.0f;
        constexpr float bgB = 20.0f;
        constexpr float threshold = 1.0f;
        constexpr float edgeLo = threshold * 0.70f;
        constexpr float edgeHi = threshold * 1.05f;
        constexpr float invEdgeRange = 1.0f / (edgeHi - edgeLo);

        constexpr float coreMix = 0.88f;
        constexpr float bgMix = 1.0f - coreMix;
        constexpr float bgR_mix = bgR * bgMix;
        constexpr float bgG_mix = bgG * bgMix;
        constexpr float bgB_mix = bgB * bgMix;

        constexpr int BG_LUM = (int)(0.2126f * bgR + 0.7152f * bgG + 0.0722f * bgB + 0.5f);

        for (int y = 0; y < FRAME_H; y++) {
            float fy = (float)y;

            // 1. Gather blobs intersecting this row
            int rowCount = 0;
            for (int k = 0; k < activeLen; k++) {
                int i = activeList[k];
                const Blob& bl = blobs[i];
                if (y < bl.minY || y > bl.maxY || bl.minX > bl.maxX) continue;

                float dy = fy - bl.y;
                RowBlob& rb = rowBlobs[rowCount++];
                rb.i = i;
                rb.minX = bl.minX;
                rb.maxX = bl.maxX;
                rb.bx = bl.x;
                rb.cosA = bl.cosA;
                rb.sinA = bl.sinA;
                rb.dy_sinA = dy * bl.sinA;
                rb.dy_cosA = dy * bl.cosA;
                rb.invRx2 = bl.invRx2;
                rb.invRy2 = bl.invRy2;
                rb.cR = bl.cR;
                rb.cG = bl.cG;
                rb.cB = bl.cB;
            }

            if (rowCount == 0) {
                for (int x = 0; x < FRAME_W; x++) {
                    PFCanvas::setPixel(x, y, RAMP_LUT[BG_LUM][0], RAMP_LUT[BG_LUM][1], RAMP_LUT[BG_LUM][2]);
                }
                continue;
            }

            // 2. Clear row accumulation buffers
            memset(row_total, 0, sizeof(row_total));
            memset(row_colR, 0, sizeof(row_colR));
            memset(row_colG, 0, sizeof(row_colG));
            memset(row_colB, 0, sizeof(row_colB));
            memset(row_bestField, 0, sizeof(row_bestField));
            for (int x = 0; x < FRAME_W; x++) {
                row_best[x] = -1;
            }

            // 3. Splatting: loop over blobs, iterate only within each blob's active X span
            for (int k = 0; k < rowCount; k++) {
                const RowBlob& rb = rowBlobs[k];
                float dx = (float)rb.minX - rb.bx;
                float lx = dx * rb.cosA + rb.dy_sinA;
                float ly = -dx * rb.sinA + rb.dy_cosA;
                float d_lx = rb.cosA;
                float d_ly = -rb.sinA;
                float invRx2 = rb.invRx2;
                float invRy2 = rb.invRy2;
                float cR = rb.cR;
                float cG = rb.cG;
                float cB = rb.cB;
                int blobIdx = rb.i;
                int minX = rb.minX;
                int maxX = rb.maxX;

                for (int x = minX; x <= maxX; x++) {
                    float ndSq = lx * lx * invRx2 + ly * ly * invRy2;
                    lx += d_lx;
                    ly += d_ly;

                    int idx = (int)(ndSq * FIELD_LUT_SCALE);
                    if (idx >= FIELD_LUT_SIZE) idx = FIELD_LUT_SIZE - 1;
                    float field = fieldLUT[idx];

                    row_total[x] += field;
                    row_colR[x] += field * cR;
                    row_colG[x] += field * cG;
                    row_colB[x] += field * cB;

                    if (field > row_bestField[x]) {
                        row_bestField[x] = field;
                        row_best[x] = (int16_t)blobIdx;
                    }
                }
            }

            // 4. Resolve pixels in this row
            for (int x = 0; x < FRAME_W; x++) {
                float total = row_total[x];
                if (total <= edgeLo) {
                    PFCanvas::setPixel(x, y, RAMP_LUT[BG_LUM][0], RAMP_LUT[BG_LUM][1], RAMP_LUT[BG_LUM][2]);
                    continue;
                }

                float t = (total - edgeLo) * invEdgeRange;
                if (t > 1.0f) t = 1.0f;
                float alpha = t * t * (3.0f - 2.0f * t);

                float invTotal = 1.0f / total;
                float gr = row_colR[x] * invTotal * coreMix + bgR_mix;
                float gg = row_colG[x] * invTotal * coreMix + bgG_mix;
                float gb = row_colB[x] * invTotal * coreMix + bgB_mix;

                int best = row_best[x];
                if (best >= 0 && alpha > 0.5f) {
                    const Blob& bb = blobs[best];
                    float hdx = (float)x - bb.hx;
                    float hdy = fy - bb.hy;
                    float hDistSq = hdx * hdx + hdy * hdy;
                    if (hDistSq < bb.hRadSq) {
                        float hFall = 1.0f - sqrtf(hDistSq) * bb.invHRad;
                        float hAlpha = hFall * hFall * 0.55f;
                        float oneMinusH = 1.0f - hAlpha;
                        float add = 255.0f * hAlpha;
                        gr = gr * oneMinusH + add;
                        gg = gg * oneMinusH + add;
                        gb = gb * oneMinusH + add;
                    }
                }

                float oneMinusA = 1.0f - alpha;
                float pr = bgR * oneMinusA + gr * alpha;
                float pg = bgG * oneMinusA + gg * alpha;
                float pb = bgB * oneMinusA + gb * alpha;

                int lum = (int)(0.2126f * pr + 0.7152f * pg + 0.0722f * pb + 0.5f);
                if (lum < 0) lum = 0;
                else if (lum > 255) lum = 255;

                PFCanvas::setPixel(x, y, RAMP_LUT[lum][0], RAMP_LUT[lum][1], RAMP_LUT[lum][2]);
            }
        }

        PFCanvas::present();
    }

} // namespace GelatinousLavaPour