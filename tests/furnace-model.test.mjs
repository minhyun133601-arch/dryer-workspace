import test from 'node:test';
import { isRetainedEvidenceImage } from '../apps/site/evidence-assets.js';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import * as THREE from '../apps/shared/vendor/three.module.js';
import { buildFurnace } from '../apps/site/furnace-model.js';
import { EQUIPMENT } from '../apps/site/building-data.js';

function harness() {
  const material = new THREE.MeshBasicMaterial();
  const model = {
    parts: [], mat: new Proxy({}, { get: () => material }),
    _group(parent, position = [0, 0, 0]) {
      const group = new THREE.Group(); group.position.set(...position); parent.add(group); return group;
    },
    _mesh(geometry, mat, parent, position = [0, 0, 0]) {
      const mesh = new THREE.Mesh(geometry, mat); mesh.position.set(...position); parent.add(mesh); return mesh;
    },
    _box(parent, size, position, mat) { return this._mesh(new THREE.BoxGeometry(...size), mat, parent, position); },
    _cyl(parent, radius, height, position, mat, bottom = radius, segments = 32) {
      return this._mesh(new THREE.CylinderGeometry(radius, bottom, height, segments), mat, parent, position);
    },
    _bar(parent, start, end, radius, mat) {
      const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end);
      const mesh = this._cyl(parent, radius, a.distanceTo(b), a.clone().add(b).multiplyScalar(.5).toArray(), mat, radius, 8);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize()); return mesh;
    },
    _ring(parent, radius, y, mat, thickness = .025) {
      const mesh = this._mesh(new THREE.TorusGeometry(radius, thickness, 6, 32), mat, parent, [0, y, 0]);
      mesh.rotation.x = Math.PI / 2; return mesh;
    },
    _part(root, name, offset, home = [0, 0, 0]) {
      const group = this._group(root, home);
      this.parts.push({ root, name, group, home: new THREE.Vector3(...home), offset: new THREE.Vector3(...offset) });
      return group;
    },
  };
  return { model, material };
}

test('the furnace has six visible selectable assemblies with valid geometry in assembled and exploded views', () => {
  const { model, material } = harness();
  const root = new THREE.Group();
  try {
    const assemblies = buildFurnace(model, root);
    assert.equal(assemblies.length, 6);
    assert.deepEqual(assemblies.map(({ number }) => number), [1, 2, 3, 4, 5, 6]);
    assert.equal(new Set(assemblies.map(({ group }) => group)).size, 6, 'each numbered label needs a distinct assembly');
    for (const { number, name, group, anchor } of assemblies) {
      assert.ok(name.length > 0);
      assert.equal(group.userData.furnacePart, number, 'picking and labels must identify the same part');
      assert.ok(anchor.length === 3 && anchor.every(Number.isFinite), 'part labels need finite anchors');
      let meshes = 0;
      group.traverse((object) => {
        if (!object.isMesh) return;
        meshes++;
        assert.ok([...object.geometry.attributes.position.array].every(Number.isFinite), `${name} has non-finite vertices`);
      });
      assert.ok(meshes > 0, `${name} needs visible geometry`);
    }
    const assembled = new THREE.Box3().setFromObject(root);
    for (const part of model.parts) part.group.position.copy(part.home).add(part.offset);
    root.updateMatrixWorld(true);
    const exploded = new THREE.Box3().setFromObject(root);
    for (const box of [assembled, exploded]) {
      assert.ok([...box.min.toArray(), ...box.max.toArray()].every(Number.isFinite));
      assert.ok(box.getSize(new THREE.Vector3()).toArray().every((length) => length > .1));
    }
    assert.ok(exploded.getSize(new THREE.Vector3()).length() > assembled.getSize(new THREE.Vector3()).length(), 'exploding must create room to inspect the assemblies');
  } finally {
    root.traverse((object) => object.geometry?.dispose());
    material.dispose();
  }
});

test('the photographed furnace keeps its identity and original evidence while the new plan/video registers the lower hall on floor six', async () => {
  const furnace = EQUIPMENT.find(({ id }) => id === 'heater');
  assert.ok(furnace);
  assert.equal(furnace.name, '건조실 버너');
  assert.equal(furnace.floor, 6);
  assert.deepEqual(furnace.visibleFloors, [6, 7]);
  assert.equal(furnace.type, 'heater');
  assert.ok(furnace.position.every(Number.isFinite));
  assert.equal(new Set(furnace.photos).size, furnace.photos.length);
  assert.equal(furnace.photos.filter((path) => path.includes('/photos/furnace/')).length, 7);
  assert.ok(furnace.photos.some((path) => path.includes('/dryer-roof-7f/')));
  assert.ok(furnace.photos.includes(furnace.photo));
  for (const reference of furnace.photos) {
    assert.match(reference, /^\.\/photos\/(?:furnace\/[a-z]+|dryer-roof-7f\/frame-\d+s)\.jpg$/);
  }
  assert.deepEqual(furnace.photos.filter(isRetainedEvidenceImage), [], 'historical field photos no longer enter the active gallery');
});
