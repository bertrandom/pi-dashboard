// ===== Patternflow pattern =====
// Title:    Mesto Hen
// Author:   @kraseva
// Date:     2026-09-20
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @knobs Glitch=0..1, Speed=0.05..5, Freq=10..120, Quantize=2..10
// @matrix 128x128



// Pattern: MESTO Hens Crossing (v3 — train-coupled spacing, stagger, cyan tint)
// Author: Stasik / NASHE MESTO
// SPDX-License-Identifier: CC-BY-SA-4.0
// Date: 2026
//
// The hen-in-a-pot sprite (16x26, 9-color palette, extracted from
// kura.png) walks right to left at a fixed speed. Hens are coupled
// like train cars: only the lead hen moves freely, every hen behind it is
// positioned directly off its neighbor's spot each frame — so turning the
// spacing knob live-slides the whole line closer together or further apart,
// instead of only affecting hens spawned after the turn.
//
// Knob 1 (0..1, wraps): idle-animation stagger — at 0 all hens bounce in
//         sync; turning it up spreads each hen's phase further from its
//         neighbor's down the chain (continuous, not a press — presses
//         aren't available in every host, so this needed to be a turn)
// Knob 2 (0.1..10, clamps, used normalized 0..1): stretch strength
//         ("вытягивание", up-phase) — 10%..90%, clamped, no wraparound
// Knob 3 (0..4.9, clamps, used normalized 0..1): squash strength
//         ("приседание", down-phase) — 10%..90%, clamped, no wraparound
// Knob 4 (0..1, wraps): spacing between hens, live — 0 stacks them almost
//         completely (max 3px offset between neighbors), 1 spreads them
//         out to a normal walking gap.
// Knobs 2 and 3 have no button-reset behavior — they're clamped 0..100%,
// there's no "wrap past zero" to protect against.
//
// Past the halfway point of knob 2's travel, hens gain a light additive
// blue tint (and a soft 1-2px glow around the bird only, not the pot)
// that grows and shrinks with how deep into the stretch phase they are.
// Symmetrically, past the halfway point of knob 3's travel, the pot gains
// a red tint (and a weaker red glow around just the pot) tied to how deep
// into the squash phase the hen currently is.
//
// Reading across the pots left to right spells out a marquee: NASHEMESTO,
// looping by spawn order — the lead hen (first spawned) ends up leftmost
// since it's the one advancing toward the exit edge, with each later hen
// trailing to its right. The letter is grouped with the bird (not the
// pot) for tinting — it stays white during squash, but turns blue and
// joins the additive glow during stretch, same as the rest of the body.
//
// Top-right corner shows a tiny debug readout: the letter of whichever
// knob was last turned (A-D for knobs 1-4) and its value as 0-100.

function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

// Patternflow's matrix is a fixed 128x64 panel. draw() reads the real size
// from `display`; update() has no access to it, so it uses these directly.
const W = 128, H = 64;

// ---- hen-in-a-pot sprite, extracted from kura.png: 16x26 cells,
// 9-color palette (transparent '.' cells are skipped when drawing) ----
const HEN_W = 16, HEN_H = 26;
const HEN_SRC = [
    ".............L..",
    "..........L.L...",
    "........LY.L.Y..",
    "...........L..L.",
    ".....R.R.BLL..L.",
    ".....RBDD.L.....",
    ".....GWWWGLL....",
    ".PPPPWWLLWGN.Y..",
    "....BWLWWLGNL.Y.",
    "...RDWWWWWGN..L.",
    "...DDWWWWWGN..L.",
    "....WWWWWWGN.W..",
    "....WWWWWGGGWW..",
    "....WWGWWWWWWG..",
    ".NL.WWGWWWWWGG..",
    "..NLWWGWWWWGGGNL",
    "LL.LGWGGWWGGGNLN",
    ".LLNNGGGGGGGNL..",
    "..PPPPPPPPPPPP..",
    "..PPPPPPPPPPPP..",
    "..BBBBBBBBBBBB..",
    "...BBBDDDDBBB...",
    "...PPBDDDDBPP...",
    "...PPBDDDDBPP...",
    "...BPBDDDDBPB...",
    "...BBBBBBBBBB..."
];
const PALETTE = {
    'W': [255, 255, 255], // body
    'G': [195, 195, 195], // shading
    'R': [255, 60, 45],   // flower petals
    'N': [30, 35, 55],    // dark outline/contour
    'L': [92, 110, 60],   // leaves
    'Y': [170, 150, 55],  // flower centers
    'P': [207, 125, 90],  // pot (light) — reddens on squash
    'B': [156, 83, 60],   // pot (mid) — reddens on squash
    'D': [119, 63, 47]    // pot (dark band) — reddens on squash
};
const HEN = HEN_SRC.map(row => row.split(''));

