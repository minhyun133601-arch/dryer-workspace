import * as THREE from '../shared/vendor/three.module.js';

// SC010606 (2011-02-23) supplies the overall size and equipment counts.
// Photographs supply the repaired compressors, insulation and exterior finish.
// The exploded view separates photographed assemblies, never unseen internals.
export const CHILLER_DIMENSIONS = Object.freeze({ width: 4.14, depth: 1.9, height: 2.2 });
const PARTS = [
  ['frame', '기초·지지 프레임', [0, 0, 0], [0, -.48, 0], [-1.95, .2, 1.5]],
  ['coil-bank', '상부 V형 코일 2열·단부판', [0, 0, 0], [0, 1.7, 0], [-1.07, 2.7, 1.56]],
  ['fans', '상부 송풍 팬·팬 모터 8대', [0, 0, 0], [0, 2.1, 0], [-.5, 2.19, .45]],
  ['compressor-1', '히타치 스크루 압축기 1·외장', [-1.12, .88, .28], [-1.55, .12, 1.45], [0, .18, .5]],
  ['compressor-2', '히타치 스크루 압축기 2·외장', [.3, .88, .28], [.45, .12, 1.85], [0, .18, .5]],
  ['receiver', '액 리시버·수직 용기', [1.66, .24, .64], [1.75, .18, .9], [.23, .83, .23]],
  ['insulated-vessel', '수평 보온 증발기·끝판', [0, .91, -.99], [0, .15, -1.75], [1.38, 0, 0]],
  ['insulated-pipes', '굵은 보온 배관', [0, 0, 0], [-.25, .95, -.7], [-.2, 1.45, -.4]],
  ['copper-valves', '노출 동관·밸브', [0, 0, 0], [1.25, .2, -1.2], [.85, .47, -.65]],
  ['controls', '제어 캐비닛·전면 접속함', [0, 0, 0], [1.7, .15, 0], [2.19, 1.2, .75]],
  ['instruments', '압력계·압력 검출부', [0, 0, 0], [-1.65, .8, .6], [-1.97, 1.28, 1.5]],
  ['guards', '외부 안전 격자', [0, 0, 0], [0, .3, 2.4], [1.15, 1.05, 1.66]],
  ['cables', '전선관·노출 케이블', [0, 0, 0], [-.45, -.12, 1.75], [-.9, .36, 1.35]],
];

const PAINT = {
  shell: { color: 0xd1d3c9, roughness: .66, metalness: .25 },
  edge: { color: 0xb3b7af, roughness: .58, metalness: .4 },
  oldCast: { color: 0xa6b5a8, roughness: .6, metalness: .25 },
  newCast: { color: 0x6e9690, roughness: .52, metalness: .3 },
  terminal: { color: 0x717e75, roughness: .59, metalness: .35 },
  steel: { color: 0xa0a7a4, roughness: .4, metalness: .72 },
  dark: { color: 0x303b3b, roughness: .66, metalness: .25 },
  coil: { color: 0x3d4747, roughness: .66, metalness: .42 },
  fin: { color: 0x818b88, roughness: .62, metalness: .58 },
  blackWrap: { color: 0x353b3b, roughness: .95, metalness: .02 },
  wrapSeam: { color: 0x535b58, roughness: .92, metalness: .02 },
  whiteWrap: { color: 0xc6c6b9, roughness: .92, metalness: .02 },
  copper: { color: 0x8d6047, roughness: .59, metalness: .58 },
  brass: { color: 0x8a825c, roughness: .57, metalness: .52 },
  rust: { color: 0x876245, roughness: .96, metalness: .05 },
  rubber: { color: 0x2c3434, roughness: .92, metalness: 0 },
  blue: { color: 0x356e9a, roughness: .65, metalness: .15 },
  dial: { color: 0xe0dfd3, roughness: .78, metalness: .05 },
  label: { color: 0x354046, roughness: .65, metalness: .1 },
};

