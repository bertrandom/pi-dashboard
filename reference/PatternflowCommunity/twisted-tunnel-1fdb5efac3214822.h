// ===== Patternflow pattern =====
// Title:    Twisted Tunnel
// Author:   @kpow
// Date:     2026-09-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================
//
// C++ firmware version of Twisted Tunnel on the wall. Same algorithm as the
// JavaScript and the same constants: every per-ring choice is hashed from the
// ring's index with the same integer hash, so both sides draw the same tunnel.
// Verified against the JS — worst delta 6/255 over 900 frames at five knob
// settings, from float (here) vs double (JS) arithmetic.
//
// Two implementation details the JS does not need:
//   - Zoom depth is an int + float pair. A single float loses most of each
//     frame's step near the wrap at 1000 octaves at the lowest Speed, and
//     the zoom stutters.
//   - The linear->sRGB table is allocated with PFMem in setup(), not static.
//
// See the JavaScript for how it works.
#pragma once
#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_math.h"
#include "src/core_color.h"
#include "src/core_mem.h"
#include "src/core_params.h"

namespace TwistedTunnel {
  const char* NAME = "Twisted Tunnel";
  const char* const KNOB_LABELS[4] = {"Step", "Tilt", "Color", "Speed"};
  constexpr bool ABSOLUTE_READY = true;

  constexpr int FRAME_W = 64;
  constexpr int FRAME_H = 128;

  // @knobs Step=1.2..1.72, Tilt=0..0.5, Color=0..1, Speed=0.05..12
  static float kStep = 1.46f, kTilt = 0.25f, kColor = 0.5f, kSpeed = 1.0f;
  // Zoom depth in octaves, split into whole + fraction. A single float would
  // lose most of each frame's step near the wrap at 1000 (ulp 6e-5 against a
  // 1.6e-4 step at the lowest Speed) and the zoom would stutter; the ring
  // loop only ever needs (z - k), which the split keeps exact.
  static int   zi = 40;
  static float zf = 0.0f;
  static float t = 0.0f;              // real seconds, drives the drift

  constexpr float SHAPE      = 1.5f;  // frame aspect stretch toward the tall panel
  constexpr float GOLDEN     = 0.61803398875f;
  constexpr float OCTAVE_S   = 5.2f;  // seconds per octave at Speed 1
  constexpr int   Z_WRAP     = 1000;  // multiple of 5 (colour)
  constexpr float W_MIN      = 0.4f;  // px; narrower rings are skipped
  constexpr float W_MAX      = 900.0f;// px; covers the frame at any offset/twist
  constexpr float GAMMA      = 2.2f;
  constexpr float DEV        = 1.0f;  // master deviation amount, 0 = none
  constexpr float DEV_GAP    = 0.3f;  // steps, spacing jitter (must stay < 0.5)
  constexpr float DEV_LEAN   = 0.14f; // rad, fixed per-ring lean
  constexpr float DEV_AR     = 0.18f; // fraction, aspect jitter
  constexpr float DRIFT_OFF  = 0.06f; // fraction of ring size, offset wander
  constexpr float DRIFT_ROT  = 0.06f; // rad, angle wander
  constexpr float DRIFT_HZ0  = 0.05f, DRIFT_HZ1 = 0.16f;   // cycles/s range
  constexpr float DRIFT_WRAP = 3600.0f;                   // s
  constexpr float PAT_P      = 0.2f;  // fraction of rings that get a pattern
  constexpr float PAT_PER    = 0.1f;  // pattern period / ring width
  constexpr float PAT_FADE0  = 2.0f, PAT_FADE1 = 3.5f;    // px of period
  enum { PAT_DOTS, PAT_GRID, PAT_DIAG, PAT_CHECK, PAT_BARS, NUM_PATS };
  constexpr int   LUT_N      = 4096;  // linear -> sRGB encode table
  constexpr int   C_BLACK = 3, C_WHITE = 4;

  // log(W_MAX/W_MIN)/log(1.2) = 42.3 at the tightest Step, + spacing jitter
  constexpr int MAX_RINGS = 48;
  struct Ring {
    uint8_t ci, ink; int8_t pat;
    float ex, ey, hw, hh, c, s, hi, lo, a, b, inv2, bx, by;
    float inv, fade;
  };
  static Ring rings[MAX_RINGS];

  static uint8_t palS[5][3];          // sRGB: red, blue, yellow, black, white
  static float   palL[5][3];          // the same, linear
  static float   palU = -1.0f;
  static uint8_t* enc = nullptr;       // LUT_N entries, PFMem (see setup)
  static bool    lutBuilt = false;

