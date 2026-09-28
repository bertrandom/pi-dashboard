// ===== Patternflow pattern =====
// Title:    Fireworks
// Author:   @akacoda
// Date:     2026-08-23
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp linear 0:#000000 1:#ffffff
// @knobs Rate=0..1, Spread=0..1, Size=0..1, Gravity=0..1
// @matrix 128x64


//
// Random fireworks show for now — knobs reserved for later.
// Mortars rise from the bottom, burst past mid-height with varied
// shells (peony, chrysanthemum, willow, ring, palm, crossette, multi-break).

const MAX_SHELLS = 10;
const MAX_SPARKS = 520;
const MAX_TRAILS = 180;

// Burst style ids
const STYLE_PEONY = 0;
const STYLE_CHRYS = 1;
const STYLE_WILLOW = 2;
const STYLE_RING = 3;
const STYLE_PALM = 4;
const STYLE_CROSSETTE = 5;
const STYLE_PISTIL = 6; // peony with contrasting core

const PALETTE = [
  [255, 60, 50],    // red
  [255, 140, 40],   // orange
  [255, 220, 70],   // gold
  [255, 255, 200],  // warm white
  [180, 255, 120],  // lime
  [50, 220, 90],    // green
  [60, 200, 255],   // cyan
  [70, 110, 255],   // blue
  [180, 80, 255],   // violet
  [255, 90, 180],   // pink
  [220, 220, 255],  // silver
];

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

function rnd(params) {
  params.rng = (params.rng * 48271) % 2147483647;
  if (params.rng <= 0) params.rng += 2147483647;
  return params.rng / 2147483647;
}

function pick(params, arr) {
  return arr[(rnd(params) * arr.length) | 0];
}

function randRange(params, a, b) {
  return a + (b - a) * rnd(params);
}

function makeShell() {
  return {
    alive: 0,
    x: 0, y: 0, vx: 0, vy: 0,
    targetY: 0,
    age: 0,
    style: 0,
    colorA: 0,
    colorB: 0,
    size: 1,
    breaksLeft: 0,
    glitter: 0,
    phase: 0,
    burstTimer: 0,
  };
}

function makeSpark() {
  return {
    alive: 0,
    x: 0, y: 0, vx: 0, vy: 0,
    life: 0,
    maxLife: 1,
    r: 255, g: 255, b: 255,
    drag: 0.98,
    gravity: 28,
    twinkle: 0,
    sparkle: 0,
    canSplit: 0,
    splitT: 0,
    trail: 0,
  };
}

function makeTrail() {
  return { alive: 0, x: 0, y: 0, life: 0, r: 0, g: 0, b: 0 };
}

function allocSpark(params) {
  for (let i = 0; i < MAX_SPARKS; i++) {
    if (!params.sparks[i].alive) return params.sparks[i];
  }
  // Steal oldest-ish: just overwrite a random live one if full
  return params.sparks[(rnd(params) * MAX_SPARKS) | 0];
}

function allocTrail(params) {
  for (let i = 0; i < MAX_TRAILS; i++) {
    if (!params.trails[i].alive) return params.trails[i];
  }
  return null;
}

function allocShell(params) {
  for (let i = 0; i < MAX_SHELLS; i++) {
    if (!params.shells[i].alive) return params.shells[i];
  }
  return null;
}

function colorOf(idx) {
  return PALETTE[idx % PALETTE.length];
}

function heatTint(r, g, b, heat) {
  // Near birth, sparks run white-hot then settle into shell color
  const h = clamp(heat, 0, 1);
  return [
    (r + (255 - r) * h) | 0,
    (g + (255 - g) * h) | 0,
    (b + (255 - b) * h) | 0,
  ];
}

