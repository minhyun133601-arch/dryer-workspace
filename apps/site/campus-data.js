// Yusan: address, north-up imagery, original plans, employee entrance photo.
// Metric positions are approximate image tracing, not survey coordinates.
import { REAR_TOWER_SURVEY, REAR_PACKAGING_SURVEY, REAR_STAIR_PHOTOS, REAR_STAIR_CAPTIONS, rearStairPhoto } from './rear-survey-data.js';
import { OFFICE_ROOF_PHOTOS } from './field-photos-20261125.js';
const photo = (seconds) => `./photos/company-video/frame-${String(seconds).padStart(3, '0')}s.jpg`;
const entrancePhoto = './photos/campus-entrance.png';
const sitePlan = './assets/drawings/campus/yusan-site-plan.png';
const plan2019 = './assets/drawings/campus/yusan-site-plan-2019.png';
const entryPlan2019 = './assets/drawings/campus/yusan-entrance-plan-2019.png';
const entranceGuide2026 = './assets/drawings/campus/entrance-site-guide-2026.jpg';
const towerSection = './assets/drawings/dryer/dryer-tower-section.png';
const outdoorEntry = './photos/outdoor/20261030_150434-000.jpg';
const outdoorAhu = './photos/outdoor-video/20261109_133757-004s.jpg';
const rearPhoto = (clip, seconds) => `./photos/campus-rear-side/clip-${String(clip).padStart(3, '0')}-${String(seconds).padStart(3, '0')}s.jpg`;
const boilerPhoto = (clip, seconds) => `./photos/boiler-room/clip-${String(clip).padStart(3, '0')}-${String(seconds).padStart(3, '0')}s.jpg`;
const BOILER_LAYOUT_CAPTIONS = Object.freeze({
  22: '출입문 안: 왼쪽 셔터 안쪽, 오른쪽 버너·제어반', 37: '보일러 상부 통로·사다리와 피라미드형 채광 지붕', 74: '안쪽 벽 콘크리트 계단 아래',
  106: '노란 보호망 송풍기', 118: '스테인리스 틀 증기 헤더·트랩', 218: '끝벽 가스 배관·청색 펌프', 238: '소금 포대·연수 설비·관류형 보일러',
});
const photoCaptions = Object.freeze({
  ...Object.fromEntries(OFFICE_ROOF_PHOTOS.map(({ path, label }) => [path, label])),
  ...REAR_STAIR_CAPTIONS,
  ...Object.fromEntries([[1, [16,24,36,48,50,64,76,100,106,110,120,122,128,160,168,176,178,180]], [2, [9,22,32,37,43,45,47,52,74,106,108,118,140,160,162,170,185,202,218,225,238]]].flatMap(([clip, seconds]) => seconds.map(second => [boilerPhoto(clip, second), `11/11 추가 현장영상 ${clip} · ${Math.floor(second / 60)}:${String(second % 60).padStart(2, '0')}${clip === 2 && second === 202 ? ' (원본 3:22.5)' : ''}${clip === 2 && second === 162 ? ' (원본 2:42.5) · 동양 보일러 연관식 DBHI-SS 300형 명판' : ''}${BOILER_LAYOUT_CAPTIONS[second] && clip === 2 ? ` · ${BOILER_LAYOUT_CAPTIONS[second]}` : ''}`]))),
  ...Object.fromEntries([52, 146, 186, 276, 278, 280].map((seconds) => [photo(seconds), `희창유업 홍보영상 · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}${seconds === 52 ? ' · 건물 모형' : ''}`])),
  [entrancePhoto]: '직원 제공 입구 사진 · 녹색 경비실·버스·차단기·직선 진입로',
  [sitePlan]: '유산공장 배치도(A3) · 유산동 250 · 과거 증축·철거 계획 포함',
  [plan2019]: '2019 명칭 배치 DWG 선택선·문자 검토 · 블록·해치 생략 · 현재 준공 확정 도면 아님',
  [entryPlan2019]: '같은 배치도 입구·경비실 검토 · 기존주차 기호의 내부 사선은 주차 방향을 뜻하지 않음',
  [entranceGuide2026]: '2026.11.12 경비실~2팀 입구 영상 2:24 · 현장 안내도 전체를 자른 원문 · 치수 없는 안내 그림',
  [towerSection]: '유산 4동 A-020 횡단면도 · 외곽 폭·높이 참고 · 상부 형상은 모형 장면과 차이 있음',
  [outdoorEntry]: '실외기실 진입부 · 100RT 냉각탑·물탱크',
  [outdoorAhu]: '액상동 옆 실외기실 · PET 공조기와 인접 응축기 · 11/09 영상 0:04',
  ...Object.fromEntries([[1, 16, '경비실 곡면 유리·흰 처마'], [1, 56, '도로 옆 낮은 창벽'], [1, 118, '생산1팀2파트 출입구 문패'], [1, 122, '같은 출입구 · 휴게실 문은 건물 뒷길 쪽'], [1, 185, '뒷길 유리문 · 1팀 2파트 휴게실 입구 (영상 문패는 옛 생산 2팀 표기)'], [1, 132, '지대가온실 문패 · 출입구와 주황 고속문 사이'], [1, 144, '오렌지 고속문·회색 셔터'], [1, 164, '도로 끝 초록 방류벽 위 야경유 1·2'], [1, 208, '건조실 뒷면 세로 창·차양'], [1, 252, '옹벽 아래 압축실·빨간 분리수거함'], [1, 256, '압축실 문패 · 재활용 압축기 창고'], [1, 264, 'LPG저장소·뒤쪽 콘크리트 건물'], [1, 295, '압축실 안 유압 압축기 동력부'], [1, 376, 'VAPORIZER 외함'], [1, 404, '콘크리트 건물과 방류턱 사이 자갈길'], [1, 415, '탱크 옆 빈 주차공간 너머 건조실 뒷벽'], [1, 432, '스테인리스 저장탱크·상부 보행면'], [2, 47, '저감미당 3 표찰'], [2, 64, '독립 원통 최소 4기 확인'], [2, 144, '팜유 표찰'], [2, 69, '탱크 사이 파란 조립식 밸브실'], [2, 120, '밸브실 내부 공압 밸브·배관·히터'], [3, 16, '탱크 구역에서 본 길 건너 건조실 탑'], [3, 20, '밸브실 옆 짧은 철제 계단']].map(([clip, seconds, caption]) => [rearPhoto(clip, seconds), `11/10 현장영상 ${clip} · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} · ${caption}`])),
});

