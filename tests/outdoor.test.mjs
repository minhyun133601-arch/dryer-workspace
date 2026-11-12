import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { EQUIPMENT, FLOORS, SITE_NOTE, floorById } from '../apps/site/building-data.js';
import { EQUIPMENT as SOURCE_PHOTO_EQUIPMENT } from '../apps/site/data.js';
import { OUTDOOR_EQUIPMENT, OUTDOOR_ROOM } from '../apps/site/outdoor-data.js';
import { OUTDOOR_HISTORY_CARDS, OUTDOOR_CARD_BINDINGS } from '../apps/site/outdoor-card-data.js';
import { CAMPUS_EQUIPMENT, CAMPUS_ROOM } from '../apps/site/campus-data.js';
import { PACKAGING_EQUIPMENT, PACKAGING_ROOM, PACKAGING_ROOMS, PACKAGING_OVERVIEW } from '../apps/site/packaging-data.js';
import { SURVEY_PHOTOS } from '../apps/site/outdoor-survey.js';
import { buildOutdoorEnvironment, buildOutdoorEquipment } from '../apps/site/outdoor-models.js';
import { CHILLER_ASSETS } from '../apps/site/chiller-data.js';
import { BURNER_MAINTENANCE_DOCUMENTS } from '../apps/site/burner-maintenance-data.js';
import { SITE_ASSETS } from '../apps/site/asset-catalog.js';
import { isRetainedEvidenceImage } from '../apps/site/evidence-assets.js';
import { constrainPlacement, PLACEMENT_REGIONS, fromRoomPosition, toRoomPosition } from '../apps/site/placement-rules.js';
import * as THREE from '../apps/shared/vendor/three.module.js';

function geometryHarness() {
  const material = new THREE.MeshBasicMaterial();
  const s = {
    scene: new THREE.Group(), parts: [], outdoorMaterials: new Proxy({}, { get: () => material }), mat: new Proxy({}, { get: () => material }),
    _group(parent, position = [0, 0, 0]) {
      const group = new THREE.Group(); group.position.set(...position); parent.add(group); return group;
    },
    _mesh(geometry, mat, parent, position = [0, 0, 0]) {
      const mesh = new THREE.Mesh(geometry, mat); mesh.position.set(...position); parent.add(mesh); return mesh;
    },
    _box(parent, size, position, mat) { return this._mesh(new THREE.BoxGeometry(...size), mat, parent, position); },
    _cyl(parent, radius, height, position, mat, bottom = radius, segments = 48) {
      return this._mesh(new THREE.CylinderGeometry(radius, bottom, height, segments), mat, parent, position);
    },
    _bar(parent, start, end, radius, mat) {
      const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end);
      const mesh = this._cyl(parent, radius, a.distanceTo(b), a.clone().add(b).multiplyScalar(.5).toArray(), mat, radius, 10);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize()); return mesh;
    },
    _part(root, name, offset, position = [0, 0, 0]) {
      const group = this._group(root, position); this.parts.push({ root, name, group }); return group;
    },
  };
  return { s, material };
}

function boundsInFrame(object, inverse) {
  const box = new THREE.Box3();
  object.traverse((mesh) => {
    if (!mesh.isMesh) return;
    mesh.geometry.computeBoundingBox();
    box.union(mesh.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(mesh.matrixWorld)));
  });
  return box;
}

test('the raised platform has one cooling tower and both water tanks stand beside its footprint', () => {
  const { s, material } = geometryHarness();
  const roots = new Map();
  try {
    for (const id of ['outdoor-towers', 'outdoor-water-1', 'outdoor-water-2']) {
      const item = OUTDOOR_EQUIPMENT.find((entry) => entry.id === id);
      assert.ok(item, id);
      const root = s._group(s.scene, item.position); root.rotation.y = item.rotation; roots.set(id, root);
      assert.equal(buildOutdoorEquipment(s, root, item), true, id);
    }
    s.scene.updateMatrixWorld(true);
    const towerRoot = roots.get('outdoor-towers');
    const bodies = []; towerRoot.traverse((object) => { if (object.name === 'outdoor-elevated-tower-body' && object.isMesh) bodies.push(object); });
    assert.equal(bodies.length, 1, 'the platform must contain exactly one actual cooling-tower body');
    const platform = towerRoot.getObjectByName('outdoor-elevated-platform');
    assert.ok(platform, 'the model must identify the physical platform structure');
    // Compare actual mesh bounds in the room axes after applying world transforms.
    // This avoids diagonal world AABBs reporting overlap between adjacent equipment.
    const inverseRoom = new THREE.Matrix4().makeRotationY(-OUTDOOR_ROOM.rotation);
    const footprint = (object) => {
      const box = new THREE.Box3();
      object.traverse((mesh) => {
        if (!mesh.isMesh) return;
        mesh.geometry.computeBoundingBox();
        box.union(mesh.geometry.boundingBox.clone().applyMatrix4(inverseRoom.clone().multiply(mesh.matrixWorld)));
      });
      assert.equal(box.isEmpty(), false); return box;
    };
    const platformBounds = footprint(platform);
    for (const id of ['outdoor-water-1', 'outdoor-water-2']) {
      const root = roots.get(id);
      const shell = s.parts.find((part) => part.root === root)?.group;
      assert.ok(shell, `${id} must have a physical tank shell`);
      const bounds = footprint(shell);
      const overlapX = Math.min(bounds.max.x, platformBounds.max.x) - Math.max(bounds.min.x, platformBounds.min.x);
      const overlapZ = Math.min(bounds.max.z, platformBounds.max.z) - Math.max(bounds.min.z, platformBounds.min.z);
      assert.ok(overlapX <= .0001 || overlapZ <= .0001, `${id} must stand beside the platform, not underneath it (overlap ${overlapX.toFixed(3)} × ${overlapZ.toFixed(3)}m)`);
    }
  } finally {
    s.scene.traverse((mesh) => mesh.geometry?.dispose()); material.dispose();
  }
});

test('the video extension contains a two-fan condenser and distinct AHU with editable bodies on the extended deck', () => {
  const { s, material } = geometryHarness();
  const roots = new Map();
  const newIds = ['outdoor-condensers', 'outdoor-pet-ahu', 'outdoor-ahu', 'outdoor-split-unit'];
  try {
    const environment = buildOutdoorEnvironment(s);
    for (const id of ['outdoor-vessel', ...newIds]) {
      const item = OUTDOOR_EQUIPMENT.find((entry) => entry.id === id);
      assert.ok(item, id);
      const root = s._group(s.scene, item.position); root.rotation.y = item.rotation; roots.set(id, root);
      assert.equal(buildOutdoorEquipment(s, root, item), true, `${id} must build visible geometry`);
    }
    s.scene.updateMatrixWorld(true);
    const roomInverse = environment.deck.matrixWorld.clone().invert();
    const deck = boundsInFrame(environment.deck, roomInverse);
    const structure = [];
    environment.structure.traverse((mesh) => {
      if (mesh.isMesh) structure.push(boundsInFrame(mesh, roomInverse));
    });
    for (const id of newIds) {
      const item = OUTDOOR_EQUIPMENT.find((entry) => entry.id === id), root = roots.get(id);
      const shell = s.parts.find((part) => part.root === root)?.group;
      assert.ok(shell, `${id} must expose its actual body to the placement editor`);
      const local = boundsInFrame(shell, root.matrixWorld.clone().invert());
      const size = local.getSize(new THREE.Vector3());
      assert.ok(size.toArray().every((value) => Number.isFinite(value) && value > .1), `${id} must have finite physical dimensions`);
      const footprint = { minX: local.min.x, maxX: local.max.x, minZ: local.min.z, maxZ: local.max.z };
      const placement = constrainPlacement(item, item, { footprint, room: OUTDOOR_ROOM });
      assert.equal(placement.valid, true, `${id} must fit the extended placement region`);
      assert.equal(placement.limited, false, `${id} must retain its default position beyond the former end`);
      root.position.set(...placement.position); root.rotation.y = placement.rotation;
      s.scene.updateMatrixWorld(true);
      const body = boundsInFrame(shell, roomInverse), region = PLACEMENT_REGIONS.outdoor;
      assert.ok(body.min.x > 34, `${id} must remain in the new end section`);
      assert.ok(body.min.x >= region.minX - 1e-6 && body.max.x <= region.maxX + 1e-6, `${id} must stay within the editor's extended length`);
      assert.ok(body.min.z >= region.minZ - 1e-6 && body.max.z <= region.maxZ + 1e-6, `${id} must stay inside the corridor walls`);
      assert.ok(body.min.x >= deck.min.x && body.max.x <= deck.max.x && body.min.z >= deck.min.z && body.max.z <= deck.max.z, `${id} must have ground under its entire body`);
      for (const wall of structure) {
        const overlap = ['x', 'y', 'z'].every((axis) => Math.min(body.max[axis], wall.max[axis]) - Math.max(body.min[axis], wall.min[axis]) > 1e-5);
        assert.equal(overlap, false, `${id} must not intersect a wall left at the old corridor end`);
      }
    }
    const condenser = roots.get('outdoor-condensers'), fans = [], bays = [];
    condenser.traverse((object) => {
      if (/^outdoor-condenser-fan-\d+$/.test(object.name)) fans.push(object);
      if (/^outdoor-condenser-bay-\d+$/.test(object.name)) bays.push(object);
    });
    assert.equal(fans.length, 2, 'the visible two fans must not be lost or multiplied');
    assert.equal(bays.length, 2);
    for (const fan of fans) assert.ok(boundsInFrame(fan, condenser.matrixWorld.clone().invert()).getSize(new THREE.Vector3()).length() > 1, 'each fan bay needs its actual fan and guard meshes');
    const ahu = roots.get('outdoor-ahu'), vessel = roots.get('outdoor-vessel');
    assert.ok(ahu.getObjectByName('outdoor-ahu-body'));
    assert.ok(ahu.getObjectByName('outdoor-ahu-sloping-intake'));
    assert.ok(ahu.getObjectByName('outdoor-ahu-control-panel'));
    for(const id of ['outdoor-ahu','outdoor-pet-ahu']){
      const root=roots.get(id),inverse=root.matrixWorld.clone().invert();
      const body=boundsInFrame(root.getObjectByName('outdoor-ahu-body'),inverse);
      const support=boundsInFrame(root.getObjectByName('outdoor-ahu-roof-supported-frame'),inverse);
      assert.ok(Math.abs(support.min.y-body.max.y)<.08,`${id} duct support must stand on the lowered cabinet roof`);
      assert.ok(root.getObjectByName('outdoor-ahu-second-roof-duct'),`${id} keeps both photographed roof ducts`);
    }
    assert.equal(vessel.getObjectByName('outdoor-ahu-body'), undefined, 'the newly observed AHU must not be merged into the ladder vessel');
    assert.ok(boundsInFrame(ahu, roomInverse).min.x > boundsInFrame(vessel, roomInverse).max.x, 'AHU and ladder vessel need distinct non-overlapping positions');
  } finally {
    s.scene.traverse((mesh) => mesh.geometry?.dispose()); material.dispose();
  }
});

test('the exposed-coil bank faces across the factory-side pad before the PET short end, rather than blocking its long front', () => {
  const { s, material } = geometryHarness();
  try {
    const environment = buildOutdoorEnvironment(s), roots = new Map();
    for (const id of ['outdoor-vessel', 'outdoor-condensers', 'outdoor-pet-ahu', 'outdoor-ahu']) {
      const item = OUTDOOR_EQUIPMENT.find((entry) => entry.id === id);
      const root = s._group(s.scene, item.position); root.rotation.y = item.rotation;
      buildOutdoorEquipment(s, root, item); roots.set(id, root);
    }
    s.scene.updateMatrixWorld(true);
    const inverse = environment.deck.matrixWorld.clone().invert();
    const body = (id) => boundsInFrame(s.parts.find((part) => part.root === roots.get(id)).group, inverse);
    const coil = body('outdoor-condensers'), pet = body('outdoor-pet-ahu'), collector = body('outdoor-vessel');
    assert.ok(coil.max.x < pet.min.x, 'both coil bays must precede the PET short end instead of sharing its long-front stations');
    assert.ok(collector.max.x < coil.min.x, 'the bank must remain between the collector and the PET cabinet');
    assert.ok(pet.max.x < body('outdoor-ahu').min.x, 'correcting the PET neighbor must preserve the separate stick AHU');
    assert.ok(coil.min.z >= -2.925 && coil.max.z <= .425, 'the full bank must fit across the raised equipment pad');
    const a = roots.get('outdoor-condensers').getObjectByName('outdoor-condenser-fan-1');
    const b = roots.get('outdoor-condensers').getObjectByName('outdoor-condenser-fan-2');
    const ca = a.getWorldPosition(new THREE.Vector3()).applyMatrix4(inverse);
    const cb = b.getWorldPosition(new THREE.Vector3()).applyMatrix4(inverse);
    assert.ok(Math.abs(ca.x - cb.x) < 1e-6 && Math.abs(ca.z - cb.z) > 1, 'the two photographed fans must be side by side from factory wall toward boundary');
    const meshes = [];
    environment.structure.traverse((mesh) => { if (mesh.isMesh) meshes.push(boundsInFrame(mesh, inverse)); });
    for (const wall of meshes) {
      const overlap = ['x', 'y', 'z'].every((axis) => Math.min(coil.max[axis], wall.max[axis]) - Math.max(coil.min[axis], wall.min[axis]) > 1e-5);
      assert.equal(overlap, false, 'the perpendicular bank must clear actual wall and window-frame geometry');
    }
  } finally { s.scene.traverse((mesh) => mesh.geometry?.dispose()); material.dispose(); }
});

