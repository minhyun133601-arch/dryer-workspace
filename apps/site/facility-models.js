import * as THREE from '../shared/vendor/three.module.js';

// Field-card verified 5F dryer equipment and procedural lower-floor equipment.
// All render resources are registered through FacilityScene helpers for disposal.
const PI = Math.PI, TAU = Math.PI * 2, UP = new THREE.Vector3(0, 1, 0);

function extraPalette(s) {
  return (s.facilityExtraMaterials ||= {
    curb: s.mat.curb || s._material(0x165638, .32, .06),
    insulation: s.mat.insulation || s._material(0x98a2a6, .52, .34),
    blueHose: s._material(0x1f6bc4, .38, .12),
    yellowMotor: s._material(0xeeb61b, .38, .22),
    rootsGray: s._material(0x4b5358, .48, .46),
    boothPanel: s._material(0xf0f2ee, .72, .05),
    boothGlass: s._material(0x9ab5b8, .22, .08, { transparent: true, opacity: .34, depthWrite: false, side: THREE.DoubleSide }),
    filterWhite: s._material(0xf4f5f0, .86, .02),
    floorPlate: s._material(0x7c8488, .44, .62),
    stained: s.mat.stainedSteel || s.mat.steel,
  });
}

function labelPlaque(s, parent, text, size, position, rotationY = 0, kind = 'nameplate') {
  const g = s._group(parent, position);
  g.rotation.y = rotationY;
  const [w, h] = size;
  s._box(g, [w, h, .012], [0, 0, 0], s.mat.white);
  if (kind === 'caution') {
    s._box(g, [w * .92, h * .24, .014], [0, -h * .34, .002], extraPalette(s).blueHose);
    s._box(g, [h * .36, h * .36, .015], [-w * .24, h * .1, .003], s.mat.yellow).rotation.z = PI / 4;
  } else if (kind === 'prohibit') {
    const ring = s._cyl(g, Math.min(w, h) * .32, .015, [-w * .22, 0, .003], s.mat.red, Math.min(w, h) * .32, 20);
    ring.rotation.x = PI / 2;
    const inner = s._cyl(g, Math.min(w, h) * .23, .016, [-w * .22, 0, .004], s.mat.white, Math.min(w, h) * .23, 20);
    inner.rotation.x = PI / 2;
    const slash = s._box(g, [Math.min(w, h) * .54, .022, .017], [-w * .22, 0, .005], s.mat.red);
    slash.rotation.z = -PI / 4;
  }
  const canDraw = typeof WebGLRenderingContext !== 'undefined' && typeof document !== 'undefined' && typeof document.createElement === 'function';
  if (canDraw && text) {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 128;
    const ctx = canvas.getContext?.('2d');
    if (ctx?.fillText) {
      ctx.fillStyle = '#f5f6f2'; ctx.fillRect(0, 0, 256, 128);
      ctx.strokeStyle = kind === 'nameplate' ? '#2c5a9e' : '#333'; ctx.lineWidth = 6; ctx.strokeRect(4, 4, 248, 120);
      if (kind === 'caution') {
        ctx.fillStyle = '#eab318'; ctx.beginPath(); ctx.moveTo(64, 24); ctx.lineTo(104, 88); ctx.lineTo(24, 88); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#1e2426'; ctx.lineWidth = 4; ctx.stroke();
        ctx.fillStyle = '#1d4c96'; ctx.fillRect(8, 96, 240, 24);
        ctx.fillStyle = '#1e2426'; ctx.font = '700 28px "Malgun Gothic", sans-serif'; ctx.textAlign = 'center'; ctx.fillText('주 의', 172, 66);
      } else {
        ctx.fillStyle = '#1d2b2a'; ctx.font = '700 48px "Malgun Gothic", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(text, 128, 66, 228);
      }
      const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; s.textures?.add(tex);
      const mat = s._material(0xffffff, .55, .05, { map: tex });
      const face = s._mesh(new THREE.PlaneGeometry(w * .96, h * .94), mat, g, [0, 0, .008]);
      face.castShadow = false;
    }
  }
  return g;
}

function curvedTube(s, parent, points, radius, material, tubularSegments = 28, radialSegments = 16) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), false, 'centripetal');
  return s._mesh(new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, false), material, parent);
}

function sightPort(s, parent, position, radius = .16, normalAxis = 'z') {
  const g = s._group(parent, position);
  if (normalAxis === 'x') g.rotation.y = PI / 2;
  const body = s._cyl(g, radius, .09, [0, 0, .04], s.mat.trim, radius, 24); body.rotation.x = PI / 2;
  const glass = s._cyl(g, radius * .72, .02, [0, 0, .082], extraPalette(s).boothGlass, radius * .72, 20); glass.rotation.x = PI / 2;
  s._bar(g, [-radius * 1.18, 0, .075], [radius * 1.18, 0, .075], .014, s.mat.trim);
  for (const sx of [-1, 1]) {
    const cap = s._cyl(g, .022, .055, [sx * radius * 1.12, 0, .075], extraPalette(s).blueHose, .022, 10);
    cap.rotation.z = PI / 2;
  }
  return g;
}

function part(s, root, name, offset = [0, 1, 0], position = [0, 0, 0]) {
  return s._part(root, name, offset, position);
}

function pipe(s, parent, points, radius = .09, material = s.mat.trim) {
  for (let i = 1; i < points.length; i++) s._bar(parent, points[i - 1], points[i], radius, material);
}

function feet(s, parent, width, depth, height = .7) {
  for (const x of [-width / 2, width / 2]) for (const z of [-depth / 2, depth / 2]) {
    s._box(parent, [.13, height, .13], [x, height / 2, z], s.mat.trim);
    s._box(parent, [.35, .08, .35], [x, .04, z], s.mat.dark);
  }
}

function motor(s, parent, position, radius = .3, length = .8) {
  const g = s._group(parent, position);
  const body = s._cyl(g, radius, length, [0, 0, 0], s.mat.motor, radius, 20);
  body.rotation.z = PI / 2;
  for (let i = 0; i < 8; i++) {
    const a = i * PI / 4;
    s._bar(g, [-length / 2, Math.cos(a) * radius, Math.sin(a) * radius], [length / 2, Math.cos(a) * radius, Math.sin(a) * radius], .023, s.mat.dark);
  }
  s._box(g, [.3, .24, .28], [0, radius, 0], s.mat.motor);
  return g;
}

function gauge(s, parent, x, y, z, radius = .14) {
  const dial = s._cyl(parent, radius, .07, [x, y, z], s.mat.white, radius, 18);
  dial.rotation.x = PI / 2;
  s._bar(parent, [x, y, z + .045], [x + radius * .5, y + radius * .45, z + .045], .009, s.mat.black);
}

function control(s, parent, position = [0, 1.5, .6], size = [.6, .8, .25]) {
  const g = s._group(parent, position);
  s._box(g, size, [0, 0, 0], s.mat.white);
  s._box(g, [size[0] * .72, size[1] * .34, .025], [0, size[1] * .18, size[2] / 2 + .015], s.mat.screen);
  for (let i = 0; i < 3; i++) {
    const b = s._cyl(g, .04, .035, [-.16 + i * .16, -size[1] * .24, size[2] / 2 + .035], i === 2 ? s.mat.red : s.mat.mint, .04, 10);
    b.rotation.x = PI / 2;
  }
  return g;
}

