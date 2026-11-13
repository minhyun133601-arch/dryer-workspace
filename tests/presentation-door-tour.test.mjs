import test from 'node:test';
import assert from 'node:assert/strict';
import { TOUR_STEPS, createPresentationTour } from '../apps/presentation/tour.js';

// Keep early opening and the moving door's threshold clearance independent.
function harness() {
  let clock = 0, frameId = 0, state, lastPose, resets = 0;
  const frames = new Map(), operations = [];
  const door = { id: 'reviewed-door', requestedOpen: false, progress: 0, nearAt: .05, threshold: .3 };
  const scene = {
    setPresentationPose(value) { lastPose = structuredClone(value); },
    setPresentationInspection() {},
    getPresentationDoorState(candidate) {
      const pose = candidate || lastPose;
      if (pose?.floor !== TOUR_STEPS[0].floor || (pose.walkDistance || 0) < door.nearAt) return null;
      return { id: door.id, label: '통과할 출입문', action: door.requestedOpen ? 'close' : 'open',
        blocked: (pose.walkDistance || 0) >= door.threshold && door.progress < .85, progress: door.progress, open: door.progress >= .85 };
    },
    interactPresentationDoor(id) {
      assert.equal(id, door.id); door.requestedOpen = !door.requestedOpen;
      operations.push({ id, at: clock, opened: door.requestedOpen, distance: lastPose?.walkDistance || 0 }); return true;
    },
    resetPresentationDoors() { resets++; door.requestedOpen = false; door.progress = 0; },
  };
  const tour = createPresentationTour({ scene, furnace: { open() {}, close() {}, setPresentationState() {} },
    onChange(value) { state = value; }, now: () => clock,
    requestFrame(callback) { const id = ++frameId; frames.set(id, callback); return id; }, cancelFrame(id) { frames.delete(id); },
  });
  function advance(seconds) {
    for (let remaining = seconds; remaining > 1e-8; remaining -= .05) {
      clock += Math.min(.05, remaining) * 1000;
      const pending = [...frames.values()]; frames.clear(); pending.forEach((callback) => callback(clock));
    }
  }
  function until(predicate, seconds = TOUR_STEPS[0].shots[0].duration + 1) {
    for (let remaining = seconds; remaining > 0 && !predicate(); remaining -= .05) advance(.05);
    assert.ok(predicate(), 'the expected state is reached within the reviewed walking shot');
  }
  return { tour, door, frames, operations, advance, until,
    get state() { return state; }, get pose() { return lastPose; }, get resets() { return resets; } };
}

test('doors open ahead once while walking without a control cue or scheduled operating pause', () => {
  const h = harness(); h.door.nearAt = 0; h.tour.restart();
  assert.equal(h.operations.length, 0, 'ready does not open doors');
  h.tour.play(); assert.equal(h.operations.length, 0);
  h.advance(.05);
  assert.equal(h.operations.length, 1, 'the first nearby playback frame opens the door immediately');
  assert.equal(h.operations[0].opened, true); assert.ok(h.operations[0].distance < h.door.threshold);
  assert.ok(h.state.elapsed > 0, 'walking progresses during early opening');
  assert.equal(h.state.waitingDoor, false); assert.equal(h.state.doorAction, null);
  const elapsed = h.state.elapsed; h.advance(.05);
  assert.ok(h.state.elapsed > elapsed); assert.equal(h.operations.length, 1);
  h.tour.dispose();
});

test('only an uncleared threshold stops camera time and walking continues when the leaf opens enough', () => {
  const h = harness(); h.tour.play(); h.until(() => h.operations.length === 1);
  assert.equal(h.state.waitingDoor, false, 'opening starts before a stop is needed');
  h.until(() => h.state.waitingDoor);
  const elapsed = h.state.elapsed, progress = h.state.progress, pose = structuredClone(h.pose);
  assert.ok(h.pose.walkDistance < h.door.threshold, 'a rejected step never crosses the moving leaf');
  assert.equal(h.state.status, 'playing'); assert.equal(h.state.doorAction, null);
  h.door.progress = .8; h.advance(2);
  assert.equal(h.state.elapsed, elapsed); assert.equal(h.state.progress, progress); assert.deepEqual(h.pose, pose);
  assert.equal(h.operations.length, 1, 'the moving leaf is not repeatedly toggled');
  h.door.progress = .9; h.advance(.1);
  assert.equal(h.state.waitingDoor, false); assert.ok(h.state.elapsed > elapsed);
  assert.ok(h.pose.walkDistance > pose.walkDistance); assert.equal(h.door.requestedOpen, true);
  h.tour.dispose();
});

