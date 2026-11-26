// Fixed rehearsal shots use feet positions in the model's own coordinates.
// Confirmed stairs use the model's real treads and landings. Separate inspected
// rooms and unverified upper connections change behind a short fade.
import { FLOORS } from '../site/building-data.js';
import { dryerStairWalkPoints } from '../site/dryer-building-data.js';
import { UPPER_STAIR_PATH } from './upper-route.js';

const pose = (position, lookAt) => ({ position, lookAt });
const shot = (duration, from, to = from, caption) => ({ duration, from, to, caption });
const pathShot = (duration, path, caption, extra = {}) => ({ ...shot(duration, path[0], path.at(-1), caption), path, ...extra });
const stairPath = points => points.map((position, index) => {
  const next = points[index + 1] || position.map((value, axis) => value + position[axis] - points[index - 1][axis]);
  const dx = next[0] - position[0], dz = next[2] - position[2], length = Math.hypot(dx, dz) || 1;
  return pose(position, [position[0] + dx / length * 3, position[1] + 1, position[2] + dz / length * 3]);
});
const entryFloor = FLOORS.find(floor => floor.id === 1), mezzanineFloor = FLOORS.find(floor => floor.id === 2);
const entryStair = stairPath([[33.75, .3, 18.1], ...dryerStairWalkPoints(entryFloor.stairs[0], entryFloor), [33.7, 3.8, 17.8]]);
entryStair.at(-1).lookAt = [27, 5.45, 17.8];
const upperStair = stairPath([[-7, 3.8, -5.3], [-7.785, 3.8, -7.4], [-7.785, 3.8, -8.55], [-7.3, 3.8, -8.95],
  ...dryerStairWalkPoints(mezzanineFloor.stairs[0], mezzanineFloor), [-7.785, 7.3, -8.2], [-7.785, 7.3, -7.2]]);
upperStair.at(-1).lookAt = [-4, 8.95, -5.4];
const hallStair = stairPath(UPPER_STAIR_PATH);
hallStair.at(-1).lookAt = [-1, 32.7, 7.5];
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};

