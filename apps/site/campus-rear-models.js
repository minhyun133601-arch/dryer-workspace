import * as THREE from '../shared/vendor/three.module.js';

// Rear/side geometry comes from the 2026-11-10 walking videos. Site poses and
// unmeasured sizes belong to campus-data; repeated viewpoints are not units.
const TAU = Math.PI * 2, UP = new THREE.Vector3(0, 1, 0);
function proximityDoor(node, kind, open, trigger, width, height) {
  node.userData.proximityDoor = { enterable: false, accessBasis: 'exterior-only; connected modelled interior not established', kind, axis: 'y', closed: 0, open, trigger, width, height, openDistance: 2.2, closeDistance: 3.1 };
  return node;
}
function rearTools(s, inherited = {}) {
  const m = s.campusRearMaterials ||= {
    ...inherited,
    steel: inherited.steel || s._material(0xb9c3c0, .42, .63),
    wall: inherited.wall || s._material(0xd8dbcf, .86, .04),
    white: inherited.white || s._material(0xe1e3d9, .74, .06),
    concrete: inherited.concrete || s._material(0x9a9e95, .97, 0),
    dark: inherited.dark || s._material(0x35423e, .76, .14),
    greenMesh: s._material(0x61a986, .7, .22), gasShell: s._material(0xb8bdc1, .74, .12),
    black: s._material(0x2f3733, .8, .1), yellow: inherited.yellow || s._material(0xd3bb59, .7, .15),
    motor: s._material(0x738d9d, .6, .25), blue: inherited.blueTrim || s._material(0x3d7798, .62, .25),
    cream: inherited.cream || s._material(0xdfe0d1, .84, .05), glass: inherited.glassGreen || s._material(0x547e72, .35, .24),
    orange: inherited.orangeRoof || s._material(0xb96f4b, .8, .08),
    greenRoof: inherited.greenRoof || s._material(0x6d9782, .84, .08),
    frosted: s._material(0xaebeb6, .57, .12),
    // 11/11 additions: green bund paint (clip001 164s), corrugated shed and
    // brick-red recycling bins (clip001 252-256s).
    greenWall: s._material(0x2f8b50, .78, .06), corrugated: s._material(0x9ea7a8, .55, .45),
    binRed: s._material(0xb0402e, .74, .08), signalGreen: s._material(0x37c46a, .4, .1),
    asphalt: s._material(0x6d756f, .98, .01),
    // Tank valve-room prefabs: pale grey-green panels, blue roof (clip002 69s).
    prefabWall: s._material(0xc6cec1, .82, .04), bluePanel: s._material(0x2f6fb4, .62, .18),
  };
  const cache = s.campusRearGeometry ||= new Map();
  const geo = (key, create) => { if (!cache.has(key)) { const g = create(); cache.set(key, g); s.geometries?.add(g); } return cache.get(key); };
  const mesh = (parent, geometry, position = [0, 0, 0], paint = 'steel') => s._mesh(geometry, m[paint] || paint, parent, position);
  const box = (parent, size, p, paint = 'steel') => mesh(parent, geo(`box:${size}`, () => new THREE.BoxGeometry(...size)), p, paint);
  const cyl = (parent, r, length, p, paint = 'steel', axis = 'y', bottom = r, open = false) => {
    const g = geo(`cyl:${r}:${bottom}:${length}:${open}`, () => new THREE.CylinderGeometry(r, bottom, length, r < .025 ? 8 : r < .1 ? 12 : 40, 1, open)), object = mesh(parent, g, p, paint);
    if (axis === 'x') object.rotation.z = -Math.PI / 2; if (axis === 'z') object.rotation.x = Math.PI / 2; return object;
  };
  const bar = (parent, a, b, r = .025, paint = 'steel') => { const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), object = cyl(parent, r, start.distanceTo(end), start.clone().add(end).multiplyScalar(.5).toArray(), paint); object.quaternion.setFromUnitVectors(UP, end.sub(start).normalize()); return object; };
  const ring = (parent, r, tube, p, paint = 'steel', axis = 'y') => { const object = mesh(parent, geo(`ring:${r}:${tube}`, () => new THREE.TorusGeometry(r, tube, 6, 48)), p, paint); if (axis === 'y') object.rotation.x = -Math.PI / 2; if (axis === 'x') object.rotation.y = Math.PI / 2; return object; };
  const pipe = (parent, points, r = .05, paint = 'steel') => mesh(parent, geo(`pipe:${r}:${JSON.stringify(points)}`, () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), false, 'centripetal'), Math.min(112, Math.max(24, points.length * 8)), r, 12, false)), [0, 0, 0], paint);
  const instances = (parent, key, geometry, paint, entries) => {
    if (!entries.length) return null;
    if (cache.has(key)) geometry.dispose();
    const g = geo(key, () => geometry), object = new THREE.InstancedMesh(g, m[paint] || paint, entries.length), dummy = new THREE.Object3D();
    entries.forEach((entry, i) => { dummy.position.set(...entry.position); dummy.scale.set(...(entry.scale || [1, 1, 1])); dummy.rotation.set(...(entry.rotation || [0, 0, 0])); dummy.updateMatrix(); object.setMatrixAt(i, dummy.matrix); }); object.instanceMatrix.needsUpdate = true; object.castShadow = object.receiveShadow = true; object.computeBoundingBox(); object.computeBoundingSphere(); parent.add(object); return object;
  };
  const boxes = (parent, entries, paint = 'steel') => instances(parent, 'unit-box', new THREE.BoxGeometry(1, 1, 1), paint, entries.map(([position, scale, rotation]) => ({ position, scale, rotation })));
  const flange = (parent, r, p, axis = 'y', paint = 'steel') => {
    cyl(parent, r, .055, p, paint, axis); const entries = [];
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, q = [...p]; if (axis === 'y') { q[0] += Math.cos(a) * r * .82; q[2] += Math.sin(a) * r * .82; q[1] += .035; } else { q[0] += Math.cos(a) * r * .82; q[1] += Math.sin(a) * r * .82; q[2] += .035; } entries.push({ position: q, rotation: axis === 'y' ? [0, 0, 0] : [Math.PI / 2, 0, 0] }); }
    instances(parent, 'flange-bolt', new THREE.CylinderGeometry(.014, .014, .025, 6), 'steel', entries);
  };
  return { m, geo, mesh, box, cyl, bar, ring, pipe, boxes, flange, instances };
}

function vesselShell(s, parent, config, t) {
  const r = config.radius, height = config.height, base = config.baseHeight ?? .28, group = s._group(parent, [config.x || 0, 0, config.z || 0]);
  group.name = `campus-rear-vessel-${config.id}`;
  const head = config.headRise ?? r * .23;
  const profile = [[0, base], [r * .67, base], [r * .94, base + .09], [r, base + .23], [r, height - head], [r * .93, height - head * .45], [r * .62, height - head * .1], [0, height]];
  t.mesh(group, t.geo(`vessel:${r}:${height}:${base}:${head}`, () => new THREE.LatheGeometry(profile.map(p => new THREE.Vector2(...p)), 48)), [0, 0, 0], config.paint || 'steel');
  for (const y of [base + .23, height - head]) t.ring(group, r + .006, .016, [0, y, 0], config.paint === 'gasShell' ? 'gasShell' : 'steel');
  t.cyl(group, r * .86, base + .08, [0, (base + .08) / 2, 0], 'dark', 'y', r * .86, true);
  // Every tank top in clip001 164s/432s carries a small central vent cap.
  if (config.topVent) { t.cyl(group, .12, .42, [0, height + .17, 0], 'steel'); t.cyl(group, .02, .26, [0, height + .5, 0], 'steel', 'y', .24); }
  Object.assign(group.userData, { vesselId: config.id, label: config.label || '', source: config.source || 'rear-side-video', measurementsConfirmed: false }); return group;
}

function fence(s, parent, width, depth, t) {
  const entries = [], posts = [];
  const segments = [[[-width / 2, depth / 2], [width / 2, depth / 2]], [[-width / 2, -depth / 2], [-width / 2, depth / 2]], [[width / 2, -depth / 2], [width / 2, depth / 2]]];
  for (const [a, b] of segments) {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]), alongX = Math.abs(b[0] - a[0]) > .01;
    for (let q = 0; q <= length; q += .16) { const x = a[0] + (b[0] - a[0]) * q / length, z = a[1] + (b[1] - a[1]) * q / length; entries.push([[x, .92, z], [.012, 1.64, .012]]); }
    for (let y = .13; y <= 1.72; y += .17) entries.push([[(a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2], alongX ? [length, .014, .014] : [.014, .014, length]]);
    const count = Math.ceil(length / 1.6); for (let i = 0; i <= count; i++) posts.push([[a[0] + (b[0] - a[0]) * i / count, .91, a[1] + (b[1] - a[1]) * i / count], [.07, 1.82, .07]]);
  }
  t.boxes(parent, entries, 'greenMesh'); t.boxes(parent, posts, 'greenMesh'); parent.userData.source = 'video-001-264s-green-mesh-fence';
}

function lpgBank(s, root, item, t) {
  const w = item.width || 7, d = item.depth || 4.4, pad = s._part(root, item.parts?.[0] || 'LPG 용기·기초', [0, 0, 0]), top = s._part(root, item.parts?.[1] || '전면 계기함·벤트봉', [0, .7, -.2]), guard = s._part(root, item.parts?.[2] || '울타리·보호대·외부 배관', [0, .1, .7]);
  pad.name = 'campus-lpg-vessels'; top.name = 'campus-lpg-visible-controls'; guard.name = 'campus-lpg-fence-and-guards';
  t.box(pad, [w, .13, d], [0, .065, 0], 'concrete');
  const tanks = item.vessels || [{ id: 'lpg-left', x: -w * .23, z: -.3, radius: .92, height: 3.6, paint: 'gasShell' }, { id: 'lpg-right', x: w * .23, z: -.3, radius: .92, height: 3.6, paint: 'gasShell' }];
  for (const config of tanks) {
    vesselShell(s, pad, { ...config, paint: 'gasShell', source: 'video-001-264s-LPG' }, t);
    const r = config.radius, x = config.x || 0, z = (config.z || 0) + r + .12, y = config.height * .46;
    t.box(top, [1.06, 1.17, .2], [x, y, z], 'white'); t.box(top, [.018, 1.14, .026], [x, y, z + .115], 'steel');
    for (const yy of [y - .35, y + .35]) t.box(top, [.09, .06, .04], [x, yy, z + .13], 'steel');
    for (const dx of [-r * .65, r * .65]) t.cyl(top, .018, config.height + 1.3, [x + dx, (config.height + 1.3) / 2, (config.z || 0) + .15]);
    t.pipe(guard, [[x, .34, config.z || 0], [x, .34, z], [x, y - .6, z]], .04, 'gasShell');
    for (const dx of [-.2, .2]) { t.cyl(guard, .08, .21, [x + dx, .52, z], 'gasShell'); t.flange(guard, .075, [x + dx, .72, z]); }
    const bz = d / 2 + .43;
    t.pipe(guard, [[x - .65, .06, bz], [x - .65, 1.02, bz], [x - .53, 1.17, bz], [x + .53, 1.17, bz], [x + .65, 1.02, bz], [x + .65, .06, bz]], .075, 'yellow');
    for (const xx of [x - .65, x + .65]) for (const yy of [.25, .65]) t.cyl(guard, .078, .2, [xx, yy, bz], 'black');
    for (const dx of [-.33, .33]) t.cyl(guard, .078, .2, [x + dx, 1.17, bz], 'black', 'x');
  }
  fence(s, guard, w, d, t);
  // The close view shows an external vaporizer enclosure and two gauges.
  // Only its visible casing/pipework is represented; the inside is unknown.
  const vaporizer = s._group(guard, [0, 0, -d / 2 + .7]); vaporizer.name = 'campus-lpg-visible-vaporizer';
  t.box(vaporizer, [1.38, .75, .42], [0, 1.05, 0], 'white');
  t.box(vaporizer, [1.48, .08, .5], [0, 1.46, 0], 'white');
  for (const x of [-.49, .49]) {
    t.cyl(vaporizer, .036, 1.6, [x, .8, -.08]);
    t.cyl(vaporizer, .17, .07, [x, 1.84, .02], 'dark', 'z');
    t.cyl(vaporizer, .14, .075, [x, 1.84, .031], 'white', 'z');
    t.box(vaporizer, [.012, .1, .012], [x + .025, 1.85, .075], 'dark').rotation.z = -.42;
    t.flange(vaporizer, .09, [x, .42, 0]);
  }
  for (const x of [-.6, -.3, 0, .3, .6]) t.cyl(vaporizer, .017, .025, [x, 1.31, .226], 'steel', 'z');
  vaporizer.userData.source = 'video-001-376s-VAPORIZER-and-two-visible-gauges';
  Object.assign(root.userData, { observedVesselCount: tanks.length, functionEvidence: 'LPG label and LPG storage sign directly observed', source: 'video-001-264-328-376s', nominalDimensionsMeasured: false, internalMechanismsAdded: false });
}

