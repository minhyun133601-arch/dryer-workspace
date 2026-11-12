import { EQUIPMENT, FLOORS } from '../building-data.js';
import { OUTDOOR_EQUIPMENT, OUTDOOR_ROOM } from '../outdoor-data.js';
import { CAMPUS_EQUIPMENT, CAMPUS_ROOM } from '../campus-data.js';
import { PACKAGING_EQUIPMENT, PACKAGING_ROOM, PACKAGING_ROOMS, PACKAGING_OVERVIEW } from '../packaging-data.js';
import { createLayoutEditor } from '../layout-editor.js';
import { createFurnaceDetail } from '../furnace-detail.js';
import { BURNER_MAINTENANCE_DOCUMENTS } from '../burner-maintenance-data.js';
import { createChillerDetail } from '../chiller-detail.js';
import { createLiquidDetail } from '../liquid-detail.js';
import { createDryerUpperReference } from '../dryer-upper-reference.js';

const $ = (id) => document.getElementById(id);
const CATALOG = [...EQUIPMENT, ...OUTDOOR_EQUIPMENT, ...CAMPUS_EQUIPMENT, ...PACKAGING_EQUIPMENT];
const items = new Map(CATALOG.map((item) => [item.id, item]));
const furnaceDetail = createFurnaceDetail({ documents: BURNER_MAINTENANCE_DOCUMENTS });
const chillerDetail = createChillerDetail();
const liquidDetail = createLiquidDetail({
  host: $('liquid-workspace'),
  onOpen: () => setLiquidArea(true),
  onClose: () => setLiquidArea(false),
});
const dryerUpperReference = createDryerUpperReference();
const dryerLevelName = (value) => Number(value) === 8 ? '옥상' : `${FLOORS.find(floor => floor.id === Number(value))?.displayLevel ?? value}층`;
const itemOnDryerFloor = (item, value) => item.floor === value || item.visibleFloors?.includes(Number(value));
const requestedParams = new URLSearchParams(location.search);
if (window.parent !== window) {
  try {
    const parentParams = new URLSearchParams(window.parent.location.search);
    for (const key of ['floor', 'equipment', 'level']) if (!requestedParams.has(key) && parentParams.has(key)) requestedParams.set(key, parentParams.get(key));
  } catch {}
}
const requested = requestedParams.get('floor') === 'roof' ? '8' : requestedParams.get('floor') === '1.5' ? '2' : requestedParams.get('floor');
const requestedEquipment = items.get(requestedParams.get('equipment') || document.documentElement?.dataset?.equipment);
let packagingLevel = requestedEquipment?.floor === 'packaging' ? requestedEquipment.floorLevel ?? 3 : PACKAGING_ROOMS[Number(requestedParams.get('level'))] ? Number(requestedParams.get('level')) : 'all';
const packagingRoom = (level = packagingLevel) => level === 'all' ? PACKAGING_OVERVIEW : PACKAGING_ROOMS[level] || PACKAGING_ROOM;
let floor = requestedEquipment?.floor ?? (requested === PACKAGING_ROOM.id || requested === CAMPUS_ROOM.id || requested === OUTDOOR_ROOM.id || requested === 'all' ? requested : FLOORS.some((item) => String(item.id) === requested) ? Number(requested) : CAMPUS_ROOM.id);
let dryerFloor = ['outdoor', 'campus', 'packaging'].includes(floor) ? 7 : floor;
let scene;
let layoutEditor;
let releasePersonControls = () => {};
let selectedId = null;
let liquidShown = false, liquidPreviousSummary = '';
let disposed = false;
let pageHidden = false;
let hostActive = window.parent === window;
let toastTimer;

function toast(message) {
  let notice = $('toast');
  if (!notice) {
    notice = document.createElement('div');
    notice.id = 'toast';
    notice.setAttribute('role', 'status');
    document.body.append(notice);
  }
  notice.textContent = message;
  notice.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { notice.hidden = true; }, 3500);
}

function setViewIndicator(view) {
  document.querySelectorAll('.view-selector button[data-view]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.view === view));
  });
  $('person-controls').hidden = view !== 'person';
  document.querySelectorAll('[data-person-rule]').forEach((label) => {
    label.textContent = '계단 오르내리기 · 눈높이 1.65m';
  });
  if (view !== 'person') releasePersonControls();
}


