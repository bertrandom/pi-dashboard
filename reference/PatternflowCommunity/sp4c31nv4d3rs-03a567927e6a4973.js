// ===== Patternflow pattern =====
// Title:    SP4C31NV4D3RS
// Author:   @stillkingz
// Date:     2026-09-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @knobs Speed=0.2..2, Fire=0..1, Color=0..1, Stars=0..1
// @matrix 128x64
// SPACE INVADERS — AUTO PLAY


const ALIENS = [
  [
    "00100000100",
    "00010001000",
    "00111111100",
    "01101110110",
    "11111111111",
    "10111111101",
    "10100000101",
    "00011011000"
  ],
  [
    "00100000100",
    "10010001001",
    "10111111101",
    "11101110111",
    "11111111111",
    "01111111110",
    "00100000100",
    "01000000010"
  ]
];

const SQUID = [
  [
    "00011000",
    "00111100",
    "01111110",
    "11011011",
    "11111111",
    "00100100",
    "01011010",
    "10100101"
  ],
  [
    "00011000",
    "00111100",
    "01111110",
    "11011011",
    "11111111",
    "01011010",
    "10000001",
    "01000010"
  ]
];

const SHIP = [
  "00000100000",
  "00001110000",
  "00001110000",
  "01111111110",
  "11111111111",
  "11111111111"
];

const UFO = [
  "000111111000",
  "001111111100",
  "011111111110",
  "110110110111",
  "111111111111",
  "001001001000"
];

function hash(n) {
  const v = Math.sin(n * 127.1 + 31.7) * 43758.5453;
  return v - Math.floor(v);
}

function hueChannel(h, offset) {
  const k = ((h * 6 + offset) % 6 + 6) % 6;
  return Math.max(0, Math.min(1, Math.abs(k - 3) - 1));
}

function pixel(sprite, x, y) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  return iy >= 0 && iy < sprite.length &&
    ix >= 0 && ix < sprite[0].length &&
    sprite[iy][ix] === "1";
}

function resetWave(p) {
  p.aliens = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 6; col++) {
      p.aliens.push({ row, col, alive: true });
    }
  }
  p.offset = 10;
  p.direction = 1;
  p.drop = 0;
  p.moveTimer = 0;
  p.playerShots = [];
  p.enemyShots = [];
  p.explosions = [];
  p.nextWave = 0;

  // Shields are stored as destructible pixel masks.
  p.shields = [];
  for (let i = 0; i < 4; i++) {
    const cells = [];
    for (let y = 0; y < 6; y++) {
      for (let x = 0; x < 14; x++) {
        const corner = y < 2 && (x < 2 - y || x > 11 + y);
        const arch = y >= 3 && x >= 5 && x <= 8;
        cells.push(!corner && !arch);
      }
    }
    p.shields.push({ x: 13 + i * 28, y: 46, cells });
  }
}

function damageShield(p, x, y) {
  for (let i = 0; i < p.shields.length; i++) {
    const shield = p.shields[i];
    const sx = Math.floor(x - shield.x);
    const sy = Math.floor(y - shield.y);

    if (
      sx >= 0 && sx < 14 && sy >= 0 && sy < 6 &&
      shield.cells[sy * 14 + sx]
    ) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const xx = sx + dx;
          const yy = sy + dy;
          if (xx >= 0 && xx < 14 && yy >= 0 && yy < 6) {
            shield.cells[yy * 14 + xx] = false;
          }
        }
      }
      return true;
    }
  }
  return false;
}

export function setup(p) {
  p.t = 0;
  p.speed = 1;
  p.fire = 0.6;
  p.color = 0;
  p.stars = 0.3;
  p.paused = false;
  p.white = false;
  p.shipX = 59;
  p.fireTimer = 0;
  p.enemyTimer = 0;
  p.hurt = 0;
  p.wave = 1;
  p.score = 0;
  resetWave(p);
}