test('outdoor equipment remains separate from seven physical dryer stories and the roof service selector', async () => {
  assert.equal(OUTDOOR_ROOM.id, 'outdoor');
  assert.deepEqual(FLOORS.map(({ id }) => id), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(FLOORS.filter(({ kind }) => kind !== 'roof').map(({ id }) => id), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(EQUIPMENT.length, 47);
  assert.ok(OUTDOOR_EQUIPMENT.length >= 5, 'the room needs its distinct visible equipment groups');
  const all = [...EQUIPMENT, ...OUTDOOR_EQUIPMENT];
  assert.equal(new Set(all.map(({ id }) => id)).size, all.length, 'selection IDs must remain unique across both spaces');
  const siteRoot = await realpath(fileURLToPath(new URL('../apps/site/', import.meta.url)));
  for (const item of OUTDOOR_EQUIPMENT) {
    assert.equal(item.floor, 'outdoor', item.id);
    assert.equal(item.position.length, 3, item.id);
    assert.ok(item.position.every(Number.isFinite), item.id);
    assert.ok(Number.isFinite(item.rotation), item.id);
    assert.ok(item.photo && item.photos?.length, `${item.id} needs photo evidence`);
    for (const photo of new Set([item.photo, ...item.photos])) {
      assert.match(photo, /^\.\//);
      if (!isRetainedEvidenceImage(photo)) continue;
      const resolved = await realpath(path.resolve(siteRoot, photo));
      const relative = path.relative(siteRoot, resolved);
      assert.ok(relative && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative), photo);
      await access(resolved);
    }
  }
});

test('team 3 history cards bind verified outdoor identities and retain unmatched photos without invented installations', async () => {
  assert.equal(OUTDOOR_HISTORY_CARDS.length,14);
  assert.deepEqual(OUTDOOR_HISTORY_CARDS.map(c=>c.number),[72,73,74,75,76,84,85,86,87,88,89,90,91,92]);
  assert.equal(Object.keys(OUTDOOR_CARD_BINDINGS).length,11);
  assert.deepEqual(OUTDOOR_HISTORY_CARDS.filter(c=>!Object.values(OUTDOOR_CARD_BINDINGS).includes(c.number)).map(c=>c.number),[72,73,90]);
  for(const card of OUTDOOR_HISTORY_CARDS){
    assert.equal(card.team,'3팀');assert.equal(card.room,'실외기실');
    assert.equal(card.manufacturer,'');assert.equal(card.modelName,'');
    assert.equal('status' in card,false,'a historical status must not become live model state');
    for(const photo of [card.photo,...card.views]) { assert.equal(isRetainedEvidenceImage(photo), true); await access(new URL('../apps/site/'+photo.slice(2),import.meta.url)); }
    assert.ok(OUTDOOR_ROOM.photos.includes(card.photo));
  }
  for(const item of OUTDOOR_EQUIPMENT.filter(i=>i.historyCardNumber)){
    const card=OUTDOOR_HISTORY_CARDS.find(c=>c.number===item.historyCardNumber);
    assert.equal(item.historyCardMatch,'direct');assert.equal(item.historyCardName,card.name);
    assert.deepEqual(item.photos.slice(0,4),card.views);
    for(const photo of card.views)assert.ok(item.photoCaptions[photo]);
  }
  assert.equal(OUTDOOR_EQUIPMENT.find(i=>i.id==='outdoor-pet-ahu').historyCardNumber,85);
  assert.equal(OUTDOOR_EQUIPMENT.find(i=>i.id==='outdoor-ahu').historyCardNumber,84);
  assert.equal(OUTDOOR_EQUIPMENT.find(i=>i.id==='outdoor-chiller-40').historyCardNumber,89);
  assert.equal(OUTDOOR_EQUIPMENT.find(i=>i.id==='outdoor-end-units').historyCardNumber,undefined);
  assert.match(OUTDOOR_HISTORY_CARDS.find(c=>c.number===89).namingConflict,/40RT.*60RT/);
});

test('the final outdoor passage has editable supported equipment, two pumps and two end units without duplicating the tank', () => {
  const ids = ['outdoor-process-chiller', 'outdoor-end-panel-tank', 'outdoor-pump-skid', 'outdoor-chiller-40', 'outdoor-end-units', 'outdoor-end-sump', 'outdoor-blue-tank', 'outdoor-stainless-vessel'];
  const { s, material } = geometryHarness();
  const roots = new Map(), bodies = new Map();
  try {
    assert.equal(OUTDOOR_EQUIPMENT.length, 22);
    assert.ok(OUTDOOR_ROOM.length >= 109, 'the final tanks must be included in the room extent');
    const environment = buildOutdoorEnvironment(s);
    for (const id of ids) {
      const item = OUTDOOR_EQUIPMENT.find((entry) => entry.id === id);
      assert.ok(item, `${id} needs its own selectable identity`);
      const root = s._group(s.scene, item.position); root.rotation.y = item.rotation; roots.set(id, root);
      assert.equal(buildOutdoorEquipment(s, root, item), true, `${id} must build actual geometry`);
    }
    s.scene.updateMatrixWorld(true);
    const inverse = environment.deck.matrixWorld.clone().invert();
    const deck = boundsInFrame(environment.deck, inverse), region = PLACEMENT_REGIONS.outdoor;
    const structure = [];
    environment.structure.traverse((mesh) => { if (mesh.isMesh) structure.push(boundsInFrame(mesh, inverse)); });
    for (const id of ids) {
      const item = OUTDOOR_EQUIPMENT.find((entry) => entry.id === id), root = roots.get(id);
      const body = s.parts.find((part) => part.root === root)?.group;
      assert.ok(body, `${id} needs an actual editable body`);
      let meshes = 0;
      root.traverse((mesh) => {
        if (!mesh.isMesh) return;
        meshes++;
        const positions = mesh.geometry.getAttribute('position');
        for (let i = 0; i < positions.count; i++) assert.ok([positions.getX(i), positions.getY(i), positions.getZ(i)].every(Number.isFinite), `${id} has invalid geometry`);
      });
      assert.ok(meshes > 4, `${id} needs visible structural detail`);
      const local = boundsInFrame(body, root.matrixWorld.clone().invert());
      assert.ok(local.getSize(new THREE.Vector3()).toArray().every((value) => Number.isFinite(value) && value > .05), `${id} must have a nonempty physical body`);
      const footprint = { minX: local.min.x, maxX: local.max.x, minZ: local.min.z, maxZ: local.max.z };
      const placement = constrainPlacement(item, item, { footprint, room: OUTDOOR_ROOM });
      assert.equal(placement.valid, true, `${id} must fit the editable corridor`);
      assert.equal(placement.limited, false, `${id} default must not be moved by boundary correction`);
      root.position.set(...placement.position); root.rotation.y = placement.rotation;
      s.scene.updateMatrixWorld(true);
      const bounds = boundsInFrame(body, inverse); bodies.set(id, bounds);
      assert.ok(bounds.min.x > 45, `${id} must extend beyond the previous room`);
      for (const [axis, low, high] of [['x', region.minX, region.maxX], ['z', region.minZ, region.maxZ]]) {
        assert.ok(bounds.min[axis] >= low - 1e-6 && bounds.max[axis] <= high + 1e-6, `${id} must stay inside the ${axis} placement limits`);
        assert.ok(bounds.min[axis] >= deck.min[axis] && bounds.max[axis] <= deck.max[axis], `${id} needs ground under its entire body`);
      }
      for (const wall of structure) {
        const overlap = ['x', 'y', 'z'].every((axis) => Math.min(bounds.max[axis], wall.max[axis]) - Math.max(bounds.min[axis], wall.min[axis]) > 1e-5);
        assert.equal(overlap, false, `${id} body intersects the factory, masonry or fence`);
      }
    }
    for (const [id, pattern] of [['outdoor-pump-skid', /^outdoor-end-pump-\d+$/], ['outdoor-end-units', /^outdoor-end-unit-\d+$/]]) {
      const groups = [];
      roots.get(id).traverse((object) => { if (pattern.test(object.name)) groups.push(object); });
      assert.equal(groups.length, 2, `${id} must keep exactly the two separately visible components`);
      for (const group of groups) {
        const size = boundsInFrame(group, roots.get(id).matrixWorld.clone().invert()).getSize(new THREE.Vector3());
        assert.ok(size.toArray().every((value) => value > .1 && Number.isFinite(value)), `${group.name} needs actual 3D geometry`);
      }
    }
    const tank = bodies.get('outdoor-end-panel-tank'), pumps = bodies.get('outdoor-pump-skid');
    assert.ok(pumps.min.x >= tank.max.x, 'tank and pump skid must occupy separate neighboring footprints');
    assert.ok(bodies.get('outdoor-stainless-vessel').min.x > bodies.get('outdoor-blue-tank').max.x, 'the blue and stainless final tanks must remain distinct');
    assert.equal(OUTDOOR_EQUIPMENT.find(({ id }) => id === 'outdoor-ahu').historyCardNumber, 84, 'removing document controls must preserve the AHU card identity used for modeling');
  } finally {
    s.scene.traverse((mesh) => mesh.geometry?.dispose()); material.dispose();
  }
});

test('desktop and phone whole-room views include the first rack and both final tanks without a zoom jump', async () => {
  const source = (await readFile(new URL('../apps/site/scene.js', import.meta.url), 'utf8'))
    .replace(/^import .*;\r?\n/gm, '').replace('export function createFacilityScene', 'function createFacilityScene');
  const context = vm.createContext({ THREE, OUTDOOR_ROOM, fromRoomPosition });
  new vm.Script(`${source}\nglobalThis.FacilityScene = FacilityScene;`).runInContext(context);
  const { s, material } = geometryHarness();
  try {
    for (const item of OUTDOOR_EQUIPMENT) {
      const root = s._group(s.scene, item.position); root.rotation.y = item.rotation;
      assert.equal(buildOutdoorEquipment(s, root, item), true, item.id);
    }
    s.scene.updateMatrixWorld(true);
    const corners = [];
    s.scene.traverse((mesh) => {
      if (!mesh.isMesh) return;
      mesh.geometry.computeBoundingBox();
      const box = mesh.geometry.boundingBox;
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        corners.push(new THREE.Vector3(x, y, z).applyMatrix4(mesh.matrixWorld));
      }
    });
    for (const [width, height] of [[1100, 760], [390, 400]]) {
      const scene = Object.create(context.FacilityScene.prototype);
      Object.assign(scene, {
        canvas: { parentElement: { getBoundingClientRect: () => ({ width, height }) } },
        renderer: { setSize() {} }, activeFloor: 'outdoor', view: 'perspective',
        camera: new THREE.PerspectiveCamera(42, 1, .1, 400),
        topCamera: new THREE.OrthographicCamera(-18, 18, 18, -18, .1, 300),
        target: new THREE.Vector3(), goalTarget: new THREE.Vector3(),
        orbit: { azimuth: .76, elevation: .69, distance: 46 }, goalOrbit: {},
        // This harness isolates camera fitting; full scene tests cover facade visibility.
        onViewChange() {}, _invalidate() {}, _visibility() {},
      });
      scene.topCamera.up.set(0, 0, -1);
      scene.resize();
      for (const view of ['perspective', 'top']) {
        scene.setView(view);
        scene.target.copy(scene.goalTarget); Object.assign(scene.orbit, scene.goalOrbit);
        scene._updateCamera();
        const camera = scene._currentCamera();
        for (const corner of corners) {
          const projected = corner.clone().project(camera);
          assert.ok(Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1 && projected.z >= -1 && projected.z <= 1,
            `${width}×${height} ${view} must contain all equipment (projected ${projected.toArray().map((n) => n.toFixed(3)).join(', ')})`);
        }
        if (view === 'top') {
          const initial = scene.topCamera.zoom;
          scene.zoomBy(1);
          assert.equal(scene.topCamera.zoom, initial, 'the first top-view zoom must not jump to an obsolete minimum');
        }
      }
    }
  } finally {
    s.scene.traverse((mesh) => mesh.geometry?.dispose()); material.dispose();
  }
});

test('top dragging and aisle right dragging can reach the final tank and return to the entry', async () => {
  const source = (await readFile(new URL('../apps/site/scene.js', import.meta.url), 'utf8'))
    .replace(/^import .*;\r?\n/gm, '').replace(/^export\s+(?=(?:function|class|const|let)\b)/gm, '');
  const context = vm.createContext({ THREE, OUTDOOR_ROOM, fromRoomPosition, toRoomPosition });
  new vm.Script(`${source}\nglobalThis.FacilityScene = FacilityScene;`).runInContext(context);
  for (const view of ['top', 'aisle']) {
    const handlers = new Map(), captures = new Set();
    const canvas = { style: {}, dataset: {},
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 600 }),
      setPointerCapture(id) { captures.add(id); }, hasPointerCapture: (id) => captures.has(id), releasePointerCapture: (id) => captures.delete(id),
      addEventListener: (type, handler) => handlers.set(type, handler), removeEventListener() {},
    };
    const scene = Object.create(context.FacilityScene.prototype);
    Object.assign(scene, { canvas, listeners: [], activeFloor: 'outdoor', height: 600, width: 1000,
      scene: new THREE.Scene(), raycaster: new THREE.Raycaster(),
      camera: new THREE.PerspectiveCamera(42, 1000 / 600, .02, 3000),
      topCamera: new THREE.OrthographicCamera(-18, 18, 18, -18, .1, 300),
      target: new THREE.Vector3(), goalTarget: new THREE.Vector3(),
      orbit: {}, goalOrbit: {}, equipment: OUTDOOR_EQUIPMENT, onViewChange() {}, _invalidate() {}, _visibility() {}, _hit: () => null,
    });
    scene.setView(view); scene._controls();
    if (view === 'aisle') assert.ok(Math.abs(toRoomPosition(scene.goalTarget.toArray(), OUTDOOR_ROOM)[2] - OUTDOOR_ROOM.aisleCenterZ) < 1e-8,
      'the walking camera must begin in the widened aisle');
    const pointer = { pointerId: 1, button: view === 'top' ? 0 : 2, shiftKey: false, clientX: 400, clientY: 200 };
    handlers.get('pointerdown')(pointer);
    const yaw = OUTDOOR_ROOM.rotation;
    const displacement = view === 'top' ? [-Math.cos(yaw) * 5000, Math.sin(yaw) * 5000] : [0, 10000];
    handlers.get('pointermove')({ ...pointer, clientX: pointer.clientX + displacement[0], clientY: pointer.clientY + displacement[1] });
    const end = toRoomPosition(scene.goalTarget.toArray(), OUTDOOR_ROOM);
    const final = toRoomPosition(OUTDOOR_EQUIPMENT.find(({ id }) => id === 'outdoor-stainless-vessel').position, OUTDOOR_ROOM);
    assert.ok(end[0] >= final[0], `${view} must reach the last tank instead of stopping at the former world-coordinate limit`);
    assert.ok(end.every(Number.isFinite) && end[0] > OUTDOOR_ROOM.length + 5, `${view} camera travel must continue past the former hard corridor boundary`);
    handlers.get('pointermove')({ ...pointer, clientX: pointer.clientX - displacement[0], clientY: pointer.clientY - displacement[1] });
    const entry = toRoomPosition(scene.goalTarget.toArray(), OUTDOOR_ROOM);
    assert.ok(entry[0] <= 5, `${view} must pan back to the entry`);
    handlers.get('pointerup')(pointer);
    assert.equal(captures.size, 0, 'finishing the navigation gesture must release pointer capture');
    const notifications = [];
    scene.onNavigationChange = (progress) => notifications.push(progress);
    scene.setOutdoorProgress(100);
    assert.equal(scene.view, view, 'the position control must retain the chosen top or aisle view');
    assert.ok(Math.abs(scene.getOutdoorProgress() - 100) < 1e-8, 'the position control must reach the actual end');
    assert.ok(Math.abs(toRoomPosition(scene.goalTarget.toArray(), OUTDOOR_ROOM)[2] - OUTDOOR_ROOM.aisleCenterZ) < 1e-8,
      'the position control must stay in the widened aisle');
    assert.equal(notifications.at(-1), 100, 'dragging and the position control must report their current progress');
    if (view === 'top') assert.ok(scene.topCamera.zoom >= .85, 'the position control should expose useful detail in the top view');
    scene.setOutdoorProgress(0);
    assert.ok(Math.abs(scene.getOutdoorProgress()) < 1e-8, 'the position control must return to its entry endpoint');
    scene.setView('perspective');
    scene.setOutdoorProgress(100);
    assert.equal(scene.view, 'aisle', 'moving along the passage from an overview must enter the walking view');
    scene.setOutdoorProgress(0);
    const beforeTouch = toRoomPosition(scene.goalTarget.toArray(), OUTDOOR_ROOM)[0];
    const fingers = [
      { pointerId: 2, button: 0, shiftKey: false, clientX: 300, clientY: 200 },
      { pointerId: 3, button: 0, shiftKey: false, clientX: 500, clientY: 200 },
    ];
    for (const finger of fingers) handlers.get('pointerdown')(finger);
    for (const finger of fingers) handlers.get('pointermove')({ ...finger, clientY: finger.clientY + 40 });
    assert.ok(toRoomPosition(scene.goalTarget.toArray(), OUTDOOR_ROOM)[0] > beforeTouch + .5, 'moving both fingers together must pan forward on a phone');
    assert.equal(scene.view, 'aisle', 'two-finger panning must retain the walking view');
    for (const finger of fingers) handlers.get('pointerup')(finger);
    assert.equal(captures.size, 0, 'the two-finger gesture must release both captured pointers');
    scene.labelsEnabled = false;
    scene.select = (id) => { scene.selected = id; };
    const finalItem = OUTDOOR_EQUIPMENT.find(({ id }) => id === 'outdoor-stainless-vessel');
    scene.focusPlacement(finalItem.id);
    assert.equal(scene.selected, finalItem.id, 'starting placement must retain the selected final equipment');
    assert.equal(scene.view, 'top');
    assert.deepEqual(scene.goalTarget.toArray(), finalItem.position, 'placement must center the final equipment instead of the old room center');
    assert.ok(scene.topCamera.zoom >= 1, 'placement must show the selected body at a usable scale');
    assert.equal(scene.labelsEnabled, false, 'starting placement must keep equipment name labels hidden');
  }
});

