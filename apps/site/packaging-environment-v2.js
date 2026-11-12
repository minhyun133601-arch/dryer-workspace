import * as THREE from '../shared/vendor/three.module.js';
import { PACKAGING_STAIR_PROFILES, packagingEntryStairPlan } from './packaging-routes.js';

// Local drawing coordinates, metres: +X right, +Z toward the entrance, Y=0 at
// the selected floor. All overhead enclosure belongs to `ceiling` so the
// existing overview cutaway can expose rooms, machines and platforms.
const PI = Math.PI;
const UP = new THREE.Vector3(0, 1, 0);
const FORWARD = new THREE.Vector3(0, 0, 1);

function materials(s) {
  if (s.packagingEnvironmentV2Materials) return s.packagingEnvironmentV2Materials;
  const make = (color, roughness = .65, metalness = .1, extra = {}) => s._material(color, roughness, metalness, extra);
  const m = {
    cream: make(0xe3dcc0, .63, .27), panel: make(0xe9e9dd, .81, .05),
    concrete: make(0xc5c8bb, .91, .02), floor: make(0x2e8a55, .24, .12),
    stone: make(0xc8c3b1, .58, .035),
    steel: make(0x9ba5a8, .27, .9, { envMapIntensity: 1.1 }),
    silver: make(0xc8ccd0, .32, .75), darkDuct: make(0x4f525a, .48, .5),
    frame: make(0x83867e, .56, .52), black: make(0x202522, .7, .18),
    yellow: make(0xf2c200, .52, .16), blue: make(0x1f57a8, .5, .25),
    orange: make(0xe8622a, .58, .18), red: make(0xba3f32, .55, .2),
    maroon: make(0x944664, .8, .05),
    green: make(0x549b36, .7, .05), pallet: make(0xc6654c, .8, .05),
    sack: make(0xd6c5a6, .95), whiteSack: make(0xe6e5d6, .88),
    window: make(0xf2d21b, .42, .04, { emissive: 0xd7b91b, emissiveIntensity: .32 }),
    glass: make(0x96b8a9, .23, .12, { transparent: true, opacity: .3, depthWrite: false }),
    display: make(0x172c2c, .3, .1), led: make(0xef3b28, .4, .05, { emissive: 0xef291a, emissiveIntensity: .55 }),
    lamp: make(0xfff7dc, .5, .05, { emissive: 0xfff7dc, emissiveIntensity: .7 }),
    uv: make(0x526dff, .45, .02, { emissive: 0x3859ff, emissiveIntensity: .6 }),
  };
  m.checker = m.frame;
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#8f9799'; ctx.fillRect(0, 0, 128, 128);
      ctx.strokeStyle = '#c1c8c8'; ctx.lineWidth = 3;
      for (let y = 0; y < 128; y += 32) for (let x = 0; x < 128; x += 32) {
        ctx.beginPath(); ctx.moveTo(x + 4, y + 7); ctx.lineTo(x + 15, y + 18); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x + 20, y + 25); ctx.lineTo(x + 30, y + 15); ctx.stroke();
      }
      const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.repeat.set(4, 12); s.textures?.add(texture);
      m.checker = make(0xffffff, .48, .65, { map: texture });
    }
  }
  s.packagingEnvironmentV2Materials = m;
  return m;
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

function bars(s, parent, material, values, name, radius = .03) {
  const q = new THREE.Quaternion();
  return instances(s, parent, new THREE.CylinderGeometry(1, 1, 1, 10), material, values.map(([a, b, r]) => {
    const p = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(p);
    q.setFromUnitVectors(UP, delta.clone().normalize());
    return { position: p.add(end).multiplyScalar(.5).toArray(), quaternion: q.toArray(), scale: [r || radius, delta.length(), r || radius] };
  }), name);
}

function bentDuct(s, parent, material, coordinates, radius, name) {
  const points = coordinates.map((point) => new THREE.Vector3(...point));
  const path = new THREE.CurvePath(); let cursor = points[0];
  for (let i = 1; i < points.length - 1; i++) {
    const corner = points[i], incoming = corner.clone().sub(points[i - 1]), outgoing = points[i + 1].clone().sub(corner);
    const inset = Math.min(.23, incoming.length() * .35, outgoing.length() * .35);
    const before = corner.clone().addScaledVector(incoming.normalize(), -inset), after = corner.clone().addScaledVector(outgoing.normalize(), inset);
    if (cursor.distanceToSquared(before) > .000001) path.add(new THREE.LineCurve3(cursor, before));
    path.add(new THREE.QuadraticBezierCurve3(before, corner, after)); cursor = after;
  }
  path.add(new THREE.LineCurve3(cursor, points.at(-1)));
  const geometry = new THREE.TubeGeometry(path, Math.max(24, Math.ceil(path.getLength() * 12)), radius, 12, false);
  const mesh = s._mesh(geometry, material, parent); mesh.name = name;
  // Short closed cylinders cap the two tube ends; joins overlap the supply
  // header and the matching equipment port instead of exposing open meshes.
  const q = new THREE.Quaternion();
  const caps = [0, points.length - 1].map((index) => {
    const next = index ? points[index - 1] : points[1], direction = next.clone().sub(points[index]).normalize();
    q.setFromUnitVectors(UP, direction);
    return { position: points[index].toArray(), quaternion: q.toArray(), scale: [radius, .012, radius] };
  });
  instances(s, parent, new THREE.CylinderGeometry(1, 1, 1, 12), material, caps, `${name}-closed-end-connections`);
  return mesh;
}

function hoodConnectionHeight(layout, bounds, deck, z, booth = false, ribbon = false, ceilingLimit) {
  // Same visible mixer / charge-box / canopy dimensions as equipment-v2 hood().
  const bodyTop = deck + .16 + (ribbon ? 1.08 : 1.3), chargeTop = bodyTop + .53;
  const lower = Math.max(chargeTop + .72, deck + 2.35), bottom = booth ? lower : lower + .59;
  const roofLimit = ceilingLimit ?? roofHeightAt(layout, bounds, z);
  return Math.max(bottom + .05, Math.min(6.15, roofLimit - .4, bottom + .55)) + .14;
}

function beamEntries(a, b, width, depth) {
  const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start);
  const q = new THREE.Quaternion().setFromUnitVectors(FORWARD, delta.clone().normalize());
  return { position: start.add(end).multiplyScalar(.5).toArray(), quaternion: q.toArray(), scale: [width, depth, delta.length()] };
}

function hBeams(s, parent, material, members, name) {
  const entries = [];
  for (const [a, b, width = .2, depth = .4] of members) {
    const middle = beamEntries(a, b, width, depth), q = new THREE.Quaternion().fromArray(middle.quaternion);
    for (const offset of [-1, 1]) {
      const p = new THREE.Vector3(0, offset * (depth / 2 - .01), 0).applyQuaternion(q).add(new THREE.Vector3(...middle.position));
      entries.push({ ...middle, position: p.toArray(), scale: [width, .02, middle.scale[2]] });
    }
    entries.push({ ...middle, scale: [.014, depth - .035, middle.scale[2]] });
  }
  return instances(s, parent, new THREE.BoxGeometry(1, 1, 1), material, entries, name);
}

function roofHeightAt(layout, bounds, z) {
  const eave = layout.roof?.eaveHeight ?? layout.eaveHeight ?? 6;
  const ridge = layout.roof?.ridgeHeight ?? layout.ridgeHeight ?? 7.36;
  const middle = (bounds.minZ + bounds.maxZ) / 2;
  const ridgeOffset = layout.roof?.ridgeOffset ?? (bounds.maxZ - bounds.minZ) / 4;
  const knots = [[bounds.minZ, eave], [middle - ridgeOffset, ridge], [middle, eave], [middle + ridgeOffset, ridge], [bounds.maxZ, eave]];
  for (let i = 0; i < knots.length - 1; i++) if (z <= knots[i + 1][0]) {
    const t = Math.max(0, (z - knots[i][0]) / (knots[i + 1][0] - knots[i][0]));
    return knots[i][1] + (knots[i + 1][1] - knots[i][1]) * t;
  }
  return eave;
}

