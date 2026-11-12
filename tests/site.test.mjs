import test from 'node:test';
import assert from 'node:assert/strict';
import { access, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EQUIPMENT as PHOTO_EQUIPMENT } from '../apps/site/data.js';
import { LOWER_EQUIPMENT } from '../apps/site/facility-data.js';
import { EQUIPMENT, FLOORS, FLOOR_HEIGHT, floorElevation, floorHeight } from '../apps/site/building-data.js';
import { DRYER_UPPER_FLOORS, DRYER_UPPER_OVERRIDES, DRYER_ROOF_EQUIPMENT, DRYER_UPPER_OBSERVED_EQUIPMENT } from '../apps/site/dryer-upper-data.js';
import { PREPARATION_EQUIPMENT } from '../apps/site/preparation-data.js';
import { isRetainedEvidenceImage } from '../apps/site/evidence-assets.js';

const actualFloors = [1, 2, 3, 4, 5, 6, 7, 8];
const architecturalElevations = new Map([[1, .3], [2, 3.8], [3, 7.3], [4, 13.3], [5, 20.2], [6, 26.2], [7, 32.6], [8, 32.6]]);

const photoLayout = new Map([
  ['chamber', { position: [-6, 0, -3], rotation: 0 }],
  ['blower', { position: [1.5, 0, -2.5], rotation: 0 }],
  ['heater', { position: [-6, 0, 3.6], rotation: 0 }],
  ['cyclone-1', { position: [7, 0, -5], rotation: 0 }],
  ['cyclone-2', { position: [7, 0, 0], rotation: 0 }],
  ['cyclone-3', { position: [7, 0, 5], rotation: 0 }],
  ['panel', { position: [-10.5, 0, 3.8], rotation: 0 }],
]);

test('assembled facility follows architectural datums and keeps the roof service area at the seventh-floor level', () => {
  assert.deepEqual(FLOORS.map((floor) => floor.id), actualFloors);
  assert.equal(FLOOR_HEIGHT, 7.5);
  assert.equal(EQUIPMENT.length, 47);
  assert.equal(PREPARATION_EQUIPMENT.length, 9, 'the filmed preparation additions include the lower services and the adjacent boiler-room view');
  assert.equal(LOWER_EQUIPMENT.length, 28, 'the original lower-floor records remain available as source references');
  assert.equal(EQUIPMENT.length, LOWER_EQUIPMENT.length - 3 + PHOTO_EQUIPMENT.length + 6 + PREPARATION_EQUIPMENT.length);
  for (const id of ['f1-prep-under-services', 'f1-boiler-room']) assert.equal(EQUIPMENT.find(item => item.id === id)?.floor, 1, `${id} must be selectable with the preparation room`);
  assert.equal(EQUIPMENT.find(item => item.id === 'f1-boiler-room').samePhysicalRoomAs, 'campus-boiler-room');
  const ids = EQUIPMENT.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate IDs would make selection ambiguous');
  for (const removed of ['f6-dryer-shell', 'f6-cyclone-bank', 'f6-exhaust-riser']) assert.ok(!ids.includes(removed), 'superseded approximate pieces cannot duplicate the observed equipment');
  assert.deepEqual([...new Set(EQUIPMENT.map((item) => item.floor))].sort((a, b) => a - b), [1, 3, 4, 5, 6, 7, 8]);
  assert.equal(EQUIPMENT.filter(item => item.floor === 2).length, 0, 'the architectural partial floor does not invent unverified equipment');
  actualFloors.forEach((id) => {
    assert.equal(floorElevation(id), architecturalElevations.get(id), `wrong architectural datum: ${id}`);
  });
  for (const [id, height] of [[1, 3.5], [2, 3.5], [3, 6], [4, 6.9], [5, 6], [6, 6.4], [7, 4.8]]) assert.ok(Math.abs(floorHeight(id) - height) < 1e-10, `wrong clear story interval: ${id}`);
  assert.equal(FLOORS.find(floor => floor.id === 8).kind, 'roof');
  assert.equal(floorElevation(7), floorElevation(8), 'roof selection must not invent another story');
  assert.throws(() => floorElevation(9), RangeError);
  assert.throws(() => floorHeight(9), RangeError);

  for (const item of EQUIPMENT) {
    assert.ok(actualFloors.includes(item.floor), item.id);
    assert.equal(item.position.length, 3, item.id);
    assert.ok(item.position.every(Number.isFinite), `invalid model position: ${item.id}`);
    assert.ok(Number.isFinite(item.rotation), `invalid model direction: ${item.id}`);
    assert.equal(item.position[1], floorElevation(item.floor), `wrong floor elevation: ${item.id}`);
  }
});