// ---- 5x7 letters stamped onto the pot to spell out the marquee ----
const POT_FONT_SRC = {
    'N': ['X..X', 'XX.X', 'X.XX', 'X..X', 'X..X'],
    'A': ['.XX.', 'X..X', 'XXXX', 'X..X', 'X..X'],
    'S': ['.XXX', 'X...', '.XX.', '...X', 'XXX.'],
    'H': ['X..X', 'X..X', 'XXXX', 'X..X', 'X..X'],
    'E': ['XXXX', 'X...', 'XXX.', 'X...', 'XXXX'],
    'M': ['X..X', 'XXXX', 'X..X', 'X..X', 'X..X'],
    'T': ['XXXX', '.XX.', '.XX.', '.XX.', '.XX.'],
    'O': ['.XX.', 'X..X', 'X..X', 'X..X', '.XX.']
};
const POT_FONT = {};
for (const k in POT_FONT_SRC) POT_FONT[k] = POT_FONT_SRC[k].map(row => row.split(''));
const MESSAGE = 'NASHEMESTO';
const LETTER_W = 4, LETTER_H = 5;
const LETTER_ROW = 20, LETTER_COL = 6; // matches the hand-placed reference: starts 1 row above the dark band, ends 1px clear of the bottom edge

const WALK_CYCLE = 0.5;    // seconds per bounce cycle
const SPEED = 16;          // px/sec, fixed
const MAX_HENS = 80;
const MAX_OFFSET_PX = HEN_W + 50; // knob 4's spread-out end (edge-to-edge ~50px gap)
const MIN_OFFSET_PX = 3;          // knob 4's packed end — near-total stacked overlap
const SPAWN_INTERVAL = 0.35; // seconds, fixed — independent of the spacing knob
const TINT = [5, 45, 190];   // saturated blue (low R/G, high B) — reads as blue, not white
const RED = [190, 15, 15];   // saturated red for the pot, on squash
const GLOW_RADIUS = 2;       // px of halo around the bird
const MAX_STAGGER = 12;      // knob 1 at full: 1 full cycle of offset across neighbors

// ---- rig: pot (parent, pivots at the floor) + hen and plant (children,
// both pivot at the pot's current top edge). Each part computes its own
// squash/stretch off its own phase — the hen trails the pot by BIRD_DELAY
// seconds, and the plant trails the pot by another BIRD_DELAY on top of
// that (one more "frame" behind the hen). ----
const BIRD_ROWS = 18;              // rows 0..17: hen + plant (split further by color, see IS_LEAF)
const POT_ROWS = HEN_H - BIRD_ROWS; // rows 18..25: pot
const BIRD_DELAY = 1 / 12;         // seconds the hen lags behind the pot
const LEAF_DELAY = 2 / 12;         // seconds the plant lags behind the pot (= 1 frame behind the hen)

// ---- occasional falling-leaf debris: rare leaf/flower-colored pixels detach
// from a fixed spot near the hen's head (not hunted for in the silhouette —
// cheap and simple), drift up on an ease-out arc, then fall back down past
// their start point on an ease-in, fading out as they fall. Detached
// particles live in world space — they don't track the hen once spawned.
// Per-hen timer (not a screen-wide one), so more hens on screen means
// proportionally more particles. ----
const LEAF_DROP_MIN = 0.2, LEAF_DROP_MAX = 0.6; // seconds between drops, per hen — a near-constant trickle
const LEAF_PARTICLE_DURATION = 0.9;            // seconds, total lifetime
const LEAF_PARTICLE_RISE_FRAC = 0.3;           // first 30% of life is the rise
const LEAF_PARTICLE_RISE_HEIGHT = 3;           // px, ease-out rise — the floor of the launch-height range
const LEAF_PARTICLE_RISE_MULT_MAX = 8;         // ceiling: how many times LEAF_PARTICLE_RISE_HEIGHT a launch can reach
const LEAF_PARTICLE_RISE_CURVE = 2.5;          // >1 skews rolls toward weak/medium, with a long tail up to the ceiling — "sometimes very strong, sometimes medium"
const LEAF_PARTICLE_RISE_OVERSHOOT_CHANCE = 0.06; // rare chance to blow past the ceiling entirely
const LEAF_PARTICLE_RISE_OVERSHOOT_MULT = 1.5;    // ...by up to this much more, on top of the ceiling
const LEAF_PARTICLE_FALL_DISTANCE = 6;         // px below the start point, ease-in fall
const LEAF_PARTICLE_PAIR_CHANCE = 0.08;        // chance of a 2nd leaf/flower pixel alongside the first — kept low so singles dominate
const LEAF_PARTICLE_BURST_CHANCE = 0.6;        // rare chance of extra pixels on top of that
const LEAF_PARTICLE_FEATHER_CHANCE = 0.1;      // rare chance this drop is a white 2-3px feather sliver instead — kept low, singles dominate
// knob B/C past halfway mainly ramps how OFTEN drops happen, only lightly
// how eventful they are — most of the knob's effect should read as "more
// singles, faster", not "more pairs/feathers"
const LEAF_PARTICLE_KNOB_RATE_BOOST = 12;      // at full gate, drops up to 13x more often
const LEAF_PARTICLE_KNOB_CHANCE_BOOST = 0.4;   // at full gate, the chances above are only up to 1.4x (capped at 1)

