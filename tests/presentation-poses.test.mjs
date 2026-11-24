import test from 'node:test';
import * as walking from '../apps/site/person-walk.js';
import { TOUR_STEPS, createPresentationTour } from '../apps/presentation/tour.js';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from '../apps/shared/vendor/three.module.js';
import { EQUIPMENT, FLOORS, FLOOR_HEIGHT, floorElevation, floorHeight } from '../apps/site/building-data.js';
import { buildDryerUpperEnvironment, buildDryerUpperEquipment } from '../apps/site/dryer-upper-models.js';
import { buildFacilityEquipment } from '../apps/site/facility-models.js';
import { buildDryerProcessEquipment } from '../apps/site/dryer-process-models.js';
import { buildPreparationEquipment } from '../apps/site/preparation-models.js';
import { buildPreparationBoilerRoom } from '../apps/site/boiler-models.js';
import { buildPreparationEnvironment } from '../apps/site/preparation-environment.js';
import { buildDryerRouteEnvironment } from '../apps/site/dryer-route-environment.js';
import { buildDryerCompressorEnvironment } from '../apps/site/dryer-compressor-environment.js';
import { buildDryerBuildingEnvironment, alignDryerCompressorEntrance } from '../apps/site/dryer-building-envelope.js';
import { buildDryerCompressorInteriorDetails } from '../apps/site/dryer-compressor-interior-details.js';
import { buildFurnace } from '../apps/site/furnace-model.js';
import { createProximityDoorController } from '../apps/site/proximity-doors.js';
import { OUTDOOR_ROOM } from '../apps/site/outdoor-data.js';
import { CAMPUS_ROOM } from '../apps/site/campus-data.js';
import { PACKAGING_ROOM, PACKAGING_ROOMS, PACKAGING_OVERVIEW, PACKAGING_FLOOR_ELEVATIONS } from '../apps/site/packaging-data.js';
import { PLACEMENT_RULES, PLACEMENT_REGIONS, constrainPlacement, rotatedFootprint, fromRoomPosition, toRoomPosition } from '../apps/site/placement-rules.js';

function eventTarget() {
  const handlers = new Map();
  return {
    handlers,
    addEventListener(type, callback) { if (!handlers.has(type)) handlers.set(type, new Set()); handlers.get(type).add(callback); },
    removeEventListener(type, callback) { handlers.get(type)?.delete(callback); },
    dispatch(type, event = {}) { const value = { target: this, preventDefault() {}, ...event }; handlers.get(type)?.forEach(callback => callback(value)); },
  };
}

