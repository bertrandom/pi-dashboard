// ===== Patternflow pattern =====
// Title:    Day and Night dreamy beach
// Author:   @WollyMeister
// Date:     2026-08-19
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @knobs Waves=0..1, Speed=0.1..3, Plankton=0..1, TimeOfDay=0..1
// @matrix 128x64

//
// Knob 1 (Waves):     Wave intensity — glassy calm to churning surf
// Knob 2 (Speed):     Animation speed — still water to surging tide
// Knob 3 (Plankton):  Bioluminescent plankton (strongest at night)
// Knob 4 (TimeOfDay): 0=midnight · 0.25=dawn · 0.5=noon · 0.75=dusk · 1=midnight

// ── Layout ────────────────────────────────────────────────────────────────────
const HORIZON_FRAC = 0.40;
const COAST_FRAC   = 0.78;

// ── Lighthouse ────────────────────────────────────────────────────────────────
const LH_X_FRAC   = 0.820;   // x position as fraction of display width
const LH_HEIGHT   = 13;      // tower height in pixels (base to beacon)
const LH_BEAM_SPD = 0.50;    // beam rotation speed (radians per time-unit)

// ── Wave trains ───────────────────────────────────────────────────────────────
const WAVE_SPEEDS  = [0.28, 0.22, 0.36, 0.18];
const WAVE_SLOPES  = [0.05, -0.04, 0.08, -0.06];
const WAVE_OFFSETS = [0.00,  0.25,  0.50,  0.75];
const WAVE_AMPS    = [1.00,  0.80,  0.62,  0.42];

// ── Sky colour keypoints (midnight / dawn / noon / dusk) ──────────────────────
// Each entry: [top_R, top_G, top_B,  hor_R, hor_G, hor_B]
const SKY_KEYS = [
  [0.005, 0.008, 0.045,   0.040, 0.050, 0.090],  // midnight
  [0.070, 0.030, 0.120,   0.900, 0.420, 0.120],  // dawn
  [0.045, 0.165, 0.520,   0.270, 0.570, 0.920],  // noon
  [0.090, 0.022, 0.060,   0.820, 0.270, 0.055],  // dusk
];

// ── Sea colour keypoints ───────────────────────────────────────────────────────
// [baseR_deep, baseG_deep, baseB_deep,  baseR_shore, baseG_shore, baseB_shore]
const SEA_KEYS = [
  [0.010, 0.038, 0.065,   0.020, 0.068, 0.105],  // midnight
  [0.030, 0.060, 0.090,   0.090, 0.120, 0.150],  // dawn
  [0.035, 0.190, 0.420,   0.060, 0.300, 0.600],  // noon
  [0.055, 0.040, 0.030,   0.140, 0.080, 0.040],  // dusk
];

// ── Math ──────────────────────────────────────────────────────────────────────
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function fract(v)          { return v - Math.floor(v); }
function mix(a, b, t)      { return a + (b - a) * t; }
function smoothstep(e0, e1, x) {
  let t = clamp((x - e0) / (e1 - e0), 0.0, 1.0);
  return t * t * (3.0 - 2.0 * t);
}

// ── Noise ─────────────────────────────────────────────────────────────────────
function h21(x, y) {
  let n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}
function noise2(x, y) {
  let ix = Math.floor(x), iy = Math.floor(y);
  let fx = x - ix, fy = y - iy;
  let ux = fx * fx * (3.0 - 2.0 * fx);
  let uy = fy * fy * (3.0 - 2.0 * fy);
  return mix(mix(h21(ix, iy), h21(ix+1, iy), ux),
             mix(h21(ix, iy+1), h21(ix+1, iy+1), ux), uy);
}
function fbm3(x, y) {
  return noise2(x,       y)       * 0.500
       + noise2(x * 2.1, y * 2.1) * 0.250
       + noise2(x * 4.4, y * 4.4) * 0.125;
}

// ── 4-keypoint cyclic colour interpolation ────────────────────────────────────
// tod: 0=midnight, 0.25=dawn, 0.5=noon, 0.75=dusk (wraps at 1.0)
function interpKey(keys, tod, ch) {
  let t4 = fract(tod) * 4.0;
  let i  = Math.floor(t4) % 4;
  let f  = t4 - Math.floor(t4);
  let s  = f * f * (3.0 - 2.0 * f); // smoothstep
  return mix(keys[i][ch], keys[(i + 1) % 4][ch], s);
}

// ── Time-of-day derived quantities ────────────────────────────────────────────
// How "night" it is: 1 at midnight (tod=0/1), 0 at noon (tod=0.5).
function nightness(tod) {
  return smoothstep(0.12, 0.34, Math.abs(fract(tod) - 0.5));
}
// How much "golden hour" there is (peaks at dawn & dusk).
function goldenness(tod) {
  let d = Math.abs(fract(tod + 0.5) - 0.5); // 0.5 at midnight, 0 at noon
  return smoothstep(0.20, 0.27, d) * (1.0 - smoothstep(0.38, 0.50, d));
}

