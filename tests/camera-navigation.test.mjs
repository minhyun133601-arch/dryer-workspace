import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from '../apps/shared/vendor/three.module.js';
import { CAMPUS_ROOM } from '../apps/site/campus-data.js';
import { OUTDOOR_ROOM } from '../apps/site/outdoor-data.js';
import { PACKAGING_ROOM, PACKAGING_ROOMS, PACKAGING_OVERVIEW, PACKAGING_FLOOR_ELEVATIONS } from '../apps/site/packaging-data.js';
import { FLOORS, FLOOR_HEIGHT, floorElevation } from '../apps/site/facility-data.js';
import { PLACEMENT_REGIONS, PLACEMENT_RULES, constrainPlacement, fromRoomPosition, toRoomPosition } from '../apps/site/placement-rules.js';

function fakeClock() {
  let now = 1000, next = 0;
  const timers = new Map();
  return {
    get now() { return now; },
    setTimeout(callback, delay = 0) { const id = ++next; timers.set(id, { callback, due: now + delay }); return id; },
    clearTimeout(id) { timers.delete(id); },
    advance(duration) {
      const end = now + duration;
      while (true) {
        const ready = [...timers].filter(([, timer]) => timer.due <= end).sort((a, b) => a[1].due - b[1].due)[0];
        if (!ready) break;
        now = ready[1].due; timers.delete(ready[0]); ready[1].callback();
      }
      now = end;
    },
    clear() { timers.clear(); },
  };
}

async function harness({ floor = 7, view = 'perspective', width = 1100, height = 760 } = {}) {
  const clock = fakeClock();
  const source = (await readFile(new URL('../apps/site/scene.js', import.meta.url), 'utf8'))
    .replace(/^import .*;\r?\n/gm, '').replace(/^export\s+(?=(?:function|class|const|let)\b)/gm, '');
  const context = vm.createContext({
    THREE, CAMPUS_ROOM, OUTDOOR_ROOM, PACKAGING_ROOM, PACKAGING_ROOMS, PACKAGING_OVERVIEW, PACKAGING_FLOOR_ELEVATIONS,
    FLOORS, FLOOR_HEIGHT, floorElevation, PLACEMENT_REGIONS, PLACEMENT_RULES, constrainPlacement, fromRoomPosition, toRoomPosition,
    setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, performance: { now: () => clock.now },
    Date: class extends Date { static now() { return clock.now; } },
  });
  new vm.Script(`${source}\nglobalThis.FacilityScene = FacilityScene;`).runInContext(context);
  const scene = Object.create(context.FacilityScene.prototype);
  const handlers = new Map(), captures = new Set(), picked = [], transforms = [];
  let viewport = { left: 43, top: 57, width, height };
  const canvas = {
    style: {}, dataset: {}, getBoundingClientRect: () => viewport,
    parentElement: { getBoundingClientRect: () => viewport },
    addEventListener(type, handler) { handlers.set(type, handler); }, removeEventListener(type) { handlers.delete(type); },
    setPointerCapture(id) { captures.add(id); }, hasPointerCapture: (id) => captures.has(id), releasePointerCapture(id) { captures.delete(id); },
  };
  const floorY = Number.isInteger(floor) ? floorElevation(floor) : 0;
  const root = new THREE.Group(), object = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const body = new THREE.Mesh(new THREE.BoxGeometry(6, 2, 6), material);
  body.position.set(0, floorY + 1, 0); body.userData.equipment = 'fixture'; object.add(body); root.add(object);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(120, .2, 120), material);
  deck.position.set(0, floorY - .1, 0); root.add(deck);
  const item = { id: 'fixture', floor, position: [0, floorY, 0], rotation: 0 };
  Object.assign(scene, {
    canvas, scene: root, objects: new Map([['fixture', object]]), equipment: [item], parts: [], pickables: [body],
    listeners: [], camera: new THREE.PerspectiveCamera(42, width / height, .02, 3000),
    topCamera: new THREE.OrthographicCamera(-24, 24, 18, -18, .02, 3000),
    raycaster: new THREE.Raycaster(), activeFloor: floor, packagingLevel: 'all', view, width, height, fitFactor: 1,
    target: new THREE.Vector3(0, floorY + 1, 0), goalTarget: new THREE.Vector3(0, floorY + 1, 0),
    orbit: { azimuth: .65, elevation: .38, distance: 35 }, goalOrbit: { azimuth: .65, elevation: .38, distance: 35 },
    renderer: { setSize() {} }, disposed: false, placementMode: false, selected: null, navigationEdited: false,
    amount: 0, explosion: 0, dragPlacement: null, lastHoverPick: 0,
    campusTopFit: false, packagingTopFit: false, packagingProgress: 0,
    packaging: { ceiling: new THREE.Group(), deck }, campus: { deck }, outdoor: { deck },
    floorDecks: new Map([[floor, deck]]), floorStructures: new Map(),
    onSelect: (id) => picked.push(id), onViewChange() {}, onNavigationChange() {}, onSurveyPhoto() {},
    onTransformChange: (value) => transforms.push(value),
    _invalidate() {}, _clearHover() {}, _hoverFromPointer() {}, _visibility() {}, _moveParts() {},
  });
  scene.topCamera.up.set(0, 0, -1);
  const settle = () => {
    scene.target.copy(scene.goalTarget); Object.assign(scene.orbit, scene.goalOrbit);
    scene._updateCamera(); scene.scene.updateMatrixWorld(true); return scene._currentCamera();
  };
  settle();
  const eventFor = (point, camera = scene._currentCamera()) => {
    const p = point.clone().project(camera);
    return { clientX: viewport.left + (p.x + 1) * viewport.width / 2,
      clientY: viewport.top + (1 - p.y) * viewport.height / 2 };
  };
  const dispatch = (type, event = {}) => {
    assert.ok(handlers.has(type), `the canvas must register ${type}`);
    handlers.get(type)({ pointerId: 1, pointerType: 'mouse', button: 0, shiftKey: false,
      clientX: viewport.left + viewport.width * .7, clientY: viewport.top + viewport.height * .4,
      timeStamp: clock.now, preventDefault() {}, ...event });
  };
  return {
    scene, floorY, body, deck, clock, handlers, captures, picked, transforms, settle, eventFor, dispatch,
    resize(w, h) { viewport = { ...viewport, width: w, height: h }; scene.resize(); },
    dispose() { scene.listeners.forEach((remove) => remove()); clock.clear(); root.traverse((mesh) => mesh.geometry?.dispose()); material.dispose(); },
  };
}

