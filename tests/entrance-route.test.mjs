import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../apps/shared/vendor/three.module.js';
import { CAMPUS_EQUIPMENT } from '../apps/site/campus-data.js';
import { buildCampusEquipment } from '../apps/site/campus-models.js';
import { createProximityDoorController } from '../apps/site/proximity-doors.js';

function harness(ids = ['campus-production', 'campus-dryer-tower', 'campus-team2-rear-access']) {
  const s = {
    scene: new THREE.Group(), parts: [], geometries: new Set(), materials: new Set(), textures: new Set(),
    _material(color, roughness, metalness, extra = {}) { const material = new THREE.MeshBasicMaterial({ color, ...extra }); this.materials.add(material); return material; },
    _group(parent, position = [0, 0, 0]) { const group = new THREE.Group(); group.position.set(...position); parent.add(group); return group; },
    _mesh(geometry, material, parent, position = [0, 0, 0]) { this.geometries.add(geometry); const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...position); parent.add(mesh); return mesh; },
    _box(parent, size, position, material) { return this._mesh(new THREE.BoxGeometry(...size), material, parent, position); },
    _cyl(parent, radius, height, position, material, bottom = radius, segments = 24) { return this._mesh(new THREE.CylinderGeometry(radius, bottom, height, segments), material, parent, position); },
    _part(root, name, offset, position = [0, 0, 0]) { const group = this._group(root, position); this.parts.push({ root, name, group, offset }); return group; },
  };
  const objects = new Map();
  for (const id of ids) {
    const item = CAMPUS_EQUIPMENT.find(entry => entry.id === id);
    assert.ok(item, id);
    const root = s._group(s.scene, item.position); root.rotation.y = item.rotation || 0;
    assert.equal(buildCampusEquipment(s, root, item), true, id); objects.set(id, root);
  }
  s.scene.updateMatrixWorld(true);
  return { s, objects, dispose() { for (const collection of [s.geometries, s.materials, s.textures]) collection.forEach(resource => resource.dispose()); } };
}

function boxes(root) {
  const result = [], instance = new THREE.Matrix4();
  root.updateWorldMatrix(true, true);
  root.traverse(mesh => {
    if (!mesh.isMesh) return;
    mesh.geometry.computeBoundingBox();
    const append = matrix => result.push({ mesh, bounds: mesh.geometry.boundingBox.clone().applyMatrix4(matrix) });
    if (mesh.isInstancedMesh) for (let index = 0; index < mesh.count; index++) { mesh.getMatrixAt(index, instance); append(mesh.matrixWorld.clone().multiply(instance)); }
    else append(mesh.matrixWorld);
  });
  return result;
}

const hits = (root, origin, direction, far) => new THREE.Raycaster(new THREE.Vector3(...origin), new THREE.Vector3(...direction).normalize(), 0, far).intersectObject(root, true);
const intersections = (root, volume) => boxes(root).filter(({ bounds }) => ['x', 'y', 'z'].every(axis => Math.min(bounds.max[axis], volume.max[axis]) - Math.max(bounds.min[axis], volume.min[axis]) > .01));

test('loading canopies and their wall anchors meet the facade without passing through its panels',()=>{
  const h=harness(['campus-production']);
  try {
    const root=h.objects.get('campus-production'),item=CAMPUS_EQUIPMENT.find(item=>item.id==='campus-production');
    const facadeZ=item.position[2]+item.depth/2,canopies=[],anchors=[];
    root.traverse(node=>{if(node.name==='entrance-production-supported-loading-canopy')canopies.push(node);if(node.name==='entrance-production-canopy-wall-anchor')anchors.push(node);});
    assert.equal(canopies.length,4);assert.equal(anchors.length,8);
    for(const part of [...canopies,...anchors]) {
      const bounds=new THREE.Box3().setFromObject(part);
      assert.ok(bounds.min.z>=facadeZ-.001,`${part.name} must remain on the outer side of the wall`);
      assert.ok(bounds.min.z-facadeZ<.02,`${part.name} must stay mounted to the facade rather than floating away`);
    }
  } finally {h.dispose();}
});

