// A013–A018 historical architectural plans. The shared origin follows the
// high tower; room subdivisions are traced proportions, not a current survey.
const point = (x, z) => [x - 8.6, z - 13.4];
const rectangle = (x0, x1, z0, z1) => ({ minX: x0 - 8.6, maxX: x1 - 8.6, minZ: z0 - 13.4, maxZ: z1 - 13.4 });
const full = Object.freeze(rectangle(0, 43, 0, 35));
const main = Object.freeze({ minX: -8.6, maxX: 8.6, minZ: -13.4, maxZ: 13.4 });
const northEastBay = Object.freeze(rectangle(17.2, 22, 0, 6.7));
const room = (id, name, x0, x1, z0, z1, options = {}) => ({ id, name, bounds: rectangle(x0, x1, z0, z1), positionBasis: 'plan-proportion', ...options });
const wall = (a, b, openings = []) => ({ a: point(...a), b: point(...b), openings, positionBasis: 'plan-proportion' });

// A-015 shows the room east of the stair bay, between X6 and X8. The 2026-11-24
// continuous walk and 100 photos confirm the 3F hall -> NE stair -> outdoor
// green roof -> compressor room route and 13 interior units (dimensions approximate).
const compressorRoom = room('compressor-room', '공기압축기실', 22, 30.8, 0, 10, {
  displayLabel: '에어컴프레셔실', positionBasis: 'A-015-plan-approximation; interior-and-route-20261124-video', floorConfirmedByUser: true,
  height: 4.4, lowEastHeight: 3.3, roofSlope: 'west-high-east-low', heightBasis: 'video-proportion-unmeasured',
  doorPositionMeasured: false, equipmentSurveyDate: '2026-11-24',
});
const compressorEntrance = { id: 'compressor-room-south', label: '공기압축기실 양개문',
  offset: 3.45, width: 1.9, height: 2.2, doorStyle: 'white-service-pair',
  threshold: { height: .12, depth: .26, sourceSeconds: [81, 92, 101] },
  passageSide: 1, positionBasis: compressorRoom.positionBasis };
const compressorNorthWindows = { offset: 4.4, width: 6.8, sill: 1.75, height: 1.15, doorKind: 'none', label: '에어컴프레셔실 북측 창' };
const compressorWalls = [
  { ...wall([22, 0], [30.8, 0], [compressorNorthWindows]), height: compressorRoom.lowEastHeight },
  wall([22, 0], [22, 10]),
  { ...wall([30.8, 0], [30.8, 10]), height: compressorRoom.lowEastHeight },
  { ...wall([22, 10], [30.8, 10], [compressorEntrance]), height: compressorRoom.lowEastHeight },
].map(boundary => ({ height: compressorRoom.height, ...boundary, roomId: compressorRoom.id, positionBasis: compressorRoom.positionBasis }));
// 2026-11-24 walk (00:34-00:48, 04:44-05:23) confirms the NE stairwell (X5-X6)
// joins the 3F hall via the east fire door beside ELEV and opens south to the
// outdoor green roof via a solid door with an exterior square pattern.
const northEastStairRoofDoor = { id: 'third-ne-roof-door', label: '3층 북동 계단 옥상 출입문',
  offset: .75, width: 1.05, height: 2.2, doorStyle: 'backed-roof-panel',
  threshold: { height: .08, depth: .22, sourceSeconds: [37, 285, 286] },
  positionBasis: 'A-015-and-20261124-video-proportion' };