const closePoint = (a, b, message, tolerance = 1e-6) => assert.ok(a.distanceTo(b) < tolerance,
  `${message}: ${a.toArray()} versus ${b.toArray()}`);
const screenPoint = (point, camera) => { const p = point.clone().project(camera); return new THREE.Vector2(p.x, p.y); };

test('pointer zoom holds a real off-centre surface under the cursor through repeated, unsettled perspective zooms', async () => {
  const h = await harness();
  try {
    const { scene } = h, point = new THREE.Vector3(1.4, h.floorY + 1.6, 3);
    const event = h.eventFor(point), anchor = scene._navigationPoint(event, scene._goalCamera());
    closePoint(anchor, point, 'navigation must hit the actual elevated surface rather than a ground plane');
    const initial = screenPoint(anchor, scene._goalCamera());
    scene.zoomBy(1.6, event); scene.zoomBy(1.7, event); scene.zoomBy(1.4, event);
    assert.ok(scene.goalOrbit.distance < 10, 'pointer zoom must bring the intended surface closer');
    assert.ok(screenPoint(anchor, scene._goalCamera()).distanceTo(initial) < 1e-6, 'repeated wheel events must use the goal camera and retain the cursor anchor');
    h.settle();
    assert.ok(screenPoint(anchor, scene.camera).distanceTo(initial) < 1e-6);
    const position = scene.goalTarget.clone(), distance = scene.goalOrbit.distance;
    for (const factor of [1, 0, -1, NaN, Infinity]) scene.zoomBy(factor, event);
    closePoint(scene.goalTarget, position, 'neutral and invalid zoom factors must not move the target');
    assert.equal(scene.goalOrbit.distance, distance);
  } finally { h.dispose(); }
});

