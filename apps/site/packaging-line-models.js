import * as THREE from '../shared/vendor/three.module.js';
import { buildAgitatorHopper } from './packaging-mixing-models.js';
import { textPlate } from './packaging-kit.js';

// The drawing owns locations and equipment counts. Team 2 equipment cards
// (008-011, 015-041) supply the external forms, finishes and visible services.
// No photographed machine is added at an invented installation location.
const PI = Math.PI;
const UP = new THREE.Vector3(0, 1, 0);

function materials(s) {
  if (s.packagingLineMaterials) return s.packagingLineMaterials;
  const make = (color, roughness = .5, metalness = .4, extra = {}) => s._material(color, roughness, metalness, extra);
  s.packagingLineMaterials = {
    steel: make(0xa5b1b4, .33, .85), edge: make(0x68777b, .4, .75),
    cream: make(0xe3dfce, .7, .1), dark: make(0x253a40, .65, .15),
    belt: make(0x365950, .8, .03), blue: make(0x3667a1, .55, .3),
    orange: make(0xe77e25, .45, .35), yellow: make(0xf0c82e, .55, .1),
    red: make(0xc94f3f, .55, .1), green: make(0x48a378, .6, .1),
    screen: make(0x305f72, .3, .15, { emissive: 0x142f3e, emissiveIntensity: .2 }),
    glass: make(0xc4dce1, .2, .05, { transparent: true, opacity: .22, depthWrite: false, side: THREE.DoubleSide }),
    carton: make(0xb89763, .9, .01), film: make(0xe8ede4, .6, .1),
    polished: make(0xb7c0c1, .24, .93), ivory: make(0xdcd8c7, .66, .12),
    tealGlass: make(0x5caca6, .23, .03, { transparent: true, opacity: .43, depthWrite: false, side: THREE.DoubleSide }),
    cyan: make(0x4298bf, .48, .34), purpleFilm: make(0x704279, .38, .2),
    pink: make(0xc8788f, .65, .1), silverFabric: make(0x8c9393, .7, .25),
  };
  return s.packagingLineMaterials;
}

function assembly(s, root, item) {
  const names = item.parts || ['본체·지지 구조', '처리·투입부', '구동·배출·부속'];
  return [0, 1, 2].map((index) => {
    const group = s._part(root, names[index], [[-.75, .1, 0], [0, .8, 0], [.6, .2, .45]][index]);
    group.name = `${item.id}-${['body', 'process', 'details'][index]}`;
    return group;
  });
}

function batch(s, parent, geometry, material, transforms, name) {
  if (!transforms.length) { geometry.dispose(); return; }
  const object = new THREE.InstancedMesh(geometry, material, transforms.length);
  const matrix = new THREE.Matrix4(), quaternion = new THREE.Quaternion();
  transforms.forEach(({ position, scale = [1, 1, 1], rotation = [0, 0, 0] }, index) => {
    quaternion.setFromEuler(new THREE.Euler(...rotation));
    matrix.compose(new THREE.Vector3(...position), quaternion, new THREE.Vector3(...scale));
    object.setMatrixAt(index, matrix);
  });
  object.instanceMatrix.needsUpdate = true;
  object.castShadow = true; object.receiveShadow = true; object.name = name;
  object.computeBoundingBox(); object.computeBoundingSphere();
  parent.add(object); s.geometries?.add(geometry);
  return object;
}

function boxes(s, parent, material, entries, name) {
  return batch(s, parent, new THREE.BoxGeometry(1, 1, 1), material,
    entries.map(([position, scale, rotation]) => ({ position, scale, rotation })), name);
}

function cylinders(s, parent, material, entries, name, segments = 12) {
  return batch(s, parent, new THREE.CylinderGeometry(1, 1, 1, segments), material, entries, name);
}

function cylinder(s, parent, material, radius, height, position, bottom = radius, name) {
  const object = s._cyl(parent, radius, height, position, material, bottom, 24);
  if (name) object.name = name;
  return object;
}

function rod(s, parent, material, from, to, radius, name) {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), direction = b.clone().sub(a);
  const object = cylinder(s, parent, material, radius, direction.length(), a.add(b).multiplyScalar(.5).toArray(), radius, name);
  object.quaternion.setFromUnitVectors(UP, direction.normalize());
  return object;
}

function beam(s, parent, material, from, to, width, depth, name) {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), delta = b.clone().sub(a);
  const object = s._box(parent, [width, delta.length(), depth], a.add(b).multiplyScalar(.5).toArray(), material);
  object.quaternion.setFromUnitVectors(UP, delta.normalize()); if (name) object.name = name;
  return object;
}

function hose(s, parent, material, points, radius, name) {
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
  const geometry = new THREE.TubeGeometry(curve, Math.max(10, points.length * 5), radius, 7, false);
  const object = s._mesh(geometry, material, parent); object.name = name; return object;
}

function corrugatedTube(s, parent, m, points, radius, name) {
  hose(s, parent, m.silverFabric, points, radius, name);
  const curve = new THREE.CatmullRomCurve3(points.map((point) => new THREE.Vector3(...point)));
  const rings = [], samples = Math.max(8, Math.round(curve.getLength() / .09));
  for (let index = 0; index <= samples; index++) {
    const t = index / samples, point = curve.getPoint(t), tangent = curve.getTangent(t);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
    const rotation = new THREE.Euler().setFromQuaternion(quaternion);
    rings.push({ position: point.toArray(), rotation: [rotation.x, rotation.y, rotation.z] });
  }
  batch(s, parent, new THREE.TorusGeometry(radius * 1.035, .008, 4, 12), m.steel, rings, `${name}-corrugation-rings`);
}

function tower(s, parent, m, x, bottom, z, height = .22) {
  const colors = [m.yellow, m.green, m.red];
  colors.forEach((material, i) => cylinder(s, parent, material, .033, height / 3, [x, bottom + height * (i + .5) / 3, z], .033, 'packaging-card-three-color-signal-tower'));
}

function vents(s, parent, m, x, y, z, width, height, rows = 5) {
  const slats = [];
  for (const side of [-1, 1]) for (let row = 0; row < rows; row++) slats.push([[x + side * width * .25, y + (row / Math.max(1, rows - 1) - .5) * height, z], [width * .43, .026, .018]]);
  boxes(s, parent, m.edge, slats, 'packaging-card-twin-bank-ventilation-slots');
}

function feet(s, parent, m, w, d, y = .11, cx = 0, cz = 0) {
  cylinders(s, parent, m.edge, [-1, 1].flatMap((x) => [-1, 1].map((z) => ({ position: [cx + x * w * .41, y / 2, cz + z * d * .39], scale: [.04, y, .04] }))), 'packaging-card-adjustable-steel-feet');
}

function frame(s, body, m, w, d, top, base = 0) {
  const legW = Math.min(.09, w * .08, d * .09), entries = [];
  for (const x of [-w * .41, w * .41]) for (const z of [-d * .39, d * .39]) {
    entries.push([[x, (base + top) / 2, z], [legW, top - base, legW]]);
    entries.push([[x, base + .035, z], [legW * 1.7, .07, legW * 1.7]]);
  }
  for (const z of [-d * .39, d * .39]) entries.push([[0, top, z], [w * .86, legW, legW]]);
  for (const x of [-w * .41, w * .41]) entries.push([[x, top, 0], [legW, legW, d * .82]]);
  boxes(s, body, m.edge, entries, 'packaging-line-support-frame');
}

function control(s, details, m, x, y, z, width = .3) {
  s._box(details, [width, width * 1.2, .1], [x, y, z], m.cream).name = 'packaging-line-operator-panel';
  s._box(details, [width * .7, width * .52, .012], [x, y + width * .14, z + .057], m.screen);
  boxes(s, details, m.green, [[[x - width * .2, y - width * .3, z + .06], [.035, .035, .018]]], 'packaging-line-control-button');
  boxes(s, details, m.red, [[[x + width * .2, y - width * .3, z + .065], [.045, .045, .025]]], 'packaging-line-stop-button');
}

function guard(s, details, m, w, d, bottom, top) {
  const posts = [], panes = [], bars = [];
  for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) posts.push([[x, (bottom + top) / 2, z], [.035, top - bottom, .035]]);
  for (const y of [bottom, top]) {
    for (const z of [-d / 2, d / 2]) bars.push([[0, y, z], [w, .035, .035]]);
    for (const x of [-w / 2, w / 2]) bars.push([[x, y, 0], [.035, .035, d]]);
  }
  for (const z of [-d / 2, d / 2]) panes.push([[0, (bottom + top) / 2, z], [w - .05, top - bottom - .05, .012]]);
  for (const x of [-w / 2, w / 2]) panes.push([[x, (bottom + top) / 2, 0], [.012, top - bottom - .05, d - .05]]);
  boxes(s, details, m.steel, [...posts, ...bars], 'packaging-line-transparent-guard-frame');
  boxes(s, details, m.glass, panes, 'packaging-line-transparent-guard-panes');
}

function belt(s, body, process, m, w, d, y, longZ = false, rollerOnly = false) {
  const thickness = .15, entries = [];
  if (rollerOnly) {
    const length = longZ ? d : w, across = longZ ? w : d, legTop = y - .1;
    const supports = Math.max(2, Math.ceil(length * .9 / 2) + 1), legs = [];
    for (let index = 0; index < supports; index++) {
      const along = (index / (supports - 1) - .5) * length * .9;
      for (const side of [-1, 1]) {
        const x = longZ ? side * across * .39 : along, z = longZ ? along : side * across * .39;
        legs.push([[x, legTop / 2, z], [.055, legTop, .055]], [[x, .025, z], [.11, .05, .11]]);
      }
      legs.push([longZ ? [0, legTop, along] : [along, legTop, 0], longZ ? [across * .85, .065, .065] : [.065, .065, across * .85]]);
    }
    boxes(s, body, m.steel, legs, 'packaging-line-roller-conveyor-intermediate-stainless-supports');
  } else {
    frame(s, body, m, w, d, y - thickness / 2);
    s._box(process, [w * .84, .055, d * .8], [0, y + .03, 0], m.belt).name = 'packaging-line-conveyor-belt';
  }
  const length = longZ ? d : w, span = longZ ? w * .8 : d * .8;
  const count = rollerOnly ? Math.max(5, Math.min(240, Math.ceil(length / .14))) : Math.max(5, Math.min(54, Math.ceil(length / .28)));
  for (let index = 0; index < count; index++) {
    const along = ((index + .5) / count - .5) * length * (rollerOnly ? .96 : .9);
    entries.push({ position: longZ ? [0, y - .035, along] : [along, y - .035, 0], scale: [.045, span, .045], rotation: longZ ? [0, 0, PI / 2] : [PI / 2, 0, 0] });
  }
  cylinders(s, process, m.steel, entries, 'packaging-line-conveyor-rollers');
  boxes(s, body, m.steel, longZ ? [
    [[-w * .45, y, 0], [.065, .15, d * .96]], [[w * .45, y, 0], [.065, .15, d * .96]],
  ] : [
    [[0, y, -d * .45], [w * .96, .15, .065]], [[0, y, d * .45], [w * .96, .15, .065]],
  ], 'packaging-line-conveyor-side-rails');
}

