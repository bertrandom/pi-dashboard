// Patternflow community pattern runtime for Node.
//
// Mirrors the website's sandboxed PatternRuntime (community.patternflow.work,
// pattern-sandbox.html) so patterns written there behave the same here:
// setup(params) / update(dt, input, params) / draw(display, params, time),
// display.setPixel / display.setValue, @knobs ranges, @ramp colour ramps.

export const KNOB_COUNT = 4;
export const DETENTS_PER_TURN = 24;
// Defaults used when a pattern's @knobs line leaves a knob out.
const DEFAULT_KNOB_LABELS = ['Knob 1', 'Knob 2', 'Knob 3', 'Knob 4'];
const DEFAULT_KNOB_RANGES = [[0, 1], [0.1, 10], [0, 4.9], [0, 1]];
const KNOB_WRAP = [true, false, false, true];

const KNOBS_RE = /^[ \t]*\/\/[ \t]*@knobs[ \t]+(.+)$/m;
const RAMP_RE = /^[ \t]*\/\/[ \t]*@ramp[ \t]+(.+)$/m;
const STOP_RE = /^(\d*\.?\d+):(#[0-9a-fA-F]{6})$/;
const RAMP_MODES = ['linear', 'smooth', 'step', 'hsvShort', 'hsvLong', 'oklab', 'oklchShort', 'oklchLong'];
const DEFAULT_RAMP = {
  stops: [
    { position: 0, color: [8, 24, 64] },
    { position: 0.55, color: [255, 77, 0] },
    { position: 1, color: [255, 232, 154] },
  ],
  mode: 'linear',
  wrap: false,
};

function clampByte(v) {
  return Number.isFinite(v) ? Math.max(0, Math.min(255, Math.round(v))) : 0;
}

// ── Annotations ──────────────────────────────────────────────────────────────

export function parseKnobs(code) {
  const labels = [...DEFAULT_KNOB_LABELS];
  const ranges = DEFAULT_KNOB_RANGES.map(r => [...r]);
  const m = code.match(KNOBS_RE);
  if (m) {
    m[1].split(',').slice(0, KNOB_COUNT).forEach((part, i) => {
      const k = part.trim().match(/^(.+?)\s*=\s*(-?\d*\.?\d+)\s*\.\.\s*(-?\d*\.?\d+)$/);
      if (!k) return;
      const min = Number(k[2]), max = Number(k[3]);
      if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return;
      labels[i] = k[1].trim().slice(0, 14);
      ranges[i] = [min, max];
    });
  }
  const values = ranges.map(([a, b]) => Number(((a + b) / 2).toFixed(3)));
  return { labels, ranges, values };
}

function parseRamp(code) {
  const m = code.match(RAMP_RE);
  if (!m) return null;
  const tokens = m[1].trim().split(/\s+/);
  if (!RAMP_MODES.includes(tokens[0])) return null;
  const ramp = { mode: tokens[0], wrap: false, recolor: false, stops: [] };
  for (const tok of tokens.slice(1)) {
    if (tok === 'wrap') { ramp.wrap = true; continue; }
    if (tok === 'recolor') { ramp.recolor = true; continue; }
    const s = tok.match(STOP_RE);
    if (!s || ramp.stops.length >= 64) continue;
    const v = parseInt(s[2].slice(1), 16);
    ramp.stops.push({
      position: Math.max(0, Math.min(1, Number(s[1]))),
      color: [(v >> 16) & 255, (v >> 8) & 255, v & 255],
    });
  }
  return ramp.stops.length ? ramp : null;
}

// ── Colour ramps ─────────────────────────────────────────────────────────────

function rgbToHsv(r, g, b) {
  const rf = r / 255, gf = g / 255, bf = b / 255;
  const max = Math.max(rf, gf, bf), d = max - Math.min(rf, gf, bf);
  let h = 0;
  if (d > 0) {
    if (max === rf) h = ((gf - bf) / d) % 6;
    else if (max === gf) h = (bf - rf) / d + 2;
    else h = (rf - gf) / d + 4;
    h /= 6;
    if (h < 0) h += 1;
  }
  return [h, max === 0 ? 0 : d / max, max];
}

function hsvToRgb(h, s, v) {
  h -= Math.floor(h);
  const i = Math.floor(h * 6), f = h * 6 - i;
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const rgb = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
  return rgb.map(c => Math.round(c * 255));
}

const toLinear = c => (c /= 255, c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const toSrgb = c => Math.max(0, Math.min(1, c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)) * 255;

function srgbToOklab(r, g, b) {
  const lr = toLinear(r), lg = toLinear(g), lb = toLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabToLinear(L, A, B) {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = rgb => rgb.every(c => c >= -1e-4 && c <= 1 + 1e-4);

function oklabToSrgb(L, A, B) {
  let rgb = oklabToLinear(L, A, B);
  if (!inGamut(rgb)) {
    // Reduce chroma until the colour fits, keeping lightness and hue.
    let lo = 0, hi = 1;
    for (let i = 0; i < 16; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklabToLinear(L, A * mid, B * mid))) lo = mid; else hi = mid;
    }
    rgb = oklabToLinear(L, A * lo, B * lo);
  }
  return rgb.map(toSrgb);
}

// Hue delta for short/long interpolation, as fractions of a turn.
function hueDelta(dh, short) {
  if (short) {
    if (dh > 0.5) dh -= 1;
    if (dh < -0.5) dh += 1;
  } else if (dh > 0 && dh < 0.5) dh -= 1;
  else if (dh <= 0 && dh > -0.5) dh += 1;
  return dh;
}

function mix(a, b, t, mode) {
  if (mode === 'smooth') t = t * t * (3 - 2 * t);
  if (mode === 'oklab' || mode === 'oklchShort' || mode === 'oklchLong') {
    const [La, Aa, Ba] = srgbToOklab(...a), [Lb, Ab, Bb] = srgbToOklab(...b);
    const L = La + (Lb - La) * t;
    if (mode === 'oklab') return oklabToSrgb(L, Aa + (Ab - Aa) * t, Ba + (Bb - Ba) * t);
    const Ca = Math.hypot(Aa, Ba), Cb = Math.hypot(Ab, Bb);
    let ha = Math.atan2(Ba, Aa) / (2 * Math.PI); if (ha < 0) ha += 1;
    let hb = Math.atan2(Bb, Ab) / (2 * Math.PI); if (hb < 0) hb += 1;
    const h1 = Ca < 1e-4 ? (Cb < 1e-4 ? 0 : hb) : ha;
    const dh = hueDelta((Cb < 1e-4 ? h1 : hb) - h1, mode === 'oklchShort');
    const C = Ca + (Cb - Ca) * t, H = (h1 + dh * t) * 2 * Math.PI;
    return oklabToSrgb(L, Math.cos(H) * C, Math.sin(H) * C);
  }
  if (mode === 'hsvShort' || mode === 'hsvLong') {
    const ha = rgbToHsv(...a), hb = rgbToHsv(...b);
    const h1 = ha[1] === 0 ? hb[0] : ha[0];
    const dh = hueDelta((hb[1] === 0 ? h1 : hb[0]) - h1, mode === 'hsvShort');
    return hsvToRgb(h1 + dh * t, ha[1] + (hb[1] - ha[1]) * t, ha[2] + (hb[2] - ha[2]) * t);
  }
  return [0, 1, 2].map(i => a[i] + (b[i] - a[i]) * t);
}

const stopAlpha = s => (s.alpha === undefined || !Number.isFinite(s.alpha) ? 1 : Math.max(0, Math.min(1, s.alpha)));

function mixAlpha(a, b, t, mode) {
  if (mode === 'smooth') t = t * t * (3 - 2 * t);
  return stopAlpha(a) + (stopAlpha(b) - stopAlpha(a)) * t;
}

function sampleRamp(stops, mode, wrap, t) {
  if (stops.length === 1) return [...stops[0].color, stopAlpha(stops[0])];
  t = Math.max(0, Math.min(1, t));
  const first = stops[0], last = stops[stops.length - 1];
  if (t <= first.position || t >= last.position) {
    if (!wrap) {
      const edge = t <= first.position ? first : last;
      return [...edge.color, stopAlpha(edge)];
    }
    const span = 1 - last.position + first.position;
    const local = span <= 0 ? 0 : (t >= last.position ? t - last.position : t + 1 - last.position) / span;
    if (mode === 'step') return [...last.color, stopAlpha(last)];
    return [...mix(last.color, first.color, local, mode), mixAlpha(last, first, local, mode)];
  }
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i], b = stops[i + 1];
    if (t > b.position) continue;
    if (mode === 'step') return [...a.color, stopAlpha(a)];
    const span = b.position - a.position;
    const local = span <= 0 ? 0 : (t - a.position) / span;
    return [...mix(a.color, b.color, local, mode), mixAlpha(a, b, local, mode)];
  }
  return [...last.color, stopAlpha(last)];
}