function roofAndCeiling(s, groups, room, bounds, m) {
  const layout = room.layout, level = room.floorLevel || 3;
  const width = bounds.maxX - bounds.minX, depth = bounds.maxZ - bounds.minZ, cx = (bounds.minX + bounds.maxX) / 2;
  const height = layout.ceilingHeight ?? (level === 2 ? 6.15 : 6);
  const members = [], purlins = [], lights = [];
  if (level === 3) {
    const cz = (bounds.minZ + bounds.maxZ) / 2, offset = layout.roof?.ridgeOffset ?? depth / 4;
    const zKnots = [bounds.minZ, cz - offset, cz, cz + offset, bounds.maxZ];
    const panels = [];
    for (let i = 0; i < zKnots.length - 1; i++) {
      const z0 = zKnots[i], z1 = zKnots[i + 1], y0 = roofHeightAt(layout, bounds, z0), y1 = roofHeightAt(layout, bounds, z1);
      const slopeLength = Math.hypot(z1 - z0, y1 - y0), angle = -Math.atan2(y1 - y0, z1 - z0);
      panels.push([[cx, (y0 + y1) / 2 + .07, (z0 + z1) / 2], [width + .24, .1, slopeLength + .04], [angle, 0, 0]]);
      for (let x = bounds.minX + .3; x <= bounds.maxX; x += 5.125) members.push([[x, y0 - .23, z0], [x, y1 - .23, z1], .2, .4]);
    }
    boxes(s, groups.ceiling, m.panel, panels, 'packaging-m-shaped-twin-gable-roof-panels');
    for (let z = bounds.minZ + .2; z <= bounds.maxZ; z += 1) purlins.push([[cx, roofHeightAt(layout, bounds, z) - .03, z], [width, .1, .05]]);
    bars(s, groups.ceiling, m.frame, [[[bounds.minX, height - .08, cz], [bounds.maxX, height - .08, cz], .1]], 'packaging-central-200pvc-valley-gutter');
    groups.ceiling.userData.roofProfile = { eaveHeight: layout.roof?.eaveHeight ?? 6, ridgeHeight: layout.roof?.ridgeHeight ?? 7.36, ridges: [cz - offset, cz + offset] };
  } else {
    s._box(groups.ceiling, [width, .2, depth], [cx, height + .1, (bounds.minZ + bounds.maxZ) / 2], m.panel).name = 'packaging-upper-floor-slab-soffit';
    for (let z = bounds.minZ + .3; z <= bounds.maxZ; z += 5) members.push([[bounds.minX, height - .395, z], [bounds.maxX, height - .395, z], .3, .79]);
    for (let x = bounds.minX + 5.125; x < bounds.maxX; x += 5.125) members.push([[x, height - .395, bounds.minZ], [x, height - .395, bounds.maxZ], .3, .79]);
  }
  hBeams(s, groups.ceiling, m.cream, members, 'packaging-overhead-h-section-structure');
  boxes(s, groups.ceiling, m.cream, purlins, 'packaging-roof-purlins-at-one-metre');
  for (const x of [-5.125, 5.125]) for (const z of [-10, -5, 0, 5, 10]) {
    const y = level === 3 ? roofHeightAt(layout, bounds, z) - .75 : height - 1.13;
    lights.push({ position: [x, y, z], scale: [.22, .06, .22] });
  }
  instances(s, groups.ceiling, new THREE.CylinderGeometry(1, 1, 1, 20), m.lamp, lights, 'packaging-round-high-bay-led-lights', false);
}

function windowSegments(layout, bounds, level) {
  if (Array.isArray(layout.windowSegments)) return layout.windowSegments;
  if (level === 1) return [
    { side: 'minX', from: -9, to: 9, bottom: 1.4, top: 2.5, sparse: true },
    { side: 'maxZ', from: bounds.minX + 2, to: -6, bottom: 1.4, top: 2.5, sparse: true },
  ];
  return [
    { side: 'minX', from: bounds.minZ + .6, to: bounds.maxZ - .6, bottom: 1, top: 2.5 },
    { side: 'maxZ', from: bounds.minX + .6, to: -5.2, bottom: 1, top: 2.5 },
    { side: 'maxZ', from: 4.9, to: bounds.maxX - .6, bottom: 1, top: 2.5 },
  ];
}

function enclosure(s, groups, room, bounds, m) {
  const layout = room.layout, level = room.floorLevel || 3, h = level === 3 ? (layout.roof?.eaveHeight ?? 6) : (layout.ceilingHeight ?? (level === 2 ? 6.15 : 6));
  const segments = windowSegments(layout, bounds, level), low = [], high = [], panes = [], mullions = [], joints = [];
  for (const side of ['minX', 'maxX', 'minZ', 'maxZ']) {
    const alongZ = side.endsWith('X'), fixed = bounds[side] + (side.startsWith('min') ? .04 : -.04);
    const start = alongZ ? bounds.minZ : bounds.minX, end = alongZ ? bounds.maxZ : bounds.maxX;
    const windows = segments.filter((entry) => entry.side === side);
    const doorways = (layout.doors || []).filter((door) => Math.abs((alongZ ? door.x : door.z) - bounds[side]) < .2).map((door) => ({ from: (alongZ ? door.z : door.x) - door.width / 2 - .04, to: (alongZ ? door.z : door.x) + door.width / 2 + .04, height: door.height || 2.25 }));
    const cuts = [...new Set([start, end, ...windows.flatMap((v) => [Math.max(start, v.from), Math.min(end, v.to)]), ...doorways.flatMap((v) => [Math.max(start, v.from), Math.min(end, v.to)])])].sort((a, b) => a - b);
    const addPanel = (list, a, b, bottom, top) => {
      if (b <= a || top <= bottom) return;
      const p = alongZ ? [fixed, (bottom + top) / 2, (a + b) / 2] : [(a + b) / 2, (bottom + top) / 2, fixed];
      list.push([p, alongZ ? [.1, top - bottom, b - a] : [b - a, top - bottom, .1]]);
    };
    for (let i = 0; i < cuts.length - 1; i++) {
      const a = cuts[i], b = cuts[i + 1], mid = (a + b) / 2;
      const win = windows.find((v) => mid >= v.from && mid <= v.to);
      const doorway = doorways.find((v) => mid >= v.from && mid <= v.to);
      if (doorway) { addPanel(high, a, b, doorway.height, h); continue; }
      addPanel(low, a, b, 0, Math.min(.95, win?.bottom ?? .95));
      if (!win) addPanel(high, a, b, .95, h);
      else {
        addPanel(high, a, b, .95, win.bottom ?? 1);
        addPanel(high, a, b, win.top ?? 2.5, h);
        const bottom = win.bottom ?? 1, top = win.top ?? 2.5, paneStep = win.sparse ? 3.2 : 1.28;
        for (let p = a; p < b - .1; p += paneStep) {
          const length = Math.min(win.sparse ? 1.15 : 1.2, b - p - .04);
          if (length <= 0) continue;
          const center = p + length / 2;
          panes.push([alongZ ? [fixed, (bottom + top) / 2, center] : [center, (bottom + top) / 2, fixed], alongZ ? [.04, top - bottom, length] : [length, top - bottom, .04]]);
          for (const position of [p, p + length]) mullions.push([alongZ ? [fixed, (bottom + top) / 2, position] : [position, (bottom + top) / 2, fixed], alongZ ? [.08, top - bottom + .08, .045] : [.045, top - bottom + .08, .08]]);
          if (win.sparse) addPanel(high, p + length, Math.min(p + paneStep, b), bottom, top);
        }
        for (const y of [bottom, (bottom + top) / 2, top]) mullions.push([alongZ ? [fixed, y, mid] : [mid, y, fixed], alongZ ? [.085, .055, b - a] : [b - a, .055, .085]]);
      }
    }
    for (let y = 3; y < h; y += 1.05) joints.push([alongZ ? [fixed + (side.startsWith('min') ? .06 : -.06), y, (start + end) / 2] : [(start + end) / 2, y, fixed + (side.startsWith('min') ? .06 : -.06)], alongZ ? [.008, .012, end - start] : [end - start, .012, .008]]);
  }
  boxes(s, groups.structure, m.panel, low, 'packaging-perimeter-low-cutaway-panels');
  boxes(s, groups.ceiling, m.panel, high, 'packaging-perimeter-full-height-upper-panels');
  boxes(s, groups.structure, level === 1 ? m.glass : m.window, panes, 'packaging-drawing-correct-yellow-window-bands', false);
  boxes(s, groups.structure, m.frame, mullions, 'packaging-two-tier-window-mullions');
  boxes(s, groups.ceiling, m.frame, joints, 'packaging-sandwich-panel-horizontal-joints', false);
}

function columnsAndBraces(s, groups, room, bounds, m) {
  const layout = room.layout, level = room.floorLevel || 3, h = level === 3 ? (layout.roof?.eaveHeight ?? 6) : (layout.ceilingHeight ?? (level === 2 ? 6.15 : 6));
  const xAxes = [-15.375, -10.25, -5.125, 0, 5.125, 10.25, 15.375], zAxes = [-14.9, -10, -5, 0, 5, 10, 14.9];
  const defaults = [...xAxes.flatMap((x) => [zAxes[0], zAxes.at(-1)].map((z) => ({ x, z }))), ...zAxes.slice(1, -1).flatMap((z) => [xAxes[0], xAxes.at(-1)].map((x) => ({ x, z }))), ...[-5.125, 5.125].map((x) => ({ x, z: 0 }))];
  const columns = layout.columns || defaults, members = [], feet = [], guards = [], blackBands = [], wallBraces = [];
  for (const col of columns) {
    const w = col.width ?? (level === 3 ? .3 : .428), d = col.depth ?? w;
    members.push([[col.x, h / 2, col.z], [.014, h, Math.max(.02, d - .03)]], [[col.x, h / 2, col.z - d / 2], [w, h, .022]], [[col.x, h / 2, col.z + d / 2], [w, h, .022]]);
    feet.push([[col.x, .06, col.z], [w + .2, .12, d + .2]]);
    if (Math.abs(col.z) < .1 && col.x > bounds.minX + 1 && col.x < bounds.maxX - 1) {
      for (const z of [col.z - .45, col.z + .45]) {
        guards.push([[col.x - .5, .1, z], [col.x - .5, .85, z], .05], [[col.x + .5, .1, z], [col.x + .5, .85, z], .05], [[col.x - .5, .85, z], [col.x + .5, .85, z], .05]);
        for (const x of [col.x - .5, col.x + .5]) for (const y of [.25, .55]) blackBands.push({ position: [x, y, z], scale: [.054, .16, .054] });
      }
    }
  }
  for (const side of ['minX', 'maxX']) {
    const x = bounds[side] + (side === 'minX' ? .18 : -.18);
    for (const [z0, z1] of [[-10, -5], [5, 10]]) wallBraces.push([[x, 2.65, z0], [x, h - .2, z1], .017], [[x, h - .2, z0], [x, 2.65, z1], .017]);
  }
  boxes(s, groups.structure, m.cream, members, 'packaging-cream-h-section-columns');
  boxes(s, groups.structure, m.frame, feet, 'packaging-column-baseplates');
  bars(s, groups.structure, m.yellow, guards, 'packaging-column-u-pipe-protectors');
  instances(s, groups.structure, new THREE.CylinderGeometry(1, 1, 1, 10), m.black, blackBands, 'packaging-column-protector-black-bands');
  bars(s, groups.ceiling, m.frame, wallBraces, 'packaging-wall-x-rod-bracing');
}

