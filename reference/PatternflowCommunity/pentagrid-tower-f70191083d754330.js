// ===== Patternflow pattern =====
// Title:    Pentagrid Tower
// Author:   @engmung
// Date:     2026-09-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @knobs Folds=5..12, Climb=0..4, Shift=0..1, Scale=6..16
// @matrix 64x128

// Folds: line families (5 = Penrose) · Climb: ascent speed · Shift: phason strain · Scale: edge px · any button: phason jolt

const PT_MAXR = 2048;
const PT_HASH = 4096;
const PT_PAL = [
  [255, 176, 34],   // burnished gold  (thinnest rhombs)
  [238, 84, 40],    // terracotta
  [255, 238, 206],  // bone
  [34, 76, 240],    // lapis            (fattest rhombs)
];
const PT_CLOCK = 3600;

// scratch (module level, reused every frame)
const ptK = new Int32Array(16);
const ptQx = new Float64Array(4);
const ptQy = new Float64Array(4);

export function setup(params) {
  params.clock = 0;
  params.top = 0;
  params.drift = 0;
  params.wave = 0;
  params.phBase = 0;
  params.jolt = -1;
  params.joltAmp = 0;
  params.frame = 0;
  params.N = 0;
  params.folds = 5;
  params.climb = 2;
  params.shift = 0;
  params.scale = 6;
}

function ptOrtho(v, b, N) {
  let d = 0, n = 0;
  for (let i = 0; i < N; i++) { d += v[i] * b[i]; n += b[i] * b[i]; }
  if (n < 1e-9) return;
  const f = d / n;
  for (let i = 0; i < N; i++) v[i] -= f * b[i];
}

function ptNormMax(v, N) {
  let m = 0;
  for (let i = 0; i < N; i++) m = Math.max(m, Math.abs(v[i]));
  if (m > 0) for (let i = 0; i < N; i++) v[i] /= m;
}

function ptFamilies(params, N) {
  params.N = N;
  const ex = new Float64Array(N), ey = new Float64Array(N);
  const step = (N % 2 ? 2 : 1) * Math.PI / N;
  for (let i = 0; i < N; i++) { ex[i] = Math.cos(step * i); ey[i] = Math.sin(step * i); }
  // ones, made orthogonal to the physical directions
  const one = new Float64Array(N);
  for (let i = 0; i < N; i++) one[i] = 1;
  ptOrtho(one, ex, N); ptOrtho(one, ey, N);
  // base offsets: generic, summing to zero (Penrose for N = 5)
  const G = new Float64Array(N);
  let s = 0;
  for (let i = 0; i < N; i++) { G[i] = ((i * 0.6180339887 + 0.137) % 1) * 0.9; s += G[i]; }
  for (let i = 0; i < N; i++) G[i] -= s / N;
  // D: pure phason (no translation, keeps the sum) - drift, waves, jolts
  const D = new Float64Array(N);
  for (let i = 0; i < N; i++) D[i] = Math.cos(2.3 * i + 0.7) + 0.6 * Math.sin(1.7 * i + 0.2);
  ptOrtho(D, ex, N); ptOrtho(D, ey, N); ptOrtho(D, one, N); ptNormMax(D, N);
  // W: phason strain that also leaves the Penrose sum (Shift knob)
  const W = new Float64Array(N);
  for (let i = 0; i < N; i++) W[i] = Math.sin(1.3 * i + 1.1) + 0.5 * Math.cos(2.9 * i);
  ptOrtho(W, ex, N); ptOrtho(W, ey, N); ptNormMax(W, N);
  params.ex = ex; params.ey = ey; params.G = G; params.D = D; params.W = W;
  // rhomb class per pair: acute angle in units of pi/N
  const cls = new Uint8Array(N * N);
  const cmax = Math.floor(N / 2);
  for (let j = 0; j < N; j++) for (let k = 0; k < N; k++) {
    if (j === k) continue;
    let a = Math.abs(step * (k - j)) % Math.PI;
    a = Math.min(a, Math.PI - a);
    cls[j * N + k] = Math.max(1, Math.min(cmax, Math.round(a / (Math.PI / N))));
  }
  params.cls = cls;
  // steepest phason slope that keeps every pair of wavy lines crossing the right way
  let smax = 1e9;
  for (let j = 0; j < N; j++) for (let k = j + 1; k < N; k++) {
    const det = Math.abs(ex[j] * ey[k] - ey[j] * ex[k]);
    const c = Math.abs(ex[j] * D[k] - ex[k] * D[j]);
    if (c > 1e-9) smax = Math.min(smax, det / c);
  }
  params.slopeMax = Math.min(1, smax);
  params.cmax = cmax;
  if (params.hStamp) params.hStamp.fill(-1000);
}

