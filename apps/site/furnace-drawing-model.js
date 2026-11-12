import * as THREE from '../shared/vendor/three.module.js';
import { DIMENSIONS, DRAWING_PARTS, TRAIN_GASKET_ALLOWANCE } from './furnace-drawing-data.js';

// Scene frame, in millimetres, as installed. The sheets agree with the field
// photos: looking at the fan wall, gas enters from the left and the duct is vertical.
//   +X right along the fan wall, +Y up the duct axis, +Z out of the fan wall.
// Origin: chamber plan centre on the bottom flange face.
const D = DIMENSIONS;
const WALL_Z = D.innerDepth / 2 + D.wall;
const GAS_Y = D.pipeAboveBottom;
const GAS_Z = WALL_Z + D.wallToPipe;
const INLET_X = -D.flangeToHoseAxis - D.trainLength;
const LEG_X = D.stubSpacing / 2;
const JOINT_Z = WALL_Z + D.wallToStubJoint;
const HEADER_Z = JOINT_Z + D.jointToElbowFace + D.elbow40CenterToFace;
const HOSE_TOP_Z = JOINT_Z + D.stubJointToHoseFlange - D.hoseFlange;
const HOSE_BOTTOM_Z = HOSE_TOP_Z + D.hoseLength;
const PILOT_Z = GAS_Z - PIPE_RADIUS(50) - D.pilotRiserToBend - D.pilotBendRadius;
const PILOT_X = INLET_X + 96;
// Read off the sheets with a scale, not printed dimensions. See docs/furnace-drawing-20261105.md.
const FAN_X = 394;
const FAN_Z = WALL_Z + 281;
const BURNER_BOTTOM = 788;
const BURNER_TOP = 1080;
const BURNER_HALF_LENGTH = 459;
const MODULE = 153;
const FLANGE_RADIUS = 65;
const PORT_Y = 965;
const SIGHT_Y = 1167;

export const DRAWING_FRAME = Object.freeze({ WALL_Z, GAS_Y, GAS_Z, INLET_X, LEG_X, JOINT_Z, HEADER_Z, HOSE_TOP_Z, HOSE_BOTTOM_Z, PILOT_Z, PILOT_X, FAN_X, FAN_Z });

function PIPE_RADIUS(nominal) { return { 50: 30.25, 40: 24.3, 15: 10.85, 10: 8.65 }[nominal]; }

// Distance of each chain station from the inlet face, with the gasket after the centre flange.
export function trainStation(index) {
  return D.trainChain.slice(0, index).reduce((sum, value) => sum + value, 0) + (index >= 6 ? TRAIN_GASKET_ALLOWANCE : 0);
}

const PAINT = {
  gas: { color: 0xe6bb2c, roughness: .42, metalness: .16 },
  steel: { color: 0xb9c2c9, roughness: .36, metalness: .72 },
  bolt: { color: 0x66727c, roughness: .44, metalness: .78 },
  cast: { color: 0xa9afb2, roughness: .6, metalness: .42 },
  castDark: { color: 0x7c858b, roughness: .58, metalness: .46 },
  coil: { color: 0x1c232a, roughness: .46, metalness: .18 },
  brass: { color: 0xa98539, roughness: .38, metalness: .72 },
  lever: { color: 0xcf3a2b, roughness: .5, metalness: .08 },
  dial: { color: 0xf7f9fa, roughness: .6, metalness: 0 },
  ink: { color: 0x1d2329, roughness: .6, metalness: 0 },
  switch: { color: 0x262c33, roughness: .54, metalness: .12 },
  label: { color: 0xf2be1a, roughness: .5, metalness: 0 },
  burner: { color: 0x59636d, roughness: .56, metalness: .55 },
  burnerRail: { color: 0x8d979f, roughness: .46, metalness: .6 },
  comb: { color: 0xc8d0d6, roughness: .38, metalness: .62 },
  fan: { color: 0xe45a1c, roughness: .5, metalness: .14 },
  motor: { color: 0x234362, roughness: .5, metalness: .3 },
  felt: { color: 0xf3f0e7, roughness: .96, metalness: 0 },
  flange: { color: 0xaeb8c0, roughness: .44, metalness: .6 },
  hose: { color: 0xb2bac1, roughness: .32, metalness: .82 },
  glass: { color: 0xffbe72, roughness: .3, metalness: 0, emissive: 0xff8a2a, emissiveIntensity: .85 },
  wall: { color: 0xc4cdd4, roughness: .4, metalness: .5, transparent: true, opacity: .16, depthWrite: false, side: THREE.DoubleSide },
  duct: { color: 0x79a7bd, roughness: .5, metalness: .2, transparent: true, opacity: .3, depthWrite: false, side: THREE.DoubleSide },
  ghost: { color: 0xb4bfc8, roughness: .5, metalness: .2, transparent: true, opacity: .13, depthWrite: false, side: THREE.DoubleSide },
};

const UP = new THREE.Vector3(0, 1, 0);
const vector = (point) => point.isVector3 ? point.clone() : new THREE.Vector3(...point);

