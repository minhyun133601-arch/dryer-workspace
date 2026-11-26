import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../apps/shared/vendor/three.module.js';
import { EQUIPMENT } from '../apps/site/building-data.js';
import { DRYER_F1_LOAD_EQUIPMENT } from '../apps/site/dryer-floor1-load-data.js';
import { buildDryerFloor1Load } from '../apps/site/dryer-floor1-photo-detail.js';

function fixture() {
  const s = { scene: new THREE.Scene(), geometries: new Set(), materials: new Set(), textures: new Set(),
    _group(parent, p = [0, 0, 0]) { const node = new THREE.Group(); node.position.set(...p); parent.add(node); return node; },
    _material(color, roughness = .6, metalness = .1, extra = {}) { const value = new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra }); this.materials.add(value); return value; },
  };
  return { s, dispose() { for (const set of [s.geometries, s.materials, s.textures]) for (const v of set) v.dispose(); } };
}

test('1F loads are selectable catalog items with their own cargo layer, like the team 2 third-floor storage', () => {
  const h = fixture();
  try {
    for (const item of DRYER_F1_LOAD_EQUIPMENT) {
      assert.ok(EQUIPMENT.includes(item), `${item.id} is listed in the dryer catalog`);
      const root = h.s._group(h.s.scene, item.position);
      assert.equal(buildDryerFloor1Load(h.s, root, item), true);
      const cargo = root.userData.packagingCargo;
      assert.ok(cargo?.isObject3D && cargo.parent === root, `${item.id} exposes its loads to the cargo toggle`);
      let meshes = 0; root.traverse(node => { if (node.isMesh) { meshes++; assert.ok(node.isInstancedMesh, 'repeated boxes stay instanced'); } });
      assert.ok(meshes > 0 && meshes < 20, `${item.id} uses a few batched meshes (${meshes})`);
      h.s.scene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root);
      assert.ok(box.min.y >= item.position[1] - .01, `${item.id} stands on its floor or deck`);
      assert.ok(box.max.x - box.min.x < 7 && box.max.z - box.min.z < 8, `${item.id} stays a compact load group`);
      const hasCargo = cargo.children.some(node => node.isMesh);
      if (!item.dryerLoad.empties) assert.ok(hasCargo, `${item.id} has boxes, sacks or bundles to hide`);
    }
    const unrelated = { ...EQUIPMENT.find(item => item.id === 'f1-palletizer') };
    assert.equal(buildDryerFloor1Load(h.s, h.s._group(h.s.scene), unrelated), false, 'other equipment keeps its own builder');
  } finally { h.dispose(); }
});