  static inline float frac(float v) { return v - floorf(v); }
  static inline float clamp01(float v) { return v < 0.0f ? 0.0f : v > 1.0f ? 1.0f : v; }
  static inline float clampf(float v, float a, float b) { return v < a ? a : v > b ? b : v; }
  static inline float sstep(float x) { const float v = clampf(x, 0.0f, 1.0f); return v * v * (3.0f - 2.0f * v); }
  static inline uint8_t encode(float l) { return enc[(int)(clamp01(l) * (float)(LUT_N - 1) + 0.5f)]; }

  // ── per-ring dice ─────────────────────────────────────────────────────────
  static inline float hash01(uint32_t n) {
    n *= 2654435761u; n ^= n >> 15; n *= 2246822519u; n ^= n >> 13;
    return (float)(n & 0xFFFFFFu) * (1.0f / 16777216.0f);
  }
  static inline float dice(int km, int slot)  { return hash01((uint32_t)(km * 16 + slot)); }
  static inline float sdice(int km, int slot) { return dice(km, slot) * 2.0f - 1.0f; }
  static inline int rawCol(int km) { return (int)(dice(km, 0) * 5.0f); }
  // Random, never the same as the ring outside (k-1)'s raw draw.
  static inline int ringColor(int km) {
    const int c = rawCol(km), outer = rawCol((km + Z_WRAP - 1) % Z_WRAP);
    return c == outer ? (c + 1 + (int)(dice(km, 8) * 4.0f)) % 5 : c;
  }
  // A per-ring wander rate, snapped to whole cycles per DRIFT_WRAP.
  static inline float driftHz(int km, int slot) {
    const float hz = DRIFT_HZ0 + (DRIFT_HZ1 - DRIFT_HZ0) * dice(km, slot);
    return floorf(hz * DRIFT_WRAP + 0.5f) / DRIFT_WRAP;
  }

  // ── colour: Mondrian's accents (the equation from the Mondrian pattern) ───
  static inline void hsv(float h, float s, float v, uint8_t* out) {
    PFColor::hsvToRgb(h, s, v, out[0], out[1], out[2]);
  }
  static inline float luma(const uint8_t* c) {
    return 0.2126f * (float)c[0] + 0.7152f * (float)c[1] + 0.0722f * (float)c[2];
  }
  static void accent(float h, float s, float L, uint8_t* out) {
    uint8_t probe[3];
    hsv(h, s, 1.0f, probe);
    const float Ls = luma(probe);
    if (Ls >= L) { hsv(h, s, L / Ls, out); return; }
    hsv(h, 1.0f, 1.0f, probe);
    const float L1 = luma(probe);
    const float den = 255.0f - L1;
    hsv(h, clampf((255.0f - L) / (den < 1.0f ? 1.0f : den), 0.0f, s), 1.0f, out);
  }
  static const float MOND_OFF[3] = {0.0f, 0.5920f, 0.1322f};
  static const float MOND_SAT[3] = {0.904f, 0.893f, 0.959f};
  constexpr float LUMA_LO = 48.0f, LUMA_HI = 195.0f;
  constexpr float SAT_FALLOFF = 0.35f;
  constexpr float DE_STIJL_BAND = 0.055f;
  static const uint8_t DE_STIJL_ACC[3][3] = {
    {0xD1, 0x14, 0x14}, {0x0F, 0x47, 0x8C}, {0xF2, 0xC2, 0x0A}};

  static void buildPalette(float u) {
    const float base = (u - 0.5f) - floorf(u - 0.5f);      // knob centre = Mondrian red
    float hues[3], nat[3], L[3];
    uint8_t probe[3];
    for (int a = 0; a < 3; a++) { hues[a] = base + MOND_OFF[a]; hsv(hues[a], 1.0f, 1.0f, probe); nat[a] = luma(probe); }
    float lo = nat[0], hi = nat[0];
    for (int a = 1; a < 3; a++) { if (nat[a] < lo) lo = nat[a]; if (nat[a] > hi) hi = nat[a]; }
    const float span = (hi - lo) < 1.0f ? 1.0f : (hi - lo);
    for (int a = 0; a < 3; a++) {
      L[a] = LUMA_LO + (LUMA_HI - LUMA_LO) * ((nat[a] - lo) / span);
      const float tt = (L[a] - LUMA_LO) / (LUMA_HI - LUMA_LO);
      accent(hues[a], MOND_SAT[a] * (1.0f - SAT_FALLOFF * tt), L[a], palS[a]);
    }
    const float w = 1.0f - sstep(fabsf(u - 0.5f) / DE_STIJL_BAND);
    if (w > 0.0f)
      for (int a = 0; a < 3; a++)
        for (int c = 0; c < 3; c++)
          palS[a][c] = (uint8_t)((float)palS[a][c] + ((float)DE_STIJL_ACC[a][c] - (float)palS[a][c]) * w);
    for (int c = 0; c < 3; c++) { palS[C_BLACK][c] = 0; palS[C_WHITE][c] = 255; }
    for (int i = 0; i < 5; i++)
      for (int c = 0; c < 3; c++) palL[i][c] = powf((float)palS[i][c] / 255.0f, GAMMA);
    palU = u;
  }

