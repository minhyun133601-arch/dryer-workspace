import * as THREE from '../shared/vendor/three.module.js';
import { PartKit, packagingMaterials, stackCartons, seeded, textPlate } from './packaging-kit.js';

// 3층 고정 구조: A-07 작업대·계단, 화물용 LIFT, 위치도의 문·비닐커튼·실 이름·PDA,
// 카드 사진의 호퍼 상부 덕트. 이동 설비는 packaging-mixing/storage-models가 맡는다.
const PI = Math.PI;

function plateGeometry(area, openings) {
  const shape = new THREE.Shape(); shape.moveTo(area.minX, area.minZ); shape.lineTo(area.maxX, area.minZ); shape.lineTo(area.maxX, area.maxZ); shape.lineTo(area.minX, area.maxZ); shape.closePath();
  for (const hole of openings) {
    const l = hole.x - hole.width / 2, r = hole.x + hole.width / 2, a = hole.z - hole.depth / 2, b = hole.z + hole.depth / 2;
    if (l <= area.minX || r >= area.maxX || a <= area.minZ || b >= area.maxZ) continue;
    const path = new THREE.Path(); path.moveTo(l, a); path.lineTo(l, b); path.lineTo(r, b); path.lineTo(r, a); path.closePath(); shape.holes.push(path);
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: .06, bevelEnabled: false, steps: 1, curveSegments: 1 }); g.rotateX(PI / 2); return g;
}

function railing(kit, m, y, [[x0, z0], [x1, z1]], name) {
  const length = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.round(length / 1.35));
  for (let i = 0; i <= n; i++) { const t = i / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t; kit.rod(m.ssEdge, [x, y, z], [x, y + 1.1, z], .024, { name: `${name}-stainless-rail-stanchions` }); }
  for (const h of [.38, .74, 1.1]) kit.rod(m.ssEdge, [x0, y + h, z0], [x1, y + h, z1], .024, { name: `${name}-three-level-pipe-rails` });
  const angle = -Math.atan2(z1 - z0, x1 - x0);
  kit.box(m.yellow, [length, .12, .03], [(x0 + x1) / 2, y + .07, (z0 + z1) / 2], [0, angle, 0], { name: `${name}-yellow-kickplates` });
}

function accessStair(s, group, kit, m, deck, stair, tone) {
  const { top, bottom, from, to, steps } = stair, y = deck.height, sign = Math.sign(top - bottom), run = Math.abs(top - bottom), z = (from + to) / 2, width = to - from - .08, prefix = `${deck.name}-${stair.id}`;
  const land = stair.landing, w = land.maxX - land.minX, d = land.maxZ - land.minZ, cx = (land.minX + land.maxX) / 2, cz = (land.minZ + land.maxZ) / 2;
  kit.box(m.checker, [w, .06, d], [cx, y - .03, cz], undefined, { name: `${prefix}-landing-deck-plate` });
  for (const px of [land.minX + .1, land.maxX - .1]) for (const pz of [land.minZ + .1, land.maxZ - .1]) kit.box(tone, [.12, y - .06, .12], [px, (y - .06) / 2, pz], undefined, { name: `${prefix}-landing-posts` });
  for (const pz of [land.minZ + .06, land.maxZ - .06]) kit.box(tone, [w, .18, .08], [cx, y - .15, pz], undefined, { name: `${prefix}-landing-beams` });
  for (const segment of stair.landingRails || []) railing(kit, m, y, segment, prefix);
  for (let i = 0; i < steps - 1; i++) {
    const x = bottom + sign * (i + .5) * run / (steps - 1), rise = (i + 1) * y / steps;
    kit.box(m.checkerSmall, [run / (steps - 1) + .02, .045, width], [x, rise - .022, z], undefined, { name: `${prefix}-stair-open-riser-treads` });
    kit.box(m.yellow, [.04, .012, width], [x - sign * (run / (steps - 1) / 2 - .01), rise + .005, z], undefined, { name: `${prefix}-yellow-nosing-strips`, shadow: false, solid: false });
  }
  for (const side of [-1, 1]) {
    const rz = z + side * (width / 2 + .03);
    kit.bar(tone, [bottom, .02, rz], [top, y - .1, rz], .2, .06, { name: `${prefix}-side-stringer-beams` });
    for (const h of [.55, 1.05]) kit.rod(m.ssEdge, [bottom, h, rz], [top, y + h, rz], .024, { name: `${prefix}-stair-handrails` });
    for (const t of [0, .34, .67, 1]) { const x = bottom + (top - bottom) * t; kit.rod(m.ssEdge, [x, y * t, rz], [x, y * t + 1.05, rz], .022, { name: `${prefix}-stair-handrails` }); }
    kit.cyl(m.yellow, .07, .9, [bottom - sign * .16, .45, rz], { seg: 16, name: `${prefix}-stair-bollards` });
    for (const h of [.18, .46, .74]) kit.cyl(m.black, .073, .12, [bottom - sign * .16, h, rz], { seg: 16, name: `${prefix}-stair-bollards-black-bands` });
  }
}

