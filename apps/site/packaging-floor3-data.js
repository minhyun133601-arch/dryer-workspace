// 2팀 3층(9동) 배치. 실 이름·문·렉·평치·PDA와 호퍼 순서는 2026-11-24 현장 게시
// 「3층 작업장(Location 라벨표시 및 PDA위치도)」, 본체·작업대·칸막이 치수는 A-07과
// 측량본을 따른다. 도면 로컬 좌표(m): +X 도면 오른쪽, +Z 출입구 쪽, Y=0은 3층 바닥.
// 이동 설비는 저장 배치와 같은 0.25 m 격자에 둔다.
import { PACKAGING_WALL_PLAN } from './packaging-wall-plan.js';

const PI = Math.PI;

export const FLOOR3_PLAN = './assets/drawings/packaging/floor-3-location-plan-2026.jpg';
export const FLOOR3_PLAN_CAPTION = '2026-11-24 현장 게시 · 3층 작업장(Location 라벨표시 및 PDA위치도)';
export const FLOOR3_REVISION = 'team2-floor3-location-plan-20261124';

// A-07/측량본의 믹서 간격 4.0 m. 북쪽부터 로타리1·버티컬1·버티컬2·로타리2(리본).
export const FLOOR3_MIXER_X = -11.25;
export const FLOOR3_MIXER_Z = Object.freeze([-7.75, -3.75, .25, 4.25]);
export const FLOOR3_DECK = Object.freeze({ main: 2.55, stick: 2.4 });

const cell = (id, name, minX, maxX, minZ, maxZ, extra = {}) => ({ id, name, minX, maxX, minZ, maxZ, height: 3, drawWalls: false, ...extra });
const rooms = [
  cell('store', '창고', -15.675, -13, -15.2, -12.5),
  cell('cip-room', 'CIP실', -13, -7.9, -15.2, -12.5),
  cell('material-stage', '원료 적재', -7.9, -2.7, -15.2, -11.2, { ceiling: false }),
  cell('weigh-room', '계량실', -2.7, 5.35, -15.2, -11.2),
  cell('remnant-store', '알레르기 계량실', 5.35, 10.3, -15.2, -11.2),
  cell('parts-store', '부자재 보관실', 10.3, 15.675, -15.2, -11.2),
  cell('office', '사무실', -15.675, -12.5, 13.1, 15.2),
  cell('hygiene', '위생전실', -6.1, -.17, 13.1, 15.2),
  cell('hygiene-passage', '전실 통로', -2.2, -.85, 11.6, 13.1, { text: false }),
  cell('materials-warehouse', '원부자재 보관창고', -.85, 15.675, -.35, 15.2, { ceiling: false }),
  cell('inner-material-store', '원료보관창고', 6.5, 15.3, 11.3, 14.9, { ceiling: false, height: 2.4 }),
];

const wall = (id, from, to, height = 3) => ({ id, from, to, height, thickness: .1 });
const partitions = [
  wall('store-side', [-13, -15.2], [-13, -12.5]),
  wall('store-front', [-15.675, -12.5], [-13, -12.5]),
  wall('cip-front', [-13, -12.5], [-7.9, -12.5]),
  wall('cip-side', [-7.9, -15.2], [-7.9, -12.5]),
  wall('weigh-side', [-2.7, -15.2], [-2.7, -11.2]),
  wall('weigh-front', [-2.7, -11.2], [5.35, -11.2]),
  wall('allergy-side', [5.35, -15.2], [5.35, -11.2]),
  wall('allergy-front', [5.35, -11.2], [10.3, -11.2]),
  wall('parts-side', [10.3, -15.2], [10.3, -11.2]),
  wall('parts-front', [10.3, -11.2], [15.675, -11.2]),
  wall('warehouse-back', [-.85, -.35], [15.675, -.35]),
  wall('warehouse-side', [-.85, -.35], [-.85, 13.1]),
  wall('passage-back', [-2.2, 11.6], [-.85, 11.6]),
  wall('passage-side', [-2.2, 11.6], [-2.2, 13.1]),
  wall('hygiene-front', [-6.1, 13.1], [-.17, 13.1]),
  wall('hygiene-side', [-6.1, 13.1], [-6.1, 15.2]),
  wall('office-front', [-15.675, 13.1], [-12.5, 13.1]),
  wall('office-side', [-12.5, 13.1], [-12.5, 15.2]),
  wall('raw-store-front', [6.5, 11.3], [15.3, 11.3], 2.4),
  wall('raw-store-west', [6.5, 11.3], [6.5, 14.9], 2.4),
  wall('raw-store-east', [15.3, 11.3], [15.3, 14.9], 2.4),
];

