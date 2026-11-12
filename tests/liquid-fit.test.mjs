import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from '../apps/shared/vendor/three.module.js';
import { createDetailCamera } from '../apps/site/detail-camera.js';
import { createLiquidModel } from '../apps/site/liquid-models.js';
import { createProximityDoorController } from '../apps/site/proximity-doors.js';
import { LIQUID_ROOM, LIQUID_ROOMS, LIQUID_EQUIPMENT } from '../apps/site/liquid-data.js';

// Only the renderer and DOM are substitutes: the model, camera controller,
// resize callback and dialog framing code all run unchanged.
async function harness(width, height) {
  let viewport = { left: 0, top: 0, width, height };
  let currentCamera, currentModel, resizeCallback, renders = 0;
  const errors = [], nodes = new Map(), groups = new Map(), dialogs = [];
  class Node {
    constructor() {
      this.dataset = {}; this.style = {}; this.children = []; this.checked = false;
      this.value = ''; this.listeners = new Map(); this.attributes = {};
      this.classList = { toggle() {}, add() {}, remove() {} };
    }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = [...children]; }
    setAttribute(name, value) { this.attributes[name] = value; }
    addEventListener(name, callback, options = {}) {
      if (!this.listeners.has(name)) this.listeners.set(name, new Set());
      this.listeners.get(name).add(callback);
      options.signal?.addEventListener('abort', () => this.listeners.get(name).delete(callback), { once: true });
    }
    dispatch(name, event = {}) {
      for (const callback of this.listeners.get(name) || []) {
        callback({ type: name, preventDefault() {}, target: this, ...event });
      }
    }
    click() { this.dispatch('click'); }
    focus() {}
    setPointerCapture() {}
    getBoundingClientRect() { return viewport; }
    showModal() { this.open = true; }
    close() { this.open = false; }
    remove() { this.removed = true; }
  }
  const node = (selector) => {
    if (!nodes.has(selector)) nodes.set(selector, new Node());
    return nodes.get(selector);
  };
  node('.ld-structure').checked = true;
  for (const [selector, values, key] of [
    ['[data-liquid-room]', ['all', ...LIQUID_ROOMS.map((r) => r.id)], 'liquidRoom'],
    ['[data-liquid-equipment]', LIQUID_EQUIPMENT.map((e) => e.id), 'liquidEquipment'],
    ['[data-liquid-view]', ['iso', 'top', 'front', 'side'], 'liquidView'],
  ]) groups.set(selector, values.map((value) => {
    const button = new Node(); button.dataset[key] = value; return button;
  }));
  class Renderer {
    setPixelRatio() {}
    setSize() {}
    render(_scene, camera) { currentCamera = camera; renders++; }
    dispose() {}
  }
  const context = vm.createContext({
    THREE: { ...THREE, WebGLRenderer: Renderer }, LIQUID_ROOM, LIQUID_ROOMS, LIQUID_EQUIPMENT,
    createDetailCamera, createProximityDoorController, devicePixelRatio: 1,
    createLiquidModel(options) { currentModel = createLiquidModel(options); return currentModel; },
    liquidAsset: () => '', console: { error: (...values) => errors.push(values) },
    ResizeObserver: class { constructor(callback) { resizeCallback = callback; } observe() {} disconnect() {} },
    document: {
      body: new Node(),
      createElement(tag) {
        const element = new Node();
        if (tag === 'dialog') {
          dialogs.push(element); element.querySelector = node;
          element.querySelectorAll = (selector) => groups.get(selector) || [];
        }
        return element;
      },
    },
  });
  const source = (await readFile(new URL('../apps/site/liquid-detail.js', import.meta.url), 'utf8'))
    .replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
  new vm.Script(`${source}\nglobalThis.create = createLiquidDetail;`).runInContext(context);
  const detail = context.create(); detail.open();
  assert.deepEqual(errors, [], 'the real model and controller must initialise');
  assert.ok(renders > 0);
  return {
    detail, node,
    get camera() { return currentCamera; },
    get model() { return currentModel; },
    room(id) { groups.get('[data-liquid-room]').find((b) => b.dataset.liquidRoom === id).click(); },
    view(name) { groups.get('[data-liquid-view]').find((b) => b.dataset.liquidView === name).click(); },
    resize(nextWidth, nextHeight) {
      viewport = { ...viewport, width: nextWidth, height: nextHeight }; resizeCallback();
    },
  };
}

function assertFramed(h, roomId, description, { includeEnvironment = false } = {}) {
  h.model.root.updateWorldMatrix(true, true); h.camera.updateMatrixWorld();
  const objects = LIQUID_EQUIPMENT.filter((item) => roomId === 'all' || item.roomId === roomId)
    .map((item) => [item.id, h.model.objects.get(item.id)]);
  if (includeEnvironment) {
    const object = roomId === 'all' ? h.model.environment.root : h.model.environment.roomFloors.get(roomId);
    if (object) objects.push([`${roomId}-floor`, object]);
  }
  let largest = 0;
  for (const [id, object] of objects) {
    assert.ok(object?.visible, `${description}: ${id} must be visible`);
    const box = new THREE.Box3().setFromObject(object);
    assert.ok(!box.isEmpty(), `${description}: ${id} needs real geometry`);
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      const projected = new THREE.Vector3(x, y, z).project(h.camera);
      assert.ok(projected.toArray().every(Number.isFinite), `${description}: non-finite projection of ${id}`);
      largest = Math.max(largest, Math.abs(projected.x), Math.abs(projected.y));
      assert.ok(Math.abs(projected.x) <= 1 + 1e-6 && Math.abs(projected.y) <= 1 + 1e-6 && projected.z >= -1 && projected.z <= 1,
        `${description}: ${id} clips at world [${x}, ${y}, ${z}], NDC ${projected.toArray()}`);
    }
  }
  return largest;
}

const rooms = ['all', ...LIQUID_ROOMS.map((room) => room.id)];

test('real liquid camera fits the whole hall and all eight rooms on desktop and mobile, including their floor bounds', async () => {
  for (const [width, height] of [[1200, 520], [390, 340], [350, 660]]) {
    const h = await harness(width, height);
    try {
      for (const roomId of rooms) {
        h.room(roomId);
        const largest = assertFramed(h, roomId, `${width}x${height} / ${roomId}`, { includeEnvironment: true });
        assert.ok(largest <= .95, `${width}x${height} / ${roomId}: overview should leave a visible framing margin`);
      }
    } finally { h.detail.dispose(); }
  }
});

test('real liquid camera view buttons keep each room equipment inside the frustum', async () => {
  for (const [width, height] of [[1200, 520], [390, 340], [350, 660]]) {
    const h = await harness(width, height);
    try {
      for (const roomId of rooms) {
        h.room(roomId);
        for (const view of ['top', 'front', 'side']) {
          h.view(view); assertFramed(h, roomId, `${width}x${height} / ${roomId} / ${view}`);
        }
      }
    } finally { h.detail.dispose(); }
  }
});

test('real ResizeObserver framing fits each room after desktop/mobile aspect changes', async () => {
  const h = await harness(1200, 520);
  try {
    for (const roomId of rooms) {
      h.room(roomId);
      for (const [width, height] of [[390, 340], [350, 660], [1200, 520]]) {
        h.resize(width, height);
        assertFramed(h, roomId, `resize ${width}x${height} / ${roomId}`, { includeEnvironment: true });
      }
    }
  } finally { h.detail.dispose(); }
});