function storageBank(s, root, item, t) {
  const configs = item.vessels;
  if (!Array.isArray(configs) || !configs.length) return false;
  const base = s._part(root, item.parts?.[0] || '저장 용기·기초', [0, 0, 0]), upper = s._part(root, item.parts?.[1] || '상부 점검면·난간·사다리', [0, 1, 0]), services = s._part(root, item.parts?.[2] || '보이는 펌프·외부 배관', [.6, .1, .4]);
  base.name = 'campus-process-storage-vessels'; upper.name = 'campus-process-storage-access'; services.name = 'campus-process-storage-services';
  const bounds = { minX:-item.width/2,maxX:item.width/2,minZ:-item.depth/2,maxZ:item.depth/2,...item.bund?.bounds };
  const padWidth=bounds.maxX-bounds.minX,padDepth=bounds.maxZ-bounds.minZ;
  t.box(base, [padWidth, .1, padDepth], [(bounds.minX+bounds.maxX)/2, .05, (bounds.minZ+bounds.maxZ)/2], 'concrete');
  if(item.parking?.bounds) {
    const p=item.parking.bounds,parking=s._group(base);parking.name='campus-storage-adjacent-open-parking';
    Object.assign(parking.userData,{bounds:{...p},openParking:true,source:'user-confirmed-open-parking-beside-tank-stair-20261111;boiler-clip-001-096s-098s',vehiclesAdded:!!item.yardDetails?.parkedCars?.length,parkingCapacityConfirmed:false});
    const parkingSurface=t.box(parking,[p.maxX-p.minX,.025,p.maxZ-p.minZ],[(p.minX+p.maxX)/2,.0125,(p.minZ+p.maxZ)/2],'asphalt');
    parkingSurface.castShadow=false;
    if(s._groundText)s._groundText('주차장',[(p.minX+p.maxX)/2,.035,(p.minZ+p.maxZ)/2],Math.min(5.5,p.maxX-p.minX-.6),1.1,parking,{color:'#d0d5c9',font:'700 64px "Malgun Gothic",sans-serif',fitText:true});
  }
  if (item.bund !== false) {
    const w = padWidth, d = padDepth, h = item.bund?.height ?? .36, thick = item.bund?.thickness ?? .18, paints = item.bund?.paints || {};
    const cx=(bounds.minX+bounds.maxX)/2,cz=(bounds.minZ+bounds.maxZ)/2;
    const curb = s._group(base); curb.name = 'campus-storage-low-containment-curb';
    // Road-facing sides are painted green and the retaining-wall/empty sides
    // white in the video (clip001 164s, 407-422s; clip002 57s, 114s).
    const walls = {
      '-z': [[cx, h / 2, bounds.minZ + thick / 2], [w, h, thick]], '+z': [[cx, h / 2, bounds.maxZ - thick / 2], [w, h, thick]],
      '-x': [[bounds.minX + thick / 2, h / 2, cz], [thick, h, d]], '+x': [[bounds.maxX - thick / 2, h / 2, cz], [thick, h, d]],
    };
    const byPaint = new Map();
    for (const [side, wall] of Object.entries(walls)) { const paint = paints[side] || 'concrete'; if (!byPaint.has(paint)) byPaint.set(paint, []); byPaint.get(paint).push(wall); }
    for (const partition of item.bund?.partitions || []) {
      const paint = partition.paint || 'concrete'; if (!byPaint.has(paint)) byPaint.set(paint, []);
      byPaint.get(paint).push([[partition.x, h / 2, cz], [thick, h, d - thick * 2]]);
    }
    for (const [paint, entries] of byPaint) t.boxes(curb, entries, paint);
    Object.assign(curb.userData, { source: item.bund?.source || 'video-001-164s;video-001-407-422s;video-002-057s;video-002-114s', wallHeight: h, paints: { ...paints },bounds:{...bounds} });
  }
  for (const config of configs) {
    vesselShell(s, base, config, t);
    const x = config.x || 0, z = config.z || 0, r = config.radius, height = config.height;
    if (config.topRail !== false) {
      for (const yy of [height + .05, height + 1.08]) t.ring(upper, r * .92, .021, [x, yy, z]);
      for (let i = 0; i < 10; i++) { const a = i * TAU / 10; t.bar(upper, [x + Math.cos(a) * r * .92, height, z + Math.sin(a) * r * .92], [x + Math.cos(a) * r * .92, height + 1.08, z + Math.sin(a) * r * .92], .019); }
      t.cyl(upper, .3, .055, [x + r * .35, height + .08, z]); t.ring(upper, .3, .018, [x + r * .35, height + .12, z]);
    }
    if (config.topMotor) { t.cyl(upper, .14, .38, [x - r * .3, height + .22, z], 'motor'); t.cyl(upper, .18, .06, [x - r * .3, height + .44, z], 'blue'); for (const dx of [-.11, .11]) t.box(upper, [.025, .3, .025], [x - r * .3 + dx, height + .18, z]); }
    if (config.ladder) {
      const lx = x - r - .18, lz = z;
      for (const zz of [-.26, .26]) t.bar(upper, [lx, .12, lz + zz], [lx, height + .95, lz + zz], .026);
      const rungs = []; for (let yy = .32; yy < height + .7; yy += .29) rungs.push([[lx, yy, lz], [.04, .035, .55]]); t.boxes(upper, rungs);
    }
    if (config.label) sign(s, upper, config.label, Math.min(1.25, r * .9), [x, Math.min(2.8, height * .45), z + r + .03], t);
    const portZ = z + r + .06;
    t.pipe(services, [[x, .45, z], [x, .45, portZ], [x + .65, .45, portZ]], .085); t.flange(services, .13, [x, .45, portZ], 'z');
    if (config.pump) {
      const pump = s._group(services, [x + .63, 0, portZ]); pump.name = `campus-storage-pump-${config.id}`;
      t.box(pump, [1.05, .09, .54], [0, .11, 0], 'steel'); t.cyl(pump, .16, .52, [-.18, .34, 0], 'motor', 'x'); t.cyl(pump, .2, .24, [.18, .34, 0], 'white', 'x');
      for (const yy of [.26, .34, .42]) t.box(pump, [.5, .012, .015], [-.18, yy, .16], 'dark');
    }
  }
  for (const span of item.walkways || []) {
    const a = new THREE.Vector3(...span.start), b = new THREE.Vector3(...span.end), run = a.distanceTo(b), bridge = s._group(upper, a.clone().add(b).multiplyScalar(.5).toArray()); bridge.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), b.clone().sub(a).normalize());
    t.box(bridge, [run, .13, span.width || .85], [0, 0, 0], 'dark');
    for (const side of [-1, 1]) { t.bar(bridge, [-run / 2, 1.05, side * (span.width || .85) / 2], [run / 2, 1.05, side * (span.width || .85) / 2], .022); for (let xx = -run / 2; xx <= run / 2; xx += .95) t.bar(bridge, [xx, .05, side * (span.width || .85) / 2], [xx, 1.05, side * (span.width || .85) / 2], .022); }
    bridge.name = `campus-storage-walkway-${span.id || 'observed'}`;
    bridge.userData.source = span.source || 'video-002-080-088s';
  }
  // Jacketed floor mains along the passages (clip001 439-444s, clip003 4-6s).
  for (const run of item.pipeRuns || []) {
    const main = t.pipe(services, run.points, run.radius || .09); main.name = `campus-storage-floor-pipe-${run.id || 'main'}`;
  }
  // Stainless cabinets and a signal tower stand outside the road-side green
  // wall beside the pipe gantry (clip002 75s, 84s).
  const cabinets = item.roadsideCabinets;
  if (cabinets && Array.isArray(cabinets.xs)) {
    const facing = cabinets.side === '-z' ? -1 : 1, z = facing * (item.depth / 2 + .42), row = s._group(services); row.name = 'campus-storage-roadside-control-cabinets';
    for (const x of cabinets.xs) {
      t.box(row, [.72, .92, .34], [x, 1.18, z], 'steel'); t.box(row, [.78, .05, .4], [x, 1.67, z], 'steel');
      for (const dx of [-.3, .3]) t.box(row, [.05, .72, .05], [x + dx, .36, z]);
    }
    if (Number.isFinite(cabinets.signalX)) {
      const sx = cabinets.signalX; t.cyl(row, .035, 2.7, [sx, 1.35, z], 'steel');
      [['binRed', 2.95], ['yellow', 3.13], ['signalGreen', 3.31]].forEach(([paint, y]) => t.cyl(row, .07, .17, [sx, y, z], paint));
    }
    row.userData.source = 'video-002-075s;video-002-084s';
  }
  tankYardDetails(s, services, item.yardDetails, t);
  Object.assign(root.userData, { observedVesselCount: configs.length, labelledVessels: configs.filter((config) => config.label).map((config) => config.label), countBasis: item.countBasis || 'data-specified-observed-vessels', source: 'video-001-164s;video-001-412-466s;video-002;video-003', nominalDimensionsMeasured: false, internalMechanismsAdded: false }); return true;
}

