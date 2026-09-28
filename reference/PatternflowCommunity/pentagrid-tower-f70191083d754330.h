#pragma once
#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_params.h"
#include "src/core_math.h"
#include "src/core_mem.h"
#include <math.h>
#include <string.h>

namespace PentagridTower {

const char* NAME = "Pentagrid Tower";
const char* const KNOB_LABELS[4] = {"Folds", "Climb", "Shift", "Scale"};
constexpr bool ABSOLUTE_READY = true;

constexpr int FRAME_W = 64;
constexpr int FRAME_H = 128;

constexpr int PT_MAXR = 2048;
constexpr int PT_HASH = 4096;
constexpr int PT_MAXN = 16;
constexpr double PT_CLOCK = 3600.0;
constexpr double PT_PI_D = 3.14159265358979323846;

static const float PT_PAL[4][3] = {
  {255.0f, 176.0f, 34.0f},   // burnished gold  (thinnest rhombs)
  {238.0f, 84.0f, 40.0f},    // terracotta
  {255.0f, 238.0f, 206.0f},  // bone
  {34.0f, 76.0f, 240.0f},    // lapis            (fattest rhombs)
};

// knob state
static float folds = 5.0f;
static float climb = 2.0f;
static float shift = 0.0f;
static float scale = 6.0f;

// time state (double: these feed absolute positions that grow large)
static double clockT = 0.0;
static double top = 0.0;
static double drift = 0.0;
static double wave = 0.0;
static double phBase = 0.0;
static float jolt = -1.0f;
static float joltAmp = 0.0f;
static uint32_t frameNo = 0;

// family geometry
static int famN = 0;
static int cmax = 2;
static float slopeMax = 1.0f;
static double exD[PT_MAXN], eyD[PT_MAXN], GD[PT_MAXN], DD[PT_MAXN], WD[PT_MAXN];
static float exF[PT_MAXN], eyF[PT_MAXN], DF[PT_MAXN];
// per pair (j < k)
static float pairDet[PT_MAXN][PT_MAXN];
static float pairCjk[PT_MAXN][PT_MAXN];
static float pairPjk[PT_MAXN][PT_MAXN];
static float pairCol[PT_MAXN][PT_MAXN][3];

// per frame, local frame (origin shifted to the view centre so floats stay small)
static int famNi[PT_MAXN];      // integer part of each family's offset
static float famA[PT_MAXN];     // fractional part
static float rowF[FRAME_H];

// big buffers
static int16_t* ids = nullptr;
static float* cr = nullptr;
static float* cg = nullptr;
static float* cb = nullptr;
static int32_t* hKey = nullptr;
static int32_t* hMj = nullptr;
static int32_t* hMk = nullptr;
static uint32_t* hSig = nullptr;
static float* hFlip = nullptr;
static uint32_t* hStamp = nullptr;

static int ptK[PT_MAXN];
static float ptQx[4], ptQy[4];

static inline int ptCeil(float x) { return -PFMath::ifloor(-x); }

static inline long long ptFloorD(double x) {
  long long i = (long long)x;
  return ((double)i > x) ? i - 1 : i;
}

static inline double ptWrapD(double x, double m) {
  return x - m * (double)ptFloorD(x / m);
}

static void ptOrtho(double* v, const double* b, int N) {
  double d = 0, n = 0;
  for (int i = 0; i < N; i++) { d += v[i] * b[i]; n += b[i] * b[i]; }
  if (n < 1e-9) return;
  const double f = d / n;
  for (int i = 0; i < N; i++) v[i] -= f * b[i];
}

static void ptNormMax(double* v, int N) {
  double m = 0;
  for (int i = 0; i < N; i++) { double a = v[i] < 0 ? -v[i] : v[i]; if (a > m) m = a; }
  if (m > 0) for (int i = 0; i < N; i++) v[i] /= m;
}

static void ptFamilies(int N) {
  famN = N;
  const int mult = (N % 2) ? 2 : 1;
  const double step = mult * PT_PI_D / N;
  for (int i = 0; i < N; i++) {
    float c = cosf((float)(step * i)), s = sinf((float)(step * i));
    if (c > -1e-6f && c < 1e-6f) c = 0.0f;
    if (s > -1e-6f && s < 1e-6f) s = 0.0f;
    exD[i] = c; eyD[i] = s;
  }
  double one[PT_MAXN];
  for (int i = 0; i < N; i++) one[i] = 1.0;
  ptOrtho(one, exD, N); ptOrtho(one, eyD, N);
  double s = 0;
  for (int i = 0; i < N; i++) {
    double g = i * 0.6180339887 + 0.137;
    g -= (double)(long long)g;
    GD[i] = g * 0.9; s += GD[i];
  }
  for (int i = 0; i < N; i++) GD[i] -= s / N;
  for (int i = 0; i < N; i++) DD[i] = cosf(2.3f * i + 0.7f) + 0.6 * sinf(1.7f * i + 0.2f);
  ptOrtho(DD, exD, N); ptOrtho(DD, eyD, N); ptOrtho(DD, one, N); ptNormMax(DD, N);
  for (int i = 0; i < N; i++) WD[i] = sinf(1.3f * i + 1.1f) + 0.5 * cosf(2.9f * i);
  ptOrtho(WD, exD, N); ptOrtho(WD, eyD, N); ptNormMax(WD, N);
  for (int i = 0; i < N; i++) { exF[i] = (float)exD[i]; eyF[i] = (float)eyD[i]; DF[i] = (float)DD[i]; }

  cmax = N / 2;
  double smax = 1e9;
  for (int j = 0; j < N; j++) for (int k = j + 1; k < N; k++) {
    double det = exD[j] * eyD[k] - eyD[j] * exD[k];
    pairDet[j][k] = (float)det;
    pairCjk[j][k] = (float)(exD[j] * exD[k] + eyD[j] * eyD[k]);
    pairPjk[j][k] = (float)(-eyD[j] * exD[k] + exD[j] * eyD[k]);
    const double adet = det < 0 ? -det : det;
    double c = exD[j] * DD[k] - exD[k] * DD[j];
    if (c < 0) c = -c;
    if (c > 1e-9 && adet / c < smax) smax = adet / c;
    // rhomb class: acute angle in units of pi/N (exact in integers)
    int u = ((k - j) * mult) % N;
    if (N - u < u) u = N - u;
    int cl = u < 1 ? 1 : (u > cmax ? cmax : u);
    int pi = 3;
    if (cmax > 1) pi = (int)ptFloorD((double)(cl - 1) / (double)(cmax - 1) * 3.0 + 0.5);
    if ((j + k) % N == 0) pi = pi == 0 ? 1 : pi == 3 ? 2 : pi == 1 ? 0 : 3;
    // orientation tilt: light from the upper left
    const float al = PFMath::fastAtan2((float)(eyD[j] + eyD[k]), (float)(exD[j] + exD[k]));
    const float tilt = 0.9f + 0.1f * cosf(2.0f * al + 1.9f);
    pairCol[j][k][0] = PT_PAL[pi][0] * tilt;
    pairCol[j][k][1] = PT_PAL[pi][1] * tilt;
    pairCol[j][k][2] = PT_PAL[pi][2] * tilt;
  }
  slopeMax = (float)(smax < 1.0 ? smax : 1.0);
  if (hStamp) for (int i = 0; i < PT_HASH; i++) hStamp[i] = frameNo - 1000u;
}

static int ptLookup(int32_t key1, int32_t mj, int32_t mk) {
  const uint32_t mask = PT_HASH - 1;
  const uint32_t h = (((uint32_t)key1 * 73856093u) ^ ((uint32_t)mj * 19349663u) ^
                      ((uint32_t)mk * 83492791u)) & mask;
  int freeS = -1;
  for (uint32_t p = 0; p < 12; p++) {
    const int s = (int)((h + p) & mask);
    if ((uint32_t)(frameNo - hStamp[s]) <= 3u) {
      if (hKey[s] == key1 && hMj[s] == mj && hMk[s] == mk) return s;
    } else if (freeS < 0) freeS = s;
  }
  if (freeS < 0) freeS = (int)h;
  hKey[freeS] = key1; hMj[freeS] = mj; hMk[freeS] = mk;
  hSig[freeS] = 0x7fffffffu; hFlip[freeS] = -99.0f;
  hStamp[freeS] = frameNo;
  return freeS;
}

// phason field (local y): travelling wave + jolt front (value and slope)
static float ptPsi = 0.0f, ptDpsi = 0.0f;
static inline void ptPhase(float qy, float amp, float kap, float wph, bool jOn,
                           float jFront, float jW, float jAmp) {
  const float sa = kap * qy + wph;
  float psi = amp * PFMath::fastSin(sa);
  float dpsi = amp * kap * PFMath::fastCos(sa);
  if (jOn) {
    const float s = (jFront - qy) / jW + 0.5f;
    if (s >= 1.0f) psi += jAmp;
    else if (s > 0.0f) {
      psi += jAmp * s * s * (3.0f - 2.0f * s);
      dpsi -= jAmp * 6.0f * s * (1.0f - s) / jW;
    }
  }
  ptPsi = psi; ptDpsi = dpsi;
}

static void ptFill(int16_t id) {
  float y0 = ptQy[0], y1 = ptQy[0];
  for (int i = 1; i < 4; i++) {
    if (ptQy[i] < y0) y0 = ptQy[i];
    if (ptQy[i] > y1) y1 = ptQy[i];
  }
  int ys = ptCeil(y0 - 0.5f), ye = ptCeil(y1 - 0.5f) - 1;
  if (ys < 0) ys = 0;
  if (ye > FRAME_H - 1) ye = FRAME_H - 1;
  for (int y = ys; y <= ye; y++) {
    const float yc = y + 0.5f;
    float xl = 1e30f, xr = -1e30f;
    for (int e = 0; e < 4; e++) {
      const float ax = ptQx[e], ay = ptQy[e];
      const float bx = ptQx[(e + 1) & 3], by = ptQy[(e + 1) & 3];
      if ((ay <= yc && yc < by) || (by <= yc && yc < ay)) {
        const float x = ax + (yc - ay) * (bx - ax) / (by - ay);
        if (x < xl) xl = x;
        if (x > xr) xr = x;
      }
    }
    if (xl > xr) continue;
    int xs = ptCeil(xl - 0.5f), xe = ptCeil(xr - 0.5f) - 1;
    if (xs < 0) xs = 0;
    if (xe > FRAME_W - 1) xe = FRAME_W - 1;
    int16_t* row = ids + y * FRAME_W;
    for (int x = xs; x <= xe; x++) row[x] = id;
  }
}

void setup() {
  PFMath::buildSinLUT();
  if (!ids) ids = (int16_t*)PFMem::alloc((size_t)FRAME_W * FRAME_H * sizeof(int16_t));
  if (!cr) cr = PFMem::allocFloats(PT_MAXR);
  if (!cg) cg = PFMem::allocFloats(PT_MAXR);
  if (!cb) cb = PFMem::allocFloats(PT_MAXR);
  if (!hKey) hKey = (int32_t*)PFMem::alloc(PT_HASH * sizeof(int32_t));
  if (!hMj) hMj = (int32_t*)PFMem::alloc(PT_HASH * sizeof(int32_t));
  if (!hMk) hMk = (int32_t*)PFMem::alloc(PT_HASH * sizeof(int32_t));
  if (!hSig) hSig = (uint32_t*)PFMem::alloc(PT_HASH * sizeof(uint32_t));
  if (!hFlip) hFlip = PFMem::allocFloats(PT_HASH);
  if (!hStamp) hStamp = (uint32_t*)PFMem::alloc(PT_HASH * sizeof(uint32_t));
  for (int y = 0; y < FRAME_H; y++) rowF[y] = 1.0f - 0.2f * ((float)y / (float)(FRAME_H - 1));
  clockT = 0; top = 0; drift = 0; wave = 0; phBase = 0;
  jolt = -1.0f; joltAmp = 0.0f; frameNo = 0; famN = 0;
  folds = 5.0f; climb = 2.0f; shift = 0.0f; scale = 6.0f;
  if (hStamp) for (int i = 0; i < PT_HASH; i++) hStamp[i] = frameNo - 1000u;
}

static inline bool ptReady() {
  return ids && cr && cg && cb && hKey && hMj && hMk && hSig && hFlip && hStamp;
}

void update(float dt, const InputFrame& input) {
  if (!ptReady()) return;
  PFParams::apply(input, 0, &folds, 5.0f, 12.0f, 0.146f);
  PFParams::apply(input, 1, &climb, 0.0f, 4.0f, 0.083f);
  PFParams::apply(input, 2, &shift, 0.0f, 1.0f, 0.021f);
  PFParams::apply(input, 3, &scale, 6.0f, 16.0f, 0.208f);
  clockT += dt;
  if (clockT >= PT_CLOCK) clockT -= PT_CLOCK;
  // climbing: the view moves up the strip (tile edges per second)
  top -= (double)dt * climb * 1.1;
  if (top < -20000.0) top += 20000.0;
  drift += (double)dt * (0.035 + 0.05 * shift);
  if (drift >= 1000.0) drift -= 1000.0;
  wave += (double)dt * (0.8 + 0.8 * shift);
  if (wave >= PT_PI_D * 2000.0) wave -= PT_PI_D * 2000.0;
  bool any = false;
  for (int i = 0; i < 4; i++)
    if (input.btnPressed[i] && !input.paramAbsoluteActive[i] && !input.knobAudioActive[i]) any = true;
  if (any && jolt < 0.0f) {
    jolt = 0.0f;
    joltAmp = ((float)random(1 << 24) / 16777216.0f) < 0.5f ? 0.4f : -0.4f;
  }
  if (jolt >= 0.0f) {
    jolt += dt / 1.3f;
    if (jolt >= 1.0f) {
      phBase += joltAmp;
      if (phBase >= 100.0 || phBase <= -100.0) phBase -= 100.0 * (double)(long long)(phBase / 100.0);
      jolt = -1.0f;
    }
  }
}

void draw() {
  PFCanvas::setFrame(FRAME_W, FRAME_H);
  if (!ptReady()) { PFCanvas::present(); return; }
  int N = (int)(folds + 0.5f);
  if (N < 3) N = 3;
  if (N > 15) N = 15;
  if (famN != N) ptFamilies(N);
  frameNo++;

  const double S = scale > 2.0f ? scale : 2.0f;
  const float Sf = (float)S;
  const double half = N * 0.5;
  const double sh = shift;
  const float clockF = (float)clockT;

  // view in tile units
  const double tx0 = -FRAME_W / (2.0 * S), tx1 = FRAME_W / (2.0 * S);
  const double ty0 = top, ty1 = top + FRAME_H / S;
  double ox = 0, oy = 0;
  for (int i = 0; i < N; i++) { const double g = GD[i] + sh * WD[i] + 0.5; ox += g * exD[i]; oy += g * eyD[i]; }
  const float kap = 2.0f * PI / 8.0f;
  float amp = 0.1f + 0.2f * (float)sh;
  { const float lim = 0.35f * slopeMax / kap; if (lim < amp) amp = lim; }
  const double M = 1.2 + amp + 1.5 / half;
  const double gx0 = (tx0 - ox) / half - M, gx1 = (tx1 - ox) / half + M;
  const double gy0 = (ty0 - oy) / half - M, gy1 = (ty1 - oy) / half + M;
  const double base = phBase + drift;
  const bool jOn = jolt >= 0.0f;
  const double vy0 = (ty0 - oy) / half, vy1 = (ty1 - oy) / half;
  const double jAmp = joltAmp * 5.0 / N;
  double jW = (jAmp < 0 ? -jAmp : jAmp) * 1.5 / (0.35 * slopeMax);
  if (jW < 1.5) jW = 1.5;
  const double jFront = vy0 - jW + (vy1 - vy0 + 2.0 * jW) * jolt;

  // local origin: grid-space y at the view centre; everything below is relative to it
  const double P0y = 0.5 * (gy0 + gy1);
  const float lgx0 = (float)gx0, lgx1 = (float)gx1;
  const float lgy0 = (float)(gy0 - P0y), lgy1 = (float)(gy1 - P0y);
  const float wphL = (float)ptWrapD(kap * P0y + wave, 2.0 * PT_PI_D);
  const float jFrontL = (float)(jFront - P0y);
  const float jWf = (float)jW, jAmpf = (float)jAmp;
  double sumNx = 0, sumNy = 0;
  for (int i = 0; i < N; i++) {
    const double A = P0y * eyD[i] + GD[i] + sh * WD[i] + DD[i] * base;
    const long long ni = ptFloorD(A);
    famNi[i] = (int)ni;
    famA[i] = (float)(A - (double)ni);
    sumNx += (double)ni * exD[i];
    sumNy += (double)ni * eyD[i];
  }
  const float CX = (float)(sumNx - tx0), CY = (float)(sumNy - ty0);

  memset(ids, 0xFF, (size_t)FRAME_W * FRAME_H * sizeof(int16_t));
  int nr = 0;
  const float ampPad = amp + 1.2f;

  for (int j = 0; j < N - 1 && nr < PT_MAXR; j++) {
    const float exj = exF[j], eyj = eyF[j], Dj = DF[j], aj = famA[j];
    const float pad = fabsf(Dj) * ampPad + 0.05f;
    const float c1 = lgx0 * exj + lgy0 * eyj, c2 = lgx1 * exj + lgy0 * eyj;
    const float c3 = lgx0 * exj + lgy1 * eyj, c4 = lgx1 * exj + lgy1 * eyj;
    float cmn = c1, cmx = c1;
    if (c2 < cmn) cmn = c2;
    if (c2 > cmx) cmx = c2;
    if (c3 < cmn) cmn = c3;
    if (c3 > cmx) cmx = c3;
    if (c4 < cmn) cmn = c4;
    if (c4 > cmx) cmx = c4;
    const int mj0 = ptCeil(cmn + aj - pad);
    const int mj1 = PFMath::ifloor(cmx + aj + pad);
    for (int k = j + 1; k < N && nr < PT_MAXR; k++) {
      const float exk = exF[k], eyk = eyF[k], Dk = DF[k], ak = famA[k];
      const float det = pairDet[j][k];
      if (fabsf(det) < 1e-6f) continue;
      const float padk = fabsf(Dk) * ampPad + 0.05f;
      const float cjk = pairCjk[j][k], pjk = pairPjk[j][k];
      const float br = pairCol[j][k][0], bg = pairCol[j][k][1], bb = pairCol[j][k][2];
      const int32_t key1 = j * 16 + k;
      for (int mj = mj0; mj <= mj1 && nr < PT_MAXR; mj++) {
        const float d = mj - aj;
        const float lx = d * exj, ly = d * eyj;
        const float vx = -eyj, vy = exj;
        float t0 = -1e9f, t1 = 1e9f;
        if (fabsf(vx) > 1e-9f) {
          float a = (lgx0 - lx) / vx, b = (lgx1 - lx) / vx;
          if (a > b) { const float tt = a; a = b; b = tt; }
          if (a > t0) t0 = a;
          if (b < t1) t1 = b;
        } else if (lx < lgx0 || lx > lgx1) continue;
        if (fabsf(vy) > 1e-9f) {
          float a = (lgy0 - ly) / vy, b = (lgy1 - ly) / vy;
          if (a > b) { const float tt = a; a = b; b = tt; }
          if (a > t0) t0 = a;
          if (b < t1) t1 = b;
        } else if (ly < lgy0 || ly > lgy1) continue;
        if (t0 > t1) continue;
        const float fa = d * cjk + t0 * pjk + ak, fb = d * cjk + t1 * pjk + ak;
        const int mk0 = ptCeil((fa < fb ? fa : fb) - padk - pad);
        const int mk1 = PFMath::ifloor((fa > fb ? fa : fb) + padk + pad);
        for (int mk = mk0; mk <= mk1 && nr < PT_MAXR; mk++) {
          // intersection of the two (wavy) lines: straight guess, then Newton
          const float dk = mk - ak;
          float px = (d * eyk - dk * eyj) / det;
          float py = (exj * dk - exk * d) / det;
          for (int it = 0; it < 8; it++) {
            ptPhase(py, amp, kap, wphL, jOn, jFrontL, jWf, jAmpf);
            const float Fj = px * exj + py * eyj + aj + Dj * ptPsi - mj;
            const float Fk = px * exk + py * eyk + ak + Dk * ptPsi - mk;
            if (Fj * Fj + Fk * Fk < 1e-12f) break;
            const float a12 = eyj + Dj * ptDpsi, a22 = eyk + Dk * ptDpsi;
            const float dd = exj * a22 - a12 * exk;
            if (fabsf(dd) < 1e-9f) break;
            px -= (Fj * a22 - a12 * Fk) / dd;
            py -= (exj * Fk - exk * Fj) / dd;
          }
          ptPhase(py, amp, kap, wphL, jOn, jFrontL, jWf, jAmpf);
          const float psi = ptPsi;
          if (px < lgx0 || px > lgx1 || py < lgy0 || py > lgy1) continue;
          // the tuple K (local), signature over absolute K
          uint32_t sig = 0;
          for (int i = 0; i < N; i++) {
            int Ki;
            if (i == j) Ki = mj;
            else if (i == k) Ki = mk;
            else Ki = ptCeil(px * exF[i] + py * eyF[i] + famA[i] + DF[i] * psi);
            ptK[i] = Ki;
            sig = sig * 31u + (uint32_t)(Ki + famNi[i]);
          }
          // four vertices, summed in a fixed order so neighbours agree exactly
          float minx = 1e30f, maxx = -1e30f, miny = 1e30f, maxy = -1e30f;
          for (int v = 0; v < 4; v++) {
            const int dj = (v == 1 || v == 2) ? 1 : 0;
            const int dk2 = (v >= 2) ? 1 : 0;
            float X = 0, Y = 0;
            for (int i = 0; i < N; i++) {
              const int Ki = ptK[i] + (i == j ? dj : 0) + (i == k ? dk2 : 0);
              X += Ki * exF[i]; Y += Ki * eyF[i];
            }
            const float sx = (X + CX) * Sf, sy = (Y + CY) * Sf;
            ptQx[v] = sx; ptQy[v] = sy;
            if (sx < minx) minx = sx;
            if (sx > maxx) maxx = sx;
            if (sy < miny) miny = sy;
            if (sy > maxy) maxy = sy;
          }
          if (maxx < 0 || minx > FRAME_W || maxy < 0 || miny > FRAME_H) continue;
          // flip memory
          const int slot = ptLookup(key1, mj + famNi[j], mk + famNi[k]);
          if (hSig[slot] != sig) {
            if (hSig[slot] != 0x7fffffffu) hFlip[slot] = clockF;
            hSig[slot] = sig;
          }
          hStamp[slot] = frameNo;
          float age = clockF - hFlip[slot];
          if (age < 0.0f) age += (float)PT_CLOCK;
          const float f = age < 0.45f ? 1.0f - age / 0.45f : 0.0f;
          const int id = nr++;
          const float ff = f * f;
          cr[id] = br * (1.0f - ff) + 255.0f * ff;
          cg[id] = bg * (1.0f - ff) + 250.0f * ff;
          cb[id] = bb * (1.0f - ff) + 232.0f * ff;
          ptFill((int16_t)id);
        }
      }
    }
  }

  // compose: 1-px grout on every boundary, a hint of bevel on the lit edge
  for (int y = 0; y < FRAME_H; y++) {
    const float rf = rowF[y];
    const int row = y * FRAME_W;
    for (int x = 0; x < FRAME_W; x++) {
      const int i = row + x;
      const int id = ids[i];
      if (id < 0 || (x < FRAME_W - 1 && ids[i + 1] != id) || (y < FRAME_H - 1 && ids[i + FRAME_W] != id)) {
        PFCanvas::setPixel(x, y, 5, 3, 8);
        continue;
      }
      float m = rf;
      if ((x > 0 && ids[i - 1] != id) || (y > 0 && ids[i - FRAME_W] != id)) m *= 1.14f;
      const float r = cr[id] * m, g = cg[id] * m, b = cb[id] * m;
      PFCanvas::setPixel(x, y, r > 255.0f ? 255 : (uint8_t)(int)r,
                         g > 255.0f ? 255 : (uint8_t)(int)g,
                         b > 255.0f ? 255 : (uint8_t)(int)b);
    }
  }
  PFCanvas::present();
}

} // namespace PentagridTower