// At the north window the camera turns right into the descending flight
// (04:50–04:58). Its opening belongs to the stair bay, clear of the west
// corridor connecting the fire door and roof door.
const northEastFlightOpening = { minX: 10.19, maxX: 13.33, minZ: -13.33, maxZ: -11.73 };
const northEastStairWalls = [
  { ...wall([17.2, 0], [22, 0], [{ offset: 1.50, width: 2.8, sill: .30, height: 3.85, doorKind: 'none', label: '북동 계단실 북측 창' }]), height: 5.9 },
  { ...wall([17.2, 6.7], [22, 6.7], [northEastStairRoofDoor]), height: 5.9 },
].map(boundary => ({ ...boundary, roomId: 'northeast-stair-3f', positionBasis: 'A-015-and-20261124-video-proportion' }));
const cores = Object.freeze({
  westStair: { id: 'west-stair', name: '서측 계단실', bounds: rectangle(0, 3.2, 0, 6.7), drawingLabel: 'UP/DN', geometryBasis: 'plan-proportion; tread count representative' },
  northEastStair: { id: 'northeast-stair', name: '북동측 계단실', bounds: northEastBay, drawingLabel: 'UP/DN', geometryBasis: 'plan-proportion; tread count representative' },
  elevator: { id: 'north-elevator', name: 'ELEV', bounds: rectangle(13.6, 17.2, 0, 3.2), geometryBasis: 'plan-proportion; no invented car or mechanism' },
});
// The video establishes a window-facing first flight, a 180-degree return,
// and a perforated door straight ahead of the upper flight. Register that
// topology in the end bay of the same corridor. The user's route correction
// places this bay beyond OP, without a second turn across the north corridor.
const upperStairBounds = Object.freeze({...cores.westStair.bounds});
const upperStairLowerDoor = [-7, -6.7], upperStairUpperDoor = [-6.315, -6.7];
const observedUpperStair = Object.freeze({...cores.northEastStair,name:'통로 끝 상·하행 계단',bounds:upperStairBounds,labelBounds:{minX:-8.3,maxX:-5.7,minZ:-6.4,maxZ:-5.5},runAxis:'z',startDirection:-1,flights:2,observed:true,omitLowerLanding:true,openUpperLanding:true,visibleFloors:[2,3],sourceTimes:[414,418,420,426,434,438,440,443],geometryBasis:'user-confirmed straight corridor beyond OP; window-return-door topology; approximate end-bay registration'});
const lowWingStairs = [
  { id: 'southwest-stair', name: '계단-2', bounds: rectangle(3.2, 9.3, 31.8, 35), runAxis: 'x', geometryBasis: 'A013/A014 plan-proportion; tread count representative' },
  { id: 'southeast-stair', name: '계단-1', bounds: rectangle(36.8, 43, 31.8, 35), runAxis: 'x', geometryBasis: 'A013/A014 plan-proportion; tread count representative' },
  { id: 'east-stair', name: '계단-5', bounds: rectangle(30.8, 33.8, 0, 9.8), geometryBasis: 'A013/A014 plan-proportion; tread count representative' },
  { id: 'interior-stair', name: '계단-6', bounds: rectangle(9.3, 20.8, 16.5, 18.5), flights: 1, runAxis: 'x', geometryBasis: 'A013/A014 plan-proportion; tread count representative' },
];
const turnDownStair = Object.freeze({...lowWingStairs[0],id:'route-turn-down-stair',name:'우회전 전 1층 하행 계단',labelBounds:{minX:-5.2,maxX:-.8,minZ:17.1,maxZ:18.3},fromElevation:.3,height:3.5,openUpperLanding:true,visibleFloors:[1,2],observed:true,appearance:'white-stringer-yellow-rail',sourceReferences:[{clipId:'first-floor-20261113-clip2',times:[162]}],connectionBasis:'user-confirmed: clip2 end stair is the down stair before the OP corridor turn',geometryBasis:'user-confirmed downward stair before the right turn; approximate registration'});
const endDownStair = Object.freeze({...observedUpperStair,id:'route-end-down-stair',name:'통로 끝 1층 하행 계단',label:false,fromElevation:.3,height:3.5,omitLowerLanding:false,visibleFloors:[1,2],geometryBasis:'user-confirmed up/down stair at the end beyond OP; approximate stacked bay'});
const endStairOpening = Object.freeze({minX:-8.5,maxX:-5.5,minZ:-13.25,maxZ:-7.25});
// Window sequence is observed; spacing is representative registration, not a
// counted/surveyed facade elevation. Both overlapping low-wing shells need cuts.
const mezzanineWindows = [
  ...[24,12,0].map(x=>({side:'south',offset:x+8.6,width:1.1,center:[x,21.6]})),
  ...[15.5,7,-1].map(z=>({side:'west',offset:z+13.4,width:1.1,center:[-8.6,z]})),
].map(window=>({...window,height:2.2,doorKind:'none',label:'1.5층 외벽창'}));
const thirdFloorWindowBands=[['west',-5.8,2.8],['west',3.4,11.5],['east',-2.4,2.8],['east',3.4,11.5]]
  .flatMap(([side,from,to])=>[1.0,2.05].map(sill=>({side,offset:(from+to)/2+13.4,width:to-from,sill,height:.9,doorKind:'none',label:'3층 2단 황색창',sourceTimes:[502,590,593,617],spacingMeasured:false})));

