#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_math.h"
#include "src/core_color.h"

namespace ModularVoronoiThresholds {

    const char* NAME = "CircleGetsTheSquare";
    const char* const KNOB_LABELS[4] = {"Palette", "Speed", "Density", "Thickness"};

    // Pattern state & knob definitions
    static float kPaletteShift = 0.399f; // Min 0.0, Max 1.0
    static float kSpeed        = 9.195f; // Min 0.0, Max 25.0
    static float kGridDensity  = 0.562f; // Min -1.25, Max 10.0
    static float kEdgeThickness= 0.411f; // Min -1.5, Max 1.5

    static float timeAcc = 0.0f;

    void setup() {
        PFMath::buildSinLUT();
    }

    void update(float dt, const InputFrame& input) {
        kPaletteShift  += input.knobDeltas[0] * 0.05f;
        kPaletteShift   = fminf(fmaxf(kPaletteShift, 0.0f), 1.0f);

        kSpeed         += input.knobDeltas[1] * 0.1f;
        kSpeed          = fminf(fmaxf(kSpeed, 0.0f), 25.0f);

        kGridDensity   += input.knobDeltas[2] * 0.05f;
        kGridDensity    = fminf(fmaxf(kGridDensity, -1.25f), 10.0f);

        kEdgeThickness += input.knobDeltas[3] * 0.05f;
        kEdgeThickness  = fminf(fmaxf(kEdgeThickness, -1.5f), 1.5f);

        timeAcc += dt * kSpeed * 0.7f;
        if (timeAcc > 20.0f * PI) {
            timeAcc -= 20.0f * PI;
        }
    }

    void draw() {
        float gridSize = 16.0f + kGridDensity * 12.0f;
        if (gridSize < 1.0f) gridSize = 1.0f;
        float invGridSize = 1.0f / gridSize;

        float edgeGate = 0.1f + kEdgeThickness * 0.3f;
        float edgeGatePlusDot = edgeGate + 0.25f;
        float edgeGatePlusGap = edgeGate + 0.45f;

        float t = timeAcc;
        float t08 = t * 0.8f;

        // Precompute color stops per cell ID (0 to 10)
        uint8_t rCenter[11], gCenter[11], bCenter[11];
        uint8_t rDot[11], gDot[11], bDot[11];
        uint8_t rLine[11], gLine[11], bLine[11];

        for (int i = 0; i < 11; i++) {
            float idShift = i * 0.09f;
            
            float hCenter = PFMath::fract(kPaletteShift + idShift);
            PFColor::hsvToRgb(hCenter, 0.9f, 1.0f, rCenter[i], gCenter[i], bCenter[i]);

            float hDot = PFMath::fract(kPaletteShift + idShift + 0.2f);
            PFColor::hsvToRgb(hDot, 0.85f, 1.0f, rDot[i], gDot[i], bDot[i]);

            float hLine = PFMath::fract(kPaletteShift + idShift + 0.5f);
            PFColor::hsvToRgb(hLine, 0.95f, 1.0f, rLine[i], gLine[i], bLine[i]);
        }

        for (int y = 0; y < PANEL_RES_H; y++) {
            int cellY = (int)floorf((float)y * invGridSize);
            float localY = ((float)y - (float)cellY * gridSize) * invGridSize;

            for (int x = 0; x < PANEL_RES_W; x++) {
                int cellX = (int)floorf((float)x * invGridSize);
                float localX = ((float)x - (float)cellX * gridSize) * invGridSize;

                float angleX = t + (float)cellX * 2.1f + (float)cellY * 1.4f;
                float angleY = t08 + (float)cellX * 1.7f + (float)cellY * 2.5f;

                float seedX = 0.5f + 0.3f * PFMath::fastSin(angleX);
                float seedY = 0.5f + 0.3f * PFMath::fastCos(angleY);

                float dx = localX - seedX;
                float dy = localY - seedY;
                float dist = sqrtf(dx * dx + dy * dy);

                int cellID = (cellX * 7 + cellY * 13) % 11;
                if (cellID < 0) cellID += 11;

                uint8_t r = 0, g = 0, b = 0;

                if (dist < edgeGate) {
                    r = rCenter[cellID];
                    g = gCenter[cellID];
                    b = bCenter[cellID];
                } else if (dist < edgeGatePlusDot) {
                    if ((x & 1) == 0 && (y & 1) == 0) {
                        r = rDot[cellID];
                        g = gDot[cellID];
                        b = bDot[cellID];
                    }
                } else if (dist < edgeGatePlusGap) {
                    r = 0; g = 0; b = 0;
                } else {
                    if ((x + y) % 3 == 0) {
                        r = rLine[cellID];
                        g = gLine[cellID];
                        b = bLine[cellID];
                    }
                }

                PFCanvas::setPixel(x, y, r, g, b);
            }
        }

        PFCanvas::present();
    }

} // namespace ModularVoronoiThresholds