export function buildFloor3Decks(s, parent, decks) {
  const m = packagingMaterials(s);
  for (const deck of decks) {
    const g = s._group(parent); g.name = deck.name; g.userData.platformHeight = deck.height; g.userData.deckOpenings = deck.openings.map(entry => ({ ...entry }));
    const kit = new PartKit(s, g, `${deck.name}-steelwork-beams`), tone = deck.tone === 'cream' ? m.cream : m.greySteel, y = deck.height;
    for (const area of deck.areas) { const mesh = s._mesh(plateGeometry(area, deck.openings), m.checker, g, [0, y, 0]); mesh.name = `${deck.name}-checker-plate-deck-with-hopper-openings`; mesh.castShadow = true; mesh.receiveShadow = true; }
    for (const hole of deck.openings) for (const side of [-1, 1]) {
      kit.box(m.ssEdge, [.03, .1, hole.depth + .06], [hole.x + side * hole.width / 2, y + .03, hole.z], undefined, { name: `${deck.name}-opening-edge-curbs` });
      kit.box(m.ssEdge, [hole.width, .1, .03], [hole.x, y + .03, hole.z + side * hole.depth / 2], undefined, { name: `${deck.name}-opening-edge-curbs` });
    }
    const covers = (area, axis, v) => v >= area[`min${axis}`] - .12 && v <= area[`max${axis}`] + .12;
    for (const area of deck.areas) {
      for (const x of deck.beamsX.filter(v => covers(area, 'X', v))) kit.box(tone, [.16, .3, area.maxZ - area.minZ], [x, y - .21, (area.minZ + area.maxZ) / 2], undefined, { name: `${deck.name}-edge-and-cross-beams` });
      for (const z of deck.beamsZ.filter(v => covers(area, 'Z', v))) kit.box(tone, [area.maxX - area.minX, .24, .13], [(area.minX + area.maxX) / 2, y - .19, z], undefined, { name: `${deck.name}-edge-and-cross-beams` });
      for (let z = area.minZ + 1.2; z < area.maxZ - .4; z += 1.2) kit.box(m.frame, [area.maxX - area.minX - .06, .006, .014], [(area.minX + area.maxX) / 2, y + .002, z], undefined, { name: `${deck.name}-plate-joint-relief`, shadow: false, solid: false });
      for (let x = area.minX + 1.5; x < area.maxX - .4; x += 1.5) kit.box(m.frame, [.014, .006, area.maxZ - area.minZ - .06], [x, y + .002, (area.minZ + area.maxZ) / 2], undefined, { name: `${deck.name}-plate-joint-relief`, shadow: false, solid: false });
    }
    if (deck.grating) {
      // A-07's east bay is a grid deck: visible as 0.5 x 0.6 m panels from above.
      const a = deck.grating;
      for (let x = a.minX; x <= a.maxX + .01; x += (a.maxX - a.minX) / 5) kit.box(m.ssDark, [.03, .008, a.maxZ - a.minZ], [x, y + .004, (a.minZ + a.maxZ) / 2], undefined, { name: `${deck.name}-grid-relief`, shadow: false, solid: false });
      for (let z = a.minZ; z <= a.maxZ + .01; z += .6) kit.box(m.ssDark, [a.maxX - a.minX, .008, .022], [(a.minX + a.maxX) / 2, y + .004, z], undefined, { name: `${deck.name}-grid-relief`, shadow: false, solid: false });
    }
    for (const [x, z] of deck.posts) {
      kit.box(tone, [.16, y - .36, .16], [x, (y - .36) / 2, z], undefined, { name: `${deck.name}-square-posts` }); kit.box(m.frame, [.32, .03, .32], [x, .015, z], undefined, { name: `${deck.name}-post-baseplates` });
      // Haunches run only under the deck, never across a stair or an aisle.
      for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) if (deck.areas.some(a => x + dx * .5 > a.minX && x + dx * .5 < a.maxX && z + dz * .5 > a.minZ && z + dz * .5 < a.maxZ)) kit.bar(tone, [x, y - 1.02, z], [x + dx * .5, y - .34, z + dz * .5], .07, .07, { name: `${deck.name}-y-haunch-braces` });
    }
    for (const segment of deck.rails) railing(kit, m, y, segment, deck.name);
    for (const stair of deck.stairs) accessStair(s, g, kit, m, deck, stair, tone);
    kit.flush();
  }
}

