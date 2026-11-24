import * as THREE from '../shared/vendor/three.module.js';
import { PACKAGING_ROOM } from './packaging-data.js';
import { buildPackagingEnvironmentV2 } from './packaging-environment-v2.js';
import { buildPackagingEquipmentV2 } from './packaging-equipment-v2.js';
import { buildPackagingLineEquipment } from './packaging-line-models.js';

// A separate third-floor space. Plan dimensions set the room; the employee's
// video supplies visible machinery, access decks and services, not GPS sizes.
const PI = Math.PI, TAU = PI * 2, Y = new THREE.Vector3(0, 1, 0);

function palette(s) {
  if (s.packagingMaterials) return s.packagingMaterials;
  const make = (color, roughness = .65, metalness = .15, extra = {}) => s._material(color, roughness, metalness, extra);
  const m = {
    steel: s.mat?.steel || make(0xd5dfd9, .36, .65), trim: make(0xaab9b3, .44, .6),
    white: make(0xe8ece4, .8), cream: make(0xd8d4ba, .84), dark: make(0x233b37, .6),
    floor: make(0x338166, .88, .02), concrete: make(0xc7c9bb, .94, .02),
    yellow: make(0xddc15d, .75), window: make(0xe4ca55, .8, .02, { transparent: true, opacity: .76 }),
    motor: make(0x5b706d, .64, .36), black: make(0x23312f, .78), blue: make(0x3c7c95, .62, .2),
    red: make(0xb35343, .75), green: make(0x3c9b6b, .6), display: make(0x203f42, .3, .2),
    glass: make(0xa5c4bc, .24, .1, { transparent: true, opacity: .28, depthWrite: false }),
    light: make(0xf5f1dc, .7, .05, { emissive: 0xf5efd7, emissiveIntensity: .75 }),
  };
  m.deck = m.trim;
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    const c = canvas.getContext('2d'); c.fillStyle = '#b5c2bc'; c.fillRect(0, 0, 128, 128);
    c.strokeStyle = '#dce3dd'; c.lineWidth = 3;
    for (let y = 0; y < 128; y += 32) for (let x = 0; x < 128; x += 32) {
      c.beginPath(); c.moveTo(x + 4, y + 9); c.lineTo(x + 15, y + 20); c.stroke();
      c.beginPath(); c.moveTo(x + 21, y + 25); c.lineTo(x + 30, y + 16); c.stroke();
    }
    const checker = new THREE.CanvasTexture(canvas); checker.colorSpace = THREE.SRGBColorSpace;
    checker.wrapS = checker.wrapT = THREE.RepeatWrapping; checker.repeat.set(5, 15); s.textures?.add(checker);
    m.deck = make(0xffffff, .58, .45, { map: checker });
  }
  s.packagingMaterials = m; return m;
}

function instances(s, parent, geometry, material, transforms, name, shadow = true) {
  if (!transforms.length) { geometry.dispose(); return null; }
  const mesh = new THREE.InstancedMesh(geometry, material, transforms.length);
  const matrix = new THREE.Matrix4(), quaternion = new THREE.Quaternion();
  transforms.forEach((entry, index) => {
    if (entry.quaternion) quaternion.fromArray(entry.quaternion);
    else quaternion.setFromEuler(new THREE.Euler(...(entry.rotation || [0, 0, 0])));
    matrix.compose(new THREE.Vector3(...entry.position), quaternion, new THREE.Vector3(...(entry.scale || [1, 1, 1])));
    mesh.setMatrixAt(index, matrix);
  });
  mesh.instanceMatrix.needsUpdate = true; mesh.castShadow = shadow; mesh.receiveShadow = true;
  mesh.name = name; mesh.computeBoundingBox(); mesh.computeBoundingSphere(); parent.add(mesh); s.geometries?.add(geometry);
  return mesh;
}

function boxes(s, parent, material, values, name, shadow = true) {
  return instances(s, parent, new THREE.BoxGeometry(1, 1, 1), material,
    values.map(([position, scale, rotation]) => ({ position, scale, rotation })), name, shadow);
}

function bars(s, parent, material, segments, name, radius = .035) {
  const q = new THREE.Quaternion();
  return instances(s, parent, new THREE.CylinderGeometry(1, 1, 1, 8), material, segments.map(([a, b, thickness]) => {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start), r = thickness || radius;
    q.setFromUnitVectors(Y, delta.clone().normalize());
    return { position: start.add(end).multiplyScalar(.5).toArray(), quaternion: q.toArray(), scale: [r, delta.length(), r] };
  }), name);
}

function parts(s, root, item) {
  return item.parts.map((name, index) => {
    const group = s._part(root, name, [[-1.2, .4, 0], [0, 1.5, 0], [1.1, .4, .7]][index]);
    group.name = `${item.id}-${['body', 'process', 'details'][index]}`; return group;
  });
}