function launchShell(params, w, h) {
  const s = allocShell(params);
  if (!s) return;

  const midY = h * 0.5;
  // Burst somewhere between mid-screen and upper sky
  const targetY = randRange(params, h * 0.08, midY - 2);

  s.alive = 1;
  s.x = randRange(params, w * 0.12, w * 0.88);
  s.y = h - 1;
  s.vx = randRange(params, -8, 8);
  // Aim roughly for target height with some variance
  const rise = s.y - targetY;
  s.vy = -Math.sqrt(Math.max(40, 2 * 55 * rise)) * randRange(params, 0.85, 1.15);
  s.targetY = targetY;
  s.age = 0;
  s.style = (rnd(params) * 7) | 0;
  s.colorA = (rnd(params) * PALETTE.length) | 0;
  s.colorB = (rnd(params) * PALETTE.length) | 0;
  if (s.colorB === s.colorA) s.colorB = (s.colorA + 3) % PALETTE.length;
  s.size = randRange(params, 0.7, 1.35);
  if (rnd(params) < 0.55) {
    s.breaksLeft = 1 + ((rnd(params) * 3) | 0);
  } else {
    s.breaksLeft = 0;
  }
  s.glitter = rnd(params) < 0.45 ? 1 : 0;
  s.phase = 0;
  s.burstTimer = 0;
}

function spawnSpark(params, x, y, vx, vy, rgb, life, opts) {
  const p = allocSpark(params);
  p.alive = 1;
  p.x = x;
  p.y = y;
  p.vx = vx;
  p.vy = vy;
  p.life = life;
  p.maxLife = life;
  p.r = rgb[0];
  p.g = rgb[1];
  p.b = rgb[2];
  p.drag = opts.drag != null ? opts.drag : 0.985;
  p.gravity = opts.gravity != null ? opts.gravity : 32;
  p.twinkle = opts.twinkle || 0;
  p.sparkle = opts.sparkle || 0;
  p.canSplit = opts.canSplit || 0;
  p.splitT = opts.splitT || 0;
  p.trail = opts.trail || 0;
}

