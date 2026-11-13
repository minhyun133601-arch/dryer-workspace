import * as THREE from '../shared/vendor/three.module.js';

// 11/11 footage: the door identifies this as 1팀2파트 보일러실. It is not
// the separate 3팀 boiler-card reference area. All dimensions below are visual
// reconstruction values; the closed boilers are never opened internally.
const TAU = Math.PI * 2;

function tools(s, inherited = {}) {
  const paints = {
    wall: 0xe6e6db, floor: 0xa09b90, green: 0x447b63, steel: 0xa8b4b1,
    shell: 0xc5c9bc, panel: 0xa7b5a6, dark: 0x283a3c, blue: 0x387d9c,
    yellow: 0xe1bf45, orange: 0xd89747, purple: 0x767083, red: 0x9e4940,
    white: 0xe9ece3, black: 0x263032, wood: 0xb48a58, tank: 0x8fa69a,
    concrete: 0xbcbbb0, salt: 0x6ea9d4, tile: 0x8d918b, epoxy: 0x9b7f72,
  };
  const materials = {};
  for (const [key, color] of Object.entries(paints)) materials[key] = inherited[key] || s._material(color, key === 'steel' ? .38 : .75, key === 'steel' ? .6 : .08);
  materials.glass = s._material(0x96bac1, .38, .1, { transparent: true, opacity: .48, side: THREE.DoubleSide });
  const geometries = new Map();
  const geo = (key, factory) => {
    if (!geometries.has(key)) { const geometry = factory(); geometries.set(key, geometry); s.geometries.add(geometry); }
    return geometries.get(key);
  };
  const mesh = (parent, geometry, position, paint = 'steel') => s._mesh(geometry, materials[paint] || paint, parent, position);
  const box = (parent, size, position, paint = 'steel') => {
    const value = mesh(parent, geo('box', () => new THREE.BoxGeometry(1, 1, 1)), position, paint); value.scale.set(...size); return value;
  };
  const cylinder = (parent, radius, height, position, paint = 'steel', axis = 'y', bottom = radius) => {
    const value = mesh(parent, geo(`cylinder:${bottom / radius}`, () => new THREE.CylinderGeometry(1, bottom / radius, 1, 28)), position, paint);
    value.scale.set(radius, height, radius);
    if (axis === 'x') value.rotation.z = Math.PI / 2;
    if (axis === 'z') value.rotation.x = Math.PI / 2;
    return value;
  };
  const bar = (parent, start, end, radius = .04, paint = 'steel') => {
    const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end);
    const value = cylinder(parent, radius, a.distanceTo(b), a.clone().add(b).multiplyScalar(.5).toArray(), paint);
    value.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize()); return value;
  };
  const pipe = (parent, points, radius = .06, paint = 'steel') => {
    const path = new THREE.CurvePath();
    for (let i = 1; i < points.length; i++) path.add(new THREE.LineCurve3(new THREE.Vector3(...points[i - 1]), new THREE.Vector3(...points[i])));
    const geometry = new THREE.TubeGeometry(path, Math.max(2, points.length * 5), radius, 8, false);
    return mesh(parent, geometry, [0, 0, 0], paint);
  };
  const ring = (parent, radius, tube, position, paint = 'steel', axis = 'z') => {
    const value = mesh(parent, geo(`ring:${radius}:${tube}`, () => new THREE.TorusGeometry(radius, tube, 6, 24)), position, paint);
    if (axis === 'x') value.rotation.y = Math.PI / 2;
    if (axis === 'y') value.rotation.x = Math.PI / 2;
    return value;
  };
  const gauge = (parent, position, radius = .11) => {
    const value = s._group(parent, position);
    cylinder(value, radius + .015, .06, [0, 0, 0], 'dark', 'z');
    cylinder(value, radius, .008, [0, 0, .035], 'white', 'z');
    ring(value, radius + .005, .012, [0, 0, .033], 'steel');
    const ticks = geo(`gauge-ticks:${radius}`, () => {
      const points = [];
      for (let i = 0; i <= 16; i++) {
        const angle = Math.PI * (.75 + i * 1.5 / 16), outer = radius * .86, inner = radius * (i % 4 ? .72 : .58);
        points.push(Math.cos(angle) * inner, Math.sin(angle) * inner, .044, Math.cos(angle) * outer, Math.sin(angle) * outer, .044);
      }
      return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    });
    if (!materials.gaugeTicks) { materials.gaugeTicks = new THREE.LineBasicMaterial({ color: paints.dark }); s.materials.add(materials.gaugeTicks); }
    const graduations = new THREE.LineSegments(ticks, materials.gaugeTicks); graduations.name = 'campus-boiler-nonnumeric-gauge-graduations'; value.add(graduations);
    bar(value, [0, 0, .043], [-radius * .4, radius * .35, .043], .006, 'dark');
    value.userData.indication = 'unreadable-static-reference'; return value;
  };
  const valve = (parent, position, radius = .13, paint = 'red') => {
    const value = s._group(parent, position); ring(value, radius, .018, [0, 0, 0], paint);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; bar(value, [0, 0, 0], [Math.cos(a) * radius, Math.sin(a) * radius, 0], .012, paint); }
    cylinder(value, .035, .1, [0, 0, -.05], 'steel', 'z'); return value;
  };
  const instances = (parent, geometry, transforms, paint, name) => {
    const value = new THREE.InstancedMesh(geometry, materials[paint], transforms.length);
    const matrix = new THREE.Matrix4();
    transforms.forEach(({ position, scale, rotation = [0, 0, 0] }, i) => { matrix.compose(new THREE.Vector3(...position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(...scale)); value.setMatrixAt(i, matrix); });
    value.instanceMatrix.needsUpdate = true; value.castShadow = true; value.receiveShadow = true; value.name = name; value.computeBoundingBox(); value.computeBoundingSphere(); parent.add(value); return value;
  };
  const repeats = (parent, sizes, positions, paint, name) => instances(parent, geo('box', () => new THREE.BoxGeometry(1, 1, 1)), positions.map(position => ({ position, scale: sizes })), paint, name);
  const bolts = (parent, position, radius, count = 8, axis = 'z', paint = 'steel') => {
    const group = s._group(parent, position); group.name = 'campus-boiler-visible-bolted-joint';
    if (axis === 'x') group.rotation.y = Math.PI / 2;
    if (axis === 'y') group.rotation.x = Math.PI / 2;
    instances(group, geo('hex-bolt', () => new THREE.CylinderGeometry(1, 1, 1, 6)), Array.from({ length: count }, (_, i) => ({
      position: [Math.cos(i * TAU / count) * radius, Math.sin(i * TAU / count) * radius, 0], scale: [.025, .035, .025], rotation: [Math.PI / 2, 0, 0],
    })), paint, 'campus-boiler-instanced-flange-fasteners');
    return group;
  };
  const flange = (parent, position, radius, axis = 'z', paint = 'steel') => {
    const group = s._group(parent, position); group.name = 'campus-boiler-observed-pipe-flange';
    if (axis === 'x') group.rotation.y = Math.PI / 2;
    if (axis === 'y') group.rotation.x = Math.PI / 2;
    cylinder(group, radius, .08, [0, 0, 0], paint, 'z');
    ring(group, radius * .79, .012, [0, 0, .05], paint);
    bolts(group, [0, 0, .063], radius * .77, 8, 'z', paint); return group;
  };
  const motorDetail = (parent, position, radius, length, paint = 'green') => {
    const group = s._group(parent, position); group.name = 'campus-boiler-observed-motor-cooling-fins';
    const fins = Array.from({ length: 18 }, (_, i) => {
      const a = i * TAU / 18;
      return { position: [0, Math.cos(a) * (radius + .012), Math.sin(a) * (radius + .012)], scale: [length * .82, .024, .012], rotation: [a, 0, 0] };
    });
    instances(group, geo('box', () => new THREE.BoxGeometry(1, 1, 1)), fins, paint, 'campus-boiler-instanced-motor-fins');
    cylinder(group, radius + .012, .06, [length / 2, 0, 0], 'dark', 'x');
    const vents = [];
    for (let i = -3; i <= 3; i++) { const y = i * radius * .2; vents.push([length / 2 + .034, y, 0]); }
    repeats(group, [.008, .012, radius * 1.3], vents, paint, 'campus-boiler-motor-fan-cap-vents');
    box(group, [.12, .1, .12], [0, radius + .06, 0], paint); return group;
  };
  return { materials, mesh, box, cylinder, bar, pipe, ring, gauge, valve, repeats, instances, geo, bolts, flange, motorDetail };
}

