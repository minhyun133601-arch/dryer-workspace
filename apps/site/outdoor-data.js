import { OUTDOOR_CARD_CAPTIONS, OUTDOOR_CARD_PHOTOS, bindOutdoorCard } from './outdoor-card-data.js';
import { OUTDOOR_DRAWING_CAPTIONS, OUTDOOR_DRAWING_PHOTOS, bindOutdoorDrawing } from './outdoor-drawing-data.js';

// Photo reconstruction. x=east, z=south; WGS84 tangent origin below.
// GPS describes the camera, not a surveyed equipment corner. Sizes are estimates.
const yaw = 35 * Math.PI / 180;
const anchor = [-13.92, 0, 13.92];
const photo = (time, index) => `./photos/outdoor/20261030_${time}-${String(index).padStart(3, '0')}.jpg`;
const videoPhoto = (clip, seconds) => `./photos/outdoor-video/20261102_${clip}-${String(seconds).padStart(3, '0')}s.jpg`;
const videoCaptures = [['130415', 8], ['130440', 51], ['130440', 58], ['130440', 63], ['130440', 72], ['130440', 98], ['130440', 105], ['130440', 113], ['130440', 128], ['130440', 42], ['130440', 55], ['130440', 87], ['130440', 125]];
const endVideoPhoto = (seconds) => `./photos/outdoor-video/20261109_133757-${String(seconds).padStart(3, '0')}s.jpg`;
const endVideoCaptures = [0, 4, 12, 18, 28, 42, 60, 84, 114, 120, 132, 156, 192, 216, 222, 234, 246, 252, 258, 264, 270];
const photoCaptions = Object.freeze(Object.fromEntries([...videoCaptures.map(([clip, seconds]) => [
  videoPhoto(clip, seconds), `11/02 · ${clip.slice(0, 2)}:${clip.slice(2, 4)}:${clip.slice(4)} 영상 ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`,
]), ...endVideoCaptures.map((seconds) => [
  endVideoPhoto(seconds), `11/09 · 13:37:57 영상 ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`,
]), ...Object.entries(OUTDOOR_CARD_CAPTIONS), ...Object.entries(OUTDOOR_DRAWING_CAPTIONS)]));
const at = (along, across, y = 0) => [
  anchor[0] + along * Math.cos(yaw) + across * Math.sin(yaw), y,
  anchor[2] - along * Math.sin(yaw) + across * Math.cos(yaw),
];

