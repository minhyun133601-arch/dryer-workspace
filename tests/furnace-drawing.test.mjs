import test from 'node:test';
import { isRetainedEvidenceImage } from '../apps/site/evidence-assets.js';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from '../apps/shared/vendor/three.module.js';
import { BASIS, DIMENSIONS as D, DRAWING_GROUPS, DRAWING_INFO, DRAWING_PARTS, DRAWING_SHEETS, FIELD_STATUS, GAS_PATH, PART_BY_ID, PILOT_PATH, TRAIN_GASKET_ALLOWANCE } from '../apps/site/furnace-drawing-data.js';
import { createDrawingModel, DIMENSION_LINES, DRAWING_FRAME as F, FLOW_TAG, trainStation } from '../apps/site/furnace-drawing-model.js';

const sum = (values) => values.reduce((total, value) => total + value, 0);
const near = (actual, expected, tolerance, message) => assert.ok(Math.abs(actual - expected) <= tolerance, `${message}: ${actual} vs ${expected}`);

// The printed table, row by row, so a later edit cannot quietly change a part.
const PRINTED_TABLE = [
  ['1', 'MAIN GAS PIPE', '50A', 'K.S'], ['2', 'GAUGE', '1 kg/cm²', 'KONICS'], ['3', 'BALL VALVE', '10A', 'K.S'],
  ['4', 'REGULATOR', '#311550, 50A', 'PLOTRO'], ['5', 'GAUGE', '2000 mmAq, Ø75', 'KONICS'], ['6', 'PRESSURE S/W', 'SAPS-50V', 'NBPKOREA'],
  ['7', 'BALL VALVE', '10A', 'K.S'], ['8', 'SHOT-OFF V/V', 'VMR6', 'ELEKTROGAS'], ['9', 'SHOT-OFF V/V', 'VMR6', 'ELEKTROGAS'],
  ['10', 'CONTROL MOTOR', 'AR3C2002-SE2A2', 'ECONEX'], ['11', 'CONTROL V/V', 'NVP-50', 'NBPKOREA'], ['12', 'GAUGE', '1000 mmAq, Ø75', 'KONICS'],
  ['13', 'PRESSURE S/W', 'SAPS-150V', 'NBPKOREA'], ['14', 'BALL VALVE', '10A', 'K.S'], ['15', 'PILOT GAS PIPE', '15A', 'K.S'],
  ['16', 'UNION', '15A', 'K.S'], ['17', 'PILOT REGULATOR', '325-3M', 'MAXITROL'], ['18', 'PILOT SOL V/V', 'E6GA10, 15A', 'BRAHMA'],
  ['19', 'PILOT SOL V/V', 'E6GA10, 15A', 'BRAHMA'], ['20', 'GAUGE', '1000 mmAq, Ø75', 'KONICS'], ['21', 'BALL VALVE', '15A', 'K.S'],
];

function withModel(run) {
  const model = createDrawingModel();
  try { return run(model); } finally { model.dispose(); }
}
// Bounds in millimetres of a part in its assembled position.
function bounds(model, id) {
  model.setExplode(0);
  model.root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  for (const { group } of model.records.get(id).pieces) box.expandByObject(group);
  return { min: box.min.multiplyScalar(1000), max: box.max.multiplyScalar(1000) };
}

test('the parts list reproduces all 21 printed rows word for word', () => {
  const numbered = DRAWING_PARTS.filter(({ basis }) => basis === 'bom');
  assert.deepEqual(numbered.map(({ id, original, size, maker }) => [id, original, size, maker]), PRINTED_TABLE);
  assert.equal(new Set(DRAWING_PARTS.map(({ id }) => id)).size, DRAWING_PARTS.length);
  for (const part of DRAWING_PARTS) {
    for (const field of ['name', 'original', 'size', 'maker', 'place', 'role']) assert.ok(part[field]?.length > 0, `${part.id} needs ${field}`);
    assert.ok(DRAWING_GROUPS.some(({ id }) => id === part.group), `${part.id} needs a known group`);
    assert.ok(BASIS[part.basis], `${part.id} must state what it rests on`);
    if (part.field) assert.ok(FIELD_STATUS[part.field.status] && part.field.text.length > 0);
  }
  for (const id of [...GAS_PATH, ...PILOT_PATH]) assert.ok(PART_BY_ID[id], `flow path names unknown part ${id}`);
});

