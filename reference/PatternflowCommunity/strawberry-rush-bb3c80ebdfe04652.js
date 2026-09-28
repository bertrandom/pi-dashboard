// ===== Patternflow pattern =====
// Title:    Strawberry Rush
// Author:   @martinnlopez
// Date:     2026-08-17
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @knobs PowerBoost=0..1, TakeoffCurve=0..120, Quantity=1..6, StarSize=0..10
// @matrix 64x128

// Pattern: Strawberry Rush (Power Flame & 3D Outer Space Remix)
// Domain Remix — Rocket strawberries starting at 2x size on takeoff and shrinking into outer space with animated rainbow flame thrusters.

function getComponent(h, s, v, offset) {
    let k = ((offset + h * 6.0) % 6.0 + 6.0) % 6.0;
    let c = Math.max(0.0, Math.min(k, 4.0 - k, 1.0));
    return Math.floor(255.0 * v * (1.0 - s * c));
}

function hash(n) {
    let x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
}

// Cubic Bézier curve evaluation helper
function evalCubicX(p, x0, x1, x2, x3) {
    let invP = 1.0 - p;
    return (invP * invP * invP * x0) +
           (3.0 * invP * invP * p * x1) +
           (3.0 * invP * p * p * x2) +
           (p * p * p * x3);
}

export function setup(params) {
    // Knob 1 (PowerBoost): Thrust Speed & Flame Energy (0.0 to 1.0)
    // Knob 2 (TakeoffCurve): Randomize Takeoff Curve Bending (0 to 120)
    // Knob 3 (Quantity): Strawberry Quantity (1 to 6 rockets)
    // Knob 4 (StarSize): Background Space Star Size (0 to 10)
    params.k1 = 0.25; // Lower default power boost for slower speed
    params.k2 = 0.5;
    params.k3 = 0.5;
    params.k4 = 0.5;
    params.timeAcc = 0.0;
    params.canvasW = 128;
    params.canvasH = 64;

    // 17x19 Tilted Pixel-Art Strawberry Sprite Color Index Map
    params.sprite = [
        0,0,0,0,0,0,0,0,0,1,1,0,1,1,0,0,0,
        0,0,0,0,0,0,0,0,1,3,2,1,3,2,1,0,0,
        0,0,0,0,0,0,0,1,3,3,2,3,3,2,1,1,0,
        0,0,0,0,0,0,1,1,2,3,3,2,3,3,2,1,1,
        0,0,0,1,1,1,1,3,3,2,2,3,3,2,1,1,0,
        0,0,1,4,4,4,1,1,1,1,1,1,1,1,1,0,0,
        0,1,4,7,6,4,4,1,4,4,4,4,4,4,1,0,0,
        1,4,7,6,6,4,8,5,4,8,5,4,4,4,5,1,0,
        1,4,6,6,4,5,5,4,5,5,4,8,5,4,5,1,0,
        1,4,4,4,8,5,4,8,5,4,5,5,4,5,5,1,0,
        1,4,8,5,5,4,5,5,4,8,5,4,5,5,5,1,0,
        1,4,5,5,4,8,5,4,5,5,4,8,5,5,5,1,0,
        0,1,4,4,5,5,4,8,5,4,5,5,5,5,1,0,0,
        0,1,4,8,5,4,5,5,4,8,5,5,5,1,0,0,0,
        0,0,1,4,5,5,4,8,5,5,5,5,1,0,0,0,0,
        0,0,0,1,4,8,5,5,5,5,5,1,0,0,0,0,0,
        0,0,0,0,1,4,5,5,5,5,1,0,0,0,0,0,0,
        0,0,0,0,0,1,1,4,5,1,0,0,0,0,0,0,0,
        0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0
    ];

    params.palette = [
        0, 0, 0,       // 0: Transparent
        20, 10, 15,    // 1: Dark Outline
        60, 175, 35,   // 2: Leaf Green
        135, 225, 55,  // 3: Leaf Highlight
        235, 15, 35,   // 4: Red Body
        160, 10, 25,   // 5: Dark Red Shadow
        255, 180, 200, // 6: Specular Pink
        255, 255, 255, // 7: Pure White
        255, 230, 40   // 8: Seed Yellow
    ];

    // Pre-allocated twinkle star positions
    params.stars = [];
    for (let i = 0; i < 30; i++) {
        params.stars.push({
            u: hash(i * 3.17),
            v: hash(i * 7.43),
            baseSize: 1.2 + hash(i * 11.2) * 2.0,
            speed: 1.5 + hash(i * 13.7) * 2.5,
            phase: hash(i * 17.9) * 6.28
        });
    }

    // Pre-allocated rocket objects (max 6)
    params.rockets = [];
    for (let i = 0; i < 6; i++) {
        params.rockets.push({
            progress: 0.05 + i * 0.15,
            duration: 3.5 + i * 0.5,
            flightTime: i * 0.6,
            x0: 20, x1: 30, x2: 40, x3: 50,
            currX: 30, currY: 40,
            scale: 2.0,
            seed: i * 2.37,
            trailWidth: 6.0 + hash(i * 4.1) * 3.5
        });
    }
}