// ---- 문 ---------------------------------------------------------------------
const doorMeta = (data, level, extra) => ({ proximityDoor: { enterable: true, groupId: `packaging:${level}:${data.id}`, label: data.name || '2팀 실내 출입문', accessBasis: 'registered partition gap and modelled room floor', kind: 'slide', axis: 'x', trigger: [0, 0, 0], width: data.width, height: data.height || 2.25, openDistance: 2.4, closeDistance: 3.3, ...extra } });

export function slidingDoor(s, g, data, level, glazed) {
  const m = packagingMaterials(s), w = data.width, h = data.height || 2.25, half = w / 2;
  const fixed = new PartKit(s, g, 'packaging-sliding-door-fixed-track');
  fixed.boxes(m.ssEdge, [[[w * 2, .09, .1], [0, h + .06, .1]], [[.07, h, .13], [-half, h / 2, 0]], [[.07, h, .13], [half, h / 2, 0]], [[w + .1, .07, .13], [0, h, 0]]]);
  fixed.flush();
  for (const side of [-1, 1]) {
    const leaf = s._group(g, [side * half / 2, 0, .115]), closed = side * half / 2, open = side * (half * 1.5 - .04);
    Object.assign(leaf.userData, { filmedOpenAngle: 0, ...doorMeta(data, level, { closed, open }) });
    const k = new PartKit(s, leaf, 'packaging-sliding-door-leaf'), lw = half - .01, lh = h - .05;
    const pane = lh * .46;
    k.box(m.panel, [lw, lh - pane - .16, .045], [0, (lh - pane - .16) / 2 + .02, 0]); k.box(m.panel, [lw, .14, .045], [0, lh - .07, 0]);
    for (const edge of [-1, 1]) { k.box(glazed ? m.blue : m.ssEdge, [.07, lh, .055], [edge * (lw / 2 - .035), lh / 2 + .01, 0]); k.box(glazed ? m.blue : m.ssEdge, [lw, .06, .055], [0, edge > 0 ? lh - .02 : .05, 0]); }
    k.box(m.glass, [lw - .14, pane, .02], [0, lh - .14 - pane / 2, 0], undefined, { shadow: false });
    k.box(m.ssEdge, [.05, .34, .05], [-side * (lw / 2 - .14), 1.05, .05]); k.box(m.red, [.28, .028, .006], [0, lh * .5, .026], undefined, { shadow: false });
    k.flush();
  }
}

