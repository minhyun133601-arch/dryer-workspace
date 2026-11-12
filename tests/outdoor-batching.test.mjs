import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../apps/shared/vendor/three.module.js';
import { OUTDOOR_EQUIPMENT } from '../apps/site/outdoor-data.js';
import { buildOutdoorEnvironment, buildOutdoorEquipment } from '../apps/site/outdoor-models.js';

function build(batched) {
  const materials = new Map();
  const s = {
    scene: new THREE.Group(), parts: [], geometries: new Set(), created: 0, disposed: 0,
    renderer: batched ? { isWebGLRenderer: true } : null,
    outdoorMaterials: new Proxy({}, { get: (_, key) => {
      if (!materials.has(key)) { const material = new THREE.MeshBasicMaterial({ transparent: key === 'wet' }); material.name = key; materials.set(key, material); }
      return materials.get(key);
    } }),
    _group(parent, position = [0, 0, 0]) { const group = new THREE.Group(); group.position.set(...position); parent.add(group); return group; },
    _mesh(geometry, material, parent, position = [0, 0, 0]) {
      const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...position);
      mesh.castShadow = geometry.type !== 'PlaneGeometry'; mesh.receiveShadow = true;
      parent.add(mesh); this.geometries.add(geometry); return mesh;
    },
    _box(parent, size, position, material) { return this._mesh(new THREE.BoxGeometry(...size), material, parent, position); },
    _cyl(parent, radius, height, position, material, bottom = radius, segments = 48) { return this._mesh(new THREE.CylinderGeometry(radius, bottom, height, segments), material, parent, position); },
    _bar(parent, start, end, radius, material) {
      const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end);
      const mesh = this._cyl(parent, radius, a.distanceTo(b), a.clone().add(b).multiplyScalar(.5).toArray(), material, radius, 10);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize()); return mesh;
    },
    _part(root, name, offset, position = [0, 0, 0]) { const group = this._group(root, position); this.parts.push({ root, name, group }); return group; },
  };
  // Imported model builders and the batcher register geometries directly,
  // including shared buffers that never pass through this adapter's _mesh.
  // Count a resource once across all of those entry points, while retaining
  // every dispose event so an accidental double release still fails the check.
  const registered = new WeakSet();
  Object.defineProperty(s.geometries, 'add', { value(geometry) {
    if (!registered.has(geometry)) {
      registered.add(geometry); s.created++;
      geometry.addEventListener('dispose', () => s.disposed++);
    }
    return Set.prototype.add.call(this, geometry);
  } });
  s.mat = s.outdoorMaterials;
  const environment = buildOutdoorEnvironment(s), roots = new Map();
  for (const item of OUTDOOR_EQUIPMENT) {
    const root = s._group(s.scene, item.position); root.rotation.y = item.rotation; roots.set(item.id, root);
    assert.equal(buildOutdoorEquipment(s, root, item), true);
    // Live scene picking assigns equipment IDs after the builder returns.
    root.traverse((mesh) => { if (mesh.isMesh) mesh.userData.equipment = item.id; });
  }
  s.scene.updateMatrixWorld(true);
  return { s, roots, environment, materials };
}

function metrics(root) {
  const groups = new Map(), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  root.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const key = `${mesh.material.name}:${mesh.castShadow}:${mesh.receiveShadow}:${mesh.renderOrder}`;
    if (!groups.has(key)) groups.set(key, { triangles: 0, area: 0, sums: [0, 0, 0], uv: [0, 0], bounds: new THREE.Box3() });
    const result = groups.get(key), geometry = mesh.geometry, position = geometry.attributes.position, uv = geometry.attributes.uv;
    const count = geometry.index?.count || position.count;
    for (let i = 0; i < count; i += 3) {
      const indices = [0, 1, 2].map((j) => geometry.index ? geometry.index.getX(i + j) : i + j);
      for (let j = 0; j < 3; j++) {
        const vector = [a, b, c][j].fromBufferAttribute(position, indices[j]).applyMatrix4(mesh.matrixWorld);
        result.bounds.expandByPoint(vector); result.sums[0] += vector.x; result.sums[1] += vector.y; result.sums[2] += vector.z;
        result.uv[0] += uv.getX(indices[j]); result.uv[1] += uv.getY(indices[j]);
      }
      result.area += new THREE.Triangle(a, b, c).getArea(); result.triangles++;
    }
  });
  return groups;
}