function controlCabinet(s, parent, t, position, width = .78, height = 2.15) {
  const cabinet = s._group(parent, position); cabinet.name = 'campus-boiler-main-control-cabinet';
  t.box(cabinet, [width, height, .5], [0, height / 2, 0], 'panel');
  const instruments = s._group(cabinet); instruments.name = 'campus-boiler-control-panel-observed-instruments';
  for (const x of [-.24, 0, .24]) t.gauge(instruments, [x, height - .28, .275], .052);
  t.box(instruments, [.31, .25, .09], [width / 2 + .1, height - .26, .24], 'panel');
  t.box(instruments, [.26, .14, .02], [width / 2 + .1, height - .26, .296], 'dark');
  for (let row = 0; row < 3; row++) for (let col = 0; col < 7; col++) {
    const x = (col - 3) * width * .115, y = height - .62 - row * .18;
    t.cylinder(instruments, row === 1 ? .026 : .022, .025, [x, y, .275], row === 1 ? 'dark' : col === 0 ? 'red' : 'green', 'z');
    if (row === 1) t.box(instruments, [.012, .036, .018], [x + .008, y + .009, .298], 'white');
  }
  t.box(cabinet, [width * .72, .25, .018], [0, .56, .267], 'white');
  t.bar(cabinet, [width * .34, .9, .28], [width * .34, 1.18, .28], .015);
  for (const x of [-width * .41, width * .41]) for (const y of [.12, height - .1]) t.cylinder(cabinet, .012, .014, [x, y, .267], 'steel', 'z');
  t.pipe(cabinet, [[-.13, .05, -.2], [-.13, -.03, -.31], [-.55, -.03, -.31], [-.55, .6, -.31]], .022, 'black');
  cabinet.userData.liveReadoutAdded = false; return cabinet;
}

// Straight pipe runs reuse one cylinder and one elbow geometry. Wall-scale
// services stay cheap even when many visible routes are drawn.
function run(t, parent, points, radius = .06, paint = 'steel') {
  for (let i = 1; i < points.length; i++) t.bar(parent, points[i - 1], points[i], radius, paint);
  const elbow = t.geo('elbow-sphere', () => new THREE.SphereGeometry(1, 12, 8));
  for (let i = 1; i < points.length - 1; i++) t.mesh(parent, elbow, points[i], paint).scale.setScalar(radius * 1.05);
}

function placeBlueWallLeg(pipe,wallZ){
  const points=pipe.userData.routingPoints.map(point=>[...point]);
  points[2][2]=points[3][2]=wallZ;
  for(let i=1;i<points.length;i++){
    const a=new THREE.Vector3(...points[i-1]),b=new THREE.Vector3(...points[i]),delta=b.clone().sub(a),segment=pipe.children[i-1];
    segment.position.copy(a.add(b).multiplyScalar(.5));segment.scale.y=delta.length();
    segment.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
  }
  for(let i=1;i<points.length-1;i++)pipe.children[points.length+i-2].position.set(...points[i]);
  pipe.userData.routingPoints=points;
}

// 동양 보일러 연관식 DBHI-SS 300형 (nameplate clip002 2:42.5, 3,000 kg/h).
// The burner end faces the side-road wall: clip002 0:22 looks along that wall
// from the personnel door with the shutter on the left and the burner,
// control cabinet and dark round front door on the right.
function firetubeBoiler(s, parent, t, position) {
  const unit = s._group(parent, position); unit.name = 'campus-boiler-firetube-3t';
  Object.assign(unit.userData, {
    boilerId: 'firetube-3t', signCapacity: '3ton/h', nameplate: '동양 보일러 · 연관식 DBHI-SS 300형 · 최대증발량 3,000kg/h · 2006',
    identityBasis: 'door-plate-video-shell-and-nameplate', source: 'clip002:022s,037s,044s,140s,162.5s', hiddenMechanismsAdded: false,
    orientationBasis: 'clip002:022s burner and control cabinet face the side-road aisle',
  });
  const radius = 1.15, length = 5, centreY = 1.58, front = length / 2, top = centreY + radius;
  t.box(unit, [2.9, .22, 5.9], [0, .11, -.1], 'green');
  for (const z of [-1.75, 1.75]) t.box(unit, [2.25, .32, .32], [0, .38, z], 'dark');
  const body = t.cylinder(unit, radius, length, [0, centreY, 0], 'shell', 'z'); body.name = 'campus-boiler-firetube-horizontal-shell';
  t.cylinder(unit, radius * .99, .1, [0, centreY, front], 'dark', 'z');
  t.cylinder(unit, radius * .99, .1, [0, centreY, -front], 'shell', 'z');
  for (const z of [-front, front]) t.ring(unit, radius * .98, .035, [0, centreY, z + Math.sign(z) * .07]);
  t.bolts(unit, [0, centreY, front + .085], radius * .87, 16);
  for (const z of [-1.6, 0, 1.6]) t.ring(unit, radius + .014, .017, [0, centreY, z]);
  const frontFittings = s._group(unit); frontFittings.name = 'campus-boiler-main-head-hinges-and-nameplate';
  for (const x of [-.82, .82]) {
    t.box(frontFittings, [.13, .37, .045], [x, centreY + .25, front + .07], 'dark');
    t.cylinder(frontFittings, .035, .4, [x, centreY + .25, front + .11], 'steel');
  }
  const nameplate = t.box(frontFittings, [.025, .5, .92], [radius * .93, centreY + .45, front - 1.25], 'panel');
  Object.assign(nameplate.userData, { text: '동양 보일러', model: '연관식 DBHI-SS 300형', capacity: '최대증발량 3,000kg/h', manufactured: '2006', source: 'clip002:162.5s', fineTextConfirmed: true });
  nameplate.name = 'campus-boiler-observed-manufacturer-plate';
  const burner = s._group(unit, [0, .98, front + .38]); burner.name = 'campus-boiler-firetube-purple-burner';
  t.cylinder(burner, .52, .62, [0, 0, 0], 'purple', 'z');
  t.box(burner, [.91, .54, .65], [.12, -.12, .26], 'purple');
  t.cylinder(burner, .28, .46, [.38, .05, .28], 'dark', 'x');
  t.pipe(burner, [[-.45, -.32, .2], [-.7, -.32, .2], [-.7, .6, .2], [-.3, .6, -.1]], .035, 'steel');
  t.flange(burner, [0, 0, -.3], .58);
  const burnerBrackets = s._group(burner); burnerBrackets.name = 'campus-boiler-burner-mounts-and-conduits';
  for (const x of [-.42, .42]) {
    t.box(burnerBrackets, [.07, .45, .07], [x, -.44, .14], 'dark');
    t.box(burnerBrackets, [.24, .055, .34], [x, -.65, .14], 'steel');
  }
  t.pipe(burnerBrackets, [[.4, .22, .4], [.62, .22, .4], [.62, -.46, .4], [.25, -.66, -.25]], .022, 'black');
  controlCabinet(s, unit, t, [1.72, .13, front + .32]);
  // Top walkway, handrail and side ladder (clip002 0:37, 1:22, 2:18-2:24).
  const rear = s._group(unit); rear.name = 'campus-boiler-firetube-rear-air-and-access';
  t.box(rear, [.78, .05, 3.8], [-.3, top + .2, -.35], 'dark');
  for (const x of [-.7, .1]) {
    t.bar(rear, [x, top + 1.15, -2.25], [x, top + 1.15, 1.55], .025);
    t.bar(rear, [x, top + .7, -2.25], [x, top + .7, 1.55], .02);
    for (const z of [-2.25, -.35, 1.55]) t.bar(rear, [x, top + .2, z], [x, top + 1.15, z], .025);
  }
  // Pale green rear smoke box that feeds the large silver flue.
  t.box(rear, [1.75, 1.95, .9], [0, 1.7, -front - .5], 'panel');
  t.box(rear, [1.2, .45, .7], [0, 2.85, -front - .5], 'panel');
  const ladder = s._group(rear); ladder.name = 'campus-boiler-main-access-ladder';
  for (const z of [-2.15, -1.6]) t.bar(ladder, [radius + .62, .2, z], [.62, top + .25, z], .032);
  for (let i = 0; i < 9; i++) { const k = (i + .7) / 9.4, x = radius + .62 - k * (radius), y = .2 + k * (top + .05); t.bar(ladder, [x, y, -2.15], [x, y, -1.6], .022); }
  const steam = s._group(unit); steam.name = 'campus-boiler-top-steam-valves-and-separator';
  t.cylinder(steam, .17, 1.05, [.47, top + .7, 1.2], 'steel');
  for (const [x, z] of [[.47, .55], [.47, -.15], [.47, -.85]]) {
    t.cylinder(steam, .07, .38, [x, top + .2, z], 'steel');
    t.flange(steam, [x, top + .42, z], .13, 'y');
    t.cylinder(steam, .15, .2, [x, top + .62, z], 'black');
    t.box(steam, [.18, .16, .18], [x, top + .82, z], 'black');
  }
  const fittings = s._group(unit); fittings.name = 'campus-boiler-main-visible-gauges-and-level-column';
  t.cylinder(fittings, .14, 1.8, [1.48, 2.15, front - .55]);
  for (const y of [1.35, 2.9]) { t.pipe(fittings, [[1.06, y, front - .55], [1.48, y, front - .55]], .045); t.valve(fittings, [1.48, y, front - .39], .11, 'dark'); t.flange(fittings, [1.48, y, front - .55], .205, 'y'); }
  t.box(fittings, [.08, 1.65, .09], [1.7, 2.15, front - .49], 'dark');
  for (let i = 0; i < 8; i++) t.box(fittings, [.14, .04, .1], [1.7, 1.45 + i * .19, front - .48], 'steel');
  const sightGuard = s._group(fittings); sightGuard.name = 'campus-boiler-sight-column-protective-ties';
  for (const x of [1.63, 1.77]) t.bar(sightGuard, [x, 1.4, front - .44], [x, 2.87, front - .44], .012);
  for (const x of [-.62, .62]) {
    t.pipe(fittings, [[x, top - .1, front - .5], [x, top + .35, front - .5]], .045);
    t.gauge(fittings, [x, top + .5, front - .46], .14);
  }
  return unit;
}

