import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from '../apps/shared/vendor/three.module.js';
import { DRYER_BUILDING_FLOORS } from '../apps/site/dryer-building-data.js';
import { buildDryerBuildingEnvironment } from '../apps/site/dryer-building-envelope.js';
import { buildPreparationEnvironment } from '../apps/site/preparation-environment.js';
import { createProximityDoorController } from '../apps/site/proximity-doors.js';
import { EQUIPMENT } from '../apps/site/building-data.js';
import { buildPreparationEquipment } from '../apps/site/preparation-models.js';

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

test('the tank-deck end has only the 1.5F corridor glazing and visible service pipes stay on the equipment side', () => {
  const { environment }=fixture();
  assert.equal(environment.facade.getObjectByName('preparation-tank-deck-observation-wall'),undefined,'no second glass wall parallel to the 1.5F observation window (user-confirmed 2026-11-26)');
  const pipes=environment.ducts.getObjectByName('preparation-tank-deck-exposed-lines');
  assert.ok(new THREE.Box3().setFromObject(pipes).max.z<=18.33);
  const roof=environment.facade.getObjectByName('preparation-console-bay-roof-underside'), sheet=roof.children[0];
  const ray=(x,y,z,dy)=>new THREE.Raycaster(new THREE.Vector3(x,y,z),new THREE.Vector3(0,dy,0)).intersectObject(sheet);
  assert.ok(ray(20.5,4,11.75,1).length,'the folded steel roof is visible when looking up from the console');
  assert.equal(ray(20.5,9,11.75,-1).length,0,'the single-sided roof leaves equipment visible from above');
});