test('nameplates that disagree with the drawing stay flagged for maintenance', () => {
  assert.deepEqual(DRAWING_PARTS.filter(({ field }) => field?.status === 'differs').map(({ id }) => id), ['6', '10', '13']);
  assert.match(PART_BY_ID['10'].field.text, /Honeywell Modutrol IV M7284A1004/);
  assert.match(PART_BY_ID['13'].field.text, /DUNGS GW 150 A6/);
  assert.match(PART_BY_ID['8'].field.text, /VMR6-2 Rp2/);
});

test('the printed dimensions close on each other', () => {
  assert.equal(sum(D.flangeWidthPitch), D.flangeWidth);
  assert.equal(sum(D.flangeDepthPitch), D.flangeDepth);
  assert.equal(D.pipeBelowTop + D.pipeAboveBottom, D.height);
  near(D.inletToFlange + D.flangeWidth, D.overallWidth, .01, 'overall width');
  assert.equal(TRAIN_GASKET_ALLOWANCE, 2, 'the chain is 1473, two short of the stated 1475');
  near(D.trainLength + D.flangeToHoseAxis, D.inletToFlange + D.flangeWidth / 2, 1, 'hose axis on the chamber centre line');
  near(D.wallToStubJoint + D.stubJointToHoseFlange - D.hoseFlange + D.hoseLength + D.elbow50CenterToFace, D.wallToPipe, 1, 'piping sheet against the side view');
  const { side, reducer, middle } = D.header;
  near(2 * (side + reducer) + middle + 2 * D.elbow40CenterToFace, D.stubSpacing, 2, 'header against the stub spacing');
});

test('the valve train sits at the stations printed on the sheet', () => withModel((model) => {
  assert.deepEqual([0, 2, 3, 4, 5, 7, 8, 9, 10, 12].map(trainStation), [0, 178, 414, 555, 711, 941, 1097, 1156, 1276, 1475]);
  near(F.INLET_X, -1664.5, .01, 'inlet face');
  near(F.GAS_Z - F.WALL_Z, D.wallToPipe, .01, 'gas axis off the wall');
  for (const [id, from, to] of [['4', 178, 414], ['8', 555, 711], ['9', 941, 1097]]) {
    const { min, max } = bounds(model, id);
    near(min.x, F.INLET_X + from, 1, `${id} start`);
    near(max.x, F.INLET_X + to, 1, `${id} end`);
  }
  near(model.records.get('11').pieces[0].home.x, F.INLET_X + 1156, .01, 'control valve start');
  const gauges = { 2: D.firstGaugeFromInlet, 5: 414 + D.secondGaugeFromRegulator, 12: D.trainLength - D.lastGaugeFromOutlet };
  for (const [id, station] of Object.entries(gauges)) near(model.records.get(id).pieces[0].home.x, F.INLET_X + station, .01, `gauge ${id}`);
  near(model.records.get('1').pieces[0].home.x, F.INLET_X, .01, 'train starts at the inlet flange face');
}));

