// ===== Patternflow pattern =====
// Title:    Tetris
// Author:   @akacoda
// Date:     2026-08-06
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// ===== Patternflow pattern =====
// Title:   Tetris Portrait
// @knobs Move=0..1, DropUnused=0..1, Rotate=0..1, MoveKnob=0..1
//
// Physical map (board labels):
//   Knob 4 [index 3]: turn = move L/R, click = hard drop
//   Knob 3 [index 2]: turn = rotate (direction = turn direction)
//   Knobs 1 & 2 [0,1]: click/hold ~0.8s = reset (in Lab, click also resets)

const COLS = 10, ROWS = 20, CELL = 4;
const BOARD_W = COLS * CELL, BOARD_H = ROWS * CELL;
const OX = 12, OY = 24;
const VW = 64, VH = 128;

const SHAPES = [
  [[0,0,0,0,1,1,1,1,0,0,0,0,0,0,0,0],[0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0],[0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,0],[0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0]],
  [[0,1,1,0,0,1,1,0,0,0,0,0,0,0,0,0],[0,1,1,0,0,1,1,0,0,0,0,0,0,0,0,0],[0,1,1,0,0,1,1,0,0,0,0,0,0,0,0,0],[0,1,1,0,0,1,1,0,0,0,0,0,0,0,0,0]],
  [[0,1,0,0,1,1,1,0,0,0,0,0,0,0,0,0],[0,1,0,0,0,1,1,0,0,1,0,0,0,0,0,0],[0,0,0,0,1,1,1,0,0,1,0,0,0,0,0,0],[0,1,0,0,1,1,0,0,0,1,0,0,0,0,0,0]],
  [[0,1,1,0,1,1,0,0,0,0,0,0,0,0,0,0],[0,1,0,0,0,1,1,0,0,0,1,0,0,0,0,0],[0,0,0,0,0,1,1,0,1,1,0,0,0,0,0,0],[1,0,0,0,1,1,0,0,0,1,0,0,0,0,0,0]],
  [[1,1,0,0,0,1,1,0,0,0,0,0,0,0,0,0],[0,0,1,0,0,1,1,0,0,1,0,0,0,0,0,0],[0,0,0,0,1,1,0,0,0,1,1,0,0,0,0,0],[0,1,0,0,1,1,0,0,1,0,0,0,0,0,0,0]],
  [[1,0,0,0,1,1,1,0,0,0,0,0,0,0,0,0],[0,1,1,0,0,1,0,0,0,1,0,0,0,0,0,0],[0,0,0,0,1,1,1,0,0,0,1,0,0,0,0,0],[0,1,0,0,0,1,0,0,1,1,0,0,0,0,0,0]],
  [[0,0,1,0,1,1,1,0,0,0,0,0,0,0,0,0],[0,1,0,0,0,1,0,0,0,1,1,0,0,0,0,0],[0,0,0,0,1,1,1,0,1,0,0,0,0,0,0,0],[1,1,0,0,0,1,0,0,0,1,0,0,0,0,0,0]]
];

const TYPE_RGB = [
  [0,0,0],
  [0,240,240], [240,240,0], [160,0,240], [0,240,0],
  [240,0,0], [0,0,240], [240,160,0]
];

// 3x5 font: 0-9, S,C,O,R,E,:
const FONT3x5 = [
  [7,5,5,5,7],[2,6,2,2,7],[7,1,7,4,7],[7,1,7,1,7],[5,5,7,1,1],
  [7,4,7,1,7],[7,4,7,5,7],[7,1,1,1,1],[7,5,7,5,7],[7,5,7,1,7],
  [7,4,7,1,7],[7,4,4,4,7],[7,5,5,5,7],[6,5,6,5,5],[7,4,7,4,7],[0,2,0,2,0]
];

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function rnd(params) {
  params.rng = (params.rng * 48271) % 2147483647;
  if (params.rng <= 0) params.rng += 2147483647;
  return params.rng / 2147483647;
}

function shapeCell(type, rot, cx, cy) {
  return SHAPES[type][rot & 3][cy * 4 + cx];
}