test('the complete raw-shutter opening and both approaches stay free of equipment, supports and parked context', () => {
  const { s, environment } = fixture();
  s._part = (root, name) => { const part = s._group(root); part.name = name; return part; };
  for (const item of EQUIPMENT.filter(item => item.preparation)) {
    const root = s._group(s.scene, item.position); root.name = item.id; root.rotation.y = item.rotation || 0;
    assert(buildPreparationEquipment(s, root, item));
  }
  environment.architectureFixtures.traverse(node => {
    const data = node.userData.proximityDoor;
    if (data) node[data.kind === 'hinge' ? 'rotation' : 'position'][data.axis] = data.open;
  });
  s.scene.updateMatrixWorld(true);
  const curtain = environment.architectureFixtures.getObjectByName('preparation-inner-orange-rapid-door-curtain');
  const center = curtain.localToWorld(new THREE.Vector3(-.28, 0, 0));
  // Full 2.85m curtain width, 2.2m on each side of the actual curtain plane,
  // and continuous standing-person headroom above the walking surface.
  const passage = new THREE.Box3(new THREE.Vector3(center.x - 1.425, center.y + .15, center.z - 2.2), new THREE.Vector3(center.x + 1.425, center.y + 2.1, center.z + 2.2));
  const stair=s.scene.getObjectByName('preparation-platform-access-stair');
  const foot=stair.getWorldPosition(new THREE.Vector3());
  const config=EQUIPMENT.find(item=>item.id==='f1-prep-platform').preparation;
  const landing=stair.localToWorld(new THREE.Vector3(0,config.elevation,config.stairs.run));
  const column=environment.facade.getObjectByName('preparation-console-side-square-column-casing');
  const cabinet=s.scene.getObjectByName('f1-prep-mobile-white-unit'), hopper=s.scene.getObjectByName('f1-prep-bag-dump');
  assert.ok(foot.x>landing.x && foot.z>cabinet.position.z && cabinet.position.z>hopper.position.z,'looking at the back of the console, the stair is left of the cabinet and hopper');
  assert.ok(foot.distanceTo(cabinet.position)<1.4 && cabinet.position.distanceTo(column.getWorldPosition(new THREE.Vector3()))<1.4);
  const stairBounds=new THREE.Box3().setFromObject(stair), cabinetBounds=new THREE.Box3().setFromObject(cabinet), columnBounds=new THREE.Box3().setFromObject(column);
  assert.ok(!stairBounds.intersectsBox(cabinetBounds) && !stairBounds.intersectsBox(columnBounds) && !cabinetBounds.intersectsBox(columnBounds));
  assert.ok(!cabinetBounds.intersectsBox(new THREE.Box3().setFromObject(hopper)));
  const lowerApproach=new THREE.Box3(new THREE.Vector3(foot.x+.1,foot.y+.2,foot.z-.35), new THREE.Vector3(foot.x+2,foot.y+1.85,foot.z+.35));
  const upperApproach=new THREE.Box3(new THREE.Vector3(landing.x-.65,landing.y+.2,landing.z-.35),new THREE.Vector3(landing.x+.1,landing.y+1.6,landing.z+.35));
  const temporary = new THREE.Matrix4(), collisions = [];
  s.scene.traverse(mesh => {
    if (!mesh.isMesh || mesh.material.transparent && mesh.material.opacity < .99) return;
    mesh.geometry.computeBoundingBox();
    for (let i = 0; i < (mesh.isInstancedMesh ? mesh.count : 1); i++) {
      const matrix = mesh.matrixWorld.clone();
      if (mesh.isInstancedMesh) { mesh.getMatrixAt(i, temporary); matrix.multiply(temporary); }
      const bounds = mesh.geometry.boundingBox.clone().applyMatrix4(matrix);
      if (passage.intersectsBox(bounds)) collisions.push(mesh.name || mesh.parent.name || mesh.geometry.type);
      for (const approach of [lowerApproach,upperApproach]) {
        if (!approach.intersectsBox(bounds)) continue;
        // An elbow's bounding box also contains the open space below the
        // overhead run. Check its faces before reporting a blocked approach.
        const triangle=new THREE.Triangle(), positions=mesh.geometry.attributes.position, index=mesh.geometry.index;
        const count=index?.count??positions.count;
        for(let vertex=0;vertex<count;vertex+=3){
          const corners=[triangle.a,triangle.b,triangle.c];
          corners.forEach((corner,k)=>corner.fromBufferAttribute(positions,index?index.getX(vertex+k):vertex+k).applyMatrix4(matrix));
          if(approach.intersectsTriangle(triangle)){collisions.push('stair approach: '+(mesh.name || mesh.parent.name || mesh.geometry.type));break;}
        }
      }
    }
  });
  assert.deepEqual(collisions, [], 'the full opening works without steering a person around a column or movable cabinet');
});

test('the tall entrance cupboards remain outside the air shower and clear its real stair, table and lockers', () => {
  const { environment }=fixture(),root=environment.architectureFixtures;
  const cupboards=root.getObjectByName('preparation-under-stair-tall-cupboards');
  assert.equal(cupboards.userData.observedCount,2);
  const bounds=new THREE.Box3().setFromObject(cupboards);
  assert.ok(bounds.min.z>18.31,'cupboard fronts and handles do not pierce the south air-shower shell');
  for(const name of ['preparation-air-shower-lower-shell-and-nozzles','preparation-entry-folding-table-and-storage-boxes','preparation-under-existing-stair-lockers']){
    assert.ok(!bounds.intersectsBox(new THREE.Box3().setFromObject(root.getObjectByName(name))),`${name} stays separate from the tall cupboards`);
  }
  root.getObjectByName('dryer-building-1-southeast-stair').traverse(node=>{
    if(node.isMesh)assert.ok(!bounds.intersectsBox(new THREE.Box3().setFromObject(node)),`${node.name} does not enter the tall cupboards`);
  });
  const chamber=root.getObjectByName('preparation-air-shower-lower-shell-and-nozzles');
  let nozzles=0;chamber.traverse(node=>{if(node.geometry?.type==='CylinderGeometry'&&node.geometry.parameters.radiusTop===1)nozzles++;});
  assert.ok(nozzles>=36,'the photographed chamber nozzles and their small fittings are retained');
});