async function presentationScene() {
  const source = (await readFile(new URL('../apps/site/scene.js', import.meta.url), 'utf8'))
    .replace(/^import .*;\r?\n/gm, '').replace(/^export\s+(?=(?:function|class|const|let)\b)/gm, '');
  // Canvas text and the GPU renderer are the only rendering substitutes. All
  // scene helpers, equipment, floors, bounds, picking and cameras are real.
  const document = Object.assign(eventTarget(), { hidden: false, querySelector: () => null, createElement(tag) {
    if (tag === 'canvas') return { width: 0, height: 0, getContext: () => ({ fillRect() {}, fillText() {} }) };
    return { style: {}, setAttribute() {}, remove() {} };
  } });
  document.defaultView = eventTarget();
  const timers = new Map(); let nextTimer = 0;
  const context = vm.createContext({ THREE, ...walking, FLOORS, FLOOR_HEIGHT, floorElevation, floorHeight,
    buildDryerUpperEnvironment, buildDryerUpperEquipment, buildDryerBuildingEnvironment, buildDryerProcessEquipment, buildPreparationEquipment, buildPreparationBoilerRoom, buildPreparationEnvironment, buildDryerRouteEnvironment, buildDryerCompressorEnvironment, buildDryerCompressorInteriorDetails, alignDryerCompressorEntrance, buildFacilityEquipment, buildFurnace,
    OUTDOOR_ROOM, CAMPUS_ROOM, PACKAGING_ROOM, PACKAGING_ROOMS, PACKAGING_OVERVIEW, PACKAGING_FLOOR_ELEVATIONS,
    PLACEMENT_RULES, PLACEMENT_REGIONS, constrainPlacement, rotatedFootprint, fromRoomPosition, toRoomPosition, document,
    setTimeout: callback => { const id = ++nextTimer; timers.set(id, callback); return id; }, clearTimeout: id => timers.delete(id) });
  new vm.Script(`${source}\nglobalThis.FacilityScene = FacilityScene;`).runInContext(context);
  const scene = Object.create(context.FacilityScene.prototype), selections = [];
  let viewport = { left: 0, top: 0, width: 1100, height: 760 };
  const emptyEnvironment = () => Object.fromEntries(['deck', 'structure', 'ducts'].map(key => [key, new THREE.Group()]));
  Object.assign(scene, {
    scene: new THREE.Scene(), objects: new Map(), parts: [], pickables: [], materials: new Set(), geometries: new Set(), textures: new Set(),
    equipment: EQUIPMENT.filter(item => item.floor <= 8 && item.id !== 'f1-boiler-room' && !item.samePhysicalRoomAs).map(item => ({ ...item, position: [...item.position] })),
    placementDefaults: new Map(EQUIPMENT.map(item => [item.id, { ...item, position: [...item.position] }])),
    placementFootprints: new Map(), placementResults: new Map(), floorDecks: new Map(), floorStructures: new Map(),
    canvas: Object.assign(eventTarget(), { style: {}, dataset: {}, ownerDocument: document,
      getBoundingClientRect: () => viewport, parentElement: { getBoundingClientRect: () => viewport, append() {} },
      setPointerCapture() {}, hasPointerCapture: () => false, releasePointerCapture() {}, focus() {},
    }),
    renderer: { setSize() {} }, camera: new THREE.PerspectiveCamera(42, 1, .02, 3000),
    topCamera: new THREE.OrthographicCamera(-18, 18, 18, -18, .02, 3000), raycaster: new THREE.Raycaster(),
    target: new THREE.Vector3(), goalTarget: new THREE.Vector3(), orbit: { azimuth: .65, elevation: .5, distance: 60 }, goalOrbit: { azimuth: .65, elevation: .5, distance: 60 },
    activeFloor: 'all', view: 'perspective', selected: null, hovered: null, labels: [], floorLabels: [], listeners: [],
    structureEnabled: true, ductsEnabled: true, isolated: false, placementMode: false, explosion: 0, amount: 0,
    navigationEdited: false, packagingLevel: 'all', packagingCargoVisible: false, packagingEnvironments: new Map(),
    outdoor: emptyEnvironment(), campus: emptyEnvironment(), survey: new THREE.Group(), disposed: false,
    onViewChange() {}, onNavigationChange() {}, onTransformChange() {}, onSelect: id => selections.push(id),
    _invalidate() {},
  });
  scene.topCamera.up.set(0, 0, -1);
  scene._palette(); scene._environment(); scene._buildingFloors();
  for (const item of scene.equipment) scene._equipment(item);
  scene.ducts = scene.upperEnvironments.get(6).ducts;
  scene._placementFootprints(); scene._visibility();
  const settle = () => {
    scene.target.copy(scene.goalTarget); Object.assign(scene.orbit, scene.goalOrbit);
    scene._updateCamera(); scene.scene.updateMatrixWorld(true); return scene._currentCamera();
  };
  scene.resize(); scene.setFloor(6); settle();
  Object.assign(scene, { enabledAreas: new Set(['dryer']), personEnabled: true, presentationOnly: true, presentationInspection: false, controlledPresentation: true, personCamera: new THREE.PerspectiveCamera(65, 1.5, .02, 3000), personInputs: new Set(), personStates: new Map(), personArea: null, personAvatar: new THREE.Group(), personLimbs: [] });
  return { scene, selections, settle,
    flushPicks() { const pending = [...timers.values()]; timers.clear(); pending.forEach(callback => callback()); },
    resize(width, height) { viewport = { ...viewport, width, height }; scene.resize(); },
    dispose() { scene.listeners.forEach(remove => remove()); scene.geometries.forEach(value => value.dispose()); scene.materials.forEach(value => value.dispose()); scene.textures.forEach(value => value.dispose()); },
  };
}

function solidSamples(scene) {
  const samples = [], temporary = new THREE.Matrix4();
  scene.scene.traverseVisible(mesh => {
    if (!mesh.isMesh || (mesh.material.transparent && mesh.material.opacity < .99)) return;
    if (!['BoxGeometry', 'CylinderGeometry', 'LatheGeometry'].includes(mesh.geometry.type)) return;
    mesh.geometry.computeBoundingBox();
    for (let index = 0; index < (mesh.isInstancedMesh ? mesh.count : 1); index++) {
      const matrix = mesh.matrixWorld.clone();
      if (mesh.isInstancedMesh) { mesh.getMatrixAt(index, temporary); matrix.multiply(temporary); }
      samples.push({ mesh, inverse: matrix.clone().invert(), bounds: mesh.geometry.boundingBox.clone().applyMatrix4(matrix) });
    }
  });
  return samples;
}