export function update(dt, input, params) {
  const kv = input.knobValues || [];
  params.folds = Math.round(kv[0] != null ? kv[0] : 5);
  params.climb = kv[1] != null ? kv[1] : 2;
  params.shift = kv[2] != null ? kv[2] : 0;
  params.scale = kv[3] != null ? kv[3] : 6;
  params.clock = (params.clock + dt) % PT_CLOCK;
  // climbing: the view moves up the strip (tile edges per second)
  params.top -= dt * params.climb * 1.1;
  if (params.top < -20000) params.top += 20000;
  params.drift = (params.drift + dt * (0.035 + 0.05 * params.shift)) % 1000;
  params.wave = (params.wave + dt * (0.8 + 0.8 * params.shift)) % (Math.PI * 2000);
  const b = input.btnPressed || [];
  if ((b[0] || b[1] || b[2] || b[3]) && params.jolt < 0) {
    params.jolt = 0;
    params.joltAmp = Math.random() < 0.5 ? 0.4 : -0.4;
  }
  if (params.jolt >= 0) {
    params.jolt += dt / 1.3;
    if (params.jolt >= 1) {
      params.phBase = (params.phBase + params.joltAmp) % 100;
      params.jolt = -1;
    }
  }
}

function ptLookup(params, key1, mj, mk) {
  const mask = PT_HASH - 1;
  let h = (Math.imul(key1, 73856093) ^ Math.imul(mj, 19349663) ^ Math.imul(mk, 83492791)) & mask;
  const stale = params.frame - 3;
  let free = -1;
  for (let p = 0; p < 12; p++) {
    const s = (h + p) & mask;
    if (params.hStamp[s] >= stale) {
      if (params.hKey[s] === key1 && params.hMj[s] === mj && params.hMk[s] === mk) return s;
    } else if (free < 0) free = s;
  }
  if (free < 0) free = h;
  params.hKey[free] = key1; params.hMj[free] = mj; params.hMk[free] = mk;
  params.hSig[free] = 0x7fffffff; params.hFlip[free] = -99;
  params.hStamp[free] = params.frame;
  return free;
}

// phason field along the column: travelling wave + jolt front (value and slope)
let ptPh = 0, ptDph = 0;
function ptPhase(py, base, amp, kap, wph, jOn, jFront, jW, jAmp) {
  const sa = kap * py + wph;
  let phi = base + amp * Math.sin(sa);
  let dphi = amp * kap * Math.cos(sa);
  if (jOn) {
    const s = (jFront - py) / jW + 0.5;
    if (s >= 1) phi += jAmp;
    else if (s > 0) {
      phi += jAmp * s * s * (3 - 2 * s);
      dphi -= jAmp * 6 * s * (1 - s) / jW;
    }
  }
  ptPh = phi; ptDph = dphi;
}

