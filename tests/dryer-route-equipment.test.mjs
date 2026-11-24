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

test('the elevator-facing A/B drives and four covered runs lead west through the two inline hoppers', () => {
  const h = harness();
  try {
    const item = observed.find(item => item.id === 'f3-holding'), root = h.roots.get(item.id);
    assert.equal(named(root, 'observed-conical-hopper').length, 2);
    assert.equal(named(root, 'observed-vertical-motor-housing').length, 2);
    const runs = named(root, 'observed-covered-transfer-trough');
    assert.equal(runs.length, 4);
    const drivePositions = named(root,'observed-vertical-motor-housing').map(node=>node.getWorldPosition(new THREE.Vector3()));
    for(const drive of drivePositions) assert.ok(Math.abs(drive.x-6.8)<.2, 'red-beacon end lies directly ahead of the lift');
    const returns = named(root,'disc-return-station');
    assert.equal(returns.length,2);
    assert.ok(returns.every(n=>n.getWorldPosition(new THREE.Vector3()).x < item.position[0]-2));
    for(const run of runs){ const size=new THREE.Box3().setFromObject(run).getSize(new THREE.Vector3());assert.ok(size.x>8 && size.z<.25); }
    const decks = named(root, 'observed-hopper-common-platform'); assert.equal(decks.length, 1);
    for (const hopper of named(root,'observed-conical-hopper')) {
      const center=hopper.getWorldPosition(new THREE.Vector3());
      assert.equal(down(decks[0],center.x,center.z).length,0,'each inline hopper axis remains an actual deck opening');
    }
    assert.ok(down(decks[0], item.position[0], item.position[2]+.96).length > 0, 'the adjacent service strip remains solid');
    // The EXIF-corrected front frame in #002 and the deck posts in #004
    // constrain proportions without claiming a tape measurement.
    const crossing=new THREE.Box3().setFromObject(named(root,'paired-drive-guard-crossbar')[0]);
    const guardHeight=crossing.getCenter(new THREE.Vector3()).y-item.position[1];
    const guardWidth=crossing.getSize(new THREE.Vector3()).z;
    assert.ok(Math.abs(guardWidth/guardHeight-1.12)<.05,'front protection frame reconstructed from photo #002');
    assert.ok(Math.abs(root.userData.localPlatformElevation/guardHeight-2.04)<.12,'deck height relative to the same guard in photo #001');
    assert.ok(Math.abs(root.userData.supportWidth/root.userData.localPlatformElevation-.70)<.045,'return-end platform aspect ratio in photo #004');
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
      root.traverse(mesh=>{
        if(mesh.isMesh)assert.equal(new THREE.Box3().setFromObject(mesh).intersectsBox(passage),false,`${id}/${mesh.name} leaves the central person route clear`);
      });
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

test('restoring the reviewed disc-conveyor bank moves only its previous default with its original facing', () => {
  const item=observed.find(record=>record.id==='f3-holding');
  const old={id:item.id,position:[5.5,7.3,1],rotation:0};
  const payload=(pose,stamp)=>({version:1,catalogRevision:'preparation-tank-openings-20261112',placementRevisions:{[item.id]:stamp},items:[pose]});
  const previous='dryer-hall-saved-defaults-20261113';
  const restore=(pose,stamp)=>validateLayout(payload(pose,stamp),[item],{migrateDefaults:true,migrateDryerDefaults:false})[0];
  assert.deepEqual(restore(old,previous),{id:item.id,position:item.position,rotation:item.rotation});
  for(const custom of [{...old,position:[5.75,7.3,1]},{...old,position:[6,7.3,1]},{...old,rotation:Math.PI/2}]) {
    assert.deepEqual(restore(custom,previous),custom,'a manually changed pose survives the new survey');
  }
  assert.deepEqual(restore(old,item.placementRevision),old);
  assert.deepEqual(validateLayout(payload(old,previous),[item])[0],old,'explicit imports keep their own pose');
});
