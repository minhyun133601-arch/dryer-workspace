import { PARTS, PART_ORDER } from './parts-data.js';
import { icon } from './icons.js';
import { MOTOR_SPEC, BLOWER_SPEC } from './motor-spec.js';

const $ = (id) => document.getElementById(id);
const defaults = { mode: 'assembled', separation: 100, labels: false, field: false, running: false, speed: MOTOR_SPEC.ratedRpm, direction: 1, selected: 'housing' };
const state = { ...defaults };
const modeLabels = { assembled: '조립 상태', exploded: '분해 상태', cutaway: '단면 관찰' };
const modeDescriptions = {
  assembled: 'HSX150412 · 160M 모터의 하우징, 출력축과 뒤쪽 냉각부를 살펴보세요.',
  exploded: '출력측 6309ZZ · 팬측 6207ZZ 베어링과 축, 고정자, 냉각부의 조립 관계를 살펴보세요.',
  cutaway: '하우징 일부를 열어 고정자 권선과 회전자, 앞뒤 축 지지 구조를 살펴보세요.',
};
let scene;
let toastTimer;
const embedded = window.parent !== window;
// Embedded scenes wait for the host's visibility handshake, including when a
// slow module import finishes after the user has already switched away.
let hostActive = !embedded;
let pageHidden = false;
const syncActivity = () => scene?.setActive(hostActive && !document.hidden && !pageHidden);
window.addEventListener('message', (event) => {
  if (!embedded || event.source !== window.parent || event.origin !== location.origin) return;
  if (event.data?.type !== 'dryer-workspace:visibility' || typeof event.data.active !== 'boolean') return;
  hostActive = event.data.active;
  syncActivity();
});
document.addEventListener('visibilitychange', syncActivity);

document.querySelectorAll('[data-icon]').forEach((element) => { element.innerHTML = icon(element.dataset.icon); });
$('model-title').textContent = `${MOTOR_SPEC.manufacturer} ${MOTOR_SPEC.model}`;
$('model-frame').textContent = MOTOR_SPEC.frame;
$('model-summary').textContent = `${MOTOR_SPEC.powerKw} kW · ${MOTOR_SPEC.voltageV} V · ${MOTOR_SPEC.currentA} A · ${MOTOR_SPEC.frequencyHz} Hz`;
$('speed-input').value = MOTOR_SPEC.ratedRpm;
$('speed-input').max = MOTOR_SPEC.ratedRpm;
$('speed-input').step = 1;
$('parts-title').textContent = `${MOTOR_SPEC.model}의 구성 부품 ${PART_ORDER.length}개`;
$('motor-canvas').setAttribute('aria-label', `${MOTOR_SPEC.manufacturer} ${MOTOR_SPEC.model} ${MOTOR_SPEC.frame} 모터의 3D 구조. 드래그로 회전하고 스크롤로 확대하며 아래 ${PART_ORDER.length}개 부품에서 선택할 수 있습니다.`);
const specRows = (rows) => rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('');
$('motor-spec-title').textContent = `${MOTOR_SPEC.manufacturer} ${MOTOR_SPEC.model}`;
$('motor-spec-values').innerHTML = specRows([
  ['출력 / 전원', `${MOTOR_SPEC.powerKw} kW / ${MOTOR_SPEC.voltageV} V / ${MOTOR_SPEC.currentA} A`],
  ['형식 / 프레임', `${MOTOR_SPEC.model} / ${MOTOR_SPEC.frame}`],
  ['회전 / 주파수', `${MOTOR_SPEC.ratedRpm.toLocaleString('en-US')} RPM / ${MOTOR_SPEC.frequencyHz} Hz`],
  ['출력측 / 팬측', `${MOTOR_SPEC.frontBearing} / ${MOTOR_SPEC.rearBearing}`],
  ['제조번호 / 제조', `${MOTOR_SPEC.serial} / ${MOTOR_SPEC.manufactured}`],
]);
$('blower-spec-title').textContent = `${BLOWER_SPEC.manufacturer} ${BLOWER_SPEC.model}`;
$('blower-spec-values').innerHTML = specRows([
  ['출력 / 질량 유량', `${BLOWER_SPEC.powerKw} kW / ${BLOWER_SPEC.massFlowKgPerHour.toLocaleString('en-US')} kg/h`],
  ['형식', BLOWER_SPEC.model],
  ['회전 / 정압', `${BLOWER_SPEC.ratedRpm.toLocaleString('en-US')} RPM / ${BLOWER_SPEC.pressureMmAq} mmAQ`],
  ['베어링', `${BLOWER_SPEC.bearing} × ${BLOWER_SPEC.bearingQuantity}개`],
  ['제조번호 / 제조', `${BLOWER_SPEC.serial} / ${BLOWER_SPEC.manufactured}`],
]);
$('parts-list').innerHTML = PART_ORDER.map((id) => {
  const part = PARTS[id];
  return `<button class="part-card" data-part="${id}" aria-pressed="false" aria-label="${part.name} 선택"><span class="part-card-number">${part.number}</span><span class="part-card-arrow">${icon('arrowUpRight', 13)}</span><span class="part-card-name"><i style="background:${part.color}"></i>${part.name}</span><span class="part-card-english">${part.english}</span></button>`;
}).join('');