test('local and shared views start with equipment labels switched off', async () => {
  for (const file of ['../apps/site/index.html', '../apps/site/share/index.html']) {
    const html = await readFile(new URL(file, import.meta.url), 'utf8');
    const input = [...html.matchAll(/<input\b[^>]*>/g)].find(([tag]) => /\bid=["']labels-toggle["']/.test(tag))?.[0];
    assert.ok(input, `${file} needs its labels toggle`);
    assert.doesNotMatch(input, /\bchecked(?:\s|=|>)/, `${file} must not begin with equipment labels over the model`);
  }
});

function personNavigationSceneStub(scene, calls) {
  scene.setAutomaticDoors = (enabled) => { scene.autoOpenDoors = !!enabled; calls.push(['setAutomaticDoors', enabled]); };
  scene.setPersonViewScale = (scale) => { scene.personViewScale = scale; calls.push(['setPersonViewScale', scale]); };
  scene.interactDoor = () => calls.push(['interactDoor']);
}

function navigationStorage(preferences) {
  const values = new Map(preferences ? [['dryer-person-navigation-v1', JSON.stringify(preferences)]] : []);
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) };
}

async function localViewerHarness(url = 'https://example.invalid/apps/site/index.html?floor=outdoor', { navigationPreferences } = {}) {
  const source = (await readFile(new URL('../apps/site/app.js', import.meta.url), 'utf8'))
    .replace(/^import .*;\r?\n/gm, '').replace("  const { createFacilityScene } = await import('./scene.js');", '');
  const elements = new Map();
  const makeElement = (id) => ({ id, dataset: {}, children: [], attributes: {}, listeners: {}, hidden: false, checked: false,
    textContent: '', style: {}, classList: { add() {}, toggle() {} },
    addEventListener(type, callback) { this.listeners[type] = callback; },
    click() { this.listeners.click?.({ target: this }); },
    focus() { this.focused = true; },
    querySelector(selector) { return selector === 'label' ? element(`${id}-label`) : null; },
    setAttribute(name, value) { this.attributes[name] = value; },
    removeAttribute(name) { delete this.attributes[name]; delete this[name]; },
    append(...children) { this.children.push(...children); }, replaceChildren(...children) { this.children = [...children]; },
  });
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, makeElement(id));
    return elements.get(id);
  };
  const areaButtons = ['campus', 'dryer', 'packaging', 'liquid', 'outdoor'].map((area) => {
    const button = element(area === 'liquid' ? 'liquid-open' : `area-${area}`); button.dataset.area = area; return button;
  });
  const documentListeners = {};
  const document = { body: makeElement('body'), hidden: false,
    getElementById: element, createElement: (tag) => makeElement(tag), createTextNode: (text) => ({ textContent: text }),
    querySelectorAll: (selector) => selector === '.equipment-button' ? element('equipment-list').children
      : selector === '.photo-thumbnail' ? element('photo-thumbnails').children
        : selector === '#floor-selector [data-floor]' ? element('floor-selector').children
          : selector === '[data-packaging-level]' ? element('packaging-floor-selector').children
          : selector === '.area-selector [data-area]' ? areaButtons : [],
    querySelector: (selector) => selector === '[data-view="aisle"]' ? element('aisle-view') : null, addEventListener(type, callback) { documentListeners[type] = callback; },
  };
  const window = { addEventListener() {} }; window.parent = window;
  const calls = [], errors = [], moving = [], furnaceCalls = [], chillerCalls = [], liquidCalls = [], upperReferenceCalls = [];
  const scene = Object.fromEntries(['setLabels', 'setStructure', 'setDucts', 'setFloor', 'setSurvey', 'setSurveyPhoto', 'select', 'focus', 'setIsolation', 'setExplosion', 'setPartitions', 'showPreparationLowerView', 'setActive', 'setOutdoorProgress', 'setCampusProgress', 'setPackagingProgress', 'setPackagingLevel', 'setPackagingCargoVisible', 'resetView', 'resize'].map((method) => [method, (...args) => calls.push([method, ...args])]));
  personNavigationSceneStub(scene, calls);
  scene.setCampusInterior = (value) => { scene.campusInteriorEnabled = !!value; calls.push(['setCampusInterior', value]); };
  scene.getOutdoorProgress = scene.getCampusProgress = scene.getPackagingProgress = () => 50;
  let sceneOptions, liquidLifecycle, liquidInstance;
  const localStorage = navigationStorage(navigationPreferences);
  const context = vm.createContext({ DRYER_EQUIPMENT: EQUIPMENT, SITE_NOTE, FLOORS, floorById, OUTDOOR_EQUIPMENT, OUTDOOR_ROOM, CAMPUS_EQUIPMENT, CAMPUS_ROOM, PACKAGING_EQUIPMENT, PACKAGING_ROOM, PACKAGING_ROOMS, PACKAGING_OVERVIEW, SURVEY_PHOTOS,
    document, window, localStorage, location: new URL(url), URL, URLSearchParams, isRetainedEvidenceImage, BURNER_MAINTENANCE_DOCUMENTS,
    console: { error: (...args) => errors.push(args) }, setTimeout, clearTimeout,
    createFurnaceDetail: () => ({ open: () => furnaceCalls.push('open'), dispose() {} }),
    createChillerDetail: () => ({ open: () => chillerCalls.push('open'), close: () => chillerCalls.push('close'), dispose: () => chillerCalls.push('dispose') }),
    createLiquidDetail: (lifecycle = {}) => { liquidLifecycle = lifecycle; let opened=false; liquidInstance={open(options){liquidCalls.push(options||{});if(!opened){opened=true;lifecycle.onOpen?.();}},close(){if(opened){opened=false;lifecycle.onClose?.();}},dispose(){}};return liquidInstance; },
    createDryerUpperReference: () => ({ open: (time) => upperReferenceCalls.push(['open', time]), close: () => upperReferenceCalls.push(['close']), dispose: () => upperReferenceCalls.push(['dispose']) }),
    createLayoutEditor: () => ({ select() {}, startMoving: (id) => moving.push(id), stopMoving: () => calls.push(['stopMoving']), dispose() {} }),
    createFacilityScene: (canvas, options) => { sceneOptions = options; return scene; },
  });
  new vm.Script(`${source}\nglobalThis.ui = { setFloor, setPhoto, selectEquipment, setPackagingLevel, getPackagingLevel: () => packagingLevel, getFloor: () => activeFloor };`).runInContext(context);
  return { context, element, areaButtons, calls, errors, moving, furnaceCalls, chillerCalls, liquidCalls, closeLiquid: () => liquidInstance.close(), liquidHost: liquidLifecycle.host, upperReferenceCalls, sceneOptions, document, documentListeners, scene, localStorage };
}