const PERSON_NAV_KEY = 'dryer-person-navigation-v1';
let personDoorInteraction = null;
function personNavigationPreferences() {
  try { const value=JSON.parse(localStorage.getItem(PERSON_NAV_KEY)||'{}'); return {automatic:value.automatic===true,scale:Number.isFinite(value.scale)?Math.max(.75,Math.min(1.25,value.scale)):1}; } catch {return {automatic:false,scale:1};}
}
function savePersonNavigationPreferences() {
  try {localStorage.setItem(PERSON_NAV_KEY,JSON.stringify({automatic:$('auto-doors-toggle').checked,scale:Number($('person-view-scale').value)/100}));}catch{}
}
function updatePersonDoorInteraction(interaction) {
  personDoorInteraction=interaction;
  const automatic=$('auto-doors-toggle').checked,button=$('person-door-action');
  button.hidden=automatic;button.disabled=!interaction;
  button.textContent=interaction?.action==='close'?'문 닫기 · F':'문 열기 · F';
  $('person-door-hint').textContent=interaction ? (automatic?interaction.label+' · 자동':interaction.label+' · F '+(interaction.action==='close'?'닫기':'열기')) : automatic?'진입 가능한 문만 자동으로 열립니다':'가까운 출입문 앞에서 F';
}
function bindDoorNavigation() {
  const preferences=personNavigationPreferences();
  $('auto-doors-toggle').checked=preferences.automatic;
  $('person-view-scale').value=String(Math.round(preferences.scale*100));
  $('person-view-scale-output').textContent=Math.round(preferences.scale*100)+'%';
  $('auto-doors-toggle').addEventListener('change',()=>{scene?.setAutomaticDoors($('auto-doors-toggle').checked);savePersonNavigationPreferences();updatePersonDoorInteraction(personDoorInteraction);$('site-canvas').focus({preventScroll:true});});
  $('person-door-action').addEventListener('click',()=>{scene?.interactDoor();$('site-canvas').focus({preventScroll:true});});
  $('person-view-scale').addEventListener('input',()=>{const scale=Number($('person-view-scale').value)/100;scene?.setPersonViewScale(scale);$('person-view-scale-output').textContent=Math.round(scale*100)+'%';savePersonNavigationPreferences();});
  updatePersonDoorInteraction(null);
}

function bindPersonNavigation() {
  const releases = [];
  document.querySelectorAll('[data-person-action]').forEach((button) => {
    let held = false;
    const press = () => {
      if (held) return;
      held = true; button.classList.add('held');
      scene?.setPersonInput(button.dataset.personAction, true);
    };
    const release = () => {
      held = false; button.classList.remove('held');
      scene?.setPersonInput(button.dataset.personAction, false);
    };
    releases.push(release);
    button.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      event.preventDefault(); button.setPointerCapture?.(event.pointerId);
      $('site-canvas').focus({ preventScroll: true }); press();
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(type, release);
    button.addEventListener('keydown', (event) => {
      if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); press(); }
    });
    button.addEventListener('keyup', (event) => {
      if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); release(); }
    });
    button.addEventListener('blur', release);
  });
  releasePersonControls = () => releases.forEach((release) => release());
  window.addEventListener('blur', releasePersonControls);
  document.addEventListener('visibilitychange', () => { if (document.hidden) releasePersonControls(); });
  document.querySelectorAll('[data-person-reset]').forEach((button) => button.addEventListener('click', () => {
    releasePersonControls(); scene?.resetPerson({ focus: true }); $('site-canvas').focus({ preventScroll: true });
  }));
}