// ── Celestial body positions ───────────────────────────────────────────────────
// Sun: visible tod ≈ 0.18..0.82. Rises left (dawn=0.25), sets right (dusk=0.75).
function getSunPos(tod, w, h, horizY) {
  let phase = (fract(tod) - 0.25) / 0.50; // 0 at dawn, 1 at dusk
  if (phase < 0.0 || phase > 1.0) return null;
  return {
    x: w * phase,
    y: horizY - horizY * 0.88 * Math.sin(phase * Math.PI),
    // Colour: deep orange at horizon, warm golden-yellow at zenith
    r: 1.00,
    g: mix(0.38, 0.78, Math.sin(phase * Math.PI)), // amber→golden-yellow
    b: mix(0.05, 0.18, Math.sin(phase * Math.PI)), // stays warm, no white-out
    radius: h * 0.062,
    brightness: 1.0,
  };
}
// Moon: opposite arc — rises right (after dusk), sets left (before dawn).
// moonTod = tod + 0.5 gives the sun-equivalent phase for the moon.
function getMoonPos(tod, w, h, horizY) {
  let moonTod = fract(tod + 0.5);
  let phase   = (moonTod - 0.25) / 0.50;
  if (phase < 0.0 || phase > 1.0) return null;
  // Moon rises on right side (opposite sun), travels right→left
  return {
    x: w * (1.0 - phase),  // right at moonrise, left at moonset
    y: horizY - horizY * 0.84 * Math.sin(phase * Math.PI),
    // Colour: warm orange near horizon, cool silver at zenith
    r: mix(0.92, 0.88, Math.sin(phase * Math.PI)),
    g: mix(0.68, 0.92, Math.sin(phase * Math.PI)),
    b: mix(0.30, 1.00, Math.sin(phase * Math.PI)),
    radius: h * 0.090,
    brightness: nightness(tod), // fades when sun is up
  };
}

// ── Coastline ────────────────────────────────────────────────────────────────
function getCoastY(x, w, h) {
  let nx    = x / w;
  let base  = h * COAST_FRAC;
  let slow  = Math.sin(nx * Math.PI * 1.9 + 0.5) * h * 0.032;
  let rocky = (fbm3(nx * 3.2, 0.84) - 0.5) * h * 0.055;
  return base + slow + rocky;
}

// ── Wave bio glow ─────────────────────────────────────────────────────────────
function totalWaveGlow(x, y, t, wI, horizY, shY, w) {
  let nx    = x / w;
  let total = 0.0;
  for (let i = 0; i < 4; i++) {
    let phase  = fract(t * WAVE_SPEEDS[i] - nx * WAVE_SLOPES[i] + WAVE_OFFSETS[i]);
    let crestY = horizY + (shY - horizY) * phase;
    let distY  = y - crestY;
    // Wider, softer sigma so wave crests are diffuse rather than sharp bands
    let sigma  = 2.8 + phase * 5.5;
    // Gentle leading slope, steeper trailing face
    let glow   = distY >= -sigma * 0.4
               ? Math.exp(-distY * distY / (sigma * sigma))
               : Math.exp(-distY * distY / (sigma * sigma * 0.35));
    // More gradual shoaling build-up
    let shoaling = smoothstep(0.0, 0.85, phase) * (0.35 + phase * 0.85);
    total += glow * shoaling * WAVE_AMPS[i] * wI;
  }
  return clamp(total, 0.0, 1.0);
}

// Wave crest phase at a given column (shared by surf and wash)
function wavePhaseAt(i, nx, t) {
  return fract(t * WAVE_SPEEDS[i] - nx * WAVE_SLOPES[i] + WAVE_OFFSETS[i]);
}

// Beach wash strength (bioluminescent run-up)
function beachWash(x, y, t, wI, shY, w) {
  let nx    = x / w;
  let maxUp = (shY * (COAST_FRAC - HORIZON_FRAC)) * 0.30;  // wider swash reach
  let best  = 0.0;
  for (let i = 0; i < 2; i++) {
    let phase = wavePhaseAt(i, nx, t);
    let str   = smoothstep(0.72, 1.0, phase) * WAVE_AMPS[i] * wI;
    let dist  = y - shY;
    if (dist < 0 || dist > maxUp) continue;
    let w_ = smoothstep(maxUp, 0.0, dist) * str;  // smooth exponential runup
    if (w_ > best) best = w_;
  }
  return clamp(best, 0.0, 1.0);
}

// ── Celestial body rendering ───────────────────────────────────────────────────
// Returns {r,g,b} contribution of a body (sun or moon) to a sky pixel at (x,y).
function bodyLight(bx, by, br, bodyR, bodyG, bodyB, bodyBrightness, x, y, isMoon) {
  let dx   = x - bx, dy = y - by;
  let dist = Math.sqrt(dx * dx + dy * dy);
  let disk = smoothstep(br, br * 0.72, dist) * bodyBrightness;
  // Wide soft glow / atmosphere scatter
  let glow = Math.exp(-dist / (br * (isMoon ? 4.2 : 6.5))) * 0.45 * bodyBrightness;
  let total = disk + glow;
  return { r: bodyR * total, g: bodyG * total, b: bodyB * total, disk: disk };
}

