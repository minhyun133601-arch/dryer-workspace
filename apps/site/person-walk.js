// Walking uses the model's own units; the avatar is a navigation aid, not a
// measured clearance or a simulation of a person's safe route through the site.
export const WALK_RULES = Object.freeze({
  speed: 6, fastSpeed: 12, turnSpeed: 1.8,
  eyeHeight: 1.65, height: 1.75, radius: .3,
  lookSensitivity: .004, maxPitch: Math.PI * .44, maxDelta: .1,
  maxStep: .32, maxHorizontalStep: .06, gravity: 9.8, eyeResponse: 18,
});

const EPS = 1e-8;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const normalize = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
const finitePosition = (value) => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
const validRect = (value) => value && ['minX', 'maxX', 'minZ', 'maxZ'].every((key) => Number.isFinite(value[key])) &&
  value.minX <= value.maxX && value.minZ <= value.maxZ;

// Feet position. Y follows reachable floor/step surfaces. Yaw zero looks
// along -Z; positive yaw turns right. Positive pitch looks up.
export function createPersonState({ position = [0, 0, 0], yaw = 0, pitch = 0, verticalVelocity = 0 } = {}) {
  return {
    position: finitePosition(position) ? [...position] : [0, 0, 0],
    yaw: Number.isFinite(yaw) ? normalize(yaw) : 0,
    pitch: Number.isFinite(pitch) ? clamp(pitch, -WALK_RULES.maxPitch, WALK_RULES.maxPitch) : 0,
    verticalVelocity: Number.isFinite(verticalVelocity) ? Math.min(0, verticalVelocity) : 0,
  };
}

export function lookPerson(state, dx, dy) {
  const next = createPersonState(state);
  if (Number.isFinite(dx)) next.yaw = normalize(next.yaw + dx * WALK_RULES.lookSensitivity);
  if (Number.isFinite(dy)) next.pitch = clamp(next.pitch - dy * WALK_RULES.lookSensitivity, -WALK_RULES.maxPitch, WALK_RULES.maxPitch);
  return next;
}

export function isPersonPositionFree(position, { bounds, obstacles = [] } = {}) {
  if (!finitePosition(position)) return false;
  const [x, , z] = position, radius = WALK_RULES.radius;
  if (validRect(bounds) && (x < bounds.minX + radius - EPS || x > bounds.maxX - radius + EPS ||
      z < bounds.minZ + radius - EPS || z > bounds.maxZ - radius + EPS)) return false;
  return !Array.isArray(obstacles) || !obstacles.some((obstacle) => validRect(obstacle) &&
    x > obstacle.minX - radius + EPS && x < obstacle.maxX + radius - EPS &&
    z > obstacle.minZ - radius + EPS && z < obstacle.maxZ + radius - EPS);
}

function moveAxis(position, axis, distance, bounds, obstacles) {
  if (Math.abs(distance) < EPS) return;
  const index = axis === 'X' ? 0 : 2, otherIndex = axis === 'X' ? 2 : 0, otherAxis = axis === 'X' ? 'Z' : 'X';
  const start = position[index], other = position[otherIndex], radius = WALK_RULES.radius;
  let end = start + distance;
  if (bounds) {
    const min = bounds[`min${axis}`] + radius, max = bounds[`max${axis}`] - radius;
    end = min <= max ? clamp(end, min, max) : (min + max) / 2;
  }
  for (const obstacle of obstacles) {
    const min = obstacle[`min${axis}`] - radius, max = obstacle[`max${axis}`] + radius;
    if (other <= obstacle[`min${otherAxis}`] - radius + EPS || other >= obstacle[`max${otherAxis}`] + radius - EPS) continue;
    // An equipment edit may leave an existing avatar inside a new footprint.
    // Let it leave that overlap instead of trapping it permanently.
    if (start > min + EPS && start < max - EPS) continue;
    if (end > start && start <= min + EPS && end > min) end = Math.min(end, min);
    if (end < start && start >= max - EPS && end < max) end = Math.max(end, max);
  }
  position[index] = end;
}

export function advancePerson(state, { forward = 0, turn = 0, delta = 0, bounds, obstacles = [], fast = false, groundHeight } = {}) {
  const next = createPersonState(state);
  if (!Number.isFinite(delta) || delta <= 0) return next;
  const duration = Math.min(delta, WALK_RULES.maxDelta);
  const speed = (fast ? WALK_RULES.fastSpeed : WALK_RULES.speed) * (Number.isFinite(forward) ? clamp(forward, -1, 1) : 0);
  const turnRate = WALK_RULES.turnSpeed * (Number.isFinite(turn) ? clamp(turn, -1, 1) : 0);
  const frame = validRect(bounds) ? bounds : null;
  const walls = Array.isArray(obstacles) ? obstacles.filter(validRect) : [];
  // Keep floor sampling finer than the filmed stair treads even at the faster
  // inspection pace. Time-only subdivision could skip several risers at once.
  const steps = Math.max(1, Math.ceil(duration / .02), Math.ceil(Math.abs(speed) * duration / WALK_RULES.maxHorizontalStep)), dt = duration / steps;
  for (let step = 0; step < steps; step++) {
    const previousYaw = next.yaw, yaw = previousYaw + turnRate * dt;
    const dx = Math.abs(turnRate) > EPS ? speed * (Math.cos(previousYaw) - Math.cos(yaw)) / turnRate : Math.sin(yaw) * speed * dt;
    const dz = Math.abs(turnRate) > EPS ? speed * (Math.sin(previousYaw) - Math.sin(yaw)) / turnRate : -Math.cos(yaw) * speed * dt;
    moveAxis(next.position, 'X', dx, frame, walls);
    moveAxis(next.position, 'Z', dz, frame, walls);
    if (typeof groundHeight === 'function') {
      const surface = groundHeight(next.position);
      const gap = next.position[1] - surface;
      if (Number.isFinite(surface) && gap >= -WALK_RULES.maxStep - EPS) {
        if (gap <= WALK_RULES.maxStep + EPS) {
          next.position[1] = surface;
          next.verticalVelocity = 0;
        } else {
          const velocity = next.verticalVelocity - WALK_RULES.gravity * dt;
          next.position[1] = Math.max(surface, next.position[1] + (next.verticalVelocity + velocity) * dt / 2);
          next.verticalVelocity = next.position[1] === surface ? 0 : velocity;
        }
      } else next.verticalVelocity = 0;
    }
    next.yaw = normalize(yaw);
  }
  return next;
}
