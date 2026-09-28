// ===== Patternflow pattern =====
// Title:    Gelatinous Lava Pour
// Author:   @martinnlopez
// Date:     2026-09-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp hsvLong recolor 0.62:#fefb00 0.718:#73fdff 0.228:#000000 0.392:#c0c0c0 0.996:#feffff
// @knobs FillRate=0.1..5, BlobCount=16..128, Wobble=0.1..10, Separation=0..10
// @matrix 64x128

// Pattern: Gelatinous Pour (Swarm Battle Remix)
// Lineage: Rebuilt from Team Swarm Battle — traded team combat for soft-body
// metaball blobs that ooze down from the top and slowly fill the canvas,
// with a Separation knob that shatters the settled gel and flings it apart.
// Grid density raised (24 -> 128 blobs) and radii sized off the actual grid
// cell so neighbors overlap generously and the mass reads as one continuous
// filled surface rather than a scatter of separate dots.

const COLS = 8;
const ROWS = 16;
const MAX_BLOBS = COLS * ROWS; // 128 settle slots

// Gummy-candy palette — kept vivid since metaball blending softens hues anyway
const PALETTE = [
    [255, 92, 138],   // Raspberry
    [88, 210, 255],   // Sky blue
    [255, 205, 64],   // Honey gold
    [140, 255, 132],  // Lime
    [200, 122, 255],  // Grape
    [255, 150, 64]    // Tangerine
];

function pseudoHash(n) {
    let x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
    return x - Math.floor(x);
}

export function setup(params) {
    // Knob 1: FillRate — how fast the gel pours in and fills the canvas from
    //         the top (0.1 = slow drip, 5 = fast pour)
    // Knob 2: BlobCount — how many soft blobs make up the mass (16..128).
    //         Defaults to full so the canvas fills completely; turning it
    //         down caps how far the pour gets before it stops.
    // Knob 3: Wobble — how much the settled gel jiggles and breathes
    // Knob 4: Separation — pulls the mass apart, flinging blobs across the
    //         screen (0 = cohesive gel, 10 = explosive scatter)
    //         [Push Knob 1 = Restart Pour]
    params.k1 = 1.0;
    params.k2 = MAX_BLOBS;
    params.k3 = 3.0;
    params.k4 = 0.0;

    // display.width/height aren't known yet — these are just a starting
    // guess and get corrected from the real display every frame in draw().
    params.canvasW = 64;
    params.canvasH = 128;

    params.animT = 0.0;
    params.fillTimer = 0.0;

    params.activeList = new Int32Array(MAX_BLOBS);

    params.blobs = [];
    for (let i = 0; i < MAX_BLOBS; i++) {
        params.blobs.push({
            // physics state (absolute pixels, valid once born)
            x: 0, y: 0, vx: 0, vy: 0,
            // settle slot, stored as fractions of canvas size so it stays
            // correct no matter what the real display dimensions turn out to be
            txFrac: 0.5, tyFrac: 0.5,
            sizeFactor: 1.0, r: 6,
            activateAt: 0, born: 0,
            phase: 0, colorIdx: 0,
            // per-frame draw scratch (rewritten every frame, never reallocated)
            cosA: 1, sinA: 0, invRx2: 0.02, invRy2: 0.02,
            curR: 6, hx: 0, hy: 0
        });
    }

    seedBlobs(params);
}

function seedBlobs(params) {
    for (let i = 0; i < MAX_BLOBS; i++) {
        let bl = params.blobs[i];
        let col = i % COLS;
        let row = Math.floor(i / COLS);
        let jx = pseudoHash(i * 3.19 + 0.5);
        let jy = pseudoHash(i * 7.77 + 1.2);

        // tightly jittered grid of settle slots covering the whole canvas —
        // small jitter relative to the (now much smaller) cell size keeps
        // neighbors close enough to overlap instead of leaving gaps
        bl.txFrac = (col + 0.5) / COLS + (jx - 0.5) * (1.0 / COLS) * 0.55;
        bl.tyFrac = (row + 0.5) / ROWS + (jy - 0.5) * (1.0 / ROWS) * 0.55;

        // shallow rows (near the top) activate first, so the mass visibly
        // fills the canvas from the top down as fillTimer advances
        bl.activateAt = row / ROWS;

        // sized relative to the grid cell (set from actual cell size each
        // frame in update()) so blobs generously overlap their neighbors
        bl.sizeFactor = 0.82 + pseudoHash(i * 5.3) * 0.4;
        bl.colorIdx = i % PALETTE.length;
        bl.phase = pseudoHash(i * 9.9) * 6.2832;

        bl.vx = 0.0;
        bl.vy = 0.0;
        bl.born = 0; // x/y get set once it actually activates in update()
    }

    params.fillTimer = 0.0;
}

