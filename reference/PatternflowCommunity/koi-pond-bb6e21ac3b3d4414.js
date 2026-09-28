// ===== Patternflow pattern =====
// Title:    koi pond
// Author:   @engmung
// Date:     2026-09-10
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @knobs KoiCount=1..8, Leaves=1..24, Speed=0.2..3, InkMode=0..1
// @matrix 128x64



// Pattern: Lotus & Koi (Max 24 Leaves Support)



const TAU = Math.PI * 2;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const mix = (a, b, t) => a + (b - a) * t;
const angleDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));

function random(p) {
  p.seed = (Math.imul(p.seed, 1664525) + 1013904223) >>> 0;
  return p.seed / 4294967296;
}

function ring(p, x, y, strength) {
  if (p.rings.length >= 16) p.rings.shift();
  p.rings.push({ x, y, age: 0, strength });
}

export function setup(p) {
  p.seed = 91517;
  p.t = 0;
  p.koiCount = 4;
  p.leafCount = 6;
  p.speedScale = 1.0;
  p.ink = 0.85;
  p.reverse = 1;
  p.inkOverride = null;
  p.food = { x: 67, y: 31, age: 0 };
  p.fright = 0;
  p.feed = 0;
  p.rings = [];

  // Max 8 koi pool initialization
  p.allFish = [];
  for (let i = 0; i < 8; i++) {
    const angle = random(p) * TAU;
    p.allFish.push({
      x: 20 + random(p) * 88,
      y: 15 + random(p) * 34,
      a: angle,
      len: 18 + random(p) * 5,
      id: i,
      phase: i * 1.9,
      turn: 0,
      speed: 3,
      speedBase: 0.8 + random(p) * 0.5,
      speedPhase: random(p) * TAU,
      trail: [],
      trailClock: 0
    });
  }

  // Increased lotus leaves pool initialization to 24
  p.allLeaves = [];
  for (let i = 0; i < 24; i++) {
    p.allLeaves.push({
      baseX: 10 + random(p) * 108,
      baseY: 8 + random(p) * 48,
      x: 0,
      y: 0,
      r: 4.0 + random(p) * 3.5,
      a: random(p) * TAU,
      driftPhase: random(p) * TAU,
      id: i
    });
  }
}

