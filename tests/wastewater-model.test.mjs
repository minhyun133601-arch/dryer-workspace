import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from '../apps/shared/vendor/three.module.js';
import { CAMPUS_EQUIPMENT, CAMPUS_ROOM } from '../apps/site/campus-data.js';
import { buildCampusWastewater } from '../apps/site/wastewater-models.js';
import { buildCampusEnvironment } from '../apps/site/campus-models.js';
import { WASTEWATER_DRAWING, WASTEWATER_LAYOUT, WASTEWATER_PROCESS, WASTEWATER_SLUDGE_PROCESS } from '../apps/site/wastewater-data.js';

const id = 'campus-wastewater-treatment';

function harness() {
  const s = {
    geometries: new Set(), materials: new Set(), textures: new Set(), parts: [],
    _material(color, roughness = .7, metalness = .1, extra = {}) {
      const material = new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
      this.materials.add(material); return material;
    },
    _group(parent, position = [0, 0, 0]) {
      const group = new THREE.Group(); group.position.set(...position); parent.add(group); return group;
    },
    _mesh(geometry, material, parent, position = [0, 0, 0]) {
      this.geometries.add(geometry);
      const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...position); parent.add(mesh); return mesh;
    },
    _box(parent, size, position, material) { return this._mesh(new THREE.BoxGeometry(...size), material, parent, position); },
    _cyl(parent, radius, height, position, material, bottom = radius, segments = 24) {
      return this._mesh(new THREE.CylinderGeometry(radius, bottom, height, segments), material, parent, position);
    },
    _part(root, name, offset, position = [0, 0, 0]) {
      const group = this._group(root, position); this.parts.push({ root, group, name, offset }); return group;
    },
  };
  return {
    s, root: new THREE.Group(),
    dispose() { for (const values of [s.geometries, s.materials, s.textures]) values.forEach(value => value.dispose()); },
  };
}

async function visibilityHarness(s, root, item) {
  const source = (await readFile(new URL('../apps/site/scene.js', import.meta.url), 'utf8'))
    .replace(/^import .*;\r?\n/gm, '').replace(/^export\s+(?=(?:function|class|const|let)\b)/gm, '');
  const context = vm.createContext({ THREE, CAMPUS_ROOM, setTimeout, clearTimeout });
  new vm.Script(`${source}\nglobalThis.FacilityScene = FacilityScene;`).runInContext(context);
  const scene = Object.create(context.FacilityScene.prototype), world = new THREE.Group();
  world.add(root);
  Object.assign(scene, {
    scene: world, equipment: [item], objects: new Map([[id, root]]),
    activeFloor: 'campus', selected: null, amount: 0, explosion: 0, isolated: false,
    parts: s.parts, locationDisks: new Map(), floorDecks: new Map(), floorStructures: new Map(),
    packagingEnvironments: new Map(), survey: new THREE.Group(),
    selectionRing: { visible: false, position: new THREE.Vector3(), scale: new THREE.Vector3() },
    _applyPackagingDisplayOffsets() {}, _packagingDisplayOffset() { return 0; },
    _updatePersonCamera() {}, _invalidate() {}, _moveParts() {}, _placementGuide() {},
  });
  return scene;
}