test('the three-floor building matches the section heights, two depth-wise gables and both floor-relative window bands', () => {
  const h=harness(['campus-packaging-building','campus-team2-rear-access']);
  try {
    const building=h.objects.get('campus-packaging-building'),rear=h.objects.get('campus-team2-rear-access');
    const body=new THREE.Box3().setFromObject(building.getObjectByName('campus-packaging-three-floor-shell'));
    assert.ok(Math.abs(body.max.y-12.15-6)<1e-5,'the third floor retains the six-metre clear storey to the eave');
    const roofs=[];building.traverse(node=>{if(node.name==='campus-packaging-three-floor-gable')roofs.push(node);});
    assert.equal(roofs.length,2);
    const centers=roofs.map(node=>new THREE.Box3().setFromObject(node).getCenter(new THREE.Vector3()).z).sort((a,b)=>a-b);
    assert.ok(Math.abs(centers[1]-centers[0]-15.2)<1e-4,'two ridges divide the drawing depth into equal roof bays');
    for(const roof of roofs) {
      const bounds=new THREE.Box3().setFromObject(roof),size=bounds.getSize(new THREE.Vector3());
      assert.ok(size.x>31 && size.z>15 && size.z<16,'each ridge runs across the width instead of along the depth');
      assert.ok(Math.abs(bounds.max.y-19.51)<1e-4 && Math.abs(bounds.min.y-18.15)<1e-4);
    }
    for(const [id,center] of [['packaging-rear-mid-window-band',7.75],['packaging-rear-upper-window-band',13.9]]) {
      const pane=rear.getObjectByName(`rear-survey-${id}`).getObjectByName('rear-survey-fixed-exterior-glass');
      assert.ok(Math.abs(new THREE.Box3().setFromObject(pane).getCenter(new THREE.Vector3()).y-center)<1e-4,'rendered window centers use the drawing sill and frame height');
    }
  } finally {h.dispose();}
});

test('the loading facade has actual front openings and eleven individually sized road-side window banks within its original three parts', () => {
  const h = harness(['campus-production']);
  try {
    const root = h.objects.get('campus-production'), shell = root.getObjectByName('campus-production-body');
    assert.ok(shell);
    assert.equal(h.s.parts.filter(part => part.root === root).length, 3, 'the detailed facade stays in the existing three selectable/explodable groups');
    const loadingBays = [], windowBanks = [];
    root.traverse(node => { if (/^entrance-production-loading-bay-\d+$/.test(node.name)) loadingBays.push(node); if (/^entrance-production-side-window-bank-\d+$/.test(node.name)) windowBanks.push(node); });
    assert.equal(loadingBays.length, 5, 'five loading portals retain the observed broad facade rhythm');
    for (const bay of loadingBays) {
      const center = bay.localToWorld(new THREE.Vector3(0, 1.6, 0));
      assert.equal(hits(shell, [center.x, center.y, center.z + 1], [0, 0, -1], 1.5).length, 0, `${bay.name} must open through the main building shell`);
      assert.ok(bay.getObjectByName('campus-loading-moving-curtain'), 'each real portal retains its independent moving shutter');
    }
    assert.equal(windowBanks.length, 11, 'the road-side close-up records eleven separate small window banks');
    const bounds = windowBanks.map(bank => new THREE.Box3().setFromObject(bank));
    assert.ok(new Set(bounds.map(box => box.getSize(new THREE.Vector3()).z.toFixed(2))).size >= 3, 'window banks are visibly different widths');
    const centers = bounds.map(box => box.getCenter(new THREE.Vector3()).z).sort((a, b) => a - b);
    assert.ok(new Set(centers.slice(1).map((z, index) => (z - centers[index]).toFixed(2))).size >= 3, 'the long wall no longer repeats a uniformly spaced generic window strip');
  } finally { h.dispose(); }
});

test('the first-team entrance projects from the side wall with two usable glass leaves and a clear front approach', () => {
  const h = harness();
  try {
    const tower = h.objects.get('campus-dryer-tower'), vestibule = tower.getObjectByName('campus-production1-projecting-vestibule');
    assert.ok(vestibule, 'the recorded concrete vestibule is a distinct projecting volume');
    const leaves = []; vestibule.traverse(node => { if (node.name === 'campus-vestibule-glass-door-leaf') leaves.push(node); });
    assert.equal(leaves.length, 2);
    const sliding=leaves.filter(leaf=>leaf.userData.proximityDoor);
    assert.ok(sliding.length>0,'the new entrance walk retains a moving outer panel');
    for(const leaf of sliding){assert.equal(leaf.userData.proximityDoor.kind,'slide');assert.equal(leaf.userData.proximityDoor.axis,'x');}
    assert.ok(vestibule.getObjectByName('campus-vestibule-sliding-door-tracks'),'the two outer panels run on parallel sliding tracks');
    const annex = new THREE.Box3().setFromObject(tower.getObjectByName('campus-third-floor-service-annex-body'));
    const doorBoxes = leaves.map(leaf => new THREE.Box3().setFromObject(leaf));
    const doorFront = Math.max(...doorBoxes.map(box => box.max.x));
    assert.ok(doorFront - annex.max.x > .8, 'the actual doors sit in front of the long annex wall');
    const center = doorBoxes[0].clone().union(doorBoxes[1]).getCenter(new THREE.Vector3());
    const approach = new THREE.Box3(new THREE.Vector3(doorFront + .15, .3, center.z - .45), new THREE.Vector3(76.5, 2, center.z + .45));
    for (const [id, root] of h.objects) assert.equal(intersections(root, approach).length, 0, `${id} must not fill the vestibule's front approach`);
  } finally { h.dispose(); }
});

