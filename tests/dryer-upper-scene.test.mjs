import test from 'node:test';
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
import { OUTDOOR_ROOM } from '../apps/site/outdoor-data.js';
import { CAMPUS_ROOM } from '../apps/site/campus-data.js';
import { PACKAGING_ROOM, PACKAGING_ROOMS, PACKAGING_OVERVIEW, PACKAGING_FLOOR_ELEVATIONS } from '../apps/site/packaging-data.js';
import { PLACEMENT_RULES, PLACEMENT_REGIONS, constrainPlacement, fromRoomPosition, toRoomPosition } from '../apps/site/placement-rules.js';

async function harness() {
  const source = (await readFile(new URL('../apps/site/scene.js', import.meta.url), 'utf8'))
    .replace(/^import .*;\r?\n/gm, '').replace(/^export\s+(?=(?:function|class|const|let)\b)/gm, '');
  // Canvas text and the GPU renderer are the only rendering substitutes. All
  // scene helpers, equipment, floors, bounds, picking and cameras are real.
  const document = { createElement(tag) {
    assert.equal(tag, 'canvas');
    return { width: 0, height: 0, getContext: () => ({ fillRect() {}, fillText() {} }) };
  } };
  const context = vm.createContext({ THREE, FLOORS, FLOOR_HEIGHT, floorElevation, floorHeight,
    buildDryerUpperEnvironment, buildDryerUpperEquipment, buildDryerBuildingEnvironment, buildDryerProcessEquipment, buildPreparationEquipment, buildPreparationBoilerRoom, buildPreparationEnvironment, buildDryerRouteEnvironment, buildDryerCompressorEnvironment, buildDryerCompressorInteriorDetails, alignDryerCompressorEntrance, buildFacilityEquipment, buildFurnace,
    OUTDOOR_ROOM, CAMPUS_ROOM, PACKAGING_ROOM, PACKAGING_ROOMS, PACKAGING_OVERVIEW, PACKAGING_FLOOR_ELEVATIONS,
    PLACEMENT_RULES, PLACEMENT_REGIONS, constrainPlacement, fromRoomPosition, toRoomPosition, document, clearTimeout });
  new vm.Script(`${source}\nglobalThis.FacilityScene = FacilityScene;`).runInContext(context);
  const scene = Object.create(context.FacilityScene.prototype), selections = [];
  let viewport = { left: 0, top: 0, width: 1100, height: 760 };
  const emptyEnvironment = () => Object.fromEntries(['deck', 'structure', 'ducts'].map(key => [key, new THREE.Group()]));
  Object.assign(scene, {
    scene: new THREE.Scene(), objects: new Map(), parts: [], pickables: [], materials: new Set(), geometries: new Set(), textures: new Set(),
    equipment: EQUIPMENT.map(item => ({ ...item, position: [...item.position] })),
    placementDefaults: new Map(EQUIPMENT.map(item => [item.id, { ...item, position: [...item.position] }])),
    placementFootprints: new Map(), placementResults: new Map(), floorDecks: new Map(), floorStructures: new Map(),
    canvas: { style: {}, dataset: {}, getBoundingClientRect: () => viewport, parentElement: { getBoundingClientRect: () => viewport } },
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
  return { scene, selections, settle,
    resize(width, height) { viewport = { ...viewport, width, height }; scene.resize(); },
    dispose() { scene.geometries.forEach(value => value.dispose()); scene.materials.forEach(value => value.dispose()); scene.textures.forEach(value => value.dispose()); },
  };
}

function corners(root, visibleOnly = false) {
  root.updateMatrixWorld(true);
  const points = [], instance = new THREE.Matrix4();
  const visit = mesh => {
    if (!mesh.isMesh) return;
    mesh.geometry.computeBoundingBox();
    for (let i = 0; i < (mesh.isInstancedMesh ? mesh.count : 1); i++) {
      const matrix = mesh.matrixWorld.clone();
      if (mesh.isInstancedMesh) { mesh.getMatrixAt(i, instance); matrix.multiply(instance); }
      const box = mesh.geometry.boundingBox;
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) points.push(new THREE.Vector3(x, y, z).applyMatrix4(matrix));
    }
  };
  if (visibleOnly) root.traverseVisible(visit); else root.traverse(visit);
  return points;
}

function assertFit(points, camera, label) {
  assert.ok(points.length > 100, 'fit must examine actual geometry rather than a synthetic room box');
  for (const point of points) {
    const p = point.clone().project(camera);
    assert.ok(Math.abs(p.x) <= 1.000001 && Math.abs(p.y) <= 1.000001 && p.z >= -1 && p.z <= 1,
      `${label}: world ${point.toArray()} projects to ${p.toArray()}`);
  }
}

test('actual scene shows eight lower-hall groups, thirteen upper-context groups and three same-datum roof groups', async () => {
  const h = await harness();
  try {
    const { scene } = h;
    assert.equal(scene.objects.size, EQUIPMENT.length);
    for (const [floor, count] of [[6, 8], [7, 13], [8, 3], ['all', EQUIPMENT.length]]) {
      scene.setFloor(floor);
      assert.equal([...scene.objects.values()].filter(root => root.visible).length, count, String(floor));
      const visible = new Set(scene.equipment.filter(item => scene.objects.get(item.id).visible).map(item => item.id));
      for (const item of scene.equipment) assert.equal(visible.has(item.id), floor === 'all' || item.floor === floor || (item.visibleFloors || []).includes(floor), item.id);
    }
    scene.setFloor('roof'); assert.equal(scene.activeFloor, 8);
    for (const item of scene.equipment.filter(item => item.floor === 8)) assert.equal(scene.objects.get(item.id).position.y, 32.6);
    assert.equal(scene.upperEnvironments.get(8).deck.position.y, scene.upperEnvironments.get(7).deck.position.y);
  } finally { h.dispose(); }
});

test('lower floor cutaways keep each deck, rooms and equipment separate from the mezzanine', async () => {
  const h = await harness();
  try {
    const { scene } = h;
    const mezzanine = scene.buildingEnvironments.get(2).architectureFixtures;
    assert.ok(mezzanine.getObjectByName('dryer-route-2-dressing-room-furnishings'));
    assert.ok(mezzanine.getObjectByName('dryer-route-2-op-room-furnishings'));
    assert.ok(scene.equipment.some(item => item.floor === 1));
    assert.equal(scene.equipment.some(item => item.floor === 2), false, 'the production machinery below the observation windows belongs to 1F');
    for (const floor of [1, 2, 3, 4, 5]) for (const view of ['perspective', 'top', 'aisle']) {
      scene.setFloor(floor); scene.setView(view);
      for (const [level, environment] of scene.buildingEnvironments) {
        for (const key of ['deck', 'structure', 'architectureFixtures']) {
          const shared = key === 'architectureFixtures' && environment.architectureFixtures.children.some(child => child.visible && child.userData.stepsRepresentative && child.userData.visibleFloors?.includes(floor));
          assert.equal(environment[key].visible, level === floor || shared, `${floor}F ${view}: ${level}F ${key}`);
        }
        if (level !== floor) for (const child of environment.architectureFixtures.children.filter(child => child.visible)) assert.ok(child.userData.stepsRepresentative && child.userData.visibleFloors?.includes(floor), 'adjoining fixtures contain shared stairs without revealing rooms, doors or furniture');
      }
      for (const item of scene.equipment) {
        assert.equal(scene.objects.get(item.id).visible, item.floor === floor || (item.visibleFloors || []).includes(floor), `${floor}F ${view}: ${item.id}`);
      }
    }
    scene.setFloor(1); scene.setFloor(2); scene.resize();
    assert.equal(scene.floorDecks.get(1).visible, false, 'switching floors and resizing cannot restore the lower hall in the mezzanine cutaway');
    assert.equal(scene.floorDecks.get(2).visible, true);
    scene.setPlacementMode(true);
    assert.equal(scene.floorDecks.get(1).visible, false, 'editing the mezzanine cannot reveal first-floor equipment');
    assert.equal([...scene.objects.values()].filter(root => root.visible).length, 0);
  } finally { h.dispose(); }
});

test('real upper decks retain the chamber holes and open middle while the shell joins its upper observation well', async () => {
  const h = await harness();
  try {
    const { scene } = h, six = scene.upperEnvironments.get(6), seven = scene.upperEnvironments.get(7);
    const mainSix = six.deck.children.find(mesh => mesh.isMesh), mainSize = mainSix.geometry.boundingBox.getSize(new THREE.Vector3());
    assert.ok(Math.abs(mainSize.x - 17.2) < 1e-5 && Math.abs(mainSize.z - 26.8) < 1e-5, 'the actual 6F main-floor mesh uses the architectural 17.2 × 26.8m outline');
    const cast = (root, x, z) => new THREE.Raycaster(new THREE.Vector3(x, 50, z), new THREE.Vector3(0, -1, 0), 0, 40).intersectObject(root, true);
    assert.equal(cast(six.deck, -1, 7.5).length, 0, '6F chamber penetration is a genuine mesh opening');
    assert.ok(cast(six.deck, -7, -3).length > 0, 'the surrounding 6F walking floor remains solid');
    assert.equal(cast(seven.deck, -1, 7.5).length, 0, '7F upper well is not covered by a solid deck');
    assert.equal(cast(seven.deck, 0, -2).length, 0, 'the architectural middle OPEN remains open');
    assert.ok(cast(seven.deck, -8, -2).length > 0, 'a side walkway still connects the partial deck');
    assert.equal(cast(seven.deck, 6.5, 6.5).length, 0, 'the internal stair landing is not sealed by the upper slab');
    const chamber = scene.objects.get('chamber'), well = scene.objects.get('dryer-chamber-upper-well');
    assert.equal(chamber.userData.openAtTop, true);
    assert.equal(well.userData.notAdditionalChamber, true);
    assert.deepEqual([chamber.position.x, chamber.position.z], [well.position.x, well.position.z]);
    const shells = []; chamber.traverse(mesh => { if (mesh.geometry?.type === 'CylinderGeometry' && mesh.geometry.parameters.radiusTop === 3.8) shells.push(mesh); });
    assert.equal(shells.length, 3);
    assert.ok(shells.every(mesh => mesh.geometry.parameters.openEnded), 'the continuous shell must not have invented sealed caps');
    const top = Math.max(...shells.flatMap(mesh => corners(mesh).map(point => point.y)));
    assert.ok(Math.abs(top - well.position.y) < 1e-6, 'the 6F shell terminates at the 7F observation datum');
    assert.equal(six.deck.userData.openingDiameter, 8.3); assert.equal(seven.deck.userData.openingDiameter, 8.6);
    const shellSpan = new THREE.Box3().setFromObject(shells[0]).getSize(new THREE.Vector3()).x;
    assert.ok(shellSpan < six.deck.userData.openingDiameter, 'architectural opening diameter is distinct from the machine shell');
    const deckBox = new THREE.Box3().setFromObject(seven.deck);
    assert.ok(Math.abs(deckBox.min.x + 8.6) < 1e-6 && Math.abs(deckBox.max.x - 8.6) < 1e-6);
    assert.ok(Math.abs(deckBox.max.z - 13.4) < 1e-6);
  } finally { h.dispose(); }
});

test('desktop and phone overview cameras fit actual meshes and individual instances on every upper level and the whole dryer', async () => {
  const h = await harness();
  try {
    for (const [width, height] of [[1100, 760], [390, 600]]) {
      h.resize(width, height);
      for (const floor of [6, 7, 8, 'all']) for (const view of ['perspective', 'top']) {
        h.scene.setFloor(floor); h.scene.setView(view);
        const camera = h.settle();
        assertFit(corners(h.scene.scene, true), camera, `${width}x${height} floor ${floor} ${view}`);
      }
    }
    h.resize(1100, 760);
    for (const floor of [1, 2, 3, 4, 5]) for (const view of ['perspective', 'top']) {
      h.scene.setFloor(floor); h.scene.setView(view);
      assertFit(corners(h.scene.scene, true), h.settle(), `1100x760 historical ${floor}F ${view}`);
    }
  } finally { h.dispose(); }
});

test('roof framing includes the southern gable, and cover/facade cutaways follow level and view transitions', async () => {
  const h = await harness();
  try {
    const { scene } = h, roof = scene.upperEnvironments.get(8), hall = scene.upperEnvironments.get(6);
    const cover = new THREE.Box3().setFromObject(roof.cover);
    assert.ok(cover.min.z < -6.6 && cover.max.z >= 13.4, 'roof context extends from the service bay along the complete main gable');
    assert.ok(cover.max.y > 40.3, 'the gable ridge is distinct from the flat 32.6m service datum');
    scene.setFloor(8); h.settle(); assert.equal(roof.cover.visible, true);
    assert.ok(scene.camera.position.z < -13.4, 'the roof overview approaches from the service-bay side, before the tall main gable');
    assert.ok(scene._dryerBounds().containsBox(cover), 'the roof fit cannot crop away its main cover context');
    scene.setFloor(7); assert.equal(roof.cover.visible, false);
    scene.setFloor(6); assert.equal(hall.facade.visible, false);
    scene.setView('aisle'); assert.equal(hall.facade.visible, true, 'walking restores the surrounding visible wall envelope');
    scene.setView('perspective'); assert.equal(hall.facade.visible, false, 'overview cuts the opaque facade away again');
    scene.setFloor('all'); assert.equal(roof.cover.visible, false, 'the whole dryer remains a readable cutaway');
    scene.setStructure(false);
    for (const env of scene.upperEnvironments.values()) for (const key of ['structure', 'stairs', 'cover', 'facade']) if (env[key]) assert.equal(env[key].visible, false, key);
    scene.setDucts(false);
    for (const env of scene.upperEnvironments.values()) assert.equal(env.ducts.visible, false);
  } finally { h.dispose(); }
});

test('manual focus and top view survive resizing without reverting to an automatic upper-floor overview', async () => {
  const h = await harness();
  try {
    const { scene } = h;
    scene.setFloor(7); scene.setView('top'); scene.focus('dryer-chamber-upper-well'); h.settle();
    const target = scene.goalTarget.clone(), zoom = scene.topCamera.zoom;
    assert.equal(scene.dryerTopFit, false);
    h.resize(390, 600); h.settle();
    assert.equal(scene.view, 'top'); assert.equal(scene.activeFloor, 7); assert.equal(scene.topCamera.zoom, zoom);
    assert.ok(scene.goalTarget.distanceTo(target) < 1e-9, 'phone resize must retain the chosen observation point');
    scene.setView('top'); assert.equal(scene.topCamera.zoom, zoom, 'clicking the current view must not reset a focused camera');
    const beforeHeight = (scene.topCamera.top - scene.topCamera.bottom) / scene.topCamera.zoom;
    scene.setView('perspective');
    const afterHeight = 2 * scene.goalOrbit.distance * Math.tan(scene.camera.fov * Math.PI / 360);
    assert.ok(Math.abs(afterHeight - beforeHeight) < 1e-6);
    assert.ok(scene.goalTarget.distanceTo(target) < 1e-9);
    scene.resetView(); h.settle(); assert.equal(scene.navigationEdited, false);
    assertFit(corners(scene.scene, true), scene.camera, 'reset restores the upper overview after manual focus');
  } finally { h.dispose(); }
});

test('real selection and explosion affect only the selected assembly, while isolation hides every environment group', async () => {
  const h = await harness();
  try {
    const { scene } = h;
    scene.setFloor(8); scene.select('dryer-roof-water-tank');
    assert.equal(scene.selectionRing.visible, true);
    assert.equal(scene.selectionRing.position.y, 32.67);
    const selected = scene.objects.get(scene.selected), other = scene.objects.get('dryer-roof-cylindrical-shell');
    const selectedParts = scene.parts.filter(part => part.root === selected), otherParts = scene.parts.filter(part => part.root === other);
    assert.ok(selectedParts.length >= 3);
    scene.setExplosion(.8); scene.amount = scene.explosion; scene._moveParts();
    assert.ok(selectedParts.some(part => part.group.position.distanceTo(part.home) > .1));
    assert.ok(otherParts.every(part => part.group.position.distanceTo(part.home) < 1e-9));
    scene.setIsolation(true);
    assert.deepEqual([...scene.objects].filter(([, root]) => root.visible).map(([id]) => id), ['dryer-roof-water-tank']);
    for (const env of scene.upperEnvironments.values()) for (const key of ['deck', 'structure', 'ducts', 'stairs', 'cover', 'facade', 'machineRoomCover', 'machineRoomInterior']) if (env[key]) assert.equal(env[key].visible, false, key);
    for (const root of scene.floorDecks.values()) assert.equal(root.visible, false);
    for (const root of scene.floorStructures.values()) assert.equal(root.visible, false);
    scene.setExplosion(0); scene.amount = 0; scene._moveParts(); scene.focus(scene.selected); h.settle();
    const hit = scene._hit({ clientX: scene.width / 2, clientY: scene.height / 2 });
    assert.equal(hit?.userData.equipment, scene.selected, 'the isolated real tank remains ray-pickable');
    scene._pick({}, hit); assert.equal(h.selections.at(-1), scene.selected);
    scene.setIsolation(false); assert.equal(scene.upperEnvironments.get(8).deck.visible, true);
  } finally { h.dispose(); }
});

test('placement uses real upper/roof footprints, clamps to each bay and preserves the owned height and neighboring geometry', async () => {
  const h = await harness();
  try {
    const { scene } = h;
    for (const item of scene.equipment.filter(item => item.floor >= 6)) {
      const result = scene._constrainTransform(item, item);
      assert.equal(result.valid, true, `${item.id}: ${result.reason}`);
      assert.equal(result.region, item.floor === 8 ? 'roof' : 'upper');
      assert.ok(Object.values(scene.placementFootprints.get(item.id)).every(Number.isFinite));
    }
    const before = scene.getLayout(), id = 'dryer-roof-water-tank';
    scene.setFloor(8); scene.select(id); scene.setPlacementMode(true);
    assert.equal(scene.canvas.dataset.editing, 'true'); assert.ok(scene.placementGuide);
    assert.equal(scene.setTransform(id, { position: [80, -100, 80], rotation: Math.PI / 2 }), true);
    const moved = scene.equipment.find(item => item.id === id), info = scene.getPlacementInfo(id);
    assert.equal(moved.position[1], 32.6); assert.equal(info.regionLabel, PLACEMENT_REGIONS.roof.label);
    assert.equal(scene.placementResults.get(id).limited, true);
    const body = scene.parts.find(part => part.root === scene.objects.get(id)).group;
    const bounds = new THREE.Box3().setFromObject(body), frame = PLACEMENT_REGIONS.roof;
    assert.ok(bounds.min.x >= frame.minX - 1e-6 && bounds.max.x <= frame.maxX + 1e-6 && bounds.min.z >= frame.minZ - 1e-6 && bounds.max.z <= frame.maxZ + 1e-6);
    for (const previous of before.filter(item => item.id !== id)) assert.deepEqual(scene.getLayout().find(item => item.id === previous.id), previous);
    scene.setPlacementMode(false); assert.equal(scene.placementGuide, null);
  } finally { h.dispose(); }
});

test('historical room envelopes cut away independently and selecting the elevator drive reveals its fixed interior without leaving placement top view', async () => {
  const h = await harness();
  try {
    const { scene } = h;
    scene.setFloor(1);
    for (const [level, env] of scene.buildingEnvironments) {
      const shared = env.architectureFixtures.children.filter(child => child.userData.stepsRepresentative && child.userData.visibleFloors?.includes(1));
      assert.equal(env.architectureFixtures.visible, level === 1 || shared.some(child => child.visible));
      if (level !== 1) for (const child of env.architectureFixtures.children.filter(child => child.visible)) assert.ok(shared.includes(child), 'only explicitly shared stairs may appear from an adjacent floor');
      assert.equal(env.facade.visible, false);
      assert.equal(env.cover.visible, level === 1);
    }
    scene.setView('aisle'); assert.equal(scene.buildingEnvironments.get(1).facade.visible, true);
    scene.setView('perspective'); assert.equal(scene.buildingEnvironments.get(1).facade.visible, false);
    scene.setFloor(3); assert.equal(scene.buildingEnvironments.get(3).cover.visible, true);
    scene.setFloor('all'); assert.equal(scene.buildingEnvironments.get(3).cover.visible, false);
    scene.setFloor(8);
    const room = scene.upperEnvironments.get(8);
    assert.equal(room.machineRoomCover.visible, true);
    scene.select('dryer-roof-drive');
    assert.equal(room.machineRoomCover.visible, false, 'selecting the drive removes the room shell');
    assert.equal(room.machineRoomInterior.visible, true, 'fixed control cabinets and room details remain visible');
    scene.focus('dryer-roof-drive'); h.settle();
    assertFit([...corners(scene.objects.get('dryer-roof-drive')), ...corners(room.machineRoomInterior)], scene.camera, 'elevator room interior focus');
    scene.setPlacementMode(true); scene.focusPlacement('dryer-roof-drive'); h.settle();
    assert.equal(scene.view, 'top'); assert.equal(scene.placementMode, true);
    assert.equal(room.machineRoomCover.visible, false); assert.equal(room.machineRoomInterior.visible, true);
    scene.setIsolation(true);
    for (const env of scene.buildingEnvironments.values()) for (const key of ['deck', 'structure', 'facade', 'cover', 'architectureFixtures', 'ducts']) assert.equal(env[key].visible, false, key);
    assert.equal(room.machineRoomInterior.visible, true, 'the selected elevator assembly retains its room context during isolation');
    assert.equal(room.machineRoomCover.visible, false);
    scene.setIsolation(false); scene.setPlacementMode(false); scene.select(null);
    assert.equal(room.machineRoomCover.visible, true);
  } finally { h.dispose(); }
});
