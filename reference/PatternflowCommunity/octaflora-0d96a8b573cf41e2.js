// ===== Patternflow pattern =====
// Title:    OctaFlora
// Author:   @martinnlopez
// Date:     2026-09-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @knobs Morph=0..1, Speed=0..5, Freq=10..120, Twinkle=2..10
// @matrix 64x128

// OctaFlora — rhythmic 8-fold kaleidoscopic LED mandala with morphing rosettes and ambient twinkle.
// Designed with calm, soothing, photosafe breathing dynamics strictly below 0.35 Hz.
// Knob 1: Morph — Mandala Symmetry & Petal Morph (0.0: Concentric Rings, 0.5: 8-Fold Rosette, 1.0: Starburst Diamonds)
// Knob 2: Speed — Pulse & Wave Tempo (0.0 to 5.0, clamped to a safe 0.08–0.32 Hz)
// Knob 3: Freq — Radial Wave Frequency & Ring Density (10.0 to 120.0)
// Knob 4: Twinkle — Ambient Twinkle Density & Palette Warmth (2.0 to 10.0)

function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

export function setup(params) {
    params.morph = 0.45;
    params.speed = 1.3;
    params.freq = 46.0;
    params.twinkle = 5.5;
    params.timeAcc = 0.0;
}

export function update(dt, input, params) {
    if (input && input.knobValues) {
        let v = input.knobValues;
        params.morph = v[0];
        params.speed = v[1];
        params.freq = v[2];

        // Gracefully handles both 2.0–10.0 and 0.0–1.0 slider configurations
        params.twinkle = (v[3] >= 2.0) ? (v[3] - 2.0) / 8.0 : v[3];
    }

    if (input && input.btnPressed) {
        if (input.btnPressed[0]) params.morph = 0.45;
        if (input.btnPressed[1]) params.speed = 1.3;
        if (input.btnPressed[2]) params.freq = 46.0;
        if (input.btnPressed[3]) params.twinkle = 0.45;
    }

    // Strictly clamped to a calm, soothing pulse rate (0.08 to 0.32 Hz)
    let safeSpeedFactor = 0.08 + clamp(params.speed / 5.0, 0.0, 1.0) * 0.24;
    params.timeAcc += dt * safeSpeedFactor;
}