test('local outdoor viewing retains drawings and team 3 cards without requesting retired GPS photographs', async () => {
  const { context, element, calls, errors, moving, sceneOptions } = await localViewerHarness();
  assert.deepEqual(errors, [], 'the local viewer must complete startup');
  assert.equal(element('site-canvas').dataset.ready, 'true');
  assert.equal(element('move-equipment').disabled, true, 'equipment movement needs a selected object');
  assert.equal(sceneOptions.survey.length, 0, 'the 3D scene must not build GPS position markers');
  assert.ok(calls.some(([method, value]) => method === 'setSurvey' && value === false));
  const hiddenCoordinates = () => {
    for (const id of ['survey-option', 'survey-legend', 'photo-info']) assert.equal(element(id).hidden, true, `${id} must stay hidden`);
    assert.equal(element('photo-location').textContent, '');
  };
  hiddenCoordinates();
  const thumbnails = element('photo-thumbnails').children;
  const originalPhotoIndex = thumbnails.findIndex((button) => button.children[0]?.src === SURVEY_PHOTOS[0].photo);
  assert.equal(originalPhotoIndex, -1, 'retired GPS photographs must not appear in the gallery');
  assert.ok(thumbnails.every(button => isRetainedEvidenceImage(button.children[0]?.src)), 'only retained drawings and team 3 cards may be requested');
  hiddenCoordinates();
  const roomDrawings = OUTDOOR_ROOM.photos.filter(photo => photo.includes('/assets/drawings/outdoor/'));
  assert.equal(roomDrawings.length, 5, 'all five retained room plans use current asset paths');
  for (const source of roomDrawings) {
    const thumbnail = thumbnails.find((button) => button.children[0]?.src === source);
    assert.ok(thumbnail, 'the room drawing must be reachable in the actual overview gallery');
    thumbnail.click();
    assert.equal(element('reference-photo').src, source);
    assert.equal(element('reference-caption').textContent, OUTDOOR_ROOM.photoCaptions[source]);
    hiddenCoordinates();
  }
  context.ui.selectEquipment('outdoor-unit-1');
  assert.equal(element('move-equipment').disabled, false);
  element('move-equipment').listeners.click();
  assert.deepEqual(moving, ['outdoor-unit-1'], 'the visible movement action must use the selected object');
  hiddenCoordinates();
  for (const floor of [7, 'outdoor']) {
    context.ui.setFloor(floor);
    hiddenCoordinates();
  }
  assert.ok(calls.filter(([method]) => method === 'setSurveyPhoto').every(([, value]) => value === null), 'reference photos must not activate their GPS markers');
});

async function sharedViewerHarness(url = 'https://example.invalid/?floor=outdoor', { parentUrl, navigationPreferences } = {}) {
  let source = await readFile(new URL('../apps/site/share/app.js', import.meta.url), 'utf8');
  source = source.replace(/^import .*;\r?\n/gm, '').replace("  const { createFacilityScene } = await import('../scene.js');", '');
  const elements = new Map();
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, { id, dataset: {}, children: [], attributes: {}, listeners: {}, hidden: false, checked: false,
      addEventListener(type, callback) { this.listeners[type] = callback; },
      click() { this.listeners.click?.({ target: this }); },
      focus() { this.focused = true; },
      querySelector(selector) { return selector === 'label' ? element(`${id}-label`) : null; },
      setAttribute(key, value) { this.attributes[key] = value; },
      append(child) { this.children.push(child); } });
    return elements.get(id);
  };
  const areaButtons = ['campus', 'dryer', 'packaging', 'liquid', 'outdoor'].map((area) => {
    const button = element(area === 'liquid' ? 'liquid-open' : `area-${area}`);
    button.dataset.area = area;
    return button;
  });
  const calls = [];
  const editorSelections = [];
  const editorTransforms = [];
  const editorMoving = [];
  const furnaceCalls = [];
  const chillerCalls = [], liquidCalls = [], upperReferenceCalls = [];
  let editorOptions;
  let sceneOptions, liquidLifecycle, liquidInstance;
  const scene = Object.fromEntries(['select', 'focus', 'setIsolation', 'setExplosion', 'setFloor', 'setActive', 'setLabels', 'setPartitions', 'showPreparationLowerView', 'setOutdoorProgress', 'setCampusProgress', 'setPackagingProgress', 'setPackagingLevel', 'setPackagingCargoVisible', 'resetView', 'resize'].map((method) => [method, (...args) => calls.push([method, ...args])]));
  personNavigationSceneStub(scene, calls);
  scene.setCampusInterior = (value) => { scene.campusInteriorEnabled = !!value; calls.push(['setCampusInterior', value]); };
  scene.getOutdoorProgress = scene.getCampusProgress = scene.getPackagingProgress = () => 50;
  const documentListeners = {};
  const document = { body: { dataset: {} }, hidden: false, getElementById: element, createElement: () => element(`created-${elements.size}`),
    querySelectorAll: (selector) => selector === '[data-floor]' ? element('floor-selector').children : selector === '[data-packaging-level]' ? element('packaging-floor-selector').children : selector === '.area-selector [data-area]' ? areaButtons : [], querySelector: (selector) => selector === '[data-view="aisle"]' ? element('aisle-view') : null, addEventListener(type, callback) { documentListeners[type] = callback; } };
  const window = { addEventListener() {} }; window.parent = window;
  const localStorage = navigationStorage(navigationPreferences);
  if (parentUrl) window.parent = { location: new URL(parentUrl), postMessage() {} };
  const context = vm.createContext({ EQUIPMENT, FLOORS, OUTDOOR_EQUIPMENT, OUTDOOR_ROOM, CAMPUS_EQUIPMENT, CAMPUS_ROOM, PACKAGING_EQUIPMENT, PACKAGING_ROOM, PACKAGING_ROOMS, PACKAGING_OVERVIEW, document, window,
    location: new URL(url), localStorage, history: { replaceState() {} }, BURNER_MAINTENANCE_DOCUMENTS,
    URL, URLSearchParams, console, setTimeout, clearTimeout, isRetainedEvidenceImage,
    createFurnaceDetail: () => ({ open: () => furnaceCalls.push('open'), close: () => furnaceCalls.push('close'), dispose: () => furnaceCalls.push('dispose') }),
    createChillerDetail: () => ({ open: () => chillerCalls.push('open'), close: () => chillerCalls.push('close'), dispose: () => chillerCalls.push('dispose') }),
    createLiquidDetail: (lifecycle = {}) => { liquidLifecycle = lifecycle; let opened=false; liquidInstance={open(options){liquidCalls.push(options||{});if(!opened){opened=true;lifecycle.onOpen?.();}},close(){if(opened){opened=false;lifecycle.onClose?.();}},dispose(){}};return liquidInstance; },
    createDryerUpperReference: () => ({ open: (time) => upperReferenceCalls.push(['open', time]), close: () => upperReferenceCalls.push(['close']), dispose: () => upperReferenceCalls.push(['dispose']) }),
    createLayoutEditor: (options) => {
      editorOptions = options;
      return { select: (id) => editorSelections.push(id), startMoving: (id) => editorMoving.push(id), stopMoving: () => calls.push(['stopMoving']), handleTransform: (event) => editorTransforms.push(event), dispose() {} };
    },
    createFacilityScene: (canvas, options) => { sceneOptions = options; return scene; } });
  new vm.Script(`${source}\nglobalThis.ui = { setFloor, select, setPackagingLevel, getPackagingLevel: () => packagingLevel, getFloor: () => floor };`).runInContext(context);
  return { context, element, areaButtons, calls, editorSelections, editorMoving, editorTransforms, furnaceCalls, chillerCalls, liquidCalls, closeLiquid: () => liquidInstance.close(), liquidHost: liquidLifecycle.host, upperReferenceCalls, editorOptions, sceneOptions, scene, document, documentListeners, localStorage };
}

test('local and shared person controls restore navigation preferences and forward door and view changes to the scene', async () => {
  for (const factory of [localViewerHarness, sharedViewerHarness]) {
    const fresh = await factory();
    assert.equal(fresh.scene.autoOpenDoors, false, 'manual doors are the initial setting');
    assert.equal(fresh.scene.personViewScale, 1);
    assert.equal(fresh.element('auto-doors-toggle').checked, false);
    assert.equal(fresh.element('person-door-action').disabled, true, 'manual action requires an eligible nearby door');

    const h = await factory(undefined, { navigationPreferences: { automatic: true, scale: 1.15 } });
    assert.equal(h.element('site-canvas').dataset.ready, 'true');
    assert.equal(h.scene.autoOpenDoors, true, 'stored automatic mode reaches the scene during startup');
    assert.equal(h.scene.personViewScale, 1.15, 'stored field of view reaches the scene during startup');
    assert.equal(h.element('person-view-scale-output').textContent, '115%');
    h.sceneOptions.onDoorInteraction({ label: '2팀 뒷출입문', action: 'open' });
    assert.equal(h.element('person-door-action').hidden, true);
    assert.equal(h.element('person-door-hint').textContent, '2팀 뒷출입문 · 자동');

    h.element('auto-doors-toggle').checked = false;
    h.element('auto-doors-toggle').listeners.change();
    assert.deepEqual(h.calls.filter(([method]) => method === 'setAutomaticDoors').at(-1), ['setAutomaticDoors', false]);
    assert.equal(h.element('person-door-action').hidden, false);
    assert.equal(h.element('person-door-action').disabled, false);
    h.element('person-door-action').click();
    assert.deepEqual(h.calls.at(-1), ['interactDoor']);
    assert.equal(h.element('site-canvas').focused, true, 'door controls restore keyboard walking focus');
    h.sceneOptions.onDoorInteraction({ label: '2팀 뒷출입문', action: 'close' });
    assert.equal(h.element('person-door-action').textContent, '문 닫기 · F');

    h.element('person-view-scale').value = '125';
    h.element('person-view-scale').listeners.input();
    assert.deepEqual(h.calls.at(-1), ['setPersonViewScale', 1.25]);
    assert.equal(h.element('person-view-scale-output').textContent, '125%');
    assert.deepEqual(JSON.parse(h.localStorage.getItem('dryer-person-navigation-v1')), { automatic: false, scale: 1.25 });
  }
});

test('local company viewing starts on campus, selects a building and keeps each detailed room available', async () => {
  const { context, element, areaButtons, errors, moving, sceneOptions, document } = await localViewerHarness('https://example.invalid/apps/site/index.html');
  assert.deepEqual(errors, []);
  assert.equal(context.ui.getFloor(), 'campus');
  assert.equal(sceneOptions.floor, 'campus');
  assert.equal(sceneOptions.equipment.length, EQUIPMENT.length + OUTDOOR_EQUIPMENT.length + CAMPUS_EQUIPMENT.length + PACKAGING_EQUIPMENT.length);
  assert.equal(document.body.dataset.area, 'campus');
  assert.equal(element('floor-selector').hidden, true);
  assert.equal(element('furnace-open').hidden, true);
  assert.equal(element('outdoor-navigation').hidden, false);
  assert.equal(element('equipment-heading').textContent, '건물·구역 목록');
  assert.equal(element('equipment-list').children.filter((node) => !node.hidden).length, CAMPUS_EQUIPMENT.length);
  assert.equal(element('reference-photo').src, CAMPUS_ROOM.photos.filter(isRetainedEvidenceImage)[0]);
  context.ui.selectEquipment(CAMPUS_EQUIPMENT[0].id);
  assert.equal(element('detail-name').textContent, CAMPUS_EQUIPMENT[0].name);
  assert.doesNotMatch(element('scene-heading').textContent, /campus층/);
  const selectedReference = [CAMPUS_EQUIPMENT[0].photo, ...CAMPUS_EQUIPMENT[0].photos].find(isRetainedEvidenceImage);
  if (selectedReference) assert.equal(element('reference-caption').textContent, CAMPUS_ROOM.photoCaptions[selectedReference]);
  else assert.equal(element('reference-photo-button').hidden, true);
  assert.equal(element('move-equipment').textContent, '건물·구역 이동');
  element('move-equipment').click();
  assert.deepEqual(moving, [CAMPUS_EQUIPMENT[0].id]);
  const campusButton = areaButtons.find((button) => button.dataset.area === 'campus');
  const dryerButton = areaButtons.find((button) => button.dataset.area === 'dryer');
  const outdoorButton = areaButtons.find((button) => button.dataset.area === 'outdoor');
  dryerButton.click();
  assert.equal(context.ui.getFloor(), 7);
  element('floor-selector').children.find((button) => button.dataset.floor === '3').click();
  campusButton.click(); outdoorButton.click(); dryerButton.click();
  assert.equal(context.ui.getFloor(), 3, 'campus and outdoor navigation must not overwrite the chosen dryer floor');
  context.ui.setFloor('all');
  assert.equal(element('equipment-list').children.filter((node) => !node.hidden).length, EQUIPMENT.length, 'whole dryer view must exclude campus and outdoor items');
  for (const [query, expected] of [['floor=7', 7], ['floor=outdoor', 'outdoor'], ['floor=all', 'all'], ['equipment=heater', 6]]) {
    const linked = await localViewerHarness(`https://example.invalid/apps/site/index.html?${query}`);
    assert.equal(linked.context.ui.getFloor(), expected, `${query} must retain its explicit room`);
    assert.deepEqual(linked.errors, []);
  }
});

test('shared company viewing starts on campus while preserving explicit dryer and outdoor links', async () => {
  const { context, element, areaButtons, sceneOptions, editorMoving } = await sharedViewerHarness('https://example.invalid/');
  assert.equal(context.ui.getFloor(), 'campus');
  assert.equal(sceneOptions.floor, 'campus');
  assert.equal(element('floor-selector').hidden, true);
  assert.equal(element('furnace-open').hidden, true);
  assert.equal(element('outdoor-navigation').hidden, false);
  assert.equal(element('area-summary').textContent, `${CAMPUS_ROOM.name} · 건물·구역 ${CAMPUS_EQUIPMENT.length}개`);
  assert.equal(areaButtons.find((button) => button.dataset.area === 'campus').attributes['aria-pressed'], 'true');
  context.ui.select(CAMPUS_EQUIPMENT[0].id);
  assert.equal(element('selection-name').textContent, `공장 전경 · ${CAMPUS_EQUIPMENT[0].name}`);
  assert.equal(element('move-equipment').textContent, '건물·구역 이동');
  element('move-equipment').click();
  assert.deepEqual(editorMoving, [CAMPUS_EQUIPMENT[0].id]);
  context.ui.setFloor('all');
  assert.equal(element('area-summary').textContent, `건조실 전체 · 설비 ${EQUIPMENT.length}개`);
  areaButtons.find((button) => button.dataset.area === 'campus').click();
  areaButtons.find((button) => button.dataset.area === 'dryer').click();
  assert.equal(context.ui.getFloor(), 'all');
  for (const [query, expected] of [['floor=7', 7], ['floor=outdoor', 'outdoor'], ['floor=all', 'all']]) {
    const linked = await sharedViewerHarness(`https://example.invalid/?${query}`);
    assert.equal(linked.context.ui.getFloor(), expected, `${query} must retain its explicit room`);
  }
});

