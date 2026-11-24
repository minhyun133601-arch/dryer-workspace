import { EQUIPMENT, FLOORS } from '../site/building-data.js';
import { createFacilityScene } from '../site/scene.js';
import { createFurnaceDetail } from '../site/furnace-detail.js';
import { TOUR_STEPS, createPresentationTour } from './tour.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const canvas = $('#presentation-canvas');
const embedded = window.parent !== window;
let hostActive = !embedded;
let pageHidden = false;
let disposed = false;
let scene;
let furnace;
let tour;
let currentState;
let lastStepIndex = -1;
let lastTitle;
let lastCaption;
let lastStatus;
let lastActiveMessage;
let toastTimer;
let inspectionFloor = 1;
let inspectionView = 'perspective';

const levelName = (floor) => floor === 'all' ? '전체' : Number(floor) === 8 ? '옥상' : `${FLOORS.find((entry) => entry.id === Number(floor))?.displayLevel ?? floor}층`;
const stepGroup = (step) => step.kind === 'burner' ? 'burner' : `floor-${step.floor}`;
const groups = [];
for (const [index, step] of TOUR_STEPS.entries()) {
  const key = stepGroup(step);
  if (!groups.some((group) => group.key === key)) groups.push({ key, firstIndex: index, floor: step.floor, title: step.kind === 'burner' ? '버너 분해' : levelName(step.floor) });
}
$('#tour-route').style.setProperty('--route-count', String(groups.length));
$('#tour-route').style.setProperty('--route-edge', `${50 / groups.length}%`);

