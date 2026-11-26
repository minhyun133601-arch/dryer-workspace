// 4동(건조동) 벽·기둥·창호. 준공 도면의 좌표를 그대로 옮겼다.
//   평면 A-013~018(58094e31), 창호평면 A-042~046(2515ed18), 창호도 A-047~051
//   (951a9365, 준공 06.07.10), 입면 A-011~012 변경후(894c3a63).
// 도면 X1 축과 Y8 축이 만나는 점이 (0, 0)이며 X는 동쪽, Z는 남쪽, 단위는 m다.
// 현장 영상이 도면과 다른 곳은 영상을 따르고 basis에 남긴다.
const local = ([x, z]) => [x - 8.6, z - 13.4];
const DRAWN = 'A-013~018 평면 · A-042~051 창호 (준공 06.07.10)';

// from/to are plan coordinates along the wall, so every opening can be read
// straight off the drawing.
const hole = (type, from, to, extra = {}) => ({ type, from, to, ...extra });
const glazing = (style, from, to, sill, height, extra = {}) => ({ window: style, from, to, sill, height, ...extra });
function wall(id, a, b, thickness, openings = [], extra = {}) {
  const along = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]) ? 0 : 1, direction = Math.sign(b[along] - a[along]);
  return Object.freeze({
    id, a: local(a), b: local(b), thickness, basis: DRAWN, ...extra,
    openings: openings.map((entry) => Object.freeze({
      ...entry, width: Math.abs(entry.to - entry.from), offset: ((entry.from + entry.to) / 2 - a[along]) * direction,
      plan: { from: entry.from, to: entry.to },
    })),
  });
}

const AMBER = { glass: 'amber', module: 2, upper: .7 };
const OUTER = { finish: 'outer', outer: true };
// 외벽: 안쪽 면은 축에서 +0.06, 바깥 면은 외장판넬 0.25.
const N = -.095, W = -.095, S = 26.895, E = 17.295, T = .31;

const strips = Object.freeze({ pair: [1, 1, .5], stair: [1, 1, .5, 1, .5] });
// A-016 4·5·6층 공통: 남측 P.S와 EPS.
function servicesSouth() {
  return [
    wall('south-ps-front', [9.6, 26.25], [12, 26.25], .1, [hole('SSD7', 10.62, 11.18, { id: 'south-ps-door', name: '남측 P.S 점검문', hinge: 1 })]),
    wall('south-ps-west', [9.65, 26.3], [9.65, 26.74], .1), wall('south-ps-east', [11.95, 26.3], [11.95, 26.74], .1),
    wall('eps-north', [16, 24.95], [17.14, 24.95], .1),
    wall('eps-west', [16.05, 25], [16.05, 26.74], .1, [hole('SSD7', 25.92, 26.48, { id: 'eps-door', name: 'EPS 점검문', hinge: 1 })]),
  ];
}
// 서측 계단실, P.S, 엘리베이터, 북동 계단실과 전실.
function towerCore() {
  return [
    wall('west-stair-south', [.06, 5.2], [3.1, 5.2], .2, [hole('FSD2', .12, 1.12, { id: 'west-stair-door', name: '서측 계단실 방화문', hinge: -1, swing: -1, exit: true })]),
    wall('west-stair-east', [3, .06], [3, 5.1], .2),
    wall('ps-west', [12.6, .06], [12.6, 2.9], .2, [hole('SSD7', 1.22, 1.98, { id: 'ps-door', name: 'P.S 점검문', hinge: 1 })]),
    wall('ps-lift-south', [12.5, 2.8], [17.1, 2.8], .2, [hole('LIFT', 14.7, 16.1, { id: 'lift-landing', name: '엘리베이터', external: true })]),
    wall('ps-lift-divider', [13.8, .06], [13.8, 2.7], .2),
    wall('lobby-west', [17.2, .06], [17.2, 6.98], .2, [hole('FSD2', 5.42, 6.38, { id: 'lobby-door', name: '북동 계단실 방화문', hinge: 1, swing: -1, exit: true })]),
    wall('lobby-east', [18.675, 2.9], [18.675, 7.15], .35, [glazing('strip', 3.7, 4.2, 1.1, 1.5, { lights: [.5, 1] }), glazing('strip', 5.7, 6.2, 1.1, 1.5, { lights: [.5, 1] })], { ...OUTER, skirting: 'positive' }),
    wall('lobby-south', [17.14, 6.975], [18.5, 6.975], .35, [], { ...OUTER, skirting: 'negative' }),
    wall('ne-stair-south', [18.5, 2.875], [22.25, 2.875], .35, [], { ...OUTER, skirting: 'negative' }),
    wall('ne-stair-east', [22.075, -.25], [22.075, 2.7], .35, [], { ...OUTER, skirting: 'positive' }),
    ...servicesSouth(),
  ];
}
function towerShell({ height, west }) {
  return [
    wall('north', [-.25, N], [22.25, N], T, [
      glazing('strip', .5, 2.5, .25, height - .75, { lights: strips.pair, id: 'stair-window-west', name: '서측 계단실 창 AW-12' }),
      hole('SHUTTER', 3.5, 7.8, { id: 'north-shutter', height: 4.5, name: '북측 셔터 AS-5', enterable: false }),
      glazing('two-tier', 8.4, 12.4, 1, 1.5, { ...AMBER, id: 'north-window', name: '북측 창 AW-6' }),
      glazing('strip', 17.3, 19.3, .25, height - .75, { lights: strips.stair, id: 'stair-window-northeast', name: '북동 계단실 창 AW-13' }),
    ], { ...OUTER, skirting: 'positive' }),
    wall('west', [W, .06], [W, 26.74], T, [
      glazing('strip', 2, 2.5, .25, height - .75, { lights: [1.5, .5] }), glazing('strip', 4.6, 5.1, .25, height - .75, { lights: [1.5, .5] }), ...west,
    ], { ...OUTER, skirting: 'negative' }),
    wall('south', [-.25, S], [17.45, S], T, [], { ...OUTER, skirting: 'negative' }),
    wall('east', [E, 7.15], [E, 26.74], T, [], { ...OUTER, skirting: 'positive' }),
  ];
}