function contains(sample, point) {
  if (!sample.bounds.containsPoint(point)) return false;
  const local = point.clone().applyMatrix4(sample.inverse), geometry = sample.mesh.geometry, box = geometry.boundingBox;
  if (local.y <= box.min.y + .003 || local.y >= box.max.y - .003) return false;
  if (geometry.type === 'BoxGeometry') return local.x > box.min.x + .003 && local.x < box.max.x - .003 && local.z > box.min.z + .003 && local.z < box.max.z - .003;
  if (geometry.type === 'LatheGeometry') {
    const profile = geometry.parameters.points;
    let radius = 0;
    for (let index = 1; index < profile.length; index++) {
      const a = profile[index - 1], b = profile[index];
      if (local.y < Math.min(a.y, b.y) || local.y > Math.max(a.y, b.y)) continue;
      const fraction = Math.abs(b.y - a.y) < 1e-9 ? 0 : (local.y - a.y) / (b.y - a.y);
      radius = Math.max(radius, a.x + (b.x - a.x) * fraction);
    }
    return local.x ** 2 + local.z ** 2 < (radius - .003) ** 2;
  }
  if (geometry.parameters.openEnded) return false;
  const fraction = (local.y - box.min.y) / (box.max.y - box.min.y);
  const radius = geometry.parameters.radiusBottom + (geometry.parameters.radiusTop - geometry.parameters.radiusBottom) * fraction;
  return local.x ** 2 + local.z ** 2 < (radius - .003) ** 2;
}

test('all fixed presentation shots stand on actual walking surfaces and keep the person clear of solid objects', async () => {
  const h = await presentationScene();
  try {
    const { scene } = h;
    for (const step of TOUR_STEPS.filter(step => step.shots)) {
      scene.setFloor(step.floor); scene.view = 'person'; scene._visibility();
      scene.scene.traverse(node => {
        const door = node.userData.proximityDoor;
        if (door) node[door.kind === 'hinge' ? 'rotation' : 'position'][door.axis] = door.open;
      });
      scene.scene.updateMatrixWorld(true);
      const surfaces = scene._personSupportMeshes(), solids = solidSamples(scene);
      const bodyOffsets = [[0, 0], ...Array.from({ length: 12 }, (_, index) => [Math.sin(index * Math.PI / 6) * walking.WALK_RULES.radius, Math.cos(index * Math.PI / 6) * walking.WALK_RULES.radius])];
      const opaque = [];
      scene.scene.traverseVisible(mesh => { if (mesh.isMesh && !(mesh.material.transparent && mesh.material.opacity < .99)) opaque.push(mesh); });
      for (const [index, shot] of step.shots.entries()) {
        const path = shot.path || [shot.from, shot.to];
        for (let leg = 1; leg < path.length; leg++) {
          const from = path[leg - 1], to = path[leg], distance = new THREE.Vector3(...from.position).distanceTo(new THREE.Vector3(...to.position));
          const intervals = Math.max(4, Math.ceil(distance / .3));
          for (let sample = 0; sample <= intervals; sample++) {
            const fraction = sample / intervals;
            const position = new THREE.Vector3(...from.position).lerp(new THREE.Vector3(...to.position), fraction);
            const ray = new THREE.Raycaster(position.clone().add(new THREE.Vector3(0, .32, 0)), new THREE.Vector3(0, -1, 0), 0, .8);
            const support = ray.intersectObjects(surfaces, false).find(hit => hit.face && hit.face.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).y > .7);
            const label = `${step.id} shot ${index} leg ${leg} at ${fraction}`;
            assert.ok(support, `${label}: an actual mesh supports the feet, without the free-walk datum fallback`);
            assert.ok(Math.abs(position.y - support.point.y) < .15, `${label}: the feet stay close to their walking surface`);
            for (const [dx, dz] of bodyOffsets) for (const height of [.35, .9, 1.4, 1.65]) {
              const point = position.clone().add(new THREE.Vector3(dx, height, dz));
              const collision = solids.find(sample => contains(sample, point));
              assert.ok(!collision, `${label}: body clearance at ${dx},${height},${dz} (${collision?.mesh.parent?.name})`);
            }
            const eye = position.clone().add(new THREE.Vector3(0, walking.WALK_RULES.eyeHeight));
            const target = new THREE.Vector3(...from.lookAt).lerp(new THREE.Vector3(...to.lookAt), fraction), direction = target.sub(eye);
            const forward = direction.clone().normalize(), right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();
            const up = new THREE.Vector3().crossVectors(right, forward).normalize();
            let blocked = 0;
            for (const x of [-.12, 0, .12]) for (const y of [-.12, 0, .12]) {
              const sight = forward.clone().addScaledVector(right, x).addScaledVector(up, y).normalize();
              const front = new THREE.Raycaster(eye, sight, .01, Math.min(direction.length(), 1)).intersectObjects(opaque, false)[0];
              if (front) blocked++;
            }
            assert.ok(blocked < 7, `${label}: a broad opaque surface must not fill the camera within one metre (${blocked}/9 samples)`);
          }
        }
      }
    }
  } finally { h.dispose(); }
});