export const OUTDOOR_ROOM = Object.freeze({
  id: 'outdoor', name: '실외기실', shortName: '실외기실',
  summary: '유산동 액상공장 외벽과 블록 담장 사이의 옥외 설비 통로입니다. 현장 사진·영상·3팀 이력카드와 장비배치도·유틸리티 도면을 대조했습니다. 집진설비·공조기·냉각설비 등 22개 설비 그룹을 표시합니다.',
  source: '2026 현장 사진 128장·동영상 4개·3팀 이력카드 14건 · 2022-05-03 액상공장 장비배치도·유틸리티 전체 계통도 · 2025 액상 증설 공사 첨부 설치도 · 액상 HACCP 공조설비 시트',
  reference: photo('150514', 15),
  photos: [photo('150434', 0), ...OUTDOOR_DRAWING_PHOTOS, ...OUTDOOR_CARD_PHOTOS, photo('150514', 15), photo('150619', 51), photo('150740', 109), photo('150756', 124)],
  videoPhotos: [...endVideoCaptures.map(endVideoPhoto), ...videoCaptures.map(([clip, seconds]) => videoPhoto(clip, seconds))], photoCaptions,
  center: at(53, -1.5, 1.8), span: 115, width: 100, depth: 73,
  anchor, rotation: yaw, length: 110, corridorWidth: 6.6, aisleWallZ: 3.6, aisleCenterZ: 2.25,
  origin: { lat: 35.362, lon: 129.031 },
  confidence: '액상공장 도면·3팀 카드·현장 영상 대조 · 현재 위치·치수·고도는 실측 아님',
  details: [
    '도면의 대상은 유산동 액상공장 외벽의 유틸리티 설비열입니다. 현재 2팀 스틱·소포장 9동이나 옛 2팀 건조실과 구분합니다.',
    '2022-05-03 장비 배치도·유틸리티 전체 계통도의 99,700 × 39,200mm는 건물 축 치수입니다. 현재 110m 통로·설비 위치는 촬영 기반 근사이며 이 치수로 일괄 축소하지 않았습니다.',
    '도면과 영상에서 맨홀 → 집진설비 → PET/액상 AHU → 스틱/치어팩 AHU → 100RT 칠러 순서를 대조했습니다. 황색 사다리 외함은 탱크에서 집진설비로 명칭을 바로잡았습니다. 15hp/7.5hp 개별 대응과 현재 독립 대수는 미확정입니다.',
    '노출 코일 응축기는 집진설비와 PET/파우치 공조기 사이, PET의 진입측 짧은 끝면 앞 기초 위에 있습니다. 카드 085 좌측면과 11/09 영상 0:04를 대조해 위치를 바로잡고 두 팬의 배열을 통로 가로 방향으로 돌렸습니다. 미터 단위 간격은 근사입니다.',
    '2025 공사 첨부 설치도는 2022 도면과 비슷한 배치를 사용합니다. 원본 PPT 수정일은 2025-04-14이며 바탕 도면의 작성일·준공 실측 여부는 확인되지 않았습니다. 옛 공조설비 시트의 AHU1/CDU1은 현재 이력카드 번호와 직접 연결하지 않습니다.',
    '3팀 실외기실 이력카드 14건 중 11건은 현장 사진·영상의 설비와 대응합니다. 20RT 공조기 1·2와 40RT 물탱크는 설치 위치 대응이 미확정이어서 전체 참고 사진에서 확인할 수 있습니다.',
    'PET 파우치 공조기는 치어팩 스틱실 공조기와 별도입니다. 40RT 칠러도 끝 통로의 낮은 백색 외함 2대와 구분합니다. 새 장비의 위치는 촬영 순서·인접 관계에 맞춘 근사입니다.',
    '카드의 제조사·모델명·실측 치수는 공란입니다. 과거 가동률·운전상태를 현재 실시간 상태로 표시하지 않습니다. 40RT 표시명과 옛 60RT 파일명·코드의 충돌은 원문과 함께 보존합니다.',
    '실외기실은 지붕이 없는 옥외 공간이며 남서쪽 진입부에서 북동쪽 설비 통로로 이어집니다.',
    '11월 2일 동영상의 연속 동선을 참고해 백색 냉각기 전면을 진입부 쪽으로 돌리고, 담장과 설비 사이 통로를 좁혔습니다.',
    '오후 영상에서 담장 위 은색 배관·적색 지지대와 회색 외함 옆 노출 코일 응축기, 공조기·조작반·소형 실외기를 확인했습니다. 새 구역의 간격과 길이는 영상 비례에 따른 개략값입니다.',
    '11월 9일 연속 영상으로 녹색 철망문 뒤 냉각설비·패널 탱크·녹색 펌프 2대와 마지막 통로의 실외기 2대·청색 맨홀·청색 물탱크·세로형 스테인리스 탱크를 확인했습니다.',
    '새 영상의 휴대폰 GPS 동선은 후반 통로 방향과 끝 위치를 참고하는 데 사용했습니다. 초반 좌표 흔들림과 시간 정합 오차가 있어 장비 모서리·정확한 간격·지반 경사로 취급하지 않습니다.',
    '촬영 GPS의 표시 정확도는 약 1.2~3.3m입니다. 촬영점에서 보이는 장비 방향을 함께 고려했으며 사진 간 위치 오차는 정리했습니다.',
    '파일명의 H는 방위각이며 높이 데이터가 아닙니다. 바닥 경사·장비 치수·건물과 건조실의 연결 위치는 확정하지 않았습니다.',
  ],
});

