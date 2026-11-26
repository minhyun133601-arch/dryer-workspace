// 2팀 9동 벽·문·창.
//   외벽·계단실·창호: 9동 1~3층 평면도 A-05~07, 창호부호도·일람표 A-18~, 입면도(2007).
//   현재 칸막이·문·감시창: 2025 1·2층 작업장평면도(노란 문, 주황 창).
// 도면 로컬 좌표(m): +X 도면 오른쪽, +Z 출입구 쪽. X0 축은 -15.375, Y6 축은 -14.9다.
const SHELL = 'A-05~07 평면 · 창호일람표(2007)', PLAN = '2025 작업장평면도 · A-05~07 축';
const hole = (type, from, to, extra = {}) => ({ type, from, to, ...extra });
const glazing = (style, from, to, sill, height, extra = {}) => ({ window: style, from, to, sill, height, ...extra });
function wall(id, a, b, thickness, openings = [], extra = {}) {
  const along = Math.abs(b[0] - a[0]) >= Math.abs(b[1] - a[1]) ? 0 : 1, direction = Math.sign(b[along] - a[along]);
  return Object.freeze({ id, a, b, thickness, basis: PLAN, ...extra,
    openings: openings.map((entry) => Object.freeze({ ...entry, width: entry.width ?? Math.abs(entry.to - entry.from), offset: ((entry.from + entry.to) / 2 - a[along]) * direction })) });
}
const AMBER = { glass: 'amber', module: 2, upper: .7 }, OUT = { finish: 'outer', outer: true, basis: SHELL }, IN = { finish: 'panel' };
// CAW-1 투시창 1,200 × 800, F.L +1,200.
const sight = (from, to, sill = 1.2) => glazing('fixed', from, to, sill, .8, { module: 1.3 });

function shell(level, height) {
  const one = level === 1, three = level === 3, lights = [.5, 1, 1, 1];
  return [
    wall('north', [-15.76, -15.2], [15.76, -15.2], .12, three ? [glazing('slide', 3.35, 4.35, 1.1, 1.5, { id: 'north-window', glass: 'amber' })] : [], { ...OUT, height, skirting: 'positive' }),
    wall('west', [-15.7, -15.14], [-15.7, 15.14], .12, [
      ...(one ? [] : [hole('FSD2', -11.17, -10.27, { id: 'rear-stair-door', name: '계단실2 방화문', external: three, hinge: 1, swing: -1, exit: true, exitSide: -1, height: 2.1 }),
        glazing('two-tier', -9.34, 14.66, 1, 1.5, { ...AMBER, id: 'west-window', name: '서측 창 CAW-6' })]),
    ], { ...OUT, height, skirting: 'negative' }),
    wall('south-west', [-15.76, 15.2], [-5.46, 15.2], .12, one
      ? [hole('SWING2', -15.1, -13.3, { id: 'f1-material-entry', name: '부자재 반입문 SD-1' })]
      : [glazing('two-tier', -14.44, -6.44, 1, 1.5, { ...AMBER, id: 'south-west-window', name: '남측 창 CAW-7' })], { ...OUT, height, skirting: 'negative' }),
    wall('stair1-north', [-5.46, 15.2], [-.17, 15.2], .12, [hole('SWING', -4.74, -3.26, { id: 'entry-door', height: 2.25, external: true })], { ...OUT, height, skirting: 'negative' }),
    wall('south-east', [5.07, 15.2], [15.76, 15.2], .12, one
      ? [hole('SHUTTER', 5.47, 7.42, { id: 'south-shutter-1', height: 3.05, name: '남측 전동셔터 1', enterable: false }), hole('SHUTTER', 7.97, 9.92, { id: 'south-shutter-2', height: 3.05, name: '남측 전동셔터 2', enterable: false })]
      : [glazing('two-tier', 6.5, 14.5, 1, 1.5, { ...AMBER, id: 'south-east-window', name: '남측 창 CAW-7' })], { ...OUT, height, skirting: 'negative' }),
    wall('lift-head', [-.17, 15.2], [5.07, 15.2], .12, [hole('OPEN', -.1, 5, { id: 'lift-shaft', height: 3.05, external: true })], { ...OUT, height }),
    wall('east', [15.7, -15.14], [15.7, 15.14], .12, one
      ? [hole('SLIDE', -9.7, -7.2, { id: 'east-hanger-door', height: 3, name: '동측 행거도어', slide: 1, face: -1 }), hole('SHUTTER', 12.67, 14.62, { id: 'east-shutter', height: 3.05, name: '동측 전동셔터', enterable: false })]
      : [], { ...OUT, height, skirting: 'positive' }),
    // 계단실2 (3.45 × 5.5 m).
    wall('stair2-west', [-19.1, -15.2], [-19.1, -9.74], .12, [], { ...OUT, height }),
    wall('stair2-north', [-19.16, -15.2], [-15.76, -15.2], .12, [glazing('strip', -18.35, -15.85, .3, height - .9, { lights: [.5, 1, 1], id: 'stair2-window', name: '계단실2 창 CAW-3' })], { ...OUT, height }),
    wall('stair2-south', [-19.16, -9.74], [-15.76, -9.74], .12, one ? [hole('SSD2', -18.2, -15.8, { id: 'stair2-entry', name: '계단실2 유리문 SSD-1', side: .3 })] : [], { ...OUT, height }),
    // 계단실1 (5.3 × 3.1 m).
    wall('stair1-west', [-5.46, 15.26], [-5.46, 18.4], .12, one ? [hole('SSD2', 15.58, 17.98, { id: 'stair1-entry', name: '계단실1 유리문 SSD-1', side: .3 })] : [], { ...OUT, height }),
    wall('stair1-south', [-5.52, 18.34], [-.17, 18.34], .12, [glazing('strip', -4.81, -3.31, .3, height - .9, { lights }), glazing('strip', -2.21, -.71, .3, height - .9, { lights })], { ...OUT, height }),
  ];
}