function buildRampLUT(ramp) {
  const stops = [...ramp.stops].sort((a, b) => a.position - b.position);
  const lut = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    const [r, g, b, a] = sampleRamp(stops, ramp.mode, ramp.wrap, i / 255);
    lut[i * 4] = clampByte(r);
    lut[i * 4 + 1] = clampByte(g);
    lut[i * 4 + 2] = clampByte(b);
    lut[i * 4 + 3] = clampByte(a * 255);
  }
  return lut;
}

// ── Runtime ──────────────────────────────────────────────────────────────────

function compile(code) {
  const body = code
    .replace(/^\s*import\s+.*?;?\s*$/gm, '')
    .replace(/\bexport\s+function\b/g, 'function');
  const mod = new Function(`"use strict";\n${body}\nreturn {
    setup: typeof setup === "function" ? setup : undefined,
    update: typeof update === "function" ? update : undefined,
    draw: typeof draw === "function" ? draw : undefined,
  };`)();
  if (typeof mod.draw !== 'function') throw new Error('Pattern must export draw(display, params, time).');
  return mod;
}

const MAX_STEP = 0.05;

export class PatternRuntime {
  constructor(code, width = 128, height = 128) {
    this.width = width;
    this.height = height;
    this.data = new Uint8ClampedArray(width * height * 4);
    this.rgb = new Uint8Array(width * height * 3);
    this.time = 0;

    const ramp = parseRamp(code);
    this.lut = buildRampLUT(ramp ?? DEFAULT_RAMP);
    this.recolor = !!ramp?.recolor;

    const knobs = parseKnobs(code);
    this.knobLabels = knobs.labels;
    this.knobRanges = knobs.ranges;
    this.knobValues = knobs.values;

    const data = this.data, lut = this.lut;
    this.display = {
      width,
      height,
      setPixel(x, y, r, g, b) {
        const xi = Math.floor(x), yi = Math.floor(y);
        if (xi < 0 || xi >= width || yi < 0 || yi >= height) return;
        if (Array.isArray(r)) { g = r[1]; b = r[2]; r = r[0]; }
        const i = (yi * width + xi) * 4;
        data[i] = clampByte(r ?? 0);
        data[i + 1] = clampByte(g ?? 0);
        data[i + 2] = clampByte(b ?? 0);
        data[i + 3] = 255;
      },
      setValue(x, y, v) {
        const xi = Math.floor(x), yi = Math.floor(y);
        if (xi < 0 || xi >= width || yi < 0 || yi >= height) return;
        const li = Math.round((Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0) * 255) * 4;
        const i = (yi * width + xi) * 4;
        data[i] = lut[li];
        data[i + 1] = lut[li + 1];
        data[i + 2] = lut[li + 2];
        data[i + 3] = lut[li + 3];
      },
    };

    this.module = compile(code);
    this.params = {};
    this.module.setup?.(this.params);
  }

