// ===== Patternflow pattern =====
// Title:    Black Rose Cascade
// Author:   @engmung
// Based on: "Black Rose v1" by @mondkim — https://patternflow.work/community/p/fe31316adf714020
// Date:     2026-08-12
// SPDX-License-Identifier: CC-BY-SA-4.0
// ===============================

// @ramp linear 0:#000000 1:#ffffff
// @knobs Speed=-3..5, Spacing=0..64, Offset=0..32, Contrast=0.3..2
// @matrix 64x128


// Big rose & small rose scroll upward without stutters.
// Spacing anchors strictly on screen center – absolute zero jump when knob turns.
// Knob 1: scroll speed
// Knob 2: vertical gap (smoothed)
// Knob 3: horizontal offset – big left, small right ×2
// Knob 4: contrast

const MASK_W = 100;
const MASK_H = 64;
const MASK_HEX = [
"00000000001f803f000000000","0000000000fff0ffc00000000","000000007ffff8fff00000000",
"00000003fffffe07f80000000","00000007fffffe70ff0000000","0000000fffffff7c7ffe00000",
"0000000fffffff7e1fffc0000","0000000fffffff7e1ffff0000","0000001fffffbf3f0ffff0000",
"0000001ffff80e3f8ffff8000","0000003ffff0e07f8ffff8000","000000fffdc3e0ff8ffffc000",
"000001fffd87e1ffcffffc000","000003fffd0fc3ffcffffc000","000003fffc1f0fffcffffc600",
"0003f7fffc1c3fffcffffcf80","001fe7fffc1fffffcffffcfc0","003fe7fffc1fffff8efffcfe0",
"007fe7fffe1fffff80fff8ff0","00ffe7fffe1fffff01fff1ff8","01ffe7ffff0ffffe03ffe1ffc",
"01ffc7ffffcffff80fff03ffc","03ffc7ffffefffe03ffc07ffc","03ffc3ffffffff81fff03fffc",
"01ffe3fffffffe0fffe0ffffc","01fff3fffffff07fffc1ffffc","00fff9fffeff81ffff807fff8",
"00fff9fffc0003ffff8f7ffe0","01fffcfffe000fffff8ffff80","07fffeffff801fffff9fffe70",
"1ffffe7ffff83fffff1fffcfc","3ffffe7ffffc3ffffe3fff1fe","7ffffe3ffffe7ffffcfffe3fe",
"7ffffe1ffffffffffffffc7ff","fffffc0ffffffffffffffcfff","fffff80387fffffffffff9fff",
"ffffff0000fffffffffff3fff","ffffffc0003fffffffffe3fff","fffffffff81fffffffffe7ffe",
"7ffffffffe0fffffffffc7ffe","7fffffffff87ffffffffcfffc","3fffffffffc7ffffffff8fff8",
"1fffffffffffffffc7ff1fff0","07ffffffffffffffc0fe1ffe0","01ffffffffffffffe0003ffc0",
"0007fffffffffffffe00fff80","0033fffffffffffffffffff00","0079ffffffffffffffffffe00",
"00f8ffffffffffffffffffe00","01fc3fffffffffffffffffe00","01fe007fffffffffffffffe00",
"01ff80ffffffffffffffffe00","01ffffffffffffffffffff300","03ffffffffffffffffffff300",
"03ffffffffffffffffffff800","01ffffffffffff1f7ff003800","01fffffffffff80c038003800",
"01ffffffffffe00c000003800","00ffffffffff800c000003800","00fffffffffe000c000007800",
"007ffffffffc000c000007800","003fff81fff80000000003000","000ffc007ff00000000000000",
"0001c0000fc00000000000000"
];

const MASK = (() => {
    let arr = new Array(MASK_W * MASK_H);
    for (let y = 0; y < MASK_H; y++) {
        let row = MASK_HEX[y];
        for (let i = 0; i < row.length; i++) {
            let nibble = parseInt(row[i], 16);
            for (let b = 0; b < 4; b++) {
                let bitIndex = i * 4 + b;
                if (bitIndex >= MASK_W) break;
                arr[y * MASK_W + bitIndex] = (nibble >> (3 - b)) & 1;
            }
        }
    }
    return arr;
})();

function maskAt(mx, my) {
    let x0 = Math.floor(mx), y0 = Math.floor(my);
    let x1 = x0 + 1, y1 = y0 + 1;
    if (x0 < 0 || y0 < 0 || x1 >= MASK_W || y1 >= MASK_H) return 0.0;
    let fx = mx - x0, fy = my - y0;
    let v00 = MASK[y0 * MASK_W + x0];
    let v10 = MASK[y0 * MASK_W + x1];
    let v01 = MASK[y1 * MASK_W + x0];
    let v11 = MASK[y1 * MASK_W + x1];
    let top = v00 + (v10 - v00) * fx;
    let bot = v01 + (v11 - v01) * fx;
    return top + (bot - top) * fy;
}

