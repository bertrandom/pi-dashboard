// ===== Patternflow pattern =====
// Title:    GaleInk
// Author:   @engmung
// Date:     2026-08-05
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp linear 0:#00e1ff 0.599:#000000 0.538:#0b009e
// @matrix 64x128

// @knobs Eddies=30..148, Gale=6..110, Curl=0..1, Fade=0.85..0.98

// Knobs: Eddies = vortex wavelength in px (fine turbulence vs broad weather systems)
//        Gale   = wind speed (px/sec)
//        Curl   = 0 = laminar downpour along the tall axis, 1 = free swirling turbulence
//        Fade   = streak persistence
// Button: btn1 = reseed all particles at random positions

const N = 900;

export function setup(params) {
  params.buf = null; params.W = 0; params.H = 0;
  params.px = new Float32Array(N);
  params.py = new Float32Array(N);
  params.seed = 8888;
  params.dtAcc = 0;
  params.scatter = true;
}

function rnd(p) { p.seed = (p.seed * 1664525 + 1013904223) >>> 0; return p.seed / 4294967296; }

export function update(dt, input, params) {
  if (input.btnPressed[0]) params.scatter = true;
  params.dtAcc += dt;
}

export function draw(display, params, time) {
  const W = display.width, H = display.height;
  if (!params.buf || params.W !== W || params.H !== H) {
    params.buf = new Float32Array(W * H);
    params.W = W; params.H = H;
    params.scatter = true;
  }
  const k = params.knobValues || [22, 25, 0.7, 0.93];
  const ka = 6.28318 / k[0];
  const kb = ka * 1.618;
  const gale = k[1], curl = k[2], fade = k[3];
  const buf = params.buf, len = W * H;
  const px = params.px, py = params.py;
  let dt = params.dtAcc; params.dtAcc = 0; if (dt > 0.08) dt = 0.08;

  if (params.scatter) {
    for (let i = 0; i < N; i++) { px[i] = rnd(params) * W; py[i] = rnd(params) * H; }
    params.scatter = false;
  }

  for (let i = 0; i < len; i++) buf[i] *= fade;

  const t1 = time * 0.5, t2 = time * 0.37, t3 = time * 0.13;
  let sub = Math.ceil((gale * dt) / 1.1);
  if (sub < 1) sub = 1; if (sub > 6) sub = 6;
  const sdt = dt / sub;
  const dep = 0.55 / sub;

  for (let i = 0; i < N; i++) {
    let x = px[i], y = py[i];
    for (let s = 0; s < sub; s++) {
      // 좌우 이동 평균값이 정확히 0이 되도록 설계된 대칭 유체 벡터장
      const sy = y * ka + t1 + Math.sin(t3) * 2;
      const sx = x * kb - t2;

      const vx = Math.sin(sy) * Math.sin(sx) * curl * 1.4;
      const vy = Math.cos(sy) * Math.cos(sx) * curl * 1.4 + (1.15 - curl);

      x += vx * gale * sdt;
      y += vy * gale * sdt;

      const ix = x | 0, iy = y | 0;
      if (ix >= 0 && ix < W && iy >= 0 && iy < H) {
        const idx = iy * W + ix;
        const v = buf[idx] + dep;
        buf[idx] = v > 1 ? 1 : v;
      }
    }

    // 좌우 화면 경계 래핑 (동일 밀도 유지)
    if (x < 0) x += W;
    else if (x >= W) x -= W;

    // 상하 경계 재배치
    if (y > H + 3 || y < -4) {
      x = rnd(params) * W;
      y = curl > 0.85 ? rnd(params) * H : -1 - rnd(params) * 6;
    }
    px[i] = x; py[i] = y;
  }

  for (let yy = 0, i = 0; yy < H; yy++) {
    for (let xx = 0; xx < W; xx++, i++) {
      const t = buf[i];
      const v = t * t * (3 - 2 * t) * 1.12;
      display.setValue(xx, yy, v > 1 ? 1 : v);
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
