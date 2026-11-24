import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from '../apps/shared/vendor/three.module.js';
import { LIQUID_ROOM, LIQUID_ROOMS, LIQUID_EQUIPMENT } from '../apps/site/liquid-data.js';
import { LIQUID_ASSETS } from '../apps/site/liquid-assets.js';
import { SITE_ASSETS } from '../apps/site/asset-catalog.js';

const evidence = async (name) => JSON.parse(await readFile(new URL(`./fixtures/evidence/${name}`, import.meta.url), 'utf8'));
const roomById = new Map(LIQUID_ROOMS.map((room) => [room.id, room]));

test('card appearance refinement preserves all 52 registered identities, poses and envelopes while exposing distinct four-view observations', async () => {
  const baseline=JSON.parse(await readFile(new URL('./fixtures/liquid-registered-poses-20261110.json',import.meta.url),'utf8'));
  const observations=await evidence('liquid-observations.json');
  for(const expected of baseline){
    const item=LIQUID_EQUIPMENT.find(e=>e.id===expected.id);
    assert.deepEqual(Object.fromEntries(Object.keys(expected).map(k=>[k,item[k]])),expected);
    assert.equal(item.summary,observations[String(item.cardNumber)].observation);
    assert.equal(item.appearanceReviewDate,'2026-11-10');
  }
  assert.equal(new Set(LIQUID_EQUIPMENT.map(e=>e.summary)).size,52,'individual equipment needs individual visible photo observations');
});
function corners(item) {
  const matrix = new THREE.Matrix4().makeRotationY(item.rotation);
  return [[-1, -1], [-1, 1], [1, 1], [1, -1]].map(([x, z]) => new THREE.Vector3(x * item.width / 2, 0, z * item.depth / 2)
    .applyMatrix4(matrix).add(new THREE.Vector3(...item.position))).map((p) => [p.x, p.z]);
}
function inside(point, polygon) {
  let contained = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    const cross = (point[0] - a[0]) * (b[1] - a[1]) - (point[1] - a[1]) * (b[0] - a[0]);
    if (Math.abs(cross) < 1e-8 && point[0] >= Math.min(a[0], b[0]) - 1e-8 && point[0] <= Math.max(a[0], b[0]) + 1e-8 && point[1] >= Math.min(a[1], b[1]) - 1e-8 && point[1] <= Math.max(a[1], b[1]) + 1e-8) return true;
    if ((a[1] > point[1]) !== (b[1] > point[1]) && point[0] < (b[0] - a[0]) * (point[1] - a[1]) / (b[1] - a[1]) + a[0]) contained = !contained;
  }
  return contained;
}
function intersects(a, b) {
  for (const polygon of [a, b]) for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i], q = polygon[(i + 1) % polygon.length], nx = q[1] - p[1], nz = p[0] - q[0];
    const pa = a.map(([x, z]) => x * nx + z * nz), pb = b.map(([x, z]) => x * nx + z * nz);
    if (Math.min(Math.max(...pa), Math.max(...pb)) - Math.max(Math.min(...pa), Math.min(...pb)) <= .001) return false;
  }
  return true;
}

test('the liquid catalog contains every one of the 52 preserved indoor cards once and keeps its original identity', async () => {
  const cards = await evidence('liquid-cards.json');
  assert.equal(cards.length, 52); assert.equal(LIQUID_EQUIPMENT.length, 52);
  assert.equal(new Set(LIQUID_EQUIPMENT.map((item) => item.id)).size, 52);
  assert.deepEqual(LIQUID_EQUIPMENT.map((item) => item.cardNumber).sort((a, b) => a - b), cards.map((card) => card._archiveNumber).sort((a, b) => a - b));
  for (const item of LIQUID_EQUIPMENT) {
    const card = cards.find((card) => card._archiveNumber === item.cardNumber);
    assert.equal(item.id, `liquid-card-${String(card._archiveNumber).padStart(3, '0')}`);
    assert.equal(item.name, card.name); assert.equal(item.sourceRoom, card.room); assert.equal(item.room, card.room);
    assert.ok(item.type && item.variant && item.details.length >= 2 && item.confidence);
    assert.equal('status' in item, false, 'historical card state cannot become live operation data');
  }
});

