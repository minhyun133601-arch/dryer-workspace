import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import * as THREE from '../apps/shared/vendor/three.module.js';
import { CAMPUS_ROOM, CAMPUS_EQUIPMENT } from '../apps/site/campus-data.js';
import { OUTDOOR_ROOM, OUTDOOR_EQUIPMENT } from '../apps/site/outdoor-data.js';
import { PACKAGING_ROOM } from '../apps/site/packaging-data.js';
import { floorElevation } from '../apps/site/facility-data.js';
import { buildCampusEnvironment, buildCampusEquipment } from '../apps/site/campus-models.js';
import { createProximityDoorController } from '../apps/site/proximity-doors.js';
import { isRetainedEvidenceImage } from '../apps/site/evidence-assets.js';
import { PLACEMENT_REGIONS, constrainPlacement, fromRoomPosition, toRoomPosition } from '../apps/site/placement-rules.js';

async function sceneHarness() {
  const source = (await readFile(new URL('../apps/site/scene.js', import.meta.url), 'utf8'))
    .replace(/^import .*;\r?\n/gm, '').replace(/^export\s+(?=(?:function|class|const|let)\b)/gm, '');
  const context = vm.createContext({ THREE, CAMPUS_ROOM, OUTDOOR_ROOM, PACKAGING_ROOM, floorElevation, PLACEMENT_REGIONS, constrainPlacement, fromRoomPosition, toRoomPosition, setTimeout, clearTimeout });
  new vm.Script(`${source}\nglobalThis.FacilityScene = FacilityScene;`).runInContext(context);
  const material = new THREE.MeshBasicMaterial();
  const scene = Object.create(context.FacilityScene.prototype);
  let viewport = { width: 1100, height: 760 };
  Object.assign(scene, {
    scene: new THREE.Group(), parts: [], objects: new Map(),
    equipment: CAMPUS_EQUIPMENT.map((item) => ({ ...item, position: [...item.position] })),
    campusMaterials: null,
    outdoorMaterials: new Proxy({}, { get: () => material }),
    mat: new Proxy({}, { get: () => material }),
    geometries: new Set(), materials: new Set(), textures: new Set(), locationDisks: new Map(),
    placementDefaults: new Map(CAMPUS_EQUIPMENT.map((item) => [item.id, item])), placementResults: new Map(), placementFootprints: new Map(),
    canvas: { style: {}, dataset: {}, parentElement: { getBoundingClientRect: () => viewport } },
    renderer: { setSize() {} }, activeFloor: 'campus', view: 'perspective', selected: null,
    camera: new THREE.PerspectiveCamera(42, 1, .1, 1000), topCamera: new THREE.OrthographicCamera(-18, 18, 18, -18, .1, 300),
    target: new THREE.Vector3(), goalTarget: new THREE.Vector3(), orbit: { azimuth: .65, elevation: .68, distance: 270 }, goalOrbit: {},
    selectionRing: { visible: false, position: new THREE.Vector3(), scale: new THREE.Vector3() },
    onViewChange() {}, _invalidate() {}, _placementGuide() {}, _groundText() {}, labels: [],
    structureEnabled: true, ductsEnabled: true, surveyEnabled: false, isolated: false, amount: 0, explosion: 0,
    _material(color, roughness, metalness, extra = {}) { const mat = new THREE.MeshBasicMaterial({ color, ...extra }); this.materials.add(mat); return mat; },
    _group(parent, position = [0, 0, 0]) { const group = new THREE.Group(); group.position.set(...position); parent.add(group); return group; },
    _mesh(geometry, mat, parent, position = [0, 0, 0]) { const mesh = new THREE.Mesh(geometry, mat); mesh.position.set(...position); parent.add(mesh); return mesh; },
    _box(parent, size, position, mat) { return this._mesh(new THREE.BoxGeometry(...size), mat, parent, position); },
    _cyl(parent, radius, height, position, mat, bottom = radius, segments = 48) { return this._mesh(new THREE.CylinderGeometry(radius, bottom, height, segments), mat, parent, position); },
    _part(root, name, offset, position = [0, 0, 0]) {
      const group = this._group(root, position); this.parts.push({ root, name, group, home: group.position.clone(), offset: new THREE.Vector3(...offset) }); return group;
    },
  });
  scene.topCamera.up.set(0, 0, -1);
  scene.campus = buildCampusEnvironment(scene);
  for (const item of scene.equipment) {
    const root = scene._group(scene.scene, item.position); root.rotation.y = item.rotation;
    root.userData.equipment = item.id; scene.objects.set(item.id, root);
    assert.equal(buildCampusEquipment(scene, root, item), true, item.id);
  }
  scene.scene.updateMatrixWorld(true); scene._placementFootprints();
  scene.floorDecks = new Map([['campus', scene.campus.deck], [7, new THREE.Group()], ['outdoor', new THREE.Group()]]);
  scene.floorStructures = new Map([['campus', scene.campus.structure], [7, new THREE.Group()], ['outdoor', new THREE.Group()]]);
  scene.ducts = new THREE.Group(); scene.outdoor = { ducts: new THREE.Group() }; scene.survey = new THREE.Group();
  return { scene, resize(width, height) { viewport = { width, height }; scene.resize(); }, dispose() {
    const geometries = new Set(); scene.scene.traverse((mesh) => { if (mesh.geometry) geometries.add(mesh.geometry); });
    geometries.forEach((geometry) => geometry.dispose()); scene.materials.forEach((mat) => mat.dispose()); scene.textures.forEach((texture) => texture.dispose()); material.dispose();
  } };
}

function meshCorners(root) {
  const corners = [];
  root.updateMatrixWorld(true);
  root.traverse((mesh) => {
    if (!mesh.isMesh) return;
    // setFromObject honors each InstancedMesh's actual instance transforms.
    const box = new THREE.Box3().setFromObject(mesh);
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) corners.push(new THREE.Vector3(x, y, z));
  });
  return corners;
}

function settledCamera(scene) {
  scene.target.copy(scene.goalTarget); Object.assign(scene.orbit, scene.goalOrbit); scene._updateCamera(); return scene._currentCamera();
}

function meshWorldBoxes(root) {
  const result = [];
  root.updateMatrixWorld(true);
  root.traverse((mesh) => {
    if (!mesh.isMesh) return;
    mesh.geometry.computeBoundingBox();
    if (!mesh.isInstancedMesh) {
      result.push({ mesh, matrix: mesh.matrixWorld.clone(), bounds: mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld) });
      return;
    }
    // A group's overall AABB can cover the gate gap even when none of its
    // actual posts or parked cars occupy it. Check every placed instance.
    const instance = new THREE.Matrix4();
    for (let index = 0; index < mesh.count; index++) {
      mesh.getMatrixAt(index, instance);
      const matrix = mesh.matrixWorld.clone().multiply(instance);
      result.push({ mesh, matrix, bounds: mesh.geometry.boundingBox.clone().applyMatrix4(matrix) });
    }
  });
  return result;
}

function assertFits(corners, camera, label) {
  for (const corner of corners) {
    const point = corner.clone().project(camera);
    assert.ok(Math.abs(point.x) <= 1 && Math.abs(point.y) <= 1 && point.z >= -1 && point.z <= 1,
      `${label}: ${corner.toArray()} projects outside the frame at ${point.toArray()}`);
  }
}

test('the actual campus buildings and repeated details fit the yard, editable region and neighboring footprints', async () => {
  const { scene, dispose } = await sceneHarness();
  try {
    const bodies = [];
    let instances = 0;
    scene.scene.traverse((mesh) => { if (mesh.isInstancedMesh) instances += mesh.count; });
    assert.ok(instances > 100, 'the exterior must retain actual repeated windows and yard detail');
    const deck = new THREE.Box3().setFromObject(scene.campus.deck);
    for (const item of scene.equipment) {
      const root = scene.objects.get(item.id), body = scene.parts.find((part) => part.root === root).group;
      const bounds = new THREE.Box3().setFromObject(body), placement = scene._constrainTransform(item, item);
      assert.equal(item.position[1], 0); assert.equal(placement.valid, true, item.id); assert.equal(placement.limited, false, item.id);
      assert.ok(bounds.min.x >= deck.min.x && bounds.max.x <= deck.max.x && bounds.min.z >= deck.min.z && bounds.max.z <= deck.max.z, `${item.id} needs ground under the whole building`);
      for (const corner of meshCorners(root)) assert.ok(corner.toArray().every(Number.isFinite), `${item.id} has non-finite instance geometry`);
      // Connected foundations and the non-convex outdoor apron share ground.
      // Compare the actual above-ground meshes instead of their combined AABB,
      // which otherwise fills the empty space beside the long utility corridor.
      bodies.push({ id: item.id, boxes: meshWorldBoxes(body).filter(({ bounds }) => bounds.max.y > .3) });
    }
    for (let a = 0; a < bodies.length; a++) for (let b = a + 1; b < bodies.length; b++) {
      const first = bodies[a], second = bodies[b];
      const attached = scene.equipment.find(item => item.id === first.id)?.attachedTo === second.id ||
        scene.equipment.find(item => item.id === second.id)?.attachedTo === first.id;
      if (attached) {
        const pair = [first.id, second.id].sort().join('/');
        assert.ok(['campus-boiler-room/campus-dryer-tower', 'campus-packaging-building/campus-team2-rear-access'].includes(pair), 'only the filmed boiler attachment and packaging rear-access facade may share their supporting building');
        continue;
      }
      const overlap = first.boxes.some((a) => second.boxes.some((b) => ['x', 'z'].every((axis) => Math.min(a.bounds.max[axis], b.bounds.max[axis]) - Math.max(a.bounds.min[axis], b.bounds.min[axis]) > .001)));
      assert.equal(overlap, false, `${first.id} must not merge into ${second.id}`);
    }
  } finally { dispose(); }
});

