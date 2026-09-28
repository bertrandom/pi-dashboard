// ===== Patternflow pattern =====
// Title:   BlackRoseTunnelVortex
// Author:  @engmung
// Date:    2026-07-26
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp linear 0:#ffffff 0.268:#000000
// @matrix 128x128


// @knobs Speed=-3..3, Twist=0..10, Zoom=1..3, Grid=2..4

// Controls:
// Knob 1 (Speed): Tunnel travel velocity
// Knob 2 (Twist): Spatial rotation and torsional twist intensity
// Knob 3 (Zoom): Depth of field / Focal length
// Knob 4 (Grid): Tunnel mesh subdivision count

export function setup(params) {
    params.speed = 2.0;
    params.twist = 3.0;
    params.zoom = 5.0;
    params.grid = 8;
    params.timeAcc = 0.0;
}

export function update(dt, input, params) {
    if (input && input.knobValues) {
        params.speed = input.knobValues[0];
        params.twist = input.knobValues[1];
        params.zoom = input.knobValues[2];
        params.grid = Math.floor(input.knobValues[3]);
    }
    params.timeAcc += dt * params.speed;
}

export function draw(display, params, time) {
    const w = display.width;
    const h = display.height;
    const t = params.timeAcc;

    for (let y = 0; y < h; y++) {
        let ny = (y - h / 2) / (h / 2);
        for (let x = 0; x < w; x++) {
            let nx = (x - w / 2) / (w / 2) * 2.0; // 2:1 aspect ratio correction

            let r = Math.hypot(nx, ny);
            let a = Math.atan2(ny, nx);

            // Calculate 3D depth coordinate Z
            let z = (params.zoom / (r + 0.05)) + t * 4.0;
            let angle = a + z * (params.twist * 0.05);

            // Compute grid tunnel wall wave pattern
            let gridPattern = Math.sin(angle * params.grid) * Math.sin(z * 2.0);
            let isWireframe = Math.abs(gridPattern) > 0.4 ? 1.0 : 0.0;

            // Perspective distance fog fade
            let depthFade = Math.min(1.0, r * 1.5);
            let v = isWireframe * depthFade;

            // Central vanishing point core glow
            if (r < 0.1) v = 1.0 - (r / 0.1);

            v = Math.max(0.0, Math.min(1.0, v));
            display.setValue(x, y, v);
        }
    }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
