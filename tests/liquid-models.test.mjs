import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../apps/shared/vendor/three.module.js';
import { LIQUID_ROOM, LIQUID_ROOMS, LIQUID_EQUIPMENT } from '../apps/site/liquid-data.js';
import { createLiquidModel, LIQUID_MODEL_EXTENT } from '../apps/site/liquid-models.js';

const build = (detail = true) => createLiquidModel({ equipment: LIQUID_EQUIPMENT, rooms: LIQUID_ROOMS, columns: LIQUID_ROOM.columns, routes: LIQUID_ROOM.routes, detail });
const near = (a, b, tolerance = 1e-5) => assert.ok(Math.abs(a - b) < tolerance, `${a} differs from ${b}`);
function localBounds(record) {
  const result = new THREE.Box3(); record.body.updateMatrix();
  for (const mesh of record.body.children) { mesh.geometry.computeBoundingBox(); result.union(mesh.geometry.boundingBox.clone().applyMatrix4(record.body.matrix)); }
  return result;
}
function footprint(item, padding = 0) {
  const a = item.rotation || 0, c = Math.cos(a), s = Math.sin(a);
  return [[-1, -1], [-1, 1], [1, 1], [1, -1]].map(([x, z]) => {
    x *= item.width / 2 + padding; z *= item.depth / 2 + padding;
    return [item.position[0] + x * c + z * s, item.position[2] - x * s + z * c];
  });
}
function overlap(a, b, tolerance = .02) {
  for (const polygon of [a, b]) for (let i = 0; i < 2; i++) {
    const p = polygon[i], q = polygon[i + 1], axis = [q[1] - p[1], p[0] - q[0]], length = Math.hypot(...axis);
    const projection = (points) => points.map(([x, z]) => (x * axis[0] + z * axis[1]) / length);
    const aa = projection(a), bb = projection(b);
    if (Math.min(Math.max(...aa), Math.max(...bb)) - Math.max(Math.min(...aa), Math.min(...bb)) <= tolerance) return false;
  }
  return true;
}

test('all 52 current liquid cards produce independent finite photographic forms with their qualified data footprints', () => {
  const source = JSON.stringify([LIQUID_EQUIPMENT, LIQUID_ROOMS]), model = build();
  try {
    assert.deepEqual(LIQUID_MODEL_EXTENT, { width: 99.7, depth: 39.2 });
    assert.equal(model.objects.size, 52); assert.equal(model.records.size, 52); assert.equal(model.environment.roomFloors.size, 8);
    let draws = 0, triangles = 0;
    for (const item of LIQUID_EQUIPMENT) {
      const record = model.records.get(item.id); assert.ok(record && record.group === model.objects.get(item.id));
      assert.equal(record.group.userData.equipment, item.id); assert.equal(record.group.userData.cardNumber, item.cardNumber);
      assert.equal(record.group.userData.unsupportedType, undefined, `${item.id} needs its photographed machine family`);
      const bounds = localBounds(record), size = bounds.getSize(new THREE.Vector3());
      const dimensions = [item.width, item.height, item.depth], spans = size.toArray();
      spans.forEach((length, i) => assert.ok(length <= dimensions[i] + 1e-5 && length > .05, `${item.id} exceeds the qualified placement envelope`));
      near(Math.max(...spans.map((length, i) => length / dimensions[i])), 1);
      near(bounds.min.y, 0); near((bounds.min.x + bounds.max.x) / 2, 0); near((bounds.min.z + bounds.max.z) / 2, 0);
      near(record.body.scale.x, record.body.scale.y); near(record.body.scale.y, record.body.scale.z);
      assert.ok(model.anchorOf(item.id).toArray().every(Number.isFinite));
      record.group.traverse((mesh) => {
        if (!mesh.isMesh) return;
        draws++; triangles += (mesh.geometry.index?.count || mesh.geometry.attributes.position.count) / 3;
        assert.equal(mesh.userData.equipment, item.id);
        for (const name of ['position', 'normal', 'uv']) assert.ok(mesh.geometry.attributes[name].array.every(Number.isFinite), `${item.id} ${name}`);
      });
    }
    assert.ok(draws < 420, `static per-machine batching should keep 52 machines below 420 draws, got ${draws}`);
    assert.ok(triangles < 400000, `representative exterior geometry must remain bounded, got ${triangles}`);
    assert.equal(JSON.stringify([LIQUID_EQUIPMENT, LIQUID_ROOMS]), source, 'model construction cannot change source identities or qualified poses');
  } finally { model.dispose(); }
});

