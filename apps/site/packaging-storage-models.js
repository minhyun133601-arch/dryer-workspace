import * as THREE from '../shared/vendor/three.module.js';
import { PartKit, goods, packagingMaterials, seeded, stackCartons, textPlate } from './packaging-kit.js';

// Location 라벨(P3-3층-A~L)의 렉과 평치. 라벨·위치·종류는 2026-11-24 위치도를 따르고
// 렉 형식은 현장 사진의 남색 기둥·주황 보·적갈색 팔레트다. 적재물은 예시이며
// 「적재물 표시」로 끌 수 있다.
const PI = Math.PI;
const hash = text => Array.from(String(text)).reduce((sum, c) => (sum * 31 + c.codePointAt(0)) >>> 0, 7);

function parts(s, root, item) {
  const offsets = [[0, 0, -.9], [0, 1.3, 0], [0, .9, .9]];
  return item.parts.map((name, i) => {
    const group = s._part(root, name, offsets[i]);
    group.name = `${item.id}-${['frame', 'cargo', 'label'][i]}`; return group;
  });
}

const LOCATION_STYLE = { background: '#6f92d2', color: '#10203f', border: '#4f74b8' };
export function locationPlate(s, parent, label, position, rotation, width = .95) {
  return textPlate(s, parent, label, { ...LOCATION_STYLE, width, height: width * .3, position, rotation, name: 'packaging-location-label-plate' });
}

function slotStrip(s, parent, texts, width, position) {
  let material;
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas'), c = (canvas.width = 2048, canvas.height = 48, canvas.getContext('2d'));
    if (c) {
      const cell = 2048 / texts.length, w = 2048 * .3 / width;
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = '700 34px "Malgun Gothic", sans-serif';
      texts.forEach((text, i) => { const x = (i + .5) * cell; c.fillStyle = '#6f92d2'; c.fillRect(x - w / 2, 0, w, 48); c.fillStyle = '#f4f2e7'; c.fillRect(x - w / 2 + 3, 3, w - 6, 42); c.fillStyle = '#23386b'; c.fillText(text, x, 26); });
      const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4; s.textures?.add(map);
      material = s._material(0xffffff, .8, .02, { map, alphaTest: .5 });
    }
  }
  const mesh = s._mesh(new THREE.PlaneGeometry(width, .1), material || packagingMaterials(s).label, parent, position);
  mesh.name = 'packaging-rack-slot-labels'; mesh.castShadow = false; mesh.userData.personCollision = false; mesh.userData.printedText = texts.join(' ');
}