function partitionIntervals(part, doors) {
  const dx = part.to[0] - part.from[0], dz = part.to[1] - part.from[1], length = Math.hypot(dx, dz);
  if (!length) return [];
  const cuts = [];
  for (const door of doors) {
    const t = ((door.x - part.from[0]) * dx + (door.z - part.from[1]) * dz) / (length * length);
    const perpendicular = Math.abs((door.x - part.from[0]) * dz - (door.z - part.from[1]) * dx) / length;
    if (perpendicular < .19 && t >= 0 && t <= 1) cuts.push([Math.max(0, t * length - door.width / 2 - .04), Math.min(length, t * length + door.width / 2 + .04)]);
  }
  const result = []; let cursor = 0;
  for (const [a, b] of cuts.sort((x, y) => x[0] - y[0])) { if (a > cursor) result.push([cursor, a]); cursor = Math.max(cursor, b); }
  if (cursor < length) result.push([cursor, length]);
  return result.map(([a, b]) => ({ center: [part.from[0] + dx * (a + b) / (2 * length), part.from[1] + dz * (a + b) / (2 * length)], length: b - a, rotation: -Math.atan2(dz, dx) }));
}

function roomsAndDoors(s, groups, room, m) {
  const layout = room.layout, low = [], high = [], tops = [], roomFloors = [], doorHeads=new Set();
  for (const part of layout.partitions || []) {
    const height = part.height ?? 3, thickness = part.thickness ?? .08;
    // Confirmed conveyor crossings are low transfer hatches, not human doors.
    const passages = transportCrossings(part, layout.transportLines || []);
    for (const segment of partitionIntervals(part, [...(layout.doors || []), ...passages])) {
      low.push([[segment.center[0], .55, segment.center[1]], [segment.length, 1.1, thickness], [0, segment.rotation, 0]]);
      high.push([[segment.center[0], (height + 1.1) / 2, segment.center[1]], [segment.length, Math.max(.02, height - 1.1), thickness], [0, segment.rotation, 0]]);
    }
    // Door cuts stop at the head. Removing the whole-height interval left
    // the upper partition and wall-mounted exit fittings unsupported.
    const dx=part.to[0]-part.from[0],dz=part.to[1]-part.from[1],length=Math.hypot(dx,dz);
    for(const door of layout.doors || []) {
      const along=((door.x-part.from[0])*dx+(door.z-part.from[1])*dz)/length;
      const across=Math.abs((door.x-part.from[0])*dz-(door.z-part.from[1])*dx)/length;
      const doorHeight=door.height||2.25;
      // Some room-cell walls already end at the two jambs. Include those
      // adjacent segments, but add their shared lintel only once.
      if(across<.19&&along>=-door.width/2-.04&&along<=length+door.width/2+.04&&height>doorHeight&&!doorHeads.has(door.id)) {
        high.push([[door.x,(height+doorHeight)/2,door.z],[door.width+.08,height-doorHeight,thickness],[0,-Math.atan2(dz,dx),0]]);
        doorHeads.add(door.id);
      }
    }
    for (const passage of passages) {
      const rotation = -Math.atan2(part.to[1] - part.from[1], part.to[0] - part.from[0]);
      low.push([[passage.x, passage.bottom / 2, passage.z], [passage.width + .08, passage.bottom, thickness], [0, rotation, 0]]);
      high.push([[passage.x, (height + passage.height) / 2, passage.z], [passage.width + .08, height - passage.height, thickness], [0, rotation, 0]]);
    }
  }
  for (const r of layout.rooms || []) {
    const w = r.maxX - r.minX, d = r.maxZ - r.minZ, cx = (r.minX + r.maxX) / 2, cz = (r.minZ + r.maxZ) / 2;
    if (w <= 0 || d <= 0) continue;
    // Room metadata may include the projecting entrance / stair enclosure.
    // Its floor must not become a solid plate across the descending flights.
    const b = room.mainBounds || layout.mainBounds;
    const floorMinX = Math.max(r.minX, b.minX), floorMaxX = Math.min(r.maxX, b.maxX);
    const floorMinZ = Math.max(r.minZ, b.minZ), floorMaxZ = Math.min(r.maxZ, b.maxZ);
    if (floorMaxX - floorMinX > .08 && floorMaxZ - floorMinZ > .08) roomFloors.push([[(floorMinX + floorMaxX) / 2, .018, (floorMinZ + floorMaxZ) / 2], [floorMaxX - floorMinX - .08, .015, floorMaxZ - floorMinZ - .08]]);
    if (r.ceiling !== false && (r.height ?? 3) <= 3.5 && (w * d < 80 || r.ceiling === true)) tops.push([[cx, (r.height ?? 3) + .025, cz], [w, .05, d]]);
  }
  boxes(s, groups.structure, m.panel, low, 'packaging-room-cutaway-lower-partitions');
  boxes(s, groups.ceiling, m.panel, high, 'packaging-room-three-metre-upper-partitions');
  boxes(s, groups.ceiling, m.panel, tops, 'packaging-room-t50-panel-ceilings');
  boxes(s, groups.deck, m.floor, roomFloors, 'packaging-room-epoxy-floor-insets', false);
  for (const data of layout.doors || []) {
    const g = s._group(groups.structure, [data.x, 0, data.z]); g.rotation.y = data.rotation || 0; g.name = `packaging-door-${data.id}`;
    const width = data.width || 1.2, height = data.height || 2.25, glazed = data.glazed || /entry|hygiene|weigh/.test(data.id);
    boxes(s, g, glazed ? m.black : m.frame, [
      [[-width / 2, height / 2, 0], [.07, height, .12]], [[width / 2, height / 2, 0], [.07, height, .12]], [[0, height, 0], [width + .1, .07, .12]],
    ], 'packaging-door-fixed-frames');
    const leaf = s._group(g, [-width / 2, 0, 0]);
    Object.assign(leaf.userData, { filmedOpenAngle: data.openAngle ?? PI / 2, proximityDoor: { enterable: width >= .75 && height >= 1.9, groupId: `packaging:${room.floorLevel || room.id}:${data.id}`, ...(room.floorLevel === 1 && data.id === 'entry-door' ? { portal: { area: 'campus', entry: 'team2-rear' } } : {}), label: data.name || data.label || '2팀 실내 출입문', accessBasis: 'registered partition gap and modelled room floor', kind: 'hinge', axis: 'y', closed: 0, open: data.openAngle || PI / 2, trigger: [0, 0, 0], width, height, openDistance: 2.2, closeDistance: 3.1 } });
    s._box(leaf, [width - .08, height - .06, .04], [width / 2, height / 2, 0], glazed ? m.glass : m.panel).name = 'packaging-open-door-leaf';
    boxes(s, leaf, glazed ? m.blue : m.frame, [
      [[.04, height / 2, 0], [.06, height, .06]], [[width - .04, height / 2, 0], [.06, height, .06]],
      [[width / 2, .04, 0], [width, .06, .06]], [[width / 2, height - .04, 0], [width, .06, .06]],
      [[width - .17, 1.03, .05], [.04, .24, .04]],
    ], 'packaging-door-leaf-frames-and-handle');
    if (!glazed) s._box(leaf, [width * .44, .45, .045], [width / 2, 1.55, .025], m.glass);
  }
}

function transportCrossings(part, lines) {
  const horizontal = Math.abs(part.to[1] - part.from[1]) < .001;
  const fixed = horizontal ? part.from[1] : part.from[0];
  const min = Math.min(part.from[horizontal ? 0 : 1], part.to[horizontal ? 0 : 1]);
  const max = Math.max(part.from[horizontal ? 0 : 1], part.to[horizontal ? 0 : 1]);
  const result = [];
  for (const line of lines) for (let i = 1; i < line.points.length; i++) {
    const a = line.points[i - 1], b = line.points[i], normal = horizontal ? 1 : 0, along = 1 - normal;
    if (Math.abs(a[normal] - b[normal]) < .001 || (fixed - a[normal]) * (fixed - b[normal]) > 0) continue;
    const t = (fixed - a[normal]) / (b[normal] - a[normal]), coordinate = a[along] + t * (b[along] - a[along]);
    if (coordinate <= min + .05 || coordinate >= max - .05) continue;
    const x = horizontal ? coordinate : fixed, z = horizontal ? fixed : coordinate;
    if (result.some(p => Math.hypot(p.x - x, p.z - z) < .12)) continue;
    result.push({ x, z, width: (line.width || .55) + .18, bottom: .30, height: (line.height || .74) + .6 });
  }
  return result;
}

