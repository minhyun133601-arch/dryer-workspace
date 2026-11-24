const STORAGE_KEY = 'dryer-facility-layout-v1';
// The 11/12 user browser still kept MIX-1 at [-7.25, -8] after the exact
// [-7, -8] repair (preparation-data.js) had stamped its save. Hanging tanks saved outside the
// preparation deck by any earlier release now return to their openings once,
// without repeating reviewed area corrections. Manual moves, turns and
// imports saved by this release remain intentional.
const CATALOG_REVISION = 'preparation-tank-openings-20261112';
const MISSING_TANK_REVISION = 'preparation-missing-tank-20261112';
const PREVIOUS_PREPARATION_REVISION = 'preparation-room-current-layout-20261111';
const COMPLETED_PREPARATION_REVISION = 'preparation-complete-20261111';
const OUTDOOR_CATALOG_REVISION = 'outdoor-video-20261102';
const REVIEWED_OUTDOOR_REVISIONS = new Set([OUTDOOR_CATALOG_REVISION, 'yusan-campus-20261109', 'stick-packaging-3f-20261109', 'stick-packaging-floors-20261110', 'team2-cards-20261110', 'team2-transport-20261110', 'team3-outdoor-cards-20261110', 'outdoor-condenser-position-20261110', 'outdoor-campus-full-length-20261110', 'dryer-upper-roof-20261110', 'dryer-full-envelope-20261110', 'dryer-full-envelope-final-20261110', 'liquid-card-detail-spacing-20261110', 'campus-rear-video-placement-20261111', 'campus-rear-identities-20261111', 'campus-valve-interior-20261111', CATALOG_REVISION]);
const REVIEWED_OUTDOOR_POSITION_REVISIONS = new Set(['outdoor-condenser-position-20261110', 'outdoor-campus-full-length-20261110', 'dryer-upper-roof-20261110', 'dryer-full-envelope-20261110', 'dryer-full-envelope-final-20261110', 'liquid-card-detail-spacing-20261110', 'campus-rear-video-placement-20261111', 'campus-rear-identities-20261111', 'campus-valve-interior-20261111', CATALOG_REVISION]);
const REVIEWED_CAMPUS_REVISIONS = new Set(['outdoor-campus-full-length-20261110', 'dryer-upper-roof-20261110', 'dryer-full-envelope-20261110', 'dryer-full-envelope-final-20261110', 'liquid-card-detail-spacing-20261110', 'campus-rear-video-placement-20261111', 'campus-rear-identities-20261111', 'campus-valve-interior-20261111', CATALOG_REVISION]);
const REVIEWED_DRYER_REVISIONS = new Set(['dryer-full-envelope-final-20261110', 'liquid-card-detail-spacing-20261110', 'campus-rear-video-placement-20261111', 'campus-rear-identities-20261111', 'campus-valve-interior-20261111', CATALOG_REVISION]);
for (const reviewed of [REVIEWED_OUTDOOR_REVISIONS, REVIEWED_OUTDOOR_POSITION_REVISIONS, REVIEWED_CAMPUS_REVISIONS, REVIEWED_DRYER_REVISIONS]) {
  reviewed.add('campus-office-lpg-restoration-20261111');
  reviewed.add(PREVIOUS_PREPARATION_REVISION);
  reviewed.add(COMPLETED_PREPARATION_REVISION);
  reviewed.add(MISSING_TANK_REVISION);
}
const RETIRED_CAMPUS_IDS = new Set(['campus-rear-warehouse', 'campus-front-warehouse', 'campus-front-office']);
// 2026-11-24 위치도·층 대조에서 원통 호퍼·교반기는 2층 호퍼로, 현수 분배함은 시프트로 합쳐졌다.
const RETIRED_PACKAGING_IDS = new Set(['packaging-air-unit', 'packaging-cip-area', 'packaging-mixer-sieve-4',
  'packaging-round-process', 'packaging-card-hopper-1', 'packaging-card-hopper-2', 'packaging-card-hopper-3', 'packaging-suspended-distribution']);
