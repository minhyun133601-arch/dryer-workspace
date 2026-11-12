import * as THREE from '../shared/vendor/three.module.js';

// Drawing-local metres: X is plan-right, Z is plan-down, Y=0 is the floor.
// The scene owns transforms, selection and the three real separation groups.
const PI = Math.PI, TAU = PI * 2, UP = new THREE.Vector3(0, 1, 0);

function indoorReflections(s) {
  if (typeof document === 'undefined') return null;
  // One shared, locally generated light probe: SS reflects the photographed
  // yellow window ribbon, green epoxy floor and long white ceiling lights.
  const faces = Array.from({ length: 6 }, (_, face) => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    const c = canvas.getContext('2d'), gradient = c.createLinearGradient(0, 0, 0, 256);
    for (const [at, color] of [[0, '#8c928f'], [.22, '#eceee9'], [.4, '#c3cbc6'], [.47, '#8a918d'], [.55, '#ced2c7'], [.65, '#9ca99e'], [1, '#858f87']]) gradient.addColorStop(at, color);
    c.fillStyle = gradient; c.fillRect(0, 0, 256, 256);
    c.fillStyle = '#ffffff'; c.fillRect(18, 38, 220, 16); c.fillRect(8, 83, 240, 7);
    c.fillStyle = '#6c736e'; c.fillRect(0, 22, 256, 5); c.fillRect(0, 69, 256, 5);
    if (face === 1 || face === 4) {
      c.fillStyle = '#d4cf90'; c.fillRect(0, 119, 256, 27);
      c.fillStyle = '#dddcc6'; for (let x = 0; x < 256; x += 55) c.fillRect(x, 116, 4, 34);
    }
    if (face === 2) { c.fillStyle = '#d9dcd4'; c.fillRect(0, 0, 256, 256); c.fillStyle = '#f8faf5'; c.fillRect(25, 85, 205, 16); }
    if (face === 3) { c.fillStyle = '#8d9b90'; c.fillRect(0, 0, 256, 256); c.fillStyle = '#c3cbc2'; c.fillRect(0, 105, 256, 20); }
    return canvas;
  });
  const texture = new THREE.CubeTexture(faces); texture.colorSpace = THREE.SRGBColorSpace; texture.needsUpdate = true;
  s.textures?.add(texture); return texture;
}

function materials(s) {
  if (s.packagingEquipmentV2Materials) return s.packagingEquipmentV2Materials;
  const make = (c, r = .6, metal = .12, extra = {}) => s._material(c, r, metal, extra);
  const m = {
    ss: make(0x9fa7a4, .32, .9), edge: make(0xbdc5c2, .28, .85), darkSS: make(0x67716d, .36, .85),
    cream: make(0xe3dcc0, .65, .25), frame: make(0x83867e, .5, .45), deck: make(0x939a9c, .5, .6),
    white: make(0xe9e6dc, .83, .02), black: make(0x222c2b, .58), rubber: make(0x303934, .85),
    motor: make(0x4f6b5e, .55, .45), teal: make(0x6e8f8a, .5, .35), blue: make(0x2d5c9e, .58, .35),
    red: make(0xb93229), green: make(0x31825b), yellow: make(0xf2c200), belt: make(0x383530, .6, .45),
    display: make(0x162c30, .25, .1), screen: make(0x7b8491, .3, .05, { emissive: 0x39434f, emissiveIntensity: .18 }),
    pvc: make(0xeaf2f5, .2, .05, { transparent: true, opacity: .3, depthWrite: false, side: THREE.DoubleSide }),
    pvcSeam: make(0xeaf2f5, .25, .05, { transparent: true, opacity: .12, depthWrite: false, side: THREE.DoubleSide }),
    glass: make(0xa8c6be, .18, .1, { transparent: true, opacity: .25, depthWrite: false, side: THREE.DoubleSide }),
  };
  const reflection = indoorReflections(s);
  if (reflection) for (const key of ['ss', 'edge', 'darkSS']) { m[key].envMap = reflection; m[key].envMapIntensity = .68; }
  s.packagingEquipmentV2Materials = m;
  return m;
}

function batch(s, parent, geometry, material, transforms, name) {
  if (!transforms.length) { geometry.dispose(); return null; }
  const mesh = new THREE.InstancedMesh(geometry, material, transforms.length);
  const mat = new THREE.Matrix4(), q = new THREE.Quaternion();
  transforms.forEach((t, i) => {
    if (t.quaternion) q.fromArray(t.quaternion);
    else q.setFromEuler(new THREE.Euler(...(t.rotation || [0, 0, 0])));
    mat.compose(new THREE.Vector3(...t.position), q, new THREE.Vector3(...(t.scale || [1, 1, 1])));
    mesh.setMatrixAt(i, mat);
  });
  mesh.instanceMatrix.needsUpdate = true; mesh.name = name;
  mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  parent.add(mesh); s.geometries?.add(geometry);
  return mesh;
}

const boxes = (s, p, m, rows, name) => batch(s, p, new THREE.BoxGeometry(1, 1, 1), m,
  rows.map(([position, scale, rotation]) => ({ position, scale, rotation })), name);

function rods(s, p, m, rows, name, radius = .025) {
  const q = new THREE.Quaternion();
  return batch(s, p, new THREE.CylinderGeometry(1, 1, 1, 8), m, rows.map(([a, b, r]) => {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start);
    q.setFromUnitVectors(UP, delta.clone().normalize());
    return { position: start.add(end).multiplyScalar(.5).toArray(), quaternion: q.toArray(), scale: [r || radius, delta.length(), r || radius] };
  }), name);
}

function ring(s, p, x, y, z, r, m, name, rotation = [PI / 2, 0, 0], tube = .022) {
  const mesh = s._mesh(new THREE.TorusGeometry(r, tube, 5, 24), m, p, [x, y, z]);
  mesh.rotation.set(...rotation); mesh.name = name; return mesh;
}

function pipe(s, p, m, points, radius = .03, name = 'packaging-service-pipe') {
  const curve = new THREE.CatmullRomCurve3(points.map((v) => new THREE.Vector3(...v)), false, 'centripetal');
  const mesh = s._mesh(new THREE.TubeGeometry(curve, Math.max(10, points.length * 4), radius, 8, false), m, p);
  mesh.name = name; return mesh;
}

function groups(s, root, item) {
  const fallback = ['본체·구동', '투입·처리부', '배출·연결부'];
  return fallback.map((name, i) => {
    const group = s._part(root, item.parts?.[i] || name, [[-1, .3, 0], [0, 1.5, 0], [1, .3, .4]][i]);
    group.name = `${item.id}-v2-part-${i + 1}`; return group;
  });
}

