import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../apps/shared/vendor/three.module.js';
import { EQUIPMENT } from '../apps/site/building-data.js';
import { buildDryerProcessEquipment } from '../apps/site/dryer-process-models.js';
import { createLayoutEditor, validateLayout } from '../apps/site/layout-editor.js';
import { constrainPlacement } from '../apps/site/placement-rules.js';

// Only the affected poses from the user's Edge save are needed here. Every
// pose has an exact historical-default/grid/clamp explanation; no browser
// profile, unrelated storage values or complete personal layout is included.
const sourceRevision = 'preparation-tank-openings-20261112';
const oldPoses = [
  ['f1-ica-1', [-7.25, .3, -2.75], 0, 'dryer-route-1f-20261112'],
  ['f1-xray-1', [-7.75, .3, 1.5], 0, 'dryer-route-1f-20261112'],
  ['f1-conveyor-a', [-2.75, .3, 6], Math.PI / 2],
  ['f1-conveyor-b', [5.5, .3, 5.5], 0, 'dryer-overlook-native-20261112'],
  ['f1-palletizer', [10, .3, 6.75], 0, 'dryer-overlook-native-20261112'],
  ['f3-sterilizer', [-6.5, 7.3, -4.75], 0],
  ['f3-holding', [6, 7.3, 1], 0],
];
const oldItems = oldPoses.map(([id, position, rotation]) => ({ id, position, rotation }));
const catalog = oldItems.map(({ id }) => EQUIPMENT.find(item => item.id === id));
const oldPayload = () => ({ version: 1, catalogRevision: sourceRevision,
  placementRevisions: Object.fromEntries(oldPoses.filter(row => row[3]).map(([id, , , revision]) => [id, revision])),
  items: structuredClone(oldItems),
});

class EditorNode {
  constructor(tag, ownerDocument) {
    this.tagName = tag; this.ownerDocument = ownerDocument; this.children = [];
    this.dataset = {}; this.attributes = {}; this.listeners = new Map();
    this.textContent = ''; this.value = ''; this.classList = { toggle() {}, add() {} };
  }
  append(...nodes) { this.children.push(...nodes); }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(type, callback) { this.listeners.set(type, callback); }
  removeEventListener(type) { this.listeners.delete(type); }
  click() { if (!this.disabled) this.listeners.get('click')?.({ target: this }); }
  remove() {}
}

function editorFixture() {
  const base = new THREE.MeshStandardMaterial(), parts = [], resources = new Set([base]);
  const s = { equipment: EQUIPMENT, geometries: resources, materials: resources,
    mat: new Proxy({}, { get: () => base }),
    _material(color, roughness, metalness, extra = {}) {
      const value = new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra }); resources.add(value); return value;
    },
    _group(parent, position = [0, 0, 0]) { const value = new THREE.Group(); value.position.set(...position); parent.add(value); return value; },
    _mesh(geometry, material, parent, position = [0, 0, 0]) {
      const value = new THREE.Mesh(geometry, material); resources.add(geometry); value.position.set(...position); parent.add(value); return value;
    },
    _part(root) { const group = this._group(root); parts.push({ root, group }); return group; },
  };
  const footprints = new Map();
  for (const item of catalog) {
    const root = new THREE.Group(); root.position.set(...item.position); root.rotation.y = item.rotation || 0;
    assert.equal(buildDryerProcessEquipment(s, root, item), true); root.updateMatrixWorld(true);
    // Match FacilityScene's first-part body footprint, including instancing.
    const inverse = root.matrixWorld.clone().invert(), box = new THREE.Box3();
    parts.find(part => part.root === root).group.traverse(mesh => {
      if (!mesh.isMesh) return;
      mesh.geometry.computeBoundingBox(); if (mesh.isInstancedMesh) mesh.computeBoundingBox();
      box.union((mesh.isInstancedMesh ? mesh.boundingBox : mesh.geometry.boundingBox).clone()
        .applyMatrix4(inverse.clone().multiply(mesh.matrixWorld)));
    });
    footprints.set(item.id, { minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z });
  }
  const key = 'dryer-facility-layout-v1', saved = new Map([[key, JSON.stringify(oldPayload())]]);
  const priorWindow = globalThis.window; let state = [], writes = 0, editor, container;
  globalThis.window = { localStorage: { getItem: name => saved.get(name), setItem(name, value) { writes++; saved.set(name, value); } } };
  const doc = { createElement(tag) { return new EditorNode(tag, this); } }; doc.body = new EditorNode('body', doc);
  const scene = { getLayout: () => structuredClone(state), setPlacementMode() {}, setView() {}, setLayout(layout) {
    const constrained = layout.map(value => constrainPlacement(catalog.find(item => item.id === value.id), value, { footprint: footprints.get(value.id) }));
    if (constrained.some(value => !value.valid)) return false;
    state = layout.map((value, index) => ({ id: value.id, position: constrained[index].position, rotation: constrained[index].rotation })); return true;
  } };
  return { key, saved, get state() { return structuredClone(state); }, get writes() { return writes; },
    get container() { return container; },
    open() { editor?.dispose(); container = new EditorNode('div', doc); editor = createLayoutEditor({ scene, equipment: catalog, container }); },
    dispose() { editor?.dispose(); globalThis.window = priorWindow; for (const resource of resources) resource.dispose(); },
  };
}