function tank(s, root, item) {
  const r = item.radius || 1.2, h = item.height || 2.3;
  feet(s, root, r * 1.35, r * 1.35, .85);
  const shell = part(s, root, item.parts[0], [-1, .3, 0], [0, .85, 0]);
  s._cyl(shell, r, h, [0, h / 2, 0], s.mat.steel, r, 32);
  s._cyl(shell, r, .42, [0, -.13, 0], s.mat.steel, .24, 32);
  for (const y of [.09, h - .07]) s._ring(shell, r + .012, y, s.mat.trim, .035);
  const top = part(s, root, item.parts[1], [0, 1.4, 0], [0, .85 + h, 0]);
  s._cyl(top, .18, .32, [0, .16, 0], s.mat.steel, r, 32);
  s._cyl(top, .32, .12, [r * .45, .23, 0], s.mat.trim, .32, 24);
  if (item.variant === 'mixing') {
    s._bar(top, [0, .15, 0], [0, .9, 0], .07, s.mat.dark);
    s._cyl(top, .27, .65, [0, .82, 0], s.mat.motor, .27, 20);
    s._box(top, [.8, .1, .65], [0, .4, 0], s.mat.trim);
  }
  const outlet = part(s, root, item.parts[2], [1, 0, 1]);
  pipe(s, outlet, [[0, .42, 0], [0, .42, r + .35], [r + .6, .42, r + .35]], .1);
  pipe(s, outlet, [[-r * .7, .6, r * .72], [-r * .7, h + .75, r * .72]], .055);
  s._cyl(outlet, .15, .22, [r + .45, .42, r + .35], s.mat.dark, .15, 14).rotation.z = PI / 2;
  gauge(s, outlet, r * .5, h * .6 + .8, r * .9);
}

function belt(s, parent, length, y = 1.05, width = 1.15, rollers = true) {
  s._box(parent, [width, .12, length], [0, y, 0], s.mat.dark);
  for (const x of [-width / 2 - .07, width / 2 + .07]) {
    s._box(parent, [.13, .23, length + .14], [x, y - .06, 0], s.mat.trim);
    s._bar(parent, [x, y + .28, -length / 2], [x, y + .28, length / 2], .035, s.mat.trim);
  }
  for (const z of [-length / 2 + .2, length / 2 - .2]) feet(s, s._group(parent, [0, 0, z]), width - .2, .1, y - .13);
  if (rollers) for (let z = -length / 2 + .14; z < length / 2; z += .36) {
    const roller = s._cyl(parent, .067, width, [0, y + .08, z], s.mat.steel, .067, 10);
    roller.rotation.z = PI / 2;
  }
}

function packing(s, root, item) {
  const body = part(s, root, item.parts[0], [-1.3, 0, 0]);
  feet(s, body, 1.55, 1.5, .4);
  s._box(body, [1.85, 3.6, 1.75], [0, 2.2, 0], s.mat.steel);
  s._box(body, [1.63, 2.45, .05], [0, 2.35, .9], s.mat.dark);
  for (const x of [-.6, 0, .6]) s._box(body, [.035, 2.45, .075], [x, 2.35, .95], s.mat.trim);
  s._box(body, [1.5, .65, .16], [0, .73, .93], s.mat.white);
  const hopper = part(s, root, item.parts[1], [0, 1.25, 0], [0, 4, 0]);
  s._cyl(hopper, .64, .75, [0, .58, 0], s.mat.steel, .64, 24);
  s._cyl(hopper, .64, .55, [0, -.05, 0], s.mat.steel, .18, 24);
  s._ring(hopper, .66, .97, s.mat.trim, .04);
  const sealing = part(s, root, item.parts[2], [0, .4, 1.5]);
  for (const x of [-.42, .42]) s._bar(sealing, [x, 1.3, 1.05], [x, 3.2, 1.05], .075, s.mat.trim);
  for (const y of [1.45, 2.55, 3.1]) s._box(sealing, [1.1, .16, .32], [0, y, 1.05], s.mat.trim);
  const roll = s._cyl(sealing, .36, 1.55, [0, 2.9, -.95], s.mat.white, .36, 24); roll.rotation.z = PI / 2;
  control(s, sealing, [1.18, 2.1, .2], [.48, .85, .3]);
  const output = part(s, root, item.parts[3], [0, 0, 1.5], [0, 0, 1.68]);
  belt(s, output, 1.65, .85, .82, false);
  s._box(output, [.6, .62, .38], [0, 1.23, .15], s.mat.white);
}

function xray(s, root, item) {
  const tunnel = part(s, root, item.parts[0], [0, 1.1, 0]);
  s._box(tunnel, [2.1, 1.8, 1.5], [0, 1.9, 0], s.mat.steel);
  for (const z of [-.77, .77]) {
    s._box(tunnel, [1.18, .75, .045], [0, 1.42, z], s.mat.black);
    for (let x = -.5; x <= .5; x += .2) s._box(tunnel, [.025, .72, .035], [x, 1.42, z + .025], s.mat.dark);
  }
  const conveyor = part(s, root, item.parts[1], [0, 0, 1]); belt(s, conveyor, 3, 1.05, 1.12);
  const panel = part(s, root, item.parts[2], [1, .3, 0]); control(s, panel, [1.05, 2, .75], [.65, .85, .28]);
  s._bar(panel, [.95, 2.85, .4], [.95, 3.25, .4], .045, s.mat.dark);
  s._cyl(panel, .085, .18, [.95, 3.25, .4], s.mat.mint, .085, 12);
}

function conveyor(s, root, item) {
  const run = part(s, root, item.parts[0], [0, .8, 0]); belt(s, run, item.length || 6.2, 1, 1.12);
  const frame = part(s, root, item.parts[1], [-.8, 0, 0]);
  for (const x of [-.62, .62]) s._bar(frame, [x, .28, -(item.length || 6.2) / 2], [x, .28, (item.length || 6.2) / 2], .055, s.mat.trim);
  const drive = part(s, root, item.parts[2], [1, .2, 0]); motor(s, drive, [.86, .75, -(item.length || 6.2) / 2 + .35], .22, .55);
  for (const z of [-1, 1]) s._box(run, [.64, .45, .55], [0, 1.4, z], s.mat.concrete);
}

function palletizer(s, root, item) {
  const frame = part(s, root, item.parts[0], [-.8, 0, -.6]);
  for (const x of [-1.45, 1.45]) for (const z of [-1.3, 1.3]) s._box(frame, [.17, 4.5, .17], [x, 2.25, z], s.mat.trim);
  for (const y of [.35, 4.5]) { s._box(frame, [3.1, .17, 2.8], [0, y, 0], s.mat.trim); }
  const carriage = part(s, root, item.parts[1], [0, 1, 0]);
  s._box(carriage, [2.8, .2, .6], [0, 3.6, .25], s.mat.yellow);
  s._box(carriage, [.45, .85, .45], [.5, 3.12, .25], s.mat.motor);
  s._box(carriage, [1.3, .12, 1.15], [.5, 2.65, .25], s.mat.dark);
  const loads = part(s, root, item.parts[2], [0, 0, 1.4]);
  for (const x of [-.95, 0, .95]) s._box(loads, [.22, .22, 2.15], [x, .18, 0], s.mat.copper);
  for (let i = 0; i < 5; i++) s._box(loads, [2.4, .07, .22], [0, .33, -1 + i * .5], s.mat.concrete);
  for (let row = 0; row < 3; row++) for (const x of [-.59, .59]) for (const z of [-.55, .55]) s._box(loads, [1.1, .5, 1], [x, .63 + row * .51, z], s.mat.concrete);
}