// 11/11 boiler clip001 1:02-1:39: what stands in front of the green bund and in
// the open parking beside the stair. Every group is a visible feature, not an
// inferred process connection.
function tankYardDetails(s, parent, yard, t) {
  if (!yard) return;
  const root = s._group(parent); root.name = 'campus-tank-yard-visible-details';
  root.userData.source = yard.source || 'boiler-clip-001-062s-098s';
  // Hose couplings on the wall top with the 야경유 plates and the labelled
  // vertical fill pipes rising behind them (1:07-1:19).
  if (yard.hoseStation) {
    const station = s._group(root); station.name = 'campus-tank-yard-hose-station';
    const { z, wallTop = 1, boxes = [], pipes = [] } = yard.hoseStation;
    for (const entry of boxes) {
      const { x, width = 1.1, couplings = 3 } = entry;
      t.box(station, [width, .34, .5], [x, wallTop + .17, z + .05], 'steel');
      const lid = t.box(station, [width + .04, .03, .62], [x, wallTop + .42, z + .02], 'steel'); lid.rotation.x = -.42;
      for (let i = 0; i < couplings; i++) {
        const cx = x - width / 2 + (i + .5) * width / couplings;
        t.cyl(station, .06, .16, [cx, wallTop + .14, z + .34], 'dark', 'z'); t.cyl(station, .05, .1, [cx, wallTop + .14, z + .46], 'white', 'z');
        t.box(station, [.14, .025, .025], [cx + .03, wallTop + .27, z + .3], i % 2 ? 'blue' : 'binRed');
      }
      if (entry.hoses) t.pipe(station, [[x - width * .3, wallTop + .14, z + .45], [x - width * .38, wallTop - .25, z + .55], [x - width * .1, .12, z + .58], [x + width * .3, .12, z + .45]], .055, 'black');
      if (entry.label) { t.box(station, [.05, 1.15, .05], [x + width / 2 + .08, wallTop + .58, z + .25], 'steel'); sign(s, station, entry.label, .62, [x + width / 2 + .08, wallTop + 1.25, z + .28], t); }
    }
    for (const pipe of pipes) {
      t.cyl(station, .055, 3.3, [pipe.x, wallTop + 2.0, z - .12], 'steel');
      t.cyl(station, .062, .3, [pipe.x, wallTop + .62, z - .12], 'yellow');
      t.pipe(station, [[pipe.x, wallTop + 3.6, z - .12], [pipe.x, wallTop + 3.95, z - .5], [pipe.x, wallTop + 3.95, z - 1.7]], .055, 'steel');
      if (pipe.label) { t.box(station, [.2, .64, .02], [pipe.x, wallTop + 1.72, z - .05], 'white'); signUpright(s, station, pipe.label, [pipe.x, wallTop + 1.72, z - .035], t, pipe.red); }
    }
    Object.assign(station.userData, { hoseCouplingBoxes: boxes.length, labelledFillPipes: pipes.filter((pipe) => pipe.label).map((pipe) => pipe.label), source: 'boiler-clip-001-064s;boiler-clip-001-072s;boiler-clip-001-078.5s;boiler-clip-001-080s' });
  }
  // Stainless 세척도구 / 공구 lockers and the red-yellow striped pole (1:24-1:26).
  if (yard.toolLockers) {
    const lockers = s._group(root); lockers.name = 'campus-tank-yard-tool-lockers';
    const { x, z, count = 2 } = yard.toolLockers;
    for (let i = 0; i < count; i++) {
      const lx = x - i * .86;
      t.box(lockers, [.8, 1.75, .5], [lx, .95, z], 'steel'); t.box(lockers, [.82, .08, .52], [lx, 1.86, z], 'steel');
      t.box(lockers, [.02, 1.5, .02], [lx, .95, z + .26], 'dark'); t.box(lockers, [.04, .2, .04], [lx + .1, 1.0, z + .27], 'dark');
      for (const dx of [-.33, .33]) t.box(lockers, [.05, .1, .45], [lx + dx, .05, z], 'dark');
    }
    sign(s, lockers, yard.toolLockers.label || '세척도구 / 공구', .72, [x, 1.45, z + .27], t);
  }
  if (yard.stripedPole) {
    const pole = s._group(root, [yard.stripedPole.x, 0, yard.stripedPole.z]); pole.name = 'campus-tank-yard-red-yellow-pole';
    const h = yard.stripedPole.height || 3.2;
    for (let y = .1, i = 0; y < h; y += .32, i++) t.cyl(pole, .095, .32, [0, y + .16, 0], i % 2 ? 'yellow' : 'binRed');
    t.cyl(pole, .11, .1, [0, .05, 0], 'steel');
  }
  // Two stainless wash sinks on castors beside the stair (1:29-1:31).
  for (const [i, sink] of (yard.sinks || []).entries()) {
    const g = s._group(root, [sink.x, 0, sink.z]); g.name = 'campus-tank-yard-wheeled-sink'; g.rotation.y = sink.yaw || 0;
    t.box(g, [.78, .05, .58], [0, .78, 0]);
    for (const [size, pos] of [[[.78, .28, .03], [0, .93, .28]], [[.78, .28, .03], [0, .93, -.28]], [[.03, .28, .58], [.38, .93, 0]], [[.03, .28, .58], [-.38, .93, 0]]]) t.box(g, size, pos);
    for (const dx of [-.33, .33]) for (const dz of [-.24, .24]) { t.box(g, [.04, .72, .04], [dx, .42, dz]); t.cyl(g, .05, .04, [dx, .05, dz], 'black', 'x'); }
    t.box(g, [.7, .03, .5], [0, .3, 0]);
    if (i === 0) t.pipe(g, [[-.3, .95, -.25], [-.3, 1.25, -.25], [-.15, 1.25, -.1]], .015);
  }
  // Two cars parked nose-in toward the retaining wall (1:36-1:38).
  if ((yard.parkedCars || []).length) {
    const cars = s._group(root); cars.name = 'campus-tank-yard-parked-cars';
    for (const car of yard.parkedCars) {
      const g = s._group(cars, [car.x, 0, car.z]); g.rotation.y = car.yaw || 0; g.name = `campus-tank-yard-car-${car.kind || 'sedan'}`;
      const suv = car.kind === 'suv', bodyH = suv ? .82 : .66, cabinH = suv ? .74 : .58, L = suv ? 4.6 : 4.85, W = 1.86;
      t.box(g, [W, bodyH, L], [0, .3 + bodyH / 2, 0], car.paint || 'white');
      t.box(g, [W - .22, cabinH, L * (suv ? .62 : .5)], [0, .3 + bodyH + cabinH / 2, suv ? .2 : .25], car.paint || 'white');
      t.box(g, [W - .2, cabinH * .78, L * (suv ? .6 : .48) + .02], [0, .3 + bodyH + cabinH * .48, suv ? .2 : .25], 'glass');
      for (const dx of [-W / 2 + .12, W / 2 - .12]) for (const dz of [-L * .32, L * .32]) { t.cyl(g, .34, .24, [dx, .34, dz], 'black', 'x'); t.cyl(g, .18, .25, [dx, .34, dz], 'steel', 'x'); }
      for (const dx of [-.62, .62]) { t.box(g, [.36, .12, .05], [dx, .3 + bodyH * .72, -L / 2 - .01], 'white'); t.box(g, [.34, .12, .05], [dx, .3 + bodyH * .72, L / 2 + .01], 'binRed'); }
    }
    Object.assign(cars.userData, { observedVehicleCount: yard.parkedCars.length, observedAt: '2026-11-11 boiler clip001 1:36-1:38', vehiclesChangeDaily: true });
  }
  // Yellow-black guard posts and a leaning aluminium ladder by the concrete
  // stair at the parking edge (1:35-1:36, 1:39).
  if (yard.guardPosts || yard.ladder) {
    const g = s._group(root); g.name = 'campus-tank-yard-guard-posts-and-ladder';
    for (const post of yard.guardPosts || []) for (let y = 0, i = 0; y < (post.height || 1.4); y += .2, i++) t.cyl(g, .1, .2, [post.x, y + .1, post.z], i % 2 ? 'black' : 'yellow');
    if (yard.ladder) {
      const { x, z, height = 3.2, lean = .7 } = yard.ladder;
      for (const dz of [-.22, .22]) t.bar(g, [x + lean, .02, z + dz], [x, height, z + dz], .025, 'steel');
      for (let i = 1; i < 11; i++) { const k = i / 11; t.bar(g, [x + lean * (1 - k), height * k, z - .22], [x + lean * (1 - k), height * k, z + .22], .015, 'steel'); }
    }
  }
}

function signUpright(s, parent, text, position, t, red = false) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return;
  const canvas = document.createElement('canvas'); canvas.width = 96; canvas.height = 320;
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  ctx.fillStyle = '#f2f3ee'; ctx.fillRect(0, 0, 96, 320); ctx.fillStyle = red ? '#c0392b' : '#24365e'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const chars = Array.from(String(text).replace(/\s+/g, '')); ctx.font = `700 ${chars.length > 4 ? 46 : 56}px "Malgun Gothic", sans-serif`;
  chars.forEach((ch, i) => ctx.fillText(ch, 48, (i + .5) * 320 / chars.length, 90));
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; s.textures?.add(texture);
  const mat = new THREE.MeshBasicMaterial({ map: texture }); s.materials?.add(mat);
  const plate = s._mesh(t.geo('sign-upright', () => new THREE.PlaneGeometry(.18, .6)), mat, parent, position); plate.name = 'campus-tank-fill-pipe-label'; plate.castShadow = false;
}

