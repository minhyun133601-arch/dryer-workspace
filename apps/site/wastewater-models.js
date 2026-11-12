import * as THREE from '../shared/vendor/three.module.js';
import { WASTEWATER_DRAWING, WASTEWATER_LAYOUT as L } from './wastewater-data.js';

const UP = new THREE.Vector3(0, 1, 0), PI = Math.PI;
function equipmentTools(s, inherited) {
  const m = s.wastewaterMaterials ||= {
    concrete: inherited.concrete || s._material(0xb9c0b5, .94, .03),
    wall: inherited.white || s._material(0xe2e5db, .84, .04),
    steel: inherited.steel || s._material(0xa8b9b5, .37, .7),
    dark: inherited.dark || s._material(0x283d3c, .76, .13),
    roof: inherited.blueRoof || s._material(0x4e91ac, .65, .24),
    green: inherited.greenRoof || s._material(0x689584, .75, .08),
    blue: s._material(0x367eab, .55, .3), yellow: s._material(0xe0bd54, .6, .2),
    ochre: s._material(0xa68c57, .94, .02), cream: s._material(0xe0dac0, .75, .06),
    red: s._material(0xb86254, .7, .13),
    water: s._material(0x528b85, .27, .16, { transparent: true, opacity: .7, side: THREE.DoubleSide, depthWrite: false }),
    cleanWater: s._material(0x7aa9a2, .27, .15, { transparent: true, opacity: .68, side: THREE.DoubleSide, depthWrite: false }),
    sludge: s._material(0x8f8566, .84, .02, { transparent: true, opacity: .8, side: THREE.DoubleSide }),
  };
  const cache = s.wastewaterGeometry ||= new Map();
  const geo = (key, create) => { if (!cache.has(key)) { const g = create(); cache.set(key, g); s.geometries?.add(g); } return cache.get(key); };
  const mesh = (parent, geometry, p = [0, 0, 0], paint = 'steel') => s._mesh(geometry, m[paint] || paint, parent, p);
  const box = (parent, size, p, paint = 'steel') => { const o = mesh(parent, geo('box', () => new THREE.BoxGeometry(1, 1, 1)), p, paint); o.scale.set(...size); return o; };
  const cyl = (parent, r, h, p, paint = 'steel', axis = 'y', bottom = r) => {
    const o = mesh(parent, geo(`cyl:${bottom / r}`, () => new THREE.CylinderGeometry(1, bottom / r, 1, 32)), p, paint); o.scale.set(r, h, r);
    if (axis === 'x') o.rotation.z = PI / 2; if (axis === 'z') o.rotation.x = PI / 2; return o;
  };
  const bar = (parent, a, b, r = .035, paint = 'steel') => { const from = new THREE.Vector3(...a), to = new THREE.Vector3(...b), d = to.clone().sub(from); const o = cyl(parent, r, d.length(), from.add(to).multiplyScalar(.5).toArray(), paint); o.quaternion.setFromUnitVectors(UP, d.normalize()); return o; };
  const pipe = (parent, points, r = .07, paint = 'blue') => { const g = s._group(parent); for (let i = 1; i < points.length; i++) bar(g, points[i - 1], points[i], r, paint); g.name = 'wastewater-schematic-pipe-route'; g.userData.schematicRoute = true; return g; };
  const ring = (parent, r, tube, p, paint = 'steel', axis = 'y') => { const o = mesh(parent, geo(`ring:${r}:${tube}`, () => new THREE.TorusGeometry(r, tube, 6, 48)), p, paint); if (axis === 'y') o.rotation.x = PI / 2; return o; };
  const boxes = (parent, entries, paint = 'steel', name = 'wastewater-repeated-detail') => {
    if (!entries.length) return;
    const o = new THREE.InstancedMesh(geo('box', () => new THREE.BoxGeometry(1, 1, 1)), m[paint] || paint, entries.length), d = new THREE.Object3D();
    entries.forEach(([p, size, rotation = [0, 0, 0]], i) => { d.position.set(...p); d.scale.set(...size); d.rotation.set(...rotation); d.updateMatrix(); o.setMatrixAt(i, d.matrix); });
    o.instanceMatrix.needsUpdate = true; o.castShadow = o.receiveShadow = true; o.name = name; o.computeBoundingBox(); o.computeBoundingSphere(); parent.add(o); return o;
  };
  return { m, geo, mesh, box, cyl, bar, pipe, ring, boxes };
}

