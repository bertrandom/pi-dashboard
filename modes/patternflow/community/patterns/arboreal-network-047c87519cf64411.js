// ===== Patternflow pattern =====
// Title:    Arboreal Network
// Author:   @martinnlopez
// Date:     2026-08-10
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp oklchLong recolor 0.044:#9437ff 1:#ffffff 0.761:#72fcd5
// @knobs Density=100..1500, Sway=0..90, Growth=0.5..3, Decay=0.8..0.99
// @matrix 128x128

export function setup(params) {
  params.w = 100;
  params.h = 100;
  const size = params.w * params.h;
  
  params.k = [1000, 20, 1.5, 0.92];
  params.trailMap = new Float32Array(size).fill(0);
  params.diffuseMap = new Float32Array(size).fill(0);
  
  params.agents = [];
  for (let i = 0; i < 1500; i++) {
    // Start agents at the bottom center (the "Root")
    params.agents.push({
      x: params.w / 2,
      y: params.h - 5,
      heading: -Math.PI / 2 // Pointing Up
    });
  }
}

export function update(dt, input, params) {
  params.k = input.knobValues;
  const [density, swayDeg, growth, decay] = params.k;
  const w = params.w, h = params.h;

  // Interaction: Tap to plant a new "Seed" (Reset agents to pointer)
  if (input.pointerDown) {
    for (let i = 0; i < density; i++) {
      params.agents[i].x = input.pointerX * w;
      params.agents[i].y = input.pointerY * h;
      params.agents[i].heading = Math.random() * Math.PI * 2;
    }
    params.trailMap.fill(0); // Clear screen for new growth
  }

  // 1. Diffusion & Decay (Glow Pass)
  for (let i = w; i < (w * h) - w; i++) {
    let sum = params.trailMap[i] + params.trailMap[i+1] + params.trailMap[i-1] + params.trailMap[i+w] + params.trailMap[i-w];
    params.diffuseMap[i] = (sum / 5.0) * decay;
  }
  params.trailMap.set(params.diffuseMap);

  // 2. Tree-Logic Agent Movement
  const sAng = (swayDeg) * (Math.PI / 180);
  const sDist = growth * 3;
  const rAng = (swayDeg * 0.5) * (Math.PI / 180);

  const activeCount = Math.min(density, params.agents.length);
  for (let i = 0; i < activeCount; i++) {
    let a = params.agents[i];

    // Sensor Logic
    const getVal = (off) => {
      const sx = Math.floor((a.x + sDist * Math.cos(a.heading + off) + w) % w);
      const sy = Math.floor((a.y + sDist * Math.sin(a.heading + off) + h) % h);
      return params.trailMap[sx + sy * w];
    };

    const f = getVal(0);
    const l = getVal(-sAng);
    const r = getVal(sAng);

    // Physarum Steer + Upward Bias (The Tree "Growth" force)
    if (f > l && f > r) {
      // If path is clear, slight bias to turn "UP" (towards -Y)
      const targetAngle = -Math.PI / 2;
      a.heading += (targetAngle - a.heading) * 0.05;
    } else if (f < l && f < r) {
      a.heading += (Math.random() - 0.5) * 2 * rAng;
    } else if (l > r) {
      a.heading -= rAng;
    } else if (r > l) {
      a.heading += rAng;
    }

    // Move
    a.x = (a.x + Math.cos(a.heading) * growth + w) % w;
    a.y = (a.y + Math.sin(a.heading) * growth + h) % h;

    // Deposit trail (the "Bark")
    params.trailMap[Math.floor(a.x) + Math.floor(a.y) * w] += 0.5;
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

      if (val > 0.02) {
        const bright = Math.min(1.0, val * 0.8);
        // Wood/Sap color: Brownish-Orange to Glowing Green
        display.setPixel(
          x, y, 
          bright * 150 + (val * 50), // Red 
          bright * 255,              // Green
          bright * 20                // Blue
        );
      } else {
        display.setPixel(x, y, 0, 0, 0);
      }
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
