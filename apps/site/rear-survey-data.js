// 11/11 rear walk with 11/12 close-up corrections. Exterior registration follows its continuous
// door/window sequence; dimensions remain estimated, not surveyed datums.
export const rearStairPhoto = seconds => `./photos/rear-stair/frame-${String(seconds).padStart(3,'0')}s.jpg`;
export const REAR_STAIR_PHOTOS = Object.freeze([3,7,10,16,25,28,31,34,37,40,43,52,55,64,70,79,82,100,106,109,118,127,136,139].map(rearStairPhoto));
export const REAR_STAIR_CAPTIONS = Object.freeze(Object.fromEntries([3,7,10,16,25,28,31,34,37,40,43,52,55,64,70,79,82,100,106,109,118,127,136,139].map(second => [rearStairPhoto(second),`2026.11.11 건물 뒤편·2팀 계단 입구 영상 · ${Math.floor(second/60)}:${String(second%60).padStart(2,'0')}`])));
const rear = Math.PI;
const latestSource = 'guardhouse-team2-video-20261112';
export const REAR_TOWER_SURVEY = Object.freeze({
  source:'rear-stair-video-20261111;guardhouse-team2-video-20261112', dimensionsMeasured:false, towerRearExtension:3.6,
  shaftBays:[
    {id:'high-east-stair-bay',x:11,back:-17,width:4.8,depth:6.7,height:40.4,roofHeight:.22},
    {id:'low-west-stair-bay',x:-5,back:-17,width:5.6,depth:3.6,height:13.3,roofHeight:.22},
  ],
  features:[
    {id:'high-east-stair-glazing',kind:'vertical-glazing',position:[11,.8,-17.12],yaw:rear,width:3.1,height:35.2,divisions:14,ventBands:[.085,.185,.36,.55,.72,.9],sourceTimes:[3,25,34,49]},
    {id:'low-west-stair-glazing',kind:'vertical-glazing',position:[-5,3.25,-17.13],yaw:rear,width:2.7,height:9.05,divisions:8,ventBands:[.2,.5,.8],source:latestSource,sourceTimes:[244,250,256],correction:'세로 유리 하단을 노란 출입문 처마 위로 올려 문과 겹치지 않음'},
    {id:'high-floor-shutter-bays',kind:'stacked-shutter-bay',position:[3,0,-17.15],yaw:rear,width:5.8,wallPlaneZ:-.15,
      levels:[{y:7.6,height:2.4},{y:13.6,height:2.4},{y:20.5,height:2.4},{y:26.5,height:2.4},{y:32.9,height:2.4}].map(level=>({...level,canopyDepth:1.25})),sourceTimes:[3,25,40]},
    {id:'rear-breakroom-single-door',kind:'glazed-entry',position:[23,0,-17.13],yaw:rear,width:1.15,height:2.25,leafCount:1,hingeSide:'right',wallPlaneZ:-.13,plateText:'1팀 2파트 휴게실',plateHistory:'영상 문패 생산 2팀 휴게실 · 사용자 확인 실제 1팀 2파트',canopy:{width:8.2,offsetX:3.1,depth:1.35,height:.25,elevation:3.1},ramp:{rise:.045,run:.85,width:1.4},sourceTimes:[7,10,16],canopyCorrection:'194/204초에서 휴게실·천공문·부자재 셔터를 함께 덮는 긴 차양. 벽면에 후단을 맞추고 3개 문 묶음 중심으로 이동. 외곽·간격은 모델 비례'},
    {id:'rear-perforated-pair',kind:'perforated-pair',position:[20.65,0,-17.13],yaw:rear,width:2,height:2.4,sourceTimes:[10,13]},
    {id:'rear-eastern-material-shutters',kind:'single-shutter',position:[17.55,0,-17.13],yaw:rear,width:2.8,height:2.8,plateText:'부자재 출입구',source:latestSource,sourceTimes:[194,204,210,214]},
    {id:'rear-unmarked-glass-pair',kind:'freight-elevator',position:[14,0,-17.15],yaw:rear,width:2.2,height:2.5,leafCount:2,openingDirection:'left-telescopic',cabinDepth:2.3,wallPlaneZ:-.15,canopy:{width:3.3,offsetX:-.45,depth:1.7,height:.45,elevation:3.4},source:latestSource,sourceTimes:[220,226,228,232.25,233,234.5,237,237.25,237.75],correction:'232초 상부 호출버튼 누름→234.5초 스텐문 좌측 모임→237초 은색 캐빈·체크판 바닥 관찰. 좌우대칭 슬라이드 추정을 편측 겹침식으로 정정',canopyCorrection:'사용자 여기는.png의 계단창 침범 해소. 차양 끝 X12.8로 창틀 X12.5925와 약0.21m 이격, 문·호출함 위치 유지. 비실측 모델 보정'},
    {id:'rear-western-material-shutters',kind:'twin-shutter',position:[5,0,-17.15],yaw:rear,width:3.3,height:3.1,wallPlaneZ:-.15,plateText:'부자재 출입구',canopy:{width:4.5,depth:1.15,height:.28},sourceTimes:[34,37,40]},
    {id:'rear-closed-stainless-housing',kind:'utility-housing',position:[1.3,0,-17.45],yaw:rear,width:2.7,height:1.85,depth:.85,wallPlaneZ:-.45,sourceTimes:[43,49,58],placementCorrection:'노란문 옆 보온배관과 하우징이 겹치지 않도록 쌍셔터 전 빈 벽 구간으로 정리. 영상 비례 위치이며 실측 아님'},
    {id:'rear-two-insulated-mains',kind:'insulated-floor-mains',position:[-1.95,0,-17.42],yaw:rear,width:3,height:.85,sourceTimes:[52,55],placementCorrection:'250초에서 배관은 노란문 옆에 있고 문앞을 막지 않음. 문틀과 스텐 하우징 사이로 이동·폭 보정'},
    {id:'rear-yellow-stair-door',kind:'opaque-entry',position:[-5,0,-17.2],yaw:rear,width:2.3,height:2.5,leafCount:2,wallPlaneZ:-.2,paint:'yellowDoor',canopy:{width:3.3,depth:1.05,height:.33,elevation:2.8},source:latestSource,sourceTimes:[244,250,254],correction:'낮은 서쪽 계단 세로유리 바로 아래 노란 불투명 양개문'},
    {id:'rear-elevator-roof-condenser',kind:'canopy-condenser',position:[14.6,3.975,-17.55],yaw:rear,width:.85,height:1.5,depth:.35,fanCount:2,source:latestSource,sourceTimes:[222,224,226],mountingCorrection:'80mm 받침 바닥을 승강기 처마 마감 상면3.895m에 맞춤. 222/226초의 상하 팬2개를 반영. 외곽은 영상 비례 근사'},
    {id:'rear-breakroom-roof-condenser',kind:'canopy-condenser',position:[23.5,3.475,-17.5],yaw:rear,width:.9,height:1.0,depth:.4,source:latestSource,sourceTimes:[194,204,212],mountingCorrection:'80mm 받침 바닥을 보정된 휴게실 처마 마감 상면3.395m에 맞춤. 영상 비례 근사'},
    {id:'rear-wall-protection-and-drains',kind:'apron-hardware',position:[0,0,-17.6],yaw:rear,railSegments:[[-25.2,-23.9],[-16.6,-15.5],[-12.5,-7.6],[-3.8,-2.9],[.3,3.4]],drains:[[-24.5,2.1],[-17.5,2.1]],hatches:[[-9.4,1.8], [5,1.8]],source:latestSource,sourceTimes:[194,204,216,218,228,236,250],clearanceCorrection:'스텐 하우징 뒤를 관통하던 낮은 가드 구간은 양옆으로 분리'},
    {id:'high-east-bay-downpipe',kind:'downpipe',position:[12.45,0,-17.2],height:39,yaw:rear,sourceTimes:[25,34],clearanceCorrection:'승강기 개구부와 캐빈을 관통하지 않도록 계단창 가장자리로 이격'},
    {id:'low-bay-downpipe',kind:'downpipe',position:[-7.45,0,-17.2],height:12.8,yaw:rear,sourceTimes:[61,64]},
  ],
});
export const REAR_PACKAGING_SURVEY = Object.freeze({
  source:'rear-stair-video-20261111;guardhouse-team2-video-20261112',dimensionsMeasured:false,minimumObservedCounts:{upper:4,ground:7,wall:2},
  verticalReference:{source:'9동 A-11 주단면도 + 2026-11-12 상향 촬영 대조',datum:'1층 FL=0인 기존 실내 모델 기준',floorLevels:[0,6,12.15],eaveHeight:18.15,ridgeHeight:19.51,thirdFloorWindowSill:13.15,secondFloorWindowSill:7,windowHeight:1.5,siteSurveyConfirmed:false},
  features:[
    {id:'team2-stair-glass-entry',kind:'recessed-entry',position:[9.1,0,-1.65],yaw:-Math.PI/2,width:2.2,height:2.5,leafCount:2,recessDepth:1.05,fixedSideLight:.3,wallPlaneZ:0,canopy:{width:3.5,depth:1.45,height:.38,elevation:2.9},ramp:{rise:.055,run:1.3,width:2.65},returnMass:{width:3.45,depth:6.4,height:18.15,heightBasis:'A-11 층고와 신규 상향 영상에 맞춘 본체 처마 높이. 돌출부 외곽은 모델 근사'},source:latestSource,sourceTimes:[263.5,269.5,273.5,274,281.5,282,284],mountingWall:'실외기 긴 후면벽에 직각인 돌출 계단매스 서쪽 리턴면',placementMeasured:false,entryCondenserCorrespondence:'문 옆 지상 실외기는 기존 지상열 끝 장비와 중복 가능하므로 별도 추가하지 않음'},
    {id:'rear-hvac-steel-platform',kind:'steel-hvac-platform',position:[-1.5,0,-1.4],yaw:rear,width:13.4,depth:2.3,elevation:3.4,wallPlaneZ:-1.4,ladder:{x:4.95,z:1.4,width:.6,cageStart:1.8,cageRadius:.43},placementAdjustment:{source:'user-requested-door-clearance-20261112',offsetRootX:-1.5,measured:false,basis:'사용자 확인한 2팀 입구를 고정하고 실외기 가대·장비·사다리 전체를 반대쪽으로1.5m 이격한 시각 여유 조정. 영상 실측 좌표가 아님'},
      upperUnits:[-4.35,-1.45,1.45,4.35].map((x,index)=>({id:`upper-${index+1}`,x,z:-.1,width:1.8,height:1.85,depth:.9,sourceTimes:[79,82,121,127]})),
      groundUnits:[-6.4,-4.1,-1.8,.5,2.8,5.1,7.4].map((x,index)=>({id:`ground-${index+1}`,x,z:.1,width:1.65,height:1.2,depth:.98,fanCount:2,sourceTimes:[82,85,100,106,109,133]})),
      wallUnits:[{id:'wall-1',x:8.8,y:1.75,z:-1.09,width:.8,height:1.25,depth:.38,fanCount:2,sourceTimes:[109]},{id:'wall-2',x:10,y:2.75,z:-1.09,width:.8,height:1.25,depth:.38,fanCount:2,sourceTimes:[109]}],sourceTimes:[79,82,100,118,127,133]},
    {id:'rear-open-square-exhaust-hood',kind:'wall-hood',position:[-4.9,17.3,-.23],yaw:rear,width:.95,height:.85,depth:.7,wallPlaneZ:-.23,riser:{bottom:.8,top:13,width:.42,depth:.28},source:latestSource,sourceTimes:[266,270,276,286],heightBasis:'A-11 처마와 영상 비례. 270초에서 상부 후드와 아래 사각 커버 사이의 상부창이 연속되므로 수직 커버는 상부창 아래13.0m에서 종료. 덕트 연결·기능 미확정',mountingCorrection:'외벽/창틀 전면을 관통하지 않도록 뒤끝을 벽면보다230mm 이격하고 벽체 고정대를 표현'},
    {id:'packaging-rear-upper-window-band',kind:'strip-windows',position:[-.5,13.15,-.1],yaw:rear,width:26.5,height:1.5,panes:18,source:latestSource,sourceTimes:[270,276,286],heightBasis:'A-11 창 밑면13.15 / 중심13.9 · position은밑면'},
    {id:'packaging-rear-mid-window-band',kind:'strip-windows',position:[-.5,7,-.1],yaw:rear,width:26.5,height:1.5,panes:18,pierGaps:[{x:4.4,width:.62}],source:latestSource,sourceTimes:[270,276,286],heightBasis:'A-11 창 밑면7.0 / 중심7.75 · position은밑면. 270/286초에서 수직 커버 옆 창 사이 불투명 구간을 유지'},
    {id:'packaging-rear-rain-pipe',kind:'downpipe',position:[1.2,0,-.3],wallPlaneZ:-.3,yaw:rear,height:18,source:latestSource,sourceTimes:[266,270,286],heightBasis:'A-11 처마와 영상 수직 우수관 비례',mountingCorrection:'기존X는 유지하고 관 뒷면이 창틀 외측보다40mm 앞에 오도록 이격. 벽판과 관을 잇는 스탠드오프 클립 표현'},
  ],
});
