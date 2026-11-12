import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../apps/shared/vendor/three.module.js';
import { EQUIPMENT } from '../apps/site/building-data.js';
import { DRYER_UPPER_FLOORS, DRYER_UPPER_OBSERVED_EQUIPMENT } from '../apps/site/dryer-upper-data.js';
import { buildDryerUpperEquipment, buildDryerUpperEnvironment } from '../apps/site/dryer-upper-models.js';
import { buildFurnace } from '../apps/site/furnace-model.js';
import { buildFacilityEquipment } from '../apps/site/facility-models.js';
import { createProximityDoorController } from '../apps/site/proximity-doors.js';

function harness() {
  const s = {
    scene: new THREE.Scene(), parts: [], geometries: new Set(), materials: new Set(), mat: {},
    _material(color, roughness = .55, metalness = .1, extra = {}) { const m = new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra }); this.materials.add(m); return m; },
    _group(parent, position = [0, 0, 0]) { const g = new THREE.Group(); g.position.set(...position); parent.add(g); return g; },
    _mesh(geometry, material, parent, position = [0, 0, 0]) { this.geometries.add(geometry); const m = new THREE.Mesh(geometry, material); m.position.set(...position); parent.add(m); return m; },
    _box(parent, size, position, material) { return this._mesh(new THREE.BoxGeometry(...size), material, parent, position); },
    _cyl(parent, radius, height, position, material, bottom = radius, segments = 32) { return this._mesh(new THREE.CylinderGeometry(radius, bottom, height, segments), material, parent, position); },
    _bar(parent, start, end, radius, material) { const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end), m = this._cyl(parent, radius, a.distanceTo(b), a.clone().add(b).multiplyScalar(.5).toArray(), material, radius, 10); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize()); return m; },
    _ring(parent, radius, y, material, thickness = .025) { const m = this._mesh(new THREE.TorusGeometry(radius, thickness, 6, 64), material, parent, [0, y, 0]); m.rotation.x = Math.PI / 2; return m; },
    _part(root, name, offset, home = [0, 0, 0]) { const group = this._group(root, home); this.parts.push({ root, name, group, home: new THREE.Vector3(...home), offset: new THREE.Vector3(...offset) }); return group; },
    dispose() { this.geometries.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose()); },
  };
  for (const name of ['steel', 'trim', 'dark', 'white', 'black', 'yellow', 'red', 'motor']) s.mat[name] = s._material(0x9fa9a2);
  return s;
}
const bounds = (root) => { root.updateMatrixWorld(true); return new THREE.Box3().setFromObject(root); };
const near = (a, b, tolerance = 1e-5) => assert.ok(Math.abs(a - b) < tolerance, `${a} differs from ${b}`);
const upperItems = EQUIPMENT.filter(item => ['chamber', 'blower', 'heater', 'cyclone-1', 'cyclone-2', 'cyclone-3', 'panel', 'dryer-chamber-upper-well', 'dryer-roof-water-tank', 'dryer-roof-cylindrical-shell', 'dryer-roof-drive'].includes(item.id));

test('upper photographic apparatus has finite, registered geometry and independent selectable assemblies throughout explosion', (t) => {
  const s = harness(), unchanged = JSON.stringify(upperItems), roots = new Map();
  try {
    assert.equal(upperItems.length, 11);
    for (const item of upperItems) {
      const root = s._group(s.scene, item.position); root.userData.equipment = item.id;
      assert.equal(buildDryerUpperEquipment(s, root, item), true, item.id); roots.set(item.id, root);
      const parts = s.parts.filter(part => part.root === root);
      assert.ok(parts.length >= 2, `${item.id} has separately selectable real exterior assemblies`);
      assert.equal(new Set(parts.map(part => part.group)).size, parts.length);
      assert.ok(parts.every(part => part.group.parent === root && part.group.children.length > 0));
      for (const amount of [0, .25, .75, 1]) {
        for (const part of parts) part.group.position.copy(part.home).addScaledVector(part.offset, amount);
        const b = bounds(root); assert.ok([...b.min.toArray(), ...b.max.toArray()].every(Number.isFinite), item.id);
        assert.ok(b.getSize(new THREE.Vector3()).toArray().every(length => length > .1));
      }
      for (const part of parts) part.group.position.copy(part.home);
    }
    let draws = 0, triangles = 0;
    s.scene.traverse(mesh => {
      if (!mesh.isMesh) return;
      draws++; triangles += (mesh.geometry.index?.count || mesh.geometry.attributes.position.count) / 3 * (mesh.isInstancedMesh ? mesh.count : 1);
      assert.ok(s.geometries.has(mesh.geometry), 'direct instancing and ordinary meshes share scene-owned disposal');
      assert.ok(s.materials.has(mesh.material));
      for (const attribute of ['position', 'normal', 'uv']) assert.ok(mesh.geometry.attributes[attribute].array.every(Number.isFinite), attribute);
    });
    assert.equal(JSON.stringify(upperItems), unchanged, 'builders preserve card/source identities and qualified poses');
    assert.equal(buildDryerUpperEquipment(s, new THREE.Group(), { type: 'unsupported' }), false);
    t.diagnostic(`${roots.size} apparatus groups / ${s.parts.length} assemblies / ${draws} draws / ${Math.round(triangles)} instanced triangles`);
  } finally { s.dispose(); }
});

