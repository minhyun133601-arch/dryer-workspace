import test from 'node:test';
import assert from 'node:assert/strict';
import { TOUR_STEPS, createPresentationTour } from '../apps/presentation/tour.js';

function harness() {
  let clock = 0, id = 0, current;
  const callbacks = new Map(), poses = [], burner = [], shades = [], inspections = [], notifications = [];
  const furnace = { opened: false,
    open(value) { this.opened = true; burner.push(['open', value]); },
    close(value) { this.opened = false; burner.push(['close', value]); },
    setPresentationState(value) { burner.push(['state', value]); },
  };
  const tour = createPresentationTour({ scene: { setPresentationPose(value) { poses.push(value); }, setPresentationInspection(value) { inspections.push(value); } }, furnace,
    onChange: value => { current = value; notifications.push({ state: value, inspectionEnabled: inspections.at(-1) === true }); }, onTransition: value => shades.push(value), now: () => clock,
    requestFrame: callback => { const key = ++id; callbacks.set(key, callback); return key; }, cancelFrame: key => callbacks.delete(key),
  });
  function advance(seconds) {
    for (let remaining = seconds; remaining > .000001; remaining -= .05) {
      clock += Math.min(.05, remaining) * 1000;
      const pending = [...callbacks.values()]; callbacks.clear(); pending.forEach(callback => callback(clock));
    }
  }
  return { tour, furnace, poses, burner, shades, inspections, notifications, advance, callbacks, get state() { return current; } };
}