function onceThroughBoiler(s, parent, t, position, rotation = 0) {
  const unit = s._group(parent, position); unit.name = 'campus-boiler-once-through-1-5t'; unit.rotation.y = rotation;
  Object.assign(unit.userData, { boilerId: 'once-through-1.5t', signCapacity: '1.5ton/h', identityBasis: 'door-plate-and-video-compact-unit', source: 'clip002:048s,052s,068s,238s', hiddenMechanismsAdded: false });
  t.box(unit, [1.85, .18, 2.05], [0, .09, 0], 'green');
  const body = t.box(unit, [1.38, 2.55, 1.42], [0, 1.52, 0], 'shell'); body.name = 'campus-boiler-once-through-compact-shell';
  t.box(unit, [1.4, .22, 1.44], [0, 2.9, 0], 'blue');
  t.box(unit, [.33, 2.25, .22], [-.4, 1.48, .82], 'dark');
  t.box(unit, [.23, .22, .025], [-.4, 2.3, .945], 'panel');
  for (let i = 0; i < 4; i++) t.cylinder(unit, .024, .012, [-.4, 1.91 - i * .22, .955], i === 3 ? 'red' : 'green', 'z');
  for (const [x, paint] of [[.12, 'yellow'], [.42, 'green']]) t.ring(unit, .085, .022, [x, 1.15, .74], paint);
  t.cylinder(unit, .23, .54, [.8, .48, .1], 'blue', 'x');
  t.motorDetail(unit, [.8, .48, .1], .23, .54, 'blue');
  t.cylinder(unit, .35, .24, [.65, .48, .1], 'shell', 'x');
  t.pipe(unit, [[.88, .32, -.6], [1.06, .32, -.6], [1.06, 1.86, -.6], [.64, 1.86, -.6]], .045);
  t.gauge(unit, [.94, 2.14, -.48], .12);
  t.valve(unit, [.98, 1.67, -.45], .11, 'dark');
  const fittings = s._group(unit); fittings.name = 'campus-boiler-compact-regulator-flanges-and-cables';
  for (const y of [.63, 1.42]) t.flange(fittings, [1.06, y, -.6], .13, 'y');
  t.box(fittings, [.14, .17, .12], [1.08, 1.2, -.48], 'dark');
  t.pipe(fittings, [[1.07, 1.2, -.42], [1.24, 1.2, -.42], [1.24, .14, -.42], [.8, .14, -.42]], .018, 'black');
  return unit;
}

// The separate yellow-guarded blower with the 태성플랜트 nameplate
// (clip002 1:46-1:54, 2:08-2:10). It is a fan, not a third boiler.
function yellowBlower(s, parent, t, position, rotation = 0) {
  const fan = s._group(parent, position); fan.name = 'campus-boiler-yellow-blower-fan'; fan.rotation.y = rotation;
  Object.assign(fan.userData, { nameplate: '태성플랜트(주) FAN', source: 'clip002:106s,112s,128s,130s', boilerIdentity: false });
  t.box(fan, [1.05, .14, .95], [0, .07, 0], 'steel');
  for (const x of [-.42, .42]) t.box(fan, [.08, .5, .8], [x, .38, 0], 'steel');
  t.cylinder(fan, .52, .42, [0, 1.0, -.1], 'shell', 'z');
  t.box(fan, [.5, .62, .42], [.36, .62, -.1], 'shell');
  const guard = s._group(fan, [0, 1.0, .18]); guard.name = 'campus-boiler-yellow-blower-mesh-guard';
  t.cylinder(guard, .46, .2, [0, 0, 0], 'yellow', 'z');
  t.cylinder(guard, .445, .015, [0, 0, .105], 'dark', 'z');
  const lattice = [];
  for (const angle of [-Math.PI / 4, Math.PI / 4]) for (let offset = -.4; offset <= .401; offset += .055) {
    const half = Math.sqrt(Math.max(0, .44 ** 2 - offset ** 2));
    lattice.push({ position: [Math.cos(angle) * offset, Math.sin(angle) * offset, .118], scale: [.012, half * 2, .012], rotation: [0, 0, angle] });
  }
  t.instances(guard, t.geo('box', () => new THREE.BoxGeometry(1, 1, 1)), lattice, 'yellow', 'campus-boiler-instanced-blower-guard-lattice');
  t.bolts(fan, [0, 1.0, .29], .5, 8);
  t.cylinder(fan, .24, .66, [.65, 1.0, -.1], 'blue', 'x');
  t.motorDetail(fan, [.65, 1.0, -.1], .24, .66, 'blue');
  const plate = t.box(fan, [.3, .18, .02], [-.3, .45, .38], 'red'); plate.name = 'campus-boiler-blower-nameplate';
  return fan;
}

