// ===== Patternflow pattern =====
// Title:    Armillary Globe Radar Orbit (3D Spin & Fluid Curve Remix)
// Author:   @martinnlopez
// Date:     2026-09-03
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @knobs FocalX=0..1, FocalY=0..1, GlobeSlices=3..20, RadarGlow=0.1..1
// @matrix 64x128

// Pattern: Armillary Globe Radar Orbit (3D Spin & Fluid Curve Remix)
// Lineage: Fuses 3D rotating sphere in place with fluid curved knob navigation & super delayed trailing ghosts.

function getComponent(h, s, v, offset) {
    let k = ((offset + h * 6.0) % 6.0 + 6.0) % 6.0;
    let c = Math.max(0.0, Math.min(k, 4.0 - k, 1.0));
    return Math.floor(255.0 * v * (1.0 - s * c));
}

export function setup(params) {
    // Knob 1: Simulated Mouse X Goal (0.0 to 1.0)
    // Knob 2: Simulated Mouse Y Goal (0.0 to 1.0)
    // Knob 3: Globe Wireframe Slices & Symmetry Folding (3 to 20)
    // Knob 4: Radar Rings Brightness & Orbit Trail Glow (0.1 to 1.0)
    params.k1 = 0.5;
    params.k2 = 0.5;
    params.k3 = 8.0;
    params.k4 = 0.6;

    params.timeAcc = 0.0;
    params.userX = 0.5;
    params.userY = 0.5;
    params.vx = 0.0;
    params.vy = 0.0;

    // 5 Cascading delayed ghosting positions
    params.ghost1X = 0.5; params.ghost1Y = 0.5;
    params.ghost2X = 0.5; params.ghost2Y = 0.5;
    params.ghost3X = 0.5; params.ghost3Y = 0.5;
    params.ghost4X = 0.5; params.ghost4Y = 0.5;
    params.ghost5X = 0.5; params.ghost5Y = 0.5;

    // Extended 48-stage history trail (6 nodes x 8 samples)
    params.histR = new Float32Array(48);
    params.histA = new Float32Array(48);
}

export function update(dt, input, params) {
    if (input) {
        if (input.knobNormalized) {
            let norm = input.knobNormalized;
            params.k1 = norm[0];
            params.k2 = norm[1];
            params.k3 = 3.0 + norm[2] * 17.0;
            params.k4 = 0.1 + norm[3] * 0.9;
        } else if (input.knobValues) {
            let v = input.knobValues;
            params.k1 = v[0] > 1.0 ? v[0] / 1.0 : v[0];
            params.k2 = v[1] > 1.0 ? v[1] / 1.0 : v[1];
            params.k3 = Math.max(3.0, Math.min(20.0, v[2]));
            params.k4 = Math.max(0.1, Math.min(1.0, v[3]));
        }
    }

    params.timeAcc += dt;

    let goalX = params.k1;
    let goalY = params.k2;

    // Fluid Curved Steering Forces for Knobs 1 & 2 (Arcs & Spirals instead of straight lines)
    let dx = goalX - params.userX;
    let dy = goalY - params.userY;
    let dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0.001) {
        let perpX = -dy / dist;
        let perpY = dx / dist;

        // Oscillating perpendicular curve force
        let curveForce = (Math.sin(params.timeAcc * 2.2) * 0.45 + 0.35) * dist;

        let targetVx = (dx * 3.5 + perpX * curveForce * 4.5);
        let targetVy = (dy * 3.5 + perpY * curveForce * 4.5);

        params.vx += (targetVx - params.vx) * (dt * 5.0);
        params.vy += (targetVy - params.vy) * (dt * 5.0);
    } else {
        params.vx *= 0.88;
        params.vy *= 0.88;
    }

    let speedCap = 1.4;
    params.userX += Math.max(-speedCap, Math.min(speedCap, params.vx)) * dt;
    params.userY += Math.max(-speedCap, Math.min(speedCap, params.vy)) * dt;

    // Super Delayed Cascading Ghost Lerps
    let sp = 0.05 + params.k4 * 0.12;
    params.ghost1X += (params.userX - params.ghost1X) * (sp * 0.38);
    params.ghost1Y += (params.userY - params.ghost1Y) * (sp * 0.38);

    params.ghost2X += (params.ghost1X - params.ghost2X) * (sp * 0.22);
    params.ghost2Y += (params.ghost1Y - params.ghost2Y) * (sp * 0.22);

    params.ghost3X += (params.ghost2X - params.ghost3X) * (sp * 0.12);
    params.ghost3Y += (params.ghost2Y - params.ghost3Y) * (sp * 0.12);

    params.ghost4X += (params.ghost3X - params.ghost4X) * (sp * 0.06);
    params.ghost4Y += (params.ghost3Y - params.ghost4Y) * (sp * 0.06);

    params.ghost5X += (params.ghost4X - params.ghost5X) * (sp * 0.025);
    params.ghost5Y += (params.ghost4Y - params.ghost5Y) * (sp * 0.025);

    // Push 6 nodes (Primary + 5 Ghosts) into 48-stage history
    let px = [params.userX, params.ghost1X, params.ghost2X, params.ghost3X, params.ghost4X, params.ghost5X];
    let py = [params.userY, params.ghost1Y, params.ghost2Y, params.ghost3Y, params.ghost4Y, params.ghost5Y];

    for (let g = 0; g < 6; g++) {
        let pdx = px[g] - 0.5;
        let pdy = py[g] - 0.5;
        let pr = Math.sqrt(pdx * pdx + pdy * pdy);
        let pa = Math.atan2(pdy, pdx) + Math.PI;

        let idx = g * 8;
        for (let k = 7; k > 0; k--) {
            params.histR[idx + k] = params.histR[idx + k - 1];
            params.histA[idx + k] = params.histA[idx + k - 1];
        }
        params.histR[idx] = pr;
        params.histA[idx] = pa;
    }
}