test('the original seven source layouts and photos stay intact while the assembled hall follows the plan/video registration', () => {
  assert.equal(PHOTO_EQUIPMENT.length, photoLayout.size);
  for (const original of PHOTO_EQUIPMENT) {
    const expected = photoLayout.get(original.id);
    assert.ok(expected, `unexpected change to photo-based equipment: ${original.id}`);
    assert.deepEqual(original.position, expected.position, `source layout changed: ${original.id}`);
    assert.equal(original.rotation, expected.rotation, original.id);

    const assembled = EQUIPMENT.find((item) => item.id === original.id);
    assert.equal(assembled.floor, 6, original.id);
    assert.deepEqual(assembled.visibleFloors, [6, 7], 'continuous equipment remains visible from the upper observation level');
    assert.deepEqual(assembled.position, DRYER_UPPER_OVERRIDES[original.id].position, original.id);
    assert.equal(assembled.rotation, original.rotation, original.id);
    assert.equal(assembled.photo, original.photo, original.id);
    assert.deepEqual(assembled.photos.slice(0, original.photos.length), original.photos, original.id);
    assert.ok(assembled.photos.length > original.photos.length, 'new video views supplement the preserved source photos');
    assert.deepEqual(assembled.previousPlacements, [{ position: [expected.position[0], 37.5, expected.position[2]], rotation: expected.rotation }]);
    assert.equal(assembled.positionConfidence, 'approximate');
  }
});

test('the upper observation well is aligned with the continuous chamber without treating architectural holes as measured machine diameters', () => {
  const chamber = EQUIPMENT.find(item => item.id === 'chamber');
  const well = EQUIPMENT.find(item => item.id === 'dryer-chamber-upper-well');
  assert.deepEqual([well.position[0], well.position[2]], [chamber.position[0], chamber.position[2]]);
  assert.equal(chamber.position[1] + chamber.height, well.position[1]);
  assert.equal(well.floor, 7);
  assert.deepEqual(well.visibleFloors, [6, 7]);
  assert.equal(well.belowFloor, 1);
  assert.equal(well.height, .8);
  assert.equal(DRYER_UPPER_FLOORS[6].chamberOpening.diameter, 8.3);
  assert.equal(DRYER_UPPER_FLOORS[7].chamberOpening.diameter, 8.6);
  assert.ok(chamber.width < DRYER_UPPER_FLOORS[6].chamberOpening.diameter, 'the hole dimension is not the measured equipment shell diameter');
  assert.match(chamber.details.join(' '), /建|건축 개구 치수/);
});

