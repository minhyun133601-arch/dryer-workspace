import { PACKAGING_PATHS, PACKAGING_PATH_END_LOOKATS } from './packaging-routes.js';
import { TEAM2_CARD_CAPTIONS, TEAM2_IDENTITY, team2RoomPhotos, bindTeam2Card } from './team2-card-data.js';
import { PACKAGING_TRANSPORT_LINES } from './packaging-transport-data.js';
import { FLOOR3_EQUIPMENT, FLOOR3_LAYOUT, FLOOR3_MIXER_X, FLOOR3_MIXER_Z, FLOOR3_PLAN, FLOOR3_PLAN_CAPTION, FLOOR3_REVISION } from './packaging-floor3-data.js';

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
const axisX = [-15.375, -10.25, -5.125, 0, 5.125, 10.25, 15.375];
const axisZ = [-14.9, -10, -5, 0, 5, 10, 14.9];
const column = (x, z) => ({ x, z, width: .3, depth: .3, height: 6.2 });
const columns = [
  ...axisX.flatMap((x) => [column(x, axisZ[0]), column(x, axisZ.at(-1))]),
  ...axisZ.slice(1, -1).flatMap((z) => [column(axisX[0], z), column(axisX.at(-1), z)]),
  column(-5.125, 0), column(5.125, 0),
];
const buildingDoors = [
  { id: 'entry-door', x: -4, z: 15.2, width: 1.4, rotation: 0, kind: 'swing' },
  { id: 'rear-stair-door', x: -15.675, z: -11.3, width: 1.1, rotation: Math.PI / 2, kind: 'swing' },
];
const stairs = [
  { id: 'rear-stair', name: '계단실2', minX: -19.125, maxX: -15.675, minZ: -15.2, maxZ: -9.7, steps: 12, rise: 3, direction: 'z' },
  { id: 'front-stair', name: '3층 진입 계단·참', minX: -5.125, maxX: -.8, minZ: 15.2, maxZ: 18.35, flights: 4, stepsPerFlight: 10, rise: 6, direction: 'x', confidence: '영상의 반복 U턴·참·석재/자주색 노징·흰 난간 참고 · 총 높이와 매단 치수, 도면 계단과의 정확한 대응은 근사' },
];

const buildingFrame = Object.freeze({
  id: 'packaging', floor: 'packaging', span: 47, length: 33.55, width: 34.8, depth: 33.55,
  anchor: [0, 0, 0], rotation: 0,
  bounds: { minX: -19.125, maxX: 15.675, minZ: -15.2, maxZ: 18.35 }, mainBounds,
  drawingSources: [
    { sha256: '48e451589dba4125332ba8fd34e226f71f8182b237bf980014f7231367019b33', name: '소포장 3층 평면도.pdf', page: 1 },
    { sha256: 'b932b98e4f848582adcd6f02d3461945b0c67e7439b6663be7b7538bea623dfa', name: '소포장 3층 평면도 측량.pdf', page: 1 },
  ],
});

const buildingLayout = {
  mainBounds,
  lift: { id: 'cargo-lift', name: '화물용 LIFT', minX: -.8, maxX: 4.6, minZ: 15.2, maxZ: 18.35, capacity: '3TON', height: 3 },
  confidence: '도면 치수 기준 · 칸막이·기둥 높이·개구부 이격·플랫폼 높이는 영상 비례 근사',
};

