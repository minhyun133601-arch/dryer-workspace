import * as THREE from '../shared/vendor/three.module.js';
import { OUTDOOR_ROOM } from './outdoor-data.js';
import { createChillerModel } from './chiller-model.js';

const PI = Math.PI;
const TAU = PI * 2;

function texture(s, draw, width = 512, height = 512) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const result = new THREE.CanvasTexture(canvas); result.colorSpace = THREE.SRGBColorSpace;
  s.textures.add(result); return result;
}

function palette(s) {
  if (s.outdoorMaterials) return s.outdoorMaterials;
  let seed = 421;
  const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const asphalt = texture(s, (c, w, h) => {
    c.fillStyle = '#464d48'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 16000; i++) {
      const a = random(); c.fillStyle = a > .5 ? `rgba(225,225,214,${a * .14})` : `rgba(10,20,18,${a * .5})`;
      c.fillRect(random() * w, random() * h, 1 + random() * 2, 1 + random() * 2);
    }
    c.strokeStyle = '#525b55'; c.lineWidth = 1.2;
    for (let i = 0; i < 5; i++) {
      c.beginPath(); let x = random() * w, y = random() * h; c.moveTo(x, y);
      for (let j = 0; j < 6; j++) { x += random() * 50 - 22; y += random() * 25; c.lineTo(x, y); } c.stroke();
    }
  });
  asphalt.wrapS = asphalt.wrapT = THREE.RepeatWrapping; asphalt.repeat.set(7, 2);
  const blocks = texture(s, (c, w, h) => {
    c.fillStyle = '#8a8d80'; c.fillRect(0, 0, w, h);
    for (let row = 0; row < 8; row++) for (let col = -1; col < 5; col++) {
      const x = col * 128 + (row % 2) * 64;
      const light = Math.round(135 + random() * 25);
      c.fillStyle = `rgb(${light},${light + 2},${light - 8})`; c.fillRect(x + 2, row * 64 + 2, 124, 60);
      c.fillStyle = '#6e7569'; c.fillRect(x + 2, row * 64 + 61, 124, 1);
    }
    for (let i = 0; i < 9000; i++) { c.fillStyle = `rgba(35,42,28,${random() * .13})`; c.fillRect(random() * w, random() * h, 2, 2); }
    const moss = c.createLinearGradient(0, h * .6, 0, h); moss.addColorStop(0, 'rgba(39,52,29,0)'); moss.addColorStop(1, 'rgba(39,52,29,.37)');
    c.fillStyle = moss; c.fillRect(0, 0, w, h);
  });
  blocks.wrapS = blocks.wrapT = THREE.RepeatWrapping; blocks.repeat.set(7.5, 1);
  const retainingBlocks = blocks.clone(); retainingBlocks.repeat.set(4.2, 1.6); s.textures.add(retainingBlocks);
  const expandedMetal = texture(s, (c, w, h) => {
    c.clearRect(0, 0, w, h); c.strokeStyle = '#9ca9a6'; c.lineWidth = 3;
    for (let x = -h; x < w + h; x += 24) {
      c.beginPath(); c.moveTo(x, 0); c.lineTo(x + h, h); c.stroke();
      c.beginPath(); c.moveTo(x, 0); c.lineTo(x - h, h); c.stroke();
    }
  }, 256, 256);
  expandedMetal.wrapS = expandedMetal.wrapT = THREE.RepeatWrapping; expandedMetal.repeat.set(3, 3);
  const wetPatch = texture(s, (c, w, h) => {
    const gradient = c.createRadialGradient(w / 2, h / 2, 15, w / 2, h / 2, w * .48);
    gradient.addColorStop(0, 'rgba(20,31,23,.8)'); gradient.addColorStop(.55, 'rgba(20,31,23,.6)'); gradient.addColorStop(1, 'rgba(20,31,23,0)');
    c.fillStyle = gradient; c.fillRect(0, 0, w, h);
  }, 128, 128);
  const grille = (rust = false) => texture(s, (c, w, h) => {
    c.fillStyle = rust ? '#343932' : '#24302d'; c.fillRect(0, 0, w, h);
    c.fillStyle = rust ? '#a46736' : '#d7dcd3';
    for (let x = 0; x < w; x += 32) c.fillRect(x, 0, rust ? 8 : 6, h);
    for (let y = 0; y < h; y += 28) c.fillRect(0, y, w, rust ? 6 : 5);
    if (rust) for (let i = 0; i < 400; i++) {
      c.fillStyle = random() > .5 ? '#a4642e' : '#6e472c'; c.fillRect(random() * w, random() * h, 4 + random() * 12, 5 + random() * 8);
    }
  });
  const coilFins = texture(s, (c, w, h) => {
    c.fillStyle = '#273337'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 4) {
      c.fillStyle = '#445354'; c.fillRect(0, y, w, 1);
      c.fillStyle = '#202a2d'; c.fillRect(0, y + 2, w, 1);
    }
  }, 128, 128);
  const signTexture = (title, subtitle, color = '#216291') => texture(s, (c, w, h) => {
    c.fillStyle = '#e6e8de'; c.fillRect(0, 0, w, h); c.fillStyle = color; c.fillRect(0, h * .8, w, h * .2);
    c.fillStyle = '#21353c'; c.textAlign = 'center'; c.font = 'bold 54px sans-serif'; c.fillText(title, w / 2, h * .34);
    c.font = 'bold 42px sans-serif'; c.fillText(subtitle, w / 2, h * .64);
  }, 512, 320);
  const warning = texture(s, (c, w, h) => {
    c.fillStyle = '#b23423'; c.fillRect(0, 0, w, h); c.fillStyle = '#f2eee4'; c.fillRect(18, 18, w - 36, h - 36);
    c.fillStyle = '#242a2b'; c.textAlign = 'center'; c.font = 'bold 46px sans-serif'; c.fillText('질식 위험공간', w / 2, 95);
    c.font = 'bold 28px sans-serif'; c.fillText('관계자 외 출입금지', w / 2, 155);
    c.fillStyle = '#bd3e2d'; c.beginPath(); c.ellipse(w / 2, 260, 155, 72, 0, 0, TAU); c.fill();
    c.fillStyle = '#f5d95d'; c.font = 'bold 58px sans-serif'; c.fillText('위 험', w / 2, 280);
  }, 512, 400);
  s.outdoorMaterials = {
    asphalt: s._material(0xffffff, .98, 0, { map: asphalt }),
    block: s._material(0xffffff, .99, 0, { map: blocks }),
    retaining: s._material(0xa8aaa0, .99, 0, { map: retainingBlocks }),
    pad: s._material(0xc8c8b8, .97, .01),
    cladding: s._material(0xe1e6e1, .81, .12),
    shell: s._material(0xe2e6dc, .62, .2),
    silver: s._material(0xa5b0ab, .39, .75),
    frame: s._material(0x627a7b, .57, .62),
    grating: s._material(0xffffff, .62, .6, { map: expandedMetal, alphaTest: .45, side: THREE.DoubleSide }),
    vent: s._material(0x253735, .78, .15),
    grille: s._material(0xffffff, .72, .15, { map: grille() }),
    rustyGrille: s._material(0xffffff, .87, .3, { map: grille(true) }),
    rust: s._material(0x9a633b, .9, .25),
    coil: s._material(0xffffff, .72, .27, { map: coilFins }),
    cream: s._material(0xd9dcc5, .7, .16),
    duct: s._material(0x829497, .55, .6),
    rubber: s._material(0x293334, .95, .02),
    glass: s._material(0x849c96, .3, .24),
    wet: s._material(0xffffff, 1, 0, { map: wetPatch, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }),
    blue: s._material(0x2996b0, .63, .15),
    red: s._material(0x994c3d, .68, .33),
    yellow: s._material(0xefbd24, .51, .24),
    green: s._material(0x3b7b65, .55, .32),
    pumpGreen: s._material(0x139a72, .54, .28),
    fenceGreen: s._material(0x85b976, .72, .24),
    plasticBlue: s._material(0x126ec3, .46, .05),
    insulation: s._material(0xd6d9d0, .83, .08),
    sign100: s._material(0xffffff, .8, 0, { map: signTexture('100RT', '쿨링타워 물탱크') }),
    sign20: s._material(0xffffff, .8, 0, { map: signTexture('20RT', '쿨링타워 물탱크') }),
    signTank: s._material(0xffffff, .8, 0, { map: signTexture('냉각수', '패널 물탱크') }),
    signCooling20: s._material(0xffffff, .8, 0, { map: signTexture('20RT', '쿨링타워') }),
    signControl20: s._material(0xffffff, .8, 0, { map: signTexture('20RT', '컨트롤판넬') }),
    signUnit: s._material(0xffffff, .8, 0, { map: signTexture('실외기', '냉각 설비') }),
    signMix1: s._material(0xffffff, .8, 0, { map: signTexture('배합실 냉각기', '유니트 1') }),
    signMix2: s._material(0xffffff, .8, 0, { map: signTexture('배합실 냉각기', '유니트 2') }),
    signMix4: s._material(0xffffff, .8, 0, { map: signTexture('배합실 냉각기', '유니트 4') }),
    signAhu: s._material(0xffffff, .8, 0, { map: signTexture('AIR HANDLING UNIT', '공조기') }),
    signAhuControl: s._material(0xffffff, .8, 0, { map: signTexture('AHU-01', 'CONTROL PANEL') }),
    signDiscol: s._material(0xffffff, .8, 0, { map: signTexture('DISCOL', 'WOOYANG ENG') }),
    signFireBox: s._material(0xffffff, .8, 0, { map: texture(s, (c, w, h) => {
      c.fillStyle = '#aaa99d'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#302f29'; c.textAlign = 'center'; c.font = 'bold 62px sans-serif';
      [...'옥외소화전'].forEach((letter, i) => c.fillText(letter, w / 2, 92 + i * 85));
    }, 256, 512) }),
    warning: s._material(0xffffff, .85, 0, { map: warning }),
  };
  return s.outdoorMaterials;
}

function pipe(s, parent, points, radius = .065, material = palette(s).silver) {
  for (let i = 1; i < points.length; i++) s._bar(parent, points[i - 1], points[i], radius, material);
}

function torus(s, parent, r, tube, position, material, vertical = false, arc = TAU) {
  const mesh = s._mesh(new THREE.TorusGeometry(r, tube, 5, 28, arc), material, parent, position);
  if (!vertical) mesh.rotation.x = PI / 2; return mesh;
}

function sign(s, parent, material, position, width = .38, height = .28) {
  return s._box(parent, [width, height, .012], position, material);
}

function ladder(s, parent, x, z, height, yellow = false, cage = false) {
  const m = palette(s), material = yellow ? m.yellow : m.frame;
  for (const side of [-.29, .29]) {
    pipe(s, parent, [[x + side, .15, z], [x + side, height + .8, z]], .032, material);
    for (const y of [.3, height - .15]) pipe(s, parent, [[x + side, y, z], [x + side, y, z - .3]], .026, material);
  }
  for (let y = .35; y < height + .1; y += .29) pipe(s, parent, [[x - .3, y, z], [x + .3, y, z]], .024, material);
  if (cage) {
    for (let y = 2; y < height + .85; y += .73) torus(s, parent, .55, .027, [x, y, z + .26], material, false, PI * 1.75).rotation.z = PI * .125;
    for (const angle of [-PI * .75, -PI * .25, PI * .25, PI * .75]) {
      const px = x + Math.cos(angle) * .55, pz = z + .26 + Math.sin(angle) * .55;
      pipe(s, parent, [[px, 2, pz], [px, height + .78, pz]], .02, material);
    }
  }
}

function grille(s, parent, width, height, position, material) {
  return s._box(parent, [width, height, .035], position, material || palette(s).grille);
}

// Physical guards, rather than a generic louvre texture: the current cards
// show coarse white square grids over the dark coils of these older units.
function squareGuard(s, parent, width, height, position, material, pitch = .12) {
  const g = s._group(parent, position), m = palette(s);
  if (position[2] < 0) g.rotation.y = PI;
  s._box(g, [width, height, .025], [0, 0, -.025], m.coil);
  for (const x of [-width / 2, width / 2]) s._box(g, [.035, height + .04, .035], [x, 0, 0], material);
  for (const y of [-height / 2, height / 2]) s._box(g, [width + .04, .035, .035], [0, y, 0], material);
  for (let x = -width / 2 + pitch; x < width / 2; x += pitch) s._box(g, [.022, height, .026], [x, 0, .003], material);
  for (let y = -height / 2 + pitch; y < height / 2; y += pitch) s._box(g, [width, .022, .026], [0, y, .003], material);
  return g;
}

function doorVents(s, parent, x, y, z, width = .23, rows = 4) {
  const m = palette(s);
  for (let row = 0; row < rows; row++) {
    s._box(parent, [width, .012, .012], [x, y + row * .041, z], m.silver);
    s._box(parent, [width, .009, .015], [x, y + row * .041 + .012, z + Math.sign(z) * .004], m.shell);
  }
}

