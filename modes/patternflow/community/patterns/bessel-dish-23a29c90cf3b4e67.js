// ===== Patternflow pattern =====
// Title:    Bessel Dish
// Author:   @kpow
// Date:     2026-09-04
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @knobs Density=0..1, Speed=0.05..3, Form=0..1, Zoom=0..1
// @matrix 128x128

//
// A circular dish of ink-black water on a speaker, driven by TWO tones and
// lit by two coloured lamps (after @seeing_into_the_unknown). Crests take
// one lamp, troughs the other, the tops a pale core.
//
// A dish mode with m lobes is a Bessel function: silent inside r ~ m/k. So
// the centre is pure rings, m-fold petals appear further out, and the second
// tone (~2m, higher k) further out still, where the two interlock into
// bridges between one ring of wave-tops and the next. That is the mandala.
//
// Motion: the tones drift, and every few seconds a new permutation (new
// symmetry, new lamp colours) is born at the centre and zooms outward
// through the old one. Zoom pulls back from a dish filling the frame top to
// bottom to a stack of three, showing the previous and next permutations
// above and below.
//
// Knobs: Density (hairlines -> ribbons), Speed, Form (morph the symmetry
// 4 -> 5 -> 6 -> 8 -> 4), Zoom (three dishes -> one full-height dish).




export function setup(params) {
  params.t = 0;
  params.k = [0.6, 0.5, 0.3, 0.8];
  params.zoomS = 0.8;   // eased zoom, chases the knob
  params.H = null;
}

export function update(dt, input, params) {
  params.k = input.knobValues;
  params.t += dt * params.k[1];
  // Ease the zoom so a knob twist glides instead of jumping (~0.6 s settle).
  params.zoomS += (params.k[3] - params.zoomS) * (1 - Math.exp(-dt * 5));
}

// [crest lamp, trough lamp, core]
const SCHEMES = [
  [[0xFF, 0xC0, 0x18], [0xB0, 0x10, 0xFF], [0xFF, 0xF2, 0xB0]],   // Royal: gold / magenta
  [[0x00, 0x85, 0x7A], [0xFF, 0x2E, 0x8A], [0xC8, 0xFF, 0xF4]],   // Petrol
  [[0xFF, 0x3A, 0x00], [0x00, 0xA6, 0xFF], [0xFF, 0xD8, 0xA0]],   // Ink Dish
  [[0x1E, 0x5B, 0xFF], [0x00, 0xFF, 0xB3], [0xE6, 0xF6, 0xFF]],   // Hex Ice
  [[0xC4, 0x00, 0x28], [0xFF, 0x7A, 0x00], [0xFF, 0xE0, 0x4D]],   // Lava Lamp
  [[0x00, 0xFF, 0x9C], [0xFF, 0x00, 0x6E], [0xE0, 0xFF, 0xF0]],   // Neon Mint
  [[0xFF, 0x6A, 0x00], [0x10, 0x30, 0xFF], [0xFF, 0xE8, 0xC0]],   // Cobalt Ember
  [[0xC8, 0xFF, 0x00], [0x8A, 0x00, 0xE6], [0xF4, 0xFF, 0xC0]],   // Acid Grape
  [[0xFF, 0x4D, 0x4D], [0x00, 0xC8, 0xD8], [0xFF, 0xE6, 0xD0]],   // Coral Reef
  [[0xFF, 0x9A, 0x00], [0x00, 0x6E, 0x7A], [0xFF, 0xF0, 0xC0]],   // Sunset Teal
  [[0xFF, 0x2A, 0x00], [0x80, 0xD0, 0xFF], [0xFF, 0xD0, 0xB0]],   // Blood Orange Ice
  [[0x7C, 0xFF, 0x2E], [0xFF, 0x3C, 0xB4], [0xF0, 0xFF, 0xE0]],   // Lime Rose
  [[0xFF, 0xB8, 0x7A], [0x3A, 0x1C, 0xB0], [0xFF, 0xF4, 0xE8]],   // Peach Indigo
];
const NUM_SCHEMES = SCHEMES.length;
const ORDERS = [4, 5, 6, 8];
const HOLD = 6.0, WIPE = 4.0;              // seconds per permutation at Speed 1