// 위치도의 회색 막대(범례: 비닐커텐). 겹친 투명 띠를 양쪽으로 걷는다.
export function vinylCurtain(s, g, data, level) {
  const m = packagingMaterials(s), w = data.width, h = data.height, fixed = new PartKit(s, g, 'packaging-vinyl-curtain-header-rail');
  fixed.box(m.ssEdge, [w + .2, .1, .16], [0, h + .03, 0]); for (const side of [-1, 1]) fixed.box(m.yellow, [.08, h, .16], [side * (w / 2 + .04), h / 2, 0]);
  for (const side of [-1, 1]) for (let y = .15; y < h; y += .4) fixed.box(m.black, [.084, .16, .164], [side * (w / 2 + .04), y, 0], undefined, { shadow: false });
  fixed.flush();
  for (const side of [-1, 1]) {
    const leaf = s._group(g, [side * w / 4, 0, 0]), count = Math.round(w / 2 / .25), k = new PartKit(s, leaf, 'packaging-vinyl-curtain-hanging-strips');
    Object.assign(leaf.userData, { filmedOpenAngle: 0, ...doorMeta(data, level, { closed: side * w / 4, open: side * (w / 4 + w / 2 - .25), width: w, height: h }) });
    for (let i = 0; i < count; i++) k.box(m.vinylStrip, [.3, h - .06, .006], [(i + .5) * w / 2 / count - w / 4, (h - .06) / 2 + .02, i % 2 ? .018 : -.018], [0, i % 2 ? .06 : -.06, 0], { shadow: false, order: 2 });
    for (let i = 0; i < count; i++) k.box(m.ssEdge, [.28, .05, .012], [(i + .5) * w / 2 / count - w / 4, h - .04, i % 2 ? .018 : -.018]);
    k.flush();
  }
}