test('top-view pointer zoom preserves the map view, target height and off-centre anchor while allowing close detail', async () => {
  const h = await harness({ view: 'top' });
  try {
    const { scene } = h, event = h.eventFor(new THREE.Vector3(1.2, h.floorY + 2, .8));
    const point = scene._navigationPoint(event, scene._goalCamera());
    const initial = screenPoint(point, scene._goalCamera()), y = scene.goalTarget.y;
    scene.zoomBy(3, event); scene.zoomBy(2, event);
    assert.equal(scene.view, 'top'); assert.equal(scene.goalTarget.y, y);
    assert.ok(screenPoint(point, scene._goalCamera()).distanceTo(initial) < 1e-6);
    scene.zoomBy(1e5);
    assert.ok(scene.topCamera.zoom > 5 && scene.topCamera.zoom <= 80, 'small equipment must be inspectable beyond the old five-times map zoom');
    const zoom = scene.topCamera.zoom, target = scene.goalTarget.clone(); scene.zoomBy(1, event);
    assert.equal(scene.topCamera.zoom, zoom); closePoint(scene.goalTarget, target, 'zoomBy(1) must not change a maximally enlarged map');
  } finally { h.dispose(); }
});

test('double-click focus centres the clicked world point without changing floors, top view or equipment layout', async () => {
  for (const view of ['perspective', 'top']) {
    const h = await harness({ view });
    try {
      const { scene } = h, event = h.eventFor(new THREE.Vector3(1, h.floorY + 1.5, 3));
      const point = scene._navigationPoint(event), before = scene.getLayout(), distance = scene.goalOrbit.distance, zoom = scene.topCamera.zoom;
      scene.zoomToPoint(event);
      assert.equal(scene.activeFloor, 7); assert.equal(scene.view, view);
      closePoint(new THREE.Vector2(scene.goalTarget.x, scene.goalTarget.z), new THREE.Vector2(point.x, point.z), 'the clicked point becomes the horizontal focus');
      if (view === 'perspective') {
        closePoint(scene.goalTarget, point, 'perspective focus must retain the clicked height');
        assert.ok(scene.goalOrbit.distance < distance);
      } else assert.ok(scene.topCamera.zoom > zoom);
      const focused = point.clone().project(h.settle());
      assert.ok(Math.hypot(focused.x, focused.y) < 1e-6, 'the requested point must end at the viewport centre');
      assert.deepEqual(scene.getLayout(), before); assert.deepEqual(h.transforms, []);
    } finally { h.dispose(); }
  }
});

test('free pan reaches beyond former room clamps and can move the perspective frame vertically while top and aisle retain height', async () => {
  const h = await harness();
  try {
    const { scene } = h, y = scene.goalTarget.y;
    scene._panBy(0, 1200);
    assert.ok(Math.abs(scene.goalTarget.y - y) > .5, 'screen-plane perspective pan must move the frame vertically');
    scene.view = 'top'; h.settle(); const topY = scene.goalTarget.y;
    scene._panBy(-10000, -10000);
    assert.equal(scene.goalTarget.y, topY);
    assert.ok(Math.max(Math.abs(scene.goalTarget.x), Math.abs(scene.goalTarget.z)) > 100, 'the camera is not trapped inside the old ±30 room target clamp');
    scene.view = 'aisle'; h.settle(); const aisleY = scene.goalTarget.y;
    scene._panBy(500, 500); assert.equal(scene.goalTarget.y, aisleY, 'aisle panning stays horizontal');
    scene._panBy(1e12, -1e12);
    assert.ok(scene.goalTarget.toArray().every((value) => Number.isFinite(value) && Math.abs(value) <= 1e5), 'large gestures retain a finite safety bound');
  } finally { h.dispose(); }
});

