import * as THREE from '../shared/vendor/three.module.js';

// Current 1팀 2파트 preparation-room footage, 2026-11-11. Explicit catalog
// metadata owns identities and counts; a second view from below a tank does
// not create another vessel. Dimensions and hidden connections are unmeasured.
const PI = Math.PI, TAU = PI * 2, UP = new THREE.Vector3(0, 1, 0);
export const PREPARATION_MODEL_KINDS = Object.freeze(['tank-group', 'platform', 'control-panel', 'powder-hopper', 'homogenizer', 'service-pump', 'filter-pot', 'under-platform-services']);

function resources(s) {
  if (s._preparationResources) return s._preparationResources;
  const colors = { steel: 0xbdc8c9, trim: 0x899da1, cream: 0xdddcc9, white: 0xe1e7df, dark: 0x334448, black: 0x202b2e, blue: 0x387e91, green: 0x397c65, red: 0x9b4943, yellow: 0xd3bc5c, orange: 0xc78062, screen: 0x243a42 };
  const materials = Object.fromEntries(Object.entries(colors).map(([name, color]) => {
    const material = s._material ? s._material(color, ['steel', 'trim'].includes(name) ? .3 : .65, ['steel', 'trim'].includes(name) ? .72 : .12) : new THREE.MeshStandardMaterial({ color });
    s.materials?.add(material); return [name, material];
  }));
  const geometries = new Map();
  const geo = (key, make) => { if (!geometries.has(key)) { const value = make(); geometries.set(key, value); s.geometries?.add(value); } return geometries.get(key); };
  const mesh = (parent, geometry, position = [0, 0, 0], paint = 'steel', name) => { const value = s._mesh(geometry, materials[paint] || materials.steel, parent, position); if (name) value.name = `preparation-${name}`; return value; };
  const box = (parent, size, position, paint = 'steel', name) => { const value = mesh(parent, geo('unit-box', () => new THREE.BoxGeometry(1, 1, 1)), position, paint, name); value.scale.set(...size); return value; };
  const cylinder = (parent, radius, height, position, paint = 'steel', axis = 'y', name) => {
    const value = mesh(parent, geo('unit-cylinder', () => new THREE.CylinderGeometry(1, 1, 1, 24)), position, paint, name); value.scale.set(radius, height, radius);
    if (axis === 'x') value.rotation.z = PI / 2; if (axis === 'z') value.rotation.x = PI / 2; return value;
  };
  const bar = (parent, a, b, radius = .025, paint = 'trim', name) => {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start);
    if (delta.lengthSq() < 1e-10) return null;
    const value = cylinder(parent, radius, delta.length(), start.add(end).multiplyScalar(.5).toArray(), paint, 'y', name); value.quaternion.setFromUnitVectors(UP, delta.normalize()); return value;
  };
  const pipe = (parent, points, radius = .04, paint = 'steel', name = 'visible-pipe') => {
    const curve = new THREE.CurvePath(), vertices = points.map(p => new THREE.Vector3(...p)); let last = vertices[0];
    for (let i = 1; i < vertices.length - 1; i++) {
      const p = vertices[i], incoming = vertices[i - 1].clone().sub(p), outgoing = vertices[i + 1].clone().sub(p), bend = Math.min(.13, incoming.length() * .24, outgoing.length() * .24);
      if (bend < 1e-5) continue;
      const entry = p.clone().addScaledVector(incoming.normalize(), bend), exit = p.clone().addScaledVector(outgoing.normalize(), bend);
      if (last.distanceToSquared(entry) > 1e-10) curve.add(new THREE.LineCurve3(last, entry));
      curve.add(new THREE.QuadraticBezierCurve3(entry, p, exit)); last = exit;
    }
    if (last.distanceToSquared(vertices.at(-1)) > 1e-10) curve.add(new THREE.LineCurve3(last, vertices.at(-1)));
    return mesh(parent, new THREE.TubeGeometry(curve, Math.max(12, points.length * 8), radius, 10, false), [0, 0, 0], paint, name);
  };
  const ring = (parent, radius, position, paint = 'trim', axis = 'y', tube = .018, name = 'clamp-ring') => {
    const value = mesh(parent, geo(`ring:${radius}:${tube}`, () => new THREE.TorusGeometry(radius, tube, 6, 28)), position, paint, name);
    if (axis === 'y') value.rotation.x = PI / 2; if (axis === 'x') value.rotation.y = PI / 2; return value;
  };
  const repeated = (parent, entries, paint, name, geometry = geo('unit-box', () => new THREE.BoxGeometry(1, 1, 1))) => {
    if (!entries.length) return null;
    const value = new THREE.InstancedMesh(geometry, materials[paint], entries.length), matrix = new THREE.Matrix4();
    entries.forEach(({ position, scale, rotation = [0, 0, 0] }, index) => { matrix.compose(new THREE.Vector3(...position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(...scale)); value.setMatrixAt(index, matrix); });
    value.instanceMatrix.needsUpdate = true; value.name = `preparation-${name}`; value.castShadow = value.receiveShadow = true; value.computeBoundingBox(); value.computeBoundingSphere(); parent.add(value); return value;
  };
  const flange = (parent, p, r = .09, axis = 'z') => {
    const g = s._group(parent, p); g.name = 'preparation-visible-flange'; if (axis === 'y') g.rotation.x = PI / 2; if (axis === 'x') g.rotation.y = PI / 2;
    cylinder(g, r, .045, [0, 0, 0], 'trim', 'z');
    repeated(g, Array.from({ length: 6 }, (_, i) => ({ position: [Math.cos(i * TAU / 6) * r * .75, Math.sin(i * TAU / 6) * r * .75, .03], scale: [.02, .02, .022] })), 'dark', 'instanced-joint-bolts'); return g;
  };
  const gauge = (parent, p, r = .09) => {
    const g = s._group(parent, p); g.name = 'preparation-exterior-gauge'; cylinder(g, r, .045, [0, 0, 0], 'white', 'z'); ring(g, r, [0, 0, .027], 'trim', 'z', .01);
    repeated(g, Array.from({ length: 11 }, (_, i) => { const a = (-.75 + i * .15) * PI; return { position: [Math.sin(a) * r * .76, Math.cos(a) * r * .76, .029], scale: [.004, r * .15, .004], rotation: [0, 0, -a] }; }), 'dark', 'gauge-graduations-without-readings');
    bar(g, [0, 0, .03], [-r * .4, r * .35, .03], .005, 'dark'); g.userData.readingConfirmed = false; return g;
  };
  const wheel = (parent, p, r = .12, paint = 'red') => { const g = s._group(parent, p); ring(g, r, [0, 0, 0], paint, 'z'); for (let i = 0; i < 4; i++) { const a = i * PI / 2; bar(g, [0, 0, 0], [Math.cos(a) * r, Math.sin(a) * r, 0], .012, paint); } cylinder(g, .026, .09, [0, 0, -.045], 'trim', 'z'); return g; };
  const motor = (parent, p, radius = .16, length = .45, vertical = true, paint = 'dark') => {
    const g = s._group(parent, p); g.name = 'preparation-observed-motor'; cylinder(g, radius, length, [0, 0, 0], paint, vertical ? 'y' : 'x');
    const fins = Array.from({ length: 14 }, (_, i) => { const a = i * TAU / 14; return vertical
      ? { position: [Math.cos(a) * (radius + .008), 0, Math.sin(a) * (radius + .008)], scale: [.018, length * .8, .012], rotation: [0, -a, 0] }
      : { position: [0, Math.cos(a) * (radius + .008), Math.sin(a) * (radius + .008)], scale: [length * .8, .018, .012], rotation: [a, 0, 0] }; });
    repeated(g, fins, paint, 'instanced-motor-fins'); box(g, [.14, .12, .13], vertical ? [radius + .06, 0, 0] : [0, radius + .05, 0], paint); return g;
  };
  const sanitaryValve = (parent, p, axis = 'y', paint = 'blue') => {
    const group = s._group(parent, p); group.name = 'preparation-filmed-sanitary-butterfly-valve';
    if (axis === 'x') group.rotation.z = PI / 2; if (axis === 'z') group.rotation.x = PI / 2;
    cylinder(group, .067, .13, [0, 0, 0]); for (const y of [-.085, .085]) { cylinder(group, .082, .025, [0, y, 0], 'trim'); ring(group, .083, [0, y, 0], 'trim', 'y', .007); }
    cylinder(group, .018, .17, [0, 0, .12], 'trim', 'z'); box(group, [.18, .027, .055], [.055, .025, .21], paint);
    box(group, [.035, .06, .035], [-.025, -.015, .21], 'dark'); group.userData.flowAndFluidUnconfirmed = true; return group;
  };
  const flex = (parent, a, b, radius = .035) => {
    const group = s._group(parent); group.name = 'preparation-filmed-braided-flex-connector'; bar(group, a, b, radius);
    const start = new THREE.Vector3(...a), delta = new THREE.Vector3(...b).sub(start), length = delta.length(), ribs = [], q = new THREE.Quaternion().setFromUnitVectors(UP, delta.clone().normalize()), rotation = new THREE.Euler().setFromQuaternion(q).toArray().slice(0, 3);
    for (let d = .015; d < length; d += .022) ribs.push({ position: start.clone().addScaledVector(delta, d / length).toArray(), scale: [radius + .006, .008, radius + .006], rotation });
    repeated(group, ribs, 'trim', 'braided-flex-metal-ribs', geo('unit-cylinder', () => new THREE.CylinderGeometry(1, 1, 1, 24))); return group;
  };
  const guard = (parent, radius, height, position) => {
    const group = s._group(parent, position); group.name = 'preparation-filmed-mixer-coupling-mesh-guard';
    const geometry = geo(`coupling-mesh:${radius}:${height}`, () => {
      const vertices = [];
      for (let i = 0; i < 32; i++) { const a = i * TAU / 32, x = Math.cos(a) * radius, z = Math.sin(a) * radius; vertices.push(x, -.5 * height, z, x, .5 * height, z); }
      for (let y = -.5 * height; y <= .5 * height + .001; y += .05) for (let i = 0; i < 32; i++) { const a = i * TAU / 32, b = (i + 1) * TAU / 32; vertices.push(Math.cos(a) * radius, y, Math.sin(a) * radius, Math.cos(b) * radius, y, Math.sin(b) * radius); }
      return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    });
    if (!materials.meshWire) { materials.meshWire = new THREE.LineBasicMaterial({ color: 0xa7b3b1 }); s.materials?.add(materials.meshWire); }
    group.add(new THREE.LineSegments(geometry, materials.meshWire));
    for (const y of [-height / 2, height / 2]) ring(group, radius + .015, [0, y, 0], 'trim', 'y', .024);
    for (const x of [-radius * .93, radius * .93]) box(group, [.055, height, .04], [x, 0, 0], 'trim');
    cylinder(group, .045, height * .94, [0, 0, 0], 'trim');
    for (const y of [-height * .27, height * .27]) cylinder(group, .11, .13, [0, y, 0], 'dark');
    return group;
  };
  return s._preparationResources = { materials, geo, mesh, box, cylinder, bar, pipe, ring, repeated, flange, gauge, wheel, motor, guard, sanitaryValve, flex };
}

