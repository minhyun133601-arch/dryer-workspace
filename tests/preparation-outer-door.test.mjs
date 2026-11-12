import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../apps/shared/vendor/three.module.js';
import { DRYER_BUILDING_FLOORS } from '../apps/site/dryer-building-data.js';
import { EQUIPMENT } from '../apps/site/building-data.js';
import { buildDryerBuildingEnvironment } from '../apps/site/dryer-building-envelope.js';
import { buildPreparationEquipment } from '../apps/site/preparation-models.js';
import { createLayoutEditor } from '../apps/site/layout-editor.js';
import { PLACEMENT_REGIONS } from '../apps/site/placement-rules.js';

// 11/12 user correction with screenshot 262: the preparation hall reaches the
// outer-packaging hall through one west-wall door beside the homogenizer, not
// through the raw-material weighing store, and the feed pump stands directly
// behind the homogenizer.
const first = DRYER_BUILDING_FLOORS[1];
const WEST_X = 16.4, DOOR_Z = 19.5;
const deck = EQUIPMENT.find(item => item.id === 'f1-prep-platform');
const homogenizer = EQUIPMENT.find(item => item.id === 'f1-prep-homogenizer');
const pump = EQUIPMENT.find(item => item.id === 'f1-prep-transfer-pump');
const deckSouthZ = deck.position[2] + Math.max(...deck.preparation.outline.map(([, z]) => z));
const room = id => first.rooms.find(item => item.id === id);
const westWall = () => first.partitions.find(wall => wall.a[0] === WEST_X && wall.b[0] === WEST_X);
const pose = item => ({ id: item.id, position: [...item.position], rotation: item.rotation || 0 });

function harness() {
  const labels = [];
  const s = { scene: new THREE.Scene(), geometries: new Set(), materials: new Set(), mat: {},
    _group(parent, position = [0, 0, 0]) { const root = new THREE.Group(); root.position.set(...position); parent.add(root); return root; },
    _material(color, roughness, metalness, extra = {}) { const material = new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra }); this.materials.add(material); return material; },
    _mesh(geometry, material, parent, position = [0, 0, 0]) { this.geometries.add(geometry); const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...position); parent.add(mesh); return mesh; },
    _part(parent) { return this._group(parent); },
    _groundText(text, position, width, height, parent) { labels.push({ text, position, width, height, parent }); },
  };
  return { s, labels, dispose() { s.geometries.forEach(item => item.dispose()); s.materials.forEach(item => item.dispose()); } };
}

function built(s, item) {
  const root = new THREE.Group();
  assert.equal(buildPreparationEquipment(s, root, item), true, item.id);
  root.position.set(...item.position); root.rotation.y = item.rotation || 0; root.updateMatrixWorld(true);
  return root;
}

test('the west wall keeps one outer-packaging door south of the deck edge and none in the weighing store or behind the tanks', () => {
  const wall = westWall();
  assert.ok(wall, 'the preparation/outer-packaging dividing wall is registered');
  assert.equal(wall.openings.length, 1, 'the photographed plan shows a single west door');
  const [gap] = wall.openings, z = wall.a[1] + gap.offset;
  assert.ok(Math.abs(z - DOOR_Z) < 1e-8, `door centre at local z${z}`);
  assert.ok(z - gap.width / 2 > deckSouthZ + .3, 'the door clears the deck corner column and edge beam');
  assert.ok(z + gap.width / 2 < first.bounds.maxZ - .9, 'the door stays clear of the south facade corner');
  assert.ok(gap.width >= 1.5 && gap.height >= 2.2 && !gap.doorKind, 'an ordinary paired personnel door');
  const weighing = room('preparation').bounds;
  assert.ok(!(z + gap.width / 2 > weighing.minZ && z - gap.width / 2 < weighing.maxZ), 'no door opens from the raw-material weighing store');
  const hall = room('dispensing');
  assert.ok(hall.regions.some(b => WEST_X >= b.minX - 1e-8 && z >= b.minZ && z <= b.maxZ), 'the door belongs to the preparation hall');
  const door = first.preparationSurvey.doors.find(item => item.id === 'outer-packaging');
  assert.deepEqual(door.position, [WEST_X, DOOR_Z]);
  assert.equal(door.label, '외포장실 출입구');
  assert.equal(room('factory').displayLabel, '외포장실', 'the hall beyond the door uses the user\'s name');
});