test('eight card-defined rooms retain their full equipment counts without inventing an extra floor or outdoor group', () => {
  assert.equal(LIQUID_ROOMS.length, 8); assert.equal(roomById.size, 8);
  const counts = Object.fromEntries(LIQUID_ROOMS.map((room) => [room.id, LIQUID_EQUIPMENT.filter((item) => item.roomId === room.id).length]));
  assert.deepEqual(counts, { mixing: 20, pouch: 7, outer: 7, pet: 6, boiler: 4, stick: 3, retort: 3, pellet: 2 });
  for (const item of LIQUID_EQUIPMENT) assert.ok(roomById.has(item.roomId), item.id);
  for (const number of [72, 73, 74, 75, 76, 84, 85, 86, 87, 88, 89, 90, 91, 92]) assert.equal(LIQUID_EQUIPMENT.some((item) => item.cardNumber === number), false, 'outdoor history cards remain in their separate room');
  assert.doesNotMatch(JSON.stringify(LIQUID_EQUIPMENT), /"floorLevel"|"floorCount"/);
});

test('the centred historical drawing frame and rotated equipment footprints fit the actual room polygons, including concave exclusions', () => {
  assert.equal(LIQUID_ROOM.width, 99.7); assert.equal(LIQUID_ROOM.depth, 39.2);
  assert.deepEqual(LIQUID_ROOM.bounds, { minX: -49.85, maxX: 49.85, minZ: -19.6, maxZ: 19.6 });
  for (const room of LIQUID_ROOMS) {
    assert.ok(room.outline.length >= 4 && room.outline.every((p) => p.length === 2 && p.every(Number.isFinite)), room.id);
    assert.equal(room.bounds.minX, Math.min(...room.outline.map((p) => p[0]))); assert.equal(room.bounds.maxX, Math.max(...room.outline.map((p) => p[0])));
    assert.equal(room.bounds.minZ, Math.min(...room.outline.map((p) => p[1]))); assert.equal(room.bounds.maxZ, Math.max(...room.outline.map((p) => p[1])));
  }
  for (const item of LIQUID_EQUIPMENT) {
    assert.equal(item.position.length, 3); assert.equal(item.position[1], 0);
    assert.ok(item.position.every(Number.isFinite) && Number.isFinite(item.rotation));
    assert.ok([item.width, item.depth, item.height].every((n) => Number.isFinite(n) && n > 0), item.id);
    for (const corner of corners(item)) assert.ok(inside(corner, roomById.get(item.roomId).outline), `${item.id} crosses its declared room polygon`);
  }
  assert.equal(inside([-36, -2], roomById.get('mixing').outline), false, 'the mixing-room northwest cutout is not filled by its overall bounds');
  assert.equal(inside([3, 9], roomById.get('outer').outline), false, 'the outer-packaging bounds cannot absorb the separate sterilizing/cooling room');
});

test('the 52 declared equipment footprints do not overlap each other or the verified I-column outlines', () => {
  const footprints = LIQUID_EQUIPMENT.map((item) => ({ item, polygon: corners(item) }));
  for (let a = 0; a < footprints.length; a++) for (let b = a + 1; b < footprints.length; b++) {
    assert.equal(intersects(footprints[a].polygon, footprints[b].polygon), false, `${footprints[a].item.id} overlaps ${footprints[b].item.id}`);
  }
  for (const { item, polygon } of footprints) for (const column of LIQUID_ROOM.columns) {
    assert.equal(intersects(polygon, corners({ ...column, rotation: 0 })), false, `${item.id} intersects column ${column.position}`);
  }
});

