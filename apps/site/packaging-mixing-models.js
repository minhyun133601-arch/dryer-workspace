import * as THREE from '../shared/vendor/three.module.js';
import { PartKit, frustum, packagingMaterials, textPlate } from './packaging-kit.js';

// 2팀 3층 배합·원료 공급 설비. 배치는 3층 위치도와 A-07, 외형은 9동 설비카드의
// 현장 사진(로타리1·버티컬1·버티컬2·로타리2 믹싱기, 스틱 무중력 믹서기, 시브·호퍼,
// 항온항습기, 진동채)이다. 로컬 +X 정면(동), -Z 북, Y=0 바닥.
const PI = Math.PI, TAU = PI * 2;

function partKits(s, root, item, offsets = [[-1, .3, 0], [0, 1.5, 0], [1, .3, .4]]) {
  return item.parts.map((name, i) => {
    const group = s._part(root, name, offsets[i]);
    group.name = `${item.id}-v3-part-${i + 1}`;
    return new PartKit(s, group, `${item.type}-${['body', 'process', 'detail'][i]}`);
  });
}
const finish = kits => kits.forEach(kit => kit.flush());

function handle(kit, mat, center, width, axis = 'z', depth = .06, out = [1, 0, 0], r = .012) {
  const v = i => (axis === 'z' ? [0, 0, i * width / 2] : axis === 'x' ? [i * width / 2, 0, 0] : [0, i * width / 2, 0]);
  const add = (a, b) => a.map((n, i) => n + b[i]);
  const ends = [-1, 1].map(i => add(center, v(i))), far = ends.map(p => add(p, out.map(n => n * depth)));
  kit.rods(mat, [[ends[0], far[0]], [ends[1], far[1]], [far[0], far[1]]], r, { seg: 8 });
}

// Toggle latch: base plate, over-centre lever and hook.
function toggle(kit, m, position, rotation = [0, 0, 0], lever = 'ssEdge') {
  const k = kit.at(position, rotation);
  k.box(m.ssDark, [.012, .1, .05], [.006, 0, 0]);
  k.box(m[lever], [.02, .12, .03], [.028, -.015, 0], [0, 0, -.22]);
  k.rod(m.ssEdge, [.022, .05, -.016], [.022, .05, .016], .011);
}

// Door clamp: round base on the frame, hook over the edge and a lever lying along it.
function clampLever(kit, m, position, rotation = [0, 0, 0]) {
  const k = kit.at(position, rotation);
  k.cyl(m.ssDark, .03, .024, [.012, 0, 0], { axis: 'x', seg: 14 });
  k.box(m.ssEdge, [.022, .06, .036], [.022, -.034, 0]);
  k.rod(m.ssPolished, [.036, 0, -.012], [.05, .016, .13], .012); k.ball(m.ssPolished, [.017, .017, .017], [.05, .016, .13]);
}

// Open-top bent sheet hung from an edge; a few folds keep it from reading as a board.
function curtain(kit, material, from, to, top, bottom, flare, name) {
  const nx = 18, ny = 6, positions = [], index = [];
  const dx = to[0] - from[0], dz = to[1] - from[1], length = Math.hypot(dx, dz), out = [dz / length, -dx / length];
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const t = i / nx, v = j / ny, fold = Math.sin(t * TAU * 2.5 + v * 1.4) * .028 * (.35 + v) + flare * v * v * (1 - .25 * Math.sin(t * PI));
    positions.push(from[0] + dx * t + out[0] * fold, top + (bottom - top) * v + Math.sin(t * TAU * 1.5) * .025 * v, from[1] + dz * t + out[1] * fold);
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i; index.push(a, a + 1, a + nx + 1, a + 1, a + nx + 2, a + nx + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); g.setIndex(index); g.computeVertexNormals();
  kit.mesh(g, material, [0, 0, 0], [0, 0, 0], { name, shadow: false, pick: false, order: 2 });
}

// Horizontal drive along Z: shell, fins, fan cowl, terminal box and feet.
function motorZ(kit, m, [x, y, z], mat, length = .5, radius = .16, fan = 1) {
  kit.cyl(mat, radius, length, [x, y, z], { axis: 'z', seg: 22 });
  kit.cyl(m.ssDark, radius * 1.03, length * .16, [x, y, z + fan * length * .52], { axis: 'z', seg: 22 });
  for (let i = 0; i < 14; i++) {
    const a = i * TAU / 14; if (a > PI * 1.3 && a < PI * 1.7) continue;
    kit.box(mat, [.013, .05, length * .74], [x + Math.cos(a) * radius, y + Math.sin(a) * radius, z], [0, 0, a - PI / 2]);
  }
  for (let i = -2; i <= 2; i++) kit.box(m.ssEdge, [.012, radius * 1.5, .01], [x + i * radius * .32, y, z + fan * (length * .6 + .006)], undefined, { shadow: false });
  kit.box(mat, [radius * 1.05, radius * .62, length * .34], [x, y + radius * 1.18, z - fan * length * .08]);
  for (const side of [-1, 1]) kit.box(m.frame, [radius * .42, radius * .36, length * .6], [x + side * radius * .72, y - radius * .98, z]);
}

function suspendedHood(s, kit, m, { x, z, w, d, bottom, skirt, ductTop, sign, signFace = 1, lights = false, branch = -1 }) {
  const base = bottom + skirt, collar = ductTop - .36, rise = Math.max(.2, collar - base);
  kit.mesh(frustum(.38, .38, w, d, rise), m.ss, [x, base, z], [0, 0, 0], { name: 'packaging-hood-truncated-pyramid-canopy' });
  for (const side of [-1, 1]) {
    kit.box(m.ss, [.022, skirt, d], [x + side * w / 2, bottom + skirt / 2, z], undefined, { name: 'packaging-hood-folded-skirt' });
    kit.box(m.ss, [w, skirt, .022], [x, bottom + skirt / 2, z + side * d / 2], undefined, { name: 'packaging-hood-folded-skirt' });
    kit.box(m.ssEdge, [.035, .02, d + .03], [x + side * w / 2, bottom + .01, z]); kit.box(m.ssEdge, [w + .03, .02, .035], [x, bottom + .01, z + side * d / 2]);
    for (const end of [-1, 1]) {
      kit.box(m.ssEdge, [.07, skirt + .16, .012], [x + side * (w / 2 - .02), bottom + skirt / 2 + .06, z + end * (d / 2 + .012)], undefined, { name: 'packaging-hood-corner-brackets' });
      kit.rod(m.ssEdge, [x + side * (w / 2 - .03), base + .12, z + end * (d / 2 - .02)], [x + side * (w / 2 - .03), ductTop + .34, z + end * (d / 2 - .02)], .008, { name: 'packaging-hood-suspension-rods', seg: 6 });
    }
  }
  // Raised ribs along the four hip seams of the pyramid.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.rod(m.ssEdge, [x + sx * w / 2, base, z + sz * d / 2], [x + sx * .19, base + rise, z + sz * .19], .012);
  if (lights) for (const side of [-1, 1]) kit.cyl(m.lamp, .075, .025, [x + signFace * (w / 2 - .22), base - .03, z + side * (d / 2 - .22)], { seg: 18 });
  const neck = Math.max(.04, ductTop - .2 - base - rise);
  kit.cyl(m.duct, .15, neck, [x, base + rise + neck / 2, z], { seg: 22 });
  kit.mesh(new THREE.TorusGeometry(.2, .15, 10, 14, PI / 2), m.duct, [x + branch * .2, ductTop - .2, z], [0, branch > 0 ? PI : 0, 0], { name: 'packaging-hood-smooth-duct-elbow' });
  kit.cyl(m.duct, .15, .22, [x + branch * .31, ductTop, z], { axis: 'x', seg: 22 });
  kit.ring(m.ssEdge, .153, .008, [x, base + rise + .03, z]);
  kit.ring(m.ssEdge, .153, .008, [x + branch * .4, ductTop, z], [0, PI / 2, 0]);
  if (sign) {
    const plate = s._group(kit.group, [x + signFace * (w / 2 + .015), bottom + skirt / 2, z]); plate.rotation.y = signFace * PI / 2;
    textPlate(s, plate, sign, { width: .46, height: .25, position: [0, 0, .004], background: '#fbfbf8', top: '#25306b', bottom: '#7fbf3f', name: 'packaging-hood-line-nameplate' });
  }
}

// Under-deck pyramid with bolted access door, valve, sleeve and floor curb.
function underDeckDischarge(kit, m, deck, w = 1.15, d = 1.25, x = 0, z = 0) {
  const high = deck - .06, low = 1.02, h = high - low;
  kit.mesh(frustum(w, d, .3, .32, h), m.ss, [x, low, z], [0, 0, 0], { name: 'packaging-underdeck-inverted-square-hopper' });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) kit.rod(m.ssEdge, [x + sx * w / 2, high, z + sz * d / 2], [x + sx * .15, low, z + sz * .16], .014);
  kit.box(m.ssEdge, [w + .1, .04, d + .1], [x, high - .01, z]);
  const tilt = Math.atan((w - .3) / 2 / h), k = kit.at([x + (w + .3) / 4 + .012, (high + low) / 2, z], [0, 0, -tilt]);
  k.box(m.ssEdge, [.03, h * .62, d * .52], [0, 0, 0]); k.box(m.ss, [.02, h * .54, d * .45], [.02, 0, 0]);
  for (const py of [-.26, 0, .26]) for (const pz of [-.23, .23]) k.cyl(m.ssDark, .016, .03, [.03, py * h, pz * d], { axis: 'x', seg: 8 });
  k.cyl(m.black, .045, .03, [.045, 0, 0], { axis: 'x', seg: 12 });
  for (const a of [0, PI / 2]) k.box(m.ssEdge, [.02, .18, .024], [.06, 0, 0], [a, 0, 0]);
  kit.cyl(m.ssEdge, .2, .1, [x, .96, z], { seg: 24 }); kit.cyl(m.blue, .1, .24, [x + .27, .97, z], { axis: 'x', seg: 18 });
  kit.box(m.black, [.1, .12, .12], [x + .43, .97, z]);
  kit.cyl(m.white, .125, .62, [x, .58, z], { seg: 20 });
  for (const y of [.28, .5, .72, .87]) kit.ring(m.ssEdge, .132, .012, [x, y, z]);
  kit.tube(m.black, [[x + .4, .97, z + .05], [x + .5, .7, z + .14], [x + .36, .42, z + .2], [x + .2, .3, z + .16]], .02, { shadow: false });
  kit.box(m.ss, [.74, .045, .74], [x, .04, z]);
  for (const side of [-1, 1]) { kit.box(m.ss, [.03, .13, .74], [x + side * .355, .1, z]); kit.box(m.ss, [.74, .13, .03], [x, .1, z + side * .355]); }
}