function collides(params, type, rot, px, py) {
  for (let cy = 0; cy < 4; cy++) {
    for (let cx = 0; cx < 4; cx++) {
      if (!shapeCell(type, rot, cx, cy)) continue;
      const x = px + cx, y = py + cy;
      if (x < 0 || x >= COLS || y >= ROWS) return true;
      if (y >= 0 && params.grid[y * COLS + x]) return true;
    }
  }
  return false;
}

function lockPiece(params) {
  for (let cy = 0; cy < 4; cy++) {
    for (let cx = 0; cx < 4; cx++) {
      if (!shapeCell(params.pType, params.pRot, cx, cy)) continue;
      const x = params.pX + cx, y = params.pY + cy;
      if (y >= 0 && y < ROWS && x >= 0 && x < COLS) {
        params.grid[y * COLS + x] = params.pType + 1;
      }
    }
  }
}

function clearLines(params) {
  let cleared = 0;
  for (let y = ROWS - 1; y >= 0; y--) {
    let full = true;
    for (let x = 0; x < COLS; x++) {
      if (!params.grid[y * COLS + x]) { full = false; break; }
    }
    if (full) {
      cleared++;
      for (let yy = y; yy > 0; yy--) {
        for (let x = 0; x < COLS; x++) {
          params.grid[yy * COLS + x] = params.grid[(yy - 1) * COLS + x];
        }
      }
      for (let x = 0; x < COLS; x++) params.grid[x] = 0;
      y++;
    }
  }
  if (cleared) {
    const scores = [0, 100, 300, 500, 800];
    params.score += cleared;  // +1 per cleared line
    params.lines += cleared;
    params.level = Math.floor(params.lines / 10) + params.startLevel;
    params.flash = 1.0;
  }
}

function nextType(params) {
  if (params.bagN <= 0) {
    for (let i = 0; i < 7; i++) params.bag[i] = i;
    for (let i = 6; i > 0; i--) {
      const j = Math.floor(rnd(params) * (i + 1));
      const tmp = params.bag[i]; params.bag[i] = params.bag[j]; params.bag[j] = tmp;
    }
    params.bagN = 7;
  }
  return params.bag[--params.bagN];
}

function spawn(params) {
  params.pType = params.nextPiece;
  params.nextPiece = nextType(params);
  params.pRot = 0;
  params.pX = 3;
  params.pY = -1;
  params.fallT = 0;
  params.lockT = 0;
  if (collides(params, params.pType, params.pRot, params.pX, params.pY)) {
    params.gameOver = 1;
  }
}

function hardDropY(params) {
  let y = params.pY;
  while (!collides(params, params.pType, params.pRot, params.pX, y + 1)) y++;
  return y;
}

function tryMove(params, dx, dy) {
  if (!collides(params, params.pType, params.pRot, params.pX + dx, params.pY + dy)) {
    params.pX += dx; params.pY += dy; params.lockT = 0;
    return true;
  }
  return false;
}

function tryRot(params, dir) {
  const nr = (params.pRot + dir + 4) & 3;
  const kicks = [0, -1, 1, -2, 2];
  for (let i = 0; i < kicks.length; i++) {
    const kx = kicks[i];
    if (!collides(params, params.pType, nr, params.pX + kx, params.pY)) {
      params.pRot = nr; params.pX += kx; params.lockT = 0;
      return true;
    }
  }
  return false;
}

function resetGame(params) {
  params.grid.fill(0);
  params.score = 0;
  params.lines = 0;
  params.level = params.startLevel;
  params.gameOver = 0;
  params.bagN = 0;
  params.nextPiece = nextType(params);
  spawn(params);
  params.flash = 1.0;
  params.resetHoldT = 0;
}

function gravityInterval(params) {
  const base = Math.max(0.08, 0.75 - (params.level - 1) * 0.04);
  return base / Math.max(0.3, params.gravityMul);
}

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