function frustum(wTop, dTop, wBottom, dBottom, h) {
  const points = [
    [-wBottom / 2, 0, -dBottom / 2], [wBottom / 2, 0, -dBottom / 2], [wBottom / 2, 0, dBottom / 2], [-wBottom / 2, 0, dBottom / 2],
    [-wTop / 2, h, -dTop / 2], [wTop / 2, h, -dTop / 2], [wTop / 2, h, dTop / 2], [-wTop / 2, h, dTop / 2],
  ], positions = [];
  for (const f of [[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]]) {
    for (const i of [f[0], f[1], f[2], f[0], f[2], f[3]]) positions.push(...points[i]);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.computeVertexNormals(); return g;
}

function perimeter(s, p, m, w, d, y, name, z = 0) {
  rods(s, p, m, [[[-w / 2, y, z - d / 2], [w / 2, y, z - d / 2]], [[w / 2, y, z - d / 2], [w / 2, y, z + d / 2]],
    [[w / 2, y, z + d / 2], [-w / 2, y, z + d / 2]], [[-w / 2, y, z + d / 2], [-w / 2, y, z - d / 2]]], name);
}

function handle(s, p, m, x, y, z, name = 'packaging-ss-pull-handle') {
  rods(s, p, m, [[[x - .1, y, z], [x - .1, y, z + .06]], [[x + .1, y, z], [x + .1, y, z + .06]],
    [[x - .1, y, z + .06], [x + .1, y, z + .06]]], name, .016);
}

function motor(s, p, m, x, y, z, color, length = .62, radius = .24) {
  const shell = s._cyl(p, radius, length, [x, y, z], color, radius, 20); shell.rotation.x = PI / 2; shell.name = 'packaging-horizontal-finned-motor';
  const fan = s._cyl(p, radius * 1.04, .065, [x, y, z + length / 2 + .025], m.darkSS, radius * 1.04, 20); fan.rotation.x = PI / 2;
  const fins = [], grille = [];
  for (let i = 0; i < 10; i++) {
    const a = i * TAU / 10;
    fins.push([[x + Math.cos(a) * radius, y + Math.sin(a) * radius, z], [.035, .07, length * .78], [0, 0, a - PI / 2]]);
  }
  for (let i = -3; i <= 3; i++) grille.push([[x + i * radius * .21, y, z + length / 2 + .067], [.015, radius * 1.65, .014]]);
  boxes(s, p, color, fins, 'packaging-motor-radial-cooling-fins'); boxes(s, p, m.edge, grille, 'packaging-motor-fan-grille');
  s._box(p, [.25, .16, .23], [x, y + radius + .065, z - .03], color);
  boxes(s, p, m.frame, [-1, 1].map((side) => [[x + side * radius * .75, y - radius, z], [.09, .12, length * .7]]), 'packaging-motor-mounting-feet');
}

function inspection(s, p, m, w, d, low, high, z = 0) {
  const angle = Math.atan((d - .32) / (2 * (high - low)));
  const panel = s._group(p, [0, (low + high) / 2, z + (d + .32) / 4 + .018]); panel.rotation.x = angle;
  s._box(panel, [w * .62, (high - low) * .64, .04], [0, 0, 0], m.edge).name = 'packaging-hopper-inclined-bolted-inspection-door';
  s._box(panel, [w * .54, (high - low) * .57, .025], [0, 0, .035], m.ss);
  const bolts = [], clamps = [];
  for (const x of [-w * .26, w * .26]) for (const y of [-.27, 0, .27]) {
    bolts.push({ position: [x, y * (high - low), .06], rotation: [PI / 2, 0, 0] });
    clamps.push([[x, y * (high - low), .08], [.04, .075, .03]]);
  }
  batch(s, panel, new THREE.CylinderGeometry(.022, .022, .03, 6), m.darkSS, bolts, 'packaging-hopper-door-bolts');
  boxes(s, panel, m.edge, clamps, 'packaging-hopper-door-toggle-clamps'); handle(s, panel, m.edge, 0, .05, .07);
}

function discharge(s, p, m, deck, w = 1.15, d = 1.05, z = 0, floorPan = true, round = false) {
  const high = deck - .08, low = .98;
  if (round) s._cyl(p, Math.min(w, d) / 2, high - low, [0, (high + low) / 2, z], m.ss, .15, 24).name = 'packaging-conical-underdeck-hopper';
  else {
    s._mesh(frustum(w, d, .3, .32, high - low), m.ss, p, [0, low, z]).name = 'packaging-underdeck-inverted-square-hopper';
    inspection(s, p, m, w, d, low, high, z);
  }
  s._cyl(p, .19, .12, [0, .92, z], m.edge, .19, 24).name = 'packaging-underdeck-butterfly-valve';
  const actuator = s._cyl(p, .11, .22, [.25, .93, z], m.blue, .11, 16); actuator.rotation.z = PI / 2;
  s._cyl(p, .125, .61, [0, .55, z], m.white, .125, 20).name = 'packaging-white-canvas-discharge-sleeve';
  for (const y of [.25, .82]) ring(s, p, 0, y, z, .14, m.edge, 'packaging-sleeve-hose-clamp', undefined, .018);
  pipe(s, p, m.black, [[.33, .93, z], [.4, .77, z + .1], [.3, .53, z + .12]], .018, 'packaging-valve-black-hose');
  if (floorPan) {
    boxes(s, p, m.ss, [[[0, .045, z], [.7, .05, .7]], [[-.335, .105, z], [.03, .12, .7]], [[.335, .105, z], [.03, .12, .7]],
      [[0, .105, z - .335], [.7, .12, .03]], [[0, .105, z + .335], [.7, .12, .03]]], 'packaging-low-square-floor-penetration-pan');
  } else s._cyl(p, .18, .07, [0, .1, z], m.edge, .18, 24).name = 'packaging-round-floor-penetration-flange';
}

function hood(s, p, m, item, top) {
  const deck = item.platformHeight ?? 2.55, z = -.35, w = item.hoodWidth || 1.8, d = item.hoodDepth || 1.5;
  const lower = Math.max(top + .72, deck + 2.35), upper = lower + .56, curtainBottom = deck + 1.15;
  const worldZ = Math.abs((item.position?.[2] || 0) + z);
  const roofLimit = item.ceilingLimit || 6 + 1.36 * Math.max(0, Math.min(worldZ, 15.2 - worldZ)) / 7.6;
  if (item.hoodVariant === 'booth') {
    perimeter(s, p, m.edge, w, d, lower, 'packaging-film-booth-top-frame', z);
    rods(s, p, m.edge, [-1, 1].flatMap((x) => [-1, 1].map((side) => [[x * w / 2, curtainBottom, z + side * d / 2], [x * w / 2, lower, z + side * d / 2]])), 'packaging-film-booth-corner-frame', .018);
    s._box(p, [w, .045, d], [0, lower, z], m.ss).name = 'packaging-film-booth-ss-roof';
  } else {
    s._mesh(frustum(.36, .36, w, d, .46), m.ss, p, [0, lower + .13, z]).name = 'packaging-hung-truncated-pyramid-extraction-canopy';
    boxes(s, p, m.ss, [[[0, lower + .065, z - d / 2], [w, .13, .035]], [[0, lower + .065, z + d / 2], [w, .13, .035]],
      [[-w / 2, lower + .065, z], [.035, .13, d]], [[w / 2, lower + .065, z], [.035, .13, d]]], 'packaging-canopy-shallow-ss-skirt');
  }
  const curtain = boxes(s, p, m.pvc, [[[0, (curtainBottom + lower) / 2, z - d / 2], [w, lower - curtainBottom, .006]],
    [[0, (curtainBottom + lower) / 2, z + d / 2], [w, lower - curtainBottom, .006]],
    [[-w / 2, (curtainBottom + lower) / 2, z], [.006, lower - curtainBottom, d]], [[w / 2, (curtainBottom + lower) / 2, z], [.006, lower - curtainBottom, d]]], 'packaging-transparent-pvc-curtains');
  if (curtain) { curtain.raycast = () => {}; curtain.castShadow = false; curtain.renderOrder = 2; }
  const folds = [];
  for (let x = -w / 2 + .16; x < w / 2; x += .2) folds.push([[x, (curtainBottom + lower) / 2, z + d / 2 + .008], [.018, lower - curtainBottom, .004]]);
  const seams = boxes(s, p, m.pvcSeam, folds, 'packaging-pvc-curtain-vertical-folds');
  if (seams) { seams.raycast = () => {}; seams.castShadow = false; }
  const suspendFrom=item.hoodVariant==='booth'?lower:lower+.13;
  const wires=[-1,1].flatMap(x=>[-1,1].map(side=>{
    const localZ=z+side*d*.4,beamWorldZ=Math.round((item.position?.[2]||0)+localZ),a=Math.abs(beamWorldZ);
    const beamY=6+1.36*Math.max(0,Math.min(a,15.2-a))/7.6-.08;
    return [[x*w*.43,suspendFrom,localZ],[x*w*.43,beamY,beamWorldZ-(item.position?.[2]||0)]];
  }));
  rods(s,p,m.edge,wires,'packaging-canopy-roof-suspension-wires',.009);
  const ductBottom = item.hoodVariant === 'booth' ? lower : lower + .59, ductTop = Math.max(ductBottom + .05, Math.min(item.hoodDuctTop??6.15, roofLimit - .4, ductBottom + (item.hoodRiserHeight??.55)));
  s._cyl(p, .145, Math.max(.1, ductTop - ductBottom), [0, (ductBottom + ductTop) / 2, z], m.edge, .145, 24).name = 'packaging-canopy-upright-extraction-duct';
  const branchSide = item.type === 'packaging-stick-mixer' || item.type === 'packaging-aux-mixer' ? 1 : -1;
  const elbow = s._mesh(new THREE.TorusGeometry(.22, .145, 8, 16, PI / 2), m.edge, p, [branchSide * .22, ductTop - .08, z]);
  elbow.rotation.z = branchSide === 1 ? PI / 2 : 0; elbow.name = 'packaging-canopy-smooth-closed-90-degree-extraction-elbow';
  const branch = s._cyl(p, .145, .3, [branchSide * .37, ductTop + .14, z], m.edge, .145, 24);
  branch.rotation.z = PI / 2; branch.name = 'packaging-canopy-closed-short-ss-extraction-branch';
  p.userData.extractionPort = [branchSide * .52, ductTop + .14, z];
  for (let y = ductBottom + .1; y < ductTop; y += .19) ring(s, p, 0, y, z, .149, m.ss, 'packaging-extraction-duct-seam', undefined, .008);
}

function mixer(s, root, item, ribbon = false, stick = false) {
  const m = materials(s), [body, process, output] = groups(s, root, item), deck = item.platformHeight ?? 2.55;
  const cardNumber = item.cardNumber || Number(item.id?.match(/^packaging-main-mixer-([123])$/)?.[1]);
  const cardMain = !!cardNumber && !stick && !ribbon;
  const w = ribbon ? 1.2 : stick ? 1.45 : 1.48, length = ribbon ? 2 : stick ? 2.15 : 2.65;
  const h = ribbon ? 1.08 : 1.3, bottom = deck + .16, top = bottom + h;
  const shape = new THREE.Shape(), r = cardMain ? .59 : w * .22;
  shape.moveTo(-w / 2, h); shape.lineTo(w / 2, h); shape.lineTo(w / 2, r);
  shape.quadraticCurveTo(w / 2, 0, w / 2 - r, 0); shape.lineTo(-w / 2 + r, 0);
  shape.quadraticCurveTo(-w / 2, 0, -w / 2, r); shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false, curveSegments: 8 }); g.translate(0, 0, -length / 2);
  s._mesh(g, m.ss, body, [0, bottom, 0]).name = ribbon ? 'packaging-single-shaft-ribbon-u-trough' : 'packaging-low-rectangular-rounded-bottom-mixer-body';
  s._box(body, [w + .04, .045, length + .05], [0, top + .025, 0], m.edge).name = 'packaging-flat-ss-mixer-top';
  boxes(s, body, m.darkSS, [-1, 1].flatMap((x) => [-1, 1].map((z) => [[x * w * .37, deck + .09, z * length * .35], [.12, .18, .2]])), 'packaging-mixer-low-machine-feet');
  const door = s._group(body, [w / 2 + .023, bottom + h * .58, 0]); door.rotation.y = PI / 2;
  s._box(door, [length * .76, h * .6, .035], [0, 0, 0], m.edge).name = 'packaging-mixer-large-hinged-side-inspection-door';
  s._box(door, [length * .72, h * .54, .025], [0, 0, .029], m.ss); handle(s, door, m.edge, 0, .02, .05);
  const clamps = [];
  for (const x of [-length * .31, 0, length * .31]) for (const y of [-h * .29, h * .29]) clamps.push([[x, y, .06], [.055, .11, .04]]);
  boxes(s, door, m.edge, clamps, 'packaging-mixer-side-door-overcentre-clamps');
  const count = ribbon ? 1 : 2;
  for (let i = 0; i < count; i++) {
    const x = count === 1 ? 0 : (i ? 1 : -1) * .31;
    const end = cardMain ? -1 : 1;
    const bearing = s._cyl(body, .15, .08, [x, bottom + h * .58, end * (length / 2 + .05)], m.edge, .15, 16); bearing.rotation.x = PI / 2;
    const shaft = s._cyl(body, .06, .16, [x, bottom + h * .58, end * (length / 2 + .14)], m.darkSS, .06, 16); shaft.rotation.x = PI / 2;
  }
  const bearingBolts = [];
  for (let i = 0; i < count; i++) for (let n = 0; n < 4; n++) {
    const x = count === 1 ? 0 : (i ? 1 : -1) * .31, a = PI / 4 + n * PI / 2;
    bearingBolts.push({ position: [x + Math.cos(a) * .13, bottom + h * .58 + Math.sin(a) * .13, (cardMain ? -1 : 1) * (length / 2 + .1)], rotation: [PI / 2, 0, 0] });
  }
  batch(s, body, new THREE.CylinderGeometry(.024, .024, .025, 6), m.darkSS, bearingBolts, 'packaging-twin-shaft-flange-bearing-four-bolt-heads');
  if (cardMain) {
    // The four-view cards show BOTH drives on each mixer, rather than three
    // different generic motor variants: a low large motor and two upper fans.
    const endZ = length / 2 + .23;
    s._mesh(frustum(.86, .085, 1.68, .085, 1.08), m.belt, body, [0, deck + .25, endZ]).name = 'packaging-card-dark-trapezoidal-twin-drive-belt-guard';
    rods(s, body, m.edge, [[[-.84, deck + .25, endZ + .05], [-.43, deck + 1.33, endZ + .05]],
      [[-.43, deck + 1.33, endZ + .05], [.43, deck + 1.33, endZ + .05]],
      [[.43, deck + 1.33, endZ + .05], [.84, deck + .25, endZ + .05]],
      [[-.84, deck + .25, endZ + .05], [.84, deck + .25, endZ + .05]]], 'packaging-card-belt-guard-ss-perimeter-frame', .021);
    s._box(body, [.18, .22, .012], [.32, deck + 1.03, endZ + .055], m.white);
    s._box(body, [.13, .13, .013], [.32, deck + 1.07, endZ + .063], m.yellow).name = 'packaging-card-twin-belt-pinch-warning';
    for (const x of [-.32, .32]) motor(s, body, m, x, deck + 1.57, endZ, m.motor, .47, .19);
    s._box(body, [.98, .035, .52], [0, deck + 1.82, endZ], m.ss).name = 'packaging-card-upper-twin-motor-folded-ss-canopy';
    motor(s, body, m, .60, deck + .36, length / 2 + .26, m.motor, .62, .28);
    s._mesh(frustum(.2, .18, .31, .67, 1.22), m.ss, body, [.65, deck + .25, length / 2 + .08]).name = 'packaging-card-low-motor-long-inclined-ss-belt-cover';
    const serviceZ = -length / 2 - .16;
    boxes(s, output, m.frame, [-1, 1].map((side) => [[side * .35, deck + .43, serviceZ], [.28, .28, .27]]), 'packaging-card-paired-bottom-gate-gearreducers');
    rods(s, output, m.edge, [[[-.35, deck + .22, serviceZ - .12], [.35, deck + .22, serviceZ - .12]],
      [[-.35, deck + .42, serviceZ - .12], [.35, deck + .42, serviceZ - .12]]], 'packaging-card-two-transverse-pneumatic-gate-cylinders', .06);
    s._box(output, [.4, .45, .1], [.45, deck + 1.04, serviceZ], m.edge).name = 'packaging-card-solenoid-service-box';
    s._box(output, [.35, .4, .014], [.45, deck + 1.04, serviceZ - .063], m.glass);
    pipe(s, output, m.teal, [[.25, deck + 1.1, serviceZ], [-.3, deck + 1.25, serviceZ], [-.48, deck + .6, serviceZ], [.3, deck + .48, serviceZ]], .018, 'packaging-card-mixer-end-plate-teal-air-hose');
  } else if (stick || item.variant === 'twin') {
    for (const x of [-.37, .37]) {
      motor(s, body, m, x, deck + .5, length / 2 + .43, stick ? m.blue : m.motor, .58, .25);
      s._box(body, [.58, .035, .56], [x, deck + .83, length / 2 + .5], m.ss).name = 'packaging-twin-blue-motor-ss-protective-rain-cover';
      s._box(body, [.32, .3, .23], [x, deck + .5, length / 2 + .035], m.frame).name = 'packaging-mixer-end-drive-gearreducer';
    }
  } else {
    motor(s, body, m, -.15, deck + .37, length / 2 + .49, item.variant === 'dark-belt' ? m.teal : m.motor, .63, .25);
    const cover = s._mesh(frustum(.45, .22, .64, .76, .98), item.variant === 'dark-belt' ? m.belt : m.ss, body, [.1, deck + .27, length / 2 + .3]);
    cover.name = 'packaging-sloped-trapezoid-drive-belt-cover';
    s._box(body, [.17, .17, .012], [.1, deck + .95, length / 2 + .69], m.yellow).name = 'packaging-drive-pinch-warning-sign';
    s._box(body, [.1, .025, .018], [.1, deck + .95, length / 2 + .7], m.black).rotation.z = -.6;
  }
  const hatchZ = length * .23;
  s._cyl(process, .27, .055, [0, top + .07, hatchZ], m.edge, .27, 24).name = 'packaging-flat-top-circular-inspection-manhole';
  s._cyl(process, .2, .012, [0, top + .105, hatchZ], m.glass, .2, 24);
  ring(s, process, 0, top + .11, hatchZ, .255, m.darkSS, 'packaging-manhole-clamping-ring', undefined, .013);
  const inputZ = -.38;
  if (cardMain) {
    const openingLength = length * .82, lidWidth = .85;
    s._box(process, [lidWidth, .025, openingLength], [.03, top + .05, 0], m.darkSS).name = 'packaging-card-wide-rectangular-charge-opening';
    const lid = s._group(process, [-.43, top + .075, 0]); lid.rotation.z = 1.13;
    s._box(lid, [lidWidth, .035, openingLength], [lidWidth / 2, 0, 0], m.ss).name = 'packaging-card-open-long-hinged-charge-lid';
    boxes(s, lid, m.edge, [[[lidWidth, .01, 0], [.035, .05, openingLength]], [[lidWidth / 2, .01, -openingLength / 2], [lidWidth, .05, .035]],
      [[lidWidth / 2, .01, openingLength / 2], [lidWidth, .05, .035]]], 'packaging-card-open-charge-lid-edge-folds');
    boxes(s, process, m.edge, [-.75, 0, .75].map((z) => [[-.43, top + .08, z], [.08, .07, .15]]), 'packaging-card-wide-charge-lid-hinges');
  } else {
  s._box(process, [1, .48, .78], [0, top + .27, inputZ], m.ss).name = 'packaging-ss-rectangular-charge-box';
  s._box(process, [1.04, .045, .82], [0, top + .53, inputZ], m.edge);
  handle(s, process, m.edge, 0, top + .53, inputZ + .25);
  boxes(s, process, m.red, [-.36, .36].map((x) => [[x, top + .45, inputZ + .42], [.04, .12, .035]]), 'packaging-charge-box-red-toggle-clamps');
  boxes(s, process, m.darkSS, Array.from({ length: 5 }, (_, i) => [[.18, top + .16 + i * .045, inputZ + .397], [.3, .012, .009]]), 'packaging-charge-box-front-vent-louvre-slots');
  boxes(s, process, m.edge, [-.32, .32].map((x) => [[x, top + .54, inputZ - .4], [.16, .045, .055]]), 'packaging-charge-box-rear-lid-hinges');
  }
  s._cyl(process, .095, .26, [-.48, top + .18, hatchZ], m.white, .095, 16).name = 'packaging-short-white-cloth-vent-filter';
  hood(s, process, m, item, top + .53);
  discharge(s, output, m, deck, ribbon ? .95 : 1.2, ribbon ? .85 : 1.05);
  rods(s, output, m.edge, [[[.64, deck + .3, .6], [.64, deck + .3, -.6]]], 'packaging-bottom-gate-pneumatic-cylinder', .045);
  pipe(s, output, m.teal, [[.65, deck + .3, -.6], [.76, deck + .5, -.5], [.78, deck + 1, -.55]], .018, 'packaging-mixer-teal-pneumatic-hose');
}

