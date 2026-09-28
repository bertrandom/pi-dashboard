// ===== Patternflow pattern =====
// Title:    Mondrian
// Author:   @kpow
// Date:     2026-09-17
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================
//
// C++ firmware version of the Mondrian pattern on the wall. Same algorithm as
// the JavaScript, line for line: same seeded RNG, same order of every random
// draw, so both sides generate the same compositions. Verified against the
// JS frame for frame — 0 differing pixels.
//
// One constant differs on purpose: GROUND_V is 0.68 here and 1.0 in the JS.
// On an LED panel the ground is most of the frame, so a full-white one is both
// the glare and most of the current draw; 0.68 still reads as white on a
// panel. On a screen there is always something brighter in view, which is why
// the preview runs it at 1.0. Nothing else differs.
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

namespace Mondrian {
  const char* NAME = "Mondrian";
  const char* const KNOB_LABELS[4] = {"Color", "Hold", "Cells", "Speed"};
  constexpr bool ABSOLUTE_READY = true;

  constexpr int FRAME_W = 64;
  constexpr int FRAME_H = 128;

  // @knobs Color=0..1, Hold=0..1, Cells=0..1, Speed=0.05..3
  static float kColor = 0.5f, kHold = 0.35f, kDens = 0.5f, kSpeed = 1.0f;

  constexpr int   MAX_DEPTH = 5, NODES = 63;

  constexpr float MIN_CELL = 15.0f;

  constexpr float CELL_MIN_PX = 8.0f;

  constexpr float RULE_W = 2.0f;

  constexpr float AA_SHARP = 2.2f;

  constexpr float GROUND_V = 0.68f;

  constexpr float RC_LEG      = 2.2f;
  constexpr float TV_L1_END   = 0.62f;
  constexpr float TV_L2_START = 0.38f;
  constexpr float TV_INSET    = 1.0f;
  constexpr float REFLOW_MIN  = 0.20f;

  constexpr float REMIX_MIN_AREA = 900.0f;
  constexpr float GROUND_WEIGHT  = 0.12f;
  constexpr int   REMIX_TRIES    = 6;

  constexpr float MOVE_MIN_S  = 0.30f, MOVE_MAX_S  = 7.0f;
  constexpr float GAP_MIN_S   = 0.6f,  GAP_MAX_S   = 240.0f;
  constexpr float SLIDE_MIN_S = 0.35f, SLIDE_MAX_S = 9.0f;

  struct Node {
    uint8_t used, leaf, axis, fill;
    float   home, cur, hFrom, hTo;
    float   x0, y0, x1, y1;
  };
  static Node     N[NODES];
  static uint8_t* buf = nullptr;

  static uint32_t rngState = 0x2545F491u;
  static float    T = 0.0f;
  static int      targetLeaves = 8;
  static float    densAt = -1.0f;
  static float    spdNow = 1.0f, holdS = 8.0f, holdReal = 8.0f, legNow = RC_LEG;

  static int   rcNode = -1, rcPhase = 0, rcEdge = 0, rcBudget = 8;
  static float rcVal = 0.5f, rcFrom = 0.5f, rcTo = 0.5f, rcU = 0.0f, rcTimer = 8.0f;
  static float gU = 1.0f;

  static int   tvActive = 0, tvSrc = 0, tvDst = 0, tvColor = 1, tvXFirst = 1;
  static float tvT = 0.0f, tvDur = 1.8f, tvTimer = 3.5f;

  static float sFromHome[NODES], sKeep[NODES];
  static float sFx0[NODES], sFy0[NODES], sFx1[NODES], sFy1[NODES];

  static inline float clampf(float v, float a, float b) { return v < a ? a : v > b ? b : v; }
  static inline float sstep(float x) { const float v = clampf(x, 0.0f, 1.0f); return v * v * (3.0f - 2.0f * v); }
  static inline int   depthOf(int i) { return 31 - __builtin_clz((unsigned)(i + 1)); }
  static inline float roundf2(float v) { return floorf(v + 0.5f); }
  static inline float minf(float a, float b) { return a < b ? a : b; }
  static inline float maxf(float a, float b) { return a > b ? a : b; }

