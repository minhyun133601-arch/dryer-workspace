import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../apps/shared/vendor/three.module.js';
import { CHILLER_DIMENSIONS, createChillerModel } from '../apps/site/chiller-model.js';

const IDS = ['frame', 'coil-bank', 'fans', 'compressor-1', 'compressor-2', 'receiver', 'insulated-vessel', 'insulated-pipes', 'copper-valves', 'controls', 'instruments', 'guards', 'cables'];
const near = (actual, expected, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);

test('the chiller preserves the production drawing envelope, two compressors, eight fans and two receivers in either detail level', () => {
  for (const detail of [true, false]) {
    const model = createChillerModel({ detail });
    try {
      assert.deepEqual([...model.records.keys()], IDS);
      assert.deepEqual(CHILLER_DIMENSIONS, { width: 4.14, depth: 1.9, height: 2.2 });
      const bounds = new THREE.Box3().setFromObject(model.root), size = bounds.getSize(new THREE.Vector3());
      near(size.x, CHILLER_DIMENSIONS.width); near(size.z, CHILLER_DIMENSIONS.depth);
      near(bounds.max.y, CHILLER_DIMENSIONS.height); near(bounds.min.y, 0);
      assert.equal(model.records.get('fans').group.userData.fanCount, 8);
      assert.equal(model.records.get('fans').group.children.filter((child) => child.userData.fanIndex).length, 8);
      assert.equal(model.records.get('receiver').group.children.length, 2);
      const instrumentMeshes = model.records.get('instruments').meshes;
      for (const [role, drawingItem] of [['high-pressure-gauge', 20], ['low-pressure-gauge', 21], ['pressure-switch-box', 22]]) {
        const units = instrumentMeshes.filter((mesh) => mesh.userData.role === role);
        assert.equal(units.length, 2, `${role} must retain SC010606's two-circuit quantity`);
        assert.deepEqual(units.map((mesh) => mesh.userData.circuit).sort(), [1, 2]);
        assert.ok(units.every((mesh) => mesh.name && mesh.userData.drawingItem === drawingItem && mesh.userData.basis === 'drawing-SC010606'));
        const x = units.map((mesh) => mesh.getWorldPosition(new THREE.Vector3()).x);
        assert.ok(x[0] < -1.8 && Math.abs(x[1]) < .05, 'the second instrument pair follows the drawing centre post');
      }
      const junction = new THREE.Box3().setFromObject(model.root.getObjectByName('chiller-front-junction-box'));
      const junctionSize = junction.getSize(new THREE.Vector3());
      assert.ok(junctionSize.x / junctionSize.y >= 1.3 && junctionSize.x / junctionSize.y <= 1.5, 'the photographed small front box must retain its broad, nearly square face');
      assert.ok(junction.min.y >= .09 && junction.max.y < .70, 'the front box stays between its base support and the coil beam');
      for (const name of ['chiller-front-junction-door', 'chiller-front-junction-handle']) {
        const bounds = new THREE.Box3().setFromObject(model.root.getObjectByName(name));
        assert.ok(bounds.min.y >= junction.min.y && bounds.max.y <= junction.max.y, `${name} follows the corrected door height`);
      }
      for (const id of ['compressor-1', 'compressor-2']) {
        const compressor = new THREE.Box3().setFromObject(model.records.get(id).group).getSize(new THREE.Vector3());
        near(compressor.x, .874, .003); near(compressor.z, .595, .003); near(compressor.y, .581, .003);
        assert.ok(compressor.x > compressor.z, 'the 874 mm compressor axis follows the drawing long face');
      }
      for (const record of model.records.values()) {
        assert.ok(record.meshes.length > 0 && record.name && record.anchor);
        assert.equal(record.group.userData.chillerPart, record.id);
        for (const mesh of record.meshes) {
          assert.equal(mesh.userData.chillerPart, record.id);
          assert.ok(mesh.geometry.attributes.position.array.every(Number.isFinite));
          if (mesh.isInstancedMesh) assert.ok(mesh.instanceMatrix.array.every(Number.isFinite));
        }
      }
    } finally { model.dispose(); }
  }
});