// ---- 화물용 LIFT -------------------------------------------------------------
export function freightLift(s, groups, lift) {
  const m = packagingMaterials(s), g = s._group(groups.structure), low = 1.15, high = 3, c = lift.car;
  g.name = 'packaging-three-ton-cargo-lift'; g.userData.capacity = lift.capacity; g.userData.car = { ...c };
  const base = new PartKit(s, g, 'packaging-cargo-lift-shaft-lower-panels'), upper = new PartKit(s, groups.ceiling, 'packaging-cargo-lift-shaft-upper-panels');
  const wall = (x0, z0, x1, z1) => {
    const along = Math.abs(x1 - x0) > Math.abs(z1 - z0), length = along ? x1 - x0 : z1 - z0, size = h => along ? [length, h, .12] : [.12, h, length];
    base.box(m.panel, size(low), [(x0 + x1) / 2, low / 2, (z0 + z1) / 2]); upper.box(m.panel, size(high - low), [(x0 + x1) / 2, (low + high) / 2, (z0 + z1) / 2]);
  };
  wall(lift.minX + .06, lift.minZ, lift.minX + .06, lift.maxZ); wall(lift.maxX - .06, lift.minZ, lift.maxX - .06, lift.maxZ);
  for (const z of [lift.minZ + .06, lift.maxZ - .06]) { wall(lift.minX, z, c.minX - .02, z); wall(c.maxX + .02, z, lift.maxX, z); upper.box(m.panel, [c.maxX - c.minX + .04, high - 2.35, .12], [(c.minX + c.maxX) / 2, (high + 2.35) / 2, z]); }
  upper.box(m.panel, [lift.maxX - lift.minX, .06, lift.maxZ - lift.minZ], [(lift.minX + lift.maxX) / 2, high + .03, (lift.minZ + lift.maxZ) / 2]);
  const cx = (c.minX + c.maxX) / 2, cz = (c.minZ + c.maxZ) / 2, cw = c.maxX - c.minX, cd = c.maxZ - c.minZ, car = new PartKit(s, g, 'packaging-cargo-lift-car-platform');
  s._box(groups.deck, [lift.maxX - lift.minX, .2, lift.maxZ - lift.minZ], [(lift.minX + lift.maxX) / 2, -.12, (lift.minZ + lift.maxZ) / 2], m.frame);
  car.box(m.ssDark, [lift.maxX - lift.minX - .24, .012, lift.maxZ - lift.minZ - .24], [(lift.minX + lift.maxX) / 2, .008, (lift.minZ + lift.maxZ) / 2], undefined, { name: 'packaging-cargo-lift-pit-floor', shadow: false, solid: false });
  car.box(m.checker, [cw - .06, .05, cd], [cx, .025, cz], undefined, { name: 'packaging-cargo-lift-car-checker-deck' });
  for (const side of [-1, 1]) { car.box(m.ss, [.04, 1.1, cd], [cx + side * (cw / 2 - .02), .58, cz]); car.rod(m.ssEdge, [cx + side * (cw / 2 - .09), .9, c.minZ + .1], [cx + side * (cw / 2 - .09), .9, c.maxZ - .1], .024); for (let z = c.minZ + .4; z < c.maxZ; z += .6) car.box(m.ssEdge, [.02, 1.06, .03], [cx + side * (cw / 2 - .045), .57, z]); }
  // Two-panel landing doors on both sides, with the plan's yellow marking.
  for (const [z, face] of [[lift.minZ + .02, -1], [lift.maxZ - .02, 1]]) {
    for (const side of [-1, 1]) { car.box(m.ss, [cw / 2 - .02, 2.28, .045], [cx + side * cw / 4, 1.15, z], undefined, { name: 'packaging-cargo-lift-stainless-double-doors' }); car.box(m.ssDark, [.012, 2.2, .05], [cx + side * .012, 1.15, z]); }
    for (const side of [-1, 1]) { car.box(m.yellow, [.1, 2.4, .16], [cx + side * (cw / 2 + .05), 1.2, z], undefined, { name: 'packaging-cargo-lift-yellow-door-jambs' }); for (let y = .2; y < 2.3; y += .42) car.box(m.black, [.104, .16, .164], [cx + side * (cw / 2 + .05), y, z], undefined, { shadow: false }); }
    car.box(m.yellow, [cw + .2, .1, .16], [cx, 2.38, z]); car.box(m.ssEdge, [cw, .03, .14], [cx, .02, z + face * .06]);
    car.box(m.yellow, [cw, .006, .5], [cx, .034, z + face * .36], undefined, { name: 'packaging-cargo-lift-yellow-sill-marking', shadow: false, solid: false });
  }
  const north = lift.minZ - .02; car.box(m.ssDark, [.16, .34, .05], [c.maxX + .35, 1.2, north]); car.box(m.display, [.1, .07, .02], [c.maxX + .35, 1.29, north - .03]); for (const y of [1.14, 1.22]) car.cyl(y > 1.2 ? m.green : m.redLamp, .022, .03, [c.maxX + .35, y - .02, north - .03], { axis: 'z', seg: 14 });
  // A-07 detail B: 100 mm guard pipes, 900 high, at both front corners.
  for (const side of [-1, 1]) {
    const x = side < 0 ? c.minX - .38 : c.maxX + .72, z = lift.minZ - .28;
    car.rods(m.yellow, [[[x - .34, 0, z], [x - .34, .9, z]], [[x + .34, 0, z], [x + .34, .9, z]], [[x - .34, .9, z], [x + .34, .9, z]]], .05, { seg: 14, name: 'packaging-cargo-lift-guard-pipes' });
    for (const px of [-.34, .34]) for (const y of [.2, .5]) car.cyl(m.black, .053, .14, [x + px, y, z], { seg: 14, name: 'packaging-cargo-lift-guard-bands' });
  }
  base.flush(); upper.flush(); car.flush();
  textPlate(s, g, '화물용 LIFT 3TON', { width: 1.25, height: .24, position: [cx, 2.6, north - .02], rotation: [0, PI, 0], background: '#23386b', color: '#ffffff', name: 'packaging-cargo-lift-sign' });
  // Orange arrow: the plan's material flow from the lift into the store.
  const arrow = new PartKit(s, groups.deck, 'packaging-lift-material-flow-arrow'); arrow.box(m.orange, [.12, .008, 1.35], [c.minX + .45, .032, 12.05], undefined, { shadow: false, solid: false });
  for (const side of [-1, 1]) arrow.box(m.orange, [.12, .008, .44], [c.minX + .45 + side * .13, .032, 11.42], [0, side * .72, 0], { shadow: false, solid: false }); arrow.flush();
}

