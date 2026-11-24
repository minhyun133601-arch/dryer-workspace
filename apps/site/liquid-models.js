import * as THREE from '../shared/vendor/three.module.js';
import { buildLiquidCardExterior } from './liquid-card-models.js';

// The 2022 plan fixes the building axes. Card photographs fix machine forms;
// item dimensions/positions remain the explicitly qualified data-layer values.
export const LIQUID_MODEL_EXTENT = Object.freeze({ width: 99.7, depth: 39.2 });
const PAINT = {
  steel: { color: 0xc7cbc8, roughness: .31, metalness: .79 },
  hopperSteel: { color: 0xc7cbc8, roughness: .31, metalness: .79, side: THREE.DoubleSide },
  edge: { color: 0x879593, roughness: .4, metalness: .68 },
  white: { color: 0xd4d7cc, roughness: .68, metalness: .17 },
  blue: { color: 0x366c9c, roughness: .49, metalness: .28 },
  brineBlue: { color: 0x4596aa, roughness: .72, metalness: .02 },
  dark: { color: 0x394344, roughness: .65, metalness: .25 },
  black: { color: 0x273030, roughness: .88, metalness: .02 },
  green: { color: 0x347c61, roughness: .73, metalness: .05 },
  orange: { color: 0xc37c35, roughness: .63, metalness: .19 },
  red: { color: 0xa7473c, roughness: .63, metalness: .14 },
  yellow: { color: 0xcab948, roughness: .68, metalness: .12 },
  glass: { color: 0xbaccc8, transparent: true, opacity: .18, roughness: .16, metalness: .04, depthWrite: false },
  screen: { color: 0x244644, roughness: .5, metalness: .08 },
  floor: { color: 0x839178, roughness: .98, metalness: 0 },
  wall: { color: 0xd4d7d0, roughness: .96, metalness: 0 },
};