test('all chiller assemblies separate continuously and restore exactly without moving geometry within an assembly', () => {
  const model = createChillerModel(), parent = new THREE.Group();
  parent.position.set(3, 2, -4); parent.rotation.y = .35; parent.add(model.root);
  try {
    const initial = new Map(model.pieces.map((record) => [record.id, { anchor: model.anchorOf(record.id).clone(), meshes: record.meshes.map((mesh) => mesh.position.clone()) }]));
    let assembledLength;
    for (let i = 0; i <= 100; i++) {
      const amount = i / 100; model.setExplode(amount);
      const bounds = new THREE.Box3().setFromObject(model.root);
      assert.ok([...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite));
      if (i === 0) assembledLength = bounds.getSize(new THREE.Vector3()).length();
      if (i === 100) assert.ok(bounds.getSize(new THREE.Vector3()).length() > assembledLength * 1.3);
      for (const record of model.pieces) {
        const expected = record.home.clone().addScaledVector(record.offset, amount);
        assert.ok(record.group.position.distanceTo(expected) < 1e-12);
        assert.ok(model.anchorOf(record.id).toArray().every(Number.isFinite));
        record.meshes.forEach((mesh, index) => assert.ok(mesh.position.equals(initial.get(record.id).meshes[index])));
      }
    }
    model.setExplode(NaN);
    assert.ok(model.pieces.every((record) => record.group.position.distanceTo(record.home.clone().add(record.offset)) < 1e-12));
    model.setExplode(0);
    for (const record of model.pieces) assert.ok(model.anchorOf(record.id).distanceTo(initial.get(record.id).anchor) < 1e-10);
  } finally { model.dispose(); }
});

test('every chiller assembly can be isolated and picked; highlights restore materials and disposal releases shared resources once', () => {
  const model = createChillerModel(), geometryCounts = new Map(), materialCounts = new Map();
  model.root.traverse((object) => {
    if (object.geometry && !geometryCounts.has(object.geometry)) { geometryCounts.set(object.geometry, 0); object.geometry.addEventListener('dispose', () => geometryCounts.set(object.geometry, geometryCounts.get(object.geometry) + 1)); }
    if (object.material && !materialCounts.has(object.material)) { materialCounts.set(object.material, 0); object.material.addEventListener('dispose', () => materialCounts.set(object.material, materialCounts.get(object.material) + 1)); }
  });
  const parent = new THREE.Group(); parent.add(model.root);
  for (const record of model.pieces) {
    model.setIsolation(record.id); model.root.updateMatrixWorld(true);
    assert.deepEqual(model.pieces.filter(({ group }) => group.visible).map(({ id }) => id), [record.id]);
    const mesh = record.meshes[0], matrix = mesh.matrixWorld.clone();
    if (mesh.isInstancedMesh) { const instance = new THREE.Matrix4(); mesh.getMatrixAt(0, instance); matrix.multiply(instance); }
    const indices = mesh.geometry.index, positions = mesh.geometry.attributes.position;
    const vertices = [0, 1, 2].map((i) => new THREE.Vector3().fromBufferAttribute(positions, indices ? indices.getX(i) : i));
    const point = vertices.reduce((sum, vertex) => sum.add(vertex), new THREE.Vector3()).multiplyScalar(1 / 3).applyMatrix4(matrix);
    const normal = vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0])).normalize().applyMatrix3(new THREE.Matrix3().getNormalMatrix(matrix)).normalize();
    const origin = point.clone().addScaledVector(normal, 3);
    assert.equal(model.pick(new THREE.Raycaster(origin, normal.clone().negate())), record.id);
  }
  model.setIsolation(null); model.setHighlight('compressor-1');
  for (const record of model.pieces) for (const mat of record.materials.values()) {
    assert.equal(mat.transparent, record.id !== 'compressor-1');
    assert.equal(mat.opacity, record.id === 'compressor-1' ? 1 : .19);
  }
  model.setHighlight(null);
  for (const record of model.pieces) for (const mat of record.materials.values()) { assert.equal(mat.opacity, 1); assert.equal(mat.transparent, false); }
  assert.equal(model.anchorOf('missing'), null);
  model.dispose(); model.dispose();
  assert.equal(parent.children.length, 0); assert.equal(model.root.children.length, 0);
  assert.ok([...geometryCounts.values(), ...materialCounts.values()].every((count) => count === 1));
  assert.equal(model.pick(new THREE.Raycaster()), null);
});
