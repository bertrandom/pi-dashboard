// ===== Patternflow pattern =====
// Title:    Rorschach Fluid Morph
// Author:   @martinnlopez
// Date:     2026-09-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @knobs Glitch=0..1, Speed=0.05..5, Freq=10..120, Quantize=2..10
// @matrix 128x128
// Rorschach Fluid Morph — organic liquid inkblot test on aged archival paper with bilateral symmetry.
// Knob 1: Morph — Plate Archetype (0.0: Winged Bat, 0.33: Dendritic Spider, 0.66: Totem, 1.0: Ribbed Mask)
// Knob 2: Speed — Fluid Morphing & Breathing Rate (0.0 to 5.0)
// Knob 3: Freq — Lobe Frequency & Edge Branching (10.0 to 120.0)
// Knob 4: Cavity — Internal Lacunae Windows & Satellite Droplets (0.0: Solid Blot to 1.0: Deep Windows)

function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

export function setup(params) {
    params.morph = 0.15;
    params.speed = 0.72;
    params.freq = 28.0;
    params.cavity = 0.55;
    params.timeAcc = 0.0;
}

export function update(dt, input, params) {
    if (input && input.knobValues) {
        let v = input.knobValues;
        params.morph = v[0];
        params.speed = v[1];
        params.freq = v[2];

        // Gracefully handles both 0.0-1.0 and 2.0-10.0 editor slider ranges for Knob 4
        params.cavity = (v[3] >= 2.0) ? (v[3] - 2.0) / 8.0 : v[3];
    }

    if (input && input.btnPressed) {
        if (input.btnPressed[0]) params.morph = 0.15;
        if (input.btnPressed[1]) params.speed = 0.72;
        if (input.btnPressed[2]) params.freq = 28.0;
        if (input.btnPressed[3]) params.cavity = 0.55;
    }

    params.timeAcc += dt * params.speed;
}

