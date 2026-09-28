// ===== Patternflow pattern =====
// Title:    Space Invaders
// Author:   @akacoda
// Date:     2026-08-12
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp linear 0:#000000 1:#ffffff
// @knobs Unused1=0..1, Unused2=0..1, Unused3=0..1, Move=0..1
// @matrix 128x128
// ===== Patternflow pattern =====
// Title:   Space Invaders Portrait

//
// Knob 4 [3]: turn = move, click = shoot
// Knobs 1 & 2 [0,1]: click = restart
const VW = 64, VH = 128;
const OX = 4, OY = 16;          // playfield inset
const FIELD_W = 56, FIELD_H = 100;
const COLS = 6, ROWS = 4;
const INV_W = 6, INV_H = 4;
const INV_GAP_X = 2, INV_GAP_Y = 3;
const SHIP_W = 7, SHIP_H = 4;
const SHIP_Y = OY + FIELD_H - 8;
const BUNKER_Y = SHIP_Y - 14;
const BUNKER_COUNT = 3;
const BUNKER_W = 10, BUNKER_H = 6;
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function rnd(params) {
  params.rng = (params.rng * 48271) % 2147483647;
  if (params.rng <= 0) params.rng += 2147483647;
  return params.rng / 2147483647;
}
function getDeltas(input, params) {
  const d = [0, 0, 0, 0];
  if (input && input.knobDeltas) {
    for (let i = 0; i < 4; i++) d[i] = input.knobDeltas[i] || 0;
    return d;
  }
  if (input && input.knobValues) {
    if (!params._lastKnob) params._lastKnob = [0, 0, 0, 0];
    for (let i = 0; i < 4; i++) {
      const v = input.knobValues[i] || 0;
      d[i] = v - params._lastKnob[i];
      params._lastKnob[i] = v;
    }
  }
  return d;
}
function ticks(delta) {
  if (Math.abs(delta) < 0.12) return 0;
  return Math.max(1, Math.floor(Math.abs(delta) + 0.5));
}
// tiny 3x5 digits + SCORE:
const FONT3x5 = [
  [7,5,5,5,7],[2,6,2,2,7],[7,1,7,4,7],[7,1,7,1,7],[5,5,7,1,1],
  [7,4,7,1,7],[7,4,7,5,7],[7,1,1,1,1],[7,5,7,5,7],[7,5,7,1,7],
  [7,4,7,1,7],[7,4,4,4,7],[7,5,5,5,7],[6,5,6,5,5],[7,4,7,4,7],[0,2,0,2,0]
];
function fontIndex(c) {
  if (c >= "0" && c <= "9") return c.charCodeAt(0) - 48;
  if (c === "S") return 10;
  if (c === "C") return 11;
  if (c === "O") return 12;
  if (c === "R") return 13;
  if (c === "E") return 14;
  if (c === ":") return 15;
  return -1;
}
function invaderPixel(rowType, lx, ly) {
  // 6x4 silhouettes, 3 ranks
  const A = [ // squid-ish
    [0,1,1,1,1,0],
    [1,1,1,1,1,1],
    [1,0,1,1,0,1],
    [0,1,0,0,1,0]
  ];
  const B = [ // crab
    [0,1,0,0,1,0],
    [1,1,1,1,1,1],
    [1,0,1,1,0,1],
    [1,0,0,0,0,1]
  ];
  const C = [ // octopus
    [0,0,1,1,0,0],
    [0,1,1,1,1,0],
    [1,1,1,1,1,1],
    [1,0,1,1,0,1]
  ];
  const g = rowType === 0 ? A : (rowType === 1 ? B : C);
  return g[ly][lx];
}
function resetWave(params) {
  params.inv = [];
  const gridW = COLS * (INV_W + INV_GAP_X) - INV_GAP_X;
  const startX = OX + Math.floor((FIELD_W - gridW) / 2);
  const startY = OY + 6;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      params.inv.push({
        x: startX + c * (INV_W + INV_GAP_X),
        y: startY + r * (INV_H + INV_GAP_Y),
        alive: 1,
        rank: r < 1 ? 0 : (r < 3 ? 1 : 2)
      });
    }
  }
  params.invDir = 1;
  params.invStepT = 0;
  params.invStepEvery = 0.55;
  params.dropNext = 0;
}
function resetBunkers(params) {
  params.bunkers = new Uint8Array(BUNKER_COUNT * BUNKER_W * BUNKER_H);
  for (let i = 0; i < params.bunkers.length; i++) params.bunkers[i] = 1;
}
function bunkerIndex(b, lx, ly) {
  return b * BUNKER_W * BUNKER_H + ly * BUNKER_W + lx;
}

