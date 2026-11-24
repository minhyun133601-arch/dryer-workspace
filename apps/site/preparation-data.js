// 2026-11-11 continuous walk: raw-material entry → preparation → 1팀2파트.
// The photographed lighting plan is rotated 90° against A013. Yellow circles
// on that plan are lamps; the six explicitly drawn vessels define the bank.
const frame = second => [76, 78].includes(second)
  ? `./assets/drawings/preparation/current-room-plan-frame-${String(second).padStart(3, '0')}s.jpg`
  : `./photos/preparation-room/frame-${String(second).padStart(3, '0')}s.jpg`;
const basis = '20261111-continuous-walk-and-current-room-plan';
const supplementReferences = seconds => [{ clipId: 'first-floor-20261113-clip1', seconds }];
const knownRevisions = ['dryer-full-envelope-20261110', 'dryer-full-envelope-final-20261110', 'liquid-card-detail-spacing-20261110', 'campus-rear-video-placement-20261111', 'campus-rear-identities-20261111', 'campus-valve-interior-20261111', 'campus-office-lpg-restoration-20261111', 'preparation-room-current-layout-20261111'];
const originalTankPositions = { 'f1-mix-a': [-8.8,.3,-8], 'f1-mix-b': [-3.8,.3,-8], 'f1-melting': [1.2,.3,-8], 'f1-oil-water': [8,.3,-7.5], 'f1-s1': [8.8,.3,-1.8] };
// A saved layout snaps every body to the 0.25 placement grid. The deck, its
// hanging tanks and the services under them therefore sit on that grid, and
// the deck openings are derived from the tank poses: a saved browser layout
// can no longer leave a tank off-centre in its opening (11/12 screenshot 261).
const DECK_ORIGIN = Object.freeze([22, 11.5]);
const DECK_OUTLINE = Object.freeze([[-5.4,-6.75],[4.9,-6.75],[4.9,-4.3],[-1.6,-4.3],[-1.6,2.2],[4.9,2.2],[4.9,6.75],[-5.4,6.75]]);
const DECK_OPENING_CLEARANCE = .04;
// A hanging tank outside this world rectangle has no deck to hang from.
const HANGING_DECK = Object.freeze({ id: 'f1-prep-platform',
  minX: DECK_ORIGIN[0] + Math.min(...DECK_OUTLINE.map(([x]) => x)), maxX: DECK_ORIGIN[0] + Math.max(...DECK_OUTLINE.map(([x]) => x)),
  minZ: DECK_ORIGIN[1] + Math.min(...DECK_OUTLINE.map(([, z]) => z)), maxZ: DECK_ORIGIN[1] + Math.max(...DECK_OUTLINE.map(([, z]) => z)) });
