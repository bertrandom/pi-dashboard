// ===== Patternflow pattern =====
// Title:    Starlight Jester Ribbon
// Author:   @martinnlopez
// Date:     2026-08-14
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @knobs Speed=1..5, Twinkle=0.1..10, DiaWidth=2..10, DiaHeight=0..1
// @matrix 64x128

//
// Replicates the reference vector artwork: a black star-flecked hood over a
// white polka-dotted body, wrapped by a smooth, looping Catmull-Rom curved
// pink/blue diamond ribbon. Stars spin and twinkle, black dots bob gently,
// and the diamond pattern flows slowly along the ribbon curve while Knob 3
// and Knob 4 independently adjust diamond width and height.
//
// Knob 1 (Speed)     - Star rotation and inner ribbon pattern movement speed
// Knob 2 (Twinkle)   - Star twinkle and dot bounce speed
// Knob 3 (DiaWidth)  - Width of the blue/pink diamonds
// Knob 4 (DiaHeight) - Height of the blue/pink diamonds
// Push Knob 1  -> restart the animation
// Hold Knob 2  -> freeze everything

const PINK = [241, 147, 189];
const BLUE = [43, 98, 174];

function mod(n, m) {
  return ((n % m) + m) % m;
}

// Hood silhouette edge at vertical position v (0..1)
function hoodEdgeAt(v) {
  const topEdge = 0.10;
  const bottomEdge = 0.58;
  if (v < topEdge) return 1.0;
  if (v > bottomEdge) return 0.0;
  return 1.0 - (v - topEdge) / (bottomEdge - topEdge);
}

// 5-pointed star mask
function starMask(dx, dy, outerR, innerR) {
  const r = Math.sqrt(dx * dx + dy * dy);
  if (r > outerR) return false;
  let theta = Math.atan2(dy, dx);
  if (theta < 0) theta += Math.PI * 2;
  const seg = (Math.PI * 2) / 5;
  let a = theta % seg;
  if (a > seg / 2) a = seg - a;
  const tpt = a / (seg / 2);
  const boundaryR = outerR + (innerR - outerR) * tpt;
  return r <= boundaryR;
}

// Builds smooth Catmull-Rom ribbon path matching the vector reference curve
function buildRibbonPath(params, W, H) {
  const halfWidth = 8.0;
  
  // Waypoints matching the vector art: bottom-left sweep -> right side rise -> top arch -> left leg turn
  const controlPts = [
    { u: 0.00, v: 0.65 }, // ghost start
    { u: 0.04, v: 0.72 }, // start tip
    { u: 0.12, v: 0.78 },
    { u: 0.22, v: 0.55 },
    { u: 0.32, v: 0.28 },
    { u: 0.50, v: 0.10 }, // top arch peak
    { u: 0.70, v: 0.12 },
    { u: 0.88, v: 0.28 },
    { u: 0.94, v: 0.50 },
    { u: 0.82, v: 0.72 },
    { u: 0.55, v: 0.82 },
    { u: 0.30, v: 0.90 },
    { u: 0.12, v: 0.98 }, // end tip
    { u: 0.05, v: 1.05 }  // ghost end
  ];

  const waypoints = [];
  const stepsPerSeg = 12;

  for (let i = 1; i < controlPts.length - 2; i++) {
    const p0 = controlPts[i - 1];
    const p1 = controlPts[i];
    const p2 = controlPts[i + 1];
    const p3 = controlPts[i + 2];

    for (let s = 0; s < stepsPerSeg; s++) {
      const t = s / stepsPerSeg;
      const t2 = t * t;
      const t3 = t2 * t;

      const x = 0.5 * (
        (2 * p1.u) +
        (-p0.u + p2.u) * t +
        (2 * p0.u - 5 * p1.u + 4 * p2.u - p3.u) * t2 +
        (-p0.u + 3 * p1.u - 3 * p2.u + p3.u) * t3
      ) * W;

      const y = 0.5 * (
        (2 * p1.v) +
        (-p0.v + p2.v) * t +
        (2 * p0.v - 5 * p1.v + 4 * p2.v - p3.v) * t2 +
        (-p0.v + 3 * p1.v - 3 * p2.v + p3.v) * t3
      ) * H;

      waypoints.push({ x: x, y: y });
    }
  }

  // Last point
  const last = controlPts[controlPts.length - 2];
  waypoints.push({ x: last.u * W, y: last.v * H });

  // Pre-calculate line segments and bounding boxes for fast per-pixel projection
  params.segments = [];
  let accumLen = 0;
  const pad = halfWidth + 2.0;

  for (let i = 0; i < waypoints.length - 1; i++) {
    const ax = waypoints[i].x;
    const ay = waypoints[i].y;
    const bx = waypoints[i + 1].x;
    const by = waypoints[i + 1].y;

    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    if (lenSq < 1e-5) continue;

    const len = Math.sqrt(lenSq);

    params.segments.push({
      ax: ax, ay: ay,
      bx: bx, by: by,
      dx: dx, dy: dy,
      len: len,
      invLenSq: 1.0 / lenSq,
      sA: accumLen,
      minX: Math.floor(Math.min(ax, bx) - pad),
      maxX: Math.ceil(Math.max(ax, bx) + pad),
      minY: Math.floor(Math.min(ay, by) - pad),
      maxY: Math.ceil(Math.max(ay, by) + pad)
    });

    accumLen += len;
  }

  params.lastW = W;
  params.lastH = H;
}