export function update(dt, input, params) {
    if (input) {
        // Push Button 1: restart the pour from an empty canvas
        if (input.btnPressed && input.btnPressed[0]) {
            seedBlobs(params);
        }
        if (input.knobValues) {
            params.k1 = input.knobValues[0];
            params.k2 = input.knobValues[1];
            params.k3 = input.knobValues[2];
            params.k4 = input.knobValues[3];
        }
    }

    let w = params.canvasW;
    let h = params.canvasH;
    let cellSize = Math.min(w / COLS, h / ROWS);

    let fillRate = params.k1;
    let activeCount = Math.max(1, Math.min(MAX_BLOBS, Math.round(params.k2)));
    let wobble = params.k3;
    let separation = params.k4;

    params.animT += dt;

    // a full pour from empty to a brimming canvas takes ~7s at FillRate=1
    params.fillTimer += dt * fillRate / 7.0;
    if (params.fillTimer > 1.0) params.fillTimer = 1.0;

    // centroid of the settled mass — Separation pushes blobs away from this
    let sumX = 0.0, sumY = 0.0, bornN = 0;
    for (let i = 0; i < activeCount; i++) {
        let bl = params.blobs[i];
        if (bl.born) { sumX += bl.x; sumY += bl.y; bornN++; }
    }
    let cx = bornN > 0 ? sumX / bornN : w * 0.5;
    let cy = bornN > 0 ? sumY / bornN : h * 0.5;

    for (let i = 0; i < MAX_BLOBS; i++) {
        let bl = params.blobs[i];

        if (i >= activeCount) { bl.born = 0; continue; }

        bl.r = cellSize * bl.sizeFactor;

        if (!bl.born && params.fillTimer >= bl.activateAt) {
            // drip in from just above the top edge
            bl.born = 1;
            bl.x = bl.txFrac * w + (pseudoHash(bl.phase * 1.7) - 0.5) * cellSize * 0.5;
            bl.y = -bl.r * 2.0;
            bl.vx = 0.0;
            bl.vy = 0.0;
        }
        if (!bl.born) continue;

        let targetX = bl.txFrac * w;
        let targetY = bl.tyFrac * h;

        // spring pull back toward its settle slot — softened as Separation rises
        let stiffness = 9.0 * (1.0 - Math.min(1.0, separation / 10.0) * 0.88);
        let dx = targetX - bl.x;
        let dy = targetY - bl.y;
        let ax = dx * stiffness;
        let ay = dy * stiffness;

        // outward burst that scatters the gel across the screen
        if (separation > 0.05) {
            let ox = bl.x - cx;
            let oy = bl.y - cy;
            let od = Math.sqrt(ox * ox + oy * oy);
            if (od < 0.5) {
                ox = pseudoHash(bl.phase) - 0.5;
                oy = pseudoHash(bl.phase + 4.1) - 0.5;
                od = 0.5;
            }
            let push = separation * 3.2;
            ax += (ox / od) * push;
            ay += (oy / od) * push;
        }

        // ambient jelly jiggle — scaled to cell size so the wiggle stays
        // proportionate to the blobs no matter how fine the grid is
        let wob = wobble * cellSize * 0.3;
        ax += Math.sin(params.animT * 3.1 + bl.phase) * wob;
        ay += Math.cos(params.animT * 2.4 + bl.phase * 1.31) * wob;

        bl.vx = (bl.vx + ax * dt) * 0.90;
        bl.vy = (bl.vy + ay * dt) * 0.90;

        bl.x += bl.vx * dt;
        bl.y += bl.vy * dt;

        // keep it on the visible stage, even mid-flight
        let rad = bl.r;
        if (bl.x < rad) { bl.x = rad; bl.vx *= -0.6; }
        else if (bl.x > w - rad) { bl.x = w - rad; bl.vx *= -0.6; }
        if (bl.y < -rad * 3.0) { bl.y = -rad * 3.0; bl.vy *= -0.4; }
        else if (bl.y > h - rad) { bl.y = h - rad; bl.vy *= -0.6; }
    }
}

