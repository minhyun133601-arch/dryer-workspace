import * as THREE from '../shared/vendor/three.module.js';

// Walls, doors, shutters and windows shared by the dryer tower and the team-2
// building. A wall is cut at `cut` metres: the lower part stays with the room
// cutaway, the upper part follows the full-height view. Openings are authored
// along the wall, so a frame can never leave its own hole.
const DOORS = Object.freeze({
  // 창호도 A-047~051 (준공 06.07.10) sizes. `leaf` names the visible finish.
  FSD1: { width: 1.8, height: 2.1, leaves: 2, leaf: 'fire', label: '갑종방화문' },
  FSD2: { width: 1, height: 2.1, leaves: 1, leaf: 'fire', label: '갑종방화문' },
  SD1: { width: 1, height: 2.1, leaves: 1, leaf: 'steel', label: '스틸 여닫이문' },
  PD1: { width: 2, height: 2.1, leaves: 2, leaf: 'panel', label: '판넬 양여닫이문' },
  PD2: { width: 1, height: 2.1, leaves: 1, leaf: 'panel', label: '판넬 여닫이문' },
  WD1: { width: 1, height: 2.1, leaves: 1, leaf: 'wood', label: '여닫이문' },
  WD2: { width: .8, height: 2, leaves: 1, leaf: 'wood', label: '여닫이문' },
  AD1: { width: .8, height: 2.1, leaves: 1, leaf: 'panel', label: '여닫이문' },
  SSD1: { width: 1.8, height: 2.1, leaves: 2, leaf: 'glass', label: '강화유리문', side: .4 },
  SSD2: { width: 1.8, height: 2.1, leaves: 2, leaf: 'glass', label: '강화유리문', side: .5 },
  SSD3: { width: 1.8, height: 2.1, leaves: 2, leaf: 'glass', label: '강화유리문' },
  SSD4: { width: 1, height: 2.1, leaves: 1, leaf: 'glass', label: '강화유리문' },
  SSD6: { width: 1.8, height: 2.1, leaves: 2, leaf: 'glass', label: '강화유리 미서기문', kind: 'slide' },
  SSD7: { width: .6, height: 1.5, sill: .3, leaves: 1, leaf: 'hatch', label: '점검문', enterable: false },
  CAD1: { width: 2, height: 2.1, leaves: 2, leaf: 'glass', label: '알루미늄 미서기문', kind: 'slide' },
  CAD3: { width: .8, height: 2.1, leaves: 1, leaf: 'halfglass', label: '알루미늄 여닫이문' },
  AUTO: { width: 1.2, height: 2.2, leaves: 2, leaf: 'glass', label: '자동문', kind: 'slide' },
  AIR: { width: 1.1, height: 2.2, leaves: 1, leaf: 'airshower', label: '에어샤워' },
  SWING: { width: 1, height: 2.1, leaves: 1, leaf: 'halfglass', label: '출입문' },
  SWING2: { width: 1.6, height: 2.1, leaves: 2, leaf: 'halfglass', label: '양개문' },
  SLIDE: { width: 1.6, height: 2.3, leaves: 1, leaf: 'panel', label: '미닫이문', kind: 'slide' },
  SHUTTER: { width: 3, height: 3, leaf: 'shutter', label: '셔터', kind: 'lift' },
  FAST: { width: 2.4, height: 2.6, leaf: 'fast', label: '고속셔터', kind: 'lift' },
  LIFT: { width: 1.4, height: 2.1, leaf: 'lift', label: '엘리베이터', enterable: false },
  HATCH: { width: .9, height: 1.1, leaf: 'transfer', label: '이송 개구', enterable: false },
  OPEN: { width: 1, height: 2.1, leaf: 'none', label: '개구' },
});

export const ARCHITECTURE_DOORS = DOORS;

const PAINT = {
  wall: [0xe4dfd0, .88, .02], outer: [0xe0dbc9, .84, .04], panel: [0xedf0ec, .74, .05], concrete: [0xd2cebf, .95, 0],
  dado: [0xf2f2ec, .78, .03], seam: [0xb9b6a8, .76, .12], panelSeam: [0xc6ccc8, .66, .18],
  cap: [0x4c5650, .95, 0], skirting: [0x185c3d, .42, .05], frame: [0xb9bfba, .36, .58], bronze: [0x8d8a7c, .5, .4],
  fire: [0x70767a, .62, .22], steel: [0xa7aba6, .5, .35], panelDoor: [0xe4e6e0, .72, .06], wood: [0xb28d58, .72, .02],
  handle: [0x2b3230, .4, .4], threshold: [0x8d938e, .5, .5], slat: [0xa9afaf, .45, .52], slatLine: [0x80878a, .55, .4],
  fast: [0xe07a26, .62, .05], lift: [0xc3cbce, .26, .78], hatch: [0xc9cdc8, .5, .35], column: [0xdad5c2, .76, .08],
  bolt: [0x8a928e, .42, .68],
  plinth: [0xeeece2, .86, .02], louver: [0xa9aea6, .55, .4], notice: [0xf1f1ea, .8, 0], blue: [0x2e5b9a, .6, .05],
};

