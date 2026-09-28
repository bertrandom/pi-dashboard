// ===== Patternflow pattern =====
// Title:    Cryptfire Beacon
// Author:   @martinnlopez
// Date:     2026-09-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @knobs Flame=0..1, SkullSize=0.6..2, FlameHue=0..1, EyeBeams=0..1
// @matrix 64x128

// Cryptfire Beacon — 3D rotating laughing skull with sweeping lighthouse eye beams and seamless multi-tonal flame.
// Knob 1: Flame — Fuel injection & reach of the unconstrained flame (0.0 to 1.0)
// Knob 2: SkullSize — Scale of the 8-bit laughing skull (0.6 to 2.0)
// Knob 3: FlameHue — Flame palette mood (0.0: Fiery Orange/Amber, 0.33: Toxic Emerald, 0.66: Glacial Blue, 1.0: Violet)
// Knob 4: EyeBeams — Intensity and reach of the lighthouse eye beams (0.0 to 1.0)

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// 14-Tier Saturated Thermal Ramp (Rich Multi-Hue Orange & Amber without white blowout)
const ORANGE_FIRE_PALETTE = [
  [0, 0, 0],         // Cold Void
  [45, 5, 8],        // Deep Smoldering Maroon
  [105, 12, 10],     // Deep Blood Crimson
  [155, 26, 6],      // Rich Burnt Sienna
  [195, 48, 6],      // Fiery Vermilion
  [225, 75, 5],      // Saturated Deep Orange
  [245, 105, 8],     // Electric Pumpkin Orange
  [255, 135, 12],    // Cadmium Warm Orange
  [255, 162, 18],    // Marigold Amber
  [255, 188, 25],    // Golden Topaz
  [255, 212, 45],    // Solar Yellow-Amber
  [255, 230, 85],    // Pale Warm Gold
  [255, 245, 160],   // Soft Incandescent Highlight
  [255, 252, 220]    // Peak Tip Glow (Micro-fringe only)
];

// Glacial Blue Palette (from palette(3).txt)
const BLUE_FIRE_PALETTE = [
  [0, 0, 0],
  [21, 34, 92],      // #15225c
  [13, 57, 76],      // #0d394c
  [44, 63, 137],     // #2c3f89
  [29, 89, 115],     // #1d5973
  [64, 90, 186],     // #405aba
  [46, 117, 148],    // #2e7594
  [75, 119, 215],    // #4b77d7
  [58, 145, 183],    // #3a91b7
  [108, 148, 225],   // #6c94e1
  [94, 177, 215],    // #5eb1d7
  [161, 183, 246],   // #a1b7f6
  [153, 215, 246],   // #99d7f6
  [210, 229, 250]    // #d2e5fa
];

export function setup(params) {
  params.flame = 0.75;
  params.skullSize = 1.05;
  params.flameHue = 0.0; // Defaults to rich fiery orange
  params.eyeBeams = 0.85;
  params.timeAcc = 0.0;

  // Cellular fire simulation buffer
  params.noise = valueNoise();
  params.fireData = null;
  params.cols = 0;
  params.rows = 0;
  params.rgb = [0, 0, 0];
}

export function update(dt, input, params) {
  if (input && input.knobValues) {
    let v = input.knobValues;
    params.flame = v[0];
    params.skullSize = v[1];
    params.flameHue = v[2];
    params.eyeBeams = v[3];
  }

  if (input && input.btnPressed) {
    if (input.btnPressed[0]) params.flame = 0.75;
    if (input.btnPressed[1]) params.skullSize = 1.05;
    if (input.btnPressed[2]) params.flameHue = 0.0;
    if (input.btnPressed[3]) params.eyeBeams = 0.85;
  }

  params.timeAcc += dt * 0.42;
}