// ── Lighthouse beam contribution ──────────────────────────────────────────────
// Returns 0..1 brightness for pixel (x,y) based on rotating beacon at (lhX,lhTopY)
function lighthouseBeam(x, y, lhX, lhTopY, t, night) {
  let dx = x - lhX, dy = y - lhTopY;
  let dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 2.0) return 0.0;
  let pixAngle  = Math.atan2(dy, dx);
  let beamAngle = t * LH_BEAM_SPD;
  // Two opposite beams (classic lighthouse double rotation)
  let d1 = Math.abs(fract((pixAngle - beamAngle)           / (2 * Math.PI) + 0.5) - 0.5) * (2 * Math.PI);
  let d2 = Math.abs(fract((pixAngle - beamAngle + Math.PI) / (2 * Math.PI) + 0.5) - 0.5) * (2 * Math.PI);
  let beam = smoothstep(0.20, 0.04, Math.min(d1, d2));
  return beam * Math.exp(-dist * 0.055) * night;
}

// ── Shooting star brightness ───────────────────────────────────────────────────
// Returns 0..1 glow for a pixel from deterministic comet streaks
function shootingStarBrightness(x, y, t, night, w, horizY) {
  if (night < 0.25) return 0.0;
  const NS = 3, PERIOD = 11.0, ACTIVE = 0.09, TAIL = 12.0;
  let out = 0.0;
  for (let s = 0; s < NS; s++) {
    let slotT = t / PERIOD + s / NS;
    let epoch = Math.floor(slotT);
    let phase = fract(slotT);
    if (phase > ACTIVE) continue;
    let h1 = h21(epoch * 127 + s * 31, s *  53 + epoch *  7);
    let h2 = h21(epoch *  61 + s * 19, epoch * 37 + s * 11);
    let h3 = h21(epoch *  89 + s * 43, epoch * 17 + s *  3);
    if (h1 > 0.55) continue;                         // ~45% of epochs have a star
    let startX = h2 * (w + 10) - 5;
    let startY = h3 * horizY   * 0.65 + 2.0;
    let dirX   = h3 > 0.5 ? 1.0 : -1.0;             // random left/right
    let dirY   = 0.18 + h2 * 0.26;                   // slight downward angle
    let dLen   = Math.sqrt(dirX * dirX + dirY * dirY);
    dirX /= dLen; dirY /= dLen;
    let traveled = (phase / ACTIVE) * (65 + h1 * 55) * ACTIVE * PERIOD;
    let tipX = startX + dirX * traveled;
    let tipY = startY + dirY * traveled;
    let px = x - tipX, py = y - tipY;
    let along = px * dirX + py * dirY;               // +ve = in tail behind tip
    if (along < -0.5 || along > TAIL) continue;
    let perpX = px - along * dirX, perpY = py - along * dirY;
    let perp  = Math.sqrt(perpX * perpX + perpY * perpY);
    if (perp > 1.0) continue;
    let tailFade = along <= 0 ? Math.exp(-along * along * 5.0)
                              : smoothstep(TAIL, 0.0, along);
    let perpFade = Math.exp(-perp * perp * 4.0);
    let timeFade = smoothstep(ACTIVE, ACTIVE * 0.15, phase);
    out = Math.max(out, tailFade * perpFade * timeFade);
  }
  return clamp(out * night, 0.0, 1.0);
}

// ── Seagull pixel test ────────────────────────────────────────────────────────
// Returns true if (x,y) is part of any seagull silhouette at time t
function isSeagullPixel(x, y, t, night, w, horizY) {
  if (night > 0.80) return false;
  const BIRDS = [
    { spd:  0.040, yf: 0.22, off: 0.08, wf: 2.0 },  // slow, high
    { spd: -0.027, yf: 0.50, off: 0.55, wf: 1.7 },  // going left, mid
    { spd:  0.053, yf: 0.34, off: 0.72, wf: 2.4 },  // fast, upper-mid
    { spd: -0.019, yf: 0.66, off: 0.30, wf: 1.5 },  // slow left, low sky
    { spd:  0.033, yf: 0.14, off: 0.42, wf: 2.2 },  // very high, right
    { spd: -0.046, yf: 0.44, off: 0.88, wf: 1.9 },  // mid-height, left, faster
  ];
  for (let i = 0; i < BIRDS.length; i++) {
    let bd = BIRDS[i];
    let bx = Math.round(fract(bd.off + t * bd.spd) * (w + 8) - 4);
    let by = Math.round(bd.yf * horizY);
    let dx = x - bx, dy = y - by;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 1) continue;
    // Wing animation: tipDY cycles -1 (up) → 0 (level) → +1 (down)
    let tipDY = Math.round(-Math.sin(t * bd.wf + i * 1.9));
    if (dx === 0              && dy === 0)     return true;  // body
    if (Math.abs(dx) === 1   && dy === 0)     return true;  // inner wing
    if (Math.abs(dx) === 2   && dy === tipDY) return true;  // outer flapping tip
  }
  return false;
}