export function setup(params) {
  params.time = 0;
  params.speed = 0.5;
  params.twinkle = 1.0;
  params.diaWidth = 8;
  params.diaHeight = 10;
  params.segments = [];
  params.lastW = 0;
  params.lastH = 0;

  // Stars across hood
  params.stars = [];
  for (let i = 0; i < 22; i++) {
    const vy = 0.02 + Math.random() * 0.48;
    const maxU = Math.max(hoodEdgeAt(vy) - 0.05, 0.06);
    const u = 0.02 + Math.random() * maxU;
    params.stars.push({
      u: u, v: vy,
      outerR: 3 + Math.random() * 3.5,
      angle: Math.random() * Math.PI * 2,
      rotSpeed: (0.3 + Math.random() * 0.6) * (Math.random() < 0.5 ? -1 : 1),
      twinklePhase: Math.random() * Math.PI * 2,
      twinkleMul: 0.7 + Math.random() * 0.8
    });
  }

  // Polka dots on body
  const dotSpecs = [
    { u: 0.62, v: 0.32, r: 7 },
    { u: 0.80, v: 0.44, r: 6 },
    { u: 0.90, v: 0.20, r: 4 },
    { u: 0.25, v: 0.55, r: 4 },
    { u: 0.18, v: 0.72, r: 3.5 },
    { u: 0.50, v: 0.62, r: 4 },
    { u: 0.72, v: 0.58, r: 4.5 },
    { u: 0.85, v: 0.68, r: 4 },
    { u: 0.35, v: 0.80, r: 4 },
    { u: 0.60, v: 0.88, r: 4.5 },
    { u: 0.15, v: 0.92, r: 3.5 },
    { u: 0.82, v: 0.90, r: 4 }
  ];
  params.dots = dotSpecs.map((d, i) => ({
    u: d.u, v: d.v, r: d.r,
    phase: i * 0.9,
    speedMul: 0.7 + (i % 3) * 0.25
  }));
}

export function update(dt, input, params) {
  params.speed = input.knobValues[0];
  params.twinkle = input.knobValues[1];
  params.diaWidth = 3 + input.knobValues[2] * 2.8;
  params.diaHeight = 4 + input.knobValues[3] * 16.0;

  if (input.btnPressed[0]) params.time = 0;
  if (!input.btnHeld[1]) params.time += dt;
}