// Room-scale equipment. Design coordinates follow the 13.5 m × 14 m room
// (local +z = side-road wall); P() keeps smaller test rooms enclosed.
function serviceEquipment(s, parent, t, P, w, d) {
  const services = s._group(parent, [0, .14, 0]); services.name = 'campus-boiler-observed-service-equipment';
  // Two green inline circulation pumps on vertical pipes (clip002 3:22.5).
  const pumps = s._group(services, P(1.4, 0, -6.35)); pumps.name = 'campus-boiler-green-inline-pump-pair'; pumps.rotation.y = -Math.PI / 2;
  for (const z of [-.42, .42]) {
    const pump = s._group(pumps, [0, 0, z]); pump.name = 'campus-boiler-installed-green-inline-pump';
    t.cylinder(pump, .13, .43, [0, .9, 0], 'green', 'x');
    t.cylinder(pump, .17, .16, [-.28, .9, 0], 'green', 'x');
    t.motorDetail(pump, [0, .9, 0], .13, .43, 'green');
    t.bar(pump, [-.28, .2, 0], [-.28, 2.5, 0], .065, 'steel');
    for (const y of [.64, 1.15]) t.flange(pump, [-.28, y, 0], .105, 'y', 'green');
    t.pipe(pump, [[0, 1.1, .12], [.25, 1.1, .17], [.25, .35, .17], [.36, .35, .17]], .018, 'black');
  }
  Object.assign(pumps.userData, { observedInstalledPumpCount: 2, source: 'clip002:202.5s' });
  // Tall grey-green vertical tank with red hand wheel (clip002 3:06-3:10).
  const feed = s._group(services, P(-.35, 0, -6.05)); feed.name = 'campus-boiler-vertical-service-tank';
  t.cylinder(feed, .56, 2.75, [0, 1.5, 0], 'tank');
  t.cylinder(feed, .5, .2, [0, 2.95, 0], 'tank');
  for (const y of [.35, 2.55]) t.ring(feed, .57, .02, [0, y, 0], 'steel', 'y');
  for (const x of [-.36, .36]) t.box(feed, [.08, .22, .08], [x, .11, .3], 'steel');
  t.valve(feed, [0, 1.25, .66], .16, 'red');
  run(t, feed, [[.45, .5, .35], [.85, .5, .35], [.85, 2.3, .35]], .055, 'steel');
  feed.userData.functionUnconfirmed = true;
  // Horizontal grey-green service tanks on red frames (clip002 1:40-1:42, 3:12-3:28).
  const tanks = s._group(services); tanks.name = 'campus-boiler-horizontal-service-tanks';
  for (const z of [-2.15, -3.4]) {
    const [x, , zz] = P(2.25, 0, z);
    t.cylinder(tanks, .48, 2.3, [x, 1.12, zz], 'tank', 'x');
    for (const end of [-1.15, 1.15]) t.cylinder(tanks, .46, .06, [x + end, 1.12, zz], 'tank', 'x');
    for (const dx of [-.8, .8]) { t.box(tanks, [.08, .64, .82], [x + dx, .32, zz], 'red'); t.box(tanks, [.12, .08, .9], [x + dx, .64, zz], 'red'); }
    t.gauge(tanks, [x - .45, 1.72, zz], .09);
    run(t, tanks, [[x + .6, 1.55, zz], [x + .6, 2.35, zz], [x + .6, 2.35, zz + .55]], .05, 'blue');
  }
  tanks.userData.functionUnconfirmed = true;
  // Steam header on a stainless frame beside the large boiler (clip002 1:56-2:00).
  const header = s._group(services, P(.55, 0, 1.55)); header.name = 'campus-boiler-steam-header-frame';
  for (const z of [-1.25, 1.25]) for (const x of [-.32, .32]) t.box(header, [.06, 2.25, .06], [x, 1.125, z], 'steel');
  for (const y of [.55, 2.2]) for (const x of [-.32, .32]) t.box(header, [.05, .05, 2.56], [x, y, 0], 'steel');
  t.box(header, [.9, .1, 2.8], [0, .05, 0], 'red');
  t.cylinder(header, .15, 2.6, [0, 1.75, 0], 'shell', 'z');
  for (const z of [-1.3, 1.3]) t.flange(header, [0, 1.75, z], .2, 'z');
  for (const z of [-.75, 0, .75]) {
    t.cylinder(header, .06, .32, [0, 2.05, z], 'steel');
    t.box(header, [.2, .2, .2], [0, 2.3, z], 'black');
    t.valve(header, [.18, 1.75, z], .11, 'red');
  }
  for (const z of [-.6, .6]) { t.cylinder(header, .11, .2, [.12, .45, z], 'steel', 'x'); run(t, header, [[0, 1.6, z], [0, .45, z]], .03, 'steel'); }
  header.userData.functionUnconfirmed = true;
  // Water treatment: two FRP softeners, brine tank and salt pallet (clip002 0:52, 1:30-1:36, 3:58).
  const treatment = s._group(services); treatment.name = 'campus-boiler-water-treatment';
  for (const z of [-.45, -1.2]) {
    const [x, , zz] = P(6.12, 0, z);
    t.cylinder(treatment, .3, 1.6, [x, .9, zz], 'tank');
    t.cylinder(treatment, .16, .22, [x, 1.81, zz], 'dark');
    t.box(treatment, [.12, .16, .1], [x - .2, 1.83, zz], 'dark');
  }
  { const [x, , z] = P(6.0, 0, -2.45); t.cylinder(treatment, .44, 1.05, [x, .62, z], 'white'); t.cylinder(treatment, .45, .06, [x, 1.17, z], 'white'); }
  { const [x, , z] = P(2.95, 0, -6.12); t.box(treatment, [1.15, .14, 1.0], [x, .07, z], 'wood');
    for (let layer = 0; layer < 4; layer++) t.box(treatment, [1.08, .2, .92], [x, .25 + layer * .21, z], layer % 2 ? 'white' : 'salt'); }
  treatment.userData.functionUnconfirmed = true;
  // White chemical tank with a red dosing pump (clip002 1:34).
  const dosing = s._group(services, P(-3.3, 0, -5.2)); dosing.name = 'campus-boiler-observed-white-container-and-tray';
  t.box(dosing, [.8, .09, .8], [0, .05, 0], 'steel');
  t.cylinder(dosing, .32, .85, [0, .52, 0], 'white');
  t.box(dosing, [.24, .16, .14], [.12, 1.03, 0], 'red');
  t.cylinder(dosing, .06, .05, [-.12, 1.0, 0], 'dark');
  dosing.userData.functionUnconfirmed = true;
  // Stored spare motors on red/yellow shelving beside the entrance (clip002 0:24-0:28).
  const rack = s._group(services, P(6.05, 0, 4.55)); rack.name = 'campus-boiler-visible-parts-shelf';
  for (const z of [-1.25, 1.25]) for (const x of [-.48, .48]) t.box(rack, [.055, 2.25, .055], [x, 1.125, z], 'red');
  for (const y of [.2, 1.12, 2.1]) {
    t.box(rack, [1.05, .07, 2.6], [0, y, 0], 'yellow');
    for (const z of [-.82, 0, .82]) { t.cylinder(rack, .14, .38, [0, y + .2, z], 'dark', 'x'); t.motorDetail(rack, [0, y + .2, z], .14, .38, 'dark'); t.box(rack, [.3, .08, .32], [0, y + .055, z], 'steel'); }
  }
  rack.userData.storedComponentsNotEquipment = true;
  const stored = s._group(services); stored.name = 'campus-boiler-stored-cart-crate-and-loose-motors';
  { const [x, , z] = P(4.35, 0, 5.75); t.box(stored, [.75, .55, .5], [x, .55, z], 'tank'); for (const dx of [-.28, .28]) t.cylinder(stored, .09, .06, [x + dx, .1, z], 'black', 'z'); t.ring(stored, .2, .035, [x, .95, z], 'black', 'y'); t.bar(stored, [x - .38, .4, z], [x - .55, 1.1, z], .02, 'black'); }
  { const [x, , z] = P(2.1, 0, -5.05); t.box(stored, [1.15, .95, .95], [x, .48, z], 'wood'); }
  for (const [dx, dz] of [[3.6, -2.0], [4.0, 1.2]]) { const [x, , z] = P(dx, 0, dz); t.cylinder(stored, .18, .45, [x, .2, z], 'dark', 'x'); t.box(stored, [.36, .05, .3], [x, .02, z], 'steel'); }
  stored.userData.storedComponentsNotEquipment = true;
  // Three blue pumps beneath the gas train along the end wall (clip002 3:38-3:52).
  const bluePumps = s._group(services); bluePumps.name = 'campus-boiler-blue-pump-row';
  for (const dz of [1.6, 2.45, 3.3]) {
    const [x, , z] = P(-6.05, 0, dz);
    t.box(bluePumps, [.62, .12, .4], [x, .08, z], 'steel');
    t.cylinder(bluePumps, .17, .22, [x + .22, .36, z], 'blue', 'x');
    t.cylinder(bluePumps, .14, .4, [x - .1, .34, z], 'tank', 'x');
    t.motorDetail(bluePumps, [x - .1, .34, z], .14, .4, 'tank');
  }
  bluePumps.userData.functionUnconfirmed = true;
  return services;
}