test('preparation passage doors start closed with independent proximity-operated leaves and fixed frames', () => {
  const { s, environment } = fixture(), doors = customDoors(environment);
  for (const id of ['raw-exterior', 'raw-inner-shutter', 'air-shower-process', 'air-shower-hygiene', 'sanitation-workroom', 'cip-utility', 'toilet', 'team1-part2']) assert(doors.has(id), id);
  assert.equal(doors.has('corridor-unconfirmed-support'), false, 'the wall-less, non-enterable support door was removed (2026-11-26)');
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
  assert.deepEqual(inner.position.toArray(), [26.6, 0, 4.6]);
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
    ['inner orange shutter', [26.6, 3.9], [26.6, 5.3]],
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

test('the daily and weighing stores connect openly while the fast shutter leads into preparation with a clear approach', () => {
  const { s, spec, environment } = fixture(), doors = customDoors(environment);
  const weighing = spec.rooms.find(room => room.id === 'preparation'), gate = spec.preparationSurvey.doors.find(door => door.id === 'raw-inner-shutter');
  assert.deepEqual(weighing.connectsTo, ['dispensing', 'raw-storage']);
  assert.deepEqual(weighing.doorConnections, ['dispensing']);
  assert.deepEqual(weighing.openConnections, ['raw-storage']);
  assert.deepEqual(spec.rooms.find(room => room.id === 'raw-storage').openConnections, ['preparation']);
  assert.deepEqual(gate.connects, ['preparation', 'dispensing']);
  assert.ok(gate.position[0] - gate.width / 2 > weighing.bounds.minX);
  assert.ok(gate.position[0] + gate.width / 2 < weighing.bounds.maxX, 'the shutter no longer straddles the daily-store divider');
  const south = spec.partitions.find(wall => wall.a[1] === weighing.bounds.maxZ && wall.b[1] === weighing.bounds.maxZ);
  assert.ok(south.openings.some(opening => Math.abs(south.a[0] + opening.offset - gate.position[0]) < 1e-7));
  for (const root of doors.values()) root.traverse(node => {
    const data = node.userData.proximityDoor;
    if (data) node[data.kind === 'hinge' ? 'rotation' : 'position'][data.axis] = data.open;
  });
  s.scene.updateMatrixWorld(true);
  const opaque = [];
  for (const layer of ['structure', 'facade', 'architectureFixtures']) environment[layer].traverse(node => {
    if (node.isMesh && !(node.material.transparent && node.material.opacity < .99)) opaque.push(node);
  });
  const cast = (from, to) => {
    const a = new THREE.Vector3(...from), delta = new THREE.Vector3(...to).sub(a);
    return new THREE.Raycaster(a, delta.clone().normalize(), .001, delta.length()).intersectObjects(opaque, false);
  };
  for (const x of [25.3, 25.6, 26, 26.4, 26.8, 27.2, 27.6, 27.9]) for (const height of [.35, 1.4, 2.2]) for (const reverse of [false, true]) {
    const a = [x, spec.elevation + height, 2.8], b = [x, spec.elevation + height, 6.2];
    const hits = cast(...(reverse ? [b, a] : [a, b]));
    assert.equal(hits.length, 0, `shutter x=${x} h=${height}: ${hits.map(hit => hit.object.parent.name).join(', ')}`);
  }
  assert.equal(spec.partitions.some(wall => Math.abs(wall.a[0] - weighing.bounds.maxX) < 1e-7 && Math.abs(wall.b[0] - weighing.bounds.maxX) < 1e-7 && Math.abs(wall.a[1] - weighing.bounds.minZ) < 1e-7 && Math.abs(wall.b[1] - weighing.bounds.maxZ) < 1e-7), false, 'no architectural divider remains between the two stores');
  assert.equal(environment.facade.getObjectByName('preparation-raw-rooms-high-partition-window'), undefined, 'the removed divider leaves no floating glass or frame');
  for (const z of [-3.3, -2.7, -2, -1, 0, .8, 1.8, 2.6, 2.8, 3.6, 4.25]) for (const height of [.35, 1.4, 2.2, 3.9, 5.7]) {
    const a = [27.95, spec.elevation + height, z], b = [28.45, spec.elevation + height, z];
    assert.equal(cast(a, b).length, 0, `daily-to-weighing boundary is open at z${z}, height${height}`);
    assert.equal(cast(b, a).length, 0, 'the opening also works from the weighing side');
  }
  const northA = [20.2, spec.elevation + 1.4, -4.3], northB = [20.2, spec.elevation + 1.4, -2.9];
  assert.ok(cast(northA, northB).length, 'the northern hall boundary stays solid');
  assert.ok(cast(northB, northA).length, 'the northern wall stays solid from either side');
});

test('the preparation boundary to the boiler room remains a solid wall after all real passage doors open', () => {
  const { s, spec, environment } = fixture();
  const boiler = spec.rooms.find(room => room.id === 'boiler').bounds;
  const boundary = spec.partitions.find(wall => wall.a[0] === boiler.minX && wall.b[0] === boiler.minX && wall.a[1] === boiler.minZ && wall.b[1] === boiler.maxZ);
  assert(boundary, 'the boiler room retains its preparation-side boundary');
  assert.deepEqual(boundary.openings, [], 'user-confirmed solid wall has no inferred doorway');
  const formerThreshold = new THREE.Vector3(boiler.minX, spec.elevation, boiler.minZ + 6.7);
  environment.architectureFixtures.traverse(node => {
    if (node.userData.architecturalDoor) {
      const position = node.getWorldPosition(new THREE.Vector3());
      assert(Math.hypot(position.x - formerThreshold.x, position.z - formerThreshold.z) > .2, 'no door frame remains at the former preparation-to-boiler threshold');
    }
    const data = node.userData.proximityDoor;
    if (data) node[data.kind === 'hinge' ? 'rotation' : 'position'][data.axis] = data.open;
  });
  s.scene.updateMatrixWorld(true);
  for (const [layer, eyeHeight] of [['structure', .35], ['facade', 1.4]]) {
    const from = formerThreshold.clone().add(new THREE.Vector3(-.8, eyeHeight, 0));
    const ray = new THREE.Raycaster(from, new THREE.Vector3(1, 0, 0), .001, 1.6);
    assert(ray.intersectObject(environment[layer], true).length > 0, `${layer}: the removed connection remains blocked with every real door open`);
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
  const sign=root.getObjectByName('preparation-observed-preparation-room-entry-sign');
  assert.equal(sign.userData.label,'조제실');
  assert.equal(sign.userData.sourceReferences[0].clipId,'first-floor-20261113-clip1');
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
  state.view = 'person'; visibility.call(state, THREE);
  assert.equal(environment.deck.visible, true, 'the mezzanine can look down into the actual first-floor hall');
  assert.equal(environment.architectureFixtures.visible, true);
  for (const [floor, view] of [[2, 'top'], [2, 'perspective'], [2, 'aisle'], ['campus', 'person'], [3, 'perspective']]) {
    state.activeFloor = floor; state.view = view; visibility.call(state, THREE);
    const shared = environment.architectureFixtures.children.filter(child => child.userData.stepsRepresentative && child.userData.visibleFloors?.includes(floor));
    for (const [key, root] of Object.entries(environment)) assert.equal(root.visible, key === 'architectureFixtures' && shared.some(child => child.visible));
    for (const child of environment.architectureFixtures.children.filter(child => child.visible)) assert.ok(shared.includes(child), 'the adjoining landing reveals only its shared stair, keeping preparation rooms and doors hidden');
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
