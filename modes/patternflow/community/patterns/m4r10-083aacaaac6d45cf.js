// ===== Patternflow pattern =====
// Title:    M4R10
// Author:   @stillkingz
// Date:     2026-09-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @knobs Speed=0.2..2, Jump=0..1, Coins=0..1, Time=0..1
// @matrix 128x128
// MARIO — AUTO PLAY


const MARIO = [
  ".....RRRRR......",
  "....RRRRRRRRR...",
  "....HHHSSK......",
  "...HSHSSSKSS....",
  "...HSHHSSSKSS...",
  "....HSSSSKKKK...",
  ".....SSSSSS.....",
  "....RRBRR.......",
  "...RRRBRRBRRR...",
  "..RRRRBBBBRRRR..",
  "..SSRBYYBYBRSS..",
  "..SSSBBBBBBSSS..",
  "....BBBBBBBB....",
  "....BBB..BBB....",
  "...HHH....HHH...",
  "..HHHH....HHHH.."
];

const GOOMBA = [
  "....HHHH....",
  "...HHHHHH...",
  "..HHHHHHHH..",
  ".HHHHHHHHHH.",
  "HHWKH H KWHH",
  "HHWKKHHKKWHH",
  "HHHHHHHHHHHH",
  "..SSSSSSSS..",
  "...SSSSSS...",
  "..KKK.KKK...",
  ".KKKK.KKKK.."
];

const QUESTION = [
  "01110",
  "11011",
  "00011",
  "00110",
  "00100",
  "00000",
  "00100"
];

function clamp(v) {
  return Math.max(0, Math.min(255, v));
}

function mod(a, b) {
  return ((a % b) + b) % b;
}

export function setup(p) {
  p.t = 0;
  p.world = 0;
  p.speed = 1;
  p.jump = 0.5;
  p.coins = 0.6;
  p.night = 0;
  p.paused = false;
  p.extra = 0;
  p.burst = 0;
}

export function update(dt, input, p) {
  if (input && input.knobValues) {
    p.speed = input.knobValues[0];
    p.jump = input.knobValues[1];
    p.coins = input.knobValues[2];
    p.night = input.knobValues[3];
  }

  if (input && input.btnPressed) {
    if (input.btnPressed[0]) p.paused = !p.paused;
    if (input.btnPressed[1]) p.extra = 0.001;
    if (input.btnPressed[2]) p.burst = 1;
    if (input.btnPressed[3]) {
      p.world = 0;
      p.t = 0;
      p.extra = 0;
      p.burst = 0;
    }
  }

  if (!p.paused) {
    p.t += dt;
    p.world += dt * p.speed * 19;

    if (p.extra > 0) {
      p.extra += dt * 1.5;
      if (p.extra >= 1) p.extra = 0;
    }

    p.burst = Math.max(0, p.burst - dt * 0.65);
  }
}