  // ── geometry ──────────────────────────────────────────────────────────────
  // Area of the unit pixel square where n.q <= t, |n| components hi >= lo.
  static inline float halfPlane(float tt, const Ring& q) {
    if (tt <= -q.b) return 0.0f;
    if (tt >= q.b) return 1.0f;
    if (tt < -q.a) { const float e = tt + q.b; return e * e * q.inv2; }
    if (tt > q.a)  { const float e = q.b - tt; return 1.0f - e * e * q.inv2; }
    return 0.5f + tt / q.hi;
  }

  static void makeRing(Ring& q, float cx, float cy, float w, float h, float ox, float oy, float rot) {
    q.c = cosf(rot); q.s = sinf(rot);
    const float ac = fabsf(q.c), as = fabsf(q.s);
    q.hi = ac > as ? ac : as; q.lo = ac > as ? as : ac;
    q.a = (q.hi - q.lo) * 0.5f; q.b = (q.hi + q.lo) * 0.5f;
    q.inv2 = q.lo > 1e-6f ? 1.0f / (2.0f * q.hi * q.lo) : 0.0f;
    q.ex = cx + ox * w; q.ey = cy + oy * h;
    q.hw = w * 0.5f;    q.hh = h * 0.5f;
    q.bx = ac * q.hw + as * q.hh + 1.0f;
    q.by = as * q.hw + ac * q.hh + 1.0f;
  }

  // Coverage of pixel centre (px,py) by ring q; leaves ring-local LX / LY.
  static float LX = 0.0f, LY = 0.0f;
  static inline float coverage(const Ring& q, float px, float py) {
    const float dx = px - q.ex, dy = py - q.ey;
    if (dx > q.bx || dx < -q.bx || dy > q.by || dy < -q.by) return 0.0f;
    const float lx = dx * q.c + dy * q.s, ly = -dx * q.s + dy * q.c;
    LX = lx; LY = ly;
    const float ax = fabsf(lx), ay = fabsf(ly);
    if (ax >= q.hw + q.b || ay >= q.hh + q.b) return 0.0f;
    if (ax <= q.hw - q.b && ay <= q.hh - q.b) return 1.0f;
    const float cx = halfPlane(q.hw - lx, q) - halfPlane(-q.hw - lx, q);
    const float cy = halfPlane(q.hh - ly, q) - halfPlane(-q.hh - ly, q);
    return cx * cy;
  }

  // Pattern ink, 0..1, at pattern coords (u, v); fw = 1 px in pattern units.
  static inline float edge(float d, float fw) { return clamp01(d / fw + 0.5f); }
  static inline float tri(float v) { return fabsf(v - floorf(v) - 0.5f); }
  static inline float ink(int pat, float u, float v, float fw) {
    switch (pat) {
      case PAT_DOTS:  { const float x = tri(u), y = tri(v); return edge(0.27f - sqrtf(x * x + y * y), fw); }
      case PAT_GRID:  { const float x = tri(u), y = tri(v); return edge(0.13f - (0.5f - (x > y ? x : y)), fw); }
      case PAT_DIAG:  return edge(0.25f - tri((u + v) * 0.7071f), fw * 0.7071f);
      case PAT_CHECK: { const float a = edge(tri(u) - 0.25f, fw), b = edge(tri(v) - 0.25f, fw); return a + b - 2.0f * a * b; }
      default:        return edge(0.22f - tri(v), fw);   // PAT_BARS
    }
  }

  void setup() {
    zi = 40; zf = 0.0f;
    t = 0.0f;
    if (!enc) { enc = (uint8_t*)PFMem::alloc(LUT_N); lutBuilt = false; }
    if (!lutBuilt) {
      for (int i = 0; i < LUT_N; i++)
        enc[i] = (uint8_t)floorf(255.0f * powf((float)i / (float)(LUT_N - 1), 1.0f / GAMMA) + 0.5f);
      lutBuilt = true;
    }
    buildPalette(kColor);
  }