function parts(s, root, item) {
  const names = item.parts?.length ? item.parts : ['외함·지지부', '상부·조작부', '촬영된 배관·부속'];
  const offsets = [[-.5, .15, 0], [0, .7, 0], [.5, .2, .4], [0, .2, .7]];
  return names.map((name, i) => s._part(root, name, offsets[i % offsets.length]));
}

function plateText(s, parent, text, t) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return;
  const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 112;
  const ctx = canvas.getContext?.('2d'); if (!ctx) return;
  ctx.fillStyle = '#d9dcd8'; ctx.fillRect(0, 0, 320, 112); ctx.fillStyle = '#25302c'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '600 50px "Malgun Gothic", sans-serif'; ctx.fillText(text, 160, 58, 300);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; s.textures?.add(texture);
  const material = new THREE.MeshBasicMaterial({ map: texture }); s.materials?.add(material);
  const face = s._mesh(t.geo('tank-plate-face', () => new THREE.PlaneGeometry(.44, .15)), material, parent, [0, 0, .012]); face.castShadow = false;
}

function tankLowerDetails(s, parent, unit, r, base, t) {
  const config = unit.lowerDetails; if (!config) return;
  const group = s._group(parent); group.name = 'preparation-filmed-under-tank-service-assembly';
  Object.assign(group.userData, { sourceTimes: [387,393,399,417,429], exteriorOnly: true, functionalConnectionUnconfirmed: true });
  const neckY = base - .27;
  t.sanitaryValve(group, [0, neckY, 0], 'y', 'blue');
  for (const y of [base - .16, base - .45]) t.flange(group, [0, y, 0], .085, 'y');
  const outletX = config.outletX ?? 1, outletY = config.outletY ?? .28;
  t.pipe(group, [[0, base - .43, 0], [0, outletY, 0], [outletX, outletY, 0], [outletX, outletY, .35]], .035, 'steel', 'filmed-low-tank-outlet-tee');
  t.pipe(group, [[outletX, outletY, -.4], [outletX, outletY, .5]], .035, 'steel', 'filmed-low-outlet-cross-run');
  t.flange(group, [outletX, outletY, .48], .07);
  if (config.inspectionPort) {
    t.cylinder(group, .145, .055, [r + .012, base + .58, 0], 'trim', 'x', 'lower-shell-round-inspection-cover');
    t.ring(group, .13, [r + .045, base + .58, 0], 'trim', 'x', .013);
    t.cylinder(group, .05, .055, [r + .075, base + .58, 0], 'steel', 'x');
  }
  if (config.flexConnection) {
    t.pipe(group, [[r * .38, base + .06, 0], [r * .38, base - .22, 0], [r + .05, base - .22, 0]], .035);
    t.flex(group, [r + .05, base - .22, 0], [r + .43, base - .22, 0]);
    for (const x of [r + .03, r + .45]) t.flange(group, [x, base - .22, 0], .065, 'x');
  }
  if (config.sensorCable) {
    const sensor = s._group(group, [r * .63, base + .14, -.18]); sensor.name = 'preparation-filmed-bottom-sensor-and-protective-cable';
    t.bar(sensor, [0, 0, 0], [.1, -.17, 0], .018); t.cylinder(sensor, .065, .055, [.12, -.2, 0], 'trim', 'z');
    t.pipe(group, [[r * .63 + .12, base - .06, -.16], [r + .25, base - .23, -.17], [r + .28, .12, -.22]], .012, 'black', 'visible-flexible-sensor-cable');
    t.pipe(group, [[.15, base - .26, .12], [.55, base - .32, .17], [r + .21, base - .3, .22]], .012, 'blue', 'visible-lower-blue-airline');
    const plate = t.geo('under-tank-perforated-protector', () => {
      const shape = new THREE.Shape(); shape.moveTo(-.11,0); shape.lineTo(.11,0); shape.lineTo(.11,.75); shape.lineTo(-.11,.75); shape.closePath();
      for (let row = 0; row < 12; row++) for (let column = 0; column < 3; column++) { const path = new THREE.Path(); path.absarc((column - 1) * .058, .055 + row * .058, .016, 0, TAU, true); shape.holes.push(path); }
      return new THREE.ExtrudeGeometry(shape, { depth: .012, bevelEnabled: false, curveSegments: 8 });
    });
    const cover = t.mesh(group, plate, [r + .23, .06, -.27], 'trim', 'filmed-perforated-lower-pipe-protector'); cover.rotation.y = PI / 2;
  }
  if (config.actuator) {
    const actuator = s._group(group, [.18, neckY - .12, .19]); actuator.name = 'preparation-filmed-bottom-valve-actuator-exterior';
    t.box(actuator, [.25,.19,.17], [0,0,0], 'dark'); t.box(actuator, [.09,.14,.1], [.16,0,0], 'cream');
    t.pipe(actuator, [[-.08,.04,.1],[-.08,.13,.16],[.28,.13,.16]], .009, 'blue');
    actuator.userData.hiddenMechanismAdded = false;
  }
}

