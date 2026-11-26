import { HALL_WALK_FRAMES } from './dryer-compressor-media.js';

// Stable catalog IDs preserve saved layouts. Registered 3F shapes follow the
// current walk; remaining approximate process poses retain historical context.
const placements = {
  'f1-ica-1': [-3.5, -2.5], 'f1-ica-2': [0, -2.5], 'f1-ica-3': [5, -2.5],
  'f1-xray-1': [-3.5, 1], 'f1-xray-2': [0, 1], 'f1-xray-3': [5, 1],
  'f1-mix-a': [21.2, -1.3], 'f1-mix-b': [25.3, -1.3],
  'f1-melting': [21.2, 3.3], 'f1-oil-water': [25.5, 3.3], 'f1-s1': [23.5, 10],
  'f1-conveyor-a': [-2, 14.5], 'f1-conveyor-b': [6.75, 12.25], 'f1-palletizer': [10.75, 13.75],
  'f3-sterilizer': [-7, 5], 'f3-homogenizer': [.25, 5.5], 'f3-balance-tank': [-7, 1.25],
  'f3-feed-tank': [-2.75, 6.5], 'f3-holding': [1, -3],
  'f4-fluid-bed': [-4.4, -1.7], 'f4-fine-return': [4.6, -2.8], 'f4-transfer-bin': [4.3, 5.2],
  'f5-extraction': [5.9, -1],
};
// Only the interrupted full-envelope release produced these automatic clamp
// poses. They were captured without user moves/turns; never infer nearby poses.
const intermediateRevision = 'dryer-full-envelope-20261110';
const observedIntermediateClamps = Object.freeze({
  'f1-ica-1': [-7.5, -2.75], 'f1-xray-1': [-7.25, 1.5],
  'f1-mix-a': [-7, -8], 'f1-conveyor-a': [-2.75, 6],
  'f3-sterilizer': [-6, -4.75], 'f3-balance-tank': [-6.75,4], 'f3-feed-tank': [-2.25,4.5],
  'f4-fluid-bed': [-4.75, -1.75],
});
const wallPrevious = Object.freeze({ 'f3-sterilizer': [-7, 3.5], 'f3-homogenizer': [-3, 2], 'f3-balance-tank': [-7, 0], 'f3-feed-tank': [-3.25, 6.25], 'f3-holding': [.75, -7] });
export const THIRD_WALL_REVISION = 'dryer-third-walls-20261125';
export const FOURTH_CARDS_REVISION = 'dryer-fourth-cards-20261125';
const quarter = value => Math.round(value / .25) * .25;
const routeSource = 'dryer-entrance-mezzanine-video-20261112';
const supplementalClip2Times=Object.freeze({'f1-conveyor-a':[36,42,138,141,144],'f1-conveyor-b':[48],'f1-palletizer':[10,14,156]});
const routeShape = (kind, sourceTimes, observedCounts = {}) => Object.freeze({
  kind, source: routeSource, sourceTimes, observedCounts, nominalDimensionsMeasured: false,
  positionBasis: kind.startsWith('overlook-') ? 'mezzanine-overlook-relative-topology-in-1f-envelope' : 'continuous-video-relative-topology-in-reduced-3f-envelope',
  currentOemOrHistoricalIdentityConfirmed: false,
});
const firstFloorObserved = Object.freeze(Object.fromEntries([
  ...[1, 2, 3].map((number, index) => [`f1-ica-${number}`, {
    name: `1층 관찰 포장기 ${String.fromCharCode(65 + index)}`, tag: `관찰 포장기 ${String.fromCharCode(65 + index)}`,
    summary: '1.5층 OP실과 복도 창에서 내려다본 파란 바닥 구역의 지붕형 스테인리스 포장 외함, 투명 방호문, 전면 조작부와 상부 투입부를 재현하고, 현장등록카드 05~07번(이카 1~3호기)의 반투명 커버·HALAL 제어반·필름 벽판·파란 인쇄기를 더했습니다. A~C와 이카 1~3호기의 대응은 현장 확인 전입니다.',
    parts: ['직사각 지붕·투명 방호 외함', '상부 투입부·수직 배관', '실링·배출·조작부', index === 0 ? '공통 점검대·수평 난간·계단' : '개별 받침·보이는 부속'],
    dryerRoute: routeShape('overlook-packing-cubicle', [338,342,344,346,348,350,352,354,390,396,402], { minimumVisibleRoofedCubicles:3,serialNumberConfirmed:false,sharedPlatformOwner:'f1-ica-1',feedVariant:index===0?'rectangular-twin-outlet-v-hopper':'compact-round-doser',cabinetVariant:['open-mechanism-and-side-cabinet','stepped-roof-side-cabinet','front-upper-screen'][index],platformTopology:'recessed machinery landings joined by rear catwalk',nativeResolutionReview:true }),
    placementRevision: 'dryer-route-1f-20261112',
  }]),
  ...[1, 2, 3].map((number, index) => [`f1-xray-${number}`, {
    name: `1층 포장 배출·검사부 ${String.fromCharCode(65 + index)}`, tag: `관찰 배출·검사 ${String.fromCharCode(65 + index)}`,
    summary:'포장기 앞 스테인리스 배출·트레이·작은 계기부를 원본 해상도 장면으로 대조했습니다. 촬영에서 확정되지 않은 검은 X-ray 커튼·터널 형상은 적용하지 않습니다. 기존 X-RAY ID만 저장 호환용으로 유지합니다.',
    parts: ['터널형 스테인리스 외함', '짧은 배출 벨트·받침', '전면 조작·계기'],
    dryerRoute: routeShape('overlook-inspection', [344, 348, 350, 354, 390], { inspectionTechnologyConfirmed: false }),
    placementRevision: 'dryer-route-1f-20261112',
  }]),
  ['f1-conveyor-a', {
    name: '1층 외포장 합류 롤러열', tag: '관찰 합류 롤러',
    summary: '234·252·282초의 녹색 바닥 외포장 구역에서 보이는 다수 롤러열과 합류·측면 프레임·다리를 반영했습니다. 파란 바닥 포장실에서 이곳까지 가려진 연결 경로는 새로 추정해 관통시키지 않습니다.',
    dryerRoute: routeShape('overlook-roller-collector', [234, 252, 264, 270, 282], { hiddenBlueToGreenConnectionConfirmed: false }),
  }],
  ['f1-conveyor-b', {
    name: '1층 외포장 곡선·되돌림 롤러', tag: '관찰 곡선 롤러',
    summary: '264·270초의 큰 곡선 롤러와 평행한 되돌림 구간,282초의 정렬·합류부를 관찰 비례로 표현했습니다. 가려진 구간은 현재 확정된 생산 이송 경로로 단정하지 않습니다.',
    dryerRoute: routeShape('overlook-roller-return', [252, 264, 270, 282], { observedCurvedReturn: true }),
    placementRevision:'dryer-overlook-native-20261112',
  }],
  ['f1-palletizer', {
    name:'1층 적재 로봇·정렬 구역',tag:'적재 로봇',
    summary:'1층 적재 로봇은 1대입니다(2026-11-26 사용자 확인). 파란 베이스·기둥에 크림색 평행 링크 팔과 포크형 포대 집게를 달고, SCE 크라프트 포대를 빨간 파레트에 쌓는 모습을 11월 26일 사진으로 대조했습니다. 3열 정렬 롤러·검은 호스·황색 방호망을 함께 재현했으며 가동 범위·정격·제조사는 확정하지 않습니다.',
    parts: ['파란 베이스·회전부', '크림색 링크 팔·보이는 호스', '포크형 포대 집게', '황색 펜스·롤러 정렬부'],
    dryerRoute:routeShape('overlook-articulated-arm',[252,270,282],{minimumSimultaneouslyVisibleArms:1,palletizingRobotCount:1,blueBaseAndArticulatedArm:true,separateCreamArm:false,minimumParallelAlignmentLanes:3,operatingEnvelopeConfirmed:false}),
    placementRevision:'dryer-overlook-native-20261112',
  }],
]));
const reviewedRouteRevisions = ['dryer-full-envelope-final-20261110', 'liquid-card-detail-spacing-20261110', 'campus-rear-video-placement-20261111', 'campus-rear-identities-20261111', 'campus-valve-interior-20261111', 'preparation-room-current-layout-20261111', 'preparation-complete-20261111', 'preparation-missing-tank-20261112', 'preparation-tank-openings-20261112'];
const previousRoutePoses = {
  'f3-homogenizer': [[-.6, -3.4], [-.5, -3.5]],
  'f1-ica-1': [[-5.8, 5.6], [-5.75, 5.5], [-9, -2.8], [-9, -2.75]],
  'f1-ica-2': [[-.8, 5.6], [-.75, 5.5], [-4, -2.8], [-4, -2.75]],
  'f1-ica-3': [[4.2, 5.6], [4.25, 5.5], [1, -2.8], [1, -2.75]],
  'f1-xray-1': [[-5.8, 10], [-5.75, 10], [-9, 1.6], [-9, 1.5]],
  'f1-xray-2': [[-.8, 10], [-.75, 10], [-4, 1.6], [-4, 1.5]],
  'f1-xray-3': [[4.2, 10], [4.25, 10], [1, 1.6], [1, 1.5]],
  'f1-conveyor-b':[[8.5,14]],
  'f1-palletizer':[[13,15.1],[13,15]],
};
// The real Edge save retained these exact earlier defaults after the 11/12
// route stamps had been written. ICA/inspection 1 are historical X=-9 poses
// clipped by their newer body footprints; the others are the old catalog's
// quarter-grid/clipped results. Do not treat nearby positions as defaults.
const hallPlacementRevision = 'dryer-hall-saved-defaults-20261113';
const processHallRevision = 'dryer-process-hall-20261125';
// The wicket view at 03:35 looks toward the panels and access stair.
// At 04:20 the cylindrical tank, plate frames and square vessel share a window bay.
// Their compass orientation and spacing are registered to the model, not measured.
const processHallPoses = {
  'f3-sterilizer': {previous:[-6,-4.75], angle:Math.PI/2, stamp:hallPlacementRevision},
  'f3-homogenizer': {previous:[-6,-.25], angle:Math.PI, stamp:'dryer-route-3f-20261112'},
  'f3-balance-tank': {previous:[-6.75,4], angle:Math.PI, stamp:null},
  'f3-feed-tank': {previous:[-2.25,4.5], angle:Math.PI, stamp:null},
};
// The user confirmed a constant-width overlook instead of the old narrow
// western pinch. Shift only the first machine/inspection pair far enough east
// to keep its raised service deck inside the production void. Repair only the
// exact previous defaults, once; edited poses and explicit imports stay owned
// by the user.
const corridorPlacementRevision = 'dryer-mezzanine-width-defaults-20261113';
const previousCorridorDefaults = Object.freeze({ 'f1-ica-1': [-5.5,-2.5], 'f1-xray-1': [-5.5,1] });
const savedHallDefaultPoses = Object.freeze({
  'f1-ica-1': [-7.25, -2.75], 'f1-xray-1': [-7.75, 1.5],
  'f1-conveyor-a': [-2.75, 6], 'f1-conveyor-b': [5.5, 5.5], 'f1-palletizer': [10, 6.75],
  'f3-sterilizer': [-6.5, -4.75], 'f3-holding': [6, 1],
});
const thirdFloorObserved = Object.freeze({
  'f3-sterilizer': {
    name: '3층 스테인리스 판형·펌프 설비', tag: '3F 판형·펌프',
    summary: '현장등록카드 18번(카드 2층 = 사이트 3층)의 SD 살균기 1·2호기(HC) 판형 열교환기입니다. 관통봉, 앞쪽 지지판과 명판, 은색 보온배관, 파란 레버 밸브, 녹색 수직 펌프를 사진과 11월 12·25일 영상에 맞췄습니다.',
    parts: ['판형 스테인리스 외함·지지틀', '녹색 수직 펌프·배관', '계기·보이는 연결'],
    dryerRoute: routeShape('third-service-skid', [575, 579, 586, 590, 593, 596]),
    sourceReferences: [{ cardNumbers: [18], recordedLocation: '2층' }],
  },
  'f3-homogenizer': {
    name: '3층 구동 프레임·제어함', tag: '3F 구동·제어',
    summary: '11월 25일 04:40 전후의 두 짝 스테인리스 함체와 11월 12일 영상의 구동 프레임을 대조했습니다. 함체에는 GEA 표기가 보이며 장치의 모델명과 정격은 미확인입니다.',
    parts: ['스테인리스 지지 프레임', '모터·구동부 커버', '화면·버튼 제어함', '보이는 하부 배관'],
    dryerRoute: routeShape('third-drive-frame', [588, 605, 608, 614, 714]),
    placementRevision: 'dryer-route-3f-20261112',
  },
  'f3-balance-tank': {
    name: '3층 원통형 스테인리스 탱크', tag: '3F 관찰 탱크',
    summary: '현장등록카드 17번(카드 2층 = 사이트 3층)의 열수탱크 1과 옆의 계단형 사각 열수함, 뚜껑 4개 낮은 탱크, 노란 벨트커버 펌프와 스테인리스 덮개 펌프입니다. 11월 25일 영상과 대조했으며 내부 구조는 미확인입니다.',
    parts: ['원통 외함·받침', '상부 덮개·맨홀', '하부 출구·보이는 배관'],
    dryerRoute: routeShape('third-cylinder', [589, 590, 599, 600], { visibleStandaloneTanks: 1 }),
    sourceReferences: [{ cardNumbers: [17], recordedLocation: '2층' }],
  },
  'f3-feed-tank': {
    name: '3층 CIP·탱크 점검대', tag: 'CIP · 관찰 탱크',
    summary: '현장등록카드 19·21·22번의 CIP탱크(물)·CIP탱크(알카리)·CIP탱크(산) 3기와 관통 점검대입니다. 다리 받침판, 흘러내린 자국, 명판, 하부 펌프 2대와 선풍기를 사진에 맞췄고 금속계단·체크판은 영상과 대조했습니다.',
    parts: ['CIP탱크 3기·하부 곡면', '맨홀·교반모터·상부 배관', '관통 점검대·계단·난간', '하부 구동부·보이는 연결'],
    dryerRoute: routeShape('third-cip-deck', [626, 648, 686, 692, 702, 706, 708, 714, 720], { minimumVisibleTankTops: 2, totalTankCountConfirmed: false, readableLabels: ['CIP탱크(산)'] }),
    sourceReferences: [{ cardNumbers: [19, 21, 22], recordedLocation: '2층' }],
  },
  'f3-holding': {
    name: '3층 디스크 컨베이어 A·B와 원추 호퍼', tag: '디스크 컨베이어 A·B',
    summary: '엘리베이터 문 맞은편의 수직 모터 두 대에서 금속 덮개가 있는 이송로 네 열이 서쪽 호퍼 점검대까지 이어집니다. 구동부 보호틀 위에는 적색 경광등 두 개가 있고, 이송로 반대 끝에는 원형 반환부 두 개가 있습니다.',
    parts: ['원추 호퍼 2기', '공통 점검대·황색 난간·계단', '디스크 컨베이어 A·B 구동부와 이송로', '상부 투입관·호퍼 출구'],
    rotation: Math.PI / 2,
    dryerRoute: routeShape('third-cone-bank', [502, 508, 514, 516, 520, 538, 540, 548, 554, 563], { conicalHoppers: 2, verticalMotorHousings: 2, coveredTransferTroughs: 4, confirmedByUser: '디스크 컨베이어', individualABSideConfirmed: false }),
    sourceReferences: [{clipId:'dryer-3f-compressor-20261124',times:[8,12,14,20],photoNumbers:[1,2,3,4]}, {cardNumbers:[15,16],recordedLocation:'청정실(2층)'}],
  },
});
const fourthFloorObserved = Object.freeze({
  'f4-fluid-bed': {
    name: 'V/F 유동층 건조기 · 철골 데크', tag: 'V/F · 카드 02',
    summary: '현장등록카드 02번(3층 표기 = 사이트 4층) 4면 사진을 기준으로 약 1.9m 회색 철골 격자 데크, 양측 계단·난간, 낮은 곡면 상부와 직선 측판·V자 하부 본체, 천장 관통 대형 원뿔 인입부와 보온·주름 배기관을 재현했습니다.',
    dryerRoute: routeShape('fourth-fluid-bed', [], { cardNumber: 2, recordedCardFloor: '3층', stairs: 2, ceilingConeInlet: true }),
    sourceReferences: [{ cardNumbers: [2], recordedLocation: '건조실(3층)' }],
  },
  'f4-fine-return': {
    name: '4층 진동 컨베이어·격자 데크 통로', tag: '진동 컨베이어 · 03',
    summary: '현장등록카드 03번(3층 표기 = 사이트 4층) 사진을 기준으로 격자 데크 통로, 스테인리스 이송관, 비스듬히 매달린 청색 진동모터 2대, 청색 코일 스프링, 비닐·방수테이프 마감 수직 슈트, 청색 공압 튜브와 리프트 프레임을 재현했습니다.',
    dryerRoute: routeShape('fourth-vibrating-conveyor', [], { cardNumber: 3, recordedCardFloor: '3층', blueVibrationMotors: 2, hasLiftFrame: true }),
    sourceReferences: [{ cardNumbers: [3], recordedLocation: '건조실(3층)' }],
  },
  'f4-transfer-bin': {
    name: '4층 분말 슈트·리프트 이송부', tag: '분말 이송부 · 03',
    summary: '기존 중간 배출부 ID를 유지하면서 현장등록카드 02·03번에 확인되는 비닐·방수테이프 이음 스테인리스 수직 슈트, 하부 진동 피더, 청색 공압 라인과 점검 데크 연결부로 재현했습니다.',
    dryerRoute: routeShape('fourth-transfer-chute', [], { cardNumbers: [2, 3], recordedCardFloor: '3층' }),
    sourceReferences: [{ cardNumbers: [2, 3], recordedLocation: '건조실(3층)' }],
  },
});
function repairablePreviousPlacements(item, pose) {
  const previous = [...(item.previousPlacements || []), ...(pose ? [{ position: [...item.position], rotation: item.rotation || 0 }] : [])];
  const additions = [];
  for (const placement of previous) {
    const position = [quarter(placement.position[0]), placement.position[1], quarter(placement.position[2])];
    if (position[0] !== placement.position[0] || position[2] !== placement.position[2]) additions.push({
      position, rotation: placement.rotation, catalogRevision: intermediateRevision,
      migrationBasis: 'exact-quarter-grid-of-historical-default',
    });
  }
  const clamped = observedIntermediateClamps[item.id];
  if (clamped) additions.push({ position: [clamped[0], item.position[1], clamped[1]], rotation: item.rotation || 0,
    catalogRevision: intermediateRevision, migrationBasis: 'observed-automatic-clamp-without-user-edit',
  });
  return [...previous, ...additions];
}
export function registerDryerLowerEquipment(item) {
  const pose = placements[item.id];
  const previousPlacements = repairablePreviousPlacements(item, pose);
  const observed = firstFloorObserved[item.id] || thirdFloorObserved[item.id] || fourthFloorObserved[item.id];
  if (observed) {
    const savedHallPose = savedHallDefaultPoses[item.id];
    const processPose = processHallPoses[item.id];
    const discConveyor = item.id === 'f3-holding';
    const hallFrames = HALL_WALK_FRAMES.filter(frame => frame.equipment === item.id);
    const historicalPoses = [...(previousRoutePoses[item.id] || []), ...(savedHallPose ? [savedHallPose] : [])];
    const qualifiedPoses = reviewedRouteRevisions.flatMap(catalogRevision =>
      historicalPoses.map(([x, z]) => ({ position: [x, item.position[1], z], rotation: item.rotation || 0, catalogRevision, migrationBasis: 'dryer-route-video-default' })));
    const corridorDefault=previousCorridorDefaults[item.id];
    const corridorPoses=corridorDefault?reviewedRouteRevisions.map(catalogRevision=>({position:[corridorDefault[0],item.position[1],corridorDefault[1]],rotation:item.rotation||0,catalogRevision,migrationBasis:'dryer-route-video-default'})):[];
    const earlier = [...previousPlacements, ...qualifiedPoses, ...corridorPoses];
    // A coordinate already reviewed in the previous hall update can be a
    // deliberate move back to that spot. Only its then-current default advances.
    const restoredPoses = discConveyor ? [
      ...earlier.map(p=>({...p,alreadyReviewedAt:hallPlacementRevision})),
      ...reviewedRouteRevisions.map(catalogRevision=>({position:[5.5,item.position[1],1],rotation:0,catalogRevision,migrationBasis:'dryer-route-video-default'})),
    ] : processPose ? [
      ...earlier.map(placement=>({...placement,alreadyReviewedAt:processPose.stamp})),
      ...reviewedRouteRevisions.flatMap(catalogRevision=>[...new Set([processPose.stamp,null])].map(sourcePlacementRevision=>({
        position:[processPose.previous[0],item.position[1],processPose.previous[1]],rotation:0,
        catalogRevision,sourcePlacementRevision,migrationBasis:'dryer-route-video-default',
      }))),
    ] : earlier;
    return Object.freeze({
      ...item, ...observed, position: pose ? [pose[0], item.position[1], pose[1]] : item.position,
      ...(hallFrames.length ? {
        photo:hallFrames[0].path,
        photos:[...hallFrames.map(frame => frame.path), ...(item.photos || [])],
        sourceReferences:[...(observed.sourceReferences || []), {clipId:'dryer-third-hall-20261125',times:hallFrames.map(frame => frame.seconds)}],
      } : {}),
      ...(supplementalClip2Times[item.id]?{sourceReferences:[{clipId:'first-floor-20261113-clip2',times:supplementalClip2Times[item.id]}]}:{}),
      ...(savedHallPose ? { placementRevision: hallPlacementRevision } : {}),
      ...(corridorDefault ? { placementRevision: corridorPlacementRevision } : {}),
      ...(discConveyor ? {placementRevision:'dryer-elevator-disc-conveyor-20261124'} : {}),
      ...(processPose ? {placementRevision:processHallRevision,rotation:processPose.angle} : {}),
      previousPlacements: wallPrevious[item.id] ? [...restoredPoses, {position:[wallPrevious[item.id][0],item.position[1],wallPrevious[item.id][1]],rotation:processPose?.angle ?? observed.rotation ?? 0,sourcePlacementRevision:processPose?processHallRevision:'dryer-elevator-disc-conveyor-20261124',migrationBasis:'dryer-route-video-default'}] : restoredPoses,
      // The full-height partition (E z=13.8 / W z=11.1) moved the five units.
      // Only the exact former defaults follow; poses the user changed stay.
      ...(item.floor === 3 ? { placementRevision: THIRD_WALL_REVISION } : {}),
      ...(item.floor === 4 ? { placementRevision: FOURTH_CARDS_REVISION } : {}),
      positionBasis: observed.dryerRoute.positionBasis, positionConfidence: 'approximate',
      confidence: item.floor === 4 ? '2026-11-24 현장등록카드 02·03번 4면 사진 대조 · 치수·좌표는 사진 비례 추정' : item.floor === 3 ? '11월 12일·25일 연속 영상 대조 · 치수와 배치는 촬영 비례' : '2026-11-12 연속 영상 관찰 · 치수·좌표 비실측',
      details: item.floor === 4 ? [
        '2026년 11월 24일 현장등록카드 02·03번(카드 표기 3층 = 사이트 4층) 4면 사진의 외형·받침·배관을 반영했습니다.',
        '기존 설비 ID(f4-fluid-bed, f4-fine-return, f4-transfer-bin)는 저장된 사용자 배치 보호를 위해 그대로 유지했습니다.',
        '데크 높이·관경·평면 좌표는 문·난간(1.1m) 기준 사진 비례 추정입니다.',
      ] : discConveyor ? ['11월 24일 엘리베이터 앞 영상과 현장 사진 001~004에서 두 모터·네 이송로·직렬 호퍼의 방향을 확인했습니다.',
        '등록카드 15번(B)·16번(A)은 청정실(2층) 표기이며 같은 장면을 담고 있습니다. 현장 안내에 따라 3층에 배치했고 각 구동부의 좌우 A/B 순서는 미확인입니다.',
        '승강기 문틀과 함께 찍힌 사진 003, 구동부와 점검대가 나란히 보이는 사진 001, 양끝 사진 002·004의 비례를 맞췄습니다. 모델의 보호틀 높이는 약 1.18 m, 호퍼 점검면은 약 2.42 m입니다. 현장 실측 전 추정값입니다.'] : [item.floor === 1 ? '1.5층 복도와 OP실에서 아래를 내려다본 창 장면의1층 외형·상대 배치를 우선했습니다.' : '1.5층에서 3F 표기 계단을 지나 촬영한 연속 영상의 외형·상대 배치를 우선했습니다.',
        '기존 설비 ID는 저장 배치 호환을 위해 유지합니다. 과거 공정 ID와 영상 속 장치의 정확한 기능·기종 대응은 확정하지 않았습니다.',
        '촬영된 도면은 참고 자료이며 현재 설치 수량·벽 위치의 확정 근거로 사용하지 않습니다.',
        item.floor === 1 ? '파란 바닥 생산구역과 녹색 외포장 구역의 위치·장비 비례는 미실측이며 가려진 연결 경로를 확정하지 않습니다.' : '몸통·점검면·배관의 치수와 평면 좌표는 축소된 3층 외곽 안의 모델 비례이며 실측값이 아닙니다.'],
    });
  }
  return Object.freeze({
    ...item, position: pose ? [pose[0], item.position[1], pose[1]] : item.position,
    ...(previousPlacements.length ? { previousPlacements } : {}),
    positionBasis: 'full-building-plan-and-OWP-process-zone-approximation', positionConfidence: 'approximate',
    confidence: '과거 3D 형상 참고 · 건축 평면 내 개략 등록',
    details: [...item.details, '전체 건축도면의 공장·배합·조제 구역과 공정 관계를 대조한 개략 배치입니다. 개별 장비의 현재 좌표를 실측한 결과는 아닙니다.'],
  });
}