  void update(float dt, const InputFrame& input) {
    PFParams::apply(input, 0, &kStep,  1.2f,  1.72f, (1.72f - 1.2f) / 48.0f);
    PFParams::apply(input, 1, &kTilt,  0.0f,  0.5f,  0.5f / 48.0f);
    PFParams::applyUnit(input, 2, &kColor);
    PFParams::apply(input, 3, &kSpeed, 0.05f, 12.0f, (12.0f - 0.05f) / 48.0f);
    const float u = clampf(kColor, 0.0f, 1.0f);
    if (u != palU) buildPalette(u);
    zf += dt * kSpeed / OCTAVE_S;
    while (zf >= 1.0f) { zf -= 1.0f; zi++; }
    if (zi >= Z_WRAP) zi -= Z_WRAP;
    t += dt;
    if (t >= DRIFT_WRAP) t -= DRIFT_WRAP;   // every drift rate is whole cycles per wrap
  }

  void draw() {
    PFCanvas::setFrame(FRAME_W, FRAME_H);
    const int W = FRAME_W, H = FRAME_H;
    const float cx = W * 0.5f, cy = H * 0.5f;
    const float lnS = logf(kStep);
    const float T = TWO_PI * t;

    // Visible index range: w = step^(z-k) in [W_MIN, W_MAX].
    const int kIn  = zi + (int)floorf(zf - logf(W_MIN) / lnS);   // smallest ring
    const int kOut = zi + (int)ceilf(zf - logf(W_MAX) / lnS);    // largest ring
    int n = 0;
    for (int k = kIn; k >= kOut && n < MAX_RINGS; k--) {
      const int km = ((k % Z_WRAP) + Z_WRAP) % Z_WRAP;
      const float age = (float)(zi - k) + zf;
      const float ar = (0.74f + 0.42f * (float)((km * 7) % 5) / 5.0f) * SHAPE * (1.0f + DEV * DEV_AR * sdice(km, 2));
      const float ox = (frac((float)km * GOLDEN) - 0.5f) * 0.22f
                     + DEV * DRIFT_OFF * sinf(T * driftHz(km, 9) + TWO_PI * dice(km, 3));
      const float oy = (frac((float)km * GOLDEN * 2.0f) - 0.5f) * 0.17f
                     + DEV * DRIFT_OFF * sinf(T * driftHz(km, 10) + TWO_PI * dice(km, 4));
      const float rot = age * kTilt
                      + DEV * (DEV_LEAN * sdice(km, 5) + DRIFT_ROT * sinf(T * driftHz(km, 11) + TWO_PI * dice(km, 6)));
      const float w = expf((age + DEV * DEV_GAP * sdice(km, 7)) * lnS);
      Ring& q = rings[n++];
      makeRing(q, cx, cy, w, w * ar, ox, oy, rot);
      q.ci = (uint8_t)ringColor(km);
      q.pat = -1;
      if (dice(km, 12) < PAT_P) {
        const float per = w * PAT_PER * (0.75f + 0.5f * dice(km, 14));
        q.fade = clamp01((per - PAT_FADE0) / (PAT_FADE1 - PAT_FADE0));
        if (q.fade > 0.0f) {
          q.pat = (int8_t)(dice(km, 13) * (float)NUM_PATS);
          q.inv = 1.0f / per;
          q.ink = q.ci == C_BLACK ? C_WHITE : C_BLACK;
        }
      }
    }

    for (int y = 0; y < H; y++) {
      const float py = (float)y + 0.5f;
      for (int x = 0; x < W; x++) {
        const float px = (float)x + 0.5f;
        float r = 0.0f, g = 0.0f, b = 0.0f, rem = 1.0f;
        int solid = -1;
        for (int i = 0; i < n && rem > 0.002f; i++) {
          const Ring& q = rings[i];
          const float cov = coverage(q, px, py);
          if (cov <= 0.0f) continue;
          if (q.pat < 0 && cov >= 1.0f && rem == 1.0f) { solid = q.ci; break; }
          const float* col = palL[q.ci];
          float cr = col[0], cg = col[1], cb = col[2];
          if (q.pat >= 0) {
            const float m = ink(q.pat, LX * q.inv, LY * q.inv, q.inv) * q.fade;
            if (m > 0.0f) {
              const float* c2 = palL[q.ink];
              cr += (c2[0] - cr) * m; cg += (c2[1] - cg) * m; cb += (c2[2] - cb) * m;
            }
          }
          const float a = rem * cov;
          r += a * cr; g += a * cg; b += a * cb;
          rem -= a;
        }
        if (solid >= 0) {
          PFCanvas::setPixel(x, y, palS[solid][0], palS[solid][1], palS[solid][2]);
          continue;
        }
        // background (black) contributes nothing in linear light
        PFCanvas::setPixel(x, y, encode(r), encode(g), encode(b));
      }
    }
    PFCanvas::present();
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix or share this pattern.