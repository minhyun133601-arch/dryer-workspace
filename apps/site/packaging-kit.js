import * as THREE from '../shared/vendor/three.module.js';

// Small assembly helper for the Team 2 floor models. Repeated boxes, rods and
// rings of one material become a single instanced mesh per selectable part, so
// detailed machines and stocked racks keep a modest draw-call count.
const PI = Math.PI, TAU = PI * 2;
const UP = new THREE.Vector3(0, 1, 0);

// What the stainless sees in this hall: lamp rows under a pale roof, cream wall
// panels, the yellow window band on the west and a green floor.
function hallReflection() {
  const w = 256, h = 128, data = new Uint8Array(w * h * 4);
  const wave = (u, n, shift = 0) => .5 + .5 * Math.sin((u * n + shift) * TAU);
  for (let row = 0; row < h; row++) {
    const v = row / h;
    for (let col = 0; col < w; col++) {
      const u = col / w, panel = wave(u, 16) > .9 ? -34 : 0, machine = 18 * wave(u, 7, .2) + 12 * wave(u, 13, .6);
      let c;
      if (v > .9) c = [150, 154, 152];
      else if (v > .74) { const lamp = wave(u, 6, .08) > .8 && v > .79 && v < .86; c = lamp ? [255, 255, 250] : [120, 124, 122]; }
      else if (v > .62) c = [196 + panel, 194 + panel, 178 + panel];
      else if (v > .54) { const window = u < .34 || u > .86; c = window && wave(u, 22) < .86 ? [244, 214, 110] : [184 + panel, 182 + panel, 168 + panel]; }
      else if (v > .46) c = [122 + machine, 126 + machine, 125 + machine];
      else { const near = Math.max(0, (v - .12) / .34); c = [92 + 44 * near, 99 + 46 * near, 95 + 44 * near]; }
      data.set([c[0], c[1], c[2], 255], (row * w + col) * 4);
    }
  }
  const texture = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  texture.mapping = THREE.EquirectangularReflectionMapping; texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = texture.minFilter = THREE.LinearFilter; texture.needsUpdate = true;
  return texture;
}