test('the chamber, flange and burner match the burner sheet', () => withModel((model) => {
  const chamber = bounds(model, 'F');
  near(chamber.max.x - chamber.min.x, D.flangeWidth, 1, 'flange width');
  near(chamber.max.z - chamber.min.z, D.flangeDepth, 1, 'flange depth');
  near(chamber.max.y - chamber.min.y, D.height, 1, 'chamber height');
  near(F.GAS_Y, D.height - D.pipeBelowTop, .01, 'gas axis height');
  const burner = bounds(model, 'E');
  near(burner.max.z - burner.min.z, 6 * 153, 1, 'six modules of 153 per leg');
  assert.equal(model.records.get('E').pieces.length, 15, 'two legs of six modules and a three piece cross bar');
  const stubs = bounds(model, 'C');
  near(stubs.min.z, F.JOINT_Z - D.stubLength, 1, 'stub inner end');
  near(model.records.get('A').pieces[0].home.z - F.HOSE_TOP_Z, D.hoseLength, .01, 'hose length between flanges');
  const hose = model.records.get('D').pieces[0].group.children.at(-1).geometry.parameters.path.getPoint(1).add(model.records.get('D').pieces[0].home);
  near(hose.x, 96, 1, 'pilot hose ends on the PILOT GAS port');
  near(hose.z, F.WALL_Z + 44, 1, 'pilot hose ends at the port stub');
}));

test('every listed part is selectable, finite and moves apart when exploded', () => withModel((model) => {
  model.setExplode(0);
  model.root.updateMatrixWorld(true);
  const assembled = new THREE.Box3().setFromObject(model.root);
  for (const part of DRAWING_PARTS) {
    const record = model.records.get(part.id);
    assert.ok(record.pieces.length > 0, `${part.id} needs geometry`);
    assert.ok(record.anchor, `${part.id} needs a balloon anchor`);
    assert.ok(model.anchorOf(part.id, new THREE.Vector3()).toArray().every(Number.isFinite));
    for (const { group } of record.pieces) {
      let meshes = 0;
      group.traverse((object) => {
        if (!object.isMesh) return;
        meshes++;
        assert.equal(object.userData.drawingPart, part.id, 'a picked mesh must name its own part');
        assert.ok(object.geometry.attributes.position.array.every(Number.isFinite), `${part.id} has non-finite vertices`);
      });
      assert.ok(meshes > 0, `${part.id} has an empty piece`);
    }
  }
  model.setExplode(1);
  model.root.updateMatrixWorld(true);
  assert.ok(new THREE.Box3().setFromObject(model.root).getSize(new THREE.Vector3()).length() > assembled.getSize(new THREE.Vector3()).length());
  const stationary = new Set(['C', 'F', 'G', 'H', 'X']);
  for (const { id, offset } of model.pieces) assert.equal(offset.lengthSq() === 0, stationary.has(id), `${id} explode offset`);
  for (const { from, to, label } of DIMENSION_LINES) assert.ok(label.length > 0 && [...from, ...to].every(Number.isFinite));
}));

test('selection dims the other parts and the drawing view can pick through the chamber walls', () => withModel((model) => {
  const camera = new THREE.PerspectiveCamera(30, 1.6, .1, 60);
  camera.position.set(.3, 4, .1);
  camera.lookAt(.3, 0, .1);
  camera.updateMatrixWorld(true);
  model.setExplode(0);
  model.root.updateMatrixWorld(true);
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  assert.equal(model.pick(raycaster), 'E', 'looking down the duct must reach the burner, not the translucent context');
  model.setHighlight('4');
  const selected = [...model.records.get('4').materials.values()][0], other = [...model.records.get('8').materials.values()][0];
  assert.equal(selected.transparent, false);
  assert.ok(selected.emissiveIntensity > 0);
  assert.equal(other.transparent, true);
  assert.ok(other.opacity < .5);
  model.setHighlight(null);
  assert.equal(other.transparent, false, 'clearing the selection restores solid parts');
  assert.equal(other.opacity, 1);
}));

