import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Exercise the real presentation document and controller wiring without WebGL.
class Element {
  constructor(tagName = 'div', parent = null) {
    this.tagName = tagName.toUpperCase(); this.parentElement = parent; this.children = [];
    this.attributes = {}; this.dataset = {}; this.listeners = new Map(); this.style = { setProperty(name, value) { this[name] = value; } };
    this.className = ''; this.hidden = false; this.disabled = false; this.textContent = '';
    this.classList = {
      contains: (name) => this.className.split(/\s+/).includes(name),
      toggle: (name, force) => {
        const names = new Set(this.className.split(/\s+/).filter(Boolean));
        if (force ?? !names.has(name)) names.add(name); else names.delete(name);
        this.className = [...names].join(' ');
      },
    };
  }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === 'class') this.className = String(value);
    if (name === 'hidden') this.hidden = true;
    if (name === 'disabled') this.disabled = true;
    if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = String(value);
  }
  getAttribute(name) { return name === 'class' ? this.className : this.attributes[name]; }
  removeAttribute(name) { delete this.attributes[name]; }
  append(...children) { for (const child of children) { child.parentElement = this; this.children.push(child); } }
  prepend(...children) { for (const child of [...children].reverse()) { child.parentElement = this; this.children.unshift(child); } }
  remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter((child) => child !== this); }
  addEventListener(type, callback) { if (!this.listeners.has(type)) this.listeners.set(type, []); this.listeners.get(type).push(callback); }
  click() { if (!this.disabled) for (const callback of this.listeners.get('click') || []) callback({ target: this }); }
  change(value) { this.value = String(value); for (const callback of this.listeners.get('change') || []) callback({ target: this }); }
  matches(selector) {
    return selector.split(',').some((part) => {
      part = part.trim();
      if (part.startsWith('#')) return this.attributes.id === part.slice(1);
      if (part.startsWith('.')) return this.classList.contains(part.slice(1));
      if (part.startsWith('[')) {
        const [, name, value] = part.match(/^\[([^=\]]+)(?:=["']?([^"'\]]+)["']?)?\]$/) || [];
        const actual = name?.startsWith('data-') ? this.dataset[name.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] : this.attributes[name];
        return name && (value === undefined ? actual !== undefined : actual === value);
      }
      return this.tagName.toLowerCase() === part;
    });
  }
  closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; }
  querySelectorAll(selector) { return this.children.flatMap((child) => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  cloneNode(deep = false) {
    const next = new Element(this.tagName);
    Object.entries(this.attributes).forEach(([key, value]) => next.setAttribute(key, value));
    Object.assign(next.dataset, this.dataset); next.className = this.className; next.textContent = this.textContent; next.disabled = this.disabled;
    if (deep) next.append(...this.children.map((child) => child.cloneNode(true)));
    return next;
  }
}
function parseDocument(html) {
  const root = new Element('document'), stack = [root];
  for (const match of html.matchAll(/<!--[\s\S]*?-->|<![^>]+>|<\/?[a-z][^>]*>|[^<]+/gi)) {
    const token = match[0];
    if (token.startsWith('<!')) continue;
    if (token.startsWith('</')) { stack.pop(); continue; }
    if (!token.startsWith('<')) { stack.at(-1).textContent += token; continue; }
    const tag = token.match(/^<([a-z][\w-]*)/i)[1], node = new Element(tag);
    for (const attribute of token.slice(tag.length + 1).matchAll(/([\w-]+)(?:\s*=\s*"([^"]*)")?/g)) node.setAttribute(attribute[1], attribute[2] ?? '');
    stack.at(-1).append(node);
    if (!/\/$/.test(token.slice(0, -1)) && !/^(meta|link|img|input|br|hr|path|ellipse)$/i.test(tag)) stack.push(node);
  }
  return root;
}

const steps = [...[1, 2, 3, 4, 5, 6, 7, 8].map((floor) => ({ id: `floor-${floor}`, floor, kind: 'walk', title: `장면 ${floor}`, caption: `설명 ${floor}`, duration: 10 })),
  { id: 'burner', floor: 7, kind: 'burner', title: '버너 분해', caption: '조립 상태에서 분해 상태로', duration: 20 }];
const equipment = [{ id: 'f1-tank', floor: 1 }, { id: 'heater', floor: 6 }, { id: 'f1-boiler-room', floor: 1 }, { id: 'roof', floor: 8 }, { id: 'campus', floor: 'campus' }];
const floors = [1, 2, 3, 4, 5, 6, 7, 8].map((id) => ({ id, displayLevel: id === 2 ? 1.5 : id }));

async function harness({ embedded = false, failScene = false } = {}) {
  const [html, code] = await Promise.all([
    readFile(new URL('../apps/presentation/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../apps/presentation/app.js', import.meta.url), 'utf8'),
  ]);
  const root = parseDocument(html), calls = [], messages = [], errors = [], docEvents = new Map(), winEvents = new Map();
  const document = {
    body: root.querySelector('body'), documentElement: root.querySelector('html'), hidden: false, fullscreenElement: null,
    querySelector: (selector) => root.querySelector(selector), querySelectorAll: (selector) => root.querySelectorAll(selector),
    createElement: (tag) => new Element(tag),
    addEventListener(type, callback) { if (!docEvents.has(type)) docEvents.set(type, []); docEvents.get(type).push(callback); },
    async exitFullscreen() { calls.push(['exitFullscreen']); document.fullscreenElement = null; },
  };
  document.documentElement.requestFullscreen = async () => { calls.push(['fullscreen']); document.fullscreenElement = document.documentElement; };
  const location = { origin: 'https://example.invalid', reload: () => calls.push(['reload']) };
  const window = { addEventListener(type, callback) { if (!winEvents.has(type)) winEvents.set(type, []); winEvents.get(type).push(callback); } };
  window.parent = embedded ? { postMessage(message, origin) { messages.push({ message, origin }); } } : window;
  let sceneOptions, furnaceOptions, api;
  const scene = Object.fromEntries(['setLabels', 'setActive', 'resize', 'dispose', 'setFloor', 'setView', 'resetView'].map((method) => [method, (...args) => calls.push([`scene.${method}`, ...args])]));
  const context = vm.createContext({ document, window, location, EQUIPMENT: equipment, FLOORS: floors, TOUR_STEPS: steps,
    console: { error(...args) { errors.push(args); } }, setTimeout: () => 1, clearTimeout() {},
    createFacilityScene(canvas, options) { if (failScene) throw new Error('WebGL unavailable'); sceneOptions = options; return scene; },
    createFurnaceDetail(options) {
      furnaceOptions = options;
      const dialog = new Element('dialog'); dialog.className = 'furnace-dialog';
      const header = new Element('header'); header.className = 'furnace-header';
      const close = new Element('button'); close.className = 'furnace-close'; header.append(close); dialog.append(header);
      document.body.append(dialog);
      return { dispose() { calls.push(['furnace.dispose']); } };
    },
    createPresentationTour(options) {
      let state = { status: 'ready', inspecting: false, stepIndex: 0, step: steps[0], title: steps[0].title, caption: steps[0].caption, elapsed: 0, totalDuration: 210, progress: 0, playbackRate: 1, doorInteraction: null, waitingDoor: false, doorAction: null };
      const publish = () => options.onChange({ ...state, playbackDuration: state.totalDuration / state.playbackRate, playbackElapsed: state.elapsed / state.playbackRate, remainingDuration: (state.totalDuration - state.elapsed) / state.playbackRate });
      api = {
        play() { calls.push(['tour.play']); state.status = 'playing'; state.inspecting = false; publish(); },
        pause() { calls.push(['tour.pause']); if (state.status === 'playing') state.status = 'paused'; publish(); },
        inspect() { calls.push(['tour.inspect']); state.status = 'paused'; state.inspecting = true; state.doorInteraction = null; state.waitingDoor = false; state.doorAction = null; publish(); return true; },
        restart() { calls.push(['tour.restart']); state = { ...state, status: 'ready', inspecting: false, stepIndex: 0, step: steps[0], title: steps[0].title, caption: steps[0].caption, elapsed: 0, progress: 0, doorInteraction: null, waitingDoor: false, doorAction: null }; publish(); },
        seek(index) { calls.push(['tour.seek', index]); state = { ...state, status: state.status === 'playing' ? 'playing' : 'paused', inspecting: false, stepIndex: index, step: steps[index], title: steps[index].title, caption: steps[index].caption, elapsed: index * 10, progress: index / steps.length }; publish(); },
        setActive(active) { calls.push(['tour.setActive', active]); if (!active && state.status === 'playing') { state.status = 'paused'; publish(); } },
        dispose() { calls.push(['tour.dispose']); },
        state: () => state,
        finish() { state.status = 'finished'; state.inspecting = true; state.elapsed = state.totalDuration; state.progress = 1; state.doorInteraction = null; state.waitingDoor = false; state.doorAction = null; publish(); },
        shot(title, caption) { state.title = title; state.caption = caption; publish(); },
        advance(elapsed) { state.elapsed = elapsed; state.progress = elapsed / state.totalDuration; publish(); },
        setPlaybackRate(rate) { calls.push(['tour.setPlaybackRate', rate]); if (![.5, 1, 1.5, 2, 3].includes(rate)) return false; state.playbackRate = rate; publish(); return true; },
        door(doorInteraction, doorAction = null) { state.doorInteraction = doorInteraction; state.waitingDoor = !!doorInteraction?.blocked; state.doorAction = doorAction; publish(); },
        interactDoor() { calls.push(['tour.interactDoor']); },
        transition(active) { options.onTransition({ active }); },
      };
      publish(); return api;
    },
  });
  new vm.Script(code.replace(/^import .*;\r?\n/gm, '')).runInContext(context);
  const fire = (events, type, event) => { for (const callback of events.get(type) || []) callback(event); };
  return { document, window, location, calls, messages, errors, api, sceneOptions, furnaceOptions,
    node: (selector) => document.querySelector(selector), nodes: (selector) => document.querySelectorAll(selector),
    message(data, { source = window.parent, origin = location.origin } = {}) { fire(winEvents, 'message', { data, source, origin }); },
    windowEvent: (type, event) => fire(winEvents, type, event),
    documentEvent: (type, event) => fire(docEvents, type, event),
    key(code, target = document.body, extras = {}) { let prevented = false; fire(docEvents, 'keydown', { code, target, preventDefault() { prevented = true; }, ...extras }); return prevented; },
  };
}

test('presentation starts ready at 1F with only dryer equipment, a visible start action and no automatic playback', async () => {
  const h = await harness();
  assert.deepEqual(h.errors, []);
  assert.equal(h.node('#presentation-loading').hidden, true);
  assert.equal(h.node('#presentation-canvas').dataset.ready, 'true');
  assert.equal(h.node('[data-play-label]').textContent, '시연 시작');
  assert.equal(h.api.state().status, 'ready');
  assert.equal(h.calls.some(([method]) => method === 'tour.play'), false);
  assert.equal(h.sceneOptions.floor, 1);
  assert.equal(h.sceneOptions.controlledPresentation, true);
  assert.deepEqual(Array.from(h.sceneOptions.enabledAreas), ['dryer']);
  assert.deepEqual(Array.from(h.sceneOptions.equipment, ({ id }) => id), ['f1-tank', 'heater', 'roof']);
  assert.equal(h.furnaceOptions.presentation, true);
  assert.equal(h.furnaceOptions.documents, undefined);
  assert.equal(h.nodes('.route-stop').length, 9);
  assert.equal(h.node('#tour-route').style['--route-count'], '9');
  assert.equal(h.nodes('.route-stop')[7].children[1].textContent, '옥상');
  assert.equal(h.nodes('.route-stop')[1].children[1].textContent, '1.5층');
  assert.equal(h.node('[data-duration]').textContent, '3:30');
  assert.equal(h.node('[data-playback-rate]').value, '1');
  assert.equal(h.node('#presentation-inspector').hidden, false);
  assert.equal(h.document.body.dataset.inspecting, 'false');
  assert.equal(h.node('[data-inspection-floor="1"]').getAttribute('aria-pressed'), 'true');
  assert.ok(h.nodes('[data-inspection-view]').every((node) => node.getAttribute('aria-pressed') === 'false'), 'the walking camera is distinct from manual plan and 3D views');
});

test('plans and floor inspection are available before starting and resume the original first-floor scene', async () => {
  const h = await harness();
  h.node('[data-inspection-view="top"]').click();
  assert.equal(h.api.state().status, 'paused'); assert.equal(h.api.state().inspecting, true);
  assert.equal(h.document.body.dataset.inspecting, 'true'); assert.equal(h.api.state().elapsed, 0);
  assert.equal(h.node('#tour-route').hidden, true);
  assert.equal(h.node('[data-location]').textContent, '1층');
  assert.equal(h.node('[data-scene-title]').textContent, '1층 · 평면 도면');
  assert.equal(h.node('[data-view-label]').textContent, '평면 보기');
  assert.equal(h.node('[data-inspection-view="top"]').getAttribute('aria-pressed'), 'true');
  assert.equal(h.calls.filter(([name]) => name === 'tour.inspect').length, 1);
  h.node('[data-inspection-floor="2"]').click();
  assert.deepEqual(h.calls.slice(-2), [['scene.setFloor', 2], ['scene.setView', 'top']]);
  assert.equal(h.node('[data-location]').textContent, '1.5층');
  h.node('[data-inspection-reset]').click();
  assert.deepEqual(h.calls.at(-1), ['scene.resetView']);
  assert.equal(h.node('[data-inspection-view="perspective"]').getAttribute('aria-pressed'), 'true');
  h.node('[data-inspection-all]').click();
  assert.equal(h.node('[data-location]').textContent, '전체');
  assert.equal(h.node('[data-inspection-all]').getAttribute('aria-pressed'), 'true');
  assert.equal(h.calls.filter(([name]) => name === 'tour.inspect').length, 1, 'manual view changes keep the existing inspection session');
  h.node('[data-action="resume"]').click();
  assert.equal(h.api.state().status, 'playing'); assert.equal(h.api.state().inspecting, false);
  assert.equal(h.document.body.dataset.inspecting, 'false'); assert.equal(h.node('#tour-route').hidden, false);
  assert.equal(h.node('#presentation-inspector').hidden, false);
  assert.equal(h.node('[data-location]').textContent, '1층');
  assert.equal(h.node('[data-view-label]').textContent, '사람 시점');
  assert.equal(h.node('[data-scene-title]').textContent, '장면 1');
  assert.equal(h.node('[data-inspection-floor="1"]').getAttribute('aria-pressed'), 'true');
  assert.equal(h.node('[data-inspection-all]').getAttribute('aria-pressed'), 'false');
});

test('plans open on the current floor while playing or paused and preserve progress through rate changes and resume', async () => {
  for (const paused of [false, true]) {
    const h = await harness();
    h.node('[data-action="play"]').click(); h.api.seek(3); h.api.advance(50);
    if (paused) h.node('[data-action="play"]').click();
    const { elapsed, progress, stepIndex } = h.api.state();
    h.node('[data-inspection-view="top"]').click();
    assert.equal(h.api.state().status, 'paused'); assert.equal(h.api.state().inspecting, true);
    assert.equal(h.node('[data-location]').textContent, '4층');
    assert.equal(h.node('[data-scene-title]').textContent, '4층 · 평면 도면');
    assert.equal(h.node('[data-inspection-floor="4"]').getAttribute('aria-pressed'), 'true');
    assert.deepEqual(h.calls.slice(-3), [['scene.setFloor', 4], ['scene.setView', 'perspective'], ['scene.setView', 'top']]);
    const count = h.calls.length;
    h.node('[data-playback-rate]').change('2');
    assert.deepEqual(h.calls.slice(count), [['tour.setPlaybackRate', 2]]);
    assert.equal(h.node('[data-location]').textContent, '4층');
    assert.equal(h.node('[data-inspection-view="top"]').getAttribute('aria-pressed'), 'true');
    h.node('[data-inspection-floor="8"]').click();
    assert.equal(h.node('[data-location]').textContent, '옥상');
    assert.equal(h.api.state().elapsed, elapsed); assert.equal(h.api.state().progress, progress);
    assert.equal(h.api.state().stepIndex, stepIndex);
    h.node('[data-action="resume"]').click();
    assert.equal(h.api.state().status, 'playing'); assert.equal(h.api.state().inspecting, false);
    assert.equal(h.api.state().elapsed, elapsed); assert.equal(h.api.state().progress, progress);
    assert.equal(h.api.state().stepIndex, stepIndex); assert.equal(h.api.state().playbackRate, 2);
    assert.equal(h.document.body.dataset.inspecting, 'false');
    assert.equal(h.node('[data-location]').textContent, '4층');
    assert.equal(h.node('[data-view-label]').textContent, '사람 시점');
    assert.equal(h.node('[data-scene-title]').textContent, '장면 4');
    assert.equal(h.node('[data-scene-caption]').textContent, '설명 4');
    assert.ok(h.nodes('[data-inspection-view]').every((node) => node.getAttribute('aria-pressed') === 'false'));
    assert.ok(h.nodes('[data-total-progress]').every((node) => node.style.transform === `scaleX(${progress})`));
  }
});

test('play, pause, previous, next, route seeking and restart update the visible scene and controls together', async () => {
  const h = await harness();
  h.node('[data-action="play"]').click();
  assert.equal(h.api.state().status, 'playing');
  assert.equal(h.node('[data-play-label]').textContent, '일시정지');
  h.node('[data-action="next"]').click();
  assert.equal(h.api.state().stepIndex, 1);
  assert.equal(h.node('[data-location]').textContent, '1.5층');
  assert.equal(h.nodes('.route-stop')[1].getAttribute('aria-current'), 'step');
  h.node('[data-action="previous"]').click();
  assert.equal(h.api.state().stepIndex, 0);
  assert.equal(h.node('[data-action="previous"]').disabled, true);
  h.nodes('.route-stop')[6].click();
  assert.equal(h.api.state().stepIndex, 6);
  h.node('[data-action="play"]').click();
  assert.equal(h.api.state().status, 'paused');
  assert.equal(h.node('[data-play-label]').textContent, '계속 재생');
  h.node('[data-action="restart"]').click();
  assert.equal(h.api.state().stepIndex, 0);
  assert.equal(h.api.state().status, 'ready');
  h.api.finish();
  h.node('[data-action="play"]').click();
  assert.equal(h.api.state().status, 'playing');
  assert.deepEqual(h.calls.slice(-2).map(([name]) => name), ['tour.restart', 'tour.play']);
});

test('keyboard transport supports Space, arrows and R while leaving native buttons and text input alone', async () => {
  const h = await harness();
  assert.equal(h.key('Space'), true);
  assert.equal(h.api.state().status, 'playing');
  h.key('ArrowRight'); assert.equal(h.api.state().stepIndex, 1);
  h.key('ArrowLeft'); assert.equal(h.api.state().stepIndex, 0);
  h.key('KeyR'); assert.equal(h.api.state().status, 'ready');
  assert.equal(h.key('Space', h.node('[data-action="play"]')), false);
  assert.equal(h.api.state().status, 'ready');
  assert.equal(h.key('ArrowRight', new Element('input')), false);
  assert.equal(h.api.state().stepIndex, 0);
  assert.equal(h.key('Space', h.document.body, { ctrlKey: true }), false);
});

test('D toggles the current-floor plan and saved tour, ignoring inputs, modifiers and repeat keys', async () => {
  const h = await harness();
  h.node('[data-action="play"]').click(); h.api.seek(1); h.api.advance(12);
  const elapsed = h.api.state().elapsed, progress = h.api.state().progress;
  const editable = new Element('div'); editable.setAttribute('contenteditable', 'true');
  const count = h.calls.length;
  for (const target of [new Element('input'), new Element('textarea'), new Element('select'), editable]) assert.equal(h.key('KeyD', target), false);
  for (const extras of [{ altKey: true }, { ctrlKey: true }, { metaKey: true }, { repeat: true }]) assert.equal(h.key('KeyD', h.document.body, extras), false);
  assert.equal(h.calls.length, count); assert.equal(h.api.state().status, 'playing');
  assert.equal(h.key('KeyD'), true);
  assert.equal(h.api.state().status, 'paused'); assert.equal(h.api.state().inspecting, true);
  assert.equal(h.node('[data-location]').textContent, '1.5층');
  assert.equal(h.node('[data-scene-title]').textContent, '1.5층 · 평면 도면');
  assert.equal(h.node('[data-inspection-view="top"]').getAttribute('aria-pressed'), 'true');
  assert.equal(h.key('KeyD'), true);
  assert.equal(h.api.state().status, 'playing'); assert.equal(h.api.state().inspecting, false);
  assert.equal(h.api.state().elapsed, elapsed); assert.equal(h.api.state().progress, progress);
  assert.equal(h.node('[data-scene-title]').textContent, '장면 2');
  assert.equal(h.node('[data-view-label]').textContent, '사람 시점');
  h.api.finish(); h.key('KeyD');
  assert.equal(h.api.state().status, 'playing'); assert.equal(h.api.state().elapsed, 0);
  assert.equal(h.api.state().inspecting, false); assert.equal(h.node('[data-location]').textContent, '1층');
});

test('native burner dialog contains synchronized working transport controls and closing it pauses playback', async () => {
  const h = await harness(), dialog = h.node('.furnace-dialog');
  assert.ok(dialog.querySelector('.presentation-dialog-controls'));
  assert.ok(dialog.querySelector('.presentation-dialog-caption'));
  assert.ok(dialog.querySelector('.presentation-detail-logo'), 'the logo remains in the native modal top layer');
  assert.ok(dialog.querySelector('.presentation-detail-guide'), 'the guide remains visible beside the burner caption');
  assert.equal(dialog.querySelector('.furnace-close').textContent, '일시정지 · 7층으로');
  h.api.seek(steps.length - 1);
  assert.equal(dialog.querySelector('[data-scene-title]').textContent, '버너 분해');
  dialog.querySelector('[data-action="play"]').click();
  assert.equal(h.api.state().status, 'playing');
  assert.ok(h.nodes('[data-play-label]').every((node) => node.textContent === '일시정지'));
  h.api.shot('버너 주요 부품', '분해된 부품의 조립 관계를 살펴봅니다.');
  assert.ok(h.nodes('[data-scene-title]').every((node) => node.textContent === '버너 주요 부품'));
  assert.ok(h.nodes('[data-scene-caption]').every((node) => node.textContent === '분해된 부품의 조립 관계를 살펴봅니다.'));
  h.furnaceOptions.onClose();
  assert.equal(h.api.state().status, 'paused');
  assert.ok(h.nodes('[data-play-label]').every((node) => node.textContent === '계속 재생'));
  dialog.querySelector('[data-action="previous"]').click();
  assert.equal(h.api.state().stepIndex, steps.length - 2);
  h.api.transition(true); assert.equal(h.node('#scene-transition').classList.contains('is-active'), true);
  h.api.transition(false); assert.equal(h.node('#scene-transition').classList.contains('is-active'), false);
});

test('speed selection updates both control bars and real playback times without seeking, restarting or changing progress', async () => {
  const h = await harness(), dialog = h.node('.furnace-dialog');
  const original = h.node('[data-playback-rate]'), detail = dialog.querySelector('[data-playback-rate]');
  assert.ok(detail);
  assert.equal(original.getAttribute('aria-label'), '시연 배속');
  assert.deepEqual(original.children.map((option) => option.getAttribute('value')), ['0.5', '1', '1.5', '2', '3']);
  h.node('[data-action="play"]').click();
  h.api.seek(3); h.api.advance(20);
  const stepIndex = h.api.state().stepIndex, progress = h.api.state().progress, elapsed = h.api.state().elapsed;
  const callCount = h.calls.length;
  original.change('2');
  assert.deepEqual(h.calls.slice(callCount), [['tour.setPlaybackRate', 2]]);
  assert.equal(h.api.state().status, 'playing');
  assert.equal(h.api.state().stepIndex, stepIndex);
  assert.equal(h.api.state().progress, progress);
  assert.equal(h.api.state().elapsed, elapsed);
  assert.equal(original.value, '2'); assert.equal(detail.value, '2');
  assert.ok(h.nodes('[data-duration]').every((node) => node.textContent === '1:45'));
  assert.ok(h.nodes('[data-elapsed]').every((node) => node.textContent === '0:10'));
  h.node('[data-action="play"]').click();
  detail.change('0.5');
  assert.equal(h.api.state().status, 'paused');
  assert.equal(original.value, '0.5'); assert.equal(detail.value, '0.5');
  assert.ok(h.nodes('[data-duration]').every((node) => node.textContent === '7:00'));
  assert.ok(h.nodes('[data-elapsed]').every((node) => node.textContent === '0:40'));
  assert.equal(h.api.state().progress, progress);
  assert.equal(h.api.state().elapsed, elapsed);
});

test('walking past doors keeps the presentation unobstructed and offers no manual door actions or operation cues', async () => {
  const h = await harness();
  assert.equal(h.node('#presentation-door-prompt'), null);
  assert.equal(h.node('[data-door-action]'), null);
  h.node('[data-action="play"]').click();
  h.api.advance(12);
  for (const phase of ['approach', 'operating', 'opening', null]) {
    h.api.door({ id: 'entry-door', label: '관찰 통로 출입문', action: 'open', blocked: true }, phase);
    assert.equal(h.node('[data-status-label]').textContent, '자동 시연 중');
    assert.equal(h.node('[data-playback-label]').textContent, '재생 중');
    assert.equal(h.node('[data-guide-greeting]').textContent, '현장을 따라갑니다');
    assert.equal(h.node('[data-door-action]'), null);
    assert.equal(h.node('[data-door-message]'), null);
    assert.equal(h.key('KeyF'), false, 'the presentation does not ask the viewer to operate doors');
  }
  assert.equal(h.calls.some(([name]) => name === 'tour.interactDoor'), false);
  h.node('[data-action="play"]').click();
  assert.equal(h.api.state().status, 'paused');
  assert.equal(h.node('[data-status-label]').textContent, '일시정지');
  h.api.finish();
  assert.equal(h.node('#presentation-inspector').hidden, false);
  assert.equal(h.node('#presentation-door-prompt'), null);
});

test('the completed show preserves dryer floor and plan/3D inspection on rate changes and resets its selection on restart', async () => {
  const h = await harness();
  h.api.finish();
  assert.equal(h.node('#presentation-inspector').hidden, false);
  assert.equal(h.document.body.dataset.inspecting, 'true');
  assert.equal(h.node('#tour-route').hidden, true);
  assert.equal(h.node('[data-scene-title]').textContent, '시연을 마쳤습니다');
  assert.equal(h.node('[data-scene-caption]').textContent, '층과 시점을 선택해 직접 둘러보세요.');
  assert.equal(h.node('[data-location]').textContent, '7층');
  assert.equal(h.node('[data-inspection-view="perspective"]').getAttribute('aria-pressed'), 'true');
  assert.equal(h.node('[data-inspection-all]').getAttribute('aria-pressed'), 'false');
  assert.deepEqual(h.nodes('[data-inspection-floor]').map((node) => node.dataset.inspectionFloor), ['1', '2', '3', '4', '5', '6', '7', '8']);
  h.node('[data-inspection-floor="8"]').click();
  assert.deepEqual(h.calls.slice(-2), [['scene.setFloor', 8], ['scene.setView', 'perspective']]);
  assert.equal(h.node('[data-location]').textContent, '옥상');
  h.node('[data-inspection-floor="2"]').click();
  assert.deepEqual(h.calls.slice(-2), [['scene.setFloor', 2], ['scene.setView', 'perspective']]);
  assert.equal(h.node('[data-location]').textContent, '1.5층');
  h.node('[data-inspection-view="top"]').click();
  assert.deepEqual(h.calls.at(-1), ['scene.setView', 'top']);
  assert.equal(h.node('[data-view-label]').textContent, '평면 보기');
  h.node('[data-playback-rate]').change('2');
  assert.equal(h.node('[data-inspection-floor="2"]').getAttribute('aria-pressed'), 'true');
  assert.equal(h.node('[data-inspection-view="top"]').getAttribute('aria-pressed'), 'true');
  assert.equal(h.node('[data-location]').textContent, '1.5층');
  h.node('[data-inspection-reset]').click();
  assert.deepEqual(h.calls.at(-1), ['scene.resetView']);
  assert.equal(h.node('[data-inspection-view="perspective"]').getAttribute('aria-pressed'), 'true');
  h.node('[data-inspection-all]').click();
  assert.deepEqual(h.calls.slice(-2), [['scene.setFloor', 'all'], ['scene.setView', 'perspective']]);
  assert.equal(h.node('[data-location]').textContent, '전체');
  assert.equal(h.node('[data-inspection-all]').getAttribute('aria-pressed'), 'true');
  assert.ok(h.nodes('[data-inspection-floor]').every((node) => node.getAttribute('aria-pressed') === 'false'));
  h.node('[data-inspection-view="top"]').click();
  assert.deepEqual(h.calls.at(-1), ['scene.setView', 'top']);
  assert.equal(h.node('[data-location]').textContent, '전체');
  assert.equal(h.node('[data-view-label]').textContent, '평면 보기');
  h.node('[data-inspection-view="perspective"]').click();
  assert.deepEqual(h.calls.at(-1), ['scene.setView', 'perspective']);
  assert.equal(h.node('[data-inspection-all]').getAttribute('aria-pressed'), 'true');
  h.node('[data-inspection-floor="3"]').click();
  assert.deepEqual(h.calls.slice(-2), [['scene.setFloor', 3], ['scene.setView', 'perspective']]);
  assert.equal(h.node('[data-inspection-all]').getAttribute('aria-pressed'), 'false');
  assert.equal(h.node('[data-inspection-floor="3"]').getAttribute('aria-pressed'), 'true');
  assert.equal(h.node('[data-location]').textContent, '3층');
  h.node('[data-action="restart"]').click();
  assert.equal(h.node('#presentation-inspector').hidden, false);
  assert.equal(h.document.body.dataset.inspecting, 'false');
  assert.equal(h.node('[data-inspection-floor="1"]').getAttribute('aria-pressed'), 'true');
  assert.equal(h.node('#tour-route').hidden, false);
  assert.equal(h.api.state().playbackRate, 2, 'another show keeps the selected playback rate');
});

test('embedded activity requires the actual parent and matching origin, and hidden pages pause rather than auto-resume', async () => {
  const h = await harness({ embedded: true });
  assert.deepEqual(structuredClone(h.messages.find(({ message }) => message.type === 'dryer-workspace:ready')), { message: { type: 'dryer-workspace:ready', moduleId: 'presentation' }, origin: h.location.origin });
  assert.equal(h.calls.at(-2)[0], 'tour.setActive');
  assert.equal(h.calls.at(-2)[1], false);
  for (const options of [{ source: {} }, { origin: 'https://unrelated.invalid' }]) {
    const count = h.calls.length;
    h.message({ type: 'dryer-workspace:visibility', active: true }, options);
    assert.equal(h.calls.length, count);
  }
  h.message({ type: 'dryer-workspace:visibility', active: true });
  assert.deepEqual(h.calls.at(-2), ['tour.setActive', true]);
  h.node('[data-action="play"]').click();
  assert.equal(h.messages.at(-1).message.active, true);
  h.document.hidden = true; h.documentEvent('visibilitychange');
  assert.equal(h.api.state().status, 'paused');
  assert.equal(h.messages.at(-1).message.active, true, 'pausing keeps the presentation isolated from other modules');
  h.document.hidden = false; h.documentEvent('visibilitychange');
  assert.equal(h.api.state().status, 'paused', 'revealing the tab requires a deliberate resume');
  h.node('[data-action="play"]').click();
  h.message({ type: 'dryer-workspace:visibility', active: false });
  assert.equal(h.api.state().status, 'paused');
  h.api.restart();
  assert.equal(h.messages.at(-1).message.active, false, 'returning to ready releases the workspace lock');
});

test('fullscreen and page lifecycle keep the scene sized and dispose the show on final page close', async () => {
  const h = await harness();
  h.node('[data-action="fullscreen"]').click();
  await Promise.resolve();
  assert.equal(h.document.fullscreenElement, h.document.documentElement);
  h.documentEvent('fullscreenchange');
  assert.equal(h.node('[data-fullscreen-label]').textContent, '전체 화면 종료');
  assert.equal(h.api.state().status, 'playing', 'entering fullscreen starts a ready tour while transport controls are hidden');
  assert.deepEqual(h.calls.at(-1), ['scene.resize']);
  h.windowEvent('pagehide', { persisted: true });
  assert.equal(h.calls.some(([name]) => name === 'tour.dispose'), false);
  h.windowEvent('pageshow', {});
  assert.deepEqual(h.calls.at(-2), ['tour.setActive', true]);
  h.windowEvent('pagehide', { persisted: false });
  assert.deepEqual(h.calls.slice(-3).map(([name]) => name), ['tour.dispose', 'furnace.dispose', 'scene.dispose']);
});

test('fullscreen preserves a paused tour or open plan and leaving it restores its label without restarting', async () => {
  for (const inspecting of [false, true]) {
    const h = await harness();
    h.node('[data-action="play"]').click(); h.api.seek(2); h.api.advance(35);
    if (inspecting) h.node('[data-inspection-view="top"]').click();
    else h.node('[data-action="play"]').click();
    const count = h.calls.filter(([name]) => name === 'tour.play').length;
    h.node('[data-action="fullscreen"]').click(); await Promise.resolve();
    h.documentEvent('fullscreenchange');
    assert.equal(h.api.state().status, 'paused'); assert.equal(h.api.state().inspecting, inspecting);
    assert.equal(h.api.state().elapsed, 35);
    assert.equal(h.calls.filter(([name]) => name === 'tour.play').length, count);
    if (inspecting) {
      assert.equal(h.node('[data-location]').textContent, '3층');
      assert.equal(h.node('[data-view-label]').textContent, '평면 보기');
    }
    h.node('[data-action="fullscreen"]').click(); await Promise.resolve();
    h.documentEvent('fullscreenchange');
    assert.equal(h.document.fullscreenElement, null);
    assert.equal(h.node('[data-fullscreen-label]').textContent, '전체 화면');
    assert.equal(h.api.state().status, 'paused'); assert.equal(h.api.state().inspecting, inspecting);
    assert.deepEqual(h.calls.at(-1), ['scene.resize']);
  }
});

test('initialization failure shows recovery and leaves every navigation and playback action disabled', async () => {
  const h = await harness({ failScene: true });
  assert.equal(h.errors.length, 1);
  assert.equal(h.node('#presentation-error').hidden, false);
  assert.equal(h.node('#presentation-loading').hidden, true);
  assert.equal(h.node('[data-action="play"]').disabled, true);
  assert.equal(h.node('[data-playback-rate]').disabled, true);
  assert.ok(h.nodes('.route-stop').every((node) => node.disabled));
  h.node('[data-action="reload"]').click();
  assert.deepEqual(h.calls.at(-1), ['reload']);
});
