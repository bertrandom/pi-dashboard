// ===== Patternflow pattern =====
// Title:    Rainbow Voronoi
// Author:   @martinnlopez
// Date:     2026-08-10
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @matrix 128x128
// @knobs Density=3..10, Speed=0.1..2, Shading=1..10, Chaos=0.1..5
// Patternflow layer-stack composition — flattened by Pattern Lab.
// Layers (bottom → top):
//   1. Rainbow Voronoi (code, normal, 100%)
//   2. Rainbow Voronoi (code, screen, 100%)
//   3. Rainbow Voronoi (code, screen, 100%)
//   4. Rainbow Voronoi (code, screen, 100%)
//   5. Rainbow Voronoi (code, screen, 100%)
//   6. Rainbow Voronoi (code, screen, 100%)
//   7. Rainbow Voronoi (code, screen, 100%)
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

// ── code layer: Rainbow Voronoi ──
(function () {
  // Shadow the wrapper's own exports: a layer that defines no setup/update
  // must yield undefined here, not capture the OUTER setup (infinite loop).
  var setup, update, draw;

function setup(params) {
  params.w = 100;
  params.h = 100;
  params.k = [8, 0.5, 5, 1];
  
  params.groups = [];
  params.velocities = [];
  
  // 6 Species Palette: Primary (RGB) and Secondary (CMY)
  params.speciesColors = [
    [0.8, 0.1, 0.1], // Red
    [0.1, 0.8, 0.1], // Green
    [0.1, 0.1, 0.8], // Blue
    [0.7, 0.7, 0.0], // Yellow
    [0.0, 0.7, 0.7], // Cyan
    [0.7, 0.0, 0.7]  // Magenta
  ];

  for (let g = 0; g < 6; g++) {
    let groupPoints = [];
    let groupVels = [];
    for (let i = 0; i < 10; i++) {
      groupPoints.push({
        x: (Math.random() - 0.5) * params.w,
        y: (Math.random() - 0.5) * params.h
      });
      groupVels.push({
        x: (Math.random() - 0.5) * 2,
        y: (Math.random() - 0.5) * 2
      });
    }
    params.groups.push(groupPoints);
    params.velocities.push(groupVels);
  }
}

function update(dt, input, params) {
  params.k = input.knobValues;
  const [density, speedMult, shading, chaos] = params.k;
  const maxSpeed = 0.2 * speedMult;
  const w = params.w, h = params.h;

  for (let g = 0; g < 6; g++) {
    for (let i = 0; i < Math.floor(density); i++) {
      let p = params.groups[g][i];
      let v = params.velocities[g][i];

      // 1. Center Gravity
      let dirToCenterX = -p.x * 0.015;
      let dirToCenterY = -p.y * 0.015;

      // 2. Swarm Logic (Attraction within group)
      let swarmX = 0, swarmY = 0;
      for (let j = 0; j < Math.floor(density); j++) {
        if (i === j) continue;
        let other = params.groups[g][j];
        swarmX += (other.x - p.x);
        swarmY += (other.y - p.y);
      }
      
      v.x += (dirToCenterX + (swarmX / density) * chaos) * dt;
      v.y += (dirToCenterY + (swarmY / density) * chaos) * dt;

      const mag = Math.sqrt(v.x * v.x + v.y * v.y);
      if (mag > maxSpeed) {
        v.x = (v.x / mag) * maxSpeed;
        v.y = (v.y / mag) * maxSpeed;
      }

      p.x += v.x * 10;
      p.y += v.y * 10;
    }
  }
}

function draw(display, params, time) {
  const w = display.width, h = display.height;
  const [density, speed, shading, chaos] = params.k;
  const simW = params.w, simH = params.h;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = (x / w - 0.5) * simW;
      const ny = (y / h - 0.5) * simH;

      // Initialize min distances for all 6 species
      let minDists = [10000, 10000, 10000, 10000, 10000, 10000];

      for (let g = 0; g < 6; g++) {
        for (let i = 0; i < Math.floor(density); i++) {
          let p = params.groups[g][i];
          let dX = nx - p.x;
          let dY = ny - p.y;
          let distSq = dX * dX + dY * dY;
          if (distSq < minDists[g]) minDists[g] = distSq;
        }
      }

      let rOut = 0, gOut = 0, bOut = 0;

      for (let g = 0; g < 6; g++) {
        let d = Math.sqrt(minDists[g]);
        // Increased falloff for more distinct cells
        let val = 1.0 / (1.0 + d * 0.35); 
        
        // Quantize based on Shading knob
        val = Math.floor(val * shading) / shading;

        const col = params.speciesColors[g];
        rOut += val * col[0] * 255;
        gOut += val * col[1] * 255;
        bOut += val * col[2] * 255;
      }

      // Final additive color with clamping
      display.setPixel(x, y, 
        Math.min(255, rOut), 
        Math.min(255, gOut), 
        Math.min(255, bOut)
      );
    }
  }
}
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

