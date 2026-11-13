import * as THREE from '../shared/vendor/three.module.js';

// Current 11 November preparation-room footage. Equipment is built separately;
// these are architectural details and movable room context. Coordinates use
// the registered current-room layout; small dimensions remain visual estimates.
export function buildPreparationEnvironment(s, environment, spec) {
  if (Number(spec?.id) !== 1) return;
  const { deck, facade, architectureFixtures, ducts } = environment;
  const cache = s.preparationEnvironmentGeometry ||= new Map();
  const geo = (key, make) => {
    if (!cache.has(key)) { const value = make(); cache.set(key, value); s.geometries.add(value); }
    return cache.get(key);
  };
  const m = s.preparationEnvironmentMaterials ||= Object.fromEntries(Object.entries({
    steel: [0xb7c3bf, .37, .65], dark: [0x293b3c, .7, .12], trim: [0x929f9b, .5, .48],
    cream: [0xe4e3cf, .9, .02], green: [0x277356, .92, .01], redFloor: [0x915a4a, .96, .01],
    yellow: [0xd1cb36, .8, .02], orange: [0xdc762b, .75, .06], blue: [0x2c7386, .77, .05],
    red: [0xaa3b33, .8, .05], white: [0xe6e5d8, .9, .02], paper: [0xd4bc91, .98, .01],
    pallet: [0x3c6978, .9, .03], wood: [0xaf8d58, .88, .02], brown: [0x3b3029, .8, .02], black: [0x182527, .85, .05],
  }).map(([key, values]) => [key, s._material(...values)]));
  m.glass ||= s._material(0x8eb6b3, .2, .05, { transparent: true, opacity: .27, side: THREE.DoubleSide, depthWrite: false });
  m.yellowGlass ||= s._material(0xead547, .5, .03, { transparent: true, opacity: .68, side: THREE.DoubleSide });
  m.whitePlastic ||= s._material(0xe8ece2, .72, .02, { transparent: true, opacity: .85 });
  m.frostedGlass ||= s._material(0xc2cfca, .55, .12, { transparent: true, opacity: .58, side: THREE.DoubleSide, depthWrite: false });
  m.smokedGlass ||= s._material(0x405653, .32, .25, { transparent: true, opacity: .4, side: THREE.DoubleSide, depthWrite: false });
  m.clearCover ||= s._material(0xc7d8d4, .34, .04, { transparent: true, opacity: .2, side: THREE.DoubleSide, depthWrite: false });
  m.frostedFilm ||= s._material(0xe6e5d8, .9, .02, { side: THREE.DoubleSide });
  const group = (parent, name, position = [0, 0, 0]) => {
    const root = s._group(parent, position); root.name = `preparation-${name}`;
    Object.assign(root.userData, { architecturalFloor: 1, currentVideoReference: true, evidence: 'preparation-room-20261111', dimensionsEstimated: true });
    return root;
  };
  const boxGeo = geo('unit-box', () => new THREE.BoxGeometry(1, 1, 1));
  const box = (root, size, position, paint = 'steel') => {
    const value = s._mesh(boxGeo, m[paint], root, position); value.scale.set(...size); return value;
  };
  const cylinder = (root, radius, height, position, paint = 'steel', axis = 'y', bottom = radius) => {
    const value = s._mesh(geo(`cylinder:${bottom / radius}`, () => new THREE.CylinderGeometry(1, bottom / radius, 1, 16)), m[paint], root, position);
    value.scale.set(radius, height, radius);
    if (axis === 'x') value.rotation.z = Math.PI / 2;
    if (axis === 'z') value.rotation.x = Math.PI / 2;
    return value;
  };
  const bar = (root, a, b, radius = .025, paint = 'steel') => {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const result = cylinder(root, radius, start.distanceTo(end), start.clone().add(end).multiplyScalar(.5).toArray(), paint);
    result.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize()); return result;
  };
  const repeats = (root, name, size, positions, paint) => {
    if (!positions.length) return;
    const result = new THREE.InstancedMesh(boxGeo, m[paint], positions.length), matrix = new THREE.Matrix4();
    for (let i = 0; i < positions.length; i++) result.setMatrixAt(i, matrix.compose(new THREE.Vector3(...positions[i]), new THREE.Quaternion(), new THREE.Vector3(...size)));
    result.name = `preparation-${name}`; result.instanceMatrix.needsUpdate = true;
    result.castShadow = true; result.receiveShadow = true; result.computeBoundingBox(); result.computeBoundingSphere(); root.add(result); return result;
  };
  const ring = (root, radius, tube, position, paint = 'steel', axis = 'y') => {
    const value = s._mesh(geo(`ring:${radius}:${tube}`, () => new THREE.TorusGeometry(radius, tube, 6, 20)), m[paint], root, position);
    if (axis === 'x') value.rotation.y = Math.PI / 2;
    if (axis === 'y') value.rotation.x = Math.PI / 2;
    return value;
  };
  const panel = (root, size, position, paint = 'white') => {
    const value = box(root, size, position, paint); value.userData.staticReference = true; return value;
  };
  function leaf(parent, name, width, height, { style = 'solid', direction = 1, angle = Math.PI / 2, handle = 'knob' } = {}) {
    const pivot = group(parent, `${name}-hinged-leaf`);
    // Keep the filmed angle as evidence; walking doors start closed and their
    // hinges are driven by proximity to the fixed parent doorway.
    const openAngle = Math.abs(angle) > .01 ? angle : Math.PI / 2;
    Object.assign(pivot.userData, { doorLeaf: true, referenceOpenAngleDegrees: angle * 180 / Math.PI,
      proximityDoor: { enterable: name !== 'corridor-unconfirmed-support', groupId: `preparation:${parent.name}`, label: name === 'toilet' ? '화장실 출입문' : name.startsWith('team1-part2') ? '1팀 2파트 출입문' : name.startsWith('air-shower') ? '에어샤워 출입문' : '조제실 출입문', accessBasis: name === 'corridor-unconfirmed-support' ? 'unconfirmed room; not modelled' : 'modelled preparation-room floor and registered wall opening', kind: 'hinge', axis: 'y', closed: 0, open: openAngle,
        trigger: [0, 0, 0], width, height, openDistance: 2.2, closeDistance: 3.1 },
    });
    const center = direction * width / 2;
    box(pivot, [width - .07, height - .08, .027], [center, height / 2, 0], style === 'solid' ? 'cream' : style === 'oval' ? 'smokedGlass' : 'frostedGlass');
    for (const x of [direction * .025, direction * (width - .025)]) box(pivot, [.045, height, .055], [x, height / 2, 0]);
    for (const y of [.025, height - .025]) box(pivot, [width, .045, .055], [center, y, 0]);
    if (style === 'mosaic') {
      const squares = [];
      for (let row = 0; row < 23; row++) for (let col = 0; col < 7; col++) if ((row * 7 + col * 3) % 5 !== 0) squares.push([direction * (.09 + col * (width - .18) / 6), .16 + row * (height - .32) / 22, -.02]);
      repeats(pivot, 'mosaic-frosted-glass-squares', [.054, .054, .008], squares, 'smokedGlass');
    }
    if (style === 'half-glass') {
      box(pivot, [width - .08, .83, .035], [center, .465, -.008], 'cream');
      box(pivot, [width - .05, .045, .05], [center, .91, 0]);
      repeats(pivot, 'lower-door-panel-grooves', [.009, .64, .008], Array.from({ length: 7 }, (_, i) => [direction * (.12 + i * (width - .24) / 6), .47, -.03]), 'trim');
    }
    if (style === 'oval') {
      const mask = geo(`oval-frosted-door-film:${width}:${height}`, () => {
        const shape = new THREE.Shape(); shape.moveTo(-width / 2 + .04, .05); shape.lineTo(width / 2 - .04, .05); shape.lineTo(width / 2 - .04, height - .05); shape.lineTo(-width / 2 + .04, height - .05); shape.closePath();
        const opening = new THREE.Path(); opening.absellipse(0, height / 2, width * .37, height * .43, 0, Math.PI * 2, true); shape.holes.push(opening);
        return new THREE.ShapeGeometry(shape, 24);
      });
      s._mesh(mask, m.frostedFilm, pivot, [center, 0, -.019]);
      repeats(pivot, 'air-door-frosted-checker-pattern', [.085, .085, .007], Array.from({ length: 5 }, (_, row) => Array.from({ length: 5 }, (_, col) => [center + (col - 2) * .1, .37 + row * .1, -.022])).flat().filter((_, i) => i % 2 === 0), 'frostedGlass');
    }
    for (const y of [.34, height - .34]) cylinder(pivot, .026, .1, [0, y, .035], 'steel');
    const handleX = direction * (width - .12);
    if (handle === 'knob') {
      for (const z of [-.065, .065]) cylinder(pivot, .043, .075, [handleX, 1.02, z], 'steel', 'z');
    } else {
      for (const z of [-.07, .07]) bar(pivot, [handleX, .85, z], [handleX, 1.3, z], .025, style === 'oval' ? 'brown' : 'dark');
    }
    return pivot;
  }
  function doorway(name, position, width, height, { normal = 'z', style = 'solid', angle = Math.PI / 2, handle = 'knob', sourceTimesSeconds = [] } = {}) {
    const root = group(architectureFixtures, `${name}-doorway`, position);
    if (normal === 'x') root.rotation.y = Math.PI / 2;
    for (const x of [-width / 2 - .025, width / 2 + .025]) box(root, [.07, height + .08, .12], [x, height / 2, 0]);
    box(root, [width + .12, .09, .13], [0, height + .015, 0]);
    box(root, [width + .12, .025, .15], [0, .018, 0]);
    const pivot = leaf(root, name, width, height, { style, angle, handle }); pivot.position.x = -width / 2;
    Object.assign(root.userData, { customArchitecturalDoor: true, doorId: name, normal, width, sourceTimesSeconds });
    return root;
  }

  const floors = group(deck, 'current-green-floor-and-zones');
  for (const [x, z, width, depth] of [[25.3, .5, 17.8, 8.1], [22.3, 11.5, 11.7, 13.7], [31.3, 18.9, 6.1, 5.3]]) {
    box(floors, [width, .012, depth], [x, .008, z], 'green');
  }
  for (const [x, z, width, depth] of [[30.8, -1.9, 5.8, 1.7], [23.4, 3.5, 8.1, 1.3], [18.9, 11.4, 1.1, 11.3]]) {
    box(floors, [width, .009, depth], [x, .018, z], 'redFloor');
  }

  function palletStack(parent, x, z, tiers = 4, color = 'paper') {
    const root = group(parent, 'bagged-material-pallet', [x, 0, z]);
    Object.assign(root.userData, { movableContext: true, quantityRepresentative: true, sourceTimesSeconds: [39, 469] });
    for (const zz of [-.43, 0, .43]) box(root, [1.28, .13, .14], [0, .08, zz], 'pallet');
    repeats(root, 'pallet-top-boards', [1.3, .06, .16], [-.44, -.22, 0, .22, .44].map(zz => [0, .18, zz]), 'pallet');
    const bags = [];
    for (let y = 0; y < tiers; y++) for (const xx of [-.31, .31]) for (const zz of [-.25, .25]) bags.push([xx + (y % 2 ? .035 : -.035), .34 + y * .22, zz]);
    repeats(root, 'stacked-material-bags', [.61, .22, .48], bags, color);
    repeats(root, 'bag-seam-lines', [.52, .014, .018], bags.map(([xx, yy, zz]) => [xx, yy + .115, zz]), color === 'paper' ? 'wood' : 'trim');
    return root;
  }
  const daily = group(architectureFixtures, 'daily-raw-material-storage');
  for (const [x, z, tiers, color] of [[29.2, -2.55, 6, 'paper'], [33.1, -2.5, 6, 'white'], [33.15, 3.65, 4, 'paper']]) palletStack(daily, x, z, tiers, color);
  const weigh = group(architectureFixtures, 'weighing-raw-material-storage');
  for (const [x, z, tiers, color] of [[20.2, -2.6, 3, 'white'], [22, -2.6, 5, 'paper'], [24, -2.6, 5, 'white'], [24, 2.8, 4, 'paper']]) palletStack(weigh, x, z, tiers, color);

  function ibc(x, z) {
    const root = group(daily, 'caged-ibc', [x, 0, z]);
    Object.assign(root.userData, { movableContext: true, quantityRepresentative: true, sourceTimesSeconds: [39] });
    box(root, [1.15, .15, 1], [0, .1, 0], 'pallet');
    box(root, [1.04, .94, .91], [0, .64, 0], 'whitePlastic');
    cylinder(root, .12, .06, [0, 1.15, 0], 'black');
    for (const xx of [-.55, .55]) for (const zz of [-.48, .48]) bar(root, [xx, .2, zz], [xx, 1.18, zz], .021);
    for (const y of [.3, .58, .86, 1.14]) {
      for (const zz of [-.49, .49]) box(root, [1.14, .027, .026], [0, y, zz]);
      for (const xx of [-.56, .56]) box(root, [.026, .027, 1.02], [xx, y, 0]);
    }
    repeats(root, 'ibc-cage-verticals', [.018, .98, .018], [-.36, -.12, .12, .36].flatMap(xx => [[xx, .69, -.5], [xx, .69, .5]]), 'steel');
    cylinder(root, .07, .13, [0, .3, -.58], 'dark', 'z');
  }
  // The filmed IBC is movable context. Park it beside the inner shutter,
  // leaving the registered 2.85m doorway and its straight approach unobstructed.
  ibc(31.25, 3.85); ibc(31, -2.55);

  // 11/11 clip 0:52-0:56, 1:40-1:44, 7:47-7:49: the forklift works in the
  // preparation hall just inside the inner fast shutter, beside the bag
  // pallets, not inside the raw-material store.
  const forklift = group(architectureFixtures, 'parked-yellow-green-forklift', [32.55, 0, 8.25]);
  Object.assign(forklift.userData, { movableContext: true, sourceTimesSeconds: [52, 56, 101, 468], positionEstimated: true, area: 'preparation-hall', parkingBasis:'same preparation hall, beside the straight inner-shutter approach rather than across it' });
  box(forklift, [1.65, .68, 1.05], [0, .53, 0], 'yellow');
  box(forklift, [.58, .57, 1.04], [.59, .89, 0], 'yellow');
  box(forklift, [.53, .16, .63], [.03, 1.04, 0], 'black');
  box(forklift, [.14, .68, .63], [.33, 1.32, 0], 'black');
  for (const x of [-.55, .59]) for (const z of [-.55, .55]) cylinder(forklift, .27, .2, [x, .29, z], 'black', 'z');
  for (const z of [-.41, .41]) { box(forklift, [.13, 2.3, .1], [-.92, 1.25, z], 'dark'); box(forklift, [1.15, .07, .11], [-1.38, .12, z], 'dark'); }
  for (const x of [-.55, .54]) for (const z of [-.48, .48]) box(forklift, [.055, 1.25, .055], [x, 1.71, z], 'dark');
  box(forklift, [1.3, .08, 1.14], [0, 2.35, 0], 'dark');
  ring(forklift, .15, .025, [-.42, 1.34, 0], 'black', 'x');

  const scale = group(daily, 'floor-scale-and-display', [29.5, 0, -1.2]);
  box(scale, [1.2, .12, 1.15], [0, .08, 0], 'trim');
  box(scale, [.08, 1.25, .08], [.56, .72, .52]);
  box(scale, [.38, .3, .13], [.56, 1.42, .52], 'cream');
  panel(scale, [.29, .13, .016], [.56, 1.45, .445], 'dark');
  const cart = group(daily, 'glove-box-cart', [33.6, 0, -1.3]);
  for (const xx of [-.28, .28]) for (const zz of [-.2, .2]) { bar(cart, [xx, .1, zz], [xx, .84, zz], .018); cylinder(cart, .065, .05, [xx, .07, zz], 'black', 'x'); }
  box(cart, [.64, .045, .49], [0, .35, 0]); box(cart, [.64, .045, .49], [0, .82, 0]);
  box(cart, [.47, .27, .34], [0, .98, 0], 'white');
  const fan = group(daily, 'pedestal-fan', [33.55, 0, 1.65]);
  cylinder(fan, .25, .04, [0, .04, 0], 'dark'); bar(fan, [0, .05, 0], [0, 1.25, 0], .035, 'dark');
  ring(fan, .31, .022, [0, 1.45, 0], 'trim', 'x'); cylinder(fan, .08, .1, [0, 1.45, 0], 'dark', 'x');
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; bar(fan, [0, 1.45, 0], [0, 1.45 + Math.cos(a) * .3, Math.sin(a) * .3], .009); }

  function rapidDoor(position, name, rotation = 0) {
    const lower = group(architectureFixtures, `${name}-rapid-door-trim`, position);
    const upper = group(architectureFixtures, `${name}-raised-orange-rapid-door`, position);
    lower.rotation.y = rotation; upper.rotation.y = rotation;
    const wallPlane = name === 'outer' ? .15 : 0, rollPlane = wallPlane - .28;
    // The guides and operating box remain outside the full curtain width.
    for (const z of [-1.49, 1.49]) {
      box(lower, [.11, .95, .105], [rollPlane, .475, z]);
      box(upper, [.11, 1.6, .105], [rollPlane, 1.75, z]);
      for(const y of [.65,1.95]) box(upper,[.17,.09,.08],[wallPlane-.145,y,z]);
    }
    const housing = box(upper, [.4, .43, 3.1], [rollPlane, 2.76, 0]);
    housing.name = `preparation-${name}-rapid-door-roll-housing`;
    Object.assign(housing.userData,{wallPlane,wallFaceOffset:.06,mountGap:.02,rollPlane});
    // Thin moving curtain strips collect inside the fixed roll housing rather
    // than raising a full-height sheet above the door and through its header.
    const curtain = group(lower, `${name}-orange-rapid-door-curtain`);
    curtain.userData.doorLeaf = true;
    for (let i = 0; i < 24; i++) {
      const closed = (i + .5) * .1;
      const slat = box(curtain, [.055, .108, 2.85], [rollPlane, closed, 0], 'orange');
      slat.name = `preparation-${name}-rapid-door-curtain-strip-${i + 1}`;
      slat.userData.proximityDoor = { enterable: true, groupId: `preparation:${name}-rapid-door`, label: name === 'inner' ? '조제실 안쪽 고속문' : '원료 반입 고속문', accessBasis: 'registered floor-plan opening with modelled room floor on the interior side', kind: 'lift', axis: 'y', closed, open: 2.62 + i * .004,
        trigger: [rollPlane, 0, 0], normal: [-1, 0, 0], width: 2.85, height: 2.4, openDistance: 2.2, closeDistance: 3.1 };
    }
    box(lower, [.14, .34, .25], [rollPlane-.12, 1.12, 1.58], 'cream');
    cylinder(lower, .04, .04, [rollPlane-.21, 1.13, 1.58], 'red', 'x');
    Object.assign(lower.userData, { customArchitecturalDoor: true, doorId: name === 'inner' ? 'raw-inner-shutter' : 'raw-exterior', proximityOperated: true, sourceTimesSeconds: name === 'inner' ? [49, 53] : [30] });
  }
  // Keep the complete shutter inside the weighing-to-preparation boundary,
  // clear of the open daily-store approach and the parked pallets.
  const innerShutter = spec.preparationSurvey.doors.find(door => door.id === 'raw-inner-shutter');
  rapidDoor([innerShutter.position[0], 0, innerShutter.position[1]], 'inner', Math.PI / 2);
  rapidDoor([34.25, 0, .6], 'outer');

  const office = group(architectureFixtures, 'glass-office-furnishings', [25, 0, 18.4]);
  const officeUpper = group(facade, 'glass-office-upper-front', [25, 0, 18.4]);
  // 87 s: glazed PC corner. 140–161 s: the adjacent process-facing entry
  // has a full-height mosaic/frosted leaf, not a bare opening or air shower.
  const officeGlass = group(architectureFixtures, 'office-west-glazed-partition', [25, 0, 20]);
  officeGlass.rotation.y = Math.PI / 2;
  for (const x of [-1.56, 0, 1.56]) box(officeGlass, [.055, 2.5, .07], [x, 1.25, 0]);
  for (const y of [.05, 2.47]) box(officeGlass, [3.16, .06, .07], [0, y, 0]);
  for (const x of [-.79, .79]) box(officeGlass, [1.5, 2.34, .025], [x, 1.25, 0], 'glass');
  for (const [x, width] of [[.575, 1.15], [2.625, 1.15]]) {
    box(office, [width, .95, .09], [x, .475, 0], 'cream');
    box(officeUpper, [width, 1.55, .09], [x, 1.725, 0], 'cream');
  }
  box(officeUpper, [1, .3, .09], [1.6, 2.35, 0], 'cream');
  doorway('sanitation-workroom', [26.6, 0, 18.4], .9, 2.2, { style: 'mosaic', sourceTimesSeconds: [141, 146, 159, 161] });
  box(office, [1.72, .065, .76], [1.1, .78, 1.78], 'wood');
  for (const x of [.3, 1.9]) for (const z of [1.45, 2.1]) box(office, [.055, .75, .055], [x, .385, z]);
  box(office, [.55, .36, .045], [1.42, 1.18, 1.97], 'dark');
  box(office, [.49, .29, .01], [1.42, 1.18, 1.94], 'glass');
  box(office, [.06, .16, .06], [1.42, .93, 1.97], 'dark');
  box(office, [.42, .025, .14], [1.42, .83, 1.75], 'dark');
  repeats(office, 'desk-paper-and-binders', [.36, .035, .25], [[.47, .84, 1.7], [.49, .88, 1.7], [.5, .92, 1.7], [1.95, .85, 1.79]], 'white');
  box(office, [.4, .56, .25], [.55, 1.12, 2.02], 'blue');
  repeats(office, 'document-organizer-drawers', [.29, .035, .2], Array.from({ length: 7 }, (_, i) => [.55, .92 + i * .07, 1.87]), 'white');
  const chair = group(office, 'office-chair', [1.1, 0, .94]);
  cylinder(chair, .3, .08, [0, .52, 0], 'black'); box(chair, [.58, .53, .1], [0, .86, -.25], 'black');
  cylinder(chair, .055, .42, [0, .27, 0], 'dark');
  for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; bar(chair, [0, .12, 0], [Math.cos(a) * .34, .08, Math.sin(a) * .34], .025, 'dark'); }
  const sanitizer = group(office, 'visible-sterilizing-cabinet', [2.6, 0, 2.35]);
  Object.assign(sanitizer.userData, { sourceTimesSeconds: [153, 156], cabinetRole: 'sterilizing-cabinet-visible-exterior', operatingStateUnconfirmed: true });
  box(sanitizer, [.67, 1.45, .035], [0, .77, .29]);
  for (const x of [-.32, .32]) box(sanitizer, [.035, 1.45, .61], [x, .77, 0]);
  for (const y of [.055, 1.48]) box(sanitizer, [.67, .05, .61], [0, y, 0]);
  const cabinetWindow = geo('sterilizer-rounded-front-window', () => {
    const shape = new THREE.Shape(), l = -.255, r = .255, b = .16, t = 1.3, radius = .1;
    shape.moveTo(l + radius, b); shape.lineTo(r - radius, b); shape.quadraticCurveTo(r, b, r, b + radius); shape.lineTo(r, t - radius); shape.quadraticCurveTo(r, t, r - radius, t); shape.lineTo(l + radius, t); shape.quadraticCurveTo(l, t, l, t - radius); shape.lineTo(l, b + radius); shape.quadraticCurveTo(l, b, l + radius, b); return new THREE.ShapeGeometry(shape);
  });
  s._mesh(cabinetWindow, m.smokedGlass, sanitizer, [0, 0, -.32]);
  for (const y of [.28, .48, .68, .88, 1.08]) {
    box(sanitizer, [.53, .018, .44], [0, y, 0], 'dark');
    repeats(sanitizer, 'sterilizer-wire-racks', [.018, .014, .44], Array.from({ length: 9 }, (_, i) => [-.23 + i * .058, y + .013, 0]), 'steel');
  }
  box(sanitizer, [.63, .09, .025], [0, 1.395, -.32], 'blue');
  cylinder(sanitizer, .035, .035, [.08, 1.395, -.345], 'dark', 'z');
  for (const [x, paint] of [[.2, 'red'], [.26, 'green']]) cylinder(sanitizer, .014, .022, [x, 1.395, -.345], paint, 'z');
  panel(sanitizer, [.15, .22, .008], [.15, 1.14, -.335]);
  bar(sanitizer, [-.25, .69, -.37], [-.25, .94, -.37], .018);
  box(sanitizer, [.22, .06, .16], [-.12, 1.54, .04], 'black');
  const wrappedDesk = group(office, 'plastic-covered-work-table', [1.5, 0, 2.85]);
  box(wrappedDesk, [1.35, .06, .53], [0, .79, 0], 'wood');
  for (const x of [-.6, .6]) for (const z of [-.2, .2]) bar(wrappedDesk, [x, .04, z], [x, .77, z], .025);
  box(wrappedDesk, [1.39, .017, .58], [0, .836, 0], 'clearCover');
  box(wrappedDesk, [1.39, .38, .013], [0, .64, -.3], 'clearCover');
  box(wrappedDesk, [.6, .38, .035], [.15, 1.04, .17], 'dark');
  box(wrappedDesk, [.64, .42, .015], [.15, 1.04, .14], 'clearCover');
  const stool = group(office, 'round-work-stool', [1.45, 0, 2.25]);
  cylinder(stool, .27, .08, [0, .51, 0], 'brown'); cylinder(stool, .045, .44, [0, .27, 0]);
  for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; bar(stool, [0, .12, 0], [Math.cos(a) * .3, .06, Math.sin(a) * .3], .022); }
  const workWindow = group(officeUpper, 'yellow-workroom-window', [1.1, 0, 3.12]);
  box(workWindow, [1.1, 1.55, .035], [0, 1.6, 0], 'yellowGlass');
  for (const x of [-.58, .58]) box(workWindow, [.045, 1.65, .07], [x, 1.6, 0]);
  box(workWindow, [1.18, .045, .07], [0, 1.48, 0]);
  box(officeUpper, [.95, .3, .2], [2.25, 2.28, 3.0], 'white');
  repeats(officeUpper, 'workroom-ac-grille', [.83, .009, .015], [2.2, 2.23, 2.26].map(y => [2.25, y, 2.89]), 'trim');
  for (const [x, z] of [[.4, 3.12], [1.2, 3.12], [2.1, 3.12]]) panel(officeUpper, [.45, .58, .015], [x, 1.75, z]);
  // Like the upper glass, the office ceiling is a facade layer: it disappears
  // in perspective/top cutaway views so the desk remains visible.
  box(facade, [3.18, .07, 3.1], [26.6, 2.73, 20], 'cream');

  const cip = group(architectureFixtures, 'cip-utility-visible-pipes', [21.6, 0, 18.4]);
  const cipUpper = group(facade, 'cip-window-and-open-perforated-door', [21.6, 0, 18.4]);
  box(cipUpper, [1.03, 1.6, .07], [.67, 1.7, 3.08], 'yellowGlass');
  for (const x of [.13, 1.21]) box(cipUpper, [.05, 1.7, .08], [x, 1.7, 3.08]);
  for (const y of [.86, 1.6, 2.55]) box(cipUpper, [1.13, .05, .08], [.67, y, 3.08]);
  bar(cip, [.3, .8, 2.82], [3.1, .8, 2.82], .07);
  bar(cip, [1.38, .8, 2.82], [1.38, 2.5, 2.82], .09, 'trim');
  cylinder(cip, .15, .24, [2.35, .8, 2.82], 'trim', 'x');
  ring(cip, .14, .022, [1.56, 1.02, 2.76], 'red', 'y');
  bar(cip, [1.56, .8, 2.82], [1.56, 1.02, 2.76], .035);
  doorway('cip-utility', [23.3, 0, 18.4], 1.1, 2.2, { sourceTimesSeconds: [111, 135] });
  const basin = (parent, x, z) => {
    const root = group(parent, 'round-handwash-basin', [x, 0, z]);
    const bowl = geo('handwash-concave-bowl', () => new THREE.LatheGeometry([[.025, .68], [.1, .685], [.19, .72], [.28, .82], [.32, .9]].map(([a, b]) => new THREE.Vector2(a, b)), 24));
    m.bowlSteel ||= s._material(0xb7c3bf, .37, .65, { side: THREE.DoubleSide });
    s._mesh(bowl, m.bowlSteel, root, [0, 0, 0]);
    ring(root, .317, .018, [0, .9, 0]); cylinder(root, .018, .01, [0, .682, 0], 'dark');
    cylinder(root, .27, .67, [0, .385, 0]);
    const tap = geo('arched-handwash-tap', () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3([[.18, .88, -.16], [.18, 1.2, -.16], [.1, 1.28, -.1], [-.02, 1.25, .02], [-.03, 1.15, .06]].map(p => new THREE.Vector3(...p))), 20, .022, 8, false));
    s._mesh(tap, m.steel, root, [0, 0, 0]);
    Object.assign(root.userData, { sourceTimesSeconds: [486, 497.5], broadCylinderBody: true });
    return root;
  };

  const air = group(architectureFixtures, 'air-shower-lower-shell-and-nozzles', [28.2, 0, 16.9]);
  const airUpper = group(facade, 'air-shower-upper-shell', [28.2, 0, 16.9]);
  for (const z of [.04, 1.36]) {
    box(air, [3.2, .95, .075], [1.6, .475, z]);
    box(airUpper, [3.2, 1.43, .075], [1.6, 1.665, z]);
    for (const x of [.53, 1.6, 2.67]) for (const y of [.6, 1.2, 1.8]) {
      cylinder(air, .083, .045, [x, y, z + (z < .7 ? .05 : -.05)], 'dark', 'z');
      ring(air, .083, .012, [x, y, z + (z < .7 ? .078 : -.078)], 'steel', 'z');
      cylinder(air, .027, .014, [x, y, z + (z < .7 ? .08 : -.08)], 'steel', 'z');
      for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; bar(air, [x, y, z + (z < .7 ? .082 : -.082)], [x + Math.cos(a) * .067, y + Math.sin(a) * .067, z + (z < .7 ? .082 : -.082)], .009); }
    }
    for (const x of [.53, 1.6, 2.67]) {
      box(air, [.36, .23, .018], [x, .91, z + (z < .7 ? .052 : -.052)], 'dark');
      repeats(air, 'air-shower-side-return-grille', [.31, .012, .013], Array.from({ length: 6 }, (_, i) => [x, .83 + i * .032, z + (z < .7 ? .066 : -.066)]), 'trim');
    }
  }
  box(airUpper, [3.2, .08, 1.4], [1.6, 2.42, .7]);
  for (const x of [.88, 2.3]) for (const z of [.31, 1.09]) {
    cylinder(airUpper, .13, .02, [x, 2.37, z], 'dark'); ring(airUpper, .134, .016, [x, 2.35, z]);
    for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3; bar(airUpper, [x, 2.34, z], [x + Math.cos(a) * .11, 2.34, z + Math.sin(a) * .11], .015); }
  }
  for (const x of [.9, 2.25]) { box(airUpper, [.4, .035, .26], [x, 2.35, .7], 'dark'); box(airUpper, [.34, .018, .2], [x, 2.326, .7], 'white'); }
  box(air, [3.16, .025, 1.22], [1.6, .028, .7], 'dark');
  repeats(air, 'air-shower-floor-grating', [.035, .026, 1.19], Array.from({ length: 35 }, (_, i) => [.07 + i * .09, .046, .7]), 'steel');
  const airProcessDoor = doorway('air-shower-process', [28.2, 0, 17.6], 1.15, 2.3, { normal: 'x', style: 'oval', handle: 'pull', sourceTimesSeconds: [165, 170, 480] });
  const airHygieneDoor=doorway('air-shower-hygiene', [31.4, 0, 17.6], 1.15, 2.3, { normal: 'x', style: 'oval', handle: 'pull', angle: -Math.PI / 2, sourceTimesSeconds: [170, 481, 486, 489] });
  const preparationSign=group(airHygieneDoor,'observed-preparation-room-entry-sign',[0,2.48,.045]);
  box(preparationSign,[.66,.15,.018],[0,0,0],'white');
  Object.assign(preparationSign.userData,{label:'조제실',sourceReferences:[{clipId:'first-floor-20261113-clip1',seconds:[0,6]}],roomIdentityConfirmed:true});
  if(typeof document!=='undefined'&&typeof document.createElement==='function'){
    const signCanvas=document.createElement('canvas');signCanvas.width=512;signCanvas.height=116;
    const ctx=signCanvas.getContext?.('2d');
    if(ctx?.fillRect&&ctx?.fillText){
      ctx.fillStyle='#eff0e8';ctx.fillRect(0,0,512,116);ctx.fillStyle='#263b3a';ctx.font='600 64px "Malgun Gothic",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('조 제 실',256,58);
      const texture=new THREE.CanvasTexture(signCanvas);texture.colorSpace=THREE.SRGBColorSpace;s.textures?.add(texture);
      const paint=new THREE.MeshBasicMaterial({map:texture,toneMapped:false});s.materials.add(paint);
      s._mesh(geo('preparation-entry-nameplate',()=>new THREE.PlaneGeometry(.64,.145)),paint,preparationSign,[0,0,.011]);
    }
  }
  panel(airProcessDoor, [.12, .25, .04], [.69, 1.6, -.06], 'dark');
  Object.assign(air.userData, { openPassageAxis: 'x', centerLineZ: 17.6, sourceTimesSeconds: [165, 170, 483], sourceReferences:[{clipId:'first-floor-20261113-clip1',seconds:[0,6,12]}], firstVisitStayedProcessSide: true, nozzleQuantityRepresentative: true });
  const extinguisher = group(architectureFixtures, 'air-shower-extinguisher', [27.85, 0, 18.55]);
  cylinder(extinguisher, .105, .48, [0, .33, 0], 'red'); cylinder(extinguisher, .045, .1, [0, .62, 0], 'dark');
  bar(extinguisher, [0, .6, 0], [.15, .62, 0], .022, 'black');

  const hygiene = group(architectureFixtures, 'hygiene-vestibule-and-lockers');
  const existingStair = architectureFixtures.getObjectByName('dryer-building-1-southeast-stair');
  if (existingStair) {
    // Only the walking surfaces are green. Keep the filmed silver railing,
    // wood handrail and dark tread nosings in their own materials.
    existingStair.traverse(node => { if (node.isMesh && ['architectural-stair-tread','architectural-stair-landing'].includes(node.name)) node.material = m.green; });
    existingStair.userData.currentFinishBasis = 'green painted treads visible in entrance walk112-150s and prior495-496s';
  }
  basin(hygiene, 31.95, 16.55); basin(hygiene, 32.75, 16.55);
  box(hygiene, [1.7, 1.36, .028], [32.35, 1.33, 16.23], 'steel');
  for (const x of [31.95, 32.75]) {
    panel(hygiene, [.18, .29, .14], [x, 1.37, 16.32], 'white');
    panel(hygiene, [.07, .14, .015], [x, 1.38, 16.24], 'green');
    panel(hygiene, [.3, .35, .18], [x, 1.88, 16.33], 'white');
    box(hygiene, [.18, .025, .02], [x, 1.74, 16.43], 'dark');
  }
  panel(hygiene, [.5, .3, .014], [32.35, 1.64, 16.26], 'white');
  const lintRollers = group(hygiene, 'two-green-wall-lint-rollers', [32.35, 0, 16.39]);
  Object.assign(lintRollers.userData,{source:'dryer-entrance-mezzanine-20261112',sourceTimesSeconds:[106],observedCount:2});
  for(const x of [-.21,.21]) {
    box(lintRollers,[.09,.12,.035],[x,2.09,0],'white');
    bar(lintRollers,[x,1.94,.045],[x,2.24,.045],.022,'green');
    cylinder(lintRollers,.052,.21,[x,1.91,.065],'white','x');
  }
  // Gray clean-side deck and the lower green shoe-change pocket seen through
  // the air-shower door; the outer entry stays aligned with the chamber.
  box(floors, [1.75, .065, 2.1], [32.325, .052, 17.35], 'trim');
  box(floors, [4.9, .065, 2.8], [30.75, .052, 19.8], 'trim');
  for (const [x, z, width, depth] of [[33.7, 20, 1.2, 2.6], [33.7, 16.5, 1.2, .65]]) box(floors, [width, .065, depth], [x, .052, z], 'trim');
  box(floors, [1.2, .014, 1.83], [33.7, .026, 17.75], 'green');
  box(hygiene, [.06, .07, 1.84], [33.08, .05, 17.75]);
  repeats(hygiene, 'anonymous-shoe-change-slippers', [.23, .065, .11], [[33.36, .07, 17.22], [33.36, .07, 17.49], [33.75, .07, 18.22], [33.99, .07, 18.22]], 'dark');
  const insectLight = group(hygiene, 'visible-violet-wall-light', [34.22, 2.28, 19.08]);
  box(insectLight, [.14, .36, .5], [0, 0, 0], 'dark');
  const violet = m.violet ||= s._material(0x9b6acb, .5, .06, { emissive: 0x5c267c, emissiveIntensity: .45 });
  for (const y of [-.11, 0, .11]) { const tube = s._mesh(boxGeo, violet, insectLight, [-.083, y, 0]); tube.scale.set(.02, .018, .42); }
  repeats(insectLight, 'wall-light-grille', [.02, .3, .012], Array.from({ length: 8 }, (_, i) => [-.102, 0, -.21 + i * .06]), 'steel');
  // Lockers occupy the high side under the existing southeast stair; no new stairs.
  const lockers = group(hygiene, 'under-existing-stair-lockers', [30.65, 0, 19.35]);
  box(lockers, [3.2, 1.94, .44], [1.1, .98, 0], 'trim');
  const doors = [], tags = [], handles = [];
  for (let col = 0; col < 6; col++) for (let row = 0; row < 5; row++) {
    const x = -.17 + col * .505, y = .23 + row * .37;
    doors.push([x, y, -.237]); tags.push([x, y + .085, -.259]); handles.push([x + .17, y - .015, -.27]);
  }
  repeats(lockers, 'locker-dark-doors', [.46, .33, .023], doors, 'dark');
  repeats(lockers, 'anonymous-locker-tags', [.14, .035, .008], tags, 'white');
  repeats(lockers, 'locker-handles', [.025, .09, .022], handles, 'steel');
  // These tall cupboards belong outside the chamber, under the high stair
  // flight. The former estimate straddled the air-shower wall and protruded
  // into its interior; simply moving south would hit the return landing.
  const tallCupboards=group(hygiene,'under-stair-tall-cupboards');
  Object.assign(tallCupboards.userData,{observedCount:2,positionEstimated:true,placementBasis:'under existing high stair flight, beside the filmed storage and outside the air-shower shell'});
  for (const x of [30.1, 30.55]) {
    box(tallCupboards, [.4, 1.85, .47], [x, .94, 18.75], 'cream');
    box(tallCupboards, [.33, 1.7, .022], [x, .94, 18.5], 'wood');
    cylinder(tallCupboards, .025, .035, [x + .11, .94, 18.47], 'dark', 'z');
  }
  panel(hygiene, [.68, 1.15, .02], [32.9, 1.3, 19.05], 'white');
  box(hygiene, [.68, .08, .025], [32.9, 1.86, 19.035], 'blue');

  // 11/12 walk100–114s: the small table and two clear lidded boxes stand
  // beside the locker bank under the upper flight, outside the lower run.
  const entryTable=group(hygiene,'entry-folding-table-and-storage-boxes',[29.45,.085,19.3]);
  Object.assign(entryTable.userData,{source:'dryer-entrance-mezzanine-20261112',sourceTimesSeconds:[100,102,114],observedStorageBoxCount:2,movableContext:true});
  box(entryTable,[1.1,.035,.5],[0,.65,0],'cream');
  for(const x of [-.44,.44])for(const z of [-.18,.18])box(entryTable,[.035,.63,.035],[x,.315,z],'white');
  for(const x of [-.44,.44])box(entryTable,[.16,.025,.52],[x,.015,0],'white');
  for(const sign of [-1,1])bar(entryTable,[-.44,.12,sign*.18],[.44,.6,sign*.18],.012,'steel');
  for(const x of [-.28,.28]) {
    const storage=group(entryTable,'clear-lidded-entry-storage-box',[x,.7975,0]);
    box(storage,[.46,.26,.36],[0,0,0],'clearCover');
    box(storage,[.49,.025,.39],[0,.143,0],'whitePlastic');
    for(const z of [-.19,.19])box(storage,[.18,.025,.025],[0,.065,z],'dark');
    for(const xx of [-.22,.22])box(storage,[.02,.06,.055],[xx,.12,0],'blue');
  }

  const entry = group(architectureFixtures, 'controlled-double-glass-entry-lower', [34.3, 0, 17.6]);
  entry.rotation.y = Math.PI / 2;
  for (const x of [-1.32, 1.32]) box(entry, [.08, 2.45, .13], [x, 1.225, 0]);
  box(entry, [2.72, .09, .13], [0, 2.45, 0]);
  box(entry, [2.72, .035, .18], [0, .02, 0]);
  for (const sign of [-1, 1]) {
    const pivot = leaf(entry, `team1-part2-${sign < 0 ? 'south' : 'north'}`, 1.29, 2.4, { style: 'glass', direction: -sign, angle: -sign * Math.PI * 70 / 180, handle: 'pull' });
    pivot.position.x = sign * 1.3;
    // Both leaves respond to the same complete doorway, including approach
    // from the other side of the frame.
    pivot.userData.proximityDoor.width = 2.6;
    const freeX = -sign * 1.12;
    box(pivot, [.15, .33, .105], [freeX, 1.13, -.09], 'trim');
    cylinder(pivot, .053, .03, [freeX, 1.16, -.16], 'black', 'z');
    box(pivot, [.09, .06, .014], [freeX, 1.26, -.16], 'dark');
    bar(pivot, [freeX, .62, .07], [freeX, 1.7, .07], .028, 'black');
    if(sign>0) {
      const keypad=group(pivot,'entry-keypad-and-push-fitting',[freeX,1.17,-.17]);
      Object.assign(keypad.userData,{source:'dryer-entrance-mezzanine-20261112',sourceTimesSeconds:[18,28,36],accessDigitsStored:false});
      box(keypad,[.12,.27,.025],[0,0,0],'black');
      box(keypad,[.11,.028,.035],[0,.12,-.012],'steel');
      repeats(keypad,'anonymous-keypad-buttons',[.015,.012,.005],Array.from({length:12},(_,i)=>[(i%3-1)*.027,.055-Math.floor(i/3)*.035,-.016]),'white');
      box(pivot,[.15,.23,.035],[freeX+.17,1.17,-.18],'steel');
    }
  }
  Object.assign(entry.userData, { doorId: 'team1-part2', customArchitecturalDoor: true, sourceTimesSeconds: [18,28,36,509,510,519], latestSource:'dryer-entrance-mezzanine-20261112', staticLockHardware: true, proximityOperated: true, observedInnerDoorType:'keypad-hinged-glazed-entry' });

  // 502–505 seconds: the camera turns from the vestibule corridor into the
  // tiled washroom. Two porcelain urinals are visible between dark dividers;
  // no unseen cubicles or seated toilets are inferred.
  const washroom = group(architectureFixtures, 'washroom-visible-interior');
  const washroomUpper = group(facade, 'washroom-upper-tile-finish');
  Object.assign(washroom.userData, { sourceTimesSeconds: [502, 503, 505], visibleUrinals: 2, unfilmedFixturesNotAdded: true });
  box(floors, [2.72, .012, 3.15], [31.9, .026, 14.6], 'paper');
  const grout = [];
  for (let x = 30.6; x < 33.25; x += .45) grout.push([x, .035, 14.6]);
  repeats(floors, 'washroom-floor-tile-grout-x', [.012, .006, 3.1], grout, 'wood');
  repeats(floors, 'washroom-floor-tile-grout-z', [2.7, .006, .012], Array.from({ length: 7 }, (_, i) => [31.9, .035, 13.2 + i * .45]), 'wood');
  for (const [x, z, width, depth] of [[30.54, 14.6, .025, 3.12], [31.9, 13.04, 2.68, .025], [31.9, 16.16, 2.68, .025], [33.24, 13.88, .025, 1.7], [33.24, 15.92, .025, .5]]) {
    box(washroom, [width, .94, depth], [x, .48, z], 'white');
    box(washroomUpper, [width, 1.67, depth], [x, 1.785, z], 'white');
    box(washroomUpper, [width + .008, .1, depth + .008], [x, 1.04, z], 'paper');
  }
  // Urinals mounted against the west wall; the visible dark curved-top
  // partitions are represented by thin rounded plates between the two bays.
  for (const z of [13.75, 14.65]) {
    const urinal = group(washroom, 'visible-porcelain-urinal', [30.79, 0, z]);
    box(urinal, [.19, .62, .36], [0, .73, 0], 'white');
    const bowl = cylinder(urinal, .22, .14, [.14, .58, 0], 'white', 'y', .15); bowl.scale.z *= .8;
    const inset = cylinder(urinal, .15, .012, [.17, .656, 0], 'dark'); inset.scale.z *= .72;
    bar(urinal, [0, 1.04, 0], [0, 1.22, 0], .02);
    cylinder(urinal, .035, .05, [.03, 1.1, 0], 'steel', 'x');
  }
  for (const z of [13.29, 14.2, 15.11]) {
    box(washroom, [.67, 1.27, .045], [30.91, .83, z], 'brown');
    cylinder(washroom, .33, .045, [30.91, 1.465, z], 'brown', 'z');
  }
  box(washroom, [.42, .7, .34], [32.85, .36, 15.9], 'white');
  box(washroom, [.43, .16, .35], [32.85, .73, 15.9], 'trim');
  box(washroom, [.435, .13, .355], [32.85, .61, 15.9], 'blue');
  box(washroomUpper, [.29, .39, .035], [32.85, 1.42, 16.1], 'white');
  box(washroomUpper, [.19, .045, .04], [32.85, 1.33, 16.06], 'dark');
  bar(washroomUpper, [31.85, 1.47, 16.08], [32.4, 1.47, 16.08], .018);
  panel(washroomUpper, [.4, .18, .014], [31.85, 1.45, 13.07], 'white');
  repeats(washroom, 'washroom-threshold-slippers', [.11, .07, .22], [[31.5, .07, 15.75], [31.68, .07, 15.75]], 'brown');
  doorway('toilet', [33.3, 0, 15.2], .9, 2.2, { normal: 'x', style: 'half-glass', sourceTimesSeconds: [500, 502, 503, 505] });
  const supportDoor = doorway('corridor-unconfirmed-support', [33.3, 0, 12.45], .75, 2.15, { normal: 'x', style: 'half-glass', angle: 0, sourceTimesSeconds: [500, 501] });
  supportDoor.userData.roomFunctionUnconfirmed = true;
  const corridorBoard = group(architectureFixtures, 'corridor-quality-board', [34.295, 0, 12.05]);
  corridorBoard.rotation.y = -Math.PI / 2;
  Object.assign(corridorBoard.userData,{wallMounted:true,wallPlaneX:34.4,wallFaceX:34.34,mountGap:.015});
  box(corridorBoard, [.87, 1.9, .06], [0, .99, 0], 'white');
  for (const [y, paint] of [[1.58, 'blue'], [.99, 'red'], [.4, 'green']]) box(corridorBoard, [.79, .53, .018], [0, y, .041], paint);

  const services = group(ducts, 'high-visible-service-routes');
  for (const [y, paint] of [[5.35, 'blue'], [5.57, 'yellow'], [5.78, 'steel']]) {
    bar(services, [33.9, y, -3.1], [33.9, y, 4.3], .055, paint);
    bar(services, [16.8, y, 4.25], [33.9, y, 4.25], .055, paint);
  }
  const trays = group(services, 'overhead-cable-ladder');
  for (const x of [32.5, 33]) box(trays, [.045, .075, 7.9], [x, 5.5, .35]);
  repeats(trays, 'cable-ladder-rungs', [.55, .035, .035], Array.from({ length: 24 }, (_, i) => [32.75, 5.5, -3.35 + i * .32]), 'steel');
  for (const z of [5, 9.6, 14.2]) box(services, [11.5, .18, .14], [22.3, 5.9, z], 'cream');
  Object.assign(services.userData, { visibleRoutesOnly: true, hiddenConnectionsUnconfirmed: true });
  return environment;
}