function rail(parent, a, b, t, height = 1.05, paint = 'yellow') {
  const length = Math.hypot(b[0] - a[0], b[2] - a[2]), n = Math.max(1, Math.ceil(length / 1.8));
  for (let i = 0; i <= n; i++) { const p = [a[0] + (b[0] - a[0]) * i / n, a[1], a[2] + (b[2] - a[2]) * i / n]; t.bar(parent, p, [p[0], p[1] + height, p[2]], .035, paint); }
  for (const y of [height * .5, height]) t.bar(parent, [a[0], a[1] + y, a[2]], [b[0], b[1] + y, b[2]], .025, paint);
}
function stair(s, parent, { x, z, width, rise, run, count, direction = 1 }, t) {
  const g = s._group(parent, [x, 0, z]); g.name = 'wastewater-filter-press-external-stair';
  const entries = [];
  for (let i = 0; i < count; i++) entries.push([[0, (i + 1) * rise / count, direction * (i + .5) * run / count], [width, .08, run / count + .03]]);
  t.boxes(g, entries, 'steel', 'wastewater-open-stair-treads');
  for (const sign of [-1, 1]) {
    t.bar(g, [sign * width / 2, .08, 0], [sign * width / 2, rise, direction * run], .06);
    rail(g, [sign * width / 2, .1, 0], [sign * width / 2, rise, direction * run], t);
  }
}
function rectangularTank(s, parent, tank, t, waterPaint = 'water') {
  const g = s._group(parent, [tank.x, 0, tank.z]); g.name = `wastewater-${tank.name || `aeration-${tank.id}`}`;
  Object.assign(g.userData, { processUnit: tank.name || `aeration-${tank.id}`, basinId: tank.name || `aeration-${tank.id}`, drawingVolumeCubicMetres: tank.volume, capacity: tank.volume, effectiveDepth: tank.name ? tank.rim - tank.floor : WASTEWATER_DRAWING.existing.aerationDepth, underground: true });
  const { width: w, depth: d, floor: bottom, rim: top } = tank, h = top - bottom, wall = tank.wall || .3;
  t.box(g, [w + wall * 2, .25, d + wall * 2], [0, bottom - .125, 0], 'concrete').name = 'wastewater-tank-floor';
  t.boxes(g, [
    [[-(w + wall) / 2, (bottom + top) / 2, 0], [wall, h, d + wall * 2]],
    ...tank.sharedRightWall ? [] : [[[(w + wall) / 2, (bottom + top) / 2, 0], [wall, h, d + wall * 2]]],
    [[0, (bottom + top) / 2, -(d + wall) / 2], [w, h, wall]],
  ], 'concrete', 'wastewater-underground-concrete-walls');
  const front = t.box(g, [w, h, wall], [0, (bottom + top) / 2, (d + wall) / 2], 'concrete');
  front.name = 'wastewater-front-wall-cutaway'; front.userData.campusInteriorCover = true;
  const level = tank.waterLevel ?? top - .55;
  t.box(g, [w - .03, .035, d - .03], [0, level, 0], waterPaint).name = 'wastewater-static-water-level';
  t.boxes(g, [
    [[-(w + wall) / 2, top + .04, 0], [wall + .12, .12, d + wall * 2 + .12]],
    ...tank.sharedRightWall ? [] : [[[(w + wall) / 2, top + .04, 0], [wall + .12, .12, d + wall * 2 + .12]]],
    [[0, top + .04, -(d + wall) / 2], [w, .12, wall + .12]], [[0, top + .04, (d + wall) / 2], [w, .12, wall + .12]],
  ], 'wall', 'wastewater-tank-rim');
  return g;
}
function aeration(s, units, tank, t) {
  const g = rectangularTank(s, units, tank, t), floor = tank.floor + .25;
  const manifold = s._group(g); manifold.name = 'wastewater-air-manifold-and-diffusers';
  t.pipe(manifold, [[-tank.width / 2 + .35, .75, -tank.depth / 2 + .3], [-tank.width / 2 + .35, floor, -tank.depth / 2 + .3], [tank.width / 2 - .4, floor, -tank.depth / 2 + .3]], .045);
  const diffusers = [];
  for (let x = -tank.width / 2 + .65; x < tank.width / 2 - .2; x += .85) {
    t.pipe(manifold, [[x, floor, -tank.depth / 2 + .3], [x, floor, tank.depth / 2 - .35]], .025);
    for (let z = -tank.depth / 2 + .8; z < tank.depth / 2 - .25; z += .8) diffusers.push([[x, floor + .07, z], [.45, .06, .18]]);
  }
  t.boxes(manifold, diffusers, 'dark', 'wastewater-schematic-submerged-diffusers');
  // Static surface streaks communicate aeration without implying live readings.
  const surface = [];
  for (let x = -tank.width / 2 + .8; x < tank.width / 2 - .4; x += 1.1) for (let z = -tank.depth / 2 + .8; z < tank.depth / 2 - .4; z += 1.3) surface.push([[x, tank.rim - .51, z], [.35, .014, .045]]);
  t.boxes(g, surface, 'cleanWater', 'wastewater-static-aeration-surface-streaks');
  return g;
}
function mixer(s, parent, position, t) {
  const g = s._group(parent, position); g.name = 'wastewater-top-mounted-mixer';
  t.box(g, [.62, .11, .7], [0, .08, 0], 'steel'); t.cyl(g, .17, .38, [0, .33, 0], 'blue'); t.cyl(g, .22, .11, [0, .58, 0], 'dark');
  t.bar(g, [0, .05, 0], [0, -1.1, 0], .028); t.box(g, [.7, .09, .16], [0, -.95, 0], 'steel');
}
function chemicalTank(s, parent, { id, x, z, radius, height, base = 2.25, paint = 'cream', volume }, t) {
  const g = s._group(parent, [x, base, z]); g.name = `wastewater-chemical-${id}`; Object.assign(g.userData, { processUnit: id, drawingVolumeCubicMetres: volume });
  t.box(g, [radius * 2 + .25, .12, radius * 2 + .25], [0, .06, 0], 'concrete');
  t.cyl(g, radius, height - .2, [0, height / 2, 0], paint); t.cyl(g, radius, .2, [0, height - .06, 0], paint, 'y', radius * .85);
  t.ring(g, radius + .015, .018, [0, .3, 0]); t.ring(g, radius + .015, .018, [0, height - .23, 0]); t.cyl(g, .16, .08, [0, height + .08, 0], 'dark');
  t.pipe(g, [[radius * .7, .25, 0], [radius + .22, .25, 0], [radius + .22, -.1, .5]], .025, 'blue');
}
function blower(s, parent, x, y, z, t, roots = false) {
  const g = s._group(parent, [x, y, z]); g.name = roots ? 'wastewater-roots-blower' : 'wastewater-turbo-blower';
  t.box(g, [1, .12, 1.15], [0, .06, 0], 'dark');
  if (roots) { t.box(g, [.7, .53, .7], [0, .42, -.1], 'blue'); t.cyl(g, .24, .65, [0, .38, .55], 'blue', 'x'); t.cyl(g, .13, .6, [0, .86, -.1], 'steel'); }
  else { t.box(g, [.85, 1.35, .95], [0, .79, 0], 'cream'); t.box(g, [.62, .65, .04], [0, .99, .49], 'dark'); t.ring(g, .2, .027, [0, .94, .53], 'steel', 'z'); t.box(g, [.32, .2, .025], [0, 1.35, .52], 'blue'); }
  return g;
}

