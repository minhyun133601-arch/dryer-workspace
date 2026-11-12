import { PACKAGING_PATHS, PACKAGING_PATH_END_LOOKATS } from './packaging-routes.js';
import { TEAM2_CARD_CAPTIONS, TEAM2_IDENTITY, team2RoomPhotos, bindTeam2Card } from './team2-card-data.js';
import { PACKAGING_TRANSPORT_LINES } from './packaging-transport-data.js';

// This is a separate third-floor room. The employee confirmed the building and
// floor; plan X/Z are local drawing axes, not GPS or the campus building axes.
const frame = (seconds) => `./photos/packaging-3f/frame-${String(seconds).padStart(4, '0')}s.jpg`;
const plan = './assets/drawings/packaging/floor-3-reference-plan.png';
const measuredPlan = './assets/drawings/packaging/floor-3-measured-plan.png';
const referencedSeconds = [17, 114, 156, 167, 169, 174, 175, 200, 230, 250, 270, 285, 300, 310, 315, 320, 330, 342, 350, 370, 377, 390, 400, 420, 450, 465, 480, 490, 500, 520, 540, 543, 555, 557, 561, 565, 585, 615, 620, 650, 690, 730, 745, 750, 760, 790, 794, 810, 817, 830, 850, 880, 900, 930, 950, 990, 995, 1012, 1018, 1020, 1035, 1050, 1060, 1095];
const photoCaptions = Object.freeze({
  ...Object.fromEntries(referencedSeconds.map((seconds) => [frame(seconds), `직원 촬영 · 2026-11-09 14:47:53 영상 · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`])),
  [plan]: '소포장 3층 평면도 · 9동 3층 / A-07 / 07.11 · 설비 배치 참고',
  [measuredPlan]: '소포장 3층 평면도 측량 · 본체 외곽 31.35 × 30.40m · 과거 도면',
});

const mainBounds = Object.freeze({ minX: -15.675, maxX: 15.675, minZ: -15.2, maxZ: 15.2 });
const mainPlatform = Object.freeze({ minX: -12.9, maxX: -6.9, minZ: -11.4, maxZ: 8, height: 2.4, stairLength: 1.2, stairEnds: ['minZ', 'maxZ'] });
const auxPlatform = Object.freeze({ minX: 10.4, maxX: 14.5, minZ: -11, maxZ: -.3, height: 2.4, stairLength: 1.2, stairEnds: ['minZ'] });
const axisX = [-15.375, -10.25, -5.125, 0, 5.125, 10.25, 15.375];
const axisZ = [-14.9, -10, -5, 0, 5, 10, 14.9];
const column = (x, z) => ({ x, z, width: .3, depth: .3, height: 6.2 });
const columns = [
  ...axisX.flatMap((x) => [column(x, axisZ[0]), column(x, axisZ.at(-1))]),
  ...axisZ.slice(1, -1).flatMap((z) => [column(axisX[0], z), column(axisX.at(-1), z)]),
  column(-5.125, 0), column(5.125, 0),
];
const rooms = [
  { id: 'store', name: '창고', minX: -15.675, maxX: -13, minZ: -15.2, maxZ: -12.5 },
  { id: 'cip-room', name: 'CIP실', minX: -13, maxX: -7.8, minZ: -15.2, maxZ: -12.5 },
  { id: 'material-stage', name: '계량 원료 적재대', minX: -7.8, maxX: -2.6, minZ: -15.2, maxZ: -11.2 },
  { id: 'weigh-room', name: '원료 계량실', minX: -2.6, maxX: 5.4, minZ: -15.2, maxZ: -11.2 },
  { id: 'remnant-store', name: '짜투리 보관창고', minX: 5.4, maxX: 9.6, minZ: -15.2, maxZ: -11.2 },
  { id: 'record-room', name: '향료·색소 계량 일지 정리실', minX: 9.6, maxX: 12.8, minZ: -15.2, maxZ: -11.2 },
  { id: 'parts-store', name: '부품창고', minX: 12.8, maxX: 15.675, minZ: -15.2, maxZ: -11.2 },
].map((item) => ({ ...item, height: 3, drawWalls: false, confidence: '도면 실명 참고 · 칸막이 이격과 높이는 근사' }));
const partition = (id, from, to) => ({ id, from, to, height: 3, thickness: .1 });
const partitions = [
  partition('store-side', [-13, -15.2], [-13, -12.5]),
  partition('store-front', [-15.675, -12.5], [-14, -12.5]),
  partition('cip-front', [-13, -12.5], [-7.8, -12.5]),
  partition('cip-side', [-7.8, -15.2], [-7.8, -12.5]),
  partition('weigh-side', [-2.6, -15.2], [-2.6, -11.2]),
  partition('weigh-front', [-2.6, -11.2], [5.4, -11.2]),
  ...[5.4, 9.6, 12.8].map((x, index) => partition(`back-room-side-${index}`, [x, -15.2], [x, -11.2])),
  partition('back-room-front-a', [5.4, -11.2], [7.5, -11.2]),
  partition('back-room-front-b', [8.7, -11.2], [10.4, -11.2]),
  partition('back-room-front-c', [11.6, -11.2], [13.4, -11.2]),
  partition('back-room-front-d', [14.6, -11.2], [15.675, -11.2]),
  partition('front-room-back', [-.8, -.3], [15.675, -.3]),
  partition('front-room-side', [-.8, -.3], [-.8, 11.6]),
];
const doors = [
  { id: 'store-door', x: -13.5, z: -12.5, width: 1, rotation: 0, kind: 'swing' },
  { id: 'remnant-door', x: 8.1, z: -11.2, width: 1.2, rotation: 0, kind: 'swing' },
  { id: 'record-door', x: 11, z: -11.2, width: 1.2, rotation: 0, kind: 'swing' },
  { id: 'parts-door', x: 14, z: -11.2, width: 1.2, rotation: 0, kind: 'swing' },
  { id: 'front-room-door', x: -.8, z: 12.2, width: 1.2, rotation: Math.PI / 2, kind: 'swing' },
  { id: 'entry-door', x: -4, z: 15.2, width: 1.4, rotation: 0, kind: 'swing' },
  { id: 'rear-stair-door', x: -15.675, z: -11.3, width: 1.1, rotation: Math.PI / 2, kind: 'swing' },
];
const stairs = [
  { id: 'rear-stair', name: '계단실2', minX: -19.125, maxX: -15.675, minZ: -15.2, maxZ: -9.7, steps: 12, rise: 3, direction: 'z' },
  { id: 'front-stair', name: '3층 진입 계단·참', minX: -5.125, maxX: -.8, minZ: 15.2, maxZ: 18.35, flights: 4, stepsPerFlight: 10, rise: 6, direction: 'x', confidence: '영상의 반복 U턴·참·석재/자주색 노징·흰 난간 참고 · 총 높이와 매단 치수, 도면 계단과의 정확한 대응은 근사' },
];

