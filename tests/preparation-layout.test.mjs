import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../apps/shared/vendor/three.module.js';
import { DRYER_BUILDING_FLOORS } from '../apps/site/dryer-building-data.js';
import { FLOORS } from '../apps/site/facility-data.js';
import { EQUIPMENT } from '../apps/site/building-data.js';
import { CAMPUS_EQUIPMENT } from '../apps/site/campus-data.js';
import { PREPARATION_EQUIPMENT } from '../apps/site/preparation-data.js';
import { buildDryerBuildingEnvironment } from '../apps/site/dryer-building-envelope.js';
import { buildPreparationEquipment } from '../apps/site/preparation-models.js';
import { validateLayout, createLayoutEditor } from '../apps/site/layout-editor.js';
import { constrainPlacement } from '../apps/site/placement-rules.js';

const first = DRYER_BUILDING_FLOORS[1];
const ids = ['f1-melting', 'f1-mix-a', 'f1-mix-b', 'f1-oil-water', 'f1-s1'];
const tanks = ids.map(id => EQUIPMENT.find(item => item.id === id));
const oldRevision = 'campus-office-lpg-restoration-20261111';
const previousPreparationRevision = 'preparation-room-current-layout-20261111';
const completedPreparationRevision = 'preparation-complete-20261111';
const missingTankRevision = 'preparation-missing-tank-20261112';
const currentRevision = 'preparation-tank-openings-20261112';

test('the new mobile cabinet repairs only its exact aisle-blocking saved default once', () => {
  const item = EQUIPMENT.find(item => item.id === 'f1-prep-mobile-white-unit');
  const old = { id:item.id, position:[25.65,.3,6.5], rotation:0 };
  const payload = {version:1,catalogRevision:currentRevision,placementRevisions:{},items:[old]};
  const options = {migrateDefaults:true,migrateDryerDefaults:false};
  assert.deepEqual(validateLayout(payload,[item],options),[pose(item)]);
  const snapped = {...payload,items:[{...old,position:[25.75,.3,6.5]}]};
  assert.deepEqual(validateLayout(snapped,[item],options),[pose(item)], 'the original default saved on the automatic quarter-grid is also repaired');
  for (const changed of [{...old,position:[25.5,.3,6.5]},{...old,rotation:.1}]) {
    const manual={...payload,items:[changed]};
    const [restored]=validateLayout(manual,[item],options);
    assert.deepEqual(restored.position,changed.position,'a manual move preserves its complete saved position');
    assert.ok(Math.abs(restored.rotation-changed.rotation)<1e-10,'a manual turn preserves its saved facing');
  }
  assert.deepEqual(validateLayout(payload,[item]),payload.items,'an explicit file import stays intentional');
  const stamped={...payload,placementRevisions:{[item.id]:item.placementRevision}};
  assert.deepEqual(validateLayout(stamped,[item],options),payload.items,'the item correction never replays after it was saved once');
});

