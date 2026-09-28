// ===== Patternflow pattern =====
// Title:    Inward Serpent Tendrils
// Author:   @martinnlopez
// Date:     2026-09-09
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp hsvLong recolor 0.095:#a9a9a9 0.358:#424242 0.122:#000000 0.617:#000000
// @knobs Streams=6..18, Speed=0.2..2, Reach=0.2..1, Fringe=0.1..1
// @matrix 64x128

// Knob 1: Streams - Density of serpents emerging from the perimeter (6 to 18)
// Knob 2: Speed - Slithering velocity and traveling wave frequency
// Knob 3: Reach - Inward penetration depth of the snake heads (0.2 to 1.0)
// Knob 4: Fringe - Chromatic glitch width (Yellow/Magenta/Blue) and edge dither

export function setup(params) {
  params.t = 0;
  params.k = [10.0, 1.2, 0.75, 0.55];
}

export function update(dt, input, params) {
  params.k = input.knobValues;
  params.t += dt * params.k[1];
}

export function draw(display, params, time) {
  const w = display.width;
  const h = display.height;
  const t = params.t;

  const numStreams = Math.max(6, Math.floor(params.k[0]));
  const reach = params.k[2];
  const fringe = params.k[3];

  // Stepped noise clock for authentic boiling edge dither
  const noiseTime = Math.floor(time * 22.0);

  const cx = w * 0.5;
  const cy = h * 0.5;
  const minDim = Math.min(w, h);
  const scaleX = 1.0 / (w * 0.5);
  const scaleY = 1.0 / (h * 0.5);

  const splitOffset = fringe * 2.2;
  const deltaAngle = 6.28318 / numStreams;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // 1. Boiling Stochastic Noise for Dither Fringe & Background Dust
      let hash = (x * 374761393 ^ y * 668265263 ^ noiseTime * 1274126177) >>> 0;
      hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
      const noise = ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;

      // 2. Sample Inward-Reaching Serpents across 3 Chromatic Offsets (R, G, B)
      let fieldR = 0;
      let fieldG = 0;
      let fieldB = 0;

      for (let c = 0; c < 3; c++) {
        const ox = (c - 1) * splitOffset;
        const px = x + ox;
        const py = y;

        const nx = (px - cx) * scaleX;
        const ny = (py - cy) * scaleY;
        const r = Math.sqrt(nx * nx + ny * ny);
        const theta = Math.atan2(ny, nx);

        // Approximate which stream sector this pixel belongs to
        const rotDrift = t * 0.08;
        const approxS = Math.round((theta - rotDrift) / deltaAngle);

        let maxChannelInt = 0;

        // Only test the 3 nearest neighboring streams for maximum 60 FPS performance
        for (let k = -1; k <= 1; k++) {
          const s = (approxS + k + numStreams * 100) % numStreams;
          const baseAngle = s * deltaAngle + rotDrift;

          // Snake Head Position (tip reaching inward)
          // Darting organic search motion added to the reach limit
          const dart = Math.sin(t * 2.2 + s * 1.7) * 0.04;
          const rTip = Math.max(0.015, (1.0 - reach) * 1.12 + dart);

          // Lateral Undulation: Traveling sine wave moving from tail (r=1) to head (r=rTip)
          // The wave amplitude increases toward the head for active serpentine whipping
          const waveProgress = Math.max(0, 1.0 - r);
          const undulation1 = Math.sin(r * 9.5 - t * 2.4 + s * 2.1) * (0.10 + waveProgress * 0.22);
          const undulation2 = Math.sin(r * 18.0 - t * 4.2 + s * 1.1) * 0.05; // High-frequency muscle twitch
          const targetAngle = baseAngle + undulation1 + undulation2;

          // Angular distance to the serpent spine
          let dAngle = theta - targetAngle;
          dAngle = dAngle - 6.28318 * Math.round(dAngle / 6.28318);

          if (Math.abs(dAngle) > 0.45) continue;

          // Tangential distance to spine in pixels
          const distTan = r * Math.abs(dAngle) * (minDim * 0.5);

          // Distance past the snake head
          let distRad = 0;
          if (r < rTip) {
            distRad = (rTip - r) * (minDim * 0.5);
          }

          // Combined Euclidean distance to serpent spine and head bulb
          const dist = Math.sqrt(distTan * distTan + distRad * distRad);

          // Slender spine width (thinner and sleeker)
          const width = 1.3 + Math.min(1.0, r) * 1.1 + Math.sin(r * 12.0 + s) * 0.25;

          // Channel falloff (sharper core, tighter fringe)
          const falloffScale = (c === 1) ? 1.5 : 2.0;
          const intensity = Math.max(0, 1.0 - dist / (width * falloffScale));

          if (intensity > maxChannelInt) {
            maxChannelInt = intensity;
          }
        }

        if (c === 0) fieldR = maxChannelInt;
        if (c === 1) fieldG = maxChannelInt;
        if (c === 2) fieldB = maxChannelInt;
      }

      // 3. Chromatic Fringe Thresholding with Boiling Dither
      const jitter = (noise - 0.5) * fringe * 0.42;

      const passR = (fieldR + jitter) > 0.40;
      const passG = (fieldG + jitter * 0.6) > 0.50;
      const passB = (fieldB + jitter) > 0.38;

      let r = 0, g = 0, b = 0;

      // Color combination logic:
      // R + G + B = Luminous White Core Thread
      // R + G     = Hot Yellow/Orange Halo
      // R + B     = Vibrant Magenta Fringe
      // B only    = Electric Cobalt Blue Outer Rim
      if (passR && passG && passB) {
        r = 255; g = 255; b = 255;
      } else if (passR && passG) {
        r = 255;
        g = passB ? 255 : (fieldG > 0.68 ? 210 : 130);
        b = 10;
      } else if (passR && passB) {
        r = 245; g = 20; b = 180;
      } else if (passB) {
        r = (fieldB > 0.6) ? 80 : 20;
        g = 30;
        b = 255;
      } else if (passR) {
        r = 255; g = 40; b = 15;
      } else {
        // 4. Background Static Grain in the void
        if (noise > 0.97) {
          r = 25; g = 35; b = 60;
        } else if (noise > 0.95) {
          r = 10; g = 15; b = 25;
        }
      }

      display.setPixel(x, y, r, g, b);
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