const RETIRED_DRYER_IDS = new Set(['f6-dryer-shell', 'f6-cyclone-bank', 'f6-exhaust-riser']);
const copyLayout = (layout) => layout.map(({ id, position, rotation }) => ({ id, position: [...position], rotation }));
const sameLayout = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const normalizedAngle = (value) => ((value + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;

// Imported files can move equipment on its own floor, never change its height
// or create unknown/duplicate objects. Partial files retain other defaults.
export function validateLayout(payload, equipment, { migrateDefaults = false, migrateOutdoorDefaults = true, migrateOutdoorPositions = true, migrateCampusDefaults = true, migrateDryerDefaults = true, sourceCatalogRevision = payload?.catalogRevision, sourcePlacementRevisions = payload?.placementRevisions } = {}) {
  if (payload && !Array.isArray(payload) && payload.version !== 1) throw new Error('지원하지 않는 배치 파일 버전입니다.');
  const values = Array.isArray(payload) ? payload : payload?.items;
  if (!Array.isArray(values)) throw new Error('배치 항목을 찾을 수 없습니다.');
  const catalog = new Map(equipment.map((item) => [item.id, item]));
  const seen = new Set();
  const records = new Map();
  for (const value of values) {
    const original = catalog.get(value?.id);
    // The employee removed these surrounding buildings from the current site.
    // Old saved/exported layouts may still include them; discard only those
    // known retired records and keep all other unknown-ID checks intact.
    if (!original && (RETIRED_CAMPUS_IDS.has(value?.id) || RETIRED_PACKAGING_IDS.has(value?.id) || RETIRED_DRYER_IDS.has(value?.id))) continue;
    if (!original || seen.has(value.id)) throw new Error('알 수 없거나 중복된 설비가 있습니다.');
    const coordinateLimit = original.floor === 'campus' ? 250 : 100;
    if (!Array.isArray(value.position) || value.position.length !== 3 ||
        !value.position.every(Number.isFinite) || !Number.isFinite(value.rotation) ||
        Math.abs(value.position[0]) > coordinateLimit || Math.abs(value.position[2]) > coordinateLimit) {
      throw new Error(`좌표는 -${coordinateLimit}~${coordinateLimit} 사이의 숫자여야 합니다.`);
    }
    seen.add(value.id);
    // A placement-only correction can arrive without changing the global
    // catalog release. Once stamped, a later edit/import at an old default is
    // intentional and must not replay that item's correction on another load.
    const migrateItemDefaults = migrateDefaults && (!original.placementRevision ||
      sourcePlacementRevisions?.[original.id] !== original.placementRevision);
    // A coupled pose correction applies only when both the saved position and
    // facing match one complete historical pose. A user's move or turn keeps
    // the entire pose. Explicit imports never apply catalog migrations.
    const migrateDryer = !Number.isFinite(original.floor) || migrateDryerDefaults;
    const migratePosition = migrateItemDefaults && migrateDryer && (original.floor !== 'outdoor' || migrateOutdoorPositions) &&
      (original.floor !== 'campus' || migrateCampusDefaults);
    // Building Y belongs to the floor datum. Restoration normalizes it before
    // default migration, so compare only X/Z when matching a building pose.
    const matchesPosition = (position) => value.position.every((coordinate, index) =>
      (index === 1 && Number.isFinite(original.floor)) || coordinate === position[index]);
    const preparationCorrection = original.floor === 1 && !!original.preparation;
    const dryerRouteCorrection = !!original.dryerRoute && (original.floor === 3 ||
      (original.floor === 1 && ['overlook-packing-cubicle', 'overlook-inspection', 'overlook-roller-collector', 'overlook-roller-return', 'overlook-articulated-arm'].includes(original.dryerRoute.kind)));
    const usesPreviousPlacement = migrateItemDefaults && (migrateDryer || preparationCorrection || dryerRouteCorrection) && Number.isFinite(original.rotation) &&
      (Array.isArray(original.previousPlacements) ? original.previousPlacements : []).some((placement) =>
        // Qualified campus/preparation/filmed-route poses introduce a specific correction
        // without replaying already-reviewed area migrations.
        (migratePosition || ((original.floor === 'campus' || (preparationCorrection && placement.migrationBasis === 'preparation-video-default') || (dryerRouteCorrection && placement.migrationBasis === 'dryer-route-video-default')) && typeof placement?.catalogRevision === 'string' && placement.catalogRevision.length > 0 && placement.catalogRevision === sourceCatalogRevision)) &&
        (!placement?.catalogRevision || placement.catalogRevision === sourceCatalogRevision) &&
        (!placement?.alreadyReviewedAt || placement.alreadyReviewedAt !== sourcePlacementRevisions?.[original.id]) &&
        Array.isArray(placement?.position) && placement.position.length === 3 && placement.position.every(Number.isFinite) &&
        Number.isFinite(placement.rotation) && matchesPosition(placement.position) &&
        (placement.catalogRevision ? normalizedAngle(value.rotation - placement.rotation) === 0 :
          Math.abs(normalizedAngle(value.rotation - placement.rotation)) < 1e-8));
    // Existing independent position/facing migrations remain available for
    // catalogs that intentionally revise only one component of their default.
    const oldPositions = [original.previousPosition, ...(original.previousPositions || [])];
    const usesPreviousPosition = migratePosition && oldPositions.some((position) => Array.isArray(position) &&
      position.length === 3 && position.every(Number.isFinite) &&
      matchesPosition(position));
    const usesPreviousDefault = migrateItemDefaults && migrateDryer && (original.floor !== 'outdoor' || migrateOutdoorDefaults) &&
      (original.floor !== 'campus' || migrateCampusDefaults) && Number.isFinite(original.previousRotation) &&
      Number.isFinite(original.rotation) && Math.abs(normalizedAngle(value.rotation - original.previousRotation)) < 1e-8;
    // The earlier requested LPG-side office repair still applies to older
    // profiles. Preparation releases have already reviewed that position, so
    // preserve their later office edits along with explicit imports.
    const usesRequestedRestoration = migrateItemDefaults && !!original.restorePlacementRevision && sourceCatalogRevision !== original.restorePlacementRevision && sourceCatalogRevision !== PREVIOUS_PREPARATION_REVISION && sourceCatalogRevision !== COMPLETED_PREPARATION_REVISION && sourceCatalogRevision !== MISSING_TANK_REVISION && sourceCatalogRevision !== CATALOG_REVISION;
    // A hanging tank exists only in its deck opening. Any earlier-release pose
    // outside the deck (old OWP poses and their automatic clamps, whatever the
    // exact value) left an empty opening and a floating body, so it returns
    // with its whole catalog pose. Poses on the deck are left as saved.
    const deck = original.hangingDeck;
    const strandedOffDeck = migrateItemDefaults && !!deck && sourceCatalogRevision !== CATALOG_REVISION &&
      !(value.position[0] >= deck.minX && value.position[0] <= deck.maxX && value.position[2] >= deck.minZ && value.position[2] <= deck.maxZ);
    // A floor redrawn from its posted plan moved walls, decks and openings
    // together, so poses saved against the former plan no longer describe any
    // real place. They take the new plan once; later moves stay as saved.
    const reviewedPlan = original.planRebuildReviewedRevision;
    const rebuiltFromPlan = migrateItemDefaults && original.planRebuild === true &&
      (!reviewedPlan || sourcePlacementRevisions?.[original.id] !== reviewedPlan);
    const position = rebuiltFromPlan || usesRequestedRestoration || strandedOffDeck || usesPreviousPlacement || usesPreviousPosition ? original.position : value.position;
    const rotation = rebuiltFromPlan || usesRequestedRestoration || strandedOffDeck || usesPreviousPlacement || usesPreviousDefault ? original.rotation : value.rotation;
    records.set(value.id, { id: value.id, position: [position[0], original.position[1], position[2]], rotation: normalizedAngle(rotation) });
  }
  return equipment.map((item) => records.get(item.id) || { id: item.id, position: [...item.position], rotation: item.rotation || 0 });
}

export function createLayoutHistory(initial, limit = 40) {
  let states = [copyLayout(initial)];
  return {
    push(layout) {
      const value = copyLayout(layout);
      if (sameLayout(states[states.length - 1], value)) return false;
      states.push(value);
      if (states.length > limit + 1) states.shift();
      return true;
    },
    undo() { if (states.length < 2) return null; states.pop(); return copyLayout(states[states.length - 1]); },
    get canUndo() { return states.length > 1; },
    current() { return copyLayout(states[states.length - 1]); },
  };
}

export function createLayoutEditor({ scene, equipment, container, onChange = () => {} }) {
  const catalog = new Map(equipment.map((item) => [item.id, item]));
  const placementRevisions = Object.fromEntries(equipment.filter(item => typeof item.placementRevision === 'string' && item.placementRevision.length)
    .map(item => [item.id, item.placementRevision]));
  const defaults = equipment.map((item) => ({ id: item.id, position: [...item.position], rotation: item.rotation || 0 }));
  const doc = container.ownerDocument;
  const listeners = [];
  let selected = null, enabled = false, disposed = false, dragStart = null;
  let storage;
  try { storage = window.localStorage; } catch { /* Private/local file sessions may disable storage. */ }

  const element = (tag, className, text) => {
    const node = doc.createElement(tag); if (className) node.className = className;
    if (text) node.textContent = text; return node;
  };
  const listen = (node, type, callback) => {
    node.addEventListener(type, callback); listeners.push(() => node.removeEventListener(type, callback));
  };
  const button = (label, action, className = '') => {
    const node = element('button', className, label); node.type = 'button';
    listen(node, 'click', action); return node;
  };
  const root = element('section', 'layout-editor'); root.setAttribute('aria-label', '설비 배치 편집');
  const header = element('div', 'layout-editor-header');
  const toggle = button('배치 편집', () => setEnabled(!enabled), 'layout-edit-toggle');
  toggle.setAttribute('aria-pressed', 'false');
  const status = element('span', 'layout-save-status', '이 브라우저에 자동 저장');
  status.setAttribute('role', 'status');
  header.append(toggle, status);
  const body = element('div', 'layout-editor-body'); body.hidden = true;
  const help = element('p', 'layout-edit-help', '설비를 끌면 격자에 맞춰 이동합니다. 이동 칸 수를 고른 뒤 버튼이나 방향키로 이동 · Shift+방향키는 5배 · 회전은 15° 단위 · 자동 저장');
  help.id = 'layout-move-help';
  const title = element('strong', 'layout-selected-name', '이동할 설비를 선택하세요');
  const region = element('p', 'layout-region-info', '설비를 선택하면 정해진 이동 영역을 확인할 수 있습니다.');
  region.id = 'layout-placement-rules';
  const inputs = element('div', 'layout-coordinate-inputs');
  const fields = {};
  const rotationButtons = [];
  for (const [key, label, step] of [['x', '가로', '.25'], ['z', '세로', '.25'], ['rotation', '회전 (°)', '15']]) {
    const wrapper = element(key === 'rotation' ? 'div' : 'label', 'layout-coordinate'); wrapper.append(element('span', '', label));
    const input = element('input'); input.type = 'number'; input.step = step;
    if (key !== 'rotation' && !scene.setPlacementCoordinates) { input.min = '-100'; input.max = '100'; }
    input.setAttribute('aria-label', label); input.dataset.layoutField = key; input.disabled = true;
    input.setAttribute('aria-describedby', region.id);
    wrapper.append(input); inputs.append(wrapper); fields[key] = input;
    if (key === 'rotation') {
      wrapper.classList.add('layout-rotation-coordinate');
      for (const [label, delta] of [['−15°', -15], ['+15°', 15]]) {
        const rotate = button(label, () => rotateBy(delta), 'layout-rotate-button');
        rotate.setAttribute('aria-label', `회전 각도 15도 ${delta < 0 ? '감소' : '증가'}`);
        rotate.disabled = true; rotationButtons.push(rotate); wrapper.append(rotate);
      }
    }
    listen(input, 'change', updateNumbers);
  }
  const nudges = element('div', 'layout-step-controls');
  const moveCountLabel = element('label', 'layout-move-count-label');
  moveCountLabel.append(element('span', '', '한 번에 이동'));
  const moveCount = element('select', 'layout-move-count');
  moveCount.dataset.layoutMoveCount = '';
  moveCount.setAttribute('aria-label', '한 번에 이동할 칸 수');
  for (const count of [1, 2, 5, 10]) {
    const option = element('option', '', `${count}칸`); option.value = String(count); moveCount.append(option);
  }
  moveCount.value = '1';
  moveCountLabel.append(moveCount); nudges.append(moveCountLabel);
  listen(moveCount, 'change', syncFields);
  const gridInfo = element('span', 'layout-grid-info', '1칸 = 0.25 모델 단위');
  const moveButtons = [];
  for (const [axis, name] of [['x', '가로'], ['z', '세로']]) {
    for (const direction of [-1, 1]) {
      const move = button(`${name} ${direction < 0 ? '−' : '+'}1칸`, () => moveBy(axis, direction), 'layout-move-button');
      move.dataset.layoutAxis = axis; move.dataset.layoutDirection = String(direction);
      move.disabled = true; moveButtons.push(move); nudges.append(move);
    }
  }
  nudges.append(gridInfo);
  const actions = element('div', 'layout-editor-actions');
  const undo = button('되돌리기', () => {
    if (!enabled) return;
    const value = history.undo(); if (!value) return;
    scene.setLayout(value); changed('이전 배치로 되돌렸습니다.', false);
  });
  const resetSelected = button('선택 설비 원위치', () => {
    if (!enabled || !selected) return;
    const original = defaults.find((item) => item.id === selected);
    scene.setTransform(selected, { position: [...original.position], rotation: original.rotation });
    changed('선택 설비를 원래 위치로 옮겼습니다.');
  });
  const resetAll = button('원래 배치', () => { if (enabled) { scene.setLayout(defaults); changed('전체를 원래 배치로 되돌렸습니다.'); } });
  const download = button('배치 파일 저장', () => {
    const data = { version: 1, items: scene.getLayout() };
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const link = element('a'); link.href = url; link.download = '건조기-설비-배치.json';
    doc.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000); announce('현재 배치를 파일로 저장했습니다.');
  });
  const file = element('input'); file.type = 'file'; file.accept = '.json,application/json'; file.hidden = true;
  file.setAttribute('aria-label', '배치 JSON 파일 선택');
  const upload = button('불러오기', () => file.click());
  listen(file, 'change', async () => {
    const chosen = file.files?.[0]; if (!chosen) return;
    try {
      if (chosen.size > 1024 * 1024) throw new Error('배치 파일은 1MB 이하만 사용할 수 있습니다.');
      const layout = validateLayout(JSON.parse(await chosen.text()), equipment);
      if (disposed || !enabled) return;
      if (scene.setLayout(layout) === false) throw new Error('이 배치는 정해진 영역에 적용할 수 없습니다.');
      changed(sameLayout(layout, scene.getLayout()) ? '배치 파일을 불러왔습니다.' : '배치를 격자와 이동 영역에 맞춰 불러왔습니다.');
    } catch (error) { announce(error instanceof SyntaxError ? 'JSON 배치 파일을 읽을 수 없습니다.' : error.message, true); }
    finally { file.value = ''; }
  });
  actions.append(undo, resetSelected, resetAll, download, upload, file);
  const message = element('p', 'layout-edit-message'); message.setAttribute('role', 'status'); message.hidden = true;
  body.append(help, title, region, inputs, nudges, actions, message); root.append(header, body); container.append(root);

  let restored = false, adjustedRestore = false, revisionRestore = false, retiredRestore = false;
  try {
    const saved = storage?.getItem(STORAGE_KEY);
    if (saved) {
      const payload = JSON.parse(saved);
      const savedItems = Array.isArray(payload) ? payload : payload?.items;
      retiredRestore = Array.isArray(savedItems) && savedItems.some((value) => !catalog.has(value?.id) && (RETIRED_CAMPUS_IDS.has(value?.id) || RETIRED_PACKAGING_IDS.has(value?.id) || RETIRED_DRYER_IDS.has(value?.id)));
      const storedLayout = validateLayout(payload, equipment);
      revisionRestore = payload?.catalogRevision !== CATALOG_REVISION || Object.entries(placementRevisions)
        .some(([id, revision]) => payload?.placementRevisions?.[id] !== revision);
      // That revision already processed the outdoor-facing correction. An old
      // facing saved or manually imported afterwards was intentional; a campus
      // update must not apply the outdoor correction for a second time.
      const layout = validateLayout(storedLayout, equipment, {
        migrateDefaults: revisionRestore,
        sourceCatalogRevision: payload?.catalogRevision,
        sourcePlacementRevisions: payload?.placementRevisions,
        migrateOutdoorDefaults: !REVIEWED_OUTDOOR_REVISIONS.has(payload?.catalogRevision),
        // A later campus update must also retain outdoor positions and complete
        // poses explicitly imported after their own correction was reviewed.
        migrateOutdoorPositions: !REVIEWED_OUTDOOR_POSITION_REVISIONS.has(payload?.catalogRevision),
        migrateCampusDefaults: !REVIEWED_CAMPUS_REVISIONS.has(payload?.catalogRevision),
        // Reviewed numeric-floor poses remain intentional. Preparation and
        // the filmed dryer route have exact, revision-qualified exceptions.
        migrateDryerDefaults: !REVIEWED_DRYER_REVISIONS.has(payload?.catalogRevision),
      });
      if (scene.setLayout(layout) === false) throw new Error('invalid-layout');
      restored = true; adjustedRestore = !sameLayout(storedLayout, scene.getLayout());
    }
  } catch { announce('저장된 배치를 읽지 못해 기본 배치로 열었습니다.', true); }
  const history = createLayoutHistory(scene.getLayout());
  undo.disabled = true; resetSelected.disabled = true;
  if (restored) {
    if (adjustedRestore || revisionRestore || retiredRestore) persist();
    if (adjustedRestore) announce('저장한 배치를 최신 설비 기준과 이동 영역에 맞췄습니다.');
    status.textContent = '저장한 배치를 불러왔습니다'; onChange(scene.getLayout());
  }

  function announce(text, error = false) {
    message.textContent = text; message.hidden = !text; message.classList.toggle('error', error);
  }
  function syncFields() {
    const item = catalog.get(selected);
    const current = scene.getLayout().find((entry) => entry.id === selected);
    const info = selected ? scene.getPlacementInfo?.(selected) : null;
    title.textContent = item?.name || '이동할 설비를 선택하세요';
    region.textContent = item
      ? `${info?.regionLabel || (item.floor === 'outdoor' ? '실외기실 영역' : `${item.floor || ''}층 영역`)} · 가로·세로는 영역 기준 · 높이 고정 · 처음 방향 0°`
      : '설비를 선택하면 정해진 이동 영역을 확인할 수 있습니다.';
    const step = info?.step || .25, angleStep = info?.angleDegrees || 15;
    const count = movementCount();
    gridInfo.textContent = `1칸 = ${step} 모델 단위 · 굵은 선 4칸`;
    moveCount.disabled = !enabled;
    fields.x.step = fields.z.step = String(step); fields.rotation.step = String(angleStep);
    for (const input of Object.values(fields)) input.disabled = !item || !enabled;
    for (const rotate of rotationButtons) rotate.disabled = !item || !enabled;
    for (const move of moveButtons) {
      move.disabled = !item || !enabled;
      const name = move.dataset.layoutAxis === 'x' ? '가로' : '세로';
      const decreasing = move.dataset.layoutDirection === '-1';
      move.textContent = `${name} ${decreasing ? '−' : '+'}${count}칸`;
      move.setAttribute('aria-label', `${name} ${count}칸 ${decreasing ? '감소' : '증가'}`);
    }
    resetSelected.disabled = !item || !enabled;
    if (current) {
      const position = info?.position || current.position;
      fields.x.value = String(Math.round(position[0] * 100) / 100);
      fields.z.value = String(Math.round(position[2] * 100) / 100);
      fields.rotation.value = String(Math.round((info?.rotationDegrees ?? normalizedAngle(current.rotation) * 180 / Math.PI) * 10) / 10);
    } else for (const input of Object.values(fields)) input.value = '';
    undo.disabled = !history.canUndo || !enabled;
  }
  function persist() {
    try {
      if (!storage) throw new Error('storage-unavailable');
      storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, catalogRevision: CATALOG_REVISION, placementRevisions, items: scene.getLayout() }));
      status.textContent = '이 브라우저에 저장됨';
    } catch { status.textContent = '배치 파일로 저장해 주세요'; }
  }
  function changed(text, record = true) {
    const value = scene.getLayout(); if (record) history.push(value);
    persist(); syncFields(); onChange(value); if (text) announce(text);
  }
  function updateNumbers() {
    if (!enabled || !selected) return;
    const current = scene.getLayout().find((item) => item.id === selected);
    const x = Number(fields.x.value), z = Number(fields.z.value), degrees = Number(fields.rotation.value);
    if ([fields.x, fields.z, fields.rotation].some((input) => input.value.trim() === '') ||
        ![x, z, degrees].every(Number.isFinite) ||
        (!scene.setPlacementCoordinates && (Math.abs(x) > 100 || Math.abs(z) > 100))) {
      announce('가로·세로와 회전 값을 숫자로 입력하세요.', true); syncFields(); return;
    }
    const result = scene.setPlacementCoordinates
      ? scene.setPlacementCoordinates(selected, { x, z, rotationDegrees: degrees })
      : scene.setTransform(selected, { position: [x, current.position[1], z], rotation: normalizedAngle(degrees * Math.PI / 180) });
    if (result === false) { announce('이 위치나 방향은 정해진 영역에 들어가지 않습니다.', true); syncFields(); return; }
    changed(placementMessage('위치와 방향을 규격에 맞춰 저장했습니다.'));
  }
  function placementMessage(fallback) { return scene.getPlacementInfo?.(selected)?.message || fallback; }
  function movementCount() { return [1, 2, 5, 10].includes(Number(moveCount.value)) ? Number(moveCount.value) : 1; }
  function moveBy(axis, direction, multiplier = 1) {
    if (!enabled || !selected) return;
    const current = scene.getLayout().find((item) => item.id === selected);
    const info = scene.getPlacementInfo?.(selected);
    const position = info?.position || current.position, step = info?.step || .25;
    const count = movementCount() * multiplier;
    // Catalog measurements may predate the grid. Align once before counting
    // whole cells so repeated forward/backward nudges use identical targets.
    const alignedX = Math.round(position[0] / step) * step;
    const alignedZ = Math.round(position[2] / step) * step;
    const aligning = Math.abs(alignedX - position[0]) > 1e-8 || Math.abs(alignedZ - position[2]) > 1e-8;
    const x = alignedX + (axis === 'x' ? direction * count * step : 0);
    const z = alignedZ + (axis === 'z' ? direction * count * step : 0);
    const result = scene.setPlacementCoordinates
      ? scene.setPlacementCoordinates(selected, { x, z, rotationDegrees: info?.rotationDegrees ?? normalizedAngle(current.rotation) * 180 / Math.PI })
      : scene.setTransform(selected, { position: [x, current.position[1], z], rotation: current.rotation });
    if (result === false) { announce('이 방향으로 더 이동할 수 없습니다.', true); syncFields(); return; }
    const after = scene.getLayout().find((item) => item.id === selected);
    if (after.position.every((value, index) => Math.abs(value - current.position[index]) < 1e-8) &&
        Math.abs(normalizedAngle(after.rotation - current.rotation)) < 1e-8) {
      announce('이 방향으로 더 이동할 수 없습니다.', true); syncFields(); return;
    }
    const nextInfo = scene.getPlacementInfo?.(selected);
    changed(nextInfo?.limited ? placementMessage('이동 영역의 경계까지 옮겼습니다.') :
      `${aligning ? '격자에 맞춘 뒤 ' : ''}${axis === 'x' ? '가로' : '세로'} ${direction < 0 ? '−' : '+'}${count}칸 이동했습니다.`);
  }
  function rotateBy(degrees) {
    if (!enabled || !selected) return;
    const current = scene.getLayout().find((item) => item.id === selected);
    if (scene.setTransform(selected, { position: [...current.position], rotation: normalizedAngle(current.rotation + degrees * Math.PI / 180) }) === false) {
      announce('이 방향으로 회전하면 이동 영역을 벗어납니다.', true); syncFields(); return;
    }
    changed(placementMessage(`${Math.abs(degrees)}도 회전한 배치를 저장했습니다.`));
  }
  function setEnabled(value) {
    enabled = !!value; body.hidden = !enabled; toggle.setAttribute('aria-pressed', String(enabled));
    root.classList.toggle('editing', enabled); scene.setPlacementMode(enabled);
    if (!enabled) dragStart = null;
    if (enabled) scene.setView('top');
    syncFields();
  }

  if (doc.addEventListener) listen(doc, 'keydown', (event) => {
    if (!enabled || !selected || disposed || dragStart || scene.view === 'person' || doc.hidden || root.checkVisibility?.() === false ||
        event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey ||
        event.target?.isContentEditable || event.target?.closest?.('input, textarea, select, button, [contenteditable]') ||
        doc.querySelector?.('dialog[open]')) return;
    const direction = { ArrowLeft: ['x', -1], ArrowRight: ['x', 1], ArrowUp: ['z', -1], ArrowDown: ['z', 1] }[event.key];
    if (!direction) return;
    event.preventDefault(); moveBy(direction[0], direction[1], event.shiftKey ? 5 : 1);
  });

  return {
    select(id) { selected = catalog.has(id) ? id : null; syncFields(); },
    stopMoving() { if (!disposed && enabled) setEnabled(false); },
    startMoving(id) {
      if (disposed || !catalog.has(id)) return false;
      const item = catalog.get(id);
      selected = id;
      if (item.floor != null) scene.setFloor?.(item.floor);
      if (item.floor === 'packaging') scene.setPackagingLevel?.(item.floorLevel ?? 3);
      scene.setIsolation?.(false); scene.setExplosion?.(0);
      setEnabled(true);
      scene.select?.(id);
      scene.focusPlacement?.(id);
      syncFields();
      announce('설비 본체를 끌거나, 이동 칸 수를 고르고 버튼·방향키로 옮기세요. 배치는 자동 저장됩니다.');
      const editingSurface = scene.canvas || root;
      editingSurface.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
      return true;
    },
    handleTransform(event) {
      if (!enabled || !catalog.has(event?.id)) return;
      if (event.phase === 'start') { dragStart = scene.getLayout(); history.push(dragStart); }
      if (event.phase === 'move') { syncFields(); }
      if (event.phase === 'end') {
        const moved = !sameLayout(dragStart || history.current(), scene.getLayout()); dragStart = null;
        if (moved) changed(placementMessage('격자에 맞춰 이동한 배치를 저장했습니다.'));
        else syncFields();
      }
    },
    dispose() { disposed = true; listeners.forEach((remove) => remove()); scene.setPlacementMode(false); root.remove(); },
  };
}