test('liquid room filters, individual isolation, selection and ray picking remain independent of structural visibility', () => {
  const model = build(false);
  try {
    for (const room of LIQUID_ROOMS) {
      model.setRoom(room.id);
      assert.deepEqual([...model.objects].filter(([, group]) => group.visible).map(([id]) => id).sort(), LIQUID_EQUIPMENT.filter((item) => item.roomId === room.id).map(({ id }) => id).sort());
    }
    model.setRoom(null);
    for (const item of LIQUID_EQUIPMENT) {
      model.setIsolation(item.id); model.setHighlight(item.id);
      assert.deepEqual([...model.objects].filter(([, group]) => group.visible).map(([id]) => id), [item.id]);
      assert.equal(model.environment.structure.visible, false); assert.equal(model.environment.routes.visible, false);
      const record = model.records.get(item.id), mesh = record.body.children[0], g = mesh.geometry, indices = g.index, p = g.attributes.position;
      model.root.updateWorldMatrix(true, true);
      let vertices;
      for (let tri = 0; tri < (indices?.count || p.count); tri += 3) {
        const candidate = [0, 1, 2].map((i) => new THREE.Vector3().fromBufferAttribute(p, indices ? indices.getX(tri + i) : tri + i));
        if (candidate[1].clone().sub(candidate[0]).cross(candidate[2].clone().sub(candidate[0])).lengthSq() > 1e-12) { vertices = candidate; break; }
      }
      assert.ok(vertices, `${item.id} needs a genuine exterior triangle for picking, not a collapsed lathe pole`);
      const centre = vertices.reduce((sum, v) => sum.add(v), new THREE.Vector3()).multiplyScalar(1 / 3).applyMatrix4(mesh.matrixWorld);
      const normal = vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0])).normalize().applyMatrix3(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld)).normalize();
      assert.equal(model.pick(new THREE.Raycaster(centre.clone().addScaledVector(normal, 6), normal.clone().negate())), item.id);
    }
    model.setIsolation(null); model.setHighlight(null); model.setStructureVisible(false);
    assert.equal(model.environment.structure.visible, false);
    assert.ok([...model.objects.values()].every((group) => group.visible));
    for (const record of model.records.values()) for (const material of record.materials.values()) assert.equal(material.opacity, material.userData.base.opacity);
    model.setStructureVisible(true); assert.equal(model.environment.structure.visible, true);
    assert.equal(model.anchorOf('missing'), null);
  } finally { model.dispose(); }
});