  constexpr int EASE_HOLD = 4;
  constexpr int EASE_TURN = 2;
  static inline float ipow(float u, int n) { float r = 1.0f; for (int i = 0; i < n; i++) r *= u; return r; }
  static inline float easeAB(float x, int a, int b) {
    const float u = clampf(x, 0.0f, 1.0f);
    if (u <= 0.0f) return 0.0f;
    if (u >= 1.0f) return 1.0f;
    const float pa = ipow(u, a), pb = ipow(1.0f - u, b);
    return pa / (pa + pb);
  }

  static inline float rnd() {
    rngState = rngState * 1664525u + 1013904223u;
    return (float)(rngState >> 8) * (1.0f / 16777216.0f);
  }

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

  // ── colour: one continuous equation, no scheme table ──────────────────────
  static const float MOND_OFF[3] = {0.0f, 0.5920f, 0.1322f};
  static const float MOND_SAT[3] = {0.904f, 0.893f, 0.959f};

  constexpr float LUMA_LO = 48.0f, LUMA_HI = 195.0f;
  constexpr float SAT_FALLOFF = 0.35f;
  static void lumaTargets(const float* hues, float* out) {
    float nat[3];
    uint8_t probe[3];
    for (int a = 0; a < 3; a++) { hsv(hues[a], 1.0f, 1.0f, probe); nat[a] = luma(probe); }
    float lo = nat[0], hi = nat[0];
    for (int a = 1; a < 3; a++) { if (nat[a] < lo) lo = nat[a]; if (nat[a] > hi) hi = nat[a]; }
    const float span = (hi - lo) < 1.0f ? 1.0f : (hi - lo);
    for (int a = 0; a < 3; a++) out[a] = LUMA_LO + (LUMA_HI - LUMA_LO) * ((nat[a] - lo) / span);
  }

  constexpr float DE_STIJL_BAND = 0.055f;
  static const uint8_t DE_STIJL[5][3] = {
    {0xFF, 0xFA, 0xEA},
    {0x12, 0x11, 0x10},
    {0xD1, 0x14, 0x14},
    {0x0F, 0x47, 0x8C},
    {0xF2, 0xC2, 0x0A},
  };

  struct Pal { uint8_t ground[3], frame[3], acc[3][3]; };
  static Pal   pal;
  static float palU = -1.0f;

  static void buildPalette(float u) {
    const float base = (u - 0.5f) - floorf(u - 0.5f);
    float hues[3], L[3];
    for (int a = 0; a < 3; a++) hues[a] = base + MOND_OFF[a];
    lumaTargets(hues, L);
    for (int a = 0; a < 3; a++) {
      const float t = (L[a] - LUMA_LO) / (LUMA_HI - LUMA_LO);
      accent(hues[a], MOND_SAT[a] * (1.0f - SAT_FALLOFF * t), L[a], pal.acc[a]);
    }
    hsv(base, 0.07f, GROUND_V, pal.ground);
    hsv(base + 0.5f, 0.50f, 0.075f, pal.frame);

    const float w = 1.0f - sstep(fabsf(u - 0.5f) / DE_STIJL_BAND);
    if (w <= 0.0f) return;
    for (int c = 0; c < 3; c++) {
      const float gt = (float)((uint8_t)((float)DE_STIJL[0][c] * GROUND_V));
      pal.ground[c] = (uint8_t)((float)pal.ground[c] + (gt - (float)pal.ground[c]) * w);
      pal.frame[c]  = (uint8_t)((float)pal.frame[c] + ((float)DE_STIJL[1][c] - (float)pal.frame[c]) * w);
      for (int a = 0; a < 3; a++)
        pal.acc[a][c] = (uint8_t)((float)pal.acc[a][c] + ((float)DE_STIJL[2 + a][c] - (float)pal.acc[a][c]) * w);
    }
  }

  static inline float holdSeconds(float u) { return 1.2f + 43.8f * u * u; }

  // ── the tree ──────────────────────────────────────────────────────────────

