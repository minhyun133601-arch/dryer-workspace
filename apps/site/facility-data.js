import { DRYER_UPPER_FLOORS } from './dryer-upper-data.js';
import { DRYER_BUILDING_FLOORS } from './dryer-building-data.js';
import { PREPARATION_PHOTOS } from './preparation-data.js';
import { HALL_WALK_FRAMES } from './dryer-compressor-media.js';

// Architectural drawings are the active floor references. Historical OWP
// process diagrams are preserved in references/owp-team2-20261029/derived-images/.
export const FLOOR_HEIGHT = 7.5;

export const FLOORS = Object.freeze([
  ...[1, 2, 3, 4, 5].map(id => ({ ...DRYER_BUILDING_FLOORS[id],
    reference: `./assets/drawings/dryer/dryer-floor-plan-${id < 4 ? `${id}f` : '4f5f'}.png`,
    photos: [...(id === 1 ? PREPARATION_PHOTOS : []), `./assets/drawings/dryer/dryer-floor-plan-${id < 4 ? `${id}f` : '4f5f'}.png`,
      ...(id === 3 ? HALL_WALK_FRAMES.map(frame => frame.path) : [])],
  })),
  { id: 6, name: '6층 · 건조 설비 홀', shortName: '건조 설비 홀', ...DRYER_UPPER_FLOORS[6] },
  { id: 7, ...DRYER_UPPER_FLOORS[7] },
  DRYER_UPPER_FLOORS[8],
]);

export function floorElevation(id) {
  const floor = FLOORS.find(floor => floor.id === Number(id));
  if (!floor) throw new RangeError(`Unknown floor: ${id}`);
  return floor.elevation;
}

export function floorHeight(id) {
  const floor = FLOORS.find(floor => floor.id === Number(id));
  if (!floor) throw new RangeError(`Unknown floor: ${id}`);
  if (Number.isFinite(floor.height)) return floor.height;
  const next = FLOORS.find(next => next.elevation > floor.elevation);
  return next ? next.elevation - floor.elevation : FLOOR_HEIGHT;
}

function equipment(floor, id, name, type, tag, x, z, options = {}) {
  const floorInfo = FLOORS.find(item => item.id === floor);
  const reference = floorInfo.reference;
  const {
    rotation = 0, summary = `${floorInfo.source}에 표시된 설비를 형태와 공정 관계 중심으로 재구성했습니다.`,
    parts = ['설비 외함', '구동부', '연결 배관'],
    details = [], labelHeight = 4.5, ...model
  } = options;
  return Object.freeze({
    id, name, type, tag, position: [x, floorElevation(floor), z], floor, rotation,
    summary,
    details: [
      ...details,
      '장치의 외형과 배치는 OWP 참고 화면에서 읽은 개략 구성입니다. 실측 치수와 상세 배관은 반영하지 않았습니다.',
      '분리 보기는 주요 외형 덩어리의 관계를 설명하는 개념 표현입니다.',
    ],
    photo: reference, photos: [reference],
    confidence: 'OWP 외형·공정 참고 · 위치·치수 개략',
    parts, labelHeight, ...model,
  });
}