test('the wastewater model occupies the requested old-building-10 area beside the guardhouse and preserves the entrance lane', () => {
  const { s, root, dispose } = harness();
  try {
    const item = CAMPUS_EQUIPMENT.find(entry => entry.id === id);
    assert.ok(item, 'the wastewater treatment plant must be available in the campus catalog');
    assert.equal(item.placementBasis.requestedBuilding, '기존 10동');
    assert.deepEqual(item.placementBasis.drawingAnchor, [25, 0, 57]);
    assert.equal(item.inspectableInterior, true);
    const original = structuredClone(item);
    assert.equal(buildCampusWastewater(s, root, item), true);
    assert.deepEqual(item, original, 'model construction must preserve catalog coordinates and evidence');
    root.position.set(...item.position); root.rotation.y = item.rotation; root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(root);
    assert.ok([...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite));
    const guard = CAMPUS_EQUIPMENT.find(entry => entry.id === 'campus-guardhouse');
    assert.ok(bounds.max.x < guard.position[0] - guard.width / 2, 'the new plant leaves the existing guardhouse in its place');
    const { laneX, laneWidth } = CAMPUS_ROOM.layout.entrance;
    assert.ok(bounds.max.x < laneX - laneWidth / 2, 'all structures leave the straight entrance lane open');
    assert.ok(bounds.max.z <= 62 && bounds.min.z > 31.5, 'the plant fits between the retained front-yard parcel edge and logistics building');
    assert.ok(bounds.min.y < -4.9 && bounds.max.y < 8, 'five-metre underground basins stay below ground while the upper structures remain low');
    root.traverse(node => {
      if (node.geometry) assert.ok(s.geometries.has(node.geometry), 'every geometry participates in scene disposal');
    });
    const empty = new THREE.Group();
    assert.equal(buildCampusWastewater(s, empty, { type: 'campus-guardhouse' }), false);
    assert.equal(empty.children.length, 0, 'unrelated campus builders must receive an unchanged root');
  } finally { dispose(); }
});

test('four underground aeration basins preserve the old and added drawing volumes and five-metre floors', () => {
  const { s, root, dispose } = harness();
  try {
    const item = CAMPUS_EQUIPMENT.find(entry => entry.id === id);
    buildCampusWastewater(s, root, item);
    assert.equal(WASTEWATER_DRAWING.capacityCubicMetresPerDay, 200);
    const tanks = [];
    root.traverse(node => { if (/^aeration-[1-4]$/.test(node.userData.processUnit || '')) tanks.push(node); });
    assert.deepEqual(tanks.map(node => node.userData.processUnit).sort(), ['aeration-1', 'aeration-2', 'aeration-3', 'aeration-4']);
    const data = [...WASTEWATER_LAYOUT.existingAeration, ...WASTEWATER_LAYOUT.extensionAeration];
    for (const tank of tanks) {
      const entry = data.find(value => `aeration-${value.id}` === tank.userData.processUnit);
      assert.equal(tank.userData.underground, true);
      assert.equal(tank.userData.effectiveDepth, 5);
      assert.equal(tank.userData.drawingVolumeCubicMetres, entry.id === '1' || entry.id === '2' ? 187.5 : 245);
      tank.updateWorldMatrix(true, true);
      const floor = tank.getObjectByName('wastewater-tank-floor');
      const floorBounds = new THREE.Box3().setFromObject(floor);
      assert.ok(Math.abs(floorBounds.max.y + 5) < 1e-6, `${tank.name} must reach the drawing depth below ground, rather than drawing a shallow surface pool`);
      assert.ok(floorBounds.min.x < tank.position.x - entry.width / 2 && floorBounds.max.x > tank.position.x + entry.width / 2);
      if (entry.id === '3' || entry.id === '4') {
        assert.equal(entry.width, 7); assert.equal(entry.depth, 7);
        assert.equal(entry.width * entry.depth * -entry.floor, 245);
      }
    }
    assert.equal(root.getObjectByName('wastewater-extension-14900mm').userData.drawingOuterWidthMetres, 14.9);
    const equalization = root.getObjectByName('wastewater-equalization');
    const clarifier = root.getObjectByName('wastewater-clarifier');
    assert.equal(equalization.userData.drawingVolumeCubicMetres, 102);
    assert.equal(clarifier.userData.drawingVolumeCubicMetres, 63);
    const equalizationBounds = new THREE.Box3().setFromObject(equalization);
    const clarifierBounds = new THREE.Box3().setFromObject(clarifier);
    assert.ok(equalizationBounds.max.y < clarifierBounds.max.y && equalizationBounds.min.y < -5, 'the section drawing places the equalization basin below the elevated clarifier');
    assert.equal(equalization.position.x, clarifier.position.x); assert.equal(equalization.position.z, clarifier.position.z);
    assert.deepEqual(WASTEWATER_PROCESS.map(value => value.next), WASTEWATER_PROCESS.slice(1).map(value => value.id).concat(null));
    assert.deepEqual(WASTEWATER_SLUDGE_PROCESS, ['침전조', '슬러지저류조', '슬러지개량조', '휠타프레스', '케익배출']);
  } finally { dispose(); }
});

