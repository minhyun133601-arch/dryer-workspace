import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../apps/shared/vendor/three.module.js';
import { DRYER_BUILDING_FLOORS } from '../apps/site/dryer-building-data.js';
import { buildDryerBuildingEnvironment } from '../apps/site/dryer-building-envelope.js';
import { buildPreparationEnvironment } from '../apps/site/preparation-environment.js';
import { createProximityDoorController } from '../apps/site/proximity-doors.js';

function fixture() {
  const s = {
    scene: new THREE.Scene(), materials: new Set(), geometries: new Set(), textures: new Set(),
    _group(parent, position = [0, 0, 0]) { const group = new THREE.Group(); group.position.set(...position); parent.add(group); return group; },
    _mesh(geometry, material, parent, position = [0, 0, 0]) { const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...position); parent.add(mesh); this.geometries.add(geometry); return mesh; },
    _material(color, roughness, metalness, extra = {}) { const material = new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra }); this.materials.add(material); return material; },
  };
  const spec = DRYER_BUILDING_FLOORS[1], environment = buildDryerBuildingEnvironment(s, { floor: 1, elevation: spec.elevation, spec });
  buildPreparationEnvironment(s, environment, spec); s.scene.updateMatrixWorld(true);
  const root = environment.architectureFixtures.children.find(node => node.userData.doorId === 'outer-packaging');
  assert.ok(root);
  const leaves = root.children.filter(node => node.userData.proximityDoor), controller = createProximityDoorController(s.scene);
  return { s, spec, environment, root, leaves, controller,
    dispose() { controller.dispose(); for (const values of [s.materials, s.geometries, s.textures]) for (const value of values) value.dispose(); },
  };
}

const advance = (controller, position, frames = 90) => { for (let index = 0; index < frames; index++) controller.update(position, 1 / 60, { autoOpen: false }); };
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-7, `${actual} versus ${expected}`);

test('the preparation-to-outer-packaging entrance slides sideways from the same manual open/close interaction on either side', () => {
  const h = fixture();
  try {
    const { root, leaves, controller, s } = h;
    assert.equal(root.userData.slidingDoor, true); assert.equal(leaves.length, 2);
    assert.ok(leaves.every(leaf => leaf.userData.proximityDoor.kind === 'slide' && leaf.userData.proximityDoor.axis === 'x'));
    assert.equal(new Set(leaves.map(leaf => leaf.userData.proximityDoor.groupId)).size, 1, 'one action operates both leaves');
    const fixed = root.matrixWorld.clone(), initialRotations = leaves.map(leaf => leaf.rotation.clone());
    for (const side of [-1, 1]) {
      const point = root.localToWorld(new THREE.Vector3(0, 0, .18 + side * .7));
      advance(controller, point);
      for (const leaf of leaves) near(leaf.position.x, leaf.userData.proximityDoor.closed);
      const interaction = controller.getInteraction(point);
      assert.equal(interaction.label, '외포장실 출입구'); assert.equal(interaction.action, 'open');
      assert.equal(controller.toggleNearest(point), true, 'the same manual action used by F and the on-screen button starts sliding');
      advance(controller, point); s.scene.updateMatrixWorld(true);
      for (const [index, leaf] of leaves.entries()) {
        near(leaf.position.x, leaf.userData.proximityDoor.open);
        assert.ok(leaf.rotation.equals(initialRotations[index]), 'a sliding panel does not swing');
      }
      assert.ok(root.matrixWorld.equals(fixed), 'the frame and rail remain fixed');
      assert.equal(controller.getInteraction(point).action, 'close');
      advance(controller, [100, h.spec.elevation, 100]);
      for (const leaf of leaves) near(leaf.position.x, leaf.userData.proximityDoor.open);
      controller.toggleNearest(point); advance(controller, point);
      for (const leaf of leaves) near(leaf.position.x, leaf.userData.proximityDoor.closed);
    }
  } finally { h.dispose(); }
});

test('all sliding animation frames fit beside the opening and the fully open doorway clears its width in both directions', () => {
  const h = fixture();
  try {
    const { s, root, leaves, controller, environment, spec } = h, temporary = new THREE.Matrix4(), fixed = [];
    const isMoving = node => { for (let current = node; current && current !== root; current = current.parent) if (leaves.includes(current)) return true; return false; };
    for (const layer of ['structure', 'facade', 'architectureFixtures']) environment[layer].traverse(node => {
      if (!node.isMesh || isMoving(node) || (node.material.transparent && node.material.opacity < .99)) return;
      node.geometry.computeBoundingBox();
      for (let index = 0; index < (node.isInstancedMesh ? node.count : 1); index++) {
        const matrix = node.matrixWorld.clone();
        if (node.isInstancedMesh) { node.getMatrixAt(index, temporary); matrix.multiply(temporary); }
        fixed.push({ node, bounds: node.geometry.boundingBox.clone().applyMatrix4(matrix) });
      }
    });
    const overlap = (one, two) => ['x', 'y', 'z'].every(axis => Math.min(one.max[axis], two.max[axis]) - Math.max(one.min[axis], two.min[axis]) > .001);
    const point = root.localToWorld(new THREE.Vector3(0, 0, -.7));
    const opaque = [];
    for (const layer of ['structure', 'facade', 'architectureFixtures']) environment[layer].traverse(node => { if (node.isMesh && !(node.material.transparent && node.material.opacity < .99)) opaque.push(node); });
    const cast = (z, height, reverse = false) => {
      const from = new THREE.Vector3(reverse ? 17.3 : 15.5, spec.elevation + height, z), direction = new THREE.Vector3(reverse ? -1 : 1, 0, 0);
      return new THREE.Raycaster(from, direction, .001, 1.8).intersectObjects(opaque, false);
    };
    assert.ok(cast(19.5, 1.4).length, 'the default closed panels actually close the entrance');
    controller.toggleNearest(point);
    for (let frame = 0; frame < 75; frame++) {
      controller.update(point, 1 / 60, { autoOpen: false }); s.scene.updateMatrixWorld(true);
      for (const leaf of leaves) {
        const panel = new THREE.Box3().setFromObject(leaf.children[0]);
        assert.ok(panel.min.z > spec.bounds.minZ && panel.max.z < spec.bounds.maxZ - .1, 'the moving panels fit before the south wall corner');
        const collision = fixed.find(item => overlap(panel, item.bounds));
        assert.ok(!collision, `the panel clears adjacent walls, frame and furnishings at frame ${frame}: ${collision?.node.parent?.name}`);
      }
    }
    for (const z of [18.7, 18.9, 19.1, 19.3, 19.5, 19.7, 19.9, 20.1, 20.3]) for (const height of [.35, 1.4, 2.1]) for (const reverse of [false, true]) {
      const hits = cast(z, height, reverse);
      assert.equal(hits.length, 0, `the full entrance clears at z${z}, h${height}: ${hits.map(hit => hit.object.parent?.name).join(', ')}`);
    }
    assert.ok(leaves[0].position.x < leaves[0].userData.proximityDoor.closed && leaves[1].position.x > leaves[1].userData.proximityDoor.closed, 'the two panels park on opposite sides of the passage');
  } finally { h.dispose(); }
});
