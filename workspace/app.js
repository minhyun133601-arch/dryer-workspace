import { MODULES, resolveRoute } from './module-registry.js';

const $ = (id) => document.getElementById(id);
const instances = new Map();
const icons = {
  drawings: '<rect x="17" y="10" width="46" height="60" rx="5"/><path d="M27 24h26M27 34h26M27 44h16M27 56h20M48 45v16"/>',
  site: '<path d="M10 68V38l20 10V30l20 12V24h12v44H10M15 68h56M56 24V12h9v56"/><rect x="19" y="55" width="8" height="7"/><rect x="35" y="55" width="8" height="7"/><path d="M50 51h12M50 59h12M10 38V27h12v17"/>',
  presentation: '<rect x="9" y="13" width="62" height="43" rx="4"/><path d="m34 25 17 10-17 10V25M40 56v13M27 69h26"/>',
};
let current = 'home';
let presentationActive = false;

function setPresentationActive(active) {
  presentationActive = active;
  document.querySelector('.workspace-header').hidden = active;
  document.body.dataset.presentationActive = String(active);
}

for (const module of MODULES) {
  const nav = document.createElement('a');
  nav.href = `#/${module.id}`;
  nav.dataset.route = module.id;
  nav.textContent = module.name;
  $('workspace-nav').append(nav);

  const card = document.createElement('a');
  card.className = `module-card ${module.accent || 'green'}`;
  card.href = `#/${module.id}`;
  const art = document.createElement('div');
  art.className = 'card-art';
  art.innerHTML = `<span class="card-number">${module.number}</span><svg viewBox="0 0 80 80" aria-hidden="true">${icons[module.icon] || icons.drawings}</svg><span class="art-grid" aria-hidden="true"></span>`;
  const content = document.createElement('div');
  content.className = 'card-content';
  const kicker = document.createElement('span');
  kicker.className = 'card-kicker';
  kicker.textContent = module.kicker;
  const title = document.createElement('h3');
  title.textContent = module.name;
  const description = document.createElement('p');
  description.textContent = module.description;
  const detail = document.createElement('span');
  detail.className = 'card-detail';
  detail.textContent = module.detail;
  const arrow = document.createElement('span');
  arrow.className = 'card-arrow';
  arrow.textContent = '↗';
  arrow.setAttribute('aria-hidden', 'true');
  content.append(kicker, title, description, detail, arrow);
  card.append(art, content);
  $('module-cards').append(card);
}
$('module-count').textContent = `${String(MODULES.length).padStart(2, '0')} SPACES`;

function sendVisibility(instance, active) {
  instance.frame.contentWindow?.postMessage({
    type: 'dryer-workspace:visibility', active: active && !document.hidden,
  }, location.origin);
}

function renderStatus() {
  const instance = instances.get(current);
  $('module-loading').hidden = !instance || instance.ready || !!instance.error;
  $('module-error').hidden = !instance?.error;
  if (instance) $('loading-label').textContent = `${instance.module.name} 화면을 준비하고 있습니다.`;
  if (instance?.error) $('error-message').textContent = instance.error;
}

function createInstance(module) {
  const frame = document.createElement('iframe');
  frame.className = 'module-frame';
  frame.title = `${module.name} 작업 공간`;
  frame.dataset.module = module.id;
  frame.setAttribute('allow', 'fullscreen');
  frame.setAttribute('allowfullscreen', '');
  const instance = { module, frame, ready: false, error: '', timer: null };
  instances.set(module.id, instance);
  function fail(message) {
    if (instance.ready) return;
    instance.error = message;
    clearTimeout(instance.timer);
    renderStatus();
  }
  frame.addEventListener('load', () => {
    if (module.id === 'presentation') setPresentationActive(false);
    sendVisibility(instance, current === module.id);
    try {
      if (!frame.contentDocument?.querySelector('html[lang="ko"]')) {
        fail(`${module.name} 화면 파일을 확인할 수 없습니다. 실행 창의 오류를 확인한 뒤 다시 시도해 주세요.`);
      }
    } catch { fail('작업 공간에 연결할 수 없습니다. 다시 불러와 주세요.'); }
  });
  frame.addEventListener('error', () => fail('화면에 연결하지 못했습니다. 다시 불러와 주세요.'));
  instance.timer = setTimeout(() => fail('화면 준비가 지연되고 있습니다. 다시 불러오기를 눌러 주세요.'), 20000);
  frame.src = module.entry;
  $('module-views').append(frame);
  return instance;
}

function showRoute() {
  const requested = resolveRoute(location.hash);
  const next = presentationActive ? 'presentation' : requested;
  if (presentationActive && requested !== next) history.replaceState(null, '', '#/presentation');
  const changed = current !== next;
  current = next;
  const module = MODULES.find((item) => item.id === current);
  if (module && !instances.has(module.id)) createInstance(module);
  $('home-view').hidden = current !== 'home';
  $('module-views').hidden = current === 'home';
  for (const [id, instance] of instances) {
    instance.frame.hidden = id !== current;
    sendVisibility(instance, id === current);
  }
  document.querySelectorAll('[data-route]').forEach((link) => {
    if (link.dataset.route === current) {
      link.setAttribute('aria-current', 'page');
      link.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    else link.removeAttribute('aria-current');
  });
  document.title = module ? `${module.name} · 희창유업 모델링 작업실` : '희창유업 3D 모델링 작업실';
  renderStatus();
  if (changed) $('workspace-main').focus({ preventScroll: true });
}

window.addEventListener('message', (event) => {
  if (event.origin !== location.origin) return;
  const instance = [...instances.values()].find((item) => item.frame.contentWindow === event.source);
  if (!instance) return;
  if (event.data?.type === 'dryer-workspace:ready' && event.data.moduleId === instance.module.id) {
    clearTimeout(instance.timer);
    instance.ready = true;
    instance.error = '';
    sendVisibility(instance, current === instance.module.id);
    renderStatus();
  } else if (event.data?.type === 'dryer-workspace:navigate' && MODULES.some((item) => item.id === event.data.moduleId)) {
    if (presentationActive) return;
    location.hash = `#/${event.data.moduleId}`;
  } else if (event.data?.type === 'dryer-workspace:presentation-active' && instance.module.id === 'presentation' && typeof event.data.active === 'boolean') {
    if (event.data.active && current !== 'presentation') return;
    setPresentationActive(event.data.active);
  }
});
window.addEventListener('hashchange', showRoute);
document.addEventListener('visibilitychange', () => {
  for (const [id, instance] of instances) sendVisibility(instance, id === current);
});
$('retry-module').addEventListener('click', () => {
  const instance = instances.get(current);
  if (!instance) return;
  if (instance.module.id === 'presentation') setPresentationActive(false);
  clearTimeout(instance.timer);
  sendVisibility(instance, false);
  instance.frame.remove();
  instances.delete(current);
  showRoute();
});
document.querySelector('.skip-link').addEventListener('click', (event) => {
  event.preventDefault();
  $('workspace-main').focus();
});

if (location.protocol === 'file:') {
  $('home-view').hidden = true;
  $('module-error').hidden = false;
  $('error-message').textContent = '폴더의 「프로젝트 실행.cmd」를 더블클릭하면 워크스페이스가 열립니다.';
  $('retry-module').hidden = true;
} else showRoute();