export function draw(display, params, time) {
    let w = display.width;
    let h = display.height;
    let t = params.timeAcc;

    let slices = Math.floor(Math.max(3.0, Math.min(20.0, params.k3)));
    let sectorAngle = (Math.PI * 2.0) / slices;

    let cx = w * 0.5;
    let cy = h * 0.5;
    let maxDimension = Math.min(w, h);

    let globeR = maxDimension * 0.36; // 3D Globe Radius
    let radarGlow = params.k4;

    let innerRadius = (2.0 + radarGlow * 3.5) / maxDimension;
    let outerRadius = (6.0 + radarGlow * 9.5) / maxDimension;

    // 3D Sphere Rotation Angles (Spinning continuously in place)
    let spinY = t * 0.55;                           // Continuous Y-axis spin
    let tiltX = 0.35 + Math.sin(t * 0.25) * 0.15;   // Gentle X-axis 3D tilt
    let cosY = Math.cos(spinY), sinY = Math.sin(spinY);
    let cosX = Math.cos(tiltX), sinX = Math.sin(tiltX);

    for (let y = 0; y < h; y++) {
        let dy = y - cy;
        let ny = dy / globeR;

        for (let x = 0; x < w; x++) {
            let dx = x - cx;
            let nx = dx / globeR;

            let distToCenter = Math.sqrt(dx * dx + dy * dy);
            let normDist = distToCenter / globeR;

            let r = 0, g = 0, b = 0;

            // 1. Outer Concentric Radar Circles
            let radarR1 = Math.abs(normDist - 1.05);
            let radarR2 = Math.abs(normDist - 1.12);
            let radarR3 = Math.abs(normDist - 1.19);
            let radarR4 = Math.abs(normDist - 1.25);
            let radarR5 = Math.abs(normDist - 1.32);
            let radarR6 = Math.abs(normDist - 1.38);
            let radarR7 = Math.abs(normDist - 1.44);

            let lineThresh = 0.03;
            let radarVal = 0.0;

            if (radarR1 < lineThresh) radarVal = Math.max(radarVal, (1.0 - radarR1 / lineThresh) * 1.00);
            if (radarR2 < lineThresh) radarVal = Math.max(radarVal, (1.0 - radarR2 / lineThresh) * 0.31);
            if (radarR3 < lineThresh) radarVal = Math.max(radarVal, (1.0 - radarR3 / lineThresh) * 0.16);
            if (radarR4 < lineThresh) radarVal = Math.max(radarVal, (1.0 - radarR4 / lineThresh) * 0.12);
            if (radarR5 < lineThresh) radarVal = Math.max(radarVal, (1.0 - radarR5 / lineThresh) * 0.04);
            if (radarR6 < lineThresh) radarVal = Math.max(radarVal, (1.0 - radarR6 / lineThresh) * 0.02);
            if (radarR7 < lineThresh) radarVal = Math.max(radarVal, (1.0 - radarR7 / lineThresh) * 0.01);

            if (radarVal > 0.0) {
                let rv = radarVal * radarGlow;
                r = Math.floor(220 * rv);
                g = Math.floor(230 * rv);
                b = Math.floor(255 * rv);
            }

            // 2. True 3D Sphere Rotating in Place (10 Longitude & 10 Latitude lines)
            if (normDist <= 1.0) {
                // Front hemisphere 3D Z coordinate
                let nz = Math.sqrt(Math.max(0.0, 1.0 - nx * nx - ny * ny));

                // 3D Y-axis Spin
                let x1 = nx * cosY + nz * sinY;
                let z1 = -nx * sinY + nz * cosY;
                let y1 = ny;

                // 3D X-axis Tilt
                let x2 = x1;
                let y2 = y1 * cosX - z1 * sinX;
                let z2 = y1 * sinX + z1 * cosX;

                // 3D Longitude & Latitude Wireframe Grids
                let lonVal = Math.abs(Math.sin(Math.atan2(z2, x2) * 5.0));
                let latVal = Math.abs(Math.sin(y2 * 8.0));

                let isLon = (lonVal < 0.18);
                let isLat = (latVal < 0.18);

                if (isLon || isLat) {
                    let lineAlpha = (isLon ? (1.0 - lonVal / 0.18) : (1.0 - latVal / 0.18)) * (0.4 + nz * 0.5);

                    let globeHue = isLon ? (Math.atan2(z2, x2) / (Math.PI * 2.0) + 1.0) % 1.0
                                         : ((210.0 / 360.0) * (y2 * 0.5 + 0.5) + t * 0.05) % 1.0;

                    let gr = getComponent(globeHue, 0.82, 0.95, 5);
                    let gg = getComponent(globeHue, 0.82, 0.95, 3);
                    let gb = getComponent(globeHue, 0.82, 0.95, 1);

                    r = Math.floor(r * (1.0 - lineAlpha) + gr * lineAlpha);
                    g = Math.floor(g * (1.0 - lineAlpha) + gg * lineAlpha);
                    b = Math.floor(b * (1.0 - lineAlpha) + gb * lineAlpha);
                }
            }

            // 3. Super Delayed Chromatic Ghosting Trail (6 Nodes x 8 Samples = 48 History Stages)
            let pDx = dx / maxDimension;
            let pDy = dy / maxDimension;

            let pixR = Math.sqrt(pDx * pDx + pDy * pDy);
            let pixA = Math.atan2(pDy, pDx) + Math.PI;

            let foldA = pixA % sectorAngle;

            let totalCoreGlow = 0.0;
            let totalAuraGlow = 0.0;
            let bestHue = 0.0;

            for (let node = 0; node < 6; node++) {
                let nodeWeight = (node === 0) ? 1.0 : (0.90 - node * 0.14);

                for (let k = 0; k < 8; k++) {
                    let idx = node * 8 + k;
                    let ptR = params.histR[idx];
                    let ptA = params.histA[idx];

                    let ptFoldA = ptA % sectorAngle;

                    let dR = Math.abs(pixR - ptR);
                    let dA = Math.abs(foldA - ptFoldA);
                    if (dA > sectorAngle * 0.5) dA = sectorAngle - dA;

                    let approxDist = Math.sqrt(dR * dR + (pixR * dA) * (pixR * dA));
                    let ageFade = (1.0 - (k / 8.0)) * nodeWeight;

                    if (approxDist < outerRadius) {
                        if (approxDist < innerRadius) {
                            let core = (1.0 - approxDist / innerRadius) * ageFade;
                            totalCoreGlow = Math.max(totalCoreGlow, core);
                        }

                        let aura = (1.0 - approxDist / outerRadius) * ageFade * 0.75;
                        if (aura > totalAuraGlow) {
                            totalAuraGlow = aura;
                            bestHue = (t * 0.35 + node * 0.18 + k * 0.015 + pixR * 1.2) % 1.0;
                        }
                    }
                }
            }

            if (totalAuraGlow > 0.02) {
                let sat = 0.95;
                let val = Math.min(1.0, totalAuraGlow * 1.4);

                let orR = getComponent(bestHue, sat, val, 5);
                let orG = getComponent(bestHue, sat, val, 3);
                let orB = getComponent(bestHue, sat, val, 1);

                let oAlpha = Math.min(1.0, totalAuraGlow * 1.6);
                r = Math.floor(r * (1.0 - oAlpha) + orR * oAlpha);
                g = Math.floor(g * (1.0 - oAlpha) + orG * oAlpha);
                b = Math.floor(b * (1.0 - oAlpha) + orB * oAlpha);

                if (totalCoreGlow > 0.1) {
                    let cg = Math.min(1.0, totalCoreGlow * 1.6);
                    r = Math.floor(r * (1.0 - cg) + 255 * cg);
                    g = Math.floor(g * (1.0 - cg) + 255 * cg);
                    b = Math.floor(b * (1.0 - cg) + 255 * cg);
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
