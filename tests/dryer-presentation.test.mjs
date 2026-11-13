import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { EQUIPMENT } from '../apps/site/building-data.js';
import { BURNER_MAINTENANCE_DOCUMENTS } from '../apps/site/burner-maintenance-data.js';

const temporaryRoot = await realpath(tmpdir());
const directory = await mkdtemp(path.join(temporaryRoot, 'dryer-presentation-test-'));
let html;
try {
  const output = path.join(directory, 'index.html');
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../tooling/export-site.mjs', import.meta.url)), '--profile', 'dryer', output], { encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  html = await readFile(output, 'utf8');
} finally {
  const resolved = await realpath(directory);
  assert.equal(path.dirname(resolved), temporaryRoot);
  await rm(resolved, { recursive: true, force: true });
}
const code = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].find(match => /type="module"/.test(match[1]))?.[2];
assert.ok(code, 'the standalone presentation contains its application module');
const appStart = code.lastIndexOf('\nconst $ = (id) => document.getElementById(id);');
assert.ok(appStart > 0);
const modelCode = code.slice(0, appStart);

function runtime() {
  const window = { devicePixelRatio: 1, matchMedia: () => ({ matches: false }), addEventListener() {}, removeEventListener() {} };
  const textContext = new Proxy({
    measureText: text => ({ width: String(text).length * 8 }),
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
  }, { get: (target, key) => key in target ? target[key] : () => {} });
  const rect = { left: 0, top: 0, width: 1100, height: 760 };
  const document = { hidden: false, defaultView: window, addEventListener() {}, removeEventListener() {}, querySelector: () => null };
  const element = tag => ({
    tagName: tag.toUpperCase(), ownerDocument: document, style: {}, dataset: {}, children: [], hidden: false, width: 256, height: 256,
    classList: { add() {}, remove() {}, toggle() {} },
    append(...children) { this.children.push(...children); },
    addEventListener() {}, removeEventListener() {}, setAttribute() {}, removeAttribute() {}, remove() {},
    getBoundingClientRect: () => rect, getContext: () => textContext,
    getClientRects: () => [rect], checkVisibility: () => true,
  });
  document.createElement = element;
  document.createElementNS = (_, tag) => element(tag);
  const context = vm.createContext({ window, document, requestAnimationFrame: () => 1, cancelAnimationFrame() {}, setTimeout, clearTimeout,
    ResizeObserver: class { observe() {} disconnect() {} }, performance: { now: () => 0 } });
  new vm.Script(`${modelCode}\nglobalThis.runtime = { THREE, createFacilityScene, equipment: EQUIPMENT, floors: FLOORS, documents: BURNER_MAINTENANCE_DOCUMENTS, regions: PLACEMENT_REGIONS };`).runInContext(context);
  const result = context.runtime;
  result.THREE.WebGLRenderer = class {
    constructor({ canvas }) { this.domElement = canvas; this.shadowMap = {}; }
    setPixelRatio() {} setSize() {} render() {} dispose() {}
    getContext() { return { isContextLost: () => false }; }
  };
  const canvas = element('canvas');
  canvas.parentElement = element('div');
  return { ...result, canvas };
}