function toast(message) {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 3000);
}

function selectPart(id) {
  if (!PARTS[id]) {
    scene?.selectPart(state.selected);
    return;
  }
  state.selected = id;
  const part = PARTS[id];
  $('detail-number').textContent = `${part.number} / ${String(PART_ORDER.length).padStart(2, '0')}`;
  $('detail-name').textContent = part.name;
  $('detail-english').textContent = part.english;
  $('detail-description').textContent = part.description;
  $('detail-material').textContent = part.material;
  $('detail-role').textContent = part.role;
  $('detail-spec-row').hidden = !part.spec;
  $('detail-spec').textContent = part.spec || '';
  $('detail-observation').textContent = part.observation;
  $('detail-color').style.backgroundColor = part.color;
  document.querySelectorAll('.part-card').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.part === id)));
  scene?.selectPart(id);
}

function updateView(view) {
  document.querySelectorAll('[data-view]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.view === view)));
}

function updatePlayback() {
  const moving = state.running && state.speed > 0;
  $('play-button').innerHTML = icon(state.running ? 'pause' : 'play');
  $('play-button').setAttribute('aria-label', state.running ? '모터 회전 일시정지' : '모터 회전 시작');
  $('play-button').setAttribute('aria-pressed', String(state.running));
  $('playback-state').textContent = moving ? '모터 회전 중' : state.running ? '0 RPM · 대기' : '모터 정지';
  $('playback-caption').textContent = moving ? '관찰을 위해 감속 표시' : state.running ? '회전수를 올려 주세요' : `정격 ${MOTOR_SPEC.ratedRpm.toLocaleString('en-US')} RPM · ${MOTOR_SPEC.frequencyHz} Hz`;
  $('speed-output').innerHTML = `${state.speed.toLocaleString('en-US')} <span>RPM</span>`;
  $('speed-input').setAttribute('aria-valuetext', `${state.speed} RPM`);
  $('direction-label').textContent = state.direction === 1 ? '정회전' : '역회전';
  $('direction-button').setAttribute('aria-label', `회전 방향 변경: 현재 ${state.direction === 1 ? '정회전' : '역회전'}`);
  $('direction-button').setAttribute('aria-pressed', String(state.direction === -1));
  scene?.setSpeed(state.speed);
  scene?.setRunning(state.running);
  scene?.setDirection(state.direction);
}

function updateModel() {
  document.querySelectorAll('[data-mode]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.mode === state.mode)));
  $('scene-mode-label').textContent = modeLabels[state.mode];
  $('mode-description').textContent = modeDescriptions[state.mode];
  $('separation-control').hidden = state.mode !== 'exploded';
  $('separation-output').textContent = `${state.separation}%`;
  $('labels-toggle').checked = state.labels;
  $('field-toggle').checked = state.field;
  scene?.setOptions({
    exploded: state.mode === 'exploded' ? state.separation / 100 : 0,
    cutaway: state.mode === 'cutaway', labels: state.labels, field: state.field,
  });
}

function resetAll() {
  Object.assign(state, defaults);
  $('speed-input').value = state.speed;
  $('separation-input').value = state.separation;
  updateModel();
  updatePlayback();
  selectPart(state.selected);
  scene?.resetView();
  updateView('perspective');
  toast('처음 관찰 상태로 돌아왔습니다.');
}

document.querySelectorAll('[data-mode]').forEach((button) => button.addEventListener('click', () => { state.mode = button.dataset.mode; updateModel(); }));
document.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => { scene?.setView(button.dataset.view); updateView(button.dataset.view); }));
document.querySelectorAll('.part-card').forEach((button) => button.addEventListener('click', () => selectPart(button.dataset.part)));
$('separation-input').addEventListener('input', (event) => { state.separation = Number(event.target.value); updateModel(); });
$('labels-toggle').addEventListener('change', (event) => { state.labels = event.target.checked; updateModel(); });
$('field-toggle').addEventListener('change', (event) => { state.field = event.target.checked; updateModel(); });
$('speed-input').addEventListener('input', (event) => { state.speed = Number(event.target.value); updatePlayback(); });
$('play-button').addEventListener('click', () => { state.running = !state.running; updatePlayback(); });
$('direction-button').addEventListener('click', () => { state.direction *= -1; updatePlayback(); });
$('zoom-in').addEventListener('click', () => scene?.zoomBy(1.18));
$('zoom-out').addEventListener('click', () => scene?.zoomBy(1 / 1.18));
$('reset-view').addEventListener('click', () => { scene?.resetView(); updateView('perspective'); });
$('reset-all').addEventListener('click', resetAll);
$('nav-lab').addEventListener('click', () => $('main').scrollIntoView({ behavior: 'smooth' }));
$('nav-parts').addEventListener('click', () => { $('parts-section').scrollIntoView({ behavior: 'smooth', block: 'center' }); });