function getDeltas(input, params) {
  const d = [0, 0, 0, 0];
  if (input && input.knobDeltas) {
    for (let i = 0; i < 4; i++) d[i] = input.knobDeltas[i] || 0;
    return d;
  }
  // Lab fallback: derive from absolute knobValues
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
  if (Math.abs(delta) < 0.1) return 0;
  return Math.max(1, Math.floor(Math.abs(delta) + 0.5));
}

export function setup(params) {
  params.grid = new Uint8Array(COLS * ROWS);
  params.bag = new Uint8Array(7);
  params.bagN = 0;
  params.rng = 12345;

  params.startLevel = 1;
  params.gravityMul = 0.8;
  params.ghostK = 0.7;

  params.score = 0;
  params.lines = 0;
  params.level = 1;
  params.gameOver = 0;

  params.fallT = 0;
  params.lockT = 0;
  params.flash = 0;
  params.t = 0;
  params.resetHoldT = 0;

  params.nextPiece = 0;
  resetGame(params);
}

export function update(dt, input, params) {
  const d = getDeltas(input, params);

  // Knobs 1 & 2: hold to reset (Lab: click also resets)
  let resetHeld = false;
  if (input && input.btnDown) {
    resetHeld = !!(input.btnDown[0] || input.btnDown[1]);
  }
  if (input && input.btnPressed && (input.btnPressed[0] || input.btnPressed[1])) {
    // easier testing in Pattern Lab
    resetGame(params);
    return;
  }
  if (resetHeld) {
    params.resetHoldT += dt;
    if (params.resetHoldT >= 0.8) {
      resetGame(params);
      params.resetHoldT = 0;
      return;
    }
  } else {
    params.resetHoldT = 0;
  }

  if (params.gameOver) {
    params.flash = Math.max(0, params.flash - dt * 2);
    params.t += dt;
    return;
  }

  // Knob 4 [3]: move
  if (d[3] < -0.1) {
    for (let i = 0; i < ticks(d[3]); i++) tryMove(params, -1, 0);
  } else if (d[3] > 0.1) {
    for (let i = 0; i < ticks(d[3]); i++) tryMove(params, 1, 0);
  }

  // Knob 3 [2]: rotate
  if (d[2] < -0.1) {
    for (let i = 0; i < ticks(d[2]); i++) tryRot(params, -1);
  } else if (d[2] > 0.1) {
    for (let i = 0; i < ticks(d[2]); i++) tryRot(params, 1);
  }

  // Knob 4 click: hard drop
  if (input && input.btnPressed && input.btnPressed[3]) {
    params.pY = hardDropY(params);
    lockPiece(params);
    clearLines(params);
    spawn(params);
    params.flash = Math.max(params.flash, 0.6);
  }

  // gravity
  params.fallT += dt;
  const interval = gravityInterval(params);
  while (params.fallT >= interval) {
    params.fallT -= interval;
    if (!tryMove(params, 0, 1)) {
      params.lockT += interval;
      if (params.lockT > 0.45) {
        lockPiece(params);
        clearLines(params);
        spawn(params);
      }
      break;
    } else {
      params.lockT = 0;
    }
  }

  params.flash = Math.max(0, params.flash - dt * 2.5);
  params.t += dt;
}

