#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_math.h"

namespace RocketFlightPattern {

const char* NAME = "Rocket Flight";
const char* const KNOB_LABELS[4] = {"Speed", "Zoom", "Stars", "Galaxy"};

static float g_speed = 2.529f;
static float g_zoom = 1.35f;
static float g_stars = 19.027f;
static float g_galaxy = 3.0f;
static float g_timeAcc = 0.0f;

struct Star {
    float x;
    float y;
    float len;
    float spd;
};

struct Planet {
    float x;
    float y;
    float radius;
    int type;
    float spd;
    float driftX;
    float rotSpd;
    bool hasRing;
    bool active;
};

static Star g_starData[60];
static Planet g_planets[3];

static const uint8_t RAMP_LUT[256][3] = {
  {0,0,0},{3,3,3},{6,6,6},{9,9,8},{11,11,11},{14,14,14},{17,17,16},{20,20,19},
  {23,23,21},{26,26,23},{29,28,25},{32,31,28},{34,34,30},{37,37,32},{40,40,34},{43,43,36},
  {46,45,38},{49,48,39},{52,51,41},{55,54,43},{57,56,45},{60,59,46},{63,62,48},{66,65,49},
  {69,67,50},{72,70,52},{75,73,53},{78,76,54},{80,78,55},{83,81,56},{86,84,57},{89,87,58},
  {92,89,59},{95,92,60},{98,95,60},{101,97,61},{103,100,61},{106,103,62},{109,105,62},{112,108,63},
  {115,111,63},{118,113,63},{121,116,64},{124,119,64},{126,121,64},{129,124,64},{132,127,64},{135,129,64},
  {138,132,63},{141,134,63},{144,137,63},{147,140,62},{149,142,62},{152,145,61},{155,147,61},{158,150,60},
  {161,153,59},{164,155,59},{167,158,58},{170,160,57},{172,163,56},{175,165,55},{178,168,54},{181,170,53},
  {184,173,51},{187,176,50},{190,178,49},{193,181,47},{195,183,46},{198,186,44},{201,188,42},{204,191,41},
  {207,193,39},{210,196,37},{213,198,35},{216,201,33},{218,203,31},{221,205,29},{224,208,27},{227,210,25},
  {230,213,23},{233,215,20},{236,218,18},{239,220,15},{241,223,13},{244,225,10},{247,227,8},{250,230,5},
  {253,232,2},{255,237,0},{255,247,0},{252,255,0},{242,255,0},{232,255,0},{221,255,0},{211,255,0},
  {200,255,0},{190,255,0},{179,255,0},{169,255,0},{158,255,0},{148,255,0},{137,255,0},{127,255,0},
  {117,255,0},{106,255,0},{96,255,0},{85,255,0},{75,255,0},{64,255,0},{54,255,0},{43,255,0},
  {33,255,0},{23,255,0},{12,255,0},{2,255,0},{0,255,9},{0,255,9},{29,255,0},{68,255,0},
  {106,255,0},{144,255,0},{182,255,0},{221,255,0},{255,251,0},{255,213,0},{255,175,0},{255,136,0},
  {255,98,0},{255,60,0},{255,21,0},{255,0,44},{255,0,143},{255,0,242},{169,0,255},{70,0,255},
  {32,3,252},{36,8,247},{40,13,242},{43,17,236},{46,22,231},{49,26,226},{52,30,221},{55,33,216},
  {57,37,210},{59,40,205},{62,43,200},{63,46,195},{65,49,190},{67,51,185},{68,53,179},{69,55,174},
  {70,57,169},{71,59,164},{72,60,159},{72,61,153},{72,62,148},{72,63,143},{72,63,138},{72,64,133},
  {71,64,128},{71,64,122},{70,63,117},{69,63,112},{67,62,107},{66,61,102},{64,60,96},{62,59,91},
  {60,57,86},{58,55,81},{56,53,76},{53,51,71},{51,49,65},{48,46,60},{45,43,55},{41,40,50},
  {38,37,45},{34,33,39},{30,30,34},{26,26,29},{22,22,24},{18,17,19},{13,13,14},{8,8,8},
  {3,3,3},{17,16,16},{63,47,47},{108,62,62},{154,61,61},{199,44,44},{245,10,10},{255,7,7},
  {255,17,17},{255,26,26},{255,36,36},{255,45,45},{255,54,54},{255,64,64},{255,73,73},{255,83,83},
  {255,92,92},{255,102,102},{255,111,111},{255,120,120},{255,130,130},{255,139,139},{255,149,149},{255,158,158},
  {255,168,168},{255,177,177},{255,187,187},{255,196,196},{255,205,205},{255,215,215},{255,224,224},{255,234,234},
  {255,243,243},{255,253,253},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
  {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
  {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
  {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
  {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
};

#if PANEL_RES_H >= PANEL_RES_W
static const float LOGICAL_W = (float)PANEL_RES_W;
static const float LOGICAL_H = (float)PANEL_RES_H;

inline void setPx(float x, float y, float v) {
    int ix = PANEL_RES_W - 1 - (int)floorf(x);
    int iy = PANEL_RES_H - 1 - (int)floorf(y);
    if (ix >= 0 && ix < PANEL_RES_W && iy >= 0 && iy < PANEL_RES_H) {
        float cv = fmaxf(0.0f, fminf(1.0f, v));
        int li = (int)(cv * 255.0f + 0.5f);
        PFCanvas::setPixel(ix, iy, RAMP_LUT[li][0], RAMP_LUT[li][1], RAMP_LUT[li][2]);
    }
}
#else
static const float LOGICAL_W = (float)PANEL_RES_H;
static const float LOGICAL_H = (float)PANEL_RES_W;

inline void setPx(float x, float y, float v) {
    int lx = (int)floorf(x);
    int ly = (int)floorf(y);
    if (lx >= 0 && lx < (int)LOGICAL_W && ly >= 0 && ly < (int)LOGICAL_H) {
        int px = PANEL_RES_W - 1 - ly;
        int py = PANEL_RES_H - 1 - lx;
        float cv = fmaxf(0.0f, fminf(1.0f, v));
        int li = (int)(cv * 255.0f + 0.5f);
        PFCanvas::setPixel(px, py, RAMP_LUT[li][0], RAMP_LUT[li][1], RAMP_LUT[li][2]);
    }
}
#endif

inline float randFloat() {
    return (float)rand() / (float)RAND_MAX;
}

void setup() {
    PFMath::buildSinLUT();

    for (int i = 0; i < 60; i++) {
        g_starData[i].x = randFloat() * LOGICAL_W;
        g_starData[i].y = randFloat() * LOGICAL_H;
        g_starData[i].len = 2.0f + randFloat() * 6.0f;
        g_starData[i].spd = 0.5f + randFloat() * 1.5f;
    }

    g_planets[0] = {12.0f * (LOGICAL_W / 64.0f), 30.0f * (LOGICAL_H / 128.0f), 8.0f, 0, 0.8f, 0.15f, 1.2f, true, true};
    g_planets[1] = {48.0f * (LOGICAL_W / 64.0f), -20.0f * (LOGICAL_H / 128.0f), 5.0f, 1, 1.3f, -0.2f, 2.0f, false, true};
    g_planets[2] = {28.0f * (LOGICAL_W / 64.0f), -90.0f * (LOGICAL_H / 128.0f), 10.0f, 2, 0.6f, 0.1f, 0.8f, true, true};
}

void update(float dt, const InputFrame& input) {
    g_speed += input.knobDeltas[0] * 0.05f;
    g_speed = fminf(20.0f, fmaxf(0.5f, g_speed));

    g_zoom += input.knobDeltas[1] * 0.1f;
    g_zoom = fminf(2.0f, fmaxf(1.0f, g_zoom));

    g_stars += input.knobDeltas[2] * 0.05f;
    g_stars = fminf(60.0f, fmaxf(0.0f, g_stars));

    g_galaxy += input.knobDeltas[3] * 0.05f;
    g_galaxy = fminf(3.0f, fmaxf(0.0f, g_galaxy));

    g_timeAcc += dt * g_speed;
    if (g_timeAcc > 1000.0f * TWO_PI) {
        g_timeAcc -= 1000.0f * TWO_PI;
    }

    // 1. Move stars
    int count = (int)fminf(60.0f, g_stars);
    for (int i = 0; i < count; i++) {
        Star& s = g_starData[i];
        s.y += dt * 80.0f * g_speed * s.spd;
        if (s.y > LOGICAL_H) {
            s.y = -s.len;
            s.x = randFloat() * LOGICAL_W;
        }
    }

    // 2. Move planets
    for (int i = 0; i < 3; i++) {
        Planet& p = g_planets[i];
        if (p.active) {
            p.y += dt * 10.0f * g_speed * p.spd;
            p.x += dt * 5.0f * g_speed * p.driftX;

            if (p.y - p.radius * 2.5f > LOGICAL_H || p.x < -15.0f || p.x > (LOGICAL_W + 15.0f)) {
                p.active = false;
            }
        } else {
            if (randFloat() < 0.012f) {
                p.x = 8.0f + randFloat() * (LOGICAL_W - 16.0f);
                p.radius = 4.0f + (float)(rand() % 7);
                p.y = -p.radius * 3.0f - randFloat() * 40.0f;
                p.spd = 0.5f + randFloat() * 1.0f;
                p.driftX = (randFloat() - 0.5f) * 0.4f;
                p.rotSpd = 0.5f + randFloat() * 2.0f;
                p.type = rand() % 3;
                p.hasRing = randFloat() > 0.5f;
                p.active = true;
            }
        }
    }
}

void draw() {
    const float t = g_timeAcc;
    const float zoom = g_zoom;

    // 1. Clear screen (0.0 value -> deep space)
    for (int y = 0; y < PANEL_RES_H; y++) {
        for (int x = 0; x < PANEL_RES_W; x++) {
            PFCanvas::setPixel(x, y, RAMP_LUT[0][0], RAMP_LUT[0][1], RAMP_LUT[0][2]);
        }
    }

    // ==========================================
    // [Section 1] Galaxy & Stars (0.00 ~ 0.33)
    // ==========================================

    // Galaxy/Nebula (0.02 ~ 0.16)
    if (g_galaxy > 0.02f) {
        for (int y = 0; y < (int)LOGICAL_H; y += 2) {
            for (int x = 0; x < (int)LOGICAL_W; x += 2) {
                float gX = (float)x * 0.05f;
                float gY = ((float)y + t * 12.0f) * 0.04f;
                float n1 = PFMath::fastSin(gX + gY) * PFMath::fastCos(gX * 1.5f - gY * 0.8f);
                float n2 = PFMath::fastSin(((float)x - (float)y) * 0.03f + t * 0.5f);
                float cloud = (n1 + n2) * 0.5f;

                if (cloud > 0.15f) {
                    float rawNeb = (cloud - 0.15f) * 0.4f * g_galaxy;
                    float val = 0.02f + fminf(0.14f, rawNeb * 0.35f);
                    setPx((float)x, (float)y, val);
                    if (cloud > 0.4f) {
                        setPx((float)(x + 1), (float)(y + 1), val * 0.7f);
                    }
                }
            }
        }
    }

    // Star speedlines (0.18 ~ 0.32)
    int starCount = (int)fminf(60.0f, g_stars);
    for (int i = 0; i < starCount; i++) {
        const Star& s = g_starData[i];
        float brightness = 0.5f + (s.spd * 0.5f);
        int lenInt = (int)floorf(s.len);
        for (int l = 0; l < lenInt; l++) {
            float starRaw = brightness * (1.0f - (float)l / s.len);
            float val = 0.18f + starRaw * 0.14f;
            setPx(s.x, s.y + (float)l, val);
        }
    }

    // ==========================================
    // [Section 2] Planets & Rings (0.33 ~ 0.66)
    // ==========================================
    for (int i = 0; i < 3; i++) {
        const Planet& p = g_planets[i];
        if (!p.active) continue;

        const float px = p.x;
        const float py = p.y;
        const float pr = p.radius;
        const int ptype = p.type;
        const float rot = t * p.rotSpd;
        int prInt = (int)pr;

        // Back ring (0.36)
        if (p.hasRing) {
            for (int rx = -prInt * 2; rx <= prInt * 2; rx++) {
                int ry = (int)floorf((float)rx * 0.25f);
                if (ry < 0) {
                    setPx(px + (float)rx, py + (float)ry, 0.36f);
                }
            }
        }

        // Planet body (0.38 ~ 0.62)
        for (int dy = -prInt; dy <= prInt; dy++) {
            for (int dx = -prInt; dx <= prInt; dx++) {
                float distSq = (float)(dx * dx + dy * dy);
                if (distSq <= pr * pr) {
                    float shadow = (float)(dx + dy) / (pr * 2.0f);
                    float normVal = 0.55f - shadow * 0.25f;

                    if (ptype == 0) {
                        float shiftY = (float)dy + PFMath::fastSin((float)dx * 0.2f + rot) * 1.5f;
                        int modY = ((int)floorf(shiftY + 100.0f)) % 4;
                        if (modY < 0) modY += 4;
                        if (modY < 2) normVal *= 0.65f;
                    } else if (ptype == 1) {
                        int rotX = dx + (int)floorf(rot * 4.0f);
                        int cx = (rotX % 5 + 5) % 5 - 2;
                        int cy = dy % 4;
                        if (cx * cx + cy * cy < 2) normVal *= 0.55f;
                    } else {
                        float atmosphericRot = PFMath::fastSin((float)dx * 0.3f + (float)dy * 0.3f + rot);
                        if (atmosphericRot > 0.3f) normVal += 0.2f;
                    }

                    float planetVal = 0.38f + fmaxf(0.0f, fminf(1.0f, normVal)) * 0.24f;
                    setPx(px + (float)dx, py + (float)dy, planetVal);
                }
            }
        }

        // Front ring (0.64)
        if (p.hasRing) {
            for (int rx = -prInt * 2; rx <= prInt * 2; rx++) {
                int ry = (int)floorf((float)rx * 0.25f);
                if (ry >= 0) {
                    setPx(px + (float)rx, py + (float)ry, 0.64f);
                }
            }
        }
    }

    // ==========================================
    // [Section 3] Spaceship & Engine Flame (0.66 ~ 1.00)
    // ==========================================

    float swayFactor = fminf(0.2f, 0.05f + (g_speed / 4.0f) * 0.15f);
    float offsetX = (PFMath::fastSin(t * 1.8f) * 10.0f + PFMath::fastSin(t * 3.7f + 1.2f) * 3.5f) * swayFactor;
    float offsetY = PFMath::fastCos(t * 2.3f) * 4.0f * swayFactor;

    float rx = LOGICAL_W * 0.5f + offsetX;
    float ry = LOGICAL_H * 0.35f + offsetY;

    static const uint8_t ROCKET_SPRITE[17][11] = {
        {0,0,0,0,0,1,0,0,0,0,0},
        {0,0,0,0,1,2,1,0,0,0,0},
        {0,0,0,0,1,2,1,0,0,0,0},
        {0,0,0,1,2,2,2,1,0,0,0},
        {0,0,0,1,2,3,2,1,0,0,0},
        {0,0,0,1,2,3,2,1,0,0,0},
        {0,0,0,1,2,2,2,1,0,0,0},
        {0,0,1,1,2,2,2,1,1,0,0},
        {0,0,1,2,2,2,2,2,1,0,0},
        {0,1,2,1,2,2,2,1,2,1,0},
        {0,1,2,1,2,2,2,1,2,1,0},
        {1,2,2,1,2,2,2,1,2,2,1},
        {1,2,2,1,2,2,2,1,2,2,1},
        {1,1,1,1,2,2,2,1,1,1,1},
        {0,0,0,1,1,1,1,1,0,0,0},
        {0,0,0,0,1,2,1,0,0,0,0},
        {0,0,0,0,1,1,1,0,0,0,0}
    };

    const int sh = 17;
    const int sw = 11;
    float startX = rx - ((float)sw * 0.5f) * zoom;
    float startY = ry - ((float)sh * 0.5f) * zoom;

    int zoomCeil = (int)ceilf(zoom);

    // Rocket rendering
    for (int r = 0; r < sh; r++) {
        for (int c = 0; c < sw; c++) {
            uint8_t pixelType = ROCKET_SPRITE[r][c];
            if (pixelType == 0) continue;

            float val = 0.75f;
            if (pixelType == 2) val = 0.92f;
            if (pixelType == 3) val = 0.68f;

            for (int zy = 0; zy < zoomCeil; zy++) {
                for (int zx = 0; zx < zoomCeil; zx++) {
                    setPx(startX + ((float)c * zoom) + (float)zx, startY + ((float)r * zoom) + (float)zy, val);
                }
            }
        }
    }

    // Engine flame
    float thrustFactor = fminf(2.0f, 0.5f + (g_speed / 4.0f) * 1.5f);
    int flameMaxLen = (int)floorf(35.0f * thrustFactor * zoom);
    float nozzleY = startY + ((float)sh * zoom);

    for (int dy = 0; dy < flameMaxLen; dy++) {
        float currentY = nozzleY + (float)dy;
        float spread = ((float)(int)floorf(((float)dy / (float)flameMaxLen) * 6.0f) + 1.0f) * zoom;
        float flicker = PFMath::fastSin((float)dy * 0.8f - t * 25.0f) * 0.5f + 0.5f;

        int spreadInt = (int)ceilf(spread);
        for (int dx = -spreadInt; dx <= spreadInt; dx++) {
            if ((float)abs(dx) > spread) continue;

            float px = rx + (float)dx;
            float distFromCenter = fabsf((float)dx) / (spread + 1.0f);

            float flameRaw = (1.0f - ((float)dy / (float)flameMaxLen)) * (1.0f - distFromCenter);
            flameRaw *= (0.6f + flicker * 0.4f);

            float val = 0.70f + fmaxf(0.0f, fminf(1.0f, flameRaw)) * 0.30f;

            if ((((int)floorf(px) + (int)floorf(currentY)) % 2 == 0) || val > 0.85f) {
                setPx(px, currentY, val);
            }
        }
    }

    PFCanvas::present();
}

} // namespace RocketFlightPattern