test('shared viewer exposes outdoor navigation and retains outdoor deep links', async () => {
  const { context, element, areaButtons, calls, editorSelections, editorTransforms, editorOptions, sceneOptions, scene } = await sharedViewerHarness();
  assert.equal(context.ui.getFloor(), 'outdoor');
  assert.equal(sceneOptions.floor, 'outdoor');
  assert.equal(sceneOptions.equipment.length, EQUIPMENT.length + OUTDOOR_EQUIPMENT.length + CAMPUS_EQUIPMENT.length + PACKAGING_EQUIPMENT.length);
  assert.equal(editorOptions.scene, scene);
  assert.equal(editorOptions.equipment.length, sceneOptions.equipment.length);
  assert.equal(editorOptions.container, element('layout-editor'));
  const buttons = element('floor-selector').children;
  assert.deepEqual(buttons.map((button) => button.dataset.floor), ['all', ...FLOORS.map((floor) => String(floor.id))]);
  const outdoorButton = areaButtons.find((button) => button.dataset.area === 'outdoor');
  const dryerButton = areaButtons.find((button) => button.dataset.area === 'dryer');
  assert.equal(element('floor-selector').hidden, true);
  assert.equal(element('area-summary').textContent, `실외기실 · 설비 ${OUTDOOR_EQUIPMENT.length}개`);
  assert.equal(outdoorButton.attributes['aria-pressed'], 'true');
  context.ui.select(OUTDOOR_EQUIPMENT[0].id);
  assert.equal(editorSelections.at(-1), OUTDOOR_EQUIPMENT[0].id);
  const transform = { id: OUTDOOR_EQUIPMENT[0].id, position: [1, 0, 2], rotation: 0, phase: 'end' };
  sceneOptions.onTransformChange(transform);
  assert.equal(editorTransforms.at(-1), transform);
  assert.match(element('selection-name').textContent, /^실외기실 · /);
  context.ui.select('outdoor-ahu');
  assert.match(element('selection-name').textContent, /치어팩 스틱실 공조기/);
  dryerButton.click();
  assert.equal(context.ui.getFloor(), 7);
  assert.equal(element('selection').hidden, true);
  assert.equal(element('floor-selector').hidden, false);
  assert.equal(dryerButton.attributes['aria-pressed'], 'true');
  buttons.find((button) => button.dataset.floor === '3').click();
  outdoorButton.click();
  assert.equal(context.ui.getFloor(), 'outdoor');
  assert.equal(element('floor-selector').hidden, true);
  dryerButton.click();
  assert.equal(context.ui.getFloor(), 3, 'returning from outdoors must restore the chosen dryer floor');
  context.ui.setFloor('invalid');
  assert.equal(context.ui.getFloor(), 3, 'an invalid link must not corrupt the selected space');
  context.ui.setFloor('all');
  outdoorButton.click();
  assert.equal(context.ui.getFloor(), 'outdoor');
  assert.equal(calls.at(-1)[1], 'outdoor');
  assert.equal(outdoorButton.attributes['aria-pressed'], 'true');
  assert.equal(dryerButton.attributes['aria-pressed'], 'false');
  dryerButton.click();
  assert.equal(context.ui.getFloor(), 'all', 'the whole-building view must also survive an outdoor round trip');
  assert.deepEqual(calls.filter(([method]) => method === 'setFloor').map(([, value]) => value), [7, 3, 'outdoor', 3, 'all', 'outdoor', 'all']);
});

test('shared outdoor position controls move through the scene API and reflect camera progress', async () => {
  const { context, element, calls, sceneOptions, editorMoving } = await sharedViewerHarness();
  assert.equal(element('outdoor-navigation').hidden, false);
  assert.deepEqual(calls.find(([method]) => method === 'setLabels'), ['setLabels', false]);
  element('outdoor-progress').listeners.input({ target: { value: '100' } });
  element('outdoor-back').click();
  element('outdoor-forward').click();
  assert.deepEqual(calls.filter(([method]) => method === 'setOutdoorProgress').map(([, value]) => value), ['100', 45, 55]);
  sceneOptions.onNavigationChange(87.4);
  assert.equal(element('outdoor-progress').value, 87);
  assert.equal(element('move-equipment').disabled, true);
  context.ui.select('outdoor-unit-1');
  assert.equal(element('move-equipment').disabled, false);
  element('move-equipment').click();
  assert.deepEqual(editorMoving, ['outdoor-unit-1']);
  context.ui.setFloor(7);
  assert.equal(element('outdoor-navigation').hidden, true, 'outdoor passage controls must hide in the building');
});

test('local and shared entrance controls use campus navigation and switch cleanly back to the outdoor passage', async () => {
  for (const [factory, url] of [
    [localViewerHarness, 'https://example.invalid/apps/site/index.html'],
    [sharedViewerHarness, 'https://example.invalid/'],
  ]) {
    const { context, element, calls, sceneOptions } = await factory(url);
    assert.equal(context.ui.getFloor(), 'campus');
    assert.equal(element('outdoor-navigation').hidden, false);
    assert.equal(element('outdoor-navigation-label').textContent, '정문 진입');
    assert.equal(element('aisle-view').textContent, '정문');
    assert.match(element('outdoor-progress').attributes['aria-label'], /정문/);
    element('outdoor-progress').listeners.input({ target: { value: '100' } });
    element('outdoor-back').click(); element('outdoor-forward').click();
    assert.deepEqual(calls.filter(([method]) => method === 'setCampusProgress').map(([, progress]) => progress), ['100', 45, 55]);
    assert.equal(calls.filter(([method]) => method === 'setOutdoorProgress').length, 0, 'entrance controls must not move the separate outdoor room');
    sceneOptions.onNavigationChange(87.4);
    assert.equal(element('outdoor-progress').value, 87);

    context.ui.setFloor('outdoor');
    assert.equal(element('outdoor-navigation').hidden, false);
    assert.equal(element('outdoor-navigation-label').textContent, '통로 이동');
    assert.equal(element('aisle-view').textContent, '통로');
    element('outdoor-progress').listeners.input({ target: { value: '25' } });
    assert.deepEqual(calls.filter(([method]) => method === 'setOutdoorProgress').map(([, progress]) => progress), ['25']);
    assert.equal(calls.filter(([method]) => method === 'setCampusProgress').length, 3, 'switching rooms must also switch the navigation destination');
    context.ui.setFloor(7);
    assert.equal(element('outdoor-navigation').hidden, true);
  }
});

test('local and shared campus building and outdoor-area clicks open independent rooms while placement mode keeps their proxies editable', async () => {
  const dryer = CAMPUS_EQUIPMENT.find((item) => item.id === 'campus-dryer-tower');
  const packaging = CAMPUS_EQUIPMENT.find((item) => item.id === 'campus-packaging-building');
  const outdoor = CAMPUS_EQUIPMENT.find((item) => item.id === 'campus-outdoor-area');
  assert.equal(dryer.roomLink, 'all'); assert.equal(packaging.roomLink, PACKAGING_ROOM.id);
  assert.ok(outdoor, 'the outdoor utility row needs its own selectable campus proxy');
  assert.equal(outdoor.floor, 'campus'); assert.equal(outdoor.roomLink, OUTDOOR_ROOM.id);
  assert.equal(OUTDOOR_EQUIPMENT.length, 22, 'the campus proxy must not add a duplicate appliance to the detailed outdoor catalog');
  for (const [factory, base] of [
    [localViewerHarness, 'https://example.invalid/apps/site/index.html'],
    [sharedViewerHarness, 'https://example.invalid/'],
  ]) {
    const viewer = await factory(base);
    const { context, element, calls, scene, sceneOptions } = viewer;
    const select = context.ui.selectEquipment || context.ui.select;
    select(dryer.id);
    assert.equal(context.ui.getFloor(), 'all', 'clicking the seven-floor dryer opens the existing dryer interior');
    assert.equal(element('floor-selector').hidden, false);
    context.ui.setFloor('campus'); select(packaging.id);
    assert.equal(context.ui.getFloor(), 'packaging', 'clicking the orange-roof packaging building opens its separate third-floor room');
    assert.equal(element('floor-selector').hidden, true);
    assert.equal(element('furnace-open').hidden, true);
    assert.equal(element('outdoor-navigation-label').textContent, '층별 통로');
    assert.equal(element('outdoor-navigation').hidden, true, 'the default team overview exposes walking only after choosing one floor');
    assert.ok(calls.some(([method, value]) => method === 'setFloor' && value === 'packaging'));
    context.ui.setPackagingLevel(3);

    context.ui.setFloor('campus'); sceneOptions.onSelect(outdoor.id);
    assert.equal(context.ui.getFloor(), 'outdoor', 'a scene click on the campus utility row opens the existing outdoor room');
    assert.equal(element('outdoor-navigation-label').textContent, '통로 이동');
    assert.equal(context.ui.getPackagingLevel(), 3, 'opening outdoor equipment must preserve the independently selected packaging third floor');
    if (factory === localViewerHarness) {
      assert.equal(Number(element('equipment-count').textContent), 22);
      assert.deepEqual(element('equipment-list').children.filter((node) => !node.hidden).map((node) => node.dataset.equipment),
        OUTDOOR_EQUIPMENT.map((item) => item.id), 'the detail list contains the real 22 groups rather than the campus proxy');
    } else assert.equal(element('area-summary').textContent, `${OUTDOOR_ROOM.name} · 설비 22개`);
    context.ui.setFloor('campus'); select(packaging.id);
    assert.equal(context.ui.getFloor(), 'packaging');
    assert.equal(context.ui.getPackagingLevel(), 3, 'returning through the packaging building restores its third-floor choice');
    assert.equal(element('outdoor-navigation-label').textContent, '3층 통로');

    context.ui.setFloor('campus'); scene.placementMode = true;
    select(packaging.id);
    assert.equal(context.ui.getFloor(), 'campus', 'moving a building must not unexpectedly enter its interior');
    assert.equal(element('move-equipment').disabled, false);
    assert.deepEqual(calls.filter(([method]) => method === 'select').at(-1), ['select', packaging.id]);
    sceneOptions.onSelect(outdoor.id);
    assert.equal(context.ui.getFloor(), 'campus', 'placement mode selects the utility proxy without entering the outdoor room');
    assert.deepEqual(calls.filter(([method]) => method === 'select').at(-1), ['select', outdoor.id]);
    assert.equal(element('move-equipment').disabled, false);
    element('move-equipment').click();
    assert.equal((viewer.moving || viewer.editorMoving).at(-1), outdoor.id, 'the move action keeps the campus proxy as its target');
    assert.equal(context.ui.getFloor(), 'campus');
    scene.placementMode = false;
    sceneOptions.onSelect(outdoor.id);
    assert.equal(context.ui.getFloor(), 'outdoor', 'ordinary utility-row clicks resume outdoor entry after leaving placement mode');
    context.ui.setFloor('campus');
    select(packaging.id);
    assert.equal(context.ui.getFloor(), 'packaging', 'ordinary clicks resume interior entry after leaving placement mode');
    assert.ok(calls.filter(([method]) => method === 'setLabels').every(([, enabled]) => enabled === false), 'entering a room must keep automatic name labels off');
  }
});

