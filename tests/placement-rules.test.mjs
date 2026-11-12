import test from 'node:test';
import assert from 'node:assert/strict';
import { PLACEMENT_RULES, PLACEMENT_REGIONS, toRoomPosition, fromRoomPosition, rotatedFootprint, constrainPlacement } from '../apps/site/placement-rules.js';

const yaw = 35 * Math.PI / 180;
const room = { anchor: [-13.92, 0, 13.92], rotation: yaw };
const epsilon = 1e-7;
const close = (a, b) => assert.ok(Math.abs(a - b) < epsilon, `${a} != ${b}`);
function inside(result, footprint, region, rotation = 0) {
  const local = ['building', 'upper', 'roof'].includes(result.region) ? result.position : toRoomPosition(result.position, room);
  const shape = rotatedFootprint(footprint, result.rotation, rotation);
  assert.ok(local[0] + shape.minX >= region.minX - epsilon);
  assert.ok(local[0] + shape.maxX <= region.maxX + epsilon);
  assert.ok(local[2] + shape.minZ >= region.minZ - epsilon);
  assert.ok(local[2] + shape.maxZ <= region.maxZ + epsilon);
}

test('rotated outdoor room coordinates round trip and snap equipment to one shared grid', () => {
  const original = [2.5, 0, -5.75];
  const item = { id: 'outdoor-100rt', floor: 'outdoor', position: fromRoomPosition(original, room), rotation: yaw + Math.PI / 2 };
  const footprint = { minX: -1.75, maxX: 1.75, minZ: -1.2, maxZ: 1.2 };
  const baseline = constrainPlacement(item, item, { footprint, room });
  assert.equal(baseline.valid, true); assert.equal(baseline.limited, false);
  baseline.position.forEach((value, index) => close(value, item.position[index]));
  const requested = { position: fromRoomPosition([1.99, 123, -5.31], room), rotation: item.rotation + 19 * Math.PI / 180 };
  const result = constrainPlacement(item, requested, { footprint, room });
  assert.equal(result.snapped, true); assert.equal(result.position[1], 0);
  const snapped = toRoomPosition(result.position, room);
  close(snapped[0] / PLACEMENT_RULES.step, Math.round(snapped[0] / PLACEMENT_RULES.step));
  close(snapped[2] / PLACEMENT_RULES.step, Math.round(snapped[2] / PLACEMENT_RULES.step));
  close(result.rotation, item.rotation + Math.PI / 12);
  inside(result, footprint, PLACEMENT_REGIONS.apron, yaw);
});

test('100RT can approach the back wall but its rotated footprint cannot pass either retaining wall', () => {
  const item = { id: 'outdoor-100rt', floor: 'outdoor', position: fromRoomPosition([2.4, 0, -5.7], room), rotation: yaw + Math.PI / 2 };
  const footprint = { minX: -1.75, maxX: 1.75, minZ: -1.2, maxZ: 1.2 };
  for (const angle of [0, 15, 45, 90, 135]) {
    const result = constrainPlacement(item, { position: fromRoomPosition([-1000, 0, -1000], room), rotation: item.rotation + angle * Math.PI / 180 }, { footprint, room });
    assert.equal(result.valid, true); assert.equal(result.limited, true);
    inside(result, footprint, PLACEMENT_REGIONS.apron, yaw);
  }
  const moved = constrainPlacement(item, { position: fromRoomPosition([-1, 0, -5.7], room), rotation: item.rotation }, { footprint, room });
  assert.ok(toRoomPosition(moved.position, room)[0] < 0, 'the correction toward the sunlit back wall must remain possible');
});

test('building edits and imports retain the floor and keep a long rotated body within the drawn deck', () => {
  const item = { id: 'dryer', floor: 7, position: [1.5, 32.6, -2.5], rotation: 0 };
  const footprint = { minX: -3.5, maxX: 3.5, minZ: -1.1, maxZ: 1.1 };
  const result = constrainPlacement(item, { position: [999, -500, 999], rotation: Math.PI / 2 + .1 }, { footprint, room });
  assert.equal(result.position[1], 32.6); close(result.rotation, Math.PI / 2);
  assert.equal(result.region, 'upper'); assert.equal(result.limited, true);
  inside(result, footprint, PLACEMENT_REGIONS.upper);
  const invalid = constrainPlacement(item, { position: [0, 0, 0], rotation: NaN }, { footprint });
  assert.equal(invalid.valid, false); assert.deepEqual(invalid.position, item.position);
  const impossible = constrainPlacement(item, item, { footprint: { minX: -99, maxX: 99, minZ: -99, maxZ: 99 } });
  assert.equal(impossible.valid, false); assert.equal(impossible.reason, 'footprint-too-large');
});