export function createArchitectureKit(s, { key, level, prefix = key, structure, facade, fixtures, deck, cut = 1.1 }) {
  const paints = s.architectureKitPaint ||= {};
  const paint = (name) => {
    if (!paints[name]) {
      const [color, rough, metal] = PAINT[name];
      paints[name] = s._material(color, rough, metal, name === 'cap' ? { side: THREE.DoubleSide } : {});
    }
    return paints[name];
  };
  const glassPaint = (name) => paints[`glass:${name}`] ||= s._material(
    { amber: 0xe9ab0f, clear: 0xa9c4c2, frosted: 0xdde4de, blue: 0x9cc0cf }[name] ?? 0xa9c4c2, .28, .04,
    { transparent: true, opacity: { amber: .86, frosted: .82 }[name] ?? .3, depthWrite: false, side: THREE.DoubleSide });
  const exitPaint = () => paints.exit ||= s._material(0x35c07a, .5, 0, { emissive: 0x1f9c5c, emissiveIntensity: .8 });
  const unit = s.architectureKitUnit ||= (() => { const g = new THREE.BoxGeometry(1, 1, 1); s.geometries?.add(g); return g; })();
  const plane = s.architectureKitPlane ||= (() => { const g = new THREE.PlaneGeometry(1, 1); g.rotateX(-Math.PI / 2); s.geometries?.add(g); return g; })();
  const ball = s.architectureKitBall ||= (() => { const g = new THREE.SphereGeometry(1, 14, 10); s.geometries?.add(g); return g; })();
  const batches = new Map(), walls = [];
  const box = (parent, name, size, position, material) => {
    const node = s._mesh(unit, typeof material === 'string' ? paint(material) : material, parent, position);
    node.scale.set(...size); node.name = `${prefix}-${name}`; return node;
  };
  const batch = (parent, name, material, entry, geometry = unit) => {
    const id = `${parent.uuid}:${name}:${material.uuid}`;
    if (!batches.has(id)) batches.set(id, { parent, name, material, geometry, entries: [] });
    batches.get(id).entries.push(entry);
  };
  const scratch = new THREE.Object3D();
  // Frames, glass and shutter boxes never move: one instanced batch per material.
  const fixed = (root, name, size, position, material, { tilt = 0, collide = true } = {}) => {
    root.updateMatrix(); scratch.position.set(...position); scratch.rotation.set(tilt, 0, 0); scratch.scale.set(...size); scratch.updateMatrix();
    const paintOf = typeof material === 'string' ? paint(material) : material;
    batch(fixtures, collide ? name : `${name}-flush`, paintOf, { matrix: root.matrix.clone().multiply(scratch.matrix), flush: !collide });
  };
  const frameOf = (wall) => {
    const dx = wall.b[0] - wall.a[0], dz = wall.b[1] - wall.a[1], length = Math.hypot(dx, dz);
    return { length, ux: dx / length, uz: dz / length, rotation: -Math.atan2(dz, dx) };
  };
  const spec = (opening) => ({ ...(DOORS[opening.type] || {}), ...opening });

  function openingsOf(wall, length) {
    return (wall.openings || []).map((entry) => {
      const o = spec(entry), sill = o.sill ?? 0;
      return { ...o, sill, min: Math.max(0, o.offset - o.width / 2), max: Math.min(length, o.offset + o.width / 2), bottom: sill, top: Math.min(wall.height, sill + o.height) };
    }).filter((o) => o.max > o.min && o.top > o.bottom);
  }

  function wall(data) {
    const { length, ux, uz, rotation } = frameOf(data);
    if (!(length > .01)) return null;
    const thickness = data.thickness ?? .12, height = data.height, base = data.base ?? 0, finish = data.finish || 'wall';
    const low = data.cut ?? cut, gaps = openingsOf(data, length);
    const at = (along, y) => [data.a[0] + ux * along, y, data.a[1] + uz * along];
    const cuts = [...new Set([0, length, ...gaps.flatMap((g) => [g.min, g.max])])].sort((p, q) => p - q);
    const put = (from, to, bottom, top) => {
      if (to - from < .004 || top - bottom < .004) return;
      const middle = (from + to) / 2;
      for (const [parent, name, y0, y1] of [[structure, 'cutaway-walls', bottom, Math.min(top, low)], [facade, 'upper-walls', Math.max(bottom, low), top]]) {
        if (y1 - y0 < .004) continue;
        batch(parent, name, paint(finish), { position: at(middle, base + (y0 + y1) / 2), rotation, scale: [to - from, y1 - y0, thickness], wallId: data.id });
      }
      if (bottom < low && top >= low) batch(structure, 'wall-cut-faces', paint('cap'), { position: at(middle, base + low + .002), rotation, scale: [to - from, 1, thickness] }, plane);
      const sides = data.skirting === 'positive' ? [1] : data.skirting === 'negative' ? [-1] : [-1, 1];
      if ((data.skirting || finish === 'panel') && bottom < .01) for (const side of sides) {
        const p = at(middle, base + .075);
        batch(structure, 'wall-skirting', paint('skirting'), { position: [p[0] - uz * side * (thickness / 2 + .006), p[1], p[2] + ux * side * (thickness / 2 + .006)], rotation, scale: [to - from, .15, .012], flush: true });
      }
      // Site wall finishes: outer/ivory walls have a lower white dado (~0.98 m)
      // and horizontal panel seams; interior white panel walls have vertical seams.
      if ((finish === 'outer' || finish === 'wall') && to - from > .18) {
        const dadoSides = data.skirting === 'positive' ? [1] : data.skirting === 'negative' ? [-1] : finish === 'outer' ? [] : [-1, 1];
        const d0 = Math.max(bottom, .15), d1 = Math.min(top, .98, low);
        if (d1 - d0 > .08) for (const side of dadoSides) {
          const p = at(middle, base + (d0 + d1) / 2);
          batch(structure, 'wall-dado', paint('dado'), { position: [p[0] - uz * side * (thickness / 2 + .004), p[1], p[2] + ux * side * (thickness / 2 + .004)], rotation, scale: [to - from, d1 - d0, .008], flush: true });
          if (Math.abs(d1 - .98) < .02) {
            const capP = at(middle, base + .985);
            batch(structure, 'wall-dado-ledge', paint('seam'), { position: [capP[0] - uz * side * (thickness / 2 + .007), capP[1], capP[2] + ux * side * (thickness / 2 + .007)], rotation, scale: [to - from, .016, .014], flush: true });
          }
        }
        const seamSides = dadoSides.length ? dadoSides : [-1, 1];
        for (let sy = 1.0; sy < top - .06; sy += 1.0) {
          if (sy <= bottom + .06 || Math.abs(sy - low) < .03) continue;
          const target = sy < low ? structure : facade, p = at(middle, base + sy);
          for (const side of seamSides) batch(target, sy < low ? 'wall-h-seams-low' : 'wall-h-seams', paint('seam'), { position: [p[0] - uz * side * (thickness / 2 + .003), p[1], p[2] + ux * side * (thickness / 2 + .003)], rotation, scale: [to - from, .012, .006], flush: true });
        }
      } else if (finish === 'panel' && to - from > .5) {
        for (let sPos = Math.ceil(from / 1.0) * 1.0; sPos < to - .08; sPos += 1.0) {
          if (sPos <= from + .08) continue;
          for (const [parent, name, y0, y1] of [[structure, 'panel-v-seams-low', bottom, Math.min(top, low)], [facade, 'panel-v-seams', Math.max(bottom, low), top]]) {
            if (y1 - y0 < .08) continue;
            const p = at(sPos, base + (y0 + y1) / 2);
            for (const side of [-1, 1]) batch(parent, name, paint('panelSeam'), { position: [p[0] - uz * side * (thickness / 2 + .003), p[1], p[2] + ux * side * (thickness / 2 + .003)], rotation, scale: [.01, y1 - y0, .006], flush: true });
          }
        }
      }
    };
    for (let i = 1; i < cuts.length; i++) {
      const from = cuts[i - 1], to = cuts[i], middle = (from + to) / 2;
      const active = gaps.filter((g) => middle > g.min - 1e-6 && middle < g.max + 1e-6).sort((p, q) => p.bottom - q.bottom);
      let cursor = 0;
      for (const gap of active) { if (gap.bottom > cursor) put(from, to, cursor, gap.bottom); cursor = Math.max(cursor, gap.top); }
      if (cursor < height) put(from, to, cursor, height);
    }
    const marker = s._group(structure); marker.name = `${prefix}-wall-${data.id || walls.length + 1}`;
    Object.assign(marker.userData, { architecturalWall: true, wallId: data.id, wallOpenings: gaps, a: data.a, b: data.b, thickness, height, basis: data.basis, roomId: data.roomId });
    const record = { ...data, length, rotation, gaps, marker }; walls.push(record);
    for (const gap of gaps) if (!gap.external) fixture(record, gap, { at, rotation, thickness, base });
    return record;
  }

  // Local axes of one opening: x runs a→b, y is up, +z is the wall's left side.
  function fixture(data, o, { at, rotation, thickness, base }) {
    const centre = (o.min + o.max) / 2, width = o.max - o.min, root = s._group(fixtures, at(centre, base));
    root.rotation.y = rotation; root.name = `${prefix}-${o.window ? 'window' : 'door'}-${o.id || `${data.id}-${Math.round(centre * 100)}`}`;
    Object.assign(root.userData, { architecturalOpening: true, openingType: o.type || (o.window ? 'window' : 'opening'), openingWidth: width, openingHeight: o.height, sill: o.sill, wallId: data.id, basis: o.basis || data.basis, sourceTimesSeconds: o.times });
    if (o.window) return windowUnit(root, o, width, thickness);
    if (o.leaf === 'none') { jambs(root, width, o.height, thickness, 'frame', o.sill); return root; }
    if (o.leaf === 'transfer') { jambs(root, width, o.height, thickness, 'frame', o.sill); return root; }
    Object.assign(root.userData, { architecturalDoor: true, doorId: o.id, proximityOperated: o.enterable !== false, label: o.name || o.label });
    if (o.leaf === 'lift') return liftDoors(root, o, width, thickness);
    if (o.kind === 'lift') return shutter(root, data, o, width, thickness);
    if (o.kind === 'slide') return sliding(root, data, o, width, thickness);
    return swing(root, data, o, width, thickness);
  }

  function jambs(root, width, height, thickness, material, sill = 0) {
    const depth = thickness + .03;
    for (const x of [-width / 2 + .02, width / 2 - .02]) fixed(root, 'opening-frames', [.04, height, depth], [x, sill + height / 2, 0], material);
    fixed(root, 'opening-frames', [width, .045, depth], [0, sill + height - .0225, 0], material);
    if (sill > .05) fixed(root, 'opening-frames', [width, .04, depth], [0, sill + .02, 0], material);
  }

  function doorData(data, o, root, extra) {
    return { enterable: o.enterable !== false && (o.width >= .75 && o.height >= 1.9), groupId: `${key}:${level}:${o.id || root.name}`, label: o.name || o.label || '출입문',
      accessBasis: o.basis || data.basis || 'drawn opening in the modelled wall', trigger: [0, 0, 0], width: o.width, height: o.height, ...extra };
  }

  function swing(root, data, o, width, thickness) {
    const height = o.height, sill = o.sill, leaves = o.leaves || 1, side = o.side || 0, clear = width - side * 2;
    jambs(root, width, height, thickness, o.leaf === 'fire' ? 'fire' : 'frame', sill);
    if (sill < .05) fixed(root, 'door-thresholds', [width - .08, .016, thickness + .02], [0, .008, 0], 'threshold', { collide: false });
    for (const x of side ? [-width / 2 + side / 2, width / 2 - side / 2] : []) {
      fixed(root, 'door-fixed-sidelight', [side - .05, height - .1, .02], [x, height / 2, 0], glassPaint('clear'));
      fixed(root, 'door-sidelight-mullion', [.04, height, .08], [x - Math.sign(x) * side / 2, height / 2, 0], 'frame');
    }
    const leafWidth = (clear - .09) / leaves;
    for (let i = 0; i < leaves; i++) {
      const hinge = leaves === 2 ? (i ? 1 : -1) : (o.hinge ?? -1);
      const pivot = s._group(root, [hinge * (clear / 2 - .045), sill, 0]); pivot.name = `${prefix}-door-leaf`;
      const open = hinge * (o.swing ?? 1) * (o.openAngle ?? Math.PI * .5);
      if (o.enterable !== false) pivot.userData.proximityDoor = doorData(data, o, root, { kind: 'hinge', axis: 'y', closed: 0, open });
      pivot.userData.doorLeaf = true;
      leaf(pivot, o, leafWidth, height - .06, -hinge);
    }
    if (o.exit) {
      fixed(root, 'exit-sign-case', [.36, .2, .07], [o.exitOffset ?? 0, sill + height + .2, (o.exitSide ?? 1) * (thickness / 2 + .04)], 'handle');
      fixed(root, 'exit-sign-face', [.33, .17, .012], [o.exitOffset ?? 0, sill + height + .2, (o.exitSide ?? 1) * (thickness / 2 + .08)], exitPaint());
    }
    plate(root, o, height + sill, thickness);
    return root;
  }

  // Boxes of one leaf merge into one mesh per material.
  const leafCache = s.architectureKitLeaves ||= new Map();
  function merged(pivot, id, name, parts) {
    for (const [slot, material] of [...new Set(parts.map((part) => part.material))].entries()) {
      const cacheKey = `${id}:${slot}`;
      if (!leafCache.has(cacheKey)) {
        const position = [], normal = [], uv = [], index = [], geometry = new THREE.BufferGeometry();
        for (const part of parts) if (part.material === material) {
          const source = part.round ? ball : unit, p = source.attributes.position, n = source.attributes.normal, t = source.attributes.uv, offset = position.length / 3;
          for (let i = 0; i < p.count; i++) {
            position.push(p.getX(i) * part.size[0] + part.at[0], p.getY(i) * part.size[1] + part.at[1], p.getZ(i) * part.size[2] + part.at[2]);
            normal.push(n.getX(i), n.getY(i), n.getZ(i)); uv.push(t.getX(i), t.getY(i));
          }
          for (const i of source.index.array) index.push(i + offset);
        }
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3)); geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(index); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
        s.geometries?.add(geometry); leafCache.set(cacheKey, geometry);
      }
      const node = s._mesh(leafCache.get(cacheKey), material, pivot, [0, 0, 0]); node.name = `${prefix}-${name}`; s.geometries?.add(leafCache.get(cacheKey));
    }
  }
  function leaf(pivot, o, width, height, direction) {
    const parts = [], add = (size, at, material) => parts.push({ size, at, material: typeof material === 'string' ? paint(material) : material });
    const x = direction * width / 2, face = { fire: 'fire', steel: 'steel', panel: 'panelDoor', wood: 'wood', hatch: 'hatch', glass: 'frame', halfglass: 'panelDoor', airshower: 'frame' }[o.leaf] || 'panelDoor';
    const free = direction * (width - .1);
    const done = () => merged(pivot, `${o.leaf}:${o.notice}:${o.glass}:${width.toFixed(4)}:${height.toFixed(4)}:${direction}`, 'door-leaf-panel', parts);
    if (o.leaf === 'glass' || o.leaf === 'airshower') {
      add([width - .1, height - .2, .014], [x, height / 2 + .03, 0], glassPaint(o.glass || 'clear'));
      for (const xx of [direction * .035, direction * (width - .035)]) add([.07, height, .045], [xx, height / 2, 0], face);
      for (const [y, h] of [[.075, .15], [height - .05, .1]]) add([width, h, .045], [x, y, 0], face);
      for (const z of [-.05, .05]) add([.03, .5, .03], [free, 1.05, z], 'handle');
      return done();
    }
    add([width, height, .045], [x, height / 2, 0], face);
    if (o.leaf === 'halfglass') {
      add([width * .62, .74, .056], [x, height * .7, 0], 'frame');
      add([width * .54, .64, .062], [x, height * .7, 0], glassPaint(o.glass || 'clear'));
    }
    if (o.leaf === 'hatch') { for (const z of [-.03, .03]) add([.03, .12, .02], [free, height * .5, z], 'handle'); return done(); }
    if (o.leaf === 'fire') {
      add([.3, .06, .05], [direction * .24, height - .1, .045], 'handle');
      if (o.notice !== false) add([.2, .28, .006], [x, height * .72, .026], 'notice');
    }
    for (const z of [-.055, .055]) {
      if (o.leaf === 'fire' || o.leaf === 'steel') {
        parts.push({ size: [.034, .034, .034], at: [free, 1.02, z], material: paint('frame'), round: true });
      } else {
        add([.13, .026, .03], [free - direction * .04, 1.03, z], 'handle');
      }
    }
    for (const y of [.25, height - .25]) add([.03, .11, .06], [direction * .01, y, 0], 'frame');
    return done();
  }

  function plate(root, o, top, thickness) {
    if (!o.plate) return;
    const w = Math.min(1.3, .3 + o.plate.length * .13), face = o.plateSide ?? 1;
    const sign = s._group(root, [0, top + .16, face * (thickness / 2 + .03)]); sign.name = `${prefix}-door-plate`; sign.userData.text = o.plate;
    if (face < 0) sign.rotation.y = Math.PI;
    box(sign, 'door-plate-back', [w, .2, .02], [0, 0, 0], 'notice').userData.personCollision = false;
    const canvas = typeof document !== 'undefined' && document.createElement?.('canvas'), ctx = canvas && (canvas.width = 512, canvas.height = 80, canvas.getContext?.('2d'));
    if (!ctx) return;
    ctx.fillStyle = '#f1f1ea'; ctx.fillRect(0, 0, 512, 80); ctx.fillStyle = '#2e5b9a'; ctx.fillRect(0, 68, 512, 12);
    ctx.fillStyle = '#243a36'; ctx.font = '700 46px "Malgun Gothic", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(o.plate, 256, 35, 490);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; s.textures?.add(texture);
    const material = new THREE.MeshBasicMaterial({ map: texture }); s.materials?.add(material);
    const text = s._mesh(new THREE.PlaneGeometry(w, .2), material, sign, [0, 0, .012]); s.geometries?.add(text.geometry);
    text.castShadow = false; text.userData.personCollision = false; text.name = `${prefix}-door-plate-text`;
  }

  function sliding(root, data, o, width, thickness) {
    const height = o.height, leaves = o.leaves || 1, plane = (o.face ?? 1) * (thickness / 2 + .045);
    jambs(root, width, height, thickness, 'frame', o.sill);
    const span = leaves === 2 ? width * 2 : width * 2 + .2, shift = leaves === 2 ? 0 : (o.slide ?? 1) * (width / 2 + .05);
    // The rail stops at the wall ends instead of hanging past them.
    const middle = (o.min + o.max) / 2, reach = Math.max(width, span - .1) / 2;
    const railFrom = Math.max(shift - reach, Math.min(-width / 2, .02 - middle)), railTo = Math.min(shift + reach, Math.max(width / 2, (data.length ?? Infinity) - middle - .02));
    fixed(root, 'sliding-door-rail', [railTo - railFrom, .1, .09], [(railFrom + railTo) / 2, height + .06, plane], 'frame', { collide: false });
    const leafWidth = width / leaves;
    for (let i = 0; i < leaves; i++) {
      const direction = leaves === 2 ? (i ? 1 : -1) : (o.slide ?? 1);
      const closed = leaves === 2 ? direction * width / 4 : 0, panel = s._group(root, [closed, 0, plane]); panel.name = `${prefix}-sliding-leaf`;
      panel.userData.doorLeaf = true;
      if (o.enterable !== false) panel.userData.proximityDoor = doorData(data, o, root, { kind: 'slide', axis: 'x', closed, open: closed + direction * (leaves === 2 ? width / 2 - .02 : width), normal: [0, 0, 1], trigger: [0, 0, plane] });
      if (o.leaf === 'glass') {
        box(panel, 'sliding-glass', [leafWidth - .1, height - .2, .016], [0, height / 2, 0], glassPaint(o.glass || 'clear'));
        for (const x of [-leafWidth / 2 + .035, leafWidth / 2 - .035]) box(panel, 'sliding-stile', [.07, height - .02, .045], [x, height / 2, 0], 'frame');
        for (const y of [.08, height - .06]) box(panel, 'sliding-rail', [leafWidth, .1, .045], [0, y, 0], 'frame');
        if (o.type === 'CAD1') box(panel, 'sliding-midrail', [leafWidth, .05, .045], [0, height * .36, 0], 'frame');
      } else {
        box(panel, 'sliding-panel', [leafWidth, height - .02, .05], [0, height / 2, 0], o.leaf === 'fire' ? 'fire' : 'panelDoor');
        for (const y of [.1, height - .1]) box(panel, 'sliding-edge', [leafWidth, .06, .062], [0, y, 0], 'frame');
        for (const z of [-.04, .04]) box(panel, 'sliding-pull', [.05, .28, .03], [-direction * (leafWidth / 2 - .12), 1.05, z], 'handle');
      }
    }
    plate(root, o, height + .12, thickness);
    return root;
  }

  function shutter(root, data, o, width, thickness) {
    const height = o.height, plane = (o.face ?? 1) * (thickness / 2 + .05), material = o.leaf === 'fast' ? 'fast' : 'slat';
    jambs(root, width, height, thickness, 'frame', o.sill);
    for (const x of [-width / 2 - .02, width / 2 + .02]) fixed(root, 'shutter-guide', [.09, height + .05, .1], [x, height / 2, plane], 'frame');
    fixed(root, 'shutter-box', [width + .22, .36, .34], [0, height + .22, (o.face ?? 1) * (thickness / 2 + .18)], 'frame', { collide: false });
    const curtain = s._group(root, [0, 0, plane]); curtain.name = `${prefix}-shutter-curtain`; curtain.userData.doorLeaf = true;
    if (o.enterable !== false) curtain.userData.proximityDoor = doorData(data, o, root, { kind: 'lift', axis: 'y', closed: 0, open: height + .06, retract: true, trigger: [0, 0, plane], openDistance: 2.4, closeDistance: 3.2 });
    box(curtain, 'shutter-curtain-sheet', [width - .02, height - .02, .03], [0, height / 2, 0], material);
    const pitch = o.leaf === 'fast' ? .5 : .12, count = Math.floor((height - .1) / pitch);
    const lines = new THREE.InstancedMesh(unit, paint(o.leaf === 'fast' ? 'handle' : 'slatLine'), count * 2), dummy = new THREE.Object3D();
    for (let i = 0; i < count; i++) for (const [n, z] of [[0, -.018], [1, .018]]) {
      dummy.position.set(0, .08 + i * pitch, z); dummy.scale.set(width - .03, .014, .008); dummy.updateMatrix(); lines.setMatrixAt(i * 2 + n, dummy.matrix);
    }
    lines.name = `${prefix}-shutter-slats`; lines.userData.personCollision = false; lines.instanceMatrix.needsUpdate = true; lines.computeBoundingBox(); lines.computeBoundingSphere(); curtain.add(lines);
    box(curtain, 'shutter-bottom-bar', [width - .02, .1, .05], [0, .05, 0], 'frame');
    plate(root, o, height + .42, thickness);
    return root;
  }

  function liftDoors(root, o, width, thickness) {
    const height = o.height, face = (o.face ?? 1) * (thickness / 2 + .02);
    jambs(root, width, height, thickness, 'lift');
    for (const side of [-1, 1]) fixed(root, 'lift-door-leaf', [width / 2 - .05, height - .05, .04], [side * width / 4, height / 2, face - Math.sign(face) * .04], 'lift');
    fixed(root, 'lift-door-seam', [.012, height - .06, .05], [0, height / 2, face - Math.sign(face) * .04], 'handle');
    return root;
  }

  function windowUnit(root, o, width, thickness) {
    const height = o.height, sill = o.sill, kind = o.window, glass = glassPaint(o.glass || 'clear'), frame = o.frame || 'frame', depth = Math.min(.11, thickness + .02), place = o.face ? o.face * (thickness / 2 - depth / 2) : 0;
    const rect = (name, w, h, x, y, material = frame, d = depth, tilt = 0) => fixed(root, 'window-frames', [w, h, d], [x, y, place], material, { tilt });
    for (const y of [sill + .025, sill + height - .025]) rect('window-rail', width, .05, 0, y);
    for (const x of [-width / 2 + .025, width / 2 - .025]) rect('window-jamb', .05, height, x, sill + height / 2);
    if (kind === 'louver') {
      const count = Math.max(3, Math.floor((height - .1) / .11));
      for (let i = 0; i < count; i++) rect('louver-blade', width - .08, .022, 0, sill + .08 + i * (height - .12) / count, 'louver', depth, .6);
      return root;
    }
    const pane = (w, h, x, y) => fixed(root, 'window-glass', [w - .03, h - .03, .014], [x, y, place], glass);
    if (kind === 'two-tier') {
      // AW-6~9: fixed light above, pair of sliding sashes below, 2 m modules.
      const modules = Math.max(1, Math.round(width / (o.module ?? 2))), pitch = width / modules, upper = o.upper ?? .7, rail = sill + height - upper;
      rect('window-transom', width, .06, 0, rail);
      for (let i = 0; i < modules; i++) {
        const left = -width / 2 + i * pitch, middle = left + pitch / 2, full = o.lastFull && i === modules - 1;
        if (i) rect('window-mullion', .06, height, left, sill + height / 2);
        if (full) { for (const q of [-1, 1]) pane(pitch / 2 - .02, height - .08, middle + q * pitch / 4, sill + height / 2); rect('window-meeting-stile', .05, height, middle, sill + height / 2); continue; }
        pane(pitch - .05, upper - .06, middle, rail + upper / 2);
        for (const q of [-1, 1]) pane(pitch / 2 - .04, height - upper - .08, middle + q * pitch / 4, sill + (height - upper) / 2);
        rect('window-meeting-stile', .05, height - upper, middle, sill + (height - upper) / 2);
      }
      return root;
    }
    if (kind === 'strip') {
      // AW-11~13: one continuous stair strip, fixed lights with vents between.
      let y = sill; const lights = o.lights || [1, 1, .5], count = lights.length;
      for (let i = 0; y < sill + height - .12; i++) {
        const h = Math.min(lights[i % count], sill + height - y); pane(width - .06, h - .03, 0, y + h / 2); y += h;
        if (y < sill + height - .05) rect('window-transom', width, .05, 0, y);
        if (lights[i % count] <= .5 && width > 1) rect('window-vent-mullion', .05, h, 0, y - h / 2);
      }
      return root;
    }
    if (kind === 'slide') {
      pane(width / 2 - .03, height - .08, -width / 4, sill + height / 2); pane(width / 2 - .03, height - .08, width / 4, sill + height / 2);
      rect('window-meeting-stile', .06, height, 0, sill + height / 2); return root;
    }
    // Fixed glazing, optionally divided into bays.
    const bays = Math.max(1, Math.round(width / (o.module ?? 10)));
    for (let i = 0; i < bays; i++) { pane(width / bays - .04, height - .07, -width / 2 + (i + .5) * width / bays, sill + height / 2); if (i) rect('window-mullion', .05, height, -width / 2 + i * width / bays, sill + height / 2); }
    return root;
  }

  // Steel H columns with bolted splice plates (2x6 bolts), white concrete plinth and green foot band.
  function column({ x, z, height, size = .4, plinth = null, cover = 0, axis = 'x' }) {
    const y = height / 2, web = .016, flange = .024;
    if (cover) {
      batch(structure, 'covered-columns', paint('column'), { position: [x, Math.min(cut, height) / 2, z], scale: [cover, Math.min(cut, height), cover] });
      if (height > cut) batch(facade, 'covered-columns-upper', paint('column'), { position: [x, (height + cut) / 2, z], scale: [cover, height - cut, cover] });
      batch(structure, 'column-cut-faces', paint('cap'), { position: [x, cut + .003, z], scale: [cover, 1, cover] }, plane);
      batch(structure, 'covered-column-feet', paint('skirting'), { position: [x, .075, z], scale: [cover + .02, .15, cover + .02], flush: true });
    } else {
      for (const side of [-1, 1]) batch(structure, 'steel-columns', paint('column'), { position: axis === 'x' ? [x, y, z + side * (size / 2 - flange / 2)] : [x + side * (size / 2 - flange / 2), y, z], scale: axis === 'x' ? [size, height, flange] : [flange, height, size] });
      batch(structure, 'steel-columns', paint('column'), { position: [x, y, z], scale: axis === 'x' ? [web, height, size - .05] : [size - .05, height, web] });
      if (height >= 3.2) {
        const sy = Math.min(1.28, height * .28), plateH = .48, plateW = size * .86;
        for (const side of [-1, 1]) {
          const offset = side * (size / 2 + .01);
          const pos = axis === 'x' ? [x, sy, z + offset] : [x + offset, sy, z];
          const sc = axis === 'x' ? [plateW, plateH, .016] : [.016, plateH, plateW];
          batch(structure, 'column-splice-plates', paint('column'), { position: pos, scale: sc, flush: true });
          for (const col of [-plateW * .28, plateW * .28]) for (let row = 0; row < 6; row++) {
            const by = sy - plateH * .38 + row * (plateH * .76 / 5);
            const bpos = axis === 'x' ? [x + col, by, z + side * (size / 2 + .022)] : [x + side * (size / 2 + .022), by, z + col];
            const bsc = axis === 'x' ? [.022, .022, .018] : [.018, .022, .022];
            batch(structure, 'column-splice-bolts', paint('bolt'), { position: bpos, scale: bsc, flush: true });
          }
        }
      }
    }
    const foot = plinth || (!cover ? { size: size + .16, height: .34 } : null);
    if (foot) {
      batch(structure, 'column-plinths', paint('plinth'), { position: [x, foot.height / 2 + .07, z], scale: [foot.size, foot.height, foot.size] });
      batch(structure, 'column-plinth-feet', paint('skirting'), { position: [x, .07, z], scale: [foot.size + .025, .14, foot.size + .025] });
    }
  }

  function finish() {
    const dummy = new THREE.Object3D();
    for (const { parent, name, material, geometry, entries } of batches.values()) {
      const mesh = new THREE.InstancedMesh(geometry, material, entries.length);
      entries.forEach((entry, index) => {
        if (entry.matrix) { mesh.setMatrixAt(index, entry.matrix); return; }
        dummy.position.set(...entry.position); dummy.rotation.set(0, entry.rotation || 0, 0); dummy.scale.set(...entry.scale); dummy.updateMatrix(); mesh.setMatrixAt(index, dummy.matrix);
      });
      mesh.name = `${prefix}-${name}`; mesh.userData.buildingColumn = /column/.test(name); mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingBox(); mesh.computeBoundingSphere();
      mesh.receiveShadow = true; mesh.castShadow = geometry === unit && name !== 'wall-skirting';
      if (geometry === plane || name === 'wall-skirting' || entries[0].flush) mesh.userData.personCollision = false;
      if (name === 'window-glass') mesh.userData.windowGlass = true;
      parent.add(mesh);
    }
    batches.clear();
    return walls;
  }
  return { wall, column, finish, box, paint, glass: glassPaint, walls };
}