export function draw(display, params, time) {
  const w = display.width;
  const h = display.height;
  const t = params.timeAcc;

  ensureBuffer(display, params);

  // 1. Step seamless perimeter fire simulation
  stepSeamlessFire(params, w, h, time);

  const cx = (w - 1) * 0.5;
  const cy = (h - 1) * 0.5;

  const scale = clamp(params.skullSize, 0.5, 2.2);
  const beamGain = clamp(params.eyeBeams, 0.0, 1.0);

  // Brisk 3D rotation around vertical Y axis
  const rotAngle = t * 2.20;
  const cosRot = Math.cos(rotAngle);
  const sinRot = Math.sin(rotAngle);

  // Hearty laughing jaw articulation with head bob
  const laughMain = Math.pow(Math.max(0.0, Math.sin(t * 12.5)), 1.2) * 4.2;
  const laughBounce = Math.max(0.0, Math.sin(t * 25.0)) * 0.5;
  const jawOpen = laughMain + laughBounce;
  const headBobY = -jawOpen * 0.22;

  // Eye socket 3D anchor points in skull space
  const eyeModelY = 1.0;
  const eye1ModelX = -3.8;
  const eye2ModelX =  3.8;
  const eyeModelZ = 4.8;

  // Eye level locked on screen
  const eyeScreenY = cy + (eyeModelY + headBobY) * scale;

  const eye1ScreenX = cx + (eye1ModelX * cosRot + eyeModelZ * sinRot) * scale;
  const eye1Depth = -eye1ModelX * sinRot + eyeModelZ * cosRot;

  const eye2ScreenX = cx + (eye2ModelX * cosRot + eyeModelZ * sinRot) * scale;
  const eye2Depth = -eye2ModelX * sinRot + eyeModelZ * cosRot;

  const facingZ = cosRot;
  const facingX = sinRot;

  const fireData = params.fireData;
  const scratchRgb = params.rgb;

  for (let y = 0; y < h; y++) {
    const rowOffset = y * w;
    const dyEye = Math.abs(y - eyeScreenY);

    for (let x = 0; x < w; x++) {
      // ==========================================================
      // A. SEAMLESS FIRE RENDER (RICH ORANGE GRADIENTS)
      // ==========================================================
      const heat = fireData[rowOffset + x];
      colorForFlameValue(heat, params.flameHue, scratchRgb);

      let bgR = scratchRgb[0];
      let bgG = scratchRgb[1];
      let bgB = scratchRgb[2];

      // ==========================================================
      // B. LIGHTHOUSE SEARCHLIGHT EYE BEAMS
      // ==========================================================
      if (beamGain > 0.02 && facingZ > -0.35) {
        let beamLight = 0.0;
        let flareLight = 0.0;
        const maxBeamLen = 30.0 + beamGain * 90.0;

        // Process Left Eye Beam
        if (eye1Depth > -2.0) {
          const dx1 = x - eye1ScreenX;
          const dy1 = y - eyeScreenY;
          const dist1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);

          // Lateral sweeping searchlight cone
          if (Math.abs(facingX) > 0.08) {
            const proj1 = dx1 * Math.sign(facingX);
            if (proj1 > 0.0 && proj1 < maxBeamLen) {
              const coneWidth = 1.2 + (proj1 / maxBeamLen) * (6.0 + 8.0 * Math.max(0.0, facingZ));
              if (dyEye < coneWidth * 2.6) {
                const profile = Math.exp(-(dyEye * dyEye) / (2.0 * coneWidth * coneWidth));
                const falloff = 1.0 - (proj1 / maxBeamLen);
                beamLight += profile * falloff * falloff * Math.abs(facingX);
              }
            }
          }

          // Frontal headlight flare when facing camera
          if (facingZ > 0.05) {
            const frontConeW = 2.0 + dist1 * 0.42;
            const frontFlare = Math.exp(-(dy1 * dy1) / (2.0 * frontConeW * frontConeW))
                             * Math.exp(-dist1 / (32.0 + beamGain * 45.0))
                             * (facingZ * facingZ);
            beamLight += frontFlare * 1.5;
          }

          // Central bulb pupil glow
          if (dist1 < 8.0) {
            flareLight += Math.exp(-(dist1 * dist1) / 5.5) * (1.0 + 1.5 * Math.max(0.0, facingZ));
          }
        }

        // Process Right Eye Beam
        if (eye2Depth > -2.0) {
          const dx2 = x - eye2ScreenX;
          const dy2 = y - eyeScreenY;
          const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

          if (Math.abs(facingX) > 0.08) {
            const proj2 = dx2 * Math.sign(facingX);
            if (proj2 > 0.0 && proj2 < maxBeamLen) {
              const coneWidth = 1.2 + (proj2 / maxBeamLen) * (6.0 + 8.0 * Math.max(0.0, facingZ));
              if (dyEye < coneWidth * 2.6) {
                const profile = Math.exp(-(dyEye * dyEye) / (2.0 * coneWidth * coneWidth));
                const falloff = 1.0 - (proj2 / maxBeamLen);
                beamLight += profile * falloff * falloff * Math.abs(facingX);
              }
            }
          }

          if (facingZ > 0.05) {
            const frontConeW = 2.0 + dist2 * 0.42;
            const frontFlare = Math.exp(-(dy2 * dy2) / (2.0 * frontConeW * frontConeW))
                             * Math.exp(-dist2 / (32.0 + beamGain * 45.0))
                             * (facingZ * facingZ);
            beamLight += frontFlare * 1.5;
          }

          if (dist2 < 8.0) {
            flareLight += Math.exp(-(dist2 * dist2) / 5.5) * (1.0 + 1.5 * Math.max(0.0, facingZ));
          }
        }

        const totalBeam = (beamLight * 1.35 + flareLight * 1.6) * beamGain;
        if (totalBeam > 0.01) {
          bgR = clamp(bgR + Math.floor(totalBeam * 255), 0, 255);
          bgG = clamp(bgG + Math.floor(totalBeam * 28 + flareLight * 190), 0, 255);
          bgB = clamp(bgB + Math.floor(totalBeam * 22 + flareLight * 120), 0, 255);
        }
      }

      // ==========================================================
      // C. 3D ROTATING SKULL WITH HINGED JAW
      // ==========================================================
      const sx = (x - cx) / scale;
      const sy = (y - cy) / scale - headBobY;
      const qx = Math.round(sx);
      const qy = Math.round(sy);

      let hit = false;
      let hitZ = -99.0;
      let hitType = 0; // 1: Bone, 2: Teeth, 3: Cavity

      if (Math.abs(qx) <= 16 && Math.abs(qy) <= 18) {
        for (let z = 12.0; z >= -12.0; z -= 1.4) {
          const mX = qx * cosRot - z * sinRot;
          const mZ = qx * sinRot + z * cosRot;
          const mY = qy;

          // Cranium Dome
          const cyAdj = mY + 3.0;
          const czAdj = (mZ < 0.0) ? mZ * 0.9 : mZ;
          const craniumDist = (mX * mX) / 105.0 + (cyAdj * cyAdj) / 115.0 + (czAdj * czAdj) / 105.0;
          const inCranium = (craniumDist <= 1.0);

          // Cheeks & Maxilla with Menacing Brow
          let inMaxilla = false;
          if (mY >= -1.0 && mY <= 7.2 && mZ >= -1.5 && mZ <= 7.2) {
            const maxW = (mY < 3.0) ? 8.6 : (8.6 - (mY - 3.0) * 0.75);
            if (Math.abs(mX) <= maxW && mZ <= 6.5) {
              inMaxilla = true;
            }
          }

          // Hinged Mandible permanently anchored at rear joint
          let inMandible = false;
          if (mY >= 4.5 && mY <= (8.5 + jawOpen * 0.28) && mZ >= -2.5 && mZ <= 1.5) {
            if (Math.abs(Math.abs(mX) - 5.5) <= 1.3) {
              inMandible = true;
            }
          }

          const chinY = 9.2 + jawOpen;
          if (mY >= (7.0 + jawOpen * 0.45) && mY <= (chinY + 2.5) && mZ >= -1.5 && mZ <= 6.8) {
            const jawFrac = clamp((mZ + 1.5) / 8.0, 0.0, 1.0);
            const expectedY = 7.5 + jawFrac * (chinY - 7.5);
            if (Math.abs(mY - expectedY) <= 1.8) {
              const jawWidth = 5.8 - jawFrac * 1.5;
              if (Math.abs(mX) <= jawWidth) {
                inMandible = true;
              }
            }
          }

          const isSolid = inCranium || inMaxilla || inMandible;

          if (isSolid) {
            // Angled Menacing Eye Socket Cavities
            if (mZ >= 2.0 && mY >= -0.8 && mY <= 2.8) {
              const browSlant = (Math.abs(mX) - 3.8) * 0.25;
              const eDx = Math.abs(mX) - 3.8;
              const eDy = mY - (1.0 + browSlant);
              if (eDx * eDx + eDy * eDy <= 6.8) {
                hit = true; hitZ = z; hitType = 3;
                break;
              }
            }

            // Triangular Nasal Aperture
            if (mZ >= 2.8 && mY >= 3.0 && mY <= 5.8) {
              const nW = Math.max(0.5, (mY - 3.0) * 0.5);
              if (Math.abs(mX) <= nW) {
                hit = true; hitZ = z; hitType = 3;
                break;
              }
            }

            // Open Mouth Cavern
            if (jawOpen > 0.8 && mY > 6.8 && mY < (6.8 + jawOpen) && mZ >= 1.0) {
              if (Math.abs(mX) <= 4.8) {
                hit = true; hitZ = z; hitType = 3;
                break;
              }
            }

            // Dental Arches
            const isUpperTeeth = (mY >= 5.8 && mY <= 7.0 && mZ >= 3.4 && Math.abs(mX) <= 4.2);
            const lowerTeethY = 7.0 + jawOpen;
            const isLowerTeeth = (mY >= (lowerTeethY - 0.4) && mY <= (lowerTeethY + 1.0) && mZ >= 3.0 && Math.abs(mX) <= 3.8);

            hit = true;
            hitZ = z;
            hitType = (isUpperTeeth || isLowerTeeth) ? 2 : 1;
            break;
          }
        }
      }

      // Final pixel assignment
      if (hit) {
        if (hitType === 3) {
          let cavR = 10;
          let cavG = 8;
          let cavB = 14;

          if (facingZ > -0.35) {
            const d1 = (x - eye1ScreenX) * (x - eye1ScreenX) + (y - eyeScreenY) * (y - eyeScreenY);
            const d2 = (x - eye2ScreenX) * (x - eye2ScreenX) + (y - eyeScreenY) * (y - eyeScreenY);
            if (d1 < 7.0 || d2 < 7.0) {
              cavR = 255;
              cavG = Math.floor(180 * beamGain);
              cavB = Math.floor(80 * beamGain);
            }
          }

          display.setPixel(x, y, cavR, cavG, cavB);
        } else if (hitType === 2) {
          const mX = qx * cosRot - hitZ * sinRot;
          const toothSeam = (Math.abs(mX) % 1.4 < 0.28);
          if (toothSeam) {
            display.setPixel(x, y, 42, 38, 35);
          } else {
            display.setPixel(x, y, 250, 248, 236);
          }
        } else {
          let diffuse = 0.52 + 0.48 * (hitZ / 12.0) - 0.12 * (qy / 14.0);
          diffuse = clamp(diffuse, 0.35, 1.0);

          const boneStep = Math.floor(diffuse * 4.0) / 4.0;
          const boneR = Math.floor(230 * boneStep);
          const boneG = Math.floor(224 * boneStep);
          const boneB = Math.floor(210 * boneStep);

          if (Math.abs(hitZ) < 0.9) {
            display.setPixel(x, y, 35, 30, 28);
          } else {
            display.setPixel(x, y, boneR, boneG, boneB);
          }
        }
      } else {
        display.setPixel(x, y, bgR, bgG, bgB);
      }
    }
  }
}

