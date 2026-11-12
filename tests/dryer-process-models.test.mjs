import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../apps/shared/vendor/three.module.js';
import { EQUIPMENT, FLOORS, floorHeight } from '../apps/site/building-data.js';
import { LOWER_EQUIPMENT } from '../apps/site/facility-data.js';
import { DRYER_PROCESS_IDS, buildDryerProcessEquipment } from '../apps/site/dryer-process-models.js';

function harness(equipment = EQUIPMENT) {
  const material = new THREE.MeshStandardMaterial({ color: 0xc8d1cf });
  const s = { scene: new THREE.Group(), equipment, parts: [], geometries: new Set(), materials: new Set([material]), mat: new Proxy({}, { get: () => material }),
    _material(color, roughness, metalness, options) { const m = new THREE.MeshStandardMaterial({ color, roughness, metalness, ...options }); this.materials.add(m); return m; },
    _group(parent, position = [0, 0, 0]) { const g = new THREE.Group(); g.position.set(...position); parent.add(g); return g; },
    _mesh(geometry, material, parent, position = [0, 0, 0]) { const m = new THREE.Mesh(geometry, material); m.position.set(...position); this.geometries.add(geometry); parent.add(m); return m; },
    _part(root, name, offset, position = [0, 0, 0]) { const g = this._group(root, position); this.parts.push({ root, name, group: g, home: g.position.clone(), offset: new THREE.Vector3(...offset) }); return g; },
  };
  const roots = new Map();
  for (const id of DRYER_PROCESS_IDS) {
    const item = equipment.find(item => item.id === id); assert.ok(item, id);
    const root = s._group(s.scene, item.position); root.rotation.y = item.rotation || 0;
    assert.equal(buildDryerProcessEquipment(s, root, item), true, id); roots.set(id, root);
  }
  s.scene.updateMatrixWorld(true);
  return { s, roots, dispose() { s.geometries.forEach(g => g.dispose()); s.materials.forEach(m => m.dispose()); } };
}
const named = (root, name) => { const result = []; root.traverse(o => { if (o.name === `dryer-process-${name}`) result.push(o); }); return result; };

test('all 22 process identities build finite registered geometry and preserve catalog part identities below their floor ceiling', () => {
  const h = harness();
  try {
    assert.equal(DRYER_PROCESS_IDS.length, 22);
    assert.equal(new Set(DRYER_PROCESS_IDS).size, 22);
    for (const [id, root] of h.roots) {
      const item = EQUIPMENT.find(item => item.id === id);
      assert.ok([1, 3, 4].includes(item.floor));
      assert.deepEqual(h.s.parts.filter(p => p.root === root).map(p => p.name), item.parts, `${id} keeps existing disassembly and selection identities`);
      let meshes = 0;
      root.traverse(mesh => {
        if (!mesh.isMesh) return;
        meshes++;
        assert.ok(h.s.geometries.has(mesh.geometry), `${id} must register every unique and instanced geometry for disposal`);
        assert.ok(h.s.materials.has(mesh.material), `${id} must register materials for disposal`);
        const positions = mesh.geometry.getAttribute('position');
        for (let i = 0; i < positions.count; i++) assert.ok(Number.isFinite(positions.getX(i)) && Number.isFinite(positions.getY(i)) && Number.isFinite(positions.getZ(i)), `${id} has non-finite mesh vertices`);
        if (mesh.isInstancedMesh) for (const value of mesh.instanceMatrix.array) assert.ok(Number.isFinite(value));
      });
      assert.ok(meshes >= 10, `${id} must contain visible equipment structure`);
      const bounds = new THREE.Box3().setFromObject(root);
      assert.ok(bounds.min.y >= item.position[1] - .001, `${id} cannot fall through its floor`);
      const ceiling = item.floor === 1 && item.dryerRoute?.kind.startsWith('overlook-') ? FLOORS.find(floor => floor.id === 1).structureHeight : floorHeight(item.floor);
      assert.ok(bounds.max.y <= item.position[1] + ceiling + .001, `${id} stays below its observed ceiling (top ${bounds.max.y})`);
      assert.equal(root.userData.historicalShapeReference.currentInstallationConfirmedByThisReference, false, 'historical silhouettes do not prove current installation');
    }
    const untouched = new THREE.Group(), before = h.s.parts.length;
    assert.equal(buildDryerProcessEquipment(h.s, untouched, { id: 'f5-powder-recovery' }), false);
    assert.equal(untouched.children.length, 0, 'the process builder must leave the independently owned fifth-floor model untouched');
    assert.equal(h.s.parts.length, before);
  } finally { h.dispose(); }
});

