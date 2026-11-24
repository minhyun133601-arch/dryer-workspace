import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from '../apps/shared/vendor/three.module.js';
import * as walking from '../apps/site/person-walk.js';
import { CAMPUS_ROOM } from '../apps/site/campus-data.js';
import { OUTDOOR_ROOM } from '../apps/site/outdoor-data.js';
import { PACKAGING_ROOM, PACKAGING_ROOMS, PACKAGING_OVERVIEW, PACKAGING_FLOOR_ELEVATIONS } from '../apps/site/packaging-data.js';
import { FLOORS, FLOOR_HEIGHT, floorElevation, floorHeight } from '../apps/site/facility-data.js';
import { PLACEMENT_REGIONS, PLACEMENT_RULES, constrainPlacement, rotatedFootprint, fromRoomPosition, toRoomPosition } from '../apps/site/placement-rules.js';
import { buildPreparationEquipment } from '../apps/site/preparation-models.js';
import { PREPARATION_EQUIPMENT } from '../apps/site/preparation-data.js';
import { buildPackagingEnvironment } from '../apps/site/packaging-models.js';
import { packagingEntryStairPlan } from '../apps/site/packaging-routes.js';
import { buildDryerUpperEnvironment } from '../apps/site/dryer-upper-models.js';
import { buildCampusBoilerRoom, buildPreparationBoilerRoom } from '../apps/site/boiler-models.js';
import { alignDryerCompressorEntrance, buildDryerBuildingEnvironment } from '../apps/site/dryer-building-envelope.js';
import { buildDryerRouteEnvironment } from '../apps/site/dryer-route-environment.js';
import { buildDryerCompressorEnvironment } from '../apps/site/dryer-compressor-environment.js';
import { buildDryerCompressorInteriorDetails } from '../apps/site/dryer-compressor-interior-details.js';
import { createProximityDoorController } from '../apps/site/proximity-doors.js';

test('the dryer compressor room supports continuous walking from 3F hall through NE stair and green roof while blocking unfilmed roof voids', async () => {
  const h = await harness({ floor: 3 }), s = modelTools(h.scene);
  try {
    const { scene } = h, spec = FLOORS.find(floor => floor.id === 3);
    const env = buildDryerBuildingEnvironment(s, { floor: 3, spec, elevation: spec.elevation });
    buildDryerRouteEnvironment(s, env, spec);
    buildDryerCompressorEnvironment(s, env, spec);
    alignDryerCompressorEntrance(env);
    buildDryerCompressorInteriorDetails(s, env, spec);
    scene.buildingEnvironments = new Map([[3, env]]);
    scene.floorDecks.set(3, env.deck); scene.floorStructures.set(3, env.structure);
    assert.ok(env.cover.getObjectByName('dryer-building-3-compressor-room-roof'));
    scene.scene.updateMatrixWorld(true);
    scene.setView('person');
    scene.proximityDoors = createProximityDoorController(scene.scene);
    const room = spec.rooms.find(entry => entry.id === 'compressor-room').bounds;
    scene.person = walking.createPersonState({ position: [(room.minX + room.maxX) / 2, spec.elevation, (room.minZ + room.maxZ) / 2] });
    const wing = scene._personWalkLimits();
    assert.equal(wing.maxX, room.maxX); assert.equal(wing.minX, PLACEMENT_REGIONS.upper.minX);
    const landing = [(room.minX + room.maxX) / 2, spec.elevation, room.maxZ + .75];
    const supports = scene._personSupportMeshes();
    assert.ok(supports.includes(env.deck.getObjectByName('dryer-building-3-compressor-roof-threshold')));
    for (const point of [[7.8, spec.elevation, -8.6], [9.35, spec.elevation, -8.6], [9.35, spec.elevation, -5.5], landing, [16.85, spec.elevation, -8.0]]) {
      close(scene._personGroundHeight(point, supports), spec.elevation, `supported 3F walk point ${point}`, .07);
    }
    assert.equal(scene._personGroundHeight([20, spec.elevation, 10], supports), null, 'unfilmed south-east roof remains unsupported');
    assert.equal(walking.isPersonPositionFree([room.maxX + 1, spec.elevation, room.minZ + 2], { bounds: wing }), false);
    scene.person = walking.createPersonState({ position: [0, spec.elevation, 0] });
    assert.equal(scene._personWalkLimits().maxX, room.maxX);

    // Follow the marked landing, turn around the outdoor units and enter through
    // the active (east) half of the compressor-room double door.
    const route = [[7.9, -8.6], [9.84, -8.6], [9.86, -7.38], [9.35, -6.7], [9.35, -5.4], [10.2, -3.2],
      [12.7, -1.95], [15, -1.95], [17.31, -1.95], [17.31, -3.4], [17.31, -4.7]];
    const thresholdRise = new Map([['9.35,-6.7', .08], ['17.31,-3.4', .12]]);
    const [startX, startZ] = route[0];
    scene.person = walking.createPersonState({ position: [startX, spec.elevation, startZ] });
    scene.setPersonInput('forward', true);
    const opened = new Set();
    for (const [leg, stops] of [route.slice(1), route.slice(0, -1).reverse()].entries()) {
      // Use the normal door interaction going out, then walk back from the
      // machine aisle with the optional automatic opening enabled.
      scene.proximityDoors.reset();
      scene.setAutomaticDoors(leg === 1);
      for (const [x, z] of stops) {
        const distance = () => Math.hypot(x - scene.person.position[0], z - scene.person.position[2]);
        const limit = Math.ceil(distance() / (walking.WALK_RULES.speed * .1)) + 12;
        for (let tick = 0; tick < limit && distance() > .02; tick++) {
          scene.person.yaw = Math.atan2(x - scene.person.position[0], scene.person.position[2] - z);
          if (!scene.autoOpenDoors) {
            const action = scene.proximityDoors.getInteraction(scene._personWorldPosition(), { direction: scene._personDoorDirection() });
            if (action?.action === 'open' && scene.interactDoor()) opened.add(action.id);
          }
          const dt = Math.min(.1, distance() / walking.WALK_RULES.speed);
          scene._advancePerson(dt);
          scene._updateProximityDoors(dt);
        }
        assert.ok(distance() <= .02, `3F walk towards ${x},${z} stopped at ${scene.person.position.join(',')}`);
        const rise = thresholdRise.get([x, z].join(',')) ?? 0;
        close(scene.person.position[1], spec.elevation + rise, 'feet follow the green curbs in both directions', .015);
      }
    }
    assert.equal(opened.size, 3, 'manually opened the hall, roof and compressor doors');
    // Walk forwards off the surveyed green apron. The void must stop the body,
    // even though the overall east wing lies inside the rectangular walk limits.
    scene.person = walking.createPersonState({ position: [19.5, spec.elevation, 5.1], yaw: Math.PI });
    walkDistance(scene, 1);
    assert.ok(scene.person.position[2] >= 5.3 && scene.person.position[2] <= 5.401);
  } finally { h.scene.proximityDoors?.dispose(); s.dispose(); h.dispose(); }
});

