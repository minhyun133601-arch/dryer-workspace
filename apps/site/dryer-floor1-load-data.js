import { floorElevation } from './facility-data.js';

// 1층 적재물(2026-11-26 사진 241장 · 공정순서 영상). 2팀 3층 렉·평치 적재물처럼
// 설비 목록에서 고르고 옮길 수 있게 한 항목들이다. 위치는 0.25 m 격자 위의 추정값이며,
// 파레트 배열(dryerLoad.pallets)은 항목 중심 기준 m 단위다.
const PLAN = './assets/drawings/dryer/dryer-floor-plan-1f.png';
const load = (id, name, tag, position, dryerLoad, summary, details, parts, photos) => Object.freeze({
  id, name, floor: 1, type: 'f1-load', tag, position: [position[0], floorElevation(1), position[1]], rotation: 0,
  labelHeight: (dryerLoad.baseHeight || 0) + 2.1, parts,
  photo: PLAN, photos: [PLAN],
  summary, details: [...details, `근거 사진(촬영 시각): ${photos.join(', ')} · 원본 references/현장사진_원본/건조실 1층·1.5층-20261126/`],
  sourceReferences: [{ fieldPhotos: photos, date: '2026-11-26' }],
  confidence: '2026-11-26 현장 사진 대조 · 수량·배열 대표값 · 위치 추정', positionBasis: 'photo-proportion', positionConfidence: 'approximate',
  dryerLoad: Object.freeze(dryerLoad),
});

export const DRYER_F1_LOAD_EQUIPMENT = Object.freeze([
  load('f1-load-shipping', '출하 대기 파레트', '출하 대기', [14.5, 15.0], {
    pallets: [[0, -1.95, 'carton', 6], [0, -.65, 'sack', 7], [0, .65, 'carton', 5], [0, 1.95, 'sack', 6]], zone: [1.5, 5.4],
  }, '랩핑을 마친 박스(NEW MILKY EXTRA 계열 골판지 상자)와 SCE 크라프트 포대 파레트를 외포장실 동쪽 통로 옆 노란 구획선 안에 세워 둡니다.',
  ['박스는 층마다 3×4로 엇갈려 쌓고 붉은 인쇄 띠를 둘렀습니다. 포대 파레트는 층마다 방향을 바꿔 6장씩 쌓았습니다.', '공정순서 영상 15:00~19:55의 로봇 적재·랩핑 장면을 함께 참고했습니다.'],
  ['빨간 플라스틱 파레트', '랩핑 박스 적재물', '랩핑 크라프트 포대 적재물', '노란 바닥 구획선'], ['102023', '102047', '101925']),
  load('f1-load-raw-store', '원료 포대 파레트 · 원료계량창고', '원료 포대 8', [22.25, 0], {
    pallets: [[-1.95, -.65, 'whiteSack', 7, 'blue'], [-1.95, .65, 'sack', 8, 'wood'], [-.65, -.65, 'yellowSack', 6, 'blue'], [-.65, .65, 'whiteSack', 9, 'wood'],
      [.65, -.65, 'sack', 7, 'pallet'], [.65, .65, 'whiteSack', 6, 'blue'], [1.95, -.65, 'yellowSack', 8, 'wood'], [1.95, .65, 'sack', 7, 'blue']], zone: [5.5, 2.85], wrapped: false,
  }, '원료계량창고 노란 구획선 안에 종류별 원료 포대 파레트 8개를 두 줄로 둡니다.',
  ['흰 포대·크라프트 포대·노란 포대를 파레트(파랑 플라스틱·나무·빨강 플라스틱)별로 나눴습니다.', '공정순서 영상 01:25~02:05의 원료 보관 장면을 참고했습니다. 실제 원료명은 확인하지 않았습니다.'],
  ['파레트 8개', '원료 포대', '노란 바닥 구획선'], ['101646', '102539']),
  load('f1-load-prep-sacks', '원료 포대 파레트 · 조제실 셔터 앞', '원료 포대 4', [30.25, 6.0], {
    pallets: [[-1.25, -.35, 'yellowSack', 5, 'blue'], [0, -.35, 'yellowSack', 6, 'blue'], [-1.25, .9, 'whiteSack', 4, 'wood'], [1.35, -.35, 'whiteSack', 5, 'blue']], wrapped: false,
  }, '조제실 내부 고속셔터 앞에 노란 포대와 흰 포대 파레트를 둡니다. 1.5층 관찰창에서 내려다본 사진 그대로입니다.',
  ['파레트 위치는 셔터 문 폭을 막지 않게 잡았습니다.'], ['파레트 4개', '노란·흰 원료 포대'], ['101646', '101649', '101652', '101702', '102539']),
  load('f1-load-empty-pallets', '빈 파레트 더미', '빈 파레트', [12.5, 20.5], {
    empties: [[-.65, 0, 'pallet', 9], [.65, 0, 'wood', 7]],
  }, '파레트 공급기 옆에 빨간 플라스틱 파레트와 나무 파레트를 쌓아 둡니다.', ['더미 높이는 사진 비례 대표값입니다.'],
  ['빨간 플라스틱 파레트 9장', '나무 파레트 7장'], ['102709', '102711', '101849']),
  load('f1-load-carton-blanks', '골판지 낱장 묶음 · 서쪽 벽', '골판지 묶음', [-7.5, 8.0], {
    blanks: [[0, -3.1, 1.45], [0, -1.75, 1.1], [-.05, 1.6, 1.4], [-.05, 2.9, 1.2]], zones: [[0, -2.4, 1.45, 2.8], [-.05, 2.25, 1.4, 2.7]],
  }, '제함기와 라인 시작부 옆 서쪽 벽에 래핑한 골판지 낱장 묶음 파레트를 세워 둡니다.', ['묶음 끈 두 줄과 필름 래핑을 표시했습니다.'],
  ['나무 파레트', '골판지 낱장 묶음', '필름 래핑·묶음 끈'], ['101816', '101819', '102713', '102723']),
]);