function utilityTanks(s, root, item) {
  const vessels = [part(s, root, item.parts[0], [-1, .4, 0], [-1.05, 0, 0]), part(s, root, item.parts[1], [1, .4, 0], [1.05, 0, 0])];
  for (const g of vessels) {
    feet(s, g, 1.1, 1.1, .65);
    s._cyl(g, .72, 2.3, [0, 1.8, 0], s.mat.steel, .72, 24);
    s._cyl(g, .15, .28, [0, 3.09, 0], s.mat.steel, .72, 24);
    s._ring(g, .73, .69); s._ring(g, .73, 2.93);
    gauge(s, g, 0, 1.7, .75);
  }
  const pumps = part(s, root, item.parts[2], [0, 0, 1]);
  pipe(s, pumps, [[-1.05, .65, 0], [-1.05, .65, 1.3], [1.05, .65, 1.3], [1.05, .65, 0]], .09);
  motor(s, pumps, [0, .45, 1.3], .24, .6);
}

function processSkid(s, root, item) {
  const frame = part(s, root, item.parts[0], [-1, 0, 0]);
  s._box(frame, [4.8, .18, 2.5], [0, .17, 0], s.mat.dark);
  for (const x of [-2.1, 2.1]) s._bar(frame, [x, .15, -1], [x, 3.2, -1], .085, s.mat.trim);
  s._bar(frame, [-2.1, 3.2, -1], [2.1, 3.2, -1], .085, s.mat.trim);
  const bank = part(s, root, item.parts[1], [0, .9, 0]);
  if (item.variant === 'sterilizer') {
    for (let i = 0; i < 13; i++) s._box(bank, [.1, 2.25, 1.38], [-1 + i * .15, 1.54, 0], i % 4 === 0 ? s.mat.dark : s.mat.trim);
    for (const y of [.6, 2.45]) for (const z of [-.85, .85]) s._bar(bank, [-1.45, y, z], [1.35, y, z], .055, s.mat.dark);
  } else {
    for (let i = 0; i < 5; i++) {
      const y = .8 + i * .47;
      pipe(s, bank, [[-1.7, y, 0], [1.7, y, 0], [1.7, y + .23, 0], [-1.7, y + .23, 0]], .075);
    }
  }
  const connections = part(s, root, item.parts[2], [1.1, .1, 1]);
  for (const x of [-1.8, 1.8]) {
    pipe(s, connections, [[x, .4, 1], [x, 2.9, 1], [x * .5, 2.9, 1], [x * .5, 2.9, 0]], .11);
    const valve = s._cyl(connections, .2, .08, [x, 1.55, 1.17], s.mat.red, .2, 16); valve.rotation.x = PI / 2;
    gauge(s, connections, x, 2.45, 1.2);
  }
  control(s, connections, [2.1, 1.7, .2], [.7, 1, .3]);
  if (item.parts[3]) { const g = part(s, root, item.parts[3], [1.2, .8, 0]); gauge(s, g, .4, 3.3, .2, .18); }
}

function homogenizer(s, root, item) {
  const body = part(s, root, item.parts[0], [-1, 0, 0]);
  s._box(body, [3.3, .23, 2.25], [0, .18, 0], s.mat.dark);
  s._box(body, [2.9, 1.55, 1.85], [0, 1.1, 0], s.mat.steel);
  s._box(body, [2.7, .12, 1.72], [0, 1.94, 0], s.mat.trim);
  for (let x = -.95; x < 1; x += .2) s._box(body, [.065, .65, .03], [x, 1.1, -.94], s.mat.dark);
  motor(s, body, [0, .8, -1.18], .38, 1.6);
  const heads = part(s, root, item.parts[1], [0, .2, 1.3]);
  for (const x of [-.85, 0, .85]) {
    const head = s._cyl(heads, .24, .65, [x, 1.65, 1.08], s.mat.trim, .24, 20); head.rotation.x = PI / 2;
    s._cyl(heads, .19, .45, [x, 2.05, 1.08], s.mat.copper, .19, 16);
  }
  const pipes = part(s, root, item.parts[2], [1, .8, .5]);
  pipe(s, pipes, [[-1.4, 1.65, 1.12], [1.4, 1.65, 1.12], [1.4, 2.6, 1.12]], .1);
  gauge(s, pipes, -.6, 2.45, 1.1, .2); gauge(s, pipes, .6, 2.45, 1.1, .2);
  const panel = part(s, root, item.parts[3], [1.2, 0, -.5]); control(s, panel, [1.8, 1.9, .2], [.75, 1.1, .35]);
}

function hopper(s, root, item) {
  const body = part(s, root, item.parts[0], [-.8, .5, 0]);
  s._cyl(body, 1.15, 1.25, [0, 2.75, 0], s.mat.steel, 1.15, 28);
  s._cyl(body, 1.15, 1.5, [0, 1.38, 0], s.mat.steel, .25, 28);
  s._ring(body, 1.17, 3.37, s.mat.trim, .045);
  const outlet = part(s, root, item.parts[1], [0, .2, 1]);
  s._cyl(outlet, .27, .55, [0, .35, 0], s.mat.trim, .27, 20);
  motor(s, outlet, [.5, .5, 0], .2, .55);
  const frame = part(s, root, item.parts[2], [1.1, 0, 0]); feet(s, frame, 2.5, 2.5, 2.15);
  for (const z of [-1.25, 1.25]) s._bar(frame, [-1.25, .25, z], [1.25, 2, z], .055, s.mat.trim);
}

function fluidBed(s, root, item) {
  const body = part(s, root, item.parts[0], [-1.2, 0, 0]);
  feet(s, body, 6.4, 2, 1.5);
  s._box(body, [7.3, 1.25, 2.3], [0, 2, 0], s.mat.steel);
  s._box(body, [7.5, .18, 2.5], [0, 1.45, 0], s.mat.trim);
  for (const x of [-2.4, -.8, .8, 2.4]) { s._box(body, [.04, 1.1, .035], [x, 2.05, 1.17], s.mat.dark); gauge(s, body, x, 2.2, 1.2, .11); }
  const hood = part(s, root, item.parts[1], [0, 1.3, 0]);
  const shell = s._cyl(hood, 1.17, 7.3, [0, 2.8, 0], s.mat.steel, 1.17, 32); shell.rotation.z = PI / 2;
  for (const x of [-2.5, 0, 2.5]) { const ring = s._ring(hood, 1.19, 0, s.mat.trim, .035); ring.rotation.set(0, PI / 2, 0); ring.position.set(x, 2.8, 0); }
  const drives = part(s, root, item.parts[2], [0, 0, 1.5]);
  for (const x of [-2.1, 2.1]) motor(s, drives, [x, 1.05, 1.1], .3, .75);
  const ports = part(s, root, item.parts[3], [1, .5, -.5]);
  for (const x of [-2.7, 2.7]) { s._cyl(ports, .43, 1.1, [x, 4.1, 0], s.mat.steel, .43, 24); s._ring(ports, .47, 4.65); }
  pipe(s, ports, [[3.7, 2, 0], [4.4, 2, 0], [4.4, .6, 0]], .28);
}