test('only the previous stair equipment defaults and their quarter-grid saves follow the photographed console', () => {
  const options={migrateDefaults:true,migrateDryerDefaults:false};
  const whiteStamp='preparation-mobile-cabinet-shutter-clearance-20261113';
  for (const [id, old, snapped, stamp] of [
    ['f1-prep-mobile-white-unit',[25.65,.3,9.8],[25.75,.3,9.75],whiteStamp],
    ['f1-prep-bag-dump',[22.2,.3,6.4],[22.25,.3,6.5],null],
  ]) {
    const item=EQUIPMENT.find(item=>item.id===id);
    const payload=(position,rotation=0,revision=stamp,catalogRevision=currentRevision)=>({version:1,catalogRevision,
      placementRevisions:revision?{[id]:revision}:{}, items:[{id,position,rotation}]});
    for(const position of [old,snapped]) assert.deepEqual(validateLayout(payload(position),[item],options),[pose(item)]);
    for(const manual of [payload([old[0]+.01,.3,old[2]]),payload(old,.25),payload(old,0,item.placementRevision),payload(old,0,'other-review'),payload(old,0,stamp,'other-catalog')]){
      assert.deepEqual(validateLayout(manual,[item],options),manual.items);
    }
    assert.deepEqual(validateLayout(payload(old),[item]),payload(old).items);
    if(id==='f1-prep-mobile-white-unit'){
      const editedAfterShutterFix=payload([25.65,.3,6.5]);
      assert.deepEqual(validateLayout(editedAfterShutterFix,[item],options),editedAfterShutterFix.items);
    }
  }
});
// A hanging tank pose is "on the deck" when its centre lies within the deck rectangle.
const onDeck = (item, position) => position[0] >= item.hangingDeck.minX && position[0] <= item.hangingDeck.maxX && position[2] >= item.hangingDeck.minZ && position[2] <= item.hangingDeck.maxZ;
const oldPositions = new Map([
  ['f1-melting', [21.2, .3, 3.3]], ['f1-mix-a', [21.2, .3, -1.3]],
  ['f1-mix-b', [25.3, .3, -1.3]], ['f1-oil-water', [25.5, .3, 3.3]], ['f1-s1', [23.5, .3, 10]],
]);
const near = (a, b, message = '') => assert.ok(Math.abs(a - b) < 1e-8, `${message}: ${a} vs ${b}`);
const contains = (bounds, x, z, margin = 0) => x - margin >= bounds.minX - 1e-8 && x + margin <= bounds.maxX + 1e-8 && z - margin >= bounds.minZ - 1e-8 && z + margin <= bounds.maxZ + 1e-8;
const inRoom = (room, x, z) => (room.regions || [room.bounds]).some(bounds => contains(bounds, x, z));
const room = id => first.rooms.find(item => item.id === id);
const vessels = () => tanks.flatMap(item => item.preparation.vessels.map(vessel => ({
  id: vessel.id, radius: vessel.radius, x: item.position[0] + (vessel.x || 0), z: item.position[2] + (vessel.z || 0),
})));
const oldLayout = quarter => ids.map(id => ({ id, position: oldPositions.get(id).map((n, i) => quarter && i !== 1 ? Math.round(n * 4) / 4 : n), rotation: 0 }));
const originalOwpPositions = new Map([
  ['f1-melting', [1.2, .3, -8]], ['f1-mix-a', [-8.8, .3, -8]], ['f1-mix-b', [-3.8, .3, -8]],
  ['f1-oil-water', [8, .3, -7.5]], ['f1-s1', [8.8, .3, -1.8]],
]);
const originalOwpLayout = quarter => ids.map(id => ({ id, position: originalOwpPositions.get(id).map((n, i) => quarter && i !== 1 ? Math.round(n * 4) / 4 : n), rotation: 0 }));
const pose = item => ({ id: item.id, position: [...item.position], rotation: item.rotation || 0 });

test('the continuous walk replaces obsolete first-floor names and preserves two bounded raw-material zones beside the wide current hall', () => {
  const names = first.rooms.map(item => item.name);
  assert.equal(new Set(names).size, names.length, 'current floor names cannot be duplicated for repeated camera visits');
  assert.equal(new Set(first.rooms.map(item => item.id)).size, first.rooms.length);
  for (const expected of ['일일원료보관창고', '원료계량창고', '조제실', '사무·소독 준비실', 'CIP·세척 설비실', '소독실·에어샤워', '위생 전실·신발장', '화장실']) assert.ok(names.includes(expected), expected);
  assert.ok(!names.some(name => /^(?:준비실|OP실|공무작업실|공무작업장|공무자재창고)$/.test(name)), 'historical OWP/A013 names cannot replace filmed room identities');
  const storage = room('raw-storage'), weighing = room('preparation'), hall = room('dispensing');
  near(storage.bounds.minX, weighing.bounds.maxX, 'warehouse and weighing share their partial dividing line');
  near(storage.bounds.minZ, weighing.bounds.minZ);
  near(storage.bounds.maxZ, weighing.bounds.maxZ);
  assert.ok(storage.bounds.minX > weighing.bounds.minX);
  assert.ok(hall.regions.length >= 2, 'the current hall must retain its L-shaped return');
  assert.ok(inRoom(hall, 18, 10) && inRoom(hall, 30, 8), 'both sides of the obsolete narrow eastern hall remain accessible');
  assert.ok(inRoom(hall, 24, 17), 'the south-west return remains part of the process hall');
  const toilet = room('toilet').bounds;
  assert.ok(!inRoom(hall, (toilet.minX+toilet.maxX)/2, (toilet.minZ+toilet.maxZ)/2), 'the filmed toilet is a separate bounded room');
  assert.ok(!inRoom(hall, 33, 17.5), 'the hygiene/entry corner cannot be swallowed by the large hall');
  const obsoleteLongWall = first.partitions.some(wall => Math.abs(wall.a[0] - storage.bounds.minX) < 1e-8 && Math.abs(wall.b[0] - storage.bounds.minX) < 1e-8 && Math.max(wall.a[1], wall.b[1]) > storage.bounds.maxZ + 1 && Math.min(wall.a[1], wall.b[1]) < 12);
  assert.equal(obsoleteLongWall, false, 'the historical x36.8 wall cannot divide the filmed open hall');
});

function openingAt(x, z) {
  return first.partitions.some(wall => {
    const dx = wall.b[0] - wall.a[0], dz = wall.b[1] - wall.a[1], length = Math.hypot(dx, dz);
    const offset = ((x - wall.a[0]) * dx + (z - wall.a[1]) * dz) / length;
    const distance = Math.abs((x - wall.a[0]) * dz - (z - wall.a[1]) * dx) / length;
    return distance < 1e-8 && (wall.openings || []).some(gap => Math.abs(offset - gap.offset) <= gap.width / 2 + 1e-8);
  });
}