function pouchMagazine(s, process, m, item, openTable) {
  // The 9동 rotary cards show a horizontal pouch feeder reaching forward
  // from the low table, with two fences that register the unfilled pouches.
  const w = item.width, d = item.depth, h = item.height;
  const tray = s._group(process, [w * (openTable ? .18 : .09), h * .34, d * .32]);
  tray.rotation.x = -.12;
  const width = w * .24, depth = d * .33;
  boxes(s, tray, m.polished, [
    [[0, 0, 0], [width, .032, depth]],
    ...[-1, 1].map(side => [[side * width * .485, .057, 0], [.025, .11, depth]]),
    ...[-1, 1].map(side => [[side * width * .35, .105, depth * .27], [.027, .17, .05]]),
  ], 'packaging-rotary-pouch-magazine-guide-tray');
  boxes(s, tray, m.film, Array.from({ length: 4 }, (_, i) => [
    [0, .025 + i * .012, depth * (.02 - .035 * i)], [width * .68, .009, depth * .58],
  ]), 'packaging-rotary-flat-pouch-stack');
}

function rotary(s, groups, item, m) {
  const [body, process, details] = groups, w = item.width, d = item.depth, h = item.height;
  const one = item.rotaryVariant === 'orange-guard' || /rotary-1$/.test(item.id), r = Math.min(w, d) * .31;
  if (!one) return rotaryTwo(s, groups, item, m);
  const tableY = h * .31, cabinetTop = h * .24;
  feet(s, body, m, w * .84, d * .85);
  boxes(s, body, m.polished, [
    [[0, cabinetTop / 2 + .11, 0], [w * .83, cabinetTop - .11, d * .81]],
    [[0, tableY, 0], [w * .86, .09, d * .86]],
  ], 'packaging-card-rotary-low-stainless-pouch-cabinet');
  const seams = [], handles = [];
  for (const x of [-w * .2, w * .2]) {
    seams.push([[x, cabinetTop * .5, d * .408], [w * .39, cabinetTop * .79, .014]]);
    handles.push([[x + w * .13, cabinetTop * .63, d * .42], [.024, .11, .022]]);
  }
  boxes(s, details, m.steel, seams, 'packaging-card-rotary-lower-access-doors');
  boxes(s, details, m.dark, handles, 'packaging-card-rotary-door-latches');
  cylinder(s, process, m.polished, r, .09, [0, tableY + .08, 0], r, 'packaging-rotary-indexing-table');
  const stations = [], clamps = [];
  for (let index = 0; index < 8; index++) {
    const angle = index * PI / 4, x = Math.cos(angle) * r * .8, z = Math.sin(angle) * r * .8;
    stations.push({ position: [x, tableY + .18, z], scale: [.028, .22, .028] });
    clamps.push([[x, tableY + .3, z], [.16, .055, .085], [0, -angle, 0]]);
  }
  cylinders(s, process, m.steel, stations, 'packaging-card-rotary-pouch-gripper-posts');
  boxes(s, process, m.edge, clamps, 'packaging-card-rotary-visible-pouch-grippers');
  pouchMagazine(s, process, m, item, false);
  const feedX = -w * .1, feedZ = -d * .06;
  cylinder(s, process, m.polished, r * .47, h * .14, [feedX, h * .8, feedZ], r * .13, 'packaging-card-rotary-upper-conical-receiver');
  cylinder(s, process, m.ivory, r * .14, h * .18, [feedX, h * .64, feedZ], r * .14, 'packaging-card-rotary-white-auger-drive-column');
  cylinder(s, process, m.polished, r * .35, h * .105, [feedX, h * .5, feedZ], r * .1, 'packaging-card-rotary-lower-filling-cone');
  const motor = cylinder(s, details, m.blue, .08, .18, [feedX + r * .18, h * .72, feedZ]); motor.rotation.z = PI / 2;
  const enclosure = s._group(details);
  guard(s, enclosure, m, w * .83, d * .81, tableY + .05, h * .62);
  if (one) {
    boxes(s, details, m.orange, [
      [[0, tableY + .05, d * .42], [w * .85, .055, .055]],
      [[w * .42, h * .48, d * .42], [.055, h * .34, .055]],
    ], 'packaging-card-rotary-one-orange-door-edging');
    s._box(body, [w * .84, h * .18, d * .14], [0, h * .63, d * .36], m.polished).name = 'packaging-card-rotary-one-wide-stainless-control-header';
    control(s, details, m, w * .2, h * .64, d * .44, .32);
  } else {
    s._box(body, [w * .16, h * .48, d * .2], [w * .33, h * .49, d * .28], m.ivory).name = 'packaging-card-rotary-two-white-control-column';
    control(s, details, m, w * .33, h * .64, d * .39, .25);
  }
  // Only visible silver extraction hoses are represented; no hidden connection
  // is asserted between the receiver and an unobserved plant duct.
  corrugatedTube(s, details, m, [[w * .24, h * .38, -d * .21], [w * .3, h * .65, -d * .28], [w * .24, h * .94, -d * .22]], .08, 'packaging-card-rotary-silver-flexible-extraction');
  rod(s, details, m.steel, [feedX, h * .87, feedZ], [feedX, h * .98, feedZ], .065);
  hose(s, details, m.blue, [[-w * .4, tableY, d * .25], [-w * .43, h * .5, d * .25], [feedX, h * .62, feedZ]], .015, 'packaging-card-rotary-blue-air-tube');
  tower(s, details, m, w * .35, h * .73, -d * .32, .18);
}

function rotaryTwo(s, groups, item, m) {
  // Card 039 has a tall, narrow filling column over an open low pouch
  // mechanism. Its silhouette differs substantially from rotary no. 1.
  const [body, process, details] = groups, w = item.width, d = item.depth, h = item.height;
  const bw = w * .65, bd = d * .64, deck = h * .29, feedX = -w * .08, feedZ = -d * .05;
  feet(s, body, m, bw, bd);
  boxes(s, body, m.polished, [
    [[0, deck / 2 + .055, 0], [bw, deck - .11, bd]],
    [[0, deck, 0], [bw * 1.03, .07, bd * 1.03]],
  ], 'packaging-card-rotary-two-low-stainless-working-base');
  const access = [], latches = [];
  for (const x of [-bw * .25, bw * .25]) {
    access.push([[x, deck * .51, bd / 2 + .015], [bw * .46, deck * .67, .018]]);
    latches.push([[x, deck * .64, bd / 2 + .03], [.07, .022, .02]]);
  }
  boxes(s, details, m.steel, access, 'packaging-card-rotary-two-small-lower-access-doors');
  boxes(s, details, m.dark, latches, 'packaging-card-rotary-two-base-door-latches');
  const frameParts = [], guardPanes = [], guideHeight = h * .2;
  for (const x of [-bw * .46, bw * .46]) for (const z of [-bd * .45, bd * .45]) frameParts.push([[x, deck + guideHeight / 2, z], [.025, guideHeight, .025]]);
  for (const z of [-bd * .45, bd * .45]) {
    frameParts.push([[0, deck + guideHeight, z], [bw * .94, .025, .025]]);
    guardPanes.push([[0, deck + guideHeight / 2, z], [bw * .9, guideHeight - .03, .012]]);
  }
  boxes(s, body, m.steel, frameParts, 'packaging-card-rotary-two-low-open-stainless-safety-frame');
  boxes(s, details, m.glass, guardPanes, 'packaging-card-rotary-two-low-clear-side-guards');
  const ringRadius = Math.min(bw, bd) * .27;
  cylinder(s, process, m.steel, ringRadius, .055, [0, deck + .06, 0], ringRadius, 'packaging-card-rotary-two-compact-pouch-carriage');
  const grippers = [];
  for (let i = 0; i < 8; i++) {
    const a = i * PI / 4;
    grippers.push([[Math.cos(a) * ringRadius, deck + .16, Math.sin(a) * ringRadius], [.11, .07, .06], [0, -a, 0]]);
  }
  boxes(s, process, m.edge, grippers, 'packaging-card-rotary-two-pouch-clamps-around-small-carriage');
  pouchMagazine(s, process, m, item, true);
  const lowerConeY = h * .51, upperConeY = h * .89, columnBottom = h * .55, columnTop = h * .825;
  cylinder(s, process, m.polished, w * .085, h * .1, [feedX, lowerConeY, feedZ], .055, 'packaging-card-rotary-two-lower-conical-filling-head');
  cylinder(s, process, m.ivory, .075, columnTop - columnBottom, [feedX, (columnTop + columnBottom) / 2, feedZ], .075, 'packaging-card-rotary-two-long-narrow-white-auger-column');
  cylinder(s, process, m.polished, w * .115, h * .15, [feedX, upperConeY, feedZ], .075, 'packaging-card-rotary-two-high-conical-feed-receiver');
  rod(s, process, m.steel, [feedX, h * .965, feedZ], [feedX, h * .99, feedZ], .055, 'packaging-card-rotary-two-top-feed-neck');
  const drive = cylinder(s, details, m.blue, .062, .14, [feedX + .09, h * .77, feedZ]); drive.rotation.z = PI / 2;
  const panelX = w * .27, panelZ = d * .13, panelHeight = h * .29;
  s._box(body, [w * .13, panelHeight, d * .19], [panelX, deck + panelHeight / 2 + .02, panelZ], m.ivory).name = 'packaging-card-rotary-two-narrow-white-control-column';
  control(s, details, m, panelX, deck + panelHeight * .73, panelZ + d * .11, .22);
  const supply = s._group(details, [feedX, 0, 0]);
  corrugatedTube(s, supply, m, [[w * .16, h * .39, -d * .13], [w * .23, h * .58, -d * .15], [w * .21, h * .8, -d * .2], [w * .16, h * .94, -d * .12]], .085, 'packaging-card-rotary-two-tall-silver-extraction-loop');
  hose(s, details, m.dark, [[feedX + .06, h * .57, feedZ], [feedX + .2, h * .66, feedZ + .03], [feedX + .03, h * .73, feedZ]], .019, 'packaging-card-rotary-two-black-auger-service-loop');
  hose(s, details, m.blue, [[-bw * .43, deck, bd * .35], [-bw * .45, h * .49, bd * .34], [feedX, h * .57, feedZ]], .015, 'packaging-card-rotary-two-blue-air-manifold-line');
  tower(s, details, m, -bw * .42, deck + guideHeight + .03, -bd * .36, .17);
}