test('the full outdoor corridor shares all 22 actual equipment models, retains a building gap and reaches the office entrance', async () => {
  const { scene, dispose } = await sceneHarness();
  try {
    const item = CAMPUS_EQUIPMENT.find((entry) => entry.id === 'campus-outdoor-area');
    assert.equal(item.roomLink, 'outdoor');
    const root = scene.objects.get(item.id), liquid = CAMPUS_EQUIPMENT.find((entry) => entry.id === 'campus-blue-annex');
    const office = CAMPUS_EQUIPMENT.find((entry) => entry.id === 'campus-office');
    assert.equal(item.width, OUTDOOR_ROOM.length); assert.equal(item.width, 110);
    assert.equal(item.rotation, -Math.PI / 2);
    assert.deepEqual(item.position, [-64.4, 0, -17.5]);
    assert.equal(item.buildingGap.nominalMetres, 3);
    assert.ok(Math.abs((liquid.position[0] - liquid.width / 2) - (office.position[0] - office.width / 2)) < 1e-8, 'liquid and office share the utility-side wall');
    assert.ok(Math.abs(liquid.position[2] + liquid.depth / 2 - (office.position[2] - office.depth / 2)) < 1e-8, 'the liquid and office masses form a continuous long facade');
    assert.equal(scene.parts.filter((part) => part.root === root).length, 3, 'source equipment parts cannot leak into the campus explosion and label lists');
    const sourceChildren = [];
    root.traverse((child) => { if (child.userData.outdoorSourceId) sourceChildren.push(child); });
    assert.deepEqual(sourceChildren.map((child) => child.userData.outdoorSourceId), OUTDOOR_EQUIPMENT.map((entry) => entry.id));
    const liquidBounds = new THREE.Box3(new THREE.Vector3(liquid.position[0] - liquid.width / 2, .31, liquid.position[2] - liquid.depth / 2),
      new THREE.Vector3(liquid.position[0] + liquid.width / 2, liquid.height, liquid.position[2] + liquid.depth / 2));
    const officeBounds = new THREE.Box3(new THREE.Vector3(office.position[0] - office.width / 2, .31, office.position[2] - office.depth / 2),
      new THREE.Vector3(office.position[0] + office.width / 2, office.height, office.position[2] + office.depth / 2));
    for (const child of sourceChildren) {
      const source = OUTDOOR_EQUIPMENT.find((entry) => entry.id === child.userData.outdoorSourceId);
      const local = toRoomPosition(source.position, OUTDOOR_ROOM), centre = child.getWorldPosition(new THREE.Vector3());
      assert.ok(centre.distanceTo(new THREE.Vector3(item.position[0] + .32 - local[2], local[1], item.position[2] - OUTDOOR_ROOM.length / 2 + local[0])) < 1e-7, `${source.id} retains its unscaled room position in the campus frame`);
      const scale = child.getWorldScale(new THREE.Vector3());
      assert.ok(scale.distanceTo(new THREE.Vector3(1, 1, 1)) < 1e-8, `${source.id} cannot be compressed into a miniature proxy`);
      const body = child.children[0];
      for (const { bounds } of meshWorldBoxes(body)) {
        for (const building of [liquidBounds, officeBounds]) {
          const positiveOverlap = ['x', 'y', 'z'].every((axis) => Math.min(bounds.max[axis], building.max[axis]) - Math.max(bounds.min[axis], building.min[axis]) > .001);
          assert.equal(positiveOverlap, false, `${source.id} penetrates the liquid/office building`);
        }
      }
    }
    assert.ok(root.getObjectByName('campus-outdoor-area-pad'));
    assert.ok(root.getObjectByName('campus-outdoor-area-aisle'));
    assert.ok(root.getObjectByName('campus-outdoor-source-outdoor-100rt'));
    assert.ok(root.getObjectByName('campus-outdoor-source-outdoor-pet-ahu'));
    assert.ok(root.getObjectByName('campus-outdoor-source-outdoor-ahu'));
    assert.ok(root.getObjectByName('campus-outdoor-boundary-wall'));
    const entry = root.getObjectByName('campus-outdoor-source-outdoor-100rt');
    assert.ok(new THREE.Box3().setFromObject(entry).max.x > -58 && new THREE.Box3().setFromObject(entry).max.z < liquidBounds.min.z, 'the wide entry tower apron stays before the building corner rather than being squeezed into the narrow aisle');
    const approach = root.getObjectByName('campus-outdoor-office-approach');
    assert.ok(approach && approach.children.length >= 2, 'the corridor end needs a continuous open approach to the existing office front door');
    const approachBounds = new THREE.Box3().setFromObject(approach);
    assert.ok(approachBounds.max.z > officeBounds.max.z && approachBounds.max.x >= office.position[0], 'the end approach rounds the office corner and reaches its front door');
    const ray = new THREE.Raycaster(new THREE.Vector3(item.position[0] - 1.9, 20, item.position[2]), new THREE.Vector3(0, -1, 0));
    assert.ok(ray.intersectObject(root, true).length, 'the open-air location itself needs a physical clickable footprint');
  } finally { dispose(); }
});

test('the relocated outdoor area opens three metres beside both buildings and keeps the entrance approach attached', async () => {
  const { scene, dispose } = await sceneHarness();
  try {
    const item = CAMPUS_EQUIPMENT.find(entry => entry.id === 'campus-outdoor-area'), utility = scene.objects.get(item.id);
    const sourceChildren = [];
    utility.traverse(child => { if (child.userData.outdoorSourceId) sourceChildren.push(child); });
    const utilityBoxes = sourceChildren.flatMap(child => meshWorldBoxes(child)).filter(entry => entry.bounds.max.y > .3);
    const measured = new Map();
    for (const id of ['campus-blue-annex', 'campus-office']) {
      const building = CAMPUS_EQUIPMENT.find(entry => entry.id === id);
      const nominalWestWall = building.position[0] - building.width / 2;
      assert.ok(Math.abs(nominalWestWall - (item.position[0] + item.depth / 2) - 3) < 1e-8, `${id} keeps the nominal 3m model gap`);
      const buildingBoxes = meshWorldBoxes(scene.objects.get(id)).filter(entry => entry.bounds.max.y > .3);
      let minimum = Infinity;
      for (const one of buildingBoxes) for (const two of utilityBoxes) {
        if (Math.min(one.bounds.max.y, two.bounds.max.y) - Math.max(one.bounds.min.y, two.bounds.min.y) <= .001) continue;
        const x = Math.max(0, one.bounds.min.x - two.bounds.max.x, two.bounds.min.x - one.bounds.max.x);
        const z = Math.max(0, one.bounds.min.z - two.bounds.max.z, two.bounds.min.z - one.bounds.max.z);
        minimum = Math.min(minimum, Math.hypot(x, z));
      }
      measured.set(id, minimum);
    }
    assert.ok(Math.abs(measured.get('campus-blue-annex') - 3.14) < .02, 'actual liquid-side equipment geometry has about 3.14m clearance');
    assert.ok(Math.abs(measured.get('campus-office') - 3.605) < .02, 'actual office-side equipment geometry has about 3.61m clearance');
    assert.deepEqual(item.officeApproach, [[-66.33, 0, 35], [-66.33, 0, 40], [-36, 0, 40], [-36, 0, 37.85]]);
    const approach = utility.getObjectByName('campus-outdoor-office-approach');
    for (const [x, z] of [[-66.33, 36], [-50, 40], [-36, 38]]) {
      const ray = new THREE.Raycaster(new THREE.Vector3(x, 1, z), new THREE.Vector3(0, -1, 0), 0, 2);
      assert.ok(ray.intersectObject(approach, true).length, `the open approach remains physically continuous at ${x},${z}`);
    }
    const boundary = new THREE.Box3().setFromObject(utility.getObjectByName('campus-outdoor-boundary-wall'));
    assert.ok(boundary.min.x > CAMPUS_ROOM.layout.ground.minX, 'moving away from the buildings remains inside the existing campus ground');
    assert.equal(sourceChildren.length, 22); assert.equal(item.width, 110);
  } finally { dispose(); }
});

test('desktop and phone campus cameras include all actual instanced details and retain the whole-yard top fit after resizing', async () => {
  const { scene, resize, dispose } = await sceneHarness();
  try {
    const corners = [...scene.objects.values(), scene.campus.structure, scene.campus.ducts].flatMap(meshCorners);
    for (const [width, height] of [[1100, 760], [390, 520]]) {
      resize(width, height);
      for (const view of ['perspective', 'top']) {
        scene.setView(view); assertFits(view === 'top' ? meshCorners(scene.scene) : corners, settledCamera(scene), `${width}x${height} ${view}`);
      }
    }
    resize(1100, 760); scene.setView('top'); settledCamera(scene);
    resize(390, 520); assertFits(corners, settledCamera(scene), 'resized top view');
    const zoom = scene.topCamera.zoom; scene.zoomBy(1);
    assert.equal(scene.topCamera.zoom, zoom, 'a first zoom action must not jump to the old indoor minimum');
  } finally { dispose(); }
});

test('campus navigation, large-building focus and visibility remain separate from the existing dryer floors', async () => {
  const { scene, resize, dispose } = await sceneHarness();
  try {
    resize(390, 520); scene.sun = new THREE.DirectionalLight();
    scene.setFloor('campus');
    assert.equal(scene.activeFloor, 'campus'); assert.equal(scene.floorDecks.get('campus').visible, true);
    assert.equal(scene.floorDecks.get(7).visible, false); assert.equal(scene.survey.visible, false);
    assert.ok(scene.sun.shadow.camera.right >= 150 && scene.sun.shadow.camera.far >= 500, 'yard shadows need to cover the outer buildings');
    scene.setView('top'); scene._panBy(-10000, -10000);
    const frame = PLACEMENT_REGIONS.campus;
    assert.ok(scene.goalTarget.x > frame.maxX && scene.goalTarget.z > frame.maxZ, 'navigation must reach the outer buildings and entrance edge');
    assert.ok(scene.goalTarget.x > frame.maxX + 10 && scene.goalTarget.z > frame.maxZ + 10, 'camera movement must continue beyond the former placement fence');
    assert.ok(scene.goalTarget.toArray().every(Number.isFinite));
    scene._panBy(10000, 10000);
    assert.ok(scene.goalTarget.toArray().every(Number.isFinite), 'reversing a long pan remains usable and finite');
    const tower = scene.equipment.find((item) => item.id === 'campus-dryer-tower');
    scene.focus(tower.id);
    const bounds = new THREE.Box3().setFromObject(scene.objects.get(tower.id));
    assert.ok(scene.goalOrbit.distance > bounds.getSize(new THREE.Vector3()).length(), 'focus must remain outside the large building');
    scene.labelsEnabled = false; scene.focusPlacement(tower.id);
    assert.equal(scene.selected, tower.id); assert.equal(scene.view, 'top'); assert.equal(scene.labelsEnabled, false);
    assertFits(meshCorners(scene.objects.get(tower.id)), settledCamera(scene), 'asymmetric tower and orange wing placement');
    scene.setFloor('all');
    assert.equal(scene.floorDecks.get('campus').visible, false); assert.equal(scene.floorDecks.get('outdoor').visible, false);
    assert.equal(scene.floorDecks.get(7).visible, true);
    assert.equal(scene.sun.shadow.camera.right, 46); assert.equal(scene.sun.shadow.camera.far, 180);
  } finally { dispose(); }
});