const workplacePlan = (level) => `./assets/drawings/packaging/floor-${level}-workplace-2025.png`;
const redesignFrame = (seconds) => `./photos/packaging-3f/redesign-${String(seconds).padStart(4, '0')}s.jpg`;
const sourcePhoto = (name) => `./assets/drawings/packaging/${name}.png`;
const redesignSeconds = [174,194,221,228,247,278,300,330,342,353,363,379,391,393,463,478,481,506,540,544,557,561,605,614,643,660,669,674,702,732,746,760,805,829,850,905,909,916,918,948,957,958,962,995,1019,1057,1059];
const allCaptions = Object.freeze({ ...photoCaptions, ...TEAM2_CARD_CAPTIONS,
  [FLOOR3_PLAN]:FLOOR3_PLAN_CAPTION,
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
export const PACKAGING_ROOM = Object.freeze({...buildingFrame, floorLevel: 3,
  identity:TEAM2_IDENTITY,
  name:'스틱·소포장 · 3층',shortName:'스틱·소포장 3층',title:'스틱·소포장 · 3층',
  center:[0,2.5,0],path:PACKAGING_PATHS[3],pathEndLookAt:PACKAGING_PATH_END_LOOKATS[3],
  layout:{...buildingLayout,...FLOOR3_LAYOUT,
    stairs:stairs.map(stair=>stair.id==='front-stair'?{...stair,flights:4,stepsPerFlight:10,rise:6.15}:stair),
    ceilingHeight:6,eaveHeight:6,ridgeHeight:7.36,ridgeZ:7.6,floorToFloor:null,
    heightReference:'A-11 처마 6.0m·용마루 차 1.36m 우선. 경사 1.5:10과 대칭 반경간의 불일치는 근거 문서에 기록.',
  },
  photos:[FLOOR3_PLAN,workplacePlan(3),plan,measuredPlan],
  reference:FLOOR3_PLAN,photoCaptions:allCaptions,
  source:'2026-11-24 3층 작업장(Location 라벨표시 및 PDA위치도) · A-07 / 측량 평면도 · 9동 설비 사진',
  summary:'배합(소) 작업대의 믹서 4대, 배합(스) 작업대와 호퍼 10칸·시프트 2대, 원부자재 보관창고의 렉·평치(P3-3층-A~L)를 위치도대로 배치했습니다.',
  confidence:'3층 위치도 배치 · A-07 치수',
  details:['렉·평치 이름은 위치도의 P3-3층-A~L 라벨을 따릅니다. 적재물은 표시 옵션에서 끌 수 있습니다.',
    '호퍼는 박스 8개에 명판 10개입니다. 가운데 박스 두 개가 안에서 둘로 나뉘어 위치도의 10칸과 맞습니다.',
    '원통 교반 호퍼와 지대 교반기는 구 카드의 9동 2층 표기에 따라 2층 호퍼 작업대에 있습니다.'],
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
// 2층 호퍼 1~4: 2025 도면처럼 원통이 동·서로 엇갈리고 진동채 작업대가 반대편에 선다.
const HOPPER_X=-10.25;
const HOPPER_DRUMS=Object.freeze([{height:1.28,radius:.98,side:-1},{height:1.24,radius:1.02,side:1},{height:.78,radius:1.1,side:-1},{height:.78,radius:1.1,side:1}]);
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
  return Object.freeze({...buildingFrame,identity:TEAM2_IDENTITY,floorLevel:level,name:`스틱·소포장 · ${level}층`,shortName:`스틱·소포장 ${level}층`,title:`스틱·소포장 · ${level}층`,
    center:[0,2.1,0],path:PACKAGING_PATHS[level],pathEndLookAt:PACKAGING_PATH_END_LOOKATS[level],
    layout:{...buildingLayout,rooms:cells,partitions:levelWalls,transportLines:PACKAGING_TRANSPORT_LINES[level],
      doors:[...buildingDoors,
        ...(two?[{id:'f2-stick-entry',x:6.2,z:5.4,width:1.4,rotation:0,kind:'swing'}]:[
          {id:'f1-air-shower-entry',x:-13.9,z:11.4,width:1.2,rotation:0,kind:'swing'},
          {id:'f1-small-pack-personnel-entry',x:-4.4,z:13.2,width:1.4,rotation:Math.PI/2,kind:'swing'},
          {id:'f1-cip-entry',x:-1.7,z:12.2,width:.8,rotation:0,kind:'swing'}])],
      stairs:stairs.map(stair=>stair.id==='front-stair'?{...stair,flights:two?4:1,stepsPerFlight:two?9:1,rise:two?6:.1}:stair),
      columns:[...perimeterColumns.filter(c=>c.z!==0||Math.abs(c.x)>15),
        ...[-5.125,5.125].flatMap(x=>[-10,-5,0,5,10].map(z=>column(x,z)))].map(c=>({...c,height:two?5.8:5.65})),
      mainPlatform:two?{minX:-13.2,maxX:-7.2,minZ:-10.4,maxZ:7,height:1.2,stairLength:1.2,stairEnds:['minZ','maxZ'],deckOpenings:FLOOR3_MIXER_Z.map((z,i)=>({x:HOPPER_X-HOPPER_DRUMS[i].side*1.12,z,radius:HOPPER_DRUMS[i].radius+.06}))}:null,
      hopperDuctConnections:two?FLOOR3_MIXER_Z.map((z,i)=>{const {side,radius}=HOPPER_DRUMS[i];return{z,x:HOPPER_X-side*(1.12+radius*.5),warmX:HOPPER_X-side*1.12};}):null,
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
function lineItem(level, key, name, type, x, z, width, depth, height = 1.8, extra = {}) {
  const plan = workplacePlan(level);
  return Object.freeze({
    id: `packaging-f${level}-${key}`, name, tag: name, type: `packaging-${type}`, floor: 'packaging', floorLevel: level,
    position: [x, 0, z], rotation: 0, width, depth, height, labelHeight: height + .35, platformHeight: 0,
    parts: ['본체·지지 구조', '처리·투입부', '구동·배출·부속'],
    photos: [plan], photo: plan, photoCaptions: allCaptions, summary: name, confidence: '층별 도면 배치 · 외형 재현', details: [],
    ...extra,
  });
}
const floor1Equipment=[
  lineItem(1,'rotary-1','로터리 1호기 포장기','rotary-packer',-10.1,-7.7,3.1,2.2,3.1,{rotaryVariant:'rotary1'}),
  lineItem(1,'rotary-2','로터리 2호기 포장기','rotary-packer',-10.1,-4.8,3.1,2.2,3.1,{rotaryVariant:'rotary2'}),
  lineItem(1,'vertical','버티컬 2호기 포장기','vertical-packer',-10.1,-1.7,2.9,2.4,3.5),
  lineItem(1,'bag-filler','지대백 포장기','bag-filler',-10.1,5.3,2.9,2.1,3.1),
  ...[-7.7,-4.8,-1.7].map((z,i)=>lineItem(1,`check-${i+1}`,`중량선별기 ${i+1}`,'checkweigher',-6.5,z,2.1,1.1,1.3,{weigherVariant:['rotary-white','rotary-steel','vertical-steel'][i]})),
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
  ...FLOOR3_MIXER_Z.map((z,i)=>lineItem(2,`hopper-${i+1}`,`호퍼 ${i+1} · ${['로타리1','버티컬1','버티컬2','로타리2(지대)'][i]}`,'hopper',HOPPER_X,z,4.7,2.6,5,{platformHeight:1.2,
    drumHeight:HOPPER_DRUMS[i].height,drumRadius:HOPPER_DRUMS[i].radius,sieveSide:HOPPER_DRUMS[i].side,feedX:FLOOR3_MIXER_X-HOPPER_X,ceiling:5.35,placementRevision:FLOOR3_REVISION,planRebuild:true,
    parts:['교반 호퍼·발판','구동부·덮개','진동채 작업대·공급관'],
    summary:`${['로타리1','버티컬1','버티컬2','로타리2(지대)'][i]} 라인의 교반 호퍼입니다. 3층 믹서에서 내려온 배관이 크림색 작업대의 진동채를 거쳐 원통 호퍼로 들어갑니다.`,
    details:['구 카드 H9-M-006~009 「라인 진동채, 호퍼」 · 위치 9동 2층. 교반 감속기 2.2 kW(1/90).']})),
  ...[-8.4,-4.1,.2,3.8].flatMap((z,row)=>[8.7,12.7].map((x,col)=>lineItem(2,`stick-${row*2+col+1}`,`스틱 ${row*2+col+1}호기`,'stick-filler',x,z,2.0,2.4,2.9,{lineNumber:row*2+col+1,
    photos:[workplacePlan(2),sourcePhoto('stick-packer-elevations'),sourcePhoto('stick-packer-plan')],
    operatorSide:[1,4,5,7].includes(row*2+col+1)?'left':'right',
    details:[`9동 스틱 청정실 과거 카드 H9-M-${String(34+row*2+col).padStart(3,'0')}에 기록된 호기입니다. 배치는 9동 작업장평면도를 따릅니다.`]}))),
  ...[-12.6,-8.5].map((x,i)=>lineItem(2,`v-mix-${i+1}`,`V-MIX ${i+1}`,'v-mixer',x,12.6,2.8,1.8,2.5)),
  ...[-6.2,2.5,7.3].map((z,i)=>lineItem(2,`xray-${[1,3,2][i]}`,`X-Ray ${[1,3,2][i]}호기`,'xray',[-1,1.3,-.5][i],z,1.8,1.25,1.8,{rotation:Math.PI/2,previousRotation:0})),
  ...[-4.4,4.3,9.1].map((z,i)=>lineItem(2,`check-${i+1}`,`중량선별기 ${i+1}`,'checkweigher',[-1,1.3,-.5][i],z,1.8,1.1,1.3,{rotation:Math.PI/2,previousRotation:0})),
  ...[-2.7,6,10.8].map((z,i)=>lineItem(2,`taper-${i+1}`,`${['A','C','B'][i]}라인 테이핑기`,'case-sealer',[-1,1.3,-.5][i],z,1.65,1.1,1.8,{tapeVariant:i===1?'cyan':'cream',rotation:Math.PI/2,previousRotation:0})),
  lineItem(2,'incase','인케이스 포장기','carton-erector',2.5,-7,1.8,1.5,2),
  lineItem(2,'nitrogen','질소발생기','service-cabinet',5.6,-13.8,.98,1.43,2,{
    details:['H9-M-045 · 028번 4면 사진과 전경에서 전면 계기 3개, 유량계, 점검문과 하부 통풍구를 확인했습니다. 외함 크기는 사진 비례 추정입니다.',
      '가스테크(주) ADSORPTION TANK 명판의 설계압력은 0.97 MPa, 설계온도는 50 °C, 수압시험압력은 1.47 MPa입니다. 이 값은 내부 흡착탱크 사양입니다.'],
  }),
  lineItem(2,'hot-air','열풍기','service-cabinet',11.4,-13.8,2,1.2,2.5),
  ...[-8.4,.2].map((z,i)=>lineItem(2,`hotmelt-${i+1}`,`핫멜트 ${i+1}`,'service-cabinet',5.9,z,.7,.7,1.3,{serviceVariant:'hotmelt',details:['도면에 표기된 핫멜트 장치로, 용융부와 가열 호스는 설비 형식에 따른 근사 형상입니다.']})),
  ...[-8.4,.2].map((z,i)=>lineItem(2,`printer-${i+1}`,`날인기 ${i+1}`,'service-cabinet',6.7,z,.6,.6,1.2,{serviceVariant:'printer'})),
  lineItem(2,'hygiene','위생전실 세정설비','hygiene-station',6.2,6.5,1.8,.7,2.1),
];
const floor3Equipment=FLOOR3_EQUIPMENT.map(item=>({...item,photoCaptions:allCaptions}));
export const PACKAGING_EQUIPMENT=Object.freeze([...floor1Equipment,...floor2Equipment,...floor3Equipment].map(bindTeam2Card));