const LEGACY_PACKAGING_ROOM = Object.freeze({
  id: 'packaging', floor: 'packaging', floorLevel: 3,
  name: '스틱·소포장 · 3층', shortName: '스틱·소포장 3층', title: '스틱·소포장 · 3층',
  center: [0, 1.8, 0], span: 47, length: 33.55, width: 34.8, depth: 33.55,
  anchor: [0, 0, 0], rotation: 0,
  bounds: { minX: -19.125, maxX: 15.675, minZ: -15.2, maxZ: 18.35 }, mainBounds,
  layout: { mainBounds, mainPlatform, auxPlatform, partitions, doors, columns, rooms, stairs,
    lift: { id: 'cargo-lift', name: '화물용 LIFT', minX: -.8, maxX: 4.6, minZ: 15.2, maxZ: 18.35, capacity: '3TON', height: 3 },
    ceilingHeight: 6.2, heightReference: '장면의 기둥·상부 구조 표현용 근사 높이이며 천장·층고 실측값이 아님', confidence: '도면 치수 기준 · 칸막이·기둥 높이·개구부 이격·플랫폼 높이는 영상 비례 근사',
  },
  path: [
    [-4.6, -4.35, 17.55], [-4.075, -4.35, 17.55], [-1.85, -2.85, 17.55], [-1.325, -2.85, 17.55],
    [-1.325, -2.85, 15.95], [-1.85, -2.85, 15.95], [-4.075, -1.35, 15.95], [-4.6, -1.35, 15.95],
    [-4.6, -1.35, 17.55], [-4.075, -1.35, 17.55], [-1.85, .15, 17.55], [-1.325, .15, 17.55],
    [-1.325, .15, 15.95], [-1.85, .15, 15.95], [-4.075, 1.65, 15.95], [-4.6, 1.65, 15.95],
    [-4, 1.65, 15.95], [-4, 1.65, 12], [-4, 1.65, 3], [-4, 1.65, -8],
    [-4, 1.65, -11.8], [-10.45, 1.65, -11.8], [-10.45, 1.65, -10.8], [-10.05, 1.65, -10.8], [-7.05, 4.05, -10.8],
    [-7.2, 4.05, -10.3], [-9.1, 4.05, -10.3], [-9.1, 4.05, 6.5], [-7.2, 4.05, 6.5],
    [-7.05, 4.05, 7.4], [-10.05, 1.65, 7.4], [-10.45, 1.65, 7.4], [-9.7, 1.65, 9.8],
    [-8, 1.65, 11.4], [-4, 1.65, 11.4], [-4, 1.65, -9.8], [7, 1.65, -9.8],
    [10.95, 1.65, -10.4], [11.35, 1.65, -10.4], [14.35, 4.05, -10.4],
    [14.2, 4.05, -9.7], [12.4, 4.05, -9.7], [12.4, 4.05, -1],
  ],
  pathEndLookAt: [9.1, 4.4, -5.8],
  reference: plan,
  photos: [17, 114, 156, 169, 230, 310, 320, 342, 370, 465, 490, 543, 557, 561, 620, 750, 760, 850, 930, 1035].map(frame).concat([plan, measuredPlan]),
  photoCaptions,
  source: '직원 촬영 2026-11-09 14:47:53 영상(18분23초) · 소포장 3층 평면도/측량 PDF · 사용자 건물·3층 확인',
  confidence: '3층 공간은 직원 확인 · 본체 치수는 도면 참고 · 설비 개별 대응·높이는 근사',
  summary: '건조실 간판동 옆 스틱·소포장 건물의 3층을 별도 공간으로 구성했습니다. 계단과 화물리프트, 원료 계량·보관실, 메인 플랫폼과 혼합 설비를 도면과 현장 영상으로 함께 확인합니다.',
  details: [
    '직원이 이 영상을 건조실 간판동 옆 스틱·소포장 건물의 3층으로 확인했습니다. 2층 스틱 충전기 1~8호기 도식은 이 공간에 복사하지 않았습니다.',
    '3층 도면 본체 외곽은 31.35×30.40m이고, 계단·화물리프트 돌출을 포함한 전체 범위는 약 34.80×33.55m입니다. 도면은 9동 3층/A-07/07.11 표기를 포함합니다.',
    '왼쪽 메인 플랫폼의 네 유닛과 오른쪽 추가 플랫폼은 도면에서 구분했습니다. 영상의 여러 시점에 같은 기기가 다시 보일 수 있어 사진만으로 새 기기를 계속 추가하지 않았습니다.',
    '제조 구간 175~1101초를 1초 간격으로 다시 대조했습니다. 호퍼 점검문·연결관, 원형 처리설비와 대형 외함, 두 종류의 제어반을 구분했습니다. 세척·습식 소구역은 영상에서 확인되지만 도면의 특정 실과 정확히 대응하는지는 미확정입니다.',
    '0~174초의 진입 계단도 1초 간격으로 별도 확인했습니다. 석재 계단의 자주색 모서리, 흰 난간과 중간 가로대, 반복되는 U턴 참을 표현하고 3층 통로까지 높이가 이어지는 이동 경로를 연결했습니다. 총 계단 높이 6m·매단수는 재현용 근사이며 휴게실 층번호는 판독하지 못했습니다.',
    '평면의 북쪽과 공장 전경 내 정확한 회전은 미등록입니다. 도면 로컬 좌표를 쓰며 좌표는 화면에 표시하지 않습니다. 플랫폼 2.4m와 상부 구조 표현 높이 6.2m는 근사이며 실측 층고·천장 높이는 확정하지 않았습니다.',
  ],
  drawingSources: [
    { sha256: '48e451589dba4125332ba8fd34e226f71f8182b237bf980014f7231367019b33', name: '소포장 3층 평면도.pdf', page: 1 },
    { sha256: 'b932b98e4f848582adcd6f02d3461945b0c67e7439b6663be7b7538bea623dfa', name: '소포장 3층 평면도 측량.pdf', page: 1 },
  ],
});

function equipment(id, name, type, position, width, depth, height, seconds, extra = {}) {
  const photos = seconds.map(frame);
  return Object.freeze({
    id, name, type, tag: name, floor: 'packaging', floorLevel: 3,
    position, width, depth, height, rotation: 0, platformHeight: 0,
    labelHeight: height + .5,
    photo: photos[0] || plan, photos: photos.length ? photos : [plan], photoCaptions,
    parts: ['본체·받침 구조', '처리·투입부', '구동·배출·배관'],
    confidence: '영상 외형 참고 · 위치와 치수는 도면·화면 비례 근사',
    details: ['사진은 시각적 외형 근거입니다. 기기 번호·정식 모델명·배관 연결은 별도 확인 전까지 확정하지 않았습니다.'],
    ...extra,
  });
}

const mainConfidence = '도면 메인 플랫폼의 유닛 순서 참고 · 영상의 개별 기기 번호 대조는 미확정';
const auxConfidence = '3층 평면도에 별도 추가된 두 유닛 · 영상과 개별 동일성·현 배치 일치는 미확정';