  // Encoder detents: one full turn (24 detents) sweeps half the knob's range.
  turnKnob(i, detents) {
    const [min, max] = this.knobRanges[i];
    let v = this.knobValues[i] + detents * (max - min) / 2 / DETENTS_PER_TURN;
    if (KNOB_WRAP[i]) v = min + ((((v - min) % (max - min)) + (max - min)) % (max - min));
    else v = Math.max(min, Math.min(max, v));
    this.knobValues[i] = v;
  }

  resetKnob(i) {
    const [min, max] = this.knobRanges[i];
    this.knobValues[i] = Number(((min + max) / 2).toFixed(3));
  }

  _updateStep(dt, deltas, pressed, held) {
    const input = {
      knobDeltas: deltas,
      knobValues: this.knobValues.slice(),
      knobNormalized: this.knobValues.map((v, i) => {
        const [min, max] = this.knobRanges[i];
        return (v - min) / Math.max(0.001, max - min);
      }),
      knobRanges: this.knobRanges,
      btnPressed: pressed,
      btnHeld: held,
    };
    const p = this.params;
    p.knobValues = input.knobValues;
    p.knobNormalized = input.knobNormalized;
    p.knobDeltas = input.knobDeltas;
    p.knobRanges = input.knobRanges;
    p.btnPressed = input.btnPressed;
    p.btnHeld = input.btnHeld;
    this.module.update?.(dt, input, p);
  }

  // Advance by dt seconds with update() in slices of at most 50ms, as the
  // website does, then draw once. (The website draws every slice but only
  // shows the last; skipping the hidden draws keeps slow patterns from
  // falling further behind on the Pi.) Knob deltas and button presses are
  // delivered on the first slice only.
  frame(dt, deltas = [0, 0, 0, 0], pressed = [false, false, false, false], held = [false, false, false, false]) {
    let remaining = Math.max(0, dt), first = true;
    do {
      const slice = Math.min(remaining, MAX_STEP);
      this.time += slice;
      this._updateStep(slice, first ? deltas : [0, 0, 0, 0], first ? pressed : [false, false, false, false], held);
      remaining -= slice;
      first = false;
    } while (remaining > 1e-5);
    this.data.fill(0);
    this.module.draw(this.display, this.params, this.time);
    if (this.recolor) this._recolor();
    return this._toRGB();
  }

  _recolor() {
    const d = this.data, lut = this.lut;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      const li = Math.round(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) * 4;
      d[i] = lut[li]; d[i + 1] = lut[li + 1]; d[i + 2] = lut[li + 2]; d[i + 3] = lut[li + 3];
    }
  }

  // The website draws on a black canvas, so alpha just scales toward black.
  _toRGB() {
    const d = this.data, out = this.rgb;
    for (let i = 0, j = 0; i < d.length; i += 4, j += 3) {
      const a = d[i + 3];
      if (a === 255) { out[j] = d[i]; out[j + 1] = d[i + 1]; out[j + 2] = d[i + 2]; }
      else { out[j] = (d[i] * a) / 255; out[j + 1] = (d[i + 1] * a) / 255; out[j + 2] = (d[i + 2] * a) / 255; }
    }
    return out;
  }
}