export function packagingMaterials(s) {
  if (s.packagingFloor3Materials) return s.packagingFloor3Materials;
  const reflection = hallReflection(); s.textures?.add(reflection);
  const make = (color, roughness = .6, metalness = .1, extra = {}) => s._material(color, roughness, metalness, extra);
  const steel = (color, roughness, metalness, envMapIntensity = 1) => make(color, roughness, metalness, { envMap: reflection, envMapIntensity });
  const clear = (color, opacity, extra = {}) => make(color, .3, .04, { transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide, ...extra });
  const m = {
    ss: steel(0xc6cbcb, .46, .84, .95), ssPolished: steel(0xd8dcdc, .2, .92, 1.1), ssDark: steel(0x747c7e, .36, .78), ssEdge: steel(0xd2d7d7, .25, .78, 1.05),
    galv: steel(0xbcc2c6, .42, .7), duct: steel(0xc9ced2, .32, .74), darkDuct: make(0x50535b, .5, .5),
    cream: make(0xe5dec5, .63, .22), ivory: make(0xefeadb, .72, .06), white: make(0xf1efe8, .76, .03), panel: make(0xe9e9dd, .8, .05),
    greySteel: make(0x868d9f, .52, .42), frame: make(0x80847f, .55, .5), beige: make(0xc8c2ad, .58, .22), cabinet: make(0xe7e2d2, .6, .12),
    motor: make(0x5e584f, .58, .42), motorTeal: make(0x6e8a89, .5, .36), motorBlue: make(0x2f5f98, .5, .34), motorGreen: make(0x4f6f61, .55, .4),
    black: make(0x20272a, .62, .14), rubber: make(0x2d3433, .86, .04), red: make(0xc1352c, .52, .1), redLamp: make(0xff5a3c, .4, .05, { emissive: 0xff3a20, emissiveIntensity: .55 }),
    green: make(0x35875b, .55, .1), greenLever: make(0x74b27e, .5, .16), yellow: make(0xf2c200, .52, .14), orange: make(0xde7b2c, .55, .14),
    blue: make(0x2b5da8, .55, .2), blueCap: make(0x1d5cc4, .48, .08), teal: make(0x3f8f95, .5, .2), gold: make(0xc99a2c, .5, .2),
    display: make(0x15292d, .28, .12), screen: make(0x86a4ad, .3, .05, { emissive: 0x3c5a63, emissiveIntensity: .35 }), pdaScreen: make(0xd98aa0, .35, .04, { emissive: 0x9b3f5b, emissiveIntensity: .35 }),
    lamp: make(0xfff6de, .5, .04, { emissive: 0xfff6de, emissiveIntensity: .75 }),
    amberCurtain: clear(0xe9c571, .62, { emissive: 0x4a3508, emissiveIntensity: .35 }), clearCurtain: clear(0xeef2f0, .38), hose: clear(0xe9efee, .3), hoseGrey: make(0x4d5257, .82, .06), vinylStrip: clear(0xd6e6e2, .46), acrylic: make(0x23282d, .22, .12, { transparent: true, opacity: .82 }),
    glass: clear(0xb7d2cd, .26), smokedGuard: clear(0x574d43, .48), wrap: clear(0xf3f7f8, .26), mesh: clear(0x7d8284, .5),
    rackPost: make(0x25375f, .5, .3), rackBeam: make(0xd8552a, .52, .2), shelf: make(0x9aa1a5, .5, .5), wood: make(0xb9935f, .86, .02),
    palletRed: make(0x6f2c27, .8, .04), palletBlue: make(0x2c5d9b, .78, .05), palletGreen: make(0x3d7a46, .78, .05),
    carton: make(0xb98f5f, .88, .01), cartonDark: make(0xa67d50, .88, .01), tape: make(0xd8c39a, .7, .02), label: make(0xf3f1e8, .8, .01),
    kraft: make(0xc6a377, .93, .01), whiteSack: make(0xe9e7dc, .9, .01), redSack: make(0xa62b33, .88, .01), blueSack: make(0x2c5fb4, .8, .02),
    zoneLine: make(0xf4c81a, .6, .05), signPost: make(0x3b4348, .5, .4), floor: make(0x2e8a55, .26, .12),
  };
  m.checker = m.frame; m.kraftSack = m.kraft; m.whitePrint = m.whiteSack; m.redPrint = m.redSack;
  if (typeof document !== 'undefined') {
    const plate = (base, mark, repeat) => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
      const c = canvas.getContext('2d'); if (!c) return null;
      c.fillStyle = base; c.fillRect(0, 0, 128, 128); c.strokeStyle = mark; c.lineWidth = 3;
      for (let y = 0; y < 128; y += 32) for (let x = 0; x < 128; x += 32) {
        c.beginPath(); c.moveTo(x + 4, y + 7); c.lineTo(x + 15, y + 18); c.stroke();
        c.beginPath(); c.moveTo(x + 20, y + 25); c.lineTo(x + 30, y + 15); c.stroke();
      }
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(...repeat); s.textures?.add(texture);
      return make(0xffffff, .46, .62, { map: texture });
    };
    m.checker = plate('#8b9294', '#b9c0c1', [2.4, 2.4]) || m.frame;
    m.checkerSmall = plate('#8b9294', '#c0c6c7', [2, 1.4]) || m.frame;
    // Flat stainless panels reflect one direction only, so rolled streaks, a soft
    // vertical falloff and a sheen band keep them reading as sheet metal.
    const sheet = (low, high, streak, sheen) => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
      const c = canvas.getContext('2d'); if (!c) return null;
      const random = seeded(low * 7 + high);
      let value = .5, drift = 0;
      for (let x = 0; x < 256; x++) {
        drift = drift * .9 + (random() - .5) * .05; value = Math.min(1, Math.max(0, value + drift));
        const tone = Math.round(low + (high - low) * value); c.fillStyle = `rgb(${tone},${tone + 2},${tone + 2})`; c.fillRect(x, 0, 1, 256);
      }
      // Wrap the last columns into the first so cylinders close without a seam.
      for (let x = 0; x < 24; x++) { c.globalAlpha = 1 - x / 24; c.drawImage(canvas, 0, 0, 1, 256, 255 - x, 0, 1, 256); } c.globalAlpha = 1;
      for (let i = 0; i < 520; i++) { const light = random() < .5; c.fillStyle = `rgba(${light ? '255,255,255' : '70,76,78'},${random() * streak})`; c.fillRect(random() * 256, random() * 256, 1, 18 + random() * 90); }
      let g = c.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, 'rgba(255,255,255,.16)'); g.addColorStop(.45, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(40,46,48,.2)'); c.fillStyle = g; c.fillRect(0, 0, 256, 256);
      g = c.createLinearGradient(30, 0, 226, 256); for (const [t, a] of [[.26, 0], [.36, sheen], [.46, 0], [.62, 0], [.68, sheen * .6], [.76, 0]]) g.addColorStop(t, `rgba(255,255,255,${a})`); c.fillStyle = g; c.fillRect(0, 0, 256, 256);
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.anisotropy = 4; s.textures?.add(texture);
      return texture;
    };
    for (const [key, map] of [['ss', sheet(174, 212, .045, .12)], ['ssPolished', sheet(148, 234, .045, .22)]]) if (map) { m[key].map = map; m[key].color.set(0xffffff); }
    // Printed bag faces: band, weight and text rows. The first columns stay plain
    // because the pillow maps its sides there.
    const bag = (base, paint) => {
      const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 192;
      const c = canvas.getContext('2d'); if (!c) return null;
      c.fillStyle = base; c.fillRect(0, 0, 256, 192); c.textBaseline = 'middle'; paint(c);
      c.strokeStyle = 'rgba(60,40,20,.28)'; c.lineWidth = 2; for (const x of [26, 248]) { c.beginPath(); c.moveTo(x, 4); c.lineTo(x, 188); c.stroke(); }
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4; s.textures?.add(texture);
      return make(0xffffff, .92, .01, { map: texture });
    };
    const rows = (c, color, x, y, width, count) => { c.fillStyle = color; for (let i = 0; i < count; i++) c.fillRect(x, y + i * 13, width * (i % 3 === 2 ? .6 : 1), 5); };
    m.kraftSack = bag('#c8a67a', c => { c.fillStyle = '#2b4c9b'; c.fillRect(196, 0, 34, 192); c.font = '700 44px sans-serif'; c.fillText('15 kg', 62, 56); c.fillStyle = '#d8632b'; c.fillRect(62, 96, 40, 40); rows(c, '#2b4c9b', 116, 98, 64, 4); }) || m.kraft;
    m.whitePrint = bag('#ece9df', c => { c.fillStyle = '#3563ad'; c.fillRect(40, 18, 190, 22); c.font = '700 40px sans-serif'; c.fillText('20 kg', 60, 82); rows(c, '#7d8794', 60, 118, 130, 4); }) || m.whiteSack;
    m.redPrint = bag('#cfae82', c => { c.fillStyle = '#a3262f'; c.fillRect(78, 0, 178, 192); c.fillStyle = '#f6efe2'; c.font = '700 44px sans-serif'; c.fillText('25 kg', 104, 70); rows(c, '#f0d9d2', 104, 112, 110, 4); }) || m.redSack;
  }
  m.checkerSmall ||= m.checker;
  s.packagingFloor3Materials = m;
  return m;
}