const LEGACY_PACKAGING_EQUIPMENT = Object.freeze([
  equipment('packaging-main-mixer-1', '주 혼합설비 A', 'packaging-mixer', [-11.3, 0, -7.5], 3, 3.8, 5.2, [370, 342, 350], {
    platformHeight: 2.4,
    parts: ['지지 프레임·하부 호퍼', '상부 혼합 외함·뚜껑', '모터·감속기·배출구'],
    summary: '3층 도면 메인 플랫폼의 첫 번째 큰 유닛입니다. 영상에서 보이는 스테인리스 외함, 상부 덮개와 하부 배출 구조를 참고했습니다.',
    confidence: mainConfidence,
    details: ['3층 도면 왼쪽 플랫폼의 첫 유닛 위치를 참고했습니다.', '같은 기기를 여러 각도에서 찍은 장면은 새 설비로 중복 가산하지 않았습니다.', '플랫폼 2.4m와 전체 높이 5.2m는 영상 비례 근사입니다.'],
  }),
  equipment('packaging-main-mixer-2', '주 혼합설비 B', 'packaging-mixer', [-11.3, 0, -2.9], 3, 3.8, 5.2, [377, 390, 465, 794, 817], {
    platformHeight: 2.4, dischargeVariant: 'black-ring',
    parts: ['지지 프레임·하부 호퍼', '상부 혼합 외함·뚜껑', '모터·감속기·배출구'],
    summary: '메인 플랫폼 중앙의 두 번째 큰 유닛입니다. 계단·그레이팅 주변의 하부 각뿔형 호퍼와 상부 구동 외형을 참고했습니다.',
    confidence: mainConfidence,
    details: ['도면의 메인 플랫폼 유닛 순서와 이격을 참고했습니다.', '794~817초의 검은 연결링과 점검문을 가진 하부 외형을 반영했습니다. 이 외형이 도면상 두 번째 유닛에 속하는지는 미확정입니다.', '영상의 호퍼·상부 원형 뚜껑·모터는 한 장비의 위아래 또는 반대쪽 모습일 수 있어 부품으로 묶었습니다.', '기기별 정식 번호와 정밀 배관 경로는 확인되지 않았습니다.'],
  }),
  equipment('packaging-main-mixer-3', '주 혼합설비 C', 'packaging-mixer', [-11.3, 0, 1.6], 3, 3.8, 5.2, [540, 543, 615, 830, 930], {
    platformHeight: 2.4, dischargeVariant: 'round-valve-pair',
    parts: ['지지 프레임·하부 호퍼', '상부 혼합 외함·뚜껑', '모터·감속기·배출구'],
    summary: '메인 플랫폼의 세 번째 큰 유닛입니다. 수평 스테인리스 외함과 구동부를 하나의 설비 그룹으로 구성했습니다.',
    confidence: mainConfidence,
    details: ['615~620초에 모터 두 개가 한 화면에 보여도 이를 별도 혼합기 두 대로 단정하지 않았습니다.', '830초에서 확인한 두 원추형 호퍼와 사각 밸브함·바닥 플랜지의 외형을 반영했습니다. 도면상 세 번째 유닛과의 정확한 동일성은 미확정입니다.', '혼합기 제어반은 별도 외함으로 선택할 수 있고, 영상에서 반복되는 동일 장비 외형은 중복 모델로 추가하지 않았습니다.'],
  }),
  equipment('packaging-round-process', '소형 원형 처리설비', 'packaging-sieve', [-11.3, 0, 4.5], 1.8, 2.4, 4.1, [480, 490, 520], {
    platformHeight: 2.4,
    parts: ['받침·하부 배출부', '원형 외함·덮개', '체결부·구동·연결관'],
    summary: '메인 플랫폼 끝의 작은 원형 유닛입니다. 도면의 소형 유닛과 영상의 원형 덮개·클램프 외형을 참고했습니다.',
    confidence: '3층 도면의 소형 유닛 위치 참고 · 영상의 정식 기능·개별 대응 미확정',
    details: ['도면에는 VIBRATOR 등의 문자와 작은 유닛이 보이지만 이 기기의 정확한 기능·모델명은 확정하지 않았습니다.', '480~520초의 다단 원형 외함을 근거로 합니다. 990초 부근은 확대 재검토 결과 수직 원통 설비 아래의 사각 분배함으로 구분했습니다.'],
  }),
  equipment('packaging-aux-mixer-1', '수직 원통·하부 분배설비 · 도면 위치 참고', 'packaging-vertical-process', [9.1, 0, -5.8], 2.5, 2.4, 5.9, [995, 990, 1012, 1018], {
    platformHeight: 2.4,
    parts: ['작업발판·하부 수신 호퍼', '상부 원통·원추·분배함', '점검문·밸브·체결부·덕트'],
    summary: '후반 영상의 플랫폼 위 수직 원통과 아래 큰 원추, 현수식 분배함·낮은 수신 호퍼를 연결된 구조로 표현했습니다.',
    confidence: '수직 원통·원추·분배함 외형은 영상 확인 · 우측 도면 유닛과의 정확한 대응·치수는 미확정',
    details: ['995초에서 원추 아래의 검정·적색 밸브와 붉은 클램프 분배함, 1012~1018초에서 상부 원통과 점검구를 확인했습니다.', '일반 도면의 오른쪽 추가 유닛 위치를 사용하지만 이 영상 기기가 그 유닛과 동일한지, 현재의 정확한 간격과 방향은 미확정입니다.', '상부 원통과 아래 원추는 한 연결 구조로 묶었습니다. 별도 독립 기계 수를 늘리는 근거로 쓰지 않았습니다.'],
  }),
  equipment('packaging-aux-mixer-2', '우측 혼합설비 B · 도면 참고', 'packaging-aux-mixer', [9.1, 0, -3.1], 2.5, 2.4, 4.8, [850, 880, 930], {
    platformHeight: 2.4,
    parts: ['지지 프레임·배출 구조', '상부 혼합 외함', '구동·연결 부품'],
    summary: '일반 3층 평면도의 오른쪽 추가 배치에서 두 번째로 구분되는 유닛입니다. 영상의 배출부·구동 외형을 참고했습니다.',
    confidence: auxConfidence,
    details: ['영상 790~875초에는 여러 원뿔 배출구가 보이지만 배출구 개수와 독립 장비 개수는 다릅니다.', '도면의 두 유닛을 참고한 배치이며 영상 장비의 정확한 설치 위치로 확정하지 않았습니다.'],
  }),
  equipment('packaging-air-unit', '4구 원형 토출 공조설비', 'packaging-air-unit', [-14.5, 0, 9.4], 4.4, 1.3, 4.5, [230, 250], {
    rotation: Math.PI / 2,
    parts: ['하부 캐비닛·받침', '수직 연결부·상부 외함', '원형 토출구 4개·덕트'],
    summary: '230~250초 장면의 큰 원형 토출구 네 개와 하부 흰 캐비닛을 가진 설비입니다.',
    confidence: '원형 토출구 4개·캐비닛 외형 영상 확인 · 도면 내 세부 위치 근사',
    details: ['노란 창 앞의 하부 외함, 세로 연결부와 네 개의 큰 원형 토출구를 한 그룹으로 묶었습니다.', '명판·정확한 장비 형식과 용량은 판독되지 않아 외형 중심의 명칭을 사용합니다.'],
  }),
  equipment('packaging-wash-sink', '스테인리스 세척대', 'packaging-sink', [-14.6, 0, 4.2], 1.4, .7, 1.8, [320], {
    rotation: Math.PI / 2,
    parts: ['본체·받침', '세척조·높은 뒤판', '수도꼭지·호스 연결부'],
    summary: '320초에 보이는 수도꼭지와 세척조, 높은 스테인리스 뒤판의 외형을 참고한 세척대입니다.',
    confidence: '수도꼭지·세척조 영상 확인 · 위치와 치수 근사',
    details: ['앞의 이동 물통이나 걸린 비닐류는 별도 고정 설비로 추가하지 않았습니다.', '269~321초는 문을 통과한 세척·습식 소구역입니다. 이 소구역과 도면상의 특정 실이 동일한지, 현재 모델에서의 정확한 위치는 미확정입니다.'],
  }),
  equipment('packaging-ground-vessel', '지상 원형 용기·연결 배관', 'packaging-vessel', [-14.3, 0, .7], 1.6, 1.6, 2.8, [310, 300, 315], {
    parts: ['용기 본체·다리', '상부 덮개·계기부', '배관·밸브 연결부'],
    summary: '바닥 배수로 주변에서 보이는 지상 스테인리스 용기와 다리·연결 배관을 참고했습니다.',
    confidence: '지상 용기·연결부 외형 참고 · 형식·용량·정확한 위치 미확정',
    details: ['이 용기는 메인 플랫폼 위 원형 처리 유닛과 구분합니다.', '영상의 압력계·용기 외형만 참고하며 압력 등급이나 운전 기능은 추정하지 않았습니다.', '문을 통과한 세척·습식 소구역의 설비이며 도면상의 특정 실과 정확히 대응하는지는 미확정입니다.'],
  }),
  equipment('packaging-mixer-control', '혼합기 제어반 · 두 외함', 'packaging-control', [-7.7, 0, -2.9], 1.6, .6, 4.5, [557, 561, 565], {
    platformHeight: 2.4, controlVariant: 'dual-mixer',
    parts: ['노출 패널·투명문 패널 외함', '표시계·버튼·선택 스위치', '손잡이·경광등·인입 배선'],
    summary: '557초의 F-750 MIXER CONTROL PANEL과 559~562초의 투명문 제어함은 외형이 달라 두 외함으로 표현했습니다.',
    confidence: 'F-750 문구·두 외함 형상 영상 확인 · 외함 사이 정확한 간격과 연결 설비는 미확정',
    details: ['F-750 패널의 상단 표시등 여섯 개, 아날로그 계기 두 개와 카운터, 아래 버튼 행을 참고했습니다.', '다른 외함은 검은 테두리 투명문과 상단 붉은 경광등을 가집니다. 두 외함이 각각 독립 혼합기를 뜻하는지는 확인되지 않았습니다.', '두 외함을 하나의 선택 그룹으로 묶었습니다. 개별 기계 번호와 실제 제어 태그·동작은 확정하지 않았습니다.'],
  }),
  equipment('packaging-wall-control', '벽면 조작함', 'packaging-control', [15.3, 0, 7.5], .8, .3, 1.9, [285], {
    rotation: -Math.PI / 2, wallMounted: true, mountHeight: 1.1,
    parts: ['벽면 고정 외함', '표시·조작부', '인입 배관·배선'],
    summary: '285초 장면의 벽면 표시·조작함을 참고한 작은 외함입니다. 혼합기 제어반과 별도 외함으로 구분했습니다.',
    confidence: '벽면 외함 영상 확인 · 회로·기능과 도면 내 정확한 위치 미확정',
    details: ['휴대폰 영상의 발광 표시와 외함 형상만 참고했습니다. 흐린 화면으로 기능이나 계기 값을 판정하지 않았습니다.'],
  }),
  equipment('packaging-cip-area', '도면상 CIP실 · 내부 미확인', 'packaging-cip', [-10.4, 0, -13.75], 2.2, 1.6, .12, [], {
    parts: ['도면상 공간 범위', '3층 참고 도면', '내부 설비 확인 대기'],
    photos: [plan, measuredPlan], photo: plan,
    summary: '3층 도면에 표시된 CIP실의 위치만 표시합니다. 내부 기기와 현장 영상의 개별 대응이 확인되지 않아 탱크나 펌프를 임의로 채우지 않았습니다.',
    confidence: 'CIP실 위치·문구는 도면 확인 · 내부 구성·영상 기기의 기능 연결은 미확정',
    details: ['영상 속 이동 펌프가 실제 이 CIP실에 설치된 것인지는 확인하지 않았습니다.', 'CIP 운전 순서나 배관 계통을 추론하지 않고 도면의 공간과 시각적 기기 외형을 구분해 기록합니다.'],
  }),
  equipment('packaging-floor-scale', '대형 표시부 바닥 저울', 'packaging-scale', [-5.7, 0, 8.5], .85, 1, 1.5, [750], {
    parts: ['계량 발판·받침', '지주·표시기', '표시부 외함·연결부'],
    summary: '750초에 보이는 CAS 표시기와 지주형 바닥 저울의 외형을 참고했습니다.',
    confidence: '저울 표시기·지주 영상 확인 · 계량 범위와 정확한 설치 위치 미확정',
    details: ['임시 적재된 자재와 포장물은 설비 모델에서 제외했습니다.', '원료 계량실이라는 도면 실명과 별개로 이 저울의 실제 설치 위치는 영상 비례 근사입니다.'],
  }),
  equipment('packaging-weigh-services', '계량 보조설비 · 조작함·흡입후드', 'packaging-weigh-services', [-5.8, 0, 10.4], 1.8, 1.1, 2.8, [745, 760], {
    parts: ['파란 조작 캐비닛·받침', '금속 텔레스코프 흡입관·원추 후드', '화면·관절·호스 연결부'],
    summary: '계량 코너에서 보이는 파란 PC 조작 캐비닛과 관절식 금속 흡입관을 재현했습니다. CAS 저울과는 별도로 선택할 수 있습니다.',
    confidence: '743~760초의 외형·같은 구역 관계 확인 · 도면상 특정 실·현재 위치와 치수는 근사',
    details: ['낮은 천장·벽체와 함께 보이는 계량 코너입니다. 도면의 원료 계량실과 동일한 방인지는 확정하지 않았습니다.', '흡입관·후드와 조작함은 한 선택 그룹으로 묶었고, 별도 스틱 충전 라인으로 해석하지 않았습니다.'],
  }),
  equipment('packaging-entry-station', '3층 위생 전실 · 세정·출입설비', 'packaging-hygiene-station', [-5.8, 0, 13.2], 2.2, 1, 2.3, [167, 169, 174], {
    parts: ['스테인리스 캐비닛·받침', '세정·출입 조작부', '배관·표시등·출입 프레임'],
    summary: '계단에서 문을 지나 3층 제조실로 들어가기 직전 보이는 스테인리스 위생·출입 설비입니다.',
    confidence: '161~175초의 계단→전실→제조실 연결 확인 · 장비 치수와 방 안의 정확한 방향은 근사',
    details: ['167~174초의 스테인리스 세정 설비와 손을 넣는 출입 조작부를 참고했습니다.', '맨 처음 0~16초의 사물함·파란 칸막이 구역은 별도 시작 지점이므로 3층 설비로 복제하지 않았습니다.', '통로를 열어 두고 계단 상부 참에서 제조실로 진입하는 관계를 표현합니다.'],
  }),
]);