function fineReturn(s, root, item) {
  const chamber = part(s, root, item.parts[0], [-1, .5, 0]);
  feet(s, chamber, 1.8, 1.8, 1.2);
  s._cyl(chamber, 1, 2.2, [0, 2.55, 0], s.mat.steel, 1, 28);
  s._cyl(chamber, 1, .8, [0, 1.05, 0], s.mat.steel, .25, 28);
  const upper = part(s, root, item.parts[1], [0, 1.4, 0]);
  pipe(s, upper, [[0, 3.7, 0], [0, 4.65, 0], [-2.6, 4.65, 0], [-2.6, 3.9, 0]], .34);
  s._ring(upper, 1.02, 3.65, s.mat.trim, .04);
  const lower = part(s, root, item.parts[2], [1.1, 0, 1]);
  pipe(s, lower, [[0, .62, 0], [0, .62, 1.8], [1.5, .62, 1.8]], .2);
  motor(s, lower, [.55, .62, 0], .24, .65); gauge(s, upper, .6, 3.05, .84);
}

function servicePump(s, root, item) {
  if (item.id === 'f5-extraction' || item.variant === 'extraction') {
    const ex = extraPalette(s);
    const blowers = part(s, root, item.parts[0], [-.8, 0, 0]);
    const filters = part(s, root, item.parts[1], [.8, .3, 0]);
    const heaters = part(s, root, item.parts[2], [-.6, .5, 0]);
    const ducts = part(s, root, item.parts[3] || '토출 덕트·대형 송풍기', [0, .8, .6]);

    // Four photographed 5F blower trains: 31(1), 26(6 no heater), 25(7), 24(8)
    const stations = [
      { z: -7.2, heater: true, card: '31' },
      { z: -4.2, heater: false, card: '26' },
      { z: -1.5, heater: true, card: '25' },
      { z: 1.4, heater: true, card: '24' },
    ];
    const voluteShape = new THREE.Shape();
    voluteShape.moveTo(-.44, -.42);
    voluteShape.bezierCurveTo(-.62, .08, -.42, .62, .12, .58);
    voluteShape.bezierCurveTo(.54, .54, .62, -.05, .36, -.44);
    voluteShape.lineTo(-.44, -.44); voluteShape.closePath();
    const voluteGeo = new THREE.ExtrudeGeometry(voluteShape, { depth: .36, bevelEnabled: false, curveSegments: 20 });

    for (const st of stations) {
      const bz = st.z, bx = .75;
      // 1) Green concrete curb + steel skid + centrifugal blower + yellow belt guard + yellow motor
      s._box(blowers, [1.46, .17, 1.06], [bx, .085, bz], ex.curb);
      s._box(blowers, [1.30, .06, .92], [bx, .20, bz], s.mat.trim);
      for (const dx of [-.52, .52]) for (const dz of [-.36, .36]) {
        s._cyl(blowers, .055, .08, [bx + dx, .26, bz + dz], ex.blueHose, .055, 12);
      }
      s._box(blowers, [1.18, .08, .78], [bx, .32, bz], s.mat.trim);
      const scroll = s._mesh(voluteGeo, s.mat.steel, blowers, [bx - .18, .88, bz - .18]);
      scroll.name = `dryer-5f-blower-volute-${st.card}`;
      s._box(blowers, [.46, .34, .38], [bx - .36, 1.32, bz], s.mat.steel);
      // Yellow horizontal motor + yellow folded belt guard
      const mot = s._cyl(blowers, .19, .54, [bx + .32, .62, bz - .16], ex.yellowMotor, .19, 18);
      mot.rotation.z = PI / 2;
      s._box(blowers, [.18, .15, .16], [bx + .32, .81, bz - .16], s.mat.trim);
      s._box(blowers, [.22, .68, .74], [bx + .56, .74, bz - .02], s.mat.yellow);
      s._cyl(blowers, .22, .22, [bx + .56, 1.08, bz + .12], s.mat.yellow, .22, 16).rotation.z = PI / 2;
      // Floor junction box on conduit post
      s._cyl(blowers, .035, .42, [bx + .58, .21, bz - .42], s.mat.dark, .035, 10);
      s._box(blowers, [.22, .24, .18], [bx + .58, .48, bz - .42], s.mat.trim);
      if (!st.heater) {
        // Card 26(6): red prohibition plaque on blower scroll + 2 yellow junction boxes & corrugated hoses
        labelPlaque(s, blowers, '', [.24, .16], [bx - .15, .96, bz - .20], PI, 'prohibit');
      }

      // 2) Trapezoidal stainless intake filter box + white panel filter + black X wires + caution plaque
      const fx = bx + .15, fz = bz + .68;
      s._box(filters, [.78, .15, .48], [fx, .075, fz], ex.curb);
      for (const dx of [-.32, .32]) for (const dz of [-.16, .16]) {
        s._box(filters, [.045, .28, .045], [fx + dx, .29, fz + dz], s.mat.trim);
      }
      // Trapezoid intake housing narrowing toward the blower inlet
      const fBox = s._box(filters, [.86, 1.18, .54], [fx, 1.02, fz], s.mat.steel);
      const pos = fBox.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        if (pos.getZ(i) < 0) {
          pos.setX(i, pos.getX(i) * .52);
          pos.setY(i, pos.getY(i) * .56);
        }
      }
      pos.needsUpdate = true; fBox.geometry.computeVertexNormals(); fBox.geometry.computeBoundingBox(); fBox.geometry.computeBoundingSphere();
      s._cyl(filters, .22, .20, [fx - .12, .88, fz - .32], s.mat.trim, .22, 18).rotation.x = PI / 2;
      // White filter media + stainless frame + black X wire retainer on outer face (+Z)
      s._box(filters, [.80, 1.10, .03], [fx, 1.02, fz + .275], ex.filterWhite);
      for (const sx of [-.41, .41]) s._box(filters, [.04, 1.16, .045], [fx + sx, 1.02, fz + .28], s.mat.trim);
      for (const sy of [.46, 1.58]) s._box(filters, [.86, .04, .045], [fx, sy, fz + .28], s.mat.trim);
      s._bar(filters, [fx - .38, .49, fz + .298], [fx + .38, 1.55, fz + .298], .007, s.mat.black);
      s._bar(filters, [fx - .38, 1.55, fz + .298], [fx + .38, .49, fz + .298], .007, s.mat.black);
      labelPlaque(s, filters, '주의', [.24, .16], [fx + .44, 1.08, fz + .04], PI / 2, 'caution');

      // 3) Discharge transition -> Steam heater box (24,25,31) OR direct round duct (26) -> 90° elbow into floor plate
      const dropX = -3.05;
      if (st.heater) {
        const hx = -.82;
        // Bolted square taper from blower top/side to steam heater coil box
        const inTaper = s._box(heaters, [.72, .88, .82], [hx + .66, 1.26, bz], s.mat.steel);
        const tp = inTaper.geometry.attributes.position;
        for (let i = 0; i < tp.count; i++) if (tp.getX(i) > 0) { tp.setY(i, tp.getY(i) * .52); tp.setZ(i, tp.getZ(i) * .52); }
        tp.needsUpdate = true; inTaper.geometry.computeVertexNormals(); inTaper.geometry.computeBoundingBox(); inTaper.geometry.computeBoundingSphere();
        // Heater box + bolted flanges + 4 angle legs
        s._box(heaters, [.64, .96, .92], [hx, 1.26, bz], s.mat.steel);
        for (const fxOff of [-.31, .31]) s._box(heaters, [.04, 1.04, 1.0], [hx + fxOff, 1.26, bz], s.mat.trim);
        for (const lx of [-.26, .26]) for (const lz of [-.38, .38]) {
          s._box(heaters, [.05, .78, .05], [hx + lx, .39, bz + lz], s.mat.trim);
        }
        // Upper & lower gray insulated steam pipes + valve cluster + pressure gauge
        pipe(s, heaters, [[hx - .2, 1.98, bz - .52], [hx + .35, 1.98, bz - .52], [hx + .35, 5.6, bz - .52]], .065, ex.insulation);
        pipe(s, heaters, [[hx, 1.74, bz - .32], [hx, 1.98, bz - .32], [hx, 1.98, bz - .52]], .055, ex.insulation);
        pipe(s, heaters, [[hx - .25, .48, bz - .48], [hx + .35, .48, bz - .48], [hx + .35, .82, bz - .32]], .055, ex.insulation);
        for (const vx of [-.14, .08, .26]) {
          s._cyl(heaters, .065, .04, [hx + vx, 2.09, bz - .52], s.mat.dark, .065, 12);
          s._bar(heaters, [hx + vx, 1.98, bz - .52], [hx + vx, 2.09, bz - .52], .018, s.mat.trim);
        }
        gauge(s, heaters, hx - .22, 2.18, bz - .52, .075);
        // Outgoing square-to-round taper
        const outTaper = s._box(heaters, [.76, .88, .82], [hx - .68, 1.26, bz], s.mat.steel);
        const op = outTaper.geometry.attributes.position;
        for (let i = 0; i < op.count; i++) if (op.getX(i) < 0) { op.setY(i, op.getY(i) * .46); op.setZ(i, op.getZ(i) * .46); }
        op.needsUpdate = true; outTaper.geometry.computeVertexNormals(); outTaper.geometry.computeBoundingBox(); outTaper.geometry.computeBoundingSphere();
        // Round duct + 90-deg elbow into floor curb & circular steel flange plate
        curvedTube(s, ducts, [[hx - 1.04, 1.26, bz], [dropX + .38, 1.26, bz], [dropX + .08, 1.16, bz], [dropX, .86, bz], [dropX, .18, bz]], .19, s.mat.steel, 24, 18);
      } else {
        // Card 26(6): no steam heater — direct long round duct + 2 yellow junction boxes & flexible hoses
        const outTaper = s._box(heaters, [.68, .54, .54], [.1, 1.26, bz], s.mat.steel);
        const op = outTaper.geometry.attributes.position;
        for (let i = 0; i < op.count; i++) if (op.getX(i) < 0) { op.setY(i, op.getY(i) * .68); op.setZ(i, op.getZ(i) * .68); }
        op.needsUpdate = true; outTaper.geometry.computeVertexNormals(); outTaper.geometry.computeBoundingBox(); outTaper.geometry.computeBoundingSphere();
        curvedTube(s, ducts, [[-.22, 1.26, bz], [dropX + .38, 1.26, bz], [dropX + .08, 1.16, bz], [dropX, .86, bz], [dropX, .18, bz]], .19, s.mat.steel, 28, 18);
        for (const jx of [-.75, -1.65]) {
          s._bar(ducts, [jx, .02, bz + .26], [jx, 1.48, bz + .26], .018, s.mat.trim);
          s._box(ducts, [.15, .17, .12], [jx, 1.48, bz + .26], s.mat.yellow);
          curvedTube(s, ducts, [[jx, 1.40, bz + .26], [jx - .18, 1.22, bz + .22], [jx - .32, 1.28, bz + .16]], .014, s.mat.black, 12, 8);
        }
      }
      // Floor penetration green curb + round steel collar plate + flange ring
      s._box(ducts, [.82, .18, .82], [dropX, .09, bz], ex.curb);
      s._cyl(ducts, .34, .024, [dropX, .19, bz], ex.floorPlate, .34, 24);
      s._ring(ducts, .21, .84, s.mat.trim, .022).position.set(dropX, .84, bz);
    }

    // Large rear blower ("송 풍 기" nameplate + yellow belt cover, seen behind card 24)
    const rx = 1.05, rz = 5.35;
    s._box(ducts, [1.38, .18, 1.48], [rx, .09, rz], ex.curb);
    s._box(ducts, [1.24, .22, 1.32], [rx, .28, rz], s.mat.trim);
    s._box(ducts, [1.06, 1.32, 1.14], [rx, 1.05, rz], ex.stained);
    s._box(ducts, [1.02, 1.05, 1.08], [rx, 2.22, rz], s.mat.steel);
    for (const y of [1.70, 2.74]) s._box(ducts, [1.10, .05, 1.16], [rx, y, rz], s.mat.trim);
    s._box(ducts, [.04, 1.02, .04], [rx - .52, 2.22, rz], s.mat.trim);
    // Nameplate "송 풍 기" + yellow triangle caution sign + round latch + yellow belt guard
    labelPlaque(s, ducts, '송 풍 기', [.36, .16], [rx - .54, 1.46, rz - .08], -PI / 2, 'nameplate');
    labelPlaque(s, ducts, '주의', [.24, .26], [rx - .54, 1.92, rz + .24], -PI / 2, 'caution');
    s._bar(ducts, [rx - .56, 1.05, rz - .08], [rx - .56, 1.22, rz - .08], .018, s.mat.dark);
    s._box(ducts, [.34, .44, .78], [rx - .12, 1.56, rz + .74], s.mat.yellow);
    s._cyl(ducts, .24, .22, [rx - .12, 1.62, rz + 1.06], s.mat.yellow, .24, 18);
    Object.assign(root.userData, { cardNumbers: [24, 25, 26, 31], rearBlowerNameplate: '송 풍 기' });
    return;
  }
  const base = part(s, root, item.parts[0], [-.8, 0, 0]); s._box(base, [3.5, .2, 2.5], [0, .15, 0], s.mat.dark);
  const drive = part(s, root, item.parts[1], [1, .3, 0]);
  for (const z of [-.65, .65]) {
    motor(s, drive, [-.4, .7, z], .31, 1.05);
    s._cyl(drive, .4, .65, [.65, .7, z], s.mat.steel, .4, 24).rotation.z = PI / 2;
    s._box(drive, [1.8, .12, .65], [0, .3, z], s.mat.trim);
  }
  const tubes = part(s, root, item.parts[2], [0, .7, 1]);
  pipe(s, tubes, [[1.05, .7, -.65], [1.6, .7, -.65], [1.6, 1.7, -.65], [1.6, 1.7, .65], [1.05, 1.7, .65]], .12);
  gauge(s, tubes, 1.6, 1.95, .7);
  if (item.parts[3]) { const output = part(s, root, item.parts[3], [1, 1.1, 0]); pipe(s, output, [[.65, .7, .65], [.65, 2.7, .65], [-1, 2.7, .65]], .24); }
}

