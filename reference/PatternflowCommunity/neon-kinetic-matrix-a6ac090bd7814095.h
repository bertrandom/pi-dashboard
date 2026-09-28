#pragma once

#include <Arduino.h>
#include "config.h"
#include "src/core_display.h"
#include "src/core_encoders.h"
#include "src/core_canvas.h"
#include "src/core_params.h"
#include "src/core_math.h"
#include "src/core_color.h"

namespace NeonKineticMatrix {

const char* NAME = "Neon Kinetic Matrix";
const char* const KNOB_LABELS[4] = {"Speed", "Bars", "Bloom", "HueShift"};
constexpr bool ABSOLUTE_READY = true;

constexpr int FRAME_W = 64;
constexpr int FRAME_H = 128;

// Pattern Lab 슬라이더 입력 상태
static float knobSpeed = 8.0f;       // 0.1 .. 8.0
static float knobBars = 2.525f;      // 1.0 .. 4.0
static float knobBloom = 3.083f;     // 0.0 .. 10.0
static float knobHueShift = 330.0f;  // 0.0 .. 360.0

static float timeAcc = 0.0f;

// 회전 성분 1D 분리 캐시 (64 + 128 = 192 floats, 0.7KB RAM 사용)
static float xCosA[FRAME_W];
static float xSinA[FRAME_W];
static float ySinA[FRAME_H];
static float yCosA[FRAME_H];

void setup() {
    PFMath::buildSinLUT();

    knobSpeed = 8.0f;
    knobBars = 2.525f;
    knobBloom = 3.083f;
    knobHueShift = 330.0f;
    timeAcc = 0.0f;

    constexpr float cosA = 0.819f;
    constexpr float sinA = 0.574f;

    for (int x = 0; x < FRAME_W; ++x) {
        xCosA[x] = (float)x * cosA;
        xSinA[x] = (float)x * sinA;
    }
    for (int y = 0; y < FRAME_H; ++y) {
        ySinA[y] = (float)y * sinA;
        yCosA[y] = (float)y * cosA;
    }
}

void update(float dt, const InputFrame& input) {
    PFParams::apply(input, 0, &knobSpeed, 0.1f, 8.0f, 0.165f);
    PFParams::apply(input, 1, &knobBars, 1.0f, 4.0f, 0.063f);
    PFParams::apply(input, 2, &knobBloom, 0.0f, 10.0f, 0.208f);
    PFParams::apply(input, 3, &knobHueShift, 0.0f, 360.0f, 7.5f);

    if (input.btnPressed[0] && !input.paramAbsoluteActive[0] && !input.knobAudioActive[0]) {
        knobSpeed = 2.4f;
    }
    if (input.btnPressed[1] && !input.paramAbsoluteActive[1] && !input.knobAudioActive[1]) {
        knobBars = 2.2f;
    }
    if (input.btnPressed[2] && !input.paramAbsoluteActive[2] && !input.knobAudioActive[2]) {
        knobBloom = 4.5f;
    }
    if (input.btnPressed[3] && !input.paramAbsoluteActive[3] && !input.knobAudioActive[3]) {
        knobHueShift = 198.0f; // 0.55 * 360
    }

    // 내부 실제 동작 스피드로 축적
    float effectiveSpeed = knobSpeed * 0.5f;
    timeAcc += dt * effectiveSpeed;

    constexpr float TIME_WRAP = 20.0f * PI;
    if (timeAcc > TIME_WRAP) {
        timeAcc -= TIME_WRAP;
    }
}

void draw() {
    PFCanvas::setFrame(FRAME_W, FRAME_H);

    // 슬라이더 값을 내부 물리 파라미터로 정규화 매핑
    // density: Bars(1..4) 범위를 4.9 스케일에 맞춤
    float density = knobBars * 1.15f; 
    float trackPitch = 7.0f + (4.9f - density) * 1.8f;
    float trackWidth = trackPitch * 0.76f;
    float segPitch = 3.2f + (4.9f - density) * 0.45f;
    float segHeight = segPitch * 0.78f;

    float invTrackPitch = 1.0f / trackPitch;
    float invSegPitch = 1.0f / segPitch;

    // Bloom(0..10) 슬라이더를 0.0..1.0 범위의 공명/하모닉스로 스케일링
    float resonance = PFMath::clamp01(knobBloom * 0.1f);
    float baseFreq = 0.04f + resonance * 0.08f;

    // HueShift(0..360) 슬라이더를 0.0..1.0 색상 오프셋으로 변환
    float palBase = knobHueShift * (1.0f / 360.0f);

    float t = timeAcc;
    float t3_4 = t * 3.4f;
    float t1_6 = t * 1.6f;
    float t1_1 = t * 1.1f;

    for (int y = 0; y < FRAME_H; ++y) {
        float uRow = ySinA[y];
        float vRow = yCosA[y];

        for (int x = 0; x < FRAME_W; ++x) {
            float u = xCosA[x] + uRow;
            float v = -xSinA[x] + vRow;

            float trackFloat = u * invTrackPitch;
            int trackIdx = PFMath::ifloor(trackFloat);
            float uIn = u - (float)trackIdx * trackPitch;

            // 트랙 간격 (Gutter)
            if (uIn >= trackWidth) {
                PFCanvas::setPixel(x, y, 4, 2, 8);
                continue;
            }

            float vShift = v + (float)trackIdx * 13.7f;
            float segFloat = vShift * invSegPitch;
            int segIdx = PFMath::ifloor(segFloat);
            float vIn = vShift - (float)segIdx * segPitch;

            bool isSeam = (vIn >= segHeight);

            float sampleV = (float)segIdx * segPitch;
            float phase1 = sampleV * baseFreq - t3_4 + (float)trackIdx * 0.85f;
            float phase2 = sampleV * (baseFreq * 0.52f) + t1_6 - (float)trackIdx * 1.35f;
            float crossPhase = (float)trackIdx * 0.65f - t1_1;

            float w1 = PFMath::fastSin(phase1);
            float w2 = PFMath::fastSin(phase2);
            float w3 = PFMath::fastCos(crossPhase);

            float rawSignal = w1 * 0.55f + w2 * 0.35f + w3 * 0.25f;
            float pulseNorm = (rawSignal + 0.32f) * (1.0f / 1.32f);
            float pulse = pulseNorm > 0.0f ? pulseNorm : 0.0f;
            float energy = pulse * pulse * 1.35f;

            float trackHueShift = ((trackIdx & 1) == 0) ? 0.0f : 0.36f;
            float cellHue = palBase + trackHueShift + (sampleV * 0.003f) + (rawSignal * 0.08f);
            float hNorm = PFMath::fract(cellHue);

            // JS 원본 computeHsv(hNorm, 0.95, 1.0)의 실수 성분을 직접 산출
            float fH = hNorm * 6.0f;
            int iH = PFMath::ifloor(fH);
            float f = fH - (float)iH;
            constexpr float s = 0.95f;
            constexpr float vVal = 1.0f;
            constexpr float p = vVal * (1.0f - s);
            float q = vVal * (1.0f - f * s);
            float tCol = vVal * (1.0f - (1.0f - f) * s);

            float rOut, gOut, bOut;
            switch (iH % 6) {
                case 0:  rOut = vVal; gOut = tCol; bOut = p;    break;
                case 1:  rOut = q;    gOut = vVal; bOut = p;    break;
                case 2:  rOut = p;    gOut = vVal; bOut = tCol; break;
                case 3:  rOut = p;    gOut = q;    bOut = vVal; break;
                case 4:  rOut = tCol; gOut = p;    bOut = vVal; break;
                default: rOut = vVal; gOut = p;    bOut = q;    break;
            }

            int r = 0;
            int g = 0;
            int b = 0;

            if (energy < 0.2f) {
                float dim = energy * 5.0f; // energy / 0.2f
                r = PFMath::ifloor(rOut * 50.0f * dim + 6.0f);
                g = PFMath::ifloor(gOut * 50.0f * dim + 4.0f);
                b = PFMath::ifloor(bOut * 80.0f * dim + 14.0f);
            } else if (energy < 0.72f) {
                float tNorm = (energy - 0.2f) * (1.0f / 0.52f);
                float boost = 0.35f + 0.65f * tNorm;
                r = PFMath::clamp(PFMath::ifloor(rOut * 255.0f * boost), 0, 255);
                g = PFMath::clamp(PFMath::ifloor(gOut * 255.0f * boost), 0, 255);
                b = PFMath::clamp(PFMath::ifloor(bOut * 255.0f * boost), 0, 255);
            } else {
                float tHot = (energy - 0.72f) * (1.0f / 0.45f);
                if (tHot > 1.0f) tHot = 1.0f;

                float hotR = 255.0f;
                float hotG = 130.0f + 125.0f * tHot;
                float hotB = 40.0f + 215.0f * tHot;

                float invHot = 1.0f - tHot;
                r = PFMath::clamp(PFMath::ifloor(rOut * 255.0f * invHot + hotR * tHot), 0, 255);
                g = PFMath::clamp(PFMath::ifloor(gOut * 255.0f * invHot + hotG * tHot), 0, 255);
                b = PFMath::clamp(PFMath::ifloor(bOut * 255.0f * invHot + hotB * tHot), 0, 255);
            }

            // 베젤 및 심(Seam) 셰이딩
            if (isSeam) {
                r = PFMath::ifloor((float)r * 0.16f);
                g = PFMath::ifloor((float)g * 0.16f);
                b = PFMath::ifloor((float)b * 0.16f);
            } else if (uIn < 0.65f || uIn > (trackWidth - 0.65f) || vIn < 0.45f) {
                r = PFMath::ifloor((float)r * 0.72f);
                g = PFMath::ifloor((float)g * 0.72f);
                b = PFMath::ifloor((float)b * 0.72f);
            }

            PFCanvas::setPixel(x, y, (uint8_t)r, (uint8_t)g, (uint8_t)b);
        }
    }

    PFCanvas::present();
}

} // namespace NeonKineticMatrix