test('the controlled camera accepts dryer poses, locks manual input and rejects external areas without changing equipment', async () => {
  const h = await presentationScene();
  try {
    const { scene } = h, layout = scene.getLayout();
    const step = TOUR_STEPS.find(step => step.id === 'seventh'), pose = structuredClone(step.shots[0].from);
    scene.personInputs.add('forward');
    assert.equal(scene.setPresentationPose({ floor: step.floor, ...pose }), true);
    assert.equal(scene.activeFloor, 7); assert.equal(scene.view, 'person'); assert.equal(scene.personInputs.size, 0);
    assert.equal(scene.autoOpenDoors, false, 'the scripted presentation never enables approach sensors');
    assert.ok(Math.abs(scene.personCamera.position.y - (pose.position[1] + walking.WALK_RULES.eyeHeight)) < 1e-7);
    const expected = new THREE.Vector3(...pose.lookAt).sub(scene.personCamera.position).normalize();
    assert.ok(scene.personCamera.getWorldDirection(new THREE.Vector3()).distanceTo(expected) < 1e-7);
    const position = scene.person.position.slice(); pose.position[0] += 99;
    assert.deepEqual([...scene.person.position], [...position], 'the caller cannot mutate the active pose afterwards');
    for (const action of ['forward', 'backward', 'left', 'right', 'fast']) scene.setPersonInput(action, true);
    assert.equal(scene.personInputs.size, 0, 'manual movement cannot take over an automatic shot');
    for (const floor of ['campus', 'outdoor', 'packaging', 'liquid', 'all', 9]) {
      assert.equal(scene.setPresentationPose({ floor, ...step.shots[0].from }), false);
      scene.setFloor(floor); assert.equal(scene.activeFloor, 7, 'presentation stays inside its dryer floor route');
    }
    assert.equal(scene.setPresentationPose({ floor: 1, position: [NaN, 0, 0], lookAt: [0, 1, 0] }), false);
    assert.deepEqual(scene.getLayout(), layout, 'scripted camera movement never relocates machinery');
  } finally { h.dispose(); }
});