$('snapshot-button').addEventListener('click', () => {
  if (!scene) return toast('3D 화면을 불러온 뒤 다시 시도해 주세요.');
  try {
    const image = new Image();
    image.onload = () => {
      // Composite the transparent WebGL canvas onto the viewport's pale background.
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      context.fillStyle = '#f0f3ee'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) return toast('이미지를 저장하지 못했습니다. 다시 시도해 주세요.');
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `${MOTOR_SPEC.model}-${MOTOR_SPEC.frame}-${state.mode}.png`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        toast('현재 모터 화면을 PNG로 저장했습니다.');
      }, 'image/png');
    };
    image.onerror = () => toast('이미지를 저장하지 못했습니다. 다시 시도해 주세요.');
    image.src = scene.exportSnapshot();
  } catch { toast('이미지를 저장하지 못했습니다. 다시 시도해 주세요.'); }
});

$('fullscreen-button').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else if ($('scene-viewport').requestFullscreen) await $('scene-viewport').requestFullscreen();
    else toast('이 브라우저에서는 전체 화면을 지원하지 않습니다.');
  } catch { toast('전체 화면 전환을 사용할 수 없습니다.'); }
});
document.addEventListener('fullscreenchange', () => {
  $('fullscreen-button').setAttribute('aria-label', document.fullscreenElement ? '전체 화면 종료' : '관찰 화면 전체 화면으로 보기');
  scene?.resize();
});

document.querySelectorAll('.help-trigger').forEach((button) => button.addEventListener('click', () => $('guide-dialog').showModal()));
$('about-button').addEventListener('click', () => $('about-dialog').showModal());
document.querySelectorAll('.close-dialog').forEach((button) => button.addEventListener('click', () => button.closest('dialog').close()));
document.querySelectorAll('dialog').forEach((dialog) => dialog.addEventListener('click', (event) => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
}));
document.addEventListener('keydown', (event) => {
  if (document.querySelector('dialog[open]') || event.altKey || event.ctrlKey || event.metaKey || event.repeat || event.target.matches('input,textarea,select,button,a,[contenteditable=true]')) return;
  if (event.code === 'Space') { event.preventDefault(); state.running = !state.running; updatePlayback(); }
  if (event.key.toLowerCase() === 'r') { scene?.resetView(); updateView('perspective'); }
});

updateModel(); updatePlayback(); selectPart(state.selected);
try {
  const { MotorScene } = await import('./motor-scene.js');
  scene = new MotorScene($('motor-canvas'), {
    onSelect: selectPart, onCameraChange: updateView,
    active: hostActive && !document.hidden && !pageHidden,
  });
  updateModel(); updatePlayback(); selectPart(state.selected);
  $('motor-canvas').dataset.ready = 'true';
} catch (error) {
  console.error('Motor scene initialization failed:', error);
  $('scene-error').hidden = false;
  ['play-button', 'zoom-in', 'zoom-out', 'reset-view', 'snapshot-button'].forEach((id) => { $(id).disabled = true; });
}
window.addEventListener('pagehide', (event) => {
  pageHidden = true;
  if (event.persisted) syncActivity();
  else scene?.dispose();
});
window.addEventListener('pageshow', () => {
  pageHidden = false;
  syncActivity();
});
if (embedded) {
  window.parent.postMessage(
    { type: 'dryer-workspace:ready', moduleId: 'motor' },
    location.origin === 'null' ? '*' : location.origin,
  );
}
