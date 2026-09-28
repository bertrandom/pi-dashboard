#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_math.h"

namespace CosmicClockwork {

    const char* NAME = "Cosmic Clockwork";
    const char* const KNOB_LABELS[4] = {"Orbits", "Speed", "Tilt", "Zoom"};

    constexpr int FRAME_W = 64;
    constexpr int FRAME_H = 128;

    struct Orbit {
        float radius;
        float tiltX;
        float tiltY;
        float tiltZ;
        float speedMult;
        uint8_t colorIdx;
        float phase;
    };

    struct Point3D {
        float x, y, z;
    };

    static Orbit orbits[12];
    static float t = 0.0f;

    // Knob parameters and steps
    static float paramOrbits = 4.0f; // min 4, max 12
    static float paramSpeed = 2.0f;  // min 0.1, max 2
    static float paramTilt = 2.0f;   // min 0.5, max 2
    static float paramZoom = 2.0f;   // min 0.5, max 5

    constexpr float STEP_ORBITS = 0.167f;
    constexpr float STEP_SPEED  = 0.040f;
    constexpr float STEP_TILT   = 0.031f;
    constexpr float STEP_ZOOM   = 0.094f;

    static const uint8_t PALETTE[5][3] = {
        {255, 230, 100}, // Bright Gold
        {150, 255, 100}, // Electric Lime
        {100, 220, 255}, // Sky Blue
        {255, 100, 150}, // Pink
        {200, 200, 200}  // Silver
    };

    // Helper for pseudo-random numbers during setup to preserve initialization behavior
    static float setupRandom() {
        return (float)rand() / (float)RAND_MAX;
    }

    void setup() {
        PFMath::buildSinLUT();

        t = 0.0f;
        for (int i = 0; i < 12; i++) {
            orbits[i].radius = 15.0f + i * 12.0f;
            orbits[i].tiltX = setupRandom() * TWO_PI;
            orbits[i].tiltY = setupRandom() * TWO_PI;
            orbits[i].tiltZ = setupRandom() * TWO_PI;
            orbits[i].speedMult = 0.3f + setupRandom() * 0.7f;
            orbits[i].colorIdx = i % 5;
            orbits[i].phase = setupRandom() * 10.0f;
        }
    }

    void update(float dt, const InputFrame& input) {
        paramOrbits += input.knobDeltas[0] * STEP_ORBITS;
        paramOrbits = fminf(fmaxf(paramOrbits, 4.0f), 12.0f);

        paramSpeed += input.knobDeltas[1] * STEP_SPEED;
        paramSpeed = fminf(fmaxf(paramSpeed, 0.1f), 2.0f);

        paramTilt += input.knobDeltas[2] * STEP_TILT;
        paramTilt = fminf(fmaxf(paramTilt, 0.5f), 2.0f);

        paramZoom += input.knobDeltas[3] * STEP_ZOOM;
        paramZoom = fminf(fmaxf(paramZoom, 0.5f), 5.0f);

        t += dt * paramSpeed;
        if (t > TWO_PI * 100.0f) {
            t -= TWO_PI * 100.0f;
        }
    }

    static inline Point3D rotateAndProject(float px, float py, float pz, float ax, float ay, float az, float scale, float cx, float cy) {
        float x = px;
        float y = py;
        float z = pz;

        float c = PFMath::fastCos(ax);
        float s = PFMath::fastSin(ax);
        float tmp = y * c - z * s;
        z = y * s + z * c;
        y = tmp;

        c = PFMath::fastCos(ay);
        s = PFMath::fastSin(ay);
        tmp = x * c + z * s;
        z = -x * s + z * c;
        x = tmp;

        c = PFMath::fastCos(az);
        s = PFMath::fastSin(az);
        tmp = x * c - y * s;
        y = x * s + y * c;
        x = tmp;

        return Point3D{ cx + x * scale, cy + y * scale, z };
    }

    void draw() {
        PFCanvas::setFrame(FRAME_W, FRAME_H);

        const float centerX = FRAME_W * 0.5f;
        const float centerY = FRAME_H * 0.5f;
        const float currentScale = (FRAME_W * 0.01f) * paramZoom;

        // Background: Solid Black
        for (int y = 0; y < FRAME_H; y++) {
            for (int x = 0; x < FRAME_W; x++) {
                PFCanvas::setPixel(x, y, 0, 0, 0);
            }
        }

        const int activeOrbits = (int)paramOrbits;

        for (int i = 0; i < activeOrbits; i++) {
            const Orbit& o = orbits[i];
            const uint8_t* col = PALETTE[o.colorIdx];

            float ax = o.tiltX * paramTilt + t * 0.05f;
            float ay = o.tiltY * paramTilt;
            float az = o.tiltZ + t * 0.03f;

            for (float angle = 0.0f; angle < 6.32f; angle += 0.025f) {
                float px = o.radius * PFMath::fastCos(angle);
                float py = o.radius * PFMath::fastSin(angle);

                Point3D proj = rotateAndProject(px, py, 0.0f, ax, ay, az, currentScale, centerX, centerY);

                if (proj.x > 0.0f && proj.x < (FRAME_W - 1) && proj.y > 0.0f && proj.y < (FRAME_H - 1)) {
                    float depth = (proj.z + 50.0f) * 0.01f;
                    depth = fminf(fmaxf(depth, 0.0f), 1.0f);

                    uint8_t r = (uint8_t)(col[0] * depth);
                    uint8_t g = (uint8_t)(col[1] * depth);
                    uint8_t b = (uint8_t)(col[2] * depth);

                    int ix = (int)proj.x;
                    int iy = (int)proj.y;

                    PFCanvas::setPixel(ix, iy, r, g, b);
                    PFCanvas::setPixel(ix + 1, iy, r, g, b);
                    PFCanvas::setPixel(ix, iy + 1, r, g, b);
                }
            }

            // Draw the "Planet" marker as a 3x3 bright block
            float pAngle = t * o.speedMult + o.phase;
            float pPx = o.radius * PFMath::fastCos(pAngle);
            float pPy = o.radius * PFMath::fastSin(pAngle);

            Point3D pPos = rotateAndProject(pPx, pPy, 0.0f, ax, ay, az, currentScale, centerX, centerY);

            if (pPos.x > 1.0f && pPos.x < (FRAME_W - 2) && pPos.y > 1.0f && pPos.y < (FRAME_H - 2)) {
                int pix = (int)pPos.x;
                int piy = (int)pPos.y;
                for (int dx = -1; dx <= 1; dx++) {
                    for (int dy = -1; dy <= 1; dy++) {
                        PFCanvas::setPixel(pix + dx, piy + dy, 255, 255, 255);
                    }
                }
            }
        }

        // Central Star (Pulsing)
        float sunSize = 2.0f + PFMath::fastSin(t * 2.0f) * 1.0f;
        int maxR = (int)ceilf(sunSize);
        float sunSizeSq = sunSize * sunSize;

        for (int x = -maxR; x <= maxR; x++) {
            for (int y = -maxR; y <= maxR; y++) {
                if ((float)(x * x + y * y) <= sunSizeSq) {
                    int px = (int)(centerX + x);
                    int py = (int)(centerY + y);
                    if (px >= 0 && px < FRAME_W && py >= 0 && py < FRAME_H) {
                        PFCanvas::setPixel(px, py, 255, 255, 200);
                    }
                }
            }
        }

        PFCanvas::present();
    }

} // namespace CosmicClockwork