test('the full photographic burner and qualified roof observations remain distinct from invented device functions', () => {
  const s = harness(), source = harness();
  try {
    const burner = new THREE.Group(), original = new THREE.Group();
    buildDryerUpperEquipment(s, burner, upperItems.find(item => item.id === 'heater')); buildFurnace(source, original);
    assert.equal(s.parts.length, 6); assert.deepEqual(s.parts.map(p => p.name), source.parts.map(p => p.name));
    const actual = bounds(burner), expected = bounds(original);
    actual.min.toArray().forEach((v, i) => near(v, expected.min.toArray()[i])); actual.max.toArray().forEach((v, i) => near(v, expected.max.toArray()[i]));
    assert.ok(actual.max.y > 6.2, 'the real 6F–7F span must not shrink the original photograph model');
    for (const id of ['dryer-roof-water-tank', 'dryer-roof-cylindrical-shell', 'dryer-roof-drive']) {
      const item = upperItems.find(item => item.id === id), root = new THREE.Group(); buildDryerUpperEquipment(s, root, item);
      assert.equal(item.position[1], 32.6, 'roof service area is the same 7F datum, not an added storey');
      if (id.endsWith('water-tank')) assert.deepEqual(root.userData.observedCapacityPlate, { totalTon: 20, fireWaterTon: 9, representsCurrentContents: false });
      else assert.equal(root.userData.functionConfirmed, false, 'an unidentified motor or cylindrical shell needs no guessed process name');
      if (id.endsWith('cylindrical-shell')) assert.equal(root.userData.unitCount, 1, 'multiple video angles must not add duplicated units');
    }
    const blower = new THREE.Group(); buildDryerUpperEquipment(s, blower, upperItems.find(item => item.id === 'blower'));
    assert.equal(blower.userData.unseenImpellerAdded, false);
    assert.ok(s.parts.every(p => !p.name.includes('大')));
  } finally { s.dispose(); source.dispose(); }
});

test('partial upper floors and both four-flight stairs stay open, while historic gable catwalks belong only to the removable roof cover', () => {
  const s = harness();
  try {
    const env = new Map();
    for (const floor of [6, 7, 8]) { const data = DRYER_UPPER_FLOORS[floor]; env.set(floor, buildDryerUpperEnvironment(s, { floor, elevation: data.elevation, profile: data.roofProfile, chamberOpening: data.chamberOpening })); }
    s.scene.updateMatrixWorld(true);
    const cast = (root, x, z) => new THREE.Raycaster(new THREE.Vector3(x, 50, z), new THREE.Vector3(0, -1, 0), 0, 40).intersectObject(root, true);
    for (const level of [6, 7]) assert.equal(cast(env.get(level).deck, -1, 7.5).length, 0, `the ${level}F chamber opening is not a painted circle`);
    assert.equal(cast(env.get(7).deck, 0, -2).length, 0, 'middle OPEN is not a solid upper slab');
    assert.equal(cast(env.get(7).deck, 6.5, 6.5).length, 0, 'the upper internal stair head remains open');
    assert.equal(cast(env.get(8).deck, 11, -10).length, 0, 'the exterior stair head is not blocked by the service slab');
    assert.equal(cast(env.get(8).deck, 0, 0).length, 0, 'only the observed apron is flat; the main roof remains pitched');
    for (const floor of [6, 8]) {
      const stair = env.get(floor).stairs; assert.equal(stair.userData.observedFlights, 4);
      near(stair.userData.fromY, 26.2); near(stair.userData.toY, 32.6);
      assert.equal(stair.userData.stepCountBasis, 'representative-unmeasured');
      const b = bounds(stair); assert.ok(b.min.y < 26.4 && b.max.y > 33.6, 'flights physically connect both datums and have handrails');
    }
    assert.ok(env.get(6).facade.children.length > 15, 'opaque facades are independent from the retained frame');
    assert.ok(env.get(6).structure.children.length > 15);
    const cover = env.get(8).cover, b = bounds(cover); near(b.min.y, 32.6); assert.ok(b.max.y > 40.4);
    const walk = cover.getObjectByName('dryer-historical-roof-L-catwalk'); assert.ok(walk);
    assert.equal(walk.parent, cover); assert.equal(walk.userData.basis, 'historical-A018/A033;not-current-asbuilt');
    assert.equal(walk.userData.currentVideoObserved, false); assert.deepEqual(walk.userData.widths, [1, .75]); near(walk.userData.guardHeight, 1.2);
    for (const floor of [6, 7]) assert.equal(env.get(floor).cover.getObjectByName(walk.name), undefined);
    const registered = new Set(); s.scene.traverse(object => { if (object.geometry) { assert.ok(s.geometries.has(object.geometry)); registered.add(object.geometry); } });
    const released = new Map([...registered].map(g => [g, 0])); for (const g of registered) g.addEventListener('dispose', () => released.set(g, released.get(g) + 1));
    s.dispose(); assert.ok([...released.values()].every(count => count === 1));
  } finally { /* Each scene-owned resource is released once above. */ }
});

