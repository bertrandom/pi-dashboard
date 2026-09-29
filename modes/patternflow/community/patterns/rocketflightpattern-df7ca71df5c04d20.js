// ===== Patternflow pattern =====
// Title:   RocketFlightPattern
// Author:  @engmung
// Date:    2026-07-24
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp hsvShort 0:#000000 0.852:#ffffff 0.549:#0008ff 0.746:#ff0000 0.321:#bdb600 0.456:#00ff11 0.724:#000000 0.506:#ff004c
// @matrix 128x128


// @knobs Speed=0.5..20, Zoom=1..2, Stars=0..10, Galaxy=0..1

// Knob 1 (Speed): 비행 속도 (화염 길이 및 Sway 흔들림 자동 연동)
// Knob 2 (Zoom): 로켓 및 화염 배율 (1.0배 ~ 2.0배)
// Knob 3 (Stars): 배경 스피드라인/별 개수
// Knob 4 (Galaxy): 은하수 성운 밀도

export function setup(params) {
    params.speed = 1.5;
    params.zoom = 1.0;
    params.stars = 30;
    params.galaxy = 0.5;
    params.timeAcc = 0.0;

    // 배경 별 데이터
    params.starData = [];
    for (let i = 0; i < 60; i++) {
        params.starData.push({
            x: Math.random() * 128,
            y: Math.random() * 128,
            len: 2 + Math.random() * 6,
            spd: 0.5 + Math.random() * 1.5
        });
    }

    // 행성 데이터
    params.planets = [
        { x: 12, y: 30, radius: 8, type: 0, spd: 0.8, driftX: 0.15, rotSpd: 1.2, hasRing: true, active: true },
        { x: 48, y: -20, radius: 5, type: 1, spd: 1.3, driftX: -0.2, rotSpd: 2.0, hasRing: false, active: true },
        { x: 28, y: -90, radius: 10, type: 2, spd: 0.6, driftX: 0.1, rotSpd: 0.8, hasRing: true, active: true }
    ];
}

export function update(dt, input, params) {
    if (input && input.knobValues) {
        params.speed = input.knobValues[0];
        params.zoom = input.knobValues[1];
        params.stars = Math.floor(input.knobValues[2]);
        params.galaxy = input.knobValues[3];
    }
    params.timeAcc += dt * params.speed;

    // 1. 별 스피드라인 이동
    const count = Math.min(60, params.stars);
    for (let i = 0; i < count; i++) {
        let s = params.starData[i];
        s.y += dt * 80.0 * params.speed * s.spd;
        if (s.y > 128) {
            s.y = -s.len;
            s.x = Math.random() * 128;
        }
    }

    // 2. 행성 이동
    for (let i = 0; i < params.planets.length; i++) {
        let p = params.planets[i];
        if (p.active) {
            p.y += dt * 10.0 * params.speed * p.spd;
            p.x += dt * 5.0 * params.speed * p.driftX;

            if (p.y - p.radius * 2.5 > 128 || p.x < -15 || p.x > 143) {
                p.active = false;
            }
        } else {
            if (Math.random() < 0.012) {
                p.x = 8 + Math.random() * 48;
                p.radius = 4 + Math.floor(Math.random() * 7);
                p.y = -p.radius * 3 - Math.random() * 40;
                p.spd = 0.5 + Math.random() * 1.0;
                p.driftX = (Math.random() - 0.5) * 0.4;
                p.rotSpd = 0.5 + Math.random() * 2.0;
                p.type = Math.floor(Math.random() * 3);
                p.hasRing = Math.random() > 0.5;
                p.active = true;
            }
        }
    }
}