export const LOWER_EQUIPMENT = Object.freeze([
  // 1F: three packaging lines and their upstream preparation equipment.
  ...[-9, -4, 1].map((x, i) => equipment(1, `f1-ica-${i + 1}`, `ICA ${i + 1}호 포장기`, 'packing', `ICA${i + 1}`, x, -2.8, { parts: ['포장기 본체', '원료 투입 호퍼', '필름·실링부', '배출 컨베이어'], labelHeight: 5.1 })),
  ...[-9, -4, 1].map((x, i) => equipment(1, `f1-xray-${i + 1}`, `X-RAY ${i + 1}`, 'xray', `XR-${i + 1}`, x, 1.6, { parts: ['검사 터널', '벨트·롤러', '조작부'], labelHeight: 3.2 })),
  equipment(1, 'f1-mix-a', '혼합 탱크 A', 'tank', 'MIX-A', -8.8, -8, { radius: 1.35, height: 2.45, variant: 'mixing', parts: ['탱크 외통', '상부 교반기', '하부 배관'], labelHeight: 5.1 }),
  equipment(1, 'f1-mix-b', '혼합 탱크 B', 'tank', 'MIX-B', -3.8, -8, { radius: 1.35, height: 2.45, variant: 'mixing', parts: ['탱크 외통', '상부 교반기', '하부 배관'], labelHeight: 5.1 }),
  equipment(1, 'f1-melting', '용해 탱크', 'tank', 'MELT', 1.2, -8, { radius: 1.15, height: 2.05, variant: 'mixing', parts: ['용해 탱크', '교반 구동부', '공급·배출 배관'], labelHeight: 4.6 }),
  equipment(1, 'f1-oil-water', '오일·열수 탱크 계통', 'utility-tanks', 'OIL / HW', 8, -7.5, { parts: ['오일 탱크', '열수 탱크', '순환 펌프·배관'], details: ['혼합 A·B의 내부 오일·열수 온도 표시는 공정 계통을 식별하는 참고로 사용했습니다. 개별 용기의 정확한 수는 확정하지 않았습니다.'], labelHeight: 4.4 }),
  equipment(1, 'f1-s1', 'S-1 탱크', 'tank', 'S-1', 8.8, -1.8, { radius: 1.25, height: 2.35, parts: ['탱크 외통', '상부 덮개', '배출·계측 배관'], labelHeight: 4.8 }),
  equipment(1, 'f1-conveyor-a', '포장 배출 컨베이어 A', 'conveyor', 'CV-A', -5.3, 6.1, { length: 11.2, rotation: Math.PI / 2, parts: ['롤러·벨트', '측면 프레임', '구동 모터'], labelHeight: 2.2 }),
  equipment(1, 'f1-conveyor-b', '포장 배출 컨베이어 B', 'conveyor', 'CV-B', 5.5, 5.6, { length: 7.2, parts: ['롤러·벨트', '측면 프레임', '구동 모터'], labelHeight: 2.2 }),
  equipment(1, 'f1-palletizer', '박스 적재부', 'palletizer', 'PL-01', 10, 6.7, { parts: ['적재 프레임', '승강·이송부', '팔레트·박스'], labelHeight: 5.2 }),

  // 3F sterilization/homogenization group.
  equipment(3, 'f3-sterilizer', '살균기·열교환 계통', 'process-skid', 'STER', -7, -4.8, { variant: 'sterilizer', parts: ['열교환 판형부', '배관·밸브', '계측·조작부'], details: ['OWP의 CCP-1B 원액온도와 살균 전·후 온도 표시가 있는 계통을 참고했습니다.'], labelHeight: 4.5 }),
  equipment(3, 'f3-homogenizer', '균질기', 'homogenizer', 'HOMO', -.6, -3.4, { parts: ['구동 본체', '고압 펌프 헤드', '압력계·배관', '조작부'], details: ['1·2차 압력 출력값과 셋팅값이 표시되는 균질기 계통을 참고했습니다.'], labelHeight: 3.6 }),
  equipment(3, 'f3-balance-tank', '원액 밸런스 탱크', 'tank', 'BT-03', -7.5, 4, { radius: 1.45, height: 2.65, parts: ['원액 탱크', '상부 덮개', '배출 배관'], labelHeight: 5 }),
  equipment(3, 'f3-feed-tank', '원액 공급 탱크', 'tank', 'FT-03', -2.3, 4.4, { radius: 1.12, height: 2.2, parts: ['공급 탱크', '교반 구동부', '공급·회수 배관'], variant: 'mixing', labelHeight: 4.7 }),
  equipment(3, 'f3-holding', '홀딩 배관·노즐 공급', 'process-skid', 'HOLD / E209', 6, 1.1, { variant: 'holding', parts: ['홀딩 배관 뱅크', '지지 프레임', '노즐 공급 배관', '계측부'], details: ['OWP의 홀딩시간과 노즐 원액압력 표시에 대응하는 연결 계통을 개략 구성했습니다.'], labelHeight: 4.9 }),

  // 4F horizontal V/F equipment.
  equipment(4, 'f4-fluid-bed', 'V/F 수평 장치', 'fluid-bed', 'V/F · E201', -4.9, -1.7, { parts: ['수평 본체', '상부 후드', '하부 구동·지지부', '흡입·배출 연결'], details: ['OWP 4층의 V/F 진공 표시와 수평 장치 외형을 참고했습니다. 내부 진동·유동화 구조는 단순화했습니다.'], labelHeight: 5.2 }),
  equipment(4, 'f4-fine-return', '화인리턴 계통', 'fine-return', 'FINE · E206', 6, -3.1, { parts: ['회수 용기', '상부 회수관', '배출·공급 연결'], labelHeight: 5.7 }),
  equipment(4, 'f4-transfer-bin', '분말 중간 배출부', 'hopper', 'BIN-04', 6, 4.5, { parts: ['호퍼 외함', '하부 배출부', '지지 프레임'], summary: 'V/F와 회수 배관 사이의 배출 계통을 읽기 쉽도록 단순화한 개략 용기입니다.', labelHeight: 4.3 }),

  // 5–6F tower boundaries are illustrative because OWP groups these floors.
  equipment(5, 'f5-dryer-cone', '챔버 하부 콘', 'dryer-body', 'CH-LOW', -6, -3, { variant: 'cone', parts: ['원추형 외함', '중앙 배출관', '지지 기둥', '점검·연결부'], details: ['7층 사진 기반 챔버의 수평 위치를 기준으로 하부 외함을 이어 붙였습니다. OWP는 5~7층을 한 화면으로 표시하므로 층별 절단 위치는 개략입니다.'], labelHeight: 6.9 }),
  equipment(5, 'f5-powder-recovery', '싸이클론 분말 회수부', 'recovery-manifold', 'PW-05', 7, 0, { parts: ['회수 배관', '로터리 배출부', '중간 수집 용기', '지지부'], labelHeight: 4.7 }),
  equipment(5, 'f5-extraction', '배출·순환 구동부', 'service-pump', 'EXT-05', .6, 6.1, { variant: 'extraction', parts: ['송풍·배출 본체', '구동 모터', '받침대', '연결 배관'], labelHeight: 3.5 }),
  equipment(6, 'f6-dryer-shell', '챔버 중간 외통', 'dryer-body', 'CH-MID', -6, -3, { variant: 'cylinder', parts: ['중간 원통 외함', '외함 밴드', '외부 배관', '점검·지지부'], details: ['7층 챔버와 5층 하부 콘을 잇는 외통입니다. 실제 층 경계와 높이는 실측되지 않았습니다.'], labelHeight: 7.1 }),
  equipment(6, 'f6-cyclone-bank', '싸이클론 1~3 하부 콘', 'cyclone-bank', 'CY-LOW', 7, 0, { parts: ['싸이클론 하부 콘', '배출 밸브', '지지 프레임', '회수 연결관'], details: ['7층의 싸이클론 1·2·3 위치 x=7, z=-5·0·5에 맞춰 하부 형상을 연결했습니다.'], labelHeight: 7.1 }),
  equipment(6, 'f6-exhaust-riser', '상층 순환 덕트', 'duct-riser', 'DUCT-06', .8, -8.3, { height: 6.8, radius: .67, variant: 'exhaust', parts: ['수직 덕트', '수평 연결관', '플랜지·지지부'], labelHeight: 7.1 }),
]);
