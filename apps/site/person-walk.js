// Model units are metres. The person uses a fixed adult body and eye height;
// walking support and clearance follow the visible model geometry.
export const WALK_RULES = Object.freeze({
  speed: 1.35, fastSpeed: 2.7, turnSpeed: 1.8,
  eyeHeight: 1.65, height: 1.75, radius: .3,
  verticalFov: 70, horizontalFov: 110,
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
    if (min > max) end = start;
    // An older saved position can lie outside revised bounds. It can walk
    // inward at normal speed, rather than teleporting to the new boundary.
    else if (start < min) end = distance > 0 ? Math.min(end, max) : start;
    else if (start > max) end = distance < 0 ? Math.max(end, min) : start;
    else end = clamp(end, min, max);
  }
  for (const obstacle of obstacles) {
    const min = obstacle[`min${axis}`] - radius, max = obstacle[`max${axis}`] + radius;
    if (other <= obstacle[`min${otherAxis}`] - radius + EPS || other >= obstacle[`max${otherAxis}`] + radius - EPS) continue;
    // A moved object or closing door can overlap an existing avatar. Allow
    // retreat toward the nearer face, never continue through the far face.
    if (start > min + EPS && start < max - EPS) {
      const low = start - min, high = max - start;
      if ((end > start && high > low + EPS) || (end < start && low > high + EPS)) end = start;
      continue;
    }
    if (end > start && start <= min + EPS && end > min) end = Math.min(end, min);
    if (end < start && start >= max - EPS && end < max) end = Math.max(end, max);
  }
  position[index] = end;
}

export function advancePerson(state, { forward = 0, turn = 0, delta = 0, bounds, obstacles = [], fast = false, groundHeight, canOccupy } = {}) {
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
    const baseHeight = next.position[1], baseVelocity = next.verticalVelocity;
    // Both axes inspect the same instant. Sampling from the initial vertical
    // state avoids applying gravity twice while still testing each reachable
    // stair height before the complete body enters its new position.
    const surfaceAt = (position) => {
      if (typeof groundHeight !== 'function') return { height: baseHeight, velocity: baseVelocity, blocked: false };
      const surface = groundHeight(position), gap = baseHeight - surface;
      if (!Number.isFinite(surface)) return { height: baseHeight, velocity: 0, blocked: false };
      if (gap < -WALK_RULES.maxStep - EPS) return { height: baseHeight, velocity: 0, blocked: true };
      if (gap <= WALK_RULES.maxStep + EPS) return { height: surface, velocity: 0, blocked: false };
      const velocity = baseVelocity - WALK_RULES.gravity * dt;
      const height = Math.max(surface, baseHeight + (baseVelocity + velocity) * dt / 2);
      return { height, velocity: height === surface ? 0 : velocity, blocked: false };
    };
    const permits = (position, previous) => typeof canOccupy !== 'function' || canOccupy([...position], [...previous]) !== false;
    for (const [axis, distance] of [['X', dx], ['Z', dz]]) {
      if (Math.abs(distance) < EPS) continue;
      const previous = [...next.position], candidate = [...previous];
      moveAxis(candidate, axis, distance, frame, walls);
      const surface = surfaceAt(candidate);
      if (surface.blocked) continue;
      candidate[1] = surface.height;
      if (permits(candidate, previous)) {
        next.position = candidate;
        next.verticalVelocity = surface.velocity;
      }
    }
    const surface = surfaceAt(next.position), settled = [...next.position];
    settled[1] = surface.height;
    if (!surface.blocked && (Math.abs(settled[1] - next.position[1]) < EPS || permits(settled, next.position))) {
      next.position[1] = settled[1];
      next.verticalVelocity = surface.velocity;
    } else next.verticalVelocity = 0;
    next.yaw = normalize(yaw);
  }
  return next;
}