export function draw(d, p, time) {
  const scale = Math.min(d.width / 128, d.height / 64);
  const ground = 53;
  const marioX = 33;

  // Obstacles repeat every 120 world pixels.
  const playerWorld = p.world + marioX + 8;
  const phase = mod(playerWorld, 120);

  // Mario automatically jumps across each pipe.
  const pipeDelta = phase - 74;
  let jumpHeight = 0;

  if (pipeDelta > -27 && pipeDelta < 27) {
    jumpHeight = Math.sin(
      (pipeDelta + 27) / 54 * Math.PI
    ) * (23 + p.jump * 5);
  }

  // A second jump hits the question block.
  const blockDelta = phase - 20;
  if (blockDelta > -17 && blockDelta < 17) {
    jumpHeight = Math.max(
      jumpHeight,
      Math.sin((blockDelta + 17) / 34 * Math.PI) * 15
    );
  }

  if (p.extra > 0) {
    jumpHeight = Math.max(
      jumpHeight,
      Math.sin(p.extra * Math.PI) * (24 + p.jump * 8)
    );
  }

  const marioY = ground - 16 - Math.floor(jumpHeight);
  const runningFrame = Math.floor(p.world / 3) % 2;
  const airborne = jumpHeight > 2;

  for (let y = 0; y < d.height; y++) {
    for (let x = 0; x < d.width; x++) {
      const X = Math.floor((x - d.width / 2) / scale + 64);
      const Y = Math.floor((y - d.height / 2) / scale + 32);
      const wx = X + p.world;

      // Sky changes continuously from day to night.
      let r = 85 - p.night * 78;
      let g = 165 - p.night * 153;
      let b = 245 - p.night * 211;

      // Tiny stars appear at night.
      const starX = mod(Math.floor(X + p.world * 0.06), 37);
      const starY = mod(Y, 19);

      if (
        p.night > 0.35 &&
        ((starX === 7 && starY === 5) ||
         (starX === 24 && starY === 12)) &&
        Y < 32
      ) {
        const light = p.night * 190;
        r += light;
        g += light;
        b += light;
      }

      // Clouds scroll slowly for parallax.
      const cloudX = mod(X + p.world * 0.17, 105);
      const cloud =
        (cloudX > 12 && cloudX < 39 && Y >= 10 && Y < 15) ||
        (cloudX > 18 && cloudX < 32 && Y >= 6 && Y < 15);

      if (cloud) {
        r = 250 - p.night * 160;
        g = 250 - p.night * 155;
        b = 242 - p.night * 135;
      }

      // Background hills scroll more slowly than the ground.
      const hillX = mod(X + p.world * 0.3, 90) - 45;
      if (
        hillX * hillX / 900 +
        (Y - ground) * (Y - ground) / 400 < 1 &&
        Y < ground
      ) {
        r = 39 - p.night * 20;
        g = 158 - p.night * 85;
        b = 65 - p.night * 23;
      }

      // Brick floor.
      if (Y >= ground) {
        const row = Math.floor((Y - ground) / 5);
        const mortar =
          mod(Y - ground, 5) === 0 ||
          mod(Math.floor(wx) + (row % 2) * 6, 12) === 0;

        r = mortar ? 94 : 189;
        g = mortar ? 43 : 90;
        b = mortar ? 25 : 43;

        if (Y === ground) {
          r = 246;
          g = 170;
          b = 90;
        }
      }

      const tile = mod(wx, 120);
      const section = Math.floor(wx / 120);

      // Pipe.
      if (tile >= 66 && tile < 83 && Y >= 39 && Y < ground) {
        const u = tile - 66;
        r = 17; g = 146; b = 37;

        if (u > 2 && u < 6) {
          r = 119; g = 234; b = 78;
        } else if (u >= 6 && u < 13) {
          r = 42; g = 187; b = 42;
        }

        if (u < 1 || u > 15) {
          r = 8; g = 75; b = 22;
        }
      }

      if (tile >= 63 && tile < 86 && Y >= 35 && Y < 41) {
        r = 35; g = 182; b = 42;

        if (tile < 64 || tile >= 85 || Y === 35 || Y === 40) {
          r = 8; g = 76; b = 22;
        } else if (tile < 70) {
          r = 123; g = 241; b = 85;
        }
      }

      // Question block reacts as Mario jumps beneath it.
      const blockCenter = section * 120 + 20;
      const passed = playerWorld - blockCenter;
      const hit = passed > -3;
      const bump = passed > -3 && passed < 7
        ? Math.sin((passed + 3) / 10 * Math.PI) * 3
        : 0;
      const blockTop = 18 - Math.floor(bump);

      if (
        tile >= 13 && tile < 27 &&
        Y >= blockTop && Y < blockTop + 14
      ) {
        const u = Math.floor(tile - 13);
        const v = Y - blockTop;

        r = hit ? 157 : 246;
        g = hit ? 92 : 174;
        b = hit ? 48 : 31;

        if (u === 0 || u === 13 || v === 13) {
          r = 105; g = 56; b = 23;
        }

        if (v === 0) {
          r = hit ? 193 : 255;
          g = hit ? 125 : 226;
          b = hit ? 70 : 120;
        }

        const qx = u - 4;
        const qy = v - 3;

        if (
          !hit && qx >= 0 && qx < 5 &&
          qy >= 0 && qy < 7 &&
          QUESTION[qy][qx] === "1"
        ) {
          r = 255; g = 248; b = 193;
        }
      }

      // Coin pops out of the struck block.
      if (passed > -3 && passed < 21) {
        const progress = (passed + 3) / 24;
        const coinY = 13 - Math.sin(progress * Math.PI) * 10;
        const coinX = tile - 20;
        const width = 0.8 + Math.abs(Math.cos(p.t * 10)) * 2;

        if (
          coinX * coinX / (width * width) +
          (Y - coinY) * (Y - coinY) / 12 < 1
        ) {
          r = 255; g = 225; b = 65;
        }
      }

      // Collectible coins trace the jump over the pipe.
      for (let i = 0; i < 5; i++) {
        if (i > Math.floor(p.coins * 4)) continue;

        const coinWorld = section * 120 + 53 + i * 11;
        const coinScreen = coinWorld - p.world;
        const coinY = 25 - Math.sin(i / 4 * Math.PI) * 9;
        const collected = playerWorld > coinWorld + 2;

        if (!collected) {
          const width = 0.7 + 1.6 *
            Math.abs(Math.cos(p.t * 5 + i));
          const dx = X - coinScreen;
          const dy = Y - coinY;

          if (dx * dx / (width * width) + dy * dy / 10 < 1) {
            r = 255; g = 210; b = 35;
            if (Math.abs(dx) < 0.6) {
              r = 255; g = 249; b = 164;
            }
          }
        }
      }

      // Goomba waits just beyond the pipe.
      const enemyCenter = section * 120 + 93;
      const enemyPassed = playerWorld - enemyCenter;
      const enemyX = enemyCenter - p.world - 6;
      const ex = Math.floor(X - enemyX);
      const stomped = enemyPassed > -2;

      if (stomped && enemyPassed < 12) {
        if (ex >= 0 && ex < 12 && Y >= 50 && Y < ground) {
          r = 132; g = 74; b = 35;
        }
      } else if (!stomped) {
        const ey = Y - (ground - 11);
        if (ex >= 0 && ex < 12 && ey >= 0 && ey < 11) {
          const pixel = GOOMBA[ey][ex];

          if (pixel === "H") {
            r = 143; g = 77; b = 35;
          } else if (pixel === "S") {
            r = 238; g = 194; b = 133;
          } else if (pixel === "W") {
            r = 255; g = 247; b = 218;
          } else if (pixel === "K") {
            r = 29; g = 20; b = 17;
          }
        }
      }

      // Mario, drawn last so he stays in front.
      let mx = X - marioX;
      const my = Y - marioY;

      // Animate the legs while running.
      if (my >= 13 && !airborne && runningFrame === 1) {
        mx += my === 15 ? 2 : -1;
      }

      if (mx >= 0 && mx < 16 && my >= 0 && my < 16) {
        const pixel = MARIO[my][mx];

        if (pixel === "R") {
          r = 238; g = 44; b = 39;
        } else if (pixel === "B") {
          r = 35; g = 75; b = 208;
        } else if (pixel === "S") {
          r = 255; g = 191; b = 133;
        } else if (pixel === "H") {
          r = 100; g = 48; b = 24;
        } else if (pixel === "K") {
          r = 25; g = 19; b = 17;
        } else if (pixel === "Y") {
          r = 255; g = 224; b = 60;
        }
      }

      // Button-triggered coin sparkle burst.
      if (p.burst > 0) {
        for (let i = 0; i < 8; i++) {
          const angle = i * Math.PI / 4;
          const radius = (1 - p.burst) * 29;
          const px = marioX + 8 + Math.cos(angle) * radius;
          const py = marioY + 6 + Math.sin(angle) * radius;
          const dx = Math.abs(X - px);
          const dy = Math.abs(Y - py);

          if ((dx < 0.8 && dy < 2) || (dy < 0.8 && dx < 2)) {
            r = 255;
            g = 225;
            b = 90;
          }
        }
      }

      d.setPixel(x, y, clamp(r), clamp(g), clamp(b));
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