  static void layoutWalk(int i, bool useHome, float x0, float y0, float x1, float y1) {
    Node& n = N[i];
    n.x0 = x0; n.y0 = y0; n.x1 = x1; n.y1 = y1;
    if (n.leaf) return;
    const float t = useHome ? n.home : n.cur;
    if (n.axis == 0) {
      const float xm = x0 + t * (x1 - x0);
      layoutWalk(2 * i + 1, useHome, x0, y0, xm, y1);
      layoutWalk(2 * i + 2, useHome, xm, y0, x1, y1);
    } else {
      const float ym = y0 + t * (y1 - y0);
      layoutWalk(2 * i + 1, useHome, x0, y0, x1, ym);
      layoutWalk(2 * i + 2, useHome, x0, ym, x1, y1);
    }
  }
  static inline void layoutTree(bool useHome) {
    layoutWalk(0, useHome, 0.0f, 0.0f, (float)FRAME_W, (float)FRAME_H);
  }

  static bool ridesRemix(int i) {
    if (rcNode < 0) return false;
    if (i == rcNode) return true;
    const int collapsing = (rcEdge == 1) ? 2 * rcNode + 2 : 2 * rcNode + 1;
    for (int k = i; ; k = (k - 1) >> 1) {
      if (k == collapsing) return true;
      if (k <= 0) return false;
    }
  }

  static void collectLeaves(int i, uint8_t* out, int& n) {
    if (!N[i].used) return;
    if (N[i].leaf) { if (n < NODES) out[n++] = (uint8_t)i; return; }
    collectLeaves(2 * i + 1, out, n);
    collectLeaves(2 * i + 2, out, n);
  }
  static int leafCount(int root) { uint8_t tmp[NODES]; int n = 0; collectLeaves(root, tmp, n); return n; }

  static void clearSubtree(int i) {
    if (i >= NODES || !N[i].used) return;
    N[i].used = 0; N[i].leaf = 1; N[i].fill = 0;
    if (2 * i + 2 < NODES) { clearSubtree(2 * i + 1); clearSubtree(2 * i + 2); }
  }

  static float needAlong(int i, int axis) {
    const Node& n = N[i];
    if (!n.used) return 0.0f;
    if (n.leaf) return CELL_MIN_PX;
    const float a = needAlong(2 * i + 1, axis), b = needAlong(2 * i + 2, axis);
    return n.axis == axis ? a + b : maxf(a, b);
  }

  static void splitRange(int i, float& lo, float& hi) {
    const Node& n = N[i];
    const float span = n.axis == 0 ? (n.x1 - n.x0) : (n.y1 - n.y0);
    if (span <= 0.0f) { lo = hi = 0.5f; return; }
    lo = maxf(0.18f, needAlong(2 * i + 1, n.axis) / span);
    hi = minf(0.82f, 1.0f - needAlong(2 * i + 2, n.axis) / span);
    if (lo > hi) { const float mid = clampf(0.5f * (lo + hi), 0.05f, 0.95f); lo = hi = mid; }
  }

  static void splitLeaf(int i) {
    Node& n = N[i];
    const float w = n.x1 - n.x0, h = n.y1 - n.y0;
    int axis = (rnd() < w / (w + h)) ? 0 : 1;
    if ((axis == 0 ? w : h) < 2.0f * MIN_CELL) axis ^= 1;
    n.leaf = 0; n.axis = (uint8_t)axis;
    float t = 0.30f + 0.40f * rnd();
    if (rnd() < 0.22f) t = (rnd() < 0.5f) ? 0.16f + 0.08f * rnd() : 0.76f + 0.08f * rnd();
    const float span = axis == 0 ? w : h;
    if (span > 2.0f * CELL_MIN_PX) {
      const float lo = CELL_MIN_PX / span;
      t = clampf(t, lo, 1.0f - lo);
    }
    n.home = t; n.cur = t;
    for (int k = 0; k < 2; k++) {
      Node& C = N[2 * i + 1 + k];
      C.used = 1; C.leaf = 1; C.fill = 0;
    }
  }

  constexpr float COLOR_RATIO = 0.48f;
  constexpr int   MAX_COLORED = 6;