test('finished inspection enables plan and perspective navigation once while retaining the dryer boundary', async () => {
  const h = await presentationScene();
  try {
    const { scene } = h, canvas = scene.canvas, layout = scene.getLayout();
    scene._controls();
    assert.equal(canvas.handlers.has('wheel'), false, 'automatic playback initially registers no manual navigation');
    const seventh = TOUR_STEPS.find(step => step.floor === 7).shots[0].from;
    scene.setPresentationPose({ floor: 7, ...seventh });
    assert.equal(scene.setPresentationInspection(true), true);
    assert.equal(scene.controlledPresentation, false);
    assert.equal(scene.autoOpenDoors, false, 'finished presentation inspection also keeps doors manual');
    assert.equal(scene.presentationOnly, true);
    assert.equal(scene.activeFloor, 7); assert.equal(scene.view, 'perspective');
    assert.ok(scene.goalOrbit.distance > 14, 'finished inspection fits the floor instead of retaining the close walking camera');
    const registrations = scene.listeners.length;
    const wheel = deltaY => canvas.dispatch('wheel', { deltaY, deltaMode: 0, clientX: 550, clientY: 380 });
    const distance = scene.goalOrbit.distance;
    wheel(-80); assert.ok(scene.goalOrbit.distance < distance, 'wheel navigation zooms the perspective');
    canvas.dispatch('pointerdown', { pointerId: 1, button: 2, clientX: 550, clientY: 380 });
    const panStart = scene.goalTarget.clone();
    canvas.dispatch('pointermove', { pointerId: 1, button: 2, clientX: 590, clientY: 400 });
    assert.ok(scene.goalTarget.distanceTo(panStart) > .01, 'right drag pans the actual scene');
    canvas.dispatch('pointerup', { pointerId: 1, button: 2, clientX: 590, clientY: 400 });
    scene.setFloor(1); scene.setView('top'); h.settle();
    const box = new THREE.Box3().setFromObject(scene.floorDecks.get(1));
    assert.ok(box.getSize(new THREE.Vector3()).x >= 42, 'the manual plan includes the full first-floor ground');
    const zoom = scene.topCamera.zoom; wheel(-80);
    assert.ok(scene.topCamera.zoom > zoom, 'plan navigation uses the same wheel controls');
    const planTarget = scene.goalTarget.clone();
    scene._hit = () => scene.objects.get('f1-mix-b');
    canvas.dispatch('pointerdown', { pointerId: 2, button: 0, clientX: 550, clientY: 380 });
    canvas.dispatch('pointerup', { pointerId: 2, button: 0, clientX: 550, clientY: 380 });
    h.flushPicks(); assert.ok(h.selections.includes('f1-mix-b'), 'manual inspection retains equipment selection');
    assert.ok(scene.goalTarget.equals(planTarget), 'selection does not relocate the plan');
    for (const floor of ['campus', 'outdoor', 'packaging', 'liquid', 9]) { scene.setFloor(floor); assert.equal(scene.activeFloor, 1); }
    for (const view of ['person', 'aisle']) { scene.setView(view); assert.equal(scene.view, 'top', 'inspection stays in its plan and perspective views'); }
    scene.setFloor(7); scene.setView('perspective');
    scene.setFloor('roof');
    assert.equal(scene.activeFloor, 8);
    assert.equal(scene.upperEnvironments.get(8).deck.visible, true, 'the dryer roof is part of the requested inspection scope');
    scene.setPresentationInspection(false); scene.setPresentationInspection(true); scene.setPresentationInspection(true); scene._controls();
    assert.equal(scene.listeners.length, registrations, 'replay and repeat inspection do not duplicate input or GPU context listeners');
    assert.deepEqual(scene.getLayout(), layout);
  } finally { h.dispose(); }
});

test('restarting after inspection clears in-flight gestures and restores scripted camera input locking', async () => {
  const h = await presentationScene();
  try {
    const { scene } = h, canvas = scene.canvas;
    scene._controls(); scene.setPresentationInspection(true);
    canvas.dispatch('pointerdown', { pointerId: 1, button: 2, clientX: 400, clientY: 300 });
    assert.equal(scene.setPresentationInspection(false), true);
    assert.equal(scene.controlledPresentation, true); assert.equal(scene.presentationInspection, false);
    const first = TOUR_STEPS[0].shots[0].from;
    assert.equal(scene.setPresentationPose({ floor: 1, ...first }), true);
    const orbit = { ...scene.goalOrbit }, target = scene.goalTarget.clone(), pose = scene.person.position.slice();
    canvas.dispatch('pointermove', { pointerId: 1, button: 2, clientX: 600, clientY: 400 });
    canvas.dispatch('pointerup', { pointerId: 1, button: 2, clientX: 600, clientY: 400 });
    canvas.dispatch('wheel', { deltaY: -100, deltaMode: 0, clientX: 550, clientY: 380 });
    canvas.dispatch('dblclick', { clientX: 550, clientY: 380 });
    canvas.dispatch('keydown', { key: 'ArrowUp' });
    h.flushPicks();
    assert.deepEqual(scene.goalOrbit, orbit); assert.ok(scene.goalTarget.equals(target));
    assert.deepEqual(scene.person.position, pose); assert.equal(scene.personInputs.size, 0);
    assert.equal(h.selections.length, 0, 'a released inspection gesture cannot select in the restarted tour');
    assert.equal(scene.activeFloor, 1); assert.equal(scene.view, 'person');
  } finally { h.dispose(); }
});