export function draw(display, params, time) {
  const W = display.width;
  const H = display.height;
  const t = params.time;
  const speed = params.speed;
  const twinkleSpeed = params.twinkle;
  const diaW = Math.max(2.0, params.diaWidth);
  const diaH = Math.max(2.0, params.diaHeight);

  // Rebuild ribbon path if resolution changes
  if (params.lastW !== W || params.lastH !== H) {
    buildRibbonPath(params, W, H);
  }

  // ---- pass 1: black hood / white body + bouncing polka dots ----
  for (let y = 0; y < H; y++) {
    const v = y / H;
    const hoodMax = hoodEdgeAt(v);
    for (let x = 0; x < W; x++) {
      const u = x / W;
      if (u < hoodMax) {
        display.setPixel(x, y, 0, 0, 0);
        continue;
      }
      let inDot = false;
      for (let i = 0; i < params.dots.length; i++) {
        const d = params.dots[i];
        const baseX = d.u * W;
        const baseY = d.v * H;
        const dy = baseY + Math.sin(t * twinkleSpeed * 1.5 + d.phase) * 2.5 * d.speedMul;
        const ddx = x - baseX;
        const ddy = y - dy;
        if (ddx * ddx + ddy * ddy <= d.r * d.r) {
          inDot = true;
          break;
        }
      }
      if (inDot) display.setPixel(x, y, 0, 0, 0);
      else display.setPixel(x, y, 255, 255, 255);
    }
  }

  // ---- pass 2: rotating, twinkling stars on the hood ----
  for (let i = 0; i < params.stars.length; i++) {
    const s = params.stars[i];
    const sx = s.u * W;
    const sy = s.v * H;
    const angle = s.angle + t * speed * s.rotSpeed * 2.0;
    const twinkle =
      0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * twinkleSpeed * s.twinkleMul * 2.0 + s.twinklePhase));
    const outerR = s.outerR;
    const innerR = outerR * 0.42;
    const cosA = Math.cos(-angle);
    const sinA = Math.sin(-angle);
    const minX = Math.max(0, Math.floor(sx - outerR));
    const maxX = Math.min(W - 1, Math.ceil(sx + outerR));
    const minY = Math.max(0, Math.floor(sy - outerR));
    const maxY = Math.min(H - 1, Math.ceil(sy + outerR));
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const dx = x - sx;
        const dyy = y - sy;
        const rdx = dx * cosA - dyy * sinA;
        const rdy = dx * sinA + dyy * cosA;
        if (starMask(rdx, rdy, outerR, innerR)) {
          const val = Math.round(255 * twinkle);
          display.setPixel(x, y, val, val, val);
        }
      }
    }
  }

  // ---- pass 3: smooth Catmull-Rom ribbon with flowing diamonds ----
  const halfWidth = 8.0;
  const snakeShift = t * speed * 4.0;
  const scale = diaW * diaH;
  const edgeThreshold = scale * 0.09;
  const numSegs = params.segments.length;

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let minDistSq = 1e9;
      let bestDist = 0;
      let bestAlong = 0;
      let bestAcross = 0;
      let hit = false;

      // Project pixel onto nearest ribbon path segment
      for (let i = 0; i < numSegs; i++) {
        const seg = params.segments[i];
        if (x < seg.minX || x > seg.maxX || y < seg.minY || y > seg.maxY) continue;

        const px = x - seg.ax;
        const py = y - seg.ay;
        let proj = (px * seg.dx + py * seg.dy) * seg.invLenSq;
        if (proj < 0) proj = 0;
        else if (proj > 1) proj = 1;

        const cx = seg.ax + proj * seg.dx;
        const cy = seg.ay + proj * seg.dy;
        const distSq = (x - cx) * (x - cx) + (y - cy) * (y - cy);

        if (distSq < minDistSq) {
          minDistSq = distSq;
          bestDist = Math.sqrt(distSq);
          bestAlong = seg.sA + proj * seg.len;
          bestAcross = (px * seg.dy - py * seg.dx) / seg.len;
          hit = true;
        }
      }

      if (!hit || bestDist > halfWidth) continue;

      // Outer black border outline
      if (bestDist > halfWidth - 1.2) {
        display.setPixel(x, y, 0, 0, 0);
        continue;
      }

      // Diamond pattern coordinates
      const along = bestAlong + snakeShift;
      const across = bestAcross;

      const d1 = mod(along * diaW + across * diaH, scale);
      const d2 = mod(along * diaW - across * diaH, scale);

      // Black grout lines between diamonds
      if (d1 < edgeThreshold || d1 > scale - edgeThreshold ||
          d2 < edgeThreshold || d2 > scale - edgeThreshold) {
        display.setPixel(x, y, 0, 0, 0);
      } else {
        const c1 = Math.floor((along * diaW + across * diaH) / scale);
        const c2 = Math.floor((along * diaW - across * diaH) / scale);

        if (mod(c1 + c2, 2) === 0) {
          display.setPixel(x, y, PINK[0], PINK[1], PINK[2]);
        } else {
          display.setPixel(x, y, BLUE[0], BLUE[1], BLUE[2]);
        }
      }
    }
  }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