test('an open door remains open through later walking segments and a return to its floor', () => {
  const h = harness(); h.door.requestedOpen = true; h.door.progress = 1;
  h.tour.play(); h.advance(TOUR_STEPS[0].shots[0].duration + .1);
  assert.equal(h.operations.length, 0); assert.equal(h.state.waitingDoor, false);
  const third = TOUR_STEPS.findIndex((step) => step.floor === 3);
  h.tour.seek(third); h.advance(.2); h.tour.seek(0); h.advance(.5);
  assert.equal(h.operations.length, 0, 'there are no repeated open/close requests');
  assert.equal(h.door.requestedOpen, true); assert.equal(h.door.progress, 1); h.tour.dispose();
});

test('pause and hidden-page handling retain the opening door without introducing a control cue on resume', () => {
  const h = harness(); h.tour.play(); h.until(() => h.state.waitingDoor);
  const elapsed = h.state.elapsed, pose = structuredClone(h.pose);
  h.tour.pause(); h.advance(10);
  assert.equal(h.state.status, 'paused'); assert.equal(h.state.elapsed, elapsed); assert.deepEqual(h.pose, pose);
  assert.equal(h.operations.length, 1); assert.equal(h.door.requestedOpen, true);
  h.door.progress = 1; h.tour.play(); h.advance(.05);
  assert.ok(h.state.elapsed > elapsed, 'the cleared door needs no extra operation pause');
  assert.equal(h.state.doorAction, null); assert.equal(h.operations.length, 1);
  h.tour.setActive(false); const inactive = h.state.elapsed; h.advance(4);
  assert.equal(h.tour.play(), false); h.tour.setActive(true); h.advance(1);
  assert.equal(h.state.status, 'paused'); assert.equal(h.state.elapsed, inactive);
  h.tour.play(); h.advance(.05); assert.equal(h.operations.length, 1); h.tour.dispose();
});

test('speed changes preserve the clearance guard and immediately affect walking after clearance', () => {
  const h = harness(); h.tour.play(); h.until(() => h.state.waitingDoor);
  const elapsed = h.state.elapsed, pose = structuredClone(h.pose);
  assert.equal(h.tour.setPlaybackRate(3), true); h.advance(1);
  assert.equal(h.state.elapsed, elapsed); assert.deepEqual(h.pose, pose);
  assert.equal(h.operations.length, 1); assert.equal(h.state.doorAction, null);
  assert.equal(h.state.playbackDuration, h.state.totalDuration / 3);
  h.door.progress = 1; h.advance(.2);
  assert.ok(Math.abs(h.state.elapsed - elapsed - .6) < 1e-7); h.tour.dispose();
});

test('seeking preserves opened leaves and restart resets them for the next show while retaining speed', () => {
  const h = harness(); h.tour.play(); h.until(() => h.state.waitingDoor); h.tour.setPlaybackRate(2);
  h.tour.seek(TOUR_STEPS.findIndex((step) => step.floor === 3));
  assert.equal(h.state.waitingDoor, false); assert.equal(h.state.doorInteraction, null);
  assert.equal(h.door.requestedOpen, true, 'seeking does not close a passed door');
  h.advance(.2); assert.equal(h.operations.length, 1); h.tour.restart();
  assert.equal(h.resets, 1); assert.equal(h.door.requestedOpen, false); assert.equal(h.door.progress, 0);
  assert.equal(h.state.status, 'ready'); assert.equal(h.state.elapsed, 0); assert.equal(h.state.playbackRate, 2);
  assert.equal(h.frames.size, 0); h.tour.play(); h.until(() => h.operations.length === 2);
  assert.equal(h.operations[1].opened, true); assert.equal(h.state.doorAction, null);
  h.tour.dispose(); assert.equal(h.frames.size, 0);
});