export function update(dt, input, p) {
  dt = clamp(Number.isFinite(dt) ? dt : 0, 0, 0.05);
  const v = input && input.knobValues;

  if (v) {
    if (p.lastInk !== undefined && Math.abs(v[3] - p.lastInk) > 0.00001) {
      p.inkOverride = null;
    }
    p.lastInk = v[3];

    p.koiCount = Math.min(8, Math.max(1, Math.round(v[0])));
    // Updated max leaf count limit from 12 to 24
    p.leafCount = Math.min(24, Math.max(1, Math.round(v[1])));
    p.speedScale = clamp(v[2], 0.2, 3);
    
    const ease = 1 - Math.exp(-dt * 6);
    p.ink = mix(p.ink, p.inkOverride === null ? clamp(v[3], 0, 1) : p.inkOverride, ease);
  }

  const buttons = input && input.btnPressed;
  if (buttons) {
    if (buttons[0]) {
      p.fright = 2.0; 
      ring(p, 64, 32, 1.4);
    }
    if (buttons[1]) {
      p.reverse *= -1;
      for (let i = 0; i < p.allLeaves.length; i++) {
        const l = p.allLeaves[i];
        l.baseX = 10 + random(p) * 108;
        l.baseY = 8 + random(p) * 48;
        l.driftPhase = random(p) * TAU;
        l.a = random(p) * TAU;
      }
    }
    if (buttons[2]) {
      p.food = { x: 30 + random(p) * 68, y: 17 + random(p) * 30, age: 0 };
      p.feed = 10;
      ring(p, p.food.x, p.food.y, 1.0);
    }
    if (buttons[3]) p.inkOverride = p.ink > 0.5 ? 0.0 : 1.0;
  }

  const simDt = dt * p.speedScale;
  p.t += simDt;
  p.fright = Math.max(0, p.fright - simDt);
  p.feed = Math.max(0, p.feed - simDt);
  p.food.age += simDt;

  const boostRatio = clamp(p.fright / 2.0, 0, 1);
  const currentSpeedScale = mix(p.speedScale, 2.5, boostRatio);

  const activeFish = p.allFish.slice(0, p.koiCount);
  const positions = activeFish.map(f => [f.x, f.y]);

  activeFish.forEach((f, i) => {
    const roamAngle = f.a + 0.65 * Math.sin(p.t * 0.21 + i * 2.4) + 0.32 * Math.sin(p.t * 0.47 + i * 0.7);
    const orbit = p.t * 0.23 + (i * TAU) / Math.max(1, p.koiCount);
    const tx = p.food.x + Math.cos(orbit) * 16;
    const ty = p.food.y + Math.sin(orbit) * 12;
    const distance = Math.max(1, Math.hypot(tx - f.x, ty - f.y));

    const gathering = p.feed > 0 ? 0.8 : 0.2;
    let dx = Math.cos(roamAngle) * (0.8 - gathering * 0.6) + ((tx - f.x) / distance) * gathering * 1.2;
    let dy = Math.sin(roamAngle) * (0.8 - gathering * 0.6) + ((ty - f.y) / distance) * gathering * 1.2;

    for (let j = 0; j < positions.length; j++) {
      if (i !== j) {
        const sx = f.x - positions[j][0];
        const sy = f.y - positions[j][1];
        const d2 = sx * sx + sy * sy;
        if (d2 < 576) {
          const d = Math.sqrt(Math.max(d2, 1));
          const rep = (((24 - d) / 24) * 2.8) / d;
          dx += sx * rep;
          dy += sy * rep;
        }
      }
    }

    const aheadX = f.x + Math.cos(f.a) * 7;
    const aheadY = f.y + Math.sin(f.a) * 7;
    dx += Math.max(0, 18 - aheadX) * 0.26 - Math.max(0, aheadX - 110) * 0.26;
    dy += Math.max(0, 16 - aheadY) * 0.30 - Math.max(0, aheadY - 48) * 0.30;

    if (p.fright > 0) {
      const ax = f.x - 64;
      const ay = f.y - 32;
      const d = Math.hypot(ax, ay) || 1;
      dx += (ax / d) * boostRatio * 2.0;
      dy += (ay / d) * boostRatio * 2.0;
    }

    const desired = Math.atan2(dy, dx);
    const turn = clamp(angleDiff(desired, f.a) * 1.5, -1.2, 1.2);
    f.turn = mix(f.turn, turn, 1 - Math.exp(-simDt * 4));
    f.a += f.turn * simDt;

    const speedNoise = Math.sin(p.t * 0.6 + f.speedPhase) * 0.4 + Math.sin(p.t * 1.3 + f.id * 2.1) * 0.2;
    const targetSpeed = (2.8 * f.speedBase + speedNoise) * currentSpeedScale;
    f.speed = mix(f.speed, targetSpeed, 1 - Math.exp(-simDt * 4));

    f.x += Math.cos(f.a) * f.speed * simDt;
    f.y += Math.sin(f.a) * f.speed * simDt;
    f.x = clamp(f.x, 8, 120);
    f.y = clamp(f.y, 7, 57);

    f.phase += simDt * (3.2 + f.speed * 0.8);
    f.trailClock += simDt;
    if (f.trailClock > 0.2) {
      f.trailClock = 0;
      f.trail.unshift([f.x, f.y]);
      if (f.trail.length > 10) f.trail.pop();
    }
  });

  const activeLeaves = p.allLeaves.slice(0, p.leafCount);
  for (const l of activeLeaves) {
    const driftSpeed = 0.12 * p.reverse;
    l.driftPhase += simDt * 0.15;
    l.x = l.baseX + Math.sin(p.t * 0.1 * driftSpeed + l.driftPhase) * 4.5;
    l.y = l.baseY + Math.cos(p.t * 0.07 * driftSpeed + l.driftPhase) * 3.0;
    l.a += simDt * 0.03 * driftSpeed;
  }

  for (const r of p.rings) r.age += simDt;
  p.rings = p.rings.filter(r => r.age < 2.8);
}

function dab(p, x, y, c, alpha) {
  const ix = Math.floor(x * p.sx);
  const iy = Math.floor(y * p.sy);
  if (ix < 0 || iy < 0 || ix >= p.w || iy >= p.h) return;
  const i = (iy * p.w + ix) * 3;
  const a = clamp(alpha, 0, 1);
  p.rgb[i] = mix(p.rgb[i], c[0], a);
  p.rgb[i + 1] = mix(p.rgb[i + 1], c[1], a);
  p.rgb[i + 2] = mix(p.rgb[i + 2], c[2], a);
}

