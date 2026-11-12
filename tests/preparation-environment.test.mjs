import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from '../apps/shared/vendor/three.module.js';
import { DRYER_BUILDING_FLOORS } from '../apps/site/dryer-building-data.js';
import { buildDryerBuildingEnvironment } from '../apps/site/dryer-building-envelope.js';
import { buildPreparationEnvironment } from '../apps/site/preparation-environment.js';
import { createProximityDoorController } from '../apps/site/proximity-doors.js';

function fixture() {
  const s = {
    scene: new THREE.Scene(), geometries: new Set(), materials: new Set(),
    _group(parent, position = [0, 0, 0]) { const value = new THREE.Group(); value.position.set(...position); parent.add(value); return value; },
    _material(color, roughness = .7, metalness = .1, extra = {}) { const value = new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra }); this.materials.add(value); return value; },
    _mesh(geometry, material, parent, position = [0, 0, 0]) { const value = new THREE.Mesh(geometry, material); value.position.set(...position); parent.add(value); return value; },
  };
  const spec = DRYER_BUILDING_FLOORS[1];
  const environment = buildDryerBuildingEnvironment(s, { floor: 1, elevation: spec.elevation, spec });
  const originalCoverCount = environment.cover.children.length;
  buildPreparationEnvironment(s, environment, spec);
  s.scene.updateMatrixWorld(true);
  return { s, spec, environment, originalCoverCount };
}

function customDoors(environment) {
  const result = new Map();
  environment.architectureFixtures.traverse(node => { if (node.userData.customArchitecturalDoor) result.set(node.userData.doorId, node); });
  return result;
}

test('preparation passage doors start closed with independent proximity-operated leaves and fixed frames', () => {
  const { s, environment } = fixture(), doors = customDoors(environment);
  for (const id of ['raw-exterior', 'raw-inner-shutter', 'air-shower-process', 'air-shower-hygiene', 'sanitation-workroom', 'cip-utility', 'toilet', 'corridor-unconfirmed-support', 'team1-part2']) assert(doors.has(id), id);
  for (const [id, root] of doors) {
    if (id.startsWith('raw-')) continue;
    assert(new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()).y >= 2.1, `${id}: full-height frame`);
    const leaves = []; root.traverse(node => { if (node.userData.doorLeaf) leaves.push(node); });
    assert(leaves.length >= 1, `${id}: physical leaf`);
    for (const leaf of leaves) {
      assert.equal(leaf.rotation.y, 0, `${id}: default closed`);
      const data = leaf.userData.proximityDoor;
      assert.equal(data.kind, 'hinge'); assert.equal(data.axis, 'y'); assert.equal(data.closed, 0);
      assert(Math.abs(data.open) >= Math.PI * 65 / 180, `${id}: full passage opening`);
      assert.deepEqual(data.trigger, [0, 0, 0], `${id}: fixed frame centre detects both sides`);
      assert.doesNotThrow(() => JSON.stringify(leaf.userData), `${id}: animation metadata is serializable`);
    }
  }
  const inner = doors.get('raw-inner-shutter');
  assert.deepEqual(inner.position.toArray(), [28.6, 0, 4.6]);
  assert.equal(inner.rotation.y, Math.PI / 2);
  for (const id of ['raw-exterior', 'raw-inner-shutter']) {
    const strips = []; doors.get(id).traverse(node => { if (node.userData.proximityDoor?.kind === 'lift') strips.push(node); });
    assert.equal(strips.length, 24, `${id}: complete movable curtain`);
    for (const strip of strips) {
      const data = strip.userData.proximityDoor;
      assert.equal(strip.position.y, data.closed);
      assert(data.open > 2.4 && data.open < 2.8, `${id}: raised curtain collects inside its housing`);
      assert.deepEqual(data.trigger, [strip.position.x, 0, 0]);
      assert.deepEqual(data.normal, [-1, 0, 0], 'rapid curtain width runs along local Z, with its plane normal along local X');
    }
  }
  assert.equal(doors.get('team1-part2').userData.staticLockHardware, true);
  const empty = Object.fromEntries(['deck', 'facade', 'cover', 'structure', 'architectureFixtures', 'ducts'].map(key => [key, new THREE.Group()]));
  assert.equal(buildPreparationEnvironment(s, empty, DRYER_BUILDING_FLOORS[2]), undefined);
  assert(Object.values(empty).every(root => root.children.length === 0));
});