function burstShell(params, shell) {
  const style = shell.style;
  const ca = colorOf(shell.colorA);
  const cb = colorOf(shell.colorB);
  const sz = shell.size;
  const x = shell.x;
  const y = shell.y;

  // Brief flash core
  for (let i = 0; i < 10; i++) {
    const a = rnd(params) * Math.PI * 2;
    const sp = randRange(params, 4, 18) * sz;
    spawnSpark(params, x, y, Math.cos(a) * sp, Math.sin(a) * sp,
      [255, 255, 240], randRange(params, 0.12, 0.28),
      { drag: 0.9, gravity: 10, sparkle: 1 });
  }

  if (style === STYLE_PEONY || style === STYLE_PISTIL) {
    const n = (55 + rnd(params) * 35 * sz) | 0;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + randRange(params, -0.08, 0.08);
      const sp = randRange(params, 28, 52) * sz;
      const rgb = style === STYLE_PISTIL && i < n * 0.22 ? cb : ca;
      spawnSpark(params, x, y,
        Math.cos(a) * sp * randRange(params, 0.85, 1.1),
        Math.sin(a) * sp * randRange(params, 0.85, 1.1) * 0.92,
        rgb, randRange(params, 0.7, 1.4),
        { drag: 0.982, gravity: 30, twinkle: shell.glitter, trail: 1 });
    }
  } else if (style === STYLE_CHRYS) {
    const n = (70 + rnd(params) * 40 * sz) | 0;
    for (let i = 0; i < n; i++) {
      const a = rnd(params) * Math.PI * 2;
      const sp = randRange(params, 20, 48) * sz;
      spawnSpark(params, x, y, Math.cos(a) * sp, Math.sin(a) * sp * 0.9,
        ca, randRange(params, 1.1, 2.0),
        { drag: 0.988, gravity: 26, twinkle: 1, trail: 1, sparkle: shell.glitter });
    }
  } else if (style === STYLE_WILLOW) {
    const n = (45 + rnd(params) * 25 * sz) | 0;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI * 0.15 + rnd(params) * Math.PI * 1.3; // bias upward then droop
      const sp = randRange(params, 18, 36) * sz;
      spawnSpark(params, x, y, Math.cos(a) * sp, Math.sin(a) * sp - 8,
        ca, randRange(params, 1.6, 2.8),
        { drag: 0.992, gravity: 38, trail: 1, twinkle: 1 });
    }
  } else if (style === STYLE_RING) {
    const n = (36 + rnd(params) * 16) | 0;
    const sp = randRange(params, 34, 46) * sz;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      spawnSpark(params, x, y, Math.cos(a) * sp, Math.sin(a) * sp * 0.88,
        ca, randRange(params, 0.8, 1.3),
        { drag: 0.984, gravity: 28, trail: 1 });
    }
    // Soft inner fill
    for (let i = 0; i < 12; i++) {
      const a = rnd(params) * Math.PI * 2;
      const s2 = sp * randRange(params, 0.15, 0.45);
      spawnSpark(params, x, y, Math.cos(a) * s2, Math.sin(a) * s2,
        cb, randRange(params, 0.4, 0.8),
        { drag: 0.97, gravity: 22 });
    }
  } else if (style === STYLE_PALM) {
    const arms = 5 + ((rnd(params) * 4) | 0);
    for (let a = 0; a < arms; a++) {
      const ang = -Math.PI * 0.75 + (a / (arms - 1)) * Math.PI * 1.5;
      const sp = randRange(params, 30, 50) * sz;
      for (let k = 0; k < 7; k++) {
        const f = 0.55 + k * 0.08;
        spawnSpark(params, x, y,
          Math.cos(ang) * sp * f + randRange(params, -3, 3),
          Math.sin(ang) * sp * f * 0.85 - 6,
          ca, randRange(params, 1.0, 1.8),
          { drag: 0.99, gravity: 36, trail: 1 });
      }
    }
  } else if (style === STYLE_CROSSETTE) {
    const n = (28 + rnd(params) * 18 * sz) | 0;
    for (let i = 0; i < n; i++) {
      const a = rnd(params) * Math.PI * 2;
      const sp = randRange(params, 22, 40) * sz;
      spawnSpark(params, x, y, Math.cos(a) * sp, Math.sin(a) * sp * 0.9,
        ca, randRange(params, 0.55, 0.95),
        {
          drag: 0.983,
          gravity: 30,
          trail: 1,
          canSplit: 1,
          splitT: randRange(params, 0.25, 0.55),
        });
    }
  }

  if (shell.breaksLeft > 0) {
    shell.breaksLeft--;
    shell.alive = 1;
    shell.phase = 1;
    shell.vx = 0;
    shell.vy = 0;
    shell.burstTimer = randRange(params, 0.12, 0.38);
    shell.style = pick(params, [STYLE_PEONY, STYLE_RING, STYLE_CHRYS, STYLE_PISTIL]);
    shell.size = Math.max(0.5, shell.size * randRange(params, 0.75, 0.95));
    if (rnd(params) < 0.5) {
      const tmp = shell.colorA;
      shell.colorA = shell.colorB;
      shell.colorB = tmp;
    }
    return;
  }

  shell.alive = 0;
}

function splitSpark(params, sp) {
  const n = 3 + ((rnd(params) * 3) | 0);
  for (let i = 0; i < n; i++) {
    const a = rnd(params) * Math.PI * 2;
    const speed = randRange(params, 12, 26);
    spawnSpark(params, sp.x, sp.y,
      Math.cos(a) * speed, Math.sin(a) * speed,
      [sp.r, sp.g, sp.b],
      randRange(params, 0.35, 0.7),
      { drag: 0.97, gravity: 34, sparkle: 1, trail: 0 });
  }
  sp.alive = 0;
}

export function setup(params) {
  params.rng = 12345 + ((Math.random() * 1e6) | 0);
  params.shells = [];
  params.sparks = [];
  params.trails = [];
  for (let i = 0; i < MAX_SHELLS; i++) params.shells.push(makeShell());
  for (let i = 0; i < MAX_SPARKS; i++) params.sparks.push(makeSpark());
  for (let i = 0; i < MAX_TRAILS; i++) params.trails.push(makeTrail());

  params.spawnAcc = 0.2;
  params.skyPulse = 0;
  params.t = 0;

  // Placeholder knob state (unused visually for now)
  params.rate = 0.55;
  params.spread = 0.5;
  params.size = 0.5;
  params.gravity = 0.5;
}