function pressedPanel(s, parent, width, height, position, side = false) {
  const m = palette(s), g = s._group(parent, position);
  if (side) g.rotation.y = PI / 2;
  s._box(g, [width - .035, height - .035, .025], [0, 0, 0], m.silver);
  // In cards 088/091 the pressed dome rolls gently into the flat flange.
  // Its outer ring stays circular even on the rectangular top-row sheets.
  const radius = Math.min(width, height) * .43;
  const crown = [[1, .014], [.96, .018], [.88, .034], [.70, .075], [.45, .107], [.22, .12], [0, .125]];
  const pressing = s._mesh(new THREE.LatheGeometry(crown.map(([fraction, depth]) => new THREE.Vector2(radius * fraction, depth)), 24), m.silver, g);
  pressing.rotation.x = PI / 2;
  for (const y of [-height / 2 + .035, height / 2 - .035]) {
    s._box(g, [width - .035, .018, .03], [0, y, .012], m.silver);
    for (const x of [-width * .25, 0, width * .25]) {
      s._cyl(g, .011, .02, [x, y, .028], m.frame, .011, 6).rotation.x = PI / 2;
    }
  }
  for (const x of [-width / 2 + .035, width / 2 - .035]) {
    s._box(g, [.018, height - .035, .03], [x, 0, .012], m.silver);
    for (const y of [-height / 2 + .055, 0, height / 2 - .055]) s._cyl(g, .012, .025, [x, y, .027], m.frame, .012, 6).rotation.x = PI / 2;
  }
  return g;
}

function fan(s, parent, x, y, z, radius = .5) {
  const m = palette(s);
  s._cyl(parent, radius, .055, [x, y, z], m.vent, radius, 24);
  for (let i = 0; i < 4; i++) {
    const a = i * PI / 2;
    const blade = s._box(parent, [radius * .8, .035, radius * .31], [x + Math.cos(a) * radius * .45, y + .045, z + Math.sin(a) * radius * .45], m.silver);
    blade.rotation.y = -a + .32;
  }
  for (const scale of [.45, .75, 1]) torus(s, parent, radius * scale, .013, [x, y + .08, z], m.vent);
  for (let i = 0; i < 6; i++) {
    const a = i * PI / 3; pipe(s, parent, [[x, y + .09, z], [x + Math.cos(a) * radius, y + .09, z + Math.sin(a) * radius]], .011, m.vent);
  }
  s._cyl(parent, .085, .1, [x, y + .07, z], m.vent, .085, 12);
}

function valve(s, parent, position, scale = 1) {
  const m = palette(s), g = s._group(parent, position); g.scale.setScalar(scale);
  s._cyl(g, .13, .3, [0, 0, 0], m.silver, .13, 12);
  for (const y of [-.18, .18]) s._cyl(g, .2, .055, [0, y, 0], m.silver, .2, 12);
  pipe(s, g, [[0, 0, 0], [0, 0, .25]], .045, m.silver);
  torus(s, g, .17, .025, [0, 0, .28], m.green, true);
  for (const a of [0, PI / 2]) pipe(s, g, [[-.15 * Math.cos(a), -.15 * Math.sin(a), .28], [.15 * Math.cos(a), .15 * Math.sin(a), .28]], .012, m.green);
  s._cyl(g, .055, .04, [0, 0, .3], m.red, .055, 10).rotation.x = PI / 2;
}

function gauge(s, parent, x, y, z, r = .085) {
  const m = palette(s); const g = s._cyl(parent, r, .055, [x, y, z], m.shell, r, 16); g.rotation.x = PI / 2;
  torus(s, parent, r, .012, [x, y, z + .03], m.silver, true);
  pipe(s, parent, [[x, y, z + .037], [x + r * .4, y + r * .5, z + .037]], .006, m.vent);
}

function cabinetGaugeWindow(s, parent, x, y, z, radius, spacing) {
  const m = palette(s), recessRadius = radius * 1.32;
  s._box(parent, [2 * spacing, 2 * recessRadius, .028], [x, y, z], m.frame);
  for (const end of [-1, 1]) {
    s._cyl(parent, recessRadius, .028, [x + end * spacing, y, z], m.frame, recessRadius, 20).rotation.x = PI / 2;
  }
  for (const dial of [-1, 0, 1]) gauge(s, parent, x + dial * spacing, y, z + .022, radius);
}