  static void enforceFills(int prefer) {
    uint8_t all[NODES], pref[NODES];
    int na = 0, np = 0;
    collectLeaves(0, all, na);
    if (prefer >= 0) collectLeaves(prefer, pref, np);
    int want = (int)((float)na * COLOR_RATIO + 0.5f);
    if (want < 3) want = 3; else if (want > MAX_COLORED) want = MAX_COLORED;

    int16_t seen[3][NODES];
    int ns[3] = {0, 0, 0};
    if (tvActive) seen[tvColor - 1][ns[tvColor - 1]++] = -1;
    for (int k = 0; k < na; k++) {
      const int f = N[all[k]].fill;
      if (f >= 1 && f <= 3) seen[f - 1][ns[f - 1]++] = (int16_t)all[k];
    }
    int total = ns[0] + ns[1] + ns[2];

    auto inPrefList = [&](int cell) {
      for (int k = 0; k < np; k++) if (pref[k] == cell) return true;
      return false;
    };
    auto freeCell = [&]() -> int {
      uint8_t pool[NODES];
      int n = 0;
      for (int k = 0; k < np; k++) if (!N[pref[k]].fill) pool[n++] = pref[k];
      if (!n) for (int k = 0; k < na; k++) if (!N[all[k]].fill) pool[n++] = all[k];
      if (!n) return -1;
      return pool[(int)(rnd() * (float)n)];
    };

    for (int a = 0; a < 3; a++) {
      if (ns[a]) continue;
      const int c = freeCell();
      if (c < 0) continue;
      N[c].fill = (uint8_t)(a + 1); seen[a][ns[a]++] = (int16_t)c; total++;
    }
    while (total < want) {
      const int c = freeCell();
      if (c < 0) break;
      const int a = (int)(rnd() * 3.0f);
      N[c].fill = (uint8_t)(a + 1); seen[a][ns[a]++] = (int16_t)c; total++;
    }
    while (total > want) {
      int a = -1, most = 1;
      for (int k = 0; k < 3; k++) if (ns[k] > most) { most = ns[k]; a = k; }
      if (a < 0) break;
      int cells[NODES], nc = 0;
      for (int k = 0; k < ns[a]; k++) if (seen[a][k] >= 0) cells[nc++] = seen[a][k];
      if (nc < 2) break;
      int victim = -1;
      for (int k = 0; k < nc; k++) if (inPrefList(cells[k])) { victim = cells[k]; break; }
      if (victim < 0) victim = cells[0];
      N[victim].fill = 0;
      for (int k = 0; k < ns[a]; k++)
        if (seen[a][k] == victim) { for (int j = k; j < ns[a] - 1; j++) seen[a][j] = seen[a][j + 1]; ns[a]--; break; }
      total--;
    }
  }

  static void snapNode(int i) {
    Node& n = N[i];
    if (!n.used || n.leaf) return;
    const bool  vert = n.axis == 0;
    const float base = vert ? n.x0 : n.y0;
    const float span = (vert ? n.x1 : n.y1) - base;
    if (span < 1.0f) return;
    const float edge = roundf2(base + n.home * span - RULE_W * 0.5f);
    n.home = clampf((edge + RULE_W * 0.5f - base) / span, 0.04f, 0.96f);
  }
  static void snapTree() {
    for (int i = 0; i < NODES; i++) {
      if (!N[i].used || N[i].leaf) continue;
      layoutTree(true);
      snapNode(i);
    }
    layoutTree(true);
  }

  static void buildSubtree(int root, int budget) {
    if (budget < 1) budget = 1;
    clearSubtree(root);
    N[root].used = 1; N[root].leaf = 1; N[root].fill = 0;
    for (int s = 1; s < budget; s++) {
      layoutTree(true);
      uint8_t leaves[NODES];
      int L = 0;
      collectLeaves(root, leaves, L);
      int best = -1;
      float bestScore = -1.0f;
      for (int k = 0; k < L; k++) {
        const int i = leaves[k];
        if (depthOf(i) >= MAX_DEPTH || 2 * i + 2 >= NODES) continue;
        const Node& n = N[i];
        const float w = n.x1 - n.x0, h = n.y1 - n.y0;
        if (minf(w, h) < MIN_CELL || maxf(w, h) < 2.0f * MIN_CELL) continue;
        const float sc = w * h * (0.65f + 0.7f * rnd());
        if (sc > bestScore) { bestScore = sc; best = i; }
      }
      if (best < 0) break;
      splitLeaf(best);
    }
    layoutTree(true);
  }