function eventTarget() {
  const handlers = new Map();
  return {
    handlers,
    addEventListener(type, handler) { if (!handlers.has(type)) handlers.set(type, new Set()); handlers.get(type).add(handler); },
    removeEventListener(type, handler) { handlers.get(type)?.delete(handler); },
    dispatch(type, event = {}) {
      const value = { target: this, preventDefault() { this.defaultPrevented = true; }, ...event };
      handlers.get(type)?.forEach(handler => handler(value)); return value;
    },
  };
}

async function harness({ floor = 7, packagingLevel = 3 } = {}) {
  const document = eventTarget(), window = eventTarget(), captures = new Set();
  document.hidden = false; document.querySelector = () => null;
  const canvas = Object.assign(eventTarget(), {
    style: {}, dataset: {}, ownerDocument: document,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 700 }),
    getClientRects: () => [{}], checkVisibility: () => true,
    setPointerCapture(id) { captures.add(id); }, hasPointerCapture(id) { return captures.has(id); }, releasePointerCapture(id) { captures.delete(id); },
    focus() { document.activeElement = this; },
  });
  canvas.parentElement = { getBoundingClientRect: canvas.getBoundingClientRect, classList: { toggle() {} } };
  document.activeElement = canvas;
  const source = (await readFile(new URL('../apps/site/scene.js', import.meta.url), 'utf8'))
    .replace(/^import .*;\r?\n/gm, '').replace(/^export\s+(?=(?:function|class|const|let)\b)/gm, '');
  const context = vm.createContext({ THREE, ...walking, CAMPUS_ROOM, OUTDOOR_ROOM,
    PACKAGING_ROOM, PACKAGING_ROOMS, PACKAGING_OVERVIEW, PACKAGING_FLOOR_ELEVATIONS,
    FLOORS, FLOOR_HEIGHT, floorElevation, floorHeight, PLACEMENT_REGIONS, PLACEMENT_RULES,
    constrainPlacement, rotatedFootprint, fromRoomPosition, toRoomPosition, document, window,
    requestAnimationFrame: () => 1, cancelAnimationFrame() {}, setTimeout, clearTimeout,
  });
  new vm.Script(`${source}\nglobalThis.FacilityScene = FacilityScene;`).runInContext(context);
  const scene = Object.create(context.FacilityScene.prototype), world = new THREE.Scene();
  const environment = () => ({ deck: new THREE.Group(), structure: new THREE.Group(), ducts: new THREE.Group(), ceiling: new THREE.Group() });
  const floorY = Number.isInteger(floor) ? floorElevation(floor) : 0;
  const equipment = [{ id: 'fixture', floor, position: [0, floorY, 0], rotation: .3 }];
  const object = new THREE.Group(); object.position.set(...equipment[0].position); world.add(object);
  Object.assign(scene, {
    scene: world, canvas, equipment, objects: new Map([['fixture', object]]), pickables: [], parts: [],
    placementFootprints: new Map(), placementDefaults: new Map(), placementResults: new Map(),
    camera: new THREE.PerspectiveCamera(42, 1000 / 700, .02, 3000),
    personCamera: new THREE.PerspectiveCamera(65, 1000 / 700, .02, 3000),
    topCamera: new THREE.OrthographicCamera(-25, 25, 18, -18, .02, 3000),
    person: walking.createPersonState({ position: [2, floorY, 8] }),
    personInputs: new Set(), personStates: new Map(), personAvatar: new THREE.Group(),
    personArea: `${floor}:${floor === 'packaging' ? packagingLevel : ''}`,
    raycaster: new THREE.Raycaster(), activeFloor: floor, packagingLevel, view: 'perspective',
    target: new THREE.Vector3(0, floorY + 1, 0), goalTarget: new THREE.Vector3(0, floorY + 1, 0),
    orbit: { azimuth: .65, elevation: .4, distance: 30 }, goalOrbit: { azimuth: .65, elevation: .4, distance: 30 },
    width: 1000, height: 700, fitFactor: 1, listeners: [], active: true, disposed: false,
    placementMode: false, dragPlacement: null, selected: null, isolated: false,
    structureEnabled: true, ductsEnabled: true, surveyEnabled: true,
    amount: 0, explosion: 0, navigationEdited: false, lastTick: null, frame: null,
    floorDecks: new Map([[floor, new THREE.Group()]]), floorStructures: new Map(),
    locationDisks: new Map(), labels: [], floorLabels: [], packagingFloorLabels: [],
    outdoor: environment(), campus: environment(), packaging: environment(), ducts: new THREE.Group(), survey: new THREE.Group(),
    renderer: { setSize() {}, render() {} }, selectionRing: new THREE.Group(),
    onSelect() {}, onViewChange() {}, onNavigationChange() {}, onTransformChange() {},
    _invalidate() {}, _clearHover() {}, _hoverFromPointer() {}, _updateLabels() {},
  });
  scene.topCamera.up.set(0, 0, -1);
  world.add(scene.personAvatar);
  return { scene, canvas, document, window, captures,
    dispose() { scene.listeners.forEach(remove => remove()); } };
}

