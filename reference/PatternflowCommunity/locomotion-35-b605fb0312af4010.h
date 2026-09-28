#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_params.h"
#include "src/core_math.h"
#include "src/core_mem.h"

namespace MuybridgeOmnibus {

constexpr int FRAME_W = 64;
constexpr int FRAME_H = 128;

const char* NAME = "Muybridge 35mm";
const char* const KNOB_LABELS[4] = {"Speed", "Stride", "Pulldown", "Mode"};
constexpr bool ABSOLUTE_READY = true;

// Knob parameter states initialized with calibrated Pattern Lab values
static float kSpeed = 4.0f;
static float kStride = 1.381f;
static float kPulldown = 1.0f;
static float kMode = 0.0f;

static float timeAcc = 0.0f;

// Snapshot Cache Grid Constants (Higher resolution than physical LED aperture)
constexpr int NUM_POSES = 16;
constexpr int GRID_W = 48;
constexpr int GRID_H = 48;
constexpr float FCX_MIN = -0.60f;
constexpr float FCX_MAX = 0.60f;
constexpr float FCY_MIN = -0.575f;
constexpr float FCY_MAX = 0.575f;
constexpr float INV_FCX_SPAN = 1.0f / (FCX_MAX - FCX_MIN);
constexpr float INV_FCY_SPAN = 1.0f / (FCY_MAX - FCY_MIN);

// PSRAM-allocated snapshot buffer
static float* snapshots = nullptr;
static int lastBakedMode = -1;
static float lastBakedStride = -100.0f;

// Pre-baked Color Ramp LUT (256 entries)
static const uint8_t RAMP_LUT[256][3] = {
  {0,0,0},{0,0,0},{1,1,1},{1,1,1},{2,2,2},{3,3,3},{3,3,3},{4,4,4},
  {5,5,5},{5,5,5},{6,6,6},{7,7,7},{7,7,7},{8,8,8},{8,8,8},{9,9,9},
  {10,10,10},{10,10,10},{11,11,11},{12,12,12},{12,12,12},{13,13,13},{14,14,14},{14,14,14},
  {15,15,15},{16,16,16},{16,16,16},{17,17,17},{17,17,17},{18,18,18},{19,19,19},{19,19,19},
  {20,20,20},{21,21,21},{21,21,21},{22,22,22},{23,23,23},{23,23,23},{24,24,24},{25,25,25},
  {25,25,25},{26,26,26},{29,29,29},{33,33,33},{38,38,38},{42,42,42},{46,46,46},{50,50,50},
  {55,55,55},{59,59,59},{63,63,63},{68,68,68},{72,72,72},{76,76,76},{81,81,81},{85,85,85},
  {89,89,89},{93,93,93},{98,98,98},{102,102,102},{106,106,106},{111,111,111},{115,115,115},{119,119,119},
  {123,123,123},{128,128,128},{132,132,132},{136,136,136},{141,141,141},{145,145,145},{149,149,149},{154,154,154},
  {158,158,158},{162,162,162},{166,166,166},{171,171,171},{175,175,175},{179,179,179},{184,184,184},{188,188,188},
  {192,192,192},{197,197,197},{201,201,201},{205,205,205},{209,209,209},{214,214,214},{218,218,218},{222,222,222},
  {227,227,227},{231,231,231},{235,235,235},{240,240,240},{244,244,244},{248,248,248},{252,252,252},{255,255,255},
  {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
  {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
  {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
  {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
  {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
  {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
  {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
  {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
  {255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},{255,255,255},
  {255,255,255},{255,255,255},{255,255,255},{254,254,254},{246,246,246},{239,239,239},{231,231,231},{224,224,224},
  {216,216,216},{209,209,209},{201,201,201},{194,194,194},{186,186,186},{179,179,179},{171,171,171},{164,164,164},
  {156,156,156},{149,149,149},{141,141,141},{134,134,134},{126,126,126},{119,119,119},{111,111,111},{103,103,103},
  {96,96,96},{88,88,88},{81,81,81},{73,73,73},{66,66,66},{58,58,58},{51,51,51},{43,43,43},
  {36,36,36},{28,28,28},{21,21,21},{13,13,13},{6,6,6},{4,4,4},{22,22,22},{40,40,40},
  {57,57,57},{75,75,75},{93,93,93},{110,110,110},{128,128,128},{146,146,146},{164,164,164},{181,181,181},
  {199,199,199},{217,217,217},{235,235,235},{235,235,235},{235,235,235},{235,235,235},{235,235,235},{235,235,235},
  {235,235,235},{235,235,235},{235,235,235},{235,235,235},{235,235,235},{235,235,235},{235,235,235},{235,235,235},
  {235,235,235},{235,235,235},{235,235,235},{235,235,235},{235,235,235},{235,235,235},{235,235,235},{235,235,235},
  {235,235,235},{235,235,235},{235,235,235},{235,235,235},{235,235,235},{235,235,235},{235,235,235},{235,235,235},
  {235,235,235},{235,235,235},{235,235,235},{235,235,235},{235,235,235},{235,235,235},{235,235,235},{235,235,235}
};

// -------------------------------------------------------------
// Kinematic Geometry Definitions for Snapshot Baking
// -------------------------------------------------------------
struct Seg { float ax, ay, bax, bay, invLenSq; };

static inline Seg makeSeg(float ax, float ay, float bx, float by) {
    float bax = bx - ax;
    float bay = by - ay;
    float lenSq = bax * bax + bay * bay;
    float invLenSq = (lenSq > 1e-6f) ? (1.0f / lenSq) : 0.0f;
    return { ax, ay, bax, bay, invLenSq };
}

static inline float segDistSqFast(float px, float py, const Seg& s) {
    float pax = px - s.ax;
    float pay = py - s.ay;
    float h = fmaxf(0.0f, fminf(1.0f, (pax * s.bax + pay * s.bay) * s.invLenSq));
    float dx = pax - s.bax * h;
    float dy = pay - s.bay * h;
    return dx * dx + dy * dy;
}

struct Tri { float x1, y1, x2, y2, x3, y3; };

static inline bool inTriangleFast(float px, float py, const Tri& t) {
    float d1 = (px - t.x2) * (t.y1 - t.y2) - (t.x1 - t.x2) * (py - t.y2);
    float d2 = (px - t.x3) * (t.y2 - t.y3) - (t.x2 - t.x3) * (py - t.y3);
    float d3 = (px - t.x1) * (t.y3 - t.y1) - (t.x3 - t.x1) * (py - t.y1);
    bool hasNeg = (d1 < 0.0f) || (d2 < 0.0f) || (d3 < 0.0f);
    bool hasPos = (d1 > 0.0f) || (d2 > 0.0f) || (d3 > 0.0f);
    return !(hasNeg && hasPos);
}

struct HumanPose {
    Seg farLimbs[5];
    Seg nearLimbs[6];
    float headX, headY;
};

struct HorsePose {
    Seg farLimbs[4];
    Seg nearLimbs[9];
    float cx, cy, hx, hy;
    float muzzleX, muzzleY;
    float eyeX, eyeY;
};

struct FalconPose {
    Tri tailTri;
    Seg tailSeg;
    Tri wings[4];
    Seg wingEdges[4];
    Seg torso;
    float headX, headY;
    Seg beak;
    float eyeX, eyeY;
    float coreX, coreY;
};

struct MedusaPose {
    float bellWidth, bellHeight, bellY;
    float rootX[6];
    float rootY;
    float wavePhaseBase[6];
    float amp;
};

struct RadialPose {
    float crankX, crankY;
    Seg chambers[4];
    Seg rods[4];
    float pistX[4], pistY[4];
    bool pistFires[4];
};

struct Vec2 { float x, y; };

struct TesseractPose {
    Vec2 pts[16];
    Seg edges[32];
    uint8_t edgeTier[32];
};

struct LimbK { float x, y; };
struct LegJoints { LimbK k, a, t; };
struct ArmJoints { LimbK e, h; };

static inline LegJoints calcLeg(float alpha, float hipX, float hipY, float stride) {
    float normAlpha = fmodf(alpha, TWO_PI);
    if (normAlpha < 0.0f) normAlpha += TWO_PI;
    bool isStance = (normAlpha < PI);
    float th = cosf(alpha) * 0.52f * stride;
    float kn = isStance ? (0.08f + sinf(alpha) * 0.12f * stride)
                        : (0.08f + powf(fmaxf(0.0f, sinf(alpha - PI)), 1.3f) * 1.25f * stride);
    float sh = th - kn;
    float kx = hipX + sinf(th) * 0.16f;
    float ky = hipY + cosf(th) * 0.16f;
    float ax = kx + sinf(sh) * 0.15f;
    float ay = ky + cosf(sh) * 0.15f;
    float ft = isStance ? 0.35f : (sh + 0.45f);
    float tx = ax + sinf(ft) * 0.055f;
    float ty = ay + cosf(ft) * 0.02f;
    return { {kx, ky}, {ax, ay}, {tx, ty} };
}

static inline ArmJoints calcArm(float alpha, float neckX, float neckY, float stride) {
    float shX = neckX;
    float shY = neckY + 0.03f;
    float am = -cosf(alpha) * 0.45f * stride;
    float el = 0.35f + fmaxf(0.0f, cosf(alpha)) * 0.4f * stride;
    float ex = shX + sinf(am) * 0.12f;
    float ey = shY + cosf(am) * 0.12f;
    float hx = ex + sinf(am + el) * 0.11f;
    float hy = ey + cosf(am + el) * 0.11f;
    return { {ex, ey}, {hx, hy} };
}

static void buildHumanPose(HumanPose& p, float phi, float stride) {
    float bob = -cosf(phi * 2.0f) * 0.022f * stride;
    float hipX = -0.01f;
    float hipY = 0.02f + bob;
    float neckX = hipX + 0.04f;
    float neckY = hipY - 0.20f;
    p.headX = neckX + 0.03f;
    p.headY = neckY - 0.07f;

    LegJoints l1 = calcLeg(phi, hipX, hipY, stride);
    LegJoints l2 = calcLeg(phi + PI, hipX, hipY, stride);
    ArmJoints a1 = calcArm(phi, neckX, neckY, stride);
    ArmJoints a2 = calcArm(phi + PI, neckX, neckY, stride);

    p.farLimbs[0] = makeSeg(hipX, hipY, l2.k.x, l2.k.y);
    p.farLimbs[1] = makeSeg(l2.k.x, l2.k.y, l2.a.x, l2.a.y);
    p.farLimbs[2] = makeSeg(l2.a.x, l2.a.y, l2.t.x, l2.t.y);
    p.farLimbs[3] = makeSeg(neckX, neckY + 0.03f, a2.e.x, a2.e.y);
    p.farLimbs[4] = makeSeg(a2.e.x, a2.e.y, a2.h.x, a2.h.y);

    p.nearLimbs[0] = makeSeg(neckX, neckY, hipX, hipY);
    p.nearLimbs[1] = makeSeg(hipX, hipY, l1.k.x, l1.k.y);
    p.nearLimbs[2] = makeSeg(l1.k.x, l1.k.y, l1.a.x, l1.a.y);
    p.nearLimbs[3] = makeSeg(l1.a.x, l1.a.y, l1.t.x, l1.t.y);
    p.nearLimbs[4] = makeSeg(neckX, neckY + 0.03f, a1.e.x, a1.e.y);
    p.nearLimbs[5] = makeSeg(a1.e.x, a1.e.y, a1.h.x, a1.h.y);
}

static void buildHorsePose(HorsePose& p, float phi, float stride) {
    float bob = -cosf(phi) * 0.016f * stride;
    float pitch = sinf(phi) * 0.032f * stride;

    p.cx = 0.09f; p.cy = -0.01f + bob - pitch * 0.4f;
    p.hx = -0.13f; p.hy = 0.01f + bob + pitch * 0.4f;

    float neckBaseX = p.cx + 0.03f, neckBaseY = p.cy - 0.04f;
    float pollX = p.cx + 0.11f, pollY = p.cy - 0.16f;
    p.muzzleX = pollX + 0.09f; p.muzzleY = pollY + 0.05f;
    p.eyeX = pollX + 0.04f; p.eyeY = pollY + 0.01f;
    float earX = pollX - 0.02f, earY = pollY - 0.05f;

    float fa1 = cosf(phi) * 0.65f * stride;
    float f1_fold = (sinf(phi) > 0.0f ? sinf(phi) * 0.85f * stride : -0.12f);
    float f1_shX = p.cx + 0.02f, f1_shY = p.cy + 0.04f;
    float f1_knX = f1_shX + sinf(fa1) * 0.11f;
    float f1_knY = f1_shY + cosf(fa1) * 0.11f;
    float f1_hoofX = f1_knX + sinf(fa1 - f1_fold) * 0.13f;
    float f1_hoofY = f1_knY + cosf(fa1 - f1_fold) * 0.13f;

    float fa2 = cosf(phi + 0.6f) * 0.65f * stride;
    float f2_fold = (sinf(phi + 0.6f) > 0.0f ? sinf(phi + 0.6f) * 0.85f * stride : -0.12f);
    float f2_shX = p.cx + 0.02f, f2_shY = p.cy + 0.04f;
    float f2_knX = f2_shX + sinf(fa2) * 0.11f;
    float f2_knY = f2_shY + cosf(fa2) * 0.11f;
    float f2_hoofX = f2_knX + sinf(fa2 - f2_fold) * 0.13f;
    float f2_hoofY = f2_knY + cosf(fa2 - f2_fold) * 0.13f;

    float ha1 = -cosf(phi + 0.3f) * 0.70f * stride;
    float h1_flex = (sinf(phi + 0.3f) < 0.0f ? sinf(phi + 0.3f) * 0.80f * stride : 0.15f);
    float h1_stX = p.hx, h1_stY = p.hy + 0.04f;
    float h1_hockX = h1_stX + sinf(ha1) * 0.12f;
    float h1_hockY = h1_stY + cosf(ha1) * 0.12f;
    float h1_hoofX = h1_hockX + sinf(ha1 + h1_flex) * 0.14f;
    float h1_hoofY = h1_hockY + cosf(ha1 + h1_flex) * 0.14f;

    float ha2 = -cosf(phi + 0.9f) * 0.70f * stride;
    float h2_flex = (sinf(phi + 0.9f) < 0.0f ? sinf(phi + 0.9f) * 0.80f * stride : 0.15f);
    float h2_stX = p.hx, h2_stY = p.hy + 0.04f;
    float h2_hockX = h2_stX + sinf(ha2) * 0.12f;
    float h2_hockY = h2_stY + cosf(ha2) * 0.12f;
    float h2_hoofX = h2_hockX + sinf(ha2 + h2_flex) * 0.14f;
    float h2_hoofY = h2_hockY + cosf(ha2 + h2_flex) * 0.14f;

    float tailTipX = p.hx - 0.16f - cosf(phi) * 0.02f * stride;
    float tailTipY = p.hy + 0.05f + sinf(phi * 2.0f) * 0.025f;

    p.farLimbs[0] = makeSeg(f2_shX, f2_shY, f2_knX, f2_knY);
    p.farLimbs[1] = makeSeg(f2_knX, f2_knY, f2_hoofX, f2_hoofY);
    p.farLimbs[2] = makeSeg(h2_stX, h2_stY, h2_hockX, h2_hockY);
    p.farLimbs[3] = makeSeg(h2_hockX, h2_hockY, h2_hoofX, h2_hoofY);

    p.nearLimbs[0] = makeSeg(p.cx, p.cy, p.hx, p.hy);
    p.nearLimbs[1] = makeSeg(neckBaseX, neckBaseY, pollX, pollY);
    p.nearLimbs[2] = makeSeg(pollX, pollY, p.muzzleX, p.muzzleY);
    p.nearLimbs[3] = makeSeg(pollX, pollY, earX, earY);
    p.nearLimbs[4] = makeSeg(p.hx, p.hy, tailTipX, tailTipY);
    p.nearLimbs[5] = makeSeg(f1_shX, f1_shY, f1_knX, f1_knY);
    p.nearLimbs[6] = makeSeg(f1_knX, f1_knY, f1_hoofX, f1_hoofY);
    p.nearLimbs[7] = makeSeg(h1_stX, h1_stY, h1_hockX, h1_hockY);
    p.nearLimbs[8] = makeSeg(h1_hockX, h1_hockY, h1_hoofX, h1_hoofY);
}

static void buildFalconPose(FalconPose& p, float phi, float stride) {
    float flap = sinf(phi);
    float bodyBob = -flap * 0.035f * stride;

    float bx = 0.0f;
    float by = bodyBob;
    float beakX = bx + 0.20f;
    float beakY = by - 0.02f;
    float tailBaseX = bx - 0.12f;
    float tailBaseY = by + 0.02f;

    float wingFoldX = flap > 0.0f ? -0.04f * stride : 0.02f * stride;
    float wingElbowY = flap * 0.26f * stride;
    float wingTipY = flap * 0.44f * stride + (flap < 0.0f ? -0.08f : 0.06f);

    float w1_rootX = bx + 0.03f, w1_rootY = by - 0.04f;
    float w1_midX = bx - 0.02f + wingFoldX, w1_midY = by - 0.20f + wingElbowY * 0.6f;
    float w1_tipX = bx - 0.14f + wingFoldX * 1.5f, w1_tipY = by - 0.40f + wingTipY;
    float w1_trailX = bx - 0.10f, w1_trailY = by - 0.18f + wingElbowY * 0.4f;

    float w2_rootX = bx + 0.03f, w2_rootY = by + 0.04f;
    float w2_midX = bx - 0.02f + wingFoldX, w2_midY = by + 0.20f - wingElbowY * 0.6f;
    float w2_tipX = bx - 0.14f + wingFoldX * 1.5f, w2_tipY = by + 0.40f - wingTipY;
    float w2_trailX = bx - 0.10f, w2_trailY = by + 0.18f - wingElbowY * 0.4f;

    float t1X = bx - 0.26f, t1Y = by - 0.08f;
    float t2X = bx - 0.28f, t2Y = by;
    float t3X = bx - 0.26f, t3Y = by + 0.08f;

    p.tailTri = { tailBaseX, tailBaseY, t1X, t1Y, t3X, t3Y };
    p.tailSeg = makeSeg(tailBaseX, tailBaseY, t2X, t2Y);

    p.wings[0] = { w1_rootX, w1_rootY, w1_midX, w1_midY, w1_trailX, w1_trailY };
    p.wings[1] = { w1_midX, w1_midY, w1_tipX, w1_tipY, w1_trailX, w1_trailY };
    p.wings[2] = { w2_rootX, w2_rootY, w2_midX, w2_midY, w2_trailX, w2_trailY };
    p.wings[3] = { w2_midX, w2_midY, w2_tipX, w2_tipY, w2_trailX, w2_trailY };

    p.wingEdges[0] = makeSeg(w1_rootX, w1_rootY, w1_midX, w1_midY);
    p.wingEdges[1] = makeSeg(w1_midX, w1_midY, w1_tipX, w1_tipY);
    p.wingEdges[2] = makeSeg(w2_rootX, w2_rootY, w2_midX, w2_midY);
    p.wingEdges[3] = makeSeg(w2_midX, w2_midY, w2_tipX, w2_tipY);

    p.torso = makeSeg(tailBaseX, tailBaseY, bx + 0.12f, by);
    p.headX = bx + 0.12f; p.headY = by;
    p.beak = makeSeg(bx + 0.12f, by, beakX, beakY);

    p.eyeX = bx + 0.14f; p.eyeY = by - 0.015f;
    p.coreX = bx; p.coreY = by;
}

static void buildMedusaPose(MedusaPose& p, float phi, float stride) {
    float contract = sinf(phi);
    p.bellWidth = 0.28f - contract * 0.08f * stride;
    p.bellHeight = 0.18f + contract * 0.06f * stride;
    p.bellY = -0.12f - contract * 0.04f * stride;
    p.rootY = p.bellY + p.bellHeight * 0.3f;
    p.amp = 0.04f * stride;

    for (int i = -2; i <= 3; i++) {
        int idx = i + 2;
        p.rootX[idx] = ((float)i - 0.5f) * (p.bellWidth * 0.32f);
        p.wavePhaseBase[idx] = phi + (float)i * 0.8f;
    }
}

static void buildRadialPose(RadialPose& p, float phi, float stride) {
    float crankR = 0.10f * stride;
    float rodLen = 0.22f * stride;
    p.crankX = cosf(phi) * crankR;
    p.crankY = sinf(phi) * crankR;

    for (int i = 0; i < 4; i++) {
        float angle = ((float)i * PI) * 0.5f;
        float cosA = cosf(angle);
        float sinA = sinf(angle);

        float proj = p.crankX * cosA + p.crankY * sinA;
        float perp = -p.crankX * sinA + p.crankY * cosA;
        float pDist = proj + sqrtf(fmaxf(0.0f, rodLen * rodLen - perp * perp));

        p.pistX[i] = cosA * pDist;
        p.pistY[i] = sinA * pDist;
        p.pistFires[i] = (pDist > (rodLen + crankR - 0.02f));

        p.chambers[i] = makeSeg(cosA * 0.12f, sinA * 0.12f, cosA * 0.38f, sinA * 0.38f);
        p.rods[i] = makeSeg(p.crankX, p.crankY, p.pistX[i], p.pistY[i]);
    }
}

static void buildTesseractPose(TesseractPose& p, float phi, float stride) {
    float rotXW = phi * 1.2f;
    float rotYZ = phi * 0.8f;
    float cos1 = cosf(rotXW), sin1 = sinf(rotXW);
    float cos2 = cosf(rotYZ), sin2 = sinf(rotYZ);

    for (int i = 0; i < 16; i++) {
        float x = (i & 1 ? 1.0f : -1.0f) * 0.65f;
        float y = (i & 2 ? 1.0f : -1.0f) * 0.65f;
        float z = (i & 4 ? 1.0f : -1.0f) * 0.65f;
        float w = (i & 8 ? 1.0f : -1.0f) * 0.65f;

        float rx = x * cos1 - w * sin1;
        float rw = x * sin1 + w * cos1;
        float ry = y * cos2 - z * sin2;

        float distance4D = 2.4f;
        float pScale = (1.0f / (distance4D - rw)) * 0.65f * stride;
        p.pts[i] = { rx * pScale, ry * pScale };
    }

    int edgeIdx = 0;
    for (int i = 0; i < 16; i++) {
        for (int b = 1; b <= 8; b <<= 1) {
            int j = i ^ b;
            if (i < j) {
                p.edges[edgeIdx] = makeSeg(p.pts[i].x, p.pts[i].y, p.pts[j].x, p.pts[j].y);
                p.edgeTier[edgeIdx] = (b == 8) ? 60 : 85;
                edgeIdx++;
            }
        }
    }
}

// -------------------------------------------------------------
// Snapshot Baking Procedure (Runs only on mode/stride change)
// -------------------------------------------------------------
static void bakeSnapshots(int mode, float stride) {
    if (!snapshots) return;

    HumanPose hp;
    HorsePose horseP;
    FalconPose fp;
    MedusaPose mp;
    RadialPose rp;
    TesseractPose tp;

    for (int p = 0; p < NUM_POSES; p++) {
        float framePhase = ((float)p * TWO_PI) / (float)NUM_POSES;
        float* frameBuf = &snapshots[p * (GRID_W * GRID_H)];

        if (mode == 0) buildHumanPose(hp, framePhase, stride);
        else if (mode == 1) buildHorsePose(horseP, framePhase, stride);
        else if (mode == 2) buildFalconPose(fp, framePhase, stride);
        else if (mode == 3) buildMedusaPose(mp, framePhase, stride);
        else if (mode == 4) buildRadialPose(rp, framePhase, stride);
        else buildTesseractPose(tp, framePhase, stride);

        for (int gy = 0; gy < GRID_H; gy++) {
            float fcy = FCY_MIN + ((float)gy / (float)(GRID_H - 1)) * (FCY_MAX - FCY_MIN);
            for (int gx = 0; gx < GRID_W; gx++) {
                float fcx = FCX_MIN + ((float)gx / (float)(GRID_W - 1)) * (FCX_MAX - FCX_MIN);
                float val = 0.20f;

                if (mode == 0) {
                    if (segDistSqFast(fcx, fcy, hp.farLimbs[0]) < 0.0020f ||
                        segDistSqFast(fcx, fcy, hp.farLimbs[1]) < 0.0016f ||
                        segDistSqFast(fcx, fcy, hp.farLimbs[2]) < 0.0012f ||
                        segDistSqFast(fcx, fcy, hp.farLimbs[3]) < 0.0012f ||
                        segDistSqFast(fcx, fcy, hp.farLimbs[4]) < 0.0011f) {
                        val = 0.60f;
                    }
                    if (segDistSqFast(fcx, fcy, hp.nearLimbs[0]) < 0.0042f ||
                        segDistSqFast(fcx, fcy, hp.nearLimbs[1]) < 0.0026f ||
                        segDistSqFast(fcx, fcy, hp.nearLimbs[2]) < 0.0020f ||
                        segDistSqFast(fcx, fcy, hp.nearLimbs[3]) < 0.0015f ||
                        segDistSqFast(fcx, fcy, hp.nearLimbs[4]) < 0.0016f ||
                        segDistSqFast(fcx, fcy, hp.nearLimbs[5]) < 0.0014f) {
                        val = 0.85f;
                    }
                    float dxHead = fcx - hp.headX, dyHead = fcy - hp.headY;
                    float dHeadSq = dxHead * dxHead + dyHead * dyHead;
                    if (dHeadSq < 0.002704f) {
                        val = (dHeadSq < 0.000484f) ? 1.0f : 0.85f;
                    }
                } else if (mode == 1) {
                    if (segDistSqFast(fcx, fcy, horseP.farLimbs[0]) < 0.0030f ||
                        segDistSqFast(fcx, fcy, horseP.farLimbs[1]) < 0.0020f ||
                        segDistSqFast(fcx, fcy, horseP.farLimbs[2]) < 0.0036f ||
                        segDistSqFast(fcx, fcy, horseP.farLimbs[3]) < 0.0022f) {
                        val = 0.60f;
                    }
                    float dxC = fcx - horseP.cx, dyC = fcy - horseP.cy;
                    float dxH = fcx - horseP.hx, dyH = fcy - horseP.hy;
                    if (dxC * dxC + dyC * dyC < 0.007744f ||
                        dxH * dxH + dyH * dyH < 0.006084f ||
                        segDistSqFast(fcx, fcy, horseP.nearLimbs[0]) < 0.0055f ||
                        segDistSqFast(fcx, fcy, horseP.nearLimbs[1]) < 0.0050f ||
                        segDistSqFast(fcx, fcy, horseP.nearLimbs[2]) < 0.0032f ||
                        segDistSqFast(fcx, fcy, horseP.nearLimbs[3]) < 0.0012f ||
                        segDistSqFast(fcx, fcy, horseP.nearLimbs[4]) < 0.0025f ||
                        segDistSqFast(fcx, fcy, horseP.nearLimbs[5]) < 0.0040f ||
                        segDistSqFast(fcx, fcy, horseP.nearLimbs[6]) < 0.0022f ||
                        segDistSqFast(fcx, fcy, horseP.nearLimbs[7]) < 0.0048f ||
                        segDistSqFast(fcx, fcy, horseP.nearLimbs[8]) < 0.0024f) {
                        val = 0.85f;
                    }
                    float dxM = fcx - horseP.muzzleX, dyM = fcy - horseP.muzzleY;
                    float dxE = fcx - horseP.eyeX, dyE = fcy - horseP.eyeY;
                    if (dxM * dxM + dyM * dyM < 0.000784f || dxE * dxE + dyE * dyE < 0.000324f) {
                        val = 1.0f;
                    }
                } else if (mode == 2) {
                    if (inTriangleFast(fcx, fcy, fp.tailTri) ||
                        segDistSqFast(fcx, fcy, fp.tailSeg) < 0.0035f) {
                        val = 0.60f;
                    }
                    float dxHead = fcx - fp.headX, dyHead = fcy - fp.headY;
                    if (inTriangleFast(fcx, fcy, fp.wings[0]) ||
                        inTriangleFast(fcx, fcy, fp.wings[1]) ||
                        inTriangleFast(fcx, fcy, fp.wings[2]) ||
                        inTriangleFast(fcx, fcy, fp.wings[3]) ||
                        segDistSqFast(fcx, fcy, fp.wingEdges[0]) < 0.0035f ||
                        segDistSqFast(fcx, fcy, fp.wingEdges[1]) < 0.0028f ||
                        segDistSqFast(fcx, fcy, fp.wingEdges[2]) < 0.0035f ||
                        segDistSqFast(fcx, fcy, fp.wingEdges[3]) < 0.0028f ||
                        segDistSqFast(fcx, fcy, fp.torso) < 0.0065f ||
                        dxHead * dxHead + dyHead * dyHead < 0.003025f ||
                        segDistSqFast(fcx, fcy, fp.beak) < 0.0025f) {
                        val = 0.85f;
                    }
                    float dxEye = fcx - fp.eyeX, dyEye = fcy - fp.eyeY;
                    float dxCore = fcx - fp.coreX, dyCore = fcy - fp.coreY;
                    if (dxEye * dxEye + dyEye * dyEye < 0.0004f ||
                        dxCore * dxCore + dyCore * dyCore < 0.001225f) {
                        val = 1.0f;
                    }
                } else if (mode == 3) {
                    if (fcy > mp.rootY && fcy < mp.rootY + 0.45f) {
                        for (int i = 0; i < 6; i++) {
                            float wavePhase = mp.wavePhaseBase[i] - (fcy - mp.rootY) * 6.0f;
                            float targetX = mp.rootX[i] + sinf(wavePhase) * mp.amp;
                            if (fabsf(fcx - targetX) < 0.022f) {
                                val = fmaxf(val, 0.60f);
                            }
                        }
                    }
                    float normX = fcx / mp.bellWidth;
                    float normY = (fcy - mp.bellY) / mp.bellHeight;
                    float domeDist = normX * normX + normY * normY;
                    if (domeDist < 1.0f && fcy < mp.bellY + mp.bellHeight * 0.4f) {
                        float rim = fabsf(domeDist - 0.9f);
                        val = (rim < 0.2f) ? 0.85f : 0.45f;
                    }
                    float dyInner = fcy - mp.bellY;
                    if (fcx * fcx + dyInner * dyInner < 0.0036f) {
                        val = 1.0f;
                    }
                } else if (mode == 4) {
                    for (int i = 0; i < 4; i++) {
                        if (segDistSqFast(fcx, fcy, rp.chambers[i]) < 0.0018f) {
                            val = fmaxf(val, 0.60f);
                        }
                        if (segDistSqFast(fcx, fcy, rp.rods[i]) < 0.0015f) {
                            val = fmaxf(val, 0.85f);
                        }
                        float dxP = fcx - rp.pistX[i], dyP = fcy - rp.pistY[i];
                        float dPistSq = dxP * dxP + dyP * dyP;
                        if (dPistSq < 0.002025f) {
                            val = fmaxf(val, 0.85f);
                        }
                        if (rp.pistFires[i] && dPistSq < 0.0009f) {
                            val = 1.0f;
                        }
                    }
                    float dxHub = fcx - rp.crankX, dyHub = fcy - rp.crankY;
                    if (dxHub * dxHub + dyHub * dyHub < 0.001225f) {
                        val = 1.0f;
                    }
                } else {
                    for (int i = 0; i < 32; i++) {
                        if (segDistSqFast(fcx, fcy, tp.edges[i]) < 0.0016f) {
                            float tierVal = (tp.edgeTier[i] == 60) ? 0.60f : 0.85f;
                            val = fmaxf(val, tierVal);
                        }
                    }
                    for (int i = 0; i < 16; i++) {
                        float dxN = fcx - tp.pts[i].x, dyN = fcy - tp.pts[i].y;
                        if (dxN * dxN + dyN * dyN < 0.000676f) {
                            val = 1.0f;
                        }
                    }
                }

                frameBuf[gy * GRID_W + gx] = val;
            }
        }
    }
}

void setup() {
    PFMath::buildSinLUT();

    if (!snapshots) {
        snapshots = PFMem::allocFloats(NUM_POSES * GRID_W * GRID_H);
    }

    if (snapshots) {
        int curMode = (int)fminf(5.0f, fmaxf(0.0f, floorf(kMode + 0.05f)));
        lastBakedMode = curMode;
        lastBakedStride = kStride;
        bakeSnapshots(curMode, kStride);
    }
}

void update(float dt, const InputFrame& input) {
    if (!snapshots) return;

    PFParams::apply(input, 0, &kSpeed, 0.2f, 4.0f, 0.079f);
    PFParams::apply(input, 1, &kStride, 0.4f, 2.2f, 0.038f);
    PFParams::apply(input, 2, &kPulldown, 0.0f, 1.0f, 0.021f);
    PFParams::apply(input, 3, &kMode, 0.0f, 5.0f, 0.104f);

    timeAcc += dt * kSpeed;
    if (timeAcc > 11500.0f) {
        timeAcc -= 11500.0f;
    }

    // Re-bake only when mode or kinematic stride parameter changes
    int curMode = (int)fminf(5.0f, fmaxf(0.0f, floorf(kMode + 0.05f)));
    if (curMode != lastBakedMode || fabsf(kStride - lastBakedStride) > 0.005f) {
        lastBakedMode = curMode;
        lastBakedStride = kStride;
        bakeSnapshots(curMode, kStride);
    }
}

void draw() {
    PFCanvas::setFrame(FRAME_W, FRAME_H);

    if (!snapshots) {
        PFCanvas::present();
        return;
    }

    const float halfW = (float)FRAME_W * 0.5f;
    const float halfH = (float)FRAME_H * 0.5f;
    const float scale = halfW;
    const float invScale = 1.0f / scale;

    const float t = timeAcc;
    const float pulldown = kPulldown;
    const float frameHeight = 1.15f;

    // Film Transport Engine (Glide vs 24fps Claw Snap)
    const float smoothScroll = t * 2.2f;

    const float snapFreq = 2.8f;
    const float cycle = t * snapFreq;
    const float stepFrameIdx = floorf(cycle);
    const float subFrame = cycle - stepFrameIdx;
    const float snapT = (subFrame < 0.22f) ? powf(subFrame / 0.22f, 3.5f) : 1.0f;
    const float steppedScroll = (stepFrameIdx + snapT) * frameHeight;

    const float scrollY = smoothScroll * (1.0f - pulldown) + steppedScroll * pulldown;

    // Gate bounce & judder on claw impact
    const float judderAmp = (pulldown * pulldown) * 0.035f;
    const float judderY = (subFrame < 0.28f) ? (sinf(subFrame * (PI * 8.0f)) * judderAmp) : 0.0f;

    const float barThickness = 0.06f + pulldown * 0.025f;
    const float sprocPitch = 0.2875f;
    const float halfSprocPitch = sprocPitch * 0.5f;

    // Precalculate horizontal coordinate mappings
    float nxTable[FRAME_W];
    float absXTable[FRAME_W];
    int gxTable[FRAME_W];

    for (int x = 0; x < FRAME_W; x++) {
        float nx = ((float)x - halfW) * invScale;
        nxTable[x] = nx;
        absXTable[x] = fabsf(nx);

        int gx = (int)((nx - FCX_MIN) * (INV_FCX_SPAN * (float)(GRID_W - 1)) + 0.5f);
        if (gx < 0) gx = 0;
        else if (gx >= GRID_W) gx = GRID_W - 1;
        gxTable[x] = gx;
    }

    for (int y = 0; y < FRAME_H; y++) {
        const float ny = ((float)y - halfH) * invScale + judderY;
        const float yScroll = ny + scrollY;

        // Sprocket Y terms
        const float sy = fabsf(fmodf(yScroll, sprocPitch) - halfSprocPitch);
        const float dHoleY = fmaxf(0.0f, sy - 0.065f);
        const float dHoleY2 = dHoleY * dHoleY;

        // Central picture aperture Y terms
        const float frameDiv = yScroll / frameHeight;
        const float frameNumF = floorf(frameDiv);
        const float frameRelY = yScroll - frameNumF * frameHeight;
        const int frameNum = (int)frameNumF;

        const bool isDividingBar = (frameRelY < barThickness || frameRelY > (frameHeight - barThickness));
        const float fcy = frameRelY - frameHeight * 0.5f;

        const int poseIdx = ((frameNum % NUM_POSES) + NUM_POSES) % NUM_POSES;
        const float* frameSnapshot = &snapshots[poseIdx * (GRID_W * GRID_H)];

        int gy = (int)((fcy - FCY_MIN) * (INV_FCY_SPAN * (float)(GRID_H - 1)) + 0.5f);
        if (gy < 0) gy = 0;
        else if (gy >= GRID_H) gy = GRID_H - 1;
        const int gyOffset = gy * GRID_W;

        for (int x = 0; x < FRAME_W; x++) {
            const float absX = absXTable[x];
            float val = 0.0f;

            // 1. Symmetrical 35mm Celluloid Strip
            if (absX < 0.94f) {
                val = 0.20f;

                // Guide Rails
                if (fabsf(absX - 0.90f) < 0.018f || fabsf(absX - 0.62f) < 0.018f) {
                    val = 0.45f;
                }

                // 2. Symmetrical Perforations (Sprocket Holes)
                if (absX > 0.67f && absX < 0.85f) {
                    const float sx = fabsf(absX - 0.76f);
                    const float dHoleX = fmaxf(0.0f, sx - 0.045f);

                    if (dHoleX * dHoleX + dHoleY2 < 0.000625f) {
                        val = 0.0f;
                    } else {
                        val = 0.45f;
                    }
                }

                // 3. Central Picture Aperture (Direct O(1) Snapshot Sampling)
                if (absX < 0.60f) {
                    if (isDividingBar) {
                        val = 0.0f;
                    } else {
                        val = frameSnapshot[gyOffset + gxTable[x]];
                    }
                }
            }

            // Map scalar value field to baked Color Ramp LUT
            float clampedV = fminf(1.0f, fmaxf(0.0f, val));
            int li = (int)(clampedV * 255.0f + 0.5f);
            if (li < 0) li = 0;
            if (li > 255) li = 255;

            PFCanvas::setPixel(x, y, RAMP_LUT[li][0], RAMP_LUT[li][1], RAMP_LUT[li][2]);
        }
    }

    PFCanvas::present();
}

} // namespace MuybridgeOmnibus