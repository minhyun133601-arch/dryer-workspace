import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../apps/shared/vendor/three.module.js';
import { EQUIPMENT } from '../apps/site/building-data.js';
import { buildDryerProcessEquipment } from '../apps/site/dryer-process-models.js';
import { validateLayout } from '../apps/site/layout-editor.js';

const ids = ['f3-sterilizer', 'f3-homogenizer', 'f3-balance-tank', 'f3-feed-tank', 'f3-holding'];
const observed = EQUIPMENT.filter(item => ids.includes(item.id));
function harness() {
  const base = new THREE.MeshStandardMaterial(), s = {
    scene: new THREE.Group(), equipment: observed, parts: [], geometries: new Set(), materials: new Set([base]),
    mat: new Proxy({}, { get: () => base }),
    _material(color, roughness, metalness, extra = {}) { const material = new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra }); this.materials.add(material); return material; },
    _group(parent, position = [0, 0, 0]) { const group = new THREE.Group(); group.position.set(...position); parent.add(group); return group; },
    _mesh(geometry, material, parent, position = [0, 0, 0]) { this.geometries.add(geometry); const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...position); parent.add(mesh); return mesh; },
    _part(parent, name) { const group = this._group(parent); this.parts.push({ name, group }); return group; },
  }, roots = new Map();
  for (const item of observed) {
    const root = s._group(s.scene, item.position); root.rotation.y = item.rotation || 0;
    assert.equal(buildDryerProcessEquipment(s, root, item), true); roots.set(item.id, root);
  }
  s.scene.updateMatrixWorld(true);
  return { s, roots, dispose() { for (const resources of [s.geometries, s.materials]) for (const resource of resources) resource.dispose(); } };
}
function named(root, name) { const nodes = []; root.traverse(node => { if (node.name === `dryer-process-${name}`) nodes.push(node); }); return nodes; }
const down = (root, x, z, y = 15) => new THREE.Raycaster(new THREE.Vector3(x, y, z), new THREE.Vector3(0, -1, 0), 0, 20).intersectObject(root, true);

test('the same five 3F identities use video-observed shapes without asserting historical equipment or OEM matches', () => {
  assert.equal(observed.length, 5); assert.deepEqual(observed.map(item => item.id).sort(), [...ids].sort());
  const h = harness();
  try {
    for (const item of observed) {
      assert.equal(item.floor, 3);
      assert.equal(item.dryerRoute.source, 'dryer-entrance-mezzanine-video-20261112');
      assert.equal(item.dryerRoute.currentOemOrHistoricalIdentityConfirmed, false);
      assert.equal(item.dryerRoute.nominalDimensionsMeasured, false);
      assert.ok(item.dryerRoute.sourceTimes.length >= 3);
      assert.equal(h.roots.get(item.id).userData.observedRouteEquipment.kind, item.dryerRoute.kind);
      assert.ok(!item.details.some(text => /CCP-1B|1·2차 압력/.test(text)), 'old process-screen values cannot identify the current observed machine');
    }
    assert.equal(named(h.roots.get('f3-sterilizer'), 'observed-green-vertical-pump-motor').length, 1);
    assert.equal(named(h.roots.get('f3-homogenizer'), 'observed-stainless-control-cabinet').length, 1);
    assert.equal(named(h.roots.get('f3-balance-tank'), 'observed-standalone-cylinder').length, 1);
  } finally { h.dispose(); }
});

test('the two observed conical hoppers share a pierced yellow-rail deck, two motor housings and three covered troughs', () => {
  const h = harness();
  try {
    const item = observed.find(item => item.id === 'f3-holding'), root = h.roots.get(item.id);
    assert.equal(named(root, 'observed-conical-hopper').length, 2);
    assert.equal(named(root, 'observed-vertical-motor-housing').length, 2);
    assert.equal(named(root, 'observed-covered-transfer-trough').length, 3);
    const decks = named(root, 'observed-hopper-common-platform'); assert.equal(decks.length, 1);
    for (const z of [-1.4, 1.4]) assert.equal(down(decks[0], item.position[0], item.position[2] + z).length, 0, 'the hopper axis remains an actual deck opening');
    assert.ok(down(decks[0], item.position[0] + 1.3, item.position[2]).length > 0, 'the adjacent service strip remains solid');
    const stair = named(root, 'observed-service-stair'); assert.equal(stair.length, 1);
    assert.equal(stair[0].userData.buildingFloorAdded, false);
    const landing = new THREE.Box3().setFromObject(named(root, 'observed-hopper-stair-landing')[0]);
    const treads = named(stair[0], 'observed-service-stair-tread');
    const last = new THREE.Box3().setFromObject(treads.at(-1));
    assert.ok(Math.abs(last.max.y - landing.max.y) < 1e-5 && last.intersectsBox(landing), 'the final tread meets the supported service landing');
  } finally { h.dispose(); }
});