test('unregistered boiler and pellet locations remain reference areas and conflicting card numbers do not multiply equipment', () => {
  for (const id of ['boiler', 'pellet']) {
    const room = roomById.get(id);
    assert.equal(room.referenceOnly, true); assert.equal(room.positionBasis, 'representative'); assert.equal(room.positionConfidence, 'unconfirmed');
    assert.match(room.name, /위치 미확정/); assert.match(room.summary, /참조 배치/);
    for (const item of LIQUID_EQUIPMENT.filter((item) => item.roomId === id)) assert.equal(item.positionBasis, 'representative');
  }
  for (const item of LIQUID_EQUIPMENT) {
    assert.equal(item.positionMatch, 'unconfirmed'); assert.equal(item.sourceConfidence.currentPose, 'unconfirmed');
    assert.equal(item.sourceConfidence.equipmentPlanMatch, 'unconfirmed');
  }
  const boiler = LIQUID_EQUIPMENT.filter((item) => item.cardNumber === 104);
  assert.equal(boiler.length, 1); assert.equal(boiler[0].variant, 'vertical-single'); assert.match(boiler[0].details.join(' '), /두 대를 복제하지/);
  for (const number of [77, 78]) assert.match(LIQUID_EQUIPMENT.find((item) => item.cardNumber === number).details.join(' '), /종이 표찰.*강제 치환하지/);
  assert.equal(LIQUID_EQUIPMENT.find((item) => item.cardNumber === 107).variant, 'planetary-bowl');
});

test('each equipment card has one accessible four-side reflow asset while the data avoids duplicate photo registries', async () => {
  assert.equal(Object.keys(LIQUID_ASSETS).length, 52);
  const root = await realpath(fileURLToPath(new URL('../apps/site/', import.meta.url)));
  await Promise.all(LIQUID_EQUIPMENT.map(async (item) => {
    for (const field of ['photo', 'photos', 'cardPhotos']) assert.equal(field in item, false, 'the dedicated asset registry owns image embedding');
    const asset = LIQUID_ASSETS[item.cardNumber];
    const registered = SITE_ASSETS.find(entry => entry.id === `liquid-card-${String(item.cardNumber).padStart(3, '0')}`);
    assert.ok(registered, `card ${item.cardNumber} needs a catalog entry`);
    assert.equal(asset, registered.path);
    assert.match(asset, /^\.\/assets\/photos\/equipment-cards\/liquid\/\d{3}-[a-z0-9-]+\/four-views\.jpg$/);
    const resolved = await realpath(path.resolve(root, asset)), relative = path.relative(root, resolved);
    assert.ok(relative && !relative.startsWith('..') && !path.isAbsolute(relative));
    const bytes = await readFile(resolved); assert.equal(bytes[0], 0xff); assert.equal(bytes[1], 0xd8); assert.ok((await stat(resolved)).size > 1000);
  }));
});

test('drawn columns and transport lines retain their historical evidence and never become extra card equipment or invented process pipes', async () => {
  const receipt = await evidence('liquid-columns.json');
  assert.deepEqual(LIQUID_ROOM.columns, receipt.columns);
  assert.equal(LIQUID_ROOM.columns.length, 9, 'only the inspected matching I-column vectors are included');
  for (const column of LIQUID_ROOM.columns) {
    assert.equal(column.section, 'I'); assert.equal(column.pdfPathIndices.length, 2);
    assert.ok(column.width > 0 && column.depth > 0); assert.match(column.confidence, /height unmeasured/);
  }
  assert.equal(LIQUID_ROOM.routes.length, 2);
  for (const route of LIQUID_ROOM.routes) {
    assert.equal(route.kind, 'conveyor'); assert.equal(route.clipEquipment, true); assert.equal(route.positionMatch, 'unconfirmed');
    assert.match(route.source, /2022/); assert.ok(roomById.has(route.roomId)); assert.ok(route.points.length >= 2 && route.width > 0);
    for (const point of route.points) assert.ok(point.length === 3 && point.every(Number.isFinite) && inside([point[0], point[2]], roomById.get(route.roomId).outline));
    assert.equal(LIQUID_EQUIPMENT.some((item) => item.id === route.id), false);
  }
  assert.match(receipt.mode, /no present survey/); assert.match(LIQUID_ROOM.details.join(' '), /북쪽·GPS·캠퍼스 절대 좌표가 아닙니다/);
});