const sstep = (a, b, x) => { let v = (x - a) / (b - a); v = v < 0 ? 0 : v > 1 ? 1 : v; return v * v * (3 - 2 * v); };

// Integer hash -> [0,1). The permutation sequence is drawn from this, so it
// never repeats in practice (2^32 period) yet stays reproducible.
function hash01(n) {
  n = Math.imul(n >>> 0, 2654435761) >>> 0; n = (n ^ (n >>> 15)) >>> 0;
  n = Math.imul(n, 2246822519) >>> 0; n = (n ^ (n >>> 13)) >>> 0;
  return (n & 0xFFFFFF) / 16777216;
}
const rawScheme = (n) => Math.floor(hash01(n * 4 + 1) * NUM_SCHEMES);

// Permutation n: a random symmetry morph position, a scheme that differs from
// the previous one, a random start angle, spin direction, and a ring count
// within +-15%.
function perm(n, form) {
  n += 1000;   // keep the index positive
  const p = (hash01(n * 4) * 4 + form * 4) % 4;
  let si = rawScheme(n);
  if (si === rawScheme(n - 1)) si = (si + 1) % NUM_SCHEMES;
  const h2 = hash01(n * 4 + 2);
  return { p, sch: SCHEMES[si], rot: h2 * 2 * Math.PI, dir: h2 > 0.5 ? 1 : -1,
           ks: 0.85 + 0.30 * hash01(n * 4 + 3) };
}

// Two-tone dish surface at polar (r, th), three zones cross-faded by radius.
function dish(r, th, k1, m1, t, rot) {
  const k2 = k1 * 1.35, m2 = 2 * m1;
  const on1 = sstep(0.45 * m1 / k1, 0.95 * m1 / k1, r);
  const on2 = sstep(0.55 * m2 / k2, 1.05 * m2 / k2, r);
  const rings  = Math.cos(k1 * r - t);
  const petals = rings * Math.cos(m1 * (th + rot));
  const tone2  = Math.cos(k2 * r + 0.6 * t) * Math.cos(m2 * (th - 0.5 * rot));
  return rings * (1 - on1) + petals * (on1 - on2) + 0.55 * (petals + tone2) * on2;
}

// Morph between adjacent symmetries at position p (continuous, wraps 8 -> 4).
function surface(r, th, k1, p, t, rot) {
  const ia = Math.floor(p) % 4, ib = (ia + 1) % 4;
  const bl = sstep(0, 1, p - Math.floor(p));
  const za = dish(r, th, k1, ORDERS[ia], t, rot);
  if (bl < 0.001) return za;
  const zb = dish(r, th, k1 * 1.06, ORDERS[ib], t * 1.07, -rot);
  return za * (1 - bl) + zb * bl;
}