export const CAMPUS_ROOM = Object.freeze({
  id: 'campus', name: '공장 전경', shortName: '공장 전경',
  center: [10, 8, 7.5], span: 250, length: 200, width: 200, depth: 235,
  anchor: [0, 0, 0], rotation: 0,
  location: Object.freeze({
    address: '경상남도 양산시 유산공단7길 45', parcelAddress: '경상남도 양산시 유산동 250',
    site: '희창유업 제2공장 · HC글로벌 유산공장',
    latitude: 35.36269436, longitude: 129.03104166, crs: 'WGS84 / EPSG:4326',
    xAzimuthDegrees: 325.4, zAzimuthDegrees: 55.4,
    registration: '북쪽이 위인 공개 항공사진에서 지붕·진입로를 대조한 근사 등록',
    surveyGrade: false, planAreaSquareMetres: 21130,
    sources: ['https://www.heechang.com/bbs/content.php?co_id=01_02', 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer', '직원 제공 입구.png', '유산공장 배치도(A3).pdf'],
  }),
  layout: Object.freeze({
    ground: { minX: -90, maxX: 110, minZ: -110, maxZ: 125 },
    // Rear edge = foot of the retaining wall traced on the aerial photo and
    // walked in the 11/10 video (LPG yard → gravel strip → tank bund).
    parcel: [[-78, -76], [6, -78.5], [36, -91.5], [88, -95], [90, 62], [-78, 62]],
    rearBoundarySource: 'aerial slope-foot trace + clip001 232-466s retaining wall views; approximate, not survey',
    entrance: {
      laneX: 72, laneWidth: 10, fromZ: 120, toZ: -63, gateZ: 63,
      guard: { position: [61, 0, 57.5], width: 10, depth: 8.9, height: 3.2 },
    },
    parking: { rows: [], fromX: -54, toX: 60, step: 3.2, depth: 5 },
    sideParking: { centerX: 82.5, fromZ: -58.4, toZ: 36, step: 3.8, depth: 5.2, width: 2.6, angleDegrees: 45 },
    entranceRoute: { source: 'guardhouse-team2-20261112', turnZ: -25, walkwayZ: -28, crosswalkZ: -23.5, speedBumpZ: -14, crossPassage: { fromX: 20, toX: 67, minZ: -29.5, maxZ: -20.5 }, registrationCorrectionX: -10 },
    // Rear yard drives seen in clip 001: the road end beside the dryer, and the
    // road behind the dryer that runs to the LPG/recycling yard.
    rearAccess: [
      { start: [77, 0, -60.5], end: [63.5, 0, -60.5], width: 5, source: 'clip001-140-164s-road-end' },
      { start: [66, 0, -58], end: [66, 0, -70], width: 5, source: 'clip001-155-171s-corner' },
      { start: [68.5, 0, -69.5], end: [22, 0, -69.5], width: 5, source: 'clip001-166-236s-rear-road' },
    ],
    // The green-roof concrete building behind the LPG is the 공무사무실
    // (user, 11/11) and is now a selectable campus item, not context.
    rearContext: [],
    loadingApron: { position: [27, 0, 38], width: 80, depth: 10 },
  }),
  reference: entranceGuide2026, photos: [entranceGuide2026, entrancePhoto, plan2019, photo(280), photo(278), sitePlan, photo(52)], photoCaptions,
  source: '직원 확인 주소·입구 사진 / 유산공장 배치도 / 공개 항공사진 / 희창유업 홍보영상 / 11/11 보일러실·주변 추가 현장영상',
  confidence: '유산공장 위치·직원 확인 진입 동선 반영 · 건물 치수는 외관 비례 근사',
  summary: '경비실~2팀 입구 연속 영상을 대조해 창고 하역면과 창·외벽, 1팀2파트 돌출 전실, 뒤편 승강기·노란문·2팀 오목 현관을 보완했습니다. 건물 뒤편·2팀 출입구 버튼으로 해당 구간을 가까이 봅니다.',
  details: [
    '직원 제공 입구 사진과 설명을 우선했습니다. 녹색 건물은 경비실이며, 차량은 아래쪽에서 오른쪽 도로를 따라 계속 직진합니다.',
    '주소와 항공사진의 지붕 배열을 맞추고, 홍보영상의 유리 전면동·높은 간판동·청색 생산동 외관을 보완했습니다.',
    '대지 21,130㎡와 10m 도로는 보관 도면에서 확인했습니다. 과거 증축·철거안이 섞여 있어 도면 동번호를 현재 외관 그룹에 단정하지 않았습니다.',
    '직원 요청에 따라 버스와 맞은편 주황 지붕동·진입로 건너 흰색동·전면 주황 띠창동은 생략했습니다. 주차는 도로변의 한 줄 사선 구획이며, 앞쪽 하역 차량을 제거하고 진입부 가까운 주차칸은 비워두었습니다.',
    '휴대폰 GPS는 촬영 위치 참고입니다. 실내 드리프트와 오차가 있어 건물 벽·층고·설비 위치를 GPS에 강제로 맞추지 않았습니다.',
    '11/11 재검토: 뒤쪽 대지를 영상에 없는 넓은 마당으로 늘렸던 해석을 되돌리고, 옹벽 발치를 항공사진에서 따라 그렸습니다. 건조실 뒷길을 따라 끝에서부터 LPG저장소(뒤에 콘크리트 건물)·옹벽 아래 재활용실(압축실)·자갈길·계단 옆 개방된 주차장·탱크 구역 순서이며, 탱크 구역은 길 건너 건조실을 마주하고 옹벽에 붙어 있습니다.',
    '2019 배치도의 옥외원료저장소(4동 뒤 도로 건너)와 기존 8동 자리, 영상 GPS 경로, 공개 항공사진의 지붕을 함께 대조했습니다. 위치·크기는 실측이 아닌 근사입니다.',
    '사용자 확인: 공무작업장·공무환경팀실은 건조실 맞은편 LPG 옆 건물입니다. 탱크 앞줄은 파란 밸브실과 탱크 2기, 뒤 두 줄 각 3기로 총 8기입니다. 계단은 앞벽이 아니라 옆쪽 벽을 넘습니다. 건조실 뒤 유리문은 1팀 2파트 휴게실입니다. 영상 문패에는 생산 2팀으로 적혀 있지만 사용자 확인으로 실제 사용 부서인 1팀 2파트를 표시합니다.',
    '11/11 추가 영상의 1팀 2파트 보일러실 문패와 내부에서 노통연관·관류형 각 1대를 확인했습니다. 전기실은 수변전실 표찰·녹색 철문과 보이는 콘크리트 출입 구조를 재현했으며 촬영되지 않은 전기실 내부는 추가하지 않았습니다.',
    '건조실·스틱 소포장·실외기실은 전경의 해당 구역을 누르면 전체 상세 화면으로 연결됩니다. 실외기실은 액상동의 바깥 외벽을 따라 본관 입구 쪽 끝까지 이어지며, 전경과 상세 화면에서 같은 22개 설비 외형을 봅니다.',
    '직원이 확인한 실외기실 끝과 본관 입구의 연결을 우선했습니다. 2022 액상공장 99.7×39.2m 건축 축과 배치도·항공사진의 연속 매스를 참고해 액상과 본관의 외벽을 맞췄으며, 현재 외곽·층고·연결 길이의 실측 정합은 아닙니다.',
  ],
});

function building(id, name, type, tag, position, width, depth, height, seconds, extra = {}) {
  const photos = seconds.map(photo);
  return Object.freeze({
    id, name, type, tag, floor: 'campus', position, rotation: 0,
    width, depth, height, labelHeight: height + 1.5,
    photo: photos[0], photos, photoCaptions,
    parts: ['건물 외함·기초', '지붕·상부 구조', '창·출입구·외부 시설'],
    summary: '유산공장의 공개 항공사진과 홍보영상에서 보이는 외형·인접 관계를 대조했습니다.',
    details: ['크기와 간격은 항공사진과 영상 비례에 따른 근사입니다. 동번호·내부 배치·실측 높이는 별도 확인이 필요합니다.'],
    confidence: '주소·항공사진·홍보영상 대조 · 외형과 간격 근사',
    ...extra,
  });
}

export const CAMPUS_EQUIPMENT = Object.freeze([
  building('campus-office', '본관', 'campus-office', '본관', [-36, 0, 20], 44, 35, 18, [280, 278, 52], {
    previousPosition: [-45, 0, 15], previousRotation: 0,
    summary: '큰 유리 전면과 녹색 평지붕을 가진 건물입니다. 입구 옆의 작은 녹색 경비실과 구분됩니다.',
    parts: ['백색 본체·유리 전면', '녹색 평지붕·환기구', '출입구·창·전면 조경'],
  }),
  building('campus-dryer-tower', '건조실 · 7층', 'campus-dryer-tower', '건조실 7층', [28, 0, -49], 17.2, 26.8, 40.4, [278, 280, 52], {
    previousPosition: [20, 0, -18], previousRotation: 0, labelHeight: 46,
    confidence: '건축 단면·11/12 경비실~2팀 입구 세부 영상 대조 · 크기·간격 비례 근사',
    floorCount: 7, floorLevels: [.3, 3.8, 7.3, 13.3, 20.2, 26.2, 32.6], thirdFloorElevation: 7.3,
    serviceTerrace: { position: [15, 0, 1], width: 48, depth: 36, elevation: 7.3 },
    rearElevatorOpening: { centerX: 14, width: 2.4, depth: 2.5, height: 2.9 },
    sideFacadeSurvey: { source: 'guardhouse-team2-20261112:80-140s', windows: [
      { z: 16.8, y: 5.75, width: 2.4, height: .55 }, { z: 11.5, y: 5.75, width: 2.4, height: .55 }, { z: 6.2, y: 5.75, width: 2.4, height: .55 },
      { z: 11.5, y: 1.95, width: 1.35, height: .45 }, { z: 8.7, y: 1.95, width: 1.35, height: .45 },
    ] },
    // Tower-local Z span of the attached 13.5 m boiler-room front wall.
    sideWindowExclusions: [{ from: -17.1, to: -3.15, reason: 'campus-boiler-room front wall (personnel door · grey shutter · window)' }],
    rearSurvey: REAR_TOWER_SURVEY,
    roomLink: 'all',
    exteriorDetails: [
      // User, 11/11: this door is only the 생산1팀 2파트 entrance. The real
      // break-room door is on the back road: the glass door whose old plate
      // says "생산 2팀 휴게실" (clip001 3:04-3:06). The user confirmed it is the
      // 1팀 2파트 휴게실 in actual use, so every visible label says 1팀 2파트.
      { id: 'production1-part2-entrance', name: '생산1팀 2파트 출입구', kind: 'projecting-vestibule', position: [39, 0, 16], datum: 'base', yaw: Math.PI / 2, width: 2.55, height: 2.55, depth: 1.15, paint: 'white', source: 'dryer-entrance-mezzanine-20261112:0-12s;guardhouse-team2-20261112:130-144s', frosted: true, observedOuterDoorType: 'two-panel-sliding' },
      // Video order along this wall (front → back): 출입구 → 지대가온실 →
      // fast-door control box with red beacon → orange fast door (원료출입구)
      // → gas riser → boiler-room window → grey shutter → boiler-room door.
      // 11/11 review: the old 지대가온실 canopy overlapped the orange door
      // canopy and the control box sat inside the orange door, so both moved
      // to the free wall the videos show between those doors.
      { id: 'bag-warming-room-door', name: '지대가온실', kind: 'paired-door', position: [39, 0, 3.6], datum: 'base', yaw: Math.PI / 2, width: 1.9, height: 2.3, paint: 'cream', source: 'boiler-clip-001-016s;prep-clip-001-020s', canopy: { width: 3.3, depth: 1, height: .3 } },
      { id: 'rear-fast-roll-door', name: '원료출입구', kind: 'roller-door', position: [39, 0, -1], datum: 'base', yaw: Math.PI / 2, width: 3.5, height: 4.2, paint: 'orange', source: 'boiler-clip-001-020s;boiler-clip-001-032s', canopy: { width: 4.8, depth: 1.2, height: .3 } },
      { id: 'rear-gray-shutter', name: '보일러실 장비 반입 셔터', kind: 'roller-door', position: [39, 0, -7.5], datum: 'base', yaw: Math.PI / 2, width: 3.4, height: 4.2, paint: 'steel', source: 'boiler-clip-001-044s;boiler-clip-002-020s' },
      { id: 'rear-yellow-gas-riser', kind: 'gas-riser', position: [39.15, 0, -3.7], datum: 'base', yaw: Math.PI / 2, width: 1.2, height: 5.2, source: 'boiler-clip-001-028s;boiler-clip-001-036s' },
      { id: 'fast-door-control-beacon', kind: 'door-controller', position: [39.12, 1.5, 1.75], yaw: Math.PI / 2, width: .45, height: .7, source: 'boiler-clip-001-024s;boiler-clip-001-026s;prep-clip-001-018s' },
    ],
    summary: '7층 건조실의 높은 세로창 계단 매스와 서쪽의 낮은 계단 매스를 나누고, 층별 루버·차양·후면 출입문을 11월 11일 영상으로 보완했습니다. 3층 녹색 작업면과 옆 스틱·소포장동은 구분합니다.',
    parts: ['7층 건조실 본체·3층 작업면', '상부 파라펫·뒤쪽 세로 구조', '공식 HEE CHANG 표기·3층 사이클론'],
    photo: rearStairPhoto(25), photos: [...REAR_STAIR_PHOTOS.slice(0,14),photo(52),towerSection,boilerPhoto(1,16),boilerPhoto(1,36),boilerPhoto(1,48),boilerPhoto(1,106),boilerPhoto(1,122),photo(278),photo(280)],
    details: ['직원이 이 간판 건물을 7층 건조실, 옆 동을 스틱·소포장으로 확인했습니다. 굴뚝처럼 보이는 외부 구조는 3층에 있는 사이클론입니다.', '첨부 사진을 상부·3층 설비·건물 접속부로 나누어 확대 대조했습니다. 사이클론을 지상 탱크처럼 두지 않고 3층 작업면과 함께 표현합니다.', '유산 4동 입면·단면도의 높이·폭·층 기준을 참고했습니다. 간판과 상부 외형은 첨부 모형 우선이며 현재 실측 확정 형상과는 구분합니다.'],
  }),
  building('campus-packaging-building', '스틱·소포장동 · 3층', 'campus-packaging-building', '스틱·소포장', [2.225, 0, -49], 31.35, 30.4, 18.15, [52, 278, 280], {
    roofRise: 1.36, roofRidgeHeight: 19.51, roofBays: 2,
    floorCount: 3, roomLink: 'packaging',
    confidence: '직원 확인 구역 · 소포장 3층 도면·영상 대조',
    summary: '7층 건조실 옆의 3층 스틱·소포장동입니다. 9동 A-11 단면의 층고와 낮은 박공 지붕 두 줄에 맞춰 처마18.15m·용마루19.51m로 고쳤습니다.',
    details: ['현재 2팀인 9동입니다. 9동 A-07 평면의 본체31.35×30.40m와 A-11 단면을 대조했습니다.', '1층 바닥을0으로 할 때 2층6.0m·3층12.15m·처마18.15m·용마루19.51m입니다. 지면GL과1층FL의100mm차는 외관 공통0기준에 별도 더하지 않았습니다.', '깊이30.4m를 반으로 나눈 박공 두 줄이며, 용마루 방향은 폭31.35m 축과 평행합니다. 출입 돌출 매스와 건물 간격은 영상 비례 근사입니다.', '뒷출입문은 실외기 열 끝의 직각 리턴벽에 있습니다. 사용자 요청으로 실외기·철골대 전체를 문 반대쪽으로1.5m 띄웠습니다.'],
  }),
  building('campus-production', '물류장', 'campus-production', '물류장', [27, 0, 6], 80, 51, 10, [278, 280, 52], {
    entranceRouteSurvey: true,
    previousPosition: [25, 0, 18], previousRotation: 0,
    summary: '청색 박공지붕 네 줄과 중앙 곡면 지붕의 물류장입니다. 11월12일 경비실~2팀 입구 연속 영상에 맞춰 하역 개구부·차양과 도로 옆 낮은 미닫이창·골판 외벽·낙수관을 보완했습니다.',
    parts: ['생산동 외함·하역구', '청색 박공지붕·중앙 아치', '천창·환기구·외벽 마감'],
    photos: [entranceGuide2026, entrancePhoto, photo(280), photo(278)], photo: entranceGuide2026,
  }),
  building('campus-blue-annex', '액상', 'campus-blue-annex', '액상', [-38.4, 0, -29.85], 39.2, 64.7, 8, [280, 52], {
    roomLink: 'liquid',
    previousPlacements: [
      { position: [-47, 0, -42], rotation: 0 },
      { position: [-40, 0, -42], rotation: 0 },
      { position: [-43, 0, -24], rotation: 0 },
    ],
    summary: '3팀 액상 공장입니다. 선택하면 도면·설비이력카드를 대조한 52개 실내 설비를 봅니다. 본관과 같은 바깥 외벽을 따라 실외기실이 이어지도록 연속 매스를 정리했습니다.',
    details: ['실외기실 끝에 본관 입구가 있다는 직원 설명을 우선해 액상과 본관의 바깥 외벽을 맞췄습니다.', '2022 액상공장의 99.7×39.2m는 건축 축 치수입니다. 현재 모델의 액상 64.7m와 본관 35m 분할, 외곽 폭·높이·이격은 배치도와 항공 외형을 결합한 근사이며 실측값은 아닙니다.'],
  }),
  building('campus-outdoor-area', '실외기실 · 액상~본관 입구', 'campus-outdoor-area', '실외기실', [-64.4, 0, -17.5], 110, 6.8, 6.8, [], {
    rotation: -Math.PI / 2, roomLink: 'outdoor', labelHeight: 8,
    previousPlacements: [
      { position: [-83, 0, -42], rotation: 0 },
      { position: [-61.4, 0, -17.5], rotation: -Math.PI / 2, catalogRevision: 'dryer-full-envelope-final-20261110' },
      { position: [-61.5, 0, -17.5], rotation: -Math.PI / 2, catalogRevision: 'dryer-full-envelope-final-20261110' },
    ],
    officeApproach: [[-66.33, 0, 35], [-66.33, 0, 40], [-36, 0, 40], [-36, 0, 37.85]],
    buildingGap: { nominalMetres: 3, direction: 'campus-world-negative-X', basis: '사용자 요청에 따른 전경 모델 이격 · 실측 간격 아님' },
    photo: outdoorAhu, photos: [outdoorAhu, outdoorEntry, photo(280)],
    parts: ['옥외 설비 기초·통로', '냉각탑·공조기·칠러 외관', '블록 담장·상부 배관'],
    summary: '액상·본관 외벽에서 모델상 약 3m 여유를 두고 본관 입구 쪽 끝까지 이어지는 실외기실입니다. 상세 화면과 같은 22개 설비·기초·통로를 전체 길이로 배치했습니다. 구역을 누르면 실외기실 상세 화면으로 들어갑니다.',
    confidence: '직원 확인: 액상 옆·끝에 본관 입구 · 도면·항공 대조 · 현 위치·치수는 근사',
    details: ['직원이 실외기실을 액상 옆이며 끝에 본관 입구가 있다고 정정했습니다. 짧게 축약한 구역을 제거하고 기존 110m 통로와 22개 설비의 상대 위치·외형을 그대로 전경에 옮겼습니다.', '공장 외벽이 왼쪽, 담장이 오른쪽인 촬영 방향을 유지하며, 초입 냉각탑의 넓은 기초와 끝부분에서 본관 전면 출입구로 이어지는 열린 접근로를 함께 표현합니다.', '2022 장비·유틸리티 도면, 2019 배치도, 새 냉동기 위치 평면도와 항공사진의 연속 외곽을 대조했습니다. 새 도면의 48.08RT와 현재 카드의 100RT·40RT를 동일 설비로 단정하지 않았습니다.', '110m는 기존 사진 기반 상세 모델의 전체 길이를 유지한 값입니다. 99.7m 건축 축과의 차이·현재 입구의 정확한 위치·연결 간격·지적 경계는 실측 정합이 아닙니다.'],
  }),
  building('campus-guardhouse', '정문 녹색 경비실', 'campus-guardhouse', '경비실', [61, 0, 57.5], 10, 8.9, 3.2, [], {
    placementRevision: 'entrance-route-registration-20261112',
    // The clipped/rounded corner faces the driveway and the yard (+X, -Z):
    // aerial roof outline, 2019 DWG chamfer and clip001 0:07-0:16 agree.
    footprint: [[0, 0], [6.4, 0], [10, 3.6], [10, 8.9], [0, 8.9]], clippedCorner: [1, -1],
    previousPlacements: [
      { position: [71, 0, 57.5], rotation: 0, catalogRevision: 'preparation-tank-openings-20261112' },
      { position: [71, 0, 53], rotation: 0 },
      ...['outdoor-campus-full-length-20261110', 'dryer-upper-roof-20261110', 'dryer-full-envelope-20261110', 'dryer-full-envelope-final-20261110', 'liquid-card-detail-spacing-20261110']
        .map((catalogRevision) => ({ position: [71, 0, 53], rotation: 0, catalogRevision })),
    ],
    photos: [rearPhoto(1, 16), entrancePhoto, entryPlan2019, plan2019], photo: rearPhoto(1, 16), confidence: '11/10 영상 곡면 유리·처마 · 항공사진 지붕 · 2019 배치 DWG 모따기 방향 대조',
    summary: '직원이 확인한 입구 옆의 작은 녹색 지붕 경비실입니다. 둥근 유리 모서리가 진입 차로와 안쪽 마당을 향하고, 길가 쪽 면은 정문 담장선에 붙어 있습니다.',
    parts: ['경비실 외함·기초', '녹색 평지붕·처마', '감시창·출입문·주변 시설'],
    details: ['직원이 확인한 녹색 경비실이며, 배치 DWG에도 10M 도로 옆 증축7동(경비실)이 한 곳 표시됩니다.', '11/11 재검토: 001 영상 0:07~0:16의 곡면 유리, 항공사진의 둥근 지붕 모서리, 2019 DWG의 모따기가 모두 진입로 안쪽 모서리를 가리켜 둥근 모서리를 반대편에서 이 자리로 옮겼습니다. 영상 0:01~0:06처럼 길가 옹벽 위 담장선에 붙도록 정문 쪽으로 4.5m 당겼습니다.', '도면 폐합 외곽의 10000×8900과 한 모서리 모따기를 참고했습니다. 원본 단위가 미지정이어서 mm 관례로 해석한 모델 비례이며 실측 확정값은 아닙니다.'],
  }),
  building('campus-wastewater-treatment', '폐수처리장 · 기존 10동 자리', 'campus-wastewater-treatment', '폐수처리장', [25, 0, 53.5], 44, 14, 7, [], {
    placementRevision: 'entrance-route-registration-20261112',
    previousPlacements: [{ position: [35, 0, 53.5], rotation: 0, catalogRevision: 'preparation-tank-openings-20261112' }],
    inspectableInterior: true, interiorView: { azimuth: .3, elevation: .9 },
    subsurfaceFootprint: { width: 44, depth: 14 },
    placementBasis: { requestedBuilding: '기존 10동', drawingAnchor: [25, 0, 57], yardInsetMetres: 3.5, surveyGrade: false, registrationCorrectionX: -10 },
    parts: ['지하 수조·콘크리트 구조', '사무실·약품·탈수설비', '처리 공정·송풍기·배관'],
    photo: './assets/drawings/wastewater/structure-plan-2022.png',
    photos: ['./assets/drawings/wastewater/structure-plan-2022.png', './assets/drawings/wastewater/structure-section-2022.png', './assets/drawings/wastewater/process-flow-2022.png', plan2019],
    photoCaptions: { ...photoCaptions,
      './assets/drawings/wastewater/structure-plan-2022.png': '2022.3.9 폐수처리장 평면 구조물 배치도 · 처리용량 200m³/day',
      './assets/drawings/wastewater/structure-section-2022.png': '2022.3.9 폐수처리장 측면 구조물 배치도 · 지하 수조·상부 설비',
      './assets/drawings/wastewater/process-flow-2022.png': '2022.3.9 개선 후 계통도 · 폭기3·4조 및 탈수계통 증설',
    },
    summary: '경비실 옆 기존 10동 자리에 재현한 폐수처리장입니다. 선택하면 지붕과 수조 덮개가 열려 지하 폭기조와 침전·약품·탈수설비를 함께 볼 수 있습니다.',
    confidence: '사용자 지정 기존 10동 위치 · 2022 계통·평면·측면도 기반 · 부지 내 배치·상부 외관은 근사',
    details: [
      '2022.3.9 도면의 처리용량은 200m³/day입니다. 집수·유량조정·스크린 → 폭기1·2 → 폭기3·4 → 반응·중화·응집 → 침전 → 방류의 흐름과 슬러지 개량·필터프레스 계통을 재현했습니다.',
      '기존 폭기조 1·2는 각187.5m³·깊이5m, 증설 폭기조 3·4는 각7×7×5m·245m³입니다. 침전조63m³와 하부 유량조정조102m³의 상하 구조를 측면도에 맞췄습니다.',
      '사용자가 지정한 기존 10동 위치를 우선했습니다. 2019 배치도의 기존 오폐수처리시설 인출선은 인접 기존5동에 연결되며, 두 동의 표기를 구분합니다. 경비실에서 약36m 안쪽의 10동 앵커를 기준으로 전체 설비를 부지 안쪽으로 펼쳤습니다.',
      '기존 구역과 증설조 사이의 간격·방향, 사무실과 탈수동의 외장·색상·세부 배관은 도면을 읽기 위한 모델 근사입니다. 증설 평면은 3·4조, 측면은 1·2조로 표기가 달라 계통도와 평면의 번호를 따릅니다.',
    ],
  }),
  // 11/11 rear re-placement. Every pose that existed in the last saved catalog
  // migrates once; a user-moved pose keeps its own position.
  // 11/11 boiler clip001 2:56-3:00: both vessels stand against the office's
  // west wall; the fence ends where the 공무작업장 canopy block begins, so the
  // bank no longer sticks 4.5 m out into the back road.
  building('campus-lpg-bank', 'LPG 저장소', 'campus-lpg-bank', 'LPG 저장소', [33.5, 0, -83.5], 9, 5.6, 4.9, [], {
    rotation: -Math.PI / 2,
    previousPlacements: [{ position: [25, 0, -74.5], rotation: 0, catalogRevision: 'liquid-card-detail-spacing-20261110' },
      ...['campus-rear-video-placement-20261111', 'campus-rear-identities-20261111', 'campus-valve-interior-20261111', 'preparation-room-current-layout-20261111'].map((catalogRevision) => ({ position: [33.5, 0, -77], rotation: -Math.PI / 2, catalogRevision }))],
    photo: rearPhoto(1, 264), photos: [rearPhoto(1, 264), rearPhoto(1, 376), rearPhoto(1, 252)],
    parts: ['회색 저장용기 2기·기초', '계기함·벤트봉·기화기 외함', '녹색 펜스·황흑 보호대·배관'],
    vessels: [{ id: 'lpg-left', x: -2.1, z: -.3, radius: .92, height: 3.6 }, { id: 'lpg-right', x: 2.1, z: -.3, radius: .92, height: 3.6 }],
    summary: '건조실 뒷길 끝 마당에 있는 LPG저장소입니다. 회색 세로 용기 2기가 뒤쪽 콘크리트 건물에 붙어 마당 쪽을 향하고, 녹색 펜스·보호대·기화기 외함을 갖췄습니다.',
    confidence: '표찰·용기 2기 직접 관찰 · 앞면 방향은 264초 장면(뒤에 콘크리트 건물, 오른쪽 뒤 건조실 벽) 기준 · 위치·크기 근사',
    details: ['001 영상 4:23~4:24에서 LPG 용기 뒤로 콘크리트 건물이, 오른쪽 뒤로 건조실 외벽이 보입니다. 그래서 용기 앞면을 뒷길 끝 마당(압축실 쪽)으로 돌리고 등을 콘크리트 건물에 붙였습니다.', '스테인리스 공정 저장탱크와 다른 구역입니다. 376초 VAPORIZER 표기를 대조했고, 내부 기구·정격·용량·운전 상태는 추정하지 않았습니다.'],
  }),
  building('campus-recycling-room', '재활용실 · 압축실', 'campus-recycling-room', '재활용실', [27.3, 0, -85.6], 4.6, 3.8, 2.7, [], {
    rotation: .41,
    photo: rearPhoto(1, 256), photos: [rearPhoto(1, 256), rearPhoto(1, 252), rearPhoto(1, 295), rearPhoto(1, 264)],
    parts: ['회색 골판 외벽·기초', '외쪽 경사 지붕·문 위 등', '압축실 문·빨간 분리수거함·보호대'],
    bins: [{ x: -3.4 }, { x: -5.0 }, { x: -6.6 }],
    summary: '옹벽 바로 아래 회색 골판 창고입니다. 문패는 압축실이며 안에 재활용 유압 압축기가 있고, 옹벽을 따라 빨간 분리수거함이 놓여 있습니다.',
    confidence: '문패·내부 압축기·분리수거함 직접 관찰 · 위치는 영상 순서·항공사진 옹벽선 근사',
    details: ['001 영상 4:12~4:16에서 옹벽에 등을 대고 선 골판 창고와 압축실 문패, 4:52~5:08에서 안쪽 파란 유압 압축기 동력부를 확인했습니다.', 'LPG저장소 앞 마당 옆, 건조실 뒷길이 끝나는 옹벽 모서리에 있습니다. 문은 마당 쪽을 향합니다. 실내 기계는 밖에서 보이지 않아 외형만 만들었습니다.'],
  }),
  building('campus-process-tank-bank', '스테인리스 저장탱크 구역', 'campus-process-tank-bank', '저장탱크', [60, 0, -83.5], 22, 14, 7.2, [], {
    previousPlacements: [{ position: [60, 0, -88.5], rotation: 0, catalogRevision: 'liquid-card-detail-spacing-20261110' }],
    photo: rearPhoto(1, 164), photos: [rearPhoto(1, 164), rearPhoto(1, 415), rearPhoto(3, 16), rearPhoto(2, 64), rearPhoto(2, 47), rearPhoto(2, 144), rearPhoto(1, 404)],
    parts: ['탱크 앞 방류벽·저장용기 8기·옆 주차공간', '상부 난간·보행 연결대·사다리', '배관·펌프·도로 쪽 제어함'],
    vessels: [
      // User, 11/11: front = blue room / tank / tank, then 3 + 3 tanks.
      { id: 'T-R1', label: '야경유 1', x: 4.5, z: 4.4, radius: 1.45, height: 6, topRail: true, topVent: true, pump: true, source: 'clip-001-164s;user-eight-tank-layout-20261111' },
      { id: 'T-R2', label: '야경유 2', x: 9, z: 4.4, radius: 1.45, height: 6, topRail: true, topVent: true, pump: true, source: 'clip-001-164s;user-eight-tank-layout-20261111' },
      { id: 'T-M1', x: 0, z: 0, radius: 1.45, height: 6, topRail: true, topVent: true, source: 'user-eight-tank-layout-20261111' },
      { id: 'T-M2', x: 4.5, z: 0, radius: 1.45, height: 6, topRail: true, topVent: true, source: 'user-eight-tank-layout-20261111' },
      { id: 'T-M3', x: 9, z: 0, radius: 1.45, height: 6, topRail: true, topVent: true, source: 'user-eight-tank-layout-20261111' },
      { id: 'T-S1', x: 0, z: -4.4, radius: 1.45, height: 6, topRail: true, topVent: true, ladder: true, source: 'clip-001-412s;user-eight-tank-layout-20261111' },
      { id: 'T-S2', x: 4.5, z: -4.4, radius: 1.45, height: 6, topRail: true, topVent: true, source: 'clip-001-420s;clip-002-144s;user-eight-tank-layout-20261111' },
      { id: 'T-S3', x: 9, z: -4.4, radius: 1.45, height: 6, topRail: true, topVent: true, source: 'clip-001-432s;user-eight-tank-layout-20261111' },
    ],
    walkways: [
      { id: 'road-row-1', start: [5.95, 6.05, 4.4], end: [7.55, 6.05, 4.4], width: .8 },
      { id: 'middle-row-1', start: [1.45, 6.05, 0], end: [3.05, 6.05, 0], width: .8 },
      { id: 'middle-row-2', start: [5.95, 6.05, 0], end: [7.55, 6.05, 0], width: .8 },
      { id: 'slope-row-1', start: [1.45, 6.05, -4.4], end: [3.05, 6.05, -4.4], width: .8 },
      { id: 'slope-row-2', start: [5.95, 6.05, -4.4], end: [7.55, 6.05, -4.4], width: .8 },
      { id: 'centre-cross-front', start: [4.5, 6.05, 2.95], end: [4.5, 6.05, 1.45], width: .8 },
      { id: 'centre-cross-back', start: [4.5, 6.05, -1.45], end: [4.5, 6.05, -2.95], width: .8 },
    ],
    bund: { height: 1, thickness: .25, bounds:{minX:-3.8,maxX:11,minZ:-7,maxZ:7}, paints: { '+z': 'greenWall', '+x': 'white', '-z': 'white', '-x': 'white' }, partitions: [],source:'user-confirmed-green-wall-only-in-front-of-tanks-open-parking-beside-stair-20261111' },
    parking:{bounds:{minX:-11,maxX:-3.8,minZ:-7,maxZ:7},source:'user-confirmed-open-parking-20261111'},
    pipeRuns: [{ id: 'centre-floor-main', points: [[-1.5, .45, 2.1], [10.4, .45, 2.1]], radius: .1 }, { id: 'road-side-main', points: [[-1.5, .32, 6.3], [10.4, .32, 6.3]], radius: .08 }],
    roadsideCabinets: { side: '+z', xs: [3.7, 4.6, 5.5], signalX: 6.3 },
    // 11/11 boiler clip001 1:02-1:39: coupling box and labelled fill pipes on
    // the bund, tool lockers, striped pole, castor sinks, and the open parking
    // with two cars nose-in to the retaining wall, guard posts and a ladder.
    yardDetails: {
      source: 'boiler-clip-001-062s-099s;fill-pipe-labels-078.5s',
      hoseStation: { z: 7.0, wallTop: 1,
        boxes: [{ x: 8.2, width: 2.6, couplings: 6 }, { x: 10.25, width: 1.0, couplings: 3, hoses: true, label: '야경유 1' }],
        pipes: [['야경유 2', true], ['저감미당 1'], ['팜유 1'], ['저감미당 2'], ['팜유 2'], ['저감미당 3']].map(([label, red], i) => ({ x: 7.15 + i * .42, label, red: !!red })) },
      toolLockers: { x: -1.7, z: 7.4, count: 2, label: '세척도구 / 공구' },
      stripedPole: { x: -3.45, z: 7.5, height: 3.2 },
      sinks: [{ x: -4.7, z: 6.55 }, { x: -5.6, z: 6.6, yaw: .15 }],
      parkedCars: [{ x: -9.1, z: -1.7, kind: 'sedan', paint: 'white' }, { x: -6.3, z: -1.5, kind: 'suv', paint: 'dark' }],
      guardPosts: [{ x: -10.6, z: 1.2 }, { x: -10.6, z: 3.7 }],
      ladder: { x: -10.85, z: 2.45, height: 3.1, lean: .75 },
    },
    exteriorDetails: [
      { id: 'tank-pipe-gantry', kind: 'pipe-rack', position: [2.8, 0, 4.4], datum: 'base', width: .6, height: 6.6, depth: 4.6, pipeCount: 5, pipeAxis: 'z', source: 'clip-002-072s;clip-002-081s;clip-002-087s;clip-003-018s' },
    ],
    countBasis: 'user-confirmed-eight-tanks-20261111;front:blue-room,tank,tank;middle:3;back:3',
    summary: '탱크 앞쪽만 초록 방류벽이며, 계단 옆은 벽 없이 열린 주차장입니다(11/11 영상에 승용차 2대가 옹벽 쪽으로 세워져 있음). 방류벽 위 호스 연결함과 야경유·저감미당·팜유 표찰의 세로 주입관, 세척도구·공구 함, 줄무늬 기둥, 바퀴 달린 세척조를 영상대로 놓았습니다. 계단 안쪽 첫 줄은 파란 밸브실·탱크 2기, 뒤는 3기씩 두 줄로 총 8기입니다.',
    confidence: '사용자 확인: 총 8기·앞줄 파란 건물과 2기·뒤 두 줄 각 3기 · 치수·간격은 근사',
    details: ['사용자 설명을 따라 계단 쪽에서 보아 첫 줄은 파란 밸브실–탱크–탱크, 뒤 두 줄은 탱크 3기씩으로 바로잡았습니다. 총 8기이며 높이·간격은 영상 비례 근사입니다.', '001 영상 2:44에서 야경유 1·2 표찰을 확인했습니다. 저감미당 3·팜유의 표찰도 영상에 있으나 개별 탱크 대응을 확정하지 않았습니다.', '사용자 정정: 초록 벽은 탱크 앞 구간에만 있습니다. 계단 옆 공간에 잘못 이어졌던 앞벽·서측벽·뒤벽을 제거해 주차장으로 열고, 계단이 넘는 탱크 쪽 측면 경계는 유지했습니다. 주차 대수·구획선은 확인되지 않아 임의로 넣지 않았습니다.'],
  }),
  // User: the workshop is in this LPG-side building across the back road,
  // not in the dryer annex. Keep one building for both department names.
  building('campus-maintenance-office', '공무작업장·공무환경팀실 / 옥상 전력실', 'campus-rear-service-building', '공무사무실·한전 전력계', [42.5, 0, -82.75], 10, 11.5, 6.5, [], {
    exteriorView: { azimuth: -.42, elevation: .43, focusObject: 'campus-exterior-office-roof-electrical-gantry' },
    restorePlacementRevision: 'campus-office-lpg-restoration-20261111',
    previousPlacements: [
      { position: [72.3, 0, -88.5], rotation: 0, catalogRevision: 'liquid-card-detail-spacing-20261110' },
      { position: [72.25, 0, -88.5], rotation: 0, catalogRevision: 'liquid-card-detail-spacing-20261110' },
      { position: [76.8, 0, -79.2], rotation: 0, catalogRevision: 'campus-rear-video-placement-20261111' },
      { position: [76.75, 0, -79.25], rotation: 0, catalogRevision: 'campus-rear-video-placement-20261111' },
      // Earlier restores/imports could carry either historical pose into a
      // reviewed release after the grid rounded its original coordinates.
      { position: [72.3, 0, -88.5], rotation: 0, catalogRevision: 'campus-rear-identities-20261111' },
      { position: [72.25, 0, -88.5], rotation: 0, catalogRevision: 'campus-rear-identities-20261111' },
      { position: [76.8, 0, -79.2], rotation: 0, catalogRevision: 'campus-rear-identities-20261111' },
      { position: [76.75, 0, -79.25], rotation: 0, catalogRevision: 'campus-rear-identities-20261111' },
      { position: [72.3, 0, -88.5], rotation: 0, catalogRevision: 'campus-valve-interior-20261111' },
      { position: [72.25, 0, -88.5], rotation: 0, catalogRevision: 'campus-valve-interior-20261111' },
      { position: [76.8, 0, -79.2], rotation: 0, catalogRevision: 'campus-valve-interior-20261111' },
      { position: [76.75, 0, -79.25], rotation: 0, catalogRevision: 'campus-valve-interior-20261111' },
    ],
    wallPaint: 'cream', roofPaint: 'greenRoof', basePaint: 'concrete', panelRibs: false,
    parapetHeight: .9,
    photo: OFFICE_ROOF_PHOTOS[1].path, photos: [OFFICE_ROOF_PHOTOS[1].path, OFFICE_ROOF_PHOTOS[0].path, boilerPhoto(1,122), boilerPhoto(1,120), boilerPhoto(1,178), boilerPhoto(1,176), rearPhoto(1,264), rearPhoto(1,404)],
    exteriorDetails: [
      // clip001 1:58-2:02 and 2:58-3:00: grey paired steel door under a deep
      // concrete cantilever canopy; the left leaf carries the 공무작업장 plate.
      // 2:58 shows this door just round the corner from the LPG fence, at the
      // west end of the road face, so it moved from the east end (x=+3).
      { id: 'maintenance-workshop-door', name: '공무작업장', plateText: '공무작업장', kind: 'workshop-door', position: [-3.1,0,5.8], datum: 'base', yaw: 0, width: 2.5, height: 2.9, canopy: { width: 3.4, depth: 1.9, height: .5, paint: 'cream' }, source: 'user-confirmed-opposite-LPG-building;boiler-clip-001-116s;boiler-clip-001-119s;boiler-clip-001-178s;boiler-clip-001-179.5s' },
      { id: 'office-road-pipe-bridge', kind: 'pipe-bridge', position: [-1.7,0,5.2], datum: 'base', yaw: 0, width: 1.1, height: 8.45, roofHeight: 6.5, span: 12.5, pipeCount: 3, source: 'boiler-clip-001-178s;boiler-clip-001-179.5s' },
      { id: 'office-roof-electrical-gantry', kind: 'electrical-gantry', name: '옥상 전력실 · 한전 전력계 쪽', position: [.65,6.64,2.4], datum: 'base', width: 4.25, height: 4.1, depth: 1.65, rooftopSurvey: true, source: '20261125_085715.jpg, 20261125_085718.jpg, 20261125_085723.jpg, 20261125_085726.jpg' },
      { id: 'office-side-window', kind: 'horizontal-windows', position: [5.05,2.1,2], yaw: Math.PI / 2, width: 2.2, height: 1, panes: 2, source: 'rear-clip-001-404s' },
    ],
    parts: ['콘크리트 외벽·기초', '옥상 전력실·녹색 바닥·파라펫', 'LPG 옆 출입구·배관 다리'],
    summary: '건조실에서 도로 건너 공무사무실 옥상을 바라본 배치입니다. 앞쪽 한전 전력계 구역의 높은 철골 가대와 회색 함체 뒤로 낮은 격자 가대와 밝은색 기기가 이어집니다. 아래층 작업장 출입문은 LPG 쪽 모서리에 있습니다.',
    source: '공무사무실 위 전력실 / 20261125_085715·085718·085723·085726.jpg · 11/11 공무작업장 외관 영상',
    confidence: '11/25 옥상 사진 4장과 직원이 확인한 한전 전력계 위치 · 높이와 간격은 사진 비례 추정',
    details: ['사용자가 공무작업장은 맞은편 LPG 가스 옆 건물이라고 정정했습니다. 기준 위치 [42.5,0,-82.75]를 유지하고, 공무작업장 문을 도로를 향하는 이 건물의 앞면으로 옮겼습니다. 건조실에 잘못 붙였던 문은 제거했습니다.', '새 영상 1의 1:56~2:02에서 회색 양개 철문의 공무작업장 표찰·무재해 표지와 열린 문 안 녹색 바닥·공구 선반을, 2:56~3:00에서 LPG 뒤 콘크리트 건물과 상부 철골 가대·애자, 옥상에서 도로를 건너는 배관 다리를 확인했습니다. 11/11 재검토로 문을 LPG 쪽 서쪽 끝으로 옮기고 LPG를 도로 쪽으로 튀어나오지 않게 서쪽 벽 앞에 붙였습니다. 공무환경팀실과 같은 건물로 표시하고 별도 작업장을 중복 생성하지 않았습니다.', '전기실은 옆 수변전실 표찰·녹색 철문·콘크리트 구조로 구분했습니다. 건물 높이와 가대 간격은 영상 비례 근사이며, 촬영되지 않은 실내 배치나 사무용 가구는 만들지 않았습니다.'],
  }),
  // User, 11/11: the small prefabs attached to the tanks are neither the
  // office nor a break room; the interior filmed in clip002 2:00-2:09 holds
  // the tank pipework with pneumatic valves, air lines, a panel and a heater.
  building('campus-tank-valve-room', '파란 탱크 밸브실', 'campus-tank-valve-room', '밸브실', [60, 0, -79], 4.4, 2.3, 2.9, [], {
    previousPlacements: [
      { position: [56.6, 0, -79.7], rotation: 0, catalogRevision: 'campus-rear-identities-20261111' },
      { position: [56.5, 0, -79.75], rotation: 0, catalogRevision: 'campus-rear-identities-20261111' },
    ],
    inspectableInterior: true, interiorUnitId: 'road-side',
    units: [
      { id: 'road-side', z: 0, depth: 2.3, door: { face: '-x', offset: .35 }, windows: [{ face: '+z', offset: -1.1 }, { face: '+z', offset: .9 }] },
    ],
    stair: { x: 0, position: [-3.8,0,.7], rotation: -Math.PI / 2, fromZ: 1.65, toZ: .35, rise: 1.15, width: .9, landingLength: .7, returnToZ: -1.3 },
    photo: boilerPhoto(1,64), photos: [boilerPhoto(1,64), boilerPhoto(1,76), rearPhoto(2,69), rearPhoto(2,120), rearPhoto(3,20)],
    parts: ['조립식 벽체·바닥·내부 배관과 공압 밸브', '파란 처마 지붕', '출입문·창·철제 계단'],
    summary: '옆쪽 벽에 걸친 계단을 넘어 들어간 첫 줄 왼쪽 파란 건물입니다. 오른쪽 탱크 2기, 뒤 두 줄 각 3기로 총 8기입니다. 선택하면 내부 배관·공압 밸브·파란 공기관·히터를 봅니다.',
    confidence: '사용자 확인: 계단 안쪽·앞줄 파란 건물과 탱크 2기 · 내부는 현장영상 참고 · 치수는 근사',
    details: ['계단 안쪽 첫 줄 왼쪽에 배치했습니다. 이전 두 동 해석을 정정하고, 사용자 설명과 영상에서 확인한 파란 건물 한 동을 표현합니다.', '002 영상 2:00~2:09의 은색 보온 배관 3갈래·공압 구동 밸브·파란 공기관·벽 제어함·핀형 라디에이터 히터를 재현했습니다. 내부 부품의 치수와 간격은 영상 비례 근사입니다.', '선택 시 내부가 열립니다. 내부 보기 버튼을 끄면 파란 지붕과 외벽을 복원합니다. 밸브실은 내부 설비로 붙인 이름이며 문패는 읽지 못했습니다.'],
  }),
  // 11/11 layout review: the room runs from the back corner to the raw-material
  // door along the side road (personnel door → grey shutter → window → gas
  // riser) and reaches 14 m into the annex, as the interior walk shows.
  building('campus-boiler-room', '보일러실 · 1팀 2파트', 'campus-boiler-room', '보일러실', [60,0,-59], 13.5, 14, 6.2, [], {
    rotation: Math.PI / 2, inspectableInterior: true,
    previousPlacements: ['campus-valve-interior-20261111', 'preparation-room-current-layout-20261111'].map((catalogRevision) => ({ position: [61.5, 0, -59], rotation: Math.PI / 2, catalogRevision })),
    interiorView: { azimuth: Math.PI / 2 + .55, elevation: .68 },
    attachedTo: 'campus-dryer-tower',
    contextOccluders: ['campus-third-floor-service-annex-body','campus-third-floor-service-annex-roof','campus-third-floor-service-annex-three-window-rows'],
    photo: boilerPhoto(2,22), photos: [boilerPhoto(2,22),boilerPhoto(2,37),boilerPhoto(2,162),boilerPhoto(2,74),boilerPhoto(2,106),boilerPhoto(2,118),boilerPhoto(2,218),boilerPhoto(2,238),boilerPhoto(1,48),boilerPhoto(1,50),boilerPhoto(2,9),boilerPhoto(2,43),boilerPhoto(2,45),boilerPhoto(2,47),boilerPhoto(2,108),boilerPhoto(2,140),boilerPhoto(2,160),boilerPhoto(2,185),boilerPhoto(2,202),boilerPhoto(2,225)],
    parts: ['보일러실 벽체·바닥·채광 지붕', '노통연관·관류형 보일러 각 1대·제어반', '버너·배관·펌프·급수 부속·출입구'],
    summary: '건조실 저층동 옆면 끝의 보일러실입니다. 측면 도로 벽에 출입문·회색 장비 반입 셔터·창·가스 인입관이 차례로 있고, 셔터 안쪽 통로에 동양 보일러(연관식 DBHI-SS 300형, 3ton/h) 버너와 제어반이 마주합니다. 관류형 1.5ton/h, 노란 송풍기, 증기 헤더, 연수기·소금, 내부 계단을 영상 배치대로 놓았습니다.',
    confidence: '11/11 내부 연속 영상·명판·문 순서 대조 · 실 크기 13.5×14m와 설비 간격은 영상 비례 근사',
    details: ['외부 영상 0:40~0:52 순서대로 모서리 쪽부터 보일러실 출입문(타일 테두리 천공 철문) → 회색 셔터 → 창 → 노란 가스 인입관 → 주황 원료출입구입니다. 셔터는 보일러실 안으로 열리는 장비 반입문입니다(내부 영상 0:20~0:22).', '내부 0:22에서 출입문 앞에 서면 왼쪽에 셔터 안쪽, 오른쪽에 보라색 버너·제어반이 있는 보일러 앞면이 통로를 마주합니다. 그래서 대형 보일러는 측면 벽과 직각으로 놓고 버너를 통로 쪽으로 돌렸습니다.', '명판(2:42)은 동양 보일러 연관식 DBHI-SS 300형, 최대증발량 3,000kg/h, 2006년 제작입니다. 문패대로 노통연관 1대·관류형 1대만 보일러로 셉니다.', '뒤쪽에 회색 연도함과 은색 대형 연도, 노란 보호망 송풍기(태성플랜트), 스테인리스 틀 증기 헤더, 수평 탱크 2기, 세로 탱크와 녹색 인라인 펌프 2대, 연수기 2기·소금통·소금 포대, 안쪽 벽 콘크리트 계단과 계단 밑 다단 펌프, 끝벽 가스 미터·청색 펌프 3대, 피라미드형 유리 채광 지붕을 배치했습니다.', '실 외곽·설비 간격은 영상 비례 근사입니다. 보일러 내부 압력부·가려진 연결·현재 가동 상태와 계단 위층 용도는 표현하지 않았습니다.'],
  }),
  building('campus-electrical-room', '전기실 · 수변전실', 'campus-electrical-room', '전기실', [48.25,0,-81.5], 1.4, 5.6, 3.2, [], {
    exteriorView: { azimuth: .15, elevation: .32 },
    photo: boilerPhoto(1,128), photos: [boilerPhoto(1,128),boilerPhoto(1,178),boilerPhoto(1,64)],
    parts: ['콘크리트 출입 구조·계단 아래 공간', '녹색 철문·기둥·전기 위험 표지', '수변전실 표찰·상부 가대'],
    summary: '공무환경팀실과 탱크 구역 사이에 촬영된 수변전실입니다. 녹색 철문과 콘크리트 출입 구조, 수변전실·접근금지 표지를 표현했습니다.',
    confidence: '11/11 영상 2:08 문패·철문 확인 · 위치·출입부 비례는 영상·동선 근사',
    details: ['영상 1의 2:08 철문 표찰에서 수변전실, 수전설비용량 2,100kW / 22,900V, 비상발전설비 160kW를 판독했습니다. 기록된 표찰 내용을 현재 운전 수치로 사용하지 않습니다.', '옆 콘크리트 구조와 녹색 철문을 재현했습니다. 방 전체 외곽은 촬영되지 않아 보이는 출입부 중심으로 좁게 표현했고, 확인되지 않은 변압기·배전반 내부는 추가하지 않았습니다.'],
  }),
  building('campus-team2-rear-access', '2팀 뒷출입문·실외기 통로', 'campus-rear-stair-details', '2팀 뒷출입문', [2.225,0,-64.2], 31.35, 6.8, 18.35, [], {
    labelHeight: 20,
    exteriorContextCutaway:true,
    attachedTo:'campus-packaging-building', exteriorView:{azimuth:-Math.PI/2-.45,elevation:.4},
    rearSurvey:REAR_PACKAGING_SURVEY,
    photo:rearStairPhoto(82), photos:REAR_STAIR_PHOTOS.slice(14),
    parts:['뒤편 외벽·출입구 기준','실외기 상부 점검 작업대','유리 현관·실외기·보호 사다리'],
    summary:'실외기 열 끝에서 90도로 꺾인 짧은 옆벽의 오목한 현관이 2팀 뒷출입문입니다. 긴 후면벽에 평행하게 붙였던 기존 문을 고쳤습니다. 별도 실외기 철골대는 상부4기·지상7기·벽걸이2기로 구분합니다.',
    confidence:'11/12 연속 회전·273.5/281.5초 문 정면과 실외기 통로 교차 확인 · 간격·크기는 비례 근사',
    details:['고층 건조실 뒤 세로창에서 옆 동 모서리를 돌아 옹벽 통로로 이어지는 이동을 기준으로 등록했습니다. 기존 액상동 실외기실의 22개 설비와 별도 설비열입니다.','노란 보호링 사다리, 노란 난간, 개방된 철골대 하부·기둥과 상부 캐비닛, 지상 이중팬 실외기, 작은 벽걸이 실외기를 구분합니다. 반복 촬영을 중복 수량으로 더하지 않았습니다.','마지막 녹색 유리 양개문·긴 손잡이·완만한 콘크리트 경사턱을 재현했습니다. 영상은 문턱까지만 보여 실내 계단의 단수와 형태는 추가하지 않았습니다.'],
  }),
]);