function pyramid(width, depth, bottomWidth, bottomDepth, height) {
  const vertices = [
    [-bottomWidth / 2, 0, -bottomDepth / 2], [bottomWidth / 2, 0, -bottomDepth / 2],
    [bottomWidth / 2, 0, bottomDepth / 2], [-bottomWidth / 2, 0, bottomDepth / 2],
    [-width / 2, height, -depth / 2], [width / 2, height, -depth / 2],
    [width / 2, height, depth / 2], [-width / 2, height, depth / 2],
  ];
  const positions = [];
  for (const face of [[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]]) {
    for (const index of [face[0], face[1], face[2], face[0], face[2], face[3]]) positions.push(...vertices[index]);
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.computeVertexNormals();
  return geometry;
}

function roundedLoop(s, parent, width, depth, y, material, name) {
  bars(s, parent, material, [
    [[-width / 2, y, -depth / 2], [width / 2, y, -depth / 2]],
    [[width / 2, y, -depth / 2], [width / 2, y, depth / 2]],
    [[width / 2, y, depth / 2], [-width / 2, y, depth / 2]],
    [[-width / 2, y, depth / 2], [-width / 2, y, -depth / 2]],
  ], name);
}

function hopperInspection(s, parent, w, topDepth, bottomDepth, bottom, top, z, m) {
  // 342/817: an inclined bolted access door follows the hopper face.
  const angle = Math.atan((topDepth - bottomDepth) / (2 * (top - bottom)));
  const panel = s._group(parent, [0, (top + bottom) / 2, z + (topDepth + bottomDepth) / 4 + .025]);
  panel.rotation.x = angle; panel.name = 'packaging-hopper-inclined-inspection-door';
  const pw = w * .58, ph = (top - bottom) * .66;
  s._box(panel, [pw, ph, .035], [0, 0, 0], m.trim);
  s._box(panel, [pw - .08, ph - .07, .025], [0, 0, .03], m.steel);
  const fittings = [], hinges = [];
  for (const x of [-pw / 2 + .04, pw / 2 - .04]) for (const y of [-ph * .4, 0, ph * .4]) fittings.push({ position: [x, y, .06], rotation: [PI / 2, 0, 0] });
  for (const x of [-pw * .28, pw * .28]) {
    fittings.push({ position: [x, -ph / 2 + .02, .06], rotation: [PI / 2, 0, 0] });
    hinges.push([[x, ph / 2, .04], [pw * .19, .055, .065]], [[x, -ph / 2, .08], [.055, .12, .045]]);
  }
  instances(s, panel, new THREE.CylinderGeometry(.025, .025, .035, 6), m.dark, fittings, 'packaging-hopper-access-door-perimeter-bolts');
  boxes(s, panel, m.trim, hinges, 'packaging-hopper-access-door-hinges-and-toggle-clamps');
  s._cyl(panel, .07, .055, [0, 0, .08], m.dark, .07, 8).rotation.x = PI / 2;
  boxes(s, panel, m.trim, [[[0, 0, .12], [.19, .035, .025]], [[0, 0, .12], [.035, .19, .025]]], 'packaging-hopper-star-door-handle');
}

function mixerDischarge(s, body, process, details, item, m) {
  const { width: w, depth: d } = item, top = (item.platformHeight ?? 2.4) - .12;
  const round = item.dischargeVariant === 'round-valve-pair', blackRing = item.dischargeVariant === 'black-ring';
  const count = blackRing || item.type === 'packaging-aux-mixer' ? 1 : 2;
  const depth = d * (count === 2 ? .36 : .64), bottom = round ? .99 : 1.05;
  const connectors = [], rings = [], actuators = [], hoses = [], corners = [];
  for (let index = 0; index < count; index++) {
    const z = count === 1 ? 0 : (index ? 1 : -1) * d * .22;
    if (round) {
      s._cyl(process, Math.min(w * .29, depth * .48), top - bottom, [0, (top + bottom) / 2, z], m.steel, .15, 32).name = 'packaging-long-round-conical-discharge';
      s._box(process, [.48, .28, .43], [0, .82, z], m.motor).name = 'packaging-angular-discharge-valve-box';
      s._cyl(process, .14, .5, [0, .43, z], m.steel, .14, 16).name = 'packaging-round-hopper-short-vertical-neck';
      s._cyl(process, .25, .08, [0, .14, z], m.trim, .25, 24).name = 'packaging-outlet-floor-flange';
      rings.push({ position: [0, 1.01, z], scale: [.23, .055, .23] }, { position: [0, .64, z], scale: [.22, .055, .22] });
      actuators.push({ position: [.33, .82, z], rotation: [0, 0, PI / 2], scale: [.075, .22, .075] });
    } else {
      s._mesh(pyramid(w * .72, depth, .42, .4, top - bottom), m.steel, process, [0, bottom, z]).name = 'packaging-inverted-pyramid-discharge-hopper';
      hopperInspection(s, details, w * .72, depth, .4, bottom, top, z, m);
      for (const x of [-1, 1]) for (const side of [-1, 1]) corners.push([[x * .21, bottom, z + side * .2], [x * w * .36, top, z + side * depth / 2], .018]);
      if (blackRing) {
        connectors.push({ position: [0, bottom - .18, z], scale: [.195, .27, .195] });
        rings.push({ position: [0, bottom - .04, z], scale: [.245, .065, .245] }, { position: [0, bottom - .32, z], scale: [.245, .065, .245] });
      } else {
        connectors.push({ position: [0, .61, z], scale: [.18, .8, .18] });
        rings.push({ position: [0, 1.01, z], scale: [.24, .065, .24] }, { position: [0, .22, z], scale: [.24, .065, .24] });
        boxes(s, process, m.trim, [
          [[0, .04, z], [.65, .05, .65]], [[-.31, .11, z], [.035, .15, .65]], [[.31, .11, z], [.035, .15, .65]],
          [[0, .11, z - .31], [.65, .15, .035]], [[0, .11, z + .31], [.65, .15, .035]],
        ], 'packaging-white-neck-low-square-floor-pan');
      }
      actuators.push({ position: [.32, bottom + .06, z + .2], rotation: [0, 0, PI / 2], scale: [.1, .23, .1] });
      hoses.push([[.43, bottom + .06, z + .2], [.48, .62, z + .24]], [[.48, .62, z + .24], [.32, .48, z + .29]]);
    }
  }
  instances(s, process, new THREE.CylinderGeometry(1, 1, 1, 20), blackRing ? m.black : m.white, connectors, blackRing ? 'packaging-black-flexible-outlet-ring' : 'packaging-short-flexible-outlet-connectors');
  instances(s, details, new THREE.CylinderGeometry(1, 1, 1, 24), m.trim, rings, 'packaging-hopper-bolted-outlet-flanges');
  instances(s, details, new THREE.CylinderGeometry(1, 1, 1, 16), m.blue, actuators, 'packaging-blue-round-discharge-actuators');
  bars(s, details, m.black, hoses, 'packaging-discharge-actuator-black-hoses', .023);
  bars(s, details, m.trim, corners, 'packaging-hopper-corner-strengthening-strips', .018);
}

function mixerHood(s, body, item, m) {
  const w = item.width * .85, d = item.depth * .75, h = item.height, base = h - 1.35, eave = h - .65;
  boxes(s, body, m.steel, [
    [[-w / 2, (base + eave) / 2, 0], [.045, eave - base, d]], [[w / 2, (base + eave) / 2, 0], [.045, eave - base, d]],
    [[0, (base + eave) / 2, -d / 2], [w, eave - base, .045]], [[0, (base + eave) / 2, d / 2], [w, eave - base, .045]],
  ], 'packaging-full-closed-mixer-extraction-hood');
  s._mesh(pyramid(w * .35, d * .4, w + .05, d + .05, .36), m.steel, body, [0, eave, 0]).name = 'packaging-mixer-hood-sloping-roof';
  s._cyl(body, .22, .28, [0, h - .14, 0], m.trim, .22, 24).name = 'packaging-mixer-hood-round-vertical-extraction-neck';
}

function mixer(s, root, item) {
  const m = palette(s), [body, process, details] = parts(s, root, item);
  const { width: w, depth: d } = item, deck = item.platformHeight ?? 2.4;
  const machineHeight = Math.max(1.7, item.height - deck), radius = Math.min(w * .34, machineHeight * .38);
  const troughDepth = d * .68, centerY = deck + radius + .34, lidY = centerY + .36;
  const trough = new THREE.CylinderGeometry(radius, radius, troughDepth, 24, 1, false, -PI / 2, PI); trough.rotateX(PI / 2);
  s._mesh(trough, m.steel, body, [0, centerY, 0]).name = 'packaging-horizontal-trough';
  s._box(body, [radius * 2, .37, troughDepth], [0, centerY + .185, 0], m.steel);
  const legHeight = Math.max(.3, centerY - radius + .08), legs = [];
  for (const x of [-w * .34, w * .34]) for (const z of [-d * .29, d * .29]) legs.push([[x, legHeight / 2, z], [.12, legHeight, .14]]);
  boxes(s, body, m.cream, legs, 'packaging-mixer-machine-supports');
  boxes(s, body, m.trim, [
    [[0, deck + .06, -d * .29], [w * .78, .12, .18]], [[0, deck + .06, d * .29], [w * .78, .12, .18]],
  ], 'packaging-mixer-support-crossmembers');
  const cover = pyramid(radius * 1.75, troughDepth * .93, radius * 2 + .06, troughDepth + .06, .32);
  s._mesh(cover, m.steel, process, [0, lidY, 0]).name = 'packaging-mixer-sealed-lid';
  const ports = [-troughDepth * .25, troughDepth * .25].map((z) => ({ position: [0, lidY + .39, z], scale: [w * .12, .13, w * .12] }));
  instances(s, process, new THREE.CylinderGeometry(1, 1, 1, 20), m.steel, ports, 'packaging-mixer-two-round-charge-ports');
  const capHandles = [];
  for (const z of [-troughDepth * .25, troughDepth * .25]) {
    capHandles.push([[-.12, lidY + .49, z], [.045, .12, .045]], [[.12, lidY + .49, z], [.045, .12, .045]], [[0, lidY + .55, z], [.28, .045, .045]]);
  }
  boxes(s, details, m.trim, capHandles, 'packaging-mixer-charge-port-handles');
  mixerDischarge(s, body, process, details, item, m);
  if (item.type === 'packaging-mixer') mixerHood(s, body, item, m);
  const motor = s._cyl(details, .31, d * .15, [0, centerY - .21, troughDepth / 2 + d * .085], m.motor, .31, 16);
  motor.rotation.x = PI / 2; motor.name = 'packaging-mixer-horizontal-end-motor';
  const fan = s._cyl(details, .27, .05, [0, centerY - .21, d * .475], m.dark, .27, 16); fan.rotation.x = PI / 2;
  const ribs = [], clamps = [];
  for (let index = -3; index <= 3; index++) ribs.push([[index * .07, centerY - .21, troughDepth / 2 + d * .085], [.025, .48, d * .13]]);
  for (const side of [-1, 1]) for (const z of [-troughDepth * .36, 0, troughDepth * .36]) {
    clamps.push([[side * (radius + .035), lidY + .02, z], [.065, .2, .1]]);
    clamps.push([[side * (radius + .09), lidY - .12, z], [.05, .17, .06]]);
  }
  boxes(s, details, m.motor, ribs, 'packaging-mixer-motor-cooling-fins');
  boxes(s, details, m.trim, clamps, 'packaging-mixer-lid-hinges-and-clamps');
  const lidRail = roundedLoop(s, details, radius * 2 + .1, troughDepth + .1, lidY + .04, m.trim, 'packaging-mixer-lid-seam');
  return lidRail;
}

function sieve(s, root, item) {
  const m = palette(s), [body, process, details] = parts(s, root, item), deck = item.platformHeight ?? 2.4;
  const r = Math.min(item.width, item.depth) * .34, available = Math.max(1.4, item.height - deck), bodyTop = deck + available * .72;
  s._cyl(body, r * .78, available * .35, [0, deck + available * .175, 0], m.steel, r * .78, 24);
  boxes(s, body, m.cream, [-1, 1].flatMap((x) => [-1, 1].map((z) => [[x * item.width * .37, deck / 2, z * item.depth * .34], [.08, deck, .08]])), 'packaging-small-unit-support-frame');
  const ringY = [deck + available * .39, deck + available * .52, deck + available * .65];
  instances(s, body, new THREE.CylinderGeometry(r, r, available * .13, 32), m.steel,
    ringY.map((y) => ({ position: [0, y, 0] })), 'packaging-sieve-stacked-round-sections');
  instances(s, details, new THREE.TorusGeometry(r + .015, .025, 5, 32), m.trim,
    ringY.flatMap((y) => [-1, 1].map((side) => ({ position: [0, y + side * available * .065, 0], rotation: [PI / 2, 0, 0] }))), 'packaging-sieve-circular-clamping-bands');
  const lid = s._cyl(process, r * .16, available * .22, [0, bodyTop + available * .11, 0], m.steel, r, 32);
  lid.name = 'packaging-sieve-conical-top-cover';
  s._cyl(details, r * .17, .12, [0, bodyTop + available * .26, 0], m.steel, r * .17, 16);
  const springPoints = Array.from({ length: 6 }, (_, i) => [Math.cos(i * TAU / 6) * r * .76, Math.sin(i * TAU / 6) * r * .76]);
  instances(s, details, new THREE.TorusGeometry(.058, .012, 4, 10), m.yellow,
    springPoints.flatMap(([x, z]) => [0, .045, .09, .135].map((rise) => ({ position: [x, deck + available * .31 + rise, z], rotation: [PI / 2, 0, 0] }))), 'packaging-sieve-support-springs');
  const clamps = [];
  for (let index = 0; index < 8; index++) {
    const angle = index * TAU / 8, x = Math.cos(angle) * (r + .035), z = Math.sin(angle) * (r + .035);
    clamps.push([[x, bodyTop - .09, z], [.075, .22, .06], [0, -angle, 0]]);
  }
  boxes(s, details, m.blue, clamps, 'packaging-sieve-toggle-clamp-handles');
  const spoutLength = Math.max(.1, item.depth / 2 - r - .055);
  s._box(process, [r * .6, .21, spoutLength], [0, deck + available * .55, r + spoutLength / 2 - .02], m.steel).name = 'packaging-sieve-short-side-spout';
}

function airUnit(s, root, item) {
  const m = palette(s), [body, process, details] = parts(s, root, item), { width: w, depth: d, height: h } = item;
  const baseHeight = h * .43, upperY = h - .36, radius = Math.min(w * .1, d * .28), bodyZ = -d * .2;
  s._box(body, [w * .72, baseHeight, d * .5], [0, baseHeight / 2, bodyZ], m.white);
  s._box(process, [w * .35, upperY - baseHeight, d * .4], [0, (baseHeight + upperY) / 2, bodyZ], m.white);
  s._box(process, [w, .58, d * .5], [0, upperY, bodyZ], m.white).name = 'packaging-four-jet-plenum';
  const points = [-.375, -.125, .125, .375].map((fraction) => ({ position: [fraction * w, upperY, d * .05 + radius * .5] }));
  const jetShell = new THREE.SphereGeometry(radius, 16, 10, 0, TAU, .6, PI - .6); jetShell.rotateX(PI / 2);
  instances(s, process, jetShell, m.white, points, 'packaging-four-round-air-jets');
  instances(s, details, new THREE.CylinderGeometry(radius * .58, radius * .58, .025, 16), m.dark,
    points.map(({ position: [x, y, z] }) => ({ position: [x, y, z + radius * .8], rotation: [PI / 2, 0, 0] })), 'packaging-air-jet-open-mouths');
  instances(s, details, new THREE.TorusGeometry(radius * .58, .035, 5, 16), m.white,
    points.map(({ position: [x, y, z] }) => ({ position: [x, y, z + radius * .825] })), 'packaging-air-jet-rims');
  boxes(s, details, m.trim, [
    [[0, baseHeight / 2, d * .05 + .02], [.025, baseHeight * .92, .025]],
    [[w * .2, baseHeight * .55, d * .05 + .04], [.06, .3, .04]],
    [[0, .09, d * .05 + .02], [w * .68, .12, .04]],
  ], 'packaging-air-unit-service-door-lines');
  boxes(s, details, m.dark, Array.from({ length: 9 }, (_, index) => [[w * .23, baseHeight * .23 + index * .045, d * .05 + .025], [w * .2, .018, .018]]), 'packaging-air-cabinet-lower-intake-slots');
}

function sink(s, root, item) {
  const m = palette(s), [body, process, details] = parts(s, root, item), { width: w, depth: d, height: h } = item;
  const top = h * .7;
  boxes(s, body, m.steel, [-1, 1].flatMap((x) => [-1, 1].map((z) => [[x * w * .42, top / 2, z * d * .37], [.055, top, .055]])), 'packaging-sink-four-legs');
  boxes(s, process, m.steel, [
    [[0, top - .2, 0], [w, .06, d]], [[0, top - .08, -d / 2], [w, .26, .045]],
    [[0, top - .08, d / 2], [w, .26, .045]], [[-w / 2, top - .08, 0], [.045, .26, d]], [[w / 2, top - .08, 0], [.045, .26, d]],
    [[0, top + h * .14, -d / 2], [w, h * .28, .045]],
  ], 'packaging-sink-basin-and-splashback');
  s._box(process, [.035,.26,d], [0,top-.08,0],m.steel).name='packaging-cip-double-basin-divider';
  boxes(s,process,m.dark,[-1,1].map(side=>[[side*w*.24,top-.15,0],[w*.42,.02,d*.73]]),'packaging-cip-two-recessed-sink-basins');
  for(const side of [-1,1]){
    const x=side*w*.24;
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(x, top, -d * .34), new THREE.Vector3(x, top + .31, -d * .3), new THREE.Vector3(x, top + .37, 0), new THREE.Vector3(x, top + .25, d * .12)]);
    s._mesh(new THREE.TubeGeometry(curve, 12, .025, 8, false), m.trim, details).name = 'packaging-cip-gooseneck-faucet';
    s._cyl(details,.035,.015,[x,top-.13,0],m.trim,.035,12).name='packaging-cip-basin-drain';
  }
}