// Drawing polylines form the fixed floor network. Repeated rollers are batched;
// the visible connection topology is preserved without inventing drive chains
// or assigning a flow direction which the drawings do not establish.
function transportLines(s, groups, room, m) {
  groups.transport = s._group(groups.deck);
  groups.transport.name = `packaging-${room.floorLevel}f-fixed-transport-network`;
  const lines = room.layout.transportLines || [];
  groups.transport.userData.lines = lines;
  const columns = room.layout.columns || [];
  const roll = [], rails = [], legs = [], feet = [], braces = [], beds = [];
  const reviewGaps = [];
  for (const line of lines) {
    const width = line.width || .55, y = line.height || .74;
    for (let i = 1; i < line.points.length; i++) {
      const a = line.points[i - 1], b = line.points[i], dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
      if (length < .01) continue;
      const ux = dx / length, uz = dz / length, sx = -uz, sz = ux, angle = -Math.atan2(dz, dx);
      const exclusions = [];
      for (const col of columns) {
        // Clip an unresolved drawing-to-column conflict, never bend the source
        // line around it or let solid rollers pierce a structural column.
        const halfX = (col.width ?? .428) / 2 + width / 2 + .025;
        const halfZ = (col.depth ?? col.width ?? .428) / 2 + width / 2 + .025;
        let lo = 0, hi = length;
        for (const [origin, delta, center, half] of [[a[0], ux, col.x, halfX], [a[1], uz, col.z, halfZ]]) {
          if (Math.abs(delta) < 1e-8) { if (Math.abs(origin - center) > half) { hi = -1; break; } }
          else { const t0 = (center - half - origin) / delta, t1 = (center + half - origin) / delta; lo = Math.max(lo, Math.min(t0, t1)); hi = Math.min(hi, Math.max(t0, t1)); }
        }
        if (hi > lo) { exclusions.push([lo, hi]); reviewGaps.push({ line: line.id, column: [col.x, col.z], from: [a[0] + ux * lo, a[1] + uz * lo], to: [a[0] + ux * hi, a[1] + uz * hi] }); }
      }
      const intervals = []; let cursor = 0;
      for (const [lo, hi] of exclusions.sort((x, z) => x[0] - z[0])) { if (lo > cursor + .02) intervals.push([cursor, lo]); cursor = Math.max(cursor, hi); }
      if (cursor < length - .02) intervals.push([cursor, length]);
      for (const [start, end] of intervals) {
        const len = end - start, mid = (start + end) / 2, cx = a[0] + ux * mid, cz = a[1] + uz * mid;
        for (const side of [-1, 1]) rails.push([[cx + sx * side * (width / 2 + .025), y - .04, cz + sz * side * (width / 2 + .025)], [len, .13, .045], [0, angle, 0]]);
        if (line.surface === 'belt') beds.push([[cx, y - .005, cz], [len, .055, width], [0, angle, 0]]);
        else {
          const count = Math.max(1, Math.ceil(len / .105)), q = new THREE.Quaternion().setFromUnitVectors(UP, new THREE.Vector3(sx, 0, sz));
          for (let n = 0; n < count; n++) { const t = start + (n + .5) * len / count; roll.push({ position: [a[0] + ux * t, y - .035, a[1] + uz * t], scale: [.035, width - .025, .035], quaternion: q.toArray() }); }
        }
        const supports = Math.max(1, Math.ceil(len / 2.1));
        for (let n = 0; n < supports; n++) {
          const t = start + (n + .5) * len / supports, px = a[0] + ux * t, pz = a[1] + uz * t;
          for (const side of [-1, 1]) {
            const x = px + sx * side * width * .45, z = pz + sz * side * width * .45;
            if (columns.some(col => Math.abs(x - col.x) < ((col.width ?? .428) + .2) / 2 + .055 && Math.abs(z - col.z) < ((col.depth ?? col.width ?? .428) + .2) / 2 + .055)) continue;
            legs.push([[x, (y - .08) / 2, z], [.04, y - .08, .04]]);
            feet.push([[x, .035, z], [.10, .05, .10]]);
          }
          braces.push([[px, .22, pz], [.035, .035, width], [0, angle, 0]]);
        }
      }
    }
  }
  instances(s, groups.transport, new THREE.CylinderGeometry(1, 1, 1, 10), m.silver, roll, 'packaging-plan-transport-exposed-rollers');
  boxes(s, groups.transport, m.steel, rails, 'packaging-plan-transport-side-frames');
  boxes(s, groups.transport, m.frame, [...legs, ...braces], 'packaging-plan-transport-floor-supports');
  boxes(s, groups.transport, m.black, feet, 'packaging-plan-transport-adjustable-feet');
  boxes(s, groups.transport, m.blue, beds, 'packaging-plan-transport-flat-belt-sections');
  groups.transport.userData.reviewGaps = reviewGaps;
}

function platform(s, parent, data, name, main, m) {
  if (!data || !(data.height > 0)) return;
  const { minX, maxX, height: y } = data, ends = data.stairEnds || [], strip = data.stairLength || 1.2;
  const minZ = data.minZ + (ends.includes('minZ') ? strip : 0), maxZ = data.maxZ - (ends.includes('maxZ') ? strip : 0);
  const width = maxX - minX, length = maxZ - minZ, centerX = (minX + maxX) / 2, centerZ = (minZ + maxZ) / 2;
  if (width <= 0 || length <= 0) return;
  const g = s._group(parent); g.name = name; g.userData.platformHeight = y;
  const walkWidth = data.walkwayWidth ?? (main ? Math.min(2.75, width * .49) : width);
  const openings = (data.deckOpenings || []).filter((hole) => hole.x - hole.width / 2 > minX && hole.x + hole.width / 2 < maxX && hole.z - hole.depth / 2 > minZ && hole.z + hole.depth / 2 < maxZ);
  if (openings.length) {
    const shape = new THREE.Shape(); shape.moveTo(minX, minZ); shape.lineTo(maxX, minZ); shape.lineTo(maxX, maxZ); shape.lineTo(minX, maxZ); shape.closePath();
    for (const hole of openings) {
      const left = hole.x - hole.width / 2, right = hole.x + hole.width / 2, front = hole.z - hole.depth / 2, back = hole.z + hole.depth / 2;
      const path = new THREE.Path(); path.moveTo(left, front); path.lineTo(left, back); path.lineTo(right, back); path.lineTo(right, front); path.closePath(); shape.holes.push(path);
    }
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: .1, bevelEnabled: false, steps: 1, curveSegments: 1 }); geometry.rotateX(PI / 2);
    s._mesh(geometry, m.checker, g, [0, y, 0]).name = `${name}-checker-plate-deck-with-hopper-openings`;
    g.userData.deckOpenings = openings.map((entry) => ({ ...entry }));
  } else s._box(g, [walkWidth, .1, length], [maxX - walkWidth / 2, y - .05, centerZ], m.checker).name = `${name}-checker-plate-deck`;
  const frame = [], posts = [], rails = [], braces = [], feet = [], kickplates = [], haunches = [];
  for (const x of [minX + .1, maxX - .1]) {
    frame.push([[x, y - .18, centerZ], [.18, .32, length]], [[x, y - .54, centerZ], [.14, .14, length]]);
    for (let z = minZ + .15; z <= maxZ; z += 3.6) {
      posts.push([[x, (y - .2) / 2, z], [.16, y - .2, .16]]);
      feet.push([[x, .045, z], [.31, .09, .31]]);
      haunches.push({ position: [x, y - .2, z] });
      for (const sign of [-1, 1]) braces.push([[x, y - .92, z], [x, y - .23, Math.max(minZ, Math.min(maxZ, z + sign * .65))], .07]);
    }
    for (let z = minZ; z <= maxZ + .01; z += 1.5) rails.push([[x, y, z], [x, y + 1.1, z], .024]);
    for (const rise of [.35, .72, 1.1]) rails.push([[x, y + rise, minZ], [x, y + rise, maxZ], .024]);
    kickplates.push([[x, y + .075, centerZ], [.035, .15, length]]);
  }
  for (let z = minZ; z <= maxZ + .01; z += length / Math.max(1, Math.round(length / 4))) frame.push([[centerX, y - .2, z], [width, .28, .18]]);
  boxes(s, g, m.cream, frame.concat(posts), `${name}-ivory-double-edge-beams-and-posts`);
  boxes(s, g, m.frame, feet, `${name}-steel-baseplates`);
  bars(s, g, m.cream, braces, `${name}-y-shaped-post-haunches`);
  const haunchShape = new THREE.Shape(); haunchShape.moveTo(-.52, 0); haunchShape.lineTo(.52, 0); haunchShape.lineTo(.08, -.7); haunchShape.lineTo(-.08, -.7); haunchShape.closePath();
  const haunchGeometry = new THREE.ExtrudeGeometry(haunchShape, { depth: .07, bevelEnabled: false, steps: 1, curveSegments: 1 }); haunchGeometry.translate(0, 0, -.035); haunchGeometry.rotateY(PI / 2);
  instances(s, g, haunchGeometry, m.cream, haunches, `${name}-inverted-triangular-plate-haunches`);
  bars(s, g, m.steel, rails, `${name}-three-level-stainless-pipe-rails`);
  boxes(s, g, m.yellow, kickplates, `${name}-yellow-deck-kickplates`);
  for (const end of ends) {
    const z = (end === 'minZ' ? data.minZ : maxZ) + strip / 2;
    const run = Math.min(3, width - .3), topX = maxX - .15, bottomX = topX - run, stairWidth = Math.max(.85, strip - .1), count = data.stairSteps || Math.max(10, Math.round(y / .19));
    const treads = [], nosings = [], stairRails = [], stringers = [];
    for (let step = 0; step < count; step++) {
      const x = bottomX + (step + .5) * run / count, rise = (step + 1) * y / count;
      treads.push([[x, rise - .035, z], [run / count + .025, .07, stairWidth]]);
      nosings.push([[x - run / count * .4, rise + .006, z], [.035, .014, stairWidth]]);
    }
    for (const side of [-1, 1]) {
      const rz = z + side * stairWidth / 2;
      stringers.push(beamEntries([bottomX, .02, rz], [topX, y - .08, rz], .08, .2));
      for (const rise of [.52, 1.06]) stairRails.push([[bottomX, rise, rz], [topX, y + rise, rz], .024]);
      for (const t of [0, .5, 1]) stairRails.push([[bottomX + run * t, y * t, rz], [bottomX + run * t, y * t + 1.06, rz], .024]);
      s._cyl(g, .085, .9, [bottomX - .18, .45, rz], m.yellow, .085, 12).name = `${name}-stair-bollard`;
      instances(s, g, new THREE.CylinderGeometry(.088, .088, .15, 12), m.black, [.15, .45, .75].map((height) => ({ position: [bottomX - .18, height, rz] })), `${name}-stair-bollard-black-bands`);
    }
    boxes(s, g, m.checker, treads, `${name}-${end}-open-riser-treads`);
    boxes(s, g, m.yellow, nosings, `${name}-${end}-full-width-yellow-nosings`, false);
    instances(s, g, new THREE.BoxGeometry(1, 1, 1), m.cream, stringers, `${name}-${end}-cream-stair-stringers`);
    bars(s, g, m.steel, stairRails, `${name}-${end}-stainless-stair-handrails`);
    s._box(g, [.15, .1, strip], [maxX - .075, y - .05, z], m.checker).name = `${name}-stair-open-top-landing`;
  }
}