// 2025 workplace plans define floor uses and equipment order. Architecture uses
// A-05/A-06/A-07; heights use A-11. All three floors retain their own local Y=0.
const workplacePlan = (level) => `./assets/drawings/packaging/floor-${level}-workplace-2025.png`;
const redesignFrame = (seconds) => `./photos/packaging-3f/redesign-${String(seconds).padStart(4, '0')}s.jpg`;
const sourcePhoto = (name) => `./assets/drawings/packaging/${name}.png`;
const redesignSeconds = [174,194,221,228,247,278,300,330,342,353,363,379,391,393,463,478,481,506,540,544,557,561,605,614,643,660,669,674,702,732,746,760,805,829,850,905,909,916,918,948,957,958,962,995,1019,1057,1059];
const allCaptions = Object.freeze({ ...photoCaptions, ...TEAM2_CARD_CAPTIONS,
  [sourcePhoto('floor-1-architecture')]:'9동 1층 건축 평면도 A-05 · 외곽·기둥·문 위치 참고',
  [sourcePhoto('floor-2-architecture')]:'9동 2층 건축 평면도 A-06 · 구조·호퍼 작업대 참고',
  [sourcePhoto('stick-packer-plan')]:'희창유업 발주 참고 · YOUNG TECH PACK 스틱 포장기 평면 · 개별 호기 모델 대응 미확인',
  [sourcePhoto('stick-packer-elevations')]:'희창유업 발주 참고 · 스틱 포장기 정면·측면 · 본체 1.6×2.4×2.0m / 상부 포함 2.9m',
  [sourcePhoto('floor-2-workers-route-20231018')]:'2023-10-18 스틱 2층 작업장평면도 · 작업자 동선',
  [sourcePhoto('floor-2-materials-route-20231018')]:'2023-10-18 스틱 2층 작업장평면도 · 부자재 동선',
  [sourcePhoto('floor-2-auger-proposal')]:'스틱 포장기 신규 도입 계획 · AS-IS/TO-BE · 설치 완료 근거 아님',
  ...Object.fromEntries([1,2,3].map((level) => [workplacePlan(level), `2025 ${level}층 작업장평면도 · 집진·열풍배관 후드교체 기안 첨부4`])),
  ...Object.fromEntries(redesignSeconds.map((sec) => [redesignFrame(sec), `직원 촬영 · 2026-11-09 · ${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`])),
});
const roomCell = (id,name,minX,maxX,minZ,maxZ) => ({id,name,minX,maxX,minZ,maxZ,height:3,drawWalls:false});
const wallSegment = (id,from,to) => ({id,from,to,height:3,thickness:.10});
const perimeterColumns = columns.map((entry) => ({...entry,height:6}));
const updatedMainPlatform = {...mainPlatform,height:2.55,maxZ:8.6,
  deckOpenings:[-7.5,-2.9,1.6,5.5].map(z=>({x:-11.3,z,width:1.25,depth:1.1}))};