function vessel(s, root, item) {
  const m = palette(s), [body, lid, fittings] = parts(s, root, item);
  const h = item.height, r = Math.min(item.width, item.depth) * .4, bottom = h * .19, top = h * .83;
  s._cyl(body, r, top - bottom, [0, (top + bottom) / 2, 0], m.steel, r, 40);
  s._cyl(body, r, .05, [0, bottom - .025, 0], m.steel, r * .91, 40);
  const feet = [], collars = [];
  for (let index = 0; index < 3; index++) {
    const angle = PI / 2 + index * TAU / 3;
    const point = (distance, y) => [Math.cos(angle) * distance, y, Math.sin(angle) * distance];
    const bend = [point(r * .96, bottom + .14), point(r * 1.12, bottom + .14),
      point(r * 1.23, bottom + .115), point(r * 1.3, bottom + .06), point(r * 1.32, bottom), point(r * 1.32, .04)];
    for (let j = 1; j < bend.length; j++) feet.push([bend[j - 1], bend[j], .05]);
    collars.push([point(r * 1.32, 0), point(r * 1.32, .065), .064]);
  }
  bars(s, body, m.steel, feet, 'packaging-vessel-bent-tubular-feet');
  bars(s, body, m.white, collars, 'packaging-vessel-foot-collars');
  s._cyl(lid, r * 1.045, .035, [0, top + .01, 0], m.trim, r * 1.045, 40);
  const handle = (x, y, z, span, rise) => [
    [[x, y, z], [x, y + rise, z]], [[x, y + rise, z], [x, y + rise, z + span]], [[x, y + rise, z + span], [x, y, z + span]],
  ];
  bars(s, lid, m.steel, handle(r * .49, top + .026, -r * .29, r * .58, .053), 'packaging-vessel-lid-handle', .012);
  const steps = [];
  for (const y of [bottom + .35, bottom + .65]) {
    const z = r * .18;
    steps.push([[r * .95, y, -z], [r + .13, y, -z]], [[r + .13, y, -z], [r + .13, y, z]], [[r + .13, y, z], [r * .95, y, z]]);
  }
  bars(s, fittings, m.steel, steps, 'packaging-vessel-side-steps', .015);
  bars(s, fittings, m.blue, [[[0, top + .035, -r * .68], [0, h, -r * .68]]], 'packaging-vessel-blue-riser', .036);
  bars(s, fittings, m.trim, [
    [[-r * .35, top + .035, -r * .35], [-r * .35, top + .23, -r * .35]],
    [[-r * .35, top + .23, -r * .35], [-r * 1.15, top + .23, -r * .35]],
    [[-r * .8, bottom + .6, r * .52], [-r * 1.15, bottom + .6, r * .52]],
  ], 'packaging-vessel-lid-inlet-and-side-port', .022);
}