// Preserve each movable part and named subassembly, while drawing its many
// little rails, fins and bolts together. Geometry-only inspection remains
// unbatched; live WebGL construction uses the same vertices and triangle order.
function batchOutdoorMeshes(s, root) {
  if (!s.renderer?.isWebGLRenderer || !s.geometries) return;
  const discarded = new Set();
  root.updateWorldMatrix(true, true);
  const countMeshes = (group) => {
    let count = 0; group.traverse((object) => { if (object.isMesh) count++; }); return count;
  };
  const before = countMeshes(root);
  const visit = (group) => {
    const buckets = new Map(), inverse = group.matrixWorld.clone().invert();
    const collect = (parent) => {
      for (const child of [...parent.children]) {
        if (child.isGroup) {
          // Names identify observed bays, pumps, cabinets and air paths. Keeping
          // these boundaries also keeps their local transforms and inspection.
          if (child.name || !child.visible || Object.keys(child.userData).length) visit(child);
          else collect(child);
          continue;
        }
        if (!child.isMesh || child.name || !child.visible || Array.isArray(child.material) || child.material.transparent || child.isInstancedMesh || child.isSkinnedMesh) continue;
        const geometry = child.geometry;
        if (!geometry?.attributes.position || !geometry.attributes.normal || !geometry.attributes.uv ||
            Object.keys(geometry.attributes).some((name) => !['position', 'normal', 'uv'].includes(name)) ||
            Object.keys(geometry.morphAttributes).length || geometry.drawRange.start !== 0 || geometry.drawRange.count !== Infinity) continue;
        const key = `${child.material.uuid}:${child.castShadow}:${child.receiveShadow}:${child.renderOrder}`;
        if (!buckets.has(key)) buckets.set(key, []);
        buckets.get(key).push(child);
      }
    };
    collect(group);
    for (const meshes of buckets.values()) {
      if (meshes.length < 2) continue;
      const vertices = meshes.reduce((total, mesh) => total + mesh.geometry.attributes.position.count, 0);
      const indices = meshes.reduce((total, mesh) => total + (mesh.geometry.index?.count || mesh.geometry.attributes.position.count), 0);
      const positions = new Float32Array(vertices * 3), normals = new Float32Array(vertices * 3), uvs = new Float32Array(vertices * 2);
      const triangles = vertices > 65535 ? new Uint32Array(indices) : new Uint16Array(indices);
      let vertexOffset = 0, indexOffset = 0;
      for (const mesh of meshes) {
        const transformed = mesh.geometry.clone().applyMatrix4(inverse.clone().multiply(mesh.matrixWorld));
        positions.set(transformed.attributes.position.array, vertexOffset * 3);
        normals.set(transformed.attributes.normal.array, vertexOffset * 3);
        uvs.set(transformed.attributes.uv.array, vertexOffset * 2);
        const index = transformed.index;
        const count = index?.count || transformed.attributes.position.count;
        for (let i = 0; i < count; i++) triangles[indexOffset + i] = (index ? index.getX(i) : i) + vertexOffset;
        indexOffset += count; vertexOffset += transformed.attributes.position.count;
        transformed.dispose();
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
      geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
      geometry.setIndex(new THREE.BufferAttribute(triangles, 1));
      geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      const first = meshes[0], batch = s._mesh(geometry, first.material, group);
      batch.name = `outdoor-material-batch-${first.material.id}`;
      batch.castShadow = first.castShadow; batch.receiveShadow = first.receiveShadow; batch.renderOrder = first.renderOrder;
      batch.userData.outdoorBatch = { sourceMeshes: meshes.length };
      for (const mesh of meshes) { mesh.removeFromParent(); discarded.add(mesh.geometry); }
    }
    // Empty anonymous transforms no longer need per-frame matrix traversal.
    const prune = (parent) => {
      for (const child of [...parent.children]) {
        if (!child.isGroup) continue;
        prune(child);
        if (!child.children.length && !child.name && !Object.keys(child.userData).length) child.removeFromParent();
      }
    };
    prune(group);
  };
  visit(root);
  // A shared source geometry may still belong to an unbatched named mesh.
  // Dispose only when no remaining scene object references it.
  s.scene.traverse((object) => { if (object.geometry) discarded.delete(object.geometry); });
  for (const geometry of discarded) { geometry.dispose(); s.geometries.delete(geometry); }
  const stats = s.outdoorBatchStats ||= { originalMeshes: 0, renderedMeshes: 0 };
  stats.originalMeshes += before; stats.renderedMeshes += countMeshes(root);
}

export function buildOutdoorEnvironment(s, { factoryFacade = true } = {}) {
  const m = palette(s);
  const groups = {};
  for (const key of ['deck', 'structure', 'ducts']) {
    groups[key] = s._group(s.scene, OUTDOOR_ROOM.anchor); groups[key].rotation.y = OUTDOOR_ROOM.rotation;
  }
  const { deck, structure, ducts } = groups;
  // Two ground patches form the widened southwest apron and northeast aisle.
  const wallFace = OUTDOOR_ROOM.aisleWallZ;
  const aisleWidth = wallFace + 3.2, aisleCenter = (wallFace - 3.2) / 2;
  const end = Math.max(45, OUTDOOR_ROOM.length || 45), aisleCenterX = (end - 1) / 2;
  const facadeStart = 4.2, facadeLength = end + .4 - facadeStart, facadeCenter = (end + .4 + facadeStart) / 2;
  s._box(deck, [end + 1.1, .3, aisleWidth + .2], [aisleCenterX, -.18, aisleCenter], m.pad);
  s._box(deck, [end + 1, .035, aisleWidth + .08], [aisleCenterX, -.012, aisleCenter], m.asphalt);
  s._box(deck, [9, .3, 9.3], [1.1, -.18, -3.1], m.pad);
  s._box(deck, [8.9, .035, 9.2], [1.1, -.012, -3.1], m.asphalt);
  // Raised pads are a small step, not a fictitious GPS-derived slope.
  for (const [x, length] of [[8.8, 3.1], [12.6, 3.1], [15.4, 2.7], [19.3, 7.5], [26.2, 6], [31.8, 5.2], [39.5, 11]]) {
    s._box(deck, [length, .13, 3.35], [x, .065, -1.25], m.pad);
  }
  if (end > 45) {
    for (const [x, length, depth] of [[60, 6, 3.75], [67, 4.9, 3.65], [71, 3.6, 3.65], [81, 5.2, 2.8], [100, 4.6, 3], [106, 3.5, 3]]) {
      s._box(deck, [length, .12, depth], [x, .055, -1.05], m.pad);
    }
    // The final passage has green drain gratings beside concrete utility slabs.
    for (const x of [85.5, 93.5, 97.5, 103]) {
      s._box(deck, [2.2, .04, 1.15], [x, .014, .8], m.pad);
      s._box(deck, [.93, .055, .77], [x, .04, .75], m.vent);
      for (let dx = -.4; dx <= .41; dx += .1) s._box(deck, [.025, .025, .71], [x + dx, .08, .75], m.green);
      for (const dz of [-.35, 0, .35]) s._box(deck, [.85, .025, .027], [x, .08, .75 + dz], m.green);
    }
  }
  // Irregular dark patches follow the photographed wet central aisle.
  for (let i = 0; i < 18; i++) {
    const x = 7.5 + i * 1.4, z = .9 + Math.sin(i * 2.7) * .2;
    const stain = s._mesh(new THREE.PlaneGeometry(2.1 + (i % 4) * .2, 1.1), m.wet, deck, [x, .012, z]);
    stain.rotation.x = -PI / 2;
  }
  // Entry drain grate, with the rust tone and transverse slots seen in photos.
  s._box(deck, [1.05, .035, .75], [.1, .016, .65], m.rust);
  for (let row = 0; row < 5; row++) for (const x of [-.25, .1, .45]) {
    s._box(deck, [.27, .01, .055], [x, .038, .36 + row * .14], m.vent);
  }
  for (const x of [11.2, 22.8]) s._box(deck, [.015, .007, aisleWidth], [x, .011, aisleCenter], m.vent);

  // White factory facade: lower glazing and a second, high strip of windows.
  // The afternoon video continues beyond the former end. This straight
  // extension preserves observed adjacency without claiming surveyed distances.
  if (factoryFacade) {
  s._box(structure, [facadeLength, 5.8, .18], [facadeCenter, 2.9, -3.08], m.cladding);
  s._box(structure, [.18, 5.8, 3.8], [4.15, 2.9, -4.9], m.cladding);
  s._box(structure, [facadeLength + .1, .22, .36], [facadeCenter, 5.75, -2.98], m.silver);
  s._box(structure, [facadeLength + .1, .22, .08], [facadeCenter, .16, -2.95], m.vent);
  for (let x = 4.5; x < end + .5; x += .55) s._box(structure, [.012, 5.5, .015], [x, 3.02, -2.977], m.shell);
  for (const [y, h] of [[1.25, .9], [4.85, .48]]) {
    s._box(structure, [facadeLength - .5, h + .12, .08], [facadeCenter, y, -2.94], m.silver);
    s._box(structure, [facadeLength - .7, h, .085], [facadeCenter, y, -2.89], m.glass);
    for (let x = 4.65; x < end; x += 1.4) s._box(structure, [.055, h + .12, .09], [x, y, -2.84], m.shell);
    for (const py of [y - h / 2, y + h / 2]) s._box(structure, [facadeLength - .5, .05, .11], [facadeCenter, py, -2.85], m.shell);
  }
  }
  // Perimeter masonry and the short return enclose only the outdoor boundary.
  const wallZ = wallFace + .12, wallHeight = 2.15;
  s._box(structure, [end + 1, wallHeight, .24], [aisleCenterX, wallHeight / 2, wallZ], m.block);
  // The video shows open hollow-core blocks rather than a solid concrete cap.
  for (let x = -.8; x < end; x += .45) {
    s._box(structure, [.43, .09, .26], [x, wallHeight + .045, wallZ], m.block);
    for (const dx of [-.105, .105]) s._box(structure, [.135, .007, .16], [x + dx, wallHeight + .093, wallZ], m.vent);
  }
  s._box(structure, [5.2, .6, .018], [1.6, .3, wallFace - .012], m.cladding);
  for (let x = -.4; x < end - .3; x += 1.4) {
    const points = Array.from({ length: 8 }, (_, i) => {
      const t = i / 7; return [x + t * 1.4, 2.18 - Math.sin(t * PI) * .12, wallFace - .045];
    });
    pipe(s, structure, points, .016, m.vent);
  }
  // 15:04:34: the 100RT pipe-bank's right edge is directly beside the
  // retaining wall. The side views at 15:04:54 / 15:05:03 confirm that
  // this masonry continues behind the rack. Its outer right steel edge
  // is v=-7.525; the inward masonry face v=-7.53 leaves only a tiny gap.
  s._box(structure, [6.55, 3.7, .24], [.875, 1.85, -7.65], m.retaining);
  s._box(structure, [6.55, .1, .29], [.875, 3.75, -7.65], m.retaining);
  s._box(structure, [.23, 3.7, 7.3], [-2.4, 1.85, -4.1], m.retaining);
  // Visible services on the factory facade and above the east end of the aisle.
  for (const x of factoryFacade ? [7.1, 18.5, 29.5] : []) {
    pipe(s, ducts, [[x, .15, -2.7], [x, 5.75, -2.7]], .055, m.shell);
    for (const y of [1, 3.6]) s._box(ducts, [.2, .055, .14], [x, y, -2.74], m.silver);
  }
  const wallServices = s._group(ducts); wallServices.name = 'outdoor-wall-top-services';
  // Keep the support posts against the widened boundary, outside the walking
  // band. The much wider main pipe remains overhead at 2.67 model units.
  const pipeZ = wallFace - .1, pipeY = 2.67;
  pipe(s, wallServices, [[6, pipeY, pipeZ], [end - .5, pipeY, pipeZ]], .145, m.silver);
  for (let x = 6.7; x < end - .2; x += 3.1) {
    s._box(wallServices, [.1, 2.49, .1], [x, 1.275, pipeZ], m.red);
    s._box(wallServices, [.3, .045, .3], [x, .045, pipeZ], m.red);
    for (const dx of [-.1, .1]) for (const dz of [-.1, .1]) s._cyl(wallServices, .016, .055, [x + dx, .08, pipeZ + dz], m.rust, .016, 6);
    for (const z of [pipeZ - .17, pipeZ + .17]) s._box(wallServices, [.3, .08, .035], [x, 2.52, z], m.red);
    s._box(wallServices, [.34, .045, .38], [x, 2.48, pipeZ], m.red);
    s._box(wallServices, [.07, .055, .21], [x, 1.25, pipeZ + .13], m.red);
    if (x < end - 2) {
      const coupling = s._cyl(wallServices, .176, .11, [x + .75, pipeY, pipeZ], m.red, .176, 20); coupling.rotation.z = PI / 2;
      for (const z of [pipeZ - .18, pipeZ + .18]) s._box(wallServices, [.12, .08, .07], [x + .75, pipeY, z], m.red);
    }
  }
  for (const x of [10.2, 23.1, 35.4, 42.8]) {
    // Smaller transverse branches stay overhead; the walking aisle remains clear.
    pipe(s, wallServices, [[x, pipeY, pipeZ], [x, pipeY + .12, pipeZ - .3], [x, pipeY + .12, -2.75]], .063, m.silver);
  }
  if (end > 75) {
    // 11/09 18–30s shows a transverse entry screen and a wall-side gate;
    // 138–154s shows another short transverse screen by the tank/pump edge.
    // The footage does not establish a continuous longitudinal cage. Positions
    // and dimensions below are approximate, and both gates are shown open.
    const fence = s._group(structure); fence.name = 'outdoor-process-green-fence';
    const top = 2.2, screenStart = -2.85, screenEnd = 1.02, gateZ = wallFace - .08;
    for (const [x, name] of [[54, 'approach'], [74, 'tank-end']]) {
      const screen = s._group(fence, [x, 0, 0]); screen.name = `outdoor-process-${name}-screen`;
      for (const z of [screenStart, screenEnd]) {
        s._box(screen, [.065, top, .065], [0, top / 2, z], m.fenceGreen);
        s._box(screen, [.17, .055, .17], [0, .025, z], m.silver);
      }
      for (const y of [.18, 1.18, top]) s._box(screen, [.04, .04, screenEnd - screenStart], [0, y, (screenEnd + screenStart) / 2], m.fenceGreen);
      for (let z = screenStart + .12; z < screenEnd; z += .2) s._box(screen, [.012, top - .18, .012], [0, (top + .18) / 2, z], m.fenceGreen);
      for (let y = .38; y < top; y += .24) s._box(screen, [.012, .012, screenEnd - screenStart], [0, y, (screenEnd + screenStart) / 2], m.fenceGreen);
      // Open leaf folds along the block wall instead of closing the pedestrian
      // passage. Its hinge stays on the wall side of the full clear band.
      const gate = s._group(fence, [x, 0, gateZ]); gate.name = `outdoor-process-open-gate-${x}`;
      const leafLength = Math.max(1, gateZ - screenEnd);
      for (const dx of [0, leafLength]) s._box(gate, [.055, top, .055], [dx, top / 2, 0], m.fenceGreen);
      for (const y of [.18, top]) s._box(gate, [leafLength, .045, .045], [leafLength / 2, y, 0], m.fenceGreen);
      for (let dx = .2; dx < leafLength; dx += .2) s._box(gate, [.012, top - .18, .012], [dx, (top + .18) / 2, 0], m.fenceGreen);
      for (let y = .38; y < top; y += .24) s._box(gate, [leafLength, .012, .012], [leafLength / 2, y, 0], m.fenceGreen);
      s._box(gate, [.035, .2, .055], [leafLength - .18, 1.12, -.03], m.silver);
      for (const y of [.42, 1.8]) s._cyl(gate, .042, .12, [0, y, 0], m.silver, .042, 10);
    }
    // Wall-side fire service and the yellow utility line seen near the end.
    const fire = s._group(structure, [77, 0, -2.55]); fire.name = 'outdoor-end-fire-service';
    s._box(fire, [.68, 1.48, .26], [-.7, .88, 0], m.silver);
    s._box(fire, [.57, 1.3, .025], [-.7, .88, .15], m.silver);
    s._box(fire, [.035, .16, .035], [-.5, .88, .18], m.vent);
    s._cyl(fire, .11, .92, [.25, .5, .04], m.red, .11, 16);
    s._cyl(fire, .17, .08, [.25, .08, .04], m.red, .17, 16);
    s._mesh(new THREE.SphereGeometry(.13, 16, 10), m.red, fire, [.25, 1.02, .04]);
    pipe(s, fire, [[.25, .72, -.12], [.25, .72, .28]], .085, m.red);
    torus(s, fire, .11, .018, [.25, 1.1, .04], m.red);
    pipe(s, ducts, [[76, .45, -2.8], [89, .45, -2.8], [89, 1.12, -2.8], [end - .5, 1.12, -2.8]], .04, m.yellow);
    for (const x of [82, 90, 98, 106]) pipe(s, ducts, [[x, .45, -2.8], [x, .45, -2.65]], .025, m.silver);
  }
  for (const group of Object.values(groups)) batchOutdoorMeshes(s, group);
  return groups;
}

function outdoorUnit(s, root, item) {
  const m = palette(s), w = 2.45, h = 2.15, d = 1.13;
  const shell = s._part(root, item.parts[0], [-.9, .1, -.3]);
  shell.name = 'outdoor-mix-unit-cabinet';
  s._box(shell, [w, h, d], [0, h / 2 + .26, 0], m.shell);
  // Cards 074–076: both broad faces have white square coil guards; the
  // narrow ends are mostly solid, stamped service panels, not side intakes.
  for (const z of [-d / 2 - .018, d / 2 + .018]) {
    for (const x of [-w / 2 + .025, 0, w / 2 - .025]) s._box(shell, [.025, h - .02, .03], [x, h / 2 + .26, z], m.shell);
    for (const x of [-.6, .6]) {
      s._box(shell, [1.16, .99, .025], [x, .785, z], m.shell);
      for (const dx of [-.35, 0, .35]) doorVents(s, shell, x + dx, .38, z + Math.sign(z) * .025, .22);
      for (const dx of [-.3, .3]) doorVents(s, shell, x + dx, 1.07, z + Math.sign(z) * .025, .22, 3);
      for (const y of [.34, 1.24, 2.33]) s._cyl(shell, .014, .025, [x + .54, y, z + Math.sign(z) * .03], m.silver, .014, 6).rotation.x = PI / 2;
    }
    s._box(shell, [w, .035, .045], [0, 1.32, z], m.shell);
  }
  for (const x of [-w / 2 - .016, w / 2 + .016]) {
    const panel = s._group(shell, [x, 1.37, 0]); panel.rotation.y = Math.sign(x) * PI / 2;
    s._box(panel, [d - .04, h - .035, .025], [0, 0, 0], m.shell);
    for (const y of [-.01, .63]) s._box(panel, [d - .12, .014, .018], [0, y, .018], m.silver);
    s._box(panel, [d - .02, .025, .035], [0, -.43, .022], m.silver);
    for (const xx of [-.26, .26]) for (const yy of [-.88, -.36]) doorVents(s, panel, xx, yy, .025, .21, 4);
  }
  cabinetGaugeWindow(s, shell, -.77, 1.16, d / 2 + .045, .068, .21);
  s._box(shell, [.035, .14, .035], [.07, .91, d / 2 + .055], m.vent);
  const signMaterial = { 'mix-1': m.signMix1, 'mix-2': m.signMix2, 'mix-4': m.signMix4 }[item.variant] || m.signUnit;
  sign(s, shell, signMaterial, [-.26, 1.12, d / 2 + .065], .3, .24);
  const top = s._part(root, item.parts[1], [0, 1, .15]);
  top.name = 'outdoor-mix-unit-two-top-fans';
  for (const x of [-.61, .61]) {
    for (const z of [-d / 2 - .04, d / 2 + .04]) squareGuard(s, top, 1.13, 1.01, [x, 1.865, z], m.shell, .12);
    fan(s, top, x, h + .31, 0, .48);
  }
  s._box(top, [w + .04, .065, d + .04], [0, h + .27, 0], m.shell);
  const base = s._part(root, item.parts[2], [.75, 0, .6]);
  for (const x of [-.95, .95]) {
    s._box(base, [.16, .2, d + .2], [x, .16, 0], m.frame);
    s._box(base, [.27, .045, d + .28], [x, .055, 0], m.rust);
  }
  for (const x of [-.95, .95]) pipe(s, base, [[x, .5, -.5], [x, .5, -.95], [x, 1.15, -.95], [x, 1.15, -1.7]], .035, m.vent);
}

function panelTank(s, root, item) {
  const m = palette(s), w = 3.05, d = 1.75, h = 1.86, bottom = .29, card20 = item.historyCardNumber === 91;
  const shell = s._part(root, item.parts[0], [-.7, .15, -.4]);
  s._box(shell, [w, h, d], [0, bottom + h / 2, 0], m.silver);
  for (const z of [-d / 2 - .018, d / 2 + .018]) {
    if (card20) {
      // Card 091: four small upper pressings above two large lower panels.
      for (const [count, cy, ph] of [[2, .59, 1.18], [4, 1.53, .66]]) {
        for (let col = 0; col < count; col++) {
          const panel = pressedPanel(s, shell, w / count, ph, [-w / 2 + (col + .5) * w / count, bottom + cy, z]);
          if (z < 0) panel.rotation.y = PI;
        }
      }
      continue;
    }
    // 00:24–00:28: shallow square upper panels above a taller lower row.
    for (let col = 0; col < 3; col++) for (const [cy, ph] of [[.61, 1.16], [1.55, .64]]) {
      const x = -1.02 + col * 1.02, y = bottom + cy;
      s._box(shell, [.975, ph, .027], [x, y, z], m.silver);
      const bulge = s._mesh(new THREE.SphereGeometry(.5, 16, 10), m.silver, shell, [x, y, z]);
      bulge.scale.set(.84, ph * .84, .23);
      for (const dx of [-.45, .45]) for (const dy of [-ph / 2 + .05, ph / 2 - .05]) {
        s._cyl(shell, .019, .035, [x + dx, y + dy, z + Math.sign(z) * .03], m.frame, .019, 6).rotation.x = PI / 2;
      }
    }
    for (const y of [bottom, bottom + 1.2, bottom + h]) s._box(shell, [w + .05, .035, .04], [0, y, z + Math.sign(z) * .02], m.frame);
  }
  for (const x of [-w / 2 - .02, w / 2 + .02]) {
    if (card20) {
      for (const [count, cy, ph] of [[1, .59, 1.18], [2, 1.53, .66]]) for (let col = 0; col < count; col++) {
        const panel = pressedPanel(s, shell, d / count, ph, [x, bottom + cy, -d / 2 + (col + .5) * d / count], true);
        if (x < 0) panel.rotation.y = -PI / 2;
      }
    } else for (let row = 0; row < 2; row++) {
      const side = s._mesh(new THREE.SphereGeometry(.5, 12, 8), m.silver, shell, [x, bottom + .46 + row * .94, 0]); side.scale.set(.16, .74, 1.4);
    }
    s._box(shell, [.055, h, .055], [x, bottom + h / 2, d / 2], m.frame);
  }
  for (const x of [-1.23, 1.23]) s._box(shell, [.13, bottom, d], [x, bottom / 2, 0], m.frame);
  sign(s, shell, item.variant === 'unconfirmed-capacity' ? m.signTank : m.sign20, [-.9, 1.92, d / 2 + .145], .4, .3);
  const top = s._part(root, item.parts[1], [0, 1.1, .1]);
  s._box(top, [w + .07, .075, d + .07], [0, bottom + h + .03, 0], m.silver);
  s._cyl(top, .31, .09, [0, bottom + h + .12, 0], m.silver, .31, 18);
  s._cyl(top, .055, .34, [.93, bottom + h + .2, .5], m.silver, .055, 12);
  s._cyl(top, .075, .035, [.93, bottom + h + .38, .5], m.silver, .075, 12).rotation.z = -.2;
  ladder(s, top, card20 ? -.62 : -.1, d / 2 + .22, bottom + h + .05);
  const pipes = s._part(root, item.parts[2], [.65, .1, .7]);
  for (const x of [-1.15, 1.15]) pipe(s, pipes, [[x, .48, -.87], [x, .48, -1.15], [x, 2.48, -1.15], [x, 2.48, -.3]], .065, m.silver);
  pipe(s, pipes, [[1.05, 2.15, .85], [1.05, 2.45, .85], [1.55, 2.45, .85], [1.55, .2, .85]], .025, m.green);
}

function coolingTower(s, root, item) {
  const m = palette(s), y = 2.48, w = 2.7, d = 2.8;
  const frame = s._part(root, item.parts[0], [-.3, 0, -.5]);
  frame.name = 'outdoor-elevated-platform';
  for (const x of [-1.18, 1.18]) for (const z of [-1.2, 1.2]) {
    s._box(frame, [.14, y, .14], [x, y / 2, z], m.frame);
    s._box(frame, [.34, .05, .35], [x, .035, z], m.frame);
    for (const dx of [-.1, .1]) s._cyl(frame, .018, .06, [x + dx, .08, z + .1], m.silver, .018, 6);
  }
  for (const z of [-1.25, 1.25]) {
    s._box(frame, [w, .19, .12], [0, y, z], m.frame);
    pipe(s, frame, [[-1.18, .3, z], [1.18, y - .1, z]], .055, m.frame);
    for (const yy of [y + .5, y + 1]) pipe(s, frame, [[-w / 2, yy, z], [w / 2, yy, z]], .025, m.frame);
    for (const x of [-1.3, 0, 1.3]) pipe(s, frame, [[x, y, z], [x, y + 1.05, z]], .028, m.frame);
  }
  for (const x of [-1.3, 1.3]) for (const yy of [y + .5, y + 1]) pipe(s, frame, [[x, yy, -1.25], [x, yy, 1.25]], .025, m.frame);
  for (const x of [-1.3, 1.3]) s._box(frame, [.12, .16, d], [x, y, 0], m.frame);
  for (const z of [-.65, 0, .65]) s._box(frame, [w, .1, .055], [0, y + .02, z], m.frame);
  const deck = s._mesh(new THREE.PlaneGeometry(w, d), m.grating, frame, [0, y + .12, 0]);
  deck.rotation.x = -PI / 2; deck.name = 'outdoor-platform-expanded-metal';
  // One elevated tower. The two water tanks are separate neighboring items;
  // nothing occupies the open volume below this platform.
  const tower = s._part(root, item.parts[1], [0, 1.3, .1]);
  for (const dx of [-.55, .55]) s._box(tower, [.12, .25, 1.45], [dx, y + .25, 0], m.silver);
  s._cyl(tower, .81, .33, [0, y + .46, 0], m.shell, .65, 24);
  s._cyl(tower, .79, .35, [0, y + .78, 0], m.vent, .81, 24);
  for (const yy of [y + .63, y + .76, y + .89]) s._cyl(tower, .83, .075, [0, yy, 0], m.shell, .94, 32);
  const profile = [[.84, .94], [.94, 1.04], [.97, 1.2], [.97, 1.85], [.94, 2.05], [.85, 2.2], [.58, 2.42]];
  const body = s._mesh(new THREE.LatheGeometry(profile.map(([r, yy]) => new THREE.Vector2(r, yy + y)), 40), m.shell, tower);
  body.name = 'outdoor-elevated-tower-body';
  s._cyl(tower, .58, .4, [0, y + 2.39, 0], m.shell, .87, 28);
  s._cyl(tower, .57, .23, [0, y + 2.7, 0], m.shell, .58, 24);
  fan(s, tower, 0, y + 2.84, 0, .52);
  for (const yy of [y + 1, y + 1.7, y + 2.2]) torus(s, tower, .88, .014, [0, yy, 0], m.silver);
  const services = s._part(root, item.parts[2], [.6, .1, .8]);
  ladder(s, services, 1.3, 1.57, y + .14);
  pipe(s, services, [[0, y + .5, -.5], [0, y + .5, -1.2], [0, .5, -1.2]], .07, m.silver);
}

function rack(s, root, item) {
  const m = palette(s);
  // Keep the 100RT's own foundation with the equipment during layout editing.
  s._box(root, [4, .14, 3], [0, .07, 0], m.pad);
  const lower = s._part(root, item.parts[0], [-.9, .1, -.4]);
  lower.name = 'outdoor-100rt-corrugated-water-tank';
  s._box(lower, [3.1, 1.7, 1.65], [0, 1.16, 0], m.silver);
  // The card's lower tank has broad vertical pressed ribs, rather than
  // the square panel-tank pattern seen on the separate neighboring tanks.
  for (const z of [-.82, .82]) for (const x of [-1.16, -.39, .39, 1.16]) {
    const rib = s._cyl(lower, .5, 1.69, [x, 1.16, z], m.silver, .5, 24); rib.scale.set(.78, 1, .32);
  }
  for (const y of [.3, 2.02]) s._box(lower, [3.18, .05, 1.95], [0, y, 0], m.silver);
  sign(s, lower, m.sign100, [.72, 1.55, 1.05], .39, .32);
  pipe(s, lower, [[1.4, .7, -.4], [2.1, .7, -.4], [2.1, .7, 1.1]], .12, m.silver);
  const upper = s._part(root, item.parts[1], [0, 1.5, -.2]);
  upper.name = 'outdoor-100rt-square-cooling-tower';
  s._box(upper, [3, 2.55, 1.88], [0, 4.45, 0], m.shell);
  for (const z of [-.97, .97]) {
    grille(s, upper, 2.8, .55, [0, 3.58, z], m.vent);
    for (let x = -1.34; x < 1.4; x += .12) s._box(upper, [.016, .49, .035], [x, 3.58, z + Math.sign(z) * .025], m.shell);
    for (const x of [-1.39, -.66, .66, 1.39]) s._box(upper, [.035, 1.72, .035], [x, 4.83, z], m.silver);
    for (const y of [4.03, 5.62]) s._box(upper, [2.79, .035, .035], [0, y, z], m.silver);
    for (const x of [-1.03, 1.03]) for (const y of [4.15, 4.5, 4.85, 5.2, 5.52]) s._box(upper, [.55, .016, .018], [x, y, z + Math.sign(z) * .02], m.silver);
    // Subtle W-shaped press lines in the central pale tower panel.
    for (const y of [4.27, 4.88]) pipe(s, upper, [[-.48, y + .49, z + Math.sign(z) * .022], [-.23, y, z + Math.sign(z) * .022], [0, y + .4, z + Math.sign(z) * .022], [.23, y, z + Math.sign(z) * .022], [.48, y + .49, z + Math.sign(z) * .022]], .009, m.silver);
  }
  for (const x of [-1.48, 1.48]) for (const y of [3.8, 5.5]) s._box(upper, [.04, .04, 1.85], [x, y, 0], m.silver);
  for (const x of [-1.35, 1.35]) s._box(upper, [.035, 1.67, .03], [x, 4.82, .98], m.silver);
  // The 15:04:55 / 15:04:57 roof view shows one broad fan hood.
  fan(s, upper, 0, 5.77, 0, .83);
  const frame = s._part(root, item.parts[2], [-.65, 0, .65]);
  for (const x of [-1.75, 1.75]) for (const z of [-1.15, 1.15]) s._box(frame, [.15, 3.12, .15], [x, 1.56, z], m.frame);
  for (const y of [.16, 2.93]) {
    for (const z of [-1.15, 1.15]) s._box(frame, [3.68, .2, .13], [0, y, z], m.frame);
    for (const x of [-1.75, 0, 1.75]) s._box(frame, [.13, .2, 2.21], [x, y, 0], m.frame);
  }
  s._box(frame, [3.58, .035, 2.30], [0, 3.043, 0], m.grating);
  for (const z of [-1.15, 1.15]) {
    for (const y of [3.4, 3.9]) pipe(s, frame, [[-1.75, y, z], [1.75, y, z]], .027, m.frame);
    for (const x of [-1.75, 0, 1.75]) pipe(s, frame, [[x, 2.95, z], [x, 3.94, z]], .027, m.frame);
  }
  ladder(s, frame, -1.95, 1, 3.1);
  const services = s._part(root, item.parts[3], [.8, .1, 1]);
  for (let i = 0; i < 6; i++) {
    const x = -1.4 + i * .38;
    pipe(s, services, [[x, .35, 1.35], [x, 6.1 + i * .12, 1.35], [x, 6.1 + i * .12, -.7]], .043, m.silver);
    if (i < 3) { gauge(s, services, x, .75, 1.45, .065); valve(s, services, [x, .4, 1.35], .55); }
  }
  s._box(services, [.68, 1.05, .25], [1.45, 1.8, 1.35], m.silver);
  s._box(services, [.49, .66, .02], [1.45, 1.82, 1.49], m.shell);
  for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
    const b = s._cyl(services, .028, .02, [1.29 + col * .16, 2.02 - row * .19, 1.515], col === 2 && row === 0 ? m.red : m.green, .028, 8); b.rotation.x = PI / 2;
  }
}