export function update(dt, input, p) {
  if (input && input.knobValues) {
    p.speed = input.knobValues[0];
    p.fire = input.knobValues[1];
    p.color = input.knobValues[2];
    p.stars = input.knobValues[3];
  }

  if (input && input.btnPressed) {
    if (input.btnPressed[0]) p.paused = !p.paused;
    if (input.btnPressed[1]) {
      for (let i = 0; i < p.enemyShots.length; i++) {
        p.explosions.push({
          x: p.enemyShots[i].x,
          y: p.enemyShots[i].y,
          life: 0.4
        });
      }
      p.enemyShots = [];
    }
    if (input.btnPressed[2]) p.white = !p.white;
    if (input.btnPressed[3]) {
      p.t = 0;
      p.wave = 1;
      p.score = 0;
      p.hurt = 0;
      p.fireTimer = 0;
      p.enemyTimer = 0;
      resetWave(p);
    }
  }

  if (p.paused) return;

  // Substeps keep collision checks reliable at higher speeds.
  const elapsed = Math.min(dt, 0.1) * p.speed;
  const steps = Math.max(1, Math.ceil(elapsed / 0.016));
  const step = elapsed / steps;

  for (let frame = 0; frame < steps; frame++) {
    p.t += step;
    p.hurt = Math.max(0, p.hurt - step);

    let alive = 0;
    for (let i = 0; i < p.aliens.length; i++) {
      if (p.aliens[i].alive) alive++;
    }

    if (alive === 0) {
      p.nextWave += step;
      if (p.nextWave > 1.4) {
        p.wave++;
        resetWave(p);
      }
    }

    // The formation speeds up as fewer invaders remain.
    p.moveTimer += step;
    const interval = 0.1 + alive * 0.018;

    if (p.moveTimer >= interval && alive > 0) {
      p.moveTimer = 0;
      p.offset += p.direction * 2;

      if (p.offset > 30 || p.offset < 4) {
        p.offset = Math.max(4, Math.min(30, p.offset));
        p.direction *= -1;
        p.drop += 2;
      }

      if (p.drop >= 10) {
        p.wave = 1;
        resetWave(p);
      }
    }

    // Aim at the nearest surviving invader.
    let target = 64;
    let best = 999;

    for (let i = 0; i < p.aliens.length; i++) {
      const a = p.aliens[i];
      if (!a.alive) continue;
      const ax = p.offset + a.col * 16 + 5;
      const distance = Math.abs(ax - p.shipX - 5);
      if (distance < best) {
        best = distance;
        target = ax;
      }
    }

    // Dodge nearby descending lasers.
    for (let i = 0; i < p.enemyShots.length; i++) {
      const shot = p.enemyShots[i];
      if (shot.y > 36 && Math.abs(shot.x - p.shipX - 5) < 8) {
        target = p.shipX + 5 < 64
          ? p.shipX + 20
          : p.shipX - 10;
      }
    }

    const movement = Math.max(
      -step * 31, Math.min(step * 31, target - 5 - p.shipX)
    );
    p.shipX = Math.max(2, Math.min(115, p.shipX + movement));

    p.fireTimer += step;
    if (p.fireTimer > 0.75 - p.fire * 0.55 && alive > 0) {
      p.fireTimer = 0;
      p.playerShots.push({ x: p.shipX + 5, y: 54 });
    }

    p.enemyTimer += step;
    if (p.enemyTimer > 0.9 && alive > 0) {
      p.enemyTimer = 0;
      const column = Math.floor(hash(Math.floor(p.t * 7)) * 6);
      let shooter = null;

      for (let i = 0; i < p.aliens.length; i++) {
        const a = p.aliens[i];
        if (a.alive && a.col === column) shooter = a;
      }

      if (shooter) {
        p.enemyShots.push({
          x: p.offset + shooter.col * 16 + 5,
          y: 10 + shooter.row * 10 + p.drop + 8
        });
      }
    }

    for (let i = p.playerShots.length - 1; i >= 0; i--) {
      const shot = p.playerShots[i];
      shot.y -= step * 53;
      let hit = damageShield(p, shot.x, shot.y);

      for (let j = 0; j < p.aliens.length && !hit; j++) {
        const a = p.aliens[j];
        if (!a.alive) continue;

        const ax = p.offset + a.col * 16;
        const ay = 10 + a.row * 10 + p.drop;

        if (
          shot.x >= ax && shot.x < ax + 11 &&
          shot.y >= ay && shot.y < ay + 8
        ) {
          a.alive = false;
          hit = true;
          p.score += a.row === 0 ? 30 : 10;
          p.explosions.push({ x: ax + 5, y: ay + 4, life: 0.45 });
        }
      }

      if (hit || shot.y < 0) p.playerShots.splice(i, 1);
    }

    for (let i = p.enemyShots.length - 1; i >= 0; i--) {
      const shot = p.enemyShots[i];
      shot.y += step * 27;
      let hit = damageShield(p, shot.x, shot.y);

      if (
        !hit && p.hurt === 0 &&
        shot.y >= 55 && shot.y <= 61 &&
        shot.x >= p.shipX && shot.x < p.shipX + 11
      ) {
        hit = true;
        p.hurt = 1.2;
        p.explosions.push({
          x: p.shipX + 5, y: 57, life: 0.55
        });
      }

      if (hit || shot.y > 64) p.enemyShots.splice(i, 1);
    }

    for (let i = p.explosions.length - 1; i >= 0; i--) {
      p.explosions[i].life -= step;
      if (p.explosions[i].life <= 0) p.explosions.splice(i, 1);
    }
  }
}