export function seeded(seed) {
  let value = seed >>> 0 || 1;
  return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 4294967296; };
}

// A filled sack: a box whose faces swell in the middle and pinch at the ends.
function pillow() {
  const g = new THREE.BoxGeometry(1, 1, 1, 4, 2, 4), p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) if (Math.abs(n.getY(i)) < .5) uv.setXY(i, .03 + uv.getX(i) * .04, .1 + uv.getY(i) * .8);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) * 2, y = p.getY(i) * 2, z = p.getZ(i) * 2;
    const swell = (1 - .36 * x ** 4) * (1 - .34 * z ** 4);
    p.setXYZ(i, x * .5 * (1 - .05 * z * z), y * .5 * Math.max(.22, swell), z * .5 * (1 - .05 * x * x));
  }
  g.computeVertexNormals(); return g;
}

export function frustum(wTop, dTop, wBottom, dBottom, h) {
  const points = [
    [-wBottom / 2, 0, -dBottom / 2], [wBottom / 2, 0, -dBottom / 2], [wBottom / 2, 0, dBottom / 2], [-wBottom / 2, 0, dBottom / 2],
    [-wTop / 2, h, -dTop / 2], [wTop / 2, h, -dTop / 2], [wTop / 2, h, dTop / 2], [-wTop / 2, h, dTop / 2],
  ], positions = [];
  for (const f of [[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]]) {
    for (const i of [f[0], f[1], f[2], f[0], f[2], f[3]]) positions.push(...points[i]);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.computeVertexNormals();
  g.setAttribute('uv', new THREE.Float32BufferAttribute(Array.from({ length: 6 }, () => [0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]).flat(), 2)); return g;
}

const GEOMETRY = {
  box: () => new THREE.BoxGeometry(1, 1, 1),
  pillow,
  dome: () => new THREE.SphereGeometry(1, 24, 10, 0, TAU, 0, PI / 2),
  ball: () => new THREE.SphereGeometry(1, 14, 10),
};

function mergeInstances(entries) {
  let vertices = 0, indices = 0;
  for (const { geometry, matrices } of entries) { vertices += geometry.attributes.position.count * matrices.length; indices += (geometry.index ? geometry.index.count : geometry.attributes.position.count) * matrices.length; }
  const position = new Float32Array(vertices * 3), normal = new Float32Array(vertices * 3), uv = new Float32Array(vertices * 2), index = new (vertices > 65535 ? Uint32Array : Uint16Array)(indices);
  const point = new THREE.Vector3(), normals = new THREE.Matrix3(); let v = 0, n = 0;
  for (const { geometry, matrices } of entries) {
    const p = geometry.attributes.position, d = geometry.attributes.normal, t = geometry.attributes.uv;
    for (const matrix of matrices) {
      normals.getNormalMatrix(matrix);
      if (geometry.index) for (let i = 0; i < geometry.index.count; i++) index[n++] = geometry.index.getX(i) + v;
      else for (let i = 0; i < p.count; i++) index[n++] = i + v;
      for (let i = 0; i < p.count; i++, v++) {
        point.fromBufferAttribute(p, i).applyMatrix4(matrix).toArray(position, v * 3);
        point.fromBufferAttribute(d, i).applyMatrix3(normals).normalize().toArray(normal, v * 3);
        if (t) { uv[v * 2] = t.getX(i); uv[v * 2 + 1] = t.getY(i); }
      }
    }
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.BufferAttribute(position, 3)); merged.setAttribute('normal', new THREE.BufferAttribute(normal, 3)); merged.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  merged.setIndex(new THREE.BufferAttribute(index, 1)); merged.computeBoundingBox(); merged.computeBoundingSphere();
  return merged;
}

export class PartKit {
  constructor(s, group, name, frame = new THREE.Matrix4(), bins = new Map()) {
    this.s = s; this.group = group; this.name = name; this.frame = frame; this.bins = bins;
  }
  at(position = [0, 0, 0], rotation = [0, 0, 0]) {
    const local = new THREE.Matrix4().compose(new THREE.Vector3(...position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(1, 1, 1));
    return new PartKit(this.s, this.group, this.name, this.frame.clone().multiply(local), this.bins);
  }
  put(key, factory, material, position, scale, quaternion, options = {}) {
    const name = options.name || this.name, id = `${name}|${key}|${material.uuid}`;
    let bin = this.bins.get(id);
    if (!bin) this.bins.set(id, bin = { name, factory, material, options, matrices: [] });
    bin.matrices.push(this.frame.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(...position), quaternion, new THREE.Vector3(...scale))));
    return this;
  }
  box(material, size, position, rotation, options) {
    return this.put('box', GEOMETRY.box, material, position, size, new THREE.Quaternion().setFromEuler(new THREE.Euler(...(rotation || [0, 0, 0]))), options);
  }
  boxes(material, rows, options) { for (const [size, position, rotation] of rows) this.box(material, size, position, rotation, options); return this; }
  sack(material, size, position, rotation, options) {
    return this.put('pillow', GEOMETRY.pillow, material, position, size, new THREE.Quaternion().setFromEuler(new THREE.Euler(...(rotation || [0, 0, 0]))), options);
  }
  ball(material, size, position, options) { return this.put('ball', GEOMETRY.ball, material, position, size, new THREE.Quaternion(), options); }
  dome(material, size, position, rotation, options) {
    return this.put('dome', GEOMETRY.dome, material, position, size, new THREE.Quaternion().setFromEuler(new THREE.Euler(...(rotation || [0, 0, 0]))), options);
  }
  // Straight or tapered round member; axis x/y/z or an explicit rotation.
  cyl(material, radius, height, position, { axis = 'y', rotation, bottom = radius, seg = 20, open = false, ...options } = {}) {
    const euler = rotation ? new THREE.Euler(...rotation) : axis === 'x' ? new THREE.Euler(0, 0, PI / 2) : axis === 'z' ? new THREE.Euler(PI / 2, 0, 0) : new THREE.Euler();
    const ratio = radius > 0 ? Math.round(bottom / radius * 1000) / 1000 : 0;
    const top = radius > 0 ? 1 : 0, base = radius > 0 ? ratio : 1, unit = radius > 0 ? radius : bottom;
    return this.put(`cyl:${top}:${base}:${seg}:${open}`, () => new THREE.CylinderGeometry(top, base, 1, seg, 1, open), material, position, [unit, height, unit], new THREE.Quaternion().setFromEuler(euler), options);
  }
  rod(material, a, b, radius = .025, { seg = 8, ...options } = {}) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start), length = delta.length();
    if (length < 1e-6) return this;
    return this.put(`cyl:1:1:${seg}:false`, () => new THREE.CylinderGeometry(1, 1, 1, seg, 1, false), material, start.add(end).multiplyScalar(.5).toArray(), [radius, length, radius], new THREE.Quaternion().setFromUnitVectors(UP, delta.normalize()), options);
  }
  rods(material, rows, radius, options) { for (const [a, b, r] of rows) this.rod(material, a, b, r || radius, options); return this; }
  // Square tube between two points (frames, rails drawn as flat bar).
  bar(material, a, b, width, depth = width, options) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start), length = delta.length();
    return this.put('box', GEOMETRY.box, material, start.add(end).multiplyScalar(.5).toArray(), [width, length, depth], new THREE.Quaternion().setFromUnitVectors(UP, delta.normalize()), options);
  }
  ring(material, radius, tube, position, rotation = [PI / 2, 0, 0], { arc = TAU, seg = 24, ...options } = {}) {
    const ratio = Math.round(tube / radius * 1000) / 1000;
    return this.put(`ring:${ratio}:${arc}:${seg}`, () => new THREE.TorusGeometry(1, ratio, 6, seg, arc), material, position, [radius, radius, radius], new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), options);
  }
  // One-off shapes that share this part's local frame.
  mesh(geometry, material, position = [0, 0, 0], rotation = [0, 0, 0], options) {
    return this.put(`one:${geometry.uuid}`, () => geometry, material, position, [1, 1, 1], new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), options);
  }
  extrude(material, points, depth, position = [0, 0, 0], rotation = [0, 0, 0], options) {
    const outline = () => { const shape = new THREE.Shape(); points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y)); shape.closePath(); return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1, curveSegments: 1 }); };
    return this.put(`extrude:${depth}:${points.flat().map(n => n.toFixed(4)).join()}`, outline, material, position, [1, 1, 1], new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), options);
  }
  tube(material, points, radius, options = {}) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), false, 'centripetal');
    return this.mesh(new THREE.TubeGeometry(curve, options.segments || Math.max(8, points.length * 5), radius, options.radial || 8, false), material, [0, 0, 0], [0, 0, 0], options);
  }
  coil(material, top, bottom, radius, turns, wire, options = {}) {
    const points = [], n = turns * 10;
    for (let i = 0; i <= n; i++) { const t = i / n, a = t * turns * TAU; points.push([top[0] + (bottom[0] - top[0]) * t + Math.cos(a) * radius, top[1] + (bottom[1] - top[1]) * t, top[2] + (bottom[2] - top[2]) * t + Math.sin(a) * radius]); }
    return this.tube(material, points, wire, { segments: n, radial: 5, ...options });
  }
  flush() {
    // Repeated shapes stay instanced. Small unnamed leftovers of one material
    // share a single mesh, which keeps detailed machines light to draw.
    const loose = new Map(), place = (mesh, name, material, options) => {
      mesh.name = name; mesh.castShadow = options.shadow !== false && !material.transparent; mesh.receiveShadow = true;
      if (options.pick === false) mesh.raycast = () => {};
      if (options.solid === false) mesh.userData.personCollision = false;
      if (options.order !== undefined) mesh.renderOrder = options.order;
      this.group.add(mesh); this.s.geometries?.add(mesh.geometry);
    };
    const instance = ({ name, geometry, material, options, matrices }) => {
      const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
      matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
      mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingBox(); mesh.computeBoundingSphere();
      place(mesh, name, material, options);
    };
    for (const bin of this.bins.values()) {
      const entry = { ...bin, geometry: bin.factory() }, { material, options, matrices, geometry } = entry;
      if (options.name || geometry.attributes.position.count * matrices.length > 2600) { instance(entry); continue; }
      const key = [material.uuid, options.shadow !== false, options.pick, options.solid, options.order].join('|');
      if (!loose.has(key)) loose.set(key, []); loose.get(key).push(entry);
    }
    for (const entries of loose.values()) {
      if (entries.length === 1) { instance(entries[0]); continue; }
      const { name, material, options } = entries[0];
      place(new THREE.Mesh(mergeInstances(entries), material), name, material, options);
      entries.forEach(entry => entry.geometry.dispose());
    }
    this.bins.clear();
    return this;
  }
}