function dryerBody(s, root, item) {
  const isCone = item.variant === 'cone';
  if (isCone && item.id === 'f5-dryer-cone') {
    // Card 23(10): Chamber lower truncated cone penetrating ceiling & seated on circular green curb
    const ex = extraPalette(s);
    const rTop = item.radius || 3.8, rBot = 1.54, top = item.height || 6.0, bot = .18;
    const shell = part(s, root, item.parts[0], [-1.2, .4, 0]);
    const accessories = part(s, root, item.parts[1], [0, .8, 0]);
    const sideDuct = part(s, root, item.parts[2], [-1.0, .2, -.8]);
    const rightDuct = part(s, root, item.parts[3], [1.1, .2, -.6]);

    // Circular deep-green concrete curb + sealed base so floor hole shows no void
    s._cyl(shell, 1.80, .22, [0, .11, 0], ex.curb, 1.84, 56);
    s._cyl(shell, rBot + .05, .08, [0, .21, 0], s.mat.trim, rBot + .05, 56);
    s._cyl(shell, 1.72, .05, [0, .03, 0], ex.curb, 1.72, 40);

    // Main stainless truncated cone + horizontal weld rings + 24 vertical sheet seams
    const coneH = top - bot, coneMidY = (top + bot) / 2;
    s._cyl(shell, rTop, coneH, [0, coneMidY, 0], s.mat.steel, rBot, 64);
    s._ring(shell, rTop + .02, top - .03, s.mat.trim, .04);
    const midY = 2.55, rMid = rBot + (rTop - rBot) * (midY - bot) / coneH;
    s._ring(shell, rMid + .012, midY, s.mat.trim, .018);
    for (let i = 0; i < 24; i++) {
      const a = i / 24 * TAU;
      s._bar(shell,
        [Math.cos(a) * (rBot + .01), bot + .05, Math.sin(a) * (rBot + .01)],
        [Math.cos(a) * (rTop + .01), top - .05, Math.sin(a) * (rTop + .01)],
        .008, s.mat.trim);
    }

    // Upper ring of 8 pneumatic air-hammers + circular air header pipe + blue/black hoses
    const hammerY = 4.38, rHam = rBot + (rTop - rBot) * (hammerY - bot) / coneH;
    const ringY = 3.82, rRing = rBot + (rTop - rBot) * (ringY - bot) / coneH + .08;
    s._ring(accessories, rRing, ringY, s.mat.trim, .022);
    for (let i = 0; i < 8; i++) {
      const a = (i + .5) / 8 * TAU, ca = Math.cos(a), sa = Math.sin(a);
      const pad = s._box(accessories, [.18, .24, .06], [ca * (rHam + .03), hammerY, sa * (rHam + .03)], s.mat.trim);
      pad.rotation.y = -a + PI / 2;
      const knocker = s._cyl(accessories, .055, .20, [ca * (rHam + .13), hammerY + .02, sa * (rHam + .13)], s.mat.steel, .055, 12);
      knocker.rotation.z = -ca * .45; knocker.rotation.x = sa * .45;
      s._bar(accessories, [ca * (rRing - .08), ringY, sa * (rRing - .08)], [ca * rRing, ringY, sa * rRing], .014, s.mat.trim);
      curvedTube(s, accessories, [
        [ca * rRing, ringY, sa * rRing],
        [ca * (rRing + .12), (ringY + hammerY) / 2 - .08, sa * (rRing + .12)],
        [ca * (rHam + .14), hammerY, sa * (rHam + .14)],
      ], .011, i % 2 ? ex.blueHose : s.mat.black, 12, 6);
    }

    // Left/North thick stainless exhaust elbow from ceiling into cone side + sight port + Y-support leg
    const elbowCurve = curvedTube(s, sideDuct, [
      [-1.95, 5.9, -2.95], [-1.95, 3.25, -2.95], [-1.82, 2.42, -2.78], [-1.32, 2.22, -2.42], [-.72, 2.22, -1.95],
    ], .46, s.mat.steel, 32, 24);
    elbowCurve.name = 'dryer-5f-cone-side-elbow-duct';
    for (const y of [3.5, 4.5, 5.4]) {
      const r = s._ring(sideDuct, .475, y, s.mat.trim, .016); r.position.set(-1.95, y, -2.95);
    }
    sightPort(s, sideDuct, [-1.42, 2.22, -2.92], .17, 'z');
    // Lower branch support column & Y-boot on green concrete curb (card 23 FRONT)
    s._box(sideDuct, [1.55, .16, .88], [-1.95, .08, -2.95], ex.curb);
    s._box(sideDuct, [1.42, .035, .76], [-1.95, .175, -2.95], ex.floorPlate);
    s._cyl(sideDuct, .21, 1.65, [-1.95, 1.02, -2.95], s.mat.steel, .21, 22);
    for (const fy of [.58, 1.12, 1.62]) {
      const f = s._ring(sideDuct, .235, fy, s.mat.trim, .016); f.position.set(-1.95, fy, -2.95);
    }
    curvedTube(s, sideDuct, [[-1.95, .56, -2.95], [-1.72, .32, -2.95], [-1.52, .18, -2.95]], .15, s.mat.steel, 12, 14);

    // Right/NE separate thick vertical duct -> conical reducer -> valve -> angled entry into floor trench plate (card 23 RIGHT)
    const rx = 2.45, rz = -2.85;
    curvedTube(s, rightDuct, [[rx, 5.92, rz - .45], [rx, 3.85, rz - .42], [rx, 2.75, rz]], .50, s.mat.steel, 24, 24);
    s._cyl(rightDuct, .50, .72, [rx, 2.42, rz], s.mat.steel, .26, 28);
    s._cyl(rightDuct, .26, 1.18, [rx, 1.48, rz], s.mat.steel, .26, 24);
    for (const fy of [2.06, 1.56, .92]) {
      const f = s._ring(rightDuct, .29, fy, s.mat.trim, .018); f.position.set(rx, fy, rz);
    }
    // Yellow-cap angled actuator valve on the lower vertical spool
    const act = s._group(rightDuct, [rx - .28, 1.46, rz + .12]); act.rotation.z = .55;
    s._cyl(act, .065, .22, [0, .12, 0], s.mat.trim, .065, 12);
    s._cyl(act, .072, .10, [0, .27, 0], s.mat.yellow, .072, 12);
    // Angled pipe plunging into steel floor trench cover plate
    curvedTube(s, rightDuct, [[rx, .90, rz], [rx, .48, rz + .12], [rx, .06, rz + .36]], .24, s.mat.steel, 16, 20);
    s._box(rightDuct, [.92, .06, 2.35], [rx, .03, rz + .55], ex.floorPlate);
    s._box(rightDuct, [.48, .08, .58], [rx, .042, rz + .28], s.mat.black);
    return;
  }
  const radius = isCone ? item.radius || 2.85 : 2.85;
  const top = isCone ? item.height || 7.05 : 7.15;
  const coneBottom = 1.25;
  const shell = part(s, root, item.parts[0], [-1.5, .4, 0]);
  s._cyl(shell, radius, isCone ? top - coneBottom : 7.15, [0, isCone ? (top + coneBottom) / 2 : 3.8, 0], s.mat.steel, isCone ? .5 : radius, 48);
  const band = part(s, root, item.parts[1], [0, 1, 0]);
  if (isCone) {
    s._cyl(band, .5, .85, [0, .85, 0], s.mat.trim, .5, 28);
    if (item.id !== 'f5-dryer-cone') motor(s, band, [.7, .65, 0], .28, .7);
    s._ring(shell, radius + .02, top - .01, s.mat.trim, .055);
  } else {
    for (const y of [.3, 2.65, 5, 7.3]) s._ring(band, 2.88, y, s.mat.trim, .05);
  }
  const supports = part(s, root, item.parts[2], [1.2, 0, -.6]);
  if (isCone) {
    for (const x of [-radius, radius]) for (const z of [-radius * .7, radius * .7]) { s._box(supports, [.23, top - .2, .23], [x, (top - .2) / 2, z], s.mat.trim); s._box(supports, [.6, .15, .6], [x, .08, z], s.mat.dark); }
    for (const z of [-radius * .7, radius * .7]) s._bar(supports, [-radius, .8, z], [radius, top - 1, z], .06, s.mat.trim);
  } else pipe(s, supports, [[-2.92, .3, 0], [-2.92, 7.2, 0], [-2.1, 7.2, 0]], .12);
  const inspection = part(s, root, item.parts[3], [0, .2, 1.5]);
  const doorY = isCone ? top * .66 : 3.6, doorZ = isCone ? .5 + (radius - .5) * (doorY - coneBottom) / (top - coneBottom) : 2.87;
  s._box(inspection, [1.05, 1.1, .16], [0, doorY, doorZ], s.mat.trim);
  s._bar(inspection, [.3, doorY - .3, doorZ + .13], [.3, doorY + .25, doorZ + .13], .035, s.mat.dark);
}