test('the filmed raw-material entry, separate inner shutter, air shower, toilet and personnel exit form one registered route with real openings', () => {
  const survey = first.preparationSurvey;
  assert.deepEqual(survey.roomPlanAxes, { top: '+X', right: '+Z', bottom: '-X', left: '-Z' });
  const doors = new Map(survey.doors.map(door => [door.id, door]));
  for (const id of ['raw-exterior', 'raw-inner-shutter', 'air-shower', 'toilet', 'team1-part2']) assert.ok(doors.has(id), id);
  assert.notDeepEqual(doors.get('raw-exterior').position, doors.get('raw-inner-shutter').position, 'the two orange shutters are separate doors');
  for (const id of ['raw-exterior', 'team1-part2']) {
    const door = doors.get(id);
    near(door.position[0], first.bounds.maxX, 'both filmed exterior doors use the east facade');
    assert.ok(first.openings.some(gap => gap.side === 'east' && Math.abs(first.bounds.minZ + gap.offset - door.position[1]) < 1e-8 && gap.width >= door.width));
  }
  const inner = doors.get('raw-inner-shutter');
  near(inner.position[1], room('raw-storage').bounds.maxZ, 'the inner shutter separates the initial bounded warehouse from the hall');
  assert.ok(openingAt(...inner.position), 'the inner shutter metadata corresponds to a genuine partition gap');
  assert.ok(contains(room('air-shower').bounds, ...doors.get('air-shower').position));
  assert.ok(openingAt(...doors.get('toilet').position), 'the toilet opens into the adjacent personnel corridor');
  assert.ok(contains(room('toilet').bounds, ...doors.get('toilet').position));
  for (const [x, z] of survey.route) assert.ok(contains(first.bounds, x, z), 'the registered walk must remain inside the 43x35 envelope');
  assert.ok(survey.route.some(([x, z]) => inRoom(room('dispensing'), x, z)));
  assert.ok(survey.route.some(([x, z]) => contains(room('air-shower').bounds, x, z)));
  assert.ok(survey.route.some(([x, z]) => contains(room('hygiene').bounds, x, z)));
});

function harness() {
  const s = { scene: new THREE.Scene(), geometries: new Set(), materials: new Set(), mat: {},
    _group(parent, position = [0, 0, 0]) { const root = new THREE.Group(); root.position.set(...position); parent.add(root); return root; },
    _material(color, roughness, metalness, extra = {}) { const material = new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra }); this.materials.add(material); return material; },
    _mesh(geometry, material, parent, position = [0, 0, 0]) { this.geometries.add(geometry); const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...position); parent.add(mesh); return mesh; },
    _part(parent) { return this._group(parent); }, _groundText() {},
  };
  return { s, dispose() { s.geometries.forEach(item => item.dispose()); s.materials.forEach(item => item.dispose()); } };
}

test('six actual tank bodies retain their legacy identities, the western row and south return under the double-height second-floor void', () => {
  assert.ok(tanks.every(Boolean));
  for (const id of ids) assert.equal(EQUIPMENT.filter(item => item.id === id).length, 1);
  assert.equal(PREPARATION_EQUIPMENT.filter(item => item.preparation?.kind === 'tank-group').length, 0, 'the observed bank replaces five old items instead of adding a duplicate bank');
  const bank = vessels(), row = bank.slice(0, 5), returned = bank[5];
  assert.equal(bank.length, 6); assert.equal(new Set(bank.map(item => item.id)).size, 6);
  assert.equal(tanks[0].preparation.vessels.length, 1, 'the old two-body melting abstraction is now one observed vessel');
  row.forEach(item => near(item.x, row[0].x, 'five vessels share the western row'));
  row.slice(1).forEach((item, i) => assert.ok(item.z > row[i].z));
  assert.ok(returned.x > row[0].x + 2 && returned.z > row[2].z, 'S-1 returns at the southern end rather than extending the row');
  for (let i = 0; i < bank.length; i++) for (let j = i + 1; j < bank.length; j++) assert.ok(Math.hypot(bank[i].x - bank[j].x, bank[i].z - bank[j].z) > bank[i].radius + bank[j].radius, 'distinct tank shells cannot overlap');
  near(first.bounds.maxX - first.bounds.minX, 43); near(first.bounds.maxZ - first.bounds.minZ, 35);
  near(first.structureHeight, 6.6); near(first.preparationSurvey.doubleHeight, first.structureHeight);
  near(FLOORS.find(item => item.id === 1).structureHeight, first.structureHeight);
  const second = DRYER_BUILDING_FLOORS[2], h = harness();
  try {
    const environment = buildDryerBuildingEnvironment(h.s, { floor: 2, spec: second });
    h.s.scene.updateMatrixWorld(true);
    for (const vessel of bank) {
      assert.ok(second.voids.some(bounds => contains(bounds, vessel.x, vessel.z, vessel.radius)), 'every tall vessel fits inside the real 2F void, not under its slab');
      for (const [x, z] of [[vessel.x, vessel.z], [vessel.x + vessel.radius, vessel.z], [vessel.x, vessel.z + vessel.radius]]) {
        const ray = new THREE.Raycaster(new THREE.Vector3(x, 10, z), new THREE.Vector3(0, -1, 0), 0, 15);
        assert.equal(ray.intersectObject(environment.deck, true).length, 0, '2F geometry must leave the tank bank open vertically');
      }
    }
    for (const item of tanks) {
      const root = new THREE.Group(); root.position.set(...item.position);
      assert.equal(buildPreparationEquipment(h.s, root, item), true);
      root.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(root);
      assert.ok(bounds.max.y < first.elevation + first.structureHeight, 'the filmed tall mixer stays below the double-height ceiling');
      assert.ok(bounds.min.y >= first.elevation - .001);
    }
  } finally { h.dispose(); }
});