function formingPacker(s, groups, item, m, stick = false) {
  const [body, process, details] = groups, w = item.width, d = item.depth, h = item.height;
  const cw = w * .53, cd = d * .63, mainTop = h * .6;
  feet(s, body, m, cw, cd);
  boxes(s, body, m.ivory, [
    [[0, mainTop / 2 + .1, -cd / 2], [cw, mainTop - .1, .09]],
    [[-cw / 2, mainTop / 2 + .1, 0], [.08, mainTop - .1, cd]],
    [[cw / 2, mainTop / 2 + .1, 0], [.08, mainTop - .1, cd]],
    [[0, mainTop, 0], [cw, .1, cd]],
  ], 'packaging-card-vertical-cream-enclosed-body');
  const front = cd / 2 + .035;
  boxes(s, details, m.orange, [[[0, .27, front], [cw, .13, .045]]], 'packaging-card-vertical-orange-lower-door-strip');
  s._box(details, [cw * .7, mainTop * .73, .018], [cw * .08, mainTop * .56, front], m.glass).name = 'packaging-card-vertical-single-clear-front-door';
  boxes(s, details, m.edge, [
    [[-cw * .29, mainTop * .56, front + .014], [.035, mainTop * .75, .035]],
    [[cw * .45, mainTop * .56, front + .014], [.035, mainTop * .75, .035]],
    [[cw * .08, mainTop * .93, front + .014], [cw * .77, .035, .035]],
  ], 'packaging-card-vertical-clear-door-black-perimeter');
  cylinder(s, process, m.polished, .11, mainTop * .57, [0, mainTop * .61, d * .08], .11, 'packaging-vertical-forming-tube');
  boxes(s, process, m.steel, [
    [[0, mainTop * .31, d * .08], [cw * .55, .11, .2]],
    [[0, mainTop * .49, d * .08], [cw * .49, .1, .2]],
  ], 'packaging-card-vertical-cross-sealing-bars');
  const receivers = [h * .8, h * .67];
  receivers.forEach((y, i) => cylinder(s, process, m.polished, cw * (i ? .16 : .22), h * .1, [0, y, 0], .065, 'packaging-card-vertical-stacked-filling-cones'));
  cylinder(s, process, m.ivory, .08, h * .17, [0, h * .75, 0]);
  rod(s, process, m.dark, [0, h * .86, 0], [0, h * .98, 0], .04, 'packaging-card-vertical-tall-top-drive');
  corrugatedTube(s, details, m, [[cw * .36, h * .55, -d * .12], [cw * .37, h * .79, -d * .17], [cw * .3, h * .97, -d * .12]], .085, 'packaging-card-vertical-silver-extraction-hose');
  const roll = cylinder(s, process, m.film, .13, cw * .67, [0, .78, -cd * .35]); roll.rotation.z = PI / 2;
  roll.name = 'packaging-card-vertical-low-rear-film-roll';
  s._box(details, [cw * .19, mainTop * .65, .055], [-cw * .39, mainTop * .57, front + .035], m.dark).name = 'packaging-card-vertical-narrow-black-side-controls';
  const keys = [];
  for (let row = 0; row < 6; row++) keys.push([[-cw * .39, mainTop * (.78 - row * .07), front + .07], [.07, .04, .015]]);
  boxes(s, details, m.cream, keys, 'packaging-card-vertical-side-control-rows');
  const steps = [];
  for (const side of [-1, 1]) {
    steps.push([[side * w * .37, .18, .15], [w * .21, .05, d * .4]], [[side * w * .37, .42, -.12], [w * .21, .05, d * .2]]);
  }
  boxes(s, body, m.steel, steps, 'packaging-card-vertical-stainless-two-step-side-platforms');
  hose(s, details, m.blue, [[-cw * .42, .25, 0], [-cw * .46, 1, .1], [-cw * .3, mainTop * .75, 0]], .016, 'packaging-card-vertical-air-hose');
  tower(s, details, m, cw * .4, mainTop + .04, -cd * .3, .17);
}

function stickFiller(s, groups, item, m) {
  // Cards 011/010/008/009 show the paired 1-8 fillers, not the third-floor
  // supply hoppers. Their control faces and film rolls visibly differ.
  // Existing plan-based envelopes remain approximate installation dimensions.
  const w = item.width, d = item.depth, h = item.height;
  const line = item.lineNumber || Number(item.id.match(/stick-(\d+)$/)?.[1]) || 1;
  const [body, process, details] = groups.map(part => {
    const local = s._group(part);
    if (item.operatorSide === 'left') local.scale.x = -1;
    return local;
  });
  const traditionalControls = line <= 2, wideFilm = line === 3 || line === 4;
  const purpleFilm = line >= 7;
  const bodyW = w * .8, cx = -w * .08, mainTop = h * 2 / 2.9;
  const front = d * .29, rear = -d * .42;
  const supports = [];
  for (const x of [cx - bodyW * .44, cx + bodyW * .44]) for (const z of [rear, front]) {
    supports.push([[x, mainTop * .48, z], [.07, mainTop * .88, .075]]);
  }
  for (const y of [.17, mainTop * .57, mainTop]) {
    for (const z of [rear, front]) supports.push([[cx, y, z], [bodyW * .94, .065, .075]]);
    for (const x of [cx - bodyW * .44, cx + bodyW * .44]) supports.push([[x, y, (front + rear) / 2], [.07, .065, front - rear]]);
  }
  boxes(s, body, m.steel, supports, 'packaging-stick-drawing-rectangular-open-machine-frame');
  cylinders(s, body, m.edge, supports.slice(0, 4).map(([position]) => ({
    position: [position[0], .075, position[2]], scale: [.055, .15, .055],
  })), 'packaging-stick-drawing-threaded-levelling-feet');
  boxes(s, body, wideFilm ? m.ivory : m.polished, [
    [[cx, mainTop * .5, rear + .04], [bodyW * .86, mainTop * .86, .075]],
    [[cx, mainTop * .18, -d * .02], [bodyW * .86, .22, d * .76]],
  ], 'packaging-stick-drawing-lower-cabinet-and-rear-service-panel');
  const tubeBank = [], meteringHeads = [], filmLanes = [], collars = [];
  for (let index = 0; index < 10; index++) {
    const x = cx + (index / 9 - .5) * bodyW * .68;
    tubeBank.push({ position: [x, h * .62, d * .08], scale: [.025, h * .53, .025] });
    meteringHeads.push({ position: [x, h * .83, d * .08], scale: [.038, h * .13, .038] });
    filmLanes.push([[x, mainTop * .68, d * .115], [bodyW * .055, mainTop * .51, .012]]);
    for (const y of [h * .54, h * .76]) collars.push({ position: [x, y, d * .08], scale: [.033, .04, .033] });
  }
  cylinders(s, process, m.steel, tubeBank, 'packaging-stick-drawing-ten-filling-tubes');
  cylinders(s, process, m.edge, meteringHeads.concat(collars), 'packaging-stick-drawing-upper-metering-heads-and-tube-collars');
  boxes(s, process, m.glass, filmLanes, 'packaging-stick-drawing-vertical-film-lanes');
  boxes(s, process, m.steel, [
    [[cx, h * .94, d * .08], [bodyW * .83, h * .07, d * .22]],
    [[cx, h * .8, d * .08], [bodyW * .83, .075, d * .26]],
    [[cx, mainTop * .47, d * .1], [bodyW * .87, .11, d * .17]],
    [[cx, mainTop * .29, d * .1], [bodyW * .87, .13, d * .19]],
  ], 'packaging-stick-drawing-feed-bank-and-horizontal-sealing-bars');
  // H9-M-034 through 040 have a rectangular overhead feed chest above the
  // guard and a visible comb of sloping outlets above the takeaway belt.
  const feedY = h * .93, chestHeight = h * .12, chestDepth = d * .24;
  boxes(s, process, m.polished, [
    [[cx, feedY, .02], [bodyW * .76, chestHeight, chestDepth]],
    [[cx, feedY - chestHeight * .52, .02], [bodyW * .82, .035, chestDepth + .045]],
  ], 'packaging-stick-overhead-steel-feed-chest');
  const chutes = [];
  for (let i = 0; i < 10; i++) {
    const x = cx + (i / 9 - .5) * bodyW * .68;
    chutes.push([[x, h * .175, d * .218], [bodyW * .052, .028, d * .22], [.58, 0, 0]]);
  }
  boxes(s, process, m.dark, chutes, 'packaging-stick-sloping-individual-discharge-chutes');
  const sealActuators = [];
  for (const x of [cx - bodyW * .36, cx + bodyW * .36]) sealActuators.push({ position: [x, mainTop * .39, d * .05], scale: [.055, mainTop * .24, .055] });
  cylinders(s, process, m.edge, sealActuators, 'packaging-stick-drawing-side-sealing-actuators');
  const filmRoll = cylinder(s, process, purpleFilm ? m.purpleFilm : m.film, d * .09, bodyW * .73, [cx, mainTop * .3, -d * .31]);
  filmRoll.rotation.z = PI / 2; filmRoll.name = 'packaging-stick-drawing-low-rear-film-roll';
  const rollerRows = [mainTop * .36, mainTop * .55, mainTop * .82].map((y) => ({ position: [cx, y, d * .12], scale: [.035, bodyW * .8, .035], rotation: [0, 0, PI / 2] }));
  cylinders(s, process, m.steel, rollerRows, 'packaging-stick-drawing-film-guide-rollers');
  const guardW = bodyW * .94, guardD = d * .61;
  const guardRoot = s._group(details, [cx, 0, d * .015]);
  guard(s, guardRoot, m, guardW, guardD, mainTop * .19, mainTop * .98);
  const panelX = w * .39, panelW = w * .16, panelH = mainTop * .87, panelZ = d * .18;
  if (line <= 4) {
    s._box(body, [panelW, panelH, .24], [panelX, panelH / 2 + .17, panelZ], wideFilm ? m.ivory : m.polished).name = 'packaging-card-stick-tall-side-control-panel';
    const screenY = traditionalControls ? mainTop * .55 : mainTop * .64;
    s._box(details, [panelW * .87, panelH * .16, .023], [panelX, screenY, panelZ + .14], traditionalControls ? m.dark : m.blue).name = 'packaging-card-stick-operator-display-bezel';
    s._box(details, [panelW * .73, panelH * .13, .012], [panelX, screenY, panelZ + .157], m.screen);
    const buttons = [], lamps = [];
    for (let row = 0; row < 6; row++) for (let col = 0; col < 2; col++) buttons.push([[panelX + (col ? 1 : -1) * panelW * .22, mainTop * (.61 - row * .065), panelZ + .13], [panelW * .14, .035, .02]]);
    for (const sign of [-1, 1]) lamps.push([[panelX + sign * panelW * .22, mainTop * .96, panelZ + .13], [.035, .035, .02]]);
    boxes(s, details, m.dark, buttons, 'packaging-stick-drawing-control-switch-rows');
    boxes(s, details, m.green, lamps, 'packaging-stick-drawing-control-indicators');
    if (traditionalControls) {
      const counters = [], redDigits = [];
      for (let row = 0; row < 2; row++) for (let col = 0; col < 4; col++) {
        const x = panelX + (col / 3 - .5) * panelW * .72, y = mainTop * (.88 - row * .1);
        counters.push([[x, y, panelZ + .132], [panelW * .17, .09, .022]]);
        redDigits.push([[x, y, panelZ + .146], [panelW * .11, .018, .006]]);
      }
      boxes(s, details, m.dark, counters, 'packaging-card-stick-one-two-two-rows-black-temperature-displays');
      boxes(s, details, m.red, redDigits, 'packaging-card-stick-one-two-small-red-temperature-digits');
    }
  } else {
    // Cards 008/009: a broad full-depth SS side door carries the thin blue
    // monitor. It is not the narrow multi-meter console of the older pairs.
    const sideDepth = d * .76, sideCenterZ = -d * .03;
    s._box(body, [.06, panelH, sideDepth], [panelX, panelH / 2 + .17, sideCenterZ], m.polished).name = 'packaging-card-stick-five-eight-full-depth-stainless-side-door';
    boxes(s, body, m.steel, [
      [[(panelX + cx + guardW / 2) / 2, .19, sideCenterZ], [panelX - cx - guardW / 2, .06, sideDepth]],
      [[(panelX + cx + guardW / 2) / 2, panelH + .14, sideCenterZ], [panelX - cx - guardW / 2, .055, sideDepth]],
    ], 'packaging-card-stick-five-eight-side-cabinet-return-edges');
    const monitorY = mainTop * .6, monitorZ = d * .15;
    s._box(details, [.035, panelH * .19, d * .24], [panelX + .065, monitorY, monitorZ], m.blue).name = 'packaging-card-stick-five-eight-side-facing-blue-monitor-bezel';
    s._box(details, [.014, panelH * .16, d * .205], [panelX + .091, monitorY, monitorZ], m.screen);
    boxes(s, details, m.dark, [
      [[panelX + .041, mainTop * .44, -d * .24], [.018, .028, .12]],
      [[panelX + .041, mainTop * .83, -d * .24], [.018, .028, .12]],
    ], 'packaging-card-stick-five-eight-black-side-door-latches');
  }
  if (wideFilm) {
    s._box(process, [bodyW * .73, mainTop * .52, .015], [cx, mainTop * .64, -d * .27], m.film).name = 'packaging-card-stick-three-four-wide-white-film-web';
    beam(s, details, m.steel, [cx, .45, -d * .4], [cx, .8, -d * .24], bodyW * .8, .035, 'packaging-card-stick-three-four-sloping-rear-film-guard');
  }
  hose(s, details, m.blue, [[cx - bodyW * .43, .35, front], [cx - bodyW * .47, .8, d * .15], [cx - bodyW * .4, 1.2, .05]], .014, 'packaging-card-stick-blue-pneumatic-air-line');
  hose(s, details, m.dark, [[cx, h * .9, .02], [cx + .14, h * .95, -.12], [cx + .24, mainTop * .83, -.1]], .022, 'packaging-card-stick-top-curved-service-hose');
  tower(s, details, m, panelX, panelH + .17, panelZ, .2);
  s._box(details, [bodyW * .72, .06, d * .2], [cx, .33, front + .1], m.belt).name = 'packaging-stick-drawing-low-front-discharge';
}

