// ===== Patternflow pattern =====
// Title:    Biolum Helix
// Author:   @martinnlopez
// Date:     2026-08-10
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @matrix 128x128
// @knobs Rot_X=0..6.28, Rot_Y=0..6.28, Rot_Z=0..6.28, Twist=0..12
// Patternflow layer-stack composition — flattened by Pattern Lab.
// Layers (bottom → top):
//   1. Biolum Helix (code, normal, 100%)
//   2. Biolum Helix (code, add, 100%)
const __PW = 64, __PH = 128;
const __W = 128, __H = 128;
const __OX = (__W - __PW) >> 1, __OY = (__H - __PH) >> 1;
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

// ── code layer: Biolum Helix ──
(function () {
  // Shadow the wrapper's own exports: a layer that defines no setup/update
  // must yield undefined here, not capture the OUTER setup (infinite loop).
  var setup, update, draw;

function setup(params) {
  params.t = 0;
  params.numParticles = 1200;
  params.particles = [];
  for (let i = 0; i < params.numParticles; i++) {
    // Distribute particles along the height of the helix
    const verticalPos = (i / params.numParticles) * 2 - 1; // -1 to 1
    // Assign to Strand A (0), Strand B (1), or a Rung (2)
    const type = i % 3; 
    params.particles.push({ v: verticalPos, type: type, rand: Math.random() });
  }
}

function update(dt, input, params) {
  params.k = input.knobValues;
  params.t += dt * 0.6;
}

// 3D rotation and vector helpers
function rotatePoint(p, ax, ay, az) {
  let [x, y, z] = p;
  let cX = Math.cos(ax), sX = Math.sin(ax);
  let y1 = y * cX - z * sX, z1 = y * sX + cX * z;
  y = y1; z = z1;
  let cY = Math.cos(ay), sY = Math.sin(ay);
  let x2 = x * cY + z * sY, z2 = -x * sY + cY * z;
  x = x2; z = z2;
  let cZ = Math.cos(az), sZ = Math.sin(az);
  return [x * cZ - y * sZ, x * sZ + y * cZ, z];
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const normalize = (v) => {
  const l = Math.sqrt(dot(v, v)) || 1;
  return [v[0]/l, v[1]/l, v[2]/l];
};

function draw(display, params, time) {
  const w = display.width, h = display.height;
  const t = params.t;
  const [rotX, rotY, rotZ, twist] = params.k;
  const centerX = w / 2, centerY = h / 2, scale = w * 0.4;

  // Clear Screen
  for (let i = 0; i < w * h; i++) display.setPixel(i % w, Math.floor(i / w), 0, 0, 0);

  for (let i = 0; i < params.numParticles; i++) {
    const p = params.particles[i];
    
    // --- HELIX MATH ---
    const angle = p.v * twist + t;
    let px, py, pz;
    let r = 0.6; // Radius of the helix

    if (p.type === 0) { // Strand A
      px = r * Math.cos(angle);
      pz = r * Math.sin(angle);
    } else if (p.type === 1) { // Strand B (180 degrees offset)
      px = r * Math.cos(angle + Math.PI);
      pz = r * Math.sin(angle + Math.PI);
    } else { // Rung (connecting the strands)
      const lerp = p.rand * 2 - 1; // Position between strands
      px = r * Math.cos(angle) * lerp;
      pz = r * Math.sin(angle) * lerp;
    }
    py = p.v * 1.8; // Vertical height

    // --- FRESNEL & COLOR ---
    // Approximate a normal for the helix backbone
    let normalVector = normalize([px, 0, pz]);
    let viewVector = [0, 0, -1];
    let rotatedNormal = rotatePoint(normalVector, rotX, rotY, rotZ);
    
    let fresnel = 1.0 - Math.abs(dot(rotatedNormal, viewVector));
    fresnel = Math.pow(fresnel, 3.0); // Sharpen the rim glow

    // --- 3D PROJECTION ---
    let [rx, ry, rz] = rotatePoint([px, py, pz], rotX, rotY, rotZ);
    const screenX = Math.floor(centerX + rx * scale);
    const screenY = Math.floor(centerY + ry * scale);

    if (screenX >= 0 && screenX < w && screenY >= 0 && screenY < h) {
      // Color scheme: Pink for strands, Cyan for rungs
      let rOut, gOut, bOut;
      
      if (p.type < 2) { // The Main Strands (Pink)
        rOut = 255;
        gOut = 100 + fresnel * 155;
        bOut = 180 + fresnel * 75;
      } else { // The Rungs (Cyan)
        rOut = 50 + fresnel * 100;
        gOut = 200 + fresnel * 55;
        bOut = 255;
      }

      display.setPixel(screenX, screenY, rOut, gOut, bOut);
      
      // Depth hint: draw tiny extra glow for closer particles
      if (rz > 0.2 && fresnel > 0.7) {
        display.setPixel(screenX + 1, screenY, rOut * 0.4, gOut * 0.4, bOut * 0.4);
      }
    }
  }
}
  __stack.push({
    kind: "code", opacity: 1, blend: "normal", recolor: true, role: "paint", maskInvert: false,
    lut: [26,9,6,255,28,10,7,255,30,11,8,255,32,12,9,255,34,13,10,255,36,14,11,255,38,15,12,255,40,16,13,255,42,17,15,255,44,18,16,255,46,19,17,255,48,20,19,255,50,21,20,255,53,22,21,255,55,23,23,255,57,24,24,255,59,25,26,255,61,26,27,255,63,27,29,255,65,28,31,255,68,29,32,255,70,30,34,255,72,31,36,255,74,32,37,255,76,34,39,255,78,35,41,255,81,36,43,255,83,37,45,255,85,38,47,255,87,39,49,255,89,40,51,255,92,41,53,255,94,43,55,255,96,44,57,255,98,45,59,255,100,46,61,255,103,47,63,255,105,48,65,255,107,50,68,255,109,51,70,255,111,52,72,255,114,53,74,255,116,55,77,255,118,56,79,255,120,57,82,255,122,58,84,255,124,60,87,255,126,61,89,255,129,62,92,255,131,63,94,255,133,65,97,255,135,66,100,255,137,67,102,255,139,69,105,255,141,70,108,255,143,72,110,255,145,73,113,255,147,74,116,255,149,76,119,255,151,77,122,255,153,79,125,255,155,80,128,255,157,82,131,255,159,83,134,255,161,85,137,255,163,86,140,255,165,88,143,255,167,89,146,255,169,91,149,255,171,92,152,255,172,94,155,255,174,95,159,255,177,96,160,255,180,97,159,255,184,98,158,255,187,98,158,255,190,99,157,255,193,100,156,255,196,101,155,255,200,101,154,255,203,102,153,255,206,103,151,255,209,104,150,255,212,105,149,255,215,106,147,255,218,106,146,255,221,107,144,255,224,109,142,255,227,110,141,255,230,111,139,255,232,112,137,255,235,113,135,255,238,114,133,255,240,116,131,255,243,117,129,255,245,118,126,255,248,120,124,255,250,121,122,255,252,123,119,255,255,125,117,255,255,128,115,255,255,131,115,255,255,135,114,255,255,138,114,255,255,141,113,255,255,144,113,255,255,147,113,255,255,150,113,255,255,153,113,255,255,156,113,255,255,159,114,255,255,162,114,255,255,165,114,255,255,167,115,255,255,170,116,255,255,173,116,255,255,176,117,255,255,178,118,255,255,181,118,255,255,184,119,255,255,186,120,255,255,189,121,255,255,191,122,255,255,194,123,255,255,196,124,255,255,199,125,255,255,202,126,255,255,204,127,255,255,207,127,255,255,209,128,255,255,212,129,255,255,214,130,255,255,217,130,255,255,219,130,255,255,222,130,255,255,224,130,255,255,227,129,255,255,229,128,255,255,232,126,255,255,234,123,255,255,237,118,255,255,240,110,255,255,243,98,255,255,246,75,255,255,250,0,255,255,247,79,255,255,242,117,255,255,237,132,255,255,233,140,255,255,229,144,255,255,225,145,255,255,221,146,255,255,217,146,255,255,214,146,255,255,210,145,255,255,206,144,255,255,202,143,255,255,198,142,255,255,195,141,255,255,191,140,255,255,187,140,255,255,183,139,255,255,179,138,255,255,175,138,255,255,170,138,255,255,166,138,255,255,162,138,255,255,157,139,255,255,153,139,255,255,148,141,255,255,143,142,255,255,138,144,255,255,133,146,255,255,127,149,255,253,123,152,255,249,121,157,255,244,120,161,255,239,118,165,255,234,117,168,255,229,116,172,255,223,115,175,255,218,114,178,255,212,113,181,255,206,112,183,255,200,112,185,255,194,111,187,255,188,110,189,255,182,110,190,255,176,109,191,255,170,109,192,255,171,111,193,255,173,114,194,255,174,116,195,255,175,118,196,255,177,120,197,255,178,122,198,255,179,125,199,255,180,127,200,255,182,129,201,255,183,131,202,255,184,133,203,255,186,136,204,255,187,138,205,255,188,140,206,255,190,142,207,255,191,144,208,255,192,147,209,255,193,149,210,255,195,151,211,255,196,153,212,255,197,155,213,255,199,157,214,255,200,160,215,255,201,162,216,255,202,164,217,255,204,166,218,255,205,168,219,255,206,171,220,255,208,173,221,255,209,175,222,255,210,177,223,255,212,179,224,255,213,182,225,255,214,184,226,255,215,186,227,255,217,188,228,255,218,190,228,255,219,193,229,255,221,195,230,255,222,197,231,255,223,199,232,255,224,201,233,255,226,204,234,255,227,206,235,255,228,208,236,255,229,210,237,255,231,212,238,255,232,215,239,255,233,217,240,255,235,219,241,255,236,221,241,255,237,224,242,255,238,226,243,255,240,228,244,255,241,230,245,255,242,233,246,255,244,235,247,255,245,237,248,255,246,239,249,255,247,241,250,255,249,244,251,255,250,246,251,255,251,248,252,255,252,250,253,255,254,253,254,255,255,255,255,255],
    buf: new Uint8ClampedArray(__W * __H * 4),
    params: {},
    fSetup: typeof setup === "function" ? setup : null,
    fUpdate: typeof update === "function" ? update : null,
    fDraw: typeof draw === "function" ? draw : null,
  });
})();

// ── code layer: Biolum Helix ──
(function () {
  // Shadow the wrapper's own exports: a layer that defines no setup/update
  // must yield undefined here, not capture the OUTER setup (infinite loop).
  var setup, update, draw;

function setup(params) {
  params.t = 0;
  params.numParticles = 1200;
  params.particles = [];
  for (let i = 0; i < params.numParticles; i++) {
    // Distribute particles along the height of the helix
    const verticalPos = (i / params.numParticles) * 2 - 1; // -1 to 1
    // Assign to Strand A (0), Strand B (1), or a Rung (2)
    const type = i % 3; 
    params.particles.push({ v: verticalPos, type: type, rand: Math.random() });
  }
}

function update(dt, input, params) {
  params.k = input.knobValues;
  params.t += dt * 0.6;
}

// 3D rotation and vector helpers
function rotatePoint(p, ax, ay, az) {
  let [x, y, z] = p;
  let cX = Math.cos(ax), sX = Math.sin(ax);
  let y1 = y * cX - z * sX, z1 = y * sX + cX * z;
  y = y1; z = z1;
  let cY = Math.cos(ay), sY = Math.sin(ay);
  let x2 = x * cY + z * sY, z2 = -x * sY + cY * z;
  x = x2; z = z2;
  let cZ = Math.cos(az), sZ = Math.sin(az);
  return [x * cZ - y * sZ, x * sZ + y * cZ, z];
}

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const normalize = (v) => {
  const l = Math.sqrt(dot(v, v)) || 1;
  return [v[0]/l, v[1]/l, v[2]/l];
};

function draw(display, params, time) {
  const w = display.width, h = display.height;
  const t = params.t;
  const [rotX, rotY, rotZ, twist] = params.k;
  const centerX = w / 2, centerY = h / 2, scale = w * 0.4;

  // Clear Screen
  for (let i = 0; i < w * h; i++) display.setPixel(i % w, Math.floor(i / w), 0, 0, 0);

  for (let i = 0; i < params.numParticles; i++) {
    const p = params.particles[i];
    
    // --- HELIX MATH ---
    const angle = p.v * twist + t;
    let px, py, pz;
    let r = 0.6; // Radius of the helix

    if (p.type === 0) { // Strand A
      px = r * Math.cos(angle);
      pz = r * Math.sin(angle);
    } else if (p.type === 1) { // Strand B (180 degrees offset)
      px = r * Math.cos(angle + Math.PI);
      pz = r * Math.sin(angle + Math.PI);
    } else { // Rung (connecting the strands)
      const lerp = p.rand * 2 - 1; // Position between strands
      px = r * Math.cos(angle) * lerp;
      pz = r * Math.sin(angle) * lerp;
    }
    py = p.v * 1.8; // Vertical height

    // --- FRESNEL & COLOR ---
    // Approximate a normal for the helix backbone
    let normalVector = normalize([px, 0, pz]);
    let viewVector = [0, 0, -1];
    let rotatedNormal = rotatePoint(normalVector, rotX, rotY, rotZ);
    
    let fresnel = 1.0 - Math.abs(dot(rotatedNormal, viewVector));
    fresnel = Math.pow(fresnel, 3.0); // Sharpen the rim glow

    // --- 3D PROJECTION ---
    let [rx, ry, rz] = rotatePoint([px, py, pz], rotX, rotY, rotZ);
    const screenX = Math.floor(centerX + rx * scale);
    const screenY = Math.floor(centerY + ry * scale);

    if (screenX >= 0 && screenX < w && screenY >= 0 && screenY < h) {
      // Color scheme: Pink for strands, Cyan for rungs
      let rOut, gOut, bOut;
      
      if (p.type < 2) { // The Main Strands (Pink)
        rOut = 255;
        gOut = 100 + fresnel * 155;
        bOut = 180 + fresnel * 75;
      } else { // The Rungs (Cyan)
        rOut = 50 + fresnel * 100;
        gOut = 200 + fresnel * 55;
        bOut = 255;
      }

      display.setPixel(screenX, screenY, rOut, gOut, bOut);
      
      // Depth hint: draw tiny extra glow for closer particles
      if (rz > 0.2 && fresnel > 0.7) {
        display.setPixel(screenX + 1, screenY, rOut * 0.4, gOut * 0.4, bOut * 0.4);
      }
    }
  }
}
  __stack.push({
    kind: "code", opacity: 1, blend: "add", recolor: false, role: "paint", maskInvert: false,
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

// Pixel-art layers keep their authored size and sit centred on the 128x128
// panel; code layers render at the full panel size.
function __pix(i) {
  const x = (i % __W) - __OX, y = ((i / __W) | 0) - __OY;
  return x < 0 || x >= __PW || y < 0 || y >= __PH ? -1 : (y * __PW + x) * 4;
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
      const B = L.buf, k = L.kind === "pixel" ? __pix(i) : j;
      if (k < 0) continue;
      const a = (B[k + 3] / 255) * L.opacity;
      if (a <= 0) continue;
      const sr = B[k], sg = B[k + 1], sb = B[k + 2], inv = 1 - a;
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

// @stack v1 d:7Vh/b9s4Ev0qAx6ukGNakRRbcZS6uG7bQ3NImyApenFc40BLtE1EprQU/TPr734YUrblJG0We/eni8IWR0PO43D4xi+PZMZVITJJooCSgs148l6TyD9thydnYavZOg1PKZkwrcSCRI9kLhI9JlHYpGTMxWiMvkF7TQmLtZjxS7bk6iIhERm2262wdcYaXpO1Gs12HDYG3jBseMHwbMiD9tmwfUYoeZDZoCBRr+WenTZp4J4G9MT1wxPqu2etsE+JYnLE0aPn0dAN2n364oMf9Pt2tUs24ClOIDeZ/s8doea7W37fE0q+zUWhSZ+SYaYeroYkktM0pWTEJe4wzqZSk6hFiR4L+SDkiETk8urfhBLFhwWJQkriLM3UlyzhJCKzoeBpQtaUpLh5jPxI9DLHdzG6UCJMQjjnHuNJoxl6SaN50gwaZ75/2uDxSdAOwqQVtANCiWQTnPmbyNLpBD7zVCwIJTNRiEHKSaTVlFOS5SwWekkin5JByiWuz5IEIWboRXImpCZ4cMXDhZxxpUk0ZGnBEbuBfXwM/zDJB5Omjue6mExqht394f1uaHLX8V3X935IvsgzpWE4lbEWmYSC62nu5EyxSVGDxx8SwA5cDR3wzisGOZ1cM6VFnPICOuAH3t7rvPKu1zdvhpkCJ+UahFkLBLx9abFzEPV6GRzg+Bg+ikIrMZhqDrtVWZrJEegxB1vFkA3LUSoWdmqcyUIDpk7ELL3OEIoj4PiloDU4ggAa4J9jxIYPOgN/i+B9UYiRRNutVkwm8B4cr0Y3o9/A8WsUMgUMbqZyBE5Qq0LAWoIOCPg7nJyDffM0TW4+LcbOI8yiKmJq5kbmkwIGi+AL02MXH7OJU4N1zeR2/UOuf8jnBzrNE6a5k2gKQuZTTeGlw31AdPjaxYL6ztIpL6qHqaHegUTDEXhueF6GOj6Gk4+gMs1MJEzEjMc6U3gGOVfFD7mFYbz4dSakdnIKbEGBLSmwVYkDq6K3oLCksOpDB/LzjTW+g47dcpwVDlvUKBRbUyEkmrbOSx86sIQjnNWAFRxBcUdhtbEWd1DHV0ewMlOWaPfPYQUdWPm7kN29kEsM2d0LudyFXATQgQWG7ELdhuxSWKG1geYCzXF3G3OB7kEZM9jFvN+LucKY93sxVzam4nqqJPRMyHto2I3dU4OhuIe63f89JnJzUrYKkwzvsMMoDGrQeQes5/XhCAb4VQfW8+3It6PAjgJcxM6XmZqwVKywlJ2ZWcKcnX2bbsH+rrSTZNqZUZjVavDHH+DvIZ/1vP5xSmHW88vvoH+cGrDnL5VwotjcSUSRp1gytiIpaDHhtSqAOXSg9HJNj6MwrpgsSxgg5aXEMivLu2LuqUzfUSzYrvm8p6CRMU1Vlrel4h5zqbnCgpzDMQS0NGC5jK2hiFmKKZub29M0WzSk8iHlTMFtrDiXP6NHnDQuCXGzk4Lra7HgqYN8Mqc268M0y5Qht3mNgmf/Y8X8ZeK1+8t3295SVU9YPoeSypAwGw34/Ony4g6+vP/2GYfVRZgcmRTk7gyObDqhDjbrtvzzBYUcT3dVMSpE64aGkW9YIqbFE5K3rmIITu5aju10wKvBI87YMLV1Asjx5ik4qtwyhGVvlXFYVR3Mnas6rIGnBX8azd+Php2g7UHCR4pzhDssuK69AgHq1nB98SqY564lLAPC9p44k5LHWpTtsTDIii2I8rpyZY7WNJK93nedFcLcuwHXc87lZoHX8ghHZtFX07nvty674XJbHr7bNji+l12w7O+b0y6L7Z83n26/frqEN/Dh6vLqZldx2K3zXGULMWGaAytpy9yBbenAgMUPg0zyXbFZt++2gXV2ZOf0sDY9LM3+JufoPxN8vvXu2QvX8PvV8jU9L/lq43f2emA1mqGZPcrZxNmtNVS8kBxX8V0PGjanbFAYot0LRCvIapuFdtPNxDybO6WJwonr1UzCb8dM5VyaLCkxgVGazZ9k/eQjXN9c/evTh28XV193OTfdWy0oqCUFZRp4dbO93e3u/3yzti4LQ4fbBm9pbUOydVCmyyGjvjSt+9I07L9qWZ22o41NtHcd8ODNm210JN7tsPvkdRfewnhLk5bKUU1AEY/5hEdwLeSDqbfy5lD4sGTSWNRUjrY3yRTJFf4mG5nPwdV0w4mbs99jt7cQlGzzbczhCxOypJ0CHIy5veJgloUOBK3WdkEwUbCCPA/q25I4An/PaVA6tfedTnc+VcZBIMg6BTi4x+cIWk9ilSJhD1DwBNBLeKo7Mb9p7OOznlieIN2cFX2W4R3HVg7wI8/1GMZC6sj83gAt5BL4Qitm7oE5vDjNCq52GqR6RGoF78BzAyyTzU7QcFoplJ/DhTr4TyDbXwsW+OZ5sH3ebaIk0PVGBKCCZJMcdXChs9yK2bzkdBJ5pfQlEfmbF3qB5xNKWJqPGYn8Na26+hVXPxy0WPxTV889aTYr7kM+HHjeL9z907Dizoahx37l3vbaVXcWJvGee5+SiRXF2UMaj2/HmULtPFcsL1XzGrV/uUJpeFnj/7k/evxljW+J/yDzDzL/IPMPMv8g8w8y/yDzDzL/IPMPMv8g8w8y/yDzDzL//y7zfeadeeGfkvlD8+8XQrwVVnX7qzI/2JPtr6n802YVy/+q8lGDr/vr/wI=

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
