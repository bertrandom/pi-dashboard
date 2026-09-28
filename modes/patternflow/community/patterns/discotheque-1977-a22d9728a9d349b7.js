// ===== Patternflow pattern =====
// Title:    Discotheque 1977
// Author:   @martinnlopez
// Date:     2026-09-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @knobs Glitch=0..1, Speed=0.05..5, Freq=10..120, Quantize=2..10
// @matrix 128x128
// Discotheque 1977 (Studio 8-Color Edition) — 3D dance hall room with dual-cluster volumetric light beams & mirror facet glints.
// Merges the perspective room environment with the exact 8-color studio palette and Gaussian beam physics.
// Photosensitive safety: Rotation speeds are clamped strictly below 0.38 Hz for a smooth, calming cruise.
// Knob 1: Beams — Density of radiating volumetric light shafts (8 to 24)
// Knob 2: Speed — Rotation tempo (0.0 to 5.0, clamped to a soothing 0.08–0.36 Hz)
// Knob 3: Reach — Beam projection length & dance hall room depth (0.5 to 2.2 / 10.0 to 120.0)
// Knob 4: Shimmer — Intensity of mirror facet glints & counter-rotating beam overlaps (0.0 to 1.0 / 2.0 to 10.0)

export function setup(params) {
  params.t = 0.0;
  params.k = [16.0, 1.2, 1.25, 0.7];

  // Exact 8-color studio palette:
  // 0: Amber (#c45d00),      1: Ice Cyan (#c7e4eb),
  // 2: Vermilion (#ec2d00),  3: Sage Green (#7c8e69),
  // 4: Aqua (#00ddff),       5: Blush Peach (#e6bdb3),
  // 6: Teal (#00bfa5),       7: Golden Brass (#dab300)
  params.pal = new Uint8Array([
    196,  93,   0,
    199, 228, 235,
    236,  45,   0,
    124, 142, 105,
      0, 221, 255,
    230, 189, 179,
      0, 191, 165,
    218, 179,   0
  ]);
}

export function update(dt, input, params) {
  if (input && input.knobValues) {
    const v = input.knobValues;

    // Knob 1: Beams (handles both 0..1 and 8..24 ranges)
    params.k[0] = (v[0] <= 1.0) ? 8.0 + v[0] * 16.0 : Math.min(24.0, Math.max(8.0, v[0]));

    // Knob 2: Speed
    params.k[1] = v[1];

    // Knob 3: Reach (handles both 0.5..2.2 and 10..120 ranges)
    params.k[2] = (v[2] >= 10.0) ? 0.6 + ((v[2] - 10.0) / 110.0) * 1.5 : Math.max(0.5, v[2]);

    // Knob 4: Shimmer (handles both 0..1 and 2..10 ranges)
    params.k[3] = (v[3] >= 2.0) ? (v[3] - 2.0) / 8.0 : Math.max(0.0, Math.min(1.0, v[3]));
  }

  if (input && input.btnPressed) {
    if (input.btnPressed[0]) params.k[0] = 16.0;
    if (input.btnPressed[1]) params.k[1] = 1.2;
    if (input.btnPressed[2]) params.k[2] = 1.25;
    if (input.btnPressed[3]) params.k[3] = 0.7;
  }

  // Photosensitive safety: keep rotational tempo strictly between 0.08 and 0.36 Hz
  const rawSpeed = params.k[1];
  const safeSpeed = 0.08 + Math.min(1.0, rawSpeed * 0.45) * 0.28;
  params.t += dt * safeSpeed;
}