test('the public entrance retains its clear full-width lane, adjacent green-roof guardhouse and usable side parking', async () => {
  const { scene, dispose } = await sceneHarness();
  try {
    const { entrance } = CAMPUS_ROOM.layout;
    const laneMinX = entrance.laneX - entrance.laneWidth / 2;
    const laneMaxX = entrance.laneX + entrance.laneWidth / 2;
    const minZ = Math.min(entrance.fromZ, entrance.toZ), maxZ = Math.max(entrance.fromZ, entrance.toZ);
    const road = scene.scene.getObjectByName('campus-main-entrance-road');
    assert.ok(road, 'the entrance needs its own rendered road surface');
    const roadBounds = new THREE.Box3().setFromObject(road);
    assert.ok(roadBounds.min.x <= laneMinX && roadBounds.max.x >= laneMaxX && roadBounds.min.z <= minZ && roadBounds.max.z >= maxZ, 'the paved lane must reach from the approach to the back of the yard');
    for (const x of [laneMinX + .25, entrance.laneX, laneMaxX - .25]) {
      for (let z = minZ; z <= maxZ; z += 4) {
        const ray = new THREE.Raycaster(new THREE.Vector3(x, 5, z), new THREE.Vector3(0, -1, 0), 0, 6);
        const hit = ray.intersectObject(road, true)[0];
        assert.ok(hit && hit.point.y >= -.1 && hit.point.y < .35, `the driveable road is missing at ${x}, ${z}`);
      }
    }

    // The full-width public approach ends at the recorded cross-lane. Beyond
    // that turn the filmed boiler doors and vestibules border a service road,
    // so a single 10 m road rectangle is not an architectural clearance claim.
    const publicApproachEnd = CAMPUS_ROOM.layout.entranceRoute.crossPassage.maxZ;
    const drivingSpace = new THREE.Box3(new THREE.Vector3(laneMinX + .05, .45, publicApproachEnd), new THREE.Vector3(laneMaxX - .05, 3.2, maxZ));
    const obstacles = meshWorldBoxes(scene.campus.structure);
    for (const root of scene.objects.values()) {
      const body = scene.parts.find((part) => part.root === root)?.group || root;
      obstacles.push(...meshWorldBoxes(body));
    }
    for (const { mesh, bounds } of obstacles) assert.equal(bounds.intersectsBox(drivingSpace), false, `${mesh.name || mesh.parent?.name || 'exterior structure'} obstructs the entrance lane at ${bounds.min.toArray()} → ${bounds.max.toArray()}`);

    const guard = scene.objects.get('campus-guardhouse');
    assert.ok(guard, 'the roadside guardhouse remains selectable and movable');
    const doors = createProximityDoorController(scene.scene);
    for (const name of ['campus-office-entry-leaf', 'campus-guardhouse-entry-leaf', 'campus-packaging-entry-leaf', 'campus-loading-moving-curtain']) {
      const leaf = scene.scene.getObjectByName(name), data = leaf?.userData.proximityDoor;
      assert.ok(data, `${name} retains its architectural door metadata`);
      assert.equal(data.enterable, false, `${name} has no modelled interior connection`);
      const value = () => (data.kind === 'hinge' ? leaf.rotation : leaf.position)[data.axis];
      assert.equal(value(), data.closed);
      const framePosition = leaf.parent.getWorldPosition(new THREE.Vector3());
      const nearby = leaf.parent.localToWorld(new THREE.Vector3(...data.trigger).add(new THREE.Vector3(0, 0, .7)));
      for (let frame = 0; frame < 90; frame++) doors.update(nearby, 1 / 60, { autoOpen: true });
      assert.equal(value(), data.closed, `${name} stays closed on automatic approach to an exterior-only facade`);
      doors.toggleNearest(nearby);
      for (let frame = 0; frame < 90; frame++) doors.update(nearby, 1 / 60);
      assert.equal(value(), data.closed, `${name} cannot be opened with the manual door action`);
      assert.ok(leaf.parent.getWorldPosition(new THREE.Vector3()).equals(framePosition), 'the door frame never follows the moving panel');
      for (let frame = 0; frame < 90; frame++) doors.update(nearby.clone().add(new THREE.Vector3(100, 0, 100)), 1 / 60, { autoOpen: true });
      assert.equal(value(), data.closed);
      if (data.retract) assert.equal(leaf.scale.y, 1);
    }
    doors.dispose(); scene.scene.updateMatrixWorld(true);
    const roof = guard.getObjectByName('campus-guardhouse-green-roof');
    assert.ok(roof, 'the guardhouse needs the green roof visible in the entrance reference');
    const greenRoofMeshes = [];
    roof.traverse((mesh) => { if (mesh.isMesh && mesh.material === scene.campusMaterials.greenRoof) greenRoofMeshes.push(mesh); });
    assert.ok(greenRoofMeshes.length > 0, 'the roof needs rendered green geometry');
    const color = greenRoofMeshes[0].material.color;
    assert.ok(color.g > color.r && color.g > color.b, 'the rendered guardhouse roof must stay green');
    const guardBounds = new THREE.Box3().setFromObject(guard);
    assert.ok(guardBounds.max.x < laneMinX && entrance.gateZ > guardBounds.max.z, 'the guardhouse stays beside and behind the gate without narrowing the lane');
    assert.ok(laneMinX - guardBounds.max.x < 2, 'the re-registered lane runs immediately beside the observed guardhouse rather than leaving a second road-width gap');
    assert.equal(scene.scene.getObjectByName('campus-entry-parked-bus'), undefined, 'the removed bus must not remain hidden in the model');
    for (const id of ['campus-rear-warehouse', 'campus-front-warehouse', 'campus-front-office']) {
      assert.equal(scene.objects.has(id), false, `${id} must not remain selectable or visible`);
      assert.equal(CAMPUS_EQUIPMENT.some((item) => item.id === id), false, `${id} must also leave the catalog`);
    }
    const parking = scene.scene.getObjectByName('campus-side-parking-surface');
    assert.ok(parking, 'the road edge needs the narrow strip used by the diagonal parking');
    const parkingBounds = new THREE.Box3().setFromObject(parking);
    assert.ok(parkingBounds.min.x > laneMaxX && parkingBounds.max.z < guardBounds.min.z, 'diagonal parking follows the road beyond the guardhouse without narrowing the straight approach');
    const side = CAMPUS_ROOM.layout.sideParking;
    assert.ok(parkingBounds.max.x - parkingBounds.min.x <= side.depth + side.width + 2, 'the roadside parking stays a narrow strip rather than a separate rectangular lot');
    const cars = meshWorldBoxes(scene.campus.structure).filter(({ mesh }) => mesh.name === 'campus-side-parking-car-bodies');
    assert.ok(cars.length > 3, 'the side area needs actual parked vehicles rather than only a painted surface');
    const yaw = side.angleDegrees * Math.PI / 180;
    for (const { bounds, matrix } of cars) {
      assert.ok(bounds.min.x >= parkingBounds.min.x && bounds.max.x <= parkingBounds.max.x && bounds.min.z >= parkingBounds.min.z && bounds.max.z <= parkingBounds.max.z, 'diagonally parked cars stay on the roadside strip');
      const position = new THREE.Vector3().setFromMatrixPosition(matrix);
      assert.ok(Math.abs(position.x - side.centerX) < 1e-5, 'all parked cars follow one line along the road');
      assert.ok(position.z >= side.fromZ - 1e-5 && position.z <= side.toZ + 1e-5, 'the single row stays within its road segment');
      assert.ok(Math.abs((position.z - side.fromZ) / side.step - Math.round((position.z - side.fromZ) / side.step)) < 1e-5, 'parked cars use successive roadside stalls');
      const forward = new THREE.Vector3(0, 0, 1).transformDirection(matrix);
      assert.ok(Math.abs(Math.atan2(forward.x, forward.z) - yaw) < 1e-5, 'each rendered car faces diagonally at 45 degrees');
    }
    const diagonalLines = meshWorldBoxes(scene.campus.deck).filter(({ mesh, matrix }) => {
      if (mesh.name !== 'campus-side-parking-lines') return false;
      const x = new THREE.Vector3().setFromMatrixColumn(matrix, 0), z = new THREE.Vector3().setFromMatrixColumn(matrix, 2);
      const direction = x.lengthSq() > z.lengthSq() ? x : z;
      return Math.abs(Math.sin(Math.atan2(direction.x, direction.z) - yaw)) < 1e-5;
    });
    assert.ok(diagonalLines.length > 3, 'the painted stalls must follow the cars diagonally');
    assert.equal(scene.scene.getObjectByName('campus-side-parking-drive-aisles'), undefined, 'the retired multi-row parking aisles must be removed');
    assert.equal(scene.scene.getObjectByName('campus-parking-lines'), undefined, 'the old front-yard parking grid must be removed');
    for (const name of ['campus-entry-fence-posts', 'campus-entry-fence-rails', 'campus-entry-fence-mesh']) {
      const fence = scene.scene.getObjectByName(name);
      assert.ok(fence?.isInstancedMesh && fence.count > 1, `${name} needs the repeated entrance-fence detail`);
    }
    assert.ok(scene.scene.getObjectByName('campus-entry-open-barrier'), 'the barrier remains open beside the driveable gate');
  } finally { dispose(); }
});