// 현장 사진·영상에서 실제로 확인된 실내 독립 기둥만 남긴다(벽 속·미촬영 구역 기둥 제외).
const cols = (points, extra = {}) => points.map(([x, z]) => Object.freeze({ position: local([x, z]), size: .4, ...extra }));

const FULL_WEST = [glazing('two-tier', 8.1, 26.1, 1, 1.5, { ...AMBER, lastFull: true, id: 'west-window', name: '서측 창 AW-8' })];

// 3층: 외벽·계단실·P.S는 도면, 작업구역 칸막이·보관실·동측 판넬실은 11/25 영상.
// 동·서 창 모듈과 기둥 간격(2.425 m)을 대조해 칸막이 위치를 잡았다.
const VIDEO3 = { basis: '2026-11-25 3층 영상 · 창 모듈과 기둥 간격 대조' };
export const THIRD_HALL = Object.freeze({
  partition: { east: 13.8, west: 11.1, jog: 5.6 }, wicket: [8.4, 13.8],
  windows: [10.3, 15.75], storage: { minX: 8.45, maxX: 12.4, maxZ: 4.35 }, eastRoom: { minX: 16.1, minZ: 20.1, maxZ: 24.9, height: 2.75 },
});
const THIRD = { height: 5.9 };
const thirdWalls = [
  wall('north', [-.25, N], [17.2, N], T, [
    glazing('strip', .5, 2.5, .25, 5.1, { lights: strips.pair, id: 'stair-window-west', name: '서측 계단실 창 AW-12', glass: 'frosted' }),
    hole('SHUTTER', 3.5, 7.8, { id: 'north-shutter', height: 4.5, external: true }),
    glazing('fixed', 8.47, 12.37, 1, 1.5, { id: 'storage-window', external: true }),
  ], { ...OUTER, skirting: 'positive' }),
  wall('west', [W, .06], [W, 26.74], T, [
    glazing('strip', 2, 2.5, .25, 5.1, { lights: [1.5, .5], glass: 'frosted' }), glazing('strip', 4.6, 5.1, .25, 5.1, { lights: [1.5, .5], glass: 'frosted' }),
    glazing('two-tier', 8.1, 26.1, 1, 1.5, { ...AMBER, lastFull: true, id: 'west-window', name: '서측 황색창 AW-8' }),
  ], { ...OUTER, skirting: 'negative' }),
  wall('south', [-.25, S], [17.45, S], T, [glazing('two-tier', 7.3, 11.3, 1, 1.5, { ...AMBER, id: 'south-window', name: '남측 창 AW-6' })], { ...OUTER, skirting: 'negative' }),
  wall('east', [E, 7.15], [E, 26.74], T, [
    glazing('two-tier', 8.1, 20.1, 1, 1.5, { ...AMBER, id: 'east-window', name: '동측 황색창 AW-7' }),
    hole('SD1', 24, 24.95, { id: 'south-roof-door', name: '남동측 옥상 철문 SD-1', enterable: false, hinge: 1 }),
  ], { ...OUTER, skirting: 'positive' }),
  wall('west-stair-east', [3, .06], [3, 5.1], .2),
  wall('ps-west', [12.6, .06], [12.6, 2.9], .2, [hole('SSD7', 1.22, 1.98, { id: 'ps-door', name: 'P.S 점검문', hinge: 1 })]),
  wall('ps-lift-south', [12.5, 2.8], [17.1, 2.8], .2, [hole('LIFT', 14.7, 16.1, { id: 'lift-landing', external: true, height: 2.2 })]),
  wall('ps-lift-divider', [13.8, .06], [13.8, 2.7], .2),
  wall('lobby-west', [17.2, .06], [17.2, 6.98], .2, [hole('FSD2', 4.275, 5.325, { id: 'third-ne-stair-door', external: true, height: 2.2 })]),
  wall('ne-stair-south', [18.9, 2.95], [22.1, 2.95], .2, [], OUTER), wall('ne-stair-east', [22, .06], [22, 2.85], .2, [], OUTER),
  ...servicesSouth(),
  // 동측 남단 판넬실: 창이 끝나는 곳부터 EPS까지, 높이 2.75 m.
  wall('east-room-west', [16.1, 20.15], [16.1, 24.9], .1, [hole('PD1', 21.6, 23.4, { id: 'east-room-door', name: '동측 판넬실 양개문', enterable: false, width: 1.8 })], { height: 2.75, finish: 'panel', ...VIDEO3 }),
  wall('east-room-north', [16.05, 20.1], [17.14, 20.1], .1, [], { height: 2.75, finish: 'panel', ...VIDEO3 }),
].map((entry) => Object.freeze({ height: THIRD.height, ...entry }));