test('the turn from the entrance-side road into the service lane stays open at eye height', () => {
  const h = harness(['campus-production', 'campus-dryer-tower']);
  try {
    for (const id of ['campus-production', 'campus-dryer-tower']) {
      assert.equal(hits(h.objects.get(id), [42, 1.6, -28], [1, 0, 0], 24).length, 0, `${id} must leave the cross-lane from X42 to X66 open`);
    }
  } finally { h.dispose(); }
});

test('the observed freight cabin has a real recess through both the annex wall and its foundation', () => {
  const h = harness(['campus-dryer-tower']);
  try {
    const tower = h.objects.get('campus-dryer-tower');
    const body = tower.getObjectByName('campus-third-floor-service-annex-body'), foundation = tower.getObjectByName('campus-third-floor-service-annex-foundation');
    const entry = tower.getObjectByName('rear-survey-rear-unmarked-glass-pair');
    assert.ok(entry?.getObjectByName('rear-survey-observed-freight-cabin'), 'the 237-second open-door frame supplies the visible cabin');
    const front = entry.localToWorld(new THREE.Vector3(0, 0, .85));
    for (const y of [.12, 1.4, 2.7]) for (const solid of [body, foundation]) {
      assert.equal(hits(solid, [front.x, y, front.z], [0, 0, 1], 2.8).length, 0, `${solid.name} must not fill the visible cabin at Y${y}`);
    }
    assert.ok(hits(body, [front.x + 1.5, 1.4, front.z], [0, 0, 1], 2.8).length > 0, 'the wall remains solid beside the cabin opening');
    assert.ok(hits(body, [front.x, 1.4, front.z], [0, 0, 1], 4).length > 0, 'the notch has a bounded depth rather than removing the whole annex');
  } finally { h.dispose(); }
});

test('the second-team glass entrance faces along the ninety-degree return beside the HVAC bank with a clear door approach', () => {
  const h = harness(['campus-team2-rear-access']);
  try {
    const root = h.objects.get('campus-team2-rear-access'), entry = root.getObjectByName('rear-survey-team2-stair-glass-entry'), rack = root.getObjectByName('rear-survey-rear-hvac-steel-platform');
    assert.ok(entry && rack);
    const normal = new THREE.Vector3(0, 0, 1).transformDirection(entry.matrixWorld);
    assert.ok(normal.x < -.99 && Math.abs(normal.z) < .01, 'the door faces the return passage instead of sharing the long rear-wall plane');
    const front = entry.localToWorld(new THREE.Vector3(0, 1.3, 0));
    const rackBounds = new THREE.Box3().setFromObject(rack), nearestClearance = front.x - rackBounds.max.x;
    assert.ok(nearestClearance > 3 && nearestClearance < 4, `the requested rack shift leaves about 3.4 m to the fixed return door (${nearestClearance.toFixed(3)}m)`);
    const approach = new THREE.Box3(new THREE.Vector3(front.x - 2.5, .25, front.z - .6), new THREE.Vector3(front.x - .12, 2, front.z + .6));
    assert.equal(intersections(rack, approach).length, 0, 'the existing HVAC units and rack must leave the door-facing passage clear');
    const leaves = []; entry.traverse(node => { if (node.userData.proximityDoor) leaves.push(node); });
    assert.equal(leaves.length, 2, 'the close-up glass pair retains two moving leaves');
    const returnWall = entry.getObjectByName('rear-survey-team2-perpendicular-return-mass');
    assert.ok(returnWall, 'the door is mounted on a ninety-degree return volume');
    const controller = createProximityDoorController(entry), person = entry.localToWorld(new THREE.Vector3(0, .05, 1.2));
    for (let frame = 0; frame < 90; frame++) controller.update(person, 1 / 60, { autoOpen: true });
    h.s.scene.updateMatrixWorld(true);
    assert.ok(leaves.every(leaf => Math.abs(leaf.rotation.y) > 1.5), 'the photographed glass leaves can actually swing clear');
    for (const y of [.4, 1.3, 2.2]) {
      const outside = entry.localToWorld(new THREE.Vector3(0, y, 1.4));
      assert.equal(hits(returnWall, outside.toArray(), normal.clone().negate().toArray(), 1.8).length, 0, `the return-wall opening must remain clear across the door height at Y${y}`);
    }
    controller.dispose();
  } finally { h.dispose(); }
});