// Corrugated recycling shed ("압축실" door plate) backed onto the retaining
// wall, with the red sorting bins beside it (clip001 252-256s; baler 295s).
function recyclingRoom(s, root, item, t) {
  const w = item.width || 4.6, d = item.depth || 3.8, h = item.height || 2.7, doorX = item.doorX ?? .55;
  const shell = s._part(root, item.parts?.[0] || '골판 외벽·기초', [0, 0, 0]); shell.name = 'campus-recycling-room-body';
  t.box(shell, [w + .2, .12, d + .2], [0, .06, 0], 'concrete');
  t.box(shell, [w, h, d], [0, h / 2 + .06, 0], 'corrugated');
  const ribs = [];
  for (let x = -w / 2 + .1; x < w / 2; x += .17) ribs.push([[x, h / 2 + .06, d / 2 + .012], [.045, h, .028]]);
  for (let z = -d / 2 + .1; z < d / 2; z += .17) for (const side of [-1, 1]) ribs.push([[side * (w / 2 + .012), h / 2 + .06, z], [.028, h, .045]]);
  t.boxes(shell, ribs, 'steel');
  t.box(shell, [w + .04, .16, .04], [0, .2, d / 2 + .03], 'binRed');
  const roof = s._part(root, item.parts?.[1] || '외쪽 경사 지붕·문 위 등', [0, .6, 0]); roof.name = 'campus-recycling-room-roof';
  const slab = t.box(roof, [w + .5, .07, d + .45], [0, h + .2, 0], 'corrugated'); slab.rotation.x = .07;
  t.box(roof, [w + .5, .16, .05], [0, h + .06, d / 2 + .25], 'steel');
  t.box(roof, [.16, .2, .12], [doorX - .75, h - .2, d / 2 + .08], 'cream');
  const details = s._part(root, item.parts?.[2] || '압축실 문·분리수거함·보호대', [.4, .2, .4]); details.name = 'campus-recycling-room-exterior';
  const door = s._group(details, [doorX, 0, d / 2]); door.name = 'campus-recycling-room-door';
  t.box(door, [.96, 2.06, .008], [0, 1.12, .007], 'dark');
  const leafPivot = proximityDoor(s._group(door, [-.49, .08, .03]), 'hinge', -Math.PI / 2, [0, .08, .03], .98, 2.08); leafPivot.name = 'campus-recycling-room-door-pivot';
  const leafPanel = s._group(leafPivot, [.49, -.08, -.03]);
  t.box(leafPanel, [.98, 2.08, .05], [0, 1.12, .03], 'cream'); t.box(leafPanel, [.42, 1.82, .02], [.14, 1.12, .065], 'frosted');
  t.box(leafPanel, [.05, .05, .1], [-.36, 1.06, .1], 'steel');
  sign(s, leafPanel, '압축실', .62, [-.08, 1.62, .085], t);
  // Yellow/black U guard in front of the shed (clip001 255-257s).
  const gz = d / 2 + .55, gx = doorX - 1.55;
  t.pipe(details, [[gx - .6, .06, gz], [gx - .6, .62, gz], [gx - .48, .74, gz], [gx + .48, .74, gz], [gx + .6, .62, gz], [gx + .6, .06, gz]], .055, 'yellow');
  for (const dx of [-.6, .6]) t.cyl(details, .058, .14, [gx + dx, .32, gz], 'black');
  const bins = s._group(details); bins.name = 'campus-recycling-sorting-bins';
  for (const bin of item.bins || []) {
    const bw = bin.width || 1.45, bd = bin.depth || 1.05, bh = bin.height || 1.08, bz = -d / 2 + bd / 2 + .05;
    t.boxes(bins, [
      [[bin.x, .06, bz], [bw, .08, bd]], [[bin.x, bh / 2, bz - bd / 2 + .03], [bw, bh, .06]], [[bin.x, bh / 2, bz + bd / 2 - .03], [bw, bh, .06]],
      [[bin.x - bw / 2 + .03, bh / 2, bz], [.06, bh, bd]], [[bin.x + bw / 2 - .03, bh / 2, bz], [.06, bh, bd]],
    ], 'binRed');
  }
  bins.userData.source = 'video-001-196s;video-001-232s;video-001-252s';
  Object.assign(root.userData, { source: 'video-001-252-257s;video-001-268-312s', signText: '압축실', observedInterior: 'hydraulic-baler-power-unit', interiorAdded: false, nominalDimensionsMeasured: false });
  return true;
}

// 공무사무실: the green-roof concrete building (user, 11/11). Wall/roof paint
// come from data; facade details wait for the user's photos.
function serviceBuilding(s, root, item, t) {
  const { width: w, depth: d, height: h } = item;
  const wall = item.wallPaint || 'white', roofPaint = item.roofPaint || 'white', base = item.basePaint || 'greenRoof';
  const shell = s._part(root, item.parts?.[0] || '외벽·기단', [0, 0, 0]); shell.name = 'campus-maintenance-office-body';
  t.box(shell, [w + .35, .2, d + .35], [0, .1, 0], 'concrete');
  t.box(shell, [w, h, d], [0, h / 2, 0], wall);
  t.box(shell, [w + .02, .4, d + .02], [0, .22, 0], base);
  if (item.panelRibs !== false) {
    const ribs = [];
    for (let y = .64; y < h - .15; y += .32) {
      ribs.push([[0, y, d / 2 + .015], [w, .012, .025]], [[0, y, -d / 2 - .015], [w, .012, .025]], [[w / 2 + .015, y, 0], [.025, .012, d]], [[-w / 2 - .015, y, 0], [.025, .012, d]]);
    }
    t.boxes(shell, ribs, 'concrete');
  }
  const roof = s._part(root, item.parts?.[1] || '지붕·파라펫', [0, .8, 0]); roof.name = 'campus-maintenance-office-roof';
  t.box(roof, [w + .2, .16, d + .2], [0, h + .06, 0], roofPaint);
  t.boxes(roof, [
    [[0, h + .3, d / 2 + .05], [w + .3, .36, .2]], [[0, h + .3, -d / 2 - .05], [w + .3, .36, .2]],
    [[w / 2 + .05, h + .3, 0], [.2, .36, d + .3]], [[-w / 2 - .05, h + .3, 0], [.2, .36, d + .3]],
  ], 'white');
  const details = s._part(root, item.parts?.[2] || '창·출입문', [.5, .2, .4]); details.name = 'campus-maintenance-office-exterior';
  Object.assign(root.userData, { source: item.source || 'video-001-264s;video-001-404s;aerial-green-roof;dwg2019-existing-8', officeIdentity: 'user-confirmed-green-roof-building', exteriorPending: !(item.exteriorDetails || []).length, nominalDimensionsMeasured: false, interiorAdded: false });
}

// Tank valve room: the blue prefab inside the stair, among the tank bank.
// (clip002 69s exterior, 120-129s interior with pneumatic valves and heater).
function valveRoomInterior(s, parent, unit, uw, ud, t) {
  const interior = s._group(parent); interior.name = `campus-tank-valve-room-interior-${unit.id}`;
  Object.assign(interior.userData, { source: 'clip-002-120-129s', observedInterior: true, measurementsConfirmed: false });
  // Only the visible low pipework and its three pneumatic actuators are
  // reconstructed. Routes stop at the wall; hidden tank connections are not
  // inferred. Keep the front strip of the small room clear for access.
  const sx = Math.min(1, (uw - .5) / 3.8), sz = Math.min(1, (ud - .3) / 2);
  const equipment = s._group(interior); equipment.scale.set(sx, 1, sz);
  const valves = s._group(equipment); valves.name = 'campus-valve-room-pneumatic-valves';
  for (const [index, x, z, y] of [[0, -.95, -.63, .64], [1, .15, -.15, .51], [2, 1.17, .32, .56]]) {
    const assembly = s._group(valves, [x, 0, z]); assembly.name = `campus-valve-room-pneumatic-valve-${index + 1}`;
    const length = 3.65;
    t.cyl(equipment, .105, length, [0, y, z], 'steel', 'x');
    t.cyl(assembly, .16, .32, [0, y, 0], 'steel', 'x');
    for (const offset of [-.22, .22]) t.cyl(assembly, .19, .055, [offset, y, 0], 'steel', 'x');
    t.cyl(assembly, .04, .18, [0, y + .2, 0], 'steel');
    const fasteners = s._group(assembly); fasteners.name = `campus-valve-room-flange-hardware-${index + 1}`;
    const boltPositions = [];
    for (const side of [-1, 1]) for (let bolt = 0; bolt < 8; bolt++) {
      const angle = bolt * TAU / 8;
      boltPositions.push({ position: [side * .255, y + Math.cos(angle) * .153, Math.sin(angle) * .153], rotation: [0,0,Math.PI / 2] });
    }
    t.instances(fasteners, 'valve-flange-bolt-hex', new THREE.CylinderGeometry(.016,.016,.028,6), 'steel', boltPositions);
    for (const bandX of [-1.45,-.65,.65,1.45]) t.ring(equipment, .107, .006, [bandX,y,z], 'steel', 'x');
    t.box(assembly, [.42, .24, .28], [0, y + .4, 0], 'steel');
    t.box(assembly, [.29, .1, .22], [0, y + .58, 0], 'black');
    t.cyl(assembly, .04, .055, [.11, y + .63, 0], 'binRed');
    t.box(assembly, [.17, .035, .02], [-.03, y + .61, .125], 'yellow');
    t.boxes(assembly, [-.16,.16].flatMap(boltX => [-.095,.095].map(boltZ => [[boltX,y + .53,boltZ],[.025,.025,.025]])), 'steel');
    for (const offset of [-.1, .1]) {
      const fitting = t.cyl(assembly, .024, .055, [offset,y + .42,.173], 'steel', 'z'); fitting.name = 'campus-valve-room-air-quick-coupling';
      t.pipe(assembly, [[offset, y + .42, .17], [offset - .09, y + .73, .23], [offset + .14, 1.5, -.2], [.2 - x, 1.72, -.91 - z]], .013, 'bluePanel');
    }
    t.box(equipment, [.08, .38, .3], [x, .31, z], 'dark');
  }
  // Blue air supply follows the back wall, with the individual thin tubes
  // returning to it. The wall box is visible in the same filmed interior.
  const air = s._group(equipment); air.name = 'campus-valve-room-blue-air-lines';
  t.pipe(air, [[.2, .8, -.91], [.2, 1.45, -.91], [.2, 2.22, -.91]], .035, 'bluePanel');
  t.pipe(air, [[-1.65, 1.72, -.91], [-.3, 1.72, -.91], [.2, 1.72, -.91]], .018, 'bluePanel');
  const control = s._group(equipment, [-1.4, 1.55, -.91]); control.name = 'campus-valve-room-wall-control-box';
  t.box(control, [.48, .63, .18], [0, 0, 0], 'white');
  t.box(control, [.17, .11, .025], [0, .13, .105], 'dark');
  t.box(control, [.025,.14,.025], [.18,-.03,.105], 'steel');
  t.boxes(control, [-.2,.2].flatMap(x => [-.26,.26].map(y => [[x,y,.107],[.018,.018,.018]])), 'steel');
  for (const [x, paint] of [[-.12, 'binRed'], [.12, 'signalGreen']]) t.cyl(control, .025, .025, [x, -.12, .115], paint, 'z');
  const heater = s._group(equipment, [-1.25, 0, .74]); heater.name = 'campus-valve-room-finned-heater';
  t.box(heater, [.79, .1, .24], [0, .22, 0], 'white');
  t.box(heater, [.79, .1, .24], [0, .95, 0], 'white');
  for (let i = 0; i < 9; i++) t.box(heater, [.035, .82, .3], [-.37 + i * .084, .62, 0], 'white');
  t.box(heater, [.15, .85, .28], [.49, .61, 0], 'white');
  const vents = s._group(heater); vents.name = 'campus-valve-room-heater-side-vents';
  t.boxes(vents, [-.04,0,.04].flatMap(x => [.42,.75].map(y => [[.49 + x,y,.146],[.014,.2,.008]])), 'dark');
  t.cyl(heater, .032, .02, [.49,.98,.148], 'black', 'z');
  for (const x of [-.3, .35]) { t.box(heater, [.06, .12, .44], [x, .2, 0], 'steel'); for (const z of [-.17, .17]) t.cyl(heater, .045, .04, [x, .165, z], 'black', 'x'); }
  return interior;
}