// =====================================================================
// SEAMLESS 2D CORNER-BLENDED CELLULAR FIRE SIMULATION
// =====================================================================

function ensureBuffer(display, params) {
  const cols = display.width;
  const rows = display.height;
  if (cols !== params.cols || rows !== params.rows || !params.fireData) {
    params.cols = cols;
    params.rows = rows;
    params.fireData = new Float32Array(cols * rows);
  }
}

function stepSeamlessFire(params, cols, rows, time) {
  const data = params.fireData;
  const noise = params.noise;
  const flameGain = clamp(params.flame, 0.0, 1.0);
  const fuelMax = 25.0 + flameGain * 60.0;
  const t = time * 2.4;

  // 1. Seed fuel along all 4 perimeter borders
  for (let x = 0; x < cols; x++) {
    const targetTop = Math.floor(mapRange(noise(x * 0.08, t), 0, 1, 4, fuelMax));
    data[x] = Math.min(targetTop, data[x] + 4);

    const botIdx = (rows - 1) * cols + x;
    const targetBot = Math.floor(mapRange(noise(x * 0.08 + 10.0, t), 0, 1, 4, fuelMax));
    data[botIdx] = Math.min(targetBot, data[botIdx] + 4);
  }

  for (let y = 0; y < rows; y++) {
    const leftIdx = y * cols;
    const targetLeft = Math.floor(mapRange(noise(y * 0.08 + 20.0, t), 0, 1, 4, fuelMax));
    data[leftIdx] = Math.min(targetLeft, data[leftIdx] + 4);

    const rightIdx = y * cols + (cols - 1);
    const targetRight = Math.floor(mapRange(noise(y * 0.08 + 30.0, t), 0, 1, 4, fuelMax));
    data[rightIdx] = Math.min(targetRight, data[rightIdx] + 4);
  }

  // 2. Smooth 2D Bilinear Corner Diffusion (Eliminates diagonal seams)
  for (let y = 1; y < rows - 1; y++) {
    const distY = Math.min(y, rows - 1 - y);
    const rowOffset = y * cols;
    const stepY = (y < rows * 0.5) ? -1 : 1;

    for (let x = 1; x < cols - 1; x++) {
      const distX = Math.min(x, cols - 1 - x);
      const stepX = (x < cols * 0.5) ? -1 : 1;

      const denom = distX + distY + 0.001;
      const weightH = distY / denom;
      const weightV = distX / denom;

      const randDrift = Math.round(rndf(-1.0, 1.0));

      const srcHX = clamp(x + stepX, 0, cols - 1);
      const srcHY = clamp(y + randDrift, 0, rows - 1);
      const heatH = data[srcHY * cols + srcHX];

      const srcVX = clamp(x + randDrift, 0, cols - 1);
      const srcVY = clamp(y + stepY, 0, rows - 1);
      const heatV = data[srcVY * cols + srcVX];

      const srcDiagX = clamp(x + stepX, 0, cols - 1);
      const srcDiagY = clamp(y + stepY, 0, rows - 1);
      const heatDiag = data[srcDiagY * cols + srcDiagX];

      const cornerFactor = 4.0 * (distX / denom) * (distY / denom);
      const edgeBlend = heatH * weightH + heatV * weightV;
      const srcHeat = edgeBlend * (1.0 - cornerFactor * 0.45) + heatDiag * (cornerFactor * 0.45);

      const minEdgeDist = Math.min(distX, distY);
      const cooling = rndf(1.4, 3.2) + (minEdgeDist / 13.0) * (2.8 - flameGain * 1.4);
      data[rowOffset + x] = Math.max(0.0, srcHeat - cooling);
    }
  }
}