function chiller(s, root, item) {
  if (item.variant === 'card-40rt' || item.historyCardNumber === 89) return longCabinetChiller(s, root, item);
  const m = palette(s), w = 2.8, d = 1.2;
  const shell = s._part(root, item.parts[0], [-1, 0, -.3]);
  s._box(shell, [w, 2.6, d], [0, 1.5, 0], m.shell);
  for (const x of [-1.1, 1.1]) s._box(shell, [.14, .2, 1.35], [x, .16, 0], m.rust);
  for (const x of [-.7, .7]) {
    for (let y = .4; y < 1.15; y += .075) for (const dx of [-.3, .3]) s._box(shell, [.28, .02, .018], [x + dx, y, .62], m.silver);
    s._box(shell, [.035, .2, .035], [x + .55, 1.26, .63], m.vent);
  }
  const coil = s._part(root, item.parts[1], [0, 1.1, .5]);
  coil.name = 'outdoor-20rt-weathered-square-guards';
  squareGuard(s, coil, 1.33, 1.32, [-.71, 2.08, .64], m.rust, .13);
  squareGuard(s, coil, 1.3, 1.32, [.68, 2.08, .64], m.shell, .13);
  for (const x of [-.71, .68]) squareGuard(s, coil, 1.3, 1.32, [x, 2.08, -.64], m.shell, .13);
  fan(s, coil, -.7, 2.85, 0, .52); fan(s, coil, .7, 2.85, 0, .52);
  const services = s._part(root, item.parts[2], [.85, .1, .6]);
  cabinetGaugeWindow(s, services, -.71, 1.32, .647, .092, .27);
  const tube = [[-1.5, .8, -.1], [-1.5, .8, .25], [-1.5, 2.5, .25], [-1.5, 2.5, .45], [-2.1, 2.5, .45]];
  pipe(s, services, tube, .13, m.silver);
  for (const y of [1, 2.25]) s._cyl(services, .15, .045, [-1.5, y, .25], m.silver, .15, 18);
  sign(s, services, m.signCooling20, [-1.414, 1.18, -.15], .4, .31).rotation.y = -PI / 2;
  sign(s, services, m.signControl20, [.53, 1.25, .665], .35, .28);
  s._box(services, [.25, .27, .02], [.96, 1.25, .665], m.vent);
  s._box(services, [.13, .07, .025], [1, 1.29, .68], s.mat.screen);
}