test('the observed CIP tops hang through a real service deck and retain open manholes and a connected access stair', () => {
  const h = harness();
  try {
    const item = observed.find(item => item.id === 'f3-feed-tank'), root = h.roots.get(item.id);
    assert.equal(named(root, 'observed-cip-tank').length, 2);
    assert.equal(root.userData.entireCipTankCountConfirmed, false);
    assert.deepEqual(root.userData.readableObservedTankLabels, ['CIP탱크(산)']);
    const platform = named(root, 'observed-cip-pierced-platform')[0];
    for (const z of [-1.15, 1.15]) {
      assert.equal(down(platform, item.position[0], item.position[2] + z).length, 0, 'the tank body passes through the deck');
      const hits = down(root, item.position[0] + .33, item.position[2] + z + .25);
      assert.ok(hits.length && hits[0].point.y < item.position[1] + 1, 'the open manhole reveals the vessel interior rather than a hidden solid top');
    }
    assert.ok(down(platform, item.position[0] + 1.2, item.position[2]).length > 0);
    assert.equal(named(root, 'observed-cip-hanging-lug').length, 4);
    for (const tank of named(root, 'observed-cip-tank')) assert.equal(named(tank, 'support-leg').length, 0, 'the bodies are hung in the platform instead of planted on legs above it');
    const landing = new THREE.Box3().setFromObject(named(root, 'observed-cip-stair-landing')[0]);
    const treads = named(root, 'observed-service-stair-tread');
    const last = new THREE.Box3().setFromObject(treads.at(-1));
    assert.ok(Math.abs(last.max.y - landing.max.y) < 1e-5 && last.intersectsBox(landing));
  } finally { h.dispose(); }
});

test('all observed assemblies fit the reduced tower and leave a continuous central passage', () => {
  const h = harness();
  try {
    const passage = new THREE.Box3(new THREE.Vector3(.8, 7.45, -5.1), new THREE.Vector3(2, 9.1, 10.5));
    const boxes = [];
    for (const [id, root] of h.roots) {
      const box = new THREE.Box3().setFromObject(root); boxes.push({ id, box });
      assert.ok(box.min.x >= -8.5 && box.max.x <= 8.5 && box.min.z >= -13.3 && box.max.z <= 13.3, `${id} remains in the smaller third-floor tower`);
      assert.ok(box.min.y >= 7.3 - 1e-5 && box.max.y <= 13.3 + 1e-5, `${id} stays between third and fourth floor datums`);
      assert.equal(box.intersectsBox(passage), false, `${id} leaves the central person route clear`);
      root.traverse(mesh => { if (mesh.isMesh) { assert.ok(h.s.geometries.has(mesh.geometry)); assert.ok(h.s.materials.has(mesh.material)); } });
    }
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) assert.equal(boxes[i].box.intersectsBox(boxes[j].box), false, `${boxes[i].id} and ${boxes[j].id} do not occupy the same equipment envelope`);
  } finally { h.dispose(); }
});

test('the exact old drive-frame default migrates once while moved, rotated and imported poses remain intentional', () => {
  const item = observed.find(item => item.id === 'f3-homogenizer'), revision = 'preparation-tank-openings-20261112';
  const payload = (position, rotation = 0, stamped = false) => ({ version: 1, catalogRevision: revision, placementRevisions: stamped ? { [item.id]: item.placementRevision } : {}, items: [{ id: item.id, position, rotation }] });
  const restore = value => validateLayout(value, [item], { migrateDefaults: true, migrateDryerDefaults: false });
  assert.deepEqual(restore(payload([-.6, 7.3, -3.4]))[0].position, item.position);
  assert.deepEqual(restore(payload([-.5, 7.3, -3.5]))[0].position, item.position);
  for (const value of [payload([-.35, 7.3, -3.4]), payload([-.6, 7.3, -3.4], .2), payload([-.6, 7.3, -3.4], 0, true)]) {
    const result = restore(value)[0]; assert.deepEqual(result.position, value.items[0].position); assert.ok(Math.abs(result.rotation - value.items[0].rotation) < 1e-8);
  }
  assert.deepEqual(validateLayout(payload([-.6, 7.3, -3.4]), [item])[0].position, [-.6, 7.3, -3.4], 'explicit imports do not apply catalog migrations');
});