function rod(parent, material, radius, from, to, { segments = 24, end = radius } = {}) {
  const a = vector(from), b = vector(to);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(end, radius, a.distanceTo(b), segments), material);
  mesh.position.copy(a).add(b).multiplyScalar(.5);
  mesh.quaternion.setFromUnitVectors(UP, b.sub(a).normalize());
  parent.add(mesh);
  return mesh;
}
function block(parent, material, size, center) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...center);
  parent.add(mesh);
  return mesh;
}
function strut(parent, material, width, thickness, from, to) {
  const a = vector(from), b = vector(to);
  const mesh = block(parent, material, [width, a.distanceTo(b), thickness], a.clone().add(b).multiplyScalar(.5).toArray());
  mesh.quaternion.setFromUnitVectors(UP, b.sub(a).normalize());
  return mesh;
}
function roundedPath(points, radius) {
  const corners = points.map(vector);
  const path = [corners[0]];
  for (let index = 1; index < corners.length - 1; index++) {
    const corner = corners[index];
    const start = corner.clone().addScaledVector(corner.clone().sub(corners[index - 1]).normalize(), -radius);
    const end = corner.clone().addScaledVector(corners[index + 1].clone().sub(corner).normalize(), radius);
    for (let step = 0; step <= 10; step++) {
      const t = step / 10;
      path.push(new THREE.Vector3().addScaledVector(start, (1 - t) ** 2).addScaledVector(corner, 2 * t * (1 - t)).addScaledVector(end, t * t));
    }
  }
  path.push(corners.at(-1));
  return path;
}
function pipe(parent, material, radius, points, bend = 0, { radial = 18, smooth = false } = {}) {
  const path = bend ? roundedPath(points, bend) : points.map(vector);
  const curve = new THREE.CatmullRomCurve3(path, false, 'centripetal');
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, smooth ? 72 : Math.max(24, path.length * 3), radius, radial, false), material);
  parent.add(mesh);
  return mesh;
}
function flange(parent, paint, material, from, to, { radius = FLANGE_RADIUS, bolts = 4, circle = radius * .8 } = {}) {
  const a = vector(from), b = vector(to);
  rod(parent, material, radius, a, b, { segments: 40 });
  const axis = b.clone().sub(a).normalize();
  const side = Math.abs(axis.y) > .9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
  const u = new THREE.Vector3().crossVectors(axis, side).normalize();
  const v = new THREE.Vector3().crossVectors(axis, u);
  for (let index = 0; index < bolts; index++) {
    const angle = (index + .5) * Math.PI * 2 / bolts;
    const offset = u.clone().multiplyScalar(Math.cos(angle) * circle).addScaledVector(v, Math.sin(angle) * circle);
    rod(parent, paint('bolt'), 8.5, a.clone().add(offset).addScaledVector(axis, -7), b.clone().add(offset).addScaledVector(axis, 7), { segments: 6 });
  }
}
function gauge(parent, paint, center, dial = 37.5) {
  const [x, y, z] = center;
  rod(parent, paint('steel'), dial, [x, y, z - 15], [x, y, z + 13], { segments: 40 });
  rod(parent, paint('steel'), dial + 2, [x, y, z + 11], [x, y, z + 16], { segments: 40 });
  rod(parent, paint('dial'), dial - 4, [x, y, z + 15], [x, y, z + 16.5], { segments: 40 });
  for (let tick = 0; tick < 9; tick++) {
    const angle = -2.25 + tick * .5625;
    const mesh = block(parent, paint('ink'), [1.8, 6, .6], [x + Math.sin(angle) * (dial - 9), y + Math.cos(angle) * (dial - 9), z + 16.8]);
    mesh.rotation.z = -angle;
  }
  const needle = block(parent, paint('ink'), [2, dial * .68, .8], [x + Math.sin(-.7) * dial * .29, y + Math.cos(-.7) * dial * .29, z + 17.2]);
  needle.rotation.z = .7;
  rod(parent, paint('ink'), 3.4, [x, y, z + 16.5], [x, y, z + 18], { segments: 12 });
}
function ballValve(parent, paint, axis = 'y', leverDirection = [0, -1, .35], length = 42, radius = 11) {
  const half = length / 2;
  const a = { x: [-half, 0, 0], y: [0, -half, 0], z: [0, 0, -half] }[axis];
  const b = a.map((value) => -value);
  rod(parent, paint('brass'), radius, a, b, { segments: 6 });
  const ball = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.32, 18, 12), paint('brass'));
  parent.add(ball);
  const stem = new THREE.Vector3(...leverDirection).normalize();
  rod(parent, paint('steel'), 3.5, [0, 0, 0], stem.clone().multiplyScalar(radius * 1.7), { segments: 8 });
  const handle = stem.clone().multiplyScalar(radius * 1.7);
  strut(parent, paint('lever'), 11, 4, handle, handle.clone().addScaledVector(stem, length * 1.5));
}
function pressureSwitch(parent, paint, side = 1) {
  rod(parent, paint('brass'), 11, [0, -20, 0], [0, 20, 0], { segments: 6 });
  block(parent, paint('switch'), [58, 56, 40], [side * 40, 0, 0]);
  block(parent, paint('switch'), [26, 34, 34], [side * 80, 6, 0]);
  rod(parent, paint('steel'), 19, [side * 40, -2, 20], [side * 40, -2, 24], { segments: 28 });
  rod(parent, paint('label'), 14, [side * 40, -2, 24], [side * 40, -2, 25], { segments: 28 });
}
function shutOffValve(parent, paint, length) {
  const cast = paint('cast');
  const half = length / 2;
  rod(parent, cast, 41, [0, 0, 0], [28, 0, 0], { segments: 6 }).position.x = half * -1 + 14;
  rod(parent, cast, 41, [0, 0, 0], [28, 0, 0], { segments: 6 }).position.x = half - 14;
  rod(parent, cast, 40, [-half + 26, 0, 0], [half - 26, 0, 0], { segments: 28 });
  block(parent, cast, [52, 50, 86], [0, 8, 0]);
  rod(parent, cast, 40, [0, 24, 0], [0, 66, 0], { end: 48, segments: 28 });
  block(parent, cast, [107, 15, 107], [0, 72, 0]);
  for (const x of [-44, 44]) for (const z of [-44, 44]) rod(parent, paint('bolt'), 5, [x, 78, z], [x, 84, z], { segments: 6 });
  rod(parent, paint('coil'), 49, [0, 80, 0], [0, 178, 0], { segments: 40 });
  rod(parent, paint('steel'), 9, [0, 178, 0], [0, 192, 0], { segments: 12 });
  block(parent, paint('coil'), [24, 66, 22], [0, 132, 58]);
  block(parent, paint('dial'), [58, 42, 1.2], [-1, 134, 49]).rotation.y = 0;
  for (const z of [-30, 30]) rod(parent, paint('castDark'), 9, [-30, -8, z], [-30, -8, z * 1.42], { segments: 6 });
}

// Comb plate seen in plan on each burner module, built once per module length.
function combGeometry(length, depth, height, teeth = 9) {
  const shape = new THREE.Shape();
  const pitch = length / teeth;
  shape.moveTo(-length / 2, -5);
  shape.lineTo(-length / 2, 0);
  for (let index = 0; index < teeth; index++) {
    const start = -length / 2 + index * pitch;
    shape.lineTo(start + pitch * .22, 0);
    shape.lineTo(start + pitch * .22, depth);
    shape.lineTo(start + pitch * .78, depth);
    shape.lineTo(start + pitch * .78, 0);
  }
  shape.lineTo(length / 2, 0);
  shape.lineTo(length / 2, -5);
  shape.closePath();
  // Shape axes (u, v, extrude) become (Z, X, Y).
  return new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false }).applyMatrix4(new THREE.Matrix4().set(0, 1, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1));
}
function burnerModule(parent, paint, length, comb) {
  const height = BURNER_TOP - BURNER_BOTTOM;
  const body = length - 4;
  block(parent, paint('burner'), [218, height - 46, body], [0, (height - 46) / 2, 0]);
  block(parent, paint('burnerRail'), [218, 7, body], [0, height - 43, 0]);
  block(parent, paint('comb'), [34, 40, body], [0, height - 20, 0]);
  for (const x of [-98, 98]) block(parent, paint('burnerRail'), [22, 40, body], [x, height - 20, 0]);
  for (const flip of [0, Math.PI]) {
    const plate = new THREE.Mesh(comb, paint('comb'));
    plate.rotation.y = flip;
    plate.position.y = height - 40;
    plate.position.x = flip ? -17 : 17;
    parent.add(plate);
  }
}