test('the Yusan address, approximate registration and local drawing/video evidence are carried by the campus', async () => {
  const location = CAMPUS_ROOM.location;
  assert.equal(location.address, '경상남도 양산시 유산공단7길 45');
  assert.ok(Number.isFinite(location.latitude) && Number.isFinite(location.longitude));
  assert.ok(location.latitude > 35.35 && location.latitude < 35.38 && location.longitude > 129.02 && location.longitude < 129.05, 'the reference belongs to the Yusan factory area');
  assert.match(location.registration, /근사|개략|추정/);
  assert.ok(Math.abs(((location.zAzimuthDegrees - location.xAzimuthDegrees + 360) % 360) - 90) < 1e-8, 'local X and Z need one consistent, orthogonal map registration');
  const siteRoot = await realpath(fileURLToPath(new URL('../apps/site/', import.meta.url)));
  const evidence = new Set([CAMPUS_ROOM.reference, ...(CAMPUS_ROOM.photos || [])]);
  for (const item of CAMPUS_EQUIPMENT) {
    assert.ok(item.photo && item.photos?.length, `${item.id} needs an accessible reference`);
    evidence.add(item.photo); item.photos.forEach((photo) => evidence.add(photo));
  }
  for (const photo of evidence) {
    assert.match(photo, /^\.\//, `campus evidence must stay available locally: ${photo}`);
    if (!isRetainedEvidenceImage(photo)) continue;
    const resolved = path.resolve(siteRoot, photo);
    await access(resolved);
    const relative = path.relative(siteRoot, await realpath(resolved));
    assert.ok(relative && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative), photo);
  }
});

test('the entrance viewpoint follows the same straight lane on desktop, phone and top view without a resize jump', async () => {
  const { scene, resize, dispose } = await sceneHarness();
  const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < .01, `${message}: ${actual} != ${expected}`);
  try {
    const road = CAMPUS_ROOM.layout.entrance;
    const notifications = [];
    scene.onNavigationChange = (value) => notifications.push(value);
    for (const [width, height] of [[1100, 760], [390, 520]]) {
      resize(width, height); scene.setView('aisle');
      const camera = settledCamera(scene);
      close(camera.position.x, road.laneX, 'the entrance camera starts in the lane centre');
      close(camera.position.z, road.fromZ, 'the entrance camera starts at the road approach');
      assert.ok(camera.position.y >= 1.6 && camera.position.y <= 2.1, 'the entrance viewpoint stays at vehicle/walking height');
      for (const progress of [-10, 0, 25, 50, 75, 100, 110]) {
        const clamped = Math.max(0, Math.min(100, progress));
        scene.setCampusProgress(progress); settledCamera(scene);
        close(scene.getCampusProgress(), clamped, 'the slider reads back the actual route progress');
        close(camera.position.x, road.laneX, 'advancing never leaves the straight driveway');
        close(camera.position.z, road.fromZ - (road.fromZ - road.toZ) * clamped / 100, 'the camera follows the complete entrance route');
        assert.equal(notifications.at(-1), clamped);
      }
      scene.setCampusProgress(50); settledCamera(scene);
      const before = camera.position.clone();
      resize(width === 1100 ? 390 : 1100, height === 760 ? 520 : 760); settledCamera(scene);
      close(camera.position.distanceTo(before), 0, 'resizing must not move the camera off the chosen road position');
      close(scene.goalOrbit.distance, 13.8, 'the route lookahead is independent of the viewport fit');
      const target = scene.goalTarget.clone();
      scene.setCampusProgress(NaN);
      assert.ok(scene.goalTarget.equals(target), 'an invalid navigation value leaves the viewpoint unchanged');
    }

    scene.setView('top'); scene.setCampusProgress(25); settledCamera(scene);
    close(scene.topCamera.position.x, road.laneX, 'the top view follows the same lane');
    close(scene.topCamera.position.z, road.fromZ - (road.fromZ - road.toZ) / 4, 'the top view follows the same progress');
    assert.ok(scene.topCamera.zoom >= .85 && !scene.campusTopFit, 'advancing in top view brings the route closer');
    scene.setCampusProgress(100); settledCamera(scene);
    close(scene.topCamera.position.z, road.toZ, 'top navigation reaches the back of the driveway');
    scene.setView('aisle'); scene.setCampusProgress(100); settledCamera(scene);
    close(scene.camera.position.z, road.toZ, 'returning to the entrance view can reach the same endpoint');
    scene.setFloor(7);
    const target = scene.goalTarget.clone();
    scene.setCampusProgress(50);
    assert.ok(scene.goalTarget.equals(target), 'entrance navigation cannot move the indoor floor camera');
  } finally { dispose(); }
});

test('the employee-visible building names, recessed tower rooftop, single readable front mark and clipped guardhouse corner match the selected references', async () => {
  const hadDocument = Object.hasOwn(globalThis, 'document'), originalDocument = globalThis.document;
  const originalLoad = THREE.TextureLoader.prototype.load, loadedImages = [];
  globalThis.document = {};
  THREE.TextureLoader.prototype.load = function (url) { loadedImages.push(url); return new THREE.Texture(); };
  let harness;
  try {
    harness = await sceneHarness();
    const { scene } = harness;
    const names = new Map(CAMPUS_EQUIPMENT.map((item) => [item.id, item.name]));
    assert.equal(names.get('campus-office'), '본관');
    assert.equal(names.get('campus-production'), '물류장');
    assert.equal(names.get('campus-blue-annex'), '액상');
    const item = CAMPUS_EQUIPMENT.find((entry) => entry.id === 'campus-dryer-tower'), tower = scene.objects.get(item.id);
    assert.equal(tower.getObjectByName('campus-tower-orange-roof'), undefined, 'the main tower no longer wears an invented orange gable');
    assert.equal(tower.getObjectByName('campus-tower-low-orange-wing'), undefined, 'the separate packaging building must not remain fused into the dryer tower');
    assert.ok(scene.objects.get('campus-packaging-building')?.getObjectByName('campus-packaging-three-floor-gable'), 'the orange roof belongs to the separately selectable three-floor packaging building');
    const deck = tower.getObjectByName('campus-tower-recessed-roof-deck'), parapet = tower.getObjectByName('campus-tower-open-parapet');
    assert.ok(deck && parapet, 'the selected CG reference needs an open rim around the recessed roof');
    const deckBounds = new THREE.Box3().setFromObject(deck), rimBounds = new THREE.Box3().setFromObject(parapet);
    assert.ok(deckBounds.max.y - deckBounds.min.y < .3 && rimBounds.max.y - deckBounds.max.y > .75, 'a thin flat roof deck sits visibly below the surrounding parapet');
    const centre = deckBounds.getCenter(new THREE.Vector3());
    const ray = new THREE.Raycaster(new THREE.Vector3(centre.x, rimBounds.max.y + 3, centre.z), new THREE.Vector3(0, -1, 0), 0, 6);
    assert.equal(ray.intersectObject(parapet, true).length, 0, 'the middle of the parapet is actually open rather than filled by a roof cap');
    assert.ok(ray.intersectObject(deck, true).length > 0, 'the opening leads to the recessed walking surface');
    const shafts = tower.getObjectByName('campus-tower-three-service-shafts');
    assert.ok(shafts?.isInstancedMesh && shafts.count === 3, 'three separate vertical service structures remain visible beside the front mass');

    const signs = [];
    tower.traverse((mesh) => { if (mesh.name === 'campus-hee-chang-sign' || mesh.name === 'campus-hee-chang-side-sign') signs.push(mesh); });
    assert.equal(signs.length, 1, 'the company mark appears once on the actual front face');
    const sign = signs[0];
    assert.equal(sign.geometry.type, 'PlaneGeometry', 'the SVG is applied to a single front-facing surface');
    assert.ok(sign.position.z > item.depth / 2 && sign.position.y > item.height * .8, 'the large mark sits at the upper front of the tower');
    assert.ok(sign.geometry.parameters.width > item.width * .7, 'the mark remains large enough to read in the factory overview');
    const normal = new THREE.Vector3(0, 0, 1).transformDirection(sign.matrixWorld);
    assert.ok(normal.z > .99, 'the sign faces outwards rather than showing a mirrored rear image');
    const positions = sign.geometry.getAttribute('position'), uv = sign.geometry.getAttribute('uv');
    for (let index = 0; index < positions.count; index++) {
      assert.equal(uv.getX(index), positions.getX(index) < 0 ? 0 : 1, 'the official mark is not mirrored horizontally');
      assert.equal(uv.getY(index), positions.getY(index) < 0 ? 0 : 1, 'the official mark is upright');
    }
    assert.deepEqual(loadedImages, ['./assets/brand/heechang-official-logo.svg']);
    assert.ok(sign.material.map?.isTexture && sign.material.transparent && sign.material.alphaTest > 0, 'the source SVG stays transparent around its lettering');

    const guardItem = CAMPUS_EQUIPMENT.find((entry) => entry.id === 'campus-guardhouse'), guard = scene.objects.get(guardItem.id);
    assert.equal(guardItem.footprint.length, 5);
    const walls = guard.getObjectByName('campus-guardhouse-five-sided-shell'), roof = guard.getObjectByName('campus-guardhouse-five-sided-green-roof');
    assert.ok(walls && roof, 'both the walls and green roof use the five-sided outline');
    const interior = new THREE.Vector3(...guardItem.position);
    // Aerial roof outline, 2019 DWG chamfer and clip001 0:07-0:16 all put the
    // curved glass on the corner facing the driveway (+X) and the yard (-Z).
    const [sx, sz] = guardItem.clippedCorner || [-1, 1];
    assert.deepEqual([sx, sz], [1, -1], 'the curved corner faces the entrance lane and the inner yard');
    const clippedCorner = interior.clone().add(new THREE.Vector3(sx * guardItem.width * .42, 0, sz * guardItem.depth * .42));
    const oppositeCorner = interior.clone().add(new THREE.Vector3(-sx * guardItem.width * .42, 0, -sz * guardItem.depth * .42));
    const down = (point) => new THREE.Raycaster(new THREE.Vector3(point.x, guardItem.height + 3, point.z), new THREE.Vector3(0, -1, 0), 0, 10);
    for (const surface of [walls, roof]) {
      assert.ok(down(interior).intersectObject(surface, true).length > 0, 'the guardhouse retains its usable interior');
      assert.equal(down(clippedCorner).intersectObject(surface, true).length, 0, 'the clipped corner is open in the rendered wall and roof geometry');
      assert.ok(down(oppositeCorner).intersectObject(surface, true).length > 0, 'the street-side outer corner stays square');
    }
    const curved = guard.getObjectByName('campus-guardhouse-video-rounded-corner');
    assert.ok(curved.position.x > 0 && curved.position.z < 0, 'the rendered curved glass follows the clipped corner');
    const whiteEdge = guard.getObjectByName('campus-guardhouse-five-sided-white-parapet');
    const curvedEdge = guard.getObjectByName('campus-guardhouse-curved-white-fascia');
    assert.ok(whiteEdge?.isInstancedMesh && whiteEdge.count === (guardItem.videoRoundedCorner === false ? 5 : 4), 'straight roof edges retain the surveyed outline without duplicating the video-observed curved corner');
    if (guardItem.videoRoundedCorner !== false) assert.ok(curvedEdge, 'the latest entrance video supplies the curved white roof fascia');
  } finally {
    harness?.dispose(); THREE.TextureLoader.prototype.load = originalLoad;
    if (hadDocument) globalThis.document = originalDocument; else delete globalThis.document;
  }
});