// 1층·1.5층. 북·서·남 외벽과 북측 실, 청정구역은 준공 도면, 동측 조제실 쪽은
// 사용자 확인과 2026-11-11~13 영상으로 잡은 기존 벽을 그대로 쓴다.
const E1 = 43.095, S1 = 35.095;
const southStrips = [4.4, 6.1, 7.8, 22.7, 24.4, 26.1, 27.8, 29.5, 32.6, 34.3, 36, 38, 39.7, 41.4];
const STRIP = { glass: 'amber', lights: [.5, 1.5, 1.5, .5, 1.3] };
const lowCore = (level) => [
  wall('ps-west', [12.6, .06], [12.6, 2.9], .2, [hole('SSD7', 1.22, 1.98, { id: 'ps-door', name: 'P.S 점검문', hinge: 1 })]),
  wall('ps-lift-south', [12.5, 2.8], [17.1, 2.8], .2, level === 1 ? [hole('LIFT', 14.7, 16.1, { id: 'lift-landing', external: true, height: 2.2 })] : []),
  wall('ps-lift-divider', [13.8, .06], [13.8, 2.7], .2),
  wall('lift-east', [17.2, .06], [17.2, 2.9], .2),
  wall('stair4-south', [17.3, 2.8], [22.1, 2.8], .2, level === 1 ? [hole('SSD4', 17.35, 18.3, { id: 'stair4-door', name: '북동 계단실 유리문', hinge: -1 })] : []),
  wall('stair4-east', [22, .06], [22, 2.7], .2),
];
// 1층 외포장 홀 영상(234~282초)에서 실제로 보이는 기둥 2곳만 반영(조제실 기둥 1곳은 preparation-environment.js에서 별도 생성).
const lowColumns = cols([[3.2, 26.8], [9.3, 26.8]], { cover: .5 });