function flangeShape() {
  const halfX = D.flangeWidth / 2, halfZ = D.flangeDepth / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-halfX, -halfZ); shape.lineTo(halfX, -halfZ); shape.lineTo(halfX, halfZ); shape.lineTo(-halfX, halfZ); shape.closePath();
  const opening = new THREE.Path();
  const innerX = D.innerWidth / 2, innerZ = D.innerDepth / 2;
  opening.moveTo(-innerX, -innerZ); opening.lineTo(-innerX, innerZ); opening.lineTo(innerX, innerZ); opening.lineTo(innerX, -innerZ); opening.closePath();
  shape.holes.push(opening);
  const slot = (x, z, length, alongX) => {
    const path = new THREE.Path();
    const half = length / 2 - D.slotRadius, r = D.slotRadius;
    if (alongX) {
      path.absarc(x - half, z, r, Math.PI / 2, Math.PI * 1.5, false);
      path.absarc(x + half, z, r, Math.PI * 1.5, Math.PI * 2.5, false);
    } else {
      path.absarc(x, z - half, r, Math.PI, Math.PI * 2, false);
      path.absarc(x, z + half, r, 0, Math.PI, false);
    }
    path.closePath();
    shape.holes.push(path);
  };
  const stations = (pitch, half) => pitch.slice(0, -1).map((_, index) => -half + pitch.slice(0, index + 1).reduce((sum, value) => sum + value, 0));
  const alongWidth = stations(D.flangeWidthPitch, halfX);
  const alongDepth = stations(D.flangeDepthPitch, halfZ);
  // Slots run along the edge. The four corners carry the shorter pair.
  for (const z of [alongDepth[0], alongDepth.at(-1)]) for (const x of alongWidth.slice(1, -1)) slot(x, z, D.slotMiddle, true);
  for (const x of [alongWidth[0], alongWidth.at(-1)]) for (const z of alongDepth.slice(2, -2)) slot(x, z, D.slotMiddle, false);
  for (const x of [alongWidth[0], alongWidth.at(-1)]) for (const z of [...alongDepth.slice(0, 2), ...alongDepth.slice(-2)]) slot(x, z, D.slotCorner, false);
  return shape;
}

function scrollGeometry(height) {
  // Plan outline of the fan casing around its axis: an opening spiral whose
  // outlet runs back to the wall, matching the 222 and 260 reach in the front view.
  const shape = new THREE.Shape();
  const tongue = -62 * Math.PI / 180, wall = WALL_Z - FAN_Z, steps = 72;
  for (let index = 0; index <= steps; index++) {
    const t = index / steps, angle = tongue + (-Math.PI * 2 - tongue) * t, radius = 222 + 38 * t;
    const point = [Math.cos(angle) * radius, Math.sin(angle) * radius];
    if (index) shape.lineTo(...point); else shape.moveTo(...point);
  }
  shape.lineTo(260, wall);
  shape.lineTo(104, wall);
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: true, bevelSize: 3, bevelThickness: 3, bevelSegments: 2, curveSegments: 16 });
}

function hoodGeometry(height) {
  const geometry = new THREE.CylinderGeometry(460, 460, height, 64, 1, true);
  const position = geometry.attributes.position;
  for (let index = 0; index < position.count; index++) {
    if (position.getY(index) >= 0) continue;
    const x = position.getX(index), z = position.getZ(index);
    const edge = Math.max(Math.abs(x) / 620, Math.abs(z) / 800);
    if (edge > .0001) { position.setX(index, x / edge); position.setZ(index, z / edge); }
  }
  geometry.computeVertexNormals();
  return geometry;
}

const CORRUGATION_STEPS = 56;
function hoseGeometry(length, radius) {
  const profile = [new THREE.Vector2(0, 0)];
  for (let index = 0; index <= CORRUGATION_STEPS; index++) {
    const t = index / CORRUGATION_STEPS;
    profile.push(new THREE.Vector2(radius + Math.sin(t * Math.PI * 24) * 2.1, t * length));
  }
  profile.push(new THREE.Vector2(0, length));
  return new THREE.LatheGeometry(profile, 28);
}

