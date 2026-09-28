// ===== Patternflow pattern =====
// Title:    Plasmodial Pulse
// Author:   @martinnlopez
// Date:     2026-08-10
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp linear recolor 0:#000000 0.757:#ffffff
// @knobs Density=100..1500, Speed=0.5..3, Slimy=1..20, Glow=0.1..1
// @matrix 64x128

export function setup(params) {
  const w = 100; // Sim resolution
  const h = 100;
  params.w = w;
  params.h = h;
  
  // Initialize k to prevent the "undefined" error on first frame
  params.k = [1000, 1.5, 10, 0.5];
  
  params.trailMap = new Float32Array(w * h).fill(0);
  params.diffuseMap = new Float32Array(w * h).fill(0);
  
  params.agents = [];
  for (let i = 0; i < 1500; i++) {
    params.agents.push({
      x: Math.random() * w,
      y: Math.random() * h,
      heading: Math.random() * Math.PI * 2
    });
  }
}

export function update(dt, input, params) {
  // Store knobs in params.k so draw() can see them
  params.k = input.knobValues;
  const [density, speed, slimy, glowAmt] = params.k;
  
  const w = params.w;
  const h = params.h;

  // 1. ADD FOOD (Interaction)
  if (input.pointerDown) {
    const fx = Math.floor(input.pointerX * w);
    const fy = Math.floor(input.pointerY * h);
    for(let i=-2; i<=2; i++) {
      for(let j=-2; j<=2; j++) {
        const tx = (fx + i + w) % w;
        const ty = (fy + j + h) % h;
        params.trailMap[tx + ty * w] = 5.0; // High intensity "food"
      }
    }
  }

  // 2. DIFFUSION & DECAY
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = x + y * w;
      let sum = params.trailMap[idx] + 
                params.trailMap[idx + 1] + 
                params.trailMap[idx - 1] + 
                params.trailMap[idx + w] + 
                params.trailMap[idx - w];
      
      // Decay factor: trails fade away
      params.diffuseMap[idx] = (sum / 5.0) * 0.92; 
    }
  }
  params.trailMap.set(params.diffuseMap);

  // 3. AGENT LOGIC
  const sensorAngle = (slimy * 3) * (Math.PI / 180);
  const sensorDist = slimy * 0.5;
  const rotAngle = (slimy * 5) * (Math.PI / 180);

  for (let i = 0; i < density; i++) {
    let a = params.agents[i];

    const getVal = (ang) => {
      const sx = Math.floor((a.x + sensorDist * Math.cos(a.heading + ang) + w) % w);
      const sy = Math.floor((a.y + sensorDist * Math.sin(a.heading + ang) + h) % h);
      return params.trailMap[sx + sy * w];
    };

    const f = getVal(0);
    const l = getVal(-sensorAngle);
    const r = getVal(sensorAngle);

    if (f > l && f > r) { /* stay straight */ }
    else if (f < l && f < r) a.heading += (Math.random() - 0.5) * 2 * rotAngle;
    else if (l > r) a.heading -= rotAngle;
    else if (r > l) a.heading += rotAngle;

    a.x = (a.x + Math.cos(a.heading) * speed + w) % w;
    a.y = (a.y + Math.sin(a.heading) * speed + h) % h;

    // Deposit scent
    params.trailMap[Math.floor(a.x) + Math.floor(a.y) * w] += 0.5;
  }
}

export function draw(display, params, time) {
  const w = display.width, h = display.height;
  const simW = params.w, simH = params.h;
  const glow = params.k[3]; // This will now work!

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const sx = Math.floor((x / w) * simW);
      const sy = Math.floor((y / h) * simH);
      let val = params.trailMap[sx + sy * simW];

      if (val > 0.05) {
        // Boost brightness based on the Glow knob
        const brightness = Math.min(1.0, val * (0.5 + glow * 2.0));
        
        // Classic Physarum Palette
        display.setPixel(
          x, y, 
          brightness * 200, // Red
          brightness * 255, // Green
          brightness * 40   // Blue
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
