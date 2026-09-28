// ===== Patternflow pattern =====
// Title:    Bessel Dish
// Author:   @kpow
// Date:     2026-09-04
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================
//
// C++ header for the Bessel Dish JavaScript pattern. Verified on a Noodle 2K
// hub75 satellite (ESP32-S3, 32x64 today, 64x128 landing) against the JS
// through Patternflow's own harness: frame 150 at fixed knobs matches within
// 9/255 per channel. 40 fps on that board.
//
// The height field is solved on a half-resolution grid and bilinearly
// upsampled in the shading pass (the surface is smooth; the ribbons are
// thresholded after interpolation so their edges stay crisp). Polar tables
// are cached per zoom level and every per-pixel divide is a per-frame inverse.
#pragma once
#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_math.h"
#include "src/core_mem.h"
#include "src/core_params.h"

namespace BesselDish {
  const char* NAME = "Bessel Dish";
  const char* const KNOB_LABELS[4] = {"Density", "Speed", "Form", "Zoom"};
  constexpr bool ABSOLUTE_READY = true;

  constexpr int FRAME_W = 64;
  constexpr int FRAME_H = 128;

  // @knobs Density=0..1, Speed=0.05..3, Form=0..1, Zoom=0..1
  static float kDens = 0.6f, kSpeed = 0.5f, kForm = 0.3f, kZoom = 0.8f;
  static float t = 0.0f;
  static float zoomS = 0.8f;          // eased zoom, chases the knob

  constexpr int HW = FRAME_W / 2, HH = FRAME_H / 2;
  static float* H  = nullptr;         // height field, HW*HH
  static float* Rr = nullptr;         // radius from the dish centre, HW*HH
  static float* Th = nullptr;         // polar angle, HW*HH
  static float  polarR = -1.0f;       // the R the polar tables were built for
  static uint8_t colIx[FRAME_W];      // pass-2 column tables: left sample + weight
  static float   colTx[FRAME_W];
  static bool    colsBuilt = false;

  // [crest lamp, trough lamp, core]
  static const uint8_t SCHEMES[13][3][3] = {
    {{0xFF, 0xC0, 0x18}, {0xB0, 0x10, 0xFF}, {0xFF, 0xF2, 0xB0}},   // Royal: gold / magenta
    {{0x00, 0x85, 0x7A}, {0xFF, 0x2E, 0x8A}, {0xC8, 0xFF, 0xF4}},   // Petrol
    {{0xFF, 0x3A, 0x00}, {0x00, 0xA6, 0xFF}, {0xFF, 0xD8, 0xA0}},   // Ink Dish
    {{0x1E, 0x5B, 0xFF}, {0x00, 0xFF, 0xB3}, {0xE6, 0xF6, 0xFF}},   // Hex Ice
    {{0xC4, 0x00, 0x28}, {0xFF, 0x7A, 0x00}, {0xFF, 0xE0, 0x4D}},   // Lava Lamp
    {{0x00, 0xFF, 0x9C}, {0xFF, 0x00, 0x6E}, {0xE0, 0xFF, 0xF0}},   // Neon Mint
    {{0xFF, 0x6A, 0x00}, {0x10, 0x30, 0xFF}, {0xFF, 0xE8, 0xC0}},   // Cobalt Ember
    {{0xC8, 0xFF, 0x00}, {0x8A, 0x00, 0xE6}, {0xF4, 0xFF, 0xC0}},   // Acid Grape
    {{0xFF, 0x4D, 0x4D}, {0x00, 0xC8, 0xD8}, {0xFF, 0xE6, 0xD0}},   // Coral Reef
    {{0xFF, 0x9A, 0x00}, {0x00, 0x6E, 0x7A}, {0xFF, 0xF0, 0xC0}},   // Sunset Teal
    {{0xFF, 0x2A, 0x00}, {0x80, 0xD0, 0xFF}, {0xFF, 0xD0, 0xB0}},   // Blood Orange Ice
    {{0x7C, 0xFF, 0x2E}, {0xFF, 0x3C, 0xB4}, {0xF0, 0xFF, 0xE0}},   // Lime Rose
    {{0xFF, 0xB8, 0x7A}, {0x3A, 0x1C, 0xB0}, {0xFF, 0xF4, 0xE8}},   // Peach Indigo
  };
  constexpr int NUM_SCHEMES = 13;
  static const int ORDERS[4] = {4, 5, 6, 8};
  constexpr float HOLD = 6.0f, WIPE = 4.0f;    // seconds per permutation at Speed 1