// ---- 글자·PDA·소품 -------------------------------------------------------------
function pdaStation(s, parent, station, m, handhelds) {
  const g = s._group(parent, [station.x, station.y, station.z]); g.rotation.y = station.rotation; g.name = `packaging-pda-station-${station.id}`; g.userData.pda = station.label;
  const kit = handhelds.at([station.x, station.y, station.z], [0, station.rotation, 0]); let top = 0;
  if (station.mount === 'post') { kit.cyl(m.black, .16, .03, [0, .015, 0], { seg: 20 }); kit.cyl(m.signPost, .02, 1.08, [0, .55, 0], { seg: 12 }); kit.box(m.ssEdge, [.3, .02, .22], [0, 1.08, 0]); top = 1.09; }
  else if (station.mount === 'wall') { kit.box(m.ssEdge, [.26, .3, .02], [0, 0, .01]); kit.box(m.ssEdge, [.24, .02, .14], [0, -.1, .08]); top = -.09; }
  const z = station.mount === 'wall' ? .07 : 0, k = kit.at([0, top, z], [-.42, 0, 0]);
  kit.box(m.black, [.13, .05, .12], [0, top + .025, z]);
  k.box(m.black, [.088, .2, .03], [0, .16, 0]); k.box(m.pdaScreen, [.072, .115, .004], [0, .19, .017], undefined, { shadow: false }); k.box(m.ssDark, [.06, .04, .004], [0, .1, .017], undefined, { shadow: false });
  k.box(m.black, [.04, .13, .05], [0, .1, -.05], [.5, 0, 0]); k.box(m.orange, [.03, .03, .02], [0, .15, -.035]);
  const plateY = station.mount === 'table' ? .42 : station.mount === 'wall' ? .38 : 1.5;
  if (station.mount !== 'wall') kit.rod(m.signPost, [-.11, top, -.06], [-.11, plateY + .05, -.06], .008);
  for (const back of station.mount === 'wall' ? [0] : [0, 1]) textPlate(s, g, `PDA|${station.label}`, { width: .34, height: .18, position: [0, plateY, (station.mount === 'wall' ? .012 : -.06) + (back ? -.008 : .008)], rotation: [0, back ? PI : 0, 0], background: '#6f92d2', color: '#10203f', border: '#4f74b8', name: 'packaging-pda-location-plate' });
}

export function floor3Lettering(s, deck, layout) {
  const write = (text, x, y, z, size, rotation = 0) => textPlate(s, deck, text, { flat: true, color: '#f4f8ef', opacity: .82, width: Math.max(1, Array.from(text).length) * size * .98, height: size * 1.05, position: [x, y, z], rotation: [-PI / 2, 0, rotation], name: 'packaging-room-floor-lettering', scale: 1.08 });
  for (const room of layout.rooms) {
    if (room.text === false || ['materials-warehouse'].includes(room.id)) continue;
    const w = room.maxX - room.minX, d = room.maxZ - room.minZ, n = Array.from(room.name).length, size = Math.min(.62, d * .24, w / n * .9);
    write(room.name, (room.minX + room.maxX) / 2, .036, room.maxZ - Math.max(.42, d * .16), size);
  }
  write('원부자재 보관창고', 5.6, .036, 9.75, .78);
  for (const t of layout.floorTexts || []) write(t.text, t.x, .036, t.z, t.size, t.rotation || 0);
}