function bagFiller(s, groups, item, m) {
  const [body, process, details] = groups, w = item.width, d = item.depth, h = item.height;
  const x = -w * .12, radius = Math.min(w * .14, d * .18);
  boxes(s, body, m.ivory, [
    [[x, .55, -d * .16], [w * .12, 1.1, d * .16]],
    [[x, .07, 0], [w * .48, .14, d * .49]],
    [[w * .24, h * .29, -d * .03], [w * .21, h * .5, d * .35]],
  ], 'packaging-card-bag-filler-narrow-column-and-side-cream-cabinet');
  feet(s, body, m, w * .55, d * .57);
  cylinder(s, process, m.polished, radius, h * .14, [x, h * .89, 0], radius * .25, 'packaging-card-bag-filler-top-conical-receiver');
  cylinder(s, process, m.ivory, radius * .3, h * .22, [x, h * .71, 0], radius * .3, 'packaging-card-bag-filler-white-auger-column');
  cylinder(s, process, m.polished, radius * .83, h * .12, [x, h * .55, 0], radius * .24, 'packaging-card-bag-filler-lower-cone');
  cylinder(s, process, m.steel, radius * .24, h * .16, [x, h * .42, 0]);
  const collar = cylinder(s, process, m.yellow, radius * .54, .09, [x, h * .33, 0], radius * .54, 'packaging-card-bag-filler-yellow-bag-clamp');
  boxes(s, process, m.steel, [
    [[x, h * .17, d * .12], [w * .28, .06, d * .37]],
    [[x - radius * .55, h * .33, 0], [.065, .12, d * .18]],
    [[x + radius * .55, h * .33, 0], [.065, .12, d * .18]],
  ], 'packaging-card-bag-filler-clamp-jaws-and-small-bag-rest');
  control(s, details, m, x + radius * .7, h * .4, d * .23, .26);
  const motors = [h * .65, h * .8].map((y) => ({ position: [x + radius * .42, y, -.04], scale: [.07, .16, .07], rotation: [0, 0, PI / 2] }));
  cylinders(s, details, m.blue, motors, 'packaging-card-bag-filler-auger-side-motors');
  corrugatedTube(s, details, m, [[w * .24, h * .42, -d * .04], [w * .23, h * .66, -d * .18], [w * .15, h * .96, -d * .15]], .1, 'packaging-card-bag-filler-large-silver-extraction');
  hose(s, details, m.dark, [[x + .1, h * .34, 0], [x + .24, h * .51, .1], [x + .12, h * .68, 0]], .02, 'packaging-card-bag-filler-black-clamp-service-hose');
  rod(s, details, m.steel, [x + radius * .75, h * .3, 0], [x + radius * .8, h * .4, 0], .023);
}

function lineCheckweigher(s, [body, process, details], item, m) {
  const w = item.width, d = item.depth, h = item.height, bed = h * .5;
  const cream = item.weigherVariant === 'rotary-white';
  const beltMat = cream ? m.film : m.dark;
  frame(s, body, m, w * .96, d * .82, bed - .12);
  boxes(s, body, cream ? m.ivory : m.polished, [
    [[0, bed - .105, -d * .33], [w * .96, .17, .055]],
    [[0, bed - .105, d * .33], [w * .96, .17, .055]],
  ], 'packaging-small-pack-checkweigher-stainless-chassis');
  const segments = [[-.335, .285], [0, .34], [.335, .285]];
  for (const [offset, length] of segments) {
    const plateY = offset === 0 ? bed + .006 : bed;
    boxes(s, process, beltMat, [[[w * offset, plateY, 0], [w * length, .042, d * .62]]],
      offset === 0 ? 'packaging-small-pack-isolated-weighing-belt' : 'packaging-small-pack-transfer-belt');
  }
  const deckDrums = segments.flatMap(([offset, length]) => [-1, 1].map(side => ({
    position: [w * (offset + side * length / 2), bed - .024, 0],
    scale: [.045, d * .62, .045], rotation: [PI / 2, 0, 0],
  })));
  cylinders(s, process, beltMat, deckDrums, 'packaging-small-pack-independent-belt-drums');
  const cx = item.weigherVariant === 'vertical-steel' ? w * .06 : 0;
  const consoleW = w * .21, consoleZ = -d * .365, consoleDepth = d * .15;
  s._box(body, [consoleW, h * .64, consoleDepth], [cx, h * .65, consoleZ], cream ? m.ivory : m.polished).name = 'packaging-small-pack-rear-weigher-console';
  const face = consoleZ + consoleDepth * .53;
  boxes(s, details, m.dark, [
    [[cx, h * .84, face], [consoleW * .77, h * .135, .016]],
    [[cx, h * .675, face], [consoleW * .58, h * .04, .016]],
  ], 'packaging-small-pack-weigher-display-and-key-row');
  s._box(details, [consoleW * .6, h * .1, .012], [cx - consoleW * .045, h * .84, face + .014], m.screen);
  tower(s, details, m, cx + consoleW * .33, h * .97, consoleZ, h * .1);
}

function inspection(s, groups, item, m, kind) {
  if (kind === 'xray') return photoXray(s, groups, item, m);
  if (kind === 'checkweigher' && item.weigherVariant) return lineCheckweigher(s, groups, item, m);
  const [body, process, details] = groups, w = item.width, d = item.depth, h = item.height, beltY = Math.min(.83, h * (kind === 'xray' ? .41 : .53));
  belt(s, body, process, m, w, d, beltY);
  if (kind === 'checkweigher') {
    const x = -w * .26, z = d * .3, pw = Math.min(.4, w * .28), ph = h * .245;
    s._box(process, [w * .35, .06, d * .68], [0, beltY + .06, 0], m.dark).name = 'packaging-card-checkweigher-black-weighing-belt';
    s._box(body, [pw * .72, h * .71, .17], [x, h * .4, z], m.polished).name = 'packaging-card-checkweigher-upright-stainless-column';
    s._box(details, [pw, ph, .13], [x, h * .77, z + .08], m.dark).name = 'packaging-card-checkweigher-large-black-operator-display';
    s._box(details, [pw * .83, ph * .76, .014], [x, h * .77, z + .153], m.screen);
    boxes(s, details, m.dark, [
      [[x - pw * .2, h * .6, z + .105], [.025, .025, .015]],
      [[x, h * .6, z + .105], [.025, .025, .015]],
    ], 'packaging-card-checkweigher-small-front-key-row');
    const stop = cylinder(s, details, m.red, .035, .025, [x + pw * .28, h * .6, z + .11]); stop.rotation.x = PI / 2;
    const paper = cylinder(s, details, m.film, .055, pw * .65, [x, h * .94, z]); paper.rotation.z = PI / 2;
    tower(s, details, m, x + pw * .42, h * .84, z, h * .14);
    const hosePoints = [];
    for (let i = 0; i <= 24; i++) hosePoints.push([x + pw * .48 + Math.sin(i * PI * .5) * .022, h * .51 - i * h * .013, z - .045 + Math.cos(i * PI * .5) * .022]);
    hose(s, details, m.cyan, hosePoints, .009, 'packaging-card-checkweigher-blue-coiled-air-hose');
    return;
  }
  {
    const tunnelW = w * .4, tunnelD = d * .75, clearHeight = Math.max(.22, h - beltY - .13);
    boxes(s, body, m.steel, [
      [[0, h - .075, 0], [tunnelW, .15, tunnelD]],
      [[0, beltY + clearHeight / 2, -tunnelD / 2], [tunnelW, clearHeight, .085]],
      [[0, beltY + clearHeight / 2, tunnelD / 2], [tunnelW, clearHeight, .085]],
    ], 'packaging-metal-detector-tunnel');
    control(s, details, m, w * .13, h * .78, d * .43, Math.min(.25, w * .14));
  }
}

function photoXray(s, groups, item, m) {
  const [body, process, details] = groups, w = item.width, d = item.depth, h = item.height;
  const card = Number(item.historyCardNumber), ventFront = card === 25 || card === 26;
  const cw = w * .51, cd = d * .83, foot = .1, top = h * .94, beltY = h * .41, openingTop = beltY + h * .145;
  // The photographed unit is a tall integral cabinet on short feet, not an
  // inspection arch sitting on a separate four-legged conveyor table.
  feet(s, body, m, cw * .94, cd * .94, foot);
  boxes(s, body, m.polished, [
    [[0, (foot + beltY - .07) / 2, 0], [cw, beltY - .07 - foot, cd]],
    [[0, (openingTop + top) / 2, 0], [cw, top - openingTop, cd]],
    [[0, (foot + top) / 2, cd / 2], [cw, top - foot, .045]],
    [[0, (foot + top) / 2, -cd / 2], [cw, top - foot, .045]],
    [[0, beltY - .025, -d * .3], [w * .96, .09, .055]],
    [[0, beltY - .025, d * .3], [w * .96, .09, .055]],
  ], 'packaging-card-xray-integral-tall-stainless-cabinet');
  s._box(process, [w * .94, .035, d * .52], [0, beltY, 0], m.film).name = 'packaging-card-xray-short-white-through-belt';
  const rollers = [-w * .42, w * .42].map((x) => ({ position: [x, beltY - .018, 0], scale: [.04, d * .54, .04], rotation: [PI / 2, 0, 0] }));
  cylinders(s, process, m.steel, rollers, 'packaging-card-xray-short-entry-exit-conveyor-rollers');
  const strips = [], curtainH = openingTop - beltY;
  for (const x of [-cw / 2 - .016, cw / 2 + .016]) for (let i = 0; i < 19; i++) strips.push([[x, beltY + curtainH / 2 + .015, (i / 18 - .5) * cd * .78], [.014, curtainH, cd * .037]]);
  boxes(s, details, m.blue, strips, 'packaging-card-xray-low-blue-entry-exit-curtain-strips');
  for (const sign of [-1, 1]) {
    const end = s._group(details, [sign * (cw / 2 + .018), 0, 0]); end.rotation.y = sign * PI / 2;
    vents(s, end, m, 0, h * .81, .012, cd * .74, h * .135, 5);
    boxes(s, end, m.polished, [
      [[0, openingTop + .015, .018], [cd * .89, .07, .025]],
      [[-cd * .435, beltY + curtainH / 2, .018], [.045, curtainH, .025]],
      [[cd * .435, beltY + curtainH / 2, .018], [.045, curtainH, .025]],
    ], 'packaging-card-xray-blue-curtain-opening-stainless-frame');
    s._box(end, [.15, .035, .018], [0, openingTop + .1, .032], m.dark).name = 'packaging-card-xray-small-opening-status-window';
    s._box(end, [.07, .018, .008], [0, openingTop + .1, .046], m.red);
  }
  // Cards 025 and 026 show the vent/curtain face, whereas 021/022/035/037
  // show the large operator screen. Machine ports retain the drawing's X flow.
  const screenSign = ventFront ? -1 : 1;
  const front = s._group(details, [0, 0, screenSign * (cd / 2 + .03)]);
  front.rotation.y = screenSign < 0 ? PI : 0;
  const monitorY = (openingTop + top) / 2, monitorH = (top - openingTop) * .74;
  s._box(front, [cw * .87, monitorH, .035], [0, monitorY + .01, .015], m.dark).name = 'packaging-card-xray-operator-screen-on-card-matched-face';
  s._box(front, [cw * .74, monitorH * .75, .012], [0, monitorY + .035, .04], m.screen);
  const stopY = monitorY - monitorH * .48;
  const plate = cylinder(s, front, m.yellow, .052, .018, [cw * .35, stopY, .045]); plate.rotation.x = PI / 2;
  const stop = cylinder(s, front, m.red, .035, .035, [cw * .35, stopY, .065]); stop.rotation.x = PI / 2;
  s._box(front, [cw * .86, h * .23, .018], [0, h * .22, .017], m.steel).name = 'packaging-card-xray-lower-front-access-door';
  s._box(front, [.105, .033, .018], [0, h * .29, .034], m.dark);
  const back = s._group(details, [0, 0, -screenSign * (cd / 2 + .03)]);
  back.rotation.y = screenSign > 0 ? PI : 0;
  vents(s, back, m, 0, h * .8, .01, cw * .7, h * .13, 5);
  vents(s, back, m, 0, h * .25, .01, cw * .7, h * .13, 5);
  const backStop = cylinder(s, back, m.red, .038, .025, [-cw * .3, h * .48, .035]); backStop.rotation.x = PI / 2;
  tower(s, details, m, cw * .28, top + .012, 0, h * .045);
}

