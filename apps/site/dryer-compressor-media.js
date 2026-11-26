// Field-photo numbers follow capture order, independent of the filename used for each web copy.
const captureTimes = '134536 134544 134555 134612 135511 135531 135538 135555 135608 135923 135934 135943 135954 135959 140027 140311 140320 140350 140359 140428 140432 140447 140456 140500 140506 140515 140521 140532 140542 140546 140551 140604 140626 140630 140639 140654 140722 140731 140738 140746 140803 140809 140827 140836 140842 140852 140859 140915 140921 140955 141000 141006 141011 141016 141024 141028 141033 141039 141046 141054 141102 141105 141111 141121 141126 141130 141136 141148 141154 141220 141225 141233 141242 141250 141257 141306 141311 141319 141323 141330 141343 141356 141403 141410 141419 141436 141451 141455 141521 141530 141542 141548 141551 141558 141601 141604 141618 141624 141626 141631'.split(' ');
export const COMPRESSOR_MEDIA = captureTimes.map((time,index) => ({
  number: index + 1,
  original: '20261124_' + time + '.jpg',
  path: './assets/photos/compressor/field-' + String(index + 1).padStart(3, '0') + '.jpg',
}));
export const COMPRESSOR_PLAN_IMAGE = './assets/drawings/dryer/dryer-floor-plan-3f.png';
// Elapsed seconds in the November 25, 10:18:36 clip. Inspection poses are
// approximate floor-plan registrations. Equipment-local poses follow saved
// moves and turns. Other poses use the floor axes and height above its slab.
export const HALL_WALK_FRAMES = [
  { seconds:45, short:'이송 구동부', caption:'경광등 아래의 두 수직 구동부와 승강기', equipment:'f3-holding' },
  { seconds:125, short:'호퍼 출구', caption:'원추 호퍼 아래 볼트 플랜지와 검은 연결부', equipment:'f3-holding' },
  { seconds:155, short:'호퍼와 점검대', caption:'나란한 원추 호퍼 두 기와 황색 난간, 하부 디스크 이송로', equipment:'f3-holding',
    view:{ local:true, origin:[-2.7,2.7], target:[0,1.68,0] } },
  { seconds:170, short:'보관실 출입문', caption:'셔터 옆에서 본 황색창이 있는 보관실 문',
    view:{ origin:[-.32,-10.23], target:[.55,1.95,-11.03] } },
  { seconds:176, short:'보관실 안쪽', caption:'흰 선반에 놓인 상자와 용기' },
  { seconds:215, short:'공정실 진입', caption:'흰 연결문 너머의 제어함과 오른쪽 금속 계단',
    view:{ origin:[-3.35,-5.72], target:[-3.35,1.8,1.3], openDoor:'dryer-route:3:third-process-link' } },
  { seconds:255, short:'각형 설비', caption:'가로 보강대가 있는 스테인리스 설비와 낮은 펌프', equipment:'f3-balance-tank' },
  { seconds:261, short:'판형 설비', caption:'창가의 판형 프레임과 옆의 원통형 탱크', equipment:'f3-sterilizer' },
  { seconds:276, short:'탱크 점검대', caption:'점검대의 탱크 상·하부와 난간, 발치의 구동부', equipment:'f3-feed-tank',
    view:{ local:true, origin:[3.8,.2], target:[0,1.48,0] } },
  { seconds:280, short:'GEA 함체', caption:'두 짝 스테인리스 함체의 전면과 옆 배관', equipment:'f3-homogenizer' },
  { seconds:290, short:'공정실 쪽 연결문', caption:'공정실에서 되돌아본 넓은 흰 문과 내장된 사람문, 오른쪽 확인창' },
].map(frame => ({
  ...frame, id:'process-hall-20261125-'+frame.seconds, category:'survey-dryer-process-hall', date:'11/25',
  time:String(Math.floor(frame.seconds/60)).padStart(2,'0')+':'+String(frame.seconds%60).padStart(2,'0'),
  path:'./assets/photos/evidence/dryer-process-hall-20261125/frame-'+String(frame.seconds).padStart(3,'0')+'s.jpg',
}));
export const COMPRESSOR_WALK_FRAMES = [
  ['old-1','11/12','09:31.25','흰 연결문','컨베이어 반환부에서 본 금속 테두리의 흰 여닫이문'],
  ['old-2','11/12','09:33.75','문 열림','촬영자가 오른쪽 손잡이를 잡고 두 작업구역 사이 문을 여는 순간'],
  ['old-3','11/12','09:35.50','문 너머 펌프','문을 지나 바로 보이는 노란 커플링 가드의 펌프와 스테인리스 각형 설비'],
  ['new-1','11/24','00:05','승강기','스테인리스 승강기와 바로 옆 조작반'],
  ['new-2','11/24','00:13','디스크 이송관','이송관 위 원추 호퍼와 공통 황색 난간 점검대'],
  ['new-3','11/24','00:16','계단참 방화문','포충기 옆의 회색 방화문. 이 문은 옥상으로 향하는 계단참으로 열린다.'],
].map(([key,date,time,short,caption])=>({id:'walk-'+key,path:'./assets/photos/compressor/walk-'+key+'.jpg',date,time,short,caption})).concat(HALL_WALK_FRAMES);
