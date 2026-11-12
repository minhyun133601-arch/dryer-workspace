import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../apps/shared/vendor/three.module.js';
import { createLiquidModel } from '../apps/site/liquid-models.js';
import { LIQUID_ROOM, LIQUID_ROOMS } from '../apps/site/liquid-data.js';
import { createProximityDoorController } from '../apps/site/proximity-doors.js';

function doorGroups(root) { const groups = []; root.traverse(object => { if (object.name === 'liquid-plan-door') groups.push(object); }); return groups; }
function throughCentre(door) {
  const x = door.userData.openingWidth * .2;
  const start = door.localToWorld(new THREE.Vector3(x, 1.1, 2)), end = door.localToWorld(new THREE.Vector3(x, 1.1, -2));
  return new THREE.Raycaster(start, end.clone().sub(start).normalize(), 0, start.distanceTo(end)).intersectObject(door.parent, true);
}

test('registered liquid doors start closed and open from either side while their fixed frames preserve the passage', () => {
  const source = JSON.stringify(LIQUID_ROOMS), model = createLiquidModel({ rooms: LIQUID_ROOMS, columns: LIQUID_ROOM.columns, detail: false });
  const controller = createProximityDoorController(model.root);
  try {
    model.root.updateMatrixWorld(true);
    const doors = doorGroups(model.environment.structure), registered = LIQUID_ROOMS.filter(room => !room.referenceOnly).flatMap(room => (room.doors || []).map(door => ({ room, door })));
    assert.equal(doors.length, registered.length);
    for (const group of doors) {
      assert.equal(group.userData.registeredOpening, true); assert.equal(group.userData.currentDoorTypeConfirmed, false);
      assert.equal(group.userData.measurementsConfirmed, false); assert.equal(group.userData.openForPassage, false);
      assert.equal(group.userData.proximityOperated, true);
      assert.match(group.userData.geometryBasis, /neutral-illustrative/);
      assert.ok(group.getObjectByName('liquid-door-frame-jamb')); assert.ok(group.getObjectByName('liquid-door-frame-head'));
      assert.ok(group.getObjectByName('liquid-door-low-threshold')); assert.ok(group.getObjectByName('liquid-door-hinge'));
      assert.ok(group.getObjectByName('liquid-door-lever-handle'));
      assert(throughCentre(group).length > 0, 'the default physical leaf closes its registered opening');
      const moving = []; group.traverse(node => { if (node.userData.proximityDoor) moving.push(node); });
      assert(moving.length > 0);
      for (const side of [-1, 1]) {
        const visitor = group.localToWorld(new THREE.Vector3(0, 0, side * .7));
        for (let i = 0; i < 10; i++) controller.update(visitor, .1, { autoOpen: true });
        model.root.updateMatrixWorld(true);
        assert.equal(throughCentre(group).length, 0, 'the opened physical leaves clear the registered passage');
        for (let i = 0; i < 15; i++) controller.update([1000, 0, 1000], .1, { autoOpen: true });
        model.root.updateMatrixWorld(true);
        assert(throughCentre(group).length > 0, 'the leaf closes again after the visitor leaves');
      }
      const p = group.getWorldPosition(new THREE.Vector3()), record = registered.find(({ room, door }) => room.id === group.userData.roomId && Math.hypot(door.position[0] - p.x, door.position[2] - p.z) < .001);
      assert.ok(record, 'door assemblies use only previously registered room opening coordinates');
      assert.ok(Math.abs(record.door.width - group.userData.openingWidth) < 1e-6);
    }
    assert.equal(JSON.stringify(LIQUID_ROOMS), source);
    model.setStructureVisible(false); assert.equal(model.environment.structure.visible, false);
    model.setStructureVisible(true); assert.equal(model.environment.structure.visible, true);
  } finally { controller.dispose(); model.dispose(); }
});