export function draw(display, params, time) {
  const w = display.width;
  const h = display.height;
  const t = params.t;
  const pal = params.pal;

  const numBeams = Math.max(8, Math.floor(params.k[0]));
  const reach = params.k[2];
  const shimmer = params.k[3];

  const cx = (w - 1) * 0.5;
  const cy = (h - 1) * 0.5;
  const cyBall = cy - 2.0;

  const minDim = Math.min(w, h);
  const rBall = minDim * 0.18;
  const maxReach = minDim * (0.75 * reach);

  // Dual rotating beam cluster angular headings
  const rot1 = t * 0.55;
  const rot2 = -t * 0.38 + 1.2;

  const dTheta1 = 6.2831853 / numBeams;
  const numBeams2 = Math.floor(numBeams * 1.4);
  const dTheta2 = 6.2831853 / numBeams2;

  // Smooth Gaussian beam profiles to prevent sharp edge flashing
  const beamSigma1 = dTheta1 * 0.26;
  const beamSigma2 = dTheta2 * 0.22;

  const corridorAspect = (h * 0.44) / (w * 0.36);

  for (let y = 0; y < h; y++) {
    const dy = y - cyBall;
    const dyCenter = y - cy;

    for (let x = 0; x < w; x++) {
      const dx = x - cx;
      const r = Math.sqrt(dx * dx + dy * dy);
      const theta = Math.atan2(dy, dx);

      // Deep dark ambient discotheque backdrop
      let rOut = 4.0;
      let gOut = 5.0;
      let bOut = 9.0;

      // ==========================================================
      // 1. PERSPECTIVE ROOM BACKGROUND (Walls, Floor, Ceiling)
      // ==========================================================
      const absDx = Math.abs(dx);
      const slope = absDx > 0.001 ? Math.abs(dyCenter) / absDx : 999.0;

      if (slope < corridorAspect) {
        // SIDE WALL EQUALIZERS (Gentle neon ambient swells)
        const side = dx < 0 ? -1.0 : 1.0;
        const wallZ = (w * 0.5) / Math.max(absDx, 0.5);
        const wallV = dyCenter * (wallZ / (h * 0.5));

        const colCoord = wallZ * 1.4;
        const rowCoord = (wallV + 15.0) * 1.8;

        const cIdx = Math.floor(colCoord);
        const rIdx = Math.floor(rowCoord);
        const cFrac = colCoord - cIdx;
        const rFrac = rowCoord - rIdx;

        const isWallSeam = (cFrac < 0.22 || rFrac < 0.22);
        const eqPulse = Math.sin(cIdx * 0.75 - t * 1.2 + side * 1.4) * 0.5 + 0.5;
        const isLit = (Math.abs(rIdx - 15) < eqPulse * 7.5);

        const palIdx = ((cIdx + rIdx) % 8) * 3;

        if (isWallSeam) {
          rOut += 3.0; gOut = 2.0; bOut += 5.0;
        } else if (isLit) {
          rOut += pal[palIdx] * 0.35;
          gOut += pal[palIdx + 1] * 0.35;
          bOut += pal[palIdx + 2] * 0.35;
        } else {
          rOut += pal[palIdx] * 0.04;
          gOut += pal[palIdx + 1] * 0.04;
          bOut += pal[palIdx + 2] * 0.04;
        }
      } else if (dyCenter > 0.0) {
        // DANCE FLOOR (Concentric swirling light squares)
        const floorZ = (h * 0.5) / Math.max(dyCenter, 0.5);
        const floorX = dx * (floorZ / (w * 0.5));
        const floorY = floorZ - 1.1;

        const rF = Math.sqrt(floorX * floorX + floorY * floorY);
        const phiF = Math.atan2(floorX, floorY) + t * 0.5;

        const ringCoord = rF * 2.1;
        const ringIdx = Math.floor(ringCoord);
        const ringFrac = ringCoord - ringIdx;

        const spotsInRing = 8 + ringIdx * 5;
        const spotCoord = (((phiF / 6.2831853) % 1.0 + 1.0) % 1.0) * spotsInRing;
        const spotIdx = Math.floor(spotCoord);
        const spotFrac = spotCoord - spotIdx;

        const inTile = (ringFrac > 0.24 && ringFrac < 0.84 && spotFrac > 0.24 && spotFrac < 0.84);

        if (inTile) {
          const palIdx = ((ringIdx * 2 + spotIdx) % 8) * 3;
          rOut += pal[palIdx] * 0.45;
          gOut += pal[palIdx + 1] * 0.45;
          bOut += pal[palIdx + 2] * 0.45;
        } else {
          // Glossy floor ambient reflection
          rOut += 6.0; gOut += 4.0; bOut += 12.0;
        }
      } else {
        // CEILING (Concentric panels above the disco ball)
        const ceilZ = (h * 0.5) / Math.max(-dyCenter, 0.5);
        const ceilX = dx * (ceilZ / (w * 0.5));
        const ceilY = ceilZ - 1.1;

        const rC = Math.sqrt(ceilX * ceilX + ceilY * ceilY);
        const phiC = Math.atan2(ceilX, ceilY) - t * 0.4;

        const ringCoordC = rC * 1.8;
        const ringIdxC = Math.floor(ringCoordC);
        const ringFracC = ringCoordC - ringIdxC;

        const spotsInRingC = 7 + ringIdxC * 4;
        const spotCoordC = (((phiC / 6.2831853) % 1.0 + 1.0) % 1.0) * spotsInRingC;
        const spotIdxC = Math.floor(spotCoordC);
        const spotFracC = spotCoordC - spotIdxC;

        if (ringFracC > 0.26 && ringFracC < 0.84 && spotFracC > 0.26 && spotFracC < 0.84) {
          const palIdx = ((ringIdxC + spotIdxC * 2) % 8) * 3;
          rOut += pal[palIdx] * 0.32;
          gOut += pal[palIdx + 1] * 0.32;
          bOut += pal[palIdx + 2] * 0.32;
        }
      }

      // ==========================================================
      // 2. PRIMARY CLOCKWISE VOLUMETRIC LIGHT BEAMS
      // ==========================================================
      if (r > rBall * 0.65) {
        const normAngle1 = (theta - rot1) / dTheta1;
        const k1 = Math.round(normAngle1);
        const angDist1 = (normAngle1 - k1) * dTheta1;

        const beamProfile1 = Math.exp(-(angDist1 * angDist1) / (2.0 * beamSigma1 * beamSigma1));

        if (beamProfile1 > 0.02) {
          const beamSeed = ((k1 % 8) + 8) % 8;
          const breathe1 = Math.sin(t * 1.1 + beamSeed * 1.618) * 0.5 + 0.5;
          const beamReach1 = maxReach * (0.55 + breathe1 * 0.45);

          const radFade1 = Math.exp(-Math.pow(Math.max(0.0, r - rBall) / beamReach1, 1.8));
          const beamInt1 = beamProfile1 * radFade1 * (0.45 + breathe1 * 0.55);

          const o1 = beamSeed * 3;
          rOut += pal[o1] * beamInt1;
          gOut += pal[o1 + 1] * beamInt1;
          bOut += pal[o1 + 2] * beamInt1;
        }

        // ==========================================================
        // 3. SECONDARY COUNTER-ROTATING SHIMMER BEAMS
        // ==========================================================
        if (shimmer > 0.04) {
          const normAngle2 = (theta - rot2) / dTheta2;
          const k2 = Math.round(normAngle2);
          const angDist2 = (normAngle2 - k2) * dTheta2;

          const beamProfile2 = Math.exp(-(angDist2 * angDist2) / (2.0 * beamSigma2 * beamSigma2));

          if (beamProfile2 > 0.025) {
            const beamSeed2 = (((k2 + 3) % 8) + 8) % 8;
            const breathe2 = Math.cos(t * 0.95 + beamSeed2 * 2.1) * 0.5 + 0.5;
            const beamReach2 = maxReach * (0.45 + breathe2 * 0.45);

            const radFade2 = Math.exp(-Math.pow(Math.max(0.0, r - rBall) / beamReach2, 1.8));
            const beamInt2 = beamProfile2 * radFade2 * (0.35 + breathe2 * 0.65) * shimmer;

            const o2 = beamSeed2 * 3;
            rOut += pal[o2] * beamInt2;
            gOut += pal[o2 + 1] * beamInt2;
            bOut += pal[o2 + 2] * beamInt2;
          }
        }
      }

      // ==========================================================
      // 4. CENTRAL DISCO BALL & MIRROR FACET GLINTS
      // ==========================================================
      if (r <= rBall * 1.18) {
        if (r < rBall) {
          // 3D Sphere Normal & Curvature
          const sphereZ = Math.sqrt(Math.max(0.0, 1.0 - (r / rBall) * (r / rBall)));

          // Moving grid of mirror tiles across the sphere surface
          const uFacet = Math.sin(theta * 2.0 + t * 0.65) * (r / rBall);
          const vFacet = (dy / rBall) + Math.cos(t * 0.3) * 0.12;
          const facetGrid = Math.sin(uFacet * 18.0) * Math.cos(vFacet * 18.0);

          let coreR = 16.0 * sphereZ;
          let coreG = 18.0 * sphereZ;
          let coreB = 26.0 * sphereZ;

          // Mirror facets catching the light with studio palette glints
          if (facetGrid > 0.52) {
            const glintInt = (facetGrid - 0.52) * 2.2 * sphereZ * (0.65 + 0.35 * shimmer);
            const glintIdx = (Math.floor(Math.abs(uFacet * 8.0 + t * 0.4)) % 8) * 3;

            coreR += pal[glintIdx] * glintInt * 0.85;
            coreG += pal[glintIdx + 1] * glintInt * 0.85;
            coreB += pal[glintIdx + 2] * glintInt * 0.85;
          }

          rOut = Math.max(rOut * 0.4, coreR);
          gOut = Math.max(gOut * 0.4, coreG);
          bOut = Math.max(bOut * 0.4, coreB);
        }

        // Soft halo rim where beams emerge from the ball edge
        const rimDist = Math.abs(r - rBall);
        if (rimDist < 2.4) {
          const rimInt = (1.0 - rimDist / 2.4) * 0.45;
          rOut += 180.0 * rimInt;
          gOut += 210.0 * rimInt;
          bOut += 230.0 * rimInt;
        }
      }

      // 5. Disco ball suspension chain
      if (Math.abs(dx) < 0.75 && dy < -rBall) {
        const link = (Math.sin(y * 1.5) > 0.0) ? 175.0 : 120.0;
        rOut = link;
        gOut = link;
        bOut = link + 15.0;
      }

      display.setPixel(
        x, y,
        Math.min(255, Math.floor(rOut)),
        Math.min(255, Math.floor(gOut)),
        Math.min(255, Math.floor(bOut))
      );
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
