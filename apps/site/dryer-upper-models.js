import * as THREE from '../shared/vendor/three.module.js';
import { buildFurnace } from './furnace-model.js';

// A016/A017/A019 determine floor ownership and openings. Dimensions of the
// photographed machines remain qualified approximations, distinct from holes.
const TAU = Math.PI * 2, UP = new THREE.Vector3(0, 1, 0);
function tools(s) {
  const m = s.dryerUpperMaterials ||= {
    steel: s.mat.steel, trim: s.mat.trim, dark: s.mat.dark, white: s.mat.white,
    floor: s._material(0x397762, .94, .02), cream: s._material(0xd8d5c5, .78, .1),
    motor: s._material(0x87a8a0, .55, .34), grayMotor: s._material(0xacaeaa, .6, .25),
    red: s._material(0x98534d, .76, .18), yellow: s.mat.yellow,
    wrap: s._material(0xc4c9c4, .5, .65), concrete: s._material(0x858980, .98, 0),
    roof: s._material(0xb2b4a8, .8, .2), apron: s._material(0x676e65, .99, 0),
    tank: s._material(0xb9c0af, .72, .16), glass: s._material(0xc1d2cf, .25, .03, { transparent: true, opacity: .28, depthWrite: false }),
    innerSteel: s._material(0xbfc6c2, .44, .65, { side: THREE.DoubleSide }),
    blue: s._material(0x4774a2, .59, .2), black: s.mat.black,
    cabinet: s._material(0x91a29b, .72, .2), orange: s._material(0xc68a45, .65, .15),
  };
  const cache = s.dryerUpperGeometry ||= new Map();
  const geo = (key, make) => { if (!cache.has(key)) { const value = make(); cache.set(key, value); s.geometries.add(value); } return cache.get(key); };
  const mesh = (parent, geometry, material, position = [0, 0, 0]) => s._mesh(geometry, material, parent, position);
  const box = (parent, size, position, paint = 'steel') => mesh(parent, geo(`b:${size}`, () => new THREE.BoxGeometry(...size)), m[paint] || paint, position);
  const cyl = (parent, r, h, position, paint = 'steel', axis = 'y', bottom = r, open = false) => {
    const object = mesh(parent, geo(`c:${r}:${bottom}:${h}:${open}`, () => new THREE.CylinderGeometry(r, bottom, h, 48, 1, open)), m[paint] || paint, position);
    if (axis === 'x') object.rotation.z = -Math.PI / 2; if (axis === 'z') object.rotation.x = Math.PI / 2; return object;
  };
  const ring = (parent, r, tube, position, paint = 'trim', axis = 'y') => {
    const object = mesh(parent, geo(`t:${r}:${tube}`, () => new THREE.TorusGeometry(r, tube, 6, 64)), m[paint] || paint, position);
    if (axis === 'y') object.rotation.x = Math.PI / 2; if (axis === 'x') object.rotation.y = Math.PI / 2; return object;
  };
  const bar = (parent, start, end, r = .025, paint = 'trim') => {
    const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end), object = cyl(parent, r, a.distanceTo(b), a.clone().add(b).multiplyScalar(.5).toArray(), paint);
    object.quaternion.setFromUnitVectors(UP, b.sub(a).normalize()); return object;
  };
  const pipe = (parent, points, r, paint = 'steel') => {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
    mesh(parent, geo(`p:${r}:${JSON.stringify(points)}`, () => new THREE.TubeGeometry(curve, Math.max(24, Math.min(192, points.length * 8)), r, 16, false)), m[paint] || paint);
    return curve;
  };
  const instances = (parent, geometry, paint, transforms) => {
    const object = new THREE.InstancedMesh(geometry, m[paint] || paint, transforms.length), dummy = new THREE.Object3D();
    transforms.forEach((entry, i) => { dummy.position.set(...entry.position); dummy.quaternion.copy(entry.quaternion || new THREE.Quaternion()); dummy.scale.set(...(entry.scale || [1, 1, 1])); dummy.updateMatrix(); object.setMatrixAt(i, dummy.matrix); });
    object.instanceMatrix.needsUpdate = true; object.computeBoundingBox(); object.computeBoundingSphere(); object.castShadow = object.receiveShadow = true; parent.add(object); s.geometries.add(geometry); return object;
  };
  const bolts = (parent, points, axis = 'z', size = .022, paint = 'trim') => instances(parent, geo(`bolt:${size}`, () => new THREE.CylinderGeometry(size, size, size * .85, 6)), paint, points.map((position) => ({ position, quaternion: axis === 'y' ? new THREE.Quaternion() : new THREE.Quaternion().setFromUnitVectors(UP, new THREE.Vector3(...(axis === 'x' ? [1, 0, 0] : [0, 0, 1]))) })));
  const flange = (parent, r, centre, axis = 'y', paint = 'trim', count = 16) => {
    cyl(parent, r, .055, centre, paint, axis);
    bolts(parent, Array.from({ length: count }, (_, i) => { const a = i * TAU / count, p = [...centre]; if (axis === 'y') { p[0] += Math.cos(a) * r * .88; p[2] += Math.sin(a) * r * .88; p[1] += .04; } else if (axis === 'x') { p[1] += Math.cos(a) * r * .88; p[2] += Math.sin(a) * r * .88; p[0] += .04; } else { p[0] += Math.cos(a) * r * .88; p[1] += Math.sin(a) * r * .88; p[2] += .04; } return p; }), axis);
  };
  const ibeam = (parent, start, end, width = .25, depth = .3, paint = 'cream') => {
    const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end), group = s._group(parent, a.clone().add(b).multiplyScalar(.5).toArray()), length = a.distanceTo(b), t = Math.min(width, depth) * .13;
    group.quaternion.setFromUnitVectors(UP, b.sub(a).normalize());
    for (const z of [-depth / 2 + t / 2, depth / 2 - t / 2]) box(group, [width, length, t], [0, 0, z], paint);
    box(group, [t, length, depth - 2 * t], [0, 0, 0], paint); return group;
  };
  return { m, geo, mesh, box, cyl, ring, bar, pipe, instances, bolts, flange, ibeam };
}

function accessDoor(s, h, parent, width, height, position) {
  const group = s._group(parent, position);
  h.box(group, [width + .12, height + .12, .07], [0, 0, 0], 'dark'); h.box(group, [width, height, .065], [0, 0, .055]);
  for (const side of [-1, 1]) for (let i = 0; i < 5; i++) {
    const y = -height * .42 + i * height * .21;
    h.cyl(group, .028, .14, [side * (width / 2 + .075), y, .07], 'trim');
    h.bar(group, [side * (width / 2 + .09), y, .09], [side * (width / 2 - .03), y + .04, .13], .014);
  }
  for (const x of [-width * .32, width * .32]) for (const y of [-height / 2 - .02, height / 2 + .02]) h.box(group, [.16, .035, .09], [x, y, .1], 'trim');
  const x = width * .31;
  h.bar(group, [x, -.25, .11], [x, -.25, .22], .02); h.bar(group, [x, -.25, .22], [x, .3, .22], .025); h.bar(group, [x, .3, .22], [x, .3, .11], .02);
  h.cyl(group, .12, .1, [-width * .4, -height * .4, .16], 'trim', 'z'); h.ring(group, .12, .018, [-width * .4, -height * .4, .22], 'trim', 'z');
  // The warning plaque colors are visible; unreadable lettering is not invented.
  h.box(group, [.18, .24, .012], [-width * .7, .1, .08], 'white'); h.box(group, [.18, .045, .014], [-width * .7, .01, .09], 'blue');
  return group;
}