const firstFloor = [
  wall('north', [-.25, N], [43.25, N], T, [
    hole('SSD2', .1, 2.9, { id: 'north-west-entry', name: '서측 계단실 출입문 SSD-2' }),
    hole('SHUTTER', 8.4, 12.4, { id: 'north-shutter-4x4', height: 4, name: '북측 수동셔터 AS-6', enterable: false }),
    hole('LIFT', 14.65, 16.25, { id: 'north-lift-door', name: '엘리베이터 북측 문(1층 관통형)', face: -1 }),
    hole('SSD3', 17.3, 19.1, { id: 'north-stair4-entry', name: '북동 계단실 출입문 SSD-3' }),
    glazing('fixed', 22.5, 24.9, 2.45, .5, { id: 'north-high-window', name: '북측 고창 AW-4' }),
    hole('SHUTTER', 25.5, 27.9, { id: 'north-pack-store-shutter', height: 2.4, name: '포장창고 셔터 AS-4', enterable: false }),
    hole('FSD1', 28.7, 30.5, { id: 'north-work-entry', name: '북측 방화문 FSD-1' }),
    hole('SSD4', 31.1, 32, { id: 'north-breakroom-entry', name: '1팀 2파트 휴게실 계단 유리문 SSD-4' }),
    glazing('louver', 37.1, 37.5, 1, .4),
  ], { ...OUTER, height: 6.6, skirting: 'positive' }),
  wall('west', [W, .06], [W, 34.94], T, [hole('SHUTTER', 29.9, 31.9, { id: 'west-product-exit', height: 2.4, name: '제품 출구 AS-3' })], { ...OUTER, height: 6.6, skirting: 'negative' }),
  wall('south', [-.25, S1], [43.25, S1], T, [
    hole('SSD4', .54, 1.5, { id: 'south-west-exit', name: '남서측 출입문 SSD-4' }),
    hole('SHUTTER', 11.9, 13.9, { id: 'south-pallet-1', height: 2.4, name: '파레트 공급문 1 AS-3' }),
    hole('SHUTTER', 17.3, 19.3, { id: 'south-pallet-2', height: 2.4, name: '파레트 공급문 2 AS-3' }),
    ...southStrips.map((x) => glazing('strip', x, x + .5, .58, 5.3, STRIP)),
  ], { ...OUTER, height: 6.6, skirting: 'negative' }),
  wall('east', [E1, .06], [E1, 34.94], T, [
    hole('SHUTTER', 12.5, 15.5, { id: 'raw-exterior', external: true, height: 3 }), hole('SSD1', 29.7, 32.3, { id: 'team1-part2', external: true, height: 2.65 }),
    glazing('fixed', 32.85, 33.95, .65, 2.4, { external: true }), glazing('slide', 25, 26.5, 1.46, .5), glazing('slide', 26.95, 28.45, 1.46, .5),
  ], { ...OUTER, height: 6.6 }),
  ...lowCore(1),
  // 서측 계단-3과 북서 위생전실.
  wall('stair3-south', [.06, 5.2], [3.1, 5.2], .2), wall('stair3-east', [3, 1.45], [3, 5.1], .2),
  wall('nw-hygiene-south', [3.1, 1.8], [6.7, 1.8], .2),
  wall('nw-hygiene-east', [6.6, .06], [6.6, 1.7], .2, [hole('AUTO', .92, 1.68, { id: 'nw-hygiene-auto', name: '북서 위생전실 자동문', width: .76 })]),
  // 충전구역.
  wall('charging-south', [22.1, 2.8], [24.9, 2.8], .2, [hole('SWING2', 22.15, 24.1, { id: 'charging-door', name: '충전구역 양개문', swing: -1 })]),
  // 청정구역 19.0 × 9.7 m. 남면은 1.5층 바닥 아래 높이까지만 판넬이다.
  wall('clean-north', [3.05, 6.9], [22.1, 6.9], .12, [hole('SLIDE', 9.3, 12.3, { id: 'clean-north-slide', name: '청정구역 북측 미닫이문', height: 2.6, leaves: 2, face: -1 })], { height: 6.15, finish: 'panel' }),
  wall('clean-west', [3.05, 6.9], [3.05, 16.6], .12, [], { height: 3.5, finish: 'panel' }),
  wall('clean-south', [3.05, 16.6], [18.95, 16.6], .12, [], { height: 3.45, finish: 'panel' }),
  wall('clean-east', [22, 6.9], [22, 16.7], .2, [hole('FSD1', 7.9, 9.7, { id: 'clean-emergency', name: '청정구역 비상문', exit: true, exitSide: -1 })], { height: 6.15 }),
  wall('clean-store-west', [19, 7.5], [19, 16.7], .2, [hole('AUTO', 13.95, 15.15, { id: 'clean-auto', name: '청정구역 자동문' })], { height: 3.45 }),
  wall('clean-store-south', [19.1, 13.35], [21.9, 13.35], .2, [], { height: 3.45 }),
  wall('clean-air-wall', [20.4, 13.45], [20.4, 15.25], .2, [hole('AIR', 14.45, 15.15, { id: 'clean-air-shower', name: '청정구역 에어샤워', width: .8, hinge: 1 })], { height: 3.45 }),
  wall('clean-exit-north', [19.1, 15.35], [20.5, 15.35], .2, [], { height: 3.45 }),
  wall('clean-exit-east', [20.1, 15.45], [20.1, 16.6], .2, [hole('AIR', 15.65, 16.3, { id: 'clean-exit-booth', name: '퇴출부스', width: .8, enterable: false })], { height: 3.45 }),
  wall('clean-entry-south', [19.1, 16.6], [21.9, 16.6], .2, [hole('SWING', 21.1, 21.9, { id: 'clean-entry', name: '청정구역 작업자 출입문', width: .8, hinge: 1, swing: -1 })], { height: 3.45 }),
  // 포장창고 쪽 구획.
  wall('x7-north', [25, .06], [25, 9.9], .2, [hole('CAD1', 4.5, 6.5, { id: 'pack-store-door', name: '포장창고 미서기문 CAD-1' }), hole('CAD1', 7.9, 9.1, { id: 'equipment-store-door', name: '설비창고 미서기문 CAD-1', width: 1.2 })], { height: 6.3 }),
  wall('pack-store-east', [28, .06], [28, 9.9], .2, [hole('CAD1', 7.9, 9.1, { id: 'store-link-door', name: '창고 연결 미서기문 CAD-1', width: 1.2 })], { height: 3.45 }),
  wall('pack-store-south', [25.1, 7], [27.9, 7], .2, [], { height: 3.45 }),
  wall('work-room-south', [28.1, 6], [30.9, 6], .2, [hole('CAD1', 28.6, 30.4, { id: 'work-room-door', name: '북측 작업실 미서기문 CAD-1', width: 1.8 })], { height: 3.45 }),
  wall('stair5-west', [31, .06], [31, 9.9], .2, [], { height: 6.3 }), wall('stair5-east', [32.4, .06], [32.4, 9.9], .2, [], { height: 6.3, finish: 'concrete' }),
];
const mezzanineWindowsWest = [28.35, 19.85, 11.85].map((z) => glazing('fixed', z, z + 1.1, .4, 2.2, { external: true }));
const secondFloor = [
  wall('north', [-.25, N], [43.25, N], T, [
    glazing('strip', .5, 2.5, .25, 3, { lights: strips.pair, id: 'stair-window-west', name: '서측 계단실 창 AW-12', glass: 'frosted', external: true }),
    glazing('strip', 17.3, 19.3, .25, 3, { lights: strips.stair, id: 'stair-window-northeast', name: '북동 계단실 창 AW-13', glass: 'frosted' }),
    glazing('two-tier', 26.4, 30.4, .95, 1.5, { ...AMBER, id: 'break-window', name: '휴게실 창 AW-6' }),
  ], { ...OUTER, height: 3.4, skirting: 'positive' }),
  wall('west', [W, .06], [W, 34.94], T, mezzanineWindowsWest, { ...OUTER, height: 3.4, skirting: 'negative' }),
  wall('south', [-.25, S1], [43.25, S1], T, southStrips.map((x) => glazing('strip', x, x + .5, .02, 2.36, { glass: 'amber', lights: [.5, 1.3, .56] })), { ...OUTER, height: 3.4, skirting: 'negative' }),
  wall('east', [E1, .06], [E1, 34.94], T, [glazing('slide', 25, 26.5, 1.42, .5), glazing('slide', 26.95, 28.45, 1.42, .5), glazing('strip', 34.05, 34.55, .58, 1.5, { lights: [.5, 1], glass: 'amber' })], { ...OUTER, height: 3.4 }),
  ...lowCore(2),
  wall('x7', [25, .06], [25, 30.35], .2, [], { height: 3.3 }),
  wall('clean-east', [22, 6.9], [22, 16.7], .2, [], { height: 2.6 }),
  wall('break-south', [25.1, 10], [42.9, 10], .2, [], { height: 3.3 }),
  wall('break-east', [31, .06], [31, 9.9], .2, [hole('FSD2', 7, 7.95, { id: 'break-door', name: '1팀 2파트 휴게실 방화문', hinge: -1, plate: '1팀 2파트 휴게실', plateSide: -1 }), hole('WD2', 8.25, 9.05, { id: 'break-store-door', name: '휴게실 창고문', hinge: -1, swing: -1 })], { height: 3.3 }),
  wall('stair5-east', [32.4, .06], [32.4, 9.9], .2, [], { height: 3.3, finish: 'concrete' }),
  wall('stair5-store', [31.1, 8.15], [32.3, 8.15], .2, [], { height: 3.3 }),
];