test('roof equipment uses one observed assembly per identity and the flat service bay rather than the gabled roof datum', () => {
  assert.equal(DRYER_ROOF_EQUIPMENT.length, 3);
  const room = DRYER_UPPER_FLOORS[8], { serviceApron, eave, ridge } = room.roofProfile;
  assert.equal(eave, 37.4);
  assert.equal(ridge, 40.4);
  assert.equal(serviceApron.elevation, 32.6);
  for (const item of DRYER_ROOF_EQUIPMENT) {
    assert.equal(item.floor, 8);
    assert.deepEqual(item.visibleFloors, [7, 8], 'the service area is physically on the seventh-floor datum');
    assert.equal(item.position[1], serviceApron.elevation);
    assert.ok(item.position[0] - item.width / 2 >= serviceApron.minX && item.position[0] + item.width / 2 <= serviceApron.maxX, item.id);
    assert.ok(item.position[2] - item.depth / 2 >= serviceApron.minZ && item.position[2] + item.depth / 2 <= serviceApron.maxZ, item.id);
    assert.equal(item.positionConfidence, 'approximate');
  }
  assert.deepEqual(DRYER_ROOF_EQUIPMENT[0].capacity, { totalTon: 20, firefightingTon: 9, basis: '영상 6/12초 명판 직접 판독' });
  assert.match(DRYER_ROOF_EQUIPMENT[1].name, /기능 미확정/);
  assert.match(DRYER_ROOF_EQUIPMENT[1].details.join(' '), /같은 조립체.*한 그룹/);
  assert.equal(DRYER_ROOF_EQUIPMENT[2].roomUse, 'elevator-machine-room');
  assert.equal(DRYER_ROOF_EQUIPMENT[2].roomUseConfirmed, true, 'the user confirmed the room identity');
  assert.equal(DRYER_ROOF_EQUIPMENT[2].driveTypeConfirmed, false, 'confirmed room use does not confirm the hoist design or ratings');
  assert.match(DRYER_ROOF_EQUIPMENT[2].details.join(' '), /구동 형식·모델명.*미확정/);
});

test('lower cone and recovery references retain their raw records while following the observed upper equipment axes', () => {
  const raw = LOWER_EQUIPMENT.find(item => item.id === 'f5-dryer-cone');
  const cone = EQUIPMENT.find(item => item.id === raw.id);
  const chamber = EQUIPMENT.find(item => item.id === 'chamber');
  assert.deepEqual([raw.position[0], raw.position[2]], [-6, -3], 'the illustrative OWP source remains preserved');
  assert.deepEqual([cone.position[0], cone.position[2]], [chamber.position[0], chamber.position[2]]);
  assert.equal(cone.radius, chamber.radius);
  assert.equal(cone.position[1] + cone.height, chamber.position[1], 'the cone stops at the chamber floor datum');
  assert.deepEqual(cone.previousPlacements[0].position, [-6, 22.5, -3]);
  assert.match(cone.details.join(' '), /下|하부 개별 배치는 미실측/);
  const recovery = EQUIPMENT.find(item => item.id === 'f5-powder-recovery');
  assert.deepEqual(recovery.stations.map(z => [recovery.position[0], recovery.position[2] + z]),
    EQUIPMENT.filter(item => item.type === 'cyclone').map(item => [item.position[0], item.position[2]]));
  assert.deepEqual(recovery.previousPlacements[0].position, [7, 22.5, 0]);
});

test('registered upper-hall equipment footprints fit the historical bay with no unexplained body overlaps', () => {
  const items = EQUIPMENT.filter(item => item.floor === 6);
  const room = DRYER_UPPER_FLOORS[6].bounds;
  for (const item of items) {
    assert.equal(item.rotation, 0);
    assert.ok(item.position[0] - item.width / 2 >= room.minX && item.position[0] + item.width / 2 <= room.maxX, item.id);
    assert.ok(item.position[2] - item.depth / 2 >= room.minZ && item.position[2] + item.depth / 2 <= room.maxZ, item.id);
  }
  for (let a = 0; a < items.length; a++) for (let b = a + 1; b < items.length; b++) {
    const one = items[a], two = items[b];
    const dx = Math.abs(one.position[0] - two.position[0]), dz = Math.abs(one.position[2] - two.position[2]);
    assert.ok(dx >= (one.width + two.width) / 2 || dz >= (one.depth + two.depth) / 2, `${one.id} and ${two.id} overlap`);
  }
  assert.equal(DRYER_UPPER_FLOORS[6].width, 17.2);
  assert.equal(DRYER_UPPER_FLOORS[7].depth, 26.8);
  for (const id of [1, 2, 3]) {
    const floor = FLOORS.find(item => item.id === id);
    assert.equal(floor.width, 43, 'the architectural low-building envelope includes the whole side wing');
    assert.equal(floor.depth, 35);
  }
  for (const id of [4, 5]) {
    const floor = FLOORS.find(item => item.id === id);
    assert.equal(floor.width, 17.2, 'the low wing cannot silently become another upper tower floor');
    assert.equal(floor.depth, 26.8);
  }
});