export const TOUR_STEPS = freeze([
  { id: 'entry', floor: 1, kind: 'walk', title: '1층 · 조제·충전·외포장', caption: '조제·충전·외포장 설비', duration: 38,
    shots: [
      { ...shot(8, pose([33.7, .3, 17.6], [28, 1.95, 17.6]), pose([24.5, .3, 17.6], [21, 2.1, 14.5]), '위생 전실과 조제실'), path: [
        pose([33.7, .3, 17.6], [28, 1.95, 17.6]), pose([30.5, .3, 17.6], [26, 1.95, 17.6]),
        pose([27.6, .3, 17.6], [24, 2.1, 16]), pose([24.5, .3, 17.6], [21, 2.1, 14.5]),
      ] },
      shot(5, pose([26.6, .3, 3.2], [26.6, 1.95, 11.2]), pose([26.6, .3, 7.2], [26.6, 1.95, 11.2]), '원료계량창고와 조제실'),
      shot(4, pose([23.7, .3, 8.7], [22.1, 1.4, 6.4]), pose([23.7, .3, 8.3], [22.1, 1.4, 6.4]), '원료 투입부'),
      pathShot(5, [pose([19.1, .3, 18.4], [20, 1.1, 20]), pose([18.2, .3, 19.5], [14, 1.95, 19.5]),
        pose([15.2, .3, 19.5], [10, 2.1, 16])], '균질기와 외포장실 출입구'),
      shot(4, pose([4, .3, 18.9], [-2, 1.8, 13]), pose([1, .3, 18.9], [-3, 1.9, 20.5]), '외포장 설비와 연결 계단'),
      pathShot(12, entryStair, '1.5층 연결 계단', { stairs: true }),
    ] },
  { id: 'mezzanine', floor: 2, kind: 'walk', title: '1.5층 · 관찰 통로와 OP실', caption: '생산 관찰 통로와 OP실', duration: 66,
    shots: [
      pathShot(31, [pose([33.7, 3.8, 17.8], [27, 5.45, 17.8]), pose([30.4, 3.8, 17.8], [24, 5.45, 17.8]), pose([12, 3.8, 17.8], [5, 5.3, 18.7]),
        pose([-.5, 3.8, 17.8], [-5, 5.45, 17.8]), pose([-4.75, 3.8, 17.8], [-2.5, 3.0, 20]), pose([-7, 3.8, 17.8], [-7, 5.45, 12])], '생산 관찰 통로'),
      pathShot(8, [pose([-7, 3.8, 17.8], [-7, 5.45, 12]), pose([-7, 3.8, 12.25], [-4.5, 5.45, 12.25]),
        pose([-4.1, 3.8, 12.2], [-1.5, 5.2, 9]), pose([-3.7, 3.8, 9.1], [-.5, 5.1, 5.8])], 'OP실'),
      shot(2, pose([-3.7, 3.8, 9.1], [-.5, 5.1, 5.8]), pose([-3.7, 3.8, 9.1], [-6.7, 5.45, 9.1]), 'OP실 조작·관찰 공간'),
      pathShot(11, [pose([-3.7, 3.8, 9.1], [-6.7, 5.45, 9.1]), pose([-4.1, 3.8, 12.2], [-7, 5.45, 12.25]), pose([-6.4, 3.8, 12.25], [-9, 5.45, 12.25]), pose([-7, 3.8, 11], [-7, 5.2, 2]),
        pose([-7, 3.8, 1], [-.7, 2.4, -1]), pose([-7, 3.8, -5.3], [-7, 5.45, -8.5])], '생산설비 관찰 구간'),
      pathShot(14, upperStair, '3층 연결 계단', { stairs: true }),
    ] },
  { id: 'third', floor: 3, kind: 'walk', title: '3층 · 타워 설비 홀', caption: '작업 구역 연결문과 디스크 컨베이어', duration: 18,
    shots: [
      pathShot(8, [
        pose([-7.785,7.3,-7.2],[-4,8.95,-5.4]),
        pose([-5.6,7.3,-5.5],[-1.9,8.9,-3.6]),
        pose([-2.5,7.3,-4.7],[-1.9,8.8,-1]),
        pose([-2.5,7.3,-.75],[-.2,8.9,.9]),
        pose([-.2,7.3,-.6],[-.2,8.9,2]),
        pose([-.2,7.3,1.5],[0,8.7,5.4]),
      ], '흰 판넬벽 연결문과 공정실 제어함'),
      pathShot(10, [
        pose([-.2,7.3,1.5],[0,8.7,5.4]),
        pose([-.2,7.3,-.6],[-1.6,8.9,-3]),
        pose([-2.5,7.3,-.75],[-1.6,8.9,-5]),
        pose([-2.5,7.3,-4.9],[1.5,9.9,-3]),
        pose([2,7.3,-5.1],[3,9.15,-3]),
        pose([6.2,7.3,-5.1],[6.9,8.45,-3.1]),
        pose([7.6,7.3,-5.6],[5.4,8.55,-3]),
        pose([6.8,7.3,-9],[5.4,8.55,-3]),
      ], '엘리베이터 앞 구동부 두 대와 이송로 네 열'),
    ] },
  { id: 'fourth', floor: 4, kind: 'walk', title: '4층 · V/F와 화인리턴', caption: 'V/F 수평 장치와 화인리턴', duration: 10,
    shots: [shot(10, pose([.2, 13.3, 7], [-4.4, 15.2, -1.7]), pose([.2, 13.3, 4], [4.9, 15.3, -3.1]))] },
  { id: 'fifth', floor: 5, kind: 'walk', title: '5층 · 챔버 하부', caption: '챔버 하부 콘과 연결 구조', duration: 10,
    shots: [shot(10, pose([7, 20.2, 9.6], [-1, 23.2, 7.5]), pose([7, 20.2, 6.6], [-1, 24.4, 7.5]))] },
  { id: 'sixth', floor: 6, kind: 'walk', title: '6층 · 건조 설비 홀', caption: '송풍기·챔버·버너·현장 제어반', duration: 34,
    shots: [
      shot(8, pose([6.8, 26.2, -8], [1.4, 28.4, -10.9]), pose([6.8, 26.2, -5], [1.4, 28.5, -10.9]), '송풍기와 사이클론'),
      shot(10, pose([6.9, 26.2, .1], [-1, 29.8, 7.5]), pose([6.9, 26.2, 2.9], [3.4, 29.0, -3.5]), '챔버·버너·현장 제어반'),
      pathShot(16, hallStair, '7층 연결 계단', { stairs: true }),
    ] },
  { id: 'seventh', floor: 7, kind: 'walk', title: '7층 · 챔버 상부와 버너', caption: '챔버 상부 관찰 웰과 버너', duration: 18,
    shots: [
      pathShot(10, [pose([7.54, 32.6, 9.2], [-1, 32.7, 7.5]), pose([7.54, 32.6, 9.5], [-1, 32.7, 7.5]),
        pose([5.5, 32.6, 9.5], [-1, 32.7, 7.5]), pose([5.5, 32.6, 3.3], [-1, 32.7, 7.5])], '챔버 상부 관찰 웰'),
      pathShot(8, [pose([5.5, 32.6, 3.3], [-1, 32.7, 7.5]), pose([7.75, 32.6, 3.3], [3.4, 30.3, -3.5]),
        pose([7.75, 32.6, -5.8], [3.4, 30, -3.5])], '버너와 상부 점검 통로'),
    ] },
  { id: 'roof', floor: 8, kind: 'walk', title: '옥상 · 서비스 구역과 엘리베이터실', caption: '옥상 설비와 엘리베이터 기계실', duration: 24,
    shots: [
      pathShot(13, [pose([7.9, 32.6, -7.6], [1.1, 35, -10.5]), pose([3, 32.6, -7.6], [1.1, 35, -10.5]),
        pose([-3, 32.6, -7.6], [-6, 33.8, -10.2])], '옥상 원통형 설비와 물탱크'),
      pathShot(11, [pose([-3, 32.6, -7.6], [-6, 33.8, -10.2]), pose([3, 32.6, -7.6], [6.75, 34, -9.3]),
        pose([6.75, 32.6, -7.8], [5, 34, -11]), pose([6.75, 32.6, -9.65], [5, 34, -11]),
        pose([7.15, 32.6, -9.65], [4.95, 33.8, -9.8]), pose([6.15, 32.6, -9.65], [5, 34, -11])], '엘리베이터 기계실 내부'),
    ] },
  { id: 'burner', floor: 7, kind: 'burner', title: '버너 · 조립과 분해', caption: '버너 조립 상태와 주요 부품', duration: 18,
    approach: pose([7.75, 32.6, -5.8], [3.4, 30, -3.5]) },
]);