const door = (id, name, x, z, width, extra = {}) => ({ id, name, x, z, width, rotation: 0, kind: 'swing', ...extra });
const doors = [
  door('entry-door', '3층 출입문', -4, 15.2, 1.4),
  door('rear-stair-door', '계단실2 출입문', -15.7, -10.72, .9, { rotation: PI / 2 }),
  door('store-door', '창고', -13.6, -12.5, .9),
  door('cip-room-door', 'CIP실', -10.45, -12.5, 2.6, { kind: 'slide', panels: 2 }),
  door('weigh-room-door', '계량실', 1.05, -11.2, 3, { kind: 'slide', panels: 2 }),
  door('remnant-store-door', '알레르기 계량실', 9.2, -11.2, 1.1),
  door('parts-store-door', '부자재 보관실', 10.3, -12.7, 1.1, { rotation: PI / 2, openAngle: -PI / 2 }),
  door('hygiene-door', '위생전실', -4.2, 13.1, 1.2),
  door('passage-door', '전실 통로', -1.5, 13.1, .9),
  door('front-room-door', '원부자재 보관창고', -.85, 12.35, .95, { rotation: PI / 2 }),
  door('office-door', '사무실', -13.25, 13.1, .9),
  door('warehouse-curtain', '비닐커튼', -.85, 9.2, 4.6, { rotation: PI / 2, kind: 'strip', height: 2.65 }),
  door('raw-store-door', '원료보관창고', 8, 11.3, 1.8, { kind: 'slide', panels: 2, height: 2.1 }),
];

// 현장 3층 영상에서 실제로 노출된 중앙 독립 H형강 기둥 2본(황색 U자 보호대 부착)만 남긴다.
const column = (x, z, size) => ({ x, z, width: size, depth: size, height: 6 });
const columns = [
  column(-5.125, 0, .3), column(5.125, 0, .3),
];