export function update(dt, input, params) {
  const w = 128;
  const h = 64;
  // Prefer live display size if Pattern Lab provides it later via params
  const W = params._w || w;
  const H = params._h || h;

  params.t += dt;
  if (params.t > Math.PI * 200) params.t -= Math.PI * 200;

  // Auto-launch cadence with slight irregularity (like a real show)
  if (params.nextLaunch == null) params.nextLaunch = 0.4;
  params.spawnAcc += dt;
  if (params.spawnAcc >= params.nextLaunch) {
    params.spawnAcc = 0;
    params.nextLaunch = 0.35 + rnd(params) * 0.7;
    // Sometimes a volley of 2–3
    const volley = rnd(params) < 0.22 ? (2 + ((rnd(params) * 2) | 0)) : 1;
    for (let i = 0; i < volley; i++) launchShell(params, W, H);
  }

  for (let i = 0; i < MAX_SHELLS; i++) {
    const s = params.shells[i];
    if (!s.alive) continue;

    s.age += dt;

    if (s.phase === 0) {
      s.vy += 55 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;

      if (rnd(params) < 0.7) {
        const tr = allocTrail(params);
        if (tr) {
          tr.alive = 1;
          tr.x = s.x + randRange(params, -0.6, 0.6);
          tr.y = s.y + randRange(params, 0, 1.5);
          tr.life = randRange(params, 0.15, 0.35);
          tr.r = 255;
          tr.g = 200 + ((rnd(params) * 40) | 0);
          tr.b = 120;
        }
      }

      const pastMid = s.y < H * 0.48;
      const atApex = s.vy >= -4;
      const hitTarget = s.y <= s.targetY;
      const tooHigh = s.y < 2;
      const tooOld = s.age > 3.2;
      const fellBack = s.vy > 2 && s.y > H * 0.55;

      if (pastMid && (hitTarget || atApex || tooHigh || tooOld)) {
        burstShell(params, s);
        params.skyPulse = Math.min(1, params.skyPulse + 0.25);
      } else if (fellBack) {
        burstShell(params, s);
        params.skyPulse = Math.min(1, params.skyPulse + 0.15);
      }

      if (s.y > H + 4 || s.x < -10 || s.x > W + 10) s.alive = 0;
    } else {
      s.burstTimer -= dt;
      if (s.burstTimer <= 0) {
        burstShell(params, s);
        params.skyPulse = Math.min(1, params.skyPulse + 0.2);
      }
    }
  }

  // Sparks
  for (let i = 0; i < MAX_SPARKS; i++) {
    const p = params.sparks[i];
    if (!p.alive) continue;

    p.life -= dt;
    if (p.life <= 0) {
      p.alive = 0;
      continue;
    }

    p.vy += p.gravity * dt;
    p.vx *= Math.pow(p.drag, dt * 60);
    p.vy *= Math.pow(p.drag, dt * 60);
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    if (p.trail && rnd(params) < 0.55) {
      const tr = allocTrail(params);
      if (tr) {
        tr.alive = 1;
        tr.x = p.x;
        tr.y = p.y;
        tr.life = randRange(params, 0.12, 0.35);
        const fade = p.life / p.maxLife;
        tr.r = (p.r * fade) | 0;
        tr.g = (p.g * fade) | 0;
        tr.b = (p.b * fade) | 0;
      }
    }

    if (p.canSplit) {
      p.splitT -= dt;
      if (p.splitT <= 0) splitSpark(params, p);
    }

    if (p.y > H + 2 || p.x < -4 || p.x > W + 4) p.alive = 0;
  }

  // Ember trails
  for (let i = 0; i < MAX_TRAILS; i++) {
    const tr = params.trails[i];
    if (!tr.alive) continue;
    tr.life -= dt;
    tr.y += 6 * dt; // soft fall
    if (tr.life <= 0) tr.alive = 0;
  }

  params.skyPulse = Math.max(0, params.skyPulse - dt * 1.8);
}