  // ── remix + slide ─────────────────────────────────────────────────────────

  static void startTravel(bool avoidRiding);

  static void startRecompose(int node) {
    rcNode = node;
    const int cA = leafCount(2 * node + 1), cB = leafCount(2 * node + 2);
    const int total = (node == 0) ? targetLeaves : (cA + cB);
    const int nearest = N[node].cur < 0.5f ? 0 : 1;
    const bool canCollapseB = (total - cA) >= 1;
    const bool canCollapseA = (total - cB) >= 1;
    rcEdge = (canCollapseA && canCollapseB) ? nearest
           : canCollapseB ? 1
           : canCollapseA ? 0
           : nearest;
    const int keepN = (rcEdge == 1) ? cA : cB;
    rcBudget = (total - keepN) < 1 ? 1 : (total - keepN);
    rcFrom = N[node].cur;
    rcTo   = (float)rcEdge;
    rcVal  = rcFrom;
    rcU    = 0.0f;
    rcPhase = 1;

    for (int i = 0; i < NODES; i++) sFromHome[i] = N[i].home;
    layoutTree(true);
    for (int i = 0; i < NODES; i++) {
      sFx0[i] = N[i].x0; sFy0[i] = N[i].y0; sFx1[i] = N[i].x1; sFy1[i] = N[i].y1;
    }

    float bestScore = -1.0f;
    for (int attempt = 0; attempt < REMIX_TRIES; attempt++) {
      for (int i = 0; i < NODES; i++) N[i].home = sFromHome[i];
      for (int i = 0; i < NODES; i++) {
        Node& n = N[i];
        if (!n.used || n.leaf) continue;
        n.hFrom = sFromHome[i];
        if (ridesRemix(i)) { n.hTo = sFromHome[i]; continue; }
        layoutTree(true);
        float to = 0.26f + 0.48f * rnd();
        if (fabsf(to - n.hFrom) < REFLOW_MIN)
          to = n.hFrom + (to >= n.hFrom ? REFLOW_MIN : -REFLOW_MIN);
        float lo, hi;
        splitRange(i, lo, hi);
        n.hTo = clampf(to, lo, hi);
        n.home = n.hTo;
      }
      layoutTree(true);
      float sc = 0.0f;
      for (int i = 0; i < NODES; i++) {
        const Node& n = N[i];
        if (!n.used || !n.leaf || ridesRemix(i)) continue;
        const float aNow = (sFx1[i] - sFx0[i]) * (sFy1[i] - sFy0[i]);
        const float aNew = (n.x1 - n.x0) * (n.y1 - n.y0);
        const float iw = maxf(0.0f, minf(sFx1[i], n.x1) - maxf(sFx0[i], n.x0));
        const float ih = maxf(0.0f, minf(sFy1[i], n.y1) - maxf(sFy0[i], n.y0));
        sc += (aNow + aNew - 2.0f * iw * ih) * (n.fill ? 1.0f : GROUND_WEIGHT);
      }
      sc *= 0.5f;
      if (sc > bestScore) {
        bestScore = sc;
        for (int i = 0; i < NODES; i++) sKeep[i] = N[i].hTo;
      }
      if (sc >= REMIX_MIN_AREA) break;
    }
    for (int i = 0; i < NODES; i++) {
      Node& n = N[i];
      if (n.used && !n.leaf) { n.hTo = sKeep[i]; n.home = ridesRemix(i) ? sFromHome[i] : sKeep[i]; }
    }
    snapTree();
    for (int i = 0; i < NODES; i++) {
      Node& n = N[i];
      if (n.used && !n.leaf) n.hTo = n.home;
    }
    gU = 0.0f;

    if (!tvActive) {
      startTravel(true);
      if (tvActive) tvDur = 2.0f * legNow;
    }
  }