test('every drawing frame remains local while removed field photos are absent from the runtime registry', async () => {
  const source = await readFile(new URL('../apps/site/furnace-detail.js', import.meta.url), 'utf8');
  const registry = Object.fromEntries([...source.matchAll(/^\s+(\w+): '(\.\/assets\/drawings\/furnace\/[a-z-]+\.jpg)',$/gm)].map((match) => [match[1], match[2]]));
  for (const key of Object.keys(DRAWING_SHEETS)) assert.ok(registry[`sheet${key}`], `sheet ${key} needs a registered image`);
  for (const part of DRAWING_PARTS) {
    if (part.photo) assert.equal(registry[part.photo], undefined, `${part.id} must not expose a retired field photo`);
    if (!part.sheet) continue;
    assert.ok(DRAWING_SHEETS[part.sheet.key], `${part.id} names an unknown sheet`);
    for (const value of [part.sheet.x, part.sheet.y, part.sheet.w]) assert.ok(value > 0 && value < 1, `${part.id} frame must be normalized`);
  }
  await Promise.all(Object.values(registry).map(async (reference) => {
    assert.equal(isRetainedEvidenceImage(reference), true);
    const url = new URL(reference, new URL('../apps/site/', import.meta.url));
    await access(url);
    assert.equal((await readFile(url)).subarray(0, 2).toString('hex'), 'ffd8', `${reference} must be a JPEG`);
  }));
  // tooling/export-site.mjs swaps each path for its data URL, once per occurrence.
  for (const reference of Object.values(registry)) assert.equal(source.split(reference).length - 1, 1, `${reference} must appear once`);
});

async function detailCameraHarness(width = 1000, height = 700) {
  const nodes = new Map(), timers = new Map(), frames = new Map(), captures = new Set();
  let timerId = 0, frameId = 0;
  const node = (key) => {
    if (nodes.has(key)) return nodes.get(key);
    const classes = new Set(), listeners = new Map();
    const value = { style: {}, hidden: false, open: false, offsetTop: 0, offsetHeight: 36, listeners,
      classList: { contains: (name) => classes.has(name), toggle(name, state) { const next = state ?? !classes.has(name); if (next) classes.add(name); else classes.delete(name); } },
      setAttribute() {}, append() {}, focus() {}, remove() {},
      addEventListener(type, listener) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(listener); },
      querySelector: (selector) => node(selector), querySelectorAll: () => [],
      getBoundingClientRect: () => ({ left: 0, top: 0, width, height }),
      setPointerCapture: (id) => captures.add(id), hasPointerCapture: (id) => captures.has(id), releasePointerCapture: (id) => captures.delete(id),
      close() { this.open = false; for (const listener of listeners.get('close') || []) listener({}); },
    };
    nodes.set(key, value); return value;
  };
  const document = { body: { append() {} }, createElement: (tag) => node(tag), createElementNS: (_, tag) => node(tag), addEventListener() {}, removeEventListener() {}, hidden: false };
  const source = (await readFile(new URL('../apps/site/furnace-detail.js', import.meta.url), 'utf8'))
    .replace(/^import .*;\r?\n/gm, '').replace('export function createFurnaceDetail', 'function createFurnaceDetail')
    .replace('return { open, close, dispose, setPresentationState };', `return { open, close, dispose, setPresentationState, test: {
      setup(root, photoRoot) {
        renderer = { render() {}, setSize() {}, dispose() {} };
        camera = new THREE.PerspectiveCamera(30, ${width / height}, .02, 300);
        world = new THREE.Scene(); world.add(root, photoRoot); modelRoot = photoRoot;
        drawing = { root, setExplode() {}, setHighlight() {}, pick() { return '4'; }, dispose() {} };
        plinth = new THREE.Object3D(); grid = { visible: true, geometry: { dispose() {} }, material: { dispose() {} } };
        layoutOverlay = () => {}; renderDetail = () => {}; dialog.open = true; draw();
      }, point: navigationPoint, reset, setMode, panCamera, zoomCamera,
      snapshot() { return { camera: camera.clone(), target: target.clone(), offset: panOffsets[mode].clone(), orbit: { ...orbit }, mode, selected, spread, amount }; },
      top() { orbit.elevation = 1.56; draw(); }
    } };`);
  const context = vm.createContext({ THREE, document, location: { pathname: '/site/' }, DRAWING_PARTS, DRAWING_GROUPS, DRAWING_INFO, DRAWING_SHEETS, FIELD_STATUS, BASIS, GAS_PATH, PILOT_PATH, PART_BY_ID, DIMENSION_LINES, FLOW_TAG,
    createBurnerService: () => ({ open() {}, close() {}, refresh() {}, dispose() {}, selectPart() {}, showEquipment() {} }),
    setTimeout(callback) { timers.set(++timerId, callback); return timerId; }, clearTimeout: (id) => timers.delete(id),
    requestAnimationFrame(callback) { frames.set(++frameId, callback); return frameId; }, cancelAnimationFrame: (id) => frames.delete(id), performance: { now: () => 1000 },
  });
  new vm.Script(`${source}\nglobalThis.detail = createFurnaceDetail();`).runInContext(context);
  const root = new THREE.Group(), photoRoot = new THREE.Group();
  for (const [group, center, size] of [[root, [-.98, 1.02, .62], [3, 2, 2]], [photoRoot, [.5, 3.8, .3], [7, 7, 4]]]) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), new THREE.MeshBasicMaterial());
    mesh.position.set(...center); group.add(mesh);
  }
  const detail = context.detail;
  detail.test.setup(root, photoRoot);
  return { ...detail.test, captures, timers,
    event(type, event = {}) { for (const listener of node('canvas').listeners.get(type) || []) listener({ pointerId: 1, pointerType: 'mouse', button: 0, shiftKey: false, clientX: width * .6, clientY: height * .45, timeStamp: 1000, preventDefault() {}, ...event }); },
    flushSelection() { for (const [id, callback] of [...timers]) { timers.delete(id); callback(); } },
    dispose() { detail.dispose(); for (const group of [root, photoRoot]) group.traverse((mesh) => { mesh.geometry?.dispose(); mesh.material?.dispose(); }); },
  };
}