function rack(s, root, item) {
  const m = packagingMaterials(s), groups = parts(s, root, item);
  const along = item.alongZ ? item.depth : item.width, depth = item.alongZ ? item.width : item.depth, h = item.height;
  const turn = item.alongZ ? (item.face < 0 ? -PI / 2 : PI / 2) : item.face < 0 ? PI : 0;
  const [frame, cargo, label] = groups.map(group => { const g = s._group(group); g.rotation.y = turn; return g; });
  const f = new PartKit(s, frame, 'packaging-rack-frame'), c = new PartKit(s, cargo, 'packaging-rack-cargo');
  const random = seeded(hash(item.id)), small = item.loads === 'small', tiers = item.tiers || 3;
  const segments = item.segments || [[-along / 2, along / 2, item.bays || Math.max(1, Math.round(along / 2.6))]];
  const zPost = depth / 2 - .045, levels = small ? Array.from({ length: tiers }, (_, i) => .14 + i * (h - .5) / Math.max(1, tiers - 1)) : [0, 1.42, 2.56].slice(0, tiers);
  // Beams cannot run through a post, so a drawing column inside the run leaves
  // a real gap between two independent rack lengths.
  for (const [from, to, bays] of segments) {
    const bay = (to - from) / bays;
    for (let i = 0; i <= bays; i++) {
      const x = from + i * bay;
      for (const z of [-zPost, zPost]) {
        f.box(m.rackPost, [.085, h, .07], [x, h / 2, z], undefined, { name: 'packaging-rack-navy-upright-posts' });
        f.box(m.rackPost, [.17, .012, .15], [x, .006, z]);
        for (let y = .35; y < h - .15; y += .42) f.box(m.black, [.03, .05, .004], [x, y, z + Math.sign(z) * .036], undefined, { shadow: false });
      }
      let side = 1;
      for (let y = .28; y < h - .55; y += .78, side *= -1) {
        f.rod(m.rackPost, [x, y, -zPost * side], [x, y + .78, zPost * side], .018, { name: 'packaging-rack-side-z-bracing' });
        f.rod(m.rackPost, [x, y, -zPost], [x, y, zPost], .016, { name: 'packaging-rack-side-z-bracing' });
      }
      f.rod(m.rackPost, [x, h - .1, -zPost], [x, h - .1, zPost], .016, { name: 'packaging-rack-side-z-bracing' });
      if (!small) f.box(m.yellow, [.15, .34, .02], [x, .19, zPost + .06], undefined, { name: 'packaging-rack-yellow-post-guards' });
    }
    for (let i = 0; i < bays; i++) {
      const cx = from + (i + .5) * bay, inner = bay - .09;
      levels.forEach((y, tier) => {
        if (y > 0) {
          for (const z of [-zPost, zPost]) {
            f.box(m.rackBeam, [inner, .115, .05], [cx, y - .06, z], undefined, { name: 'packaging-rack-orange-beams' });
            for (const end of [-1, 1]) f.box(m.rackBeam, [.05, .19, .062], [cx + end * (inner / 2 + .005), y - .07, z]);
          }
          if (small) f.box(m.shelf, [inner, .025, depth - .06], [cx, y + .008, 0], undefined, { name: 'packaging-rack-steel-shelf-panels' });
          else for (const px of [-.28, .28]) f.box(m.shelf, [.06, .03, depth - .08], [cx + px * bay, y + .005, 0], undefined, { name: 'packaging-rack-pallet-support-bars' });
        }
        const room = (levels[tier + 1] ?? h + (small ? .25 : .55)) - y - .2, base = y + .022;
        if (small) {
          // Half-width cells: cartons, sacks or pails, as in a weighed-lot rack.
          const cells = Math.max(2, Math.round(inner / .85)), cw = inner / cells;
          for (let n = 0; n < cells; n++) {
            if (random() < .12) continue;
            const x = cx + (n + .5) * cw - inner / 2, kind = random(), w = cw * .84, d = depth * .74;
            if (kind < .55) stackCartons(c, m, x, base, 0, { w, d, height: Math.min(.2, room / 2.2), layers: Math.max(1, Math.min(3, Math.floor(room / .22))), nx: 1, nz: 2, random });
            else if (kind < .8) for (let layer = 0; layer < Math.min(3, Math.floor(room / .13)); layer++) c.sack(random() < .5 ? m.whitePrint : m.kraftSack, [w, .13, d * .8], [x, base + .06 + layer * .12, 0], [0, (random() - .5) * .08, 0]);
            else for (const px of [-.2, .2]) for (const pz of [-.2, .2]) { c.cyl(m.white, Math.min(.12, w * .24), .26, [x + px * w, base + .13, pz * depth], { seg: 14 }); c.cyl(m.blueCap, Math.min(.125, w * .25), .03, [x + px * w, base + .275, pz * depth], { seg: 14 }); }
          }
        } else for (const px of [-.25, .25]) {
          if (random() < (tier === 0 ? .06 : .12)) continue;
          goods(c, m, cx + px * bay, base, 0, item.loads === 'mixed' ? ['carton', 'sack', 'carton', 'wrapped'][Math.floor(random() * 4)] : item.loads === 'wrapped' && tier < 2 ? 'carton' : item.loads, random, Math.min(1.08, room - .12));
        }
      });
    }
    // Row spacers tie the back posts near the top.
    f.box(m.rackPost, [to - from, .05, .04], [(from + to) / 2, h - .12, -zPost]);
  }
  f.flush(); c.flush();
  const face = zPost + .06, top = levels.length > 1 ? levels.at(-1) - .06 : h - .2;
  const [a, b] = segments.reduce((best, seg) => seg[1] - seg[0] > best[1] - best[0] ? seg : best);
  const l = new PartKit(s, label, 'packaging-location-label-bracket');
  const signs = along > 9 ? segments.map(seg => (seg[0] + seg[1]) / 2) : [(a + b) / 2];
  for (const x of signs) {
    const y = small ? h + .22 : top + .04, w = small ? .86 : 1.15;
    l.box(m.signPost, [w + .05, w * .3 + .05, .02], [x, y, face]);
    for (const back of [0, 1]) locationPlate(s, label, item.locationLabel, [x, y, face + (back ? -.013 : .013)], [0, back ? PI : 0, 0], w);
    if (small) for (const px of [-.3, .3]) l.box(m.signPost, [.025, .42, .025], [x + px, h + .02, zPost]);
  }
  // A1/A2/A3 단마다 1~10번 칸 표지. 다섯 칸씩 한 띠에 인쇄한다.
  (item.tierCodes || []).forEach((code, tier) => {
    const [from, to] = segments[0], slots = item.slots || 10, half = slots / 2, strip = (to - from) / 2;
    for (const part of [0, 1]) slotStrip(s, label, Array.from({ length: half }, (_, n) => `${code}-${part * half + n + 1}`), strip, [from + (part + .5) * strip, levels[tier] - .045, face - .02]);
  });
  l.flush();
  root.userData.packagingCargo = groups[1];
}