test('the current mezzanine preserves its legacy key while old roof fixtures remain reference-only', () => {
  const second = FLOORS.find(item => item.id === 2);
  assert.equal(second.elevation, 3.8);
  assert.equal(second.displayLevel,1.5);
  assert.ok(second.rooms.some(room=>room.id==='dressing') && second.rooms.some(room=>room.id==='op'));
  assert.equal(second.partialFloor, true);
  assert.ok(second.voids.length > 0, 'the partial floor must retain its plan voids');
  assert.equal(EQUIPMENT.some(item => item.floor === 2), false);
  const third = FLOORS.find(item => item.id === 3);
  assert.ok(third.roofZones.length > 0, 'the broad low-building roof is distinct from the indoor tower');
  assert.equal(third.routeSurvey.smallerFloorPlateConfirmed,true);
  assert.equal(third.historicalFixtures,undefined);
  assert.ok(third.archivedDrawingFixtures.length > 0);
  for (const fixture of third.archivedDrawingFixtures) {
    assert.equal(fixture.historicalOnly, true);
    assert.equal(fixture.currentInstallationConfirmed, false);
    assert.equal(fixture.selectableEquipment, false);
    assert.equal(fixture.referenceOnly,true);
    assert.equal(EQUIPMENT.some(item => item.id === fixture.id), false, 'a historical drawing symbol cannot become a confirmed current installation');
  }
  assert.deepEqual(DRYER_UPPER_OBSERVED_EQUIPMENT.map(item => item.id), ['dryer-upper-duct-run', 'dryer-upper-tapered-housing']);
  for (const observed of DRYER_UPPER_OBSERVED_EQUIPMENT) {
    const item = EQUIPMENT.find(item => item.id === observed.id);
    assert.equal(item.floor, 7);
    assert.deepEqual(item.visibleFloors, [7]);
    assert.equal(item.positionConfidence, 'approximate');
    assert.ok(item.photos.length > 0);
  }
});

test('retained building drawings resolve locally while historical photo metadata remains intact', async () => {
  const siteRoot = await realpath(fileURLToPath(new URL('../apps/site/', import.meta.url)));
  const references = new Set();
  for (const floor of FLOORS) {
    assert.ok(floor.reference, `floor ${floor.id} needs an evidence reference`);
    references.add(floor.reference);
  }
  for (const item of EQUIPMENT) {
    assert.ok(item.photo && item.photos?.length, `equipment needs local evidence: ${item.id}`);
    references.add(item.photo);
    item.photos.forEach((reference) => references.add(reference));
  }
  assert.ok([...references].some(isRetainedEvidenceImage), 'architectural drawings remain available');
  assert.ok([...references].some(reference => !isRetainedEvidenceImage(reference)), 'retired photo metadata does not become a runtime asset');
  for (const reference of references) {
    assert.match(reference, /^\.\//, `evidence must be a site-local path: ${reference}`);
    if (!isRetainedEvidenceImage(reference)) continue;
    const resolved = path.resolve(siteRoot, reference);
    await access(resolved);
    const relative = path.relative(siteRoot, await realpath(resolved));
    assert.ok(relative && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative), reference);
  }
});