// ---- tiny 3x5 debug font: knob letters A-D and digits 0-9 ----
const DEBUG_FONT_SRC = {
    'A': ['.X.', 'X.X', 'XXX', 'X.X', 'X.X'],
    'B': ['XX.', 'X.X', 'XX.', 'X.X', 'XX.'],
    'C': ['XXX', 'X..', 'X..', 'X..', 'XXX'],
    'D': ['XX.', 'X.X', 'X.X', 'X.X', 'XX.'],
    '0': ['XXX', 'X.X', 'X.X', 'X.X', 'XXX'],
    '1': ['.X.', 'XX.', '.X.', '.X.', 'XXX'],
    '2': ['XXX', '..X', 'XXX', 'X..', 'XXX'],
    '3': ['XXX', '..X', 'XXX', '..X', 'XXX'],
    '4': ['X.X', 'X.X', 'XXX', '..X', '..X'],
    '5': ['XXX', 'X..', 'XXX', '..X', 'XXX'],
    '6': ['XXX', 'X..', 'XXX', 'X.X', 'XXX'],
    '7': ['XXX', '..X', '..X', '..X', '..X'],
    '8': ['XXX', 'X.X', 'XXX', 'X.X', 'XXX'],
    '9': ['XXX', 'X.X', 'XXX', '..X', 'XXX']
};
const DEBUG_FONT = {};
for (const k in DEBUG_FONT_SRC) DEBUG_FONT[k] = DEBUG_FONT_SRC[k].map(row => row.split(''));
const DEBUG_GLYPH_W = 3, DEBUG_GLYPH_H = 5, DEBUG_GAP = 1;
const DEBUG_COLOR = [255, 255, 255];

function drawDebugText(display, w, h, text) {
    const totalW = text.length * (DEBUG_GLYPH_W + DEBUG_GAP) - DEBUG_GAP;
    let x0 = w - 2 - totalW, y0 = 2;
    for (const ch of text) {
        const glyph = DEBUG_FONT[ch];
        if (glyph) {
            for (let ry = 0; ry < DEBUG_GLYPH_H; ry++) {
                for (let rx = 0; rx < DEBUG_GLYPH_W; rx++) {
                    if (glyph[ry][rx] !== 'X') continue;
                    const px = x0 + rx, py = y0 + ry;
                    if (px >= 0 && px < w && py >= 0 && py < h) {
                        display.setPixel(px, py, DEBUG_COLOR[0], DEBUG_COLOR[1], DEBUG_COLOR[2]);
                    }
                }
            }
        }
        x0 += DEBUG_GLYPH_W + DEBUG_GAP;
    }
}

export function setup(params) {
    params.staggerKnob = 0;  // knob 1 (A), 0..1 -> 0..MAX_STAGGER — starts at 0
    params.stretchRaw = 0;   // knob 2 (B), normalized 0..1 — starts at 0
    params.squashRaw = 0;    // knob 3 (C), normalized 0..1 — starts at 0
    params.gapKnob = 0.7;    // knob 4 (D), 0..1 — starts at 70
    params.lastKnob = null;
    params.debugText = '';   // last-touched knob letter + value, e.g. "A 42"
    params.tintColor = TINT.slice();   // stretch-phase (hen/plant) overlay/glow color, randomized by knob B's button
    params.squashColor = RED.slice();  // squash-phase (pot) overlay/glow color, randomized by knob C's button

    params.timeAcc = 0;
    params.hens = [];        // index 0 = lead (frontmost), moves freely
    params.henCounter = 0;
    params.nextSpawnAt = 0;
    params.leafParticles = []; // detached falling-leaf debris, independent of any hen
}