function sieve(s, root, item) {
  const cardNumber = item.cardNumber || Number(item.id?.match(/^packaging-mixer-sieve-([123])$/)?.[1]);
  if (cardNumber) {
    const assembly = groups(s, root, item).map((p) => {
      const g = s._group(p); g.rotation.y = PI / 2; return g;
    });
    cardSieveAssembly(s, ...assembly, item.platformHeight ?? 2.55, cardNumber);
    return;
  }
  const m = materials(s), [body, process, detail] = groups(s, root, item), deck = item.platformHeight ?? 2.55;
  const r = Math.min(item.width || 1.2, item.depth || 1.2, 1.4) * .36;
  s._cyl(body, r * .78, .42, [0, deck + .24, 0], m.frame, r * .78, 24).name = 'packaging-sieve-grey-vibrator-motor-base';
  const rings = [], springs = [];
  for (let i = 0; i < 3; i++) {
    s._cyl(process, r, .19, [0, deck + .66 + i * .2, 0], m.ss, r, 32);
    rings.push({ position: [0, deck + .57 + i * .2, 0], rotation: [PI / 2, 0, 0] });
  }
  batch(s, detail, new THREE.TorusGeometry(r + .015, .025, 5, 32), m.edge, rings, 'packaging-sieve-three-stainless-clamping-rings');
  for (let i = 0; i < 6; i++) {
    const a = i * TAU / 6;
    for (let j = 0; j < 4; j++) springs.push({ position: [Math.cos(a) * r * .73, deck + .43 + j * .035, Math.sin(a) * r * .73], rotation: [PI / 2, 0, 0] });
  }
  batch(s, detail, new THREE.TorusGeometry(.043, .009, 4, 10), m.darkSS, springs, 'packaging-sieve-vibration-support-springs');
  boxes(s, detail, m.teal, Array.from({ length: 8 }, (_, i) => {
    const a = i * TAU / 8; return [[Math.cos(a) * (r + .025), deck + .95, Math.sin(a) * (r + .025)], [.055, .16, .055], [0, -a, 0]];
  }), 'packaging-sieve-teal-toggle-handles');
  const cover = s._cyl(process, .06, .26, [0, deck + 1.28, 0], m.pvc, r, 24); cover.name = 'packaging-sieve-transparent-plastic-cover'; cover.raycast = () => {}; cover.castShadow = false;
  s._box(process, [.25, .14, .25], [0, deck + .83, r + .1], m.ss);
  const bagX = r + .22;
  rods(s, detail, m.edge, [[[bagX, deck + .15, -.2], [bagX, deck + .95, -.2]], [[bagX, deck + .15, .2], [bagX, deck + .95, .2]],
    [[bagX, deck + .95, -.2], [bagX + .35, deck + .95, -.2]], [[bagX + .35, deck + .95, -.2], [bagX + .35, deck + .95, .2]],
    [[bagX + .35, deck + .95, .2], [bagX, deck + .95, .2]]], 'packaging-sieve-wire-bag-holder', .015);
  s._box(detail, [.32, .53, .35], [bagX + .17, deck + .61, 0], m.blue).name = 'packaging-sieve-blue-collection-bag';
}