test('presentation door waiting positions clear the full moving-leaf sweep before continuing the walk', async () => {
  const h = await presentationScene();
  const scene = h.scene, controller = createProximityDoorController(scene.scene);
  scene.proximityDoors = controller;
  const bodyOffsets = [[0, 0], ...Array.from({ length: 12 }, (_, index) => [Math.sin(index * Math.PI / 6) * walking.WALK_RULES.radius, Math.cos(index * Math.PI / 6) * walking.WALK_RULES.radius])];
  const inspected = new Set();
  try {
    for (const step of TOUR_STEPS.filter(step => step.shots)) {
      scene.setFloor(step.floor); scene.view = 'person'; scene._visibility(); controller.reset();
      for (const [shotIndex, shot] of step.shots.entries()) {
        const path = shot.path || [shot.from, shot.to];
        scene.setPresentationPose({ floor: step.floor, ...path[0] });
        for (let leg = 1; leg < path.length; leg++) {
          const from = path[leg - 1], to = path[leg], distance = new THREE.Vector3(...from.position).distanceTo(new THREE.Vector3(...to.position));
          const intervals = Math.max(4, Math.ceil(distance / .025));
          for (let sample = 1; sample <= intervals; sample++) {
            const fraction = sample / intervals;
            const nextPose = { floor: step.floor,
              position: new THREE.Vector3(...from.position).lerp(new THREE.Vector3(...to.position), fraction).toArray(),
              lookAt: new THREE.Vector3(...from.lookAt).lerp(new THREE.Vector3(...to.lookAt), fraction).toArray(),
            };
            const door = scene.getPresentationDoorState(nextPose);
            if (door?.blocked) {
              const stop = new THREE.Vector3(...scene.person.position), leaves = [];
              scene.scene.traverseVisible(node => {
                const id = node.userData.proximityDoor?.groupId;
                if (id && (door.id === id || door.id.endsWith(`:${id}`))) leaves.push(node);
              });
              assert.ok(leaves.length, `${door.label}: the waiting action targets real moving door leaves`);
              assert.equal(scene.interactPresentationDoor(door.id), true);
              inspected.add(door.id);
              for (let frame = 0; frame < 70; frame++) {
                scene._updateProximityDoors(1 / 120); scene.scene.updateMatrixWorld(true);
                const solids = leaves.flatMap(leaf => solidSamples({ scene: leaf }));
                for (const [dx, dz] of bodyOffsets) for (const height of [.35, .9, 1.4, 1.65]) {
                  const point = stop.clone().add(new THREE.Vector3(dx, height, dz));
                  const collision = solids.find(solid => contains(solid, point));
                  assert.ok(!collision, `${step.id} shot ${shotIndex} ${door.label}: opening leaf must clear the waiting person at ${dx},${height},${dz} (${collision?.mesh.parent?.name})`);
                }
              }
              assert.equal(controller.getPassages({ includeAll: true }).find(value => value.id === door.id)?.open, true);
            }
            scene.setPresentationPose(nextPose);
          }
        }
      }
    }
    assert.ok(inspected.size >= 3, 'the real route waits at multiple architectural entrances');
  } finally { controller.dispose(); h.dispose(); }
});