const KNOB_LETTERS = ['A', 'B', 'C', 'D'];

export function update(dt, input, params) {
    if (input && input.knobValues) {
        const v = input.knobValues;
        const n = input.knobNormalized || v;
        if (!params.lastKnob) params.lastKnob = [v[0], v[1], v[2], v[3]];
        for (let i = 0; i < 4; i++) {
            if (Math.abs(v[i] - params.lastKnob[i]) > 1e-6) {
                if (i === 0) params.staggerKnob = n[0];
                else if (i === 1) params.stretchRaw = n[1];
                else if (i === 2) params.squashRaw = n[2];
                else if (i === 3) params.gapKnob = n[3];
                params.debugText = KNOB_LETTERS[i] + Math.round(clamp(n[i], 0, 1) * 100);
            }
        }
        params.lastKnob = [v[0], v[1], v[2], v[3]];
    }
    if (input && input.btnPressed && input.btnPressed[1]) {
        params.tintColor = [Math.floor(Math.random() * 256), Math.floor(Math.random() * 256), Math.floor(Math.random() * 256)];
    }
    if (input && input.btnPressed && input.btnPressed[2]) {
        params.squashColor = [Math.floor(Math.random() * 256), Math.floor(Math.random() * 256), Math.floor(Math.random() * 256)];
    }

    params.timeAcc += dt;
    const t = params.timeAcc;
    const offsetPx = MIN_OFFSET_PX + params.gapKnob * (MAX_OFFSET_PX - MIN_OFFSET_PX);

    // spawn at a fixed rate, independent of spacing
    if (t >= params.nextSpawnAt && params.hens.length < MAX_HENS) {
        const tail = params.hens.length ? params.hens[params.hens.length - 1] : null;
        const x = tail ? tail.x + offsetPx : W;
        params.hens.push({
            x, y: H - HEN_H - 4, seq: params.henCounter, letter: MESSAGE[params.henCounter % MESSAGE.length],
            nextLeafDropAt: t + LEAF_DROP_MIN + Math.random() * (LEAF_DROP_MAX - LEAF_DROP_MIN)
        });
        params.henCounter += 1;
        params.nextSpawnAt = t + SPAWN_INTERVAL;
    }

    // train coupling: only the lead moves freely, everyone else is
    // re-pinned to its neighbor's current spot every frame — this is what
    // makes the spacing knob visibly slide the whole line together live
    if (params.hens.length > 0) {
        params.hens[0].x -= SPEED * dt;
        for (let i = 1; i < params.hens.length; i++) {
            params.hens[i].x = params.hens[i - 1].x + offsetPx;
        }
    }

    params.hens = params.hens.filter(hen => hen.x > -HEN_W);
}

// Squash (phase >= 0) or stretch (phase < 0) scale/tint for one half of the
// rig, from its own phase value — pot and hen/plant each call this with a
// different (independently-timed) phase.
function computePhaseState(phase, stretchAmt, squashAmt, stretchGate, squashGate, stretchColor, squashColor) {
    if (phase >= 0) {
        // down-phase ("приседание"): flattens, and widens 20% harder than
        // the flattening alone would — reads more like a real squat
        return {
            scaleX: 1 + squashAmt * phase * 1.2,
            scaleY: 1 - squashAmt * phase,
            tintStrength: clamp(phase * squashGate * 1.35, 0, 1),
            color: squashColor,
            glowMult: 1.0, // weaker than the blue glow
            squashing: true
        };
    }
    // up-phase ("вытягивание"): narrows gently, elongates 20% harder than
    // before — keeps the narrowing as-is, boosts only the height
    const s = -phase;
    return {
        scaleX: 1 - stretchAmt * (0.5 * s + 0.15 * s * s * s),
        scaleY: 1 + stretchAmt * 2 * s * 1.2,
        tintStrength: clamp(s * stretchGate * 1.35, 0, 1),
        color: stretchColor,
        glowMult: 1.6,
        squashing: false
    };
}