function longCabinetChiller(s, root, item) {
  const m = palette(s), w = 4.2, d = 1.3, bottom = .43, h = 2.37;
  const shell = s._part(root, item.parts[0], [-.9, .1, -.3]);
  shell.name = 'outdoor-40rt-four-door-cabinet';
  s._box(shell, [w, h, d], [0, bottom + h / 2, 0], m.shell);
  for (const z of [-d / 2 - .02, d / 2 + .02]) {
    for (let col = 0; col < 4; col++) {
      const x = -w / 2 + (col + .5) * w / 4;
      s._box(shell, [w / 4 - .035, 1.24, .025], [x, bottom + .62, z], m.shell);
      s._box(shell, [.025, h, .035], [x - w / 8, bottom + h / 2, z], m.silver);
      s._box(shell, [.027, .13, .035], [x + .4, 1.13, z + Math.sign(z) * .028], m.vent);
      if (z > 0) {
        for (const xx of [x - .24, x + .24]) {
          doorVents(s, shell, xx, .58, z + .026, .23, 4);
          if (col !== 0) doorVents(s, shell, xx, 1.35, z + .026, .23, 4);
        }
      }
    }
    s._box(shell, [w, .035, .045], [0, 1.73, z], m.shell);
  }
  for (const x of [-w / 2 - .02, w / 2 + .02]) {
    const end = s._group(shell, [x, 1.61, 0]); end.rotation.y = Math.sign(x) * PI / 2;
    s._box(end, [d - .06, h - .04, .025], [0, 0, 0], m.shell);
    for (const y of [-.01, .69]) s._box(end, [d - .12, .014, .018], [0, y, .02], m.silver);
    for (const xx of [-.3, .3]) for (const yy of [-.91, -.36]) doorVents(s, end, xx, yy, .027, .22, 4);
  }
  const coils = s._part(root, item.parts[1], [0, 1.1, .25]);
  coils.name = 'outdoor-40rt-four-bay-bare-coils';
  for (const z of [-d / 2 - .035, d / 2 + .035]) for (let col = 0; col < 4; col++) {
    const x = -w / 2 + (col + .5) * w / 4;
    s._box(coils, [.98, .94, .035], [x, 2.25, z], m.coil);
    for (let y = 1.8; y < 2.72; y += .036) s._box(coils, [.98, .009, .014], [x, y, z + Math.sign(z) * .027], m.vent);
    for (const dx of [-.48, .48]) s._box(coils, [.025, .97, .035], [x + dx, 2.25, z + Math.sign(z) * .032], m.shell);
  }
  // The four card views do not expose the roof fan count.
  s._box(coils, [w + .035, .05, d + .035], [0, 2.82, 0], m.shell);
  const services = s._part(root, item.parts[2], [.8, .1, -.3]);
  services.name = 'outdoor-40rt-raised-open-support';
  for (const z of [-.58, .58]) s._box(services, [w + .13, .13, .1], [0, .34, z], m.silver);
  for (const x of [-1.7, 0, 1.7]) {
    s._box(services, [.12, .13, 1.48], [x, .34, 0], m.silver);
    for (const z of [-.58, .58]) {
      s._box(services, [.1, .26, .1], [x, .15, z], m.silver);
      s._box(services, [.22, .035, .2], [x, .025, z], m.silver);
    }
  }
  // Card 089 shows three dials in one inset at the front, and two pipe collars at the left end.
  cabinetGaugeWindow(s, services, -1.52, 1.52, .684, .065, .20);
  // Only the visible short rear-side connections are represented. The card's
  // conflicting 40RT/60RT filenames do not establish a different capacity.
  for (const y of [.86, 1.38]) {
    insulatedPipe(s, services, [[-1.83, y, -.51], [-2.19, y, -.51], [-2.19, y, -.88]], .12);
    s._cyl(services, .15, .045, [-2.14, y, -.51], m.shell, .15, 20).rotation.z = PI / 2;
  }
}

function pumpPit(s, root, item) {
  const m = palette(s);
  const ground = s._part(root, item.parts[0], [-.65, 0, -.4]);
  s._cyl(ground, .97, .12, [0, .16, 0], m.blue, .97, 36);
  s._cyl(ground, .85, .04, [0, .24, 0], m.vent, .85, 32);
  s._cyl(ground, .6, .065, [.3, .29, .16], m.blue, .6, 32);
  torus(s, ground, .96, .025, [0, .23, 0], m.blue);
  s._box(ground, [.25, .014, .3], [.3, .33, .16], m.silver);
  for (const x of [.16, .43]) s._box(ground, [.1, .025, .035], [x, .345, .16], m.vent);
  const valves = s._part(root, item.parts[1], [0, .5, .7]);
  for (const x of [-.43, .43]) {
    pipe(s, valves, [[x, .15, -.24], [x, 3.3, -.24]], .13, m.silver);
    // Video close-up: braided flex, black rubber bellows and bolted flange pairs.
    s._cyl(valves, .145, .46, [x, .6, -.24], m.silver, .145, 20);
    for (let y = .4; y < .82; y += .035) torus(s, valves, .148, .008, [x, y, -.24], m.shell);
    for (let i = 0; i < 8; i++) {
      const a = i * PI / 4;
      pipe(s, valves, [[x + Math.cos(a) * .15, .39, -.24 + Math.sin(a) * .15], [x + Math.cos(a + .7) * .15, .82, -.24 + Math.sin(a + .7) * .15]], .007, m.frame);
    }
    s._cyl(valves, .168, .3, [x, 1.08, -.24], s.mat.black, .168, 20);
    for (const y of [.98, 1.08, 1.18]) torus(s, valves, .173, .014, [x, y, -.24], s.mat.black);
    for (const y of [.34, .87, 1.27, 1.66, 2.05, 2.29]) {
      s._cyl(valves, .225, .065, [x, y, -.24], m.silver, .225, 20);
      for (let i = 0; i < 8; i++) {
        const a = i * PI / 4;
        s._cyl(valves, .023, .09, [x + Math.cos(a) * .185, y + .025, -.24 + Math.sin(a) * .185], i % 3 === 0 ? m.rust : m.frame, .023, 6);
      }
    }
    for (let i = 0; i < 4; i++) {
      const a = PI / 4 + i * PI / 2;
      pipe(s, valves, [[x + Math.cos(a) * .185, 2.05, -.24 + Math.sin(a) * .185], [x + Math.cos(a) * .185, 2.29, -.24 + Math.sin(a) * .185]], .018, m.frame);
    }
    // Offset green gear case and the large handwheel sit beside the valve body.
    const gear = s._cyl(valves, .16, .12, [x + .2, 2.17, -.24], m.green, .16, 16); gear.rotation.z = PI / 2;
    s._cyl(valves, .08, .018, [x + .2, 2.17, -.15], m.red, .08, 12).rotation.x = PI / 2;
    pipe(s, valves, [[x + .2, 2.17, -.24], [x + .2, 2.17, .16]], .03, m.silver);
    torus(s, valves, .22, .026, [x + .2, 2.17, .18], m.green, true);
    for (const a of [0, PI / 3, PI * 2 / 3]) pipe(s, valves, [[x + .2 - Math.cos(a) * .2, 2.17 - Math.sin(a) * .2, .18], [x + .2 + Math.cos(a) * .2, 2.17 + Math.sin(a) * .2, .18]], .015, m.green);
    s._cyl(valves, .18, .11, [x, 2.56, -.24], m.red, .18, 20);
    for (const dx of [-.17, .17]) {
      s._box(valves, [.08, .12, .12], [x + dx, 2.56, -.24], m.red);
      pipe(s, valves, [[x + dx, 2.56, -.33], [x + dx, 2.56, -.15]], .018, m.silver);
    }
    for (const y of [2.83, 3.18]) torus(s, valves, .132, .008, [x, y, -.24], m.frame);
    pipe(s, valves, [[x + .11, 1.54, -.24], [x + .28, 1.54, -.24], [x + .34, 1.45, -.24], [x + .34, 1.12, -.24]], .033, m.silver);
    s._box(valves, [.055, .14, .035], [x + .39, 1.18, -.2], m.rust);
    pipe(s, valves, [[x + .34, 1.1, -.24], [x + .34, .5, .3], [x + .12, .31, .52], [x - .14, .35, .7]], .015, m.blue);
  }
  pipe(s, valves, [[-.43, 1.08, -.08], [-.43, 1.08, .06]], .025, m.silver);
  torus(s, valves, .095, .018, [-.43, 1.08, .075], m.red, true);
  for (const a of [0, PI / 3, PI * 2 / 3]) pipe(s, valves, [[-.43 - Math.cos(a) * .085, 1.08 - Math.sin(a) * .085, .075], [-.43 + Math.cos(a) * .085, 1.08 + Math.sin(a) * .085, .075]], .012, m.red);
  const frame = s._part(root, item.parts[2], [.65, .2, -.3]);
  for (const x of [-.95, .95]) for (const z of [-.8, .8]) {
    s._box(frame, [.07, .44, .07], [x, .22, z], m.red);
    s._box(frame, [.2, .035, .2], [x, .03, z], m.red);
    for (const dx of [-.065, .065]) s._cyl(frame, .018, .055, [x + dx, .05, z], m.rust, .018, 6);
  }
  for (const z of [-.8, .8]) {
    s._box(frame, [2, .1, .025], [0, .43, z], m.red);
    for (const y of [.38, .48]) s._box(frame, [2, .02, .1], [0, y, z], m.red);
  }
  for (const x of [-.95, .95]) s._box(frame, [.07, .07, 1.7], [x, .46, 0], m.red);
  for (const x of [-.9, .9]) {
    s._box(frame, [.035, 3.3, .1], [x, 1.65, -.65], m.red);
    for (const dx of [-.045, .045]) s._box(frame, [.02, 3.3, .14], [x + dx, 1.65, -.65], m.red);
  }
  s._box(frame, [1.9, .09, .09], [0, 3.3, -.65], m.red);
  for (const x of [-.43, .43]) pipe(s, frame, [[x, 3.3, -.24], [x, 3.58, -.24], [x, 3.58, -1.7]], .13, m.silver);
  // Separate stainless control and fire cabinets are visible behind the two risers.
  s._box(frame, [.53, .73, .25], [.61, 1.5, -1.23], m.silver);
  s._box(frame, [.42, .58, .025], [.61, 1.5, -1.087], m.frame);
  for (let row = 0; row < 3; row++) for (let col = 0; col < 2; col++) s._cyl(frame, .024, .022, [.5 + col * .2, 1.68 - row * .17, -1.064], row === 0 && col === 0 ? m.red : m.shell, .024, 8).rotation.x = PI / 2;
  for (const x of [.4, .82]) s._box(frame, [.035, 1.13, .035], [x, .565, -1.23], m.silver);
  s._box(frame, [.69, 1.42, .4], [-.47, 1, -1.3], m.silver);
  s._box(frame, [.64, 1.34, .025], [-.47, 1, -1.087], m.shell);
  s._box(frame, [.76, .06, .49], [-.47, 1.75, -1.3], m.silver);
  sign(s, frame, m.signFireBox || m.silver, [-.47, 1.07, -1.067], .25, .95);
  s._box(frame, [.035, .2, .035], [-.72, 1.03, -1.05], m.vent);
  for (const x of [-.72, -.22]) s._box(frame, [.045, .29, .045], [x, .145, -1.3], m.silver);
}