export function draw(display, params, time) {
  const W = display.width, H = display.height;
  const portrait = W < H;
  const ghostY = hardDropY(params);

  const setUV = (u, v, r, g, b) => {
    let x, y;
    if (portrait) { x = u; y = v; }
    else { x = W - 1 - v; y = u; }
    if (x >= 0 && x < W && y >= 0 && y < H) {
      if (display.setPixel) display.setPixel(x, y, r|0, g|0, b|0);
      else if (display.setValue) display.setValue(x, y, Math.max(r, g, b) / 255);
    }
  };

  const scaleRgb = (c, mul) => clamp(Math.floor(c * mul), 0, 255);

  const paintType = (type, rot, px, py, mul) => {
    const base = TYPE_RGB[type + 1];
    for (let cy = 0; cy < 4; cy++) {
      for (let cx = 0; cx < 4; cx++) {
        if (!shapeCell(type, rot, cx, cy)) continue;
        const bx = px + cx, by = py + cy;
        if (by < 0) continue;
        for (let ly = 0; ly < CELL; ly++) {
          for (let lx = 0; lx < CELL; lx++) {
            const border = (lx === 0 || ly === 0);
            const m = mul * (border ? 0.55 : 1);
            setUV(OX + bx * CELL + lx, OY + by * CELL + ly,
              scaleRgb(base[0], m), scaleRgb(base[1], m), scaleRgb(base[2], m));
          }
        }
      }
    }
  };

  // background + board
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let u, v;
      if (portrait) { u = x; v = y; }
      else { u = y; v = W - 1 - x; }

      let r = 4, g = 6, b = 14;
      if (((v + u) & 1) === 0) { r = 6; g = 8; b = 18; }
      if (params.flash > 0) {
        r = clamp(r + params.flash * 40, 0, 255);
        g = clamp(g + params.flash * 40, 0, 255);
        b = clamp(b + params.flash * 50, 0, 255);
      }

      if (u >= OX - 2 && u < OX + BOARD_W + 2 && v >= OY - 2 && v < OY + BOARD_H + 2) {
        const inside = u >= OX && u < OX + BOARD_W && v >= OY && v < OY + BOARD_H;
        if (!inside) { r = 40; g = 48; b = 70; }
      }

      if (u >= OX && u < OX + BOARD_W && v >= OY && v < OY + BOARD_H) {
        const cx = Math.floor((u - OX) / CELL);
        const cy = Math.floor((v - OY) / CELL);
        const id = params.grid[cy * COLS + cx];
        if (id) {
          const lu = (u - OX) % CELL, lv = (v - OY) % CELL;
          const border = (lu === 0 || lv === 0);
          const m = border ? 0.55 : 1;
          r = scaleRgb(TYPE_RGB[id][0], m);
          g = scaleRgb(TYPE_RGB[id][1], m);
          b = scaleRgb(TYPE_RGB[id][2], m);
        } else {
          r = 8; g = 10; b = 22;
        }
      }

      if (display.setPixel) display.setPixel(x, y, r|0, g|0, b|0);
      else if (display.setValue) display.setValue(x, y, Math.max(r, g, b) / 255);
    }
  }

  if (!params.gameOver && params.ghostK > 0.05) {
    paintType(params.pType, params.pRot, params.pX, ghostY, 0.15 + params.ghostK * 0.35);
  }
  if (!params.gameOver) {
    paintType(params.pType, params.pRot, params.pX, params.pY, 1);
  }

  // NEXT preview
  for (let cy = 0; cy < 4; cy++) {
    for (let cx = 0; cx < 4; cx++) {
      if (!shapeCell(params.nextPiece, 0, cx, cy)) continue;
      const rgb = TYPE_RGB[params.nextPiece + 1];
      setUV(2 + cx * 2, 4 + cy * 2, rgb[0], rgb[1], rgb[2]);
    }
  }

  // SCORE text
  const label = "SCORE:" + String(params.score|0);
  const scale = 1;
  const textW = label.length * (3 * scale + scale) - scale;
  let tu = OX + Math.floor((BOARD_W - textW) / 2);
  const tv = OY + BOARD_H + 4;
  for (let i = 0; i < label.length; i++) {
    const idx = fontIndex(label[i]);
    if (idx >= 0) {
      for (let row = 0; row < 5; row++) {
        const bits = FONT3x5[idx][row];
        for (let col = 0; col < 3; col++) {
          if (bits & (1 << (2 - col))) {
            setUV(tu + col, tv + row, 180, 220, 255);
          }
        }
      }
    }
    tu += 3 * scale + scale;
  }

  if (params.gameOver) {
    const pulse = 0.4 + 0.4 * Math.sin(params.t * 6);
    const rr = (255 * pulse) | 0;
    for (let x = OX; x < OX + BOARD_W; x++) {
      setUV(x, OY + (BOARD_H / 2) | 0, rr, 40, 40);
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