// Draws HEN rows [rowStart, rowEnd) using one part's transform/tint,
// restricted to cells where includeCode(code) is true (lets the hen body
// and the leaves — which share the same row range — be split by color
// into two independently-timed parts). Solid pixels are marked into the
// shared `occupied` grid (spans the whole display, absolute px/py) so that
// no part's halo can later paint over another part's pixels; returns this
// part's own glow info (or null) for a later, separate glow pass.
function drawPart(display, w, h, rowStart, rowEnd, part, occupied, includeCode) {
    const { scaleX, scaleY, originXf, originYf, color, tintStrength, glowMult } = part;

    let minPx = Infinity, minPy = Infinity, maxPx = -Infinity, maxPy = -Infinity;
    for (let ry = rowStart; ry < rowEnd; ry++) {
        const local = ry - rowStart;
        const py0 = Math.round(originYf + local * scaleY);
        const py1 = Math.round(originYf + (local + 1) * scaleY);
        for (let rx = 0; rx < HEN_W; rx++) {
            if (HEN[ry][rx] === '.' || !includeCode(HEN[ry][rx])) continue;
            const px0 = Math.round(originXf + rx * scaleX);
            const px1 = Math.round(originXf + (rx + 1) * scaleX);
            if (px1 <= px0 || py1 <= py0) continue;
            if (px0 < minPx) minPx = px0;
            if (px1 - 1 > maxPx) maxPx = px1 - 1;
            if (py0 < minPy) minPy = py0;
            if (py1 - 1 > maxPy) maxPy = py1 - 1;
        }
    }
    if (maxPx < minPx) return null; // fully degenerate/offscreen this frame

    const doGlow = tintStrength > 0.01;
    const gx0 = minPx - GLOW_RADIUS, gy0 = minPy - GLOW_RADIUS;
    const gw = (maxPx - minPx + 1) + GLOW_RADIUS * 2;
    const gh = (maxPy - minPy + 1) + GLOW_RADIUS * 2;
    const glowSource = doGlow ? new Uint8Array(gw * gh) : null;

    for (let ry = rowStart; ry < rowEnd; ry++) {
        const local = ry - rowStart;
        const py0 = Math.round(originYf + local * scaleY);
        const py1 = Math.round(originYf + (local + 1) * scaleY);
        for (let rx = 0; rx < HEN_W; rx++) {
            const code = HEN[ry][rx];
            if (code === '.' || !includeCode(code)) continue;
            const base = PALETTE[code];
            let r = base[0], g = base[1], b = base[2];
            if (tintStrength > 0) {
                r = Math.min(255, r + color[0] * tintStrength);
                g = Math.min(255, g + color[1] * tintStrength);
                b = Math.min(255, b + color[2] * tintStrength);
            }
            const px0 = Math.round(originXf + rx * scaleX);
            const px1 = Math.round(originXf + (rx + 1) * scaleX);
            for (let py = py0; py < py1; py++) {
                if (doGlow) {
                    const gy = py - gy0;
                    if (gy >= 0 && gy < gh) {
                        for (let px = px0; px < px1; px++) {
                            const gx = px - gx0;
                            if (gx >= 0 && gx < gw) glowSource[gy * gw + gx] = 1;
                        }
                    }
                }
                if (py < 0 || py >= h) continue;
                for (let px = px0; px < px1; px++) {
                    if (px < 0 || px >= w) continue;
                    occupied[py * w + px] = 1;
                    display.setPixel(px, py, Math.round(r), Math.round(g), Math.round(b));
                }
            }
        }
    }

    return doGlow ? { gx0, gy0, gw, gh, glowSource, color, glowMult, tintStrength } : null;
}