const close = (actual, expected, message, tolerance = 1e-7) => assert.ok(Math.abs(actual - expected) < tolerance,
  `${message}: ${actual} versus ${expected}`);

// Route fixtures specify model distances, so changing the inspection speed
// does not carry the person past the landing being tested.
function walkDistance(scene, distance, onStep = () => {}) {
  const speed = scene.personInputs.has('fast') ? walking.WALK_RULES.fastSpeed : walking.WALK_RULES.speed;
  let remaining = distance / speed;
  while (remaining > 1e-10) {
    const delta = Math.min(1 / 60, remaining);
    scene._advancePerson(delta); onStep(); remaining -= delta;
  }
}

function modelTools(scene) {
  const result = {
    scene: scene.scene, geometries: new Set(), materials: new Set(), textures: new Set(), parts: [],
    _material(color, roughness, metalness, extra = {}) { const material = new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, ...extra }); this.materials.add(material); return material; },
    _group(parent, position = [0, 0, 0]) { const root = new THREE.Group(); root.position.set(...position); parent.add(root); return root; },
    _mesh(geometry, material, parent, position = [0, 0, 0]) { const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...position); parent.add(mesh); this.geometries.add(geometry); return mesh; },
    _box(parent, size, position, material) { return this._mesh(new THREE.BoxGeometry(...size), material, parent, position); },
    _cyl(parent, radius, height, position, material, bottom = radius, segments = 24) { return this._mesh(new THREE.CylinderGeometry(radius, bottom, height, segments), material, parent, position); },
    _part(root, name, offset, position = [0, 0, 0]) { const group = this._group(root, position); this.parts.push({ root, name, group, offset }); return group; },
    dispose() { this.geometries.forEach(geometry => geometry.dispose()); this.materials.forEach(material => material.dispose()); this.textures.forEach(texture => texture.dispose()); },
  };
  result.mat = Object.fromEntries(['steel', 'trim', 'dark', 'white', 'yellow', 'black'].map(key => [key, result._material(0x888888)]));
  return result;
}

test('a dedicated walking camera follows the person at eye height on the floor and in a rotated outdoor room', async () => {
  for (const floor of [7, 'outdoor']) {
    const h = await harness({ floor });
    try {
      const { scene } = h;
      scene.person = walking.createPersonState({ position: [20, floor === 7 ? floorElevation(7) : 0, 2], yaw: .7, pitch: .2 });
      scene._updatePersonCamera();
      const feet = floor === 'outdoor' ? fromRoomPosition(scene.person.position, OUTDOOR_ROOM) : scene.person.position;
      close(scene.personCamera.position.x, feet[0], 'the eye tracks feet X');
      close(scene.personCamera.position.z, feet[2], 'the eye tracks feet Z');
      close(scene.personCamera.position.y, feet[1] + walking.WALK_RULES.eyeHeight, 'the eye stays above the selected floor');
      assert.equal(scene.personAvatar.visible, true, 'the single person is visible in the overview');
      scene.view = 'person';
      scene._updatePersonCamera();
      assert.equal(scene.personAvatar.visible, false, 'first person does not render its own head in front of the camera');
      assert.equal(scene._currentCamera(), scene.personCamera);
      assert.notEqual(scene.personCamera, scene.camera, 'orbit camera state is separate');
      const direction = scene.personCamera.getWorldDirection(new THREE.Vector3());
      close(direction.y, Math.sin(scene.person.pitch), 'vertical look matches person pitch');
      const goal = scene._goalCamera();
      assert.ok(goal.position.distanceTo(scene.personCamera.position) < 1e-8, 'goal picking uses the walking eye rather than orbit focus');
      scene.view = 'top'; scene._updatePersonCamera();
      assert.equal(scene.personAvatar.visible, true, 'the same person reappears on the map');
    } finally { h.dispose(); }
  }
});

test('resetting a person chooses a clear floor position without modifying equipment', async () => {
  const h = await harness();
  try {
    const { scene } = h, frame = scene._personFrame();
    scene.equipment[0].position = [5.5, floorElevation(7), frame.maxZ - 1.2];
    scene.placementFootprints.set('fixture', { minX: -1, maxX: 1, minZ: -1, maxZ: 1 });
    const layout = scene.getLayout();
    scene.view = 'person';
    scene.resetPerson();
    assert.equal(scene.view, 'person', 'resetting the person retains the current observation view');
    assert.ok(walking.isPersonPositionFree(scene.person.position, { bounds: frame, obstacles: scene._personObstacles() }), 'the initial person avoids a moved machine');
    close(scene.person.position[1], floorElevation(7), 'reset uses the actual floor datum');
    assert.deepEqual(scene.getLayout(), layout, 'placing a navigation person never edits the facility');
  } finally { h.dispose(); }
});