test('the tower uses the verified official SVG bytes and preserves the original source receipt', async () => {
  const evidence = JSON.parse(await readFile(new URL('../references/yusan-campus/location-evidence.json', import.meta.url), 'utf8'));
  const source = evidence.official_logo;
  assert.equal(source.url, 'https://www.heechang.com/theme/basic/images/top_logo.svg');
  const organization = JSON.parse(await readFile(new URL('../docs/asset-organization-20261112.json', import.meta.url), 'utf8'));
  const moved = organization.moves.find(entry => entry.originalPath === source.app_local_file);
  assert.ok(moved, 'the historical logo receipt resolves through the recorded asset move');
  const app = await readFile(new URL(`../${moved.currentPath}`, import.meta.url));
  const original = await readFile(new URL(`../${source.local_file}`, import.meta.url));
  assert.deepEqual(app, original, 'the runtime brand asset is an exact copy of the retained official source');
  assert.equal(app.length, 4448); assert.equal(source.bytes, app.length);
  const hash = createHash('sha256').update(app).digest('hex');
  assert.equal(hash, '952b4f4bca7b514acbd239e8fcc38019187423d769b79148950cd4d77a6589f8');
  assert.equal(source.sha256, hash);
});

test('the seven-floor dryer, separate three-floor packaging building and terrace cyclone retain the employee-confirmed height and adjacency', async () => {
  const { scene, dispose } = await sceneHarness();
  try {
    const towerItem = CAMPUS_EQUIPMENT.find((item) => item.id === 'campus-dryer-tower');
    const packagingItem = CAMPUS_EQUIPMENT.find((item) => item.id === 'campus-packaging-building');
    assert.equal(towerItem.floorCount, 7); assert.equal(packagingItem.floorCount, 3);
    assert.equal(towerItem.thirdFloorElevation, towerItem.floorLevels[2]);
    assert.equal(towerItem.floorLevels.length, 7);
    assert.ok(towerItem.floorLevels.every((level, index, levels) => index === 0 || level > levels[index - 1]));
    const floorY = towerItem.thirdFloorElevation, tower = scene.objects.get(towerItem.id), packaging = scene.objects.get(packagingItem.id);
    const terrace = tower.getObjectByName('campus-third-floor-green-terrace');
    const terraceBounds = new THREE.Box3().setFromObject(terrace);
    assert.ok(Math.abs(terraceBounds.max.y - floorY) < 1e-5, 'the green working surface must be at the third-floor level');
    const cyclone = tower.getObjectByName('campus-third-floor-cyclone');
    assert.ok(cyclone, 'the employee-identified cyclone belongs above the third-floor working surface');
    const body = cyclone.getObjectByName('campus-third-floor-cyclone-body'), cone = cyclone.getObjectByName('campus-third-floor-cyclone-cone');
    assert.ok(body && cone && cone.geometry.parameters.radiusTop > cone.geometry.parameters.radiusBottom, 'the cyclone needs a cylindrical body and a downward taper');
    const bodyBounds = new THREE.Box3().setFromObject(body), coneBounds = new THREE.Box3().setFromObject(cone);
    assert.ok(coneBounds.min.y > floorY && bodyBounds.min.y >= coneBounds.max.y - 1e-5, 'the complete cyclone casing is elevated, with its cone beneath the body');
    assert.ok(bodyBounds.min.x >= terraceBounds.min.x && bodyBounds.max.x <= terraceBounds.max.x && bodyBounds.min.z >= terraceBounds.min.z && bodyBounds.max.z <= terraceBounds.max.z, 'the cyclone stands on the terrace rather than on an unrelated floor');
    assert.ok(cyclone.getObjectByName('campus-third-floor-cyclone-upper-frame'), 'the reference shows a square access frame around and above the cyclone');
    assert.ok(tower.getObjectByName('campus-third-floor-cyclone-return-elbow'), 'the upper return pipe retains its visible bend into the service shaft');
    const oldTankParts = [];
    tower.traverse((node) => { if (node.name.startsWith('campus-tank-')) oldTankParts.push(node); });
    assert.equal(oldTankParts.length, 0, 'the incorrect ground-tank interpretation must be removed');
    const windows = tower.getObjectByName('campus-third-floor-service-annex-three-window-rows');
    const observedWindowBoxes = meshWorldBoxes(windows);
    const rows = new Set(observedWindowBoxes.map(({ matrix }) => new THREE.Vector3().setFromMatrixPosition(matrix).y.toFixed(2)));
    assert.equal(rows.size, 2, 'the 11/12 close-up shows separate high and low side-window banks');
    assert.equal(observedWindowBoxes.length, 5, 'three upper banks and two smaller lower banks replace the uniform rows');
    assert.ok(new Set(observedWindowBoxes.map(({ bounds }) => bounds.getSize(new THREE.Vector3()).z.toFixed(2))).size > 1, 'the observed window banks retain their different widths');
    const vents = tower.getObjectByName('campus-third-floor-three-orange-vents');
    assert.ok(vents?.isInstancedMesh && vents.count === 3);
    assert.ok(tower.getObjectByName('campus-third-floor-stair-orange-roof'));
    const dryerBounds = new THREE.Box3().setFromObject(tower.getObjectByName('campus-tower-high-sign-wall'));
    const packagingBounds = new THREE.Box3().setFromObject(packaging.getObjectByName('campus-packaging-three-floor-shell'));
    assert.ok(dryerBounds.min.x - packagingBounds.max.x > .5, 'the orange-roof packaging building stays visibly separate from the seven-floor dryer');
    assert.ok(packaging.getObjectByName('campus-packaging-vertical-stair-glazing'));
  } finally { dispose(); }
});

