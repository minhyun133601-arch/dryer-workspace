// Values read from the two NBP KOREA sheets for KHMA-H760, dated 2019.04.22.
// Every length is in millimetres. The 3D model derives its positions from here.
export const DRAWING_INFO = Object.freeze({
  maker: 'NBP KOREA',
  project: 'SIDE PLATE TYPE BURNER SYSTEM',
  model: 'KHMA-H760',
  capacity: '2,400,000 kcal/h',
  customer: '희창유업',
  drawn: 'K.Y.J',
  date: '2019.04.22',
  scale: 'N/S',
  revision: '0',
});

export const DRAWING_SHEETS = Object.freeze({
  burner: { title: 'GAS BURNER SYSTEM', short: '버너 시스템 도면', width: 2400, height: 1750, source: 'KakaoTalk_20261105_105315975_01.jpg' },
  piping: { title: 'PIPING DIAGRAM', short: '배관도 · 부품표', width: 2400, height: 1747, source: 'KakaoTalk_20261105_105315975.jpg' },
});

const repeat = (count, value) => Array.from({ length: count }, () => value);

export const DIMENSIONS = Object.freeze({
  // Burner sheet, plan view: outer flange with its slot pitch.
  flangeWidth: 1350,
  flangeDepth: 1700,
  flangeWidthPitch: Object.freeze([25, ...repeat(10, 130), 25]),
  flangeDepthPitch: Object.freeze([25, 60, ...repeat(10, 153), 60, 25]),
  slotMiddle: 50,
  slotCorner: 30,
  slotRadius: 6,
  // Burner sheet, plan and side views: the chamber itself.
  innerWidth: 1154,
  innerDepth: 1504,
  wall: 3,
  height: 1400,
  pipeBelowTop: 543,
  pipeAboveBottom: 857,
  wallToPipe: 490.4,
  // Burner sheet: where the valve train sits against the flange.
  inletToFlange: 988.7,
  overallWidth: 2338.7,
  flangeToHoseAxis: 189.5,
  // Piping sheet: valve train chain from the inlet flange face.
  trainLength: 1475,
  trainChain: Object.freeze([16, 162, 236, 141, 156, 114, 114, 156, 59, 120, 183, 16]),
  flangeThickness: 16,
  firstGaugeFromInlet: 105.2,
  secondGaugeFromRegulator: 70.2,
  lastGaugeFromOutlet: 99,
  // Piping sheet: manifold chain from the chamber wall to the valve train axis.
  stubSpacing: 604.5,
  stubLength: 397.2,
  wallToStubJoint: 110,
  stubFlange: 12,
  jointToElbowFace: 38,
  stubJointToHoseFlange: 190.8,
  hoseLength: 130,
  hoseFlange: 16,
  teeFlangePair: 30,
  header: Object.freeze({ side: 123.7, reducer: 38.1, middle: 165.1 }),
  elbow50CenterToFace: 76.2,
  elbow40CenterToFace: 57.15,
  // Piping sheet: pilot line, measured from the pilot riser.
  pilotRiserToBend: 132.9,
  pilotBendRadius: 49,
  pilotRegulatorStart: 133,
  pilotRegulatorLength: 108,
  pilotToFirstSolenoid: 367,
  pilotSolenoid: 55,
  pilotSolenoidGap: 119,
  pilotToSocket: 139,
  pilotGaugeToSocket: 49,
});

// The chain is two millimetres shorter than the stated overall length. The
// centre flange pair is the only joint left, so a gasket is the likely reason.
export const TRAIN_GASKET_ALLOWANCE = DIMENSIONS.trainLength - DIMENSIONS.trainChain.reduce((sum, value) => sum + value, 0);

export const DRAWING_GROUPS = Object.freeze([
  { id: 'main', name: '메인 가스', hint: '가스 입구 → 조정 → 차단 → 유량 조절' },
  { id: 'pilot', name: '파일럿', hint: '점화용 가스 라인' },
  { id: 'manifold', name: '분기 배관', hint: '50A → 플렉시블 호스 → 40A 2개' },
  { id: 'burner', name: '버너·챔버', hint: '챔버 안쪽 구조와 벽면 부속' },
  { id: 'air', name: '연소공기', hint: '연소팬과 공기 경로' },
]);