// Reflected ceiling strips and the muted green floor give round stainless
// shells a readable highlight as the camera moves around the machine.
function processingRoomReflection() {
  const width = 256, height = 128, pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const elevation = ((y + .5) / height - .5) * Math.PI;
    for (let x = 0; x < width; x++) {
      const azimuth = (x + .5) / width * Math.PI * 2;
      const vertical = Math.sin(elevation), horizontal = Math.cos(elevation);
      const floor = Math.max(0, -vertical);
      const walls = .45 + (.20 * Math.cos(azimuth * 4) + .075 * Math.cos(azimuth * 8)) * horizontal;
      const lightStrip = Math.exp(-Math.pow((vertical - .62) / .07, 2));
      const ceiling = .19 * Math.max(0, vertical) + .5 * lightStrip * (.74 + .26 * Math.cos(azimuth * 2));
      const brightness = walls + ceiling - .16 * floor;
      const offset = (y * width + x) * 4;
      pixels[offset] = Math.round(255 * Math.min(1, brightness - .035 * floor));
      pixels[offset + 1] = Math.round(255 * Math.min(1, brightness + .027 * floor));
      pixels[offset + 2] = Math.round(255 * Math.min(1, brightness - .025 * floor));
      pixels[offset + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(pixels, width, height);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function createLiquidModel({ equipment = [], rooms = [], detail = true, columns = [], walls = [], routes = [] } = {}) {
  const root = new THREE.Group(); root.name = 'liquid-factory-card-models';
  const environment = { root: new THREE.Group(), deck: new THREE.Group(), structure: new THREE.Group(), routes: new THREE.Group(), roomFloors: new Map() };
  environment.root.name = 'liquid-plan-environment'; root.add(environment.root); environment.root.add(environment.deck, environment.structure, environment.routes);
  const objects = new Map(), records = new Map(), geometryCache = new Map(), geometries = new Set(), materials = new Set();
  let highlighted = null, isolated = null, selectedRoom = null, structureVisible = true, disposed = false;
  let metalReflection;
  const geo = (key, create) => { if (!geometryCache.has(key)) { const value = create(); geometryCache.set(key, value); geometries.add(value); } return geometryCache.get(key); };
  const palette = () => new Map();
  const mat = (map, name, equipmentMaterial) => {
    if (!map.has(name)) {
      const value = new THREE.MeshStandardMaterial(PAINT[name] || PAINT.steel);
      if (equipmentMaterial && value.metalness > .6) {
        metalReflection ??= processingRoomReflection();
        value.envMap = metalReflection;
        value.envMapIntensity = .85;
      }
      value.name = `liquid-${name}`; value.userData.base = { opacity: value.opacity, transparent: value.transparent, depthWrite: value.depthWrite };
      map.set(name, value); materials.add(value);
    }
    return map.get(name);
  };
  function helpers(parent, paints, id = null) {
    const mesh = (geometry, position, paint = 'steel', into = parent) => {
      const object = new THREE.Mesh(geometry, mat(paints, paint, id)); object.position.set(...position); into.add(object);
      if (id) object.userData.equipment = object.userData.liquidId = id;
      return object;
    };
    const box = (size, position, paint = 'steel', into) => mesh(geo(`box:${size}`, () => new THREE.BoxGeometry(...size)), position, paint, into);
    const cyl = (radius, height, position, paint = 'steel', axis = 'y', bottom = radius, into) => {
      const segments = detail ? Math.max(radius, bottom) < .025 ? 8 : Math.max(radius, bottom) < .075 ? 12 : 28 : 12;
      const value = mesh(geo(`cyl:${radius}:${bottom}:${height}:${segments}`, () => new THREE.CylinderGeometry(radius, bottom, height, segments)), position, paint, into);
      if (axis === 'x') value.rotation.z = -Math.PI / 2;
      if (axis === 'z') value.rotation.x = Math.PI / 2;
      return value;
    };
    const ring = (radius, tube, position, paint = 'steel', axis = 'y', into) => {
      const value = mesh(geo(`ring:${radius}:${tube}:${detail}`, () => new THREE.TorusGeometry(radius, tube, detail ? 6 : 4, detail ? 40 : 24)), position, paint, into);
      if (axis === 'y') value.rotation.x = Math.PI / 2;
      if (axis === 'x') value.rotation.y = Math.PI / 2;
      return value;
    };
    const pipe = (points, radius = .035, paint = 'steel') => mesh(geo(`pipe:${radius}:${paint}:${JSON.stringify(points)}:${detail}`, () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'centripetal'), Math.max(12, points.length * (detail ? 6 : 3)), radius, detail ? 10 : 6, false)), [0, 0, 0], paint);
    const bar = (a, b, radius = .025, paint = 'steel') => {
      const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), value = cyl(radius, start.distanceTo(end), start.clone().add(end).multiplyScalar(.5).toArray(), paint);
      value.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize()); return value;
    };
    const feet = (width, depth, top = .75, paint = 'steel') => {
      for (const x of [-width / 2, width / 2]) for (const z of [-depth / 2, depth / 2]) { cyl(.035, top, [x, top / 2, z], paint); cyl(.075, .035, [x, .018, z], 'edge'); }
    };
    const control = (position, size = [.4, .6, .18], paint = 'steel') => {
      box(size, position, paint); const [x, y, z] = position;
      box([size[0] * .6, size[1] * .24, .015], [x, y + size[1] * .16, z + size[2] / 2 + .012], 'screen');
      for (const [dx, color] of [[-.1, 'green'], [0, 'red'], [.1, 'white']]) cyl(.025, .015, [x + dx * size[0] / .4, y - size[1] * .2, z + size[2] / 2 + .022], color, 'z');
    };
    const motor = (position, paint = 'blue', vertical = true, scale = 1) => {
      const [x, y, z] = position;
      const body = cyl(.14 * scale, .43 * scale, position, paint, vertical ? 'y' : 'x');
      if (vertical) {
        cyl(.16 * scale, .07 * scale, [x, y + .23 * scale, z], paint);
        for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5; const rib = box([.025 * scale, .36 * scale, .025 * scale], [x + Math.cos(a) * .143 * scale, y, z + Math.sin(a) * .143 * scale], paint); rib.rotation.y = -a; }
      } else for (let i = 0; i < 6; i++) ring(.145 * scale, .009 * scale, [x + (i - 2.5) * .06 * scale, y, z], paint, 'x');
      box([.23 * scale, .15 * scale, .23 * scale], [x, y - .27 * scale, z], 'edge');
      return body;
    };
    const belt = (width = 2.5, depth = .5, y = .85, position = [0, 0, 0], rollers = false, surface = rollers ? 'edge' : 'green') => {
      const [x, , z] = position; box([width, .12, depth], [x, y - .08, z]);
      if (rollers) for (let q = -width / 2 + .07; q < width / 2; q += .14) cyl(.045, depth - .04, [x + q, y, z], surface, 'z');
      else box([width - .07, .025, depth - .06], [x, y, z], surface);
      for (const side of [-1, 1]) { box([width, .035, .03], [x, y + .16, z + side * depth / 2]); for (const end of [-1, 1]) box([.03, .2, .035], [x + end * width * .4, y + .08, z + side * depth / 2]); }
      for (const xx of [x - width * .36, x + width * .36]) for (const zz of [z - depth * .4, z + depth * .4]) cyl(.03, y - .12, [xx, (y - .12) / 2, zz]);
    };
    return { mesh, box, cyl, ring, pipe, bar, feet, control, motor, belt };
  }

  // Merge static primitives per equipment/material. Selection remains on the
  // equipment group; no animated machine function is implied by these forms.
  function mergeStatic(source) {
    source.updateMatrixWorld(true); const batches = new Map();
    source.traverse((mesh) => { if (mesh.isMesh) { if (!batches.has(mesh.material)) batches.set(mesh.material, []); batches.get(mesh.material).push(mesh); } });
    const merged = new THREE.Group(), normalMatrix = new THREE.Matrix3(), v = new THREE.Vector3();
    for (const [material, meshes] of batches) {
      const position = [], normal = [], uv = [], index = []; let offset = 0;
      for (const mesh of meshes) {
        const g = mesh.geometry, p = g.attributes.position, n = g.attributes.normal, t = g.attributes.uv;
        normalMatrix.getNormalMatrix(mesh.matrixWorld);
        for (let i = 0; i < p.count; i++) {
          v.fromBufferAttribute(p, i).applyMatrix4(mesh.matrixWorld); position.push(v.x, v.y, v.z);
          if (n) v.fromBufferAttribute(n, i).applyNormalMatrix(normalMatrix); else v.set(0, 1, 0);
          normal.push(v.x, v.y, v.z); uv.push(t?.getX(i) || 0, t?.getY(i) || 0);
        }
        if (g.index) for (const value of g.index.array) index.push(value + offset); else for (let i = 0; i < p.count; i++) index.push(offset + i);
        offset += p.count;
      }
      const geometry = new THREE.BufferGeometry(); geometries.add(geometry);
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3)); geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(index); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, material); mesh.castShadow = !material.transparent; mesh.receiveShadow = true; merged.add(mesh);
    }
    return merged;
  }
  for (const item of equipment) {
    if (!item?.id || objects.has(item.id)) continue;
    const paints = palette(), raw = new THREE.Group(), h = helpers(raw, paints, item.id);
    const refinement = buildLiquidCardExterior({ h, item, geo, detail });
    if (!refinement) { h.box([1, 1, 1], [0, .5, 0]); raw.userData.unsupportedType = item.type; }
    const body = mergeStatic(raw), components = [];
    raw.traverse(mesh => { if (mesh.isMesh && mesh.userData.cardFeature) { mesh.geometry.computeBoundingBox(); const b = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld); components.push({ role: mesh.userData.cardFeature, bounds: { min: b.min.toArray(), max: b.max.toArray() }, material: mesh.material.name }); } });
    const bounds = new THREE.Box3().setFromObject(body), size = bounds.getSize(new THREE.Vector3()), centre = bounds.getCenter(new THREE.Vector3());
    const width = Number(item.width) > 0 ? Number(item.width) : size.x, depth = Number(item.depth) > 0 ? Number(item.depth) : size.z, height = Number(item.height) > 0 ? Number(item.height) : size.y;
    // Data dimensions are qualified placement envelopes, not measured machine
    // dimensions. A uniform fit retains photographed circular sections and
    // whole-machine proportions instead of stretching them into ellipses.
    const fitScale = Math.min(width / Math.max(.01, size.x), height / Math.max(.01, size.y), depth / Math.max(.01, size.z));
    body.scale.setScalar(fitScale);
    body.position.set(-centre.x * body.scale.x, -bounds.min.y * body.scale.y, -centre.z * body.scale.z);
    const group = new THREE.Group(); group.name = item.id; group.position.set(...(item.position || [0, 0, 0])); group.rotation.y = Number(item.rotation) || 0;
    group.userData.equipment = group.userData.equipmentId = group.userData.liquidId = item.id; group.userData.roomId = item.roomId;
    group.userData.cardNumber = item.cardNumber; group.userData.geometryBasis = 'card-exterior; dimensions-and-placement-qualified-in-data';
    group.userData.fitBasis = 'uniform-fit-within-qualified-envelope';
    if (refinement) group.userData.cardRefinement = refinement;
    if (raw.userData.unsupportedType) group.userData.unsupportedType = raw.userData.unsupportedType;
    group.add(body); root.add(group); objects.set(item.id, group);
    group.traverse((object) => { if (object.isMesh) object.userData.equipment = object.userData.liquidId = item.id; });
    records.set(item.id, { id: item.id, name: item.name, item, group, body, materials: paints, anchor: new THREE.Vector3(0, size.y * fitScale * .65, 0), refinement, components, fitScale });
  }

  const envPaint = palette(), eh = helpers(environment.deck, envPaint);
  eh.box([99.7, .08, 39.2], [0, -.04, 0], 'floor');
  const wallKeys = new Set(), registeredWallDoors = [];
  function registeredDoor(wallRoot, opening, length, thickness) {
    const width = opening.max - opening.min, height = opening.height;
    if (width < .12 || height < .25) return;
    const door = new THREE.Group(); door.name = 'liquid-plan-door'; door.position.x = (opening.min + opening.max) / 2 - length / 2; wallRoot.add(door);
    const h = helpers(door, envPaint), frameDepth = Math.max(.16, thickness + .055), wide = width >= 2.5;
    Object.assign(door.userData, { roomId: opening.source?.registeredRoomId ?? wallRoot.userData.roomId, registeredOpening: true,
      geometryBasis: 'historical-registered-opening; neutral-illustrative-door', currentDoorTypeConfirmed: false, measurementsConfirmed: false,
      openingWidth: width, openingHeight: height, openForPassage: false, proximityOperated: true, doorType: wide ? 'illustrative-shutter' : 'illustrative-hinged-door',
      sourceConfidence: opening.source?.confidence || 'registered opening; present door form unconfirmed' });
    for (const side of [-1, 1]) h.box([.065, height + .05, frameDepth], [side * (width / 2 + .0325), (height + .05) / 2, 0], 'edge').name = 'liquid-door-frame-jamb';
    h.box([width + .13, .07, frameDepth], [0, height + .035, 0], 'edge').name = 'liquid-door-frame-head';
    h.box([width, .018, frameDepth + .025], [0, .009, 0], 'edge').name = 'liquid-door-low-threshold';
    if (wide) {
      // The illustrative roller housing and guides bolt to one wall face.
      // Centring the cassette on the opening plane buried it in the lintel.
      const wallFace = thickness / 2, housingDepth = .26, mountingGap = .015;
      const curtainZ = wallFace + mountingGap + housingDepth / 2;
      h.box([width + .16, .28, housingDepth], [0, height + .2, curtainZ], 'white').name = 'liquid-door-raised-roller-header';
      for (const x of [-width / 2 + .13, width / 2 - .13])
        h.box([.1, .24, mountingGap + .008], [x, height + .2, wallFace + mountingGap / 2], 'edge').name = 'liquid-door-header-mounting-plate';
      for (const side of [-1, 1])
        h.box([.06, height, curtainZ + .05 - wallFace], [side * (width / 2 + .03), height / 2, (wallFace + curtainZ + .05) / 2], 'edge').name = 'liquid-door-face-mounted-guide';
      for (let y = height + .09; y <= height + .3; y += .045) h.box([width, .012, .022], [0, y, curtainZ + housingDepth / 2 + .005], 'edge');
      const curtain = new THREE.Group(); curtain.name = 'liquid-door-moving-shutter'; curtain.position.z = curtainZ; door.add(curtain);
      const moving = helpers(curtain, envPaint);
      const strips = Math.max(12, Math.ceil(height / .12)), stripHeight = height / strips;
      for (let i = 0; i < strips; i++) {
        const closed = (i + .5) * stripHeight;
        const strip = moving.box([width - .06, stripHeight + .008, .04], [0, closed, 0], 'white');
        strip.name = 'liquid-door-shutter-curtain';
        strip.userData.proximityDoor = { enterable: width >= .75 && height >= 1.9, groupId: `liquid:${door.uuid}`, label: '액상 작업장 셔터', accessBasis: 'registered wall opening with modelled workroom floor', kind: 'lift', axis: 'y', closed, open: height + .13 + i * .003,
          trigger: [0, 0, 0], width, height };
      }
      door.userData.doorLeafCount = 1; door.userData.shutterRaisedAboveOpening = false;
      return;
    }
    const leafCount = width >= 1.5 ? 2 : 1, leafWidth = width / leafCount - .015;
    for (let index = 0; index < leafCount; index++) {
      const side = index ? 1 : -1, hinge = new THREE.Group(); hinge.name = `liquid-door-open-leaf-${index + 1}`;
      hinge.position.set(side * width / 2, .025, 0); door.add(hinge);
      Object.assign(hinge.userData, { hingeSide: side < 0 ? 'left' : 'right', openAngle: side * Math.PI / 2, illustrativeOpeningDirection: true,
        proximityDoor: { enterable: width >= .75 && height >= 1.9, groupId: `liquid:${door.uuid}`, label: '액상 작업장 출입문', accessBasis: 'registered wall opening with modelled workroom floor', kind: 'hinge', axis: 'y', closed: 0, open: side * Math.PI / 2, trigger: [0, 0, 0], width, height } });
      const leaf = helpers(hinge, envPaint), centre = -side * leafWidth / 2, leafHeight = height - .05;
      leaf.box([leafWidth, leafHeight, .04], [centre, leafHeight / 2, 0], 'white').name = 'liquid-door-neutral-leaf-panel';
      for (const x of [centre - leafWidth / 2 + .015, centre + leafWidth / 2 - .015]) leaf.box([.03, leafHeight, .047], [x, leafHeight / 2, 0], 'edge');
      for (const y of [.025, leafHeight - .025]) leaf.box([leafWidth, .05, .047], [centre, y, 0], 'edge');
      for (const y of [.18, leafHeight / 2, leafHeight - .18]) leaf.cyl(.018, .095, [0, y, .008], 'edge').name = 'liquid-door-hinge';
      const handleX = -side * (leafWidth - .13), handleY = Math.min(1.02, leafHeight * .46);
      for (const face of [-1, 1]) {
        leaf.box([.065, .18, .012], [handleX, handleY, face * .028], 'edge').name = 'liquid-door-handle-plate';
        leaf.cyl(.012, .065, [handleX, handleY, face * .06], 'steel', 'z');
        leaf.cyl(.014, .12, [handleX + side * .045, handleY, face * .09], 'steel', 'x').name = 'liquid-door-lever-handle';
      }
    }
    door.userData.doorLeafCount = leafCount;
  }
  function wall(a, b, height = 4.5, openings = [], roomId = null, thickness = .13) {
    if (!Array.isArray(a) || !Array.isArray(b) || ![...a, ...b].every(Number.isFinite)) return;
    const ax = a[0], az = a[1], bx = b[0], bz = b[1], length = Math.hypot(bx - ax, bz - az); if (length < .05) return;
    const key = [[ax, az], [bx, bz]].map((point) => point.map((v) => v.toFixed(3)).join(',')).sort().join(':');
    if (wallKeys.has(key)) return; wallKeys.add(key);
    const wallRoot = new THREE.Group(); wallRoot.name = 'liquid-plan-wall'; wallRoot.userData.roomId = roomId; wallRoot.position.set((ax + bx) / 2, 0, (az + bz) / 2); wallRoot.rotation.y = -Math.atan2(bz - az, bx - ax); environment.structure.add(wallRoot);
    // A shared edge can be listed first by the room without a door. Collect
    // its other registered side before deduplicating the physical wall.
    const shared = registeredWallDoors.filter(entry => entry.key === key);
    const resolvedOpenings = shared.length ? shared.map(entry => ({ ...entry.door, fraction: undefined,
      offset: ((entry.position[0] - ax) * (bx - ax) + (entry.position[1] - az) * (bz - az)) / length })) : openings;
    const wh = helpers(wallRoot, envPaint), intervals = resolvedOpenings.map((door) => {
      const centre = Number.isFinite(door.fraction) ? length * door.fraction : Number.isFinite(door.offset) ? door.offset : length / 2;
      const width = Math.min(length, Number(door.width) || 1.2); return { min: Math.max(0, centre - width / 2), max: Math.min(length, centre + width / 2), height: Math.min(height, Number(door.height) || 2.2), source: door };
    }).sort((x, y) => x.min - y.min);
    let last = 0;
    for (const opening of [...intervals, { min: length, max: length, height }]) {
      if (opening.min > last) wh.box([opening.min - last, height, thickness], [(opening.min + last) / 2 - length / 2, height / 2, 0], 'wall');
      if (opening.max > opening.min && height > opening.height) wh.box([opening.max - opening.min, height - opening.height, thickness], [(opening.max + opening.min) / 2 - length / 2, (height + opening.height) / 2, 0], 'wall');
      last = Math.max(last, opening.max);
    }
    for (const opening of intervals) registeredDoor(wallRoot, opening, length, thickness);
  }
  function doorsForEdge(room, a, b, index) {
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]), output = [];
    if (length < .01) return output;
    for (const door of room.doors || []) {
      if (Number.isFinite(door.edgeIndex ?? door.edge)) { if ((door.edgeIndex ?? door.edge) === index) output.push(door); continue; }
      let position = door.position && [door.position[0], door.position[2]];
      if (!position && door.side && Number.isFinite(door.offset)) {
        const bounds = room.bounds;
        if (door.side === 'minX' || door.side === 'maxX') position = [bounds[door.side], door.offset];
        else position = [door.offset, bounds[door.side]];
      }
      if (!position?.every(Number.isFinite)) continue;
      const projection = ((position[0] - a[0]) * (b[0] - a[0]) + (position[1] - a[1]) * (b[1] - a[1])) / length;
      const distance = Math.abs((position[0] - a[0]) * (b[1] - a[1]) - (position[1] - a[1]) * (b[0] - a[0])) / length;
      if (distance < .15 && projection >= 0 && projection <= length) output.push({ ...door, offset: projection });
    }
    return output;
  }
  function indexWallDoors(a, b, doors, roomId) {
    if (!Array.isArray(a) || !Array.isArray(b) || ![...a, ...b].every(Number.isFinite)) return;
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]); if (length < .05) return;
    const key = [a, b].map(point => point.map(v => v.toFixed(3)).join(',')).sort().join(':');
    for (const door of doors) {
      const offset = Number.isFinite(door.fraction) ? length * door.fraction : Number.isFinite(door.offset) ? door.offset : length / 2;
      const position = [a[0] + (b[0] - a[0]) * offset / length, a[1] + (b[1] - a[1]) * offset / length];
      if (registeredWallDoors.some(entry => entry.key === key && Math.hypot(entry.position[0] - position[0], entry.position[1] - position[1]) < .001 && entry.door.width === door.width)) continue;
      registeredWallDoors.push({ key, position, door: { ...door, registeredRoomId: roomId } });
    }
  }
  if (walls.length) for (const line of walls) indexWallDoors(line.start || line.a, line.end || line.b, line.doors || [], line.roomId);
  else for (const room of rooms.filter(room => !room.referenceOnly)) {
    const b = room.bounds || {}, outline = room.outline?.length >= 3 ? room.outline : [[b.minX, b.minZ], [b.maxX, b.minZ], [b.maxX, b.maxZ], [b.minX, b.maxZ]];
    if (outline.flat().every(Number.isFinite)) outline.forEach((point, i) => indexWallDoors(point, outline[(i + 1) % outline.length], doorsForEdge(room, point, outline[(i + 1) % outline.length], i), room.id));
  }
  for (const room of rooms) {
    const b = room.bounds || {}, outline = room.outline?.length >= 3 ? room.outline : [[b.minX, b.minZ], [b.maxX, b.minZ], [b.maxX, b.maxZ], [b.minX, b.maxZ]];
    if (!outline.flat().every(Number.isFinite)) continue;
    const roomFloor = new THREE.Group(); roomFloor.name = `liquid-room-${room.id}`; environment.deck.add(roomFloor); environment.roomFloors.set(room.id, roomFloor);
    const shape = new THREE.Shape(); outline.forEach(([x, z], i) => i ? shape.lineTo(x, -z) : shape.moveTo(x, -z)); shape.closePath();
    const geometry = new THREE.ShapeGeometry(shape); geometry.rotateX(-Math.PI / 2); geometries.add(geometry);
    helpers(roomFloor, envPaint).mesh(geometry, [0, .004, 0], 'floor');
    if (room.referenceOnly) {
      roomFloor.userData.referenceOnly = true;
      const points = []; outline.forEach((point, i) => points.push(new THREE.Vector3(point[0], .025, point[1]), new THREE.Vector3(outline[(i + 1) % outline.length][0], .025, outline[(i + 1) % outline.length][1])));
      const lineGeometry = new THREE.BufferGeometry().setFromPoints(points), lineMaterial = new THREE.LineDashedMaterial({ color: 0x92876c, dashSize: .45, gapSize: .3 }); geometries.add(lineGeometry); materials.add(lineMaterial);
      const outlineLine = new THREE.LineSegments(lineGeometry, lineMaterial); outlineLine.name = 'liquid-unconfirmed-reference-area'; outlineLine.computeLineDistances(); roomFloor.add(outlineLine);
    } else if (!walls.length) outline.forEach((point, i) => wall(point, outline[(i + 1) % outline.length], room.height || 4.5, doorsForEdge(room, point, outline[(i + 1) % outline.length], i), room.id));
  }
  for (const line of walls) wall(line.start || line.a, line.end || line.b, line.height || 4.5, line.doors || [], line.roomId, line.thickness || .13);
  const bounds = { minX: -49.85, maxX: 49.85, minZ: -19.6, maxZ: 19.6 };
  if (!walls.length) {
    const points = [[bounds.minX, bounds.minZ], [bounds.maxX, bounds.minZ], [bounds.maxX, bounds.maxZ], [bounds.minX, bounds.maxZ]];
    points.forEach((p, i) => wall(p, points[(i + 1) % 4]));
  }
  for (const column of columns) {
    const position = column.position || [column.x, 0, column.z], height = Number(column.height) || 4.5;
    if (!position.every(Number.isFinite)) continue;
    const width = column.width || .4, depth = column.depth || .4, columnRoot = new THREE.Group();
    columnRoot.position.set(...position); columnRoot.rotation.y = column.rotation || 0; columnRoot.name = 'liquid-plan-column'; environment.structure.add(columnRoot);
    const ch = helpers(columnRoot, envPaint);
    if (column.section === 'I') { for (const z of [-depth * .42, depth * .42]) ch.box([width, height, depth * .16], [0, height / 2, z], 'wall'); ch.box([width * .18, height, depth * .8], [0, height / 2, 0], 'wall'); }
    else ch.box([width, height, depth], [0, height / 2, 0], 'wall');
  }
  function blockedRoutePoint(point, halfWidth) {
    for (const item of equipment) {
      const dx = point[0] - item.position[0], dz = point[2] - item.position[2], a = Number(item.rotation) || 0;
      if (Math.abs(dx * Math.cos(a) - dz * Math.sin(a)) < item.width / 2 + halfWidth + .06 && Math.abs(dx * Math.sin(a) + dz * Math.cos(a)) < item.depth / 2 + halfWidth + .06) return true;
    }
    for (const column of columns) {
      const p = column.position || [column.x, 0, column.z];
      if (Math.abs(point[0] - p[0]) < (column.width || .4) / 2 + halfWidth && Math.abs(point[2] - p[2]) < (column.depth || .4) / 2 + halfWidth) return true;
    }
    return false;
  }
  for (const route of routes) {
    if (!Array.isArray(route.points) || route.points.length < 2) continue;
    const raw = new THREE.Group(), rh = helpers(raw, envPaint), width = Number(route.width) || .55;
    let clipped = 0;
    for (let i = 1; i < route.points.length; i++) {
      const a = new THREE.Vector3(...route.points[i - 1]), b = new THREE.Vector3(...route.points[i]), length = a.distanceTo(b), count = Math.ceil(length / .25);
      for (let j = 0; j < count; j++) {
        const p = a.clone().lerp(b, (j + .5) / count), run = length / count;
        if (route.clipEquipment && blockedRoutePoint(p.toArray(), width / 2)) { clipped++; continue; }
        const angle = -Math.atan2(b.z - a.z, b.x - a.x);
        const bed = rh.box([run + .002, .09, width], [p.x, p.y - .065, p.z]); bed.rotation.y = angle;
        const belt = rh.box([run + .002, .018, width - .06], [p.x, p.y, p.z], 'green'); belt.rotation.y = angle;
        if (j % 12 === 0) for (const side of [-1, 1]) rh.cyl(.027, Math.max(.05, p.y - .11), [p.x + Math.sin(angle) * side * width * .36, (p.y - .11) / 2, p.z + Math.cos(angle) * side * width * .36]);
      }
    }
    const group = mergeStatic(raw); group.name = `liquid-plan-route-${route.id || environment.routes.children.length + 1}`;
    Object.assign(group.userData, { roomId: route.roomId, source: route.source, positionMatch: route.positionMatch, clippedSamples: clipped }); environment.routes.add(group);
  }

  function applyLook() {
    environment.structure.visible = structureVisible && isolated === null;
    environment.routes.visible = isolated === null;
    for (const route of environment.routes.children) route.visible = selectedRoom === null || route.userData.roomId === selectedRoom;
    for (const [id, record] of records) {
      record.group.visible = (selectedRoom === null || record.item.roomId === selectedRoom) && (isolated === null || id === isolated);
      const selected = highlighted === id, dimmed = highlighted !== null && !selected;
      for (const material of record.materials.values()) {
        const base = material.userData.base, transparent = base.transparent || dimmed;
        if (material.transparent !== transparent) { material.transparent = transparent; material.needsUpdate = true; }
        material.opacity = dimmed ? Math.min(.19, base.opacity) : base.opacity; material.depthWrite = dimmed ? false : base.depthWrite;
        material.emissive.setHex(selected ? 0x6d5b33 : 0); material.emissiveIntensity = selected ? .2 : 0;
      }
    }
  }
  const setHighlight = (id) => { highlighted = records.has(id) ? id : null; applyLook(); };
  const setIsolation = (id) => { isolated = records.has(id) ? id : null; applyLook(); };
  const setRoom = (id) => { selectedRoom = rooms.some((room) => room.id === id) ? id : null; applyLook(); };
  const setStructureVisible = (value) => { structureVisible = Boolean(value); applyLook(); };
  function pick(raycaster) {
    if (disposed) return null; root.updateWorldMatrix(true, true);
    const targets = []; for (const group of objects.values()) if (group.visible) group.traverse((object) => { if (object.isMesh) targets.push(object); });
    return raycaster.intersectObjects(targets, false)[0]?.object.userData.equipment ?? null;
  }
  function anchorOf(id, into = new THREE.Vector3()) { const record = records.get(id); if (!record) return null; root.updateWorldMatrix(true, true); return into.copy(record.anchor).applyMatrix4(record.group.matrixWorld); }
  function dispose() { if (disposed) return; disposed = true; geometries.forEach((g) => g.dispose()); materials.forEach((m) => m.dispose()); metalReflection?.dispose(); root.removeFromParent(); root.clear(); }
  root.updateWorldMatrix(true, true); applyLook();
  return { root, environment, objects, records, setHighlight, setIsolation, setRoom, setStructureVisible, pick, anchorOf, dispose };
}