// Concrete stair along the inner wall with the vertical multistage pumps
// beneath it (clip002 1:14-1:16, 1:34, 1:38).
function internalStair(s, parent, t, P) {
  const stair = s._group(parent, [0, .14, 0]); stair.name = 'campus-boiler-internal-concrete-stair';
  const [x0, , z] = P(-1.5, 0, -6.28), [x1] = P(-5.75, 0, -6.28), rise = 3.3, count = 13, width = 1.0;
  const tread = (x0 - x1) / count;
  for (let i = 0; i < count; i++) {
    const x = x0 - (i + .5) * tread, y = (i + 1) * rise / count;
    t.box(stair, [tread + .02, .12, width], [x, y - .06, z], 'concrete');
    t.box(stair, [tread + .02, .05, .06], [x, y - .1, z + width / 2 - .03], 'green');
  }
  const slope = t.bar(stair, [x0, .1, z + width / 2 + .02], [x1, rise - .1, z + width / 2 + .02], .1, 'concrete'); slope.name = 'campus-boiler-stair-stringer';
  const [lx] = P(-6.25, 0, 0);
  t.box(stair, [Math.abs(lx - x1) + .4, .16, width + .2], [(lx + x1) / 2 - .1, rise - .08, z], 'concrete');
  for (const [a, b] of [[[x0 + .1, 1.0, z + width / 2 + .05], [x1, rise + 1.0, z + width / 2 + .05]]]) t.bar(stair, a, b, .025, 'steel');
  for (let i = 0; i <= 4; i++) { const k = i / 4, x = x0 + .1 - k * (x0 + .1 - x1), y = k * rise; t.bar(stair, [x, y + .1, z + width / 2 + .05], [x, y + 1.0, z + width / 2 + .05], .02, 'steel'); }
  const pumps = s._group(stair); pumps.name = 'campus-boiler-under-stair-vertical-pumps';
  for (const dx of [-4.2, -4.85]) {
    const [x] = P(dx, 0, 0);
    t.box(pumps, [.42, .1, .42], [x, .05, z], 'steel');
    t.cylinder(pumps, .12, .85, [x, .55, z], 'steel');
    t.cylinder(pumps, .16, .4, [x, 1.17, z], 'dark');
    run(t, pumps, [[x + .28, .3, z], [x + .28, .3, z + .55]], .045, 'blue');
  }
  Object.assign(stair.userData, { source: 'clip002:074s,076s,094s,098s', destinationConfirmed: false });
  return stair;
}

// Grey front wall pieces around the photographed openings. Openings are
// described in design x (along the wall) and survive smaller test rooms.
function wallWithOpenings(t, parent, z, fromX, toX, height, openings, base = .14, thickness = .15) {
  let cursor = fromX;
  const piece = (a, b, y0, y1) => { if (b - a > .02 && y1 - y0 > .02) t.box(parent, [b - a, y1 - y0, thickness], [(a + b) / 2, base + (y0 + y1) / 2, z], 'wall'); };
  for (const o of [...openings].sort((a, b) => a.centre - b.centre)) {
    const a = o.centre - o.width / 2, b = o.centre + o.width / 2;
    piece(cursor, a, 0, height); piece(a, b, 0, o.bottom || 0); piece(a, b, o.top, height); cursor = b;
  }
  piece(cursor, toX, 0, height);
}

function doorPlate(s, door) {
  const sign = s._mesh(new THREE.BoxGeometry(.78, .5, .02), s._material(0xe9ece3, .8, .02), door, [0, 1.62, .07]);
  sign.name = 'campus-boiler-room-observed-door-plate';
  Object.assign(sign.userData, { text: '1팀2파트 보일러실 / 3ton/h 노통연관·1.5ton/h 관류형 각 1대', source: 'clip001:048-050s;clip002:009s' });
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return sign;
  const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 330;
  const ctx = canvas.getContext?.('2d');
  if (!ctx) return sign;
  ctx.fillStyle = '#eef0ea'; ctx.fillRect(0, 0, 512, 330); ctx.fillStyle = '#2f5aa3'; ctx.fillRect(0, 0, 512, 64);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#ffffff'; ctx.font = '700 34px "Malgun Gothic",sans-serif'; ctx.fillText('관계자외 출입금지', 256, 33, 490);
  ctx.fillStyle = '#25392f'; ctx.font = '700 38px "Malgun Gothic",sans-serif'; ctx.fillText('1팀 2파트 보일러실', 256, 120, 490);
  ctx.font = '26px "Malgun Gothic",sans-serif'; ctx.fillText('3ton/h 노통연관', 256, 182, 490); ctx.fillText('1.5ton/h 관류형 각 1대', 256, 222, 490);
  ctx.font = '22px "Malgun Gothic",sans-serif'; ctx.fillText('관리 · 공무환경팀', 256, 285, 490);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; s.textures?.add(texture);
  const paint = new THREE.MeshBasicMaterial({ map: texture }); s.materials.add(paint);
  const letters = s._mesh(new THREE.PlaneGeometry(.76, .49), paint, door, [0, 1.62, .082]); letters.castShadow = false;
  return sign;
}

