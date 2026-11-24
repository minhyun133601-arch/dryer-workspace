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
function vessel(s, body, top, connections, { x = 0, z = 0, r = .8, base = .4, h = 1.8, mixer = true, ladder = false, name = 'vessel' } = {}) {
  const g = tag(s._group(body, [x, 0, z]), name); legs(s, g, r * 1.2, r * 1.2, base);
  cyl(s, g, r, h, [0, base + h / 2, 0], s.mat.steel, r, 'vessel-shell', 32);
  cyl(s, g, r, .22, [0, base - .08, 0], s.mat.steel, .18, 'vessel-lower-dish', 32);
  for (const y of [base + .04, base + h - .04]) ring(s, g, r + .012, [0, y, 0]);
  const cap = tag(s._group(top, [x, base + h, z]), 'vessel-top');
  cyl(s, cap, .2, .22, [0, .11, 0], s.mat.steel, r, 'vessel-top-dish', 32);
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
function routeAccessStair(s, parent, { x, z, rise, run, width = .7, paint = s.mat.trim }) {
  const root = tag(s._group(parent, [x, 0, z]), 'observed-service-stair'); root.rotation.y = PI;
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
function thirdDetailSign(s,parent,text,position,width=1.15){
  const root=tag(s._group(parent,position),'observed-cip-upright-nameplate');root.rotation.y=PI;
  const blue=material(s,'third-cip-nameplate-blue',0x285e8d);
  box(s,root,[width,.34,.025],[0,0,0],blue,'observed-cip-nameplate-frame');
  box(s,root,[width-.055,.25,.01],[0,.015,.019],s.mat.white,'observed-cip-nameplate-white-face');
  root.userData.text=text;root.userData.sourceSeconds=[648];
  if(typeof document!=='undefined'&&typeof document.createElement==='function'){
    const canvas=document.createElement('canvas');canvas.width=768;canvas.height=180;const ctx=canvas.getContext?.('2d');
    if(ctx){ctx.fillStyle='#edf0e9';ctx.fillRect(0,0,768,180);ctx.fillStyle='#172b2a';ctx.font='600 96px "Malgun Gothic",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,384,90,730);
      const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;s.textures?.add(texture);
      const paint=new THREE.MeshBasicMaterial({map:texture});s.materials?.add(paint);tag(s._mesh(new THREE.PlaneGeometry(width-.06,.245),paint,root,[0,.015,.025]),'observed-cip-nameplate-text');
    }
  }
  return root;
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
  for (const z of centers) {
    const cone = tag(s._group(g[0], [0, 0, z]), 'observed-conical-hopper');
    cyl(s, cone, shellRadius, y-lowerRim, [0,(y+lowerRim)/2,0], s.mat.steel,.16,'observed-hopper-conical-shell',40);
    cyl(s, cone, shellRadius, upperRim-y, [0,(upperRim+y)/2,0], s.mat.steel,shellRadius,'observed-hopper-upper-rim',40);
    cyl(s, cone, .19, lidTop-upperRim, [0,(lidTop+upperRim)/2,0], s.mat.steel,shellRadius,'observed-hopper-sloping-cover',48);
    for (const yy of [lowerRim,y,upperRim]) ring(s,cone,yy === lowerRim ? .17 : shellRadius+.007,[0,yy,0],s.mat.trim,.018);
    cyl(s,g[2],.16,.12,[0,.95,z],s.mat.black,.16,'observed-hopper-flexible-neck');
    cyl(s,g[2],.23,.085,[0,.86,z],s.mat.trim,.23,'observed-hopper-discharge-flange');
    box(s,g[2],[.46,.15,.31],[0,.75,z],s.mat.steel,'observed-hopper-discharge-assembly');
    if(z<0){
      pipe(s,g[3],[[0,lidTop,z],[0,3.46,z],[.64,4.61,z],[1.2,5.4,z]],.155,s.mat.steel,'observed-inclined-hopper-feed');
      for(const point of [[0,3.14,z],[.64,4.61,z]])ring(s,g[3],.165,point,s.mat.trim,.02);
    }else{
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
  rail(s,g[1],[-halfWidth,-halfLength],[-halfWidth,1.66],y,.95,yellow);
  box(s,g[1],[.76,.08,.72],[-1.40,y-.04,2.02],s.mat.trim,'observed-hopper-stair-landing');
  rail(s,g[1],[-1.78,1.66],[-halfWidth,1.66],y,.95,yellow);
  routeAccessStair(s,g[1],{x:-1.40,z:4.27,rise:y,run:2.25,width:.63,paint:yellow});
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
  const blue=material(s,'disc-coupling-blue',0x3f5c87);
  const motorColors=[material(s,'disc-gearmotor-ochre',0x998355),material(s,'disc-gearmotor-brown',0x736044)];
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
  Object.assign(root.userData, { observedConicalHoppers: 2, observedVerticalMotorHousings: 2, observedCoveredTransferTroughs: tracks.length, localPlatformElevation: y, guardHeight, supportWidth: 2*columnX, scaleBasis: 'four-view photo ratios; 2.2 m existing elevator opening reference; not field measured',
    transferPhotoReferences: ['20261124_134536.jpg','20261124_134544.jpg','20261124_134555.jpg','20261124_134612.jpg'] });
}
function routeServiceSkid(s, root, item, g) {
  box(s, g[0], [3.6, .12, 2.3], [0, .12, 0], s.mat.trim, 'observed-service-skid-base');
  for (const x of [-1.3, .1]) for (const z of [-.65, .65]) box(s, g[0], [.08, 1.8, .08], [x, .95, z], s.mat.trim, 'observed-plate-frame-upright');
  box(s, g[0], [1.45, 1.55, 1.2], [-.6, 1.05, 0], s.mat.steel, 'observed-stainless-plate-housing');
  for (let x = -1.2; x < .05; x += .085) box(s, g[0], [.025, 1.35, 1.23], [x, 1.05, 0], s.mat.trim, 'observed-plate-stack-edge');
  const green = material(s, 'route-pump-green', 0x329b79);
  box(s, g[1], [.5, .11, .6], [1.1, .25, .25], s.mat.trim, 'observed-vertical-pump-base');
  cyl(s, g[1], .12, .9, [1.1, .75, .25], s.mat.steel, .12, 'observed-vertical-pump-stack');
  cyl(s, g[1], .22, .5, [1.1, 1.43, .25], green, .22, 'observed-green-vertical-pump-motor');
  for (const y of [.6, .95, 1.15]) ring(s, g[1], .15, [1.1, y, .25]);
  for (const z of [-.7, .75]) pipe(s, g[1], [[-1.4, .45, z], [1.1, .45, z], [1.1, .65, .25]], .065, s.mat.trim, 'observed-service-skid-pipe');
  gauge(s, g[2], [.65, .83, .84]);
  box(s, g[2], [.55, .7, .16], [-1.25, 1.2, .7], s.mat.steel, 'observed-local-service-panel');
}
function routeDriveFrame(s, root, item, g) {
  legs(s, g[0], 2.6, 1.8, 1.8);
  for (const z of [-.9, .9]) box(s, g[0], [2.8, .12, .12], [0, 1.8, z], s.mat.trim, 'observed-drive-frame-beam');
  box(s, g[0], [2.8, .08, 1.9], [0, 1.88, 0], s.mat.dark, 'observed-drive-frame-top');
  routeMotor(s, g[1], [-.4, .5, 0], .28, .75, false);
  box(s, g[1], [.25, .65, .85], [.17, .45, 0], s.mat.yellow, 'observed-yellow-drive-guard');
  box(s, g[1], [.75, .45, .8], [.65, .45, 0], s.mat.steel, 'observed-drive-lower-housing');
  const cabinet = tag(s._group(g[2], [.8, 1.2, 1]), 'observed-stainless-control-cabinet');
  box(s, cabinet, [.8, 1.95, .3], [0, 0, 0], s.mat.steel, 'observed-control-cabinet-shell');
  box(s, cabinet, [.4, .28, .02], [0, .52, .16], s.mat.screen, 'observed-control-monitor');
  for (const x of [-.2, 0, .2]) cyl(s, cabinet, .04, .025, [x, .12, .18], x > .1 ? s.mat.mint : s.mat.white, .04, 'observed-control-button').rotation.x = PI / 2;
  cyl(s, cabinet, .075, .035, [0, -.24, .18], s.mat.red, .075, 'observed-control-emergency-stop').rotation.x = PI / 2;
  pipe(s, g[3], [[-1.2, .3, -.8], [.9, .3, -.8], [.9, .7, -.8]], .07, s.mat.trim, 'observed-drive-visible-pipe');
}
function routeCylinder(s, root, item, g) {
  vessel(s, g[0], g[1], g[2], { r: .95, base: .42, h: 2.35, mixer: false, name: 'observed-standalone-cylinder' });
  ring(s, g[1], .27, [.3, 2.95, .15], s.mat.trim, .03);
  gauge(s, g[2], [.4, 1.6, .88]);
  pipe(s, g[2], [[-.85, .6, -.5], [-1.15, .6, -.5], [-1.15, 2.6, -.5], [-.6, 2.6, -.5]], .06, s.mat.trim, 'observed-cylinder-side-pipe');
  cyl(s,g[0],.965,.045,[0,2.1,0],s.mat.trim,.965,'observed-cylinder-circumferential-shell-joint',40);
  const green=material(s,'third-cylinder-outlet-green',0x3c7861);
  box(s,g[2],[.09,.1,.1],[.16,.32,1.2],s.mat.steel,'observed-cylinder-outlet-valve');
  const lever=box(s,g[2],[.045,.29,.035],[.17,.2,1.23],green,'observed-cylinder-green-outlet-lever');lever.rotation.z=-.25;
  const manifold=tag(s._group(g[2],[0,0,-1.06]),'observed-cylinder-side-manifold');
  bar(s,manifold,[-.7,1.75,0],[.92,1.75,0],.055,s.mat.trim,'observed-cylinder-manifold-run');
  for(const x of [-.55,.27,.85])thirdDetailFlange(s,manifold,[x,1.75,0],.105,'x','observed-cylinder-manifold-flange');
  box(s,manifold,[.23,.28,.23],[.27,1.82,0],s.mat.steel,'observed-cylinder-manifold-regulator');
  cyl(s,manifold,.085,.12,[.27,2.02,0],s.mat.trim,.11,'observed-cylinder-regulator-cap');
  const wheel=ring(s,manifold,.13,[-.57,1.93,.07],s.mat.red,.024,'z','observed-cylinder-red-manifold-handwheel');
  for(const a of [0,PI/2])bar(s,manifold,[-.57-Math.cos(a)*.11,1.93-Math.sin(a)*.11,.07],[-.57+Math.cos(a)*.11,1.93+Math.sin(a)*.11,.07],.012,s.mat.red,'observed-cylinder-handwheel-spoke');
  for(const x of [-.18,.82]){bar(s,manifold,[x,1.75,0],[x,2.07,0],.018,s.mat.trim,'observed-cylinder-gauge-stem');gauge(s,manifold,[x,2.11,.035],.08);}
  wheel.userData.sourceSeconds=[590];Object.assign(manifold.userData,{visibleRegulatorAndTwoGauges:true,pipeRouteApproximate:true,liveReadingsAdded:false});
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
  const cap=tag(s._mesh(geom,s.mat.steel,parent,[x,y,z]),'observed-tank-cap-with-open-manhole');cap.userData.dishedRoofHeight=domeHeight;
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
function routeCipDeck(s, root, item, g) {
  const y = 2.05, centers = [-1.15, 1.15], radius = .88;
  for (const [index, z] of centers.entries()) {
    const body = tag(s._group(g[0], [0, 0, z]), 'observed-cip-tank');
    tag(s._mesh(new THREE.CylinderGeometry(radius, radius, 1.65, 40, 1, true), s.mat.steel, body, [0, 1.325, 0]), 'observed-cip-tank-shell');
    // The exterior is intentionally open at the manhole. Give it its visible
    // inner wall and deep dished bottom so an oblique view cannot see the hall
    // floor through the backfaces of the stainless shell (702/708s).
    const interior=material(s,'third-cip-shadowed-interior',0x35403f,{roughness:.86,metalness:.04,side:THREE.BackSide});
    tag(s._mesh(new THREE.CylinderGeometry(radius-.006,radius-.006,1.65,40,1,true),interior,body,[0,1.325,0]),'observed-cip-inner-vessel-wall');
    cyl(s,body,radius-.008,.235,[0,.385,0],material(s,'third-cip-shadowed-bottom',0x28332f,{roughness:.92,metalness:.02}),.22,'observed-cip-deep-inner-bottom',40);
    cyl(s, body, radius, .24, [0, .38, 0], s.mat.steel, .22, 'observed-cip-tank-lower-dish', 40);
    ring(s, body, radius + .01, [0, .53, 0]);
    tag(s._mesh(new THREE.CylinderGeometry(radius * .97, radius, .12, 40, 1, true), s.mat.steel, body, [0, 2.21, 0]), 'observed-cip-tank-shoulder');
    thirdDetailOpenTankCap(s, g[1], 0, z, 2.28, radius * .97);
    cyl(s, g[1], .1, .24, [-.3, 2.49, z - .2], s.mat.trim, .1, 'observed-cip-mixer-shaft');
    const mixer=routeMotor(s, g[1], [-.3, 3.18, z - .2], .19, .64);
    cyl(s,mixer,.205,.085,[0,.36,0],material(s,'route-motor-green',0x578c83),.205,'observed-cip-mixer-fan-cover');
    thirdDetailFlange(s,g[1],[-.3,2.43,z-.2],.28,'y','observed-cip-wide-mixer-mounting-flange');
    cyl(s,g[1],.15,.43,[-.3,2.65,z-.2],s.mat.motor,.2,'observed-cip-mixer-reducer');
    for (const x of [-.9, .9]) box(s, g[2], [.28, .1, .2], [x, y + .025, z], s.mat.trim, 'observed-cip-hanging-lug');
    pipe(s, g[3], [[0, .25, z], [0, .25, z + .4], [.8, .25, z + .4]], .055, s.mat.trim, 'observed-cip-lower-outlet');
    body.userData.observedLabel = index === 0 ? 'CIP탱크(산)' : null;
  }
  deck(s, g[2], [[-1.4, -2.55], [1.4, -2.55], [1.4, 2.55], [-1.4, 2.55]], centers.map(z => [0, z, .94]), y, 'observed-cip-pierced-platform');
  thirdDetailChecker(s,g[2],{minX:-1.4,maxX:1.4,minZ:-2.55,maxZ:2.55,y,holes:centers.map(z=>[0,z,.94])});
  legs(s, g[2], 2.6, 4.9, y);
  for (const x of [-1.3, 1.3]) box(s, g[2], [.12, .18, 5], [x, y - .2, 0], s.mat.trim, 'observed-cip-deck-edge-beam');
  for (const z of [-2.55, 2.55]) rail(s, g[2], [-1.4, z], [1.4, z], y, .95);
  rail(s, g[2], [-1.4, -2.55], [-1.4, 2.55], y, .95);
  rail(s, g[2], [1.4, -2.55], [1.4, 1.85], y, .95);
  box(s, g[2], [1.1, .09, .8], [1.85, y - .045, 2.3], s.mat.trim, 'observed-cip-stair-landing');
  thirdDetailChecker(s,g[2],{minX:1.3,maxX:2.4,minZ:1.9,maxZ:2.7,y},'observed-cip-landing-checker-relief');
  routeAccessStair(s, g[2], { x: 1.95, z: 5.4, rise: y, run: 3.1 });
  routeMotor(s, g[3], [.95, .48, 0], .2, .6, false);
  box(s, g[3], [.16, .5, .4], [.57, .43, 0], s.mat.yellow, 'observed-cip-yellow-drive-guard');
  for (const z of [-2.2, 2.2]) pipe(s, g[3], [[-.9, 3.3, z], [.6, 3.3, z], [1.1, 2.8, z]], .06, s.mat.trim, 'observed-cip-upper-manifold');
  for(const x of [-1.08,-.85,-.62])pipe(s,g[3],[[x,2.7,-2.1],[x,3.45,-2.1],[x,3.45,1.95]],.035,s.mat.trim,'observed-cip-parallel-upper-pipe');
  const panel=tag(s._group(g[3],[1.35,2.85,0]),'observed-cip-three-display-cabinet');panel.rotation.y=PI/2;
  box(s,panel,[.9,.5,.17],[0,0,0],s.mat.steel,'observed-cip-three-display-shell');
  for(const x of [-.28,0,.28]){box(s,panel,[.19,.15,.018],[x,.1,.096],s.mat.dark,'observed-cip-static-display-window');cyl(s,panel,.025,.025,[x,-.12,.1],s.mat.white,.025,'observed-cip-panel-selector').rotation.x=PI/2;}
  panel.userData.liveReadingsAdded=false;panel.userData.sourceSeconds=[648];
  thirdDetailSign(s,g[0],'CIP탱크(산)',[0,1.46,-2.08]);
  Object.assign(root.userData, { observedMinimumTankTops: 2, entireCipTankCountConfirmed: false, readableObservedTankLabels: ['CIP탱크(산)'], localPlatformElevation: y, tankBodiesHangThroughDeck: true });
}
function observedThirdFloor(s, root, item, g) {
  const kind = item.dryerRoute?.kind;
  const builder = { 'third-cone-bank': routeConeBank, 'third-service-skid': routeServiceSkid, 'third-drive-frame': routeDriveFrame, 'third-cylinder': routeCylinder, 'third-cip-deck': routeCipDeck }[kind];
  if (!builder) return false;
  builder(s, root, item, g);
  const stainless=material(s,'third-observed-stainless',0xd8dddc,{roughness:.29,metalness:.38,map:s.mat.steel.map||null});
  const edges=material(s,'third-observed-stainless-trim',0xbfc9c6,{roughness:.34,metalness:.4});
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
  box(s,cabinet,[.56,1.84,.6],[0,1.05,0],s.mat.steel,'observed-packing-control-cabinet-shell');
  const top=box(s,cabinet,[.55,.08,.52],[0,1.99,.04],s.mat.trim,'observed-packing-slanted-control-top');top.rotation.x=-.2;
  for(let i=0;i<7;i++)box(s,cabinet,[.035,.025,.28],[-.2+i*.065,2.035,.03],s.mat.dark,'observed-packing-control-vent-slot');
  box(s,cabinet,[.34,.22,.018],[0,1.58,.312],s.mat.screen,'observed-packing-cabinet-monitor');
  for(const y of [.85,1.05])for(const xx of [-.14,.14])cyl(s,cabinet,.025,.025,[xx,y,.32],s.mat.white,.025,'observed-packing-control-button').rotation.x=PI/2;
  cyl(s,cabinet,.045,.19,[0,2.15,0],s.mat.red,.045,'observed-packing-red-stack-light');
  if(index===1){
    const leaf=tag(s._group(cabinet,[-.3,.13,.315]),'observed-packing-filmed-open-service-leaf');leaf.rotation.y=-.95;
    box(s,leaf,[.61,1.73,.035],[.305,.865,0],s.mat.steel,'observed-packing-open-service-panel');
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
function overlookedPackingCubicle(s, root, item, g) {
  const index=Number(item.id.at(-1))-1,width=index===2?1.85:2.1,depth=index===2?1.75:2.15,roof=index===2?2.5:2.4;
  const glass=material(s,'route-packing-smoked-guards',0x7eabb5,{transparent:true,opacity:.32,depthWrite:false,side:THREE.DoubleSide});
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
    box(s,g[0],[.035,.46,depth-.1],[x,.48,0],s.mat.steel,'observed-packing-lower-metal-panel');
  }
  for(const side of [-1,1]){
    const x=side*width/4,w=width/2-.04;
    box(s,g[0],[w,1.44,.025],[x,1.48,depth/2+.015],glass,'observed-packing-transparent-door');
    box(s,g[0],[w,.45,.035],[x,.485,depth/2+.025],s.mat.steel,'observed-packing-lower-door-panel');
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
  transferDetailBed(s,g[0],[2.45,2.45],[3.1,1.9],.66,.78,'observed-green-short-merge');
  motor(s,g[2],[-.52,.43,-1.8],.13,.35);
  const carton=tag(s._group(g[1],[.3,.84,2.1]),'clip2-open-carton-on-curve'),cardboard=material(s,'clip2-corrugated-cardboard',0xac9472);
  Object.assign(carton.userData,{sourceReferences:[{clipId:'first-floor-20261113-clip2',times:[48]}],staticObservedProp:true,brandAndContentsConfirmed:false});
  box(s,carton,[.55,.025,.5],[0,.0125,0],cardboard,'clip2-carton-base');
  for(const x of [-.265,.265])box(s,carton,[.025,.42,.5],[x,.23,0],cardboard,'clip2-carton-side');
  for(const z of [-.24,.24])box(s,carton,[.55,.42,.025],[0,.23,z],cardboard,'clip2-carton-side');
  Object.assign(root.userData,{hiddenBlueToGreenConnectionConfirmed:false,visibleCurveDegrees:90,fullReturnLoopConfirmed:false,sourceTimes:[234,264,270,282]});
}
function overlookedArticulatedArm(s, root, item, g) {
  const blue=material(s,'observed-arm-blue',0x315b92),light=material(s,'observed-arm-light',0xc9c9ac);
  const arms=[
    {id:'blue',base:[.9,0,-.6],shoulder:[.9,1.95,-.6],elbow:[-.1,3.1,-.55],wrist:[-1.45,2.35,-.5],body:blue,upper:blue,forearm:light},
    {id:'cream',base:[-1.8,0,2.5],shoulder:[-1.8,1.42,2.5],elbow:[-.9,2.75,2.5],wrist:[.7,2.02,2.5],body:light,upper:light,forearm:light},
  ];
  for(const arm of arms){
    const [bx,,bz]=arm.base,base=tag(s._group(g[0],[bx,0,bz]),`observed-${arm.id}-arm-base-assembly`);
    transferDetailInstances(s,base,[[[0,.09,0],[1.12,.18,1.05]],[[0,.72,0],[.66,1.15,.68]]],arm.body,`observed-${arm.id}-arm-base`);
    cyl(s,base,.34,.16,[0,1.37,0],arm.body,.38,`observed-${arm.id}-arm-turntable`);
    const link=tag(s._group(g[1]),`observed-${arm.id}-articulated-arm`);Object.assign(link.userData,{sourceTimes:[282],armStyle:arm.id,basePosition:arm.base,operatingEnvelopeConfirmed:false});
    if(arm.id==='blue')box(s,base,[.46,.5,.54],[0,1.62,0],blue,'observed-blue-arm-column');
    for(const dz of [-.15,.15]){
      bar(s,link,[arm.shoulder[0],arm.shoulder[1],arm.shoulder[2]+dz],[arm.elbow[0],arm.elbow[1],arm.elbow[2]+dz],arm.id==='cream'?.14:.12,arm.upper,'observed-articulated-upper-arm');
      bar(s,link,[arm.elbow[0],arm.elbow[1],arm.elbow[2]+dz],[arm.wrist[0],arm.wrist[1],arm.wrist[2]+dz],.105,arm.forearm,'observed-articulated-forearm');
    }
    for(const [index,p]of [arm.shoulder,arm.elbow,arm.wrist].entries())cyl(s,link,index===0&&arm.id==='cream'?.29:.18,.46,p,arm.body,index===0&&arm.id==='cream'?.29:.18,'observed-articulated-arm-joint',20).rotation.x=PI/2;
    pipe(s,link,[[bx+.18,1.1,bz-.26],[arm.shoulder[0]+.14,arm.shoulder[1]+.12,arm.shoulder[2]-.26],[arm.elbow[0],arm.elbow[1]+.2,arm.elbow[2]-.24],[arm.wrist[0],arm.wrist[1]+.12,arm.wrist[2]-.22]],.026,s.mat.black,'observed-arm-service-hose');
    const end=tag(s._group(g[2]),`observed-${arm.id}-end-tool`),headY=arm.wrist[1]-.38;
    bar(s,end,arm.wrist,[arm.wrist[0],headY+.14,arm.wrist[2]],.065,s.mat.trim,'observed-arm-wrist-drop');
    box(s,end,[arm.id==='blue'?.94:.72,.19,.58],[arm.wrist[0],headY,arm.wrist[2]],s.mat.red,'observed-red-vacuum-gripper');
    const cups=arm.id==='blue'?[[ -.29,-.17],[.29,-.17],[-.29,.17],[.29,.17]]:[[-.22,0],[.22,0]];
    for(const [x,z]of cups)cyl(s,end,.075,.06,[arm.wrist[0]+x,headY-.13,arm.wrist[2]+z],s.mat.white,.075,'observed-vacuum-gripper-cup',12);
    if(arm.id==='blue')for(let i=0;i<5;i++)cyl(s,end,.045,.018,[arm.wrist[0]-.32+i*.16,headY,arm.wrist[2]+.3],s.mat.white,.045,'observed-red-head-front-port',12).rotation.x=PI/2;
    end.userData.partialToolView=arm.id==='cream';end.userData.cupCountRepresentative=true;
  }
  // Three distinct narrow lanes and cream dividers replace the former single
  // broad empty rectangle, matching the directly visible alignment bank.
  for(const [index,z]of [-2.4,-1.55,-.7].entries()){
    const lane=transferDetailBed(s,g[3],[-3.2,z],[-.3,z],.55,.8,`observed-arm-alignment-lane-${index+1}`);lane.userData.alignmentLane=index+1;
  }
  transferDetailBed(s,g[3],[1.4,1.0],[1.4,3.4],.86,.8,'observed-cream-arm-side-bed');
  // Leave a genuine opening where the visible brown bend enters the cell.
  const fences=[ [[-3.85,-2.75],[2.45,-2.75]],[[2.45,-2.75],[2.45,3.85]],[[2.45,3.85],[-3.85,3.85]],[[-3.85,1.4],[-3.85,3.85]],[[-3.0,.0],[-.4,.0]], [[-.2,.6],[2.45,.6]] ];
  for(const [a,b]of fences)transferDetailFence(s,g[3],a,b,1.48);
  Object.assign(root.userData,{observedBlueArticulatedArm:true,observedMinimumArticulatedArms:2,observedAlignmentLaneCount:3,sourceTimes:[252,270,282],operatingEnvelopeConfirmed:false,operatingAnimationAdded:false,completeCellConnectivityConfirmed:false});
}
function observedOverlookEquipment(s, root, item, g) {
  const builder = { 'overlook-packing-cubicle': overlookedPackingCubicle, 'overlook-inspection': overlookedInspection, 'overlook-roller-collector': overlookedRollerCollector, 'overlook-roller-return': overlookedRollerReturn, 'overlook-articulated-arm': overlookedArticulatedArm }[item.dryerRoute?.kind];
  if (!builder) return false;
  builder(s, root, item, g);
  Object.assign(root.userData, { observedRouteEquipment: { ...item.dryerRoute }, historicalEquipmentIdentityConfirmed: false, modelDimensionsMeasured: false });
  return true;
}

export function buildDryerProcessEquipment(s, root, item) {
  if (!supported.has(item.id)) return false;
  const g = parts(s, root, item);
  root.userData.historicalShapeReference = {
    source: `references/owp-team2-20261029/images/floor${item.floor === 1 ? '1' : item.floor === 3 ? '3' : '4'}.png`,
    confidence: 'historical-render-proportion', currentInstallationConfirmedByThisReference: false,
    locationBasis: 'existing catalog and historical architectural registration; no dimensional survey',
  };
  if (observedOverlookEquipment(s, root, item, g) || observedThirdFloor(s, root, item, g)) return true;
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