test('historical-plan columns and unconfirmed reference zones stay distinct, and representative machine footprints do not collide', () => {
  const model = build(false);
  try {
    assert.equal(model.environment.structure.children.filter((group) => group.name === 'liquid-plan-column').length, LIQUID_ROOM.columns.length);
    for (const room of LIQUID_ROOMS.filter((room) => room.referenceOnly)) {
      assert.equal(model.environment.roomFloors.get(room.id).userData.referenceOnly, true);
      assert.ok(!model.environment.structure.children.some((group) => group.userData.roomId === room.id), `${room.id} has no confirmed current wall location`);
      assert.ok(model.environment.roomFloors.get(room.id).children.some((object) => object.name === 'liquid-unconfirmed-reference-area'));
    }
    for (let a = 0; a < LIQUID_EQUIPMENT.length; a++) {
      const item = LIQUID_EQUIPMENT[a], room = LIQUID_ROOMS.find((r) => r.id === item.roomId), points = footprint(item);
      assert.ok(points.every(([x, z]) => x >= room.bounds.minX - .02 && x <= room.bounds.maxX + .02 && z >= room.bounds.minZ - .02 && z <= room.bounds.maxZ + .02), `${item.id} leaves its stated reference room`);
      for (let b = a + 1; b < LIQUID_EQUIPMENT.length; b++) {
        const other = LIQUID_EQUIPMENT[b]; if (other.roomId !== item.roomId) continue;
        assert.equal(overlap(points, footprint(other)), false, `${item.id} physically overlaps ${other.id}; preserve source evidence instead of hiding a collision in the model`);
      }
      for (const column of LIQUID_ROOM.columns) assert.equal(overlap(points, footprint({ position: column.position, width: column.width, depth: column.depth, rotation: column.rotation || 0 })), false, `${item.id} overlaps a source-plan column`);
    }
    assert.equal(model.environment.routes.children.length, (LIQUID_ROOM.routes || []).length);
  } finally { model.dispose(); }
});

test('liquid model disposal releases all live geometry and material resources once and detaches its root', () => {
  const model = build(false), parent = new THREE.Group(), released = new Map(); parent.add(model.root);
  model.root.traverse((object) => {
    for (const resource of [object.geometry, object.material].filter(Boolean)) if (!released.has(resource)) { released.set(resource, 0); resource.addEventListener('dispose', () => released.set(resource, released.get(resource) + 1)); }
  });
  model.dispose(); model.dispose();
  assert.equal(parent.children.length, 0); assert.equal(model.root.children.length, 0);
  assert.ok([...released.values()].every((count) => count === 1)); assert.equal(model.pick(new THREE.Raycaster()), null);
});

test('all cards keep explicit photographic exterior provenance and the enclosed PET filler retains its asymmetric four-direction windows', () => {
  const model = build();
  try {
    for (const item of LIQUID_EQUIPMENT) {
      const record = model.records.get(item.id), evidence = record.refinement;
      assert.equal(evidence.basis, 'four-direction-card-exterior'); assert.deepEqual(evidence.sourceCards, [item.cardNumber]);
      assert.equal(evidence.hiddenMechanismsAdded, false); assert.ok(evidence.features.length > 0);
      assert.equal(record.group.userData.cardRefinement, evidence);
    }
    const components = model.records.get('liquid-card-042').components;
    for (const [role, count] of [['front-window', 3], ['rear-window', 4], ['left-window', 2], ['right-window', 2]]) {
      const windows = components.filter(component => component.role === role); assert.equal(windows.length, count, role);
      assert.ok(windows.every(window => window.material === 'liquid-dark' && window.bounds.max[1] - window.bounds.min[1] > 1), 'windows must be the actual tall dark rounded geometry, not a text-only count');
    }
  } finally { model.dispose(); }
});

test('distinct mixer drives, lids and visible film feeds do not regress to one family silhouette', () => {
  const model = build(false), get = (number) => model.records.get(`liquid-card-${String(number).padStart(3, '0')}`);
  try {
    const horizontal = get(71).components.find(component => component.role === 'motor-horizontal-dark');
    const vertical = get(93).components.find(component => component.role === 'motor-vertical-dark');
    assert.ok(horizontal && vertical);
    assert.ok(horizontal.bounds.max[0] - horizontal.bounds.min[0] > horizontal.bounds.max[1] - horizontal.bounds.min[1], '071 has the photographed horizontal black drive');
    assert.ok(vertical.bounds.max[1] - vertical.bounds.min[1] > vertical.bounds.max[0] - vertical.bounds.min[0], '093 has the photographed vertical geared drive');
    const features = (number) => get(number).refinement.features.join(';');
    for (const number of [67, 80, 83]) assert.match(features(number), /flat-split-circular-lid/);
    for (const number of [81, 82]) assert.match(features(number), /inclined-round-manhole/);
    assert.match(features(48), /separate-front-SS-receiving-table/); assert.match(features(49), /low-rear-red-printed-film-roll/);
    assert.match(features(50), /square-open-lower-hopper/); assert.match(features(60), /round-clamped-side-hatches/);
    assert.match(features(96), /low-long-horizontal-cylinder/); assert.match(features(97), /separate-side-vertical-vessel/);
    assert.match(features(105), /parallel-delta-robot/); assert.match(features(107), /slanted-metal-bowl-guard/);
  } finally { model.dispose(); }
});

