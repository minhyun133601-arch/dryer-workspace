import * as THREE from '../shared/vendor/three.module.js';

// 2026-11-24 continuous 3F walk & 100-photo survey:
// 3F ELEV -> east fire door -> NE stairwell landing -> perforated roof door ->
// green epoxy outdoor roof (Century units, V-coil condenser, baghouse dust
// collector, GIHO FANTECH blower & exhaust stack) -> air compressor room
// (4 screw compressors, 2 receiver tanks, 4 dryers/aftercooler, oil-water
// separator, Bumyang/Hanbell chiller, stainless water tank & pump).
// All dimensions and local poses are video/photo proportions registered inside
// the A-015 architectural footprint, not field-measured survey coordinates.
export function buildDryerCompressorEnvironment(s, environment, spec) {
  if (Number(spec?.id) !== 3 || !environment?.architectureFixtures) return;
  if (environment.architectureFixtures.getObjectByName('dryer-compressor-3-room')) return;

  const source = 'dryer-3f-compressor-20261124';
  const cache = s.dryerCompressorGeometry ||= new Map();
  const geo = (key, make) => {
    if (!cache.has(key)) { const value = make(); cache.set(key, value); s.geometries?.add(value); }
    return cache.get(key);
  };
  const palette = {
    wall: 0xe3e1d4, roofGreen: 0x3b7658, roomGreen: 0x45755c, tile: 0xc9ccc4, skirting: 0x202928,
    kaeserYellow: 0xe4b822, kaeserDark: 0x2f3638, k2Beige: 0xd8d3bf, steel: 0xbac4c2,
    galv: 0xa8b2b0, trim: 0x8f9996, dark: 0x2a3536, black: 0x1a2022, white: 0xedf0ea,
    blueBright: 0x1e8ec6, bluePipe: 0x2b6cb0, blueFilter: 0x2172b8, tankGray: 0xb9beb9,
    tankLight: 0xd0d4cf, red: 0xb8352b, exitGreen: 0x1d8a4e, orange: 0xd96b27,
    yellowPipe: 0xd19c38, brown: 0x7b5642, chillerCream: 0xd6d3c4, blowerYellow: 0xe6b51e,
  };
  const m = s.dryerCompressorMaterials ||= Object.fromEntries(Object.entries(palette).map(([key, color]) => [
    key, s._material(color, ['steel', 'galv'].includes(key) ? .36 : .76, ['steel', 'galv'].includes(key) ? .55 : .06),
  ]));
  m.frostedGlass ||= s._material(0xdce6e4, .45, .02, { transparent: true, opacity: .62, depthWrite: false, side: THREE.DoubleSide });
  m.clearGlass ||= s._material(0xb8d6d8, .22, .05, { transparent: true, opacity: .34, depthWrite: false, side: THREE.DoubleSide });
  m.violet ||= s._material(0x9b72cf, .4, .05, { emissive: 0x622ea8, emissiveIntensity: .6 });
  m.exitGlow ||= s._material(0x28a45c, .45, 0, { emissive: 0x1e8a4a, emissiveIntensity: .5 });
  m.ledBlue ||= s._material(0x45b4f0, .35, 0, { emissive: 0x1f82c4, emissiveIntensity: .55 });
  m.ledRed ||= s._material(0xd64035, .4, 0, { emissive: 0x9b221a, emissiveIntensity: .45 });
  m.ceilingLamp ||= s._material(0xf5f5e8, .5, 0, { emissive: 0xf0eed6, emissiveIntensity: .7 });

  const unitBox = geo('unit-box', () => new THREE.BoxGeometry(1, 1, 1));
  const unitCyl = geo('unit-cyl', () => new THREE.CylinderGeometry(1, 1, 1, 24));
  const group = (parent, name, pos = [0, 0, 0], extra = {}) => {
    const node = s._group(parent, pos);
    node.name = name;
    Object.assign(node.userData, { currentVideoReference: true, source, architecturalFloor: 3, dimensionsMeasured: false, ...extra });
    return node;
  };
  const box = (parent, name, size, pos, paint = 'steel') => {
    const node = s._mesh(unitBox, m[paint], parent, pos);
    node.scale.set(...size);
    node.name = name;
    return node;
  };
  const cyl = (parent, name, r, h, pos, paint = 'steel', axis = 'y') => {
    const node = s._mesh(unitCyl, m[paint], parent, pos);
    node.scale.set(r, h, r);
    if (axis === 'x') node.rotation.z = Math.PI / 2;
    if (axis === 'z') node.rotation.x = Math.PI / 2;
    node.name = name;
    return node;
  };
  const bar = (parent, name, a, b, r = .022, paint = 'steel') => {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start);
    const len = delta.length(); if (len < 1e-5) return null;
    const node = cyl(parent, name, r, len, start.add(end).multiplyScalar(.5).toArray(), paint);
    node.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    return node;
  };
  const repeats = (parent, name, size, positions, paint = 'steel') => {
    if (!positions.length) return null;
    const mesh = new THREE.InstancedMesh(unitBox, m[paint], positions.length), dummy = new THREE.Object3D();
    positions.forEach((p, i) => { dummy.position.set(...p); dummy.scale.set(...size); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); });
    mesh.name = name; mesh.instanceMatrix.needsUpdate = true; mesh.castShadow = mesh.receiveShadow = true;
    mesh.computeBoundingBox(); mesh.computeBoundingSphere(); parent.add(mesh);
    return mesh;
  };
  const plaque = (parent, name, text, pos, size = [.52, .22], { bg = '#1f2b2e', fg = '#f6f8f5', rotY = 0, capacityLine = '' } = {}) => {
    const root = group(parent, name, pos); root.rotation.y = rotY; root.userData.text = text;
    if (capacityLine) root.userData.capacityLine = capacityLine;
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = capacityLine ? 368 : 192;
      const ctx = canvas.getContext?.('2d');
      if (ctx) {
        ctx.fillStyle = bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#d4dae0'; ctx.lineWidth = capacityLine ? 3 : 8; ctx.strokeRect?.(8, 8, 496, canvas.height - 16);
        ctx.fillStyle = fg;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        if (capacityLine) {
          // The near-frontal 01:21 frame shows the installed capacity above
          // a ruled contact sheet. Only its non-personal headers are rendered.
          ctx.font = '700 32px "Malgun Gothic", sans-serif'; ctx.fillText(text, 256, 55);
          ctx.font = '700 21px "Malgun Gothic", sans-serif'; ctx.fillText(capacityLine, 256, 85);
          ctx.font = '600 16px "Malgun Gothic", sans-serif'; ctx.fillText('긴급연락처', 256, 130);
          ctx.fillStyle = '#a1a5a6';
          for (const y of [111, 150, 185, 226, 267, 308, 347]) ctx.fillRect(10, y, 492, 2);
          for (const x of [50, 202, 354]) ctx.fillRect(x, 150, 2, 197);
          ctx.fillStyle = fg; ctx.font = '600 12px "Malgun Gothic", sans-serif';
          for (const [i, label] of ['소속', '성명', '연락처'].entries()) ctx.fillText(label, 126 + i * 152, 168);
        } else {
          ctx.font = '700 72px "Malgun Gothic", sans-serif'; ctx.fillText(text, 256, 98, 460);
        }
        const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; s.textures?.add(tex);
        const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }); s.materials?.add(mat);
        const face = s._mesh(geo(`plaque:${size[0]}:${size[1]}`, () => new THREE.PlaneGeometry(size[0], size[1])), mat, root, [0, 0, .012]);
        face.castShadow = false; face.name = `${name}-face`;
      }
    } else {
      box(root, `${name}-plate`, [size[0], size[1], .014], [0, 0, .007], 'dark');
    }
    return root;
  };
  const extinguisher = (parent, name, pos) => {
    const root = group(parent, name, pos);
    cyl(root, `${name}-body`, .075, .44, [0, .23, 0], 'red');
    cyl(root, `${name}-neck`, .026, .08, [0, .48, 0], 'dark');
    box(root, `${name}-handle`, [.12, .035, .03], [.04, .52, 0], 'black');
    return root;
  };

  // =========================================================================
  // 1. 3F ELEVATOR PANEL + EAST FIRE DOOR + NE STAIR LANDING (X 8.6..13.4)
  // =========================================================================
  const stairGroup = group(environment.architectureFixtures, 'dryer-compressor-3-stair', [0, 0, 0], {
    positionBasis: 'A-015-northEastBay-and-20261124-walk',
    upperAndLowerStairFlightsDocumentedSeparately: true,
  });

  // 1a. 3F ELEV adjacent stainless button cabinet (00:04-00:08, #003)
  const elevPanel = group(stairGroup, 'third-elevator-button-cabinet', [4.25, 0, -10.12], {
    sourceTimesSeconds: [4, 5, 6], liveValuesAdded: false,
  });
  box(elevPanel, 'elev-panel-shell', [.86, 1.12, .12], [0, 1.48, 0], 'steel');
  box(elevPanel, 'elev-panel-strip', [.56, .11, .015], [0, 1.02, .068], 'blueBright');
  for (let row = 0; row < 4; row++) for (let col = 0; col < 5; col++) {
    const x = -.3 + col * .15, y = 1.84 - row * .18;
    cyl(elevPanel, 'elev-panel-btn', .022, .022, [x, y, .068], row === 2 && col === 1 ? 'ledRed' : 'trim', 'z');
  }
  box(elevPanel, 'elev-panel-jbox', [.16, .2, .1], [.56, 1.56, 0], 'white');

  // 1b. 3F Hall east fire door context at X=8.6, Z=-8.6 (00:10-00:35)
  const hallDoorCtx = group(stairGroup, 'third-ne-hall-door-context', [8.52, 0, -8.6], {
    sourceTimesSeconds: [10, 15, 16, 21, 31, 35],
  });
  box(hallDoorCtx, 'ne-door-exit-sign', [.04, .16, .42], [0, 2.38, 0], 'exitGlow');
  box(hallDoorCtx, 'ne-door-insect-case', [.09, .24, .46], [-.02, 1.82, -.85], 'dark');
  for (const dy of [-.05, .05]) box(hallDoorCtx, 'ne-door-insect-tube', [.02, .02, .38], [-.07, 1.82 + dy, -.85], 'violet');
  box(hallDoorCtx, 'ne-door-ext-sign', [.02, .26, .22], [0, .92, -.85], 'red');
  extinguisher(stairGroup, 'ne-landing-extinguisher', [8.92, 0, -7.85]);

  // 1c. NE stairwell 3F tiled corridor (X=8.6..10.1), hydrant, north window & top steps (04:45-05:00)
  box(stairGroup, 'ne-stair-corridor-tile', [1.55, .012, 6.55], [9.42, .006, -10.05], 'tile');
  box(stairGroup, 'ne-stair-north-landing-tile', [3.2, .012, 1.55], [11.72, .006, -12.55], 'tile');
  box(stairGroup, 'ne-stair-west-skirting', [.025, .14, 6.4], [8.68, .07, -10.05], 'skirting');
  box(stairGroup, 'ne-stair-hydrant-cabinet', [.04, 1.18, .72], [8.69, 1.15, -10.55], 'steel');
  // Tall frosted north window + 3 horizontal stainless safety bars (04:48-04:53)
  const northWin = group(stairGroup, 'ne-stair-north-window', [11.0, 0, -13.34], { sourceTimesSeconds: [288, 290, 292] });
  box(northWin, 'ne-win-glass', [2.76, 3.24, .025], [0, 2.5, 0], 'frostedGlass');
  for (const x of [-1.38, 0, 1.38]) box(northWin, 'ne-win-mullion', [.05, 3.3, .07], [x, 2.5, 0], 'trim');
  for (const y of [.85, 2.1, 4.15]) box(northWin, 'ne-win-rail', [2.8, .05, .07], [0, y, 0], 'trim');
  for (const y of [1.2, 1.58, 1.96]) bar(northWin, 'ne-win-safety-bar', [-1.35, y, .12], [1.35, y, .12], .02, 'steel');
  // Stainless landing balustrade & visible top descending steps (3F -> 1·2F -> 1F; representative 3F top only)
  const railPosts = [[10.22, -11.75], [10.22, -10.1], [10.22, -8.5], [10.22, -6.9], [11.75, -11.75], [13.15, -11.75]];
  for (const [x, z] of railPosts) {
    bar(stairGroup, 'ne-stair-rail-post', [x, 0, z], [x, 1.02, z], .022, 'steel');
    cyl(stairGroup, 'ne-stair-rail-finial', .032, .05, [x, 1.05, z], 'steel');
  }
  for (const y of [.52, .98]) {
    bar(stairGroup, 'ne-stair-west-rail', [10.22, y, -11.75], [10.22, y, -6.9], .022, 'steel');
    bar(stairGroup, 'ne-stair-top-rail', [11.75, y, -11.75], [13.15, y, -11.75], .022, 'steel');
  }
  for (let i = 0; i < 8; i++) {
    const z = -11.55 + i * .3, y = -.18 * (i + 1);
    box(stairGroup, 'ne-stair-desc-tread', [1.38, .06, .31], [11.0, y, z], 'tile');
    box(stairGroup, 'ne-stair-desc-nosing', [1.38, .01, .045], [11.0, y + .035, z - .13], 'black');
  }
  // Exterior orange corner trim on SW corner of NE stairwell projection (#007, 04:37-04:39)
  box(stairGroup, 'ne-stair-exterior-orange-trim', [.14, 5.8, .14], [8.68, 2.9, -6.66], 'orange');

  // =========================================================================
  // 2. OUTDOOR 3F GREEN EPOXY ROOF: CONDENSERS, BAGHOUSE, BLOWER & STACK
  // =========================================================================
  const roofGroup = group(environment.architectureFixtures, 'dryer-compressor-3-roof', [0, 0, 0], {
    positionBasis: '20261124-video-and-photos-005-to-009',
  });
  // Green waterproof epoxy roof finish on confirmed walkable area
  const roofFinishAlcove = box(roofGroup, 'roof-epoxy-alcove', [4.72, .012, 3.25], [11.0, .006, -5.05], 'roofGreen');
  const roofFinishTerrace = box(roofGroup, 'roof-epoxy-terrace', [13.5, .012, 8.75], [15.4, .006, 1.0], 'roofGreen');
  roofFinishAlcove.userData.lowWingRoof = roofFinishTerrace.userData.lowWingRoof = true;

  // Helper: White Century twin-fan outdoor condenser unit (00:50-01:04, 01:13-01:20)
  const centuryUnit = (name, pos, rotY = 0) => {
    const u = group(roofGroup, name, pos, { manufacturer: 'Century', sourceTimesSeconds: [53, 58, 74, 280, 281], sourcePhotos: [6],
      dimensionBasis: '사진 006의 출입문 높이와 00:58·04:40의 실외기 단면, 04:41의 정면 비례' });
    u.rotation.y = rotY;
    box(u, `${name}-body`, [1.42, 1.06, .70], [0, .61, 0], 'white');
    box(u, `${name}-coil`, [1.24, .86, .018], [0, .61, .353], 'black');
    repeats(u, `${name}-coil-fins`, [1.22, .008, .009], Array.from({length: 28}, (_, i) => [0, .204 + .03 * i, .366]), 'dark');
    for (const x of [-.58, .58]) box(u, `${name}-foot`, [.09, .08, .72], [x, .04, 0], 'trim');
    const guardRing = geo('century-fan-guard-ring', () => new THREE.TorusGeometry(1, .022, 4, 40));
    for (const x of [-.35, .35]) {
      cyl(u, `${name}-fan-rim`, .293, .014, [x, 1.145, 0], 'dark');
      for (const radius of [.09, .15, .215, .28]) {
        const ring = s._mesh(guardRing, m.trim, u, [x, 1.162, 0]);
        ring.name = `${name}-guard-ring`; ring.rotation.x = Math.PI / 2; ring.scale.setScalar(radius);
      }
      for (let i = 0; i < 4; i++) {
        const dx = .28 * Math.cos(i * Math.PI / 4), dz = .28 * Math.sin(i * Math.PI / 4);
        bar(u, `${name}-fan-guard-spoke`, [x - dx, 1.159, -dz], [x + dx, 1.159, dz], .005, 'trim');
      }
      cyl(u, `${name}-fan-hub`, .054, .02, [x, 1.165, 0], 'white');
    }
    return u;
  };
  centuryUnit('roof-century-alcove-north', [11.45, 0, -6.25], 0);
  centuryUnit('roof-century-alcove-east-1', [12.90, 0, -5.91], -Math.PI / 2);
  centuryUnit('roof-century-alcove-east-2', [12.90, 0, -4.18], -Math.PI / 2);
  centuryUnit('roof-century-compressor-sw', [14.65, 0, -2.94], 0);
  // Insulated refrigerant piping & two brown cylindrical traps on compressor west outer wall (00:54-00:56)
  bar(roofGroup, 'alcove-wall-insulated-pipe', [13.3, .72, -6.4], [13.3, .72, -3.5], .038, 'white');
  for (const z of [-5.12, -4.96]) cyl(roofGroup, 'alcove-oil-trap', .06, .52, [13.26, 1.05, z], 'brown');

  // Large V-coil outdoor chiller condenser east of compressor room door (#006, 01:15-01:16)
  const vCoil = group(roofGroup, 'roof-vcoil-condenser', [19.40, 0, -1.90], { sourceTimesSeconds: [75, 76], sourcePhotos: [6],
    dimensionBasis: '사진 006 출입문 네 모서리와 실외기 기둥의 투영 비례 · 영상 01:16 측면' });
  for (const x of [-.88, .88]) for (const z of [-1.27, 1.27]) {
    box(vCoil, 'vcoil-green-curb', [.26, .16, .31], [x, .08, z], 'roofGreen');
    box(vCoil, 'vcoil-leg', [.075, 1.40, .075], [x, .86, z], 'white');
  }
  box(vCoil, 'vcoil-top-frame', [1.88, .10, 2.66], [0, 1.51, 0], 'white');
  for (const x of [-.88, .88]) box(vCoil, 'vcoil-base-frame', [.065, .09, 2.61], [x, .50, 0], 'trim');
  for (const z of [-1.27, 1.27]) box(vCoil, 'vcoil-base-rail', [1.82, .09, .065], [0, .50, z], 'trim');
  // The camera passes the screened V-shaped ends alongside the door at 01:16.
  for (const center of [-.64, .64]) {
    for (const side of [-1, 1]) {
      const bank = box(vCoil, 'vcoil-fin-bank', [1.70, Math.hypot(.94,.59), .06], [0, 1.00, center + side * .295], 'dark');
      bank.rotation.x = side * Math.atan2(.59,.94);
    }
    cyl(vCoil, 'vcoil-top-fan', .50, .03, [0, 1.566, center], 'dark');
  }
  for (const x of [-.92, .92]) {
    repeats(vCoil, 'vcoil-mesh-uprights', [.009, .92, .009], Array.from({length:21}, (_, i) => [x, 1, (i - 10) * .124]), 'trim');
    repeats(vCoil, 'vcoil-mesh-crosswires', [.009, .009, 2.51], Array.from({length:9}, (_, i) => [x, .55 + i * .11, 0]), 'trim');
  }

  // Compressor room exterior door canopy, anonymized sign & fire extinguisher (#006, 01:20-01:33)
  const canopy = box(roofGroup, 'compressor-door-rain-canopy', [2.35, .07, .62], [16.85, 2.48, -3.05], 'steel');
  canopy.rotation.x = .14;
  plaque(roofGroup, 'compressor-door-sign', '에어콤프레셔실', [16.85, 1.62, -3.32], [.40, .29],
    { bg: '#efefef', fg: '#343838', capacityLine: '(50HP 3대, 100HP 1대)' });
  extinguisher(roofGroup, 'compressor-exterior-extinguisher', [15.55, 0, -3.18]);

  // Outdoor Baghouse Dust Collector + GIHO FANTECH Blower + Tall White Exhaust Stack (#005-#009)
  const dust = group(roofGroup, 'roof-baghouse-and-stack', [11.2, 0, 1.2], {
    manufacturer: 'GIHO FANTECH', model: 'GTF05-S4 (30kW, 900 m3/min, 2003)',
    sourcePhotos: ['20261124_135511.jpg', '20261124_135531.jpg', '20261124_135538.jpg', '20261124_135555.jpg', '20261124_135608.jpg'],
    internalTowerSourceConfirmed: false,
  });
  // Collector frame & pyramidal hopper (local Z = +1.55 => world Z = 2.75)
  const cz = 1.55;
  for (const x of [-.98, .98]) for (const z of [cz - .95, cz + .95]) box(dust, 'baghouse-leg', [.1, 3.15, .1], [x, 1.575, z], 'white');
  for (const side of [-1, 1]) {
    bar(dust, 'baghouse-brace', [-.98, .3, cz + side * .95], [.98, 2.8, cz + side * .95], .03, 'white');
    bar(dust, 'baghouse-brace', [.98, .3, cz + side * .95], [-.98, 2.8, cz + side * .95], .03, 'white');
  }
  const hopperGeo = geo('baghouse-hopper', () => { const g = new THREE.CylinderGeometry(1.38, .26, 2.05, 4); g.rotateY(Math.PI / 4); return g; });
  const hopper = s._mesh(hopperGeo, m.white, dust, [0, 2.12, cz]);
  hopper.name = 'baghouse-pyramidal-hopper';
  // Hopper access hatch, rotary discharge chute & yellow inspection steps (#005, #006)
  box(dust, 'baghouse-hopper-hatch', [.48, .44, .08], [.48, 1.88, cz + .62], 'trim');
  box(dust, 'baghouse-discharge-chute', [.42, .45, .42], [0, .92, cz], 'trim');
  box(dust, 'baghouse-yellow-step', [.65, .75, .48], [.45, .375, cz + .72], 'blowerYellow');
  bar(dust, 'baghouse-step-rail', [.12, .75, cz + .96], [.12, 1.55, cz + .96], .02, 'blowerYellow');
  bar(dust, 'baghouse-step-rail-top', [.12, 1.55, cz + .96], [.78, 1.55, cz + .48], .02, 'blowerYellow');
  // Main ribbed collector housing (y = 3.15..6.95) + pulse-jet air header on west top edge (#007)
  box(dust, 'baghouse-housing', [2.05, 3.8, 1.98], [0, 5.05, cz], 'white');
  for (const y of [3.2, 4.15, 5.1, 6.05, 6.92]) box(dust, 'baghouse-rib', [2.16, .08, 2.08], [0, y, cz], 'trim');
  cyl(dust, 'baghouse-pulse-header', .09, 2.02, [-1.14, 6.65, cz], 'white', 'z');
  for (const dz of [-.65, 0, .65]) bar(dust, 'baghouse-pulse-drop', [-1.14, 6.65, cz + dz], [-1.02, 6.35, cz + dz], .03, 'trim');
  // Curved galvanized round intake duct emerging from Tower East Wall (world X=8.6 => local X=-2.6)
  const intakePts = [
    new THREE.Vector3(-2.6, 3.85, cz), new THREE.Vector3(-2.0, 3.85, cz),
    new THREE.Vector3(-1.75, 4.35, cz), new THREE.Vector3(-1.02, 4.45, cz),
  ];
  const intakeGeo = geo('baghouse-intake-duct', () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(intakePts), 24, .34, 16, false));
  const intakeMesh = s._mesh(intakeGeo, m.galv, dust); intakeMesh.name = 'baghouse-tower-intake-duct';
  box(dust, 'baghouse-intake-transition', [.26, .88, .88], [-1.08, 4.45, cz], 'white');
  box(dust, 'baghouse-wall-flange', [.08, .92, .92], [-2.56, 3.85, cz], 'galv');
  // Yellow caged vertical access ladder + top guardrails + catwalk to stack
  const lx = .95, lz = cz + 1.08;
  for (const dx of [-.22, .22]) bar(dust, 'baghouse-ladder-rail', [lx + dx, 0, lz], [lx + dx, 7.85, lz], .022, 'blowerYellow');
  for (let y = .35; y < 7.6; y += .32) bar(dust, 'baghouse-ladder-rung', [lx - .22, y, lz], [lx + .22, y, lz], .015, 'blowerYellow');
  const hoopGeo = geo('baghouse-ladder-hoop', () => new THREE.TorusGeometry(.36, .016, 6, 20, Math.PI * 1.35));
  for (let y = 2.3; y <= 7.5; y += .75) {
    const hoop = s._mesh(hoopGeo, m.blowerYellow, dust, [lx, y, lz + .26]);
    hoop.rotation.x = Math.PI / 2; hoop.rotation.z = -Math.PI * .18; hoop.name = 'baghouse-ladder-hoop';
  }
  for (const y of [7.45, 7.95]) {
    bar(dust, 'baghouse-top-rail', [-1.02, y, cz - 1.0], [1.02, y, cz - 1.0], .02, 'blowerYellow');
    bar(dust, 'baghouse-top-rail', [-1.02, y, cz + 1.0], [1.02, y, cz + 1.0], .02, 'blowerYellow');
    bar(dust, 'baghouse-top-rail', [-1.02, y, cz - 1.0], [-1.02, y, cz + 1.0], .02, 'blowerYellow');
    bar(dust, 'baghouse-top-rail', [1.02, y, cz - 1.0], [1.02, y, cz + 1.0], .02, 'blowerYellow');
    bar(dust, 'baghouse-bridge-rail', [.35, y - .4, cz - 1.0], [.35, y - .4, -1.45], .02, 'blowerYellow');
  }
  box(dust, 'baghouse-stack-catwalk', [.65, .05, 2.05], [0, 6.55, -.42], 'trim');

  // Vertical clean-air down-duct into GIHO FANTECH blower (local Z = -1.55 => world Z = -0.35)
  const bz = -1.55;
  const downPts = [
    new THREE.Vector3(0, 6.35, cz - .98), new THREE.Vector3(0, 6.25, .05),
    new THREE.Vector3(0, 5.5, .05), new THREE.Vector3(0, 1.35, .05),
    new THREE.Vector3(0, 1.0, -.85),
  ];
  const downGeo = geo('baghouse-down-duct', () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(downPts), 32, .34, 16, false));
  const downMesh = s._mesh(downGeo, m.white, dust); downMesh.name = 'baghouse-clean-air-duct';
  for (const x of [-.52, .52]) bar(dust, 'baghouse-duct-leg', [x, 0, .05], [x, 1.35, .05], .04, 'white');
  // Blower frame, scroll, yellow motor & inclined yellow belt guard
  for (const x of [-.88, .88]) for (const z of [bz - .82, bz + .78]) box(dust, 'blower-frame-post', [.1, 2.6, .1], [x, 1.3, z], 'white');
  for (const z of [bz - .82, bz + .78]) box(dust, 'blower-frame-beam', [1.85, .12, .1], [0, 2.55, z], 'white');
  for (const x of [-.88, .88]) box(dust, 'blower-frame-side', [.1, .12, 1.65], [x, 2.55, bz - .02], 'white');
  box(dust, 'blower-base-skid', [1.55, .24, 1.65], [0, .12, bz], 'white');
  cyl(dust, 'blower-scroll', .62, .72, [0, 1.05, bz + .15], 'white', 'z');
  box(dust, 'blower-discharge-box', [.85, .85, .85], [0, 1.72, bz + .15], 'white');
  cyl(dust, 'blower-yellow-motor', .24, .56, [.18, .68, bz - .48], 'blowerYellow', 'x');
  const guard = box(dust, 'blower-yellow-belt-guard', [.18, 1.05, .36], [-.25, .92, bz - .42], 'blowerYellow');
  guard.rotation.x = .62;
  plaque(dust, 'blower-giho-nameplate', 'GIHO 30kW', [.44, 1.85, bz + .15], [.36, .16], { bg: '#9e352d', fg: '#f4f0e8', rotY: Math.PI / 2 });
  // Tall white cylindrical exhaust stack (~10.5m) with flange rings & curved outlet bend
  cyl(dust, 'exhaust-stack-silencer', .49, 5.2, [0, 4.75, bz + .15], 'white');
  for (const y of [2.16, 4.75, 7.34]) cyl(dust, 'exhaust-stack-flange', .54, .06, [0, y, bz + .15], 'trim');
  cyl(dust, 'exhaust-stack-upper', .36, 2.8, [0, 8.75, bz + .15], 'white');
  const bendPts = [
    new THREE.Vector3(0, 10.05, bz + .15), new THREE.Vector3(0, 10.65, bz + .15), new THREE.Vector3(.48, 10.85, bz + .15),
  ];
  const bendGeo = geo('exhaust-stack-bend', () => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bendPts), 14, .34, 16, false));
  const bendMesh = s._mesh(bendGeo, m.white, dust); bendMesh.name = 'exhaust-stack-top-bend';

  // =========================================================================
  // 3. AIR COMPRESSOR ROOM INTERIOR (X 13.4..22.2, Z -13.4..-3.4)
  // =========================================================================
  const compSpec = spec.rooms.find(r => r.id === 'compressor-room');
  const rb = compSpec.bounds; // minX=13.4, maxX=22.2, minZ=-13.4, maxZ=-3.4
  const roomGroup = group(environment.architectureFixtures, 'dryer-compressor-3-room', [0, 0, 0], {
    roomId: 'compressor-room', positionBasis: compSpec.positionBasis,
    equipmentCountConfirmed: 13, doorSignDiscrepancyDocumented: true,
  });

  // Interior green epoxy floor finish
  box(roomGroup, 'compressor-interior-green-floor', [rb.maxX - rb.minX - .14, .012, rb.maxZ - rb.minZ - .14],
    [(rb.minX + rb.maxX) / 2, .006, (rb.minZ + rb.maxZ) / 2], 'roomGreen');

  // Sloped gable infill walls (North & South, y=3.3..4.4 west -> 3.3 east) + ceiling rafters/lamps in FACADE (cutaway!)
  const roomFacade = group(environment.facade, 'dryer-compressor-3-facade-extras', [0, 0, 0], { cutawayWithFacade: true });
  const wSpan = rb.maxX - rb.minX, westH = compSpec.height, eastH = compSpec.lowEastHeight ?? 3.3;
  const gableGeo = geo(`comp-gable:${wSpan}:${westH}:${eastH}`, () => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0); shape.lineTo(wSpan, 0); shape.lineTo(0, westH - eastH); shape.closePath();
    return new THREE.ExtrudeGeometry(shape, { depth: .12, bevelEnabled: false });
  });
  for (const [label, z] of [['north', rb.minZ - .06], ['south', rb.maxZ - .06]]) {
    const gable = s._mesh(gableGeo, m.wall, roomFacade, [rb.minX, eastH, z]);
    gable.name = `compressor-gable-${label}`;
  }
  const slopeTilt = Math.atan2(westH - eastH, wSpan);
  const rafterLen = Math.hypot(wSpan - .2, westH - eastH);
  for (const z of [-11.5, -8.4, -5.3]) {
    const rafter = box(roomFacade, 'compressor-roof-rafter', [rafterLen, .14, .12], [(rb.minX + rb.maxX) / 2, (westH + eastH) / 2 - .12, z], 'white');
    rafter.rotation.z = -slopeTilt;
  }
  for (const z of [-10.5, -6.2]) box(roomFacade, 'compressor-ceiling-lamp', [.32, .08, 1.1], [16.85, 3.65, z], 'ceilingLamp');

  // North wall horizontal daylight window band + yellow insulated & silver steel pipes (03:08-03:19)
  const compWin = group(roomGroup, 'compressor-north-window-band', [17.8, 0, rb.minZ + .07], { sourceTimesSeconds: [190, 192, 250] });
  box(compWin, 'comp-north-glass', [6.76, 1.12, .02], [0, 2.32, 0], 'clearGlass');
  for (let i = 0; i <= 4; i++) box(compWin, 'comp-north-mullion', [.045, 1.15, .06], [-3.38 + i * 1.69, 2.32, 0], 'trim');
  for (const y of [1.75, 2.9]) box(compWin, 'comp-north-sill-head', [6.82, .05, .07], [0, y, 0], 'trim');
  bar(roomGroup, 'comp-north-yellow-pipe', [13.7, .92, -13.06], [21.9, .92, -13.06], .085, 'yellowPipe');
  bar(roomGroup, 'comp-north-silver-pipe', [13.7, .64, -12.92], [21.9, .64, -12.92], .048, 'galv');
  for (const x of [14.5, 16.5, 18.5, 20.5]) box(roomGroup, 'comp-north-pipe-stand', [.06, .94, .34], [x, .47, -13.02], 'trim');
  // Two wall exhaust fans (West wall above JAC-100 & East wall above stainless water tank)
  for (const [name, pos, rotY] of [
    ['comp-west-wall-fan', [rb.minX + .1, 2.75, -7.8], Math.PI / 2],
    ['comp-east-wall-fan', [rb.maxX - .1, 2.55, -8.2], -Math.PI / 2],
  ]) {
    const fan = group(roomGroup, name, pos); fan.rotation.y = rotY;
    box(fan, `${name}-frame`, [.52, .52, .1], [0, 0, 0], 'trim');
    cyl(fan, `${name}-opening`, .2, .11, [0, 0, .01], 'dark', 'z');
  }
  // Overhead blue compressed-air header pipes (01:57, 02:18, 04:23)
  bar(roomGroup, 'comp-overhead-blue-header-west', [14.8, 3.18, -11.6], [14.8, 3.18, -4.1], .042, 'bluePipe');
  bar(roomGroup, 'comp-overhead-blue-header-east', [18.5, 3.05, -11.4], [18.5, 3.05, -4.3], .042, 'bluePipe');
  bar(roomGroup, 'comp-overhead-blue-cross-1', [14.8, 3.12, -9.45], [18.5, 3.12, -9.45], .04, 'bluePipe');
  bar(roomGroup, 'comp-overhead-blue-cross-2', [14.8, 3.12, -5.7], [18.5, 3.12, -5.7], .04, 'bluePipe');

  // Helper: KAESER yellow/dark screw compressor cabinet + overhead exhaust hood
  const kaeserUnit = (name, label, pos, size, rotY, { curvedHood = false, coolerSide = false, specText = '' } = {}) => {
    const [w, h, d] = size;
    const u = group(roomGroup, name, pos, { manufacturer: 'KAESER', equipmentLabel: label, specText });
    u.rotation.y = rotY;
    box(u, `${name}-base`, [w, .14, d], [0, .07, 0], 'black');
    box(u, `${name}-body`, [w, h - .14, d], [0, .14 + (h - .14) / 2, 0], 'kaeserDark');
    // Signature KAESER yellow front/side doors
    box(u, `${name}-yellow-front`, [w * .68, h - .22, .05], [-w * .14, .14 + (h - .22) / 2, d / 2 + .015], 'kaeserYellow');
    box(u, `${name}-yellow-side`, [.05, h - .22, d * .92], [-w / 2 - .015, .14 + (h - .22) / 2, 0], 'kaeserYellow');
    // SIGMA CONTROL 2 display & keypad on dark control section
    box(u, `${name}-sigma-ctrl`, [.28, .32, .03], [w * .33, h * .72, d / 2 + .02], 'dark');
    box(u, `${name}-sigma-screen`, [.16, .11, .012], [w * .33, h * .76, d / 2 + .035], 'ledBlue');
    cyl(u, `${name}-estop`, .028, .03, [w * .33, h * .55, d / 2 + .03], 'red', 'z');
    if (coolerSide) {
      box(u, `${name}-cooler-core`, [.05, h * .62, d * .58], [w / 2 + .015, h * .54, 0], 'galv');
    }
    // Overhead galvanized sheet-metal exhaust duct/hood
    box(u, `${name}-exhaust-duct`, [w * .52, .85, d * .52], [-w * .08, h + .42, 0], 'galv');
    if (curvedHood) {
      cyl(u, `${name}-exhaust-elbow`, d * .26, w * .52, [-w * .08, h + .85, -.12], 'galv', 'x');
    } else {
      box(u, `${name}-exhaust-louver`, [w * .54, .56, .1], [-w * .08, h + .56, d * .28], 'trim');
    }
    plaque(u, `${name}-tag`, label, [0, h + .14, d / 2 + .03], [.68, .22], { bg: '#21292b', fg: '#f4c63d' });
    return u;
  };

  // Helper: Vertical Air Receiver Tank (HAN GANG / 유진하이테크)
  const receiverTank = (name, label, pos, r, h, paint = 'tankGray') => {
    const u = group(roomGroup, name, pos, { equipmentLabel: label });
    cyl(u, `${name}-skirt`, r * .94, .32, [0, .16, 0], paint);
    cyl(u, `${name}-shell`, r, h - .62, [0, .32 + (h - .62) / 2, 0], paint);
    const domeGeo = geo(`dome:${r}`, () => new THREE.SphereGeometry(r, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2));
    const topDome = s._mesh(domeGeo, m[paint], u, [0, h - .3, 0]);
    topDome.scale.set(1, .55, 1); topDome.name = `${name}-dome`;
    cyl(u, `${name}-gauge`, .065, .04, [r + .03, 1.55, 0], 'white', 'x');
    bar(u, `${name}-riser-pipe`, [0, h - .05, 0], [0, h + .55, 0], .048, 'galv');
    return u;
  };

  // Helper: Blue inline air filter housing
  const inlineFilter = (parent, name, pos) => {
    const f = group(parent, name, pos);
    box(f, `${name}-head`, [.14, .11, .14], [0, .28, 0], 'dark');
    cyl(f, `${name}-bowl`, .065, .48, [0, 0, 0], 'blueFilter');
    return f;
  };

  // --- WEST ROW (South -> North, X = 13.7..15.7, clear of central aisle X = 15.85..17.65) ---
  // [1] JEMACO SPX Blue Twin-Tower Desiccant Air Dryer ("3층") + Oil-Water Separator (SW corner)
  const spxBlue = group(roomGroup, 'comp-dryer-spx-blue', [14.38, 0, -4.15], {
    manufacturer: 'JEMACO SPX', kind: 'desiccant-air-dryer-blue-twin', sourcePhotos: ['20261124_141530.jpg', '20261124_141542.jpg'],
  });
  for (const z of [-.42, .42]) {
    cyl(spxBlue, 'spx-blue-tower', .155, 1.92, [.22, 1.08, z], 'blueBright');
    box(spxBlue, 'spx-blue-foot', [.44, .06, .18], [.22, .03, z], 'blueBright');
  }
  box(spxBlue, 'spx-center-console', [.24, 1.72, .52], [.22, 1.0, 0], 'kaeserDark');
  for (const z of [-.11, .11]) cyl(spxBlue, 'spx-gauge', .045, .025, [.35, 1.56, z], 'white', 'x');
  box(spxBlue, 'spx-mimic-panel', [.015, .28, .28], [.348, 1.28, 0], 'black');
  // Oil-Water Separator & electrical wall box behind SPX blue dryer
  const ows = group(roomGroup, 'comp-oil-water-separator', [13.82, 0, -4.55], {
    kind: 'oil-water-separator', sourcePhotos: ['20261124_141601.jpg', '20261124_141624.jpg'],
  });
  box(ows, 'ows-tank', [.48, .72, .62], [0, .36, 0], 'kaeserDark');
  box(ows, 'ows-top-module', [.22, .24, .28], [0, .82, -.08], 'blueBright');
  cyl(ows, 'ows-brown-silencer', .08, .38, [.24, .58, .32], 'brown');
  box(roomGroup, 'comp-sw-wall-elec-box', [.16, .68, .54], [13.52, 1.52, -3.8], 'white');

  // [2] JEMACO PS600K Gray Twin-Vessel Desiccant Air Dryer (V-3)
  const ps600 = group(roomGroup, 'comp-dryer-ps600k', [14.55, 0, -5.6], {
    manufacturer: 'JEMACO', model: 'PS600K (V-3)', sourcePhotos: ['20261124_141356.jpg', '20261124_141410.jpg'],
  });
  for (const z of [-.34, .34]) {
    cyl(ps600, 'ps600-vessel', .24, 1.62, [.12, 1.02, z], 'tankGray');
    cyl(ps600, 'ps600-skirt', .22, .22, [.12, .11, z], 'tankGray');
    cyl(ps600, 'ps600-gauge', .05, .025, [.37, 1.48, z], 'white', 'x');
  }
  box(ps600, 'ps600-ctrl-box', [.22, .56, .48], [.4, 1.05, 0], 'tankLight');
  cyl(ps600, 'ps600-header-drum', .12, 1.15, [-.55, .42, 0], 'galv', 'z');
  bar(ps600, 'ps600-top-pipe-a', [.12, 1.92, -.34], [-.55, 1.92, -.34], .038, 'galv');
  bar(ps600, 'ps600-top-pipe-b', [.12, 1.92, .34], [-.55, 1.92, .34], .038, 'galv');

  // [3] JEMACO HX601K Refrigerated Air Dryer (Blue front face, dark-gray body)
  const hx601 = group(roomGroup, 'comp-dryer-hx601k', [14.72, 0, -6.92], {
    manufacturer: 'JEMACO SPX', model: 'HX601K', sourcePhotos: ['20261124_141306.jpg', '20261124_141311.jpg', '20261124_141323.jpg'],
  });
  box(hx601, 'hx601-body', [1.42, 1.02, .72], [0, .54, 0], 'kaeserDark');
  box(hx601, 'hx601-blue-front', [.05, 1.02, .72], [.72, .54, 0], 'blueBright');
  box(hx601, 'hx601-top-strip', [.12, .05, .52], [.64, 1.06, 0], 'trim');
  box(hx601, 'hx601-side-grille', [.68, .66, .03], [.1, .52, .37], 'trim');
  inlineFilter(hx601, 'hx601-rear-filter', [-.78, 1.48, -.15]);

  // [4] JEMACO JAC-100 After Cooler (White louvered front, dark-gray cabinet)
  const jac100 = group(roomGroup, 'comp-aftercooler-jac100', [14.48, 0, -8.15], {
    manufacturer: 'JEMACO', model: 'JAC-100 After Cooler', sourcePhotos: ['20261124_141220.jpg', '20261124_141225.jpg', '20261124_141233.jpg'],
  });
  box(jac100, 'jac100-body', [.62, 1.24, 1.26], [0, .66, 0], 'kaeserDark');
  box(jac100, 'jac100-white-front', [.04, 1.18, 1.22], [.32, .66, 0], 'white');
  box(jac100, 'jac100-grille', [.02, .74, .92], [.345, .58, 0], 'trim');
  for (const z of [-.42, .42]) {
    bar(jac100, 'jac100-top-pipe', [0, 1.28, z], [0, 2.02, z], .055, 'galv');
    cyl(jac100, 'jac100-valve-wheel', .09, .02, [.14, 1.85, z], 'red', 'x');
  }
  bar(jac100, 'jac100-top-run', [0, 2.02, -.42], [0, 2.02, .42], .055, 'galv');

  // [5] Air Receiver Tank #2 (유진하이테크, 24-05-012242)
  receiverTank('comp-receiver-2', '리시버탱크 #2 (유진하이테크)', [14.55, 0, -9.45], .46, 2.28, 'tankLight');

  // [6] Air Compressor #1 — KAESER CSD 125 SFC (100HP Inverter, 2026) — NW quadrant
  kaeserUnit('comp-unit-1-kaeser-csd125sfc', '#1 KAESER 100HP', [14.85, 0, -11.15], [1.45, 1.98, 1.85], Math.PI / 2, {
    specText: 'KAESER CSD 125 SFC · 100마력 인버터형 · 2026',
  });

  // --- EAST-AISLE ROW (South -> North, X = 17.9..19.7) ---
  // [7] JEMACO Dark-Gray Refrigerated Air Dryer #1 + 3 Blue Inline Filters overhead
  const darkDryer = group(roomGroup, 'comp-dryer-jemaco-dark', [18.6, 0, -4.3], {
    manufacturer: 'JEMACO', kind: 'refrigerated-dryer-top-fan', sourcePhotos: ['20261124_141024.jpg', '20261124_141028.jpg'],
  });
  box(darkDryer, 'dark-dryer-body', [.86, 1.04, .98], [0, .54, 0], 'kaeserDark');
  cyl(darkDryer, 'dark-dryer-top-fan', .32, .05, [0, 1.08, 0], 'trim');
  box(darkDryer, 'dark-dryer-display', [.26, .08, .02], [-.44, .82, 0], 'ledBlue');
  bar(darkDryer, 'dark-dryer-filter-header', [-.1, 1.95, -.52], [.45, 1.95, .52], .042, 'galv');
  for (const [fx, fz] of [[-.05, -.38], [.22, .12], [.42, .45]]) inlineFilter(darkDryer, 'dark-dryer-inline-filter', [fx, 1.62, fz]);

  // [8] Air Receiver Tank #1 (HAN GANG)
  receiverTank('comp-receiver-1', '리시버탱크 #1 (HAN GANG)', [18.55, 0, -5.72], .46, 2.22, 'tankGray');

  // [9] Air Compressor #3 — KAESER CSD 125 (100HP Fixed-speed, 2019)
  kaeserUnit('comp-unit-3-kaeser-csd125', '#3 KAESER 100HP', [18.65, 0, -7.75], [1.45, 1.96, 1.85], -Math.PI / 2, {
    coolerSide: true, specText: 'KAESER CSD 125 · 100마력 정속형 · 2019',
  });

  // [10] Air Compressor #2 — KAESER BSD 72 (50HP Fixed-speed, 2012)
  kaeserUnit('comp-unit-2-kaeser-bsd72', '#2 KAESER 50HP', [18.65, 0, -10.5], [1.35, 1.82, 1.52], -Math.PI / 2, {
    curvedHood: true, specText: 'KAESER BSD 72 · 50마력 정속형 · 2012',
  });

  // --- FAR-EAST WALL ROW (South -> North, X = 20.4..22.0) ---
  // [11] 범양냉방 Water Chilling Unit (HANBELL RC10 Screw Chiller, 2009)
  const chiller = group(roomGroup, 'comp-chiller-bumyang', [21.22, 0, -5.2], {
    manufacturer: '범양냉방 / HANBELL', model: 'Water Chilling Unit · RC10 (2009)',
    sourcePhotos: ['20261124_141046.jpg', '20261124_141102.jpg', '20261124_141126.jpg', '20261124_141148.jpg'],
  });
  box(chiller, 'chiller-skid-frame', [1.18, .12, 2.25], [0, .06, 0], 'dark');
  cyl(chiller, 'chiller-evaporator-drum', .24, 2.05, [.14, .42, 0], 'chillerCream', 'z');
  cyl(chiller, 'chiller-hanbell-screw', .22, 1.15, [-.05, .92, .35], 'chillerCream', 'z');
  box(chiller, 'chiller-terminal-box', [.26, .22, .36], [-.05, 1.24, .35], 'chillerCream');
  box(chiller, 'chiller-control-panel', [.42, 1.32, .88], [-.32, 1.32, -.48], 'white');
  box(chiller, 'chiller-carel-hmi', [.02, .22, .28], [-.54, 1.26, -.48], 'dark');
  for (const dz of [-.12, .12]) cyl(chiller, 'chiller-pressure-gauge', .055, .025, [-.54, 1.72, -.8 + dz], 'white', 'x');

  // [12] Rectangular Stainless Chilled-Water Tank + Vertical Circulation Pump (#033-#036)
  const waterTank = group(roomGroup, 'comp-water-tank-pump', [21.3, 0, -8.0], {
    kind: 'stainless-water-tank-and-pump', sourcePhotos: ['20261124_140626.jpg', '20261124_140630.jpg', '20261124_140639.jpg'],
  });
  for (const x of [-.48, .48]) for (const z of [-.82, .82]) box(waterTank, 'wtank-leg', [.07, .32, .07], [x, .16, z], 'trim');
  box(waterTank, 'wtank-stainless-body', [1.12, 1.48, 1.82], [0, 1.06, 0], 'steel');
  // Vertical circulation pump & blue water risers north of tank
  box(waterTank, 'wpump-stand', [.34, .32, .34], [-.1, .16, -1.35], 'trim');
  cyl(waterTank, 'wpump-casing', .14, .22, [-.1, .42, -1.35], 'galv');
  cyl(waterTank, 'wpump-motor', .13, .42, [-.1, .76, -1.35], 'dark');
  bar(waterTank, 'wpump-suction', [0, .42, -.92], [-.1, .42, -1.35], .045, 'galv');
  bar(waterTank, 'wpump-blue-riser', [-.1, .42, -1.55], [-.1, 2.75, -1.55], .055, 'bluePipe');

  // [13] Air Compressor #4 — K2 POWER LIMITED K50 (50HP Fixed-speed, 2002) — NE corner
  const k50 = group(roomGroup, 'comp-unit-4-k2power-k50', [21.1, 0, -11.2], {
    manufacturer: 'K2 POWER LIMITED', model: 'K50 · 50마력 정속형 · 2002',
    sourcePhotos: ['20261124_140515.jpg', '20261124_140532.jpg', '20261124_140546.jpg', '20261124_140551.jpg'],
  });
  box(k50, 'k50-base', [1.28, .22, 1.68], [0, .11, 0], 'black');
  box(k50, 'k50-body', [1.26, 1.56, 1.66], [0, 1.0, 0], 'k2Beige');
  box(k50, 'k50-panel-frame', [.04, .36, .62], [-.64, 1.38, -.35], 'black');
  for (const dz of [-.18, 0, .18]) cyl(k50, 'k50-gauge', .045, .025, [-.66, 1.3, -.35 + dz], 'white', 'x');
  box(k50, 'k50-exhaust-hood', [.88, .78, .92], [0, 2.15, 0], 'galv');
  plaque(k50, 'k50-tag', '#4 K50 50HP', [-.66, 1.92, 0], [.62, .2], { bg: '#21292b', fg: '#f0ead6', rotY: -Math.PI / 2 });

  // Clear floor labels for outdoor baghouse & NE stair corridor in top/perspective views
  s._groundText?.('옥상 집진기·연돌', [11.2, .05, 4.55], 3.4, .55, roofGroup, { color: '#1b3b2d', font: '700 60px "Malgun Gothic", sans-serif', fitText: true });
  s._groundText?.('북동 계단·옥상 통로', [11.0, .05, -8.6], 3.6, .5, stairGroup, { color: '#244d3b', font: '700 58px "Malgun Gothic", sans-serif', fitText: true });

  return { stairGroup, roofGroup, roomGroup, roomFacade };
}