// ── code layer: Rainbow Voronoi ──
(function () {
  // Shadow the wrapper's own exports: a layer that defines no setup/update
  // must yield undefined here, not capture the OUTER setup (infinite loop).
  var setup, update, draw;

function setup(params) {
  params.w = 100;
  params.h = 100;
  params.k = [8, 0.5, 5, 1];
  
  params.groups = [];
  params.velocities = [];
  
  // 6 Species Palette: Primary (RGB) and Secondary (CMY)
  params.speciesColors = [
    [0.8, 0.1, 0.1], // Red
    [0.1, 0.8, 0.1], // Green
    [0.1, 0.1, 0.8], // Blue
    [0.7, 0.7, 0.0], // Yellow
    [0.0, 0.7, 0.7], // Cyan
    [0.7, 0.0, 0.7]  // Magenta
  ];

  for (let g = 0; g < 6; g++) {
    let groupPoints = [];
    let groupVels = [];
    for (let i = 0; i < 10; i++) {
      groupPoints.push({
        x: (Math.random() - 0.5) * params.w,
        y: (Math.random() - 0.5) * params.h
      });
      groupVels.push({
        x: (Math.random() - 0.5) * 2,
        y: (Math.random() - 0.5) * 2
      });
    }
    params.groups.push(groupPoints);
    params.velocities.push(groupVels);
  }
}

function update(dt, input, params) {
  params.k = input.knobValues;
  const [density, speedMult, shading, chaos] = params.k;
  const maxSpeed = 0.2 * speedMult;
  const w = params.w, h = params.h;

  for (let g = 0; g < 6; g++) {
    for (let i = 0; i < Math.floor(density); i++) {
      let p = params.groups[g][i];
      let v = params.velocities[g][i];

      // 1. Center Gravity
      let dirToCenterX = -p.x * 0.015;
      let dirToCenterY = -p.y * 0.015;

      // 2. Swarm Logic (Attraction within group)
      let swarmX = 0, swarmY = 0;
      for (let j = 0; j < Math.floor(density); j++) {
        if (i === j) continue;
        let other = params.groups[g][j];
        swarmX += (other.x - p.x);
        swarmY += (other.y - p.y);
      }
      
      v.x += (dirToCenterX + (swarmX / density) * chaos) * dt;
      v.y += (dirToCenterY + (swarmY / density) * chaos) * dt;

      const mag = Math.sqrt(v.x * v.x + v.y * v.y);
      if (mag > maxSpeed) {
        v.x = (v.x / mag) * maxSpeed;
        v.y = (v.y / mag) * maxSpeed;
      }

      p.x += v.x * 10;
      p.y += v.y * 10;
    }
  }
}

function draw(display, params, time) {
  const w = display.width, h = display.height;
  const [density, speed, shading, chaos] = params.k;
  const simW = params.w, simH = params.h;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = (x / w - 0.5) * simW;
      const ny = (y / h - 0.5) * simH;

      // Initialize min distances for all 6 species
      let minDists = [10000, 10000, 10000, 10000, 10000, 10000];

      for (let g = 0; g < 6; g++) {
        for (let i = 0; i < Math.floor(density); i++) {
          let p = params.groups[g][i];
          let dX = nx - p.x;
          let dY = ny - p.y;
          let distSq = dX * dX + dY * dY;
          if (distSq < minDists[g]) minDists[g] = distSq;
        }
      }

      let rOut = 0, gOut = 0, bOut = 0;

      for (let g = 0; g < 6; g++) {
        let d = Math.sqrt(minDists[g]);
        // Increased falloff for more distinct cells
        let val = 1.0 / (1.0 + d * 0.35); 
        
        // Quantize based on Shading knob
        val = Math.floor(val * shading) / shading;

        const col = params.speciesColors[g];
        rOut += val * col[0] * 255;
        gOut += val * col[1] * 255;
        bOut += val * col[2] * 255;
      }

      // Final additive color with clamping
      display.setPixel(x, y, 
        Math.min(255, rOut), 
        Math.min(255, gOut), 
        Math.min(255, bOut)
      );
    }
  }
}
  __stack.push({
    kind: "code", opacity: 1, blend: "screen", recolor: false, role: "paint", maskInvert: false,
    lut: null,
    buf: new Uint8ClampedArray(__W * __H * 4),
    params: {},
    fSetup: typeof setup === "function" ? setup : null,
    fUpdate: typeof update === "function" ? update : null,
    fDraw: typeof draw === "function" ? draw : null,
  });
})();