const first = [
  // 부자재창고·외출부스.
  wall('material-store-front', [-15.64, -10.24], [-5.46, -10.24], .08, [hole('SWING2', -15, -13.28, { id: 'f1-material-store-door', name: '부자재창고 양개문 PD-1' }), sight(-10.2, -8.6), sight(-7.05, -5.75)], { ...IN, height: 5.4 }),
  wall('booth-west', [-6.73, -15.14], [-6.73, -12.67], .06, [hole('AIR', -14.5, -13.4, { id: 'f1-booth-west', name: '외출부스 문', hinge: 1 })], { ...IN, height: 2.6 }),
  wall('booth-south', [-6.73, -12.67], [-5.46, -12.67], .06, [], { ...IN, height: 2.6 }),
  // 소포장 포장실 동측 벽: 투시창 5곳, 이송 개구, 작업자 에어샤워.
  wall('small-pack-east', [-5.41, -15.14], [-5.41, 15.14], .08, [
    hole('AIR', -14.5, -13.4, { id: 'f1-booth-east', name: '외출부스 문', hinge: 1 }),
    sight(-9.6, -7.5, 1.4), sight(-6.1, -4.9, 1.45), sight(-3.4, -1.3, 1.45), sight(1.3, 3.4), sight(7, 9.1),
    hole('AIR', 13.2, 14.3, { id: 'f1-small-pack-personnel-entry', name: '작업자 에어샤워 출입구', hinge: 1 }),
  ], { ...IN, height: 5.4, transfer: true }),
  // 부자재 에어샤워.
  wall('material-shower-north', [-15.64, 11.39], [-12.3, 11.39], .08, [hole('SWING2', -15.1, -13.3, { id: 'f1-air-shower-entry', name: '부자재 에어샤워 안쪽 문 PD-1', swing: -1 })], { ...IN, height: 3 }),
  wall('material-shower-east', [-12.3, 11.39], [-12.3, 15.14], .08, [], { ...IN, height: 3 }),
  // 위생전실·CIP실.
  wall('hygiene-north', [-5.37, 12.66], [-2.24, 12.66], .08, [hole('SWING', -4.4, -3.4, { id: 'f1-hygiene-door', name: '위생전실 출입문', hinge: -1 })], { ...IN, height: 3 }),
  wall('hygiene-east', [-2.24, 12.07], [-2.24, 15.14], .08, [], { ...IN, height: 3 }),
  wall('cip-north', [-2.24, 12.07], [-1.09, 12.07], .08, [hole('AD1', -2.07, -1.27, { id: 'f1-cip-entry', name: 'CIP실 문', hinge: -1 })], { ...IN, height: 3 }),
  wall('cip-east', [-1.09, 12.07], [-1.09, 15.14], .08, [], { ...IN, height: 3 }),
  // 외포장실과 통로 사이 두 겹 벽.
  wall('aisle-inner', [11.19, -15.14], [11.19, 15.14], .08, [hole('SHUTTER', -13.8, -9.2, { id: 'f1-aisle-shutter', name: '외포장실 대형 셔터', height: 3 }), hole('HATCH', 12.6, 14.5, { id: 'f1-aisle-conveyor-inner', sill: .25, height: 1.6 })], { ...IN, height: 5.4 }),
  wall('aisle-outer', [12.3, -15.14], [12.3, 15.14], .08, [hole('HATCH', 12.6, 14.5, { id: 'f1-aisle-conveyor-outer', sill: .25, height: 1.6 })], { ...IN, height: 5.4 }),
];