// Printed plates and floor lettering share textures by content.
export function textPlate(s, parent, text, options = {}) {
  const { width = .6, height = .2, position = [0, 0, 0], rotation = [0, 0, 0], background = '#ffffff', color = '#15191c', top, bottom, border, flat = false, weight = 700, name = 'packaging-printed-plate', opacity = 1, scale = 1 } = options;
  const lines = String(text).split('|');
  let material;
  if (typeof document !== 'undefined') {
    const key = JSON.stringify([text, width / height, background, color, top, bottom, border, flat, weight, opacity, scale]);
    const cache = s.packagingPlateMaterials ||= new Map();
    material = cache.get(key);
    if (!material) {
      const canvas = document.createElement('canvas'), h = 128 * Math.max(1, lines.length * .75);
      canvas.height = Math.round(h); canvas.width = Math.max(64, Math.min(2048, Math.round(h * width / height)));
      const c = canvas.getContext('2d'); if (!c) return null;
      if (!flat) { c.fillStyle = background; c.fillRect(0, 0, canvas.width, canvas.height); }
      if (top) { c.fillStyle = top; c.fillRect(0, 0, canvas.width, canvas.height * .14); }
      if (bottom) { c.fillStyle = bottom; c.fillRect(0, canvas.height * .86, canvas.width, canvas.height * .14); }
      if (border) { c.strokeStyle = border; c.lineWidth = Math.max(3, canvas.height * .05); c.strokeRect(0, 0, canvas.width, canvas.height); }
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = color; c.globalAlpha = opacity;
      const room = canvas.height * (top || bottom ? .68 : .8) / lines.length;
      lines.forEach((line, i) => {
        let size = room * .82 * scale; c.font = `${weight} ${size}px "Malgun Gothic", "Noto Sans KR", sans-serif`;
        const wide = c.measureText(line).width, limit = canvas.width * .9;
        if (wide > limit) { size *= limit / wide; c.font = `${weight} ${size}px "Malgun Gothic", "Noto Sans KR", sans-serif`; }
        c.fillText(line, canvas.width / 2, canvas.height / 2 + (i - (lines.length - 1) / 2) * room);
      });
      const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4; s.textures?.add(map);
      material = flat ? new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, side: THREE.DoubleSide })
        : s._material(0xffffff, .72, .02, { map });
      if (flat) s.materials?.add(material);
      cache.set(key, material);
    }
  } else material = s._material(0xf2f0e8, .8, .02);
  const mesh = s._mesh(new THREE.PlaneGeometry(width, height), material, parent, position);
  mesh.rotation.set(...rotation); mesh.name = name; mesh.castShadow = false; mesh.receiveShadow = !flat;
  mesh.userData.personCollision = false; mesh.userData.printedText = text;
  if (flat) mesh.renderOrder = 1;
  return mesh;
}