export function floor3Fixtures(s, groups, room) {
  const m = packagingMaterials(s), layout = room.layout, g = s._group(groups.structure); g.name = 'packaging-floor3-plan-fixtures';
  for (const t of layout.deckTexts || []) textPlate(s, g, t.text, { flat: true, color: '#fff7d6', opacity: .95, width: Array.from(t.text).length * t.size, height: t.size * 1.05, position: [t.x, t.y + .012, t.z], rotation: [-PI / 2, 0, 0], name: 'packaging-platform-deck-lettering' });
  // Raised checker tables beside each charging position.
  const tables = new PartKit(s, g, 'packaging-mixer-service-tables');
  for (const t of layout.serviceTables) {
    const top = t.deck + t.height; tables.box(m.checkerSmall, [.8, .035, .7], [t.x, top, t.z], undefined, { name: 'packaging-service-table-checker-tops' });
    for (const x of [-.36, .36]) for (const z of [-.31, .31]) tables.box(m.cream, [.055, t.height, .055], [t.x + x, t.deck + t.height / 2, t.z + z]);
    for (const x of [-.36, .36]) tables.box(m.cream, [.05, .05, .66], [t.x + x, t.deck + .16, t.z]);
    for (const x of [-.38, .38]) tables.rod(m.ssEdge, [t.x + x, top, t.z - .33], [t.x + x, top + .52, t.z - .33], .016); tables.rod(m.ssEdge, [t.x - .38, top + .52, t.z - .33], [t.x + .38, top + .52, t.z - .33], .016);
  }
  tables.flush();
  const handhelds = new PartKit(s, g, 'packaging-pda-handheld');
  for (const station of layout.pdaStations) pdaStation(s, g, station, m, handhelds);
  handhelds.flush();

  // Door-head plates, on the hall side of each wall.
  const heads = { 'store-door': 1, 'cip-room-door': 1, 'weigh-room-door': 1, 'remnant-store-door': 1, 'parts-store-door': -1, 'hygiene-door': -1, 'office-door': -1, 'front-room-door': 1, 'raw-store-door': -1 };
  for (const door of layout.doors) {
    const face = heads[door.id]; if (!face) continue;
    const turn = (door.rotation || 0) + (face < 0 ? PI : 0), y = (door.height || 2.25) + .28, off = .07, p = [door.x + Math.sin(turn) * off, y, door.z + Math.cos(turn) * off];
    textPlate(s, groups.ceiling, door.name, { width: Math.min(1.5, .22 * Array.from(door.name).length + .2), height: .24, position: p, rotation: [0, turn, 0], background: '#fbfbf8', color: '#1b2f63', top: '#25306b', bottom: '#7fbf3f', name: 'packaging-room-door-nameplate' });
  }

  // 사무실: 책상 두 벌과 수납장. 실내 집기는 실 용도에 맞춘 대표 형태다.
  const office = new PartKit(s, g, 'packaging-floor3-office-furniture');
  for (const x of [-15, -13.75]) {
    office.box(m.wood, [1.1, .035, .6], [x, .73, 14.78]); for (const dx of [-.5, .5]) office.box(m.frame, [.04, .72, .56], [x + dx, .36, 14.78]);
    office.box(m.black, [.5, .31, .03], [x, 1.02, 14.92]); office.box(m.screen, [.46, .27, .006], [x, 1.02, 14.9], undefined, { shadow: false }); office.box(m.black, [.16, .015, .14], [x, .755, 14.9]); office.box(m.black, [.04, .12, .03], [x, .82, 14.92]); office.box(m.black, [.4, .02, .13], [x, .76, 14.66]);
    office.cyl(m.black, .22, .07, [x, .46, 14.2], { seg: 20 }); office.box(m.black, [.4, .45, .06], [x, .78, 14.0]); office.cyl(m.ssDark, .03, .38, [x, .26, 14.2], { seg: 10 }); for (let i = 0; i < 5; i++) { const a = i * PI * .4; office.rod(m.ssDark, [x, .07, 14.2], [x + Math.cos(a) * .26, .05, 14.2 + Math.sin(a) * .26], .018); }
  }
  office.box(m.white, [.42, 1.7, .9], [-12.8, .85, 14.55]); office.box(m.frame, [.012, 1.6, .01], [-13.012, .85, 14.55]); office.box(m.white, [1.2, .8, .02], [-14.6, 1.6, 13.17]); office.flush();
  // 창고: 벽 선반.
  const store = new PartKit(s, g, 'packaging-floor3-store-shelving'), random = seeded(31);
  for (const x of [-15.45, -13.35]) { for (const z of [-15, -13.2]) store.box(m.rackPost, [.05, 1.9, .05], [x, .95, z]); }
  for (const y of [.18, .78, 1.38, 1.86]) store.box(m.shelf, [2.15, .03, .48], [-14.4, y, -14.82]);
  for (const x of [-15.45, -13.35]) store.box(m.rackPost, [.05, 1.9, .05], [x, .95, -14.6]);
  for (const y of [.2, .8, 1.4]) for (let i = 0; i < 4; i++) stackCartons(store, m, -15.15 + i * .5, y, -14.82, { w: .4, d: .36, height: .2, layers: 1 + Math.floor(random() * 2), nx: 1, nz: 1, random });
  store.flush();
}