function valveRoom(s, root, item, t) {
  const units = Array.isArray(item.units) ? item.units : [];
  if (!units.length) return false;
  const height = item.height || 2.9, wallH = height - .45;
  const shell = s._part(root, item.parts?.[0] || '조립식 동·기초', [0, 0, 0]); shell.name = 'campus-tank-valve-room-units';
  const roof = s._part(root, item.parts?.[1] || '파란 처마 지붕', [0, .7, 0]); roof.name = 'campus-tank-valve-room-roof';
  roof.userData.campusInteriorCover = true;
  const details = s._part(root, item.parts?.[2] || '문·창·철제 계단', [.4, .2, .4]); details.name = 'campus-tank-valve-room-exterior';
  const onFace = (parent, face, offset, along, y, up, uw, ud, paint, depth = .06) => {
    const z = face === '+z' ? ud / 2 + depth / 2 : face === '-z' ? -ud / 2 - depth / 2 : offset;
    const x = face === '+x' ? uw / 2 + depth / 2 : face === '-x' ? -uw / 2 - depth / 2 : offset;
    const size = face.endsWith('z') ? [along, up, depth] : [depth, up, along];
    return t.box(parent, size, [x, y, z], paint);
  };
  for (const unit of units) {
    const uw = unit.width || item.width || 4.4, ud = unit.depth || 2.3;
    const body = s._group(shell, [unit.x || 0, 0, unit.z || 0]); body.name = `campus-tank-valve-room-unit-${unit.id}`;
    t.box(body, [uw + .1, .12, ud + .1], [0, .06, 0], 'concrete');
    // Four thin panels, rather than a solid block, leave a real floor and
    // interior volume. Each door is an opening through its panel.
    const walls = new Map();
    for (const face of ['-x', '+x', '-z', '+z']) {
      const wall = s._group(body); wall.name = `campus-valve-room-wall-${unit.id}-${face}`; walls.set(face, wall);
      wall.userData.campusInteriorCover = face !== '-z';
      const span = face.endsWith('x') ? ud : uw, fixed = (face.startsWith('+') ? 1 : -1) * (face.endsWith('x') ? uw : ud) / 2;
      const panel = (start, end, bottom = .12, top = .12 + wallH) => {
        if (end - start < .005 || top - bottom < .005) return;
        t.box(wall, face.endsWith('x') ? [.08, top - bottom, end - start] : [end - start, top - bottom, .08], face.endsWith('x') ? [fixed, (top + bottom) / 2, (start + end) / 2] : [(start + end) / 2, (top + bottom) / 2, fixed], 'prefabWall');
      };
      const openings = [
        ...(unit.door?.face === face ? [{ offset: unit.door.offset || 0, width: .94, bottom: .12, top: 2.24 }] : []),
        ...(unit.windows || []).filter(win => win.face === face).map(win => ({ offset: win.offset || 0, width: 1.08, bottom: 1.2, top: 2.04 })),
      ].sort((a, b) => a.offset - b.offset);
      let cursor = -span / 2;
      for (const opening of openings) {
        const from = Math.max(cursor, opening.offset - opening.width / 2), to = Math.min(span / 2, opening.offset + opening.width / 2);
        panel(cursor, from); panel(from, to, .12, opening.bottom); panel(from, to, opening.top); cursor = Math.max(cursor, to);
      }
      panel(cursor, span / 2);
      if (face.endsWith('z')) for (let x = -uw / 2 + 1.1; x < uw / 2 - .3; x += 1.1) t.box(wall, [.025, wallH, .018], [x, .12 + wallH / 2, fixed + (face.startsWith('+') ? .05 : -.05)], 'white');
    }
    // The blue corner posts and edge rails stay visible in cutaway mode.
    for (const x of [-uw / 2, uw / 2]) for (const z of [-ud / 2, ud / 2]) t.box(body, [.07, wallH, .07], [x, .12 + wallH / 2, z], 'bluePanel');
    for (const y of [.17, .12 + wallH]) { for (const z of [-ud / 2, ud / 2]) t.box(body, [uw, .05, .06], [0, y, z], 'bluePanel'); for (const x of [-uw / 2, uw / 2]) t.box(body, [.06, .05, ud], [x, y, 0], 'bluePanel'); }
    const cap = s._group(roof, [unit.x || 0, 0, unit.z || 0]); cap.name = `campus-tank-valve-room-roof-${unit.id}`;
    const top = .12 + wallH;
    t.box(cap, [uw + .3, .1, ud + .3], [0, top + .05, 0], 'bluePanel');
    t.boxes(cap, [
      [[0, top + .02, ud / 2 + .17], [uw + .34, .26, .05]], [[0, top + .02, -ud / 2 - .17], [uw + .34, .26, .05]],
      [[uw / 2 + .17, top + .02, 0], [.05, .26, ud + .34]], [[-uw / 2 - .17, top + .02, 0], [.05, .26, ud + .34]],
    ], 'bluePanel');
    const trim = s._group(details, [unit.x || 0, 0, unit.z || 0]); trim.name = `campus-tank-valve-room-openings-${unit.id}`;
    if (unit.door) {
      const doorTrim = s._group(trim); doorTrim.userData.campusInteriorCover = true;
      const face = unit.door.face, offset = unit.door.offset || 0;
      const doorFrame = s._group(doorTrim, face.endsWith('x') ? [(face === '+x' ? 1 : -1) * (uw / 2 + .03), .12, offset] : [offset, .12, (face === '+z' ? 1 : -1) * (ud / 2 + .03)]);
      doorFrame.rotation.y = face === '+x' ? Math.PI / 2 : face === '-x' ? -Math.PI / 2 : face === '-z' ? Math.PI : 0;
      const leaf = proximityDoor(s._group(doorFrame, [-.45, 0, 0]), 'hinge', -Math.PI / 2, [0, 0, 0], .9, 2.1);
      leaf.name = `campus-tank-valve-room-door-pivot-${unit.id}`;
      Object.assign(leaf.userData.proximityDoor, { enterable: unit.id === (item.interiorUnitId || units[0].id) && unit.interior !== false, groupId: `${item.id}:valve-room:${unit.id}`, label: '탱크 밸브실 출입문', accessBasis: 'cut wall panel + modelled floor and photographed valve interior' });
      const door = t.box(leaf, [.9, 2.1, .06], [.45, 1.05, 0], 'white');
      door.name = `campus-tank-valve-room-door-${unit.id}`;
      t.box(leaf, [.05, .06, .12], [.75, 1.02, .06], 'steel');
    }
    for (const win of unit.windows || []) {
      const windowTrim = s._group(trim); windowTrim.userData.campusInteriorCover = win.face === '+x' || win.face === '+z';
      onFace(windowTrim, win.face, win.offset || 0, 1.15, .12 + 1.5, .95, uw, ud, 'white', .05);
      onFace(windowTrim, win.face, win.offset || 0, 1.0, .12 + 1.5, .8, uw, ud, 'glass', .07);
    }
    if (unit.id === (item.interiorUnitId || units[0].id) && unit.interior !== false) valveRoomInterior(s, body, unit, uw, ud, t);
  }
  if (item.stair) {
    // The optional pose aligns the same flight with a side partition. Legacy
    // fixtures without a pose retain their original local-Z stair direction.
    const st = item.stair, count = Math.max(2, Math.round((st.rise || 1) / .2)), run = (st.toZ - st.fromZ) / count, sw = st.width || .9;
    const stair = s._group(details, st.position || [0, 0, 0]); stair.name = 'campus-tank-valve-room-metal-stair';
    stair.rotation.y = st.rotation || 0;
    Object.assign(stair.userData, { axis: st.axis || 'z', source: st.source || 'video-002-069s;video-003-019-021s', wallCrossing: st.wallCrossing || 'legacy-road-side' });
    for (let i = 0; i < count; i++) t.box(stair, [sw, .045, Math.abs(run) + .02], [st.x, (i + 1) * (st.rise || 1) / count, st.fromZ + run * (i + .5)], 'steel');
    for (const side of [-1, 1]) {
      t.bar(stair, [st.x + side * sw / 2, .9, st.fromZ], [st.x + side * sw / 2, (st.rise || 1) + .9, st.toZ], .025);
      for (const [z, y] of [[st.fromZ, 0], [st.toZ, st.rise || 1]]) t.bar(stair, [st.x + side * sw / 2, y, z], [st.x + side * sw / 2, y + .9, z], .022);
    }
    if (Number.isFinite(st.landingLength) && st.landingLength > 0 && Number.isFinite(st.returnToZ)) {
      // Cross the bund at full height, then descend on the inside. A single
      // inclined flight through the wall would have its low treads buried in
      // the concrete. The open steel landing clears the 1m wall underneath.
      const rise = st.rise || 1, floorY = st.floorHeight ?? .12;
      const direction = Math.sign(st.toZ - st.fromZ) || -1, landingEnd = st.toZ + direction * st.landingLength;
      const landing = s._group(stair); landing.name = 'campus-tank-valve-room-stair-landing';
      t.box(landing, [sw, .045, st.landingLength + .08], [st.x, rise, (st.toZ + landingEnd) / 2], 'steel');
      const inner = s._group(stair); inner.name = 'campus-tank-valve-room-stair-inner-flight';
      const innerCount = Math.max(2, Math.round((rise - floorY) / .2)), innerRun = (st.returnToZ - landingEnd) / innerCount;
      for (let i = 0; i < innerCount; i++) t.box(inner, [sw, .045, Math.abs(innerRun) + .02], [st.x, rise - (i + 1) * (rise - floorY) / innerCount, landingEnd + innerRun * (i + .5)], 'steel');
      for (const side of [-1, 1]) {
        const x = st.x + side * sw / 2;
        t.bar(stair, [x, rise + .9, st.toZ], [x, rise + .9, landingEnd], .025);
        t.bar(stair, [x, rise + .9, landingEnd], [x, floorY + .9, st.returnToZ], .025);
        t.bar(stair, [x, .09, landingEnd], [x, rise + .9, landingEnd], .022);
        t.bar(stair, [x, floorY, st.returnToZ], [x, floorY + .9, st.returnToZ], .022);
        // Narrow stringers and small feet support the open treads without
        // filling the underside with a solid stair-shaped mass.
        for (const [from, to] of [
          [[x, .05, st.fromZ], [x, rise - .05, st.toZ]],
          [[x, rise - .05, st.toZ], [x, rise - .05, landingEnd]],
          [[x, rise - .05, landingEnd], [x, floorY - .02, st.returnToZ]],
        ]) t.bar(stair, from, to, .035);
        for (const z of [st.fromZ, landingEnd, st.returnToZ]) t.box(stair, [.16, .06, .16], [x, .03, z], 'steel');
      }
      Object.assign(stair.userData, { landingHeight: rise, landingFromZ: st.toZ, landingToZ: landingEnd, innerFloorHeight: floorY, returnToZ: st.returnToZ });
    }
  }
  const observedInterior = units.find(unit => unit.id === (item.interiorUnitId || units[0].id) && unit.interior !== false);
  Object.assign(root.userData, { source: 'video-002-069s;video-002-120-129s;video-003-019-021s;aerial-blue-roof', unitCount: units.length, function: 'tank-valve-room-from-interior', signRead: false, interiorAdded: !!observedInterior, hasInspectableInterior: !!observedInterior, observedInteriorUnit: observedInterior?.id, nominalDimensionsMeasured: false });
  return true;
}