test('the packaging third-floor links, area tab and route controls remain separate from dryer floor three', async () => {
  for (const [factory, base] of [
    [localViewerHarness, 'https://example.invalid/apps/site/index.html'],
    [sharedViewerHarness, 'https://example.invalid/'],
  ]) {
    for (const query of ['floor=packaging', `equipment=${encodeURIComponent(PACKAGING_EQUIPMENT[0].id)}`]) {
      const linked = await factory(`${base}?${query}`);
      assert.equal(linked.context.ui.getFloor(), 'packaging', `${query} opens the separate packaging room`);
      assert.equal(linked.sceneOptions.floor, 'packaging');
      assert.equal(linked.element('site-canvas').dataset.ready, 'true');
      assert.equal(linked.element('floor-selector').hidden, true);
    }
    const { context, element, areaButtons, calls, sceneOptions } = await factory(`${base}?floor=3`);
    assert.equal(context.ui.getFloor(), 3, 'the existing numeric third-floor deep link still means dryer floor three');
    const packagingTab = areaButtons.find((button) => button.dataset.area === 'packaging');
    const dryerTab = areaButtons.find((button) => button.dataset.area === 'dryer');
    packagingTab.click();
    assert.equal(context.ui.getFloor(), 'packaging');
    context.ui.setPackagingLevel(3);
    assert.equal(packagingTab.attributes['aria-pressed'], 'true');
    assert.match(element('outdoor-progress').attributes['aria-label'], /스틱·소포장.*3층 통로/);
    assert.equal(element('outdoor-navigation-label').textContent, '3층 통로');
    element('outdoor-progress').listeners.input({ target: { value: '100' } });
    element('outdoor-back').click(); element('outdoor-forward').click();
    assert.deepEqual(calls.filter(([method]) => method === 'setPackagingProgress').map(([, value]) => value), ['100', 45, 55]);
    assert.equal(calls.filter(([method]) => method === 'setCampusProgress' || method === 'setOutdoorProgress').length, 0, 'packaging navigation must not move the other rooms');
    sceneOptions.onNavigationChange(64.6);
    assert.equal(element('outdoor-progress').value, 65);
    if (factory === localViewerHarness) {
      const shown = element('equipment-list').children.filter((button) => !button.hidden).map((button) => button.dataset.equipment);
      assert.deepEqual(shown, PACKAGING_EQUIPMENT.filter((item) => item.floorLevel === 3).map((item) => item.id), 'the packaging list excludes other packaging levels and dryer floor-three equipment');
    } else assert.equal(element('area-summary').textContent, `${PACKAGING_ROOM.name} · 설비 ${PACKAGING_EQUIPMENT.filter((item) => item.floorLevel === 3).length}개`);
    dryerTab.click();
    assert.equal(context.ui.getFloor(), 3, 'returning from packaging restores the selected dryer floor');
    assert.equal(element('floor-selector').hidden, false);
    assert.equal(element('outdoor-navigation').hidden, true);
    context.ui.setFloor('all');
    if (factory === localViewerHarness) assert.equal(element('equipment-list').children.filter((button) => !button.hidden).length, EQUIPMENT.length);
    else assert.equal(element('area-summary').textContent, `건조실 전체 · 설비 ${EQUIPMENT.length}개`);
  }
});

test('local and shared packaging level controls isolate their catalog, support equipment links and keep cargo optional', async () => {
  for (const [factory, base] of [
    [localViewerHarness, 'https://example.invalid/apps/site/index.html'],
    [sharedViewerHarness, 'https://example.invalid/'],
  ]) {
    const view = await factory(`${base}?floor=packaging&level=2`);
    const { context, element, calls, sceneOptions } = view;
    assert.equal(sceneOptions.packagingLevel, 2, 'a room link selects the requested packaging level');
    assert.equal(context.ui.getPackagingLevel(), 2);
    assert.equal(element('packaging-floor-selector').hidden, false);
    assert.equal(element('packaging-floor-selector').children.length, 4);
    assert.equal(element('packaging-cargo-toggle').checked, false);
    for (const level of [1, 3, 2]) {
      const button = element('packaging-floor-selector').children.find((entry) => Number(entry.dataset.packagingLevel) === level);
      button.click();
      assert.equal(context.ui.getPackagingLevel(), level);
      assert.equal(button.attributes['aria-pressed'], 'true');
      assert.ok(calls.some(([method, value]) => method === 'setPackagingLevel' && value === level));
      const catalog = PACKAGING_EQUIPMENT.filter((item) => item.floorLevel === level);
      if (factory === localViewerHarness) {
        const shown = element('equipment-list').children.filter((entry) => !entry.hidden).map((entry) => entry.dataset.equipment);
        assert.deepEqual(shown, catalog.map((item) => item.id), 'a floor selector must hide the other two packaging catalogs');
        assert.equal(element('reference-photo').src, PACKAGING_ROOMS[level].photos.filter(isRetainedEvidenceImage)[0]);
        assert.equal(Number(element('equipment-count').textContent), catalog.length);
      } else assert.equal(element('area-summary').textContent, `${PACKAGING_ROOMS[level].name} · 설비 ${catalog.length}개`);
      assert.equal(element('outdoor-navigation-label').textContent, `${level}층 통로`);
    }
    element('packaging-cargo-toggle').listeners.change({ target: { checked: true } });
    assert.ok(calls.some(([method, value]) => method === 'setPackagingCargoVisible' && value === true));
    context.ui.setFloor('outdoor');
    assert.equal(element('packaging-cargo-option').hidden, true);
    assert.equal(element('packaging-floor-selector').hidden, true);
    const linkedItem = PACKAGING_EQUIPMENT.find((item) => item.floorLevel === 1);
    const linked = await factory(`${base}?floor=packaging&level=3&equipment=${linkedItem.id}`);
    assert.equal(linked.sceneOptions.packagingLevel, 1, 'equipment floor ownership takes priority over a conflicting level parameter');
    assert.equal(linked.context.ui.getPackagingLevel(), 1);
    const secondItem = PACKAGING_EQUIPMENT.find((item) => item.floorLevel === 2);
    if (factory === localViewerHarness) linked.context.ui.selectEquipment(secondItem.id);
    else linked.context.ui.select(secondItem.id);
    assert.equal(linked.context.ui.getPackagingLevel(), 2, 'selecting another floor equipment updates its room before selection');
    assert.ok(linked.calls.some(([method, id]) => method === 'select' && id === secondItem.id));
  }
});

test('the team packaging overview starts with all floors and keeps selection until focusing an owning floor', async () => {
  for (const [factory, base] of [
    [localViewerHarness, 'https://example.invalid/apps/site/index.html'],
    [sharedViewerHarness, 'https://example.invalid/'],
  ]) {
    const view = await factory(`${base}?floor=packaging`), { context, element, sceneOptions } = view;
    assert.equal(context.ui.getPackagingLevel(), 'all');
    assert.equal(sceneOptions.packagingLevel, 'all');
    assert.equal(element('outdoor-navigation').hidden, true);
    assert.equal(element('aisle-view').hidden, true);
    const allButton = element('packaging-floor-selector').children.find((entry) => entry.dataset.packagingLevel === 'all');
    assert.equal(allButton.attributes['aria-pressed'], 'true');
    if (factory === localViewerHarness) {
      assert.equal(Number(element('equipment-count').textContent), PACKAGING_EQUIPMENT.length);
      assert.equal(element('equipment-list').children.filter((entry) => !entry.hidden).length, PACKAGING_EQUIPMENT.length);
    } else assert.equal(element('area-summary').textContent, `${PACKAGING_OVERVIEW.name} · 설비 ${PACKAGING_EQUIPMENT.length}개`);
    const item = PACKAGING_EQUIPMENT.find((entry) => entry.floorLevel === 2);
    if (factory === localViewerHarness) context.ui.selectEquipment(item.id); else context.ui.select(item.id);
    assert.equal(context.ui.getPackagingLevel(), 'all', 'selecting one whole-building assembly must not collapse the stacked overview');
    sceneOptions.onPackagingLevelChange(2);
    assert.equal(context.ui.getPackagingLevel(), 2, 'a scene focus or movement transition updates the visible floor selector and list');
    assert.equal(element('outdoor-navigation').hidden, false);
    assert.equal(element('aisle-view').hidden, false);
    allButton.click();
    assert.equal(context.ui.getPackagingLevel(), 'all');
    const linked = await factory(`${base}?floor=packaging&level=all`);
    assert.equal(linked.sceneOptions.packagingLevel, 'all');
    assert.equal(linked.context.ui.getPackagingLevel(), 'all');
  }
});

test('the burner action is available throughout the dryer while other areas and legacy equipment links keep their own context', async () => {
  const regular = await sharedViewerHarness('https://example.invalid/');
  assert.equal(regular.context.ui.getFloor(), 'campus', 'the company view starts on the campus overview');
  assert.deepEqual(regular.furnaceCalls, [], 'the general map remains available before choosing the furnace');
  regular.context.ui.setFloor('outdoor');
  regular.element('furnace-open').click();
  assert.equal(regular.context.ui.getFloor(), 'outdoor', 'a hidden unavailable control must not jump to the burner');
  assert.deepEqual(regular.furnaceCalls, []);
  regular.context.ui.select('heater');
  assert.equal(regular.element('selection-name').textContent, '6층 · 건조실 버너');
  assert.deepEqual(regular.furnaceCalls, ['open']);
  regular.element('furnace-open').click();
  assert.deepEqual(regular.furnaceCalls, ['open', 'open'], 'selecting the furnace again must reopen its detail');
  for (const [url, parentUrl] of [
    ['https://example.invalid/?floor=7&equipment=heater'],
    ['https://example.invalid/viewers/site.html', 'https://example.invalid/?viewer=site&floor=7&equipment=heater'],
    ['about:srcdoc', 'file:///shared/건조기-통합-공유.html?floor=7&equipment=heater'],
  ]) {
    const viewer = await sharedViewerHarness(url, { parentUrl });
    assert.equal(viewer.context.ui.getFloor(), 6, 'legacy floor=7 heater links resolve to its physical owner without changing its ID');
    assert.deepEqual(viewer.furnaceCalls, ['open'], `${url} must immediately open the requested furnace`);
    assert.equal(viewer.element('site-canvas').dataset.ready, 'true');
  }
});

test('equipment deep links retain the 3D selection after document presentation is removed', async () => {
  for (const url of [
    'https://example.invalid/?equipment=outdoor-ahu',
    'https://example.invalid/?floor=7&equipment=outdoor-ahu',
  ]) {
    const { context, element, calls } = await sharedViewerHarness(url);
    assert.equal(context.ui.getFloor(), 'outdoor');
    assert.match(element('selection-name').textContent, /치어팩 스틱실 공조기/);
    assert.ok(calls.some(([method, id]) => method === 'select' && id === 'outdoor-ahu'));
    assert.equal(element('site-canvas').dataset.ready, 'true');
  }
  for (const equipment of ['outdoor-unit-1', 'outdoor-condensers', 'unknown', '<script>']) {
    const { context, element } = await sharedViewerHarness(`https://example.invalid/?floor=outdoor&equipment=${encodeURIComponent(equipment)}`);
    assert.equal(context.ui.getFloor(), 'outdoor');
    assert.equal(element('site-canvas').dataset.ready, 'true');
  }
  const embedded = await sharedViewerHarness('about:srcdoc', { parentUrl: 'https://example.invalid/?floor=outdoor&equipment=outdoor-ahu' });
  assert.equal(embedded.context.ui.getFloor(), 'outdoor');
  assert.match(embedded.element('selection-name').textContent, /치어팩 스틱실 공조기/);
  assert.equal(embedded.element('site-canvas').dataset.ready, 'true', 'the combined share must inherit the parent link and present its 3D model');
});

test('the chiller opens once from its outdoor control and equipment selection, preserves placement, and follows hosted and offline deep links', async () => {
  for (const [factory, base, selectName] of [
    [localViewerHarness, 'https://example.invalid/apps/site/index.html', 'selectEquipment'],
    [sharedViewerHarness, 'https://example.invalid/apps/site/share/index.html', 'select'],
  ]) {
    const h = await factory(base);
    assert.equal(h.context.ui.getFloor(), 'campus'); assert.deepEqual(h.chillerCalls, []);
    assert.equal(h.element('chiller-open').hidden, true, 'the outdoor detail action should not cover the campus view');
    h.context.ui.setFloor('outdoor');
    assert.equal(h.element('chiller-open').hidden, true, 'the outdoor area alone is not a selected chiller');
    h.element('chiller-open').click();
    assert.deepEqual(h.chillerCalls, [], 'the unavailable action cannot jump or choose an equipment item');
    h.context.ui[selectName]('outdoor-process-chiller');
    assert.equal(h.element('chiller-open').hidden, false);
    assert.deepEqual(h.chillerCalls, ['open'], 'directly selecting the matching chiller opens one existing detail instance');
    assert.ok(h.calls.some(([method, id]) => method === 'select' && id === 'outdoor-process-chiller'));
    h.context.ui[selectName]('outdoor-process-chiller');
    assert.deepEqual(h.chillerCalls, ['open', 'open'], 'selecting the chiller again reopens its existing detail');
    h.scene.placementMode = true;
    h.context.ui[selectName]('outdoor-process-chiller');
    assert.equal(h.chillerCalls.length, 2, 'placement selection must remain in the 3D layout editor');
    h.element('chiller-open').click();
    assert.equal(h.chillerCalls.length, 3, 'the explicit structure action remains available during placement without automatic double opening');
    h.element('move-equipment').click();
    assert.equal((h.moving || h.editorMoving).at(-1), 'outdoor-process-chiller');
    h.scene.placementMode = false;
    h.context.ui[selectName]('outdoor-unit-1');
    assert.equal(h.chillerCalls.length, 3, 'other outdoor equipment cannot open the chiller detail');
    const linked = await factory(`${base}?floor=7&equipment=outdoor-process-chiller`);
    assert.equal(linked.context.ui.getFloor(), 'outdoor'); assert.deepEqual(linked.chillerCalls, ['open']);
    assert.equal(linked.element('site-canvas').dataset.ready, 'true');
  }
  for (const [url, parentUrl] of [
    ['https://example.invalid/viewers/site.html', 'https://example.invalid/?floor=outdoor&equipment=outdoor-process-chiller'],
    ['about:srcdoc', 'file:///shared/factory.html?floor=outdoor&equipment=outdoor-process-chiller'],
  ]) {
    const h = await sharedViewerHarness(url, { parentUrl });
    assert.equal(h.context.ui.getFloor(), 'outdoor'); assert.deepEqual(h.chillerCalls, ['open']);
    assert.equal(h.element('site-canvas').dataset.ready, 'true');
  }
});