test('held arrows and looking change only the person, retaining equipment and orbit camera state', async () => {
  const h = await harness();
  try {
    const { scene, canvas } = h, layout = scene.getLayout(), orbit = { ...scene.goalOrbit }, target = scene.goalTarget.clone();
    scene._controls(); scene.view = 'person';
    const before = structuredClone(scene.person);
    const press = canvas.dispatch('keydown', { key: 'ArrowUp' });
    assert.equal(press.defaultPrevented, true);
    walkDistance(scene, .5);
    canvas.dispatch('keyup', { key: 'ArrowUp' });
    assert.ok(scene.person.position[2] < before.position[2], 'holding forward walks along the person heading');
    close(scene.person.position[1], before.position[1], 'walking does not fly between floors');
    const eye = [...scene.person.position], yaw = scene.person.yaw;
    canvas.dispatch('pointerdown', { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 300, clientY: 250 });
    canvas.dispatch('pointermove', { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 430, clientY: 220 });
    canvas.dispatch('pointerup', { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 430, clientY: 220 });
    assert.notEqual(scene.person.yaw, yaw, 'dragging turns the person view');
    assert.deepEqual([...scene.person.position], eye, 'looking keeps feet fixed');
    assert.deepEqual(scene.getLayout(), layout);
    assert.deepEqual(scene.goalOrbit, orbit); assert.ok(scene.goalTarget.equals(target));
    assert.equal(scene.view, 'person');
  } finally { h.dispose(); }
});

test('person navigation stops the complete body at real walls, equipment and floor boundaries without editing their poses', async () => {
  const h = await harness();
  let geometry, material;
  try {
    const { scene } = h, ground = floorElevation(7), frame = scene._personFrame();
    scene.view = 'person';
    scene.person = walking.createPersonState({ position: [2, ground, 8] });
    scene.equipment[0].position = [2, ground, 3]; scene.equipment[0].rotation = 0;
    scene.placementFootprints.set('fixture', { minX: -1, maxX: 1, minZ: -.5, maxZ: .5 });
    geometry = new THREE.BoxGeometry(12, 2, .2); material = new THREE.MeshBasicMaterial();
    const machine=new THREE.Mesh(new THREE.BoxGeometry(2,1.6,1),material);
    machine.position.y=.8;scene.objects.get('fixture').position.set(2,ground,3);scene.objects.get('fixture').add(machine);
    const wall = new THREE.Mesh(geometry, material); wall.position.set(2, ground + 1, 5);
    scene.scene.add(wall); scene.floorStructures.set(7, wall);
    const obstacles = scene._personObstacles();
    assert.equal(obstacles.length, 2, 'the walking path contains actual structural and equipment meshes');
    const layout = scene.getLayout(), wallPosition = wall.position.clone();
    scene.setPersonInput('forward', true);
    walkDistance(scene, 8);
    assert.ok(scene.person.position[2]>=5.39&&scene.person.position[2]<5.45,'a held arrow stops the body in front of the wall');
    scene.person=walking.createPersonState({position:[2,ground,4.5]});walkDistance(scene,3);
    assert.ok(scene.person.position[2]>=3.79&&scene.person.position[2]<3.85,'the actual machine body also blocks movement');
    scene.person=walking.createPersonState({position:[-5,ground,frame.minZ+1]});walkDistance(scene,3);
    scene.setPersonInput('forward', false);
    close(scene.person.position[2],frame.minZ+walking.WALK_RULES.radius,'the complete body remains within its floor boundary');
    close(scene.person.position[0], -5, 'walking retains the requested heading');
    close(scene.person.position[1], ground, 'walking stays on the selected floor height');
    close(scene.personCamera.position.y, ground + walking.WALK_RULES.eyeHeight, 'the eye retains its floor-relative height');
    assert.deepEqual(scene.getLayout(), layout, 'walking never moves facility equipment');
    assert.ok(wall.position.equals(wallPosition), 'collision leaves the wall model unchanged');
    machine.geometry.dispose();
  } finally { geometry?.dispose(); material?.dispose(); h.dispose(); }
});

test('outdoor walking respects its room-local perimeter and keeps the world camera aligned with the rotated room', async () => {
  const h = await harness({ floor: 'outdoor' });
  try {
    const { scene } = h, frame = scene._personFrame(), layout = scene.getLayout();
    scene.view = 'person';
    assert.deepEqual(scene._personWalkLimits(),frame);
    for (const fast of [false, true]) {
      scene.person = walking.createPersonState({ position: [frame.maxX - .6, 0, 1.5], yaw: Math.PI / 2 });
      scene.setPersonInput('forward', true); scene.setPersonInput('fast', fast);
      walkDistance(scene, 2.4);
      scene._stopPerson();
      close(scene.person.position[0],frame.maxX-walking.WALK_RULES.radius,'the person remains inside the room-local boundary');
      const feet = scene.personCamera.position.clone(); feet.y -= walking.WALK_RULES.eyeHeight;
      toRoomPosition(feet.toArray(), OUTDOOR_ROOM).forEach((value, index) => close(value, scene.person.position[index], 'the camera follows transformed feet'));
    }
    scene.person = walking.createPersonState({ position: [frame.minX+.6, 0, 1.5], yaw: -Math.PI / 2 });
    scene.setPersonInput('forward', true);
    walkDistance(scene, 8);
    scene._stopPerson();
    close(scene.person.position[0],frame.minX+walking.WALK_RULES.radius,'the opposite room-local boundary also stops the body');
    close(scene.person.position[2], 1.5, 'a boundary does not redirect the heading');
    scene.person=walking.createPersonState({position:[2.4,0,-5.7],yaw:Math.PI/2});scene.setPersonInput('forward',true);walkDistance(scene,1);scene._stopPerson();
    assert.ok(scene.person.position[0]>3.3,'the real 100RT rear service apron remains in the walking space');
    assert.deepEqual(scene.getLayout(), layout);
  } finally { h.dispose(); }
});