  static int pickRecomposeNode() {
    float w[NODES] = {}, total = 0.0f;
    if (N[0].used && !N[0].leaf) {
      const float c = (float)leafCount(0);
      w[0] = c * c * 0.30f * (1.0f + 1.6f * 3.0f);
      total += w[0];
    }
    for (int i = 1; i <= 2; i++) {
      const Node& n = N[i];
      if (!n.used || n.leaf) continue;
      const float cw = n.x1 - n.x0, chh = n.y1 - n.y0;
      if (minf(cw, chh) < MIN_CELL || maxf(cw, chh) < 2.0f * MIN_CELL) continue;
      const float c = (float)leafCount(i);
      uint8_t sub[NODES];
      int nsub = 0;
      collectLeaves(i, sub, nsub);
      int lit = 0;
      for (int k = 0; k < nsub; k++) if (N[sub[k]].fill) lit++;
      w[i] = c * c * (1.0f + 1.6f * (float)lit);
      total += w[i];
    }
    if (total <= 0.0f) return 0;
    float r = rnd() * total;
    for (int i = 0; i < NODES; i++) { r -= w[i]; if (r <= 0.0f && w[i] > 0.0f) return i; }
    return 0;
  }

  static void startTravel(bool avoidRiding) {
    uint8_t all[NODES], lit[NODES], empty[NODES];
    int na = 0, nl = 0, ne = 0;
    collectLeaves(0, all, na);
    for (int k = 0; k < na; k++) {
      const int i = all[k];
      if (avoidRiding && ridesRemix(i)) continue;
      if (N[i].fill) lit[nl++] = (uint8_t)i; else empty[ne++] = (uint8_t)i;
    }
    if (!nl || !ne) { tvTimer = 3.0f; return; }
    tvSrc = lit[(int)(rnd() * (float)nl)];
    tvDst = empty[(int)(rnd() * (float)ne)];
    tvColor = N[tvSrc].fill;
    N[tvSrc].fill = 0;
    const Node& a = N[tvSrc];
    const Node& b = N[tvDst];
    tvXFirst = (fabsf(b.x0 - a.x0) >= fabsf(b.y0 - a.y0)) ? 1 : 0;
    tvT = 0.0f;
    tvDur = clampf((2.0f + 0.9f * rnd()) / spdNow, SLIDE_MIN_S, SLIDE_MAX_S);
    tvActive = 1;
  }

  // ── raster ────────────────────────────────────────────────────────────────
  static void rectAA(float x0, float y0, float x1, float y1, const uint8_t* c) {
    if (x1 <= x0 || y1 <= y0) return;
    int ix0 = (int)floorf(x0), ix1 = (int)ceilf(x1);
    int iy0 = (int)floorf(y0), iy1 = (int)ceilf(y1);
    if (ix0 < 0) ix0 = 0; if (ix1 > FRAME_W) ix1 = FRAME_W;
    if (iy0 < 0) iy0 = 0; if (iy1 > FRAME_H) iy1 = FRAME_H;
    for (int y = iy0; y < iy1; y++) {
      const float yl = (float)y, yh = yl + 1.0f;
      const float cy = minf(yh, y1) - maxf(yl, y0);
      if (cy <= 0.0f) continue;
      uint8_t* row = buf + (size_t)y * FRAME_W * 3;
      for (int x = ix0; x < ix1; x++) {
        const float xl = (float)x, xh = xl + 1.0f;
        const float cx = minf(xh, x1) - maxf(xl, x0);
        if (cx <= 0.0f) continue;
        float a = cx * cy;
        if (a < 1.0f) a = clampf((a - 0.5f) * AA_SHARP + 0.5f, 0.0f, 1.0f);
        if (a <= 0.0f) continue;
        uint8_t* p = row + x * 3;
        p[0] = (uint8_t)((float)p[0] + ((float)c[0] - (float)p[0]) * a + 0.5f);
        p[1] = (uint8_t)((float)p[1] + ((float)c[1] - (float)p[1]) * a + 0.5f);
        p[2] = (uint8_t)((float)p[2] + ((float)c[2] - (float)p[2]) * a + 0.5f);
      }
    }
  }

  // ── pattern entry points ──────────────────────────────────────────────────