const mix = (a, b, t) => a.map((value, index) => value + (b[index] - value) * t);
const smooth = t => { const x = Math.max(0, Math.min(1, t)); return x * x * (3 - 2 * x); };
const total = TOUR_STEPS.reduce((sum, step) => sum + step.duration, 0);
const starts = TOUR_STEPS.map((_, index) => TOUR_STEPS.slice(0, index).reduce((sum, step) => sum + step.duration, 0));
const playbackRates = [.5, 1, 1.5, 2, 3];
const burnerSpread = local => smooth((local - 2) / 6);
function walkingPose(current, progress) {
  const path = current.path || [current.from, current.to];
  const distances = path.slice(1).map((point, index) => Math.hypot(...point.position.map((value, axis) => value - path[index].position[axis])));
  const lengths = distances.map((distance, index) => {
    if (distance > .00001) return distance;
    const direction = point => point.lookAt.map((value, axis) => value - point.position[axis] - (axis === 1 ? 1.65 : 0));
    const a = direction(path[index]), b = direction(path[index + 1]), divisor = Math.hypot(...a) * Math.hypot(...b);
    return divisor > .00001 ? Math.acos(Math.max(-1, Math.min(1, a.reduce((sum, value, axis) => sum + value * b[axis], 0) / divisor))) * .8 : 0;
  });
  const duration = lengths.reduce((sum, value) => sum + value, 0);
  let remaining = duration * progress, index = 0;
  for (; index < lengths.length - 1 && remaining > lengths[index]; index++) remaining -= lengths[index];
  const t = lengths[index] > 0 ? Math.min(1, remaining / lengths[index]) : progress;
  return { position: mix(path[index].position, path[index + 1].position, t), lookAt: mix(path[index].lookAt, path[index + 1].lookAt, t), walkDistance: distances.slice(0, index).reduce((sum, value) => sum + value, 0) + distances[index] * t };
}