// Two troughs side by side under a square charge box, as one extruded section.
function twinTrough(top, yc, r = .4, cx = .33, half = .56) {
  const shoulder = Math.acos((half - cx) / r), valley = Math.acos(cx / r), points = [[-half, top], [half, top]];
  const arc = (x, from, to) => { for (let i = 0; i <= 14; i++) { const t = from + (to - from) * i / 14; points.push([x + Math.cos(t) * r, yc + Math.sin(t) * r]); } };
  arc(cx, shoulder, valley - PI); arc(-cx, -valley, -PI - shoulder);
  return points;
}

// Opposite the chain drive, the November F-750 photos show a pair of short
// discharge actuators under folded bearing covers and air tubing to a valve box.
function f750DischargeActuators(kit, m, deck, length, metalDoor) {
  const end = kit.at([0, deck, -length / 2 - .04], [0, PI, 0]);
  for (const side of [-1, 1]) {
    end.box(m.ss, [.66, .04, .23], [side * .31, .4, .1], [0, 0, side * .28], { name: 'packaging-f750-folded-bearing-shields' });
    end.cyl(m.ssEdge, .085, .09, [side * .32, .25, .14], { axis: 'z' });
    end.cyl(m.ss, .067, .48, [0, .095, .2 + side * .09], { axis: 'x', name: 'packaging-f750-discharge-air-cylinders' });
    end.cyl(m.ssPolished, .021, .16, [side * .31, .095, .2 + side * .09], { axis: 'x' });
    for (const x of [-.24, .24]) end.box(m.black, [.035, .14, .14], [x, .095, .2 + side * .09]);
    end.tube(m.teal, [[.42, .68, .16], [.54, .55, .14], [side * .27, .34, .18], [side * .39, .14, .22]], .012, { shadow: false });
  }
  const box = end.at([.38, .78, .09]);
  box.box(m.ssEdge, [.4, .34, .17], [0, 0, 0], undefined, { name: 'packaging-f750-pneumatic-valve-box' });
  if (!metalDoor) {
    box.box(m.ssDark, [.36, .3, .014], [0, 0, .093]);
    for (const x of [-.09, .04]) {
      box.box(m.black, [.055, .09, .03], [x, -.035, .112]);
      box.tube(m.teal, [[x, -.04, .13], [x - .035, .075, .13], [x + .055, .095, .13], [x + .07, .025, .13]], .009, { shadow: false });
    }
    box.box(m.glass, [.37, .31, .012], [0, 0, .146], undefined, { pick: false, shadow: false });
  }
}

// F-750(본 작업대, front=+1)과 F-500(스틱, front=-1)은 같은 세지테크 계열이다.
function zeroGravityMixer(s, root, item) {
  const m = packagingMaterials(s), kits = partKits(s, root, item), [body, process, output] = kits;
  const stick = item.type === 'packaging-stick-mixer', f = stick ? -1 : 1, deck = item.platformHeight;
  const L = stick ? 1.3 : 1.46, top = deck + 1, yc = deck + .4, plate = stick ? 1.2 : 1.26;
  const X = x => x * f, flip = f < 0 ? [0, PI, 0] : [0, 0, 0];
  body.extrude(m.ss, twinTrough(top, yc), L, [0, 0, -L / 2], [0, 0, 0], { name: 'packaging-mixer-twin-trough-body' });
  for (const end of [-1, 1]) {
    body.box(m.ssEdge, [1.42, .72, .035], [0, deck + .42, end * (L / 2 + .012)], undefined, { name: 'packaging-mixer-flanged-end-plates' });
    body.box(m.ss, [1.16, .3, .03], [0, deck + .86, end * (L / 2 + .012)]);
    for (const x of [-.33, .33]) { body.cyl(m.ssEdge, .12, .07, [x, yc, end * (L / 2 + .06)], { axis: 'z', seg: 18 }); body.cyl(m.ssDark, .055, .16, [x, yc, end * (L / 2 + .1)], { axis: 'z', seg: 14 }); }
    for (const x of [-.6, .6]) body.box(m.frame, [.14, .3, .16], [x, deck + .15, end * (L / 2 - .12)]);
  }
  body.box(m.ssEdge, [plate, .022, L + .08], [0, top + .011, 0], undefined, { name: 'packaging-mixer-flat-top-plate' });
  for (const z of [-L / 2, L / 2]) for (let x = -.52; x <= .53; x += .208) body.cyl(m.ssDark, .012, .014, [x, top + .028, z], { seg: 6, shadow: false });
  for (const x of [-plate / 2 + .03, plate / 2 - .03]) for (let z = -L / 2 + .16; z < L / 2; z += .2) body.cyl(m.ssDark, .012, .014, [x, top + .028, z], { seg: 6, shadow: false });
  // Front: printed band, ledge and the leaning access door with its latches.
  body.box(m.ss, [.02, .25, L - .04], [X(.572), deck + .875, 0]);
  body.box(m.ssEdge, [.07, .026, L + .06], [X(.6), deck + .745, 0]);
  const front = [[.46, .2], [.86, .2], [.9, .24], [.665, .69], [.6, .735], [.46, .735]];
  body.extrude(m.ss, front, L - .08, [0, deck, -f * (L - .08) / 2], flip, { name: 'packaging-mixer-leaning-front-panel' });
  for (const z of [-L / 2 + .03, L / 2 - .03]) body.extrude(m.ssEdge, front.map(([x, y]) => [x + (x > .8 ? .03 : x > .62 ? .025 : 0), y]), .02, [0, deck, z - f * .01], flip, { name: 'packaging-mixer-front-gussets' });
  const k = body.at([X(.7825), deck + .465, 0], [0, f < 0 ? PI : 0, 0]).at([0, 0, 0], [0, 0, .4816]), dw = stick ? .94 : 1.04;
  k.box(m.ssEdge, [.02, .41, dw], [.01, -.008, 0], undefined, { name: 'packaging-mixer-front-inspection-door' });
  k.box(m.ssDark, [.012, .345, dw - .12], [.018, -.008, 0], undefined, { name: 'packaging-mixer-front-inspection-door' });
  k.box(m.ss, [.024, .33, dw - .135], [.024, -.008, 0], undefined, { name: 'packaging-mixer-front-inspection-door' });
  for (const z of [-1, 1]) k.box(m.ssEdge, [.05, .47, .016], [.025, 0, z * (dw / 2 + .06)]);
  handle(k, m.ssPolished, [.036, .03, 0], .2, 'z', .05);
  for (const z of [-.35, 0, .35]) clampLever(k, m, [.02, .195, z]);
  for (const [z, y] of [[-.5, -.03], [.5, -.09]]) clampLever(k, m, [.02, y, z * (dw / 1.04)], [z > 0 ? PI / 2 : -PI / 2, 0, 0]);
  for (const z of [-.35, 0, .35]) for (const e of [-.035, .035]) k.rods(m.ssEdge, [[[.02, -.17, z + e], [.06, -.2, z + e]], [[.06, -.2, z + e], [.02, -.235, z + e]]], .008, { seg: 6 });
  const tag = s._group(body.group, [X(.584), deck + .875, 0]); tag.rotation.y = f * PI / 2;
  textPlate(s, tag, stick ? 'F-500' : 'F-750', { width: .16, height: .1, position: [-.04, 0, .004], background: '#1b1e20', color: '#e7e7e2', border: '#8a8f90' });
  if (!stick) textPlate(s, tag, 'MY MACHINE CARD', { width: .3, height: .15, position: [-.46, 0, .004], background: '#fbfbf8', top: '#25306b' });

  // Charge opening on the top plate and its lid.
  const lidW = stick ? .72 : .76, lidL = stick ? 1.08 : .98, lidX = stick ? .04 : .06;
  process.box(m.ssDark, [lidW, .02, lidL], [X(lidX), top + .03, 0]);
  for (const side of [-1, 1]) { process.box(m.ss, [.035, .085, lidL + .04], [X(lidX) + side * lidW / 2, top + .06, 0]); process.box(m.ss, [lidW, .085, .035], [X(lidX), top + .06, side * lidL / 2]); }
  const hinge = [X(lidX - lidW / 2), top + .11, 0];
  const lid = process.at(hinge, [0, f < 0 ? PI : 0, 0]).at([0, 0, 0], [0, 0, item.lidOpen ? 1.82 : .012]);
  if (item.lidOpen) {
    for (const side of [-1, 1]) { lid.box(stick ? m.gold : m.ivory, [.05, .045, lidL], [side < 0 ? .025 : lidW - .025, 0, 0]); lid.box(stick ? m.gold : m.ivory, [lidW, .045, .05], [lidW / 2, 0, side * (lidL / 2 - .025)]); }
    lid.box(m.mesh, [lidW - .1, .008, lidL - .1], [lidW / 2, 0, 0], undefined, { shadow: false });
    for (let z = -lidL / 2 + .12; z < lidL / 2 - .05; z += .12) lid.rod(m.ssDark, [.05, .006, z], [lidW - .05, .006, z], .003, { seg: 5, shadow: false });
  } else {
    lid.box(m.ss, [lidW + .03, .035, lidL + .03], [lidW / 2, 0, 0], undefined, { name: 'packaging-mixer-hinged-charge-lid' });
    for (const side of [-1, 1]) lid.box(m.ssEdge, [lidW + .04, .05, .02], [lidW / 2, -.012, side * (lidL / 2 + .02)]);
    if (stick) for (const z of [-.3, .3]) handle(lid, m.ssEdge, [lidW - .14, .02, z], .16, 'z', .05, [0, 1, 0], .01);
  }
  if (!stick || !item.lidOpen) handle(lid, m.ssEdge, [lidW + .012, 0, 0], .22, 'z', .05, [1, 0, 0], .011);
  if (stick) {
    for (const z of [-.48, -.16, .16, .48]) toggle(process, m, [X(.588), deck + .93, z], [0, f < 0 ? PI : 0, 0]);
    if (item.lidOpen) { const tray = process.at([X(.2), top + .12, 0]); tray.box(m.ssPolished, [.5, .02, lidL - .12], [0, 0, 0]); for (const side of [-1, 1]) { tray.box(m.ssPolished, [.02, .12, lidL - .12], [side * .25, .06, 0]); tray.box(m.ssPolished, [.5, .12, .02], [0, .06, side * (lidL / 2 - .06)]); } }
    process.cyl(m.white, .17, .46, [X(-.42), top + .25, .36], { seg: 22, name: 'packaging-stick-mixer-white-cloth-vent' }); process.ring(m.ssEdge, .172, .012, [X(-.42), top + .04, .36]);
    process.cyl(m.ssEdge, .13, .07, [X(-.42), top + .06, -.38], { seg: 20 }); process.cyl(m.ss, .1, .03, [X(-.42), top + .11, -.38], { seg: 20 });
    const back = s._group(process.group, [X(-.585), deck + .86, -.2]); back.rotation.y = -f * PI / 2;
    textPlate(s, back, 'HALAL', { width: .26, height: .17, position: [0, 0, .006], background: '#ffffff', color: '#c62127', top: '#25306b', bottom: '#7fbf3f' });
  } else {
    for (const z of [-lidL / 2 - .02, lidL / 2 + .02]) { const t = process.at([X(.34), top + .12, z]); t.box(m.ssDark, [.05, .06, .03], [0, 0, 0]); t.box(m.red, [.03, .15, .03], [.02, .09, 0], [0, 0, -.35]); }
    process.cyl(m.white, .085, .24, [X(-.44), top + .14, .5], { seg: 16 });
    process.box(m.ssDark, [.12, .05, .06], [X(.44), top + .05, -lidL / 2 - .08]);
  }

  // Hood and the hung screens; the operator side stays open.
  const bottom = item.ductTop < 5.6 ? deck + 1.88 : deck + 2, skirt = stick ? .28 : .24, hw = 1.48, hd = stick ? 1.72 : 1.82;
  suspendedHood(s, process, m, { x: X(-.02), z: 0, w: hw, d: hd, bottom, skirt, ductTop: item.ductTop, sign: item.hoodSign, signFace: f, lights: stick, branch: f > 0 ? -1 : 1 });
  const sheet = m.clearCurtain, name = stick ? 'packaging-clear-stick-mixer-curtains' : 'packaging-f750-clear-extraction-curtains';
  const bx = X(-.02 - hw / 2), fx = X(-.02 + hw / 2), low = top - .06;
  curtain(process, stick ? sheet : m.amberCurtain, f > 0 ? [bx, hd / 2] : [bx, -hd / 2], f > 0 ? [bx, -hd / 2] : [bx, hd / 2], bottom + .04, low, .05, name);
  curtain(process, sheet, [f > 0 ? bx : fx, -hd / 2], [f > 0 ? fx : bx, -hd / 2], bottom + .04, low - .05, .15, name);
  curtain(process, sheet, [f > 0 ? fx : bx, hd / 2], [f > 0 ? bx : fx, hd / 2], bottom + .04, low - .05, .15, name);

  // On all three F-750 cards the two fan ends sit directly above the chain guard.
  const dark = stick ? m.motorTeal : m.motor;
  const fanSide = stick ? -1 : 1, fanY = deck + (stick ? .68 : 1.04);
  for (const x of [-.31, .31]) {
    motorZ(output, m, [x, fanY, fanSide * (L / 2 + .32)], dark, .4, .14, fanSide);
    output.cyl(m.frame, .1, .16, [x, fanY, fanSide * (L / 2 + .08)], { axis: 'z', seg: 16 });
  }
  output.box(m.ss, [1.06, .02, .48], [0, fanY + .19, fanSide * (L / 2 + .26)], undefined, { name: 'packaging-pin-mill-motor-cover' });
  output.box(m.frame, [1.02, .05, .52], [0, fanY - .18, fanSide * (L / 2 + .3)]);
  if (stick) for (const x of [-.46, .46]) output.box(m.frame, [.06, .5, .06], [x, deck + .25, -(L / 2 + .51)]);
  const south = L / 2 + .1, reach = stick ? -1 : 1, guardTop = deck + .95;
  const profile = [[-.52, deck + .05], [1.02, deck + .05], [1.06, deck + .42], [.5, guardTop], [-.46, guardTop], [-.56, deck + .5]].map(([x, y]) => [-x, y]);
  if (stick) profile.forEach(p => { p[0] *= -1; });
  const transparentGuard = !stick && item.cardNumber === 2;
  if (transparentGuard) {
    for (const [x, y, r] of [[-.86, .26, .19], [-.31, .63, .15], [.32, .63, .15]]) {
      output.cyl(m.ssDark, r, .05, [x, deck + y, south + .055], { axis: 'z', seg: 26 });
      output.cyl(m.ssEdge, .044, .07, [x, deck + y, south + .065], { axis: 'z', seg: 16 });
    }
    output.rods(m.black, [[[-.94, deck + .42, south + .07], [-.39, deck + .77, south + .07]], [[-.31, deck + .78, south + .07], [.32, deck + .78, south + .07]], [[.37, deck + .48, south + .07], [-.84, deck + .075, south + .07]]], .018);
  }
  output.extrude(transparentGuard ? m.smokedGuard : m.acrylic, profile, .16, [0, 0, south], [0, 0, 0], { name: 'packaging-mixer-chain-drive-guard' });
  for (const z of [south, south + .16]) profile.forEach((p, i) => { const q = profile[(i + 1) % profile.length]; output.rod(m.ssEdge, [p[0], p[1], z], [q[0], q[1], z], .018, { name: 'packaging-mixer-chain-guard-frame' }); });
  profile.forEach((p, i) => { const q = profile[(i + 1) % profile.length]; output.box(m.ss, [Math.hypot(q[0] - p[0], q[1] - p[1]), .012, .16], [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, south + .08], [0, 0, Math.atan2(q[1] - p[1], q[0] - p[0])], { name: 'packaging-mixer-chain-guard-cover' }); });
  const dx = -.98 * reach;
  output.cyl(dark, .2, .26, [dx, deck + .27, south - .12], { axis: 'z', seg: 24, name: 'packaging-mixer-main-geared-reducer' });
  motorZ(output, m, [dx, deck + .27, south - .52], dark, .46, .16, -1);
  for (const z of [south - .1, south - .6]) output.box(m.frame, [.42, .1, .12], [dx, deck + .06, z]);
  for (const x of [-.33, .33]) { output.cyl(m.ssEdge, .05, .34, [x, deck + .05, 0], { axis: 'x', seg: 14 }); output.rod(m.teal, [x, deck + .1, .2], [x - .3 * f, deck + .5, L / 2 + .02], .012, { seg: 6 }); }
  if (!stick) {
    f750DischargeActuators(output, m, deck, L, item.cardNumber === 2);
    output.coil(m.yellow, [.72, bottom - .02, -hd / 2 - .06], [.8, deck + 1.02, -hd / 2 - .12], .045, 11, .009, { name: 'packaging-yellow-coiled-air-hose', shadow: false });
    // Checker step the operator stands on.
    output.box(m.checkerSmall, [.92, .03, 1.2], [1.16, deck + .215, 0], undefined, { name: 'packaging-mixer-front-step-platform' });
    for (const z of [-.585, .585]) output.box(m.cream, [.92, .2, .03], [1.16, deck + .1, z]);
    output.box(m.cream, [.03, .2, 1.2], [1.605, deck + .1, 0]); output.box(m.yellow, [.035, .012, 1.2], [1.6, deck + .237, 0], undefined, { shadow: false });
  } else {
    output.box(m.checkerSmall, [.5, .03, 1.25], [-1.02, deck + .12, 0], undefined, { name: 'packaging-mixer-front-step-platform' });
    for (const z of [-.6, .6]) output.box(m.yellow, [.5, .1, .03], [-1.02, deck + .06, z]);
    output.box(m.gold, [.03, .1, 1.25], [-1.26, deck + .06, 0]);
    // The F-500 repair photo shows a low, bright drive guard and a channel skid.
    output.box(m.ssEdge, [.38, .02, .37], [.7, deck + .36, -.12], undefined, { name: 'packaging-stick-mixer-drive-service-cover' });
    for (const z of [-.295, .055]) output.box(m.ss, [.38, .25, .018], [.7, deck + .23, z]);
    for (const x of [-.52, .52]) body.box(m.ssDark, [.105, .085, L + .16], [x, deck + .045, 0], undefined, { name: 'packaging-stick-mixer-base-skids' });
  }
  underDeckDischarge(output, m, deck, stick ? 1.05 : 1.12, stick ? 1.05 : 1.2);
  finish(kits);
}