export function draw(d, p, time) {
  const scale = Math.min(d.width / 128, d.height / 64);
  const hue = (1 / 3 + p.color * 0.83) % 1;
  const cr = p.white ? 1 : hueChannel(hue, 0);
  const cg = p.white ? 1 : hueChannel(hue, 4);
  const cb = p.white ? 1 : hueChannel(hue, 2);
  const anim = Math.floor(p.t * 3) % 2;
  const ufoX = (p.t * 11) % 210 - 35;

  for (let y = 0; y < d.height; y++) {
    for (let x = 0; x < d.width; x++) {
      const X = Math.floor((x - d.width / 2) / scale + 64);
      const Y = Math.floor((y - d.height / 2) / scale + 32);

      let r = 0, g = 0, b = 2;

      const star = hash(X * 71 + Y * 137);
      if (star > 0.995) {
        const glow = p.stars * (20 + 30 * Math.sin(p.t + star * 100));
        r = Math.max(0, glow);
        g = Math.max(0, glow);
        b = Math.max(0, glow * 1.3);
      }

      let ink = false;

      for (let i = 0; i < p.aliens.length; i++) {
        const a = p.aliens[i];
        if (!a.alive) continue;

        const ax = p.offset + a.col * 16;
        const ay = 10 + a.row * 10 + p.drop;
        const sprite = a.row === 0 ? SQUID[anim] : ALIENS[anim];
        const inset = a.row === 0 ? 1 : 0;

        if (pixel(sprite, X - ax - inset, Y - ay)) ink = true;
      }

      for (let i = 0; i < p.shields.length; i++) {
        const s = p.shields[i];
        const sx = X - s.x;
        const sy = Y - s.y;
        if (
          sx >= 0 && sx < 14 && sy >= 0 && sy < 6 &&
          s.cells[sy * 14 + sx]
        ) ink = true;
      }

      const shipVisible = p.hurt === 0 ||
        Math.floor(p.t * 12) % 2 === 0;

      if (shipVisible && pixel(SHIP, X - Math.floor(p.shipX), Y - 55)) {
        ink = true;
      }

      if (ink) {
        r = 20 + cr * 220;
        g = 20 + cg * 220;
        b = 20 + cb * 220;
      }

      if (Y === 62) {
        r = cr * 75;
        g = cg * 75;
        b = cb * 75;
      }

      if (pixel(UFO, X - Math.floor(ufoX), Y - 1)) {
        r = 245; g = 55; b = 65;
      }

      for (let i = 0; i < p.playerShots.length; i++) {
        const shot = p.playerShots[i];
        if (X === Math.floor(shot.x) && Math.abs(Y - shot.y) < 2) {
          r = 225; g = 255; b = 220;
        }
      }

      for (let i = 0; i < p.enemyShots.length; i++) {
        const shot = p.enemyShots[i];
        const zig = Math.floor(p.t * 12 + Y) % 2;
        if (
          X === Math.floor(shot.x) + zig &&
          Math.abs(Y - shot.y) < 2
        ) {
          r = 255; g = 95; b = 65;
        }
      }

      for (let i = 0; i < p.explosions.length; i++) {
        const e = p.explosions[i];
        const dx = X - e.x;
        const dy = Y - e.y;
        const radius = Math.sqrt(dx * dx + dy * dy);
        const ring = (0.6 - e.life) * 12;
        const spoke = Math.abs(Math.sin(Math.atan2(dy, dx) * 4));

        if (Math.abs(radius - ring) < 1.2 && spoke < 0.6) {
          r = 255; g = 220; b = 120;
        }
      }

      d.setPixel(x, y,
        Math.max(0, Math.min(255, r)),
        Math.max(0, Math.min(255, g)),
        Math.max(0, Math.min(255, b)));
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