function electricalRoom(s, root, item, t) {
  const w = item.width || 1.6, d = item.depth || 5.6, h = item.height || 3.2;
  const base = s._part(root, item.parts?.[0] || '콘크리트 바닥·계단 아래 구역', [0, 0, 0]); base.name = 'campus-electrical-room-foundation';
  t.box(base, [w + .1, .12, d + .2], [0, .06, 0], 'concrete');
  const stair = s._part(root, item.parts?.[1] || '계단·옹벽 외관', [0, .4, 0]); stair.name = 'campus-electrical-room-concrete-stair';
  const count = 8, run = d / count, rise = h / count;
  for (let i = 0; i < count; i++) t.box(stair, [w, (i + 1) * rise, run + .025], [0, (i + 1) * rise / 2 + .12, d / 2 - (i + .5) * run], 'concrete');
  for (const side of [-1, 1]) t.box(stair, [.12, h, d], [side * (w / 2 - .06), h / 2, 0], 'concrete');
  const gate = s._part(root, item.parts?.[2] || '초록 철망·수변전실 표찰', [0, .1, .2]); gate.name = 'campus-electrical-room-gate';
  const entries = [], gh = Math.min(2.25, h - .1), front = d / 2 + .04;
  const gatePivot = proximityDoor(s._group(gate, [w / 2, 0, front]), 'hinge', Math.PI / 2, [0, 0, front], w, gh); gatePivot.name = 'campus-electrical-room-gate-pivot';
  const gatePanel = s._group(gatePivot, [-w / 2, 0, -front]);
  for (let x = -w / 2; x <= w / 2 + .001; x += .12) entries.push([[x, gh / 2, front], [.018, gh, .025]]);
  for (let y = .12; y < gh; y += .19) entries.push([[0, y, front], [w, .02, .025]]);
  t.boxes(gatePanel, entries, 'greenMesh');
  for (const side of [-1, 1]) t.box(gate, [.09, gh + .15, .09], [side * w / 2, gh / 2, front], 'white');
  t.box(gate, [w, .06, .06], [0, gh, front], 'greenMesh');
  t.box(gatePanel, [.08, .12, .08], [.08, .92, front + .055], 'steel');
  const hardware = s._group(gatePanel); hardware.name = 'campus-electrical-gate-hinges-and-padlock';
  for (const y of [.3,1.05,1.85]) t.cyl(hardware, .026, .14, [w / 2,y,front + .04], 'steel');
  t.box(hardware, [Math.min(.55,w * .45),.035,.035], [-w * .2,.64,front + .055], 'steel');
  t.ring(hardware, .042, .011, [-w * .27,.57,front + .09], 'steel', 'z');
  t.box(hardware, [.075,.1,.045], [-w * .27,.49,front + .09], 'dark');
  sign(s, gatePanel, '수변전실', Math.min(w * .88, 1.4), [0, 1.46, front + .06], t);
  sign(s, gatePanel, '2,100kW / 22,900V', Math.min(w * .88, 1.4), [0,1.23,front + .06], t);
  sign(s, gatePanel, '비상발전설비 160kW', Math.min(w * .88, 1.4), [0,1.04,front + .06], t);
  sign(s, gatePanel, '위험 · 접근금지', Math.min(w * .88, 1.4), [0, .69, front + .06], t);
  Object.assign(root.userData, { source: item.source || 'clip-001-128s;clip-001-064s', signText: '수변전실', observedExterior: true, interiorAdded: false, hasInspectableInterior: false, nominalDimensionsMeasured: false, ratingPlate: '수전설비용량 2,100kW / 22,900V · 비상발전설비 160kW', unobservedTransformersAdded: false });
  return true;
}

export function buildCampusRearEquipment(s, root, item, { materials } = {}) {
  if (!['campus-lpg-bank', 'campus-process-tank-bank', 'campus-rear-service-building', 'campus-recycling-room', 'campus-tank-valve-room', 'campus-electrical-room'].includes(item.type)) return false;
  const t = rearTools(s, materials);
  if (item.type === 'campus-electrical-room') return electricalRoom(s, root, item, t);
  if (item.type === 'campus-lpg-bank') { lpgBank(s, root, item, t); addCampusRearDetails(s, root, item, { materials }); return true; }
  if (item.type === 'campus-tank-valve-room') { const built = valveRoom(s, root, item, t); if (built) addCampusRearDetails(s, root, item, { materials }); return built; }
  if (item.type === 'campus-recycling-room') { recyclingRoom(s, root, item, t); addCampusRearDetails(s, root, item, { materials }); return true; }
  if (item.type === 'campus-rear-service-building') { serviceBuilding(s, root, item, t); addCampusRearDetails(s, root, item, { materials }); return true; }
  const built = storageBank(s, root, item, t); if (built) addCampusRearDetails(s, root, item, { materials }); return built;
}

function guardRoundedCorner(s, root, item, materials) {
  const t = rearTools(s, materials), w = item.width, d = item.depth, height = item.height, radius = Math.min(3.6, w * .36, d * .405);
  // clippedCorner gives the corner's X/Z signs; the arc faces outward there.
  const [sx, sz] = Array.isArray(item.clippedCorner) ? item.clippedCorner.map((value) => value < 0 ? -1 : 1) : [-1, 1];
  const centre = [sx * (w / 2 - radius), 0, sz * (d / 2 - radius)], start = Math.atan2(sx, sz) - Math.PI / 4, key = `${start.toFixed(4)}`;
  const body = root.getObjectByName('campus-guardhouse-body') || root, roof = root.getObjectByName('campus-guardhouse-green-roof') || root;
  const corner = s._group(body, centre); corner.name = 'campus-guardhouse-video-rounded-corner';
  const sector = (r, h, y, paint) => t.mesh(corner, t.geo(`guard-sector:${r}:${h}:${key}`, () => new THREE.CylinderGeometry(r, r, h, 48, 1, true, start, Math.PI / 2)), [0, y, 0], paint);
  sector(radius, .9, .45, 'cream'); sector(radius + .014, 1.79, 1.8, 'glass');
  for (const y of [.9, 1.35, 2.71]) sector(radius + .032, .06, y, 'white');
  for (let i = 0; i <= 6; i++) {
    const a = start + i * Math.PI / 12, x = Math.sin(a) * (radius + .025), z = Math.cos(a) * (radius + .025);
    t.bar(corner, [x, .9, z], [x, 2.74, z], .022, 'white'); t.bar(corner, [x, .04, z], [x, .86, z], .008, 'concrete');
  }
  for (const y of [.3, .61]) sector(radius + .007, .014, y, 'concrete');
  const roofCorner = s._group(roof, centre); roofCorner.name = 'campus-guardhouse-curved-roof-visor';
  const roofShape = new THREE.Shape();
  for (let i = 0; i <= 32; i++) { const a = start + i * Math.PI / 64, x = Math.sin(a) * (radius + .25), z = Math.cos(a) * (radius + .25); if (!i) roofShape.moveTo(x, -z); else roofShape.lineTo(x, -z); } roofShape.closePath();
  const roofGeometry = t.geo(`guard-rounded-roof:${radius}:${key}`, () => { const g = new THREE.ExtrudeGeometry(roofShape, { depth: .16, bevelEnabled: false }); g.rotateX(-Math.PI / 2); return g; });
  t.mesh(roofCorner, roofGeometry, [0, height + .1, 0], 'greenRoof');
  const edge = t.mesh(roofCorner, t.geo(`guard-rounded-roof-edge:${radius}:${key}`, () => new THREE.CylinderGeometry(radius + .25, radius + .25, .3, 48, 1, true, start, Math.PI / 2)), [0, height + .37, 0], 'white'); edge.name = 'campus-guardhouse-curved-white-fascia';
  Object.assign(corner.userData, { source: 'clip001-native016s-curved-glazing-and-roof;aerial-roof;dwg2019-chamfer', clippedCorner: [sx, sz], dimensionsMeasured: false, surveyFootprintUnchanged: true }); return true;
}

function sign(s, parent, text, width, position, t) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return;
  const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 128;
  const ctx = canvas.getContext('2d'); if (!ctx) return;
  ctx.fillStyle = '#e8ece4'; ctx.fillRect(0, 0, 768, 128); ctx.fillStyle = '#35483f'; ctx.font = '600 62px "Malgun Gothic", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 384, 68, 720);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; s.textures?.add(texture);
  const mat = new THREE.MeshBasicMaterial({ map: texture }); s.materials?.add(mat);
  const plate = s._mesh(t.geo(`sign:${width}`, () => new THREE.PlaneGeometry(width, width / 6)), mat, parent, position); plate.name = 'campus-confirmed-room-sign'; plate.castShadow = false;
}