// 본 작업대 6.0×17.2 m(계단 띠 1.2 m 양끝), 스틱 작업대·호퍼 데크는 A-07의 우측 추가 설비.
const mixerOpenings = FLOOR3_MIXER_Z.map(z => ({ x: FLOOR3_MIXER_X, z, width: 1.28, depth: 1.36 }));
const hopperBoxes = [-10.43, -9.37, -8.31, -7.25, -6.19, -2.98, -1.92, -.9];
const decks = [
  { id: 'main', name: 'packaging-main-platform', height: FLOOR3_DECK.main, tone: 'cream',
    areas: [{ minX: -12.95, maxX: -6.9, minZ: -10.3, maxZ: 6.85 }],
    openings: mixerOpenings,
    posts: [-12.83, -9.95, -7.02].flatMap(x => [-10.2, -5.75, -1.75, 2.25, 6.73].map(z => [x, z])),
    beamsX: [-12.83, -9.95, -7.02], beamsZ: [-10.2, -5.75, -1.75, 2.25, 6.73],
    grating: { minX: -9.8, maxX: -7, minZ: -10.2, maxZ: 6.75 },
    rails: [
      [[-12.95, -10.3], [-12.95, 6.85]], [[-6.9, -10.3], [-6.9, 6.85]],
      [[-12.95, -10.3], [-10.3, -10.3]], [[-9.1, -10.3], [-6.9, -10.3]],
      [[-12.95, 6.85], [-10.3, 6.85]], [[-9.1, 6.85], [-6.9, 6.85]],
    ],
    stairs: [
      { id: 'north', axis: 'x', top: -9.1, bottom: -6.65, from: -11.5, to: -10.3, steps: 12, landing: { minX: -10.3, maxX: -9.1, minZ: -11.5, maxZ: -10.3 }, landingRails: [[[-10.3, -11.5], [-9.1, -11.5]], [[-10.3, -11.5], [-10.3, -10.3]]] },
      { id: 'south', axis: 'x', top: -9.1, bottom: -6.65, from: 6.85, to: 8.05, steps: 12, landing: { minX: -10.3, maxX: -9.1, minZ: 6.85, maxZ: 8.05 }, landingRails: [[[-10.3, 8.05], [-9.1, 8.05]], [[-10.3, 6.85], [-10.3, 8.05]]] },
    ] },
  { id: 'stick', name: 'packaging-aux-platform', height: FLOOR3_DECK.stick, tone: 'grey',
    areas: [
      { minX: 4.35, maxX: 10.37, minZ: -7.13, maxZ: -.48 },
      { minX: 8.83, maxX: 10.37, minZ: -11.02, maxZ: -7.13 },
      { minX: 10.37, maxX: 14.45, minZ: -11.02, maxZ: -.48 },
    ],
    openings: [{ x: 9, z: -5.75, width: 1.2, depth: 1.2 }, { x: 9, z: -3, width: 1.2, depth: 1.2 },
      ...hopperBoxes.map(z => ({ x: 11.8, z, width: .7, depth: .8 }))],
    posts: [[4.47, -7], [7.2, -7], [4.47, -3.8], [7.2, -3.8], [4.47, -.62], [7.2, -.62], [10.4, -10.9], [10.4, -8.32], [10.4, -5.52], [10.4, -2.92], [10.4, -.62], [12.95, -10.9], [12.95, -5.52], [12.95, -.62], [14.35, -10.9], [14.35, -8.32], [14.35, -5.52], [14.35, -2.92], [14.35, -.62]],
    beamsX: [4.47, 7.2, 10.4, 14.35], beamsZ: [-10.9, -7, -5.52, -2.92, -.62],
    rails: [
      [[4.35, -7.13], [4.35, -.48]], [[4.35, -7.13], [7.95, -7.13]],
      [[8.83, -11.02], [8.83, -7.95]], [[8.83, -11.02], [14.45, -11.02]],
      [[14.45, -11.02], [14.45, -.48]], [[4.35, -.48], [14.45, -.48]],
    ],
    stairs: [
      { id: 'west', axis: 'x', top: 7.95, bottom: 5.35, from: -7.95, to: -7.13, steps: 12, landing: { minX: 7.95, maxX: 8.83, minZ: -7.95, maxZ: -7.13 }, landingRails: [[[7.95, -7.95], [8.83, -7.95]]] },
    ] },
];

// 화물용 LIFT 3TON: 승강로가 본체 안으로 들어오고 남·북 양쪽에 문이 있다.
const lift = { id: 'cargo-lift', name: '화물용 LIFT', minX: -.17, maxX: 5.07, minZ: 13.2, maxZ: 18.35, capacity: '3TON', height: 3,
  car: { minX: .67, maxX: 3.52, minZ: 13.66, maxZ: 17.67 } };

// 믹서 앞 투입 대기 발판(체커 상판·크림 다리)과 위치도의 PDA 여섯 곳.
const tableTop = FLOOR3_DECK.main + .64;
const serviceTables = [-8.95, -4.95, -.95, 3.05].map((z, i) => ({ x: -10.05, z, deck: FLOOR3_DECK.main, height: .62, sacks: [5, 0, 4, 0][i] }));
const PDA = (id, label, x, y, z, mount, rotation = 0) => ({ id, label, x, y, z, mount, rotation });
const pdaStations = [
  PDA('mix-1', '배합(소)', -9.72, tableTop, -8.7, 'table', PI / 2),
  PDA('mix-2', '배합(소)', -9.72, tableTop, -.7, 'table', PI / 2),
  PDA('mix-3', '배합(소)', -9.72, tableTop, 3.3, 'table', PI / 2),
  PDA('weigh', '계량실', -.85, 1.02, -11.13, 'wall', 0),
  PDA('stick', '배합(스)', 4.85, FLOOR3_DECK.stick, -6.5, 'post', PI / 2),
  PDA('warehouse', '원부자재 보관창고', 4.5, 0, 12.85, 'post', PI),
];