test('the real presentation finishes its stairs and explicit door operations within the rehearsal duration', async (context) => {
  const h = await presentationScene(), scene = h.scene;
  const doors = createProximityDoorController(scene.scene), callbacks = new Map(), operations = [];
  scene.proximityDoors = doors;
  let clock = 0, frameId = 0, state;
  const operate = scene.interactPresentationDoor.bind(scene);
  scene.interactPresentationDoor = id => {
    const door = doors.getPassages({ includeAll: true }).find(value => value.id === id);
    const changed = operate(id);
    if (changed) operations.push({ id, label: door?.label, floor: scene.activeFloor, height: scene.person.position[1], opening: door?.action === 'open' });
    return changed;
  };
  const tour = createPresentationTour({ scene, furnace: { open() {}, close() {}, setPresentationState() {} },
    onChange: value => { state = value; }, now: () => clock,
    requestFrame: callback => { const id = ++frameId; callbacks.set(id, callback); return id; },
    cancelFrame: id => callbacks.delete(id),
  });
  try {
    tour.play();
    for (let frame = 0; frame < 240 * 60 && state.status !== 'finished'; frame++) {
      clock += 1000 / 60;
      scene._updateProximityDoors(1 / 60);
      const pending = [...callbacks.values()]; callbacks.clear();
      pending.forEach(callback => callback(clock));
    }
    assert.equal(state.status, 'finished', `the actual scene must finish instead of waiting forever at ${state.doorInteraction?.label || state.step?.id}`);
    assert.equal(state.elapsed, state.totalDuration);
    assert.ok(clock / 1000 >= state.totalDuration && clock / 1000 < 240, `door holds fit the rehearsal window (${clock / 1000}s)`);
    assert.ok(operations.some(value => value.opening && /고속문|셔터/.test(value.label)), 'the real rolling shutter receives an explicit opening action');
    assert.ok(operations.some(value => value.opening && /OP실/.test(value.label)), 'the route explicitly operates the OP room door');
    assert.ok(operations.some(value => value.opening && value.floor === 2 && value.height > 6 && /3층/.test(value.label)), 'the third-floor arrival door remains discoverable while climbing in the mezzanine scene');
    assert.equal(scene.activeFloor, 7); assert.equal(scene.presentationInspection, true);
    // Reuse the exact doors operated by playback. Opening unrelated side-room
    // doors would introduce leaves which are never present on the real route.
    const opened=new Set(operations.filter(operation=>operation.opening).map(operation=>operation.id));
    let capsuleSamples=0;
    scene.controlledPresentation=true;
    for(const step of TOUR_STEPS.filter(step=>step.shots)){
      scene.setFloor(step.floor);scene.view='person';scene._visibility();
      for(const door of doors.getPassages({includeAll:true}))doors.setPassageOpen(door.id,opened.has(door.id),{immediate:true});
      scene.scene.updateMatrixWorld(true);
      const bodies=scene._personCollisionBodies(),supports=new Set(scene._personSupportMeshes());
      for(const [shotIndex,shot]of step.shots.entries()){
        const path=shot.path||[shot.from,shot.to];
        for(let leg=1;leg<path.length;leg++){
          const from=new THREE.Vector3(...path[leg-1].position),to=new THREE.Vector3(...path[leg].position),samples=Math.max(4,Math.ceil(from.distanceTo(to)/.08));
          for(let sample=0;sample<=samples;sample++){
            const position=from.clone().lerp(to,sample/samples).toArray();
            const collisions=scene._personBodyPenetrations(position,bodies,supports);capsuleSamples++;
            const first=collisions.keys().next().value;
            assert.equal(collisions.size,0,`${step.id} shot${shotIndex} leg${leg} ${position}: complete capsule against ${first?.mesh.name||first?.mesh.parent?.name}`);
          }
        }
      }
    }
    assert.ok(capsuleSamples>2500,'the complete walking route is sampled more finely than a stair tread');
    context.diagnostic(`${state.totalDuration}s timeline completed in ${(clock / 1000).toFixed(2)}s with ${operations.length} explicit door actions`);
    context.diagnostic(`${capsuleSamples} complete-body capsule samples passed with only the ${opened.size} scripted doors open`);
  } finally { tour.dispose(); doors.dispose(); h.dispose(); }
});

test('cutaway views reveal only explicitly shared stairs from adjoining floors and preserve hidden fixtures', async () => {
  const h = await presentationScene(), scene = h.scene;
  try {
    const first = scene.buildingEnvironments.get(1), mezzanine = scene.buildingEnvironments.get(2);
    const originalHidden = new THREE.Group(); originalHidden.visible = false;
    first.architectureFixtures.add(originalHidden);
    scene.setPresentationInspection(true);
    for (const floor of [1, 2, 1, 3, 2, 1]) {
      scene.setFloor(floor); scene.setView('perspective');
      for (const [level, environment] of scene.buildingEnvironments) {
        if (level === floor) continue;
        const visible = environment.architectureFixtures.children.filter(child => child.visible);
        for (const child of visible) assert.ok(child.userData.stepsRepresentative && child.userData.visibleFloors?.includes(floor), `${floor}F: only the explicitly shared stair can appear from ${level}F`);
        assert.equal(environment.architectureFixtures.visible, visible.length > 0, `${floor}F: the adjoining fixture container follows its shared stairs`);
      }
      assert.equal(originalHidden.visible, false, 'switching away and back cannot resurrect an intentionally hidden fixture');
      if (floor === 1) assert.ok(mezzanine.architectureFixtures.children.some(child => child.visible && child.userData.stepsRepresentative), 'the mezzanine downward stairs remain visible from their first-floor landings');
      if (floor === 2) assert.equal(first.architectureFixtures.getObjectByName('dryer-building-1-southeast-stair').visible, true, 'the first-floor entrance stair remains visible beside the mezzanine landing');
    }
    scene.setStructure(false);
    for (const environment of scene.buildingEnvironments.values()) assert.equal(environment.architectureFixtures.visible, false);
    scene.setStructure(true); scene.isolated = true; scene._visibility();
    for (const environment of scene.buildingEnvironments.values()) assert.equal(environment.architectureFixtures.visible, false);
  } finally { h.dispose(); }
});