function equipment(id, name, type, tag, along, across, times, options = {}) {
  const photos = times.map(([time, index]) => photo(time, index));
  return Object.freeze({
    id, name, type, tag, floor: 'outdoor', position: at(along, across), rotation: yaw,
    photo: photos[0], photos, photoCaptions, labelHeight: 3.3,
    summary: '현장 사진의 외형과 촬영점·방향을 참고해 재구성한 옥외 설비입니다.',
    details: ['장비의 수평 위치와 치수는 사진으로 추정했습니다. 정확한 배관 연결 및 내부 구조는 생략했습니다.'],
    confidence: '사진 외형·촬영 동선 참고 · 치수 개략',
    parts: ['외함', '상부 장치', '배관·받침'], ...options,
  });
}

export const OUTDOOR_EQUIPMENT = Object.freeze([
  equipment('outdoor-100rt', '100RT 냉각탑·물탱크', 'outdoor-rack', '100RT', 2.4, -5.7,
    [['150434', 0], ['150454', 4], ['150455', 5], ['150459', 7]], {
      rotation: yaw + Math.PI / 2, labelHeight: 6.7,
      summary: '진입부의 2단 철골 냉각탑입니다. 상부 직사각형 냉각부, 하부 100RT 물탱크, 수직 배관 뱅크와 조작반을 재현했습니다.',
      parts: ['하부 물탱크·펌프', '상부 냉각탑', '철골·점검 사다리', '수직 배관·조작반'],
      details: ['15:04:54 사진의 표찰에 100RT 쿨링타워 물탱크가 보입니다.', '15:04:34 사진에서 배관 뱅크 오른쪽 철골 바로 옆으로 높은 옹벽이 이어집니다. 15:04:54·15:05:03 측면 사진도 참고해 벽과의 틈을 좁혔습니다.', '하부 탱크의 세로 보강판, 상부 흡입구, 전면 배관과 계기·밸브를 반영했습니다.'],
    }),
  equipment('outdoor-unit-1', '배합실 냉각기 유니트 2', 'outdoor-vrf', '유니트 2', 8.8, -1.15,
    [['150521', 17], ['150524', 19], ['150529', 21]], {
      rotation: yaw - Math.PI / 2, previousRotation: yaw,
      variant: 'mix-2', parts: ['실외기 외함', '상부 팬·열교환 그릴', '배관·받침'],
      details: ['15:05:23 전면 표찰의 배합실 냉각기 유니트2를 확인했습니다. 사진마다 나타나는 같은 외함을 별도 설비로 세지 않았습니다.'],
    }),
  equipment('outdoor-unit-2', '배합실 냉각기 유니트 1', 'outdoor-vrf', '유니트 1', 12.6, -1.15,
    [['150550', 30], ['150553', 33], ['150604', 39]], {
      rotation: yaw - Math.PI / 2, previousRotation: yaw,
      variant: 'mix-1', parts: ['실외기 외함', '상부 팬·열교환 그릴', '배관·받침'],
      details: ['15:05:56 전면 표찰의 배합실 냉각기 유니트1을 확인했습니다.'],
    }),
  equipment('outdoor-towers', '고가 냉각탑', 'outdoor-cooling-pair', 'CT-01', 15.4, -1.25,
    [['150607', 42], ['150608', 43], ['150614', 45]], {
      count: 1, width: 2.7, depth: 2.8,
      labelHeight: 5.9, parts: ['철골 받침·점검 발판', '원형 냉각탑 1기', '사다리·연결 배관'],
      summary: '철골 다리와 점검 플랫폼 위의 원형 냉각탑 1기입니다. 물탱크 2대는 플랫폼 옆에 나란히 배치했습니다.',
      details: ['현장 설명에 따라 고가 냉각탑은 1대로 수정했습니다.', '철골 다리 아래 공간은 비워 두고, 냉각수 물탱크 2대를 플랫폼 밖 옆쪽에 배치했습니다.'],
    }),
  equipment('outdoor-water-1', '냉각수 패널 물탱크 1', 'outdoor-panel-tank', 'WT-01', 18.5, 0,
    [['150620', 52], ['150628', 57], ['150630', 59]], {
      labelHeight: 2.4, variant: 'unconfirmed-capacity',
      parts: ['스테인리스 패널 외함', '상부 덮개·점검 사다리', '유입·배출 배관'],
      summary: '고가 냉각탑 플랫폼 옆의 스테인리스 패널 물탱크입니다. 철골 다리 아래에 들어가지 않도록 옆쪽으로 분리해 배치했습니다.',
    }),
  equipment('outdoor-water-2', '20RT 냉각탑 물탱크', 'outdoor-panel-tank', '20RT · WT-02', 21.8, 0,
    [['150637', 64], ['150638', 65], ['150642', 70]], {
      labelHeight: 2.6,
      summary: '고가 냉각탑 플랫폼 옆쪽의 20RT 냉각탑 물탱크입니다. 20RT 냉각탑 외함 앞 통로 쪽에 놓고, 외함과 좁은 옆 틈을 두었습니다.',
      parts: ['스테인리스 패널 외함', '상부 덮개·점검 사다리', '유입·배출 배관'],
      details: ['15:06:38 사진의 표찰에서 20RT 쿨링타워 물탱크를 확인했습니다.', '15:06:42~15:06:45 및 15:06:59 사진의 물탱크·20RT 외함 사이 틈을 참고했습니다.', '사진에 보이는 녹색 호스와 보온된 금속 배관을 표현했습니다.'],
    }),
  equipment('outdoor-cooling-20', '20RT 냉각탑·컨트롤판넬', 'outdoor-chiller', '20RT', 21.8, -2.2,
    [['150656', 79], ['150659', 83], ['150704', 85], ['150708', 89]], {
      parts: ['냉각탑 외함', '노출 열교환부·팬', '보온 배관·계기'],
      summary: '20RT 냉각탑 외함과 같은 전면의 컨트롤판넬입니다. 물탱크 뒤 공장 외벽 쪽에 놓았습니다. 갈색 그릴, 계기 3개와 굵은 보온 배관을 반영했습니다.',
      details: ['15:06:59 측면 표찰은 20RT 쿨링타워, 15:07:07 전면 표찰은 20RT 컨트롤판넬입니다. 서로 다른 장비로 중복 계산하지 않았습니다.'],
    }),
  equipment('outdoor-unit-3', '배합실 냉각기 유니트 4', 'outdoor-vrf', '유니트 4', 27.8, -1.25,
    [['150714', 92], ['150726', 99], ['150729', 101]], {
      rotation: yaw - Math.PI / 2, previousRotation: yaw,
      variant: 'mix-4', parts: ['실외기 외함', '상부 팬·열교환 그릴', '배관·받침'],
      details: ['15:07:15·15:07:17 전면 표찰의 배합실 냉각기 유니트4를 확인했습니다.', '배경에 일부만 보이는 흰색 외함은 사진만으로 동일성·대수를 확정하지 않아 추가하지 않았습니다.'],
    }),
  equipment('outdoor-pump-pit', '청색 맨홀·밸브 배관', 'outdoor-pump-pit', 'PIT / VALVE', 30.3, -1.1,
    [['150731', 103], ['150734', 106], ['150740', 109], ['150740', 110]], {
      labelHeight: 3.9,
      parts: ['청색 맨홀·덮개', '수직 밸브·플랜지', '적색 지지대·상부 헤더'],
      summary: '청색 원형 맨홀 주변의 2열 수직 밸브 배관입니다. 영상에서 확인한 볼트 플랜지·금속 신축 이음·검정 고무 신축관, 초록 기어박스와 적색 철골을 보완했습니다. 뒤쪽 소화전함과 독립 조작함도 표현했습니다.',
    }),
  equipment('outdoor-vessel', '집진설비 · 황색 사다리 외함', 'outdoor-vessel', '집진설비', 33.2, -1.0,
    [['150748', 115], ['150748', 116], ['150756', 124], ['150758', 127]], {
      labelHeight: 6.7,
      photo: videoPhoto('130440', 51),
      photos: [videoPhoto('130440', 51), videoPhoto('130440', 42), videoPhoto('130440', 55), photo('150748', 115), photo('150756', 124)],
      parts: ['회색 사각 외함·점검문', '황색 사다리·안전 케이지', '상부 금속 덕트·점검구'],
      summary: '도면의 맨홀과 PET/액상 AHU 사이 집진기 구역에 대응하는 황색 사다리·회색 사각 외함입니다. 영상에 맞춰 본체, 나선 이음 금속 덕트·곡관, 작업 난간과 점검문을 표현했습니다.',
      details: ['2022 도면과 2025 첨부 설치도에 폐수맨홀 → 신설 집진기 15hp·기존 집진기 7.5hp → 기존 AHU 이설(PET+액상) 순서가 있습니다. 영상의 청색 피트 → 황색 사다리 외함 → PET 공조기와 대조해 집진설비로 정정했습니다.', '도면의 집진기 두 기호 중 어느 것인지, 두 기호가 현재 한 선택 그룹에 포함되는지는 미확정입니다. 15hp/7.5hp를 부여하거나 별도 두 대를 추가하지 않았습니다.', '사진의 밀폐공간 표지·팔각 점검구와 영상 13:04:40의 DISCOL 표시 계기·검정 패널·수직 금속 덕트를 반영했습니다. 덕트 높이·가려진 연결과 현재 용량은 미확정입니다.'],
      confidence: '액상공장 도면의 집진기 구역·현장 영상 대조 · 개별 번호·용량·치수 미확정',
    }),
  equipment('outdoor-condensers', '노출 코일 응축기 · 상부 팬 2개', 'outdoor-condenser-bank', 'FAN × 2', 35, -1.25, [], {
    rotation: yaw + Math.PI / 2,
    previousPlacements: [{ position: at(36.75, .5), rotation: yaw }, { position: at(36, -1.15), rotation: yaw }],
    photo: endVideoPhoto(4), photos: [endVideoPhoto(4), './assets/photos/equipment-cards/outdoor/085-pet-pouch-air-handler/overview.jpg#left', videoPhoto('130440', 63), videoPhoto('130440', 58), videoPhoto('130440', 55)],
    labelHeight: 2.3,
    parts: ['열교환 코일·외곽 프레임', '상부 팬·녹슨 보호망', '받침·연결 배관'],
    summary: 'PET/파우치 공조기의 진입측 짧은 끝면 앞, 집진설비와 공조기 사이 기초 위의 노출 코일 응축기입니다. 청회색 코일·녹슨 보호망·상부 팬 2개가 통로 가로 방향으로 나란히 놓입니다.',
    details: ['카드 085의 좌측면은 공장 외벽이 왼쪽, 담장이 오른쪽인 방향으로 PET 공조기의 짧은 끝면을 봅니다. 두 팬이 그 끝면 앞 좌우에 함께 보이며 긴 점검문 정면 앞에 놓인 배치가 아닙니다.', '11/09 영상 0:04에서 노출 코일 → PET 공조기 짧은 끝면 → 원형 관찰창 정면으로 이어지는 관계와 같은 기초를 확인했습니다. 11/02 13:04:40 영상 55·58·63초의 창문·벽면 계장함·검정 배선도 대조했습니다.', '전체 하우징 구분과 장비 번호가 보이지 않아 하나의 관찰 그룹으로 묶었습니다. 팬 2개를 독립된 장비 2대로 단정하거나 PET 카드 085를 응축기 자체의 카드로 부여하지 않습니다.', '상대 위치와 팬 배열 방향은 사진·영상으로 확인했습니다. 기초와 벽 사이에 맞춘 좌표·간격·높이는 근사이며 냉매관의 연결 대상·용량은 미확정입니다.'],
    confidence: '카드 085 인접 사진·11/09 영상 0:04·11/02 영상 대조 · 상대 위치 확인·치수 근사',
  }),
  equipment('outdoor-pet-ahu', 'PET 파우치 공조기', 'outdoor-ahu', 'PET / 파우치', 37.75, -1.5, [], {
    previousPosition: at(37, -1.5),
    variant:'pet-pouch',width:4,depth:2.1,height:5.2,labelHeight:4.5,
    photo:videoPhoto('130440',72),photos:[videoPhoto('130440',72),videoPhoto('130440',63),videoPhoto('130440',87)],
    parts:['모듈 외함·원형 관찰창','흡입 후드·상부 덕트','받침·배수·문 부속'],
    summary:'영상 72초의 PET/파우치 공조기 표찰과 이력카드 085의 원형 관찰창·상부 덕트를 대조한 별도 공조기입니다.',
    details:['기존 치어팩 스틱실 공조기의 사각 관찰창과 구분합니다. 카드 085 좌측면과 11/09 영상 0:04에서 노출 코일 응축기가 진입측 짧은 끝면 앞에 있고 긴 원형창 정면은 통로를 향하는 관계를 확인했습니다.','응축기와 끝면 사이를 분리하도록 위치를 보정했습니다. 사진·영상의 인접 관계를 따른 근사이며 실측 좌표·가려진 덕트 연결은 미확정입니다. AHU-01 조작반의 연결 대상은 단정하지 않습니다.'],
  }),
  equipment('outdoor-ahu', '치어팩 스틱실 공조기', 'outdoor-ahu', '공조기', 42, -.95, [], {
    previousPosition:at(40.4,-.95),
    photo: videoPhoto('130440', 113), photos: [videoPhoto('130440', 113), videoPhoto('130440', 128), videoPhoto('130440', 98), videoPhoto('130440', 125)],
    labelHeight: 4.5,
    parts: ['패널 외함·점검문·방진 받침', '흡입 후드·상부 덕트·신축 이음', 'AHU-01 조작반·배수관'],
    summary: '이력 카드의 정면·우측 사진과 사각 관찰창, AIR HANDLING UNIT 명판 및 경사형 메시 흡입 후드가 일치하는 치어팩 스틱실 공조기입니다.',
    details: ['제공된 이력 카드에는 3팀 · 실외기실 · 치어팩 스틱실 공조기로 표시되어 있습니다. 사각 관찰창·문명판·흡입 후드를 영상 113초·128초의 외형과 대조했습니다.', '영상 72초의 PET/파우치 공조기는 다른 표찰이므로 이 카드의 대상과 같은 설비로 확정하지 않습니다. 인접한 AHU-01 조작반과의 직결 관계도 미확정입니다.', '현재 제공된 카드에는 제조사·모델명과 상세 사양이 등록되어 있지 않습니다. 이력 카드 PDF 원본은 보관 자료로 유지했습니다.', '각관 다리·방진 패드·사각 덕트·배수관을 개략 표현했습니다. 위치·치수는 영상 비례에 따른 추정입니다.'],
    confidence: '이력 카드·현장 영상 외형 대조 · 위치·치수 개략',
  }),
  equipment('outdoor-split-unit', '공조기 옆 소형 실외기', 'outdoor-split-unit', '소형 실외기', 45.7, -2, [], {
    previousPosition:at(43.7,-2),
    photo: videoPhoto('130440', 105), photos: [videoPhoto('130440', 105), videoPhoto('130440', 87)],
    labelHeight: 1.8,
    parts: ['백색 외함·고무 받침', '상부 팬·통풍구', '배관·케이블'],
    summary: '공조기 주변에 보이는 작은 백색 실외기입니다. 검정 상부 팬 보호망과 하부 통풍 슬롯·받침을 표현했습니다.',
    details: ['영상 약 93~108초에서 백색 외함, 상부 검정 팬망과 바닥 케이블을 확인했습니다.', '설비 번호·용량·연결 대상은 확인되지 않았습니다. 배합실 유니트 번호는 부여하지 않았습니다.'],
    confidence: '현장 영상 외형 확인 · 명칭·용량·정확한 위치 미확정',
  }),
  equipment('outdoor-process-chiller', '100RT 칠러·컨트롤판넬', 'outdoor-process-chiller', '100RT 칠러', 60, -1, [], {
      photo: './photos/chiller-20261110/photo-027.jpg', photos: ['./photos/chiller-20261110/photo-027.jpg', './photos/chiller-20261110/photo-025.jpg', './photos/chiller-20261110/photo-048.jpg', ...[28,42,84,114,192].map(endVideoPhoto)], labelHeight: 2.85,
      detailKey: 'chiller-100rt', width: 4.14, depth: 1.9, height: 2.2,
      parts: ['공통 베이스·철골', 'V형 응축 코일', '상부 팬 8조', '기존 스크루 압축기', '신형 스크루 압축기', '액 리시버 2기', '보온 증발기', '흡입·냉수 보온관', '냉매 동관·밸브', '제어·동력함', '압력계·스위치', '보호 격자', '전선·보호관'],
      summary: '신성엔지니어링 SCSA100AS1 제작도 SC010606과 11/10 현장 사진 67장을 대조한 100RT 공랭식 스크루 냉동기입니다. 전용 구조·분해도에서 부품, 냉매 회로와 압축기 내부 자료를 확인합니다.',
      details: ['제작도(2011.02.23) 외곽 4,140 ×1,900 ×2,200 mm, 압축기 2대·팬 8조·액 리시버 2기 수량을 반영했습니다.', '현장 신형 압축기의 HITACHI 50ASC-H 명판을 확인했습니다. 기존품 모델 각인은 미판독이며 현재 용기의 외관·보온관·격자는 사진을 따릅니다.', '분리 간격은 관찰용입니다. 가려진 실제 배관 경로·정비 순서는 나타내지 않습니다. 진입부 100RT 냉각탑과 별도 설비입니다.'],
      confidence: '제작도 치수·수량 + 2026.11.10 실물 사진 대조',
  }),
  equipment('outdoor-end-panel-tank', '100RT 물탱크 · 패널형', 'outdoor-end-panel-tank', '100RT 물탱크', 67, -1, [], {
    photo: endVideoPhoto(132), photos: [132, 156, 192, 120].map(endVideoPhoto), labelHeight: 4.1,
    parts: ['스테인리스 패널 외함·받침', '상부 배관·점검부', '밸브·하부 연결관'],
    summary: '3팀 카드 088의 100RT 물탱크입니다. 영상의 패널 탱크·보온관·인접 펌프 구성을 대조하고 두 단의 성형 패널을 재현했습니다.',
    details: ['영상 약 2:00~3:30에서 서로 다른 면을 촬영한 같은 패널 탱크로 관찰됩니다. 어둡게 보이는 반대 면을 별도 탱크로 중복하지 않았습니다.', '앞쪽 고가 냉각탑 옆의 기존 패널 물탱크 2대와는 떨어진 후반 구역입니다. 100RT는 현재 카드의 설비명이며 탱크 체적이나 현장 실측 용량을 뜻하지 않습니다.'],
  }),
  equipment('outdoor-pump-skid', '녹색 순환펌프 2대·보온 헤더', 'outdoor-pump-skid', 'PUMP × 2', 71, -1, [], {
    photo: endVideoPhoto(120), photos: [120, 156, 60, 132].map(endVideoPhoto), labelHeight: 3.3,
    parts: ['철골 받침·펌프 하부', '녹색 수직 펌프 2대·빗물 덮개', '보온 U배관·밸브·계기'],
    summary: '패널 탱크 옆의 녹색 수직 펌프 2대입니다. 은색 원뿔형 빗물 덮개, 흰색 보온 U배관·녹색 핸드휠과 녹슨 철골 받침을 표현했습니다.',
    details: ['영상 1:00·2:00·2:36에서 2대와 공통 헤더를 확인했습니다.', '흰색 배관의 외형과 가까운 탱크의 인접 관계를 참고했습니다. 유동 방향·전체 계통 연결·펌프 사양은 확정하지 않았습니다.'],
  }),
  equipment('outdoor-chiller-40', '40RT 칠러 · 카드명', 'outdoor-chiller', '40RT 칠러', 76.25, -.95, [], {
    variant:'card-40rt',width:4.4,depth:1.4,height:3,labelHeight:3.5,
    photo:endVideoPhoto(216),photos:[endVideoPhoto(216),endVideoPhoto(192),endVideoPhoto(222)],
    parts:['긴 백색 외함·각관 받침','상부 코일 4구획','계기·하부 점검문·배관'],
    summary:'카드 089의 상부 코일 4구획·하부 점검문을 영상 216초 전경 외함과 대조한 칠러입니다. 창 아래의 낮은 실외기 2대와 별도로 표시합니다.',
    details:['영상 순서에 따라 100RT 탱크·펌프 뒤와 낮은 백색 외함 앞에 놓았습니다. 정확한 간격과 치수는 영상 비례에 따른 근사입니다.','카드의 현재 설비명 40RT를 따르되 옛 60RT 사진명·코드와의 불일치를 유지합니다. 이 표기만으로 정격 성능이나 다른 공조기와의 계통 연결을 확정하지 않습니다.'],
  }),
  equipment('outdoor-end-units', '끝 통로 백색 실외기 2대', 'outdoor-end-units', '실외기 × 2', 81, -1.4, [], {
    previousPosition:at(80,-1.4),
    photo: endVideoPhoto(222), photos: [222, 216, 234].map(endVideoPhoto), labelHeight: 2.3,
    parts: ['백색 외함 2대·공통 기초', '측면 열교환 그릴·팬', '냉매관·외벽 배선'],
    summary: '녹색 펜스 구역을 지난 뒤 공장 외벽을 따라 나란히 놓인 백색 실외기 2대입니다. 측면 열교환 그릴과 공통 받침을 재현했습니다.',
    details: ['영상 약 3:42에서 두 개의 독립된 백색 외함을 확인했습니다.', '기존 공조기 옆 소형 실외기와는 다른 위치입니다. 설비 번호·용량·연결 공조기는 확인되지 않았습니다.'],
  }),
  equipment('outdoor-end-sump', '끝 통로 청색 맨홀·배수부', 'outdoor-end-sump', '배수·맨홀', 90, -1, [], {
    photo: endVideoPhoto(234), photos: [234, 246, 252].map(endVideoPhoto), labelHeight: 1.6,
    parts: ['원형 맨홀·받침', '청색 연결 배관', '주변 배수 그레이팅'],
    summary: '마지막 좁은 통로의 청색 원형 맨홀 뚜껑과 연결 배관입니다. 근처 녹색 배수 그레이팅도 함께 표현했습니다.',
    details: ['영상 약 3:54의 통로 전경에서 청색 원형 덮개·배관과 녹색 배수구를 확인했습니다.', '앞쪽 기존 청색 맨홀·밸브 구역과는 떨어진 후반 위치입니다. 매설 배관과 내부 구조는 확인되지 않았습니다.'],
  }),
  equipment('outdoor-blue-tank', '끝 통로 청색 물탱크', 'outdoor-blue-tank', '청색 탱크', 100, -1, [], {
    photo: endVideoPhoto(252), photos: [252, 258, 270, 234].map(endVideoPhoto), labelHeight: 2.6,
    parts: ['청색 리브형 탱크 본체', '덮개·접속구', '받침·주변 배관'],
    summary: '마지막 통로 끝에 놓인 청색 플라스틱 물탱크입니다. 둥근 외형과 굵은 보강 리브를 영상 비례로 표현했습니다.',
    details: ['영상 4:12 이후 청색 탱크와 바로 뒤 별도의 세로형 스테인리스 탱크를 확인했습니다.', '용량·저장 유체·제조사 표찰은 확인되지 않았습니다.'],
  }),
  equipment('outdoor-stainless-vessel', '끝 세로형 스테인리스 탱크', 'outdoor-stainless-vessel', '세로형 탱크', 106, -1, [], {
    photo: endVideoPhoto(258), photos: [258, 264, 270].map(endVideoPhoto), labelHeight: 6.4,
    parts: ['원통형 스테인리스 본체·다리', '상부 덮개·접속부', '측면 원형 노즐·하부 배관'],
    summary: '영상 마지막에 보이는 다리 위의 세로형 스테인리스 원통 탱크입니다. 둥근 상·하부와 측면의 원형 접속구·배관을 표현했습니다.',
    details: ['영상 4:18~4:32에서 청색 탱크와 구분되는 높은 금속 원통·다리·원형 노즐을 확인했습니다.', '영상에서 가려진 뒷면·내부·실제 높이·용도·용량은 확정하지 않았습니다.'],
  }),
].map(bindOutdoorCard).map(bindOutdoorDrawing));