test('manual dryer profile includes the building, roof and adjacent first-floor boiler interior while excluding other areas', () => {
  assert.match(html, /data-profile="dryer"/);
  assert.ok(Buffer.byteLength(html) < 25 * 1024 * 1024, 'the index fits static hosting limits');
  const equipment = JSON.parse(code.match(/^const EQUIPMENT = (\[[^\n]+\]);$/m)[1]);
  const floors = JSON.parse(code.match(/^const FLOORS = (\[[^\n]+\]);$/m)[1]);
  const expected = EQUIPMENT.filter(item => Number.isFinite(item.floor) && (item.id === 'f1-boiler-room' || !item.samePhysicalRoomAs));
  assert.deepEqual(equipment.map(item => item.id), expected.map(item => item.id));
  assert.ok(equipment.every(item => Number.isFinite(item.floor)));
  assert.equal(equipment.some(item => item.id === 'f1-boiler-room' && item.inspectableInterior), true);
  assert.equal(floors.find(floor => floor.id === 2).displayLevel, 1.5, 'the historical integer key keeps its current mezzanine name in the offline presentation');
  const filmed = expected.filter(item => item.dryerRoute);
  assert.ok(filmed.length > 0, 'the observed third-floor equipment must reach the presentation');
  for (const item of filmed) {
    const exported = equipment.find(value => value.id === item.id);
    assert.deepEqual(exported.dryerRoute, item.dryerRoute, `${item.id} preserves its filmed model configuration`);
    assert.equal(exported.placementRevision, item.placementRevision, `${item.id} keeps its one-time layout correction stamp`);
  }
  const markup = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  assert.doesNotMatch(markup, /data-area="(?:campus|outdoor|packaging|liquid)"|data-view="person"|data-person-|id="person-controls"/);
  assert.doesNotMatch(code, /const (?:OUTDOOR_EQUIPMENT|CAMPUS_EQUIPMENT|PACKAGING_EQUIPMENT|LIQUID_EQUIPMENT|CHILLER_ASSETS|LIQUID_ASSETS)\s*=/);
  assert.doesNotMatch(code, /const (?:campusModelsModule|outdoorModelsModule|packagingModelsModule|liquidModelsModule|personWalkModule|chillerDetailModule|liquidDetailModule)\s*=/);
  assert.match(code, /const boilerModelsModule\s*=/);
  assert.doesNotMatch(code, /^\s*(?:import|export)\s|\bimport\s*\(/m);
  assert.doesNotMatch(markup, /<(?:script|link|img)\b[^>]+(?:src|href)=["'](?!data:|#)/i);
  assert.match(code, /const STORAGE_KEY = 'dryer-presentation-layout-v1'/, 'presentation saves cannot overwrite the full workspace layout');
});

test('both burner documents and all three slide images are embedded byte for byte and remain available offline', async () => {
  const model = runtime();
  assert.deepEqual(Array.from(model.documents, item => item.id), BURNER_MAINTENANCE_DOCUMENTS.map(item => item.id));
  assert.equal(model.documents.reduce((count, item) => count + item.slides.length, 0), 3);
  for (const [index, original] of BURNER_MAINTENANCE_DOCUMENTS.entries()) {
    const document = model.documents[index];
    assert.equal(document.title, original.title);
    for (const [page, source] of original.slides.entries()) {
      const slide = document.slides[page];
      assert.match(slide.image, /^data:image\/jpeg;base64,/);
      assert.equal(slide.caption, source.caption);
      const originalBytes = await readFile(new URL(`../apps/site/${source.image.slice(2)}`, import.meta.url));
      assert.deepEqual(Buffer.from(slide.image.split(',')[1], 'base64'), originalBytes);
      assert.ok(!html.includes(source.image), 'an offline slide has no local-file dependency');
    }
  }
});

test('the bundled scene creates real dryer geometry while enforcing its floor and person restrictions independently of controller options', () => {
  const model = runtime();
  const scene = model.createFacilityScene(model.canvas, {
    equipment: [...model.equipment, { id: 'forbidden-campus-fixture', floor: 'campus', position: [0, 0, 0], rotation: 0 }],
    floor: 'all', enabledAreas: ['dryer', 'campus', 'outdoor', 'packaging'], personEnabled: true,
  });
  try {
    assert.equal(scene.activeFloor, 'all');
    assert.equal(scene.equipment.length, model.equipment.length);
    assert.equal(scene.objects.size, model.equipment.length, 'all retained objects have their actual model geometry');
    assert.deepEqual(Array.from(scene.floorDecks.keys()).sort((a, b) => a - b), [1, 2, 3, 4, 5, 6, 7, 8]);
    assert.equal(scene.outdoor, undefined);
    assert.equal(scene.campus, undefined);
    assert.equal(scene.packagingEnvironments.size, 0);
    assert.equal(scene.personCamera, null);
    assert.equal(scene.personAvatar, undefined);
    assert.equal(scene.personMarker, undefined);
    assert.equal(scene.scene.getObjectByName('facility-person'), undefined);
    scene.setFloor(1); scene.setView('top');
    const boilerRoom = scene.objects.get('f1-boiler-room');
    assert.equal(boilerRoom.visible, true, 'the adjacent boiler interior is present in the manual first-floor plan');
    assert.ok(boilerRoom.getObjectByName('preparation-boiler-room-interior'));
    const boilers = []; boilerRoom.traverseVisible(node => { if (node.userData.boilerId) boilers.push(node.userData.boilerId); });
    assert.deepEqual(boilers, ['firetube-3t', 'once-through-1.5t']);
    scene.setFloor('all');
    assert.deepEqual(Object.keys(model.regions).sort(), ['building', 'roof', 'upper']);
    for (const floor of ['campus', 'outdoor', 'packaging', 'liquid']) { scene.setFloor(floor); assert.equal(scene.activeFloor, 'all'); }
    scene.setView('person'); assert.equal(scene.view, 'perspective');
    scene.setPersonInput('forward', true); assert.equal(scene.personInputs.size, 0);
    scene.setFloor('roof'); assert.equal(scene.activeFloor, 8);
    assert.equal(scene.objects.get('dryer-roof-water-tank').visible, true);
    scene.setFloor(6); scene.select('heater');
    assert.equal(scene.selected, 'heater');
    assert.equal(scene.objects.get('heater').visible, true);
    scene.setView('top'); assert.equal(scene.view, 'top');
    scene.focus('heater');
    assert.ok(scene.goalTarget.toArray().every(Number.isFinite));
  } finally { scene.dispose(); }
});