function control(s, root, item) {
  const m = palette(s), [body, process, details] = parts(s, root, item), { width: w, depth: d, height: h } = item;
  const bottom = item.wallMounted ? (item.mountHeight || 0) : (item.platformHeight || 0), cabinetH = h - bottom, front = d / 2 + .015;
  if (item.controlVariant === 'dual-mixer') {
    // 557 and 561 are two different enclosures, kept in one movable selection.
    const leftX = -w * .265, rightX = w * .265, cw = w * .465, ch = cabinetH - .18;
    boxes(s, body, m.white, [
      [[leftX, bottom + ch / 2, 0], [cw, ch, d]], [[rightX, bottom + ch / 2, 0], [cw, ch, d]],
    ], 'packaging-dual-mixer-control-enclosures');
    boxes(s, process, m.trim, [
      [[leftX, bottom + ch / 2, front], [cw * .93, ch * .95, .025]],
      [[rightX, bottom + ch / 2, front], [cw * .93, ch * .95, .025]],
    ], 'packaging-dual-control-inner-panels');
    const green = [], red = [], dark = [], gauges = [], keys = [], numbers = [];
    const dot = (x, y) => ({ position: [x, y, front + .055], rotation: [PI / 2, 0, 0] });
    for (let col = 0; col < 6; col++) {
      (col === 5 ? red : green).push(dot(leftX + (col - 2.5) * cw * .145, bottom + ch * .85));
      for (let row = 0; row < 3; row++) {
        const entry = dot(leftX + (col - 2.5) * cw * .145, bottom + ch * (.2 + row * .135));
        (row === 0 ? red : row === 1 ? green : dark).push(entry);
      }
    }
    for (const x of [-.23, .06]) gauges.push({ position: [leftX + x * cw, bottom + ch * .65, front + .055], rotation: [PI / 2, 0, 0] });
    numbers.push([[leftX + cw * .33, bottom + ch * .65, front + .05], [cw * .2, ch * .085, .025]]);
    keys.push(dot(leftX, bottom + ch * .085));
    // Separate glazed cream cabinet: two top meters and dense button groups.
    for (const sign of [-1, 1]) gauges.push({ position: [rightX + sign * cw * .22, bottom + ch * .8, front + .055], rotation: [PI / 2, 0, 0] });
    for (let row = 0; row < 5; row++) for (let col = 0; col < 4; col++) {
      const entry = dot(rightX + (col - 1.5) * cw * .18, bottom + ch * (.19 + row * .105));
      (col === 3 ? red : row % 2 ? green : dark).push(entry);
    }
    instances(s, details, new THREE.CylinderGeometry(.023, .023, .025, 10), m.green, green, 'packaging-f750-six-pilot-lamps-and-green-buttons');
    instances(s, details, new THREE.CylinderGeometry(.023, .023, .025, 10), m.red, red, 'packaging-dual-control-red-pilot-lamps-and-buttons');
    instances(s, details, new THREE.CylinderGeometry(.026, .026, .035, 10), m.dark, dark, 'packaging-dual-control-selector-knobs');
    instances(s, details, new THREE.CylinderGeometry(.028, .028, .035, 10), m.black, keys, 'packaging-f750-bottom-key-switch');
    instances(s, details, new THREE.CylinderGeometry(cw * .105, cw * .105, .035, 24), m.white, gauges, 'packaging-dual-control-analog-meter-faces');
    boxes(s, details, m.display, numbers, 'packaging-f750-counter-readout');
    boxes(s, details, m.dark, gauges.map(({ position: [x, y, z] }) => [[x, y + cw * .02, z + .025], [.012, cw * .09, .01], [0, 0, -.5]]), 'packaging-control-analog-meter-needles');
    const fw = cw * .95, fh = ch * .96;
    boxes(s, details, m.black, [
      [[rightX - fw / 2, bottom + ch / 2, front + .1], [.035, fh, .035]], [[rightX + fw / 2, bottom + ch / 2, front + .1], [.035, fh, .035]],
      [[rightX, bottom + (ch - fh) / 2, front + .1], [fw, .035, .035]], [[rightX, bottom + (ch + fh) / 2, front + .1], [fw, .035, .035]],
      [[leftX - cw * .38, bottom + ch * .52, front + .075], [.035, ch * .18, .04]], [[rightX + cw * .36, bottom + ch * .5, front + .13], [.035, ch * .15, .045]],
    ], 'packaging-glazed-control-black-door-frame-and-handles');
    s._box(details, [fw - .04, fh - .04, .012], [rightX, bottom + ch / 2, front + .1], m.glass).name = 'packaging-second-control-transparent-door';
    s._cyl(details, .045, .08, [rightX, bottom + ch + .04, 0], m.black, .045, 12);
    s._cyl(details, .06, .09, [rightX, bottom + ch + .125, 0], m.red, .06, 16).name = 'packaging-second-control-red-beacon';
    return;
  }
  s._box(body, [w, cabinetH, d], [0, bottom + cabinetH / 2, 0], m.white);
  boxes(s, process, m.trim, [
    [[0, bottom + cabinetH / 2, front], [w * .92, cabinetH * .93, .025]],
    [[w * .4, bottom + cabinetH * .5, front + .025], [.045, cabinetH * .15, .035]],
  ], 'packaging-control-door-and-handle');
  const rows = item.variant === 'mixer' || item.platformHeight > 0 ? 6 : 3, buttons = [];
  for (let row = 0; row < rows; row++) for (const col of [-1, 0, 1]) buttons.push({ position: [col * w * .24, bottom + cabinetH * (.2 + row * .105), front + .05], rotation: [PI / 2, 0, 0] });
  instances(s, details, new THREE.CylinderGeometry(.025, .025, .025, 8), m.green, buttons.filter((_, index) => index % 3 !== 2), 'packaging-control-green-pushbuttons');
  instances(s, details, new THREE.CylinderGeometry(.025, .025, .025, 8), m.red, buttons.filter((_, index) => index % 3 === 2), 'packaging-control-red-indicators');
  s._box(details, [w * .44, cabinetH * .12, .025], [0, bottom + cabinetH * .83, front + .04], m.display).name = 'packaging-control-dark-readout';
}

function verticalProcess(s, root, item) {
  const m = palette(s), [body, process, details] = parts(s, root, item), { width: w, depth: d, height: h } = item;
  const deck = item.platformHeight ?? 2.4, r = Math.min(w, d) * .355, cylinderBottom = deck + .85, cylinderTop = h - .16;
  const legs = [];
  for (const x of [-w * .43, w * .43]) for (const z of [-d * .42, d * .42]) legs.push([[x, deck / 2, z], [.075, deck, .075]]);
  boxes(s, body, m.cream, legs, 'packaging-vertical-process-fixed-support-frame');
  s._cyl(body, r, cylinderTop - cylinderBottom, [0, (cylinderTop + cylinderBottom) / 2, 0], m.steel, r, 32).name = 'packaging-vertical-process-upper-cylinder';
  s._cyl(process, r * .97, cylinderBottom - 1.6, [0, (cylinderBottom + 1.6) / 2, 0], m.steel, .14, 32).name = 'packaging-vertical-process-large-lower-cone';
  s._cyl(process, .22, .21, [0, 1.49, 0], m.black, .22, 20).name = 'packaging-vertical-process-black-red-discharge-valve';
  s._box(details, [.16, .12, .12], [.24, 1.49, 0], m.red);
  // 989/995: a suspended distributor has an elongated rectangular lid,
  // red toggle clamps and an angular side chute, unlike the small round unit.
  s._cyl(process, .46, .31, [0, 1.16, 0], m.steel, .27, 24);
  s._box(process, [w * .73, .075, d * .39], [0, 1.35, 0], m.steel).name = 'packaging-suspended-distributor-rectangular-lid';
  const clamps = [], hangers = [];
  for (const x of [-w * .3, 0, w * .3]) for (const z of [-d * .205, d * .205]) clamps.push([[x, 1.28, z], [.065, .19, .045]]);
  for (const x of [-w * .3, w * .3]) hangers.push([[x, 1.39, 0], [x, deck + .31, 0], .018]);
  boxes(s, details, m.red, clamps, 'packaging-suspended-distributor-red-toggle-clamps');
  bars(s, details, m.trim, hangers, 'packaging-distributor-eyebolt-spring-hangers');
  instances(s, details, new THREE.TorusGeometry(.045, .012, 5, 12), m.trim,
    [-w * .3, w * .3].flatMap((x) => [0, .04, .08, .12].map((dy) => ({ position: [x, deck + .09 + dy, 0], rotation: [PI / 2, 0, 0] }))), 'packaging-distributor-hanger-springs');
  const chute = s._box(process, [.28, .3, .57], [0, .95, d * .3], m.steel); chute.rotation.x = -.35; chute.name = 'packaging-distributor-angular-side-chute';
  // A low fixed receiving hopper is part of this assembly, not a new machine.
  s._mesh(pyramid(w * .47, d * .34, w * .34, d * .27, .38), m.steel, body, [0, .09, d * .29]).name = 'packaging-vertical-process-low-receiver';
  s._box(process, [w * .49, .06, d * .36], [0, .51, d * .29], m.steel);
  instances(s, details, new THREE.CylinderGeometry(.035, .035, .06, 10), m.blue, [-.16, .16].map((x) => ({ position: [x, .57, d * .29] })), 'packaging-receiver-blue-top-caps');
  // 917/1035: two local maintenance treads beside the process equipment.
  const stairX = w * .35, stairZ = -d * .24;
  boxes(s, body, m.deck, [
    [[stairX, deck + .13, stairZ + .2], [w * .22, .08, .35]], [[stairX, deck + .37, stairZ - .15], [w * .22, .08, .35]],
  ], 'packaging-vertical-process-two-maintenance-treads');
  boxes(s, details, m.yellow, [
    [[stairX, deck + .175, stairZ + .36], [w * .22, .012, .035]], [[stairX, deck + .415, stairZ + .01], [w * .22, .012, .035]],
  ], 'packaging-maintenance-step-yellow-nosings', false);
  const gauge = s._cyl(details, .22, .055, [0, cylinderBottom + .6, r + .035], m.white, .22, 24); gauge.rotation.x = PI / 2; gauge.name = 'packaging-vertical-process-large-white-circular-inspection-port';
  s._box(details, [.34, .44, .035], [0, cylinderTop - .4, r + .03], m.trim).name = 'packaging-vertical-process-upper-bolted-access-door';
  const bolts = [];
  for (const x of [-.14, .14]) for (const y of [cylinderTop - .58, cylinderTop - .22]) bolts.push({ position: [x, y, r + .07], rotation: [PI / 2, 0, 0] });
  instances(s, details, new THREE.CylinderGeometry(.02, .02, .03, 6), m.dark, bolts, 'packaging-vertical-process-access-door-bolts');
  s._cyl(details, .12, h - 1.1, [w * .43, (h + 1.1) / 2, -d * .2], m.trim, .12, 20).name = 'packaging-vertical-process-side-round-duct';
  instances(s, details, new THREE.TorusGeometry(.122, .012, 5, 16), m.steel,
    Array.from({ length: 11 }, (_, index) => ({ position: [w * .43, 1.3 + index * (h - 1.5) / 11, -d * .2], rotation: [PI / 2, 0, 0] })), 'packaging-vertical-duct-repeated-seams');
}