function roofWaterTank(s, root, item, h) {
  const w = item.width || 4.2, d = item.depth || 3, height = item.height || 2.3;
  const body = s._part(root, '물탱크 외함·패널', [-.5, .1, 0]);
  h.box(body, [w, height - .3, d], [0, height / 2 + .05, 0], 'tank');
  for (const x of [-w / 2, 0, w / 2]) h.box(body, [.025, height - .32, .025], [x, height / 2 + .05, d / 2 + .012], 'trim');
  for (const x of [-w * .34, w * .34]) for (const z of [-d * .31, d * .31]) h.box(body, [.5, .22, .5], [x, .11, z], 'floor');
  const lid = s._part(root, '상부 덮개·모서리', [0, .8, 0]); h.box(lid, [w + .04, .08, d + .04], [0, height - .04, 0], 'tank');
  const pipes = s._part(root, '은색 보온 배관·받침', [.35, .1, .7]);
  h.pipe(pipes, [[-w * .3, .45, d / 2], [-w * .3, .45, d / 2 + .45], [w * .5, .45, d / 2 + .45]], .13, 'wrap');
  for (const x of [-w * .3, w * .35]) { h.box(pipes, [.28, .32, .4], [x, .16, d / 2 + .45], 'floor'); h.ring(pipes, .138, .018, [x, .45, d / 2 + .45], 'trim', 'x'); }
  h.box(body, [.45, .34, .015], [w * .28, height * .76, d / 2 + .022], 'white'); h.box(body, [.45, .05, .017], [w * .28, height * .86, d / 2 + .024], 'red');
  root.userData.observedCapacityPlate = { totalTon: 20, fireWaterTon: 9, representsCurrentContents: false };
}

function roofShell(s, root, item, h) {
  const r = (item.width || 3.4) / 2, height = item.height || 5.8;
  const base = s._part(root, '확장 원추 받침·기초', [0, -.2, 0]);
  h.cyl(base, r, .12, [0, .06, 0], 'concrete'); h.cyl(base, r * .77, .48, [0, .36, 0], 'steel', 'y', r);
  const shell = s._part(root, '하부 분할 점검 외피', [-.75, .1, 0]);
  h.cyl(shell, r * .77, height * .23, [0, .6 + height * .115, 0]);
  for (const y of [.62, .6 + height * .23]) h.flange(shell, r * .79, [0, y, 0], 'y', 'trim', 28);
  for (let i = 0; i < 10; i++) { const a = i * TAU / 10, rib = h.box(shell, [.035, height * .22, .04], [Math.cos(a) * r * .777, .6 + height * .115, Math.sin(a) * r * .777], 'trim'); rib.rotation.y = -a; }
  h.cyl(shell, .12, .08, [.5, .82, r * .75], 'trim', 'z'); h.flange(shell, .15, [.5, .82, r * .75 + .04], 'z', 'trim', 6);
  const upper = s._part(root, '상부 외피·좁은 수직관', [0, 1.3, 0]);
  const bottom = .6 + height * .23, largeTop = height * .69;
  h.cyl(upper, r * .85, largeTop - bottom, [0, (bottom + largeTop) / 2, 0]);
  for (const y of [bottom, largeTop]) h.flange(upper, r * .86, [0, y, 0], 'y', 'trim', 28);
  h.cyl(upper, r * .52, height - largeTop - .15, [0, (largeTop + height - .15) / 2, 0]); h.ring(upper, r * .53, .018, [0, height - .15, 0]);
  const ladder = s._part(root, '고정 사다리·케이지', [.75, .2, .35]);
  const z = r * .85;
  for (const x of [-.23, .23]) h.bar(ladder, [x, .25, z], [x, height, z], .025);
  for (let y = .4; y < height; y += .28) h.bar(ladder, [-.23, y, z], [.23, y, z], .02);
  for (let y = 2; y < height; y += .62) {
    const points = Array.from({ length: 17 }, (_, i) => [Math.cos(i * Math.PI / 16) * .34, y, z - .2 + Math.sin(i * Math.PI / 16) * .34]); h.pipe(ladder, points, .017);
  }
  for (const x of [-.31, 0, .31]) h.bar(ladder, [x, 2, z + .1], [x, height, z + .1], .016);
  root.userData.unitCount = 1; root.userData.functionConfirmed = false;
}

function roofDrive(s, root, item, h) {
  const frame = s._part(root, '백색 이중 프레임·방진 받침', [0, -.1, 0]);
  for (const y of [.16, .44]) for (const z of [-.63, .63]) h.ibeam(frame, [-1.1, y, z], [1.1, y, z], .15, .2, 'white');
  for (const x of [-.86, .83]) for (const y of [.16, .44]) h.ibeam(frame, [x, y, -.63], [x, y, .63], .14, .16, 'white');
  for (const x of [-.8, .6]) for (const z of [-.45, .45]) { h.cyl(frame, .105, .15, [x, .3, z], 'black'); h.cyl(frame, .15, .03, [x, .39, z], 'white'); }
  h.bolts(frame, [-.9, .82].flatMap(x => [-.61, .61].map(z => [x, .55, z])), 'y', .03);
  const motor = s._part(root, '회색 수평 모터·통풍 엔드·외부 축', [-.65, .2, 0]);
  const motorBody = h.cyl(motor, .47, 1.08, [-.4, 1.06, 0], 'grayMotor', 'x', .47, true); motorBody.name = 'elevator-visible-motor-body';
  for (const x of [-.89, .08]) h.ring(motor, .478, .024, [x, 1.06, 0], 'grayMotor', 'x');
  h.cyl(motor, .44, .025, [.15, 1.06, 0], 'grayMotor', 'x');
  const grill = s._group(motor, [-.96, 1.06, 0]); grill.name = 'elevator-motor-radial-vent';
  h.cyl(grill, .435, .016, [.008, 0, 0], 'dark', 'x');
  for (const r of [.19, .285, .375, .455]) h.ring(grill, r, .018, [-.015, 0, 0], 'grayMotor', 'x');
  for (let i = 0; i < 8; i++) { const a = i * TAU / 8; h.bar(grill, [-.032, Math.cos(a) * .16, Math.sin(a) * .16], [-.032, Math.cos(a) * .455, Math.sin(a) * .455], .023, 'grayMotor'); }
  h.cyl(grill, .155, .11, [-.06, 0, 0], 'trim', 'x'); h.cyl(grill, .13, .1, [-.14, 0, 0], 'black', 'x'); h.cyl(grill, .065, .08, [-.22, 0, 0], 'dark', 'x');
  for (const x of [-.72, -.04]) for (const z of [-.27, .27]) { h.box(motor, [.19, .18, .18], [x, .58, z], 'grayMotor'); h.bar(motor, [x, .6, z * 1.4], [x, .89, z], .035, 'grayMotor'); }
  const eye = h.ring(motor, .073, .018, [-.38, 1.6, 0], 'grayMotor', 'z'); eye.name = 'elevator-motor-lifting-eye';
  const casing = s._part(root, '대형 수직 기계외함·보이는 상부 원통', [.3, .4, -.3]);
  h.cyl(casing, .57, .32, [.24, 1.2, -.02], 'grayMotor', 'x'); h.box(casing, [.32, .75, .66], [.24, .65, -.02], 'grayMotor');
  h.ring(casing, .51, .02, [.065, 1.2, -.02], 'grayMotor', 'x'); h.bolts(casing, Array.from({ length: 10 }, (_, i) => [.055, 1.2 + Math.cos(i * TAU / 10) * .49, -.02 + Math.sin(i * TAU / 10) * .49]), 'x', .024);
  h.cyl(casing, .19, .5, [.14, 1.7, -.28], 'grayMotor', 'x'); h.box(casing, [.32, .065, .38], [.14, 1.48, -.28], 'grayMotor');
  h.cyl(casing, .12, .2, [.05, 1.06, 0], 'trim', 'x');
  const pulley = s._part(root, '대형 원형 풀리·노출 스포크·외부 로프', [.5, .3, .45]);
  const wheel = s._group(pulley, [.57, 1.13, 0]); wheel.name = 'elevator-open-spoked-wheel';
  h.ring(wheel, .68, .07, [0, 0, 0], 'red', 'x'); h.ring(wheel, .635, .035, [.075, 0, 0], 'dark', 'x'); h.cyl(wheel, .18, .18, [0, 0, 0], 'dark', 'x');
  for (let i = 0; i < 5; i++) { const a = i * TAU / 5; h.bar(wheel, [.055, Math.cos(a) * .14, Math.sin(a) * .14], [.055, Math.cos(a) * .62, Math.sin(a) * .62], .046, 'dark'); }
  for (const x of [-.045, -.015, .015, .045]) { h.ring(wheel, .701, .012, [x, 0, 0], 'black', 'x'); for (const z of [-.7, .7]) h.bar(pulley, [.57 + x, .1, z], [.57 + x, 1.13, z], .009, 'black'); }
  pulley.userData.ropeCountBasis = 'representative-visible-bundle;individual-count-unconfirmed';
  const guard = s._part(root, '황색 다면 상부 가드·지지대', [.4, .65, .2]); guard.name = 'elevator-yellow-faceted-guard';
  const guardPoints = [[.72, .47, -.82], [.72, 1.69, -.82], [.72, 2.06, -.5], [.72, 2.06, .5], [.72, 1.69, .82], [.72, .47, .82]];
  for (let i = 1; i < guardPoints.length; i++) { const a = new THREE.Vector3(...guardPoints[i - 1]), b = new THREE.Vector3(...guardPoints[i]), p = h.box(guard, [.19, a.distanceTo(b), .13], a.clone().add(b).multiplyScalar(.5).toArray(), 'yellow'); p.quaternion.setFromUnitVectors(UP, b.sub(a).normalize()); }
  for (const z of [-.82, .82]) h.box(guard, [.21, .16, .21], [.72, .44, z], 'grayMotor');
  const wiring = s._part(root, '모터 접속함·주황 조작함·전선 루프', [.15, .1, -.5]);
  h.box(wiring, [.39, .49, .27], [-.35, 1.02, .54], 'grayMotor');
  h.pipe(wiring, [[-.38, .89, .68], [-.49, .42, .74], [-.2, .21, .72], [.14, .27, .68]], .024, 'black');
  h.pipe(wiring, [[-.88, 1.05, .02], [-.92, .6, .11], [-.56, .46, .35], [.1, .32, .55]], .017, 'black');
  h.box(wiring, [.4, .18, .3], [.74, .18, .37], 'orange'); h.box(wiring, [.24, .14, .18], [.1, 1.71, -.28], 'orange');
  for (const x of [.62, .78, .88]) h.cyl(wiring, .026, .016, [x, .278, .39], x === .62 ? 'red' : 'black');
  root.userData.roomUse = 'elevator-machine-room'; root.userData.roomUseConfirmed = true; root.userData.driveTypeConfirmed = false;
  root.userData.functionConfirmed = false;
  root.userData.observationBasis = 'video-069-087-102-105s;external-apparatus-only';
}