export function draw(display, params, time) {
    let w = display.width;
    let h = display.height;
    let t = params.timeAcc;

    let cx = (w - 1) * 0.5;
    let cy = (h - 1) * 0.5;

    // Normalize Knob 3 (10.0 to 120.0) into radial wave density
    let fNorm = (params.freq >= 10.0) ? clamp((params.freq - 10.0) / 110.0, 0.0, 1.0) : clamp(params.freq, 0.0, 1.0);
    let waveFreq = 0.12 + fNorm * 0.28;

    let morphVal = clamp(params.morph, 0.0, 1.0);
    let twinkleGain = clamp(params.twinkle, 0.0, 1.0);

    // Continuous breathing shape modulation
    let shapeCycle = 0.5 + 0.5 * Math.sin(t * 0.75);
    let effectiveMorph = morphVal * 0.65 + shapeCycle * 0.35;

    let maxRadius = Math.sqrt(cx * cx + cy * cy);

    let r = 0;
    let g = 0;
    let b = 0;

    for (let y = 0; y < h; y++) {
        let dy = y - cy;
        let absDy = Math.abs(dy);
        let dySq = dy * dy;

        for (let x = 0; x < w; x++) {
            let dx = x - cx;
            let absDx = Math.abs(dx);
            let radDist = Math.sqrt(dx * dx + dySq);
            let theta = Math.atan2(dy, dx);

            // ==========================================================
            // 1. 8-FOLD KALEIDOSCOPIC MANDALA GEOMETRY
            // ==========================================================
            let dCircle = radDist;
            let petalMod = Math.cos(theta * 8.0) * (radDist * 0.28);
            let dPetal = radDist - petalMod;
            let dDiamond = (absDx + absDy) * 0.72 + Math.cos(theta * 4.0) * (radDist * 0.18);

            let shapeDist = 0.0;
            if (effectiveMorph < 0.5) {
                let m = effectiveMorph * 2.0;
                shapeDist = dCircle * (1.0 - m) + dPetal * m;
            } else {
                let m = (effectiveMorph - 0.5) * 2.0;
                shapeDist = dPetal * (1.0 - m) + dDiamond * m;
            }

            // ==========================================================
            // 2. RADIAL PULSING WAVES & WAVEFRONT CRESTS
            // ==========================================================
            let wavePhase = shapeDist * waveFreq - t * 2.4;
            let primaryWave = Math.sin(wavePhase);

            let subHarmonic = Math.cos(shapeDist * (waveFreq * 0.5) + t * 1.2 + Math.cos(theta * 8.0) * 0.4);
            let combinedSignal = primaryWave * 0.65 + subHarmonic * 0.35;

            let waveIntensity = clamp((combinedSignal + 0.35) * 1.1, 0.0, 1.4);

            // ==========================================================
            // 3. COLOR PALETTE & LIGHTING LOGIC
            // ==========================================================
            let centerCore = clamp(1.0 - (radDist / (h * 0.32)), 0.0, 1.0);
            let centerGlow = centerCore * centerCore;

            let waveHue = 0.52 + 0.38 * (shapeDist / maxRadius) + 0.08 * Math.sin(t * 0.6);

            let pr = 0.55 + 0.45 * Math.cos(6.2831853 * (waveHue + 0.00));
            let pg = 0.35 + 0.35 * Math.cos(6.2831853 * (waveHue + 0.33));
            let pb = 0.65 + 0.35 * Math.cos(6.2831853 * (waveHue + 0.67));

            let baseR = Math.floor(pr * 220.0 * waveIntensity);
            let baseG = Math.floor(pg * 180.0 * waveIntensity);
            let baseB = Math.floor(pb * 240.0 * waveIntensity);

            baseR += Math.floor(centerGlow * 30.0);
            baseG += Math.floor(centerGlow * 180.0);
            baseB += Math.floor(centerGlow * 255.0);

            if (waveIntensity > 1.0) {
                let peak = (waveIntensity - 1.0) / 0.4;
                baseR = Math.floor(baseR * (1.0 - peak) + 255.0 * peak);
                baseG = Math.floor(baseG * (1.0 - peak) + 250.0 * peak);
                baseB = Math.floor(baseB * (1.0 - peak) + 255.0 * peak);
            }

            // ==========================================================
            // 4. AMBIENT FIELD TWINKLE (Secondary color sparkles)
            // ==========================================================
            let seed = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
            seed = seed - Math.floor(seed);

            if (seed > (0.91 - twinkleGain * 0.06) && waveIntensity < 0.65) {
                let twCycle = Math.sin(t * 1.8 + seed * 6.2831853);
                if (twCycle > 0.45) {
                    let twSpark = (twCycle - 0.45) / 0.55 * (0.6 + 0.4 * twinkleGain);

                    let twType = Math.floor(seed * 4.99);
                    let twR = 255, twG = 255, twB = 255;
                    if (twType === 0) {
                        twR = 120; twG = 225; twB = 80;
                    } else if (twType === 1) {
                        twR = 245; twG = 175; twB = 40;
                    } else if (twType === 2) {
                        twR = 235; twG = 50; twB = 80;
                    } else {
                        twR = 40; twG = 220; twB = 230;
                    }

                    baseR = clamp(baseR + Math.floor(twR * twSpark), 0, 255);
                    baseG = clamp(baseG + Math.floor(twG * twSpark), 0, 255);
                    baseB = clamp(baseB + Math.floor(twB * twSpark), 0, 255);
                }
            }

            let dotX = (x % 2);
            let dotY = (y % 2);
            let isBezel = (dotX === 1 && dotY === 1);
            let bezelFactor = isBezel ? 0.82 : 1.0;

            r = clamp(Math.floor(baseR * bezelFactor), 0, 255);
            g = clamp(Math.floor(baseG * bezelFactor), 0, 255);
            b = clamp(Math.floor(baseB * bezelFactor), 0, 255);

            display.setPixel(x, y, r, g, b);
        }
    }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