test('seven historical tank bodies share only two platform owners and leave the independently located S1 clear', () => {
  const h = harness();
  try {
    const ids = ['f1-melting', 'f1-mix-a', 'f1-mix-b', 'f1-oil-water', 'f1-s1'];
    assert.equal(ids.reduce((sum, id) => sum + h.roots.get(id).userData.historicalVesselBodies, 0), 7, 'six historical role names are not the count of visible vessel bodies');
    assert.equal(named(h.roots.get('f1-melting'), 'shared-two-vessel-platform').length, 1);
    assert.equal(named(h.roots.get('f1-mix-a'), 'shared-four-vessel-platform').length, 1);
    for (const id of ['f1-mix-b', 'f1-oil-water', 'f1-s1']) assert.equal(named(h.roots.get(id), 'shared-four-vessel-platform').length, 0, `${id} cannot duplicate or extend the shared platform through another room`);
    const a = new THREE.Box3().setFromObject(named(h.roots.get('f1-mix-a'), 'shared-four-vessel-platform')[0]);
    const b = new THREE.Box3().setFromObject(named(h.roots.get('f1-melting'), 'shared-two-vessel-platform')[0]);
    // Their AABBs overlap at the unused corner of the L. Raycast the actual decks
    // to check that the empty L corner is kept open instead of adding a second slab.
    const melt = EQUIPMENT.find(item => item.id === 'f1-melting');
    const ray = new THREE.Raycaster(new THREE.Vector3(melt.position[0], 4, melt.position[2]), new THREE.Vector3(0, -1, 0), 0, 4);
    assert.equal(ray.intersectObject(named(h.roots.get('f1-mix-a'), 'shared-four-vessel-platform')[0]).length, 0);
    assert.ok(a.max.z < EQUIPMENT.find(item => item.id === 'f1-s1').position[2] - 1);
    assert.ok(b.max.z < EQUIPMENT.find(item => item.id === 'f1-s1').position[2] - 1);
  } finally { h.dispose(); }
});

test('unregistered historical packaging references retain their older roller branches and pallet turntable', () => {
  const h = harness(LOWER_EQUIPMENT);
  try {
    const collector = h.roots.get('f1-conveyor-a');
    assert.equal(named(collector, 'packing-branch-roller').length, 3);
    const connection = named(collector, 'collector-connection'); assert.equal(connection.length, 1);
    assert.ok(new THREE.Box3().setFromObject(connection[0]).getSize(new THREE.Vector3()).length() < 7, 'the collector must connect from its nearest end rather than redraw a diagonal across the whole line');
    assert.equal(named(h.roots.get('f1-conveyor-b'), 'quarter-turn-roller').length, 1);
    assert.equal(named(h.roots.get('f1-conveyor-b'), 'pallet-infeed-connection').length, 1);
    for (const id of ['f1-ica-1', 'f1-ica-2', 'f1-ica-3']) {
      const root = h.roots.get(id);
      assert.equal(named(root, 'film-roll').length, 1);
      assert.equal(named(root, 'vertical-sealing-jaw').length, 2);
      assert.ok(named(root, 'green-output-belt').length > 1);
    }
    const pallet = h.roots.get('f1-palletizer');
    assert.equal(named(pallet, 'pallet-turntable').length, 1);
    assert.ok(named(pallet, 'safety-fence-wire').length > 20);
  } finally { h.dispose(); }
});

test('unregistered historical process references retain their original silhouettes without replacing registered video geometry', () => {
  const h = harness(LOWER_EQUIPMENT);
  try {
    assert.equal(named(h.roots.get('f3-sterilizer'), 'skid-vessel').length, 3);
    for (const id of ['f3-balance-tank', 'f3-feed-tank']) assert.equal(named(h.roots.get(id), 'standalone-reference-vessel').length, 1);
    assert.equal(named(h.roots.get('f3-holding'), 'large-cone-hopper').length, 1);
    assert.equal(named(h.roots.get('f3-holding'), 'cone-discharge-round-drive').length, 2);
    const vf = h.roots.get('f4-fluid-bed');
    assert.equal(named(vf, 'vf-large-inspection-port').length, 3);
    assert.equal(named(vf, 'vf-small-inspection-port').length, 2);
    assert.equal(named(vf, 'vf-end-access-stair').length, 2);
    assert.equal(named(h.roots.get('f4-fine-return'), 'fine-return-vertical-vessel').length, 1);
  } finally { h.dispose(); }
});