test('an automatic restore from the reviewed campus-office release migrates only exact old preparation defaults and quarter-grid defaults', () => {
  for (const quarter of [false, true]) {
    const stored = oldLayout(quarter), payload = { version: 1, catalogRevision: oldRevision, items: stored };
    const before = structuredClone(payload);
    const restored = validateLayout(payload, tanks, { migrateDefaults: true, migrateDryerDefaults: false });
    for (let i = 0; i < tanks.length; i++) {
      assert.deepEqual(restored[i], pose(tanks[i]), `${tanks[i].id}: exact ${quarter ? 'quarter-grid' : 'catalog'} pose adopts the video registration`);
      assert.notDeepEqual(restored[i].position, stored[i].position);
    }
    assert.deepEqual(payload, before, 'restoration must not mutate the saved evidence');
  }
});

test('preparation moves on the deck, small turns, explicit imports and current-release saves keep their poses while off-deck earlier poses return to their openings', () => {
  for (const quarter of [false, true]) for (const value of oldLayout(quarter)) {
    const item = tanks.find(item => item.id === value.id);
    const altered = [
      { ...value, position: [value.position[0] + .25, value.position[1], value.position[2]] },
      { ...value, position: [value.position[0], value.position[1], value.position[2] + .25] },
      { ...value, position: [value.position[0] + 1e-10, value.position[1], value.position[2]] },
      { ...value, rotation: Math.PI / 12 }, { ...value, rotation: 1e-10 },
    ];
    for (const edited of altered) {
      const result = validateLayout({ version: 1, catalogRevision: oldRevision, items: [edited] }, [item], { migrateDefaults: true, migrateDryerDefaults: false })[0];
      if (onDeck(item, edited.position)) {
        assert.deepEqual(result.position, edited.position, `${item.id}: a custom move or turn on the deck keeps the entire pose`);
        assert.ok(Math.abs(result.rotation - edited.rotation) < 1e-12, 'even a tiny explicit turn stays intentional');
      } else assert.deepEqual(result, pose(item), `${item.id}: a hanging tank saved off the deck cannot leave its opening empty`);
    }
    const imported = validateLayout({ version: 1, catalogRevision: oldRevision, items: [value] }, [item])[0];
    assert.deepEqual(imported, value, 'an explicit file import never applies the automatic migration');
    const current = validateLayout({ version: 1, catalogRevision: currentRevision, items: [value] }, [item], { migrateDefaults: true, migrateDryerDefaults: false })[0];
    assert.deepEqual(current, value, 'a pose saved by this release stays where the user put it');
    for (const catalogRevision of ['unrelated-future-release', undefined]) {
      const result = validateLayout({ version: 1, catalogRevision, items: [value] }, [item], { migrateDefaults: true, migrateDryerDefaults: false })[0];
      assert.deepEqual(result, onDeck(item, value.position) ? value : pose(item), 'exact old poses on the deck stay revision-qualified; off-deck poses return from any earlier save');
    }
  }
});