function ptFill(params, id, w, h) {
  let y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i < 4; i++) { if (ptQy[i] < y0) y0 = ptQy[i]; if (ptQy[i] > y1) y1 = ptQy[i]; }
  let ys = Math.ceil(y0 - 0.5), ye = Math.ceil(y1 - 0.5) - 1;
  if (ys < 0) ys = 0;
  if (ye > h - 1) ye = h - 1;
  const buf = params.ids;
  for (let y = ys; y <= ye; y++) {
    const yc = y + 0.5;
    let xl = Infinity, xr = -Infinity;
    for (let e = 0; e < 4; e++) {
      const ax = ptQx[e], ay = ptQy[e];
      const bx = ptQx[(e + 1) & 3], by = ptQy[(e + 1) & 3];
      if ((ay <= yc && yc < by) || (by <= yc && yc < ay)) {
        const x = ax + (yc - ay) * (bx - ax) / (by - ay);
        if (x < xl) xl = x;
        if (x > xr) xr = x;
      }
    }
    if (xl > xr) continue;
    let xs = Math.ceil(xl - 0.5), xe = Math.ceil(xr - 0.5) - 1;
    if (xs < 0) xs = 0;
    if (xe > w - 1) xe = w - 1;
    const row = y * w;
    for (let x = xs; x <= xe; x++) buf[row + x] = id;
  }
}