function scale(s, root, item) {
  const m = palette(s), [body, process, details] = parts(s, root, item), { width: w, depth: d, height: h } = item;
  s._box(body, [w, .14, d], [0, .1, 0], m.trim);
  s._box(process, [w * .94, .045, d * .94], [0, .19, 0], m.steel);
  if (h > .6) {
    s._box(details, [.045, h * .73, .045], [0, h * .37, -d * .4], m.trim);
    s._box(details, [w * .5, h * .16, .08], [0, h * .83, -d * .4], m.white);
    s._box(details, [w * .36, h * .09, .025], [0, h * .83, -d * .4 + .05], m.display);
  }
}

function cipReference(s, root, item) {
  const m = palette(s), [body, process, details] = parts(s, root, item), { width: w, depth: d } = item;
  const patch = s._box(body, [w, .016, d], [0, .05, 0], m.concrete); patch.name = 'packaging-cip-plan-reference-patch'; patch.castShadow = false;
  boxes(s, process, m.blue, [
    [[0, .066, -d / 2], [w, .012, .025]], [[0, .066, d / 2], [w, .012, .025]],
    [[-w / 2, .066, 0], [.025, .012, d]], [[w / 2, .066, 0], [.025, .012, d]],
  ], 'packaging-cip-reference-area-outline', false);
  boxes(s, details, m.white, [-1, 1].flatMap((x) => [-1, 1].map((z) => [[x * w * .41, .075, z * d * .37], [w * .12, .01, .025]])), 'packaging-cip-unverified-reference-corner-marks', false);
}

function platform(s, parent, data, name, main = false) {
  const m = palette(s), { minX, maxX, height: y } = data, ends = data.stairEnds || [];
  const run = data.stairLength || 1.2, minZ = data.minZ + (ends.includes('minZ') ? run : 0), maxZ = data.maxZ - (ends.includes('maxZ') ? run : 0);
  const width = maxX - minX, length = maxZ - minZ, walkWidth = main ? Math.min(2.75, width * .49) : width;
  const walkMinX = maxX - walkWidth, walkX = (walkMinX + maxX) / 2, middleZ = (minZ + maxZ) / 2;
  const group = s._group(parent); group.name = name;
  const surface = s._box(group, [walkWidth, .12, length], [walkX, y - .06, middleZ], m.deck);
  surface.name = `${name}-checker-catwalk`; surface.castShadow = false;
  const frame = [], handrails = [], posts = [];
  for (const x of [minX + .1, maxX - .1]) {
    frame.push([[x, y - .17, middleZ], [.14, .3, length]]);
    for (let z = minZ + .15; z <= maxZ; z += 3.7) {
      posts.push([[x, y / 2, z], [.14, y, .16]]);
      handrails.push([[x, y, z], [x, y + 1.08, z]]);
    }
    for (const h of [.52, 1.08]) handrails.push([[x, y + h, minZ], [x, y + h, maxZ]]);
  }
  for (let z = minZ; z <= maxZ + .01; z += length / Math.max(1, Math.round(length / 4.2))) {
    frame.push([[(minX + maxX) / 2, y - .18, z], [width, .28, .16]]);
    if (main) frame.push([[(minX + walkMinX) / 2, y - .055, z], [walkMinX - minX, .11, .3]]);
  }
  boxes(s, group, m.cream, frame, `${name}-cream-support-beams`);
  boxes(s, group, m.cream, posts, `${name}-ground-support-posts`);
  bars(s, group, m.trim, handrails, `${name}-safety-rails`);
  for (const end of ends) {
    const back = end === 'minZ', startZ = back ? data.minZ : maxZ, stepCount = 10;
    const stair = s._group(group); stair.name = `${name}-${end}-access-stair`;
    // The plan's 1.2 m strip is the stair width along Z. The actual flight
    // runs across X, matching the open treads in 465 and 724/1050.
    const steps = [], nosings = [], stairWidth = Math.max(.85, run - .1), flightRun = Math.min(3, width - .3);
    const topX = maxX - .15, bottomX = topX - flightRun, z = startZ + run / 2;
    for (let index = 0; index < stepCount; index++) {
      const x = bottomX + (index + .5) * flightRun / stepCount, rise = (index + 1) * y / stepCount;
      steps.push([[x, rise - .055, z], [flightRun / stepCount + .025, .11, stairWidth]]);
      nosings.push([[x - flightRun / stepCount * .4, rise + .005, z], [.035, .012, stairWidth]]);
    }
    boxes(s, stair, m.deck, steps, `${name}-stair-treads`);
    boxes(s, stair, m.yellow, nosings, `${name}-yellow-stair-nosings`, false);
    const handrails = [], stringers = [], uprights = [];
    for (const side of [-1, 1]) {
      const railZ = z + side * stairWidth / 2;
      stringers.push([[bottomX, .08, railZ], [topX, y - .09, railZ], .07]);
      for (const height of [.5, 1.02]) handrails.push([[bottomX, height, railZ], [topX, y + height, railZ]]);
      for (const fraction of [0, .5, 1]) {
        const x = bottomX + flightRun * fraction, base = y * fraction;
        uprights.push([[x, base, railZ], [x, base + 1.02, railZ]]);
      }
    }
    bars(s, stair, m.cream, stringers, `${name}-cream-stair-stringers`);
    bars(s, stair, m.trim, handrails.concat(uprights), `${name}-stair-handrails`);
    // The top tread opens into a full-width end landing, not a sealed rail.
    s._box(stair, [.15, .12, run], [maxX - .075, y - .06, z], m.deck).name = `${name}-stair-top-landing`;
    if (main) {
      const bollardX = bottomX - .1, bollardZ = z + (back ? -1 : 1) * (run / 2 - .12);
      s._cyl(stair, .09, .62, [bollardX, .31, bollardZ], m.yellow, .09, 12).name = `${name}-stair-foot-protection-bollard`;
      instances(s, stair, new THREE.CylinderGeometry(.094, .094, .11, 12), m.black,
        [.13, .36, .59].map((height) => ({ position: [bollardX, height, bollardZ] })), `${name}-stair-bollard-black-bands`);
    }
    stair.userData.flightDirection = 'x'; stair.userData.treadCount = stepCount;
    stair.userData.countConfidence = 'visible partial flight; count and rise approximate';
  }
  group.userData.platformHeight = y;
}

