import * as THREE from '../shared/vendor/three.module.js';
import { buildFurnace } from './furnace-model.js';
import { createArchitectureKit } from './architecture-kit.js';
import { dryerWallPlan } from './dryer-wall-plan.js';

// A016/A017/A019 determine floor ownership and openings. Dimensions of the
// photographed machines remain qualified approximations, distinct from holes.
const TAU = Math.PI * 2, UP = new THREE.Vector3(0, 1, 0);
function tools(s) {
  const m = s.dryerUpperMaterials ||= {
    steel: s.mat.steel, stainedSteel: s.mat?.stainedSteel || s.mat.steel, trim: s.mat.trim, dark: s.mat.dark, white: s.mat.white,
    floor: s.mat?.slabFloor || s._material(0x1f5e3f, .34, .06), curb: s.mat?.curb || s._material(0x1b5e3e, .32, .06),
    cream: s.mat?.creamBeam || s._material(0xdad5c2, .74, .1),
    motor: s._material(0x3f7d76, .45, .42), grayMotor: s._material(0x9ea39f, .52, .35),
    red: s._material(0xb63b31, .55, .24), yellow: s.mat.yellow,
    wrap: s._material(0xcad0cc, .38, .72), concrete: s._material(0x858980, .95, 0),
    roof: s._material(0x9a9f96, .74, .28), ceilingDeck: s.mat?.ceilingDeck || s._material(0x4c545a, .58, .48, { side: THREE.DoubleSide }),
    tray: s._material(0x2c3438, .56, .46), led: s._material(0xfbf9ee, .35, 0, { emissive: 0xfff8e6, emissiveIntensity: 1.15 }),
    apron: s._material(0x676e65, .96, 0),
    tank: s._material(0xb9c0af, .68, .22), glass: s._material(0xc1d2cf, .22, .04, { transparent: true, opacity: .28, depthWrite: false }),
    innerSteel: s._material(0xe6eae8, .24, .85, { map: s.mat?.steel?.map || null, roughnessMap: s.mat?.steel?.roughnessMap || null, envMapIntensity: 1.18, side: THREE.DoubleSide }),
    blue: s._material(0x2b629b, .5, .22), black: s.mat.black,
    cabinet: s._material(0x91a29b, .68, .24), orange: s._material(0xc68a45, .6, .16),
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

function plaque(s, h, parent, text, size, position, rotationY = 0, borderColor = '#26589c') {
  const g = s._group(parent, position); g.rotation.y = rotationY;
  const [w, hh] = size;
  h.box(g, [w, hh, .014], [0, 0, 0], 'white');
  h.box(g, [w * .94, hh * .22, .016], [0, -hh * .34, .002], 'blue');
  if (typeof WebGLRenderingContext !== 'undefined' && typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 128;
    const ctx = canvas.getContext?.('2d');
    if (ctx?.fillText) {
      ctx.fillStyle = '#f5f6f2'; ctx.fillRect(0, 0, 256, 128);
      ctx.strokeStyle = borderColor; ctx.lineWidth = 7; ctx.strokeRect(5, 5, 246, 118);
      ctx.fillStyle = borderColor; ctx.fillRect(8, 96, 240, 24);
      ctx.fillStyle = '#182426'; ctx.font = '700 46px "Malgun Gothic", sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 128, 54, 224);
      const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; s.textures?.add(tex);
      const mat = s._material(0xffffff, .5, .05, { map: tex });
      const plane = h.mesh(g, h.geo(`plaque:${w}:${hh}`, () => new THREE.PlaneGeometry(w * .96, hh * .94)), mat, [0, 0, .009]);
      plane.castShadow = false;
    }
  }
  return g;
}

function accessDoor(s, h, parent, width, height, position, options = {}) {
  const group = s._group(parent, position);
  // Rounded-corner stainless inspection door frame, twin horizontal latch bars, hinges & handle (card 32 FRONT)
  h.box(group, [width + .14, height + .14, .045], [0, 0, 0], 'trim');
  h.box(group, [width + .04, height + .04, .05], [0, 0, .02], 'dark');
  h.box(group, [width - .02, height - .02, .055], [0, 0, .045], 'steel');
  for (const yBar of [-height * .31, height * .31]) {
    h.bar(group, [-width * .56, yBar, .085], [width * .52, yBar, .085], .018, 'trim');
    for (const sx of [-1, 1]) h.box(group, [.06, .08, .05], [sx * (width * .51), yBar, .07], 'trim');
  }
  for (const yHinge of [-height * .32, height * .32]) h.cyl(group, .024, .12, [width * .51, yHinge, .07], 'trim');
  const hx = -width * .41;
  h.bar(group, [hx, -.13, .075], [hx, -.13, .13], .014); h.bar(group, [hx, -.13, .13], [hx, .13, .13], .016); h.bar(group, [hx, .13, .13], [hx, .13, .075], .014);
  if (options.chamberSigns) {
    plaque(s, h, group, '챔 버', [.62, .34], [0, -height * .12, .078], 0);
    for (const dy of [.08, .32]) {
      h.box(group, [.15, .20, .012], [-width * .66, dy, .04], 'white');
      h.box(group, [.15, .04, .014], [-width * .66, dy - .07, .042], 'blue');
      const tri = h.box(group, [.065, .065, .015], [-width * .66, dy + .02, .044], 'yellow'); tri.rotation.z = Math.PI / 4;
    }
  }
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
  // Raised circular deep-green concrete curb + stainless base flashing (card 32 FRONT/REAR)
  h.cyl(base, r + .28, .22, [0, .11, 0], 'curb', 'y', r + .32, false);
  h.cyl(base, r + .05, .08, [0, .23, 0], 'trim', 'y', r + .05, true);
  for (let i = 0; i < 3; i++) {
    const y = height * i / 3, shell = s._part(root, ['하단 원통 외피', '중단 원통 외피', '상단 연결 외피'][i], [i === 1 ? -1.0 : 0, i * .45, 0], [0, y, 0]);
    h.cyl(shell, r, height / 3, [0, height / 6, 0], 'innerSteel', 'y', r, true);
    for (const yy of [.02, height / 3 - .02]) h.ring(shell, r + .012, .016, [0, yy, 0]);
    const seams = []; for (let n = 0; n < 20; n++) { const a = n * TAU / 20; seams.push({ position: [Math.cos(a) * (r + .004), height / 6, Math.sin(a) * (r + .004)], quaternion: new THREE.Quaternion().setFromAxisAngle(UP, -a) }); }
    h.instances(shell, h.geo(`chamber-seam:${height}`, () => new THREE.BoxGeometry(.010, height / 3 - .02, .010)), 'trim', seams);
  }
  // Main inspection door ("챔 버" nameplate) oriented toward the NE 6F hall & tour sightline (angle = -.95 rad from +Z -> NE)
  const doorAngle = 2.42;
  const doorPos = [Math.sin(doorAngle) * (r + .03), 1.42, Math.cos(doorAngle) * (r + .03)];
  const door = s._part(root, '다중 잠금 점검문·원형 포트', [.9, .1, -.9], doorPos);
  const doorNode = accessDoor(s, h, door, 1.06, 1.86, [0, 0, 0], { chamberSigns: true });
  doorNode.rotation.y = doorAngle;
  // Round dark sight port + hanging cable to the right of the door (card 32 FRONT) & elevated small square port (card 32 LEFT)
  const portAngle = doorAngle + .34;
  const sp = s._group(door, [Math.sin(portAngle) * (r + .03) - doorPos[0], -.18, Math.cos(portAngle) * (r + .03) - doorPos[2]]);
  sp.rotation.y = portAngle;
  h.cyl(sp, .15, .09, [0, 0, .03], 'black', 'z'); h.cyl(sp, .11, .02, [0, 0, .08], 'glass', 'z');
  h.pipe(sp, [[.06, -.04, .06], [.22, -.24, .05], [.42, -.12, .04]], .009, 'black');
  const sqAngle = doorAngle - .52;
  const sq = s._group(door, [Math.sin(sqAngle) * (r + .03) - doorPos[0], 1.72, Math.cos(sqAngle) * (r + .03) - doorPos[2]]);
  sq.rotation.y = sqAngle;
  h.box(sq, [.66, .66, .04], [0, 0, 0], 'trim'); h.box(sq, [.56, .56, .048], [0, 0, .015], 'steel');
  for (const dy of [-.18, .18]) h.box(sq, [.08, .05, .06], [.26, dy, .03], 'trim');

  const services = s._part(root, '외부 얇은 배관·고정 클램프', [.5, .1, -.4]);
  // Circumferential twin air/conduit pipe rings + upper knockers + FRL regulator beside door (card 32 FRONT/RIGHT)
  for (const ry of [3.55, 3.72, 5.45]) h.ring(services, r + .045, .016, [0, ry, 0], 'trim', 'y');
  for (let k = 0; k < 6; k++) {
    const a = doorAngle - .8 + k * .52;
    const kx = Math.sin(a) * (r + .06), kz = Math.cos(a) * (r + .06);
    const kn = h.box(services, [.14, .22, .12], [kx, 4.18, kz], 'steel'); kn.rotation.y = a;
    h.bar(services, [kx, 3.72, kz], [kx, 4.18, kz], .012, 'blue');
  }
  const frlAngle = doorAngle - .23, fx = Math.sin(frlAngle) * (r + .06), fz = Math.cos(frlAngle) * (r + .06);
  h.bar(services, [fx, .22, fz], [fx, 5.45, fz], .020, 'trim');
  h.box(services, [.14, .22, .12], [fx, 1.18, fz], 'dark');
  root.userData.openAtTop = true; root.userData.connectsUpperWell = 'dryer-chamber-upper-well';
}

function upperWell(s, root, item, h) {
  const r = item.radius || 4.3, top = item.height || .8, down = item.belowFloor || 1;
  // Card 35 (보류 2, 7F chamber top plate): low circular step platform + stained wide circular top plate + perimeter rail
  const cone = s._part(root, '관찰 웰 경사 외피·원형 림', [0, .7, 0]);
  h.cyl(cone, r - .035, down + .28, [0, (.28 - down) / 2, 0], 'innerSteel', 'y', r - .35, true);
  h.cyl(cone, r + .22, .08, [0, .04, 0], 'curb', 'y', r + .26, false);
  h.cyl(cone, r + .02, .28, [0, .14, 0], 'trim', 'y', r + .04, true);
  h.ring(cone, r + .03, .028, [0, .28, 0], 'trim', 'y');

  const rim = s._part(root, '체커 점검 보행면·분리 판', [.4, 0, .6]);
  // Wide stained stainless circular top deck (y = .28m) + radial plate seams + perimeter handrail
  h.cyl(rim, r, .04, [0, .28, 0], 'stainedSteel', 'y', r, false);
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 8;
    h.bar(rim, [Math.cos(a) * 1.55, .305, Math.sin(a) * 1.55], [Math.cos(a) * (r - .05), .305, Math.sin(a) * (r - .05)], .008, 'trim');
  }
  const railPoints = [];
  for (let i = 0; i < 48; i++) {
    const a = i * TAU / 48, outer = r + .45 - THREE.MathUtils.clamp((-Math.sin(a) - .75) / .2, 0, 1) * .3;
    railPoints.push([Math.cos(a) * (outer - .04), .28, Math.sin(a) * (outer - .04)]);
  }
  const guard = s._group(rim); guard.name = 'dryer-well-perimeter-guard';
  for (let i = 0; i < railPoints.length; i += 2) { const [x, y, z] = railPoints[i]; h.bar(guard, [x, y, z], [x, 1.32, z], .020, 'trim'); }
  for (const y of [.78, 1.32]) h.pipe(guard, [...railPoints, railPoints[0]].map(([x, , z]) => [x, y, z]), .021, 'trim');
  Object.assign(guard.userData, { source: 'field-card-35-and-video-432s', dimensionsMeasured: false, northEdgeInsetForObservedDuct: true });

  // Central low cylindrical air distributor + tangential fan-ribbed round duct + small blower/yellow motor/trapezoid filter + 2 nozzle wash stands + chain hoist (card 35)
  const visible = s._part(root, '보이는 중앙 커버·호스·고정부', [.2, .4, -.5]);
  const distX = -.25, distZ = -.35;
  h.cyl(visible, 1.52, .98, [distX, .79, distZ], 'steel', 'y', 1.52, false);
  h.ring(visible, 1.54, .022, [distX, 1.28, distZ], 'trim', 'y');
  // Thick fan-segmented stainless duct sweeping into the central air distributor (card 35 RIGHT/REAR)
  h.pipe(visible, [[-2.35, .55, -2.55], [-2.15, .88, -1.85], [-1.62, .92, -1.05], [distX - .95, .86, distZ - .35]], .48, 'steel');
  for (const [rx, ry, rz, ay] of [[-2.22, .74, -2.18, .3], [-1.88, .90, -1.45, .65], [-1.38, .90, -.82, 1.05]]) {
    const rb = h.ring(visible, .50, .016, [rx, ry, rz], 'trim', 'z'); rb.rotation.y = ay;
  }
  // Small blower + yellow belt guard/motor + trapezoidal intake filter box on the top plate (card 35 LEFT)
  const bx = 1.65, bz = -.95;
  h.box(visible, [.95, .08, .72], [bx, .34, bz], 'trim');
  h.cyl(visible, .42, .26, [bx - .28, .82, bz], 'steel', 'x');
  h.box(visible, [.28, .42, .62], [bx - .02, .68, bz + .18], 'yellow');
  h.cyl(visible, .15, .38, [bx + .22, .52, bz + .28], 'blue', 'x');
  const trap = h.geo('card35-trap-filter', () => {
    const g = new THREE.BoxGeometry(.76, .96, .62), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getX(i) < 0) { p.setY(i, p.getY(i) * .38); p.setZ(i, p.getZ(i) * .42); }
    g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere(); return g;
  });
  h.mesh(visible, trap, h.m.steel, [bx - .85, .88, bz - .62]).rotation.y = Math.PI / 2;
  for (const lx of [-.26, .26]) for (const lz of [-.24, .24]) h.bar(visible, [bx - .85 + lx, .30, bz - .62 + lz], [bx - .85 + lx, .45, bz - .62 + lz], .018, 'trim');
  // Two stainless table-type nozzle wash stands on south/east side of plate (card 35 FRONT)
  // Stand 1: flat round disk table on 4 legs + coiled black hose + orange pendant
  const t1x = .55, t1z = 2.35;
  h.cyl(visible, .58, .025, [t1x, .96, t1z], 'steel');
  for (const a of [.4, 1.9, 3.5, 5.0]) h.bar(visible, [t1x + Math.cos(a) * .42, .30, t1z + Math.sin(a) * .42], [t1x + Math.cos(a) * .38, .96, t1z + Math.sin(a) * .38], .016, 'trim');
  h.box(visible, [.22, .06, .08], [t1x + .32, .99, t1z + .12], 'orange');
  h.pipe(visible, [[t1x - .15, .99, t1z], [t1x - .62, .88, t1z + .32], [t1x - .75, .42, t1z + .45], [t1x - .25, .34, t1z + .18]], .026, 'black');
  // Stand 2: open ring work stand on 4 splayed legs + yellow drain hose + overhead chain hoist with red hook
  const t2x = 1.85, t2z = 1.75;
  h.ring(visible, .48, .022, [t2x, 1.06, t2z], 'steel', 'y');
  for (let i = 0; i < 4; i++) {
    const a = (i + .5) * Math.PI / 2;
    h.bar(visible, [t2x + Math.cos(a) * .54, .30, t2z + Math.sin(a) * .54], [t2x + Math.cos(a) * .46, 1.06, t2z + Math.sin(a) * .46], .017, 'trim');
    const aNext = (i + 1.5) * Math.PI / 2;
    h.bar(visible, [t2x + Math.cos(a) * .50, .58, t2z + Math.sin(a) * .50], [t2x + Math.cos(aNext) * .50, .58, t2z + Math.sin(aNext) * .50], .014, 'trim');
  }
  h.pipe(visible, [[t2x, .32, t2z], [t2x + .45, .31, t2z + .85], [t2x + .72, .12, t2z + 1.45]], .020, 'yellow');
  // Overhead chain hoist block & red hook above Stand 2 (card 35 FRONT)
  h.bar(visible, [t2x, 1.88, t2z], [t2x, 3.65, t2z], .014, 'black');
  h.cyl(visible, .12, .08, [t2x, 1.82, t2z], 'red', 'z');
  h.ring(visible, .048, .012, [t2x, 1.68, t2z], 'red', 'z');
  h.bar(visible, [t2x, 1.12, t2z], [t2x, 1.64, t2z], .008, 'trim');
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
  // Card 34 (보류 3): black steel legs + green concrete curb + red upper deck & red railings + huge 180° ribbed fan-shaped rectangular duct + nearby red post
  const frame = s._part(root, '검은 철골 다리·초록 턱·적색 데크 테', [-.3, -.1, 0]);
  h.box(frame, [4.35, .16, 3.05], [0, .08, 0], 'curb');
  for (const x of [-1.92, 1.92]) for (const z of [-1.28, 1.28]) {
    h.ibeam(frame, [x, .16, z], [x, 1.56, z], .20, .22, 'tray');
    h.box(frame, [.34, .05, .34], [x, .185, z], 'dark');
  }
  // Red upper deck rim beams & knee braces (card 34 FRONT/LEFT/REAR)
  for (const z of [-1.36, 1.36]) h.ibeam(frame, [-2.18, 1.56, z], [2.18, 1.56, z], .18, .22, 'red');
  for (const x of [-2.08, 2.08]) h.ibeam(frame, [x, 1.56, -1.36], [x, 1.56, 1.36], .18, .22, 'red');
  for (const [x, sx] of [[-1.92, -1], [1.92, 1]]) for (const [z, sz] of [[-1.28, -1], [1.28, 1]]) {
    h.bar(frame, [x, 1.18, z], [x + sx * .22, 1.52, z + sz * .06], .03, 'red');
  }
  const bed = s._part(root, '방진 스키드·지지 프레임', [0, .65, 0]);
  for (const z of [-1.05, 1.05]) h.ibeam(bed, [-1.85, 1.72, z], [1.85, 1.72, z], .16, .18, 'tray');
  for (const x of [-1.35, 1.35]) for (const z of [-.95, .95]) h.cyl(bed, .09, .14, [x, 1.63, z], 'blue');

  const casing = s._part(root, '원심 케이싱·180도 부채꼴 사각 덕트', [-.7, .2, -.4], [-.35, 2.82, -.15]);
  const shape = new THREE.Shape(); shape.moveTo(-1.15, -.92); shape.bezierCurveTo(-1.55, .22, -1.02, 1.32, .28, 1.18); shape.bezierCurveTo(1.32, 1.02, 1.55, -.25, .88, -.98); shape.lineTo(-1.15, -.98); shape.closePath();
  h.mesh(casing, h.geo('upper-blower-volute', () => new THREE.ExtrudeGeometry(shape, { depth: .96, bevelEnabled: false, curveSegments: 28 })), h.m.steel, [0, 0, -.48]);
  // Sloped bearing pedestal block at front of blower shaft
  h.box(casing, [1.35, .72, .22], [.45, -.52, .68], 'tray');
  // Thick round suction duct entering eye of blower (-Z/+X side, card 34 LEFT & REAR)
  h.cyl(casing, .72, 1.65, [.15, .08, -1.28], 'steel', 'z');
  h.flange(casing, .78, [.15, .08, -.52], 'z', 'trim', 20);
  // Huge 180-degree fan-segmented rectangular stainless duct with dark radial ribs plunging into floor green curb (card 34 FRONT/RIGHT/REAR)
  const archCx = -.92, archCy = .42, archR = 1.28, segN = 11;
  for (let i = 0; i < segN; i++) {
    const a0 = (i / segN) * Math.PI, a1 = ((i + 1) / segN) * Math.PI, am = (a0 + a1) / 2;
    const rMid = archR, segLen = archR * (Math.PI / segN) + .06;
    const sx = archCx + Math.cos(am) * rMid, sy = archCy + Math.sin(am) * rMid;
    const seg = h.box(casing, [.98, segLen, 1.12], [sx, sy, -.02], 'steel');
    seg.rotation.z = am;
    const rib = h.box(casing, [1.06, .038, 1.20], [archCx + Math.cos(a0) * rMid, archCy + Math.sin(a0) * rMid, -.02], 'dark');
    rib.rotation.z = a0;
  }
  // Vertical rectangular drop trunk below the 180° bend down into raised green floor curb
  const dropX = archCx - archR;
  for (let k = 0; k < 5; k++) {
    const sy = .22 - k * .56;
    h.box(casing, [1.04 + k * .04, .54, 1.14 + k * .03], [dropX, sy, -.02], 'stainedSteel');
    h.box(casing, [1.12 + k * .04, .036, 1.22 + k * .03], [dropX, sy + .27, -.02], 'dark');
  }
  h.box(casing, [1.56, .22, 1.64], [dropX, -2.71, -.02], 'curb');

  const motor = s._part(root, '청록색 수평 모터·대형 단자함', [.8, .2, .2], [1.18, 2.38, .42]);
  h.cyl(motor, .39, .92, [0, 0, 0], 'motor', 'z'); h.flange(motor, .42, [0, 0, .48], 'z', 'motor', 12);
  for (let i = 0; i < 12; i++) { const a = i * TAU / 12; h.bar(motor, [Math.cos(a) * .39, Math.sin(a) * .39, -.38], [Math.cos(a) * .39, Math.sin(a) * .39, .36], .014, 'motor'); }
  // Large angled teal terminal box on top of motor (card 34 FRONT/LEFT)
  const tBox = h.box(motor, [.38, .36, .34], [-.18, .48, -.05], 'motor'); tBox.rotation.z = .35;
  h.pipe(motor, [[-.32, .36, -.05], [-.52, .05, .05], [-.56, -.52, .12]], .028, 'black');

  const guard = s._part(root, '경사 황색 벨트커버·슬롯 망', [0, .2, 1.2]);
  const cover = h.geo('blower-folded-belt-cover', () => {
    const outline = new THREE.Shape();
    outline.moveTo(-1.18, -.22); outline.quadraticCurveTo(-1.18, -.32, -1.02, -.32);
    outline.lineTo(1.02, -.32); outline.quadraticCurveTo(1.18, -.32, 1.18, -.12);
    outline.lineTo(1.18, .12); outline.quadraticCurveTo(1.18, .32, 1.02, .32);
    outline.lineTo(-1.02, .32); outline.quadraticCurveTo(-1.18, .32, -1.18, .20); outline.closePath();
    return new THREE.ExtrudeGeometry(outline, { depth: .14, bevelEnabled: true, bevelThickness: .012, bevelSize: .012, bevelSegments: 2, curveSegments: 6 });
  });
  const beltGroup = s._group(guard, [.38, 2.74, .88]); beltGroup.rotation.z = .24;
  h.mesh(beltGroup, cover, h.m.yellow, [0, 0, 0]);
  const guardSlots = Array.from({ length: 14 }, (_, i) => ({ position: [-.78 + i * .12, 0, .155] }));
  h.instances(beltGroup, h.geo('blower-guard-slot', () => new THREE.BoxGeometry(.07, .42, .006)), 'dark', guardSlots);

  const access = s._part(root, '적색 점검 데크·난간·인접 적색 기둥', [.2, 0, .5]);
  h.box(access, [4.36, .06, 2.72], [0, 1.62, 0], 'tray');
  for (const [a, b] of [[[-2.18, 1.36], [2.18, 1.36]], [[2.18, -1.36], [2.18, 1.36]], [[-2.18, -1.36], [-2.18, 1.36]]]) {
    const n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 1.1));
    for (let i = 0; i <= n; i++) {
      const t = i / n, px = a[0] + (b[0] - a[0]) * t, pz = a[1] + (b[1] - a[1]) * t;
      h.bar(access, [px, 1.64, pz], [px, 2.68, pz], .022, 'red');
    }
    for (const ry of [2.16, 2.68]) h.bar(access, [a[0], ry, a[1]], [b[0], ry, b[1]], .024, 'red');
  }
  for (const lx of [1.45, 1.92]) h.bar(access, [lx, .05, 1.44], [lx, 1.66, 1.44], .022, 'red');
  for (let y = .26; y < 1.62; y += .26) h.bar(access, [1.45, y, 1.44], [1.92, y, 1.44], .018, 'red');
  // Nearby red vertical support column visible in card 34 FRONT/LEFT
  h.ibeam(access, [2.15, .04, 2.35], [2.15, 6.15, 2.35], .16, .18, 'red');
  h.box(access, [.28, .04, .28], [2.15, .02, 2.35], 'dark');
  root.userData.ports = { discharge: [-.2, 4.5, -.3] }; root.userData.unseenImpellerAdded = false;
}