function walkingSample(at) {
  let stepIndex = TOUR_STEPS.findIndex((step, index) => at < starts[index] + step.duration);
  if (stepIndex < 0) stepIndex = TOUR_STEPS.length - 1;
  const step = TOUR_STEPS[stepIndex], local = Math.min(step.duration, Math.max(0, at - starts[stepIndex]));
  if (step.kind !== 'walk') return { stepIndex, step, local };
  let offset = 0, shotIndex = step.shots.length - 1;
  for (let index = 0; index < step.shots.length; index++) {
    if (local < offset + step.shots[index].duration) { shotIndex = index; break; }
    offset += step.shots[index].duration;
  }
  if (local >= step.duration) offset = step.duration - step.shots[shotIndex].duration;
  const current = step.shots[shotIndex], progress = Math.max(0, Math.min(1, (local - offset) / current.duration));
  return { stepIndex, step, local, shotIndex, current, key: `${stepIndex}:${shotIndex}`, pose: { floor: step.floor, ...walkingPose(current, progress) } };
}

export function createPresentationTour({ scene, furnace, onChange = () => {}, onTransition = () => {},
  now = () => performance.now(), requestFrame = callback => requestAnimationFrame(callback), cancelFrame = id => cancelAnimationFrame(id) } = {}) {
  let elapsed = 0, playbackRate = 1, status = 'ready', active = true, inspecting = false, disposed = false, frame = null, lastTime = null;
  let enteredStep = -1, enteredShot = -1, transitionKey = '', transitionUntil = -1, transitionActive = false;
  let caption = TOUR_STEPS[0].caption, title = TOUR_STEPS[0].title;
  let stepIndex = 0, doorInteraction = null, doorWait = null, doorAction = null, lastPose = null;
  const state = () => ({ status, inspecting, stepIndex, step: TOUR_STEPS[stepIndex], title, caption, elapsed,
    doorInteraction, waitingDoor: !!doorWait, doorAction,
    totalDuration: total, progress: elapsed / total, playbackRate,
    playbackDuration: total / playbackRate, playbackElapsed: elapsed / playbackRate, remainingDuration: (total - elapsed) / playbackRate });
  function notify() { onChange(state()); }
  function shade(value) {
    if (value === transitionActive) return;
    transitionActive = value; onTransition({ active: value });
  }
  function stopFrame() { if (frame !== null) cancelFrame(frame); frame = null; lastTime = null; }
  function clearDoorWait() { doorWait = null; doorAction = null; }
  // Open the doorway ahead smoothly once, without button prompts or closing it
  // again. The threshold guard only prevents walking through a moving leaf.
  function waitForDoor(candidate) {
    if (!candidate.pose || candidate.key !== transitionKey) { clearDoorWait(); return false; }
    let door = scene.getPresentationDoorState?.(candidate.pose);
    if (door?.action === 'open') {
      scene.interactPresentationDoor?.(door.id);
      door = scene.getPresentationDoorState?.(candidate.pose) || door;
    }
    doorInteraction = door || null; doorAction = null;
    doorWait = door?.blocked ? { id: door.id } : null;
    return !!doorWait;
  }
  function render({ fade = true } = {}) {
    const sample = walkingSample(elapsed);
    stepIndex = sample.stepIndex;
    const { step, local } = sample;
    const entering = enteredStep !== stepIndex;
    title = step.title; caption = step.caption;
    if (entering) {
      enteredStep = stepIndex; enteredShot = -1;
      if (step.kind !== 'burner') furnace?.close({ notify: false });
    }
    if (step.kind === 'burner') {
      clearDoorWait(); doorInteraction = null;
      if (entering) {
        const approach = step.approach || TOUR_STEPS[stepIndex - 1].shots.at(-1).to;
        scene.setPresentationPose({ floor: 7, position: [...approach.position], lookAt: [...approach.lookAt] });
        furnace?.open({ spread: 0 });
      }
      let spread = burnerSpread(local), partId = null;
      if (local < 2) caption = '버너 조립 상태';
      else if (local < 8) caption = '버너 주요 부품 분해';
      else if (local < 11) { partId = '1'; caption = '주 가스 배관'; }
      else if (local < 14) { partId = 'B'; caption = '분기 헤더'; }
      else if (local < 17) { partId = 'E'; caption = 'H형 버너 헤드'; }
      else caption = '버너 구조 확인';
      furnace?.setPresentationState({ spread, partId, view: 'iso' });
      shade(false);
    } else {
      const { current, shotIndex, key } = sample;
      if (key !== transitionKey) {
        transitionKey = key;
        const distance = lastPose ? Math.hypot(...sample.pose.position.map((value, axis) => value - lastPose.position[axis])) : 0;
        transitionUntil = fade && distance > .6 ? elapsed + .15 : -1;
        enteredShot = shotIndex;
      }
      shade(status === 'playing' && elapsed < transitionUntil);
      scene.setPresentationPose(sample.pose);
      lastPose = sample.pose;
      if (!doorWait) doorInteraction = scene.getPresentationDoorState?.() || null;
      caption = current.caption || step.caption;
    }
    if (status === 'finished') {
      clearDoorWait(); doorInteraction = null;
      title = '건조기 시연을 마쳤습니다'; caption = '층과 시점을 선택해 평면·입체로 직접 둘러보세요.';
      furnace?.close({ notify: false }); inspecting = true; scene.setPresentationInspection?.(true);
    }
    notify();
  }
  function schedule() { if (frame === null && active && status === 'playing' && !disposed) frame = requestFrame(tick); }
  function tick(timestamp) {
    frame = null;
    if (!active || status !== 'playing' || disposed) { lastTime = null; return; }
    const at = Number.isFinite(timestamp) ? timestamp : now();
    if (lastTime !== null) {
      const next = Math.min(total, elapsed + Math.max(0, Math.min(.25, (at - lastTime) / 1000)) * playbackRate);
      if (!waitForDoor(walkingSample(next))) elapsed = next;
    }
    lastTime = at;
    if (elapsed >= total) { status = 'finished'; lastTime = null; }
    render();
    schedule();
  }
  const controller = {
    play() {
      if (disposed || !active) return false;
      if (status === 'finished') controller.restart();
      const wasInspecting = inspecting;
      if (wasInspecting) {
        inspecting = false; scene.setPresentationInspection?.(false);
        enteredStep = -1; enteredShot = -1; transitionKey = '';
      }
      if (!wasInspecting && TOUR_STEPS[stepIndex].kind === 'burner') furnace?.open({ spread: burnerSpread(elapsed - starts[stepIndex]) });
      status = 'playing'; lastTime = now();
      render({ fade: !wasInspecting }); schedule(); return true;
    },
    pause() { if (disposed || status !== 'playing') return; status = 'paused'; stopFrame(); shade(false); notify(); },
    inspect() {
      if (disposed) return false;
      if (inspecting) return true;
      stopFrame(); clearDoorWait(); doorInteraction = null;
      status = 'paused'; inspecting = true;
      furnace?.close({ notify: false }); shade(false); scene.setPresentationInspection?.(true);
      notify(); return true;
    },
    restart() {
      if (disposed) return;
      stopFrame(); clearDoorWait(); inspecting = false; scene.setPresentationInspection?.(false); scene.resetPresentationDoors?.(); elapsed = 0; status = 'ready'; enteredStep = -1; enteredShot = -1; transitionKey = '';
      shade(false); render({ fade: false });
    },
    seek(index) {
      if (disposed || !Number.isInteger(index) || index < 0 || index >= TOUR_STEPS.length) return false;
      const wasPlaying = status === 'playing' && active;
      stopFrame(); clearDoorWait(); inspecting = false; scene.setPresentationInspection?.(false); elapsed = starts[index]; status = wasPlaying ? 'playing' : 'paused'; enteredStep = -1; transitionKey = '';
      render({ fade: wasPlaying }); if (wasPlaying) { lastTime = now(); schedule(); } return true;
    },
    setActive(value) { active = !!value; if (!active) controller.pause(); },
    interactDoor() {
      if (disposed || status === 'finished' || !doorInteraction) return false;
      const changed = !!scene.interactPresentationDoor?.(doorInteraction.id);
      doorInteraction = scene.getPresentationDoorState?.() || null;
      notify(); return changed;
    },
    setPlaybackRate(value) {
      if (disposed || !playbackRates.includes(value)) return false;
      if (status === 'playing') {
        const at = now();
        lastTime = at;
      }
      playbackRate = value;
      if (status === 'playing') render(); else notify();
      return true;
    },
    getState: state,
    dispose() { if (disposed) return; stopFrame(); clearDoorWait(); shade(false); furnace?.close({ notify: false }); disposed = true; },
  };
  render({ fade: false });
  return controller;
}