export function draw(display, params, time) {
  const w = display.width, h = display.height;
  if (!params.H || params.H.length !== w * h) params.H = new Float32Array(w * h);
  const H = params.H;
  const t = params.t, dens = params.k[0], form = params.k[2];

  // Zoom: R from a three-dish stack (19 px) to past the frame corners, so at
  // full zoom no rim is visible anywhere.
  const Rmax = (Math.sqrt(w * w * 0.25 + h * h * 0.25) + 4) * 1.5;
  const R = 24 + (Rmax - 24) * sstep(0, 1, params.zoomS);
  const gap = 6, pitch = 2 * R + gap;
  const cx = w * 0.5, cy = h * 0.5;
  const k1 = (2 * Math.PI * (3.0 + 0.25 * Math.sin(t * 0.21))) / R;
  const breathe = 0.8 + 0.2 * Math.sin(t * 0.5);

  // Permutation clock: hold, then the next one grows out of the centre.
  const period = HOLD + WIPE;
  const n = Math.floor(t / period);
  const u = Math.max(0, (t - n * period - HOLD) / WIPE);      // 0 = holding, 0..1 = wipe
  const uE = sstep(0, 1, u);
  const rw = uE * (R + 8) - 2;                                  // wipe radius
  const uOut = 1 - (1 - u) * (1 - u);                           // ease-out
  const zoomIn = 0.18 + 0.82 * uOut;                            // newborn starts small, zooms in
  const spin = t * 0.05;

  // Per dish j (-1 above, 0 middle, +1 below): old and new permutations.
  const PO = [perm(n - 1, form), perm(n, form), perm(n + 1, form)];
  const PN = [perm(n, form), perm(n + 1, form), perm(n + 2, form)];

  // 1. Height field + wipe mix.
  for (let y = 0; y < h; y++) {
    let j = Math.round((y - cy) / pitch);
    if (j < -1) j = -1; else if (j > 1) j = 1;
    const dy = y - (cy + j * pitch);
    const po = PO[j + 1], pn = PN[j + 1];
    for (let x = 0; x < w; x++) {
      const dx = x - cx;
      const r = Math.sqrt(dx * dx + dy * dy);
      let z = 0;
      if (r < R) {
        const th = Math.atan2(dy, dx);
        const mix = u > 0 ? 1 - sstep(rw - 5, rw + 5, r) : 0;
        let zo = 0, zn = 0;
        if (mix < 0.999) zo = surface(r, th, k1 * po.ks, po.p, t, po.dir * spin + po.rot);
        if (mix > 0.001) zn = surface(r / zoomIn, th, k1 * pn.ks, pn.p, t, pn.dir * spin + pn.rot);
        z = (zo * (1 - mix) + zn * mix) * (1 - sstep(R - 4, R, r));
      }
      H[y * w + x] = breathe * z;
    }
  }

  // 2. Shade: crests lamp 1, troughs lamp 2, tops a pale core. Density
  // widens the ribbons until the black closes up. Scheme follows the wipe.
  const thr = 0.62 - 0.50 * dens, soft = 0.12;
  const fill = 0.30 * dens * dens;
  for (let y = 0; y < h; y++) {
    let j = Math.round((y - cy) / pitch);
    if (j < -1) j = -1; else if (j > 1) j = 1;
    const dy = y - (cy + j * pitch);
    const so = PO[j + 1].sch, sn = PN[j + 1].sch;
    for (let x = 0; x < w; x++) {
      const dx = x - cx;
      const r = Math.sqrt(dx * dx + dy * dy);
      if (r > R + 2) { display.setPixel(x, y, 0, 0, 0); continue; }
      const mix = u > 0 ? 1 - sstep(rw - 5, rw + 5, r) : 0;
      const z = H[y * w + x] / breathe;
      const A = sstep(thr - soft, thr + soft, z);
      const B = sstep(thr - soft, thr + soft, -z);
      const core = sstep(0.80, 0.98, z);
      const glow = r < R ? fill * (0.5 + 0.5 * z) : 0;
      const edge = sstep(R - 3, R - 1, r) * (1 - sstep(R, R + 1.5, r)) * 0.6;
      const wA = A + glow * 0.6, wB = B + glow * 0.4 + edge;
      let r8 = 0, g8 = 0, b8 = 0;
      for (let c = 0; c < 3; c++) {
        const lamp = c === 0 ? wA : c === 1 ? wB : core;
        if (lamp <= 0) continue;
        r8 += lamp * (so[c][0] * (1 - mix) + sn[c][0] * mix);
        g8 += lamp * (so[c][1] * (1 - mix) + sn[c][1] * mix);
        b8 += lamp * (so[c][2] * (1 - mix) + sn[c][2] * mix);
      }
      display.setPixel(x, y, Math.min(255, r8), Math.min(255, g8), Math.min(255, b8));
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