function cyclone(s, root, item, h) {
  const r = item.radius || 1.2, upperR = item.upperRadius || .78, height = item.height || 4.15;
  // Card 33 (보류 4): short wide cylinder + narrower upper neck on circular green concrete curb + white nameplate
  const lower = s._part(root, '원통 외피·초록 원형 턱', [0, 0, 0]);
  h.cyl(lower, r + .20, .20, [0, .10, 0], 'curb', 'y', r + .24, false);
  h.cyl(lower, r + .06, .06, [0, .22, 0], 'trim', 'y', r + .06, false);
  for (let i = 0; i < 8; i++) {
    const a = i * TAU / 8, lug = h.box(lower, [.04, .22, .14], [Math.cos(a) * (r + .05), .32, Math.sin(a) * (r + .05)], 'trim');
    lug.rotation.y = -a;
  }
  const bodyH = 2.08;
  h.cyl(lower, r, bodyH, [0, .22 + bodyH / 2, 0], item.id === 'cyclone-3' ? 'stainedSteel' : 'steel');
  for (const y of [.26, 1.38, .22 + bodyH]) h.ring(lower, r + .016, .022, [0, y, 0]);
  if (item.id === 'cyclone-1') {
    h.box(lower, [.46, .48, .12], [r + .02, .88, .18], 'steel').rotation.y = Math.PI / 2;
  }

  const upper = s._part(root, '상부 좁은 목 원통·단차부', [0, .9, 0]);
  const shY = .22 + bodyH;
  const shoulder = h.geo(`cyclone-rolled-shoulder:${r}:${upperR}`, () => new THREE.LatheGeometry(
    [[r, 0], [r, .03], [r - .04, .06], [upperR + .04, .18], [upperR, .22]]
      .map(([radius, y]) => new THREE.Vector2(radius, y)), 48));
  h.mesh(upper, shoulder, h.m.steel, [0, shY, 0]);
  const neckH = 1.42;
  h.cyl(upper, upperR, neckH, [0, shY + .22 + neckH / 2, 0]);
  h.ring(upper, upperR + .014, .020, [0, shY + .22 + neckH - .03, 0]);

  const outlet = s._part(root, '매니폴드·상부 분기 덕트', [-.7, .2, 0]);
  // Tangential rectangular inlet box entering lower cylinder from rear (-X) manifold
  h.box(outlet, [.85, .74, .56], [-r - .22, 1.78, .38], 'steel');
  // Shared front gray stair/railing deck + rear ribbed rectangular manifold + 3 flaring round ducts + floor elbow (owned by middle cyclone-2)
  if (item.id === 'cyclone-2') {
    const dy = 2.28;
    // Front (+X) gray steel inspection deck spanning cyclones 1..3 + north access stair (card 33 FRONT/LEFT/RIGHT)
    h.box(outlet, [1.05, .07, 8.2], [r + .48, dy, 0], 'concrete');
    for (const px of [r + .06, r + .96]) for (const pz of [-3.95, -1.5, 1.5, 3.95]) {
      h.bar(outlet, [px, .02, pz], [px, dy, pz], .032, 'concrete');
    }
    for (const [a, b] of [[[r + .98, -4.05], [r + .98, 4.05]], [[r + .04, 4.05], [r + .98, 4.05]]]) {
      const n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 1.35));
      for (let i = 0; i <= n; i++) {
        const t = i / n, px = a[0] + (b[0] - a[0]) * t, pz = a[1] + (b[1] - a[1]) * t;
        h.bar(outlet, [px, dy, pz], [px, dy + 1.04, pz], .020, 'concrete');
      }
      for (const ry of [dy + .52, dy + 1.04]) h.bar(outlet, [a[0], ry, a[1]], [b[0], ry, b[1]], .022, 'concrete');
    }
    // North (-Z) angled steel access stair descending along -Z (card 33 LEFT)
    const stX = r + .52, stZ0 = -4.05, stRun = 1.95, steps = 10;
    for (let i = 0; i < steps; i++) {
      const t = (i + .5) / steps;
      h.box(outlet, [.76, .045, .22], [stX, dy * (1 - t), stZ0 - stRun * t], 'concrete');
    }
    for (const sx of [-.38, .38]) {
      h.bar(outlet, [stX + sx, dy, stZ0], [stX + sx, .04, stZ0 - stRun], .035, 'concrete');
      h.bar(outlet, [stX + sx, dy + 1.02, stZ0], [stX + sx, 1.02, stZ0 - stRun], .020, 'concrete');
    }
    // Rear (-X) long rectangular manifold duct with vertical flange ribs & end round cleanout port (card 33 REAR)
    const mx = -r - .68, my = 2.42;
    h.box(outlet, [.82, .86, 8.1], [mx, my, 0], 'stainedSteel');
    for (let zRib = -3.9; zRib <= 3.9; zRib += .86) h.box(outlet, [.90, .94, .035], [mx, my, zRib], 'trim');
    for (const pz of [-3.4, 0, 3.4]) {
      for (const lx of [mx - .36, mx + .36]) h.bar(outlet, [lx, .02, pz], [lx, my - .43, pz], .032, 'concrete');
      h.bar(outlet, [mx - .38, 1.15, pz], [mx + .38, 1.15, pz], .026, 'concrete');
    }
    // Clamped round inspection port on manifold end (card 33 REAR left)
    h.cyl(outlet, .22, .08, [mx - .44, my, 3.55], 'trim', 'x');
    h.bar(outlet, [mx - .50, my, 3.30], [mx - .50, my, 3.80], .014, 'trim');
    // 3 thick flaring round stainless ducts rising & converging above the rear manifold (card 33 REAR top)
    for (const [cz, tz] of [[-3, -1.2], [0, 0], [3, 1.2]]) {
      h.pipe(outlet, [[0, shY + .22 + neckH - .25, cz], [-.85, 4.35, cz * .72], [mx - .15, 5.55, tz]], .42, 'steel');
    }
    // Thick floor elbow duct plunging into circular green floor curb (card 33 RIGHT & card 34 FRONT left)
    h.pipe(outlet, [[.25, 2.08, -3.35], [1.65, 2.02, -4.15], [2.45, 1.65, -4.45], [2.68, .92, -4.55], [2.68, .18, -4.55]], .50, 'steel');
    h.cyl(outlet, .72, .20, [2.68, .10, -4.55], 'curb', 'y', .76, false);
  }

  // White/blue nameplate ("싸이클론 1/2/3") facing the +X east hall aisle (card 33 FRONT)
  const door = s._part(root, '전면 명판·점검 브래킷', [.6, .1, 0]);
  const label = item.name || '싸이클론';
  plaque(s, h, door, label, [.48, .20], [r + 1.02, 2.28, 0], Math.PI / 2);
  if (item.id === 'cyclone-3') plaque(s, h, door, '▲ 주의', [.32, .16], [r + .04, 3.65, 0], Math.PI / 2);
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
  const deck = s._group(s.scene, [0, elevation, 0]), structure = s._group(s.scene, [0, elevation, 0]), ducts = s._group(s.scene, [0, elevation, 0]), cover = s._group(s.scene, [0, elevation, 0]), facade = s._group(s.scene, [0, elevation, 0]), ceiling = s._group(s.scene, [0, elevation, 0]), machineRoomCover = s._group(s.scene, [0, elevation, 0]), machineRoomInterior = s._group(s.scene, [0, elevation, 0]);
  deck.name = `dryer-upper-${floor}-deck`; structure.name = `dryer-upper-${floor}-structure`; ducts.name = `dryer-upper-${floor}-ducts`; cover.name = `dryer-upper-${floor}-cutaway-cover`; facade.name = `dryer-upper-${floor}-cutaway-facade`; ceiling.name = `dryer-upper-${floor}-ceiling`; ceiling.visible = false;
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
  // Walls, doors, windows and steel columns come from the as-built drawings.
  function drawnWalls(options = {}) {
    const plan = dryerWallPlan(floor); if (!plan) return;
    const openings = s._group(structure); openings.name = `dryer-upper-${floor}-plan-openings`;
    const kit = createArchitectureKit(s, { key: 'dryer-plan', level: floor, prefix: `dryer-plan-${floor}`, structure, facade, fixtures: openings, deck });
    for (const data of plan.walls) kit.wall({ height: plan.height, skirting: floor === 6, ...data });
    for (const data of plan.columns) kit.column({ height: plan.height, plinth: { size: .6, height: .38 }, ...data, x: data.position[0], z: data.position[1], ...options });
    kit.finish();
  }
  function stairOpening(bounds) {
    if (bounds.runAxis === 'x') return { minX: bounds.minX + 1.1, maxX: bounds.maxX - .05, minZ: bounds.minZ + .02, maxZ: bounds.maxZ - .02 };
    const lane = Math.min(1.3, (bounds.maxX - bounds.minX - .28) / 2), run = Math.min(3, bounds.maxZ - bounds.minZ - 2.1), x = (bounds.minX + bounds.maxX) / 2, z = (bounds.minZ + bounds.maxZ) / 2;
    return { minX: x - lane - .1, maxX: x + lane + .1, minZ: z - run / 2 - .98, maxZ: z + run / 2 + .98 };
  }
  const internalBounds = profile.internalStairs || { minX: 5.9, maxX: 8.1, minZ: 3.8, maxZ: 9.2 };
  const externalBounds = profile.stairs || { minX: 8.7, maxX: 13.3, minZ: -13.3, maxZ: -10.7, runAxis: 'x' };
  function rail(parent, a, b, base = 0, height = 1.2, paint = 'white') {
    const first = new THREE.Vector3(a[0], base, a[1]), last = new THREE.Vector3(b[0], base, b[1]), count = Math.ceil(first.distanceTo(last) / 1.45);
    for (let i = 0; i <= count; i++) { const point = first.clone().lerp(last, i / count); h.bar(parent, point.toArray(), point.clone().add(new THREE.Vector3(0, height, 0)).toArray(), .022, paint); }
    for (const y of [height / 2, height]) h.bar(parent, [a[0], base + y, a[1]], [b[0], base + y, b[1]], .023, paint);
  }
  function stairs(bounds, fromY, toY, name) {
    const group = s._group(structure, [(bounds.minX + bounds.maxX) / 2, fromY - elevation, (bounds.minZ + bounds.maxZ) / 2]); group.name = name;
    const alongX = bounds.runAxis === 'x', across = alongX ? bounds.maxZ - bounds.minZ : bounds.maxX - bounds.minX, length = alongX ? bounds.maxX - bounds.minX : bounds.maxZ - bounds.minZ;
    if (alongX) group.rotation.y = -Math.PI / 2;
    const flights = 4, steps = 9, rise = (toY - fromY) / flights, lane = Math.min(1.3, (across - .28) / 2), run = Math.min(3, length - 2.1), landing = .95;
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
  function buildUpperCeiling() {
    const width = gable.maxX - gable.minX, half = width / 2, rise = ridge - eave, slope = Math.hypot(half, rise), centreX = (gable.minX + gable.maxX) / 2, centreZ = (gable.minZ + gable.maxZ) / 2, length = gable.maxZ - gable.minZ;
    for (const side of [-1, 1]) {
      const sheet = h.box(ceiling, [slope, .055, length], [centreX + side * half / 2, (eave + ridge) / 2 - elevation, centreZ], 'ceilingDeck');
      sheet.rotation.z = -side * Math.atan2(rise, half);
      sheet.userData.personCollision = false; sheet.castShadow = false;
      for (const t of [.25, .5, .75]) {
        const px = centreX + side * half * t, py = ridge - rise * t - elevation - .08;
        const purlin = h.box(ceiling, [.1, .14, length], [px, py, centreZ], 'cream');
        purlin.rotation.z = sheet.rotation.z; purlin.userData.personCollision = false; purlin.castShadow = false;
      }
    }
    if (floor === 6) {
      // North service bay flat soffit under the 32.6m roof apron (clear of west stair opening x < -5.7)
      const northSoffit = h.box(ceiling, [14.05, .06, 6.6], [1.525, apron.elevation - elevation - .18, -10.05], 'ceilingDeck');
      northSoffit.userData.personCollision = false; northSoffit.castShadow = false;
      for (const z of [-12.2, -9.8, -7.2]) {
        const bm = h.box(ceiling, [13.9, .28, .2], [1.45, apron.elevation - elevation - .35, z], 'cream');
        bm.userData.personCollision = false; bm.castShadow = false;
      }
    }
    const lamps = [], leds = [], trays = [];
    const lightY = floor === 6 ? 7.8 : 4.5;
    for (const lx of [-4.8, 0, 4.8]) for (const lz of (floor === 6 ? [-10.5, -4.5, 1.2, 8.2] : [3.8, 8.2, 12.0])) {
      if (floor === 6 && Math.hypot(lx + 1, lz - 7.5) < 4.5) continue;
      if (floor === 7 && Math.hypot(lx + 1, lz - 7.5) < 4.4) continue;
      const y = (floor === 6 && lz < -6.7) ? 5.7 : lightY + (1 - Math.abs(lx) / 8.6) * .8;
      lamps.push({ position: [lx, y, lz], scale: [1, 1, 1] });
      leds.push({ position: [lx, y - .08, lz], scale: [1, 1, 1] });
    }
    trays.push({ position: [-6.8, floor === 6 ? 5.6 : 4.2, 3.2], scale: [.32, .07, 18.8] });
    trays.push({ position: [6.8, floor === 6 ? 5.6 : 4.2, -1.7], scale: [.32, .07, 9.0] });
    if (lamps.length) {
      const lm = h.instances(ceiling, h.geo('upper-ceil-shade', () => new THREE.CylinderGeometry(.12, .24, .16, 18)), 'tray', lamps);
      lm.userData.personCollision = false; lm.castShadow = false;
      const ld = h.instances(ceiling, h.geo('upper-ceil-led', () => new THREE.CylinderGeometry(.21, .21, .02, 18)), 'led', leds);
      ld.userData.personCollision = false; ld.castShadow = false;
    }
    if (trays.length) {
      const tr = h.instances(ceiling, h.geo('upper-ceil-tray', () => new THREE.BoxGeometry(1, 1, 1)), 'tray', trays);
      tr.userData.personCollision = false; tr.castShadow = false;
    }
  }
  if (floor === 6) {
    plate(deck, { minX: -8.6, maxX: 8.6, minZ: -13.4, maxZ: 13.4 }, 0, 'floor', [well, { minX: -8.5, maxX: -5.7, minZ: -13.28, maxZ: -9.48 }]);
    plate(deck, { minX: 8.6, maxX: 10.25, minZ: -13.4, maxZ: -6.25 }, 0, 'concrete'); plate(deck, { minX: 10.25, maxX: 13.5, minZ: -13.4, maxZ: -10.35 }, 0, 'concrete', { minX: 10.26, maxX: 13.2, minZ: -13.28, maxZ: -10.74 });
    for (const x of [-8.25, 8.25]) for (const z of [-13.15, -6.7, 0, 6.7, 13.15]) {
      const height = (z < gable.minZ - .1 ? apron.elevation : eave) - elevation;
      // Above the 7F datum the perimeter frame carries on to the eave.
      if (height > 6.4) h.ibeam(structure, [x, 6.2, z], [x, height, z], .3, .34);
    }
    for (const z of [gable.minZ, 0, 6.7, gable.maxZ]) {
      h.ibeam(structure, [-8.25, eave - elevation, z], [0, ridge - elevation, z], .19, .3);
      h.ibeam(structure, [0, ridge - elevation, z], [8.25, eave - elevation, z], .19, .3);
      h.ibeam(structure, [-8.25, eave - elevation, z], [8.25, eave - elevation, z], .13, .2);
      for (const x of [-5.5, -2.75, 0, 2.75, 5.5]) h.bar(structure, [x, eave - elevation, z], [x + (x < 0 ? 1.4 : -1.4), ridge - elevation - Math.abs(x) * (ridge - eave) / 8.6, z], .027, 'cream');
    }
    drawnWalls();
    buildUpperCeiling();
    const triangle = new THREE.Shape(); triangle.moveTo(-8.6, eave - elevation); triangle.lineTo(0, ridge - elevation); triangle.lineTo(8.6, eave - elevation); triangle.closePath();
    const end = h.mesh(facade, h.geo(`gable-front:${eave - elevation}:${ridge - elevation}`, () => new THREE.ShapeGeometry(triangle)), h.m.cream, [0, 0, 13.4]); end.material.side = THREE.DoubleSide;
    const internal = stairs(internalBounds, elevation, apron.elevation, 'dryer-internal-four-flight-stair');
    Object.assign(deck.userData, { openingDiameter: well.diameter, floorBasis: 'A016-main-hall' });
    return { deck, structure, ducts, cover, facade, ceiling, machineRoomCover, machineRoomInterior, stairs: internal };
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
    drawnWalls();
    buildUpperCeiling();
    for (const z of [-6.7, 2.7, 13.25]) h.ibeam(structure, [-8.25, -.19, z], [8.25, -.19, z], .16, .25);
    Object.assign(ducts.userData, { observedDuctOwnedByEquipment: 'dryer-upper-duct-run', hiddenConnectionsConfirmed: false });
    Object.assign(deck.userData, { openingDiameter: well.diameter, middleOpen: true, serviceBayOwnedByFloor8: true, stairOpening: stairOpening(internalBounds), equipmentApron, elbowOpening, equipmentApronBasis: 'video-414-432s-local-platform;position-and-outline-approximate;historical-A017-OPEN-retained' });
    return { deck, structure, ducts, cover, facade, ceiling, machineRoomCover, machineRoomInterior };
  }
  if (floor === 8) {
    // A-017: open roof stops at the tower; only the lobby and stair bay reach east.
    const apronOutline = [[apron.minX, apron.minZ], [13.5, apron.minZ], [13.5, -10.35], [10.25, -10.35], [10.25, -6.25], [8.6, -6.25], [8.6, apron.maxZ], [apron.minX, apron.maxZ]];
    plate(deck, { ...apron, outline: apronOutline }, apron.elevation - elevation, 'apron', stairOpening(externalBounds), .18);
    for (const [a, b] of [[[apron.minX, apron.minZ], [8.5, apron.minZ]], [[apron.minX, apron.minZ], [apron.minX, apron.maxZ]]]) {
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
    drawnWalls();
    const outerStair = stairs(externalBounds, profile.stairs?.fromY ?? 26.2, profile.stairs?.toY ?? 32.6, 'dryer-service-four-flight-stair');
    Object.assign(deck.userData, { sameDatumAsFloor7: true, notAnAdditionalStorey: true, gableSurfaceOwnedByCover: true, stairOpening: stairOpening(externalBounds) });
    return { deck, structure, ducts, cover, facade, machineRoomCover, machineRoomInterior, stairs: outerStair };
  }
  return { deck, structure, ducts, cover, facade, machineRoomCover, machineRoomInterior };
}
