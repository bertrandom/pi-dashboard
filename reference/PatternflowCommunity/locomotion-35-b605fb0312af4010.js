// ===== Patternflow pattern =====
// Title:    Locomotion 35
// Author:   @engmung
// Date:     2026-08-18
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp linear 0.003:#000000 0.371:#ffffff 0.67:#ffffff 0.855:#ebebeb 0.803:#000000 0.162:#1a1a1a
// @knobs Speed=0.2..3, Stride=0.4..2.2, Damping=0..1, Mode=0..5
// @matrix 64x128




export function setup(params) {
  params.t = 0;
}

// Knob 1 (Speed): Film transport motor speed (0.2 to 3)
// Knob 2 (Stride): Motion amplitude, stride length & kinematic scale (0.4 to 2.2)
// Knob 3 (Damping): Pulldown motion profile (0.0 = Continuous linear glide, 1.0 = 24fps Geneva claw snap)
// Knob 4 (Mode): 0=Human, 1=Horse (Stable Gallop), 2=Falcon, 3=Medusa, 4=Radial Engine, 5=4D Tesseract (0 to 5)
export function update(dt, input, params) {
  params.knobs = input.knobValues;
  params.t += dt * params.knobs[0];
}

// Squared distance from point (px, py) to segment (ax, ay)-(bx, by)
function segDistSq(px, py, ax, ay, bx, by) {
  const pax = px - ax;
  const pay = py - ay;
  const bax = bx - ax;
  const bay = by - ay;
  const lenSq = bax * bax + bay * bay;
  if (lenSq < 1e-6) return pax * pax + pay * pay;
  const h = Math.max(0.0, Math.min(1.0, (pax * bax + pay * bay) / lenSq));
  const dx = pax - bax * h;
  const dy = pay - bay * h;
  return dx * dx + dy * dy;
}

// Point in 2D triangle test
function inTriangle(px, py, x1, y1, x2, y2, x3, y3) {
  const d1 = (px - x2) * (y1 - y2) - (x1 - x2) * (py - y2);
  const d2 = (px - x3) * (y2 - y3) - (x2 - x3) * (py - y3);
  const d3 = (px - x1) * (y3 - y1) - (x3 - x1) * (py - y1);
  const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0);
  const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0);
  return !(hasNeg && hasPos);
}

