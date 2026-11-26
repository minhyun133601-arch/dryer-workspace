import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { EQUIPMENT } from '../apps/site/building-data.js';

const temporaryRoot = await realpath(tmpdir());
const directory = await mkdtemp(path.join(temporaryRoot, 'dryer-automatic-presentation-'));
let html;
try {
  const output = path.join(directory, 'presentation.html');
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../tooling/export-site.mjs', import.meta.url)), '--profile', 'presentation', output], { encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  html = await readFile(output, 'utf8');
} finally {
  const resolved = await realpath(directory);
  assert.equal(path.dirname(resolved), temporaryRoot);
  await rm(resolved, { recursive: true, force: true });
}
const code = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].find(match => /type="module"/.test(match[1]))?.[2];
assert.ok(code);
const appStart = code.indexOf('\n// BEGIN PRESENTATION APP\n');
assert.ok(appStart > 0);

function runtime() {
  const window = { devicePixelRatio: 1, matchMedia: () => ({ matches: false }), addEventListener() {}, removeEventListener() {} };
  const textContext = new Proxy({ measureText: text => ({ width: String(text).length * 8 }),
    createLinearGradient: () => ({ addColorStop() {} }), createRadialGradient: () => ({ addColorStop() {} }),
  }, { get: (target, key) => key in target ? target[key] : () => {} });
  const rect = { left: 0, top: 0, width: 1100, height: 760 };
  const document = { hidden: false, defaultView: window, addEventListener() {}, removeEventListener() {}, querySelector: () => null };
  const element = tag => ({ tagName: tag.toUpperCase(), ownerDocument: document, style: {}, dataset: {}, children: [], hidden: false, width: 256, height: 256,
    classList: { add() {}, remove() {}, toggle() {} }, append(...children) { this.children.push(...children); },
    addEventListener() {}, removeEventListener() {}, setAttribute() {}, removeAttribute() {}, remove() {},
    getBoundingClientRect: () => rect, getContext: () => textContext, getClientRects: () => [rect], checkVisibility: () => true,
  });
  document.createElement = element;
  document.createElementNS = (_, tag) => element(tag);
  const context = vm.createContext({ window, document, requestAnimationFrame: () => 1, cancelAnimationFrame() {}, setTimeout, clearTimeout,
    ResizeObserver: class { observe() {} disconnect() {} }, performance: { now: () => 0 } });
  new vm.Script(`${code.slice(0, appStart)}\nglobalThis.runtime = { THREE, createFacilityScene, equipment: EQUIPMENT, floors: FLOORS, steps: TOUR_STEPS, avatar: personAvatarModule };`).runInContext(context);
  const model = context.runtime;
  model.THREE.WebGLRenderer = class {
    constructor({ canvas }) { this.domElement = canvas; this.shadowMap = {}; }
    setPixelRatio() {} setSize() {} render() {} dispose() {}
    getContext() { return { isContextLost: () => false }; }
  };
  const canvas = element('canvas'); canvas.parentElement = element('div');
  return { ...model, canvas };
}

test('the automatic presentation is a standalone dryer-only file with its controls, company logo and tour', async () => {
  const markup = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  assert.ok(Buffer.byteLength(html) < 25 * 1024 * 1024);
  assert.match(markup, /id="presentation-canvas"/);
  assert.match(markup, /data-action="(?:play|next|previous|restart)"/);
  assert.doesNotMatch(markup, /(?:src|href)=["'](?!data:|#)/i, 'all markup assets are embedded');
  assert.doesNotMatch(code, /^\s*(?:import|export)\s|\bimport\s*\(/m);
  assert.doesNotMatch(code, /const (?:OUTDOOR_EQUIPMENT|CAMPUS_EQUIPMENT|PACKAGING_EQUIPMENT|LIQUID_EQUIPMENT|boilerModelsModule|layoutEditorModule)\s*=/);
  const expected = EQUIPMENT.filter(item => Number.isFinite(item.floor) && item.id !== 'f1-boiler-room' && !item.samePhysicalRoomAs);
  const exported = JSON.parse(code.match(/^const EQUIPMENT = (\[[^\n]+\]);$/m)[1]);
  assert.deepEqual(exported.map(item => item.id), expected.map(item => item.id));
  assert.match(exported.find(item => item.id === 'f1-prep-console').preparation.facePhoto, /^data:image\/jpeg;base64,\/9j\//);
  const logoBytes = await readFile(new URL('../apps/site/assets/branding/company-logo.jpg', import.meta.url));
  const logo = `data:image/jpeg;base64,${logoBytes.toString('base64')}`;
  assert.equal([...markup.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g)].filter(match => match[1] === logo).length, 3, 'the header and guide use the supplied original logo bytes');
  const model = runtime();
  assert.equal(model.avatar.PERSON_LOGO_URL, logo, 'the three-dimensional guide uses the same offline company logo');
  assert.deepEqual([...new Set(Array.from(model.steps, step => step.floor).filter(Number.isFinite))], [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(model.steps.at(-1).kind, 'burner');
  const scripts = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).scripts;
  assert.match(scripts['export:presentation'], /--profile presentation$/);
});

test('the automatic bundle enforces dryer isolation and includes a person camera and branded guide', () => {
  const model = runtime();
  const scene = model.createFacilityScene(model.canvas, {
    equipment: [...model.equipment, { id: 'unrelated-campus-room', floor: 'campus', position: [0, 0, 0] }],
    floor: 1, enabledAreas: ['dryer', 'campus', 'outdoor', 'packaging'], personEnabled: false, controlledPresentation: false, includeAdjacentBoilerRoom: true,
  });
  try {
    assert.deepEqual(Array.from(scene.enabledAreas), ['dryer']);
    assert.equal(scene.controlledPresentation, true);
    assert.ok(scene.personCamera);
    assert.equal(scene.equipment.some(item => item.id === 'unrelated-campus-room' || item.id === 'f1-boiler-room'), false);
    assert.ok(scene.equipment.every(item => item.floor >= 1 && item.floor <= 8), 'the show stays on the dryer floors and their roof');
    assert.ok(scene.equipment.some(item => item.id === 'dryer-roof-drive'), 'the roof includes the elevator-machine-room drive');
    assert.ok(scene.scene.getObjectByName('facility-person'));
    for (const place of ['chest', 'back', 'helmet']) assert.ok(scene.scene.getObjectByName(`person-company-logo-${place}`));
    for (const area of ['campus', 'outdoor', 'packaging', 'liquid']) { scene.setFloor(area); assert.equal(scene.activeFloor, 1); }
    assert.equal(scene.outdoor, undefined);
    assert.equal(scene.campus, undefined);
    assert.equal(scene.packagingEnvironments.size, 0);
  } finally { scene.dispose(); }
});