test('the 11/11 rear re-placement keeps the video order between the dryer back road and the retaining wall', async () => {
  const { scene, dispose } = await sceneHarness();
  try {
    const { parcel, entrance } = CAMPUS_ROOM.layout;
    const frontZ = Math.max(...parcel.map(([, z]) => z)), rearZ = Math.min(...parcel.map(([, z]) => z)), middleZ = (frontZ + rearZ) / 2;
    const rearEdges = parcel.map((a, i) => [a, parcel[(i + 1) % parcel.length]])
      .filter(([a, b]) => Math.abs(b[0] - a[0]) > Math.abs(b[1] - a[1]) && a[1] < middleZ && b[1] < middleZ);
    assert.ok(rearEdges.length >= 3, 'the retaining wall bends with the traced slope foot');
    const wallZ = (x) => { for (const [a, b] of rearEdges) { const lo = Math.min(a[0], b[0]), hi = Math.max(a[0], b[0]); if (x >= lo && x <= hi) return a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]); } return NaN; };
    const wallDistance = (x, z) => Math.min(...rearEdges.map(([a, b]) => {
      const dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
      return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
    }));
    assert.ok(rearZ > -100, 'the rear yard is no longer stretched 35m beyond the video');
    const box = (id) => new THREE.Box3().setFromObject(scene.objects.get(id));
    const tanks = box('campus-process-tank-bank'), dryer = box('campus-dryer-tower'), office = box('campus-maintenance-office');
    // User, 11/11: the green-roof concrete building behind the LPG is the 공무사무실.
    const lpg = box('campus-lpg-bank'), context = office, valve = box('campus-tank-valve-room');
    // Tank bund: backed onto the retaining wall, across the back road from the dryer.
    for (const x of [tanks.min.x, tanks.max.x]) {
      const gap = tanks.min.z - wallZ(x);
      assert.ok(gap > .5 && gap < 4, `the tank bund leaves only the gravel strip to the retaining wall at x=${x.toFixed(1)} (${gap.toFixed(2)}m)`);
    }
    const annexWall = new THREE.Box3().setFromObject(scene.objects.get('campus-dryer-tower').getObjectByName('campus-third-floor-service-annex-body'));
    const bundWall = new THREE.Box3().setFromObject(scene.objects.get('campus-process-tank-bank').getObjectByName('campus-storage-low-containment-curb'));
    const road = annexWall.min.z - bundWall.max.z;
    assert.ok(road > 8 && road < 18, `one back road separates the dryer and the tank bund (${road.toFixed(1)}m)`);
    assert.ok(tanks.min.x < dryer.max.x && tanks.max.x > dryer.max.x - 25, 'the tank bund faces the dryer across that road');
    const bank = scene.objects.get('campus-process-tank-bank');
    assert.deepEqual(bank.userData.labelledVessels, ['야경유 1', '야경유 2']);
    assert.equal(bank.userData.observedVesselCount, 8);
    const curb = bank.getObjectByName('campus-storage-low-containment-curb');
    assert.equal(curb.userData.paints['+z'], 'greenWall', 'the road side of the bund is green');
    assert.equal(curb.userData.paints['-z'], 'white', 'the retaining-wall side of the bund is white');
    // LPG: backed onto the green-roof 공무사무실 and facing the end yard.
    const lpgItem = CAMPUS_EQUIPMENT.find((item) => item.id === 'campus-lpg-bank');
    assert.ok(Math.abs(lpgItem.rotation + Math.PI / 2) < 1e-12, 'the LPG front faces the yard at the end of the back road');
    const back = context.min.x - lpg.max.x;
    assert.ok(back > 0 && back < 2.5, `the green-roof office stands directly behind the LPG vessels (${back.toFixed(2)}m)`);
    const officeRoof = scene.objects.get('campus-maintenance-office').getObjectByName('campus-maintenance-office-roof');
    const roofMaterials = new Set(); officeRoof.traverse((mesh) => { if (mesh.material) roofMaterials.add(mesh.material); });
    assert.ok(roofMaterials.has(scene.campusMaterials.greenRoof), 'the 공무사무실 keeps its green roof');
    assert.equal(scene.objects.get('campus-maintenance-office').userData.exteriorPending, false, 'new footage supplies the LPG-side office facade');
    assert.ok(scene.objects.get('campus-maintenance-office').getObjectByName('campus-exterior-maintenance-workshop-door'));
    assert.ok(scene.objects.get('campus-maintenance-office').getObjectByName('campus-exterior-office-roof-electrical-gantry'));
    assert.equal(scene.campus.structure.getObjectByName('campus-context-rear-concrete-building'), undefined, 'the office is no longer duplicated as an unnamed context mass');
    assert.ok(lpg.max.z < dryer.min.z && lpg.min.z > wallZ((lpg.min.x + lpg.max.x) / 2), 'the LPG stays between the dryer back road and the retaining wall');
    // Recycling room: corrugated shed with the 압축실 plate, backed onto the wall.
    const recycleItem = CAMPUS_EQUIPMENT.find((item) => item.id === 'campus-recycling-room'), recycle = scene.objects.get(recycleItem.id);
    assert.equal(recycle.userData.signText, '압축실');
    const yaw = recycleItem.rotation, [cx, , cz] = recycleItem.position;
    const backCentre = [cx - Math.sin(yaw) * recycleItem.depth / 2, cz - Math.cos(yaw) * recycleItem.depth / 2];
    assert.ok(wallDistance(...backCentre) < .6, `the recycling room backs onto the retaining wall (${wallDistance(...backCentre).toFixed(2)}m)`);
    const doorYard = [cx + Math.sin(yaw) * (recycleItem.depth / 2 + 3), cz + Math.cos(yaw) * (recycleItem.depth / 2 + 3)];
    assert.ok(doorYard[1] > wallZ(doorYard[0]) + 3, 'its door opens into the yard, not into the slope');
    assert.ok(Math.hypot(cx - lpgItem.position[0], cz - lpgItem.position[2]) < 12, 'the recycling room and the LPG share the end yard');
    assert.ok(recycle.getObjectByName('campus-recycling-sorting-bins'), 'the red sorting bins stand beside it along the wall');
    // Nothing from the video is pushed into the slope; the lane stops before the office.
    for (const [id, bounds] of [['campus-process-tank-bank', tanks], ['campus-lpg-bank', lpg], ['campus-maintenance-office', office]]) {
      for (const x of [bounds.min.x, bounds.max.x]) assert.ok(bounds.min.z > wallZ(x), `${id} stays inside the retaining wall`);
    }
    assert.ok(entrance.toZ > tanks.max.z, 'the straight entrance lane ends at the back yard instead of running into the tank bund');
    assert.ok(lpg.max.x < office.min.x && office.max.x < tanks.min.x, 'the order along the back road is LPG → 공무사무실 → tank bund');
    // User: first row = blue room / tank / tank; behind it = 3 + 3 tanks.
    const valveItem = CAMPUS_EQUIPMENT.find((item) => item.id === 'campus-tank-valve-room'), valveRoot = scene.objects.get(valveItem.id);
    assert.equal(valveRoot.userData.unitCount, 1);
    for (const unit of valveItem.units) assert.ok((unit.width || valveItem.width) * unit.depth < 12, 'each prefab is container-sized, not a long office');
    const units = new THREE.Box3().setFromObject(valveRoot.getObjectByName('campus-tank-valve-room-units'));
    assert.ok(units.max.y < 3.2, 'single-storey prefabs');
    assert.ok(units.min.x > tanks.min.x && units.max.x < tanks.max.x && units.min.z > tanks.min.z && units.max.z < tanks.max.z, 'the prefabs sit inside the bund footprint');
    const tankEdge = CAMPUS_EQUIPMENT.find((item) => item.id === 'campus-process-tank-bank');
    const rows = [...new Set(tankEdge.vessels.map(vessel => vessel.z))].sort((a,b) => b-a);
    assert.deepEqual(rows.map(z => tankEdge.vessels.filter(vessel => vessel.z === z).length), [2,3,3]);
    const frontTanks = tankEdge.vessels.filter(vessel => vessel.z === rows[0]);
    assert.ok(Math.abs(valveItem.position[2] - tankEdge.position[2] - rows[0]) < .2, 'the blue room shares the first row');
    assert.ok(units.max.x < tankEdge.position[0] + Math.min(...frontTanks.map(vessel => vessel.x - vessel.radius)), 'blue room / tank / tank from left to right');
    for (const vessel of tankEdge.vessels) {
      const body = bank.getObjectByName(`campus-rear-vessel-${vessel.id}`);
      assert.ok(!units.intersectsBox(new THREE.Box3().setFromObject(body)), `${vessel.id} leaves the room clear`);
    }
    const stair = new THREE.Box3().setFromObject(valveRoot.getObjectByName('campus-tank-valve-room-metal-stair'));
    assert.ok(stair.max.x < units.min.x && stair.max.z < tanks.max.z - .7, 'the stair remains beside the blue room and clear of the road-side bund');
    const landing = new THREE.Box3().setFromObject(valveRoot.getObjectByName('campus-tank-valve-room-stair-landing'));
    const sideBoundaryX = tankEdge.position[0] + tankEdge.bund.bounds.minX;
    assert.ok(landing.min.x < sideBoundaryX - tankEdge.bund.thickness / 2 && landing.max.x > sideBoundaryX + tankEdge.bund.thickness / 2, 'the landing crosses the tank enclosure’s white parking-side boundary instead of the front wall');
    const cabinets = new THREE.Box3().setFromObject(bank.getObjectByName('campus-storage-roadside-control-cabinets'));
    assert.ok(!stair.intersectsBox(cabinets), 'control cabinets leave the stair entrance clear');
    assert.ok(valve.max.y < 3.2);
    // User, 11/11: the old 휴게실 door is only the 생산1팀 2파트 entrance; the
    // break-room door is the back-road glass door. Its old plate says 생산 2팀,
    // but the user confirmed the room is the 1팀 2파트 휴게실.
    const tower = scene.objects.get('campus-dryer-tower');
    const sideEntrance = tower.getObjectByName('campus-exterior-production1-part2-entrance');
    const breakRoom = tower.getObjectByName('rear-survey-rear-breakroom-single-door');
    assert.equal(sideEntrance.userData.name, '생산1팀 2파트 출입구');
    assert.equal(breakRoom.userData.actualDoorLeafCount, 1, 'the new close-up shows one glass leaf rather than the former paired-door assumption');
    assert.equal(breakRoom.getObjectByName('rear-survey-photographed-door-plate').userData.text, '1팀 2파트 휴게실');
    assert.equal(tower.getObjectByName('campus-exterior-production1-part2-break-room'), undefined, 'the superseded rear-door geometry is removed rather than duplicated');
    const doorAt = (node) => new THREE.Vector3().setFromMatrixPosition(node.matrixWorld);
    const facing = (node) => new THREE.Vector3(0, 0, 1).transformDirection(node.matrixWorld);
    assert.ok(facing(sideEntrance).x > .99, 'the entrance stays on the side wall facing the main road');
    assert.ok(facing(breakRoom).z < -.99, 'the break-room door faces the back road');
    assert.ok(Math.abs(doorAt(breakRoom).x - 51) < 1.5, 'the break-room door sits at the video position along the back road');
    assert.ok(doorAt(breakRoom).z < doorAt(sideEntrance).z - 10, 'the break-room door is at the back of the building, not at the side entrance');
  } finally { dispose(); }
});