// ---- pallets and stacked goods ----------------------------------------------
export function pallet(kit, m, x, y, z, tone = 'palletRed', w = 1.1, d = 1.1) {
  const mat = m[tone];
  kit.box(mat, [w, .03, d], [x, y + .125, z]);
  for (const px of [-1, 0, 1]) {
    kit.box(mat, [.12, .022, d], [x + px * (w / 2 - .06), y + .011, z]);
    for (const pz of [-1, 0, 1]) kit.box(mat, [.14, .09, .14], [x + px * (w / 2 - .07), y + .066, z + pz * (d / 2 - .07)]);
  }
  return y + .14;
}

export function stackCartons(kit, m, x, y, z, { w = 1, d = 1, layers = 4, height = .25, random = Math.random, nx = 2, nz = 3 } = {}) {
  for (let layer = 0; layer < layers; layer++) {
    const swap = layer % 2 === 1, cx = swap ? nz : nx, cz = swap ? nx : nz, bw = w / cx, bd = d / cz, cy = y + (layer + .5) * height;
    for (let i = 0; i < cx; i++) for (let j = 0; j < cz; j++) {
      if (layer === layers - 1 && random() < .16) continue;
      const px = x + (i + .5) * bw - w / 2, pz = z + (j + .5) * bd - d / 2, dark = random() < .35;
      kit.box(dark ? m.cartonDark : m.carton, [bw - .014, height - .008, bd - .014], [px, cy, pz]);
      kit.box(m.tape, [swap ? .045 : bw - .02, .004, swap ? bd - .02 : .045], [px, cy + height / 2 - .002, pz], undefined, { shadow: false });
      for (const [edge, side] of [[j === 0, -1], [j === cz - 1, 1]]) if (edge) kit.box(m.label, [Math.min(.15, bw * .42), .075, .004], [px + bw * .1, cy + .02, pz + side * (bd / 2 - .005)], undefined, { shadow: false });
    }
  }
  return y + layers * height;
}