export const FLOOR3_LIFT = lift;
export const FLOOR3_LAYOUT = Object.freeze({
  rooms, partitions, doors, columns, decks, lift, pdaStations, serviceTables, wallPlan: PACKAGING_WALL_PLAN[3],
  racks: [], cargo: [], mainPlatform: null, auxPlatform: null,
  wallGaps: [{ side: 'maxZ', from: -.17, to: 5.07 }],
  windowSegments: [
    { side: 'minX', from: -9.3, to: 14.66, bottom: 1, top: 2.5, step: 1.5 },
    { side: 'maxZ', from: -14.64, to: -6.42, bottom: 1, top: 2.5, step: 1.37 },
    { side: 'maxZ', from: 6.2, to: 14.4, bottom: 1, top: 2.5, step: 1.37 },
    { side: 'minZ', from: 3.3, to: 4.4, bottom: 1.1, top: 2.4, step: 1.1 },
  ],
  // 배합실·배합(소)·배합(스)는 벽이 아닌 바닥 글자로만 구분한다.
  floorTexts: [
    { text: '배합실', x: -4.9, z: -6.2, size: 1.05, rotation: PI / 2 },
    { text: 'E/V', x: 2.1, z: 12.35, size: .8 },
  ],
  deckTexts: [
    { text: '배합(소)', x: -8.75, y: FLOOR3_DECK.main, z: -9.55, size: .42 },
    { text: '배합(스)', x: 5.9, y: FLOOR3_DECK.stick, z: -1.25, size: .5 },
  ],
  floorLines: [
    [[-6.25, .025, 1.2], [.07, .012, 21]], [[-3.62, .025, -5.9], [.07, .012, 9.8]],
    [[-9.6, .025, 8.35], [6.6, .012, .07]], [[.2, .025, -9.65], [7.4, .012, .07]],
    [[3.7, .025, 9.6], [.07, .012, 3.4]], [[2.1, .025, 7.35], [4.2, .012, .07]],
  ],
  ductRoutes: [
    { radius: .17, points: [[-7.1, 6.1, 9.5], [-7.1, 5.15, 9.5], [-14.55, 5.15, 9.5], [-14.55, 5.15, -10.65], [11.35, 5.15, -10.65], [11.35, 5.15, -1.2]] },
    { radius: .2, dark: true, points: [[-13.9, 5.55, 7.6], [-13.9, 5.55, -10.1], [10.75, 5.55, -10.1], [10.75, 5.55, -2.4]] },
  ],
  mixerDuctConnections: FLOOR3_MIXER_Z.map((z, i) => ({ x: FLOOR3_MIXER_X, y: i === 2 ? 5.5 : 5.74, z, headerX: -14.55, headerY: 5.15, riseX: -12.7 })),
  stickDuctConnections: [-5.75, -3].map(z => ({ x: 9, y: 5.5, z, headerX: 11.35, headerY: 5.15, riseX: 10.1 })),
  hopperVents: hopperBoxes.map(z => ({ x: 12.28, z })),
  roomRevision: FLOOR3_REVISION,
});

// ---- 선택·이동 가능한 설비 ---------------------------------------------------
const planned = { placementRevision: FLOOR3_REVISION, planRebuild: true };
const mixerParts = ['본체·구동', '집진 후드·커튼·투입구', '하부 호퍼·바닥 배출'];
const sieveParts = ['진동 받침·바퀴', '체 몸체·덮개', '클램프·투입 슈트'];

function equipment(id, name, type, x, z, width, depth, height, extra = {}) {
  return { id, name, tag: name, type, floor: 'packaging', floorLevel: 3, position: [x, 0, z], rotation: 0, width, depth, height,
    labelHeight: height + .35, platformHeight: 0, parts: ['본체·지지 구조', '처리·투입부', '구동·배출·부속'],
    photo: FLOOR3_PLAN, photos: [FLOOR3_PLAN], summary: name, confidence: '3층 위치도·A-07 배치 · 현장 사진 외형', details: [], ...planned, ...extra };
}