function stairOwnership(group, profile, treadCount) {
  Object.assign(group.userData, { selectedFloor: profile.toFloor, connectsFloors: [profile.fromFloor, profile.toFloor],
    adjacentFloorOnly: true, rise: profile.rise, fromElevation: profile.fromElevation, toElevation: profile.toElevation,
    treadCount, countConfidence: '단수는 영상 형식과 건축 도면의 층간 높이에 맞춘 재현값이며 실측값이 아닙니다.' });
}

function entryBuildingStair(s, groups, data, level, m) {
  const p = packagingEntryStairPlan(level, data), g = s._group(groups.structure);
  g.name = `packaging-building-${data.id}`; stairOwnership(g, p, p.flights * p.stepsPerFlight); g.userData.flightCount = p.flights;
  const width = p.maxX - p.minX, depth = p.maxZ - p.minZ, cx = (p.minX + p.maxX) / 2;
  if (level === 1) {
    boxes(s, g, m.stone, [
      [[cx, -p.rise - .06, (p.thresholdZ + p.maxZ) / 2], [width, .12, p.maxZ - p.thresholdZ]],
      [[cx, -.06, (p.minZ + p.thresholdZ) / 2], [width, .12, p.thresholdZ - p.minZ]],
      [[cx, -p.rise / 2, p.thresholdZ], [width, p.rise, .025]],
    ], 'packaging-first-floor-single-100mm-entry-threshold');
    boxes(s, g, m.black, [[[cx, .006, p.thresholdZ - .02], [width, .012, .035]]], 'packaging-ground-entry-threshold-edge', false);
    return;
  }
  const run = p.right - p.left, flightRise = p.rise / p.flights, riser = flightRise / p.stepsPerFlight;
  const treads = [], faces = [], nosings = [], slabs = [], skirting = [], landings = [], rails = [];
  for (let flight = 0; flight < p.flights; flight++) {
    const forward = flight % 2 === 0, sign = forward ? 1 : -1, z = p.lanes[flight % 2], base = -p.rise + flight * flightRise;
    const startX = forward ? p.left : p.right, endX = forward ? p.right : p.left;
    for (let step = 0; step < p.stepsPerFlight; step++) {
      const leadingX = startX + sign * step * run / p.stepsPerFlight, x = leadingX + sign * run / p.stepsPerFlight / 2;
      const y = base + (step + 1) * riser;
      treads.push([[x, y - .0375, z], [run / p.stepsPerFlight + .018, .075, p.laneWidth]]);
      faces.push([[leadingX, y - riser / 2, z], [.022, riser, p.laneWidth]]);
      nosings.push([[leadingX + sign * .02, y + .006, z], [.035, .012, p.laneWidth]]);
    }
    const angle = sign * Math.atan2(flightRise, run), diagonal = Math.hypot(run, flightRise);
    slabs.push([[(p.left + p.right) / 2, base + flightRise / 2 - .14, z], [diagonal, .14, p.laneWidth], [0, 0, angle]]);
    for (const side of [-1, 1]) {
      const edgeZ = z + side * p.laneWidth / 2;
      skirting.push([[(p.left + p.right) / 2, base + flightRise / 2 + .04, edgeZ], [diagonal, .09, .028], [0, 0, angle]]);
      // The upper inner rail opens toward the entrance landing; it must not
      // continue across the walker's waist on the way through the doorway.
      const railEnd = flight === p.flights - 1 && side === -1 ? Math.max(.4, 1 - .7 / run) : 1;
      for (const h of [.5, 1.02]) rails.push([[startX, base + h, edgeZ], [startX + (endX - startX) * railEnd, base + flightRise * railEnd + h, edgeZ], .028]);
      for (const t of [0, railEnd / 2, railEnd]) rails.push([[startX + (endX - startX) * t, base + flightRise * t, edgeZ], [startX + (endX - startX) * t, base + flightRise * t + 1.02, edgeZ], .025]);
    }
  }
  for (let i = 0; i <= p.flights; i++) {
    const y = -p.rise + i * flightRise, x = i % 2 === 0 ? p.leftLanding : p.rightLanding;
    landings.push([[x, y - .09, (p.minZ + p.maxZ) / 2], [p.landingWidth, .18, depth]]);
    const outerX = i % 2 === 0 ? p.minX + .05 : p.maxX - .05;
    if (i !== p.flights) for (const h of [.5, 1.02]) rails.push([[outerX, y + h, p.minZ + .05], [outerX, y + h, p.maxZ - .05], .028]);
  }
  landings.push([[-4.1, -.06, p.minZ + .325], [.7, .12, .65]]);
  boxes(s, g, m.stone, treads.concat(faces, slabs, landings), 'packaging-building-stone-stair-treads-and-landings');
  boxes(s, g, m.maroon, nosings, 'packaging-building-stair-nosing-strips', false);
  boxes(s, g, m.black, skirting, 'packaging-building-stair-black-side-skirting');
  bars(s, g, m.panel, rails, 'packaging-building-stair-white-handrails');
  const context = s._group(groups.ceiling); context.name = 'packaging-selected-floor-stairwell-enclosure';
  const wallHeight = p.rise + 2.6, middleY = (2.6 - p.rise) / 2;
  boxes(s, context, m.panel, [
    [[p.minX + .025, middleY, (p.minZ + p.maxZ) / 2], [.05, wallHeight, depth]],
    [[p.maxX - .025, middleY, (p.minZ + p.maxZ) / 2], [.05, wallHeight, depth]],
    [[cx, -p.rise / 2, p.minZ + .025], [width, p.rise, .05]],
  ], 'packaging-stairwell-white-side-and-lower-back-panels');
  const glazing = [], frames = [];
  for (let bay = 0; bay < 3; bay++) {
    const bayWidth = (width - .2) / 3, x = p.minX + .1 + (bay + .5) * bayWidth;
    for (let row = 0; row < 3; row++) {
      const windowHeight = wallHeight / 3, y = -p.rise + (row + .5) * windowHeight;
      glazing.push([[x, y, p.maxZ - .025], [bayWidth - .06, windowHeight - .12, .025]]);
      frames.push([[x - bayWidth / 2, y, p.maxZ - .012], [.055, windowHeight, .06]], [[x, y - windowHeight / 2, p.maxZ - .012], [bayWidth, .055, .06]]);
    }
  }
  boxes(s, context, m.glass, glazing, 'packaging-stairwell-large-clear-window-panes', false);
  boxes(s, context, m.panel, frames, 'packaging-stairwell-white-window-mullions');
}