test('entry sightline places disinfection straight ahead, sinks north, stairs south and washroom west of its corridor', () => {
  const { spec, environment } = fixture(), doors = customDoors(environment);
  const entry = doors.get('team1-part2'), process = doors.get('air-shower-process'), hygiene = doors.get('air-shower-hygiene');
  assert.equal(entry.position.z, 17.6); assert.equal(process.position.z, entry.position.z); assert.equal(hygiene.position.z, entry.position.z);
  assert(process.position.x < hygiene.position.x && hygiene.position.x < entry.position.x);
  const basins = [];
  environment.architectureFixtures.traverse(node => { if (node.name === 'preparation-round-handwash-basin') basins.push(node); });
  assert.equal(basins.length, 2);
  for (const basin of basins) { const p = basin.getWorldPosition(new THREE.Vector3()); assert(p.z < entry.position.z); assert(p.x > hygiene.position.x); }
  const stair = environment.architectureFixtures.getObjectByName('dryer-building-1-southeast-stair');
  assert(new THREE.Box3().setFromObject(stair).min.z > entry.position.z);
  const toilet = spec.rooms.find(room => room.id === 'toilet').bounds;
  const corridor = spec.rooms.find(room => room.id === 'entry-corridor').bounds;
  assert.equal(toilet.maxX, corridor.minX);
  assert.deepEqual(doors.get('toilet').position.toArray(), [33.3, 0, 15.2]);
  assert.equal(doors.get('toilet').userData.normal, 'x');
  assert.deepEqual(spec.personStart.position, [33.7, .3, 17.6]);
  assert.equal(spec.personStart.yaw, -Math.PI / 2);
});

test('connected preparation passages open automatically while the unconfirmed support door stays closed', () => {
  const { s, environment } = fixture(), controller = createProximityDoorController(s.scene);
  try {
    for (const [id, root] of customDoors(environment)) {
      const moving = []; root.traverse(node => { if (node.userData.proximityDoor) moving.push(node); });
      assert(moving.length, `${id}: architectural door leaves`);
      const fixedPosition = root.position.clone(), fixedRotation = root.rotation.clone();
      const first = moving[0], threshold = new THREE.Vector3(...first.userData.proximityDoor.trigger);
      for (const side of [-1, 1]) {
        const nearby = threshold.clone().add(new THREE.Vector3(0, 0, side * .6)).applyMatrix4(first.parent.matrixWorld);
        for (let i = 0; i < 10; i++) controller.update(nearby, .1, { autoOpen: true });
        for (const node of moving) {
          const data = node.userData.proximityDoor;
          const actual = node[data.kind === 'hinge' ? 'rotation' : 'position'][data.axis];
          const expected = data.enterable === true ? data.open : data.closed;
          assert(Math.abs(actual - expected) < 1e-6, `${id}: only a connected passage opens from side ${side}`);
        }
        if (moving.every(node => node.userData.proximityDoor.enterable !== true)) {
          controller.toggleNearest(nearby);
          for (let i = 0; i < 10; i++) controller.update(nearby, .1);
          for (const node of moving) {
            const data = node.userData.proximityDoor;
            assert.equal(node[data.kind === 'hinge' ? 'rotation' : 'position'][data.axis], data.closed, `${id}: manual action also leaves an unconfirmed interior closed`);
          }
        }
        for (let i = 0; i < 15; i++) controller.update([100, nearby.y, 100], .1, { autoOpen: true });
        for (const node of moving) {
          const data = node.userData.proximityDoor;
          const actual = node[data.kind === 'hinge' ? 'rotation' : 'position'][data.axis];
          assert(Math.abs(actual - data.closed) < 1e-6, `${id}: closes after departure`);
        }
        assert(root.position.equals(fixedPosition)); assert(root.rotation.equals(fixedRotation));
      }
    }
  } finally { controller.dispose(); }
});