function equivalent(original, batched) {
  const before = metrics(original), after = metrics(batched);
  assert.deepEqual([...after.keys()].sort(), [...before.keys()].sort());
  for (const [key, expected] of before) {
    const actual = after.get(key);
    assert.equal(actual.triangles, expected.triangles, `${key}: all original indexed triangles must be retained`);
    assert.ok(Math.abs(actual.area - expected.area) < Math.max(.001, expected.area * .00001), `${key}: transformed triangle area`);
    expected.sums.forEach((sum, index) => assert.ok(Math.abs(sum - actual.sums[index]) < Math.max(.003, Math.abs(sum) * .000001), `${key}: world position sum ${index}`));
    expected.uv.forEach((sum, index) => assert.ok(Math.abs(sum - actual.uv[index]) < .00001, `${key}: original texture coordinates`));
    assert.ok(actual.bounds.min.distanceTo(expected.bounds.min) < .00003, `${key}: world minimum bounds`);
    assert.ok(actual.bounds.max.distanceTo(expected.bounds.max) < .00003, `${key}: world maximum bounds`);
  }
}

test('live outdoor batching reduces meshes while preserving world geometry, part motion, shadows, picking and named assemblies', () => {
  const original = build(false), batched = build(true);
  try {
    for (const key of ['deck', 'structure', 'ducts']) equivalent(original.environment[key], batched.environment[key]);
    for (const item of OUTDOOR_EQUIPMENT) equivalent(original.roots.get(item.id), batched.roots.get(item.id));
    assert.equal(original.s.parts.length, batched.s.parts.length);
    // Exploding a single part must keep the same geometry under its new transform.
    for (const fixture of [original, batched]) {
      fixture.s.parts.find((part) => part.root === fixture.roots.get('outdoor-pump-skid')).group.position.set(.8, 1.1, -.6);
      fixture.s.scene.updateMatrixWorld(true);
    }
    equivalent(original.roots.get('outdoor-pump-skid'), batched.roots.get('outdoor-pump-skid'));
    for (const name of ['outdoor-end-pump-1', 'outdoor-end-pump-2', 'outdoor-end-unit-1', 'outdoor-end-unit-2']) {
      const group = batched.s.scene.getObjectByName(name); let meshes = 0;
      assert.ok(group, name); group.traverse((object) => { if (object.isMesh) meshes++; }); assert.ok(meshes > 0, `${name} retains actual renderable geometry`);
    }
    const stats = batched.s.outdoorBatchStats;
    assert.ok(stats.originalMeshes > 3000, 'the check exercises the complete detailed outdoor scene');
    assert.ok(stats.renderedMeshes < stats.originalMeshes * .15, `expected >85% mesh reduction, observed ${stats.originalMeshes} → ${stats.renderedMeshes}`);
    const remaining = new Set(); batched.s.scene.traverse((object) => { if (object.geometry) remaining.add(object.geometry); });
    assert.deepEqual(batched.s.geometries, remaining, 'the disposal registry keeps only live geometries');
    assert.equal(batched.s.disposed, batched.s.created - remaining.size, 'replaced source geometries are released exactly once');
    const raycaster = new THREE.Raycaster(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -1, 0));
    for (const id of ['outdoor-end-panel-tank', 'outdoor-blue-tank', 'outdoor-stainless-vessel']) {
      const hits = [], centre = new THREE.Box3().setFromObject(original.roots.get(id)).getCenter(new THREE.Vector3());
      for (const fixture of [original, batched]) {
        const root = fixture.roots.get(id);
        raycaster.ray.origin.set(centre.x, 100, centre.z);
        hits.push(raycaster.intersectObject(root, true)[0]);
      }
      assert.ok(hits.every(Boolean), id); assert.ok(hits[0].point.distanceTo(hits[1].point) < .00003, `${id}: picking hits the same surface`);
      assert.equal(hits[1].object.userData.equipment, id, 'merged meshes remain registered equipment pick targets');
    }
    console.log(`Outdoor runtime meshes: ${stats.originalMeshes} → ${stats.renderedMeshes}`);
  } finally {
    for (const fixture of [original, batched]) { fixture.s.geometries.forEach((geometry) => geometry.dispose()); fixture.materials.forEach((material) => material.dispose()); }
  }
});