function rearBuildingStair(s, groups, data, level, m) {
  const profile = PACKAGING_STAIR_PROFILES[level] || PACKAGING_STAIR_PROFILES[3], g = s._group(groups.structure);
  g.name = `packaging-building-${data.id}`;
  const w = data.maxX - data.minX, d = data.maxZ - data.minZ, cx = (data.minX + data.maxX) / 2;
  if (level === 1) {
    stairOwnership(g, profile, 1);
    boxes(s, g, m.stone, [[[cx, -.16, (data.minZ + data.maxZ) / 2], [w, .12, d]], [[data.maxX - .35, -.06, (data.minZ + data.maxZ) / 2], [.7, .12, d]]], 'packaging-ground-rear-entry-single-threshold');
    return;
  }
  const count = level === 2 ? 16 : 17, flightRise = profile.rise / 2, run = d - 1.3, laneWidth = 1.15;
  const treads = [], faces = [], strips = [], slabs = [], landings = [], rails = [];
  stairOwnership(g, profile, count * 2); g.userData.flightCount = 2;
  for (let flight = 0; flight < 2; flight++) {
    const sign = flight ? 1 : -1, x = flight ? data.maxX - .82 : data.minX + .82;
    const startZ = flight ? data.minZ + .65 : data.maxZ - .65, endZ = startZ + sign * run, base = -profile.rise + flight * flightRise;
    for (let step = 0; step < count; step++) {
      const edge = startZ + sign * step * run / count, y = base + (step + 1) * flightRise / count;
      treads.push([[x, y - .0375, edge + sign * run / count / 2], [laneWidth, .075, run / count + .015]]);
      faces.push([[x, y - flightRise / count / 2, edge], [laneWidth, flightRise / count, .02]]);
      strips.push([[x, y + .006, edge + sign * .02], [laneWidth, .012, .035]]);
    }
    slabs.push([[x, base + flightRise / 2 - .14, (startZ + endZ) / 2], [laneWidth, .14, Math.hypot(run, flightRise)], [-sign * Math.atan2(flightRise, run), 0, 0]]);
    for (const side of [-1, 1]) {
      const edgeX = x + side * laneWidth / 2;
      for (const h of [.5, 1.02]) rails.push([[edgeX, base + h, startZ], [edgeX, base + flightRise + h, endZ], .028]);
      for (const t of [0, .5, 1]) rails.push([[edgeX, base + flightRise * t, startZ + (endZ - startZ) * t], [edgeX, base + flightRise * t + 1.02, startZ + (endZ - startZ) * t], .025]);
    }
  }
  for (let i = 0; i <= 2; i++) landings.push([[cx, -profile.rise + i * flightRise - .09, i === 1 ? data.minZ + .325 : data.maxZ - .325], [w, .18, .65]]);
  boxes(s, g, m.stone, treads.concat(faces, slabs, landings), 'packaging-rear-stone-stair-treads-and-landings');
  boxes(s, g, m.black, strips, 'packaging-rear-stair-black-nosings', false);
  bars(s, g, m.panel, rails, 'packaging-rear-stair-white-handrails');
}

function buildingStairsAndLift(s, groups, room, m) {
  const layout = room.layout, level = room.floorLevel || 3;
  for (const data of layout.stairs || []) {
    if (data.id === 'front-stair') entryBuildingStair(s, groups, data, level, m);
    else rearBuildingStair(s, groups, data, level, m);
  }
  const lift = layout.lift;
  if (!lift) return;
  const g = s._group(groups.structure), w = lift.maxX - lift.minX, d = lift.maxZ - lift.minZ, x = (lift.minX + lift.maxX) / 2, z = (lift.minZ + lift.maxZ) / 2;
  g.name = 'packaging-three-ton-cargo-lift'; g.userData.capacity = lift.capacity || '3TON';
  s._box(groups.deck, [w, .2, d], [x, -.12, z], m.concrete);
  boxes(s, g, m.panel, [[[lift.minX + .08, 1.4, z], [.16, 2.8, d]], [[lift.maxX - .08, 1.4, z], [.16, 2.8, d]], [[x, 1.4, lift.maxZ - .08], [w, 2.8, .16]]], 'packaging-cargo-lift-cutaway-shaft');
  boxes(s, g, m.steel, [-1, 1].map((side) => [[x + side * .58, 1.17, lift.minZ + .06], [1.12, 2.34, .08]]), 'packaging-cargo-lift-stainless-double-doors');
}

function racks(s, parent, layout, level, m) {
  const values = layout.racks || (level === 3 ? [
    { x: -14.35, z: 1, width: 1.05, depth: 7, height: 4.1, levels: 4 },
    { x: -10.5, z: 11.8, width: 6.4, depth: 1.2, height: 4.1, levels: 4 },
  ] : []);
  const uprights = [], beams = [], braces = [], shelves = [];
  for (const rack of values) {
    const g = s._group(parent, [rack.x, 0, rack.z]); g.rotation.y = rack.rotation || 0; g.name = 'packaging-blue-orange-heavy-duty-rack';
    const w = rack.width || 3.2, d = rack.depth || 1.1, h = rack.height || 4, bays = Math.max(1, Math.round(Math.max(w, d) / 2.7)), alongX = w >= d;
    uprights.length = beams.length = braces.length = shelves.length = 0;
    for (let i = 0; i <= bays; i++) {
      const along = (i / bays - .5) * (alongX ? w : d);
      for (const side of [-1, 1]) {
        const x = alongX ? along : side * w / 2, z = alongX ? side * d / 2 : along;
        uprights.push([[x, h / 2, z], [.085, h, .085]], [[x, .035, z], [.2, .07, .2]]);
      }
      for (let y = .3; y < h - .4; y += .9) braces.push(alongX ? [[along, y, -d / 2], [along, y + .8, d / 2], .014] : [[-w / 2, y, along], [w / 2, y + .8, along], .014]);
    }
    for (let levelIndex = 0; levelIndex < (rack.levels || 4); levelIndex++) {
      const y = .28 + levelIndex * (h - .45) / Math.max(1, (rack.levels || 4) - 1);
      for (const side of [-1, 1]) beams.push(alongX ? [[0, y, side * d / 2], [w, .13, .07]] : [[side * w / 2, y, 0], [.07, .13, d]]);
      shelves.push([[0, y + .06, 0], [w, .025, d]]);
    }
    boxes(s, g, m.blue, uprights, 'packaging-rack-blue-posts');
    boxes(s, g, m.orange, beams, 'packaging-rack-orange-horizontal-beams');
    bars(s, g, m.frame, braces, 'packaging-rack-side-cross-bracing');
    boxes(s, g, m.frame, shelves, 'packaging-rack-shelves');
  }
}

function wallAirConditioner(s, parent, x, z, m) {
  const g = s._group(parent, [x, 0, z]); g.rotation.y = PI / 2; g.name = 'packaging-wall-air-unit-four-round-nozzles';
  boxes(s, g, m.panel, [[[0, .95, -.1], [1.3, 1.9, .8]], [[0, 3.03, -.2], [.7, 2.26, .5]], [[0, 4.38, -.12], [2.7, .66, .65]]], 'packaging-air-unit-cabinet-riser-plenum');
  boxes(s, g, m.frame, [[[0, .95, .31], [.015, 1.65, .015]], [[.35, .95, .34], [.045, .2, .04]]], 'packaging-air-unit-service-door-seam-and-handle');
  const vents = [];
  for (let i = 0; i < 9; i++) vents.push([[.3, .25 + i * .045, .32], [.38, .018, .025]]);
  boxes(s, g, m.frame, vents, 'packaging-air-unit-cabinet-lower-vent-slots');
  const nozzles = [-.98, -.33, .33, .98].map((px) => ({ position: [px, 4.38, .32], rotation: [PI / 2, 0, 0] }));
  const shell = new THREE.SphereGeometry(.24, 16, 10, 0, PI * 2, .55, PI - .55); shell.rotateX(PI / 2);
  instances(s, g, shell, m.panel, nozzles.map((v) => ({ position: v.position })), 'packaging-air-unit-four-white-round-nozzle-shells');
  instances(s, g, new THREE.CylinderGeometry(.15, .15, .02, 16), m.black, nozzles.map((v) => ({ ...v, position: [v.position[0], v.position[1], .51] })), 'packaging-air-unit-four-open-nozzle-mouths');
  bars(s, g, m.red, [[[.79, .08, -.22], [.79, 1.7, -.22], .038], [[.79, 1.7, -.22], [1, 1.7, -.22], .038]], 'packaging-air-unit-pink-service-pipe');
  boxes(s,g,m.frame,[[[0,2.4,-.5],[.5,.08,.1]],[[0,3.5,-.5],[.5,.08,.1]]],'packaging-air-unit-wall-standoff-brackets');
}

