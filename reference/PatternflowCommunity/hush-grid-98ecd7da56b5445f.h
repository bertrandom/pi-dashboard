#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_params.h"
#include "src/core_math.h"
#include "src/core_noise.h"

namespace HushInspiredGridPattern {

    const char* NAME = "HUSH Grid";
    const char* const KNOB_LABELS[4] = {"Grid Density", "Speed", "Seed", "Color Shift"};
    constexpr bool ABSOLUTE_READY = true;

    static float quantize = 3.676f;
    static float speed = 1.109f;
    static float phaseShift = 1.351f;
    static float colorCycles = 5.936f;

    static float timeAcc = 0.0f;

    struct Theme {
        uint8_t fg[3];
        uint8_t bg[3];
    };

    static const Theme THEMES[10] = {
        {{210, 35, 35},   {240, 238, 232}}, // Crimson on Cream
        {{20, 20, 22},     {240, 238, 232}}, // Black on Cream
        {{35, 165, 185},  {240, 238, 232}}, // Cyan/Teal on Cream
        {{210, 35, 35},   {20, 20, 22}},    // Crimson on Black
        {{230, 160, 195}, {20, 20, 22}},    // Rose Pink on Black
        {{35, 165, 185},  {210, 35, 35}},   // Teal on Crimson
        {{240, 238, 232}, {60, 65, 75}},    // Cream on Dark Slate
        {{20, 20, 22},     {35, 165, 185}},  // Black on Cyan
        {{220, 175, 50},  {20, 20, 22}},    // Ochre Gold on Black
        {{240, 238, 232}, {210, 35, 35}}    // Cream on Crimson
    };

    inline float pseudoHash(float n) {
        float val = PFNoise::cellHash((int32_t)(n * 1000.0f), 0, 42);
        return val;
    }

    void setup() {
        PFMath::buildSinLUT();
    }

    void update(float dt, const InputFrame& input) {
        PFParams::apply(input, 0, &quantize, 1.0f, 12.0f, 0.229f);
        PFParams::apply(input, 1, &speed, 0.1f, 10.0f, 0.206f);
        PFParams::apply(input, 2, &phaseShift, 0.0f, 5.0f, 0.104f);
        PFParams::apply(input, 3, &colorCycles, 1.0f, 10.0f, 0.188f);

        timeAcc += dt * (speed * 0.15f) * 10.0f;
        if (timeAcc > 10000.0f) {
            timeAcc -= 10000.0f;
        }
    }