const second = [
  // 북측 실: 창고·CIP룸·휴게실·사무실.
  wall('north-rooms-front', [-15.64, -12.77], [3.13, -12.77], .08, [
    hole('SWING', -13.4, -12.4, { id: 'f2-store-door', name: '창고 출입문', plate: '창고' }), hole('SWING', -10.1, -9.1, { id: 'f2-cip-door', name: 'CIP룸 출입문', plate: 'CIP룸' }),
    glazing('fixed', -6.2, -5.3, 1.2, .8), hole('SWING', -3.4, -2.4, { id: 'f2-break-door', name: '휴게실 출입문', plate: '휴게실' }),
  ], { ...IN, height: 3 }),
  ...[-11.92, -6.9, -.63, 3.13].map((x, index) => wall(`north-rooms-divider-${index + 1}`, [x, -15.14], [x, -12.81], .08, index === 3 ? [hole('SWING', -14.4, -13.4, { id: 'f2-office-door', name: '사무실 출입문', hinge: 1, basis: '2025 평면도에 문 표기 없음 · 위치 추정' })] : [], { ...IN, height: 3 })),
  ...[8.14, 13.15].map((x) => wall(`hot-air-side-${x}`, [x, -15.14], [x, -12.81], .08, [], { ...IN, height: 3 })),
  wall('hot-air-front', [8.14, -12.77], [13.15, -12.77], .08, [hole('OPEN', 10, 11.3, { id: 'f2-hot-air-opening', height: 2.2 })], { ...IN, height: 3 }),
  // 호퍼실 동측 벽: 5.7 m 개구 문 두 곳과 작은 문.
  wall('hopper-room-east', [-4.41, -12.73], [-4.41, 15.14], .08, [
    hole('SHUTTER', -10.7, -5, { id: 'f2-hopper-door-north', name: '호퍼실 대형 문 1', height: 3 }), hole('SHUTTER', 1.8, 7.5, { id: 'f2-hopper-door-south', name: '호퍼실 대형 문 2', height: 3 }),
    hole('SWING2', 10.56, 12.3, { id: 'f2-vmix-door', name: 'V-MIX 구역 문' }),
  ], { ...IN, height: 5.6 }),
  // 스틱 포장실.
  wall('stick-north', [4.39, -11.57], [15.64, -11.57], .08, [], { ...IN, height: 5.4 }),
  wall('stick-west', [4.39, -11.57], [4.39, 5.48], .08, [
    sight(-9.1, -7.4, 1.45), hole('AIR', -4.45, -3.45, { id: 'f2-exit-booth-west', name: '스틱 포장실 퇴출구', hinge: 1 }), sight(-3, -1.2, 1.45), sight(2, 3.7, 1.45),
  ], { ...IN, height: 5.4, transfer: true }),
  // 퇴출구 부스: 평면도는 3호기 옆이다. 모델 설비 줄 간격에 맞춰 컨베이어 남쪽에 둔다.
  wall('exit-booth-north', [4.43, -4.75], [6.24, -4.75], .06, [], { ...IN, height: 2.6 }), wall('exit-booth-south', [4.43, -3.15], [6.24, -3.15], .06, [], { ...IN, height: 2.6 }),
  wall('exit-booth-east', [6.24, -4.75], [6.24, -3.15], .06, [hole('AIR', -4.45, -3.45, { id: 'f2-exit-booth-east', name: '퇴출구 안쪽 문', hinge: 1 })], { ...IN, height: 2.6 }),
  wall('stick-south-a', [4.39, 5.48], [10.6, 5.48], .08, [hole('AIR', 7.85, 8.85, { id: 'f2-stick-entry', name: '스틱 포장실 출입구', hinge: -1 })], { ...IN, height: 5.4 }),
  wall('stick-south-b', [14.4, 5.48], [15.64, 5.48], .08, [], { ...IN, height: 5.4 }),
  wall('stick-south-head', [10.6, 5.48], [14.4, 5.48], .08, [hole('OPEN', 10.62, 14.38, { id: 'f2-air-shower-bay', height: 2.6, external: true })], { ...IN, height: 5.4 }),
  // 작업자 출입 부스와 위생전실.
  wall('entry-booth-west', [7.4, 5.52], [7.4, 6.9], .06, [], { ...IN, height: 2.6 }), wall('entry-booth-south', [7.4, 6.9], [9.36, 6.9], .06, [hole('AIR', 7.85, 8.85, { id: 'f2-entry-booth', name: '작업자 에어샤워 문', hinge: -1 })], { ...IN, height: 2.6 }),
  wall('hygiene-west', [4.39, 5.48], [4.39, 7.9], .08, [], { ...IN, height: 3 }),
  wall('hygiene-south', [4.39, 7.9], [9.4, 7.9], .08, [hole('SWING', 6, 7.2, { id: 'f2-hygiene-door', name: '위생전실 출입문', plate: '위생전실' })], { ...IN, height: 3 }),
  // 부자재 에어샤워·부자재창고·공조실.
  wall('material-shower-north', [10.6, 5], [14.4, 5], .06, [hole('SWING2', 11.6, 13.4, { id: 'f2-air-shower-inner', name: '부자재 에어샤워 안쪽 문', swing: 1 })], { ...IN, height: 2.6 }),
  wall('material-shower-south', [10.6, 7], [14.4, 7], .06, [hole('SWING2', 11.6, 13.4, { id: 'f2-air-shower-outer', name: '부자재 에어샤워 바깥 문', swing: -1 })], { ...IN, height: 2.6 }),
  wall('material-shower-west', [10.6, 5], [10.6, 7], .06, [], { ...IN, height: 2.6 }), wall('material-shower-east', [14.4, 5], [14.4, 7], .06, [], { ...IN, height: 2.6 }),
  wall('stores-west', [9.4, 5.48], [9.4, 15.14], .08, [hole('SLIDE', 8.25, 10, { id: 'f2-material-store-door', slide: -1, name: '부자재창고 미닫이문', plate: '부자재창고' }), hole('SWING', 12.3, 13.4, { id: 'f2-air-room-door', name: '공조실 문', hinge: 1, plate: '공조실' })], { ...IN, height: 3 }),
  wall('stores-split', [9.4, 10.34], [15.64, 10.34], .08, [], { ...IN, height: 3 }),
];

export const PACKAGING_WALL_PLAN = Object.freeze({
  1: Object.freeze({ height: 5.6, interior: true, walls: [...shell(1, 5.6), ...first] }),
  2: Object.freeze({ height: 5.75, interior: true, walls: [...shell(2, 5.75), ...second] }),
  3: Object.freeze({ height: 6, interior: false, walls: shell(3, 6) }),
});