  void setup() {
    PFMath::buildSinLUT();
    if (!buf) buf = (uint8_t*)PFMem::alloc((size_t)FRAME_W * FRAME_H * 3);
    rngState = 0x2545F491u;
    for (int i = 0; i < NODES; i++) {
      N[i].used = 0; N[i].leaf = 1; N[i].axis = 0; N[i].fill = 0;
      N[i].home = 0.5f; N[i].cur = 0.5f; N[i].hFrom = 0.5f; N[i].hTo = 0.5f;
      N[i].x0 = N[i].y0 = N[i].x1 = N[i].y1 = 0.0f;
    }
    T = 0.0f;
    kColor = 0.5f; palU = 0.5f;
    buildPalette(0.5f);
    spdNow = 1.0f;
    holdS = holdSeconds(0.35f);
    holdReal = holdS;
    legNow = RC_LEG;
    targetLeaves = 8;
    rcNode = -1; rcPhase = 0; rcVal = 0.5f; rcEdge = 0; rcBudget = 8;
    rcFrom = 0.5f; rcTo = 0.5f; rcU = 0.0f; gU = 1.0f;
    rcTimer = holdS;
    tvActive = 0; tvTimer = 3.5f; tvSrc = 0; tvDst = 0; tvColor = 1;
    tvT = 0.0f; tvDur = 1.8f; tvXFirst = 1;
    densAt = -1.0f;
    buildSubtree(0, targetLeaves);
    enforceFills(0);
    snapTree();
  }

  void update(float dt, const InputFrame& input) {
    PFParams::applyUnit(input, 0, &kColor);
    PFParams::apply(input, 1, &kHold, 0.0f, 1.0f, 1.0f / 48.0f);
    PFParams::apply(input, 2, &kDens, 0.0f, 1.0f, 1.0f / 48.0f);
    PFParams::apply(input, 3, &kSpeed, 0.05f, 3.0f, (3.0f - 0.05f) / 48.0f);

    const float colorU = clampf(kColor, 0.0f, 1.0f);
    const float dT = dt;
    T += dt;
    spdNow = clampf(kSpeed, 0.05f, 3.0f);
    holdS = holdSeconds(clampf(kHold, 0.0f, 1.0f));
    holdReal = clampf(holdS / sqrtf(spdNow), GAP_MIN_S, GAP_MAX_S);

    if (colorU != palU) { palU = colorU; buildPalette(colorU); }

    const int target = 5 + (int)(kDens * 11.0f + 0.5f);
    if (target != targetLeaves) { targetLeaves = target; densAt = T + 0.35f; }
    if (densAt > 0.0f && T >= densAt && rcPhase == 0 && !tvActive) {
      densAt = -1.0f; startRecompose(0);
    }

    const float legCap = holdReal * 0.45f;
    const float legRaw = RC_LEG / spdNow;
    const float leg = clampf(legRaw < legCap ? legRaw : legCap, MOVE_MIN_S, MOVE_MAX_S);
    legNow = leg;

    if (rcPhase == 1 || rcPhase == 2) {
      rcU += dT / leg;
      gU += dT / (2.0f * leg);
      if (gU > 1.0f) gU = 1.0f;
      rcVal = rcFrom + (rcTo - rcFrom) * (rcPhase == 1
        ? easeAB(rcU, EASE_HOLD, EASE_TURN)
        : easeAB(rcU, EASE_TURN, EASE_HOLD));
      if (rcU >= 1.0f) {
        if (rcPhase == 1) {
          const int node = rcNode;
          const int collapsed = (rcEdge == 1) ? 2 * node + 2 : 2 * node + 1;
          N[node].home = 0.30f + 0.40f * rnd();
          buildSubtree(collapsed, rcBudget);
          layoutTree(true);
          {
            float lo, hi;
            splitRange(node, lo, hi);
            N[node].home = clampf(N[node].home, lo, hi);
          }
          enforceFills(collapsed);
          snapTree();
          for (int i = 0; i < NODES; i++) {
            Node& n = N[i];
            if (n.used && !n.leaf && ridesRemix(i)) { n.hFrom = n.home; n.hTo = n.home; }
          }
          rcFrom = (float)rcEdge;
          rcTo   = N[node].home;
          rcVal  = rcFrom;
          rcU    = 0.0f;
          rcPhase = 2;
        } else {
          rcPhase = 0; rcNode = -1;
          rcTimer = holdReal * (0.75f + 0.5f * rnd());
          if (leafCount(0) != targetLeaves) densAt = T + holdReal * 0.5f;
        }
      }
    } else {
      rcTimer -= dT;
      if (rcTimer <= 0.0f && !tvActive) startRecompose(pickRecomposeNode());
    }

    const float gEase = easeAB(gU, EASE_HOLD, EASE_HOLD);
    for (int i = 0; i < NODES; i++) {
      Node& n = N[i];
      if (!n.used || n.leaf) continue;
      if (rcPhase == 0) n.cur = n.home;
      else if (i == rcNode) n.cur = rcVal;
      else if (ridesRemix(i)) n.cur = n.home;
      else n.cur = n.hFrom + (n.hTo - n.hFrom) * gEase;
    }
    layoutTree(false);

    if (tvActive) {
      tvT += dT / tvDur;
      if (tvT >= 1.0f) {
        if (N[tvDst].used && N[tvDst].leaf) N[tvDst].fill = (uint8_t)tvColor;
        tvActive = 0;
        tvTimer = clampf(holdReal * 0.30f, SLIDE_MIN_S, GAP_MAX_S * 0.4f) * (0.6f + 0.8f * rnd());
      }
    } else if (rcPhase == 0) {
      tvTimer -= dT;
      if (tvTimer <= 0.0f) startTravel(false);
    }
  }