function cardSieveAssembly(s, base, process, detail, deck, cardNumber) {
  const m = materials(s), r = .51;
  s._cyl(base, .29, .4, [0, deck + .24, 0], m.frame, .32, 28).name = 'packaging-card-sieve-dark-round-vibrator-pedestal';
  s._cyl(base, .35, .055, [0, deck + .045, 0], m.edge, .35, 28);
  const sections = [], seams = [], springs = [], clamps = [];
  for (let i = 0; i < 2; i++) sections.push({ position: [0, deck + .715 + i * .28, 0] });
  for (let i = 0; i < 3; i++) seams.push({ position: [0, deck + .57 + i * .28, 0], rotation: [PI / 2, 0, 0] });
  batch(s, process, new THREE.CylinderGeometry(r, r, .27, 32), m.ss, sections, 'packaging-card-sieve-two-round-stainless-screen-sections');
  batch(s, detail, new THREE.TorusGeometry(r + .012, .023, 5, 32), m.edge, seams, 'packaging-card-sieve-three-wide-clamping-rings');
  for (let i = 0; i < 6; i++) {
    const a = i * TAU / 6;
    for (let j = 0; j < 5; j++) springs.push({ position: [Math.cos(a) * .29, deck + .43 + j * .028, Math.sin(a) * .29], rotation: [PI / 2, 0, 0] });
    clamps.push([[Math.cos(a) * (r + .025), deck + .86, Math.sin(a) * (r + .025)], [.035, .47, .035], [0, -a, 0]]);
  }
  batch(s, detail, new THREE.TorusGeometry(.037, .008, 4, 10), m.darkSS, springs, 'packaging-card-sieve-six-exposed-coil-springs');
  boxes(s, detail, m.edge, clamps, 'packaging-card-sieve-long-vertical-toggle-clamping-rods');
  boxes(s, detail, m.teal, clamps.map(([p, , rot]) => [[p[0], deck + .66, p[2]], [.055, .13, .06], rot]), 'packaging-card-sieve-low-teal-clamp-handles');
  s._cyl(process, .27, .045, [0, deck + 1.175, 0], m.ss, r + .03, 32).name = 'packaging-card-sieve-nearly-flat-shallow-ss-top-lid';
  ring(s, detail, 0, deck + 1.21, 0, .27, m.edge, 'packaging-card-sieve-large-circular-top-feed-opening', undefined, .018);
  for (const side of [-1, 1]) {
    const x = side * (r + .23), y = deck + (side === 1 ? .9 : .71);
    s._box(process, [.56, .105, .19], [x, y, 0], m.ss).name = 'packaging-card-sieve-long-flat-side-discharge-arm';
    const port = s._cyl(detail, .075, .035, [side * (r + .5), y + .015, 0], m.edge, .075, 16); port.rotation.z = PI / 2;
  }
  if (cardNumber === 1 || cardNumber === 2) {
    const cap = s._cyl(detail, .29, .13, [0, deck + 1.27, 0], m.pvc, .56, 28); cap.raycast = () => {}; cap.castShadow = false;
    const wrap = s._cyl(detail, .56, .73, [0, deck + .88, 0], m.pvc, .58, 28); wrap.name = 'packaging-card-sieve-loose-transparent-sheet-over-whole-body'; wrap.raycast = () => {}; wrap.castShadow = false;
  } else if (cardNumber === 3) {
    s._cyl(detail, .25, .045, [0, deck + 1.245, 0], m.ss, .23, 24).name = 'packaging-card-sieve-top-shallow-stainless-bowl';
    rods(s, detail, m.edge, [[[r + .45, deck + .22, -.19], [r + .45, deck + .95, -.19]], [[r + .45, deck + .22, .19], [r + .45, deck + .95, .19]],
      [[r + .45, deck + .95, -.19], [r + .75, deck + .95, -.19]], [[r + .75, deck + .95, -.19], [r + .75, deck + .95, .19]]], 'packaging-card-sieve-blue-bag-open-wire-holder', .015);
    s._box(detail, [.29, .51, .36], [r + .6, deck + .58, 0], m.blue).name = 'packaging-card-sieve-three-blue-discharge-bag';
  }
}

