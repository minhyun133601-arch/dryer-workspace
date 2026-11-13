import * as THREE from '../vendor/three.module.js';
import { MOTOR_SPEC } from './motor-spec.js';

const TAU = Math.PI * 2;
const PART_NAMES = {
  housing: '하우징', stator: '고정자', rotor: '회전자', shaft: '회전축',
  frontBell: '출력측 엔드커버', bearing: `출력측 ${MOTOR_SPEC.frontBearing}`,
  rearBell: '팬측 엔드커버', rearBearing: `팬측 ${MOTOR_SPEC.rearBearing}`,
  fan: '냉각 팬', fanCover: '팬 덮개', terminal: '단자함', terminalLid: '단자함 덮개',
};

/** An illustrative induction motor, assembled from independently selectable meshes. */
export class MotorScene {
  constructor(canvas, { onSelect = () => {}, onCameraChange = () => {}, active = true } = {}) {
    this.canvas = canvas;
    this.onSelect = onSelect;
    this.onCameraChange = onCameraChange;
    this.options = { exploded: 0, cutaway: false, labels: false, field: false };
    this.speed = MOTOR_SPEC.ratedRpm;
    this.running = false;
    this.active = false;
    this.frame = null;
    this.direction = 1;
    this.selectedPart = null;
    this.parts = Object.fromEntries(Object.entries(PART_NAMES).map(([id, name]) => [id, { id, name }]));
    this.pickables = [];
    this.cutawayPieces = [];
    this.materials = new Map();
    this.disposables = new Set();
    this.labels = [];
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 70);
    this.cameraState = { azimuth: 0.86, elevation: 0.34, distance: 9.2 };
    this.cameraTarget = new THREE.Vector3(0.2, -0.03, 0);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.root = new THREE.Group();
    this.root.position.y = 0.14;
    this.scene.add(this.root);
    this._lighting();
    this._buildMotor();
    this._createLabels();
    this._bindControls();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement || canvas);
    this.resize();
    this._updateCamera();
    this.setActive(active);
  }

  _material(name, part, extra = {}) {
    const key = `${name}:${part}`;
    if (this.materials.has(key)) return this.materials.get(key);
    const palette = {
      cast: { color: 0x7bada0, roughness: 0.54, metalness: 0.36 },
      edge: { color: 0x446b62, roughness: 0.42, metalness: 0.48 },
      lid: { color: 0x92b9ac, roughness: 0.44, metalness: 0.35 },
      steel: { color: 0xb5c1c2, roughness: 0.25, metalness: 0.83 },
      brightSteel: { color: 0xe2e8e6, roughness: 0.22, metalness: 0.85 },
      dark: { color: 0x273d3b, roughness: 0.6, metalness: 0.25 },
      copper: { color: 0xcb7d40, roughness: 0.31, metalness: 0.62 },
      copperDark: { color: 0x95552b, roughness: 0.45, metalness: 0.54 },
      lamination: { color: 0x6a7776, roughness: 0.45, metalness: 0.78 },
      rotor: { color: 0x779ba0, roughness: 0.33, metalness: 0.69 },
    };
    const material = new THREE.MeshStandardMaterial({ ...palette[name], side: THREE.DoubleSide, ...extra });
    this.materials.set(key, material);
    return material;
  }

  _mesh(geometry, material, parent, part, position = [0, 0, 0]) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.part = part;
    parent.add(mesh);
    this.disposables.add(geometry);
    if (part) this.pickables.push(mesh);
    return mesh;
  }

  _box(size, material, parent, part, position) {
    return this._mesh(new THREE.BoxGeometry(...size), material, parent, part, position);
  }

  _cylinder(radius, length, material, parent, part, position = [0, 0, 0], radiusBack = radius, segments = 64) {
    const mesh = this._mesh(new THREE.CylinderGeometry(radius, radiusBack, length, segments), material, parent, part, position);
    mesh.rotation.z = -Math.PI / 2;
    return mesh;
  }

  _ring(inner, outer, length, material, parent, part, position = [0, 0, 0], start = 0, arc = TAU, segments = 64) {
    return this._mesh(annularGeometry(inner, outer, length, start, arc, segments), material, parent, part, position);
  }

  _group(parent, x = 0, y = 0, z = 0) {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    parent.add(group);
    return group;
  }

  _lighting() {
    this.scene.add(new THREE.HemisphereLight(0xeef7ff, 0xa1aaa1, 3.1));
    const key = new THREE.DirectionalLight(0xfff7e9, 4.2);
    key.position.set(3, 7, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -7;
    key.shadow.camera.right = 7;
    key.shadow.camera.top = 5;
    key.shadow.camera.bottom = -5;
    key.shadow.normalBias = 0.025;
    key.shadow.bias = -0.0004;
    key.shadow.radius = 4;
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0xe1f1ff, 2.1);
    fill.position.set(-4, 2, -4);
    this.scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 1.6);
    rim.position.set(0, 0, 5);
    this.scene.add(rim);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.12 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.46;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.disposables.add(ground.geometry);
    this.groundMaterial = ground.material;
  }

  _buildMotor() {
    const cast = this._material('cast', 'housing');
    const edge = this._material('edge', 'housing');
    const dark = this._material('dark', 'housing');
    const steel = this._material('steel', 'housing');
    this.body = this._group(this.root);
    const sectorCount = 20;
    for (let i = 0; i < sectorCount; i += 1) {
      const theta = i * TAU / sectorCount;
      const center = theta + Math.PI / sectorCount;
      const sector = this._group(this.body);
      this._ring(0.92, 1.035, 2.38, cast, sector, 'housing', [0, 0, 0], theta, TAU / sectorCount, 5);
      if (Math.cos(center) > -0.38 && Math.sin(center) > -0.38) this.cutawayPieces.push(sector);
      // Long cooling ribs: shallow radial cast plates with bevel-like end bands.
      const rib = this._box([2.25, 0.135, 0.055], cast, sector, 'housing', [0, Math.cos(center) * 1.087, Math.sin(center) * 1.087]);
      rib.rotation.x = center;
      for (const x of [-1.08, 1.08]) {
        const end = this._box([0.08, 0.11, 0.075], cast, sector, 'housing', [x, Math.cos(center) * 1.07, Math.sin(center) * 1.07]);
        end.rotation.x = center;
      }
    }
    for (const x of [-1.19, 1.19]) {
      for (let i = 0; i < sectorCount; i += 1) {
        const theta = i * TAU / sectorCount;
        const center = theta + Math.PI / sectorCount;
        const band = this._ring(0.915, 1.065, 0.075, cast, this.body, 'housing', [x, 0, 0], theta, TAU / sectorCount, 5);
        if (Math.cos(center) > -0.38 && Math.sin(center) > -0.38) this.cutawayPieces.push(band);
      }
    }
    // The shell is a schematic envelope; mounting centres use the 160M reference.
    this.body.scale.set(1.15, 1.377, 1.377);
    this.mounts = this._group(this.root);
    // 1 scene unit = 100 mm. H=160, A=254, B=210, C=108 (reference drawing).
    for (const z of [-1.235, 1.235]) {
      this._box([2.6, 0.19, 0.64], edge, this.mounts, 'housing', [-0.28, -1.505, z]);
      for (const x of [-1.33, 0.77]) {
        this._box([0.8, 0.24, 0.45], cast, this.mounts, 'housing', [x, -1.29, z * 0.9]);
        // Dark holes represent the four Ø15 mounting holes, rather than fixed bolts.
        this._mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.006, 24), dark, this.mounts, 'housing', [x, -1.405, Math.sign(z) * 1.27]);
      }
    }
    this._mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.23, 16), steel, this.mounts, 'housing', [-0.28, 1.675, 0]);
    this._mesh(new THREE.TorusGeometry(0.19, 0.035, 12, 32), steel, this.mounts, 'housing', [-0.28, 1.99, 0]);
    this._makeNameplate();

    this.frontBell = this._group(this.root, 1.55);
    for (let i = 0; i < 20; i += 1) {
      const theta = i * TAU / 20;
      const center = theta + Math.PI / 20;
      const sector = this._group(this.frontBell);
      this._ring(0.51, 1.47, 0.21, this._material('cast', 'frontBell'), sector, 'frontBell', [0, 0, 0], theta, TAU / 20, 5);
      this._ring(1.3, 1.54, 0.09, this._material('edge', 'frontBell'), sector, 'frontBell', [-0.12, 0, 0], theta, TAU / 20, 5);
      this._ring(0.98, 1.04, 0.008, this._material('edge', 'frontBell'), sector, 'frontBell', [0.112, 0, 0], theta, TAU / 20, 5);
      if (Math.cos(center) > -0.38 && Math.sin(center) > -0.38) this.cutawayPieces.push(sector);
    }
    const frontCap = this._ring(0.229, 0.54, 0.055, this._material('edge', 'frontBell'), this.frontBell, 'frontBell', [0.15, 0, 0]);
    this.cutawayPieces.push(frontCap);
    for (let i = 0; i < 4; i += 1) {
      const a = (i + 0.5) * TAU / 4;
      const y = Math.cos(a) * 1.34;
      const z = Math.sin(a) * 1.34;
      const rib = this._box([0.12, 0.62, 0.09], this._material('cast', 'frontBell'), this.frontBell, 'frontBell', [0.15, Math.cos(a) * 0.99, Math.sin(a) * 0.99]);
      rib.rotation.x = a;
      if (Math.cos(a) > -0.38 && Math.sin(a) > -0.38) this.cutawayPieces.push(rib);
      const bolt = this._cylinder(0.065, 0.045, this._material('steel', 'frontBell'), this.frontBell, 'frontBell', [0.135, y, z], 0.065, 6);
      this._cylinder(0.088, 0.012, this._material('edge', 'frontBell'), this.frontBell, 'frontBell', [0.113, y, z], 0.088, 24);
      if (Math.cos(a) > -0.38 && Math.sin(a) > -0.38) this.cutawayPieces.push(bolt);
    }

    this._buildStator();
    this.stator.scale.set(1.15, 1.3, 1.3);
    this._buildRotor();
    this.rotor.scale.set(1.15, 1.3, 1.3);
    this._buildRearBell();
    this._buildBearings();
    this._buildFan();
    this._buildTerminal();
    this._buildField();
  }

  _makeNameplate() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 576;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#d6dfda';
    ctx.fillRect(0, 0, 1024, 576);
    ctx.strokeStyle = '#576d65';
    ctx.lineWidth = 5;
    ctx.strokeRect(14, 14, 996, 548);
    ctx.fillStyle = '#304a40';
    ctx.font = 'bold 62px sans-serif';
    ctx.fillText('HYOSUNG  /  효성', 44, 92);
    ctx.fillRect(44, 116, 936, 3);
    ctx.font = 'bold 46px monospace';
    ctx.fillText(`${MOTOR_SPEC.model}    ${MOTOR_SPEC.frame}`, 44, 181);
    ctx.font = '36px monospace';
    const lines = [
      `${MOTOR_SPEC.powerKw} kW   ${MOTOR_SPEC.voltageV} V   ${MOTOR_SPEC.currentA} A`,
      `${MOTOR_SPEC.ratedRpm} RPM   ${MOTOR_SPEC.frequencyHz} Hz   3~`,
      `OUT ${MOTOR_SPEC.frontBearing} / FAN ${MOTOR_SPEC.rearBearing}`,
      `No. ${MOTOR_SPEC.serial}   ${MOTOR_SPEC.manufactured}`,
    ];
    lines.forEach((line, i) => ctx.fillText(line, 44, 253 + i * 68));
    ctx.font = '24px sans-serif';
    ctx.fillText('제공 명판 정보로 재구성 · 외관 참고용', 44, 541);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    this.nameplateTexture = texture;
    const mat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.72, metalness: 0.08 });
    this.nameplateMaterial = mat;
    const plate = this._mesh(new THREE.PlaneGeometry(1.05, 0.59), mat, this.body, 'housing', [0.1, 0.9, 0.75]);
    plate.rotation.x = -0.876;
    this.cutawayPieces.push(plate);
  }

  _buildStator() {
    this.stator = this._group(this.root);
    const lamination = this._material('lamination', 'stator');
    const dark = this._material('dark', 'stator');
    const copper = this._material('copper', 'stator');
    const copperDark = this._material('copperDark', 'stator');
    for (let sector = 0; sector < 20; sector += 1) {
      const theta = sector * TAU / 20;
      const center = theta + Math.PI / 20;
      const group = this._group(this.stator);
      this._ring(0.65, 0.895, 1.92, lamination, group, 'stator', [0, 0, 0], theta, TAU / 20, 5);
      for (let i = 0; i < 20; i += 1) {
        const x = -0.91 + i * 0.096;
        this._ring(0.65, 0.901, 0.009, dark, group, 'stator', [x, 0, 0], theta, TAU / 20, 5);
      }
      if (Math.cos(center) > -0.38 && Math.sin(center) > -0.38) this.cutawayPieces.push(group);
    }
    for (const x of [-1.02, 1.02]) {
      this._ring(0.69, 0.86, 0.08, copperDark, this.stator, 'stator', [x, 0, 0]);
    }
    for (let i = 0; i < 24; i += 1) {
      const theta = i * TAU / 24;
      const r = 0.755;
      const points = [
        [-0.91, theta - 0.07], [0.91, theta - 0.07], [1.13, theta - 0.035],
        [1.15, theta + 0.1], [0.91, theta + 0.16], [-0.91, theta + 0.16],
        [-1.13, theta + 0.1], [-1.15, theta - 0.035],
      ].map(([x, a]) => new THREE.Vector3(x, Math.cos(a) * r, Math.sin(a) * r));
      const path = new THREE.CatmullRomCurve3(points, true, 'centripetal');
      const coil = this._mesh(new THREE.TubeGeometry(path, 44, 0.042, 6, true), copper, this.stator, 'stator');
      // Visible insulated copper slot conductor along the inside of the laminations.
      const wire = this._box([1.85, 0.038, 0.034], copper, this.stator, 'stator', [0, Math.cos(theta) * 0.655, Math.sin(theta) * 0.655]);
      wire.rotation.x = theta;
      if (Math.cos(theta) > 0.15 && Math.sin(theta) > -0.15) this.cutawayPieces.push(coil, wire);
    }
  }

  _buildRotor() {
    this.rotor = this._group(this.root);
    this.rotatingRotor = this._group(this.rotor);
    const rotor = this._material('rotor', 'rotor');
    const steel = this._material('steel', 'rotor');
    const dark = this._material('dark', 'rotor');
    this._cylinder(0.554, 1.84, rotor, this.rotatingRotor, 'rotor');
    for (let i = 0; i < 26; i += 1) {
      const a = i * TAU / 26;
      const groove = this._box([1.78, 0.025, 0.035], steel, this.rotatingRotor, 'rotor', [0, Math.cos(a) * 0.55, Math.sin(a) * 0.55]);
      groove.rotation.set(a, 0, 0.035);
    }
    for (const x of [-0.94, 0.94]) {
      this._cylinder(0.57, 0.095, steel, this.rotatingRotor, 'rotor', [x, 0, 0]);
      this._ring(0.19, 0.38, 0.04, dark, this.rotatingRotor, 'rotor', [x * 1.07, 0, 0]);
      for (let i = 0; i < 8; i += 1) {
        const a = i * TAU / 8;
        this._cylinder(0.055, 0.006, dark, this.rotatingRotor, 'rotor', [x * 1.057, Math.cos(a) * 0.43, Math.sin(a) * 0.43], 0.055, 16);
      }
    }
    this.shaft = this._group(this.root);
    this.rotatingShaft = this._group(this.shaft);
    const shaftMat = this._material('brightSteel', 'shaft');
    const shaftDark = this._material('steel', 'shaft');
    // User clarified: large 6309ZZ on output side, small 6207ZZ on cooling-fan side.
    // Output D42 x E110 is a 160M catalogue reference, not a vintage shaft drawing.
    this._cylinder(0.235, 2.4, shaftMat, this.rotatingShaft, 'shaft');
    this._cylinder(0.225, 0.55, shaftMat, this.rotatingShaft, 'shaft', [1.475, 0, 0]);
    this._cylinder(0.175, 0.75, shaftMat, this.rotatingShaft, 'shaft', [-1.575, 0, 0]);
    this._cylinder(0.15, 0.5, shaftMat, this.rotatingShaft, 'shaft', [-2.2, 0, 0]);
    this._cylinder(0.24, 0.1, shaftDark, this.rotatingShaft, 'shaft', [1.8, 0, 0]);
    this._cylinder(0.21, 1.1, shaftMat, this.rotatingShaft, 'shaft', [2.4, 0, 0]);
    this._box([0.8, 0.05, 0.12], shaftDark, this.rotatingShaft, 'shaft', [2.38, 0.235, 0]);
    this._cylinder(0.054, 0.006, this._material('dark', 'shaft'), this.rotatingShaft, 'shaft', [2.953, 0, 0], 0.054, 24);
  }

  _buildRearBell() {
    this.rearBell = this._group(this.root, -1.7);
    const cast = this._material('cast', 'rearBell');
    const edge = this._material('edge', 'rearBell');
    for (let i = 0; i < 20; i += 1) {
      const theta = i * TAU / 20;
      const centre = theta + Math.PI / 20;
      const group = this._group(this.rearBell);
      this._ring(0.37, 1.47, 0.44, cast, group, 'rearBell', [0.1, 0, 0], theta, TAU / 20, 5);
      this._ring(1.3, 1.54, 0.09, edge, group, 'rearBell', [0.29, 0, 0], theta, TAU / 20, 5);
      if (Math.cos(centre) > -0.38 && Math.sin(centre) > -0.38) this.cutawayPieces.push(group);
    }
    const cap = this._ring(0.179, 0.4, 0.05, edge, this.rearBell, 'rearBell', [-0.16, 0, 0]);
    this.cutawayPieces.push(cap);
    for (let i = 0; i < 6; i += 1) {
      const a = (i + 0.5) * TAU / 6;
      this._cylinder(0.065, 0.045, this._material('steel', 'rearBell'), this.rearBell, 'rearBell', [-0.145, Math.cos(a) * 1.19, Math.sin(a) * 1.19], 0.065, 6);
    }
  }

  _buildBearings() {
    this.bearing = this._group(this.root, 1.52);
    this.rearBearing = this._group(this.root, -1.7);
    for (const [group, part, bore, outside, width, designation] of [
      [this.bearing, 'bearing', 45, 100, 25, MOTOR_SPEC.frontBearing],
      [this.rearBearing, 'rearBearing', 35, 72, 17, MOTOR_SPEC.rearBearing],
    ]) {
      const inner = bore / 200;
      const outer = outside / 200;
      const half = width / 200;
      const wall = (outer - inner) * 0.21;
      const track = (inner + outer) / 2;
      const ballRadius = (outer - inner) * 0.235;
      const steel = this._material('brightSteel', part);
      const mid = this._material('steel', part);
      const shield = this._material('lamination', part);
      group.name = designation;
      group.userData.dimensionsMm = { bore, outside, width };
      // Separate inner/outer races and two metal ZZ shields. Ball layout is schematic.
      for (let sector = 0; sector < 16; sector += 1) {
        const theta = sector * TAU / 16;
        const centre = theta + Math.PI / 16;
        const piece = this._group(group);
        this._ring(inner, inner + wall, width / 100, steel, piece, part, [0, 0, 0], theta, TAU / 16, 4);
        this._ring(outer - wall, outer, width / 100, mid, piece, part, [0, 0, 0], theta, TAU / 16, 4);
        for (const x of [-half, half]) this._ring(inner + wall * 0.82, outer - wall * 0.8, 0.006, shield, piece, part, [x, 0, 0], theta, TAU / 16, 4);
        if (Math.cos(centre) > -0.38 && Math.sin(centre) > -0.38) this.cutawayPieces.push(piece);
      }
      for (let i = 0; i < 10; i += 1) {
        const a = i * TAU / 10;
        this._mesh(new THREE.SphereGeometry(ballRadius, 12, 8), steel, group, part, [0, Math.cos(a) * track, Math.sin(a) * track]);
      }
    }
  }

  _buildFan() {
    this.fan = this._group(this.root, -2.2);
    this.rotatingFan = this._group(this.fan);
    const blade = this._material('dark', 'fan');
    const hub = this._material('steel', 'fan');
    this._cylinder(0.23, 0.2, hub, this.rotatingFan, 'fan');
    for (let i = 0; i < 10; i += 1) {
      const a = i * TAU / 10;
      const shape = new THREE.Shape();
      shape.moveTo(0.15, -0.065);
      shape.quadraticCurveTo(0.54, -0.18, 0.87, 0.04);
      shape.lineTo(0.83, 0.2);
      shape.quadraticCurveTo(0.53, 0.04, 0.18, 0.06);
      shape.closePath();
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.035, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: 0.013, bevelThickness: 0.012, curveSegments: 8 });
      const mesh = this._mesh(geometry, blade, this.rotatingFan, 'fan');
      mesh.rotation.set(a, Math.PI / 2, 0);
    }
    this.fan.scale.set(1, 1.3, 1.3);
    this.rearCover = this._group(this.root, -2.39);
    const cast = this._material('edge', 'fanCover');
    const dark = this._material('dark', 'fanCover');
    this._ring(1.38, 1.5, 1.08, cast, this.rearCover, 'fanCover');
    this._ring(1.12, 1.5, 0.045, cast, this.rearCover, 'fanCover', [-0.54, 0, 0]);
    this._cylinder(0.22, 0.045, cast, this.rearCover, 'fanCover', [-0.54, 0, 0]);
    // Actual open guard ribs let air and the cooling fan remain visible from behind.
    for (let i = 0; i < 24; i += 1) {
      const a = i * TAU / 24;
      const slot = this._box([0.045, 0.92, 0.047], cast, this.rearCover, 'fanCover', [-0.54, Math.cos(a) * 0.68, Math.sin(a) * 0.68]);
      slot.rotation.x = a;
    }
    for (const r of [0.47, 0.76, 1.02]) this._ring(r, r + 0.027, 0.035, dark, this.rearCover, 'fanCover', [-0.565, 0, 0]);
  }

  _buildTerminal() {
    // Side-mounted box follows the 160M outline reference; internal wiring is schematic.
    this.terminal = this._group(this.root, -0.28, 0.05, 1.46);
    this.terminal.rotation.x = Math.PI / 2;
    const cast = this._material('cast', 'terminal');
    const lid = this._material('lid', 'terminalLid');
    const dark = this._material('dark', 'terminal');
    const steel = this._material('steel', 'terminal');
    this._box([1.2, 0.07, 1.7], cast, this.terminal, 'terminal', [0, -0.12, 0]);
    for (const x of [-0.56, 0.56]) this._box([0.08, 0.49, 1.7], cast, this.terminal, 'terminal', [x, 0.16, 0]);
    for (const z of [-0.81, 0.81]) this._box([1.1, 0.49, 0.08], cast, this.terminal, 'terminal', [0, 0.16, z]);
    this._box([0.9, 0.04, 1.25], dark, this.terminal, 'terminal', [0, -0.055, 0]);
    for (const x of [-0.25, 0.25]) for (const z of [-0.4, 0, 0.4]) {
      this._mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.1, 20), steel, this.terminal, 'terminal', [x, 0.02, z]);
      this._mesh(new THREE.CylinderGeometry(0.087, 0.087, 0.035, 6), this._material('copper', 'terminal'), this.terminal, 'terminal', [x, 0.085, z]);
    }
    this.terminalLid = this._group(this.terminal);
    this._box([1.23, 0.09, 1.73], lid, this.terminalLid, 'terminalLid', [0, 0.45, 0]);
    this._box([1.1, 0.016, 1.58], this._material('dark', 'terminalLid'), this.terminalLid, 'terminalLid', [0, 0.395, 0]);
    for (const x of [-0.5, 0.5]) {
      for (const z of [-0.73, 0.73]) {
        this._mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.018, 16), this._material('steel', 'terminalLid'), this.terminalLid, 'terminalLid', [x, 0.504, z]);
        this._box([0.038, 0.002, 0.007], this._material('dark', 'terminalLid'), this.terminalLid, 'terminalLid', [x, 0.514, z]);
      }
    }
    for (const x of [-0.22, 0.22]) {
      const gland = this._mesh(new THREE.CylinderGeometry(0.105, 0.105, 0.16, 6), dark, this.terminal, 'terminal', [x, 0.1, 0.91]);
      gland.rotation.x = Math.PI / 2;
      const collar = this._mesh(new THREE.CylinderGeometry(0.074, 0.074, 0.1, 24), steel, this.terminal, 'terminal', [x, 0.1, 1.02]);
      collar.rotation.x = Math.PI / 2;
    }
  }

  _buildField() {
    this.field = this._group(this.root);
    this.field.visible = false;
    this.fieldLines = [];
    for (let i = 0; i < 9; i += 1) {
      const a = i * TAU / 9;
      const points = [];
      for (let j = 0; j <= 80; j += 1) {
        const t = j * TAU / 80;
        const x = Math.sin(t) * 1.68;
        const r = 0.51 + (1 - Math.cos(t)) * 0.44;
        points.push(new THREE.Vector3(x, Math.cos(a) * r, Math.sin(a) * r));
      }
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({ color: i % 3 ? 0x68aa9a : 0xd59d63, transparent: true, opacity: 0.48, depthTest: false });
      const line = new THREE.Line(geometry, material);
      line.renderOrder = 5;
      this.field.add(line);
      this.fieldLines.push(line);
      this.disposables.add(geometry);
    }
  }

  _createLabels() {
    const parent = this.canvas.parentElement;
    if (!parent) return;
    const anchors = {
      housing: [this.body, [-0.45, -0.55, 1.12]], stator: [this.stator, [0.87, 0.85, 0.53]],
      rotor: [this.rotor, [0.55, 0.45, 0.18]], shaft: [this.shaft, [2.6, 0.08, 0.1]],
      frontBell: [this.frontBell, [0.12, 1, 0.4]], bearing: [this.bearing, [0.06, -0.5, 0.1]],
      rearBell: [this.rearBell, [-0.12, 1, 0.4]], rearBearing: [this.rearBearing, [0, -0.36, 0.1]],
      fan: [this.fan, [0, 0.85, 0.3]], fanCover: [this.rearCover, [-0.54, -0.4, 0.9]],
      terminal: [this.terminal, [0, 0.16, -0.8]], terminalLid: [this.terminalLid, [0, 0.49, 0]],
    };
    Object.entries(anchors).forEach(([part, [group, position]]) => {
      const label = document.createElement('button');
      label.type = 'button';
      label.className = 'motor-part-label';
      label.dataset.part = part;
      label.setAttribute('aria-label', `${PART_NAMES[part]} 관찰`);
      label.textContent = PART_NAMES[part];
      Object.assign(label.style, {
        position: 'absolute', zIndex: '3', border: '1px solid #bacfc5', borderRadius: '7px',
        background: 'rgba(255,255,255,.92)', color: '#294d40', padding: '5px 9px',
        fontSize: '11px', fontWeight: '600', fontFamily: 'inherit', cursor: 'pointer',
        boxShadow: '0 2px 7px #173d2a0c', transform: 'translate(-50%,-50%)', display: 'none',
      });
      label.addEventListener('pointerdown', (event) => event.stopPropagation());
      label.addEventListener('click', () => { this.selectPart(part); this.onSelect(part); });
      parent.appendChild(label);
      this.labels.push({ element: label, part, group, position: new THREE.Vector3(...position) });
    });
  }

  _bindControls() {
    this.canvas.style.touchAction = 'none';
    this.canvas.style.cursor = 'grab';
    this.drag = null;
    this.activePointers = new Map();
    this.pinchDistance = null;
    const pointerDistance = () => {
      const [first, second] = [...this.activePointers.values()];
      return first && second ? Math.hypot(first.x - second.x, first.y - second.y) : null;
    };
    const finishPointer = (event, canceled = false) => {
      if (!this.activePointers.has(event.pointerId)) return;
      const wasClick = !canceled && this.activePointers.size === 1 && this.drag?.id === event.pointerId && !this.drag.moved;
      this.activePointers.delete(event.pointerId);
      if (this.canvas.hasPointerCapture(event.pointerId)) this.canvas.releasePointerCapture(event.pointerId);
      this.pinchDistance = pointerDistance();
      if (this.activePointers.size === 1) {
        const [id, point] = [...this.activePointers.entries()][0];
        // Resume orbiting from the remaining finger without a jump or a click.
        this.drag = { id, x: point.x, y: point.y, startX: point.x, startY: point.y, moved: true };
      } else if (this.activePointers.size === 0) {
        this.drag = null;
      }
      this.canvas.style.cursor = this.activePointers.size ? 'grabbing' : 'grab';
      if (wasClick) this._pick(event);
    };
    this.handlers = {
      pointerdown: (event) => {
        if (event.button !== 0) return;
        this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (this.activePointers.size === 1) {
          this.drag = { id: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false };
        } else {
          this.pinchDistance = pointerDistance();
          if (this.drag) this.drag.moved = true;
        }
        this.canvas.setPointerCapture(event.pointerId);
        this.canvas.style.cursor = 'grabbing';
      },
      pointermove: (event) => {
        if (!this.activePointers.has(event.pointerId)) return;
        this.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (this.activePointers.size >= 2) {
          const distance = pointerDistance();
          if (distance > 0 && this.pinchDistance > 0) {
            this.cameraState.distance = THREE.MathUtils.clamp(this.cameraState.distance * this.pinchDistance / distance, 4.4, 13);
            this._updateCamera();
          }
          this.pinchDistance = distance;
          if (this.drag) this.drag.moved = true;
          return;
        }
        if (!this.drag || event.pointerId !== this.drag.id) return;
        const dx = event.clientX - this.drag.x;
        const dy = event.clientY - this.drag.y;
        if (Math.hypot(event.clientX - this.drag.startX, event.clientY - this.drag.startY) > 4) this.drag.moved = true;
        this.drag.x = event.clientX;
        this.drag.y = event.clientY;
        this.cameraState.azimuth -= dx * 0.008;
        this.cameraState.elevation = THREE.MathUtils.clamp(this.cameraState.elevation + dy * 0.006, -0.12, 1.25);
        this._updateCamera();
        this.onCameraChange('custom');
      },
      pointerup: (event) => finishPointer(event),
      pointercancel: (event) => finishPointer(event, true),
      wheel: (event) => {
        event.preventDefault();
        this.cameraState.distance = THREE.MathUtils.clamp(this.cameraState.distance * Math.exp(event.deltaY * 0.00075), 4.4, 13);
        this._updateCamera();
      },
    };
    Object.entries(this.handlers).forEach(([event, handler]) => this.canvas.addEventListener(event, handler, event === 'wheel' ? { passive: false } : undefined));
  }

  _pick(event) {
    const bounds = this.canvas.getBoundingClientRect();
    this.pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.pickables, false).find(({ object }) => {
      let parent = object;
      while (parent) { if (!parent.visible) return false; parent = parent.parent; }
      return true;
    });
    const part = hit?.object.userData.part || null;
    this.selectPart(part);
    this.onSelect(part);
  }

  _updateCamera() {
    const { azimuth, elevation, distance } = this.cameraState;
    const bounds = this.modelBounds || new THREE.Box3().setFromObject(this.root);
    bounds.getCenter(this.cameraTarget);
    const normal = new THREE.Vector3(Math.cos(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.sin(azimuth) * Math.cos(elevation));
    const right = new THREE.Vector3(normal.z, 0, -normal.x).normalize();
    const up = new THREE.Vector3().crossVectors(normal, right).normalize();
    const tanY = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * 0.82;
    const tanX = tanY * this.camera.aspect;
    let fit = 0;
    const point = new THREE.Vector3();
    for (const box of this.fitBounds || [bounds]) {
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        point.set(x, y, z).sub(this.cameraTarget);
        const depth = point.dot(normal);
        fit = Math.max(fit, Math.abs(point.dot(right)) / tanX + depth, Math.abs(point.dot(up)) / tanY + depth);
      }
    }
    const radius = Math.max(6, fit) * distance / 9.2;
    this.camera.position.set(
      Math.cos(azimuth) * Math.cos(elevation) * radius,
      Math.sin(elevation) * radius,
      Math.sin(azimuth) * Math.cos(elevation) * radius,
    ).add(this.cameraTarget);
    this.camera.lookAt(this.cameraTarget);
    this.camera.updateMatrixWorld();
  }

  _updateAssembly() {
    const amount = this.options.exploded;
    this.body.position.x = -amount * 0.8;
    this.mounts.position.x = this.body.position.x;
    this.stator.position.set(amount * 0.35, amount * 3.1, 0);
    this.rotor.position.x = amount * 2.35;
    this.shaft.position.x = amount * 2.35;
    this.frontBell.position.x = 1.55 + amount * 4.4;
    this.bearing.position.x = 1.52 + amount * 3.3;
    this.rearBell.position.x = -1.7 - amount * 1.7;
    this.rearBearing.position.x = -1.7 - amount * 0.8;
    this.fan.position.x = -2.2 - amount * 2.8;
    this.rearCover.position.x = -2.39 - amount * 4.2;
    this.terminal.position.set(-0.28 - amount * 0.8, 0.05 + amount * 1.1, 1.46 + amount * 1.25);
    this.terminalLid.position.y = amount * 0.85;
    this.cutawayPieces.forEach((mesh) => { mesh.visible = !this.options.cutaway; });
    this.rearCover.visible = !(this.options.cutaway && amount < 0.08);
    this.terminalLid.visible = !this.options.cutaway;
    this.field.visible = this.options.field;
    this.root.updateMatrixWorld(true);
    // Fit visible geometry individually, avoiding empty corners of a whole-model box.
    this.fitBounds = [];
    this.modelBounds = new THREE.Box3();
    for (const mesh of this.pickables) {
      let visible = true;
      for (let parent = mesh; parent; parent = parent.parent) if (!parent.visible) { visible = false; break; }
      if (!visible) continue;
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      const box = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
      this.fitBounds.push(box);
      this.modelBounds.union(box);
    }
    this._updateCamera();
  }

  _updateLabels() {
    const width = this.width || 1;
    const height = this.height || 1;
    this.root.updateMatrixWorld(true);
    const placed = [];
    for (const { element, part, group, position } of this.labels) {
      if (!this.options.labels) { element.style.display = 'none'; continue; }
      if (!group.visible) { element.style.display = 'none'; continue; }
      const projected = group.localToWorld(position.clone());
      projected.project(this.camera);
      const x = (projected.x * 0.5 + 0.5) * width;
      let y = (-projected.y * 0.5 + 0.5) * height;
      // Keep neighbouring axial labels readable in the exploded view.
      for (let attempt = 0; attempt < 12 && placed.some((p) => Math.abs(p.x - x) < 100 && Math.abs(p.y - y) < 25); attempt += 1) y += 26;
      element.style.display = projected.z < 1 && x > 25 && x < width - 25 && y > 60 && y < height - 78 ? 'block' : 'none';
      element.style.left = `${x}px`;
      element.style.top = `${y}px`;
      element.style.borderColor = this.selectedPart === part ? '#327b61' : '#bacfc5';
      placed.push({ x, y });
    }
  }

  _animate(time) {
    this.frame = null;
    if (this.disposed || !this.active) return;
    const delta = Math.min((time - this.lastFrame) / 1000, 0.06);
    this.lastFrame = time;
    if (this.running && this.speed > 0) {
      // A slow-motion display makes shaft key, rotor bars and fan rotation observable.
      const angle = delta * this.speed / 60 * TAU * 0.035 * this.direction;
      this.rotatingRotor.rotation.x += angle;
      this.rotatingShaft.rotation.x += angle;
      this.rotatingFan.rotation.x += angle;
      if (this.options.field) this.field.rotation.x += delta * this.direction * 0.5;
    }
    this._updateLabels();
    this.renderer.render(this.scene, this.camera);
    this.frame = requestAnimationFrame((nextTime) => this._animate(nextTime));
  }

  // Keep the model and observation settings while releasing the render loop
  // whenever the workspace shows another module or the browser hides this tab.
  setActive(value) {
    if (this.disposed) return;
    const active = Boolean(value);
    if (!active) {
      this.active = false;
      if (this.frame !== null) cancelAnimationFrame(this.frame);
      this.frame = null;
      return;
    }
    if (this.active && this.frame !== null) return;
    this.active = true;
    this.lastFrame = performance.now();
    this.resize();
    this.frame = requestAnimationFrame((time) => this._animate(time));
  }

  setOptions(partial = {}) {
    if ('exploded' in partial) this.options.exploded = THREE.MathUtils.clamp(Number(partial.exploded) || 0, 0, 1);
    for (const key of ['cutaway', 'labels', 'field']) if (key in partial) this.options[key] = Boolean(partial[key]);
    this._updateAssembly();
  }

  setSpeed(rpm) { this.speed = THREE.MathUtils.clamp(Number(rpm) || 0, 0, MOTOR_SPEC.ratedRpm); }
  setRunning(value) { this.running = Boolean(value); }
  setDirection(value) { this.direction = Number(value) < 0 ? -1 : 1; }

  zoomBy(factor) {
    const amount = Number(factor);
    if (!(amount > 0)) return;
    this.cameraState.distance = THREE.MathUtils.clamp(this.cameraState.distance / amount, 4.4, 13);
    this._updateCamera();
  }

  exportSnapshot() {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  setView(view) {
    const views = {
      perspective: { azimuth: 0.86, elevation: 0.34 },
      front: { azimuth: 0.015, elevation: 0.015 },
      side: { azimuth: Math.PI / 2, elevation: 0.035 },
    };
    Object.assign(this.cameraState, views[view] || views.perspective);
    this._updateCamera();
    this.onCameraChange(view in views ? view : 'perspective');
  }

  resetView() {
    this.cameraState = { azimuth: 0.86, elevation: 0.34, distance: 9.2 };
    this._updateCamera();
    this.onCameraChange('perspective');
  }

  selectPart(id) {
    this.selectedPart = id in PART_NAMES ? id : null;
    for (const [key, material] of this.materials) {
      const selected = this.selectedPart && key.endsWith(`:${this.selectedPart}`);
      material.emissive.set(selected ? 0x176b49 : 0x000000);
      material.emissiveIntensity = selected ? 0.25 : 0;
    }
  }

  resize() {
    const parent = this.canvas.parentElement;
    const width = Math.max(1, parent?.clientWidth || this.canvas.clientWidth || 800);
    const height = Math.max(1, parent?.clientHeight || this.canvas.clientHeight || 600);
    this.width = width;
    this.height = height;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this._updateCamera();
  }

  dispose() {
    if (this.disposed) return;
    this.setActive(false);
    this.disposed = true;
    this.resizeObserver.disconnect();
    Object.entries(this.handlers).forEach(([event, handler]) => this.canvas.removeEventListener(event, handler));
    this.labels.forEach(({ element }) => element.remove());
    this.disposables.forEach((geometry) => geometry.dispose());
    this.materials.forEach((material) => material.dispose());
    this.fieldLines.forEach((line) => line.material.dispose());
    this.nameplateTexture.dispose();
    this.nameplateMaterial.dispose();
    this.groundMaterial.dispose();
    this.renderer.dispose();
  }
}

/** Closed annular sector extruded along the motor's X axis. */
function annularGeometry(inner, outer, length, start, arc, segments) {
  const positions = [];
  const push = (...vertices) => vertices.forEach((v) => positions.push(...v));
  const point = (x, r, theta) => [x, Math.cos(theta) * r, Math.sin(theta) * r];
  const x0 = -length / 2;
  const x1 = length / 2;
  for (let i = 0; i < segments; i += 1) {
    const a = start + arc * i / segments;
    const b = start + arc * (i + 1) / segments;
    const p = [point(x0, inner, a), point(x0, outer, a), point(x0, outer, b), point(x0, inner, b)];
    const q = [point(x1, inner, a), point(x1, outer, a), point(x1, outer, b), point(x1, inner, b)];
    push(p[0], p[2], p[1], p[0], p[3], p[2]);
    push(q[0], q[1], q[2], q[0], q[2], q[3]);
    push(p[1], p[2], q[2], p[1], q[2], q[1]);
    push(p[0], q[3], p[3], p[0], q[0], q[3]);
    if (i === 0) push(p[0], p[1], q[1], p[0], q[1], q[0]);
    if (i === segments - 1) push(p[3], q[2], p[2], p[3], q[3], q[2]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}