test('restoring an outdoor pose preserves a position outside the former wall limits', async () => {
  const h = await harness({ floor: 'outdoor' });
  try {
    const { scene } = h;
    for (const position of [[-99, 0, 99], [99, 0, -99], [30, 0, -6]]) {
      const cached = walking.createPersonState({ position, yaw: .7, pitch: -.2 });
      scene.personArea = 'campus:'; scene.personStates.set('outdoor:', cached);
      scene._ensurePerson();
      assert.deepEqual(scene.person, cached, 'a restored inspection position is not snapped through a wall');
    }
  } finally { h.dispose(); }
});

test('walking inputs release on blur, editing, inactive workspaces and disposal', async () => {
  const h = await harness();
  try {
    const { scene, canvas } = h;
    scene._controls();
    scene.setPersonInput('forward', true); assert.ok(scene.personInputs.size);
    canvas.dispatch('blur'); assert.equal(scene.personInputs.size, 0, 'moving focus out of the canvas stops walking');
    scene.setPersonInput('forward', true); scene.setActive(false);
    assert.equal(scene.personInputs.size, 0, 'a hidden workspace releases held motion');
    const stopped = structuredClone(scene.person);
    assert.equal(scene._advancePerson(.1), false);
    assert.deepEqual(scene.person, stopped);
    scene.active = true;
    scene.setPersonInput('forward', true);
    h.document.querySelector = () => ({ open: true });
    assert.equal(scene._advancePerson(.1), false, 'opening a modal while holding an arrow stops movement');
    assert.equal(scene.personInputs.size, 0);
    h.document.querySelector = () => null;
    scene.setPersonInput('forward', true); canvas.checkVisibility = () => false;
    assert.equal(scene._advancePerson(.1), false, 'a hidden canvas releases held motion');
    assert.equal(scene.personInputs.size, 0);
    canvas.checkVisibility = () => true; scene.placementMode = true;
    assert.notEqual(canvas.dispatch('keydown', { key: 'ArrowUp' }).defaultPrevented, true, 'layout edit shortcuts retain the arrows');
    assert.equal(scene.personInputs.size, 0);
    scene.placementMode = false; scene.disposed = true;
    scene.setPersonInput('forward', true); assert.equal(scene.personInputs.size, 0);
  } finally { h.dispose(); }
});

test('changing packaging floors retains person view and restores each floors independent person position', async () => {
  const h = await harness({ floor: 'packaging', packagingLevel: 3 });
  try {
    const { scene } = h;
    scene.view = 'person';
    const thirdFloor = structuredClone(scene.person);
    scene.setPersonInput('forward', true);
    scene.setPackagingLevel(2);
    assert.equal(scene.view, 'person');
    assert.equal(scene.personArea, 'packaging:2');
    assert.equal(scene.personInputs.size, 0, 'changing floors releases walking input');
    assert.equal(scene.canvas.dataset.packagingLevel, '2');
    scene.setPackagingLevel(3);
    assert.equal(scene.personArea, 'packaging:3');
    assert.deepEqual(scene.person, thirdFloor, 'returning to a floor keeps its prior person position');
    scene._updatePersonCamera();
    close(scene.personCamera.position.y, walking.WALK_RULES.eyeHeight, 'the selected packaging floor is displayed at its local datum');
  } finally { h.dispose(); }
});

test('the filmed preparation stair reaches its real checkerplate deck, holds height and returns to the floor', async () => {
  const h = await harness({ floor: 1 }), s = modelTools(h.scene);
  try {
    const { scene } = h, item = PREPARATION_EQUIPMENT.find(item => item.id === 'f1-prep-platform');
    scene.equipment.push(item);
    const root = s._group(scene.scene, item.position); scene.objects.set(item.id, root);
    buildPreparationEquipment(s, root, item);
    const base = floorElevation(1), deckY = item.position[1] + item.preparation.elevation;
    scene.person = walking.createPersonState({ position: [24.7, base, 10] });
    scene.view = 'person'; scene.setPersonInput('forward', true);
    let previous = base, largestStep = 0;
    walkDistance(scene, 11 / 3, () => {
      largestStep = Math.max(largestStep, scene.person.position[1] - previous);
      assert.ok(scene.person.position[1] >= previous - .03, 'each tread raises the person toward the platform');
      previous = scene.person.position[1];
    });
    scene._stopPerson();
    close(scene.person.position[1], deckY, 'the top landing connects to the deck', .001);
    assert.ok(largestStep > .1 && largestStep <= walking.WALK_RULES.maxStep, 'each rise is a reachable stair riser');
    for (let i = 0; i < 60; i++) scene._advancePerson(1 / 60);
    close(scene.personCamera.position.y, deckY + walking.WALK_RULES.eyeHeight, 'the stationary eye settles at deck height', .001);
    scene.setPersonInput('backward', true);
    walkDistance(scene, 23 / 6);
    scene._stopPerson();
    close(scene.person.position[1], base, 'walking back descends all filmed steps');
    assert.equal(scene.activeFloor, 1, 'climbing a work platform does not switch the selected floor');
    // The real side guardrail prevents stepping off the raised platform.
    scene.person = walking.createPersonState({ position: [24.7, deckY, 6.9], yaw: Math.PI / 2 }); scene.personEyeY = null;
    scene.setPersonInput('forward', true);
    walkDistance(scene, 4.4);
    scene._stopPerson();
    for (let i = 0; i < 20; i++) scene._advancePerson(.05);
    close(scene.person.position[1], deckY, 'the side guardrail keeps the person on the deck');
    assert.ok(scene.person.position[0]<=26.9-walking.WALK_RULES.radius+.02,'the full body stops before the real side rail');
  } finally { s.dispose(); h.dispose(); }
});

