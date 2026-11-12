// Latest entrance-to-Team-2 walkthrough, 2026-11-12. Times are video seconds.
// Dimensions and individual window offsets are visual reconstruction choices;
// the footage establishes the facade sequence, materials and component types.
export const ENTRANCE_PRODUCTION_SURVEY = Object.freeze({
  source: 'entrance-route-video-20261112', dimensionsMeasured: false,
  inspectedRangeSeconds: [0, 145],
  sourceTimes: { frontage: [2, 8, 14, 20], sideWall: [24, 36, 46, 56, 64, 68], siteMap: [136, 144] },
  sideWall: Object.freeze({ sillHeight: 1.12, windowHeight: 1.16, blackPlinthHeight: .32, lowerWhiteBandHeight: 1.12 }),
  // A sequence of separate sliding-window banks replaces the former single
  // uniform strip. Count/offsets are model approximations, not surveyed bays.
  sideWindowBanks: Object.freeze([
    { z: 22.1, width: 3.1, panes: 2 }, { z: 17.9, width: 2.65, panes: 2 },
    { z: 13.8, width: 3.3, panes: 3 }, { z: 9.45, width: 2.9, panes: 2 },
    { z: 5.3, width: 3.1, panes: 2 }, { z: 1.1, width: 2.55, panes: 2 },
    { z: -3, width: 3.3, panes: 3 }, { z: -7.4, width: 2.9, panes: 2 },
    { z: -11.6, width: 3.1, panes: 2 }, { z: -15.8, width: 2.65, panes: 2 },
    { z: -20.1, width: 3.3, panes: 3 },
  ]),
  sideDrainZ: Object.freeze([24.95, 15.95, 7.45, -1.05, -9.55, -18.05, -24.95]),
  evidence: Object.freeze([
    '3동 전면: 어두운 큰 개구부, 청회색 캐노피와 사선 지지봉, 문 양옆 낮은 창, 황흑 보호기둥',
    '도로측 긴 벽: 밝은 세로골판 상부, 흰 하단 띠, 검정 기초, 작은 미닫이창 묶음과 색이 다른 프레임',
    '담수·폐수 배관이 아니라 외벽 낙수관: 베이지 상부와 흰 하부·바닥 쪽 엘보',
    '68초 모서리 부근 노랑·흰색 과속방지턱, 안쪽 흰 횡단보도와 모퉁이 반사경',
  ]),
});