function oldTreatment(s, shell, covers, units, t) {
  for (const tank of L.existingAeration) aeration(s, units, tank, t);
  const eq = L.equalization;
  rectangularTank(s, units, { ...eq, name: 'equalization', floor: eq.bottom, volume: 102, waterLevel: -2.1 }, t);
  // Upper clarifier over the equalization basin follows the section drawing.
  const c = L.clarifier, basin = s._group(units, [c.x, 0, c.z]); basin.name = 'wastewater-clarifier'; basin.userData.processUnit = 'clarifier'; basin.userData.drawingVolumeCubicMetres = c.volume;
  const profile = [[c.radius - .2, c.bottom], [c.radius, c.bottom], [c.radius, c.rim], [c.radius - .2, c.rim], [c.radius - .2, c.bottom]];
  t.mesh(basin, t.geo('clarifier-ring-wall', () => new THREE.LatheGeometry(profile.map(p => new THREE.Vector2(...p)), 64)), [0, 0, 0], 'concrete');
  t.cyl(basin, c.radius - .2, .12, [0, c.bottom, 0], 'concrete'); t.cyl(basin, c.radius - .22, .025, [0, c.rim - .32, 0], 'water');
  t.ring(basin, c.radius, .08, [0, c.rim + .03, 0], 'wall');
  t.box(basin, [c.radius * 2 + .2, .13, .62], [0, c.rim + .12, 0], 'steel');
  for (const side of [-1, 1]) rail(basin, [-c.radius, c.rim + .2, side * .32], [c.radius, c.rim + .2, side * .32], t, .95, 'steel');
  t.cyl(basin, .2, .46, [0, c.rim + .42, 0], 'blue'); t.bar(basin, [0, c.rim + .18, 0], [0, c.bottom + .18, 0], .07); t.bar(basin, [-2.1, c.bottom + .18, 0], [2.1, c.bottom + .18, 0], .055);
  // Three serial small basins with separate top drives.
  ['reaction', 'neutralization', 'coagulation'].forEach((name, i) => {
    const z = -.8 + i * 1.9;
    rectangularTank(s, units, { x: -3.85, z, width: 1.4, depth: 1.5, floor: .35, rim: 2.05, volume: 3.3, name, wall: .18 }, t);
    mixer(s, units, [-3.85, 2.16, z], t);
  });
  rectangularTank(s, units, { x: -7.8, z: -4.65, width: 5.2, depth: 1.4, floor: -1.5, rim: 2.05, name: 'discharge', volume: 3.3 }, t, 'cleanWater');
  rectangularTank(s, units, { x: -3.4, z: 5.2, width: 2.15, depth: 2.3, floor: -3.6, rim: .3, name: 'sludge-storage', volume: 18 }, t, 'sludge');
  rectangularTank(s, units, { x: -1, z: 5.2, width: 1.35, depth: 1.4, floor: -2.6, rim: .3, name: 'sump', volume: 5 }, t);
  // Upper slab only across the chemical bay: no solid box across open tanks.
  t.box(shell, [3.15, .22, 9.9], [-1.65, 2.15, -1.1], 'concrete').name = 'wastewater-chemical-working-deck';
  for (const x of [-2.9, -.4]) for (const z of [-5.7, 3.6]) t.box(shell, [.22, 2.25, .22], [x, 1.05, z], 'concrete');
  chemicalTank(s, units, { id: 'alum-5m3', x: -1.65, z: -4.65, radius: .8, height: 2.5, volume: 5 }, t);
  chemicalTank(s, units, { id: 'caustic-5m3', x: -1.65, z: 2.2, radius: .8, height: 2.5, volume: 5 }, t);
  chemicalTank(s, units, { id: 'coagulant-dissolving-1m3', x: -1.65, z: -2.4, radius: .48, height: 1.4, volume: 1, paint: 'wall' }, t);
  chemicalTank(s, units, { id: 'aluminum-sulfate-1m3', x: -1.65, z: -.65, radius: .48, height: 1.4, volume: 1, paint: 'wall' }, t);
  chemicalTank(s, units, { id: 'ferric-1m3', x: -.65, z: -2.5, radius: .32, height: 1.5, volume: 1, paint: 'red' }, t);
  // Tank-top office / blower room: roof and visible outer panel remove on inspect.
  const hut = s._group(shell, [-12.8, .45, -1.3]); hut.name = 'wastewater-office-blower-room';
  t.box(hut, [2.4, .15, 6.6], [0, .1, 0], 'concrete');
  t.boxes(hut, [[[0, 1.42, -3.25], [2.4, 2.65, .12]], [[-1.14, 1.42, 0], [.12, 2.65, 6.5]], [[0, 1.42, -.8], [2.4, 2.65, .12]]], 'wall');
  t.box(hut, [1.4, .85, .04], [0, 1.65, -3.33], 'dark');
  const panel = s._group(covers); panel.name = 'wastewater-office-blower-roof-and-front'; panel.userData.campusInteriorCover = true;
  t.box(panel, [2.65, .18, 6.9], [-12.8, 3.3, -1.3], 'green'); t.box(panel, [.12, 2.65, 6.5], [-11.6, 1.87, -1.3], 'wall');
  t.box(panel, [.025, 1.9, .85], [-11.52, 1.52, -3.4], 'dark');
  blower(s, hut, -.1, .2, .4, t); blower(s, hut, -.1, .2, 2.1, t);
  t.box(hut, [1.55, .1, .75], [0, .9, -2.35], 'steel');
  // Aluminous coagulant reservoir is shown separately beside the old tanks.
  chemicalTank(s, units, { id: 'liquid-alum-5m3', x: -19.1, z: -3.95, radius: .9, height: 2.05, base: .35, volume: 5 }, t);
  for (const z of [-6.3, 6.7]) rail(shell, [-10.5, .42, z], [-.2, .42, z], t);
}

