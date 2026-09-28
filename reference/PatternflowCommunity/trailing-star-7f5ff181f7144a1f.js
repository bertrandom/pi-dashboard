// ===== Patternflow pattern =====
// Title:    Trailing Star
// Author:   @martinnlopez
// Date:     2026-07-31
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp hsvLong recolor 0:#000000 0.715:#fefb00 0.192:#fefb00
// @matrix 128x64
// @knobs Length=10..100, Chaos=0.1..5, Fringe=0..10, TrailSize=1..5
export function setup(params) {
  params.ptsX = new Float32Array(100);
  params.ptsY = new Float32Array(100);
  params.headX = 64;
  params.headY = 32;
  params.velX = 0;
  params.velY = 0;
  params.t = 0;
  params.k = [50, 1, 4, 2];
  
  // Fixed Star Pixel Data (11x11)
  params.star = [
    0,0,0,0,0,4,0,0,0,0,0,
    0,0,0,0,4,1,4,0,0,0,0,
    0,0,0,4,1,1,1,4,0,0,0,
    4,4,4,4,1,1,1,4,4,4,4,
    4,1,1,1,1,1,1,1,1,1,4,
    0,4,1,2,1,1,1,2,1,4,0,
    0,0,4,3,1,1,1,3,4,0,0,
    0,4,1,1,1,4,1,1,1,4,0,
    4,1,1,4,4,0,4,4,1,1,4,
    4,1,4,0,0,0,0,0,4,1,4,
    0,4,0,0,0,0,0,0,0,4,0
  ];
}

export function update(dt, input, params) {
  params.k = input.knobValues;
  params.t += dt;

  const chaos = params.k[1];
  const w = 128;
  const h = 64;

  // 1. Physics: Spring Attractor with Jitter
  const targetX = (w/2) + Math.sin(params.t * 0.8) * Math.cos(params.t * 0.4) * (w * 0.4);
  const targetY = (h/2) + Math.cos(params.t * 0.7) * Math.sin(params.t * 0.3) * (h * 0.35);

  const ax = (targetX - params.headX) * chaos + (Math.sin(params.t * 8) * chaos * 4);
  const ay = (targetY - params.headY) * chaos + (Math.cos(params.t * 10) * chaos * 4);

  params.velX = (params.velX + ax * dt) * 0.93; // Damping
  params.velY = (params.velY + ay * dt) * 0.93;
  
  params.headX += params.velX;
  params.headY += params.velY;

  // 2. Trail Propagation
  params.ptsX[0] = params.headX;
  params.ptsY[0] = params.headY;

  for (let i = 99; i > 0; i--) {
    params.ptsX[i] += (params.ptsX[i-1] - params.ptsX[i]) * 0.3;
    params.ptsY[i] += (params.ptsY[i-1] - params.ptsY[i]) * 0.3;
  }
}

export function draw(display, params, time) {
  const w = display.width, h = display.height;
  const length = Math.floor(params.k[0]);
  const fringe = params.k[2];
  const trailThickness = Math.floor(params.k[3]);

  // Clear frame
  for (let i = 0; i < w * h; i++) display.setPixel(i % w, Math.floor(i / w), 0, 0, 0);

  // --- Draw Trail (Thick Stroke Pass) ---
  for (let i = length - 1; i >= 1; i--) {
    const px = params.ptsX[i];
    const py = params.ptsY[i];
    const age = i / length;
    const bri = (1.0 - age) * 255;

    // Directional vectors for fringe offset
    const dx = params.ptsX[i-1] - px;
    const dy = params.ptsY[i-1] - py;
    const mag = Math.sqrt(dx * dx + dy * dy) + 0.001;
    const nx = (-dy / mag) * fringe * age;
    const ny = (dx / mag) * fringe * age;

    // Render trail "stamps"
    const currentSize = Math.max(1, Math.floor(trailThickness * (1.0 - age)));
    
    for (let ox = -currentSize; ox <= currentSize; ox++) {
      for (let oy = -currentSize; oy <= currentSize; oy++) {
        const tx = Math.floor(px + ox);
        const ty = Math.floor(py + oy);
        
        if (tx >= 0 && tx < w && ty >= 0 && ty < h) {
          // White core
          display.setPixel(tx, ty, bri, bri, bri);
          // Chromatic Fringe (Offsets applied to the stamp)
          display.setPixel(Math.floor(tx + nx), Math.floor(ty + ny), bri, 0, 0);
          display.setPixel(Math.floor(tx - nx), Math.floor(ty - ny), 0, 0, bri);
        }
      }
    }
  }

  // --- Draw Fixed Size Pixel Star Head ---
  // Star is fixed at scale 1.0 (11x11 pixels)
  const startX = Math.floor(params.headX - 5.5);
  const startY = Math.floor(params.headY - 5.5);

  for (let sy = 0; sy < 11; sy++) {
    for (let sx = 0; sx < 11; sx++) {
      const type = params.star[sy * 11 + sx];
      if (type === 0) continue;

      let r = 0, g = 0, b = 0;
      if (type === 1) { r = 255; g = 220; b = 50; }  // Yellow
      if (type === 2) { r = 20; g = 20; b = 20; }     // Eyes
      if (type === 3) { r = 255; g = 120; b = 180; } // Blush
      if (type === 4) { r = 0; g = 0; b = 0; }       // Outline (black)
      
      const fx = startX + sx;
      const fy = startY + sy;
      if (fx >= 0 && fx < w && fy >= 0 && fy < h) {
        display.setPixel(fx, fy, r, g, b);
      }
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