function line(p, x1, y1, x2, y2, c, a) {
  const n = Math.max(1, Math.ceil(Math.hypot((x2 - x1) * p.sx, (y2 - y1) * p.sy) * 1.4));
  for (let i = 0; i <= n; i++) dab(p, mix(x1, x2, i / n), mix(y1, y2, i / n), c, a);
}

function oval(p, x, y, rx, ry, angle, c, alpha) {
  const cs = Math.cos(angle);
  const sn = Math.sin(angle);
  const r = Math.max(rx, ry) + 1;
  for (let iy = Math.max(0, Math.floor((y - r) * p.sy)); iy < Math.min(p.h, (y + r) * p.sy); iy++) {
    for (let ix = Math.max(0, Math.floor((x - r) * p.sx)); ix < Math.min(p.w, (x + r) * p.sx); ix++) {
      const dx = (ix + 0.5) / p.sx - x;
      const dy = (iy + 0.5) / p.sy - y;
      const u = (dx * cs + dy * sn) / rx;
      const v = (-dx * sn + dy * cs) / ry;
      const edge = (1 - u * u - v * v) * Math.min(rx * p.sx, ry * p.sy);
      if (edge > 0) dab(p, (ix + 0.5) / p.sx, (iy + 0.5) / p.sy, c, alpha * Math.min(1, edge));
    }
  }
}

function polygon(p, pts, c, alpha) {
  const ymin = Math.max(0, Math.floor(Math.min(...pts.map(v => v[1])) * p.sy));
  const ymax = Math.min(p.h, Math.ceil(Math.max(...pts.map(v => v[1])) * p.sy));
  for (let iy = ymin; iy < ymax; iy++) {
    const y = (iy + 0.5) / p.sy;
    const hits = [];
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[i];
      const b = pts[j];
      if ((a[1] > y) !== (b[1] > y)) hits.push(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
    }
    hits.sort((a, b) => a - b);
    for (let i = 0; i + 1 < hits.length; i += 2) {
      for (let ix = Math.max(0, Math.ceil(hits[i] * p.sx - 0.5)); ix < Math.min(p.w, hits[i + 1] * p.sx - 0.5); ix++) {
        dab(p, (ix + 0.5) / p.sx, y, c, alpha);
      }
    }
  }
}

