import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from '../apps/shared/vendor/three.module.js';

function element() {
  return {
    hidden: false, style: {}, offsetWidth: 120, offsetHeight: 32,
    attributes: {},
    classList: { toggle() {} },
    setAttribute(name, value) { this.attributes[name] = value; },
  };
}

async function labelHarness() {
  const source = (await readFile(new URL('../apps/site/scene.js', import.meta.url), 'utf8'))
    .replace(/^import .*;\r?\n/gm, '').replace('export function createFacilityScene', 'function createFacilityScene');
  const context = vm.createContext({ THREE });
  new vm.Script(`${source}\nglobalThis.FacilityScene = FacilityScene;`).runInContext(context);
  const scene = Object.create(context.FacilityScene.prototype);
  const camera = new THREE.OrthographicCamera(-10, 10, 10, -10, .1, 100);
  camera.position.set(0, 0, 20); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const items = [
    { id: 'a', floor: 'outdoor', type: 'unit', position: [-2, 0, 0] },
    { id: 'b', floor: 'outdoor', type: 'unit', position: [2, 0, 0] },
    { id: 'other-floor', floor: 7, type: 'unit', position: [0, 0, 0] },
  ];
  const labels = items.map((item) => ({
    id: item.id, floor: item.floor, anchor: new THREE.Vector3(item.position[0], 2, 0),
    element: element(), line: element(), dot: element(),
  }));
  const partGroup = new THREE.Group();
  const partMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)); partGroup.add(partMesh);
  partGroup.updateMatrixWorld(true);
  Object.assign(scene, {
    equipment: items, objects: new Map(items.map((item) => [item.id, new THREE.Group()])),
    selected: null, labelsEnabled: false, activeFloor: 'outdoor', isolated: false,
    explosion: 0, amount: 0, width: 800, height: 600,
    labelLayer: { style: {} }, leaderLayer: { style: {} }, labels,
    floorLabels: [{ element: element(), anchor: new THREE.Vector3(0, 0, 0) }],
    parts: [{ root: { userData: { equipment: 'a' } }, group: partGroup, label: element() }],
    selectionRing: { visible: false, position: new THREE.Vector3(), scale: new THREE.Vector3() },
    _currentCamera: () => camera, _visibility() {}, _moveParts() {}, _invalidate() {}, _placementGuide() {},
  });
  const visible = () => scene.labelLayer.style.display === 'none' ? [] : labels.filter((label) => !label.element.hidden).map((label) => label.id);
  return { scene, visible, dispose: () => { partMesh.geometry.dispose(); partMesh.material.dispose(); } };
}

test('equipment clicks show only the current name with global labels off, then clear it on deselection', async () => {
  const { scene, visible, dispose } = await labelHarness();
  try {
    scene._updateLabels();
    assert.deepEqual(visible(), [], 'the initial model has no equipment name overlays');
    scene.select('a'); scene._updateLabels();
    assert.deepEqual(visible(), ['a']);
    assert.equal(scene.labels[0].line.style.display, 'none', 'the fixed selection caption needs no moving leader line');
    assert.equal(scene.labels[1].line.style.display, 'none');
    assert.equal(scene.floorLabels[0].element.hidden, true);
    assert.equal(scene.parts[0].label.hidden, true);

    scene.amount = .6; scene._updateLabels();
    assert.deepEqual(visible(), ['a'], 'the clicked name stays readable while its structure is separated');
    assert.equal(scene.parts[0].label.hidden, true, 'clicking a model must not enable all part names');

    scene.select('b'); scene._updateLabels();
    assert.deepEqual(visible(), ['b'], 'the previous equipment name must disappear on the next click');
    assert.equal(scene.labels[0].line.style.display, 'none');
    scene.select(null); scene._updateLabels();
    assert.deepEqual(visible(), [], 'clearing selection hides the last clicked name');
    assert.equal(scene.labelsEnabled, false, 'selection must not switch on the global names option');
  } finally { dispose(); }
});

test('the explicit names option still shows the active floor, and switching it off returns to the selected name', async () => {
  const { scene, visible, dispose } = await labelHarness();
  try {
    scene.select('b'); scene.setLabels(true); scene._updateLabels();
    assert.deepEqual(visible(), ['a', 'b'], 'all active-floor labels can still be explicitly enabled');
    scene.setLabels(false); scene._updateLabels();
    assert.deepEqual(visible(), ['b']);
    assert.equal(scene.labels.find((label) => label.id === 'other-floor').element.hidden, true);
  } finally { dispose(); }
});

test('selection captions keep one fixed dock across A B A clicks, camera changes and mobile reflow', async () => {
  const { scene, visible, dispose } = await labelHarness();
  const dock = (index) => {
    const { left, bottom, width, maxWidth, transform } = scene.labels[index].element.style;
    return { left, bottom, width, maxWidth, transform };
  };
  try {
    scene.labels[0].element.offsetWidth = 120;
    scene.labels[1].element.offsetWidth = 310;
    scene.labels[1].element.offsetHeight = 74;
    scene.select('a'); scene._updateLabels();
    const initial = dock(0);
    assert.deepEqual(initial, { left: '12px', bottom: '52px', width: '360px', maxWidth: '360px', transform: 'none' });
    scene.select('b'); scene._updateLabels();
    assert.deepEqual(dock(1), initial, 'a longer name must use the same dock rather than seek a new point');
    assert.equal(scene.labels[1].line.style.display, 'none');
    assert.equal(scene.labels[1].dot.style.display, 'none');
    scene.labels[1].anchor.set(500, 500, -500);
    const camera = scene._currentCamera();
    camera.position.set(40, 30, -20); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    scene._updateLabels();
    assert.deepEqual(dock(1), initial, 'turning away from the anchor must not move or hide the selection caption');
    assert.deepEqual(visible(), ['b']);
    scene.select('a'); scene._updateLabels(); scene.select('a'); scene._updateLabels();
    assert.deepEqual(dock(0), initial, 'repeating a click and returning to A must use its original dock');
    scene.width = 320; scene.height = 360; scene._updateLabels();
    const mobile = dock(0);
    assert.deepEqual(mobile, { left: '12px', bottom: '52px', width: '296px', maxWidth: '296px', transform: 'none' });
    scene.select('b'); scene._updateLabels();
    assert.deepEqual(dock(1), mobile);
    assert.ok(scene.labels[1].layout.x + scene.labels[1].layout.w <= scene.width - 12);
    assert.ok(scene.labels[1].layout.y >= 0 && scene.labels[1].layout.y + scene.labels[1].layout.h <= scene.height - 52);
    scene.setLabels(true); scene._updateLabels();
    assert.deepEqual(dock(1), mobile, 'enabling other labels must not dislodge the selected caption');
    scene.select(null); scene.setLabels(false); scene._updateLabels();
    assert.deepEqual(visible(), []);
  } finally { dispose(); }
});