// ── code layer: Rainbow Voronoi ──
(function () {
  // Shadow the wrapper's own exports: a layer that defines no setup/update
  // must yield undefined here, not capture the OUTER setup (infinite loop).
  var setup, update, draw;

function setup(params) {
  params.w = 100;
  params.h = 100;
  params.k = [8, 0.5, 5, 1];
  
  params.groups = [];
  params.velocities = [];
  
  // 6 Species Palette: Primary (RGB) and Secondary (CMY)
  params.speciesColors = [
    [0.8, 0.1, 0.1], // Red
    [0.1, 0.8, 0.1], // Green
    [0.1, 0.1, 0.8], // Blue
    [0.7, 0.7, 0.0], // Yellow
    [0.0, 0.7, 0.7], // Cyan
    [0.7, 0.0, 0.7]  // Magenta
  ];

  for (let g = 0; g < 6; g++) {
    let groupPoints = [];
    let groupVels = [];
    for (let i = 0; i < 10; i++) {
      groupPoints.push({
        x: (Math.random() - 0.5) * params.w,
        y: (Math.random() - 0.5) * params.h
      });
      groupVels.push({
        x: (Math.random() - 0.5) * 2,
        y: (Math.random() - 0.5) * 2
      });
    }
    params.groups.push(groupPoints);
    params.velocities.push(groupVels);
  }
}

function update(dt, input, params) {
  params.k = input.knobValues;
  const [density, speedMult, shading, chaos] = params.k;
  const maxSpeed = 0.2 * speedMult;
  const w = params.w, h = params.h;

  for (let g = 0; g < 6; g++) {
    for (let i = 0; i < Math.floor(density); i++) {
      let p = params.groups[g][i];
      let v = params.velocities[g][i];

      // 1. Center Gravity
      let dirToCenterX = -p.x * 0.015;
      let dirToCenterY = -p.y * 0.015;

      // 2. Swarm Logic (Attraction within group)
      let swarmX = 0, swarmY = 0;
      for (let j = 0; j < Math.floor(density); j++) {
        if (i === j) continue;
        let other = params.groups[g][j];
        swarmX += (other.x - p.x);
        swarmY += (other.y - p.y);
      }
      
      v.x += (dirToCenterX + (swarmX / density) * chaos) * dt;
      v.y += (dirToCenterY + (swarmY / density) * chaos) * dt;

      const mag = Math.sqrt(v.x * v.x + v.y * v.y);
      if (mag > maxSpeed) {
        v.x = (v.x / mag) * maxSpeed;
        v.y = (v.y / mag) * maxSpeed;
      }

      p.x += v.x * 10;
      p.y += v.y * 10;
    }
  }
}

function draw(display, params, time) {
  const w = display.width, h = display.height;
  const [density, speed, shading, chaos] = params.k;
  const simW = params.w, simH = params.h;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = (x / w - 0.5) * simW;
      const ny = (y / h - 0.5) * simH;

      // Initialize min distances for all 6 species
      let minDists = [10000, 10000, 10000, 10000, 10000, 10000];

      for (let g = 0; g < 6; g++) {
        for (let i = 0; i < Math.floor(density); i++) {
          let p = params.groups[g][i];
          let dX = nx - p.x;
          let dY = ny - p.y;
          let distSq = dX * dX + dY * dY;
          if (distSq < minDists[g]) minDists[g] = distSq;
        }
      }

      let rOut = 0, gOut = 0, bOut = 0;

      for (let g = 0; g < 6; g++) {
        let d = Math.sqrt(minDists[g]);
        // Increased falloff for more distinct cells
        let val = 1.0 / (1.0 + d * 0.35); 
        
        // Quantize based on Shading knob
        val = Math.floor(val * shading) / shading;

        const col = params.speciesColors[g];
        rOut += val * col[0] * 255;
        gOut += val * col[1] * 255;
        bOut += val * col[2] * 255;
      }

      // Final additive color with clamping
      display.setPixel(x, y, 
        Math.min(255, rOut), 
        Math.min(255, gOut), 
        Math.min(255, bOut)
      );
    }
  }
}
  __stack.push({
    kind: "code", opacity: 1, blend: "screen", recolor: false, role: "paint", maskInvert: false,
    lut: null,
    buf: new Uint8ClampedArray(__W * __H * 4),
    params: {},
    fSetup: typeof setup === "function" ? setup : null,
    fUpdate: typeof update === "function" ? update : null,
    fDraw: typeof draw === "function" ? draw : null,
  });
})();

