// ===== Patternflow pattern =====
// Title:    Mathematical Winds
// Author:   @martinnlopez
// Date:     2026-08-12
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp hsvLong recolor 0.049:#005392 0.151:#73fdff 0.089:#00f900
// @knobs Mode=0..11, SourceX=0..1, SourceY=0..1, Flow=0.5..3
// @matrix 64x128

export function setup(params) {
  params.w = 120;
  params.h = 120;
  params.trailMap = new Float32Array(params.w * params.h).fill(0);
  
  params.palette = [
    [88, 24, 69],   // #581845
    [144, 12, 63],  // #900C3F
    [199, 0, 57],   // #C70039
    [255, 87, 51],  // #FF5733
    [255, 195, 15]  // #FFC30F
  ];

  params.agents = [];
  for (let i = 0; i < 400; i++) {
    params.agents.push({ x: 0, y: 0, active: false, col: [0,0,0], dir: 1 });
  }
}

// The core slope logic from your provided switch statements
function getSlope(x, y, variation) {
  let dx = 1, dy = 1;
  switch(variation) {
    case 0:  dx = Math.cos(y); dy = Math.sin(x); break;
    case 1:  dx = Math.cos(y*5)*x*0.3; dy = Math.sin(x*5)*y*0.3; break;
    case 2:  dx = 1; dy = Math.cos(x*y); break;
    case 3:  dx = 1; dy = Math.sin(x)*Math.cos(y); break;
    case 4:  dx = 1; dy = Math.cos(x)*y*y; break;
    case 5:  dx = 1; dy = Math.log(Math.abs(x)+1)*Math.log(Math.abs(y)+1); break;
    case 6:  dx = 1; dy = Math.tan(x)*Math.cos(y); break;
    case 7:  dx = Math.sin(y*0.1)*3; dy = -Math.sin(x*0.1)*3; break;
    case 8:  dx = y/3; dy = (x-x*x*x)*0.01; break;
    case 9:  dx = -y; dy = -Math.sin(x); break;
    case 10: dx = -1.5*y; dy = -y-Math.sin(1.5*x) + 0.7; break;
    case 11: dx = Math.sin(y)*Math.cos(x); dy = Math.sin(x)*Math.cos(y); break;
  }
  return [dx, dy];
}

export function update(dt, input, params) {
  const [mode, srcX, srcY, flow] = input.knobValues;
  const w = params.w, h = params.h;
  const variation = Math.floor(mode);

  // 1. EMIT PARTICLES (Based on SourceX/Y knobs)
  // We emit a few particles every frame from the "Source" location
  for (let i = 0; i < 5; i++) {
    let inactive = params.agents.find(a => !a.active);
    if (inactive) {
      inactive.active = true;
      // Convert 0..1 knobs to sim coordinates -5..5
      inactive.x = (srcX - 0.5) * 10 + (Math.random() - 0.5) * 2;
      inactive.y = (srcY - 0.5) * 10 + (Math.random() - 0.5) * 2;
      inactive.col = params.palette[Math.floor(Math.random() * params.palette.length)];
      inactive.dir = Math.random() > 0.5 ? 1 : -1;
    }
  }

  // 2. MOVE AGENTS
  for (let a of params.agents) {
    if (!a.active) continue;

    const [dx, dy] = getSlope(a.x, a.y, variation);
    
    a.x += a.dir * dx * dt * flow * 2;
    a.y += a.dir * dy * dt * flow * 2;

    // Boundary check
    if (Math.abs(a.x) > 10 || Math.abs(a.y) > 10) {
      a.active = false;
    } else {
      // Draw to trail map
      const sx = Math.floor((a.x / 10 + 0.5) * w);
      const sy = Math.floor((a.y / 10 + 0.5) * h);
      const idx = sx + sy * w;
      if (idx >= 0 && idx < params.trailMap.length) {
        // Store color index in the trail map for drawing
        params.trailMap[idx] = (params.palette.indexOf(a.col) + 1) / 10 + 0.5;
      }
    }
  }

  // 3. DECAY (Motion Blur)
  for (let i = 0; i < params.trailMap.length; i++) {
    params.trailMap[i] *= 0.92;
  }
}

export function draw(display, params, time) {
  const w = display.width, h = display.height;
  const simW = params.w, simH = params.h;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = Math.floor((x / w) * simW);
      const sy = Math.floor((y / h) * simH);
      const val = params.trailMap[sx + sy * simW];

      if (val > 0.1) {
        // Recover color from the stored index value
        const colorIdx = Math.floor((val - 0.5) * 10);
        const col = params.palette[colorIdx] || params.palette[0];
        
        // Final pixel brightness based on "age" (decay)
        const intensity = Math.min(1.0, val * 1.5);
        display.setPixel(x, y, col[0] * intensity, col[1] * intensity, col[2] * intensity);
      } else {
        // Background color #1a0633
        display.setPixel(x, y, 26, 6, 51);
      }
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
