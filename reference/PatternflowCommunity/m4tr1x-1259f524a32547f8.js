// ===== Patternflow pattern =====
// Title:    M4TR1X
// Author:   @stillkingz
// Date:     2026-09-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @knobs Density=0..1, Speed=0.1..3, Trail=0..1, Zoom=0..1
// @matrix 128x64
// MATRIX — DEEP DIGITAL RAIN


// Compact 3x5 glyphs for dense LED rain.
const glyphs = [
  "111101101101111",
  "010110010010111",
  "110001111100111",
  "110001010001110",
  "101101111001001",
  "111100110001110",
  "011100111101111",
  "111001010010010",
  "111101111101111",
  "111101111001110",
  "010111010111010",
  "101010111010101",
  "111001011010110",
  "100111101101111",
  "010111101010010",
  "111010111100111",
  "101111001011101",
  "001111010111100",
  "110010111010011",
  "101001111100101",
  "111101010101111",
  "010101111001010",
  "100110111011001",
  "011110010111100"
];

function hash(n) {
  const v = Math.sin(n * 127.1 + 31.7) * 43758.5453;
  return v - Math.floor(v);
}

export function setup(p) {
  p.t = 0;
  p.density = 0.8;
  p.speed = 1;
  p.trail = 0.7;
  p.zoom = 0;
  p.seed = 0;
}

export function update(dt, input, p) {
  if (input && input.knobValues) {
    p.density = input.knobValues[0];
    p.speed = input.knobValues[1];
    p.trail = input.knobValues[2];
    p.zoom = input.knobValues[3];
  }

  const frozen =
    input && input.btnHeld && input.btnHeld[1];

  if (!frozen) {
    p.t += dt * p.speed;
  }

  if (input && input.btnPressed && input.btnPressed[0]) {
    p.seed += 37;
  }
}

export function draw(d, p, time) {
  // At Zoom 0: 32 columns on a 128-pixel-wide panel.
  const size = 1 + Math.floor(p.zoom * 2);
  const cellW = 4 * size;
  const cellH = 6 * size;
  const rows = Math.ceil(d.height / cellH);

  for (let y = 0; y < d.height; y++) {
    for (let x = 0; x < d.width; x++) {
      const col = Math.floor(x / cellW);
      const gx = Math.floor((x % cellW) / size);
      const seed = col * 23.71 + p.seed;

      // Each column has its own depth and fall speed.
      const depth = hash(seed + 4);
      const velocity = 1.3 + depth * 4.2;
      const travel = p.t * velocity * cellH;

      // Whole-pixel scrolling keeps tiny glyphs sharp.
      const scroll = Math.floor(travel);
      const localY = y - scroll;
      const row = Math.floor(localY / cellH);
      const gy = Math.floor(
        ((localY % cellH + cellH) % cellH) / size
      );

      const trailLength =
        5 + Math.floor(p.trail * 15 + hash(seed + 9) * 5);

      const gapLength =
        3 + Math.floor(hash(seed + 12) * 9);

      const period = trailLength + gapLength;
      const offset = Math.floor(hash(seed + 2) * period);
      const phase = ((row + offset) % period + period) % period;

      // Head is at the bottom of each falling trail.
      const distance = trailLength - 1 - phase;
      const active = phase < trailLength;
      const enabled =
        hash(seed + 8) < 0.5 + p.density * 0.5;

      let r = 0;
      let g = 0;
      let b = 0;

      if (enabled && active && gx < 3 && gy < 5) {
        // Glyphs change independently without flickering in unison.
        const tick = Math.floor(
          p.t * (1.2 + hash(seed + row * 7) * 3)
        );

        const glyphIndex = Math.floor(
          hash(seed + row * 17.13 + tick * 3.7) *
          glyphs.length
        );

        const lit = glyphs[glyphIndex][gy * 3 + gx] === "1";

        if (lit) {
          const fade = Math.pow(
            1 - distance / trailLength, 1.65
          );

          // Many dim streams, a few bright foreground streams.
          const depthLight = 0.22 + Math.pow(depth, 1.5) * 0.78;
          const flicker =
            0.8 + hash(seed + row * 5 + tick) * 0.2;

          const light = fade * depthLight * flicker;

          r = 3 * light;
          g = 235 * light;
          b = 19 * light;

          // Pale green leading symbol.
          if (distance === 0) {
            r = 100 * depthLight;
            g = 255 * depthLight;
            b = 145 * depthLight;
          }

          // Occasional bright character within a trail.
          if (
            distance > 0 &&
            hash(seed + row * 31 + tick) > 0.975
          ) {
            g = Math.min(255, g + 65 * depthLight);
            b += 15 * depthLight;
          }
        }
      }

      // Subtle edge falloff gives the rain more depth.
      const nx = (x - d.width / 2) / (d.width / 2);
      const vignette = 1 - 0.18 * nx * nx;

      d.setPixel(x, y,
        Math.min(255, r * vignette),
        Math.min(255, g * vignette),
        Math.min(255, b * vignette));
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
