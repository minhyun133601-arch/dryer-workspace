import * as THREE from '../shared/vendor/three.module.js';
import { buildPackagingMixing } from './packaging-mixing-models.js';
import { buildPackagingStorage } from './packaging-storage-models.js';

// Drawing-local metres: X is plan-right, Z is plan-down, Y=0 is the floor.
// The scene owns transforms, selection and the three real separation groups.
const PI = Math.PI, UP = new THREE.Vector3(0, 1, 0);

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
    amberCurtain: make(0xe7ab38, .48, .01, { transparent: true, opacity: .54, depthWrite: false, side: THREE.DoubleSide }),
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
  // H9-M-010 shows both trolleys in one frame. H9-M-011 shows the
  // two-tier trolley again, with a white switch box on each open shelf.
  for (const [index, tiers] of [1, 2].entries()) {
    const x = item.includeTankAndSink ? w * .37 : w * .03 + index * .59;
    const z = item.includeTankAndSink ? -.35 + index * .8 : 0;
    const cart = s._group(washing, [x, 0, z]);
    cart.name = 'packaging-cip-portable-pressure-washer';
    const top = tiers === 2 ? 1.02 : .63, frame = [];
    for (const side of [-1, 1]) {
      const sx = side * .21;
      frame.push([[sx, .15, -.22], [sx, top, -.22]], [[sx, top, -.22], [sx, top, .2]],
        [[sx, .15, .2], [sx, top, .2]]);
      const wheel = s._cyl(cart, .09, .055, [side * .24, .09, .16], m.blue, .09, 16);
      wheel.rotation.z = PI / 2;
    }
    frame.push([[-.21, top, .2], [.21, top, .2]], [[-.21, top, -.22], [.21, top, -.22]]);
    rods(s, cart, m.edge, frame, 'packaging-pressure-washer-handle', .018);
    for (let tier = 0; tier < tiers; tier++) {
      const y = .19 + tier * .44;
      s._box(cart, [.45, .032, .49], [0, y, 0], m.ss);
      const motor = s._cyl(cart, .095, .29, [0, y + .11, -.045], m.darkSS, .095, 18);
      motor.rotation.x = PI / 2;
      s._box(cart, [.36, .21, .105], [0, y + .14, .245], m.white).name = 'packaging-cip-pump-switchbox';
      for (const [buttonX, finish] of [[-.1, m.black], [0, m.green], [.1, m.red]]) {
        const button = s._cyl(cart, .021, .016, [buttonX, y + .15, .303], finish, .021, 12);
        button.rotation.x = PI / 2;
      }
    }
    ring(s, accessory, x, top - .13, z + .09, .135, m.black, 'packaging-pressure-washer-coiled-hose', [.24, .12, .15], .016);
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
  'packaging-cip-services': cip, 'packaging-scale': scale, 'packaging-weigh-services': weighServices,
};

export function buildPackagingEquipmentV2(s, root, item) {
  if (buildPackagingMixing(s, root, item) || buildPackagingStorage(s, root, item)) return true;
  const builder = BUILDERS[item.type];
  if (!builder) return false;
  builder(s, root, item); root.userData.packagingEquipmentVersion = 2; return true;
}