export function buildCampusBoilerRoom(s, root, item, { materials } = {}) {
  if (item.type !== 'campus-boiler-room') return false;
  const w = item.width || 13.5, d = item.depth || 14, h = item.height || 6.2, t = tools(s, materials);
  const sx = w / 13.5, sz = d / 14, P = (x, y, z) => [x * sx, y, z * sz];
  const shell = s._part(root, item.parts?.[0] || '보일러실 외벽·출입문·기초', [0, 0, 0]); shell.name = 'campus-boiler-room-shell';
  const roof = s._part(root, item.parts?.[1] || '채광 지붕·철골·배기 연도', [0, .5, 0]); roof.name = 'campus-boiler-room-roof';
  const interior = s._part(root, item.parts?.[2] || '촬영된 보일러 2기·펌프·배관', [.2, .15, .15]); interior.name = 'campus-boiler-room-interior';
  t.box(shell, [w + .16, .14, d + .16], [0, .07, 0], 'epoxy');
  const wallH = h - .25;
  for (const [face, size, position] of [
    ['back', [w, wallH, .15], [0, wallH / 2 + .14, -d / 2]],
    ['left', [.15, wallH, d], [-w / 2, wallH / 2 + .14, 0]],
    ['right', [.15, wallH, d], [w / 2, wallH / 2 + .14, 0]],
  ]) {
    const wall = s._group(shell); wall.name = `campus-boiler-room-${face}-wall`; wall.userData.campusInteriorCover = true;
    t.box(wall, size, position, 'wall');
  }
  // Side-road wall, -Z→+Z outside: personnel door, grey shutter, window, gas
  // riser (clip001 0:40-0:52). The shutter opens into this room (clip002 0:20-0:22).
  const front = s._group(shell); front.name = 'campus-boiler-room-front-wall'; front.userData.campusInteriorCover = true;
  const doorX = .45 * sx, shutterX = -2.5 * sx, shutterW = Math.min(3.4, 3.4 * sx), windowX = -5.15 * sx;
  const openings = [
    { id: 'door', centre: doorX, width: 1.12, top: 2.32 },
    { id: 'shutter', centre: shutterX, width: shutterW, top: 4.0 },
    { id: 'window', centre: windowX, width: 1.1, bottom: 1.5, top: 2.55 },
  ];
  wallWithOpenings(t, front, d / 2, -w / 2, w / 2, wallH, openings);
  Object.assign(front.userData, { openingOrder: ['door', 'shutter', 'window'], openingSource: 'clip001:040-052s;clip002:006-022s', overlapsChecked: true });
  const glass = t.box(front, [1.04, 1.0, .04], [windowX, 2.165, d / 2], 'glass'); glass.name = 'campus-boiler-room-side-road-window';
  const shutter = s._group(front, [shutterX, .14, d / 2 - .315]); shutter.name = 'campus-boiler-room-grey-shutter-inside-face';
  const curtain = s._group(shutter); curtain.name = 'campus-boiler-room-moving-shutter-curtain';
  curtain.userData.proximityDoor = { enterable: true, groupId: `${item.id}:boiler-shutter`, label: '보일러실 장비 반입문', accessBasis: 'wallWithOpenings + modelled boiler-room floor/interior', kind: 'lift', axis: 'y', closed: 0, open: 4.04, retract: true, trigger: [0, 0, 0], width: shutterW, height: 3.86, openDistance: 2.2, closeDistance: 3.1 };
  t.box(curtain, [shutterW - .06, 3.86, .04], [0, 1.93, 0], 'steel');
  t.repeats(curtain, [shutterW - .1, .014, .02], Array.from({ length: 21 }, (_, i) => [0, .1 + i * .18, -.03]), 'dark', 'campus-boiler-shutter-slat-lines');
  // All of the roller box stays on the room side of the wall. The curtain
  // follows its guides into that same box instead of gathering in front.
  t.box(shutter, [shutterW + .2, .45, .45], [0, 4.1, 0], 'steel').name='campus-boiler-room-shutter-roller-housing';
  for(const side of [-1,1])t.box(shutter,[.055,3.9,.08],[side*(shutterW/2+.01),1.95,0],'steel').name='campus-boiler-room-shutter-vertical-guide';
  // Single perforated steel door in a mosaic-tile surround (clip002 0:06-0:14).
  const door = s._group(front, [doorX, .14, d / 2 + .1]); door.name = 'campus-boiler-room-perforated-double-door';
  Object.assign(door.userData, { leafCount: 1, legacyNameKept: true, source: 'clip001:048s;clip002:006-014s' });
  for (const x of [-.68, .68]) t.box(door, [.24, 2.6, .05], [x, 1.3, -.04], 'tile');
  t.box(door, [1.12, .28, .05], [0, 2.46, -.04], 'tile');
  const doorPivot = s._group(door, [-.51, 0, 0]); doorPivot.name = 'campus-boiler-room-personnel-door-pivot';
  doorPivot.userData.proximityDoor = { enterable: true, groupId: `${item.id}:boiler-personnel`, label: '보일러실 출입문', accessBasis: 'wallWithOpenings + modelled boiler-room floor/interior', kind: 'hinge', axis: 'y', closed: 0, open: -Math.PI / 2, trigger: [0, 0, 0], width: 1.02, height: 2.2, openDistance: 2.2, closeDistance: 3.1 };
  const panel = s._group(doorPivot, [.51, 0, 0]);
  t.box(panel, [1.02, 2.2, .06], [0, 1.1, 0], 'shell');
  const holes = [];
  for (let row = 0; row < 15; row++) for (let col = 0; col < 8; col++) if ((row * 3 + col) % 4) holes.push([-.4 + col * .115, .25 + row * .118, .036]);
  t.repeats(panel, [.052, .055, .006], holes, 'dark', 'campus-boiler-door-perforation-reference');
  t.cylinder(panel, .045, .07, [.38, 1.05, .07], 'steel', 'z');
  doorPlate(s, panel);
  t.box(front, [1.2, .12, .7], [doorX, .07, d / 2 + .4], 'concrete');
  // Outside face of the side-road window beside the gas riser (clip001 0:34-0:40).
  const outsideWindow = s._group(front, [windowX, 2.025, d / 2 + .1]); outsideWindow.name = 'campus-boiler-room-outside-window';
  t.box(outsideWindow, [1.0, .96, .03], [0, 0, 0], 'dark');
  for (const [size, pos] of [[[1.12, .06, .07], [0, .5, .02]], [[1.12, .06, .07], [0, -.5, .02]], [[.06, 1.06, .07], [-.56, 0, .02]], [[.06, 1.06, .07], [.56, 0, .02]], [[.04, .96, .06], [0, 0, .02]]]) t.box(outsideWindow, size, pos, 'white');
  // Low green skirting and the white corner posts stay when the covers lift.
  for (const x of [-w / 2 + .09, w / 2 - .09]) t.box(shell, [.04, .32, d], [x, .3, 0], 'green');
  t.box(shell, [w, .32, .04], [0, .3, -d / 2 + .09], 'green');
  for (const x of [-w / 2 + .14, w / 2 - .14]) for (const z of [-d / 2 + .14, d / 2 - .14]) t.box(shell, [.13, h - .3, .13], [x, (h - .3) / 2, z], 'white');
  for (const [x, w2] of [[doorX, 1.12], [shutterX, shutterW]]) t.box(shell, [w2, .02, .2], [x, .145, d / 2 - .06], 'steel');
  // Flat roof deck around a hipped glazed skylight (clip002 0:32-0:37, 0:45, 1:20).
  const roofCover = s._group(roof); roofCover.name = 'campus-boiler-room-translucent-roof-cover'; roofCover.userData.campusInteriorCover = true;
  const sky = { x0: -4.5 * sx, x1: 3.6 * sx, z0: -4.4 * sz, z1: 3.4 * sz }, deckY = wallH + .14, ridgeY = Math.min(h + .85, deckY + 1.7);
  for (const [cx, cz, sw, sd] of [
    [0, (-d / 2 + sky.z0) / 2, w + .2, sky.z0 + d / 2 + .1], [0, (sky.z1 + d / 2) / 2, w + .2, d / 2 - sky.z1 + .1],
    [(-w / 2 + sky.x0) / 2, (sky.z0 + sky.z1) / 2, sky.x0 + w / 2 + .1, sky.z1 - sky.z0], [(sky.x1 + w / 2) / 2, (sky.z0 + sky.z1) / 2, w / 2 - sky.x1 + .1, sky.z1 - sky.z0],
  ]) t.box(roofCover, [sw, .16, sd], [cx, deckY + .08, cz], 'white');
  const zc = (sky.z0 + sky.z1) / 2, half = (sky.z1 - sky.z0) / 2, rx0 = Math.min(sky.x0 + half, (sky.x0 + sky.x1) / 2 - .2), rx1 = Math.max(sky.x1 - half, (sky.x0 + sky.x1) / 2 + .2);
  const v = (x, y, z) => [x, y, z], b0 = deckY + .16;
  const A = v(sky.x0, b0, sky.z0), B = v(sky.x1, b0, sky.z0), C = v(sky.x1, b0, sky.z1), D = v(sky.x0, b0, sky.z1), R0 = v(rx0, ridgeY, zc), R1 = v(rx1, ridgeY, zc);
  const hip = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([...A, ...B, ...R1, ...A, ...R1, ...R0, ...D, ...R0, ...R1, ...D, ...R1, ...C, ...A, ...R0, ...D, ...B, ...C, ...R1].flat(), 3));
  hip.computeVertexNormals();
  const glazing = t.mesh(roofCover, hip, [0, 0, 0], 'glass'); glazing.name = 'campus-boiler-hipped-skylight-glazing';
  for (const [a, b] of [[A, R0], [B, R1], [C, R1], [D, R0], [R0, R1], [A, B], [B, C], [C, D], [D, A]]) t.bar(roofCover, a, b, .05, 'white');
  for (let i = 1; i < 5; i++) {
    const k = i / 5, x = sky.x0 + (sky.x1 - sky.x0) * k, rx = rx0 + (rx1 - rx0) * k;
    t.bar(roofCover, [x, b0, sky.z0], [rx, ridgeY, zc], .03, 'white'); t.bar(roofCover, [x, b0, sky.z1], [rx, ridgeY, zc], .03, 'white');
  }
  const braces = s._group(roofCover); braces.name = 'campus-boiler-observed-roof-triangulation';
  for (const z of [sky.z0 + .05, sky.z1 - .05]) for (const side of [-1, 1]) {
    const x = side > 0 ? sky.x1 - .1 : sky.x0 + .1;
    t.bar(braces, [x, deckY - .75, z], [x - side * 1.1, deckY - .05, z], .035, 'white');
    t.box(braces, [.14, .22, .055], [x, deckY - .62, z], 'white');
  }
  const light = s._group(roof, [-.4 * sx, deckY - .4, -.4 * sz]); light.name = 'campus-boiler-observed-suspended-round-light';
  t.bar(light, [0, .35, 0], [0, -.15, 0], .006, 'dark');
  t.cylinder(light, .17, .045, [0, -.15, 0], 'white');
  const main = firetubeBoiler(s, interior, t, P(-2.6, .14, 1.3));
  const compact = onceThroughBoiler(s, interior, t, P(4.55, .14, -4.75), Math.PI / 2);
  yellowBlower(s, interior, t, P(.15, .14, -2.95), Math.PI);
  const services = serviceEquipment(s, interior, t, P, w, d);
  internalStair(s, interior, t, P);
  // Pipes along the end wall and high on the side-road wall (clip002 0:22, 3:02-3:10).
  const pipes = s._group(interior); pipes.name = 'campus-boiler-visible-wall-and-overhead-pipes';
  const endX = -w / 2 + .27, frontZ = d / 2 - .3, backZ = -d / 2 + .3;
  for (const [index, [y, paint, radius]] of [[2.55, 'orange', .05], [3.35, 'yellow', .065], [3.85, 'blue', .075], [4.35, 'steel', .07], [4.75, 'yellow', .06]].entries()) {
    // Keep the full equipment opening and its roller housing clear. The
    // side-wall levels remain; staggered drops occur beyond the left jamb.
    const frontY=4.65+index*.28, dropZ=frontZ-.4-index*.3;
    const pipe=s._group(pipes);pipe.name=`campus-boiler-shutter-clear-overhead-main-${index+1}`;
    Object.assign(pipe.userData,{openingClearanceCorrection:true,routingMeasured:false});
    run(t, pipe, [[3.4 * sx, frontY, frontZ], [endX, frontY, frontZ], [endX, frontY, dropZ], [endX, y, dropZ], [endX, y, backZ + .9]], radius, paint);
  }
  run(t, pipes, [P(-2.13, 3.25, 1.85), P(-2.13, 3.95, 1.85), P(.55, 3.95, 1.85), P(.55, 2.0, 1.85)], .075, 'steel');
  run(t, pipes, [P(.55, 2.6, .3), P(.55, 3.1, .3), P(2.25, 3.1, -1.5)], .05, 'blue');
  // The photographed wall pipe keeps its original riser. Only its long
  // horizontal leg sits against the rear wall, clear of the stair headroom.
  // Elbows are 1.05 times the nominal pipe radius, so include their full
  // envelope as well as the 150mm wall's inside face and a 5mm mounting gap.
  const blueRadius=.06,blueWallZ=-d/2+.15/2+blueRadius*1.05+.005;
  const blueWallPipe=s._group(pipes);blueWallPipe.name='campus-boiler-stair-clear-blue-wall-pipe';
  const bluePoints=[P(1.4,2.5,-6.35),P(1.4,3.85,-6.35),[1.4*sx,3.85,blueWallZ],[endX,3.85,blueWallZ]];
  run(t,blueWallPipe,bluePoints,blueRadius,'blue');
  Object.assign(blueWallPipe.userData,{routingMeasured:false,nominalRadius:blueRadius,wallInsideZ:-d/2+.075,mountingGap:.005,routingPoints:bluePoints,stairHeadroomCorrection:true,originalRiserPreserved:true});
  // Visible silver exhaust routes end at the roof. Hidden paths between
  // processes and the internal tubes/burners are deliberately not fabricated.
  const flues = s._group(roof); flues.name = 'campus-boiler-visible-exhaust-flues';
  const flueTop = h + .45;
  run(t, flues, [P(-2.6, 3.2, -1.75), P(-2.6, deckY - .55, -1.75), P(-2.6, deckY - .55, -5.9), P(-2.6, flueTop, -5.9)], .34, 'steel');
  run(t, flues, [P(4.55, 2.95, -5.3), P(4.55, deckY - .3, -5.3), P(4.55, flueTop, -5.3)], .2, 'steel');
  const damper = s._group(flues, P(4.55, 3.55, -5.3)); damper.name = 'campus-boiler-compact-flue-red-damper';
  t.box(damper, [.55, .62, .55], [0, 0, 0], 'tank'); t.valve(damper, [0, 0, .32], .17, 'red');
  for (const [x, z, r] of [[-2.6, -5.9, .36], [4.55, -5.3, .22]]) t.cylinder(flues, r, .08, P(x, flueTop + .04, z), 'dark');
  // Gas train: riser enters by the window, runs low along the aisle to the
  // burner; meter and strainer on the yellow pipe (clip002 0:22, 3:38-3:52).
  const manifold = s._group(services); manifold.name = 'campus-boiler-yellow-meter-and-valve-reference';
  const gx = windowX - .62, gz = d / 2 - .22;
  run(t, manifold, [[gx, 2.85, gz], [gx, .42, gz], [gx, .42, d / 2 - 1.3], P(-3.35, .42, 0).slice(0, 2).concat([d / 2 - 1.3]), P(-3.35, .95, 4.85)], .075, 'yellow');
  t.box(manifold, [.3, .36, .2], [gx + .05, 1.0, d / 2 - .7], 'white');
  t.box(manifold, [.2, .1, .02], [gx + .05, 1.08, d / 2 - .59], 'dark');
  run(t, manifold, [[gx, .42, d / 2 - .7], [gx, .85, d / 2 - .7]], .05, 'yellow');
  t.cylinder(manifold, .17, .28, [gx, .42, d / 2 - 1.0], 'shell', 'z');
  t.bolts(manifold, [gx, .42, d / 2 - .86], .14, 6);
  t.valve(manifold, [gx + .2, .42, d / 2 - 1.55], .13, 'steel');
  for (const z of [d / 2 - .82, d / 2 - 1.18]) t.flange(manifold, [gx, .42, z], .15, 'z', 'yellow');
  // Floor channel gratings along the aisle and in front of the burner.
  const drains = s._group(interior); drains.name = 'campus-boiler-photographed-floor-channel-gratings';
  for (const [axis, centre, length] of [['x', [P(-2.4, 0, 0)[0], .15, d / 2 - 1.35], 7.2 * sx], ['z', [P(-4.35, 0, 0)[0], .15, P(0, 0, 3.6)[2]], 2.4 * sz]]) {
    const size = axis === 'x' ? [length, .014, .21] : [.21, .014, length];
    t.box(drains, size, centre, 'dark');
    const count = Math.max(20, Math.floor(length / .102));
    const slats = Array.from({ length: count }, (_, i) => axis === 'x' ? [centre[0] - length / 2 + .05 + i * .102, .165, centre[2]] : [centre[0], .165, centre[2] - length / 2 + .05 + i * .102]);
    t.repeats(drains, axis === 'x' ? [.025, .016, .21] : [.21, .016, .025], slats, 'steel', 'campus-boiler-instanced-floor-grating-slats');
  }
  const supports = s._group(services); supports.name = 'campus-boiler-wall-service-clamps-and-junctions';
  for (const z of [d / 2 - 1.2, 1.2 * sz, -2.2 * sz]) {
    t.box(supports, [.1, 2.6, .055], [endX - .13, 3.65, z], 'steel');
    for (const y of [2.55, 3.35, 3.85, 4.35, 4.75]) t.ring(supports, .085, .012, [endX, y, z], 'steel', 'x');
  }
  for (const [z, y] of [[d / 2 - 2.0, 1.75], [d / 2 - 2.7, 1.75], [d / 2 - 3.6, 1.95]]) {
    t.box(supports, [.12, .48, .38], [endX, y, z], 'panel');
    t.box(supports, [.025, .19, .22], [endX + .075, y + .09, z], 'dark');
    t.bar(supports, [endX + .05, y - .25, z], [endX + .05, .3, z], .019, 'black');
  }
  Object.assign(drains.userData, { source: 'clip002:022s,043s', undergroundRouteAdded: false });
  Object.assign(supports.userData, { source: 'clip002:022s,052s,140s,185s', hiddenConnectionsAdded: false });
  Object.assign(root.userData, {
    hasInspectableInterior: true, interiorAdded: true, interiorFocusObject: 'campus-boiler-room-interior',
    observedBoilerCount: 2, boilerIdentities: ['firetube-3t', 'once-through-1.5t'],
    source: 'new-boiler-video-20261111;door-plate-1team2part;layout-review-20261111', nominalDimensionsMeasured: false,
    hiddenMechanismsAdded: false, liveOperatingStateAdded: false, separateFromLiquidCardReference: true,
    openingOrderAlongSideRoad: ['personnel-door', 'grey-shutter', 'window', 'gas-riser'],
    visibleDetailSources: ['clip002:022s', 'clip002:037s', 'clip002:052s', 'clip002:074s', 'clip002:106s', 'clip002:118s', 'clip002:162.5s', 'clip002:202.5s', 'clip002:218s', 'clip002:225s', 'clip002:238s'],
  });
  Object.assign(interior.userData, { source: 'clip002:009s-238s', mainBoiler: main.name, compactBoiler: compact.name });
  return true;
}

