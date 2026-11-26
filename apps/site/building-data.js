import { EQUIPMENT as PHOTO_EQUIPMENT } from './data.js';
import { FLOORS, FLOOR_HEIGHT, LOWER_EQUIPMENT, floorElevation, floorHeight } from './facility-data.js';
import { DRYER_UPPER_OVERRIDES, DRYER_CONTINUITY_OVERRIDES, DRYER_UPPER_WELL, DRYER_ROOF_EQUIPMENT, DRYER_UPPER_OBSERVED_EQUIPMENT } from './dryer-upper-data.js';
import { registerDryerLowerEquipment } from './dryer-lower-registration.js';
import { PREPARATION_EQUIPMENT, registerPreparationEquipment } from './preparation-data.js';
import { DRYER_F1_LOAD_EQUIPMENT } from './dryer-floor1-load-data.js';

export { FLOORS, FLOOR_HEIGHT, floorElevation, floorHeight };
// Keep source-photo records unchanged; the new plans/video locate the lower
// hall on 6F and its observation walkway on 7F.
// 2026-11-24 field cards that no earlier catalog item covers. Cards 11 and 12
// stand in the 1F clean room beside packer 3 (background of cards 05–07); card 20
// is the tank south of the plate exchangers. Plan positions are estimated.
const DRYER_CARD_EQUIPMENT = Object.freeze([Object.freeze({
  id: 'f1-bag-line', name: '지대 충진기·씰링기', floor: 1, type: 'bag-line', tag: '지대 충진·씰링', position: [8.5, floorElevation(1), -2.25], rotation: 0, labelHeight: 4.6,
  parts: ['점검 데크·기둥·난간', '충진 호퍼·지대 클램프', '저울·롤러·벨트 컨베이어', '재봉 헤드·밴드 씰링기'],
  photo: './assets/drawings/dryer/dryer-floor-plan-1f.png', photos: ['./assets/drawings/dryer/dryer-floor-plan-1f.png'],
  summary: '현장등록카드 11번(지대 충진기)·12번(지대씰링기) 사진의 원뿔 호퍼와 지대 클램프, 저울 표시기, 재봉 헤드의 붉은 실, 온도조절기 12개와 후드가 달린 밴드 씰링기, SCE 지대를 재현했습니다.',
  details: ['카드 표기 위치는 청정실(1층)이며 카드 05~07번 배경에서 이카 3호 옆 데크로 보입니다. 평면 좌표와 치수는 사진 비례 추정입니다.'],
  sourceReferences: [{ cardNumbers: [11, 12], recordedLocation: '청정실(1층)' }],
  confidence: '2026-11-24 현장등록카드 11·12번 대조 · 위치·치수 추정', positionBasis: 'field-card-background-beside-packer-3', positionConfidence: 'approximate',
}), Object.freeze({
  id: 'f3-agitator-tank', name: '교반 탱크', floor: 3, type: 'agitator-tank', tag: '교반 탱크 · 20', position: [-7, floorElevation(3), 7.5], rotation: Math.PI / 2, labelHeight: 4.4,
  parts: ['2단 보온 외함·다리', '상부 교반기·노즐', '은색 배관·하부 출구'],
  photo: './assets/drawings/dryer/dryer-floor-plan-3f.png', photos: ['./assets/drawings/dryer/dryer-floor-plan-3f.png'],
  summary: '현장등록카드 20번(카드 2층 = 사이트 3층) 사진의 두 겹 외함 탱크입니다. 위쪽 교반기, 원형 다리 받침, 옆 점검구와 긴 은색 배관을 재현했습니다.',
  details: ['카드 20번 좌·우측 사진에서 살균기 열교환기 남쪽, 열수탱크와 같은 창가 줄에 있습니다. 좌표와 치수는 사진 비례 추정입니다.'],
  sourceReferences: [{ cardNumbers: [20], recordedLocation: '2층' }],
  confidence: '2026-11-24 현장등록카드 20번 대조 · 위치·치수 추정', positionBasis: 'field-card-20-window-bay-order', positionConfidence: 'approximate',
})]);
const replacedLowerIds = new Set(['f6-dryer-shell', 'f6-cyclone-bank', 'f6-exhaust-riser']);
export const EQUIPMENT = Object.freeze([
  ...LOWER_EQUIPMENT.filter(item => !replacedLowerIds.has(item.id)).map(item => {
    const override = DRYER_CONTINUITY_OVERRIDES[item.id];
    if (!override) return registerPreparationEquipment(registerDryerLowerEquipment(item));
    const { sourceDetails = [], ...model } = override;
    return registerPreparationEquipment(registerDryerLowerEquipment(Object.freeze({ ...item, ...model, details: [...item.details, ...sourceDetails] })));
  }),
  ...PHOTO_EQUIPMENT.map((item) => {
    const { additionalPhotos = [], sourceDetails = [], ...model } = DRYER_UPPER_OVERRIDES[item.id];
    return Object.freeze({
      ...item, ...model,
      photos: [...new Set([...item.photos, ...additionalPhotos])],
      details: [...item.details.filter((text) => !text.includes('기존 제어판 화면으로 이동')), ...sourceDetails],
    });
  }),
  DRYER_UPPER_WELL,
  ...DRYER_UPPER_OBSERVED_EQUIPMENT,
  ...DRYER_ROOF_EQUIPMENT,
  ...PREPARATION_EQUIPMENT,
  ...DRYER_CARD_EQUIPMENT,
  ...DRYER_F1_LOAD_EQUIPMENT,
]);
export const SITE_NOTE = '1층은 충전·외포장·조제실, 1.5층은 탈의실·OP실·관찰 통로이며, 층별 보기에서는 각 층의 공간을 구분합니다. 사람 시점에서 관찰창 아래로 보이는 생산설비는 1층에 있습니다. 1.5층은 기존 2층 표기를 바로잡은 현장 명칭이며, 3층부터 실내 공간이 줄어듭니다. 조제실과 보일러실 사이에는 직접 연결문이 없습니다. 촬영된 도면은 변경 이력이 있는 참고 자료로 보존하며 현재 구획에 그대로 적용하지 않습니다. 외곽·표고와 설비 치수·좌표는 모델 비례이고 실측값이 아닙니다.';
export const floorById = (id) => FLOORS.find((floor) => floor.id === Number(id));
