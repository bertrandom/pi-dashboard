// ===== Patternflow pattern =====
// Title:    Hypnotrail
// Author:   @Enerjoy
// Date:     2026-08-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @knobs Hue=0..1, Speed=0.1..4, Delay=0..1.1, Zoom=0.1..2
// @matrix 128x128
// Hypnotic Trail Vortex
// Persistent trail-buffer gir hver blob et fadende "spøkelsesspor" som følger bevegelsen
// Knob 1: Hue (variasjon innenfor rødt fargespekter, fra burgunder til oransje-rød)
// Knob 2: Speed
// Knob 3: Warp (kaos i banen + spor-lengde)
// Knob 4: Zoom (radius på banene, kan dekke hele skjermen ut til kantene)


export function setup(params) {
  params.timeAcc = 0;
  params.k1 = 0.3;
  params.k2 = 0.4;
  params.k3 = 0.4;
  params.k4 = 0.5;
  params.buffer = null;
  params.bufW = 0;
  params.bufH = 0;
}

export function update(dt, input, params) {
  if (input && input.knobValues) {
    params.k1 = input.knobValues[0];
    params.k2 = input.knobValues[1];
    params.k3 = input.knobValues[2];
    params.k4 = input.knobValues[3];
  }
  // Sanering: hvis dt er ugyldig (0/undefined/NaN på f.eks. første frame),
  // hopp over denne oppdateringen i stedet for å NaN-forgifte timeAcc permanent
  if (!Number.isFinite(dt) || dt <= 0) return;
  params.timeAcc += dt * (0.3 + params.k2 * 2.2);
}

export function draw(display, params, time) {
  const w = display.width;
  const h = display.height;
  const t = params.timeAcc;

  if (!params.buffer || params.bufW !== w || params.bufH !== h) {
    params.buffer = new Float32Array(w * h * 3);
    params.bufW = w;
    params.bufH = h;
  }
  const buf = params.buffer;

  const hueBase = params.k1;
  const chaos = params.k3;
  // Zoom-range utvidet slik at man ved høy knob-verdi kan la banene rekke
  // helt ut til skjermkantene, uavhengig av hvilken akse som er lengst
  const zoom = 0.25 + params.k4 * 1.55;
  const decay = 0.80 + chaos * 0.18;

  for (let i = 0; i < buf.length; i++) {
    buf[i] *= decay;
  }

  const cx = w / 2;
  const cy = h / 2;
  // Egen skala per akse (X mot bredde, Y mot høyde) i stedet for én skala
  // basert på Math.min(w,h). På en liggende 128x64-skjerm ga den gamle
  // løsningen bort halvparten av tilgjengelig breddeplass.
  const scaleX = (w / 2) * 0.9 * zoom;
  const scaleY = (h / 2) * 0.9 * zoom;
  const minRadius = Math.min(scaleX, scaleY) * 0.25;

  const numBlobs = 5;
  const sectors = 6;

  for (let i = 0; i < numBlobs; i++) {
    const phase = (i / numBlobs) * Math.PI * 2;

    const freqX = 2.0 + i * 0.3;
    const freqY = 3.0 + i * 0.2 + chaos * 1.5;
    const wobble = Math.sin(t * 1.7 + phase * 3.0) * chaos * 0.6;

    const ang = t * (0.6 + i * 0.05) + phase;
    let px = Math.cos(ang * freqX * 0.3 + wobble) * scaleX;
    let py = Math.sin(ang * freqY * 0.3 - wobble) * scaleY;

    const radialPulse = 1.0 + Math.sin(t * 1.3 + phase) * chaos * 0.35;
    px *= radialPulse;
    py *= radialPulse;

    const distFromCenter = Math.sqrt(px * px + py * py);
    if (distFromCenter < minRadius) {
      const factor = minRadius / (distFromCenter + 0.0001);
      px *= factor;
      py *= factor;
    }

    // Rød palett: hue holdes innenfor et smalt bånd rundt rødt (fra burgunder
    // via ren rød til oransje-rød). Knob 1 flytter senteret i dette båndet.
    const hueSpread = 0.07;
    const hueOffset = (i / numBlobs - 0.5) * hueSpread;
    let hue = (0.98 + hueBase * 0.10 + hueOffset) % 1.0;
    if (hue < 0) hue += 1.0;

    const sat = 0.75 + (i / numBlobs) * 0.2;
    const val = 0.9 + Math.sin(phase) * 0.1;

    const [r, g, b] = hsv2rgb(hue, sat, val);

    for (let s = 0; s < sectors; s++) {
      const segAngle = (Math.PI * 2 / sectors) * s;
      const cosA = Math.cos(segAngle);
      const sinA = Math.sin(segAngle);
      const mx = px * cosA - py * sinA;
      const my = px * sinA + py * cosA;

      splat(buf, w, h, cx + mx, cy + my, r, g, b, 2.2);
    }
  }

  for (let i = 0; i < buf.length; i++) {
    // Ekstra sikring: nullstill eventuelle NaN/negative verdier i stedet for
    // å la dem forbli i bufferet permanent (NaN overlever decay-multiplikasjon)
    if (!Number.isFinite(buf[i]) || buf[i] < 0) buf[i] = 0;
    else if (buf[i] > 255) buf[i] = 255;
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 3;
      display.setPixel(x, y, buf[idx], buf[idx + 1], buf[idx + 2]);
    }
  }
}

function splat(buf, w, h, cx, cy, r, g, b, radius) {
  const minX = Math.max(0, Math.floor(cx - radius));
  const maxX = Math.min(w - 1, Math.ceil(cx + radius));
  const minY = Math.max(0, Math.floor(cy - radius));
  const maxY = Math.min(h - 1, Math.ceil(cy + radius));

  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > radius) continue;
      const falloff = Math.pow(1.0 - dist / radius, 2.0);
      const idx = (y * w + x) * 3;
      buf[idx]     += r * falloff;
      buf[idx + 1] += g * falloff;
      buf[idx + 2] += b * falloff;
    }
  }
}

function hsv2rgb(h, s, v) {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const tt = v * (1 - (1 - f) * s);
  let r, g, b;
  switch (i % 6) {
    case 0: r = v; g = tt; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = tt; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = tt; g = p; b = v; break;
    case 5: r = v; g = p; b = q; break;
  }
  return [r * 255, g * 255, b * 255];
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
