import * as THREE from '../shared/vendor/three.module.js';

// Registered 3F shapes follow the continuous walk; unregistered legacy items
// retain their historical OWP silhouettes. Neither is an OEM reconstruction.
// Each catalog ID owns its parts and its explicitly observed shared platform.
const PI = Math.PI, UP = new THREE.Vector3(0, 1, 0);
export const DRYER_PROCESS_IDS = Object.freeze([
  'f1-mix-a', 'f1-mix-b', 'f1-melting', 'f1-oil-water', 'f1-s1',
  'f1-ica-1', 'f1-ica-2', 'f1-ica-3', 'f1-xray-1', 'f1-xray-2', 'f1-xray-3',
  'f1-conveyor-a', 'f1-conveyor-b', 'f1-palletizer',
  'f3-sterilizer', 'f3-homogenizer', 'f3-balance-tank', 'f3-feed-tank', 'f3-holding',
  'f4-fluid-bed', 'f4-fine-return', 'f4-transfer-bin',
]);
const supported = new Set(DRYER_PROCESS_IDS);
function tag(object, name) { object.name = `dryer-process-${name}`; return object; }
function box(s, parent, size, position, material = s.mat.steel, name = 'plate') {
  return tag(s._mesh(new THREE.BoxGeometry(...size), material, parent, position), name);
}
function cyl(s, parent, radius, height, position, material = s.mat.steel, bottom = radius, name = 'cylinder', segments = 24) {
  return tag(s._mesh(new THREE.CylinderGeometry(radius, bottom, height, segments), material, parent, position), name);
}
function bar(s, parent, a, b, radius = .035, material = s.mat.trim, name = 'rail') {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start);
  if (delta.lengthSq() < 1e-12) return null;
  const m = cyl(s, parent, radius, delta.length(), start.add(end).multiplyScalar(.5).toArray(), material, radius, name, 10);
  m.quaternion.setFromUnitVectors(UP, delta.normalize()); return m;
}
function ring(s, parent, radius, position, material = s.mat.trim, thickness = .025, axis = 'y', name = 'flange') {
  const m = tag(s._mesh(new THREE.TorusGeometry(radius, thickness, 6, 32), material, parent, position), name);
  if (axis === 'y') m.rotation.x = PI / 2;
  else if (axis === 'x') m.rotation.y = PI / 2;
  return m;
}
function pipe(s, parent, points, radius = .07, material = s.mat.trim, name = 'pipe') {
  const vectors = points.map(p => new THREE.Vector3(...p));
  return tag(s._mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(vectors, false, 'centripetal'), Math.max(12, points.length * 8), radius, 10, false), material, parent), name);
}
function material(s, key, color, options = {}) {
  s._dryerProcessMaterials ||= new Map();
  if (!s._dryerProcessMaterials.has(key)) {
    const m = s._material ? s._material(color, .6, .08, options) : new THREE.MeshStandardMaterial({ color, roughness: .6, metalness: .08, ...options });
    s.materials?.add(m); s._dryerProcessMaterials.set(key, m);
  }
  return s._dryerProcessMaterials.get(key);
}
function repeated(s, parent, geometry, poses, material, name) {
  const mesh = new THREE.InstancedMesh(geometry, material, poses.length), matrix = new THREE.Matrix4(), q = new THREE.Quaternion();
  poses.forEach((pose, i) => { q.setFromEuler(new THREE.Euler(...(pose.rotation || [0, 0, 0]))); matrix.compose(new THREE.Vector3(...pose.position), q, new THREE.Vector3(1, 1, 1)); mesh.setMatrixAt(i, matrix); });
  mesh.instanceMatrix.needsUpdate = true; mesh.castShadow = mesh.receiveShadow = true;
  s.geometries?.add(geometry); parent.add(mesh); return tag(mesh, name);
}
function parts(s, root, item) {
  return item.parts.map((name, i) => s._part(root, name, [[-1, .3, 0], [0, 1.1, 0], [1, .2, 1], [0, .4, 1.3]][i % 4]));
}
function legs(s, parent, width, depth, height, position = [0, 0, 0]) {
  for (const x of [-width / 2, width / 2]) for (const z of [-depth / 2, depth / 2]) {
    box(s, parent, [.1, height, .1], [position[0] + x, position[1] + height / 2, position[2] + z], s.mat.trim, 'support-leg');
    box(s, parent, [.22, .06, .22], [position[0] + x, position[1] + .03, position[2] + z], s.mat.dark, 'foot');
  }
}
function motor(s, parent, position, radius = .19, length = .5, vertical = false) {
  const g = tag(s._group(parent, position), 'motor');
  const body = cyl(s, g, radius, length, [0, 0, 0], s.mat.motor, radius, 'motor-body');
  if (!vertical) body.rotation.z = PI / 2;
  const casing = s._group(g);
  if (!vertical) casing.rotation.z = PI / 2;
  const fins = Array.from({ length: 14 }, (_, i) => {
    const angle = i * 2 * PI / 14;
    return { position: [Math.cos(angle) * radius, 0, Math.sin(angle) * radius], rotation: [0, -angle, 0] };
  });
  repeated(s, casing, new THREE.BoxGeometry(radius * .16, length * .78, radius * .066), fins, s.mat.motor, 'motor-fin');
  const bell = [[radius * .91, -.06], [radius * 1.06, -.044], [radius * 1.06, 0], [radius * .92, .025], [radius * .65, .035], [0, .035]];
  tag(s._mesh(new THREE.LatheGeometry(bell.map(([r, y]) => new THREE.Vector2(r, y)), 24), s.mat.motor, casing, [0, length / 2, 0]), 'drive-end-bell');
  cyl(s, casing, radius * 1.05, .04, [0, -length * .46, 0], s.mat.motor, radius * 1.05, 'motor-base-rim', 24);
  box(s, g, [.2, .16, .2], vertical ? [radius, 0, 0] : [0, radius, 0], s.mat.motor, 'terminal-box');
  return g;
}
function control(s, parent, position, width = .55, height = .8) {
  const g = tag(s._group(parent, position), 'control');
  box(s, g, [width, height, .23], [0, 0, 0], s.mat.white, 'control-cabinet');
  box(s, g, [width * .65, height * .29, .025], [0, height * .17, .13], s.mat.screen, 'control-screen');
  for (const x of [-.14, 0, .14]) cyl(s, g, .025, .025, [x, -height * .22, .15], x === .14 ? s.mat.red : s.mat.mint, .025, 'pushbutton', 10).rotation.x = PI / 2;
}
function gauge(s, parent, position, r = .1) {
  const g = tag(s._group(parent, position), 'gauge');
  cyl(s, g, r, .05, [0, 0, 0], s.mat.white, r, 'dial').rotation.x = PI / 2;
  ring(s, g, r, [0, 0, .03], s.mat.trim, .012, 'z');
  bar(s, g, [0, 0, .035], [r * .4, r * .45, .035], .006, s.mat.black, 'needle');
}
function stairs(s, parent, { x = 0, z = 0, width = .65, rise = 1.5, run = 1.7, alongX = false, name = 'access-stair' } = {}) {
  const g = tag(s._group(parent, [x, 0, z]), name), n = Math.ceil(rise / .2);
  if (alongX) g.rotation.y = PI / 2;
  for (let i = 0; i < n; i++) box(s, g, [width, .05, run / n + .025], [0, rise * (i + 1) / n, run * (i + .5) / n], s.mat.trim, 'stair-tread');
  for (const side of [-1, 1]) {
    const px = side * width / 2;
    bar(s, g, [px, .05, 0], [px, rise, run], .055, s.mat.trim, 'stair-stringer');
    bar(s, g, [px, .9, 0], [px, rise + .9, run], .025, s.mat.trim, 'stair-handrail');
    for (const t of [0, .5, 1]) bar(s, g, [px, rise * t, run * t], [px, rise * t + .9, run * t], .024);
  }
  return g;
}
function rail(s, parent, a, b, y = 2, height = .85, mat = s.mat.trim) {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(length / 1.4));
  for (let i = 0; i <= n; i++) { const t = i / n; bar(s, parent, [a[0] + (b[0] - a[0]) * t, y, a[1] + (b[1] - a[1]) * t], [a[0] + (b[0] - a[0]) * t, y + height, a[1] + (b[1] - a[1]) * t], .024, mat); }
  for (const h of [height * .5, height]) bar(s, parent, [a[0], y + h, a[1]], [b[0], y + h, b[1]], .025, mat);
}
function deck(s, parent, outline, holes, y, name) {
  const shape = new THREE.Shape(outline.map(p => new THREE.Vector2(...p)));
  for (const [x, z, r] of holes) { const path = new THREE.Path(); path.absarc(x, z, r, 0, PI * 2, true); shape.holes.push(path); }
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: .09, bevelEnabled: false, curveSegments: 24 }); geometry.rotateX(PI / 2);
  return tag(s._mesh(geometry, s.mat.trim, parent, [0, y, 0]), name);
}
function vessel(s, body, top, connections, { x = 0, z = 0, r = .8, base = .4, h = 1.8, mixer = true, ladder = false, name = 'vessel', shellPaint = s.mat.steel } = {}) {
  const g = tag(s._group(body, [x, 0, z]), name); legs(s, g, r * 1.2, r * 1.2, base);
  cyl(s, g, r, h, [0, base + h / 2, 0], shellPaint, r, 'vessel-shell', 32);
  cyl(s, g, r, .22, [0, base - .08, 0], shellPaint, .18, 'vessel-lower-dish', 32);
  for (const y of [base + .04, base + h - .04]) ring(s, g, r + .012, [0, y, 0]);
  const cap = tag(s._group(top, [x, base + h, z]), 'vessel-top');
  cyl(s, cap, .2, .22, [0, .11, 0], shellPaint, r, 'vessel-top-dish', 32);
  cyl(s, cap, .16, .09, [r * .47, .17, 0], s.mat.trim, .16, 'lid');
  if (mixer) { box(s, cap, [r * 1.4, .08, .22], [0, .23, 0], s.mat.trim, 'mixer-bridge'); motor(s, cap, [0, .48, 0], .15, .45, true); }
  pipe(s, connections, [[x, .32, z], [x, .32, z + r + .25], [x + .35, .32, z + r + .25]], .05, s.mat.trim, 'vessel-outlet');
  if (ladder) for (const side of [-1, 1]) {
    bar(s, connections, [x + r + .15, .12, z + side * .24], [x + r + .15, base + h + .3, z + side * .24], .028, s.mat.trim, 'vessel-ladder-rail');
    if (side === 1) for (let y = .25; y < base + h + .25; y += .27) bar(s, connections, [x + r + .15, y, z - .24], [x + r + .15, y, z + .24], .021, s.mat.trim, 'vessel-ladder-rung');
  }
  return g;
}
function relative(item, other, fallback) {
  if (!other?.position) return fallback;
  const x = other.position[0] - item.position[0], z = other.position[2] - item.position[2], a = item.rotation || 0;
  return [x * Math.cos(a) - z * Math.sin(a), x * Math.sin(a) + z * Math.cos(a)];
}
function tankGroup(s, root, item, g) {
  if (item.id === 'f1-melting') {
    for (const x of [-.73, .73]) vessel(s, g[0], g[1], g[2], { x, r: .61, h: 1.85, name: 'melting-reference-vessel' });
    deck(s, g[2], [[-1.7, -1.2], [1.7, -1.2], [1.7, 1.2], [-1.7, 1.2]], [[-.73, 0, .68], [.73, 0, .68]], 2, 'shared-two-vessel-platform');
    legs(s, g[2], 3.2, 2.2, 2); rail(s, g[2], [-1.7, 1.2], [1.7, 1.2], 2);
    stairs(s, g[2], { x: -.7, z: -1.13, rise: 2, run: 1.4, alongX: true });
    root.userData.historicalVesselBodies = 2; return;
  }
  if (item.id === 'f1-oil-water') {
    vessel(s, g[0], g[1], g[2], { x: -.73, r: .61, h: 1.85, name: 'oil-reference-vessel' });
    vessel(s, g[0], g[1], g[2], { x: .73, r: .61, h: 1.85, name: 'hot-water-reference-vessel' });
    root.userData.historicalVesselBodies = 2; return;
  }
  vessel(s, g[0], g[1], g[2], { r: .81, h: 1.85, mixer: true, name: item.id === 'f1-s1' ? 's1-reference-vessel' : 'mix-reference-vessel' });
  root.userData.historicalVesselBodies = 1;
  if (item.id === 'f1-s1') return; // Separate architectural room; never bridge its wall.
  if (item.id !== 'f1-mix-a') return;
  const peer = (id) => (s.equipment || []).find(i => i.id === id);
  const b = relative(item, peer('f1-mix-b'), [4.1, 0]), u = relative(item, peer('f1-oil-water'), [4.3, 4.6]);
  const right = Math.max(b[0] + 1.35, u[0] + 1.5), rear = Math.max(2.8, u[1] + 1.2), neck = u[0] - 1.6;
  const outline = [[-1.3, -1.25], [right, -1.25], [right, rear], [neck, rear], [neck, 1.25], [-1.3, 1.25]];
  deck(s, g[2], outline, [[0, 0, .87], [b[0], b[1], .87], [u[0] - .73, u[1], .68], [u[0] + .73, u[1], .68]], 2, 'shared-four-vessel-platform');
  for (const p of [[-.95, -1], [right - .2, -1], [neck + .2, rear - .2], [right - .2, rear - .2]]) {
    box(s, g[2], [.1, 2, .1], [p[0], 1, p[1]], s.mat.trim, 'shared-platform-column');
    box(s, g[2], [.24, .06, .24], [p[0], .03, p[1]], s.mat.dark, 'shared-platform-foot');
  }
  rail(s, g[2], [-1.3, -1.25], [right, -1.25], 2); rail(s, g[2], [right, -1.25], [right, rear], 2);
  rail(s, g[2], [neck, rear], [right, rear], 2);
  stairs(s, g[2], { x: 1.8, z: 1.5, rise: 2, run: 1.4 });
}
function rollerLine(s, parent, a, b, width = .75, height = .82, name = 'roller-line') {
  const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz); if (length < .01) return;
  const g = tag(s._group(parent, [(a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2]), name); g.rotation.y = Math.atan2(dx, dz);
  box(s, g, [width, .08, length], [0, height - .08, 0], s.mat.dark, 'roller-bed');
  for (const x of [-width / 2 - .04, width / 2 + .04]) box(s, g, [.07, .17, length], [x, height - .04, 0], s.mat.trim, 'conveyor-side-frame');
  const count = Math.max(2, Math.ceil(length / .2)), rollers = [];
  for (let i = 0; i < count; i++) rollers.push({ position: [0, height, -length / 2 + (i + .5) * length / count], rotation: [0, 0, PI / 2] });
  repeated(s, g, new THREE.CylinderGeometry(.045, .045, width, 10), rollers, s.mat.steel, 'roller-bank');
  for (const z of [-length / 2 + .12, length / 2 - .12]) legs(s, g, width - .08, .05, height - .12, [0, 0, z]);
}
function beltPath(s, parent, points, width = .62, y = .86) {
  for (let i = 1; i < points.length; i++) {
    const [a, b] = [points[i - 1], points[i]], dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
    const g = s._group(parent, [(a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2]); g.rotation.y = Math.atan2(dx, dz);
    box(s, g, [width, .07, length + .05], [0, y, 0], s.mat.floor, 'green-output-belt');
    for (const x of [-width / 2, width / 2]) bar(s, g, [x, y + .12, -length / 2], [x, y + .12, length / 2], .025);
    legs(s, g, width, Math.max(.05, length - .1), y - .08);
  }
}
function rollerCurve(s, parent, center, radius = 1.2, start = 0, angle = PI / 2, width = .7, y = .82) {
  const g = tag(s._group(parent, [center[0], 0, center[1]]), 'quarter-turn-roller');
  const shape = new THREE.Shape(); shape.absarc(0, 0, radius + width / 2, start, start + angle, angle < 0);
  shape.absarc(0, 0, radius - width / 2, start + angle, start, angle >= 0); shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: .08, bevelEnabled: false, curveSegments: 24 }); geo.rotateX(PI / 2);
  tag(s._mesh(geo, s.mat.dark, g, [0, y - .05, 0]), 'curved-conveyor-bed');
  for (let i = 0; i < 17; i++) {
    const a = start + angle * i / 16, cx = Math.cos(a) * radius, cz = Math.sin(a) * radius;
    bar(s, g, [cx - Math.cos(a) * width / 2, y, cz - Math.sin(a) * width / 2], [cx + Math.cos(a) * width / 2, y, cz + Math.sin(a) * width / 2], .044, s.mat.steel, 'curved-roller');
  }
}
function packing(s, root, item, g) {
  const glass = material(s, 'guard-glass', 0xb7d2ce, { transparent: true, opacity: .16, depthWrite: false, side: THREE.DoubleSide });
  box(s, g[0], [1.65, .13, 1.45], [0, .18, 0], s.mat.dark, 'ica-base');
  for (const x of [-.78, .78]) for (const z of [-.65, .65]) box(s, g[0], [.075, 2.8, .075], [x, 1.6, z], s.mat.trim, 'ica-column');
  box(s, g[0], [1.7, .09, 1.5], [0, 3, 0], s.mat.trim, 'ica-top-frame');
  for (const z of [-.69, .69]) box(s, g[0], [1.5, 2.15, .018], [0, 1.8, z], glass, 'ica-guard-panel');
  cyl(s, g[1], .48, .45, [0, 2.95, 0], s.mat.steel, .15, 'ica-feed-funnel');
  bar(s, g[1], [0, 1.8, 0], [0, 2.77, 0], .12, s.mat.trim, 'ica-filling-tube');
  const roll = cyl(s, g[2], .3, 1.35, [0, 2.1, -.62], s.mat.white, .3, 'film-roll'); roll.rotation.z = PI / 2;
  for (const x of [-.36, .36]) { bar(s, g[2], [x, .65, .5], [x, 2.35, .5], .04, s.mat.trim, 'sealing-guide'); box(s, g[2], [.13, .34, .25], [x, 1.23, .53], s.mat.dark, 'vertical-sealing-jaw'); }
  for (const y of [.9, 1.7]) box(s, g[2], [.9, .1, .26], [0, y, .5], s.mat.trim, 'horizontal-sealing-jaw');
  control(s, g[2], [1, 1.9, .25], .42, .6);
  beltPath(s, g[3], [[0, .75], [0, 1.45], [.65, 1.9], [.9, 2.3]], .56);
  box(s, g[3], [.24, .3, .18], [0, 1.05, 1.15], s.mat.white, 'representative-unmarked-pack');
}
function xray(s, root, item, g) {
  box(s, g[0], [1.4, .95, 1.2], [0, 1.35, 0], s.mat.steel, 'xray-tunnel');
  for (const z of [-.62, .62]) {
    box(s, g[0], [.78, .55, .025], [0, 1.18, z], s.mat.black, 'xray-aperture');
    for (let x = -.32; x < .36; x += .12) box(s, g[0], [.018, .52, .025], [x, 1.17, z + .018], s.mat.dark, 'xray-curtain');
  }
  rollerLine(s, g[1], [0, -1.35], [0, 1.35], .8);
  control(s, g[2], [.95, 1.65, .25], .4, .6);
}
function conveyor(s, root, item, g) {
  const length = item.length || 7;
  rollerLine(s, g[0], [0, -length / 2], [0, length / 2], .78);
  if (item.id === 'f1-conveyor-a') {
    for (const id of ['f1-xray-1', 'f1-xray-2', 'f1-xray-3']) {
      const other = (s.equipment || []).find(i => i.id === id); if (!other) continue;
      const start = relative(item, { position: [other.position[0], 0, other.position[2] + 1.4] }, [0, 0]);
      const end = [0, Math.max(-length / 2 + .2, Math.min(length / 2 - .2, start[1]))];
      rollerLine(s, g[0], start, end, .62, .82, 'packing-branch-roller');
    }
    const next = (s.equipment || []).find(i => i.id === 'f1-conveyor-b');
    if (next) { const q = relative(item, next, [0, length / 2]); rollerLine(s, g[0], [0, Math.sign(q[1] || 1) * length / 2], q, .78, .82, 'collector-connection'); }
  } else {
    rollerCurve(s, g[0], [1.2, length / 2], 1.2, PI, -PI / 2);
    const pallet = (s.equipment || []).find(i => i.id === 'f1-palletizer');
    const target = pallet ? relative(item, { position: [pallet.position[0] - 1.1, 0, pallet.position[2] + 2.7] }, [3.2, length / 2 + 1.2]) : [3.2, length / 2 + 1.2];
    rollerLine(s, g[0], [1.2, length / 2 + 1.2], target, .78, .82, 'pallet-infeed-connection');
  }
  motor(s, g[2], [.58, .53, -length / 2 + .3]);
  for (const z of [-length * .25, length * .22]) box(s, g[1], [.48, .3, .48], [0, 1.03, z], s.mat.concrete, 'representative-unmarked-carton');
}
function fence(s, parent, x0, x1, z0, z1, h = 1.7) {
  const orange = material(s, 'guard-orange', 0xce6e31);
  for (const [a, b] of [[[x0, z0], [x1, z0]], [[x0, z0], [x0, z1]], [[x1, z0], [x1, z1]]]) {
    rail(s, parent, a, b, .12, h, orange);
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / .2);
    for (let i = 0; i <= n; i++) { const t = i / n; bar(s, parent, [a[0] + (b[0] - a[0]) * t, .2, a[1] + (b[1] - a[1]) * t], [a[0] + (b[0] - a[0]) * t, h + .1, a[1] + (b[1] - a[1]) * t], .012, orange, 'safety-fence-wire'); }
  }
}
function palletizer(s, root, item, g) {
  const blue = material(s, 'palletizer-blue', 0x335e98);
  for (const x of [-1.55, 1.55]) box(s, g[0], [.2, 3.05, .23], [x, 1.6, 0], s.mat.white, 'palletizer-upright');
  for (const y of [.35, 2.9]) box(s, g[0], [3.3, .18, 1.4], [0, y, 0], s.mat.trim, 'palletizer-crossbeam');
  box(s, g[1], [.8, 2.25, .8], [.8, 1.45, 0], blue, 'blue-lifting-column');
  box(s, g[1], [2.6, .16, 1.3], [0, 1.9, 0], s.mat.yellow, 'transfer-carriage');
  box(s, g[1], [1.8, .12, 1.25], [0, 1.6, 0], s.mat.trim, 'load-gripper');
  fence(s, g[0], -2.05, 2.05, -1.2, 1.6);
  cyl(s, g[2], 1.1, .16, [0, .23, 2.7], s.mat.trim, 1.1, 'pallet-turntable', 40);
  for (const x of [-.8, .8]) box(s, g[2], [.16, 2.55, .16], [x, 1.45, 3.75], s.mat.yellow, 'turntable-guard-column');
  box(s, g[2], [1.8, .14, .14], [0, 2.7, 3.75], s.mat.yellow, 'turntable-guard-crossbeam');
  for (const x of [-.72, 0, .72]) box(s, g[2], [.18, .18, 1.6], [x, .4, 2.7], s.mat.copper, 'pallet-runner');
  for (const z of [-.65, -.25, .25, .65]) box(s, g[2], [1.7, .06, .15], [0, .53, 2.7 + z], s.mat.concrete, 'pallet-board');
  for (const x of [-.4, .4]) for (const z of [2.3, 3.1]) box(s, g[2], [.75, .6, .7], [x, .86, z], s.mat.concrete, 'representative-unmarked-carton');
}
function threeVesselSkid(s, root, item, g) {
  for (const x of [-1.25, 0, 1.25]) vessel(s, g[0], g[1], g[2], { x, r: .48, h: 1.75, mixer: false, name: 'skid-vessel' });
  deck(s, g[0], [[-1.95, -.85], [1.95, -.85], [1.95, 1.3], [-1.95, 1.3]], [[-1.25, 0, .53], [0, 0, .53], [1.25, 0, .53]], 1.2, 'three-vessel-common-platform');
  legs(s, g[0], 3.65, 1.9, 1.2, [0, 0, .2]); rail(s, g[0], [-1.95, 1.3], [1.95, 1.3], 1.2);
  stairs(s, g[0], { x: 1.25, z: 1.3, rise: 1.2, run: 1.4 });
  for (const y of [2.65, 2.95]) pipe(s, g[2], [[-1.5, y, -.4], [1.5, y, -.4], [1.8, y - .3, -.4]], .06);
  for (const x of [-1.25, 0, 1.25]) gauge(s, g[2], [x, 2.1, .42]);
  control(s, g[2], [-1.45, 1.65, 1.15]);
}
function standaloneTank(s, root, item, g) {
  vessel(s, g[0], g[1], g[2], { r: item.id === 'f3-balance-tank' ? 1.05 : .88, h: 2.4, mixer: item.id === 'f3-balance-tank', ladder: item.id === 'f3-feed-tank', name: 'standalone-reference-vessel' });
  pipe(s, g[2], [[0, .32, .9], [1.2, .32, .9], [1.2, .9, .9]], .065);
  motor(s, g[2], [1.05, .5, .9], .18, .55);
}
function homogenizer(s, root, item, g) {
  box(s, g[0], [2.5, .16, 1.6], [0, .18, 0], s.mat.dark, 'homogenizer-base');
  box(s, g[0], [2.2, 1.2, 1.45], [0, .88, 0], s.mat.steel, 'homogenizer-enclosure');
  for (const x of [-.65, 0, .65]) { cyl(s, g[1], .15, .4, [x, 1.35, .88], s.mat.trim, .15, 'plunger-head').rotation.x = PI / 2; cyl(s, g[1], .1, .4, [x, 1.7, .88], s.mat.trim, .1, 'pressure-port'); }
  pipe(s, g[2], [[-.9, 1.35, 1.08], [.9, 1.35, 1.08], [1.3, 2.05, 1.08]], .065);
  gauge(s, g[2], [-.45, 2, .88], .12); gauge(s, g[2], [.45, 2, .88], .12);
  control(s, g[3], [1.5, 1.65, 0], .45, .7);
}
function largeCone(s, root, item, g) {
  cyl(s, g[0], 1.13, 1.55, [0, 4.05, 0], s.mat.steel, 1.13, 'large-cone-upper-shell', 32);
  cyl(s, g[0], 1.13, 2, [0, 2.3, 0], s.mat.steel, .2, 'large-cone-hopper', 32);
  ring(s, g[0], 1.15, [0, 4.8, 0]);
  legs(s, g[1], 2.9, 2.7, 4.05); rail(s, g[1], [-1.45, 1.35], [1.45, 1.35], 4.05, .85, s.mat.yellow);
  rail(s, g[1], [-1.45, -1.35], [-1.45, 1.35], 4.05, .85, s.mat.yellow);
  stairs(s, g[1], { x: 1.55, z: -1.25, rise: 4.05, run: 2.6, width: .65 });
  for (const x of [-.55, .55]) { cyl(s, g[2], .43, .22, [x, .45, 0], s.mat.trim, .43, 'cone-discharge-round-drive', 24); motor(s, g[2], [x, .68, .5], .18, .45); }
  pipe(s, g[3], [[0, 4.85, 0], [0, 5.6, 0], [-.8, 5.75, 0]], .16);
  gauge(s, g[3], [0, 3.1, 1.1]);
}
function fluidBed(s, root, item, g) {
  const shell = cyl(s, g[0], .83, 7, [0, 2.7, 0], s.mat.steel, .83, 'vf-horizontal-shell', 48); shell.rotation.z = PI / 2;
  // The SD shaft repair photograph shows rolled cover bays on the VF casing, with
  // segmented collars around the canvas connections. Their proportions are approximate.
  const finish = material(s, 'vf-cladding', 0xa9b1ae, { roughness: .38, metalness: .64 });
  const band = new THREE.CylinderGeometry(.847, .847, .075, 44, 1, true);
  band.rotateZ(PI / 2);
  repeated(s, g[0], band, [-3.44, -2.65, -1.1, .99, 2.7, 3.44].map(x => ({ position: [x, 2.7, 0] })), finish, 'vf-rolled-casing-bands');
  box(s, g[0], [6.8, .75, 1.3], [0, 2.05, 0], s.mat.steel, 'vf-lower-chamber');
  for (const x of [-2.1, 0, 2.1]) {
    const hatch = s._group(g[0], [x, 3.08, .735]);
    hatch.rotation.x = -.48;
    cyl(s, hatch, .28, .09, [0, 0, .035], s.mat.trim, .28, 'vf-large-inspection-port', 32).rotation.x = PI / 2;
    cyl(s, hatch, .251, .025, [0, 0, .089], finish, .251, 'vf-cover-face', 32).rotation.x = PI / 2;
    ring(s, hatch, .277, [0, 0, .093], finish, .018, 'z', 'vf-large-inspection-ring');
    for (const side of [-1, 1]) box(s, hatch, [.085, .058, .08], [side * .254, 0, .116], finish, 'vf-hatch-latch');
    bar(s, hatch, [-.25, 0, .16], [.25, 0, .16], .023, s.mat.trim, 'inspection-handle');
  }
  for (const x of [-2.95, 2.95]) cyl(s, g[0], .14, .09, [x, 2.45, .77], s.mat.trim, .14, 'vf-small-inspection-port', 20).rotation.x = PI / 2;
  deck(s, g[2], [[-3.95, .8], [3.95, .8], [3.95, 2], [-3.95, 2]], [], 1.4, 'vf-front-platform');
  legs(s, g[2], 7.5, 1.05, 1.4, [0, 0, 1.4]); rail(s, g[2], [-3.95, 2], [3.95, 2], 1.4);
  for (const x of [-3.35, 3.35]) stairs(s, g[2], { x, z: 2.05, rise: 1.4, run: 1.6, name: 'vf-end-access-stair' });
  const cuff = material(s, 'vf-flexible-connector', 0xd8dbcc, { roughness: .94, metalness: .015 });
  for (const x of [-1.2, 1, 2.65]) {
    pipe(s, g[3], [[x, 3.35, 0], [x, 5.15, 0], [x + .4, 5.7, 0]], .25, s.mat.steel, 'vf-upper-connection');
    cyl(s, g[3], .355, .25, [x, 3.68, 0], cuff, .355, 'vf-fabric-sleeve', 32);
    cyl(s, g[3], .25, .32, [x, 3.965, 0], finish, .355, 'vf-inlet-transition', 32);
    for (const y of [3.575, 3.783]) ring(s, g[3], .358, [x, y, 0], finish, .015);
  }
  cyl(s, g[1], 1, 1.3, [-2.75, 4.1, 0], s.mat.steel, .25, 'vf-inlet-cone', 32);
  for (const x of [-2, 2]) {
    const spring = tag(s._group(g[2], [x, 1.35, 0]), 'vf-spring-support');
    const turns = 4, coils = Array.from({ length: 65 }, (_, i) => {
      const angle = i / 64 * turns * 2 * PI;
      return new THREE.Vector3(.13 * Math.cos(angle), -.15 + .3 * i / 64, .13 * Math.sin(angle));
    });
    s._mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coils), 68, .024, 6, false), finish, spring);
    for (const y of [-.176, .176]) cyl(s, spring, .168, .035, [0, y, 0], s.mat.trim, .168, 'vf-spring-seat', 24);
    box(s, g[2], [.39, .16, .42], [x, 1.61, 0], finish, 'vf-upper-spring-bracket');
    legs(s, g[2], .5, .8, 1.15, [x, 0, 0]);
    motor(s, g[2], [x, .65, .65], .2, .55);
  }
}
function fineReturn(s, root, item, g) {
  vessel(s, g[0], g[1], g[2], { r: .8, base: .55, h: 2.5, mixer: false, ladder: true, name: 'fine-return-vertical-vessel' });
  pipe(s, g[1], [[0, 3.3, 0], [0, 5.5, 0], [-1.2, 5.5, 0]], .19, s.mat.steel, 'fine-return-upper-riser');
  pipe(s, g[2], [[0, .38, 0], [0, .38, .9], [-.9, .38, .9]], .11); gauge(s, g[2], [.4, 2, .66]);
}
function transferBin(s, root, item, g) {
  cyl(s, g[0], .75, 1.25, [0, 2.25, 0], s.mat.steel, .75, 'transfer-upper-shell');
  cyl(s, g[0], .75, 1.3, [0, 1, 0], s.mat.steel, .17, 'transfer-cone');
  legs(s, g[2], 1.8, 1.8, 1.7);
  bar(s, g[1], [-1.5, 3.5, 0], [0, 3.05, 0], .17, s.mat.steel, 'inclined-return-housing');
  motor(s, g[1], [-.8, 3.35, .3], .18, .45);
}