test('deep zoom-out on a tall phone retains campus geometry inside the camera clipping range', async () => {
  const h = await harness({ floor: 'campus', width: 390, height: 1000 });
  try {
    const { scene } = h;
    h.resize(390, 1000); scene.goalTarget.set(...CAMPUS_ROOM.center);
    Object.assign(scene.goalOrbit, { azimuth: .65, elevation: .68 });
    scene.zoomBy(1e-6); h.settle();
    assert.ok(scene.goalOrbit.distance > 3000, 'the tall-screen scene must allow the expanded camera range');
    assert.ok(scene.camera.far > scene.goalOrbit.distance + CAMPUS_ROOM.span, 'far clipping must expand with the new orbit distance');
    for (const x of [-90, 110]) for (const y of [0, 45]) for (const z of [-85, 125]) {
      const p = new THREE.Vector3(x, y, z).project(scene.camera);
      assert.ok(Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1 && p.z >= -1 && p.z <= 1, `campus corner clips on a tall phone: ${p.toArray()}`);
    }
    scene.zoomBy(1e8); assert.ok(scene.goalOrbit.distance >= .35 && scene.goalOrbit.distance < 5, 'close inspection can approach past the former five-metre stop');
  } finally { h.dispose(); }
});

test('a canvas double click and two touch taps zoom without also invoking a delayed single-click portal', async () => {
  for (const [pointerType, interval] of [['mouse', 300], ['mouse', 500], ['touch', 300]]) {
    const h = await harness();
    try {
      const { scene } = h, before = scene.goalOrbit.distance;
      scene.equipment[0].roomLink = 'outdoor';
      scene._controls();
      const event = { ...h.eventFor(new THREE.Vector3(1, h.floorY + 1, 3)), pointerType };
      h.dispatch('pointerdown', event); h.dispatch('pointerup', event);
      h.clock.advance(interval);
      h.dispatch('pointerdown', event); h.dispatch('pointerup', event);
      if (pointerType === 'mouse') h.dispatch('dblclick', event);
      h.clock.advance(400);
      assert.ok(scene.goalOrbit.distance < before, `${pointerType} double activation must zoom`);
      assert.deepEqual(h.picked, [], 'the first click timer must be cancelled before it can open a linked room');
      assert.equal(h.captures.size, 0);
    } finally { h.dispose(); }
  }
});

test('single clicks still select after the double-click window, middle drag pans, and placement double-click does not move anything', async () => {
  const h = await harness();
  try {
    const { scene } = h; scene._controls();
    const event = h.eventFor(new THREE.Vector3(1, h.floorY + 1, 3));
    h.dispatch('pointerdown', event); h.dispatch('pointerup', event);
    h.clock.advance(329); assert.deepEqual(h.picked, []);
    h.clock.advance(2); assert.deepEqual(h.picked, ['fixture'], 'ordinary selection survives delayed dispatch');
    const target = scene.goalTarget.clone();
    h.dispatch('pointerdown', { ...event, button: 1 });
    h.dispatch('pointermove', { ...event, button: 1, clientX: event.clientX + 120, clientY: event.clientY + 40 });
    h.dispatch('pointerup', { ...event, button: 1, clientX: event.clientX + 120, clientY: event.clientY + 40 });
    assert.ok(scene.goalTarget.distanceTo(target) > .1, 'middle drag must pan rather than orbit');
    scene.placementMode = true;
    const layout = scene.getLayout(), position = scene.goalTarget.clone(), distance = scene.goalOrbit.distance;
    h.dispatch('dblclick', event); h.clock.advance(400);
    assert.equal(scene.goalOrbit.distance, distance); closePoint(scene.goalTarget, position, 'placement double-click cannot change the camera target');
    assert.deepEqual(scene.getLayout(), layout); assert.deepEqual(h.transforms, []);
  } finally { h.dispose(); }
});