export function createDrawingModel() {
  const root = new THREE.Group();
  root.name = 'furnace-drawing';
  root.scale.setScalar(.001);
  const records = new Map(DRAWING_PARTS.map((part) => [part.id, { id: part.id, pieces: [], materials: new Map(), anchor: null, lead: [0, -46] }]));
  const pieces = [], links = [];

  const painter = (id) => {
    const { materials } = records.get(id);
    return (name) => {
      if (!materials.has(name)) materials.set(name, new THREE.MeshStandardMaterial(PAINT[name]));
      return materials.get(name);
    };
  };
  function piece(id, home = [0, 0, 0], offset = [0, 0, 0]) {
    const group = new THREE.Group();
    group.position.set(...home);
    group.userData.drawingPart = id;
    root.add(group);
    const entry = { id, group, home: new THREE.Vector3(...home), offset: new THREE.Vector3(...offset) };
    pieces.push(entry);
    records.get(id).pieces.push(entry);
    return group;
  }
  const label = (id, group, point, lead = [0, -46]) => Object.assign(records.get(id), { anchor: { group, point: new THREE.Vector3(...point) }, lead });
  const link = (a, pointA, b, pointB) => links.push({ a, pointA: new THREE.Vector3(...pointA), b, pointB: new THREE.Vector3(...pointB) });

  // Exploded layout: the valve train comes forward and up, spreading along its
  // own axis. The burner lifts out of the open top of the chamber.
  const LIFT = [0, 470, 560], SPREAD = 128, LAST = 10;
  const onTrain = (order, extra = [0, 0, 0]) => [LIFT[0] - (LAST - order) * SPREAD + extra[0], LIFT[1] + extra[1], LIFT[2] + extra[2]];
  const trainPiece = (id, station, order) => piece(id, [INLET_X + station, GAS_Y, GAS_Z], onTrain(order));
  const s = trainStation;
  const tapSpools = {};

  { // 1: 50A pipe spools, each in line between two components.
    const paint = painter('1'), gas = paint('gas');
    const r = PIPE_RADIUS(50);
    const inlet = trainPiece('1', s(0), 0);
    flange(inlet, paint, gas, [0, 0, 0], [D.flangeThickness, 0, 0]);
    rod(inlet, gas, r, [D.flangeThickness, 0, 0], [s(2), 0, 0], { segments: 28 });
    const tap = D.firstGaugeFromInlet;
    rod(inlet, gas, 17, [tap - 22, 0, 0], [tap + 22, 0, 0], { segments: 6 });
    rod(inlet, gas, PIPE_RADIUS(10), [tap, 0, 0], [tap, 42, 0], { segments: 14 });
    label('1', inlet, [80, -r, 0], [-8, 54]);
    tapSpools[0] = { group: inlet, x: tap };

    const afterRegulator = trainPiece('1', s(3), 2);
    rod(afterRegulator, gas, r, [0, 0, 0], [s(4) - s(3), 0, 0], { segments: 28 });
    const second = D.secondGaugeFromRegulator;
    rod(afterRegulator, gas, 17, [second - 22, 0, 0], [second + 22, 0, 0], { segments: 6 });
    rod(afterRegulator, gas, PIPE_RADIUS(10), [second, 0, 0], [second, 42, 0], { segments: 14 });
    tapSpools[2] = { group: afterRegulator, x: second };

    const beforeCentre = trainPiece('1', s(5), 4);
    const firstHalf = s(6) - TRAIN_GASKET_ALLOWANCE - s(5);
    rod(beforeCentre, gas, r, [0, 0, 0], [firstHalf - D.flangeThickness, 0, 0], { segments: 28 });
    flange(beforeCentre, paint, gas, [firstHalf - D.flangeThickness, 0, 0], [firstHalf, 0, 0]);

    const afterCentre = trainPiece('1', s(6), 5);
    flange(afterCentre, paint, gas, [0, 0, 0], [D.flangeThickness, 0, 0]);
    rod(afterCentre, gas, r, [D.flangeThickness, 0, 0], [s(7) - s(6), 0, 0], { segments: 28 });

    const beforeControl = trainPiece('1', s(8), 7);
    rod(beforeControl, gas, r, [0, 0, 0], [s(9) - s(8), 0, 0], { segments: 28 });

    const outlet = trainPiece('1', s(10), 9);
    const outletLength = s(12) - s(10);
    rod(outlet, gas, r, [0, 0, 0], [outletLength - D.flangeThickness, 0, 0], { segments: 28 });
    flange(outlet, paint, gas, [outletLength - D.flangeThickness, 0, 0], [outletLength, 0, 0]);
    const last = D.trainLength - D.lastGaugeFromOutlet - s(10);
    rod(outlet, gas, 17, [last - 22, 0, 0], [last + 22, 0, 0], { segments: 6 });
    rod(outlet, gas, PIPE_RADIUS(10), [last, 0, 0], [last, 42, 0], { segments: 14 });
    tapSpools[9] = { group: outlet, x: last };

    // The elbow turns the line toward the wall at the chamber centre line.
    const elbow = piece('1', [-D.flangeToHoseAxis, GAS_Y, GAS_Z], LIFT);
    flange(elbow, paint, gas, [0, 0, 0], [D.flangeThickness, 0, 0]);
    const toFlange = HOSE_BOTTOM_Z - GAS_Z;
    pipe(elbow, gas, r, [[D.flangeThickness, 0, 0], [D.flangeToHoseAxis, 0, 0], [D.flangeToHoseAxis, 0, toFlange + D.hoseFlange]], D.elbow50CenterToFace);
    flange(elbow, paint, gas, [D.flangeToHoseAxis, 0, toFlange + D.hoseFlange], [D.flangeToHoseAxis, 0, toFlange]);
    link(inlet, [0, 0, 0], elbow, [0, 0, 0]);
  }

  { // 4: main regulator, from the plan circle and the side profile.
    const paint = painter('4'), cast = paint('cast');
    const length = s(3) - s(2), group = trainPiece('4', s(2), 1), mid = length / 2;
    rod(group, cast, 44, [0, 0, 0], [20, 0, 0], { segments: 6 });
    rod(group, cast, 44, [length - 20, 0, 0], [length, 0, 0], { segments: 6 });
    block(group, cast, [length - 36, 92, 150], [mid, 0, 0]);
    block(group, paint('castDark'), [80, 60, 152], [mid + 16, -6, 0]);
    const profile = [[0, 80], [116, 80], [118, 86], [118, 96], [108, 112], [40, 122], [32, 126], [31, 252], [34, 254], [34, 268], [0, 269]].map(([x, y]) => new THREE.Vector2(x, y));
    const dome = new THREE.Mesh(new THREE.LatheGeometry(profile, 44), cast);
    dome.position.x = mid;
    group.add(dome);
    for (let index = 0; index < 10; index++) {
      const angle = index * Math.PI / 5;
      rod(group, paint('bolt'), 5.5, [mid + Math.cos(angle) * 110, 90, Math.sin(angle) * 110], [mid + Math.cos(angle) * 110, 100, Math.sin(angle) * 110], { segments: 6 });
    }
    rod(group, paint('lever'), 15, [mid + 86, 116, 0], [mid + 86, 128, 0], { segments: 14 });
    label('4', group, [mid, 268, 0], [0, -30]);
  }

  for (const [id, station, order] of [['8', 4, 3], ['9', 7, 6]]) {
    const paint = painter(id), length = s(station + 1) - s(station);
    const group = trainPiece(id, s(station), order);
    const inner = new THREE.Group();
    inner.position.x = length / 2;
    group.add(inner);
    shutOffValve(inner, paint, length);
    label(id, group, [length / 2, 190, 0], [0, -30]);
  }

  { // 11: control valve, shaft toward the front, and 10: its motor with the link.
    const valvePaint = painter('11'), motorPaint = painter('10');
    const length = s(10) - s(9), mid = length / 2;
    const valve = trainPiece('11', s(9), 8);
    block(valve, valvePaint('castDark'), [length, 74, 76], [mid, 0, 0]);
    rod(valve, valvePaint('cast'), 30, [mid, 0, 38], [mid, 0, 52], { segments: 32 });
    rod(valve, valvePaint('dial'), 23, [mid, 0, 52], [mid, 0, 53.5], { segments: 32 });
    rod(valve, valvePaint('steel'), 7, [mid, 0, 50], [mid, 0, 70], { segments: 14 });
    strut(valve, valvePaint('bolt'), 15, 6, [mid, 0, 66], [mid + 78, -38, 66]);
    label('11', valve, [mid, -36, 40], [6, 52]);
    const motor = piece('10', [INLET_X + s(9) + mid, GAS_Y + 49, GAS_Z], onTrain(8, [0, 175, 0]));
    block(motor, motorPaint('lever'), [132, 8, 118], [0, 4, 0]);
    block(motor, motorPaint('cast'), [116, 124, 148], [0, 72, 0]);
    block(motor, motorPaint('castDark'), [120, 40, 152], [0, 150, 0]);
    for (const x of [-46, 46]) rod(motor, motorPaint('bolt'), 7, [x, 170, -60], [x, 174, -60], { segments: 6 });
    rod(motor, motorPaint('steel'), 9, [0, 74, 74], [0, 74, 92], { segments: 14 });
    strut(motor, motorPaint('brass'), 18, 6, [0, 74, 90], [78, 62, 90]);
    rod(motor, motorPaint('steel'), 4.5, [78, 62, 90], [78, -86, 78], { segments: 10 });
    label('10', motor, [0, 172, 0], [0, -30]);
  }

  // Instrument taps, stacked as the elevation draws them: valve, switch, gauge.
  const stack = [
    { gauge: '2', valve: '3', switchId: null, station: D.firstGaugeFromInlet, order: 0, gaugeHeight: 177 },
    { gauge: '5', valve: '7', switchId: '6', station: s(3) + D.secondGaugeFromRegulator, order: 2, gaugeHeight: 214 },
    { gauge: '12', valve: '14', switchId: '13', station: D.trainLength - D.lastGaugeFromOutlet, order: 9, gaugeHeight: 214 },
  ];
  for (const { gauge: gaugeId, valve: valveId, switchId, station, order, gaugeHeight } of stack) {
    const x = INLET_X + station;
    const valvePaint = painter(valveId), gaugePaint = painter(gaugeId);
    const valve = piece(valveId, [x, GAS_Y + 62, GAS_Z], onTrain(order, [0, 70, 0]));
    ballValve(valve, valvePaint, 'y', [.2, -.4, 1], 40, 10);
    label(valveId, valve, [0, 0, 12], [-44, 2]);
    const gaugeGroup = piece(gaugeId, [x, GAS_Y + gaugeHeight, GAS_Z], onTrain(order, [0, switchId ? 300 : 190, 0]));
    gauge(gaugeGroup, gaugePaint, [0, 0, 0]);
    rod(gaugeGroup, gaugePaint('brass'), 5.5, [0, -38, 0], [0, switchId ? -50 : -92, 0], { segments: 10 });
    label(gaugeId, gaugeGroup, [0, 38, 0], [0, -28]);
    link(gaugeGroup, [0, -38, 0], tapSpools[order].group, [tapSpools[order].x, 0, 0]);
    if (switchId) {
      const paint = painter(switchId);
      const group = piece(switchId, [x, GAS_Y + 136, GAS_Z], onTrain(order, [0, 170, 0]));
      pressureSwitch(group, paint);
      label(switchId, group, [62, 0, 0], [40, 2]);
    }
  }

  { // 15-21 and D: the pilot line, parallel to the main pipe on the wall side.
    const paint = painter('15'), gas = paint('gas'), r = PIPE_RADIUS(15);
    const P = D.pilotBendRadius, base = [PILOT_X, GAS_Y, PILOT_Z];
    const regulatorStart = D.pilotRegulatorStart, regulatorEnd = regulatorStart + D.pilotRegulatorLength;
    const firstValve = regulatorEnd + D.pilotToFirstSolenoid, firstEnd = firstValve + D.pilotSolenoid;
    const secondValve = firstEnd + D.pilotSolenoidGap, secondEnd = secondValve + D.pilotSolenoid;
    const socket = secondEnd + D.pilotToSocket, gaugeAt = socket - D.pilotGaugeToSocket;
    const AWAY = [-520, -640, 460], GAP = 86;
    const pilotOffset = (order) => [AWAY[0] - (7 - order) * GAP, AWAY[1], AWAY[2]];
    const riserLength = GAS_Z - PIPE_RADIUS(50) - PILOT_Z;

    const riser = piece('15', base, pilotOffset(0));
    pipe(riser, gas, r, [[0, 0, riserLength], [0, 0, 0], [92, 0, 0]], P);
    const ballId = '21', ball = piece(ballId, [PILOT_X, GAS_Y, PILOT_Z + riserLength - 68], pilotOffset(0).map((value, axis) => value + [0, 0, 150][axis]));
    ballValve(ball, painter(ballId), 'z', [0, 1, .2], 44, 13);
    label(ballId, ball, [0, 20, 0], [-30, -30]);
    const union = piece('16', [PILOT_X + 92, GAS_Y, PILOT_Z], pilotOffset(1));
    const unionPaint = painter('16');
    rod(union, unionPaint('cast'), 21, [0, 0, 0], [18, 0, 0], { segments: 6 });
    rod(union, unionPaint('castDark'), 26, [18, 0, 0], [28, 0, 0], { segments: 6 });
    rod(union, unionPaint('cast'), 21, [28, 0, 0], [41, 0, 0], { segments: 6 });
    label('16', union, [20, 24, 0], [0, -30]);
    const regulatorPaint = painter('17'), length = D.pilotRegulatorLength;
    const regulator = piece('17', [PILOT_X + regulatorStart + length / 2, GAS_Y, PILOT_Z], pilotOffset(2));
    rod(regulator, regulatorPaint('cast'), 22, [-length / 2, 0, 0], [length / 2, 0, 0], { segments: 6 });
    const regulatorDome = [[0, 12], [50, 12], [52, 18], [52, 30], [32, 40], [18, 42], [18, 94], [20, 96], [0, 97]].map(([x, y]) => new THREE.Vector2(x, y));
    regulator.add(new THREE.Mesh(new THREE.LatheGeometry(regulatorDome, 32), regulatorPaint('cast')));
    label('17', regulator, [0, 96, 0], [0, -26]);
    const spools = [[regulatorEnd, firstValve, 3], [firstEnd, secondValve, 4], [secondEnd, socket, 5]];
    for (const [from, to, order] of spools) {
      const spool = piece('15', [PILOT_X + from, GAS_Y, PILOT_Z], pilotOffset(order));
      rod(spool, gas, r, [0, 0, 0], [to - from, 0, 0], { segments: 16 });
      if (order === 3) label('15', spool, [(to - from) * .5, -r, 0], [0, 44]);
    }
    for (const [id, at, order] of [['18', firstValve, 3.5], ['19', secondValve, 4.5]]) {
      const valvePaint = painter(id), half = D.pilotSolenoid / 2;
      const valve = piece(id, [PILOT_X + at + half, GAS_Y, PILOT_Z], pilotOffset(order));
      rod(valve, valvePaint('brass'), 18, [-half, 0, 0], [half, 0, 0], { segments: 6 });
      rod(valve, valvePaint('coil'), half, [0, 18, 0], [0, 84, 0], { segments: 28 });
      rod(valve, valvePaint('steel'), 6, [0, 84, 0], [0, 92, 0], { segments: 10 });
      block(valve, valvePaint('coil'), [28, 26, 34], [0, 44, half + 14]);
      label(id, valve, [0, 92, 0], [0, -26]);
    }
    const gaugePaint = painter('20');
    const tee = piece('20', [PILOT_X + gaugeAt, GAS_Y, PILOT_Z], pilotOffset(5));
    rod(tee, gaugePaint('brass'), 15, [-26, 0, 0], [26, 0, 0], { segments: 6 });
    rod(tee, gaugePaint('brass'), 6, [0, 0, 0], [0, 46, 0], { segments: 10 });
    gauge(tee, gaugePaint, [0, 84, 0]);
    label('20', tee, [0, 122, 0], [0, -26]);
    const hosePaint = painter('D');
    const end = piece('D', [PILOT_X + socket, GAS_Y, PILOT_Z], pilotOffset(6));
    rod(end, hosePaint('brass'), 16, [0, 0, 0], [29, 0, 0], { segments: 6 });
    // Ends on the PILOT GAS port stub; the path between is not on the sheets.
    const portEnd = [96 - PILOT_X - socket, PORT_Y - GAS_Y, WALL_Z + 44 - PILOT_Z];
    const route = [[29, 0, 0], [170, -22, 8], [410, 46, 4], [600, 100, -30], [668, 124, -120], portEnd];
    const hose = new THREE.CatmullRomCurve3(route.map(vector), false, 'centripetal');
    end.add(new THREE.Mesh(new THREE.TubeGeometry(hose, 90, 9.5, 12, false), hosePaint('hose')));
    label('D', end, [240, -8, 6], [0, 40]);
    link(riser, [92, 0, 0], end, [0, 0, 0]);
  }

  { // A: flexible hose between the 50A elbow and the tee.
    const paint = painter('A');
    const group = piece('A', [0, GAS_Y, HOSE_BOTTOM_Z], LIFT.map((value) => value * .68));
    flange(group, paint, paint('flange'), [0, 0, 0], [0, 0, -D.hoseFlange]);
    flange(group, paint, paint('flange'), [0, 0, -D.hoseLength + D.hoseFlange], [0, 0, -D.hoseLength]);
    const bellows = new THREE.Mesh(hoseGeometry(D.hoseLength - 2 * D.hoseFlange, 35), paint('hose'));
    bellows.rotation.x = Math.PI / 2;
    bellows.position.z = -D.hoseLength + D.hoseFlange;
    group.add(bellows);
    label('A', group, [36, 0, -65], [34, 18]);
  }

  { // B: tee, reducers and 40A arms, ending at the flanges beside the wall.
    const paint = painter('B'), gas = paint('gas');
    const group = piece('B', [0, GAS_Y, HEADER_Z], LIFT.map((value) => value * .36));
    const { side, reducer, middle } = D.header;
    const r50 = PIPE_RADIUS(50), r40 = PIPE_RADIUS(40);
    const teeTop = HOSE_TOP_Z - D.teeFlangePair + D.hoseFlange - HEADER_Z;
    rod(group, gas, r50, [-middle / 2, 0, 0], [middle / 2, 0, 0], { segments: 28 });
    rod(group, gas, r50, [0, 0, 0], [0, 0, teeTop], { segments: 28 });
    flange(group, paint, gas, [0, 0, teeTop], [0, 0, HOSE_TOP_Z - HEADER_Z]);
    const flangeFace = JOINT_Z + D.stubFlange - HEADER_Z;
    for (const sign of [-1, 1]) {
      rod(group, gas, r50, [sign * middle / 2, 0, 0], [sign * (middle / 2 + reducer), 0, 0], { segments: 28, end: r40 });
      pipe(group, gas, r40, [[sign * (middle / 2 + reducer), 0, 0], [sign * LEG_X, 0, 0], [sign * LEG_X, 0, flangeFace]], D.elbow40CenterToFace);
      flange(group, paint, gas, [sign * LEG_X, 0, flangeFace], [sign * LEG_X, 0, JOINT_Z - HEADER_Z], { radius: 56 });
    }
    label('B', group, [-middle / 2 - 30, r50, 0], [-14, -40]);
  }

  { // C: 40A stubs welded through the wall ("챔버부 용접"), stationary.
    const paint = painter('C');
    const group = piece('C');
    const inner = JOINT_Z - D.stubLength;
    for (const sign of [-1, 1]) {
      rod(group, paint('steel'), PIPE_RADIUS(40), [sign * LEG_X, GAS_Y, inner], [sign * LEG_X, GAS_Y, JOINT_Z - D.stubFlange], { segments: 24 });
      flange(group, paint, paint('steel'), [sign * LEG_X, GAS_Y, JOINT_Z - D.stubFlange], [sign * LEG_X, GAS_Y, JOINT_Z], { radius: 56 });
      const weld = new THREE.Mesh(new THREE.TorusGeometry(PIPE_RADIUS(40) + 3, 3.2, 8, 28), paint('brass'));
      weld.position.set(sign * LEG_X, GAS_Y, WALL_Z);
      group.add(weld);
    }
    label('C', group, [LEG_X, GAS_Y + 24, JOINT_Z - 40], [36, -30]);
    links.push({ a: pieces.find((entry) => entry.id === 'B'), pointA: new THREE.Vector3(0, 0, 0), b: { group }, pointB: new THREE.Vector3(0, GAS_Y, JOINT_Z) });
  }

  { // F: chamber walls and the slotted top and bottom flanges.
    const paint = painter('F');
    const group = piece('F');
    const thickness = 9;
    const slotted = new THREE.ExtrudeGeometry(flangeShape(), { depth: thickness, bevelEnabled: false, curveSegments: 10 });
    for (const y of [D.height, thickness]) {
      const plate = new THREE.Mesh(slotted, paint('flange'));
      plate.rotation.x = Math.PI / 2;
      plate.position.y = y;
      group.add(plate);
    }
    const halfX = D.innerWidth / 2 + D.wall, height = D.height - 2 * thickness;
    for (const x of [-halfX, halfX]) block(group, paint('wall'), [D.wall, height, WALL_Z * 2], [x, D.height / 2, 0]);
    for (const z of [-WALL_Z, WALL_Z]) block(group, paint('wall'), [halfX * 2, height, D.wall], [0, D.height / 2, z]);
    const outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(halfX * 2, height, WALL_Z * 2)), new THREE.LineBasicMaterial({ color: 0x7f8e9a, transparent: true, opacity: .75 }));
    outline.position.y = D.height / 2;
    group.add(outline);
    label('F', group, [halfX, D.height, -WALL_Z * .55], [52, -24]);
  }

  { // E: H burner in 153 pitch modules, lifted clear of the chamber when exploded.
    const paint = painter('E');
    const RAISE = 1420, combLeg = combGeometry(MODULE - 4, 44, 40), crossLength = (LEG_X - 109) * 2 / 3, combCross = combGeometry(crossLength - 4, 44, 40, 7);
    let firstGroup = null;
    for (const sign of [-1, 1]) {
      for (let index = 0; index < 6; index++) {
        const z = -BURNER_HALF_LENGTH + MODULE / 2 + MODULE * index;
        const group = piece('E', [sign * LEG_X, BURNER_BOTTOM, z], [sign * 170, RAISE, (index - 2.5) * 30]);
        burnerModule(group, paint, MODULE, combLeg);
        if (index === 5) {
          block(group, paint('burnerRail'), [218, 240, 8], [0, 124, MODULE / 2 - 4]);
          links.push({ a: group, pointA: new THREE.Vector3(0, GAS_Y - BURNER_BOTTOM, MODULE / 2), b: { fixed: true }, pointB: new THREE.Vector3(sign * LEG_X, GAS_Y, JOINT_Z - D.stubLength) });
        }
        if (index === 0) block(group, paint('burnerRail'), [218, 240, 8], [0, 124, -MODULE / 2 + 4]);
        if (sign === -1 && index === 4) firstGroup = group;
      }
    }
    for (let index = 0; index < 3; index++) {
      const group = piece('E', [(index - 1) * crossLength, BURNER_BOTTOM, 0], [(index - 1) * 56, RAISE, 0]);
      const inner = new THREE.Group();
      inner.rotation.y = Math.PI / 2;
      group.add(inner);
      burnerModule(inner, paint, crossLength, combCross);
    }
    label('E', firstGroup, [0, BURNER_TOP - BURNER_BOTTOM, 0], [-46, -30]);
  }

  { // G: long members under the burner legs and the diagonals seen in the side view.
    const paint = painter('G');
    const group = piece('G');
    const length = D.innerDepth - 4;
    for (const sign of [-1, 1]) {
      const x = sign * LEG_X;
      block(group, paint('steel'), [218, 8, length], [x, BURNER_BOTTOM - 4, 0]);
      for (const side of [-105, 105]) block(group, paint('steel'), [8, 44, length], [x + side, BURNER_BOTTOM - 30, 0]);
      for (const z of [-1, 1]) strut(group, paint('bolt'), 46, 12, [x, BURNER_BOTTOM - 52, z * 407], [x, 395, z * 750]);
    }
    label('G', group, [-LEG_X, BURNER_BOTTOM - 40, -500], [-30, 50]);
  }

  { // H: outlines from the side view, kept translucent because they are hidden lines.
    const paint = painter('H');
    const group = piece('H');
    for (const sign of [-1, 1]) {
      const width = 283, x = sign * (128 + width / 2);
      block(group, paint('duct'), [width, 248, 821], [x, 653, 344.5]);
      block(group, paint('duct'), [width, 349, 669], [x, 478.5, 420.5]);
    }
    label('H', group, [270, 500, 500], [46, 34]);
  }

  { // K: sight glass plates above the 40A stubs.
    const paint = painter('K');
    let first = null;
    for (const sign of [-1, 1]) {
      const group = piece('K', [sign * LEG_X, SIGHT_Y, WALL_Z], [0, 0, 200]);
      first ||= group;
      block(group, paint('flange'), [257, 306, 6], [0, 0, 3]);
      rod(group, paint('steel'), 64, [0, 0, 6], [0, 0, 16], { segments: 40 });
      rod(group, paint('glass'), 38, [0, 0, 16], [0, 0, 17], { segments: 36 });
      for (let index = 0; index < 4; index++) {
        const angle = index * Math.PI / 2;
        rod(group, paint('bolt'), 6.5, [Math.cos(angle) * 51, Math.sin(angle) * 51, 14], [Math.cos(angle) * 51, Math.sin(angle) * 51, 21], { segments: 6 });
      }
      for (const x of [-112, 112]) for (const y of [-135, 0, 135]) rod(group, paint('bolt'), 8, [x, y, 5], [x, y, 12], { segments: 6 });
    }
    label('K', first, [0, 64, 16], [-46, -22]);
  }

  { // L: UV scanner on its Y fitting, and the air tube with its ball valve.
    const paint = painter('L');
    const group = piece('L', [0, 0, 0], [-40, 60, 330]);
    const x = -LEG_X;
    rod(group, paint('steel'), 14, [x, 956, 461], [x, 1006, 845], { segments: 16 });
    rod(group, paint('cast'), 21, [x, 1003, 822], [x, 1009, 868], { segments: 6 });
    rod(group, paint('steel'), 15, [x, 1009, 868], [x, 1017, 912], { segments: 16 });
    rod(group, paint('coil'), 17, [x, 1017, 912], [x, 1024, 958], { segments: 18 });
    rod(group, paint('lever'), 17.6, [x, 1019, 925], [x, 1021, 938], { segments: 18 });
    pipe(group, paint('cast'), 8.5, [[x, 1006, 845], [x + 60, 1014, 840], [x + 96, 1014, 840]]);
    const valve = new THREE.Group();
    valve.position.set(x + 118, 1014, 840);
    group.add(valve);
    ballValve(valve, paint, 'x', [.1, 1, 0], 40, 11);
    pipe(group, paint('steel'), 6.5, [[x + 138, 1014, 840], [-74, 1014, 840], [-74, 600, 840]], 34);
    label('L', group, [x, 1024, 958], [-34, -34]);
  }

  { // M: the spark and pilot gas ports in the middle of the wall.
    const paint = painter('M');
    const group = piece('M', [0, PORT_Y, WALL_Z], [0, 0, 190]);
    for (const x of [0, 96]) {
      rod(group, paint('cast'), 17, [x, 0, 0], [x, 0, 14], { segments: 6 });
      rod(group, paint('steel'), 8.5, [x, 0, 14], [x, 0, 44], { segments: 14 });
    }
    rod(group, paint('dial'), 7, [0, 0, 44], [0, 0, 62], { segments: 12 });
    pipe(group, paint('lever'), 3.4, [[0, 0, 62], [0, -8, 96], [60, -60, 112], [134, -90, 110]], 0, { smooth: true });
    label('M', group, [48, 0, 44], [0, -36]);
  }

  { // I and J: combustion fans, mirrored about the chamber centre line.
    const paint = painter('I'), motorPaint = painter('J');
    const HOUSING_TOP = 642, HOUSING = 124, NECK_TOP = 687, CONE_TOP = 788;
    const scroll = scrollGeometry(HOUSING - 6);
    let first = null, firstMotor = null;
    for (const sign of [-1, 1]) {
      const home = [sign * FAN_X, 0, FAN_Z], spread = sign * 70;
      const casing = piece('I', home, [spread, 20, 300]);
      casing.scale.x = -sign;
      const housing = new THREE.Mesh(scroll, paint('fan'));
      housing.rotation.x = Math.PI / 2;
      housing.position.y = HOUSING_TOP - 3;
      casing.add(housing);
      block(casing, paint('fan'), [196, 200, 10], [189, 576, WALL_Z - FAN_Z + 8]);
      block(casing, paint('lever'), [204, 208, 4], [189, 576, WALL_Z - FAN_Z + 2]);

      const cone = piece('I', home, [spread, 300, 300]);
      const profile = [[133, HOUSING_TOP], [133, NECK_TOP], [205, CONE_TOP - 4], [214, CONE_TOP - 4], [214, CONE_TOP]].map(([x, y]) => new THREE.Vector2(x, y));
      cone.add(new THREE.Mesh(new THREE.LatheGeometry(profile, 56), paint('fan')));
      rod(cone, paint('felt'), 210, [0, CONE_TOP - 8, 0], [0, CONE_TOP + 7, 0], { segments: 56 });
      rod(cone, paint('fan'), 150, [0, HOUSING_TOP, 0], [0, HOUSING_TOP + 7, 0], { segments: 40 });
      first ||= cone;

      const motor = piece('J', home, [spread, -300, 300]);
      motor.scale.x = -sign;
      const motorColor = motorPaint('motor');
      rod(motor, motorColor, 105, [0, 496, 0], [0, 518, 0], { segments: 36 });
      rod(motor, motorColor, 76, [0, 462, 0], [0, 496, 0], { segments: 30 });
      rod(motor, motorColor, 92, [0, 272, 0], [0, 462, 0], { segments: 36 });
      for (let index = 0; index < 18; index++) {
        const angle = index * Math.PI / 9;
        const fin = block(motor, motorColor, [5, 186, 10], [Math.cos(angle) * 96, 367, Math.sin(angle) * 96]);
        fin.rotation.y = -angle;
      }
      rod(motor, motorColor, 84, [0, 192, 0], [0, 272, 0], { segments: 36, end: 92 });
      block(motor, motorColor, [74, 96, 92], [130, 408, 0]);
      firstMotor ||= motor;
      link(casing, [0, HOUSING_TOP, 0], cone, [0, HOUSING_TOP, 0]);
      link(casing, [0, HOUSING_TOP - HOUSING, 0], motor, [0, 518, 0]);
      links.push({ a: casing, pointA: new THREE.Vector3(189, 576, WALL_Z - FAN_Z), b: { fixed: true }, pointB: new THREE.Vector3(sign * (FAN_X - 189), 576, WALL_Z) });
    }
    label('I', first, [150, CONE_TOP, 0], [-30, -30]);
    label('J', firstMotor, [-92, 300, 0], [-40, 30]);
  }

  { // N: thin air tubes from the outlet tee down to the small boxes.
    const paint = painter('N');
    const group = piece('N', [0, 0, 0], [0, -40, 300]);
    let boxPoint = null;
    for (const sign of [-1, 1]) {
      const x = sign * 74, z = 840;
      rod(group, paint('steel'), 6.5, [x, 376, z], [x, sign < 0 ? 600 : 628, z], { segments: 12 });
      rod(group, paint('cast'), 13, [x, 556, z], [x, 598, z], { segments: 6 });
      rod(group, paint('cast'), 7, [x, 575, z], [sign * 108, 575, z], { segments: 8 });
      rod(group, paint('cast'), 12, [x, 366, z], [x, 392, z], { segments: 6 });
      rod(group, paint('cast'), 7, [x, 372, z], [sign * 124, 372, z], { segments: 8 });
      block(group, paint('switch'), [80, 84, 50], [sign * 164, 360, z]);
      boxPoint ||= [sign * 164, 318, z];
    }
    label('N', group, boxPoint, [-36, 34]);
  }

  { // X: outside the sheets. Shown faintly from photo proportions, then faded away.
    const paint = painter('X');
    const group = piece('X');
    const ghost = paint('ghost');
    const hood = new THREE.Mesh(hoodGeometry(420), ghost);
    hood.position.y = D.height + 240;
    group.add(hood);
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(460, 460, 760, 64, 1, true), ghost);
    stack.position.y = D.height + 830;
    group.add(stack);
    block(group, ghost, [1240, 420, 1590], [0, -210, 0]);
    label('X', group, [460, D.height + 720, 0], [46, -10]);
  }

  // Dashed construction lines between pieces that separate.
  const linkMaterial = new THREE.LineDashedMaterial({ color: 0x5b7d90, dashSize: 34, gapSize: 26, transparent: true, opacity: .72 });
  const linkLines = new THREE.LineSegments(new THREE.BufferGeometry(), linkMaterial);
  linkLines.frustumCulled = false;
  root.add(linkLines);

  const worldPoint = new THREE.Vector3();
  function linkPoint(reference, point) {
    if (reference.fixed) return worldPoint.copy(point);
    const group = reference.isObject3D ? reference : reference.group;
    return worldPoint.copy(point).multiply(group.scale).add(group.position);
  }
  let highlighted = null, contextFade = 1;
  function applyLook() {
    records.get('X').pieces[0].group.visible = contextFade > .01 || highlighted === 'X';
    for (const record of records.values()) {
      const selected = record.id === highlighted, dimmed = highlighted && !selected;
      for (const material of record.materials.values()) {
        const base = material.userData.base ??= { opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite, emissive: material.emissive.getHex(), intensity: material.emissiveIntensity };
        material.emissive.setHex(selected ? 0xe0641c : base.emissive);
        material.emissiveIntensity = selected ? .5 : base.intensity;
        const transparent = base.transparent || Boolean(dimmed);
        if (material.transparent !== transparent) { material.transparent = transparent; material.needsUpdate = true; }
        material.depthWrite = dimmed ? false : base.depthWrite;
        const opacity = record.id === 'X' ? base.opacity * contextFade : base.opacity;
        material.opacity = dimmed ? Math.min(opacity, .2) : selected && base.transparent ? Math.max(opacity, .42) : opacity;
      }
    }
  }
  function setExplode(amount, hideContext = false) {
    for (const entry of pieces) entry.group.position.copy(entry.home).addScaledVector(entry.offset, amount);
    contextFade = hideContext ? 0 : Math.max(0, 1 - amount * 2.4);
    applyLook();
    linkLines.visible = amount > .03;
    if (!linkLines.visible) return;
    const positions = [];
    for (const { a, pointA, b, pointB } of links) {
      positions.push(...linkPoint(a, pointA).toArray());
      positions.push(...linkPoint(b, pointB).toArray());
    }
    linkLines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    linkLines.computeLineDistances();
  }

  function setHighlight(id) { highlighted = id; applyLook(); }

  const pickable = [];
  root.traverse((object) => {
    if (!object.isMesh) return;
    let owner = object;
    while (owner && !owner.userData.drawingPart) owner = owner.parent;
    object.userData.drawingPart = owner?.userData.drawingPart;
    pickable.push(object);
  });
  const SEE_THROUGH = new Set(['F', 'H', 'X']);
  function pick(raycaster) {
    const hits = raycaster.intersectObjects(pickable, false).filter(({ object }) => object.visible);
    const solid = hits.find(({ object }) => !SEE_THROUGH.has(object.userData.drawingPart) || !object.material.transparent);
    return (solid || hits[0])?.object.userData.drawingPart ?? null;
  }
  function anchorOf(id, target) {
    const { anchor } = records.get(id);
    return target.copy(anchor.point).applyMatrix4(anchor.group.matrixWorld);
  }
  function dispose() {
    root.traverse((object) => {
      object.geometry?.dispose();
      if (object.isLineSegments) object.material.dispose();
    });
    for (const record of records.values()) for (const material of record.materials.values()) material.dispose();
  }
  setExplode(0);
  return { root, records, pieces, setExplode, setHighlight, pick, anchorOf, dispose };
}