  static inline float sstep(float a, float b, float x) {
    float v = (x - a) / (b - a);
    v = v < 0.0f ? 0.0f : v > 1.0f ? 1.0f : v;
    return v * v * (3.0f - 2.0f * v);
  }
  // Division-free smoothstep: (a, 1/(b-a)) are precomputed once per frame.
  static inline float ss(float a, float invW, float x) {
    float v = (x - a) * invW;
    v = v < 0.0f ? 0.0f : v > 1.0f ? 1.0f : v;
    return v * v * (3.0f - 2.0f * v);
  }

  // Per-frame constants of one tone pair: k1/k2 and, per symmetry order, the
  // Bessel turn-on ramps (a, 1/width) for the m-fold and 2m-fold modes.
  struct Tones { float k1, k2; float a1[4], w1[4], a2[4], w2[4]; };
  static void tones_for(Tones& T, float k1) {
    T.k1 = k1; T.k2 = k1 * 1.35f;
    for (int i = 0; i < 4; i++) {
      const float m1 = (float)ORDERS[i], m2 = 2.0f * m1;
      const float lo1 = 0.45f * m1 / k1, hi1 = 0.95f * m1 / k1;
      const float lo2 = 0.55f * m2 / T.k2, hi2 = 1.05f * m2 / T.k2;
      T.a1[i] = lo1; T.w1[i] = 1.0f / (hi1 - lo1);
      T.a2[i] = lo2; T.w2[i] = 1.0f / (hi2 - lo2);
    }
  }

  // Integer hash -> [0,1). The permutation sequence is drawn from this, so
  // it never repeats in practice (2^32 period) yet stays reproducible.
  static inline float hash01(uint32_t n) {
    n *= 2654435761u; n ^= n >> 15; n *= 2246822519u; n ^= n >> 13;
    return (float)(n & 0xFFFFFFu) * (1.0f / 16777216.0f);
  }
  static inline int rawScheme(long n) { return (int)(hash01((uint32_t)(n * 4 + 1)) * (float)NUM_SCHEMES); }

  struct Perm { float p; const uint8_t (*sch)[3]; float rot; float dir; float ks; Tones TA, TB; };

  // Permutation n: a random symmetry morph position, a scheme that differs
  // from the previous one, a random start angle, spin direction, and a ring
  // count within +-15% (so each permutation carries its own tone pair).
  static Perm perm(long n, float form, float k1) {
    n += 1000;   // keep the index positive
    Perm o;
    o.p = fmodf(hash01((uint32_t)(n * 4)) * 4.0f + form * 4.0f, 4.0f);
    int si = rawScheme(n);
    if (si == rawScheme(n - 1)) si = (si + 1) % NUM_SCHEMES;
    o.sch = SCHEMES[si];
    const float h2 = hash01((uint32_t)(n * 4 + 2));
    o.rot = h2 * TWO_PI;
    o.dir = h2 > 0.5f ? 1.0f : -1.0f;
    o.ks  = 0.85f + 0.30f * hash01((uint32_t)(n * 4 + 3));
    tones_for(o.TA, k1 * o.ks);
    tones_for(o.TB, k1 * o.ks * 1.06f);
    return o;
  }

  // Two-tone dish surface at polar (r, th), three zones cross-faded by radius.
  static inline float dish(float r, float th, const Tones& T, int oi, float tt, float rot) {
    const float m1 = (float)ORDERS[oi], m2 = 2.0f * m1;
    const float on1 = ss(T.a1[oi], T.w1[oi], r);
    const float on2 = ss(T.a2[oi], T.w2[oi], r);
    const float rings  = PFMath::fastCos(T.k1 * r - tt);
    const float petals = rings * PFMath::fastCos(m1 * (th + rot));
    const float tone2  = PFMath::fastCos(T.k2 * r + 0.6f * tt) * PFMath::fastCos(m2 * (th - 0.5f * rot));
    return rings * (1.0f - on1) + petals * (on1 - on2) + 0.55f * (petals + tone2) * on2;
  }

  // Morph between adjacent symmetries at position p (continuous, wraps 8 -> 4).
  // TA is the tone pair at k1, TB the slightly detuned pair (k1*1.06) that
  // the incoming symmetry rides on.
  static inline float surface(float r, float th, const Tones& TA, const Tones& TB,
                              float p, float tt, float rot) {
    const int   ip = (int)floorf(p);
    const int   ia = ip % 4, ib = (ia + 1) % 4;
    const float bl = ss(0.0f, 1.0f, p - (float)ip);
    const float za = dish(r, th, TA, ia, tt, rot);
    if (bl < 0.001f) return za;
    const float zb = dish(r, th, TB, ib, tt * 1.07f, -rot);
    return za * (1.0f - bl) + zb * bl;
  }