function projectingVestibule(s, frame, feature, t) {
  const w=feature.width, h=feature.height, d=feature.depth, low=-h/2;
  const body=s._group(frame); body.name='campus-production1-projecting-vestibule';
  t.boxes(body, [
    [[-w/2+.06,0,d/2],[.12,h,d]], [[w/2-.06,0,d/2],[.12,h,d]],
    [[0,low+.035,d/2],[w,.07,d+.1]], [[0,h/2-.06,d/2],[w,.12,d]],
    [[-w/2+.045,0,d],[.09,h,.09]], [[w/2-.045,0,d],[.09,h,.09]],
  ], 'white');
  const dw=w-.18, dh=2.2, cx=0;
  t.box(body,[dw,dh,.012],[cx,low+dh/2,.015],'dark');
  t.box(body,[dw,.3,.09],[cx,h/2-.15,d],'white');
  for (const side of [-1,1]) {
    // The 11/12 entry walk shows a two-track frosted sliding outer door.
    // One panel overlaps the other; no swing leaf projects into the apron.
    const closed=cx+side*dw/4;
    const leaf=s._group(body,[closed,low+.07,d+.055+(side>0?.045:0)]);
    leaf.name='campus-vestibule-glass-door-leaf';
    Object.assign(leaf.userData,{outerSlidingPanel:true,panelRole:side<0?'sliding':'overlap-panel',sourceTimesSeconds:[0,4,6,8]});
    if(side<0)leaf.userData.proximityDoor={enterable:false,accessBasis:'exterior vestibule only; no connected modelled room',kind:'slide',axis:'x',closed,open:cx+dw/4-.045,trigger:[cx,low+.07,d+.055],width:dw/2,height:dh,openDistance:2.2,closeDistance:3.1};
    const x=0;
    t.box(leaf,[dw/2-.045,dh-.075,.035],[x,dh/2,0],'frosted');
    t.boxes(leaf,[[[x-dw/4,dh/2,.03],[.04,dh,.065]],[[x+dw/4,dh/2,.03],[.04,dh,.065]],[[x,.03,.03],[dw/2,.06,.065]],[[x,dh-.03,.03],[dw/2,.06,.065]]],'white');
    t.bar(leaf,[-side*(dw/4-.08),.82,.1],[-side*(dw/4-.08),1.15,.1],.014,'steel');
  }
  const tracks=s._group(body);tracks.name='campus-vestibule-sliding-door-tracks';
  for(const z of [d+.04,d+.1])for(const y of [low+.065,low+dh+.085])t.box(tracks,[dw+.08,.025,.025],[cx,y,z],'steel');
  const canopy=s._group(body); canopy.name='campus-vestibule-deep-concrete-canopy';
  // The filmed slab ends at the supporting facade and overhangs the front
  // doors. Its former centred box buried half a metre in the main wall.
  const canopyDepth=d+.5, canopyCenter=canopyDepth/2-.05;
  t.box(canopy,[w+1.1,.45,canopyDepth],[0,h/2+.2,canopyCenter],'concrete');
  t.box(canopy,[w+1.12,.065,canopyDepth+.03],[0,h/2+.45,canopyCenter+.015],'white');
  t.cyl(canopy,.13,.035,[.35,h/2-.045,d*.67],'white');
  // The narrow green side window and map board are on the original wall,
  // beside the projecting enclosure rather than on its front door leaves.
  t.box(body,[.6,1.75,.055],[-w/2-1.12,low+1.55,.055],'glass');
  t.boxes(body,[[[-w/2-1.45,low+1.55,.09],[.065,1.85,.08]],[[-w/2-.79,low+1.55,.09],[.065,1.85,.08]],[[-w/2-1.12,low+.63,.09],[.71,.065,.08]],[[-w/2-1.12,low+2.48,.09],[.71,.065,.08]],[[-w/2-1.12,low+.95,.09],[.65,.055,.09]]],'steel');
  const board=s._group(body,[-w/2-.45,low+1.48,.11]); board.name='campus-entrance-green-site-map-board';
  t.box(board,[.65,.78,.04],[0,0,0],'white'); t.box(board,[.23,.7,.015],[-.18,0,.03],'greenWall');
  t.boxes(board,[[[.08,.19,.04],[.25,.17,.01]],[[.08,-.02,.04],[.25,.16,.01]],[[.08,-.22,.04],[.25,.17,.01]]],'frosted');
  sign(s,body,feature.name,1.12,[0,h/2-.12,d+.12],t);
  sign(s,body,'HEE CHANG',.56,[-w/2-.45,low+1.87,.15],t);
  t.box(body,[.16,.28,.035],[-w/2-.06,low+1.66,.15],'blue');
  // Fixed low collision rails and the yellow wall-side boundary line.
  const guard=s._group(body); guard.name='campus-vestibule-yellow-black-collision-rails';
  for(const [a,b] of [[-w/2-1.65,-w/2-.16],[w/2+.15,w/2+1.45]]) {
    const z=.63, y=low+.53;
    t.bar(guard,[a,y,z],[b,y,z],.045,'yellow');
    for(const x of [a,b]) {t.cyl(guard,.05,.46,[x,low+.23,z],'black');t.cyl(guard,.05,.14,[x,low+.49,z],'yellow');}
    for(let x=a+.12;x<b;x+=.28)t.cyl(guard,.047,.13,[x,y,z],'black','x');
  }
  t.box(body,[w+4.1,.018,.085],[0,low+.018,.91],'yellow');
  const drain=s._group(body,[w/2+.25,low+.02,d+.15]);drain.name='campus-vestibule-side-drain-grating';
  t.box(drain,[.22,.035,1.1],[0,0,0],'dark');
  t.boxes(drain,Array.from({length:12},(_,i)=>[[0,.025,-.5+i*.09],[.21,.018,.025]]),'steel');
  const fire=s._group(body,[w/2+.5,low+.28,.2]); fire.name='campus-vestibule-red-fire-service-fitting';
  t.cyl(fire,.08,.48,[0,0,0],'binRed');t.pipe(fire,[[0,.18,0],[0,.4,0],[.22,.4,0]],.055,'binRed');
  Object.assign(frame.userData,{projectingVestibule:true,projectionMetres:d,actualDoorLeafCount:2,actualDoorType:'two-panel-frosted-sliding',doorOpeningSideUnmeasured:true,interiorAdded:false,source:feature.source});
}

