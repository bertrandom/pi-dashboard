#pragma once
#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_params.h"
#include "src/core_math.h"
#include "src/core_mem.h"

namespace BusWindowRain {

const char* NAME = "Bus Window Rain";
const char* const KNOB_LABELS[4] = {"Rain", "Fog", "Speed", "Focus"};
constexpr bool ABSOLUTE_READY = true;

constexpr int FRAME_W = 64;
constexpr int FRAME_H = 128;
constexpr int BW_N = FRAME_W * FRAME_H;

constexpr int BW_MAXD = 130;
constexpr float BW_K = 5.5f;       // drop lens: how wide a view each bead inverts
constexpr float BW_ROAD = 0.76f;
constexpr int BW_NS = 21;
constexpr int BW_MAXL = 64;
constexpr int BW_SQN = 1024;

// u, v (0..1 of the frame), kind, size, depth
// kinds: 0 sodium lamp, 1 traffic stack, 2 neon pink, 3 neon cyan, 4 tail light, 5 headlight, 6 window
static const float BW_SCENE[BW_NS][5] = {
  {0.10f, 0.10f, 0, 1.3f, 2.2f}, {0.46f, 0.07f, 0, 1.1f, 3.0f}, {0.82f, 0.13f, 0, 1.4f, 1.8f},
  {0.30f, 0.20f, 6, 0.8f, 3.2f}, {0.62f, 0.17f, 6, 0.8f, 3.4f}, {0.95f, 0.24f, 6, 0.9f, 2.8f},
  {0.16f, 0.24f, 2, 1.0f, 1.6f}, {0.16f, 0.29f, 2, 1.0f, 1.6f}, {0.16f, 0.34f, 2, 1.0f, 1.6f},
  {0.86f, 0.33f, 3, 1.1f, 1.5f}, {0.40f, 0.31f, 0, 1.0f, 2.6f},
  {0.66f, 0.38f, 1, 1.2f, 1.3f}, {0.28f, 0.46f, 1, 0.8f, 2.4f},
  {0.08f, 0.55f, 5, 1.2f, 1.1f}, {0.24f, 0.55f, 5, 1.2f, 1.1f},
  {0.52f, 0.60f, 4, 1.1f, 1.0f}, {0.70f, 0.60f, 4, 1.1f, 1.0f},
  {0.86f, 0.66f, 4, 1.3f, 0.8f}, {1.08f, 0.66f, 4, 1.3f, 0.8f},
  {0.36f, 0.70f, 5, 1.4f, 0.7f}, {0.58f, 0.70f, 5, 1.4f, 0.7f},
};

// knobs
static float rain = 2.0f;
static float fogRate = 2.0f;
static float speed = 0.0f;
static float focus = 0.06f;

// state
static float t = 0, flick = 0, acc = 0, gust = -1, gy = 0.5f, gs = 1.0f;
static float su[BW_NS], sv[BW_NS], sown[BW_NS];
static bool ready = false;
static const float S = (FRAME_W < FRAME_H ? FRAME_W : FRAME_H) / 64.0f;

// frame buffers (PSRAM)
static float* fog = nullptr;
static float* grain = nullptr;
static float* bgS = nullptr;
static float* bgF = nullptr;
static float* outb = nullptr;

// drops
static float ddx[BW_MAXD], ddy[BW_MAXD], ddr[BW_MAXD], ddp[BW_MAXD];
static int dn = 0;

// lens light lists
static float bwC[4];
static float bwLx[BW_MAXL], bwLy[BW_MAXL], bwLr[BW_MAXL], bwLc[BW_MAXL * 3];
static float bwSx[BW_MAXL], bwSy[BW_MAXL], bwSr[BW_MAXL], bwSc[BW_MAXL * 3];

// sqrt(t) for t in 0..1
static float sqLUT[BW_SQN + 2];

static inline float bwRand() { return (float)random(1 << 24) / 16777216.0f; }
static inline int bwCeil(float x) { return -PFMath::ifloor(-x); }
static inline float bwSqrt01(float x) {
  float f = x * BW_SQN;
  if (f <= 0) return 0;
  int i = (int)f;
  if (i >= BW_SQN) return 1.0f;
  float fr = f - i;
  return sqLUT[i] + (sqLUT[i + 1] - sqLUT[i]) * fr;
}

static void bwRgb(int kind, int i) {
  float r = 255, g = 150, b = 40, a = 1;
  if (kind == 1) {
    float ph = PFMath::jsMod(t * 0.1f + i * 0.37f, 1.0f);   // green, amber, red
    int s = ph < 0.5f ? 0 : ph < 0.62f ? 1 : 2;
    if (s == 0) { r = 20; g = 255; b = 120; } else if (s == 1) { r = 255; g = 170; b = 0; } else { r = 255; g = 20; b = 20; }
  } else if (kind == 2) {
    r = 255; g = 30; b = 170;
    a = (flick > 0 && i == 7) ? 0.1f : 1.0f;
  } else if (kind == 3) { r = 0; g = 225; b = 255; }
  else if (kind == 4) { r = 255; g = 18; b = 28; }
  else if (kind == 5) { r = 225; g = 235; b = 255; }
  else if (kind == 6) { r = 255; g = 205; b = 120; a = 0.6f; }
  bwC[0] = r; bwC[1] = g; bwC[2] = b; bwC[3] = a;
}

static void bwSpawn() {
  if (dn >= BW_MAXD) return;
  int k = dn++;
  ddx[k] = bwRand() * FRAME_W;
  ddy[k] = bwRand() * FRAME_H;
  float q = bwRand();
  ddr[k] = (q < 0.78f ? 0.9f + q * 0.9f : 1.6f + (q - 0.78f) * 5.0f) * S;
  ddp[k] = bwRand() * 0.5f;
}

static void bwBead(float x, float y, float r) {
  if (dn >= BW_MAXD) return;
  int k = dn++;
  ddx[k] = x; ddy[k] = y; ddr[k] = r; ddp[k] = 0;
}

static void bwKill(int k) {
  int j = --dn;
  ddx[k] = ddx[j]; ddy[k] = ddy[j];
  ddr[k] = ddr[j]; ddp[k] = ddp[j];
}

static void bwWipe(float x, float y, float rad) {
  int x0 = PFMath::ifloor(x - rad); if (x0 < 0) x0 = 0;
  int x1 = bwCeil(x + rad); if (x1 > FRAME_W - 1) x1 = FRAME_W - 1;
  int y0 = PFMath::ifloor(y - rad); if (y0 < 0) y0 = 0;
  int y1 = bwCeil(y + rad); if (y1 > FRAME_H - 1) y1 = FRAME_H - 1;
  float r2 = rad * rad;
  if (r2 <= 0) return;
  float ir2 = 0.5f / r2;
  for (int yy = y0; yy <= y1; yy++) {
    float ey = yy + 0.5f - y;
    for (int xx = x0; xx <= x1; xx++) {
      float ex = xx + 0.5f - x;
      float d2 = ex * ex + ey * ey;
      if (d2 < r2) {
        float v = d2 * ir2;
        int i = yy * FRAME_W + xx;
        if (fog[i] > v) fog[i] = v;
      }
    }
  }
}

static void bwInit() {
  for (int i = 0; i < BW_N; i++) {
    fog[i] = 1.0f;
    grain[i] = 0.95f + bwRand() * 0.1f;
  }
  dn = 0;
  for (int i = 0; i < 90; i++) bwSpawn();
  ready = true;
}

void setup() {
  t = 0; flick = 0; acc = 0; gust = -1;
  for (int i = 0; i < BW_NS; i++) {
    su[i] = BW_SCENE[i][0];
    sv[i] = BW_SCENE[i][1];
    int k = (int)BW_SCENE[i][2];
    sown[i] = k == 5 ? 0.035f : k == 4 ? -0.02f : 0.0f;   // cross traffic even while parked
  }
  for (int i = 0; i <= BW_SQN + 1; i++) {
    float x = (float)i / BW_SQN;
    sqLUT[i] = sqrtf(x > 1.0f ? 1.0f : x);
  }
  if (!fog) fog = PFMem::allocFloats(BW_N);
  if (!grain) grain = PFMem::allocFloats(BW_N);
  if (!bgS) bgS = PFMem::allocFloats(BW_N * 3);
  if (!bgF) bgF = PFMem::allocFloats(BW_N * 3);
  if (!outb) outb = PFMem::allocFloats(BW_N * 3);
  ready = false;
}

void update(float dt, const InputFrame& input) {
  PFParams::apply(input, 0, &rain, 2.0f, 16.0f, 0.292f);
  PFParams::apply(input, 1, &fogRate, 0.5f, 4.0f, 0.073f);
  PFParams::apply(input, 2, &speed, 0.0f, 1.0f, 0.021f);
  PFParams::apply(input, 3, &focus, 0.06f, 1.0f, 0.02f);
  if (dt > 0.05f) dt = 0.05f;
  if (dt < 0) dt = 0;

  t += dt;
  if (t >= 1000.0f) t -= 1000.0f;
  if (flick > 0) flick -= dt;
  else flick = (bwRand() < dt * 0.25f) ? 0.12f + bwRand() * 0.3f : 0.0f;

  // city drifts past
  for (int i = 0; i < BW_NS; i++) {
    float depth = BW_SCENE[i][4];
    su[i] += dt * (sown[i] - speed * 0.45f / depth);
    if (su[i] < -0.3f) { su[i] += 1.6f; if (BW_SCENE[i][2] >= 4) sv[i] = BW_SCENE[i][1] + (bwRand() - 0.5f) * 0.04f; }
    if (su[i] > 1.3f) su[i] -= 1.6f;
  }

  bool press = false;
  for (int i = 0; i < 4; i++)
    if (input.btnPressed[i] && !input.paramAbsoluteActive[i] && !input.knobAudioActive[i]) press = true;
  if (press) {
    gust = 0;
    gy = 0.2f + bwRand() * 0.6f;
    gs = (bwRand() < 0.5f ? -1.0f : 1.0f) * (0.6f + bwRand() * 0.5f);
  }
  if (!fog || !grain || !bgS || !bgF || !outb || !ready) return;
  const int w = FRAME_W, h = FRAME_H;

  float reg = dt * fogRate * 0.125f;
  for (int i = 0; i < BW_N; i++) { float f = fog[i] + reg; fog[i] = f > 1 ? 1 : f; }

  acc += dt * rain * (1 + speed);
  while (acc >= 1) { acc -= 1; bwSpawn(); }

  float rc = (1.75f - 0.4f * speed) * S;
  for (int k = dn - 1; k >= 0; k--) {
    float r = ddr[k];
    if (r < rc) {                      // stuck bead: condensation slowly fattens it
      if (r > 0.95f * S) r += dt * 0.012f * S;
      ddr[k] = r;
      if (r > 0.9f * S) bwWipe(ddx[k], ddy[k], r * 0.9f);
      continue;
    }
    if (ddp[k] > 0) { ddp[k] -= dt; bwWipe(ddx[k], ddy[k], r * 1.05f); continue; }
    float m = r * r / (S * S), mc = rc * rc / (S * S);
    float v = (7 + 5.5f * (m - mc)) * S;
    float sx = -speed * (6 + v * 0.9f / S) * S * dt;
    float sy = v * dt * (1 - 0.35f * speed);
    float big = fabsf(sx) > sy ? fabsf(sx) : sy;
    int steps = bwCeil(big);
    if (steps < 1) steps = 1;
    if (steps > 64) steps = 64;
    sx /= steps; sy /= steps;
    for (int s = 0; s < steps; s++) {
      ddx[k] += sx + (bwRand() - 0.5f) * 0.25f * S;
      ddy[k] += sy;
      bwWipe(ddx[k], ddy[k], r * 1.05f);
      if (bwRand() < 0.035f * fabsf(sy) / S && r > 1.4f * S) {
        float br = (0.55f + bwRand() * 0.35f) * S;
        bwBead(ddx[k] + (bwRand() - 0.5f) * r * 0.6f, ddy[k] - r * 0.9f, br);
        float q = r * r - br * br * 0.6f;
        r = q > 0 ? sqrtf(q) : 0.0f;
      }
    }
    ddr[k] = r;
    if (bwRand() * m < dt * 2.2f * mc) ddp[k] = 0.1f + bwRand() * 0.8f;   // stick
    if (ddy[k] - r > h || ddx[k] + r < 0 || ddx[k] - r > w) bwKill(k);
  }

  // merge touching drops (larger keeps its place)
  for (int i = 0; i < dn; i++) {
    for (int j = i + 1; j < dn; j++) {
      float ex = ddx[j] - ddx[i], ey = ddy[j] - ddy[i], rs = (ddr[i] + ddr[j]) * 0.72f;
      if (ex * ex + ey * ey < rs * rs) {
        float mi = ddr[i] * ddr[i], mj = ddr[j] * ddr[j];
        float wj = mj / (mi + mj);
        ddx[i] += ex * wj; ddy[i] += ey * wj;
        float nr = sqrtf(mi + mj);
        ddr[i] = nr < 5.5f * S ? nr : 5.5f * S;
        ddp[i] = (ddp[i] < ddp[j] ? ddp[i] : ddp[j]) * 0.5f;
        bwKill(j);
        j = i;
      }
    }
  }

  // a hand wipes a diagonal band across the glass
  if (gust >= 0) {
    float g0 = gust;
    gust += dt / 0.4f;
    float xa = (g0 * 1.3f - 0.15f) * w, xb = (gust * 1.3f - 0.15f) * w;
    float half = h * 0.13f;
    int xs = PFMath::ifloor(xa); if (xs < 0) xs = 0;
    int xe = bwCeil(xb); if (xe > w) xe = w;
    for (int x = xs; x < xe; x++) {
      float yc = gy * h + (x - w * 0.5f) * gs;
      int ys = PFMath::ifloor(yc - half); if (ys < 0) ys = 0;
      int ye = bwCeil(yc + half); if (ye > h) ye = h;
      for (int y = ys; y < ye; y++) {
        float e = fabsf(y - yc) / half;
        int i = y * w + x;
        float f = e * e * e * 0.8f;
        if (fog[i] > f) fog[i] = f;
      }
      for (int k = dn - 1; k >= 0; k--) {
        if (ddx[k] >= x && ddx[k] < x + 1 && fabsf(ddy[k] - yc) < half) bwKill(k);
      }
      if (bwRand() < 0.35f) {
        float sgn = bwRand() < 0.5f ? -1.0f : 1.0f;
        float yy = yc + sgn * half * (0.8f + bwRand() * 0.25f);
        bwBead(x + 0.5f, yy, (0.6f + bwRand() * 0.4f) * S);
      }
    }
    if (gust >= 1) gust = -1;
  }
}

static void bwSplat(float* buf, float cx, float cy, float rx, float ry, float cr, float cg, float cb, bool soft) {
  int x0 = PFMath::ifloor(cx - rx); if (x0 < 0) x0 = 0;
  int x1 = bwCeil(cx + rx); if (x1 > FRAME_W - 1) x1 = FRAME_W - 1;
  int y0 = PFMath::ifloor(cy - ry); if (y0 < 0) y0 = 0;
  int y1 = bwCeil(cy + ry); if (y1 > FRAME_H - 1) y1 = FRAME_H - 1;
  if (x0 > x1 || y0 > y1) return;
  float irx = 1.0f / (rx * rx), iry = 1.0f / (ry * ry);
  float edge = rx < ry ? rx : ry;
  for (int y = y0; y <= y1; y++) {
    float ey = y + 0.5f - cy, ty = ey * ey * iry;
    if (ty >= 1) continue;
    int o = (y * FRAME_W + x0) * 3;
    for (int x = x0; x <= x1; x++, o += 3) {
      float ex = x + 0.5f - cx;
      float tt = ex * ex * irx + ty;
      if (tt >= 1) continue;
      float a;
      if (soft) { a = 1 - tt; a *= a; }
      else {
        a = (1 - bwSqrt01(tt)) * edge * 1.3f;     // anti-aliased disc rim
        if (a > 1) a = 1;
        a *= 0.7f + 0.45f * tt;                   // bokeh: slightly brighter ring
      }
      buf[o] += cr * a; buf[o + 1] += cg * a; buf[o + 2] += cb * a;
    }
  }
}

// one light: splats into both glass buffers and records a point for the lenses
static int bwLight(float cx, float cy, float size, float depth, float cr, float cg, float cb,
                   float amp, float blur, int nl, bool refl) {
  const float h = FRAME_H;
  float R = S * (size * 0.85f + blur * (1.6f + size * 3.2f));
  float streak = S * speed * 7.0f / depth;
  float sq = sqrtf(2.2f * S / R);
  float a = amp * PFMath::clamp(sq, 0.6f, 1.25f);
  bwSplat(bgS, cx, cy, R + streak, R, cr * a, cg * a, cb * a, false);
  float RFy = S * (size * 2.2f + 4.5f + blur * 6.5f), RF = RFy + streak;
  float af = amp * (0.5f + 0.25f * (1 - blur));
  bwSplat(bgF, cx, cy, RF, RFy, cr * af, cg * af, cb * af, true);
  if (nl < BW_MAXL) {
    bwLx[nl] = cx; bwLy[nl] = cy; bwLr[nl] = 1.0f / (size * size);
    bwLc[nl * 3] = cr * amp; bwLc[nl * 3 + 1] = cg * amp; bwLc[nl * 3 + 2] = cb * amp;
    nl++;
  }
  if (refl) {                                   // wet-road reflection, stretched down
    float ry = BW_ROAD * h + (BW_ROAD * h - cy) * 0.7f + 4 * S;
    if (ry < h + R * 3) {
      float ar = a * 0.35f;
      bwSplat(bgS, cx, ry, (R + streak) * 0.8f, R * 3.2f, cr * ar, cg * ar, cb * ar, true);
      bwSplat(bgF, cx, ry, RF * 0.8f, RF * 1.6f, cr * af * 0.35f, cg * af * 0.35f, cb * af * 0.35f, true);
      if (nl < BW_MAXL) {
        bwLx[nl] = cx; bwLy[nl] = ry; bwLr[nl] = 0.5f / (size * size);
        bwLc[nl * 3] = cr * amp * 0.3f; bwLc[nl * 3 + 1] = cg * amp * 0.3f; bwLc[nl * 3 + 2] = cb * amp * 0.3f;
        nl++;
      }
    }
  }
  return nl;
}

void draw() {
  PFCanvas::setFrame(FRAME_W, FRAME_H);
  if (!fog || !grain || !bgS || !bgF || !outb) { PFCanvas::present(); return; }
  if (!ready) bwInit();
  const int w = FRAME_W, h = FRAME_H;

  // night street ambience
  for (int y = 0; y < h; y++) {
    float v = (float)y / h;
    float road = v > BW_ROAD ? 1.0f : 0.0f;
    float sr = 3 + road * 6, sg = 4 + road * 4, sb = 12 + road * 4;
    float fr = 34 + v * 10, fg = 42 + v * 6, fb = 60 - v * 6;
    int o = y * w * 3;
    for (int x = 0; x < w; x++, o += 3) {
      bgS[o] = sr; bgS[o + 1] = sg; bgS[o + 2] = sb;
      bgF[o] = fr; bgF[o + 1] = fg; bgF[o + 2] = fb;
    }
  }

  // lights: sharp bokeh for clear glass, wide dim glow for frost, points for drop lenses
  int nl = 0;
  float blur = 1 - focus;
  for (int i = 0; i < BW_NS; i++) {
    int kind = (int)BW_SCENE[i][2];
    float size = BW_SCENE[i][3], depth = BW_SCENE[i][4];
    bwRgb(kind, i);
    float cy = sv[i] * h, cx = su[i] * w;
    float amp = bwC[3];
    if (kind == 1) {                          // traffic stack: one lamp lit
      float ph = PFMath::jsMod(t * 0.1f + i * 0.37f, 1.0f);
      int s = ph < 0.5f ? 0 : ph < 0.62f ? 1 : 2;
      for (int lamp = 0; lamp < 3; lamp++) {
        float ly = cy + (lamp - 1) * 3.2f * size * S;
        bool on = (2 - lamp) == s;
        float lr = on ? bwC[0] : 60, lg = on ? bwC[1] : 40, lb = on ? bwC[2] : 30;
        float la = on ? 1.0f : 0.12f;
        nl = bwLight(cx, ly, size, depth, lr, lg, lb, la, blur, nl, true);
      }
      continue;
    }
    nl = bwLight(cx, cy, size, depth, bwC[0], bwC[1], bwC[2], amp, blur, nl, kind >= 4 || kind == 3);
  }

  // glass: frost where fogged, the sharp city where wiped
  for (int i = 0, o = 0; i < BW_N; i++, o += 3) {
    float f = fog[i];
    f = f * f * (3 - 2 * f);
    float g = grain[i] * f, c = 1 - f;
    outb[o] = bgS[o] * c + bgF[o] * g;
    outb[o + 1] = bgS[o + 1] * c + bgF[o + 1] * g;
    outb[o + 2] = bgS[o + 2] * c + bgF[o + 2] * g;
  }

  // drops: each bead is a little inverted lens of the city
  float rp = 1.15f * S * BW_K, irp = 1.0f / (rp * rp);
  for (int k = 0; k < dn; k++) {
    float cx = ddx[k], cy = ddy[k], r = ddr[k];
    if (r < 1.0f * S) {
      int px = (int)cx, py = (int)cy;          // JS `| 0` truncates toward zero
      if (px < 0 || py < 0 || px >= w || py >= h) continue;
      int o = (py * w + px) * 3;
      outb[o] = outb[o] * 0.5f + 95; outb[o + 1] = outb[o + 1] * 0.5f + 105; outb[o + 2] = outb[o + 2] * 0.5f + 125;
      continue;
    }
    // lights this lens can see
    int m = 0;
    float hr = 0, hg = 0, hb = 0, hw = 0;
    float reach = r * BW_K + 3 * S, reach2 = reach * reach;
    for (int l = 0; l < nl && m < BW_MAXL; l++) {
      float ex = bwLx[l] - cx, ey = bwLy[l] - cy;
      float d2 = ex * ex + ey * ey;
      if (d2 < reach2) {
        bwSx[m] = bwLx[l]; bwSy[m] = bwLy[l]; bwSr[m] = bwLr[l];
        bwSc[m * 3] = bwLc[l * 3]; bwSc[m * 3 + 1] = bwLc[l * 3 + 1]; bwSc[m * 3 + 2] = bwLc[l * 3 + 2];
        float wgt = 1.0f / (1 + d2 * 0.01f);
        hr += bwSc[m * 3] * wgt; hg += bwSc[m * 3 + 1] * wgt; hb += bwSc[m * 3 + 2] * wgt; hw += wgt;
        m++;
      }
    }
    float hl = 0.35f + 0.4f * (hw < 1 ? hw : 1.0f);
    float hn = hw > 0 ? 1.0f / (hw > 0.6f ? hw : 0.6f) : 0.0f;
    float hR = 150 * hl + hr * hn * 0.4f, hG = 160 * hl + hg * hn * 0.4f, hB = 185 * hl + hb * hn * 0.4f;
    int x0 = PFMath::ifloor(cx - r); if (x0 < 0) x0 = 0;
    int x1 = bwCeil(cx + r); if (x1 > w - 1) x1 = w - 1;
    int y0 = PFMath::ifloor(cy - r); if (y0 < 0) y0 = 0;
    int y1 = bwCeil(cy + r); if (y1 > h - 1) y1 = h - 1;
    float ir = 1.0f / r, ir2 = ir * ir, rr = r * r;
    for (int py = y0; py <= y1; py++) {
      float ey = py + 0.5f - cy;
      for (int px = x0; px <= x1; px++) {
        float ex = px + 0.5f - cx;
        float d2 = ex * ex + ey * ey;
        if (d2 >= rr) continue;
        float nd = bwSqrt01(d2 * ir2);
        float sx = cx - ex * BW_K, sy = cy - ey * BW_K;
        // blurred city through the bead (from the frost glow buffer, upside down)
        int qx = (int)sx, qy = (int)sy;
        if (qx < 0) qx = 0; else if (qx >= w) qx = w - 1;
        if (qy < 0) qy = 0; else if (qy >= h) qy = h - 1;
        int q = (qy * w + qx) * 3;
        float R = (bgF[q] - 34) * 1.1f + 10, G = (bgF[q + 1] - 42) * 1.1f + 12, B = (bgF[q + 2] - 56) * 1.1f + 20;
        for (int l = 0; l < m; l++) {
          float lx = sx - bwSx[l], ly = sy - bwSy[l];
          float e = 1 - (lx * lx + ly * ly) * irp * bwSr[l];
          if (e > 0) { float a = e < 0.5f ? e * 3 : 1.5f; R += bwSc[l * 3] * a; G += bwSc[l * 3 + 1] * a; B += bwSc[l * 3 + 2] * a; }
        }
        if (nd > 0.62f) {
          float edge = (nd - 0.62f) / 0.38f;
          if (ey > 0.2f) {
            float s = ey * ir * 1.6f; if (s > 1) s = 1;
            float a = edge * s; R += hR * a; G += hG * a; B += hB * a;
          } else if (ey < -0.2f) {
            float s = -ey * ir * 1.6f; if (s > 1) s = 1;
            float a = 1 - 0.75f * edge * s; R *= a; G *= a; B *= a;
          }
        }
        int o = (py * w + px) * 3;
        outb[o] = R; outb[o + 1] = G; outb[o + 2] = B;
      }
    }
  }

  for (int y = 0, o = 0; y < h; y++) {
    for (int x = 0; x < w; x++, o += 3) {
      float r = outb[o], g = outb[o + 1], b = outb[o + 2];
      r = r > 255 ? 255 : r < 0 ? 0 : r;
      g = g > 255 ? 255 : g < 0 ? 0 : g;
      b = b > 255 ? 255 : b < 0 ? 0 : b;
      PFCanvas::setPixel(x, y, (uint8_t)(int)r, (uint8_t)(int)g, (uint8_t)(int)b);
    }
  }
  PFCanvas::present();
}

} // namespace BusWindowRain