function sealer(s, groups, item, m, erect = false) {
  if (erect) return cartonErector(s, groups, item, m);
  const [body, process, details] = groups, w = item.width, d = item.depth, h = item.height;
  const bed = h * .4, cyan = item.tapeVariant === 'cyan', armColor = cyan ? m.cyan : m.ivory;
  belt(s, body, process, m, w, d, bed);
  boxes(s, body, m.ivory, [
    [[0, bed - .055, 0], [w * .94, .15, d * .85]],
    [[-w * .13, h * .65, -d * .38], [.07, h * .6, .07]],
    [[-w * .13, h * .65, d * .38], [.07, h * .6, .07]],
    [[-w * .13, h * .94, 0], [.08, .07, d * .82]],
  ], 'packaging-card-taper-cream-height-adjustment-gantry');
  const raisedRollers = [];
  for (let i = 0; i < 10; i++) raisedRollers.push({ position: [(i / 9 - .5) * w * .82, bed + .07, 0], scale: [.043, d * .68, .043], rotation: [PI / 2, 0, 0] });
  cylinders(s, process, m.steel, raisedRollers, 'packaging-card-taper-exposed-horizontal-roller-bed');
  boxes(s, process, m.orange, Array.from({ length: 12 }, (_, i) => [[(i / 11 - .5) * w * .76, bed + .08, 0], [w * .04, .035, d * .13]]), 'packaging-card-taper-orange-central-drive-chain');
  beam(s, process, armColor, [-w * .32, h * .6, 0], [w * .25, h * .69, 0], .13, d * .29, 'packaging-card-taper-long-cantilever-tape-arm');
  s._box(process, [w * .36, .12, d * .29], [0, h * .57, 0], cyan ? m.cyan : m.red).name = 'packaging-card-taper-red-or-cyan-tape-head';
  const reel = cylinder(s, process, cyan ? m.yellow : m.film, Math.min(.16, d * .17), .055, [-w * .02, h * .79, 0]);
  reel.rotation.x = PI / 2; reel.name = 'packaging-card-taper-upper-paper-tape-reel';
  const hub = cylinder(s, details, m.edge, .037, .065, [-w * .02, h * .79, .037]); hub.rotation.x = PI / 2;
  const motors = [], motorFins = [];
  for (const side of [-1, 1]) {
    const x = -w * .3, z = side * d * .28;
    motors.push({ position: [x, bed + .23, z], scale: [.085, .31, .085] });
    for (let i = 0; i < 7; i++) motorFins.push([[x, bed + .23, z + (i - 3) * .018], [.16, .28, .008]]);
  }
  cylinders(s, details, m.edge, motors, 'packaging-card-taper-two-upright-grey-gear-motors');
  boxes(s, details, m.steel, motorFins, 'packaging-card-taper-grey-motor-cooling-fins');
  hose(s, details, m.dark, [[-w * .35, bed + .04, -d * .25], [-w * .36, h * .91, -.1], [w * .08, h * .91, 0], [w * .18, h * .64, 0]], .022, 'packaging-card-taper-black-looped-service-cable');
  control(s, details, m, w * .35, h * .61, d * .38, Math.min(.24, w * .15));
}

function cartonErector(s, groups, item, m) {
  const [body, process, details] = groups, w = item.width, d = item.depth, h = item.height;
  const cx = -w * .15, cw = w * .59, cd = d * .86, bottom = h * .4, top = h * .93;
  feet(s, body, m, w * .89, d * .88);
  const magazineLegTop = h * .34 - .1, magazineFeetX = w * .89 * .41;
  boxes(s, body, m.ivory, [-1, 1].map((sign) => [
    [magazineFeetX, (.11 + magazineLegTop) / 2, sign * d * .88 * .39],
    [.065, magazineLegTop - .11, .065],
  ]), 'packaging-card-carton-erector-magazine-table-support-legs');
  boxes(s, body, m.ivory, [
    [[cx, bottom / 2 + .1, 0], [cw, bottom - .1, cd]],
    [[cx, top, 0], [cw, .075, cd]],
    [[w * .27, h * .34, 0], [w * .4, .2, cd * .87]],
  ], 'packaging-card-carton-erector-cream-cabinet-and-blank-magazine-table');
  const frameParts = [], windows = [];
  for (const x of [cx - cw / 2, cx, cx + cw / 2]) for (const z of [-cd / 2, cd / 2]) frameParts.push([[x, (bottom + top) / 2, z], [.045, top - bottom, .045]]);
  for (const z of [-cd / 2, cd / 2]) {
    frameParts.push([[cx, bottom, z], [cw, .045, .045]], [[cx, top, z], [cw, .045, .045]]);
    windows.push([[cx, (bottom + top) / 2, z], [cw - .05, top - bottom - .05, .016]]);
  }
  for (const x of [cx - cw / 2, cx + cw / 2]) windows.push([[x, (bottom + top) / 2, 0], [.016, top - bottom - .05, cd - .05]]);
  boxes(s, body, m.ivory, frameParts, 'packaging-card-carton-erector-long-window-door-frames');
  boxes(s, details, m.tealGlass, windows, 'packaging-card-carton-erector-teal-transparent-safety-windows');
  boxes(s, details, m.dark, [
    [[cx - cw * .25, bottom * .58, cd / 2 + .02], [.11, .035, .018]],
    [[cx + cw * .25, bottom * .58, cd / 2 + .02], [.11, .035, .018]],
  ], 'packaging-card-carton-erector-black-lower-door-handles');
  const internals = [], chain = [];
  for (const z of [-cd * .2, cd * .2]) internals.push([[cx, h * .48, z], [cw * .83, .055, .065]], [[w * .26, h * .42, z], [w * .41, .04, .045]]);
  for (let i = 0; i < 8; i++) chain.push([[cx + (i / 7 - .5) * cw * .8, h * .43, 0], [.06, .06, .1]]);
  boxes(s, process, m.steel, internals, 'packaging-card-carton-erector-magazine-guides-and-opening-carriage');
  boxes(s, process, m.orange, chain, 'packaging-card-carton-erector-orange-drive-chain');
  boxes(s, process, m.ivory, [
    [[w * .43, h * .5, 0], [.055, h * .28, cd * .85]],
    [[w * .27, h * .62, 0], [w * .35, .045, .055]],
  ], 'packaging-card-carton-erector-empty-blank-magazine-backstop');
  const motors = [-1, 1].map((sign) => ({ position: [cx - cw * .15, h * .52, sign * cd * .29], scale: [.07, .22, .07] }));
  cylinders(s, details, m.edge, motors, 'packaging-card-carton-erector-vertical-feed-motors');
  control(s, details, m, cx - cw * .3, h * .83, cd / 2 + .06, .19);
  tower(s, details, m, cx + cw * .38, top + .035, -cd * .27, h * .045);
}