// The pot letter: positioned with the pot's own transform (it's stamped on
// the pot), but tinted like the hen/plant — grouped with it for tinting,
// same as before the rig was split. Same occupied/glow-deferral scheme as drawPart.
function drawLetter(display, w, h, hen, potPart, birdPart, occupied) {
    const glyph = POT_FONT[hen.letter];
    if (!glyph) return null;
    const { scaleX, scaleY, originXf, originYf } = potPart;
    const { color, tintStrength, glowMult } = birdPart;

    let minPx = Infinity, minPy = Infinity, maxPx = -Infinity, maxPy = -Infinity;
    for (let ry = 0; ry < LETTER_H; ry++) {
        const rowIdx = LETTER_ROW + ry - BIRD_ROWS; // local row within the pot part
        const py0 = Math.round(originYf + rowIdx * scaleY);
        const py1 = Math.round(originYf + (rowIdx + 1) * scaleY);
        for (let rx = 0; rx < LETTER_W; rx++) {
            if (glyph[ry][rx] !== 'X') continue;
            const colIdx = LETTER_COL + rx;
            const px0 = Math.round(originXf + colIdx * scaleX);
            const px1 = Math.round(originXf + (colIdx + 1) * scaleX);
            if (px1 <= px0 || py1 <= py0) continue;
            if (px0 < minPx) minPx = px0;
            if (px1 - 1 > maxPx) maxPx = px1 - 1;
            if (py0 < minPy) minPy = py0;
            if (py1 - 1 > maxPy) maxPy = py1 - 1;
        }
    }
    if (maxPx < minPx) return null;

    const doGlow = tintStrength > 0.01;
    const gx0 = minPx - GLOW_RADIUS, gy0 = minPy - GLOW_RADIUS;
    const gw = (maxPx - minPx + 1) + GLOW_RADIUS * 2;
    const gh = (maxPy - minPy + 1) + GLOW_RADIUS * 2;
    const glowSource = doGlow ? new Uint8Array(gw * gh) : null;

    for (let ry = 0; ry < LETTER_H; ry++) {
        const rowIdx = LETTER_ROW + ry - BIRD_ROWS;
        const py0 = Math.round(originYf + rowIdx * scaleY);
        const py1 = Math.round(originYf + (rowIdx + 1) * scaleY);
        for (let rx = 0; rx < LETTER_W; rx++) {
            if (glyph[ry][rx] !== 'X') continue;
            let r = 255, g = 255, b = 255;
            if (tintStrength > 0) {
                r = Math.min(255, r + color[0] * tintStrength);
                g = Math.min(255, g + color[1] * tintStrength);
                b = Math.min(255, b + color[2] * tintStrength);
            }
            const colIdx = LETTER_COL + rx;
            const px0 = Math.round(originXf + colIdx * scaleX);
            const px1 = Math.round(originXf + (colIdx + 1) * scaleX);
            for (let py = py0; py < py1; py++) {
                if (doGlow) {
                    const gy = py - gy0;
                    if (gy >= 0 && gy < gh) {
                        for (let px = px0; px < px1; px++) {
                            const gx = px - gx0;
                            if (gx >= 0 && gx < gw) glowSource[gy * gw + gx] = 1;
                        }
                    }
                }
                if (py < 0 || py >= h) continue;
                for (let px = px0; px < px1; px++) {
                    if (px < 0 || px >= w) continue;
                    occupied[py * w + px] = 1;
                    display.setPixel(px, py, Math.round(r), Math.round(g), Math.round(b));
                }
            }
        }
    }

    return doGlow ? { gx0, gy0, gw, gh, glowSource, color, glowMult, tintStrength } : null;
}

// a soft 1-2px halo (blue around the hen on stretch, weaker red around the
// pot on squash), same gating/strength as the tint that triggered it.
// `occupied` spans the whole display (absolute px/py) and is shared by every
// part of this hen, so the halo can never paint over pixels another part
// already drew — regardless of draw order.
function applyGlow(display, w, h, occupied, glow) {
    const { gx0, gy0, gw, gh, glowSource, color, glowMult, tintStrength } = glow;
    for (let gy = 0; gy < gh; gy++) {
        const py = gy + gy0;
        if (py < 0 || py >= h) continue;
        for (let gx = 0; gx < gw; gx++) {
            const px = gx + gx0;
            if (px < 0 || px >= w) continue;
            if (occupied[py * w + px]) continue;
            let nearestDist = Infinity;
            for (let dy = -GLOW_RADIUS; dy <= GLOW_RADIUS; dy++) {
                const ny = gy + dy;
                if (ny < 0 || ny >= gh) continue;
                for (let dx = -GLOW_RADIUS; dx <= GLOW_RADIUS; dx++) {
                    const nx = gx + dx;
                    if (nx < 0 || nx >= gw) continue;
                    if (!glowSource[ny * gw + nx]) continue;
                    const d = Math.sqrt(dx * dx + dy * dy);
                    if (d < nearestDist) nearestDist = d;
                }
            }
            if (nearestDist > GLOW_RADIUS) continue;
            const falloff = 1 - nearestDist / (GLOW_RADIUS + 0.5);
            const strength = tintStrength * clamp(falloff, 0, 1);
            if (strength <= 0.02) continue;
            display.setPixel(px, py,
                Math.round(color[0] * glowMult * strength),
                Math.round(color[1] * glowMult * strength),
                Math.round(color[2] * glowMult * strength));
        }
    }
}

const IS_LEAF = code => code === 'L' || code === 'Y'; // Y = flower centers, part of the plant
const NOT_LEAF = code => !IS_LEAF(code);
const ANY_CODE = () => true;