// Full-Range Thermal Color Mapping (Stretches the heat across rich saturated orange tiers)
function colorForFlameValue(u, hueParam, out) {
  if (u <= 0.05) {
    out[0] = 0; out[1] = 0; out[2] = 0;
    return;
  }

  // Smoothly scales heat across all 13 intervals without pre-clamping to white
  const maxIdx = ORANGE_FIRE_PALETTE.length - 1;
  const scaled = (u / 75.0) * maxIdx;
  const uc = clamp(scaled, 0.0, maxIdx);
  const i0 = Math.floor(uc);
  const i1 = Math.min(maxIdx, i0 + 1);
  const f = uc - i0;

  // Choose between Orange, Glacial Blue, or smooth hue blend based on Knob 3
  const isBlueMode = (hueParam > 0.45 && hueParam < 0.85);
  const activePalette = isBlueMode ? BLUE_FIRE_PALETTE : ORANGE_FIRE_PALETTE;

  const c0 = activePalette[i0];
  const c1 = activePalette[i1];

  let rBase = (c0[0] + (c1[0] - c0[0]) * f);
  let gBase = (c0[1] + (c1[1] - c0[1]) * f);
  let bBase = (c0[2] + (c1[2] - c0[2]) * f);

  // Knob 3 subtle fine-tune (if not pure orange or blue)
  if (hueParam > 0.05 && !isBlueMode) {
    const shift = hueParam * 6.2831853;
    const cosS = Math.cos(shift);
    const sinS = Math.sin(shift);
    const rRot = rBase * (0.299 + 0.701 * cosS + 0.168 * sinS)
               + gBase * (0.587 - 0.587 * cosS + 0.330 * sinS)
               + bBase * (0.114 - 0.114 * cosS - 0.497 * sinS);
    const gRot = rBase * (0.299 - 0.299 * cosS - 0.328 * sinS)
               + gBase * (0.587 + 0.413 * cosS + 0.035 * sinS)
               + bBase * (0.114 - 0.114 * cosS + 0.288 * sinS);
    const bRot = rBase * (0.299 - 0.300 * cosS + 1.250 * sinS)
               + gBase * (0.587 - 0.588 * cosS - 1.050 * sinS)
               + bBase * (0.114 + 0.886 * cosS - 0.203 * sinS);

    out[0] = clamp(Math.floor(rRot), 0, 255);
    out[1] = clamp(Math.floor(gRot), 0, 255);
    out[2] = clamp(Math.floor(bRot), 0, 255);
  } else {
    out[0] = Math.floor(rBase);
    out[1] = Math.floor(gBase);
    out[2] = Math.floor(bBase);
  }
}