    inline int sampleMotif(int type, float x, float y) {
        int ix = PFMath::ifloor(x);
        int iy = PFMath::ifloor(y);

        switch (type % 20) {
            case 0: { // Concentric Chevrons
                int modX = PFMath::jsMod(ix, 12);
                int absX = PFMath::ifloor(fabsf((float)(modX - 6)));
                int cy = PFMath::jsMod(iy + absX, 8);
                return cy < 4 ? 1 : 0;
            }
            case 1: { // Floral Petal Blossoms
                int fx = PFMath::jsMod(ix, 6) - 3;
                int fy = PFMath::jsMod(iy, 6) - 3;
                int r2 = fx * fx + fy * fy;
                bool petal = (PFMath::ifloor(fabsf((float)fx)) == 1 || PFMath::ifloor(fabsf((float)fy)) == 1) && r2 < 8;
                bool center = r2 <= 1;
                return (petal && !center) ? 1 : 0;
            }
            case 2: { // Harlequin Sawtooth Chains
                int tx = PFMath::jsMod(ix, 6);
                int ty = PFMath::jsMod(iy, 8);
                int h = ty < 4 ? ty : 7 - ty;
                return tx <= h ? 1 : 0;
            }
            case 3: { // Bold Graffiti / Camo Stroke
                float v1 = PFMath::fastSin(ix * 0.35f + PFMath::fastCos(iy * 0.25f));
                float v2 = PFMath::fastCos(iy * 0.3f + PFMath::fastSin(ix * 0.4f));
                return (v1 + v2 > 0.2f) ? 1 : 0;
            }
            case 4: { // Zebra / Bark Warp Stripes
                int wave = PFMath::ifloor(PFMath::fastSin(iy * 0.25f) * 2.5f);
                int sx = PFMath::jsMod(ix + wave, 6);
                return sx < 3 ? 1 : 0;
            }
            case 5: { // Ornamental Vine Lace
                int dx = PFMath::ifloor(fabsf((float)(PFMath::jsMod(ix, 8) - 4)));
                int dy = PFMath::ifloor(fabsf((float)(PFMath::jsMod(iy, 8) - 4)));
                return (dx + dy == 3 || dx + dy == 1) ? 1 : 0;
            }
            case 6: { // Interlocking Herringbone Ribbon
                int hx = PFMath::jsMod(ix, 8);
                int hy = PFMath::jsMod(iy, 8);
                int dir = (hx / 4 == 0) ? 1 : -1;
                return (PFMath::jsMod(hy + hx * dir, 4) < 2) ? 1 : 0;
            }
            case 7: { // Micro Chevron Chain / Stitched Zig-Zag
                int zx = PFMath::jsMod(ix, 6);
                int zy = PFMath::jsMod(iy, 6);
                int offset = zx < 3 ? zx : 5 - zx;
                return (PFMath::jsMod(zy + offset, 3) < 1) ? 1 : 0;
            }
            case 8: { // Bold Diagonal Barcode Slashes
                int s = PFMath::jsMod(ix * 2 + iy, 8);
                return s < 4 ? 1 : 0;
            }
            case 9: { // Scallop / Fish Scale Weave
                int sx = PFMath::jsMod(ix, 6) - 3;
                int sy = PFMath::jsMod(iy, 4);
                return (sx * sx + sy * sy <= 5) ? 1 : 0;
            }
            case 10: { // Ikat Woven Diamond Argyle
                int dx = PFMath::ifloor(fabsf((float)(PFMath::jsMod(ix, 8) - 4)));
                int dy = PFMath::ifloor(fabsf((float)(PFMath::jsMod(iy, 8) - 4)));
                return (dx + dy <= 3) ? 1 : 0;
            }
            case 11: { // Sunburst Radiating Rays
                float rx = (float)(PFMath::jsMod(ix, 10) - 5);
                float ry = (float)(PFMath::jsMod(iy, 10) - 5);
                float angle = PFMath::fastAtan2(ry, rx);
                return (PFMath::jsMod(PFMath::ifloor((angle + PI) * 2.5f), 2) == 0) ? 1 : 0;
            }
            case 12: { // Flame / Wavy Ripple Stripes
                int wave = PFMath::ifloor(PFMath::fastSin(ix * 0.4f) * 2.0f);
                int sy = PFMath::jsMod(iy + wave, 6);
                return sy < 3 ? 1 : 0;
            }
            case 13: { // Interlocking Loop Chain
                int lx = PFMath::jsMod(ix, 6) - 3;
                int ly = PFMath::jsMod(iy, 6) - 3;
                int dist = lx * lx + ly * ly;
                return (dist >= 2 && dist <= 7) ? 1 : 0;
            }
            case 14: { // Cross-Hatch Ribbon Weave
                int h1 = PFMath::jsMod(ix + iy, 6);
                int h2 = PFMath::jsMod(ix - iy + 12, 6);
                return (h1 < 2 || h2 < 2) ? 1 : 0;
            }
            case 15: { // Hourglass / Bowtie Stack
                int bx = PFMath::ifloor(fabsf((float)(PFMath::jsMod(ix, 6) - 3)));
                int by = PFMath::ifloor(fabsf((float)(PFMath::jsMod(iy, 6) - 3)));
                return bx >= by ? 1 : 0;
            }
            case 16: { // Houndstooth Splatter
                int hx = PFMath::jsMod(ix, 8);
                int hy = PFMath::jsMod(iy, 8);
                int qX = hx / 4;
                int qY = hy / 4;
                if (qX == 0 && qY == 0) return 1;
                if (qX == 1 && qY == 1) return 0;
                return ((hx % 4) + (hy % 4) >= 4) ? 1 : 0;
            }
            case 17: { // Vertical Pin-Stripe Ribs
                int px = PFMath::jsMod(ix, 5);
                return px < 2 ? 1 : 0;
            }
            case 18: { // Concentric Ring Target Waves
                int rx = PFMath::jsMod(ix, 10) - 5;
                int ry = PFMath::jsMod(iy, 10) - 5;
                int dist = PFMath::ifloor(sqrtf((float)(rx * rx + ry * ry)));
                return (dist % 2 == 0) ? 1 : 0;
            }
            default: { // Abstract Splatter Hatch
                float h1 = PFMath::jsMod(ix + iy * 0.7f, 6.0f);
                float h2 = PFMath::jsMod(ix * 0.7f - iy, 6.0f);
                return (h1 < 2.0f || h2 < 2.0f) ? 1 : 0;
            }
        }
    }