export function draw(display, params, time) {
    const w = display.width;
    const h = display.height;
    const t = params.timeAcc;
    const zoom = params.zoom;

    // 1. 화면 초기화 (0.00: 깊은 우주 배경)
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            display.setValue(x, y, 0.0);
        }
    }

    const setPx = (x, y, v) => {
        let ix = Math.floor(x);
        let iy = Math.floor(y);
        if (ix >= 0 && ix < w && iy >= 0 && iy < h) {
            display.setValue(ix, iy, Math.max(0, Math.min(1, v)));
        }
    };

    // ==========================================
    // [구간 1] 우주 배경 & 별빛 (0.00 ~ 0.33)
    // ==========================================

    // 은하수/성운 (0.02 ~ 0.16)
    if (params.galaxy > 0.02) {
        for (let y = 0; y < h; y += 2) {
            for (let x = 0; x < w; x += 2) {
                let gX = x * 0.05;
                let gY = (y + t * 12.0) * 0.04;
                let n1 = Math.sin(gX + gY) * Math.cos(gX * 1.5 - gY * 0.8);
                let n2 = Math.sin((x - y) * 0.03 + t * 0.5);
                let cloud = (n1 + n2) * 0.5;

                if (cloud > 0.15) {
                    let rawNeb = (cloud - 0.15) * 0.4 * params.galaxy;
                    let val = 0.02 + Math.min(0.14, rawNeb * 0.35); // 0.02 ~ 0.16
                    setPx(x, y, val);
                    if (cloud > 0.4) setPx(x + 1, y + 1, val * 0.7);
                }
            }
        }
    }

    // 별 스피드라인 (0.18 ~ 0.32)
    const starCount = Math.min(60, params.stars);
    for (let i = 0; i < starCount; i++) {
        let s = params.starData[i];
        let brightness = 0.5 + (s.spd * 0.5);
        for (let l = 0; l < Math.floor(s.len); l++) {
            let starRaw = brightness * (1.0 - l / s.len);
            let val = 0.18 + starRaw * 0.14; // 0.18 ~ 0.32
            setPx(s.x, s.y + l, val);
        }
    }

    // ==========================================
    // [구간 2] 행성 및 행성 고리 (0.33 ~ 0.66)
    // ==========================================
    for (let i = 0; i < params.planets.length; i++) {
        let p = params.planets[i];
        if (!p.active) continue;

        const px = p.x;
        const py = p.y;
        const pr = p.radius;
        const ptype = p.type;
        const rot = t * p.rotSpd;

        // 행성 뒷부분 고리 (0.36)
        if (p.hasRing) {
            for (let rx = -pr * 2; rx <= pr * 2; rx++) {
                let ry = Math.floor(rx * 0.25);
                if (ry < 0) {
                    setPx(px + rx, py + ry, 0.36);
                }
            }
        }

        // 행성 본체 (0.38 ~ 0.62)
        for (let dy = -pr; dy <= pr; dy++) {
            for (let dx = -pr; dx <= pr; dx++) {
                let distSq = dx * dx + dy * dy;
                if (distSq <= pr * pr) {
                    let shadow = (dx + dy) / (pr * 2);
                    let normVal = 0.55 - shadow * 0.25;

                    if (ptype === 0) {
                        let shiftY = dy + Math.sin(dx * 0.2 + rot) * 1.5;
                        if ((Math.floor(shiftY + 100) % 4) < 2) normVal *= 0.65;
                    } else if (ptype === 1) {
                        let rotX = dx + Math.floor(rot * 4.0);
                        let cx = (rotX % 5 + 5) % 5 - 2;
                        let cy = dy % 4;
                        if (cx * cx + cy * cy < 2) normVal *= 0.55;
                    } else {
                        let atmosphericRot = Math.sin(dx * 0.3 + dy * 0.3 + rot);
                        if (atmosphericRot > 0.3) normVal += 0.2;
                    }

                    // 0.38 ~ 0.62 범위로 정확하게 매핑
                    let planetVal = 0.38 + Math.max(0, Math.min(1, normVal)) * 0.24;
                    setPx(px + dx, py + dy, planetVal);
                }
            }
        }

        // 행성 앞부분 고리 (0.64)
        if (p.hasRing) {
            for (let rx = -pr * 2; rx <= pr * 2; rx++) {
                let ry = Math.floor(rx * 0.25);
                if (ry >= 0) {
                    setPx(px + rx, py + ry, 0.64);
                }
            }
        }
    }

    // ==========================================
    // [구간 3] 우주선 & 엔진 화염 (0.66 ~ 1.00)
    // ==========================================

    // 위치 계산 (Sway 제한 0.2)
    const swayFactor = Math.min(0.2, 0.05 + (params.speed / 4.0) * 0.15);
    let offsetX = (Math.sin(t * 1.8) * 10.0 + Math.sin(t * 3.7 + 1.2) * 3.5) * swayFactor;
    let offsetY = Math.cos(t * 2.3) * 4.0 * swayFactor;

    const rx = w * 0.5 + offsetX;
    const ry = h * 0.35 + offsetY;

    // 로켓 스프라이트 (11x17)
    const rocketSprite = [
        [0,0,0,0,0,1,0,0,0,0,0],
        [0,0,0,0,1,2,1,0,0,0,0],
        [0,0,0,0,1,2,1,0,0,0,0],
        [0,0,0,1,2,2,2,1,0,0,0],
        [0,0,0,1,2,3,2,1,0,0,0],
        [0,0,0,1,2,3,2,1,0,0,0],
        [0,0,0,1,2,2,2,1,0,0,0],
        [0,0,1,1,2,2,2,1,1,0,0],
        [0,0,1,2,2,2,2,2,1,0,0],
        [0,1,2,1,2,2,2,1,2,1,0],
        [0,1,2,1,2,2,2,1,2,1,0],
        [1,2,2,1,2,2,2,1,2,2,1],
        [1,2,2,1,2,2,2,1,2,2,1],
        [1,1,1,1,2,2,2,1,1,1,1],
        [0,0,0,1,1,1,1,1,0,0,0],
        [0,0,0,0,1,2,1,0,0,0,0],
        [0,0,0,0,1,1,1,0,0,0,0]
    ];

    const sh = rocketSprite.length;
    const sw = rocketSprite[0].length;
    const startX = rx - (sw * 0.5) * zoom;
    const startY = ry - (sh * 0.5) * zoom;

    // 로켓 그리기 (창문: 0.68, 외곽선: 0.75, 몸체: 0.92)
    for (let r = 0; r < sh; r++) {
        for (let c = 0; c < sw; c++) {
            let pixelType = rocketSprite[r][c];
            if (pixelType === 0) continue;

            let val = 0.75; // 외곽선
            if (pixelType === 2) val = 0.92; // 밝은 몸체
            if (pixelType === 3) val = 0.68; // 창문

            for (let zy = 0; zy < Math.ceil(zoom); zy++) {
                for (let zx = 0; zx < Math.ceil(zoom); zx++) {
                    setPx(startX + (c * zoom) + zx, startY + (r * zoom) + zy, val);
                }
            }
        }
    }

    // 엔진 분사 불꽃 (0.70 ~ 1.00)
    const thrustFactor = Math.min(2.0, 0.5 + (params.speed / 4.0) * 1.5);
    const flameMaxLen = Math.floor(35 * thrustFactor * zoom);
    const nozzleY = startY + (sh * zoom);

    for (let dy = 0; dy < flameMaxLen; dy++) {
        let currentY = nozzleY + dy;
        let spread = (Math.floor((dy / flameMaxLen) * 6) + 1) * zoom;
        let flicker = Math.sin(dy * 0.8 - t * 25.0) * 0.5 + 0.5;

        for (let dx = -spread; dx <= spread; dx++) {
            let px = rx + dx;
            let distFromCenter = Math.abs(dx) / (spread + 1);
            
            let flameRaw = (1.0 - (dy / flameMaxLen)) * (1.0 - distFromCenter);
            flameRaw *= (0.6 + flicker * 0.4);

            // 0.70 ~ 1.00 범위 매핑
            let val = 0.70 + Math.max(0, Math.min(1, flameRaw)) * 0.30;

            if ((Math.floor(px) + Math.floor(currentY)) % 2 === 0 || val > 0.85) {
                setPx(px, currentY, val);
            }
        }
    }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