function floorStorage(s, root, item) {
  const m = packagingMaterials(s), [lines, cargo, label] = parts(s, root, item);
  const { width: w, depth: d } = item, y = (item.platformHeight || 0) + .028, t = .07;
  const f = new PartKit(s, lines, 'packaging-floor-storage-yellow-outline'), c = new PartKit(s, cargo, 'packaging-floor-storage-cargo');
  for (const z of [-d / 2 + t / 2, d / 2 - t / 2]) f.box(m.zoneLine, [w, .008, t], [0, y, z], undefined, { shadow: false, solid: false });
  for (const x of [-w / 2 + t / 2, w / 2 - t / 2]) f.box(m.zoneLine, [t, .008, d - t * 2], [x, y, 0], undefined, { shadow: false, solid: false });
  const [nx, nz] = item.grid, random = seeded(hash(item.id)), px = w / nx, pz = d / nz, size = Math.min(1.1, px - .05, pz - .08);
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const x = (i + .5) * px - w / 2, z = (j + .5) * pz - d / 2;
    // Corner brackets mark the pallet positions inside the outline.
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      f.box(m.zoneLine, [.16, .006, .035], [x + sx * (size / 2 - .03), y - .001, z + sz * (size / 2 + .03)], undefined, { shadow: false, solid: false });
      f.box(m.zoneLine, [.035, .006, .16], [x + sx * (size / 2 + .03), y - .001, z + sz * (size / 2 - .03)], undefined, { shadow: false, solid: false });
    }
    if (random() < .14) continue;
    goods(c, m, x + (random() - .5) * .04, y - .004, z + (random() - .5) * .04, item.stack, random, item.stack === 'sack-low' ? .8 : item.stack === 'wrapped' ? 1.15 : 1.2);
  }
  f.flush(); c.flush();
  const l = new PartKit(s, label, 'packaging-location-sign-post'), [sx, sz] = item.signAt || [-w / 2, -d / 2], turn = item.signTurn || 0, base = item.platformHeight || 0;
  l.cyl(m.black, .17, .04, [sx, base + .03, sz], { seg: 20 }); l.cyl(m.signPost, .022, 1.53, [sx, base + .795, sz], { seg: 10 });
  const sign = s._group(label, [sx, base + 1.72, sz]); sign.rotation.y = turn;
  const plate = new PartKit(s, sign, 'packaging-location-sign-backing');
  plate.box(m.signPost, [1.02, .33, .022], [0, 0, 0]); plate.flush();
  for (const back of [0, 1]) locationPlate(s, sign, item.locationLabel, [0, 0, back ? -.013 : .013], [0, back ? PI : 0, 0], .97);
  l.flush();
  if (w > 1.5) textPlate(s, label, `${item.locationLabel}  평치`, { flat: true, color: '#fff3c4', opacity: .9, width: Math.min(w * .82, 3.1), height: Math.min(w * .82, 3.1) * .16, position: [0, y + .01, d / 2 + .24], rotation: [-PI / 2, 0, 0], name: 'packaging-location-floor-lettering' });
  root.userData.packagingCargo = cargo;
}

const BUILDERS = { 'packaging-storage-rack': rack, 'packaging-floor-storage': floorStorage };
export function buildPackagingStorage(s, root, item) {
  const builder = BUILDERS[item.type];
  if (!builder) return false;
  builder(s, root, item); return true;
}

// Sacks waiting on the mixers' service tables follow the same cargo switch.
export function tableSacks(s, parent, tables) {
  const m = packagingMaterials(s), kit = new PartKit(s, parent, 'packaging-service-table-sacks'), random = seeded(91);
  for (const table of tables) for (let i = 0; i < (table.sacks || 0); i++) {
    kit.sack(table.z < -6 ? m.redPrint : m.kraftSack, [.4, .13, .56], [table.x - .12 + (random() - .5) * .03, table.deck + table.height + .08 + i * .115, table.z - .07], [0, PI / 2 + (random() - .5) * .06, 0]);
  }
  kit.flush();
}