  void setup() {
    PFMath::buildSinLUT();
    if (!H)  H  = (float*)PFMem::alloc(sizeof(float) * HW * HH);
    if (!Rr) Rr = (float*)PFMem::alloc(sizeof(float) * HW * HH);
    if (!Th) Th = (float*)PFMem::alloc(sizeof(float) * HW * HH);
    polarR = -1.0f;
    t = 0.0f;
    zoomS = 0.8f;
  }

  void update(float dt, const InputFrame& input) {
    PFParams::apply(input, 0, &kDens,  0.0f,  1.0f, 0.021f);
    PFParams::apply(input, 1, &kSpeed, 0.05f, 3.0f, 0.061f);
    PFParams::apply(input, 2, &kForm,  0.0f,  1.0f, 0.021f);
    PFParams::apply(input, 3, &kZoom,  0.0f,  1.0f, 0.021f);
    t += dt * kSpeed;
    // Ease the zoom so a knob twist glides instead of jumping (~0.6 s settle).
    zoomS += (kZoom - zoomS) * (1.0f - expf(-dt * 5.0f));
  }

  void draw() {
    PFCanvas::setFrame(FRAME_W, FRAME_H);
    if (!H || !Rr || !Th) { PFCanvas::present(); return; }
    const int w = FRAME_W, h = FRAME_H;
    const float dens = kDens, form = kForm;

    if (!colsBuilt) {
      for (int x = 0; x < w; x++) {
        const float fx = ((float)x - 0.5f) * 0.5f;
        int ix = (int)floorf(fx); float tx = fx - (float)ix;
        if (ix < 0) { ix = 0; tx = 0.0f; } else if (ix > HW - 2) { ix = HW - 2; tx = 1.0f; }
        colIx[x] = (uint8_t)ix; colTx[x] = tx;
      }
      colsBuilt = true;
    }

    // Zoom: R from a three-dish stack (19 px) to past the frame corners, so at
    // full zoom no rim is visible anywhere.
    const float Rmax = (sqrtf((float)(w * w) * 0.25f + (float)(h * h) * 0.25f) + 4.0f) * 1.5f;
    const float R = 24.0f + (Rmax - 24.0f) * sstep(0.0f, 1.0f, zoomS);
    const float gap = 6.0f, pitch = 2.0f * R + gap, invPitch = 1.0f / pitch;
    const float cx = w * 0.5f, cy = h * 0.5f;
    const float k1 = (TWO_PI * (3.0f + 0.25f * PFMath::fastSin(t * 0.21f))) / R;
    const float breathe = 0.8f + 0.2f * PFMath::fastSin(t * 0.5f);

    // Permutation clock: hold, then the next one grows out of the centre.
    const float period = HOLD + WIPE;
    const long  n = (long)floorf(t / period);
    float u = (t - (float)n * period - HOLD) / WIPE;             // 0 = holding, 0..1 = wipe
    if (u < 0.0f) u = 0.0f;
    const float uE = sstep(0.0f, 1.0f, u);
    const float rw = uE * (R + 8.0f) - 2.0f;                      // wipe radius
    const float uOut = 1.0f - (1.0f - u) * (1.0f - u);            // ease-out
    const float zoomIn = 0.18f + 0.82f * uOut;                    // newborn starts small, zooms in
    const float invZoomIn = 1.0f / zoomIn;
    const float spin = t * 0.05f;
    const bool  wiping = u > 0.0f;
    const float mixA = rw - 5.0f, mixW = 0.1f;                    // 1/10

    // Per dish j (-1 above, 0 middle, +1 below): old and new permutations.
    Perm PO[3], PN[3];
    for (int j = 0; j < 3; j++) { PO[j] = perm(n - 1 + j, form, k1); PN[j] = perm(n + j, form, k1); }

    // Polar tables (r, theta per half-grid sample) depend only on R: rebuild
    // when the zoom moves, reuse while it holds.
    if (fabsf(R - polarR) > 1e-3f) {
      for (int gy = 0; gy < HH; gy++) {
        const float y = 2.0f * gy + 0.5f;
        int j = (int)floorf((y - cy) * invPitch + 0.5f);
        if (j < -1) j = -1; else if (j > 1) j = 1;
        const float dy = y - (cy + (float)j * pitch);
        for (int gx = 0; gx < HW; gx++) {
          const float dx = 2.0f * gx + 0.5f - cx;
          Rr[gy * HW + gx] = sqrtf(dx * dx + dy * dy);
          Th[gy * HW + gx] = PFMath::fastAtan2(dy, dx);
        }
      }
      polarR = R;
    }

    // 1. Height field on the half grid.
    const float rimA = R - 4.0f, rimW = 0.25f;                    // 1/4
    for (int gy = 0; gy < HH; gy++) {
      const float y = 2.0f * gy + 0.5f;
      int j = (int)floorf((y - cy) * invPitch + 0.5f);
      if (j < -1) j = -1; else if (j > 1) j = 1;
      const Perm& po = PO[j + 1];
      const Perm& pn = PN[j + 1];
      float* hrow = H + gy * HW;
      const float* rrow = Rr + gy * HW;
      const float* trow = Th + gy * HW;
      for (int gx = 0; gx < HW; gx++) {
        const float r = rrow[gx];
        float z = 0.0f;
        if (r < R) {
          const float th = trow[gx];
          const float mix = wiping ? 1.0f - ss(mixA, mixW, r) : 0.0f;
          float zo = 0.0f, zn = 0.0f;
          if (mix < 0.999f) zo = surface(r, th, po.TA, po.TB, po.p, t, po.dir * spin + po.rot);
          if (mix > 0.001f) zn = surface(r * invZoomIn, th, pn.TA, pn.TB, pn.p, t, pn.dir * spin + pn.rot);
          z = (zo * (1.0f - mix) + zn * mix) * (1.0f - ss(rimA, rimW, r));
        }
        hrow[gx] = breathe * z;
      }
    }

    // 2. Shade: crests lamp 1, troughs lamp 2, tops a pale core. Density
    // widens the ribbons until the black closes up. Scheme follows the wipe.
    const float thr = 0.62f - 0.50f * dens, soft = 0.12f;
    const float thrA = thr - soft, thrW = 1.0f / (2.0f * soft);
    const float fill = 0.30f * dens * dens;
    const float invBreathe = 1.0f / breathe;
    const float edgeA = R - 3.0f, edgeW = 0.5f;                   // 1/2
    const float edgeB = R, edgeBW = 1.0f / 1.5f;
    const float coreA = 0.80f, coreW = 1.0f / 0.18f;
    for (int y = 0; y < h; y++) {
      int j = (int)floorf(((float)y - cy) * invPitch + 0.5f);
      if (j < -1) j = -1; else if (j > 1) j = 1;
      const uint8_t (*so)[3] = PO[j + 1].sch;
      const uint8_t (*sn)[3] = PN[j + 1].sch;
      const float fy = ((float)y - 0.5f) * 0.5f;
      int iy = (int)floorf(fy); float ty = fy - (float)iy;
      if (iy < 0) { iy = 0; ty = 0.0f; } else if (iy > HH - 2) { iy = HH - 2; ty = 1.0f; }
      const float sy = 1.0f - ty;
      const float* h0 = H  + iy * HW; const float* h1 = h0 + HW;
      const float* r0 = Rr + iy * HW; const float* r1 = r0 + HW;
      for (int x = 0; x < w; x++) {
        const int ix = colIx[x]; const float tx = colTx[x], sx = 1.0f - tx;
        const float r = (r0[ix] * sx + r0[ix + 1] * tx) * sy + (r1[ix] * sx + r1[ix + 1] * tx) * ty;
        if (r > R + 2.0f) { PFCanvas::setPixel(x, y, 0, 0, 0); continue; }
        const float z = ((h0[ix] * sx + h0[ix + 1] * tx) * sy + (h1[ix] * sx + h1[ix + 1] * tx) * ty) * invBreathe;
        const float mix = wiping ? 1.0f - ss(mixA, mixW, r) : 0.0f;
        const float A = ss(thrA, thrW, z);
        const float B = ss(thrA, thrW, -z);
        const float core = ss(coreA, coreW, z);
        const float glow = r < R ? fill * (0.5f + 0.5f * z) : 0.0f;
        const float edge = ss(edgeA, edgeW, r) * (1.0f - ss(edgeB, edgeBW, r)) * 0.6f;
        const float lamp[3] = { A + glow * 0.6f, B + glow * 0.4f + edge, core };
        const float om = 1.0f - mix;
        float r8 = 0.0f, g8 = 0.0f, b8 = 0.0f;
        for (int c = 0; c < 3; c++) {
          if (lamp[c] <= 0.0f) continue;
          r8 += lamp[c] * ((float)so[c][0] * om + (float)sn[c][0] * mix);
          g8 += lamp[c] * ((float)so[c][1] * om + (float)sn[c][1] * mix);
          b8 += lamp[c] * ((float)so[c][2] * om + (float)sn[c][2] * mix);
        }
        PFCanvas::setPixel(x, y, (uint8_t)(r8 > 255.0f ? 255.0f : r8),
                                 (uint8_t)(g8 > 255.0f ? 255.0f : g8),
                                 (uint8_t)(b8 > 255.0f ? 255.0f : b8));
      }
    }
    PFCanvas::present();
  }
}