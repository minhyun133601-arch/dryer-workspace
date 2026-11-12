// Employee: reproduce at the existing building-10 site beside the guardhouse.
// The 2022-03-09 NTM drawings describe the plant; the campus registration and
// the gap between old treatment, dewatering and extension are approximate.
export const WASTEWATER_DRAWING = Object.freeze({
  date: '2022-03-09', capacityCubicMetresPerDay: 200,
  sourceDirectory: 'references/wastewater-20261112/source',
  sheets: ['1. 유산 폐수처리장 계통도.pdf', '2. 유산 폐수처리장 측면 구조물 배치도.pdf', '3-1 유산 폐수처리장 평면 구조물 배치도.pdf'],
  extension: Object.freeze({ outerWidth: 14.9, wallThickness: .3, clearTankWidth: 7, clearTankDepth: 7, depth: 5, volumeEach: 245 }),
  existing: Object.freeze({ aerationVolumeEach: 187.5, aerationDepth: 5, clarifierVolume: 63, equalizationVolume: 102, equalizationDepth: 3.6, reactionVolumeEach: 3.3, sludgeVolume: 18, sumpVolume: 5, sumpDepth: 2.6 }),
  notes: [
    '증설 폭기조 번호는 평면도의 좌측 4·우측 3을 따릅니다. 측면도의 1·2 표기는 평면·계통도 번호와 다릅니다.',
    '14.9m, 7m, 300mm, 5m와 표기 용량은 도면값입니다. 기존 구역 외곽·설비 외형·동 사이 간격·대지 등록은 재현용 근사입니다.',
    '약품 공급·오니 반송·탈수 여액은 계통도에 따른 공정 연결이며, 보이지 않는 현장 매설 경로를 확정하지 않습니다.',
  ],
});

export const WASTEWATER_PROCESS = Object.freeze([
  { id: 'inlet', name: '폐수유입·집수정', next: 'equalization' },
  { id: 'equalization', name: '유량조정조·스크린', next: 'aeration-1-2' },
  { id: 'aeration-1-2', name: '기존 폭기조 1·2', next: 'aeration-3-4' },
  { id: 'aeration-3-4', name: '증설 폭기조 3·4', next: 'reaction' },
  { id: 'reaction', name: '반응·중화·응집조', next: 'clarifier' },
  { id: 'clarifier', name: '침전조', next: 'discharge' },
  { id: 'discharge', name: '방류조·방류', next: null },
]);
export const WASTEWATER_SLUDGE_PROCESS = Object.freeze(['침전조', '슬러지저류조', '슬러지개량조', '휠타프레스', '케익배출']);

// Local model dimensions/poses are reconstruction choices, separate from the
// certified drawing dimensions above. The extension keeps its 14.9m width.
export const WASTEWATER_LAYOUT = Object.freeze({
  width: 44, depth: 14, height: 6.5,
  existingAeration: [
    { id: '1', x: -19.05, z: 2.05, width: 5, depth: 7.5, floor: -5, rim: .3, volume: 187.5, sharedRightWall: true },
    { id: '2', x: -13.75, z: 2.05, width: 5, depth: 7.5, floor: -5, rim: .3, volume: 187.5 },
  ],
  extensionAeration: [
    { id: '4', x: 10.3, z: .2, width: 7, depth: 7, floor: -5, rim: .3, volume: 245, sharedRightWall: true },
    { id: '3', x: 17.6, z: .2, width: 7, depth: 7, floor: -5, rim: .3, volume: 245 },
  ],
  clarifier: { x: -7.8, z: 1.5, radius: 2.5, bottom: -1.25, rim: 2.05, volume: 63 },
  equalization: { x: -7.8, z: 1.5, width: 5.2, depth: 5.45, bottom: -5.1, rim: -1.5, volume: 102 },
});
