#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_params.h"
#include "src/core_math.h"

namespace TheRoseAndHerLittlePlanet {

    const char* NAME = "The Rose and Her Little Planet";
    const char* const KNOB_LABELS[4] = {"Bloom", "Starspeed", "Starlight", "Zoom"};
    constexpr bool ABSOLUTE_READY = true;

    constexpr int FRAME_W = 64;
    constexpr int FRAME_H = 128;

    // Knob states & limits
    static float knobBloom = 1.0f;
    static float knobStarspeed = 2.0f;
    static float knobStarlight = 1.0f;
    static float knobZoom = 1.95f;

    constexpr float BLOOM_MIN = 0.0f, BLOOM_MAX = 1.0f, BLOOM_STEP = 0.021f;
    constexpr float SPEED_MIN = 0.0f, SPEED_MAX = 12.0f, SPEED_STEP = 0.25f;
    constexpr float LIGHT_MIN = 0.0f, LIGHT_MAX = 1.0f, LIGHT_STEP = 0.021f;
    constexpr float ZOOM_MIN  = 0.4f, ZOOM_MAX  = 1.95f, ZOOM_STEP  = 0.032f;

    // Simulation states
    static float simTime = 0.0f;
    static float skyAccum = 0.0f;
    static float orbitAccum = 0.0f;
    static bool autoLife = false;
    static float lifeTime = 0.0f;
    static float previousBloom = -1.0f;

    struct Star {
        float x;
        float y;
        float phase;
        float light;
    };
    static Star stars[30];

    struct Meteor {
        float x;
        float y;
        float c;
        float s;
        float len;
        float width;
    };
    static Meteor meteors[6];

    struct Petal {
        float x;
        float y;
        float invRx;
        float invRy;
        float minR;
        float c;
        float s;
        int minX, maxX;
        int minY, maxY;
    };
    static Petal petals[23];

    // Frame parameters updated each frame
    static int meteorCount = 2;
    static float curZoom = 1.0f;
    static float cameraY = 1.0f;
    static float curBloom = 0.6f;
    static float curOpen = 1.0f;
    static float curWilt = 0.0f;
    static float curLight = 1.0f;
    static float pxPos = 0.5f;
    static float pyPos = 1.56f;
    static float fxPos = 0.5f;
    static float fyPos = 0.78f;

    // Fast working buffer for value field
    static float valField[FRAME_W * FRAME_H];

