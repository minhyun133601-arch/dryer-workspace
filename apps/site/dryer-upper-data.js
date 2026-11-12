// Historical architectural dimensions and the new roof-to-hall video are
// registered together. Equipment poses are approximate; they are not a survey.
const frame = (second) => `./photos/dryer-roof-7f/frame-${String(second).padStart(3, '0')}s.jpg`;
const mainBounds = Object.freeze({ minX: -8.6, maxX: 8.6, minZ: -13.4, maxZ: 13.4 });
const serviceApron = Object.freeze({ minX: -8.6, maxX: 13.4, minZ: -13.4, maxZ: -6.7, elevation: 32.6 });
const roofProfile = Object.freeze({
  kind: 'gable', eave: 37.4, ridge: 40.4,
  minX: -8.6, maxX: 8.6, minZ: -6.7, maxZ: 13.4,
  serviceApron,
  catwalk: { widths: [1, .75], guardHeight: 1.2, basis: 'A018/A033 도면의 지붕 점검통로 · 현재 위치 개략' },
  stairs: { minX: 8.6, maxX: 13.4, minZ: -13.4, maxZ: -6.7, fromY: 26.2, toY: 32.6, flights: 4 },
  basis: 'A017 서비스 bay는 7층과 같은 높이이며 처마·용마루는 별도 지붕 표고입니다.',
});

export const DRYER_UPPER_FLOORS = Object.freeze({
  6: Object.freeze({
    elevation: 26.2, height: 6.4, width: 17.2, depth: 26.8, bounds: mainBounds,
    summary: 'A016 6층 평면과 영상의 4개 하강·상승 계단 런을 대조한 설비 홀입니다. 현장 장치의 세부 위치·치수는 개략입니다.',
    source: 'A016/A020 건축도면 + 옥상~7층 현장 영상 동선 대조', reference: frame(174),
    roofProfile, chamberOpening: { x: -1, z: 7.5, diameter: 8.3, basis: 'A016/A019 CHAMBER HOLE · 설비 외경과 다름' },
  }),
  7: Object.freeze({
    elevation: 32.6, height: 4.8, width: 17.2, depth: 26.8, bounds: mainBounds,
    name: '7층 · 상부 관찰 웰', shortName: '상부 관찰 웰',
    summary: '6층 홀에서 내부 계단으로 올라가는 원형 상부 개구와 점검 보행면입니다. 북측 서비스 bay와 같은 표고이며, 지붕 처마는 37.4m입니다.',
    source: 'A017/A019/A020 건축도면 + 영상 389~444초 상부 보행면', reference: frame(432),
    roofProfile, chamberOpening: { x: -1, z: 7.5, diameter: 8.6, basis: 'A017/A019 상부 개구 · 설비 외경과 다름' },
  }),
  8: Object.freeze({
    id: 8, name: '옥상 · 서비스 구역', shortName: '옥상', kind: 'roof', elevation: 32.6, height: 7.8,
    width: 22, depth: 6.7, bounds: serviceApron, roofProfile,
    summary: '계단 옆 엘리베이터 기계실과 물탱크·원통 설비가 있는 옥외 서비스 구역입니다. 7층 점검면과 같은 높이이며, 경사지붕 점검통로와 구분합니다.',
    source: 'A017 7층 서비스 bay + A018/A033 지붕 + 현장 영상 6~123초', reference: frame(6),
    datumBasis: '7층 32.6m와 같은 서비스 보행면 · 처마 37.4m/용마루 40.4m는 별도',
  }),
});

const pose = (x, z, previousX, previousZ, options = {}) => Object.freeze({
  floor: 6, visibleFloors: [6, 7], position: [x, 26.2, z], rotation: 0,
  previousPlacements: [{ position: [previousX, 37.5, previousZ], rotation: 0 }],
  positionBasis: 'historical-plan-and-video-approximation', positionConfidence: 'approximate',
  confidence: '현장 외형 확인 · A016/A017와 영상 동선으로 층 정합 · 세부 좌표·치수 개략',
  ...options,
});

