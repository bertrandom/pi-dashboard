// ===== Patternflow pattern =====
// Title:    Chuseok Moon Shadow
// Author:   @mikdnom
// Date:     2026-09-25
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @matrix 64x128
// @knobs Zoom=1..3.5, MoonFlow=0..1, Wind=-10..10, Light=0..1
// Patternflow layer-stack composition — flattened by Pattern Lab.
// Layers (bottom → top):
//   1. rolllll (code, normal, 100%)
//   2. Pixel 1 (pixel, normal, 100%)
//   3. Code 1 (code, normal, 100%)
const __W = 64, __H = 128;
const __stack = [];

function __b64(s, n) {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const out = new Uint8ClampedArray(n);
  let o = 0, buf = 0, bits = 0;
  for (let i = 0; i < s.length && o < n; i++) {
    const v = A.indexOf(s[i]);
    if (v < 0) continue;
    buf = (buf << 6) | v; bits += 6;
    if (bits >= 8) { bits -= 8; out[o++] = (buf >> bits) & 255; }
  }
  return out;
}

// Run-length coded RGBA: base64 of {count-1, r, g, b, a} tuples.
function __rle(s, n) {
  const t = __b64(s, (s.length * 3) >> 2), out = new Uint8ClampedArray(n);
  let o = 0;
  for (let i = 0; i + 4 < t.length && o < n; i += 5) {
    for (let k = t[i] + 1; k > 0 && o < n; k--) {
      out[o++] = t[i + 1]; out[o++] = t[i + 2]; out[o++] = t[i + 3]; out[o++] = t[i + 4];
    }
  }
  return out;
}

function __mkDisplay(L) {
  return {
    width: __W, height: __H,
    setPixel(x, y, r, g, b) {
      const xi = x | 0, yi = y | 0;
      if (xi < 0 || xi >= __W || yi < 0 || yi >= __H) return;
      const i = (yi * __W + xi) * 4, B = L.buf;
      if (Array.isArray(r)) { B[i] = r[0] || 0; B[i + 1] = r[1] || 0; B[i + 2] = r[2] || 0; }
      else { B[i] = r; B[i + 1] = g || 0; B[i + 2] = b || 0; }
      B[i + 3] = 255;
    },
    setValue(x, y, v) {
      const xi = x | 0, yi = y | 0;
      if (xi < 0 || xi >= __W || yi < 0 || yi >= __H) return;
      v = Number.isFinite(v) ? (v < 0 ? 0 : v > 1 ? 1 : v) : 0;
      const i = (yi * __W + xi) * 4, B = L.buf, T = L.lut;
      if (T) {
        const li = Math.round(v * 255) * 4;
        B[i] = T[li]; B[i + 1] = T[li + 1]; B[i + 2] = T[li + 2]; B[i + 3] = T[li + 3];
      } else {
        const byte = Math.round(v * 255);
        B[i] = byte; B[i + 1] = byte; B[i + 2] = byte; B[i + 3] = 255;
      }
    },
  };
}