function bunkerX(b) {
  // 3 bunkers fully inside OX .. OX+FIELD_W
  const margin = 3;
  const usable = FIELD_W - margin * 2 - BUNKER_W;
  return OX + margin + Math.floor(b * usable / (BUNKER_COUNT - 1));
}
function resetGame(params) {
  params.score = 0;
  params.lives = 3;
  params.wave = 1;
  params.gameOver = 0;
  params.won = 0;
  params.shipX = OX + FIELD_W * 0.5;
  params.coolT = 0;
  params.flash = 0;
  params.t = 0;
  params.bullets = [];   // {x,y,dy,friendly}
  params.alienShotT = 0;
  resetWave(params);
  resetBunkers(params);
}
function aliveCount(params) {
  let n = 0;
  for (let i = 0; i < params.inv.length; i++) if (params.inv[i].alive) n++;
  return n;
}
function boundsAlive(params) {
  let minX = 999, maxX = -999, maxY = -999;
  for (let i = 0; i < params.inv.length; i++) {
    const inv = params.inv[i];
    if (!inv.alive) continue;
    if (inv.x < minX) minX = inv.x;
    if (inv.x + INV_W > maxX) maxX = inv.x + INV_W;
    if (inv.y + INV_H > maxY) maxY = inv.y + INV_H;
  }
  return { minX, maxX, maxY };
}
function hitBunker(params, x, y) {
  const ix = x | 0, iy = y | 0;
  for (let b = 0; b < BUNKER_COUNT; b++) {
    const bx = bunkerX(b);
    if (ix >= bx && ix < bx + BUNKER_W && iy >= BUNKER_Y && iy < BUNKER_Y + BUNKER_H) {
      const lx = ix - bx, ly = iy - BUNKER_Y;
      const idx = bunkerIndex(b, lx, ly);
      if (params.bunkers[idx]) {
        params.bunkers[idx] = 0;
        // chew a little extra
        if (lx + 1 < BUNKER_W) params.bunkers[bunkerIndex(b, lx + 1, ly)] = 0;
        if (ly + 1 < BUNKER_H) params.bunkers[bunkerIndex(b, lx, ly + 1)] = 0;
        return true;
      }
    }
  }
  return false;
}
function killPlayer(params) {
  params.lives -= 1;
  params.flash = 1;
  params.bullets = params.bullets.filter(b => !b.friendly);
  params.shipX = OX + FIELD_W * 0.5;
  params.coolT = 0.6;
  if (params.lives <= 0) params.gameOver = 1;
}
export function setup(params) {
  params.rng = 12345;
  params._lastKnob = [0, 0, 0, 0];
  resetGame(params);
}
export function update(dt, input, params) {
  // restart
  if (input && input.btnPressed && (input.btnPressed[0] || input.btnPressed[1])) {
    resetGame(params);
    return;
  }
  params.t += dt;
  params.flash = Math.max(0, params.flash - dt * 2.5);
  params.coolT = Math.max(0, params.coolT - dt);
  if (params.gameOver || params.won) return;
  const d = getDeltas(input, params);
  // Knob 4: move
  const step = 18; // px/s feel via ticks
  if (d[3] < -0.1) params.shipX -= ticks(d[3]) * 2;
  if (d[3] > 0.1) params.shipX += ticks(d[3]) * 2;
  // also allow continuous-ish from large absolute knobs: mild drift unused
  params.shipX = clamp(params.shipX, OX + SHIP_W * 0.5, OX + FIELD_W - SHIP_W * 0.5);
  // Knob 4 click: shoot
  if (input && input.btnPressed && input.btnPressed[3] && params.coolT <= 0) {
    let playerShots = 0;
    for (let i = 0; i < params.bullets.length; i++) if (params.bullets[i].friendly) playerShots++;
    if (playerShots < 1) {
      params.bullets.push({ x: params.shipX, y: SHIP_Y - 1, dy: -70, friendly: 1 });
      params.coolT = 0.22;
    }
  }
  // move invaders on a step timer (classic cadence)
  const alive = aliveCount(params);
  if (alive === 0) {
    params.wave += 1;
    params.won = 0;
    resetWave(params);
    params.invStepEvery = Math.max(0.18, 0.55 - params.wave * 0.06);
    params.flash = 0.8;
  } else {
    params.invStepEvery = Math.max(0.16, 0.55 - (COLS * ROWS - alive) * 0.012 - (params.wave - 1) * 0.05);
   params.invStepT += dt;
if (params.invStepT >= params.invStepEvery) {
  params.invStepT = 0;
  const b = boundsAlive(params);
  const step = 2;
  // exclusive right edge of playfield interior; sprite uses [x, x+INV_W)
  const leftLimit = OX;
  const rightLimit = OX + FIELD_W;
  let doDrop = false;
  if (params.invDir > 0 && b.maxX + step > rightLimit) doDrop = true;
  if (params.invDir < 0 && b.minX - step < leftLimit) doDrop = true;
  for (let i = 0; i < params.inv.length; i++) {
    if (!params.inv[i].alive) continue;
    if (doDrop) params.inv[i].y += 3;
    else params.inv[i].x += params.invDir * step;
  }
  if (doDrop) params.invDir = -params.invDir;
  const b2 = boundsAlive(params);
  if (b2.maxY >= SHIP_Y - 2) {
    params.gameOver = 1;
    params.flash = 1;
  }

    }
  }
  // alien shooting
  params.alienShotT -= dt;
  if (params.alienShotT <= 0 && alive > 0) {
    params.alienShotT = 0.55 + rnd(params) * 0.7;
    // pick bottom-most alive in a random column
    const col = Math.floor(rnd(params) * COLS);
    let shooter = null;
    for (let r = ROWS - 1; r >= 0; r--) {
      const idx = r * COLS + col;
      if (params.inv[idx] && params.inv[idx].alive) { shooter = params.inv[idx]; break; }
    }
    if (!shooter) {
      for (let i = params.inv.length - 1; i >= 0; i--) {
        if (params.inv[i].alive) { shooter = params.inv[i]; break; }
      }
    }
    if (shooter) {
      params.bullets.push({
        x: shooter.x + INV_W * 0.5,
        y: shooter.y + INV_H,
        dy: 42 + params.wave * 3,
        friendly: 0
      });
    }
  }
  // bullets
  for (let i = params.bullets.length - 1; i >= 0; i--) {
    const b = params.bullets[i];
    b.y += b.dy * dt;
    const bx = b.x, by = b.y;
    if (by < OY - 2 || by > OY + FIELD_H + 4) {
      params.bullets.splice(i, 1);
      continue;
    }
    if (hitBunker(params, bx, by)) {
      params.bullets.splice(i, 1);
      continue;
    }
    if (b.friendly) {
      let hit = false;
      for (let j = 0; j < params.inv.length; j++) {
        const inv = params.inv[j];
        if (!inv.alive) continue;
        if (bx >= inv.x && bx < inv.x + INV_W && by >= inv.y && by < inv.y + INV_H) {
          inv.alive = 0;
          params.score += inv.rank === 0 ? 3 : (inv.rank === 1 ? 2 : 1);
          params.flash = Math.max(params.flash, 0.35);
          hit = true;
          break;
        }
      }
      if (hit) params.bullets.splice(i, 1);
    } else {
      // hit ship
      if (by >= SHIP_Y && by <= SHIP_Y + SHIP_H &&
          Math.abs(bx - params.shipX) < SHIP_W * 0.5) {
        params.bullets.splice(i, 1);
        killPlayer(params);
      }
    }
  }
}
export function draw(display, params, time) {
  const W = display.width, H = display.height;
  const portrait = W < H;
  const setUV = (u, v, r, g, b) => {
    let x, y;
    if (portrait) { x = u; y = v; }
    else { x = W - 1 - v; y = u; }
    if (x >= 0 && x < W && y >= 0 && y < H) {
      if (display.setPixel) display.setPixel(x, y, r|0, g|0, b|0);
      else if (display.setValue) display.setValue(x, y, Math.max(r, g, b) / 255);
    }
  };
  // background
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let u, v;
      if (portrait) { u = x; v = y; }
      else { u = y; v = W - 1 - x; }
      let r = 2, g = 2, b = 8;
      if ((u * 13 + v * 7) % 47 === 0) { r = 40; g = 40; b = 70; } // stars
      if (params.flash > 0) {
        r = clamp(r + params.flash * 50, 0, 255);
        g = clamp(g + params.flash * 30, 0, 255);
        b = clamp(b + params.flash * 30, 0, 255);
      }
      // playfield frame
      if (u >= OX - 1 && u <= OX + FIELD_W && v >= OY - 1 && v <= OY + FIELD_H) {
        if (u === OX - 1 || u === OX + FIELD_W || v === OY - 1 || v === OY + FIELD_H) {
          r = 30; g = 60; b = 40;
        }
      }
      if (display.setPixel) display.setPixel(x, y, r|0, g|0, b|0);
      else if (display.setValue) display.setValue(x, y, Math.max(r, g, b) / 255);
    }
  }
  // bunkers
  for (let bi = 0; bi < BUNKER_COUNT; bi++) {
    const bx = bunkerX(bi);
    for (let ly = 0; ly < BUNKER_H; ly++) {
      for (let lx = 0; lx < BUNKER_W; lx++) {
        if (!params.bunkers[bunkerIndex(bi, lx, ly)]) continue;
        // scalloped top
        if (ly === 0 && (lx < 2 || lx >= BUNKER_W - 2)) continue;
        if (ly >= BUNKER_H - 2 && lx >= 3 && lx <= 6) continue; // bay
        setUV(bx + lx, BUNKER_Y + ly, 40, 200, 70);
      }
    }
  }
  // invaders
  for (let i = 0; i < params.inv.length; i++) {
    const inv = params.inv[i];
    if (!inv.alive) continue;
    const rgb = inv.rank === 0 ? [255, 80, 180] : (inv.rank === 1 ? [80, 220, 255] : [120, 255, 120]);
    for (let ly = 0; ly < INV_H; ly++) {
      for (let lx = 0; lx < INV_W; lx++) {
        if (invaderPixel(inv.rank, lx, ly)) {
          setUV(inv.x + lx, inv.y + ly, rgb[0], rgb[1], rgb[2]);
        }
      }
    }
  }
  // ship
  if (!params.gameOver) {
    const sx = (params.shipX - SHIP_W * 0.5) | 0;
    for (let ly = 0; ly < SHIP_H; ly++) {
      for (let lx = 0; lx < SHIP_W; lx++) {
        const mid = Math.abs(lx - 3);
        if (ly === 0 && mid > 0) continue;
        if (ly === 1 && mid > 2) continue;
        setUV(sx + lx, SHIP_Y + ly, 240, 240, 80);
      }
    }
  }
  // bullets
  for (let i = 0; i < params.bullets.length; i++) {
    const b = params.bullets[i];
    if (b.friendly) setUV(b.x|0, b.y|0, 255, 255, 180);
    else {
      setUV(b.x|0, b.y|0, 255, 60, 60);
      setUV(b.x|0, (b.y|0) + 1, 255, 60, 60);
    }
  }
  // SCORE
  const label = "SCORE:" + String(params.score|0);
  let tu = OX;
  const tv = 4;
  for (let i = 0; i < label.length; i++) {
    const idx = fontIndex(label[i]);
    if (idx >= 0) {
      for (let row = 0; row < 5; row++) {
        const bits = FONT3x5[idx][row];
        for (let col = 0; col < 3; col++) {
          if (bits & (1 << (2 - col))) setUV(tu + col, tv + row, 180, 220, 255);
        }
      }
    }
    tu += 4;
  }
  // lives as small ships
  for (let i = 0; i < params.lives; i++) {
    const lx = OX + FIELD_W - 8 - i * 8;
    setUV(lx + 2, OY + FIELD_H + 4, 240, 240, 80);
    setUV(lx + 1, OY + FIELD_H + 5, 240, 240, 80);
    setUV(lx + 2, OY + FIELD_H + 5, 240, 240, 80);
    setUV(lx + 3, OY + FIELD_H + 5, 240, 240, 80);
  }
  if (params.gameOver) {
    const pulse = 0.4 + 0.4 * Math.sin(params.t * 6);
    const rr = (255 * pulse) | 0;
    for (let x = OX; x < OX + FIELD_W; x++) setUV(x, OY + FIELD_H * 0.5, rr, 40, 40);
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