function tankGroup(s, g, item, config, t) {
  const records = [];
  for (let index = 0; index < config.vessels.length; index++) {
    const unit = config.vessels[index], x = unit.x || 0, z = unit.z || 0, r = unit.radius || .85, h = unit.bodyHeight || 2.25, base = unit.baseHeight ?? .45;
    const body = s._group(g[0], [x, 0, z]); body.name = 'preparation-current-tank-body'; body.rotation.y = unit.rotation || 0;
    Object.assign(body.userData, { preparationVesselId: unit.id || `${item.id}-${index + 1}`, label: unit.label || '', sourceTimes: unit.sourceTimes || config.sourceTimes || [], currentDimensionsMeasured: false });
    const profile = [[0, base - .12], [r * .2, base - .1], [r * .5, base + .02], [r * .8, base + .18], [r * .96, base + .36], [r, base + .48], [r, base + h - .2], [r * .94, base + h - .04], [r * .65, base + h + .11], [r * .25, base + h + .17], [0, base + h + .17]];
    t.mesh(body, t.geo(`vessel:${r}:${h}:${base}`, () => new THREE.LatheGeometry(profile.map(p => new THREE.Vector2(...p)), 36)), [0, 0, 0], 'steel', 'closed-dished-vessel-shell');
    for (const y of [base + .27, base + h - .18]) t.ring(body, r + .008, [0, y, 0]);
    const deckY = Number.isFinite(unit.deckElevation) ? unit.deckElevation : null;
    if (deckY !== null && deckY > base + .3 && deckY < base + h - .25) {
      // 11/11 prep clip 4:31, 4:51, 6:40: the vessels hang from the platform on
      // welded gusset lugs; there are no legs to the floor under the dished
      // bottom, which carries a valved centre outlet and a drop line.
      const lugs = s._group(body); lugs.name = 'preparation-tank-deck-support-lugs';
      for (let i = 0; i < 4; i++) {
        const a = i * TAU / 4 + PI / 4, cx = Math.cos(a), cz = Math.sin(a), lug = s._group(lugs, [cx * (r + .1), deckY, cz * (r + .1)]);
        lug.rotation.y = -a;
        t.box(lug, [.3, .02, .26], [.02, .01, 0], 'trim');
        for (const dz of [-.07, .07]) { const plate = t.box(lug, [.22, .3, .014], [-.02, .16, dz], 'steel'); plate.rotation.z = .5; }
        t.box(lug, [.05, .32, .16], [-.12, .2, 0], 'steel');
      }
      lugs.userData.restsOnDeck = deckY;
      if (!unit.lowerDetails) {
        const outlet = s._group(body); outlet.name = 'preparation-tank-bottom-outlet-and-drop-line';
        t.cylinder(outlet, .045, .2, [0, base - .2, 0]);
        t.flange(outlet, [0, base - .28, 0], .07, 'y');
        t.box(outlet, [.16, .12, .12], [0, base - .38, 0], 'steel');
        t.wheel(outlet, [.12, base - .38, 0], .07, 'trim').rotation.y = PI / 2;
        t.pipe(outlet, [[0, base - .44, 0], [0, .32, 0], [.05, .1, .12], [.35, .06, .32]], .03, 'trim', 'bottom-drop-line');
        t.cylinder(outlet, .02, .22, [.12, base - .5, .05], 'dark');
      }
    } else {
      const legCount = unit.legCount || 4;
      for (let i = 0; i < legCount; i++) { const a = i * TAU / legCount + PI / 4, lx = Math.cos(a) * r * .7, lz = Math.sin(a) * r * .7; t.cylinder(body, .045, base + .3, [lx, (base + .3) / 2, lz]); t.cylinder(body, .08, .04, [lx, .02, lz], 'trim'); }
    }
    if (unit.plate && deckY !== null) {
      const plate = s._group(body, [r + .015, deckY + .36, 0]); plate.name = 'preparation-tank-shell-nameplate'; plate.rotation.y = PI / 2;
      t.box(plate, [.46, .17, .02], [0, 0, 0], 'trim'); t.box(plate, [.05, .1, .1], [0, -.11, -.05], 'trim');
      plate.userData.text = unit.plate;
      plateText(s, plate, unit.plate, t);
    }
    const cap = s._group(g[1] || g[0], [x, base + h + .16, z]); cap.name = 'preparation-tank-domed-top-exterior'; cap.rotation.y = unit.rotation || 0;
    const lidR = Math.min(.37, r * .41), lidZ = r * .4;
    const lid = s._group(cap, [0, .025, lidZ]); lid.name = 'preparation-filmed-hinged-manway-and-clamps';
    t.cylinder(lid, lidR, .065, [0, .035, 0]); t.ring(lid, lidR + .012, [0, .069, 0]);
    for (const x of [lidR * .74, -lidR * .74]) {
      t.box(lid, [.09, .055, .16], [x, .09, -.18], 'trim');
      t.cylinder(lid, .025, .13, [x, .12, -.18], 'trim', 'x');
    }
    for (const x of [-.11, .11]) t.bar(lid, [x, .075, .05], [x, .19, .05], .017);
    t.bar(lid, [-.11, .19, .05], [.11, .19, .05], .017);
    t.bar(lid, [-lidR, .09, .03], [-lidR - .09, .15, .03], .018); t.wheel(lid, [-lidR - .1, .15, .03], .045, 'trim').rotation.x = PI / 2;
    if (unit.motor) {
      const motorZ = -r * .3;
      t.cylinder(cap, .28, .12, [0, .08, motorZ], 'trim');
      t.guard(cap, .22, .86, [0, .58, motorZ]);
      t.cylinder(cap, .3, .18, [0, 1.09, motorZ], 'trim');
      t.motor(cap, [0, 1.48, motorZ], .23, .56, true, unit.motorColor || 'dark');
      t.repeated(cap, Array.from({ length: 8 }, (_, i) => { const a = i * TAU / 8; return { position: [Math.cos(a) * .255, 1.19, motorZ + Math.sin(a) * .255], scale: [.028, .035, .028] }; }), 'dark', 'mixer-base-flange-fasteners');
    }
    const services = s._group(g[2] || g[0], [x, 0, z]); services.name = 'preparation-tank-visible-services'; services.rotation.y = unit.rotation || 0;
    tankLowerDetails(s, services, unit, r, base, t);
    const portZ = r + .28;
    // Bottom outlet → short drop → low sanitary run along the floor (clip 7:00-7:02).
    const lowY = Math.max(.14, Math.min(.42, base - .5));
    if (!unit.lowerDetails) {
      t.pipe(services, [[0, base - .44, 0], [0, lowY, 0], [0, lowY, portZ], [.42, lowY, portZ]], .045);
      t.flange(services, [0, lowY, portZ - .12]);
      t.wheel(services, [.24, lowY + .16, portZ], .09);
    }
    t.pipe(services, [[r * .85, base + .5, 0], [r + .18, base + .5, 0], [r + .18, base + h - .2, 0]], .035);
    t.gauge(services, [r + .18, base + h - .05, .06], .08);
    for (const y of [base + .7, base + h - .35]) { t.flange(services, [r + .18, y, 0], .08, 'y'); t.box(services, [.1, .05, .045], [r + .18, y + .1, .09], 'blue'); }
    t.pipe(services, [[r * .55, base + h + .05, -.2], [r * .55, base + h + .38, -.2], [r * .55, base + h + .38, -.5]], .035);
    t.flange(services, [r * .55, base + h + .38, -.5], .07);
    if (unit.airLine !== false) t.pipe(services, [[r + .18, base + h - .45, .04], [r + .4, base + h - .45, .04], [r + .4, base + .7, .04]], .012, 'blue', 'visible-blue-airline');
    records.push({ id: body.userData.preparationVesselId, label: unit.label || '', x, z, radius: r });
  }
  return { observedVesselBodies: config.vessels.length, vessels: records };
}

