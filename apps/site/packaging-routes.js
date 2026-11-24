// Drawing-local metres. Y describes the camera eye, 1.65m over its walking
// surface. Platforms therefore use 4.20m (main) and 4.05m (stick and hoppers).
const freezePath = (points) => Object.freeze(points.map((point) => Object.freeze(point)));

// A-11 floor datums: ground 0, 1F +0.10, 2F +6.10, 3F +12.25m.
// Each view owns only its immediately preceding connection. Flight and tread
// counts are reconstruction choices within the A-07 stair enclosure, not a
// claim that every riser was measured in the employee's video.
export const PACKAGING_STAIR_PROFILES = Object.freeze({
  1: Object.freeze({ fromFloor: 0, toFloor: 1, fromElevation: 0, toElevation: .1, rise: .1, flights: 1, stepsPerFlight: 1 }),
  2: Object.freeze({ fromFloor: 1, toFloor: 2, fromElevation: .1, toElevation: 6.1, rise: 6, flights: 4, stepsPerFlight: 9 }),
  3: Object.freeze({ fromFloor: 2, toFloor: 3, fromElevation: 6.1, toElevation: 12.25, rise: 6.15, flights: 4, stepsPerFlight: 10 }),
});

const entryBounds = Object.freeze({ minX: -5.125, maxX: -.8, minZ: 15.2, maxZ: 18.35 });

export function packagingEntryStairPlan(level, bounds = entryBounds) {
  const profile = PACKAGING_STAIR_PROFILES[level] || PACKAGING_STAIR_PROFILES[3];
  return {
    ...profile, minX: bounds.minX, maxX: bounds.maxX, minZ: bounds.minZ, maxZ: bounds.maxZ,
    left: bounds.minX + 1.05, right: bounds.maxX - 1.05,
    leftLanding: bounds.minX + .525, rightLanding: bounds.maxX - .525,
    laneWidth: 1.18, landingWidth: 1.05, lanes: [bounds.maxZ - .8, bounds.minZ + .75],
    thresholdZ: bounds.minZ + 1.4,
  };
}

function entryPath(level) {
  const p = packagingEntryStairPlan(level), eye = 1.65, exitX = -4;
  if (level === 1) return [
    [exitX, eye - p.rise, p.maxZ - .6], [exitX, eye - p.rise, p.thresholdZ + .15],
    [exitX, eye, p.thresholdZ - .15], [exitX, eye, p.lanes[1]],
  ];
  const points = [], flightRise = p.rise / p.flights;
  for (let flight = 0; flight < p.flights; flight++) {
    const forward = flight % 2 === 0, z = p.lanes[flight % 2], base = -p.rise + flight * flightRise + eye;
    const landingX = forward ? p.leftLanding : p.rightLanding;
    points.push([landingX, base, z]);
    points.push([forward ? p.left : p.right, base, z], [forward ? p.right : p.left, base + flightRise, z],
      [forward ? p.rightLanding : p.leftLanding, base + flightRise, z]);
  }
  // Leave the last flight on its end landing, then turn through the actual
  // entrance. This keeps a full walking band over stone at both shoulders.
  points.push([p.leftLanding, eye, p.minZ + .35], [exitX, eye, p.minZ + .35]);
  return points;
}

export const PACKAGING_PATHS = Object.freeze({
  1: freezePath([
    ...entryPath(1), [-4, 1.65, 13.2], [-8, 1.65, 13.2],
    [-8, 1.65, 9.8], [-13.5, 1.65, 9.8], [-13.5, 1.65, -9.4],
    [-13.5, 1.65, 9.8], [-8, 1.65, 9.8], [-8, 1.65, 13.2],
    [-3.3, 1.65, 13.2], [-3.3, 1.65, 9], [5.8, 1.65, 9], [5.8, 1.65, 8.6],
  ]),
  2: freezePath([
    ...entryPath(2), [-4, 1.65, 11.3], [-4, 1.65, -11.9],
    [-4, 1.65, 12.5], [7.5, 1.65, 12.5], [7.5, 1.65, 8.4], [4.95, 1.65, 8.4],
    [4.95, 1.65, 5.9], [6.2, 1.65, 5.9], [6.2, 1.65, 4.7],
  ]),
  // 위생전실 → 배합실 → 본 작업대 → 원부자재 보관창고 → 스틱 작업대·호퍼 열.
  3: freezePath([
    ...entryPath(3), [-4, 1.65, 12], [-4.15, 1.65, 10.5], [-4.15, 1.65, -10.9], [-6.25, 1.65, -10.9], [-6.65, 1.65, -10.9], [-9.1, 4.2, -10.9],
    [-9.7, 4.2, -10.9], [-9.7, 4.2, -9.85], [-8.5, 4.2, -9.85], [-8.5, 4.2, 6.4], [-9.7, 4.2, 6.4], [-9.7, 4.2, 7.45],
    [-9.1, 4.2, 7.45], [-6.65, 1.65, 7.45], [-5.4, 1.65, 7.45], [-5.4, 1.65, 9.2], [2.4, 1.65, 9.2], [2.4, 1.65, 1.75],
    [13.2, 1.65, 1.75], [2.4, 1.65, 1.75], [2.4, 1.65, 8.6], [9, 1.65, 8.6], [2.4, 1.65, 9.2], [-4.15, 1.65, 9.2],
    [-4.15, 1.65, -9.3], [3.9, 1.65, -9.3], [4.4, 1.65, -7.54], [5.35, 1.65, -7.54], [7.95, 4.05, -7.54], [8.35, 4.05, -7.54],
    [8.35, 4.05, -7], [6.35, 4.05, -6.75], [6.35, 4.05, -1.05], [10.72, 4.05, -1.05], [10.72, 4.05, -9.9],
  ]),
});

export const PACKAGING_PATH_END_LOOKATS = Object.freeze({
  1: Object.freeze([5, 1.8, -4]),
  2: Object.freeze([11, 2.1, -6]),
  3: Object.freeze([13, 4.6, -8.6]),
});