export const DRYER_UPPER_OVERRIDES = Object.freeze({
  chamber: pose(-1, 7.5, -6, -3, {
    radius: 3.8, width: 7.6, depth: 7.6, height: 6.4, labelHeight: 6.5,
    summary: '6층 홀에서 7층 원형 관찰 웰까지 이어지는 챔버 외함입니다. 상부 개구를 밀폐 덮개로 막지 않고 별도 관찰 웰과 연속시킵니다.',
    sourceDetails: ['A016의 CHAMBER HOLE Ø8300 및 A017의 상부 개구 Ø8600은 건축 개구 치수이며 장비 외경이 아닙니다.', '모델 외경과 세부 위치는 사진 비례를 도면 구획에 맞춘 개략입니다.'],
    additionalPhotos: [frame(174), frame(180), frame(330), frame(432)],
  }),
  blower: pose(1.4, -10.9, 1.5, -2.5, {
    width: 4.95, depth: 4.26, height: 4.5, labelHeight: 4.8,
    summary: '6층 설비 홀의 대형 송풍기입니다. 영상의 케이싱·청록색 모터·플랜지·방진 받침과 상부에서 내려다보는 점검대를 대조했습니다.',
    additionalPhotos: [frame(186), frame(198), frame(204), frame(393)],
  }),
  heater: pose(3.4, -3.5, -6, 3.6, {
    name: '건조실 버너', width: 4.43, depth: 2.52, height: 6.3, labelHeight: 6.35,
    summary: '건조실 상부 버너입니다. 6층 홀과 7층 상부 점검면 사이의 높이 관계를 반영합니다. 누르면 NBP KOREA KHMA-H760 도면 분해도와 연소팬 교체·모터코일 소손 정비자료 2건을 확인합니다.',
    sourceDetails: ['현장 영상 356초에서 붉은 버너 헤드 2개가 한 외함 전면에 함께 보입니다. 버너 헤드를 별도 가열설비 2대로 중복 계수하지 않습니다.', '기존 버너 도면의 부품표 21항목과 분해도는 변경하지 않습니다.'],
    additionalPhotos: [frame(300), frame(330), frame(354), frame(356)],
  }),
  'cyclone-1': pose(-3.4, -8.3, 7, -5, { radius: 1.2, upperRadius: .8, width: 2.4, depth: 2.4, height: 5.3, labelHeight: 5.5, additionalPhotos: [frame(174), frame(192), frame(219)] }),
  'cyclone-2': pose(-3.4, -5.3, 7, 0, { radius: 1.2, upperRadius: .8, width: 2.4, depth: 2.4, height: 5.3, labelHeight: 5.5, additionalPhotos: [frame(213), frame(216), frame(264)] }),
  'cyclone-3': pose(-3.4, -2.3, 7, 5, { radius: 1.2, upperRadius: .8, width: 2.4, depth: 2.4, height: 5.3, labelHeight: 5.5, additionalPhotos: [frame(216), frame(219), frame(276)] }),
  panel: pose(6.5, 6.5, -10.5, 3.8, {
    width: 1.6, depth: .87, height: 2.83, labelHeight: 3,
    summary: '6층 홀의 챔버 인접 현장 제어반입니다. 전면 외형만 사진으로 재현하며 기존 별도 제어반 자료와의 동일성은 확정하지 않습니다.',
    additionalPhotos: [frame(174)],
  }),
});

export const DRYER_CONTINUITY_OVERRIDES = Object.freeze({
  'f5-dryer-cone': Object.freeze({
    position: [-1, 20.2, 7.5], radius: 3.8, height: 6,
    previousPlacements: [{ position: [-6, 22.5, -3], rotation: 0 }],
    summary: '6층 챔버와 같은 축으로 이어지는 5층 하부 콘의 개략 표현입니다. 하부 장비의 개별 배치·치수는 실측하지 않았습니다.',
    sourceDetails: ['상부 도면 축에 연속 정합했습니다. 하부 개별 배치는 미실측이며 콘의 외형·절단 높이는 층간 연결을 위한 개략입니다.'],
    positionBasis: 'continuous-upper-axis-approximation', positionConfidence: 'approximate',
  }),
  'f5-powder-recovery': Object.freeze({
    position: [-3.4, 20.2, -5.3], stations: [-3, 0, 3],
    previousPlacements: [{ position: [7, 22.5, 0], rotation: 0 }],
    summary: '6층 싸이클론 열의 동일 수평축 아래로 이어지는 분말 회수부의 개략 표현입니다.',
    sourceDetails: ['상부 도면 축에 연속 정합했습니다. 하부 개별 배치는 미실측이며 세 연결 위치는 상부 싸이클론 간격에 맞춘 개략입니다.'],
    parts: ['싸이클론 3개 긴 하부 콘·볼트 이음', '네 곳 외부 구동 모터·노란 커플링', '사각 배출·전이 외함 네 곳', '콘 지지 다리·발판·가새'],
    positionBasis: 'continuous-upper-axis-approximation', positionConfidence: 'approximate',
  }),
});