export function createChillerModel({ detail = true } = {}) {
  const root = new THREE.Group(); root.name = 'chiller-100rt-photographed-assemblies';
  root.userData.envelope = { ...CHILLER_DIMENSIONS };
  root.userData.basis = 'SC010606-SCSA100AS1-and-card087-67-close-photographs';
  root.userData.fanCount = 8; root.userData.compressorCount = 2; root.userData.receiverCount = 2;
  const records = new Map(), pieces = [], geometries = new Map(), materials = new Set();
  let highlighted = null, isolated = null, disposed = false;
  const geometry = (key, make) => { if (!geometries.has(key)) geometries.set(key, make()); return geometries.get(key); };
  for (const [id, name, home, offset, anchor] of PARTS) {
    const group = new THREE.Group(); group.name = `chiller-${id}`; group.position.set(...home);
    group.userData.chillerPart = group.userData.partId = id; root.add(group);
    const record = { id, name, group, home: new THREE.Vector3(...home), offset: new THREE.Vector3(...offset), anchor: new THREE.Vector3(...anchor), meshes: [], materials: new Map() };
    record.pieces = [record]; records.set(id, record); pieces.push(record);
  }
  const material = (record, key) => {
    if (!record.materials.has(key)) {
      const mat = new THREE.MeshStandardMaterial(PAINT[key]);
      mat.userData.base = { opacity: mat.opacity, transparent: mat.transparent, depthWrite: mat.depthWrite, emissive: mat.emissive.getHex(), emissiveIntensity: mat.emissiveIntensity };
      record.materials.set(key, mat); materials.add(mat);
    }
    return record.materials.get(key);
  };
  const add = (record, geo, paint, position = [0, 0, 0], parent = record.group) => {
    const mesh = new THREE.Mesh(geo, material(record, paint)); mesh.position.set(...position);
    mesh.userData.chillerPart = mesh.userData.partId = record.id;
    parent.add(mesh); record.meshes.push(mesh); return mesh;
  };
  const box = (r, size, pos, paint = 'shell', parent) => add(r, geometry(`b:${size}`, () => new THREE.BoxGeometry(...size)), paint, pos, parent);
  const cylinder = (r, radius, length, pos, paint = 'steel', axis = 'y', bottom = radius, segments = detail ? 32 : 20, parent) => {
    const mesh = add(r, geometry(`c:${radius}:${bottom}:${length}:${segments}`, () => new THREE.CylinderGeometry(radius, bottom, length, segments)), paint, pos, parent);
    if (axis === 'z') mesh.rotation.x = Math.PI / 2;
    if (axis === 'x') mesh.rotation.z = -Math.PI / 2;
    return mesh;
  };
  const torus = (r, radius, tube, pos, paint = 'steel', axis = 'z', parent) => {
    const mesh = add(r, geometry(`t:${radius}:${tube}`, () => new THREE.TorusGeometry(radius, tube, detail ? 6 : 4, detail ? 40 : 20)), paint, pos, parent);
    if (axis === 'y') mesh.rotation.x = Math.PI / 2;
    if (axis === 'x') mesh.rotation.y = Math.PI / 2;
    return mesh;
  };
  const group = (parent, pos = [0, 0, 0]) => { const value = new THREE.Group(); value.position.set(...pos); parent.add(value); return value; };
  const instances = (r, geo, paint, transforms, parent = r.group) => {
    const mesh = new THREE.InstancedMesh(geo, material(r, paint), transforms.length), object = new THREE.Object3D();
    transforms.forEach(({ position, quaternion, scale }, i) => {
      object.position.set(...position); object.quaternion.copy(quaternion || new THREE.Quaternion()); object.scale.set(...(scale || [1, 1, 1])); object.updateMatrix(); mesh.setMatrixAt(i, object.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingBox(); mesh.computeBoundingSphere();
    mesh.userData.chillerPart = mesh.userData.partId = r.id; parent.add(mesh); r.meshes.push(mesh); return mesh;
  };
  const repeatedBoxes = (r, size, paint, positions, parent) => instances(r, geometry(`b:${size}`, () => new THREE.BoxGeometry(...size)), paint, positions.map((position) => ({ position })), parent);
  function flange(r, radius, z, paint, parent, bolts = 10) {
    cylinder(r, radius, .065, [0, 0, z], paint, 'z', radius, undefined, parent);
    const count = detail ? bolts : Math.min(8, bolts);
    const transforms = Array.from({ length: count }, (_, i) => {
      const angle = i / count * Math.PI * 2;
      return { position: [Math.cos(angle) * radius * .82, Math.sin(angle) * radius * .82, z + .043], quaternion: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2) };
    });
    instances(r, geometry('hex-bolt', () => new THREE.CylinderGeometry(.024, .024, .027, 6)), paint, transforms, parent);
  }
  function pipe(r, points, radius, paint, wrap = false) {
    const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
    const key = `pipe:${r.id}:${r.meshes.length}`;
    add(r, geometry(key, () => new THREE.TubeGeometry(curve, Math.max(16, points.length * (detail ? 10 : 5)), radius, detail ? 12 : 8, false)), paint);
    if (wrap) {
      const count = Math.max(3, Math.floor(curve.getLength() / (detail ? .10 : .3))), transforms = [];
      for (let i = 1; i < count; i++) transforms.push({ position: curve.getPointAt(i / count).toArray(), quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), curve.getTangentAt(i / count)) });
      instances(r, geometry(`wrap-ring:${radius}`, () => new THREE.TorusGeometry(radius + .001, .002, 4, detail ? 24 : 12)), paint === 'whiteWrap' ? 'edge' : 'wrapSeam', transforms);
    }
    return curve;
  }

  const frame = records.get('frame');
  for (const z of [-.9, .9]) {
    box(frame, [4.14, .11, .10], [0, .08, z]);
    box(frame, [4.14, .09, .10], [0, .735, z]);
    box(frame, [4.14, .08, .10], [0, 2.13, z]);
  }
  for (const x of [-2.02, -1.1, .65, 2.02]) box(frame, [.10, .11, 1.8], [x, .08, 0]);
  for (const x of [-2.02, 2.02]) for (const z of [-.9, .9]) {
    box(frame, [.10, 2.03, .10], [x, 1.145, z]);
    box(frame, [.16, .025, .16], [x > 0 ? 1.98 : -1.98, .0125, z > 0 ? .86 : -.86], 'edge');
    box(frame, [.092, .022, .092], [x, .147, z], 'rust');
  }
  for (const x of [-2.02, 0, 2.02]) {
    box(frame, [.10, .08, 1.8], [x, 2.13, 0]);
    box(frame, [.10, .09, 1.8], [x, .735, 0]);
  }
  // Only the local worn rail patches visible in the photographs, no procedural
  // corrosion/noise texture that could hide the silhouette.
  for (const [x, z, length] of [[-1.6, .9, .32], [.55, .9, .24], [1.9, -.9, .26], [-1.1, -.9, .21]]) box(frame, [length, .005, .075], [x, .137, z], 'rust');
  frame.anchor.set(-1.9, .14, .9);

  const coils = records.get('coil-bank');
  for (const centre of [-1, 1]) {
    for (const side of [-1, 1]) {
      const a = new THREE.Vector3(centre + side * .08, .79, 0), b = new THREE.Vector3(centre + side * .89, 2.10, 0);
      const panel = group(coils.group, a.clone().add(b).multiplyScalar(.5).toArray());
      panel.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      const length = a.distanceTo(b); box(coils, [.07, length, 1.715], [0, 0, 0], 'coil', panel);
      const fins = []; for (let z = -.84; z <= .841; z += detail ? .024 : .055) fins.push([0, 0, z]);
      repeatedBoxes(coils, [.105, length - .025, detail ? .006 : .008], 'fin', fins, panel);
      for (const end of [-1, 1]) box(coils, [.09, .035, 1.74], [0, end * length / 2, 0], 'edge', panel);
    }
    for (const z of [-.88, .862]) {
      const shape = new THREE.Shape();
      shape.moveTo(centre - .89, 2.10); shape.lineTo(centre + .89, 2.10); shape.lineTo(centre + .08, .79); shape.lineTo(centre - .08, .79); shape.closePath();
      add(coils, geometry(`coil-end:${centre}`, () => new THREE.ExtrudeGeometry(shape, { depth: .018, bevelEnabled: false })), 'shell', [0, 0, z]);
      if (detail) for (const side of [-1, 1]) for (let i = 0; i < 6; i++) {
        const t = (i + .5) / 6;
        cylinder(coils, .007, .009, [centre + side * (.08 + .81 * t), .81 + 1.27 * t, z + .025], 'edge', 'z', .007, 6);
      }
    }
  }
  coils.anchor.set(-1, 1.48, .89);

  const fans = records.get('fans'), fanLocations = [];
  for (const x of [-1.5, -.5, .5, 1.5]) for (const z of [-.45, .45]) {
    fanLocations.push([x, 2.145, z]);
    const ringFrame = group(fans.group, [x, 2.15, z]);
    ringFrame.name = `chiller-roof-fan-${fanLocations.length}`;
    ringFrame.userData.fanIndex = fanLocations.length;
    box(fans, [.94, .035, .86], [0, 0, 0], 'shell', ringFrame);
    cylinder(fans, .365, .006, [0, .021, 0], 'dark', 'y', .365, undefined, ringFrame);
  }
  const vertical = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  for (let radius = .07; radius <= .39; radius += detail ? .032 : .064) {
    instances(fans, geometry(`fan-guard:${radius}`, () => new THREE.TorusGeometry(radius, .003, 4, detail ? 64 : 32)), 'steel', fanLocations.map(([x, , z]) => ({ position: [x, 2.197, z], quaternion: vertical })));
  }
  repeatedBoxes(fans, [.78, .006, .009], 'steel', fanLocations.map(([x, , z]) => [x, 2.197, z]));
  repeatedBoxes(fans, [.009, .006, .78], 'steel', fanLocations.map(([x, , z]) => [x, 2.197, z]));
  instances(fans, geometry('fan-motor', () => new THREE.CylinderGeometry(.057, .057, .10, detail ? 24 : 12)), 'dark', fanLocations.map(([x, , z]) => ({ position: [x, 2.1, z] })));
  fans.group.userData.fanCount = 8;

  function compressor(r, fresh) {
    const paint = fresh ? 'newCast' : 'oldCast';
    r.group.userData.photographedCompressor = true;
    // Separate cast head and long ribbed motor housing; no rotor is invented.
    const profile = [[.22, -.93], [.285, -.87], [.305, -.76], [.305, -.06], [.33, .02], [.33, .4], [.30, .51], [.245, .56]];
    const body = add(r, geometry('compressor-cast-profile', () => new THREE.LatheGeometry(profile.map(([radius, y]) => new THREE.Vector2(radius, y)), detail ? 40 : 24)), paint);
    body.rotation.x = Math.PI / 2;
    cylinder(r, .235, .08, [0, 0, -.91], paint, 'z');
    flange(r, .35, -.015, paint, r.group, 12);
    flange(r, .345, .49, paint, r.group, 10);
    cylinder(r, .235, .27, [0, -.025, .66], paint, 'z');
    flange(r, .255, .79, paint, r.group, 8);
    cylinder(r, .20, .045, [0, -.025, .835], paint, 'z');
    const ribCount = detail ? 14 : 10;
    const ribs = Array.from({ length: ribCount }, (_, i) => {
      const angle = i / ribCount * Math.PI * 2;
      return { position: [Math.cos(angle) * .317, Math.sin(angle) * .317, -.45], quaternion: new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), angle) };
    });
    instances(r, geometry('compressor-long-rib', () => new THREE.BoxGeometry(.033, .026, .78)), paint, ribs);
    for (const z of [-.61, .46]) {
      box(r, [.52, .14, .17], [0, -.37, z], paint);
      for (const x of [-.21, .21]) {
        box(r, [.16, .1, .22], [x, -.48, z], paint);
        box(r, [.18, .035, .23], [x, -.545, z], 'rubber');
        cylinder(r, .018, .065, [x, -.42, z], 'steel', 'y', .018, 6);
      }
    }
    box(r, [.48, .14, .45], [0, .29, .13], paint);
    box(r, [.62, .255, .53], [0, .445, .1], 'terminal');
    box(r, [.64, .025, .55], [0, .585, .1], 'terminal');
    for (const x of [-.26, .26]) for (const z of [-.11, .31]) cylinder(r, .012, .012, [x, .604, z], 'steel', 'y', .012, 6);
    for (const z of [-.7, .48]) {
      box(r, [.13, .08, .1], [-.2, .335, z], paint);
      torus(r, .052, .019, [-.2, .415, z], paint);
    }
    // The dark plate is a visible plate, not fabricated model/serial text.
    box(r, [.23, .13, .018], [0, .09, .535], 'label');
    for (let i = 0; i < 3; i++) box(r, [.18 - i * .025, .007, .002], [0, .12 - i * .03, .546], 'steel');
    cylinder(r, .038, .13, [.17, .3, .61], 'steel');
    cylinder(r, .031, .07, [-.17, .29, .67], 'steel');
    for (const x of [-.28, .28]) {
      cylinder(r, .04, .065, [x, -.12, .44], paint, 'x');
      cylinder(r, .025, .035, [x * 1.08, -.12, .44], 'steel', 'x', .025, 6);
    }
    if (detail) {
      const cable = [[.18, .34, .63], [.28, .13, .7], [.25, -.25, .68], [.03, -.29, .55]];
      pipe(r, cable, .006, 'blue');
      pipe(r, [[-.18, .32, .67], [-.26, .12, .69], [-.21, -.07, .65]], .004, 'steel');
    }
  }
  compressor(records.get('compressor-1'), false); compressor(records.get('compressor-2'), true);
  for (const [id, x] of [['compressor-1', -1], ['compressor-2', .92]]) {
    const record = records.get(id); record.home.set(x, .335, .26); record.group.position.copy(record.home);
    // The attached 50ASC envelope is 874 x 595 x 581 mm. The profile is along
    // local Z; orient it along the long face as in SC010606's front elevation.
    record.group.rotation.y = Math.PI / 2; record.group.scale.set(.85, .581 / 1.1725, .874 / 1.8075);
  }

  const receiver = records.get('receiver');
  cylinder(receiver, .30, 1.22, [0, .78, 0], 'shell');
  const domeGeometry = geometry('receiver-dome', () => new THREE.SphereGeometry(.30, detail ? 32 : 20, detail ? 16 : 10));
  for (const y of [.17, 1.39]) { const dome = add(receiver, domeGeometry, 'shell', [0, y, 0]); dome.scale.y = .37; }
  for (const y of [.18, 1.37]) torus(receiver, .302, .01, [0, y, 0], 'edge', 'y');
  for (const x of [-.2, .2]) box(receiver, [.12, .16, .31], [x, .035, 0], 'shell');
  box(receiver, [.22, .15, .012], [0, .91, .303], 'edge');
  for (const y of [.6, .95]) {
    cylinder(receiver, .042, .15, [-.355, y, .04], 'edge', 'x');
    cylinder(receiver, .067, .055, [-.43, y, .04], 'edge', 'x', .067, 6);
    cylinder(receiver, .022, .12, [-.43, y + .075, .04], 'brass');
    torus(receiver, .045, .007, [-.43, y + .14, .04], 'edge', 'y');
  }
  // SC010606 item 10 specifies two receivers. Only one has a readable current
  // photo nameplate; the second uses the drawing's count and representative form.
  const receiverChildren = [...receiver.group.children], receiverBody = group(receiver.group);
  receiverChildren.forEach((mesh) => receiverBody.add(mesh));
  receiverBody.scale.setScalar(.5); receiverBody.position.set(1.8, .11, -.43);
  receiverBody.name = 'chiller-receiver-drawing-1';
  const secondReceiver = receiverBody.clone(true); secondReceiver.position.x = -1.8; secondReceiver.name = 'chiller-receiver-drawing-2'; receiver.group.add(secondReceiver);
  secondReceiver.traverse((object) => { if (object.isMesh) receiver.meshes.push(object); });
  receiver.home.set(0, 0, 0); receiver.group.position.copy(receiver.home); receiver.anchor.set(1.8, .55, -.27); receiver.group.userData.count = 2;

  const vessel = records.get('insulated-vessel');
  cylinder(vessel, .335, 2.89, [0, 0, 0], 'blackWrap', 'x');
  for (const x of [-1.48, 1.48]) {
    cylinder(vessel, .36, .12, [x, 0, 0], 'whiteWrap', 'x');
    cylinder(vessel, .302, .014, [x + Math.sign(x) * .067, 0, 0], 'blackWrap', 'x');
    for (const z of [-.18, .18]) box(vessel, [.17, .40, .11], [x * .72, -.4, z], 'shell');
  }
  for (let x = -1.32; x < 1.4; x += detail ? .14 : .33) torus(vessel, .337, .003, [x, 0, 0], 'wrapSeam', 'x');
  vessel.home.set(0, .425, -.62); vessel.group.position.copy(vessel.home); vessel.group.scale.set(.64, .7, .7);

  const insulated = records.get('insulated-pipes');
  for (const x of [-1.12, 1]) pipe(insulated, [[x, 1.18, -.2], [x, 1.47, -.36], [x + .12, 1.48, -.74], [x + .12, 1.12, -.99]], .11, 'blackWrap', true);
  pipe(insulated, [[-1.07, .94, -1.24], [-1.55, 1.12, -1.24], [-1.77, 1.46, -.62], [-1.77, 1.49, .35], [-1.48, 1.45, .64]], .09, 'blackWrap', true);
  pipe(insulated, [[-1.5, .48, -.92], [-.8, .48, -.92], [.42, .48, -.92], [1.35, .48, -.92]], .083, 'whiteWrap', true);
  pipe(insulated, [[1.07, .94, -1.24], [1.35, .94, -1.24], [1.65, .9, -.9], [1.65, .5, -.16]], .11, 'whiteWrap', true);

  const copper = records.get('copper-valves');
  for (const [i, x] of [-1.12, 1].entries()) {
    pipe(copper, [[x + .2, 1.11, .49], [x + .42, 1.34, .34], [x + .42, 1.38, -.25], [x + .53, 1.29, -.84], [1.3, 1.29 + i * .12, -.84]], .022, 'copper');
    cylinder(copper, .041, .15, [x + .42, 1.38, -.22], 'brass', 'z');
    cylinder(copper, .034, .09, [x + .42, 1.45, -.22], 'terminal');
    if (detail) pipe(copper, [[x + .42, 1.5, -.22], [x + .54, 1.53, -.25], [x + .68, 1.47, -.34]], .006, 'blue');
  }
  // Photographs 046/066 show this diaphragm-like valve body. Its model and
  // the hidden capillary termination are deliberately not specified.
  cylinder(copper, .085, .04, [.86, .59, -.67], 'edge');
  cylinder(copper, .05, .20, [.86, .46, -.67], 'brass');
  cylinder(copper, .056, .06, [.86, .34, -.67], 'brass', 'y', .043, 6);
  pipe(copper, [[.86, .48, -.67], [1.07, .48, -.67], [1.11, .62, -.75], [1.3, .64, -.84]], .025, 'copper');
  pipe(copper, [[.86, .55, -.67], [.71, .6, -.65], [.64, .74, -.73], [.58, .85, -.88]], .005, 'copper');
  for (const x of [-1.08, 1.08]) {
    const f = group(copper.group, [x, .94, -1.24]); f.rotation.y = Math.PI / 2;
    flange(copper, .16, 0, 'rust', f, 8); cylinder(copper, .085, .21, [0, 0, 0], 'edge', 'z', .085, undefined, f);
  }

  const controls = records.get('controls');
  // This small photographed front junction box is distinct from the large end
  // control cabinet. Compensate for the end-cabinet group's vertical scale so
  // its visible front remains nearly square, as in card 087 and photo 007.
  box(controls, [.9, 1.4, .32], [-1.36, .95, 1.37]).name = 'chiller-front-junction-box';
  box(controls, [.88, 1.34, .025], [-1.36, .95, 1.542]).name = 'chiller-front-junction-door';
  for (const y of [.45, 1.45]) box(controls, [.032, .075, .03], [-1.79, y, 1.56], 'edge');
  box(controls, [.035, .31, .035], [-1.02, .95, 1.575], 'dark').name = 'chiller-front-junction-handle';
  box(controls, [.12, 1.42, 2.96], [2.12, 1.035, 0]);
  for (const z of [-.75, .75]) box(controls, [.025, 1.36, 1.45], [2.197, 1.035, z]);
  for (const z of [-.16, 1.13]) box(controls, [.035, .21, .035], [2.222, .99, z], 'dark');
  box(controls, [.09, .57, .62], [2.16, 1.27, .83]);
  box(controls, [.025, .5, .55], [2.22, 1.27, .83]);
  box(controls, [.024, .17, .035], [2.242, 1.27, .98], 'dark');
  box(controls, [.015, .25, .32], [2.224, 1.33, .25], 'dial');
  box(controls, [.016, .042, .32], [2.225, 1.19, .25], 'blue');
  for (const z of [-1.2, 1.2]) box(controls, [.06, .21, .08], [2.12, .22, z], 'edge');

  const instruments = records.get('instruments');
  // SC010606 items 20/21/22: each of the two circuits has a high-pressure
  // gauge, a low-pressure gauge and a pressure-switch box. The two-box count
  // and the centre-post location come from the drawing, not an assertion that
  // all current field alterations have been photographed.
  for (const [index, x] of [-1.98, 0].entries()) {
    const circuit = index + 1, switchBox = box(instruments, [.19, .52, .16], [x, 1.05, 1.48]);
    switchBox.name = `chiller-pressure-switch-box-${circuit}`;
    Object.assign(switchBox.userData, { role: 'pressure-switch-box', drawingItem: 22, circuit, basis: 'drawing-SC010606' });
    for (const [role, y, drawingItem] of [['low-pressure-gauge', .93, 21], ['high-pressure-gauge', 1.21, 20]]) {
      const gauge = cylinder(instruments, .076, .042, [x, y, 1.576], 'steel', 'z');
      gauge.name = `chiller-${role}-${circuit}`;
      Object.assign(gauge.userData, { role, drawingItem, circuit, basis: 'drawing-SC010606' });
      cylinder(instruments, .062, .007, [x, y, 1.603], 'dial', 'z');
      const needle = box(instruments, [.045, .005, .004], [x + .013, y + .008, 1.608], 'dark'); needle.rotation.z = .6;
      if (detail) for (let i = 0; i < 7; i++) {
        const angle = -.5 + i * .65;
        const mark = box(instruments, [.009, .003, .002], [x + Math.cos(angle) * .049, y + Math.sin(angle) * .049, 1.609], 'dark'); mark.rotation.z = angle;
      }
    }
  }
  Object.assign(instruments.group.userData, { highPressureGaugeCount: 2, lowPressureGaugeCount: 2, pressureSwitchBoxCount: 2, countBasis: 'drawing-SC010606' });

  const guards = records.get('guards');
  for (const z of [-.945, .945]) {
    const horizontal = [], vertical = [];
    for (let y = .82; y <= 2.08; y += detail ? .06 : .10) horizontal.push([0, y, z]);
    for (let x = -1.98; x <= 1.99; x += .44) vertical.push([x, 1.47, z]);
    repeatedBoxes(guards, [3.98, .007, .01], 'shell', horizontal);
    repeatedBoxes(guards, [.007, 1.32, .01], 'shell', vertical);
    for (const y of [.78, 2.13]) box(guards, [4.02, .035, .01], [0, y, z]);
    const lower = []; for (let y = .18; y <= .67; y += detail ? .045 : .075) lower.push([1.02, y, z]);
    repeatedBoxes(guards, [1.9, .007, .01], 'shell', lower);
    for (const x of [.07, 1.02, 1.97]) box(guards, [.01, .54, .01], [x, .42, z]);
    for (const y of [.15, .71]) box(guards, [1.93, .025, .01], [1.02, y, z]);
  }
  guards.anchor.set(1.05, .45, .95);

  const cables = records.get('cables');
  for (const [i, x] of [-1.12, 1].entries()) {
    pipe(cables, [[x, 1.43, .33], [x - .34, 1.38, .58], [x - .49, .82, .84], [x - .46, .38, .96], [-1.03, .36 + i * .05, 1.23]], .038, i ? 'rubber' : 'edge', true);
  }
  for (let i = 0; i < 3; i++) pipe(cables, [[-1.01 + i * .07, .4, 1.36], [-.99 + i * .07, .28, 1.27], [1.94, .28, 1.27 - i * .06], [2.04, .45, 1.1 - i * .06]], .017, 'rubber');
  // Unmeasured exposed routes are kept within the drawing's service compartment.
  // Their topology/connection identities remain photographic approximations.
  for (const record of [insulated, copper, instruments, cables]) record.group.scale.set(.92, .45, .50);
  controls.group.scale.set(.918, .4, .567);

  function applyLook() {
    for (const record of records.values()) {
      record.group.visible = isolated === null || isolated === record.id;
      const selected = highlighted === record.id, dimmed = highlighted !== null && !selected;
      for (const mat of record.materials.values()) {
        const base = mat.userData.base, transparent = base.transparent || dimmed;
        if (mat.transparent !== transparent) { mat.transparent = transparent; mat.needsUpdate = true; }
        mat.opacity = dimmed ? .19 : base.opacity; mat.depthWrite = dimmed ? false : base.depthWrite;
        mat.emissive.setHex(selected ? 0x91602e : base.emissive); mat.emissiveIntensity = selected ? .24 : base.emissiveIntensity;
      }
    }
  }
  function setExplode(amount) {
    if (!Number.isFinite(amount) || disposed) return;
    const value = THREE.MathUtils.clamp(amount, 0, 1);
    for (const record of pieces) record.group.position.copy(record.home).addScaledVector(record.offset, value);
    root.updateWorldMatrix(true, true);
  }
  function setHighlight(id) { highlighted = records.has(id) ? id : null; applyLook(); }
  function setIsolation(id) { isolated = records.has(id) ? id : null; applyLook(); }
  function pick(raycaster) {
    if (disposed || !root.visible) return null;
    root.updateWorldMatrix(true, true);
    const visible = pieces.filter(({ group }) => group.visible).flatMap(({ meshes }) => meshes);
    return raycaster.intersectObjects(visible, false)[0]?.object.userData.chillerPart ?? null;
  }
  function anchorOf(id, into = new THREE.Vector3()) {
    const record = records.get(id); if (!record) return null;
    root.updateWorldMatrix(true, true); return into.copy(record.anchor).applyMatrix4(record.group.matrixWorld);
  }
  function dispose() {
    if (disposed) return; disposed = true;
    for (const record of pieces) for (const mesh of record.meshes) if (mesh.isInstancedMesh) mesh.dispose();
    for (const geo of geometries.values()) geo.dispose();
    for (const mat of materials) mat.dispose();
    root.removeFromParent(); root.clear();
  }
  setExplode(0);
  return { root, records, pieces, setExplode, setHighlight, setIsolation, pick, anchorOf, dispose };
}
