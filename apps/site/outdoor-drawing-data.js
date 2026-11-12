// Historical plans locate the liquid-factory utility row. They do not survey
// the 2026 equipment positions or resolve the three unmatched history cards.
const image = (name) => `./assets/drawings/outdoor/${name}.png`;
const plan = image('equipment-plan-2022');
const utility = image('utility-plan-2022');
const row = image('outdoor-equipment-row-2022');
const collector = image('collector-detail-2022');
const installation = image('installation-plan-2025');
const air = image('haccp-airflow-plan');

export const OUTDOOR_DRAWING_PHOTOS = Object.freeze([row, plan, utility, installation, air]);
export const OUTDOOR_DRAWING_CAPTIONS = Object.freeze({
  [plan]: '2022-05-03 · 유산동 액상공장 장비 배치도 · 건물 축 99,700 × 39,200mm',
  [utility]: '2022-05-03 · 유산동 액상공장 유틸리티 전체 계통도 · 당시 배관 계획',
  [row]: '2022-05-03 · 액상공장 외벽 설비열 확대 · 현재 사진·카드와 함께 대조',
  [collector]: '2022-05-03 · 폐수맨홀 → 집진기 → PET/액상 AHU · 개별 집진기 대응 미확정',
  [installation]: '2025 액상 증설 공사 첨부 · 유틸리티배관 현장 설치도 · 준공 실측 여부 미확인',
  [air]: '액상 HACCP 자료 · 공조설비 시트 · AHU1/CDU1·급기/환기 덕트 · 현재 카드 번호 대응 미확정',
});

const bindings = {
  'outdoor-100rt': {
    photos: [row, plan, utility],
    note: '2022 액상공장 도면의 외벽 모서리 100RT 냉각탑과 뒤따르는 냉각기 설비열을 현장 동선과 대조했습니다. 후반의 100RT 칠러 유니트와는 구분합니다.',
  },
  'outdoor-unit-1': { photos: [row, plan] },
  'outdoor-unit-2': { photos: [row, plan] },
  'outdoor-unit-3': { photos: [row, plan] },
  'outdoor-towers': {
    photos: [row, plan],
    note: '2022 도면에는 40RT 1차 냉각용 C/T 표기가 있습니다. 현장 고가 냉각탑의 현재 용량은 확정하지 않으며, 카드 092의 20RT 사각 외함이나 후반 카드 089의 40RT 칠러로 바꿔 부르지 않습니다.',
  },
  'outdoor-pump-pit': { photos: [collector, row] },
  'outdoor-vessel': { photos: [collector, row, installation] },
  'outdoor-pet-ahu': {
    photos: [row, plan, installation, air],
    note: '2022 도면의 기존 AHU 이설(PET+액상)이 집진기 뒤, 신설 AHU(스틱+치어팩) 앞에 놓입니다. 이 순서를 카드 085·현장 영상과 대조했습니다. 옛 공조설비 시트의 AHU1/CDU1 번호를 현재 카드 번호로 단정하지 않습니다.',
  },
  'outdoor-ahu': {
    photos: [row, plan, installation, air],
    note: '2022 도면은 기존 PET/액상 AHU와 신설 스틱/치어팩 AHU를 별도로 표시합니다. 현재 카드 084·085의 서로 다른 외형과 일치하는 두 선택 그룹으로 유지합니다.',
  },
  'outdoor-process-chiller': {
    photos: [row, plan, utility, installation],
    note: '2022 도면의 100RT 칠러 유니트는 두 AHU보다 뒤쪽에 있습니다. 현장 영상·카드 087의 후반 냉각설비와 순서를 대조했으며 배관의 정확한 연결·현 좌표는 확정하지 않았습니다.',
  },
};

export function bindOutdoorDrawing(item) {
  const binding = bindings[item.id];
  if (!binding) return item;
  return Object.freeze({
    ...item,
    photos: [...new Set([...(item.photos || []), ...binding.photos])],
    photoCaptions: { ...item.photoCaptions, ...OUTDOOR_DRAWING_CAPTIONS },
    details: [...(item.details || []), ...(binding.note ? [binding.note] : [])],
  });
}