function vessel(s, root, item) {
  const m = palette(s), h = 2.65, w = 1.85, d = 1.5;
  const shell = s._part(root, item.parts[0], [-.9, .1, -.3]);
  s._box(shell, [w, h, d], [0, h / 2 + .2, 0], m.shell);
  for (const x of [-.78, .78]) for (const z of [-.55, .55]) {
    s._box(shell, [.12, .1, .16], [x, .16, z], m.silver);
    const wheel = s._cyl(shell, .075, .055, [x, .075, z], m.red, .075, 12); wheel.rotation.z = PI / 2;
    const hub = s._cyl(shell, .036, .065, [x, .075, z], m.silver, .036, 10); hub.rotation.z = PI / 2;
  }
  // The end enclosure has hinged access doors as well as the bolted manway.
  for (const z of [-d / 2 - .014, d / 2 + .014]) {
    for (const x of [-.9, 0, .9]) s._box(shell, [.018, h - .04, .02], [x, h / 2 + .2, z], m.silver);
    s._box(shell, [w - .04, .025, .024], [0, .67, z], m.silver);
    for (const x of [-.87, .87]) for (const y of [.45, 1.08, 2.38]) s._box(shell, [.045, .13, .055], [x, y, z], m.silver);
    for (const y of [1.03, 2.26]) {
      s._cyl(shell, .05, .04, [.09, y, z + Math.sign(z) * .025], m.shell, .05, 12).rotation.x = PI / 2;
      s._box(shell, [.09, .03, .055], [.11, y, z + Math.sign(z) * .055], m.vent);
    }
  }
  sign(s, shell, m.warning, [-.4, 1.87, .787], .44, .36);
  const instrument = s._group(shell, [.44, 1.91, .79]); instrument.name = 'outdoor-vessel-discol-panel';
  s._box(instrument, [.67, .73, .035], [0, 0, 0], m.vent);
  gauge(s, instrument, 0, .075, .035, .22);
  sign(s, instrument, m.signDiscol, [0, -.25, .032], .58, .15);
  for (const x of [-.62, .64]) for (const y of [.77, 2.2]) {
    const knob = s._cyl(shell, .068, .065, [x, y, .82], m.rubber, .068, 12); knob.rotation.x = PI / 2;
    s._box(shell, [.14, .065, .06], [x, y, .79], m.silver);
  }
  const cage = s._part(root, item.parts[1], [.8, .1, .7]);
  ladder(s, cage, .5, 1.03, h + .2, true, true);
  s._box(cage, [w + .2, .08, d + .2], [0, h + .25, 0], m.frame);
  for (const x of [-1, 1]) {
    s._box(cage, [.035, .18, d + .2], [x, h + .38, 0], m.yellow);
    for (const y of [h + .8, h + 1.24]) pipe(s, cage, [[x, y, -.85], [x, y, .85]], .025, m.yellow);
    for (const z of [-.85, .85]) pipe(s, cage, [[x, h + .3, z], [x, h + 1.27, z]], .025, m.yellow);
  }
  s._box(cage, [w + .2, .18, .035], [0, h + .38, -.85], m.yellow);
  for (const y of [h + .8, h + 1.24]) pipe(s, cage, [[-1, y, -.85], [1, y, -.85]], .025, m.yellow);
  // Split the front rail around the ladder opening.
  for (const y of [h + .8, h + 1.24]) pipe(s, cage, [[-1, y, .85], [.16, y, .85]], .025, m.yellow);
  const fittings = s._part(root, item.parts[2], [0, .8, -.6]);
  s._cyl(fittings, .31, .045, [-.12, .77, .79], m.shell, .31, 8).rotation.x = PI / 2;
  for (let i = 0; i < 8; i++) {
    const a = i * PI / 4; const bolt = s._cyl(fittings, .018, .045, [-.12 + Math.cos(a) * .27, .77 + Math.sin(a) * .27, .83], m.frame, .018, 6); bolt.rotation.x = PI / 2;
  }
  const ductX = -.29, ductZ = -.04, spiralBottom = h + 1.04, spiralTop = h + 3.03, radius = .31;
  s._cyl(fittings, radius, .88, [ductX, h + .63, ductZ], m.shell, radius, 28);
  s._cyl(fittings, radius, spiralTop - spiralBottom, [ductX, (spiralBottom + spiralTop) / 2, ductZ], m.silver, radius, 28);
  const seam = [];
  for (let i = 0; i <= 240; i++) {
    const t = i / 240, angle = t * TAU * 21;
    seam.push(new THREE.Vector3(ductX + Math.cos(angle) * (radius + .004), spiralBottom + t * (spiralTop - spiralBottom), ductZ + Math.sin(angle) * (radius + .004)));
  }
  s._mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(seam), 240, .007, 3, false), m.shell, fittings);
  // The tall spiral run turns smoothly into a horizontal run toward the factory roof.
  const bend = [];
  for (let i = 0; i <= 12; i++) {
    const a = i / 12 * PI / 2;
    bend.push(new THREE.Vector3(ductX, spiralTop + Math.sin(a) * .52, ductZ - .52 + Math.cos(a) * .52));
  }
  bend.push(new THREE.Vector3(ductX, spiralTop + .52, -1.69));
  s._mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bend), 24, radius, 20, false), m.silver, fittings);
  for (const y of [h + .22, spiralBottom, spiralTop]) torus(s, fittings, radius + .008, .014, [ductX, y, ductZ], m.silver);
  const access = s._cyl(fittings, .18, .17, [ductX, h + .83, ductZ + radius], m.shell, .18, 20); access.rotation.x = PI / 2;
  const cap = s._cyl(fittings, .2, .025, [ductX, h + .83, ductZ + radius + .1], m.silver, .2, 24); cap.rotation.x = PI / 2;
  for (const a of [0, PI / 2, PI, PI * 1.5]) s._cyl(fittings, .012, .03, [ductX + Math.cos(a) * .17, h + .83 + Math.sin(a) * .17, ductZ + radius + .12], m.frame, .012, 6).rotation.x = PI / 2;
  pipe(s, fittings, [[-.93, 1.15, 0], [-1.2, 1.15, 0], [-1.2, .22, 0]], .065, m.silver);
  // The second shiny riser and wall-mounted controller are visible behind the
  // ladder enclosure. They are services, not evidence for an extra vessel.
  const companion = s._group(fittings); companion.name = 'outdoor-vessel-companion-duct';
  s._cyl(companion, .15, 4.8, [.76, 2.7, -1.25], m.silver, .15, 24);
  for (let y = .4; y < 5.05; y += .2) torus(s, companion, .152, .009, [.76, y, -1.25], m.shell);
  pipe(s, companion, [[.76, .32, -1.25], [.76, .19, -1.6]], .15, m.silver);
  s._box(fittings, [.55, .72, .2], [.02, 1.35, -1.58], m.silver);
  s._box(fittings, [.45, .58, .025], [.02, 1.35, -1.465], m.shell);
  s._box(fittings, [.19, .17, .03], [.02, 1.48, -1.44], m.vent);
  for (const x of [-.1, .13]) s._cyl(fittings, .025, .025, [x, 1.15, -1.43], x < 0 ? m.green : m.red, .025, 8).rotation.x = PI / 2;
  for (let i = 0; i < 4; i++) pipe(s, fittings, [[-.2 + i * .13, .98, -1.55], [-.22 + i * .16, .2, -1.5], [.6 + i * .12, .16, -1.35]], .018, m.rubber);
}

function condenserBank(s, root, item) {
  const m = palette(s), w = 1.45, d = 1.3, bottom = .22, h = 1.27;
  const bodies = s._part(root, item.parts[0] || '열교환 코일·프레임', [-.8, .1, -.35]);
  bodies.name = 'outdoor-condenser-bank';
  for (let index = 0; index < 2; index++) {
    const x = index === 0 ? -.77 : .77;
    const bay = s._group(bodies, [x, 0, 0]); bay.name = `outdoor-condenser-bay-${index + 1}`;
    s._box(bay, [w - .08, h - .12, d - .08], [0, bottom + h / 2, 0], m.coil);
    for (const xx of [-w / 2 + .035, w / 2 - .035]) for (const z of [-d / 2 + .025, d / 2 - .025]) {
      s._box(bay, [.07, h + bottom, .065], [xx, (h + bottom) / 2, z], m.silver);
      s._box(bay, [.11, .035, .12], [xx, .035, z], m.rust);
    }
    for (const y of [bottom, bottom + h]) s._box(bay, [w, .055, d], [0, y, 0], m.silver);
    // Thin galvanized fins behind broad, weathered horizontal safety wires.
    for (let xx = -.64; xx < .66; xx += .055) for (const z of [-.614, .614]) s._box(bay, [.008, h - .08, .012], [xx, bottom + h / 2, z], m.frame);
    for (let y = bottom + .09; y < bottom + h - .03; y += .065) {
      for (const z of [-d / 2 - .009, d / 2 + .009]) s._box(bay, [w - .04, .012, .018], [0, y, z], m.rust);
      for (const xx of [-w / 2 - .008, w / 2 + .008]) s._box(bay, [.018, .012, d - .04], [xx, y, 0], m.rust);
    }
    for (const z of [-d / 2 - .022, d / 2 + .022]) for (const xx of [-.48, .48]) s._box(bay, [.014, h, .014], [xx, bottom + h / 2, z], m.rust);
  }
  const fans = s._part(root, item.parts[1] || '상부 팬 2개·보호망', [0, .85, .1]);
  for (let index = 0; index < 2; index++) {
    const g = s._group(fans, [index === 0 ? -.77 : .77, 0, 0]); g.name = `outdoor-condenser-fan-${index + 1}`;
    fan(s, g, 0, 1.52, 0, .55);
    for (let radius = .08; radius <= .58; radius += .045) torus(s, g, radius, .009, [0, 1.66, 0], m.rust);
    for (const y of [1.55, 1.6, 1.65]) torus(s, g, .58, .01, [0, y, 0], m.rust);
    for (let i = 0; i < 10; i++) {
      const a = i * TAU / 10, x = Math.cos(a) * .58, z = Math.sin(a) * .58;
      pipe(s, g, [[0, 1.66, 0], [x, 1.66, z], [x, 1.52, z]], .009, m.rust);
    }
  }
  const services = s._part(root, item.parts[2] || '전선·받침', [.5, .05, -.65]);
  for (const x of [-.77, .77]) for (const z of [-.46, .46]) s._box(services, [.16, .045, .18], [x, .035, z], m.rubber);
  for (const x of [-.77, .77]) pipe(s, services, [[x, 1.15, -.65], [x, .26, -.76], [1.45, .22, -.76]], .022, m.rubber);
}