export function draw(display, params, time) {
    let w = display.width;
    let h = display.height;
    params.canvasW = w;
    params.canvasH = h;

    let wobble = params.k3;
    let activeLen = 0;

    // precompute each visible blob's shape once per frame (never per pixel)
    for (let i = 0; i < MAX_BLOBS; i++) {
        let bl = params.blobs[i];
        if (!bl.born) continue;

        let speed = Math.sqrt(bl.vx * bl.vx + bl.vy * bl.vy);
        let stretch = Math.min(1.0, speed / 40.0);
        let ang = (speed > 0.6) ? Math.atan2(bl.vy, bl.vx) : 0.0;

        // gentle breathing pulse, stronger with more Wobble
        let pulse = 1.0 + Math.sin(time * 4.0 + bl.phase) * (0.06 + wobble * 0.01);
        let baseR = bl.r * pulse;

        // squash & stretch along the direction of motion — sells the "flying
        // gel" feel when Separation sends a blob rocketing across the screen
        let rx = baseR * (1.0 + stretch * 0.9);
        let ry = baseR * (1.0 - stretch * 0.35);
        if (ry < baseR * 0.4) ry = baseR * 0.4;

        let cosA = Math.cos(ang);
        let sinA = Math.sin(ang);

        bl.cosA = cosA;
        bl.sinA = sinA;
        bl.invRx2 = 1.0 / (rx * rx);
        bl.invRy2 = 1.0 / (ry * ry);
        bl.curR = Math.max(rx, ry);

        // wet-gel highlight point, offset toward one side and rotated with the blob
        let hlx = -rx * 0.32;
        let hly = -ry * 0.32;
        bl.hx = bl.x + (hlx * cosA - hly * sinA);
        bl.hy = bl.y + (hlx * sinA + hly * cosA);

        params.activeList[activeLen] = i;
        activeLen++;
    }

    let bgR = 13, bgG = 11, bgB = 20;
    let threshold = 1.0;
    let edgeLo = threshold * 0.70;
    let edgeHi = threshold * 1.05;

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let total = 0.0;
            let colR = 0.0, colG = 0.0, colB = 0.0;
            let best = -1;
            let bestField = 0.0;

            // metaball field: sum each nearby blob's contribution so
            // overlapping blobs blend into one smooth gelatinous surface
            for (let k = 0; k < activeLen; k++) {
                let i = params.activeList[k];
                let bl = params.blobs[i];

                let dx = x - bl.x;
                let dy = y - bl.y;
                let reach = bl.curR * 3.4;
                if (dx < -reach || dx > reach || dy < -reach || dy > reach) continue;

                let lx = dx * bl.cosA + dy * bl.sinA;
                let ly = -dx * bl.sinA + dy * bl.cosA;
                let ndSq = lx * lx * bl.invRx2 + ly * ly * bl.invRy2;
                let field = 1.0 / (ndSq + 0.05);

                total += field;
                let c = PALETTE[bl.colorIdx];
                colR += field * c[0];
                colG += field * c[1];
                colB += field * c[2];

                if (field > bestField) { bestField = field; best = i; }
            }

            let pr = bgR, pg = bgG, pb = bgB;

            if (total > edgeLo) {
                let t = (total - edgeLo) / (edgeHi - edgeLo);
                if (t > 1.0) t = 1.0;
                let alpha = t * t * (3.0 - 2.0 * t); // smoothstep edge

                let gr = colR / total;
                let gg = colG / total;
                let gb = colB / total;

                // a hint of the void shows through even in the core, so the
                // gel reads as translucent rather than a flat solid
                let coreMix = 0.88;
                gr = gr * coreMix + bgR * (1.0 - coreMix);
                gg = gg * coreMix + bgG * (1.0 - coreMix);
                gb = gb * coreMix + bgB * (1.0 - coreMix);

                // glossy highlight near the dominant blob's light-catch point
                if (best >= 0 && alpha > 0.5) {
                    let bb = params.blobs[best];
                    let hdx = x - bb.hx;
                    let hdy = y - bb.hy;
                    let hDistSq = hdx * hdx + hdy * hdy;
                    let hRad = bb.curR * 0.42;
                    if (hDistSq < hRad * hRad) {
                        let hFall = 1.0 - Math.sqrt(hDistSq) / hRad;
                        let hAlpha = hFall * hFall * 0.55;
                        gr = gr * (1.0 - hAlpha) + 255 * hAlpha;
                        gg = gg * (1.0 - hAlpha) + 255 * hAlpha;
                        gb = gb * (1.0 - hAlpha) + 255 * hAlpha;
                    }
                }

                pr = Math.floor(bgR * (1.0 - alpha) + gr * alpha);
                pg = Math.floor(bgG * (1.0 - alpha) + gg * alpha);
                pb = Math.floor(bgB * (1.0 - alpha) + gb * alpha);
            }

            display.setPixel(x, y, pr, pg, pb);
        }
    }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