test('the confirmed elevator room separates its cutaway envelope, fixed electrical cabinets and photographic drive assemblies', (t) => {
  const s = harness();
  try {
    const item = upperItems.find(item => item.id === 'dryer-roof-drive'), drive = s._group(s.scene, item.position);
    buildDryerUpperEquipment(s, drive, item);
    assert.equal(drive.userData.roomUse, 'elevator-machine-room'); assert.equal(drive.userData.roomUseConfirmed, true);
    assert.equal(drive.userData.driveTypeConfirmed, false, 'the user confirmed the room use, not the hidden drive type or manufacturer');
    for (const name of ['elevator-visible-motor-body', 'elevator-motor-radial-vent', 'elevator-motor-lifting-eye', 'elevator-open-spoked-wheel', 'elevator-yellow-faceted-guard']) assert.ok(drive.getObjectByName(name), name);
    const wheel = drive.getObjectByName('elevator-open-spoked-wheel');
    assert.ok(!wheel.children.some(mesh => mesh.geometry?.type === 'CylinderGeometry' && mesh.geometry.parameters.radiusTop > .2), 'large spoke apertures remain genuinely open, without a solid wheel disk');
    const size = bounds(drive).getSize(new THREE.Vector3()); assert.ok(size.x < 2.5 && size.z < 1.85 && size.y < 2.2, 'observed exterior detail remains within its approximate machine footprint');
    const data = DRYER_UPPER_FLOORS[8], env = buildDryerUpperEnvironment(s, { floor: 8, elevation: data.elevation, profile: data.roofProfile });
    assert.equal(env.machineRoomCover.parent, s.scene); assert.equal(env.machineRoomInterior.parent, s.scene);
    assert.equal(env.machineRoomCover.userData.roomUseConfirmed, true); assert.equal(env.machineRoomCover.userData.dimensionsMeasured, false);
    const doorway = env.machineRoomCover.getObjectByName('elevator-room-perforated-entry-doors'), cabinet = env.machineRoomInterior.getObjectByName('elevator-fixed-open-control-cabinet');
    assert.ok(doorway && cabinet); assert.notEqual(doorway.parent, cabinet.parent, 'the perforated room entry is not the smaller standalone control cabinet');
    const entryLeaves = doorway.children.filter(node => node.userData.proximityDoor);
    assert.equal(entryLeaves.length, 2);
    const doors = createProximityDoorController(doorway), centre = doorway.localToWorld(new THREE.Vector3(0, 0, .6));
    assert.ok(entryLeaves.every(leaf => leaf.rotation.y === 0), 'the room entry starts closed');
    doors.update(centre, .1, { autoOpen: true, reducedMotion: true });
    assert.ok(entryLeaves.every(leaf => Math.abs(leaf.rotation.y) > 1.5), 'both room leaves open together for a nearby person');
    doorway.updateWorldMatrix(true, true);
    const passage = doorway.localToWorld(new THREE.Vector3(0, 1, .5)), inward = new THREE.Vector3(0, 0, -1).transformDirection(doorway.matrixWorld);
    assert.equal(new THREE.Raycaster(passage, inward, 0, 1).intersectObject(doorway, true).length, 0, 'the opened room entry has a clear central passage');
    for (let i = 0; i < 90; i++) doors.update(centre.clone().add(new THREE.Vector3(10, 0, 0)), 1 / 60, { autoOpen: true });
    assert.ok(entryLeaves.every(leaf => leaf.rotation.y === 0));
    doors.dispose();
    assert.equal(cabinet.userData.independentOfDriveAssembly, true); assert.equal(cabinet.userData.internalModuleFunctionsConfirmed, false);
    assert.ok(env.machineRoomInterior.getObjectByName('elevator-small-wall-junction-box'));
    const home = cabinet.position.clone(); for (const part of s.parts) part.group.position.copy(part.home).add(part.offset);
    assert.ok(cabinet.position.equals(home), 'exploding the mechanical drive cannot move the room-mounted cabinets');
    env.machineRoomCover.visible = false;
    assert.equal(env.machineRoomInterior.visible, true); assert.equal(drive.visible, true);
    const coverBounds = bounds(env.machineRoomCover); near(coverBounds.min.y, 32.6); assert.ok(coverBounds.max.y < 35.5);
    for (const floor of [6, 7]) { const d = DRYER_UPPER_FLOORS[floor], other = buildDryerUpperEnvironment(s, { floor, elevation: d.elevation, profile: d.roofProfile }); assert.equal(other.machineRoomCover.children.length, 0); assert.equal(other.machineRoomInterior.children.length, 0); }
    s.scene.traverse(mesh => { if (mesh.isMesh) { assert.ok(s.geometries.has(mesh.geometry)); assert.ok(mesh.geometry.attributes.position.array.every(Number.isFinite)); } });
    t.diagnostic(`elevator drive exterior ${size.toArray().map(v => v.toFixed(3)).join(' × ')}m; room envelope height remains separate from the main gable`);
  } finally { s.dispose(); }
});