function setPix(display, x, y, r, g, b) {
  const xi = x | 0;
  const yi = y | 0;
  if (xi < 0 || yi < 0 || xi >= display.width || yi >= display.height) return;
  if (display.setPixel) display.setPixel(xi, yi, r | 0, g | 0, b | 0);
  else if (display.setValue) display.setValue(xi, yi, Math.max(r, g, b) / 255);
}

function addPix(display, buf, w, h, x, y, r, g, b) {
  const xi = x | 0;
  const yi = y | 0;
  if (xi < 0 || yi < 0 || xi >= w || yi >= h) return;
  const i = (yi * w + xi) * 3;
  buf[i] = Math.min(255, buf[i] + r);
  buf[i + 1] = Math.min(255, buf[i + 1] + g);
  buf[i + 2] = Math.min(255, buf[i + 2] + b);
}

export function draw(display, params, time) {
  const w = display.width;
  const h = display.height;
  params._w = w;
  params._h = h;

  // Soft night sky
  const pulse = params.skyPulse || 0;
  const buf = params._buf && params._buf.length === w * h * 3
    ? params._buf
    : (params._buf = new Uint8Array(w * h * 3));

  for (let i = 0; i < buf.length; i += 3) {
    const y = ((i / 3) / w) | 0;
    const sky = 4 + (y / h) * 10 + pulse * 18;
    buf[i] = sky * 0.35;
    buf[i + 1] = sky * 0.4;
    buf[i + 2] = sky * 0.7;
  }

  // Trails first (dimmer)
  for (let i = 0; i < MAX_TRAILS; i++) {
    const tr = params.trails[i];
    if (!tr.alive) continue;
    const a = clamp(tr.life * 3, 0, 1);
    addPix(display, buf, w, h, tr.x, tr.y,
      tr.r * a * 0.55, tr.g * a * 0.55, tr.b * a * 0.55);
  }

  for (let i = 0; i < MAX_SHELLS; i++) {
    const s = params.shells[i];
    if (!s.alive) continue;
    if (s.phase === 1) {
      const pulse = 0.5 + 0.5 * Math.sin(params.t * 18 + s.x);
      addPix(display, buf, w, h, s.x, s.y, 200 * pulse, 140 * pulse, 60 * pulse);
    } else {
      addPix(display, buf, w, h, s.x, s.y, 255, 230, 160);
      addPix(display, buf, w, h, s.x, s.y + 1, 180, 100, 40);
    }
  }

  // Sparks
  for (let i = 0; i < MAX_SPARKS; i++) {
    const p = params.sparks[i];
    if (!p.alive) continue;

    const age = 1 - p.life / p.maxLife;
    const fade = Math.pow(p.life / p.maxLife, 0.65);
    let heat = clamp(1 - age * 3.2, 0, 1);
    if (p.sparkle) {
      const flicker = Math.sin(params.t * 40 + i * 2.3) > 0.7 ? 0.85 : 0;
      heat = Math.max(heat, flicker);
    }

    let rgb = heatTint(p.r, p.g, p.b, heat);
    let bright = fade;

    if (p.twinkle) {
      const tw = 0.55 + 0.45 * Math.sin(params.t * 28 + i * 1.7 + p.x);
      bright *= tw;
    }

    const r = rgb[0] * bright;
    const g = rgb[1] * bright;
    const b = rgb[2] * bright;
    addPix(display, buf, w, h, p.x, p.y, r, g, b);

    // Slight bloom for bright sparks
    if (bright > 0.65) {
      addPix(display, buf, w, h, p.x + 1, p.y, r * 0.35, g * 0.35, b * 0.35);
      addPix(display, buf, w, h, p.x, p.y + 1, r * 0.25, g * 0.25, b * 0.25);
    }
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      setPix(display, x, y, buf[i], buf[i + 1], buf[i + 2]);
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