// ==========================================
// Mode 0: Human Walk Kinematics
// ==========================================
function drawHuman(fcx, fcy, phi, stride) {
  const bob = -Math.cos(phi * 2.0) * 0.022 * stride;
  const hipX = -0.01;
  const hipY = 0.02 + bob;
  const neckX = hipX + 0.04;
  const neckY = hipY - 0.20;
  const headX = neckX + 0.03;
  const headY = neckY - 0.07;

  function leg(alpha) {
    const isStance = ((alpha % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) < Math.PI;
    const th = Math.cos(alpha) * 0.52 * stride;
    const kn = isStance ? 0.08 + Math.sin(alpha) * 0.12 * stride : 0.08 + Math.pow(Math.sin(alpha - Math.PI), 1.3) * 1.25 * stride;
    const sh = th - kn;
    const kx = hipX + Math.sin(th) * 0.16;
    const ky = hipY + Math.cos(th) * 0.16;
    const ax = kx + Math.sin(sh) * 0.15;
    const ay = ky + Math.cos(sh) * 0.15;
    const ft = isStance ? 0.35 : sh + 0.45;
    const tx = ax + Math.sin(ft) * 0.055;
    const ty = ay + Math.cos(ft) * 0.02;
    return { k: { x: kx, y: ky }, a: { x: ax, y: ay }, t: { x: tx, y: ty } };
  }

  function arm(alpha) {
    const shX = neckX;
    const shY = neckY + 0.03;
    const am = -Math.cos(alpha) * 0.45 * stride;
    const el = 0.35 + Math.max(0.0, Math.cos(alpha)) * 0.4 * stride;
    const ex = shX + Math.sin(am) * 0.12;
    const ey = shY + Math.cos(am) * 0.12;
    const hx = ex + Math.sin(am + el) * 0.11;
    const hy = ey + Math.cos(am + el) * 0.11;
    return { e: { x: ex, y: ey }, h: { x: hx, y: hy } };
  }

  const l1 = leg(phi), l2 = leg(phi + Math.PI);
  const a1 = arm(phi), a2 = arm(phi + Math.PI);
  let val = 0.20;

  // Far Limbs (Tier 3)
  if (segDistSq(fcx, fcy, hipX, hipY, l2.k.x, l2.k.y) < 0.0020 ||
      segDistSq(fcx, fcy, l2.k.x, l2.k.y, l2.a.x, l2.a.y) < 0.0016 ||
      segDistSq(fcx, fcy, l2.a.x, l2.a.y, l2.t.x, l2.t.y) < 0.0012 ||
      segDistSq(fcx, fcy, neckX, neckY + 0.03, a2.e.x, a2.e.y) < 0.0012 ||
      segDistSq(fcx, fcy, a2.e.x, a2.e.y, a2.h.x, a2.h.y) < 0.0011) {
    val = 0.60;
  }

  // Near Limbs & Torso (Tier 4)
  if (segDistSq(fcx, fcy, neckX, neckY, hipX, hipY) < 0.0042 ||
      segDistSq(fcx, fcy, hipX, hipY, l1.k.x, l1.k.y) < 0.0026 ||
      segDistSq(fcx, fcy, l1.k.x, l1.k.y, l1.a.x, l1.a.y) < 0.0020 ||
      segDistSq(fcx, fcy, l1.a.x, l1.a.y, l1.t.x, l1.t.y) < 0.0015 ||
      segDistSq(fcx, fcy, neckX, neckY + 0.03, a1.e.x, a1.e.y) < 0.0016 ||
      segDistSq(fcx, fcy, a1.e.x, a1.e.y, a1.h.x, a1.h.y) < 0.0014) {
    val = 0.85;
  }

  const dHead = Math.sqrt((fcx - headX) * (fcx - headX) + (fcy - headY) * (fcy - headY));
  if (dHead < 0.052) val = dHead < 0.022 ? 1.0 : 0.85;
  return val;
}

// ==========================================
// Mode 1: Anatomical Galloping Horse (Stable Horizontal Spine)
// ==========================================
function drawHorse(fcx, fcy, phi, stride) {
  const bob = -Math.cos(phi) * 0.016 * stride;
  const pitch = Math.sin(phi) * 0.032 * stride;

  const cx = 0.09, cy = -0.01 + bob - pitch * 0.4;
  const hx = -0.13, hy = 0.01 + bob + pitch * 0.4;

  const neckBaseX = cx + 0.03, neckBaseY = cy - 0.04;
  const pollX = cx + 0.11, pollY = cy - 0.16;
  const muzzleX = pollX + 0.09, muzzleY = pollY + 0.05;
  const earX = pollX - 0.02, earY = pollY - 0.05;

  // Forelegs
  const fa1 = Math.cos(phi) * 0.65 * stride;
  const f1_fold = (Math.sin(phi) > 0 ? Math.sin(phi) * 0.85 * stride : -0.12);
  const f1_shX = cx + 0.02, f1_shY = cy + 0.04;
  const f1_knX = f1_shX + Math.sin(fa1) * 0.11;
  const f1_knY = f1_shY + Math.cos(fa1) * 0.11;
  const f1_hoofX = f1_knX + Math.sin(fa1 - f1_fold) * 0.13;
  const f1_hoofY = f1_knY + Math.cos(fa1 - f1_fold) * 0.13;

  const fa2 = Math.cos(phi + 0.6) * 0.65 * stride;
  const f2_fold = (Math.sin(phi + 0.6) > 0 ? Math.sin(phi + 0.6) * 0.85 * stride : -0.12);
  const f2_shX = cx + 0.02, f2_shY = cy + 0.04;
  const f2_knX = f2_shX + Math.sin(fa2) * 0.12;
  const f2_knY = f2_shY + Math.cos(fa2) * 0.12;
  const f2_hoofX = f2_knX + Math.sin(fa2 - f2_fold) * 0.13;
  const f2_hoofY = f2_knY + Math.cos(fa2 - f2_fold) * 0.13;

  // Hindlegs
  const ha1 = -Math.cos(phi + 0.3) * 0.70 * stride;
  const h1_flex = (Math.sin(phi + 0.3) < 0 ? Math.sin(phi + 0.3) * 0.80 * stride : 0.15);
  const h1_stX = hx, h1_stY = hy + 0.04;
  const h1_hockX = h1_stX + Math.sin(ha1) * 0.12;
  const h1_hockY = h1_stY + Math.cos(ha1) * 0.12;
  const h1_hoofX = h1_hockX + Math.sin(ha1 + h1_flex) * 0.14;
  const h1_hoofY = h1_hockY + Math.cos(ha1 + h1_flex) * 0.14;

  const ha2 = -Math.cos(phi + 0.9) * 0.70 * stride;
  const h2_flex = (Math.sin(phi + 0.9) < 0 ? Math.sin(phi + 0.9) * 0.80 * stride : 0.15);
  const h2_stX = hx, h2_stY = hy + 0.04;
  const h2_hockX = h2_stX + Math.sin(ha2) * 0.12;
  const h2_hockY = h2_stY + Math.cos(ha2) * 0.12;
  const h2_hoofX = h2_hockX + Math.sin(ha2 + h2_flex) * 0.14;
  const h2_hoofY = h2_hockY + Math.cos(ha2 + h2_flex) * 0.14;

  const tailTipX = hx - 0.16 - Math.cos(phi) * 0.02 * stride;
  const tailTipY = hy + 0.05 + Math.sin(phi * 2.0) * 0.025;

  let val = 0.20;

  // Far Limbs (Tier 3)
  if (segDistSq(fcx, fcy, f2_shX, f2_shY, f2_knX, f2_knY) < 0.0030 ||
      segDistSq(fcx, fcy, f2_knX, f2_knY, f2_hoofX, f2_hoofY) < 0.0020 ||
      segDistSq(fcx, fcy, h2_stX, h2_stY, h2_hockX, h2_hockY) < 0.0036 ||
      segDistSq(fcx, fcy, h2_hockX, h2_hockY, h2_hoofX, h2_hoofY) < 0.0022) {
    val = 0.60;
  }

  // Torso & Near Limbs (Tier 4)
  const dChest = Math.sqrt((fcx - cx) * (fcx - cx) + (fcy - cy) * (fcy - cy));
  const dHaunch = Math.sqrt((fcx - hx) * (fcx - hx) + (fcy - hy) * (fcy - hy));
  const dBarrel = segDistSq(fcx, fcy, cx, cy, hx, hy);
  const dNeck = segDistSq(fcx, fcy, neckBaseX, neckBaseY, pollX, pollY);
  const dHead = segDistSq(fcx, fcy, pollX, pollY, muzzleX, muzzleY);
  const dEar = segDistSq(fcx, fcy, pollX, pollY, earX, earY);
  const dTail = segDistSq(fcx, fcy, hx, hy, tailTipX, tailTipY);

  const dF1_thigh = segDistSq(fcx, fcy, f1_shX, f1_shY, f1_knX, f1_knY);
  const dF1_shin = segDistSq(fcx, fcy, f1_knX, f1_knY, f1_hoofX, f1_hoofY);
  const dH1_thigh = segDistSq(fcx, fcy, h1_stX, h1_stY, h1_hockX, h1_hockY);
  const dH1_shin = segDistSq(fcx, fcy, h1_hockX, h1_hockY, h1_hoofX, h1_hoofY);

  if (dChest < 0.088 || dHaunch < 0.078 || dBarrel < 0.0055 ||
      dNeck < 0.0050 || dHead < 0.0032 || dEar < 0.0012 || dTail < 0.0025 ||
      dF1_thigh < 0.0040 || dF1_shin < 0.0022 ||
      dH1_thigh < 0.0048 || dH1_shin < 0.0024) {
    val = 0.85;
  }

  const dMuzzle = Math.sqrt((fcx - muzzleX) * (fcx - muzzleX) + (fcy - muzzleY) * (fcy - muzzleY));
  const dEye = Math.sqrt((fcx - (pollX + 0.04)) * (fcx - (pollX + 0.04)) + (fcy - (pollY + 0.01)) * (fcy - (pollY + 0.01)));
  if (dMuzzle < 0.028 || dEye < 0.018) val = 1.0;

  return val;
}

// ==========================================
// Mode 2: Aerodynamic Soaring Falcon
// ==========================================
function drawFalcon(fcx, fcy, phi, stride) {
  const flap = Math.sin(phi);
  const bodyBob = -flap * 0.035 * stride;

  const bx = 0.0;
  const by = bodyBob;
  const beakX = bx + 0.20;
  const beakY = by - 0.02;
  const tailBaseX = bx - 0.12;
  const tailBaseY = by + 0.02;

  const wingFoldX = flap > 0 ? -0.04 * stride : 0.02 * stride;
  const wingElbowY = flap * 0.26 * stride;
  const wingTipY = flap * 0.44 * stride + (flap < 0 ? -0.08 : 0.06);

  // Top Wing
  const w1_rootX = bx + 0.03, w1_rootY = by - 0.04;
  const w1_midX = bx - 0.02 + wingFoldX, w1_midY = by - 0.20 + wingElbowY * 0.6;
  const w1_tipX = bx - 0.14 + wingFoldX * 1.5, w1_tipY = by - 0.40 + wingTipY;
  const w1_trailX = bx - 0.10, w1_trailY = by - 0.18 + wingElbowY * 0.4;

  // Bottom Wing
  const w2_rootX = bx + 0.03, w2_rootY = by + 0.04;
  const w2_midX = bx - 0.02 + wingFoldX, w2_midY = by + 0.20 - wingElbowY * 0.6;
  const w2_tipX = bx - 0.14 + wingFoldX * 1.5, w2_tipY = by + 0.40 - wingTipY;
  const w2_trailX = bx - 0.10, w2_trailY = by + 0.18 - wingElbowY * 0.4;

  const t1X = bx - 0.26, t1Y = by - 0.08;
  const t2X = bx - 0.28, t2Y = by;
  const t3X = bx - 0.26, t3Y = by + 0.08;

  let val = 0.20;

  // Tail Fan (Tier 3)
  if (inTriangle(fcx, fcy, tailBaseX, tailBaseY, t1X, t1Y, t3X, t3Y) ||
      segDistSq(fcx, fcy, tailBaseX, tailBaseY, t2X, t2Y) < 0.0035) {
    val = 0.60;
  }

  // Solid Filled Wings (Tier 4)
  const inWing1Inner = inTriangle(fcx, fcy, w1_rootX, w1_rootY, w1_midX, w1_midY, w1_trailX, w1_trailY);
  const inWing1Outer = inTriangle(fcx, fcy, w1_midX, w1_midY, w1_tipX, w1_tipY, w1_trailX, w1_trailY);
  const inWing2Inner = inTriangle(fcx, fcy, w2_rootX, w2_rootY, w2_midX, w2_midY, w2_trailX, w2_trailY);
  const inWing2Outer = inTriangle(fcx, fcy, w2_midX, w2_midY, w2_tipX, w2_tipY, w2_trailX, w2_trailY);

  const dW1_edge = segDistSq(fcx, fcy, w1_rootX, w1_rootY, w1_midX, w1_midY) < 0.0035 ||
                   segDistSq(fcx, fcy, w1_midX, w1_midY, w1_tipX, w1_tipY) < 0.0028;
  const dW2_edge = segDistSq(fcx, fcy, w2_rootX, w2_rootY, w2_midX, w2_midY) < 0.0035 ||
                   segDistSq(fcx, fcy, w2_midX, w2_midY, w2_tipX, w2_tipY) < 0.0028;

  const dTorso = segDistSq(fcx, fcy, tailBaseX, tailBaseY, bx + 0.12, by);
  const dHead = Math.sqrt((fcx - (bx + 0.12)) * (fcx - (bx + 0.12)) + (fcy - by) * (fcy - by));
  const dBeak = segDistSq(fcx, fcy, bx + 0.12, by, beakX, beakY);

  if (inWing1Inner || inWing1Outer || inWing2Inner || inWing2Outer ||
      dW1_edge || dW2_edge || dTorso < 0.0065 || dHead < 0.055 || dBeak < 0.0025) {
    val = 0.85;
  }

  const dEye = Math.sqrt((fcx - (bx + 0.14)) * (fcx - (bx + 0.14)) + (fcy - (by - 0.015)) * (fcy - (by - 0.015)));
  const dCore = Math.sqrt((fcx - bx) * (fcx - bx) + (fcy - by) * (fcy - by));
  if (dEye < 0.020 || dCore < 0.035) val = 1.0;

  return val;
}

// ==========================================
// Mode 3: Bioluminescent Medusa (Jellyfish)
// ==========================================
function drawMedusa(fcx, fcy, phi, stride) {
  const contract = Math.sin(phi);
  const bellWidth = 0.28 - contract * 0.08 * stride;
  const bellHeight = 0.18 + contract * 0.06 * stride;
  const bellY = -0.12 - contract * 0.04 * stride;

  let val = 0.20;

  for (let i = -2; i <= 3; i++) {
    const rootX = (i - 0.5) * (bellWidth * 0.32);
    const rootY = bellY + bellHeight * 0.3;
    const wavePhase = phi - (fcy - rootY) * 6.0;
    const targetX = rootX + Math.sin(wavePhase + i * 0.8) * (0.04 * stride);

    if (fcy > rootY && fcy < rootY + 0.45) {
      const dTen = Math.abs(fcx - targetX);
      if (dTen < 0.022) {
        val = Math.max(val, 0.60);
      }
    }
  }

  const normX = fcx / bellWidth;
  const normY = (fcy - bellY) / bellHeight;
  const domeDist = normX * normX + normY * normY;

  if (domeDist < 1.0 && fcy < bellY + bellHeight * 0.4) {
    const rim = Math.abs(domeDist - 0.9);
    val = rim < 0.2 ? 0.85 : 0.45;
  }

  const dInner = Math.sqrt(fcx * fcx + (fcy - bellY) * (fcy - bellY));
  if (dInner < 0.06) val = 1.0;

  return val;
}

// ==========================================
// Mode 4: 4-Cylinder Radial Engine
// ==========================================
function drawRadialEngine(fcx, fcy, phi, stride) {
  const crankR = 0.10 * stride;
  const rodLen = 0.22 * stride;
  const crankX = Math.cos(phi) * crankR;
  const crankY = Math.sin(phi) * crankR;

  let val = 0.20;

  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) * 0.5;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    const proj = crankX * cosA + crankY * sinA;
    const perp = -crankX * sinA + crankY * cosA;
    const pDist = proj + Math.sqrt(Math.max(0.0, rodLen * rodLen - perp * perp));

    const pistX = cosA * pDist;
    const pistY = sinA * pDist;

    const dChamber = segDistSq(fcx, fcy, cosA * 0.12, sinA * 0.12, cosA * 0.38, sinA * 0.38);
    if (dChamber < 0.0018) val = Math.max(val, 0.60);

    const dRod = segDistSq(fcx, fcy, crankX, crankY, pistX, pistY);
    if (dRod < 0.0015) val = Math.max(val, 0.85);

    const dPist = Math.sqrt((fcx - pistX) * (fcx - pistX) + (fcy - pistY) * (fcy - pistY));
    if (dPist < 0.045) val = Math.max(val, 0.85);

    if (pDist > rodLen + crankR - 0.02 && dPist < 0.03) {
      val = 1.0;
    }
  }

  const dHub = Math.sqrt((fcx - crankX) * (fcx - crankX) + (fcy - crankY) * (fcy - crankY));
  if (dHub < 0.035) val = 1.0;

  return val;
}

