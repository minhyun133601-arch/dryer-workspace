// Positions describe a photo-based layout, not surveyed coordinates.
// Y is up; +Z is the front aisle. Distances are illustrative model units.
export const SITE_NOTE = '현장 사진 19장을 바탕으로 재구성한 개략 배치입니다. 설비 간 거리·방향과 가려진 덕트 연결은 실측 확인이 필요합니다.';

export const EQUIPMENT = Object.freeze([
  {
    id: 'chamber', name: '챔버', type: 'chamber', tag: 'CH-01',
    position: [-6, 0, -3], rotation: 0,
    summary: '점검문이 있는 대형 원통형 설비입니다. 사진의 「챔버」 표기를 기준으로 재현했습니다.',
    details: [
      '금속 외함, 외부 배관, 점검문과 기초부를 사진의 형태에 맞춰 표현했습니다.',
      '여러 방향에서 찍힌 원통 외함은 한 설비로 묶었습니다. 별도 챔버 수는 확인되지 않았습니다.',
      '외함 분리는 구조를 살펴보기 위한 개념 표현이며 내부 구성과 실제 해체 순서는 확인되지 않았습니다.',
    ],
    photo: './photos/20261028_161425.jpg',
    photos: ['./photos/20261028_161425.jpg', './photos/20261028_161551.jpg', './photos/20261028_161554.jpg', './photos/20261028_161600.jpg'],
    confidence: '명칭·외형 확인 · 위치 개략',
    parts: ['원통 외함', '상부 덮개', '점검문', '기초부', '외부 배관'],
  },
  {
    id: 'blower', name: '송풍기', type: 'blower', tag: 'BF-01',
    position: [1.5, 0, -2.5], rotation: 0,
    summary: '높은 받침대 위의 모터, 노란 구동부 보호커버와 대형 덕트를 하나의 참조 설비로 구성했습니다.',
    details: [
      '모터, 노란 보호커버, 하우징, 받침대와 주변 난간의 외형을 표현했습니다.',
      '여러 사진의 구동부가 동일 설비인지 확정하기 어려워 송풍기를 중복 배치하지 않았습니다.',
      '안쪽 임펠러·축·베어링은 사진에 보이지 않습니다. 분해 시의 내부 형상은 구조 설명용 개념입니다.',
    ],
    photo: './photos/20261028_161403.jpg',
    photos: ['./photos/20261028_161403.jpg', './photos/20261028_161356.jpg', './photos/20261028_161443.jpg', './photos/20261028_161411.jpg'],
    confidence: '외형 확인 · 설비 대응·위치 개략',
    parts: ['모터', '구동부 보호커버', '송풍기 케이싱', '임펠러 (개념)', '받침대'],
  },
  {
    id: 'heater', name: '버너', type: 'heater', tag: 'HT-01',
    position: [-6, 0, 3.6], rotation: 0,
    summary: '건조기 7층 버너입니다. NBP KOREA KHMA-H760 도면 2장을 해석한 3D 분해도와 현장 사진을 함께 볼 수 있습니다. 버너를 누르면 분해도가 열립니다.',
    details: [
      '2026년 11월 4일 현장 사진으로 외함, 상부 덕트, 전면 붉은 송풍부와 하부 모터의 형태를 보완했습니다.',
      '도면 분해도는 부품표 21개 항목과 배관·챔버 치수를 반영했습니다. 번호를 누르면 규격, 제조사, 도면 위치와 현장 사진을 확인합니다.',
      '번호가 없는 내부 구조는 도면 외형을 해석한 개략입니다. 실제 해체 순서는 도면에 없습니다. 3D 배치도의 외형은 현장 사진 비례 그대로입니다.',
    ],
    photo: './photos/furnace/overview.jpg',
    photos: ['./photos/furnace/overview.jpg', './photos/furnace/duct.jpg', './photos/furnace/body.jpg', './photos/furnace/blowers.jpg', './photos/furnace/gas.jpg', './photos/furnace/ignition.jpg', './photos/furnace/control.jpg'],
    confidence: '2019.04.22 도면 + 2026.11.04 현장 사진',
    parts: ['상부 덕트·후드', '본체·단열 외함', '전면 송풍부·모터', '노란 배관·밸브', '점화·연결부', '현장 제어함'],
  },
  {
    id: 'cyclone-1', name: '싸이클론 1', type: 'cyclone', tag: 'CY-01',
    position: [7, 0, -5], rotation: 0,
    summary: '현장의 「싸이클론 1」 표기가 확인되는 원통형 설비입니다.',
    details: [
      '원통 외함, 상부 연결부, 점검구와 작업발판을 사진에 맞춰 표현했습니다.',
      '1·2·3번의 구분은 현장 표기를 따릅니다. 모델의 일렬 배치와 간격은 개략입니다.',
      '외함 안쪽 유로와 하부 구조는 보이지 않아 개념 수준으로 표현합니다.',
    ],
    photo: './photos/20261028_161503.jpg',
    photos: ['./photos/20261028_161503.jpg', './photos/20261028_161456.jpg'],
    confidence: '번호·외형 확인 · 위치 개략',
    parts: ['원통 외함', '상부 연결부', '점검구', '작업발판', '기초부'],
  },
  {
    id: 'cyclone-2', name: '싸이클론 2', type: 'cyclone', tag: 'CY-02',
    position: [7, 0, 0], rotation: 0,
    summary: '현장의 「싸이클론 2」 표기가 확인되는 원통형 설비입니다.',
    details: [
      '2번 명칭과 금속 외함, 외부 배관, 상부 연결부를 사진에서 확인했습니다.',
      '주변 설비와의 정확한 거리·방향 및 덕트의 전체 연결 관계는 확인되지 않았습니다.',
      '분리 보기는 외형 부품의 관계를 설명하는 개념 표현입니다.',
    ],
    photo: './photos/20261028_161507.jpg',
    photos: ['./photos/20261028_161507.jpg'],
    confidence: '번호·외형 확인 · 위치 개략',
    parts: ['원통 외함', '상부 연결부', '점검구', '작업발판', '기초부'],
  },
  {
    id: 'cyclone-3', name: '싸이클론 3', type: 'cyclone', tag: 'CY-03',
    position: [7, 0, 5], rotation: 0,
    summary: '현장의 「싸이클론 3」 표기가 확인되는 원통형 설비입니다.',
    details: [
      '3번 명칭과 상부 연결부, 원통 외함 및 기초부를 사진에서 확인했습니다.',
      '기둥과 발판 뒤로 가려진 부분은 다른 사진의 공통 외형을 참고해 단순화했습니다.',
      '내부 부품, 실제 치수와 해체 순서는 사진으로 확정할 수 없습니다.',
    ],
    photo: './photos/20261028_161513.jpg',
    photos: ['./photos/20261028_161513.jpg'],
    confidence: '번호·외형 확인 · 위치 개략',
    parts: ['원통 외함', '상부 연결부', '점검구', '작업발판', '기초부'],
  },
  {
    id: 'panel', name: '현장 제어반', type: 'panel', tag: 'CP-01',
    position: [-10.5, 0, 3.8], rotation: 0,
    summary: '챔버 주변 사진에 보이는 조작 패널을 현장 위치의 참조 대상으로 표현했습니다.',
    details: [
      '사진에서 보이는 패널 전면과 표시·조작부를 단순화했습니다.',
      '기존 제어판 화면으로 이동해 등록된 부품 정보를 살펴볼 수 있습니다.',
      '현장 사진 속 패널과 기존 제어반 자료의 동일 여부, 상세 결선 및 설치 높이는 확인이 필요합니다.',
    ],
    photo: './photos/20261028_161352.jpg',
    photos: ['./photos/20261028_161352.jpg'],
    confidence: '전면 외형 확인 · 대응·위치 개략',
    parts: ['전면 패널', '표시·조작부', '외함', '내부 부품 (별도 자료)'],
  },
]);