// ── code layer: Rainbow Voronoi ──
(function () {
  // Shadow the wrapper's own exports: a layer that defines no setup/update
  // must yield undefined here, not capture the OUTER setup (infinite loop).
  var setup, update, draw;

function setup(params) {
  params.w = 100;
  params.h = 100;
  params.k = [8, 0.5, 5, 1];
  
  params.groups = [];
  params.velocities = [];
  
  // 6 Species Palette: Primary (RGB) and Secondary (CMY)
  params.speciesColors = [
    [0.8, 0.1, 0.1], // Red
    [0.1, 0.8, 0.1], // Green
    [0.1, 0.1, 0.8], // Blue
    [0.7, 0.7, 0.0], // Yellow
    [0.0, 0.7, 0.7], // Cyan
    [0.7, 0.0, 0.7]  // Magenta
  ];

  for (let g = 0; g < 6; g++) {
    let groupPoints = [];
    let groupVels = [];
    for (let i = 0; i < 10; i++) {
      groupPoints.push({
        x: (Math.random() - 0.5) * params.w,
        y: (Math.random() - 0.5) * params.h
      });
      groupVels.push({
        x: (Math.random() - 0.5) * 2,
        y: (Math.random() - 0.5) * 2
      });
    }
    params.groups.push(groupPoints);
    params.velocities.push(groupVels);
  }
}

function update(dt, input, params) {
  params.k = input.knobValues;
  const [density, speedMult, shading, chaos] = params.k;
  const maxSpeed = 0.2 * speedMult;
  const w = params.w, h = params.h;

  for (let g = 0; g < 6; g++) {
    for (let i = 0; i < Math.floor(density); i++) {
      let p = params.groups[g][i];
      let v = params.velocities[g][i];

      // 1. Center Gravity
      let dirToCenterX = -p.x * 0.015;
      let dirToCenterY = -p.y * 0.015;

      // 2. Swarm Logic (Attraction within group)
      let swarmX = 0, swarmY = 0;
      for (let j = 0; j < Math.floor(density); j++) {
        if (i === j) continue;
        let other = params.groups[g][j];
        swarmX += (other.x - p.x);
        swarmY += (other.y - p.y);
      }
      
      v.x += (dirToCenterX + (swarmX / density) * chaos) * dt;
      v.y += (dirToCenterY + (swarmY / density) * chaos) * dt;

      const mag = Math.sqrt(v.x * v.x + v.y * v.y);
      if (mag > maxSpeed) {
        v.x = (v.x / mag) * maxSpeed;
        v.y = (v.y / mag) * maxSpeed;
      }

      p.x += v.x * 10;
      p.y += v.y * 10;
    }
  }
}

function draw(display, params, time) {
  const w = display.width, h = display.height;
  const [density, speed, shading, chaos] = params.k;
  const simW = params.w, simH = params.h;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = (x / w - 0.5) * simW;
      const ny = (y / h - 0.5) * simH;

      // Initialize min distances for all 6 species
      let minDists = [10000, 10000, 10000, 10000, 10000, 10000];

      for (let g = 0; g < 6; g++) {
        for (let i = 0; i < Math.floor(density); i++) {
          let p = params.groups[g][i];
          let dX = nx - p.x;
          let dY = ny - p.y;
          let distSq = dX * dX + dY * dY;
          if (distSq < minDists[g]) minDists[g] = distSq;
        }
      }

      let rOut = 0, gOut = 0, bOut = 0;

      for (let g = 0; g < 6; g++) {
        let d = Math.sqrt(minDists[g]);
        // Increased falloff for more distinct cells
        let val = 1.0 / (1.0 + d * 0.35); 
        
        // Quantize based on Shading knob
        val = Math.floor(val * shading) / shading;

        const col = params.speciesColors[g];
        rOut += val * col[0] * 255;
        gOut += val * col[1] * 255;
        bOut += val * col[2] * 255;
      }

      // Final additive color with clamping
      display.setPixel(x, y, 
        Math.min(255, rOut), 
        Math.min(255, gOut), 
        Math.min(255, bOut)
      );
    }
  }
}
  __stack.push({
    kind: "code", opacity: 1, blend: "screen", recolor: false, role: "paint", maskInvert: false,
    lut: null,
    buf: new Uint8ClampedArray(__W * __H * 4),
    params: {},
    fSetup: typeof setup === "function" ? setup : null,
    fUpdate: typeof update === "function" ? update : null,
    fDraw: typeof draw === "function" ? draw : null,
  });
})();