// ==========================================
// Mode 5: 4D Hypercube Tesseract Projection
// ==========================================
function drawTesseract(fcx, fcy, phi, stride) {
  let val = 0.20;

  const rotXW = phi * 1.2;
  const rotYZ = phi * 0.8;
  const cos1 = Math.cos(rotXW), sin1 = Math.sin(rotXW);
  const cos2 = Math.cos(rotYZ), sin2 = Math.sin(rotYZ);

  const pts = [];
  for (let i = 0; i < 16; i++) {
    let x = (i & 1 ? 1 : -1) * 0.65;
    let y = (i & 2 ? 1 : -1) * 0.65;
    let z = (i & 4 ? 1 : -1) * 0.65;
    let w = (i & 8 ? 1 : -1) * 0.65;

    const rx = x * cos1 - w * sin1;
    const rw = x * sin1 + w * cos1;
    const ry = y * cos2 - z * sin2;
    const rz = y * sin2 + z * cos2;

    const distance4D = 2.4;
    const pScale = (1.0 / (distance4D - rw)) * 0.65 * stride;
    pts.push({ x: rx * pScale, y: ry * pScale });
  }

  for (let i = 0; i < 16; i++) {
    for (let b = 1; b <= 8; b <<= 1) {
      const j = i ^ b;
      if (i < j) {
        const dEdge = segDistSq(fcx, fcy, pts[i].x, pts[i].y, pts[j].x, pts[j].y);
        if (dEdge < 0.0016) {
          val = Math.max(val, (b === 8 ? 0.60 : 0.85));
        }
      }
    }
  }

  for (let i = 0; i < 16; i++) {
    const dNode = Math.sqrt((fcx - pts[i].x) * (fcx - pts[i].x) + (fcy - pts[i].y) * (fcy - pts[i].y));
    if (dNode < 0.026) val = 1.0;
  }

  return val;
}