function contains(point, outline) {
  let inside = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const [xi, zi] = outline[i], [xj, zj] = outline[j];
    if ((zi > point[1]) !== (zj > point[1]) && point[0] < (xj - xi) * (point[1] - zi) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

function platform(s, g, item, config, t) {
  const width = config.width || item.width || 10.7, depth = config.depth || item.depth || 11.5, y = config.elevation ?? 2;
  const outline = config.outline || [[-width / 2, -depth / 2], [width / 2, -depth / 2], [width / 2, depth / 2], [-width / 2, depth / 2]], holes = config.holes || [];
  const shape = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, -z)));
  for (const hole of holes) { const path = new THREE.Path(); path.absarc(hole.x, -hole.z, hole.radius, 0, TAU, true); shape.holes.push(path); }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: .09, bevelEnabled: false, curveSegments: 28 }); geo.rotateX(-PI / 2);
  const deck = t.mesh(g[0], geo, [0, y - .09, 0], 'steel', 'single-shared-checkerplate-platform');
  // Openings fit the hanging vessels closely (clip 4:31, 4:53); a thin
  // stainless edge band finishes each cut instead of a wide see-through gap.
  for (const hole of holes) t.ring(g[0], hole.radius + .012, [hole.x, y + .012, hole.z], 'trim', 'y', .02, 'deck-opening-edge-band');
  const minX = Math.min(...outline.map(p => p[0])), maxX = Math.max(...outline.map(p => p[0])), minZ = Math.min(...outline.map(p => p[1])), maxZ = Math.max(...outline.map(p => p[1]));
  const raised = [];
  for (let x = Math.ceil(minX / .2) * .2; x < maxX; x += .2) for (let z = Math.ceil(minZ / .2) * .2; z < maxZ; z += .2) {
    if (![[-.11, -.11], [-.11, .11], [.11, -.11], [.11, .11]].every(([dx, dz]) => contains([x + dx, z + dz], outline)) || holes.some(hole => Math.hypot(x - hole.x, z - hole.z) < hole.radius + .13)) continue;
    raised.push({ position: [x, y + .002, z], scale: [.075, .006, .009], rotation: [0, PI / 4, 0] }, { position: [x + .06, y + .002, z + .06], scale: [.075, .006, .009], rotation: [0, -PI / 4, 0] });
  }
  t.repeated(g[0], raised, 'trim', 'instanced-checkerplate-relief');
  const beams = s._group(g[0]); beams.name = 'preparation-platform-cream-beams-and-column-haunches'; beams.userData.structuralSupportsNotEquipment = true;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], b = outline[(i + 1) % outline.length], length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const beam = t.box(beams, [.14, .25, length], [(a[0] + b[0]) / 2, y - .21, (a[1] + b[1]) / 2], 'cream'); beam.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]);
  }
  const supports = config.supports || outline.map(([x, z]) => [[x + .18, z + .18], [x + .18, z - .18], [x - .18, z + .18], [x - .18, z - .18]].find(point => contains(point, outline) && !holes.some(hole => Math.hypot(point[0] - hole.x, point[1] - hole.z) < hole.radius + .12))).filter(Boolean);
  for (const [x, z] of supports) {
    t.box(g[0], [.16, y - .1, .16], [x, (y - .1) / 2, z], 'cream', 'platform-support-column'); t.box(g[0], [.3, .06, .3], [x, .03, z], 'trim');
    const haunch = t.geo('cream-column-haunch', () => { const shape = new THREE.Shape(); shape.moveTo(-.4, 0); shape.lineTo(.4, 0); shape.lineTo(.1, -.35); shape.lineTo(-.1, -.35); shape.closePath(); return new THREE.ExtrudeGeometry(shape, { depth: .14, bevelEnabled: false }); });
    t.mesh(beams, haunch, [x, y - .12, z - .07], 'cream', 'structural-column-haunch');
  }
  const railEdges = config.railEdges || outline.map((point, i) => ({ a: point, b: outline[(i + 1) % outline.length] }));
  for (const { a, b } of railEdges) {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]), posts = Math.max(1, Math.ceil(length / 1.5));
    for (const height of [.5, 1.0]) t.bar(g[1] || g[0], [a[0], y + height, a[1]], [b[0], y + height, b[1]], .025, 'trim', 'platform-guardrail');
    for (let i = 0; i <= posts; i++) { const x = a[0] + (b[0] - a[0]) * i / posts, z = a[1] + (b[1] - a[1]) * i / posts; t.bar(g[1] || g[0], [x, y, z], [x, y + 1, z], .025); }
  }
  if (config.stairs !== false) {
    const stairs = config.stairs || {}, run = stairs.run || 2.1, sw = stairs.width || .85, stair = s._group(g[2] || g[0], [stairs.x ?? minX + .8, 0, stairs.z ?? minZ - run]); stair.rotation.y = stairs.rotation || 0; stair.name = 'preparation-platform-access-stair';
    const count = Math.max(3, Math.ceil(y / .2));
    for (let i = 0; i < count; i++) t.box(stair, [sw, .045, run / count + .02], [0, (i + 1) * y / count, (i + .5) * run / count], 'steel');
    for (const side of [-1, 1]) { const x = side * sw / 2; t.bar(stair, [x, .06, 0], [x, y, run], .045, 'cream'); t.bar(stair, [x, .95, 0], [x, y + .95, run], .024); for (const t0 of [0, .5, 1]) t.bar(stair, [x, y * t0, run * t0], [x, y * t0 + .95, run * t0], .023); }
  }
  deck.userData.singlePlatformOwner = item.id; return { observedVesselBodies: 0, singlePlatformOwner: item.id, vesselClearanceOpenings: holes.length };
}