const updatedAuxPlatform = {...auxPlatform,minX:6.8,minZ:-10.8,maxZ:-.4,height:2.4,
  deckOpenings:Array.from({length:8},(_,i)=>({x:12.2+(i%2?1:-1)*.75,z:-5.5+(Math.floor(i/2)-1.5)*2,width:.95,depth:1.15}))};
const room3Cells = [
  roomCell('store','창고',-15.675,-13,-15.2,-12.5),
  roomCell('cip-room','CIP실',-13,-7.8,-15.2,-12.5),
  roomCell('material-stage','분쇄실',-7.8,-3.2,-15.2,-12.5),
  roomCell('weigh-room','계량실',-3.2,5.4,-15.2,-12.5),
  roomCell('remnant-store','알레르기 계량실',5.4,10,-15.2,-12.5),
  roomCell('parts-store','부자재 보관실',10,15.675,-15.2,-12.5),
  roomCell('front-store','창고',-15.675,-13,12.5,15.2),
  roomCell('materials-warehouse','원부자재 보관창고',-.8,15.675,-.3,15.2),
  roomCell('inner-material-store','원료보관창고',8,15.3,11.4,14.8),
  roomCell('hygiene','위생전실',-5.125,-.8,12.4,18.35),
];
function wallsForCells(cells) {
  // Room front walls leave a 1.2m doorway in the middle of each room.
  const walls=[];
  for(const cell of cells){
    if(cell.id==='materials-warehouse'||cell.id==='hygiene')continue;
    const mid=(cell.minX+cell.maxX)/2;
    walls.push(wallSegment(`${cell.id}-side`,[cell.minX,cell.minZ],[cell.minX,cell.maxZ]),
      wallSegment(`${cell.id}-front-a`,[cell.minX,cell.maxZ],[mid-.6,cell.maxZ]),
      wallSegment(`${cell.id}-front-b`,[mid+.6,cell.maxZ],[cell.maxX,cell.maxZ]));
  }
  return walls;
}
const room3Partitions=[...wallsForCells(room3Cells),
  wallSegment('front-room-back',[-.8,-.3],[15.675,-.3]),
  wallSegment('front-room-side',[-.8,-.3],[-.8,11.6])];
const room3Doors=[...doors.filter(d=>['entry-door','rear-stair-door','front-room-door'].includes(d.id)),
  ...room3Cells.filter(c=>c.minZ< -11).map(c=>({id:`${c.id}-door`,x:(c.minX+c.maxX)/2,z:c.maxZ,width:1.2,rotation:0,kind:'swing'}))];