test('uniform fitting preserves photographed round sections and whole-machine proportions inside the unchanged nominal dimensions', () => {
  const model = build(), componentSpan = (record, role) => {
    const component = record.components.find(c => c.role === role); assert.ok(component, role);
    return new THREE.Vector3().fromArray(component.bounds.max).sub(new THREE.Vector3().fromArray(component.bounds.min)).multiply(record.body.scale);
  };
  try {
    for (const record of model.records.values()) {
      assert.equal(record.group.userData.fitBasis, 'uniform-fit-within-qualified-envelope');
      near(record.fitScale, record.body.scale.x); near(record.body.scale.x, record.body.scale.y); near(record.body.scale.x, record.body.scale.z);
    }
    for (const [number, role] of [[98, 'pearl-small-round-vessel'], [51, 'blue-resin-cylinder'], [46, 'motor-vertical-green']]) {
      const record = model.records.get(`liquid-card-${String(number).padStart(3, '0')}`), size = componentSpan(record, role);
      near(size.x, size.z, 1e-5);
    }
    const small = model.records.get('liquid-card-043'), shell = componentSpan(small, 'flat-top-tank-shell'), lid = componentSpan(small, 'flat-round-lid');
    near(lid.x, lid.z); assert.ok(lid.y < lid.x * .04, '043 has a thin flat circular lid, not a domed shoulder');
    assert.ok(!small.components.some(c => c.role === 'domed-tank-shell')); assert.ok(shell.y > shell.x * .8);
    const tunnel = model.records.get('liquid-card-046'), tunnelSize = localBounds(tunnel).getSize(new THREE.Vector3());
    assert.ok(tunnelSize.x > tunnelSize.y * 4, 'the PET tunnel keeps its photographed long and low silhouette');
    const softener = model.records.get('liquid-card-051');
    assert.equal(softener.components.find(c => c.role === 'softener-white-valve-head').material, 'liquid-white');
    assert.equal(softener.components.find(c => c.role === 'softener-blue-front-dial').material, 'liquid-blue');
    const face = componentSpan(softener, 'softener-blue-front-dial'); near(face.x, face.y);
  } finally { model.dispose(); }
});

test('the three Cheerpack cards keep their distinct feed faces, tracks and guard bands', () => {
  const model = createLiquidModel({ equipment: LIQUID_EQUIPMENT.filter(item => [64, 65, 66].includes(item.cardNumber)) });
  const components = (number, role) => model.records.get(`liquid-card-0${number}`).components.filter(c => c.role === role);
  try {
    const blueBands = components(64, 'front-door-band');
    assert.equal(blueBands.length, 2);
    assert.ok(blueBands.every(c => c.material === 'liquid-blue'));
    for (const number of [65, 66]) {
      const orangeBands = components(number, 'front-door-band');
      assert.equal(orangeBands.length, 2);
      assert.ok(orangeBands.every(c => c.material === 'liquid-orange' && c.bounds.max[1] < blueBands[0].bounds.min[1]));
      assert.equal(components(number, 'top-lattice-guard-cap').length, 1);
    }
    assert.equal(components(64, 'top-lattice-guard-cap').length, 0);
    for (const number of [64, 65, 66]) assert.ok(components(number, 'rear-transfer-frame')[0].bounds.max[2] < 0);
    const rails = components(65, 'paired-outfeed-end');
    assert.equal(rails.length, 2);
    assert.ok(rails[0].bounds.max[2] < rails[1].bounds.min[2]);
    assert.equal(components(65, 'covered-incline').length, 1);
    assert.equal(components(65, 'incline-flight').length, 0);
    const flights = components(66, 'incline-flight');
    assert.ok(flights.length > 2);
    for (const [index, flight] of flights.entries()) {
      if (index === 0) continue;
      assert.ok(flight.bounds.min[1] > flights[index - 1].bounds.max[1]);
      assert.ok(flight.bounds.min[0] > flights[index - 1].bounds.min[0]);
    }
    assert.equal(components(64, 'covered-incline').length + components(64, 'incline-flight').length, 0);
  } finally { model.dispose(); }
});