test('the rehearsal follows the dryer floors and roof, then ends with the assembled-to-exploded burner', () => {
  const h = harness();
  assert.equal(h.state.status, 'ready');
  assert.equal(h.state.inspecting, false);
  assert.ok(h.state.totalDuration >= 180 && h.state.totalDuration <= 238, 'normal walking, upper-floor stairs and roof inspection fit a three-to-four-minute show');
  for (const step of TOUR_STEPS.filter(value => value.shots)) assert.equal(step.shots.reduce((sum, value) => sum + value.duration, 0), step.duration);
  assert.deepEqual(TOUR_STEPS.map(step => step.floor), [1, 2, 3, 4, 5, 6, 7, 8, 7]);
  assert.equal(h.poses.at(-1).floor, 1);
  assert.equal(h.burner.some(([type]) => type === 'open'), false);
  assert.equal(TOUR_STEPS[1].caption, '생산 관찰 통로와 OP실');
  h.tour.play(); h.advance(h.state.totalDuration + .1);
  assert.equal(h.state.status, 'finished');
  assert.equal(h.state.progress, 1);
  assert.deepEqual([...new Set(h.poses.map(value => value.floor))], [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(h.burner.find(([type]) => type === 'open')[1], { spread: 0 });
  const spreads = h.burner.filter(([type]) => type === 'state').map(([, value]) => value.spread);
  assert.equal(spreads[0], 0); assert.equal(spreads.at(-1), 1);
  assert.ok(spreads.some(value => value > .1 && value < .9), 'disassembly unfolds over time');
  assert.deepEqual([...new Set(h.burner.filter(([type]) => type === 'state').map(([, value]) => value.partId).filter(Boolean))], ['1', 'B', 'E']);
  assert.equal(h.callbacks.size, 0, 'the last view holds without looping or navigating elsewhere');
  assert.equal(h.furnace.opened, false, 'the burner dialog gives way to manual building inspection');
  assert.equal(h.inspections.at(-1), true);
  assert.equal(h.state.inspecting, true);
  assert.equal(h.notifications.at(-1).inspectionEnabled, true, 'the completed state reaches the UI after free inspection is available');
  h.tour.dispose();
});

test('inspection can start before playback, survives rate and activity changes, and resumes at the saved time', () => {
  const h = harness(), initialPose = h.poses.at(-1);
  assert.equal(h.tour.inspect(), true);
  assert.equal(h.state.status, 'paused'); assert.equal(h.state.inspecting, true);
  assert.equal(h.state.elapsed, 0); assert.equal(h.state.stepIndex, 0);
  assert.equal(h.notifications.at(-1).inspectionEnabled, true);
  assert.equal(h.callbacks.size, 0); assert.equal(h.furnace.opened, false);
  const inspectionCalls = h.inspections.length, poseCount = h.poses.length, notificationCount = h.notifications.length;
  assert.equal(h.tour.inspect(), true);
  assert.equal(h.inspections.length, inspectionCalls, 'repeated inspection leaves the selected manual view untouched');
  assert.equal(h.notifications.length, notificationCount);
  h.tour.setPlaybackRate(2); h.advance(20);
  h.tour.setActive(false);
  assert.equal(h.tour.play(), false);
  assert.equal(h.state.inspecting, true); assert.equal(h.state.elapsed, 0);
  assert.equal(h.poses.length, poseCount, 'manual inspection is not overwritten by a pose or rate update');
  h.tour.setActive(true);
  assert.equal(h.state.inspecting, true);
  assert.equal(h.tour.play(), true);
  assert.equal(h.state.inspecting, false); assert.equal(h.inspections.at(-1), false);
  assert.deepEqual(h.poses.at(-1), initialPose);
  h.advance(1); assert.ok(Math.abs(h.state.elapsed - 2) < .00001);
  h.tour.dispose();
});

test('inspection pauses a running floor tour without losing its position, floor or playback rate', () => {
  const h = harness();
  h.tour.seek(3); h.tour.setPlaybackRate(1.5); h.tour.play(); h.advance(4);
  const { elapsed, stepIndex, playbackRate } = h.state, pose = h.poses.at(-1), poseCount = h.poses.length;
  h.tour.inspect(); h.advance(60);
  assert.equal(h.state.status, 'paused'); assert.equal(h.state.inspecting, true);
  assert.equal(h.state.elapsed, elapsed); assert.equal(h.state.stepIndex, stepIndex); assert.equal(h.state.playbackRate, playbackRate);
  assert.equal(h.callbacks.size, 0); assert.equal(h.poses.length, poseCount);
  assert.equal(h.state.waitingDoor, false); assert.equal(h.state.doorInteraction, null);
  h.tour.play();
  assert.equal(h.state.status, 'playing'); assert.equal(h.state.inspecting, false);
  assert.equal(h.state.elapsed, elapsed); assert.deepEqual(h.poses.at(-1), pose);
  h.advance(1); assert.ok(Math.abs(h.state.elapsed - elapsed - 1.5) < .00001);
  h.tour.dispose();
});

test('inspection closes the burner and restores its saved part and spread on resume, while navigation clears inspection', () => {
  const h = harness();
  h.tour.seek(TOUR_STEPS.length - 1); h.tour.play(); h.advance(9);
  const elapsed = h.state.elapsed, burnerState = h.burner.at(-1)[1];
  assert.equal(burnerState.partId, '1');
  h.tour.inspect();
  assert.equal(h.furnace.opened, false); assert.deepEqual(h.burner.at(-1), ['close', { notify: false }]);
  const burnerCalls = h.burner.length;
  h.tour.setPlaybackRate(3); h.advance(10);
  assert.equal(h.burner.length, burnerCalls); assert.equal(h.state.elapsed, elapsed);
  h.tour.play();
  assert.equal(h.furnace.opened, true); assert.deepEqual(h.burner.at(-1)[1], burnerState);
  assert.equal(h.state.elapsed, elapsed); assert.equal(h.state.inspecting, false);
  h.tour.inspect(); h.tour.seek(1);
  assert.equal(h.state.status, 'paused'); assert.equal(h.state.inspecting, false);
  assert.equal(h.inspections.at(-1), false); assert.equal(h.furnace.opened, false);
  assert.equal(h.poses.at(-1).floor, 2);
  h.tour.inspect(); h.tour.restart();
  assert.equal(h.state.status, 'ready'); assert.equal(h.state.inspecting, false);
  assert.equal(h.state.elapsed, 0); assert.equal(h.state.playbackRate, 3);
  assert.equal(h.inspections.at(-1), false); assert.equal(h.poses.at(-1).floor, 1);
  h.tour.inspect(); h.tour.dispose();
  const count = h.notifications.length;
  assert.equal(h.tour.inspect(), false); assert.equal(h.tour.play(), false);
  assert.equal(h.notifications.length, count); assert.equal(h.callbacks.size, 0);
});

test('pause and inactivity retain the exact camera time and never skip hidden-tab content', () => {
  const h = harness();
  h.tour.play(); h.advance(12);
  h.tour.pause();
  const elapsed = h.state.elapsed, pose = h.poses.at(-1);
  h.advance(90);
  assert.equal(h.state.elapsed, elapsed); assert.equal(h.poses.at(-1), pose);
  h.tour.play(); h.advance(1); assert.ok(h.state.elapsed > elapsed);
  h.tour.setActive(false);
  const inactive = h.state.elapsed;
  assert.equal(h.state.status, 'paused'); assert.equal(h.tour.play(), false);
  h.advance(60); h.tour.setActive(true);
  assert.equal(h.state.elapsed, inactive); assert.equal(h.state.status, 'paused');
  h.tour.play(); h.advance(1); assert.ok(h.state.elapsed < inactive + 1.1);
  h.tour.dispose();
});

test('scene seeking, restarting and reopening the burner produce deterministic reviewable views', () => {
  const h = harness();
  assert.equal(h.tour.seek(TOUR_STEPS.length), false); assert.equal(h.tour.seek(-1), false);
  h.tour.seek(TOUR_STEPS.length - 1);
  assert.equal(h.state.status, 'paused'); assert.equal(h.furnace.opened, true);
  assert.equal(h.poses.at(-1).floor, 7, 'a direct jump to the burner retains the real seventh-floor approach underneath its dialog');
  assert.equal(h.burner.at(-1)[1].spread, 0);
  h.tour.play(); h.advance(5); h.tour.pause();
  const spread = h.burner.at(-1)[1].spread;
  h.furnace.opened = false;
  h.tour.play(); assert.equal(h.furnace.opened, true);
  assert.equal(h.burner.at(-1)[1].spread, spread);
  h.tour.seek(2);
  assert.equal(h.state.status, 'playing'); assert.equal(h.furnace.opened, false);
  assert.equal(h.poses.at(-1).floor, 3);
  h.tour.restart();
  assert.equal(h.state.status, 'ready'); assert.equal(h.state.elapsed, 0);
  assert.equal(h.inspections.at(-1), false, 'restarting restores the walking camera and locks manual input');
  assert.equal(h.poses.at(-1).floor, 1); assert.equal(h.callbacks.size, 0);
  h.tour.dispose(); assert.equal(h.tour.play(), false);
});

test('room cuts fade while the confirmed stairs continuously connect their actual floor elevations', () => {
  const h = harness();
  h.tour.play(); h.advance(TOUR_STEPS[0].shots[0].duration + .05);
  assert.ok(h.shades.some(value => value.active));
  assert.ok(Math.abs(h.poses.at(-1).position[0] - TOUR_STEPS[0].shots[1].from.position[0]) < .1, 'the next inspected walking segment begins without interpolating through the intervening room');
  h.advance(.3); assert.equal(h.shades.at(-1).active, false);
  for (const step of TOUR_STEPS.filter(step => step.kind === 'walk')) for (const shot of step.shots) {
    for (const value of shot.path || [shot.from, shot.to]) {
      assert.ok([...value.position, ...value.lookAt].every(Number.isFinite));
      const elevation = ({ 1: .3, 2: 3.8, 3: 7.3, 4: 13.3, 5: 20.2, 6: 26.2, 7: 32.6, 8: 32.6 })[step.floor];
      if (shot.stairs) assert.ok(value.position[1] >= elevation - 1e-8 && value.position[1] <= elevation + (step.floor === 6 ? 6.4 : 3.5) + 1e-8);
      else assert.equal(value.position[1], elevation);
    }
    const path = shot.path || [shot.from, shot.to];
    if (shot.stairs) {
      assert.ok(path.at(-1).position[1] > path[0].position[1], 'stairs raise the eye with the real ascending path');
      assert.ok(path.slice(1).every((point, index) => point.position[1] >= path[index].position[1]), 'stairs rise through their treads and level return landings');
    } else assert.ok(path.every(point => point.position[1] === path[0].position[1]), 'other walks stay on their actual floor');
  }
  assert.deepEqual(TOUR_STEPS.filter(step => step.shots?.some(shot => shot.stairs)).map(step => step.floor), [1, 2, 6]);
  const stairs = TOUR_STEPS.find(step => step.floor === 6).shots.at(-1), seventh = TOUR_STEPS.find(step => step.floor === 7).shots[0];
  assert.deepEqual(stairs.to.position, seventh.from.position, 'the seventh-floor walk begins at the actual top landing');
  const roof = TOUR_STEPS.find(step => step.floor === 8);
  assert.match(roof.shots.map(shot => shot.caption).join(' '), /물탱크.*엘리베이터 기계실/);
  h.tour.dispose();
});

test('changing playback speed preserves the current walking position and applies immediately without restarting', () => {
  const h = harness();
  h.tour.play(); h.advance(2);
  const before = h.state.elapsed, pose = h.poses.at(-1);
  assert.equal(h.tour.setPlaybackRate(2), true);
  assert.equal(h.state.elapsed, before); assert.deepEqual(h.poses.at(-1), pose);
  assert.equal(h.state.playbackRate, 2); assert.equal(h.state.playbackDuration, h.state.totalDuration / 2);
  h.advance(1); assert.ok(Math.abs(h.state.elapsed - (before + 2)) < .00001);
  h.tour.pause();
  const paused = h.state.elapsed;
  h.tour.setPlaybackRate(3); h.advance(8);
  assert.equal(h.state.elapsed, paused);
  assert.equal(h.state.remainingDuration, (h.state.totalDuration - paused) / 3);
  h.tour.play(); h.advance(1); assert.ok(Math.abs(h.state.elapsed - (paused + 3)) < .00001);
  for (const invalid of [0, -1, 4, NaN, Infinity, '2']) assert.equal(h.tour.setPlaybackRate(invalid), false);
  assert.equal(h.state.playbackRate, 3);
  h.tour.restart(); assert.equal(h.state.playbackRate, 3, 'restarting retains the chosen speed');
  h.tour.dispose();
});

test('faster shows still visit every floor and complete disassembly before enabling free inspection', () => {
  for (const rate of [.5, 1.5, 2, 3]) {
    const h = harness();
    h.tour.setPlaybackRate(rate); h.tour.play(); h.advance(h.state.totalDuration / rate + .1);
    assert.equal(h.state.status, 'finished', `${rate}x completes in the advertised time`);
    assert.deepEqual([...new Set(h.poses.map(value => value.floor))], [1, 2, 3, 4, 5, 6, 7, 8]);
    assert.equal(h.burner.filter(([type]) => type === 'state').at(-1)[1].spread, 1);
    assert.equal(h.inspections.at(-1), true);
    assert.equal(h.callbacks.size, 0);
    h.tour.dispose();
  }
});