function controlPanel(s, g, item, config, t) {
  const w = config.width || item.width || 1.4, h = config.height || item.height || 1.65, d = config.depth || item.depth || .5, elevation = config.elevation || 0;
  const body = s._group(g[0], [0, elevation, 0]); body.name = 'preparation-filmed-control-cabinet';
  const face = s._group(g[1] || g[0], [0, elevation, 0]); face.name = 'preparation-static-control-face';
  if (config.console) {
    t.box(body, [w, h * .62, d * .73], [0, h * .31, -.05], 'cream');
    const slope = s._group(face, [0, h * .76, 0]); slope.rotation.x = -PI / 3; slope.name = 'preparation-filmed-sloped-console-face';
    t.box(slope, [w, d, .09], [0, 0, 0], 'cream');
    t.box(slope, [w * .54, d * .72, .008], [-w * .15, -.025, .05], 'white', 'visible-paper-plan');
    t.box(slope, [w * .16, d * .28, .025], [w * .32, d * .2, .061], 'screen');
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) t.cylinder(slope, .025, .025, [w * (.19 + col * .075), d * (.02 - row * .17), .062], row === 2 && col === 0 ? 'red' : row === 1 ? 'dark' : 'green', 'z');
    for (const x of [-w * .38, w * .38]) t.box(body, [.13, .12, d * .9], [x, .06, 0], 'dark');
  } else {
    t.box(body, [w, h, d], [0, h / 2, 0], 'cream');
    const doorCount = Math.max(1, Math.round(w / 1.15)), doorWidth = w / doorCount, vents = [];
    for (let i = 0; i < doorCount; i++) {
      const x = -w / 2 + (i + .5) * doorWidth;
      if (i) t.box(face, [.009, h * .96, .01], [-w / 2 + i * doorWidth, h / 2, d / 2 + .008], 'trim');
      t.bar(face, [x - doorWidth * .36, h * .46, d / 2 + .045], [x - doorWidth * .36, h * .59, d / 2 + .045], .015, 'trim');
      for (let row = 0; row < 8; row++) vents.push({ position: [x, h * .08 + row * h * .012, d / 2 + .01], scale: [doorWidth * .29, .007, .012] });
    }
    t.repeated(face, vents, 'dark', 'cabinet-door-ventilation-slots');
    t.box(face, [w * .16, h * .2, .035], [-w * .29, h * .74, d / 2 + .025], 'dark');
    t.box(face, [w * .14, h * .16, .01], [-w * .29, h * .74, d / 2 + .047], 'white', 'static-chart-recorder-face');
    for (const x of [-w * .02, w * .07]) t.gauge(face, [x, h * .81, d / 2 + .04], Math.min(.095, h * .05));
    for (let row = 0; row < 2; row++) for (let col = 0; col < 3; col++) {
      const x = w * (.17 + col * .09), y = h * (.65 - row * .12);
      t.box(face, [w * .065, h * .065, .035], [x, y, d / 2 + .025], 'trim');
      t.box(face, [w * .05, h * .035, .01], [x, y, d / 2 + .048], 'screen');
    }
    const cols = config.columns || 5, rows = config.rows || 3;
    for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) t.cylinder(face, .024, .02, [w * .24 + (col - (cols - 1) / 2) * w * .055, h * .38 - row * h * .075, d / 2 + .028], row === rows - 1 && col === 0 ? 'red' : row === 1 ? 'dark' : 'green', 'z');
    t.box(face, [w * .12, h * .19, .01], [-w * .02, h * .46, d / 2 + .018], 'white', 'visible-paper-instruction');
  }
  const route = g[2] || g[0]; t.pipe(route, [[w / 2 - .12, elevation + .12, -d / 2], [w / 2 + .13, elevation + .12, -d / 2], [w / 2 + .13, .12, -d / 2]], .018, 'black', 'cabinet-visible-conduit');
  face.userData.liveOperatingStateAdded = false; return { observedVesselBodies: 0 };
}