test('opening the movable door leaves clears the filmed routes without moving their frames or partitions', () => {
  const { spec, environment } = fixture(), opaque = [];
  const frames = [...customDoors(environment).values()].map(root => ({ root, position: root.position.clone(), rotation: root.rotation.clone() }));
  environment.architectureFixtures.traverse(node => {
    const data = node.userData.proximityDoor;
    if (data) node[data.kind === 'hinge' ? 'rotation' : 'position'][data.axis] = data.open;
  });
  environment.architectureFixtures.updateWorldMatrix(true, true);
  for (const key of ['facade', 'structure', 'architectureFixtures']) environment[key].traverse(node => {
    if (node.isMesh && !(node.material.transparent && node.material.opacity < .99)) opaque.push(node);
  });
  const segments = [
    ['external raw door', [35, .6], [32, .6]],
    ['daily/weighing connection', [27.5, .8], [29, .8]],
    ['inner orange shutter', [28.6, 3.9], [28.6, 5.3]],
    ['air shower aligned with entry', [27.6, 17.6], [33.7, 17.6]],
    ['northbound washroom corridor', [33.85, 17.6], [33.85, 12.5]],
    ['west-side washroom door', [33.85, 15.2], [32.5, 15.2]],
    ['controlled double glass entry', [34.8, 17.6], [33.7, 17.6]],
    ['sanitation workroom door', [26.6, 18], [26.6, 18.8]],
    ['utility room door', [23.3, 18], [23.3, 19]],
  ];
  for (const [name, a, b] of segments) {
    const from = new THREE.Vector3(a[0], spec.elevation + 1.4, a[1]), to = new THREE.Vector3(b[0], spec.elevation + 1.4, b[1]);
    const delta = to.clone().sub(from), ray = new THREE.Raycaster(from, delta.clone().normalize(), .001, delta.length());
    const hits = ray.intersectObjects(opaque, false);
    assert.equal(hits.length, 0, `${name}: ${hits.map(hit => hit.object.parent.name).join(', ')}`);
  }
  for (const { root, position, rotation } of frames) {
    assert(root.position.equals(position)); assert(root.rotation.equals(rotation));
  }
});

test('filmed sanitation details include the actual cabinet, work table, concave cylinder basins and one air shower', () => {
  const { environment, originalCoverCount } = fixture(), root = environment.architectureFixtures;
  const cabinet = root.getObjectByName('preparation-visible-sterilizing-cabinet');
  assert(cabinet); assert.equal(cabinet.userData.operatingStateUnconfirmed, true);
  assert(new THREE.Box3().setFromObject(cabinet).getSize(new THREE.Vector3()).y > 1.4);
  let rackCount = 0;
  cabinet.traverse(node => { if (node.name === 'preparation-sterilizer-wire-racks') rackCount += node.count; });
  assert(rackCount >= 20);
  assert(root.getObjectByName('preparation-plastic-covered-work-table'));
  assert(root.getObjectByName('preparation-round-work-stool'));
  assert(root.getObjectByName('preparation-office-west-glazed-partition'));
  assert.equal(environment.cover.children.length, originalCoverCount, 'office ceiling must disappear with upper facade in top/3D cutaway');
  let chambers = 0, basins = 0;
  root.traverse(node => {
    if (node.name === 'preparation-air-shower-lower-shell-and-nozzles') chambers++;
    if (node.name === 'preparation-round-handwash-basin') { basins++; assert(node.userData.broadCylinderBody); }
  });
  assert.equal(chambers, 1); assert.equal(basins, 2);
  assert(environment.facade.getObjectByName('preparation-air-shower-upper-shell'));
});