function services(s, groups, room, bounds, m) {
  const layout = room.layout, level = room.floorLevel || 3;
  const routes = layout.ductRoutes || (level === 3 ? [
    { radius: .15, points: [[-14.55, 5.15, 12.6], [-14.55, 5.15, -10.65], [13.15, 5.15, -10.65]] },
    { radius: .22, dark: true, points: [[-13.95, 5.55, 8], [-13.95, 5.55, -10.1], [12.4, 5.55, -10.1]] },
  ] : level === 2 ? [
    { radius: .13, points: [[-14.4, 4.7, 6], [-14.4, 4.7, -12], [-8.7, 4.7, -12]] },
    { radius: .16, dark: true, points: [[-13.6, 4.78, 6], [-13.6, 4.78, -11], [-6.7, 4.78, -13], [10.8, 4.78, -13]] },
  ] : [
    { radius: .14, points: [[-14.95, 4.7, 5.8], [-14.95, 4.7, -14.15], [-11.6, 4.7, -14.15]] },
  ]);
  const silver = [], dark = [], bands = [], hangers = [];
  for (const route of routes) {
    const points = route.points || [];
    for (let i = 0; i < points.length - 1; i++) {
      const a = points[i], b = points[i + 1], radius = route.radius || .15;
      (route.dark ? dark : silver).push([a, b, radius]);
      const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start), length = delta.length(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), delta.clone().normalize());
      for (let d = .35; d < length; d += .65) bands.push({ position: start.clone().addScaledVector(delta, d / length).toArray(), quaternion: q.toArray(), scale: [radius + .007, radius + .007, .014] });
      for (let d = 1; d < length; d += 3.5) {
        const p = start.clone().addScaledVector(delta, d / length).toArray(), y = level === 3 ? roofHeightAt(layout, bounds, p[2]) - .35 : (layout.ceilingHeight ?? 6.15) - .9;
        if (y > p[1]) hangers.push([[p[0], p[1] + radius, p[2]], [p[0], y, p[2]], .012]);
      }
    }
  }
  if (level === 3) {
    const mainDeck = layout.mainPlatform?.height ?? 2.55;
    const connections = layout.mixerDuctConnections || [-7.5, -2.9, 1.6, 5.5].map((machineZ, index) => {
      const z = machineZ - .35;
      return { x: -11.82, y: hoodConnectionHeight(layout, bounds, mainDeck, z, index === 2, index === 3), z, headerX: -14.55, headerY: 5.15, riseX: -12.75 };
    });
    connections.forEach((connection, index) => {
      const { x, y, z, headerX = -14.55, headerY = 5.15, riseX = -12.75 } = connection;
      bentDuct(s, groups.ducts, m.silver, [[headerX, headerY, z], [riseX, headerY, z], [riseX, y, z], [x, y, z]], .115, `packaging-raised-main-hood-extraction-branch-${index + 1}`);
    });
    groups.ducts.userData.hoodBranchConnections = connections.map((connection) => ({ ...connection }));
    for (const z of [-7.5, -2.9, 1.6, 5.5]) {
      // A second physical port has not been identified. Keep this warm-air
      // spur outside the PVC enclosure instead of inventing a crossing pipe.
      dark.push([[-13.95, 5.55, z + .3], [-12.65, 5.55, z + .3], .14]);
    }
    const stickDeck = layout.auxPlatform?.height ?? 2.4;
    silver.push([[13.15, 5.15, -10.65], [13.15, 5.15, -3.95], .12]);
    for (const machineZ of [-7.5, -3.6]) {
      const z = machineZ - .35, y = hoodConnectionHeight(layout, bounds, stickDeck, z, true);
      bentDuct(s, groups.ducts, m.silver, [[13.15, 5.15, z], [9.65, 5.15, z], [9.65, y, z], [8.87, y, z]], .115, `packaging-raised-stick-hood-extraction-branch-${machineZ}`);
    }
    for (const z of [-6.5, 3.8]) wallAirConditioner(s, groups.structure, bounds.minX + .64, z, m);
  } else if (level === 2 && !layout.ductRoutes) {
    for (const z of [-8, -3.8, .4, 4.6]) {
      silver.push([[-14.4, 4.7, z], [-10.3, 4.7, z], .1]);
      dark.push([[-13.6, 4.78, z + .3], [-10.3, 4.78, z + .3], .12]);
    }
  } else if (level === 1 && !layout.ductRoutes) {
    for (const z of [-7.7, -4.8, -1.7, 5.3]) silver.push([[-14.95, 4.7, z], [-11.6, 4.7, z], .11]);
  }
  bars(s, groups.ducts, m.silver, silver, 'packaging-silver-round-extraction-duct-routes');
  bars(s, groups.ducts, m.darkDuct, dark, 'packaging-dark-parallel-warm-air-duct-routes');
  instances(s, groups.ducts, new THREE.TorusGeometry(1, .025, 4, 16), m.frame, bands, 'packaging-spiral-duct-joint-bands');
  bars(s, groups.ducts, m.frame, hangers, 'packaging-duct-hanger-rods');
}

function smallFixtures(s, groups, room, bounds, m) {
  if ((room.floorLevel || 3) !== 3) return;
  const fixed = s._group(groups.structure); fixed.name = 'packaging-fixed-room-fixtures';
  const booth = s._group(fixed, [-13.2, 0, 11.6]); booth.name = 'packaging-cream-entry-sliding-door-booth';
  boxes(s, booth, m.cream, [[[0, 1.35, -.65], [1.6, 2.7, .08]], [[-.76, 1.35, 0], [.08, 2.7, 1.3]], [[.76, 1.35, 0], [.08, 2.7, 1.3]], [[0, 2.71, 0], [1.6, .08, 1.3]], [[-.35, 1.2, .65], [.8, 2.4, .06]]], 'packaging-entry-booth-cream-panels');
  s._box(booth, [.42, .4, .025], [-.35, 1.65, .69], m.glass);
  s._box(booth, [1.7, .06, .08], [0, 2.48, .72], m.frame);
  const cabinet = s._group(fixed, [-14.5, 0, 8.9]); cabinet.name = 'packaging-entry-cream-double-cabinet';
  boxes(s, cabinet, m.cream, [[[0, 1.05, 0], [1.45, 2.1, .65]]], 'packaging-entry-double-cabinet-body');
  boxes(s, cabinet, m.frame, [[[0, 1.05, .33], [.015, 1.95, .015]], [[-.08, 1, .35], [.035, .21, .035]], [[.08, 1, .35], [.035, .21, .035]]], 'packaging-entry-double-cabinet-door-lines-and-handles');
  s._box(cabinet, [.3, .12, .03], [0, 1.94, .345], m.display); s._box(cabinet, [.2, .045, .02], [0, 1.94, .367], m.led);
  const packageAc = s._group(fixed, [bounds.maxX - .55, 0, -10.3]); packageAc.rotation.y = -PI / 2; packageAc.name = 'packaging-floor-standing-package-air-conditioner';
  boxes(s, packageAc, m.cream, [[[0, 1.32, 0], [1.16, 2.64, .75]]], 'packaging-package-ac-cream-cabinet');
  const acLouvers = [];
  for (let i = 0; i < 9; i++) acLouvers.push([[0, 2.05 + i * .042, .39], [.97, .018, .025]], [[0, .23 + i * .045, .39], [.97, .018, .025]]);
  boxes(s, packageAc, m.frame, acLouvers, 'packaging-package-ac-upper-and-lower-louver-slots');
  s._box(packageAc, [.25, .16, .025], [.29, 1.48, .39], m.display);
  const reel = s._group(fixed, [bounds.maxX - .3, 1.35, -.85]); reel.rotation.y = -PI / 2; reel.name = 'packaging-wall-hose-reel';
  instances(s, reel, new THREE.TorusGeometry(.23, .055, 5, 20), m.black, [0, .04, .08].map((z) => ({ position: [0, 0, z] })), 'packaging-wall-hose-reel-coiled-hose');
  s._cyl(reel, .29, .025, [0, 0, -.04], m.steel, .29, 20).rotation.x = PI / 2;
  bars(s, reel, m.black, [[[.17, -.1, .08], [.25, -.9, .1]], [[.25, -.9, .1], [.08, -1.02, .1]]], 'packaging-wall-hose-reel-hanging-hose', .022);
  for (const exit of (room.layout.doors || []).filter((d) => /entry|stair/.test(d.id))) {
    let rotation=exit.rotation||0,nx=Math.sin(rotation),nz=Math.cos(rotation);
    if(nx*((bounds.minX+bounds.maxX)/2-exit.x)+nz*((bounds.minZ+bounds.maxZ)/2-exit.z)<0){rotation+=PI;nx=-nx;nz=-nz;}
    const perimeter=['minX','maxX'].some(side=>Math.abs(exit.x-bounds[side])<.2)||['minZ','maxZ'].some(side=>Math.abs(exit.z-bounds[side])<.2);
    const wallOffset=perimeter ? .04 : 0,halfWall=perimeter ? .05 : .04,mountDistance=wallOffset+halfWall+.04;
    const sign = s._group(fixed, [exit.x+nx*mountDistance, (exit.height||2.25)+.3, exit.z+nz*mountDistance]); sign.rotation.y=rotation;
    sign.name=`packaging-wall-mounted-exit-sign-${exit.id}`;
    Object.assign(sign.userData,{wallMounted:true,doorId:exit.id,mountNormal:[nx,0,nz],wallFace:[exit.x+nx*(wallOffset+halfWall),exit.z+nz*(wallOffset+halfWall)],mountGap:.01});
    boxes(s,sign,m.frame,[[[-.18,0,-.035],[.1,.07,.01]],[[.18,0,-.035],[.1,.07,.01]]],'packaging-exit-sign-wall-mount-plates');
    s._box(sign, [.56, .22, .06], [0, 0, 0], m.green).name = 'packaging-emergency-exit-green-sign';
    boxes(s, sign, m.panel, [[[-.12, 0, .04], [.035, .13, .012]], [[.07, 0, .04], [.18, .035, .012]], [[.15, .037, .04], [.075, .025, .012], [0, 0, -PI / 4]], [[.15, -.037, .04], [.075, .025, .012], [0, 0, PI / 4]]], 'packaging-emergency-exit-arrow');
  }
  // Keep traps on solid wall above the glazing, beside the doorway heads.
  for (const [index,[x, z]] of [[bounds.minX + .19, -12.3], [-2.65, bounds.maxZ - .18], [5.7, bounds.maxZ - .18]].entries()) {
    const west=x<bounds.minX+.3,mountDepth=west ? .035 : .025;
    const g = s._group(fixed, [x, 2.8, z]); g.rotation.y = west ? PI / 2 : PI;
    g.name=`packaging-wall-mounted-insect-trap-${index+1}`;
    Object.assign(g.userData,{wallMounted:true,mountGap:mountDepth,mountNormal:west?[1,0,0]:[0,0,-1]});
    boxes(s,g,m.frame,[[[-.17,0,-.065-mountDepth/2],[.07,.13,mountDepth]],[[.17,0,-.065-mountDepth/2],[.07,.13,mountDepth]]],'packaging-insect-trap-wall-mounting-plates');
    boxes(s, g, m.frame, [[[0, 0, 0], [.55, .3, .13]]], 'packaging-insect-trap-casing');
    boxes(s, g, m.uv, [[[-.03, -.055, .08], [.44, .035, .025]], [[-.03, .055, .08], [.44, .035, .025]]], 'packaging-blue-uv-insect-trap-tubes', false);
  }
  for (const [x, z] of [[-8.9, -2.5], [12.6, -8.7], [-1.5, -11.15]]) {
    const g = s._group(fixed, [x, 2.4, z]);
    s._box(g, [.36, .21, .09], [0, 0, 0], m.cream); s._box(g, [.27, .12, .03], [0, 0, .06], m.display);
    boxes(s, g, m.led, [[[-.07, .018, .08], [.055, .016, .012]], [[.01, .018, .08], [.055, .016, .012]], [[.09, .018, .08], [.055, .016, .012]]], 'packaging-red-digital-temperature-displays', false);
  }
  for (const [x, z] of [[-14.8, 7.3], [13.5, -9.8], [-5.2, 14.7]]) {
    s._cyl(fixed, .11, .53, [x, .4, z], m.red, .11, 12).name = 'packaging-wall-fire-extinguisher';
    bars(s, fixed, m.black, [[[x + .08, .65, z], [x + .16, .31, z], .017]], 'packaging-extinguisher-hose');
  }
  const cctv = s._group(fixed, [-8, 2.7, -12.3]);
  bars(s, cctv, m.frame, [[[0, 0, 0], [0, 0, .25]], [[0, 0, .25], [0, -.1, .35]]], 'packaging-cip-cctv-bracket');
  s._box(cctv, [.18, .14, .3], [0, -.1, .4], m.panel); s._cyl(cctv, .045, .025, [0, -.1, .56], m.black, .045, 12).rotation.x = PI / 2;
  const cip = (room.layout.rooms || []).find((r) => /cip/i.test(r.id) || /CIP/.test(r.name));
  if (cip) {
    const x0 = cip.minX + .18, x1 = cip.maxX - .18, z = cip.maxZ - .19, grate = [];
    s._box(groups.deck, [x1 - x0, .035, .2], [(x0 + x1) / 2, .028, z], m.black).name = 'packaging-cip-recessed-drain-channel';
    for (let x = x0; x < x1; x += .12) grate.push([[x, .05, z], [.025, .016, .21]]);
    boxes(s, groups.deck, m.steel, grate, 'packaging-cip-stainless-trench-grating', false);
  }
}