export function draw(display, params, time) {
    let w = display.width;
    let h = display.height;
    let t = params.timeAcc;

    let cx = (w - 1) * 0.5;
    let cy = (h - 1) * 0.5;

    // Fixed 10-tier authentic watercolor ink wash
    let qLevels = 10.0;

    // Archetype morph blend (Knob 1)
    let morphVal = clamp(params.morph, 0.0, 1.0);

    // Spatial frequency normalization (Knob 3)
    let fNorm = (params.freq >= 10.0) ? clamp((params.freq - 10.0) / 110.0, 0.0, 1.0) : clamp(params.freq, 0.0, 1.0);
    let lobeHarmonics = 2.0 + fNorm * 6.0;
    let branchScale = 3.0 + fNorm * 8.0;

    // Negative space windows & satellite droplet intensity (Knob 4)
    let cavityAmount = clamp(params.cavity, 0.0, 1.0);

    let maxDistCorner = Math.sqrt(cx * cx + cy * cy);

    let r = 0;
    let g = 0;
    let b = 0;

    for (let y = 0; y < h; y++) {
        let dy = y - cy;
        let v = dy / (h * 0.44);
        let absV = Math.abs(v);

        // Slow, continuous vertical fluid drift
        let flowV1 = Math.cos(v * 1.6 - t * 0.55);
        let flowV2 = Math.sin(v * 2.4 + t * 0.7);

        for (let x = 0; x < w; x++) {
            // Bilateral mirror fold across the center vertical axis
            let dx = Math.abs(x - cx);
            let u = dx / (w * 0.46);

            // Silky smooth 2-layer organic liquid domain warp (simulates liquid ink soaking into wet paper)
            let w1 = Math.sin(u * 2.2 + flowV1);
            let w2 = Math.cos(v * 2.0 - Math.sin(u * 2.4 - t * 0.45));

            let uw = u + 0.16 * w1;
            let vw = v + 0.16 * w2;
            let absVw = Math.abs(vw);

            let angle = Math.atan2(vw, uw + 0.04);
            let radius = Math.sqrt(uw * uw * 0.75 + vw * vw * 1.25);

            // --- 4 RORSCHACH ARCHETYPE FOUNDATIONS (Knob 1) ---
            // 1. Winged Bat/Moth (Plate I / V): broad lateral wings and upper horns
            let archBat = Math.exp(-Math.pow(absVw - 0.15, 2.0) * 3.5) * 0.48 
                        + Math.exp(-Math.pow(vw + 0.65, 2.0) * 8.0) * (0.35 * Math.sin(uw * 4.0));

            // 2. Dendritic Spider/Crab (Plate II / VIII): sharp diagonal pincer branches
            let diag1 = Math.abs(uw - absVw);
            let archSpider = Math.exp(-diag1 * diag1 * 8.0) * 0.42 + Math.sin(angle * 6.0) * 0.18;

            // 3. Totem/Gargoyle (Plate IV): dense vertical column with heavy basal foot lobes
            let archTotem = Math.exp(-uw * uw * 5.0) * 0.45 + Math.exp(-Math.pow(vw - 0.65, 2.0) * 6.0) * 0.4;

            // 4. Ribbed Mask (Plate VII): hollow waist with cupped top crest and lateral spurs
            let archMask = Math.sin(absVw * 4.5) * 0.28 + Math.exp(-Math.pow(uw - 0.45, 2.0) * 6.0) * 0.32;

            // Blend across archetypes
            let archBlend = 0.0;
            if (morphVal < 0.333) {
                let f = morphVal / 0.333;
                archBlend = archBat * (1.0 - f) + archSpider * f;
            } else if (morphVal < 0.666) {
                let f = (morphVal - 0.333) / 0.333;
                archBlend = archSpider * (1.0 - f) + archTotem * f;
            } else {
                let f = (morphVal - 0.666) / 0.334;
                archBlend = archTotem * (1.0 - f) + archMask * f;
            }

            // High-frequency lobe wrinkles & dendritic cilia (Knob 3)
            let primaryLobes = Math.cos(angle * lobeHarmonics + t * 0.35) * 0.22;
            let secondaryWaves = Math.sin(uw * branchScale + Math.cos(vw * branchScale + t * 0.6)) * (0.06 + fNorm * 0.22);

            // Breathing fluid foundation
            let breathing = 0.54 + 0.05 * Math.sin(t * 0.8) + 0.03 * Math.cos(t * 1.3);
            let blotSDF = radius - archBlend - primaryLobes - secondaryWaves;

            // --- INTERNAL CAVITY WINDOWS & SATELLITE SPLATTERS (Knob 4) ---
            let cavityPockets = 0.0;
            let satellites = 0.0;

            if (cavityAmount > 0.02) {
                // Symmetrical internal eye/window cutouts (as seen in Card I)
                let eye1Dist = Math.sqrt(Math.pow(uw - 0.22, 2.0) + Math.pow(vw + 0.32, 2.0));
                let eye2Dist = Math.sqrt(Math.pow(uw - 0.32, 2.0) + Math.pow(vw - 0.26, 2.0));
                let eyeCenter = Math.sqrt(Math.pow(uw - 0.04, 2.0) + Math.pow(vw, 2.0));

                let pocket1 = eye1Dist < 0.16 ? (0.16 - eye1Dist) * 3.8 : 0.0;
                let pocket2 = eye2Dist < 0.18 ? (0.18 - eye2Dist) * 3.2 : 0.0;
                let pocket3 = eyeCenter < 0.12 ? (0.12 - eyeCenter) * 2.8 : 0.0;

                cavityPockets = (pocket1 + pocket2 + pocket3) * cavityAmount;

                // Symmetrical satellite ink droplets orbiting the card
                let sat1Dist = Math.sqrt(Math.pow(uw - 0.62, 2.0) + Math.pow(absVw - 0.44, 2.0));
                let sat2Dist = Math.sqrt(Math.pow(uw - 0.92, 2.0) + Math.pow(absVw - 0.12, 2.0));
                let sat3Dist = Math.sqrt(Math.pow(uw - 0.38, 2.0) + Math.pow(vw - 0.82, 2.0));

                let s1 = sat1Dist < 0.11 ? (0.11 - sat1Dist) * 3.0 : 0.0;
                let s2 = sat2Dist < 0.09 ? (0.09 - sat2Dist) * 3.2 : 0.0;
                let s3 = sat3Dist < 0.12 ? (0.12 - sat3Dist) * 2.8 : 0.0;

                satellites = (s1 + s2 + s3) * cavityAmount;
            }

            // Net ink potential (< 0 is stained by ink)
            let potential = blotSDF + cavityPockets - satellites - breathing;

            // Background: Vintage cream archival parchment with soft vignette
            let distCenter = Math.sqrt(dx * dx + dy * dy);
            let vignette = 1.0 - (distCenter / maxDistCorner) * 0.24;

            let paperR = Math.floor(244 * vignette);
            let paperG = Math.floor(238 * vignette);
            let paperB = Math.floor(222 * vignette);

            if (potential < 0.0) {
                // INSIDE INK: Calculate continuous density (0.0 to 1.0)
                let rawDensity = clamp(-potential * 3.6, 0.0, 1.0);

                // Posterize into exactly 10 authentic ink wash gradations
                let steppedDensity = Math.floor(rawDensity * qLevels) / qLevels;
                let density = steppedDensity * 0.72 + rawDensity * 0.28;

                // Microscopic paper-fiber edge bleed
                let bleedNoise = Math.sin(u * 28.0 + v * 28.0 + t * 1.8) * 0.035 * (1.0 - density);
                density = clamp(density + bleedNoise, 0.0, 1.0);

                // Deep velvety carbon ink core blending into translucent sepia/indigo wash
                let inkCoreR = 12;
                let inkCoreG = 10;
                let inkCoreB = 20;

                let inkWashR = Math.floor(paperR * (1.0 - density) + inkCoreR * density);
                let inkWashG = Math.floor(paperG * (1.0 - density) + inkCoreG * density);
                let inkWashB = Math.floor(paperB * (1.0 - density) + inkCoreB * density);

                r = clamp(inkWashR, 0, 255);
                g = clamp(inkWashG, 0, 255);
                b = clamp(inkWashB, 0, 255);
            } else if (potential < 0.045) {
                // OUTSIDE MENISCUS: Translucent fluid halo soaking into paper fibers
                let halo = (0.045 - potential) / 0.045;
                r = Math.floor(paperR * (1.0 - halo * 0.26));
                g = Math.floor(paperG * (1.0 - halo * 0.24));
                b = Math.floor(paperB * (1.0 - halo * 0.20));
            } else {
                // UNSTAINED AGED PAPER
                r = paperR;
                g = paperG;
                b = paperB;
            }

            display.setPixel(x, y, r, g, b);
        }
    }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
