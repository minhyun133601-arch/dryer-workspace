import test from 'node:test';
import assert from 'node:assert/strict';
import { WALK_RULES, createPersonState, advancePerson, lookPerson, isPersonPositionFree } from '../apps/site/person-walk.js';

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
const held = (state, options, count = 10) => {
  let result = state;
  for (let i = 0; i < count; i++) result = advancePerson(result, { delta: .1, ...options });
  return result;
};

test('walking follows the avatar heading at a fixed floor height and never mutates saved poses', () => {
  const position = [4, 26.2, 8], original = createPersonState({ position });
  const walked = held(original, { forward: 1 });
  close(walked.position[0], 4); close(walked.position[1], 26.2); close(walked.position[2], 8 - WALK_RULES.speed);
  assert.deepEqual(original.position, position);
  assert.notEqual(original.position, position);
  const right = createPersonState({ position, yaw: Math.PI / 2 });
  const turned = held(right, { forward: 1 });
  close(turned.position[0], 4 + WALK_RULES.speed); close(turned.position[2], 8);
  const backward = held(right, { forward: -1 });
  close(backward.position[0], 4 - WALK_RULES.speed);
  close(WALK_RULES.eyeHeight + walked.position[1], 27.85);
});

test('held forward and turn controls have consistent motion across frame rates and recover from long pauses', () => {
  const original = createPersonState();
  const coarse = held(original, { forward: 1, turn: 1 });
  const fine = held(original, { forward: 1, turn: 1, delta: 1 / 120 }, 120);
  close(coarse.yaw, WALK_RULES.turnSpeed);
  coarse.position.forEach((coordinate, index) => close(coordinate, fine.position[index]));
  const resumed = advancePerson(original, { forward: 1, delta: 60 });
  close(resumed.position[2], -WALK_RULES.speed * WALK_RULES.maxDelta);
  const fast = held(original, { forward: 1, fast: true });
  close(fast.position[2], -WALK_RULES.fastSpeed);
  for (const delta of [0, -1, NaN, Infinity]) assert.deepEqual(advancePerson(original, { forward: 1, delta }), original);
});

test('floor boundaries stop the avatar radius while footprints block and slide without tunnelling', () => {
  const bounds = { minX: -2, maxX: 2, minZ: -2, maxZ: 2 };
  const stopped = held(createPersonState({ position: [0, 7.5, 0] }), { forward: 1, bounds }, 50);
  close(stopped.position[2], -2 + WALK_RULES.radius); close(stopped.position[1], 7.5);
  const obstacle = { minX: -1, maxX: 1, minZ: -.6, maxZ: -.59 };
  assert.equal(isPersonPositionFree([0, 0, 0], { bounds, obstacles: [obstacle] }), true);
  assert.equal(isPersonPositionFree([0, 0, -.5], { bounds, obstacles: [obstacle] }), false);
  assert.equal(isPersonPositionFree([2, 0, 0], { bounds }), false);
  const blocked = held(createPersonState(), { forward: 1, fast: true, obstacles: [obstacle] });
  close(blocked.position[2], obstacle.maxZ + WALK_RULES.radius);
  const wall = { minX: .4, maxX: .6, minZ: -10, maxZ: 10 };
  const sliding = held(createPersonState({ yaw: Math.PI / 4 }), { forward: 1, obstacles: [wall] });
  close(sliding.position[0], .4 - WALK_RULES.radius);
  assert.ok(sliding.position[2] < -1, 'the unblocked axis continues moving along the wall');
  const leaving = held(createPersonState({ position: [.5, 0, 0], yaw: Math.PI / 2 }), { forward: 1, obstacles: [wall] });
  assert.ok(leaving.position[0] > wall.maxX + WALK_RULES.radius, 'a newly placed footprint does not trap an existing person');
});

test('dragging changes yaw and pitch with bounded vertical gaze and ignores invalid data', () => {
  const original = createPersonState({ position: [1, 3, 2] });
  const look = lookPerson(original, 100, 50);
  close(look.yaw, 100 * WALK_RULES.lookSensitivity); close(look.pitch, -50 * WALK_RULES.lookSensitivity);
  assert.deepEqual(look.position, original.position);
  close(lookPerson(original, 0, -1e6).pitch, WALK_RULES.maxPitch);
  close(lookPerson(original, 0, 1e6).pitch, -WALK_RULES.maxPitch);
  assert.deepEqual(lookPerson(original, NaN, Infinity), original);
  assert.deepEqual(createPersonState({ position: [NaN, 0, 0], yaw: Infinity, pitch: NaN }), { position: [0, 0, 0], yaw: 0, pitch: 0, verticalVelocity: 0 });
});


test('ground sampling climbs only reachable steps, descends stairs and continues a gravity drop after movement stops', () => {
  const groundHeight = ([, , z]) => z >= 0 ? 0 : z > -2 ? Math.ceil(-z / .2) * .18 : 1.8;
  let state = createPersonState({ position: [0, 0, .1] });
  state = held(state, { forward: 1, groundHeight }, 14);
  close(state.position[1], 1.8);
  state = held(state, { forward: -1, groundHeight }, 14);
  close(state.position[1], 0);
  const highWall = held(createPersonState(), { forward: 1, groundHeight: () => 3 });
  close(highWall.position[1], 0);
  let falling = advancePerson(createPersonState({ position: [0, 2, 0] }), { delta: .1, groundHeight: () => 0 });
  assert.ok(falling.position[1] > 1.8 && falling.position[1] < 2, 'a ledge does not teleport the person to the floor');
  assert.ok(falling.verticalVelocity < 0);
  falling = held(falling, { groundHeight: () => 0 });
  close(falling.position[1], 0); close(falling.verticalVelocity, 0);
});

test('fast movement follows narrow stair treads without skipping reachable risers at a delayed frame', () => {
  const stair = ([, , z]) => Math.min(2.34, Math.ceil(Math.max(0, -z) / .09) * .18);
  const original = createPersonState({ position: [0, 0, .03] });
  const delayed = advancePerson(original, { forward: 1, fast: true, delta: .1, groundHeight: stair });
  let fine = original;
  for (let i = 0; i < 20; i++) fine = advancePerson(fine, { forward: 1, fast: true, delta: .005, groundHeight: stair });
  close(delayed.position[1], 2.34);
  delayed.position.forEach((coordinate, index) => close(coordinate, fine.position[index]));
  close(delayed.verticalVelocity, 0);
});
