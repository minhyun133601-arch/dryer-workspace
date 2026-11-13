import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as THREE from '../apps/shared/vendor/three.module.js';
import { buildPersonAvatar, PERSON_LOGO_URL } from '../apps/site/person-avatar.js';
import { SITE_ASSETS } from '../apps/site/asset-catalog.js';
import { WALK_RULES } from '../apps/site/person-walk.js';

function fixture() {
  const s = {
    scene: new THREE.Scene(), materials: new Set(), geometries: new Set(), textures: new Set(),
    _group(parent, position = [0, 0, 0]) { const group = new THREE.Group(); group.position.set(...position); parent.add(group); return group; },
    _mesh(geometry, material, parent, position = [0, 0, 0]) { const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...position); parent.add(mesh); this.geometries.add(geometry); return mesh; },
    _material(color, roughness, metalness) { const material = new THREE.MeshStandardMaterial({ color, roughness, metalness }); this.materials.add(material); return material; },
    dispose() { for (const values of [this.materials, this.geometries, this.textures]) for (const value of values) value.dispose(); },
  };
  const texture = new THREE.Texture();
  const avatar = buildPersonAvatar(s, { logoTexture: texture });
  s.scene.updateMatrixWorld(true);
  return { s, texture, ...avatar };
}

test('the guide has a complete human silhouette with animated limbs and registered, finite geometry', () => {
  const { s, root, limbs } = fixture();
  try {
    assert.equal(root.name, 'facility-person');
    assert.equal(root.userData.company, '희창유업');
    assert.equal(limbs.length, 2);
    const body = new THREE.Box3();
    root.traverse(node => {
      assert.equal(node.userData.person, true);
      if (!node.isMesh) return;
      assert.ok(s.geometries.has(node.geometry));
      assert.ok(s.materials.has(node.material));
      const box = new THREE.Box3().setFromObject(node);
      assert.ok([...box.min.toArray(), ...box.max.toArray()].every(Number.isFinite));
      if (!['person-location-ring', 'person-heading-arrow'].includes(node.name)) body.union(box);
    });
    assert.ok(Math.abs(body.min.y) < 1e-7, 'boots stand on the navigation datum');
    assert.ok(Math.abs(body.max.y - 1.75) < 1e-7, 'helmet matches the existing human scale');
    assert.ok(body.max.x - body.min.x <= WALK_RULES.radius * 2 + 1e-7, 'the clothed body fits the collision width');
    assert.equal(root.userData.height, WALK_RULES.height);
    assert.equal(root.userData.radius, WALK_RULES.radius);
    for (const side of [-1, 1]) assert.equal(root.getObjectByName(`person-eye-${side}`).position.y, WALK_RULES.eyeHeight, 'the rendered eyes match the walking camera height');
    for (const { arm, leg, side } of limbs) {
      assert.equal(Math.sign(arm.position.x), side);
      assert.equal(Math.sign(leg.position.x), side);
      const initial = new THREE.Box3().setFromObject(arm);
      arm.rotation.x = .35; s.scene.updateMatrixWorld(true);
      assert.notDeepEqual(new THREE.Box3().setFromObject(arm).min.toArray(), initial.min.toArray(), 'the original walking animation can move the sleeve and hand');
    }
  } finally { s.dispose(); }
});

test('the unchanged logo is readable from the front and back without mirroring or colour conversion', async () => {
  const { s, root, texture } = fixture();
  try {
    const asset = SITE_ASSETS.find(record => record.path === PERSON_LOGO_URL);
    assert.ok(asset, 'the person logo is included in the public asset registry');
    const bytes = await readFile(new URL(`../apps/site/${PERSON_LOGO_URL.slice(2)}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), '36b344981b0aa368919cc2f8427317d4bc2955bb43b382bcabc18e228e7cbc80', 'the registered image retains the exact supplied JPEG bytes');
    assert.equal(texture.colorSpace, THREE.SRGBColorSpace);
    assert.ok(s.textures.has(texture), 'the scene owns the texture for disposal');
    for (const name of ['chest', 'back', 'helmet']) {
      const badge = root.getObjectByName(`person-company-logo-${name}`);
      assert.equal(badge.geometry.parameters.width, badge.geometry.parameters.height, 'the square source image keeps its aspect ratio');
      assert.equal(badge.material.map, texture);
      assert.equal(badge.material.toneMapped, false, 'lighting must not recolour the supplied mark');
      assert.deepEqual(badge.material.color.toArray(), [1, 1, 1]);
      const center = badge.getWorldPosition(new THREE.Vector3());
      const normal = new THREE.Vector3(0, 0, 1).transformDirection(badge.matrixWorld);
      assert.equal(Math.sign(normal.z), name === 'back' ? 1 : -1);
      const ray = new THREE.Raycaster(center.clone().addScaledVector(normal, 1), normal.clone().negate());
      assert.ok(ray.intersectObject(badge).length, `${name}: the printed face looks outward`);
      assert.deepEqual(badge.geometry.getAttribute('uv').array.slice(0, 4), new Float32Array([0, 1, 1, 1]), 'UVs keep the original left-to-right image');
    }
  } finally { s.dispose(); }
});