test('wide opening curtains start closed, collect inside their fixed roller header and deduplicate shared door records', () => {
  const line = { start: [-4, 0], end: [4, 0], roomId: 'registered-fixture', height: 4.5, doors: [{ offset: 4, width: 3, height: 3 }] };
  const model = createLiquidModel({ walls: [{ ...line, doors: [] }, { ...line, start: line.end, end: line.start }] });
  const controller = createProximityDoorController(model.root);
  try {
    const doors = doorGroups(model.environment.structure); assert.equal(doors.length, 1);
    const door = doors[0]; assert.equal(door.userData.shutterRaisedAboveOpening, false); assert.equal(door.userData.currentDoorTypeConfirmed, false);
    const header = new THREE.Box3().setFromObject(door.getObjectByName('liquid-door-raised-roller-header'));
    assert.ok(header.min.y > door.userData.openingHeight);
    assert(throughCentre(door).length > 0); assert.equal(door.getObjectByName('liquid-door-neutral-leaf-panel'), undefined);
    const visitor = door.localToWorld(new THREE.Vector3(0, 0, .7));
    for (let i = 0; i < 10; i++) controller.update(visitor, .1, { autoOpen: true });
    model.root.updateMatrixWorld(true);
    assert.equal(throughCentre(door).length, 0);
    const curtain = new THREE.Box3().setFromObject(door.getObjectByName('liquid-door-moving-shutter'));
    assert(header.containsBox(curtain), 'the open curtain stays inside its face-mounted roller housing on all three axes');
    model.setStructureVisible(false); controller.update(visitor, .1, { autoOpen: true });
    const strips = []; door.traverse(node => { if (node.userData.proximityDoor) strips.push(node); });
    assert(strips.every(node => node.position.y === node.userData.proximityDoor.closed), 'hidden structures reset their moving curtain');
  } finally { controller.dispose(); model.dispose(); }
});

test('roller hardware mounts outside a thick lintel and keeps the full passage clear after opening', () => {
  const model = createLiquidModel({ walls: [{ start: [0, -4], end: [0, 4], height: 4.5, thickness: .3, doors: [{ offset: 4, width: 3, height: 3 }] }] });
  const controller = createProximityDoorController(model.root);
  try {
    const door = doorGroups(model.environment.structure)[0], wall = door.parent;
    model.root.updateMatrixWorld(true);
    const localBounds = object => {
      const inverse = wall.matrixWorld.clone().invert(), result = new THREE.Box3();
      object.traverse(mesh => { if (!mesh.isMesh) return; mesh.geometry.computeBoundingBox(); result.union(mesh.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(mesh.matrixWorld))); });
      return result;
    };
    const housing = localBounds(door.getObjectByName('liquid-door-raised-roller-header'));
    assert.ok(housing.min.z >= .15 + .014, 'the cassette back clears the outer face of a 300mm wall');
    const guides = door.children.filter(node => node.name === 'liquid-door-face-mounted-guide');
    assert.equal(guides.length, 2);
    for (const guide of guides) {
      const box = localBounds(guide);
      assert.ok(box.min.z >= .15 - 1e-6, 'guide extrusion is supported on the same wall face');
      assert.ok(box.max.x <= -1.5 + 1e-6 || box.min.x >= 1.5 - 1e-6, 'guide tracks do not narrow the registered opening');
    }
    const plates = door.children.filter(node => node.name === 'liquid-door-header-mounting-plate');
    assert.equal(plates.length, 2);
    for (const plate of plates) {
      const box = localBounds(plate);
      assert.ok(box.min.z <= .15 && box.max.z >= housing.min.z, 'mounting plates bridge the wall face to the cassette back');
    }
    const visitor = door.localToWorld(new THREE.Vector3(0, 0, .8));
    for (let i = 0; i < 10; i++) controller.update(visitor, .1, { autoOpen: true });
    model.root.updateMatrixWorld(true);
    assert.equal(throughCentre(door).length, 0, 'the face-mounted assembly leaves the complete registered doorway open');
    assert.ok(housing.containsBox(localBounds(door.getObjectByName('liquid-door-moving-shutter'))), 'raised strips collect inside the housing, not inside the wall');
  } finally { controller.dispose(); model.dispose(); }
});

test('all added door geometry and material resources are released exactly once', () => {
  const model = createLiquidModel({ rooms: LIQUID_ROOMS, detail: false }), resources = new Map();
  for (const door of doorGroups(model.environment.structure)) door.traverse(object => {
    for (const resource of [object.geometry, object.material].filter(Boolean)) if (!resources.has(resource)) { resources.set(resource, 0); resource.addEventListener('dispose', () => resources.set(resource, resources.get(resource) + 1)); }
  });
  assert.ok(resources.size > 10); model.dispose(); model.dispose(); assert.ok([...resources.values()].every(count => count === 1));
});