test('finished inspection offers the whole dryer in plan and perspective while replay keeps its route restriction', async () => {
  const h = await presentationScene(), scene = h.scene;
  try {
    const layout = scene.getLayout();
    scene.setFloor(1); scene.setFloor('all');
    assert.equal(scene.activeFloor, 1, 'ready and controlled playback cannot enter the whole-building inspection');
    scene.setPresentationInspection(true); scene.setFloor('all'); scene.resetView(); h.settle();
    assert.equal(scene.activeFloor, 'all'); assert.equal(scene.view, 'perspective');
    for (const [level, deck] of scene.floorDecks) assert.equal(deck.visible, true, `${level}: the whole dryer includes its registered floors and roof service bay`);
    for (const item of scene.equipment) {
      assert.ok(Number.isFinite(item.floor) && item.id !== 'f1-boiler-room' && !item.samePhysicalRoomAs);
      assert.equal(scene.objects.get(item.id).visible, true);
    }
    assert.ok(scene.goalTarget.toArray().every(Number.isFinite));
    assert.ok(Number.isFinite(scene.goalOrbit.distance) && scene.goalOrbit.distance > 30);
    const distance = scene.goalOrbit.distance;
    scene.canvas.dispatch('wheel', { deltaY: -80, deltaMode: 0, clientX: 550, clientY: 380 });
    assert.ok(scene.goalOrbit.distance < distance, 'the whole dryer retains manual zoom');
    scene.setView('top'); h.settle(); assert.equal(scene.view, 'top');
    assert.ok(Number.isFinite(scene.topCamera.zoom) && scene.topCamera.zoom > 0);
    for (const floor of ['campus', 'outdoor', 'packaging', 'liquid']) { scene.setFloor(floor); assert.equal(scene.activeFloor, 'all'); }
    scene.setFloor(3); scene.setView('perspective'); assert.equal(scene.activeFloor, 3);
    scene.setFloor('all'); scene.setPresentationInspection(false);
    assert.equal(scene.setPresentationPose({ floor: 1, ...TOUR_STEPS[0].shots[0].from }), true);
    scene.setFloor('all'); assert.equal(scene.activeFloor, 1, 'restarting restores the scripted first-floor route and rejects the overview');
    assert.equal(scene.controlledPresentation, true); assert.equal(scene.presentationInspection, false);
    assert.deepEqual(scene.getLayout(), layout);
  } finally { h.dispose(); }
});

test('ordinary walking stops at the actual closed weighing shutter and passes the full real opening after it animates open',async()=>{
  const h=await presentationScene();
  try{
    const {scene}=h;scene.controlledPresentation=false;scene.presentationOnly=false;scene.active=true;scene.autoOpenDoors=false;
    scene.setFloor(1);scene.view='person';scene._visibility();scene.person=walking.createPersonState({position:[26.6,.3,3.2],yaw:Math.PI});
    scene.proximityDoors=createProximityDoorController(scene.scene);scene.personInputs.add('forward');
    const walk=distance=>{let time=distance/walking.WALK_RULES.speed;while(time>1e-10){const delta=Math.min(1/60,time);scene._advancePerson(delta);time-=delta;}};
    walk(4);
    assert.ok(scene.person.position[2]<4.59&&scene.person.position[2]>4.5,'the body stops ahead of the physical orange curtain rather than crossing its plane');
    assert.equal(scene.interactDoor(),true);
    for(let i=0;i<120;i++)scene._updateProximityDoors(1/60);
    assert.equal(scene.proximityDoors.getPassages({includeAll:true}).find(door=>door.id==='preparation:inner-rapid-door').open,true);
    walk(3);scene._stopPerson();
    assert.ok(scene.person.position[2]>7.4,'the opened shutter, actual frame, deck supports and equipment leave the central approach passable');
    assert.equal(scene.activeFloor,1);assert.equal(scene.autoOpenDoors,false,'ordinary manual-door preference is retained');
  }finally{h.scene.proximityDoors?.dispose();h.dispose();}
});