test('offline map export includes outdoor models and chiller reference images while keeping original outdoor photo paths outside the artifact', async () => {
  const temporaryRoot = await realpath(tmpdir());
  const directory = await mkdtemp(path.join(temporaryRoot, 'dryer-outdoor-export-'));
  try {
    const output = path.join(directory, 'map.html');
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('../tooling/export-site.mjs', import.meta.url)), output], { encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const html = await readFile(output, 'utf8');
    const embedded = html.match(/^const OUTDOOR_EQUIPMENT = (\[[^\n]+\]);$/m);
    assert.ok(embedded, 'offline export must include the separate room data');
    const equipment = JSON.parse(embedded[1]);
    assert.deepEqual(equipment.map(({ id }) => id), OUTDOOR_EQUIPMENT.map(({ id }) => id));
    for(const original of OUTDOOR_EQUIPMENT.filter(i=>i.historyCardNumber)){
      const bundled=equipment.find(i=>i.id===original.id);
      assert.equal(bundled.historyCardNumber,original.historyCardNumber,'the offline geometry must select the same card-specific form');
      assert.equal(bundled.variant,original.variant);
      assert.deepEqual(bundled.position,original.position);
    }
    assert.ok(equipment.every((item) => item.floor === 'outdoor' && !('photo' in item) && !('photos' in item) && !('photoCaptions' in item)));
    const room = JSON.parse(html.match(/^const OUTDOOR_ROOM = (\{[^\n]+\});$/m)[1]);
    assert.equal('videoPhotos' in room, false, 'local video still paths must not leak through shared room metadata');
    assert.equal('photoCaptions' in room, false, 'local video timestamps and path keys must remain in the original workspace');
    assert.match(html, /buildOutdoorEnvironment/);
    assert.match(html, /createLayoutEditor/);
    assert.match(html, /const placementRulesModule =/);
    assert.match(html, /constrainPlacement/);
    assert.match(html, /getPlacementInfo/);
    assert.match(html, /id="layout-editor"/);
    const embeddedChillerAssets = html.match(/const CHILLER_ASSETS = (\{[^\n]+\});/);
    assert.ok(embeddedChillerAssets, 'the offline detail must carry the retained drawing registry');
    const chillerAssets = JSON.parse(embeddedChillerAssets[1]);
    assert.deepEqual(Object.keys(chillerAssets), Object.keys(CHILLER_ASSETS));
    assert.equal(Object.keys(chillerAssets).length, 24);
    assert.ok(Object.keys(chillerAssets).every(key => !key.startsWith('photo')), 'retired field photographs are not embedded');
    assert.ok(Object.values(chillerAssets).every((asset) => /^data:image\/jpeg;base64,.+/.test(asset)), 'all retained drawings must work without the workspace or a network');
    for (const key of ['sheet014', 'sheet022', 'cutaway', 'dimensions']) {
      const registered = SITE_ASSETS.find(asset => asset.path === CHILLER_ASSETS[key]);
      assert.ok(registered?.sharePath, `${key} needs a registered compact export image`);
      const original = await readFile(new URL(`../apps/site/${registered.sharePath.slice(2)}`, import.meta.url));
      const embedded = Buffer.from(chillerAssets[key].split(',')[1], 'base64');
      assert.equal(createHash('sha256').update(embedded).digest('hex'), createHash('sha256').update(original).digest('hex'), key);
    }
    assert.doesNotMatch(html, /\.\/(?:photos\/chiller-20261110|assets\/drawings\/chiller)\//);
    const officialMark = await readFile(new URL('../apps/site/assets/brand/heechang-official-logo.svg', import.meta.url));
    assert.ok(html.includes(`data:image/svg+xml;base64,${officialMark.toString('base64')}`), 'the official tower mark must remain byte-identical and available in the offline shared model');
    assert.ok(!html.includes('./assets/brand/heechang-official-logo.svg'), 'the shared tower cannot depend on the workspace SVG file');
    assert.doesNotMatch(html, /href="\.\.\/layout-editor\.css"/);
    assert.doesNotMatch(html, /\bimport\s*\(/);
    for (const item of OUTDOOR_EQUIPMENT) assert.ok(!html.includes(item.photo), `source photo leaked: ${item.id}`);
  } finally {
    const resolved = await realpath(directory);
    assert.equal(path.dirname(resolved), temporaryRoot);
    await rm(resolved, { recursive: true, force: true });
  }
});

test('team 3 liquid opens its own full interior from the campus, matching area tab and shared deep links without entering team 2 or moving buildings', async () => {
  const liquid = CAMPUS_EQUIPMENT.find((e) => e.id === 'campus-blue-annex');
  assert.equal(liquid.roomLink, 'liquid');
  for (const [factory, base] of [[localViewerHarness, 'https://example.invalid/apps/site/index.html'], [sharedViewerHarness, 'https://example.invalid/']]) {
    const h = await factory(base), select = h.context.ui.selectEquipment || h.context.ui.select;
    h.element('liquid-open').click(); assert.equal(h.liquidCalls.length, 1);
    select(liquid.id); assert.equal(h.liquidCalls.length, 2); assert.equal(h.context.ui.getFloor(), 'campus');
    h.scene.placementMode = true; select(liquid.id); assert.equal(h.liquidCalls.length, 2);
    assert.deepEqual(h.calls.filter(([m]) => m === 'select').at(-1), ['select', liquid.id]);
    assert.equal(h.element('move-equipment').disabled, false);
    h.scene.placementMode = false; select('campus-packaging-building'); assert.equal(h.context.ui.getFloor(), 'packaging');
    assert.equal(h.liquidCalls.length, 2);
    const linked = await factory(`${base}?floor=liquid&equipment=liquid-card-042`);
    assert.equal(linked.liquidCalls.length, 1); assert.equal(linked.liquidCalls[0].equipmentId, 'liquid-card-042');
  }
  const hosted = await sharedViewerHarness('about:srcdoc', { parentUrl: 'file:///factory.html?floor=liquid&equipment=liquid-card-093' });
  assert.equal(hosted.liquidCalls.length, 1); assert.equal(hosted.liquidCalls[0].equipmentId, 'liquid-card-093');
});

test('liquid is the same fifth-area navigation pattern in local/shared HTML and restores the underlying area indicator on close', async () => {
  for (const file of ['../apps/site/index.html', '../apps/site/share/index.html']) {
    const html = await readFile(new URL(file, import.meta.url), 'utf8');
    assert.deepEqual([...html.matchAll(/<button\b[^>]*\bdata-area="([^"]+)"[^>]*>/g)].map(match => match[1]), ['campus', 'dryer', 'packaging', 'liquid', 'outdoor']);
    assert.equal([...html.matchAll(/\bid="liquid-open"/g)].length, 1, 'the liquid action has one DOM identity');
    const tab = html.match(/<button\b[^>]*id="liquid-open"[^>]*>[\s\S]*?<\/button>/)?.[0];
    assert.match(tab, /data-area="liquid"/); assert.match(tab, /액상/); assert.match(tab, /<small>3팀 실내 설비<\/small>/);
    const actions = html.match(/<div class="detail-open-actions"[^>]*>([\s\S]*?)<\/div>/)?.[1];
    assert.doesNotMatch(actions, /liquid-open|3팀 액상/, 'the separate liquid banner is removed');
    assert.match(html, /<section id="liquid-workspace"[^>]*\bhidden/, 'the same-page liquid host starts hidden');
  }
  for (const [factory, base] of [[localViewerHarness, 'https://example.invalid/apps/site/index.html'], [sharedViewerHarness, 'https://example.invalid/']]) {
    const h = await factory(base), tab = h.areaButtons.find(button => button.dataset.area === 'liquid');
    assert.equal(h.liquidHost, h.element('liquid-workspace'), 'the real app uses inline-host mode rather than a native main dialog');
    const active = () => h.areaButtons.filter(button => button.attributes['aria-pressed'] === 'true').map(button => button.dataset.area);
    for (const floor of ['campus', 7, 'outdoor', 'packaging']) {
      h.context.ui.setFloor(floor); if (floor === 'packaging') h.context.ui.setPackagingLevel(2);
      const opens = h.liquidCalls.length, calls = h.calls.length;
      tab.click();
      assert.equal(h.liquidCalls.length, opens + 1, 'one click opens one viewer');
      assert.equal(h.context.ui.getFloor(), floor, 'the modal tab never sends liquid through the numeric floor parser');
      assert.deepEqual(active(), ['liquid']); assert.equal(h.document.body.dataset.area, 'liquid');
      assert.equal(h.element('liquid-workspace').hidden, false);
      assert.equal(h.element(factory === localViewerHarness ? 'main-workspace' : 'scene-viewport').hidden, true);
      assert.deepEqual(h.calls.filter(([method]) => method === 'setActive').at(-1), ['setActive', false], 'the main 3D scene sleeps while liquid is active');
      assert.ok(h.calls.slice(calls).every(([method]) => method !== 'setFloor'), 'opening the modal does not alter the main 3D room');
      h.closeLiquid();
      const expected = typeof floor === 'number' ? 'dryer' : floor;
      assert.deepEqual(active(), [expected]); assert.equal(h.document.body.dataset.area, expected);
      assert.equal(h.element('liquid-workspace').hidden, true);
      assert.equal(h.element(factory === localViewerHarness ? 'main-workspace' : 'scene-viewport').hidden, false);
      assert.deepEqual(h.calls.filter(([method]) => method === 'setActive').at(-1), ['setActive', true]);
      if (floor === 'packaging') assert.equal(h.context.ui.getPackagingLevel(), 2);
    }
    const linked = await factory(`${base}?floor=liquid&equipment=liquid-card-042`);
    assert.deepEqual(linked.areaButtons.filter(button => button.attributes['aria-pressed'] === 'true').map(button => button.dataset.area), ['liquid']);
    assert.equal(linked.document.body.dataset.area, 'liquid');
    assert.equal(linked.liquidCalls[0].equipmentId, 'liquid-card-042'); linked.closeLiquid();
    assert.equal(linked.document.body.dataset.area, 'campus');
    h.context.ui.setPackagingLevel(2); tab.click();
    h.areaButtons.find(button => button.dataset.area === 'outdoor').click();
    assert.equal(h.context.ui.getFloor(), 'outdoor'); assert.equal(h.element('liquid-workspace').hidden, true);
    h.areaButtons.find(button => button.dataset.area === 'packaging').click();
    assert.equal(h.context.ui.getPackagingLevel(), 2, 'leaving inline liquid keeps the separate packaging-level memory');
  }
});

test('burner drawings open directly on upper dryer floors while chiller details require selection in their own area', async () => {
  for (const [factory, base] of [[localViewerHarness, 'https://example.invalid/apps/site/index.html'], [sharedViewerHarness, 'https://example.invalid/']]) {
    const h = await factory(base), select = h.context.ui.selectEquipment || h.context.ui.select;
    const burner = h.element('furnace-open'), chiller = h.element('chiller-open');
    const unavailable = button => { assert.equal(button.hidden, true); assert.equal(button.disabled, true); };
    unavailable(burner); unavailable(chiller);
    burner.click(); chiller.click(); assert.equal(h.context.ui.getFloor(), 'campus');
    assert.deepEqual(h.furnaceCalls, []); assert.deepEqual(h.chillerCalls, []);
    h.context.ui.setFloor(7);
    assert.equal(burner.hidden, false, 'entering 7F exposes drawings before selecting the burner');
    assert.equal(burner.disabled, false);
    burner.click();
    assert.equal(h.furnaceCalls.filter(value => value === 'open').length, 1);
    h.context.ui.setFloor(6); assert.equal(burner.hidden, false); select('heater');
    assert.equal(burner.hidden, false); assert.equal(burner.disabled, false);
    const first = h.furnaceCalls.filter(value => value === 'open').length;
    for (const floor of ['all', 1, 3, 6, 7, 8]) { h.context.ui.setFloor(floor, {overview:false}); assert.equal(burner.disabled, false); assert.equal(burner.hidden, false); }
    h.context.ui.setFloor('campus', {overview:false}); unavailable(burner); burner.click();
    assert.equal(h.context.ui.getFloor(), 'campus'); assert.equal(h.furnaceCalls.filter(value => value === 'open').length, first);
    h.context.ui.setFloor(6, {overview:false}); h.element('liquid-open').click(); unavailable(burner); unavailable(chiller);
    burner.click(); chiller.click(); assert.equal(h.furnaceCalls.filter(value => value === 'open').length, first);
    h.closeLiquid(); assert.equal(burner.disabled, false);
    h.context.ui.setFloor('outdoor'); unavailable(chiller); chiller.click();
    const previousChiller = h.chillerCalls.filter(value => value === 'open').length;
    select('outdoor-process-chiller'); assert.equal(chiller.hidden, false); assert.equal(chiller.disabled, false);
    assert.equal(h.chillerCalls.filter(value => value === 'open').length, previousChiller + 1);
    chiller.click(); assert.equal(h.chillerCalls.filter(value => value === 'open').length, previousChiller + 2);
    select('outdoor-unit-1'); unavailable(chiller);
    h.context.ui.setFloor('packaging'); unavailable(burner); unavailable(chiller);
  }
});

test('inline liquid keeps R and Escape from resetting or clearing the hidden main scene and restores those shortcuts after leaving', async () => {
  for (const factory of [localViewerHarness, sharedViewerHarness]) {
    const h = await factory(), select = h.context.ui.selectEquipment || h.context.ui.select;
    select('outdoor-unit-1');
    h.element('liquid-open').click();
    const before = h.calls.length;
    const key = value => h.documentListeners.keydown({ key: value, target: { matches: () => false }, preventDefault() {} });
    key('r'); key('Escape');
    assert.equal(h.calls.length, before, 'liquid keyboard input cannot alter the sleeping main viewer');
    h.closeLiquid();
    key('r');
    assert.deepEqual(h.calls.filter(([method]) => method === 'resetView').at(-1), ['resetView']);
    key('Escape');
    assert.deepEqual(h.calls.filter(([method]) => method === 'select').at(-1), ['select', null]);
  }
});


test('the reviewed dryer catalog preserves seven source identities and all original photos while replacing three duplicate approximations', async () => {
  const sourceIds = ['chamber', 'blower', 'heater', 'cyclone-1', 'cyclone-2', 'cyclone-3', 'panel'];
  assert.deepEqual(SOURCE_PHOTO_EQUIPMENT.map(({ id }) => id), sourceIds);
  assert.equal(EQUIPMENT.length, 47, 'the active catalog adds nine filmed preparation assemblies to the 38 registered groups');
  assert.equal(new Set(EQUIPMENT.map(({ id }) => id)).size, 47);
  for (const id of ['f6-dryer-shell', 'f6-cyclone-bank', 'f6-exhaust-riser']) {
    assert.equal(EQUIPMENT.some((item) => item.id === id), false, `${id} must not duplicate the photo-backed hall equipment`);
  }
  for (const original of SOURCE_PHOTO_EQUIPMENT) {
    const item = EQUIPMENT.find(({ id }) => id === original.id);
    assert.ok(item, original.id);
    assert.equal(item.floor, 6, `${item.id} retains its identity with the corrected physical floor`);
    assert.deepEqual(item.visibleFloors, [6, 7]);
    assert.equal(item.type, original.type);
    assert.deepEqual(item.parts, original.parts);
    assert.equal(item.photo, original.photo, `${item.id} keeps its original primary photo`);
    for (const photo of original.photos) assert.ok(item.photos.includes(photo), `${item.id} retains ${photo}`);
  }
  const sourceData = await readFile(new URL('../apps/site/data.js', import.meta.url));
  assert.equal(createHash('sha256').update(sourceData).digest('hex'), 'aa08f3ded39d0f0341e671c2c139db606eb1db8021a698893e8fee4bf5b2d917', 'reclassification must leave the source-photo records byte-identical');
  const originals = [...new Set(SOURCE_PHOTO_EQUIPMENT.flatMap((item) => [item.photo, ...item.photos]))].sort();
  assert.equal(originals.length, 20);
  assert.deepEqual(originals.filter(isRetainedEvidenceImage), [], 'the preserved source records cannot reactivate retired field photos');
  const roof = floorById(8);
  assert.equal(roof.kind, 'roof');
  assert.equal(roof.elevation, 32.6);
  assert.equal(roof.elevation, floorById(7).elevation, 'the exterior service bay is not a newly stacked eighth story');
  assert.match(roof.name, /옥상/); assert.doesNotMatch(roof.name, /8층/);
  const roofIds = ['dryer-roof-water-tank', 'dryer-roof-cylindrical-shell', 'dryer-roof-drive'];
  assert.deepEqual(EQUIPMENT.filter(({ floor }) => floor === 8).map(({ id }) => id), roofIds);
  for (const id of roofIds) assert.deepEqual(EQUIPMENT.find((item) => item.id === id).visibleFloors, [7, 8]);
  assert.equal(EQUIPMENT.find(({ id }) => id === 'dryer-chamber-upper-well').floor, 7);
});

test('local and shared dryer controls distinguish the lower hall, upper observation floor and roof service bay', async () => {
  const originalIds = SOURCE_PHOTO_EQUIPMENT.map(({ id }) => id);
  for (const [factory, base, selectName] of [
    [localViewerHarness, 'https://example.invalid/apps/site/index.html', 'selectEquipment'],
    [sharedViewerHarness, 'https://example.invalid/apps/site/share/index.html', 'select'],
  ]) {
    const h = await factory(`${base}?floor=6`);
    if (h.errors) assert.deepEqual(h.errors, []);
    assert.equal(h.sceneOptions.floor, 6);
    const shownIds = () => h.element('equipment-list').children.filter((node) => !node.hidden).map((node) => node.dataset.equipment);
    const countOn = (floor) => EQUIPMENT.filter((item) => item.floor === floor || item.visibleFloors?.includes(floor)).length;
    assert.equal(countOn(6), 8); assert.equal(countOn(7), 13); assert.equal(countOn(8), 3);
    const expectCount = (floor) => {
      if (factory === localViewerHarness) assert.equal(Number(h.element('equipment-count').textContent), countOn(floor));
      else assert.match(h.element('area-summary').textContent, new RegExp(`설비 ${countOn(floor)}개$`));
    };
    expectCount(6);
    if (factory === localViewerHarness) for (const id of originalIds) assert.ok(shownIds().includes(id));
    h.context.ui.setFloor(7); expectCount(7);
    if (factory === localViewerHarness) {
      for (const id of [...originalIds, 'dryer-chamber-upper-well', 'dryer-upper-duct-run', 'dryer-upper-tapered-housing', 'dryer-roof-water-tank', 'dryer-roof-cylindrical-shell', 'dryer-roof-drive']) assert.ok(shownIds().includes(id));
    }
    h.context.ui[selectName]('chamber');
    assert.equal(h.context.ui.getFloor(), 7, 'selecting a hall object visible from 7F must keep the current upper-floor context');
    h.context.ui[selectName]('dryer-roof-water-tank');
    assert.equal(h.context.ui.getFloor(), 7, 'service-bay equipment is also present on the 7F context');
    h.context.ui.setFloor(8); expectCount(8);
    assert.equal(h.context.ui.getFloor(), 8);
    const roofButton = h.element('floor-selector').children.find((button) => button.dataset.floor === '8');
    assert.equal(roofButton.textContent, '옥상');
    const headings = factory === localViewerHarness
      ? ['scene-heading', 'overview-name', 'detail-name'] : ['area-summary'];
    for (const id of headings) { assert.match(h.element(id).textContent, /옥상/); assert.doesNotMatch(h.element(id).textContent, /8층/); }
    if (factory === localViewerHarness) assert.deepEqual(shownIds(), ['dryer-roof-water-tank', 'dryer-roof-cylindrical-shell', 'dryer-roof-drive']);
    for (const area of ['campus', 'outdoor']) h.areaButtons.find((button) => button.dataset.area === area).click();
    h.areaButtons.find((button) => button.dataset.area === 'dryer').click();
    assert.equal(h.context.ui.getFloor(), 8, 'returning from another area must restore the roof selector without inventing an eighth story');
    h.context.ui.setFloor('all');
    if (factory === localViewerHarness) assert.equal(shownIds().length, 47);
    else assert.match(h.element('area-summary').textContent, /설비 47개$/);
  }
});

test('numeric and roof-alias links preserve the service selector in local, hosted and offline viewers', async () => {
  for (const [factory, base] of [
    [localViewerHarness, 'https://example.invalid/apps/site/index.html'],
    [sharedViewerHarness, 'https://example.invalid/apps/site/share/index.html'],
  ]) {
    for (const value of ['8', 'roof']) {
      const h = await factory(`${base}?floor=${value}`);
      assert.equal(h.context.ui.getFloor(), 8, `${value} opens the same service bay`);
      assert.equal(h.sceneOptions.floor, 8);
      assert.equal(h.element('site-canvas').dataset.ready, 'true');
    }
    const oldHeater = await factory(`${base}?floor=7&equipment=heater`);
    assert.equal(oldHeater.context.ui.getFloor(), 6, 'legacy heater links migrate to the physical hall floor');
    const tank = await factory(`${base}?floor=6&equipment=dryer-roof-water-tank`);
    assert.equal(tank.context.ui.getFloor(), 8, 'a direct equipment link uses its primary floor');
  }
  for (const [url, parentUrl] of [
    ['https://example.invalid/viewers/site.html', 'https://example.invalid/?viewer=site&floor=roof'],
    ['about:srcdoc', 'file:///shared/factory.html?floor=roof'],
  ]) {
    const h = await sharedViewerHarness(url, { parentUrl });
    assert.equal(h.context.ui.getFloor(), 8);
    assert.equal(h.sceneOptions.floor, 8);
    assert.equal(h.element('site-canvas').dataset.ready, 'true');
  }
});

test('retired upper-photo actions remain hidden and disabled on all floors while model selection continues to work', async () => {
  for (const [factory, base] of [
    [localViewerHarness, 'https://example.invalid/apps/site/index.html'],
    [sharedViewerHarness, 'https://example.invalid/apps/site/share/index.html'],
  ]) {
    const h = await factory(base);
    assert.deepEqual(h.upperReferenceCalls, []);
    for (const floor of ['campus', 6, 7, 8, 'packaging']) {
      h.context.ui.setFloor(floor);
      assert.equal(h.element('upper-photos-open').hidden, true);
      assert.equal(h.element('upper-photos-open').disabled, true);
      if (typeof floor === 'number') {
        h.context.ui[factory === localViewerHarness ? 'selectEquipment' : 'select'](floor === 8 ? 'dryer-roof-water-tank' : 'chamber');
        assert.equal(h.context.ui.getFloor(), floor);
      }
    }
    assert.deepEqual(h.upperReferenceCalls, [], 'ordinary navigation must never reopen the retired gallery');
  }
});

test('preparation lower-view and boiler buttons preserve floor1 context while campus keeps its own boiler inspection', async () => {
  for (const [factory, base] of [[localViewerHarness, 'https://example.invalid/apps/site/index.html'], [sharedViewerHarness, 'https://example.invalid/apps/site/share/index.html']]) {
    const h = await factory(base), boiler = h.element('boiler-open'), lower = h.element('preparation-lower-open');
    if (h.errors) assert.deepEqual(h.errors, []);
    assert.equal(h.context.ui.getFloor(), 'campus');
    assert.equal(boiler.hidden, false); assert.equal(lower.hidden, true);
    boiler.click();
    assert.equal(h.context.ui.getFloor(), 'campus');
    assert.deepEqual(h.calls.filter(([method]) => method === 'select').at(-1), ['select', 'campus-boiler-room']);
    assert.deepEqual(h.calls.filter(([method]) => method === 'focus').at(-1), ['focus', 'campus-boiler-room']);

    h.context.ui.setFloor(1);
    assert.equal(boiler.hidden, false); assert.equal(lower.hidden, false);
    h.element('isolation-toggle').checked = true;
    h.element('explosion-input').value = 80;
    const previous = h.calls.length;
    lower.click();
    const changes = h.calls.slice(previous);
    assert.deepEqual(changes[0], ['stopMoving'], 'the lower-view action cancels placement before navigation');
    assert.equal(h.context.ui.getFloor(), 1);
    assert.deepEqual(changes.filter(([method]) => method === 'select').at(-1), ['select', 'f1-mix-b']);
    assert.deepEqual(changes.at(-1), ['showPreparationLowerView'], 'the button must invoke the dedicated lower camera after selecting its tank');
    assert.equal(changes.filter(([method]) => method === 'showPreparationLowerView').length, 1);
    assert.equal(h.element('isolation-toggle').checked, false);
    assert.equal(h.element('explosion-output').textContent, '0%');

    boiler.click();
    assert.equal(h.context.ui.getFloor(), 1, 'the preparation boiler action must not jump to the campus view');
    assert.deepEqual(h.calls.filter(([method]) => method === 'select').at(-1), ['select', 'f1-boiler-room']);
    assert.deepEqual(h.calls.filter(([method]) => method === 'focus').at(-1), ['focus', 'f1-boiler-room']);
    h.context.ui.setFloor('all');
    assert.equal(boiler.hidden, false); assert.equal(lower.hidden, true);
    boiler.click();
    assert.equal(h.context.ui.getFloor(), 1);
    assert.deepEqual(h.calls.filter(([method]) => method === 'select').at(-1), ['select', 'f1-boiler-room']);
    h.element('liquid-open').click();
    assert.equal(boiler.hidden, true); assert.equal(lower.hidden, true);
    h.closeLiquid();
    assert.equal(boiler.hidden, false); assert.equal(lower.hidden, false);
    h.context.ui.setFloor('outdoor');
    assert.equal(boiler.hidden, true); assert.equal(lower.hidden, true);

    const linked = await factory(`${base}?floor=1&equipment=f1-boiler-room`);
    assert.equal(linked.context.ui.getFloor(), 1);
    assert.equal(linked.element('site-canvas').dataset.ready, 'true');
    assert.deepEqual(linked.calls.filter(([method]) => method === 'select').at(-1), ['select', 'f1-boiler-room']);
  }
});