test('the real stamped Edge hall defaults restore once and remain unchanged by actual model footprints and the quarter grid', () => {
  const fixture = editorFixture();
  try {
    fixture.open();
    for (const item of catalog) {
      const actual = fixture.state.find(value => value.id === item.id);
      assert.deepEqual(actual.position, item.position, `${item.id} must reach its registered hall pose without another automatic shift`);
      assert.ok(item.position.every((value, index) => index === 1 || value * 4 === Math.round(value * 4)));
      assert.equal(JSON.parse(fixture.saved.get(fixture.key)).placementRevisions[item.id], item.placementRevision);
    }
    assert.equal(fixture.writes, 1);
    const first = fixture.state; fixture.open();
    assert.deepEqual(fixture.state, first); assert.equal(fixture.writes, 1, 'a second restore cannot replay the repair');
    assert.equal(JSON.parse(fixture.saved.get(fixture.key)).catalogRevision, sourceRevision, 'the catalog-wide preparation migration is not replayed');
  } finally { fixture.dispose(); }
});

test('hall restoration keeps exact edits, custom turns, already stamped poses and unrelated source revisions', () => {
  for (const original of oldItems) {
    const item = catalog.find(value => value.id === original.id), payload = { ...oldPayload(), items: [original] };
    for (const delta of [1e-10, .25]) {
      const moved = { ...original, position: [original.position[0] + delta, original.position[1], original.position[2]] };
      const result = validateLayout({ ...payload, items: [moved] }, [item], { migrateDefaults: true, migrateDryerDefaults: false });
      assert.deepEqual(result[0].position, moved.position, `${item.id}: a nearby manual position must survive`);
    }
    for (const delta of [1e-10, Math.PI / 12]) {
      const turned = { ...original, rotation: original.rotation + delta };
      const result = validateLayout({ ...payload, items: [turned] }, [item], { migrateDefaults: true, migrateDryerDefaults: false });
      assert.deepEqual(result[0].position, original.position, `${item.id}: a turn protects the whole old pose`);
      assert.ok(Math.abs(result[0].rotation - turned.rotation) < 1e-12);
    }
    const stamped = { ...payload, placementRevisions: { [item.id]: item.placementRevision } };
    assert.deepEqual(validateLayout(stamped, [item], { migrateDefaults: true, migrateDryerDefaults: false })[0], original);
    const otherSource = { ...payload, catalogRevision: 'unrelated-release' };
    assert.deepEqual(validateLayout(otherSource, [item], { migrateDefaults: true, migrateDryerDefaults: false })[0], original);
    assert.deepEqual(validateLayout(payload, [item])[0], original, 'explicit validation/import does not migrate defaults');
  }
  const untouched = EQUIPMENT.find(item => item.id === 'f3-homogenizer');
  const edited = { id: untouched.id, position: [1, 7.3, 2], rotation: Math.PI / 12 };
  const retained = validateLayout({ ...oldPayload(), items: [...oldItems, edited] }, [...catalog, untouched], { migrateDefaults: true, migrateDryerDefaults: false });
  assert.deepEqual(retained.at(-1).position, edited.position, 'unrelated reviewed equipment retains its horizontal pose');
});

test('an explicit old hall layout import is saved as intentional and survives reopening', async () => {
  const fixture = editorFixture();
  try {
    fixture.open();
    const nodes = [], walk = node => { nodes.push(node); node.children.forEach(walk); }; walk(fixture.container);
    nodes.find(node => node.textContent === '배치 편집').click();
    const input = nodes.find(node => node.type === 'file');
    input.files = [{ size: 1000, text: async () => JSON.stringify(oldPayload()) }];
    await input.listeners.get('change')();
    assert.deepEqual(fixture.state, oldItems); assert.equal(fixture.writes, 2);
    fixture.open(); assert.deepEqual(fixture.state, oldItems); assert.equal(fixture.writes, 2);
  } finally { fixture.dispose(); }
});