function cycloneBank(s, root, item) {
  const cones = part(s, root, item.parts[0], [0, 1, 0]);
  for (const z of [-5, 0, 5]) {
    s._cyl(cones, 1.72, 5.55, [0, 4.45, z], s.mat.steel, .27, 36);
    const g = s._group(cones, [0, 0, z]); s._ring(g, 1.74, 7.22, s.mat.trim, .045);
  }
  const valves = part(s, root, item.parts[1], [1, 0, 0]);
  for (const z of [-5, 0, 5]) { s._cyl(valves, .3, .8, [0, 1.28, z], s.mat.trim, .3, 20); motor(s, valves, [.5, 1.2, z], .23, .6); }
  const frame = part(s, root, item.parts[2], [-1, 0, 0]);
  for (const z of [-6.6, -3.4, -1.6, 1.6, 3.4, 6.6]) for (const x of [-1.65, 1.65]) s._box(frame, [.15, 7.05, .15], [x, 3.52, z], s.mat.trim);
  for (const z of [-5, 0, 5]) { s._box(frame, [3.55, .2, 3.55], [0, 7, z], s.mat.dark); s._bar(frame, [-1.65, .4, z - 1.6], [1.65, 6.7, z - 1.6], .05, s.mat.trim); }
  const lines = part(s, root, item.parts[3], [0, .2, 1]);
  pipe(s, lines, [[0, .8, -5], [0, .8, 5]], .18);
}