test('the real southeast and northeast stairs support the complete entry–mezzanine–third-floor walk in selected and whole-building views', async () => {
  for (const selected of [2, 'all']) {
    const h = await harness({ floor: selected }), s = modelTools(h.scene);
    try {
      const { scene } = h;
      scene.buildingEnvironments = new Map([1, 2, 3].map(level => {
        const spec = FLOORS.find(floor => floor.id === level);
        const environment = buildDryerBuildingEnvironment(s, { floor: level, elevation: spec.elevation, spec });
        scene.floorDecks.set(level, environment.deck); scene.floorStructures.set(level, environment.structure);
        return [level, environment];
      }));
      if (selected === 2) {
        scene.view = 'perspective'; scene._visibility(); scene.navigationEdited = true;
        assert.equal(scene.floorDecks.get(1).visible, false, 'the mezzanine perspective keeps the first-floor hall separate');
        scene.setView('top');
        assert.equal(scene.floorDecks.get(1).visible, false, 'switching an edited camera to plan mode removes the lower context');
        scene.setView('perspective');
        assert.equal(scene.floorDecks.get(1).visible, false, 'switching back keeps the mezzanine cutaway separate');
      }
      scene.view = 'person'; scene._visibility(); scene.scene.updateMatrixWorld(true);
      for (const environment of scene.buildingEnvironments.values()) assert.equal(environment.deck.visible, true, 'all filmed route floors remain visible during the walk');
      const walkLeg = (yaw, distance) => { scene.person.yaw = yaw; scene.setPersonInput('forward', true); walkDistance(scene, distance); scene._stopPerson(); };
      const climb = (level, id) => {
        const spec = FLOORS.find(floor => floor.id === level), core = spec.stairs.find(stair => stair.id === id);
        const firstDirection=core.startDirection??1;
        const stair = scene.buildingEnvironments.get(level).architectureFixtures.getObjectByName(`dryer-building-${level}-${id}`);
        const spanX = core.bounds.maxX - core.bounds.minX, spanZ = core.bounds.maxZ - core.bounds.minZ;
        const lane = Math.min(1.25, ((core.runAxis === 'x' ? spanZ : spanX) - .25) / 2);
        const run = Math.max(1.8, Math.min(4, (core.runAxis === 'x' ? spanX : spanZ) - 1.7));
        const laneOffset = lane / 2 + .06, travel = run + .9;
        const world = local => stair.localToWorld(new THREE.Vector3(...local));
        const start = world([-laneOffset, 0, -firstDirection * (run / 2 + .45)]);
        scene.person = walking.createPersonState({ position: start.toArray() }); scene.personEyeY = null;
        const legDirection = new THREE.Vector3(0, 0, firstDirection).transformDirection(stair.matrixWorld);
        walkLeg(Math.atan2(legDirection.x, -legDirection.z), travel);
        close(scene.person.position[1], spec.elevation + spec.height / 2, `${id} return landing`, .02);
        const across = new THREE.Vector3(1, 0, 0).transformDirection(stair.matrixWorld);
        walkLeg(Math.atan2(across.x, -across.z), laneOffset * 2);
        walkLeg(Math.atan2(-legDirection.x, legDirection.z), travel);
        close(scene.person.position[1], spec.elevation + spec.height, `${id} upper floor landing`, .02);
        for (let tick = 0; tick < 30; tick++) scene._advancePerson(1 / 60);
        close(scene.person.position[1], spec.elevation + spec.height, `${id} stationary landing support`, .02);
      };
      climb(1, 'southeast-stair');
      climb(2, 'northeast-stair');
      assert.equal(scene.activeFloor, selected, 'walking preserves the selected context instead of resetting the person on each landing');
      for (const level of [1, 2, 3]) {
        scene.activeFloor = level; scene.personSupportCache = null;
        const meshes = scene._personSupportMeshes();
        const top = scene.buildingEnvironments.get(2).architectureFixtures.getObjectByName('dryer-building-2-northeast-stair');
        assert.ok(meshes.some(mesh => { for (let node = mesh; node; node = node.parent) if (node === top) return true; return false; }), `${level} selected person context retains the adjoining 3F stair`);
      }
    } finally { s.dispose(); h.dispose(); }
  }
});

test('walking-route obstacle samples refresh at the person height instead of reusing another floor wall cache', async () => {
  const h = await harness({ floor: 2 }), s = modelTools(h.scene);
  try {
    const { scene } = h;
    const lower = new THREE.Group(), upper = new THREE.Group(); scene.scene.add(lower, upper);
    s._box(lower, [2, 2.5, .2], [0, 1.55, 0], s.mat.white);
    s._box(upper, [2, 2.5, .2], [5, 8.55, 0], s.mat.white);
    const empty = () => ({ structure: new THREE.Group(), facade: new THREE.Group() });
    scene.buildingEnvironments = new Map([[1, { ...empty(), facade: lower }], [2, empty()], [3, { ...empty(), facade: upper }]]);
    scene.view = 'person'; scene.person = walking.createPersonState({ position: [0, .3, 0] });
    const downstairs = scene._personObstacles();
    assert.ok(downstairs.some(box => box.minX < 1 && box.maxX > -1));
    scene.person.position[1] = 7.3;
    const upstairs = scene._personObstacles();
    assert.notEqual(upstairs, downstairs, 'a vertical movement invalidates the old obstacle sample');
    assert.equal(upstairs.some(box => box.minX < 1 && box.maxX > -1), false);
    assert.ok(upstairs.some(box => box.minX < 6 && box.maxX > 4));
  } finally { s.dispose(); h.dispose(); }
});