test('the new rear survey keeps the tall and low glazed bays distinct and adds only the separately filmed packaging HVAC bank', async () => {
  const { scene, dispose } = await sceneHarness();
  try {
    const towerItem = CAMPUS_EQUIPMENT.find(item => item.id === 'campus-dryer-tower'), tower = scene.objects.get(towerItem.id);
    assert.equal(towerItem.rearSurvey.towerRearExtension, 3.6);
    assert.equal(towerItem.thirdFloorElevation, 7.3); assert.equal(towerItem.serviceTerrace.elevation, 7.3);
    assert.equal(towerItem.rearSurvey.dimensionsMeasured, false, 'the revised rear envelope is a video proportion registration');
    for (const [id, height, windowId] of [['high-east-stair-bay', 40.4, 'high-east-stair-glazing'], ['low-west-stair-bay', 13.3, 'low-west-stair-glazing']]) {
      const config = towerItem.rearSurvey.shaftBays.find(bay => bay.id === id), bay = tower.getObjectByName(`campus-rear-${id}`);
      assert.equal(config.height, height); assert.equal(bay.userData.rearSurveyShaft, true);
      assert.equal(bay.userData.measuredDimensions, false); assert.equal(bay.userData.interiorStairsAdded, false);
      const piers = bay.children.filter(mesh => mesh.isMesh && mesh.geometry.parameters?.height === height);
      assert.ok(piers.length >= 4, `${id} has actual full-height front piers and side returns`);
      for (const pier of piers) assert.ok(Math.abs(new THREE.Box3().setFromObject(pier).max.y - height) < 1e-5, `${id} keeps its own exterior wall height`);
      const glass = tower.getObjectByName(`rear-survey-${windowId}`), normal = new THREE.Vector3(0, 0, 1).transformDirection(glass.matrixWorld);
      assert.ok(normal.z < -.99 && glass.getWorldPosition(new THREE.Vector3()).z < -66, 'the glazing faces the real rear road');
    }
    assert.equal(tower.userData.unseenRearStairFlightsAdded, false);
    assert.ok(tower.getObjectByName('campus-tower-reviewed-rear-roof-extension'));
    assert.equal(tower.getObjectByName('rear-survey-rear-closed-stainless-housing').userData.openWashBasinAdded, false);
    assert.equal(tower.getObjectByName('campus-exterior-rear-stainless-wash-tank'), undefined, 'the close-up replaces the old open-basin interpretation');
    const bankItem = CAMPUS_EQUIPMENT.find(item => item.id === 'campus-team2-rear-access'), bank = scene.objects.get(bankItem.id), rack = bank.getObjectByName('rear-survey-rear-hvac-steel-platform');
    assert.equal(bankItem.type, 'campus-rear-stair-details'); assert.equal(bankItem.attachedTo, 'campus-packaging-building');
    assert.deepEqual(bankItem.rearSurvey.minimumObservedCounts, { upper: 4, ground: 7, wall: 2 });
    assert.equal(rack.userData.observedUpperHvacCount, 4); assert.equal(rack.userData.observedGroundHvacCount, 7); assert.equal(rack.userData.observedWallHvacCount, 2);
    assert.equal(bank.userData.rearSurveyHvacCount, 13); assert.equal(bank.userData.unseenRearStairFlightsAdded, false);
    const levels = { upper: [], ground: [], wall: [] }, mixedOutdoor = [];
    bank.traverse(node => { if (node.userData.observedHvacLevel) levels[node.userData.observedHvacLevel].push(node); if (node.userData.outdoorSourceId) mixedOutdoor.push(node); });
    assert.deepEqual(Object.values(levels).map(units => units.length), [4, 7, 2]); assert.equal(mixedOutdoor.length, 0);
    for (const unit of levels.wall) assert.equal(unit.userData.observedFrontFanCount, 2);
    const upperDeck = rack.getObjectByName('rear-survey-open-underneath-hvac-platform'), deckY = new THREE.Box3().setFromObject(upperDeck).max.y;
    assert.ok(Math.abs(deckY - 3.4) < 1e-6, 'the rear steel work deck is about 3.4m, below its upper HVAC cabinets');
    const entry = bank.getObjectByName('rear-survey-team2-stair-glass-entry'), ladder = rack.getObjectByName('rear-survey-platform-access-ladder'), hood = bank.getObjectByName('rear-survey-rear-open-square-exhaust-hood');
    const position = node => node.getWorldPosition(new THREE.Vector3());
    assert.equal(entry.userData.actualDoorLeafCount, 2); assert.equal(entry.userData.unseenInteriorAdded, false);
    const rackBounds = new THREE.Box3().setFromObject(rack);
    assert.ok(position(entry).x > rackBounds.max.x + .5 && position(entry).z < -64.2, 'the final glass pair occupies the separate return beyond the HVAC row');
    assert.ok(position(ladder).x < position(entry).x - 10 && position(hood).x < position(entry).x - 10, 'the ladder and open hood stay at the western rack end after the rear-facing rotation');
    for (const unit of levels.wall) assert.ok(position(unit).x < position(ladder).x, 'both small two-fan wall units are farther west than the cage ladder');
    const outdoor = scene.objects.get('campus-outdoor-area'), outdoorSources = [], copiedRearUnits = [];
    outdoor.traverse(node => { if (node.userData.outdoorSourceId) outdoorSources.push(node.userData.outdoorSourceId); if (node.userData.observedHvacId) copiedRearUnits.push(node); });
    assert.deepEqual(outdoorSources, OUTDOOR_EQUIPMENT.map(item => item.id)); assert.equal(outdoorSources.length, 22); assert.equal(copiedRearUnits.length, 0);
  } finally { dispose(); }
});

test('the tank-front green wall stops at the stair boundary and the former empty enclosure remains an open side parking area', async () => {
  const h = await sceneHarness(), { scene, dispose } = h;
  try {
    const item = CAMPUS_EQUIPMENT.find(item => item.id === 'campus-process-tank-bank'), bank = scene.objects.get(item.id);
    assert.deepEqual(item.position, [60, 0, -83.5]);
    assert.deepEqual(item.bund.bounds, { minX: -3.8, maxX: 11, minZ: -7, maxZ: 7 });
    assert.deepEqual(item.parking.bounds, { minX: -11, maxX: -3.8, minZ: -7, maxZ: 7 });
    assert.equal(item.parking.bayCount, undefined, 'the unmeasured empty area does not acquire a claimed parking capacity');
    assert.equal(item.bund.partitions?.length || 0, 0, 'the parking is not retained as an empty subdivided containment compartment');
    assert.equal(bank.userData.observedVesselCount, 8);
    const expected = [['T-R1',4.5,4.4],['T-R2',9,4.4],['T-M1',0,0],['T-M2',4.5,0],['T-M3',9,0],['T-S1',0,-4.4],['T-S2',4.5,-4.4],['T-S3',9,-4.4]];
    for (const [id, x, z] of expected) {
      const vessel = bank.getObjectByName(`campus-rear-vessel-${id}`), p = vessel.getWorldPosition(new THREE.Vector3());
      assert.ok(Math.abs(p.x - 60 - x) < 1e-6 && Math.abs(p.z + 83.5 - z) < 1e-6, `${id} retains its confirmed row position`);
    }
    const curb = bank.getObjectByName('campus-storage-low-containment-curb'), wallBoxes = meshWorldBoxes(curb), green = wallBoxes.filter(entry => entry.mesh.material === scene.campusRearMaterials.greenWall), white = wallBoxes.filter(entry => entry.mesh.material === scene.campusRearMaterials.white);
    const boundaryX = item.position[0] + item.bund.bounds.minX, thick = item.bund.thickness;
    assert.equal(green.length, 1, 'only the actual road-facing tank front is green');
    assert.ok(green[0].bounds.min.x >= boundaryX - .001 && green[0].bounds.max.x <= 71.001, 'the green front stops before the adjacent parking bays');
    assert.ok(green[0].bounds.min.z > -77 && green[0].bounds.max.z <= -76.49);
    assert.equal(white.length, 3, 'three tank-side boundaries remain without separate walls around the parking');
    for (const entry of wallBoxes) assert.ok(entry.bounds.min.x >= boundaryX - thick / 2 - .001, 'no green or white curb extends into the former empty parking compartment');
    const stairSide = white.filter(entry => entry.bounds.max.x - entry.bounds.min.x <= thick + .01 && Math.abs(entry.bounds.getCenter(new THREE.Vector3()).x - boundaryX) <= thick && entry.bounds.max.z - entry.bounds.min.z > 13);
    assert.equal(stairSide.length, 1, 'one white tank boundary remains beside the unchanged stair');
    const parking = bank.getObjectByName('campus-storage-adjacent-open-parking'); assert.ok(parking);
    // 11/11 boiler clip001 1:36-1:38 shows two cars parked nose-in; they are an
    // observation of that day, not confirmed bays or capacity.
    assert.equal(parking.userData.openParking, true); assert.equal(parking.userData.vehiclesAdded, true); assert.equal(parking.userData.parkingCapacityConfirmed, false);
    const parkedCars = bank.getObjectByName('campus-tank-yard-parked-cars');
    assert.equal(parkedCars.userData.observedVehicleCount, 2); assert.equal(parkedCars.userData.vehiclesChangeDaily, true);
    const parkingBoxes = meshWorldBoxes(parking), parkingBounds = new THREE.Box3().setFromObject(parking);
    assert.ok(parkingBounds.min.x >= 48.99 && parkingBounds.max.x <= boundaryX + .001 && parkingBounds.min.z >= -90.51 && parkingBounds.max.z <= -76.49, 'the pavement occupies only the adjacent side area');
    assert.ok(parkingBoxes.length >= 1 && parkingBoxes.every(entry => entry.bounds.max.y < .2), 'the parking pavement stays low, without invented bay markings or enclosing walls');
    for (const x of [50.5, 52.5, 54.5]) for (const y of [.5, 1.2]) {
      const ray = new THREE.Raycaster(new THREE.Vector3(x, y, -74.5), new THREE.Vector3(0, 0, -1), 0, 16.1);
      const blocking = ray.intersectObject(bank, true).filter(hit => { let node = hit.object; while (node) { if (node.name === 'campus-tank-yard-visible-details') return false; node = node.parent; } return true; });
      assert.equal(blocking.length, 0, 'the parking can be entered directly from the back road (only the filmed parked cars stand in it)');
      assert.ok(new THREE.Raycaster(new THREE.Vector3(x, 2, -82.5), new THREE.Vector3(0, -1, 0)).intersectObject(parking, true).length, 'the open parking area still has a physical floor');
    }
    const valveItem = CAMPUS_EQUIPMENT.find(item => item.id === 'campus-tank-valve-room'), valve = scene.objects.get(valveItem.id);
    assert.deepEqual(valveItem.position, [60, 0, -79]); assert.deepEqual(valveItem.stair.position, [-3.8,0,.7]); assert.equal(valveItem.stair.rotation, -Math.PI / 2);
    const landing = new THREE.Box3().setFromObject(valve.getObjectByName('campus-tank-valve-room-stair-landing'));
    assert.ok(landing.min.x < boundaryX && landing.max.x > boundaryX, 'the retained landing crosses the white boundary into the blue-room side');
    const layout = scene.getLayout(); h.resize(1100, 760); scene.focus(item.id);
    assertFits(meshCorners(bank), settledCamera(scene), 'tank bank with its corrected side parking');
    assert.deepEqual(scene.getLayout(), layout, 'focusing the corrected enclosure cannot move tanks or the blue room');
  } finally { dispose(); }
});