function dewatering(s, shell, covers, units, t) {
  const g = s._group(units, [2.6, 0, -.1]); g.name = 'wastewater-filter-press-and-sludge-conditioning';
  const frame = s._group(shell, [2.6, 0, -.1]); frame.name = 'wastewater-filter-press-steel-platform';
  t.box(frame, [3.25, .18, 4.5], [0, .12, 0], 'concrete'); t.box(frame, [3.25, .15, 4.5], [0, 2.6, 0], 'steel');
  for (const x of [-1.5, 1.5]) for (const z of [-2.1, 2.1]) t.box(frame, [.12, 5.6, .12], [x, 2.9, z], 'steel');
  // Lower opening receives the cake discharged by the upper filter pack.
  t.box(g, [1.9, .15, 2.7], [0, .32, .3], 'dark'); t.box(g, [1.4, .65, 2.1], [0, .7, .3], 'ochre');
  const press = s._group(g, [0, 2.8, 0]); press.name = 'wastewater-filter-press-30000L-per-cycle'; press.userData.drawingThroughputLitresPerCycle = 30000;
  for (const x of [-.8, .8]) t.box(press, [.1, .12, 3.8], [x, .75, 0], 'steel');
  t.box(press, [1.65, 1.3, .22], [0, .8, -1.7], 'blue'); t.box(press, [1.65, 1.3, .22], [0, .8, 1.35], 'blue');
  t.boxes(press, Array.from({ length: 17 }, (_, i) => [[0, .78, -1.35 + i * .145], [1.4, 1.13, .075]]), 'cream', 'wastewater-filter-press-plate-pack');
  t.cyl(press, .18, .65, [0, .8, 1.8], 'blue', 'z'); t.bar(press, [0, .8, 1.4], [0, .8, 2.1], .06);
  const roof = s._group(covers); roof.name = 'wastewater-filter-press-gable-cover'; roof.userData.campusInteriorCover = true;
  const shape = new THREE.Shape(); shape.moveTo(-1.75, 0); shape.lineTo(1.75, 0); shape.lineTo(0, .7); shape.closePath();
  const geom = new THREE.ExtrudeGeometry(shape, { depth: 4.8, bevelEnabled: false }); geom.translate(0, 0, -2.4); s.geometries?.add(geom);
  t.mesh(roof, geom, [2.6, 5.6, -.1], 'roof');
  for (const x of [-1.5, 1.5]) rail(frame, [x, 2.7, -2.1], [x, 2.7, 2.1], t);
  rail(frame, [-1.5, 2.7, -2.1], [1.5, 2.7, -2.1], t);
  stair(s, shell, { x: 2.6, z: 5.9, width: .85, rise: 2.7, run: 3.4, count: 15, direction: -1 }, t);
  t.box(shell, [.9, .12, .6], [2.6, 2.66, 2.3], 'steel').name = 'wastewater-filter-press-stair-landing';
  // Separate elevated conditioning tank with conical discharge.
  const conditioner = s._group(units, [4.6, 0, -5.15]); conditioner.name = 'wastewater-sludge-conditioning-5m3'; conditioner.userData.drawingVolumeCubicMetres = 5;
  for (const x of [-.55, .55]) for (const z of [-.55, .55]) t.box(conditioner, [.08, 1.55, .08], [x, .8, z], 'steel');
  t.cyl(conditioner, .82, 1.9, [0, 2.65, 0], 'wall'); t.cyl(conditioner, .82, .65, [0, 1.38, 0], 'steel', 'y', .12); mixer(s, conditioner, [0, 3.65, 0], t);
  t.pipe(conditioner, [[0, 1.05, 0], [0, .7, 0], [-1.7, .7, 1.2], [-1.7, 3.35, 1.2]], .055, 'ochre');
}

