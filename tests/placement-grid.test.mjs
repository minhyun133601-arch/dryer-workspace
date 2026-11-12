import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from '../apps/shared/vendor/three.module.js';
import { OUTDOOR_ROOM } from '../apps/site/outdoor-data.js';
import { PLACEMENT_RULES, constrainPlacement, fromRoomPosition, toRoomPosition } from '../apps/site/placement-rules.js';

async function harness(item) {
  const source = (await readFile(new URL('../apps/site/scene.js', import.meta.url), 'utf8'))
    .replace(/^import .*;\r?\n/gm, '').replace(/^export\s+(?=(?:function|class|const|let)\b)/gm, '');
  const context = vm.createContext({ THREE, OUTDOOR_ROOM, PLACEMENT_RULES, constrainPlacement, fromRoomPosition, toRoomPosition });
  new vm.Script(`${source}\nglobalThis.FacilityScene = FacilityScene;`).runInContext(context);
  const scene = Object.create(context.FacilityScene.prototype);
  const root = new THREE.Group();
  Object.assign(scene, {
    scene: new THREE.Scene(), equipment: [structuredClone(item)],
    objects: new Map([[item.id, root]]), placementDefaults: new Map([[item.id, structuredClone(item)]]),
    placementFootprints: new Map([[item.id, { minX: -.5, maxX: .5, minZ: -.5, maxZ: .5 }]]), placementResults: new Map(),
    geometries: new Set(), materials: new Set(), labels: [], locationDisks: new Map(),
    activeFloor: item.floor, selected: item.id, placementMode: true,
    selectionRing: { position: new THREE.Vector3() }, _invalidate() {},
  });
  scene._placementGuide();
  return scene;
}

test('visible campus and rotated yard cells match exact button-sized moves and report their usable bounds', async () => {
  for (const item of [
    { id: 'campus-unit', floor: 'campus', position: [1, 0, 2], rotation: 0 },
    { id: 'outdoor-unit', floor: 'outdoor', position: fromRoomPosition([20, 0, 0], OUTDOOR_ROOM), rotation: OUTDOOR_ROOM.rotation },
  ]) {
    const scene = await harness(item);
    try {
      const verticals = [];
      for (const grid of scene.placementGuide.children.filter(child => child.isLineSegments)) {
        const positions = grid.geometry.getAttribute('position');
        for (let i = 0; i < positions.count; i += 2) {
          if (positions.getX(i) === positions.getX(i + 1)) verticals.push(positions.getX(i));
        }
      }
      verticals.sort((a, b) => a - b);
      assert.ok(verticals.length > 4);
      for (let i = 1; i < verticals.length; i++) assert.equal(verticals[i] - verticals[i - 1], PLACEMENT_RULES.step);
      const before = scene.getPlacementInfo(item.id);
      assert.equal(before.step, PLACEMENT_RULES.step);
      assert.equal(before.valid, true);
      assert.equal(scene.setPlacementCoordinates(item.id, { x: before.position[0] + before.step * 2, z: before.position[2], rotationDegrees: 0 }), true);
      const moved = scene.getPlacementInfo(item.id);
      assert.ok(Math.abs(moved.position[0] - before.position[0] - before.step * 2) < 1e-8);
      assert.ok(Math.abs(moved.position[2] - before.position[2]) < 1e-8);
      assert.equal(scene.setPlacementCoordinates(item.id, { x: 999, z: moved.position[2], rotationDegrees: 0 }), true);
      const limited = scene.getPlacementInfo(item.id);
      assert.equal(limited.limited, true);
      assert.ok(limited.position[0] <= limited.bounds.maxX + 1e-8);
      assert.match(limited.message, /경계/);
      const geometryCount = scene.geometries.size;
      scene._placementGuide();
      assert.equal(scene.geometries.size, geometryCount, 'refreshing the grid releases the previous guide geometry');
    } finally {
      scene.geometries.forEach(geometry => geometry.dispose());
      scene.materials.forEach(material => material.dispose());
    }
  }
});