function chamber(s, root, item, h) {
  const r = item.radius || 3.8, height = item.height || 6.4;
  const base = s._part(root, '바닥 관통 외함·녹색 턱', [0, 0, 0]);
  const kerb = h.mesh(base, h.geo(`chamber-kerb:${r}`, () => new THREE.RingGeometry(r - .05, r + .34, 80)), h.m.floor, [0, .14, 0]); kerb.rotation.x = -Math.PI / 2;
  h.cyl(base, r + .06, .16, [0, .08, 0], 'trim', 'y', r + .06, true);
  for (let i = 0; i < 3; i++) {
    const y = height * i / 3, shell = s._part(root, ['하단 원통 외피', '중단 원통 외피', '상단 연결 외피'][i], [i === 1 ? -1.0 : 0, i * .45, 0], [0, y, 0]);
    h.cyl(shell, r, height / 3, [0, height / 6, 0], 'innerSteel', 'y', r, true);
    for (const yy of [.025, height / 3 - .025]) h.ring(shell, r + .012, .018, [0, yy, 0]);
    const seams = []; for (let n = 0; n < 12; n++) { const a = n * TAU / 12; seams.push({ position: [Math.cos(a) * r, height / 6, Math.sin(a) * r], quaternion: new THREE.Quaternion().setFromAxisAngle(UP, -a) }); }
    h.instances(shell, h.geo(`chamber-seam:${height}`, () => new THREE.BoxGeometry(.011, height / 3 - .03, .011)), 'trim', seams);
  }
  const door = s._part(root, '다중 잠금 점검문·원형 포트', [0, .1, 1.4], [0, 1.7, r + .035]); accessDoor(s, h, door, 1.4, 2.03, [0, 0, 0]);
  const services = s._part(root, '외부 얇은 배관·고정 클램프', [.5, .1, .3]);
  for (const x of [-1.15, 1.15]) {
    const z = Math.sqrt(r * r - x * x) + .05;
    h.pipe(services, [[x, .35, z], [x, 2, z], [x, height - .3, z], [x * .5, height - .17, r + .1]], .025);
    for (const y of [1, 2.3, 3.6, 5.0]) if (y < height) h.box(services, [.15, .035, .06], [x, y, z], 'trim');
  }
  root.userData.openAtTop = true; root.userData.connectsUpperWell = 'dryer-chamber-upper-well';
}

function upperWell(s, root, item, h) {
  const r = item.radius || 4.3, top = item.height || .8, down = item.belowFloor || 1;
  const cone = s._part(root, '관찰 웰 경사 외피·원형 림', [0, .7, 0]);
  h.cyl(cone, r - .035, top + down, [0, (top - down) / 2, 0], 'innerSteel', 'y', .65, true);
  h.ring(cone, r, .045, [0, top, 0]); h.cyl(cone, r, .16, [0, top - .08, 0], 'innerSteel', 'y', r, true);
  const rim = s._part(root, '체커 점검 보행면·분리 판', [.4, 0, .6]);
  const ring = h.mesh(rim, h.geo(`well-walk:${r}`, () => {
    const g = new THREE.RingGeometry(r, r + .55, 96), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), length = Math.hypot(x, y); if (length > r + .1) { const inset = THREE.MathUtils.clamp((y / length - .75) / .2, 0, 1) * .3, scale = (r + .55 - inset) / length; p.setXY(i, x * scale, y * scale); } }
    g.computeBoundingBox(); g.computeBoundingSphere(); return g;
  }), h.m.trim, [0, .025, 0]); ring.rotation.x = -Math.PI / 2;
  const checker = [], railPoints = [];
  for (let i = 0; i < 96; i++) {
    const a = i * TAU / 96, outer = r + .55 - THREE.MathUtils.clamp((-Math.sin(a) - .75) / .2, 0, 1) * .3, rr = (r + outer) / 2;
    checker.push({ position: [Math.cos(a) * rr, .032, Math.sin(a) * rr], quaternion: new THREE.Quaternion().setFromAxisAngle(UP, -a + Math.PI / 4) });
    railPoints.push([Math.cos(a) * (outer - .03), .06, Math.sin(a) * (outer - .03)]);
  }
  h.instances(rim, h.geo('upper-well-annular-checker', () => new THREE.BoxGeometry(.1, .008, .025)), 'steel', checker);
  const guard = s._group(rim); guard.name = 'dryer-well-perimeter-guard';
  for (let i = 0; i < railPoints.length; i += 5) { const [x, y, z] = railPoints[i]; h.bar(guard, [x, y, z], [x, 1.18, z], .022, 'white'); }
  for (const y of [.62, 1.18]) h.pipe(guard, [...railPoints, railPoints[0]].map(([x, , z]) => [x, y, z]), .022, 'white');
  Object.assign(guard.userData, { source: 'video-432-444-468s', dimensionsMeasured: false, northEdgeInsetForObservedDuct: true });
  h.box(rim, [1.05, .06, .85], [0, -.62, .3]);
  const plates = []; for (let x = -.45; x <= .45; x += .12) for (let z = -.05; z <= .65; z += .13) plates.push({ position: [x, -.584, z], quaternion: new THREE.Quaternion().setFromAxisAngle(UP, Math.PI / 4) });
  h.instances(rim, h.geo('checker-detail', () => new THREE.BoxGeometry(.08, .008, .022)), 'steel', plates);
  const visible = s._part(root, '보이는 중앙 커버·호스·고정부', [.2, .4, -.5]);
  h.box(visible, [.79, .46, .67], [0, -.85, -.05]);
  for (const [i, x] of [-.28, -.03, .25].entries()) h.pipe(visible, [[x, -.7, -.12], [x - .15, -.05 + i * .04, -.15], [x + .05, .15, .05], [x + .3, -.65, .3]], .025, 'black');
  const hose = h.pipe(visible, [[-1.1, -.05, -.25], [-.8, -.2, -.3], [-.6, -.6, -.15], [-.35, -.76, -.12]], .07, 'yellow');
  const hoops = []; for (let i = 1; i < 22; i++) hoops.push({ position: hose.getPointAt(i / 22).toArray(), quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), hose.getTangentAt(i / 22)) });
  h.instances(visible, h.geo('well-hose-ridge', () => new THREE.TorusGeometry(.073, .009, 4, 16)), 'yellow', hoops);
  for (let i = 0; i < 8; i++) { const a = i * TAU / 8; h.box(visible, [.045, .12, .045], [Math.cos(a) * r * .7, .1, Math.sin(a) * r * .7], 'trim'); }
  root.userData.notAdditionalChamber = true; root.userData.observationOnly = true;
}