test('furnace cursor zoom holds its anchor on desktop and phone in the drawing view, then reset restores the view', async () => {
  for (const [width, height] of [[1000, 700], [390, 640]]) {
    const h = await detailCameraHarness(width, height);
    try {
      for (const mode of ['drawing']) {
        h.setMode(mode); h.reset();
        const initial = h.snapshot();
        for (const position of [[.6, .45], [.98, .02]]) {
          const event = { clientX: width * position[0], clientY: height * position[1], deltaY: -160, deltaMode: 0 };
          const point = h.point(event), before = point.clone().project(h.snapshot().camera);
          h.event('wheel', event);
          const after = point.clone().project(h.snapshot().camera);
          near(after.x, before.x, 1e-9, `${mode} horizontal cursor anchor`);
          near(after.y, before.y, 1e-9, `${mode} vertical cursor anchor`);
        }
        assert.ok(h.snapshot().orbit.distance < initial.orbit.distance);
        for (let i = 0; i < 12; i++) h.event('wheel', { deltaY: -600 });
        assert.ok(h.snapshot().orbit.distance < 1, 'small parts must remain reachable beyond the previous zoom limit');
        h.event('keydown', { key: 'r' });
        assert.ok(h.snapshot().target.distanceTo(initial.target) < 1e-10);
        near(h.snapshot().orbit.distance, initial.orbit.distance, 1e-10, 'reset distance');
        assert.equal(h.snapshot().spread, initial.spread); assert.equal(h.snapshot().amount, initial.amount);
      }
    } finally { h.dispose(); }
  }
});