test('selected packaging stairs and the full stacked building use the same instanced tread heights', async () => {
  for (const all of [false, true]) {
    const h = await harness({ floor: 'packaging', packagingLevel: all ? 'all' : 2 }), s = modelTools(h.scene);
    try {
      const { scene } = h;
      scene.packagingEnvironments = new Map((all ? [1, 2, 3] : [2]).map(level => [level, buildPackagingEnvironment(s, PACKAGING_ROOMS[level])]));
      scene.packaging = scene.packagingEnvironments.get(all ? 3 : 2);
      scene.floorDecks.set('packaging', scene.packaging.deck); scene.floorStructures.set('packaging', scene.packaging.structure);
      scene._applyPackagingDisplayOffsets();
      const p = packagingEntryStairPlan(2), base = all ? 0 : -p.rise;
      scene.person = walking.createPersonState({ position: [p.leftLanding, base, p.lanes[0]], yaw: Math.PI / 2 });
      scene.view = 'person'; scene.setPersonInput('forward', true);
      const landingDistance = p.rightLanding - p.leftLanding;
      walkDistance(scene, landingDistance);
      scene._stopPerson();
      close(scene.person.position[1], base + p.rise / p.flights, 'the first flight reaches its actual intermediate landing', .02);
      const landed = scene.person.position[1];
      for (let i = 0; i < 60; i++) scene._advancePerson(1 / 60);
      close(scene.person.position[1], landed, 'the intermediate landing supports a stationary person');
      scene.setPersonInput('backward', true);
      walkDistance(scene, landingDistance);
      scene._stopPerson();
      close(scene.person.position[1], base, 'the same instanced stair descends to its original landing', .02);
      assert.equal(scene.getPackagingLevel(), all ? 'all' : 2);
    } finally { s.dispose(); h.dispose(); }
  }
});


test('the seventh-floor view supports the visible sixth-floor and service-apron stair contexts', async () => {
  const h = await harness({ floor: 7 }), s = modelTools(h.scene);
  try {
    const { scene } = h;
    scene.upperEnvironments = new Map([6,7,8].map(level => {
      const info = FLOORS.find(floor => floor.id === level);
      const environment = buildDryerUpperEnvironment(s, { floor: level, elevation: floorElevation(level), profile: info.roofProfile, roofElevation: floorElevation(8), bounds: info.bounds, chamberOpening: info.chamberOpening });
      scene.floorDecks.set(level, environment.deck); scene.floorStructures.set(level, environment.structure);
      return [level, environment];
    }));
    scene.scene.updateMatrixWorld(true);
    const meshes = scene._personSupportMeshes();
    for (const level of [6,8]) {
      const stair = scene.upperEnvironments.get(level).stairs, tread = stair.children.find(child => child.isMesh && child.geometry.type === 'BoxGeometry');
      assert.ok(meshes.includes(tread), 'a visible adjoining stair is a support candidate');
      const top = new THREE.Box3().setFromObject(tread), mid = top.getCenter(new THREE.Vector3());
      const support = scene._personGroundHeight([mid.x, top.max.y - .1, mid.z], meshes);
      close(support, top.max.y, 'the adjoining tread uses its actual world height', .02);
    }
    scene.activeFloor = 'all'; scene.personSupportCache = null;
    const all = scene._personSupportMeshes();
    assert.ok(all.length >= meshes.length, 'the whole-building view includes adjoining floor support');
  } finally { s.dispose(); h.dispose(); }
});

test('the real rotated boiler stair starts on its floor and excludes the pumps underneath', async () => {
  const h = await harness({ floor: 'campus' }), s = modelTools(h.scene);
  try {
    const { scene } = h, item = { id: 'boiler-fixture', floor: 'campus', type: 'campus-boiler-room', position: [10,0,-15], rotation: .7, width:13.5, depth:14, height:6.2 };
    const root = s._group(scene.scene, item.position); root.rotation.y = item.rotation;
    scene.equipment.push(item); scene.objects.set(item.id, root); buildCampusBoilerRoom(s, root, item);
    scene.scene.updateMatrixWorld(true);
    const meshes = scene._personSupportMeshes(), stair = root.getObjectByName('campus-boiler-internal-concrete-stair');
    const start = stair.localToWorld(new THREE.Vector3(-1.4, 0, -6.28));
    scene.person = walking.createPersonState({ position: start.toArray(), yaw: -Math.PI / 2 - item.rotation });
    scene.view='person'; scene.setPersonInput('forward', true);
    walkDistance(scene, 5);
    scene._stopPerson();
    close(scene.person.position[1], 3.44, 'the rotated stair reaches its landing', .02);
    const pumps = root.getObjectByName('campus-boiler-under-stair-vertical-pumps');
    pumps.traverse(mesh => { if (mesh.isMesh) assert.ok(!meshes.includes(mesh), 'pump components are not walkable surfaces'); });
  } finally { s.dispose(); h.dispose(); }
});