export const DRYER_WALL_PLAN = Object.freeze({
  1: Object.freeze({ height: 6.3, walls: firstFloor.map((entry) => Object.freeze({ height: 3.45, ...entry })), columns: lowColumns }),
  2: Object.freeze({ height: 3.4, walls: secondFloor, columns: [] }),
  3: Object.freeze({ height: THIRD.height, walls: thirdWalls, columns: cols([[9.3, 16.4], [9.3, 22]]) }),
  4: Object.freeze({ height: 6.65, walls: [...towerShell({ height: 6.65, west: FULL_WEST }), ...towerCore()], columns: cols([[3.2, 6.7], [9.3, 16.4]]) }),
  5: Object.freeze({ height: 5.75, walls: [...towerShell({ height: 5.75, west: FULL_WEST }), ...towerCore()], columns: cols([[8.1, 6.7], [13.6, 6.7]]) }),
  6: Object.freeze({
    height: 6.2, columns: cols([[6.5, 9.6]]),
    walls: [
      ...towerShell({ height: 6.2, west: [
        glazing('two-tier', 8.1, 16.1, 1, 1.5, { ...AMBER, id: 'west-window', name: '서측 창 AW-9' }),
        glazing('louver', 18.5, 20, 3.5, 1.5, { id: 'west-louver', name: '서측 갤러리 AG-3' }),
        glazing('slide', 24.1, 26.1, 1, 1.5, { glass: 'amber', id: 'west-escape-window', name: '서측 창 AW-14' }),
      ] }),
      ...towerCore(),
    ],
  }),
  7: Object.freeze({
    height: 4.8,
    walls: [
      wall('hall-north', [-.25, 6.9], [17.1, 6.9], .2, [glazing('fixed', 6.4, 12.4, 2.5, .8, { glass: 'amber', module: 2, id: 'hall-north-window', name: '북측 고창 AW-10' })], OUTER),
      wall('west', [W, 6.8], [W, 26.74], T, [
        glazing('two-tier', 8.1, 16.1, 1, 1.5, { ...AMBER, id: 'west-window', name: '서측 창 AW-9-1' }),
        glazing('slide', 24.1, 26.1, 1, 1.5, { glass: 'amber', id: 'west-escape-window', name: '서측 창 AW-14' }),
      ], OUTER),
      wall('south', [-.25, S], [17.45, S], T, [], OUTER),
      wall('east', [E, 7.15], [E, 26.74], T, [], OUTER),
      ...servicesSouth(),
    ],
    columns: [],
  }),
  // 7층 바닥과 같은 높이의 옥외 서비스 구역: 북동 계단실·전실.
  8: Object.freeze({
    height: 2.8,
    walls: [
      wall('lobby-west', [17.2, 4.6], [17.2, 6.98], .2, [hole('FSD1', 4.64, 6.38, { id: 'roof-lobby-door', name: '옥상 출입 방화문', swing: -1, exit: true })]),
      wall('lobby-east', [18.675, 2.9], [18.675, 7.15], .35, [glazing('strip', 3.7, 4.2, 1.1, 1.5, { lights: [.5, 1] }), glazing('strip', 5.7, 6.2, 1.1, 1.5, { lights: [.5, 1] })], OUTER),
      wall('lobby-south', [17.1, 6.975], [18.5, 6.975], .35, [], OUTER),
      wall('ne-stair-north', [17.1, N], [22.25, N], T, [glazing('strip', 17.3, 19.3, .25, 2.2, { lights: strips.stair, id: 'stair-window-northeast', name: '북동 계단실 창 AW-13' })], OUTER),
      wall('ne-stair-south', [18.5, 2.875], [22.25, 2.875], .35, [], OUTER),
      wall('ne-stair-east', [22.075, -.25], [22.075, 2.7], .35, [], OUTER),
      wall('lift-room-east', [17.2, -.25], [17.2, 4.6], .2),
    ],
    columns: [],
  }),
});

export const dryerWallPlan = (level) => DRYER_WALL_PLAN[level];
export const planPoint = local;
export { wall as planWall, hole as planDoor, glazing as planWindow };