export function draw(display, params, time) {
  const w = display.width, h = display.height;
  if (!params.ids || params.W_ !== w || params.H_ !== h) {
    params.W_ = w; params.H_ = h;
    params.ids = new Int16Array(w * h);
    params.cr = new Float32Array(PT_MAXR);
    params.cg = new Float32Array(PT_MAXR);
    params.cb = new Float32Array(PT_MAXR);
    params.rowF = new Float32Array(h);
    for (let y = 0; y < h; y++) params.rowF[y] = 1.0 - 0.2 * (y / (h - 1));
  }
  if (!params.hStamp) {
    params.hKey = new Int32Array(PT_HASH);
    params.hMj = new Int32Array(PT_HASH);
    params.hMk = new Int32Array(PT_HASH);
    params.hSig = new Int32Array(PT_HASH);
    params.hFlip = new Float32Array(PT_HASH);
    params.hStamp = new Int32Array(PT_HASH).fill(-1000);
  }
  const N = Math.max(3, Math.min(15, params.folds));
  if (params.N !== N) ptFamilies(params, N);
  params.frame++;

  const ex = params.ex, ey = params.ey, G = params.G, D = params.D, W = params.W;
  const S = Math.max(2, params.scale);
  const half = N / 2;
  const sh = params.shift;
  const clock = params.clock;

  // view in tile units
  const tx0 = -w / (2 * S), tx1 = w / (2 * S);
  const ty0 = params.top, ty1 = params.top + h / S;
  // approximate tile-space offset of the dual map
  let ox = 0, oy = 0;
  for (let i = 0; i < N; i++) { const g = G[i] + sh * W[i] + 0.5; ox += g * ex[i]; oy += g * ey[i]; }
  const kap = 2 * Math.PI / 8;
  const amp = Math.min(0.1 + 0.2 * sh, 0.35 * params.slopeMax / kap);   // travelling phason wave
  const M = 1.2 + amp + 1.5 / half;
  const gx0 = (tx0 - ox) / half - M, gx1 = (tx1 - ox) / half + M;
  const gy0 = (ty0 - oy) / half - M, gy1 = (ty1 - oy) / half + M;
  const wph = params.wave;
  const base = params.phBase + params.drift;
  // jolt front sweeping down the visible column
  const jOn = params.jolt >= 0;
  const vy0 = (ty0 - oy) / half, vy1 = (ty1 - oy) / half;
  const jAmp = params.joltAmp * 5 / N;
  const jW = Math.max(1.5, Math.abs(jAmp) * 1.5 / (0.35 * params.slopeMax));
  const jFront = vy0 - jW + (vy1 - vy0 + 2 * jW) * params.jolt;

  const ids = params.ids;
  ids.fill(-1);
  const cr = params.cr, cg = params.cg, cb = params.cb;
  const cls = params.cls, cmax = params.cmax;
  let nr = 0;

  for (let j = 0; j < N - 1 && nr < PT_MAXR; j++) {
    const exj = ex[j], eyj = ey[j];
    const gjB = G[j] + sh * W[j];
    const pad = Math.abs(D[j]) * (amp + 1.2) + 0.05;
    // range of p.e_j + gamma over the rect
    const c1 = gx0 * exj + gy0 * eyj, c2 = gx1 * exj + gy0 * eyj;
    const c3 = gx0 * exj + gy1 * eyj, c4 = gx1 * exj + gy1 * eyj;
    const bj = gjB + D[j] * base;
    const mj0 = Math.ceil(Math.min(c1, c2, c3, c4) + bj - pad);
    const mj1 = Math.floor(Math.max(c1, c2, c3, c4) + bj + pad);
    for (let k = j + 1; k < N && nr < PT_MAXR; k++) {
      const exk = ex[k], eyk = ey[k];
      const det = exj * eyk - eyj * exk;
      if (Math.abs(det) < 1e-6) continue;
      const gkB = G[k] + sh * W[k];
      const bk = gkB + D[k] * base;
      const padk = Math.abs(D[k]) * (amp + 1.2) + 0.05;
      const cjk = exj * exk + eyj * eyk;          // e_j . e_k
      const pjk = -eyj * exk + exj * eyk;         // e_j_perp . e_k
      const c = cls[j * N + k];
      // colour of this family pair: class picks the stone, one orientation swaps it
      let pi = cmax > 1 ? Math.round((c - 1) / (cmax - 1) * 3) : 3;
      if ((j + k) % N === 0) pi = pi === 0 ? 1 : pi === 3 ? 2 : pi === 1 ? 0 : 3;
      const pc = PT_PAL[pi];
      const br = pc[0], bg = pc[1], bb = pc[2];
      // orientation tilt: light from the upper left
      const ax = exj + exk, ay = eyj + eyk;
      const al = Math.atan2(ay, ax);
      const tilt = 0.9 + 0.1 * Math.cos(2 * al + 1.9);
      const key1 = j * 16 + k;
      for (let mj = mj0; mj <= mj1 && nr < PT_MAXR; mj++) {
        // clip line j (at base gamma) to the rect
        const d = mj - bj;
        const lx = d * exj, ly = d * eyj;          // foot point
        const vx = -eyj, vy = exj;                 // direction
        let t0 = -1e9, t1 = 1e9;
        if (Math.abs(vx) > 1e-9) {
          let a = (gx0 - lx) / vx, b = (gx1 - lx) / vx;
          if (a > b) { const tt = a; a = b; b = tt; }
          if (a > t0) t0 = a; if (b < t1) t1 = b;
        } else if (lx < gx0 || lx > gx1) continue;
        if (Math.abs(vy) > 1e-9) {
          let a = (gy0 - ly) / vy, b = (gy1 - ly) / vy;
          if (a > b) { const tt = a; a = b; b = tt; }
          if (a > t0) t0 = a; if (b < t1) t1 = b;
        } else if (ly < gy0 || ly > gy1) continue;
        if (t0 > t1) continue;
        const fa = d * cjk + t0 * pjk + bk, fb = d * cjk + t1 * pjk + bk;
        const mk0 = Math.ceil(Math.min(fa, fb) - padk - pad);
        const mk1 = Math.floor(Math.max(fa, fb) + padk + pad);
        for (let mk = mk0; mk <= mk1 && nr < PT_MAXR; mk++) {
          // intersection of the two (wavy) lines: straight guess, then Newton
          let px = ((mj - bj) * eyk - (mk - bk) * eyj) / det;
          let py = (exj * (mk - bk) - exk * (mj - bj)) / det;
          let phi = base;
          for (let it = 0; it < 8; it++) {
            ptPhase(py, base, amp, kap, wph, jOn, jFront, jW, jAmp);
            phi = ptPh;
            const Fj = px * exj + py * eyj + gjB + D[j] * phi - mj;
            const Fk = px * exk + py * eyk + gkB + D[k] * phi - mk;
            if (Fj * Fj + Fk * Fk < 1e-16) break;
            const a12 = eyj + D[j] * ptDph, a22 = eyk + D[k] * ptDph;
            const dd = exj * a22 - a12 * exk;
            if (Math.abs(dd) < 1e-9) break;
            px -= (Fj * a22 - a12 * Fk) / dd;
            py -= (exj * Fk - exk * Fj) / dd;
          }
          ptPhase(py, base, amp, kap, wph, jOn, jFront, jW, jAmp);
          phi = ptPh;
          if (px < gx0 || px > gx1 || py < gy0 || py > gy1) continue;
          // the tuple K
          let sig = 0;
          for (let i = 0; i < N; i++) {
            let Ki;
            if (i === j) Ki = mj;
            else if (i === k) Ki = mk;
            else Ki = Math.ceil(px * ex[i] + py * ey[i] + G[i] + sh * W[i] + D[i] * phi);
            ptK[i] = Ki;
            sig = (Math.imul(sig, 31) + Ki) | 0;
          }
          // four vertices, summed in a fixed order so neighbours agree exactly
          let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
          for (let v = 0; v < 4; v++) {
            const dj = (v === 1 || v === 2) ? 1 : 0;
            const dk = (v >= 2) ? 1 : 0;
            let X = 0, Y = 0;
            for (let i = 0; i < N; i++) {
              const Ki = ptK[i] + (i === j ? dj : 0) + (i === k ? dk : 0);
              X += Ki * ex[i]; Y += Ki * ey[i];
            }
            const sx = (X - tx0) * S, sy = (Y - ty0) * S;
            ptQx[v] = sx; ptQy[v] = sy;
            if (sx < minx) minx = sx; if (sx > maxx) maxx = sx;
            if (sy < miny) miny = sy; if (sy > maxy) maxy = sy;
          }
          if (maxx < 0 || minx > w || maxy < 0 || miny > h) continue;
          // flip memory
          const slot = ptLookup(params, key1, mj, mk);
          if (params.hSig[slot] !== sig) {
            if (params.hSig[slot] !== 0x7fffffff) params.hFlip[slot] = clock;
            params.hSig[slot] = sig;
          }
          params.hStamp[slot] = params.frame;
          let age = clock - params.hFlip[slot];
          if (age < 0) age += PT_CLOCK;
          const f = age < 0.45 ? 1 - age / 0.45 : 0;
          const id = nr++;
          const ff = f * f;
          cr[id] = (br * tilt) * (1 - ff) + 255 * ff;
          cg[id] = (bg * tilt) * (1 - ff) + 250 * ff;
          cb[id] = (bb * tilt) * (1 - ff) + 232 * ff;
          ptFill(params, id, w, h);
        }
      }
    }
  }

  // compose: 1-px grout on every boundary, a hint of bevel on the lit edge
  const rowF = params.rowF;
  for (let y = 0; y < h; y++) {
    const rf = rowF[y];
    const row = y * w;
    for (let x = 0; x < w; x++) {
      const i = row + x;
      const id = ids[i];
      if (id < 0 || (x < w - 1 && ids[i + 1] !== id) || (y < h - 1 && ids[i + w] !== id)) {
        display.setPixel(x, y, 5, 3, 8);
        continue;
      }
      let m = rf;
      if ((x > 0 && ids[i - 1] !== id) || (y > 0 && ids[i - w] !== id)) m *= 1.14;
      let r = cr[id] * m, g = cg[id] * m, b = cb[id] * m;
      display.setPixel(x, y, r > 255 ? 255 : r | 0, g > 255 ? 255 : g | 0, b > 255 ? 255 : b | 0);
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