function ribbonMixer(s, root, item) {
  const m = packagingMaterials(s), kits = partKits(s, root, item), [body, process, output] = kits, deck = item.platformHeight, L = 1.86, w = .98, seam = deck + .78;
  const profile = [[-w / 2, seam], [w / 2, seam]]; for (let i = 0; i <= 14; i++) { const a = -i / 14 * PI; profile.push([Math.cos(a) * w / 2, deck + .4 + Math.sin(a) * w / 2]); }
  body.extrude(m.ss, profile, L, [0, 0, -L / 2], [0, 0, 0], { name: 'packaging-ribbon-mixer-u-trough' });
  for (const end of [-1, 1]) {
    body.box(m.ssEdge, [w + .08, .86, .03], [0, deck + .36, end * (L / 2 + .01)]);
    body.cyl(m.ssEdge, .15, .12, [0, deck + .4, end * (L / 2 + .07)], { axis: 'z', seg: 20 });
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6; body.cyl(m.ssDark, .016, .03, [Math.cos(a) * .11, deck + .4 + Math.sin(a) * .11, end * (L / 2 + .14)], { axis: 'z', seg: 6 }); }
    for (const x of [-.4, .4]) body.box(m.frame, [.16, .34, .2], [x, deck + .1, end * (L / 2 - .2)]);
  }
  for (const y of [seam - .02, seam + .012]) body.box(m.ssEdge, [w + .07, .022, L + .07], [0, y, 0], undefined, { name: 'packaging-ribbon-mixer-lid-flange' });
  // Lid with a sloped front face, long bar handle and two red toggles.
  process.extrude(m.ssPolished, [[-w / 2, 0], [w / 2, 0], [w / 2 - .2, .24], [-w / 2 + .04, .24]], L, [0, seam + .025, -L / 2], [0, 0, 0], { name: 'packaging-ribbon-mixer-sloped-lid' });
  const bar = process.at([w / 2 - .06, seam + .12, 0], [0, 0, .69]);
  handle(bar, m.ssEdge, [.02, .02, 0], 1.16, 'z', .07, [1, 0, 0], .018);
  for (const z of [-.36, .36]) { const t = process.at([w / 2 + .035, seam - .02, z]); t.box(m.ssDark, [.03, .14, .05], [0, 0, 0]); t.box(m.ssEdge, [.02, .1, .03], [.03, .02, 0]); t.box(m.red, [.024, .1, .024], [.045, -.1, 0], [0, 0, .2]); }
  const card = s._group(process.group, [w / 2 + .012, seam - .12, .68]); card.rotation.y = PI / 2; textPlate(s, card, 'MY MACHINE CARD', { width: .32, height: .16, position: [0, 0, .004], background: '#fbfbf8', top: '#25306b' });
  process.cyl(m.ssDark, .11, .12, [-.2, seam + .32, -.6], { seg: 20 }); process.cyl(m.hose, .1, 1, [-.2, seam + .88, -.6], { seg: 20, shadow: false, name: 'packaging-ribbon-mixer-clear-vent-hose' });
  for (let i = 0; i < 9; i++) process.ring(m.ssEdge, .102, .006, [-.2, seam + .42 + i * .11, -.6], undefined, { shadow: false });
  const bottom = deck + 2.02, hw = 1.5, hd = 2.2;
  suspendedHood(s, process, m, { x: -.02, z: 0, w: hw, d: hd, bottom, skirt: .22, ductTop: item.ductTop, sign: item.hoodSign, lights: true });
  for (const side of [-1, 1]) process.rod(m.white, [-hw / 2 + .1, bottom + .02, side * (hd / 2 - .05)], [hw / 2 - .1, bottom + .02, side * (hd / 2 - .05)], .035);
  curtain(process, m.clearCurtain, [-.02 - hw / 2, hd / 2], [-.02 - hw / 2, -hd / 2], bottom + .03, seam + .12, .05, 'packaging-ribbon-mixer-hung-screens');
  curtain(process, m.clearCurtain, [-.02 - hw / 2, -hd / 2], [-.02 + hw / 2, -hd / 2], bottom + .03, seam + .12, .1, 'packaging-ribbon-mixer-hung-screens');
  curtain(process, m.clearCurtain, [-.02 + hw / 2, hd / 2], [-.02 - hw / 2, hd / 2], bottom + .03, seam + .12, .1, 'packaging-ribbon-mixer-hung-screens');
  motorZ(output, m, [0, deck + .4, -(L / 2 + .62)], m.motor, .46, .17, -1); output.cyl(m.motor, .2, .26, [0, deck + .4, -(L / 2 + .28)], { axis: 'z', seg: 22 });
  output.box(m.frame, [.5, .06, .9], [0, deck + .14, -(L / 2 + .45)]); for (const x of [-.2, .2]) output.box(m.frame, [.07, .14, .7], [x, deck + .07, -(L / 2 + .45)]);
  output.box(m.checkerSmall, [.95, .03, 1.7], [1.06, deck + .43, 0], undefined, { name: 'packaging-ribbon-mixer-front-step-platform' });
  for (const z of [-.83, .83]) for (const x of [.64, 1.48]) output.box(m.cream, [.06, .42, .06], [x, deck + .21, z]);
  output.box(m.checkerSmall, [.3, .03, .9], [1.68, deck + .215, 0], undefined, { name: 'packaging-ribbon-mixer-front-step-platform' }); for (const z of [-.43, .43]) output.box(m.cream, [.28, .2, .03], [1.68, deck + .1, z]);
  underDeckDischarge(output, m, deck, .95, .95);
  finish(kits);
}