function upperDuctRun(s, root, item, h) {
  const body = s._part(root, '대형 수평 은색 덕트·하향 엘보', [0, .7, -.5]);
  const r = .7, y = 1.45, start = -2.4, end = 3.3;
  const main = h.cyl(body, r, end - start, [(start + end) / 2, y, 0], 'steel', 'x', r, true); main.name = 'dryer-upper-large-horizontal-duct';
  h.pipe(body, [[-3.4, .25, 0], [-3.4, .7, 0], [-3.15, 1.2, 0], [-2.75, y, 0], [start, y, 0]], r); 
  for (const x of [-2.35, -.8, .8, 2.9]) h.ring(body, r + .005, .018, [x, y, 0], 'trim', 'x');
  const access = s._part(root, '원형 점검 뚜껑·클램프·관찰 접속부', [.2, .15, .65]);
  h.flange(access, .27, [.1, y, r + .015], 'z', 'trim', 8); h.cyl(access, .235, .03, [.1, y, r + .05], 'steel', 'z');
  h.bar(access, [.05, y - .07, r + .083], [.05, y + .07, r + .083], .016); h.bar(access, [.15, y - .07, r + .083], [.15, y + .07, r + .083], .016);
  h.cyl(access, .39, .1, [end + .045, y, 0], 'trim', 'x', .39, true); h.ring(access, .395, .022, [end + .105, y, 0], 'trim', 'x');
  const supports = s._part(root, '보이는 덕트 받침·금속 이음', [0, -.15, .35]);
  for (const x of [-1.5, 2]) { h.box(supports, [.2, .54, .7], [x, .27, 0], 'cream'); h.bar(supports, [x, .48, -.38], [x, .86, -.49], .027, 'trim'); h.bar(supports, [x, .48, .38], [x, .86, .49], .027, 'trim'); }
  Object.assign(root.userData, { observationOnly: true, processFunctionConfirmed: false, source: 'video-400-432s', positionBasis: 'photo-and-A017-approximation', hiddenConnectionsConfirmed: false, ports: { right: [end + .105, y, 0] } });
}

function upperTaperedHousing(s, root, item, h) {
  const shell = s._part(root, '사각 주 외함·경사 전이 외피', [.4, .4, -.3]);
  const tapered = h.geo('dryer-upper-tapered-observed-housing', () => {
    const g = new THREE.BoxGeometry(1, 1, 1), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const small = p.getX(i) < 0; p.setXYZ(i, small ? -.9 : 0, p.getY(i) * (small ? .95 : 2.1) + (small ? 1.45 : 1.35), p.getZ(i) * (small ? .85 : 1.85)); }
    g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere(); return g;
  });
  h.mesh(shell, tapered, h.m.steel); h.box(shell, [1.2, 2.1, 1.85], [.6, 1.35, 0]);
  for (const x of [.04, 1.18]) for (const z of [-.94, .94]) h.box(shell, [.045, 2.14, .035], [x, 1.35, z], 'trim');
  const connection = s._part(root, '짧은 원통 연결관·플랜지·보이는 커플링', [-.6, .15, 0]);
  h.cyl(connection, .36, .5, [-1.15, 1.45, 0], 'steel', 'x', .36, true);
  h.flange(connection, .405, [-1.405, 1.45, 0], 'x', 'trim', 12); h.ring(connection, .28, .025, [-.89, 1.45, 0], 'motor', 'x');
  h.box(connection, [.035, .055, .13], [-1.16, 1.49, .36], 'dark');
  const supports = s._part(root, '각관 다리·볼트 발판·상부 작은 배관', [.1, -.15, .35]);
  for (const x of [-.2, 1]) for (const z of [-.75, .75]) { h.box(supports, [.075, .36, .075], [x, .18, z], 'trim'); h.box(supports, [.25, .028, .24], [x, .014, z], 'trim'); h.bolts(supports, [[x - .075, .038, z - .065], [x + .075, .038, z + .065]], 'y', .018); }
  h.pipe(supports, [[-.35, 2.32, -.7], [-.35, 2.5, -.7], [.55, 2.5, -.7], [.8, 2.34, -.7]], .025, 'trim');
  Object.assign(root.userData, { observationOnly: true, processFunctionConfirmed: false, source: 'video-414-420s', positionBasis: 'photo-and-A017-approximation', hiddenInternalMechanismAdded: false, ports: { left: [-1.405, 1.45, 0] } });
}

function blower(s, root, item, h) {
  const frame = s._part(root, '붉은 H형 점검 프레임·가새', [-.3, -.1, 0]);
  for (const x of [-2.12, 2.12]) for (const z of [-1.52, 1.52]) {
    h.ibeam(frame, [x, .06, z], [x, 1.55, z], .22, .24, 'red'); h.box(frame, [.36, .07, .36], [x, .035, z], 'trim');
  }
  for (const z of [-1.52, 1.52]) { h.ibeam(frame, [-2.2, 1.52, z], [2.2, 1.52, z], .2, .24, 'red'); h.ibeam(frame, [-2.12, .15, z], [2.12, 1.48, z], .09, .1, 'red'); }
  const bed = s._part(root, '백색 이중 받침·청색 방진부', [0, .65, 0]);
  for (const y of [1.59, 1.88]) for (const z of [-1.2, 1.2]) h.ibeam(bed, [-2.12, y, z], [2.12, y, z], .18, .2, 'white');
  for (const x of [-1.45, 1.45]) for (const z of [-.9, .9]) { h.cyl(bed, .12, .19, [x, 1.73, z], 'blue'); h.box(bed, [.3, .035, .3], [x, 1.84, z], 'trim'); }
  const casing = s._part(root, '대형 케이싱·리브·원형 플랜지', [-.7, .2, -.4], [-.5, 2.92, -.25]);
  const shape = new THREE.Shape(); shape.moveTo(-1.27, -.95); shape.bezierCurveTo(-1.73, .25, -1.15, 1.43, .3, 1.25); shape.bezierCurveTo(1.45, 1.08, 1.7, -.27, .95, -1.03); shape.lineTo(-1.27, -1.03); shape.closePath();
  h.mesh(casing, h.geo('upper-blower-volute', () => new THREE.ExtrudeGeometry(shape, { depth: 1.02, bevelEnabled: false, curveSegments: 28 })), h.m.steel, [0, 0, -.55]);
  h.box(casing, [1.05, .55, 1.15], [.3, 1.305, -.05]);
  h.flange(casing, 1.19, [-.12, 0, .53], 'z', 'trim', 24); h.cyl(casing, .92, .03, [-.12, 0, .58], 'dark', 'z');
  for (let i = 0; i < 8; i++) { const a = i * TAU / 8; h.bar(casing, [-.12 + Math.cos(a) * .99, Math.sin(a) * .99, .58], [-.12 + Math.cos(a) * 1.35, Math.sin(a) * 1.35, .51], .035); }
  accessDoor(s, h, casing, .51, .47, [.58, -.1, .51]);
  const motor = s._part(root, '청록색 수평 모터·접속함', [.8, .2, .2], [1.35, 2.4, .4]);
  h.cyl(motor, .42, .94, [0, 0, 0], 'motor', 'z'); h.flange(motor, .44, [0, 0, .5], 'z', 'motor', 12);
  h.ring(motor, .32, .015, [0, 0, .545], 'motor', 'z'); h.ring(motor, .22, .015, [0, 0, .55], 'motor', 'z');
  for (let i = 0; i < 12; i++) { const a = i * TAU / 12; h.bar(motor, [Math.cos(a) * .42, Math.sin(a) * .42, -.38], [Math.cos(a) * .42, Math.sin(a) * .42, .35], .015, 'motor'); }
  h.box(motor, [.24, .27, .2], [.36, -.03, 0], 'motor');
  const guard = s._part(root, '황색 구동 보호커버·외부 연결', [0, .2, 1.2]);
  h.box(guard, [2.8, .75, .16], [.35, 2.65, 1.36], 'yellow');
  for (let x = -.9; x < 1.65; x += .14) h.box(guard, [.025, .51, .025], [x, 2.65, 1.46], 'dark');
  const access = s._part(root, '점검 보행면·난간·사다리', [.2, 0, .5]);
  h.box(access, [4.8, .06, .7], [0, 1.56, 1.83], 'trim');
  for (const x of [-2.35, 0, 2.35]) h.bar(access, [x, 1.6, 2.14], [x, 2.65, 2.14], .025, 'red');
  for (const y of [2.1, 2.65]) h.bar(access, [-2.35, y, 2.14], [2.35, y, 2.14], .025, 'red');
  for (const x of [-2.4, -1.8]) h.bar(access, [x, .05, 1.7], [x, 1.6, 1.7], .025, 'red');
  for (let y = .22; y < 1.6; y += .24) h.bar(access, [-2.4, y, 1.7], [-1.8, y, 1.7], .02, 'red');
  root.userData.ports = { discharge: [-.2, 4.5, -.3] }; root.userData.unseenImpellerAdded = false;
}