export function setup(params) {
    params.speed = 1.0;
    params.targetSpacing = 20;
    params.currentSpacing = 20;
    params.targetOffset = 0;
    params.currentOffset = 0;
    params.contrast = 0.8;
    
    // 정규화된 continuous 스크롤 위상 (0.0 ~ 1.0)
    params.phaseFG = 0.0;
    params.phaseBG = 0.0;
}

export function update(dt, input, params) {
    if (input && input.knobValues) {
        let v = input.knobValues;
        params.speed = v[0];
        params.targetSpacing = v[1];
        params.targetOffset = v[2];
        params.contrast = v[3];
    }
    
    params.currentSpacing += (params.targetSpacing - params.currentSpacing) * 0.12;
    params.currentOffset  += (params.targetOffset  - params.currentOffset)  * 0.12;

    // 장미 스케일 기반 세로 모듈 크기 계산
    let scaleFG = (64 * 0.85) / MASK_W;
    let roseH_FG = MASK_H * scaleFG;
    let unitH_FG = roseH_FG + params.currentSpacing;

    let scaleBG = scaleFG * 0.7;
    let roseH_BG = MASK_H * scaleBG;
    let unitH_BG = roseH_BG + params.currentSpacing * 0.7;

    let moveSpeed = dt * params.speed * 35.0;
    
    // 0..1 위상(Phase) 속도 적응형 누적 -> Spacing 조절 시 튐 완전 방지
    params.phaseFG = (params.phaseFG + moveSpeed / unitH_FG) % 1.0;
    params.phaseBG = (params.phaseBG + (moveSpeed * 0.514) / unitH_BG) % 1.0;
}

export function draw(display, params, time) {
    const w = display.width;
    const h = display.height;
    const spacing = params.currentSpacing;
    const offset = params.currentOffset;

    // Foreground (big rose)
    const scaleFG = (w * 0.85) / MASK_W;
    const roseH_FG = MASK_H * scaleFG;
    const unitH_FG = roseH_FG + spacing;
    const leftFG = (w * 0.5 - offset) - MASK_W * scaleFG * 0.5;
    const invScaleFG = 1.0 / scaleFG;

    // Background (small rose, 0.7x)
    const scaleBG = scaleFG * 0.7;
    const roseH_BG = MASK_H * scaleBG;
    const unitH_BG = roseH_BG + spacing * 0.7;
    const leftBG = (w * 0.5 + offset * 2.0) - MASK_W * scaleBG * 0.5;
    const invScaleBG = 1.0 / scaleBG;

    const screenCenter = h * 0.5;

    for (let y = 0; y < h; y++) {
        let dy = y - screenCenter;

        // 1. Foreground 화면 중앙 정점 앵커링
        let posY_FG = (dy + 0.5 * unitH_FG + params.phaseFG * unitH_FG) % unitH_FG;
        if (posY_FG < 0) posY_FG += unitH_FG;
        let roseY_FG = posY_FG - (0.5 * unitH_FG - 0.5 * roseH_FG);
        let isFG = roseY_FG >= 0 && roseY_FG < roseH_FG;

        // 2. Background 화면 중앙 정점 앵커링
        let posY_BG = (dy + 0.5 * unitH_BG + params.phaseBG * unitH_BG) % unitH_BG;
        if (posY_BG < 0) posY_BG += unitH_BG;
        let roseY_BG = posY_BG - (0.5 * unitH_BG - 0.5 * roseH_BG);
        let isBG = roseY_BG >= 0 && roseY_BG < roseH_BG;

        let myFG = isFG ? roseY_FG * invScaleFG : 0;
        let myBG = isBG ? roseY_BG * invScaleBG : 0;

        for (let x = 0; x < w; x++) {
            let valFG = 0.0;
            if (isFG) {
                let mx1 = (x - leftFG) * invScaleFG;
                valFG = maskAt(mx1, myFG);
            }

            let valBG = 0.0;
            if (isBG) {
                let mx2 = (x - leftBG) * invScaleBG;
                valBG = maskAt(mx2, myBG) * 0.3;
            }

            let finalVal = Math.max(valFG, valBG);
            finalVal = Math.pow(finalVal, 1.0 / (params.contrast + 0.1));
            display.setValue(x, y, Math.max(0.0, Math.min(1.0, finalVal)));
        }
    }
}

// ── Made with Patternflow Community · https://patternflow.work/community ──
// Shared under CC-BY-SA-4.0. Attribution is part of this licence —
// please keep this notice and the author credit above when you reuse,
// remix, or redistribute this pattern. Do not delete it.