test('empty space uses a view-plane anchor, while hidden and nearly invisible meshes do not capture navigation', async () => {
  const h = await harness();
  try {
    const { scene } = h;
    h.body.visible = h.deck.visible = false;
    const event = { clientX: 100, clientY: 140 }, camera = scene._goalCamera();
    const point = scene._navigationPoint(event, camera);
    assert.ok(point?.toArray().every(Number.isFinite), 'empty space remains navigable without a distant ground-plane jump');
    const normal = camera.getWorldDirection(new THREE.Vector3());
    assert.ok(Math.abs(point.clone().sub(scene.goalTarget).dot(normal)) < 1e-6, 'empty-space depth follows the current viewing plane');
    const initial = screenPoint(point, camera);
    scene.zoomBy(2, event);
    closePoint(screenPoint(point, scene._goalCamera()), initial, 'empty-space zoom also retains the cursor anchor');
    h.body.visible = true;
    h.body.material.transparent = true; h.body.material.opacity = .05;
    const bodyEvent = h.eventFor(new THREE.Vector3(1, h.floorY + 1, 3));
    const through = scene._navigationPoint(bodyEvent);
    assert.ok(Math.abs(through.clone().sub(scene.goalTarget).dot(scene.camera.getWorldDirection(new THREE.Vector3()))) < 1e-6, 'a nearly invisible mesh cannot become the zoom surface');
  } finally { h.dispose(); }
});

test('wheel events preserve their cursor anchor across pixel, line and page deltas and clamp without drifting', async () => {
  for (const view of ['perspective', 'top']) {
    const h = await harness({ view });
    try {
      const { scene } = h; scene._controls();
      const event = h.eventFor(new THREE.Vector3(1, h.floorY + 1.6, 3));
      const anchor = scene._navigationPoint(event, scene._goalCamera());
      const initial = screenPoint(anchor, scene._goalCamera());
      for (const [deltaMode, deltaY] of [[0, -80], [1, -4], [2, -.2]]) h.dispatch('wheel', { ...event, deltaMode, deltaY });
      closePoint(screenPoint(anchor, scene._goalCamera()), initial, 'the actual wheel listener must retain its pointer');
      scene.zoomBy(1e9, event);
      closePoint(screenPoint(anchor, scene._goalCamera()), initial, 'a zoom clamped at its nearest limit retains the anchor');
      const target = scene.goalTarget.clone();
      scene.zoomBy(1e9, event);
      closePoint(scene.goalTarget, target, 'an additional wheel step at the limit cannot drag the target');
    } finally { h.dispose(); }
  }
});

test('equipment focus retains a packaging whole-building view and fits actual geometry on portrait and landscape screens', async () => {
  for (const view of ['perspective', 'top']) for (const [width, height] of [[1100, 760], [390, 1000]]) {
    const h = await harness({ floor: 'packaging', view, width, height });
    try {
      const { scene } = h;
      scene.equipment[0].floorLevel = 2;
      h.resize(width, height);
      const bounds = new THREE.Box3().setFromObject(scene.objects.get('fixture'));
      const layout = scene.getLayout();
      scene.focus('fixture');
      assert.equal(scene.activeFloor, 'packaging'); assert.equal(scene.getPackagingLevel(), 'all'); assert.equal(scene.view, view);
      closePoint(scene.goalTarget, bounds.getCenter(new THREE.Vector3()), 'focus uses the visible object centre');
      const camera = h.settle();
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
        const p = new THREE.Vector3(x, y, z).project(camera);
        assert.ok(Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1 && p.z >= -1 && p.z <= 1, `equipment focus clips at ${width}x${height} in ${view}`);
      }
      assert.deepEqual(scene.getLayout(), layout); assert.deepEqual(h.transforms, []);
    } finally { h.dispose(); }
  }
});

test('perspective rotation can pass below the old horizontal stop without changing equipment', async () => {
  const h = await harness({ floor: 7 });
  try {
    const { scene } = h, layout = scene.getLayout();
    scene._controls();
    h.dispatch('pointerdown', { clientX: 450, clientY: 300 });
    h.dispatch('pointermove', { clientX: 450, clientY: 40 });
    h.dispatch('pointerup', { clientX: 450, clientY: 40 });
    assert.ok(scene.goalOrbit.elevation < 0, 'the user can inspect a model from below its focus point');
    assert.ok(h.settle().position.toArray().every(Number.isFinite));
    assert.deepEqual(scene.getLayout(), layout);
    scene.resetView(); assert.ok(scene.goalOrbit.elevation > 0);
  } finally { h.dispose(); }
});