// ── Setup ─────────────────────────────────────────────────────────────────────
export function setup(params) {
  params.timeAcc       = 0.0;
  params.waveIntensity = 0.55;
  params.speed         = 1.0;
  params.bioIntensity  = 0.70;
  params.tod           = 0.0;    // default: midnight
  params.rgb           = [0, 0, 0];
}

// ── Update ────────────────────────────────────────────────────────────────────
export function update(dt, input, params) {
  if (input && input.knobValues) {
    params.waveIntensity = clamp(input.knobValues[0], 0.0, 1.0);
    params.speed         = clamp(input.knobValues[1], 0.1, 3.0);
    params.bioIntensity  = clamp(input.knobValues[2], 0.0, 1.0);
    params.tod           = clamp(input.knobValues[3], 0.0, 1.0);
  } else if (input && input.knobDeltas) {
    params.waveIntensity = clamp(params.waveIntensity + input.knobDeltas[0] * 0.05, 0.0, 1.0);
    params.speed         = clamp(params.speed         + input.knobDeltas[1] * 0.10, 0.1, 3.0);
    params.bioIntensity  = clamp(params.bioIntensity  + input.knobDeltas[2] * 0.05, 0.0, 1.0);
    params.tod           = clamp(params.tod           + input.knobDeltas[3] * 0.02, 0.0, 1.0);
  }
  params.timeAcc += dt * params.speed;
}