test('the built wall is solid at the old historical gaps and open at the new door, whose label stays on the preparation side', () => {
  const h = harness();
  try {
    const environment = buildDryerBuildingEnvironment(h.s, { floor: 1, elevation: first.elevation, spec: first });
    h.s.scene.updateMatrixWorld(true);
    const through = z => new THREE.Raycaster(new THREE.Vector3(WEST_X + 1, 1.2, z), new THREE.Vector3(-1, 0, 0), 0, 2).intersectObject(environment.facade, true).length;
    for (const z of [1.5, 10.5]) assert.ok(through(z) > 0, `the historical gap at local z${z} is now wall`);
    assert.equal(through(DOOR_Z), 0, 'the new doorway is a real wall opening');
    const doors = environment.architectureFixtures.children.filter(node => node.userData.architecturalDoor && Math.abs(node.position.x - WEST_X) < 1e-6);
    assert.equal(doors.length, 1);
    assert.ok(Math.abs(doors[0].position.z - DOOR_Z) < 1e-6);
    const leaves = []; doors[0].traverse(node => { if (node.userData.proximityDoor) leaves.push(node); });
    assert.equal(leaves.length, 2, 'paired leaves');
    assert.ok(leaves.every(leaf => leaf.userData.proximityDoor.enterable && leaf.rotation.y === 0), 'closed by default and walkable');
    const label = h.labels.find(item => item.text === '외포장실 출입구');
    assert.ok(label && label.position[0] - label.width / 2 > WEST_X + .05, 'the floor label does not straddle the wall');
    assert.ok(label.position[2] > DOOR_Z - .9 && label.position[2] < DOOR_Z + .9, 'the floor label sits in front of the door');
    assert.ok(h.labels.some(item => item.text === '외포장실'), 'the outer-packaging hall is named');
  } finally { h.dispose(); }
});

test('the feed pump stands directly behind the homogenizer, whose front faces the hall, and both keep the door approach clear', () => {
  const h = harness();
  try {
    assert.equal(homogenizer.rotation, -Math.PI, 'the filmed pump-head front faces the preparation hall (-Z)');
    const hRoot = built(h.s, homogenizer), pRoot = built(h.s, pump);
    const hBox = new THREE.Box3().setFromObject(hRoot), pBox = new THREE.Box3().setFromObject(pRoot);
    const heads = []; hRoot.traverse(node => { if (node.name === 'preparation-homogenizer-front-round-head') heads.push(node.getWorldPosition(new THREE.Vector3())); });
    assert.equal(heads.length, 3);
    assert.ok(heads.every(head => head.z < homogenizer.position[2]), 'pump heads face north toward the hall');
    const body = hRoot.getObjectByName('preparation-filmed-homogenizer-body'), bodyBox = new THREE.Box3().setFromObject(body);
    assert.ok(pump.position[2] > homogenizer.position[2], 'the pump is on the far (south) side from the hall');
    assert.ok(pBox.min.z - bodyBox.max.z < .2 && pBox.min.z > bodyBox.max.z - .1, 'the pump sits right behind the homogenizer, not across the aisle');
    const overlapX = Math.min(pBox.max.x, bodyBox.max.x) - Math.max(pBox.min.x, bodyBox.min.x);
    assert.ok(overlapX > 1.2, 'the pump lies behind the homogenizer body, not beside it');
    const riser = pRoot.getObjectByName('preparation-pump-discharge-riser'), riserBox = new THREE.Box3().setFromObject(riser);
    assert.ok(Math.abs(riserBox.min.z - bodyBox.max.z) < .08, 'the discharge reaches the homogenizer back face');
    const inlet = riserBox.getCenter(new THREE.Vector3());
    assert.ok(inlet.x > bodyBox.min.x && inlet.x < bodyBox.max.x && riserBox.max.y > bodyBox.min.y && riserBox.max.y < bodyBox.max.y + .1, 'the feed line enters the homogenizer body');
    const region = PLACEMENT_REGIONS.building;
    for (const box of [hBox, pBox]) assert.ok(box.max.z <= region.maxZ && box.max.z < first.bounds.maxZ - .06 && box.min.x > WEST_X + 1.5 && box.max.x < 21.54, 'inside the south strip and clear of the walls');
    // Clear space in front of the paired door on the preparation side.
    const approach = new THREE.Box3(new THREE.Vector3(WEST_X + .06, .3, DOOR_Z - .9), new THREE.Vector3(WEST_X + 1.8, 2.7, DOOR_Z + .9));
    for (const [id, box] of [[homogenizer.id, hBox], [pump.id, pBox]]) assert.ok(!approach.intersectsBox(box), `${id} keeps the door approach free`);
    const deckRoot = built(h.s, deck), deckSupports = [];
    deckRoot.traverse(node => { if (node.name === 'preparation-platform-support-column') deckSupports.push(new THREE.Box3().setFromObject(node)); });
    assert.ok(deckSupports.every(box => !approach.intersectsBox(box)), 'no deck column stands in the doorway');
  } finally { h.dispose(); }
});