// ── code layer: Rainbow Voronoi ──
(function () {
  // Shadow the wrapper's own exports: a layer that defines no setup/update
  // must yield undefined here, not capture the OUTER setup (infinite loop).
  var setup, update, draw;

function setup(params) {
  params.w = 100;
  params.h = 100;
  params.k = [8, 0.5, 5, 1];
  
  params.groups = [];
  params.velocities = [];
  
  // 6 Species Palette: Primary (RGB) and Secondary (CMY)
  params.speciesColors = [
    [0.8, 0.1, 0.1], // Red
    [0.1, 0.8, 0.1], // Green
    [0.1, 0.1, 0.8], // Blue
    [0.7, 0.7, 0.0], // Yellow
    [0.0, 0.7, 0.7], // Cyan
    [0.7, 0.0, 0.7]  // Magenta
  ];

  for (let g = 0; g < 6; g++) {
    let groupPoints = [];
    let groupVels = [];
    for (let i = 0; i < 10; i++) {
      groupPoints.push({
        x: (Math.random() - 0.5) * params.w,
        y: (Math.random() - 0.5) * params.h
      });
      groupVels.push({
        x: (Math.random() - 0.5) * 2,
        y: (Math.random() - 0.5) * 2
      });
    }
    params.groups.push(groupPoints);
    params.velocities.push(groupVels);
  }
}

function update(dt, input, params) {
  params.k = input.knobValues;
  const [density, speedMult, shading, chaos] = params.k;
  const maxSpeed = 0.2 * speedMult;
  const w = params.w, h = params.h;

  for (let g = 0; g < 6; g++) {
    for (let i = 0; i < Math.floor(density); i++) {
      let p = params.groups[g][i];
      let v = params.velocities[g][i];

      // 1. Center Gravity
      let dirToCenterX = -p.x * 0.015;
      let dirToCenterY = -p.y * 0.015;

      // 2. Swarm Logic (Attraction within group)
      let swarmX = 0, swarmY = 0;
      for (let j = 0; j < Math.floor(density); j++) {
        if (i === j) continue;
        let other = params.groups[g][j];
        swarmX += (other.x - p.x);
        swarmY += (other.y - p.y);
      }
      
      v.x += (dirToCenterX + (swarmX / density) * chaos) * dt;
      v.y += (dirToCenterY + (swarmY / density) * chaos) * dt;

      const mag = Math.sqrt(v.x * v.x + v.y * v.y);
      if (mag > maxSpeed) {
        v.x = (v.x / mag) * maxSpeed;
        v.y = (v.y / mag) * maxSpeed;
      }

      p.x += v.x * 10;
      p.y += v.y * 10;
    }
  }
}

function draw(display, params, time) {
  const w = display.width, h = display.height;
  const [density, speed, shading, chaos] = params.k;
  const simW = params.w, simH = params.h;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = (x / w - 0.5) * simW;
      const ny = (y / h - 0.5) * simH;

      // Initialize min distances for all 6 species
      let minDists = [10000, 10000, 10000, 10000, 10000, 10000];

      for (let g = 0; g < 6; g++) {
        for (let i = 0; i < Math.floor(density); i++) {
          let p = params.groups[g][i];
          let dX = nx - p.x;
          let dY = ny - p.y;
          let distSq = dX * dX + dY * dY;
          if (distSq < minDists[g]) minDists[g] = distSq;
        }
      }

      let rOut = 0, gOut = 0, bOut = 0;

      for (let g = 0; g < 6; g++) {
        let d = Math.sqrt(minDists[g]);
        // Increased falloff for more distinct cells
        let val = 1.0 / (1.0 + d * 0.35); 
        
        // Quantize based on Shading knob
        val = Math.floor(val * shading) / shading;

        const col = params.speciesColors[g];
        rOut += val * col[0] * 255;
        gOut += val * col[1] * 255;
        bOut += val * col[2] * 255;
      }

      // Final additive color with clamping
      display.setPixel(x, y, 
        Math.min(255, rOut), 
        Math.min(255, gOut), 
        Math.min(255, bOut)
      );
    }
  }
}
  __stack.push({
    kind: "code", opacity: 1, blend: "screen", recolor: false, role: "paint", maskInvert: false,
    lut: null,
    buf: new Uint8ClampedArray(__W * __H * 4),
    params: {},
    fSetup: typeof setup === "function" ? setup : null,
    fUpdate: typeof update === "function" ? update : null,
    fDraw: typeof draw === "function" ? draw : null,
  });
})();