function formatTime(seconds) {
  const duration = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}`;
}
function updateInspection() {
  const inspecting = currentState?.inspecting || currentState?.status === 'finished';
  $$('[data-inspection-floor]').forEach((button) => { button.setAttribute('aria-pressed', String(Number(button.dataset.inspectionFloor) === inspectionFloor)); });
  $$('[data-inspection-view]').forEach((button) => { button.setAttribute('aria-pressed', String(!!inspecting && button.dataset.inspectionView === inspectionView)); });
  $('[data-inspection-all]').setAttribute('aria-pressed', String(inspectionFloor === 'all'));
  $('[data-inspection-resume-label]').textContent = currentState?.status === 'finished' ? '다시 시연' : '시연 이어보기';
  if (!inspecting) return;
  $$('[data-location]').forEach((node) => { node.textContent = levelName(inspectionFloor); });
  $$('[data-view-label]').forEach((node) => { node.textContent = inspectionView === 'top' ? '평면 보기' : '입체 보기'; });
  $$('[data-scene-eyebrow]').forEach((node) => { node.textContent = `건조기 직접 둘러보기 · ${levelName(inspectionFloor)}`; });
  $$('[data-scene-title]').forEach((node) => { node.textContent = currentState.status === 'finished' ? '시연을 마쳤습니다' : `${levelName(inspectionFloor)} · ${inspectionView === 'top' ? '평면 도면' : '입체 보기'}`; });
  $$('[data-scene-caption]').forEach((node) => { node.textContent = currentState.status === 'finished' ? '층과 시점을 선택해 직접 둘러보세요.' : '층과 시점을 선택해 살펴보고, 시연을 이어서 재생하세요.'; });
}
function beginInspection() {
  if (!tour || !currentState) return false;
  if (currentState.inspecting || currentState.status === 'finished') return true;
  inspectionFloor = currentState.step?.floor || 1;
  inspectionView = 'perspective';
  if (!tour.inspect()) return false;
  scene?.setFloor(inspectionFloor);
  scene?.setView(inspectionView);
  return true;
}
function tellHost(active) {
  if (!embedded || lastActiveMessage === active) return;
  lastActiveMessage = active;
  window.parent.postMessage({ type: 'dryer-workspace:presentation-active', active }, location.origin);
}
function toast(message) {
  const target = $('#presentation-toast');
  target.textContent = message;
  target.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { target.hidden = true; }, 3500);
}

for (const [index, group] of groups.entries()) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'route-stop';
  button.dataset.group = group.key;
  button.dataset.step = String(group.firstIndex);
  button.setAttribute('aria-label', `${group.title} 장면으로 이동`);
  const dot = document.createElement('span');
  dot.className = 'route-dot';
  dot.setAttribute('aria-hidden', 'true');
  dot.textContent = String(index + 1).padStart(2, '0');
  const title = document.createElement('strong');
  title.textContent = group.title;
  button.append(dot, title);
  button.addEventListener('click', () => tour?.seek(group.firstIndex));
  $('#tour-route').append(button);
}

function updateState(state) {
  currentState = state;
  const step = state.step || TOUR_STEPS[state.stepIndex] || TOUR_STEPS[0];
  const progress = Math.max(0, Math.min(1, Number(state.progress) || 0));
  const isPlaying = state.status === 'playing';
  const isFinished = state.status === 'finished';
  const isInspecting = !!state.inspecting || isFinished;
  const wasInspecting = document.body.dataset.inspecting === 'true';
  const title = state.title || step.title;
  const caption = state.caption || step.caption;
  const playbackRate = Number(state.playbackRate) || 1;
  const statusLabel = ({ ready: '시연 준비 완료', playing: '자동 시연 중', paused: '일시정지', finished: '시연을 마쳤습니다' })[state.status] || '시연 준비 중';
  document.body.dataset.status = state.status;
  document.body.dataset.inspecting = String(isInspecting);
  $('#presentation-inspector').hidden = false;
  $('#tour-route').hidden = isInspecting;
  if (isFinished && lastStatus !== 'finished') { inspectionFloor = 7; inspectionView = 'perspective'; }
  else if (!isInspecting) { inspectionFloor = step.floor; inspectionView = 'perspective'; }
  if (lastStatus !== state.status) {
    $$('[data-status-label]').forEach((node) => { node.textContent = statusLabel; });
    $$('[data-play-label]').forEach((node) => { node.textContent = isPlaying ? '일시정지' : isFinished ? '다시 시연' : state.status === 'ready' ? '시연 시작' : '계속 재생'; });
    $$('.play-glyph').forEach((node) => { node.textContent = isPlaying ? 'Ⅱ' : '▶'; });
    $$('[data-action="play"]').forEach((node) => { node.disabled = false; node.setAttribute('aria-label', isPlaying ? '시연 일시정지' : isFinished ? '처음부터 다시 시연' : '시연 재생'); });
    $$('[data-guide-greeting]').forEach((node) => { node.textContent = isFinished ? '감사합니다' : state.status === 'ready' ? '함께 올라가 볼까요' : state.status === 'paused' ? '이어서 살펴볼까요' : '현장을 따라갑니다'; });
    lastStatus = state.status;
  }
  $$('[data-playback-label]').forEach((node) => { node.textContent = isFinished ? '시연 완료' : isPlaying ? '재생 중' : state.status === 'ready' ? '시작할 준비 완료' : '잠시 멈춤'; });
  $$('[data-elapsed]').forEach((node) => { node.textContent = formatTime(state.playbackElapsed ?? (state.elapsed ?? progress * state.totalDuration) / playbackRate); });
  $$('[data-duration]').forEach((node) => { node.textContent = formatTime(Math.ceil(state.playbackDuration ?? state.totalDuration / playbackRate)); });
  $$('[data-playback-rate]').forEach((node) => { node.value = String(playbackRate); });
  $$('[data-total-progress]').forEach((node) => { node.style.transform = `scaleX(${progress})`; });
  $$('.tour-timeline').forEach((node) => { node.setAttribute('aria-valuenow', String(Math.round(progress * 100))); });
  $$('[data-action="previous"]').forEach((node) => { node.disabled = state.stepIndex <= 0; });
  $$('[data-action="next"]').forEach((node) => { node.disabled = state.stepIndex >= TOUR_STEPS.length - 1; });
  if (lastStepIndex !== state.stepIndex || lastTitle !== title || lastCaption !== caption || wasInspecting !== isInspecting || isFinished) {
    $$('[data-location]').forEach((node) => { node.textContent = step.kind === 'burner' ? '7층 · 버너' : levelName(step.floor); });
    $$('[data-view-label]').forEach((node) => { node.textContent = step.kind === 'burner' ? '구조 살펴보기' : '사람 시점'; });
    $$('[data-scene-eyebrow]').forEach((node) => { node.textContent = step.kind === 'burner' ? '건조기 핵심 설비 · 버너' : `건조기 현장 · ${levelName(step.floor)}`; });
    $$('[data-scene-title]').forEach((node) => { node.textContent = title; });
    $$('[data-scene-caption]').forEach((node) => { node.textContent = caption; });
    const activeGroup = groups.findIndex((group) => group.key === stepGroup(step));
    $$('.route-stop').forEach((node, index) => {
      if (index === activeGroup) node.setAttribute('aria-current', 'step');
      else node.removeAttribute('aria-current');
      node.classList.toggle('is-complete', index < activeGroup || isFinished);
    });
    lastStepIndex = state.stepIndex;
    lastTitle = title;
    lastCaption = caption;
  }
  updateInspection();
  tellHost(isPlaying || state.status === 'paused');
}

function togglePlayback() {
  if (!tour || !currentState) return;
  if (currentState.status === 'playing') tour.pause();
  else {
    if (currentState.status === 'finished') tour.restart();
    tour.play();
  }
}
async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
    else toast('브라우저의 전체 화면 기능을 사용해 주세요.');
  } catch { toast('전체 화면을 열 수 없습니다. 브라우저의 전체 화면 기능을 사용해 주세요.'); }
}
function bindControls(container) {
  container.querySelectorAll('[data-playback-rate]').forEach((select) => select.addEventListener('change', () => {
    tour?.setPlaybackRate(Number(select.value));
  }));
  container.querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', () => {
    switch (button.dataset.action) {
      case 'play': togglePlayback(); break;
      case 'resume': togglePlayback(); break;
      case 'previous': if (currentState) tour?.seek(Math.max(0, currentState.stepIndex - 1)); break;
      case 'next': if (currentState) tour?.seek(Math.min(TOUR_STEPS.length - 1, currentState.stepIndex + 1)); break;
      case 'restart': tour?.restart(); break;
      case 'fullscreen': void toggleFullscreen(); break;
      case 'reload': location.reload(); break;
    }
  }));
}
bindControls(document.body);
$$('[data-inspection-floor]').forEach((button) => button.addEventListener('click', () => {
  if (!beginInspection()) return;
  inspectionFloor = Number(button.dataset.inspectionFloor);
  scene?.setFloor(inspectionFloor);
  scene?.setView(inspectionView);
  updateInspection();
}));
$$('[data-inspection-view]').forEach((button) => button.addEventListener('click', () => {
  if (!beginInspection()) return;
  inspectionView = button.dataset.inspectionView;
  scene?.setView(inspectionView);
  updateInspection();
}));
$('[data-inspection-reset]').addEventListener('click', () => {
  if (!beginInspection()) return;
  scene?.resetView();
  inspectionView = 'perspective';
  updateInspection();
});
$('[data-inspection-all]').addEventListener('click', () => {
  if (!beginInspection()) return;
  inspectionFloor = 'all';
  inspectionView = 'perspective';
  scene?.setFloor('all');
  scene?.setView('perspective');
  updateInspection();
});

function addDetailControls() {
  const dialog = $('.furnace-dialog');
  if (!dialog) return;
  const header = dialog.querySelector('.furnace-header');
  if (header) {
    const logo = $('.company-logo').cloneNode(true);
    logo.classList.toggle('presentation-detail-logo', true);
    header.prepend(logo);
    const close = header.querySelector('.furnace-close');
    if (close) {
      close.textContent = '일시정지 · 7층으로';
      close.setAttribute('aria-label', '버너 시연을 일시정지하고 7층으로 돌아가기');
    }
  }
  const caption = document.createElement('div');
  caption.className = 'presentation-dialog-caption';
  const title = document.createElement('strong');
  title.dataset.sceneTitle = '';
  const text = document.createElement('p');
  text.dataset.sceneCaption = '';
  caption.append(title, text);
  const guide = $('.presentation-guide').cloneNode(true);
  guide.className = 'presentation-detail-guide';
  guide.querySelector('[data-guide-greeting]')?.remove();
  caption.append(guide);
  const controls = document.createElement('section');
  controls.className = 'presentation-dialog-controls';
  controls.setAttribute('aria-label', '건조기 시연 재생 도구');
  controls.append($('[data-controls]').cloneNode(true), $('.tour-timeline').cloneNode(true));
  dialog.append(caption, controls);
  bindControls(controls);
  if (currentState) updateState(currentState);
}

document.addEventListener('keydown', (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.repeat || event.target.closest('input,textarea,select,[contenteditable="true"]')) return;
  const key = event.code || event.key;
  if (key === 'Space' && event.target.closest('button')) return;
  if (key === 'Space') { event.preventDefault(); togglePlayback(); }
  else if (key === 'ArrowLeft') { event.preventDefault(); if (currentState) tour?.seek(Math.max(0, currentState.stepIndex - 1)); }
  else if (key === 'ArrowRight') { event.preventDefault(); if (currentState) tour?.seek(Math.min(TOUR_STEPS.length - 1, currentState.stepIndex + 1)); }
  else if (key === 'KeyR') { event.preventDefault(); tour?.restart(); }
  else if (key === 'KeyD') {
    event.preventDefault();
    if (currentState?.inspecting || currentState?.status === 'finished') togglePlayback();
    else if (beginInspection()) { inspectionView = 'top'; scene?.setView('top'); updateInspection(); }
  }
});
document.addEventListener('fullscreenchange', () => {
  $$('[data-fullscreen-label]').forEach((node) => { node.textContent = document.fullscreenElement ? '전체 화면 종료' : '전체 화면'; });
  if (document.fullscreenElement && currentState?.status === 'ready' && !currentState.inspecting) tour?.play();
  scene?.resize();
});
const syncActivity = () => {
  const active = hostActive && !document.hidden && !pageHidden;
  tour?.setActive(active);
  scene?.setActive(active);
};
window.addEventListener('message', (event) => {
  if (!embedded || event.source !== window.parent || event.origin !== location.origin) return;
  if (event.data?.type !== 'dryer-workspace:visibility' || typeof event.data.active !== 'boolean') return;
  hostActive = event.data.active;
  syncActivity();
});
document.addEventListener('visibilitychange', syncActivity);
window.addEventListener('pagehide', (event) => {
  pageHidden = true;
  tellHost(false);
  if (event.persisted) syncActivity();
  else {
    disposed = true;
    clearTimeout(toastTimer);
    tour?.dispose();
    furnace?.dispose();
    scene?.dispose();
  }
});
window.addEventListener('pageshow', () => { pageHidden = false; if (!disposed) syncActivity(); });

try {
  const catalog = EQUIPMENT.filter((item) => Number.isFinite(item.floor) && item.floor <= 8 && item.id !== 'f1-boiler-room');
  scene = createFacilityScene(canvas, { equipment: catalog, floor: 1, enabledAreas: ['dryer'], personEnabled: true, controlledPresentation: true });
  scene.setLabels(false);
  furnace = createFurnaceDetail({ presentation: true, onClose: () => { if (currentState?.status === 'playing') tour?.pause(); } });
  addDetailControls();
  tour = createPresentationTour({ scene, furnace, onChange: updateState, onTransition: ({ active }) => { $('#scene-transition').classList.toggle('is-active', active); } });
  canvas.dataset.ready = 'true';
  $('#presentation-loading').hidden = true;
  syncActivity();
  if (embedded) window.parent.postMessage({ type: 'dryer-workspace:ready', moduleId: 'presentation' }, location.origin);
} catch (error) {
  console.error('Presentation initialization failed:', error);
  $('#presentation-loading').hidden = true;
  $('#presentation-error').hidden = false;
  document.body.dataset.status = 'error';
  $('[data-status-label]').textContent = '시연 화면을 확인해 주세요';
  $$('[data-action]').filter((button) => button.dataset.action !== 'reload').forEach((button) => { button.disabled = true; });
  $$('[data-playback-rate]').forEach((select) => { select.disabled = true; });
  $$('[data-inspection-floor],[data-inspection-view],[data-inspection-reset],[data-inspection-all]').forEach((button) => { button.disabled = true; });
  $$('.route-stop').forEach((button) => { button.disabled = true; });
  tellHost(false);
}
