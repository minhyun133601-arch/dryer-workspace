import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../apps/shared/vendor/three.module.js';
import { EQUIPMENT, FLOORS } from '../apps/site/building-data.js';
import { DRYER_BUILDING_FLOORS } from '../apps/site/dryer-building-data.js';
import { buildDryerBuildingEnvironment } from '../apps/site/dryer-building-envelope.js';
import { buildDryerProcessEquipment } from '../apps/site/dryer-process-models.js';
import { validateLayout } from '../apps/site/layout-editor.js';

const items = EQUIPMENT.filter(item => item.dryerRoute?.kind.startsWith('overlook-'));
const packingIds = ['f1-ica-1', 'f1-ica-2', 'f1-ica-3'];
function harness({ mezzanine = false } = {}) {
  const base = new THREE.MeshStandardMaterial(), s = {
    scene: new THREE.Group(), equipment: EQUIPMENT, geometries: new Set(), materials: new Set([base]), mat: new Proxy({}, { get: () => base }),
    _material(color, roughness, metalness, extra = {}) { const m = new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra }); this.materials.add(m); return m; },
    _group(parent, p = [0, 0, 0]) { const group = new THREE.Group(); group.position.set(...p); parent.add(group); return group; },
    _mesh(geometry, material, parent, p = [0, 0, 0]) { const mesh = new THREE.Mesh(geometry, material); this.geometries.add(geometry); mesh.position.set(...p); parent.add(mesh); return mesh; },
    _part(parent) { return this._group(parent); },
  }, roots = new Map();
  for (const item of items) { const root = s._group(s.scene, item.position); root.rotation.y = item.rotation || 0; assert.equal(buildDryerProcessEquipment(s, root, item), true); roots.set(item.id, root); }
  const env = mezzanine ? buildDryerBuildingEnvironment(s, { floor: 2, spec: DRYER_BUILDING_FLOORS[2] }) : null;
  s.scene.updateMatrixWorld(true);
  return { s, roots, env, dispose() { for (const resources of [s.geometries, s.materials]) for (const resource of resources) resource.dispose(); } };
}
function named(root, name) { const results = []; root.traverse(node => { if (node.name === `dryer-process-${name}`) results.push(node); }); return results; }
const box = root => new THREE.Box3().setFromObject(root);
const down = (root, x, z) => new THREE.Raycaster(new THREE.Vector3(x, 7, z), new THREE.Vector3(0, -1, 0), 0, 8).intersectObject(root, true);

test('the overlook reconstructs three roofed transparent packing bays and their real upper feed assemblies without identifying unconfirmed serials', () => {
  const h = harness();
  try {
    assert.equal(items.length, 9, 'existing three packing, three downstream, two conveyor and one arm identities are reused');
    for (const id of packingIds) {
      const item = items.find(item => item.id === id), root = h.roots.get(id);
      assert.equal(item.floor, 1); assert.equal(root.userData.observedRoofedPackingCubicle, true);
      assert.equal(item.dryerRoute.observedCounts.serialNumberConfirmed, false);
      assert.equal(named(root, 'observed-packing-flat-roof').length, 1);
      assert.equal(named(root, 'observed-packing-transparent-door').length, 2);
      assert.equal(named(root, 'observed-packing-flexible-feed-sock').length, 1);
      assert.equal(named(root, id === 'f1-ica-1' ? 'observed-packing-twin-outlet-feed' : 'observed-packing-round-doser').length, 1);
      assert.equal(named(root, 'observed-packing-film-roll').length, 1);
      assert.ok(named(root, 'observed-packing-transparent-side').every(node => node.material.transparent && node.material.opacity >= .3 && node.material.opacity < .5));
      const bounds = box(root);
      assert.ok(bounds.max.y <= .3 + FLOORS.find(floor => floor.id === 1).structureHeight, 'the upper equipment fits the filmed double-height hall');
      assert.ok(bounds.min.x > -8.4 && bounds.max.x < 8.4 && bounds.min.z > -6.5 && bounds.max.z < 3, 'the observed machine and its service geometry remain in the blue-floor production zone');
    }
    for (const id of ['f1-melting', 'f1-mix-a', 'f1-mix-b', 'f1-oil-water', 'f1-s1']) assert.equal(EQUIPMENT.find(item => item.id === id).dryerRoute, undefined, 'the existing surveyed preparation tank registration remains independently owned');
  } finally { h.dispose(); }
});