function floorArea(value) { return ['campus', 'packaging', 'outdoor'].includes(value) ? value : 'dryer'; }
function setAreaIndicator(area) {
  document.body.dataset.area = area;
  document.querySelectorAll('.area-selector [data-area]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.area === area)));
}
function updateDetailActions() {
  $('boiler-open').hidden = liquidShown || !['campus','all',1].includes(floor);
  $('valve-room-open').hidden = liquidShown || floor !== 'campus';
  $('wastewater-open').hidden = liquidShown || floor !== 'campus';
  $('rear-survey-open').hidden = liquidShown || floor !== 'campus';
  $('preparation-open').hidden = liquidShown || !['campus', 'all', 1].includes(floor);
  $('preparation-lower-open').hidden = liquidShown || floor !== 1;
  $('partitions-option').hidden = liquidShown || ['campus','outdoor'].includes(floor);
  const item = items.get(selectedId);
  const furnace = !liquidShown && floorArea(floor) === 'dryer';
  const chiller = !liquidShown && floor === 'outdoor' && item?.detailKey === 'chiller-100rt';
  for (const [id, available] of [['furnace-open', furnace], ['chiller-open', chiller]]) { $(id).hidden = !available; $(id).disabled = !available; }
  $('upper-photos-open').hidden = true;
  $('upper-photos-open').disabled = true;
  $('elevator-room-open').hidden = liquidShown || !['all', 7, 8].includes(floor);
}
function setLiquidArea(value) {
  liquidShown = !!value;
  $('scene-viewport').hidden = liquidShown; $('liquid-workspace').hidden = !liquidShown;
  $('selection').hidden = liquidShown || !items.has(selectedId);
  const area = floorArea(floor);
  $('floor-selector').hidden = liquidShown || area !== 'dryer';
  $('packaging-floor-selector').hidden = liquidShown || area !== 'packaging';
  if (liquidShown) {
    liquidPreviousSummary = $('area-summary').textContent;
    $('area-summary').textContent = '3팀 액상 · 8개 작업 구역 · 설비 52건';
    furnaceDetail.close?.(); chillerDetail.close?.();
  } else { $('area-summary').textContent = liquidPreviousSummary; scene?.resize?.(); }
  setAreaIndicator(liquidShown ? 'liquid' : area); updateDetailActions(); syncActivity();
}

function select(id) {
  const requestedId = items.has(id) ? id : null;
  const item = items.get(requestedId);
  if (item?.roomLink === 'liquid' && !scene?.placementMode) { liquidDetail.open(); return; }
  if (item?.roomLink && floor === CAMPUS_ROOM.id && !scene?.placementMode) {
    setFloor(item.roomLink); return;
  }
  if (item?.floor === 'packaging' && packagingLevel !== 'all' && (item.floorLevel ?? 3) !== packagingLevel) setPackagingLevel(item.floorLevel ?? 3, { overview: false });
  if (item && !itemOnDryerFloor(item, floor) && !(floor === 'all' && scene?.placementMode)) setFloor(item.floor, { overview: false });
  selectedId = requestedId;
  scene?.select(selectedId);
  if (item?.inspectableInterior && !scene?.placementMode) scene?.setCampusInterior(true);
  $('campus-interior-toggle').hidden = !item?.inspectableInterior;
  $('campus-interior-toggle').setAttribute('aria-pressed', String(!!scene?.campusInteriorEnabled));
  scene?.setIsolation(false);
  scene?.setExplosion(0);
  layoutEditor?.select(selectedId);
  $('selection').hidden = !item;
  $('move-equipment').disabled = !item || !layoutEditor;
  $('selection-name').textContent = item ? `${item.floor === PACKAGING_ROOM.id ? packagingRoom(item.floorLevel ?? 3).shortName : item.floor === CAMPUS_ROOM.id ? '공장 전경' : item.floor === OUTDOOR_ROOM.id ? OUTDOOR_ROOM.name : dryerLevelName(item.floor)} · ${item.name}` : '';
  $('move-equipment').textContent = floor === CAMPUS_ROOM.id ? '건물·구역 이동' : '설비 이동';
  $('isolation-toggle').checked = false;
  $('explosion-input').value = 0;
  $('explosion-output').textContent = '0%';
  updateDetailActions();
  if (item?.inspectableInterior && !scene?.placementMode) scene?.focus(item.id);
  if (item?.id === 'heater') furnaceDetail.open();
  if (item?.detailKey === 'chiller-100rt' && !scene?.placementMode) chillerDetail.open();
}

function setPackagingLevel(value, { overview = true } = {}) {
  const level = value === 'all' ? 'all' : Number(value);
  if (level !== 'all' && !PACKAGING_ROOMS[level]) return;
  packagingLevel = level;
  scene?.setPackagingLevel(level);
  setFloor('packaging', { overview });
}

function setFloor(value, { overview = true } = {}) {
  if (value === 'liquid') { liquidDetail.open(); return; }
  if (value === 'roof') value = 8;
  if (Number(value) === 1.5) value = 2;
  const next = ['all', OUTDOOR_ROOM.id, CAMPUS_ROOM.id, PACKAGING_ROOM.id].includes(value) ? value : Number(value);
  if (!['all', OUTDOOR_ROOM.id, CAMPUS_ROOM.id, PACKAGING_ROOM.id].includes(next) && !FLOORS.some((item) => item.id === next)) return;
  if (liquidShown) liquidDetail.close();
  floor = next;
  const outdoors = next === OUTDOOR_ROOM.id, campus = next === CAMPUS_ROOM.id, packaging = next === PACKAGING_ROOM.id;
  if (!outdoors && !campus && !packaging) dryerFloor = next;
  setAreaIndicator(floorArea(next));
  $('floor-selector').hidden = outdoors || campus || packaging;
  $('packaging-floor-selector').hidden = !packaging;
  $('packaging-cargo-option').hidden = !packaging;
  document.querySelectorAll('[data-packaging-level]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.packagingLevel === String(packagingLevel))));
  $('outdoor-navigation').hidden = !(outdoors || campus || (packaging && packagingLevel !== 'all'));
  $('outdoor-navigation').querySelector('label').textContent = packaging ? packagingLevel === 'all' ? '층별 통로' : `${packagingLevel}층 통로` : campus ? '정문 진입' : '통로 이동';
  $('outdoor-progress').setAttribute('aria-label', packaging ? `스틱·소포장 ${packagingLevel}층 통로 이동 위치` : campus ? '정문에서 공장 안쪽으로 직진 위치' : '실외기실 통로 위치');
  document.querySelector('[data-view="aisle"]').textContent = campus ? '정문' : '통로';
  document.querySelector('[data-view="aisle"]').hidden = packaging && packagingLevel === 'all';
  const shown = CATALOG.filter((item) => next === 'all' ? item.floor !== OUTDOOR_ROOM.id && item.floor !== CAMPUS_ROOM.id && item.floor !== PACKAGING_ROOM.id : (packaging || campus || outdoors ? item.floor === next : itemOnDryerFloor(item, next)) && (!packaging || packagingLevel === 'all' || (item.floorLevel ?? 3) === packagingLevel));
  $('area-summary').textContent = `${packaging ? packagingRoom().name : campus ? CAMPUS_ROOM.name : outdoors ? OUTDOOR_ROOM.name : next === 'all' ? '건조실 전체' : `건조실 ${dryerLevelName(next)}`} · ${campus ? '건물·구역' : '설비'} ${shown.length}개`;
  if (overview) select(null);
  document.querySelectorAll('[data-floor]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.floor === String(floor)));
  });
  scene?.setFloor(floor);
  updateDetailActions();
  // Keep shared web links on the chosen floor without relying on browser storage.
  if (location.protocol === 'https:' || location.protocol === 'http:') {
    const url = new URL(location.href);
    url.searchParams.set('floor', String(floor));
    if (packaging) url.searchParams.set('level', String(packagingLevel));
    else url.searchParams.delete('level');
    history.replaceState(null, '', url);
  }
}


document.querySelectorAll('.area-selector [data-area]').forEach((button) => {
  button.addEventListener('click', () => {
    if (button.dataset.area === 'liquid') { liquidDetail.open(); return; }
    setFloor(button.dataset.area === 'dryer' ? dryerFloor : button.dataset.area);
  });
});
for (const value of ['all', ...FLOORS.map((entry) => entry.id)]) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.floor = String(value);
  button.textContent = value === 'all' ? '전체·옥상' : dryerLevelName(value);
  button.addEventListener('click', () => setFloor(value));
  $('floor-selector').append(button);
}
for (const level of ['all', 1, 2, 3]) {
  const button = document.createElement('button'); button.type = 'button'; button.dataset.packagingLevel = String(level);
  button.textContent = level === 'all' ? '전체 층' : `${level}층`; button.setAttribute('aria-pressed', String(level === packagingLevel));
  button.addEventListener('click', () => setPackagingLevel(level)); $('packaging-floor-selector').append(button);
}
for (const [buttonId, equipmentId] of [['boiler-open', 'campus-boiler-room'], ['valve-room-open', 'campus-tank-valve-room'], ['wastewater-open', 'campus-wastewater-treatment']]) {
  $(buttonId).addEventListener('click', () => {
    layoutEditor?.stopMoving();
    if (buttonId === 'boiler-open' && [1,'all'].includes(floor)) {
      setFloor(1, { overview:false }); select('f1-boiler-room'); return;
    }
    if (floor !== 'campus') setFloor('campus', { overview: false });
    select(equipmentId);
  });
}
$('preparation-open').addEventListener('click', () => {
  layoutEditor?.stopMoving();
  setFloor(1, { overview: false });
  scene?.setIsolation(false); $('isolation-toggle').checked = false;
  scene?.setExplosion(0);
  select('f1-prep-platform');
  scene?.focus('f1-prep-platform');
});
$('preparation-lower-open').addEventListener('click', () => {
  layoutEditor?.stopMoving();
  setFloor(1, { overview:false });
  select('f1-mix-b');
  $('isolation-toggle').checked = false;
  scene?.showPreparationLowerView?.();
});
$('rear-survey-open').addEventListener('click', () => {
  layoutEditor?.stopMoving();
  select('campus-team2-rear-access');
  scene?.focus('campus-team2-rear-access');
});
$('furnace-open').addEventListener('click', () => { if (!$('furnace-open').disabled) furnaceDetail.open(); });
$('upper-photos-open').addEventListener('click', () => dryerUpperReference.open());
$('elevator-room-open').addEventListener('click', () => { setFloor(8); select('dryer-roof-drive'); scene?.focus('dryer-roof-drive'); });
$('chiller-open').addEventListener('click', () => { if (!$('chiller-open').disabled) chillerDetail.open(); });
document.querySelectorAll('.view-selector button[data-view]').forEach((button) => {
  button.addEventListener('click', () => {
    if (button.dataset.view === 'person') layoutEditor?.stopMoving();
    scene?.setView(button.dataset.view);
    if (button.dataset.view === 'person') $('site-canvas').focus({ preventScroll: true });
  });
});
bindPersonNavigation();
bindDoorNavigation();
for (const [id, method] of [['labels-toggle', 'setLabels'], ['structure-toggle', 'setStructure'], ['ducts-toggle', 'setDucts'], ['packaging-cargo-toggle', 'setPackagingCargoVisible']]) {
  $(id).addEventListener('change', (event) => scene?.[method](event.target.checked));
}
$('partitions-toggle').addEventListener('change', (event) => scene?.setPartitions?.(event.target.checked));
$('zoom-in').addEventListener('click', () => scene?.zoomBy(1.2));
$('zoom-out').addEventListener('click', () => scene?.zoomBy(1 / 1.2));
const moveAlongRoad = (value) => floor === 'packaging' ? scene?.setPackagingProgress(value) : floor === 'campus' ? scene?.setCampusProgress(value) : scene?.setOutdoorProgress(value);
const roadProgress = () => floor === 'packaging' ? scene?.getPackagingProgress() : floor === 'campus' ? scene?.getCampusProgress() : scene?.getOutdoorProgress();
$('outdoor-progress').addEventListener('input', (event) => moveAlongRoad(event.target.value));
$('outdoor-back').addEventListener('click', () => moveAlongRoad(roadProgress() - 5));
$('outdoor-forward').addEventListener('click', () => moveAlongRoad(roadProgress() + 5));
$('reset-view').addEventListener('click', () => { select(null); scene?.resetView(); });
$('clear-selection').addEventListener('click', () => select(null));
$('focus-equipment').addEventListener('click', () => scene?.focus(selectedId));
$('campus-interior-toggle').addEventListener('click', () => {
  const enabled = scene?.setCampusInterior(!scene.campusInteriorEnabled);
  $('campus-interior-toggle').setAttribute('aria-pressed', String(!!enabled));
  if (enabled && selectedId) scene?.focus(selectedId);
});
$('move-equipment').addEventListener('click', () => {
  const item = items.get(selectedId);
  if (!item) return;
  if (floor !== item.floor) { setFloor(item.floor); select(item.id); }
  layoutEditor?.startMoving(item.id);
});
$('isolation-toggle').addEventListener('change', (event) => {
  scene?.setIsolation(event.target.checked);
  if (event.target.checked) scene?.focus(selectedId);
});
$('explosion-input').addEventListener('input', (event) => {
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
    link.download = `희창유업-3D-${floor === PACKAGING_ROOM.id ? `스틱소포장-${packagingLevel}층` : floor === CAMPUS_ROOM.id ? '공장전경' : floor === 'all' ? '건조실전체' : floor === OUTDOOR_ROOM.id ? OUTDOOR_ROOM.name : dryerLevelName(floor)}.png`;
    link.click();
  } catch { toast('화면을 저장하지 못했습니다.'); }
});
$('share-button').addEventListener('click', () => {
  const link = document.createElement('a');
  link.href = location.href;
  link.download = '건조기-3D-지도.html';
  link.click();
});
document.addEventListener('keydown', (event) => {
  if (liquidShown || document.querySelector('dialog[open]') || event.altKey || event.ctrlKey || event.metaKey || event.repeat || event.target.matches('input,button,a,select,textarea,[contenteditable=true]')) return;
  if (event.key.toLowerCase() === 'r') { select(null); scene?.resetView(); }
  if (event.key === 'Escape') select(null);
});
const syncActivity = () => scene?.setActive(hostActive && !document.hidden && !pageHidden && !liquidShown);
window.addEventListener('message', (event) => {
  if (window.parent === window || event.source !== window.parent) return;
  if (event.data?.type !== 'dryer-workspace:visibility' || typeof event.data.active !== 'boolean') return;
  hostActive = event.data.active;
  syncActivity();
});
document.addEventListener('visibilitychange', syncActivity);
window.addEventListener('pagehide', (event) => {
  pageHidden = true;
  if (event.persisted) syncActivity();
  else { dryerUpperReference.dispose(); liquidDetail.dispose(); chillerDetail.dispose(); furnaceDetail.dispose(); layoutEditor?.dispose(); scene?.dispose(); disposed = true; }
});
window.addEventListener('pageshow', () => { pageHidden = false; if (!disposed) syncActivity(); });