function verticalCardMotor(s, p, m, x, baseY, z) {
  s._cyl(p, .145, .2, [x, baseY + .1, z], m.frame, .17, 20).name = 'packaging-card-hopper-upright-gearreducer';
  s._cyl(p, .145, .42, [x, baseY + .4, z], m.motor, .145, 24).name = 'packaging-card-hopper-vertical-finned-motor';
  const fins = [];
  for (let i = 0; i < 12; i++) {
    const a = i * TAU / 12; fins.push([[x + Math.cos(a) * .15, baseY + .4, z + Math.sin(a) * .15], [.026, .34, .055], [0, -a, 0]]);
  }
  boxes(s, p, m.frame, fins, 'packaging-card-hopper-vertical-motor-cooling-fins');
  s._cyl(p, .16, .07, [x, baseY + .645, z], m.darkSS, .16, 24);
  s._box(p, [.15, .14, .12], [x + .18, baseY + .37, z], m.motor);
}

function cardDrum(s, shell, process, detail, item, number) {
  const m = materials(s), deck = item.platformHeight ?? 2.55, r = number === 3 ? .65 : .61;
  const h = number === 3 ? .72 : number === 2 ? 1.04 : .96, low = deck + .13, top = low + h;
  s._cyl(shell, r, h, [0, low + h / 2, 0], m.ss, r, 40).name = 'packaging-card-hopper-low-vertical-stainless-drum';
  s._cyl(shell, r + .025, .045, [0, top + .025, 0], m.edge, r + .025, 40).name = 'packaging-card-hopper-wide-flat-circular-lid';
  ring(s, detail, 0, low + .035, 0, r + .005, m.darkSS, 'packaging-card-hopper-low-dark-foot-ring', undefined, .025);
  const feet = [], gussets = [];
  for (let i = 0; i < 3; i++) {
    const a = i * TAU / 3 + PI / 2, x = Math.cos(a) * (r + .04), z = Math.sin(a) * (r + .04);
    feet.push([[x, deck + .0125, z], [.18, .025, .26], [0, PI / 2 - a, 0]]);
    for (const side of [-1, 1]) gussets.push({
      position: [Math.cos(a) * (r - .03) - Math.sin(a) * side * .055, deck + .025, Math.sin(a) * (r - .03) + Math.cos(a) * side * .055],
      rotation: [0, -a, 0]
    });
  }
  boxes(s, shell, m.ss, feet, 'packaging-card-hopper-three-thin-radial-stainless-skid-plates');
  const footShape = new THREE.Shape(); footShape.moveTo(-.09, 0); footShape.lineTo(.19, 0); footShape.lineTo(-.09, .28); footShape.closePath();
  const footGeometry = new THREE.ExtrudeGeometry(footShape, { depth: .016, bevelEnabled: false }); footGeometry.translate(0, 0, -.008);
  batch(s, shell, footGeometry, m.ss, gussets, 'packaging-card-hopper-radial-triangular-sheet-gussets');
  s._box(detail, [.48, .37, .04], [0, low + h * .43, r + .025], m.edge).name = 'packaging-card-hopper-lower-front-rectangular-inspection-door';
  s._box(detail, [.43, .32, .025], [0, low + h * .43, r + .053], m.ss);
  handle(s, detail, m.edge, 0, low + h * .43, r + .075);
  boxes(s, detail, m.edge, [-.19, .19].flatMap((x) => [-.14, .14].map((y) => [[x, low + h * .43 + y, r + .075], [.04, .075, .025]])), 'packaging-card-hopper-access-door-hinges-and-clamps');
  s._box(detail, [r * 1.78, .045, .045], [0, top + .075, -.05], m.edge).name = 'packaging-card-hopper-half-round-lid-diameter-hinge';
  boxes(s, detail, m.red, [-.4, .4].map((x) => [[x, top - .015, r * .73], [.035, .12, .035]]), 'packaging-card-hopper-lid-red-toggle-handles');
  verticalCardMotor(s, process, m, .05, top + .08, -.05);
  const tubes = [], joints = [];
  for (const x of [-.34, .34]) {
    s._cyl(process, .105, 1.3, [x, top + .72, -.29], m.glass, .105, 20).name = 'packaging-card-hopper-translucent-upright-feed-sleeve';
    for (const y of [top + .08, top + 1.33]) joints.push({ position: [x, y, -.29] });
    tubes.push([[x, top + 1.34, -.29], [x, Math.min(6.1, top + 1.7), -.29]]);
  }
  batch(s, process, new THREE.CylinderGeometry(.135, .135, .055, 20), m.edge, joints, 'packaging-card-hopper-feed-sleeve-clamping-flanges');
  rods(s, process, m.edge, tubes, 'packaging-card-hopper-upper-silver-feed-connections', .105);
  s._cyl(process, .055, .24, [.37, top + .2, .27], m.white, .055, 16).name = 'packaging-card-hopper-short-white-lid-filter';
  s._cyl(process, .06, .06, [-.31, top + .09, .27], m.blue, .06, 16);
  const hosePoints = [[-.32, top + .18, -.19], [-.72, top + .03, -.13], [-.79, deck + .55, -.03], [-.78, deck + .2, .18]];
  pipe(s, detail, m.darkSS, hosePoints, .065, 'packaging-card-hopper-dark-corrugated-side-hose');
  const hoseRibs = [];
  for (let y = deck + .35; y < top - .05; y += .06) hoseRibs.push({ position: [-.78, y, -.03], rotation: [PI / 2, 0, 0] });
  batch(s, detail, new THREE.TorusGeometry(.068, .009, 4, 14), m.black, hoseRibs, 'packaging-card-hopper-dark-flexible-hose-ribs');
  pipe(s, detail, m.black, [[.23, top + .4, -.05], [.6, top + .35, .1], [.7, deck + .4, .25]], .015, 'packaging-card-hopper-motor-black-service-cable');
}

function cardHopper(s, root, item) {
  const [shell, process, detail] = groups(s, root, item);
  cardDrum(s, shell, process, detail, item, item.cardNumber || 1);
}

function cardAgitator(s, root, item) {
  const m = materials(s), [body, upper, detail] = groups(s, root, item), deck = item.platformHeight ?? 2.55;
  cardDrum(s, body, upper, detail, item, 4);
  const upperDeck = deck + 2.02, frame = [];
  for (const x of [-.86, .86]) for (const z of [-.85, .55]) frame.push([[x, deck + 1.01, z], [.09, 2.02, .09]]);
  for (const z of [-.85, .55]) frame.push([[0, upperDeck - .08, z], [1.85, .16, .1]]);
  for (const x of [-.86, .86]) frame.push([[x, upperDeck - .08, -.15], [.1, .16, 1.5]]);
  boxes(s, body, m.cream, frame, 'packaging-card-agitator-four-cream-upper-sieve-supports');
  const sieveParts = [body, upper, detail].map((p) => s._group(p, [0, 0, -.4]));
  cardSieveAssembly(s, ...sieveParts, upperDeck, 4);
  s._cyl(upper, .115, .74, [-.29, upperDeck - .44, -.4], m.white, .115, 20).name = 'packaging-card-four-upper-sieve-to-drum-white-feed-sleeve';
}

function hopperLayout(item) {
  if (item.hopperLayout?.length) return item.hopperLayout;
  const count = item.count || 8, rows = Math.ceil(count / 2), spacing = Math.min(1.65, ((item.depth || 8.6) - 1) / Math.max(1, rows - 1));
  return Array.from({ length: count }, (_, i) => ({ x: (i % 2 ? 1 : -1) * .58, z: (Math.floor(i / 2) - (rows - 1) / 2) * spacing, variant: i % 3 }));
}

