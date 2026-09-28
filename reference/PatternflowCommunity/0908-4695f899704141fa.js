// ===== Patternflow pattern =====
// Title:    0908
// Author:   @engmung
// Date:     2026-09-08
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp oklchShort 0.231:#ff0066 0:#000000 0.629:#ffffff 0.309:#fb00ff
// @knobs Activity=0.2..58.8, Agility=0.5..15, Density=12..46, Persistence=0.88..0.98
// @matrix 64x128


// Topological Particle-Wake Defect Engine


// critical knob = Activity, turning it crosses ballistic defect drifts ↔ frantic annihilation turbulence

export function setup(params) {
  const W = 64, H = 128;
  params.W = W;
  params.H = H;
  params.t = 0;

  params.trail = new Float32Array(W * H);

  // Deterministic RNG
  let seed = 4242;
  function rnd() {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  }
  params.rnd = rnd;

  // Max potential defects pool
  const maxDefects = 48;
  params.defects = [];

  for (let i = 0; i < maxDefects; i++) {
    params.defects.push({
      x: rnd() * W,
      y: rnd() * H,
      vx: 0,
      vy: 0,
      charge: i % 2 === 0 ? 0.5 : -0.5, // Half comets (+0.5), half trefoils (-0.5)
      orientation: rnd() * Math.PI * 2,
      active: true
    });
  }

  // Pre-fill history buffer so the field starts in full activity
  for (let i = 0; i < 60; i++) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = y * W + x;
        params.trail[idx] *= 0.95;
      }
    }
  }
}

export function update(dt, input, params) {
  // Knobs mapping: 0: Activity, 1: Agility, 2: Density, 3: Persistence
  const knobs = input.knobValues;
  const activity = knobs[0];
  const agility = knobs[1];
  const targetCount = Math.floor(knobs[2]);
  const persistence = knobs[3];

  const W = params.W;
  const H = params.H;
  const dtClamped = Math.min(dt, 0.1);

  params.t += dtClamped;

  const defects = params.defects;

  // Enable/disable active defect population according to Density knob
  for (let i = 0; i < defects.length; i++) {
    defects[i].active = i < targetCount;
  }

  // Pair interactions and movement update
  for (let i = 0; i < targetCount; i++) {
    const d1 = defects[i];
    if (!d1.active) continue;

    let fx = 0, fy = 0;

    // Active self-propulsion for +1/2 comet defects along their polarization direction
    if (d1.charge === 0.5) {
      const vProp = 12.0 * activity;
      fx += Math.cos(d1.orientation) * vProp;
      fy += Math.sin(d1.orientation) * vProp;
    }

    // Inter-defect forces (like-charge repels, opposite attracts)
    for (let j = 0; j < targetCount; j++) {
      if (i === j) continue;
      const d2 = defects[j];
      if (!d2.active) continue;

      let dx = d2.x - d1.x;
      let dy = d2.y - d1.y;

      // Periodic boundary handling
      if (dx > W / 2) dx -= W;
      if (dx < -W / 2) dx += W;
      if (dy > H / 2) dy -= H;
      if (dy < -H / 2) dy += H;

      const distSq = dx * dx + dy * dy + 1.0;
      const dist = Math.sqrt(distSq);

      if (dist < 20.0) {
        // Topological charge coupling
        const force = (d1.charge * d2.charge > 0 ? -15.0 : 25.0) / distSq;
        fx += (dx / dist) * force * agility;
        fy += (dy / dist) * force * agility;

        // Annihilation check when opposite charges touch
        if (dist < 2.5 && d1.charge !== d2.charge) {
          // Pair annihilation: re-spawn both at new distant locations
          d1.x = params.rnd() * W;
          d1.y = params.rnd() * H;
          d1.orientation = params.rnd() * Math.PI * 2;

          d2.x = params.rnd() * W;
          d2.y = params.rnd() * H;
          d2.orientation = params.rnd() * Math.PI * 2;
        }
      }
    }

    // Velocity integration with damping
    d1.vx = d1.vx * 0.8 + fx * dtClamped * 2.0;
    d1.vy = d1.vy * 0.8 + fy * dtClamped * 2.0;

    // Angular rotational diffusion for comets
    d1.orientation += (params.rnd() - 0.5) * 2.0 * agility * dtClamped;

    // Position integration with wrap-around
    d1.x = (d1.x + d1.vx * dtClamped + W) % W;
    d1.y = (d1.y + d1.vy * dtClamped + H) % H;

    // Sanity recovery
    if (!isFinite(d1.x) || !isFinite(d1.y)) {
      d1.x = params.rnd() * W;
      d1.y = params.rnd() * H;
      d1.vx = 0;
      d1.vy = 0;
    }
  }

  // Field dissipation and trail injection
  const trail = params.trail;
  const decay = Math.pow(persistence, dtClamped * 30.0);

  for (let idx = 0; idx < W * H; idx++) {
    trail[idx] *= decay;
  }

  // Deposit bright orientational comet wakes into history buffer
  for (let i = 0; i < targetCount; i++) {
    const d = defects[i];
    if (!d.active) continue;

    const px = Math.floor(d.x);
    const py = Math.floor(d.y);

    // Deposit charge-dependent footprint (comets leave elongated tail wakes)
    const radius = d.charge === 0.5 ? 2 : 1;

    for (let ry = -radius; ry <= radius; ry++) {
      for (let rx = -radius; rx <= radius; rx++) {
        const gx = (px + rx + W) % W;
        const gy = (py + ry + H) % H;
        const idx = gy * W + gx;

        const intensity = d.charge === 0.5 ? 0.9 : 0.4;
        trail[idx] = Math.min(1.0, trail[idx] + intensity * (1.0 - (rx*rx + ry*ry)/(radius*radius + 1)));
      }
    }
  }
}

export function draw(display, params, time) {
  const W = display.width;
  const H = display.height;
  const trail = params.trail;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = y * W + x;
      const v = Math.min(1.0, Math.max(0.0, trail[idx]));
      
      // Tone curve enhancement for crisp comet edges
      const smoothVal = v * v * (3.0 - 2.0 * v);
      display.setValue(x, y, smoothVal);
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