function robot(s, groups, item, m) {
  const [body, process, details] = groups, w = item.width, d = item.depth, h = item.height, unit = Math.min(w, d);
  const palletizer = item.robotVariant === 'case-palletizer' || /robot-[45]$/.test(item.id);
  if (!palletizer) {
    const frameParts = [];
    for (const x of [-w * .43, w * .43]) for (const z of [-d * .42, d * .42]) frameParts.push([[x, h * .49, z], [.065, h * .98, .065]]);
    for (const z of [-d * .42, d * .42]) frameParts.push([[0, h * .97, z], [w * .9, .065, .065]], [[0, h * .35, z], [w * .9, .055, .055]]);
    for (const x of [-w * .43, w * .43]) frameParts.push([[x, h * .97, 0], [.065, .065, d * .9]]);
    boxes(s, body, m.steel, frameParts, 'packaging-card-delta-robot-overhead-stainless-support-frame');
    cylinder(s, process, m.ivory, unit * .19, h * .13, [0, h * .86, 0], unit * .13, 'packaging-card-delta-robot-cream-overhead-drive-housing');
    cylinder(s, process, m.edge, unit * .2, .045, [0, h * .94, 0]);
    const platform = [0, h * .38, d * .04], radius = unit * .28;
    for (let arm = 0; arm < 3; arm++) {
      const angle = arm * PI * 2 / 3, upper = [Math.cos(angle) * radius, h * .78, Math.sin(angle) * radius];
      const end = [platform[0] + Math.cos(angle) * .07, platform[1], platform[2] + Math.sin(angle) * .07];
      rod(s, process, m.edge, [Math.cos(angle) * unit * .13, h * .87, Math.sin(angle) * unit * .13], upper, .035, 'packaging-card-delta-robot-short-upper-arm');
      for (const side of [-1, 1]) {
        const shift = [Math.cos(angle + PI / 2) * .035 * side, 0, Math.sin(angle + PI / 2) * .035 * side];
        rod(s, process, m.dark, upper.map((v, i) => v + shift[i]), end.map((v, i) => v + shift[i]), .012, 'packaging-card-delta-robot-paired-black-parallel-link-rods');
      }
    }
    cylinder(s, process, m.edge, unit * .09, .06, platform, unit * .09, 'packaging-card-delta-robot-small-lower-parallel-platform');
    rod(s, details, m.steel, platform, [0, h * .28, d * .04], .022);
    s._box(details, [unit * .17, .06, unit * .14], [0, h * .27, d * .04], m.edge).name = 'packaging-card-delta-robot-pick-head';
    hose(s, details, m.cyan, [[0, h * .94, -d * .2], [-w * .2, h * .64, -d * .16], [0, h * .33, .06]], .015, 'packaging-card-delta-robot-blue-service-tube');
    s._box(details, [.15, .09, .12], [-w * .25, h * .58, d * .28], m.yellow).name = 'packaging-card-delta-robot-yellow-vision-camera';
    boxes(s, details, m.steel, [
      [[-w * .25, h * .465, d * .28], [.035, h * .23, .035]],
      [[-w * .25, h * .35, d * .35], [.035, .035, d * .17]],
    ], 'packaging-card-delta-robot-fixed-vision-camera-bracket');
    const glazed = s._group(details);
    guard(s, glazed, m, w * .88, d * .86, h * .34, h * .94);
    tower(s, details, m, w * .36, h * .87, -d * .34, h * .11);
    return;
  }
  const baseParts = [];
  for (const x of [-w * .32, w * .32]) for (const z of [-d * .31, d * .31]) baseParts.push([[x, h * .17, z], [.12, h * .34, .12]]);
  baseParts.push([[0, h * .33, 0], [w * .73, .12, d * .75]], [[0, .08, 0], [w * .75, .13, d * .77]]);
  boxes(s, body, m.blue, baseParts, 'packaging-card-case-palletizer-blue-raised-four-leg-base');
  boxes(s, body, m.ivory, [
    [[-w * .15, h * .45, 0], [w * .37, h * .21, d * .3]],
    [[-w * .15, h * .56, 0], [w * .32, h * .12, d * .28]],
    [[-w * .15, h * .63, -.01], [w * .24, h * .07, d * .24]],
  ], 'packaging-card-case-palletizer-cream-chamfered-shoulder-housing');
  const shoulder = [-w * .18, h * .55, 0], elbow = [-w * .08, h * .93, -d * .05], wrist = [w * .32, h * .48, d * .06];
  beam(s, process, m.ivory, shoulder, elbow, w * .13, d * .13, 'packaging-card-case-palletizer-long-cream-upright-boom');
  beam(s, process, m.ivory, elbow, wrist, w * .12, d * .12, 'packaging-card-case-palletizer-cream-descending-forearm');
  rod(s, process, m.blue, [-w * .08, h * .55, d * .11], [-w * .01, h * .86, d * .08], .05, 'packaging-card-case-palletizer-blue-external-lift-cylinder');
  rod(s, process, m.blue, [-w * .03, h * .88, d * .11], [w * .25, h * .5, d * .16], .032, 'packaging-card-case-palletizer-blue-parallel-link');
  cylinders(s, details, m.blue, [shoulder, elbow].map((point) => ({ position: point, scale: [.09, d * .2, .09], rotation: [PI / 2, 0, 0] })), 'packaging-card-case-palletizer-blue-pivot-caps');
  const fourth = item.robotIndex === 4 || /robot-4$/.test(item.id);
  cylinder(s, process, m.edge, unit * .07, .08, [wrist[0], wrist[1] - .04, wrist[2]], unit * .07, 'packaging-card-case-palletizer-wrist-rotation-flange');
  s._box(process, [w * .24, .035, d * .25], [wrist[0], wrist[1] - .0975, wrist[2]], m.steel).name = 'packaging-card-case-palletizer-thin-stainless-gripper-top-plate';
  s._box(process, [w * .26, .045, .06], [wrist[0], wrist[1] - .135, wrist[2] + d * .08], fourth ? m.steel : m.edge).name = 'packaging-card-case-palletizer-comb-support-spine';
  if (fourth) boxes(s, details, m.red, [
    [[wrist[0], wrist[1] - .13, wrist[2] - d * .105], [w * .23, .035, .025]],
    [[wrist[0], wrist[1] - .13, wrist[2] + d * .105], [w * .23, .035, .025]],
  ], 'packaging-card-case-palletizer-four-thin-red-gripper-edge-frame');
  const forks = [];
  for (let index = 0; index < 9; index++) forks.push([[wrist[0] + (index / 8 - .5) * w * .26, wrist[1] - .17, wrist[2] + d * .08], [.017, .045, d * .28]]);
  boxes(s, details, fourth ? m.steel : m.edge, forks, 'packaging-card-case-palletizer-stainless-comb-gripper-fingers');
  hose(s, details, m.dark, [[-w * .22, h * .47, -d * .13], [-w * .2, h * .95, -d * .12], [w * .02, h * .9, -d * .12], [wrist[0], wrist[1], -.03]], .025, 'packaging-card-case-palletizer-black-boom-service-hose');
  vents(s, details, m, -w * .15, h * .46, d * .16, w * .25, h * .09, 4);
}

function vMixer(s, groups, item, m) {
  const [body, process, details] = groups, w = item.width, d = item.depth, h = item.height;
  frame(s, body, m, w * .94, d * .75, h * .47);
  const r = Math.min(d * .23, w * .12);
  rod(s, process, m.steel, [-w * .24, h * .85, 0], [0, h * .38, 0], r, 'packaging-v-mixer-left-drum');
  rod(s, process, m.steel, [w * .24, h * .85, 0], [0, h * .38, 0], r, 'packaging-v-mixer-right-drum');
  for (const side of [-1, 1]) {
    const axis = new THREE.Vector3(w * .24 * side, h * .47, 0).normalize();
    const top = new THREE.Vector3(w * .24 * side, h * .85, 0);
    for (const [distance, radius, length, mat] of [[-.035, r * 1.08, .055, m.edge], [.009, r * 1.02, .04, m.polished]]) {
      const cap = cylinder(s, process, mat, radius, length, top.clone().addScaledVector(axis, distance).toArray(), radius, 'packaging-v-blender-angled-charge-cover');
      cap.quaternion.setFromUnitVectors(UP, axis);
    }
  }
  rod(s, body, m.steel, [-w * .42, h * .5, 0], [w * .42, h * .5, 0], .06, 'packaging-v-mixer-trunnion-shaft');
  cylinder(s, process, m.steel, .1, h * .16, [0, h * .27, 0]);
  cylinder(s, process, m.blue, .15, .07, [0, h * .19, 0]).rotation.x = PI / 2;
  const motor = cylinder(s, details, m.blue, .15, w * .18, [w * .32, h * .45, -d * .22]); motor.rotation.z = PI / 2;
  boxes(s, body, m.edge, [-1, 1].map(side => [[side * w * .4, h * .48, 0], [.16, .2, d * .28]]), 'packaging-v-blender-trunnion-bearing-pedestals');
  control(s, details, m, -w * .33, h * .4, d * .35, .26);
}

function hopper(s, groups, item, m) {
  const [body, process, details] = groups, w = item.width, d = item.depth, h = item.height, deck = item.platformHeight || 0;
  const r = Math.min(w, d) * .33, tankBottom = h * .66, outlet = deck + .42, top = h - .15;
  frame(s, body, m, w * .86, d * .84, tankBottom + .05, deck);
  cylinder(s, process, m.steel, r, top - tankBottom, [0, (top + tankBottom) / 2, 0], r, 'packaging-floor-hopper-round-body');
  cylinder(s, process, m.steel, r, tankBottom - outlet, [0, (tankBottom + outlet) / 2, 0], .13, 'packaging-floor-hopper-conical-discharge');
  cylinder(s, process, m.steel, .13, .25, [0, outlet - .125, 0]);
  cylinder(s, details, m.steel, r * .42, .08, [0, top + .04, 0]);
  const valve = cylinder(s, details, m.blue, .14, .15, [.21, outlet, 0]); valve.rotation.z = PI / 2;
  control(s, details, m, w * .28, deck + .6, d * .36, .28);
}

function serviceCabinet(s, groups, item, m) {
  const [body, process, details] = groups, w = item.width, d = item.depth, h = item.height;
  if (item.serviceVariant === 'printer') {
    const headZ = d * .35, standX = -w * .18;
    frame(s, body, m, w * .68, d * .7, h * .4);
    const panel = s._group(process, [standX, h * .7, -d * .12]);
    panel.rotation.x = -.16;
    s._box(panel, [w * .61, h * .46, d * .35], [0, 0, 0], m.dark).name = 'packaging-inkjet-sloped-controller';
    s._box(panel, [w * .49, h * .23, .015], [0, h * .055, d * .18], m.screen);
    s._box(panel, [w * .48, h * .055, .015], [0, -h * .145, d * .18], m.edge);
    const headX = w * .29, headY = h * .6;
    rod(s, body, m.steel, [headX, .055, headZ], [headX, headY + .055, headZ], .017, 'packaging-inkjet-printhead-mounting-post');
    s._box(body, [.12, .035, .11], [headX, .03, headZ], m.steel);
    s._box(process, [.09, .06, .14], [headX, headY, headZ], m.edge).name = 'packaging-inkjet-remote-coding-head';
    hose(s, details, m.dark, [[standX, h * .55, -d * .23], [-w * .32, h * .19, d * .12], [w * .08, h * .16, d * .26], [headX, headY, headZ]], .014, 'packaging-inkjet-flexible-umbilical');
    return;
  }
  if (item.serviceVariant === 'hotmelt') {
    frame(s, body, m, w * .83, d * .73, h * .36);
    s._box(body, [w * .84, h * .37, d * .7], [0, h * .55, 0], m.edge).name = 'packaging-hotmelt-melter-housing';
    s._box(process, [w * .62, h * .1, d * .57], [-w * .065, h * .77, -.025], m.ivory).name = 'packaging-hotmelt-insulated-tank-lid';
    control(s, details, m, w * .19, h * .57, d * .37, w * .29);
    hose(s, details, m.dark, [[-w * .33, h * .48, 0], [-w * .4, h * .84, -.025], [w * .26, h * .86, d * .07], [w * .34, h * .57, d * .28]], .029, 'packaging-hotmelt-heated-delivery-hose');
    return;
  }
  if (item.serviceVariant === 'hot-air' || /hot-air/.test(item.id)) {
    feet(s, body, m, w * .87, d * .83);
    boxes(s, body, m.ivory, [
      [[-w * .14, h * .32, 0], [w * .6, h * .54, d * .79]],
      [[w * .25, h * .25, 0], [w * .3, h * .41, d * .65]],
    ], 'packaging-card-hot-air-cream-heat-exchanger-and-fan-base');
    const radius = Math.min(w * .18, d * .26), dx = -w * .15;
    cylinder(s, process, m.dark, radius, h * .16, [dx, h * .67, 0], radius, 'packaging-card-hot-air-black-canvas-duct-coupling');
    cylinder(s, process, m.polished, radius, h * .21, [dx, h * .855, 0], radius, 'packaging-card-hot-air-upright-silver-round-duct');
    const bands = [];
    for (const y of [h * .6, h * .74, h * .78, h * .85, h * .92]) bands.push({ position: [dx, y, 0], scale: [radius * 1.04, .025, radius * 1.04] });
    cylinders(s, details, m.steel, bands, 'packaging-card-hot-air-silver-duct-band-joints');
    s._box(process, [w * .3, h * .16, d * .29], [w * .23, h * .36, d * .2], m.yellow).name = 'packaging-card-hot-air-yellow-drive-guard';
    const cage = cylinder(s, process, m.orange, radius * .72, d * .22, [w * .23, h * .28, d * .27]); cage.rotation.x = PI / 2;
    cage.name = 'packaging-card-hot-air-orange-motor-fan-cage';
    const face = cylinder(s, details, m.dark, radius * .55, .02, [w * .23, h * .28, d * .395]); face.rotation.x = PI / 2;
    const grille = [];
    for (let i = -4; i <= 4; i++) grille.push([[w * .23 + i * radius * .1, h * .28, d * .409], [.009, radius * Math.sqrt(Math.max(0, 1 - (i * .18) ** 2)), .008]]);
    boxes(s, details, m.steel, grille, 'packaging-card-hot-air-motor-front-grille');
    const inspection = cylinder(s, details, m.dark, .07, .02, [w * .27, h * .16, d * .34]); inspection.rotation.x = PI / 2;
    rod(s, details, m.steel, [-w * .42, h * .75, -d * .15], [w * .4, h * .75, -d * .15], .035, 'packaging-card-hot-air-horizontal-instrument-pipe');
    return;
  }
  if (item.serviceVariant !== 'nitrogen' && !/nitrogen/.test(item.id)) {
    // Drawing-only ancillary controllers retain a compact neutral cabinet;
    // the nitrogen photograph must not be applied to an unrelated printer.
    frame(s, body, m, w * .75, d * .74, h * .31);
    s._box(body, [w * .84, h * .63, d * .77], [0, h * .64, 0], m.cream).name = 'packaging-drawing-ancillary-controller-enclosure';
    control(s, details, m, 0, h * .73, d * .4, Math.min(.24, w * .5));
    vents(s, details, m, 0, h * .43, -d * .4, w * .58, h * .1, 4);
    hose(s, details, m.dark, [[w * .2, h * .5, 0], [w * .35, h * .35, d * .15], [w * .32, h * .18, d * .22]], .015, 'packaging-drawing-ancillary-controller-service-lead');
    return;
  }
  // H9-M-045 stands on a folded plinth with two visible fork openings.
  s._box(body, [w*.91, h*.055, d*.87], [0, h*.028, 0], m.steel);
  boxes(s, details, m.dark, [-1,1].map(side =>
    [[side*w*.29,h*.029,d*.438],[w*.15,h*.034,.012]]
  ), 'packaging-nitrogen-plinth-openings');
  s._box(body, [w * .91, h * .93, d * .87], [0, h * .52, 0], m.cream).name = 'packaging-card-nitrogen-generator-large-white-cabinet';
  boxes(s, details, m.ivory, [
    [[-w * .226, h * .36, d * .442], [w * .439, h * .59, .018]],
    [[w * .226, h * .36, d * .442], [w * .439, h * .59, .018]],
  ], 'packaging-card-nitrogen-generator-two-lower-service-doors');
  s._box(details, [.023,h*.066,.019], [w*.045,h*.335,d*.457], m.edge).name='packaging-nitrogen-central-door-handle';
  s._box(details, [w * .56, h * .24, .02], [-w * .08, h * .76, d * .45], m.dark).name = 'packaging-card-nitrogen-generator-wide-black-gauge-panel';
  s._box(details, [.14, .04, .012], [-w * .16, h * .83, d * .467], m.red).name = 'packaging-card-nitrogen-generator-red-led-meter';
  s._box(details, [w*.075, h*.019, .012], [w*.065,h*.83,d*.467], m.steel);
  for (const x of [-w*.245,-w*.08,w*.085]) {
    const gauge = cylinder(s, details, m.steel, w*.039, .018, [x, h*.765, d*.469], w*.039, 'packaging-nitrogen-panel-gauge'); gauge.rotation.x = PI / 2;
    rod(s, details, m.dark, [x, h*.765, d*.483], [x+w*.019, h*.774, d*.483], .003);
  }
  for (const [x,material] of [[-.215,m.green],[-.08,m.red],[.055,m.red]]) {
    const button=cylinder(s,details,material,w*.017,.013,[x*w,h*.70,d*.47]);
    button.rotation.x=PI/2;
  }
  s._box(details, [w * .095, h * .18, .023], [w * .31, h * .76, d * .454], m.edge).name = 'packaging-card-nitrogen-generator-vertical-flow-meter-slot';
  s._box(details, [w * .03, h * .15, .012], [w * .31, h * .76, d * .475], m.glass);
  s._box(details,[.006,h*.89,.009],[0,h*.52,-d*.439],m.edge).name='packaging-nitrogen-rear-door-seam';
  const louvers=[];
  for (const offset of [-.30,-.19,.12,.23]) {
    for (let row=0; row<7; row++) {
      const y=h*(.11+row*.011);
      louvers.push([[offset*w,y,-d*.44],[w*.09,h*.004,.012]]);
      louvers.push([[w*.459,y,offset*d],[.012,h*.004,d*.09]]);
    }
  }
  boxes(s,details,m.edge,louvers,'packaging-nitrogen-lower-louver-banks');
}