function resetRocket(r, seedVal, w, bendKnob) {
    r.seed = seedVal;
    r.flightTime = 0.0;
    r.duration = 3.2 + hash(seedVal * 1.3) * 2.8; // Longer flight duration for slower launch
    r.progress = 0.0;

    // Launch zones: 0 = Bottom-Left, 1 = Bottom-Middle, 2 = Bottom-Right
    let zone = Math.floor(hash(seedVal * 2.1) * 3.0);
    if (zone === 0) {
        r.x0 = 0.05 * w + hash(seedVal * 3.1) * 0.20 * w;
    } else if (zone === 1) {
        r.x0 = 0.40 * w + hash(seedVal * 3.1) * 0.20 * w;
    } else {
        r.x0 = 0.75 * w + hash(seedVal * 3.1) * 0.20 * w;
    }

    r.x3 = 0.10 * w + hash(seedVal * 4.3) * 0.80 * w;

    // Cubic control point bends
    let curveWildness = 0.2 + bendKnob * 2.2;
    let bend1 = (hash(seedVal * 5.7) - 0.5) * w * 1.5 * curveWildness;
    let bend2 = (hash(seedVal * 6.9) - 0.5) * w * 1.5 * curveWildness;

    r.x1 = r.x0 + bend1;
    r.x2 = r.x3 + bend2;
    r.trailWidth = 5.5 + hash(seedVal * 7.2) * 3.5;
}

export function update(dt, input, params) {
    if (input) {
        if (input.knobNormalized) {
            let norm = input.knobNormalized;
            params.k1 = norm[0]; // Knob 1: PowerBoost
            params.k2 = norm[1]; // Knob 2: TakeoffCurve
            params.k3 = norm[2]; // Knob 3: Quantity
            params.k4 = norm[3]; // Knob 4: StarSize
        } else if (input.knobValues) {
            let v = input.knobValues;
            params.k1 = v[0] > 1.0 ? v[0] / 1.0 : v[0];
            params.k2 = Math.max(0.0, Math.min(1.0, v[1] / 120.0));
            params.k3 = v[2] > 1.0 ? (v[2] - 1.0) / 5.0 : v[2];
            params.k4 = v[3] > 1.0 ? v[3] / 10.0 : v[3];
        }
    }

    // PowerBoost Knob 1 controls launch speed & thrust
    let powerBoost = params.k1;
    let speedMult = 0.25 + powerBoost * 1.5; // Slower base speed multiplier
    params.timeAcc += dt * speedMult;

    let w = params.canvasW;
    let h = params.canvasH;

    // Advance rocket flight progress along cubic trajectories
    for (let i = 0; i < 6; i++) {
        let r = params.rockets[i];
        r.flightTime += dt * speedMult;

        let normTime = r.flightTime / r.duration;
        if (normTime > 1.0) normTime = 1.0;
        
        // Smooth takeoff acceleration
        r.progress = normTime * normTime;

        // 2x Sizing at takeoff (p=0 -> scale=2.0) shrinking down to 0.5x in outer space (p=1 -> scale=0.5)
        r.scale = 2.0 - r.progress * 1.50;

        let p = r.progress;
        r.currX = evalCubicX(p, r.x0, r.x1, r.x2, r.x3);
        r.currY = (1.0 - p) * (h + 35.0) + p * (-45.0);

        if (r.progress >= 1.0) {
            resetRocket(r, r.seed + params.timeAcc + 1.1, w, params.k2);
        }
    }
}