const TANK_ROW_X = 18.25;
const round6 = value => Math.round(value * 1e6) / 1e6;
// Under-deck services keep their filmed offsets from the tank row
// (red header .75 m, lower sanitary header 1 m beside the vessel axis).
const rowOffset = x => round6(TANK_ROW_X + x - DECK_ORIGIN[0]);
// 11/11 clip 4:31-4:53 and 6:40: vessels hang from the 2.45 m deck on lugs,
// dished bottoms about 1 m above the floor, no floor legs.
const vessel = (id, label, options = {}) => ({ id, label, x: 0, z: 0, radius: .9, bodyHeight: 2.35, baseHeight: .95, deckElevation: 2.45, motor: true, motorColor: 'dark', ...options });
const observed = (seconds, details = []) => ({
  photo: frame(seconds[0]), photos: seconds.map(frame),
  confidence: '현장 영상·현행 배치도 대조 · 크기·좌표 개략',
  positionBasis: basis, positionConfidence: 'approximate',
  details: [...details, '탱크·설비의 반복 촬영은 같은 장치로 대조했습니다. 보이지 않는 내부 구조와 가려진 배관 연결은 확정하지 않았습니다.', '원료 출입구와 1팀 2파트 출입구를 연결해 도면에 비례 등록했으며 실측 좌표는 아닙니다.'],
});
const overrides = {
  'f1-melting': { name: '카제인 탱크', tag: 'CASEIN', position: [TANK_ROW_X, .3, 5.75],
    preparation: { kind: 'tank-group', vessels: [vessel('casein', '카제인 탱크', { motorColor: 'blue' })], sourceTimes: [189, 201, 345] },
    summary: '현행 조제실 배치도의 서측 일렬 탱크 맨 뒤 카제인 탱크입니다. 과거 자료의 용해 탱크 추정 명칭과 두 몸통 표현을 고쳤습니다.',
    ...observed([189, 201, 345]),
  },
  'f1-mix-a': { name: '혼합·살균 탱크 1', tag: 'MIX-1', position: [TANK_ROW_X, .3, 8.25],
    preparation: { kind: 'tank-group', vessels: [vessel('homo-a', '호모 믹스-1', { radius: 1.02, plate: '호모 믹스-1' })], sourceTimes: [207, 249, 393] },
    summary: '뚜껑에 혼합/살균 탱크 1 표지가 보이는 외형을 재현했습니다. 배치도의 호모믹스 열을 참고하되, 과거 공정 명칭과의 정확한 대응은 미확인입니다.',
    ...observed([249, 267, 393]),
  },
  'f1-mix-b': { name: '혼합·살균 탱크 2', tag: 'MIX-2', position: [TANK_ROW_X, .3, 11],
    preparation: { kind: 'tank-group', vessels: [vessel('homo-b', '호모 믹스-2', { radius: 1.02, plate: '호모 믹스-2', lowerDetails: { inspectionPort: true, flexConnection: true, sensorCable: true } })], sourceTimes: [255, 267, 393, 399] },
    summary: '뚜껑의 혼합/살균 탱크 2 표지와 교반 모터·메시 보호통·원형 맨홀을 재현했습니다. 서측 탱크 열과 하부 배관 공간을 연결했습니다.',
    ...observed([255, 291, 399]),
  },
  'f1-oil-water': { name: '오일·열수 탱크', tag: 'OIL / HW', position: [TANK_ROW_X, .3, 13.5],
    preparation: { kind: 'tank-group', vessels: [vessel('oil', '오일 탱크', { radius: .86, motor: false, lowerDetails: { actuator: true, sensorCable: true } }), vessel('hot-water', '열수 탱크', { z: 2.6, radius: .86, motorColor: 'blue', lowerDetails: { actuator: true, sensorCable: true } })], sourceTimes: [267, 291, 411, 429] },
    summary: '서측 탱크 열 끝의 오일 탱크와 열수 탱크 2기입니다. 별도 몸통·맨홀·연결 배관으로 구분했습니다.',
    ...observed([267, 291, 411, 429]),
  },
  'f1-s1': { name: 'S-1 탱크', tag: 'S-1', position: [23, .3, 16],
    preparation: { kind: 'tank-group', vessels: [vessel('s1', 'S-1 탱크', { radius: .95, motor: false })], sourceTimes: [225, 236, 357] },
    summary: '일렬 5기에서 남측으로 꺾여 배치된 S-1 탱크입니다. 조작반 옆 반환 구간과 하부 서비스 공간을 함께 구분했습니다.',
    ...observed([225, 236, 357]),
  },
};
export function registerPreparationEquipment(item) {
  const update = overrides[item.id];
  if (!update) return item;
  const quarter = value => Math.round(value / .25) * .25;
  // Qualify both the original OWP defaults and the later registered defaults.
  // Exact matching protects intentional moves, even within one grid cell.
  const sourcePoses = [item.position, originalTankPositions[item.id]];
  const poses = sourcePoses.flatMap(position => [position, [quarter(position[0]), position[1], quarter(position[2])]]);
  // The interrupted full-envelope release automatically clamped MIX-1 to
  // [-7,-8]. Later preparation revisions could stamp that old pose as reviewed
  // without moving its body into the room, leaving one empty deck opening.
  // Carry only recorded automatic clamps into these exact revision-qualified
  // preparation migrations; a manual move or turn must retain the whole pose.
  const automaticClamps = (item.previousPlacements || []).filter(placement => placement.migrationBasis === 'observed-automatic-clamp-without-user-edit');
  const clampRevisions = [...knownRevisions, 'preparation-complete-20261111'];
  const previousPlacements = [
    ...(item.previousPlacements || []),
    ...knownRevisions.flatMap(catalogRevision => poses.map(position => ({ position: [...position], rotation: item.rotation || 0, catalogRevision, migrationBasis: 'preparation-video-default' }))),
    ...clampRevisions.flatMap(catalogRevision => automaticClamps.map(placement => ({ ...placement, position: [...placement.position], catalogRevision, migrationBasis: 'preparation-video-default', previousMigrationBasis: placement.migrationBasis }))),
  ];
  return Object.freeze({ ...item, ...update, rotation: 0, labelHeight: 4.6,
    parts: ['탱크 몸통·작업대 지지부', '맨홀·교반 구동부', '배관·밸브·계측'], previousPlacements,
    hangingDeck: HANGING_DECK,
  });
}
// One co-centred opening per hanging vessel, in deck coordinates.
const deckOpenings = Object.values(overrides).flatMap(({ position, preparation }) => preparation.vessels.map(unit => ({
  x: round6(position[0] + (unit.x || 0) - DECK_ORIGIN[0]),
  z: round6(position[2] + (unit.z || 0) - DECK_ORIGIN[1]),
  radius: round6(unit.radius + DECK_OPENING_CLEARANCE),
})));
function equipment(id, name, kind, position, dimensions, seconds, summary, preparation = {}, pose = {}) {
  return Object.freeze({ id, name, floor: 1, type: 'preparation-equipment', tag: name, position: [position[0], .3, position[1]], rotation: 0,
    ...dimensions, labelHeight: 4.2, parts: ['외함·지지 구조', '작업·조작부', '연결·세부 부속'],
    preparation: { kind, ...preparation }, summary, ...observed(seconds), ...pose,
  });
}
// 11/12 user correction with screenshot 262: the outer-packaging door is in
// the west wall beside the homogenizer, and the feed pump stands directly
// behind the homogenizer instead of 2.5 m away in the aisle. Browsers that
// still hold a reviewed default move once. The 11/13 correction moves the
// connected pair sideways while keeping clearance from the CIP-room wall.
// Manual moves, turns and later saves under this revision remain intentional.
const OUTER_DOOR_PLACEMENT_REVISION = 'preparation-outer-door-clearance-20261113';
const relocatedFrom = (previousDefault, ...poses) => ({ placementRevision: OUTER_DOOR_PLACEMENT_REVISION,
  previousPlacements: ['preparation-complete-20261111', 'preparation-missing-tank-20261112', 'preparation-tank-openings-20261112'].flatMap(catalogRevision => [
    ...poses.map(([x, z]) => ({ position: [x, .3, z], rotation: 0, catalogRevision, migrationBasis: 'preparation-video-default' })),
    { position: [previousDefault[0], .3, previousDefault[1]], rotation: -Math.PI, catalogRevision, migrationBasis: 'preparation-video-default' },
  ]),
});
export const PREPARATION_EQUIPMENT = Object.freeze([
  equipment('f1-prep-platform', '조제실 작업대·계단', 'platform', DECK_ORIGIN, { width: 10.5, depth: 13.5, height: 3.5 }, [177, 183, 237, 333, 339],
    '서측 일렬 5기와 남측 S-1을 잇는 철골 작업대입니다. 탱크 개구부, 체크무늬 철판, 지지 기둥, 계단과 스테인리스 난간을 구분했습니다.',
    { elevation: 2.45, outline: DECK_OUTLINE.map(point => [...point]),
      holes: deckOpenings,
      // Approximate supports remain beneath the deck, west of the complete
      // raw-shutter aisle rather than across its 2.85m clear opening.
      supports: [[-5.22,-6.57],[2.6,-6.57],[2.6,-4.48],[-1.42,-4.48],[-1.42,2.38],[4.72,2.38],[4.72,6.57],[-5.22,6.57]],
      stairs: { x: 2.6, z: -1.7, rotation: Math.PI, width: .9, run: 2.6 },
      railEdges: [{a:[-1.6,-4.3],b:[1.9,-4.3]},{a:[3.3,-4.3],b:[4.9,-4.3]},{a:[4.9,-6.75],b:[4.9,-4.3]},{a:[-1.6,-4.3],b:[-1.6,2.2]},{a:[-1.6,2.2],b:[4.9,2.2]},{a:[4.9,2.2],b:[4.9,6.75]}], sourceTimes: [177,183,237,333,339] }),
  equipment('f1-prep-console', '조제실 조작반', 'control-panel', [24.25, 14.5], { width: 2.7, depth: .85, height: 1.45 }, [232, 236],
    '탱크 작업대 위의 경사 조작반입니다. 공정 선도, 상부 표시기, 누름 버튼·선택 스위치와 비상정지를 표현했습니다.', { elevation: 2.45, width: 2.7, height: 1.45, depth: .85, console: true, sourceTimes: [232,236] }),
  equipment('f1-prep-main-panel', '조제실 메인 제어반', 'control-panel', [24.5, 5.5], { width: 3.5, depth: .65, height: 2.2 }, [177, 315, 321, 327],
    '북측 작업대 위 회색·크림색 제어반 열과 미믹 배관 선도, 표시창, 계기 및 회전 스위치를 재현했습니다. 표시 숫자는 운전값으로 만들지 않았습니다.', { elevation: 2.45, width: 3.5, height: 2.2, depth: .65, conduitSide:-1, sourceTimes: [177,315,321,327] }),
  equipment('f1-prep-bag-dump', '원료 투입·분말 용해부', 'powder-hopper', [22.2, 6.4], { width: 1.6, depth: 1.2, height: 1.9 }, [57, 105, 333, 471],
    '작업대 아래 Fristam 표기가 보이는 포대 투입·펌프 장치입니다. 원형 투입구, 경사진 스테인리스 흡입 후드와 검정 주름 덕트, 하부 펌프 덮개·통풍 조작함·캐스터를 11월 13일 근접 영상으로 보강했습니다. 가려진 덕트 연결과 내부 용해 방식은 확정하지 않았습니다.', { width: 1.6, depth: 1.2, height: 1.9, sourceTimes: [57,105,333,471], supplementaryExterior:true, sourceReferences:supplementReferences([42,46,50,55]) }),
  Object.freeze({ id:'f1-prep-mobile-white-unit',name:'조제실 이동식 백색 장치',floor:1,type:'preparation-equipment',tag:'백색 이동식 장치',position:[25.65,.3,9.8],rotation:0,
    width:.85,depth:.75,height:2.5,labelHeight:2.7,parts:['백색 외함·캐스터','표시판·청색 덮개','상부 주름 금속관'],
    preparation:{kind:'mobile-cabinet',width:.82,depth:.7,height:1.55,sourceReferences:supplementReferences([31,35,38])},
    sourceReferences:supplementReferences([31,35,38]),
    photo:'./assets/photos/evidence/dryer-first-floor-20261113/clip-142059-frame-031s.jpg',
    photos:['./assets/photos/evidence/dryer-first-floor-20261113/clip-142059-frame-031s.jpg','./assets/photos/evidence/dryer-first-floor-20261113/clip-142059-frame-038s.jpg'],
    placementRevision:'preparation-mobile-cabinet-shutter-clearance-20261113',
    previousPlacements:[25.65,25.75].map(x=>({position:[x,.3,6.5],rotation:0,catalogRevision:'preparation-tank-openings-20261112',migrationBasis:'preparation-video-default'})),
    summary:'조제실 작업대 계단 옆에서 보이는 백색 3구획 외함·캐스터 장치입니다. 상부 금속 주름관, 표시판, 옆에 걸린 청색 덮개를 재현했습니다. 정확한 장치 기능·정격과 가려진 배관 연결은 미확정이며 위치·치수는 영상 비례입니다.',
    confidence:'2026-11-13 근접 영상 외형 확인 · 기능 미확정 · 치수·좌표 개략',positionBasis:'20261113-video-relative-to-platform-stair-and-bag-dump',positionConfidence:'approximate',
  }),
  // Front (pump heads, gauges, panel) faces the hall; its west end keeps 2.6 m
  // clear in front of the outer-packaging door at local z19.5.
  equipment('f1-prep-homogenizer', '조제실 균질기', 'homogenizer', [20, 20], { width: 2, depth: 1.1, height: 1.6 }, [363, 375],
    '균질기 표지와 전면 3개 펌프 헤드·압력계·검정 조절 캡·상부 조작반이 보이는 1층 장치입니다. 11월 13일 영상의 넓은 반대편 서비스 커버·검정 손잡이·위험 표지와 좌측 수직관·흰 양동이를 보강했습니다. 외포장실 미닫이 출입문 앞 공간과 조제실 쪽을 향한 앞면을 유지하며, 내부 기구는 추가하지 않았습니다.', { width: 2, depth: 1.1, height: 1.6, sourceTimes: [363,375], supplementaryExterior:true, sourceReferences:supplementReferences([62,65,68,72]) },
    { rotation: -Math.PI, ...relocatedFrom([19.5, 20], [18.4, 20], [18.5, 20]) }),
  // Directly behind the homogenizer (south side); the discharge riser turns
  // north and meets the homogenizer's back face.
  equipment('f1-prep-transfer-pump', '조제실 이송 펌프', 'service-pump', [20.25, 21], { width: 1.5, depth: .7, height: .9 }, [369, 387,435],
    '노란 커플링 보호대가 있는 바닥 펌프와 전동기, 위생 배관·받침 프레임을 재현했습니다. 사용자 확인에 따라 균질기 바로 뒤에 두고 토출관을 균질기 뒷면에 연결했습니다.', { width: 1.5, depth: .7, height: .9, sourceTimes: [369,387,435], dischargeLength: .43 },
    { rotation: -Math.PI, ...relocatedFrom([19.75, 21], [20, 18.1], [20, 18]) }),
  equipment('f1-prep-filter-pot', '조제실 소형 배관 용기', 'filter-pot', [19.75, 15.6], { width: .9, depth: .9, height: 1.3 }, [411, 417],
    '탱크 하부 배관 옆 작은 스테인리스 뚜껑 용기입니다. 뚜껑 손잡이·잠금부·다리·양측 연결관을 재현했으며 내부 여과 방식은 미확인입니다.', { radius: .4, height: 1.3, sourceTimes: [411,417] }),
  equipment('f1-prep-under-services', '조제실 탱크 하부 공통 배관', 'under-platform-services', DECK_ORIGIN, { width: 2.2, depth: 10.8, height: 1.3 }, [387,399,411,429],
    '작업대 아래에서 촬영된 붉은 보온 헤더, 두 높이의 스테인리스 관, 밴드·지지대·위생 밸브와 파란 공압관을 재현했습니다. 탱크별 명칭 대응과 가려진 공정 연결은 개략입니다.', {
      runs: [
        { id:'red-insulated-header', points:[[rowOffset(.75),.68,-5.6],[rowOffset(.75),.68,4.9]], radius:.105, paint:'red', insulated:true, sourceTimes:[387,429] },
        { id:'lower-sanitary-header', points:[[rowOffset(1),.28,-5.6],[rowOffset(1),.28,5]], radius:.055, paint:'steel', sourceTimes:[387,411,429] },
        { id:'aisle-sanitary-header', points:[[rowOffset(1.8),.54,-5.6],[rowOffset(1.8),.54,5]], radius:.055, paint:'steel', sourceTimes:[399,411,429] },
        { id:'blue-pneumatic-line', points:[[rowOffset(1.28),1.08,-2.6],[rowOffset(1.28),1.08,4.9]], radius:.013, paint:'blue', sourceTimes:[399,429] },
      ],
      valves:[{id:'lower-isolation-a',position:[rowOffset(1),.28,-2.2],axis:'z',paint:'blue'},{id:'lower-isolation-b',position:[rowOffset(1.8),.54,2.05],axis:'z',paint:'red'}],
      sourceTimes:[387,399,411,429],
    }),
  Object.freeze({ id:'f1-boiler-room', name:'보일러실 내부', floor:1, type:'preparation-boiler-room', tag:'보일러실', position:[30.3,.3,-8.5], rotation:0,
    width:8.2, depth:9.8, height:6.6, labelHeight:4.2, inspectableInterior:true,
    physicalRoomId:'team1-part2-boiler-room', samePhysicalRoomAs:'campus-boiler-room',
    interiorView:{azimuth:-.8,elevation:.58}, parts:['실내 구조·배관','노통연관식 보일러','관류식 보일러·보조 설비'],
    summary:'조제실 옆 보일러실 안의 노통연관식 3t·관류식 1.5t 보일러, 버너·제어반·녹색 펌프·급수 설비를 함께 볼 수 있습니다. 공장 전경의 보일러실과 같은 공간이며 방 크기·장치 위치는 영상과 도면 비례 복원입니다.',
    confidence:'보일러실 영상 대조 · 방 크기·장치 위치 개략', positionBasis:'boiler-room-video-and-floor1-plan',positionConfidence:'approximate',
    details:['공장 전경과 1층의 보일러실은 같은 실의 서로 다른 보기입니다.','가려진 배관 연결·보일러 내부 기구는 확정하지 않았습니다.'],
    photo:'./photos/boiler-room/clip-002-022s.jpg', photos:[22,37,52,74,106,118,162,218,238].map(second => `./photos/boiler-room/clip-002-${String(second).padStart(3,'0')}s.jpg`),
  }),
]);
export const PREPARATION_PHOTOS = Object.freeze([15,39,47,51,57,76,78,87,105,135,141,152,153,154,165,170,177,189,236,291,321,363,411,483,486,492,497,500,502,503,505,510,519].map(frame));