function extension(s, shell, units, t) {
  for (const tank of L.extensionAeration) aeration(s, units, tank, t);
  const frame = s._group(shell); frame.name = 'wastewater-extension-14900mm'; frame.userData.drawingOuterWidthMetres = WASTEWATER_DRAWING.extension.outerWidth;
  t.box(frame, [14.9, .17, 1], [13.95, .31, -4.25], 'concrete');
  rail(frame, [6.5, .4, -4.7], [21.4, .4, -4.7], t); rail(frame, [6.5, .4, 4], [21.4, .4, 4], t);
  t.box(frame, [.7, .13, 7.6], [13.95, .47, .2], 'steel');
  for (const x of [13.62, 14.28]) rail(frame, [x, .55, -3.55], [x, .55, 3.95], t, .9, 'steel');
  const blowers = s._group(units); blowers.name = 'wastewater-extension-two-roots-blowers';
  blower(s, blowers, 8, .4, -5.8, t, true); blower(s, blowers, 9.65, .4, -5.8, t, true);
  t.box(frame, [3.2, .15, 1.5], [8.8, .25, -5.8], 'concrete');
  t.pipe(units, [[8, 1.25, -5.8], [8, 1.25, -4.15], [20.6, 1.25, -4.15]], .08);
  for (const x of [7.25, 20.6]) t.pipe(units, [[x, 1.25, -4.15], [x, 1.25, -2.9], [x, -4.75, -2.9]], .06);
}