test('fast walking collides with thin physical glass and refreshes a moved wall without using equipment group bounds', async () => {
  const h=await harness(),s=modelTools(h.scene);
  try{
    const {scene}=h,ground=floorElevation(7),structure=s._group(scene.scene);
    const glass=s._box(structure,[5,3,.008],[0,ground+1.5,2],s._material(0xaaccdd,.2,.05,{transparent:true,opacity:.15}));
    scene.floorStructures.set(7,structure);scene.view='person';scene.person=walking.createPersonState({position:[0,ground,6]});
    scene.setPersonInput('forward',true);scene.setPersonInput('fast',true);walkDistance(scene,10);
    assert.ok(scene.person.position[2]>=2.299&&scene.person.position[2]<2.36,'the full body stops before a glass pane thinner than one movement substep');
    glass.position.z=-2;scene.person=walking.createPersonState({position:[0,ground,6]});walkDistance(scene,10);scene._stopPerson();
    assert.ok(scene.person.position[2]<-1.64&&scene.person.position[2]>=-1.701,'a moved wall refreshes its actual world-space collision shape');
  }finally{s.dispose();h.dispose();}
});

test('real narrow openings respect the body diameter and an opened rotated leaf leaves its real empty passage', async () => {
  const h=await harness(),s=modelTools(h.scene);
  try{
    const {scene}=h,ground=floorElevation(7),structure=s._group(scene.scene),left=s._box(structure,[.2,3,.2],[-.41,ground+1.5,0],s.mat.white),right=s._box(structure,[.2,3,.2],[.41,ground+1.5,0],s.mat.white);
    scene.floorStructures.set(7,structure);scene.view='person';scene.person=walking.createPersonState({position:[0,ground,2]});scene.setPersonInput('forward',true);walkDistance(scene,4);
    assert.ok(scene.person.position[2]<-1.9,'a 62cm real opening stays passable rather than using the whole frame group rectangle');
    left.position.x=-.39;right.position.x=.39;scene.person=walking.createPersonState({position:[0,ground,2]});walkDistance(scene,4);
    assert.ok(scene.person.position[2]>.1,'a 58cm gap cannot fit the 60cm body');
    left.position.x=-2;right.position.x=2;
    const hinge=s._group(structure,[-.6,ground,0]);s._box(hinge,[1.2,2.3,.025],[.6,1.15,0],s.mat.white);
    // Clear only the collider list after introducing a new model object.
    scene.personCollisionMeshCache=null;scene.person=walking.createPersonState({position:[0,ground,2]});walkDistance(scene,4);
    assert.ok(scene.person.position[2]>.29,'a real closed leaf blocks the body');
    hinge.rotation.y=Math.PI/2;scene.person=walking.createPersonState({position:[0,ground,2]});walkDistance(scene,4);scene._stopPerson();
    assert.ok(scene.person.position[2]<-1.9,'rotation of the same leaf opens the real passage without dropping collision from the leaf');
  }finally{s.dispose();h.dispose();}
});

test('full standing height blocks a low ceiling above eye level while a raised ceiling permits the same route', async () => {
  const h=await harness(),s=modelTools(h.scene);
  try{
    const {scene}=h,ground=floorElevation(7),structure=s._group(scene.scene),ceiling=s._box(structure,[5,.12,4],[0,ground+1.76,0],s.mat.white);
    scene.floorStructures.set(7,structure);scene.view='person';scene.person=walking.createPersonState({position:[0,ground,4]});scene.setPersonInput('forward',true);walkDistance(scene,7);
    assert.ok(scene.person.position[2]>2,'a ceiling above the eye but below the top of the head blocks entry');
    ceiling.position.y+=.3;scene.person=walking.createPersonState({position:[0,ground,4]});walkDistance(scene,7);scene._stopPerson();
    assert.ok(scene.person.position[2]<-2.9,'the raised ceiling permits the same walking route');
  }finally{s.dispose();h.dispose();}
});

test('outdoor physical wall collision uses the rotated room frame rather than its conservative world rectangle', async () => {
  const h=await harness({floor:'outdoor'}),s=modelTools(h.scene);
  try{
    const {scene}=h,structure=s._group(scene.scene,OUTDOOR_ROOM.anchor);structure.rotation.y=OUTDOOR_ROOM.rotation;
    s._box(structure,[4,3,.01],[20,1.5,0],s.mat.white);scene.floorStructures.set('outdoor',structure);
    scene.view='person';scene.person=walking.createPersonState({position:[20,0,2]});scene.setPersonInput('forward',true);walkDistance(scene,4);scene._stopPerson();
    assert.ok(scene.person.position[2]>=.299&&scene.person.position[2]<.35,'the body stops at the actual room-local glass/wall plane');
    close(scene.person.position[0],20,'collision keeps the requested local heading');
  }finally{s.dispose();h.dispose();}
});

test('the fitted preparation boiler keeps its physical equipment without restoring its explicitly omitted reference envelope as collision',async()=>{
  const h=await harness({floor:1}),s=modelTools(h.scene);
  try{
    const {scene}=h,item=PREPARATION_EQUIPMENT.find(item=>item.id==='f1-boiler-room'),root=s._group(scene.scene,item.position);
    scene.equipment.push(item);scene.objects.set(item.id,root);buildPreparationBoilerRoom(s,root,item);scene.view='person';
    const omitted=[];root.traverse(mesh=>{if(!mesh.isMesh)return;for(let node=mesh;node&&node!==root;node=node.parent)if(node.userData.preparationEnvelopeOmitted){omitted.push(mesh);break;}});
    assert.ok(omitted.length>0,'the actual fitted room deliberately omits its superseded reference walls');
    const bodies=scene._personCollisionBodies();
    assert.ok(bodies.some(body=>body.mesh.parent.name==='campus-boiler-visible-wall-and-overhead-pipes'),'the real fitted equipment and pipes remain physical');
    assert.equal(bodies.some(body=>omitted.includes(body.mesh)),false,'omitted reference walls must never become invisible physical barriers');
  }finally{s.dispose();h.dispose();}
});
