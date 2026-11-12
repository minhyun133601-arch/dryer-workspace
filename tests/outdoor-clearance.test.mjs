import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../apps/shared/vendor/three.module.js';
import { OUTDOOR_EQUIPMENT, OUTDOOR_ROOM } from '../apps/site/outdoor-data.js';
import { buildOutdoorEnvironment, buildOutdoorEquipment } from '../apps/site/outdoor-models.js';

test('the complete outdoor passage retains a continuous wide walking band and ground under the camera route', () => {
  const material = new THREE.MeshBasicMaterial();
  const s = {
    scene: new THREE.Group(), parts: [], outdoorMaterials: new Proxy({}, { get: () => material }), mat: new Proxy({}, { get: () => material }),
    _group(parent, position = [0, 0, 0]) { const group = new THREE.Group(); group.position.set(...position); parent.add(group); return group; },
    _mesh(geometry, mat, parent, position = [0, 0, 0]) { const mesh = new THREE.Mesh(geometry, mat); mesh.position.set(...position); parent.add(mesh); return mesh; },
    _box(parent, size, position, mat) { return this._mesh(new THREE.BoxGeometry(...size), mat, parent, position); },
    _cyl(parent, radius, height, position, mat, bottom = radius, segments = 48) { return this._mesh(new THREE.CylinderGeometry(radius, bottom, height, segments), mat, parent, position); },
    _bar(parent, start, end, radius, mat) {
      const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end), mesh = this._cyl(parent, radius, a.distanceTo(b), a.clone().add(b).multiplyScalar(.5).toArray(), mat, radius, 10);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize()); return mesh;
    },
    _part(root, name, offset, position = [0, 0, 0]) { const group = this._group(root, position); group.userData.partName = name; this.parts.push({ root, name, group }); return group; },
  };
  try {
    const environment = buildOutdoorEnvironment(s);
    for (const item of OUTDOOR_EQUIPMENT) {
      const root = s._group(s.scene, item.position); root.rotation.y = item.rotation; root.name = item.id;
      buildOutdoorEquipment(s, root, item);
    }
    s.scene.updateMatrixWorld(true);
    const inverse = environment.deck.matrixWorld.clone().invert();
    const boundsInRoom = (group) => {
      const result = new THREE.Box3();
      group.traverse((mesh) => {
        if (!mesh.isMesh) return;
        mesh.geometry.computeBoundingBox(); result.union(mesh.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(mesh.matrixWorld)));
      });
      return result;
    };
    const fence = environment.structure.getObjectByName('outdoor-process-green-fence');
    assert.ok(fence, 'the two observed short green screens remain represented');
    for (const [name, along] of [['approach', 54], ['tank-end', 74]]) {
      const screen = fence.getObjectByName(`outdoor-process-${name}-screen`);
      assert.ok(screen, name); const box = boundsInRoom(screen);
      assert.ok(box.min.x >= along - .1 && box.max.x <= along + .1, 'fixed screens are transverse, not a long invented cage');
      assert.ok(box.max.z < 1.15, 'fixed screens leave the pedestrian opening on the wall side');
      assert.ok(box.max.y >= 2.1 && box.max.y <= 2.3, 'screen top follows the observed approximately shoulder-to-overhead height');
      const gate = fence.getObjectByName(`outdoor-process-open-gate-${along}`);
      assert.ok(gate, `${name} open gate`); const leaf = boundsInRoom(gate);
      assert.ok(leaf.min.z >= 3.45 && leaf.max.x - leaf.min.x < 2.7, 'open gate folds along the wall outside the walking band');
    }
    fence.traverse((mesh) => {
      if (!mesh.isMesh) return;
      const box = boundsInRoom(mesh);
      assert.ok(box.max.x < 57 || box.min.x > 73.8, 'no unsupported continuous fence occupies the long side between the two observed screens');
    });
    const corridor = new THREE.Box3(new THREE.Vector3(0, .15, 1.7), new THREE.Vector3(OUTDOOR_ROOM.length, 2.2, 3.4));
    assert.ok(OUTDOOR_ROOM.aisleWallZ >= 3.6, 'the boundary must leave the full widened corridor');
    assert.ok(OUTDOOR_ROOM.aisleCenterZ > corridor.min.z + .3 && OUTDOOR_ROOM.aisleCenterZ < corridor.max.z - .3, 'the walking-height camera stays comfortably inside the free band');
    const blockers = [];
    s.scene.traverse((mesh) => {
      if (!mesh.isMesh) return;
      mesh.geometry.computeBoundingBox();
      const box = mesh.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(mesh.matrixWorld));
      if (!box.intersectsBox(corridor)) return;
      const overlap = new THREE.Box3().copy(box).intersect(corridor).getSize(new THREE.Vector3());
      if (Math.min(overlap.x, overlap.y, overlap.z) <= .00001) return;
      let parent = mesh, label = mesh.name;
      while (parent && !label) { label = parent.userData.partName || parent.name; parent = parent.parent; }
      blockers.push({ label: label || mesh.geometry.type, min: box.min.toArray(), max: box.max.toArray() });
    });
    assert.deepEqual(blockers, [], `human-height equipment, fencing and pipe supports must stay outside the continuous 1.7-wide band: ${JSON.stringify(blockers)}`);
    const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0);
    for (let along = 0; along <= OUTDOOR_ROOM.length; along += .5) {
      const position = new THREE.Vector3(along, 1, OUTDOOR_ROOM.aisleCenterZ).applyMatrix4(environment.deck.matrixWorld);
      ray.set(position, down);
      const hit = ray.intersectObject(environment.deck, true)[0];
      assert.ok(hit && hit.distance < 1.1, `camera route needs supporting ground at ${along}`);
    }
  } finally { s.scene.traverse((mesh) => mesh.geometry?.dispose()); material.dispose(); }
});