export function stackSacks(kit, m, x, y, z, { layers = 5, tone = 'kraftSack', random = Math.random } = {}) {
  const h = .145;
  for (let layer = 0; layer < layers; layer++) {
    const turn = layer % 2 ? PI / 2 : 0, cy = y + (layer + .5) * h * .93;
    for (let i = 0; i < 4; i++) {
      const a = turn + i * PI / 2, px = x + Math.cos(a) * .235 - Math.sin(a) * .155, pz = z + Math.sin(a) * .235 + Math.cos(a) * .155, spin = -a + (random() - .5) * .07;
      kit.sack(m[tone], [.63, h, .46], [px, cy, pz], [0, spin, 0]);
    }
  }
  return y + layers * h * .93;
}

export function wrappedLoad(kit, m, x, y, z, { height = .95, random = Math.random } = {}) {
  const w = .98 + random() * .06, d = .98 + random() * .06;
  kit.box(random() < .5 ? m.whiteSack : m.carton, [w, height, d], [x, y + height / 2, z]);
  for (let i = 1; i < 4; i++) kit.box(m.cartonDark, [w + .006, .008, d + .006], [x, y + height * i / 4, z], undefined, { shadow: false });
  kit.box(m.label, [.22, .15, .006], [x - w * .18, y + height * .62, z + d / 2 + .012], undefined, { shadow: false });
  kit.box(m.wrap, [w + .045, height + .02, d + .045], [x, y + height / 2, z], undefined, { shadow: false, pick: false, order: 2 });
  return y + height;
}