test('every hanging tank, its deck and the services under it already sit on the placement grid with co-centred openings', () => {
  const deckItem = EQUIPMENT.find(item => item.id === 'f1-prep-platform');
  const deckGroup = ['f1-prep-platform', 'f1-prep-console', 'f1-prep-main-panel', 'f1-prep-under-services', ...ids].map(id => EQUIPMENT.find(item => item.id === id));
  for (const item of deckGroup) {
    const snapped = constrainPlacement(item, item, { footprint: { minX: -.5, maxX: .5, minZ: -.5, maxZ: .5 } });
    assert.deepEqual(snapped.position, item.position, `${item.id}: saving a layout cannot shift it off its catalog pose`);
    assert.equal(snapped.snapped, false);
  }
  const openings = deckItem.preparation.holes.map(hole => [deckItem.position[0] + hole.x, deckItem.position[2] + hole.z]);
  for (const item of tanks) {
    assert.deepEqual(item.hangingDeck, { id: deckItem.id, minX: 16.6, maxX: 26.9, minZ: 4.75, maxZ: 18.25 });
    for (const unit of item.preparation.vessels) {
      const centre = [item.position[0] + (unit.x || 0), item.position[2] + (unit.z || 0)];
      assert.ok(onDeck(item, [centre[0], 0, centre[1]]));
      assert.equal(openings.filter(([x, z]) => Math.hypot(x - centre[0], z - centre[1]) < 1e-6).length, 1, `${unit.id} has exactly one opening on its axis`);
    }
  }
  assert.deepEqual(EQUIPMENT.find(item => item.id === 'f1-mix-a').position, [18.25, .3, 8.25], 'MIX-1 hangs between the casein tank and MIX-2');
});