function door(s, parent, data) {
  const m = palette(s), group = s._group(parent, [data.x, 0, data.z]); group.rotation.y = data.rotation || 0;
  group.name = `packaging-door-${data.id}`;
  boxes(s, group, m.trim, [
    [[-data.width / 2, 1.12, 0], [.075, 2.24, .12]], [[data.width / 2, 1.12, 0], [.075, 2.24, .12]], [[0, 2.24, 0], [data.width + .1, .09, .12]],
  ], 'packaging-door-frames');
  const leaf = s._group(group, [-data.width / 2, 0, 0]); leaf.rotation.y = PI / 2;
  if (data.id === 'entry-door') {
    const lw = data.width - .06;
    boxes(s, leaf, m.blue, [
      [[.03, 1.07, 0], [.06, 2.14, .06]], [[lw - .03, 1.07, 0], [.06, 2.14, .06]],
      [[lw / 2, .04, 0], [lw, .08, .06]], [[lw / 2, 2.1, 0], [lw, .08, .06]], [[lw / 2, .74, 0], [lw, .055, .06]],
    ], 'packaging-entry-blue-glazed-door-leaf-frame');
    s._box(leaf, [lw - .12, 1.98, .025], [lw / 2, 1.07, 0], m.glass).name = 'packaging-entry-large-transparent-door-glazing';
    s._box(leaf, [.045, .24, .06], [lw - .14, 1.05, .055], m.trim); return;
  }
  s._box(leaf, [data.width - .06, 2.14, .045], [(data.width - .06) / 2, 1.07, 0], m.white);
  s._box(leaf, [data.width * .5, .45, .055], [data.width * .45, 1.5, .005], m.display);
  s._box(leaf, [.06, .14, .06], [data.width - .16, 1.04, .05], m.trim);
}

function entrySwitchbackStair(s, structure, data) {
  const m = palette(s), group = s._group(structure); group.name = 'packaging-front-stair-switchback';
  const stone = s._material(0xc7c4b2, .92, .02), nosing = s._material(0x944664, .82, .05);
  const glass = s._material(0xc5dbda, .66, .08, { transparent: true, opacity: .4 });
  const left = data.minX + 1.05, right = data.maxX - 1.05, run = right - left;
  const lanes = [data.maxZ - .8, data.minZ + .75], width = 1.18, flightRise = data.rise / data.flights;
  const landings = [], edging = [], rails = [], posts = [];
  for (let flight = 0; flight < data.flights; flight++) {
    const ascending = flight % 2 === 0, z = lanes[flight % 2], baseY = -data.rise + flight * flightRise;
    const treads = [], strips = [], stringers = [];
    for (let step = 0; step < data.stepsPerFlight; step++) {
      const t = (step + .5) / data.stepsPerFlight, x = ascending ? left + t * run : right - t * run;
      const y = baseY + (step + 1) * flightRise / data.stepsPerFlight;
      treads.push([[x, y - .075, z], [run / data.stepsPerFlight + .015, .15, width]]);
      strips.push([[x + (ascending ? -1 : 1) * run / data.stepsPerFlight * .42, y + .005, z], [.035, .012, width]]);
    }
    boxes(s, group, stone, treads, `packaging-entry-flight-${flight + 1}-stone-treads`);
    boxes(s, group, nosing, strips, `packaging-entry-flight-${flight + 1}-maroon-nosings`, false);
    for (const side of [-1, 1]) {
      const railZ = z + side * width / 2, x0 = ascending ? left : right, x1 = ascending ? right : left;
      for (const height of [.5, 1.02]) rails.push([[x0, baseY + height, railZ], [x1, baseY + flightRise + height, railZ]]);
      stringers.push([[x0, baseY - .12, railZ], [x1, baseY + flightRise - .12, railZ]]);
      for (const t of [0, .5, 1]) posts.push([[x0 + (x1 - x0) * t, baseY + flightRise * t + .5, railZ], [.045, 1, .045]]);
    }
    bars(s, group, m.dark, stringers, `packaging-entry-flight-${flight + 1}-black-side-trim`, .055);
  }
  for (let landing = 0; landing <= data.flights; landing++) {
    const atLeft = landing % 2 === 0, y = -data.rise + landing * flightRise;
    const x = atLeft ? data.minX + .525 : data.maxX - .525;
    landings.push([[x, y - .09, (data.minZ + data.maxZ) / 2], [1.05, .18, data.maxZ - data.minZ]]);
    edging.push([[atLeft ? left : right, y + .005, (data.minZ + data.maxZ) / 2], [.035, .012, data.maxZ - data.minZ]]);
    // The last landing opens directly toward the 3F entrance instead of a rail across the doorway.
    if (landing !== data.flights) for (const height of [.5, 1.02]) rails.push([[atLeft ? data.minX + .06 : data.maxX - .06, y + height, data.minZ + .06], [atLeft ? data.minX + .06 : data.maxX - .06, y + height, data.maxZ - .06]]);
  }
  boxes(s, group, stone, landings, 'packaging-entry-turning-landings');
  boxes(s, group, nosing, edging, 'packaging-entry-landing-edge-strips', false);
  boxes(s, group, m.white, posts, 'packaging-entry-white-rail-posts');
  bars(s, group, m.white, rails, 'packaging-entry-white-double-handrails', .029);
  const windows = [], frames = [];
  for (const y of [-4.5, -1.5]) for (let pane = 0; pane < 3; pane++) {
    const x = data.minX + .8 + pane * 1.35;
    windows.push([[x, y, data.maxZ - .025], [1.23, 2.5, .035]]);
    frames.push([[x - .65, y, data.maxZ - .01], [.055, 2.7, .065]]);
    for (const dy of [-1.3, 0, 1.3]) frames.push([[x, y + dy, data.maxZ - .01], [1.35, .055, .065]]);
  }
  boxes(s, group, glass, windows, 'packaging-entry-large-stairwell-windows', false);
  boxes(s, group, m.white, frames, 'packaging-entry-window-frames');
  group.userData.flights = data.flights; group.userData.confidence = data.confidence;
}

function buildingStair(s, deck, structure, data) {
  if (data.id === 'front-stair' && data.flights) return entrySwitchbackStair(s, structure, data);
  const m = palette(s), w = data.maxX - data.minX, d = data.maxZ - data.minZ, x = (data.minX + data.maxX) / 2, z = (data.minZ + data.maxZ) / 2;
  const group = s._group(structure); group.name = `packaging-${data.id}-stairwell`;
  const landingD = Math.min(.85, d * .28);
  s._box(deck, [w, .18, landingD], [x, -.11, data.minZ + landingD / 2], m.concrete).name = 'packaging-stairwell-top-landing';
  const steps = [];
  for (let index = 0; index < data.steps; index++) {
    const ratio = (index + .5) / data.steps, height = -data.rise * (1 - ratio);
    if (data.direction === 'x') steps.push([[data.minX + ratio * w, height, z + landingD / 2], [w / data.steps + .02, .1, d - landingD]]);
    else steps.push([[x, height, data.maxZ - ratio * (d - landingD)], [w * .63, .1, (d - landingD) / data.steps + .02]]);
  }
  boxes(s, group, m.concrete, steps, 'packaging-building-stair-treads');
  bars(s, group, m.white, [
    [[data.minX + .1, .95, data.minZ], [data.minX + .1, .95, data.maxZ]],
    [[data.maxX - .1, .95, data.minZ], [data.maxX - .1, .95, data.maxZ]],
  ], 'packaging-stairwell-top-safety-rails');
}

function lift(s, deck, structure, data) {
  const m = palette(s), w = data.maxX - data.minX, d = data.maxZ - data.minZ, x = (data.minX + data.maxX) / 2, z = (data.minZ + data.maxZ) / 2;
  const group = s._group(structure); group.name = 'packaging-three-ton-cargo-lift';
  s._box(deck, [w, .22, d], [x, -.14, z], m.concrete);
  boxes(s, group, m.white, [
    [[data.minX + .08, 1.4, z], [.16, 2.8, d]], [[data.maxX - .08, 1.4, z], [.16, 2.8, d]],
    [[x, 1.4, data.maxZ - .08], [w, 2.8, .16]],
  ], 'packaging-lift-cutaway-shaft-walls');
  const dw = Math.min(2.4, w * .62);
  boxes(s, group, m.trim, [-1, 1].map((side) => [[x + side * dw / 4, 1.18, data.minZ + .08], [dw / 2 - .025, 2.36, .08]]), 'packaging-lift-paired-metal-doors');
  boxes(s, group, m.dark, [[[x, 2.5, data.minZ + .11], [1.25, .2, .04]]], 'packaging-lift-capacity-sign-backing');
  group.userData.capacity = data.capacity;
}