test('two observed upper apparatus groups connect only at their visible ports and clear the real well, rails and internal stairs', (t) => {
  const s = harness(), roots = new Map();
  try {
    assert.equal(DRYER_UPPER_OBSERVED_EQUIPMENT.length, 2);
    for (const item of DRYER_UPPER_OBSERVED_EQUIPMENT) {
      const root = s._group(s.scene, item.position); roots.set(item.id, root);
      assert.equal(buildDryerUpperEquipment(s, root, item), true);
      assert.equal(root.userData.observationOnly, true); assert.equal(root.userData.processFunctionConfirmed, false);
      const parts = s.parts.filter(part => part.root === root); assert.equal(parts.length, 3);
      const b = bounds(root);
      assert.ok(b.max.x < 5.8 && b.max.z < 3.8, 'upper equipment clears the internal stair rectangle X5.9–8.1/Z3.8–9.2');
      root.traverse(mesh => {
        if (!mesh.isMesh) return;
        assert.ok(s.geometries.has(mesh.geometry));
        assert.ok(mesh.geometry.attributes.position.array.every(Number.isFinite));
        const local = mesh.geometry.attributes.position, instance = new THREE.Matrix4();
        for (let n = 0; n < (mesh.isInstancedMesh ? mesh.count : 1); n++) {
          const transform = mesh.matrixWorld.clone(); if (mesh.isInstancedMesh) { mesh.getMatrixAt(n, instance); transform.multiply(instance); }
          for (let i = 0; i < local.count; i++) {
            const v = new THREE.Vector3().fromBufferAttribute(local, i).applyMatrix4(transform), dx = v.x + 1, dz = v.z - 7.5, distance = Math.hypot(dx, dz);
            const wellOuter = 4.85 - THREE.MathUtils.clamp((-dz / distance - .75) / .2, 0, 1) * .3;
            assert.ok(distance > wellOuter + .05, `${item.id} intersects the curved well platform at ${v.toArray()}`);
          }
        }
      });
      t.diagnostic(`${item.id}: actual exterior ${b.getSize(new THREE.Vector3()).toArray().map(v => v.toFixed(3)).join(' × ')}m`);
    }
    const duct = roots.get('dryer-upper-duct-run'), housing = roots.get('dryer-upper-tapered-housing');
    const port = (root, key) => root.localToWorld(new THREE.Vector3(...root.userData.ports[key]));
    assert.ok(port(duct, 'right').distanceTo(port(housing, 'left')) < .02, 'only the photographed short exterior connection joins the representative groups');
    const data = DRYER_UPPER_FLOORS[7], env = buildDryerUpperEnvironment(s, { floor: 7, elevation: data.elevation, profile: data.roofProfile, chamberOpening: data.chamberOpening }); s.scene.updateMatrixWorld(true);
    assert.equal(env.ducts.children.length, 0, 'the old environment tube must not duplicate the selectable duct');
    const cast = (x, z) => new THREE.Raycaster(new THREE.Vector3(x, 40, z), new THREE.Vector3(0, -1, 0), 0, 10).intersectObject(env.deck, true);
    assert.ok(cast(0, 2).length > 0, 'the filmed local base supports the new apparatus rather than leaving feet over the middle OPEN');
    assert.equal(cast(-4.4, 2).length, 0, 'the descending elbow has a physical floor opening');
    assert.equal(cast(0, -2).length, 0, 'the local equipment base does not fill the whole middle OPEN');
    const obstacles = [];
    env.structure.traverse(mesh => {
      if (!mesh.isMesh) return;
      const b = bounds(mesh); if (b.max.y < 32.7) return;
      for (const [id, root] of roots) assert.equal(b.intersectsBox(bounds(root)), false, `${id} intersects an upper guard/rail`);
      obstacles.push(mesh);
    });
    assert.ok(obstacles.length > 10);
  } finally { s.dispose(); }
});