function color(a, b, t) {
  return [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
}

function spine(f, q) {
  return Math.sin(f.phase - q * 5.6) * q * q * f.len * 0.115 - f.turn * q * q * f.len * 0.13;
}

function fishPoint(f, q, side) {
  const x = (0.53 - q) * f.len;
  const y = spine(f, q) + side;
  return [f.x + x * Math.cos(f.a) - y * Math.sin(f.a), f.y + x * Math.sin(f.a) + y * Math.cos(f.a)];
}

function paintFish(p, f) {
  const bodyBase = color([255, 230, 180], [25, 28, 26], p.ink);
  const accentRed = color([255, 120, 80], [160, 25, 20], p.ink);
  const darkDetail = color([100, 130, 120], [10, 15, 12], p.ink);
  const finColor = color([180, 220, 200], [60, 75, 68], p.ink);

  for (const side of [-1, 1]) {
    const reach = (2.4 + 0.7 * Math.sin(f.phase * 0.72 + side)) * side;
    const a = fishPoint(f, 0.25, side * 1.3);
    const b = fishPoint(f, 0.37, reach + side * 1.8);
    const c = fishPoint(f, 0.54, side * 1.5);
    polygon(p, [a, b, c], finColor, 0.65);
    line(p, ...a, ...b, bodyBase, 0.42);
  }

  const tail = [fishPoint(f, 0.88, 0), fishPoint(f, 1.25, -3.3), fishPoint(f, 1.18, 0), fishPoint(f, 1.25, 3.3)];
  polygon(p, tail, bodyBase, 0.76);

  for (const s of [-2.8, -1.4, 1.4, 2.8]) {
    line(p, ...fishPoint(f, 0.92, 0), ...fishPoint(f, 1.23, s), finColor, 0.68);
  }

  const cs = Math.cos(f.a);
  const sn = Math.sin(f.a);
  const r = f.len * 0.78;

  for (let iy = Math.max(0, Math.floor((f.y - r) * p.sy)); iy < Math.min(p.h, (f.y + r) * p.sy); iy++) {
    for (let ix = Math.max(0, Math.floor((f.x - r) * p.sx)); ix < Math.min(p.w, (f.x + r) * p.sx); ix++) {
      const x = (ix + 0.5) / p.sx;
      const y = (iy + 0.5) / p.sy;
      const dx = x - f.x;
      const dy = y - f.y;
      const q = 0.53 - (dx * cs + dy * sn) / f.len;
      if (q < 0 || q > 1) continue;

      const cross = -dx * sn + dy * cs - spine(f, q);
      const width = f.len * 0.19 * Math.pow(Math.sin((Math.PI * (q + 0.07)) / 1.07), 0.65) * (1 - 0.68 * q);
      const edge = (width - Math.abs(cross)) * Math.min(p.sx, p.sy);
      if (edge <= 0) continue;

      const side = cross / width;
      const patch = Math.sin(q * 18 + f.id * 2.3) + 0.62 * Math.cos(side * 3.3 + q * 13 + f.id) + 0.3 * Math.sin(q * 39 - side * 5);

      let c = bodyBase;
      if (f.id % 3 === 2) c = patch > 0.15 ? bodyBase : darkDetail;
      else if (patch > 0.23 || (q < 0.19 && f.id % 2 === 0)) c = accentRed;

      const light = 0.74 + 0.26 * Math.sqrt(Math.max(0, 1 - side * side));
      const rim = Math.min(1, edge * 0.8);
      const shade = light * (0.60 + 0.40 * rim);
      dab(p, x, y, [c[0] * shade, c[1] * shade, c[2] * shade], Math.min(1, edge + 0.25));
    }
  }

  line(p, ...fishPoint(f, 0.3, 0), ...fishPoint(f, 0.66, 0.1), bodyBase, 0.32);
  for (const side of [-1, 1]) {
    line(p, ...fishPoint(f, 0.23, side * 1.6), ...fishPoint(f, 0.29, side * 1.8), darkDetail, 0.5);
    const eye = fishPoint(f, 0.105, side * f.len * 0.07);
    oval(p, ...eye, 0.48, 0.45, f.a, darkDetail, 0.98);
    line(p, ...fishPoint(f, 0.015, side * 0.45), ...fishPoint(f, -0.055, side * 0.95), bodyBase, 0.58);
  }
}

function paintLeaf(p, l) {
  const cs = Math.cos(l.a);
  const sn = Math.sin(l.a);

  const base = color([20, 70, 50], [55, 85, 60], p.ink);
  const rim = color([40, 110, 80], [90, 130, 95], p.ink);

  for (let iy = Math.max(0, Math.floor((l.y - l.r - 1) * p.sy)); iy < Math.min(p.h, (l.y + l.r + 1) * p.sy); iy++) {
    for (let ix = Math.max(0, Math.floor((l.x - l.r - 1) * p.sx)); ix < Math.min(p.w, (l.x + l.r + 1) * p.sx); ix++) {
      const x = (ix + 0.5) / p.sx;
      const y = (iy + 0.5) / p.sy;
      const dx = x - l.x;
      const dy = (y - l.y) / 0.88;
      const u = dx * cs + dy * sn;
      const v = -dx * sn + dy * cs;
      const d = Math.hypot(u, v);
      if (d > l.r || (u > -0.35 && Math.abs(v) < (u + 0.4) * 0.29)) continue;

      const a = Math.atan2(v, u);
      const vein = Math.pow(Math.max(0, Math.cos(a * 7 + 0.3 * Math.sin(d))), 22) * 0.13;
      const shade = 0.91 + 0.09 * Math.sin(a - 1) + vein;
      const c = d > l.r - 0.65 ? rim : base;
      dab(p, x, y, [c[0] * shade, c[1] * shade, c[2] * shade], clamp((l.r - d) * p.sx + 0.3, 0, 1));
    }
  }
  oval(p, l.x - 0.5, l.y, 0.65, 0.6, 0, rim, 0.7);
}

function paintRipple(p, r) {
  const maxAge = 2.8;
  if (r.age >= maxAge) return;

  const progress = r.age / maxAge;
  const fade = Math.pow(1 - progress, 1.8) * r.strength;
  if (fade <= 0.01) return;

  const mainR = r.age * 18.0;

  const crestCol = color([210, 210, 210], [245, 240, 225], p.ink);
  const troughCol = color([30, 30, 30], [140, 135, 130], p.ink);

  for (let w = 0; w < 2; w++) {
    const R = mainR - w * 4.8;
    if (R <= 1.0) continue;

    const amp = fade * (w === 0 ? 1.0 : 0.5);
    const margin = 2.5;

    const minX = Math.max(0, Math.floor(r.x - R - margin));
    const maxX = Math.min(128, Math.ceil(r.x + R + margin));
    const minY = Math.max(0, Math.floor(r.y - R - margin));
    const maxY = Math.min(64, Math.ceil(r.y + R + margin));

    for (let y = minY; y < maxY; y++) {
      for (let x = minX; x < maxX; x++) {
        const dist = Math.hypot(x + 0.5 - r.x, y + 0.5 - r.y);
        const diff = Math.abs(dist - R);

        if (diff < 1.8) {
          const ringIntensity = Math.exp(-diff * diff * 1.5) * amp;
          dab(p, x + 0.5, y + 0.5, crestCol, ringIntensity * 0.45);

          const innerDiff = Math.abs(dist - (R - 0.9));
          if (innerDiff < 1.5) {
            const troughIntensity = Math.exp(-innerDiff * innerDiff * 1.8) * amp;
            dab(p, x + 0.5, y + 0.5, troughCol, troughIntensity * 0.25);
          }
        }
      }
    }
  }
}

export function draw(display, p) {
  const w = display.width;
  const h = display.height;
  if (p.w !== w || p.h !== h) {
    p.w = w;
    p.h = h;
    p.sx = w / 128;
    p.sy = h / 64;
    p.rgb = new Float32Array(w * h * 3);
  }

  const isPureDark = p.ink < 0.01;
  const water = isPureDark ? [0, 0, 0] : color([0, 0, 0], [230, 226, 205], p.ink);
  const glint = isPureDark ? [0, 0, 0] : color([0, 0, 0], [242, 238, 220], p.ink);
  const shadow = isPureDark ? [0, 0, 0] : color([0, 0, 0], [100, 115, 105], p.ink);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      if (isPureDark) {
        p.rgb[i] = 0;
        p.rgb[i + 1] = 0;
        p.rgb[i + 2] = 0;
      } else {
        const xx = x / p.sx;
        const yy = y / p.sy;
        const grain = (((Math.imul(Math.floor(xx * 2) + 1, 374761393) ^ Math.imul(Math.floor(yy * 2) + 9, 668265263)) >>> 8) & 255) / 255 - 0.5;
        const tone = grain * 1.5;
        p.rgb[i] = Math.max(0, water[0] + tone);
        p.rgb[i + 1] = Math.max(0, water[1] + tone);
        p.rgb[i + 2] = Math.max(0, water[2] + tone);
      }
    }
  }

  for (const r of p.rings) {
    paintRipple(p, r);
  }

  const activeFish = p.allFish.slice(0, p.koiCount);
  const activeLeaves = p.allLeaves.slice(0, p.leafCount);

  for (const f of activeFish) {
    if (!isPureDark) oval(p, f.x + 1.6, f.y + 2.0, f.len * 0.54, f.len * 0.13, f.a, shadow, 0.25);
    for (let i = 1; i < f.trail.length; i++) {
      line(p, ...f.trail[i - 1], ...f.trail[i], glint, 0.08 * (1 - i / f.trail.length));
    }
  }

  for (const f of activeFish) paintFish(p, f);

  for (const l of activeLeaves) {
    if (!isPureDark) oval(p, l.x + 0.9, l.y + 1.3, l.r, l.r * 0.86, l.a, shadow, 0.3);
    paintLeaf(p, l);
  }

  if (p.feed > 0) {
    for (let i = 0; i < 5; i++) {
      const a = i * 2.4 + p.t * 0.12;
      const r = 1.5 + i * 0.65;
      dab(p, p.food.x + Math.cos(a) * r, p.food.y + Math.sin(a) * r * 0.6, [255, 180, 60], 0.9);
    }
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      display.setPixel(x, y, p.rgb[i], p.rgb[i + 1], p.rgb[i + 2]);
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