const room3Path=LEGACY_PACKAGING_ROOM.path.map(p=>[...p]);
for(const p of room3Path)if(p[1]===4.05&&p[0]<0)p[1]=4.20;
for(const p of room3Path)if(p[2]===-11.8)p[2]=-11.95;
// Walk on the aisle side of the main equipment and keep the under-deck area visible.
room3Path.splice(27,1,[-7.05,4.2,-9.3],[-7.05,4.2,6.5]);
export const PACKAGING_ROOM = Object.freeze({...LEGACY_PACKAGING_ROOM,
  identity:TEAM2_IDENTITY,
  name:'스틱·소포장 · 3층',shortName:'스틱·소포장 3층',title:'스틱·소포장 · 3층',
  center:[0,2.5,0],path:PACKAGING_PATHS[3],pathEndLookAt:PACKAGING_PATH_END_LOOKATS[3],
  layout:{...LEGACY_PACKAGING_ROOM.layout,mainPlatform:updatedMainPlatform,auxPlatform:updatedAuxPlatform,
    columns:perimeterColumns,rooms:room3Cells,partitions:room3Partitions,doors:room3Doors,
    stairs:stairs.map(stair=>stair.id==='front-stair'?{...stair,flights:4,stepsPerFlight:10,rise:6.15}:stair),
    ceilingHeight:6,eaveHeight:6,ridgeHeight:7.36,ridgeZ:7.6,floorToFloor:null,
    heightReference:'A-11 처마 6.0m·용마루 차 1.36m 우선. 경사 1.5:10과 대칭 반경간의 불일치는 근거 문서에 기록.',
    mixerDuctConnections:[
      {x:-11.82,y:6.84,z:-7.85},{x:-11.82,y:6.29,z:-3.25},
      {x:-11.82,y:5.95,z:1.25},{x:-11.82,y:6.29,z:5.15},
    ],
  },
  photos:[workplacePlan(3),...team2RoomPhotos(3),plan,redesignFrame(1057),redesignFrame(506),redesignFrame(909),redesignFrame(850)],
  reference:workplacePlan(3),photoCaptions:allCaptions,
  summary:'무중력 믹서, 원통 호퍼·교반기와 스틱 원료 공급부를 2팀 이력카드 사진으로 확인합니다.',
  confidence:'현재 2팀 · 스틱·소포장동 9동 · 설비이력카드 사진',
  details:['무중력 믹서 3대, 원통 호퍼 1~3, 지대 교반기 #4와 스틱 원료 공급부를 구분합니다.',
    '촬영 영상의 소형 호퍼는 통로 양쪽 4개씩 8개로 재현했습니다. 도면의 공급대상 표기와 실물 수량을 구분합니다.'],
});
const floor1Cells=[
  roomCell('f1-material-store','부자재창고',-15.675,-4.4,-15.2,-10.1),
  roomCell('f1-small-pack','소포장 포장실',-15.675,-4.4,-10.1,15.2),
  roomCell('f1-outer-pack','외포장실',-4.4,12.2,-15.2,15.2),
  roomCell('f1-aisle','통로',12.2,15.675,-15.2,15.2),
  roomCell('f1-air-shower','부자재 에어샤워',-15.675,-12.3,11.4,15.2),
  roomCell('f1-cip','CIP실',-2.2,-1.2,12.2,15.2),
];
const floor2Cells=[
  roomCell('f2-store','창고',-15.675,-12,-15.2,-12.7),
  roomCell('f2-cip','CIP룸',-12,-7.2,-15.2,-12.7),
  roomCell('f2-break','휴게실',-7.2,-.6,-15.2,-12.7),
  roomCell('f2-office','사무실',-.6,3.2,-15.2,-12.7),
  roomCell('f2-nitrogen','질소발생기실',3.2,8.1,-15.2,-12.7),
  roomCell('f2-hot-air','열풍기실',8.1,15.675,-15.2,-12.7),
  roomCell('f2-stick','스틱 포장실',4.4,15.675,-11.5,5.4),
  roomCell('f2-hygiene','위생전실',4.4,9.4,5.4,8.1),
  roomCell('f2-air-shower','부자재 에어샤워',10.6,14.5,5.5,7.9),
  roomCell('f2-material-store','부자재창고',9.4,15.675,5.4,10.4),
  roomCell('f2-air','공조실',9.4,15.675,10.4,15.2),
  {...roomCell('f2-outer-pack','외포장실',-4.4,4.4,-12.7,15.2),ceiling:false},
];
function lowerRoom(level,cells){
  const two=level===2;
  const levelWalls=two?[...wallsForCells(cells.filter(c=>c.minZ< -12)),
    wallSegment('hopper-room-side-a',[-4.4,-12.7],[-4.4,-9.8]),wallSegment('hopper-room-side-b',[-4.4,-8.4],[-4.4,10.5]),
    wallSegment('hopper-room-side-c',[-4.4,11.9],[-4.4,15.2]),
    wallSegment('stick-rear',[4.4,-11.5],[15.675,-11.5]),wallSegment('stick-side-a',[4.4,-11.5],[4.4,-6.3]),
    wallSegment('stick-side-b',[4.4,-4.7],[4.4,5.4]),wallSegment('stick-front',[4.4,5.4],[15.675,5.4]),
    wallSegment('stores-side',[9.4,8.1],[9.4,15.2]),wallSegment('stores-split',[9.4,10.4],[15.675,10.4])]:[
    wallSegment('material-store-front',[-15.675,-10.1],[-5.5,-10.1]),
    wallSegment('small-pack-side',[-4.4,-15.2],[-4.4,15.2]),wallSegment('aisle-wall',[12.2,-15.2],[12.2,13.5]),
    wallSegment('f1-air-shower-side',[-12.3,11.4],[-12.3,15.2]),wallSegment('f1-air-shower-front',[-15.675,11.4],[-12.3,11.4]),
    wallSegment('f1-cip-side-a',[-2.2,12.2],[-2.2,15.2]),wallSegment('f1-cip-side-b',[-1.2,12.2],[-1.2,15.2]),
    wallSegment('f1-cip-front',[-2.2,12.2],[-1.2,12.2]),
  ];
  const levelPath=two?[[-4,1.65,15.8],[-4,1.65,11.3],[-4,1.65,-11.9],[2,1.65,-11.9],[2,1.65,-9],[2,1.65,11.3],[7.5,1.65,11.3],[7.5,1.65,7],[6.2,1.65,7],[6.2,1.65,3],[6.2,1.65,-8.5]]:
    [[-4,1.65,15.8],[-4,1.65,12],[-2.8,1.65,12],[-2.8,1.65,-10.3],[1.5,1.65,-10.3],[1.5,1.65,-8.5],[1.5,1.65,9],[11.2,1.65,9],[11.2,1.65,-10.5]];
  return Object.freeze({...LEGACY_PACKAGING_ROOM,identity:TEAM2_IDENTITY,floorLevel:level,name:`스틱·소포장 · ${level}층`,shortName:`스틱·소포장 ${level}층`,title:`스틱·소포장 · ${level}층`,
    center:[0,2.1,0],path:PACKAGING_PATHS[level],pathEndLookAt:PACKAGING_PATH_END_LOOKATS[level],
    layout:{...LEGACY_PACKAGING_ROOM.layout,rooms:cells,partitions:levelWalls,transportLines:PACKAGING_TRANSPORT_LINES[level],
      doors:[...doors.filter(d=>['entry-door','rear-stair-door'].includes(d.id)),
        ...(two?[{id:'f2-stick-entry',x:6.2,z:5.4,width:1.4,rotation:0,kind:'swing'}]:[
          {id:'f1-air-shower-entry',x:-13.9,z:11.4,width:1.2,rotation:0,kind:'swing'},
          {id:'f1-small-pack-personnel-entry',x:-4.4,z:13.2,width:1.4,rotation:Math.PI/2,kind:'swing'},
          {id:'f1-cip-entry',x:-1.7,z:12.2,width:.8,rotation:0,kind:'swing'}])],
      stairs:stairs.map(stair=>stair.id==='front-stair'?{...stair,flights:two?4:1,stepsPerFlight:two?9:1,rise:two?6:.1}:stair),
      columns:[...perimeterColumns.filter(c=>c.z!==0||Math.abs(c.x)>15),
        ...[-5.125,5.125].flatMap(x=>[-10,-5,0,5,10].map(z=>column(x,z)))].map(c=>({...c,height:two?5.8:5.65})),
      mainPlatform:two?{minX:-13.2,maxX:-7.2,minZ:-10.4,maxZ:7,height:1.2,stairLength:1.2,stairEnds:['minZ','maxZ']}:null,
      auxPlatform:null,ceilingHeight:two?5.8:5.65,floorToFloor:two?6.15:6,roof:false,
      heightReference:two?'A-11 2층 FL+6100 → 3층 FL+12250, 바닥간 6.15m':'A-11 1층 FL+100 → 2층 FL+6100, 바닥간 6.0m',
    },reference:workplacePlan(level),photos:[workplacePlan(level),...team2RoomPhotos(level),sourcePhoto(`floor-${level}-architecture`),
      ...(two?['floor-2-workers-route-20231018','floor-2-materials-route-20231018','stick-packer-plan','stick-packer-elevations','floor-2-auger-proposal'].map(sourcePhoto):[])],photoCaptions:allCaptions,
    source:`2025 ${level}층 작업장평면도 · 9동 ${level}층 건축 평면도 A-0${level+4} · 주단면도 A-11`,
    summary:two?'스틱 1~8호기와 호퍼 1~4, V-MIX, 외포장·검사 설비를 확인합니다.':'소포장 포장실과 외포장실의 충전·검사·박스 포장·로봇 이송 배치를 확인합니다.',
    confidence:'2025 작업장평면도 · 9동 건축 도면',
    details:['설비 종류·순서와 방 용도는 층별 작업장평면도를 따릅니다.','개별 설비의 외형·설치 높이와 이격은 도면 배치를 위한 재현값입니다.'],
  });
}
export const PACKAGING_ROOMS=Object.freeze({1:lowerRoom(1,floor1Cells),2:lowerRoom(2,floor2Cells),3:PACKAGING_ROOM});
export const PACKAGING_FLOOR_ELEVATIONS=Object.freeze({1:0,2:6,3:12.15});
export const PACKAGING_OVERVIEW=Object.freeze({...PACKAGING_ROOM,floorLevel:0,
  name:'2팀 · 스틱·소포장동 전체',shortName:'2팀 스틱·소포장 전체',title:'2팀 · 스틱·소포장 1·2·3층',
  center:[-1.7,9,1.5],span:60,height:19.51,
  summary:'현재 2팀의 스틱·소포장동 1·2·3층을 도면 층고대로 함께 봅니다.',
  details:['1층 소포장·외포장, 2층 스틱 포장, 3층 배합·원료 공급을 구분합니다.','층을 선택하면 해당 층의 설비와 통로를 볼 수 있습니다.'],
  photos:[workplacePlan(1),workplacePlan(2),workplacePlan(3)],reference:workplacePlan(3),
});
const oldById=new Map(LEGACY_PACKAGING_EQUIPMENT.map(i=>[i.id,i]));
function redesigned(id,name,type,x,z,width,depth,height,seconds=[],extra={}){
  const old=oldById.get(id);
  const pictures=seconds.length?seconds.map(redesignFrame):[workplacePlan(extra.floorLevel||3)];
  return Object.freeze({id,name,tag:name,type,floor:'packaging',floorLevel:3,position:[x,0,z],rotation:0,width,depth,height,labelHeight:height+.35,platformHeight:0,
    parts:['본체·지지 구조','처리·투입부','구동·배출·부속'],
    photos:pictures,photo:pictures[0],photoCaptions:allCaptions,summary:name,
    confidence:'작업장평면도·영상 대조',details:[],
    ...(old?{previousPosition:[...old.position],previousRotation:old.rotation||0}:{}),...extra});
}
const mixerParts=['본체·구동','투입부·배기후드·커튼','하부 호퍼·바닥 배출'];
const mainZ=[-7.5,-2.9,1.6,5.5];
const thirdFloorEquipment=[
  ...mainZ.slice(0,3).map((z,i)=>redesigned(`packaging-main-mixer-${i+1}`,`무중력 믹서 ${i+1}호기`,'packaging-mixer',-11.3,z,3.1,4.1,i===0?7.25:6.6,[379,506,674,330],{platformHeight:2.55,parts:mixerParts,cardNumber:i+1,cardDesign:true,variant:['belt','dark-belt','twin'][i],hoodVariant:i===2?'booth':'canopy',...(i===0?{hoodDuctTop:6.7,hoodRiserHeight:1.1}:{})})),
  redesigned('packaging-round-process','교반기 #4 · 지대','packaging-card-agitator',-11.3,5.5,2.7,2.8,5.95,[732,393],{platformHeight:2.55,cardNumber:4}),
  ...mainZ.slice(0,3).map((z,i)=>redesigned(`packaging-mixer-sieve-${i+1}`,`진동채 ${i+1}호기`,'packaging-sieve',-7.5,z,1.2,2.6,4.1,[478],{platformHeight:2.55,cardNumber:i+1,cardDesign:true,previousPosition:[-8,0,z]})),
  ...mainZ.slice(0,3).map((z,i)=>redesigned(`packaging-card-hopper-${i+1}`,`호퍼 ${i+1}호기 · 원통 교반형`,'packaging-card-hopper',-8.9,z,1.7,1.7,[5.6,5.6,5.2][i],[],{platformHeight:2.55,cardNumber:i+1})),
  ...[-7.5,-3.6].map((z,i)=>redesigned(`packaging-aux-mixer-${i+1}`,`스틱 믹서 ${i+1}호기`,'packaging-stick-mixer',8.35,z,2.5,2.8,5.65,[916,918,948],{platformHeight:2.4,parts:mixerParts,variant:'twin',hoodVariant:'booth'})),
  ...[-8.8,-1.6].map((z,i)=>redesigned(`packaging-stick-sieve-${i+1}`,`스틱 시프트 ${i+1}`,'packaging-sieve',6.9,z,1,1,3.8,[478],{platformHeight:2.4})),
  redesigned('packaging-stick-hopper-row','소형 공급 호퍼 · 8개','packaging-stick-hoppers',12.2,-5.5,3.3,8.4,4.5,[850,805,829,905],{platformHeight:2.4,count:8,hopperLayout:Array.from({length:8},(_,i)=>({x:(i%2?1:-1)*.75,z:(Math.floor(i/2)-1.5)*2,label:`소형 호퍼 ${i+1}`,variant:i%3}))}),
  redesigned('packaging-cyclone-frame','싸이클론 탱크·2단 프레임','packaging-cyclone-frame',12.2,-5.5,3.5,8,6.7,[909,958,1019],{platformHeight:2.4,count:5,upperDeckHeight:4.8,
    cycloneLayout:Array.from({length:5},(_,i)=>({x:(i%2?1:-1)*.75,z:(i-2)*1.55}))}),
  redesigned('packaging-suspended-distribution','현수 분배함','packaging-suspended-distributor',12.2,-5.5,3,8.8,4.8,[995],{platformHeight:2.4}),
  redesigned('packaging-mixer-control','무중력 믹서 제어반 · F-750 외','packaging-control',-9,-.65,1.4,.55,4.55,[557,561],{platformHeight:2.55,controlVariant:'dual-mixer'}),
  redesigned('packaging-hopper-level-control','HOPPER LEVEL 제어반','packaging-control',5.2,-5.5,.8,.5,2,[957],{controlVariant:'hopper-level'}),
  redesigned('packaging-wall-control','벽면 조작함','packaging-control',14.9,7.5,.65,.3,1.9,[962],{wallMounted:true,mountHeight:1}),
  redesigned('packaging-ground-vessel','CIP실 온수탱크','packaging-vessel',-11.8,-13.8,1.15,1.2,2.5,[278]),
  redesigned('packaging-wash-sink','CIP실 2조 싱크','packaging-sink',-9.6,-14.2,1.65,.65,1.2,[300]),
  redesigned('packaging-cip-services','CIP실 세척·건조 설비','packaging-cip-services',-10.3,-12.9,1.8,.8,1.8,[300]),
  redesigned('packaging-floor-scale','계량실 CAS 저울','packaging-scale',-1.8,-13.4,.8,1,1.5,[746]),
  redesigned('packaging-weigh-services','계량실 흡입후드·PC 캐비닛','packaging-weigh-services',1,-13.8,2,1,2.8,[746,760]),
  redesigned('packaging-entry-station','위생전실 세정·출입설비','packaging-hygiene-station',-5.8,13.2,2.2,1,2.3,[174]),
];
const lineItem=(level,id,name,type,x,z,w,d,h=1.8,extra={})=>redesigned(`packaging-f${level}-${id}`,name,`packaging-${type}`,x,z,w,d,h,[],{floorLevel:level,confidence:'층별 도면 배치 · 외형 재현',...extra});
const floor1Equipment=[
  lineItem(1,'rotary-1','로터리 1호기 포장기','rotary-packer',-10.1,-7.7,3.1,2.2,3.1,{rotaryVariant:'rotary1'}),
  lineItem(1,'rotary-2','로터리 2호기 포장기','rotary-packer',-10.1,-4.8,3.1,2.2,3.1,{rotaryVariant:'rotary2'}),
  lineItem(1,'vertical','버티컬 2호기 포장기','vertical-packer',-10.1,-1.7,2.9,2.4,3.5),
  lineItem(1,'bag-filler','지대백 포장기','bag-filler',-10.1,5.3,2.9,2.1,3.1),
  ...[-7.7,-4.8,-1.7].map((z,i)=>lineItem(1,`check-${i+1}`,`중량선별기 ${i+1}`,'checkweigher',-6.5,z,2.1,1.1,1.3)),
  ...[-6.9,-4.4,-.9].map((z,i)=>lineItem(1,`xray-${i+1}`,`X-Ray ${i+1}호기`,'xray',-1.5,z,2.1,1.25,1.8)),
  ...[-6.9,-4.4,-.9].map((z,i)=>lineItem(1,`robot-${i+1}`,`포장 로봇 ${i+1}`,'robot',1.1,z,1.6,1.5,3.5,{robotIndex:i+1,robotVariant:'delta'})),
  ...[-6.9,-4.4,-.9].map((z,i)=>lineItem(1,`sealer-${i+1}`,`날인·테이핑기 ${i+1}`,'case-sealer',3.8,z,1.7,1.2,1.7)),
  ...[-6.9,-4.4,-.9].map((z,i)=>lineItem(1,`box-check-${i+1}`,`박스 중량선별기 ${i+1}`,'checkweigher',6.3,z,1.7,1.2,1.35)),
  ...[-13.6,-11.7,-9.9].map((z,i)=>lineItem(1,`erector-${3-i}`,`제함기 ${3-i}호기`,'carton-erector',-.8,z,2.5,1.3,1.9)),
  lineItem(1,'metal','금속검출기','metal-detector',.1,6.3,2.1,1.1,1.4),
  lineItem(1,'robot-4','케이샤 4호기','robot',9.1,3.2,2.2,2.3,3.2,{robotIndex:4,robotVariant:'case-palletizer'}),
  lineItem(1,'robot-5','케이샤 5호기','robot',9.1,-4,2.2,2.3,3.2,{robotIndex:5,robotVariant:'case-palletizer'}),
  lineItem(1,'conveyor-trunk','외포장 합류 이송 컨베이어','conveyor',7.7,3.55,.85,22.5,1,{rotation:0,previousPosition:[11.1,0,-1.8],previousPositions:[[7.7,0,-1.8]],details:['2025 평면도의 합류 라인은 케이샤 4·5호기 왼쪽에서 앞쪽 출구까지 이어집니다. 통로 쪽 긴 도형과 구분하며 길이·좌표는 도면 비례 재현값입니다.']}),
];
const floor2Equipment=[
  ...[-8,-3.8,.4,4.6].map((z,i)=>lineItem(2,`hopper-${i+1}`,`호퍼 ${i+1}`,'hopper',-10.3,z,2.5,2.8,4.3,{platformHeight:1.2})),
  ...[-8.4,-4.1,.2,3.8].flatMap((z,row)=>[8.7,12.7].map((x,col)=>lineItem(2,`stick-${row*2+col+1}`,`스틱 ${row*2+col+1}호기`,'stick-filler',x,z,2.0,2.4,2.9,{lineNumber:row*2+col+1,
    photos:[workplacePlan(2),sourcePhoto('stick-packer-elevations'),sourcePhoto('stick-packer-plan')],
    details:['배치는 9동 스틱 작업장평면도, 외형은 현재 2팀 이력카드의 해당 스틱 호기 사진을 우선합니다.']}))),
  ...[-12.6,-8.5].map((x,i)=>lineItem(2,`v-mix-${i+1}`,`V-MIX ${i+1}`,'v-mixer',x,12.6,2.8,1.8,2.5)),
  ...[-6.2,2.5,7.3].map((z,i)=>lineItem(2,`xray-${[1,3,2][i]}`,`X-Ray ${[1,3,2][i]}호기`,'xray',[-1,1.3,-.5][i],z,1.8,1.25,1.8,{rotation:Math.PI/2,previousRotation:0})),
  ...[-4.4,4.3,9.1].map((z,i)=>lineItem(2,`check-${i+1}`,`중량선별기 ${i+1}`,'checkweigher',[-1,1.3,-.5][i],z,1.8,1.1,1.3,{rotation:Math.PI/2,previousRotation:0})),
  ...[-2.7,6,10.8].map((z,i)=>lineItem(2,`taper-${i+1}`,`${['A','C','B'][i]}라인 테이핑기`,'case-sealer',[-1,1.3,-.5][i],z,1.65,1.1,1.8,{tapeVariant:i===1?'cyan':'cream',rotation:Math.PI/2,previousRotation:0})),
  lineItem(2,'incase','인케이스 포장기','carton-erector',2.5,-7,1.8,1.5,2),
  lineItem(2,'nitrogen','질소발생기','service-cabinet',5.6,-13.8,1.3,1,2),
  lineItem(2,'hot-air','열풍기','service-cabinet',11.4,-13.8,2,1.2,2.5),
  ...[-8.4,.2].map((z,i)=>lineItem(2,`hotmelt-${i+1}`,`핫멜트 ${i+1}`,'service-cabinet',5.9,z,.7,.7,1.3)),
  ...[-8.4,.2].map((z,i)=>lineItem(2,`printer-${i+1}`,`날인기 ${i+1}`,'service-cabinet',6.7,z,.6,.6,1.2)),
  lineItem(2,'hygiene','위생전실 세정설비','hygiene-station',6.2,6.5,1.8,.7,2.1),
];
export const PACKAGING_EQUIPMENT=Object.freeze([...floor1Equipment,...floor2Equipment,...thirdFloorEquipment].map(bindTeam2Card));