function cargoAndMarkings(s, groups, room, m) {
  const level = room.floorLevel || 3, lines = room.layout.floorLines || (level === 3 ? [
    [[-5.95, .025, 1.2], [.055, .012, 24]], [[-13.7, .025, 1], [.055, .012, 20]], [[-9.9, .025, 10.2], [8.1, .012, .055]],
  ] : [[[0, .025, 0], [.055, .012, 24]], [[-8, .025, 11.9], [12, .012, .055]]]);
  boxes(s, groups.deck, m.yellow, lines, 'packaging-yellow-fixed-aisle-and-pallet-markings', false);
  const loads = room.layout.cargo || (level === 3 ? [
    { x: -8.6, z: 5, y: room.layout.mainPlatform?.height || 2.55 }, { x: -11, z: 10.4 }, { x: -12.2, z: -1.2 }, { x: 4.2, z: 6.3 }, { x: 7.3, z: 9.8 },
  ] : []);
  for (const [index, load] of loads.entries()) {
    const g = s._group(groups.cargo, [load.x, load.y || 0, load.z]); g.rotation.y = load.rotation || 0; g.name = `packaging-removable-pallet-load-${index + 1}`;
    const slats = [], bags = [];
    for (let i = 0; i < 4; i++) slats.push([[-.48 + i * .32, .16, 0], [.2, .08, 1.05]]);
    for (const x of [-.43, 0, .43]) for (const z of [-.4, .4]) slats.push([[x, .08, z], [.16, .12, .18]]);
    boxes(s, g, index % 2 ? m.green : m.pallet, slats, 'packaging-cargo-plastic-pallet-slats');
    for (let layer = 0; layer < 4; layer++) for (const x of [-.27, .27]) bags.push({ position: [x, .33 + layer * .23, 0], scale: [.32, .14, .48], rotation: [0, layer % 2 ? PI / 2 : 0, 0] });
    instances(s, g, new THREE.SphereGeometry(1, 10, 6), index % 2 ? m.whiteSack : m.sack, bags, 'packaging-cargo-layered-soft-raw-material-sacks');
  }
  groups.cargo.visible = false; groups.cargo.userData.decorativeCargo = true;
}

function airShowers(s, groups, layout, m) {
  for (const room of (layout.rooms || []).filter((entry) => /air-shower/.test(entry.id))) {
    const width = room.maxX - room.minX, depth = room.maxZ - room.minZ;
    if (width < .8 || depth < .8) continue;
    const g = s._group(groups.structure, [(room.minX + room.maxX) / 2, 0, (room.minZ + room.maxZ) / 2]);
    g.name = `packaging-${room.id}-air-shower-interior`;
    const panels = [], slots = [], nozzles = [], mouths = [], grates = [], doorFrames = [];
    const wallX = Math.max(.3, width / 2 - .18), cabinetDepth = Math.max(.5, Math.min(1.6, depth - .6));
    for (const side of [-1, 1]) {
      panels.push([[side * wallX, 1.2, 0], [.15, 2.4, cabinetDepth]]);
      for (let i = 0; i < 12; i++) slots.push([[side * (wallX - .085), .28 + i * .06, 0], [.012, .02, cabinetDepth * .7]]);
      for (const y of [1.15, 1.65, 2.05]) for (const z of [-cabinetDepth * .3, cabinetDepth * .3]) {
        nozzles.push({ position: [side * (wallX - .1), y, z], rotation: [0, 0, PI / 2] });
        mouths.push({ position: [side * (wallX - .15), y, z], rotation: [0, 0, PI / 2] });
      }
    }
    for (const z of [-depth / 2 + .09, depth / 2 - .09]) {
      for (const side of [-1, 1]) doorFrames.push([[side * Math.max(.25, width / 2 - .3), 1.1, z], [.06, 2.2, .08]]);
      doorFrames.push([[0, 2.2, z], [Math.max(.5, width - .54), .06, .08]]);
    }
    for (let z = -depth / 2 + .1; z <= depth / 2 - .1; z += .13) grates.push([[0, .055, z], [Math.max(.3, width - .45), .025, .03]]);
    boxes(s, g, m.steel, panels, 'packaging-air-shower-stainless-filter-cabinets');
    boxes(s, g, m.frame, slots, 'packaging-air-shower-filter-intake-slots');
    boxes(s, g, m.steel, doorFrames, 'packaging-air-shower-stainless-door-frames');
    boxes(s, g, m.steel, grates, 'packaging-air-shower-floor-grating');
    instances(s, g, new THREE.CylinderGeometry(.07, .09, .08, 12), m.steel, nozzles, 'packaging-air-shower-opposed-wall-nozzles');
    instances(s, g, new THREE.CylinderGeometry(.035, .035, .01, 10), m.black, mouths, 'packaging-air-shower-nozzle-open-mouths');
    s._box(g, [.018, .16, .12], [-wallX + .09, 1.48, cabinetDepth * .3], m.display).name = 'packaging-air-shower-door-interlock-panel';
    s._box(groups.ceiling, [width - .1, .06, depth - .1], [(room.minX + room.maxX) / 2, 2.44, (room.minZ + room.maxZ) / 2], m.steel).name = 'packaging-air-shower-upper-filter-plenum';
  }
}

export function buildPackagingEnvironmentV2(s, room) {
  if (!room?.layout) throw new Error('스틱·소포장 층별 공간 데이터가 없습니다.');
  const layout = room.layout, b = room.mainBounds || layout.mainBounds, m = materials(s), groups = {};
  if (!b) throw new Error('스틱·소포장 공간 외곽 치수가 없습니다.');
  for (const key of ['deck', 'structure', 'ducts', 'cargo']) {
    groups[key] = s._group(s.scene); groups[key].name = `packaging-${room.floorLevel || 3}f-${key}`;
  }
  groups.ceiling = s._group(groups.structure); groups.ceiling.name = 'packaging-overhead-context'; groups.ceiling.visible = false;
  s._box(groups.deck, [b.maxX - b.minX, .22, b.maxZ - b.minZ], [(b.minX + b.maxX) / 2, -.14, (b.minZ + b.maxZ) / 2], m.concrete);
  s._box(groups.deck, [b.maxX - b.minX - .12, .045, b.maxZ - b.minZ - .12], [(b.minX + b.maxX) / 2, -.012, (b.minZ + b.maxZ) / 2], m.floor).name = 'packaging-gloss-green-epoxy-floor';
  enclosure(s, groups, room, b, m);
  columnsAndBraces(s, groups, room, b, m);
  roofAndCeiling(s, groups, room, b, m);
  roomsAndDoors(s, groups, room, m);
  buildingStairsAndLift(s, groups, room, m);
  platform(s, groups.structure, layout.mainPlatform, 'packaging-main-platform', true, m);
  platform(s, groups.structure, layout.auxPlatform, 'packaging-aux-platform', false, m);
  racks(s, groups.structure, layout, room.floorLevel || 3, m);
  services(s, groups, room, b, m);
  airShowers(s, groups, layout, m);
  smallFixtures(s, groups, room, b, m);
  cargoAndMarkings(s, groups, room, m);
  transportLines(s, groups, room, m);
  groups.deck.traverse((mesh) => { if (mesh.isMesh) mesh.castShadow = false; });
  return groups;
}
