import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import * as THREE from '../apps/shared/vendor/three.module.js';
import { CHILLER_INFO, CHILLER_PARTS, CHILLER_BOM, CHILLER_SHEETS, CHILLER_ASSETS } from '../apps/site/chiller-data.js';
import { createChillerModel } from '../apps/site/chiller-model.js';

const source = async (name) => (await readFile(new URL(`../apps/site/${name}`, import.meta.url), 'utf8'))
  .replace(/^import .*;\r?\n/gm, '').replace(/^export\s+(?=(?:function|class|const|let)\b)/gm, '');
function clock() {
  let now = 1000, next = 0;
  const timers = new Map();
  return { get now() { return now; },
    setTimeout(callback, ms = 0) { const id = ++next; timers.set(id, { callback, due: now + ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
    advance(ms) {
      const end = now + ms;
      for (;;) {
        const ready = [...timers].filter(([, timer]) => timer.due <= end).sort((a, b) => a[1].due - b[1].due)[0];
        if (!ready) break;
        now = ready[1].due; timers.delete(ready[0]); ready[1].callback();
      }
      now = end;
    },
  };
}

test('the chiller retains all 23 drawing BOM rows, 13 distinct assemblies, two compressors and their separate photo identities', () => {
  assert.equal(CHILLER_PARTS.length, 13); assert.equal(new Set(CHILLER_PARTS.map((p) => p.id)).size, 13);
  assert.deepEqual(CHILLER_BOM.map((row) => row[0]), Array.from({ length: 23 }, (_, i) => String(i + 1).padStart(2, '0')));
  assert.deepEqual(CHILLER_BOM.map((row) => row[3]), [2, 1, 1, 2, 1, 8, 8, 10, 3, 2, 4, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1]);
  const ids = new Set(CHILLER_PARTS.map((p) => p.id));
  for (const [number, en, ko, quantity, spec, id] of CHILLER_BOM) {
    assert.ok(en && ko && spec && Number.isInteger(quantity) && quantity > 0, number); assert.ok(ids.has(id), number);
  }
  for (const part of CHILLER_PARTS) {
    assert.ok(part.name && part.drawing && part.text && part.photos.length, part.id);
    assert.ok(part.photos.every((n) => Number.isInteger(n) && n >= 1 && n <= 67), part.id);
  }
  assert.match(CHILLER_INFO.dimensions, /4,140.*1,900.*2,200/);
  assert.match(CHILLER_PARTS.find((p) => p.id === 'compressor-1').text, /판독하지 못/);
  assert.match(CHILLER_PARTS.find((p) => p.id === 'compressor-2').text, /50ASC-H.*37 kW.*2025/);
  assert.match(CHILLER_SHEETS.find((s) => s.page === 12).text, /48\.08RT.*치환하지/);
  const model = createChillerModel();
  try {
    assert.ok(model.records instanceof Map, 'the dialog consumes the actual keyed model API');
    assert.deepEqual([...model.records.keys()], [...ids]);
    model.setExplode(1);
    for (const id of ids) assert.ok(model.anchorOf(id).toArray().every(Number.isFinite), id);
  } finally { model.dispose(); }
});

test('22 drawing sheets and manufacturer extracts remain local while field photos are excluded from the runtime registry', async () => {
  assert.equal(Object.keys(CHILLER_ASSETS).length, 24);
  assert.ok(Object.keys(CHILLER_ASSETS).every(key => !key.startsWith('photo')));
  assert.deepEqual(CHILLER_SHEETS.map((sheet) => sheet.page).sort((a, b) => a - b), Array.from({ length: 22 }, (_, i) => i + 1), 'every source PDF page remains reachable');
  const root = await realpath(fileURLToPath(new URL('../apps/site/', import.meta.url)));
  await Promise.all(Object.entries(CHILLER_ASSETS).map(async ([key, asset]) => {
    assert.match(asset, /^\.\/assets\/drawings\/chiller\//, key);
    const resolved = await realpath(path.resolve(root, asset)), relative = path.relative(root, resolved);
    assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
    assert.ok((await stat(resolved)).size > 1000, key);
  }));
  for (const sheet of CHILLER_SHEETS) assert.ok(CHILLER_ASSETS[`sheet${String(sheet.page).padStart(3, '0')}`], sheet.name);
  const context = vm.createContext({ location: { pathname: '/apps/site/index.html' } });
  new vm.Script(`${await source('chiller-data.js')}\nglobalThis.assets = CHILLER_ASSETS; globalThis.asset = chillerAsset;`).runInContext(context);
  assert.equal(context.asset('sheet014'), CHILLER_ASSETS.sheet014);
  assert.equal(context.asset('photo001'), undefined);
  context.location.pathname = '/apps/site/share/index.html';
  assert.equal(context.asset('sheet022'), `.${CHILLER_ASSETS.sheet022}`);
  context.assets.sheet014 = 'data:image/jpeg;base64,/9j/';
  assert.equal(context.asset('sheet014'), 'data:image/jpeg;base64,/9j/', 'embedded offline drawings cannot acquire a relative prefix');
  assert.equal(context.asset('unknown'), undefined);
});

async function cameraHarness() {
  const time = clock(), handlers = new Map(), selected = [];
  const rect = { left: 31, top: 47, width: 1000, height: 680 };
  const canvas = { getBoundingClientRect: () => rect, focus() {}, setPointerCapture() {},
    addEventListener(name, callback, options) {
      handlers.set(name, callback); options?.signal?.addEventListener('abort', () => handlers.delete(name), { once: true });
    },
  };
  const root = new THREE.Group(), body = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 2), new THREE.MeshBasicMaterial());
  body.position.y = 1; root.add(body); root.updateMatrixWorld(true);
  const camera = new THREE.PerspectiveCamera(40, rect.width / rect.height, .02, 300);
  const context = vm.createContext({ THREE, AbortController, performance: { now: () => time.now }, setTimeout: time.setTimeout, clearTimeout: time.clearTimeout });
  new vm.Script(`${await source('detail-camera.js')}\nglobalThis.create = createDetailCamera;`).runInContext(context);
  const controls = context.create(canvas, camera, { objects: () => [root], draw: () => root.updateMatrixWorld(true), select: (hit) => selected.push(hit) });
  controls.reset();
  const eventFor = (point) => { const p = point.clone().project(camera); return { clientX: rect.left + (p.x + 1) * rect.width / 2, clientY: rect.top + (1 - p.y) * rect.height / 2 }; };
  return { controls, camera, root, body, time, handlers, selected, eventFor,
    dispatch(type, event = {}) { handlers.get(type)?.({ type, pointerId: 1, pointerType: 'mouse', button: 0, shiftKey: false, clientX: 500, clientY: 300, preventDefault() {}, ...event }); },
    dispose() { controls.dispose(); body.geometry.dispose(); body.material.dispose(); },
  };
}
const projected = (point, camera) => { const p = point.clone().project(camera); return new THREE.Vector2(p.x, p.y); };

test('detail wheel zoom preserves the actual off-centre surface anchor, supports fine inspection and retains finite clipping', async () => {
  const h = await cameraHarness();
  try {
    const point = new THREE.Vector3(.7, 1.3, 1), event = h.eventFor(point), start = projected(point, h.camera);
    for (let i = 0; i < 5; i++) h.dispatch('wheel', { ...event, deltaY: -70 });
    assert.ok(projected(point, h.camera).distanceTo(start) < 1e-6);
    const centre = new THREE.Vector3(0, 1, 0); h.controls.focus(centre, 8);
    h.controls.zoom(1e-9); assert.ok(Math.abs(h.camera.position.distanceTo(centre) - .12) < 1e-8);
    assert.ok(h.camera.near > 0 && h.camera.near < .02);
    h.controls.zoom(1e9); assert.ok(Math.abs(h.camera.position.distanceTo(centre) - 180) < 1e-8);
    assert.ok(h.camera.far > h.camera.position.distanceTo(centre) + 5);
  } finally { h.dispose(); }
});

test('detail middle drag pans in the camera screen plane without orbiting and R restores the exploded or assembled overview', async () => {
  const h = await cameraHarness();
  try {
    const position = h.camera.position.clone(), orientation = h.camera.quaternion.clone();
    h.dispatch('pointerdown', { button: 1 });
    h.dispatch('pointermove', { button: 1, clientX: 610, clientY: 390 });
    h.dispatch('pointerup', { button: 1, clientX: 610, clientY: 390 });
    assert.ok(h.camera.position.distanceTo(position) > .5 && Math.abs(h.camera.position.y - position.y) > .1);
    assert.ok(h.camera.quaternion.angleTo(orientation) < 1e-7);
    h.controls.reset(true); assert.ok(h.camera.position.distanceTo(position) > 2);
    h.dispatch('keydown', { key: 'r' }); assert.ok(h.camera.position.distanceTo(position) < 1e-8);
    assert.deepEqual(h.selected, []);
  } finally { h.dispose(); }
});

test('detail double touch tap zooms once despite the browser synthetic dblclick, and dragging cancels a pending pick', async () => {
  const h = await cameraHarness();
  try {
    const event = { ...h.eventFor(new THREE.Vector3(.7, 1.3, 1)), pointerType: 'touch' }, before = h.camera.position.clone();
    h.dispatch('pointerdown', event); h.dispatch('pointerup', event); h.time.advance(300);
    h.dispatch('pointerdown', event); h.dispatch('pointerup', event);
    const after = h.camera.position.clone(); assert.ok(after.distanceTo(before) > 1);
    h.dispatch('dblclick', event); assert.ok(h.camera.position.distanceTo(after) < 1e-8, 'native dblclick after double tap cannot zoom twice');
    h.time.advance(800); assert.deepEqual(h.selected, []);
    h.controls.reset(); const mouse = h.eventFor(new THREE.Vector3(.7, 1.3, 1));
    h.dispatch('pointerdown', mouse); h.dispatch('pointerup', mouse); h.time.advance(300);
    h.dispatch('pointerdown', mouse); h.time.advance(200);
    assert.deepEqual(h.selected, [], 'a new press cancels the preceding single-pick timer before it fires');
    h.dispatch('pointermove', { ...mouse, clientX: mouse.clientX + 30 }); h.dispatch('pointerup', mouse); h.time.advance(500);
    assert.deepEqual(h.selected, []);
  } finally { h.dispose(); }
});

test('two-finger detail gestures pan and pinch around their midpoint, then a normal tap remains selectable and disposal cancels timers', async () => {
  const h = await cameraHarness();
  try {
    const point = new THREE.Vector3(.7, 1.3, 1), midpoint = h.eventFor(point), initial = projected(point, h.camera);
    const a = { ...midpoint, clientX: midpoint.clientX - 30, pointerType: 'touch', pointerId: 1 };
    const b = { ...midpoint, clientX: midpoint.clientX + 30, pointerType: 'touch', pointerId: 2 };
    h.dispatch('pointerdown', a); h.dispatch('pointerdown', b);
    h.dispatch('pointermove', { ...a, clientX: a.clientX - 20 }); h.dispatch('pointermove', { ...b, clientX: b.clientX + 20 });
    const drift = projected(point, h.camera).sub(initial);
    assert.ok(Math.hypot(drift.x * 500, drift.y * 340) < 1, 'symmetric pinch retains its surface anchor within one rendered pixel');
    const prior = h.camera.position.clone();
    h.dispatch('pointermove', { ...a, clientX: a.clientX + 20, clientY: a.clientY + 30 });
    h.dispatch('pointermove', { ...b, clientX: b.clientX + 60, clientY: b.clientY + 30 });
    assert.ok(h.camera.position.distanceTo(prior) > .1);
    h.dispatch('pointerup', a); h.dispatch('pointerup', b); h.time.advance(500); assert.deepEqual(h.selected, []);
    h.controls.reset(); const event = h.eventFor(point);
    h.dispatch('pointerdown', event); h.dispatch('pointerup', event); h.time.advance(431);
    assert.equal(h.selected.length, 1); assert.equal(h.selected[0].object, h.body);
    h.dispatch('pointerdown', event); h.dispatch('pointerup', event); h.controls.dispose(); h.time.advance(500);
    assert.equal(h.selected.length, 1); assert.equal(h.handlers.size, 0);
  } finally { h.dispose(); }
});

async function dialogHarness({ failRenderer = false } = {}) {
  class Node {
    constructor() { this.style = {}; this.dataset = {}; this.attributes = {}; this.children = []; this.listeners = new Map(); this.checked = false; this.classList = { toggle() {}, add() {}, remove() {} }; }
    append(...nodes) { this.children.push(...nodes); }
    setAttribute(k, v) { this.attributes[k] = v; }
    addEventListener(k, fn) { this.listeners.set(k, fn); }
    click() { this.listeners.get('click')?.({ target: this }); }
    getBoundingClientRect() { return { width: 900, height: 600 }; }
    scrollTo() {}
    showModal() { this.open = true; }
    close() { this.open = false; }
    remove() { this.removed = true; }
  }
  const nodes = new Map(), groups = new Map(), errors = [], body = new Node();
  const node = (key) => { if (!nodes.has(key)) nodes.set(key, new Node()); return nodes.get(key); };
  for (const [selector, values, property] of [
    ['[data-cd-tab]', ['model', 'drawing', 'photo'], 'cdTab'], ['[data-cd-view]', ['iso', 'front', 'top', 'side'], 'cdView'],
    ['[data-cd-assembly]', ['0', '100'], 'cdAssembly'], ['[data-cd-image-zoom]', ['-1', '0', '1'], 'cdImageZoom'],
    ['[data-cd-part]', CHILLER_PARTS.map((p) => p.id), 'cdPart'], ['[data-cd-bom]', CHILLER_BOM.map((p) => p[5]), 'cdBom'],
  ]) groups.set(selector, values.map((value) => { const n = new Node(); n.dataset[property] = value; return n; }));
  let dialog, liveModel, cameraOptions, renders = 0;
  class Renderer { constructor() { if (failRenderer) throw new Error('WebGL unavailable'); } setPixelRatio() {} setSize() {} render() { renders++; } dispose() {} }
  const context = vm.createContext({ THREE: { ...THREE, WebGLRenderer: Renderer }, CHILLER_INFO, CHILLER_PARTS, CHILLER_BOM, CHILLER_SHEETS,
    chillerAsset: (key) => CHILLER_ASSETS[key], devicePixelRatio: 1,
    document: { body, createElement(tag) { const n = new Node(); if (tag === 'dialog') { dialog = n; n.querySelector = node; n.querySelectorAll = (s) => groups.get(s) || []; } return n; } },
    ResizeObserver: class { observe() {} disconnect() {} }, console: { error: (...args) => errors.push(args) },
    createChillerModel(options) { liveModel = createChillerModel(options); return liveModel; },
    createDetailCamera(canvas, camera, options) {
      cameraOptions = options;
      const update = () => { camera.position.set(7, 4, 7); camera.lookAt(0, 1.2, 0); camera.updateMatrixWorld(); options.draw(); };
      return { update, reset: update, focus: update, view: update, dispose() {} };
    },
  });
  new vm.Script(`${await source('chiller-detail.js')}\nglobalThis.create = createChillerDetail;`).runInContext(context);
  const detail = context.create();
  return { detail, node, groups, errors, get dialog() { return dialog; }, get model() { return liveModel; }, get cameraOptions() { return cameraOptions; }, get renders() { return renders; } };
}

test('the dialog renders the actual Map-based model and selects matching drawings without exposing retired photos', async () => {
  const h = await dialogHarness();
  try {
    assert.doesNotThrow(() => h.detail.open()); assert.deepEqual(h.errors, []); assert.ok(h.renders > 0);
    assert.equal(h.dialog.attributes['aria-labelledby'], 'chiller-title'); assert.match(h.dialog.innerHTML, /canvas tabindex="0" aria-label=/);
    assert.equal(h.node('.cd-labels').children.length, 13);
    const receiver = h.model.records.get('receiver'); h.cameraOptions.select({ object: receiver.meshes[0] });
    assert.equal(h.node('.cd-part-detail h3').textContent, CHILLER_PARTS.find((p) => p.id === 'receiver').name);
    h.node('.cd-show-sheet').click(); assert.equal(h.node('.cd-main-image').src, CHILLER_ASSETS.sheet002);
    const retiredButton = h.dialog.innerHTML.match(/<button[^>]*class="cd-show-photo"[^>]*>/)?.[0];
    assert.match(retiredButton, /\bhidden\b/);
    assert.match(retiredButton, /\bdisabled\b/);
    assert.doesNotMatch(h.dialog.innerHTML, /data-cd-tab="photo"/, 'the retired field-photo tab is absent from the actual dialog');
    h.node('.cd-show-photo').click(); assert.equal(h.node('.cd-main-image').src, CHILLER_ASSETS.sheet002, 'a legacy photo action falls back to the selected part drawing');
    const nextSheet = CHILLER_SHEETS[(CHILLER_SHEETS.findIndex(sheet => sheet.page === 2) + 1) % CHILLER_SHEETS.length];
    h.node('.cd-next').click(); assert.equal(h.node('.cd-main-image').src, CHILLER_ASSETS[`sheet${String(nextSheet.page).padStart(3, '0')}`]);
    h.groups.get('[data-cd-tab]').find((b) => b.dataset.cdTab === 'model').click();
    h.node('#chiller-isolate').checked = true; h.node('#chiller-isolate').listeners.get('change')();
    assert.deepEqual([...h.model.records.values()].filter((r) => r.group.visible).map((r) => r.id), ['receiver']);
    h.node('.cd-close').click(); assert.equal(h.dialog.open, false);
  } finally { h.detail.dispose(); assert.equal(h.dialog.removed, true); }
});

test('WebGL failure leaves retained drawings usable without requesting retired photographs or throwing during partial init', async () => {
  const h = await dialogHarness({ failRenderer: true });
  try {
    assert.doesNotThrow(() => h.detail.open()); assert.equal(h.errors.length, 1);
    assert.equal(h.node('.cd-fallback').hidden, false);
    h.node('.cd-show-photo').click(); assert.equal(h.node('.cd-main-image').src, CHILLER_ASSETS.sheet014);
    h.node('.cd-show-sheet').click(); assert.equal(h.node('.cd-main-image').src, CHILLER_ASSETS.sheet014);
    h.detail.close(); assert.doesNotThrow(() => h.detail.open()); assert.equal(h.dialog.open, true);
  } finally { h.detail.dispose(); }
});