function cyclone(s, root, item, h) {
  const r = item.radius || 1.2, upperR = item.upperRadius || .8, height = item.height || 5.3;
  const lower = s._part(root, '원통 외피·하부 볼트 링', [0, 0, 0]);
  h.cyl(lower, r, height * .59, [0, height * .295, 0]);
  for (const y of [.08, .5, height * .58]) h.ring(lower, r + .01, .025, [0, y, 0]); h.flange(lower, r + .025, [0, .12, 0], 'y', 'trim', 20);
  const upper = s._part(root, '상부 단차 외통·연결부', [0, .9, 0]);
  h.cyl(upper, upperR, .28, [0, height * .59 + .14, 0], 'steel', 'y', r);
  h.cyl(upper, upperR, height * .41 - .33, [0, height * .795 + .025, 0]); h.ring(upper, upperR + .01, .025, [0, height - .04, 0]);
  h.cyl(upper, upperR + .02, .045, [0, height - .02, 0]);
  const outlet = s._part(root, '가시 접속 덕트·플랜지', [.7, .2, 0]);
  h.cyl(outlet, .34, .65, [upperR + .18, height * .79, 0], 'steel', 'x'); h.flange(outlet, .4, [upperR + .5, height * .79, 0], 'x', 'trim', 12);
  const door = s._part(root, '작은 점검문·고정 브래킷', [0, .1, .8]); accessDoor(s, h, door, .57, .65, [0, 1.25, r]);
  for (let i = 0; i < 6; i++) { const a = i * TAU / 6, foot = h.box(lower, [.12, .26, .2], [Math.cos(a) * r, .15, Math.sin(a) * r], 'trim'); foot.rotation.y = -a; }
  root.userData.ports = { side: [upperR + .5, height * .79, 0] };
}

function panel(s, root, item, h) {
  const w = item.width || 1.6, d = item.depth || .87, height = item.height || 2.83;
  const body = s._part(root, '현장 제어반 외함·받침', [0, 0, -.4]); h.box(body, [w, height - .2, d], [0, height / 2 + .1, 0], 'white');
  for (const x of [-w * .35, w * .35]) h.box(body, [.16, .2, d * .7], [x, .1, 0], 'trim');
  const face = s._part(root, '전면 표시·조작부', [.5, .1, .3]); h.box(face, [w - .08, height - .28, .035], [0, height / 2 + .1, d / 2 + .028], 'white');
  h.box(face, [.7, .46, .025], [0, height * .7, d / 2 + .055], 'dark');
  for (let col = 0; col < 3; col++) for (let row = 0; row < 4; row++) h.cyl(face, .035, .026, [-.4 + col * .4, height * .5 - row * .17, d / 2 + .06], col === 2 ? 'red' : 'black', 'z');
  h.bar(face, [w * .36, .8, d / 2 + .07], [w * .36, 1.15, d / 2 + .07], .02, 'black');
}

export function buildDryerUpperEquipment(s, root, item) {
  const h = tools(s);
  if (item.type === 'dryer-roof-water-tank') roofWaterTank(s, root, item, h);
  else if (item.type === 'dryer-roof-cylindrical-shell') roofShell(s, root, item, h);
  else if (item.type === 'dryer-roof-drive') roofDrive(s, root, item, h);
  else if (item.type === 'chamber') chamber(s, root, item, h);
  else if (item.type === 'dryer-upper-well') upperWell(s, root, item, h);
  else if (item.type === 'dryer-upper-duct-run') upperDuctRun(s, root, item, h);
  else if (item.type === 'dryer-upper-tapered-housing') upperTaperedHousing(s, root, item, h);
  else if (item.type === 'blower') blower(s, root, item, h);
  else if (item.type === 'cyclone') cyclone(s, root, item, h);
  else if (item.type === 'panel') panel(s, root, item, h);
  else if (item.type === 'heater') buildFurnace(s, root);
  else return false;
  return true;
}

