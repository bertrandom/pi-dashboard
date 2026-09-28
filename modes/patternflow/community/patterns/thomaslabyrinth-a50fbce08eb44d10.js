// ===== Patternflow pattern =====
// Title:    ThomasLabyrinth
// Author:   @engmung
// Date:     2026-08-05
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp linear 0:#000000 1:#ffffff 0.202:#858585
// @matrix 128x128


// @knobs B=0.1..0.2, Spin=-3..3, Pitch=-1.2..1.2, Fade=0.84..0.975

// Knobs: B     = Thomas attractor damping (0.02 = maze, >0.21 = single knot)
//        Spin  = rotation around vertical axis
//        Pitch = 3D camera tilt angle (pitch up/down)
//        Fade  = streak persistence
// Button: btn1 = kick the walker to a random position

export function setup(params) {
  params.buf = null; params.W = 0; params.H = 0;
  params.x = 0.5; params.y = 0.3; params.z = -0.2;
  params.rad = 4;
  params.seed = 8712;
  params.kick = false;
  params.dtAcc = 0;
}

function rnd(p) { p.seed = (p.seed * 1664525 + 1013904223) >>> 0; return p.seed / 4294967296; }

export function update(dt, input, params) {
  if (input.btnPressed[0]) params.kick = true;
  params.dtAcc += dt;
}

export function draw(display, params, time) {
  const W = display.width, H = display.height;
  if (!params.buf || params.W !== W || params.H !== H) {
    params.buf = new Float32Array(W * H);
    params.W = W; params.H = H;
  }
  const k = params.knobValues || [0.12, 0.5, 0.0, 0.93];
  const b = k[0], spin = k[1], pitch = k[2], fade = k[3];
  const buf = params.buf, len = W * H;
  let dt = params.dtAcc; params.dtAcc = 0; if (dt > 0.08) dt = 0.08;

  // Ink 값은 4,000으로 고정
  const fixedInk = 4000;
  let steps = Math.round(fixedInk * dt * 60);
  if (steps < 1) steps = 1; if (steps > 5000) steps = 5000;

  if (params.kick) {
    params.x = (rnd(params) - 0.5) * 4;
    params.y = (rnd(params) - 0.5) * 4;
    params.z = (rnd(params) - 0.5) * 4;
    params.kick = false;
  }

  for (let i = 0; i < len; i++) buf[i] *= fade;

  const h = 0.045;
  const th = time * spin;
  const csY = Math.cos(th), snY = Math.sin(th);
  const csX = Math.cos(pitch), snX = Math.sin(pitch);
  const cx = W * 0.5, cy = H * 0.5;

  let x = params.x, y = params.y, z = params.z;
  let rad = params.rad;

  for (let j = 0; j < steps; j++) {
    const dx = Math.sin(y) - b * x;
    const dy = Math.sin(z) - b * y;
    const dz = Math.sin(x) - b * z;
    x += dx * h; y += dy * h; z += dz * h;

    if (!isFinite(x + y + z)) { x = 0.5; y = 0.3; z = -0.2; continue; }

    // 자동 줌 오토스케일링
    const ax = Math.abs(x), ay = Math.abs(y), az = Math.abs(z);
    let r = ax > ay ? ax : ay; if (az > r) r = az;
    if (r < 2.5) r = 2.5;
    rad += (r - rad) * (r > rad ? 0.004 : 0.00025);

    // Y축 회전 (Spin)
    const x1 = x * csY + z * snY;
    const y1 = y;
    const z1 = -x * snY + z * csY;

    // X축 회전 (Pitch 틸트)
    const x2 = x1;
    const y2 = y1 * csX - z1 * snX;
    const z2 = y1 * snX + z1 * csX;

    const dep = z2 / rad;
    const ix = (cx + (x2 / rad) * (W * 0.5 - 2)) | 0;
    const iy = (cy + (y2 / rad) * (H * 0.5 - 2)) | 0;

    if (ix >= 0 && ix < W && iy >= 0 && iy < H) {
      const idx = iy * W + ix;
      const v = buf[idx] + 0.05 + 0.06 * (dep + 1) * 0.5;
      buf[idx] = v > 1 ? 1 : v;
    }
  }
  params.x = x; params.y = y; params.z = z; params.rad = rad;

  for (let yy = 0, i = 0; yy < H; yy++) {
    for (let xx = 0; xx < W; xx++, i++) {
      const t = buf[i];
      const v = t * t * (3 - 2 * t) * 1.15;
      display.setValue(xx, yy, v > 1 ? 1 : v);
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