export const DRYER_UPPER_WELL = Object.freeze({
  id: 'dryer-chamber-upper-well', name: '챔버 상부 관찰 웰', type: 'dryer-upper-well', tag: 'CH-UPPER',
  floor: 7, visibleFloors: [6, 7], position: [-1, 32.6, 7.5], rotation: 0,
  radius: 4.3, width: 8.6, depth: 8.6, height: .8, belowFloor: 1, labelHeight: 1.6,
  summary: '6층 챔버 위에서 내려다보는 원형 관찰 개구와 점검대입니다. 독립된 추가 챔버가 아닌 기존 챔버의 상부 관찰 구역입니다.',
  details: ['영상 364~389초의 내부 계단 상승 뒤 399~444초에 원형 개구 주변을 걷는 장면을 반영했습니다.', 'A017/A019의 Ø8600은 상부 개구 치수입니다. 상세 난간·배관과 현재 좌표는 사진 비례에 따른 개략입니다.'],
  photo: frame(432), photos: [frame(400), frame(408), frame(420), frame(432), frame(444)],
  confidence: '상부 개구·점검 보행면 확인 · A017 대응 · 세부 위치 개략',
  positionBasis: 'historical-plan-and-video-approximation', positionConfidence: 'approximate',
  parts: ['관찰 웰 외피', '상부 점검 보행면', '난간·점검 부속'],
});

// Separate observed shapes on the upper walkway. Their function and exact
// dimensions are not inferred from the lower-hall blower or chamber.
export const DRYER_UPPER_OBSERVED_EQUIPMENT = Object.freeze([
  Object.freeze({
    id: 'dryer-upper-duct-run', name: '7층 대형 수평 덕트', type: 'dryer-upper-duct-run', tag: 'UPPER-DUCT',
    floor: 7, visibleFloors: [7], position: [-1, 32.6, 2], rotation: 0,
    width: 8.3, depth: 1.55, height: 2.25, belowFloor: .45, labelHeight: 2.8,
    summary: '상부 보행면에서 보이는 큰 수평 스테인리스 덕트와 하향 엘보입니다. 원형 점검뚜껑·패널 이음·받침을 현장 영상에 맞췄습니다.',
    details: ['400~432초의 관찰 형상을 별도 선택 그룹으로 구분했습니다. 보이지 않는 하부 연결 경로는 확정하지 않았습니다.', '관경·좌표는 사진 비례와 A017 보행 구역을 대조한 개략입니다.'],
    photo: frame(400), photos: [frame(393), frame(400), frame(408), frame(432)],
    confidence: '7층 관찰 외형 확인 · 연결 경로와 세부 치수 개략',
    positionBasis: 'historical-plan-and-video-approximation', positionConfidence: 'approximate',
    parts: ['수평 외함·점검뚜껑', '하향 엘보', '플랜지·받침'],
  }),
  Object.freeze({
    id: 'dryer-upper-tapered-housing', name: '7층 사각 테이퍼 외함', type: 'dryer-upper-tapered-housing', tag: 'UPPER-HOUSING',
    floor: 7, visibleFloors: [7], position: [3.8, 32.6, 2], rotation: 0,
    width: 3, depth: 2.2, height: 2.55, labelHeight: 3,
    summary: '7층 보행면 옆에서 관찰되는 큰 사각 외함과 경사 전이부·짧은 원통 연결부입니다. 볼트 고정 발판과 받침 다리도 반영했습니다.',
    details: ['414~420초의 형상을 기준으로 하며, 하부 송풍기와 별개인 추가 송풍기라고 단정하지 않습니다.', '내부 장치·정격·정확한 치수는 확인되지 않았습니다. 외함과 보이는 접속부만 표현했습니다.'],
    photo: frame(414), photos: [frame(408), frame(414), frame(420), frame(432)],
    confidence: '7층 외함·받침 관찰 · 기능과 세부 치수 미확정',
    positionBasis: 'historical-plan-and-video-approximation', positionConfidence: 'approximate',
    parts: ['사각 외함', '경사 전이부·원통 접속부', '고정 다리·발판'],
  }),
]);