// Plates, guards and loose services that the 2026-11-24 cards repeat on each
// machine. Everything stays inside the drawn installation envelope.
function coil(s, parent, material, from, to, radius, turns, tube, name) {
  const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), points = [];
  for (let i = 0; i <= turns * 8; i++) { const t = i / (turns * 8), p = a.clone().lerp(b, t); points.push([p.x + Math.cos(t * turns * PI * 2) * radius, p.y, p.z + Math.sin(t * turns * PI * 2) * radius]); }
  return hose(s, parent, material, points, tube, name);
}
function clampRing(s, parent, m, x, y, z, radius) {
  const ring = s._mesh(new THREE.TorusGeometry(radius, .014, 6, 32), m.polished, parent, [x, y, z]); ring.rotation.x = PI / 2; ring.name = 'packaging-card-cone-clamp-ring';
}
const CARD_FINISH = {
  'packaging-xray'(s, [, , details], item, m) {
    const w = item.width, d = item.depth, h = item.height, card = Number(item.historyCardNumber), ventFront = card === 25 || card === 26;
    if (!card || item.kind === 'metal-detector') return;
    const cw = w * .51, cd = d * .83, top = h * .94, openingTop = h * .41 + h * .145, sign = ventFront ? -1 : 1, monitorY = (openingTop + top) / 2, monitorH = (top - openingTop) * .74;
    const front = s._group(details, [0, 0, sign * (cd / 2 + .03)]); front.rotation.y = sign < 0 ? PI : 0; front.name = 'packaging-card-xray-operator-face-plates';
    textPlate(s, front, 'OK', { width: cw * .62, height: monitorH * .56, position: [-cw * .02, monitorY + .03, .049], background: '#dfe5e8', color: '#2f86cc', top: '#2f86cc', scale: .4, name: 'packaging-card-xray-light-inspection-window' });
    const lamp = m.redLamp ||= s._material(0xd8463a, .4, .05, { emissive: 0xe0392c, emissiveIntensity: .7 });
    s._box(front, [.13, .028, .006], [cw * .02, monitorY - monitorH * .4, .047], lamp).name = 'packaging-card-xray-on-lamp';
    textPlate(s, front, item.name.replace('X-Ray ', 'X-Ray|').replace(/ · .*/, ''), { width: .2, height: .12, position: [-cw * .24, openingTop + .05, .05], top: '#2d5aa5', bottom: '#8fc04a' });
    for (const side of [-1, 1]) {
      const end = s._group(details, [side * (cw / 2 + .02), 0, 0]); end.rotation.y = side * PI / 2;
      textPlate(s, end, 'CCP-2P-1|관계자외 조작금지', { width: cd * .46, height: .13, position: [0, h * .68, .024], color: '#b3312b', top: '#2d5aa5', bottom: '#8fc04a' });
    }
    if (card === 25) { const end = s._group(details, [cw / 2 + .022, 0, 0]); end.rotation.y = PI / 2; textPlate(s, end, 'HALAL', { width: cd * .34, height: .15, position: [0, h * .75, .03], color: '#2f8a5a', top: '#2d5aa5' }); }
  },
  'packaging-vertical-packer'(s, [body, process, details], item, m) {
    const w = item.width, d = item.depth, h = item.height, cw = w * .53, cd = d * .63, mainTop = h * .6, front = cd / 2 + .035;
    s._box(details, [cw * .74, .25, .13], [cw * .07, .4, front + .07], m.orange).name = 'packaging-card-vertical-orange-front-drawer';
    const badge = cylinder(s, details, m.ivory, .075, .008, [cw * .07, .4, front + .139]); badge.rotation.x = PI / 2; badge.scale.set(1.35, 1, .7);
    s._box(details, [cw * .13, .13, .012], [-cw * .39, mainTop * .83, front + .068], m.screen);
    const stop = cylinder(s, details, m.red, .03, .03, [-cw * .39, mainTop * .3, front + .075]); stop.rotation.x = PI / 2;
    const side = s._group(details, [-cw / 2 - .046, 0, 0]); side.rotation.y = -PI / 2;
    textPlate(s, side, '버티컬 2호기|포장기', { width: .42, height: .17, position: [cd * .1, mainTop * .86, 0], top: '#3f9a4f', bottom: '#2d5aa5' });
    textPlate(s, side, '손 끼임 주의', { width: .34, height: .12, position: [cd * .1, mainTop * .64, 0], color: '#b3262a', bottom: '#2d5aa5' });
    s._box(side, [cd * .52, mainTop * .34, .006], [-cd * .08, mainTop * .36, .004], m.film).name = 'packaging-card-vertical-side-notice-sheet';
    boxes(s, side, m.edge, [[[cd * .2, mainTop * .5, .012], [.03, .1, .02]], [[-cd * .3, mainTop * .5, .012], [.03, .1, .02]]], 'packaging-card-vertical-side-door-latches');
    // Printed yellow film roll on two arms at the back.
    const z = -(cd / 2 + Math.min(.2, d * .5 - cd / 2 - .13)), roll = cylinder(s, process, m.yellow, .12, cw * .62, [0, .55, z]); roll.rotation.z = PI / 2; roll.name = 'packaging-card-vertical-rear-printed-film-roll';
    boxes(s, body, m.ivory, [-cw * .38, cw * .38].map(x => [[x, .55, z + cd * .16], [.04, .16, cd * .5]]), 'packaging-card-vertical-film-roll-arms');
    cylinders(s, process, m.carton, [-.2, 0, .2].map(x => ({ position: [x * cw, .55, z], scale: [.1215, .05, .1215], rotation: [0, 0, PI / 2] })), 'packaging-card-vertical-film-print-bands', 24);
    const legs = [];
    for (const sx of [-1, 1]) for (const [y, zz, dd] of [[.18, .15, d * .4], [.42, -.12, d * .2]]) for (const dx of [-1, 1]) for (const dz of [-1, 1]) legs.push([[sx * w * .37 + dx * w * .09, y / 2, zz + dz * dd * .43], [.025, y, .025]]);
    boxes(s, body, m.edge, legs, 'packaging-card-vertical-step-legs');
    s._box(process, [.22, .18, .2], [0, h * .87, 0], m.film).name = 'packaging-card-vertical-white-auger-drive-box';
    cylinder(s, process, m.dark, .06, h * .06, [0, h * .95, 0], .06, 'packaging-card-vertical-black-servo-motor');
    clampRing(s, process, m, 0, h * .85, 0, cw * .225); clampRing(s, process, m, 0, h * .72, 0, cw * .165);
    coil(s, details, m.yellow, [-cw * .4, mainTop * .9, -cd * .42], [-cw * .42, .5, -cd * .46], .035, 11, .009, 'packaging-card-vertical-yellow-coiled-air-hose');
  },
  'packaging-rotary-packer'(s, [body, process, details], item, m) {
    const w = item.width, d = item.depth, h = item.height, one = item.rotaryVariant === 'orange-guard' || /rotary-1$/.test(item.id);
    if (one) {
      const r = Math.min(w, d) * .31, tableY = h * .31, face = d * .432, feedX = -w * .1, feedZ = -d * .06;
      textPlate(s, details, 'JUPACK', { width: .34, height: .12, position: [-w * .23, h * .645, face], background: '#df5a2c', color: '#fff6ee' });
      boxes(s, details, m.edge, [[[0, h * .63, face], [.008, h * .17, .004]], [[0, h * .545, face], [w * .83, .012, .006]]], 'packaging-card-rotary-one-header-seams');
      s._box(details, [.2, .1, .006], [w * .2, h * .665, d * .44 + .066], m.green).name = 'packaging-card-rotary-one-green-hmi-page';
      cylinders(s, details, m.red, [0, 1, 2].map(i => ({ position: [w * .33 + i * .05, h * .6, face + .01], scale: [.016, .02, .016], rotation: [PI / 2, 0, 0] })), 'packaging-card-rotary-one-header-button');
      const belt = m.beltBlue ||= s._material(0x2f74b5, .55, .05);
      s._box(process, [.3, .03, d * .3], [-w * .16, tableY - .1, d * .35], belt).name = 'packaging-card-rotary-one-blue-pouch-belt';
      s._box(process, [.07, .034, d * .3], [-w * .13, tableY - .1, d * .35], m.carton); boxes(s, body, m.polished, [[[-w * .16 - .17, tableY - .1, d * .35], [.03, .08, d * .3]], [[-w * .16 + .17, tableY - .1, d * .35], [.03, .08, d * .3]]], 'packaging-card-rotary-one-belt-rails');
      const left = s._group(details, [-w * .425, 0, 0]); left.rotation.y = -PI / 2;
      textPlate(s, left, '380V', { width: .16, height: .07, position: [d * .22, h * .6, .01] });
      s._box(left, [.22, .34, .1], [d * .1, h * .42, .02], m.polished).name = 'packaging-card-rotary-one-air-service-panel';
      cylinders(s, left, m.blue, [-.06, 0, .06].map(x => ({ position: [d * .1 + x, h * .39, .085], scale: [.022, .1, .022] })), 'packaging-card-rotary-one-air-regulators');
      coil(s, details, m.blue, [-w * .45, h * .36, -d * .1], [-w * .45, .12, -d * .1], .04, 9, .01, 'packaging-card-rotary-one-blue-coiled-hose');
      hose(s, details, m.orange, [[w * .36, h * .42, -d * .3], [w * .44, h * .4, -d * .28], [w * .45, h * .2, -d * .26], [w * .42, .1, -d * .34]], .035, 'packaging-card-rotary-one-orange-vacuum-hose');
      clampRing(s, process, m, feedX, h * .87, feedZ, r * .475); clampRing(s, process, m, feedX, h * .5525, feedZ, r * .355);
      boxes(s, details, m.dark, [-w * .28, w * .28].map(x => [[x, h * .12, d * .423], [.02, .07, .012]]), 'packaging-card-rotary-one-recessed-door-pulls');
    } else {
      const deck = h * .29, feedX = -w * .08, feedZ = -d * .05;
      textPlate(s, process, 'GREENPACK', { width: .22, height: .07, position: [feedX, h * .74, feedZ + .08], background: '#2f8a4d', color: '#ffffff' });
      s._box(details, [.26, .3, .15], [feedX, h * .41, feedZ + .2], m.film).name = 'packaging-card-rotary-two-white-terminal-box';
      textPlate(s, details, '감전 주의', { width: .18, height: .1, position: [feedX, h * .42, feedZ + .277], color: '#1d2b3c', background: '#f2c800', bottom: '#2d5aa5' });
      const bw = w * .65, bd = d * .64;
      textPlate(s, details, '끼임 주의', { width: .2, height: .13, position: [-bw * .3, deck + h * .13, bd * .455], color: '#b3262a', bottom: '#2d5aa5' });
      textPlate(s, details, '손 조심', { width: .2, height: .1, position: [bw * .12, deck + h * .13, bd * .455], color: '#1d2b3c', background: '#f2c800' });
      const cart = s._group(body, [w * .4, 0, d * .34]); cart.name = 'packaging-card-rotary-two-clear-drum-cart';
      s._box(cart, [.3, .6, .28], [0, .36, 0], m.polished); cylinders(s, cart, m.dark, [-.12, .12].flatMap(x => [-.11, .11].map(z => ({ position: [x, .03, z], scale: [.03, .06, .03] }))), 'packaging-card-rotary-two-cart-wheels');
      cylinder(s, cart, m.glass, .125, .24, [0, .78, 0]); cylinder(s, cart, m.film, .13, .02, [0, .91, 0]);
      coil(s, details, m.blue, [w * .31, deck * .95, -bd * .42], [w * .33, .12, -bd * .44], .05, 10, .011, 'packaging-card-rotary-two-blue-coiled-hose');
      hose(s, details, m.yellow, [[-bw * .2, deck + .05, bd * .3], [-bw * .3, deck + .2, bd * .2], [-bw * .05, deck + .26, bd * .1], [feedX, deck + .16, feedZ]], .012, 'packaging-card-rotary-two-yellow-air-tube');
      clampRing(s, process, m, feedX, h * .965, feedZ, w * .118); clampRing(s, process, m, feedX, h * .56, feedZ, w * .088);
    }
  },
  'packaging-bag-filler'(s, [body, process, details], item, m) {
    const w = item.width, d = item.depth, h = item.height, x = -w * .12, radius = Math.min(w * .14, d * .18);
    textPlate(s, process, 'GREENPACK', { width: h * .18, height: .075, position: [x, h * .71, radius * .3 + .012], rotation: [0, 0, PI / 2], background: '#2f8a4d', color: '#ffffff' });
    s._box(details, [.22, .26, .15], [x - w * .2, h * .37, d * .05], m.film).name = 'packaging-card-bag-filler-left-terminal-box';
    rod(s, details, m.steel, [x - w * .2, .12, d * .05], [x - w * .2, h * .33, d * .05], .022, 'packaging-card-bag-filler-terminal-box-post');
    const panel = s._group(details, [w * .24, 0, d * .15]);
    textPlate(s, panel, '주의', { width: .16, height: .1, position: [0, h * .46, .008], background: '#f2c800' }); s._box(panel, [.2, .26, .004], [0, h * .34, .006], m.film);
    boxes(s, panel, m.edge, [[[w * .07, h * .28, .01], [.02, .1, .02]]], 'packaging-card-bag-filler-collector-latch');
    const wrap = m.wrapFilm ||= s._material(0xe9eef0, .3, .02, { transparent: true, opacity: .3, depthWrite: false, side: THREE.DoubleSide });
    cylinder(s, details, wrap, radius * .62, h * .2, [x, h * .27, -d * .05], radius * .95, 'packaging-card-bag-filler-plastic-dust-wrap').castShadow = false;
    clampRing(s, process, m, x, h * .96, 0, radius * 1.02); clampRing(s, process, m, x, h * .61, 0, radius * .85);
    s._box(body, [w * .3, .05, d * .24], [w * .22, .3, d * .36], m.belt).name = 'packaging-card-bag-filler-green-outfeed-belt'; boxes(s, body, m.ivory, [[[w * .22, .26, d * .245], [w * .3, .1, .03]], [[w * .22, .26, d * .475], [w * .3, .1, .03]], [[w * .1, .11, d * .36], [.05, .22, d * .2]], [[w * .34, .11, d * .36], [.05, .22, d * .2]]], 'packaging-card-bag-filler-outfeed-frame');
    s._box(details, [w * .1, .1, d * .12], [w * .16, h * .52, d * .05], m.yellow).name = 'packaging-card-bag-filler-yellow-belt-cover';
  },
  'packaging-stick-filler'(s, [, , details], item, m) {
    const w = item.width, d = item.depth, h = item.height, line = item.lineNumber || Number(item.id.match(/stick-(\d+)$/)?.[1]) || 1;
    const flip = item.operatorSide === 'left' ? -1 : 1, bodyW = w * .8, cx = -w * .08 * flip, mainTop = h * 2 / 2.9, panelX = w * .39;
    const face = s._group(details); face.name = 'packaging-card-stick-door-plates';
    if (line >= 5) { face.position.set((panelX + .034) * flip, 0, -d * .03); face.rotation.y = flip * PI / 2; }
    else { face.position.set(cx, 0, -d * .42 - .002); face.rotation.y = PI; }
    const span = line >= 5 ? d * .76 : bodyW * .86, dir = line >= 5 ? flip : 1;
    textPlate(s, face, `스틱 ${line}호기`, { width: .34, height: .17, position: [-span * .26 * dir, mainTop * .84, .008], top: '#1f2d3d', border: '#1f2d3d' });
    textPlate(s, face, '추락 주의|감전 주의', { width: .3, height: .22, position: [span * .2 * dir, mainTop * .84, .008], color: '#1d2b3c', background: '#f2c800', bottom: '#2d5aa5' });
    if (line < 5) {
      s._box(face, [.34, .24, .03], [span * .22 * dir, mainTop * .52, .02], m.blue).name = 'packaging-card-stick-blue-framed-tablet'; s._box(face, [.28, .18, .008], [span * .22 * dir, mainTop * .52, .038], m.screen);
    }
    coil(s, details, m.orange, [cx - bodyW * .42 * flip, mainTop * .62, d * .2], [cx - bodyW * .42 * flip, .3, d * .24], .03, 9, .009, 'packaging-card-stick-orange-coiled-hose');
  },
  'packaging-robot'(s, [body, process, details], item, m) {
    const w = item.width, d = item.depth, h = item.height, unit = Math.min(w, d);
    if (item.robotVariant === 'case-palletizer' || /robot-[45]$/.test(item.id)) {
      if (item.robotIndex === 4 || /robot-4$/.test(item.id)) s._box(body, [w * .4, h * .26, d * .4], [0, h * .18, 0], m.blue).name = 'packaging-card-case-palletizer-four-solid-blue-pedestal';
      return;
    }
    for (const side of [1]) textPlate(s, process, 'ABB', { width: unit * .16, height: unit * .075, position: [0, h * .875, side * unit * .178], rotation: [0, side < 0 ? PI : 0, 0], flat: true, color: '#d8232a' });
  },
  'packaging-checkweigher'(s, [, , details], item, m) {
    const label = item.name.replace(/ · .*/, '');
    if (label.startsWith('박스')) return;
    textPlate(s, details, label.replace(/(중량선별기) ?/, '$1|'), { width: .2, height: .12, position: [0, item.height * .47, item.depth * .445], top: '#2d5aa5', bottom: '#8fc04a' });
  },
};