function recoveryManifold(s, root, item) {
  // Cards 27(5), 28(4), 29(3) + 30(2): 3 full-height slender cyclone cones seated on
  // square green concrete curbs with white plates, Roots blower beside #28, white
  // 2-window booth in front of #27, and suspended drum #30 beside the north shutter.
  const ex = extraPalette(s);
  const stations = item.stations || [-3, 0, 3], coneBottom = .22, coneTop = 6.0, coneRadius = 1.2, botRadius = .22;
  const cones = part(s, root, item.parts?.[0] || '싸이클론 3개 긴 하부 콘·점검구', [0, .8, -.5]);
  const rootsUnit = part(s, root, item.parts?.[1] || '루츠 블로워·흡입·수평 사일런서', [-.9, .2, 0]);
  const booth = part(s, root, item.parts?.[2] || '전면 백색 판넬 부스·조작반', [.8, .2, .4]);
  const suspended = part(s, root, item.parts?.[3] || '셔터 옆 매달린 원통·부채꼴 사각 덕트', [.7, .4, -.7]);

  for (const [idx, z] of stations.entries()) {
    // Square green concrete pedestal + white steel top plate (no stilts)
    s._box(cones, [.94, .19, .94], [0, .095, z], ex.curb);
    s._box(cones, [.78, .038, .78], [0, .205, z], s.mat.white);
    const cone = s._cyl(cones, coneRadius, coneTop - coneBottom, [0, (coneTop + coneBottom) / 2, z], ex.stained, botRadius, 48);
    cone.name = 'dryer-recovery-long-cone';
    Object.assign(cone.userData, { station: z, topY: coneTop, bottomY: coneBottom, source: 'field-cards-27-28-29-20261124' });
    // Top ceiling collar + 4 horizontal/spiral seam bands
    const g = s._group(cones, [0, 0, z]);
    s._ring(g, coneRadius + .03, coneTop - .04, s.mat.trim, .032);
    for (const y of [1.55, 2.75, 3.95, 5.10]) {
      const r = botRadius + (coneRadius - botRadius) * (y - coneBottom) / (coneTop - coneBottom);
      s._ring(g, r + .009, y, s.mat.trim, .014);
    }
    // Round inspection port with blue-tipped latch bar (y ≈ 1.48)
    const rPort = botRadius + (coneRadius - botRadius) * (1.48 - coneBottom) / (coneTop - coneBottom);
    sightPort(s, g, [0, 1.48, idx === 0 ? -rPort : rPort], .135, 'z');
    // Pneumatic knocker assembly on mounting pad + curved blue polyurethane air hose
    const ky = 1.08, rk = botRadius + (coneRadius - botRadius) * (ky - coneBottom) / (coneTop - coneBottom);
    s._box(g, [.04, .28, .20], [rk + .02, ky, 0], s.mat.trim);
    for (const dy of [-.05, .05]) {
      const cyl = s._cyl(g, .036, .22, [rk + .13, ky + dy, 0], s.mat.steel, .036, 10);
      cyl.rotation.z = -PI / 2.6;
    }
    curvedTube(s, g, [[rk + .21, ky - .04, 0], [rk + .30, .58, .12], [.42, .22, .34]], .009, ex.blueHose, 14, 6);
  }
  // Conveying line linking the cyclone outlets at floor level
  pipe(s, cones, [[.36, .34, stations[0]], [.36, .34, stations[2]]], .075, s.mat.steel);

  // Card 28(4): Roots blower + yellow mesh belt cover + vertical intake silencer (2 white caps) + horizontal silencer
  const rx = -1.18, rz = .15;
  const rGroup = s._group(rootsUnit, [rx, 0, rz]); rGroup.name = 'dryer-5f-roots-blower';
  s._box(rGroup, [1.18, .12, .88], [0, .06, 0], ex.curb);
  s._box(rGroup, [1.08, .08, .78], [0, .16, 0], s.mat.trim);
  // Dark gray blower casing + electric motor
  s._box(rGroup, [.46, .48, .42], [.18, .44, -.08], ex.rootsGray);
  s._cyl(rGroup, .18, .46, [-.28, .38, -.08], ex.rootsGray, .18, 18).rotation.z = PI / 2;
  // Yellow perforated/mesh guard at front
  s._box(rGroup, [.96, .46, .26], [-.04, .43, .24], s.mat.yellow);
  s._box(rGroup, [.88, .34, .02], [-.04, .43, .375], s.mat.dark);
  for (const mx of [-.34, 0, .28]) s._box(rGroup, [.035, .44, .03], [mx, .43, .38], s.mat.yellow);
  // Vertical gray cylindrical intake silencer + 2-stage white filter caps on top
  s._cyl(rGroup, .135, .86, [.18, 1.12, -.08], ex.insulation, .135, 20);
  s._cyl(rGroup, .155, .10, [.18, 1.60, -.08], s.mat.white, .155, 20);
  s._cyl(rGroup, .155, .10, [.18, 1.74, -.08], s.mat.white, .155, 20);
  s._cyl(rGroup, .13, .04, [.18, 1.67, -.08], s.mat.dark, .13, 16);
  // Horizontal silencer cylinder connecting toward cyclone base pipe
  const hSil = s._cyl(rGroup, .125, .72, [.74, .44, -.08], ex.insulation, .125, 20); hSil.rotation.z = PI / 2;
  pipe(s, rGroup, [[1.10, .44, -.08], [1.54, .34, -.08]], .065, s.mat.trim);

  // Card 27(5): White insulated panel booth (2-tier windows, lower vent louver, side sloped control cabinet)
  const bx = 1.82, bz = 2.55;
  const bGroup = s._group(booth, [bx, 0, bz]); bGroup.name = 'dryer-5f-white-panel-booth';
  s._box(bGroup, [1.58, .08, 1.48], [0, .04, 0], ex.curb);
  s._box(bGroup, [1.52, 2.58, 1.42], [0, 1.37, 0], ex.boothPanel);
  s._box(bGroup, [1.56, .06, 1.46], [0, 2.68, 0], s.mat.trim);
  // Vertical sandwich panel seams & corner aluminum extrusions
  for (const sx of [-.762, .762]) for (const sz of [-.712, .712]) s._box(bGroup, [.04, 2.60, .04], [sx, 1.37, sz], s.mat.trim);
  for (const zSeam of [-.24, .24]) for (const sx of [-.762, .762]) s._box(bGroup, [.008, 2.56, .012], [sx, 1.37, zSeam], s.mat.trim);
  // 2-tier dark-glazed windows on cyclone face (-X), aisle face (+X), and north face (-Z)
  for (const [wy, wh] of [[2.12, .54], [1.26, .48]]) {
    for (const sx of [-1, 1]) {
      s._box(bGroup, [.018, wh + .06, .56], [sx * .762, wy, 0], s.mat.trim);
      s._box(bGroup, [.022, wh, .50], [sx * .766, wy, 0], s.mat.dark);
      s._box(bGroup, [.026, wh - .02, .48], [sx * .770, wy, 0], ex.boothGlass);
    }
    s._box(bGroup, [.56, wh + .06, .018], [-.12, wy, -.712], s.mat.trim);
    s._box(bGroup, [.50, wh, .022], [-.12, wy, -.716], s.mat.dark);
    s._box(bGroup, [.48, wh - .02, .026], [-.12, wy, -.720], ex.boothGlass);
  }
  // Door leaf outline & lever handle on -X and +X + lower ventilation louver grille
  for (const sx of [-1, 1]) {
    s._box(bGroup, [.014, 1.78, .78], [sx * .763, .98, 0], s.mat.trim);
    s._box(bGroup, [.016, 1.72, .72], [sx * .765, .98, 0], ex.boothPanel);
    s._box(bGroup, [.022, .48, .48], [sx * .770, 1.26, 0], s.mat.dark);
    s._box(bGroup, [.026, .46, .46], [sx * .774, 1.26, 0], ex.boothGlass);
    s._bar(bGroup, [sx * .79, .98, -.30], [sx * .79, .98, -.18], .014, s.mat.dark);
  }
  for (let i = 0; i < 5; i++) s._box(bGroup, [.34, .018, .025], [.38, .34 + i * .045, -.72], s.mat.trim);
  // Side-mounted gray sloped-top control panel cabinet
  const cab = s._group(bGroup, [-.22, 1.18, -.88]);
  s._box(cab, [.56, .88, .32], [0, 0, 0], ex.insulation);
  for (const lx of [-.14, 0, .14]) for (const ly of [.18, .04]) {
    s._cyl(cab, .016, .02, [lx, ly, -.165], ly > .1 ? s.mat.red : s.mat.mint, .016, 10).rotation.x = PI / 2;
  }
  s._bar(cab, [-.12, -.44, 0], [-.12, -1.14, 0], .022, s.mat.dark);
  s._bar(cab, [.12, -.44, 0], [.12, -1.14, 0], .022, s.mat.dark);

  // Card 30(2): Suspended cylindrical separator beside north shutter + fan-ribbed rectangular elbow duct
  const sx = 4.75, sz = -5.45;
  const sGroup = s._group(suspended, [sx, 0, sz]); sGroup.name = 'dryer-5f-suspended-cylinder';
  // Suspended cylinder (y = 2.08..5.78) + shallow conical bottom (apex at y = 1.48, clear of floor)
  s._cyl(sGroup, 1.06, 3.70, [0, 3.93, 0], s.mat.steel, 1.06, 48);
  s._cyl(sGroup, 1.06, .60, [0, 1.78, 0], s.mat.steel, .08, 48);
  for (const y of [2.08, 3.35, 4.62, 5.74]) s._ring(sGroup, 1.072, y, s.mat.trim, .016);
  // Fan-segmented rectangular duct sweeping down from ceiling into side of cylinder + round inspection port
  const segPts = [[-1.65, 5.65], [-1.52, 4.65], [-1.22, 3.85], [-.72, 3.35], [-.12, 3.18]];
  for (let i = 1; i < segPts.length; i++) {
    const [x0, y0] = segPts[i - 1], [x1, y1] = segPts[i];
    const len = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(y1 - y0, x1 - x0);
    const seg = s._box(sGroup, [len + .06, .74, .68], [(x0 + x1) / 2, (y0 + y1) / 2, .88], s.mat.steel);
    seg.rotation.z = ang;
    const rib = s._box(sGroup, [.04, .82, .76], [x0, y0, .88], s.mat.trim);
    rib.rotation.z = ang;
  }
  s._box(sGroup, [.88, .74, .68], [.34, 3.18, .88], s.mat.steel);
  sightPort(s, sGroup, [-.56, 3.42, 1.23], .18, 'z');
  // Floor support pipe on square green curb + diagonal drain pipe from shallow cone apex
  s._box(sGroup, [.62, .18, .62], [-.56, .09, 0], ex.curb);
  s._cyl(sGroup, .115, 1.78, [-.56, 1.06, 0], s.mat.steel, .115, 20);
  s._ring(sGroup, .155, 1.78, s.mat.trim, .018).position.set(-.56, 1.78, 0);
  s._bar(sGroup, [0, 1.48, 0], [-.52, .38, 0], .028, s.mat.steel);

  Object.assign(root.userData, {
    sourceBasis: 'field-cards-27-28-29-30-20261124',
    currentFieldPhotoVerified: true,
    coneCount: stations.length,
    coneTopY: coneTop,
    coneBottomY: coneBottom,
    hasRootsBlower: true,
    hasWhiteBooth: true,
    hasSuspendedCylinder: true,
    concealedMechanismsAdded: false,
  });
}