test('one common stainless service deck spans all three observed bays and remains visible through a real mezzanine void', () => {
  const h = harness({ mezzanine: true });
  try {
    const owners = packingIds.filter(id => h.roots.get(id).userData.sharedPackingPlatformOwner); assert.deepEqual(owners, ['f1-ica-1']);
    const root = h.roots.get(owners[0]), deck = named(root, 'observed-packing-common-service-deck')[0];
    const bounds = box(deck);
    assert.ok(bounds.min.x>-5.3,'the complete service deck stays east of the constant-width observation corridor');
    const firstBody=box(named(h.roots.get('f1-ica-1'),'observed-packing-base')[0]),secondBody=box(named(h.roots.get('f1-ica-2'),'observed-packing-base')[0]);
    assert.ok(secondBody.min.x-firstBody.max.x>1,'the shifted first machine retains usable separation from the second body');
    for (const id of packingIds) {
      const item = items.find(item => item.id === id);
      assert.ok(item.position[0] > bounds.min.x && item.position[0] < bounds.max.x);
      for (const x of id === 'f1-ica-1' ? [-.34, .34] : [0]) assert.equal(down(deck, item.position[0] + x, item.position[2] - 1.75).length, 0, 'each observed feed neck passes through its actual deck opening');
      assert.equal(down(h.env.deck, item.position[0], item.position[2]).length, 0, 'the mezzanine slab cannot cover the observed roofed machines');
      assert.equal(down(h.env.deck, item.position[0], -5.3).length, 0, 'the shared raised service deck stays inside the mezzanine void');
    }
    assert.ok(down(deck, -3, -5.3).length > 0, 'the common walkway exists between the bays');
    assert.equal(named(root, 'observed-packing-service-ladder').length, 1);
    assert.ok(named(root, 'observed-packing-ladder-rung').length >= 9);
    assert.equal(named(h.roots.get('f1-ica-2'), 'observed-packing-common-service-deck').length, 0);
    assert.equal(named(h.roots.get('f1-ica-3'), 'observed-packing-common-service-deck').length, 0);
  } finally { h.dispose(); }
});

test('green-floor rollers retain visible branches and curve while hidden blue-to-green connections remain unmodelled', () => {
  const h = harness();
  try {
    const collector = h.roots.get('f1-conveyor-a'), returning = h.roots.get('f1-conveyor-b');
    assert.equal(named(collector, 'observed-green-roller-branch').length, 2);
    assert.equal(named(returning, 'observed-brown-quarter-roller').length, 1);
    assert.equal(named(returning, 'observed-green-arm-infeed').length, 1);
    for (const root of [collector, returning]) {
      assert.equal(root.userData.hiddenBlueToGreenConnectionConfirmed, false);
      assert.ok(box(root).min.z > 3.25, 'a guessed long transfer line must not cross the Z3 separating wall into the blue-floor hall');
      assert.ok(box(root).min.x >= -8.5 && box(root).max.x <= 16.1 && box(root).max.z < 21.5, 'the observed rollers stay within the external packing hall');
    }
    for (const id of ['f1-xray-1', 'f1-xray-2', 'f1-xray-3']) assert.ok(box(h.roots.get(id)).max.z < 3, 'short downstream inspection units stay beside the blue-floor machines');
  } finally { h.dispose(); }
});