test('the historical recovery group restores three continuous cyclone cones and four exterior drive/outlet trains', (t) => {
  const s = harness(), item = EQUIPMENT.find(item => item.id === 'f5-powder-recovery'), unchanged = JSON.stringify(item);
  try {
    const root = s._group(s.scene, item.position); assert.equal(buildFacilityEquipment(s, root, item), true);
    assert.equal(s.parts.length, 4); assert.equal(root.userData.coneCount, 3); assert.equal(root.userData.driveTrainCount, 4);
    assert.equal(root.userData.sourceBasis, 'historical-OWP-floor5-7;not-current-asbuilt'); assert.equal(root.userData.currentVideoCountConfirmed, false);
    const cones = [], trains = [], motors = [], outlets = [];
    root.traverse(mesh => {
      if (mesh.name === 'dryer-recovery-long-cone') cones.push(mesh);
      if (mesh.name === 'dryer-recovery-drive-train') trains.push(mesh);
      if (mesh.name === 'dryer-recovery-visible-motor') motors.push(mesh);
      if (mesh.name === 'dryer-recovery-box-outlet') outlets.push(mesh);
      if (mesh.isMesh) { assert.ok(s.geometries.has(mesh.geometry)); assert.ok(mesh.geometry.attributes.position.array.every(Number.isFinite)); }
    });
    assert.equal(cones.length, 3); assert.equal(trains.length, 4); assert.equal(motors.length, 4); assert.equal(outlets.length, 4);
    root.updateMatrixWorld(true);
    for (const cone of cones) {
      const p = cone.getWorldPosition(new THREE.Vector3()), upper = upperItems.find(item => item.type === 'cyclone' && Math.abs(item.position[2] - p.z) < .01), b = bounds(cone);
      assert.ok(upper); near(p.x, upper.position[0]); near(b.max.y, upper.position[1]); near(b.min.y, 22.4);
      near(cone.geometry.parameters.radiusTop, upper.radius); near(cone.geometry.parameters.radiusBottom, .25);
    }
    const main = trains.find(train => train.userData.station === 'main-chamber'), p = main.getWorldPosition(new THREE.Vector3()), chamber = EQUIPMENT.find(item => item.id === 'f5-dryer-cone');
    near(p.x, chamber.position[0]); near(p.z, chamber.position[2]);
    const existingNeck = root.userData.mainChamberConnection.existingNeckRange, mainTop = bounds(main).max.y - item.position[1];
    assert.ok(mainTop >= existingNeck[0] && mainTop < existingNeck[1], 'the compact main train meets the current lower-chamber neck without floating below it');
    assert.ok(bounds(root).min.y >= item.position[1] - .001);
    const start = bounds(root); for (const part of s.parts) part.group.position.copy(part.home).addScaledVector(part.offset, .8);
    const exploded = bounds(root); assert.ok([...exploded.min.toArray(), ...exploded.max.toArray()].every(Number.isFinite)); assert.ok(exploded.getSize(new THREE.Vector3()).length() > start.getSize(new THREE.Vector3()).length());
    assert.equal(JSON.stringify(item), unchanged); assert.ok(trains.every(train => train.userData.concealedRotorAdded === false));
    t.diagnostic(`3 historic cones join the 6F cylinders at Y26.2; 4th train joins the existing main-chamber neck at X${p.x.toFixed(1)}/Z${p.z.toFixed(1)}`);
  } finally { s.dispose(); }
});