export const DRYER_BUILDING_REFERENCE = Object.freeze({
  building: '유산 4동 건축도면', drawingNumbers: ['A013', 'A014', 'A015', 'A016', 'A017', 'A020'],
  originalDrawing: '../프로젝트_도면자료/건물3D 후보도면/원본 DWG/02_동별건축/유산/A-013~018-평면도__58094e310e46.dwg',
  fullSheetPreview: '../프로젝트_도면자료/미리보기캐시/58094e310e46a1191f9ad3161f1aec7985dad8c3b50bb5c3ccc04aa0fcb7a95a/page-001.png',
  sectionPreview: './assets/drawings/dryer/dryer-tower-section.png',
  registration: { sourceNorthWest: [0, 0], modelNorthWest: [-8.6, -13.4], xDirection: '도면 오른쪽', zDirection: '도면 아래쪽', geographicNorthConfirmed: false },
  dimensions: { lowBuildingWidth: 43, lowBuildingDepth: 35, mainTowerWidth: 17.2, mainTowerDepth: 26.8, northBayWidth: 22 },
  limitations: [
    '치수선의 43×35m와 17.2×26.8m를 상부 모델 기준축에 등록했다. 벽 두께 및 개별 방·문 위치는 도면 비례 개략이다.',
    '현장 명칭은 1층·1.5층·3층이다. 구도면의 2F는 1.5층 참고 자료로 보존하고, 현재 실명과 문·창은 2026-11-12 연속 영상 및 사용자 확인을 우선한다.',
    '1층 전체 외곽, 1.5층 부분 바닥/상하로 열린 생산 공간, 3층 축소된 실내 타워와 저층 지붕을 구분한다.',
    '현재 사용자 확인: 기존 1~7층 모델은 전체 공간 중 일부만 표현했다. 이것을 7층 외곽 2배의 근거로 사용하지 않는다.',
    '역사 건축도면에 있는 방 이름·수조는 현재 설비의 설치 완료·운전·명판 대응을 확정하지 않는다.',
  ],
});

const basic = (id, elevation, height, options = {}) => ({
  id, elevation, height, bounds: id <= 3 ? full : main, width: id <= 3 ? 43 : 17.2, depth: id <= 3 ? 35 : 26.8,
  mainBounds: main, northEastBay, cores, positionConfidence: 'historical-plan-registration',
  stairs: [cores.westStair, cores.northEastStair, ...(id <= 2 ? lowWingStairs : [])],
  reference: './assets/drawings/dryer/dryer-tower-section.png',
  source: `A01${id === 1 ? 3 : id === 2 ? 4 : id === 3 ? 5 : 6} 평면 + A020 건축 표고`,
  sourceReference: DRYER_BUILDING_REFERENCE, ...options,
});

// Match the architectural builder: tread centres and each return landing.
export function dryerStairWalkPoints(core, floor) {
  const b = core.bounds, spanX = b.maxX - b.minX, spanZ = b.maxZ - b.minZ;
  const width = core.runAxis === 'x' ? spanZ : spanX, depth = core.runAxis === 'x' ? spanX : spanZ;
  const height = core.height ?? floor.height, fromY = core.fromElevation ?? floor.elevation;
  const flights = core.flights || (height > 4.5 ? 4 : 2), lane = Math.min(1.25, (width - .25) / (flights === 1 ? 1 : 2));
  const run = Math.max(1.8, Math.min(flights === 1 ? 10 : 4, depth - 1.7)), count = Math.ceil(height / flights / .18), first = core.startDirection ?? 1;
  const centreX = (b.minX + b.maxX) / 2, centreZ = (b.minZ + b.maxZ) / 2;
  const world = (x, y, z) => core.runAxis === 'x' ? [centreX + z, fromY + y, centreZ - x] : [centreX + x, fromY + y, centreZ + z];
  const offset = lane / 2 + .06, points = [world(flights === 1 ? 0 : -offset, 0, -first * (run / 2 + .45))];
  for (let flight = 0; flight < flights; flight++) {
    const direction = (flight % 2 ? -1 : 1) * first, x = flights === 1 ? 0 : flight % 2 ? offset : -offset;
    if (flight) points.push(world(x, height / flights * flight, -direction * (run / 2 + .4)));
    for (let step = 0; step < count; step++) points.push(world(x, height / flights * (flight + (step + 1) / count), direction * (-run / 2 + (step + .5) * run / count)));
    points.push(world(x, height / flights * (flight + 1), direction * (run / 2 + .4)));
  }
  return points;
}