test('turning inside an aisle changes the view direction while keeping the walking eye fixed', async () => {
  const h = await harness({ floor: 'outdoor', view: 'aisle' });
  try {
    const { scene } = h;
    scene.goalTarget.set(...fromRoomPosition([19, 1.85, OUTDOOR_ROOM.aisleCenterZ], OUTDOOR_ROOM));
    Object.assign(scene.goalOrbit, { azimuth: OUTDOOR_ROOM.rotation - Math.PI / 2, elevation: .015, distance: 13.8 });
    const eye = h.settle().position.clone(); scene._controls();
    h.dispatch('pointerdown', { clientX: 400, clientY: 250 });
    h.dispatch('pointermove', { clientX: 550, clientY: 250 });
    h.dispatch('pointerup', { clientX: 550, clientY: 250 });
    assert.equal(scene.view, 'aisle', 'turning must not leave the walking view');
    closePoint(scene._goalCamera().position, eye, 'horizontal looking must not raise or shift the walking eye');
    scene.active = true; scene.lastTick = null; scene._draw = () => {};
    for (let frame = 0; frame < 60; frame++) {
      scene._tick(1000 + frame * 1000 / 60);
      closePoint(scene.camera.position, eye, `the rendered walking eye must stay fixed during turn interpolation at frame ${frame}`);
    }
    assert.ok(Math.abs(scene.orbit.azimuth - scene.goalOrbit.azimuth) < .001, 'the animation must actually advance towards the requested direction');
    assert.deepEqual(h.picked, []);
  } finally { h.dispose(); }
});

test('switching between map and perspective retains an edited focus and vertical field until reset restores the room overview', async () => {
  for (const floor of [7, 'campus', 'outdoor', 'packaging']) {
    const h = await harness({ floor });
    try {
      const { scene } = h;
      scene.resetView(); h.settle();
      const overviewTarget = scene.goalTarget.clone(), overviewOrbit = { ...scene.goalOrbit };
      scene.zoomToPoint(h.eventFor(new THREE.Vector3(1, h.floorY + 1.5, 3)));
      scene._panBy(80, 35);
      assert.equal(scene.navigationEdited, true);
      const target = scene.goalTarget.clone(), distance = scene.goalOrbit.distance;
      const perspectiveHeight = 2 * distance * Math.tan(THREE.MathUtils.degToRad(scene.camera.fov / 2));
      scene.setView('perspective');
      assert.equal(scene.goalOrbit.distance, distance, 'clicking the active mode cannot reset manual zoom');
      closePoint(scene.goalTarget, target, 'clicking the active mode retains the edited focus');
      scene.setView('top');
      assert.equal(scene.view, 'top');
      closePoint(scene.goalTarget, target, 'map conversion retains the edited world focus, including height');
      const mapHeight = () => (scene.topCamera.top - scene.topCamera.bottom) / scene.topCamera.zoom;
      assert.ok(Math.abs(mapHeight() - perspectiveHeight) < 1e-6, 'map conversion retains the visible vertical field');
      scene.zoomBy(1.5);
      const editedMapHeight = mapHeight(), zoom = scene.topCamera.zoom;
      scene.setView('top');
      assert.equal(scene.topCamera.zoom, zoom, 'clicking the active map mode cannot reset zoom');
      scene.setView('perspective');
      closePoint(scene.goalTarget, target, 'perspective conversion retains the edited world focus');
      const returnedHeight = 2 * scene.goalOrbit.distance * Math.tan(THREE.MathUtils.degToRad(scene.camera.fov / 2));
      assert.ok(Math.abs(returnedHeight - editedMapHeight) < 1e-6, 'perspective conversion retains the edited map scale');
      scene.resetView();
      assert.equal(scene.navigationEdited, false); assert.equal(scene.view, 'perspective');
      assert.equal(scene.activeFloor, floor);
      closePoint(scene.goalTarget, overviewTarget, 'reset restores the current room overview');
      assert.deepEqual({ ...scene.goalOrbit }, overviewOrbit);
    } finally { h.dispose(); }
  }
});
