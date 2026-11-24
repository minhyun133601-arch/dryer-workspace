// Add a feature here after placing its independently runnable app in apps/<id>/.
export const MODULES = Object.freeze([
  Object.freeze({
    id: 'site', name: '희창유업 3D', kicker: 'HEECHANG FACTORY', number: '01',
    description: '홍보 영상의 공장 전경부터 건조실·실외기실까지, 건물과 설비 외형을 실제 자료와 비교하며 모델링하세요.',
    detail: '공장 전경 · 건조실 · 실외기실 · 배치 편집', entry: 'apps/site/index.html',
    icon: 'site', accent: 'green',
  }),
  Object.freeze({
    id: 'drawings', name: '도면 근거자료', kicker: 'DRAWING REVIEW', number: '02',
    description: '전체 도면을 한 장씩 넘겨 보고, 사용할 후보와 위치별 논의 내용을 같은 작업실에 기록하세요.',
    detail: '전체 미리보기 · 이전·다음 · 사용 후보 · 논의 기록', entry: 'apps/drawings/index.html',
    icon: 'drawings', accent: 'blue',
  }),
  Object.freeze({
    id: 'presentation', name: '발표용', kicker: 'DRYER PRESENTATION', number: '03',
    description: '건조실 1층부터 1.5층과 상부층을 둘러보고, 7층 버너의 구조 분해까지 자동으로 시연합니다.',
    detail: '건조실 전용 · 사람 시점 · 자동 시연', entry: 'apps/presentation/index.html',
    icon: 'presentation', accent: 'green',
  }),
]);

// A standalone export can be installed as apps/<id>/index.html at any time.
export const OPTIONAL_MODULES = Object.freeze([
  { id: 'motor', name: '모터 분해도', kicker: 'MOTOR LAB', description: '전동기 내부 부품과 조립 순서를 확인합니다.', detail: '3D 분해도 · 단면도', accent: 'blue' },
  { id: 'panel', name: '제어판', kicker: 'CONTROL PANEL', description: '제어반 부품의 위치와 실물 사진을 확인합니다.', detail: '부품 배치 · 사양', accent: 'green' },
  { id: 'heat-exchanger', name: '열교환기 시뮬레이터', kicker: 'HEAT RECOVERY', description: '공기 흐름과 운전 조건에 따른 열회수 효과를 확인합니다.', detail: '설비 구조 · 운전 조건', accent: 'blue' },
].map(module => Object.freeze({ ...module, entry: `apps/${module.id}/index.html` })));

export function installedModules(optionalIds = []) {
  const optional = OPTIONAL_MODULES.filter(module => optionalIds.includes(module.id));
  return [...MODULES, ...optional.map((module, i) => ({
    ...module, number: String(MODULES.length + i + 1).padStart(2, '0'),
  }))];
}

export function validateModules(modules) {
  const ids = new Set();
  for (const module of modules) {
    if (!/^[a-z][a-z0-9-]*$/.test(module.id) || ids.has(module.id)) {
      throw new Error(`기능 ID가 중복되거나 올바르지 않습니다: ${module.id}`);
    }
    if (!/^apps\/[a-z][a-z0-9-]*\/index\.html$/.test(module.entry) || !module.name) {
      throw new Error(`기능의 이름 또는 진입 경로를 확인하세요: ${module.id}`);
    }
    ids.add(module.id);
  }
  return modules;
}

validateModules(MODULES);
validateModules([...MODULES, ...OPTIONAL_MODULES]);

export function resolveRoute(hash, modules = MODULES) {
  const id = hash.replace(/^#\/?/, '').split(/[/?]/)[0];
  return modules.find((module) => module.id === id)?.id || 'home';
}
