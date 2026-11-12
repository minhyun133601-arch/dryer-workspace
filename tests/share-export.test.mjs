import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';
import { EQUIPMENT } from '../apps/site/building-data.js';
import { EQUIPMENT as SOURCE_PHOTO_EQUIPMENT } from '../apps/site/data.js';

const temporaryRoot = await realpath(tmpdir());
const temporaryDirectory = await mkdtemp(path.join(temporaryRoot, 'dryer-share-test-'));
const outputFile = path.join(temporaryDirectory, 'showcase.html');
let html;
let hostedHtml;
let offlineZip;
let hostedViewers;
try {
  const build = spawnSync(process.execPath, [fileURLToPath(new URL('../tooling/export-share.mjs', import.meta.url)), outputFile], { encoding: 'utf8', windowsHide: true });
  assert.equal(build.status, 0, build.stderr || build.stdout || 'Shared HTML export failed.');
  html = await readFile(outputFile, 'utf8');
  const hostedOutput = path.join(temporaryDirectory, 'hosted');
  const hostedBuild = spawnSync(process.execPath, [fileURLToPath(new URL('../tooling/export-share.mjs', import.meta.url)), '--hosted', hostedOutput], { encoding: 'utf8', windowsHide: true });
  assert.equal(hostedBuild.status, 0, hostedBuild.stderr || hostedBuild.stdout || 'Hosted HTML export failed.');
  hostedHtml = await readFile(path.join(hostedOutput, 'index.html'), 'utf8');
  offlineZip = await readFile(path.join(hostedOutput, 'downloads', 'dryer-workspace.zip'));
  hostedViewers = Object.fromEntries(await Promise.all(['site'].map(async (id) => [id, await readFile(path.join(hostedOutput, 'viewers', `${id}.html`), 'utf8')])));
} finally {
  const resolvedDirectory = await realpath(temporaryDirectory);
  assert.equal(path.dirname(resolvedDirectory), temporaryRoot, 'test cleanup must stay directly inside the system temporary directory');
  await rm(resolvedDirectory, { recursive: true, force: true });
}
const scripts = (source) => [...source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].map((match) => ({ attributes: match[1], code: match[2] }));
const payload = scripts(html).find(({ attributes }) => /\bid=["']viewer-documents["']/.test(attributes));
assert.ok(payload, 'the shared file needs its registered embedded viewer documents');
const documents = JSON.parse(payload.code);
const rootCode = scripts(html).find(({ attributes }) => /\btype=["']module["']/.test(attributes))?.code;
assert.ok(rootCode, 'the shared file needs its tab controller');

test('one shared HTML contains only the site model with inline resources', () => {
  assert.deepEqual(Object.keys(documents).sort(), ['site']);
  assert.doesNotMatch(html, /dryer-workspace:navigate/);
  assert.doesNotMatch(html, /data-(?:viewer|open-viewer)="(?:panel|motor|heat-exchanger)"/);
  for (const [name, source] of Object.entries(documents)) {
    assert.match(source, /<!doctype html>/i, name);
    assert.match(source, /<html\s+lang=["']ko["']/i, name);
    assert.match(source, /<style>/i, `${name} needs embedded styles`);
    assert.match(source, /MIT License|@license/, `${name} must retain the Three.js license`);
    assert.match(source, /<base\s+href=["']about:srcdoc["']/i, `${name} fragment links must remain in their viewer`);
    const markup = source.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
    assert.doesNotMatch(markup, /<(?:link|img)\b[^>]+(?:src|href)=["'](?!data:|#|about:srcdoc)/i, `${name} must open without other files`);
    assert.doesNotMatch(source, /<script\b[^>]*\bsrc=["']/i, `${name} scripts must be embedded`);
    const modules = scripts(source).filter(({ attributes }) => /\btype=["']module["']/.test(attributes));
    assert.equal(modules.length, 1, `${name} needs one bundled application module`);
    assert.doesNotMatch(modules[0].code, /^\s*(?:import|export)\s+(?:[^'";]+?\s+from\s*)?['"]|\bimport\s*\(/m, `${name} must not load a module at runtime`);
  }
  const mapModels = documents.site.match(/^const EQUIPMENT = (\[[^\n]+\]);$/m);
  assert.ok(mapModels, 'the map must contain its model data');
  const equipment = JSON.parse(mapModels[1]);
  assert.equal(equipment.length, 47, 'the active export includes nine observed preparation assemblies and retires three duplicate hall approximations');
  assert.equal(new Set(equipment.map(({ id }) => id)).size, 47);
  assert.deepEqual([...new Set(equipment.map(({ floor }) => floor))].sort((a, b) => a - b), [1, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(equipment.map(({ id }) => id), EQUIPMENT.map(({ id }) => id));
  assert.ok(equipment.every((item) => !('photo' in item) && !('photos' in item)), 'source photos must stay outside the shared file');
  assert.doesNotMatch(documents.site, /20261028_\d+\.jpg|owp-floor\d|source-photos\//);
});

test('the shared catalog preserves original identities and physical levels while exposing a same-height roof service selector', () => {
  const equipment = JSON.parse(documents.site.match(/^const EQUIPMENT = (\[[^\n]+\]);$/m)[1]);
  const floors = JSON.parse(documents.site.match(/^const FLOORS = (\[[^\n]+\]);$/m)[1]);
  assert.equal(equipment.length, 47);
  assert.deepEqual(equipment.map(({ id }) => id), EQUIPMENT.map(({ id }) => id));
  assert.deepEqual(floors.map(({ id }) => id), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(floors.find(({ id }) => id === 2).displayLevel, 1.5, 'the canonical integer floor key carries the current 1.5층 name');
  assert.deepEqual(floors.filter(({ kind }) => kind !== 'roof').map(({ id }) => id), [1, 2, 3, 4, 5, 6, 7]);
  const roof = floors.find(({ id }) => id === 8);
  assert.equal(roof.kind, 'roof');
  assert.equal(roof.elevation, 32.6);
  assert.equal(roof.elevation, floors.find(({ id }) => id === 7).elevation, 'the roof service area must not be stacked as another physical story');
  assert.match(roof.name, /옥상/); assert.doesNotMatch(roof.name, /8층/);
  assert.equal(floors.find(({ id }) => id === 6).elevation, 26.2);
  for (const original of SOURCE_PHOTO_EQUIPMENT) {
    const item = equipment.find(({ id }) => id === original.id);
    assert.ok(item, `${original.id} must retain its original ID in shared and hosted deep links`);
    assert.equal(item.floor, 6);
    assert.deepEqual(item.visibleFloors, [6, 7]);
    assert.deepEqual(item.parts, original.parts);
    assert.equal(item.type, original.type);
  }
  for (const id of ['f6-dryer-shell', 'f6-cyclone-bank', 'f6-exhaust-riser']) assert.equal(equipment.some((item) => item.id === id), false);
  const roofIds = ['dryer-roof-water-tank', 'dryer-roof-cylindrical-shell', 'dryer-roof-drive'];
  assert.deepEqual(equipment.filter(({ floor }) => floor === 8).map(({ id }) => id), roofIds);
  for (const id of roofIds) assert.deepEqual(equipment.find((item) => item.id === id).visibleFloors, [7, 8]);
  assert.equal(equipment.find(({ id }) => id === 'dryer-chamber-upper-well').floor, 7);
  assert.equal(equipment.find(({ id }) => id === 'heater').name, '건조실 버너');
  assert.match(documents.site, /createDryerUpperReference/);
  assert.match(documents.site, /id="upper-photos-open"/);
});

test('offline and hosted models carry the filmed dryer route environment and third-floor shape configuration', () => {
  const filmed = EQUIPMENT.filter(item => item.dryerRoute);
  assert.ok(filmed.length > 0, 'the observed route equipment is represented by model data');
  for (const source of [documents.site, hostedViewers.site]) {
    const equipment = JSON.parse(source.match(/^const EQUIPMENT = (\[[^\n]+\]);$/m)[1]);
    const floors = JSON.parse(source.match(/^const FLOORS = (\[[^\n]+\]);$/m)[1]);
    assert.equal(floors.find(floor => floor.id === 2).displayLevel, 1.5);
    assert.match(source, /function buildDryerRouteEnvironment\s*\(/, 'the route geometry builder is embedded without runtime file dependencies');
    for (const item of filmed) {
      const exported = equipment.find(value => value.id === item.id);
      assert.deepEqual(exported.dryerRoute, item.dryerRoute, `${item.id} retains its filmed model configuration`);
      assert.equal(exported.placementRevision, item.placementRevision, `${item.id} keeps its one-time layout correction stamp`);
    }
  }
});

test('offline and hosted maps include the preparation lower-view action and the adjacent view of the same boiler room', () => {
  for (const source of [documents.site, hostedViewers.site]) {
    const equipment = JSON.parse(source.match(/^const EQUIPMENT = (\[[^\n]+\]);$/m)[1]);
    const boiler = equipment.find(item => item.id === 'f1-boiler-room');
    assert.equal(boiler.floor, 1); assert.equal(boiler.type, 'preparation-boiler-room');
    assert.equal(boiler.samePhysicalRoomAs, 'campus-boiler-room');
    assert.deepEqual(boiler.position, [30.3, .3, -8.5]);
    assert.deepEqual([boiler.width, boiler.depth], [8.2, 9.8]);
    const services = equipment.find(item => item.id === 'f1-prep-under-services');
    assert.equal(services.floor, 1);
    assert.equal(services.preparation.kind, 'under-platform-services');
    assert(services.preparation.runs.length >= 3);
    assert(services.preparation.runs.every(run => run.points.length >= 2));
    assert.match(source, /id="preparation-lower-open"/);
    assert.match(source, /showPreparationLowerView\s*\(/);
    assert.match(source, /function buildPreparationBoilerRoom\s*\(/);
    assert.match(source, /id="boiler-open"/);
  }
});

test('offline and hosted viewers omit the retired upper-floor photo gallery while retaining the model', () => {
  for (const source of [documents.site, hostedViewers.site]) {
    const match = source.match(/const DRYER_UPPER_REFERENCE_PHOTOS = (\[[\s\S]*?\]);/);
    assert.ok(match, 'the compatible gallery API remains available without image assets');
    assert.equal(vm.runInNewContext(`(${match[1]})`).length, 0);
    assert.doesNotMatch(source, /\.\/photos\/dryer-roof-7f\//);
    assert.match(source, /buildDryerUpperEnvironment/);
    assert.match(source, /createDryerUpperReference/);
  }
});

test('the shared map carries the drawing based furnace view without other files', () => {
  assert.match(documents.site, /KHMA-H760/);
  assert.match(documents.site, /createDrawingModel/);
  assert.match(documents.site, /M7284A1004/, 'field differences must reach the presentation file');
  assert.doesNotMatch(documents.site, /\.\/(?:photos\/furnace|assets\/drawings\/furnace)\//, 'sheets and photos must be embedded, not linked');
  const sheets = documents.site.match(/sheet(?:burner|piping): 'data:image\/jpeg;base64,/g) || [];
  assert.equal(sheets.length, 2, 'both drawing sheets open offline');
});

test('the parent controller and all bundled application scripts have valid JavaScript syntax', () => {
  const modules = [['tabs', rootCode], ...Object.entries(documents).flatMap(([name, source]) => scripts(source).filter(({ attributes }) => !/\btype=["']application\/json["']/.test(attributes)).map(({ code }) => [name, code]))];
  for (const [name, code] of modules) {
    const result = spawnSync(process.execPath, ['--check', '--input-type=module'], { input: code, encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 0, `${name}: ${result.stderr || result.stdout}`);
  }
});

class EventTargetStub {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(callback);
  }
  dispatch(type, event = {}) {
    event.target ??= this;
    for (const callback of this.listeners.get(type) || []) callback(event);
  }
}

function mountController(href = 'file:///shared/건조기-통합-공유.html', source = html) {
  const controllerScripts = scripts(source);
  const controllerPayload = controllerScripts.find(({ attributes }) => /\bid=["']viewer-documents["']/.test(attributes)).code;
  const controllerCode = controllerScripts.find(({ attributes }) => /\btype=["']module["']/.test(attributes)).code;
  const document = new EventTargetStub();
  document.hidden = false;
  const created = [];
  class ElementStub extends EventTargetStub {
    constructor(tagName) {
      super();
      this.tagName = tagName;
      this.dataset = {};
      this.attributes = new Map();
      this.children = [];
      this.hidden = false;
      this.messages = [];
      if (tagName === 'iframe') this.contentWindow = { postMessage: (data, origin) => this.messages.push({ data, origin }) };
    }
    setAttribute(name, value) { this.attributes.set(name, value); }
    getAttribute(name) { return this.attributes.get(name); }
    append(child) { this.children.push(child); }
    focus() { document.activeElement = this; }
    click() { this.clicked = true; this.dispatch('click'); }
  }
  const viewerIds = Object.keys(JSON.parse(controllerPayload));
  const tabs = ['home', ...viewerIds].map((viewer) => {
    const tab = new ElementStub('button');
    tab.dataset.viewer = viewer;
    return tab;
  });
  const cards = viewerIds.map((viewer) => {
    const card = new ElementStub('button');
    card.dataset.openViewer = viewer;
    return card;
  });
  const elements = new Map([
    ['viewer-documents', { textContent: controllerPayload }],
    ['home-view', new ElementStub('section')],
    ['viewers', new ElementStub('div')],
    ['download-file', new ElementStub('button')],
  ]);
  document.getElementById = (id) => elements.get(id);
  document.querySelectorAll = (selector) => {
    if (selector === '[data-viewer]') return tabs;
    if (selector === '[data-open-viewer]') return cards;
    assert.fail(`Unexpected selector: ${selector}`);
  };
  document.createElement = (tag) => { const element = new ElementStub(tag); created.push(element); return element; };
  const window = new EventTargetStub();
  const location = { href };
  vm.runInNewContext(controllerCode, { document, window, location, URL }, { filename: 'shared-viewer-tabs.js' });
  return {
    document, window, location, tabs, created,
    frames: () => elements.get('viewers').children,
    frame: (id) => elements.get('viewers').children.find(({ dataset }) => dataset.viewer === id),
    tab: (id) => tabs.find(({ dataset }) => dataset.viewer === id),
    card: (id) => cards.find(({ dataset }) => dataset.openViewer === id),
    home: elements.get('home-view'),
    viewers: elements.get('viewers'),
    download: elements.get('download-file'),
  };
}

const lastActivity = (frame) => frame.messages.at(-1)?.data.active;

test('shared links open the main screen before loading a viewer and home cards preserve scenes on return', () => {
  for (const [href, source] of [
    ['file:///shared/showcase.html', html],
    ['https://example.test/', hostedHtml],
  ]) {
    const ui = mountController(href, source);
    assert.equal(ui.frames().length, 0, 'the main screen must not load a hidden 3D scene');
    assert.equal(ui.home.hidden, false);
    assert.equal(ui.viewers.hidden, true);
    assert.equal(ui.tab('home').getAttribute('aria-selected'), 'true');
    assert.equal(ui.tab('home').tabIndex, 0);
    assert.equal(ui.tab('site').tabIndex, -1);

    ui.card('site').click();
    const map = ui.frame('site');
    assert.equal(ui.frames().length, 1);
    assert.equal(ui.home.hidden, true);
    assert.equal(ui.viewers.hidden, false);
    assert.equal(lastActivity(map), true);
    assert.equal(ui.document.activeElement, ui.tab('site'));
    map.savedSelection = 'outdoor-ahu';

    ui.tab('home').click();
    assert.equal(ui.home.hidden, false);
    assert.equal(ui.viewers.hidden, true);
    assert.equal(map.hidden, true);
    assert.equal(lastActivity(map), false, 'returning home pauses the retained scene');
    map.dispatch('load');
    assert.equal(lastActivity(map), false, 'late readiness cannot resume the scene behind home');

    ui.card('site').click();
    assert.equal(ui.frames().length, 1);
    assert.equal(ui.frame('site'), map);
    assert.equal(map.savedSelection, 'outdoor-ahu');
    assert.equal(lastActivity(map), true);
  }
});

test('site deep links load one retained model with fullscreen support', () => {
  const ui = mountController('file:///shared/showcase.html?viewer=site');
  assert.equal(ui.frames().length, 1);
  const map = ui.frame('site');
  assert.equal(map.srcdoc, documents.site);
  assert.equal(map.getAttribute('role'), 'tabpanel');
  assert.equal(map.getAttribute('aria-labelledby'), 'tab-site');
  assert.equal(map.getAttribute('allow'), 'fullscreen');
  assert.equal(lastActivity(map), true);
  assert.equal(ui.tab('site').getAttribute('aria-selected'), 'true');
  assert.equal(ui.tab('site').tabIndex, 0);
  for (const id of ['motor', 'panel', 'heat-exchanger']) assert.equal(ui.tab(id), undefined);
  map.savedPlacement = { id: 'outdoor-pet-ahu', x: 37 };
  ui.tab('home').click();
  assert.equal(map.hidden, true);
  assert.equal(lastActivity(map), false);
  ui.tab('site').click();
  assert.equal(ui.frames().length, 1, 'returning must reuse the same model and placement state');
  assert.equal(ui.frame('site'), map);
  assert.deepEqual(map.savedPlacement, { id: 'outdoor-pet-ahu', x: 37 });
  assert.equal(lastActivity(map), true);
});

test('tab keyboard navigation wraps between home and the model', () => {
  const ui = mountController();
  let prevented = 0;
  const key = (viewer, value) => ui.tab(viewer).dispatch('keydown', { key: value, preventDefault() { prevented += 1; } });
  key('site', 'ArrowRight');
  assert.equal(ui.document.activeElement, ui.tab('home'));
  assert.equal(ui.tab('home').tabIndex, 0);
  assert.equal(ui.tab('site').tabIndex, -1);
  key('home', 'ArrowLeft');
  assert.equal(ui.document.activeElement, ui.tab('site'));
  key('site', 'Home');
  assert.equal(ui.document.activeElement, ui.tab('home'));
  key('home', 'End');
  assert.equal(ui.document.activeElement, ui.tab('site'));
  key('site', 'Escape');
  assert.equal(prevented, 4, 'unrelated keys must keep their normal behavior');
});

test('site deep links stay valid and archived viewer URLs return to the main screen', () => {
  for (const suffix of ['?viewer=site', '#/site', '?viewer=unknown#/site']) {
    const ui = mountController('file:///shared/showcase.html' + suffix);
    assert.equal(ui.frames().length, 1);
    assert.equal(ui.frame('site').srcdoc, documents.site);
    assert.equal(ui.tab('site').getAttribute('aria-selected'), 'true');
    assert.equal(lastActivity(ui.frame('site')), true);
    ui.location.href = 'file:///shared/showcase.html#/home';
    ui.window.dispatch('hashchange');
    assert.equal(ui.home.hidden, false);
    assert.equal(lastActivity(ui.frame('site')), false);
    ui.location.href = 'file:///shared/showcase.html#/site';
    ui.window.dispatch('hashchange');
    assert.equal(ui.frames().length, 1);
    assert.equal(lastActivity(ui.frame('site')), true);
  }
  for (const suffix of ['?viewer=unknown', '#/unknown', '?viewer=__proto__', '?viewer=motor', '#/panel', '#/heat-exchanger', '?viewer=site#/motor']) {
    const ui = mountController('file:///shared/showcase.html' + suffix);
    assert.equal(ui.frames().length, 0);
    assert.equal(ui.home.hidden, false);
    assert.equal(ui.tab('home').getAttribute('aria-selected'), 'true');
  }
});

test('backgrounding and late iframe readiness cannot resume the model behind home', () => {
  const ui = mountController();
  ui.tab('site').click();
  const map = ui.frame('site');
  ui.document.hidden = true;
  ui.document.dispatch('visibilitychange');
  assert.equal(lastActivity(map), false);
  map.dispatch('load');
  assert.equal(lastActivity(map), false, 'load while backgrounded must remain suspended');
  ui.document.hidden = false;
  ui.document.dispatch('visibilitychange');
  assert.equal(lastActivity(map), true);
  ui.tab('home').click();
  ui.window.dispatch('message', { source: map.contentWindow, data: { type: 'dryer-workspace:ready', moduleId: 'site' } });
  assert.equal(lastActivity(map), false, 'late readiness must not resume a scene behind home');
  const previousMessages = map.messages.length;
  ui.window.dispatch('message', { source: {}, data: { type: 'dryer-workspace:ready' } });
  assert.equal(map.messages.length, previousMessages, 'unrelated windows cannot trigger visibility changes');
});

test('saving from either a local file or a hosted link downloads the complete outer HTML', () => {
  for (const href of ['file:///shared/showcase.html', 'https://example.test/showcase/']) {
    const ui = mountController(href);
    ui.download.click();
    const link = ui.created.find(({ tagName }) => tagName === 'a');
    assert.equal(link.href, href);
    assert.equal(link.download, '건조기-통합-공유.html');
    assert.equal(link.clicked, true);
  }
});

test('hosted output keeps one self-contained site viewer below the hosting limit', () => {
  assert.ok(Buffer.byteLength(hostedHtml) < 50_000, 'the hosted shell must not embed the large viewer source payload');
  assert.match(hostedHtml, /오프라인 ZIP 저장/);
  const hostedPayload = scripts(hostedHtml).find(({ attributes }) => /\bid=["']viewer-documents["']/.test(attributes));
  assert.deepEqual(JSON.parse(hostedPayload.code), { site: 'viewers/site.html' });
  assert.deepEqual(Object.keys(hostedViewers), ['site']);
  for (const [id, source] of Object.entries(hostedViewers)) {
    assert.ok(Buffer.byteLength(source) < 25 * 1024 * 1024, id + ' must fit the static hosting asset limit');
    const sha = (value) => createHash('sha256').update(value).digest('hex');
    assert.equal(sha(source), sha(documents[id].replace(/<base\s+href=["']about:srcdoc["']\s*>/gi, '<base href="">')), id + ' must retain the same source, controls and bundled assets');
    assert.doesNotMatch(source, /<script\b[^>]*\bsrc=["']/i);
  }
  const href = 'https://example.test/?viewer=site';
  const ui = mountController(href, hostedHtml);
  const map = ui.frame('site');
  assert.equal(map.src, 'viewers/site.html');
  assert.equal(map.srcdoc, undefined, 'hosted frames load their split file');
  assert.equal(ui.location.href, href);
  ui.tab('home').click();
  assert.equal(lastActivity(map), false);
  ui.tab('site').click();
  assert.equal(ui.frame('site'), map, 'hosted tab switches retain model state');
  ui.download.click();
  const link = ui.created.find(({ tagName }) => tagName === 'a');
  assert.equal(link.href, 'https://example.test/downloads/dryer-workspace.zip');
  assert.equal(link.download, '건조기-통합-공유.zip');
});

test('hosted model fragments resolve against the site viewer', () => {
  assert.match(hostedViewers.site, /<base\s+href=["']["']\s*>/i);
  assert.doesNotMatch(hostedViewers.site, /about:srcdoc/);
});

test('the hosted offline ZIP contains one complete standalone HTML and stays below the asset limit', () => {
  assert.ok(offlineZip.length < 25 * 1024 * 1024);
  assert.equal(offlineZip.readUInt32LE(0), 0x04034b50, 'ZIP local entry signature');
  assert.equal(offlineZip.readUInt16LE(6) & 0x0800, 0x0800, 'the Korean filename uses UTF-8');
  assert.equal(offlineZip.readUInt16LE(8), 8, 'the HTML must be compressed with DEFLATE');
  const nameLength = offlineZip.readUInt16LE(26);
  assert.equal(offlineZip.subarray(30, 30 + nameLength).toString('utf8'), '건조기-통합-공유.html');
  const start = 30 + nameLength + offlineZip.readUInt16LE(28);
  const decoded = inflateRawSync(offlineZip.subarray(start, start + offlineZip.readUInt32LE(18)));
  assert.equal(decoded.length, Buffer.byteLength(html));
  const sha = (value) => createHash('sha256').update(value).digest('hex');
  assert.equal(sha(decoded), sha(html), 'extracting the ZIP restores the exact single-file offline workspace');
  const eocd = offlineZip.length - 22;
  assert.equal(offlineZip.readUInt32LE(eocd), 0x06054b50);
  assert.equal(offlineZip.readUInt16LE(eocd + 10), 1, 'the archive has one root HTML entry');
  assert.equal(offlineZip.readUInt32LE(offlineZip.readUInt32LE(eocd + 16)), 0x02014b50, 'ZIP central directory signature');
});