export const BASIS = Object.freeze({
  bom: { label: '도면 부품표', note: '도면의 번호·규격·제조사' },
  named: { label: '도면 명칭·치수', note: '번호는 없지만 명칭이나 치수가 도면에 있음' },
  shape: { label: '도면 외형 판독', note: '명칭이 없어 그려진 형상으로 해석' },
  photo: { label: '현장 사진 참고', note: '도면 범위 밖' },
});

export const FIELD_STATUS = Object.freeze({
  match: { label: '현장 일치', tone: 'good' },
  differs: { label: '현장 다름', tone: 'warn' },
  unread: { label: '명판 미확인', tone: 'mute' },
});

// `sheet` frames the part on a drawing: normalized centre and framed width.
// `photo` is a key of furnacePhotos in furnace-detail.js.
export const DRAWING_PARTS = Object.freeze([
  { id: '1', group: 'main', basis: 'bom', name: '주 가스 배관', original: 'MAIN GAS PIPE', size: '50A', maker: 'K.S', place: '입구 플랜지에서 조절밸브 뒤 플랜지까지, 전체 1475', role: '가스 입구부터 버너 앞까지 이어지는 50A 주배관입니다. 플랜지와 나사 이음으로 구간이 나뉩니다.', sheet: { key: 'piping', x: .32, y: .735, w: .56 }, photo: 'gas' },
  { id: '2', group: 'main', basis: 'bom', name: '입구 압력계', original: 'GAUGE', size: '1 kg/cm²', maker: 'KONICS', place: '입구 플랜지에서 105.2', role: '조정기로 들어가기 전의 가스 압력을 표시합니다.', sheet: { key: 'piping', x: .135, y: .665, w: .12 } },
  { id: '3', group: 'main', basis: 'bom', name: '입구 계기 볼밸브', original: 'BALL VALVE', size: '10A', maker: 'K.S', place: '②번 압력계 아래', role: '②번 압력계로 가는 가스를 끊는 소구경 볼밸브입니다.', sheet: { key: 'piping', x: .135, y: .705, w: .12 } },
  { id: '4', group: 'main', basis: 'bom', name: '가스 조정기', original: 'REGULATOR', size: '#311550, 50A', maker: 'PLOTRO', place: '입구에서 178~414 (길이 236)', role: '입구 압력을 버너에서 쓰는 압력으로 낮춰 일정하게 유지합니다.', field: { status: 'unread', text: '외형은 일치합니다. 현장 표찰은 「GOVERNOR」까지만 보여 모델과 제조사는 사진으로 확인하지 못했습니다. 제조사는 도면 표기 그대로 적었습니다.' }, sheet: { key: 'piping', x: .19, y: .69, w: .17 }, photo: 'regulator' },
  { id: '5', group: 'main', basis: 'bom', name: '조정기 후단 압력계', original: 'GAUGE', size: '2000 mmAq, Ø75', maker: 'KONICS', place: '조정기 끝에서 70.2', role: '조정기를 지난 뒤의 가스 압력을 표시합니다.', field: { status: 'match', text: '현장 눈금 0~20 kPa(2000 mmAq 상당)로 도면과 맞습니다.' }, sheet: { key: 'piping', x: .245, y: .655, w: .12 }, photo: 'switchlow' },
  { id: '6', group: 'main', basis: 'bom', name: '조정기 후단 압력 스위치', original: 'PRESSURE S/W', size: 'SAPS-50V', maker: 'NBPKOREA', place: '⑤번 압력계 아래', role: '조정기 뒤 가스 압력을 감시하는 스위치입니다. 설정값과 동작 조건은 도면에 없습니다.', field: { status: 'differs', text: '현장에는 DUNGS 압력 스위치가 달려 있습니다. 모델명은 사진 각도 때문에 읽지 못했습니다. 교체 부품은 현장 명판으로 확인하세요.' }, sheet: { key: 'piping', x: .25, y: .69, w: .12 }, photo: 'switchlow' },
  { id: '7', group: 'main', basis: 'bom', name: '조정기 후단 볼밸브', original: 'BALL VALVE', size: '10A', maker: 'K.S', place: '⑥번 스위치 아래', role: '⑤⑥번 계기로 가는 가스를 끊는 소구경 볼밸브입니다.', sheet: { key: 'piping', x: .245, y: .72, w: .12 }, photo: 'switchlow' },
  { id: '8', group: 'main', basis: 'bom', name: '1차 차단밸브', original: 'SHOT-OFF V/V', size: 'VMR6', maker: 'ELEKTROGAS', place: '입구에서 555~711 (길이 156)', role: '직렬로 놓인 전자식 차단밸브 2개 중 앞쪽입니다. 도면에는 SHOT-OFF V/V로 적혀 있습니다.', field: { status: 'match', text: '명판 elektrogas VMR6-2 Rp2 · 230 VAC 50/60 Hz · 30 W(기동 120 W) · Pmax 200 mbar로 도면과 맞습니다.' }, sheet: { key: 'piping', x: .29, y: .695, w: .13 }, photo: 'vmr' },
  { id: '9', group: 'main', basis: 'bom', name: '2차 차단밸브', original: 'SHOT-OFF V/V', size: 'VMR6', maker: 'ELEKTROGAS', place: '입구에서 941~1097 (길이 156)', role: '직렬로 놓인 전자식 차단밸브 2개 중 뒤쪽입니다.', field: { status: 'match', text: '명판 elektrogas VMR6-2 Rp2로 도면과 맞습니다.' }, sheet: { key: 'piping', x: .405, y: .695, w: .13 }, photo: 'vmr' },
  { id: '10', group: 'main', basis: 'bom', name: '유량 조절 모터', original: 'CONTROL MOTOR', size: 'AR3C2002-SE2A2', maker: 'ECONEX', place: '⑪번 조절밸브 위', role: '링크를 움직여 ⑪번 조절밸브의 열림 정도를 바꿉니다.', field: { status: 'differs', text: '현장 명판은 Honeywell Modutrol IV M7284A1004입니다(120 V, 50/60 Hz, 15 VA, 행정 90°, 30~60초). 도면의 ECONEX 모델과 다르므로 교체 부품은 현장 명판을 기준으로 확인하세요.' }, sheet: { key: 'piping', x: .46, y: .675, w: .13 }, photo: 'modutrol' },
  { id: '11', group: 'main', basis: 'bom', name: '유량 조절밸브', original: 'CONTROL V/V', size: 'NVP-50', maker: 'NBPKOREA', place: '입구에서 1156~1276 (길이 120)', role: '버너로 가는 가스량을 조절합니다. 샤프트가 앞쪽으로 나와 링크로 모터와 연결됩니다.', field: { status: 'unread', text: '현장에서 눈금판과 크랭크 링크는 보이지만 모델 표기는 확인하지 못했습니다.' }, sheet: { key: 'piping', x: .46, y: .745, w: .13 }, photo: 'valve' },
  { id: '12', group: 'main', basis: 'bom', name: '버너 전단 압력계', original: 'GAUGE', size: '1000 mmAq, Ø75', maker: 'KONICS', place: '출구 플랜지에서 99', role: '조절밸브를 지난 뒤, 버너로 들어가기 전의 가스 압력을 표시합니다.', field: { status: 'match', text: '현장 눈금 0~10 kPa(1000 mmAq 상당)로 도면과 맞습니다.' }, sheet: { key: 'piping', x: .505, y: .655, w: .12 }, photo: 'switchhigh' },
  { id: '13', group: 'main', basis: 'bom', name: '버너 전단 압력 스위치', original: 'PRESSURE S/W', size: 'SAPS-150V', maker: 'NBPKOREA', place: '⑫번 압력계 아래', role: '버너 앞 가스 압력을 감시하는 스위치입니다. 설정값과 동작 조건은 도면에 없습니다.', field: { status: 'differs', text: '현장 명판은 DUNGS GW 150 A6(Pmax 500 mbar)입니다. 도면의 SAPS-150V와 다르므로 교체 부품은 현장 명판을 기준으로 확인하세요.' }, sheet: { key: 'piping', x: .51, y: .69, w: .12 }, photo: 'switchhigh' },
  { id: '14', group: 'main', basis: 'bom', name: '버너 전단 볼밸브', original: 'BALL VALVE', size: '10A', maker: 'K.S', place: '⑬번 스위치 아래', role: '⑫⑬번 계기로 가는 가스를 끊는 소구경 볼밸브입니다.', sheet: { key: 'piping', x: .505, y: .72, w: .12 }, photo: 'switchhigh' },

  { id: '15', group: 'pilot', basis: 'bom', name: '파일럿 가스 배관', original: 'PILOT GAS PIPE', size: '15A', maker: 'K.S', place: '주배관 입구 쪽에서 분기, 주배관에서 약 212 떨어져 평행', role: '주배관 입구 쪽에서 갈라져 점화용 파일럿 가스를 보내는 15A 배관입니다.', sheet: { key: 'piping', x: .27, y: .355, w: .34 }, photo: 'pilot' },
  { id: '16', group: 'pilot', basis: 'bom', name: '파일럿 유니언', original: 'UNION', size: '15A', maker: 'K.S', place: '⑰번 조정기 앞', role: '배관을 돌리지 않고 풀 수 있게 하는 이음입니다.', sheet: { key: 'piping', x: .155, y: .35, w: .1 }, photo: 'regulator' },
  { id: '17', group: 'pilot', basis: 'bom', name: '파일럿 조정기', original: 'PILOT REGULATOR', size: '325-3M', maker: 'MAXITROL', place: '길이 108', role: '파일럿 가스 압력을 낮춰 일정하게 유지합니다.', field: { status: 'unread', text: '현장에 같은 위치의 소형 조정기가 보이지만 명판은 확인하지 못했습니다.' }, sheet: { key: 'piping', x: .182, y: .35, w: .1 }, photo: 'regulator' },
  { id: '18', group: 'pilot', basis: 'bom', name: '파일럿 전자밸브 1', original: 'PILOT SOL V/V', size: 'E6GA10, 15A', maker: 'BRAHMA', place: '⑰번에서 367 뒤, 폭 55', role: '파일럿 가스를 열고 닫는 전자밸브입니다. 직렬 2개 중 앞쪽입니다.', sheet: { key: 'piping', x: .315, y: .35, w: .1 } },
  { id: '19', group: 'pilot', basis: 'bom', name: '파일럿 전자밸브 2', original: 'PILOT SOL V/V', size: 'E6GA10, 15A', maker: 'BRAHMA', place: '⑱번에서 119 뒤, 폭 55', role: '파일럿 가스를 열고 닫는 전자밸브입니다. 직렬 2개 중 뒤쪽입니다.', sheet: { key: 'piping', x: .368, y: .35, w: .1 } },
  { id: '20', group: 'pilot', basis: 'bom', name: '파일럿 압력계', original: 'GAUGE', size: '1000 mmAq, Ø75', maker: 'KONICS', place: '소켓에서 49 앞', role: '파일럿 라인 끝에서 가스 압력을 표시합니다.', sheet: { key: 'piping', x: .402, y: .35, w: .1 } },
  { id: '21', group: 'pilot', basis: 'bom', name: '파일럿 입구 볼밸브', original: 'BALL VALVE', size: '15A', maker: 'K.S', place: '파일럿 분기 직후', role: '파일럿 라인 전체를 손으로 끊는 볼밸브입니다.', sheet: { key: 'piping', x: .128, y: .39, w: .1 }, photo: 'pilot' },
  { id: 'D', group: 'pilot', basis: 'named', name: '15A 소켓·플렉시블 호스', original: '15A SOCKET WITH FLEXIBLE HOSE', size: '15A × 600L', maker: '도면 미기재', place: '파일럿 라인 끝 → PILOT GAS 포트', role: '파일럿 배관 끝과 벽면 포트를 잇는 호스입니다. 호스가 지나는 경로는 도면에 없어 3D에서는 개략으로 그렸습니다.', sheet: { key: 'piping', x: .425, y: .29, w: .2 } },

  { id: 'A', group: 'manifold', basis: 'named', name: '50A 플렉시블 호스', original: 'FLEXIBLE HOSE', size: '50A × 130L', maker: '도면 미기재', place: '챔버 폭 중심선, 플랜지 면 간격 130', role: '주배관과 분기 헤더 사이에서 열팽창과 진동을 받아 주는 호스입니다.', sheet: { key: 'piping', x: .587, y: .37, w: .14 }, photo: 'manifold' },
  { id: 'B', group: 'manifold', basis: 'named', name: '분기 헤더', original: '50A TEE · 40A', size: '50A → 40A ×2', maker: '도면 미기재', place: '123.7 + 38.1 + 165.1 + 38.1 + 123.7', role: '가운데 50A 티에서 좌우 40A로 줄여 H 버너의 양쪽 다리로 가스를 나눕니다.', sheet: { key: 'piping', x: .59, y: .3, w: .25 }, photo: 'manifold' },
  { id: 'C', group: 'manifold', basis: 'named', name: '40A 버너 인입관 ×2', original: '40A · 챔버부 용접', size: '40A, 간격 604.5', maker: '도면 미기재', place: '플랜지 이음에서 안쪽 끝까지 397.2, 벽에서 플랜지 이음까지 110', role: '챔버 벽을 뚫고 H 버너로 들어가는 관입니다. 도면에 「챔버부 용접」으로 표기되어 벽과 함께 고정된 부분입니다.', sheet: { key: 'piping', x: .59, y: .17, w: .28 }, photo: 'manifold' },

  { id: 'E', group: 'burner', basis: 'shape', name: 'H형 버너 헤드', original: '명칭 미기재', size: '다리 2개 × 153 모듈 6개', maker: 'NBP KOREA 도면', place: '챔버 중앙, 다리 중심 간격 604.5', role: '챔버 안에서 불꽃이 만들어지는 H자형 버너입니다. 긴 다리 2개와 가운데 연결부로 되어 있습니다. 이름은 도면에 없어 모양을 따라 붙였고, 세부 단면은 개략입니다.', sheet: { key: 'burner', x: .325, y: .3, w: .24 } },
  { id: 'F', group: 'burner', basis: 'named', name: '챔버·상하 플랜지', original: '챔버', size: '내부 1154 × 1504, 높이 1400', maker: 'NBP KOREA 도면', place: '플랜지 외곽 1350 × 1700', role: '버너가 들어 있는 사각 챔버입니다. 플랜지 둘레에 볼트용 장공이 있습니다(중간 50, 네 모서리 30, R6).', sheet: { key: 'burner', x: .325, y: .28, w: .36 }, photo: 'body' },
  { id: 'G', group: 'burner', basis: 'shape', name: '버너 지지대', original: '명칭 미기재', size: '다리마다 1개 + 경사재 2개', maker: 'NBP KOREA 도면', place: '측면도의 수직재와 경사재', role: '측면도에 그려진 긴 부재와 경사재입니다. 버너 다리를 받치는 지지대로 해석했습니다.', sheet: { key: 'burner', x: .67, y: .3, w: .26 } },
  { id: 'K', group: 'burner', basis: 'shape', name: '관찰창 ×2', original: '명칭 미기재', size: '판 약 257 × 306', maker: 'NBP KOREA 도면', place: '40A 관 위쪽 벽면, 간격 604.5', role: '벽면에 볼트로 고정된 판과 원형 창입니다. 현장 사진에서 불꽃이 보이는 관찰창과 일치합니다.', field: { status: 'match', text: '현장 사진에서 볼트 판과 원형 창, 불꽃이 확인됩니다.' }, sheet: { key: 'burner', x: .335, y: .7, w: .26 }, photo: 'sight' },
  { id: 'L', group: 'burner', basis: 'shape', name: 'UV 스캐너·공기관', original: 'UV SCANNER (현장 표찰)', size: '규격 미기재', maker: '미기재', place: '왼쪽 다리 앞, 벽을 비스듬히 관통', role: '화염을 감지하는 UV 스캐너와 볼밸브가 달린 공기관입니다. 도면에는 형상만 있고 명칭은 현장 표찰로 확인했습니다. 공기관은 연소팬 쪽에서 스캐너로 공기를 보내는 라인으로 해석했습니다.', field: { status: 'match', text: '벽면 표찰 UV SCANNER와 비스듬한 위치가 일치합니다.' }, sheet: { key: 'burner', x: .645, y: .47, w: .14 }, photo: 'ignition' },
  { id: 'M', group: 'burner', basis: 'shape', name: '점화·파일럿 포트', original: 'SPARK PLUG · PILOT GAS (현장 표찰)', size: '규격 미기재', maker: '미기재', place: '벽면 가운데, 두 포트 간격 약 96', role: '정면도의 작은 육각 포트 2개입니다. 현장 표찰 순서대로 왼쪽을 스파크 플러그, 오른쪽을 파일럿 가스로 해석했습니다.', field: { status: 'match', text: '벽면 표찰 SPARK PLUG와 PILOT GAS가 같은 순서로 확인됩니다.' }, sheet: { key: 'burner', x: .34, y: .74, w: .14 }, photo: 'sight' },

  { id: 'I', group: 'air', basis: 'shape', name: '버너 연소팬 ×2', original: '명칭 미기재', size: '케이싱 약 Ø480, 축 간격 약 788', maker: '미기재', place: '벽 앞 281, 축이 수직', role: '위쪽 콘으로 공기를 빨아들여 챔버 안으로 연소공기를 보냅니다. 입구 콘은 위를 보고 모터는 아래에 달립니다.', field: { status: 'match', text: '현장의 주황색 케이싱과 입구 콘, 하부 모터 배치가 일치합니다.' }, sheet: { key: 'burner', x: .335, y: .81, w: .28 }, photo: 'blowers' },
  { id: 'J', group: 'air', basis: 'shape', name: '연소팬 모터 ×2', original: '명칭 미기재', size: '도면 미기재', maker: '미기재', place: '연소팬 아래, 축이 수직', role: '연소팬을 돌리는 모터입니다. 규격은 도면에 없습니다.', field: { status: 'unread', text: '2024-12-30 소손 보고서의 예비 모터 교체 기록은 2.2 kW · 4.7 A · 2극입니다. 현재 명판은 현장에서 확인하세요.' }, sheet: { key: 'burner', x: .335, y: .875, w: .28 }, photo: 'blowers' },
  { id: 'N', group: 'air', basis: 'shape', name: '공기 취출관·소형 기기', original: '명칭 미기재', size: '규격 미기재', maker: '미기재', place: '연소팬 안쪽, 벽면 양쪽', role: '연소팬 쪽 티에서 아래 소형 기기로 내려가는 가는 관입니다. 공기 압력을 보는 스위치로 추정되며 도면에서 확인되는 것은 형상뿐입니다.', sheet: { key: 'burner', x: .335, y: .85, w: .14 } },
  { id: 'H', group: 'air', basis: 'shape', name: '챔버 내부 공기 덕트', original: '명칭 미기재', size: '깊이 표기 680', maker: 'NBP KOREA 도면', place: '측면도의 숨은 선', role: '연소팬 출구에서 버너 다리로 공기를 보내는 내부 덕트로 해석했습니다. 측면도 윤곽을 그대로 옮긴 개략이며 내부 유로는 확정할 수 없습니다.', sheet: { key: 'burner', x: .695, y: .38, w: .2 } },

  { id: 'X', group: 'burner', basis: 'photo', name: '상부 덕트·후드·하부대', original: '도면 범위 밖', size: '실측 없음', maker: '미기재', place: '챔버 위아래', role: '도면에 없는 부분입니다. 챔버가 설치된 모습을 알 수 있도록 현장 사진 비례로 연하게 표시했습니다.', photo: 'overview' },
]);

export const PART_BY_ID = Object.freeze(Object.fromEntries(DRAWING_PARTS.map((part) => [part.id, part])));

// Order the gas actually travels, for the interpretation summary.
export const GAS_PATH = Object.freeze(['1', '4', '8', '9', '11', 'A', 'B', 'C', 'E']);
export const PILOT_PATH = Object.freeze(['21', '15', '16', '17', '18', '19', '20', 'D', 'M']);
