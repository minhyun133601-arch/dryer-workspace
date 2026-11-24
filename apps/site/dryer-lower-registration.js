// Stable catalog IDs preserve saved layouts. Registered 3F shapes follow the
// current walk; remaining approximate process poses retain historical context.
const placements = {
  'f1-ica-1': [-3.5, -2.5], 'f1-ica-2': [0, -2.5], 'f1-ica-3': [5, -2.5],
  'f1-xray-1': [-3.5, 1], 'f1-xray-2': [0, 1], 'f1-xray-3': [5, 1],
  'f1-mix-a': [21.2, -1.3], 'f1-mix-b': [25.3, -1.3],
  'f1-melting': [21.2, 3.3], 'f1-oil-water': [25.5, 3.3], 'f1-s1': [23.5, 10],
  'f1-conveyor-a': [-2, 14.5], 'f1-conveyor-b': [6.75, 12.25], 'f1-palletizer': [10.75, 13.75],
  'f3-sterilizer': [-6, -4.75], 'f3-homogenizer': [-6, -.25], 'f3-balance-tank': [-6.75, 4],
  'f3-feed-tank': [-2.25, 4.5], 'f3-holding': [.75, -7],
  'f4-fluid-bed': [-4.4, -1.7], 'f5-extraction': [5.9, -1],
};
// Only the interrupted full-envelope release produced these automatic clamp
// poses. They were captured without user moves/turns; never infer nearby poses.
const intermediateRevision = 'dryer-full-envelope-20261110';
const observedIntermediateClamps = Object.freeze({
  'f1-ica-1': [-7.5, -2.75], 'f1-xray-1': [-7.25, 1.5],
  'f1-mix-a': [-7, -8], 'f1-conveyor-a': [-2.75, 6],
  'f3-sterilizer': [-6, -4.75], 'f4-fluid-bed': [-4.75, -1.75],
});
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
    summary: '1.5층 OP실과 복도 창에서 내려다본 파란 바닥 구역의 지붕형 스테인리스 포장 외함, 투명 방호문, 전면 조작부와 상부 투입부를 재현했습니다. 기존 ICA ID는 저장 호환용이며 사진만으로 호기·제조사를 확정하지 않습니다.',
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
    name:'1층 관절형 이송암 2기·정렬 구역',tag:'관찰 이송암 2기',
    summary:'282초 같은 화면에 함께 보이는 파란 베이스 암과 별도의 크림색 암 2기를 구분했습니다. 3열 이상 정렬 롤러·붉은 흡착 헤드·검은 호스와 황색 방호망을 원본 해상도로 대조했으며 가동 범위·정격·제조사는 확정하지 않습니다.',
    parts: ['파란 베이스·회전부', '관절 암·보이는 호스', '붉은 흡착 헤드', '황색 펜스·롤러 정렬부'],
    dryerRoute:routeShape('overlook-articulated-arm',[252,270,282],{minimumSimultaneouslyVisibleArms:2,blueBaseAndArticulatedArm:true,separateCreamArm:true,minimumParallelAlignmentLanes:3,operatingEnvelopeConfirmed:false}),
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
    summary: '3층 영상 575~599초에 보이는 판형 외함·녹색 수직 펌프·낮은 금속 배관을 재현했습니다. 기존 살균기 ID는 저장 호환용이며 현재 기능·제조사 대응은 확정하지 않았습니다.',
    parts: ['판형 스테인리스 외함·지지틀', '녹색 수직 펌프·배관', '계기·보이는 연결'],
    dryerRoute: routeShape('third-service-skid', [575, 579, 586, 590, 593, 596]),
  },
  'f3-homogenizer': {
    name: '3층 구동 프레임·제어함', tag: '3F 구동·제어',
    summary: '605~614초의 스테인리스 제어함, 모니터·버튼, 프레임 안 구동부와 황색 구동부 커버를 표현합니다. 과거 균질기 ID를 보존하며 현 장치의 기종을 단정하지 않습니다.',
    parts: ['스테인리스 지지 프레임', '모터·구동부 커버', '화면·버튼 제어함', '보이는 하부 배관'],
    dryerRoute: routeShape('third-drive-frame', [588, 605, 608, 614, 714]),
    placementRevision: 'dryer-route-3f-20261112',
  },
  'f3-balance-tank': {
    name: '3층 원통형 스테인리스 탱크', tag: '3F 관찰 탱크',
    summary: '590~600초의 독립 원통 탱크를 상부 덮개·맨홀·벽측 배관과 함께 표현했습니다. 과거 밸런스 탱크 명칭과의 대응·정격·내부는 미확인입니다.',
    parts: ['원통 외함·받침', '상부 덮개·맨홀', '하부 출구·보이는 배관'],
    dryerRoute: routeShape('third-cylinder', [589, 590, 599, 600], { visibleStandaloneTanks: 1 }),
  },
  'f3-feed-tank': {
    name: '3층 CIP·탱크 점검대', tag: 'CIP · 관찰 탱크',
    summary: '648초 CIP탱크(산) 표지와 686~724초 금속계단·체크판 점검면을 대조했습니다. 상부가 확인되는 탱크 최소2개와 교반모터·열린 맨홀을 표현하며 전체 설비 수량과 나머지 탱크 명칭은 확정하지 않습니다.',
    parts: ['관찰 탱크 2개·하부 곡면', '맨홀·교반모터·상부 배관', '관통 점검대·계단·난간', '하부 구동부·보이는 연결'],
    dryerRoute: routeShape('third-cip-deck', [626, 648, 686, 692, 702, 706, 708, 714, 720], { minimumVisibleTankTops: 2, totalTankCountConfirmed: false, readableLabels: ['CIP탱크(산)'] }),
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
  const observed = firstFloorObserved[item.id] || thirdFloorObserved[item.id];
  if (observed) {
    const savedHallPose = savedHallDefaultPoses[item.id];
    const discConveyor = item.id === 'f3-holding';
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
    ] : earlier;
    return Object.freeze({
      ...item, ...observed, position: pose ? [pose[0], item.position[1], pose[1]] : item.position,
      ...(supplementalClip2Times[item.id]?{sourceReferences:[{clipId:'first-floor-20261113-clip2',times:supplementalClip2Times[item.id]}]}:{}),
      ...(savedHallPose ? { placementRevision: hallPlacementRevision } : {}),
      ...(corridorDefault ? { placementRevision: corridorPlacementRevision } : {}),
      ...(discConveyor ? {placementRevision:'dryer-elevator-disc-conveyor-20261124'} : {}),
      previousPlacements: restoredPoses,
      positionBasis: observed.dryerRoute.positionBasis, positionConfidence: 'approximate',
      confidence: discConveyor ? '2026-11-24 현장 사진·영상과 사용자 확인 · 좌표 비실측' : '2026-11-12 연속 영상 관찰 · 치수·좌표 비실측',
      details: discConveyor ? ['11월 24일 엘리베이터 앞 영상과 현장 사진 001~004에서 두 모터·네 이송로·직렬 호퍼의 방향을 확인했습니다.',
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