const mixers = [['1호기', '로타리1'], ['2호기', '버티컬1'], ['3호기', '버티컬2']].map(([no, line], i) => equipment(
  `packaging-main-mixer-${i + 1}`, `무중력 믹서 ${no} · ${line}`, 'packaging-mixer', FLOOR3_MIXER_X, FLOOR3_MIXER_Z[i], 3.4, 3.3, i === 2 ? 5.7 : 5.95,
  { platformHeight: FLOOR3_DECK.main, parts: mixerParts, cardNumber: i + 1, hoodSign: `${line}호기|믹싱기`, lidOpen: i === 1, ductTop: i === 2 ? 5.5 : 5.74,
    summary: `${line} 라인의 F-750 무중력 혼합기(750 L)입니다. 정면에 점검문과 투입 덮개, 위에 비닐 커튼을 두른 집진 후드가 있습니다. 체인 덮개 위로 핀밀 모터 두 대의 팬 끝이 보입니다.`,
    details: ['F-750 규격 2,100 × 1,915 × 1,480 mm · 2,800 kg · 주모터 15 kW(감속 30:1) · 핀밀 2.2 kW × 2.', '도면의 본 작업대 4.0 m 간격 위치입니다.'] }));

const thirdFloor = [
  ...mixers,
  equipment('packaging-ribbon-mixer-4', '리본 믹서 4호기 · 로타리2', 'packaging-ribbon-mixer', FLOOR3_MIXER_X, FLOOR3_MIXER_Z[3], 3.2, 3.2, 5.95,
    { platformHeight: FLOOR3_DECK.main, parts: mixerParts, hoodSign: '로타리2호기|믹싱기', ductTop: 5.74,
      summary: '본 작업대 남쪽의 500 kg 리본 믹서입니다. 경사진 스테인리스 덮개와 긴 손잡이, 적색 토글 2개, 덮개에서 후드로 올라가는 투명 호스를 재현했습니다.',
      details: ['후드 명판 「로타리2호기 믹싱기」 · 구 카드 H9-M-005 리본믹서기(9동 3층).'] }),
  ...FLOOR3_MIXER_Z.slice(0, 3).map((z, i) => equipment(`packaging-mixer-sieve-${i + 1}`, `시프트 ${i + 1}호기 · 진동채`, 'packaging-sieve', -9.75, z + 1.5, 1.5, 1.5, 4.1,
    { platformHeight: FLOOR3_DECK.main, parts: sieveParts, cardNumber: i + 1, spoutAngle: i === 1 ? 2.52 : PI,
      placementRevision: 'team2-floor3-sieve-aisle-20261124', planRebuildReviewedRevision: FLOOR3_REVISION,
      previousPlacements: [{ position: [-9.5, 0, z + 1.25], rotation: 0 }],
      summary: '믹서 투입구 옆에 세우는 지름 1.2 m 진동채입니다. 위쪽 투입 링과 두 단 체, 파란 클램프 손잡이, 믹서로 뻗은 납작한 배출 슈트를 구분했습니다.',
      details: ['이동식 진동채의 좌표는 근사입니다. 작업대 통로와 믹서 사이의 간격을 확보하도록 세 대를 도면에서 서쪽과 남쪽으로 각각 0.25 m 옮겼습니다.'] })),
  equipment('packaging-ribbon-sieve', '시프트 4호기 · 진동채', 'packaging-sieve', -12.25, 6, 1.3, 1.3, 4.1,
    { platformHeight: FLOOR3_DECK.main, parts: sieveParts, cardNumber: 4, spoutAngle: .83, rejectTurn: -.42, summary: '평면도에서 리본 믹서 남서쪽에 표시된 진동채입니다.' }),
  equipment('packaging-mixer-control', '무중력 믹서 제어반 · F-750', 'packaging-control', -12.5, -1.75, 1.4, .5, 4.55,
    { platformHeight: FLOOR3_DECK.main, controlVariant: 'dual-mixer', rotation: PI / 2, summary: '본 작업대 서쪽에 나란히 선 F-750 믹서 제어반 두 외함입니다.' }),

  ...[-5.75, -3].map((z, i) => equipment(`packaging-aux-mixer-${i + 1}`, `스틱 믹서 ${i + 1}호기`, 'packaging-stick-mixer', 9, z, 2.6, 2.6, 5.6,
    { platformHeight: FLOOR3_DECK.stick, parts: mixerParts, hoodSign: `무중력 믹서기|(${i + 1}호기)`, lidOpen: i === 0, ductTop: 5.5,
      summary: '스틱 배합(스)의 F-500 무중력 혼합기(500 L)입니다. 정면 4구 잠금과 점검문, 망이 달린 투입 덮개, 남쪽 체인 덮개와 감속모터를 재현했습니다.',
      details: ['명판 F-500(P.M.S) · 500 L · 2012년 3월. A-07의 2.6 m 간격 두 대를 0.25 m 격자에 맞췄습니다.'] })),
  ...[[-5.75, 1], [-3, 2]].map(([z, n]) => equipment(`packaging-stick-control-${n}`, `스틱 믹서 ${n}호기 조작반`, 'packaging-control', 7.5, n === 2 ? -2 : z + 1.25, .95, .5, 4.2,
    { platformHeight: FLOOR3_DECK.stick, controlVariant: n === 2 ? 'stick-level' : 'stick', rotation: -PI / 2, summary: n === 2 ? '표시등·계기·버튼 열 위에 호퍼탱크레벨 제어함을 얹은 조작반입니다.' : '표시등·아날로그 계기 2개·타이머와 버튼 세 줄을 가진 조작반입니다.' })),
  equipment('packaging-hopper-level-control', 'HOPPER LEVEL 제어반', 'packaging-control', 11.75, -4.5, .8, .5, 4.3,
    { platformHeight: FLOOR3_DECK.stick, controlVariant: 'hopper-level', rotation: -PI / 2, summary: '호퍼 열 사이의 HOPPER LEVEL CONTROL PANEL입니다.' }),

  // 박스 8개 중 두 개는 안이 둘로 나뉘어 명판이 10개다(위치도의 10칸).
  equipment('packaging-stick-hopper-row', '1,2호기·3,4호기 호퍼 · 6구', 'packaging-stick-hoppers', 12, -8.25, 1.6, 5.5, 3.4,
    { platformHeight: FLOOR3_DECK.stick, parts: ['호퍼 박스·받침', '덮개·필터·명판', '하부 원추·밸브·바닥 연결'],
      boxes: [
        { z: -2.18, labels: ['1,2호기 호퍼'] }, { z: -1.12, labels: ['1,2호기 호퍼'] },
        { z: -.06, labels: ['1,2호기 호퍼', '3,4호기 호퍼 (커피)'] },
        { z: 1, labels: ['3,4호기 호퍼'] }, { z: 2.06, labels: ['3,4호기 호퍼'] },
      ],
      summary: '위치도의 1,2호기 호퍼 3칸과 3,4호기 호퍼 3칸입니다. 다섯 박스 중 가운데 박스가 두 칸으로 나뉩니다.',
      details: ['현장 사진의 명판 「3,4호기 호퍼 (커피)」와 파란 마개·흰 필터·가스 스프링 덮개를 반영했습니다.'] }),
  equipment('packaging-stick-hopper-row-2', '5·6·7호기 호퍼 · 4구', 'packaging-stick-hoppers', 12, -2, 1.6, 3.4, 3.4,
    { platformHeight: FLOOR3_DECK.stick, parts: ['호퍼 박스·받침', '덮개·필터·명판', '하부 원추·밸브·바닥 연결'],
      boxes: [{ z: -.98, labels: ['5호기 호퍼'] }, { z: .08, labels: ['6호기 호퍼', '7호기 호퍼 (커피)'] }, { z: 1.1, labels: ['7호기 호퍼'] }],
      summary: '위치도의 5호기·6호기·7호기·7호기 호퍼 네 칸입니다.',
      details: ['현장 사진의 5호기 / 6호기·7호기(커피) / 7호기 박스 순서와 명판을 반영했습니다.'] }),
  ...[[1, -8.5], [2, -2]].map(([n, z]) => equipment(`packaging-stick-sieve-${n}`, `시프트 ${n} · ${n === 1 ? '1~4호기' : '5~7호기'} 시브`, 'packaging-suspended-distributor', 13, z, 1.6, 1.3, 4.4,
    { platformHeight: FLOOR3_DECK.stick, parts: ['현수 체 몸체·덮개', '스프링 걸이·유연 연결', 'Y자 배출관·밸브'], summary: '싸이클론 아래 스프링으로 매단 사각 체입니다. 적색 클램프 덮개와 Y자 배출관, 녹색 손잡이 버터플라이 밸브가 호퍼 뒤쪽 투입구로 이어집니다.' })),
  ...[[1, -8.5], [2, -2]].map(([n, z]) => equipment(n === 1 ? 'packaging-cyclone-frame' : 'packaging-cyclone-frame-2', `싸이클론 ${n} · 2단 프레임`, 'packaging-cyclone-frame', 13.5, z, 1.8, n === 1 ? 2.7 : 2.3, 5.85,
    { platformHeight: FLOOR3_DECK.stick, upperDeckHeight: 4.95, ladder: n === 1, conveyTo: n === 1 ? 'west' : 'south', parts: ['회색 2단 프레임·난간', '싸이클론 통·원추', '이송관·밸브·계기'], summary: '호퍼 뒤 회색 각관 2단 프레임과 상부 싸이클론입니다.' })),
  ...[[1, -6.25], [2, -4.25]].map(([n, z]) => equipment(`packaging-thermo-hygrostat-${n}`, `항온항습기 #${n}`, 'packaging-thermo-hygrostat', 14, z, 1.6, .8, 4.6,
    { platformHeight: FLOOR3_DECK.stick, rotation: -PI / 2, parts: ['캐비닛 외함', '상부 토출 그릴·점검문', '조작기·흡입 그릴'],
      summary: '스틱 작업대 동쪽 벽의 80평형 항온항습기입니다.', details: ['구 카드 H9-M-019 · 9동 3층 배합실 · 스타글로발 SYAC-PA0075.'] })),

  equipment('packaging-ground-vessel', 'CIP실 온수탱크', 'packaging-vessel', -11.75, -13.75, 1.15, 1.2, 2.5,
    { parts: ['원통 몸체·굽은 받침발', '평덮개·손잡이', '배관·측면 발판'], details: ['9동 3층 H9-M-010·011 카드에 보이는 평덮개, 관형 받침발, 측면의 두 발판과 상부 유입관을 반영했습니다.'] }),
  equipment('packaging-wash-sink', 'CIP실 2조 싱크', 'packaging-sink', -9.75, -14.5, 1.65, .65, 1.2),
  equipment('packaging-cip-services', 'CIP실 세척펌프·건조대', 'packaging-cip-services', -8.5, -13.25, 1.4, .8, 1.8, { rotation: PI / 2, parts: ['건조대', '단층·복층 펌프 카트', '호스·배수 그레이팅'],
    details: ['9동 3층 H9-M-010·011 카드 사진에 보이는 파란 바퀴의 개방형 카트와 흰 조작함을 반영했습니다. 카트 위치·이격은 근사입니다.'] }),
  equipment('packaging-wall-control', 'CIP실 벽면 조작함', 'packaging-control', -12.75, -14.5, .5, .25, 1.9, { wallMounted: true, mountHeight: 1.1, rotation: PI / 2 }),
  equipment('packaging-floor-scale', '계량실 CAS 저울', 'packaging-scale', -1.75, -13.5, .8, 1, 1.5),
  equipment('packaging-weigh-services', '계량실 흡입후드·PC 캐비닛', 'packaging-weigh-services', 2.25, -14.25, 3.2, 1, 2.8),
  equipment('packaging-allergy-scale', '알레르기 계량실 저울·작업대', 'packaging-bench-scale', 7, -14.25, 1.8, .8, 1.5, { details: ['실 용도에 맞춘 대표 작업대입니다. 실내 배치는 현장 사진 확인 전입니다.'] }),
  equipment('packaging-entry-station', '위생전실 세정·출입설비', 'packaging-hygiene-station', -2.25, 14.25, 2.2, 1, 2.3, { rotation: PI }),
  ...[-1.75, -.5].map((z, i) => equipment(`packaging-dehumidifier-${i + 1}`, `제습기 ${i + 1}`, 'packaging-dehumidifier', -14.75, z, .75, .6, 1.75,
    { rotation: PI / 2, parts: ['외함·바퀴', '상부 토출 그릴', '조작부·흡입 타공판'], summary: '서쪽 노란 창 앞의 이동식 전기제습기입니다.', details: ['구 카드 H9-M-013 · 비성전자 BSD-1400P.'] })),
];