// A single loose sheet sits over the lid and hangs in irregular folds at the rim.
// Unit 2 has a much longer tail than unit 1. Both keep the spouts visible.
function sieveCover(radius, number) {
  const sectors = 48, vertices = [0, 1.51, 0], indices = [];
  for (let row = 0; row < 4; row++) {
    for (let i = 0; i < sectors; i++) {
      const a = TAU * i / sectors, fold = Math.cos(9 * a + number) * .5 + Math.sin(5 * a) * .35;
      const tail = Math.pow((1 + Math.cos(a - number * .9)) / 2, 3);
      const r = [radius * .49, radius + .04, radius + .055 + .028 * fold, radius + .07 + .08 * fold + .06 * tail][row];
      const y = [1.50, 1.32 + .02 * fold, 1.18 + .05 * fold, 1.03 + .075 * fold - (number === 2 ? .48 : .2) * tail][row];
      vertices.push(r * Math.cos(a), y, r * Math.sin(a));
      const at = 1 + row * sectors + i, next = 1 + row * sectors + (i + 1) % sectors;
      if (!row) indices.push(0, next, at);
      else indices.push(at - sectors, next, at, at - sectors, next - sectors, next);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

// SEJIN SJTS-S 1200 vibrating sieve on castors; spoutAngle 0 = +X, +90° = -Z.
function sieve(s, root, item) {
  const m = packagingMaterials(s), kits = partKits(s, root, item), [base, process, detail] = kits, deck = item.platformHeight || 0, r = .6, spin = item.spoutAngle ?? PI;
  base.cyl(m.greySteel, .4, .5, [0, deck + .42, 0], { seg: 32, bottom: .44, name: 'packaging-sieve-grey-vibrator-pedestal' });
  base.cyl(m.greySteel, .53, .03, [0, deck + .16, 0], { seg: 32 }); base.cyl(m.greySteel, .46, .025, [0, deck + .68, 0], { seg: 32 });
  for (let i = 0; i < 4; i++) {
    const a = i * TAU / 4 + .4, x = Math.cos(a) * .46, z = Math.sin(a) * .46;
    base.cyl(m.red, .055, .04, [x, deck + .058, z], { rotation: [PI / 2, 0, a], seg: 16 }); base.box(m.ssEdge, [.07, .07, .06], [x, deck + .115, z], [0, -a, 0]);
  }
  for (let i = 0; i < 8; i++) { const a = i * TAU / 8; base.cyl(m.ssDark, .035, .09, [Math.cos(a) * .41, deck + .735, Math.sin(a) * .41], { seg: 10 }); for (const y of [.71, .74, .765]) base.ring(m.ssEdge, .038, .007, [Math.cos(a) * .41, deck + y, Math.sin(a) * .41], undefined, { seg: 12 }); }
  const plate = s._group(base.group, [Math.cos(.5) * .425, deck + .45, Math.sin(.5) * .425]); plate.rotation.y = PI / 2 - .5;
  textPlate(s, plate, 'SEJIN', { width: .26, height: .13, position: [0, 0, .01], background: '#ece9e0', color: '#c3221f' });
  const caution = s._group(base.group, [Math.cos(1.55) * .425, deck + .5, Math.sin(1.55) * .425]); caution.rotation.y = PI / 2 - 1.55;
  textPlate(s, caution, '주의|청소 시 전원차단', { width: .16, height: .2, position: [0, 0, .01], background: '#f3cf2e', color: '#26241a', border: '#2b2b2b' });
  base.box(m.white, [.1, .12, .07], [-.36, deck + .48, .28], [0, .9, 0]);
  base.tube(m.black, [[-.36, deck + .42, .28], [-.5, deck + .2, .42], [-.62, deck + .06, .5]], .012, { shadow: false });
  for (const [i, y] of [[0, .9], [1, 1.17]]) {
    process.cyl(m.ssPolished, r, .22, [0, deck + y, 0], { seg: 40, name: 'packaging-sieve-round-screen-sections' });
    for (const dy of [-.12, .12]) process.cyl(m.ssEdge, r + .045, .022, [0, deck + y + dy, 0], { seg: 40, name: 'packaging-sieve-clamping-rims' });
  }
  process.cyl(m.ss, .44, .06, [0, deck + .79, 0], { seg: 32, bottom: .4 });
  process.dome(m.ss, [r + .02, .13, r + .02], [0, deck + 1.3, 0], [0, 0, 0], { name: 'packaging-sieve-domed-lid' });
  const feedBowl = [[.1, 0], [.20, .025], [.27, .075], [.3, .12], [.3, .132], [.285, .132], [.264, .085], [.18, .042], [.105, .025]];
  process.mesh(new THREE.LatheGeometry(feedBowl.map(([r, y]) => new THREE.Vector2(r, y)), 40), m.ssPolished, [0, deck + 1.36, 0], undefined, { name: 'packaging-sieve-flared-feed-bowl' });
  process.ring(m.ssEdge, .295, .009, [0, deck + 1.49, 0], undefined, { seg: 40, name: 'packaging-sieve-top-feed-ring' });
  for (const z of [-.45, .45]) handle(process, m.ssEdge, [0, deck + 1.36, z], .23, 'x', .065, [0, 1, 0], .01);
  for (let i = 0; i < 8; i++) {
    const a = i * TAU / 8 + .2, c = Math.cos(a) * (r + .05), z = Math.sin(a) * (r + .05);
    detail.rod(m.ssEdge, [c, deck + .78, z], [c, deck + 1.3, z], .012);
    for (const y of [.9, 1.17]) {
      const l = detail.at([c, deck + y - .11, z], [0, -a, 0]);
      l.box(m.ssDark, [.03, .07, .05], [0, .045, 0]); l.box(m.ssEdge, [.016, .13, .022], [.024, .07, 0]);
      l.cyl(m.blue, .019, .12, [.052, -.02, 0], { rotation: [0, 0, .34], seg: 12, name: 'packaging-sieve-blue-clamp-levers' });
    }
  }
  // Flat fan-shaped spout toward the mixer, and a small reject spout opposite.
  const k = detail.at([0, deck + 1.1, 0], [0, spin, 0]);
  k.box(m.ss, [.62, .02, .3], [r + .3, -.02, 0], [0, 0, -.05]); for (const z of [-.15, .15]) k.box(m.ss, [.62, .09, .018], [r + .3, .02, z], [0, 0, -.05]);
  k.box(m.ssEdge, [.04, .12, .32], [r + .02, .02, 0]);
  k.cyl(m.ss, .15, .1, [r + .58, -.06, 0], { seg: 20 });
  k.box(m.ss, [.57, .017, .295], [r + .29, .065, 0], [0, 0, -.05], { name: 'packaging-sieve-covered-discharge-chute' });
  k.cyl(m.ssEdge, .149, .016, [r + .57, .051, 0], { seg: 24 });
  const reject = detail.at([0, deck + .88, 0], [0, spin + PI * (item.rejectTurn ?? .72), 0]);
  reject.box(m.ss, [.28, .02, .16], [r + .14, 0, 0]); for (const z of [-.08, .08]) reject.box(m.ss, [.28, .07, .015], [r + .14, .035, z]);
  if (item.cardNumber === 3) { reject.cyl(m.blueSack, .1, .2, [r + .28, -.17, 0], { bottom: .16, seg: 20 }); reject.ball(m.blueSack, [.165, .17, .15], [r + .28, -.34, 0]); reject.ring(m.ssEdge, .11, .012, [r + .28, -.06, 0]); }
  if (item.cardNumber === 1 || item.cardNumber === 2) detail.mesh(sieveCover(r, item.cardNumber), m.wrap, [0, deck, 0], undefined, { shadow: false, pick: false, order: 2, name: 'packaging-sieve-loose-clear-cover' });
  finish(kits);
}

// Stainless box hoppers in a single row: hinged front lids, a fixed rear strip
// with filters and blue caps, and one cone and valve per box below the deck.
function boxHoppers(s, root, item) {
  const m = packagingMaterials(s), kits = partKits(s, root, item), [body, process, output] = kits, deck = item.platformHeight, pitch = 1.06, h = .72, front = -.68, depth = 1.02, lidDepth = .74;
  const boxes = item.boxes, first = boxes[0].z - .52, last = boxes.at(-1).z + .52;
  for (const x of [front - .02, front + depth - .05]) body.box(m.ssDark, [.07, .06, last - first], [x, deck + .03, (first + last) / 2], undefined, { name: 'packaging-hopper-row-base-channels' });
  boxes.forEach((box, index) => {
    const n = box.labels.length, width = pitch - .075, cell = width / n;
    body.box(m.ssPolished, [depth, h - .05, width], [front + depth / 2, deck + .06 + (h - .05) / 2, box.z], undefined, { name: 'packaging-rectangular-ss-box-hopper-row' });
    body.box(m.rubber, [depth - .04, h - .02, .05], [front + depth / 2, deck + .04 + h / 2, box.z - pitch / 2]);
    process.box(m.ss, [depth - lidDepth, .03, width + .02], [front + lidDepth + (depth - lidDepth) / 2, deck + h + .035, box.z]);
    process.box(m.ssEdge, [.03, .06, width + .02], [front + lidDepth, deck + h + .05, box.z], undefined, { name: 'packaging-box-hopper-lid-hinge-rail' });
    box.labels.forEach((label, i) => {
      const z = box.z + (i + .5) * cell - width / 2;
      process.box(m.ssPolished, [lidDepth - .01, .03, cell - .012], [front + lidDepth / 2 - .012, deck + h + .036, z], undefined, { name: 'packaging-box-hopper-mirror-lids' });
      process.box(m.ssEdge, [.02, .04, cell - .012], [front - .008, deck + h + .02, z]);
      handle(process, m.ssEdge, [front + .12, deck + h + .05, z], Math.min(.26, cell * .5), 'z', .05, [0, 1, 0], .009);
      for (const side of n > 1 ? [-.3, .3] : [-.42, .42]) { const t = process.at([front - .012, deck + h - .07, z + side * cell], [0, PI, 0]); t.box(m.ssDark, [.02, .12, .06], [.006, 0, 0]); t.box(m.ssEdge, [.016, .09, .026], [.024, .01, 0]); }
      const plate = s._group(process.group, [front - .006, deck + h - .17, z]); plate.rotation.y = -PI / 2;
      textPlate(s, plate, label.replace(' (', '|('), { width: .2, height: label.includes('(') ? .13 : .11, position: [0, 0, .012], background: '#fbfbf8', color: '#1a1e22', top: '#25306b', bottom: '#7fbf3f', name: 'packaging-hopper-line-nameplate' });
    });
    for (const z of [-.2, .02]) process.cyl(m.blueCap, .055, .05, [front + lidDepth + .12, deck + h + .075, box.z + z - .06], { seg: 16, name: 'packaging-box-hopper-blue-caps' });
    for (const z of index % 2 ? [.3] : [.24, .4]) { process.cyl(m.whiteSack, .07, .2, [front + lidDepth + .14, deck + h + .17, box.z + z], { seg: 18, name: 'packaging-box-hopper-white-vent-filters' }); process.ring(m.ssEdge, .074, .01, [front + lidDepth + .14, deck + h + .07, box.z + z]); }
    process.cyl(m.ssEdge, .085, .035, [front + lidDepth + .13, deck + h + .07, box.z - .36], { seg: 20 }); process.cyl(m.ss, .065, .03, [front + lidDepth + .13, deck + h + .1, box.z - .36], { seg: 20 });
    for (const z of [-.36, .36]) {
      body.extrude(m.ssDark, [[0, 0], [.145, 0], [.048, .21], [0, .21]], .022, [front, deck + .055, box.z + z], [0, PI, 0], { name: 'packaging-box-hopper-front-foot-gussets' });
      body.box(m.ssEdge, [.19, .022, .09], [front - .055, deck + .041, box.z + z]);
      body.cyl(m.ssDark, .017, .013, [front - .113, deck + .06, box.z + z], { seg: 6 });
    }
    if (index === boxes.length - 1) {
      const endZ = box.z + width / 2 + .025;
      for (const [x, y] of [[front + .26, deck + h - .3], [front + .65, deck + h + .035]]) {
        process.box(m.ssEdge, [.085, .075, .025], [x, y, endZ]);
        process.cyl(m.ssDark, .019, .038, [x, y, endZ + .016], { seg: 10, axis: 'z' });
      }
      process.rod(m.black, [front + .38, deck + h - .2, endZ + .035], [front + .65, deck + h + .035, endZ + .035], .019, { name: 'packaging-hopper-lid-gas-strut' });
      process.rod(m.ssPolished, [front + .26, deck + h - .3, endZ + .035], [front + .38, deck + h - .2, endZ + .035], .009);
    }
    // Below the deck: square or round cones, valve box, sleeve and floor flange.
    const outs = n > 1 ? [-.24, .24] : [0], cx = -.2;
    outs.forEach((dz, o) => {
      const high = deck - .06, low = 1.06, z = box.z + dz, cw = n > 1 ? .44 : .9;
      if ((index + o) % 3 === 1) output.cyl(m.ss, cw / 2, high - low, [cx, (high + low) / 2, z], { bottom: .1, seg: 26, name: 'packaging-stick-conical-underdeck-hopper-row' });
      else output.mesh(frustum(.86, cw, .2, .2, high - low), m.ss, [cx, low, z], [0, 0, 0], { name: 'packaging-stick-square-underdeck-hopper-row' });
      output.box(m.ssEdge, [.36, .05, .33], [cx, 1.02, z]); output.box(m.ss, [.32, .2, .29], [cx, .9, z], undefined, { name: 'packaging-slide-gate-valve-housing' });
      output.box(m.red, [.04, .045, .14], [cx - .18, .86, z]);
      output.rod(m.greenLever, [cx + .1, 1.06, z + .06], [cx + .62, 1.06, z + .06], .022, { name: 'packaging-slide-gate-mint-levers' });
      output.cyl(m.ivory, .08, .5, [cx, .53, z], { seg: 16 }); for (const y of [.32, .74]) output.ring(m.ssEdge, .088, .012, [cx, y, z]);
      output.cyl(m.ssEdge, .17, .05, [cx, .1, z], { seg: 24, name: 'packaging-hopper-floor-flange-row' });
      for (let b = 0; b < 6; b++) { const a = b * TAU / 6; output.cyl(m.ssDark, .013, .03, [cx + Math.cos(a) * .14, .13, z + Math.sin(a) * .14], { seg: 6 }); }
    });
  });
  body.group.userData.hopperCount = boxes.length; body.group.userData.nameplates = boxes.flatMap(box => box.labels);
  finish(kits);
}

function cycloneFrame(s, root, item) {
  const m = packagingMaterials(s), kits = partKits(s, root, item), [frame, tank, ducts] = kits, deck = item.platformHeight, up = item.upperDeckHeight, w = item.width, d = item.depth, t = .13;
  for (const x of [-w / 2 + t / 2, w / 2 - t / 2]) for (const z of [-d / 2 + t / 2, d / 2 - t / 2]) { frame.box(m.greySteel, [t, up - deck, t], [x, (up + deck) / 2, z], undefined, { name: 'packaging-grey-two-level-square-tube-frame' }); frame.box(m.frame, [.24, .02, .24], [x, deck + .012, z]); }
  for (const y of [up - .07, deck + 1.55]) {
    for (const z of [-d / 2 + t / 2, d / 2 - t / 2]) frame.box(m.greySteel, [w, t, t], [0, y, z]);
    for (const x of [-w / 2 + t / 2, w / 2 - t / 2]) frame.box(m.greySteel, [t, t, d], [x, y, 0]);
  }
  // Two deck plates leave the cyclone penetration open.
  for (const x of [-w * .34, w * .34]) frame.box(m.checkerSmall, [w * .3, .03, d], [x, up + .015, 0], undefined, { name: 'packaging-cyclone-upper-deck-plate' });
  for (const z of [-d * .36, d * .36]) frame.box(m.checkerSmall, [w * .4, .03, d * .28], [0, up + .015, z], undefined, { name: 'packaging-cyclone-upper-deck-plate' });
  for (const z of [-d / 2 + .03, d / 2 - .03]) { for (const y of [.5, 1]) frame.rod(m.ssEdge, [-w / 2, up + y, z], [w / 2, up + y, z], .02); for (let x = -w / 2; x <= w / 2 + .01; x += w / 4) frame.rod(m.ssEdge, [x, up, z], [x, up + 1, z], .018); }
  for (const x of [-w / 2 + .03, w / 2 - .03]) { for (const y of [.5, 1]) frame.rod(m.ssEdge, [x, up + y, -d / 2], [x, up + y, d / 2], .02); for (let z = -d / 2; z <= d / 2 + .01; z += d / 5) frame.rod(m.ssEdge, [x, up, z], [x, up + 1, z], .018); }
  if (item.ladder) {
    const lx = -w / 2 - .12, z0 = d / 2 - .62, z1 = d / 2 - .18;
    for (const z of [z0, z1]) frame.rod(m.ssEdge, [lx - .18, deck, z], [lx, up + 1.05, z], .024, { name: 'packaging-cyclone-deck-access-ladder' });
    for (let y = .26; y < up - deck; y += .27) { const x = lx - .18 + .18 * y / (up - deck + 1.05); frame.rod(m.ssEdge, [x, deck + y, z0], [x, deck + y, z1], .016, { name: 'packaging-cyclone-deck-access-ladder' }); }
    for (let y = deck + 1.75; y < up + 1; y += .5) frame.ring(m.ssEdge, .34, .016, [lx - .3, y, (z0 + z1) / 2], [PI / 2, 0, 0], { seg: 22, name: 'packaging-ladder-safety-cage' });
    for (let i = 0; i < 5; i++) { const a = PI * .5 + i * PI / 4; frame.rod(m.ivory, [lx - .3 + Math.cos(a) * .34, deck + 1.75, (z0 + z1) / 2 + Math.sin(a) * .34], [lx - .3 + Math.cos(a) * .34, up + .95, (z0 + z1) / 2 + Math.sin(a) * .34], .011); }
  }
  const x = -.42, r = .4, low = deck + 1.86, seam = up - .02, top = Math.min(item.height, up + .86);
  tank.cyl(m.ssPolished, r, top - seam, [x, (top + seam) / 2, 0], { seg: 32, name: 'packaging-cyclone-stainless-barrel' });
  tank.cyl(m.ssPolished, r, seam - low, [x, (seam + low) / 2, 0], { bottom: .1, seg: 32, name: 'packaging-cyclone-cone-through-upper-deck' });
  for (const y of [seam, seam + .34, top - .05]) tank.cyl(m.ssEdge, r + .025, .03, [x, y, 0], { seg: 32 });
  tank.dome(m.ss, [r, .1, r], [x, top, 0]); tank.cyl(m.ssEdge, .13, .1, [x, top + .06, 0], { seg: 18 });
  // Mounting ears carry the stainless cone across the opening in the grey deck.
  for (const side of [-1, 1]) {
    tank.box(m.ssEdge, [.2, .035, .15], [x + side * (r + .04), seam + .035, 0]);
    tank.box(m.ss, [.035, .14, .14], [x + side * r, seam + .11, 0]);
    tank.cyl(m.ssDark, .02, .018, [x + side * (r + .105), seam + .065, 0], { seg: 6 });
  }
  for (let i = 0; i < 6; i++) { const a = i * TAU / 6; tank.box(m.red, [.04, .09, .03], [x + Math.cos(a) * (r + .035), seam + .34, Math.sin(a) * (r + .035)], [0, -a, 0]); }
  tank.cyl(m.white, .1, .05, [x - r - .02, seam + .56, .1], { axis: 'x', seg: 20 }); tank.box(m.black, [.012, .06, .012], [x - r - .05, seam + .57, .1], [.7, 0, 0]);
  tank.box(m.cabinet, [.16, .24, .2], [x + r * .5, seam + .5, -r - .06]); tank.cyl(m.blue, .05, .16, [x + .2, top + .1, .18], { seg: 12 });
  // Black pneumatic butterfly under the cone, conveying line and pulse piping.
  ducts.cyl(m.ssEdge, .13, .05, [x, low - .02, 0], { seg: 20 }); ducts.box(m.black, [.26, .14, .16], [x + .24, low - .08, 0]); ducts.cyl(m.red, .05, .05, [x + .24, low + .01, 0], { seg: 12 });
  ducts.cyl(m.ssDark, .115, .1, [x, low - .09, 0], { seg: 20 });
  // Conveying line: west over the hopper aisle below the headers (card photo 1~4호기),
  // or south along the store wall (card photo 5~7호기). Its far end is out of both frames.
  const line = item.conveyTo === 'south'
    ? [[x - .1, seam + .1, r - .05], [x - .3, seam - .03, d / 2 - .3], [x - .5, seam, d / 2 + .05], [x - .5, seam + .3, d / 2 + .22], [x - .5, seam + 1.3, d / 2 + .22]]
    : [[x - r + .04, seam + .1, .2], [x - r - .6, seam - .06, .3], [x - r - 1.9, seam - .1, .32], [x - r - 2.5, seam - .06, .3], [x - r - 2.68, seam + .22, .3], [x - r - 2.68, seam + 1.4, .3]];
  ducts.tube(m.ssPolished, line, .05, { name: 'packaging-cyclone-conveying-pipe', segments: 40, radial: 14 });
  ducts.rods(m.ssEdge, [[[x + r + .03, seam + .1, .16], [x + r + .03, top, .16]], [[x + r + .03, top, .16], [x + .1, top + .12, .16]]], .02);
  ducts.rod(m.ssDark, [w / 2 - .12, deck, -d / 2 + .3], [w / 2 - .12, up, -d / 2 + .3], .03);
  finish(kits);
}

// The plan's 「시프트」 on the stick side: a spring-hung box sieve, Y outlet to two hoppers.
function hungSieve(s, root, item) {
  const m = packagingMaterials(s), kits = partKits(s, root, item), [body, hang, outlet] = kits, deck = item.platformHeight, y = deck + 1.12;
  body.mesh(frustum(1.02, .56, .86, .4, .24), m.ss, [0, y, 0], [0, 0, 0], { name: 'packaging-suspended-box-sieve' });
  body.box(m.ssEdge, [1.08, .03, .62], [0, y + .25, 0]); body.mesh(frustum(.92, .46, 1.04, .58, .06), m.ss, [0, y + .265, 0], [0, 0, 0], { name: 'packaging-suspended-sieve-raised-lid' });
  for (const x of [-.42, 0, .42]) for (const z of [-.32, .32]) body.box(m.red, [.03, .13, .028], [x, y + .2, z], undefined, { name: 'packaging-suspended-sieve-red-clamps' });
  for (const x of [-.55, .55]) body.box(m.red, [.028, .13, .03], [x, y + .2, 0]);
  body.box(m.teal, [.22, .2, .2], [.66, y + .06, 0]); body.cyl(m.teal, .08, .2, [.82, y + .06, 0], { axis: 'x', seg: 16 });
  hang.cyl(m.kraft, .11, .2, [-.02, y + .43, 0], { seg: 18, name: 'packaging-suspended-sieve-flexible-inlet' }); for (const dy of [.35, .52]) hang.ring(m.ssEdge, .115, .012, [-.02, y + dy, 0]);
  for (const x of [-.44, .44]) for (const z of [-.24, .24]) {
    hang.rod(m.ssEdge, [x, y + .26, z], [x, y + .5, z], .009); hang.ring(m.ssEdge, .03, .008, [x, y + .52, z], [0, 0, 0], { seg: 14 });
    for (let i = 0; i < 5; i++) hang.ring(m.ssDark, .032, .007, [x, y + .57 + i * .022, z], undefined, { seg: 12 });
    hang.rod(m.ssEdge, [x, y + .68, z], [x, deck + 1.52, z], .009);
  }
  hang.box(m.ssEdge, [1.04, .03, .03], [0, deck + 1.5, -.24]); hang.box(m.ssEdge, [1.04, .03, .03], [0, deck + 1.5, .24]);
  const ox = -.4, oy = y - .02;
  outlet.cyl(m.kraft, .1, .16, [ox, oy - .06, 0], { seg: 18 }); outlet.cyl(m.ssEdge, .12, .03, [ox, oy - .15, 0], { seg: 20 });
  for (const side of [-1, 1]) {
    outlet.rod(m.ssPolished, [ox, oy - .15, 0], [ox - .24, deck + .86, side * .36], .065, { seg: 18, name: 'packaging-sieve-y-branch-outlets' });
    const mid = [ox - .12, (oy - .15 + deck + .86) / 2, side * .18];
    outlet.cyl(m.ssEdge, .1, .07, mid, { rotation: [side * -.55, 0, -.32], seg: 18 });
    outlet.rod(m.greenLever, mid, [mid[0] - .2, mid[1] + .08, mid[2] - side * .12], .016, { name: 'packaging-sieve-green-butterfly-levers' });
    outlet.cyl(m.ssEdge, .085, .04, [ox - .24, deck + .84, side * .36], { seg: 18 });
  }
  outlet.tube(m.amberCurtain, [[.5, y + .02, .12], [.66, y - .06, .2], [.7, y - .4, .28], [.6, deck + .42, .34]], .055, { shadow: false, name: 'packaging-sieve-amber-reject-hose' });
  outlet.cyl(m.white, .15, .34, [.6, deck + .2, .34], { bottom: .13, seg: 20 });
  finish(kits);
}

function cabinetLamps(kit, m, { w, y, z = 0, rows, pitch = .115, lit = [] }) {
  rows.forEach(([count, dy, kind], r) => { for (let i = 0; i < count; i++) {
    const x = (i - (count - 1) / 2) * pitch, mat = kind === 'lamp' ? (lit.includes(i) ? m.redLamp : m.red) : kind === 'green' ? (i % 3 === 1 ? m.green : i % 2 ? m.red : m.black) : (i % 4 === 2 ? m.yellow : i % 2 ? m.green : m.red);
    kit.cyl(m.ssEdge, .024, .012, [x, y - dy, z + .006], { axis: 'z', seg: 14 }); kit.cyl(mat, .018, .026, [x, y - dy, z + .018], { axis: 'z', seg: 14 });
    kit.box(m.label, [.05, .016, .003], [x, y - dy + .038, z + .003], undefined, { shadow: false });
  } });
}

function control(s, root, item) {
  const m = packagingMaterials(s), kits = partKits(s, root, item), [body, fascia, detail] = kits, deck = item.wallMounted ? item.mountHeight : item.platformHeight || 0, variant = item.controlVariant;
  if (item.wallMounted) {
    body.box(m.cabinet, [.42, .54, .16], [0, deck + .27, 0]); fascia.box(m.beige, [.36, .46, .012], [0, deck + .27, .086]); fascia.box(m.display, [.2, .09, .012], [0, deck + .4, .095]); fascia.box(m.screen, [.15, .055, .006], [0, deck + .4, .103]);
    cabinetLamps(fascia, m, { w: .36, y: deck + .26, z: .09, rows: [[3, 0, 'green'], [3, .1, 'push']], pitch: .1 });
    detail.rod(m.frame, [.12, deck + .54, 0], [.12, deck + 1.2, 0], .02); detail.rod(m.frame, [-.1, deck, 0], [-.1, deck - .7, 0], .02); finish(kits); return;
  }
  if (variant === 'stick' || variant === 'stick-level') {
    const w = .95, h = 1.16, base = deck + .72;
    body.box(m.frame, [.22, .72, .16], [0, deck + .36, 0], undefined, { name: 'packaging-stick-control-pedestal' }); body.box(m.frame, [.5, .02, .4], [0, deck + .012, 0]);
    body.box(m.beige, [w, h, .34], [0, base + h / 2, 0], undefined, { name: 'packaging-stick-mixer-control-cabinet' }); fascia.box(m.beige, [w - .06, h - .06, .014], [0, base + h / 2, .176]);
    cabinetLamps(fascia, m, { w, y: base + h - .14, z: .18, rows: [[6, 0, 'lamp']], pitch: .13, lit: variant === 'stick' ? [0, 1] : [0, 1, 3] });
    for (const x of [-.22, .04]) { fascia.box(m.white, [.13, .15, .016], [x, base + h - .33, .186]); fascia.rod(m.black, [x, base + h - .37, .198], [x + .03, base + h - .3, .198], .004, { seg: 5 }); }
    fascia.box(m.white, [.14, .14, .016], [.3, base + h - .33, .186]); fascia.box(m.display, [.1, .04, .006], [.3, base + h - .3, .197]);
    cabinetLamps(fascia, m, { w, y: base + h - .52, z: .18, rows: [[6, 0, 'push'], [6, .16, 'green'], [6, .32, 'lamp']], pitch: .13, lit: [3] });
    fascia.cyl(m.red, .034, .04, [.4, base + h - .52, .205], { axis: 'z', seg: 16 }); detail.box(m.ssEdge, [.03, .22, .03], [-w / 2 + .07, base + h * .6, .2]);
    if (variant === 'stick-level') {
      detail.box(m.ivory, [.5, .34, .2], [.16, base + h + .18, 0], undefined, { name: 'packaging-hopper-tank-level-box' });
      textPlate(s, detail.group, '호퍼탱크레벨 제어반', { width: .42, height: .055, position: [.16, base + h + .31, .102], background: '#fbfbf8' });
      const k = detail.at([.16, 0, 0]); cabinetLamps(k, m, { w: .5, y: base + h + .23, z: .1, rows: [[4, 0, 'green'], [4, .1, 'lamp']], pitch: .105, lit: [1] });
    }
    detail.tube(m.black, [[.3, base, .05], [.42, base - .3, .2], [.46, deck + .1, .26]], .018, { shadow: false }); finish(kits); return;
  }
  if (variant === 'hopper-level') {
    const w = .78, h = 1.85; body.box(m.cabinet, [w, h, .42], [0, deck + h / 2 + .05, 0], undefined, { name: 'packaging-hopper-level-control-cabinet' }); body.box(m.frame, [w + .02, .1, .44], [0, deck + .05, 0]);
    textPlate(s, fascia.group, 'HOPPER LEVEL CONTROL PANEL', { width: w - .14, height: .075, position: [0, deck + h - .03, .213], background: '#f4f1e6' });
    cabinetLamps(fascia, m, { w, y: deck + h - .2, z: .21, rows: [[5, 0, 'push'], [5, .12, 'green'], [5, .3, 'push'], [5, .42, 'green']], pitch: .125 });
    fascia.cyl(m.yellow, .04, .012, [.18, deck + h - .86, .216], { axis: 'z', seg: 18 }); fascia.cyl(m.red, .03, .04, [.18, deck + h - .86, .236], { axis: 'z', seg: 16 });
    detail.box(m.black, [.03, .24, .03], [-w / 2 + .06, deck + h * .55, .225]); for (let i = 0; i < 6; i++) detail.box(m.frame, [.3, .012, .012], [0, deck + .28 + i * .035, .214], undefined, { shadow: false });
    detail.box(m.cabinet, [.34, .3, .05], [.1, deck + h + .25, .1], [-.3, 0, 0]); const k = detail.at([.1, deck + h + .25, .13], [-.3, 0, 0]); cabinetLamps(k, m, { w: .3, y: .06, z: 0, rows: [[3, 0, 'lamp'], [3, .1, 'lamp']], pitch: .09, lit: [0, 2] }); finish(kits); return;
  }
  // F-750: an exposed panel beside a glazed one, each 0.64 m wide.
  for (const [i, x] of [[0, -.36], [1, .36]]) {
    const w = .64, h = 1.9, b = body.at([x, deck, 0]), fa = fascia.at([x, deck, 0]), de = detail.at([x, deck, 0]);
    b.box(m.cabinet, [w, h, .4], [0, h / 2 + .06, 0], undefined, { name: 'packaging-f750-mixer-control-cabinet' }); b.box(m.frame, [w, .1, .42], [0, .05, 0]);
    textPlate(s, fascia.group, 'F-750 MIXER CONTROL PANEL', { width: w - .12, height: .06, position: [x, deck + h - .06, .203], background: '#f4f1e6' });
    cabinetLamps(fa, m, { w, y: h - .2, z: .2, rows: [[6, 0, 'lamp']], pitch: .09, lit: [0, 2] });
    for (const gx of [-.14, .06]) { fa.cyl(m.white, .062, .016, [gx, h - .42, .206], { axis: 'z', seg: 20 }); fa.ring(m.black, .064, .008, [gx, h - .42, .212], [0, 0, 0], { seg: 20 }); fa.rod(m.black, [gx, h - .44, .217], [gx + .025, h - .39, .217], .004, { seg: 5 }); }
    fa.box(m.display, [.1, .07, .012], [.21, h - .42, .206]); cabinetLamps(fa, m, { w, y: h - .64, z: .2, rows: [[6, 0, 'push'], [6, .13, 'green'], [6, .26, 'push']], pitch: .09 });
    fa.cyl(m.black, .028, .03, [0, h - 1.12, .214], { axis: 'z', seg: 14 });
    if (i) { de.box(m.glass, [w - .06, h * .62, .02], [0, h * .64, .235], undefined, { shadow: false }); for (const ex of [-1, 1]) de.box(m.black, [.03, h * .62, .03], [ex * (w / 2 - .03), h * .64, .235]); for (const ey of [-1, 1]) de.box(m.black, [w - .03, .03, .03], [0, h * .64 + ey * h * .31, .235]); de.cyl(m.red, .05, .13, [0, h + .13, 0], { seg: 16 }); }
    else { de.box(m.black, [.035, .3, .03], [-w / 2 + .06, h * .6, .22]); for (const ex of [-1, 1]) de.rod(m.ssEdge, [ex * .4, 0, .5], [ex * .4, .95, .5], .022); de.rod(m.ssEdge, [-.4, .95, .5], [.4, .95, .5], .022); }
  }
  finish(kits);
}

function thermoHygrostat(s, root, item) {
  const m = packagingMaterials(s), kits = partKits(s, root, item), [body, process, detail] = kits, deck = item.platformHeight || 0, w = item.width, d = item.depth, h = 2.12;
  body.box(m.cream, [w, h - .06, d], [0, deck + h / 2 + .03, 0], undefined, { name: 'packaging-thermo-hygrostat-cabinet' }); body.box(m.black, [w - .06, .06, d - .06], [0, deck + .03, 0]);
  body.box(m.ivory, [w + .02, .03, d + .02], [0, deck + h + .01, 0]);
  for (const x of [-w * .24, w * .24]) {
    process.box(m.black, [w * .42, .26, .02], [x, deck + h - .22, d / 2 + .002]); for (let i = 0; i < 5; i++) process.box(m.cream, [w * .4, .026, .04], [x, deck + h - .32 + i * .05, d / 2 + .016], [.45, 0, 0]);
    process.box(m.ivory, [w * .4, .62, .012], [x, deck + 1.32, d / 2 + .006]); process.box(m.ivory, [w * .4, .86, .012], [x, deck + .52, d / 2 + .006]);
    process.box(m.black, [.035, .12, .012], [x - Math.sign(x) * w * .16, deck + 1.28, d / 2 + .014]); process.box(m.black, [.035, .12, .012], [x - Math.sign(x) * w * .16, deck + .62, d / 2 + .014]);
    for (let r = 0; r < 14; r++) detail.box(m.frame, [w * .3, .012, .008], [x, deck + .24 + r * .042, d / 2 + .014], undefined, { shadow: false, name: 'packaging-thermo-hygrostat-return-grille' });
  }
  detail.box(m.display, [.12, .16, .02], [0, deck + 1.36, d / 2 + .012]); detail.box(m.screen, [.09, .08, .008], [0, deck + 1.39, d / 2 + .024]);
  textPlate(s, detail.group, '에어컨', { width: .18, height: .06, position: [w * .2, deck + 1.52, d / 2 + .016], background: '#fbfbf8', top: '#25306b' });
  textPlate(s, detail.group, '감전 주의', { width: .3, height: .22, position: [w * .26, deck + 1.24, d / 2 + .016], background: '#ffd21f', color: '#1a1c1e', border: '#1d3f86' });
  detail.tube(m.galv, [[-w / 2 + .14, deck + h, -d / 2 + .14], [-w / 2 + .14, deck + h + .3, -d / 2 + .13], [-w / 2 + .14, deck + h + .4, -d / 2 - .05], [-w / 2 + .14, deck + h + .4, -d / 2 - .3]], .03, { segments: 20 });
  finish(kits);
}

function dehumidifier(s, root, item) {
  const m = packagingMaterials(s), kits = partKits(s, root, item), [body, process, detail] = kits, { width: w, depth: d, height: h } = item;
  body.box(m.white, [w, h - .1, d], [0, h / 2 + .05, 0], undefined, { name: 'packaging-portable-dehumidifier-cabinet' }); for (const x of [-1, 1]) for (const z of [-1, 1]) body.cyl(m.rubber, .045, .04, [x * (w / 2 - .08), .045, z * (d / 2 - .08)], { axis: 'x', seg: 14 });
  process.box(m.black, [w * .8, .3, .02], [0, h - .24, d / 2 + .002]); for (let i = 0; i < 6; i++) process.box(m.ivory, [w * .78, .016, .045], [0, h - .36 + i * .048, d / 2 + .02], [.5, 0, 0]);
  detail.box(m.frame, [.11, .2, .014], [-w * .12, h * .66, d / 2 + .006]); detail.box(m.display, [.08, .07, .008], [-w * .12, h * .69, d / 2 + .016]);
  for (let r = 0; r < 12; r++) for (let c = 0; c < 10; c++) detail.box(m.black, [.02, .02, .006], [(c - 4.5) * w * .075, h * .3 + r * .038, d / 2 + .004], undefined, { shadow: false, name: 'packaging-dehumidifier-perforated-intake' });
  detail.box(m.frame, [w * .96, .008, .006], [0, h * .58, d / 2 + .004], undefined, { shadow: false }); finish(kits);
}

function benchScale(s, root, item) {
  const m = packagingMaterials(s), kits = partKits(s, root, item), [table, scale, detail] = kits, { width: w, depth: d } = item;
  table.box(m.ss, [w, .035, d], [0, .84, 0]); table.box(m.ss, [w - .1, .02, d - .08], [0, .24, 0]); for (const x of [-1, 1]) for (const z of [-1, 1]) table.rod(m.ssEdge, [x * (w / 2 - .06), .03, z * (d / 2 - .06)], [x * (w / 2 - .06), .83, z * (d / 2 - .06)], .022);
  table.box(m.ss, [w, .16, .02], [0, .93, -d / 2 + .01]);
  scale.box(m.ssDark, [.4, .07, .36], [-w * .22, .9, 0]); scale.box(m.ssPolished, [.38, .015, .34], [-w * .22, .945, 0]); scale.rod(m.ssEdge, [-w * .22, .9, -.2], [-w * .22, 1.22, -.2], .016); scale.box(m.cabinet, [.24, .13, .06], [-w * .22, 1.26, -.18], [-.25, 0, 0]); scale.box(m.display, [.17, .06, .008], [-w * .22, 1.275, -.146], [-.25, 0, 0]);
  for (const x of [.08, .3, .52]) { detail.cyl(m.white, .09, .24, [w * x, .98, -.08], { bottom: .08, seg: 18 }); detail.cyl(m.blueCap, .095, .025, [w * x, 1.11, -.08], { seg: 18 }); } detail.box(m.ssPolished, [.3, .06, .22], [w * .24, .89, .2]); finish(kits);
}

const BUILDERS = {
  'packaging-mixer': zeroGravityMixer, 'packaging-stick-mixer': zeroGravityMixer, 'packaging-aux-mixer': zeroGravityMixer, 'packaging-ribbon-mixer': ribbonMixer,
  'packaging-sieve': sieve, 'packaging-stick-hoppers': boxHoppers, 'packaging-cyclone-frame': cycloneFrame, 'packaging-suspended-distributor': hungSieve,
  'packaging-control': control, 'packaging-thermo-hygrostat': thermoHygrostat, 'packaging-dehumidifier': dehumidifier, 'packaging-bench-scale': benchScale,
};
export function buildPackagingMixing(s, root, item) {
  const builder = BUILDERS[item.type];
  if (!builder) return false;
  builder(s, root, item); root.userData.packagingEquipmentVersion = 3; return true;
}

// 2층 호퍼 작업대: 3층 믹서에서 내려온 배관 → 진동채 → 교반 호퍼(구 카드 H9-M-006~009).
// 호퍼는 작업대 구멍에 걸려 있고 아래 원추가 1층 포장기로 이어진다.
export function buildAgitatorHopper(s, root, item) {
  const m = packagingMaterials(s), kits = partKits(s, root, item), [body, process, output] = kits;
  const deck = item.platformHeight, side = item.sieveSide, tall = item.drumHeight, r = item.drumRadius;
  const dx = -side * 1.12, sx = side * 1.3, up = deck + 1.95, top = deck + tall, ceiling = item.ceiling, cx = item.feedX;

  body.cyl(m.ss, r, tall + .12, [dx, deck + tall / 2 - .06, 0], { seg: 48, name: 'packaging-agitator-hopper-drum' });
  for (const y of [deck + .02, top - .05]) body.ring(m.ssEdge, r + .004, .013, [dx, y, 0], undefined, { seg: 48 });
  body.cyl(m.ss, r - .03, .62, [dx, deck - .43, 0], { bottom: .22, seg: 40, name: 'packaging-agitator-hopper-underdeck-cone' });
  body.cyl(m.ssEdge, .27, .05, [dx, deck - .76, 0], { seg: 24 }); body.cyl(m.ssDark, .22, .1, [dx, deck - .83, 0], { seg: 24 }); body.box(m.blue, [.3, .11, .11], [dx + .34, deck - .83, 0]);
  body.cyl(m.white, .16, deck - .9, [dx, (deck - .9) / 2 + .02, 0], { seg: 20 }); body.cyl(m.ssEdge, .26, .03, [dx, .02, 0], { seg: 24 });
  // Three bracket feet carry the drum on the deck plate.
  for (let i = 0; i < 3; i++) {
    const k = body.at([dx + Math.cos(i * TAU / 3 + .5) * (r + .12), deck, Math.sin(i * TAU / 3 + .5) * (r + .12)], [0, -(i * TAU / 3 + .5), 0]);
    k.box(m.ssEdge, [.34, .02, .3], [0, .012, 0]); k.box(m.ssEdge, [.014, .26, .28], [-.14, .14, 0]);
    for (const z of [-.13, .13]) k.extrude(m.ssEdge, [[-.15, .02], [.15, .02], [.15, .1], [-.02, .26], [-.15, .26]], .014, [0, 0, z - .007]);
  }
  // Curved side door with one latch, on the operator face.
  const doorTop = Math.min(.46, tall * .58), doorY = deck + .12 + doorTop / 2;
  for (const [radius, w, h, mat] of [[r + .012, .56, doorTop, m.ssEdge], [r + .024, .5, doorTop - .06, m.ssPolished]]) {
    const half = w / 2 / r;
    body.mesh(new THREE.CylinderGeometry(radius, radius, h, 14, 1, true, -half, half * 2), mat, [dx, doorY, 0], [0, 0, 0], { name: 'packaging-agitator-hopper-side-door' });
  }
  const face = body.at([dx, doorY, 0], [0, -PI / 2, 0]);
  clampLever(face, m, [r + .02, -.02, -.22], [PI, 0, 0]); face.box(m.red, [.03, .03, .1], [r + .07, -.03, -.38]);
  handle(face, m.ssEdge, [r + .024, 0, .14], .18, 'y', .045, [1, 0, 0], .009);

  // Lid: fixed rear half with the drive, hinged front half with a long bar handle.
  process.cyl(m.ss, r + .03, .035, [dx, top + .018, 0], { seg: 48, name: 'packaging-agitator-hopper-lid' });
  process.box(m.ssEdge, [r * 1.96, .06, .06], [dx, top + .06, .02], undefined, { name: 'packaging-agitator-hopper-lid-hinge' });
  for (const x of [-.5, 0, .5]) process.cyl(m.ssDark, .026, .16, [dx + x * r, top + .09, .03], { axis: 'x', seg: 12 });
  handle(process, m.ssPolished, [dx, top + .035, r * .72], r * 1.1, 'x', .075, [0, 1, 0], .016);
  for (const a of [.45, PI / 2, PI - .45]) {
    const k = process.at([dx, top, 0], [0, -a, 0]);
    k.box(m.ssDark, [.03, .1, .06], [r + .016, -.06, 0]); k.box(m.ssEdge, [.022, .11, .03], [r + .04, -.01, 0]); k.cyl(m.red, .014, .1, [r + .062, -.1, 0], { rotation: [0, 0, .24], seg: 10 });
  }
  const drive = process.at([dx, top + .035, -r * .34]);
  drive.cyl(m.frame, .2, .05, [0, .03, 0], { bottom: .3, seg: 24 }); drive.cyl(m.frame, .15, .26, [0, .17, 0], { seg: 20 });
  for (let i = 0; i < 4; i++) drive.at([0, 0, 0], [0, i * PI / 2 + .4, 0]).box(m.frame, [.14, .22, .016], [.2, .15, 0]);
  drive.cyl(m.ssDark, .22, .035, [0, .31, 0], { seg: 24 }); drive.cyl(m.motorGreen, .17, .2, [0, .42, 0], { seg: 22 }); drive.cyl(m.motorGreen, .15, .36, [0, .7, 0], { seg: 22 }); drive.cyl(m.ssDark, .155, .07, [0, .915, 0], { seg: 22 });
  for (let i = 0; i < 16; i++) { const a = i * TAU / 16; drive.box(m.motorGreen, [.014, .32, .035], [Math.cos(a) * .152, .7, Math.sin(a) * .152], [0, PI / 2 - a, 0]); }
  drive.box(m.motorGreen, [.14, .16, .12], [.18, .7, 0]);
  process.cyl(m.ssEdge, .06, .1, [dx + r * .55, top + .08, -r * .28], { seg: 16 }); process.cyl(m.ssEdge, .09, .03, [dx + r * .55, top + .14, -r * .28], { seg: 18 }); process.box(m.white, [.1, .1, .1], [dx + r * .55, top + .22, -r * .28]); process.cyl(m.blueCap, .085, .07, [dx + r * .55, top + .3, -r * .28], { seg: 18 });
  process.cyl(m.ssEdge, .11, .08, [dx - r * .58, top + .07, -r * .22], { seg: 20 });

  // Cream mezzanine carrying the 1.7 m sieve.
  const mw = 2.1, md = 2.2;
  output.box(m.checkerSmall, [mw, .04, md], [sx, up, 0], undefined, { name: 'packaging-hopper-sieve-mezzanine-deck' });
  for (const z of [-md / 2 + .05, md / 2 - .05]) {
    output.box(m.cream, [mw, .14, .08], [sx, up - .09, z]);
    for (const x of [-mw / 2 + .06, mw / 2 - .06]) { output.box(m.cream, [.1, up - deck - .1, .1], [sx + x, (up + deck) / 2 - .05, z]); output.bar(m.cream, [sx + x, up - .75, z], [sx + x - Math.sign(x) * .5, up - .14, z], .05); }
    for (const y of [.5, 1]) output.rod(m.ssEdge, [sx - mw / 2, up + y, z], [sx + mw / 2, up + y, z], .02);
    for (let x = -mw / 2; x <= mw / 2 + .01; x += mw / 3) output.rod(m.ssEdge, [sx + x, up, z], [sx + x, up + 1, z], .018);
  }
  for (const y of [.5, 1]) output.rod(m.ssEdge, [sx + side * mw / 2, up + y, -md / 2], [sx + side * mw / 2, up + y, md / 2], .02);
  output.box(m.cream, [.08, .14, md], [sx + side * mw / 2, up - .09, 0]);
  for (const z of [-.3, .3]) for (const x of [-.3, .3]) output.box(m.cream, [.12, up - deck, .12], [sx + x, (up + deck) / 2, z]);
  for (const z of [-.3, .3]) output.box(m.cream, [.6, .08, .08], [sx, deck + 1.25, z]);
  output.cyl(m.greySteel, .6, .46, [sx, up + .26, 0], { seg: 36 }); output.ring(m.greySteel, .64, .02, [sx, up + .05, 0], undefined, { seg: 36 });
  for (let i = 0; i < 12; i++) { const a = i * TAU / 12; for (const y of [.505, .55, .595]) output.ring(m.ssDark, .035, .011, [sx + Math.cos(a) * .63, up + y, Math.sin(a) * .63], undefined, { seg: 10 }); }
  output.box(m.greySteel, [.2, .26, .24], [sx - side * .8, up + .16, .52]);
  for (const y of [.74, .92]) { output.cyl(m.ssPolished, .82, .16, [sx, up + y, 0], { seg: 48, name: 'packaging-hopper-sieve-screen-sections' }); for (const dy of [-.09, .09]) output.cyl(m.ssEdge, .86, .022, [sx, up + y + dy, 0], { seg: 48 }); }
  output.cyl(m.ss, .78, .05, [sx, up + 1.04, 0], { bottom: .84, seg: 48 });
  for (let i = 0; i < 6; i++) { const a = i * TAU / 6 + .3, k = output.at([sx, up, 0], [0, -a, 0]); for (const y of [.83, 1.01]) k.box(m.ssDark, [.06, .03, .16], [.88, y, 0], [0, .3, 0]); }
  for (const [a, l] of [[0, .4], [PI, .4]]) { const k = output.at([sx, up + .72, 0], [0, a, 0]); k.box(m.ss, [l, .08, .24], [.82 + l / 2, 0, 0]); }
  // Feed from the mixer above: pipe, green butterfly valve, then a cloth sleeve.
  const from = [cx, ceiling, 0], to = [sx + (cx - sx) * .3, up + 1.6, 0], down = [sx, up + 1.06, 0];
  output.rod(m.duct, from, to, .13, { seg: 22, name: 'packaging-hopper-feed-pipe-from-third-floor' });
  const valve = output.at(to, [0, 0, Math.atan2(to[0] - from[0], from[1] - to[1])]);
  for (const y of [.03, -.06]) valve.cyl(m.greenLever, .19, .03, [0, y, 0], { seg: 22 });
  valve.cyl(m.ssDark, .15, .07, [0, -.015, 0], { seg: 20 }); valve.rod(m.greenLever, [.16, 0, 0], [.36, .12, .06], .014);
  output.rod(m.whiteSack, [to[0], to[1] - .06, 0], down, .12, { seg: 20, name: 'packaging-hopper-white-feed-sleeve' });
  output.rod(m.whiteSack, [sx - side * .95, up + .7, 0], [dx + side * .3, top + .06, -.3], .11, { seg: 20, name: 'packaging-hopper-sieve-outlet-sleeve' });
  // Dust hose from the spiral duct down beside the drum, and the coiled air line.
  const hx = dx - side * r * .5, hose = [[hx, 4.05, .6], [hx - side * .04, 3.3, .62], [hx + side * .02, top + .5, r * .86], [hx, deck + .55, r + .06], [hx + side * .05, deck + .16, r + .16]];
  output.tube(m.hoseGrey, hose, .085, { segments: 40, radial: 14, name: 'packaging-hopper-dark-flexible-duct' });
  const curve = new THREE.CatmullRomCurve3(hose.map(p => new THREE.Vector3(...p)), false, 'centripetal'), forward = new THREE.Vector3(0, 0, 1);
  for (let i = 1; i < 34; i++) output.put('ring:hose', () => new THREE.TorusGeometry(1, .1, 5, 14), m.hoseGrey, curve.getPoint(i / 34).toArray(), [.088, .088, .088], new THREE.Quaternion().setFromUnitVectors(forward, curve.getTangent(i / 34)), { shadow: false });
  output.ring(m.ssEdge, .092, .014, [hx, 4.05, .6], undefined, { seg: 18 });
  output.coil(m.yellow, [sx - side * (mw / 2 - .04), up + 1.5, md / 2 + .06], [sx - side * (mw / 2 - .02), deck + .5, md / 2 + .1], .06, 14, .011, { name: 'packaging-hopper-yellow-coiled-air-hose', shadow: false });
  finish(kits);
  root.userData.packagingEquipmentVersion = 3;
}