function powderHopper(s, g, item, config, t) {
  const w = config.width || item.width || 1.5, d = config.depth || item.depth || 1.1, y = config.tableHeight || .95;
  const body = g[0];
  for (const x of [-w / 2 + .1, w / 2 - .1]) for (const z of [-d / 2 + .1, d / 2 - .1]) t.box(body, [.055, y, .055], [x, y / 2, z], 'steel');
  const openingW = w * .55, openingD = d * .58;
  for (const x of [-1, 1]) t.box(body, [(w - openingW) / 2, .07, d], [x * (w + openingW) / 4, y, 0], 'steel', 'bag-dump-opening-rim');
  for (const z of [-1, 1]) t.box(body, [openingW, .07, (d - openingD) / 2], [0, y, z * (d + openingD) / 4], 'steel', 'bag-dump-opening-rim');
  t.box(g[1] || body, [w, .7, .045], [0, y + .39, -d / 2], 'steel');
  for (const x of [-w / 2, w / 2]) t.box(g[1] || body, [.045, .55, d], [x, y + .3, 0], 'steel');
  const shape = new THREE.CylinderGeometry(.52, .12, .58, 4, 1, true); shape.rotateY(PI / 4); const funnel = t.mesh(body, shape, [0, y - .25, 0], 'steel', 'filmed-bag-dump-hopper'); funnel.scale.set(w / 1.5, 1, d / 1.1);
  t.cylinder(body, .11, .25, [0, y - .62, 0]);
  const pump = s._group(g[2] || body); pump.name = 'preparation-bag-dump-filmed-fristam-pump-exterior';
  Object.assign(pump.userData, { sourceTimes: [435,472], samePumpInRepeatedViews: true, hiddenMotorAdded: false });
  for (const z of [-.31,.31]) t.box(pump, [1.4,.065,.06], [0,.08,z]);
  for (const x of [-.62,.62]) t.box(pump, [.06,.065,.68], [x,.08,0]);
  const coverGeometry = t.geo('bag-dump-arched-pump-cover', () => { const geometry = new THREE.CylinderGeometry(.3,.3,.78,28,1,true,0,PI); geometry.rotateZ(PI / 2); return geometry; });
  t.mesh(pump, coverGeometry, [.12,.15,0], 'steel', 'fristam-observed-arched-stainless-cover');
  for (const z of [-.3,.3]) t.box(pump, [.84,.045,.035], [.12,.15,z], 'trim');
  t.cylinder(pump, .16,.16, [-.49,.34,0], 'steel', 'x', 'bag-dump-visible-sanitary-pump-head');
  t.flange(pump, [-.59,.34,0], .17, 'x');
  t.pipe(pump, [[0,y-.64,0],[-.49,y-.64,0],[-.49,.34,0]], .057);
  t.pipe(pump, [[-.49,.34,0],[-.49,.34,.44],[.15,.34,.44]], .05);
  t.sanitaryValve(pump, [-.49,.34,.3], 'z', 'blue');
  t.pipe(pump, [[-.33,.43,.12],[.05,.44,.22],[.56,.3,.22]], .011, 'blue', 'bag-dump-visible-blue-airline');
  rootMark(body, 'confirmed-sack-tip-station-not-structural-column-haunch'); return { observedVesselBodies: 0, photographedIntegratedPumpCount: 1 };
}