// Value Noise Generator
function valueNoise() {
  const tableSize = 256;
  const r = new Array(tableSize);
  const permutationTable = new Array(tableSize * 2);
  for (let k = 0; k < tableSize; k++) {
    r[k] = Math.random();
    permutationTable[k] = k;
  }
  for (let k = 0; k < tableSize; k++) {
    const i = Math.floor(Math.random() * tableSize);
    const tmp = permutationTable[k];
    permutationTable[k] = permutationTable[i];
    permutationTable[i] = tmp;
    permutationTable[k + tableSize] = permutationTable[k];
  }
  return function (px, py) {
    const xi = Math.floor(px);
    const yi = Math.floor(py);
    const tx = px - xi;
    const ty = py - yi;
    const rx0 = ((xi % tableSize) + tableSize) % tableSize;
    const rx1 = (rx0 + 1) % tableSize;
    const ry0 = ((yi % tableSize) + tableSize) % tableSize;
    const ry1 = (ry0 + 1) % tableSize;
    const c00 = r[permutationTable[permutationTable[rx0] + ry0]];
    const c10 = r[permutationTable[permutationTable[rx1] + ry0]];
    const c01 = r[permutationTable[permutationTable[rx0] + ry1]];
    const c11 = r[permutationTable[permutationTable[rx1] + ry1]];
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);
    const nx0 = c00 + (c10 - c00) * sx;
    const nx1 = c01 + (c11 - c01) * sx;
    return nx0 + (nx1 - nx0) * sy;
  };
}

function mapRange(v, inMin, inMax, outMin, outMax) {
  return outMin + (v - inMin) * (outMax - outMin) / (inMax - inMin);
}

function rndf(a, b) {
  return a + Math.random() * (b - a);
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
