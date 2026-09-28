// ===== Patternflow pattern =====
// Title:    Colorful Star slacle
// Author:   @martinnlopez
// Date:     2026-08-10
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @knobs Symmetry=3..10, Speed=0.1..2, Pulse=1..15, HueShift=0..1
// @matrix 64x128

export function setup(params) {
  params.t = 0;
  params.k = [5, 0.5, 8, 0.5];
  params.buffer = null; // We will initialize this in draw()
}

export function update(dt, input, params) {
  params.k = input.knobValues;
  params.t += dt * params.k[1];
}

// Helper: HSL to RGB
function hslToRgb(h, s, l) {
  let r, g, b;
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1; if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  r = hue2rgb(p, q, h + 1/3);
  g = hue2rgb(p, q, h);
  b = hue2rgb(p, q, h - 1/3);
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// Custom Additive Line Drawing into our own buffer
function drawLineToBuffer(buffer, width, height, x1, y1, x2, y2, r, g, b) {
  x1 = Math.floor(x1); y1 = Math.floor(y1);
  x2 = Math.floor(x2); y2 = Math.floor(y2);
  
  let dx = Math.abs(x2 - x1), dy = Math.abs(y2 - y1);
  let sx = (x1 < x2) ? 1 : -1, sy = (y1 < y2) ? 1 : -1;
  let err = dx - dy;

  while (true) {
    if (x1 >= 0 && x1 < width && y1 >= 0 && y1 < height) {
      let idx = (y1 * width + x1) * 3;
      // Additive blending (Screen-like): add color and clamp at 255
      buffer[idx] = Math.min(255, buffer[idx] + r);
      buffer[idx + 1] = Math.min(255, buffer[idx + 1] + g);
      buffer[idx + 2] = Math.min(255, buffer[idx + 2] + b);
    }
    if (x1 === x2 && y1 === y2) break;
    let e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x1 += sx; }
    if (e2 < dx) { err += dx; y1 += sy; }
  }
}

export function draw(display, params, time) {
  const w = display.width, h = display.height;
  const t = params.t;
  const [symmetry, speed, pulse, hueShift] = params.k;
  const innerAmount = 3;

  // Initialize the buffer once
  if (!params.buffer) {
    params.buffer = new Uint8Array(w * h * 3);
  }

  // 1. Clear the internal buffer (dark background)
  params.buffer.fill(15); 

  const centerX = w / 2;
  const centerY = h / 2;

  // Helper to get Star positions based on the class logic
  const getPos = (index, total, baseSize, rotSpeed, pulseFreq) => {
    let angle = (6.283 / total) * index + (t * rotSpeed);
    // r = initialR * sin(a * 5) * 8 + initialR
    let r = (baseSize * Math.sin(angle * pulseFreq) * pulse) + (baseSize * 2);
    r *= (w / 120); // scale for screen
    return {
      x: centerX + r * Math.cos(angle),
      y: centerY + r * Math.sin(angle)
    };
  };

  // 2. Draw lines into the buffer
  for (let i = 0; i < Math.floor(symmetry); i++) {
    const outStar = getPos(i, symmetry, 4, -0.2, 5);
    const hue = ((i / symmetry) + hueShift + t * 0.1) % 1.0;
    const [r, g, b] = hslToRgb(hue, 0.8, 0.5);

    for (let j = 0; j < innerAmount; j++) {
      const inStar = getPos(j, innerAmount, 1, 0.4, 5);
      
      // Draw with lowered brightness so they stack up at the center
      drawLineToBuffer(params.buffer, w, h, outStar.x, outStar.y, inStar.x, inStar.y, r * 0.4, g * 0.4, b * 0.4);
    }
  }

  // 3. Final Pass: Transfer the buffer to the display
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let idx = (y * w + x) * 3;
      display.setPixel(x, y, params.buffer[idx], params.buffer[idx + 1], params.buffer[idx + 2]);
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
