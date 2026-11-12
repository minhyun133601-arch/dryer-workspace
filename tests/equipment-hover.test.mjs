import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from '../apps/shared/vendor/three.module.js';

async function harness() {
  const source = (await readFile(new URL('../apps/site/scene.js', import.meta.url), 'utf8'))
    .replace(/^import .*;\r?\n/gm, '').replace('export function createFacilityScene', 'function createFacilityScene');
  const nodes = [];
  const document = { createElement() { const node = { hidden: false, style: {}, setAttribute() {}, remove() { this.removed = true; } }; nodes.push(node); return node; } };
  const context = vm.createContext({ THREE, document });
  new vm.Script(`${source}\nglobalThis.FacilityScene = FacilityScene;`).runInContext(context);
  const scene = Object.create(context.FacilityScene.prototype), world = new THREE.Scene();
  const objects = new Map(), parts = [];
  for (const [id, x] of [['a', -2], ['b', 3]]) {
    const root = new THREE.Group(), body = new THREE.Group(); root.position.x = x;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), new THREE.MeshBasicMaterial());
    body.add(mesh); root.add(body); world.add(root); objects.set(id, root); parts.push({ root, group: body });
  }
  let invalidations = 0;
  Object.assign(scene, { scene: world, canvas: { style: {}, dataset: {}, parentElement: { append() {} } }, objects, parts,
    geometries: new Set(), materials: new Set(), hovered: null, hoverOutline: null, hoverHint: null,
    lastHoverPick: 0, placementMode: false, dragPlacement: null, _invalidate() { invalidations++; },
  });
  return { scene, nodes, invalidations: () => invalidations, dispose() {
    world.traverse((object) => { object.geometry?.dispose(); object.material?.dispose(); });
  } };
}

test('equipment hover shows one reusable outline and click hint, then clears without enabling names', async () => {
  const { scene, nodes, invalidations, dispose } = await harness();
  try {
    scene.labelsEnabled = false;
    scene._setHover('a');
    assert.equal(scene.canvas.style.cursor, 'pointer');
    assert.equal(scene.hoverOutline.visible, true);
    assert.equal(scene.hoverHint.hidden, false);
    assert.equal(scene.hoverHint.textContent, '클릭하여 설비 선택');
    assert.ok(scene.hoverOutline.box.min.x < -3 && scene.hoverOutline.box.max.x > -1);
    const helper = scene.hoverOutline, count = invalidations();
    scene._setHover('a');
    assert.equal(invalidations(), count, 'remaining over the same equipment must not trigger another render');
    scene._setHover('b');
    assert.equal(scene.hoverOutline, helper, 'equipment changes reuse the same helper and GPU resources');
    assert.equal(nodes.length, 1);
    assert.ok(scene.hoverOutline.box.min.x > 1.9);
    assert.equal(scene.geometries.size, 1); assert.equal(scene.materials.size, 1);
    assert.equal(scene.labelsEnabled, false, 'hover must not reveal every equipment name');
    scene._clearHover();
    assert.equal(scene.hovered, null); assert.equal(helper.visible, false);
    assert.equal(scene.hoverHint.hidden, true); assert.equal(scene.canvas.style.cursor, '');
    scene.placementMode = true; scene._setHover('a');
    assert.equal(scene.canvas.style.cursor, 'grab');
    assert.equal(scene.hoverHint.textContent, '설비 본체를 끌어 이동');
    scene.dragPlacement = { id: 'a' }; scene._setHover('a');
    assert.equal(scene.canvas.style.cursor, 'grabbing', 'hover must preserve the placement drag affordance');
  } finally { dispose(); }
});

test('hover hit testing is throttled and cleared when pointer leaves or a touch gesture starts moving', async () => {
  const { scene, dispose } = await harness();
  try {
    const handlers = new Map(), captures = new Set(); let hits = 0;
    Object.assign(scene.canvas, { addEventListener: (type, listener) => handlers.set(type, listener), removeEventListener() {},
      setPointerCapture: (id) => captures.add(id), hasPointerCapture: (id) => captures.has(id), releasePointerCapture: (id) => captures.delete(id) });
    Object.assign(scene, { listeners: [], _hit() { hits++; return { userData: { equipment: 'a' } }; },
      _panBy() {}, view: 'top', _pick() {} });
    scene._controls();
    const mouse = { pointerId: 1, pointerType: 'mouse', clientX: 10, clientY: 10, timeStamp: 100 };
    handlers.get('pointermove')(mouse);
    handlers.get('pointermove')({ ...mouse, clientX: 12, timeStamp: 120 });
    assert.equal(hits, 1);
    handlers.get('pointermove')({ ...mouse, clientX: 14, timeStamp: 160 });
    assert.equal(hits, 2);
    handlers.get('pointerleave')();
    assert.equal(scene.hoverOutline.visible, false); assert.equal(scene.hoverHint.hidden, true);
    const touch = { pointerId: 2, pointerType: 'touch', button: 0, shiftKey: false, clientX: 20, clientY: 20, timeStamp: 200 };
    handlers.get('pointerdown')(touch);
    assert.equal(scene.hoverOutline.visible, true, 'a pressed touch target has the same visible feedback');
    handlers.get('pointermove')({ ...touch, clientX: 40, timeStamp: 240 });
    assert.equal(scene.hoverOutline.visible, false, 'moving the camera must clear the pressed target outline');
    assert.equal(hits, 3, 'camera dragging must not repeatedly raycast for hover');
    handlers.get('pointercancel')(touch);
    assert.equal(captures.size, 0); assert.equal(scene.hovered, null);
  } finally { dispose(); }
});