// The same filmed room in the preparation floor view. The campus inspection
// keeps its own complete envelope; this view shares its machinery and removes
// that envelope so the neighbouring process room and boiler room stay visible
// together. A uniform fit preserves the shape of every boiler and fitting.
export function buildPreparationBoilerRoom(s, root, item, { materials } = {}) {
  if (item.type !== 'preparation-boiler-room') return false;
  const width = item.width || 8.2, depth = item.depth || 9.8, height = item.height || 6.6;
  const content = s._group(root); content.name = 'preparation-boiler-room-video-layout';
  const partStart = s.parts?.length ?? 0;
  const estimatedScale = Math.min((width - .24) / 11.16, (depth - .24) / 11.16);
  const sourceHeight = Math.max(6.2, height / estimatedScale - .6);
  buildCampusBoilerRoom(s, content, {
    ...item, type: 'campus-boiler-room', width: 11, depth: 11, height: sourceHeight,
  }, { materials });
  for (let i = partStart; i < (s.parts?.length || 0); i++) if (s.parts[i].root === content) s.parts[i].root = root;
  content.traverse(node => {
    if (node.userData.campusInteriorCover) {
      node.visible = false;
      node.userData.preparationEnvelopeOmitted = true;
      delete node.userData.campusInteriorCover;
    }
  });
  const shell = content.getObjectByName('campus-boiler-room-shell');
  const roof = content.getObjectByName('campus-boiler-room-roof');
  const interior = content.getObjectByName('campus-boiler-room-interior');
  if (shell) shell.name = 'preparation-boiler-room-open-base';
  if (roof) roof.name = 'preparation-boiler-room-flues';
  if (interior) interior.name = 'preparation-boiler-room-interior';
  content.rotation.y = Math.PI / 2;
  content.updateMatrixWorld(true);
  const bounds = new THREE.Box3();
  content.traverseVisible(node => { if (node.isMesh || node.isLine) bounds.expandByObject(node); });
  const size = bounds.getSize(new THREE.Vector3());
  const scale = Math.min((width - .24) / size.x, (depth - .24) / size.z, height / size.y);
  // Center only within this catalog item's local frame, including when its
  // parent is already at a floor/world offset.
  const inverseRoot = root.matrixWorld.clone().invert();
  bounds.applyMatrix4(inverseRoot);
  const localSize = bounds.getSize(new THREE.Vector3()), localCenter = bounds.getCenter(new THREE.Vector3());
  const localScale = Math.min((width - .24) / localSize.x, (depth - .24) / localSize.z, height / localSize.y);
  content.scale.setScalar(Number.isFinite(localScale) && localScale > 0 ? localScale : scale);
  content.position.set(-localCenter.x * content.scale.x, -bounds.min.y * content.scale.y, -localCenter.z * content.scale.z);
  // A person's radius stays 0.3m when the same room is uniformly fitted to
  // the smaller 1F registration. Mount this wall leg against that real room
  // wall, rather than the hidden 11m reference envelope. Its riser stays put.
  const blueWallPipe=content.getObjectByName('campus-boiler-stair-clear-blue-wall-pipe');
  if(blueWallPipe){
    const radius=blueWallPipe.userData.nominalRadius,wallInsideX=-width/2+.075;
    const wallLegX=wallInsideX+radius*1.05*content.scale.x+.005;
    placeBlueWallLeg(blueWallPipe,(wallLegX-content.position.x)/content.scale.x);
    Object.assign(blueWallPipe.userData,{registeredWallInsideX:wallInsideX,registeredWallMountingGap:.005,wallRegistrationBasis:'actual 1F room after uniform fit; omitted reference envelope is not a physical wall'});
  }
  content.updateMatrixWorld(true);
  Object.assign(root.userData, {
    ...content.userData,
    physicalRoomId: 'team1-part2-boiler-room', samePhysicalRoomAs: 'campus-boiler-room',
    preparationFloorInterior: true, alwaysOpenInterior: true,
    interiorFocusObject: 'preparation-boiler-room-interior',
    observedBoilerCount: 2, boilerIdentities: ['firetube-3t', 'once-through-1.5t'],
    uniformReferenceScale: content.scale.x,
    roomBounds: { minX: -width / 2, maxX: width / 2, minZ: -depth / 2, maxZ: depth / 2 },
    dimensionBasis: 'video-shaped machinery uniformly fitted to approximate registered 1F room',
  });
  Object.assign(content.userData, { sourceLayoutVariant: 'verified-11m-room-reference', targetRoomWidth: width, targetRoomDepth: depth, sourceHeightEstimated: true });
  return true;
}
