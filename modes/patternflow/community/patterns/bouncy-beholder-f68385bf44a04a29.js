// ===== Patternflow pattern =====
// Title:    Bouncy Beholder
// Author:   @martinnlopez
// Date:     2026-08-06
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @matrix 128x128
// @knobs Count=1..6, LookSpeed=0.1..10, AnimSpeed=0.1..10, Bounce=0..1
export function setup(params) {
  params.t = 0;
  params.k = [1, 2, 2, 0];
}

export function update(dt, input, params) {
  params.k = input.knobValues;
  params.t += dt;
}

export function draw(display, params, time) {
  const w = display.width;
  const h = display.height;
  const t = params.t;
  
  const count = Math.floor(params.k[0]);
  const lookSpeed = params.k[1];
  const animSpeed = params.k[2];
  const bounceAmt = params.k[3];

  // Clear background (Dark fleshy/veiny purple)
  for (let i = 0; i < w * h; i++) display.setPixel(i % w, Math.floor(i / w), 25, 5, 15);

  for (let e = 0; e < count; e++) {
    // 1. Base Position
    const baseCX = w / 2 + (count > 1 ? Math.sin(e * 2 + t * 0.5) * (w * 0.25) : 0);
    const baseCY = (h / (count + 1)) * (e + 1);

    // 2. Bounce Physics
    // Use a sine wave for the bounce height
    const bouncePhase = t * animSpeed * 0.8 + (e * 0.5);
    const verticalOffset = Math.abs(Math.sin(bouncePhase)) * (h * 0.2 * bounceAmt);
    const cy = baseCY - verticalOffset;

    // 3. Squash and Stretch Logic
    // Squish vertically when at the bottom of the bounce, stretch when moving fast
    const vel = Math.cos(bouncePhase); 
    const stretch = 1.0 + (vel * 0.15 * bounceAmt);
    const squash = 1.0 / stretch; // Keep volume constant-ish

    // 4. Animation: Throb and Blink
    const throb = Math.sin(t * animSpeed) * 0.08 + 1.0;
    const blink = Math.pow(Math.sin(t * animSpeed * 0.4 + e), 15); 
    const lidPos = (1.0 - blink) * (18 * throb * stretch);

    // 5. Looking around
    const lookX = Math.sin(t * lookSpeed + e) * 5;
    const lookY = Math.cos(t * lookSpeed * 0.8 + e) * 3;

    // Render Bounding Box
    const boundW = Math.floor(22 * throb * squash);
    const boundH = Math.floor(22 * throb * stretch);
    const startX = Math.max(0, Math.floor(baseCX - boundW));
    const endX = Math.min(w, Math.ceil(baseCX + boundW));
    const startY = Math.max(0, Math.floor(cy - boundH));
    const endY = Math.min(h, Math.ceil(cy + boundH));

    for (let py = startY; py < endY; py++) {
      const dy = (py - cy) / stretch;
      if (Math.abs(dy) > lidPos) continue; // Eye is closed here

      for (let px = startX; px < endX; px++) {
        const dx = (px - baseCX) / squash;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        const eyeRadius = 16 * throb;
        const irisRadius = 8 * throb;
        const pupilRadius = 3.5 * throb;

        if (dist < eyeRadius) {
          let r = 245, g = 245, b = 245; // Sclera

          // Red Veins
          const angle = Math.atan2(dy, dx);
          const vein = Math.sin(angle * 10 + dist * 0.4 + t) > 0.85;
          if (dist > irisRadius && vein) {
            r = 220; g = 40; b = 40;
          }

          // Blue Iris Logic
          const idx = (px - (baseCX + lookX)) / squash;
          const idy = (py - (cy + lookY)) / stretch;
          const iDist = Math.sqrt(idx * idx + idy * idy);

          if (iDist < irisRadius) {
            // High-Contrast Deep Blue Iris
            r = 20; g = 80; b = 200;
            
            // Iris Radial Texture
            const irisTex = Math.sin(Math.atan2(idy, idx) * 16) * 40;
            r += irisTex; g += irisTex; b += irisTex;

            // Pupil
            if (iDist < pupilRadius) {
              r = 0; g = 0; b = 0;
            }
            
            // Specular Reflection
            if (Math.sqrt(Math.pow(idx + 2.5, 2) + Math.pow(idy + 2.5, 2)) < 1.8) {
              r = 255; g = 255; b = 255;
            }
          }

          // Edge Vignette
          if (dist > eyeRadius - 2) {
            const edgeAlpha = (eyeRadius - dist) / 2;
            r *= edgeAlpha; g *= edgeAlpha; b *= edgeAlpha;
          }

          display.setPixel(px, py, Math.max(0, r), Math.max(0, g), Math.max(0, b));
        }
      }
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