function architecture(s, groups, layout) {
  const m = palette(s), { deck, structure, ducts, ceiling } = groups, b = layout.mainBounds, h = layout.ceilingHeight || 6.2;
  const w = b.maxX - b.minX, d = b.maxZ - b.minZ, centerX = (b.minX + b.maxX) / 2, centerZ = (b.minZ + b.maxZ) / 2;
  boxes(s, structure, m.white, [
    [[centerX, 1.4, b.minZ + .05], [w, 2.8, .1]],
    [[b.minX + .04, .48, centerZ], [.08, .96, d]], [[b.maxX - .04, .48, centerZ], [.08, .96, d]],
    [[centerX, .2, b.maxZ - .04], [w, .4, .08]],
  ], 'packaging-cutaway-perimeter-walls');
  // Upper enclosure is present from the walking viewpoint and cut away with
  // the ceiling context when inspecting the equipment from above.
  const upperPanels = [
    [[b.minX + .04, (h + 2.18) / 2, centerZ], [.08, h - 2.18, d]],
    [[b.maxX - .04, (h + 2.18) / 2, centerZ], [.08, h - 2.18, d]],
    [[centerX, (h + 2.8) / 2, b.minZ + .05], [w, h - 2.8, .1]],
    [[centerX, (h + 2.8) / 2, b.maxZ - .04], [w, h - 2.8, .08]],
  ];
  for (const [left, right] of [[b.minX, -4.7], [-3.3, .7], [3.1, b.maxX]]) {
    upperPanels.push([[(left + right) / 2, 1.6, b.maxZ - .04], [right - left, 2.4, .08]]);
  }
  boxes(s, ceiling, m.white, upperPanels, 'packaging-walking-view-upper-enclosure');
  const windows = [], mullions = [], cols = [];
  for (const x of [b.minX + .06, b.maxX - .06]) {
    for (let z = b.minZ + .6; z < b.maxZ - .5; z += 1.22) windows.push([[x, 1.57, z], [.04, 1.08, 1.12]]);
    for (let z = b.minZ + .05; z <= b.maxZ; z += 1.22) mullions.push([[x, 1.57, z], [.08, 1.19, .055]]);
    for (const y of [1.01, 1.57, 2.13]) mullions.push([[x, y, centerZ], [.09, .055, d]]);
  }
  boxes(s, structure, m.window, windows, 'packaging-yellow-lower-window-band', false);
  boxes(s, structure, m.trim, mullions, 'packaging-window-repeated-mullions');
  layout.columns.forEach((column) => {
    cols.push([[column.x, column.height / 2, column.z], [column.width, column.height, column.depth]]);
    cols.push([[column.x, .08, column.z], [column.width + .16, .16, column.depth + .16]]);
  });
  boxes(s, structure, m.white, cols, 'packaging-drawing-grid-columns');
  const beams = [], lights = [];
  for (let z = b.minZ + .3; z <= b.maxZ; z += 5) beams.push([[centerX, h - .12, z], [w - .4, .23, .15]]);
  for (let x = b.minX + .3; x < b.maxX; x += 5.125) beams.push([[x, h - .32, centerZ], [.13, .14, d - .6]]);
  for (const x of [-5, 5]) for (const z of [-9, -3, 3, 9]) lights.push([[x, h - .52, z], [1.15, .075, .22]]);
  boxes(s, ceiling, m.cream, beams, 'packaging-overhead-structural-beams');
  boxes(s, ceiling, m.light, lights, 'packaging-overhead-strip-lights', false);
  const floors = [];
  layout.rooms.forEach((room) => floors.push([[(room.minX + room.maxX) / 2, .025, (room.minZ + room.maxZ) / 2], [room.maxX - room.minX, .025, room.maxZ - room.minZ]]));
  boxes(s, deck, m.concrete, floors, 'packaging-back-room-floor-insets', false);
  const walls = [];
  layout.partitions.forEach((part) => {
    const dx = part.to[0] - part.from[0], dz = part.to[1] - part.from[1], cutawayHeight = Math.min(1.18, part.height);
    walls.push([[(part.from[0] + part.to[0]) / 2, cutawayHeight / 2, (part.from[1] + part.to[1]) / 2], [Math.hypot(dx, dz), cutawayHeight, part.thickness], [0, Math.atan2(-dz, dx), 0]]);
  });
  boxes(s, structure, m.white, walls, 'packaging-drawing-room-cutaway-partitions');
  layout.doors.forEach((entry) => door(s, structure, entry));
  layout.stairs.forEach((entry) => buildingStair(s, deck, structure, entry));
  lift(s, deck, structure, layout.lift);
  platform(s, structure, layout.mainPlatform, 'packaging-main-platform', true);
  platform(s, structure, layout.auxPlatform, 'packaging-aux-platform');
  const floorLines = [
    [[-5.9, .025, 1.5], [.055, .012, 24]], [[-13.75, .025, .5], [.055, .012, 20]],
    [[-9.8, .025, 10.5], [8.2, .012, .055]],
  ];
  boxes(s, deck, m.yellow, floorLines, 'packaging-clear-aisle-floor-lines', false);
  const drain = [], grates = [];
  for (const [a, end] of [[[-15, .035, -.9], [-13.65, .035, -.9]], [[-13.65, .035, -.9], [-13.65, .035, 5.1]]]) {
    const dx = end[0] - a[0], dz = end[2] - a[2], length = Math.hypot(dx, dz), middle = [(a[0] + end[0]) / 2, .024, (a[2] + end[2]) / 2];
    drain.push([middle, [length, .035, .14], [0, Math.atan2(-dz, dx), 0]]);
    const count = Math.ceil(length / .12);
    for (let index = 0; index <= count; index++) grates.push([[a[0] + dx * index / count, .045, a[2] + dz * index / count], [.025, .012, .18], [0, Math.atan2(-dz, dx), 0]]);
  }
  boxes(s, deck, m.dark, drain, 'packaging-wash-area-recessed-floor-drain', false);
  boxes(s, deck, m.trim, grates, 'packaging-wash-area-drain-grates', false);
  bars(s, ducts, m.trim, [
    [[b.minX + .65, h - .7, -13], [b.minX + .65, h - .7, 13]],
    [[b.minX + 1.25, h - .84, -13], [b.minX + 1.25, h - .84, 13]],
  ], 'packaging-parallel-round-overhead-services', .13);
  const cableTrays = [];
  for (const z of [-10, -5, 0, 5, 10]) for (const y of [h - .9, h - .72]) cableTrays.push([[centerX, y, z], [w - 1, .035, .25]]);
  boxes(s, ceiling, m.trim, cableTrays, 'packaging-overhead-cable-trays');
}

export function buildPackagingEnvironment(s, room = PACKAGING_ROOM) {
  return buildPackagingEnvironmentV2(s, room);
}

function buildLegacyPackagingEnvironment(s) {
  const m = palette(s), groups = {};
  for (const key of ['deck', 'structure', 'ducts']) groups[key] = s._group(s.scene);
  groups.ceiling = s._group(groups.structure); groups.ceiling.name = 'packaging-overhead-context';
  groups.deck.name = 'packaging-third-floor'; groups.structure.name = 'packaging-third-floor-structure'; groups.ducts.name = 'packaging-third-floor-services';
  const b = PACKAGING_ROOM.mainBounds || PACKAGING_ROOM.layout.mainBounds;
  s._box(groups.deck, [b.maxX - b.minX, .22, b.maxZ - b.minZ], [(b.minX + b.maxX) / 2, -.14, (b.minZ + b.maxZ) / 2], m.concrete);
  s._box(groups.deck, [b.maxX - b.minX - .12, .045, b.maxZ - b.minZ - .12], [(b.minX + b.maxX) / 2, -.012, (b.minZ + b.maxZ) / 2], m.floor);
  architecture(s, groups, PACKAGING_ROOM.layout);
  groups.deck.traverse((mesh) => { if (mesh.isMesh) mesh.castShadow = false; });
  return groups;
}

export function buildPackagingEquipment(s, root, item) {
  if (buildPackagingEquipmentV2(s, root, item) || buildPackagingLineEquipment(s, root, item)) return true;
  const builder = {
    'packaging-mixer': mixer, 'packaging-aux-mixer': mixer, 'packaging-sieve': sieve,
    'packaging-air-unit': airUnit, 'packaging-sink': sink, 'packaging-vessel': vessel,
    'packaging-control': control, 'packaging-cip': cipReference, 'packaging-scale': scale,
    'packaging-vertical-process': verticalProcess,
    'packaging-hygiene-station': hygieneStation,
    'packaging-weigh-services': weighServices,
  }[item.type];
  if (!builder) return false;
  builder(s, root, item); return true;
}