// ── code layer: Rainbow Voronoi ──
(function () {
  // Shadow the wrapper's own exports: a layer that defines no setup/update
  // must yield undefined here, not capture the OUTER setup (infinite loop).
  var setup, update, draw;

function setup(params) {
  params.w = 100;
  params.h = 100;
  params.k = [8, 0.5, 5, 1];
  
  params.groups = [];
  params.velocities = [];
  
  // 6 Species Palette: Primary (RGB) and Secondary (CMY)
  params.speciesColors = [
    [0.8, 0.1, 0.1], // Red
    [0.1, 0.8, 0.1], // Green
    [0.1, 0.1, 0.8], // Blue
    [0.7, 0.7, 0.0], // Yellow
    [0.0, 0.7, 0.7], // Cyan
    [0.7, 0.0, 0.7]  // Magenta
  ];

  for (let g = 0; g < 6; g++) {
    let groupPoints = [];
    let groupVels = [];
    for (let i = 0; i < 10; i++) {
      groupPoints.push({
        x: (Math.random() - 0.5) * params.w,
        y: (Math.random() - 0.5) * params.h
      });
      groupVels.push({
        x: (Math.random() - 0.5) * 2,
        y: (Math.random() - 0.5) * 2
      });
    }
    params.groups.push(groupPoints);
    params.velocities.push(groupVels);
  }
}

function update(dt, input, params) {
  params.k = input.knobValues;
  const [density, speedMult, shading, chaos] = params.k;
  const maxSpeed = 0.2 * speedMult;
  const w = params.w, h = params.h;

  for (let g = 0; g < 6; g++) {
    for (let i = 0; i < Math.floor(density); i++) {
      let p = params.groups[g][i];
      let v = params.velocities[g][i];

      // 1. Center Gravity
      let dirToCenterX = -p.x * 0.015;
      let dirToCenterY = -p.y * 0.015;

      // 2. Swarm Logic (Attraction within group)
      let swarmX = 0, swarmY = 0;
      for (let j = 0; j < Math.floor(density); j++) {
        if (i === j) continue;
        let other = params.groups[g][j];
        swarmX += (other.x - p.x);
        swarmY += (other.y - p.y);
      }
      
      v.x += (dirToCenterX + (swarmX / density) * chaos) * dt;
      v.y += (dirToCenterY + (swarmY / density) * chaos) * dt;

      const mag = Math.sqrt(v.x * v.x + v.y * v.y);
      if (mag > maxSpeed) {
        v.x = (v.x / mag) * maxSpeed;
        v.y = (v.y / mag) * maxSpeed;
      }

      p.x += v.x * 10;
      p.y += v.y * 10;
    }
  }
}

function draw(display, params, time) {
  const w = display.width, h = display.height;
  const [density, speed, shading, chaos] = params.k;
  const simW = params.w, simH = params.h;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = (x / w - 0.5) * simW;
      const ny = (y / h - 0.5) * simH;

      // Initialize min distances for all 6 species
      let minDists = [10000, 10000, 10000, 10000, 10000, 10000];

      for (let g = 0; g < 6; g++) {
        for (let i = 0; i < Math.floor(density); i++) {
          let p = params.groups[g][i];
          let dX = nx - p.x;
          let dY = ny - p.y;
          let distSq = dX * dX + dY * dY;
          if (distSq < minDists[g]) minDists[g] = distSq;
        }
      }

      let rOut = 0, gOut = 0, bOut = 0;

      for (let g = 0; g < 6; g++) {
        let d = Math.sqrt(minDists[g]);
        // Increased falloff for more distinct cells
        let val = 1.0 / (1.0 + d * 0.35); 
        
        // Quantize based on Shading knob
        val = Math.floor(val * shading) / shading;

        const col = params.speciesColors[g];
        rOut += val * col[0] * 255;
        gOut += val * col[1] * 255;
        bOut += val * col[2] * 255;
      }

      // Final additive color with clamping
      display.setPixel(x, y, 
        Math.min(255, rOut), 
        Math.min(255, gOut), 
        Math.min(255, bOut)
      );
    }
  }
}
  __stack.push({
    kind: "code", opacity: 1, blend: "screen", recolor: false, role: "paint", maskInvert: false,
    lut: null,
    buf: new Uint8ClampedArray(__W * __H * 4),
    params: {},
    fSetup: typeof setup === "function" ? setup : null,
    fUpdate: typeof update === "function" ? update : null,
    fDraw: typeof draw === "function" ? draw : null,
  });
})();