test('actual scene visibility keeps complete custom doors in top/3D, switches upper walls and respects floor/isolation controls', async () => {
  const { s, environment } = fixture();
  const source = await readFile(new URL('../apps/site/scene.js', import.meta.url), 'utf8'), marker = '  _visibility() {';
  let body = source.slice(source.indexOf(marker) + marker.length, source.indexOf('  zoomBy(factor, pointer = null)')).trim();
  assert(body.endsWith('}')); body = body.slice(0, -1);
  const visibility = new Function('THREE', body);
  const routeMarker = '  _dryerRouteContextLevels() {';
  const routeBody = source.slice(source.indexOf(routeMarker) + routeMarker.length, source.indexOf('  _personSupportMeshes()')).trim();
  const routeContext = new Function('FLOORS', routeBody.slice(0, -1));
  const state = {
    ...s, equipment: [], objects: new Map(), locationDisks: new Map(), activeFloor: 1, view: 'top', isolated: false,
    structureEnabled: true, ductsEnabled: true, floorDecks: new Map([[1, environment.deck]]), floorStructures: new Map([[1, environment.structure]]),
    buildingEnvironments: new Map([[1, environment]]), upperEnvironments: new Map(), packagingEnvironments: new Map(),
    outdoor: { ducts: new THREE.Group() }, campus: { ducts: new THREE.Group() }, survey: new THREE.Group(),
    _applyPackagingDisplayOffsets() {}, _updatePersonCamera() {}, _invalidate() {}, getPackagingLevel() { return 'all'; },
    _dryerRouteContextLevels() { return routeContext.call(this, Object.values(DRYER_BUILDING_FLOORS)); },
  };
  for (const view of ['top', 'perspective', 'aisle', 'person']) {
    state.view = view; visibility.call(state, THREE);
    assert.equal(environment.facade.visible, ['aisle', 'person'].includes(view));
    assert.equal(environment.architectureFixtures.visible, true);
    for (const root of customDoors(environment).values()) assert.equal(root.visible, true);
  }
  state.structureEnabled = false; visibility.call(state, THREE);
  assert.equal(environment.architectureFixtures.visible, false); assert.equal(environment.facade.visible, false);
  state.structureEnabled = true; state.ductsEnabled = false; visibility.call(state, THREE);
  assert.equal(environment.ducts.visible, false);
  state.activeFloor = 2;
  for (const view of ['perspective', 'aisle', 'person']) {
    state.view = view; visibility.call(state, THREE);
    assert.equal(environment.deck.visible, true, 'the mezzanine can look down into the actual first-floor hall');
    assert.equal(environment.architectureFixtures.visible, true);
  }
  for (const [floor, view] of [[2, 'top'], ['campus', 'person'], [3, 'perspective']]) {
    state.activeFloor = floor; state.view = view; visibility.call(state, THREE);
    for (const root of Object.values(environment)) assert.equal(root.visible, false);
  }
  state.activeFloor = 1; state.isolated = true; visibility.call(state, THREE);
  for (const root of Object.values(environment)) assert.equal(root.visible, false);
});

test('preparation resources and bounds stay finite and filmed lockers fit below the existing stair', () => {
  const { s, spec, environment } = fixture();
  const additions = Object.values(environment).flatMap(root => root.children.filter(node => node.name.startsWith('preparation-')));
  const bounds = new THREE.Box3();
  for (const root of additions) {
    bounds.union(new THREE.Box3().setFromObject(root));
    root.traverse(node => {
      if (!node.isMesh) return;
      assert(s.geometries.has(node.geometry)); assert(s.materials.has(node.material));
      assert(node.matrixWorld.elements.every(Number.isFinite));
    });
  }
  assert(bounds.min.x >= spec.bounds.minX && bounds.max.x <= spec.bounds.maxX);
  assert(bounds.min.z >= spec.bounds.minZ && bounds.max.z <= spec.bounds.maxZ);
  for (const geometry of s.geometries) for (const value of geometry.attributes.position.array) assert(Number.isFinite(value));
  const toilet = spec.rooms.find(room => room.id === 'toilet').bounds;
  const toiletBounds = new THREE.Box3().setFromObject(environment.architectureFixtures.getObjectByName('preparation-washroom-visible-interior'));
  assert(toiletBounds.min.x >= toilet.minX && toiletBounds.max.x <= toilet.maxX);
  assert(toiletBounds.min.z >= toilet.minZ && toiletBounds.max.z <= toilet.maxZ);
  const lockerBounds = new THREE.Box3().setFromObject(environment.architectureFixtures.getObjectByName('preparation-under-existing-stair-lockers'));
  environment.architectureFixtures.getObjectByName('dryer-building-1-southeast-stair').traverse(node => {
    if (node.isMesh) assert(!new THREE.Box3().setFromObject(node).intersectsBox(lockerBounds), 'locker bank intersects existing stair treads');
  });
});