test('the completed preparation release repairs both original OWP and registered defaults that were already stamped with the prior preparation revision', () => {
  const options = { migrateDefaults: true, migrateDryerDefaults: false, migrateCampusDefaults: false, migrateOutdoorDefaults: false, migrateOutdoorPositions: false };
  for (const catalogRevision of [oldRevision, previousPreparationRevision]) for (const variant of [oldLayout(false), oldLayout(true), originalOwpLayout(false), originalOwpLayout(true)]) {
    const payload = { version: 1, catalogRevision, items: variant }, before = structuredClone(payload);
    const corrected = validateLayout(payload, tanks, options);
    assert.deepEqual(corrected, tanks.map(pose), `${catalogRevision}: both generations of exact defaults move to the filmed bank`);
    assert.deepEqual(payload, before);
    for (const record of variant) {
      const item = tanks.find(item => item.id === record.id);
      for (const edited of [
        { ...record, position: [record.position[0] + .25, record.position[1], record.position[2]] },
        { ...record, position: [record.position[0] + 1e-10, record.position[1], record.position[2]] },
        { ...record, rotation: Math.PI / 12 }, { ...record, rotation: 1e-10 },
      ]) {
        const result = validateLayout({ ...payload, items: [edited] }, [item], options)[0];
        if (!onDeck(item, edited.position)) { assert.deepEqual(result, pose(item), 'an off-deck hanging tank returns to its opening'); continue; }
        assert.deepEqual(result.position, edited.position, 'manual moves or rotations on the deck protect the whole pose');
        assert.ok(Math.abs(result.rotation - edited.rotation) < 1e-12);
      }
    }
    assert.deepEqual(validateLayout(payload, tanks), variant, 'an explicit file import of either default generation remains intentional');
    assert.deepEqual(validateLayout({ ...payload, catalogRevision: currentRevision }, tanks, { ...options, migrateDefaults: false }), variant, 'a later current-release save is not corrected again');
  }
  const alreadyInRoom = tanks.map(item => ({ ...pose(item), position: item.position.map((n, index) => index === 1 ? n : Math.round(n * 4) / 4) }));
  assert.deepEqual(validateLayout({ version: 1, catalogRevision: previousPreparationRevision, items: alreadyInRoom }, tanks, options), alreadyInRoom, 'the existing browser grid-aligned bank stays exactly where the user already has it');
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

test('a recorded MIX-1 automatic clamp carried into reviewed preparation saves restores the missing body once without replaying other area corrections', async () => {
  const mix = tanks.find(item => item.id === 'f1-mix-a'), automatic = { id: mix.id, position: [-7, .3, -8], rotation: 0 };
  const options = { migrateDefaults: true, migrateDryerDefaults: false, migrateCampusDefaults: false, migrateOutdoorDefaults: false, migrateOutdoorPositions: false };
  for (const catalogRevision of ['dryer-full-envelope-final-20261110', previousPreparationRevision, completedPreparationRevision, missingTankRevision, 'unrelated-future-release', undefined]) {
    const payload = { version: 1, catalogRevision, items: [automatic] };
    assert.deepEqual(validateLayout(payload, [mix], options), [pose(mix)], `${catalogRevision}: the recorded default belongs in the empty MIX-1 opening`);
    for (const edited of [
      { ...automatic, position: [-7.25, .3, -8] },
      { ...automatic, position: [-6.75, .3, -8] },
      { ...automatic, position: [-7 + 1e-10, .3, -8] },
      { ...automatic, rotation: Math.PI / 12 },
      { ...automatic, rotation: 1e-10 },
    ]) {
      assert.deepEqual(validateLayout({ ...payload, items: [edited] }, [mix], options), [pose(mix)], 'no deck exists off the preparation platform, whatever the exact clamp value');
    }
    assert.deepEqual(validateLayout(payload, [mix]), [automatic], 'an explicit import remains intentional');
  }
  assert.deepEqual(validateLayout({ version: 1, catalogRevision: currentRevision, items: [automatic] }, [mix], options), [automatic], 'a pose saved by this release is not corrected again');

  const office = CAMPUS_EQUIPMENT.find(item => item.id === 'campus-maintenance-office');
  const otherFloor = { id: 'reviewed-other-floor', floor: 3, position: [7, 7.3, 6], rotation: 0, previousPlacements: [{ position: [-5, 7.3, -4], rotation: 0 }] };
  const catalog = [...tanks, office, otherFloor], preserved = [
    { id: office.id, position: [55, 0, -77], rotation: .25 },
    { id: otherFloor.id, position: [-5, 7.3, -4], rotation: 0 },
  ];
  const original = [...tanks.map(item => item.id === mix.id ? structuredClone(automatic) : pose(item)), ...preserved];
  const key = 'dryer-facility-layout-v1', previousWindow = globalThis.window;
  const saved = new Map([[key, JSON.stringify({ version: 1, catalogRevision: completedPreparationRevision, items: original })]]);
  let state = [], writes = 0, editor;
  const doc = { createElement(tag) { return new EditorNode(tag, this); } }; doc.body = new EditorNode('body', doc);
  const scene = { getLayout: () => structuredClone(state), setLayout(layout) { state = structuredClone(layout); return true; }, setPlacementMode() {}, setView() {} };
  const open = () => { const container = new EditorNode('div', doc); editor = createLayoutEditor({ scene, equipment: catalog, container }); return container; };
  try {
    globalThis.window = { localStorage: { getItem: name => saved.get(name), setItem(name, value) { writes++; saved.set(name, value); } } };
    open();
    assert.deepEqual(state.find(item => item.id === mix.id), pose(mix));
    assert.deepEqual(state.filter(item => item.id !== mix.id), original.filter(item => item.id !== mix.id), 'only the missing tank moves; reviewed office and other floor edits stay');
    assert.equal(JSON.parse(saved.get(key)).catalogRevision, currentRevision); assert.equal(writes, 1);
    editor.dispose(); open(); assert.equal(writes, 1, 'the restoration runs once');

    editor.dispose(); const container = open(), nodes = [];
    const visit = node => { nodes.push(node); node.children.forEach(visit); }; visit(container);
    nodes.find(node => node.textContent === '배치 편집').click();
    const file = nodes.find(node => node.type === 'file');
    file.files = [{ size: 2500, text: async () => JSON.stringify({ version: 1, catalogRevision: completedPreparationRevision, items: original }) }];
    await file.listeners.get('change')();
    assert.deepEqual(state, original); assert.equal(writes, 2);
    editor.dispose(); open(); assert.deepEqual(state, original); assert.equal(writes, 2, 'a later explicit import is stamped with this release and retained after reopening');
  } finally { editor?.dispose(); globalThis.window = previousWindow; }
});

test('the 11/12 browser save that kept MIX-1 at [-7.25, -8] under the missing-tank release fills its opening once and keeps every other pose', async () => {
  // Read from the user's Edge profile on 11/12: the exact [-7, -8] repair did
  // not match, and the grid-snapped bank was re-stamped with its revision.
  const mix = tanks.find(item => item.id === 'f1-mix-a'), office = CAMPUS_EQUIPMENT.find(item => item.id === 'campus-maintenance-office');
  const deck = EQUIPMENT.find(item => item.id === 'f1-prep-platform');
  const otherFloor = { id: 'reviewed-other-floor', floor: 3, position: [7, 7.3, 6], rotation: 0, previousPlacements: [{ position: [-5, 7.3, -4], rotation: 0 }] };
  const browser = [
    { id: 'f1-melting', position: [18.25, .3, 5.75], rotation: 0 }, { id: 'f1-mix-a', position: [-7.25, .3, -8], rotation: 0 },
    { id: 'f1-mix-b', position: [18.25, .3, 11], rotation: 0 }, { id: 'f1-oil-water', position: [18.25, .3, 13.5], rotation: 0 },
    { id: 'f1-s1', position: [23, .3, 16], rotation: 0 }, { id: deck.id, position: [22, .3, 11.5], rotation: 0 },
    { id: office.id, position: [55, 0, -77], rotation: .25 }, { id: otherFloor.id, position: [-5, 7.3, -4], rotation: 0 },
  ];
  const catalog = [...tanks, deck, office, otherFloor];
  const expected = browser.map(item => item.id === mix.id ? pose(mix) : item);
  assert.deepEqual(browser.filter(item => item.id !== mix.id && item.id !== office.id && item.id !== otherFloor.id), catalog.filter(item => item.id !== mix.id && item.id !== office.id && item.id !== otherFloor.id).map(pose), 'the grid-snapped bank and deck already equal the grid-aligned catalog');
  const key = 'dryer-facility-layout-v1', previousWindow = globalThis.window;
  const saved = new Map([[key, JSON.stringify({ version: 1, catalogRevision: missingTankRevision, items: browser })]]);
  let state = [], writes = 0, editor;
  const doc = { createElement(tag) { return new EditorNode(tag, this); } }; doc.body = new EditorNode('body', doc);
  const scene = { getLayout: () => structuredClone(state), setLayout(layout) { state = structuredClone(layout); return true; }, setPlacementMode() {}, setView() {} };
  const open = () => { const container = new EditorNode('div', doc); editor = createLayoutEditor({ scene, equipment: catalog, container }); return container; };
  try {
    globalThis.window = { localStorage: { getItem: name => saved.get(name), setItem(name, value) { writes++; saved.set(name, value); } } };
    open();
    assert.deepEqual(state, expected, 'only MIX-1 moves; the reviewed office edit and other floors stay');
    assert.equal(JSON.parse(saved.get(key)).catalogRevision, currentRevision); assert.equal(writes, 1);
    editor.dispose(); open(); assert.deepEqual(state, expected); assert.equal(writes, 1, 'the opening is filled once');

    const deckMove = structuredClone(expected); deckMove.find(item => item.id === 'f1-mix-b').position[0] += .25;
    saved.set(key, JSON.stringify({ version: 1, catalogRevision: missingTankRevision, items: deckMove }));
    editor.dispose(); open();
    assert.deepEqual(state.find(item => item.id === 'f1-mix-b').position, [18.5, .3, 11], 'a move that stays on the deck is not reset');

    editor.dispose(); const container = open(), nodes = [];
    const visit = node => { nodes.push(node); node.children.forEach(visit); }; visit(container);
    nodes.find(node => node.textContent === '배치 편집').click();
    const file = nodes.find(node => node.type === 'file');
    file.files = [{ size: 1500, text: async () => JSON.stringify({ version: 1, catalogRevision: missingTankRevision, items: browser }) }];
    await file.listeners.get('change')();
    assert.deepEqual(state, browser, 'an explicit import of the old file is still honoured');
    editor.dispose(); open(); assert.deepEqual(state, browser, 'and survives reopening under this release');
  } finally { editor?.dispose(); globalThis.window = previousWindow; }
});

test('editor startup persists the preparation correction once and reopening preserves later imports and user edits', async () => {
  const key = 'dryer-facility-layout-v1', previousWindow = globalThis.window;
  const reviewed = { id: 'reviewed-other-floor', floor: 3, position: [7, 7.3, 6], rotation: 0, previousPlacements: [{ position: [-5, 7.3, -4], rotation: 0 }] };
  const catalog = [...tanks, reviewed], retained = { id: reviewed.id, position: [-5, 7.3, -4], rotation: 0 };
  const original = [...oldLayout(true), retained], saved = new Map([[key, JSON.stringify({ version: 1, catalogRevision: oldRevision, items: original })]]);
  let state = [], writes = 0, editor;
  const doc = { createElement(tag) { return new EditorNode(tag, this); } }; doc.body = new EditorNode('body', doc);
  const scene = { getLayout: () => structuredClone(state), setLayout(layout) { state = structuredClone(layout); return true; }, setPlacementMode() {}, setView() {} };
  const open = () => { const container = new EditorNode('div', doc); editor = createLayoutEditor({ scene, equipment: catalog, container }); return container; };
  try {
    globalThis.window = { localStorage: { getItem: name => saved.get(name), setItem(name, value) { writes++; saved.set(name, value); } } };
    open();
    assert.deepEqual(state.slice(0, tanks.length), tanks.map(pose));
    assert.deepEqual(state.at(-1), retained, 'reviewed numeric-floor migrations stay disabled while the new item-specific preparation correction runs');
    assert.equal(JSON.parse(saved.get(key)).catalogRevision, currentRevision); assert.equal(writes, 1);
    editor.dispose(); open(); assert.equal(writes, 1, 'the corrected current release does not migrate or save a second time');
    editor.dispose(); const container = open(), nodes = [];
    const visit = node => { nodes.push(node); node.children.forEach(visit); }; visit(container);
    nodes.find(node => node.textContent === '배치 편집').click();
    const file = nodes.find(node => node.type === 'file');
    file.files = [{ size: 1500, text: async () => JSON.stringify({ version: 1, catalogRevision: oldRevision, items: original }) }];
    await file.listeners.get('change')();
    assert.deepEqual(state, original, 'an explicitly imported old-looking pose remains intentional');
    assert.equal(writes, 2);
    editor.dispose(); open(); assert.deepEqual(state, original); assert.equal(writes, 2);
    const moved = structuredClone(state); moved[0].position[0] += .25; moved[1].rotation = Math.PI / 12;
    saved.set(key, JSON.stringify({ version: 1, catalogRevision: currentRevision, items: moved }));
    editor.dispose(); open();
    assert.deepEqual(state.map(item => item.position), moved.map(item => item.position));
    state.forEach((item, index) => near(item.rotation, moved[index].rotation));
    assert.equal(writes, 2, 'current-release manual moves and turns are not rewritten on load');
  } finally { editor?.dispose(); globalThis.window = previousWindow; }
});

test('upgrading an existing preparation profile preserves its edited LPG office and every previously reviewed area while correcting only exact tank defaults once', async () => {
  const office = CAMPUS_EQUIPMENT.find(item => item.id === 'campus-maintenance-office');
  const reviewed = [
    office,
    { id: 'reviewed-campus-neighbor', floor: 'campus', position: [5, 0, 6], rotation: Math.PI / 2, previousPlacements: [{ position: [1, 0, 2], rotation: 0 }] },
    { id: 'reviewed-outdoor-unit', floor: 'outdoor', position: [35, 0, -1.25], rotation: Math.PI / 2, previousRotation: 0, previousPosition: [36.75, 0, .5] },
    { id: 'reviewed-other-dryer-floor', floor: 3, position: [7, 7.3, 6], rotation: Math.PI / 2, previousPlacements: [{ position: [-5, 7.3, -4], rotation: 0 }] },
  ];
  const preserved = [
    { id: office.id, position: [55, 0, -77], rotation: .25 },
    { id: reviewed[1].id, position: [1, 0, 2], rotation: 0 },
    { id: reviewed[2].id, position: [36.75, 0, .5], rotation: 0 },
    { id: reviewed[3].id, position: [-5, 7.3, -4], rotation: 0 },
  ];
  const key = 'dryer-facility-layout-v1', previousWindow = globalThis.window, catalog = [...tanks, ...reviewed];
  const variants = [oldLayout(false), oldLayout(true), originalOwpLayout(false), originalOwpLayout(true)];
  try {
    for (const variant of variants) {
      const originals = [...variant, ...structuredClone(preserved)], saved = new Map([[key, JSON.stringify({ version: 1, catalogRevision: previousPreparationRevision, items: originals })]]);
      let state = [], writes = 0, editor;
      const doc = { createElement(tag) { return new EditorNode(tag, this); } }; doc.body = new EditorNode('body', doc);
      const scene = { getLayout: () => structuredClone(state), setLayout(layout) { state = structuredClone(layout); return true; }, setPlacementMode() {}, setView() {} };
      const open = () => { const container = new EditorNode('div', doc); editor = createLayoutEditor({ scene, equipment: catalog, container }); return container; };
      globalThis.window = { localStorage: { getItem: name => saved.get(name), setItem(name, value) { writes++; saved.set(name, value); } } };
      try {
        open();
        assert.deepEqual(state.slice(0, tanks.length), tanks.map(pose));
        assert.deepEqual(state.slice(tanks.length).map(item => item.position), preserved.map(item => item.position), 'the edited office and three reviewed areas cannot be relocated');
        state.slice(tanks.length).forEach((item, index) => assert.ok(Math.abs(item.rotation - preserved[index].rotation) < 1e-12));
        assert.equal(JSON.parse(saved.get(key)).catalogRevision, currentRevision); assert.equal(writes, 1);
        const corrected = structuredClone(state);
        editor.dispose(); open(); assert.deepEqual(state, corrected); assert.equal(writes, 1);

        editor.dispose(); const container = open(), nodes = [];
        const visit = node => { nodes.push(node); node.children.forEach(visit); }; visit(container);
        nodes.find(node => node.textContent === '배치 편집').click();
        const file = nodes.find(node => node.type === 'file');
        file.files = [{ size: 2500, text: async () => JSON.stringify({ version: 1, catalogRevision: previousPreparationRevision, items: originals }) }];
        await file.listeners.get('change')();
        assert.deepEqual(state.map(item => item.position), originals.map(item => item.position));
        assert.equal(writes, 2);
        editor.dispose(); open();
        assert.deepEqual(state.map(item => item.position), originals.map(item => item.position), 'an explicit import saved by the completed release cannot be repaired on the next load');
        assert.equal(writes, 2);
      } finally { editor?.dispose(); }
    }
  } finally { globalThis.window = previousWindow; }
});