    // 256-entry linear ramp LUT
    static const uint8_t RAMP_LUT[256][3] = {
      {214,211,204},{213,210,203},{211,208,201},{210,207,200},{208,206,199},{207,204,197},{206,203,196},{204,202,195},
      {203,200,193},{201,199,192},{200,198,190},{198,196,189},{197,195,188},{196,194,186},{194,192,185},{193,191,184},
      {191,190,182},{190,188,181},{189,187,180},{187,186,178},{186,184,177},{184,183,176},{183,182,174},{181,180,173},
      {180,179,171},{179,178,170},{177,176,169},{176,175,167},{174,174,166},{173,172,165},{172,171,163},{170,170,162},
      {169,168,161},{167,167,159},{166,166,158},{165,164,157},{163,163,155},{162,162,154},{160,160,152},{159,159,151},
      {157,158,150},{156,156,148},{155,155,147},{153,154,146},{152,152,144},{150,151,143},{149,150,142},{148,148,140},
      {146,147,139},{145,146,138},{143,144,136},{142,143,135},{140,142,133},{139,140,132},{138,139,131},{136,138,129},
      {135,136,128},{133,135,127},{132,134,125},{131,132,124},{129,131,123},{128,130,121},{126,128,120},{125,127,119},
      {124,126,117},{122,124,116},{121,123,114},{119,122,113},{118,120,112},{116,119,110},{115,118,109},{114,116,108},
      {112,115,106},{111,114,105},{109,112,104},{108,111,102},{107,109,101},{105,108,100},{104,107,98},{102,105,97},
      {101,104,95},{99,103,94},{98,101,93},{97,100,91},{95,99,90},{94,97,89},{92,96,87},{91,95,86},
      {90,93,85},{88,92,83},{87,91,82},{85,89,81},{84,88,79},{83,87,78},{81,85,76},{80,84,75},
      {78,83,74},{77,81,72},{75,80,71},{74,79,70},{73,77,68},{71,76,67},{70,75,66},{68,73,64},
      {67,72,63},{66,71,62},{64,69,60},{63,68,59},{61,67,57},{60,65,56},{58,64,55},{57,63,53},
      {56,61,52},{54,60,51},{53,59,49},{51,57,48},{50,56,47},{49,55,45},{47,53,44},{46,52,43},
      {44,51,41},{43,49,40},{42,48,38},{40,47,37},{39,45,36},{37,44,34},{36,43,33},{34,41,32},
      {33,40,30},{32,39,29},{30,37,28},{29,36,26},{27,35,25},{26,33,24},{25,32,22},{23,31,21},
      {22,29,19},{20,28,18},{19,27,17},{17,25,15},{16,24,14},{15,23,13},{15,24,14},{16,24,15},
      {16,25,16},{16,25,17},{17,26,18},{17,26,19},{17,27,20},{18,27,21},{18,28,22},{18,28,23},
      {19,29,24},{19,29,25},{19,30,26},{19,30,26},{20,31,27},{20,31,28},{20,31,29},{21,32,30},
      {21,32,31},{21,33,32},{22,33,33},{22,34,34},{22,34,35},{23,35,36},{23,35,37},{23,36,38},
      {24,36,39},{24,37,40},{24,37,41},{25,38,42},{25,38,43},{25,39,43},{25,39,44},{26,40,45},
      {26,40,46},{26,41,47},{27,41,48},{27,42,49},{27,42,50},{28,43,51},{28,43,52},{28,44,53},
      {29,44,54},{29,45,55},{29,45,56},{30,46,57},{30,46,58},{30,47,59},{31,47,60},{31,48,61},
      {31,48,60},{30,47,59},{30,45,58},{29,44,56},{28,43,55},{28,42,54},{27,41,53},{27,40,51},
      {26,39,50},{25,38,49},{25,37,47},{24,36,46},{24,35,45},{23,34,43},{22,33,42},{22,32,41},
      {21,31,39},{21,30,38},{20,29,37},{20,28,36},{19,27,34},{18,26,33},{18,25,32},{17,24,30},
      {17,23,29},{16,22,28},{15,21,26},{15,20,25},{14,19,24},{14,18,22},{13,17,21},{12,16,20},
      {12,15,19},{11,14,17},{11,13,16},{10,12,15},{10,11,13},{9,10,12},{8,9,11},{8,8,9},
      {7,7,8},{7,6,7},{6,5,5},{5,4,4},{5,3,3},{4,2,2},{5,4,3},{6,7,5},
      {7,10,8},{8,13,11},{9,16,14},{11,19,17},{12,22,19},{13,25,22},{14,28,25},{15,31,28},
      {17,34,31},{18,37,33},{19,40,36},{20,43,39},{21,46,42},{23,49,44},{24,52,47},{65,25,23},
    };

    static inline float fastSmooth(float a, float b, float v) {
        float q = PFMath::clamp01((v - a) / (b - a));
        return q * q * (3.0f - 2.0f * q);
    }

    void setup() {
        PFMath::buildSinLUT();

        simTime = 0.0f;
        skyAccum = 0.0f;
        orbitAccum = 0.0f;
        autoLife = false;
        lifeTime = 0.0f;
        previousBloom = -1.0f;

        for (int m = 0; m < 6; m++) {
            meteors[m].x = 0.0f;
            meteors[m].y = 0.0f;
            meteors[m].c = 0.0f;
            meteors[m].s = 0.0f;
            meteors[m].len = 0.0f;
            meteors[m].width = 0.0f;
        }

        for (int i = 0; i < 30; i++) {
            stars[i].x = PFMath::fract(i * 0.618034f + 0.12f);
            stars[i].y = PFMath::fract(i * 0.414214f + 0.07f) * 1.92f;
            stars[i].phase = i * 2.399f;
            stars[i].light = 0.0f;
        }
    }