    inline int getConstrainedMotif(int col, int row, float seed) {
        float baseHash = pseudoHash(col * 17.3f + row * 31.7f + seed * 11.1f);
        int motifIndex = PFMath::ifloor(baseHash * 20.0f);

        if (col > 0) {
            float leftHash = pseudoHash((col - 1) * 17.3f + row * 31.7f + seed * 11.1f);
            int leftMotif = PFMath::ifloor(leftHash * 20.0f);
            if (motifIndex == leftMotif) {
                motifIndex = (motifIndex + 7) % 20;
            }
        }

        if (row > 0) {
            float topHash = pseudoHash(col * 17.3f + (row - 1) * 31.7f + seed * 11.1f);
            int topMotif = PFMath::ifloor(topHash * 20.0f);
            if (motifIndex == topMotif) {
                motifIndex = (motifIndex + 11) % 20;
            }
        }

        return motifIndex;
    }

    void draw() {
        int w = PANEL_RES_W;
        int h = PANEL_RES_H;

        int numRows = PFMath::ifloor(1.0f + ((quantize - 1.0f) / 11.0f) * 5.0f);
        if (numRows < 1) numRows = 1;
        
        float tileSize = (float)h / (float)numRows;

        int numCols = PFMath::ifloor((float)w / tileSize + 0.5f);
        if (numCols < 1) numCols = 1;
        float actualTileWidth = (float)w / (float)numCols;

        float seed = phaseShift;

        int colorStep = PFMath::ifloor(colorCycles * 4.0f);
        float knobHash = pseudoHash((float)colorStep * 13.37f + 42.0f);

        constexpr float patternScale = 0.85f;

        for (int y = 0; y < h; y++) {
            int rowIdx = PFMath::ifloor((float)y / tileSize);
            float localY = PFMath::jsMod((float)y, tileSize);

            for (int x = 0; x < w; x++) {
                int colIdx = PFMath::ifloor((float)x / actualTileWidth);
                float localX = PFMath::jsMod((float)x, actualTileWidth);

                int motifType = getConstrainedMotif(colIdx, rowIdx, seed);

                float tileUniqueSeed = pseudoHash(colIdx * 23.5f + rowIdx * 41.3f + seed * 9.3f);
                int randomThemeIndex = PFMath::ifloor(pseudoHash(knobHash * 100.0f + tileUniqueSeed * 10.0f) * 10.0f);
                if (randomThemeIndex < 0) randomThemeIndex = 0;
                if (randomThemeIndex > 9) randomThemeIndex = 9;
                const Theme& theme = THEMES[randomThemeIndex];

                float dirHash = pseudoHash(colIdx * 13.1f + rowIdx * 19.3f + seed * 3.7f);
                int dir = PFMath::ifloor(dirHash * 4.0f);
                float speedMult = 0.8f + pseudoHash(colIdx * 3.3f + rowIdx * 5.5f) * 0.4f;
                int moveAmount = PFMath::ifloor(timeAcc * 6.0f * speedMult);

                float offsetX = 0.0f;
                float offsetY = 0.0f;

                switch (dir) {
                    case 0: offsetY = (float)(-moveAmount); break;
                    case 1: offsetY = (float)(moveAmount); break;
                    case 2: offsetX = (float)(-moveAmount); break;
                    case 3: offsetX = (float)(moveAmount); break;
                }

                float phaseX = (float)PFMath::ifloor(pseudoHash(colIdx * 11.3f + rowIdx * 5.7f) * 16.0f);
                float phaseY = (float)PFMath::ifloor(pseudoHash(colIdx * 3.7f + rowIdx * 13.1f) * 16.0f);

                float sampleX = (localX - actualTileWidth * 0.5f + offsetX) * patternScale + phaseX;
                float sampleY = (localY - tileSize * 0.5f + offsetY) * patternScale + phaseY;

                int bit = sampleMotif(motifType, sampleX, sampleY);

                if (bit > 0) {
                    PFCanvas::setPixel(x, y, theme.fg[0], theme.fg[1], theme.fg[2]);
                } else {
                    PFCanvas::setPixel(x, y, theme.bg[0], theme.bg[1], theme.bg[2]);
                }
            }
        }

        PFCanvas::present();
    }

} // namespace HushInspiredGridPattern