test('selecting and closing the treatment plant reveals all deep basins without removing their permanent tank geometry', async () => {
  const { s, root, dispose } = harness();
  try {
    const item = CAMPUS_EQUIPMENT.find(entry => entry.id === id);
    buildCampusWastewater(s, root, item);
    const scene = await visibilityHarness(s, root, item);
    const covers = [], floors = [];
    root.traverse(node => {
      if (node.userData.campusInteriorCover) covers.push(node);
      if (node.name === 'wastewater-tank-floor') floors.push(node);
    });
    assert.ok(covers.length >= 3, 'the ground hatches and the upper shelters must be removable inspection covers');
    assert.ok(floors.length >= 4);
    assert.ok(covers.every(node => node.visible));
    root.updateMatrixWorld(true);
    const originalMatrices = floors.map(node => node.matrix.clone());
    const assertFloorsVisible = () => {
      const visible = new Set(); root.traverseVisible(node => visible.add(node));
      assert.ok(floors.every((node, index) => visible.has(node) && node.matrix.equals(originalMatrices[index])), 'inspection must preserve all permanent underground slabs');
    };
    scene.select(id);
    assert.equal(scene.campusInteriorEnabled, true);
    assert.ok(covers.every(node => !node.visible)); assertFloorsVisible();
    assert.equal(scene.setCampusInterior(false), false);
    assert.ok(covers.every(node => node.visible));
    assert.equal(scene.setCampusInterior(true), true); assertFloorsVisible();
    scene.select(null);
    assert.equal(scene.campusInteriorEnabled, false);
    assert.ok(covers.every(node => node.visible));
  } finally { dispose(); }
});

test('the campus yard has a real opening for underground tanks and follows a moved plant without leaving an old hole', () => {
  const { s, dispose } = harness();
  try {
    const item = structuredClone(CAMPUS_EQUIPMENT.find(entry => entry.id === id));
    s.scene = new THREE.Group(); s.equipment = [item];
    const { deck } = buildCampusEnvironment(s);
    const context = deck.getObjectByName('campus-context-ground');
    const paving = deck.getObjectByName('campus-factory-parcel-paving');
    const groundHit = (x, z) => {
      s.scene.updateMatrixWorld(true);
      return new THREE.Raycaster(new THREE.Vector3(x, 1, z), new THREE.Vector3(0, -1, 0), 0, 8).intersectObjects([context, paving], true);
    };
    assert.equal(groundHit(item.position[0], item.position[2]).length, 0, 'neither the paving nor the thick ground slab may fill the underground cutaway');
    assert.ok(groundHit(item.position[0] - 30, item.position[2]).length > 0, 'the adjacent yard retains physical ground');
    const oldPosition = [...item.position];
    item.position[0] -= 45;
    deck.userData.updateSubsurfaceCutout();
    assert.equal(groundHit(item.position[0], item.position[2]).length, 0, 'the excavation follows the edited footprint');
    assert.ok(groundHit(oldPosition[0], oldPosition[2]).length > 0, 'the former excavation closes after a layout edit');
    item.position[2] = 60; item.rotation = Math.PI / 10;
    deck.userData.updateSubsurfaceCutout();
    assert.ok(deck.userData.subsurfaceCutout.some(([, z]) => z > 62), 'the rotated test footprint must cross the front parcel boundary');
    assert.equal(groundHit(item.position[0], 57).length, 0, 'partial parcel overlap must still cut away the paving above the underground tanks');
    assert.ok(groundHit(item.position[0] + 30, 57).length > 0, 'the adjacent parcel keeps its ground when a rotated excavation crosses the boundary');
  } finally { dispose(); }
});