test('the single palletizing robot has a bag fork gripper and yellow guarded roller area instead of the historical pallet lift', () => {
  const h = harness();
  try {
    const root = h.roots.get('f1-palletizer');
    assert.equal(root.userData.observedBlueArticulatedArm, true);
    assert.equal(root.userData.operatingEnvelopeConfirmed, false); assert.equal(root.userData.operatingAnimationAdded, false);
    assert.equal(named(root, 'observed-blue-arm-base').length, 1);
    assert.equal(named(root, 'observed-articulated-arm-joint').length, 3);
    assert.equal(named(root, 'observed-red-vacuum-gripper').length, 0);
    assert.equal(named(root, 'photo-20261126-bag-fork-gripper').length, 1);
    assert.equal(root.userData.palletizingRobotCount, 1);
    assert.ok(named(root, 'observed-yellow-fence-wire').reduce((sum, mesh) => sum + (mesh.isInstancedMesh ? mesh.count : 1), 0) > 50);
    assert.equal(root.userData.observedAlignmentLaneCount, 3);
    for (const number of [1, 2, 3]) assert.equal(named(root, `observed-arm-alignment-lane-${number}`).length, 1);
    assert.equal(named(root, 'pallet-turntable').length, 0);
    assert.ok(box(root).max.x < 16.1 && box(root).max.z < 21.5, 'the arm guard remains west of the preparation hall wall');
  } finally { h.dispose(); }
});

test('overlook placement corrections update only exact prior six defaults once and preserve edits, imports and preparation equipment', () => {
  const prior = [[-5.8, 5.6], [-.8, 5.6], [4.2, 5.6], [-5.8, 10], [-.8, 10], [4.2, 10]], ids = [...packingIds, 'f1-xray-1', 'f1-xray-2', 'f1-xray-3'];
  for (const [index, id] of ids.entries()) {
    const item = items.find(item => item.id === id), old = [prior[index][0], .3, prior[index][1]];
    const payload = (position = old, rotation = 0, stamp = false) => ({ version: 1, catalogRevision: 'preparation-tank-openings-20261112', placementRevisions: stamp ? { [id]: item.placementRevision } : {}, items: [{ id, position, rotation }] });
    const restore = value => validateLayout(value, [item], { migrateDefaults: true, migrateDryerDefaults: false })[0];
    assert.deepEqual(restore(payload()).position, item.position);
    for (const value of [payload([old[0] + .25, .3, old[2]]), payload(old, .2), payload(old, 0, true)]) { const result = restore(value); assert.deepEqual(result.position, value.items[0].position); assert.ok(Math.abs(result.rotation - value.items[0].rotation) < 1e-8); }
    assert.deepEqual(validateLayout(payload(), [item])[0].position, old, 'explicit imports retain their requested whole pose');
  }
  const prep = EQUIPMENT.filter(item => ['f1-melting', 'f1-mix-a', 'f1-mix-b', 'f1-oil-water', 'f1-s1'].includes(item.id));
  const values = prep.map(item => ({ id: item.id, position: [...item.position], rotation: item.rotation || 0 }));
  const result = validateLayout({ version: 1, catalogRevision: 'preparation-tank-openings-20261112', items: values }, prep, { migrateDefaults: true, migrateDryerDefaults: false });
  assert.deepEqual(result, values, 'the overlook release never resets independently registered preparation tanks');
});

test('the wider overlook repairs only the first machine pair at its exact previous defaults once',()=>{
  for(const [id,z]of [['f1-ica-1',-2.5],['f1-xray-1',1]]){
    const item=items.find(value=>value.id===id),old=[-5.5,.3,z];
    const payload=(position=old,rotation=0,stamp='dryer-hall-saved-defaults-20261113')=>({version:1,catalogRevision:'preparation-tank-openings-20261112',placementRevisions:{[id]:stamp},items:[{id,position,rotation}]});
    const restore=value=>validateLayout(value,[item],{migrateDefaults:true,migrateDryerDefaults:false})[0];
    assert.deepEqual(item.position,[-3.5,.3,z]);
    assert.deepEqual(restore(payload()).position,item.position,'the exact earlier default moves east clear of the confirmed corridor');
    for(const value of [payload([-5.25,.3,z]),payload(old,.2),payload(old,0,item.placementRevision)]){
      const actual=restore(value);assert.deepEqual(actual.position,value.items[0].position);assert.ok(Math.abs(actual.rotation-value.items[0].rotation)<1e-8);
    }
    assert.deepEqual(validateLayout(payload(),[item])[0].position,old,'an explicit import keeps its complete requested pose');
    const current=payload(item.position,0,item.placementRevision);assert.deepEqual(restore(current).position,item.position,'a stamped save remains stable');
  }
});