// ── code layer: Rainbow Voronoi ──
(function () {
  // Shadow the wrapper's own exports: a layer that defines no setup/update
  // must yield undefined here, not capture the OUTER setup (infinite loop).
  var setup, update, draw;

function setup(params) {
  params.w = 100;
  params.h = 100;
  params.k = [8, 0.5, 5, 1];
  
  params.groups = [];
  params.velocities = [];
  
  // 6 Species Palette: Primary (RGB) and Secondary (CMY)
  params.speciesColors = [
    [0.8, 0.1, 0.1], // Red
    [0.1, 0.8, 0.1], // Green
    [0.1, 0.1, 0.8], // Blue
    [0.7, 0.7, 0.0], // Yellow
    [0.0, 0.7, 0.7], // Cyan
    [0.7, 0.0, 0.7]  // Magenta
  ];

  for (let g = 0; g < 6; g++) {
    let groupPoints = [];
    let groupVels = [];
    for (let i = 0; i < 10; i++) {
      groupPoints.push({
        x: (Math.random() - 0.5) * params.w,
        y: (Math.random() - 0.5) * params.h
      });
      groupVels.push({
        x: (Math.random() - 0.5) * 2,
        y: (Math.random() - 0.5) * 2
      });
    }
    params.groups.push(groupPoints);
    params.velocities.push(groupVels);
  }
}

function update(dt, input, params) {
  params.k = input.knobValues;
  const [density, speedMult, shading, chaos] = params.k;
  const maxSpeed = 0.2 * speedMult;
  const w = params.w, h = params.h;

  for (let g = 0; g < 6; g++) {
    for (let i = 0; i < Math.floor(density); i++) {
      let p = params.groups[g][i];
      let v = params.velocities[g][i];

      // 1. Center Gravity
      let dirToCenterX = -p.x * 0.015;
      let dirToCenterY = -p.y * 0.015;

      // 2. Swarm Logic (Attraction within group)
      let swarmX = 0, swarmY = 0;
      for (let j = 0; j < Math.floor(density); j++) {
        if (i === j) continue;
        let other = params.groups[g][j];
        swarmX += (other.x - p.x);
        swarmY += (other.y - p.y);
      }
      
      v.x += (dirToCenterX + (swarmX / density) * chaos) * dt;
      v.y += (dirToCenterY + (swarmY / density) * chaos) * dt;

      const mag = Math.sqrt(v.x * v.x + v.y * v.y);
      if (mag > maxSpeed) {
        v.x = (v.x / mag) * maxSpeed;
        v.y = (v.y / mag) * maxSpeed;
      }

      p.x += v.x * 10;
      p.y += v.y * 10;
    }
  }
}

function draw(display, params, time) {
  const w = display.width, h = display.height;
  const [density, speed, shading, chaos] = params.k;
  const simW = params.w, simH = params.h;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = (x / w - 0.5) * simW;
      const ny = (y / h - 0.5) * simH;

      // Initialize min distances for all 6 species
      let minDists = [10000, 10000, 10000, 10000, 10000, 10000];

      for (let g = 0; g < 6; g++) {
        for (let i = 0; i < Math.floor(density); i++) {
          let p = params.groups[g][i];
          let dX = nx - p.x;
          let dY = ny - p.y;
          let distSq = dX * dX + dY * dY;
          if (distSq < minDists[g]) minDists[g] = distSq;
        }
      }

      let rOut = 0, gOut = 0, bOut = 0;

      for (let g = 0; g < 6; g++) {
        let d = Math.sqrt(minDists[g]);
        // Increased falloff for more distinct cells
        let val = 1.0 / (1.0 + d * 0.35); 
        
        // Quantize based on Shading knob
        val = Math.floor(val * shading) / shading;

        const col = params.speciesColors[g];
        rOut += val * col[0] * 255;
        gOut += val * col[1] * 255;
        bOut += val * col[2] * 255;
      }

      // Final additive color with clamping
      display.setPixel(x, y, 
        Math.min(255, rOut), 
        Math.min(255, gOut), 
        Math.min(255, bOut)
      );
    }
  }
}
  __stack.push({
    kind: "code", opacity: 1, blend: "screen", recolor: false, role: "paint", maskInvert: false,
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

// @stack v1 d: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

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