export function draw(display, params, time) {
    let w = display.width;
    let h = display.height;
    let t = params.timeAcc;

    params.canvasW = w;
    params.canvasH = h;

    // Quantity Knob 3 controls active strawberry rocket count (1 to 6)
    let activeRockets = Math.floor(Math.max(1.0, Math.min(6.0, params.k3 * 5.0 + 1.0)));

    // PowerBoost Knob 1 extends flame length
    let powerBoost = params.k1;
    let baseTrailLen = 45.0 + powerBoost * 45.0;

    // StarSize Knob 4 controls Background Star Size multiplier
    let starSizeMult = 0.8 + params.k4 * 3.5;

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            // 1. Soft Pastel Iridescent Gradient Background
            let wave1 = Math.sin(x * 0.06 + t * 0.5);
            let wave2 = Math.cos(y * 0.04 - t * 0.3 + x * 0.02);
            let bgHue = (0.42 + 0.28 * wave1 + 0.14 * wave2 + params.k4 * 0.2) % 1.0;
            let bgSat = 0.38 + 0.18 * Math.sin(x * 0.03 + y * 0.03);
            let bgVal = 0.88 + 0.12 * Math.cos(y * 0.05 - t);

            let r = getComponent(bgHue, bgSat, bgVal, 5);
            let g = getComponent(bgHue, bgSat, bgVal, 3);
            let b = getComponent(bgHue, bgSat, bgVal, 1);

            // 2. Background Space Stars
            let starGlow = 0.0;
            for (let s = 0; s < 26; s++) {
                let st = params.stars[s];
                let sx = st.u * w;
                let sy = st.v * h;
                let dx = Math.abs(x - sx);
                let dy = Math.abs(y - sy);
                let effSize = st.baseSize * starSizeMult;

                if (dx < effSize * 2.2 && dy < effSize * 2.2) {
                    let cross = Math.max(0.0, 1.0 - (dx + dy * 2.2) / effSize) +
                                Math.max(0.0, 1.0 - (dx * 2.2 + dy) / effSize);
                    let twinkle = 0.2 + 0.8 * Math.max(0.0, Math.sin(t * st.speed + st.phase));
                    starGlow = Math.max(starGlow, cross * twinkle);
                }
            }

            if (starGlow > 0.05) {
                let sg = Math.min(1.0, starGlow * 1.1);
                r = Math.floor(r * (1.0 - sg) + 255 * sg);
                g = Math.floor(g * (1.0 - sg) + 255 * sg);
                b = Math.floor(b * (1.0 - sg) + 255 * sg);
            }

            // 3. Animated Rainbow Power Flame Exhaust Plumes
            for (let i = 0; i < activeRockets; i++) {
                let rk = params.rockets[i];
                let sc = rk.scale; // Scaled from 2.0 (takeoff) down to 0.5 (outer space)
                let attachX = rk.currX;
                let attachY = rk.currY + 16.0 * sc;
                let dy = y - attachY;

                let trailLen = baseTrailLen * (0.5 + sc * 0.5);

                if (dy >= 0.0 && dy < trailLen) {
                    let pTrail = rk.progress - (dy / (h + 60.0));
                    if (pTrail < 0.0) pTrail = 0.0;

                    let tx = evalCubicX(pTrail, rk.x0, rk.x1, rk.x2, rk.x3);

                    // Flame Thruster Turbulence
                    let flameFlicker = Math.sin(t * (14.0 + powerBoost * 10.0) - dy * 0.3 + rk.seed) * 0.18 +
                                       Math.cos(t * 20.0 + dy * 0.5) * 0.12;

                    let tRatio = dy / trailLen;
                    let tw = ((rk.trailWidth * sc) + flameFlicker) * (1.0 - tRatio * 0.35);

                    if (dy < 8.0 * sc) {
                        tw = 3.5 * sc + (dy / (8.0 * sc)) * (rk.trailWidth * sc - 3.5 * sc);
                    }

                    let distAcross = Math.abs(x - tx);

                    if (distAcross <= tw) {
                        let uAcross = (x - tx) / tw;
                        let hueTrail = (uAcross * 0.38 + t * (0.25 + powerBoost * 0.35) + dy * 0.02 + rk.seed * 0.2) % 1.0;
                        let fade = (1.0 - tRatio) * (1.0 - (distAcross / tw) * 0.25);

                        let trR = getComponent(hueTrail, 0.95, 1.0, 5);
                        let trG = getComponent(hueTrail, 0.95, 1.0, 3);
                        let trB = getComponent(hueTrail, 0.95, 1.0, 1);

                        // Flame Core Glow
                        let coreGlow = Math.exp(-uAcross * uAcross * 3.2) * (0.6 + 0.4 * Math.sin(t * 12.0 - dy * 0.2));
                        if (dy < 10.0 * sc) {
                            let nozzleGlow = (1.0 - dy / (10.0 * sc)) * (1.0 - distAcross / tw) * (0.8 + powerBoost * 0.4);
                            coreGlow = Math.max(coreGlow, nozzleGlow);
                        }

                        if (coreGlow > 0.1) {
                            let cg = Math.min(1.0, coreGlow);
                            trR = Math.floor(trR * (1.0 - cg) + 255 * cg);
                            trG = Math.floor(trG * (1.0 - cg) + 255 * cg);
                            trB = Math.floor(trB * (1.0 - cg) + (200 + powerBoost * 55) * cg);
                            fade = Math.min(1.0, fade + cg * 0.4);
                        }

                        r = Math.floor(r * (1.0 - fade) + trR * fade);
                        g = Math.floor(g * (1.0 - fade) + trG * fade);
                        b = Math.floor(b * (1.0 - fade) + trB * fade);
                    }
                }
            }

            // 4. 2x Takeoff Sized Rocket Strawberry Sprites (34x38 shrinking into outer space)
            for (let i = 0; i < activeRockets; i++) {
                let rk = params.rockets[i];
                let sc = rk.scale; // Scale factor 2.0 (bottom takeoff) down to 0.5 (outer space)

                let renderW = Math.ceil(17.0 * sc);
                let renderH = Math.ceil(19.0 * sc);

                let rx = Math.floor(rk.currX - (renderW * 0.5));
                let ry = Math.floor(rk.currY);

                if (x >= rx && x < rx + renderW && y >= ry && y < ry + renderH) {
                    let sx = Math.floor((x - rx) / sc);
                    let sy = Math.floor((y - ry) / sc);

                    if (sx >= 0 && sx < 17 && sy >= 0 && sy < 19) {
                        let colorIdx = params.sprite[sy * 17 + sx];

                        if (colorIdx > 0) {
                            let pIdx = colorIdx * 3;
                            let sr = params.palette[pIdx];
                            let sg = params.palette[pIdx + 1];
                            let sb = params.palette[pIdx + 2];

                            // Traveling Glimmer Wave
                            let shimmerWave = Math.sin(t * 10.0 - sy * 0.6 - sx * 0.4 + rk.seed * 2.0);
                            if (shimmerWave > 0.3) {
                                if (colorIdx === 6 || colorIdx === 7) {
                                    sr = 255; sg = 255; sb = 255;
                                } else if (colorIdx === 8) {
                                    sr = 255; sg = 255; sb = 180;
                                } else if (colorIdx === 4 && shimmerWave > 0.8) {
                                    sr = Math.min(255, sr + 70);
                                    sg = Math.min(255, sg + 50);
                                    sb = Math.min(255, sb + 90);
                                }
                            }

                            // Micro Sparkle Glints
                            let glintHash = hash(sx * 17.3 + sy * 37.1 + Math.floor(t * 12.0) * 0.3 + rk.seed);
                            if (glintHash > 0.88 && colorIdx > 1) {
                                sr = 255; sg = 255; sb = 255;
                            }

                            r = sr; g = sg; b = sb;
                        }
                    }
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
