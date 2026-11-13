import { EQUIPMENT as DRYER_EQUIPMENT, SITE_NOTE, FLOORS, floorById } from './building-data.js';
import { OUTDOOR_EQUIPMENT, OUTDOOR_ROOM } from './outdoor-data.js';
import { CAMPUS_EQUIPMENT, CAMPUS_ROOM } from './campus-data.js';
import { PACKAGING_EQUIPMENT, PACKAGING_ROOM, PACKAGING_ROOMS, PACKAGING_OVERVIEW } from './packaging-data.js';
import { SURVEY_PHOTOS } from './outdoor-survey.js';
import { isRetainedEvidenceImage } from './evidence-assets.js';
import { createLayoutEditor } from './layout-editor.js';
import { createFurnaceDetail } from './furnace-detail.js';
import { BURNER_MAINTENANCE_DOCUMENTS } from './burner-maintenance-data.js';
import { createChillerDetail } from './chiller-detail.js';
import { createLiquidDetail } from './liquid-detail.js';
import { createDryerUpperReference } from './dryer-upper-reference.js';

const EQUIPMENT = [...DRYER_EQUIPMENT, ...OUTDOOR_EQUIPMENT, ...CAMPUS_EQUIPMENT, ...PACKAGING_EQUIPMENT];

const $ = (id) => document.getElementById(id);
const embedded = window.parent !== window;
const items = new Map(EQUIPMENT.map((item) => [item.id, item]));
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
const icons = {
  site: '<path d="m3 9 9-5 9 5-9 5-9-5Z"/><path d="m3 14 9 5 9-5M3 19l9 5 9-5M12 14v5"/>',
  pin: '<path d="M18 10c0 5-6 11-6 11S6 15 6 10a6 6 0 0 1 12 0Z"/><circle cx="12" cy="10" r="2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  reset: '<path d="M4 10a8 8 0 1 1 1 7M4 4v6h6"/>',
  expand: '<path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  mouse: '<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 6v5"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="1.5"/><path d="m4 17 5-5 4 4 3-3 5 5"/>',
  focus: '<path d="M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5"/><circle cx="12" cy="12" r="4"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  motor: '<rect x="5" y="6" width="14" height="11" rx="2"/><path d="M8 7v9M11 7v9M14 7v9M19 10h3v4h-3M2 10h3v4H2M7 17v3h10v-3M9 6V3h6v3"/>',
  panel: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 7h8M8 11h8M8 16h3"/><circle cx="15" cy="16" r="1.5"/>',
};
const svg = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.info}</svg>`;
document.querySelectorAll('[data-icon]').forEach((element) => { element.innerHTML = svg(element.dataset.icon); });

let scene;
let layoutEditor;
let releasePersonControls = () => {};
let selectedId = null;
let liquidShown = false, liquidPreviousSummary = '';
const requestedParams = new URLSearchParams(location.search);
const requestedFloor = requestedParams.get('floor') === 'roof' ? '8' : requestedParams.get('floor') === '1.5' ? '2' : requestedParams.get('floor');
const requestedEquipment = items.get(requestedParams.get('equipment'));
let packagingLevel = requestedEquipment?.floor === 'packaging' ? requestedEquipment.floorLevel ?? 3 : PACKAGING_ROOMS[Number(requestedParams.get('level'))] ? Number(requestedParams.get('level')) : 'all';
let activeFloor = requestedEquipment?.floor ?? (['campus', 'outdoor', 'packaging', 'all'].includes(requestedFloor) ? requestedFloor : floorById(requestedFloor)?.id || 'campus');
let dryerFloor = ['outdoor', 'campus', 'packaging'].includes(activeFloor) ? 7 : activeFloor;
let photoIndex = 0;
let photoSources = [];
let hostActive = !embedded;
let pageHidden = false;
let toastTimer;
let disposed = false;

function toast(message) {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3500);
}

function setViewIndicator(view) {
  document.querySelectorAll('.view-selector button[data-view]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.view === view));
  });
  $('person-controls').hidden = view !== 'person';
  document.querySelectorAll('[data-person-rule]').forEach((label) => {
    label.textContent = '키 1.75m · 눈높이 1.65m';
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

const packagingRoom = (level = packagingLevel) => level === 'all' ? PACKAGING_OVERVIEW : PACKAGING_ROOMS[level] || PACKAGING_ROOM;
const roomByFloor = (floor) => floor === 'packaging' ? packagingRoom() : floor === 'campus' ? CAMPUS_ROOM : floor === 'outdoor' ? OUTDOOR_ROOM : null;
const catalogForFloor = (floor, level = packagingLevel) => floor === 'packaging' ? PACKAGING_EQUIPMENT.filter((item) => level === 'all' || (item.floorLevel ?? 3) === level) : floor === 'campus' ? CAMPUS_EQUIPMENT : floor === 'outdoor' ? OUTDOOR_EQUIPMENT : DRYER_EQUIPMENT.filter((item) => floor === 'all' || itemOnDryerFloor(item, floor));
function floorTitle() { return activeFloor === 'packaging' ? packagingRoom().name : activeFloor === 'campus' ? CAMPUS_ROOM.name : activeFloor === 'outdoor' ? '실외기실 · 야외 설비 구역' : activeFloor === 'all' ? '건조실 · 전체 층·옥상' : `${dryerLevelName(activeFloor)} · ${floorById(activeFloor)?.shortName || '설비 배치'}`; }
const areaName = (item) => item.floor === 'packaging' ? packagingRoom(item.floorLevel ?? 3).shortName : item.floor === 'campus' ? '공장 전경' : item.floor === 'outdoor' ? '실외기실' : dryerLevelName(item.floor);

function floorArea(value) { return ['campus', 'packaging', 'outdoor'].includes(value) ? value : 'dryer'; }
function setAreaIndicator(area) {
  document.body.dataset.area = area;
  document.querySelectorAll('.area-selector [data-area]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.area === area)));
}
function updateDetailActions() {
  $('boiler-open').hidden = liquidShown || !['campus','all',1].includes(activeFloor);
  $('valve-room-open').hidden = liquidShown || activeFloor !== 'campus';
  $('wastewater-open').hidden = liquidShown || activeFloor !== 'campus';
  $('rear-survey-open').hidden = liquidShown || activeFloor !== 'campus';
  $('preparation-open').hidden = liquidShown || !['campus', 'all', 1].includes(activeFloor);
  $('preparation-lower-open').hidden = liquidShown || activeFloor !== 1;
  $('partitions-option').hidden = liquidShown || ['campus','outdoor'].includes(activeFloor);
  const item = items.get(selectedId);
  const furnace = !liquidShown && floorArea(activeFloor) === 'dryer';
  const chiller = !liquidShown && activeFloor === 'outdoor' && item?.detailKey === 'chiller-100rt';
  for (const [id, available] of [['furnace-open', furnace], ['chiller-open', chiller]]) { $(id).hidden = !available; $(id).disabled = !available; }
  $('upper-photos-open').hidden = true;
  $('upper-photos-open').disabled = true;
  $('elevator-room-open').hidden = liquidShown || !['all', 7, 8].includes(activeFloor);
}
function setLiquidArea(value) {
  liquidShown = !!value;
  $('main-workspace').hidden = liquidShown; $('liquid-workspace').hidden = !liquidShown;
  const area = floorArea(activeFloor);
  $('floor-selector').hidden = liquidShown || area !== 'dryer';
  $('packaging-floor-selector').hidden = liquidShown || area !== 'packaging';
  if (liquidShown) {
    liquidPreviousSummary = $('floor-summary').textContent;
    $('floor-summary').textContent = '3팀 액상 · 8개 작업 구역 · 설비 52건';
    furnaceDetail.close?.(); chillerDetail.close?.();
  } else { $('floor-summary').textContent = liquidPreviousSummary; scene?.resize?.(); }
  setAreaIndicator(liquidShown ? 'liquid' : area); updateDetailActions(); syncActivity();
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
  const next = ['all', 'outdoor', 'campus', 'packaging'].includes(value) ? value : Number(value);
  if (!['all', 'outdoor', 'campus', 'packaging'].includes(next) && !floorById(next)) return;
  if (liquidShown) liquidDetail.close();
  activeFloor = next;
  const outdoors = next === 'outdoor', campus = next === 'campus', packaging = next === 'packaging', room = roomByFloor(next);
  if (!outdoors && !campus && !packaging) dryerFloor = next;
  setAreaIndicator(floorArea(next));
  $('floor-selector').hidden = outdoors || campus || packaging;
  $('packaging-floor-selector').hidden = !packaging;
  $('packaging-cargo-option').hidden = !packaging;
  document.querySelectorAll('[data-packaging-level]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.packagingLevel === String(packagingLevel))));
  $('survey-option').hidden = true;
  $('outdoor-navigation').hidden = !(outdoors || campus || (packaging && packagingLevel !== 'all'));
  $('outdoor-navigation').querySelector('label').textContent = packaging ? packagingLevel === 'all' ? '층별 통로' : `${packagingLevel}층 통로` : campus ? '정문 진입' : '통로 이동';
  $('outdoor-progress').setAttribute('aria-label', packaging ? `스틱·소포장 ${packagingLevel}층 통로 이동 위치` : campus ? '정문에서 공장 안쪽으로 직진 위치' : '실외기실 통로 위치');
  document.querySelector('[data-view="aisle"]').textContent = campus ? '정문' : '통로';
  document.querySelector('[data-view="aisle"]').hidden = packaging && packagingLevel === 'all';
  $('survey-legend').hidden = true;
  document.querySelectorAll('#floor-selector [data-floor]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.floor === String(next))));
  const shown = EQUIPMENT.filter((item) => next === 'all' ? item.floor !== 'outdoor' && item.floor !== 'campus' && item.floor !== 'packaging' : (packaging || campus || outdoors ? item.floor === next : itemOnDryerFloor(item, next)) && (!packaging || packagingLevel === 'all' || (item.floorLevel ?? 3) === packagingLevel));
  document.querySelectorAll('.equipment-button').forEach((button) => { button.hidden = !shown.some((item) => item.id === button.dataset.equipment); });
  $('equipment-count').textContent = String(shown.length).padStart(2, '0');
  $('equipment-heading').textContent = campus ? '건물·구역 목록' : '설비 목록';
  $('overview-name').textContent = packaging ? packagingLevel === 'all' ? '스틱·소포장 전체 층' : `스틱·소포장 ${packagingLevel}층 전체` : campus ? '공장 전경 전체' : outdoors ? '실외기실 전체' : next === 'all' ? '건물 전체' : `${dryerLevelName(next)} 전체`;
  $('floor-summary').textContent = room ? room.summary : next === 'all' ? '층을 선택하면 해당 층의 설비와 이름을 크게 볼 수 있습니다.' : floorById(next).summary;
  $('site-note').textContent = room?.confidence || (outdoors ? '사진·영상 기반 개략 3D 모델 · 실제 치수와 가려진 배관 연결은 현장 확인이 필요합니다.' : SITE_NOTE);
  scene?.setFloor(next);
  if (overview) selectEquipment(null);
  updateDetailActions();
}

function setPhoto(index) {
  if (!photoSources.length) return;
  photoIndex = (index + photoSources.length) % photoSources.length;
  const item = items.get(selectedId);
  const room = roomByFloor(activeFloor);
  const name = item?.name || room?.name || '건조실 현장';
  const referenceKind = photoSources[photoIndex].includes('/team3-') ? '설비이력카드' : '도면';
  $('reference-photo').src = photoSources[photoIndex];
  $('reference-photo').classList.toggle('is-drawing-reference', referenceKind === '도면');
  $('photo-dialog').classList.toggle('is-drawing-reference', referenceKind === '도면');
  $('reference-photo').alt = `${name} ${referenceKind} ${photoIndex + 1}`;
  const videoCaption = (item?.photoCaptions || room?.photoCaptions)?.[photoSources[photoIndex]];
  $('reference-caption').textContent = videoCaption || `${name} · ${referenceKind}`;
  $('photo-info').hidden = true;
  $('photo-location').textContent = '';
  $('photo-inline-position').textContent = `${photoIndex + 1} / ${photoSources.length}`;
  $('previous-photo-inline').disabled = $('next-photo-inline').disabled = photoSources.length < 2;
  scene?.setSurveyPhoto(null);
  $('reference-photo-button').setAttribute('aria-label', `${name} ${referenceKind} 크게 보기`);
  $('photo-dialog-title').textContent = `${name} · ${referenceKind}`;
  $('photo-dialog-image').src = photoSources[photoIndex];
  $('photo-dialog-image').alt = `${name} ${referenceKind} ${photoIndex + 1}`;
  $('photo-position').textContent = `${String(photoIndex + 1).padStart(2, '0')} / ${String(photoSources.length).padStart(2, '0')}`;
  $('previous-photo').disabled = photoSources.length < 2;
  $('next-photo').disabled = photoSources.length < 2;
  document.querySelectorAll('.photo-thumbnail').forEach((button, i) => button.setAttribute('aria-pressed', String(i === photoIndex)));
}

function renderPhotos(item) {
  const chamber = EQUIPMENT.find((entry) => entry.type === 'chamber');
  const blower = EQUIPMENT.find((entry) => entry.type === 'blower');
  const cyclone = EQUIPMENT.find((entry) => entry.type === 'cyclone');
  const floor = floorById(activeFloor);
  const overviewPhotos = activeFloor === 'packaging' ? packagingRoom().photos : activeFloor === 'campus' ? CAMPUS_ROOM.photos || [CAMPUS_ROOM.reference] : activeFloor === 'outdoor' ? [...(OUTDOOR_ROOM.photos || []), ...(OUTDOOR_ROOM.videoPhotos || []), ...SURVEY_PHOTOS.map((photo) => photo.photo)] : floor?.photos || (floor?.reference ? [floor.reference] : [chamber?.photo, blower?.photo, cyclone?.photo]);
  photoSources = [...new Set(item ? [item.photo, ...(item.photos || [])] : overviewPhotos)].filter(isRetainedEvidenceImage);
  $('photo-thumbnails').replaceChildren();
  $('photo-thumbnails').hidden = !photoSources.length;
  if (!photoSources.length) {
    for (const id of ['reference-photo', 'photo-dialog-image']) { $(id).removeAttribute?.('src'); $(id).alt = ''; }
    $('reference-photo-button').hidden = true;
    $('photo-info').hidden = true;
    $('reference-caption').textContent = '';
    $('photo-location').textContent = '';
    if ($('photo-dialog').open) $('photo-dialog').close();
    return;
  }
  for (const [i, source] of photoSources.entries()) {
    const button = document.createElement('button');
    button.className = 'photo-thumbnail';
    button.type = 'button';
    button.setAttribute('aria-label', `참고 자료 ${i + 1} 선택`);
    button.setAttribute('aria-pressed', String(i === 0));
    const image = document.createElement('img');
    image.src = source;
    image.alt = '';
    image.loading = 'lazy';
    button.append(image);
    button.addEventListener('click', () => setPhoto(i));
    $('photo-thumbnails').append(button);
  }
  $('reference-photo-button').hidden = !photoSources.length;
  setPhoto(0);
}

function listText(target, entries) {
  target.replaceChildren(...entries.map((text) => {
    const element = document.createElement('li');
    element.textContent = text;
    return element;
  }));
}

function updateExplosion(value) {
  const percent = selectedId ? Math.max(0, Math.min(100, Number(value) || 0)) : 0;
  $('explosion-input').value = percent;
  $('explosion-output').textContent = `${percent}%`;
  $('explosion-input').setAttribute('aria-valuetext', percent ? `주요 구조 ${percent}% 분리` : '조립 상태');
  $('scene-mode-label').textContent = percent ? '주요 구조 분리' : $('isolation-toggle').checked ? '선택 설비 관찰' : floorTitle();
  scene?.setExplosion(percent / 100);
}

function selectEquipment(id, { move = false } = {}) {
  if (id !== null && !items.has(id)) return;
  const requested = items.get(id);
  if (requested?.roomLink === 'liquid' && !scene?.placementMode) { liquidDetail.open(); return; }
  if (requested?.roomLink && activeFloor === 'campus' && !scene?.placementMode) {
    setFloor(requested.roomLink); return;
  }
  if (requested?.floor === 'packaging' && packagingLevel !== 'all' && (requested.floorLevel ?? 3) !== packagingLevel) setPackagingLevel(requested.floorLevel ?? 3, { overview: false });
  if (requested && !itemOnDryerFloor(requested, activeFloor) && !(activeFloor === 'all' && scene?.placementMode)) setFloor(requested.floor, { overview: false });
  selectedId = id;
  const item = items.get(id);
  const catalog = catalogForFloor(activeFloor), room = roomByFloor(activeFloor);
  const index = catalog.findIndex((entry) => entry.id === id);
  $('overview-button').classList.toggle('active', !item);
  $('overview-button').setAttribute('aria-pressed', String(!item));
  document.querySelectorAll('.equipment-button').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.equipment === id)));
  $('detail-tag').textContent = item?.tag || 'OVERVIEW';
  $('detail-name').textContent = item?.name || floorTitle();
  $('detail-index').textContent = item ? `${String(index + 1).padStart(2, '0')} / ${String(catalog.length).padStart(2, '0')}` : 'SITE';
  $('detail-confidence').textContent = item?.confidence || room?.confidence || '건축도면 · 현장영상 · 과거 3D 형상 대조';
  $('detail-summary').textContent = item?.summary || (room ? room.summary : activeFloor === 'all' ? `1·1.5·3~7층의 전체 외곽과 부분층, 저층동 지붕과 옥상 서비스 구역을 연결했습니다. 층을 선택해 실 이름과 내부 설비를 살펴보세요.` : floorById(activeFloor).summary);
  $('scene-heading').textContent = item ? `${areaName(item)} · ${item.name}` : floorTitle();
  $('selected-controls').hidden = !item;
  $('move-equipment').disabled = !item || !layoutEditor;
  $('move-equipment').textContent = activeFloor === 'campus' ? '건물·구역 이동' : '설비 이동';
  $('clear-selection').hidden = !item;
  $('details-heading').textContent = item ? (item.floor === 'campus' ? '사진·도면·위치 자료에서 확인한 내용' : item.floor === 'outdoor' ? '현장 사진·영상·도면에서 확인한 내용' : item.floor === 7 ? '현장 사진에서 확인한 내용' : '재현한 구성') : '관찰 가이드';
  listText($('detail-notes'), item?.details || (room?.details ? room.details : activeFloor === 'outdoor' ? [
    '현장 영상 4개를 대조해 야외 통로를 마지막 청색 물탱크·세로형 스테인리스 탱크까지 확장했습니다.',
    '11월 9일 영상 캡처 20장을 먼저 표시합니다. 11월 2일 영상 장면과 10월 30일 촬영 좌표 사진도 이어서 볼 수 있습니다.',
    '설비를 누르면 선택한 설비 이름만 표시합니다. 전체 이름표는 아래 표시 옵션에서 켤 수 있습니다.',
    '평면에서는 드래그로 전체 통로를 이동하고, 통로 이동 슬라이더로 진입부부터 끝까지 따라갈 수 있습니다.',
    '설비 치수와 가려진 배관 연결은 영상 비례를 참고한 개략 재현입니다.',
  ] : [
    '입체·평면·통로 시점으로 설비 사이의 위치 관계를 살펴보세요.',
    '설비를 선택한 뒤 확대하거나 주요 구조를 나누어 볼 수 있습니다.',
    '실 이름과 건물 외곽은 건축도면, 설비 외형은 현장 영상과 과거 3D 참고 이미지를 대조했습니다.',
    '1.5층의 탈의실·OP실과 부분층, 3층부터 줄어드는 실내 공간과 주변 저층동 지붕을 구분했습니다.',
  ]));
  $('parts-section').hidden = !item?.parts?.length;
  listText($('parts-list'), item?.parts || []);
  $('isolation-toggle').checked = false;
  scene?.setIsolation(false);
  scene?.select(id);
  if (item?.inspectableInterior && !scene?.placementMode) scene?.setCampusInterior(true);
  $('campus-interior-toggle').hidden = !item?.inspectableInterior;
  $('campus-interior-toggle').setAttribute('aria-pressed', String(!!scene?.campusInteriorEnabled));
  layoutEditor?.select(id);
  updateExplosion(0);
  renderPhotos(item);
  $('detail-body').scrollTop = 0;
  if (item && (move || (item.inspectableInterior && !scene?.placementMode))) scene?.focus(id);
  updateDetailActions();
  if (item?.id === 'heater') furnaceDetail.open();
  if (item?.detailKey === 'chiller-100rt' && !scene?.placementMode) chillerDetail.open();
}

for (const [index, item] of EQUIPMENT.entries()) {
  const button = document.createElement('button');
  button.className = 'equipment-button';
  button.dataset.equipment = item.id;
  button.type = 'button';
  button.setAttribute('aria-pressed', 'false');
  const number = document.createElement('span');
  number.className = 'equipment-number';
  const areaCatalog = catalogForFloor(item.floor, item.floorLevel ?? packagingLevel);
  number.textContent = String(areaCatalog.indexOf(item) + 1).padStart(2, '0');
  const title = document.createElement('span');
  title.className = 'equipment-title';
  title.append(document.createTextNode(item.name));
  const tag = document.createElement('small');
  tag.textContent = `${areaName(item)} · ${item.tag}`;
  title.append(tag);
  const dot = document.createElement('span');
  dot.className = 'equipment-dot';
  dot.setAttribute('aria-hidden', 'true');
  button.append(number, title, dot);
  button.addEventListener('click', () => selectEquipment(item.id));
  button.addEventListener('dblclick', () => scene?.focus(item.id));
  $('equipment-list').append(button);
}
$('equipment-count').textContent = String(EQUIPMENT.length).padStart(2, '0');
$('site-note').textContent = SITE_NOTE;

document.querySelectorAll('.area-selector [data-area]').forEach((button) => button.addEventListener('click', () => {
  if (button.dataset.area === 'liquid') { liquidDetail.open(); return; }
  setFloor(button.dataset.area === 'dryer' ? dryerFloor : button.dataset.area);
}));
for (const [buttonId, equipmentId] of [['boiler-open', 'campus-boiler-room'], ['valve-room-open', 'campus-tank-valve-room'], ['wastewater-open', 'campus-wastewater-treatment']]) {
  $(buttonId).addEventListener('click', () => {
    layoutEditor?.stopMoving();
    if (buttonId === 'boiler-open' && [1,'all'].includes(activeFloor)) {
      setFloor(1, { overview:false }); selectEquipment('f1-boiler-room'); return;
    }
    if (activeFloor !== 'campus') setFloor('campus', { overview: false });
    selectEquipment(equipmentId);
  });
}
$('preparation-open').addEventListener('click', () => {
  layoutEditor?.stopMoving();
  setFloor(1, { overview: false });
  scene?.setIsolation(false); $('isolation-toggle').checked = false;
  scene?.setExplosion(0); updateExplosion(0);
  selectEquipment('f1-prep-platform');
  scene?.focus('f1-prep-platform');
});
$('preparation-lower-open').addEventListener('click', () => {
  layoutEditor?.stopMoving();
  setFloor(1, { overview:false });
  selectEquipment('f1-mix-b');
  $('isolation-toggle').checked = false; updateExplosion(0);
  scene?.showPreparationLowerView?.();
});
$('rear-survey-open').addEventListener('click', () => {
  layoutEditor?.stopMoving();
  selectEquipment('campus-team2-rear-access');
  scene?.focus('campus-team2-rear-access');
});
$('furnace-open').addEventListener('click', () => { if (!$('furnace-open').disabled) furnaceDetail.open(); });
$('upper-photos-open').addEventListener('click', () => dryerUpperReference.open());
$('elevator-room-open').addEventListener('click', () => { setFloor(8); selectEquipment('dryer-roof-drive'); scene?.focus('dryer-roof-drive'); });
$('chiller-open').addEventListener('click', () => { if (!$('chiller-open').disabled) chillerDetail.open(); });
for (const level of ['all', 1, 2, 3]) {
  const button = document.createElement('button'); button.type = 'button'; button.dataset.packagingLevel = String(level);
  button.textContent = level === 'all' ? '전체 층' : `${level}층`; button.setAttribute('aria-pressed', String(level === packagingLevel));
  button.addEventListener('click', () => setPackagingLevel(level)); $('packaging-floor-selector').append(button);
}
for (const value of ['all', ...FLOORS.map((floor) => floor.id)]) {
  const button = document.createElement('button'); button.type = 'button'; button.dataset.floor = String(value);
  button.textContent = value === 'all' ? '전체·옥상' : dryerLevelName(value);
  button.setAttribute('aria-pressed', String(value === 'all'));
  button.addEventListener('click', () => setFloor(value)); $('floor-selector').append(button);
}
$('overview-button').addEventListener('click', () => { selectEquipment(null); scene?.resetView(); setViewIndicator('perspective'); });
$('clear-selection').addEventListener('click', () => selectEquipment(null));
document.querySelectorAll('.view-selector button[data-view]').forEach((button) => button.addEventListener('click', () => {
  if (button.dataset.view === 'person') layoutEditor?.stopMoving();
  scene?.setView(button.dataset.view); setViewIndicator(button.dataset.view);
  if (button.dataset.view === 'person') $('site-canvas').focus({ preventScroll: true });
}));
bindPersonNavigation();
bindDoorNavigation();
$('labels-toggle').addEventListener('change', (event) => scene?.setLabels(event.target.checked));
$('structure-toggle').addEventListener('change', (event) => scene?.setStructure(event.target.checked));
$('partitions-toggle').addEventListener('change', (event) => scene?.setPartitions?.(event.target.checked));
$('ducts-toggle').addEventListener('change', (event) => scene?.setDucts(event.target.checked));
$('packaging-cargo-toggle').addEventListener('change', (event) => scene?.setPackagingCargoVisible(event.target.checked));
$('survey-toggle').addEventListener('change', (event) => { scene?.setSurvey(event.target.checked); $('survey-legend').classList.toggle('muted', !event.target.checked); });
$('focus-equipment').addEventListener('click', () => { if (selectedId) scene?.focus(selectedId); });
$('campus-interior-toggle').addEventListener('click', () => {
  const enabled = scene?.setCampusInterior(!scene.campusInteriorEnabled);
  $('campus-interior-toggle').setAttribute('aria-pressed', String(!!enabled));
  if (enabled && selectedId) scene?.focus(selectedId);
});
$('move-equipment').addEventListener('click', () => {
  const item = items.get(selectedId);
  if (!item) return;
  if (activeFloor !== item.floor) setFloor(item.floor, { overview: false });
  layoutEditor?.startMoving(item.id);
});
$('isolation-toggle').addEventListener('change', (event) => {
  scene?.setIsolation(event.target.checked);
  if (event.target.checked && selectedId) scene?.focus(selectedId);
  updateExplosion($('explosion-input').value);
});
$('explosion-input').addEventListener('input', (event) => updateExplosion(event.target.value));
$('zoom-in').addEventListener('click', () => scene?.zoomBy(1.2));
$('zoom-out').addEventListener('click', () => scene?.zoomBy(1 / 1.2));
const moveAlongRoad = (value) => activeFloor === 'packaging' ? scene?.setPackagingProgress(value) : activeFloor === 'campus' ? scene?.setCampusProgress(value) : scene?.setOutdoorProgress(value);
const roadProgress = () => activeFloor === 'packaging' ? scene?.getPackagingProgress() : activeFloor === 'campus' ? scene?.getCampusProgress() : scene?.getOutdoorProgress();
$('outdoor-progress').addEventListener('input', (event) => moveAlongRoad(event.target.value));
$('outdoor-back').addEventListener('click', () => moveAlongRoad(roadProgress() - 5));
$('outdoor-forward').addEventListener('click', () => moveAlongRoad(roadProgress() + 5));
$('reset-view').addEventListener('click', () => { scene?.resetView(); setViewIndicator('perspective'); });
$('reload-button').addEventListener('click', () => location.reload());
$('reference-photo-button').addEventListener('click', () => { if (photoSources.length) $('photo-dialog').showModal(); });
$('previous-photo').addEventListener('click', () => setPhoto(photoIndex - 1));
$('next-photo').addEventListener('click', () => setPhoto(photoIndex + 1));
$('previous-photo-inline').addEventListener('click', () => setPhoto(photoIndex - 1));
$('next-photo-inline').addEventListener('click', () => setPhoto(photoIndex + 1));
$('guide-button').addEventListener('click', () => $('guide-dialog').showModal());
document.querySelectorAll('.close-dialog').forEach((button) => button.addEventListener('click', () => button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach((dialog) => dialog.addEventListener('click', (event) => {
  if (event.target !== dialog) return;
  const bounds = dialog.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
}));
document.querySelectorAll('[data-module]').forEach((link) => link.addEventListener('click', (event) => {
  if (!embedded || location.protocol === 'file:') return;
  event.preventDefault();
  window.parent.postMessage({ type: 'dryer-workspace:navigate', moduleId: link.dataset.module }, location.origin);
}));
$('fullscreen-button').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if ($('scene-viewport').requestFullscreen) await $('scene-viewport').requestFullscreen();
    else toast('이 브라우저에서는 전체 화면을 지원하지 않습니다.');
  } catch { toast('전체 화면을 사용할 수 없습니다.'); }
});
document.addEventListener('fullscreenchange', () => {
  $('fullscreen-button').setAttribute('aria-label', document.fullscreenElement ? '전체 화면 종료' : '3D 화면 전체 화면으로 보기');
  scene?.resize();
});
$('snapshot-button').addEventListener('click', async () => {
  if (!scene) return toast('3D 화면을 불러온 뒤 다시 시도해 주세요.');
  try {
    const snapshot = await scene.snapshot();
    const url = snapshot instanceof Blob ? URL.createObjectURL(snapshot) : snapshot;
    if (typeof url !== 'string' || !url) throw new Error('Empty snapshot');
    const link = document.createElement('a');
    link.href = url;
    link.download = `dryer-site-${selectedId || 'overview'}.png`;
    document.body.append(link);
    link.click();
    link.remove();
    if (snapshot instanceof Blob) setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('현재 현장 화면을 PNG로 저장했습니다.');
  } catch { toast('화면을 저장하지 못했습니다. 다시 시도해 주세요.'); }
});
document.addEventListener('keydown', (event) => {
  if ($('photo-dialog').open && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
    event.preventDefault(); setPhoto(photoIndex + (event.key === 'ArrowLeft' ? -1 : 1)); return;
  }
  if (liquidShown || document.querySelector('dialog[open]') || event.altKey || event.ctrlKey || event.metaKey || event.repeat || event.target.matches('input,textarea,select,button,a,[contenteditable=true]')) return;
  if (event.key.toLowerCase() === 'r') { scene?.resetView(); setViewIndicator('perspective'); }
  if (event.key === 'Escape') selectEquipment(null);
});
const syncActivity = () => scene?.setActive(hostActive && !document.hidden && !pageHidden && !liquidShown);
window.addEventListener('message', (event) => {
  if (!embedded || event.source !== window.parent || event.origin !== location.origin) return;
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

setFloor(activeFloor);
try {
  if (location.protocol === 'file:') throw new Error('file-protocol');
  const { createFacilityScene } = await import('./scene.js');
  scene = createFacilityScene($('site-canvas'), {
    equipment: EQUIPMENT,
    floor: activeFloor,
    packagingLevel,
    onPackagingLevelChange: (level) => {
      if (level === packagingLevel) return;
      packagingLevel = level; setFloor('packaging', { overview: false });
      if (selectedId) selectEquipment(selectedId);
    },
    onTransformChange: (event) => layoutEditor?.handleTransform(event),
    survey: [],
    onSurveyPhoto: (index) => { selectEquipment(null); setPhoto(index); },
    onSelect: (id) => selectEquipment(id),
    onViewChange: setViewIndicator,
    onDoorInteraction: updatePersonDoorInteraction,
    onNavigationChange: (progress) => { $('outdoor-progress').value = Math.round(progress); },
    onFloorChange: (floor) => setFloor(floor),
  });
  scene.setAutomaticDoors($('auto-doors-toggle').checked);
  scene.setPersonViewScale(Number($('person-view-scale').value)/100);
  scene.setLabels($('labels-toggle').checked);
  scene.setStructure($('structure-toggle').checked);
  scene.setPartitions?.($('partitions-toggle').checked);
  scene.setDucts($('ducts-toggle').checked);
  scene.setFloor(activeFloor);
  scene.setSurvey(false);
  scene.setSurveyPhoto(null);
  scene.select(selectedId);
  scene.setIsolation($('isolation-toggle').checked);
  scene.setExplosion(Number($('explosion-input').value) / 100);
  layoutEditor = createLayoutEditor({ scene, equipment: EQUIPMENT, container: $('layout-editor') });
  layoutEditor.select(selectedId);
  if (requestedEquipment) selectEquipment(requestedEquipment.id);
  $('move-equipment').disabled = !selectedId;
  syncActivity();
  if (requestedFloor === 'liquid') liquidDetail.open({ equipmentId: requestedParams.get('equipment') });
  $('site-canvas').dataset.ready = 'true';
  $('scene-loading').hidden = true;
  if (embedded) window.parent.postMessage({ type: 'dryer-workspace:ready', moduleId: 'site' }, location.origin);
} catch (error) {
  console.error('Facility scene initialization failed:', error);
  $('scene-loading').hidden = true;
  $('scene-error').hidden = false;
  if (location.protocol === 'file:') $('scene-error-message').textContent = '폴더의 「프로젝트 실행.cmd」를 더블클릭하면 현장 3D 화면을 열 수 있습니다.';
  ['zoom-in', 'zoom-out', 'reset-view', 'snapshot-button', 'fullscreen-button', 'focus-equipment', 'move-equipment', 'isolation-toggle', 'explosion-input', 'labels-toggle', 'structure-toggle', 'ducts-toggle'].forEach((id) => { $(id).disabled = true; });
  document.querySelectorAll('[data-view]').forEach((button) => { button.disabled = true; });
}