function processPlates(s, parent) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return;
  const entries = [
    ...L.existingAeration.map(tank => [`폭기조 ${tank.id}`, [tank.x, .95, tank.z + tank.depth / 2 + .18], 2.2]),
    ...L.extensionAeration.map(tank => [`폭기조 ${tank.id}`, [tank.x, .95, tank.z + tank.depth / 2 + .18], 2.2]),
    ['침전조', [-7.8, 2.6, 4.15], 2.2],
    ['반응·중화·응집', [-3.85, 2.75, 4.15], 3.2],
    ['탈수설비', [2.6, 5.05, 2.5], 2.2],
  ];
  for (const [name, position, width] of entries) {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d'); if (!ctx) continue;
    ctx.fillStyle = '#234f44'; ctx.fillRect(0, 0, 256, 64);
    ctx.strokeStyle = '#e5eee5'; ctx.lineWidth = 3; ctx.strokeRect(3, 3, 250, 58);
    ctx.fillStyle = '#ffffff'; ctx.font = '32px "Malgun Gothic", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(name, 128, 33, 242);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; s.textures?.add(texture);
    const material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide, toneMapped: false }); s.materials?.add(material);
    const geometry = new THREE.PlaneGeometry(width, .55); s.geometries?.add(geometry);
    const plate = s._mesh(geometry, material, parent, position); plate.name = `wastewater-nameplate-${name}`; plate.rotation.x = -PI / 4;
  }
}