function hygieneStation(s, root, item) {
  // 167/174: the entry station has a long stainless trough, three wall heads,
  // a mirror, lower service doors and a separate yellow-faced hand dispenser.
  const m = palette(s), [body, process, details] = parts(s, root, item);
  const w = item.width, d = item.depth, counterW = w * .76, centerX = w * .105;
  const back = -d * .38, front = d * .33, top = .98;
  s._box(body, [counterW, .78, d * .64], [centerX, .49, -.025], m.steel).name = 'packaging-entry-hygiene-lower-cabinet';
  boxes(s, body, m.trim, [-1, 1].flatMap((x) => [-1, 1].map((z) => [
    [centerX + x * counterW * .43, .055, z * d * .27], [.065, .11, .065],
  ])), 'packaging-entry-hygiene-adjustable-feet');
  boxes(s, process, m.steel, [
    [[centerX, top - .11, -.015], [counterW, .045, d * .72]],
    [[centerX, top - .04, front], [counterW, .18, .035]],
    [[centerX, top - .04, back], [counterW, .18, .035]],
    [[centerX - counterW / 2, top - .04, -.025], [.035, .18, d * .72]],
    [[centerX + counterW / 2, top - .04, -.025], [.035, .18, d * .72]],
  ], 'packaging-entry-hygiene-open-long-trough');
  s._box(process, [counterW - .08, .015, d * .55], [centerX, top - .08, -.015], m.dark).name = 'packaging-entry-hygiene-recessed-basin';
  s._box(body, [counterW + .04, 1.12, .04], [centerX, 1.57, back - .025], m.trim).name = 'packaging-entry-hygiene-mirror-backing';
  s._box(details, [counterW - .08, .94, .012], [centerX, 1.59, back + .005], m.glass).name = 'packaging-entry-hygiene-mirror-face';
  const doors = [], handles = [], headLights = [], faucets = [];
  for (let index = 0; index < 3; index++) {
    const x = centerX + (index - 1) * counterW / 3;
    doors.push([[x, .49, front + .005], [counterW / 3 - .025, .67, .025]]);
    handles.push([[x + counterW / 6 - .07, .54, front + .035], [.025, .17, .035]]);
    s._mesh(pyramid(.19, .15, .25, .2, .23), m.steel, process, [x, 1.15, back + .115]).name = 'packaging-entry-hygiene-wall-dispensing-head';
    headLights.push([[x, 1.22, back + .225], [.035, .065, .012]]);
    faucets.push([[x, 1.13, back + .16], [x, 1.025, -.05], .018]);
    s._cyl(details, .025, .018, [x, top - .063, .035], m.trim, .025, 12).name = 'packaging-entry-hygiene-basin-drain';
  }
  boxes(s, details, m.steel, doors, 'packaging-entry-hygiene-three-service-doors');
  boxes(s, details, m.dark, handles, 'packaging-entry-hygiene-door-handles');
  boxes(s, details, m.green, headLights, 'packaging-entry-hygiene-three-green-indicators', false);
  bars(s, details, m.trim, faucets, 'packaging-entry-hygiene-three-short-tap-necks');
  const dispenserX = -w * .43;
  s._box(body, [.25, 1.55, .12], [dispenserX, 1.03, back], m.steel).name = 'packaging-entry-hygiene-side-dispenser-column';
  s._box(process, [.28, .36, .2], [dispenserX, 1.14, back + .15], m.steel).name = 'packaging-entry-yellow-faced-hand-dispenser';
  s._box(details, [.245, .255, .015], [dispenserX, 1.185, back + .258], m.yellow).name = 'packaging-entry-hand-dispenser-yellow-panel';
  s._box(process, [.23, .12, .18], [dispenserX, .88, back + .15], m.dark).name = 'packaging-entry-hand-dispenser-open-hand-recess';
  s._box(details, [.16, .22, .095], [dispenserX, 1.68, back + .075], m.white).name = 'packaging-entry-wall-mounted-white-dispenser';
}

function weighServices(s, root, item) {
  // 745/760: the metal flexible extraction neck and blue-front PC cabinet
  // belong to the same low-ceiling service corner; the CAS scale stays separate.
  const m = palette(s), [body, process, details] = parts(s, root, item);
  const pcX = item.width * .18, pcW = item.width * .51, pcD = item.depth * .55;
  const front = item.depth * .3, hoodX = -item.width * .34, hoodZ = -item.depth * .19;
  s._box(body, [pcW, 1.73, pcD], [pcX, .905, .015], m.white).name = 'packaging-weigh-pc-white-cabinet';
  s._box(body, [pcW + .035, .065, pcD + .025], [pcX, 1.8, .015], m.white).name = 'packaging-weigh-pc-top-cap';
  boxes(s, body, m.trim, [-1, 1].map((side) => [[pcX + side * pcW * .39, .04, .015], [.07, .08, pcD * .82]]), 'packaging-weigh-pc-cabinet-feet');
  s._box(process, [pcW - .06, .7, .025], [pcX, 1.36, front], m.blue).name = 'packaging-weigh-pc-blue-monitor-bezel';
  s._box(process, [pcW - .19, .46, .018], [pcX, 1.35, front + .02], m.dark).name = 'packaging-weigh-pc-glazed-monitor-window';
  s._box(details, [pcW * .52, .32, .015], [pcX + pcW * .1, 1.36, front + .034], m.display).name = 'packaging-weigh-pc-monitor-screen';
  const screenLines = [];
  for (let index = 0; index < 4; index++) screenLines.push([[pcX + pcW * .1, 1.46 - index * .05, front + .044], [pcW * .4, .008, .006]]);
  boxes(s, details, m.trim, screenLines, 'packaging-weigh-pc-screen-row-hints', false);
  s._box(process, [pcW + .035, .055, item.depth * .23], [pcX, .965, front + item.depth * .055], m.white).name = 'packaging-weigh-pc-projecting-keyboard-shelf';
  s._box(details, [pcW * .64, .025, item.depth * .12], [pcX - pcW * .06, 1.006, front + item.depth * .045], m.trim).name = 'packaging-weigh-pc-keyboard';
  s._box(details, [.065, .026, .1], [pcX + pcW * .37, 1.007, front + .04], m.dark).name = 'packaging-weigh-pc-mouse';
  boxes(s, process, m.blue, [-1, 1].map((side) => [[pcX + side * pcW * .235, .47, front], [pcW * .46, .77, .035]]), 'packaging-weigh-pc-paired-blue-lower-doors');
  boxes(s, details, m.trim, [-1, 1].map((side) => [[pcX + side * .055, .6, front + .04], [.022, .15, .025]]), 'packaging-weigh-pc-lower-door-handles');
  s._box(details, [.08, .04, .02], [pcX - pcW * .32, 1.64, front + .025], m.green).name = 'packaging-weigh-pc-small-status-switch';
  const hoodBottom = 1.03, hoodTop = 1.36, tubeTop = Math.min(item.height - .02, 2.78);
  s._cyl(process, .105, hoodTop - hoodBottom, [hoodX, (hoodTop + hoodBottom) / 2, hoodZ], m.steel, .28, 32).name = 'packaging-weigh-conical-downward-extraction-hood';
  s._cyl(details, .285, .025, [hoodX, hoodBottom, hoodZ], m.trim, .285, 32).name = 'packaging-weigh-extraction-hood-lower-rim';
  s._cyl(process, .105, .19, [hoodX, hoodTop + .095, hoodZ], m.steel, .105, 24).name = 'packaging-weigh-hood-short-neck';
  const tubeStart = hoodTop + .17, flexEnd = tubeTop - .49;
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(hoodX, tubeStart, hoodZ),
    new THREE.Vector3(hoodX - .035, 1.75, hoodZ - .015),
    new THREE.Vector3(hoodX - .055, 2.08, hoodZ - .035),
    new THREE.Vector3(hoodX - .025, flexEnd, hoodZ - .04),
  ]);
  s._mesh(new THREE.TubeGeometry(curve, 18, .104, 12, false), m.steel, process).name = 'packaging-weigh-flexible-telescopic-extraction-tube';
  const rings = [], tangent = new THREE.Vector3(), quaternion = new THREE.Quaternion();
  for (let index = 0; index <= 24; index++) {
    const t = index / 24, point = curve.getPoint(t); tangent.copy(curve.getTangent(t));
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
    rings.push({ position: point.toArray(), quaternion: quaternion.toArray() });
  }
  instances(s, details, new THREE.TorusGeometry(.106, .008, 4, 16), m.trim, rings, 'packaging-weigh-metal-flex-tube-corrugations');
  const upperX = hoodX - .025, upperZ = hoodZ - .04;
  s._cyl(process, .115, tubeTop - flexEnd, [upperX, (tubeTop + flexEnd) / 2, upperZ], m.trim, .115, 24).name = 'packaging-weigh-upper-rigid-extraction-neck';
  instances(s, details, new THREE.TorusGeometry(.118, .009, 4, 20), m.steel,
    [flexEnd, flexEnd + .16, flexEnd + .32, tubeTop].map((y) => ({ position: [upperX, y, upperZ], rotation: [PI / 2, 0, 0] })), 'packaging-weigh-telescopic-neck-joint-bands');
  const sideMotor = s._cyl(details, .085, .09, [upperX + .135, flexEnd + .11, upperZ], m.black, .085, 16);
  sideMotor.rotation.z = PI / 2; sideMotor.name = 'packaging-weigh-extraction-neck-side-fitting';
  bars(s, body, m.trim, [[[upperX, tubeTop - .18, upperZ], [upperX, tubeTop - .18, -item.depth * .43]]], 'packaging-weigh-extraction-upper-support', .025);
}