test('blue-room selection opens the filmed interior and restores covers when toggled or deselected', async () => {
  const { scene, dispose } = await sceneHarness();
  try {
    const id = 'campus-tank-valve-room', root = scene.objects.get(id), covers = [];
    root.traverse(node => { if (node.userData.campusInteriorCover) covers.push(node); });
    assert.ok(covers.length >= 4);
    assert.ok(covers.every(node => node.visible), 'the original overview keeps the blue room exterior intact');
    scene.select(id);
    assert.equal(scene.campusInteriorEnabled, true);
    assert.equal(scene.objects.get('campus-process-tank-bank').visible, true, 'valve-room inspection retains the eight-tank context until isolation is requested');
    assert.ok(covers.every(node => !node.visible));
    const interior = root.getObjectByName('campus-tank-valve-room-interior-road-side');
    assert.ok(interior.visible && interior.children.length > 0);
    assert.equal(scene.setCampusInterior(false), false);
    assert.ok(covers.every(node => node.visible));
    assert.equal(scene.setCampusInterior(true), true);
    scene.setIsolation(true);
    assert.ok(covers.every(node => !node.visible));
    assert.equal(scene.objects.get('campus-process-tank-bank').visible, false);
    scene.select(null);
    assert.ok(covers.every(node => node.visible));
    assert.equal(scene.campusInteriorEnabled, false);
    assert.equal(scene.setCampusInterior(true), false);
    scene.select('campus-maintenance-office');
    assert.equal(scene.campusInteriorEnabled, false);
  } finally { dispose(); }
});

test('the attached boiler entrance opens its interior, masks only the annex context and restores it when another room is selected', async () => {
  const { scene, dispose } = await sceneHarness();
  try {
    const item = CAMPUS_EQUIPMENT.find(item => item.id === 'campus-boiler-room');
    const boiler = scene.objects.get(item.id), interior = boiler.getObjectByName('campus-boiler-room-interior');
    const door = boiler.getObjectByName('campus-boiler-room-perforated-double-door');
    const doorPosition = door.getWorldPosition(new THREE.Vector3());
    const doorNormal = new THREE.Vector3(0, 0, 1).transformDirection(door.matrixWorld);
    assert.ok(Math.abs(doorPosition.x - 67) < .4 && Math.abs(doorPosition.z + 59) < 1, 'the boiler entrance occupies the filmed east side of the extended low annex');
    assert.ok(doorNormal.x > .99, 'the boiler door opens toward the tank-yard road');
    assert.equal(item.attachedTo, 'campus-dryer-tower');
    const context = item.contextOccluders.map(name => scene.scene.getObjectByName(name));
    assert.ok(context.every(Boolean) && context.every(node => node.visible));
    const covers = []; boiler.traverse(node => { if (node.userData.campusInteriorCover) covers.push(node); });
    assert.ok(covers.length >= 4 && covers.every(node => node.visible));
    const layout = scene.getLayout();
    scene.select(item.id);
    assert.equal(scene.campusInteriorEnabled, true);
    assert.ok(context.every(node => !node.visible), 'the solid annex no longer conceals the photographed room');
    assert.ok(covers.every(node => !node.visible));
    assert.ok(interior.visible && interior.children.length > 0);
    scene.focus(item.id);
    const centre = new THREE.Box3().setFromObject(interior).getCenter(new THREE.Vector3());
    assert.ok(scene.goalTarget.distanceTo(centre) < 1e-7, 'close view targets boiler machinery rather than the entire dryer building');
    scene.setCampusInterior(false);
    assert.ok(context.every(node => node.visible) && covers.every(node => node.visible));
    scene.setCampusInterior(true);
    scene.select('campus-maintenance-office');
    assert.ok(context.every(node => node.visible) && covers.every(node => node.visible), 'office selection restores the complete boiler exterior and annex');
    scene.select('campus-electrical-room');
    assert.equal(scene.campusInteriorEnabled, false, 'the unfilmed electrical interior is not invented');
    assert.equal(scene.objects.get('campus-electrical-room').userData.hasInspectableInterior, false);
    assert.deepEqual(scene.getLayout(), layout, 'opening rooms leaves equipment poses and saved layout unchanged');
  } finally { dispose(); }
});

test('inspecting a boiler masks an overlapping user-moved building without rewriting its saved pose', async () => {
  const { scene, dispose } = await sceneHarness();
  try {
    const production = scene.objects.get('campus-production');
    assert.equal(scene.setTransform('campus-production', { position: [35.75, 0, -44.5], rotation: 0 }), true);
    const layout = scene.getLayout();
    const moved = layout.find(item => item.id === 'campus-production');
    assert.deepEqual([...moved.position], [35.75, 0, -44.5], 'the existing user pose remains intentional');
    const boiler = scene.objects.get('campus-boiler-room');
    const interior = boiler.getObjectByName('campus-boiler-room-interior');
    scene.scene.updateMatrixWorld(true);
    assert.ok(new THREE.Box3().setFromObject(production).intersectsBox(new THREE.Box3().setFromObject(interior)), 'the moved production building reproduces the real browser obstruction');
    assert.equal(production.visible, true);
    scene.select('campus-boiler-room');
    assert.equal(production.visible, false, 'the overlapping production roof cannot hide the inspected boiler interior');
    assert.equal(boiler.visible, true);
    assert.equal(scene.objects.get('campus-dryer-tower').visible, true, 'the attached dryer retains its named context-mask handling');
    assert.deepEqual(scene.getLayout(), layout, 'temporary inspection visibility does not migrate or save the moved building');
    scene.setCampusInterior(false);
    assert.equal(production.visible, true, 'closing the interior restores the existing building');
    scene.setCampusInterior(true);
    assert.equal(production.visible, false);
    scene.select('campus-maintenance-office');
    assert.equal(production.visible, true, 'selecting another room restores the production model');
    assert.deepEqual(scene.getLayout(), layout);
  } finally { dispose(); }
});

test('the new rear service view reveals its exterior under an old overlapping saved building and restores the saved context on deselection',async()=>{
  const {scene,dispose}=await sceneHarness();
  try{
    scene.setTransform('campus-production',{position:[35.75,0,-44.5],rotation:0});
    const layout=scene.getLayout(),production=scene.objects.get('campus-production');
    scene.select('campus-team2-rear-access');
    assert.equal(scene.objects.get('campus-team2-rear-access').visible,true);
    assert.equal(scene.objects.get('campus-packaging-building').visible,true);
    assert.equal(production.visible,false,'the old overlapping blue production roof cannot conceal the new rear bank');
    assert.deepEqual(scene.getLayout(),layout);
    scene.select(null);
    assert.equal(production.visible,true);
    assert.deepEqual(scene.getLayout(),layout,'the temporary exterior inspection never moves or saves another building');
  }finally{dispose();}
});

test('the 공무작업장 door belongs to the LPG-side 공무환경팀실 across the road rather than the dryer wall', async () => {
  const { scene, dispose } = await sceneHarness();
  try {
    const officeItem = CAMPUS_EQUIPMENT.find(item => item.id === 'campus-maintenance-office');
    const office = scene.objects.get(officeItem.id), tower = scene.objects.get('campus-dryer-tower');
    const workshop = office.getObjectByName('campus-exterior-maintenance-workshop-door');
    assert.ok(workshop, 'the recorded grey workshop door is part of the LPG-side building');
    assert.equal(tower.getObjectByName('campus-exterior-maintenance-workshop-door'), undefined, 'the mistaken dryer-wall copy is removed');
    const copies = []; scene.scene.traverse(node => { if (node.name === 'campus-exterior-maintenance-workshop-door') copies.push(node); });
    assert.equal(copies.length, 1, '공무작업장 and 공무환경팀실 are aliases of one building rather than duplicated rooms');
    assert.deepEqual([...officeItem.position], [42.5, 0, -82.75], 'the user-confirmed LPG-side anchor stays intact');
    assert.match(officeItem.name, /공무작업장/); assert.match(officeItem.name, /공무환경팀실/);
    const entrance = workshop.getWorldPosition(new THREE.Vector3());
    const normal = new THREE.Vector3(0, 0, 1).transformDirection(workshop.matrixWorld);
    // boiler clip001 2:58: the door is just round the corner from the LPG fence
    // at the west end of the road face, under the deep concrete canopy.
    assert.ok(Math.abs(entrance.x - 39.4) < .1 && Math.abs(entrance.z + 76.95) < .2, 'the workshop entrance is on the road-facing front of the LPG-side building, beside the LPG corner');
    const lpgBounds = new THREE.Box3().setFromObject(scene.objects.get('campus-lpg-bank'));
    assert.ok(lpgBounds.max.z < -77.5 && entrance.x - lpgBounds.max.x < 4, 'the LPG vessels stand against the west wall, not out in the back road');
    assert.ok(normal.z > .99 && Math.abs(normal.x) < .01, 'the workshop faces across the road toward the dryer');
    const boilerDoor = scene.objects.get('campus-boiler-room').getObjectByName('campus-boiler-room-perforated-double-door').getWorldPosition(new THREE.Vector3());
    assert.ok(Math.abs(boilerDoor.z + 59) < .5 && boilerDoor.z - entrance.z > 15, 'the boiler remains on the opposite dryer side of the yard');
    assert.equal(workshop.userData.plateText, '공무작업장');
  } finally { dispose(); }
});

test('returning from a hidden menu keeps the camera proportions and a dropped GPU context is restored and redrawn', async () => {
  const harness = await sceneHarness();
  const { scene } = harness;
  try {
    Object.assign(scene.goalOrbit, { azimuth: .65, elevation: .68, distance: 270 });
    harness.resize(1100, 760);
    const aspect = scene.camera.aspect, distance = scene.goalOrbit.distance, width = scene.width;
    // The workspace hides the page with display:none while another menu is open.
    harness.resize(0, 0);
    assert.equal(scene.width, width, 'a hidden canvas keeps its last real size');
    assert.equal(scene.camera.aspect, aspect, 'the camera is not squashed to a 1:1 aspect while hidden');
    assert.equal(scene.goalOrbit.distance, distance, 'the fit distance is not rescaled while hidden');
    assert.equal(scene.pendingResize, true);
    harness.resize(1100, 760);
    assert.equal(scene.pendingResize, false);
    assert.equal(scene.camera.aspect, aspect); assert.equal(scene.goalOrbit.distance, distance);
    // A lost WebGL context is asked to come back after the page returns.
    let lost = true, forced = 0;
    scene.renderer = { setSize() {}, getContext: () => ({ isContextLost: () => lost }), forceContextRestore() { forced++; lost = false; } };
    scene.active = false;
    scene.setActive(true);
    await new Promise(resolve => setTimeout(resolve, 1700));
    assert.equal(forced, 1, 'a context the browser did not restore by itself is restored explicitly');
    assert.equal(scene.dirty, true);
  } finally { clearTimeout(scene.contextRestoreTimer); harness.dispose(); }
});
