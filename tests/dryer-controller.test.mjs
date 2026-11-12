import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const equipment = [
  { id: 'heater', name: '건조실 버너', floor: 6, visibleFloors: [6, 7], position: [3.4, 26.2, -3.5] },
  { id: 'dryer-roof-drive', name: '옥상 구동부', floor: 8, position: [0, 32.6, 0] },
  { id: 'upper-duct', name: '7층 덕트', floor: 7, position: [0, 32.6, 2] },
  { id: 'f1-tank', name: '1층 탱크', floor: 1, position: [0, 0, 0] },
  { id: 'f1-boiler-room', name: '인접 보일러실', floor: 1, position: [0, 0, 0] },
  { id: 'outside-building', name: '다른 건물', floor: 'campus', position: [0, 0, 0] },
];
const floors = Array.from({ length: 8 }, (_, index) => ({ id: index + 1, displayLevel: index === 1 ? 1.5 : index + 1 }));
const documents = [{ id: 'replacement', title: '연소팬 교체', slides: [{ image: 'data:image/jpeg;base64,/9j/', caption: '교체 작업' }] }];

async function harness(url = 'https://example.invalid/index.html', { framed = false, injectView } = {}) {
  let source = await readFile(new URL('../apps/site/share/dryer-app.js', import.meta.url), 'utf8');
  source = source.replace(/^import .*;\r?\n/gm, '')
    .replace("  const { createFacilityScene } = await import('../scene.js');", '');
  const nodes = new Map(), windowEvents = new Map(), documentEvents = new Map();
  const calls = [], downloads = [], blobs = new Map(), timers = new Map(), errors = [];
  let timerId = 0, sceneOptions, receivedDocuments;
  const node = (id, tag = 'button') => {
    if (!nodes.has(id)) {
      const element = { id, tagName: tag.toUpperCase(), dataset: {}, attributes: {}, listeners: new Map(), children: [], hidden: false, checked: false,
        textContent: '', value: '', disabled: false,
        addEventListener(type, callback) { this.listeners.set(type, callback); },
        setAttribute(name, value) { this.attributes[name] = value; },
        getAttribute(name) { return this.attributes[name]; },
        append(...children) { this.children.push(...children); },
        matches() { return false; }, focus() {},
        click() {
          if (this.tagName === 'A') downloads.push({ href: this.href, download: this.download });
          return this.listeners.get('click')?.({ target: this });
        },
      };
      nodes.set(id, element);
    }
    return nodes.get(id);
  };
  const views = ['perspective', 'top', 'aisle', ...(injectView ? [injectView] : [])].map(view => {
    const element = node(`view-${view}`); element.dataset.view = view; return element;
  });
  node('structure-toggle').checked = node('ducts-toggle').checked = true;
  const listen = (events, type, callback) => {
    if (!events.has(type)) events.set(type, []);
    events.get(type).push(callback);
  };
  const fire = (events, type, event = {}) => { for (const callback of events.get(type) || []) callback(event); };
  const document = {
    hidden: false, fullscreenElement: null,
    documentElement: { dataset: {}, outerHTML: '<html data-profile="dryer"><body>pristine export</body></html>', requestFullscreen: async () => calls.push(['fullscreen']) },
    getElementById: node,
    createElement(tag) { return node(`created-${nodes.size}`, tag); },
    querySelector() { return null; },
    querySelectorAll(selector) {
      if (selector === '.view-selector button[data-view]') return views;
      if (selector === '[data-floor]') return node('floor-selector').children;
      if (selector === 'button,input') return [...nodes.values()];
      return [];
    },
    addEventListener(type, callback) { listen(documentEvents, type, callback); },
  };
  const location = new URL(url);
  location.reload = () => calls.push(['reload']);
  const window = { addEventListener(type, callback) { listen(windowEvents, type, callback); } };
  window.parent = framed ? { location: new URL('https://example.invalid/'), postMessage(message) { calls.push(['ready', message]); } } : window;
  const history = { replaceState(state, title, next) { location.href = String(next); } };
  class DownloadURL extends URL {
    static createObjectURL(blob) { const value = `blob:dryer-${blobs.size}`; blobs.set(value, blob); return value; }
    static revokeObjectURL(value) { calls.push(['revoke', value]); }
  }
  const scene = Object.fromEntries(['select', 'setIsolation', 'setExplosion', 'setLabels', 'setStructure', 'setPartitions', 'setDucts', 'setFloor', 'setActive', 'focus', 'resetView', 'zoomBy', 'resize', 'dispose']
    .map(method => [method, (...args) => calls.push([method, ...args])]));
  scene.setView = view => { calls.push(['setView', view]); sceneOptions.onViewChange(view); };
  scene.snapshot = () => 'data:image/png;base64,snapshot';
  const context = vm.createContext({
    document, window, location, history, URL: DownloadURL, URLSearchParams, Blob,
    EQUIPMENT: equipment, FLOORS: floors, BURNER_MAINTENANCE_DOCUMENTS: documents,
    createFurnaceDetail(options) {
      receivedDocuments = options.documents;
      return { open() { calls.push(['furnace-open']); }, dispose() { calls.push(['furnace-dispose']); } };
    },
    createFacilityScene(canvas, options) { sceneOptions = options; return scene; },
    createLayoutEditor() {
      return { select(id) { calls.push(['editor-select', id]); }, startMoving(id) { calls.push(['move', id]); },
        handleTransform(value) { calls.push(['transform', value]); }, dispose() { calls.push(['editor-dispose']); } };
    },
    console: { error(...args) { errors.push(args); } },
    setTimeout(callback, delay) { const id = ++timerId; timers.set(id, { callback, delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
  });
  const ui = await new vm.Script(`(async () => {\n${source}\nreturn { select, setFloor, state: () => ({ floor, selectedId }) };\n})()`).runInContext(context);
  return { ui, scene, node, views, document, window, location, calls, downloads, blobs, timers, errors,
    get options() { return sceneOptions; }, get receivedDocuments() { return receivedDocuments; },
    fireWindow: (type, event) => fire(windowEvents, type, event),
    fireDocument: (type, event) => fire(documentEvents, type, event),
  };
}

test('dryer presentation starts with the whole building, puts roof next and supplies only permitted equipment to its restricted scene', async () => {
  const h = await harness();
  assert.deepEqual(h.errors, []);
  assert.equal(h.ui.state().floor, 'all');
  assert.equal(h.options.floor, 'all');
  assert.deepEqual(Array.from(h.options.enabledAreas), ['dryer']);
  assert.equal(h.options.personEnabled, false);
  assert.deepEqual(Array.from(h.options.equipment, item => item.id), ['heater', 'dryer-roof-drive', 'upper-duct', 'f1-tank']);
  assert.deepEqual(h.node('floor-selector').children.slice(0, 2).map(button => button.dataset.floor), ['all', '8']);
  assert.equal(h.node('site-canvas').dataset.ready, 'true');
  assert.equal(h.node('scene-loading').hidden, true);
  assert.match(h.node('area-summary').textContent, /건조실 전체·옥상/);
});

test('roof links and buttons work while unrelated floors, equipment and scene floor callbacks normalize to the building', async () => {
  const roof = await harness('https://example.invalid/?floor=roof');
  assert.equal(roof.options.floor, 8);
  roof.node('floor-selector').children[0].click();
  assert.equal(roof.ui.state().floor, 'all');
  roof.node('floor-selector').children[1].click();
  assert.equal(roof.ui.state().floor, 8);
  for (const outside of ['campus', 'outdoor', 'packaging', 'liquid', 'unknown']) {
    const h = await harness(`https://example.invalid/?floor=${outside}&equipment=outside-building&level=2`);
    assert.equal(h.options.floor, 'all', outside);
    assert.equal(h.ui.state().selectedId, null);
    assert.equal(h.location.searchParams.get('floor'), 'all');
    assert.equal(h.location.searchParams.has('equipment'), false);
    assert.equal(h.location.searchParams.has('level'), false);
    h.options.onFloorChange(outside);
    assert.equal(h.ui.state().floor, 'all');
  }
  const boiler = await harness('https://example.invalid/?equipment=f1-boiler-room');
  assert.equal(boiler.ui.state().selectedId, null);
});

test('legacy floor 2 links and 1.5 aliases share the mezzanine button, scene key and readable snapshot name', async () => {
  for (const requested of ['2', '1.5']) {
    const h = await harness(`https://example.invalid/?floor=${requested}`);
    assert.equal(h.options.floor, 2, 'scene ownership remains the legacy integer key');
    assert.equal(h.location.searchParams.get('floor'), '2', 'shared links retain the canonical saved-layout key');
    const button = h.node('floor-selector').children.find(button => button.dataset.floor === '2');
    assert.equal(button.textContent, '1.5층');
    assert.equal(button.getAttribute('aria-pressed'), 'true');
    assert.match(h.node('area-summary').textContent, /건조실 1\.5층/);
    h.ui.setFloor(3); button.click();
    assert.equal(h.ui.state().floor, 2);
    h.ui.setFloor(1.5);
    assert.equal(h.ui.state().floor, 2);
    h.node('snapshot-button').click();
    assert.equal(h.downloads.at(-1).download, '희창유업-건조실-1.5층.png');
  }
});

test('the actual burner selection and its deep link open the existing detail with its maintenance documents', async () => {
  const h = await harness();
  assert.equal(h.receivedDocuments, documents);
  h.ui.select('heater');
  assert.equal(h.ui.state().floor, 'all', 'selecting the visible burner keeps the whole-building view');
  assert.equal(h.node('furnace-open').hidden, false);
  assert.equal(h.node('furnace-open').disabled, false);
  assert.equal(h.calls.filter(([method]) => method === 'furnace-open').length, 1);
  h.node('furnace-open').click();
  assert.equal(h.calls.filter(([method]) => method === 'furnace-open').length, 2);
  h.ui.select('outside-building');
  assert.equal(h.node('selection').hidden, true);
  assert.equal(h.node('furnace-open').hidden, false, 'the detail action remains available in the whole-building view');
  const linked = await harness('https://example.invalid/?equipment=heater');
  assert.equal(linked.options.floor, 6);
  assert.equal(linked.ui.state().selectedId, 'heater');
  assert.equal(linked.calls.filter(([method]) => method === 'furnace-open').length, 1);
});

test('the burner drawing action stays available on every dryer floor before selection and after selecting another machine', async () => {
  const h = await harness('https://example.invalid/?floor=7');
  assert.equal(h.ui.state().selectedId, null);
  assert.equal(h.node('furnace-open').hidden, false);
  assert.equal(h.node('furnace-open').disabled, false);
  h.node('furnace-open').click();
  assert.equal(h.calls.filter(([method]) => method === 'furnace-open').length, 1);
  h.ui.select('upper-duct');
  assert.equal(h.ui.state().floor, 7);
  assert.equal(h.ui.state().selectedId, 'upper-duct');
  assert.equal(h.node('furnace-open').hidden, false);
  assert.equal(h.node('furnace-open').disabled, false);
  h.node('furnace-open').click();
  assert.equal(h.calls.filter(([method]) => method === 'furnace-open').length, 2);
  h.ui.setFloor(8);
  assert.equal(h.node('furnace-open').hidden, false);
  assert.equal(h.node('furnace-open').disabled, false);
  for (const level of [1, 3]) {
    h.ui.setFloor(level);
    assert.equal(h.ui.state().floor, level);
    assert.equal(h.ui.state().selectedId, null);
    assert.equal(h.node('furnace-open').hidden, false, `${level}F exposes the drawing action before selection`);
    assert.equal(h.node('furnace-open').disabled, false);
    h.node('furnace-open').click();
  }
  assert.equal(h.calls.filter(([method]) => method === 'furnace-open').length, 4);
});

test('the presentation has no walking controls and its controller rejects an injected walking view action', async () => {
  const template = await readFile(new URL('../apps/site/share/dryer-index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(template, /data-view=["']person|data-person|id=["']person-/);
  assert.doesNotMatch(template, /data-area=["'](?:campus|outdoor|packaging|liquid)/);
  const h = await harness('https://example.invalid/?view=person', { injectView: 'person' });
  h.views.find(button => button.dataset.view === 'person').click();
  assert.equal(h.calls.some(([method, value]) => method === 'setView' && value === 'person'), false);
  h.views.find(button => button.dataset.view === 'top').click();
  assert.ok(h.calls.some(([method, value]) => method === 'setView' && value === 'top'));
});

test('frame visibility, page lifecycle and offline document saving remain available in the dryer-only viewer', async () => {
  const h = await harness('https://example.invalid/index.html', { framed: true });
  assert.ok(h.calls.some(([method, value]) => method === 'setActive' && value === false));
  h.fireWindow('message', { source: {}, data: { type: 'dryer-workspace:visibility', active: true } });
  assert.equal(h.calls.at(-1)[0], 'ready', 'messages from unrelated windows do not resume the scene');
  h.fireWindow('message', { source: h.window.parent, data: { type: 'dryer-workspace:visibility', active: true } });
  assert.deepEqual(h.calls.at(-1), ['setActive', true]);
  h.document.hidden = true;
  h.fireDocument('visibilitychange');
  assert.deepEqual(h.calls.at(-1), ['setActive', false]);
  h.document.hidden = false;
  h.fireWindow('pagehide', { persisted: true });
  assert.deepEqual(h.calls.at(-1), ['setActive', false]);
  h.fireWindow('pageshow');
  assert.deepEqual(h.calls.at(-1), ['setActive', true]);
  h.node('share-button').click();
  const saved = h.downloads.at(-1);
  assert.equal(saved.download, '희창유업-건조실-3D.html');
  assert.equal(await h.blobs.get(saved.href).text(), '<!doctype html>\n<html data-profile="dryer"><body>pristine export</body></html>');
  h.node('snapshot-button').click();
  assert.deepEqual(h.downloads.at(-1), { href: 'data:image/png;base64,snapshot', download: '희창유업-건조실-전체.png' });
  h.fireWindow('pagehide', { persisted: false });
  for (const method of ['furnace-dispose', 'editor-dispose', 'dispose']) assert.ok(h.calls.some(([name]) => name === method));
});
