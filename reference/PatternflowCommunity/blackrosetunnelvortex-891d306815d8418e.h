#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_math.h"
#include "src/core_tables.h"

namespace BlackRoseTunnelVortex {

    const char* NAME = "Black Rose Tunnel Vortex";
    const char* const KNOB_LABELS[4] = {"Speed", "Twist", "Zoom", "Grid"};

    // Initial state matching initial knob values from source
    static float speed = 0.647f;
    static float twist = 7.317f;
    static float zoom = 2.034f;
    static float grid = 4.0f;
    static float timeAcc = 0.0f;

    static const uint8_t RAMP_LUT[256][3] = {
      {255,255,255},{251,251,251},{248,248,248},{244,244,244},{240,240,240},{236,236,236},{233,233,233},{229,229,229},
      {225,225,225},{221,221,221},{218,218,218},{214,214,214},{210,210,210},{206,206,206},{203,203,203},{199,199,199},
      {195,195,195},{192,192,192},{188,188,188},{184,184,184},{180,180,180},{177,177,177},{173,173,173},{169,169,169},
      {165,165,165},{162,162,162},{158,158,158},{154,154,154},{151,151,151},{147,147,147},{143,143,143},{139,139,139},
      {136,136,136},{132,132,132},{128,128,128},{124,124,124},{121,121,121},{117,117,117},{113,113,113},{109,109,109},
      {106,106,106},{102,102,102},{98,98,98},{95,95,95},{91,91,91},{87,87,87},{83,83,83},{80,80,80},
      {76,76,76},{72,72,72},{68,68,68},{65,65,65},{61,61,61},{57,57,57},{54,54,54},{50,50,50},
      {46,46,46},{42,42,42},{39,39,39},{35,35,35},{31,31,31},{27,27,27},{24,24,24},{20,20,20},
      {16,16,16},{12,12,12},{9,9,9},{5,5,5},{1,1,1},{0,0,0},{0,0,0},{0,0,0},
      {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
      {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
      {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
      {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
      {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
      {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
      {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
      {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
      {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
      {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
      {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
      {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
      {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
      {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
      {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
      {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
      {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
      {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
      {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
      {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
      {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
      {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
      {0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},{0,0,0},
    };

    void setup() {
        PFTables::init();
        PFMath::buildSinLUT();
    }

    void update(float dt, const InputFrame& input) {
        speed += input.knobDeltas[0] * 0.05f;
        speed = fminf(fmaxf(speed, -3.0f), 3.0f);

        twist += input.knobDeltas[1] * 0.1f;
        twist = fminf(fmaxf(twist, 0.0f), 10.0f);

        zoom += input.knobDeltas[2] * 0.05f;
        zoom = fminf(fmaxf(zoom, 1.0f), 3.0f);

        grid += input.knobDeltas[3] * 0.05f;
        grid = fminf(fmaxf(grid, 2.0f), 4.0f);

        timeAcc += dt * speed;
        if (timeAcc > TWO_PI) timeAcc -= TWO_PI;
        if (timeAcc < -TWO_PI) timeAcc += TWO_PI;
    }

    void draw() {
        const float t = timeAcc;
        const float twistFactor = twist * 0.05f;
        const int gridVal = (int)grid;
        const float t4 = t * 4.0f;

        for (uint16_t y = 0; y < PANEL_RES_H; y++) {
            for (uint16_t x = 0; x < PANEL_RES_W; x++) {
                uint32_t idx = y * PANEL_RES_W + x;

                // Conversion of precalculated tables to JS-equivalent normalized coordinates
                // PFTables::rT is normalized to screen height (0 at center, 0.5 at top/bottom edge)
                // JS nx, ny: ny ranges -1..1, nx ranges -2..2 (for 2:1 aspect ratio).
                // r in JS is hypot(nx, ny) = hypot(2*screen_r_x, 2*screen_r_y) = 2 * rT
                float r = PFTables::rT[idx] * 2.0f;
                float a = PFTables::thetaT[idx];

                // Calculate 3D depth coordinate Z
                float z = (zoom / (r + 0.05f)) + t4;
                float angle = a + z * twistFactor;

                // Compute grid tunnel wall wave pattern
                float gridPattern = PFMath::fastSin(angle * (float)gridVal) * PFMath::fastSin(z * 2.0f);
                float isWireframe = fabsf(gridPattern) > 0.4f ? 1.0f : 0.0f;

                // Perspective distance fog fade
                float depthFade = fminf(1.0f, r * 1.5f);
                float v = isWireframe * depthFade;

                // Central vanishing point core glow
                if (r < 0.1f) {
                    v = 1.0f - (r * 10.0f);
                }

                v = fminf(1.0f, fmaxf(0.0f, v));

                int li = (int)(v * 255.0f + 0.5f);
                if (li < 0) li = 0;
                if (li > 255) li = 255;

                PFCanvas::setPixel(x, y, RAMP_LUT[li][0], RAMP_LUT[li][1], RAMP_LUT[li][2]);
            }
        }

        PFCanvas::present();
    }

} // namespace BlackRoseTunnelVortex