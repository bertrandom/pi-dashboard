// ===== Patternflow pattern =====
// Title:    Physarum Polycephalum
// Author:   @martinnlopez
// Date:     2026-08-10
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @knobs Density=100..1000, Speed=0.5..3, Slimy=1..15, Decay=0.9..0.99
// @matrix 128x128

export function setup(params) {
  const w = 128; // Internal simulation resolution
  const h = 128;
  params.w = w;
  params.h = h;
  
  // Initialize scent trail map
  params.trailMap = new Float32Array(w * h).fill(0);
  
  // Initialize agents based on your Mold class
  params.agents = [];
  for (let i = 0; i < 1000; i++) {
    params.agents.push({
      x: w/2 + (Math.random() - 0.5) * 20,
      y: h/2 + (Math.random() - 0.5) * 20,
      heading: Math.random() * Math.PI * 2,
      vx: 0,
      vy: 0
    });
  }
}

export function update(dt, input, params) {
  const [densityKnob, speed, slimy, decay] = input.knobValues;
  const w = params.w;
  const h = params.h;

  // Slimy knob controls the sensor behavior
  const sensorAngle = (slimy * 5) * (Math.PI / 180);
  const sensorDist = slimy * 0.8;
  const rotAngle = (slimy * 4) * (Math.PI / 180);
  const numAgents = Math.floor(densityKnob);

  // 1. MOLD AGENT LOGIC (Your provided class logic)
  for (let i = 0; i < numAgents; i++) {
    let a = params.agents[i];

    // Get sensor positions
    const getSns = (ang) => {
      return {
        x: (a.x + sensorDist * Math.cos(a.heading + ang) + w) % w,
        y: (a.y + sensorDist * Math.sin(a.heading + ang) + h) % h
      };
    };

    const rSns = getSns(sensorAngle);
    const lSns = getSns(-sensorAngle);
    const fSns = getSns(0);

    const getVal = (p) => params.trailMap[Math.floor(p.x) + Math.floor(p.y) * w];
    const r = getVal(rSns);
    const l = getVal(lSns);
    const f = getVal(fSns);

    // Steer based on sensor values
    if (f > l && f > r) {
      a.heading += 0;
    } else if (f < l && f < r) {
      a.heading += (Math.random() < 0.5 ? rotAngle : -rotAngle);
    } else if (l > r) {
      a.heading -= rotAngle;
    } else if (r > l) {
      a.heading += rotAngle;
    }

    // Move
    a.vx = Math.cos(a.heading) * speed;
    a.vy = Math.sin(a.heading) * speed;
    a.x = (a.x + a.vx + w) % w;
    a.y = (a.y + a.vy + h) % h;

    // Deposit scent
    params.trailMap[Math.floor(a.x) + Math.floor(a.y) * w] = 1.0;
  }

  // 2. EVAPORATION & DIFFUSION (Required for the simulation to evolve)
  for (let i = 0; i < params.trailMap.length; i++) {
    params.trailMap[i] *= decay; // Trails fade over time
  }
}

export function draw(display, params, time) {
  const w = display.width;
  const h = display.height;
  const simW = params.w;
  const simH = params.h;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Map display pixels to simulation buffer
      const sx = Math.floor((x / w) * simW);
      const sy = Math.floor((y / h) * simH);
      const val = params.trailMap[sx + sy * simW];

      // Slime mold aesthetic: Bright neon yellow/green
      if (val > 0.01) {
        const r = val * 200;
        const g = val * 255;
        const b = val * 50;
        display.setPixel(x, y, r, g, b);
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