// Rolls this hen's rare leaf-drop timer; on a hit, throws 1-2 leaf/flower
// pixels (occasionally more, occasionally a white 2-3px feather sliver
// instead) from a fixed spot near the head — cheap: no silhouette lookup,
// just a fixed point on the leaf part's current transform.
function maybeSpawnLeafParticle(hen, leaf, t, particles, stretchGate, squashGate, stretchRaw, squashRaw) {
    if (t < hen.nextLeafDropAt) return;

    // drop RATE follows the raw knob position from the very start: at 0 it's
    // 3x slower than the plain baseline rate, by 10% knob travel it's back
    // up to that baseline, and from there it keeps ramping to the full boost
    // at knob 100% — so "current" (baseline) behavior sits at just 10% in
    const rawIntensity = Math.max(stretchRaw, squashRaw); // 0..1
    const rateMult = rawIntensity <= 0.1
        ? (1 / 3) + (rawIntensity / 0.1) * (1 - 1 / 3)
        : 1 + ((rawIntensity - 0.1) / 0.9) * LEAF_PARTICLE_KNOB_RATE_BOOST;

    // how EVENTFUL a drop is (pair/burst/feather chance) still only ramps
    // past the halfway point, same gating the tint effects use
    const gateIntensity = Math.max(stretchGate, squashGate); // 0..1
    const chanceMult = 1 + gateIntensity * LEAF_PARTICLE_KNOB_CHANCE_BOOST;

    hen.nextLeafDropAt = t + (LEAF_DROP_MIN + Math.random() * (LEAF_DROP_MAX - LEAF_DROP_MIN)) / rateMult;

    const originX = leaf.originXf + (HEN_W / 2) * leaf.scaleX;
    const originY = leaf.originYf + 1.5 * leaf.scaleY; // roughly the head/sprig area

    const isFeather = Math.random() < Math.min(1, LEAF_PARTICLE_FEATHER_CHANCE * chanceMult);
    const points = [];
    if (isFeather) {
        const count = 2 + (Math.random() < 0.5 ? 1 : 0); // 2 or 3, in a short line
        for (let i = 0; i < count; i++) points.push({ dx: i - (count - 1) / 2, dy: 0, color: PALETTE['W'] });
    } else {
        let count = 1 + (Math.random() < Math.min(1, LEAF_PARTICLE_PAIR_CHANCE * chanceMult) ? 1 : 0);
        if (Math.random() < Math.min(1, LEAF_PARTICLE_BURST_CHANCE * chanceMult)) count += 1 + Math.floor(Math.random() * 2); // rare extra 1-2
        for (let i = 0; i < count; i++) {
            points.push({
                dx: (Math.random() - 0.5) * 3,
                dy: (Math.random() - 0.5) * 2,
                color: Math.random() < 0.5 ? PALETTE['L'] : PALETTE['Y']
            });
        }
    }

    // continuous roll, not a binary strong/normal split — curved so most
    // launches land weak-to-medium, with a long tail reaching the max
    const launchRoll = Math.pow(Math.random(), LEAF_PARTICLE_RISE_CURVE);
    let launchMult = 1 + launchRoll * (LEAF_PARTICLE_RISE_MULT_MAX - 1);
    if (Math.random() < LEAF_PARTICLE_RISE_OVERSHOOT_CHANCE) {
        launchMult *= 1 + Math.random() * (LEAF_PARTICLE_RISE_OVERSHOOT_MULT - 1);
    }
    const riseHeight = LEAF_PARTICLE_RISE_HEIGHT * launchMult;

    particles.push({ bornAt: t, duration: LEAF_PARTICLE_DURATION, x: originX, y: originY, riseHeight, points });
}

// Draws every live leaf particle: ease-out rise, then ease-in fall past the
// start point, fading (via color scaled toward black — this display has no
// real alpha) over the fall.
function drawLeafParticles(display, w, h, particles, t) {
    for (const p of particles) {
        const progress = (t - p.bornAt) / p.duration;
        if (progress < 0 || progress >= 1) continue;

        let yOff, alpha;
        if (progress < LEAF_PARTICLE_RISE_FRAC) {
            const rp = progress / LEAF_PARTICLE_RISE_FRAC;
            const eased = 1 - (1 - rp) * (1 - rp); // ease-out
            yOff = -p.riseHeight * eased;
            alpha = 1;
        } else {
            const fp = (progress - LEAF_PARTICLE_RISE_FRAC) / (1 - LEAF_PARTICLE_RISE_FRAC);
            const eased = fp * fp; // ease-in
            yOff = -p.riseHeight + (p.riseHeight + LEAF_PARTICLE_FALL_DISTANCE) * eased;
            alpha = 1 - fp;
        }
        if (alpha <= 0.02) continue;

        for (const pt of p.points) {
            const px = Math.round(p.x + pt.dx);
            const py = Math.round(p.y + pt.dy + yOff);
            if (px < 0 || px >= w || py < 0 || py >= h) continue;
            display.setPixel(px, py,
                Math.round(pt.color[0] * alpha),
                Math.round(pt.color[1] * alpha),
                Math.round(pt.color[2] * alpha));
        }
    }
}