function exteriorFeature(s, parent, feature, t) {
  const w = feature.width || 2, h = feature.height || 2.2, d = feature.depth || .12;
  const frame = s._group(parent, feature.position || [0, 0, 0]); frame.name = `campus-exterior-${feature.id || feature.kind}`; frame.rotation.y = feature.yaw || 0;
  if (feature.datum === 'base') frame.position.y += h / 2;
  // The feature's local face points along +Z. Keep it outside its supporting
  // wall, with its given centre/base datum unchanged on the other axes.
  frame.translateZ(.05);
  Object.assign(frame.userData, { name: feature.name || '', plateText: feature.plateText || '', source: feature.source, nominalDimensionsMeasured: false, featureKind: feature.kind });
  const paint = feature.paint || 'white';
  if (['workshop-door', 'perforated-door', 'paired-door', 'roller-door'].includes(feature.kind)) {
    // An exterior-only building retains a shallow dark reveal; opening a
    // door does not invent an unseen interior or expose a wall-coloured leaf.
    t.box(frame, [w - .08, h - .04, .008], [0, 0, -.025], 'dark');
    frame.userData.shallowDoorRecess = true;
  }
  if (feature.kind === 'projecting-vestibule') {
    projectingVestibule(s,frame,feature,t);
  } else if (feature.kind === 'gas-riser') {
    const low = -h / 2, y = low + h * .47;
    const pipe = t.pipe(frame, [[0, low + .13, .55], [0, low + .4, .18], [0, h / 2 - .22, .18], [-.18, h / 2 - .12, .08]], .115, 'yellow'); pipe.name = 'campus-yellow-gas-riser';
    t.cyl(frame, .18, .44, [0, y, .18], 'steel');
    for (const dy of [-.25, .25]) t.flange(frame, .23, [0, y + dy, .18]);
    t.cyl(frame, .038, .34, [0, y, .43], 'steel', 'z');
    const wheel = t.ring(frame, .31, .021, [0, y, .63], 'steel', 'z'); wheel.name = 'campus-gas-riser-handwheel';
    for (let a = 0; a < TAU; a += TAU / 5) t.bar(frame, [0, y, .63], [Math.cos(a) * .29, y + Math.sin(a) * .29, .63], .014);
    for (const yy of [low + .7, h / 2 - .65]) t.box(frame, [.45, .075, .12], [0, yy, .04], 'yellow');
  } else if (feature.kind === 'electrical-gantry') {
    for (const x of [-w / 2, w / 2]) t.cyl(frame, .055, h, [x, 0, 0], 'steel');
    for (const z of [-d / 2, d / 2]) {
      t.box(frame, [w + .15, .09, .08], [0, h * .15, z]);
      for (const x of [-w / 2, w / 2]) t.bar(frame, [x, -h * .15, 0], [x, h * .15, z], .035);
    }
    for (let phase = 0; phase < 3; phase++) {
      const stack = s._group(frame, [(phase - 1) * w * .29, h * .15 + .08, 0]); stack.name = `campus-roof-gantry-insulator-${phase + 1}`;
      t.cyl(stack, .034, h * .25, [0, h * .12, 0], 'steel');
      for (let ring = 0; ring < 6; ring++) t.cyl(stack, .085, .035, [0, .07 + ring * h * .035, 0], 'cream');
      t.bar(stack, [0, h * .25, 0], [0, h * .28, d * .38], .012, 'dark');
      stack.userData.observedExterior = true;
    }
    Object.assign(frame.userData, { visibleInsulatorStacks: 3, transformerAdded: false, source: feature.source || 'clip-001-178s' });
  } else if (feature.kind === 'door-controller') {
    // The control pose sits one casing depth outside its supporting wall.
    // Set the centre half a depth behind that face so its back meets the wall.
    frame.translateZ(-d/2-.05);
    t.box(frame, [w, h, d], [0, 0, 0], 'white');
    t.box(frame, [w * .68, h * .55, .025], [0, h * .1, d / 2 + .02], 'cream');
    t.box(frame, [w * .36, h * .18, .025], [0, h * .2, d / 2 + .05], 'dark');
    for (const x of [-w * .18, w * .18]) t.cyl(frame, .025, .025, [x, -h * .08, d / 2 + .06], 'black', 'z');
    t.cyl(frame, .06, .04, [0, h / 2 + .025, 0], 'steel');
    const beacon = t.cyl(frame, .055, .13, [0, h / 2 + .11, 0], 'binRed'); beacon.name = 'campus-fast-door-red-beacon';
    t.pipe(frame, [[w * .3, -h / 2, 0], [w * .3, -h / 2 - .18, 0], [-w * .3, -h / 2 - .25, 0]], .018, 'dark');
  } else if (feature.kind === 'wash-tank') {
    const low = -h / 2, basin = s._group(frame); basin.name = 'campus-stainless-raised-wash-tank';
    const bh = Math.min(.56, h * .48), cy = h / 2 - bh / 2;
    t.boxes(basin, [
      [[0, cy - bh / 2, 0], [w, .045, d]], [[0, cy, -d / 2], [w, bh, .04]], [[0, cy, d / 2], [w, bh, .04]],
      [[-w / 2, cy, 0], [.04, bh, d]], [[w / 2, cy, 0], [.04, bh, d]],
    ]);
    for (const x of [-w * .4, w * .4]) for (const z of [-d * .35, d * .35]) t.box(basin, [.075, h - bh, .075], [x, low + (h - bh) / 2, z]);
    t.pipe(basin, [[0, cy - bh / 2, 0], [0, low + .18, 0], [0, low + .18, d / 2 + .23]], .048, 'steel');
  } else if (feature.kind === 'insulated-mains') {
    const mains = s._group(frame); mains.name = 'campus-visible-insulated-floor-mains';
    for (const z of [-d * .33, 0, d * .33]) {
      t.cyl(mains, .105, w, [0, -h / 2 + .24, z], 'gasShell', 'x');
      for (const x of [-w * .34, w * .34]) t.cyl(mains, .125, .12, [x, -h / 2 + .24, z], 'steel', 'x');
    }
    for (const x of [-w * .35, w * .35]) t.box(mains, [.1, .12, d + .12], [x, -h / 2 + .06, 0], 'concrete');
  } else if (feature.kind === 'workshop-door') {
    // clip001 1:58-2:02: grey paired steel door. The left leaf stays shut and
    // carries the 무재해 sign, the small 공무작업장 plate and the restricted-
    // entry sign; the right leaf swings out. Green floor and tool racks inside.
    for (const x of [-w / 2 - .045, w / 2 + .045]) t.box(frame, [.09, h + .09, .05], [x, .045, -.03], 'dark');
    t.box(frame, [w + .18, .09, .05], [0, h / 2 + .045, -.03], 'dark');
    t.box(frame, [w / 2 - .05, .02, .12], [w / 4, -h / 2 + .012, .06], 'greenRoof');
    const leafW = w / 2 - .02;
    const shutPivot = proximityDoor(s._group(frame, [-w / 2, 0, .02]), 'hinge', -1.3, [0, -h / 2, 0], w, h); shutPivot.name = 'campus-workshop-left-door-pivot';
    const shut = s._group(shutPivot, [w / 4, 0, 0]); shut.name = 'campus-workshop-shut-left-leaf';
    t.box(shut, [leafW, h - .03, .05], [0, 0, 0], 'gasShell');
    t.box(shut, [.04, .3, .05], [leafW / 2 - .1, -.05, .05], 'steel');
    t.box(shut, [.3, .4, .015], [-.08, .28, .03], 'signalGreen');
    t.box(shut, [.2, .13, .015], [.22, .27, .03], 'cream');
    t.box(shut, [.36, .1, .015], [-.08, .0, .03], 'blue');
    for (const y of [-h / 2 + .25, h / 2 - .25]) t.box(shut, [.03, .14, .04], [-leafW / 2 + .02, y, .02], 'steel');
    const open = proximityDoor(s._group(frame, [w / 2, 0, .04]), 'hinge', 1.3, [0, -h / 2, 0], w, h); open.name = 'campus-workshop-open-right-leaf';
    open.userData.filmedOpenAngle = 1.3;
    t.box(open, [leafW, h - .03, .05], [-leafW / 2, 0, 0], 'gasShell');
    for (const y of [-.72, .25]) t.box(open, [leafW - .06, .025, .055], [-leafW / 2, y, .01], 'steel');
    t.box(open, [.04, .3, .05], [-leafW + .1, -.05, .05], 'steel');
    const tools = s._group(frame, [w / 4, 0, .0]); tools.name = 'campus-workshop-visible-tool-shelves';
    for (const y of [-h * .3, -h * .05, h * .2]) t.box(tools, [w * .4, .035, .07], [0, y, 0]);
    for (const x of [-w * .2, w * .2]) t.box(tools, [.035, h * .62, .07], [x, -h * .08, 0]);
    const drawers = []; for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) drawers.push([[(col - 1) * w * .12, -h * .22 + row * h * .25, .02], [w * .1, h * .08, .04]]);
    t.boxes(tools, drawers, 'blue');
    Object.assign(frame.userData, { interiorExtentConfirmed: false, visibleToolsOnly: true, leafCount: 2, filmedOpenLeaf: 'right', openLeaf: null, plateOnLeaf: true });
  } else if (feature.kind === 'perforated-door') {
    const pivot = proximityDoor(s._group(frame, [-w / 2, 0, 0]), 'hinge', -Math.PI / 2, [0, -h / 2, 0], w, h); pivot.name = 'campus-perforated-door-pivot';
    const leaf = s._group(pivot, [w / 2, 0, 0]);
    t.box(leaf, [w, h, .04], [0, 0, 0], 'cream');
    const holes = [];
    for (let x = -w / 2 + .08; x < w / 2 - .06; x += .075) for (let y = -h / 2 + .08; y < h / 2 - .06; y += .075) {
      if (Math.abs(x) < .045 || (Math.abs(y - h * .15) < h * .18 && Math.abs(x) < w * .35)) continue;
      holes.push([[x, y, .024], [.028, .033, .009]]);
    }
    const perforations = t.boxes(leaf, holes, 'dark'); if (perforations) perforations.name = 'campus-door-perforated-pattern';
    for (const x of [-w / 2, w / 2]) t.box(frame, [.06, h + .08, .065], [x, .04, .045], 'white');
    t.box(frame, [w + .06, .07, .065], [0, h / 2, .045], 'white');
    for (const x of [-.07, .07]) t.cyl(leaf, .04, .04, [x, -h * .13, .06], 'steel', 'z');
    if (feature.name) sign(s, leaf, feature.name, Math.min(w, 1.6), [0, h * .18, .045], t);
  } else if (feature.kind === 'paired-door') {
    for (const side of [-1, 1]) {
      const leaf = proximityDoor(s._group(frame, [side * w / 2, 0, 0]), 'hinge', side * Math.PI / 2, [0, -h / 2, 0], w, h); leaf.name = `campus-paired-door-leaf-${side}`;
      t.box(leaf, [w / 2 - .025, h, d], [-side * w / 4, 0, 0], feature.paint && feature.paint !== 'white' ? paint : 'frosted');
      t.box(leaf, [.035, h, .085], [-side * (w / 2 - .0125), 0, d / 2 + .025], 'white');
      t.box(leaf, [.025, .22, .04], [-side * (w / 2 - .11), -.05, d / 2 + .09], 'steel');
    }
    t.boxes(frame, [[[-w / 2, 0, d / 2 + .025], [.075, h + .09, .085]], [[w / 2, 0, d / 2 + .025], [.075, h + .09, .085]], [[0, h / 2, d / 2 + .025], [w + .08, .075, .085]], [[0, -h / 2, d / 2 + .025], [w + .08, .075, .085]]], 'white');
    if (feature.name) sign(s, frame, feature.name, Math.max(1.5, w), [0, h / 2 + .27, d / 2 + .07], t);
  } else if (feature.kind === 'roller-door') {
    const curtain = proximityDoor(s._group(frame), 'lift', h * .4825, [0, -h / 2, 0], w, h); curtain.name = 'campus-moving-roller-curtain'; curtain.userData.proximityDoor.retract = true;
    t.box(curtain, [w, h, d], [0, 0, 0], paint);
    const slats = []; for (let y = -h / 2 + .18; y < h / 2; y += .18) slats.push([[0, y, d / 2 + .01], [w, .012, .025]]); t.boxes(curtain, slats, paint === 'orange' ? 'orange' : 'dark');
    t.boxes(frame, [[[-w / 2 - .1, 0, .06], [.19, h + .22, .22]], [[w / 2 + .1, 0, .06], [.19, h + .22, .22]], [[0, h / 2 + .18, .14], [w + .5, .36, .38]]], 'steel');
    if (paint === 'orange') for (const x of [-w * .27, w * .27]) { t.box(frame, [w * .43, .26, .32], [x, h / 2 + .52, .13], 'white'); t.box(frame, [w * .38, .035, .27], [x, h / 2 + .38, .14], 'dark'); }
  } else if (feature.kind === 'horizontal-windows' || feature.kind === 'strip-window') {
    t.box(frame, [w, h, .06], [0, 0, 0], feature.paint || 'glass');
    const frames = [[[-w / 2, 0, .07], [.055, h + .06, .08]], [[w / 2, 0, .07], [.055, h + .06, .08]], [[0, -h / 2, .07], [w, .055, .08]], [[0, h / 2, .07], [w, .055, .08]]];
    if (feature.kind === 'horizontal-windows') {
      const panes = feature.panes || feature.count || Math.max(2, Math.round(w / 1.1));
      for (let i = 1; i < panes; i++) frames.push([[(i / panes - .5) * w, 0, .07], [.04, h, .08]]);
      if (h > .9) frames.push([[0, 0, .08], [w, .035, .08]]);
    } else {
      const levels = feature.divisions || Math.max(2, Math.round(h / 3.5));
      for (let i = 1; i < levels; i++) frames.push([[0, (i / levels - .5) * h, .07], [w, .06, .08]]);
      frames.push([[0, 0, .08], [.055, h, .08]]);
    }
    t.boxes(frame, frames, 'white');
  } else if (feature.kind === 'pipe-rack') {
    const depth = feature.depth || 1.8, count = feature.pipeCount || 4;
    const rack = []; for (const x of [-w / 2, w / 2]) for (const z of [-depth / 2, depth / 2]) rack.push([[x, 0, z], [.1, h, .1]]);
    for (const z of [-depth / 2, depth / 2]) rack.push([[0, h / 2, z], [w, .14, .1]]);
    for (const x of [-w / 2, 0, w / 2]) rack.push([[x, h / 2, 0], [.1, .14, depth]]);
    t.boxes(frame, rack, 'steel');
    const longitudinalZ = feature.pipeAxis === 'z' || (feature.pipeAxis !== 'x' && depth > w);
    for (let i = 0; i < count; i++) {
      const q = (i / Math.max(1, count - 1) - .5) * .8;
      t.cyl(frame, .055, (longitudinalZ ? depth : w) + .5, longitudinalZ ? [q * w, h / 2 + .15, 0] : [0, h / 2 + .15, q * depth], 'steel', longitudinalZ ? 'z' : 'x');
    }
  } else if (feature.kind === 'pipe-bridge') {
    // clip001 2:58-3:00: a steel post rises from the 공무작업장 roof corner and
    // carries insulated pipes across the back road onto the dryer annex.
    const span = feature.span || 12, roofY = feature.roofHeight ?? 6.5, low = -h / 2, top = h / 2;
    const bridge = s._group(frame); bridge.name = 'campus-road-crossing-pipe-bridge';
    for (const x of [-.45, .45]) t.box(bridge, [.16, top - (low + roofY), .16], [x, (top + low + roofY) / 2, 0], 'steel');
    t.box(bridge, [1.15, .14, .18], [0, top - .07, 0], 'steel');
    const count = feature.pipeCount || 3;
    for (let i = 0; i < count; i++) t.cyl(bridge, i === 0 ? .17 : .12, span, [(i - (count - 1) / 2) * .34, top + .16, span / 2], 'gasShell', 'z');
    for (let z = 2.5; z < span - .8; z += 3.2) t.box(bridge, [1.05, .08, .1], [0, top + .03, z], 'steel');
    t.box(bridge, [1.1, .5, .4], [0, top - .2, span - .3], 'steel');
    Object.assign(bridge.userData, { source: feature.source, spanMetres: span, crossesRoad: true, contentsConfirmed: false });
  }
  if (feature.canopy) {
    const c = feature.canopy, cw = c.width || w + .7, cd = c.depth || 1.8, ch = c.height || .24;
    const canopy=t.box(frame, [cw, ch, cd], [0, h / 2 + .65 + ch / 2, cd / 2 - .05], c.paint || 'concrete');
    canopy.name='campus-exterior-door-canopy';
  }
  if (feature.steps || feature.stairs) {
    const steps = feature.steps || feature.stairs, count = steps.count || steps.steps || 4, rise = steps.rise || (steps.height ? steps.height / count : .2), run = steps.run || .3, sw = steps.width || w;
    const stairs = s._group(frame, [0, -h / 2, .2]); stairs.name = 'campus-office-visible-short-metal-stairs';
    for (let i = 0; i < count; i++) t.box(stairs, [sw, .045, run], [0, -i * rise, (i + .5) * run], 'steel');
    for (const side of [-1, 1]) {
      t.bar(stairs, [side * sw / 2, .05 - count * rise, count * run], [side * sw / 2, .05, 0], .045);
      t.bar(stairs, [side * sw / 2, 1.0 - count * rise, count * run], [side * sw / 2, 1, 0], .035);
      for (const i of [0, count]) t.bar(stairs, [side * sw / 2, .04 - i * rise, i * run], [side * sw / 2, 1 - i * rise, i * run], .028);
    }
  }
  return frame;
}

export function addCampusRearDetails(s, root, item, { materials } = {}) {
  const features = item.exteriorDetails || [], rounded = item.type === 'campus-guardhouse' && item.videoRoundedCorner !== false;
  if (!features.length && !rounded) return false;
  if (rounded) guardRoundedCorner(s, root, item, materials);
  const t = rearTools(s, materials);
  // Reuse the third selectable part instead of introducing extra explosion
  // levels merely to add facade features.
  const parent = root.children[2] || root;
  for (const feature of features) exteriorFeature(s, parent, feature, t);
  return true;
}