// ---- Location 라벨: 렉·평치 ---------------------------------------------------
const locationParts = { rack: ['렉 기둥·보', '팔레트·적재물', '위치 라벨'], floor: ['바닥 구획선', '팔레트·적재물', '위치 라벨'] };
function location(letter, kind, name, x, z, width, depth, extra = {}) {
  const label = `P3-3층-${letter}`, rack = kind === 'rack';
  return equipment(`packaging-loc-${(extra.key || letter).toLowerCase()}`, `${label} · ${name}`, rack ? 'packaging-storage-rack' : 'packaging-floor-storage', x, z, width, depth, extra.height ?? (rack ? 3.2 : 1.9),
    { tag: label, locationLabel: label, storage: kind, parts: locationParts[kind], labelHeight: (extra.platformHeight || 0) + (rack ? 3.7 : 2.3),
      summary: `3층 위치도의 ${label} ${name} 위치입니다.`, confidence: '2026-11-24 3층 위치도 · 적재 품목과 수량은 예시',
      details: ['적재물은 표시 옵션에서 끌 수 있으며 실제 품목·수량을 뜻하지 않습니다.'], ...extra });
}
const locations = [
  location('A', 'rack', '원료보관창고 렉', 11, 14.25, 8.25, .9, { height: 2.25, tiers: 3, bays: 5, slots: 10, tierCodes: ['A1', 'A2', 'A3'], face: -1, loads: 'small', summary: '원료보관창고의 P3-3층-A 렉입니다. A1·A2·A3 세 단에 각각 1~10번 칸이 있습니다.' }),
  location('A', 'rack', '원료보관창고 앞 렉', 5.75, 13.25, .9, 2.4, { key: 'a-side', height: 2.6, tiers: 3, bays: 1, alongZ: true, face: 1, loads: 'small', summary: '위치도에서 E/V와 원료보관창고 사이에 표시된 렉입니다.' }),
  location('B', 'floor', '평치', 12.75, 7.75, 4.9, 6.25, { grid: [4, 5], stack: 'mixed', signAt: [-2.5, -3.1] }),
  location('C', 'rack', '렉', 0, 4, 1.1, 5, { tiers: 3, bays: 2, alongZ: true, face: 1, loads: 'carton' }),
  location('D', 'rack', '렉', 6.5, .5, 13.75, 1.1, { tiers: 3, face: 1, loads: 'mixed', segments: [[-6.85, -2.25, 2], [-.6, 6.85, 3]] }),
  location('D', 'floor', '평치', 7, 4.25, 5.5, 3.75, { key: 'd-floor', grid: [5, 3], stack: 'sack', signAt: [-2.75, -1.85] }),
  location('E', 'rack', '렉', -9.75, 14.25, 5.3, 1.1, { tiers: 3, bays: 2, face: -1, loads: 'carton' }),
  location('F', 'floor', '평치', -10.25, 10.5, 5, 4, { grid: [4, 3], stack: 'carton', signAt: [2.5, -2] }),
  location('G', 'rack', '렉', -14.5, 10, 1.1, 5.4, { tiers: 3, bays: 2, alongZ: true, face: 1, loads: 'wrapped' }),
  location('H', 'floor', '평치 · 배합(소) 작업대', -7.5, -1.75, 1.15, 15.75, { grid: [1, 11], stack: 'sack-low', platformHeight: FLOOR3_DECK.main, signAt: [-.55, -7.9], signTurn: -PI / 2 }),
  location('I', 'floor', '평치', -5.5, -13.25, 4, 3, { grid: [3, 2], stack: 'carton', signAt: [2, 1.5] }),
  location('J', 'rack', '부자재 보관실 렉', 13, -14.25, 4, 1, { tiers: 3, bays: 2, height: 2.6, face: 1, loads: 'small' }),
  location('K', 'floor', '평치', 1.5, -2, 4, 2.75, { grid: [3, 2], stack: 'sack', signAt: [-2, -1.35], signTurn: -PI / 2 }),
  location('L', 'floor', '평치', -2.25, 3.5, 2.25, 4, { grid: [2, 3], stack: 'wrapped', signAt: [-1.1, -2], signTurn: -PI / 2 }),
];

export const FLOOR3_EQUIPMENT = Object.freeze([...thirdFloor, ...locations].map(item => Object.freeze(item)));