class EditorNode {
  constructor(tag, ownerDocument) { this.tagName = tag; this.ownerDocument = ownerDocument; this.children = []; this.dataset = {}; this.listeners = new Map(); this.attributes = {}; this.classList = { add() {}, toggle() {} }; }
  append(...nodes) { this.children.push(...nodes); }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(type, fn) { this.listeners.set(type, fn); }
  removeEventListener(type) { this.listeners.delete(type); }
  click() { if (!this.disabled) return this.listeners.get('click')?.({ target: this }); }
  remove() {}
}

test('the 11/12 Edge save moves the homogenizer and pump once while keeping other poses and later edits', () => {
  // Read from the user's Edge profile on 11/12 (catalog preparation-tank-openings-20261112).
  const browser = [
    { id: 'f1-mix-a', position: [18.25, .3, 8.25], rotation: 0 }, { id: deck.id, position: [22, .3, 11.5], rotation: 0 },
    { id: homogenizer.id, position: [18.5, .3, 20], rotation: 0 }, { id: pump.id, position: [20, .3, 18], rotation: 0 },
    { id: 'f1-prep-filter-pot', position: [19.75, .3, 15.5], rotation: 0 },
  ];
  const catalog = browser.map(value => EQUIPMENT.find(item => item.id === value.id));
  const key = 'dryer-facility-layout-v1', previousWindow = globalThis.window;
  const saved = new Map([[key, JSON.stringify({ version: 1, catalogRevision: 'preparation-tank-openings-20261112', placementRevisions: {}, items: browser })]]);
  let state = [], writes = 0, editor;
  const doc = { createElement(tag) { return new EditorNode(tag, this); } }; doc.body = new EditorNode('body', doc);
  const scene = { getLayout: () => structuredClone(state), setLayout(layout) { state = structuredClone(layout); return true; }, setPlacementMode() {}, setView() {} };
  const open = () => { editor = createLayoutEditor({ scene, equipment: catalog, container: new EditorNode('div', doc) }); };
  const find = id => state.find(item => item.id === id);
  try {
    globalThis.window = { localStorage: { getItem: name => saved.get(name), setItem(name, value) { writes++; saved.set(name, value); } } };
    open();
    assert.deepEqual(find(homogenizer.id), pose(homogenizer));
    assert.deepEqual(find(pump.id), pose(pump));
    for (const value of browser.filter(item => ![homogenizer.id, pump.id].includes(item.id))) assert.deepEqual(find(value.id), value, `${value.id} keeps its saved pose`);
    const stamped = JSON.parse(saved.get(key));
    assert.equal(stamped.placementRevisions[homogenizer.id], homogenizer.placementRevision);
    assert.equal(stamped.placementRevisions[pump.id], pump.placementRevision);
    assert.equal(writes, 1); editor.dispose(); open(); assert.equal(writes, 1, 'the move happens once');

    // A user who later puts the pump back at the old default keeps that choice.
    editor.dispose();
    saved.set(key, JSON.stringify({ ...stamped, items: stamped.items.map(item => item.id === pump.id ? { id: pump.id, position: [20, .3, 18], rotation: 0 } : item) }));
    open(); assert.deepEqual(find(pump.id), { id: pump.id, position: [20, .3, 18], rotation: 0 });
    // A manual move made before this release is also kept.
    editor.dispose();
    saved.set(key, JSON.stringify({ version: 1, catalogRevision: 'preparation-tank-openings-20261112', items: browser.map(item => item.id === homogenizer.id ? { ...item, position: [18.25, .3, 19.75] } : item) }));
    open();
    assert.deepEqual(find(homogenizer.id), { id: homogenizer.id, position: [18.25, .3, 19.75], rotation: 0 });
    assert.deepEqual(find(pump.id), pose(pump), 'the untouched pump still moves behind the homogenizer default');
  } finally { editor?.dispose(); globalThis.window = previousWindow; }
});