export const DRYER_BUILDING_FLOORS = Object.freeze({
  1: Object.freeze(basic(1, .3, 3.5, {
    name:'1층 · 충전·외포장·조제실',shortName:'충전·외포장·조제실',
    summary:'1층은 충전·외포장·조제실, 원료 보관·계량 공간과 위생 전실·출입구로 구성됩니다. 위층인 1.5층 복도·OP실의 관찰창 아래로 보이는 청색 바닥 충전·포장 설비와 녹색 외포장 생산설비도 1층에 있습니다. 원본 확대 영상에 맞춰 서로 다른 투입부·들어간 상부 작업대·유리 방호 외함과 롤러·방호 셀·파랑 및 크림색 이송암 2기를 재현하고, 원료 보관·계량·조제실과 위생 전실·출입구는 11월 11·12일 연속 영상을 함께 대조했습니다. 조제실과 보일러실 사이에는 직접 연결문이 없습니다. 촬영된 도면은 참고용이며 치수·좌표는 모델 비례입니다.',
    personStart: { position: [33.7, .3, 17.6], yaw: -Math.PI / 2 },
    structureHeight: 6.6, wallHeight: 6.6,
    stairs:[{...lowWingStairs[1],startDirection:-1,openUpperLanding:true,visibleFloors:[1,2],observed:true,sourceTimes:[102,112,120,144,150]}],
    routeSurvey: { source:'dryer-entrance-mezzanine-20261112', sourceTimes:[0,18,38,54,72,84,102,112,142,150,198,216,234,252,282,344,348,354], drawingPolicy:'reference-only', observedStairIds:['southeast-stair'], observations:['외부 미닫이문과 별도의 잠금 유리문','세면대·신발장·화장실','녹색 2런 계단과 황색 창의 중간참','관찰창 아래 청색 바닥의 유리 외함 포장기 3기와 상부 작업대','녹색 외포장 구역의 롤러 이송·합류부와 청색 로봇'],
      supplementalPackagingWalk:{clipId:'first-floor-20261113-clip2',sourceReferences:[{clipId:'first-floor-20261113-clip2',times:[10,42,48,108,141,144,162]}],dimensionsMeasured:false,registration:'current-video relative topology; approximate existing-hall registration',endStairId:'route-turn-down-stair',endStairConnection:'same physical stair as the 1.5F downward branch before the OP turn; user-confirmed',elevatorId:'north-elevator',crossoverIsInterFloorStair:false},
      overlookFactory:{blueFloor:{minX:-8.4,maxX:8.4,minZ:-6.5,maxZ:3.0},sourceTimes:[234,252,282,344,348,354],dimensionsMeasured:false,registration:'observed-relative-zones; coordinates-estimated'} },
    preparationSurvey: { date: '2026-11-11', roomNamesBasis: 'continuous-walk-and-photographed-room-plan', doubleHeight: 6.6,
      campusOffset: [32.6, 0, -50.6],
      roomPlanAxes: { top: '+X', right: '+Z', bottom: '-X', left: '-Z' },
      // The daily and weighing stores share an open boundary without a door.
      // The inner fast shutter then leads from weighing into preparation.
      rawReceptionRoute: [[34.1,.6],[30.5,.6]],
      route: [[34.1,.6],[30.5,.6],[26.6,.6],[26.6,3.2],[26.6,5.8],[24,8],[24,13],[27.4,17.6],[30,17.6],[32,17.6],[33,17.6]],
      doors: [
        { id:'raw-exterior', label:'원료 출입구', position:[34.4,.6], axis:'z', width:3 },
        { id:'raw-inner-shutter', label:'조제실 내부 고속셔터', position:[26.6,4.6], axis:'x', width:3, connects:['preparation','dispensing'], connectionBasis:'user-confirmed-20261113', positionEstimated:true },
        { id:'air-shower', label:'소독실 · 에어샤워', position:[28.2,17.6], axis:'z', width:1.15 },
        { id:'toilet', label:'화장실', position:[33.3,15.2], axis:'z', width:.9 },
        { id:'team1-part2', label:'1팀 2파트 출입구', position:[34.4,17.6], axis:'z', width:2.6 },
        // 11/12 user correction with screenshot 262: the only door from the
        // preparation hall to the outer-packaging hall is in the west wall at
        // the south strip beside the homogenizer (photographed plan, lower-right
        // 출입구), not in the raw-material weighing store.
        { id:'outer-packaging', label:'외포장실 출입구', position:[16.4,19.5], labelPosition:[17.7,18.85], axis:'z', width:1.8, doorKind:'slide', operationBasis:'user-confirmed-lateral-slide-20261113' },
      ],
    },
    slabs: [full], voids: [], roofZones: [],
    rooms: [
      // The user calls the west packing hall (ICA, X-ray, palletizer) 외포장실.
      room('factory', '공장', 0, 25, 6.7, 35, { displayLabel: '외포장실', currentNameBasis: 'user-correction-20261112' }), room('filling-zone', '충전구역', 22.2, 25, 0, 6.7),
      room('observed-enclosed-packing','충전·포장 설비 구역',0.2,17,6.9,16.4,{positionBasis:'20261112-overlook-344-354; approximate-registration'}),
      room('boiler', '보일러실', 34.8, 43, 0, 9.8, { positionBasis:'boiler-room-video-and-floor1-plan' }),
      room('preparation', '원료계량창고', 27.8, 36.8, 9.8, 18, { positionBasis:'current-room-plan-and-video', connectsTo:['dispensing','raw-storage'], doorConnections:['dispensing'], openConnections:['raw-storage'], connectionBasis:'user-confirmed-open-daily-weighing-boundary-20261113' }),
      room('raw-storage', '일일원료보관창고', 36.8, 43, 9.8, 18, { positionBasis:'current-room-plan-and-video', connectsTo:['preparation'], openConnections:['preparation'], connectionBasis:'user-confirmed-open-daily-weighing-boundary-20261113' }),
      room('dispensing', '조제실', 25, 43, 18, 28.2, { positionBasis: 'current-room-plan-and-video',
        // The last region is the open south-west strip with the homogenizer and
        // the outer-packaging door (photographed plan, lower-right corner).
        regions: [rectangle(25,39.1,18,30.3),rectangle(39.1,43,18,26.4),rectangle(25,36.8,30.3,31.8),rectangle(25,30.2,31.8,35)],
        labelBounds: rectangle(30,39,21,25),
      }),
      room('office', '사무·소독 준비실', 33.6, 36.8, 31.8, 35, { positionBasis:'video-87-146-159-current-use' }),
      room('cip', 'CIP·세척 설비실', 30.2, 33.6, 31.8, 35, { positionBasis:'video-111-139-and-room-plan' }),
      room('air-shower', '소독실·에어샤워', 36.8, 40, 30.3, 31.7, { positionBasis:'video-165-170-and-481-486-direct-entry-sightline' }),
      room('hygiene', '위생 전실·신발장', 40, 43, 29.6, 35, { positionBasis:'video-486-501-entry-facing-left-stair-right-sinks' }),
      room('entry-corridor', '현관 옆 복도', 41.9, 43, 25.4, 30.3, { positionBasis:'video-497-505-northbound-corridor' }),
      room('toilet', '화장실', 39.1, 41.9, 26.4, 29.6, { positionBasis:'video-499-505-west-door-off-east-corridor' }),
    ],
    partitions: [
      // Historical A013 gaps at raw z14.9 (weighing store) and z23.9 (behind the
      // tank row) are not on the current photographed plan. The confirmed
      // lateral sliding door is south of the deck edge, at local z19.5.
      // Paired leaves are an illustrative fit to the space beside the opening.
      wall([25, 6.7], [25, 35], [{ id:'outer-packaging', offset:26.2, width:1.8, height:2.4, label:'외포장실 출입구', doorKind:'slide', slideLeaves:2, slideLayoutEstimated:true, operationBasis:'user-confirmed-lateral-slide-20261113' }]),
      // 11/13 user confirmation: no direct door connects preparation to the boiler room.
      { ...wall([34.8, 0], [34.8, 9.8]), height:6.3 },
      // The daily/weighing boundary is open. No divider or floating window
      // belongs beside the inner fast shutter; the northern wall stays solid.
      { ...wall([25, 9.8], [43, 9.8]), height:6.3 },
      { ...wall([25, 18], [43, 18], [{ offset: 10.2, width: 3, height: 3, doorKind:'custom' }]), height:6.3 },
      wall([30.2, 31.8], [36.8, 31.8], [{ offset: 1.7, width: 1.1, height: 2.2, doorKind:'custom' }, { offset: 5, width: 3.2, height: 3, doorKind:'custom' }]),
      wall([30.2, 31.8], [30.2, 35]), wall([33.6, 31.8], [33.6, 35], [{ offset:1.6,width:3.2,height:3,doorKind:'custom' }]),
      wall([36.8, 28.2], [36.8, 35], [{ offset: 2.8, width: 1.15, height: 2.4, doorKind:'custom' }]),
      wall([39.1, 26.4], [41.9, 26.4]), wall([39.1, 26.4], [39.1, 29.6]),
      wall([39.1, 29.6], [41.9, 29.6]),
      wall([41.9, 26.4], [41.9, 29.6], [{ offset: 2.2, width: .9, height: 2.2, doorKind:'custom' }]),
      wall([28.8, 0], [28.8, 9.8], [{ offset: 2.7, width: 1, height: 2.2 }]),
      wall([25, 4.8], [33.8, 4.8], [{ offset: 1.6, width: 1, height: 2.2 }, { offset: 5.5, width: 1, height: 2.2 }]),
    ],
    openings: [
      { side: 'west', offset: 28.5, width: 2.2, height: 3, label: '제품 출구' },
      { side: 'south', offset: 12, width: 4, height: 3, label: '출입구 · 위치 도면 비례' },
      { side: 'east', offset: 14, width: 3, height: 3, label: '원료 출입구', doorKind:'custom' },
      { side: 'east', offset: 31, width: 2.6, height: 2.65, label: '1팀 2파트 출입구', doorKind:'custom' },
      { side:'east',offset:33.4,width:1.1,sill:.65,height:2.4,doorKind:'none',label:'계단 황색창' },
      ...mezzanineWindows.map(window=>({...window,sill:3.9})),
    ],
  })),
  2: Object.freeze(basic(2, 3.8, 3.5, {
    displayLevel:1.5, name:'1.5층 · 탈의실·OP실·관찰 통로', shortName:'탈의실·OP실·관찰 통로', partialFloor:true, elevatorService:false,
    summary:'계단 옆 탈의실에서 직선 통로를 따라가면 오른쪽으로 꺾기 전에 1층 하행 계단이 있습니다. 하행 계단을 이용하지 않고 오른쪽으로 가면 OP실이며, OP실을 지나 같은 방향의 통로 끝에 상·하행 계단이 있습니다. 엘리베이터는 1.5층에 정차하지 않습니다. 관찰창 아래 생산설비는 1층 소속이며, 실제 동선 관계를 우선해 방·참·바닥을 연결했습니다. 개별 좌표와 치수는 실측하지 않은 개략입니다.',
    positionConfidence:'video-route-topology-with-estimated-plan-registration',
    source:'2026-11-12 1팀 2파트 출입구–1.5층–3층 연속 촬영 및 사용자 층 명칭 확인',
    personStart:{position:[30.4,3.8,17.8],yaw:-Math.PI/2},
    routeSurvey:{source:'dryer-entrance-mezzanine-20261112',sourceTimes:[150,162,174,198,216,222,246,282,298,314,330,348,376,414],drawingPolicy:'reference-only',
      topology:['입구 계단 옆 탈의실','직선 통로','우회전 직전 1층 하행 계단','오른쪽 통로의 OP실','같은 방향 통로 끝 상하행 계단'],
      route:[[33.7,19.315],[33.7,17.8],[30.4,17.8],[-4.75,17.8],[-7,17.8],[-7,9.1],[-7,-5.6],[-7,-6],[-7,-7.25]],
      dimensionsMeasured:false, axesConfirmed:false, corridorWidth:2.9, corridorWidthBasis:'user-confirmed consistent width; representative model dimension',topologyBasis:'user-confirmed-dressing-straight-right-op-end-stairs-20261113',observedStairIds:['route-turn-down-stair','northeast-stair','route-end-down-stair'],
      exteriorWindows:mezzanineWindows,
      dressingRoom:{bounds:rectangle(36.9,41.2,27.4,30.6),door:[30.4,17.2],width:.95,sourceTimes:[162,168,174,180],genderConfirmed:false,adjacentStairId:'southeast-stair',arrivalLanding:{minX:28.2,maxX:34.3,minZ:17.2,maxZ:18.4}},
      opRoom:{bounds:rectangle(3.2,9.3,16.5,26.8),door:[-5.4,9.1],width:1.05,sourceTimes:[298,304,314,330,348,362]},
      upperStair:{bounds:upperStairBounds,lowerDoor:upperStairLowerDoor,upperDoor:upperStairUpperDoor,entrySide:'south',window:{side:'north',position:[-7,-13.4],width:2.5,sill:.65,height:4.1},sourceTimes:[414,418,420,426,434,438,440,443],topology:'end of the same corridor beyond OP; up/down flights; window-facing return landing',compassOrientationConfirmed:false,dimensionsMeasured:false},
    },
    slabs: [full],
    // Inset traces preserve the narrow structural/circulation strips between
    // separate VOID labels. Individual edges have not been field measured.
    voids: [rectangle(3.3, 22.1, .15, 6.5), rectangle(3.3, 22.1, 6.9, 16.3),
      rectangle(9.4, 22.1, 16.7, 30.45), rectangle(3.3, 9.1, 27, 30.45),
      rectangle(30.9, 42.85, .15, 9.6), rectangle(25.2, 42.85, 10, 17.8), rectangle(25.2, 36.6, 18.2, 30.45)],
    slabOpenings:[{bounds:full,holes:[{minX:28.3,maxX:34.2,minZ:18.45,maxZ:21.5},{minX:-5.25,maxX:.55,minZ:18.45,maxZ:21.5},endStairOpening]}],
    slabPatches:[rectangle(13.6,22,0,3.4),{minX:-8.45,maxX:33.3,minZ:17.05,maxZ:18.4},{minX:33.3,maxX:34.35,minZ:17.2,maxZ:19.7},{minX:-5.3,maxX:-4.45,minZ:17.05,maxZ:19.3},{minX:-8.35,maxX:-5.65,minZ:-8.1,maxZ:-6.4}],
    rooms:[room('west-dry-walkway','생산 관찰 통로',0,3.2,6.7,31.8,{positionBasis:'current-continuous-walk'}),
      room('op','OP실',3.2,9.3,16.5,26.8,{positionBasis:'current-video-room-use; approximate-registration'}),
      room('dressing','탈의실 · 탈의장',36.9,41.2,27.4,30.6,{positionBasis:'user-confirmed-beside-entry-stair; approximate-registration',sourceTimes:[162,174]})],
    partitions:[],
    stairs:[observedUpperStair,turnDownStair,endDownStair],
    roofZones:[],openings:[...mezzanineWindows.map(window=>({...window,sill:.4}))],
  })),
  3: Object.freeze(basic(3, 7.3, 6, {
    name:'3층 · 설비 홀·에어컴프레셔실',shortName:'설비 홀·에어컴프레셔실',
    wallHeight:5.9,
    summary:'3층에는 승강기 앞 디스크 컨베이어 구역과 기존 설비 작업 구역이 있습니다. 개요도의 점선은 두 구역의 대략적인 범위입니다. 엘리베이터 옆 동측 방화문에서 북동 계단참과 옥상문을 지나 녹색 옥상의 에어컴프레셔실로 갑니다. 압축기 4대, 리시버 탱크 2기, 애프터 쿨러·드라이어, 칠러·수조 및 옥상 집진기·실외기를 현장 촬영에 맞춰 배치했습니다.',
    positionConfidence:'video-observed-room-sequence; historical-dimensions-retained-as-reference',
    source:'2026-11-12 연속 촬영(3층 홀) + 2026-11-24 연속 촬영·사진 100장(엘리베이터·북동 계단·옥상·에어컴프레셔실)',
    personStart:{position:[-6.315,7.3,-5.9],yaw:Math.PI},
    routeSurvey:{source:'dryer-entrance-mezzanine-20261112',sourceTimes:[440,450,466,502,520,538,554,586,612,648,686,704,724],drawingPolicy:'reference-only',
      smallerFloorPlateConfirmed:true,dimensionsMeasured:false,axesConfirmed:false,
      glazedEnclosure:{minX:.55,maxX:4.55,minZ:-12.15,maxZ:-9.05},
      storageDoor:{position:[3.65,-12.15],side:'north',registrationBasis:'11/12 observed entrance; 11/24 enclosure west of elevator'},
      hallRegistration:{
        basis:'2026-11-24 user-confirmed two work areas; approximate outline from site photos',
        boundaryMeasured:false,physicalPartitionSurveyed:false,
        connectingDoor:{
          id:'third-process-link',position:[-3.35,-5.15],normal:[1,0],width:.95,height:2.10,panelSpan:2.55,
          fromArea:'elevator-disc',toArea:'process-work',positionMeasured:false,
          sourceClip:'dryer-entrance-mezzanine-20261112',sourceTimes:[560,571.25,573.5,573.75,574.25,575.5,579.75,583],
        },
        boundaryGuide:[[-8.35,-6.45],[-3.35,-6.45],[-3.35,-3.65],[8.35,-3.65]],
        areas:[
          {id:'elevator-disc',name:'승강기 앞 · 디스크 컨베이어',labelAt:[4,-4.25],equipment:['f3-holding']},
          {id:'process-work',name:'기존 설비 작업 구역',labelAt:[-.5,10.2],equipment:['f3-sterilizer','f3-homogenizer','f3-balance-tank','f3-feed-tank']},
        ],
      },
      exteriorWindowBands:thirdFloorWindowBands,
      ibcRow:[[-4.6,-10.5],[-2.7,-10.5],[-.8,-10.5]],
      drainSegments:[{a:[1.4,-4.5],b:[1.4,10.5],width:.18},{a:[-6,10.7],b:[1.4,10.7],width:.18}],
      shutter:{position:[-1.75,-13.4],side:'north',width:4.3,height:4.5,sourceTimes:[567],photoNumbers:[3],interiorUnconfirmed:true},
      entryFromStair:{door:upperStairUpperDoor,normal:'z',sourceTimes:[434,438,440,443,450],positionMeasured:false},
      compressorWalk:{source:'dryer-3f-compressor-20261124',dimensionsMeasured:false,hallDoor:[8.6,-8.6],roofDoor:[9.35,-6.7],compressorDoor:[16.85,-3.4],walkwayBounds:{minX:8.6,maxX:22.2,minZ:-13.4,maxZ:5.4},
        route:[[7.9,-8.6],[9.84,-8.6],[9.86,-7.38],[9.35,-6.7],[9.35,-5.4],[10.2,-3.2],[12.7,-1.95],[15,-1.95],[17.31,-1.95],[17.31,-3.4],[17.31,-4.7]]},
      route:[[-6.315,-5.9],[-6.315,-3.4],[.8,-3.4],[.8,3],[1,10.6],[-3.5,10.6]]},
    slabs: [main, northEastBay, compressorRoom.bounds], voids: [],
    slabOpenings:[{bounds:main,holes:[endStairOpening]}, {bounds:northEastBay,holes:[northEastFlightOpening]}],
    // The 2026-11-24 walk confirms a continuous green epoxy outdoor roof from
    // the NE stair exit alcove past the condensers and baghouse to the
    // compressor room double door. Unfilmed south/far-east roof zones stay cover-only.
    roofThreshold: rectangle(22, 30.8, 10, 11.5),
    roofWalkwayZones: [rectangle(17.2, 22, 6.7, 11.5), rectangle(17.2, 30.8, 11.5, 18.8)],
    roofZones: [rectangle(30.8, 43, 0, 11.5), rectangle(30.8, 43, 11.5, 18.8),
      rectangle(17.2, 43, 18.8, 35), rectangle(0, 17.2, 26.8, 35)],
    rooms:[room('factory','3층 설비 홀',0,17.2,6.7,26.8,{positionBasis:'current-video; reduced-envelope-proportion'}), compressorRoom],
    partitions:[{a:[-8.6,-6.7],b:[-5.4,-6.7],openings:[{offset:2.285,width:1.2,height:2.3,label:'3층 계단 출입문',doorStyle:'perforated'}]}, ...northEastStairWalls, ...compressorWalls],
    openings:[...thirdFloorWindowBands,
      {side:'east',offset:4.8,width:1.05,height:2.2,id:'third-ne-stair-door',label:'3층 홀에서 북동 계단참으로 가는 방화문',doorStyle:'gray-fire-door',hingeSide:1,swingSide:-1,openAngle:110*Math.PI/180,positionBasis:'A-015-and-20261124-video-proportion'},
      {side:'east',offset:8.42,width:2.10,sill:.64,height:1.44,doorKind:'none',id:'third-roof-recess-window',label:'옥상문 옆 외벽 반투명 창',sourceTimes:[274,277,280]},
      {side:'north',offset:6.85,width:4.3,height:4.5,doorKind:'custom',label:'3층 회색 셔터'}],
    archivedDrawingFixtures: [
      { id: 'historical-roof-tank-a', name: '도면상 옥상수조 A · 30ton 표기 · 현재 미확인', type: 'reference-water-tank', position: point(27.8, 21.5), width: 5.6, depth: 3.2, height: 1.8 },
      { id: 'historical-roof-tank-b', name: '도면상 옥상수조 B · 30ton 표기 · 현재 미확인', type: 'reference-water-tank', position: point(27.8, 29.4), width: 5.6, depth: 3.2, height: 1.8 },
    ].map(item => ({ ...item, historicalOnly: true, currentInstallationConfirmed: false, referenceOnly:true,dimensionsBasis: 'plan-proportion; height illustrative', selectableEquipment: false })),
    stairs:[],
  })),
  4: Object.freeze(basic(4, 13.3, 6.9, {
    name: '4층 · V/F·화인리턴', shortName: 'V/F·화인리턴',
    summary: 'A016의 17.2×26.8m 타워와 북동 계단·ELEV 구역입니다. 넓은 저층 익동 외곽이 이 층까지 이어진다고 가정하지 않습니다.',
    slabs: [main, northEastBay], voids: [], roofZones: [], rooms: [room('factory', '공장', 0, 17.2, 6.7, 26.8)], partitions: [], openings: [],
  })),
  5: Object.freeze(basic(5, 20.2, 6, {
    name: '5층 · 건조기 하부', shortName: '건조기 하부',
    summary: 'A016의 타워 평면과 북동 계단·ELEV 구역입니다. 챔버 하부의 관통부는 하부 콘 연속축과 함께 표현합니다.',
    slabs: [main, northEastBay], voids: [], roofZones: [], rooms: [room('factory', '공장', 0, 17.2, 6.7, 26.8)], partitions: [], openings: [],
    architecturalOpening: { x: -1, z: 7.5, diameter: 3.4, basis: 'A019 5F Ø3400; hole size differs from equipment shell' },
  })),
});