export function hopperVentDrops(s, ducts, layout) {
  const m = packagingMaterials(s), kit = new PartKit(s, ducts, 'packaging-hopper-vertical-spiral-vents');
  for (const [i, v] of (layout.hopperVents || []).entries()) {
    const top = 5.02, low = 3.62 + (i % 3) * .06, x = v.x + (i % 2 ? .05 : -.04);
    kit.rod(m.duct, [11.35, 5.15, v.z], [x, top, v.z], .085, { seg: 16 }); kit.ball(m.duct, [.1, .1, .1], [x, top, v.z]);
    kit.cyl(m.duct, .1, .16, [x, top - .12, v.z], { bottom: .075, seg: 16 }); kit.cyl(m.duct, .075, top - .2 - low, [x, (top - .2 + low) / 2, v.z], { seg: 16 });
    for (let y = low + .12; y < top - .25; y += .16) kit.ring(m.ssEdge, .077, .005, [x, y, v.z], undefined, { seg: 16, shadow: false });
    if (i % 3 !== 1) { kit.ring(m.ssEdge, .08, .012, [x, low + .02, v.z], undefined, { seg: 16 }); kit.sack(m.clearCurtain, [.17, .2, .17], [x, low - .08, v.z], undefined, { shadow: false, pick: false, order: 2 }); }
    else kit.tube(m.rubber, [[x, low, v.z], [x - .04, low - .2, v.z + .03], [x - .02, 3.3, v.z + .04]], .07, { shadow: false, segments: 12, radial: 10 });
  }
  kit.flush();
}

// Roll of hose and its bracket on the east wall, and the disconnect box beside it.
export function stickWallServices(s, parent, x, deck) {
  const m = packagingMaterials(s), g = s._group(parent); g.name = 'packaging-stick-wall-services';
  const kit = new PartKit(s, g, 'packaging-stick-wall-hose-reel');
  kit.box(m.orange, [.06, .5, .46], [x - .05, deck + 1.6, -5.12]); for (const px of [-.02, .06, .14]) kit.ring(m.black, .24, .04, [x - .14 - px, deck + 1.62, -5.12], [0, PI / 2, 0], { seg: 22 });
  kit.tube(m.black, [[x - .2, deck + 1.4, -5.02], [x - .24, deck + .8, -5.0], [x - .3, deck + .3, -5.1]], .018, { shadow: false });
  kit.box(m.greySteel, [.14, .42, .34], [x - .08, deck + 1.42, -2.95]); textPlate(s, g, '조작금지', { width: .24, height: .1, position: [x - .155, deck + 1.5, -2.95], rotation: [0, -PI / 2, 0], background: '#ffffff', color: '#c3221f' });
  kit.rod(m.frame, [x - .06, deck + 1.63, -2.95], [x - .06, deck + 2.5, -2.95], .025); kit.flush();
}
