import { EQUIPMENT, FLOORS } from '../building-data.js';
import { createLayoutEditor } from '../layout-editor.js';
import { createFurnaceDetail } from '../furnace-detail.js';
import { BURNER_MAINTENANCE_DOCUMENTS } from '../burner-maintenance-data.js';

const $ = (id) => document.getElementById(id);
const CATALOG = EQUIPMENT.filter(item => Number.isFinite(item.floor));
const items = new Map(CATALOG.map(item => [item.id, item]));
// Capture the pristine, bundled document before dialogs, labels and controls are
// created. Saving it avoids duplicating those runtime elements on the next open.
const originalDocument = document.documentElement?.outerHTML;
const furnaceDetail = createFurnaceDetail({ documents: BURNER_MAINTENANCE_DOCUMENTS });
const levelName = value => Number(value) === 8 ? '옥상' : `${FLOORS.find(floor => floor.id === Number(value))?.displayLevel ?? value}층`;
const onFloor = (item, value) => value === 'all' || item.floor === value || item.visibleFloors?.includes(Number(value));
function normalizeFloor(value) {
  if (value === 'roof') value = 8;
  if (Number(value) === 1.5) value = 2;
  return value === 'all' ? 'all' : FLOORS.some(entry => entry.id === Number(value)) ? Number(value) : 'all';
}
const requestedParams = new URLSearchParams(location.search);
if (window.parent !== window) {
  try {
    const parentParams = new URLSearchParams(window.parent.location.search);
    for (const key of ['floor', 'equipment']) if (!requestedParams.has(key) && parentParams.has(key)) requestedParams.set(key, parentParams.get(key));
  } catch {}
}
const requestedEquipment = items.get(requestedParams.get('equipment') || document.documentElement?.dataset?.equipment);
let floor = requestedEquipment?.floor ?? normalizeFloor(requestedParams.get('floor'));
let scene;
let layoutEditor;
let selectedId = null;
let disposed = false;
let pageHidden = false;
let hostActive = window.parent === window;
let toastTimer;

function toast(message) {
  $('toast').textContent = message;
  $('toast').hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3500);
}
function syncUrl() {
  if (!['http:', 'https:'].includes(location.protocol)) return;
  const url = new URL(location.href);
  url.searchParams.set('floor', String(floor));
  url.searchParams.delete('level');
  if (selectedId) url.searchParams.set('equipment', selectedId);
  else url.searchParams.delete('equipment');
  history.replaceState(null, '', url);
}
function setViewIndicator(view) {
  document.querySelectorAll('.view-selector button[data-view]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.view === view));
  });
}
function updateDetailActions() {
  $('furnace-open').hidden = false;
  $('furnace-open').disabled = false;
  $('elevator-room-open').hidden = !['all', 7, 8].includes(floor);
}
function select(id) {
  const item = items.get(id);
  if (item && !onFloor(item, floor)) setFloor(item.floor, { overview: false });
  selectedId = item?.id || null;
  scene?.select(selectedId);
  scene?.setIsolation(false);
  scene?.setExplosion(0);
  layoutEditor?.select(selectedId);
  $('selection').hidden = !item;
  $('selection-name').textContent = item ? `${levelName(item.floor)} · ${item.name}` : '';
  $('move-equipment').disabled = !item || !layoutEditor;
  $('isolation-toggle').checked = false;
  $('explosion-input').value = 0;
  $('explosion-output').textContent = '0%';
  updateDetailActions();
  syncUrl();
  if (item?.id === 'heater') furnaceDetail.open();
}
function setFloor(value, { overview = true } = {}) {
  floor = normalizeFloor(value);
  const shown = CATALOG.filter(item => onFloor(item, floor));
  const floorInfo = FLOORS.find(entry => entry.id === floor);
  const contents = floorInfo?.shortName ? ` · ${floorInfo.shortName}` : '';
  $('area-summary').textContent = `${floor === 'all' ? '건조실 전체·옥상' : `건조실 ${levelName(floor)}${contents}`}${shown.length ? ` · 설비 ${shown.length}개` : ''}`;
  if (overview) select(null);
  document.querySelectorAll('[data-floor]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.floor === String(floor)));
  });
  scene?.setFloor(floor);
  updateDetailActions();
  syncUrl();
}