// Current 3F shapes come from the continuous walk, not the older OWP roles.
// These local proportions stay inside the reduced tower and deliberately leave
// the centre aisle free. Individual tags do not establish an OEM/function match.
function routeMotor(s, parent, position, radius = .17, length = .5, vertical = true) {
  const result = motor(s, parent, position, radius, length, vertical);
  const green = material(s, 'route-motor-green', 0x578c83);
  result.traverse(node => { if (['dryer-process-motor-body', 'dryer-process-terminal-box'].includes(node.name)) node.material = green; });
  return result;
}
function routeAccessStair(s, parent, { x, z, rise, run, width = .7, paint = s.mat.trim, yaw = PI }) {
  const root = tag(s._group(parent, [x, 0, z]), 'observed-service-stair'); root.rotation.y = yaw;
  const count = Math.ceil(rise / .18), tread = run / count;
  for (let i = 0; i < count; i++) box(s, root, [width, .05, tread + .025], [0, rise * (i + 1) / count - .025, (i + .5) * tread], s.mat.trim, 'observed-service-stair-tread');
  for (const side of [-1, 1]) {
    const xx = side * width / 2;
    bar(s, root, [xx, .05, 0], [xx, rise - .05, run], .045, s.mat.trim, 'observed-stair-stringer');
    for (const ratio of [0, .33, .67, 1]) bar(s, root, [xx, ratio * rise, ratio * run], [xx, ratio * rise + .95, ratio * run], .022, paint, 'observed-stair-post');
    bar(s, root, [xx, .95, 0], [xx, rise + .95, run], .026, paint, 'observed-stair-handrail');
  }
  Object.assign(root.userData, { localServicePlatform: true, buildingFloorAdded: false, stepCountRepresentative: count, rise, run });
  return root;
}
function thirdDetailFlange(s,parent,position,radius=.25,axis='y',name='observed-third-bolted-flange'){
  const root=tag(s._group(parent,position),name);
  if(axis==='x')root.rotation.z=PI/2;
  else if(axis==='z')root.rotation.x=PI/2;
  cyl(s,root,radius,.04,[0,0,0],s.mat.trim,radius,'observed-third-flange-ring',32);
  const poses=Array.from({length:8},(_,i)=>({position:[Math.cos(i*PI/4)*radius*.78,.035,Math.sin(i*PI/4)*radius*.78]}));
  repeated(s,root,new THREE.CylinderGeometry(.013,.013,.035,6),poses,s.mat.dark,'observed-third-flange-bolts');
  return root;
}
function thirdDetailChecker(s,parent,{minX,maxX,minZ,maxZ,y,holes=[]},name='observed-cip-checker-plate-relief'){
  const poses=[];
  for(let x=minX+.065;x<maxX-.06;x+=.16)for(let z=minZ+.065;z<maxZ-.06;z+=.16){
    if(holes.some(([hx,hz,r])=>Math.hypot(x-hx,z-hz)<r+.06))continue;
    poses.push({position:[x,y+.004,z],rotation:[0,(Math.round((x+z)*100)%2?1:-1)*PI/4,0]});
  }
  if(!poses.length)return null;
  const result=repeated(s,parent,new THREE.BoxGeometry(.075,.008,.018),poses,s.mat.trim,name);
  result.computeBoundingBox();result.computeBoundingSphere();
  Object.assign(result.userData,{reliefOnlyOnSolidPlate:true,tankOpeningsUncovered:true});return result;
}
function filmedLettering(s, parent, text, position, width, height, name, { background, color = '#172b2a', surface } = {}) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return;
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = Math.max(64, Math.round(canvas.width * height / width));
  const ctx = canvas.getContext?.('2d');
  if (!ctx) return;
  if (background) { ctx.fillStyle = background; ctx.fillRect(0, 0, canvas.width, canvas.height); }
  ctx.fillStyle = color;
  ctx.font = `600 ${canvas.height * .73}px "Malgun Gothic", sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2, canvas.width * .96);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; s.textures?.add(texture);
  const paint = new THREE.MeshBasicMaterial({ map: texture, transparent: !background, depthWrite: false });
  s.materials?.add(paint);
  tag(s._mesh(surface ? surface() : new THREE.PlaneGeometry(width, height), paint, parent, position), name);
}
function polishedThirdFloorSteel(s) {
  const key='third-floor-vessel-stainless', existing=s._dryerProcessMaterials?.get(key);
  if(existing) return existing;
  let reflection=s.scene?.environment;
  if(reflection?.image?.data && s.textures) {
    // The plain studio map has light only overhead. The filmed conical
    // undersides also reflect the green floor, light wall and steel posts.
    // Retain the existing ceiling lights and add those bands to a local copy.
    const {width,height,data}=reflection.image, local=new Uint8Array(data);
    const lightBand=(u,center,halfWidth) => 1-THREE.MathUtils.smoothstep(Math.abs(u-center),halfWidth*.45,halfWidth);
    for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
      const v=y/height, u=x/width, i=(y*width+x)*4;
      if(v<.08 || v>.85) continue;
      const wall=Math.max(lightBand(u,.115,.042),lightBand(u,.47,.058)*.86,lightBand(u,.752,.02)*.74);
      const post=Math.max(lightBand(u,.305,.009),lightBand(u,.615,.014)*.78);
      const band=Math.max(182*wall,211*post) * (.75+.25*Math.sin(v*Math.PI));
      local[i]=Math.max(local[i],band);
      local[i+1]=Math.max(local[i+1]+(v<.51?15:0),band);
      local[i+2]=Math.max(local[i+2]+(v<.51?6:0),band-4);
    }
    reflection=new THREE.DataTexture(local,width,height,THREE.RGBAFormat);
    reflection.mapping=THREE.EquirectangularReflectionMapping; reflection.colorSpace=THREE.SRGBColorSpace;
    reflection.minFilter=reflection.magFilter=THREE.LinearFilter; reflection.needsUpdate=true;
    s.textures.add(reflection);
  }
  return material(s,key,0xbfc6c4,{
    roughness:.27, metalness:.84, envMap:reflection??null, envMapIntensity:.92,
  });
}
function cipRailSign(s,parent,text,position){
  const width=.57, height=.19;
  const root=tag(s._group(parent,position),'observed-cip-upright-nameplate');root.rotation.y=PI/2;
  const blue=material(s,'third-cip-nameplate-blue',0x285e8d);
  box(s,root,[width,height,.015],[0,0,0],blue,'observed-cip-nameplate-frame');
  box(s,root,[width-.014,height-.034,.006],[0,.010,.010],s.mat.white,'observed-cip-nameplate-white-face');
  root.userData.text=text;root.userData.walk20261125Seconds=276;
  if (text==='CIP탱크(산)') root.userData.sourceSeconds=[648];
  filmedLettering(s,root,text,[0,.010,.015],width-.022,height-.038,'observed-cip-nameplate-text',{background:'#edf0e9'});
  return root;
}

// 01:23 and 02:04 show the lower sleeve, retaining rods, air cylinder
// and blue hoses at eye level. The arms run parallel to the covered tracks.
function hopperOutletMechanism(s, parent, z) {
  const direction = Math.sign(-z);
  const outlet = tag(s._group(parent, [0, 0, z]), 'observed-hopper-outlet-actuator');
  const blue = material(s, 'hopper-airline-blue', 0x207c9d);
  for (const yy of [.895, .988]) ring(s, outlet, .169, [0, yy, 0], s.mat.trim, .009);
  for (const x of [-.19,.19]) for (const offset of [-.13,.13]) {
    bar(s,outlet,[x,.845,offset],[x,1.055,offset],.011,s.mat.trim,'hopper-throat-tie-rod');
  }
  const along = value => value * direction;
  bar(s,outlet,[0,.81,along(.12)],[0,.81,along(.62)],.031,s.mat.trim,'hopper-air-cylinder-rod');
  box(s,outlet,[.12,.10,.28],[0,.81,along(.64)],s.mat.trim,'hopper-air-cylinder-body');
  for (const end of [.49,.79]) box(s,outlet,[.14,.12,.027],[0,.81,along(end)],s.mat.dark,'hopper-actuator-end-cap');
  bar(s,outlet,[-.12,.75,along(.18)],[-.12,.75,along(.76)],.018,s.mat.trim,'hopper-actuator-side-link');
  pipe(s,outlet,[[.065,.81,along(.72)],[.087,.76,along(.71)],[.10,.62,along(.67)],[.085,.65,along(.56)],[.065,.8,along(.52)]],.009,blue,'hopper-air-hose-loop');
}
function routeConeBank(s, root, item, g) {
  // #003 shows the lift opening and drive guard together. Correcting for
  // perspective puts the guard at roughly half the opening height. In #001
  // the service deck is about twice as high as the guard. #004 constrains
  // the transverse spacing of the support legs to about 0.70 × deck height.
  // The existing 2.2 m lift opening provides an approximate scale datum.
  const y = 2.42, guardHeight = 1.18, yellow = material(s, 'route-yellow-rails', 0xcaa63c);
  const centers = [-1.08, 1.08], shellRadius = .76, openingRadius = .81;
  const lowerRim = 1.01, upperRim = 2.69, lidTop = 2.83;
  const stainless = polishedThirdFloorSteel(s);
  for (const z of centers) {
    const cone = tag(s._group(g[0], [0, 0, z]), 'observed-conical-hopper');
    cyl(s, cone, shellRadius, y-lowerRim, [0,(y+lowerRim)/2,0], stainless,.16,'observed-hopper-conical-shell',48);
    cyl(s, cone, shellRadius, upperRim-y, [0,(upperRim+y)/2,0], stainless,shellRadius,'observed-hopper-upper-rim',48);
    cyl(s, cone, .19, lidTop-upperRim, [0,(lidTop+upperRim)/2,0], stainless,shellRadius,'observed-hopper-sloping-cover',48);
    for (const yy of [lowerRim,y,upperRim]) ring(s,cone,yy === lowerRim ? .17 : shellRadius+.007,[0,yy,0],s.mat.trim,.018);
    cyl(s,g[2],.16,.12,[0,.95,z],s.mat.black,.16,'observed-hopper-flexible-neck');
    cyl(s,g[2],.23,.085,[0,.86,z],s.mat.trim,.23,'observed-hopper-discharge-flange');
    box(s,g[2],[.46,.15,.31],[0,.75,z],s.mat.steel,'observed-hopper-discharge-assembly');
    // The two smaller diagonal tubes approach each other above the work
    // deck; the larger vertical sleeve on A is visible alongside them.
    const feedBase=[-.15,lidTop,z*.83], feedEnd=[.08,5.42,z*.16];
    const branch=bar(s,g[3],feedBase,feedEnd,.115,s.mat.steel,z<0?'observed-inclined-hopper-feed':'hopper-a-side-inlet');
    const start=new THREE.Vector3(...feedBase), end=new THREE.Vector3(...feedEnd);
    for(const t of [.08,.52,.66,.87]){
      const band=cyl(s,g[3],.132,.025,start.clone().lerp(end,t).toArray(),s.mat.trim,.132,'hopper-branch-joint');
      band.quaternion.copy(branch.quaternion);
    }
    const access=box(s,g[3],[.30,.25,.28],start.clone().lerp(end,.59).toArray(),s.mat.steel,'hopper-feed-inspection-casing');
    access.quaternion.copy(branch.quaternion);
    // Both signs face the stair side. At 02:28 the left sign identifies B
    // and the right sign visibly ends in A라인 beyond the diagonal tube.
    const sign=tag(s._group(cone,[0,y+.145,0]),'observed-silo-hopper-line-plate');
    sign.rotation.y=-PI/2;
    const signStrip=(offset,height)=>new THREE.CylinderGeometry(shellRadius+offset,shellRadius+offset,height,22,1,true,-.46,.92);
    tag(s._mesh(signStrip(.004,.175),s.mat.white,sign),'hopper-line-sign-sheet');
    sign.userData.text=z<0?'싸이로 호퍼 B라인':'싸이로 호퍼 A라인';
    filmedLettering(s,sign,sign.userData.text,[0,0,0],.68,.143,'hopper-line-marking',{background:'#f3f2e9',surface:()=>signStrip(.006,.143)});
    for (const [yy,paint] of [[-.077,s.mat.mint],[.077,s.mat.motor]]) tag(s._mesh(signStrip(.006,.009),paint,sign,[0,yy,0]),'hopper-label-colour-stripe');
    if(z>0){
      const flex=material(s,'third-hopper-cream-flexible-sleeve',0xded7a6,{roughness:.83,metalness:0});
      cyl(s,g[3],.29,.50,[0,lidTop+.25,z],flex,.29,'observed-hopper-wide-flexible-coupling');
      const rigidBase=lidTop+.5, rigidTop=5.53;
      cyl(s,g[3],.27,rigidTop-rigidBase,[0,(rigidBase+rigidTop)/2,z],s.mat.steel,.27,'observed-hopper-vertical-upper-riser');
      for(const yy of [lidTop,rigidBase])ring(s,g[3],.304,[0,yy,z],s.mat.trim,.02,'y','observed-hopper-flex-coupling-band');
      thirdDetailFlange(s,g[3],[0,rigidBase+.03,z],.31,'y','observed-hopper-upper-riser-flange');
    }
    const rotary=tag(s._group(g[2],[0,.75,z]),'observed-hopper-rotary-outlet-detail');
    cyl(s,rotary,.16,.36,[0,0,0],s.mat.steel,.16,'observed-hopper-rotary-outlet-body').rotation.z=PI/2;
    for(const x of [-.20,.20])thirdDetailFlange(s,rotary,[x,0,0],.19,'x','observed-hopper-rotary-side-flange');
    box(s,rotary,[.13,.20,.23],[.31,0,0],s.mat.steel,'observed-hopper-outlet-actuator-cover');
    hopperOutletMechanism(s,g[2],z);
    // The sensor seats on the sloping sheet in #004.
    const sensorY=1.36, localRadius=.16+(shellRadius-.16)*(sensorY-lowerRim)/(y-lowerRim);
    cyl(s,g[3],.055,.09,[localRadius+.012,sensorY,z],s.mat.mint,.055,'observed-hopper-side-sensor').rotation.z=PI/2;
    pipe(s,g[3],[[localRadius+.05,sensorY,z],[localRadius+.09,1.21,z],[.22,.86,z]],.011,s.mat.black,'observed-hopper-sensor-cable');
  }
  const halfWidth=1.05, halfLength=2.36, columnX=.86, columnZ=2.21;
  const outline=[[-halfWidth,-halfLength],[halfWidth,-halfLength],[halfWidth,halfLength],[-halfWidth,halfLength]];
  const holes=centers.map(z=>[0,z,openingRadius]);
  deck(s,g[1],outline,holes,y,'observed-hopper-common-platform');
  thirdDetailChecker(s,g[1],{minX:-halfWidth,maxX:halfWidth,minZ:-halfLength,maxZ:halfLength,y,holes},'observed-hopper-checker-plate-relief');
  legs(s,g[1],columnX*2,columnZ*2,y);
  for(const z of [-columnZ,0,columnZ])box(s,g[1],[2,.13,.10],[0,y-.14,z],s.mat.trim,'observed-hopper-platform-beam');
  for(const x of [-columnX,columnX])box(s,g[1],[.10,.16,4.51],[x,y-.17,0],s.mat.trim,'observed-hopper-underdeck-longitudinal-bearer');
  for(const side of [-1,1])for(const z of [-columnZ,columnZ])bar(s,g[1],[side*columnX,1.68,z],[side*.38,y-.21,z],.035,s.mat.trim,'observed-hopper-underdeck-knee-brace');
  // The transverse tie on each end frame sits just above the hopper throat.
  for(const z of [-columnZ,columnZ])box(s,g[1],[2*columnX,.07,.06],[0,lowerRim+.03,z],s.mat.trim,'observed-hopper-end-cross-tie');
  rail(s,g[1],[-halfWidth,-halfLength],[halfWidth,-halfLength],y,.95,yellow);
  rail(s,g[1],[halfWidth,-halfLength],[halfWidth,halfLength],y,.95,yellow);
  rail(s,g[1],[-halfWidth,halfLength],[halfWidth,halfLength],y,.95,yellow);
  // At 03:27 the foot of the yellow-railed stair is beside the two
  // return wheels and the connecting door. It climbs along the white wall.
  rail(s,g[1],[-halfWidth,-halfLength],[-halfWidth,-.91],y,.95,yellow);
  rail(s,g[1],[-halfWidth,-.19],[-halfWidth,halfLength],y,.95,yellow);
  box(s,g[1],[.76,.08,.72],[-1.40,y-.04,-.55],s.mat.trim,'observed-hopper-stair-landing');
  rail(s,g[1],[-1.78,-.19],[-halfWidth,-.19],y,.95,yellow);
  routeAccessStair(s,g[1],{x:-1.40,z:-2.80,rise:y,run:2.25,width:.63,paint:yellow,yaw:0});
  const platformPaint = material(s,'disc-hopper-frame-ivory',0xd1c8ae,{roughness:.64,metalness:.1});
  g[1].traverse(node=>{
    if(node.isMesh && node.material===s.mat.trim && !node.name.includes('checker')) node.material=platformPaint;
  });
  // Both hoppers lie over the same bank in the two end views (#002, #004).
  // The drive-end walk-up (#003) shows four removable covers and two return wheels.
  const line = tag(s._group(g[2]), 'disc-conveyor-pair');
  line.rotation.y = -PI / 2;
  const driveX=6, returnX=-2.55, deckWidth=1.34;
  const driveCenters=[-.34,.34];
  const blue=material(s,'disc-coupling-blue',0x1f58a8,{roughness:.38,metalness:.26});
  const motorColors=[material(s,'disc-gearmotor-ochre',0xb49658,{roughness:.42,metalness:.46}),material(s,'disc-gearmotor-brown',0x9a7d4a,{roughness:.44,metalness:.44})];
  for(const [i,z] of driveCenters.entries()){
    const drive=tag(s._group(line,[driveX,0,z]),'observed-vertical-motor-housing');
    cyl(s,drive,.307,.11,[0,.478,0],s.mat.steel,.313,'disc-drive-wheel-cover',40);
    ring(s,drive,.308,[0,.434,0],s.mat.trim,.011,'y','disc-cover-rolled-seam');
    cyl(s,drive,.154,.13,[0,.594,0],s.mat.steel,.188,'observed-round-drive-housing');
    cyl(s,drive,.125,.135,[0,.722,0],blue,.147,'observed-drive-coupling');
    thirdDetailFlange(s,drive,[0,.663,0],.17,'y','observed-round-drive-coupling-flange');
    const gearmotor=routeMotor(s,drive,[0,.913,0],.118,.25);
    gearmotor.traverse(n=>{if(n.isMesh)n.material=motorColors[i];});
    cyl(s,drive,.12,.045,[0,1.052,0],motorColors[i],.12,'observed-round-drive-motor-fan-cap');
    for(const side of [-1,1])box(s,drive,[.022,.12,.05],[side*.119,.73,0],blue,'observed-round-drive-fixed-side-guard');
    pipe(s,drive,[[.09,.95,.055],[.19,.78,.12],[.21,.35,.16],[.13,.18,.16],[-.08,.23,.11]],.013,s.mat.black,'drive-looped-cable');
    const rear=tag(s._group(line,[returnX,0,z]),'disc-return-station');
    cyl(s,rear,.288,.09,[0,.47,0],s.mat.steel,.292,'disc-return-wheel-cover',40);
    cyl(s,rear,.085,.08,[0,.555,0],s.mat.trim,.085,'disc-return-bearing');
    box(s,rear,[.24,.08,.20],[0,.63,0],s.mat.steel,'disc-return-bearing-block');
    const brace = box(s,rear,[.40,.046,.09],[.10,.71,0],s.mat.trim,'disc-return-bearing-strap');
    brace.rotation.z=.16;
    ring(s,rear,.291,[0,.435,0],s.mat.trim,.011,'y','disc-return-cover-rolled-rim');
    box(s,rear,[.10,.026,.032],[-.25,.44,.15],s.mat.trim,'disc-return-cover-latch');
  }
  // In the front photograph #002 the three main posts reach the floor;
  // shorter uprights over the circular covers carry the beacons.
  const guardX=driveX-.24;
  for(const z of [-deckWidth/2,0,deckWidth/2]){
    box(s,line,[.04,guardHeight,.04],[guardX,guardHeight/2,z],s.mat.trim,'observed-drive-frame-upright');
    box(s,line,[.11,.025,.11],[guardX,.0125,z],s.mat.trim,'disc-guard-foot');
  }
  box(s,line,[.045,.042,deckWidth],[guardX,guardHeight,0],s.mat.trim,'paired-drive-guard-crossbar');
  for(const z of driveCenters){
    const bracketX=driveX+.20;
    box(s,line,[.04,guardHeight-.53,.04],[bracketX,(guardHeight+.53)/2,z],s.mat.trim,'observed-drive-frame-upright');
    box(s,line,[bracketX-guardX,.042,.04],[(guardX+bracketX)/2,guardHeight,z],s.mat.trim,'observed-drive-frame-head');
    cyl(s,line,.064,.028,[bracketX,guardHeight+.035,z],s.mat.black,.07,'disc-beacon-socket');
    cyl(s,line,.054,.105,[bracketX,guardHeight+.10,z],s.mat.red,.063,'observed-drive-red-beacon');
  }
  const tracks=[-.56,-.12,.12,.56];
  const span=driveX-returnX,mid=(driveX+returnX)/2,pieces=7;
  for(const z of tracks){
    const trough=tag(s._group(line,[mid,0,z]),'observed-covered-transfer-trough');
    box(s,trough,[span,.103,.144],[0,.503,0],s.mat.steel,'observed-covered-trough-body');
    const covers=tag(s._group(trough),'observed-covered-trough-lid');
    for(let i=0;i<pieces;i++){
      const x=-span/2+(i+.5)*span/pieces;
      box(s,covers,[span/pieces-.014,.021,.164],[x,.57,0],s.mat.steel,'observed-trough-removable-cover');
      for(const side of [-1,1])box(s,trough,[.032,.082,.017],[x-.37,.534,side*.086],s.mat.trim,'observed-trough-cover-clamp');
    }
    for(const side of [-1,1])box(s,trough,[span,.034,.014],[0,.557,side*.083],s.mat.trim,'observed-trough-folded-lid-edge');
    for(const x of [-1.12,1.65,4.38]) {
      box(s,line,[.063,.43,.049],[x,.215,z],s.mat.trim,'observed-trough-support');
      box(s,line,[.15,.023,.14],[x,.0115,z],s.mat.steel,'disc-trough-anchor');
    }
  }
  for(const x of [.9,4.92])for(const z of [-.56,.56]){
    box(s,line,[.70,.065,.47],[x,.035,z],s.mat.steel,'transfer-outlet-floor-shoe');
    cyl(s,line,.107,.09,[x,.115,z],s.mat.trim,.107,'transfer-outlet-collar');
    cyl(s,line,.215,.264,[x,.291,z],s.mat.steel,.109,'transfer-collecting-cone',24);
    ring(s,line,.124,[x,.17,z],s.mat.trim,.012,'y','transfer-boot-clamp');
  }
  for(const x of [returnX-.38,returnX+.35]){
    box(s,line,[.038,.038,1.30],[x,.74,0],s.mat.trim,'disc-rear-frame-web');
    for(const z of [-.64,.64]) box(s,line,[.047,.76,.047],[x,.38,z],s.mat.trim,'disc-rear-frame-leg');
  }
  for(const z of [-.64,.64])box(s,line,[.78,.04,.04],[returnX,.76,z],s.mat.trim,'disc-return-end-frame');
  // Card 13: local control box on front post + translucent powder sock on right vertical tube + blue ceiling hopper cone
  box(s, g[1], [.24, .34, .16], [-.96, 1.32, 0], s.mat.white, 'hopper-post-control-box');
  const sockMat = material(s, 'hopper-sample-vinyl', 0xf3f2e4, { transparent: true, opacity: .72, roughness: .45, depthWrite: false });
  cyl(s, g[3], .11, .52, [-.52, 1.48, .85], sockMat, .07, 'hopper-side-vinyl-sock', 18);
  cyl(s, g[3], .12, 1.35, [-.52, 2.40, .85], stainless, .12, 'hopper-side-drop-tube', 20);
  cyl(s, g[3], .44, .22, [0, 4.92, 1.08], blue, .28, 'hopper-ceiling-blue-collar', 28);
  Object.assign(root.userData, { observedConicalHoppers: 2, observedVerticalMotorHousings: 2, observedCoveredTransferTroughs: tracks.length, localPlatformElevation: y, guardHeight, supportWidth: 2*columnX, scaleBasis: 'four-view photo ratios; 2.2 m existing elevator opening reference; not field measured',
    transferPhotoReferences: ['20261124_134536.jpg','20261124_134544.jpg','20261124_134555.jpg','20261124_134612.jpg'],
    walk20261125: {seconds:[83,85,115,124,145,148], observedHopperLines:['B','A']} });
}
// Vertical run marks on site-worn vessels (cards 19, 21, 22). The streaks are one
// transparent sleeve, not separate slivers.
function dripSkin(s, parent, { r, y0, y1, tint = [96, 66, 40], count = 26, strength = .5, seed = 7, position = [0, 0, 0], name = 'run-mark-sleeve' }) {
  const store = s._dripTextures ||= new Map(), key = `${tint}:${count}:${strength}:${seed}`;
  if (!store.has(key)) {
    const w = 256, h = 64, data = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i++) { data[i * 4] = tint[0]; data[i * 4 + 1] = tint[1]; data[i * 4 + 2] = tint[2]; }
    let state = seed * 7919 + 13;
    const next = () => { state = (state * 16807) % 2147483647; return state / 2147483647; };
    for (let k = 0; k < count; k++) {
      const x = Math.floor(next() * w), top = h - 1 - Math.floor(next() * h * .22), length = h * (.2 + next() * .75), width = next() > .78 ? 2 : 1, gain = strength * (.4 + next() * .6);
      for (let dy = 0; dy < length && top - dy >= 0; dy++) for (let dx = 0; dx < width; dx++) {
        const i = ((top - dy) * w + (x + dx) % w) * 4 + 3;
        data[i] = Math.max(data[i], 255 * gain * Math.min(1, dy / 4) * (1 - (dy / length) ** 2));
      }
    }
    const map = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
    map.colorSpace = THREE.SRGBColorSpace; map.wrapS = THREE.RepeatWrapping; map.magFilter = map.minFilter = THREE.LinearFilter; map.needsUpdate = true;
    s.textures?.add(map);
    store.set(key, material(s, `run-marks:${key}`, 0xffffff, { map, transparent: true, depthWrite: false, roughness: .74, metalness: .08 }));
  }
  const node = tag(s._mesh(new THREE.CylinderGeometry(r, r, y1 - y0, 40, 1, true), store.get(key), parent, [position[0], (y0 + y1) / 2, position[2]]), name);
  node.castShadow = false; return node;
}
// Straight lagged lines with ball elbows and clamp bands (card 18 rear).
function laggedLine(s, parent, points, radius, paint, name) {
  for (let i = 1; i < points.length; i++) {
    bar(s, parent, points[i - 1], points[i], radius, paint, name);
    if (i < points.length - 1) tag(s._mesh(new THREE.SphereGeometry(radius * 1.02, 16, 12), paint, parent, points[i]), `${name}-elbow`);
    const a = new THREE.Vector3(...points[i - 1]), b = new THREE.Vector3(...points[i]), length = a.distanceTo(b), direction = b.clone().sub(a).normalize();
    for (let d = .2; d < length - .1; d += .46) {
      const c = a.clone().addScaledVector(direction, d), band = cyl(s, parent, radius * 1.03, .016, c.toArray(), s.mat.trim, radius * 1.03, `${name}-band`, 20);
      band.quaternion.setFromUnitVectors(UP, direction);
    }
  }
}
function plateExchanger(s, parent, x, label) {
  const stainless = polishedThirdFloorSteel(s), core = material(s, 'plate-skid-dark-laminations', 0x3b4645, { roughness: .42, metalness: .6 });
  const orange = material(s, 'third-phe-orange-tag', 0xd97828, { roughness: .55, metalness: .12 }), blue = material(s, 'third-phe-valve-blue', 0x1a5cb8, { roughness: .38, metalness: .22 });
  const frame = tag(s._group(parent, [x, 0, 0]), 'observed-plate-pack-frame');
  for (const z of [-.46, .03]) box(s, frame, [.46, 1.08, .044], [0, .72, z], stainless, 'observed-stainless-plate-housing');
  box(s, frame, [.35, .90, .44], [0, .72, -.215], core, 'plate-skid-laminated-core');
  repeated(s, frame, new THREE.BoxGeometry(.372, .93, .006), Array.from({ length: 27 }, (_, i) => ({ position: [0, .72, -.428 + i * .0165] })), s.mat.trim, 'observed-plate-stack-edge');
  for (const xx of [-.16, .16]) { box(s, frame, [.07, .2, .05], [xx, .1, -.46], stainless, 'observed-plate-frame-upright'); box(s, frame, [.13, .018, .15], [xx, .009, -.46], s.mat.trim, 'plate-skid-foot'); }
  // Carrying bar, guide bar and the separate end column that stands in the aisle.
  bar(s, frame, [0, 1.285, -.48], [0, 1.285, .80], .025, stainless, 'plate-carrying-bar');
  bar(s, frame, [0, .235, -.48], [0, .235, .80], .019, stainless, 'plate-guide-bar');
  box(s, frame, [.11, .07, .05], [0, 1.275, .03], stainless, 'plate-follower-hanger');
  box(s, frame, [.15, 1.34, .04], [0, .67, .80], stainless, 'plate-end-column');
  box(s, frame, [.2, .018, .17], [0, .009, .83], s.mat.trim, 'plate-end-column-foot');
  for (const xx of [-.07, .07]) cyl(s, frame, .013, .03, [xx, .032, .86], s.mat.dark, .013, 'plate-foot-anchor', 8);
  const rods = [], nuts = [];
  for (const xx of [-.207, .207]) for (const y of [.31, .58, .86, 1.13]) {
    rods.push({ position: [xx, y, -.11], rotation: [PI / 2, 0, 0] });
    for (const z of [-.50, .075]) nuts.push({ position: [xx, y, z], rotation: [PI / 2, 0, 0] });
  }
  repeated(s, frame, new THREE.CylinderGeometry(.0135, .0135, .86, 10), rods, s.mat.trim, 'plate-skid-through-rod');
  repeated(s, frame, new THREE.CylinderGeometry(.026, .026, .03, 6), nuts, s.mat.trim, 'phe-tie-nut');
  box(s, frame, [.22, .085, .006], [0, 1.16, .056], orange, 'phe-orange-tag');
  filmedLettering(s, frame, '열교환기', [0, 1.16, .0605], .2, .075, 'phe-orange-tag-text', { background: '#d97828', color: '#2b1c10' });
  const sign = s._group(frame, [0, 1.06, .826]);
  box(s, sign, [.40, .17, .008], [0, 0, 0], s.mat.white, 'phe-hanging-sign');
  box(s, sign, [.40, .022, .004], [0, -.072, .005], blue, 'phe-sign-blue-band');
  filmedLettering(s, sign, label, [0, .012, .0065], .385, .115, 'phe-sign-text', { background: '#f4f6f2' });
  return frame;
}
function routeServiceSkid(s, root, item, g) {
  // Card 18. The window bay reads north to south: hot-water tank, plate exchangers
  // 2 and 1, then the agitator tank of card 20 (its own catalog item).
  const stainless = polishedThirdFloorSteel(s);
  const silverWrap = material(s, 'third-phe-silver-insulation', 0xb9c0c3, { roughness: .34, metalness: .78 });
  const valveBlue = material(s, 'third-phe-valve-blue', 0x1a5cb8, { roughness: .38, metalness: .22 });
  const green = material(s, 'route-pump-green', 0x1f8a62, { roughness: .42, metalness: .28 });
  plateExchanger(s, g[0], -.92, 'SD 살균기 1호기(HC)');
  plateExchanger(s, g[0], -.08, 'SD 살균기 2호기(HC)');
  const valve = (x, y, z, axis = 'y') => {
    const body = cyl(s, g[2], .062, .05, [x, y, z], s.mat.trim, .062, 'phe-butterfly-body', 16);
    if (axis === 'x') body.rotation.z = PI / 2; if (axis === 'z') body.rotation.x = PI / 2;
    box(s, g[2], [.022, .022, .07], [x, y + .075, z], s.mat.dark, 'phe-valve-neck');
    box(s, g[2], [.2, .022, .032], [x + .09, y + .115, z], valveBlue, 'phe-blue-valve-lever').rotation.z = .16;
  };
  for (const x of [-.92, -.08]) {
    laggedLine(s, g[1], [[x - .1, 1.06, -.49], [x - .1, 1.06, -.86], [x - .1, 2.12, -.86]], .062, silverWrap, 'phe-silver-riser');
    laggedLine(s, g[1], [[x + .1, .40, -.49], [x + .1, .40, -.92], [x + .1, .14, -.92]], .062, silverWrap, 'phe-silver-low');
    valve(x - .1, 1.06, -.60, 'z'); valve(x + .1, .40, -.60, 'z'); valve(x - .1, 1.36, -.86);
  }
  laggedLine(s, g[1], [[-1.02, 2.12, -.86], [-.18, 2.12, -.86]], .062, silverWrap, 'phe-silver-upper-bridge');
  laggedLine(s, g[1], [[-.18, 2.12, -.86], [-.18, 3.05, -.86]], .07, silverWrap, 'phe-silver-main-riser');
  laggedLine(s, g[1], [[-.82, .14, -.92], [.52, .14, -.92], [.52, .14, -.2]], .06, silverWrap, 'phe-silver-floor-header');
  laggedLine(s, g[1], [[-.55, .98, -.52], [-.55, .98, -.84], [.42, .98, -.84], [.42, .30, -.84]], .07, silverWrap, 'phe-silver-mid-header');
  for (const x of [-1.02, -.18]) {
    bar(s, g[2], [x, 2.16, -.86], [x, 2.30, -.86], .012, s.mat.trim, 'plate-skid-dial-stem');
    gauge(s, g[2], [x, 2.38, -.84], .075);
  }
  // Green vertical multistage pump north of exchanger 2.
  box(s, g[1], [.34, .06, .36], [.52, .03, -.02], s.mat.trim, 'observed-vertical-pump-base');
  cyl(s, g[1], .1, .62, [.52, .37, -.02], stainless, .1, 'observed-vertical-pump-stack', 24);
  cyl(s, g[1], .13, .04, [.52, .70, -.02], s.mat.trim, .13, 'observed-vertical-pump-lantern', 24);
  cyl(s, g[1], .145, .36, [.52, .91, -.02], green, .145, 'observed-green-vertical-pump-motor', 24);
  repeated(s, g[1], new THREE.BoxGeometry(.012, .28, .026), Array.from({ length: 16 }, (_, i) => ({ position: [.52 + Math.cos(i * PI / 8) * .148, .89, -.02 + Math.sin(i * PI / 8) * .148], rotation: [0, -i * PI / 8 + PI / 2, 0] })), green, 'vertical-pump-motor-fin');
  cyl(s, g[1], .15, .05, [.52, 1.115, -.02], green, .13, 'vertical-pump-fan-cover', 24);
  box(s, g[1], [.12, .12, .1], [.52, .94, .17], green, 'vertical-pump-terminal-box');

  laggedLine(s, g[2], [[-1.35, 1.52, -.96], [.5, 1.52, -.96]], .05, silverWrap, 'phe-long-silver-pipe');
  root.userData.walk20261125 = { seconds: [258, 261, 264], observedPlateFrames: 2, cardNumbers: [18] };
}

function agitatorTank(s, root, g) {
  const stainless = polishedThirdFloorSteel(s), silverWrap = material(s, 'third-phe-silver-insulation', 0xb9c0c3, { roughness: .34, metalness: .78 });
  // Card 20: polished two-step jacket, four legs, agitator in an open lantern.
  const tank = tag(s._group(g[0], [0, 0, 0]), 'card20-double-insulated-agitator-tank');
  const profile = [[.02, .50], [.34, .52], [.58, .575], [.71, .66], [.765, .78], [.78, .92], [.78, 2.10], [.772, 2.15], [.735, 2.19], [.675, 2.20], [.655, 2.23], [.65, 2.27], [.65, 2.55], [.63, 2.65], [.56, 2.735], [.36, 2.80], [.02, 2.83]];
  tag(s._mesh(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 56), stainless, tank), 'card20-outer-jacket');
  for (const y of [.9, 2.08]) ring(s, tank, .782, [0, y, 0], s.mat.trim, .007, 'y', 'card20-jacket-weld');
  for (let i = 0; i < 4; i++) {
    const a = (i + .5) * PI / 2, lx = Math.cos(a) * .58, lz = Math.sin(a) * .58;
    cyl(s, tank, .055, .62, [lx, .33, lz], stainless, .055, 'card20-tubular-leg', 18);
    cyl(s, tank, .05, .05, [lx, .05, lz], s.mat.trim, .09, 'card20-leg-taper', 18);
    cyl(s, tank, .10, .025, [lx, .0125, lz], s.mat.trim, .10, 'card20-leg-pad', 20);
  }
  cyl(s, tank, .20, .03, [0, 2.85, 0], s.mat.trim, .20, 'card20-agitator-flange', 28);
  for (const [sx, sz] of [[-.11, -.11], [.11, -.11], [-.11, .11], [.11, .11]]) bar(s, tank, [sx, 2.86, sz], [sx, 3.12, sz], .016, s.mat.trim, 'card20-agitator-lantern');
  cyl(s, tank, .025, .28, [0, 2.99, 0], s.mat.trim, .025, 'card20-agitator-shaft', 12);
  cyl(s, tank, .17, .03, [0, 3.135, 0], s.mat.trim, .17, 'card20-lantern-plate', 24);
  cyl(s, tank, .12, .13, [0, 3.215, 0], s.mat.dark, .14, 'card20-agitator-gearbox', 24);
  cyl(s, tank, .105, .25, [0, 3.405, 0], s.mat.black, .105, 'card20-agitator-motor', 24);
  cyl(s, tank, .112, .05, [0, 3.555, 0], s.mat.black, .10, 'card20-agitator-fan-cover', 24);
  for (const [a, y] of [[.75, 2.38], [2.3, 2.45]]) {
    const n = [Math.cos(a), Math.sin(a)], at = d => [n[0] * d, y, n[1] * d];
    bar(s, tank, at(.64), at(.79), .035, stainless, 'card20-upper-nozzle');
    const flange = cyl(s, tank, .085, .025, at(.79), s.mat.trim, .085, 'card20-upper-nozzle-flange', 20); flange.quaternion.setFromUnitVectors(UP, new THREE.Vector3(n[0], 0, n[1]));
  }
  const manway = s._group(tank, [.66, 1.02, .36]); manway.rotation.y = PI / 2 - .5;
  cyl(s, manway, .12, .07, [0, 0, .06], stainless, .12, 'card20-side-manway', 24).rotation.x = PI / 2;
  gauge(s, manway, [.17, .04, .06], .06);
  for (const [x, z] of [[.32, .1], [-.3, -.14]]) { bar(s, tank, [x, 2.78, z], [x, 3.02, z], .022, stainless, 'card20-top-nozzle'); cyl(s, tank, .06, .02, [x, 3.02, z], s.mat.trim, .06, 'card20-top-nozzle-cap', 18); }
  laggedLine(s, g[2], [[-.95, 1.52, -.98], [.95, 1.52, -.98]], .05, silverWrap, 'card20-long-silver-pipe');
  laggedLine(s, g[2], [[0, .48, 0], [0, .20, 0], [0, .20, -.98], [.95, .20, -.98]], .05, stainless, 'card20-bottom-outlet');
  Object.assign(root.userData, { fieldCardVerified20261124: true, cardNumbers: [20], planPositionMeasured: false, modelDimensionsMeasured: false });
}

function frontControlUnits(s, parent) {
  // 03:35 through the connecting door, then the reverse close-up at 04:42:
  // a narrow freestanding HMI is left of a recessed, orange-striped unit.
  const hmi=tag(s._group(parent,[-1.11,0,1.03]),'walk-process-left-hmi');
  box(s,hmi,[.65,1.61,.50],[0,.93,0],s.mat.steel,'hmi-floor-cabinet');
  box(s,hmi,[.69,.08,.53],[0,.12,0],s.mat.trim,'hmi-skirting');
  box(s,hmi,[.36,.28,.022],[0,1.31,.256],s.mat.dark,'hmi-black-bezel');
  const lit=material(s,'third-process-pale-hmi',0xc1d1d0,{emissive:0xc2d9dd,emissiveIntensity:.5,roughness:.4});
  box(s,hmi,[.29,.22,.016],[0,1.31,.273],lit,'hmi-bright-face');
  box(s,hmi,[.27,.14,.014],[0,.89,.261],s.mat.white,'hmi-posted-sheet');
  for(const [x,paint] of [[-.11,s.mat.red],[.11,s.mat.white]]) {
    cyl(s,hmi,.017,.018,[x,1.09,.269],paint,.017,'hmi-selector').rotation.x=PI/2;
  }
  const skid=tag(s._group(parent,[-.085,0,.22]),'walk-process-orange-banded-unit');
  const orange=material(s,'third-process-orange-bands',0xc76b29,{roughness:.48});
  box(s,skid,[1.21,1.38,.60],[0,.83,0],s.mat.steel,'orange-unit-body');
  for(const [y,height] of [[.82,.052],[.91,.046],[1.50,.034]]) {
    box(s,skid,[1.215,height,.013],[0,y,.307],orange,'orange-unit-front-band');
  }
  filmedLettering(s,skid,'GEA',[.16,1.35,.316],.18,.08,'orange-unit-maker-mark');
  box(s,skid,[.19,.21,.028],[.45,1.30,.319],orange,'orange-unit-local-indicators');
  for(const y of [1.32,1.39]) cyl(s,skid,.023,.021,[.47,y,.343],s.mat.mint,.023,'orange-unit-pilot-lamp').rotation.x=PI/2;
  box(s,skid,[.95,.21,.23],[0,.66,.43],s.mat.trim,'orange-unit-valve-bank');
  for(const x of [-.34,-.12,.12,.34]) {
    cyl(s,skid,.050,.096,[x,.80,.42],s.mat.steel,.050,'orange-unit-valve-cap');
    cyl(s,skid,.057,.08,[x,.64,.58],s.mat.trim,.057,'orange-unit-forward-plug').rotation.x=PI/2;
  }
  for(const x of [-.24,.21]) gauge(s,skid,[x,.90,.43],.062);
  const cap=cyl(s,skid,.13,.19,[-.34,.65,.59],s.mat.steel,.13,'orange-unit-round-port'); cap.rotation.x=PI/2;
  cyl(s,skid,.113,.012,[-.34,.65,.691],s.mat.black,.113,'orange-unit-black-face').rotation.x=PI/2;
  pipe(s,skid,[[-.53,.74,.39],[-.53,.54,.54],[-.49,.49,.67],[.48,.49,.67],[.54,.55,.60],[.54,.74,.39]],.019,s.mat.trim,'orange-unit-front-tube');
  skid.userData.observedMark='GEA';
}
function routeDriveFrame(s, root, item, g) {
  legs(s, g[0], 2.6, 1.8, 1.8);
  for (const z of [-.9, .9]) box(s, g[0], [2.8, .12, .12], [0, 1.8, z], s.mat.trim, 'observed-drive-frame-beam');
  box(s, g[0], [2.8, .08, 1.9], [0, 1.88, 0], s.mat.dark, 'observed-drive-frame-top');
  routeMotor(s, g[1], [-.4, .5, -.52], .28, .75, false);
  box(s, g[1], [.25, .65, .65], [.17, .45, -.52], s.mat.yellow, 'observed-yellow-drive-guard');
  box(s, g[1], [.75, .45, .65], [.65, .45, -.52], s.mat.steel, 'observed-drive-lower-housing');
  frontControlUnits(s,g[2]);
  const cabinet = tag(s._group(g[2], [1.16,1.14,.79]), 'observed-stainless-control-cabinet');
  cabinet.rotation.y=-PI/2;
  const finish=material(s,'gea-cabinet-brushed-gray',0xc7c9bd,{roughness:.34,metalness:.58,envMap:s.scene?.environment??null,envMapIntensity:1.35});
  box(s,cabinet,[1.44,2.04,.52],[0,0,0],finish,'observed-control-cabinet-shell');
  box(s,cabinet,[1.42,.105,.49],[0,-1.055,0],s.mat.trim,'drive-cabinet-kickplate');
  box(s,cabinet,[.009,1.98,.009],[-.12,.01,.263],s.mat.dark,'drive-cabinet-door-reveal');
  filmedLettering(s,cabinet,'GEA',[-.495,.82,.266],.37,.15,'drive-cabinet-maker-mark');
  box(s,cabinet,[.13,.093,.015],[-.46,.28,.27],s.mat.dark,'drive-hmi-bezel');
  box(s,cabinet,[.105,.066,.014],[-.46,.28,.282],s.mat.screen,'observed-control-monitor');
  for(const [idx,x] of [-.52,-.46,-.40].entries()) {
    cyl(s,cabinet,.018,.017,[x,.045,.284],[s.mat.red,s.mat.white,s.mat.mint][idx],.018,'observed-control-button').rotation.x=PI/2;
  }
  cyl(s,cabinet,.064,.02,[-.46,-.07,.274],s.mat.yellow,.064,'drive-stop-collar').rotation.x=PI/2;
  cyl(s,cabinet,.041,.039,[-.46,-.07,.303],s.mat.red,.041,'observed-control-emergency-stop').rotation.x=PI/2;
  box(s,cabinet,[.029,.25,.036],[-.085,-.10,.29],s.mat.trim,'drive-cabinet-door-pull');
  // The two narrow raised vents on the end panel face the doorway.
  for(const y of [-.64,.66]) box(s,cabinet,[.021,.078,.31],[.728,y,0],finish,'drive-cabinet-end-vent');
  for (const [x,y,size] of [[-.46,.15,.093],[.25,.07,.13]]) {
    if (x>0) box(s,cabinet,[.29,.22,.009],[x,y,.266],s.mat.white,'drive-warning-plate');
    const warning=new THREE.Shape([new THREE.Vector2(-size*.68,-size*.47),new THREE.Vector2(size*.68,-size*.47),new THREE.Vector2(0,size*.64)]);
    tag(s._mesh(new THREE.ShapeGeometry(warning),s.mat.yellow,cabinet,[x,y,.276]),'drive-cabinet-warning-symbol');
  }
  // The 04:41–04:47 pass shows bare steel rails overhead and a horizontal
  // cylindrical fitting behind the panel, under the service platform.
  rail(s,g[0],[-1.36,-.89],[1.36,-.89],1.92,.85);
  rail(s,g[0],[-1.36,-.89],[-1.36,.86],1.92,.85);
  const barrel=cyl(s,g[3],.16,.52,[-.61,.83,-.17],s.mat.steel,.16,'drive-skid-inline-cylinder');
  barrel.rotation.z=PI/2;
  bar(s,g[3],[-1.23,.83,-.17],[-.87,.83,-.17],.055,s.mat.trim,'drive-inline-pipe');
  bar(s,g[3],[-.35,.83,-.17],[.25,.83,-.17],.055,s.mat.trim,'drive-inline-pipe');
  for (const x of [-1.13,-.82]) {
    pipe(s,g[3],[[x,.29,.35],[x,.64,.35],[x,.85,.23],[x,1.43,.23],[x,1.50,-.20]],.033,s.mat.trim,'drive-visible-vertical-return');
  }
  pipe(s, g[3], [[-1.2, .3, -.8], [.9, .3, -.8], [.9, .7, -.8]], .07, s.mat.trim, 'observed-drive-visible-pipe');
  cabinet.userData.observedMark='GEA';
  root.userData.walk20261125={seconds:[215,278,281,282,284,287], visibleCabinetMark:'GEA',equipmentModelConfirmed:false};
}
// The camera rounds the white partition at 03:40 and again at 04:05.
// The ribbed rectangular casing and the two low units stand alongside
// the tall cylinder. Connections hidden behind the housings stop there.
function cylinderSideEquipment(s, parent) {
  // Card 17. Against the window: stepped hot-water box, then the low tank with
  // four lids in the partition corner. Two pumps stand on the room side.
  const stainless = polishedThirdFloorSteel(s);
  const footBlue = material(s, 'card17-foot-blue', 0x2264ad, { roughness: .52 });
  const pumpGray = material(s, 'card17-pump-gray', 0x5c6467, { roughness: .46, metalness: .42 });
  const group = tag(s._group(parent, [.78, 0, 1.82]), 'observed-rectangular-tank-and-low-pumps');
  const w = 1.14, d = .80, body = tag(s._group(group), 'ribbed-rectangular-tank');
  for (const [tier, [ty, th, grow]] of [[.295, .30, 0], [.595, .30, .025], [.885, .28, .05], [1.145, .24, .075]].entries()) {
    box(s, body, [d + grow, th, w + grow], [0, ty, 0], stainless, `steptier-casing-${tier}`);
    if (tier < 3) box(s, body, [d + grow + .075, .045, w + grow + .075], [0, ty + th / 2, 0], stainless, 'rectangular-tank-side-rib');
  }
  box(s, body, [d + .15, .03, w + .15], [0, .15, 0], stainless, 'rectangular-tank-side-rib');
  for (const x of [-.3, .3]) for (const z of [-.45, .45]) {
    box(s, body, [.08, .12, .08], [x, .085, z], s.mat.trim, 'rectangular-tank-foot');
    cyl(s, body, .075, .03, [x, .015, z], footBlue, .085, 'tank-foot-pad', 16);
  }
  for (const z of [-.29, .29]) {
    box(s, body, [d + .04, .022, .56], [0, 1.276, z], stainless, 'rectangular-tank-top-cover');
    pipe(s, body, [[0, 1.285, z - .1], [0, 1.345, z - .1], [0, 1.345, z + .1], [0, 1.285, z + .1]], .010, s.mat.trim, 'tank-lid-handle');
  }
  const dial = s._group(body, [-.415, .40, -.1]); dial.rotation.y = -PI / 2; gauge(s, dial, [0, 0, .02], .055); tag(dial.children[0], 'card17-box-dial');
  const low = tag(s._group(group, [-.02, 0, 1.17]), 'card17-four-lid-low-tank');
  for (const x of [-.235, .235]) box(s, low, [.46, .50, .86], [x, .31, 0], stainless, 'four-lid-tank-body');
  box(s, low, [.95, .03, .88], [0, .565, 0], stainless, 'four-lid-tank-top');
  for (const x of [-.4, .4]) for (const z of [-.36, .36]) box(s, low, [.06, .06, .06], [x, .03, z], s.mat.trim, 'four-lid-foot');
  for (const [i, [x, z]] of [[-.235, -.215], [.235, -.215], [-.235, .215], [.235, .215]].entries()) {
    const open = i === 0, at = open ? [x - .06, .615, z + .19] : [x, .596, z];
    if (open) cyl(s, low, .155, .012, [x, .584, z], s.mat.black, .155, 'four-lid-open-hole', 28);
    ring(s, low, .158, [x, .585, z], s.mat.trim, .012, 'y', 'four-lid-rim');
    const lid = s._group(low, at); if (open) lid.rotation.z = .08;
    cyl(s, lid, .165, .026, [0, 0, 0], stainless, .17, open ? 'four-lid-resting-cover' : 'four-lid-closed-cover', 28);
    pipe(s, lid, [[-.05, .012, 0], [-.05, .05, 0], [.05, .05, 0], [.05, .012, 0]], .008, s.mat.trim, 'four-lid-handle');
  }
  const skid = tag(s._group(group, [-1.52, 0, 0]), 'observed-two-pump-floor-skids');
  for (const [i, z] of [-.36, .50].entries()) {
    for (const x of [-.24, .24]) box(s, skid, [.07, .08, .56], [x, .04, z], pumpGray, 'low-pump-base-rail');
    const unit = motor(s, skid, [.02, .25, z + (i ? 0 : .1)], .135, .36);
    unit.traverse(node => { if (node.isMesh) node.material = pumpGray; });
  }
  // Yellow belt guard: tall plate with a rounded shoulder, sloping toward the pump.
  const guard = new THREE.Shape();
  guard.moveTo(-.24, .06); guard.lineTo(.22, .06); guard.lineTo(.22, .34); guard.quadraticCurveTo(.2, .52, .04, .54);
  guard.lineTo(-.1, .54); guard.quadraticCurveTo(-.24, .52, -.24, .38); guard.closePath();
  tag(s._mesh(new THREE.ExtrudeGeometry(guard, { depth: .11, bevelEnabled: false, curveSegments: 8 }), s.mat.yellow, skid, [0, 0, -.66]), 'low-pump-yellow-coupling-cover');
  cyl(s, skid, .12, .2, [-.02, .40, -.47], pumpGray, .12, 'low-pump-volute', 22).rotation.x = PI / 2;
  const arch = new THREE.Shape(); arch.moveTo(-.22, .08); arch.lineTo(-.22, .32); arch.quadraticCurveTo(-.22, .48, -.05, .48);
  arch.lineTo(.08, .48); arch.quadraticCurveTo(.22, .48, .22, .32); arch.lineTo(.22, .08);
  arch.lineTo(.205, .08); arch.lineTo(.205, .32); arch.quadraticCurveTo(.205, .465, .08, .465);
  arch.lineTo(-.05, .465); arch.quadraticCurveTo(-.205, .465, -.205, .32); arch.lineTo(-.205, .08); arch.closePath();
  tag(s._mesh(new THREE.ExtrudeGeometry(arch, { depth: .42, bevelEnabled: false, curveSegments: 8 }), stainless, skid, [0, 0, .34]), 'low-pump-rolled-stainless-hood');
  box(s, skid, [.40, .54, .12], [0, .30, .26], stainless, 'low-pump-stainless-belt-case').rotation.z = .05;
  pipe(s, skid, [[.05, .46, -.36], [.05, .60, -.1], [.62, .60, .06], [1.02, .60, .06], [1.10, .60, .06]], .032, stainless, 'low-pump-visible-discharge');
  pipe(s, skid, [[-.02, .12, .78], [.50, .12, .84], [.86, .18, .84]], .03, stainless, 'low-pump-visible-suction');
}
function routeCylinder(s, root, item, g) {
  // Card 17 (열수탱크 1): vertical stainless cylinder on 3 tubular legs + front stainless ladder + curved "열수탱크 1" banner
  const stainless = polishedThirdFloorSteel(s);
  const r = .95, base = .52, h = 2.28;
  const tankGrp = tag(s._group(g[0], [0, 0, 0]), 'observed-standalone-cylinder');
  dripSkin(s, tankGrp, { r: r + .003, y0: base + .1, y1: base + h - .05, tint: [92, 84, 70], count: 18, strength: .26, seed: 17 });
  // Floor-level pipe loop and the bottom discharge that turns toward the exchangers (card 17 left).
  laggedLine(s, tankGrp, [[-.82, .09, -.82], [.82, .09, -.82], [.82, .09, .72]], .035, stainless, 'card17-floor-pipe-loop');
  laggedLine(s, tankGrp, [[0, .46, 0], [0, .2, 0], [.18, .2, -1.14], [.5, .2, -1.22]], .065, stainless, 'card17-bottom-discharge');
  for (let i = 0; i < 3; i++) {
    const a = i * PI * 2 / 3 + PI / 6, lx = Math.cos(a) * .76, lz = Math.sin(a) * .76;
    cyl(s, tankGrp, .055, base + .12, [lx, (base + .12) / 2, lz], stainless, .055, 'card17-three-leg', 16);
    box(s, tankGrp, [.16, .028, .16], [lx, .014, lz], s.mat.trim, 'card17-leg-pad');
  }
  cyl(s, tankGrp, r, h, [0, base + h / 2, 0], stainless, r, 'vessel-shell', 40);
  cyl(s, tankGrp, r, .22, [0, base - .08, 0], stainless, .18, 'vessel-lower-dish', 40);
  const cap = tag(s._group(g[1], [0, base + h, 0]), 'vessel-top');
  cyl(s, cap, .42, .10, [0, .05, 0], stainless, r, 'vessel-top-dish', 40);
  cyl(s, cap, .42, .30, [0, .24, 0], stainless, .42, 'card17-top-manhole', 32);
  for (const y of [.13, .2, .27, .34]) ring(s, cap, .43, [0, y, 0], s.mat.trim, .012, 'y', 'card17-bellows-rib');
  cyl(s, cap, .3, .16, [0, .47, 0], stainless, .42, 'card17-top-cone', 32);
  // Curved white/blue/green nameplate "열수탱크 1" + vertical stainless ladder on +X/+Z side (card 17 LEFT)
  const banner = tag(s._group(tankGrp, [0, 1.72, 0]), 'card17-hotwater-banner');
  banner.rotation.y = PI + .35;
  const arcGeo = (radOff, hh) => new THREE.CylinderGeometry(r + radOff, r + radOff, hh, 24, 1, true, -.48, .96);
  const bannerBlue = material(s, 'card17-banner-blue', 0x1e56a0, { roughness: .48 });
  const bannerGreen = material(s, 'card17-banner-green', 0x2c8c4e, { roughness: .48 });
  tag(s._mesh(arcGeo(.005, .36), s.mat.white, banner), 'card17-banner-white');
  tag(s._mesh(arcGeo(.007, .045), bannerBlue, banner, [0, .16, 0]), 'card17-banner-top-stripe');
  tag(s._mesh(arcGeo(.007, .042), bannerBlue, banner, [0, -.14, 0]), 'card17-banner-bot-stripe');
  tag(s._mesh(arcGeo(.008, .028), bannerGreen, banner, [0, -.17, 0]), 'card17-banner-green-stripe');
  filmedLettering(s, banner, '열수탱크 1', [0, .01, 0], .88, .24, 'card17-banner-text', { background: '#f5f6f2', surface: () => arcGeo(.009, .24) });
  // Vertical stainless ladder climbing over the banner to the top manhole
  const ladGrp = s._group(g[1], [0, 0, 0]); ladGrp.rotation.y = PI + .35;
  for (const side of [-.19, .19]) bar(s, ladGrp, [side, .28, r + .13], [side, base + h + .36, r + .13], .018, stainless, 'card17-ladder-rail');
  for (let ly = .48; ly <= base + h + .25; ly += .28) bar(s, ladGrp, [-.19, ly, r + .13], [.19, ly, r + .13], .014, stainless, 'card17-ladder-rung');

  gauge(s, g[2], [.4, 1.6, .88]);
  pipe(s, g[2], [[-.85, .6, -.5], [-1.15, .6, -.5], [-1.15, 2.6, -.5], [-.6, 2.6, -.5]], .06, s.mat.trim, 'observed-cylinder-side-pipe');
  cyl(s,g[0],.965,.045,[0,2.1,0],s.mat.trim,.965,'observed-cylinder-circumferential-shell-joint',40);
  const green=material(s,'third-cylinder-outlet-green',0x3c7861);
  box(s,g[2],[.09,.1,.1],[-.36,.32,-1.02],s.mat.steel,'observed-cylinder-outlet-valve');
  const lever=box(s,g[2],[.045,.29,.035],[-.35,.2,-1.05],green,'observed-cylinder-green-outlet-lever');lever.rotation.z=-.25;
  const manifold=tag(s._group(g[2],[1.24,-.38,1.82]),'observed-cylinder-side-manifold');manifold.rotation.y=-PI/2;
  bar(s,manifold,[-.7,1.75,0],[.92,1.75,0],.055,s.mat.trim,'observed-cylinder-manifold-run');
  for(const x of [-.55,.27,.85])thirdDetailFlange(s,manifold,[x,1.75,0],.105,'x','observed-cylinder-manifold-flange');
  box(s,manifold,[.23,.28,.23],[.27,1.82,0],s.mat.steel,'observed-cylinder-manifold-regulator');
  cyl(s,manifold,.085,.12,[.27,2.02,0],s.mat.trim,.11,'observed-cylinder-regulator-cap');
  const wheel=ring(s,manifold,.13,[-.57,1.93,.07],s.mat.red,.024,'z','observed-cylinder-red-manifold-handwheel');
  for(const a of [0,PI/2])bar(s,manifold,[-.57-Math.cos(a)*.11,1.93-Math.sin(a)*.11,.07],[-.57+Math.cos(a)*.11,1.93+Math.sin(a)*.11,.07],.012,s.mat.red,'observed-cylinder-handwheel-spoke');
  for(const x of [-.18,.82]){bar(s,manifold,[x,1.75,0],[x,2.07,0],.018,s.mat.trim,'observed-cylinder-gauge-stem');gauge(s,manifold,[x,2.11,.035],.08);}
  wheel.userData.sourceSeconds=[590];Object.assign(manifold.userData,{visibleRegulatorAndTwoGauges:true,pipeRouteApproximate:true,liveReadingsAdded:false});
  cylinderSideEquipment(s,g[0]);
  root.userData.cardNumbers = [17];
  root.userData.walk20261125={seconds:[220,245,251,255],observedLowUnits:2};
}
function thirdDetailOpenTankCap(s, parent, x, z, y, radius) {
  const neckRadius=.3,domeHeight=.11,neckRise=domeHeight*(1-(.33**2+.25**2)/radius**2),neckBase=y+neckRise,lip=neckBase+.2;
  const shape = new THREE.Shape(); shape.absarc(0, 0, radius, 0, PI * 2, false);
  const hole = new THREE.Path(); hole.absarc(.33, .25, neckRadius, 0, PI * 2, true); shape.holes.push(hole);
  const flat = new THREE.ExtrudeGeometry(shape, { depth: .035, bevelEnabled: false, curveSegments: 40 }); flat.rotateX(PI / 2);
  // Subdivide the pierced cap before lifting its centre. This gives the broad
  // shallow dished roof in 702/708s while preserving an actual open manhole.
  const source=flat.attributes.position,sourceNormals=flat.attributes.normal,vertices=[],normals=[];
  const emit=(a,b,c,normal,depth)=>{
    if(depth){const ab=a.clone().add(b).multiplyScalar(.5),bc=b.clone().add(c).multiplyScalar(.5),ca=c.clone().add(a).multiplyScalar(.5);emit(a,ab,ca,normal,depth-1);emit(ab,b,bc,normal,depth-1);emit(ca,bc,c,normal,depth-1);emit(ab,bc,ca,normal,depth-1);return;}
    for(const point of[a,b,c]){
      vertices.push(point.x,point.y+domeHeight*(1-(point.x**2+point.z**2)/radius**2),point.z);
      const n=Math.abs(normal.y)>.8?new THREE.Vector3(2*domeHeight*point.x/radius**2,1,2*domeHeight*point.z/radius**2).normalize().multiplyScalar(Math.sign(normal.y)):normal;
      normals.push(n.x,n.y,n.z);
    }
  };
  for(let i=0;i<source.count;i+=3)emit(new THREE.Vector3().fromBufferAttribute(source,i),new THREE.Vector3().fromBufferAttribute(source,i+1),new THREE.Vector3().fromBufferAttribute(source,i+2),new THREE.Vector3().fromBufferAttribute(sourceNormals,i),Math.abs(sourceNormals.getY(i))>.8?2:0);
  const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geom.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));flat.dispose();
  const cap=tag(s._mesh(geom,polishedThirdFloorSteel(s),parent,[x,y,z]),'observed-tank-cap-with-open-manhole');cap.userData.dishedRoofHeight=domeHeight;
  const neck = tag(s._mesh(new THREE.CylinderGeometry(neckRadius, neckRadius, .24, 40, 1, true), s.mat.steel, parent, [x + .33, neckBase + .08, z + .25]), 'observed-open-manhole-neck');
  ring(s, parent, neckRadius+.01, [x + .33, lip, z + .25], s.mat.trim, .025);
  const hinge=tag(s._group(parent,[x+.33,lip,z+.25-neckRadius]),'observed-cip-manhole-lid-hinge');hinge.rotation.x=-.22;
  cyl(s,hinge,neckRadius+.005,.035,[0,0,-neckRadius],s.mat.trim,neckRadius+.005,'observed-open-manhole-lid',40);
  const pin=cyl(s,parent,.018,.3,[x+.33,lip,z+.25-neckRadius],s.mat.trim,.018,'observed-cip-lid-hinge-pin',12);pin.rotation.z=PI/2;
  box(s,parent,[.065,.11,.045],[x+.33,lip-.08,z+.25+neckRadius+.015],s.mat.trim,'observed-cip-manhole-latch-body');
  bar(s,parent,[x+.33,lip-.05,z+.25+neckRadius+.015],[x+.33,lip+.07,z+.25+neckRadius+.035],.014,s.mat.trim,'observed-cip-manhole-latch-screw');
  bar(s,parent,[x+.26,lip+.07,z+.25+neckRadius+.035],[x+.4,lip+.07,z+.25+neckRadius+.035],.012,s.mat.trim,'observed-cip-manhole-latch-handle');
  neck.userData.actualOpenBore = true;
}
function cipFloorPump(s, parent, centerZ) {
  // The underside pass shows two separate bases. Across each one the cast
  // pump end, yellow coupling cover and finned motor are aligned side by side.
  const unit=tag(s._group(parent,[.98,0,centerZ]),'observed-cip-floor-pump');
  unit.rotation.y=PI/2;
  const dark=material(s,'cip-floor-pump-dark',0x515956,{metalness:.35,roughness:.55});
  box(s,unit,[1.05,.07,.39],[0,.07,0],s.mat.trim,'cip-pump-anchor-skid');
  for(const xx of [-.45,.45]) for(const zz of [-.15,.15]) box(s,unit,[.12,.045,.085],[xx,.0225,zz],dark,'cip-skid-foot');
  for (const xx of [-.33,.28]) box(s,unit,[.22,.08,.20],[xx,.14,0],dark,'cip-pump-mount');
  const drive=motor(s,unit,[.28,.275,0],.15,.36);
  drive.traverse(node=>{if(node.isMesh)node.material=dark;});
  const volute=cyl(s,unit,.155,.225,[-.30,.275,0],dark,.165,'cip-low-cast-pump');
  volute.rotation.z=PI/2;
  thirdDetailFlange(s,unit,[-.45,.275,0],.117,'x','cip-pump-suction-flange');
  box(s,unit,[.232,.265,.28],[-.045,.253,0],s.mat.yellow,'observed-cip-yellow-drive-guard');
  bar(s,unit,[-.18,.268,0],[.10,.268,0],.036,dark,'cip-pump-shaft');
  pipe(s,parent,[[0,.78,centerZ],[0,.61,centerZ],[.13,.39,centerZ+.04],[.55,.275,centerZ+.57],[.91,.275,centerZ+.59],[.98,.275,centerZ+.54],[.98,.275,centerZ+.45]],
    .056,s.mat.trim,'observed-cip-lower-outlet');
  thirdDetailFlange(s,parent,[0,.70,centerZ],.115,'y','cip-tank-discharge-collar');
  const ink=material(s,'cip-pump-airline-blue',0x346a8d,{roughness:.78});
  pipe(s,parent,[[1.05,.43,centerZ-.34],[1.08,.35,centerZ-.36],[1.16,.14,centerZ-.32],[1.18,.12,centerZ+.17],[1.08,.25,centerZ+.34]],
    .012,ink,'cip-pump-low-flexible-line');
}
function routeCipDeck(s, root, item, g) {
  // Cards 19, 21 and 22 show three matching tanks (물 · 알카리 · 산) through one
  // platform, each on four stout legs that meet the shell in welded saddle pads.
  const y = 2.05, centers = [1.15, -1.15, -3.45], radius = .88, names = ['CIP탱크(산)', 'CIP탱크(알카리)', 'CIP탱크(물)'];
  const stainless=polishedThirdFloorSteel(s), padBlue=material(s,'cip-leg-pad-blue',0x2268b0,{roughness:.52});
  // 04:36: the shell still projects about 0.4 diameters above the deck;
  // its rounded underside ends well above the pump skids.
  const barrelBottom=1.06, barrelTop=y+.67, shoulderHeight=.116, capY=barrelTop+shoulderHeight;
  const barrelHeight=barrelTop-barrelBottom, barrelMiddle=(barrelBottom+barrelTop)/2;
  for (const [index, z] of centers.entries()) {
    const body = tag(s._group(g[0], [0, 0, z]), 'observed-cip-tank');
    tag(s._mesh(new THREE.CylinderGeometry(radius,radius,barrelHeight,56,1,true),stainless,body,[0,barrelMiddle,0]),'observed-cip-tank-shell');
    // The exterior is intentionally open at the manhole. Give it its visible
    // inner wall and deep dished bottom so an oblique view cannot see the hall
    // floor through the backfaces of the stainless shell (702/708s).
    const interior=material(s,'third-cip-shadowed-interior',0x35403f,{roughness:.86,metalness:.04,side:THREE.BackSide});
    tag(s._mesh(new THREE.CylinderGeometry(radius-.006,radius-.006,barrelHeight,48,1,true),interior,body,[0,barrelMiddle,0]),'observed-cip-inner-vessel-wall');
    const bottomProfile=[[.10,.77],[.27,.785],[.52,.81],[.72,.85],[.823,.915],[.868,.988],[radius,barrelBottom]];
    const dish=new THREE.LatheGeometry(bottomProfile.map(([r,h])=>new THREE.Vector2(r,h)),56);
    tag(s._mesh(dish,stainless,body),'observed-cip-tank-lower-dish');
    // A separate uncapped inner slope lets a ray through the open manhole
    // reach the actual low point of the vessel.
    const bottomInner=new THREE.LatheGeometry(bottomProfile.map(([r,h])=>new THREE.Vector2(r-.006,h+.01)),48);
    tag(s._mesh(bottomInner,interior,body),'observed-cip-inner-dish');
    cyl(s,body,.104,.025,[0,.773,0],interior,.104,'observed-cip-deep-inner-bottom');
    ring(s, body, radius+.004, [0, barrelBottom, 0],s.mat.trim,.012);
    ring(s, body, radius+.002, [0, y+.34, 0],s.mat.trim,.006,'y','cip-upper-shell-weld');
    tag(s._mesh(new THREE.CylinderGeometry(radius*.97,radius,shoulderHeight,56,1,true),stainless,body,[0,barrelTop+shoulderHeight/2,0]),'observed-cip-tank-shoulder');
    // The acid tank carries dense brown runs, the water tank short black ones.
    dripSkin(s,body,{r:radius+.004,y0:barrelBottom+.06,y1:barrelTop,...[{tint:[98,62,34],count:72,strength:.62,seed:5},{tint:[92,84,72],count:20,strength:.3,seed:11},{tint:[38,34,26],count:44,strength:.5,seed:23}][index],name:'cip-brown-drip-streak'});
    thirdDetailOpenTankCap(s,g[1],0,z,capY,radius*.97);
    const mountY=capY+.09;
    cyl(s,g[1],.085,.15,[-.3,mountY+.055,z-.2],s.mat.trim,.085,'observed-cip-mixer-shaft');
    thirdDetailFlange(s,g[1],[-.3,mountY+.025,z-.2],.23,'y','observed-cip-wide-mixer-mounting-flange');
    cyl(s,g[1],.11,.16,[-.3,mountY+.125,z-.2],s.mat.motor,.145,'observed-cip-mixer-reducer');
    const mixer=routeMotor(s,g[1],[-.3,mountY+.34,z-.2],.135,.29);
    cyl(s,mixer,.143,.043,[0,.164,0],material(s,'route-motor-green',0x578c83),.143,'observed-cip-mixer-fan-cover');
    if(index<2) for (const x of [-.9, .9]) box(s, g[2], [.28, .1, .2], [x, y + .025, z], s.mat.trim, 'observed-cip-hanging-lug');
    if(index<2) cipFloorPump(s,g[3],z);
    body.userData.observedLabel=names[index];
    cipRailSign(s,g[2],body.userData.observedLabel,[1.419,y+.38,z+.35]);
    for (let li = 0; li < 4; li++) {
      const a = (li + .5) * PI / 2, lx = Math.cos(a) * .80, lz = Math.sin(a) * .80;
      cyl(s, g[3], .068, 1.16, [lx, .62, z + lz], stainless, .068, 'cip-tank-four-leg', 18);
      cyl(s, g[3], .05, .07, [lx, .06, z + lz], padBlue, .082, 'cip-tank-blue-pad', 16);
      cyl(s, g[3], .092, .025, [lx, .0125, z + lz], s.mat.trim, .092, 'cip-tank-leg-foot', 18);
      const pad = s._group(g[3], [Math.cos(a) * (radius + .006), 1.17, z + Math.sin(a) * (radius + .006)]); pad.rotation.y = PI / 2 - a;
      box(s, pad, [.27, .25, .03], [0, 0, 0], stainless, 'cip-leg-saddle-pad');
    }
  }
  // The water tank drains into the low header under the deck (card 19 front).
  pipe(s,g[3],[[0,.78,-3.45],[0,.40,-3.45],[.2,.30,-3.0],[.2,.30,-2.2],[.2,.30,-.8]],.05,s.mat.trim,'cip-water-lower-outlet');
  cyl(s,g[3],.10,.14,[0,.66,-3.45],s.mat.trim,.13,'cip-water-bottom-valve',20);
  deck(s, g[2], [[-1.4, -4.85], [1.4, -4.85], [1.4, 2.55], [-1.4, 2.55]], centers.map(z => [0, z, .94]), y, 'observed-cip-pierced-platform');
  thirdDetailChecker(s,g[2],{minX:-1.4,maxX:1.4,minZ:-4.85,maxZ:2.55,y,holes:centers.map(z=>[0,z,.94])});
  legs(s, g[2], 2.6, 7.2, y, [0, 0, -1.15]);
  for (const x of [-1.3, 1.3]) box(s, g[2], [.12, .18, 7.3], [x, y - .2, -1.15], s.mat.trim, 'observed-cip-deck-edge-beam');
  for (const z of [-4.85, 2.55]) rail(s, g[2], [-1.4, z], [1.4, z], y, .95);
  rail(s, g[2], [-1.4, -4.85], [-1.4, 2.55], y, .95);
  rail(s, g[2], [1.4, -4.85], [1.4, 1.85], y, .95);
  box(s, g[2], [1.1, .09, .8], [1.85, y - .045, 2.3], s.mat.trim, 'observed-cip-stair-landing');
  thirdDetailChecker(s,g[2],{minX:1.3,maxX:2.4,minZ:1.9,maxZ:2.7,y},'observed-cip-landing-checker-relief');
  const stair=routeAccessStair(s, g[2], { x: 1.95, z: 5.4, rise: y, run: 3.1 });
  // 04:26, the stainless stair has a continuous inclined handrail with
  // narrow vertical pickets on both sides of the open treads.
  const pickets=[];
  for(const x of [-.35,.35]) for(let i=1;i<18;i++) {
    if (i===6 || i===12) continue;
    const t=i/18;
    pickets.push({position:[x,y*t+.475,3.1*t]});
  }
  repeated(s,stair,new THREE.BoxGeometry(.017,.89,.017),pickets,s.mat.trim,'cip-stair-vertical-balusters');
  // The lower horizontal tie crosses the bays above the pump motors; paired
  // square knee braces meet each post below the deck edge (cards 21 and 22).
  for(const x of [-1.3,1.3]) {
    for(const z of [0,-2.3]) { box(s,g[2],[.105,y,.105],[x,y/2,z],s.mat.trim,'cip-middle-frame-post'); box(s,g[2],[.18,.035,.18],[x,.0175,z],s.mat.trim,'cip-middle-post-foot'); }
    box(s,g[2],[.085,.08,7.2],[x,.66,-1.15],s.mat.trim,'cip-long-lower-frame-tie');
    for(const [z,dz] of [[-4.75,.72],[-2.3,-.72],[-2.3,.72],[0,-.72],[0,.72],[2.45,-.72]]) {
      const a=new THREE.Vector3(x,1.02,z), b=new THREE.Vector3(x,y-.13,z+dz), delta=b.clone().sub(a);
      const brace=box(s,g[2],[.063,delta.length(),.064],a.add(b).multiplyScalar(.5).toArray(),s.mat.trim,'cip-platform-knee-brace');
      brace.quaternion.setFromUnitVectors(UP,delta.normalize());
    }
  }
  for (const z of [-4.75,2.45]) box(s,g[2],[2.60,.08,.075],[0,.66,z],s.mat.trim,'cip-end-lower-frame-tie');
  root.userData.walk20261125={seconds:[266,272,275,276,278],stainlessStair:true,visibleLowPumpSkids:2};
  for (const z of [-4.5, -2.2, 2.2]) pipe(s, g[3], [[-.9, 3.3, z], [.6, 3.3, z], [1.1, 2.8, z]], .06, s.mat.trim, 'observed-cip-upper-manifold');
  for(const x of [-1.08,-.85,-.62])pipe(s,g[3],[[x,2.7,-4.4],[x,3.45,-4.4],[x,3.45,1.95]],.035,s.mat.trim,'observed-cip-parallel-upper-pipe');
  const panel=tag(s._group(g[3],[1.33,3.15,-.35]),'observed-cip-three-display-cabinet');panel.rotation.y=PI/2;
  box(s,panel,[.65,.36,.17],[0,0,0],s.mat.steel,'observed-cip-three-display-shell');
  const red=material(s,'cip-panel-red-display',0x7c1512,{roughness:.4,emissive:0x8a1410,emissiveIntensity:.55});
  for(const x of [-.20,0,.20]){box(s,panel,[.13,.10,.018],[x,.055,.096],s.mat.dark,'observed-cip-static-display-window');box(s,panel,[.085,.04,.006],[x,.06,.108],red,'cip-panel-unlit-digit-strip');cyl(s,panel,.017,.020,[x,-.08,.1],s.mat.white,.017,'observed-cip-panel-selector').rotation.x=PI/2;}
  for(const z of [-.54,-.16]) box(s,g[3],[.038,.91,.035],[1.33,2.52,z],s.mat.trim,'cip-control-panel-mounting-leg');
  panel.userData.liveReadingsAdded=false;panel.userData.sourceSeconds=[648];
  // Card 22 front: ivory stand fan with a wire cage beside the acid tank.
  const fan = tag(s._group(g[3], [1.78, 0, 1.35]), 'card22-white-pedestal-fan'); fan.rotation.y = PI / 2;
  const ivory = material(s, 'cip-fan-ivory', 0xe4dfc9, { roughness: .6 });
  cyl(s, fan, .20, .05, [0, .025, 0], ivory, .24, 'fan-base', 24);
  cyl(s, fan, .022, 1.0, [0, .53, 0], ivory, .026, 'fan-stand-pole', 14);
  const head = s._group(fan, [0, 1.12, .06]); head.rotation.x = -.12;
  cyl(s, head, .07, .16, [0, 0, -.14], ivory, .055, 'fan-motor', 18).rotation.x = PI / 2;
  for (const [r, z] of [[.28, 0], [.27, .06], [.27, -.06], [.19, .085], [.1, .095], [.19, -.085]]) ring(s, head, r, [0, 0, z], ivory, r === .28 ? .012 : .005, 'z', 'fan-wire-ring');
  const spokes = [];
  for (let i = 0; i < 28; i++) for (const z of [.075, -.075]) spokes.push({ position: [Math.cos(i * PI / 14) * .17, Math.sin(i * PI / 14) * .17, z], rotation: [0, 0, i * PI / 14] });
  repeated(s, head, new THREE.BoxGeometry(.21, .004, .004), spokes, ivory, 'fan-wire-cage');
  for (let i = 0; i < 3; i++) { const blade = box(s, head, [.2, .12, .006], [Math.cos(i * PI * 2 / 3) * .12, Math.sin(i * PI * 2 / 3) * .12, 0], s.mat.trim, 'fan-blade'); blade.rotation.set(.35, 0, i * PI * 2 / 3); }
  // Pink and white barrier tape sags between the water bay and the deck post (cards 19 and 20).
  const tape = material(s, 'cip-barrier-tape-pink', 0xd2587c, { roughness: .6 });
  for (let i = 0; i < 14; i++) {
    const u = (i + .5) / 14, piece = box(s, g[2], [.006, .06, .165], [-1.38, 1.06 - .5 * u * (1 - u), -4.7 + u * 2.3], i % 2 ? s.mat.white : tape, 'cip-caution-barrier-tape');
    piece.rotation.x = .5 * (1 - 2 * u) / 2.3;
  }
  Object.assign(root.userData, { observedMinimumTankTops: 3, entireCipTankCountConfirmed: false, readableObservedTankLabels: ['CIP탱크(산)'], cardTankLabels: ['CIP탱크(물)', 'CIP탱크(알카리)', 'CIP탱크(산)'], cardNumbers: [19, 21, 22], localPlatformElevation: y, tankBodiesHangThroughDeck: true });
}
function observedThirdFloor(s, root, item, g) {
  const kind = item.dryerRoute?.kind;
  const builder = { 'third-cone-bank': routeConeBank, 'third-service-skid': routeServiceSkid, 'third-drive-frame': routeDriveFrame, 'third-cylinder': routeCylinder, 'third-cip-deck': routeCipDeck }[kind];
  if (!builder) return false;
  builder(s, root, item, g);
  const stainless=material(s,'third-observed-stainless',0xc4cbca,{roughness:.36,metalness:.84,map:s.mat.steel.map||null,envMapIntensity:1.18});
  const edges=material(s,'third-observed-stainless-trim',0xa8b1b1,{roughness:.36,metalness:.7});
  root.traverse(node=>{if(node.isMesh){if(node.material===s.mat.steel)node.material=stainless;else if(node.material===s.mat.trim)node.material=edges;}});
  Object.assign(root.userData, { observedRouteEquipment: { ...item.dryerRoute }, historicalEquipmentIdentityConfirmed: false, modelDimensionsMeasured: false });
  return true;
}
function packingDetailFeed(s, parent, index) {
  const z = -1.75, feed = tag(s._group(parent), index === 0 ? 'observed-packing-twin-outlet-feed' : 'observed-packing-round-doser');
  if (index === 0) {
    // 344/346s: the tall rectangular hopper splits into two visible lower legs.
    const shape = new THREE.Shape();
    shape.moveTo(-.65, 4.35); for (const p of [[.65,4.35],[.65,3.82],[.42,3.05],[.24,3.05],[0,3.63],[-.24,3.05],[-.42,3.05],[-.65,3.82]]) shape.lineTo(...p); shape.closePath();
    tag(s._mesh(new THREE.ExtrudeGeometry(shape, { depth: .8, bevelEnabled: false }), s.mat.steel, feed, [0, 0, z - .4]), 'observed-packing-rectangular-v-hopper');
    box(s, feed, [1.38, .045, .88], [0, 4.37, z], s.mat.trim, 'observed-packing-feed-inspection-lid');
    for (const x of [-.34, .34]) {
      cyl(s, feed, .13, .45, [x, 2.95, z], s.mat.trim, .13, 'observed-packing-twin-outlet-neck');
      box(s, feed, [.45, .32, .52], [x, 3.05, z + .4], s.mat.steel, 'observed-packing-twin-dosing-block');
      cyl(s, feed, .14, .045, [x, 3.05, z + .68], s.mat.black, .14, 'observed-packing-twin-front-drive-cover').rotation.x = PI / 2;
      for (const xx of [x - .19, x + .19]) bar(s, feed, [xx, 2.88, z + .28], [xx, 3.82, z + .28], .025, s.mat.trim, 'observed-packing-twin-guide-post');
      pipe(s, feed, [[x, 2.73, z], [x, 2.45, z], [x, 2.24, -.4], [x, 1.55, -.4]], .065, s.mat.trim, 'observed-packing-filling-inlet');
    }
    for (const x of [-.78,.78]) for (const zz of [z - .4,z + .4]) box(s, feed, [.04,.9,.04], [x,3.25,zz], s.mat.trim, 'observed-packing-hopper-support-post');
    routeMotor(s, feed, [.5, 4.5, z], .085, .22);
    cyl(s, feed, .14, .35, [0,4.58,z], s.mat.white, .14, 'observed-packing-flexible-feed-sock');
    pipe(s, feed, [[0,4.75,z],[0,5.4,z]], .11, s.mat.steel, 'observed-packing-vertical-supply-pipe');
    const coil = Array.from({length:57},(_,i)=>[-.9 + Math.cos(i/56*PI*14)*.045,2.88+i/56*.66,z+.64+Math.sin(i/56*PI*14)*.045]);
    pipe(s, feed, coil, .009, s.mat.yellow, 'observed-packing-coiled-air-hose');
  } else {
    // 350/352/354s: the other two heads are compact round dosers, not tall bins.
    cyl(s, feed, .42, .34, [0,3.32,z], s.mat.steel, .42, 'observed-packing-round-doser-body', 32);
    cyl(s, feed, .42, .32, [0,2.99,z], s.mat.steel, .13, 'observed-packing-round-doser-lower-funnel', 32);
    for (const y of [3.15,3.49]) ring(s, feed, .44, [0,y,z], s.mat.trim, .025);
    motor(s, feed, [-.52,3.3,z], .12, .43, false);
    routeMotor(s, feed, [.46,3.53,z], .09, .31, true);
    cyl(s, feed, .15, .74, [0,3.92,z], s.mat.white, .15, 'observed-packing-flexible-feed-sock');
    for (const y of [3.56,4.29]) ring(s, feed, .16, [0,y,z], s.mat.trim, .018);
    pipe(s, feed, [[0,4.28,z],[.1,4.65,z],[.25,5.4,z]], .115, s.mat.steel, 'observed-packing-vertical-supply-pipe');
    pipe(s, feed, [[0,2.8,z],[0,2.6,z],[0,2.22,-.4],[0,1.6,-.4]], .075, s.mat.trim, 'observed-packing-filling-inlet');
    for (const x of [-.45,.45]) for (const zz of [z-.35,z+.35]) box(s,feed,[.04,.42,.04],[x,2.99,zz],s.mat.trim,'observed-packing-round-doser-foot');
  }
  feed.userData.visibleFeedVariant = index === 0 ? 'rectangular-twin-outlet' : 'compact-round-doser';
  return feed;
}
function packingDetailControl(s, parent, index, width, depth) {
  if (index === 2) {
    const header = tag(s._group(parent,[0,2.08,depth/2+.065]),'observed-packing-front-control-header');
    box(s,header,[.82,.38,.12],[0,0,0],s.mat.steel,'observed-packing-control-header');
    box(s,header,[.34,.23,.018],[-.13,.025,.072],s.mat.screen,'observed-packing-front-monitor');
    for(const x of [.15,.27])cyl(s,header,.025,.025,[x,-.07,.08],s.mat.white,.025,'observed-packing-control-button').rotation.x=PI/2;
    return;
  }
  const side = index === 0 ? -1 : 1, x = side*(width/2+.33), cabinet = tag(s._group(parent,[x,0,.25]),'observed-packing-full-height-control-cabinet');
  box(s,cabinet,[.56,1.84,.6],[0,1.05,0],cardPaints(s).ivory,'observed-packing-control-cabinet-shell');
  const top=box(s,cabinet,[.55,.08,.52],[0,1.99,.04],s.mat.trim,'observed-packing-slanted-control-top');top.rotation.x=-.2;
  for(let i=0;i<7;i++)box(s,cabinet,[.035,.025,.28],[-.2+i*.065,2.035,.03],s.mat.dark,'observed-packing-control-vent-slot');
  box(s,cabinet,[.34,.22,.018],[0,1.58,.312],s.mat.screen,'observed-packing-cabinet-monitor');
  for(const y of [.85,1.05])for(const xx of [-.14,.14])cyl(s,cabinet,.025,.025,[xx,y,.32],s.mat.white,.025,'observed-packing-control-button').rotation.x=PI/2;
  cyl(s,cabinet,.045,.19,[0,2.15,0],s.mat.red,.045,'observed-packing-red-stack-light');
  if(index===1){
    const leaf=tag(s._group(cabinet,[-.3,.13,.315]),'observed-packing-filmed-open-service-leaf');leaf.rotation.y=-.95;
    box(s,leaf,[.61,1.73,.035],[.305,.865,0],cardPaints(s).ivory,'observed-packing-open-service-panel');
    box(s,leaf,[.035,.27,.035],[.53,.9,.03],s.mat.dark,'observed-packing-service-panel-handle');
    Object.assign(leaf.userData,{fixedFilmedPose:true,sourceSeconds:[348,350],serviceInteriorConfirmed:false});
  }
}
function packingDetailPlatform(s,parent,item){
  const peers=['f1-ica-1','f1-ica-2','f1-ica-3'].map((id,i)=>relative(item,(s.equipment||[]).find(entry=>entry.id===id),[i===0?0:i===1?5.5:10.5,0]));
  const xs=peers.map(p=>p[0]),left=Math.min(...xs)-1.75,right=Math.max(...xs)+1.75,y=2.8,back=-3.4,bridge=-2.55,front=-1.2;
  const outline=[[left,back],[right,back],[right,front]];
  for(let i=xs.length-1;i>0;i--)outline.push([xs[i]-1.65,front],[xs[i]-1.65,bridge],[xs[i-1]+1.65,bridge],[xs[i-1]+1.65,front]);
  outline.push([left,front]);
  const holes=peers.flatMap(([x,z],i)=>i===0?[[-.34,.18],[.34,.18]].map(([dx,r])=>[x+dx,z-1.75,r]):[[x,z-1.75,.28]]);
  const platform=deck(s,parent,outline,holes,y,'observed-packing-common-service-deck');
  Object.assign(platform.userData,{observedFrontNotches:2,rearConnectingWalkway:true,geometryMeasured:false});
  for(const [i,a]of outline.entries()){
    const b=outline[(i+1)%outline.length];
    if(i===outline.length-2){rail(s,parent,[left+1,front],a,y,.95);continue;}
    rail(s,parent,a,b,y,.95);
  }
  for(const x of xs){
    for(const dx of [-1.4,1.4])for(const z of [-3.12,-1.35])box(s,parent,[.075,y,.075],[x+dx,y/2,z],s.mat.trim,'observed-packing-deck-column');
    box(s,parent,[3.1,.15,.1],[x,y-.16,-1.35],s.mat.trim,'observed-packing-deck-beam');
    for(const side of [-1,1])bar(s,parent,[x+side*1.4,.35,-1.35],[x+side*.3,y-.2,-1.35],.045,s.mat.trim,'observed-packing-deck-diagonal-brace');
  }
  box(s,parent,[right-left,.15,.1],[(left+right)/2,y-.16,-3.25],s.mat.trim,'observed-packing-rear-bridge-beam');
  const ladder=tag(s._group(parent,[left+.5,0,-1.04]),'observed-packing-service-ladder');
  for(const x of [-.28,.28])bar(s,ladder,[x,.05,.18],[x,y+.85,-.05],.025,s.mat.trim,'observed-packing-ladder-rail');
  for(let yy=.25;yy<y+.1;yy+=.26)bar(s,ladder,[-.28,yy,.18-yy/y*.18],[.28,yy,.18-yy/y*.18],.022,s.mat.trim,'observed-packing-ladder-rung');
  for(const yy of [1,1.65,2.3,2.95]){
    const hoop=tag(s._mesh(new THREE.TorusGeometry(.43,.02,6,40),s.mat.trim,ladder,[0,yy,.24]),'observed-packing-ladder-safety-hoop');hoop.rotation.x=PI/2;
  }
  for(const a of [0,PI/2,PI])bar(s,ladder,[Math.cos(a)*.43,1,.24+Math.sin(a)*.43],[Math.cos(a)*.43,3.3,.24+Math.sin(a)*.43],.018,s.mat.trim,'observed-packing-ladder-cage-strap');
  Object.assign(ladder.userData,{accessPositionApproximate:true,rungCountMeasured:false,visibleSafetyHoops:4});
  return platform;
}
// Field cards 05–07 (2026-11-24): smoked aluminium guards with black corner caps,
// ivory film wall, ivory HALAL switchgear behind, low outfeed cover and the blue
// marking unit beside it. Positions inside each filmed bay are photo proportions.
function cardPaints(s) {
  return {
    ivory: material(s, 'card-machine-ivory', 0xd6d2c1, { roughness: .52, metalness: .12 }),
    ivoryDark: material(s, 'card-machine-ivory-shadow', 0xb9b5a4, { roughness: .56, metalness: .12 }),
    navy: material(s, 'card-cabinet-navy-plinth', 0x2d3a52, { roughness: .6 }),
    smoke: material(s, 'route-packing-smoked-guards', 0xa9b2b4, { transparent: true, opacity: .42, depthWrite: false, side: THREE.DoubleSide, roughness: .42 }),
    alu: material(s, 'card-aluminium-profile', 0xb4babc, { roughness: .38, metalness: .72 }),
    blue: material(s, 'card-marking-unit-blue', 0x1f5f9e, { roughness: .4, metalness: .1 }),
    blueDark: material(s, 'card-marking-unit-dark-blue', 0x173f70, { roughness: .45 }),
    crate: material(s, 'card-orange-crate', 0xe0862a, { roughness: .58 }),
    lift: material(s, 'card-lift-cart-orange', 0xd9531f, { roughness: .5, metalness: .1 }),
    belt: material(s, 'card-brown-belt', 0x6c5644, { roughness: .8 }),
    kraft: material(s, 'card-kraft-paper', 0xa98a63, { roughness: .9 }),
    hose: material(s, 'card-gray-hose', 0xa9b2b6, { roughness: .6 }),
    clear: material(s, 'card-clear-sleeve', 0xdfe7e8, { transparent: true, opacity: .4, depthWrite: false, side: THREE.DoubleSide, roughness: .25 }),
    greenBelt: material(s, 'card-infeed-green', 0x3d8f5f, { roughness: .6 }),
    slat: material(s, 'card-ivory-slat-chain', 0xdcd6c2, { roughness: .6 }),
  };
}
function warningTriangle(s, parent, position, size = .13) {
  const shape = new THREE.Shape([new THREE.Vector2(-size * .6, -size * .45), new THREE.Vector2(size * .6, -size * .45), new THREE.Vector2(0, size * .6)]);
  tag(s._mesh(new THREE.ShapeGeometry(shape), s.mat.yellow, parent, position), 'card-warning-triangle');
  box(s, parent, [size * .08, size * .4, .002], [position[0], position[1] + size * .02, position[2] + .002], s.mat.black, 'card-warning-mark');
}
function ribbedHose(s, parent, points, radius, paint, name) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), false, 'centripetal'), length = curve.getLength();
  tag(s._mesh(new THREE.TubeGeometry(curve, Math.max(16, points.length * 10), radius, 12, false), paint, parent), name);
  const count = Math.min(90, Math.floor(length / (radius * .62))), ribs = new THREE.InstancedMesh(new THREE.TorusGeometry(radius, radius * .11, 5, 16), paint, count);
  const matrix = new THREE.Matrix4(), q = new THREE.Quaternion(), zAxis = new THREE.Vector3(0, 0, 1), one = new THREE.Vector3(1, 1, 1);
  for (let i = 0; i < count; i++) { const u = (i + .5) / count; q.setFromUnitVectors(zAxis, curve.getTangentAt(u)); matrix.compose(curve.getPointAt(u), q, one); ribs.setMatrixAt(i, matrix); }
  ribs.instanceMatrix.needsUpdate = true; s.geometries?.add(ribs.geometry); parent.add(ribs); tag(ribs, `${name}-ribs`);
}
function packingCardDetails(s, g, index, width, depth) {
  const p = cardPaints(s), back = -depth / 2, front = depth / 2, cards = [5, 6, 7];
  // Black corner caps and the white-blue pinch warning on the doors.
  const caps = [];
  for (const x of [-width / 2, width / 2]) for (const z of [back, front]) for (const y of [.27, 2.33]) caps.push({ position: [x, y, z] });
  repeated(s, g[0], new THREE.BoxGeometry(.075, .085, .075), caps, s.mat.black, 'card-profile-corner-cap');
  box(s, g[0], [.34, .22, .008], [-width * .27, 1.86, front + .045], s.mat.white, 'card-pinch-sign');
  box(s, g[0], [.34, .05, .004], [-width * .27, 1.77, front + .052], p.blueDark, 'card-pinch-sign-band');
  filmedLettering(s, g[0], '끼임 주의', [-width * .24, 1.88, front + .052], .22, .10, 'card-pinch-sign-text', { background: '#f4f6f2', color: '#b3262a' });
  // Through the guards: green pouch track, chain grippers and dark drive casings.
  box(s, g[2], [width * .86, .05, .12], [0, .98, front - .34], p.greenBelt, 'card-visible-green-track');
  box(s, g[2], [width * .88, .26, .34], [0, .52, front - .42], s.mat.dark, 'card-visible-drive-casing');
  repeated(s, g[2], new THREE.BoxGeometry(.05, .19, .06), Array.from({ length: 11 }, (_, i) => ({ position: [-width * .4 + i * width * .08, 1.11, front - .34] })), s.mat.trim, 'card-pouch-gripper');
  repeated(s, g[2], new THREE.CylinderGeometry(.028, .028, .22, 10), Array.from({ length: 7 }, (_, i) => ({ position: [-width * .36 + i * width * .12, .78, front - .2] })), s.mat.black, 'card-pneumatic-cylinder');
  // HMI box hung on the profile frame (the far machine already owns one).
  if (index !== 2) {
    const hmi = tag(s._group(g[2], [width * .28, 1.72, front + .12]), 'card-profile-hmi');
    box(s, hmi, [.56, .5, .16], [0, 0, 0], p.ivory, 'card-hmi-case');
    box(s, hmi, [.26, .22, .012], [.06, .06, .086], s.mat.dark, 'card-hmi-bezel'); box(s, hmi, [.22, .18, .012], [.06, .06, .092], s.mat.screen, 'card-hmi-screen');
    box(s, hmi, [.1, .1, .014], [-.18, .1, .086], s.mat.white, 'card-hmi-meter');
    for (let i = 0; i < 7; i++) cyl(s, hmi, .018, .02, [-.21 + i * .07, -.17, .09], [s.mat.red, s.mat.mint, s.mat.black][i % 3], .018, 'card-hmi-button', 10).rotation.x = PI / 2;
  }
  // Ivory HALAL switchgear on a navy plinth behind the guards.
  const cabinet = tag(s._group(g[2], [-.06, 0, back - .30]), 'card-halal-switchgear'); cabinet.rotation.y = PI;
  box(s, cabinet, [1.32, .12, .42], [0, .18, 0], p.navy, 'card-switchgear-plinth');
  for (const x of [-.52, .52]) box(s, cabinet, [.08, .12, .44], [x, .06, 0], s.mat.trim, 'card-switchgear-foot');
  box(s, cabinet, [1.28, 1.72, .40], [0, 1.10, 0], p.ivory, 'card-switchgear-body');
  for (const x of [-.32, .32]) box(s, cabinet, [.62, 1.66, .014], [x, 1.10, .205], p.ivory, 'card-switchgear-door');
  box(s, cabinet, [.008, 1.66, .02], [0, 1.10, .206], p.ivoryDark, 'card-switchgear-door-gap');
  box(s, cabinet, [.03, .2, .03], [.05, 1.12, .225], s.mat.black, 'card-switchgear-handle');
  box(s, cabinet, [.46, .34, .006], [-.34, 1.62, .216], s.mat.white, 'card-halal-sign');
  box(s, cabinet, [.46, .05, .004], [-.34, 1.77, .221], p.blue, 'card-halal-sign-band');
  filmedLettering(s, cabinet, 'HALAL', [-.34, 1.62, .222], .42, .15, 'card-halal-sign-text', { background: '#f6f7f4', color: '#2f8a6a' });
  warningTriangle(s, cabinet, [.36, 1.02, .218]);
  for (const [x, y, paint] of [[.2, 1.5, s.mat.white], [.3, 1.5, s.mat.white], [.4, 1.5, s.mat.mint], [.5, 1.5, s.mat.red], [.3, 1.36, s.mat.black], [.44, 1.36, s.mat.black]]) cyl(s, cabinet, .022, .025, [x, y, .225], paint, .022, 'card-switchgear-button', 10).rotation.x = PI / 2;
  cyl(s, cabinet, .05, .03, [.42, 1.2, .22], s.mat.red, .05, 'card-switchgear-main-switch', 18).rotation.x = PI / 2;
  for (let i = 0; i < 9; i++) box(s, cabinet, [.006, .012, .22], [-.643, .72 + i * .035, 0], p.ivoryDark, 'card-switchgear-vent');
  cyl(s, cabinet, .018, .1, [.5, 2.01, 0], s.mat.trim, .018, 'card-stack-light-post'); cyl(s, cabinet, .042, .15, [.5, 2.12, 0], s.mat.red, .042, 'card-stack-light', 18);
  // Ivory film wall with black guide hubs; a clear sleeve drops from the deck.
  const side = index === 1 ? -1 : 1, wall = tag(s._group(g[2], [side * (width / 2 + .085), 0, -.1]), 'card-film-wall'); wall.rotation.y = side * PI / 2;
  box(s, wall, [1.5, 1.66, .05], [0, 1.15, 0], p.ivory, 'card-film-wall-plate');
  for (const [x, y, r] of [[-.58, 1.75, .06], [-.38, 1.58, .05], [.1, 1.78, .06], [.34, 1.66, .05], [-.6, .62, .075], [.42, 1.12, .055], [-.2, 1.2, .045]]) {
    cyl(s, wall, r, .09, [x, y, .07], s.mat.black, r, 'card-film-hub', 20).rotation.x = PI / 2; cyl(s, wall, r * .45, .1, [x, y, .075], s.mat.trim, r * .45, 'card-film-hub-core', 14).rotation.x = PI / 2;
  }
  for (const [x, y, w, h] of [[-.36, 1.02, .26, .2], [.22, .74, .3, .24]]) box(s, wall, [w, h, .07], [x, y, .04], s.mat.dark, 'card-film-wall-opening');
  box(s, wall, [.2, .14, .06], [.0, 1.42, .05], p.ivoryDark, 'card-film-wall-sensor-block');
  ribbedHose(s, wall, [[.3, .95, .05], [.36, .9, .16], [.3, .62, .17], [.1, .5, .16]], .055, p.slat, 'card-film-wall-hose');
  if (index !== 1) {
    cyl(s, wall, .09, 1.62, [-.02, 1.98, .24], p.clear, .09, 'card-clear-vertical-sleeve', 20);
    for (const y of [1.4, 1.75, 2.1, 2.45]) ring(s, wall, .092, [-.02, y, .24], s.mat.trim, .006, 'y', 'card-clear-sleeve-clip');
    cyl(s, wall, .09, .18, [-.02, 1.1, .24], s.mat.trim, .15, 'card-sleeve-cone', 20);
    box(s, wall, [.42, .78, .34], [-.02, .55, .26], p.ivory, 'card-ivory-floor-box'); box(s, wall, [.44, .03, .36], [-.02, .95, .26], s.mat.white, 'card-ivory-floor-box-top');
  }
  // Low smoked cover over the outfeed and an ivory slat chain beyond it.
  const cover = tag(s._group(g[2], [.06, 0, front + .46]), 'card-outfeed-low-cover');
  for (const x of [-.52, .52]) for (const z of [-.36, .36]) box(s, cover, [.04, .9, .04], [x, .55, z], p.alu, 'card-cover-post');
  for (const x of [-.52, .52]) box(s, cover, [.012, .74, .68], [x, .6, 0], p.smoke, 'card-cover-side');
  box(s, cover, [1.0, .74, .012], [0, .6, .36], p.smoke, 'card-cover-front'); box(s, cover, [1.1, .035, .78], [0, 1.01, 0], s.mat.white, 'card-cover-top');
  for (const z of [-.39, .39]) box(s, cover, [1.12, .04, .02], [0, 1.0, z], p.alu, 'card-cover-edge');
  // Blue marking unit on its steel stand (cards 05 and 06 left).
  const marker = tag(s._group(g[2], [-.98, 0, front + .52]), 'card-blue-marking-unit');
  for (const x of [-.27, .27]) for (const z of [-.17, .17]) box(s, marker, [.035, .74, .035], [x, .37, z], s.mat.trim, 'card-marker-stand');
  for (const y of [.2, .73]) box(s, marker, [.62, .03, .42], [0, y, 0], s.mat.trim, 'card-marker-shelf');
  const shape = new THREE.Shape(); shape.moveTo(-.31, 0); shape.lineTo(.31, 0); shape.lineTo(.31, .20); shape.quadraticCurveTo(.30, .29, .18, .30); shape.lineTo(.06, .31); shape.quadraticCurveTo(.02, .42, -.05, .44); shape.lineTo(-.12, .44); shape.quadraticCurveTo(-.16, .43, -.16, .36); shape.lineTo(-.2, .31); shape.quadraticCurveTo(-.31, .31, -.31, .24); shape.closePath();
  tag(s._mesh(new THREE.ExtrudeGeometry(shape, { depth: .36, bevelEnabled: true, bevelSize: .015, bevelThickness: .015, bevelSegments: 2, curveSegments: 8 }), p.blue, marker, [0, .76, -.18]), 'card-marker-body');
  box(s, marker, [.19, .17, .012], [-.17, .90, .202], s.mat.dark, 'card-marker-panel'); box(s, marker, [.11, .055, .008], [-.17, .935, .21], s.mat.screen, 'card-marker-display');
  box(s, marker, [.16, .05, .006], [.17, .88, .203], s.mat.white, 'card-marker-badge');
  pipe(s, marker, [[.3, .86, 0], [.45, .82, .02], [.6, .86, -.02], [.74, .88, -.05]], .016, s.mat.black, 'card-marker-umbilical');
  // Loose items the cards repeat: orange crates and the orange scissor-lift cart.
  const crate = (parent, x, y, z) => {
    const c = tag(s._group(parent, [x, y, z]), 'card-orange-crate');
    for (const [w, d, dx, dz] of [[.52, .02, 0, -.17], [.52, .02, 0, .17], [.02, .34, -.25, 0], [.02, .34, .25, 0]]) for (const yy of [.04, .13, .23]) box(s, c, [w, .05, d], [dx, yy, dz], p.crate, 'card-crate-slat');
    for (const xx of [-.25, .25]) for (const zz of [-.17, .17]) box(s, c, [.03, .26, .03], [xx, .13, zz], p.crate, 'card-crate-corner');
    box(s, c, [.5, .015, .34], [0, .015, 0], p.crate, 'card-crate-base');
  };
  if (index === 0) crate(g[2], .95, 0, front + .42);
  if (index === 2) {
    for (const [x, z] of [[-1.75, 2.6], [-1.75, 2.98]]) for (let i = 0; i < 4; i++) crate(g[2], x, i * .265, z);
    const cart = tag(s._group(g[2], [-1.98, 0, .55]), 'card-orange-lift-cart');
    for (const z of [-.34, .34]) for (const x of [-.2, .2]) cyl(s, cart, .06, .04, [x, .06, z], s.mat.black, .06, 'card-lift-wheel', 16).rotation.z = PI / 2;
    for (const x of [-.2, .2]) box(s, cart, [.05, .05, .84], [x, .14, 0], p.lift, 'card-lift-base');
    for (const x of [-.18, .18]) { bar(s, cart, [x, .17, -.34], [x, .62, .30], .018, s.mat.black, 'card-lift-scissor'); bar(s, cart, [x, .17, .34], [x, .62, -.30], .018, s.mat.black, 'card-lift-scissor'); }
    box(s, cart, [.5, .05, .84], [0, .65, 0], p.lift, 'card-lift-table');
    for (const x of [-.2, .2]) bar(s, cart, [x, .14, .42], [x, .98, .52], .015, s.mat.black, 'card-lift-handle'); bar(s, cart, [-.2, .98, .52], [.2, .98, .52], .015, s.mat.black, 'card-lift-handle');
  }
  return cards[index];
}
// Cards 11 and 12: bag filler under its own deck, then the sewing head and band
// sealer on one belt. The filler stands beside packer 3 in cards 05–07; its
// plan position in the clean room is estimated.
function bagFillingLine(s, root, g) {
  const p = cardPaints(s), stainless = material(s, 'card-clean-room-steel', 0xaeb4b5, { roughness: .4, metalness: .58 }), sealGray = material(s, 'card-sealer-gray', 0x7d8380, { roughness: .48, metalness: .5 });
  const y = 2.8;
  deck(s, g[0], [[-1.3, -2.6], [1.3, -2.6], [1.3, .2], [-1.3, .2]], [[0, -1.35, .62]], y, 'card11-filler-deck');
  for (const x of [-1.2, 1.2]) for (const z of [-2.5, .1]) {
    box(s, g[0], [.12, y, .12], [x, y / 2, z], sealGray, 'card11-deck-column'); box(s, g[0], [.24, .025, .24], [x, .0125, z], s.mat.trim, 'card11-column-plate');
    const brace = (a, b) => bar(s, g[0], a, b, .035, sealGray, 'card11-column-brace');
    brace([x, y - .65, z], [x - Math.sign(x) * .55, y - .12, z]); brace([x, y - .65, z], [x, y - .12, z + (z < -1 ? .55 : -.55)]);
  }
  for (const x of [-1.2, 1.2]) box(s, g[0], [.1, .16, 2.7], [x, y - .17, -1.2], sealGray, 'card11-deck-beam');
  for (const z of [-2.5, .1]) box(s, g[0], [2.5, .16, .1], [0, y - .17, z], sealGray, 'card11-deck-beam');
  for (const [a, b] of [[[-1.3, -2.6], [1.3, -2.6]], [[1.3, -2.6], [1.3, .2]], [[1.3, .2], [-1.3, .2]], [[-1.3, .2], [-1.3, -.7]], [[-1.3, -1.4], [-1.3, -2.6]]]) rail(s, g[0], a, b, y, .95);
  for (const z of [-.8, -1.3]) bar(s, g[0], [-1.36, .1, z], [-1.36, y + .9, z], .025, s.mat.trim, 'card11-ladder-rail');
  for (let yy = .3; yy < y; yy += .28) bar(s, g[0], [-1.36, yy, -.8], [-1.36, yy, -1.3], .02, s.mat.trim, 'card11-ladder-rung');
  // Cone hopper with a bolted round manway, butterfly valve and bag spout.
  cyl(s, g[1], .6, .5, [0, 3.06, -1.35], stainless, .6, 'card11-hopper-shell', 40); ring(s, g[1], .61, [0, 3.31, -1.35], s.mat.trim, .018);
  cyl(s, g[1], .6, .14, [0, 3.38, -1.35], stainless, .6, 'card11-hopper-lid', 40); cyl(s, g[1], .16, 1.6, [0, 4.25, -1.35], stainless, .16, 'card11-hopper-feed', 24);
  cyl(s, g[1], .6, 1.0, [0, 2.31, -1.35], stainless, .13, 'card11-hopper-cone', 40);
  const manway = s._group(g[1], [0, 2.38, -.965]); manway.rotation.x = -.44;
  cyl(s, manway, .17, .05, [0, 0, 0], stainless, .17, 'card11-hopper-manway', 28).rotation.x = PI / 2; ring(s, manway, .155, [0, 0, .03], s.mat.trim, .012, 'z', 'card11-manway-rim');
  for (let i = 0; i < 6; i++) box(s, manway, [.03, .03, .06], [Math.cos(i * PI / 3) * .17, Math.sin(i * PI / 3) * .17, .02], s.mat.trim, 'card11-manway-clamp');
  cyl(s, g[1], .14, .07, [0, 1.77, -1.35], s.mat.dark, .14, 'card11-butterfly-valve', 22); box(s, g[1], [.16, .12, .1], [.2, 1.77, -1.35], s.mat.trim, 'card11-valve-actuator');
  cyl(s, g[1], .1, .22, [0, 1.63, -1.35], stainless, .1, 'card11-bag-spout', 20); box(s, g[1], [.34, .10, .18], [0, 1.50, -1.35], s.mat.dark, 'card11-bag-clamp');
  ribbedHose(s, g[1], [[.1, 1.62, -1.35], [.5, 1.75, -1.2], [.9, 2.1, -.9], [1.1, 2.6, -.7]], .06, p.hose, 'card11-dust-hose');
  ribbedHose(s, g[1], [[-.9, 2.62, -.2], [-.95, 2.1, -.1], [-1.0, 1.4, 0], [-1.02, .3, .1]], .085, p.hose, 'card11-drop-hose');
  // Scale head post with its green-lit indicator box.
  box(s, g[2], [.08, 1.75, .08], [.46, .875, -1.1], s.mat.trim, 'card11-scale-post'); box(s, g[2], [.34, .4, .14], [.46, 1.62, -1.0], s.mat.dark, 'card11-scale-indicator');
  const lit = material(s, 'card11-green-digits', 0x1d7f4f, { emissive: 0x27d07e, emissiveIntensity: .8, roughness: .4 });
  for (const yy of [1.72, 1.6]) box(s, g[2], [.22, .07, .01], [.46, yy, -.925], lit, 'card11-indicator-digits');
  for (let i = 0; i < 4; i++) cyl(s, g[2], .016, .02, [.36 + i * .065, 1.48, -.925], [s.mat.red, s.mat.mint, s.mat.white, s.mat.yellow][i], .016, 'card11-indicator-button', 10).rotation.x = PI / 2;
  // Roller table under the spout feeding the brown sealing belt.
  for (const x of [-.27, .27]) { box(s, g[2], [.05, .1, 1.5], [x, .42, -1.0], s.mat.trim, 'card11-roller-frame'); for (const z of [-1.65, -.35]) box(s, g[2], [.05, .4, .05], [x, .2, z], s.mat.trim, 'card11-roller-leg'); }
  repeated(s, g[2], new THREE.CylinderGeometry(.028, .028, .5, 14), Array.from({ length: 18 }, (_, i) => ({ position: [0, .47, -1.7 + i * .083], rotation: [0, 0, PI / 2] })), s.mat.trim, 'card11-roller');
  box(s, g[2], [.34, .04, 3.0], [0, .5, 1.3], p.belt, 'card12-brown-belt');
  for (const x of [-.2, .2]) { box(s, g[2], [.05, .12, 3.04], [x, .47, 1.3], s.mat.trim, 'card12-belt-frame'); for (const z of [-.1, 1.3, 2.7]) box(s, g[2], [.05, .42, .05], [x, .21, z], s.mat.trim, 'card12-belt-leg'); }
  for (const z of [.2, .9, 1.6, 2.3]) for (const x of [-.24, .24]) cyl(s, g[2], .026, .18, [x, .64, z], s.mat.trim, .026, 'card12-guide-roller', 14);
  cyl(s, g[2], .11, .5, [.0, .36, 2.78], s.mat.motor, .11, 'card12-belt-drive', 20).rotation.z = PI / 2;
  const bag = (x, z, filled) => {
    const b = tag(s._group(g[2], [x, filled ? .52 : 0, z]), 'card11-kraft-bag');
    box(s, b, [.36, .5, .19], [0, .25, 0], p.kraft, 'card11-bag-body'); box(s, b, [.4, .14, .1], [0, .56, 0], p.kraft, 'card11-bag-neck'); box(s, b, [.42, .1, .02], [0, .67, 0], p.kraft, 'card11-bag-mouth');
    filmedLettering(s, b, 'SCE', [0, .3, .0965], .2, .12, 'card11-bag-print', { background: '#a98a63', color: '#a8322a' });
  };
  bag(0, .15, true); bag(0, 1.75, true);
  // Sewing head with red thread cones and the paper-tape reel.
  const sew = tag(s._group(g[3], [.42, 0, .55]), 'card11-sewing-head');
  box(s, sew, [.1, 1.3, .1], [.12, .65, 0], s.mat.trim, 'card11-sewing-post'); box(s, sew, [.46, .16, .2], [-.12, 1.22, 0], s.mat.white, 'card11-sewing-arm'); cyl(s, sew, .09, .2, [-.32, 1.15, 0], p.ivory, .07, 'card11-sewing-motor', 20);
  for (const [x, z] of [[.02, -.07], [.14, -.07], [.02, .07], [.14, .07]]) { cyl(s, sew, .045, .16, [x, 1.42, z], s.mat.red, .06, 'card11-thread-cone', 18); cyl(s, sew, .008, .24, [x, 1.45, z], s.mat.trim, .008, 'card11-thread-pin', 8); }
  cyl(s, sew, .22, .05, [.36, .95, .28], p.kraft, .22, 'card11-paper-tape', 32); cyl(s, sew, .24, .02, [.36, .91, .28], s.mat.trim, .24, 'card11-tape-tray', 28); bar(s, sew, [.36, 0, .28], [.36, .92, .28], .02, s.mat.trim, 'card11-tape-stand');
  // Band sealer: slotted casing, hood, twelve temperature controllers, display.
  const seal = tag(s._group(g[3], [.36, 0, 1.75]), 'card12-band-sealer');
  for (const z of [-.75, .75]) { box(s, seal, [.1, 1.0, .1], [.28, .5, z], sealGray, 'card12-sealer-post'); box(s, seal, [.3, .04, .2], [.28, .02, z], s.mat.trim, 'card12-sealer-foot'); }
  box(s, seal, [.46, .2, 1.9], [.02, 1.06, 0], sealGray, 'card12-sealer-casing'); box(s, seal, [.5, .02, 1.94], [.02, 1.17, 0], sealGray, 'card12-sealer-lid');
  repeated(s, seal, new THREE.BoxGeometry(.004, .016, .016), Array.from({ length: 40 }, (_, i) => ({ position: [-.212, 1.02 + (i % 4) * .03, (i < 20 ? -.82 : .25) + Math.floor((i % 20) / 4) * .05] })), s.mat.black, 'card12-casing-hole');
  cyl(s, seal, .12, .18, [.02, 1.27, .5], sealGray, .36, 'card12-sealer-hood', 4).rotation.y = PI / 4; cyl(s, seal, .045, .1, [.02, 1.41, .5], s.mat.trim, .045, 'card12-hood-outlet', 14);
  box(s, seal, [.34, .03, .3], [-.02, 1.0, 1.06], sealGray, 'card12-infeed-plate');
  const board = s._group(seal, [.06, 1.36, -.45]); board.rotation.y = -PI / 2;
  box(s, board, [.5, .36, .24], [0, 0, 0], sealGray, 'card12-controller-box');
  for (let i = 0; i < 12; i++) { box(s, board, [.062, .062, .01], [-.16 + (i % 4) * .105, .11 - Math.floor(i / 4) * .078, .125], s.mat.black, 'card12-temperature-controller'); box(s, board, [.04, .02, .004], [-.16 + (i % 4) * .105, .12 - Math.floor(i / 4) * .078, .132], s.mat.white, 'card12-controller-window'); }
  for (let i = 0; i < 6; i++) cyl(s, board, .012, .02, [-.18 + i * .072, -.13, .13], [s.mat.red, s.mat.mint, s.mat.yellow][i % 3], .012, 'card12-controller-lamp', 8).rotation.x = PI / 2;
  const sign = s._group(seal, [-.215, 1.06, -.05]); sign.rotation.y = -PI / 2;
  box(s, sign, [.28, .17, .008], [0, 0, 0], s.mat.white, 'card12-burn-sign'); warningTriangle(s, sign, [-.08, .01, .007], .1); filmedLettering(s, sign, '화상 주의', [.05, .02, .0065], .15, .06, 'card12-burn-sign-text', { background: '#f4f6f2', color: '#2c2c2c' });
  bar(s, seal, [.28, 1.0, -.1], [.28, 1.75, -.1], .03, s.mat.trim, 'card12-display-post'); box(s, seal, [.3, .16, .36], [.1, 1.82, -.1], s.mat.black, 'card12-weight-display');
  const digits = material(s, 'card12-pink-digits', 0x8a1c44, { emissive: 0xe0407f, emissiveIntensity: .9 }); box(s, seal, [.006, .07, .22], [-.055, 1.82, -.1], digits, 'card12-display-digits');
  pipe(s, seal, [[.06, 1.28, -.62], [-.12, 1.4, -1.0], [.05, 1.3, -1.35], [.0, 1.5, -1.8]], .01, s.mat.yellow, 'card12-coiled-air-line');
  // Dust-collector switchgear and the bag stack on its trolley.
  const box1 = tag(s._group(g[3], [-.98, 0, 1.25]), 'card11-collector-panel'); box(s, box1, [.42, 1.42, 1.0], [0, .82, 0], stainless, 'card11-collector-cabinet'); box(s, box1, [.36, .1, .94], [0, .06, 0], s.mat.trim, 'card11-collector-plinth');
  box(s, box1, [.006, 1.34, .006], [.214, .84, 0], s.mat.dark, 'card11-collector-door-gap'); box(s, box1, [.02, .12, .03], [.225, .85, .06], s.mat.black, 'card11-collector-handle');
  const stack = tag(s._group(g[3], [.92, 0, -.55]), 'card11-bag-stack'); box(s, stack, [.6, .04, .9], [0, .55, 0], s.mat.trim, 'card11-bag-trolley-top');
  for (const x of [-.26, .26]) for (const z of [-.4, .4]) box(s, stack, [.04, .53, .04], [x, .27, z], s.mat.trim, 'card11-bag-trolley-leg');
  for (let i = 0; i < 12; i++) box(s, stack, [.52 + (i % 3) * .012, .022, .80 + (i % 2) * .02], [((i * 7) % 5 - 2) * .006, .585 + i * .0245, ((i * 3) % 5 - 2) * .008], p.kraft, 'card11-empty-bag');
  const print = s._group(stack, [0, .871, 0]); print.rotation.x = -PI / 2; filmedLettering(s, print, 'SCE', [0, 0, 0], .3, .14, 'card11-stack-print', { background: '#a98a63', color: '#a8322a' });
  Object.assign(root.userData, { fieldCardVerified20261124: true, cardNumbers: [11, 12], planPositionMeasured: false, modelDimensionsMeasured: false });
}
function overlookedPackingCubicle(s, root, item, g) {
  const index=Number(item.id.at(-1))-1,width=index===2?1.85:2.1,depth=index===2?1.75:2.15,roof=index===2?2.5:2.4;
  const glass=cardPaints(s).smoke;
  const stainless=material(s,'route-packing-machined-stainless',0xa5b1b3,{roughness:.38,metalness:.62});
  box(s,g[0],[width+.07,.12,depth+.04],[0,.18,0],s.mat.trim,'observed-packing-base');
  for(const x of [-width/2,width/2])for(const z of [-depth/2,depth/2]){
    box(s,g[0],[.055,roof-.22,.055],[x,(roof+.22)/2,z],s.mat.trim,'observed-packing-cubicle-post');
    cyl(s,g[0],.065,.12,[x,.06,z],s.mat.trim,.065,'observed-packing-adjustable-foot');
  }
  if(index===1){
    box(s,g[0],[width+.15,.07,1.38],[0,roof-.13,.39],s.mat.white,'observed-packing-flat-roof');
    box(s,g[0],[width+.1,.07,.85],[0,roof+.1,-.65],s.mat.white,'observed-packing-stepped-rear-roof');
    box(s,g[0],[width+.08,.23,.035],[0,roof-.015,-.2],s.mat.steel,'observed-packing-roof-step-riser');
  }else box(s,g[0],[width+.15,.07,depth+.15],[0,roof,0],s.mat.white,'observed-packing-flat-roof');
  // 348/354/390s: folded sheet-metal roof edges and a deep rear service
  // enclosure distinguish the cabinets from empty transparent display boxes.
  for(const x of [-width/2-.04,width/2+.04])box(s,g[0],[.035,.085,depth+.13],[x,roof-.025,0],stainless,'observed-packing-folded-roof-edge');
  for(const z of [-depth/2-.04,depth/2+.04])box(s,g[0],[width+.1,.085,.035],[0,roof-.025,z],stainless,'observed-packing-folded-roof-edge');
  box(s,g[0],[width-.12,1.78,.12],[0,1.22,-depth/2+.045],stainless,'observed-packing-rear-service-casing');
  for(const x of [-width*.24,width*.24]){
    box(s,g[0],[.018,1.7,.016],[x,1.22,-depth/2-.023],s.mat.dark,'observed-packing-rear-panel-joint');
    box(s,g[0],[.035,.21,.035],[x+.13,1.23,-depth/2-.04],s.mat.dark,'observed-packing-rear-panel-handle');
  }
  for(const x of [-width/2,width/2]){
    box(s,g[0],[.025,1.54,depth-.12],[x,1.47,0],glass,'observed-packing-transparent-side');
    box(s,g[0],[.035,.46,depth-.1],[x,.48,0],cardPaints(s).ivoryDark,'observed-packing-lower-metal-panel');
  }
  for(const side of [-1,1]){
    const x=side*width/4,w=width/2-.04;
    box(s,g[0],[w,1.44,.025],[x,1.48,depth/2+.015],glass,'observed-packing-transparent-door');
    box(s,g[0],[w,.45,.035],[x,.485,depth/2+.025],glass,'observed-packing-lower-door-panel');
    for(const xx of [x-w/2,x+w/2])box(s,g[0],[.03,1.95,.04],[xx,1.27,depth/2+.04],s.mat.trim,'observed-packing-door-stile');
    for(const y of [.26,.72,2.24])box(s,g[0],[w,.03,.04],[x,y,depth/2+.04],s.mat.trim,'observed-packing-door-rail');
    box(s,g[0],[.12,.035,.05],[side*.13,1.14,depth/2+.075],s.mat.trim,'observed-packing-door-handle');
    for(const y of [.53,1.88])box(s,g[0],[.045,.1,.055],[side*(width/2-.025),y,depth/2+.055],s.mat.trim,'observed-packing-door-hinge');
  }
  packingDetailFeed(s,g[1],index);
  for(const x of [-.36,.36])for(const z of [-.28,.25])bar(s,g[2],[x,.4,z],[x,1.95,z],.027,s.mat.trim,'observed-packing-sealing-guide');
  for(const y of [.82,1.25])box(s,g[2],[.8,.12,.25],[0,y,.3],s.mat.dark,'observed-packing-sealing-block');
  const film=cyl(s,g[2],.23,.76,[0,1.45,-.45],s.mat.white,.23,'observed-packing-film-roll');film.rotation.z=PI/2;
  for(const x of [-.42,.42])bar(s,g[2],[x,.55,-.46],[x,1.7,-.46],.025,s.mat.trim,'observed-packing-film-support');
  const mechanics=tag(s._group(g[2]),'observed-packing-visible-filling-mechanism');
  Object.assign(mechanics.userData,{sourceTimes:[344,348,354,390],internalLayoutApproximate:true});
  // Only externally visible cylinders, film rollers and jaws are represented;
  // these are not a claimed reconstruction of the concealed drive train.
  for(const x of index===0?[-.34,.34]:[0]){
    cyl(s,mechanics,.095,.72,[x,1.9,-.18],stainless,.095,'observed-packing-vertical-filling-tube');
    cyl(s,mechanics,.2,.2,[x,1.52,-.18],stainless,.11,'observed-packing-forming-collar');
    ring(s,mechanics,.17,[x,1.62,-.18],s.mat.trim,.018);
    box(s,mechanics,[.28,.42,.025],[x,1.16,.09],s.mat.white,'observed-packing-visible-film-web');
    for(const side of [-1,1]){
      box(s,mechanics,[.12,.35,.085],[x+side*.19,1.15,.12],stainless,'observed-packing-film-pull-block');
      cyl(s,mechanics,.045,.19,[x+side*.23,.81,.14],s.mat.dark,.045,'observed-packing-pneumatic-actuator',12).rotation.z=PI/2;
    }
    box(s,mechanics,[.51,.085,.22],[x,.76,.18],stainless,'observed-packing-transverse-sealing-jaw');
  }
  for(const y of [1.66,1.9]){
    const roller=cyl(s,mechanics,.035,width*.72,[0,y,-.55],stainless,.035,'observed-packing-film-guide-roller',12);roller.rotation.z=PI/2;
    for(const x of [-width*.38,width*.38])box(s,mechanics,[.035,.43,.055],[x,1.75,-.55],stainless,'observed-packing-film-guide-bracket');
  }
  const spool=tag(s._group(g[2],[width/2+.16,1.03,-.51]),'observed-packing-side-reel');
  for(const x of [-.06,.06])cyl(s,spool,.27,.025,[x,0,0],stainless,.27,'observed-packing-side-reel-flange').rotation.z=PI/2;
  cyl(s,spool,.12,.18,[0,0,0],s.mat.white,.12,'observed-packing-side-reel-hub').rotation.z=PI/2;
  pipe(s,g[2],[[width/2+.18,1.16,-.54],[width/2+.26,.55,-.54],[width/2+.26,.22,.1],[.35,.22,.25]],.018,s.mat.black,'observed-packing-visible-service-cable');
  beltPath(s,g[2],[[0,.65],[0,1.5],[.25,2.12]],.5,.72);
  packingDetailControl(s,g[2],index,width,depth);
  root.userData.cardNumber=packingCardDetails(s,g,index,width,depth);
  Object.assign(root.userData,{observedRoofedPackingCubicle:true,packingNativeVariant:index===0?'twin-outlet-left-assembly':index===1?'stepped-roof-round-feed':'front-screen-round-feed',exactOpenLineToCabinetIdentityConfirmed:false});
  if(index===0){packingDetailPlatform(s,g[3],item);Object.assign(root.userData,{sharedPackingPlatformOwner:true,observedMinimumRoofedCubicles:3,commonPlatformElevation:2.8,individualMachineSerialsConfirmed:false});}
}
function overlookedInspection(s, root, item, g) {
  // 352/390s show compact stainless trays/benches; the older black-curtain
  // X-ray tunnel was never established by these overlook images.
  const index=Number(item.id.at(-1))-1;
  legs(s,g[0],.95,1.25,.82);
  box(s,g[0],[1.12,.075,1.42],[0,.86,0],s.mat.steel,'observed-stainless-output-bench');
  const trayXs=index===0?[-.27,.27]:[0],trayW=index===0?.43:.78;
  for(const x of trayXs){
    box(s,g[1],[trayW,.025,.68],[x,.906,-.12],s.mat.dark,'observed-output-inset-tray');
    for(const z of [-.47,.23])box(s,g[1],[trayW+.04,.055,.025],[x,.93,z],s.mat.trim,'observed-output-tray-rim');
    for(const xx of [x-trayW/2,x+trayW/2])box(s,g[1],[.025,.055,.72],[xx,.93,-.12],s.mat.trim,'observed-output-tray-rim');
  }
  box(s,g[0],[.85,.3,.3],[0,.54,-.38],s.mat.steel,'observed-output-underbench-box');
  if(index!==0){
    box(s,g[2],[.045,.65,.045],[.4,1.2,-.53],s.mat.trim,'observed-output-control-post');
    box(s,g[2],[.32,.28,.12],[.35,1.48,-.5],s.mat.steel,'observed-output-compact-control');
    box(s,g[2],[.23,.14,.015],[.35,1.51,-.432],s.mat.screen,'observed-output-control-screen');
    cyl(s,g[2],.035,.14,[.35,1.72,-.5],s.mat.red,.035,'observed-output-stack-light');
  }
  for(const x of [-.35,0,.35])box(s,g[2],[.07,.018,.24],[x,.92,.48],s.mat.trim,'observed-output-guide-strip');
  root.userData.observedDownstreamInspection={currentInspectionTechnologyConfirmed:false,historicalIdRetained:item.id,blackCurtainTunnelObserved:false};
}
function transferDetailInstances(s,parent,entries,paint,name,shape='box') {
  if(!entries.length)return null;
  const cache=s._dryerTransferGeometry ||=new Map();
  if(!cache.has(shape)){const geo=shape==='box'?new THREE.BoxGeometry(1,1,1):new THREE.CylinderGeometry(1,1,1,10);cache.set(shape,geo);s.geometries?.add(geo);}
  const node=new THREE.InstancedMesh(cache.get(shape),paint,entries.length),dummy=new THREE.Object3D();
  entries.forEach(([p,size,rotation=[0,0,0]],index)=>{dummy.position.set(...p);dummy.scale.set(...size);dummy.rotation.set(...rotation);dummy.updateMatrix();node.setMatrixAt(index,dummy.matrix);});
  node.instanceMatrix.needsUpdate=true;node.castShadow=node.receiveShadow=true;node.computeBoundingBox();node.computeBoundingSphere();parent.add(node);return tag(node,name);
}
function transferDetailBed(s,parent,a,b,width=.7,height=.78,name='observed-transfer-bed') {
  const length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length<.04)return;
  const root=tag(s._group(parent,[(a[0]+b[0])/2,0,(a[1]+b[1])/2]),name);root.rotation.y=Math.atan2(b[0]-a[0],b[1]-a[1]);
  Object.assign(root.userData,{observedVisibleSegment:true,sourceTimes:[234,252,264,270,282],completeHiddenConnectionConfirmed:false,width,rollerHeight:height});
  transferDetailInstances(s,root,[[[0,height-.075,0],[width,.07,length]]],s.mat.dark,'observed-transfer-dark-bed');
  const frame=[],feet=[];
  for(const x of [-width/2-.035,width/2+.035]){
    frame.push([[x,height-.035,0],[.055,.15,length]],[[x,height+.1,0],[.025,.035,length]]);
    const supports=Math.max(2,Math.ceil(length/1.65)+1);
    for(let i=0;i<supports;i++){const z=(i/(supports-1)-.5)*(length-.13);frame.push([[x,(height-.12)/2,z],[.055,height-.12,.055]]);feet.push([[x,.025,z],[.15,.05,.15]]);}
  }
  transferDetailInstances(s,root,frame,s.mat.trim,'observed-transfer-frame-and-legs');transferDetailInstances(s,root,feet,s.mat.dark,'observed-transfer-adjustable-feet');
  const count=Math.max(3,Math.ceil(length/.13)),rollers=[];
  for(let i=0;i<count;i++)rollers.push([[0,height,-length/2+(i+.5)*length/count],[.043,width,.043],[0,0,PI/2]]);
  transferDetailInstances(s,root,rollers,s.mat.steel,'observed-transfer-roller-bank','cylinder');
  return root;
}
function transferDetailFence(s,parent,a,b,height=1.48) {
  const length=Math.hypot(b[0]-a[0],b[1]-a[1]);if(length<.08)return;
  const yellow=material(s,'observed-arm-fence-yellow',0xd7ae36),root=tag(s._group(parent,[a[0],0,a[1]]),'observed-yellow-mesh-panel');root.rotation.y=-Math.atan2(b[1]-a[1],b[0]-a[0]);
  const entries=[];for(const x of [0,length/2,length])entries.push([[x,height/2,.0],[.045,height,.045]]);
  for(const y of [.12,height*.52,height])entries.push([[length/2,y,0],[length,.035,.035]]);
  const verticals=Math.max(2,Math.ceil(length/.17));for(let i=1;i<verticals;i++)entries.push([[i*length/verticals,height/2,0],[.008,height-.17,.018]]);
  for(let y=.3;y<height-.1;y+=.23)entries.push([[length/2,y,.005],[length,.008,.018]]);
  const mesh=transferDetailInstances(s,root,entries,yellow,'observed-yellow-fence-wire');mesh.userData.instancedFenceRods=true;
  Object.assign(root.userData,{sourceTimes:[234,252,282],fencePatternRepresentative:true});return root;
}
function transferDetailCasePacker(s,parent,local,index) {
  const cream=material(s,'observed-carton-machine-cream',0xd6d4b9),glass=material(s,'observed-carton-machine-glazing',0x5e7b73,{transparent:true,opacity:.38,depthWrite:false,side:THREE.DoubleSide});
  const root=tag(s._group(parent,[local[0],0,local[1]]),`observed-carton-machine-${index}`);root.rotation.y=-PI/2;
  Object.assign(root.userData,{sourceTimes:[234,252,282],machineFunctionConfirmed:false,manufacturerConfirmed:false,nominalDimensionsMeasured:false});
  const frame=[[[0,.15,0],[1.65,.2,1.95]],[[0,2.23,0],[1.78,.1,2.02]],[[0,1.0,-.93],[1.65,.14,.1]]];
  for(const x of [-.69,.69]){frame.push([[x,.61,0],[.28,.8,1.85]]);for(const z of [-.85,.85])frame.push([[x,1.61,z],[.07,1.18,.07]]);}
  transferDetailInstances(s,root,frame,cream,'observed-carton-machine-body');
  for(const z of [-.88,.88]){
    transferDetailInstances(s,root,[[[0,1.62,z],[1.3,1.02,.025]]],glass,'observed-carton-machine-dark-window');
    transferDetailInstances(s,root,[[[0,1.62,z+.024],[.035,1.04,.035]],[[.15,1.61,z+.035],[.025,.23,.025]]],s.mat.trim,'observed-carton-window-mullion-handle');
  }
  transferDetailBed(s,root,[0,-1.65],[0,1.65],.72,.78,`observed-carton-machine-belt-${index}`);
  box(s,root,[.33,.64,.19],[.98,1.15,.49],s.mat.trim,'observed-carton-local-control');box(s,root,[.23,.22,.022],[.98,1.27,.596],s.mat.screen,'observed-carton-control-screen');
  for(const x of [.91,1.05])cyl(s,root,.025,.03,[x,1.0,.605],x>.98?s.mat.red:s.mat.mint,.025,'observed-carton-control-button',10).rotation.x=PI/2;
  cyl(s,root,.055,.14,[.66,2.36,.65],s.mat.red,.055,'observed-carton-status-lamp',12);
  const detail=tag(s._group(root),'clip2-observed-carton-detail');
  Object.assign(detail.userData,{sourceReferences:[{clipId:'first-floor-20261113-clip2',times:index===1?[138,141,144]:[30,36,42,60]}],machineFunctionConfirmed:false,mechanismsAnimate:false,dimensionsMeasured:false});
  if(index===1){
    // The close walk shows an open upright motor/guide assembly and exposed
    // cable loops, rather than another repeated closed cream cabinet.
    for(const x of [-.48,-.18])box(s,detail,[.075,2.95,.09],[x,1.6,-.62],s.mat.trim,'clip2-vertical-guide-column');
    box(s,detail,[.7,.52,.4],[-.33,2.37,-.62],cream,'clip2-upright-sliding-head');
    motor(s,detail,[-.33,2.93,-.62],.17,.4,true);
    pipe(s,detail,[[-.38,2.45,-.6],[-.62,3.04,-.55],[-.08,3.15,-.48],[.15,2.98,-.38],[.05,2.35,-.35]],.025,s.mat.black,'clip2-upright-cable-loop');
    box(s,detail,[.64,.2,.48],[.12,1.63,.4],material(s,'clip2-observed-orange',0xc17b32),'clip2-observed-tool-head');
    const belt=box(s,detail,[.6,.035,2.65],[0,.88,.15],material(s,'clip2-green-belt',0x2c6c52),'clip2-green-visible-belt');belt.userData.completeLineConnectionConfirmed=false;
    for(const side of [-1,1])box(s,detail,[.035,.12,2.68],[side*.34,.92,.15],s.mat.trim,'clip2-belt-side-guide');
    for(const x of [-.18,0,.18])pipe(s,detail,[[x+.9,1.65,.48],[x+.91,.8,.45],[x+.75,.3,.3],[x+.4,.25,.1]],.015,s.mat.black,'clip2-exposed-control-cable');
  }else{
    const cardboard=material(s,'clip2-corrugated-cardboard',0xac9472),orange=material(s,'clip2-observed-orange',0xc17b32);
    box(s,detail,[1.28,.15,1.7],[0,.84,1.68],s.mat.trim,'clip2-flat-carton-magazine-tray');
    const sheets=Array.from({length:36},(_,i)=>[[0,1.4,1.03+i*.034],[1.15,.95,.013]]);
    transferDetailInstances(s,detail,sheets,cardboard,'clip2-upright-carton-blanks');
    for(const side of [-1,1])box(s,detail,[.04,.22,1.7],[side*.63,.98,1.68],s.mat.trim,'clip2-carton-magazine-guide');
    for(const x of [-.53,.53])box(s,detail,[.07,2.07,.1],[x,1.14,2.67],s.mat.trim,'clip2-carton-pick-guide');
    box(s,detail,[1.18,.38,.34],[0,1.83,2.67],orange,'clip2-orange-carton-pick-head');
    box(s,detail,[.34,.6,.34],[.6,.8,2.67],orange,'clip2-orange-drive-cover');
    pipe(s,detail,[[.55,1.92,2.66],[.92,2.1,2.64],[1.0,1.52,2.52],[.72,1.1,2.5]],.025,s.mat.black,'clip2-magazine-service-hose');
    // Card 04 (2026-11-24): orange perforated end guard in two tiers, orange side
    // rails with black chains, two magazine arms with yellow caps, tablet on a stand.
    const guardOrange=material(s,'card04-guard-orange',0xd9662a,{roughness:.46,metalness:.14}),slots=[];
    box(s,detail,[1.34,.56,.05],[0,1.46,-.965],guardOrange,'card04-upper-perforated-guard');
    box(s,detail,[1.4,.2,.07],[0,1.06,-.97],guardOrange,'card04-lower-perforated-guard');
    box(s,detail,[1.4,.15,.06],[0,1.98,-.965],guardOrange,'card04-top-guard-beam');
    box(s,detail,[1.44,.05,.09],[0,1.175,-.97],s.mat.white,'card04-guard-ledge');
    for(const x of[-.62,.62])box(s,detail,[.07,1.1,.07],[x,1.52,-.96],s.mat.trim,'card04-guard-post');
    for(let row=0;row<8;row++)for(let column=0;column<22;column++)if(Math.abs(column-10.5)>.8)slots.push([[-.588+column*.056,1.24+row*.062,-.992],[.034,.014,.004]]);
    for(let row=0;row<3;row++)for(let column=0;column<22;column++)slots.push([[-.588+column*.056,1.0+row*.058,-1.007],[.034,.014,.004]]);
    transferDetailInstances(s,detail,slots,s.mat.black,'card04-guard-perforation');
    for(const side of[-1,1]){
      box(s,detail,[.16,.04,1.7],[side*.36,.9,-.02],guardOrange,'card04-orange-side-rail');
      box(s,detail,[.03,.05,1.6],[side*.25,.91,-.02],s.mat.black,'card04-rail-chain');
      bar(s,detail,[side*.2,.95,.95],[side*.3,1.0,2.55],.03,s.mat.trim,'card04-magazine-arm');
      box(s,detail,[.12,.1,.14],[side*.3,1.0,2.58],s.mat.yellow,'card04-magazine-yellow-cap');
    }
    const tablet=tag(s._group(detail,[1.12,0,-.45]),'card04-tablet-stand');
    cyl(s,tablet,.022,1.28,[0,.64,0],s.mat.black,.022,'card04-stand-post',12);box(s,tablet,[.26,.03,.2],[0,.015,0],s.mat.black,'card04-stand-foot');
    box(s,tablet,[.06,.2,.3],[0,1.36,0],s.mat.black,'card04-tablet-case');box(s,tablet,[.006,.16,.25],[.034,1.36,0],s.mat.screen,'card04-tablet-screen');
    box(s,detail,[.06,.3,.24],[.86,1.62,-.5],s.mat.white,'card04-button-panel');
    for(let row=0;row<3;row++)for(let column=0;column<3;column++)cyl(s,detail,.017,.02,[.895,1.7-row*.08,-.57+column*.07],[s.mat.red,s.mat.mint,s.mat.black][(row+column)%3],.017,'card04-panel-button',10).rotation.z=PI/2;
    root.userData.cardNumber=4;
    const opened=tag(s._group(detail,[-.84,.76,.9]),'clip2-fixed-open-teal-service-leaf');opened.rotation.y=-1.1;
    Object.assign(opened.userData,{fixedFilmedPose:true,sourceReferences:[{clipId:'first-floor-20261113-clip2',times:[60]}],notAnInterRoomDoor:true});
    for(const x of [.025,.695])box(s,opened,[.05,1.1,.035],[x,.55,0],cream,'clip2-service-leaf-frame');
    for(const y of [.025,1.075])box(s,opened,[.72,.05,.035],[.36,y,0],cream,'clip2-service-leaf-frame');
    box(s,opened,[.59,.94,.045],[.36,.55,.015],material(s,'clip2-teal-service-glass',0x38938e,{transparent:true,opacity:.48,depthWrite:false}),'clip2-teal-service-window');
    box(s,opened,[.025,.2,.04],[.64,.53,.045],s.mat.trim,'clip2-service-leaf-handle');
    for(const [i,color]of [s.mat.mint,s.mat.yellow,s.mat.red].entries())cyl(s,detail,.055,.13,[.55,2.36+i*.13,2.66],color,.055,'clip2-three-color-status-lens',12);
    const bag=tag(s._group(detail,[1.18,0,1.8]),'clip2-blue-lined-waste-stand'),blue=material(s,'clip2-blue-polyethylene',0x2e74b2,{roughness:.58});
    cyl(s,bag,.24,.67,[0,.38,0],blue,.19,'clip2-blue-bag-body',20);ring(s,bag,.24,[0,.73,0],s.mat.trim,.012);
    for(const x of [-.25,.25])bar(s,bag,[x,.02,0],[x,.76,0],.012,s.mat.trim,'clip2-waste-stand-leg');
  }
  return root;
}
function transferDetailCurve(s,parent,center,radius=1.05,width=.75,height=.78) {
  const root=tag(s._group(parent,[center[0],0,center[1]]),'observed-brown-quarter-roller');
  const brown=material(s,'observed-curve-orange-brown',0xa9683d),rollers=[],frames=[],supports=[],count=19;
  for(let i=0;i<count;i++){
    const a=PI-i*PI/2/(count-1),x=Math.cos(a),z=Math.sin(a);
    rollers.push([[x*radius,height,z*radius],[.043,width,.043],[0,-a,PI/2]]);
    for(const side of [-1,1]){const r=radius+side*(width/2+.045),next=a-PI/2/(count-1),middle=(a+next)/2,span=r*PI/2/(count-1);if(i<count-1)frames.push([[Math.cos(middle)*r,height+.09,Math.sin(middle)*r],[.04,.11,span*1.04],[0,-middle,0]]);}
    if(i%6===0)for(const side of [-1,1]){const r=radius+side*width*.44;supports.push([[x*r,(height-.12)/2,z*r],[.06,height-.12,.06]]);}
  }
  transferDetailInstances(s,root,rollers,brown,'observed-orange-brown-radial-rollers','cylinder');transferDetailInstances(s,root,frames,s.mat.trim,'observed-curved-side-guide-rails');transferDetailInstances(s,root,supports,s.mat.trim,'observed-curved-support-legs');
  Object.assign(root.userData,{visibleArcDegrees:90,fullReturnLoopConfirmed:false,sourceTimes:[234,264,270],nominalDimensionsMeasured:false});return root;
}
function overlookedRollerCollector(s, root, item, g) {
  // Local +Z follows the visible cross-hall collector. The two case machines
  // sit in separate column bays, rather than on an invented full line graph.
  transferDetailBed(s,g[0],[0,-5.1],[0,5.0],.76,.78,'observed-green-collector');
  transferDetailBed(s,g[0],[-1.55,-3.0],[-1.55,3.9],.68,.78,'observed-green-parallel-visible-run');
  for(const [index,z]of [-3.3,.4].entries()){
    transferDetailCasePacker(s,g[1],[4.2,z],index+1);
    // 252/282 show local cell fencing, with an opening at the roller mouth.
    transferDetailFence(s,g[1],[5.95,z-1.22],[5.95,z+1.22]);
    transferDetailFence(s,g[1],[5.95,z-1.22],[2.2,z-1.22]);transferDetailFence(s,g[1],[5.95,z+1.22],[2.2,z+1.22]);
    for(const [from,to]of [[z-1.22,z-.48],[z+.48,z+1.22]])transferDetailFence(s,g[1],[2.2,from],[2.2,to]);
  }
  // The first output bends beside the fixed column at world[-5.3,13.3].
  transferDetailBed(s,g[0],[2.55,-3.3],[2.1,-3.3],.68,.78,'observed-green-machine-outfeed');
  transferDetailBed(s,g[0],[2.1,-3.3],[1.1,-1.4],.68,.78,'observed-green-column-bypass');
  transferDetailBed(s,g[0],[1.1,-1.4],[.46,-1.4],.68,.78,'observed-green-roller-branch');
  transferDetailBed(s,g[0],[2.55,.4],[.46,.4],.68,.78,'observed-green-roller-branch');
  transferDetailBed(s,g[0],[0,5.0],[.9,7.3],.72,.78,'observed-green-short-angled-transfer');
  motor(s,g[2],[.53,.43,-4.65],.13,.35);
  Object.assign(root.userData,{observedGreenRollerBranches:2,visibleCartonMachineSilhouettes:2,sourceTimes:[234,252,282],hiddenBlueToGreenConnectionConfirmed:false,completeTransferTopologyConfirmed:false});
}
function overlookedRollerReturn(s, root, item, g) {
  // Only the seen bend and adjoining fragments are asserted, never a hidden
  // full U-loop or a route back into the blue filling room.
  transferDetailBed(s,g[0],[0,-2.2],[0,1.4],.75,.78,'observed-green-return-line');
  transferDetailCurve(s,g[0],[1.05,1.4],1.05,.75,.78);
  transferDetailBed(s,g[0],[1.05,2.45],[2.45,2.45],.75,.78,'observed-green-arm-infeed');
  // 2026-11-26: 끝이 허공에서 끊기던 비스듬한 짧은 롤러 토막은 사용자 요청으로 뺐다.
  motor(s,g[2],[-.52,.43,-1.8],.13,.35);
  const carton=tag(s._group(g[1],[.3,.84,2.1]),'clip2-open-carton-on-curve'),cardboard=material(s,'clip2-corrugated-cardboard',0xac9472);
  Object.assign(carton.userData,{sourceReferences:[{clipId:'first-floor-20261113-clip2',times:[48]}],staticObservedProp:true,brandAndContentsConfirmed:false});
  box(s,carton,[.55,.025,.5],[0,.0125,0],cardboard,'clip2-carton-base');
  for(const x of [-.265,.265])box(s,carton,[.025,.42,.5],[x,.23,0],cardboard,'clip2-carton-side');
  for(const z of [-.24,.24])box(s,carton,[.55,.42,.025],[0,.23,z],cardboard,'clip2-carton-side');
  Object.assign(root.userData,{hiddenBlueToGreenConnectionConfirmed:false,visibleCurveDegrees:90,fullReturnLoopConfirmed:false,sourceTimes:[234,264,270,282]});
}
function overlookedArticulatedArm(s, root, item, g) {
  // 2026-11-26 사용자 확인: 1층 적재 로봇은 1대다. 사진(101925, 102030, 102847)대로
  // 파란 베이스·기둥에 크림색 평행 링크 팔, 포대를 집는 포크형 그리퍼를 단다.
  const blue=material(s,'observed-arm-blue',0x315b92),light=material(s,'observed-arm-light',0xd6cfb4);
  const arm={id:'blue',base:[.9,0,-.6],shoulder:[.9,2.45,-.6],elbow:[.2,3.2,.95],wrist:[-1.75,2.6,2.65]};
  const [bx,,bz]=arm.base,base=tag(s._group(g[0],[bx,0,bz]),'observed-blue-arm-base-assembly');
  transferDetailInstances(s,base,[[[0,.09,0],[1.12,.18,1.05]],[[0,.72,0],[.66,1.15,.68]]],blue,'observed-blue-arm-base');
  cyl(s,base,.34,.16,[0,1.37,0],blue,.38,'observed-blue-arm-turntable');
  // 공정순서 영상(15:00~15:55, FUJI-ACE)과 101925 사진: 파란 베이스 위 크림색 몸체 하우징.
  box(s,base,[.46,.5,.54],[0,1.62,0],blue,'observed-blue-arm-column');
  const housing=box(s,base,[.78,.95,.7],[0,2.1,.05],light,'photo-20261126-cream-robot-body-housing');housing.userData.modelSeenInProcessVideo='FUJI-ACE';
  const link=tag(s._group(g[1]),'observed-blue-articulated-arm');
  Object.assign(link.userData,{sourceTimes:[282],photos:['101925','102030','102847'],armStyle:'blue-body-cream-links',basePosition:arm.base,robotCount:1,robotCountBasis:'user-confirmed-20261126',operatingEnvelopeConfirmed:false});
  for(const dz of [-.15,.15]){
    bar(s,link,[arm.shoulder[0],arm.shoulder[1],arm.shoulder[2]+dz],[arm.elbow[0],arm.elbow[1],arm.elbow[2]+dz],.13,light,'observed-articulated-upper-arm');
    bar(s,link,[arm.elbow[0],arm.elbow[1],arm.elbow[2]+dz],[arm.wrist[0],arm.wrist[1],arm.wrist[2]+dz],.1,light,'observed-articulated-forearm');
  }
  for(const p of [arm.shoulder,arm.elbow,arm.wrist])cyl(s,link,.18,.46,p,blue,.18,'observed-articulated-arm-joint',20).rotation.x=PI/2;
  pipe(s,link,[[bx+.18,1.1,bz-.26],[arm.shoulder[0]+.14,arm.shoulder[1]+.12,arm.shoulder[2]-.26],[arm.elbow[0],arm.elbow[1]+.2,arm.elbow[2]-.24],[arm.wrist[0],arm.wrist[1]+.12,arm.wrist[2]-.22]],.026,s.mat.black,'observed-arm-service-hose');
  const end=tag(s._group(g[2]),'observed-blue-end-tool'),headY=arm.wrist[1]-.42;
  bar(s,end,arm.wrist,[arm.wrist[0],headY+.12,arm.wrist[2]],.07,blue,'observed-arm-wrist-drop');
  box(s,end,[.34,.22,.3],[arm.wrist[0],headY+.16,arm.wrist[2]],blue,'photo-20261126-gripper-actuator');
  box(s,end,[.86,.1,.62],[arm.wrist[0],headY,arm.wrist[2]],light,'photo-20261126-bag-fork-gripper');
  const tines=[];for(let i=0;i<7;i++)for(const z of [-.24,.24])tines.push([[arm.wrist[0]-.36+i*.12,headY-.21,arm.wrist[2]+z],[.022,.36,.022]]);
  transferDetailInstances(s,end,tines,s.mat.trim,'photo-20261126-bag-fork-tines','cylinder');
  Object.assign(end.userData,{gripperType:'bag-fork',tineCountRepresentative:true});
  // Three distinct narrow lanes and cream dividers replace the former single
  // broad empty rectangle, matching the directly visible alignment bank.
  for(const [index,z]of [-2.4,-1.55,-.7].entries()){
    const lane=transferDetailBed(s,g[3],[-3.2,z],[-.3,z],.55,.8,`observed-arm-alignment-lane-${index+1}`);lane.userData.alignmentLane=index+1;
  }
  transferDetailBed(s,g[3],[1.4,1.0],[1.4,3.4],.86,.8,'observed-pallet-side-bed');
  // Leave a genuine opening where the visible brown bend enters the cell.
  const fences=[ [[-3.85,-2.75],[2.45,-2.75]],[[2.45,-2.75],[2.45,3.85]],[[2.45,3.85],[-3.85,3.85]],[[-3.85,1.4],[-3.85,3.85]],[[-3.0,.0],[-.4,.0]], [[-.2,.6],[2.45,.6]] ];
  for(const [a,b]of fences)transferDetailFence(s,g[3],a,b,1.48);
  // 2026-11-26 1.5층 사진(101925, 102847): 파란 로봇이 SCE 크라프트 포대를 빨간 파레트에 쌓는 중이다.
  const sackPaint=material(s,'photo-20261126-kraft-sack',0xcdb48a),palletPaint=material(s,'photo-20261126-red-pallet',0xc2463a);
  const sackStack=tag(s._group(g[3],[-1.75,0,2.65]),'photo-20261126-sce-sack-pallet');
  Object.assign(sackStack.userData,{source:'field-photos-20261126-floor1',photos:['101925','101926','102847'],layersObserved:'4-5',movableContext:true,dimensionsMeasured:false});
  transferDetailInstances(s,sackStack,[[[0,.07,0],[1.1,.14,1.1]]],palletPaint,'photo-20261126-red-plastic-pallet');
  const sacks=[];
  for(let layer=0;layer<4;layer++)for(let i=0;i<3;i++)for(let j=0;j<2;j++){const along=layer%2===0,a=-.36+i*.36,b=-.26+j*.52;sacks.push([along?[a,.23+layer*.17,b]:[b,.23+layer*.17,a],along?[.34,.16,.5]:[.5,.16,.34]]);}
  transferDetailInstances(s,sackStack,sacks,sackPaint,'photo-20261126-sce-kraft-sacks');
  // 2026-11-26 사진(101957, 102030, 102717): 셀 서쪽 펜스 밖 로봇 조작반과 회색 로봇 제어 캐비닛.
  const panelGray=material(s,'photo-20261126-panel-gray',0xc9cdca),screen=material(s,'photo-20261126-panel-screen',0x1d3a46,{emissive:0x12303a,emissiveIntensity:.4});
  const lampRed=material(s,'photo-20261126-lamp-red',0xd4382c,{emissive:0x8a1408,emissiveIntensity:.6}),lampGreen=material(s,'photo-20261126-lamp-green',0x37c46a,{emissive:0x0f7a32,emissiveIntensity:.7}),lampYellow=material(s,'photo-20261126-lamp-yellow',0xe8c030,{emissive:0x6a5200,emissiveIntensity:.5});
  const consoleRoot=tag(s._group(g[3],[-4.3,0,1.75]),'photo-20261126-robot-operator-console');
  Object.assign(consoleRoot.userData,{photos:['101957','102030'],function:'palletizing robot operation (start/stop, recipe, teach pendant)',dimensionsMeasured:false});
  transferDetailInstances(s,consoleRoot,[[[0,.55,0],[.09,1.1,.09]],[[0,.02,0],[.45,.04,.4]],[[0,1.18,0],[.55,.36,.38]]],panelGray,'photo-20261126-console-stand-and-box');
  box(s,consoleRoot,[.48,.05,.34],[0,1.39,.02],panelGray,'photo-20261126-console-sloped-top').rotation.x=-.35;
  box(s,consoleRoot,[.26,.18,.012],[-.08,1.41,.2],screen,'photo-20261126-console-touch-screen').rotation.x=-.35;
  for(const [i,mat]of [lampGreen,s.mat.black,lampYellow].entries())cyl(s,consoleRoot,.022,.03,[.08+i*.06,1.2,.2],mat,.022,'photo-20261126-console-button',12).rotation.x=PI/2;
  cyl(s,consoleRoot,.04,.05,[.2,1.08,.2],s.mat.red,.04,'photo-20261126-console-emergency-stop',16).rotation.x=PI/2;
  box(s,consoleRoot,[.3,.4,.01],[-.15,1.05,.195],s.mat.white,'photo-20261126-console-checklist-sheet');
  box(s,consoleRoot,[.12,.24,.06],[.33,1.05,0],s.mat.black,'photo-20261126-robot-teach-pendant');
  cyl(s,consoleRoot,.016,.7,[-.24,1.7,-.1],s.mat.trim,.016,'photo-20261126-console-light-pole',8);
  for(const [i,mat]of [lampGreen,lampYellow,lampRed].entries())cyl(s,consoleRoot,.04,.07,[-.24,2.08+i*.072,-.1],mat,.04,'photo-20261126-console-stack-light',14);
  const cabinet=tag(s._group(g[3],[-4.35,0,2.9]),'photo-20261126-robot-controller-cabinet');
  Object.assign(cabinet.userData,{photos:['102717','101849'],function:'robot controller / power cabinet; nameplate unread',dimensionsMeasured:false});
  transferDetailInstances(s,cabinet,[[[0,1.0,0],[.6,1.9,.55]],[[0,.04,0],[.62,.08,.57]],[[0,1.97,0],[.64,.04,.58]]],panelGray,'photo-20261126-controller-body');
  transferDetailInstances(s,cabinet,[[[.305,1.0,0],[.012,1.8,.004]],[[.305,1.55,.2],[.02,.1,.03]],[[.305,.5,.2],[.02,.1,.03]]],s.mat.black,'photo-20261126-controller-door-details');
  transferDetailInstances(s,cabinet,Array.from({length:6},(_,i)=>[[.307,.3+i*.05,-.12],[.01,.012,.18]]),s.mat.trim,'photo-20261126-controller-louvers');
  box(s,cabinet,[.01,.16,.22],[.31,1.6,-.12],s.mat.white,'photo-20261126-controller-warning-label');
  bar(s,cabinet,[0,1.99,-.15],[.8,2.6,-.4],.03,s.mat.black,'photo-20261126-controller-cable-to-robot');
  Object.assign(root.userData,{observedBlueArticulatedArm:true,observedMinimumArticulatedArms:1,palletizingRobotCount:1,robotCountBasis:'user-confirmed-20261126',observedAlignmentLaneCount:3,sourceTimes:[252,270,282],operatingEnvelopeConfirmed:false,operatingAnimationAdded:false,completeCellConnectivityConfirmed:false});
}
function observedOverlookEquipment(s, root, item, g) {
  const builder = { 'overlook-packing-cubicle': overlookedPackingCubicle, 'overlook-inspection': overlookedInspection, 'overlook-roller-collector': overlookedRollerCollector, 'overlook-roller-return': overlookedRollerReturn, 'overlook-articulated-arm': overlookedArticulatedArm }[item.dryerRoute?.kind];
  if (!builder) return false;
  builder(s, root, item, g);
  Object.assign(root.userData, { observedRouteEquipment: { ...item.dryerRoute }, historicalEquipmentIdentityConfirmed: false, modelDimensionsMeasured: false });
  return true;
}

function fourthGrating(s, parent, { minX, maxX, minZ, maxZ, y, hole = null }, mat, name = 'fourth-grating-bars') {
  const poses = [];
  for (let x = minX + .06; x <= maxX - .06; x += .11) {
    if (!hole || x < hole.minX || x > hole.maxX) {
      poses.push({ position: [x, y + .012, (minZ + maxZ) / 2], scale: [.016, .022, maxZ - minZ - .06] });
    } else {
      if (hole.minZ - minZ > .12) poses.push({ position: [x, y + .012, (minZ + hole.minZ) / 2], scale: [.016, .022, hole.minZ - minZ - .04] });
      if (maxZ - hole.maxZ > .12) poses.push({ position: [x, y + .012, (hole.maxZ + maxZ) / 2], scale: [.016, .022, maxZ - hole.maxZ - .04] });
    }
  }
  if (!poses.length) return null;
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const inst = new THREE.InstancedMesh(geo, mat, poses.length), m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
  poses.forEach((p, i) => { m4.compose(new THREE.Vector3(...p.position), q, new THREE.Vector3(...p.scale)); inst.setMatrixAt(i, m4); });
  inst.instanceMatrix.needsUpdate = true; inst.castShadow = false; inst.receiveShadow = true;
  inst.computeBoundingBox(); inst.computeBoundingSphere();
  s.geometries?.add(geo); parent.add(inst); return tag(inst, name);
}
function fourthCoilSpring(s, parent, position, height = .26, radius = .075, mat) {
  const g = tag(s._group(parent, position), 'fourth-coil-spring');
  const pts = Array.from({ length: 45 }, (_, i) => {
    const a = i / 44 * 4.5 * PI * 2;
    return new THREE.Vector3(Math.cos(a) * radius, (i / 44 - .5) * height, Math.sin(a) * radius);
  });
  s._mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, .016, 6, false), mat, g);
  for (const sy of [-height / 2 - .015, height / 2 + .015]) cyl(s, g, radius * 1.25, .026, [0, sy, 0], s.mat.trim, radius * 1.25, 'fourth-spring-seat', 18);
  return g;
}
function fourthVinylSleeve(s, parent, x, z, y0, y1, radius, vinylMat, tapeMat) {
  const h = y1 - y0, mid = (y0 + y1) / 2;
  cyl(s, parent, radius * .93, h, [x, mid, z], s.mat.steel, radius * .93, 'fourth-chute-inner-spool', 24);
  cyl(s, parent, radius * 1.04, h * .92, [x, mid, z], vinylMat, radius * .98, 'fourth-vinyl-wrap', 28);
  for (const ty of [y0 + .05, mid, y1 - .05]) {
    cyl(s, parent, radius * 1.06, .048, [x, ty, z], tapeMat, radius * 1.06, 'fourth-waterproof-tape-band', 28);
  }
}
function fourthTiltedVibroMotor(s, parent, position, tiltSign, blueMat, orangeMat) {
  const g = tag(s._group(parent, position), 'fourth-blue-vibro-motor');
  g.rotation.x = tiltSign * .58;
  g.rotation.z = .18;
  cyl(s, g, .155, .44, [0, 0, 0], blueMat, .155, 'vibro-motor-body', 22);
  for (const sy of [-.20, .20]) cyl(s, g, .168, .065, [0, sy, 0], blueMat, .168, 'vibro-end-cap', 22);
  const fins = Array.from({ length: 12 }, (_, i) => {
    const a = i * PI * 2 / 12;
    return { position: [Math.cos(a) * .156, 0, Math.sin(a) * .156], rotation: [0, -a, 0] };
  });
  repeated(s, g, new THREE.BoxGeometry(.022, .26, .012), fins, blueMat, 'vibro-cooling-fins');
  box(s, g, [.11, .12, .09], [0, .03, tiltSign * .17], blueMat, 'vibro-terminal-box');
  box(s, g, [.07, .09, .012], [.10, .02, tiltSign * .155], orangeMat, 'vibro-nameplate');
  return g;
}
function fourthFluidBed(s, root, item, g) {
  const stainless = polishedThirdFloorSteel(s);
  const deckGray = material(s, 'fourth-vf-deck-gray', 0x5c6568, { roughness: .52, metalness: .42 });
  const cuffMat = material(s, 'fourth-vf-corrugated-cuff', 0xe5e6de, { roughness: .84, metalness: .04 });
  const tapeMat = material(s, 'fourth-vf-white-tape', 0xf2f3ee, { roughness: .72, metalness: .06 });
  const curtainMat = material(s, 'fourth-vf-black-mat', 0x1e2326, { roughness: .88, metalness: .04 });
  const glassMat = material(s, 'fourth-vf-sight-glass', 0x9bb7b4, { transparent: true, opacity: .38, depthWrite: false, side: THREE.DoubleSide });
  const springBlue = material(s, 'fourth-spring-blue', 0x1c5aa6, { roughness: .42, metalness: .28 });

  // 1) Long V/F body (g[0]: straight vertical side walls + V-shaped lower plenum, g[1]: shallow curved top hood)
  const x0 = -2.95, x1 = 2.95, bodyLen = x1 - x0, cx = (x0 + x1) / 2;
  const lowerShape = new THREE.Shape();
  lowerShape.moveTo(-.74, 2.66);
  lowerShape.lineTo(-.74, 2.08);
  lowerShape.lineTo(-.25, 1.46);
  lowerShape.lineTo(.25, 1.46);
  lowerShape.lineTo(.74, 2.08);
  lowerShape.lineTo(.74, 2.66);
  lowerShape.closePath();
  const lowerGeo = new THREE.ExtrudeGeometry(lowerShape, { depth: bodyLen, bevelEnabled: false, curveSegments: 8 });
  lowerGeo.rotateY(PI / 2);
  tag(s._mesh(lowerGeo, stainless, g[0], [x0, 0, 0]), 'vf-card02-v-bottom-body');

  const hoodShape = new THREE.Shape();
  hoodShape.moveTo(-.75, 2.65);
  hoodShape.quadraticCurveTo(0, 3.24, .75, 2.65);
  hoodShape.lineTo(-.75, 2.65);
  hoodShape.closePath();
  const hoodGeo = new THREE.ExtrudeGeometry(hoodShape, { depth: bodyLen + .04, bevelEnabled: false, curveSegments: 24 });
  hoodGeo.rotateY(PI / 2);
  tag(s._mesh(hoodGeo, stainless, g[1], [x0 - .02, 0, 0]), 'vf-card02-curved-top-hood');

  // Transverse rolled arch flange ribs + end bulkheads + side oval handholes & upper cylindrical sight ports
  for (const rx of [-2.94, -1.75, -.55, .65, 1.80, 2.94]) {
    box(s, g[0], [.045, .60, 1.52], [rx, 2.37, 0], s.mat.trim, 'vf-side-rib');
    const ribArch = new THREE.ExtrudeGeometry(hoodShape, { depth: .045, bevelEnabled: false, curveSegments: 18 });
    ribArch.rotateY(PI / 2);
    tag(s._mesh(ribArch, s.mat.trim, g[1], [rx - .022, .012, 0]), 'vf-arch-rib');
  }
  // Right-underneath hot-air plenum trapezoid box with flanged oval duct port (card 02 FRONT & REAR)
  const plenum = box(s, g[0], [1.65, .48, 1.18], [1.35, 1.42, .12], deckGray, 'vf-lower-air-plenum');
  plenum.rotation.z = -.08;
  cyl(s, g[0], .18, .14, [1.52, 1.38, .74], s.mat.trim, .18, 'vf-plenum-port', 20).rotation.x = PI / 2;
  // Upper cylindrical sight-glass ports & lower oval inspection plates
  for (const sx of [-2.25, -.85, .65, 1.75]) {
    for (const side of [-1, 1]) {
      if (side < 0 && sx > 1.2) continue;
      const sp = s._group(g[1], [sx, 2.86, side * .64]);
      sp.rotation.x = side * -.46;
      cyl(s, sp, .17, .16, [0, 0, side * .06], stainless, .17, 'vf-cyl-sight-barrel', 24).rotation.x = PI / 2;
      ring(s, sp, .185, [0, 0, side * .14], s.mat.trim, .014, 'z', 'vf-sight-clamp');
      cyl(s, sp, .14, .02, [0, 0, side * .142], glassMat, .14, 'vf-sight-window', 20).rotation.x = PI / 2;
    }
  }
  for (const hx of [-1.95, -.15, 1.45]) {
    cyl(s, g[0], .13, .05, [hx, 2.24, .75], s.mat.trim, .13, 'vf-lower-handhole', 18).rotation.x = PI / 2;
    box(s, g[0], [.22, .18, .08], [hx + .55, 2.28, .76], stainless, 'vf-junction-box');
  }

  // 2) ~1.92m High Gray Steel Grating Deck + Projecting Front Catwalk + 2 Stairs + Vibration Subframe (g[2])
  const dy = 1.92;
  deck(s, g[2], [[-3.55, -1.36], [3.45, -1.36], [3.45, 1.36], [1.35, 1.36], [1.35, 1.88], [-1.85, 1.88], [-1.85, 1.36], [-3.55, 1.36]], [], dy, 'vf-elevated-deck-frame');
  fourthGrating(s, g[2], { minX: -3.52, maxX: 3.42, minZ: -1.32, maxZ: 1.32, y: dy, hole: { minX: -3.02, maxX: 3.02, minZ: -.80, maxZ: .80 } }, deckGray, 'vf-main-grating');
  fourthGrating(s, g[2], { minX: -1.82, maxX: 1.32, minZ: 1.34, maxZ: 1.85, y: dy }, deckGray, 'vf-front-catwalk-grating');
  // Edge channel beams & 10 structural steel deck columns
  for (const [a, b] of [[[-3.55, -1.36], [3.45, -1.36]], [[-3.55, 1.36], [3.45, 1.36]], [[-1.85, 1.88], [1.35, 1.88]], [[-3.55, -1.36], [-3.55, 1.36]], [[3.45, -1.36], [3.45, 1.36]]]) {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]), beam = box(s, g[2], [len, .14, .09], [(a[0] + b[0]) / 2, dy - .07, (a[1] + b[1]) / 2], deckGray, 'vf-deck-channel');
    beam.rotation.y = -Math.atan2(b[1] - a[1], b[0] - a[0]);
  }
  for (const px of [-3.48, -1.82, .05, 1.75, 3.38]) for (const pz of [-1.30, 1.30]) {
    box(s, g[2], [.11, dy, .11], [px, dy / 2, pz], deckGray, 'vf-deck-post');
    box(s, g[2], [.22, .04, .22], [px, .02, pz], s.mat.dark, 'vf-deck-baseplate');
  }
  // Perimeter 2-tier gray pipe handrails leaving stair openings on left (+Z) and right (+X/-Z)
  rail(s, g[2], [-3.55, -1.36], [3.45, -1.36], dy, 1.04, deckGray);
  rail(s, g[2], [-3.55, -1.36], [-3.55, 1.36], dy, 1.04, deckGray);
  rail(s, g[2], [-2.75, 1.36], [-1.85, 1.36], dy, 1.04, deckGray);
  rail(s, g[2], [-1.85, 1.36], [-1.85, 1.88], dy, 1.04, deckGray);
  rail(s, g[2], [-1.85, 1.88], [1.35, 1.88], dy, 1.04, deckGray);
  rail(s, g[2], [1.35, 1.88], [1.35, 1.36], dy, 1.04, deckGray);
  rail(s, g[2], [1.35, 1.36], [3.45, 1.36], dy, 1.04, deckGray);
  rail(s, g[2], [3.45, .35], [3.45, 1.36], dy, 1.04, deckGray);
  // Black hanging shield mat & equipment ID plaque on right (+X) railing (card 02 RIGHT)
  box(s, g[2], [.03, .82, 1.05], [3.47, dy + .56, .82], curtainMat, 'vf-right-railing-curtain');
  cipRailSign(s, g[2], 'V / F', [3.49, dy - .06, .72]);
  // Two steel access stairs: Left (-X/+Z, card 02 LEFT) & Right (+X, card 02 RIGHT)
  routeAccessStair(s, g[2], { x: -3.15, z: 2.82, rise: dy, run: 1.46, width: .72, paint: deckGray, yaw: PI });
  routeAccessStair(s, g[2], { x: 3.82, z: -1.18, rise: dy, run: 1.52, width: .72, paint: deckGray, yaw: 0 });

  // Lower vibration frame, spring mounts, under-deck air header & left discharge vibrating feeder (card 02 FRONT & LEFT)
  for (const vz of [-.42, .42]) {
    box(s, g[2], [5.8, .11, .09], [0, 1.18, vz], deckGray, 'vf-vibro-frame-beam');
    box(s, g[2], [5.8, .09, .09], [0, .58, vz], deckGray, 'vf-lower-base-rail');
  }
  for (const sx of [-2.4, -1.2, 0, 1.2, 2.4]) for (const sz of [-.42, .42]) {
    fourthCoilSpring(s, g[2], [sx, .98, sz], .24, .065, springBlue);
    box(s, g[2], [.09, .58, .09], [sx, .29, sz], deckGray, 'vf-subframe-stool');
  }
  pipe(s, g[2], [[-2.6, .66, .68], [2.2, .66, .68]], .065, stainless, 'vf-under-air-header');
  // Left (-X) V-hopper outlet -> stainless vibrating discharge trough on concrete pad (card 02 LEFT)
  cyl(s, g[2], .24, .36, [-2.72, 1.28, 0], stainless, .18, 'vf-discharge-boot', 22);
  cyl(s, g[2], .19, .24, [-2.72, 1.02, 0], cuffMat, .19, 'vf-discharge-sleeve', 22);
  const feeder = s._group(g[2], [-3.05, .72, 0]);
  feeder.rotation.z = .08;
  box(s, feeder, [1.15, .22, .36], [0, 0, 0], stainless, 'vf-left-discharge-trough');
  cyl(s, g[2], .14, .34, [-3.48, .42, 0], cuffMat, .14, 'vf-left-floor-sock', 18);
  box(s, g[2], [.62, .16, .62], [-3.48, .08, 0], s.mat.concrete, 'vf-left-discharge-pad');

  // 3) Ceiling-hung 5F chamber cone transition + propped-open round lid + insulated/corrugated exhaust risers (g[3])
  const coneX = 2.35;
  cyl(s, g[3], 1.22, 2.38, [coneX, 5.51, 0], stainless, .42, 'vf-ceiling-chamber-cone', 48);
  ring(s, g[3], 1.24, [coneX, 6.68, 0], s.mat.trim, .028, 'y', 'vf-cone-ceiling-collar');
  ring(s, g[3], .44, [coneX, 4.32, 0], s.mat.trim, .022, 'y', 'vf-cone-neck-flange');
  cyl(s, g[3], .40, .64, [coneX, 4.00, 0], stainless, .40, 'vf-cone-narrow-neck', 32);
  cyl(s, g[3], .43, .42, [coneX, 3.48, 0], cuffMat, .43, 'vf-cone-corrugated-cuff', 32);
  for (const cy of [3.32, 3.48, 3.64]) ring(s, g[3], .44, [coneX, cy, 0], s.mat.trim, .014, 'y', 'vf-cuff-clamp');
  // Propped-open round ceiling inspection cover beside cone + diagonal ceiling duct (card 02 RIGHT & FRONT)
  const openLid = s._group(g[3], [coneX - .82, 4.75, .52]);
  openLid.rotation.set(.28, 0, -.32);
  cyl(s, openLid, .54, .035, [0, 0, 0], stainless, .54, 'vf-open-round-hatch-lid', 32);
  ring(s, openLid, .55, [0, 0, 0], s.mat.trim, .018, 'y', 'vf-open-hatch-rim');
  pipe(s, g[3], [[coneX - .72, 3.22, -.12], [coneX - .72, 3.95, -.12], [coneX - 1.55, 5.45, -.18], [coneX - 1.75, 6.68, -.18]], .14, stainless, 'vf-diagonal-inlet-duct');
  // Four vertical exhaust risers with corrugated flexible boots & white-taped insulation bands
  for (const [rx, rz, rad] of [[-2.15, -.18, .17], [-.95, .16, .18], [.35, -.20, .17], [1.25, -.38, .15]]) {
    cyl(s, g[3], rad * 1.18, .32, [rx, 3.22, rz], cuffMat, rad * 1.24, 'vf-riser-corrugated-boot', 24);
    cyl(s, g[3], rad, 3.30, [rx, 5.03, rz], stainless, rad, 'vf-exhaust-riser', 24);
    for (const ty of [3.85, 4.65, 5.45, 6.25]) cyl(s, g[3], rad + .012, .055, [rx, ty, rz], tapeMat, rad + .012, 'vf-riser-white-tape', 24);
  }
}
function fourthVibratingConveyor(s, root, item, g) {
  const stainless = polishedThirdFloorSteel(s);
  const frameSteel = material(s, 'fourth-conveyor-frame', 0xaab2b5, { roughness: .36, metalness: .68 });
  const vibroBlue = material(s, 'fourth-vibro-motor-blue', 0x1857ad, { roughness: .36, metalness: .28 });
  const airBlue = material(s, 'fourth-pneumatic-sky', 0x2685d6, { roughness: .34, metalness: .10 });
  const vinylMat = material(s, 'fourth-vinyl-translucent', 0xf2f4ef, { transparent: true, opacity: .66, roughness: .38, depthWrite: false, side: THREE.DoubleSide });
  const tapeMat = material(s, 'fourth-silver-tape', 0xd8dedf, { roughness: .28, metalness: .72 });
  const orangeMat = material(s, 'fourth-motor-tag-orange', 0xd96b27, { roughness: .55, metalness: .12 });

  // g[0]: Elevated checkerplate/grating walkway deck + handrails + stair + twin-post stainless H-lift frame (card 03 RIGHT & FRONT)
  const dy = 1.86;
  deck(s, g[0], [[-1.06, -2.55], [1.06, -2.55], [1.06, 2.55], [-1.06, 2.55]], [[0, -2.15, .28]], dy, 'card03-conveyor-walkway-deck');
  thirdDetailChecker(s, g[0], { minX: -1.02, maxX: 1.02, minZ: -2.50, maxZ: 2.50, y: dy, holes: [[0, -2.15, .30]] }, 'card03-walkway-checker');
  for (const px of [-.98, .98]) for (const pz of [-2.42, -.82, .82, 2.42]) {
    box(s, g[0], [.095, dy, .095], [px, dy / 2, pz], frameSteel, 'card03-deck-post');
    box(s, g[0], [.18, .035, .18], [px, .0175, pz], s.mat.dark, 'card03-deck-foot');
  }
  for (const px of [-.98, .98]) box(s, g[0], [.08, .12, 5.05], [px, dy - .08, 0], frameSteel, 'card03-deck-stringer');
  rail(s, g[0], [-1.04, -2.52], [-1.04, 2.52], dy, 1.02, frameSteel);
  rail(s, g[0], [1.04, -2.52], [1.04, 1.75], dy, 1.02, frameSteel);
  rail(s, g[0], [-1.04, -2.52], [1.04, -2.52], dy, 1.02, frameSteel);
  routeAccessStair(s, g[0], { x: .58, z: 2.55, rise: dy, run: 1.55, width: .68, paint: frameSteel, yaw: 0 });
  // Twin-column stainless H-section lift/guide frame at south (+Z) end (card 03 RIGHT)
  const lz = 1.92;
  for (const lx of [-.34, .34]) {
    box(s, g[0], [.14, 2.74, .14], [lx, dy + 1.37, lz], stainless, 'card03-lift-column');
    box(s, g[0], [.20, .03, .20], [lx, dy + 2.75, lz], s.mat.trim, 'card03-lift-cap');
    bar(s, g[0], [lx * 1.45, dy + .42, lz], [lx, dy + 1.45, lz], .038, frameSteel, 'card03-lift-gusset');
  }
  box(s, g[0], [.82, .16, .16], [0, dy + 1.42, lz], stainless, 'card03-lift-crossbeam');
  box(s, g[0], [.62, .18, .48], [0, dy + .12, lz - .28], frameSteel, 'card03-lift-lower-cradle');

  // g[1]: Stainless tubular vibrating conveyor + tapered belly + 2 tilted blue vibro motors + blue coil springs
  const tube = cyl(s, g[1], .185, 4.45, [0, 3.06, -.12], stainless, .185, 'card03-stainless-conveyor-tube', 32);
  tube.rotation.x = PI / 2 - .035;
  // Tapered triangular stainless motor-mount belly under center of tube (card 03 REAR & FRONT)
  const bellyShape = new THREE.Shape();
  bellyShape.moveTo(-.95, 3.02);
  bellyShape.lineTo(-.12, 2.56);
  bellyShape.lineTo(.22, 2.56);
  bellyShape.lineTo(.98, 2.98);
  bellyShape.closePath();
  const bellyGeo = new THREE.ExtrudeGeometry(bellyShape, { depth: .34, bevelEnabled: false, curveSegments: 4 });
  bellyGeo.rotateY(PI / 2);
  tag(s._mesh(bellyGeo, stainless, g[1], [-.17, 0, .05]), 'card03-vibro-drive-belly');
  // Twin tilted blue finned vibration motors on both sides + looped black cables
  for (const side of [-1, 1]) {
    fourthTiltedVibroMotor(s, g[1], [side * .29, 2.74, .06], side, vibroBlue, orangeMat);
    pipe(s, g[1], [[side * .32, 2.56, .08], [side * .36, 2.34, .02], [side * .34, 2.82, -.16], [side * .24, 3.32, -.16]], .013, s.mat.black, 'card03-motor-cable-loop');
  }
  // Four blue coil springs on raised stainless support bridges + ceiling hanger rods
  for (const sz of [-1.35, 1.05]) {
    for (const sx of [-.34, .34]) {
      box(s, g[1], [.07, .74, .07], [sx, dy + .37, sz], frameSteel, 'card03-spring-pedestal');
      fourthCoilSpring(s, g[1], [sx, dy + .86, sz], .20, .058, vibroBlue);
    }
    box(s, g[1], [.78, .06, .08], [0, dy + .72, sz], frameSteel, 'card03-spring-crossbar');
  }
  for (const hz of [-1.2, .15, .55, .95]) for (const hx of [-.26, .26]) {
    bar(s, g[1], [hx, 3.32, hz], [hx, 6.68, hz], .014, frameSteel, 'card03-ceiling-hanger');
  }
  // Clamped top cleanout port + overhead vinyl-wrapped feed pipe (card 03 REAR & FRONT)
  cyl(s, g[1], .12, .10, [0, 3.28, -.78], stainless, .12, 'card03-top-cleanout-port', 20);
  ring(s, g[1], .135, [0, 3.33, -.78], s.mat.trim, .012, 'y', 'card03-cleanout-clamp');
  fourthVinylSleeve(s, g[1], 0, .52, 3.22, 3.92, .165, vinylMat, tapeMat);
  cyl(s, g[1], .155, 2.76, [0, 5.30, .52], stainless, .155, 'card03-upper-feed-pipe', 24);

  // g[2]: Vertical stainless drop chute + translucent vinyl/waterproof tape sleeves + red toggle clamps + sky-blue pneumatic tubes (card 03 LEFT)
  const dz = -2.15;
  cyl(s, g[2], .205, 1.95, [0, 5.70, dz], stainless, .205, 'card03-chute-upper-pipe', 26);
  fourthVinylSleeve(s, g[2], 0, dz, 3.35, 4.72, .215, vinylMat, tapeMat);
  cyl(s, g[2], .21, .78, [0, 2.96, dz], stainless, .21, 'card03-chute-middle-spool', 28);
  ring(s, g[2], .255, [0, 2.57, dz], s.mat.trim, .022, 'y', 'card03-quick-clamp-ring');
  for (let i = 0; i < 4; i++) {
    const a = (i + .5) * PI / 2;
    bar(s, g[2], [Math.cos(a) * .255, 2.59, dz + Math.sin(a) * .255], [Math.cos(a) * .28, 2.44, dz + Math.sin(a) * .28], .011, s.mat.red, 'card03-red-toggle-latch');
  }
  fourthVinylSleeve(s, g[2], 0, dz, 1.62, 2.55, .21, vinylMat, tapeMat);
  box(s, g[2], [.46, .44, .46], [0, 1.40, dz], stainless, 'card03-lower-valve-housing');
  cipRailSign(s, g[2], '분말 이송', [-.24, 1.42, dz]);
  // Air filter-regulator + twin curved sky-blue polyurethane pneumatic tubes
  box(s, g[2], [.09, .22, .09], [.28, 4.18, dz + .18], s.mat.dark, 'card03-air-regulator');
  cyl(s, g[2], .028, .12, [.28, 3.98, dz + .18], vinylMat, .022, 'card03-regulator-bowl', 12);
  pipe(s, g[2], [[.24, 4.22, dz + .18], [.08, 4.12, dz + .30], [.18, 3.48, dz + .36], [.48, 2.95, dz + .22]], .009, airBlue, 'card03-sky-air-tube-1');
  pipe(s, g[2], [[.26, 4.18, dz + .20], [.14, 3.96, dz + .34], [.26, 3.36, dz + .38], [.52, 2.86, dz + .18]], .009, airBlue, 'card03-sky-air-tube-2');
}
function fourthTransferChute(s, root, item, g) {
  const stainless = polishedThirdFloorSteel(s);
  const frameSteel = material(s, 'fourth-conveyor-frame', 0xaab2b5, { roughness: .36, metalness: .68 });
  const vibroBlue = material(s, 'fourth-vibro-motor-blue', 0x1857ad, { roughness: .36, metalness: .28 });
  const airBlue = material(s, 'fourth-pneumatic-sky', 0x2685d6, { roughness: .34, metalness: .10 });
  const vinylMat = material(s, 'fourth-vinyl-translucent', 0xf2f4ef, { transparent: true, opacity: .66, roughness: .38, depthWrite: false, side: THREE.DoubleSide });
  const tapeMat = material(s, 'fourth-silver-tape', 0xd8dedf, { roughness: .28, metalness: .72 });
  const orangeMat = material(s, 'fourth-motor-tag-orange', 0xd96b27, { roughness: .55, metalness: .12 });
  const dy = 1.86;

  // g[0]: Surge hopper & vinyl/waterproof-taped vertical stainless chute
  cyl(s, g[0], .20, 2.28, [0, 5.54, 0], stainless, .20, 'card03-transfer-upper-riser', 24);
  fourthVinylSleeve(s, g[0], 0, 0, 3.65, 4.40, .22, vinylMat, tapeMat);
  cyl(s, g[0], .38, .82, [0, 3.24, 0], stainless, .38, 'card03-transfer-surge-shell', 32);
  cyl(s, g[0], .38, .76, [0, 2.45, 0], stainless, .19, 'card03-transfer-cone', 32);
  ring(s, g[0], .395, [0, 3.64, 0], s.mat.trim, .018, 'y', 'card03-transfer-top-flange');
  // g[1]: Lower spring-mounted stainless vibrating feeder + tilted blue motor + lower vinyl drop + sky-blue air lines
  const trough = s._group(g[1], [0, 1.48, .12]);
  trough.rotation.x = .09;
  box(s, trough, [.38, .24, 1.35], [0, 0, 0], stainless, 'card03-transfer-vibro-trough');
  fourthTiltedVibroMotor(s, g[1], [.28, 1.38, .15], 1, vibroBlue, orangeMat);
  for (const sx of [-.24, .24]) fourthCoilSpring(s, g[1], [sx, 1.18, -.25], .18, .052, vibroBlue);
  fourthVinylSleeve(s, g[1], 0, .66, .36, 1.24, .165, vinylMat, tapeMat);
  box(s, g[1], [.54, .16, .54], [0, .08, .66], s.mat.concrete, 'card03-transfer-floor-curb');
  pipe(s, g[1], [[.28, 2.85, .24], [.38, 2.35, .36], [.26, 1.75, .28]], .009, airBlue, 'card03-transfer-air-tube');
  // g[2]: Elevated checkerplate service platform + handrails + access stair
  deck(s, g[2], [[-.92, -1.35], [.92, -1.35], [.92, 1.35], [-.92, 1.35]], [[0, 0, .42]], dy, 'card03-transfer-platform');
  thirdDetailChecker(s, g[2], { minX: -.88, maxX: .88, minZ: -1.30, maxZ: 1.30, y: dy, holes: [[0, 0, .44]] }, 'card03-transfer-checker');
  for (const px of [-.86, .86]) for (const pz of [-1.28, 1.28]) {
    box(s, g[2], [.09, dy, .09], [px, dy / 2, pz], frameSteel, 'card03-transfer-post');
    box(s, g[2], [.18, .035, .18], [px, .0175, pz], s.mat.dark, 'card03-transfer-foot');
  }
  for (const px of [-.88, .88]) rail(s, g[2], [px, -1.32], [px, 1.32], dy, 1.0, frameSteel);
  rail(s, g[2], [-.88, 1.32], [.88, 1.32], dy, 1.0, frameSteel);
  routeAccessStair(s, g[2], { x: 0, z: -1.35, rise: dy, run: 1.45, width: .66, paint: frameSteel, yaw: PI });
}
function observedFourthFloor(s, root, item, g) {
  const builder = {
    'fourth-fluid-bed': fourthFluidBed,
    'fourth-vibrating-conveyor': fourthVibratingConveyor,
    'fourth-transfer-chute': fourthTransferChute,
  }[item.dryerRoute?.kind];
  if (!builder) return false;
  builder(s, root, item, g);
  Object.assign(root.userData, { observedRouteEquipment: { ...item.dryerRoute }, fieldCardVerified20261124: true, modelDimensionsMeasured: false });
  return true;
}

export function buildDryerProcessEquipment(s, root, item) {
  if (item.type === 'bag-line') { bagFillingLine(s, root, parts(s, root, item)); return true; }
  if (item.type === 'agitator-tank') { agitatorTank(s, root, parts(s, root, item)); return true; }
  if (!supported.has(item.id)) return false;
  const g = parts(s, root, item);
  root.userData.historicalShapeReference = {
    source: `references/owp-team2-20261029/images/floor${item.floor === 1 ? '1' : item.floor === 3 ? '3' : '4'}.png`,
    confidence: 'historical-render-proportion', currentInstallationConfirmedByThisReference: false,
    locationBasis: 'existing catalog and historical architectural registration; no dimensional survey',
  };
  if (observedOverlookEquipment(s, root, item, g) || observedThirdFloor(s, root, item, g) || observedFourthFloor(s, root, item, g)) return true;
  if (['f1-mix-a', 'f1-mix-b', 'f1-melting', 'f1-oil-water', 'f1-s1'].includes(item.id)) tankGroup(s, root, item, g);
  else if (item.id.startsWith('f1-ica-')) packing(s, root, item, g);
  else if (item.id.startsWith('f1-xray-')) xray(s, root, item, g);
  else if (item.id.startsWith('f1-conveyor-')) conveyor(s, root, item, g);
  else if (item.id === 'f1-palletizer') palletizer(s, root, item, g);
  else if (item.id === 'f3-sterilizer') threeVesselSkid(s, root, item, g);
  else if (item.id === 'f3-homogenizer') homogenizer(s, root, item, g);
  else if (['f3-balance-tank', 'f3-feed-tank'].includes(item.id)) standaloneTank(s, root, item, g);
  else if (item.id === 'f3-holding') largeCone(s, root, item, g);
  else if (item.id === 'f4-fluid-bed') fluidBed(s, root, item, g);
  else if (item.id === 'f4-fine-return') fineReturn(s, root, item, g);
  else if (item.id === 'f4-transfer-bin') transferBin(s, root, item, g);
  return true;
}