// Printed dimensions shown on the assembled view, in the scene frame.
export const DIMENSION_LINES = Object.freeze([
  { label: String(D.trainLength), from: [INLET_X, GAS_Y - 240, GAS_Z + 120], to: [INLET_X + D.trainLength, GAS_Y - 240, GAS_Z + 120] },
  { label: String(D.flangeToHoseAxis), from: [INLET_X + D.trainLength, GAS_Y - 240, GAS_Z + 120], to: [0, GAS_Y - 240, GAS_Z + 120] },
  { label: String(D.flangeWidth), from: [-D.flangeWidth / 2, D.height + 40, D.flangeDepth / 2 + 60], to: [D.flangeWidth / 2, D.height + 40, D.flangeDepth / 2 + 60] },
  { label: String(D.flangeDepth), from: [D.flangeWidth / 2 + 60, D.height + 40, -D.flangeDepth / 2], to: [D.flangeWidth / 2 + 60, D.height + 40, D.flangeDepth / 2] },
  { label: String(D.height), from: [D.flangeWidth / 2 + 60, 0, D.flangeDepth / 2], to: [D.flangeWidth / 2 + 60, D.height, D.flangeDepth / 2], at: .24 },
  { label: String(D.stubSpacing), from: [-LEG_X, GAS_Y + 46, JOINT_Z + 40], to: [LEG_X, GAS_Y + 46, JOINT_Z + 40] },
  { label: String(D.wallToPipe), from: [D.flangeWidth / 2 + 60, GAS_Y, WALL_Z], to: [D.flangeWidth / 2 + 60, GAS_Y, GAS_Z] },
]);
export const FLOW_TAG = Object.freeze({ label: 'GAS INLET', at: [INLET_X - 40, GAS_Y, GAS_Z] });