function hoppers(s, root, item) {
  const m = materials(s), [body, process, output] = groups(s, root, item), deck = item.platformHeight ?? 2.4;
  const caps = [], filters = [], flanges = [], bodies = [], lids = [], handles = [], labels = [], latches = [];
  const squares = [], rounds = [], valves = [], greenValves = [], levers = [], sleeves = [], clamps = [], sieveBoxes = [], sieveMesh = [], hoses = [];
  const valveLips = [], redLocks = [], cableLoops = [], neckFlanges = [];
  const w = .84, d = .9, h = .72, coneW = 1.12, coneD = 1.12, high = deck - .04, low = 1.06;
  hopperLayout(item).forEach((v, i) => {
    const x = v.x, z = v.z;
    bodies.push([[x, deck + h / 2 + .05, z], [w, h, d]]);
    lids.push([[x, deck + h + .07, z], [w + .035, .04, d + .035]]);
    handles.push([[x - .1, deck + h + .085, z + .15], [x - .1, deck + h + .085, z + .21]],
      [[x + .1, deck + h + .085, z + .15], [x + .1, deck + h + .085, z + .21]],
      [[x - .1, deck + h + .085, z + .21], [x + .1, deck + h + .085, z + .21]]);
    for (const cx of [-.26, .26]) latches.push([[x + cx, deck + h - .02, z + d / 2 + .035], [.045, .13, .045]]);
    labels.push([[x, deck + .48, z + d / 2 + .025], [.29, .12, .012]]);
    for (const cx of [-.24, .24]) caps.push({ position: [x + cx, deck + h + .12, z - .2] });
    filters.push({ position: [x + .25, deck + h + .25, z + .2] });
    if (v.variant === 'round' || v.variant === 1) rounds.push({ position: [x, (high + low) / 2, z] });
    else squares.push({ position: [x, low, z] });
    valves.push({ position: [x, .65, z] });
    valveLips.push([[x, .99, z], [.36, .055, .33]]);
    if (v.valve !== 'gearmotor') levers.push([[x + .1, 1.04, z + .06], [x + .69, 1.04, z + .06]]);
    else greenValves.push([[x + .24, .9, z + .1], [.26, .2, .25]]);
    redLocks.push([[x, .84, z + .187], [.14, .045, .035]]);
    sleeves.push({ position: [x, .43, z] });
    for (const y of [.23, .63]) clamps.push({ position: [x, y, z], rotation: [PI / 2, 0, 0] });
    neckFlanges.push({ position: [x, 1.055, z] });
    flanges.push({ position: [x, .13, z] });
    hoses.push([[x + .26, 1, z], [x + .4, .83, z + .1]], [[x + .4, .83, z + .1], [x + .3, .58, z + .15]]);
    cableLoops.push({ position: [x + .12, deck - .35, z + coneD / 2 + .035], rotation: [0, 0, -.35], scale: [.7, 1, 1] });
    if (i < 3) {
      sieveBoxes.push([[x, deck + h + .16, z], [.65, .16, .6]]);
      for (let n = 0; n < 6; n++) sieveMesh.push([[x - .25 + n * .1, deck + h + .25, z], [.012, .012, .5]]);
    }
  });
  body.userData.hopperCount = bodies.length;
  boxes(s, body, m.ss, bodies, 'packaging-rectangular-ss-box-hopper-row');
  boxes(s, body, m.edge, lids.concat(latches), 'packaging-box-hopper-hinged-lids-and-front-latches');
  rods(s, body, m.edge, handles, 'packaging-box-hopper-lid-pull-handles', .016);
  boxes(s, body, m.white, labels, 'packaging-box-hopper-equipment-nameplates');
  boxes(s, process, m.edge, sieveBoxes, 'packaging-hopper-top-square-sieves');
  boxes(s, process, m.darkSS, sieveMesh, 'packaging-hopper-top-sieve-mesh');
  batch(s, process, new THREE.CylinderGeometry(.055, .055, .075, 12), m.blue, caps, 'packaging-box-hopper-blue-caps');
  batch(s, process, new THREE.CylinderGeometry(.06, .06, .27, 16), m.white, filters, 'packaging-box-hopper-white-vent-filters');
  batch(s, output, frustum(coneW, coneD, .2, .2, high - low), m.ss, squares, 'packaging-stick-square-underdeck-hopper-row');
  batch(s, output, new THREE.CylinderGeometry(.55, .1, high - low, 28), m.ss, rounds, 'packaging-stick-conical-underdeck-hopper-row');
  batch(s,output,frustum(.33,.3,.16,.16,.13),m.ss,valves,'packaging-short-valve-housing-lower-transitions');
  boxes(s,output,m.ss,valves.map(({position:[x,,z]})=>[[x,.875,z],[.33,.21,.3]]),'packaging-rectangular-ss-valve-inspection-housings');
  boxes(s,output,m.edge,valves.flatMap(({position:[x,,z]})=>[-1,1].map(side=>[[x+side*.12,.875,z+.16],[.025,.075,.025]])),'packaging-valve-housing-front-door-hinges');
  boxes(s, output, m.edge, valveLips, 'packaging-square-slide-gate-valve-top-cover-flanges');
  boxes(s, output, m.teal, greenValves, 'packaging-mint-gearmotor-valve-boxes');
  boxes(s, output, m.red, redLocks, 'packaging-valve-box-red-locking-handles');
  rods(s, output, m.teal, levers, 'packaging-slide-gate-long-mint-operating-levers', .026);
  rods(s, output, m.teal, hoses, 'packaging-stick-hopper-pneumatic-hoses', .012);
  batch(s, output, new THREE.TorusGeometry(.3, .012, 5, 24, PI * 1.7), m.black, cableLoops, 'packaging-underdeck-hopper-black-cable-loops');
  batch(s, output, new THREE.CylinderGeometry(.135, .135, .065, 24), m.edge, neckFlanges, 'packaging-hopper-neck-bolted-round-flanges');
  batch(s, output, new THREE.CylinderGeometry(.078, .078, .44, 16), m.white, sleeves, 'packaging-short-cream-flexible-floor-connectors');
  batch(s, output, new THREE.TorusGeometry(.088, .012, 5, 20), m.edge, clamps, 'packaging-stick-outlet-clamps');
  batch(s, output, new THREE.CylinderGeometry(.175, .175, .065, 24), m.edge, flanges, 'packaging-stick-hopper-floor-flange-row');
}

function cycloneFrame(s, root, item) {
  const m = materials(s), [frame, tanks, ducts] = groups(s, root, item), deck = item.platformHeight ?? 2.4;
  const w = Math.max(1.8, item.width || 2.7), d = Math.max(3, item.depth || 8), upper = item.upperDeckHeight || 4.8;
  const steel = [], railing = [], ladder = [];
  for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, 0, d / 2]) steel.push([[x, upper / 2, z], [.12, upper, .12]]);
  for (const y of [deck - .12, upper - .1]) {
    for (const x of [-w / 2, w / 2]) steel.push([[x, y, 0], [.13, .24, d + .15]]);
    for (const z of [-d / 2, 0, d / 2]) steel.push([[0, y, z], [w, .24, .13]]);
  }
  // Open grating strips keep the hopper/cyclone penetrations visible.
  for (const x of [-w * .42, w * .42]) steel.push([[x, upper, 0], [w * .16, .055, d]]);
  boxes(s, frame, m.frame, steel, 'packaging-grey-two-level-square-tube-process-frame');
  for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, -d / 4, 0, d / 4, d / 2]) railing.push([[x, upper, z], [x, upper + 1.05, z]]);
  for (const y of [upper + .55, upper + 1.05]) for (const x of [-w / 2, w / 2]) railing.push([[x, y, -d / 2], [x, y, d / 2]]);
  rods(s, frame, m.edge, railing, 'packaging-upper-deck-stainless-tube-railing', .026);
  const lx = -w / 2 - .34, lz = d / 2 - .3;
  for (const x of [lx - .25, lx + .25]) ladder.push([[x, deck, lz], [x, upper + 1.1, lz]]);
  for (let y = deck + .15; y <= upper + .15; y += .28) ladder.push([[lx - .25, y, lz], [lx + .25, y, lz]]);
  rods(s, frame, m.edge, ladder, 'packaging-upper-deck-stainless-access-ladder', .025);
  const cage = [];
  for (let y = deck + .9; y <= upper + 1.1; y += .48) cage.push({ position: [lx, y, lz - .28], rotation: [PI / 2, 0, 0] });
  batch(s, frame, new THREE.TorusGeometry(.37, .018, 5, 20, PI * 1.75), m.edge, cage, 'packaging-ladder-rounded-safety-cage');
  rods(s, frame, m.edge, [0, 1, 2, 3, 4].map((i) => {
    const a = i * PI * .4; return [[lx + Math.cos(a) * .37, deck + .9, lz - .28 + Math.sin(a) * .37], [lx + Math.cos(a) * .37, upper + 1.1, lz - .28 + Math.sin(a) * .37]];
  }), 'packaging-ladder-cage-vertical-stiffeners', .014);
  const tankCount = item.tankCount || item.count || 4;
  const layout = item.cycloneLayout || Array.from({ length: tankCount }, (_, i) => ({ x: 0, z: (i - (tankCount - 1) / 2) * Math.min(1.7, (d - 1) / Math.max(1, tankCount - 1)) }));
  layout.forEach((v, i) => {
    const r = .43, coneBottom = upper - .7, barrelBottom = upper + .05, x = v.x, z = v.z;
    const worldZ = Math.abs((item.position?.[2] || 0) + z);
    const roofLimit = item.ceilingLimit || 6 + 1.36 * Math.max(0, Math.min(worldZ, 15.2 - worldZ)) / 7.6;
    const barrelTop = Math.min(6.45, roofLimit - .36, upper + 1.3);
    const group = s._group(tanks, [x, 0, z]); group.name = `packaging-upper-cyclone-tank-${i + 1}`;
    s._cyl(group, r, barrelTop - barrelBottom, [0, (barrelTop + barrelBottom) / 2, 0], m.ss, r, 28).name = 'packaging-compact-ss-cyclone-barrel';
    s._cyl(group, r, barrelBottom - coneBottom, [0, (barrelBottom + coneBottom) / 2, 0], m.ss, .07, 28).name = 'packaging-cyclone-cone-through-upper-deck';
    s._cyl(group, r + .025, .065, [0, barrelTop, 0], m.edge, r + .025, 28);
    ring(s, group, 0, barrelBottom + .1, 0, r + .01, m.edge, 'packaging-cyclone-barrel-seam', undefined, .014);
    const gauge = s._cyl(group, .09, .045, [r + .025, upper + .65, .03], m.white, .09, 16); gauge.rotation.z = PI / 2;
    rods(s, group, m.black, [[[r + .055, upper + .65, .03], [r + .055, upper + .7, .07]]], 'packaging-cyclone-pressure-gauge-needle', .009);
    s._box(group, [.22, .3, .12], [-.25, upper + .55, r + .05], m.cream).name = 'packaging-cyclone-side-instrument-box';
    const px = x + (i % 2 ? .65 : -.65), pipeTop = Math.min(6.3, roofLimit - .26, barrelTop + .18);
    pipe(s, ducts, m.edge, [[px, deck + .9, z], [px, pipeTop - .4, z], [px, pipeTop, z], [x, pipeTop, z], [x, barrelTop + .04, z]], .105, 'packaging-cyclone-upright-silver-pneumatic-conveying-pipe');
    const seams = [];
    for (let y = deck + 1.1; y < pipeTop - .3; y += .3) seams.push({ position: [px, y, z], rotation: [PI / 2, 0, 0] });
    batch(s, ducts, new THREE.TorusGeometry(.109, .007, 4, 16), m.ss, seams, 'packaging-vertical-conveying-pipe-spiral-seams');
    s._box(ducts, [.26, .16, .22], [x, coneBottom - .12, z], m.black).name = 'packaging-cyclone-black-pneumatic-rotary-actuator';
    const indicator = s._cyl(ducts, .07, .02, [x, coneBottom - .12, z + .12], m.red, .07, 16); indicator.rotation.x = PI / 2;
  });
}

