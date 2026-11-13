// Coordinates follow the existing four-flight stair builder. Individual tread
// counts and dimensions remain model estimates, rather than an as-built survey.
export function createUpperStairPath({ minX = 5.9, maxX = 8.1, minZ = 3.8, maxZ = 9.2, fromY = 26.2, toY = 32.6 } = {}) {
  const lane = Math.min(1.3, (maxX - minX - .28) / 2), run = Math.min(3, maxZ - minZ - 2.1);
  const centreX = (minX + maxX) / 2, centreZ = (minZ + maxZ) / 2, rise = (toY - fromY) / 4, offset = lane / 2 + .06;
  const world = (x, y, z) => [centreX + x, fromY + y, centreZ + z];
  const points = [world(-offset, 0, run / 2 + .3)];
  for (let flight = 0; flight < 4; flight++) {
    const direction = flight % 2 ? 1 : -1, x = flight % 2 ? offset : -offset, base = flight * rise;
    if (flight) points.push(world(x, base, -direction * (run / 2 + .475)));
    for (let step = 0; step < 9; step++) points.push(world(x, base + (step + 1) * rise / 9, direction * (-run / 2 + (step + .5) * run / 9)));
    points.push(world(x, base + rise, direction * (run / 2 + .475)));
  }
  points.push(world(offset, toY - fromY, run / 2 + 1.2));
  return points;
}

export const UPPER_STAIR_PATH = createUpperStairPath();