function airHandlingUnit(s, root, item) {
  const pet = item.variant === 'pet-pouch' || item.historyCardNumber === 85;
  const m = palette(s), w = 4, d = pet ? 2.1 : 2.3, bottom = .3, h = 2.7;
  const bodyRatio = 1.9 / h, roof = bottom + 1.9;
  const body = s._part(root, item.parts[0] || '공조기 외함·점검문', [-.8, .05, -.25]);
  body.name = 'outdoor-ahu-body';
  // Cards 084/085 show low, long cabinets. Compress the authored door and
  // window heights around the cabinet bottom while leaving real feet grounded.
  const shell = s._group(body, [0, bottom * (1 - bodyRatio), 0]); shell.scale.y = bodyRatio;
  s._box(shell, [w, h, d], [0, bottom + h / 2, 0], m.cream);
  for (const z of [-d / 2, d / 2]) {
    s._box(shell, [w + .03, .1, .07], [0, bottom + .02, z], m.silver);
    s._box(shell, [w + .03, .07, .07], [0, bottom + h, z], m.silver);
    for (const x of [-2, -.75, .75, 2]) s._box(shell, [.045, h, .025], [x, bottom + h / 2, z + Math.sign(z) * .025], m.silver);
  }
  for (const x of [-1.78, 0, 1.78]) for (const z of [-.92, .92]) {
    s._box(body, [.15, .24, .15], [x, .17, z], m.silver);
    s._box(body, [.25, .065, .25], [x, .045, z], m.rubber);
  }
  for (const x of pet ? [-1.3, 1.3] : [-1.5, -.16, 1.2]) {
    s._box(shell, [.96, 2.12, .045], [x, 1.48, d / 2 + .035], m.cream);
    for (const xx of [x - .48, x + .48]) s._box(shell, [.03, 2.15, .035], [xx, 1.48, d / 2 + .07], m.silver);
    for (const y of [.4, 2.55]) s._box(shell, [.99, .03, .035], [x, y, d / 2 + .07], m.silver);
    for (const y of [.69, 2.25]) {
      s._box(shell, [.12, .13, .045], [x + .43, y, d / 2 + .1], m.silver);
      for (const dx of [-.03, .03]) s._cyl(shell, .012, .025, [x + .43 + dx, y, d / 2 + .135], m.vent, .012, 6).rotation.x = PI / 2;
    }
    for (const y of [.8, 2.12]) {
      const hub = s._cyl(shell, .055, .065, [x - .34, y, d / 2 + .13], m.vent, .055, 12); hub.rotation.x = PI / 2;
      hub.scale.z = 1 / bodyRatio;
      s._box(shell, [.045, .2, .055], [x - .34, y - .1, d / 2 + .16], m.vent);
    }
    s._box(shell, [1.1, .06, .2], [x, 2.62, d / 2 + .12], m.cream);
    if (pet) {
      const window = s._cyl(shell, .235, .055, [x, 1.97, d / 2 + .12], m.vent, .235, 28); window.rotation.x = PI / 2;
      window.scale.z = 1 / bodyRatio;
      const glass = s._cyl(shell, .182, .06, [x, 1.97, d / 2 + .155], m.glass, .182, 28); glass.rotation.x = PI / 2;
      glass.scale.z = 1 / bodyRatio;
      torus(s, shell, .23, .018, [x, 1.97, d / 2 + .16], m.silver, true).scale.y = 1 / bodyRatio;
    } else {
      s._box(shell, [.47, .4 / bodyRatio, .05], [x, 1.97, d / 2 + .11], m.vent);
      s._box(shell, [.39, .32 / bodyRatio, .055], [x, 1.97, d / 2 + .14], m.glass);
    }
  }
  // Cards 084 and 085 establish distinct square-window and round-window AHUs.
  sign(s, shell, m.signAhu, [.33, 2.78, d / 2 + .065], .78, .17);
  if (pet) sign(s, shell, m.warning, [0, 1.6, d / 2 + .08], .32, .4 / bodyRatio);
  const air = s._part(root, item.parts[1] || '흡입 후드·상부 덕트', [0, 1.1, .45]);
  air.name = 'outdoor-ahu-air-path';
  // The folded gray rain hood occupies the narrow right end, not a door face.
  const hood = s._group(air, [w / 2 + .035, bottom + (1.08 - bottom) * bodyRatio, 0]); hood.name = 'outdoor-ahu-sloping-intake';
  hood.rotation.y = PI / 2; hood.scale.y = bodyRatio;
  s._box(hood, [1.65, .055, .67], [0, .17, .33], m.duct).rotation.x = -.45;
  for (const x of [-.82, .82]) {
    const side = s._box(hood, [.045, .43, .64], [x, -.03, .29], m.duct); side.rotation.x = -.45;
  }
  const mouth = s._box(hood, [1.67, .49, .045], [0, -.13, .6], m.rustyGrille); mouth.rotation.x = -.55;
  for (const x of [-.82, .82]) s._box(hood, [.04, .49, .055], [x, -.13, .64], m.silver).rotation.x = -.55;
  for (const y of [-.34, .09]) s._box(hood, [1.69, .035, .055], [0, y, .6 + y * .55], m.silver);
  const duct = s._group(air, [-.55, 0, -.22]); duct.name = 'outdoor-ahu-rectangular-duct';
  s._box(duct, [1.24, 3 - roof, 1.14], [0, (roof + 3) / 2, 0], m.duct);
  s._box(duct, [1.24, .36, 1.14], [0, 3.18, 0], m.duct);
  s._box(duct, [1.18, .27, 1.08], [0, 3.47, 0], m.rubber);
  for (const y of [3.38, 3.46, 3.54]) s._box(duct, [1.21, .028, 1.11], [0, y, 0], m.frame);
  for (const y of [3.31, 3.62]) s._box(duct, [1.32, .055, 1.22], [0, y, 0], m.silver);
  s._box(duct, [1.2, 1.06, 1.1], [0, 4.15, 0], m.duct);
  s._box(duct, [1.2, .72, 1.82], [0, 4.86, -.31], m.duct);
  for (const y of [3.95, 4.65]) s._box(duct, [1.24, .035, 1.14], [0, y, 0], m.silver);
  // A small lever and scale reproduce the visible manual damper exterior.
  s._box(duct, [.32, .32, .045], [.3, 3.95, .58], m.silver);
  pipe(s, duct, [[.28, 3.95, .63], [.48, 4.24, .63]], .025, m.frame);
  const support = s._group(duct); support.name = 'outdoor-ahu-roof-supported-frame';
  const postBottom = roof + .04, postTop = 5.1525;
  for (const x of [-1.3, .2]) {
    s._box(support, [.065, postTop - postBottom, .065], [x, (postTop + postBottom) / 2, .71], m.frame);
    s._box(support, [.15, .04, .18], [x, roof + .02, .71], m.rust);
  }
  s._box(support, [1.58, .065, .065], [-.55, 5.12, .71], m.frame);
  // Both current cards show a second roof opening above the hood end. Only
  // its exposed plenum, flexible joint and inclined gray duct are modelled;
  // no unseen roof penetration or connection to another plant is invented.
  const second = s._group(air, [1.22, 0, -.1]); second.name = 'outdoor-ahu-second-roof-duct';
  s._box(second, [1.3, 3.12 - roof, 1.14], [0, (roof + 3.12) / 2, 0], m.duct);
  s._box(second, [1.24, .25, 1.08], [0, 3.285, 0], m.rubber);
  for (const y of [3.21, 3.28, 3.35]) s._box(second, [1.265, .026, 1.105], [0, y, 0], m.frame);
  for (const y of [3.13, 3.43]) s._box(second, [1.38, .055, 1.22], [0, y, 0], m.silver);
  s._box(second, [1.3, .41, 1.14], [0, 3.665, 0], m.duct);
  const inclined = new THREE.BoxGeometry(1.3, .83, 1.14), vertices = inclined.attributes.position;
  for (let i = 0; i < vertices.count; i++) vertices.setZ(i, vertices.getZ(i) - (vertices.getY(i) + .415) * .58);
  inclined.computeVertexNormals();
  s._mesh(inclined, m.duct, second, [0, 4.285, 0]);
  s._box(second, [1.34, .045, 1.18], [0, 3.87, 0], m.silver);
  const controls = s._part(root, item.parts[2] || 'AHU-01 조작함·배수', [.7, .1, -.5]);
  controls.name = pet ? 'outdoor-pet-ahu-drain-and-supports' : 'outdoor-ahu-control-panel';
  const cabinet = s._group(controls, [0, 0, 2.25]);
  // The separate AHU-01 cabinet is evidenced next to the existing Stick AHU;
  // it is not duplicated onto the newly distinguished PET/pouch enclosure.
  if (!pet) {
    s._box(cabinet, [.6, 1.45, .3], [-1.65, 1.26, -.96], m.cream);
    s._box(cabinet, [.49, 1.06, .025], [-1.65, 1.24, -.79], m.vent);
    s._box(cabinet, [.43, .96, .03], [-1.65, 1.24, -.77], m.glass);
    sign(s, cabinet, m.signAhuControl, [-1.65, 1.92, -.775], .53, .14);
    s._box(cabinet, [.26, .15, .035], [-1.65, 1.48, -.74], m.vent);
    for (const [y, mat] of [[1.69, m.red], [1.15, m.green], [1.02, m.red]]) s._cyl(cabinet, .022, .025, [-1.65, y, -.72], mat, .022, 10).rotation.x = PI / 2;
    s._box(cabinet, [.08, .07, .04], [-1.65, .82, -.73], m.vent);
    for (const x of [-1.82, -1.48]) s._box(cabinet, [.055, .49, .055], [x, .245, -1.02], m.frame);
  }
  pipe(s, controls, [[1.5, bottom + (.57 - bottom) * bodyRatio, d / 2], [1.5, .3, 1.34], [.6, .3, 1.34], [.6, .19, 1.34]], .027, m.shell);
  pipe(s, controls, [[-1.58, bottom + (.55 - bottom) * bodyRatio, d / 2 + .12], [-1.48, .16, 1.35], [-.75, .14, 1.35]], .022, m.rubber);
}

function splitUnit(s, root, item) {
  const m = palette(s), w = .85, d = .7, h = 1.1;
  const shell = s._part(root, item.parts[0] || '백색 실외기 외함', [-.4, .08, -.3]);
  shell.name = 'outdoor-small-condenser-body';
  s._box(shell, [w, h, d], [0, .14 + h / 2, 0], m.shell);
  for (const x of [-.29, .29]) {
    s._box(shell, [.1, .13, .54], [x, .08, 0], m.silver);
    s._box(shell, [.15, .04, .5], [x, .025, 0], m.rubber);
  }
  for (const z of [-d / 2 - .012, d / 2 + .012]) {
    grille(s, shell, w - .08, .55, [0, .85, z], m.grille);
    for (const x of [-.2, .2]) for (let y = .3; y < .48; y += .045) s._box(shell, [.22, .008, .015], [x, y, z + Math.sign(z) * .02], m.silver);
  }
  const top = s._part(root, item.parts[1] || '상부 팬·열교환부', [0, .65, .1]);
  top.name = 'outdoor-small-condenser-fan';
  fan(s, top, 0, 1.25, 0, .29);
  const services = s._part(root, item.parts[2] || '배관·배수 호스', [.35, .03, .25]);
  for (const y of [.3, .44]) pipe(s, services, [[w / 2, y, -.1], [.58, y, -.1], [.58, .2, -.35], [.62, .18, -.5]], .022, m.silver);
  pipe(s, services, [[.2, .18, .22], [.34, .1, .4], [.65, .075, .48], [.79, .07, .35]], .018, m.shell);
}

// New end-section equipment comes from the continuous 11/09 walk-through.
// These are observed exterior groups; unlabelled nameplates stay blank.
function insulatedPipe(s, parent, points, radius = .16) {
  const m = palette(s), vectors = points.map((point) => new THREE.Vector3(...point));
  const curve = new THREE.CatmullRomCurve3(vectors, false, 'centripetal');
  s._mesh(new THREE.TubeGeometry(curve, Math.max(18, points.length * 8), radius, 12, false), m.insulation, parent);
  for (let i = 1; i < vectors.length; i++) {
    const direction = vectors[i].clone().sub(vectors[i - 1]);
    if (direction.length() < .25) continue;
    const centre = vectors[i].clone().add(vectors[i - 1]).multiplyScalar(.5);
    const seam = s._cyl(parent, radius + .007, .018, centre.toArray(), m.silver, radius + .007, 16);
    seam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  }
}

function processChiller(s, root, item) {
  // The campus row, outdoor scene and detail use one drawing-based assembly.
  const model = createChillerModel({ detail: false }); root.add(model.root);
  for (const record of model.pieces) {
    s.parts.push({ root, name: record.name, group: record.group, home: record.home.clone(), offset: record.offset.clone() });
  }
  model.root.traverse((mesh) => {
    if (mesh.geometry) s.geometries?.add(mesh.geometry);
    for (const material of [mesh.material].flat().filter(Boolean)) s.materials?.add(material);
    if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true; }
  });
}

function endPanelTank(s, root, item) {
  const m = palette(s), w = 4.2, d = 3.3, h = 3.15, bottom = .32;
  const shell = s._part(root, item.parts[0] || '스테인리스 패널 탱크·받침', [-.8, .12, -.4]);
  shell.name = 'outdoor-end-panel-tank-body';
  s._box(shell, [w, h, d], [0, bottom + h / 2, 0], m.silver);
  for (const z of [-d / 2 - .015, d / 2 + .015]) {
    // Card 088 shows two tall rows of broad round pressings, not three
    // rows of small generic tiles. Preserve the established overall envelope.
    for (let col = 0; col < 2; col++) for (let row = 0; row < 2; row++) {
      const panel = pressedPanel(s, shell, w / 2, h / 2, [-w / 2 + (col + .5) * w / 2, bottom + (row + .5) * h / 2, z]);
      if (z < 0) panel.rotation.y = PI;
    }
  }
  for (const x of [-w / 2 - .015, w / 2 + .015]) {
    for (let col = 0; col < 2; col++) for (let row = 0; row < 2; row++) {
      const panel = pressedPanel(s, shell, d / 2, h / 2, [x, bottom + (row + .5) * h / 2, -d / 2 + (col + .5) * d / 2], true);
      if (x < 0) panel.rotation.y = -PI / 2;
    }
  }
  for (const z of [-1.3, 1.3]) {
    s._box(shell, [w + .1, .16, .16], [0, .2, z], m.frame);
    for (const x of [-1.65, 0, 1.65]) s._box(shell, [.18, .3, .18], [x, .15, z], m.rust);
  }
  const top = s._part(root, item.parts[1] || '상부 점검구·사다리', [0, 1.2, .3]);
  top.name = 'outdoor-end-panel-tank-top';
  s._box(top, [w + .06, .075, d + .06], [0, bottom + h + .035, 0], m.silver);
  s._cyl(top, .4, .12, [.65, bottom + h + .12, -.3], m.silver, .4, 24);
  torus(s, top, .4, .022, [.65, bottom + h + .18, -.3], m.frame);
  ladder(s, top, -1.34, d / 2 + .18, bottom + h + .05);
  const fittings = s._part(root, item.parts[2] || '보온 연결관·핸드휠', [.8, .1, -.5]);
  fittings.name = 'outdoor-end-panel-tank-fittings';
  for (const z of [-.8, .8]) {
    insulatedPipe(s, fittings, [[2.1, .86, z], [2.37, .86, z], [2.55, .86, z + .18]], .18);
    const handwheel = s._group(fittings, [2.28, 1.17, z]);
    pipe(s, handwheel, [[0, -.28, 0], [0, 0, 0]], .026, m.silver);
    torus(s, handwheel, .13, .018, [0, .02, 0], m.green);
    for (const angle of [0, PI / 2]) pipe(s, handwheel, [[-.12 * Math.cos(angle), .02, -.12 * Math.sin(angle)], [.12 * Math.cos(angle), .02, .12 * Math.sin(angle)]], .01, m.green);
  }
}

