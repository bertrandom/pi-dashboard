// ===== Patternflow pattern =====
// Title:    Cosmic Clockwork
// Author:   @martinnlopez
// Date:     2026-08-11
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @knobs Orbits=4..12, Speed=0.1..2, Tilt=0.5..2, Zoom=0.5..5
// @matrix 128x128

export function setup(params) {
  params.t = 0;
  params.orbits = [];
  
  // High-contrast Palette for better visibility
  params.palette = [
    [255, 230, 100], // Bright Gold
    [150, 255, 100], // Electric Lime
    [100, 220, 255], // Sky Blue
    [255, 100, 150], // Pink
    [200, 200, 200]  // Silver
  ];

  for (let i = 0; i < 12; i++) {
    params.orbits.push({
      radius: 15 + i * 12, // Increased spacing for bolder lines
      tiltX: Math.random() * 6.28,
      tiltY: Math.random() * 6.28,
      tiltZ: Math.random() * 6.28,
      speedMult: 0.3 + Math.random() * 0.7,
      colorIdx: i % params.palette.length,
      phase: Math.random() * 10
    });
  }
}

export function update(dt, input, params) {
  params.k = input.knobValues;
  params.t += dt * params.k[1];
}

function rotateAndProject(p, ax, ay, az, scale, center) {
  let [x, y, z] = p;
  let c, s, tmp;
  // X rotation
  c = Math.cos(ax); s = Math.sin(ax);
  tmp = y * c - z * s; z = y * s + z * c; y = tmp;
  // Y rotation
  c = Math.cos(ay); s = Math.sin(ay);
  tmp = x * c + z * s; z = -x * s + z * c; x = tmp;
  // Z rotation
  c = Math.cos(az); s = Math.sin(az);
  tmp = x * c - y * s; y = x * s + y * c; x = tmp;
  
  return {
    x: center.x + x * scale,
    y: center.y + y * scale,
    z: z
  };
}

export function draw(display, params, time) {
  const w = display.width, h = display.height;
  const t = params.t;
  const [numOrbits, speed, tiltAmt, zoom] = params.k;
  
  const centerX = w / 2, centerY = h / 2;
  // Base scale influenced by the Zoom knob
  const currentScale = (w * 0.01) * zoom;

  // Background: Solid Black
  for (let i = 0; i < w * h; i++) display.setPixel(i % w, Math.floor(i / w), 0, 0, 0);

  const activeOrbits = Math.floor(numOrbits);

  for (let i = 0; i < activeOrbits; i++) {
    const o = params.orbits[i];
    const col = params.palette[o.colorIdx];
    
    // To make the line SOLID and BOLD:
    // We use a very small step (0.02) to ensure no pixel is missed
    for (let angle = 0; angle < 6.32; angle += 0.025) {
      let px = o.radius * Math.cos(angle);
      let py = o.radius * Math.sin(angle);
      
      const proj = rotateAndProject(
        [px, py, 0], 
        o.tiltX * tiltAmt + t * 0.05, 
        o.tiltY * tiltAmt, 
        o.tiltZ + t * 0.03, 
        currentScale, 
        {x: centerX, y: centerY}
      );

      // Draw a 2x2 bold block for the line
      if (proj.x > 0 && proj.x < w - 1 && proj.y > 0 && proj.y < h - 1) {
          const depth = (proj.z + 50) / 100;
          const r = col[0] * depth, g = col[1] * depth, b = col[2] * depth;
          
          display.setPixel(Math.floor(proj.x), Math.floor(proj.y), r, g, b);
          display.setPixel(Math.floor(proj.x)+1, Math.floor(proj.y), r, g, b);
          display.setPixel(Math.floor(proj.x), Math.floor(proj.y)+1, r, g, b);
      }
    }

    // Draw the "Planet" marker as a 3x3 bright block
    const pAngle = t * o.speedMult + o.phase;
    const pPos = rotateAndProject(
      [o.radius * Math.cos(pAngle), o.radius * Math.sin(pAngle), 0],
      o.tiltX * tiltAmt + t * 0.05, 
      o.tiltY * tiltAmt, 
      o.tiltZ + t * 0.03, 
      currentScale, 
      {x: centerX, y: centerY}
    );

    if (pPos.x > 1 && pPos.x < w - 2 && pPos.y > 1 && pPos.y < h - 2) {
      for(let dx=-1; dx<=1; dx++) {
        for(let dy=-1; dy<=1; dy++) {
          display.setPixel(Math.floor(pPos.x)+dx, Math.floor(pPos.y)+dy, 255, 255, 255);
        }
      }
    }
  }
  
  // Central Star (Pulsing)
  const sunSize = 2 + Math.sin(t * 2) * 1;
  for(let x = -sunSize; x <= sunSize; x++) {
    for(let y = -sunSize; y <= sunSize; y++) {
      if (x*x + y*y <= sunSize*sunSize) {
        display.setPixel(centerX + x, centerY + y, 255, 255, 200);
      }
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