const roofEquipment = (id, name, type, position, width, depth, height, seconds, options = {}) => Object.freeze({
  id, name, type, tag: id.replace('dryer-roof-', '').toUpperCase(), floor: 8, visibleFloors: [7, 8], position, rotation: 0,
  width, depth, height, labelHeight: height + .3,
  photo: frame(seconds[0]), photos: seconds.map(frame),
  positionBasis: 'service-bay-reference-placement', positionConfidence: 'approximate',
  confidence: '영상 외형 확인 · A017 서비스 bay 대응 · 실측 좌표·외형 치수 미확정',
  parts: ['주 외함', '상부·구동 외형', '받침·연결 부속'], ...options,
});

export const DRYER_ROOF_EQUIPMENT = Object.freeze([
  roofEquipment('dryer-roof-water-tank', '옥상 물탱크 · 총 20ton', 'dryer-roof-water-tank', [-6, 32.6, -10.2], 4.2, 3, 2.3, [6, 12], {
    summary: '명판에서 총수량 20ton·소화용수량 9ton이 확인되는 사각 물탱크입니다.',
    details: ['용량은 사진 속 물탱크용량표의 원문이며 모델 외형 치수로 계산한 값이 아닙니다.', 'A017 7층 서비스 bay의 물탱크 20ton 표기와 대조했습니다. 현재 세부 위치·외함 치수는 개략입니다.'],
    capacity: { totalTon: 20, firefightingTon: 9, basis: '영상 6/12초 명판 직접 판독' },
  }),
  roofEquipment('dryer-roof-cylindrical-shell', '옥상 원통형 셸 · 기능 미확정', 'dryer-roof-cylindrical-shell', [1.1, 32.6, -10.5], 3.4, 3.4, 5.8, [18, 24, 30, 33, 36, 45, 48], {
    summary: '벌어진 하부 받침, 볼트 링, 리브와 단차가 있는 원통형 외함 한 조립체입니다. 집진기·세정탑·팬 등 기능은 단정하지 않습니다.',
    details: ['18~48초의 연속 시점에서 보이는 같은 조립체를 한 그룹으로 묶었습니다. 여러 각도의 사진을 별도 설비로 추가하지 않았습니다.', 'A017의 원형 도형은 위치 맥락 참고입니다. 도면 Ø3000을 사진 속 외함의 실측 외경이나 기능 확정값으로 쓰지 않습니다.'],
  }),
  roofEquipment('dryer-roof-drive', '엘리베이터 기계실 구동장치', 'dryer-roof-drive', [6, 32.6, -11], 2.4, 1.7, 2.2, [69, 75, 84, 87, 102, 105, 123], {
    summary: '옥상 계단 옆 엘리베이터 기계실의 모터·풀리·축·받침을 현장 영상으로 재현했습니다. 기계실 용도는 사용자 확인과 A017 E.V 기계실 표기를 근거로 합니다.',
    details: ['모터·풀리·보호망·제어함 등 영상에서 보이는 외형을 반영했습니다. 구동 형식·모델명과 보이지 않는 내부 기구는 미확정입니다.', '엘리베이터실 내부 보기에서 외벽과 지붕을 열어 실내 설비를 확인할 수 있습니다.'],
    confidence: '엘리베이터 기계실 · 사용자 확인 / A017 대응 · 세부 치수 개략',
    roomUse: 'elevator-machine-room', roomUseConfirmed: true, driveTypeConfirmed: false,
  }),
]);