  void draw() {
    PFCanvas::setFrame(FRAME_W, FRAME_H);
    if (!buf) { PFCanvas::present(); return; }

    for (size_t i = 0; i < (size_t)FRAME_W * FRAME_H * 3; i += 3) {
      buf[i] = pal.ground[0]; buf[i + 1] = pal.ground[1]; buf[i + 2] = pal.ground[2];
    }

    if (tvActive) {
      const Node& a = N[tvSrc];
      const Node& b = N[tvDst];
      const float l1 = easeAB(tvT / TV_L1_END, EASE_HOLD, EASE_TURN);
      const float l2 = easeAB((tvT - TV_L2_START) / (1.0f - TV_L2_START), EASE_TURN, EASE_HOLD);
      const float ux = tvXFirst ? l1 : l2, uy = tvXFirst ? l2 : l1;
      const float ins = TV_INSET * PFMath::fastSin(PI * clampf(tvT, 0.0f, 1.0f));
      rectAA(a.x0 + (b.x0 - a.x0) * ux + ins, a.y0 + (b.y0 - a.y0) * uy + ins,
             a.x1 + (b.x1 - a.x1) * ux - ins, a.y1 + (b.y1 - a.y1) * uy - ins,
             pal.acc[tvColor - 1]);
    }

    {
      uint8_t all[NODES];
      int na = 0;
      collectLeaves(0, all, na);
      for (int k = 0; k < na; k++) {
        const Node& n = N[all[k]];
        if (n.fill) rectAA(n.x0, n.y0, n.x1, n.y1, pal.acc[n.fill - 1]);
      }
    }

    const bool moving = (rcPhase != 0);
    for (int i = NODES - 1; i >= 0; i--) {
      const Node& n = N[i];
      if (!n.used || n.leaf) continue;
      if (n.axis == 0) {
        float x0 = n.x0 + n.cur * (n.x1 - n.x0) - RULE_W * 0.5f, y0 = n.y0, y1 = n.y1;
        if (!moving) { x0 = roundf2(x0); y0 = roundf2(y0); y1 = roundf2(y1); }
        rectAA(x0, y0, x0 + RULE_W, y1, pal.frame);
      } else {
        float y0 = n.y0 + n.cur * (n.y1 - n.y0) - RULE_W * 0.5f, x0 = n.x0, x1 = n.x1;
        if (!moving) { y0 = roundf2(y0); x0 = roundf2(x0); x1 = roundf2(x1); }
        rectAA(x0, y0, x1, y0 + RULE_W, pal.frame);
      }
    }

    const uint8_t* p = buf;
    for (int y = 0; y < FRAME_H; y++)
      for (int x = 0; x < FRAME_W; x++, p += 3)
        PFCanvas::setPixel(x, y, p[0], p[1], p[2]);
    PFCanvas::present();
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.