export function draw(display, params, time) {
  const w = display.width;
  const h = display.height;
  const t = params.t;
  const [, stride, damping, mode] = params.knobs;

  const halfW = w * 0.5;
  const halfH = h * 0.5;
  const scale = halfW; // Isotropic 1:1 square coordinates

  const frameHeight = 1.15;
  const numFramesPerCycle = 16;
  const curMode = Math.min(5, Math.max(0, Math.floor(mode + 0.05)));

  // ==========================================
  // Zero-Drift Transport Engine (Unified Periodic Phase)
  // ==========================================
  const frameRate = 2.4;
  const totalProgress = t * frameRate;
  const frameBase = Math.floor(totalProgress);
  const u = totalProgress - frameBase; // Exactly 0.0 to 1.0 inside current frame

  // Snap Damping Profile (Pulldown happens in first 25% of cycle, rests for remaining 75%)
  const pullDuration = 0.25;
  let snapU = 1.0;
  if (u < pullDuration) {
    const p = u / pullDuration;
    snapU = p * p * (3.0 - 2.0 * p); // Smoothstep easing
  }

  // Pure intra-frame blending: Zero frame skipping or drift regardless of running time
  const uEff = u * (1.0 - damping) + snapU * damping;
  const scrollY = (frameBase + uEff) * frameHeight;

  // Mechanical gate judder on claw snap
  const judderPulse = (u < pullDuration ? Math.sin((u / pullDuration) * Math.PI) : 0.0);
  const judderY = judderPulse * 0.025 * damping;

  for (let y = 0; y < h; y++) {
    const ny = (y - halfH) / scale + judderY;
    for (let x = 0; x < w; x++) {
      const nx = (x - halfW) / scale;
      const absX = Math.abs(nx);

      let val = 0.0; // Tier 0: Outer dark void

      // ==========================================
      // 1. Symmetrical 35mm Celluloid Strip
      // ==========================================
      if (absX < 0.94) {
        val = 0.20; // Tier 1: Pure celluloid base

        // Guide Rails
        if (Math.abs(absX - 0.90) < 0.018 || Math.abs(absX - 0.62) < 0.018) {
          val = 0.45; // Tier 2: Guide rail border
        }

        // ==========================================
        // 2. Symmetrical Perforations (Sprocket Holes)
        // ==========================================
        if (absX > 0.67 && absX < 0.85) {
          const sprocPitch = 0.2875;
          const sy = Math.abs((ny + scrollY) % sprocPitch - sprocPitch * 0.5);
          const sx = Math.abs(absX - 0.76);

          const dHoleX = Math.max(0.0, sx - 0.045);
          const dHoleY = Math.max(0.0, sy - 0.065);
          const dHole = Math.sqrt(dHoleX * dHoleX + dHoleY * dHoleY);

          if (dHole < 0.025) {
            val = 0.0; // Tier 0: Hollow cutout
          } else {
            val = 0.45; // Tier 2: Margin border
          }
        }

        // ==========================================
        // 3. Central Picture Aperture (Discrete 6-Mode Subject Engine)
        // ==========================================
        if (absX < 0.60) {
          const frameRelY = (ny + scrollY) % frameHeight;
          const frameNum = Math.floor((ny + scrollY) / frameHeight);

          // Black Frame Dividing Line
          const barThickness = 0.06 + damping * 0.025;
          if (frameRelY < barThickness || frameRelY > frameHeight - barThickness) {
            val = 0.0; // Tier 0: Frame line
          } else {
            const fcx = nx;
            const fcy = frameRelY - frameHeight * 0.5;

            // Discrete pose tied directly to physical frame index
            const framePhase = (frameNum * (Math.PI * 2.0)) / numFramesPerCycle;

            let frameVal = 0.20;

            if (curMode === 0) {
              frameVal = drawHuman(fcx, fcy, framePhase, stride);
            } else if (curMode === 1) {
              frameVal = drawHorse(fcx, fcy, framePhase, stride);
            } else if (curMode === 2) {
              frameVal = drawFalcon(fcx, fcy, framePhase, stride);
            } else if (curMode === 3) {
              frameVal = drawMedusa(fcx, fcy, framePhase, stride);
            } else if (curMode === 4) {
              frameVal = drawRadialEngine(fcx, fcy, framePhase, stride);
            } else {
              frameVal = drawTesseract(fcx, fcy, framePhase, stride);
            }

            val = frameVal;
          }
        }
      }

      display.setValue(x, y, Math.min(1.0, Math.max(0.0, val)));
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