test('furnace double-click and two taps center the pointed location without selecting a part or applying a duplicate touch zoom', async () => {
  const h = await detailCameraHarness();
  try {
    const event = { clientX: 650, clientY: 310 }, point = h.point(event), initial = h.snapshot();
    h.event('pointerdown', event); h.event('pointerup', event);
    assert.equal(h.timers.size, 1);
    h.event('dblclick', event);
    assert.equal(h.timers.size, 0); assert.equal(h.snapshot().selected, null);
    const centered = point.project(h.snapshot().camera);
    near(centered.x, 0, 1e-9, 'double-click horizontal center'); near(centered.y, 0, 1e-9, 'double-click vertical center');
    assert.ok(h.snapshot().orbit.distance < initial.orbit.distance);
    h.reset();
    for (const timeStamp of [2000, 2200]) {
      h.event('pointerdown', { ...event, pointerType: 'touch', timeStamp });
      h.event('pointerup', { ...event, pointerType: 'touch', timeStamp: timeStamp + 20 });
    }
    const tapped = h.snapshot();
    assert.ok(tapped.orbit.distance < initial.orbit.distance); assert.equal(h.timers.size, 0); assert.equal(h.captures.size, 0);
    h.event('dblclick', { ...event, timeStamp: 2230 });
    near(h.snapshot().orbit.distance, tapped.orbit.distance, 1e-12, 'synthetic mouse double-click must not repeat the touch zoom');
    assert.equal(h.snapshot().selected, null); assert.equal(h.snapshot().mode, 'drawing');
    h.event('pointerdown', { timeStamp: 3000 }); h.event('pointerup', { timeStamp: 3020 }); h.flushSelection();
    assert.equal(h.snapshot().selected, '4', 'one click must retain the existing part selection');
  } finally { h.dispose(); }
});

test('furnace screen panning, top dragging and two-finger navigation keep geometry and the split state intact', async () => {
  const h = await detailCameraHarness();
  try {
    for (const input of [{ button: 1 }, { button: 2 }, { shiftKey: true }, { top: true }]) {
      h.reset(); if (input.top) h.top();
      const before = h.snapshot();
      h.event('pointerdown', input); h.event('pointermove', { ...input, clientX: 900, clientY: 550 }); h.event('pointerup', input);
      const after = h.snapshot();
      assert.ok(after.target.distanceTo(before.target) > .2);
      near(after.orbit.azimuth, before.orbit.azimuth, 1e-12, 'panning must not rotate');
      near(after.orbit.elevation, before.orbit.elevation, 1e-12, 'panning must preserve elevation');
      assert.equal(h.timers.size, 0); assert.equal(h.captures.size, 0);
    }
    h.reset(); const before = h.snapshot();
    h.event('pointerdown', { pointerType: 'touch', pointerId: 1, clientX: 400, clientY: 300 });
    h.event('pointerdown', { pointerType: 'touch', pointerId: 2, clientX: 600, clientY: 300 });
    h.event('pointermove', { pointerType: 'touch', pointerId: 2, clientX: 700, clientY: 370 });
    h.event('pointercancel', { pointerType: 'touch', pointerId: 2 }); h.event('pointerup', { pointerType: 'touch', pointerId: 1 });
    const after = h.snapshot();
    assert.ok(after.orbit.distance < before.orbit.distance); assert.ok(after.target.distanceTo(before.target) > .1);
    assert.equal(after.spread, before.spread); assert.equal(after.amount, before.amount); assert.equal(after.selected, null);
    assert.equal(h.timers.size, 0); assert.equal(h.captures.size, 0);
    h.panCamera(50000, -50000);
    assert.ok(h.snapshot().target.toArray().every(Number.isFinite));
    h.event('pointerdown'); h.event('pointerup'); assert.equal(h.timers.size, 1);
    h.setMode('photo'); assert.equal(h.timers.size, 0, 'changing sources must cancel a deferred drawing pick');
    h.reset(); assert.ok(h.snapshot().offset.length() === 0);
  } finally { h.dispose(); }
});