test('cartoner, pill former and kneader retain the external structures visible in their own card views', () => {
  const model = createLiquidModel({ equipment: LIQUID_EQUIPMENT.filter(item => [53, 106, 107].includes(item.cardNumber)), detail: false });
  const components = (id, role) => model.records.get(id).components.filter(c => c.role === role);
  try {
    const guides = components('liquid-card-053', 'carton-transfer-guide');
    const [infeed] = components('liquid-card-053', 'cartoner-infeed-side-guide');
    assert.equal(guides.length, 2);
    assert.equal(infeed.material, 'liquid-green');
    assert.ok(infeed.bounds.max[0] < guides[0].bounds.min[0]);
    const rim = components('liquid-card-106', 'square-hopper-rim');
    assert.equal(rim.length, 4);
    assert.ok(rim.every(c => c.bounds.max[1] - c.bounds.min[1] < .04));
    assert.ok(components('liquid-card-106', 'pellet-side-louvre').every(c => c.material === 'liquid-dark'));
    assert.equal(components('liquid-card-106', 'pellet-side-louvre').length, 10);
    const [bowl] = components('liquid-card-107', 'kneader-bowl');
    const [guard] = components('liquid-card-107', 'kneader-bowl-guard');
    const [plinth] = components('liquid-card-107', 'bowl-support-plinth');
    assert.ok(plinth.bounds.max[1] < bowl.bounds.min[1]);
    near(guard.bounds.min[1], bowl.bounds.max[1], .012);
    assert.equal(components('liquid-card-107', 'side-cable-loop')[0].material, 'liquid-black');
    const feet = components('liquid-card-107', 'kneader-leveling-pad');
    assert.equal(feet.length, 4);
    assert.ok(feet.every(c => c.bounds.max[1] < plinth.bounds.min[1]));
  } finally { model.dispose(); }
});

test('both kneader vent banks are visible against their white panels from the rear', () => {
  const model = createLiquidModel({ equipment: LIQUID_EQUIPMENT.filter(item => item.cardNumber === 107) });
  try {
    const { body, components } = model.records.get('liquid-card-107');
    model.root.updateMatrixWorld(true);
    const direction = new THREE.Vector3(0, 0, 1).transformDirection(body.matrixWorld);
    const hitFromRear = (x, y) => {
      const origin = body.localToWorld(new THREE.Vector3(x, y, -3));
      return new THREE.Raycaster(origin, direction).intersectObjects(body.children, false)[0];
    };
    for (const role of ['kneader-upper-rear-vent', 'kneader-lower-rear-vent']) {
      const slots = components.filter(component => component.role === role);
      assert.equal(slots.length, 20, role);
      for (const { bounds } of slots) {
        const x = (bounds.min[0] + bounds.max[0]) / 2;
        const y = (bounds.min[1] + bounds.max[1]) / 2;
        const slot = hitFromRear(x, y);
        const backing = hitFromRear(bounds.max[0] + .004, y);
        assert.equal(slot?.object.material.name, 'liquid-dark', role);
        assert.equal(backing?.object.material.name, 'liquid-white', role);
        near(body.worldToLocal(slot.point.clone()).z, bounds.min[2]);
        near(body.worldToLocal(backing.point.clone()).z, bounds.max[2]);
      }
    }
  } finally { model.dispose(); }
});