function pumpSkid(s, root, item) {
  const m = palette(s), w = 2.9, d = 3;
  const pumps = s._part(root, item.parts[0] || '녹색 수직 펌프 2대·철골 받침', [-.6, .15, -.4]);
  pumps.name = 'outdoor-end-pump-skid-body';
  for (const z of [-d / 2 + .06, d / 2 - .06]) s._box(pumps, [w, .17, .12], [0, .22, z], m.frame);
  for (const x of [-w / 2 + .06, 0, w / 2 - .06]) s._box(pumps, [.12, .17, d], [x, .22, 0], m.frame);
  for (const x of [-1.22, 1.22]) for (const z of [-1.28, 1.28]) s._box(pumps, [.14, .22, .16], [x, .11, z], m.rust);
  for (let i = 0; i < 2; i++) {
    const x = i === 0 ? -.7 : .7, g = s._group(pumps, [x, 0, -.3]); g.name = `outdoor-end-pump-${i + 1}`;
    s._box(g, [.68, .065, .7], [0, .34, 0], m.rust);
    s._cyl(g, .29, .42, [0, .58, 0], m.pumpGreen, .29, 20);
    for (const y of [.42, .77]) s._cyl(g, .34, .07, [0, y, 0], m.pumpGreen, .34, 20);
    s._cyl(g, .22, .87, [0, 1.24, 0], m.pumpGreen, .22, 20);
    for (let n = 0; n < 18; n++) {
      const angle = n * TAU / 18, fin = s._box(g, [.025, .74, .12], [Math.cos(angle) * .235, 1.24, Math.sin(angle) * .235], m.pumpGreen); fin.rotation.y = -angle + PI / 2;
    }
    s._cyl(g, .25, .14, [0, 1.77, 0], m.pumpGreen, .25, 20);
    s._box(g, [.31, .4, .18], [0, 1.32, .28], m.pumpGreen);
    s._box(g, [.095, .18, .012], [0, 1.33, .38], m.silver);
    // Broad silver conical rain caps are especially clear in the video.
    s._cyl(g, .035, .32, [0, 2.02, 0], m.silver, .52, 28);
    torus(s, g, .52, .018, [0, 1.86, 0], m.silver);
    pipe(s, g, [[.12, 1.37, .33], [.42, 1.36, .4], [.47, .5, .5], [.18, .32, .7]], .018, m.rubber);
  }
  const headers = s._part(root, item.parts[1] || '흰색 보온 U배관·밸브', [0, .6, .65]);
  headers.name = 'outdoor-end-pump-insulated-headers';
  for (const x of [-.7, .7]) insulatedPipe(s, headers, [[x, .56, -.3], [x, .56, .38], [x, .56, .92], [x * .6, .56, 1.14]], .2);
  insulatedPipe(s, headers, [[-.42, .56, 1.14], [0, .56, 1.22], [.42, .56, 1.14]], .2);
  insulatedPipe(s, headers, [[-1.2, .62, -.9], [0, .62, -.9], [1.2, .62, -.9]], .18);
  for (const x of [-.7, .7]) {
    pipe(s, headers, [[x, .57, .38], [x, .85, .38]], .035, m.silver);
    torus(s, headers, .15, .022, [x, .88, .38], m.green);
    for (const angle of [0, PI / 2]) pipe(s, headers, [[x - Math.cos(angle) * .13, .88, .38 - Math.sin(angle) * .13], [x + Math.cos(angle) * .13, .88, .38 + Math.sin(angle) * .13]], .012, m.green);
  }
  const fittings = s._part(root, item.parts[2] || '계기·전선·배관 받침', [.6, .1, -.55]);
  for (const x of [-1.08, 1.08]) {
    s._box(fittings, [.1, .32, .12], [x, .38, .92], m.rust);
    gauge(s, fittings, x, .98, .61, .055);
  }
  pipe(s, fittings, [[-.9, .2, -1.2], [.9, .2, -1.2], [1.23, .18, -.9]], .025, m.rubber);
}

function endUnits(s, root, item) {
  const m = palette(s), body = s._part(root, item.parts[0] || '백색 실외기 2대·공통 받침', [-.7, .15, -.3]);
  body.name = 'outdoor-end-units-body';
  for (const z of [-.7, .7]) s._box(body, [4.7, .13, .12], [0, .16, z], m.silver);
  for (let i = 0; i < 2; i++) {
    const x = i === 0 ? -1.2 : 1.2, unit = s._group(body, [x, 0, 0]); unit.name = `outdoor-end-unit-${i + 1}`;
    s._box(unit, [2.12, 1.42, 1.55], [0, .95, 0], m.shell);
    for (const z of [-.79, .79]) {
      grille(s, unit, 1.6, 1.2, [.21, .98, z], m.coil);
      for (const xx of [-.6, .2, 1]) s._box(unit, [.035, 1.27, .045], [xx, .98, z + Math.sign(z) * .025], m.shell);
      for (let y = .42; y < 1.56; y += .055) s._box(unit, [1.6, .008, .012], [.21, y, z + Math.sign(z) * .025], m.silver);
    }
    s._box(unit, [.39, 1.42, .035], [-.87, .95, .82], m.shell);
    s._box(unit, [.035, .14, .025], [-.74, 1.1, .85], m.vent);
    for (const xx of [-.75, .75]) s._box(unit, [.15, .2, 1.25], [xx, .19, 0], m.silver);
  }
  const fans = s._part(root, item.parts[1] || '상부 팬·보호망', [0, .85, .15]);
  for (const x of [-1.2, 1.2]) {
    fan(s, fans, x, 1.7, 0, .58);
    s._box(fans, [2.17, .045, 1.6], [x, 1.65, 0], m.shell);
    // The guard remains above the top sheet.
    for (const radius of [.23, .39, .55]) torus(s, fans, radius, .014, [x, 1.79, 0], m.silver);
  }
  const services = s._part(root, item.parts[2] || '배관·배수·전선', [.7, .1, -.55]);
  for (const x of [-1.95, .45]) for (const y of [.35, .5]) pipe(s, services, [[x, y, -.76], [x, y, -1.05], [x + .45, .24, -1.05]], .025, m.silver);
}

function endSump(s, root, item) {
  const m = palette(s), ground = s._part(root, item.parts[0] || '청색 원형 맨홀·콘크리트 턱', [-.5, .05, -.4]);
  ground.name = 'outdoor-end-sump-body';
  s._box(ground, [2.45, .18, 2.2], [0, .08, 0], m.pad);
  s._cyl(ground, .88, .12, [0, .21, 0], m.blue, .88, 32);
  s._cyl(ground, .58, .04, [-.13, .29, .03], m.blue, .58, 28);
  torus(s, ground, .83, .018, [0, .28, 0], m.silver);
  for (const x of [-.32, .06]) s._box(ground, [.1, .028, .035], [x, .33, .03], m.vent);
  const services = s._part(root, item.parts[1] || '수직 배관·호스', [0, .5, .6]);
  services.name = 'outdoor-end-sump-pipework';
  pipe(s, services, [[.32, .28, .18], [.32, .64, .18], [.32, 2.25, .18], [-.25, 2.25, .18]], .06, m.blue);
  pipe(s, services, [[-.25, 2.25, .18], [-.25, 2.95, .18], [.12, 2.95, .18], [.12, 2.95, -.48]], .065, m.silver);
  valve(s, services, [.32, 1.55, .18], .64);
  pipe(s, services, [[-.48, .28, -.2], [-.48, .4, -.2], [-1.01, .42, -.62]], .026, m.rubber);
  const grating = s._part(root, item.parts[2] || '녹색 배수구·받침', [.5, 0, -.6]);
  s._box(grating, [.86, .055, .68], [1.65, .04, 0], m.vent);
  for (let x = 1.29; x < 2.05; x += .09) s._box(grating, [.02, .025, .62], [x, .08, 0], m.green);
  for (const z of [-.3, 0, .3]) s._box(grating, [.8, .025, .025], [1.65, .08, z], m.green);
}

function blueTank(s, root, item) {
  const m = palette(s), tank = s._part(root, item.parts[0] || '청색 플라스틱 물탱크·기초', [-.7, .1, -.35]);
  tank.name = 'outdoor-blue-storage-tank-body';
  // Low horizontal body with broad moulded ribs and a raised top hatch.
  const body = s._cyl(tank, 1.05, 2.7, [0, 1.18, 0], m.plasticBlue, 1.05, 24); body.rotation.z = PI / 2;
  for (const x of [-1.35, 1.35]) {
    const cap = s._mesh(new THREE.SphereGeometry(1.05, 20, 14), m.plasticBlue, tank, [x, 1.18, 0]); cap.scale.set(.28, 1, 1);
  }
  for (const x of [-1.18, -.59, 0, .59, 1.18]) {
    const rib = torus(s, tank, 1.065, .052, [x, 1.18, 0], m.plasticBlue, true); rib.rotation.y = PI / 2;
  }
  for (const z of [-.68, .68]) s._box(tank, [2.65, .2, .19], [0, .13, z], m.plasticBlue);
  s._box(tank, [1.04, .31, .97], [.2, 2.18, 0], m.plasticBlue);
  s._cyl(tank, .37, .095, [.2, 2.4, 0], m.plasticBlue, .37, 20);
  const plumbing = s._part(root, item.parts[1] || '주입구·연결 배관', [0, .55, .4]);
  plumbing.name = 'outdoor-blue-storage-tank-plumbing';
  pipe(s, plumbing, [[1.61, .45, 0], [1.85, .45, 0], [1.85, .24, -.4]], .055, m.shell);
  valve(s, plumbing, [1.8, .43, 0], .52);
  pipe(s, plumbing, [[-.45, 2.23, -.2], [-.45, 2.75, -.2], [-.45, 2.75, -.8]], .04, m.shell);
  const base = s._part(root, item.parts[2] || '콘크리트 받침·수평 보강', [.6, .05, -.4]);
  for (const x of [-1, 1]) s._box(base, [.35, .13, 1.95], [x, .065, 0], m.pad);
}

function stainlessVessel(s, root, item) {
  const m = palette(s), body = s._part(root, item.parts[0] || '세로형 스테인리스 탱크·다리', [-.55, .1, -.4]);
  body.name = 'outdoor-end-stainless-vessel-body';
  s._cyl(body, 1.03, 3.45, [0, 2.3, 0], m.silver, 1.03, 36);
  const top = s._mesh(new THREE.SphereGeometry(1.03, 28, 14), m.silver, body, [0, 4.02, 0]); top.scale.y = .23;
  const bottom = s._mesh(new THREE.SphereGeometry(1.03, 28, 14), m.silver, body, [0, .58, 0]); bottom.scale.y = .24;
  for (const y of [.59, 4.02]) torus(s, body, 1.035, .022, [0, y, 0], m.silver);
  for (const x of [-.68, .68]) for (const z of [-.68, .68]) {
    s._cyl(body, .065, .58, [x, .29, z], m.silver, .075, 12);
    s._box(body, [.22, .04, .22], [x, .025, z], m.silver);
  }
  const fittings = s._part(root, item.parts[1] || '원형 노즐·점검구', [0, .65, .5]);
  fittings.name = 'outdoor-end-stainless-vessel-nozzles';
  for (const y of [1.18, 2.85]) {
    const nozzle = s._cyl(fittings, .08, .18, [0, y, 1.08], m.silver, .08, 16); nozzle.rotation.x = PI / 2;
    const flange = s._cyl(fittings, .13, .045, [0, y, 1.18], m.silver, .13, 20); flange.rotation.x = PI / 2;
    torus(s, fittings, .08, .016, [0, y, 1.21], m.frame, true);
  }
  s._cyl(fittings, .25, .09, [.18, 4.27, -.15], m.silver, .25, 22);
  const pipes = s._part(root, item.parts[2] || '하부 연결관·보호 받침', [.55, .05, -.5]);
  pipe(s, pipes, [[0, .4, 0], [0, .25, 0], [.75, .25, 0], [.75, .25, -.85]], .055, m.silver);
  valve(s, pipes, [.75, .32, -.45], .48);
}

export function buildOutdoorEquipment(s, root, item) {
  const builders = {
    'outdoor-vrf': outdoorUnit, 'outdoor-panel-tank': panelTank,
    'outdoor-cooling-pair': coolingTower, 'outdoor-rack': rack,
    'outdoor-chiller': chiller, 'outdoor-pump-pit': pumpPit, 'outdoor-vessel': vessel,
    'outdoor-condenser-bank': condenserBank, 'outdoor-ahu': airHandlingUnit,
    'outdoor-split-unit': splitUnit,
    'outdoor-process-chiller': processChiller, 'outdoor-end-panel-tank': endPanelTank,
    'outdoor-pump-skid': pumpSkid, 'outdoor-end-units': endUnits,
    'outdoor-end-sump': endSump, 'outdoor-blue-tank': blueTank,
    'outdoor-stainless-vessel': stainlessVessel,
  };
  const build = builders[item.type];
  if (!build) return false;
  build(s, root, item);
  for (const part of s.parts.filter((entry) => entry.root === root)) batchOutdoorMeshes(s, part.group);
  return true;
}
