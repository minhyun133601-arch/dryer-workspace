import test from 'node:test';
import assert from 'node:assert/strict';
import { WALK_RULES, createPersonState, advancePerson, lookPerson, isPersonPositionFree } from '../apps/site/person-walk.js';

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
const held = (state, options, count = 10) => {
  let result = state;
  for (let i = 0; i < count; i++) result = advancePerson(result, { delta: .1, ...options });
  return result;
};
const distanceFrames = (distance, fast = false) => Math.ceil(distance / ((fast ? WALK_RULES.fastSpeed : WALK_RULES.speed) * .1));

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
  const sliding = held(createPersonState({ yaw: Math.PI / 4 }), { forward: 1, obstacles: [wall] }, 20);
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
  state = held(state, { forward: 1, groundHeight }, 20);
  close(state.position[1], 1.8);
  state = held(state, { forward: -1, groundHeight }, 20);
  close(state.position[1], 0);
  const highWall = held(createPersonState(), { forward: 1, groundHeight: () => 3 });
  close(highWall.position[1], 0);
  close(highWall.position[2], 0);
  let falling = advancePerson(createPersonState({ position: [0, 2, 0] }), { delta: .1, groundHeight: () => 0 });
  assert.ok(falling.position[1] > 1.8 && falling.position[1] < 2, 'a ledge does not teleport the person to the floor');
  assert.ok(falling.verticalVelocity < 0);
  falling = held(falling, { groundHeight: () => 0 });
  close(falling.position[1], 0); close(falling.verticalVelocity, 0);
});

test('a body already overlapped by a moved wall can retreat without crossing its far face', () => {
  const wall={minX:0,maxX:.1,minZ:-2,maxZ:2};
  const state=createPersonState({position:[-.1,0,0],yaw:Math.PI/2});
  const farther=held(state,{forward:1,fast:true,obstacles:[wall]});
  close(farther.position[0],state.position[0]);
  const retreat=held(state,{forward:-1,obstacles:[wall]},distanceFrames(.6));
  assert.ok(retreat.position[0]<wall.minX-WALK_RULES.radius);
  assert.ok(isPersonPositionFree(retreat.position,{obstacles:[wall]}));
});

test('old positions outside revised floor bounds return at walking speed without teleporting', () => {
  const bounds={minX:-2,maxX:2,minZ:-2,maxZ:2};
  const state=createPersonState({position:[-5,0,0],yaw:Math.PI/2});
  const inward=advancePerson(state,{forward:1,delta:.1,bounds});
  close(inward.position[0],-5+WALK_RULES.speed*.1);
  const outward=advancePerson(state,{forward:-1,delta:.1,bounds});
  close(outward.position[0],-5);
  const returned=held(state,{forward:1,bounds},distanceFrames(8));
  close(returned.position[0],bounds.maxX-WALK_RULES.radius);
  const tight={minX:0,maxX:.2,minZ:-2,maxZ:2};
  const unchanged=advancePerson(state,{forward:1,delta:.1,bounds:tight});
  close(unchanged.position[0],state.position[0]);
});

test('complete-body clearance stops a fast approach to a thin closed door and permits the same opening after it moves', () => {
  let closed=true,queries=0;
  const canOccupy=(position,previous)=>{
    queries++;
    assert.notEqual(position,previous);
    assert.ok(Math.hypot(position[0]-previous[0],position[2]-previous[2])<=WALK_RULES.maxHorizontalStep+1e-8);
    return !closed || position[2]-WALK_RULES.radius>=.005;
  };
  const original=createPersonState({position:[0,0,.4]});
  const stopped=advancePerson(original,{forward:1,fast:true,delta:.1,canOccupy});
  assert.ok(stopped.position[2]>=WALK_RULES.radius+.005);
  assert.ok(stopped.position[2]<=WALK_RULES.radius+.005+WALK_RULES.maxHorizontalStep);
  assert.ok(queries>=Math.ceil(WALK_RULES.fastSpeed*.1/WALK_RULES.maxHorizontalStep),'clearance is checked throughout the delayed fast frame');
  closed=false;
  const passed=held(stopped,{forward:1,fast:true,canOccupy},distanceFrames(1.2,true));
  assert.ok(passed.position[2]<-.8,'the moved door no longer blocks the same doorway');
  assert.deepEqual(original.position,[0,0,.4]);
});

test('a rejected complete-body axis still slides along a wall and checks the next stair height before entering a low ceiling', () => {
  const sliding=held(createPersonState({yaw:Math.PI/4}),{forward:1,canOccupy:position=>position[0]+WALK_RULES.radius<=.4},distanceFrames(5));
  assert.ok(sliding.position[0]<=.1+1e-8);
  assert.ok(sliding.position[2]<-3,'wall clearance does not stop the unblocked axis');
  const groundHeight=([,,z])=>z<0?.18:0;
  let raisedQueries=0;
  const canOccupy=position=>{
    if(position[2]<0){raisedQueries++;close(position[1],.18);}
    return position[1]+WALK_RULES.height<=1.85;
  };
  const original=createPersonState({position:[0,0,.03]});
  const blocked=held(original,{forward:1,groundHeight,canOccupy});
  assert.ok(raisedQueries>0);
  assert.ok(blocked.position[2]>=0&&blocked.position[2]<=.03,'the person can approach but never enter the low-ceiling step');close(blocked.position[1],0);
  const climbed=advancePerson(original,{forward:1,delta:.1,groundHeight,canOccupy:()=>true});
  close(climbed.position[1],.18);assert.ok(climbed.position[2]<0);
});

test('body clearance also checks vertical settling and diagonal movement applies gravity only once', () => {
  const original=createPersonState({position:[0,2,0],yaw:Math.PI/4});
  const groundHeight=()=>0;
  const standing=advancePerson(original,{delta:.1,groundHeight});
  const diagonal=advancePerson(original,{forward:1,delta:.1,groundHeight,canOccupy:()=>true});
  close(diagonal.position[1],standing.position[1]);
  close(diagonal.verticalVelocity,standing.verticalVelocity);
  const blocked=held(original,{groundHeight,canOccupy:position=>position[1]>=1.9});
  assert.ok(blocked.position[1]>=1.9&&blocked.position[1]<2,'a lower obstruction also stops movement while the person is standing still');
  close(blocked.verticalVelocity,0);
});

test('fast movement follows narrow stair treads without skipping reachable risers at a delayed frame', () => {
  const stair = ([, , z]) => Math.min(2.34, Math.ceil(Math.max(0, -z) / .09) * .18);
  const original = createPersonState({ position: [0, 0, .03] });
  const delayed = advancePerson(original, { forward: 1, fast: true, delta: .1, groundHeight: stair });
  let fine = original;
  for (let i = 0; i < 20; i++) fine = advancePerson(fine, { forward: 1, fast: true, delta: .005, groundHeight: stair });
  close(delayed.position[1], .54);
  delayed.position.forEach((coordinate, index) => close(coordinate, fine.position[index]));
  close(delayed.verticalVelocity, 0);
});