// Whole building and roof are the first two choices in the presentation.
for (const value of ['all', 8, ...FLOORS.filter(entry => entry.id !== 8).map(entry => entry.id)]) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.floor = String(value);
  button.textContent = value === 'all' ? '전체·옥상' : levelName(value);
  button.addEventListener('click', () => setFloor(value));
  $('floor-selector').append(button);
}
document.querySelectorAll('.view-selector button[data-view]').forEach(button => {
  button.addEventListener('click', () => {
    if (['perspective', 'top', 'aisle'].includes(button.dataset.view)) scene?.setView(button.dataset.view);
  });
});
for (const [id, method] of [['labels-toggle', 'setLabels'], ['structure-toggle', 'setStructure'], ['partitions-toggle', 'setPartitions'], ['ducts-toggle', 'setDucts']]) {
  $(id).addEventListener('change', event => scene?.[method](event.target.checked));
}
$('furnace-open').addEventListener('click', () => { if (!$('furnace-open').disabled) furnaceDetail.open(); });
$('elevator-room-open').addEventListener('click', () => {
  setFloor(8); select('dryer-roof-drive'); scene?.focus('dryer-roof-drive');
});
$('zoom-in').addEventListener('click', () => scene?.zoomBy(1.2));
$('zoom-out').addEventListener('click', () => scene?.zoomBy(1 / 1.2));
$('reset-view').addEventListener('click', () => { select(null); scene?.resetView(); });
$('clear-selection').addEventListener('click', () => select(null));
$('focus-equipment').addEventListener('click', () => scene?.focus(selectedId));
$('move-equipment').addEventListener('click', () => {
  const item = items.get(selectedId);
  if (!item) return;
  if (floor !== item.floor) { setFloor(item.floor); select(item.id); }
  layoutEditor?.startMoving(item.id);
});
$('isolation-toggle').addEventListener('change', event => {
  scene?.setIsolation(event.target.checked);
  if (event.target.checked) scene?.focus(selectedId);
});
$('explosion-input').addEventListener('input', event => {
  const value = Number(event.target.value);
  $('explosion-output').textContent = `${value}%`;
  scene?.setExplosion(value / 100);
});
$('reload-button').addEventListener('click', () => location.reload());
$('fullscreen-button').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    else toast('이 브라우저에서는 전체 화면을 지원하지 않습니다.');
  } catch { toast('전체 화면을 열 수 없습니다.'); }
});
document.addEventListener('fullscreenchange', () => scene?.resize());
$('snapshot-button').addEventListener('click', () => {
  if (!scene) return;
  try {
    const link = document.createElement('a');
    link.href = scene.snapshot();
    link.download = `희창유업-건조실-${floor === 'all' ? '전체' : levelName(floor)}.png`;
    link.click();
  } catch { toast('화면을 저장하지 못했습니다.'); }
});
$('share-button').addEventListener('click', () => {
  let objectUrl;
  try {
    if (!originalDocument) throw new Error('Document source is unavailable.');
    objectUrl = URL.createObjectURL(new Blob([`<!doctype html>\n${originalDocument}`], { type: 'text/html;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = '희창유업-건조실-3D.html';
    link.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  } catch {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    toast('공유 파일을 저장하지 못했습니다.');
  }
});
document.addEventListener('keydown', event => {
  if (document.querySelector('dialog[open]') || event.altKey || event.ctrlKey || event.metaKey || event.repeat || event.target.matches('input,button,a,select,textarea,[contenteditable=true]')) return;
  if (event.key.toLowerCase() === 'r') { select(null); scene?.resetView(); }
  if (event.key === 'Escape') select(null);
});
const syncActivity = () => scene?.setActive(hostActive && !document.hidden && !pageHidden);
window.addEventListener('message', event => {
  if (window.parent === window || event.source !== window.parent) return;
  if (event.data?.type !== 'dryer-workspace:visibility' || typeof event.data.active !== 'boolean') return;
  hostActive = event.data.active;
  syncActivity();
});
document.addEventListener('visibilitychange', syncActivity);
window.addEventListener('pagehide', event => {
  pageHidden = true;
  if (event.persisted) syncActivity();
  else {
    clearTimeout(toastTimer);
    furnaceDetail.dispose(); layoutEditor?.dispose(); scene?.dispose(); disposed = true;
  }
});
window.addEventListener('pageshow', () => { pageHidden = false; if (!disposed) syncActivity(); });

setFloor(floor);
try {
  const { createFacilityScene } = await import('../scene.js');
  scene = createFacilityScene($('site-canvas'), {
    equipment: CATALOG,
    floor,
    enabledAreas: ['dryer'],
    personEnabled: false,
    includeAdjacentBoilerRoom: true,
    onSelect: select,
    onViewChange: setViewIndicator,
    onFloorChange: setFloor,
    onTransformChange: event => layoutEditor?.handleTransform(event),
  });
  layoutEditor = createLayoutEditor({ scene, equipment: CATALOG, container: $('layout-editor') });
  scene.setLabels($('labels-toggle').checked);
  scene.setPartitions?.($('partitions-toggle').checked);
  layoutEditor.select(selectedId);
  if (requestedEquipment) select(requestedEquipment.id);
  $('move-equipment').disabled = !selectedId;
  syncActivity();
  $('site-canvas').dataset.ready = 'true';
  $('scene-loading').hidden = true;
  if (window.parent !== window) window.parent.postMessage({ type: 'dryer-workspace:ready', moduleId: 'site' }, '*');
} catch (error) {
  console.error('Dryer presentation initialization failed:', error);
  $('scene-loading').hidden = true;
  $('scene-error').hidden = false;
  document.querySelectorAll('button,input').forEach(control => {
    if (!['reload-button', 'share-button'].includes(control.id)) control.disabled = true;
  });
}
