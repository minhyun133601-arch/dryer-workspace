import { MOTOR_SPEC } from './motor-spec.js';

export const PART_ORDER = Object.freeze([
  'housing', 'stator', 'rotor', 'shaft', 'frontBell', 'bearing',
  'rearBell', 'rearBearing', 'fan', 'fanCover', 'terminal', 'terminalLid',
]);

export const PARTS = Object.freeze({
  housing: {
    number: '01', name: '모터 하우징', english: 'Motor housing',
    description: '효성 HSX150412 모터의 내부 부품을 감싸는 160M 프레임 몸체입니다. 냉각 핀과 하부 고정 발, 앞뒤 엔드 커버의 배치를 관찰합니다.',
    spec: `${MOTOR_SPEC.model} · ${MOTOR_SPEC.frame} · ${MOTOR_SPEC.powerKw} kW`,
    material: '주조 금속', role: '내부 보호 · 열 방출',
    observation: '몸체를 따라 길게 이어진 냉각 핀과 하부의 고정 발을 살펴보세요.', color: '#579b8c',
  },
  stator: {
    number: '02', name: '고정자', english: 'Stator',
    description: '하우징 안쪽에 고정된 철심과 삼상 권선입니다. 제공된 전원 사양은 380 V · 60 Hz이며, 이 모형의 코일 배치는 구조 관찰용으로 표현했습니다.',
    spec: `${MOTOR_SPEC.voltageV} V · ${MOTOR_SPEC.frequencyHz} Hz · ${MOTOR_SPEC.currentA} A`,
    material: '전기강판 · 구리 권선', role: '회전 자기장 형성',
    observation: '단면 보기에서 구리색 권선과 그 안쪽의 회전자를 함께 관찰해 보세요.', color: '#c9824c',
  },
  rotor: {
    number: '03', name: '회전자', english: 'Rotor',
    description: '고정자 안에서 축과 함께 회전하는 부품입니다. 명판의 모터 정격 회전수는 1,775 RPM입니다. 내부 도체와 철심은 유도 전동기의 개략 구조로 표현했습니다.',
    spec: `${MOTOR_SPEC.powerKw} kW · ${MOTOR_SPEC.ratedRpm.toLocaleString('en-US')} RPM`,
    material: '전기강판 · 도체 바', role: '전자기력을 회전력으로 변환',
    observation: '작동을 시작하면 회전자와 축이 함께 움직이는 모습을 볼 수 있습니다.', color: '#547ea3',
  },
  shaft: {
    number: '04', name: '회전축', english: 'Drive shaft',
    description: '11 kW 모터의 회전력을 부하로 전달하는 축입니다. 앞쪽은 출력축, 뒤쪽은 냉각 팬 연결부이며 앞뒤 베어링이 각각 축을 지지합니다.',
    spec: '앞쪽 출력축 · 뒤쪽 냉각 팬',
    material: '강철', role: '회전력 전달',
    observation: '모터 앞쪽으로 돌출된 은색 축과 축 표면의 키 홈을 찾아보세요.', color: '#9cabb5',
  },
  frontBell: {
    number: '05', name: '출력측 커버', english: 'Output end shield',
    description: '출력축 쪽에서 하우징을 닫고 큰 6309ZZ 베어링의 외륜을 지지하는 커버입니다. 분해도에서는 축과 베어링에서 분리해 조립 위치를 보여 줍니다.',
    spec: `출력측 ${MOTOR_SPEC.frontBearing} 지지부`,
    material: '주조 금속', role: '출력측 베어링 지지 · 하우징 밀폐',
    observation: '커버의 중심 구멍과 6309ZZ 베어링, 출력축이 같은 축선에 놓이는지 살펴보세요.', color: '#548c80',
  },
  bearing: {
    number: '06', name: '출력측 베어링', english: '6309ZZ',
    description: '사용자가 확인한 큰 베어링은 출력축 쪽의 6309ZZ입니다. 양쪽 금속 실드와 내·외륜을 표현하고, 팬측 6207ZZ와 서로 다른 크기로 구분했습니다.',
    spec: `${MOTOR_SPEC.frontBearing} · 45 × 100 × 25 mm`,
    material: '베어링강', role: '회전축 지지 · 마찰 감소',
    observation: '출력측의 큰 6309ZZ와 팬측의 작은 6207ZZ를 비교하세요. 치수 표기는 안지름 × 바깥지름 × 폭입니다.', color: '#b7c4cb',
  },
  rearBell: {
    number: '07', name: '팬측 엔드 커버', english: 'Fan end shield',
    description: '냉각 팬 쪽에서 하우징을 닫고 작은 6207ZZ 베어링을 지지하는 커버입니다. 분해도에서는 베어링, 냉각 팬, 팬 커버를 각각 떼어 볼 수 있습니다.',
    spec: `팬측 ${MOTOR_SPEC.rearBearing} 지지부`,
    material: '주조 금속', role: '팬측 베어링 지지 · 하우징 밀폐',
    observation: '하우징 뒤쪽부터 커버, 6207ZZ 베어링, 냉각 팬으로 이어지는 관계를 살펴보세요.', color: '#548c80',
  },
  rearBearing: {
    number: '08', name: '팬측 베어링', english: '6207ZZ',
    description: '사용자가 확인한 작은 베어링은 냉각 팬 쪽의 6207ZZ입니다. 출력측 6309ZZ보다 안지름과 바깥지름, 폭이 작으며, 양쪽 금속 실드를 표현합니다.',
    spec: `${MOTOR_SPEC.rearBearing} · 35 × 72 × 17 mm`,
    material: '베어링강', role: '회전축 지지 · 마찰 감소',
    observation: '크기가 다른 앞뒤 베어링과 각 베어링에 맞춰 굵기가 달라지는 축 지지부를 확인하세요.', color: '#a1b2be',
  },
  fan: {
    number: '09', name: '냉각 팬', english: 'Cooling fan',
    description: '모터 뒤쪽에서 회전축과 함께 움직이는 냉각용 팬입니다. 외부 공기를 냉각 핀으로 보내며, DATE-5# 송풍기의 임펠러와는 다른 부품입니다.',
    material: '수지 또는 금속', role: '냉각 공기 순환',
    observation: '모터 뒤쪽의 팬을 확인하고 정회전과 역회전에서 움직임을 비교해 보세요.', color: '#586d70',
  },
  fanCover: {
    number: '10', name: '팬 커버', english: 'Fan cover',
    description: '모터 뒤쪽 냉각 팬을 감싸는 보호 덮개입니다. 뒤쪽 통풍구로 공기가 들어가 팬과 하우징 냉각 핀 주변으로 흐르는 구성을 표현했습니다.',
    material: '금속 외함', role: '팬 보호 · 냉각 통풍',
    observation: '분해도에서 가장 뒤쪽의 팬 커버와 그 안쪽 냉각 팬을 각각 선택해 보세요.', color: '#4a726a',
  },
  terminal: {
    number: '11', name: '단자함', english: 'Terminal box',
    description: '380 V 전원과 모터 권선의 연결 단자를 담는 외함입니다. 측면 단자함과 케이블 입구를 표현했으며 내부 결선 방식은 제공된 명판 정보만으로 확정하지 않습니다.',
    spec: `${MOTOR_SPEC.voltageV} V · ${MOTOR_SPEC.currentA} A`,
    material: '금속 외함 · 절연 단자', role: '전원 연결부 보호',
    observation: '하우징 측면에 있는 사각형 박스와 전선이 들어가는 케이블 입구를 찾아보세요.', color: '#477d73',
  },
  terminalLid: {
    number: '12', name: '단자함 덮개', english: 'Terminal box lid',
    description: '측면 단자함의 바깥쪽을 닫는 별도 덮개입니다. 분해도에서는 덮개를 수평으로 분리해 내부의 단자 배치를 살펴볼 수 있도록 표현했습니다.',
    material: '금속 외함', role: '전원 연결부 보호',
    observation: '분해도에서 바깥쪽으로 분리된 덮개와 단자함 내부의 연결 단자를 함께 관찰하세요.', color: '#5a9185',
  },
});