function drawHen(display, w, h, hen, t, stretchAmt, squashAmt, stretchGate, squashGate, staggerLevel, tintColor, squashColor, particles, stretchRaw, squashRaw) {
    const phaseOffset = (hen.seq * staggerLevel * WALK_CYCLE) / 12;
    const potPhase = Math.sin(2 * Math.PI * (t + phaseOffset) / WALK_CYCLE);
    const birdPhase = Math.sin(2 * Math.PI * (t - BIRD_DELAY + phaseOffset) / WALK_CYCLE);
    const leafPhase = Math.sin(2 * Math.PI * (t - LEAF_DELAY + phaseOffset) / WALK_CYCLE);

    const pot = computePhaseState(potPhase, stretchAmt, squashAmt, stretchGate, squashGate, tintColor, squashColor);
    const bird = computePhaseState(birdPhase, stretchAmt, squashAmt, stretchGate, squashGate, tintColor, squashColor);
    const leaf = computePhaseState(leafPhase, stretchAmt, squashAmt, stretchGate, squashGate, tintColor, squashColor);
    // the pot only reddens on its own squash phase; the hen/plant only tints
    // on its own stretch phase — each part ignores the other phase's tint
    if (!pot.squashing) pot.tintStrength = 0;
    if (bird.squashing) bird.tintStrength = 0;
    if (leaf.squashing) leaf.tintStrength = 0;

    // pot: parent, pivots at the floor (unchanged bottom anchor)
    const centerX = hen.x + HEN_W / 2;
    const baseBottom = hen.y + HEN_H;
    pot.originYf = baseBottom - POT_ROWS * pot.scaleY;
    pot.originXf = centerX - (HEN_W * pot.scaleX) / 2;

    // hen + plant: children, pivot at the pot's current (already-scaled) top
    // edge — the leaves use the same anchor as the hen, just their own
    // (further-delayed) phase/scale
    bird.originYf = pot.originYf - BIRD_ROWS * bird.scaleY;
    bird.originXf = centerX - (HEN_W * bird.scaleX) / 2;
    leaf.originYf = pot.originYf - BIRD_ROWS * leaf.scaleY;
    leaf.originXf = centerX - (HEN_W * leaf.scaleX) / 2;

    maybeSpawnLeafParticle(hen, leaf, t, particles, stretchGate, squashGate, stretchRaw, squashRaw);

    // solid pixels first, all sharing one occupancy grid, so a halo drawn
    // later can never overwrite pixels another part already drew
    const occupied = new Uint8Array(w * h);
    const leafGlow = drawPart(display, w, h, 0, BIRD_ROWS, leaf, occupied, IS_LEAF);
    const birdGlow = drawPart(display, w, h, 0, BIRD_ROWS, bird, occupied, NOT_LEAF);
    const potGlow = drawPart(display, w, h, BIRD_ROWS, HEN_H, pot, occupied, ANY_CODE);
    const letterGlow = drawLetter(display, w, h, hen, pot, bird, occupied);

    if (leafGlow) applyGlow(display, w, h, occupied, leafGlow);
    if (birdGlow) applyGlow(display, w, h, occupied, birdGlow);
    if (potGlow) applyGlow(display, w, h, occupied, potGlow);
    if (letterGlow) applyGlow(display, w, h, occupied, letterGlow);
}

export function draw(display, params, time) {
    const w = display.width, h = display.height;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) display.setPixel(x, y, 0, 0, 0);

    const t = params.timeAcc;
    const stretchAmt = 0.1 + params.stretchRaw * 0.8;
    const squashAmt = 0.1 + params.squashRaw * 0.8;
    // both tints only start past the halfway point of their knob's travel
    const stretchGate = clamp((params.stretchRaw - 0.5) * 2, 0, 1);
    const squashGate = clamp((params.squashRaw - 0.5) * 2, 0, 1);

    // fallen leaves render first — behind every hen, since they're debris
    // the flock has already walked past, not part of any hen's own rig
    params.leafParticles = params.leafParticles.filter(p => (t - p.bornAt) < p.duration);
    drawLeafParticles(display, w, h, params.leafParticles, t);

    for (const hen of params.hens) {
        drawHen(display, w, h, hen, t, stretchAmt, squashAmt, stretchGate, squashGate, params.staggerKnob * MAX_STAGGER, params.tintColor, params.squashColor, params.leafParticles, params.stretchRaw, params.squashRaw);
    }

    if (params.debugText) drawDebugText(display, w, h, params.debugText);
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