function rootMark(object, description) { object.userData.visibleEvidenceFeature = description; }

function homogenizer(s, g, item, config, t) {
  const w = config.width || item.width || 1.9, h = config.height || item.height || 1.45, d = config.depth || item.depth || 1.15;
  t.box(g[0], [w, h * .67, d], [0, h * .335 + .12, 0], 'steel', 'filmed-homogenizer-body');
  for (const x of [-w * .4, w * .4]) for (const z of [-d * .38, d * .38]) t.cylinder(g[0], .055, .2, [x, .1, z], 'trim');
  const face = g[1] || g[0], pipes = g[2] || g[0];
  t.box(g[0], [w * .72, h * .28, d * .78], [w * .12, h * .78, d * .13], 'steel');
  for (const x of [-w * .15, w * .12, w * .39]) { t.cylinder(face, .14, .24, [x, h * .68, d / 2 + .14], 'trim', 'z', 'homogenizer-front-round-head'); t.flange(face, [x, h * .68, d / 2 + .28], .16); }
  t.box(face, [.57, .57, .07], [-w * .34, h * .49, d / 2 + .07], 'trim');
  t.cylinder(face, .25, .12, [-w * .34, h * .49, d / 2 + .16], 'steel', 'z', 'homogenizer-large-exterior-round-cover');
  t.ring(face, .22, [-w * .34, h * .49, d / 2 + .224], 'trim', 'z');
  t.repeated(face, [-1, 1].flatMap(x => [-1, 1].map(y => ({ position: [-w * .34 + x * .235, h * .49 + y * .235, d / 2 + .115], scale: [.035, .035, .035] }))), 'dark', 'homogenizer-round-cover-corner-fasteners');
  t.box(g[0], [w, h * .62, .08], [0, h * 1.01, -d * .24], 'steel', 'homogenizer-rear-control-backplate');
  t.box(face, [.52, .48, .035], [-w * .29, h * 1.12, -d * .24 + .063], 'orange', 'homogenizer-observed-orange-panel-border');
  t.box(face, [.46, .42, .018], [-w * .29, h * 1.12, -d * .24 + .093], 'blue');
  for (const x of [-w * .29 - .12, -w * .29 + .12]) for (const y of [h * 1.12 + .12, h * 1.12, h * 1.12 - .12]) t.cylinder(face, .026, .025, [x, y, -d * .24 + .116], y < h * 1.12 ? 'red' : 'dark', 'z');
  for (const x of [-w * .34, w * .37]) {
    t.cylinder(face, .052, h * .42, [x, h * .99, d * .1], 'steel');
    t.cylinder(face, .085, .13, [x, h * 1.2, d * .1], 'black', 'homogenizer-observed-black-capped-adjuster');
  }
  for (const [x, y, r] of [[-w * .16, h * 1.08, .12], [w * .04, h * 1.07, .105], [-w * .12, h * .91, .09]]) t.gauge(pipes, [x, y, d * .22], r);
  t.pipe(pipes, [[-w * .25, h * .44, d / 2 + .29], [-w * .25, .22, d / 2 + .29], [w * .38, .22, d / 2 + .29], [w * .38, h * .44, d / 2 + .29]], .045);
  t.pipe(g[2] || g[0], [[-w / 2, .5, 0], [-w / 2 - .2, .5, 0], [-w / 2 - .2, 1.2, 0]], .052);
  return { observedVesselBodies: 0, photographedMachine: 'homogenizer' };
}

function servicePump(s, g, item, config, t) {
  t.box(g[0], [1.55, .13, .62], [0, .095, 0], 'cream');
  t.motor(g[1] || g[0], [-.35, .4, 0], .18, .55, false, 'trim');
  const guard = t.geo('pump-yellow-curved-coupling-guard', () => { const geometry = new THREE.CylinderGeometry(.17,.17,.32,24,1,true,0,PI); geometry.rotateZ(PI / 2); return geometry; });
  t.mesh(g[1] || g[0], guard, [.12,.31,0], 'yellow', 'filmed-yellow-coupling-guard');
  for (const z of [-.17,.17]) t.box(g[1] || g[0], [.36,.04,.04], [.12,.31,z], 'yellow');
  t.cylinder(g[0], .2, .23, [.48, .4, 0], 'steel', 'x');
  t.flange(g[0], [.61,.4,0], .18, 'x');
  // The discharge turns toward local +Z; dischargeLength lets a registered
  // neighbour (the homogenizer behind which it stands) receive the flange.
  const reach = Number.isFinite(config.dischargeLength) && config.dischargeLength > .2 ? Math.min(config.dischargeLength, 1.2) : .35;
  const discharge = t.pipe(g[2] || g[0], [[.48, .4, 0], [.48, 1.05, 0], [.48, 1.05, reach]], .06, 'steel', 'pump-discharge-riser');
  discharge.userData.dischargeReach = reach;
  t.flange(g[2] || g[0], [.48, 1.05, reach], .1);
  t.sanitaryValve(g[2] || g[0], [.48,.77,0], 'y', 'yellow');
  t.repeated(g[0], [-.6,.6].flatMap(x => [-.22,.22].map(z => ({position:[x,.175,z],scale:[.035,.025,.035]}))), 'trim', 'pump-base-anchor-bolts');
  return { observedVesselBodies: 0, photographedInstalledPumpCount: 1 };
}