    void update(float dt, const InputFrame& input) {
        PFParams::apply(input, 0, &knobBloom,     BLOOM_MIN, BLOOM_MAX, BLOOM_STEP);
        PFParams::apply(input, 1, &knobStarspeed, SPEED_MIN, SPEED_MAX, SPEED_STEP);
        PFParams::apply(input, 2, &knobStarlight, LIGHT_MIN, LIGHT_MAX, LIGHT_STEP);
        PFParams::apply(input, 3, &knobZoom,      ZOOM_MIN,  ZOOM_MAX,  ZOOM_STEP);

        float clampedDt = fmaxf(0.0f, dt);

        if (input.btnPressed[0] && !input.paramAbsoluteActive[0] && !input.knobAudioActive[0]) {
            autoLife = !autoLife;
            float cosVal = PFMath::clamp(1.0f - 2.0f * PFMath::clamp01(knobBloom), -1.0f, 1.0f);
            lifeTime = acosf(cosVal) / 0.17f;
        }

        if (previousBloom >= 0.0f && fabsf(knobBloom - previousBloom) > 0.002f) {
            autoLife = false;
        }
        previousBloom = knobBloom;

        simTime += clampedDt;
        if (simTime >= 200.0f * PI) simTime -= 200.0f * PI;

        float speed = fmaxf(0.0f, knobStarspeed);
        skyAccum += clampedDt * (0.03f * speed + 0.17f * speed * speed);
        if (skyAccum >= 1000.0f) skyAccum = PFMath::fract(skyAccum * 0.001f) * 1000.0f;

        orbitAccum += clampedDt * 0.32f;
        if (orbitAccum >= 200.0f * PI) orbitAccum -= 200.0f * PI;

        meteorCount = (int)fminf(6.0f, 2.0f + PFMath::floorF(speed / 3.0f));
        curZoom = PFMath::clamp(knobZoom, 0.15f, 1.95f);
        cameraY = 1.25f - 0.41f * fastSmooth(0.4f, 1.95f, curZoom);

        for (int m = 0; m < 6; m++) {
            bool large = (m % 2 == 0);
            float a = 0.30f + (m % 3) * 0.085f;
            float progress = PFMath::fract(skyAccum * (0.073f + m * 0.003f) + m * 0.173f);
            meteors[m].x = -1.15f + progress * 3.3f;
            meteors[m].y = 0.2f + m * 0.24f + (meteors[m].x - 0.5f) * tanf(a);
            meteors[m].c = PFMath::fastCos(a);
            meteors[m].s = PFMath::fastSin(a);
            meteors[m].len = large ? 0.29f : 0.14f;
            meteors[m].width = large ? 0.016f : 0.008f;
        }

        if (autoLife) {
            lifeTime += clampedDt;
            if (lifeTime >= 200.0f * PI) lifeTime -= 200.0f * PI;
            curBloom = 0.5f - 0.5f * PFMath::fastCos(lifeTime * 0.17f);
        } else {
            curBloom = PFMath::clamp01(knobBloom);
        }

        curOpen = fastSmooth(0.0f, 0.62f, curBloom);
        curWilt = fastSmooth(0.7f, 1.0f, curBloom);
        float satLight = PFMath::clamp01(knobStarlight);
        curLight = 2.4f * (satLight * satLight * satLight);

        pxPos = 0.5f + PFMath::fastSin(orbitAccum * 0.35f) * 0.008f;
        pyPos = 1.56f + PFMath::fastSin(orbitAccum * 0.48f) * 0.008f;
        fxPos = pxPos + 0.012f * PFMath::fastSin(simTime * 0.55f) + 0.045f * curWilt;
        fyPos = 0.78f + 0.055f * curWilt + (pyPos - 1.56f);

        for (int i = 0; i < 30; i++) {
            float sPulse = 0.5f + 0.5f * PFMath::fastSin(simTime * (0.65f + (i % 4) * 0.13f) + stars[i].phase);
            stars[i].light = curLight * (0.24f + 0.64f * (sPulse * sPulse * sPulse));
        }

        // Precompute petals & UV screen bounds
        constexpr float unit = 64.0f;
        for (int j = 0; j < 23; j++) {
            int ringId = (j < 9) ? 0 : ((j < 17) ? 1 : 2);
            int n = (ringId == 0) ? j : ((ringId == 1) ? (j - 9) : (j - 17));
            int count = (ringId == 0) ? 9 : ((ringId == 1) ? 8 : 6);

            float angle = n * TWO_PI / (float)count + ringId * 0.65f - 1.5f;
            float ringBase = (ringId == 0) ? 0.112f : ((ringId == 1) ? 0.065f : 0.026f);
            float ring = ringBase * curOpen;

            petals[j].x = fxPos + PFMath::fastCos(angle) * ring;
            petals[j].y = fyPos + PFMath::fastSin(angle) * ring * 0.78f + ((ringId == 2) ? -0.014f : 0.007f) + curWilt * ((ringId == 0) ? 0.035f : 0.0f);

            float rxBase = (ringId == 0) ? 0.108f : ((ringId == 1) ? 0.078f : 0.044f);
            float rx = rxBase * (0.42f + 0.58f * curOpen) * (1.0f - 0.18f * curWilt);

            float ryBase = (ringId == 0) ? 0.084f : ((ringId == 1) ? 0.060f : 0.039f);
            float ry = ryBase * (0.70f + 0.30f * curOpen);

            petals[j].invRx = 1.0f / (rx + 0.0001f);
            petals[j].invRy = 1.0f / (ry + 0.0001f);
            petals[j].minR = fminf(rx, ry);

            petals[j].c = PFMath::fastCos(angle + 0.65f);
            petals[j].s = PFMath::fastSin(angle + 0.65f);

            float maxR = fmaxf(rx, ry);
            petals[j].minX = PFMath::clamp((int)(((petals[j].x - maxR - 0.5f) * curZoom + 0.5f) * unit), 0, FRAME_W - 1);
            petals[j].maxX = PFMath::clamp((int)(((petals[j].x + maxR - 0.5f) * curZoom + 0.5f) * unit), 0, FRAME_W - 1);
            petals[j].minY = PFMath::clamp((int)(((petals[j].y - maxR - cameraY) * curZoom + 1.0f) * unit), 0, FRAME_H - 1);
            petals[j].maxY = PFMath::clamp((int)(((petals[j].y + maxR - cameraY) * curZoom + 1.0f) * unit), 0, FRAME_H - 1);
        }
    }

