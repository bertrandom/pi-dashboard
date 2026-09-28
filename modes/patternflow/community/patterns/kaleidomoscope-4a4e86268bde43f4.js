// ===== Patternflow pattern =====
// Title:    Kaleidomoscope
// Author:   @akacoda
// Date:     2026-08-12
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @matrix 128x128
function hsvToRgb(h, s, v) {
    let r, g, b;
    let i = Math.floor(h * 6);
    let f = h * 6 - i;
    let p = v * (1 - s);
    let q = v * (1 - f * s);
    let t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        case 5: r = v; g = p; b = q; break;
    }
    return [Math.floor(r * 255), Math.floor(g * 255), Math.floor(b * 255)];
}
function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}
export function setup(params) {
    params.hueBase = 0.7;
    params.speed = 1.0;
    // 0 = fully zoomed in (1 big pattern)
    // 1 = fully zoomed out (many small tiles)
    params.zoomOut = 0.35;
    params.sectors = 6.0;
    params.timeAcc = 0.0;
}

export function update(dt, input, params) {
    params.hueBase = (params.hueBase + input.knobDeltas[0] * 0.05) % 1.0;
    if (params.hueBase < 0) params.hueBase += 1.0;

    params.speed = Math.max(0.0, params.speed + input.knobDeltas[1] * 0.05);
    // Knob 3: zoom OUT amount
    params.zoomOut = clamp(params.zoomOut + input.knobDeltas[2] * 0.03, 0.0, 1.0);
    params.sectors = clamp(params.sectors + input.knobDeltas[3] * 0.2, 2.0, 12.0);

    params.timeAcc += dt * params.speed;
}

export function draw(display, params, time) {
    let t = params.timeAcc;
    let sectors = Math.max(2, Math.floor(params.sectors + 0.5));
    let sectorAngle = Math.PI * 2.0 / sectors;

    let z = params.zoomOut * params.zoomOut; // bias toward zoomed-in
    let tiles = 1.0 + z * 3.0;               // still caps at 4
    // plasma scale inside each tile (keeps each cell looking dense)
    let plasmaZoom = 1.6 + params.zoomOut * 2.5;

    let rotate = t * 0.15;
    let W = display.width, H = display.height;

    for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
            // Map into tiled local coordinates [0,1) within each cell
            let tx = (x / W) * tiles;
            let ty = (y / H) * tiles;
            let fx = tx - Math.floor(tx);
            let fy = ty - Math.floor(ty);

            // Local kaleidoscope centered in the tile
            let dx = fx - 0.5;
            let dy = fy - 0.5;
            // normalize by half-tile so r~1 at tile edge
            let r = Math.sqrt(dx * dx + dy * dy) * 2.0;
            let a = Math.atan2(dy, dx) + rotate;

            a = a % sectorAngle;
            if (a < 0) a += sectorAngle;
            if (a > sectorAngle * 0.5) a = sectorAngle - a;

            let nx = Math.cos(a) * r * plasmaZoom;
            let ny = Math.sin(a) * r * plasmaZoom;

            let warpX = Math.sin(ny * 2.0 + t) * 0.8;
            let warpY = Math.cos(nx * 2.0 - t * 1.2) * 0.8;

            let v1 = Math.sin(nx + t);
            let v2 = Math.cos(ny - t * 0.8);
            let v3 = Math.sin((nx + warpX) * 1.5 + t * 1.5);
            let v4 = Math.cos((ny + warpY) * 1.5 - t);

            let field = Math.abs(v1 + v2 + v3 + v4);
            let val = 1.0 - field * 0.5;
            val = Math.pow(clamp(val, 0.0, 1.0), 3.0);
            val = clamp(val * 2.4, 0.0, 1.0);

            let edge = clamp(1.0 - r * 1.05, 0.0, 1.0);
            val *= 0.35 + edge * 0.65;

            // slight per-tile hue shift so the grid reads as many copies
            let tileId = Math.floor(tx) * 0.07 + Math.floor(ty) * 0.11;
            let hue = (params.hueBase + r * 0.4 + field * 0.05 + a * 0.1 + tileId) % 1.0;

            let rgb = hsvToRgb(hue, 1.0 - val * 0.2, val);
            display.setPixel(x, y, rgb[0], rgb[1], rgb[2]);
        }
    }

}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