setFloor(floor);
try {
  const { createFacilityScene } = await import('../scene.js');
  scene = createFacilityScene($('site-canvas'), {
    equipment: CATALOG,
    floor,
    packagingLevel,
    onPackagingLevelChange: (level) => {
      if (level === packagingLevel) return;
      packagingLevel = level; setFloor('packaging', { overview: false });
      if (selectedId) select(selectedId);
    },
    onSelect: select,
    onViewChange: setViewIndicator,
    onDoorInteraction: updatePersonDoorInteraction,
    onNavigationChange: (progress) => { $('outdoor-progress').value = Math.round(progress); },
    onFloorChange: setFloor,
    onTransformChange: (event) => layoutEditor?.handleTransform(event),
  });
  layoutEditor = createLayoutEditor({ scene, equipment: CATALOG, container: $('layout-editor') });
  scene.setAutomaticDoors($('auto-doors-toggle').checked);
  scene.setPersonViewScale(Number($('person-view-scale').value)/100);
  scene.setLabels($('labels-toggle').checked);
  scene.setPartitions?.($('partitions-toggle').checked);
  layoutEditor.select(selectedId);
  if (requestedEquipment) select(requestedEquipment.id);
  $('move-equipment').disabled = !selectedId;
  syncActivity();
  if (requested === 'liquid') liquidDetail.open({ equipmentId: requestedParams.get('equipment') });
  $('site-canvas').dataset.ready = 'true';
  $('scene-loading').hidden = true;
  if (window.parent !== window) window.parent.postMessage({ type: 'dryer-workspace:ready', moduleId: 'site' }, '*');
} catch (error) {
  console.error('3D map initialization failed:', error);
  $('scene-loading').hidden = true;
  $('scene-error').hidden = false;
  document.querySelectorAll('button,input').forEach((control) => {
    if (!['reload-button', 'share-button'].includes(control.id)) control.disabled = true;
  });
}