function filterPot(s, g, item, config, t) {
  const r = config.radius || .34, h = config.height || 1.05;
  t.cylinder(g[0], r, h, [0, h / 2 + .22, 0], 'steel', 'y', 'filmed-small-filter-pot');
  for (let i = 0; i < 3; i++) { const a = i * TAU / 3; t.bar(g[0], [Math.cos(a) * r * .85, .02, Math.sin(a) * r * .85], [Math.cos(a) * r * .85, .45, Math.sin(a) * r * .85], .028); }
  t.cylinder(g[1] || g[0], r + .02, .055, [0, h + .25, 0]); t.ring(g[1] || g[0], r + .025, [0, h + .25, 0]);
  for (const x of [-.12, .12]) t.bar(g[1] || g[0], [x, h + .28, 0], [x, h + .37, 0], .02);
  t.bar(g[1] || g[0], [-.12, h + .37, 0], [.12, h + .37, 0], .02);
  for (let i=0;i<4;i++) {
    const a=i*TAU/4,x=Math.cos(a)*(r+.02),z=Math.sin(a)*(r+.02);
    t.box(g[1] || g[0], [.055,.11,.035], [x,h+.23,z], 'trim'); t.cylinder(g[1] || g[0], .012,.08, [x,h+.32,z]);
  }
  t.cylinder(g[1] || g[0], .035,.15, [r*.4,h+.35,0]); t.sanitaryValve(g[1] || g[0], [r*.4,h+.47,0], 'y', 'blue');
  t.pipe(g[2] || g[0], [[r, .5, 0], [r + .35, .5, 0], [r + .35, .5, .35]], .04); t.flange(g[2] || g[0], [r + .35, .5, .35], .08);
  t.pipe(g[2] || g[0], [[-r,.42,0],[-r-.2,.42,0],[-r-.2,.17,0]], .04); t.sanitaryValve(g[2] || g[0], [-r-.12,.42,0], 'x', 'red');
  return { observedVesselBodies: 0, auxiliaryVesselCount: 1, auxiliaryFunctionConfirmed: false };
}

function underPlatformServices(s, g, item, config, t) {
  const frame = s._group(g[0]); frame.name = 'preparation-observed-under-platform-manifolds';
  const bands = [], legs = [], feet = [];
  for (const run of config.runs) {
    if (!Array.isArray(run.points) || run.points.length < 2) continue;
    const radius = run.radius || .055, pipe = t.pipe(frame, run.points, radius, run.paint || 'steel', `under-platform-run-${run.id || 'visible'}`);
    Object.assign(pipe.userData, { sourceTimes: run.sourceTimes || config.sourceTimes || [], visibleSegmentOnly: true, hiddenDestinationAdded: false });
    for (let i=1;i<run.points.length;i++) {
      const a=new THREE.Vector3(...run.points[i-1]),b=new THREE.Vector3(...run.points[i]),delta=b.clone().sub(a),length=delta.length();
      if (length < .1) continue;
      const q=new THREE.Quaternion().setFromUnitVectors(UP,delta.clone().normalize()),rotation=new THREE.Euler().setFromQuaternion(q).toArray().slice(0,3);
      if (run.insulated) for(let d=.18;d<length;d+=.7) bands.push({position:a.clone().addScaledVector(delta,d/length).toArray(),scale:[radius+.007,.035,radius+.007],rotation});
      if (Math.abs(a.y-b.y)<.02 && a.y>.18) for(let d=.35;d<length;d+=2.4) {
        const p=a.clone().addScaledVector(delta,d/length),height=p.y-radius-.04;
        legs.push({position:[p.x,height/2,p.z],scale:[.035,height,.035]}); feet.push({position:[p.x,.022,p.z],scale:[.14,.035,.14]});
      }
    }
  }
  t.repeated(frame,bands,'trim','insulated-header-metal-bands',t.geo('unit-cylinder',()=>new THREE.CylinderGeometry(1,1,1,24)));
  t.repeated(frame,legs,'trim','header-support-stanchions'); t.repeated(frame,feet,'trim','header-support-footplates');
  for(const valve of config.valves || []) {const object=t.sanitaryValve(g[1] || g[0],valve.position,valve.axis || 'y',valve.paint || 'blue');object.userData.sourceTimes=valve.sourceTimes || config.sourceTimes || [];}
  return { observedVesselBodies: 0, filmedVisibleServiceRuns: config.runs.length, hiddenPipeDestinationsAdded: false };
}

export function buildPreparationEquipment(s, root, item) {
  const config = item.preparation, kind = config?.kind;
  if (item.floor !== 1 || !PREPARATION_MODEL_KINDS.includes(kind) || (kind === 'tank-group' && (!Array.isArray(config.vessels) || !config.vessels.length)) || (kind === 'under-platform-services' && !config.runs?.length)) return false;
  const t = resources(s), g = parts(s, root, item);
  const build = { 'tank-group': tankGroup, platform, 'control-panel': controlPanel, 'powder-hopper': powderHopper, homogenizer, 'service-pump': servicePump, 'filter-pot': filterPot, 'under-platform-services': underPlatformServices }[kind];
  const details = build(s, g, item, config, t);
  Object.assign(root.userData, { preparationKind: kind, currentVideoReference: true, source: 'preparation-video-20261111', sourceTimes: config.sourceTimes || [], nominalDimensionsMeasured: false, hiddenMechanismsAdded: false, liveOperatingStateAdded: false, ...details });
  return true;
}