// ── Draw ──────────────────────────────────────────────────────────────────────
export function draw(display, params, time) {
  const w   = display.width;
  const h   = display.height;
  const t   = params.timeAcc;
  const wI  = params.waveIntensity;
  const bI  = params.bioIntensity;
  const tod = params.tod;
  const rgb = params.rgb;

  const horizY = h * HORIZON_FRAC;

  // ── Time-of-day factors ──────────────────────────────────────────────
  const night  = nightness(tod);    // 1 = dark, 0 = bright noon
  const golden = goldenness(tod);   // peaks at dawn / dusk

  // ── Celestial positions ──────────────────────────────────────────────
  const sun  = getSunPos(tod, w, h, horizY);
  const moon = getMoonPos(tod, w, h, horizY);

  // Effective bio multiplier: only glows at night, fades at dawn/dusk
  const bioMult = night * bI;

  // ── Lighthouse geometry (constant per frame) ─────────────────────────
  const lhX    = Math.round(w * LH_X_FRAC);
  const lhGndY = Math.round(getCoastY(lhX, w, h));
  const lhTopY = lhGndY - LH_HEIGHT;

  // ── Fishing vessel (drifts slowly left→right, wraps) ─────────────────
  const shipX = Math.round(fract(0.28 + t * 0.0055) * (w + 28) - 14);
  const shipY = Math.round(horizY) - 1;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {

      const shY = getCoastY(x, w, h);
      let r = 0.0, g = 0.0, b = 0.0;

      // ═══════════════════════════════════════════════════════════
      // ZONE 1 — SKY
      // ═══════════════════════════════════════════════════════════
      if (y < horizY) {
        let skyT = y / horizY; // 0 = top, 1 = horizon

        // Blend sky gradient from keypoints
        let topR = interpKey(SKY_KEYS, tod, 0);
        let topG = interpKey(SKY_KEYS, tod, 1);
        let topB = interpKey(SKY_KEYS, tod, 2);
        let horR = interpKey(SKY_KEYS, tod, 3);
        let horG = interpKey(SKY_KEYS, tod, 4);
        let horB = interpKey(SKY_KEYS, tod, 5);

        r = mix(topR, horR, skyT * skyT);
        g = mix(topG, horG, skyT * skyT);
        b = mix(topB, horB, skyT * skyT);

        // Stars: fade in with night
        if (night > 0.05) {
          let sh = h21(x, y);
          if (sh > 0.958) {
            let twinkle = 0.45 + 0.55 * Math.sin(t * (1.2 + sh * 2.1) + x * 0.73 + y * 1.17);
            let br      = (sh - 0.958) / 0.042 * twinkle * night;
            r += br * mix(0.84, 1.0, h21(x+1, y));
            g += br * mix(0.87, 1.0, h21(x, y+1));
            b += br;
          }
        }

        // ── Milky Way / nebula band (deep night only) ────────────────────
        if (night > 0.50) {
          // Diagonal band: lower-left to upper-right
          let mwCY   = horizY * (0.68 - 0.60 * x / w);
          let mwDist = y - mwCY;
          let mwW    = horizY * 0.26;
          let mwFall = Math.exp(-mwDist * mwDist / (mwW * mwW));
          // Two fBm layers: large clumps + fine detail
          let mwN1 = fbm3(x * 0.021 + 8.0,  y * 0.058 + 12.0);
          let mwN2 = noise2(x * 0.065 + 3.0, y * 0.18  + 22.0);
          let mwN  = mwN1 * 0.65 + mwN2 * 0.35;
          // Dark dust-lane: subtract brightness in dense-noise troughs
          let dustN    = noise2(x * 0.080 + 1.5, y * 0.16 + 7.0);
          let dustMask = 1.0 - smoothstep(0.40, 0.55, dustN) * 0.55;
          let mwStr = mwFall * mwN * dustMask * (night - 0.50) * 2.0;
          // Three nebula colour pockets blended by noise value:
          // blue-violet → deep purple → hot pink/magenta
          let mwR, mwG, mwB;
          if (mwN1 < 0.42) {
            let f = mwN1 / 0.42;
            mwR = mix(0.18, 0.52, f); mwG = mix(0.10, 0.08, f); mwB = mix(0.72, 0.88, f);
          } else if (mwN1 < 0.68) {
            let f = (mwN1 - 0.42) / 0.26;
            mwR = mix(0.52, 0.82, f); mwG = mix(0.08, 0.12, f); mwB = mix(0.88, 0.60, f);
          } else {
            let f = (mwN1 - 0.68) / 0.32;
            mwR = mix(0.82, 0.65, f); mwG = mix(0.12, 0.05, f); mwB = mix(0.60, 0.85, f);
          }
          r += mwStr * mwR; g += mwStr * mwG; b += mwStr * mwB;
          // Dense coloured speckles within the band
          if (mwFall > 0.10) {
            let mwStar = h21(x * 3 + 70, y * 7 + 1100);
            if (mwStar > 0.948) {
              let sBr   = (mwStar - 0.948) / 0.052 * mwFall * night * 0.80;
              let starC = h21(x * 7 + 33, y * 11 + 1500); // warm vs cool star tint
              r += sBr * mix(0.95, 0.72, starC);
              g += sBr * mix(0.72, 0.78, starC);
              b += sBr * mix(0.88, 1.00, starC);
            }
          }
        }

        // Wispy clouds — lit differently by day vs. night vs. golden hour
        let c1    = fbm3(x * 0.022 + t * 0.003, y * 0.11 + 0.6);
        let c2    = fbm3(x * 0.016 - t * 0.002, y * 0.07 + 4.3) * 0.6;
        let cloud = smoothstep(0.62, 0.82, c1 + c2 * 0.35) * (1.0 - skyT * 0.5);
        // Night cloud: dark, barely visible; golden hour: lit orange; day: white
        let cloudR = night * 0.022 + golden * 0.18 + (1-night-golden) * 0.22;
        let cloudG = night * 0.018 + golden * 0.10 + (1-night-golden) * 0.20;
        let cloudB = night * 0.024 + golden * 0.04 + (1-night-golden) * 0.22;
        r += cloud * cloudR; g += cloud * cloudG; b += cloud * cloudB;

        // Horizon glow from the light source below
        let hGlowStr = Math.exp(-(horizY - 1.0 - y) * 0.20) * 0.065;
        // At dawn/dusk tint by the golden hour; at night by moon; at noon by sky
        let hGR = golden * 0.90 + night * 0.08 + (1-golden-night) * 0.30;
        let hGG = golden * 0.40 + night * 0.09 + (1-golden-night) * 0.55;
        let hGB = golden * 0.05 + night * 0.09 + (1-golden-night) * 0.85;
        r += hGlowStr * hGR; g += hGlowStr * hGG; b += hGlowStr * hGB;

        // Sun light contribution to sky
        if (sun !== null) {
          let sl = bodyLight(sun.x, sun.y, sun.radius, sun.r, sun.g, sun.b, sun.brightness, x, y, false);
          r += sl.r; g += sl.g; b += sl.b;
        }
        // Moon light contribution to sky
        if (moon !== null && moon.brightness > 0.01) {
          let ml = bodyLight(moon.x, moon.y, moon.radius, moon.r, moon.g, moon.b, moon.brightness, x, y, true);
          r += ml.r; g += ml.g; b += ml.b;
        }

        // ── Shooting stars ───────────────────────────────────────────────
        let starGlow = shootingStarBrightness(x, y, t, night, w, horizY);
        r += starGlow * 1.00; g += starGlow * 0.97; b += starGlow * 0.92;

        // ── Lighthouse beam sweeping through sky ─────────────────────────
        let lhSky = lighthouseBeam(x, y, lhX, lhTopY, t, night);
        r += lhSky; g += lhSky * 0.90; b += lhSky * 0.52;

        // ── Seagull silhouettes (dark against sky, day only) ─────────────
        if (isSeagullPixel(x, y, t, night, w, horizY)) {
          r *= 0.08; g *= 0.09; b *= 0.10;
        }

      // ═══════════════════════════════════════════════════════════
      // ZONE 2 — SEA
      // ═══════════════════════════════════════════════════════════
      } else if (y < shY) {
        let seaDepth = clamp((y - horizY) / Math.max(1.0, shY - horizY), 0.0, 1.0);

        // Base sea colour from keypoints (blends deep→shore by seaDepth)
        let seaDeepR = interpKey(SEA_KEYS, tod, 0);
        let seaDeepG = interpKey(SEA_KEYS, tod, 1);
        let seaDeepB = interpKey(SEA_KEYS, tod, 2);
        let seaShorR = interpKey(SEA_KEYS, tod, 3);
        let seaShorG = interpKey(SEA_KEYS, tod, 4);
        let seaShorB = interpKey(SEA_KEYS, tod, 5);

        // fBm for local water texture variation
        let seaN = fbm3(x * 0.045 + t * 0.028, y * 0.075);
        let tex  = 0.75 + seaN * 0.50;

        r = mix(seaDeepR, seaShorR, seaDepth * seaDepth) * tex;
        g = mix(seaDeepG, seaShorG, seaDepth * seaDepth) * tex;
        b = mix(seaDeepB, seaShorB, seaDepth * seaDepth) * tex;

        // ── Light body reflection on water ──────────────────────
        // Active light source: sun during day, moon at night
        let reflBody = (sun !== null) ? sun  : null;
        let reflMoon = (moon !== null && moon.brightness > 0.02) ? moon : null;

        if (reflBody !== null) {
          // Sun reflection: bright specular column
          let dx    = x - reflBody.x;
          let wid   = 1.5 + seaDepth * 10.0;
          let col   = Math.exp(-dx * dx / (wid * wid));
          let shim  = 0.55 + 0.45 * Math.sin(t * 3.8 + y * 0.55 + x * 0.22)
                                   * Math.cos(t * 2.1 - y * 0.28 + x * 0.14);
          let fade  = smoothstep(0.0, 0.35, seaDepth);
          let mStr  = col * shim * fade;
          r += mStr * reflBody.r * 0.60;
          g += mStr * reflBody.g * 0.55;
          b += mStr * reflBody.b * 0.45;
        }
        if (reflMoon !== null) {
          let dx    = x - reflMoon.x;
          let wid   = 1.8 + seaDepth * 11.0;
          let col   = Math.exp(-dx * dx / (wid * wid));
          let shim  = 0.60 + 0.40 * Math.sin(t * 3.2 + y * 0.50 + x * 0.20);
          let fade  = smoothstep(0.0, 0.38, seaDepth);
          let mStr  = col * shim * fade * reflMoon.brightness;
          r += mStr * reflMoon.r * 0.50;
          g += mStr * reflMoon.g * 0.44;
          b += mStr * reflMoon.b * 0.38;
        }

        // ── Bioluminescent wave crests (night only) ─────────────
        let waveGlow = totalWaveGlow(x, y, t, wI, horizY, shY, w);
        let bioShift = 0.06 * Math.sin(t * 0.36 + x * 0.030);
        r += waveGlow * bioMult * 0.020;
        g += waveGlow * bioMult * (0.68 + bioShift);
        b += waveGlow * bioMult * (0.90 - bioShift * 0.3);

        // ── Daytime wave surface sheen (subtle crests at day) ────
        // Gives visible wave structure during daylight without bio-glow
        if (night < 0.92) {
          let dayFactor = (1.0 - night) * 0.20;
          // Warm blue-white highlight — slightly less blue than the bio glow
          r += waveGlow * dayFactor * 0.62;
          g += waveGlow * dayFactor * 0.88;
          b += waveGlow * dayFactor * 1.00;
        }

        // ── Whitecaps / wave foam (fbm-based, organic) ───────────
        let nx_   = x / w;
        let fmN   = fbm3(nx_ * 7.0 - t * 1.0 + 0.4, seaDepth * 2.5 + 2.0);
        let cap   = smoothstep(0.56, 0.76, fmN);
        let capStr = cap * smoothstep(0.18, 0.85, seaDepth) * 0.18 * wI;
        // Foam is warm white at day, silver-blue at night
        let foamR = capStr * mix(0.68, 1.00, 1.0 - night * 0.45);
        let foamG = capStr * mix(0.72, 1.00, 1.0 - night * 0.28);
        let foamB = capStr * mix(0.78, 1.00, 1.0 - night * 0.10);
        r += foamR; g += foamG; b += foamB;

        // ── Breaking surf right at the shoreline ─────────────────
        // Thin strip of churning white foam where waves hit the beach
        let surfDist = shY - y;
        if (surfDist < 7.0) {
          let surfFade  = smoothstep(7.0, 0.5, surfDist);
          let surgePhase = wavePhaseAt(0, nx_, t);
          let surge2    = wavePhaseAt(1, nx_, t);
          let surge     = smoothstep(0.68, 0.94, surgePhase) * smoothstep(1.00, 0.82, surgePhase)
                        + smoothstep(0.72, 0.96, surge2)     * smoothstep(1.00, 0.84, surge2) * 0.6;
          let sStr      = surfFade * clamp(surge, 0.0, 1.0) * wI * 0.42;
          r += sStr * 1.00; g += sStr * 0.97; b += sStr * 0.92;
        }

        // ── Soft sky-blend at the horizon line ──────────────────
        let hBlend = smoothstep(0.0, 0.22, seaDepth);
        let skyHR = interpKey(SKY_KEYS, tod, 3);
        let skyHG = interpKey(SKY_KEYS, tod, 4);
        let skyHB = interpKey(SKY_KEYS, tod, 5);
        r = mix(skyHR * 0.55, r, hBlend);
        g = mix(skyHG * 0.55, g, hBlend);
        b = mix(skyHB * 0.55, b, hBlend);

        // ── Reflected star flecks (night) ────────────────────────
        if (night > 0.5 && h21(Math.floor(x * 0.68), Math.floor(y * 0.58) + 100) > 0.977) {
          let sR = 0.055 * (0.5 + 0.5 * Math.sin(t * 2.1 + x * 0.88)) * night;
          r += sR; g += sR; b += sR * 1.05;
        }

        // ── Lighthouse beam sweeping over sea ─────────────────────
        let lhSea = lighthouseBeam(x, y, lhX, lhTopY, t, night);
        r += lhSea * 0.90; g += lhSea * 0.82; b += lhSea * 0.42;

      // ═══════════════════════════════════════════════════════════
      // ZONE 3 — BEACH
      // ═══════════════════════════════════════════════════════════
      } else {
        let shoreT = clamp((y - shY) / Math.max(1.0, h - shY), 0.0, 1.0);

        // Rocky/sandy texture
        let rockN  = fbm3(x * 0.112, y * 0.112);
        let isRock = rockN > 0.598;

        // Base brightness: nearly invisible at night, fully lit at day
        let dayBr = mix(0.06, 1.0, 1.0 - night);
        let baseBr = isRock
          ? (0.210 + rockN * 0.150) * dayBr
          : (0.155 + rockN * 0.120) * dayBr;

        // Colour tint: sandy warm gold at noon, rich amber at dusk/dawn, cool dark at night
        let tR = night * 0.90 + golden * 1.00 + (1-night-golden) * 0.98;
        let tG = night * 0.70 + golden * 0.68 + (1-night-golden) * 0.84;
        let tB = night * 0.52 + golden * 0.28 + (1-night-golden) * 0.46;
        r = baseBr * tR;
        g = baseBr * tG;
        b = baseBr * tB;

        // ── Wet sand / swash zone at water's edge ────────────────
        // The first few pixels of beach are darkened, tinted sea-blue, and
        // shimmer slightly — blending the hard sea/sand boundary smoothly.
        let wetDist = y - shY;
        let wetness = smoothstep(6.0, 0.0, wetDist);
        if (wetness > 0.01) {
          let seaSR = interpKey(SEA_KEYS, tod, 3);
          let seaSG = interpKey(SEA_KEYS, tod, 4);
          let seaSB = interpKey(SEA_KEYS, tod, 5);
          let wMix  = wetness * 0.72 * dayBr;
          r = mix(r, r * 0.40 + seaSR * 0.35, wMix);
          g = mix(g, g * 0.40 + seaSG * 0.35, wMix);
          b = mix(b, b * 0.35 + seaSB * 0.52, wMix);
          // Subtle reflective sheen on wet sand
          let sheen = smoothstep(0.4, 1.0, wetness) * 0.06 * dayBr
                    * (0.5 + 0.5 * Math.sin(t * 1.9 + x * 0.15));
          r += sheen * 0.80; g += sheen * 0.88; b += sheen;
        }

        // Bioluminescent wave wash — only at night
        let wash = beachWash(x, y, t, wI, shY, w) * bioMult;
        r += wash * 0.012;
        g += wash * 0.300;
        b += wash * 0.560;

        // Tide pools (night only)
        if (night > 0.3) {
          let tpH = h21(Math.floor(x / 4) * 7, Math.floor(y / 3) * 11 + 200);
          if (tpH > 0.936 && shoreT < 0.30) {
            let glow   = (tpH - 0.936) / 0.064 * bioMult * 0.55;
            let tpPuls = 0.7 + 0.3 * Math.sin(t * 1.1 + tpH * 9.0);
            r += glow * 0.012 * tpPuls;
            g += glow * 0.210 * tpPuls;
            b += glow * 0.400 * tpPuls;
          }
        }

        // Pebble specks (neutral)
        if (h21(Math.floor(x / 2), Math.floor(y / 2) + 300) > 0.963 && shoreT > 0.04) {
          r += 0.028 * dayBr; g += 0.024 * dayBr; b += 0.018 * dayBr;
        }

        // ── Persistent foam patches (linger after each wave wash) ─────────
        // Foam deposits when phase ≈ 1 (wave at shore) and fades over ~40%
        // of the wave period. Two wave trains contribute for variety.
        if (shoreT < 0.42) {
          let nx_f = x / w;
          let beachFoamFade = smoothstep(0.42, 0.0, shoreT); // denser at waterline
          for (let fi = 0; fi < 2; fi++) {
            let ph = wavePhaseAt(fi, nx_f, t);
            // Age: 0 right after wave lands (ph wraps 1→0), grows as ph rises
            let age = ph < 0.5 ? ph : (1.0 - ph);
            if (age >= 0.38) continue;
            let foamFade = smoothstep(0.38, 0.02, age) * WAVE_AMPS[fi] * wI;
            // Patchy spatial hash so foam looks irregular, not uniform
            let foamH = h21(Math.floor(x / 2) * 13 + fi * 29,
                            Math.floor(y - shY)  * 17 + 550);
            if (foamH < 0.48) continue;
            let fc = foamFade * (foamH - 0.48) * 1.9 * beachFoamFade * dayBr * 0.30;
            r += fc; g += fc * 0.97; b += fc * 0.94;
          }
        }

        // ── Lighthouse beam sweeping over beach ───────────────────
        // Warm amber sweep; attenuates quickly into the sand
        let lhBeach = lighthouseBeam(x, y, lhX, lhTopY, t, night);
        r += lhBeach * 0.80; g += lhBeach * 0.62; b += lhBeach * 0.18;

      }

      // ── Lighthouse tower (painted over all zone shading) ──────────────
      // Tower tapers: wide base (5px), narrow mid (3px), lantern cap (3px)
      let towerHW = (y >= lhGndY - 3) ? 2 : 1;
      if (Math.abs(x - lhX) <= towerHW && y >= lhTopY && y < lhGndY) {
        let towerT  = clamp((y - lhTopY) / Math.max(1, LH_HEIGHT - 1), 0.0, 1.0);
        // Alternating red/white bands (classic lighthouse livery)
        let bandT   = fract(towerT * 3.5);
        let isRed   = bandT < 0.5 && towerT > 0.15 && towerT < 0.88;
        let towerBr = mix(0.38, 0.18, towerT);
        r = isRed ? towerBr * 1.00 : towerBr;
        g = isRed ? towerBr * 0.22 : towerBr * 0.95;
        b = isRed ? towerBr * 0.18 : towerBr * 0.87;
        // Lantern room (top 2 rows): glass dome glows amber at night
        if (y <= lhTopY + 1) {
          let pulse = 0.65 + 0.35 * Math.sin(t * LH_BEAM_SPD * 2.0 + 1.57);
          r = mix(towerBr, 1.00, night * 0.72 * pulse);
          g = mix(towerBr * 0.95, 0.85, night * 0.72 * pulse);
          b = mix(towerBr * 0.87, 0.20, night * 0.72 * pulse);
        }
      }
      // ── Lighthouse warm ambient halo (night only) ──────────────────────
      {
        let lhDx = x - lhX, lhDy = y - lhTopY;
        let lhAmb = Math.exp(-Math.sqrt(lhDx*lhDx + lhDy*lhDy) * 0.32) * night * 0.42;
        r += lhAmb; g += lhAmb * 0.80; b += lhAmb * 0.32;
      }

      // ── Distant fishing vessel (silhouette on horizon) ──────────────────
      {
        let sdx = x - shipX, sdy = y - shipY;
        if (Math.abs(sdx) <= 5 && Math.abs(sdy) <= 7) {
          // Hull: wider (11px) with a gentle curve at the waterline
          let isHull  = (Math.abs(sdx) <= 5 && sdy === 0)
                     || (Math.abs(sdx) <= 4 && sdy === 1)
                     || (Math.abs(sdx) <= 2 && sdy === 2);
          // Mast: taller centre pole
          let isMast  = (sdx === 0 && sdy >= -6 && sdy <= -1);
          // Cabin/wheelhouse: wider block near deck
          let isCabin = (Math.abs(sdx) <= 2 && sdy >= -2 && sdy <= -1);
          // Boom / yard-arm at mid-mast
          let isBoom  = (Math.abs(sdx) <= 2 && sdy === -4);
          if (isHull || isMast || isCabin || isBoom) {
            // Day: dark blue-grey silhouette; night: near-black
            let dayColor = 1.0 - night;
            r = r * 0.06 + dayColor * 0.14;
            g = g * 0.07 + dayColor * 0.16;
            b = b * 0.08 + dayColor * 0.22;
            // Hull waterline gets a slight rust/dark-red tint in daylight
            if (isHull && sdy >= 1) {
              r += dayColor * 0.10;
              g += dayColor * 0.02;
              b += dayColor * 0.00;
            }
            // Navigation light at mast top — bright amber pulse, always visible
            if (sdx === 0 && sdy === -6) {
              let navP = 0.70 + 0.30 * Math.sin(t * 1.8 + 0.7);
              // Bright at night, still faintly visible in daylight
              let navStr = mix(0.20, 1.00, night) * navP;
              r += navStr * 1.00;
              g += navStr * 0.62;
              b += navStr * 0.06;
            }
          }
        }
      }

      rgb[0] = Math.floor(clamp(r, 0.0, 1.0) * 255);
      rgb[1] = Math.floor(clamp(g, 0.0, 1.0) * 255);
      rgb[2] = Math.floor(clamp(b, 0.0, 1.0) * 255);
      display.setPixel(x, y, rgb[0], rgb[1], rgb[2]);
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