function distributor(s, root, item) {
  const m = materials(s), [body, suspension, outlet] = groups(s, root, item), deck = item.platformHeight ?? 2.4;
  const y = item.distributorHeight || deck + 1.22, w = Math.min(item.width || 2.2, 2.8), d = .75;
  s._mesh(frustum(w, d, w * .65, d * .65, .44), m.ss, body, [0, y - .44, 0]).name = 'packaging-suspended-ss-rectangular-distributor';
  s._box(body, [w + .04, .045, d + .04], [0, y + .02, 0], m.edge).name = 'packaging-distributor-hinged-rectangular-lid';
  const clamps = [], springs = [], susp = [];
  for (const x of [-w * .4, 0, w * .4]) for (const z of [-d / 2, d / 2]) clamps.push([[x, y - .04, z + Math.sign(z) * .025], [.04, .13, .035]]);
  boxes(s, body, m.red, clamps, 'packaging-distributor-red-toggle-latches');
  for (const x of [-w * .4, w * .4]) for (const z of [-d * .4, d * .4]) {
    susp.push([[x, y + .08, z], [x, y + .74, z]]);
    for (let i = 0; i < 6; i++) springs.push({ position: [x, y + .28 + i * .045, z], rotation: [PI / 2, 0, 0] });
  }
  rods(s, suspension, m.edge, susp, 'packaging-distributor-suspension-eyebolt-rods', .015);
  batch(s, suspension, new THREE.TorusGeometry(.065, .012, 4, 12), m.edge, springs, 'packaging-distributor-four-suspension-springs');
  s._box(body, [.36, .28, .3], [-w / 2 - .15, y - .24, 0], m.teal).name = 'packaging-distributor-side-vibration-motor-box';
  for (const x of [-w * .27, w * .27]) {
    const h = Math.max(.12, y - .44 - (deck + .8));
    s._cyl(outlet, .09, h, [x, deck + .8 + h / 2, 0], m.white, .09, 16).name = 'packaging-distributor-white-flexible-outlet';
    for (let yy = deck + .82; yy < y - .45; yy += .075) ring(s, outlet, x, yy, 0, .095, m.edge, 'packaging-distributor-flexible-hose-ribs', undefined, .009);
  }
}

function control(s, root, item) {
  const [body, fascia, detail] = groups(s, root, item);
  if (item.controlVariant === 'dual-mixer') {
    for (let i = 0; i < 2; i++) {
      const x = (i ? 1 : -1) * (item.width || 1.4) * .26;
      controlCabinet(s, ...[body, fascia, detail].map((p) => s._group(p, [x, 0, 0])), { ...item, width: (item.width || 1.4) * .47, variant: i ? 'transparent' : 'mixer', controlVariant: null });
    }
  } else controlCabinet(s, body, fascia, detail, item);
}

function controlCabinet(s, body, fascia, detail, item) {
  const m = materials(s), deck = item.platformHeight || item.mountHeight || 0;
  const fullHeight = item.height || 1.8, cabinetHeight = fullHeight > deck + 1 ? fullHeight - deck : fullHeight;
  const w = item.width || 1, h = Math.min(cabinetHeight, 2.2), d = Math.min(item.depth || .5, .65), level = (item.controlVariant || item.variant) === 'hopper-level';
  s._box(body, [w, h, d], [0, deck + h / 2, 0], m.cream).name = level ? 'packaging-hopper-level-control-cabinet' : 'packaging-f750-mixer-control-cabinet';
  s._box(fascia, [w - .06, h - .09, .025], [0, deck + h / 2, d / 2 + .02], m.edge);
  s._box(fascia, [w - .1, .13, .03], [0, deck + h - .15, d / 2 + .045], m.white).name = 'packaging-control-panel-nameplate';
  const lamps = [], buttons = [], black = [];
  const cols = level ? 5 : 6;
  for (let i = 0; i < cols; i++) {
    const x = (i - (cols - 1) / 2) * (w - .2) / cols;
    if (!level) lamps.push({ position: [x, deck + h * .76, d / 2 + .065], rotation: [PI / 2, 0, 0] });
    if (level) {
      for (let j = 0; j < 2; j++) { buttons.push({ position: [x, deck + h * (.56 - j * .24), d / 2 + .065], rotation: [PI / 2, 0, 0] }); black.push({ position: [x, deck + h * (.66 - j * .24), d / 2 + .065], rotation: [PI / 2, 0, 0] }); }
    } else for (let j = 0; j < 3; j++) buttons.push({ position: [x, deck + h * (.46 - j * .12), d / 2 + .065], rotation: [PI / 2, 0, 0] });
  }
  batch(s, fascia, new THREE.CylinderGeometry(.032, .032, .025, 12), m.red, lamps.concat(black), 'packaging-control-panel-red-status-lamps');
  batch(s, fascia, new THREE.CylinderGeometry(.029, .029, .035, 12), m.green, buttons, 'packaging-control-panel-round-push-buttons');
  if (!level) for (const x of [-w * .2, w * .2]) {
    const gauge = s._cyl(fascia, .08, .03, [x, deck + h * .6, d / 2 + .06], m.white, .08, 16); gauge.rotation.x = PI / 2;
    rods(s, fascia, m.black, [[[x, deck + h * .6, d / 2 + .08], [x + .03, deck + h * .6 + .04, d / 2 + .08]]], 'packaging-panel-analogue-meter-needles', .006);
  }
  if (item.variant === 'transparent') {
    s._box(detail, [w - .03, h - .05, .025], [0, deck + h / 2, d / 2 + .13], m.glass).name = 'packaging-control-transparent-protective-door';
    rods(s, detail, m.black, [[[-w / 2 + .03, deck + .04, d / 2 + .15], [-w / 2 + .03, deck + h - .04, d / 2 + .15]],
      [[w / 2 - .03, deck + .04, d / 2 + .15], [w / 2 - .03, deck + h - .04, d / 2 + .15]]], 'packaging-transparent-door-black-rubber-gasket', .025);
    s._cyl(detail, .065, .15, [0, deck + h + .075, 0], m.red, .065, 16).name = 'packaging-control-panel-red-beacon';
  } else if (!level) rods(s, detail, m.edge, [[[-w * .62, deck, d / 2 + .4], [-w * .62, deck + .95, d / 2 + .4]],
    [[w * .62, deck, d / 2 + .4], [w * .62, deck + .95, d / 2 + .4]], [[-w * .62, deck + .95, d / 2 + .4], [w * .62, deck + .95, d / 2 + .4]]], 'packaging-mixer-panel-front-stainless-protective-rail', .026);
  handle(s, detail, m.darkSS, w * .35, deck + h * .46, d / 2 + .075);
}