function ductRiser(s, root, item) {
  const h = item.height || 6.5, r = item.radius || .45;
  const bottom = Math.max(.3, r + .08);
  const riser = part(s, root, item.parts[0], [-1, 0, 0]);
  s._cyl(riser, r, h - .5, [0, h / 2, 0], s.mat.steel, r, 28);
  for (const y of [.3, h / 2, h - .3]) s._ring(riser, r + .035, y, s.mat.trim, .035);
  const ends = part(s, root, item.parts[1], [1, .7, 0]);
  pipe(s, ends, [[0, bottom, 0], [1.7, bottom, 0]], r);
  pipe(s, ends, [[0, h - .3, 0], [-2.5, h - .3, 0]], r);
  const support = part(s, root, item.parts[2], [0, 0, 1]);
  for (const y of [1.2, h - 1.2]) { s._bar(support, [0, y, 0], [0, y, -1.35], .07, s.mat.dark); s._box(support, [.55, .4, .16], [0, y, -1.4], s.mat.trim); }
}

const BUILDERS = Object.freeze({
  tank, packing, xray, conveyor, palletizer, homogenizer, hopper,
  'utility-tanks': utilityTanks, 'process-skid': processSkid,
  'fluid-bed': fluidBed, 'fine-return': fineReturn,
  'service-pump': servicePump, 'dryer-body': dryerBody,
  'cyclone-bank': cycloneBank, 'recovery-manifold': recoveryManifold,
  'duct-riser': ductRiser,
});

export function buildFacilityEquipment(scene, root, item) {
  const builder = BUILDERS[item.type];
  if (!builder) return false;
  builder(scene, root, item);
  return true;
}