export function buildDryerUpperEnvironment(s, options = {}) {
  const { floor = 6, elevation = 26.2, roofElevation = 37.4, profile = {} } = options, h = tools(s);
  const eave = profile.eave ?? profile.eaves ?? roofElevation, ridge = profile.ridge ?? 40.4;
  const gable = { minX: profile.minX ?? -8.6, maxX: profile.maxX ?? 8.6, minZ: profile.minZ ?? -6.7, maxZ: profile.maxZ ?? 13.4 };
  const apron = profile.serviceApron || { minX: -8.6, maxX: 13.4, minZ: -13.4, maxZ: -6.7, elevation: 32.6 };
  const deck = s._group(s.scene, [0, elevation, 0]), structure = s._group(s.scene, [0, elevation, 0]), ducts = s._group(s.scene, [0, elevation, 0]), cover = s._group(s.scene, [0, elevation, 0]), facade = s._group(s.scene, [0, elevation, 0]), machineRoomCover = s._group(s.scene, [0, elevation, 0]), machineRoomInterior = s._group(s.scene, [0, elevation, 0]);
  deck.name = `dryer-upper-${floor}-deck`; structure.name = `dryer-upper-${floor}-structure`; ducts.name = `dryer-upper-${floor}-ducts`; cover.name = `dryer-upper-${floor}-cutaway-cover`; facade.name = `dryer-upper-${floor}-cutaway-facade`;
  machineRoomCover.name = `dryer-upper-${floor}-elevator-room-cover`; machineRoomInterior.name = `dryer-upper-${floor}-elevator-room-interior`;
  const radius = floor === 6 ? 4.15 : 4.3, well = options.chamberOpening || { x: -1, z: 7.5, diameter: radius * 2 };
  function plate(parent, bounds, y, paint, opening = null, thickness = .16) {
    const shape = new THREE.Shape(), outline = bounds.outline || [[bounds.minX, bounds.minZ], [bounds.maxX, bounds.minZ], [bounds.maxX, bounds.maxZ], [bounds.minX, bounds.maxZ]];
    shape.moveTo(outline[0][0], -outline[0][1]); for (const [x, z] of outline.slice(1)) shape.lineTo(x, -z); shape.closePath();
    for (const entry of opening ? (Array.isArray(opening) ? opening : [opening]) : []) {
      const hole = new THREE.Path();
      if (entry.diameter) hole.absarc(entry.x, -entry.z, entry.diameter / 2, 0, TAU, true);
      else { hole.moveTo(entry.minX, -entry.minZ); hole.lineTo(entry.minX, -entry.maxZ); hole.lineTo(entry.maxX, -entry.maxZ); hole.lineTo(entry.maxX, -entry.minZ); hole.closePath(); }
      shape.holes.push(hole);
    }
    const key = `deck:${JSON.stringify(bounds)}:${JSON.stringify(opening)}:${thickness}`;
    const geometry = h.geo(key, () => { const value = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 64 }); value.rotateX(-Math.PI / 2); return value; });
    h.mesh(parent, geometry, h.m[paint], [0, y - thickness, 0]);
  }
  function stairOpening(bounds) {
    const lane = Math.min(1.3, (bounds.maxX - bounds.minX - .28) / 2), run = Math.min(3, bounds.maxZ - bounds.minZ - 2.1), x = (bounds.minX + bounds.maxX) / 2, z = (bounds.minZ + bounds.maxZ) / 2;
    return { minX: x - lane - .1, maxX: x + lane + .1, minZ: z - run / 2 - .98, maxZ: z + run / 2 + .98 };
  }
  const internalBounds = profile.internalStairs || { minX: 5.9, maxX: 8.1, minZ: 3.8, maxZ: 9.2 };
  const externalBounds = profile.stairs || { minX: 8.6, maxX: 13.4, minZ: -13.4, maxZ: -6.7 };
  function rail(parent, a, b, base = 0, height = 1.2, paint = 'white') {
    const first = new THREE.Vector3(a[0], base, a[1]), last = new THREE.Vector3(b[0], base, b[1]), count = Math.ceil(first.distanceTo(last) / 1.45);
    for (let i = 0; i <= count; i++) { const point = first.clone().lerp(last, i / count); h.bar(parent, point.toArray(), point.clone().add(new THREE.Vector3(0, height, 0)).toArray(), .022, paint); }
    for (const y of [height / 2, height]) h.bar(parent, [a[0], base + y, a[1]], [b[0], base + y, b[1]], .023, paint);
  }
  function stairs(bounds, fromY, toY, name) {
    const group = s._group(structure, [(bounds.minX + bounds.maxX) / 2, fromY - elevation, (bounds.minZ + bounds.maxZ) / 2]); group.name = name;
    const flights = 4, steps = 9, rise = (toY - fromY) / flights, lane = Math.min(1.3, (bounds.maxX - bounds.minX - .28) / 2), run = Math.min(3, bounds.maxZ - bounds.minZ - 2.1), landing = .95;
    for (let f = 0; f < flights; f++) {
      const direction = f % 2 ? 1 : -1, x = f % 2 ? lane / 2 + .06 : -lane / 2 - .06, base = f * rise;
      for (let i = 0; i < steps; i++) {
        const z = direction * (-run / 2 + (i + .5) * run / steps), y = base + (i + 1) * rise / steps;
        h.box(group, [lane, .07, run / steps + .02], [x, y - .035, z], 'cream'); h.box(group, [lane - .04, .008, .045], [x, y + .006, z + direction * run / steps * .39], 'dark');
      }
      for (const side of [-1, 1]) {
        const xx = x + side * lane / 2;
        h.ibeam(group, [xx, base - .06, -direction * run / 2], [xx, base + rise - .06, direction * run / 2], .08, .13, 'white');
        h.bar(group, [xx, base + 1.02, -direction * run / 2], [xx, base + rise + 1.02, direction * run / 2], .023, 'trim');
        for (const t of [0, .33, .66, 1]) h.bar(group, [xx, base + rise * t, direction * (-run / 2 + t * run)], [xx, base + rise * t + 1.02, direction * (-run / 2 + t * run)], .017, 'trim');
      }
      h.box(group, [lane * 2 + .15, .1, landing], [0, base + rise - .05, direction * (run / 2 + landing / 2)], 'cream');
      // The final landing joins the upper walking deck; a guard across its
      // exit would close the only route out of the fourth flight.
      if (f !== flights - 1) rail(group, [-lane - .075, direction * (run / 2 + landing)], [lane + .075, direction * (run / 2 + landing)], base + rise, 1.05, 'trim');
    }
    Object.assign(group.userData, { observedFlights: 4, stepsPerFlight: steps, stepCountBasis: 'representative-unmeasured', fromY, toY }); return group;
  }
  function wallPanels(side, startZ, endZ, topY) {
    const x = side * 8.5, length = endZ - startZ, centreZ = (startZ + endZ) / 2, high = topY - elevation;
    const windowY = high - 2.2, windowHeight = .95;
    h.box(facade, [.14, Math.max(.2, windowY - windowHeight / 2), length], [x, (windowY - windowHeight / 2) / 2, centreZ], 'cream');
    h.box(facade, [.14, 1.72, length], [x, high - .86, centreZ], 'cream');
    const windows = Math.max(1, Math.floor(length / 3.3));
    for (let i = 0; i < windows; i++) {
      const z = startZ + (i + .5) * length / windows;
      h.box(facade, [.035, windowHeight, length / windows - .22], [x, windowY, z], 'glass');
      for (const end of [-1, 1]) h.box(facade, [.16, windowHeight + .05, .05], [x, windowY, z + end * (length / windows - .18) / 2], 'cream');
    }
    h.box(facade, [.18, .2, length], [x, .1, centreZ], 'floor');
  }
  if (floor === 6) {
    plate(deck, { minX: -8.6, maxX: 8.6, minZ: -13.4, maxZ: 13.4 }, 0, 'floor', well);
    plate(deck, profile.stairs || { minX: 8.6, maxX: 13.4, minZ: -13.4, maxZ: -6.7 }, 0, 'concrete');
    for (const x of [-8.25, 8.25]) for (const z of [-13.15, -6.7, 0, 6.7, 13.15]) {
      const height = (z < gable.minZ - .1 ? apron.elevation : eave) - elevation;
      h.ibeam(structure, [x, 0, z], [x, height, z], .3, .34);
      h.box(structure, [.5, .12, .5], [x, .06, z], 'concrete');
      h.box(structure, [.32, .5, .025], [x, 1, z + .19], 'cream');
      h.bolts(structure, [-.1, .1].flatMap((dx) => [-.18, -.06, .06, .18].map((dy) => [x + dx, 1 + dy, z + .215])), 'z', .016, 'trim');
    }
    for (const z of [gable.minZ, 0, 6.7, gable.maxZ]) {
      h.ibeam(structure, [-8.25, eave - elevation, z], [0, ridge - elevation, z], .19, .3);
      h.ibeam(structure, [0, ridge - elevation, z], [8.25, eave - elevation, z], .19, .3);
      h.ibeam(structure, [-8.25, eave - elevation, z], [8.25, eave - elevation, z], .13, .2);
      for (const x of [-5.5, -2.75, 0, 2.75, 5.5]) h.bar(structure, [x, eave - elevation, z], [x + (x < 0 ? 1.4 : -1.4), ridge - elevation - Math.abs(x) * (ridge - eave) / 8.6, z], .027, 'cream');
    }
    wallPanels(-1, -13.4, gable.minZ, apron.elevation); wallPanels(1, -13.4, gable.minZ, apron.elevation);
    wallPanels(-1, gable.minZ, 13.4, eave); wallPanels(1, gable.minZ, 13.4, eave);
    h.box(facade, [17.2, apron.elevation - elevation, .15], [0, (apron.elevation - elevation) / 2, -13.325], 'cream');
    // The opaque envelope cuts away independently from the load-bearing frame.
    h.box(facade, [17.2, eave - elevation, .15], [0, (eave - elevation) / 2, 13.325], 'cream');
    const triangle = new THREE.Shape(); triangle.moveTo(-8.6, eave - elevation); triangle.lineTo(0, ridge - elevation); triangle.lineTo(8.6, eave - elevation); triangle.closePath();
    const end = h.mesh(facade, h.geo(`gable-front:${eave - elevation}:${ridge - elevation}`, () => new THREE.ShapeGeometry(triangle)), h.m.cream, [0, 0, 13.4]); end.material.side = THREE.DoubleSide;
    const internal = stairs(internalBounds, elevation, apron.elevation, 'dryer-internal-four-flight-stair');
    Object.assign(deck.userData, { openingDiameter: well.diameter, floorBasis: 'A016-main-hall' });
    return { deck, structure, ducts, cover, facade, machineRoomCover, machineRoomInterior, stairs: internal };
  }
  if (floor === 7) {
    // The video shows the local equipment apron adjoining the historical
    // partial floor. Keep the large middle OPEN instead of filling the storey.
    const equipmentApron = { minX: -5.35, maxX: 5.45, minZ: .9, maxZ: 2.7 }, elbowOpening = { x: -4.4, z: 2, diameter: 1.55 };
    const outline = [[-8.6, 2.7], [-5.35, 2.7], [-5.35, .9], [5.45, .9], [5.45, 2.7], [8.6, 2.7], [8.6, 13.4], [-8.6, 13.4]];
    plate(deck, { minX: -8.6, maxX: 8.6, minZ: .9, maxZ: 13.4, outline }, 0, 'trim', [well, stairOpening(internalBounds), elbowOpening], .12);
    for (const side of [-1, 1]) {
      plate(deck, { minX: side < 0 ? -8.6 : 7.4, maxX: side < 0 ? -7.4 : 8.6, minZ: -6.7, maxZ: 2.7 }, 0, 'trim', null, .12);
      rail(structure, [side * 7.4, -6.7], [side * 7.4, 2.7]);
    }
    // The filmed equipment forms this edge; a continuous guard through the
    // large duct and housing would invent a physical collision.
    rail(structure, [-7.4, 2.7], [-5.35, 2.7]); rail(structure, [5.45, 2.7], [7.4, 2.7]);
    rail(structure, [-5.35, .9], [5.45, .9]);
    for (const z of [-6.7, 2.7, 13.25]) h.ibeam(structure, [-8.25, -.19, z], [8.25, -.19, z], .16, .25);
    Object.assign(ducts.userData, { observedDuctOwnedByEquipment: 'dryer-upper-duct-run', hiddenConnectionsConfirmed: false });
    Object.assign(deck.userData, { openingDiameter: well.diameter, middleOpen: true, serviceBayOwnedByFloor8: true, stairOpening: stairOpening(internalBounds), equipmentApron, elbowOpening, equipmentApronBasis: 'video-414-432s-local-platform;position-and-outline-approximate;historical-A017-OPEN-retained' });
    return { deck, structure, ducts, cover, facade, machineRoomCover, machineRoomInterior };
  }
  if (floor === 8) {
    plate(deck, apron, apron.elevation - elevation, 'apron', stairOpening(externalBounds), .18);
    for (const [a, b] of [[[apron.minX, apron.minZ], [apron.maxX, apron.minZ]], [[apron.minX, apron.minZ], [apron.minX, apron.maxZ]], [[apron.maxX, apron.minZ], [apron.maxX, apron.maxZ]]]) {
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]), wall = h.box(structure, [length, .95, .17], [(a[0] + b[0]) / 2, .475, (a[1] + b[1]) / 2], 'cream'); wall.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]);
    }
    const width = gable.maxX - gable.minX, half = width / 2, rise = ridge - eave, slope = Math.hypot(half, rise), centreX = (gable.minX + gable.maxX) / 2, centreZ = (gable.minZ + gable.maxZ) / 2, length = gable.maxZ - gable.minZ;
    for (const side of [-1, 1]) {
      const sheet = h.box(cover, [slope, .06, length], [centreX + side * half / 2, (eave + ridge) / 2 - elevation, centreZ], 'roof'); sheet.rotation.z = -side * Math.atan2(rise, half);
      for (let z = gable.minZ + .1; z < gable.maxZ; z += .65) { const seam = h.box(cover, [slope, .018, .018], [centreX + side * half / 2, (eave + ridge) / 2 - elevation + .04, z], 'trim'); seam.rotation.z = sheet.rotation.z; }
      // A020 establishes a 4.8m upper volume below the eaves; this is a wall,
      // not an invented flat roof deck over the open service bay.
      h.box(cover, [.12, eave - elevation, length], [centreX + side * (half - .06), (eave - elevation) / 2, centreZ], 'cream');
    }
    for (const z of [gable.minZ, gable.maxZ]) {
      h.box(cover, [width, eave - elevation, .12], [centreX, (eave - elevation) / 2, z], 'cream');
      const endShape = new THREE.Shape(); endShape.moveTo(gable.minX, eave - elevation); endShape.lineTo(centreX, ridge - elevation); endShape.lineTo(gable.maxX, eave - elevation); endShape.closePath();
      const end = h.mesh(cover, h.geo(`upper-roof-gable:${width}:${eave - elevation}:${ridge - elevation}`, () => new THREE.ShapeGeometry(endShape)), h.m.cream, [0, 0, z]); end.material.side = THREE.DoubleSide;
    }
    const catwalk = s._group(cover), walkWidths = profile.catwalk?.widths || [1, .75], guardHeight = profile.catwalk?.guardHeight || 1.2;
    catwalk.name = 'dryer-historical-roof-L-catwalk';
    Object.assign(catwalk.userData, { basis: 'historical-A018/A033;not-current-asbuilt', currentVideoObserved: false, widths: [...walkWidths], guardHeight, positionBasis: 'historical-plan-proportion' });
    const walkX = centreX + half * .66, southZ = gable.maxZ - 2.6, roofY = (x) => ridge - Math.abs(x - centreX) * rise / half - elevation + .13;
    function slopeRail(start, end) {
      const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end), count = Math.ceil(a.distanceTo(b) / 1.45);
      for (let i = 0; i <= count; i++) { const p = a.clone().lerp(b, i / count); h.bar(catwalk, p.toArray(), p.clone().add(new THREE.Vector3(0, guardHeight, 0)).toArray(), .022, 'trim'); }
      for (const y of [guardHeight / 2, guardHeight]) h.bar(catwalk, a.clone().add(new THREE.Vector3(0, y, 0)).toArray(), b.clone().add(new THREE.Vector3(0, y, 0)).toArray(), .023, 'trim');
    }
    // Expanded-metal paths follow the pitched roof, rather than creating a
    // flat platform at the ridge. Their current presence is not video-verified.
    const long = h.box(catwalk, [walkWidths[0], .045, southZ - gable.minZ], [walkX, roofY(walkX), (southZ + gable.minZ) / 2], 'trim'); long.rotation.z = -Math.atan2(rise, half);
    for (const x of [walkX - walkWidths[0] / 2, walkX + walkWidths[0] / 2]) slopeRail([x, roofY(x) + .03, gable.minZ], [x, roofY(x) + .03, southZ]);
    for (const [start, end] of [[gable.minX + .12, centreX], [centreX, walkX + walkWidths[0] / 2]]) {
      const a = new THREE.Vector3(start, roofY(start), southZ), b = new THREE.Vector3(end, roofY(end), southZ), surface = h.box(catwalk, [a.distanceTo(b), .045, walkWidths[1]], a.clone().add(b).multiplyScalar(.5).toArray(), 'trim'); surface.rotation.z = Math.atan2(b.y - a.y, b.x - a.x);
      for (const z of [southZ - walkWidths[1] / 2, southZ + walkWidths[1] / 2]) slopeRail([a.x, a.y + .03, z], [b.x, b.y + .03, z]);
    }
    const grating = [];
    for (let z = gable.minZ + .06; z < southZ; z += .13) grating.push({ position: [walkX, roofY(walkX) + .03, z], quaternion: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -Math.atan2(rise, half)) });
    h.instances(catwalk, h.geo(`roof-catwalk-grating:${walkWidths[0]}`, () => new THREE.BoxGeometry(walkWidths[0], .012, .02)), 'dark', grating);
    h.bar(structure, [0, ridge - elevation + .06, gable.minZ], [0, ridge - elevation + .06, gable.maxZ], .05, 'cream');
    const room = profile.driveRoom || { minX: 4.25, maxX: 7.75, minZ: -12.55, maxZ: -9.3, height: 2.65 };
    Object.assign(machineRoomCover.userData, { roomUse: 'elevator-machine-room', roomUseConfirmed: true, bounds: { ...room }, basis: 'user-confirmed-room;A017-location;video-060-124s-exterior', dimensionsMeasured: false });
    Object.assign(machineRoomInterior.userData, { roomUse: 'elevator-machine-room', roomUseConfirmed: true, basis: 'video-060-124s-visible-interior', positionBasis: 'photo-and-A017-approximation' });
    const roomW = room.maxX - room.minX, roomD = room.maxZ - room.minZ, roomX = (room.minX + room.maxX) / 2, roomZ = (room.minZ + room.maxZ) / 2;
    h.box(machineRoomCover, [roomW, room.height, .12], [roomX, room.height / 2, room.minZ], 'cream');
    h.box(machineRoomCover, [.12, room.height, roomD], [room.maxX, room.height / 2, roomZ], 'cream');
    // The filmed window has a real opening. Its exact plan coordinate is an
    // approximation; no additional unseen windows are repeated around the room.
    const windowZ = room.minZ + 1.15, windowW = 1.24, windowBottom = 1.15, windowTop = 2.12;
    h.box(machineRoomCover, [.12, windowBottom, roomD], [room.minX, windowBottom / 2, roomZ], 'cream');
    h.box(machineRoomCover, [.12, room.height - windowTop, roomD], [room.minX, (room.height + windowTop) / 2, roomZ], 'cream');
    for (const [start, end] of [[room.minZ, windowZ - windowW / 2], [windowZ + windowW / 2, room.maxZ]]) h.box(machineRoomCover, [.12, windowTop - windowBottom, end - start], [room.minX, (windowBottom + windowTop) / 2, (start + end) / 2], 'cream');
    h.box(machineRoomCover, [.025, windowTop - windowBottom, windowW], [room.minX, (windowTop + windowBottom) / 2, windowZ], 'glass');
    for (const y of [windowBottom, windowTop]) h.box(machineRoomCover, [.15, .04, windowW + .08], [room.minX, y, windowZ], 'white');
    for (const z of [windowZ - windowW / 2, windowZ, windowZ + windowW / 2]) h.box(machineRoomCover, [.15, windowTop - windowBottom, .04], [room.minX, (windowTop + windowBottom) / 2, z], 'white');
    const doorW = 1.4, doorH = 2.08, doorX = room.maxX - 1.0, doorZ = room.maxZ;
    for (const [a, b] of [[room.minX, doorX - doorW / 2], [doorX + doorW / 2, room.maxX]]) h.box(machineRoomCover, [b - a, room.height, .12], [(a + b) / 2, room.height / 2, doorZ], 'cream');
    h.box(machineRoomCover, [doorW, room.height - doorH, .12], [doorX, (room.height + doorH) / 2, doorZ], 'cream');
    const doors = s._group(machineRoomCover, [doorX, 0, doorZ]); doors.name = 'elevator-room-perforated-entry-doors'; doors.userData.source = 'video-060s-123s;room-entry-not-control-cabinet';
    for (const side of [-1, 1]) {
      const leaf = s._group(doors, [side * doorW / 2, 0, 0]); leaf.name = `elevator-room-entry-leaf-${side}`;
      leaf.userData.proximityDoor = { enterable: true, groupId: 'dryer-roof-elevator-machine-room', label: '엘리베이터 기계실 출입문', accessBasis: 'real door cutout and modelled photographed room interior/floor', kind: 'hinge', axis: 'y', closed: 0, open: side * Math.PI / 2, trigger: [0, 0, 0], width: doorW, height: doorH };
      h.box(leaf, [doorW / 2 - .018, doorH, .045], [-side * doorW / 4, doorH / 2, 0], 'grayMotor');
      h.ring(leaf, .047, .012, [-side * (doorW / 2 - .085), 1.01, .037], 'trim', 'z');
      const perforations = [];
      for (let x = .14; x < doorW / 2 - .06; x += .052) for (let y = .17; y < doorH - .08; y += .055) perforations.push({ position: [side * x - side * doorW / 2, y, .024] });
      h.instances(leaf, h.geo('elevator-door-perforation', () => new THREE.BoxGeometry(.021, .025, .003)), 'dark', perforations);
    }
    h.box(machineRoomCover, [roomW + .1, .12, roomD + .1], [roomX, room.height + .06, roomZ], 'roof');
    h.box(machineRoomInterior, [roomW - .12, .035, roomD - .12], [roomX, .025, roomZ], 'floor');
    h.box(machineRoomInterior, [2.3, .012, 1.65], [6, .052, -11], 'concrete');
    const cabinet = s._group(machineRoomInterior, [room.minX + .72, .05, room.maxZ - .45]); cabinet.rotation.y = Math.PI; cabinet.name = 'elevator-fixed-open-control-cabinet';
    Object.assign(cabinet.userData, { source: 'video-075s', independentOfDriveAssembly: true, internalModuleFunctionsConfirmed: false });
    h.box(cabinet, [1.16, 1.62, .4], [0, .84, 0], 'cabinet'); h.box(cabinet, [1.04, 1.48, .018], [0, .84, .207], 'dark');
    h.box(cabinet, [.56, 1.58, .035], [-.29, .84, .233], 'cabinet');
    const openDoor = s._group(cabinet, [.58, .84, .24]); openDoor.rotation.y = .48; h.box(openDoor, [.56, 1.58, .035], [-.28, 0, 0], 'cabinet');
    for (const [parent, x, y, z] of [[cabinet, -.06, .8, .27], [openDoor, -.49, -.1, .04]]) h.bar(parent, [x, y, z], [x, y + .12, z], .017, 'trim');
    for (let row = 0; row < 4; row++) { h.box(cabinet, [.38, .1, .035], [.22, .36 + row * .29, .226], 'black'); for (const x of [.11, .24, .35]) h.cyl(cabinet, .008, .009, [x, .38 + row * .29, .25], row % 2 ? 'red' : 'white', 'z'); }
    h.box(cabinet, [.78, .22, .33], [0, 1.8, 0], 'yellow');
    const vents = []; for (let col = 0; col < 11; col++) for (let row = 0; row < 3; row++) vents.push({ position: [-.31 + col * .061, 1.73 + row * .06, .167] });
    h.instances(cabinet, h.geo('elevator-cabinet-top-vent', () => new THREE.CylinderGeometry(.011, .011, .007, 8)), 'dark', vents.map(entry => ({ ...entry, quaternion: new THREE.Quaternion().setFromUnitVectors(UP, new THREE.Vector3(0, 0, 1)) })));
    const wallBox = h.box(machineRoomInterior, [.32, .38, .15], [room.minX + .45, 1.63, room.maxZ - .15], 'cabinet'); wallBox.name = 'elevator-small-wall-junction-box'; wallBox.userData.source = 'video-076s';
    h.pipe(machineRoomInterior, [[room.minX + .45, 1.43, room.maxZ - .15], [room.minX + .45, .19, room.maxZ - .15], [room.minX + .25, .12, room.minZ + .25], [5.05, .12, room.minZ + .25]], .022, 'black');
    machineRoomInterior.userData.hiddenElectricalConnectionsConfirmed = false;
    const outerStair = stairs(externalBounds, profile.stairs?.fromY ?? 26.2, profile.stairs?.toY ?? 32.6, 'dryer-service-four-flight-stair');
    Object.assign(deck.userData, { sameDatumAsFloor7: true, notAnAdditionalStorey: true, gableSurfaceOwnedByCover: true, stairOpening: stairOpening(externalBounds) });
    return { deck, structure, ducts, cover, facade, machineRoomCover, machineRoomInterior, stairs: outerStair };
  }
  return { deck, structure, ducts, cover, facade, machineRoomCover, machineRoomInterior };
}
