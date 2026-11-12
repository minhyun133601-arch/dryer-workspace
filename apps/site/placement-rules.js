// Model-space placement limits. These describe the drawn floors, not survey dimensions.
// All equipment uses one room-aligned grid. Rotation increments are relative to
// the original catalog orientation, keeping the outdoor equipment aligned to its yard.
export const PLACEMENT_RULES = Object.freeze({ step: .25, angleDegrees: 15, angleStep: Math.PI / 12 });

export const PLACEMENT_REGIONS = Object.freeze({
  building: Object.freeze({ id: 'building', label: '건조실 전체 저층동 도면 구획 안', minX: -8.5, maxX: 34.3, minZ: -13.3, maxZ: 21.5 }),
  upper: Object.freeze({ id: 'upper', label: '건조실 상부 도면 구획 안', minX: -8.5, maxX: 8.5, minZ: -13.3, maxZ: 13.3 }),
  roof: Object.freeze({ id: 'roof', label: '옥상 서비스 구역 안', minX: -8.5, maxX: 13.3, minZ: -13.3, maxZ: -6.8 }),
  campus: Object.freeze({ id: 'campus', label: '유산공장 배치 안', minX: -90, maxX: 110, minZ: -110, maxZ: 125 }),
  packaging: Object.freeze({ id: 'packaging', label: '스틱·소포장 3층 바닥 안', minX: -19.125, maxX: 15.675, minZ: -15.2, maxZ: 18.35 }),
  outdoor: Object.freeze({ id: 'outdoor', label: '실외기실 통로 안', minX: 4.24, maxX: 109.98, minZ: -2.95, maxZ: 3.58 }),
  apron: Object.freeze({ id: 'apron', label: '100RT 뒤쪽 벽 앞 구역', minX: -2.285, maxX: 4.06, minZ: -7.53, maxZ: 1.78 }),
});

const EPS = 1e-8;
const finitePosition = (position) => Array.isArray(position) && position.length === 3 && position.every(Number.isFinite);
const normalize = (angle) => ((angle + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function placementRegion(item) {
  if (item.floor === 8) return PLACEMENT_REGIONS.roof;
  if (typeof item.floor === 'number' && item.floor >= 3 && item.floor <= 7) return PLACEMENT_REGIONS.upper;
  if (item.floor === 'campus') return PLACEMENT_REGIONS.campus;
  if (item.floor === 'packaging') return PLACEMENT_REGIONS.packaging;
  return item.floor === 'outdoor' ? item.id === 'outdoor-100rt' ? PLACEMENT_REGIONS.apron : PLACEMENT_REGIONS.outdoor : PLACEMENT_REGIONS.building;
}

export function toRoomPosition(position, room = {}) {
  const anchor = room.anchor || [0, 0, 0], angle = room.rotation || 0;
  const x = position[0] - anchor[0], z = position[2] - anchor[2];
  return [x * Math.cos(angle) - z * Math.sin(angle), position[1] - (anchor[1] || 0), x * Math.sin(angle) + z * Math.cos(angle)];
}

export function fromRoomPosition(position, room = {}) {
  const anchor = room.anchor || [0, 0, 0], angle = room.rotation || 0;
  return [anchor[0] + position[0] * Math.cos(angle) + position[2] * Math.sin(angle), (anchor[1] || 0) + position[1], anchor[2] - position[0] * Math.sin(angle) + position[2] * Math.cos(angle)];
}

// The body's local rectangle after rotation, expressed relative to its centre
// in the room frame. Including the four corners also handles long rotated racks.
export function rotatedFootprint(footprint, rotation, roomRotation = 0) {
  const angle = rotation - roomRotation, c = Math.cos(angle), s = Math.sin(angle);
  const corners = [];
  for (const x of [footprint.minX, footprint.maxX]) for (const z of [footprint.minZ, footprint.maxZ]) {
    corners.push([x * c + z * s, -x * s + z * c]);
  }
  return {
    minX: Math.min(...corners.map(([x]) => x)), maxX: Math.max(...corners.map(([x]) => x)),
    minZ: Math.min(...corners.map(([, z]) => z)), maxZ: Math.max(...corners.map(([, z]) => z)),
  };
}

function snapInside(value, min, max, origin, step) {
  const first = Math.ceil((min - origin - EPS) / step), last = Math.floor((max - origin + EPS) / step);
  if (first > last) return clamp(value, min, max); // A very tight frame may contain no grid intersection.
  const index = clamp(Math.round((value - origin) / step), first, last);
  return origin + index * step;
}

export function constrainPlacement(item, requested = {}, {
  footprint = { minX: 0, maxX: 0, minZ: 0, maxZ: 0 }, room = {}, baseline = item,
  step = PLACEMENT_RULES.step, angleStep = PLACEMENT_RULES.angleStep,
} = {}) {
  const originalPosition = baseline?.position || item.position;
  const originalRotation = baseline?.rotation || 0;
  const requestedPosition = requested.position || item.position;
  const requestedRotation = requested.rotation ?? item.rotation ?? 0;
  const outdoor = item.floor === 'outdoor';
  const frame = outdoor ? room : {};
  const region = placementRegion(item);
  const fallback = { position: [...originalPosition], rotation: originalRotation, limited: false, snapped: false, valid: false, region: region.id, regionLabel: region.label, frame: region, bounds: null };
  if (!finitePosition(originalPosition) || !finitePosition(requestedPosition) || !Number.isFinite(requestedRotation) ||
      !Number.isFinite(originalRotation) || !(step > 0) || !Number.isFinite(step) || !(angleStep > 0) || !Number.isFinite(angleStep) ||
      !['minX', 'maxX', 'minZ', 'maxZ'].every((key) => Number.isFinite(footprint[key])) ||
      footprint.minX > footprint.maxX || footprint.minZ > footprint.maxZ) {
    return { ...fallback, reason: 'invalid-transform' };
  }
  const rotation = normalize(originalRotation + Math.round(normalize(requestedRotation - originalRotation) / angleStep) * angleStep);
  const extent = rotatedFootprint(footprint, rotation, outdoor ? frame.rotation || 0 : 0);
  const minX = region.minX - extent.minX, maxX = region.maxX - extent.maxX;
  const minZ = region.minZ - extent.minZ, maxZ = region.maxZ - extent.maxZ;
  if (minX > maxX + EPS || minZ > maxZ + EPS) return { ...fallback, reason: 'footprint-too-large' };
  const local = toRoomPosition(requestedPosition, frame), origin = toRoomPosition(originalPosition, frame);
  const x = snapInside(local[0], minX, maxX, 0, step);
  const z = snapInside(local[2], minZ, maxZ, 0, step);
  const position = fromRoomPosition([x, origin[1], z], frame);
  position[1] = originalPosition[1]; // Floor/height ownership is never changed by placement.
  const limited = local[0] < minX - EPS || local[0] > maxX + EPS || local[2] < minZ - EPS || local[2] > maxZ + EPS;
  const snapped = Math.abs(x - local[0]) > EPS || Math.abs(z - local[2]) > EPS || Math.abs(normalize(rotation - requestedRotation)) > EPS;
  return { position, rotation, limited, snapped, valid: true, reason: limited ? 'frame-clamped' : snapped ? 'grid-snapped' : '', region: region.id, regionLabel: region.label, frame: region, bounds: { minX, maxX, minZ, maxZ } };
}
