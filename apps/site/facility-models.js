// Procedural OWP-inspired lower-floor equipment. All render resources are made
// through FacilityScene helpers so normal picking, disassembly and disposal work.
const PI = Math.PI;

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
  const stations = item.stations || [-3, 0, 3], coneBottom = 2.2, coneTop = 6, coneRadius = 1.2;
  const cones = part(s, root, '싸이클론 3개 긴 하부 콘·볼트 이음', [0, .8, -.5]);
  const drives = part(s, root, '네 곳 외부 구동 모터·노란 커플링', [-.8, .1, 0]);
  const outlets = part(s, root, '사각 배출·전이 외함 네 곳', [.6, .15, 0]);
  const supports = part(s, root, '콘 지지 다리·발판·가새', [0, -.15, .8]);
  function flange(parent, radius, y, z) {
    s._cyl(parent, radius, .07, [0, y, z], s.mat.trim, radius, 32);
    for (let i = 0; i < 12; i++) { const a = i * PI / 6; s._cyl(parent, .022, .035, [Math.cos(a) * radius * .88, y + .05, z + Math.sin(a) * radius * .88], s.mat.trim, .022, 6); }
  }
  for (const z of stations) {
    const cone = s._cyl(cones, coneRadius, coneTop - coneBottom, [0, (coneTop + coneBottom) / 2, z], s.mat.steel, .25, 40);
    cone.name = 'dryer-recovery-long-cone'; Object.assign(cone.userData, { station: z, topY: coneTop, bottomY: coneBottom, source: 'historical-OWP-floor5-7' });
    flange(cones, coneRadius + .035, coneTop - .04, z); flange(cones, .31, coneBottom + .015, z);
    for (const y of [3.4, 4.8]) { const r = .25 + (coneRadius - .25) * (y - coneBottom) / (coneTop - coneBottom); const ring = s._group(cones, [0, 0, z]); s._ring(ring, r + .01, y, s.mat.trim, .018); }
    for (const x of [-1.11, 1.11]) for (const dz of [-1.11, 1.11]) {
      s._box(supports, [.09, 5.85, .09], [x, 2.955, z + dz], s.mat.trim); s._box(supports, [.3, .06, .3], [x, .03, z + dz], s.mat.trim);
    }
    for (const dz of [-1.11, 1.11]) s._bar(supports, [-1.11, .22, z + dz], [1.11, 4.9, z + dz], .03, s.mat.trim);
  }
  function driveTrain(x, z, compact = false) {
    const unit = s._group(drives, [x, 0, z]); unit.name = 'dryer-recovery-drive-train';
    Object.assign(unit.userData, { station: compact ? 'main-chamber' : z, source: 'historical-OWP-floor5-7', concealedRotorAdded: false });
    const y = compact ? .34 : 1.62, radius = compact ? .18 : .24, length = compact ? .62 : .78;
    s._box(unit, [compact ? .5 : .65, compact ? .32 : .54, compact ? .5 : .65], [0, y, 0], s.mat.trim);
    const neckY = compact ? .56 : 2.025, neckH = compact ? .16 : .35, neckRadius = compact ? .38 : .25;
    s._cyl(unit, neckRadius, neckH, [0, neckY, 0], s.mat.steel, .25, 24);
    const gear = s._cyl(unit, radius * .9, .22, [-.4, y, 0], s.mat.trim, radius * .9, 20); gear.rotation.z = PI / 2;
    const coupling = s._cyl(unit, radius * .65, .17, [-.57, y, 0], s.mat.yellow, radius * .65, 16); coupling.rotation.z = PI / 2;
    s._box(unit, [.18, radius * 1.5, radius * 1.65], [-.57, y, 0], s.mat.yellow);
    const motorBody = motor(s, unit, [-.73 - length / 2, y, 0], radius, length); motorBody.name = 'dryer-recovery-visible-motor';
    s._box(unit, [length + .2, .055, radius * 1.8], [-.73 - length / 2, y - radius - .035, 0], s.mat.trim);
    for (const px of [-.8, -.65 - length]) s._box(unit, [.1, Math.max(.08, y - radius - .08), .1], [px, Math.max(.08, y - radius - .08) / 2, 0], s.mat.trim);
    const box = s._group(outlets, [x, 0, z]); box.name = 'dryer-recovery-box-outlet';
    const height = compact ? .34 : 1.27, centreY = compact ? .19 : .68;
    const transition = s._box(box, [compact ? .6 : .85, height, compact ? .52 : .8], [.55, centreY, 0], s.mat.steel);
    // The external sloping sheet is visible in the historic view; no rotary
    // blades, seals, transport internals or operating sequence are invented.
    const vertices = transition.geometry.attributes.position;
    for (let i = 0; i < vertices.count; i++) if (vertices.getY(i) > 0 && vertices.getX(i) < 0) vertices.setY(i, vertices.getY(i) - height * .25);
    vertices.needsUpdate = true; transition.geometry.computeVertexNormals(); transition.geometry.computeBoundingBox(); transition.geometry.computeBoundingSphere();
    s._box(box, [compact ? .66 : .91, .04, compact ? .58 : .86], [.55, .04, 0], s.mat.trim);
    s._box(box, [compact ? .35 : .52, .05, .025], [.55, compact ? .26 : 1.06, compact ? .273 : .413], s.mat.trim);
    return unit;
  }
  for (const z of stations) driveTrain(0, z);
  const mainOffset = item.mainChamberOffset || [2.4, 0, 12.8]; driveTrain(mainOffset[0], mainOffset[2], true);
  Object.assign(root.userData, {
    sourceBasis: 'historical-OWP-floor5-7;not-current-asbuilt', currentVideoCountConfirmed: false,
    coneCount: stations.length, driveTrainCount: stations.length + 1, coneTopY: coneTop, coneBottomY: coneBottom,
    mainChamberConnection: { offset: [...mainOffset], existingNeckRange: [.425, 1.275], compactUnitTop: .64 },
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