// ── code layer: rolllll ──
(function () {
  // Shadow the wrapper's own exports: a layer that defines no setup/update
  // must yield undefined here, not capture the OUTER setup (infinite loop).
  var setup, update, draw;





// Knob 1 (LeafCount): how many maple leaves drift on screen (3..8, whole steps)
// Knob 2 (PaletteShift): rotates each leaf's assigned color band (mustard/orange/olive/rust)
// Knob 3 (WindDir): directional bias pushing leaves left/right as they fall (also nudges the clouds)
// Knob 4 (FallSpeed): overall falling speed, also scales the tumble/flutter rate

// Peach-sky background with soft drifting clouds behind the leaves, and a
// warm illustrated leaf palette (mustard, burnt orange, olive, rust) instead
// of a black backdrop — the low end of the @ramp (0 .. 0.18) is reserved for
// sky/cloud tones and is never touched by the leaves.
var SKY_VAL = 0.0;
var CLOUD_PEAK = 0.1;

// Classic 5-lobed maple-leaf silhouette (the 🍁 emoji shape: one point up,
// two notched upper side lobes, two diverging lower lobes, short stem below)
// as a fixed point list, rotated/translated per leaf so the outline stays
// crisp instead of a blob. Generated from a 5-fold radial lobe function and
// hand-verified via ASCII preview, then a short stem appended below. Each
// base cell is expanded into a 2x2 sub-point cluster so the silhouette
// still reads as a solid fill (not scattered dots) after rotation.
var LEAF_ROWS = [
  ".........#.........",
  ".........#.........",
  ".........#.........",
  ".........#.........",
  ".........#.........",
  "..####...#...####..",
  "...#####.#.#####...",
  ".......#####.......",
  "........###........",
  ".......##.##.......",
  ".......#...#.......",
  "......##...##......",
  ".....##.....##.....",
  ".....##.....##.....",
  "....##.......##....",
  ".........#.........",
  ".........#........."
];
var LEAF_H = LEAF_ROWS.length;
var LEAF_W = LEAF_ROWS[0].length;
var LEAF_CX = (LEAF_W - 1) / 2;
var LEAF_CY = (LEAF_H - 1) / 2;

// The 5 lobe-tip directions (image-space angle, radians) used to draw a
// faint darker vein from the leaf's center out to each point, matching the
// branching veins visible in the reference illustration.
var VEIN_ANGLES = [-Math.PI / 2, -Math.PI * 0.9, Math.PI * 0.7, Math.PI * 0.3, -Math.PI * 0.1];

function buildLeafPoints() {
  var pts = [];
  for (var ry = 0; ry < LEAF_H; ry++) {
    var row = LEAF_ROWS[ry];
    for (var rx = 0; rx < LEAF_W; rx++) {
      if (row.charAt(rx) === '#') {
        var baseX = rx - LEAF_CX;
        var baseY = ry - LEAF_CY;
        // 2x2 supersample so the point cloud stays dense after rotation
        pts.push([baseX - 0.25, baseY - 0.25]);
        pts.push([baseX + 0.25, baseY - 0.25]);
        pts.push([baseX - 0.25, baseY + 0.25]);
        pts.push([baseX + 0.25, baseY + 0.25]);
      }
    }
  }
  return pts;
}
var LEAF_POINTS = buildLeafPoints();

// Four illustrated maple-color bands: mustard, burnt orange, olive green,
// rust red — each leaf picks one band (rotated by PaletteShift) and shades
// per-pixel by distance-from-center and proximity to a vein line so the
// silhouette reads with real illustrated shading, not a flat fill.
var bandStops = [0.38, 0.52, 0.66, 0.82];
var BAND_COUNT = bandStops.length;

function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

function angleDiff(a, b) {
  var d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

function setup(params) {
  params.tReal = 0;
  params.leafCount = 5;
  params.paletteShift = 0;
  params.windDir = 0.0;
  params.fallSpeed = 1.0;
}

function update(dt, input, params) {
  if (input && input.knobValues) {
    var v = input.knobValues;
    params.leafCount = Math.max(1, Math.min(8, Math.floor(v[0])));
    params.paletteShift = Math.floor(v[1]);
    params.windDir = v[2];
    params.fallSpeed = v[3];
  }
  params.tReal += dt * Math.max(0.05, params.fallSpeed);
}

function draw(display, params, time) {
  var w = display.width;
  var h = display.height;
  var t = params.tReal;
  var leafCount = params.leafCount;
  var paletteShift = params.paletteShift;
  var windDir = params.windDir;

  var phi = 1.618033;
  var e = 2.718281;
  var pi = 3.141592;

  // 1. Sky base fill.
  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      display.setValue(x, y, SKY_VAL);
    }
  }

  // 2. Soft drifting clouds, painted behind the leaves. Each cloud is a
  // cluster of overlapping soft-edged blobs so it reads as one puffy shape,
  // drifting slowly sideways (a little pushed by WindDir) and wrapping
  // around the screen width. Height bands are staggered so clouds pass at
  // different depths through the falling leaves.
  var cloudCount = 4;
  var cloudSpeed = 2.2 + windDir * 0.5;
  for (var c = 0; c < cloudCount; c++) {
    var cSeed = c * 91.7;
    var cyFrac = 0.10 + (c * 0.24) % 0.85;
    var cy = cyFrac * h;
    var cDrift = (t * (cloudSpeed * (0.6 + (c % 3) * 0.25)) + cSeed) % (w + 40) - 20;
    var lobes = [
      [0.0, 0.0, 9.0, 3.4],
      [-6.0, 1.0, 5.5, 2.6],
      [6.5, 1.2, 6.0, 2.7],
      [1.5, -1.4, 4.5, 2.2]
    ];
    var minLX = cDrift - 14, maxLX = cDrift + 14;
    var minLY = cy - 6, maxLY = cy + 6;
    var xStart = Math.max(0, Math.floor(minLX));
    var xEnd = Math.min(w - 1, Math.ceil(maxLX));
    var yStart = Math.max(0, Math.floor(minLY));
    var yEnd = Math.min(h - 1, Math.ceil(maxLY));
    for (var py = yStart; py <= yEnd; py++) {
      for (var px = xStart; px <= xEnd; px++) {
        var best = 0.0;
        for (var li = 0; li < lobes.length; li++) {
          var lob = lobes[li];
          var ldx = (px - (cDrift + lob[0])) / lob[2];
          var ldy = (py - (cy + lob[1])) / lob[3];
          var dsq = ldx * ldx + ldy * ldy;
          var a = clamp01(1.0 - dsq);
          if (a > best) best = a;
        }
        if (best > 0.0) {
          var alpha = Math.pow(best, 1.6);
          var cloudVal = SKY_VAL + (CLOUD_PEAK - SKY_VAL) * alpha;
          if (cloudVal > SKY_VAL) display.setValue(px, py, cloudVal);
        }
      }
    }
  }

  function addPixel(px, py, colorVal) {
    var ix = Math.floor(px);
    var iy = Math.floor(py);
    if (ix >= 0 && ix < w && iy >= 0 && iy < h) {
      display.setValue(ix, iy, clamp01(colorVal));
    }
  }

  // 3. Falling, tumbling maple leaves on top of the sky/clouds.
  for (var i = 0; i < leafCount; i++) {
    var phase = i * 53.7;
    var fallRate = 8.0 + (i % 3) * 3.5;
    var cycleLen = h + 24.0;
    var py0 = (t * fallRate + phase) % cycleLen - 12.0;
    var normY = clamp01(py0 / h);

    var baseX = ((i + 0.5) / leafCount) * w + Math.sin(i * 4.3) * (w * 0.12);

    // per-leaf Fourier wind sway, matching the willow reference's
    // multi-harmonic bough motion
    var lag = normY * 1.6;
    var bPhase = i * 0.5;
    var h1 = Math.sin(t * 0.9 - lag + bPhase) * 3.6;
    var h2 = Math.sin(t * 0.9 * phi - lag * 1.4 + bPhase * 0.7) * 2.2;
    var h3 = Math.sin(t * 0.9 * e - lag * 2.1 + bPhase * 0.3) * 1.2;
    var h4 = Math.sin(t * 0.9 * pi - lag * 2.8) * 0.5;
    var flutterX = (h1 + h2 + h3 + h4);
    var windDrift = windDir * 9.0 * (0.3 + normY * 0.9);

    var px0 = (baseX + flutterX + windDrift + w * 6.0) % w;

    // tumbling rotation as it falls, rate varies per leaf so they don't
    // spin in lockstep
    var tumbleFreq = 0.5 + (i % 3) * 0.2;
    var tumbleAngle = Math.sin(t * tumbleFreq + i * 1.7) *
                       (0.9 + 0.25 * Math.sin(t * 0.25 + i));
    var ca = Math.cos(tumbleAngle), sa = Math.sin(tumbleAngle);

    var bandIdx = ((i + paletteShift) % BAND_COUNT + BAND_COUNT) % BAND_COUNT;
    var bandAnchor = bandStops[bandIdx];

    for (var p = 0; p < LEAF_POINTS.length; p++) {
      var dx = LEAF_POINTS[p][0];
      var dy = LEAF_POINTS[p][1];
      var rx = dx * ca - dy * sa;
      var ry = dx * sa + dy * ca;

      // radial shading: brighter near the tips, slightly dimmer near center
      var rr = Math.sqrt(dx * dx + dy * dy) / (LEAF_H * 0.6);
      var radialShade = (1.0 - rr) * 0.06;

      // vein shading: a faint darker streak running from the center out to
      // each of the 5 lobe tips, like the branching veins in the reference
      var pAngle = Math.atan2(dy, dx);
      var nearestVein = Math.PI;
      for (var vi = 0; vi < VEIN_ANGLES.length; vi++) {
        var ad = angleDiff(pAngle, VEIN_ANGLES[vi]);
        if (ad < nearestVein) nearestVein = ad;
      }
      var veinFactor = Math.pow(clamp01(1.0 - nearestVein * 4.0), 3.0);
      var veinShade = veinFactor * 0.05 * clamp01(rr * 1.4);

      var colorVal = clamp01(bandAnchor - radialShade - veinShade);

      addPixel(px0 + rx, py0 + ry, colorVal);
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
  __stack.push({
    kind: "code", opacity: 1, blend: "normal", recolor: false, role: "paint", maskInvert: false,
    lut: [255,255,255,255,1,1,1,255,2,2,2,255,3,3,3,255,4,4,4,255,5,5,5,255,6,6,6,255,7,7,7,255,8,8,8,255,9,9,9,255,10,10,10,255,11,11,11,255,12,12,12,255,13,13,13,255,14,14,14,255,15,15,15,255,16,16,16,255,17,17,17,255,18,18,18,255,19,19,19,255,20,20,20,255,21,21,21,255,22,22,22,255,23,23,23,255,24,24,24,255,25,25,25,255,26,26,26,255,27,27,27,255,28,28,28,255,29,29,29,255,30,30,30,255,31,31,31,255,32,32,32,255,33,33,33,255,34,34,34,255,35,35,35,255,36,36,36,255,37,37,37,255,38,38,38,255,39,39,39,255,40,40,40,255,41,41,41,255,42,42,42,255,43,43,43,255,44,44,44,255,45,45,45,255,46,46,46,255,47,47,47,255,48,48,48,255,49,49,49,255,50,50,50,255,51,51,51,255,52,52,52,255,53,53,53,255,54,54,54,255,55,55,55,255,56,56,56,255,57,57,57,255,58,58,58,255,59,59,59,255,60,60,60,255,61,61,61,255,62,62,62,255,63,63,63,255,64,64,64,255,65,65,65,255,66,66,66,255,67,67,67,255,68,68,68,255,69,69,69,255,70,70,70,255,71,71,71,255,72,72,72,255,73,73,73,255,74,74,74,255,75,75,75,255,76,76,76,255,77,77,77,255,78,78,78,255,79,79,79,255,80,80,80,255,81,81,81,255,82,82,82,255,83,83,83,255,84,84,84,255,85,85,85,255,86,86,86,255,87,87,87,255,88,88,88,255,89,89,89,255,90,90,90,255,91,91,91,255,92,92,92,255,93,93,93,255,94,94,94,255,95,95,95,255,96,96,96,255,97,97,97,255,98,98,98,255,99,99,99,255,100,100,100,255,101,101,101,255,102,102,102,255,103,103,103,255,104,104,104,255,105,105,105,255,106,106,106,255,107,107,107,255,108,108,108,255,109,109,109,255,110,110,110,255,111,111,111,255,112,112,112,255,113,113,113,255,114,114,114,255,115,115,115,255,116,116,116,255,117,117,117,255,118,118,118,255,119,119,119,255,120,120,120,255,121,121,121,255,122,122,122,255,123,123,123,255,124,124,124,255,125,125,125,255,126,126,126,255,127,127,127,255,128,128,128,255,129,129,129,255,130,130,130,255,131,131,131,255,132,132,132,255,133,133,133,255,134,134,134,255,135,135,135,255,136,136,136,255,137,137,137,255,138,138,138,255,139,139,139,255,140,140,140,255,141,141,141,255,142,142,142,255,143,143,143,255,144,144,144,255,145,145,145,255,146,146,146,255,147,147,147,255,148,148,148,255,149,149,149,255,150,150,150,255,151,151,151,255,152,152,152,255,153,153,153,255,154,154,154,255,155,155,155,255,156,156,156,255,157,157,157,255,158,158,158,255,159,159,159,255,160,160,160,255,161,161,161,255,162,162,162,255,163,163,163,255,164,164,164,255,165,165,165,255,166,166,166,255,167,167,167,255,168,168,168,255,169,169,169,255,170,170,170,255,171,171,171,255,172,172,172,255,173,173,173,255,174,174,174,255,175,175,175,255,176,176,176,255,177,177,177,255,178,178,178,255,179,179,179,255,180,180,180,255,181,181,181,255,182,182,182,255,183,183,183,255,184,184,184,255,185,185,185,255,186,186,186,255,187,187,187,255,188,188,188,255,189,189,189,255,190,190,190,255,191,191,191,255,192,192,192,255,193,193,193,255,194,194,194,255,195,195,195,255,196,196,196,255,197,197,197,255,198,198,198,255,199,199,199,255,200,200,200,255,201,201,201,255,202,202,202,255,203,203,203,255,204,204,204,255,205,205,205,255,206,206,206,255,207,207,207,255,208,208,208,255,209,209,209,255,210,210,210,255,211,211,211,255,212,212,212,255,213,213,213,255,214,214,214,255,215,215,215,255,216,216,216,255,217,217,217,255,218,218,218,255,219,219,219,255,220,220,220,255,221,221,221,255,222,222,222,255,223,223,223,255,224,224,224,255,225,225,225,255,226,226,226,255,227,227,227,255,228,228,228,255,229,229,229,255,230,230,230,255,231,231,231,255,232,232,232,255,233,233,233,255,234,234,234,255,235,235,235,255,236,236,236,255,237,237,237,255,238,238,238,255,239,239,239,255,240,240,240,255,241,241,241,255,242,242,242,255,243,243,243,255,244,244,244,255,245,245,245,255,246,246,246,255,247,247,247,255,248,248,248,255,249,249,249,255,250,250,250,255,251,251,251,255,252,252,252,255,253,253,253,255,254,254,254,255,255,255,255,255],
    buf: new Uint8ClampedArray(__W * __H * 4),
    params: {},
    fSetup: typeof setup === "function" ? setup : null,
    fUpdate: typeof update === "function" ? update : null,
    fDraw: typeof draw === "function" ? draw : null,
  });
})();

// ── pixel layer: Pixel 1 ──
__stack.push({
  kind: "pixel", opacity: 1, blend: "normal", role: "paint", maskInvert: false,
  buf: __rle("/wAAAAD/AAAAAP8AAAAA/wAAAAD/AAAAAP8AAAAA/wAAAAD/AAAAAP8AAAAA/wAAAAD/AAAAAP8AAAAA/wAAAAD/AAAAAP8AAAAA/wAAAAD/AAAAAP8AAAAA/wAAAAD/AAAAAP8AAAAA/wAAAAD/AAAAAP8AAAAA/wAAAAD/AAAAAP8AAAAA/wAAAAD/AAAAAP8AAAAA/wAAAAD/AAAAAA==", __W * __H * 4),
});

// ── code layer: Code 1 ──
(function () {
  // Shadow the wrapper's own exports: a layer that defines no setup/update
  // must yield undefined here, not capture the OUTER setup (infinite loop).
  var setup, update, draw;



// Pattern: Chuseok Moon Shadow

const TAU = Math.PI * 2;

const INK      = [0, 0, 0];
const NIGHT    = [7, 7, 6];
const DEEP     = [13, 12, 9];
const SHADOW   = [38, 30, 18];
const OLIVE    = [74, 67, 38];
const BRONZE   = [118, 88, 42];
const GOLD     = [196, 143, 58];
const PALEGOLD = [232, 190, 105];
const IVORY    = [246, 226, 169];
const MOON     = [255, 236, 184];
const PAPER    = [218, 186, 116];
const WATER    = [18, 17, 13];

const clamp = (x,a,b) => Math.max(a, Math.min(b,x));
const mix = (a,b,t) => a + (b-a)*t;
const fract = x => x - Math.floor(x);

function hash(n) {
  return fract(
    Math.sin(n*127.1 + 311.7) *
    43758.5453
  );
}

function rgbMix(a,b,t) {
  return [
    Math.round(mix(a[0],b[0],t)),
    Math.round(mix(a[1],b[1],t)),
    Math.round(mix(a[2],b[2],t))
  ];
}


// =====================================================
// SETUP
// =====================================================

function setup(p) {

  p.t = 0;

  p.zoom = 1;

  // 0 = very thin crescent
  // 1 = full moon
  p.moonFlow = 1.0;

  p.wind = 0.0;
  p.light = 0.72;

  p.auto = true;
  p.zoomHome = false;

  p.gust = 0;
  p.moonPulse = 0;

  p.flow = 0;
  p.drift = 0;
  p.moonDrift = 0;

  p.last = null;

  p.petals =
    Array.from(
      {length:13},
      (_,i) => ({
        x:
          hash(i*11+2) *
          78 - 7,

        y:
          hash(i*11+7) *
          112 + 5,

        speed:
          1.4 +
          hash(i*11+5) *
          2.2,

        wobble:
          hash(i*11+9) *
          TAU,

        size:
          i%4===0
            ? 1.0
            : .65
      })
    );
}


// =====================================================
// UPDATE
// =====================================================

function update(dt,input,p) {

  dt =
    clamp(
      Number.isFinite(dt)
        ? dt
        : 0,
      0,
      .05
    );

  const v =
    input &&
    input.knobValues;

  const pressed =
    input &&
    input.btnPressed;

  // -------------------------
  // KNOBS
  // -------------------------

  if(v) {

    p.last =
      v.slice(0,4);

    const ease =
      1 -
      Math.exp(-dt*6);

    // KNOB 1
    // Zoom

    p.zoom =
      mix(
        p.zoom,

        p.zoomHome
          ? 1
          : clamp(
              v[0],
              1,
              3.5
            ),

        ease
      );

    // KNOB 2
    // Moon Phase
    //
    // 0 = very thin crescent
    // 0.5 = half moon
    // 1 = full moon

    p.moonFlow =
      mix(
        p.moonFlow,
        clamp(
          v[1],
          0,
          1
        ),
        ease
      );

    // KNOB 3
    // Wind
    //
    // center = calm
    // extremes = dramatic strong wind

    const rawWind =
      clamp(
        v[2],
        -10,
        10
      );

    const windSign =
      rawWind < 0
        ? -1
        : 1;

    const windNorm =
      Math.abs(rawWind) /
      10;

    const dramaticWind =
      windSign *
      Math.pow(
        windNorm,
        1.45
      ) *
      10;

    p.wind =
      mix(
        p.wind,
        dramaticWind,
        ease
      );

    // KNOB 4
    // Light
    //
    // low = much darker
    // high = dramatically bright

    const rawLight =
      clamp(
        v[3],
        0,
        1
      );

    const dramaticLight =
      Math.pow(
        rawLight,
        1.65
      );

    p.light =
      mix(
        p.light,
        dramaticLight,
        ease
      );
  }

  // -------------------------
  // BUTTONS
  // -------------------------

  if(pressed) {

    // button 1
    // zoom reset
    if(pressed[0])
      p.zoomHome = true;

    // button 2
    // animation pause / resume
    if(pressed[1])
      p.auto = !p.auto;

    // button 3
    // sudden strong wind
    if(pressed[2])
      p.gust = 4.6;

    // button 4
    // moonlight pulse
    if(pressed[3])
      p.moonPulse = 4.0;
  }

  p.t += dt;

  // -------------------------
  // WIND
  // -------------------------

  p.gust =
    Math.max(
      0,
      p.gust-dt
    );

  p.moonPulse =
    Math.max(
      0,
      p.moonPulse-dt
    );

  const gustWave =
    Math.sin(
      clamp(
        p.gust/4.6,
        0,
        1
      ) *
      Math.PI
    );

  p.flow =
    p.wind *
    1.28 +

    (
      p.wind < 0
        ? -1
        : 1
    ) *

    gustWave *
    4.2;

  p.drift +=
    dt *
    p.flow;

  // -------------------------
  // AMBIENT FLOW
  //
  // MoonFlow now controls
  // moon phase only.
  // -------------------------

  if(p.auto) {
    p.moonDrift +=
      dt *
      .42;
  }

  // -------------------------
  // FALLING PETALS / LEAVES
  // -------------------------

  if(p.petals) {

    for(
      let i=0;
      i<p.petals.length;
      i++
    ) {

      const q =
        p.petals[i];

      q.x +=
        (
          q.speed +
          p.flow*1.15
        ) *
        dt;

      q.y +=
        (
          .18 +
          Math.abs(p.flow)*
          .09
        ) *
        dt;

      if(q.x > 76)
        q.x = -10;

      if(q.x < -11)
        q.x = 75;

      if(q.y > 128)
        q.y = 5;
    }
  }
}


// =====================================================
// PIXEL DRAW HELPERS
// =====================================================

function projection(
  p,
  x,
  y,
  depth=1
) {
  const z =
    1 +
    (p.zoom-1) *
    depth;

  const cy =
    64 +
    (p.cameraY-64) *
    depth;

  return [
    (
      32 +
      (x-32)*z
    ) *
    p.sx,

    (
      64 +
      (y-cy)*z
    ) *
    p.sy
  ];
}


function pixel(
  p,
  x,
  y,
  c
) {
  x =
    Math.floor(x);

  y =
    Math.floor(y);

  if(
    x<0 ||
    y<0 ||
    x>=p.w ||
    y>=p.h
  )
    return;

  const i =
    (
      y*p.w+x
    ) *
    3;

  p.rgb[i] =
    c[0];

  p.rgb[i+1] =
    c[1];

  p.rgb[i+2] =
    c[2];
}


function rect(
  p,
  x,
  y,
  w,
  h,
  c,
  depth=1
) {
  const a =
    projection(
      p,
      x,
      y,
      depth
    );

  const b =
    projection(
      p,
      x+w,
      y+h,
      depth
    );

  const x0 =
    Math.max(
      0,
      Math.round(a[0])
    );

  const x1 =
    Math.min(
      p.w,
      Math.round(b[0])
    );

  const y0 =
    Math.max(
      0,
      Math.round(a[1])
    );

  const y1 =
    Math.min(
      p.h,
      Math.round(b[1])
    );

  for(
    let yy=y0;
    yy<y1;
    yy++
  ) {
    for(
      let xx=x0;
      xx<x1;
      xx++
    ) {
      pixel(
        p,
        xx,
        yy,
        c
      );
    }
  }
}


function poly(
  p,
  points,
  c,
  depth=1
) {
  const pts =
    points.map(
      a =>
        projection(
          p,
          a[0],
          a[1],
          depth
        )
    );

  const ymin =
    Math.max(
      0,
      Math.floor(
        Math.min(
          ...pts.map(
            a=>a[1]
          )
        )
      )
    );

  const ymax =
    Math.min(
      p.h,
      Math.ceil(
        Math.max(
          ...pts.map(
            a=>a[1]
          )
        )
      )
    );

  for(
    let y=ymin;
    y<ymax;
    y++
  ) {
    const hits = [];
    const cy =
      y+.5;

    for(
      let i=0,
      j=pts.length-1;
      i<pts.length;
      j=i++
    ) {
      const a =
        pts[i];
      const b =
        pts[j];

      if(
        (a[1]>cy) !==
        (b[1]>cy)
      ) {
        hits.push(
          a[0] +
          (
            cy-a[1]
          ) *
          (
            b[0]-a[0]
          ) /
          (
            b[1]-a[1]
          )
        );
      }
    }

    hits.sort(
      (a,b)=>a-b
    );

    for(
      let i=0;
      i+1<hits.length;
      i+=2
    ) {
      for(
        let x=
          Math.max(
            0,
            Math.ceil(
              hits[i]-.5
            )
          );

        x<
          Math.min(
            p.w,
            hits[i+1]-.5
          );

        x++
      ) {
        pixel(
          p,
          x,
          y,
          c
        );
      }
    }
  }
}


function stroke(
  p,
  x1,
  y1,
  x2,
  y2,
  c,
  width=.55,
  depth=1
) {
  const a =
    projection(
      p,
      x1,
      y1,
      depth
    );

  const b =
    projection(
      p,
      x2,
      y2,
      depth
    );

  const size =
    Math.max(
      1,
      Math.round(
        width *
        (
          1+
          (p.zoom-1)*
          depth
        ) *
        Math.min(
          p.sx,
          p.sy
        )
      )
    );

  const n =
    Math.max(
      1,
      Math.ceil(
        Math.hypot(
          b[0]-a[0],
          b[1]-a[1]
        )
      )
    );

  for(
    let i=0;
    i<=n;
    i++
  ) {
    const x =
      Math.round(
        mix(
          a[0],
          b[0],
          i/n
        )
      );

    const y =
      Math.round(
        mix(
          a[1],
          b[1],
          i/n
        )
      );

    for(
      let dy=0;
      dy<size;
      dy++
    ) {
      for(
        let dx=0;
        dx<size;
        dx++
      ) {
        pixel(
          p,
          x+
          dx-
          (size>>1),
          y+
          dy-
          (size>>1),
          c
        );
      }
    }
  }
}


function ellipse(
  p,
  x,
  y,
  rx,
  ry,
  c,
  depth=1
) {
  const a =
    projection(
      p,
      x,
      y,
      depth
    );

  const z =
    1 +
    (p.zoom-1) *
    depth;

  rx *=
    z*p.sx;

  ry *=
    z*p.sy;

  for(
    let yy=
      Math.max(
        0,
        Math.ceil(
          a[1]-ry
        )
      );

    yy<=
      Math.min(
        p.h-1,
        Math.floor(
          a[1]+ry
        )
      );

    yy++
  ) {
    const v =
      (
        yy-a[1]
      ) /
      ry;

    if(
      Math.abs(v)>1
    )
      continue;

    const span =
      rx *
      Math.sqrt(
        1-v*v
      );

    for(
      let xx=
        Math.max(
          0,
          Math.ceil(
            a[0]-span
          )
        );

      xx<=
        Math.min(
          p.w-1,
          Math.floor(
            a[0]+span
          )
        );

      xx++
    ) {
      pixel(
        p,
        xx,
        yy,
        c
      );
    }
  }
}


function curve(
  p,
  x0,
  y0,
  cx,
  cy,
  x1,
  y1,
  c,
  width=.45,
  depth=1,
  steps=22
) {
  let px=x0;
  let py=y0;

  for(
    let i=1;
    i<=steps;
    i++
  ) {
    const t=
      i/steps;

    const u=
      1-t;

    const x =
      u*u*x0 +
      2*u*t*cx +
      t*t*x1;

    const y =
      u*u*y0 +
      2*u*t*cy +
      t*t*y1;

    stroke(
      p,
      px,
      py,
      x,
      y,
      c,
      width,
      depth
    );

    px=x;
    py=y;
  }
}


function glowEllipse(
  p,
  x,
  y,
  rx,
  ry,
  c,
  depth=.2,
  strength=1
) {
  const layers =
    [
      1.65,
      1.42,
      1.22,
      1.08
    ];

  const alphas =
    [
      .08,
      .12,
      .18,
      .32
    ];

  for(
    let li=0;
    li<layers.length;
    li++
  ) {
    const s =
      layers[li];

    const a =
      alphas[li] *
      strength;

    const cc =
      rgbMix(
        INK,
        c,
        a
      );

    ellipse(
      p,
      x,
      y,
      rx*s,
      ry*s,
      cc,
      depth
    );
  }

  ellipse(
    p,
    x,
    y,
    rx,
    ry,
    c,
    depth
  );
}


// =====================================================
// SKY
// =====================================================

function star(
  p,
  x,
  y,
  big=false
) {
  const c =
    big
      ? PALEGOLD
      : rgbMix(
          SHADOW,
          PALEGOLD,
          .55
        );

  rect(
    p,
    x,
    y,
    .7,
    .7,
    c,
    .12
  );

  if(big) {
    stroke(
      p,
      x-1.1,
      y+.35,
      x+1.8,
      y+.35,
      c,
      .3,
      .12
    );

    stroke(
      p,
      x+.35,
      y-1.1,
      x+.35,
      y+1.8,
      c,
      .3,
      .12
    );
  }
}


function cloud(
  p,
  x,
  y,
  s,
  depth=.25
) {
  const c1 =
    [24,21,15];

  const c2 =
    [42,34,21];

  const pts =
    [
      [-18,1],
      [-14,0],
      [-11,-2],
      [-8,-1],
      [-6,-4],
      [-2,-3],
      [1,-5],
      [4,-2],
      [8,-2],
      [11,0],
      [17,1],
      [12,3],
      [7,4],
      [2,3],
      [-4,5],
      [-10,4],
      [-14,2]
    ];

  poly(
    p,
    pts.map(
      ([a,b])=>[
        x+a*s,
        y+b*s
      ]
    ),
    c1,
    depth
  );

  for(
    let i=1;
    i<pts.length-3;
    i+=3
  ) {
    stroke(
      p,
      x+
      pts[i-1][0]*s,
      y+
      pts[i-1][1]*s,
      x+
      pts[i][0]*s,
      y+
      pts[i][1]*s,
      c2,
      .28,
      depth
    );
  }
}


// =====================================================
// MOON
// MoonFlow:
// 0 = yellow thin crescent
// 1 = full moon
// =====================================================

function moon(p) {

  const pulse =
    p.moonPulse>0
      ? Math.sin(
          (
            p.moonPulse/
            4
          ) *
          Math.PI
        )
      : 0;

  const light =
    Math.pow(
      clamp(
        p.light +
        pulse*.38,
        0,
        1
      ),
      1.35
    );

  const phase =
    clamp(
      p.moonFlow,
      0,
      1
    );

  const x = 15.2;
  const y = 20.5;
  const r = 10.4;
  const depth = .18;

  const a =
    projection(
      p,
      x,
      y,
      depth
    );

  const z =
    1 +
    (p.zoom-1) *
    depth;

  const rx =
    r *
    z *
    p.sx;

  const ry =
    r *
    z *
    p.sy;

  // 0 = very thin crescent
  // 1 = full moon
  const shapedPhase =
    Math.pow(
      phase,
      1.08
    );

  const shadowOffset =
    mix(
      .35,
      r*2.08,
      shapedPhase
    );

  const shadowR =
    r*1.015;

  const moonBody =
    rgbMix(
      [10,9,7],
      MOON,
      .03 +
      light*.97
    );

  const craterDefs =
    [
      [-4.8,-4.0,2.6,1.8,.55],
      [-1.2,-5.1,1.9,1.4,.35],
      [3.0,-4.2,2.1,1.7,.38],

      [-4.0,.2,2.2,1.5,.28],
      [0.8,-0.8,3.1,2.2,.42],
      [4.6,0.3,1.7,1.2,.46],

      [-3.2,4.1,2.6,1.7,.36],
      [1.9,4.2,1.5,1.2,.50],
      [4.7,4.5,1.1,0.9,.38]
    ];

  // -------------------------
  // draw only illuminated moon area
  // so it reads as crescent -> full
  // and not like an eclipse
  // -------------------------

  const minX =
    Math.max(
      0,
      Math.floor(a[0]-rx-3)
    );

  const maxX =
    Math.min(
      p.w-1,
      Math.ceil(a[0]+rx+3)
    );

  const minY =
    Math.max(
      0,
      Math.floor(a[1]-ry-3)
    );

  const maxY =
    Math.min(
      p.h-1,
      Math.ceil(a[1]+ry+3)
    );

  for(
    let yy=minY;
    yy<=maxY;
    yy++
  ) {
    for(
      let xx=minX;
      xx<=maxX;
      xx++
    ) {
      const lx =
        (
          (xx+.5)-a[0]
        ) /
        (
          z*p.sx
        );

      const ly =
        (
          (yy+.5)-a[1]
        ) /
        (
          z*p.sy
        );

      const moonD =
        lx*lx +
        ly*ly;

      if(
        moonD >
        r*r
      )
        continue;

      const inShadow =
        phase < .995 &&
        (
          (lx+shadowOffset) *
          (lx+shadowOffset) +
          ly*ly
        ) <
        shadowR*shadowR;

      if(inShadow)
        continue;

      let col =
        moonBody;

      // crater shading
      for(
        let i=0;
        i<craterDefs.length;
        i++
      ) {
        const [
          dx,
          dy,
          crx,
          cry,
          strength
        ] =
          craterDefs[i];

        const cv =
          (
            (lx-dx)*(lx-dx)
          ) /
          (crx*crx) +

          (
            (ly-dy)*(ly-dy)
          ) /
          (cry*cry);

        if(cv <= 1) {
          col =
            rgbMix(
              col,
              BRONZE,
              strength*.78
            );

          if(
            i%2===0 &&
            light>.25 &&
            cv < .42
          ) {
            col =
              rgbMix(
                col,
                IVORY,
                .12 +
                light*.22
              );
          }
        }
      }

      // outer rim highlight
      const edgeBand =
        moonD /
        (r*r);

      if(edgeBand > .84) {
        col =
          rgbMix(
            col,
            IVORY,
            .12 +
            light*.42
          );
      }

      // slight highlight along crescent inner edge
      const shadowEdgeDist =
        Math.abs(
          (
            (lx+shadowOffset) *
            (lx+shadowOffset) +
            ly*ly
          ) -
          shadowR*shadowR
        );

      if(
        phase < .995 &&
        shadowEdgeDist <
        1.15
      ) {
        col =
          rgbMix(
            col,
            IVORY,
            .08 +
            light*.20
          );
      }

      pixel(
        p,
        xx,
        yy,
        col
      );
    }
  }

  // -------------------------
  // bright pixel rim on visible side
  // -------------------------

  const rimBrightness =
    .18 +
    light*.82;

  for(
    let i=0;
    i<28;
    i++
  ) {
    const ang =
      i*TAU/28;

    const px =
      Math.cos(ang);

    const visibleThreshold =
      mix(
        .93,
        -1.05,
        phase
      );

    if(
      px <
      visibleThreshold
    )
      continue;

    const jitter =
      (
        hash(i+60)-.5
      ) *
      .6;

    rect(
      p,
      x+
      Math.cos(ang)*
      (r+jitter)-.3,
      y+
      Math.sin(ang)*
      (r+jitter)-.3,
      .6,
      .6,
      rgbMix(
        GOLD,
        IVORY,
        rimBrightness
      ),
      .182
    );
  }

  // -------------------------
  // subtle glow only on lit side
  // -------------------------

  for(
    let i=0;
    i<22;
    i++
  ) {
    const ang =
      i*TAU/22;

    const px =
      Math.cos(ang);

    const visibleThreshold =
      mix(
        .90,
        -0.95,
        phase
      );

    if(
      px <
      visibleThreshold
    )
      continue;

    rect(
      p,
      x+
      Math.cos(ang)*
      (r+1.2)-.3,
      y+
      Math.sin(ang)*
      (r+1.2)-.3,
      .55,
      .55,
      rgbMix(
        NIGHT,
        PALEGOLD,
        .18 +
        light*.22
      ),
      .181
    );
  }
}


// =====================================================
// WINDOW SHADOW
// =====================================================

function windowGlow(p) {

  const x0=27.5;
  const y0=37;

  const x1=62;
  const y1=84;

  const s=5.6;

  const shape =
    [
      [x0+s,y0],
      [x1-s,y0],
      [x1,y0+s],
      [x1,y1-s],
      [x1-s,y1],
      [x0+s,y1],
      [x0,y1-s],
      [x0,y0+s]
    ];

  const pulse =
    p.moonPulse>0
      ? Math.sin(
          (
            p.moonPulse/
            4
          ) *
          Math.PI
        )
      : 0;

  const light =
    Math.pow(
      clamp(
        p.light +
        pulse*.38,
        0,
        1
      ),
      1.7
    );

  poly(
    p,
    shape,
    rgbMix(
      SHADOW,
      PAPER,
      .03 +
      .94*light
    ),
    .42
  );

  // soft pixel edge

  for(
    let i=0;
    i<40;
    i++
  ) {
    const side =
      i%4;

    let x;
    let y;

    if(side===0) {
      x =
        mix(
          x0+5,
          x1-5,
          hash(i*3+1)
        );
      y =
        y0 +
        hash(i*3+2)*3;
    }

    if(side===1) {
      x =
        x1 -
        hash(i*3+1)*3;
      y =
        mix(
          y0+5,
          y1-5,
          hash(i*3+2)
        );
    }

    if(side===2) {
      x =
        mix(
          x0+5,
          x1-5,
          hash(i*3+1)
        );
      y =
        y1 -
        hash(i*3+2)*3;
    }

    if(side===3) {
      x =
        x0 +
        hash(i*3+1)*3;
      y =
        mix(
          y0+5,
          y1-5,
          hash(i*3+2)
        );
    }

    rect(
      p,
      x,
      y,
      .6,
      .6,
      rgbMix(
        SHADOW,
        PAPER,
        .05 +
        .75*light
      ),
      .42
    );
  }

  const frame =
    rgbMix(
      SHADOW,
      INK,
      .58
    );

  // lattice

  stroke(
    p,
    31,38.5,
    31,82.5,
    frame,
    .65,
    .44
  );

  stroke(
    p,
    36,38.5,
    36,82.5,
    frame,
    .55,
    .44
  );

  stroke(
    p,
    57.8,39.5,
    57.8,82.5,
    frame,
    .55,
    .44
  );

  stroke(
    p,
    27.8,49,
    61.4,49,
    frame,
    .55,
    .44
  );

  stroke(
    p,
    27.8,72,
    61.4,72,
    frame,
    .55,
    .44
  );

  stroke(
    p,
    28.5,43,
    35.5,43,
    frame,
    .5,
    .44
  );

  stroke(
    p,
    31,49,
    31,43,
    frame,
    .5,
    .44
  );

  stroke(
    p,
    28.5,55,
    35.5,55,
    frame,
    .5,
    .44
  );

  stroke(
    p,
    36,49,
    36,55,
    frame,
    .5,
    .44
  );

  stroke(
    p,
    54,44,
    60.8,44,
    frame,
    .45,
    .44
  );

  stroke(
    p,
    57.8,44,
    57.8,50,
    frame,
    .45,
    .44
  );

  stroke(
    p,
    54,66,
    60.8,66,
    frame,
    .45,
    .44
  );

  stroke(
    p,
    57.8,66,
    57.8,72,
    frame,
    .45,
    .44
  );

  // floral window motif

  const fx=31.8;
  const fy=61;

  ellipse(
    p,
    fx,
    fy,
    .8,
    .8,
    frame,
    .45
  );

  for(
    let i=0;
    i<8;
    i++
  ) {
    const ang =
      i*TAU/8;

    ellipse(
      p,
      fx+
      Math.cos(ang)*2,
      fy+
      Math.sin(ang)*2,
      .95,
      .65,
      frame,
      .45
    );
  }

  stroke(
    p,
    fx,
    63.2,
    fx,
    69.3,
    frame,
    .45,
    .45
  );

  curve(
    p,
    fx,66,
    29.8,65.5,
    29.1,64.5,
    frame,
    .4,
    .45
  );

  curve(
    p,
    fx,67.4,
    33.2,66.6,
    34,65.5,
    frame,
    .4,
    .45
  );
}


// =====================================================
// TREE + FLOWERS + BIRD SHADOW
// =====================================================

function branchAndBird(p) {

  const sway =
    Math.sin(
      p.t*.35 +
      p.moonDrift*.04
    ) *
    .42 +

    clamp(
      p.flow,
      -4,
      4
    ) *
    .045;

  const c =
    rgbMix(
      INK,
      SHADOW,
      .22
    );

  curve(
    p,
    61.5,82,
    58.3+sway,66,
    50+sway,52,
    c,
    1.9,
    .47,
    28
  );

  curve(
    p,
    50,52,
    47+sway,45,
    41+sway,43,
    c,
    1.15,
    .47,
    16
  );

  curve(
    p,
    54,60,
    48+sway,57,
    43+sway,55,
    c,
    .75,
    .47,
    15
  );

  curve(
    p,
    58.4,68,
    54+sway,65,
    49+sway,63,
    c,
    .7,
    .47,
    15
  );

  const clusters =
    [
      [41,43],
      [44,45],
      [48,48],
      [43,55],
      [49,55],
      [51,62],
      [54,63],
      [46,64]
    ];

  for(
    let k=0;
    k<clusters.length;
    k++
  ) {
    const [
      cx,
      cy
    ] =
      clusters[k];

    const rr =
      1.6 +
      (k%3)*.15;

    for(
      let i=0;
      i<6;
      i++
    ) {
      const ang =
        i*TAU/6 +
        hash(k)*.7;

      ellipse(
        p,
        cx+
        Math.cos(ang)*rr,
        cy+
        Math.sin(ang)*rr*.72,
        .72,
        .45,
        c,
        .47
      );
    }

    ellipse(
      p,
      cx,
      cy,
      .55,
      .55,
      c,
      .47
    );
  }

  // bird

  const bx =
    44.8 +
    sway*.35;

  const by =
    69.1;

  ellipse(
    p,
    bx,
    by,
    1.9,
    1.35,
    c,
    .49
  );

  ellipse(
    p,
    bx-1.1,
    by-.8,
    .85,
    .75,
    c,
    .49
  );

  poly(
    p,
    [
      [bx-1.85,by-.9],
      [bx-2.8,by-.55],
      [bx-1.9,by-.25]
    ],
    c,
    .49
  );

  poly(
    p,
    [
      [bx+1.1,by+.7],
      [bx+2.8,by+1.6],
      [bx+.8,by+1.3]
    ],
    c,
    .49
  );

  stroke(
    p,
    bx-.5,
    by+1.1,
    bx-.45,
    by+2.2,
    c,
    .35,
    .49
  );

  stroke(
    p,
    bx+.25,
    by+1.05,
    bx+.15,
    by+2.1,
    c,
    .35,
    .49
  );

  stroke(
    p,
    40.2,
    71.1,
    51.3,
    70.5,
    c,
    .7,
    .47
  );
}


// =====================================================
// DISTANT LANDSCAPE
// =====================================================

function distantHills(p) {

  poly(
    p,
    [
      [-5,93],
      [4,88],
      [11,90],
      [18,86],
      [26,91],
      [34,88],
      [42,92],
      [52,89],
      [70,94],
      [70,104],
      [-5,104]
    ],
    DEEP,
    .48
  );

  poly(
    p,
    [
      [-4,97],
      [7,93],
      [14,96],
      [23,92],
      [31,97],
      [40,94],
      [49,97],
      [58,94],
      [68,98],
      [68,105],
      [-4,105]
    ],
    rgbMix(
      DEEP,
      SHADOW,
      .2
    ),
    .52
  );
}


// =====================================================
// WATER + MOON REFLECTION
// =====================================================

function water(p) {

  rect(
    p,
    0,
    96,
    64,
    32,
    WATER,
    .56
  );

  // water ripples

  for(
    let i=0;
    i<52;
    i++
  ) {
    const y =
      98 +
      i*.55;

    const drift =
      Math.sin(
        y*.8 +
        p.moonDrift*.55 +
        i
      ) *
      (
        .7 +
        Math.abs(p.flow)*
        .03
      );

    const x0 =
      2 +
      hash(i*7)*45 +
      drift;

    const len =
      3 +
      hash(i*7+2)*13;

    const base =
      i%5===0
        ? rgbMix(
            SHADOW,
            GOLD,
            .55
          )
        : rgbMix(
            NIGHT,
            OLIVE,
            .35
          );

    stroke(
      p,
      x0,
      y,
      Math.min(
        63,
        x0+len
      ),
      y,
      base,
      .28,
      .58
    );
  }

  // dramatic light response

  const light =
    Math.pow(
      clamp(
        p.light,
        0,
        1
      ),
      1.8
    );

  // moon reflection

  for(
    let i=0;
    i<26;
    i++
  ) {
    const y =
      99 +
      i*1.02;

    const width =
      3 +
      i*.18 +
      hash(i+90)*4;

    const center =
      15 +
      Math.sin(
        i*.83 +
        p.moonDrift*.75
      ) *
      1.9;

    const flicker =
      .62 +
      .38 *
      Math.sin(
        p.t*2.2 +
        i*1.7
      );

    const visibility =
      clamp(
        light*
        (
          .45+
          flicker*.55
        ),
        0,
        1
      );

    const c =
      rgbMix(
        WATER,
        IVORY,
        visibility
      );

    stroke(
      p,
      center-
      width*.5,
      y,
      center+
      width*.5,
      y,
      c,
      .35,
      .61
    );
  }
}


// =====================================================
// SILVER GRASS
// =====================================================

function plume(
  p,
  baseX,
  baseY,
  tipX,
  tipY,
  seed,
  depth=1,
  scale=1
) {
  const windPower =
    Math.abs(
      p.flow
    );

  // dramatically stronger wind movement

  const sway =
    Math.sin(
      p.t *
      (
        .48 +
        seed*.008
      ) +
      seed
    ) *
    (
      .18 +
      windPower*.34
    ) *
    scale +
    p.flow *
    .52 *
    scale;

  const cx =
    mix(
      baseX,
      tipX,
      .52
    ) +
    sway*1.85;

  const cy =
    mix(
      baseY,
      tipY,
      .5
    ) +
    2;

  const stemC =
    seed%3===0
      ? OLIVE
      : rgbMix(
          OLIVE,
          GOLD,
          .28
        );

  curve(
    p,
    baseX,
    baseY,
    cx,
    cy,
    tipX+sway,
    tipY,
    stemC,
    .48*scale,
    depth,
    26
  );

  const tx =
    tipX+sway;

  const ty =
    tipY;

  const dx =
    tx-cx;

  const dy =
    ty-cy;

  const L =
    Math.max(
      1,
      Math.hypot(
        dx,
        dy
      )
    );

  const nx =
    -dy/L;

  const ny =
    dx/L;

  const ux =
    dx/L;

  const uy =
    dy/L;

  const plumeLen =
    9.2*scale;

  const sx =
    tx -
    ux*plumeLen;

  const sy =
    ty -
    uy*plumeLen;

  stroke(
    p,
    sx,
    sy,
    tx,
    ty,
    PALEGOLD,
    .55*scale,
    depth
  );

  for(
    let i=0;
    i<11;
    i++
  ) {
    const t =
      i/10;

    const px =
      mix(
        sx,
        tx,
        t
      );

    const py =
      mix(
        sy,
        ty,
        t
      );

    const sideLen =
      (
        2.5*
        (1-t)+.4
      ) *
      scale *
      (
        .8 +
        hash(
          seed*31+i
        )*.45
      );

    const fuzz =
      (
        hash(
          seed*71+i
        )-.5
      ) *
      .7 *
      scale;

    const c =
      i%3===0
        ? IVORY
        : PALEGOLD;

    stroke(
      p,
      px,
      py,
      px+
      nx*
      (
        sideLen+
        fuzz
      ),
      py+
      ny*
      (
        sideLen+
        fuzz
      ),
      c,
      .34*scale,
      depth
    );

    stroke(
      p,
      px,
      py,
      px-
      nx*
      (
        sideLen*.72-
        fuzz
      ),
      py-
      ny*
      (
        sideLen*.72-
        fuzz
      ),
      GOLD,
      .3*scale,
      depth
    );
  }
}


function silverGrass(p) {

  const back =
    [
      [4,127,6,93,1,.78],
      [10,127,16,88,2,.78],
      [19,127,26,96,3,.74],
      [26,127,35,88,4,.82],
      [39,127,43,82,5,.78],
      [46,127,49,85,6,.82],
      [54,127,60,78,7,.86]
    ];

  back.forEach(
    a =>
      plume(
        p,
        a[0],
        a[1],
        a[2],
        a[3],
        a[4],
        .78,
        a[5]
      )
  );

  const front =
    [
      [26,130,39,87,10,1.02],
      [33,130,45,82,11,1.08],
      [40,130,51,75,12,1.15],
      [46,130,58,72,13,1.2],
      [52,130,64,80,14,1.12],
      [57,130,68,88,15,1.02],

      [8,130,20,105,16,.92],
      [14,130,27,101,17,.98],
      [2,130,13,111,18,.88]
    ];

  front.forEach(
    a =>
      plume(
        p,
        a[0],
        a[1],
        a[2],
        a[3],
        a[4],
        1.02,
        a[5]
      )
  );
}


// =====================================================
// FALLING LIGHT / LEAVES
// =====================================================

function petalsAndSparks(p) {

  const windMag =
    clamp(
      Math.abs(
        p.flow
      ) /
      7,
      0,
      1
    );

  for(
    let i=0;
    i<p.petals.length;
    i++
  ) {
    const q =
      p.petals[i];

    const x =
      q.x +
      Math.sin(
        p.t*1.1 +
        q.wobble
      ) *
      (
        .7 +
        windMag*2.6
      );

    const y =
      q.y +
      Math.sin(
        p.t*.6 +
        q.wobble
      ) *
      .35;

    const c =
      i%4===0
        ? PALEGOLD
        : GOLD;

    if(i%3===0) {
      poly(
        p,
        [
          [x,y],
          [x+q.size*1.2,y+.35],
          [x+.35,y+q.size*1.55],
          [x-.35,y+.55]
        ],
        c,
        .7
      );
    }
    else {
      rect(
        p,
        x,
        y,
        .6*q.size,
        .85*q.size,
        c,
        .7
      );
    }
  }
}


// =====================================================
// COMPLETE SKY
// =====================================================

function sky(p) {

  rect(
    p,
    0,
    0,
    64,
    128,
    NIGHT,
    .05
  );

  const drift =
    p.moonDrift *
    .05;

  // stars

  for(
    let i=0;
    i<34;
    i++
  ) {
    let x =
      (
        hash(
          i*13+2
        ) *
        68 -
        2 +
        drift
      ) %
      68;

    if(x<0)
      x += 68;

    const y =
      3 +
      hash(
        i*13+5
      ) *
      77;

    if(
      Math.hypot(
        x-15.2,
        y-20.5
      ) <
      13
    )
      continue;

    star(
      p,
      x,
      y,
      i%9===0
    );
  }

  // clouds

  const clouds =
    [
      [-5,31,.7],
      [52,27,.72],
      [-9,46,.92],
      [58,48,.85],
      [14,79,.85]
    ];

  clouds.forEach(
    (c,i)=>{

      const dd =
        (
          (
            (
              p.moonDrift *
              (
                .55 +
                i*.05
              ) +
              i*23 +
              95
            ) %
            190
          ) +
          190
        ) %
        190 -
        95;

      cloud(
        p,
        c[0]+dd,
        c[1]+
        Math.sin(
          p.t*.08+i
        )*.45,
        c[2],
        .22+
        i*.015
      );
    }
  );

  moon(p);
  windowGlow(p);
  branchAndBird(p);
  distantHills(p);
}


// =====================================================
// DRAW
// =====================================================

function draw(display,p) {

  if(
    p.w!==display.width ||
    p.h!==display.height
  ) {
    p.w =
      display.width;

    p.h =
      display.height;

    p.sx =
      p.w/64;

    p.sy =
      p.h/128;

    p.rgb =
      new Uint8Array(
        p.w *
        p.h *
        3
      );
  }

  p.rgb.fill(0);

  const approach =
    clamp(
      (p.zoom-1)/1.8,
      0,
      1
    );

  p.cameraY =
    mix(
      64,
      58,
      approach *
      approach *
      (
        3-
        2*approach
      )
    );

  // background
  sky(p);

  // middle layer
  water(p);

  // floating particles
  petalsAndSparks(p);

  // foreground grass
  silverGrass(p);

  // output
  for(
    let y=0;
    y<p.h;
    y++
  ) {
    for(
      let x=0;
      x<p.w;
      x++
    ) {
      const i =
        (
          y*p.w+x
        ) *
        3;

      display.setPixel(
        x,
        y,
        p.rgb[i],
        p.rgb[i+1],
        p.rgb[i+2]
      );
    }
  }
}


// ── Made for Patternflow · @mikdnom ──
//
// Based on “Midnight Clocktower” by @engmung.
// Original shared under CC-BY-SA-4.0.
// Original author credit retained under the licence.
  __stack.push({
    kind: "code", opacity: 1, blend: "normal", recolor: false, role: "paint", maskInvert: false,
    lut: null,
    buf: new Uint8ClampedArray(__W * __H * 4),
    params: {},
    fSetup: typeof setup === "function" ? setup : null,
    fUpdate: typeof update === "function" ? update : null,
    fDraw: typeof draw === "function" ? draw : null,
  });
})();

// Mask grouping: a mask layer paints nothing — it gates the nearest paint
// layer BELOW it (stacked masks intersect). Binary threshold: pixel-art masks
// switch on where alpha >= 0.5, code masks where luminance × alpha >= 0.5.
const __groups = [];
{
  let last = null;
  for (const L of __stack) {
    if (L.role === "mask") { if (last) last.masks.push(L); continue; }
    L.masks = [];
    last = L;
    if (L.opacity > 0) __groups.push(L);
  }
}

function __maskOn(M, j) {
  const B = M.buf;
  let on;
  if (M.kind === "pixel") on = B[j + 3] >= 128;
  else on = (0.2126 * B[j] + 0.7152 * B[j + 1] + 0.0722 * B[j + 2]) * (B[j + 3] / 255) >= 127.5;
  return M.maskInvert ? !on : on;
}

// One shared knob set: every layer receives the same input, exactly like
// patterns running on the device's four physical encoders.
function __mirror(L) {
  const inp = L.lastInput;
  if (!inp) return;
  L.params.knobValues = inp.knobValues;
  L.params.knobNormalized = inp.knobNormalized;
  L.params.knobDeltas = inp.knobDeltas;
  L.params.knobRanges = inp.knobRanges;
  L.params.btnPressed = inp.btnPressed;
  L.params.btnHeld = inp.btnHeld;
}

export function setup(params) {
  for (const L of __stack) {
    if (L.kind !== "code") continue;
    L.display = __mkDisplay(L);
    if (L.fSetup) L.fSetup(L.params);
  }
}

export function update(dt, input, params) {
  for (const L of __stack) {
    if (L.kind !== "code") continue;
    L.lastInput = input;
    __mirror(L);
    if (L.fUpdate) L.fUpdate(dt, input, L.params);
  }
}

export function draw(display, params, time) {
  for (const L of __stack) {
    if (L.kind !== "code" || !L.fDraw) continue;
    L.buf.fill(0);
    __mirror(L);
    L.fDraw(L.display, L.params, time);
    if (L.recolor && L.lut) {
      const B = L.buf, T = L.lut;
      for (let i = 0; i < B.length; i += 4) {
        if (B[i + 3] === 0) continue;
        const lum = Math.round(0.2126 * B[i] + 0.7152 * B[i + 1] + 0.0722 * B[i + 2]) * 4;
        B[i] = T[lum]; B[i + 1] = T[lum + 1]; B[i + 2] = T[lum + 2]; B[i + 3] = T[lum + 3];
      }
    }
  }

  // Composite bottom → top over the panel's opaque black.
  const count = __W * __H;
  for (let i = 0; i < count; i++) {
    const j = i * 4;
    let r = 0, g = 0, b = 0;
    for (const L of __groups) {
      let hidden = false;
      for (let m = 0; m < L.masks.length; m++) {
        if (!__maskOn(L.masks[m], j)) { hidden = true; break; }
      }
      if (hidden) continue;
      const B = L.buf;
      const a = (B[j + 3] / 255) * L.opacity;
      if (a <= 0) continue;
      const sr = B[j], sg = B[j + 1], sb = B[j + 2], inv = 1 - a;
      if (L.blend === "add") { r += sr * a; g += sg * a; b += sb * a; }
      else if (L.blend === "multiply") {
        r = r * inv + ((r * sr) / 255) * a;
        g = g * inv + ((g * sg) / 255) * a;
        b = b * inv + ((b * sb) / 255) * a;
      } else if (L.blend === "screen") {
        r = r * inv + (255 - ((255 - r) * (255 - sr)) / 255) * a;
        g = g * inv + (255 - ((255 - g) * (255 - sg)) / 255) * a;
        b = b * inv + (255 - ((255 - b) * (255 - sb)) / 255) * a;
      } else {
        r = r * inv + sr * a;
        g = g * inv + sg * a;
        b = b * inv + sb * a;
      }
    }
    display.setPixel(i % __W, (i / __W) | 0, r, g, b);
  }
}

// @stack v1 d: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

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