export function buildPackagingLineEquipment(s, root, item) {
  if (item.type === 'packaging-hopper' && item.drumHeight) { buildAgitatorHopper(s, root, item); return true; }
  const builders = {
    'packaging-rotary-packer': rotary,
    'packaging-vertical-packer': (s, groups, item, m) => formingPacker(s, groups, item, m, false),
    'packaging-stick-filler': stickFiller,
    'packaging-bag-filler': bagFiller,
    'packaging-checkweigher': (s, groups, item, m) => inspection(s, groups, item, m, 'checkweigher'),
    'packaging-xray': (s, groups, item, m) => inspection(s, groups, item, m, 'xray'),
    'packaging-metal-detector': (s, groups, item, m) => inspection(s, groups, item, m, 'metal-detector'),
    'packaging-case-sealer': (s, groups, item, m) => sealer(s, groups, item, m, false),
    'packaging-carton-erector': (s, groups, item, m) => sealer(s, groups, item, m, true),
    'packaging-robot': robot, 'packaging-v-mixer': vMixer, 'packaging-hopper': hopper,
    'packaging-service-cabinet': serviceCabinet,
    'packaging-conveyor': (s, [body, process, details], item, m) => {
      belt(s, body, process, m, item.width, item.depth, item.height * .82, item.depth > item.width * 1.4, true);
      const motor = cylinder(s, details, m.blue, Math.min(.12, item.width * .15), .2, [item.width * .3, item.height * .6, -item.depth * .4]);
      motor.rotation.x = PI / 2; motor.name = 'packaging-conveyor-external-drive';
    },
  };
  const builder = builders[item.type];
  if (!builder) return false;
  const groups = assembly(s, root, item), m = materials(s);
  builder(s, groups, item, m);
  CARD_FINISH[item.type]?.(s, groups, item, m);
  return true;
}