export function buildCampusWastewater(s, root, item, { materials = {} } = {}) {
  if (item.type !== 'campus-wastewater-treatment') return false;
  const t = equipmentTools(s, materials);
  root.userData.hasInspectableInterior = true; root.userData.interiorFocusObject = 'wastewater-process-units';
  root.userData.drawingCapacityCubicMetresPerDay = 200;
  const shell = s._part(root, item.parts[0], [0, 0, 0]); shell.name = 'wastewater-civil-structures';
  const covers = s._part(root, item.parts[1], [0, 2, 0]); covers.name = 'wastewater-upper-shelters';
  const units = s._part(root, item.parts[2], [0, .7, 0]); units.name = 'wastewater-process-units';
  // The campus has an opening under this footprint. A local apron fills the
  // spaces between basins while keeping actual below-grade interiors open.
  const apronShape = new THREE.Shape();
  apronShape.moveTo(-22, -7); apronShape.lineTo(22, -7); apronShape.lineTo(22, 7); apronShape.lineTo(-22, 7); apronShape.closePath();
  const openings = [...L.existingAeration, ...L.extensionAeration,
    { x: L.equalization.x, z: L.equalization.z, width: L.equalization.width, depth: L.equalization.depth },
    { x: -3.4, z: 5.2, width: 2.15, depth: 2.3 }, { x: -1, z: 5.2, width: 1.35, depth: 1.4 }];
  for (const o of openings) {
    const path = new THREE.Path(), x0 = o.x - o.width / 2, x1 = o.x + o.width / 2, z0 = -o.z - o.depth / 2, z1 = -o.z + o.depth / 2;
    path.moveTo(x0, z0); path.lineTo(x0, z1); path.lineTo(x1, z1); path.lineTo(x1, z0); path.closePath(); apronShape.holes.push(path);
  }
  const apronGeometry = new THREE.ExtrudeGeometry(apronShape, { depth: .17, bevelEnabled: false }); apronGeometry.rotateX(-PI / 2); s.geometries?.add(apronGeometry);
  t.mesh(shell, apronGeometry, [0, -.21, 0], 'concrete').name = 'wastewater-local-apron-with-basin-openings';
  // Narrow concrete perimeter keeps the opening free for the deep tank cutaway.
  t.boxes(shell, [
    [[0, -.12, -6.9], [44, .22, .2]], [[0, -.12, 6.9], [44, .22, .2]],
    [[-21.9, -.12, 0], [.2, .22, 13.6]], [[21.9, -.12, 0], [.2, .22, 13.6]],
  ], 'concrete', 'wastewater-perimeter-ground-pad');
  oldTreatment(s, shell, covers, units, t); dewatering(s, shell, covers, units, t); extension(s, shell, units, t);
  const links = s._group(units); links.name = 'wastewater-process-schematic-links';
  t.pipe(links, [[-21.7, .65, 6.3], [-21.7, .65, 4.7], [-19.1, .65, 4.7]], .08);
  t.pipe(links, [[-11.1, .8, 5.95], [5.8, .8, 5.95], [5.8, .8, 3.1], [6.8, .8, 3.1]], .075);
  t.pipe(links, [[21.1, .8, 3.1], [21.55, .8, 3.1], [21.55, .8, -5.2], [-3.85, .8, -5.2], [-3.85, 2.5, -.8]], .07);
  t.pipe(links, [[-3.85, 2.5, 3], [-5.1, 2.5, 3], [-5.1, 2.5, 1.5]], .055);
  t.pipe(links, [[-7.8, 2.1, -1], [-7.8, 2.1, -4.6], [-10.4, 2.1, -4.6]], .055);
  t.pipe(links, [[-7.8, -.85, 1.5], [-4.9, -.85, 1.5], [-4.9, .7, 5.2], [-3.4, .7, 5.2]], .06, 'ochre');
  t.pipe(links, [[-3.4, .6, 5.2], [.25, .6, 5.2], [.25, .6, -5.15], [4.6, .6, -5.15], [4.6, 2.1, -5.15]], .055, 'ochre');
  // Ground decks are removable covers, so the selected plant reveals basins.
  const groundCover = s._group(covers); groundCover.name = 'wastewater-underground-tank-covers'; groundCover.userData.campusInteriorCover = true;
  const coversConfig = [...L.existingAeration, ...L.extensionAeration];
  for (const tank of coversConfig) {
    t.box(groundCover, [tank.width - .05, .08, tank.depth - .05], [tank.x, tank.rim - .05, tank.z], 'concrete');
    t.box(groundCover, [.8, .045, .8], [tank.x, tank.rim + .015, tank.z], 'steel');
    t.boxes(groundCover, Array.from({ length: 6 }, (_, i) => [[tank.x - .32 + i * .13, tank.rim + .045, tank.z], [.025, .015, .7]]), 'dark', 'wastewater-tank-hatch-slats');
  }
  processPlates(s, units);
  return true;
}