    void draw() {
        PFCanvas::setFrame(FRAME_W, FRAME_H);

        constexpr float unit = 64.0f;
        const float invUnitZoom = 1.0f / (unit * curZoom);
        const float aa = 0.65f * invUnitZoom;
        const float invAa = 1.0f / aa;
        const float glow = 0.5f + 0.5f * PFMath::fastSin(simTime * 0.85f);
        constexpr float pr = 0.325f;
        constexpr float pr2 = pr * pr;
        constexpr float invPr = 1.0f / pr;
        constexpr float invPr2 = 1.0f / pr2;
        const float rootY = pyPos - pr + 0.022f;
        const float stemTop = fyPos + 0.067f;
        const float stemHeight = rootY - stemTop;
        const float invStemHeight = (stemHeight > 0.001f) ? (1.0f / stemHeight) : 0.0f;
        const float seamThreshold = 0.003f + fmaxf(0.006f, 0.62f * invUnitZoom);

        // Precompute falling petal parameters
        float fallFract = 0.0f, fallFx = 0.0f, fallFy = 0.0f;
        bool hasFallingPetal = (curWilt > 0.15f);
        if (hasFallingPetal) {
            fallFract = PFMath::fract(simTime * 0.12f);
            fallFx = fxPos + 0.17f + 0.035f * PFMath::fastSin(fallFract * 7.0f);
            fallFy = fyPos + 0.15f + fallFract * 0.42f;
        }

        // 1. Clear base field to zero
        for (int i = 0; i < FRAME_W * FRAME_H; i++) {
            valField[i] = 0.0f;
        }

        // 2. Stars (배경 우주에 가장 먼저 렌더링)
        for (int i = 0; i < 30; i++) {
            if (stars[i].light <= 0.01f) continue;
            float su = stars[i].x;
            float sv = stars[i].y;
            int cx = (int)(((su - 0.5f) * curZoom + 0.5f) * unit);
            int cy = (int)(((sv - cameraY) * curZoom + 1.0f) * unit);

            int rPix = 4;
            int minX = PFMath::clamp(cx - rPix, 0, FRAME_W - 1);
            int maxX = PFMath::clamp(cx + rPix, 0, FRAME_W - 1);
            int minY = PFMath::clamp(cy - rPix, 0, FRAME_H - 1);
            int maxY = PFMath::clamp(cy + rPix, 0, FRAME_H - 1);

            bool isCross = (i % 5 == 0);
            float radius = 0.015f + (i % 3) * 0.003f;

            for (int y = minY; y <= maxY; y++) {
                float v = cameraY + (((float)y + 0.5f) * (1.0f / unit) - 1.0f) / curZoom;
                float sy = fabsf(PFMath::fract(v * 0.5f) * 2.0f - sv);
                if (sy >= 0.033f) continue;

                int rowOffset = y * FRAME_W;
                for (int x = minX; x <= maxX; x++) {
                    float u = 0.5f + (((float)x + 0.5f) * (1.0f / unit) - 0.5f) / curZoom;
                    float sx = fabsf(PFMath::fract(u) - su);
                    if (sx >= 0.033f) continue;

                    float dist = sqrtf(sx * sx + sy * sy);
                    float dot = PFMath::clamp01(1.0f - dist / radius);
                    float cross = 0.0f;
                    if (isCross) {
                        float c1 = PFMath::clamp01(1.0f - sx / 0.007f) * PFMath::clamp01(1.0f - sy / 0.034f);
                        float c2 = PFMath::clamp01(1.0f - sy / 0.007f) * PFMath::clamp01(1.0f - sx / 0.028f);
                        cross = fmaxf(c1, c2) * 0.55f;
                    }
                    float starVal = fminf(0.98f, stars[i].light * fmaxf(dot, cross));
                    if (starVal > valField[rowOffset + x]) {
                        valField[rowOffset + x] = starVal;
                    }
                }
            }
        }

        // 3. 우주 배경 채우기 및 행성 렌더링 (행성은 별/유성을 덮음)
        for (int y = 0; y < FRAME_H; y++) {
            const float v = cameraY + (((float)y + 0.5f) * (1.0f / unit) - 1.0f) / curZoom;
            const float dyPlanet = v - pyPos;
            const float dyPlanet2 = dyPlanet * dyPlanet;
            const int rowOffset = y * FRAME_W;

            for (int x = 0; x < FRAME_W; x++) {
                const float u = 0.5f + (((float)x + 0.5f) * (1.0f / unit) - 0.5f) / curZoom;
                float val = valField[rowOffset + x];

                // Meteors
                for (int m = 0; m < meteorCount; m++) {
                    const Meteor& mt = meteors[m];
                    float dx = u - mt.x;
                    float dy = v - mt.y;
                    float along = dx * mt.c + dy * mt.s;
                    float across = fabsf(-dx * mt.s + dy * mt.c);
                    float width = fmaxf(mt.width, 0.45f * invUnitZoom);

                    if (along <= 0.0f && along > -mt.len) {
                        float tailFactor = 1.0f + along / mt.len;
                        float tail = PFMath::clamp01(1.0f - across / width) * (tailFactor * tailFactor);
                        val = fmaxf(val, fminf(0.98f, curLight * tail));
                    }
                    float headDist2 = dx * dx + dy * dy;
                    float maxHeadDist = width * 1.25f;
                    if (headDist2 < maxHeadDist * maxHeadDist) {
                        float head = 1.0f - sqrtf(headDist2) / maxHeadDist;
                        val = fmaxf(val, fminf(0.98f, curLight * head));
                    }
                }

                // Clouds
                float cyCloud = 1.27f + 0.04f * PFMath::fastSin(u * 9.0f + simTime * 0.08f);
                float cDist = fabsf(v - cyCloud);
                if (cDist < 0.12f) {
                    float cloudx = PFMath::fract(u * 0.68f - simTime * 0.012f);
                    float cSin = PFMath::clamp01(PFMath::fastSin(cloudx * TWO_PI));
                    float cSin3 = cSin * cSin * cSin;
                    float cloud = (1.0f - cDist * 8.0f) * (cSin3 * cSin3) * 0.085f;
                    if (cloud > val) val = cloud;
                }

                // Planet & Atmosphere (행성 본체 r2 < pr2 일 때 별빛을 완전히 덮어씀)
                float dxPlanet = u - pxPos;
                float r2 = dxPlanet * dxPlanet + dyPlanet2;
                constexpr float atmoLimit = (pr + 0.055f) * (pr + 0.055f);
                if (r2 < atmoLimit) {
                    float r = sqrtf(r2);
                    float atmo = (0.045f + 0.035f * glow) * PFMath::clamp01(1.0f - fabsf(r - pr) * 20.0f);
                    if (atmo > val) val = atmo;

                    if (r2 < pr2) {
                        float normal = sqrtf(1.0f - r2 * invPr2);
                        float lit = PFMath::clamp01((-dxPlanet * 0.48f - dyPlanet * 0.68f) * invPr + normal * 0.57f);
                        float terrain = 0.5f + 0.5f * PFMath::fastSin(dxPlanet * 33.0f + orbitAccum * 0.55f + PFMath::fastSin(dyPlanet * 24.0f) * 1.5f);
                        // 행성 표면은 우주 배경(별/유성)을 완전히 덮음
                        val = 0.045f + lit * 0.34f + terrain * 0.044f * normal;
                        val += PFMath::clamp01(1.0f - (pr - r) * 100.0f) * (0.23f + 0.18f * glow) * PFMath::clamp01(0.45f - dyPlanet * invPr);
                    }
                }

                // Stem
                if (v > stemTop && v < rootY) {
                    float f = (v - stemTop) * invStemHeight;
                    float stemX = fxPos * (1.0f - f) + pxPos * f - 0.025f * PFMath::fastSin(f * PI);
                    float stem = PFMath::clamp01((0.012f - fabsf(u - stemX)) * invAa);
                    if (stem > 0.0f) {
                        val = val * (1.0f - stem) + (0.48f + 0.2f * (1.0f - f)) * stem;
                    }
                }

                // Falling Petal
                if (hasFallingPetal) {
                    float fdx = (u - fallFx) * (1.0f / 0.024f);
                    float fdy = (v - fallFy) * (1.0f / 0.039f);
                    float fd = fdx * fdx + fdy * fdy;
                    if (fd < 1.0f) {
                        float fallVal = (0.45f + 0.24f * (1.0f - fd)) * curWilt * (1.0f - fallFract);
                        if (fallVal > val) val = fallVal;
                    }
                }

                valField[rowOffset + x] = val;
            }
        }

        // 4. Leaves
        for (int leaf = 0; leaf < 2; leaf++) {
            float sign = (leaf == 0) ? -1.0f : 1.0f;
            float axLeaf = pxPos - 0.008f;
            float ayLeaf = 1.12f + leaf * 0.06f + (pyPos - 1.56f);

            float minU = (leaf == 0) ? (axLeaf - 0.143f) : axLeaf;
            float maxU = (leaf == 0) ? axLeaf : (axLeaf + 0.143f);
            float minV = ayLeaf - 0.143f * 0.55f - 0.04f;
            float maxV = ayLeaf + 0.04f;

            int leafMinX = PFMath::clamp((int)(((minU - 0.5f) * curZoom + 0.5f) * unit), 0, FRAME_W - 1);
            int leafMaxX = PFMath::clamp((int)(((maxU - 0.5f) * curZoom + 0.5f) * unit), 0, FRAME_W - 1);
            int leafMinY = PFMath::clamp((int)(((minV - cameraY) * curZoom + 1.0f) * unit), 0, FRAME_H - 1);
            int leafMaxY = PFMath::clamp((int)(((maxV - cameraY) * curZoom + 1.0f) * unit), 0, FRAME_H - 1);

            for (int y = leafMinY; y <= leafMaxY; y++) {
                float v = cameraY + (((float)y + 0.5f) * (1.0f / unit) - 1.0f) / curZoom;
                int rowOffset = y * FRAME_W;
                for (int x = leafMinX; x <= leafMaxX; x++) {
                    float u = 0.5f + (((float)x + 0.5f) * (1.0f / unit) - 0.5f) / curZoom;
                    float lx = (u - axLeaf) * sign;
                    if (lx > 0.0f && lx < 0.143f) {
                        float ly = v - ayLeaf + lx * 0.55f;
                        float halfW = 0.034f * PFMath::fastSin((lx / 0.143f) * PI);
                        float absLy = fabsf(ly);
                        float mask = PFMath::clamp01((halfW - absLy) * invAa);
                        if (mask > 0.0f) {
                            float shade = (absLy < 0.006f) ? 0.73f : (0.3f + 0.24f * PFMath::clamp01(1.0f - absLy / (halfW + 0.001f)));
                            valField[rowOffset + x] = valField[rowOffset + x] * (1.0f - mask) + shade * mask;
                        }
                    }
                }
            }
        }

        // 5. Rose Petals
        for (int j = 0; j < 23; j++) {
            const Petal& pet = petals[j];
            for (int y = pet.minY; y <= pet.maxY; y++) {
                float v = cameraY + (((float)y + 0.5f) * (1.0f / unit) - 1.0f) / curZoom;
                float qy = v - pet.y;
                int rowOffset = y * FRAME_W;

                for (int x = pet.minX; x <= pet.maxX; x++) {
                    float u = 0.5f + (((float)x + 0.5f) * (1.0f / unit) - 0.5f) / curZoom;
                    float qx = u - pet.x;
                    float pa = (qx * pet.c + qy * pet.s) * pet.invRx;
                    float pb = (-qx * pet.s + qy * pet.c) * pet.invRy;
                    float d2 = pa * pa + pb * pb;

                    if (d2 < 1.0f) {
                        float d = sqrtf(d2);
                        float mask = PFMath::clamp01((1.0f - d) * pet.minR * invAa);
                        float edge = (1.0f - d) * pet.minR;
                        float seam = 1.0f - fastSmooth(0.003f, seamThreshold, edge);
                        float fold = 0.5f + 0.5f * PFMath::fastSin(pa * 3.8f + pb * 1.4f + j * 0.6f);
                        float body = (0.48f + 0.22f * PFMath::clamp01(0.6f - pb * 0.4f) + 0.07f * fold) * (1.0f - 0.15f * curWilt);
                        float shade = body * (1.0f - seam) + 0.035f * seam;
                        valField[rowOffset + x] = valField[rowOffset + x] * (1.0f - mask) + shade * mask;
                    }
                }
            }
        }

        // 6. Center Core Spiral of the Rose
        int flowerMinX = PFMath::clamp((int)(((fxPos - 0.05f - 0.5f) * curZoom + 0.5f) * unit), 0, FRAME_W - 1);
        int flowerMaxX = PFMath::clamp((int)(((fxPos + 0.05f - 0.5f) * curZoom + 0.5f) * unit), 0, FRAME_W - 1);
        int flowerMinY = PFMath::clamp((int)(((fyPos - 0.05f - cameraY) * curZoom + 1.0f) * unit), 0, FRAME_H - 1);
        int flowerMaxY = PFMath::clamp((int)(((fyPos + 0.05f - cameraY) * curZoom + 1.0f) * unit), 0, FRAME_H - 1);

        for (int y = flowerMinY; y <= flowerMaxY; y++) {
            float v = cameraY + (((float)y + 0.5f) * (1.0f / unit) - 1.0f) / curZoom;
            float cy2 = (v - fyPos + 0.014f) * (1.0f / 0.034f);
            int rowOffset = y * FRAME_W;

            for (int x = flowerMinX; x <= flowerMaxX; x++) {
                float u = 0.5f + (((float)x + 0.5f) * (1.0f / unit) - 0.5f) / curZoom;
                float cx = (u - fxPos) * (1.0f / 0.038f);
                float rr2 = cx * cx + cy2 * cy2;
                if (rr2 < 1.0f) {
                    float rr = sqrtf(rr2);
                    float spiral = 0.5f + 0.5f * PFMath::fastCos(PFMath::fastAtan2(cy2, cx) + rr * 10.0f);
                    valField[rowOffset + x] = 0.045f + 0.68f * fastSmooth(0.28f, 0.65f, spiral);
                }
            }
        }

        // 7. Final Ramp Lookup and Draw
        for (int y = 0; y < FRAME_H; y++) {
            int rowOffset = y * FRAME_W;
            for (int x = 0; x < FRAME_W; x++) {
                float v = PFMath::clamp01(valField[rowOffset + x]);
                int li = (int)(v * 255.0f + 0.5f);
                PFCanvas::setPixel(x, y, RAMP_LUT[li][0], RAMP_LUT[li][1], RAMP_LUT[li][2]);
            }
        }

        PFCanvas::present();
    }

} // namespace TheRoseAndHerLittlePlanet