function cip(s, root, item) {
  const m = materials(s), [tank, washing, accessory] = groups(s, root, item), w = item.width || 4.3, d = item.depth || 1.7;
  const tx = -w * .3, tz = -d * .1;
  // The room's tank and double sink already have their own selectable items.
  // Only an explicitly requested complete-service assembly may repeat them.
  if (item.includeTankAndSink) {
  s._cyl(tank, .38, 1.5, [tx, 1.08, tz], m.ss, .38, 28).name = 'packaging-cip-stainless-hot-water-tank';
  s._cyl(tank, .06, .19, [tx, 1.92, tz], m.edge, .38, 24);
  boxes(s, tank, m.edge, [-1, 1].flatMap((x) => [-1, 1].map((z) => [[tx + x * .25, .2, tz + z * .25], [.06, .4, .06]])), 'packaging-cip-tank-four-legs');
  pipe(s, tank, m.blue, [[tx - .5, .22, tz], [tx - .5, 1.72, tz], [tx - .2, 1.72, tz]], .055, 'packaging-cip-blue-insulated-hot-water-pipe');
  s._box(tank, [.26, .35, .12], [tx - .46, 1.1, tz + .15], m.cream);
  s._box(tank, [.12, .05, .015], [tx - .46, 1.17, tz + .22], m.display);
  s._box(tank, [.16, .16, .014], [tx, 1.25, tz + .386], m.yellow).name = 'packaging-cip-hot-surface-warning';
  const sx = w * .1, sy = .83, sinkW = Math.min(1.6, w * .4), sinkD = .65;
  boxes(s, washing, m.ss, [[[sx, sy - .16, 0], [sinkW, .05, sinkD]], [[sx, sy, -sinkD / 2], [sinkW, .32, .04]], [[sx, sy, sinkD / 2], [sinkW, .32, .04]],
    [[sx - sinkW / 2, sy, 0], [.04, .32, sinkD]], [[sx + sinkW / 2, sy, 0], [.04, .32, sinkD]], [[sx, sy, 0], [.04, .32, sinkD]]], 'packaging-cip-double-bowl-stainless-sink');
  for (const x of [-1, 1]) for (const z of [-1, 1]) rods(s, washing, m.edge, [[[sx + x * sinkW * .44, .02, z * sinkD * .43], [sx + x * sinkW * .44, sy, z * sinkD * .43]]], 'packaging-cip-sink-legs');
  for (const x of [-.3, .3]) {
    s._box(washing, [sinkW * .4, .015, sinkD * .72], [sx + x, sy - .12, 0], m.darkSS);
    pipe(s, washing, m.edge, [[sx + x, sy + .1, -.25], [sx + x, sy + .45, -.25], [sx + x, sy + .5, -.05], [sx + x, sy + .34, .03]], .018, 'packaging-cip-gooseneck-faucet');
  }
  } else {
    const rackW = Math.min(.7, w * .38), rackX = -w * .31, rackDepth = Math.min(.55, d * .8), rackBars = [];
    for (const x of [-1, 1]) for (const z of [-1, 1]) rackBars.push([[rackX + x * rackW / 2, .06, z * rackDepth / 2], [rackX + x * rackW / 2, 1.45, z * rackDepth / 2]]);
    for (const y of [.2, .65, 1.1, 1.42]) {
      for (const z of [-rackDepth / 2, rackDepth / 2]) rackBars.push([[rackX - rackW / 2, y, z], [rackX + rackW / 2, y, z]]);
      for (let x = -rackW / 2; x <= rackW / 2; x += .12) rackBars.push([[rackX + x, y, -rackDepth / 2], [rackX + x, y, rackDepth / 2]]);
    }
    rods(s, tank, m.edge, rackBars, 'packaging-cip-stainless-open-wire-drying-rack', .016);
  }
  for (let i = 0; i < 2; i++) {
    const x = item.includeTankAndSink ? w * .37 : w * .03 + i * .59, z = item.includeTankAndSink ? -.35 + i * .8 : 0;
    s._box(washing, [.52, .35, .48], [x, .32, z], i ? m.green : m.cream).name = 'packaging-cip-portable-pressure-washer';
    for (const side of [-1, 1]) { const wheel = s._cyl(washing, .13, .06, [x + side * .28, .17, z], m.rubber, .13, 12); wheel.rotation.z = PI / 2; }
    rods(s, washing, m.edge, [[[x - .22, .3, z - .17], [x - .22, .78, z - .17]], [[x + .22, .3, z - .17], [x + .22, .78, z - .17]], [[x - .22, .78, z - .17], [x + .22, .78, z - .17]]], 'packaging-pressure-washer-handle', .018);
    ring(s, accessory, x, .5, z + .255, .18, m.black, 'packaging-pressure-washer-coiled-hose', [0, 0, 0], .025);
  }
  const drain = [];
  for (let x = -w / 2; x < w / 2; x += .11) drain.push([[x, .025, d * .45], [.035, .018, .22]]);
  boxes(s, accessory, m.edge, drain, 'packaging-cip-wall-side-stainless-grating-trench');
}

function scale(s, root, item) {
  const m = materials(s), [base, weighing, detail] = groups(s, root, item), deck = item.platformHeight || 0;
  s._box(base, [.73, .09, .7], [0, deck + .09, 0], m.ss).name = 'packaging-cas-platform-scale';
  boxes(s, base, m.black, [-1, 1].flatMap((x) => [-1, 1].map((z) => [[x * .29, deck + .035, z * .28], [.08, .06, .08]])), 'packaging-scale-adjustable-feet');
  s._cyl(weighing, .025, .94, [0, deck + .6, -.32], m.edge, .025, 12).name = 'packaging-cas-scale-display-post';
  s._box(weighing, [.35, .21, .1], [0, deck + 1.1, -.32], m.cream);
  s._box(detail, [.22, .085, .014], [-.035, deck + 1.12, -.262], m.display).name = 'packaging-scale-digital-readout';
  boxes(s, detail, m.blue, [0, 1, 2].map((i) => [[.1, deck + 1.15 - i * .045, -.25], [.03, .025, .013]]), 'packaging-scale-keypad');
}

function weighServices(s, root, item) {
  const m = materials(s), [table, extraction, cabinets] = groups(s, root, item), w = item.width || 3.6;
  const tx = -w * .25;
  s._box(table, [1.4, .06, .72], [tx, .82, 0], m.ss).name = 'packaging-weighing-room-ss-worktable';
  boxes(s, table, m.edge, [-1, 1].flatMap((x) => [-1, 1].map((z) => [[tx + x * .62, .4, z * .3], [.045, .8, .045]])), 'packaging-weighing-table-legs');
  pipe(s, extraction, m.edge, [[tx + .3, 2.8, -.25], [tx + .3, 2.3, -.25], [tx, 1.9, -.1], [tx, 1.5, .05]], .1, 'packaging-telescopic-extraction-flexible-arm');
  s._cyl(extraction, .1, .3, [tx, 1.35, .05], m.ss, .27, 24).name = 'packaging-telescopic-conical-extraction-hood';
  const rings = [];
  for (let y = 2.36; y < 2.8; y += .055) rings.push({ position: [tx + .3, y, -.25], rotation: [PI / 2, 0, 0] });
  batch(s, extraction, new THREE.TorusGeometry(.103, .009, 4, 16), m.darkSS, rings, 'packaging-aluminium-extraction-hose-corrugations');
  s._box(cabinets, [.7, 1.6, .58], [w * .1, .8, -.1], m.frame).name = 'packaging-weighing-room-dust-collector-cabinet';
  for (const x of [-.2, .2]) {
    pipe(s, extraction, m.white, [[w * .1 + x, 1.6, -.1], [w * .1 + x, 1.9, -.1], [tx + x, 2.2, -.25]], .055, 'packaging-weighing-collector-white-flexible-hose');
    s._cyl(extraction, .064, .1, [w * .1 + x, 1.65, -.1], m.blue, .064, 12);
  }
  const pcX = w * .36;
  s._box(cabinets, [.62, 1.65, .6], [pcX, .825, 0], m.white).name = 'packaging-blue-door-industrial-pc-cabinet';
  s._box(cabinets, [.58, .6, .035], [pcX, 1.26, .32], m.blue);
  s._box(cabinets, [.38, .34, .015], [pcX, 1.3, .345], m.display); s._box(cabinets, [.29, .2, .018], [pcX, 1.3, .355], m.screen);
  s._box(cabinets, [.56, .045, .3], [pcX, .9, .45], m.ss).name = 'packaging-industrial-pc-keyboard-shelf';
  s._box(cabinets, [.51, .025, .22], [pcX, .935, .45], m.black);
}

const BUILDERS = {
  'packaging-mixer': (s, r, i) => mixer(s, r, i),
  'packaging-ribbon-mixer': (s, r, i) => mixer(s, r, i, true),
  'packaging-stick-mixer': (s, r, i) => mixer(s, r, i, false, true),
  'packaging-aux-mixer': (s, r, i) => mixer(s, r, i, false, true),
  'packaging-sieve': sieve, 'packaging-stick-hoppers': hoppers,
  'packaging-card-hopper': cardHopper, 'packaging-card-agitator': cardAgitator,
  'packaging-cyclone-frame': cycloneFrame, 'packaging-suspended-distributor': distributor,
  'packaging-control': control, 'packaging-cip-services': cip, 'packaging-scale': scale, 'packaging-weigh-services': weighServices,
};

export function buildPackagingEquipmentV2(s, root, item) {
  const builder = BUILDERS[item.type];
  if (!builder) return false;
  builder(s, root, item); root.userData.packagingEquipmentVersion = 2; return true;
}