export function drums(kit, m, x, y, z, { random = Math.random } = {}) {
  for (const px of [-.26, .26]) for (const pz of [-.26, .26]) {
    if (random() < .12) continue;
    kit.cyl(m.blue, .24, .62, [x + px, y + .31, z + pz], { seg: 18 });
    for (const ry of [.14, .32, .5]) kit.ring(m.blueCap, .243, .012, [x + px, y + ry, z + pz], undefined, { seg: 18 });
    kit.cyl(m.ivory, .235, .03, [x + px, y + .635, z + pz], { seg: 18 });
  }
  return y + .65;
}

export function goods(kit, m, x, y, z, kind, random, limit = 1.15) {
  const pick = kind === 'mixed' ? ['carton', 'sack', 'wrapped', 'carton', 'drum'][Math.floor(random() * 5)] : kind;
  const tones = ['palletRed', 'palletRed', 'palletBlue', 'palletGreen', 'wood'];
  const top = pallet(kit, m, x, y, z, tones[Math.floor(random() * tones.length)]);
  if (pick === 'sack' || pick === 'sack-low') {
    const most = Math.max(2, Math.floor((limit - .05) / .135)), layers = pick === 'sack-low' ? 1 + Math.floor(random() * 4) : Math.max(3, Math.round(most * (.55 + random() * .45)));
    const tone = ['kraftSack', 'whitePrint', 'kraftSack', 'redPrint', 'whitePrint'][Math.floor(random() * 5)];
    return stackSacks(kit, m, x, top, z, { layers: Math.min(layers, most), tone, random });
  }
  if (pick === 'wrapped') return wrappedLoad(kit, m, x, top, z, { height: Math.min(limit, .7 + random() * .5), random });
  if (pick === 'drum') return drums(kit, m, x, top, z, { random });
  const height = .23 + random() * .07, most = Math.max(2, Math.floor(limit / height));
  return stackCartons(kit, m, x, top, z, { w: 1.02, d: 1.02, height, layers: Math.max(2, Math.round(most * (.6 + random() * .4))), random, nx: random() < .5 ? 2 : 3, nz: 3 });
}
