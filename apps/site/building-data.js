import { EQUIPMENT as PHOTO_EQUIPMENT } from './data.js';
import { FLOORS, FLOOR_HEIGHT, LOWER_EQUIPMENT, floorElevation, floorHeight } from './facility-data.js';
import { DRYER_UPPER_OVERRIDES, DRYER_CONTINUITY_OVERRIDES, DRYER_UPPER_WELL, DRYER_ROOF_EQUIPMENT, DRYER_UPPER_OBSERVED_EQUIPMENT } from './dryer-upper-data.js';
import { registerDryerLowerEquipment } from './dryer-lower-registration.js';
import { PREPARATION_EQUIPMENT, registerPreparationEquipment } from './preparation-data.js';

export { FLOORS, FLOOR_HEIGHT, floorElevation, floorHeight };
// Keep source-photo records unchanged; the new plans/video locate the lower
// hall on 6F and its observation walkway on 7F.
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
]);
export const SITE_NOTE = '1팀 2파트 출입구에서 1.5층 탈의실·OP실·관찰 통로와 3층 설비 홀까지 연속 영상을 대조했습니다. 1.5층은 기존 2층 표기를 바로잡은 현장 명칭이며, 3층부터 실내 공간이 줄어듭니다. 1.5층에서 내려다보는 1층 외포장실의 설비·바닥과 조제실을 함께 표현합니다. 촬영된 도면은 변경 이력이 있는 참고 자료로 보존하며 현재 구획에 그대로 적용하지 않습니다. 외곽·표고와 설비 치수·좌표는 모델 비례이고 실측값이 아닙니다.';
export const floorById = (id) => FLOORS.find((floor) => floor.id === Number(id));
