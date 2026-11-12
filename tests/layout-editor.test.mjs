import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateLayout, createLayoutHistory, createLayoutEditor } from '../apps/site/layout-editor.js';
import { CAMPUS_EQUIPMENT } from '../apps/site/campus-data.js';
import { EQUIPMENT as BUILDING_EQUIPMENT } from '../apps/site/building-data.js';
import { LOWER_EQUIPMENT } from '../apps/site/facility-data.js';
import { EQUIPMENT as PHOTO_EQUIPMENT } from '../apps/site/data.js';

const equipment = [
  { id: 'dryer', position: [1, 37.5, 2], rotation: .5 },
  { id: 'outdoor', position: [-10, 0, 3], rotation: 0 },
];
const original = equipment.map((item) => ({ ...item, position: [...item.position] }));

function entrancePlacementFixture(items, storedPlacementRevisions) {
  const revision='entrance-route-registration-20261112', globalRevision='preparation-tank-openings-20261112';
  const catalog=[
    {id:'campus-guardhouse',floor:'campus',position:[61,0,57.5],rotation:0,placementRevision:revision,previousPlacements:[{position:[71,0,57.5],rotation:0,catalogRevision:globalRevision}]},
    {id:'campus-wastewater-treatment',floor:'campus',position:[25,0,53.5],rotation:0,placementRevision:revision,previousPlacements:[{position:[35,0,53.5],rotation:0,catalogRevision:globalRevision}]},
    {id:'reviewed-outdoor',floor:'outdoor',position:[35,0,-1.25],rotation:Math.PI/2,previousPlacements:[{position:[36.75,0,.5],rotation:0}],previousRotation:0},
    {id:'reviewed-office',floor:'campus',position:[42.5,0,-82.75],rotation:0,restorePlacementRevision:'campus-office-lpg-restoration-20261111'},
    {id:'reviewed-preparation',floor:1,position:[1,0,1],rotation:0,preparation:true,hangingDeck:{minX:0,maxX:2,minZ:0,maxZ:2}},
  ];
  const old=items || [
    {id:'campus-guardhouse',position:[71,0,57.5],rotation:0},
    {id:'campus-wastewater-treatment',position:[35,0,53.5],rotation:0},
    {id:'reviewed-outdoor',position:[36.75,0,.5],rotation:0},
    {id:'reviewed-office',position:[44,0,-80],rotation:.25},
    {id:'reviewed-preparation',position:[-7,0,-8],rotation:.5},
  ];
  const key='dryer-facility-layout-v1', saved=new Map([[key,JSON.stringify({version:1,catalogRevision:globalRevision,placementRevisions:storedPlacementRevisions,items:old})]]);
  const priorWindow=globalThis.window;let state=[],writes=0,editor,container;
  globalThis.window={localStorage:{getItem:name=>saved.get(name),setItem(name,value){writes++;saved.set(name,value);}}};
  const doc={createElement(tag){return new EditorNode(tag,this);}};doc.body=new EditorNode('body',doc);
  const scene={getLayout:()=>structuredClone(state),setLayout(layout){state=structuredClone(layout);return true;},setPlacementMode(){},setView(){}};
  const open=()=>{editor?.dispose();container=new EditorNode('div',doc);editor=createLayoutEditor({scene,equipment:catalog,container});return editor;};
  return {catalog,old,key,saved,open,get state(){return structuredClone(state);},get writes(){return writes;},get container(){return container;},dispose(){editor?.dispose();globalThis.window=priorWindow;}};
}

test('an entrance placement correction repairs untouched current-release defaults once without replaying preparation, office or outdoor repairs', () => {
  const fixture=entrancePlacementFixture();
  try {
    fixture.open();
    assert.deepEqual(fixture.state[0].position,[61,0,57.5]);
    assert.deepEqual(fixture.state[1].position,[25,0,53.5]);
    assert.deepEqual(fixture.state.slice(2),fixture.old.slice(2),'reviewed neighboring areas retain every saved pose');
    const payload=JSON.parse(fixture.saved.get(fixture.key));
    assert.equal(payload.catalogRevision,'preparation-tank-openings-20261112','the global preparation revision is unchanged');
    assert.deepEqual(payload.placementRevisions,{'campus-guardhouse':'entrance-route-registration-20261112','campus-wastewater-treatment':'entrance-route-registration-20261112'});
    assert.equal(fixture.writes,1);
    const corrected=fixture.state;fixture.open();
    assert.deepEqual(fixture.state,corrected);assert.equal(fixture.writes,1,'the corrected layout is stamped once and does not migrate again');
  } finally {fixture.dispose();}
});

test('entrance placement correction keeps manually moved or turned poses and checks each placement stamp independently', () => {
  for(const edit of [
    {position:[71.25,0,57.5],rotation:0},
    {position:[71,0,57.5],rotation:.25},
    {position:[71+1e-10,0,57.5],rotation:0},
  ]) {
    const fixture=entrancePlacementFixture([{id:'campus-guardhouse',...edit},{id:'campus-wastewater-treatment',position:[35,0,53.75],rotation:0}]);
    try {
      fixture.open();const retained=fixture.state;
      assert.deepEqual(retained[0].position,edit.position);assert.ok(Math.abs(retained[0].rotation-edit.rotation)<1e-12);
      assert.deepEqual(retained[1].position,[35,0,53.75]);
      fixture.open();assert.deepEqual(fixture.state,retained);assert.equal(fixture.writes,1);
    } finally {fixture.dispose();}
  }
  const reviewed=entrancePlacementFixture(undefined,{'campus-guardhouse':'entrance-route-registration-20261112'});
  try {
    reviewed.open();
    assert.deepEqual(reviewed.state[0].position,[71,0,57.5],'a stamped old guardhouse pose is an intentional later edit');
    assert.deepEqual(reviewed.state[1].position,[25,0,53.5],'the unreviewed treatment plant still receives its own correction');
  } finally {reviewed.dispose();}
});

test('explicit entrance layout imports preserve old poses and remain stable after reopening', async () => {
  const fixture=entrancePlacementFixture();
  try {
    fixture.open();
    const nodes=[],walk=node=>{nodes.push(node);node.children.forEach(walk);};walk(fixture.container);
    nodes.find(node=>node.textContent==='배치 편집').click();
    const file=nodes.find(node=>node.type==='file');
    file.files=[{size:1000,text:async()=>JSON.stringify({version:1,catalogRevision:'preparation-tank-openings-20261112',items:fixture.old})}];
    await file.listeners.get('change')();
    assert.deepEqual(fixture.state,fixture.old,'an explicit import does not apply automatic default migration');
    assert.equal(fixture.writes,2);
    fixture.open();assert.deepEqual(fixture.state,fixture.old);assert.equal(fixture.writes,2,'the imported old poses are stamped as intentional before reopening');
  } finally {fixture.dispose();}
});

test('the filmed lower-floor correction matches only exact qualified old poses and protects edits, stamps and explicit imports', () => {
  for (const floor of [1, 3]) {
  const revision = 'dryer-route-3f-20261112', sourceRevision = 'preparation-tank-openings-20261112';
  const old = { position: [-.5, 7.3, -3.5], rotation: 0 };
  const catalog = ['untouched', 'moved', 'turned', 'other-basis', 'wrong-revision', 'no-route'].map(id => ({
    id, floor, position: [5.5, floor === 1 ? .3 : 7.3, 0], rotation: 0, placementRevision: revision,
    ...(id === 'no-route' ? {} : { dryerRoute: { kind: floor === 1 ? 'overlook-packing-cubicle' : 'third-service-skid' } }),
    previousPlacements: [{ ...old, catalogRevision: id === 'wrong-revision' ? 'another-release' : sourceRevision,
      migrationBasis: id === 'other-basis' ? 'some-other-correction' : 'dryer-route-video-default' }],
  }));
  const items = catalog.map(({ id }) => ({ id, ...structuredClone(old) }));
  items[1].position[0] += 1e-10; items[2].rotation = .25;
  const payload = { version: 1, catalogRevision: sourceRevision, items };
  const restored = validateLayout(payload, catalog, { migrateDefaults: true, migrateDryerDefaults: false });
  assert.deepEqual(restored[0].position, catalog[0].position);
  const expectedItems = items.map(item => ({ ...item, position: [item.position[0], floor === 1 ? .3 : 7.3, item.position[2]] }));
  assert.deepEqual(restored.slice(1), expectedItems.slice(1), 'a move, turn, unrelated migration or unqualified model keeps its horizontal pose and catalog floor height');
  const reviewed = validateLayout({ ...payload, placementRevisions: { untouched: revision } }, catalog, { migrateDefaults: true, migrateDryerDefaults: false });
  assert.deepEqual(reviewed[0], expectedItems[0], 'a later deliberately saved old pose cannot migrate twice');
  assert.deepEqual(validateLayout(payload, catalog), expectedItems, 'explicit imports retain all selected horizontal poses');
  }
});

test('the real third-floor default repair persists once and a manually imported old position remains intentional', async () => {
  const item = BUILDING_EQUIPMENT.find(item => item.id === 'f3-homogenizer');
  const old = item.previousPlacements.find(pose => pose.migrationBasis === 'dryer-route-video-default' && pose.catalogRevision === 'preparation-tank-openings-20261112');
  const key = 'dryer-facility-layout-v1', oldItem = { id: item.id, position: [...old.position], rotation: old.rotation };
  const saved = new Map([[key, JSON.stringify({ version: 1, catalogRevision: old.catalogRevision, items: [oldItem] })]]);
  const priorWindow = globalThis.window; let writes = 0, state = [], editor, container;
  globalThis.window = { localStorage: { getItem: name => saved.get(name), setItem(name, value) { writes++; saved.set(name, value); } } };
  const doc = { createElement(tag) { return new EditorNode(tag, this); } }; doc.body = new EditorNode('body', doc);
  const scene = { getLayout: () => structuredClone(state), setLayout(layout) { state = structuredClone(layout); return true; }, setPlacementMode() {}, setView() {} };
  const open = () => { editor?.dispose(); container = new EditorNode('div', doc); editor = createLayoutEditor({ scene, equipment: [item], container }); };
  try {
    open(); assert.deepEqual(state[0].position, item.position); assert.equal(writes, 1);
    assert.equal(JSON.parse(saved.get(key)).placementRevisions[item.id], 'dryer-route-3f-20261112');
    open(); assert.deepEqual(state[0].position, item.position); assert.equal(writes, 1);
    const nodes = [], walk = node => { nodes.push(node); node.children.forEach(walk); }; walk(container);
    nodes.find(node => node.textContent === '배치 편집').click();
    const input = nodes.find(node => node.type === 'file');
    input.files = [{ size: 1000, text: async () => JSON.stringify({ version: 1, catalogRevision: old.catalogRevision, items: [oldItem] }) }];
    await input.listeners.get('change')();
    assert.deepEqual(state[0], oldItem); assert.equal(writes, 2);
    open(); assert.deepEqual(state[0], oldItem); assert.equal(writes, 2);
  } finally { editor?.dispose(); globalThis.window = priorWindow; }
});

class EditorNode {
  constructor(tag, ownerDocument) {
    this.tagName = tag; this.ownerDocument = ownerDocument; this.children = []; this.dataset = {};
    this.attributes = {}; this.listeners = new Map(); this.value = ''; this.textContent = '';
    this.classList = { toggle() {}, add() {} };
  }
  append(...nodes) { this.children.push(...nodes); }
  setAttribute(key, value) { this.attributes[key] = value; }
  addEventListener(type, callback) { this.listeners.set(type, callback); }
  removeEventListener(type) { this.listeners.delete(type); }
  click() { if (!this.disabled) this.listeners.get('click')?.({ target: this }); }
  remove() {}
}

function createCellEditorFixture({ maxX = 20 } = {}) {
  const document = new EditorNode('document');
  document.createElement = function (tag) { return new EditorNode(tag, this); };
  document.body = new EditorNode('body', document);
  const container = new EditorNode('div', document), saved = new Map();
  const priorWindow = globalThis.window;
  let writes = 0;
  globalThis.window = { localStorage: { getItem: key => saved.get(key), setItem(key, value) { writes++; saved.set(key, value); } } };
  const catalog = [
    { id: 'unit', name: '이동 설비', floor: 7, position: [10, 37.5, 20], rotation: .4 },
    { id: 'neighbor', name: '옆 설비', floor: 7, position: [14, 37.5, 24], rotation: .7 },
  ];
  const defaults = catalog.map(({ id, position, rotation }) => ({ id, position: [...position], rotation }));
  let state = structuredClone(defaults);
  const scene = {
    getLayout: () => structuredClone(state), setPlacementMode() {}, setView() {},
    setLayout(layout) { state = structuredClone(layout); return true; },
    getPlacementInfo(id) {
      const current = state.find(item => item.id === id);
      return { position: [current.position[0] - 10, 37.5, current.position[2] - 20],
        rotationDegrees: (current.rotation - .4) * 180 / Math.PI, step: .25, angleDegrees: 15, regionLabel: '설비 영역' };
    },
    setPlacementCoordinates(id, values) {
      const current = state.find(item => item.id === id);
      current.position = [10 + Math.min(maxX, Math.max(-20, Math.round(values.x * 4) / 4)), 37.5,
        20 + Math.min(20, Math.max(-20, Math.round(values.z * 4) / 4))];
      current.rotation = .4 + values.rotationDegrees * Math.PI / 180;
      return true;
    },
  };
  const editor = createLayoutEditor({ scene, equipment: catalog, container });
  const nodes = [], walk = node => { nodes.push(node); node.children.forEach(walk); }; walk(container);
  const find = predicate => { const node = nodes.find(predicate); assert.ok(node); return node; };
  const key = (value, options = {}) => {
    const event = { key: value, target: document.body, prevented: false, preventDefault() { this.prevented = true; }, ...options };
    document.listeners.get('keydown')?.(event); return event;
  };
  return { editor, find, key, defaults, get state() { return state; }, get writes() { return writes; }, saved,
    dispose() { editor.dispose(); globalThis.window = priorWindow; } };
}

test('cell counts drive room-axis buttons and arrow keys, with one save and undo per move', () => {
  const fixture = createCellEditorFixture();
  const { editor, find, key } = fixture;
  try {
    editor.select('unit');
    assert.equal(key('ArrowRight').prevented, false, 'viewing a selection cannot move it');
    assert.equal(fixture.writes, 0);
    find(node => node.textContent === '배치 편집').click();
    const count = find(node => node.dataset.layoutMoveCount !== undefined);
    assert.equal(count.value, '1');
    const right = find(node => node.dataset.layoutAxis === 'x' && node.dataset.layoutDirection === '1');
    assert.match(right.textContent, /\+1칸/);
    count.value = '5'; count.listeners.get('change')();
    assert.match(right.textContent, /\+5칸/);
    assert.equal(fixture.writes, 0, 'choosing a count does not alter or save the layout');
    right.click();
    assert.deepEqual(fixture.state[0].position, [11.25, 37.5, 20], 'five cells means five 0.25 increments along the room X axis');
    assert.equal(fixture.state[0].rotation, .4);
    assert.deepEqual(fixture.state[1], fixture.defaults[1], 'a neighbor remains unchanged');
    assert.equal(fixture.writes, 1);
    assert.deepEqual(JSON.parse(fixture.saved.get('dryer-facility-layout-v1')).items, fixture.state);
    find(node => node.textContent === '되돌리기').click();
    assert.deepEqual(fixture.state, fixture.defaults, 'a counted move is one undo action');
    count.value = '2'; count.listeners.get('change')();
    assert.equal(key('ArrowRight').prevented, true);
    assert.deepEqual(fixture.state[0].position, [10.5, 37.5, 20]);
    key('ArrowUp');
    assert.deepEqual(fixture.state[0].position, [10.5, 37.5, 19.5]);
    key('ArrowDown', { shiftKey: true });
    assert.deepEqual(fixture.state[0].position, [10.5, 37.5, 22], 'Shift moves five times the selected cell count');
    find(node => node.textContent === '되돌리기').click();
    assert.deepEqual(fixture.state[0].position, [10.5, 37.5, 19.5]);
  } finally { fixture.dispose(); }
});

test('placement shortcuts leave form editing alone and boundary no-ops do not create saves', () => {
  const fixture = createCellEditorFixture({ maxX: .25 });
  const { editor, find, key } = fixture;
  try {
    editor.select('unit'); find(node => node.textContent === '배치 편집').click();
    for (const target of [
      { closest: () => ({ tagName: 'INPUT' }) },
      { closest: () => ({ tagName: 'SELECT' }) },
      { closest: () => ({ tagName: 'BUTTON' }) },
      { isContentEditable: true },
    ]) assert.equal(key('ArrowRight', { target }).prevented, false);
    for (const modifier of ['ctrlKey', 'metaKey', 'altKey']) assert.equal(key('ArrowRight', { [modifier]: true }).prevented, false);
    const root = find(node => node.className === 'layout-editor');
    root.checkVisibility = () => false;
    assert.equal(key('ArrowRight').prevented, false, 'a hidden editor cannot move equipment behind another workspace');
    root.checkVisibility = () => true;
    assert.deepEqual(fixture.state, fixture.defaults);
    assert.equal(fixture.writes, 0);
    key('ArrowRight');
    assert.deepEqual(fixture.state[0].position, [10.25, 37.5, 20]);
    assert.equal(fixture.writes, 1);
    key('ArrowRight');
    assert.equal(fixture.writes, 1, 'a blocked step must not write another saved layout');
    assert.match(find(node => node.className === 'layout-edit-message').textContent, /더 이동할 수 없습니다/);
    find(node => node.textContent === '되돌리기').click();
    assert.deepEqual(fixture.state, fixture.defaults, 'a blocked step does not consume an undo state');
    editor.select('missing');
    assert.equal(key('ArrowRight').prevented, false);
    editor.select('unit'); find(node => node.textContent === '배치 편집').click();
    assert.equal(key('ArrowRight').prevented, false, 'closing edit mode releases the arrows');
    editor.dispose();
    assert.equal(key('ArrowRight').prevented, false, 'disposing the editor removes its shortcut listener');
  } finally { fixture.dispose(); }
});

test('imported placement remains on its original floor and rejects unsafe or ambiguous records', () => {
  const layout = validateLayout({ version: 1, items: [{ id: 'dryer', position: [12, -999, -6], rotation: 7 * Math.PI }] }, equipment);
  assert.deepEqual(layout[0].position, [12, 37.5, -6]);
  assert.ok(Math.abs(Math.abs(layout[0].rotation) - Math.PI) < 1e-10);
  assert.deepEqual(layout[1], original[1], 'missing equipment keeps the catalog layout');
  for (const values of [
    [{ id: 'missing', position: [0, 0, 0], rotation: 0 }],
    [{ ...original[0] }, { ...original[0] }],
    [{ ...original[0], position: [101, 37.5, 0] }],
    [{ ...original[0], position: [NaN, 37.5, 0] }],
    [{ ...original[0], rotation: Infinity }],
  ]) assert.throws(() => validateLayout(values, equipment));
  assert.throws(() => validateLayout({ version: 2, items: [] }, equipment));
  assert.deepEqual(equipment, original, 'validation never mutates the source catalog');
});

test('a coupled outdoor pose correction requires a complete old pose and preserves user moves, turns and explicit imports', () => {
  const oldRotation = 35 * Math.PI / 180, rotation = oldRotation + Math.PI / 2;
  const previousPlacements = [
    { position: [36.75, 0, .5], rotation: oldRotation },
    { position: [36, 0, -1.15], rotation: oldRotation },
  ];
  const catalog = ['untouched', 'older-default', 'moved', 'turned', 'small-move'].map((id) => ({
    id, floor: 'outdoor', name: id, position: [35, 0, -1.25], rotation, previousPlacements,
  }));
  catalog.push({ id: 'pet', floor: 'outdoor', position: [37.75, 0, -1.5], previousPosition: [37, 0, -1.5], rotation: oldRotation });
  const stored = [
    { id: 'untouched', position: [...previousPlacements[0].position], rotation: oldRotation + Math.PI * 2 },
    { id: 'older-default', position: [...previousPlacements[1].position], rotation: oldRotation },
    { id: 'moved', position: [37, 0, .5], rotation: oldRotation },
    { id: 'turned', position: [...previousPlacements[0].position], rotation: oldRotation + Math.PI / 12 },
    { id: 'small-move', position: [36.75 + 1e-10, 0, .5], rotation: oldRotation },
    { id: 'pet', position: [37, 0, -1.5], rotation: oldRotation + Math.PI / 12 },
  ];
  const restored = validateLayout(stored, catalog, { migrateDefaults: true, migrateOutdoorDefaults: false });
  for (const index of [0, 1]) {
    assert.deepEqual(restored[index].position, catalog[index].position, 'either complete old default adopts the corrected location');
    assert.ok(Math.abs(restored[index].rotation - rotation) < 1e-12, 'the matching position and facing migrate together');
  }
  for (const index of [2, 3, 4]) {
    assert.deepEqual(restored[index].position, stored[index].position, 'any custom move or turn keeps the whole saved pose');
    assert.ok(Math.abs(restored[index].rotation - stored[index].rotation) < 1e-12);
  }
  assert.deepEqual(restored[5].position, catalog[5].position, 'the existing independent position migration remains available');
  assert.ok(Math.abs(restored[5].rotation - stored[5].rotation) < 1e-12, 'a PET position correction keeps its custom facing');
  const imported = validateLayout({ version: 1, items: stored }, catalog);
  for (let index = 0; index < stored.length; index++) {
    assert.deepEqual(imported[index].position, stored[index].position, 'an explicit import never applies a default correction');
    assert.ok(Math.abs(imported[index].rotation - Math.atan2(Math.sin(stored[index].rotation), Math.cos(stored[index].rotation))) < 1e-12);
  }
});

test('the condenser pose revision migrates once without repeating reviewed unit facing corrections or changing imported poses', async () => {
  const oldRotation = 35 * Math.PI / 180;
  const oldPose = { position: [36.75, 0, .5], rotation: oldRotation };
  const catalog = [
    { id: 'condenser', name: '응축기', floor: 'outdoor', position: [35, 0, -1.25], rotation: oldRotation + Math.PI / 2, previousPlacements: [oldPose] },
    { id: 'reviewed-unit', name: '냉각기', floor: 'outdoor', position: [10, 0, -1], rotation: oldRotation - Math.PI / 2, previousRotation: oldRotation },
  ];
  const storedItems = [
    { id: 'condenser', ...structuredClone(oldPose) },
    { id: 'reviewed-unit', position: [10, 0, -1], rotation: oldRotation },
  ];
  const key = 'dryer-facility-layout-v1';
  const saved = new Map([[key, JSON.stringify({ version: 1, catalogRevision: 'team3-outdoor-cards-20261110', items: storedItems })]]);
  let writes = 0, state = [], editor;
  const priorWindow = globalThis.window;
  globalThis.window = { localStorage: { getItem: (name) => saved.get(name), setItem(name, value) { writes++; saved.set(name, value); } } };
  const doc = { createElement(tag) { return new EditorNode(tag, this); } };
  doc.body = new EditorNode('body', doc);
  const scene = { getLayout: () => structuredClone(state), setLayout(layout) { state = structuredClone(layout); return true; }, setPlacementMode() {}, setView() {} };
  try {
    editor = createLayoutEditor({ scene, equipment: catalog, container: new EditorNode('div', doc) });
    assert.deepEqual(state[0].position, catalog[0].position);
    assert.ok(Math.abs(state[0].rotation - catalog[0].rotation) < 1e-12);
    assert.ok(Math.abs(state[1].rotation - oldRotation) < 1e-12, 'the already-reviewed outdoor unit must not receive the old facing correction again');
    assert.equal(JSON.parse(saved.get(key)).catalogRevision, 'preparation-tank-openings-20261112');
    assert.equal(writes, 1);
    editor.dispose();
    const container = new EditorNode('div', doc);
    editor = createLayoutEditor({ scene, equipment: catalog, container });
    assert.equal(writes, 1, 'reloading the new revision is stable');
    const nodes = [], walk = (node) => { nodes.push(node); node.children.forEach(walk); }; walk(container);
    nodes.find((node) => node.textContent === '배치 편집').click();
    const file = nodes.find((node) => node.type === 'file');
    file.files = [{ size: 200, text: async () => JSON.stringify({ version: 1, items: storedItems }) }];
    await file.listeners.get('change')();
    assert.deepEqual(state[0].position, oldPose.position, 'an imported old position remains intentional');
    assert.ok(Math.abs(state[0].rotation - oldRotation) < 1e-12);
    assert.equal(writes, 2);
    editor.dispose();
    editor = createLayoutEditor({ scene, equipment: catalog, container: new EditorNode('div', doc) });
    assert.deepEqual(state[0].position, oldPose.position, 'the saved imported pose must not migrate again');
    assert.ok(Math.abs(state[0].rotation - oldRotation) < 1e-12);
    assert.equal(writes, 2);
  } finally { editor?.dispose(); globalThis.window = priorWindow; }
});

test('the full-length campus revision replaces only complete old liquid and utility poses and preserves reviewed outdoor facing', () => {
  const catalog = ['campus-blue-annex', 'campus-outdoor-area'].map((id) => CAMPUS_EQUIPMENT.find((item) => item.id === id));
  catalog.push({ id: 'reviewed-unit', floor: 'outdoor', name: 'unit', position: [10, 0, -1], rotation: Math.PI / 2, previousRotation: 0 });
  catalog.push({ id: 'reviewed-coil', floor: 'outdoor', name: 'coil', position: [22, 0, 1], rotation: Math.PI / 2,
    previousPlacements: [{ position: [20, 0, 1], rotation: 0 }] });
  const oldItems = catalog.map((item) => ({ id: item.id, position: [...(item.previousPlacements?.[0]?.position || item.position)], rotation: item.previousPlacements?.[0]?.rotation || 0 }));
  for (let i = 0; i < 2; i++) {
    assert.ok(catalog[i].previousPlacements?.length);
    assert.equal(catalog[i].previousPosition, undefined, 'independent position migration must not override a user-turned old campus pose');
    assert.equal(catalog[i].previousRotation, undefined);
    for (const pose of catalog[i].previousPlacements) {
      const untouched = structuredClone(oldItems); untouched[i] = { id: catalog[i].id, position: [...pose.position], rotation: pose.rotation };
      const migrated = validateLayout(untouched, catalog, { migrateDefaults: true, migrateOutdoorDefaults: false, sourceCatalogRevision: pose.catalogRevision });
      assert.deepEqual(migrated[i].position, catalog[i].position);
      assert.ok(Math.abs(migrated[i].rotation - catalog[i].rotation) < 1e-12);
      for (const edit of ['move', 'turn']) {
        const custom = structuredClone(untouched);
        if (edit === 'move') custom[i].position[0] += .25;
        else custom[i].rotation += Math.PI / 12;
        const kept = validateLayout(custom, catalog, { migrateDefaults: true, migrateOutdoorDefaults: false, sourceCatalogRevision: pose.catalogRevision });
        assert.deepEqual(kept[i].position, custom[i].position);
        assert.ok(Math.abs(kept[i].rotation - custom[i].rotation) < 1e-12);
      }
      const imported = validateLayout({ version: 1, items: untouched }, catalog);
      assert.deepEqual(imported[i].position, pose.position);
      assert.ok(Math.abs(imported[i].rotation - pose.rotation) < 1e-12);
    }
  }
  const key = 'dryer-facility-layout-v1', saved = new Map([[key, JSON.stringify({ version: 1, catalogRevision: 'outdoor-condenser-position-20261110', items: oldItems })]]);
  const priorWindow = globalThis.window;
  let writes = 0, state = [], editor;
  globalThis.window = { localStorage: { getItem: (name) => saved.get(name), setItem(name, value) { writes++; saved.set(name, value); } } };
  const doc = { createElement(tag) { return new EditorNode(tag, this); } }; doc.body = new EditorNode('body', doc);
  const scene = { getLayout: () => structuredClone(state), setLayout(layout) { state = structuredClone(layout); return true; }, setPlacementMode() {}, setView() {} };
  try {
    editor = createLayoutEditor({ scene, equipment: catalog, container: new EditorNode('div', doc) });
    assert.deepEqual(state.slice(0, 2).map((item) => item.position), catalog.slice(0, 2).map((item) => item.position));
    assert.equal(state[2].rotation, 0, 'a campus revision cannot repeat the already-reviewed unit-facing correction');
    assert.deepEqual(state[3].position, oldItems[3].position, 'an outdoor pose imported after its own correction must survive the campus update');
    assert.equal(state[3].rotation, 0, 'the already-reviewed complete outdoor pose cannot be corrected again');
    assert.equal(JSON.parse(saved.get(key)).catalogRevision, 'preparation-tank-openings-20261112');
    assert.equal(writes, 1);
    editor.dispose(); editor = createLayoutEditor({ scene, equipment: catalog, container: new EditorNode('div', doc) });
    assert.equal(writes, 1, 'restoring the revised defaults is stable on the next load');
  } finally { editor?.dispose(); globalThis.window = priorWindow; }
});

test('placement history records completed changes once and returns independent undo snapshots', () => {
  const history = createLayoutHistory(original);
  assert.equal(history.canUndo, false);
  assert.equal(history.push(original), false);
  const moved = original.map((item) => ({ ...item, position: [...item.position] })); moved[1].position[0] = -15;
  assert.equal(history.push(moved), true);
  assert.equal(history.push(moved), false, 'a drag start/end duplicate is not another undo action');
  moved[1].position[0] = 88;
  assert.equal(history.current()[1].position[0], -15, 'history must own snapshots');
  const restored = history.undo();
  assert.deepEqual(restored, original); restored[0].position[0] = 50;
  assert.equal(history.current()[0].position[0], 1);
  assert.equal(history.undo(), null);
});

test('the upper-dryer revision migrates only untouched X/Z poses, owns floor Y and preserves previously reviewed areas', async () => {
  const oldPose = { position: [-6, 37.5, -3], rotation: 0 };
  const catalog = ['default', 'moved', 'turned'].map((id) => ({
    id, name: id, floor: 6, position: [-1, 26.2, 7], rotation: Math.PI / 2, previousPlacements: [oldPose],
  }));
  catalog.push({ id: 'new-roof', name: '물탱크', floor: 8, position: [-6, 32.6, -10], rotation: 0 });
  catalog.push({ id: 'campus-reviewed', name: '액상동', floor: 'campus', position: [-38.4, 0, -29.85], rotation: 0,
    previousPlacements: [{ position: [-47, 0, -42], rotation: 0 }] });
  catalog.push({ id: 'outdoor-reviewed', name: '응축기', floor: 'outdoor', position: [35, 0, -1.25], rotation: Math.PI / 2,
    previousPlacements: [{ position: [36.75, 0, .5], rotation: 0 }], previousRotation: 0 });
  const storedItems = [
    { id: 'default', ...structuredClone(oldPose) },
    { id: 'moved', position: [-5.75, 37.5, -3], rotation: 0 },
    { id: 'turned', position: [-6, 37.5, -3], rotation: Math.PI / 12 },
    { id: 'campus-reviewed', position: [-47, 0, -42], rotation: 0 },
    { id: 'outdoor-reviewed', position: [36.75, 0, .5], rotation: 0 },
  ];
  const key = 'dryer-facility-layout-v1';
  const saved = new Map([[key, JSON.stringify({ version: 1, catalogRevision: 'outdoor-campus-full-length-20261110', items: storedItems })]]);
  const priorWindow = globalThis.window;
  let state = [], writes = 0, editor;
  globalThis.window = { localStorage: { getItem: (name) => saved.get(name), setItem(name, value) { writes++; saved.set(name, value); } } };
  const doc = { createElement(tag) { return new EditorNode(tag, this); } }; doc.body = new EditorNode('body', doc);
  const scene = { getLayout: () => structuredClone(state), setLayout(layout) { state = structuredClone(layout); return true; }, setPlacementMode() {}, setView() {} };
  try {
    const container = new EditorNode('div', doc);
    editor = createLayoutEditor({ scene, equipment: catalog, container });
    assert.deepEqual(state[0].position, catalog[0].position, 'matching X/Z migrates even after the old Y was normalized');
    assert.ok(Math.abs(state[0].rotation - Math.PI / 2) < 1e-12);
    assert.deepEqual(state[1].position, [-5.75, 26.2, -3], 'a custom move retains X/Z while adopting the floor datum');
    assert.equal(state[1].rotation, 0);
    assert.deepEqual(state[2].position, [-6, 26.2, -3], 'a custom turn protects the entire horizontal pose');
    assert.ok(Math.abs(state[2].rotation - Math.PI / 12) < 1e-12);
    assert.deepEqual(state[3].position, catalog[3].position, 'new roof items receive their catalog defaults');
    for (const index of [4, 5]) {
      assert.deepEqual(state[index].position, storedItems[index - 1].position, 'a later dryer update cannot repeat reviewed area migrations');
      assert.equal(state[index].rotation, 0);
    }
    assert.equal(writes, 1);
    assert.equal(JSON.parse(saved.get(key)).catalogRevision, 'preparation-tank-openings-20261112');
    editor.dispose();
    editor = createLayoutEditor({ scene, equipment: catalog, container: new EditorNode('div', doc) });
    assert.equal(writes, 1, 'reloading the new datum is stable');
    editor.dispose();
    const imported = validateLayout({ version: 1, items: storedItems }, catalog);
    assert.deepEqual(imported[0].position, [-6, 26.2, -3], 'explicit import preserves the chosen X/Z and still uses catalog Y');
    assert.equal(imported[0].rotation, 0);
    saved.set(key, JSON.stringify({ version: 1, catalogRevision: 'preparation-tank-openings-20261112', items: imported }));
    editor = createLayoutEditor({ scene, equipment: catalog, container: new EditorNode('div', doc) });
    assert.deepEqual(state[0].position, imported[0].position, 'an explicitly imported old pose stays intentional after reopening');
    assert.equal(state[0].rotation, 0);
    assert.equal(writes, 1);
  } finally { editor?.dispose(); globalThis.window = priorWindow; }
});

test('a complete legacy building layout drops only superseded lower pieces and restores all current upper groups', () => {
  const oldElevations = new Map([[1, 0], [3, 7.5], [4, 15], [5, 22.5], [6, 30]]);
  const items = [
    ...LOWER_EQUIPMENT.map(item => ({ id: item.id, position: [item.position[0], oldElevations.get(item.floor), item.position[2]], rotation: item.rotation })),
    ...PHOTO_EQUIPMENT.map(item => ({ id: item.id, position: [item.position[0], 37.5, item.position[2]], rotation: item.rotation })),
  ];
  assert.equal(items.length, 35);
  const restored = validateLayout({ version: 1, items }, BUILDING_EQUIPMENT, { migrateDefaults: true });
  assert.equal(restored.length, BUILDING_EQUIPMENT.length);
  assert.deepEqual(restored.map(item => item.id), BUILDING_EQUIPMENT.map(item => item.id));
  for (const id of ['f5-dryer-cone', 'f5-powder-recovery', ...PHOTO_EQUIPMENT.map(item => item.id)]) {
    const actual = restored.find(item => item.id === id), expected = BUILDING_EQUIPMENT.find(item => item.id === id);
    assert.deepEqual(actual.position, expected.position, `untouched historical pose must follow the upper-floor registration: ${id}`);
  }
  for (const item of restored) assert.equal(item.position[1], BUILDING_EQUIPMENT.find(entry => entry.id === item.id).position[1]);
  const imported = validateLayout({ version: 1, items }, BUILDING_EQUIPMENT);
  assert.deepEqual(imported.find(item => item.id === 'chamber').position, [-6, 26.2, -3], 'an explicit old import keeps its chosen horizontal pose');
  assert.throws(() => validateLayout({ version: 1, items: [...items, { id: 'unrecognized-dryer', position: [0, 0, 0], rotation: 0 }] }, BUILDING_EQUIPMENT));
});

test('packaging redesign restores legacy layouts without retired groups, preserves user edits and moves the owning level', () => {
  const catalog = [
    { id: 'cip-sink', name: 'CIP 싱크', floor: 'packaging', floorLevel: 3, position: [-9.5, 0, -14], previousPosition: [-14, 0, 4], rotation: 0 },
    { id: 'floor-two', name: '2층 설비', floor: 'packaging', floorLevel: 2, position: [8, 0, -6], previousPosition: [7, 0, -6], rotation: 0 },
    { id: 'reviewed-outdoor', name: '옥외 설비', floor: 'outdoor', position: [-10, 0, 3], rotation: Math.PI / 2, previousRotation: 0 },
  ];
  const payload = { version: 1, catalogRevision: 'stick-packaging-3f-20261109', items: [
    { id: 'cip-sink', position: [-14, 0, 4], rotation: 0 },
    { id: 'floor-two', position: [7.25, 0, -6], rotation: .25 },
    { id: 'reviewed-outdoor', position: [-10, 0, 3], rotation: 0 },
    { id: 'packaging-air-unit', position: [-14, 0, 9], rotation: 0 },
    { id: 'packaging-cip-area', position: [-10, 0, -14], rotation: 0 },
    { id: 'packaging-mixer-sieve-4', position: [-8, 0, 5.5], rotation: 0 },
  ] };
  const imported = validateLayout(payload, catalog);
  assert.equal(imported.length, catalog.length);
  assert.deepEqual(imported[0].position, payload.items[0].position, 'explicit import keeps a chosen old horizontal position');
  assert.throws(() => validateLayout({ ...payload, items: [...payload.items, { id: 'unrecognized-packaging', position: [0, 0, 0], rotation: 0 }] }, catalog));
  const key = 'dryer-facility-layout-v1', saved = new Map([[key, JSON.stringify(payload)]]), calls = [];
  const priorWindow = globalThis.window;
  globalThis.window = { localStorage: { getItem: (id) => saved.get(id), setItem: (id, value) => saved.set(id, value) } };
  const doc = { createElement(tag) { return new EditorNode(tag, this); } };
  doc.body = new EditorNode('body', doc);
  let state = [], editor;
  const scene = {
    getLayout: () => structuredClone(state), setLayout(layout) { state = structuredClone(layout); return true; },
    setFloor: (floor) => calls.push(['floor', floor]), setPackagingLevel: (level) => calls.push(['level', level]),
    setPlacementMode() {}, setView() {}, select() {}, setIsolation() {}, setExplosion() {}, focusPlacement() {},
  };
  try {
    editor = createLayoutEditor({ scene, equipment: catalog, container: new EditorNode('div', doc) });
    assert.deepEqual(state[0].position, catalog[0].position, 'an untouched old default follows the revised room');
    assert.deepEqual(state[1].position, payload.items[1].position, 'a user-moved packaging device retains its position');
    assert.ok(Math.abs(state[1].rotation - .25) < 1e-12);
    assert.equal(state[2].rotation, 0, 'the preceding packaging revision already reviewed outdoor facing');
    assert.equal(JSON.parse(saved.get(key)).catalogRevision, 'preparation-tank-openings-20261112');
    assert.equal(JSON.parse(saved.get(key)).items.length, 3, 'known retired markers are omitted from the next save');
    editor.startMoving('floor-two');
    assert.deepEqual(calls, [['floor', 'packaging'], ['level', 2]], 'movement opens the equipment owning floor before editing');
    editor.dispose();
    saved.set(key, JSON.stringify({ ...payload, catalogRevision: 'stick-packaging-floors-20261110' }));
    editor = createLayoutEditor({ scene, equipment: catalog, container: new EditorNode('div', doc) });
    assert.equal(state[2].rotation, 0, 'the preceding three-floor release also preserves its already-reviewed outdoor facing');
  } finally { editor?.dispose(); globalThis.window = priorWindow; }
});

test('the editor edits room coordinates and saves the constrained result with one-step undo', () => {
  const document = { createElement(tag) { return new EditorNode(tag, this); } };
  document.body = new EditorNode('body', document);
  const container = new EditorNode('div', document), saved = new Map();
  const originalWindow = globalThis.window;
  globalThis.window = { localStorage: { getItem: (key) => saved.get(key), setItem: (key, value) => saved.set(key, value) } };
  const catalog = [{ id: 'tower', name: '냉각탑', floor: 7, position: [10, 37.5, 20], rotation: .4 }];
  let state = structuredClone(catalog.map(({ id, position, rotation }) => ({ id, position, rotation })));
  const requests = [];
  const scene = {
    getLayout: () => structuredClone(state), setPlacementMode() {}, setView() {},
    getPlacementInfo() {
      const current = state[0];
      return { position: [current.position[0] - 10, 37.5, current.position[2] - 20],
        rotationDegrees: (current.rotation - .4) * 180 / Math.PI, step: .25, angleDegrees: 15,
        regionLabel: '7층 설비 영역', message: '정해진 영역 안에 맞췄습니다.' };
    },
    setPlacementCoordinates(id, values) {
      requests.push({ ...values });
      const snap = (value) => Math.max(-2, Math.min(2, Math.round(value * 4) / 4));
      state[0] = { id, position: [10 + snap(values.x), 37.5, 20 + snap(values.z)],
        rotation: .4 + Math.round(values.rotationDegrees / 15) * 15 * Math.PI / 180 };
      return true;
    },
    setLayout(layout) { state = structuredClone(layout); return true; },
  };
  let editor;
  try {
    editor = createLayoutEditor({ scene, equipment: catalog, container });
    const nodes = [];
    const walk = (node) => { nodes.push(node); node.children.forEach(walk); }; walk(container);
    const find = (predicate) => { const node = nodes.find(predicate); assert.ok(node); return node; };
    const toggle = find((node) => node.textContent === '배치 편집');
    editor.select('tower');
    const x = find((node) => node.dataset.layoutField === 'x');
    const z = find((node) => node.dataset.layoutField === 'z');
    const rotation = find((node) => node.dataset.layoutField === 'rotation');
    assert.equal(x.disabled, true, 'selection does not enable movement outside edit mode');
    toggle.click();
    assert.equal(x.value, '0', 'the numeric field uses room axes rather than world position 10');
    assert.equal(x.step, '0.25');
    x.value = '8.12'; z.value = '0'; rotation.value = '31';
    x.listeners.get('change')();
    assert.equal(requests[0].x, 8.12, 'the scene receives the requested room coordinate');
    assert.equal(x.value, '2', 'the UI reflects the scene-clamped coordinate');
    assert.equal(rotation.value, '30', 'the UI reflects the snapped angle');
    const snapshot = JSON.parse(saved.get('dryer-facility-layout-v1')).items[0];
    assert.deepEqual(snapshot.position, [12, 37.5, 20], 'storage contains actual world placement, not requested 8.12');
    assert.ok(Math.abs(snapshot.rotation - (.4 + Math.PI / 6)) < 1e-12);
    find((node) => node.dataset.layoutAxis === 'z' && node.dataset.layoutDirection === '1').click();
    assert.equal(z.value, '0.25');
    find((node) => node.textContent === '되돌리기').click();
    assert.equal(z.value, '0', 'one nudge is one undo action');
    assert.equal(x.value, '2', 'undo retains the preceding constrained coordinate');
  } finally { editor?.dispose(); globalThis.window = originalWindow; }
});

test('moving a selected unit opens top-view editing, saves a drag and restores it without changing other equipment', () => {
  const doc = { createElement(tag) { return new EditorNode(tag, this); } };
  doc.body = new EditorNode('body', doc);
  const catalog = [
    { id: 'unit', name: '끝 실외기', floor: 'outdoor', position: [45, 0, -25], rotation: .5 },
    { id: 'tank', name: '물탱크', floor: 'outdoor', position: [70, 0, -42], rotation: .5 },
  ];
  const defaults = catalog.map(({ id, position, rotation }) => ({ id, position: [...position], rotation }));
  let state = structuredClone(defaults);
  const calls = [], saved = new Map();
  const originalWindow = globalThis.window;
  globalThis.window = { localStorage: { getItem: (key) => saved.get(key), setItem: (key, value) => saved.set(key, value) } };
  const scene = {
    getLayout: () => structuredClone(state), setLayout(layout) { state = structuredClone(layout); return true; },
    setFloor: (floor) => calls.push(['floor', floor]), setView: (view) => calls.push(['view', view]),
    setPlacementMode: (enabled) => calls.push(['placement', enabled]), select: (id) => calls.push(['select', id]),
    setIsolation: (value) => calls.push(['isolation', value]), setExplosion: (value) => calls.push(['explosion', value]),
    focusPlacement: (id) => calls.push(['focusPlacement', id]), setLabels() { assert.fail('moving equipment must not turn its name labels on'); },
  };
  let editor;
  try {
    const container = new EditorNode('div', doc);
    editor = createLayoutEditor({ scene, equipment: catalog, container });
    editor.select('unit');
    assert.equal(editor.startMoving('missing'), false);
    assert.equal(editor.startMoving('unit'), true);
    assert.deepEqual(calls, [['floor', 'outdoor'], ['isolation', false], ['explosion', 0], ['placement', true], ['view', 'top'], ['select', 'unit'], ['focusPlacement', 'unit']]);
    const nodes = [];
    const walk = (node) => { nodes.push(node); node.children.forEach(walk); }; walk(container);
    assert.equal(nodes.find((node) => node.className === 'layout-editor-body').hidden, false);
    assert.equal(nodes.find((node) => node.dataset.layoutField === 'x').disabled, false);
    assert.match(nodes.find((node) => node.className === 'layout-edit-help').textContent, /격자.*이동 칸 수.*방향키/);
    assert.deepEqual(state, defaults, 'entering move mode must not reset or relocate equipment');
    editor.handleTransform({ id: 'unit', phase: 'start' });
    state[0].position = [46.25, 0, -24.5];
    editor.handleTransform({ id: 'unit', phase: 'move' });
    editor.handleTransform({ id: 'unit', phase: 'end' });
    const dragged = structuredClone(state);
    assert.deepEqual(JSON.parse(saved.get('dryer-facility-layout-v1')).items, dragged);
    assert.deepEqual(dragged[1], defaults[1], 'moving one unit must keep the neighboring tank in place');
    editor.dispose(); state = structuredClone(defaults);
    editor = createLayoutEditor({ scene, equipment: catalog, container: new EditorNode('div', doc) });
    assert.deepEqual(state, dragged, 'reopening the editor must restore the dragged coordinates');
  } finally { editor?.dispose(); globalThis.window = originalWindow; }
});

test('automatic restoration updates old default directions once while preserving moved positions, custom rotations and explicit imports', async () => {
  const previousRotation = 35 * Math.PI / 180, rotation = previousRotation - Math.PI / 2;
  const catalog = [
    { id: 'unit-default', name: '유니트 2', floor: 'outdoor', position: [-10, 0, 3], rotation, previousRotation },
    { id: 'unit-custom', name: '유니트 1', floor: 'outdoor', position: [-7, 0, 3], rotation, previousRotation },
  ];
  const storedItems = [
    { id: 'unit-default', position: [-12, 0, 2.5], rotation: previousRotation + Math.PI * 2 },
    { id: 'unit-custom', position: [-8, 0, 4.25], rotation: previousRotation + Math.PI / 12 },
  ];
  const key = 'dryer-facility-layout-v1';
  const saved = new Map([[key, JSON.stringify({ version: 1, items: storedItems })]]);
  let writes = 0, state = [];
  const originalWindow = globalThis.window;
  globalThis.window = { localStorage: {
    getItem: (name) => saved.get(name), setItem(name, value) { writes++; saved.set(name, value); },
  } };
  const document = { createElement(tag) { return new EditorNode(tag, this); } };
  document.body = new EditorNode('body', document);
  const scene = {
    getLayout: () => structuredClone(state),
    setLayout(layout) { state = structuredClone(layout); return true; },
    setPlacementMode() {}, setView() {},
  };
  let editor;
  try {
    editor = createLayoutEditor({ scene, equipment: catalog, container: new EditorNode('div', document) });
    assert.ok(Math.abs(state[0].rotation - rotation) < 1e-12, 'a normalized previous default adopts the new facing');
    assert.ok(Math.abs(state[1].rotation - storedItems[1].rotation) < 1e-12, 'a custom rotation remains unchanged');
    assert.deepEqual(state.map((item) => item.position), storedItems.map((item) => item.position), 'migration keeps saved horizontal positions');
    assert.equal(writes, 1, 'the migrated layout is saved immediately');
    assert.deepEqual(JSON.parse(saved.get(key)).items, state);
    assert.equal(JSON.parse(saved.get(key)).catalogRevision, 'preparation-tank-openings-20261112');
    editor.dispose();

    const container = new EditorNode('div', document);
    editor = createLayoutEditor({ scene, equipment: catalog, container });
    assert.equal(writes, 1, 'the updated stored layout is not migrated again');
    assert.ok(Math.abs(state[0].rotation - rotation) < 1e-12);

    const nodes = [];
    const walk = (node) => { nodes.push(node); node.children.forEach(walk); }; walk(container);
    nodes.find((node) => node.textContent === '배치 편집').click();
    const file = nodes.find((node) => node.type === 'file');
    file.files = [{ size: 200, text: async () => JSON.stringify({ version: 1, items: storedItems }) }];
    await file.listeners.get('change')();
    assert.ok(Math.abs(state[0].rotation - previousRotation) < 1e-12, 'an explicitly imported old direction is honored exactly');
    assert.ok(Math.abs(state[1].rotation - storedItems[1].rotation) < 1e-12);
    assert.deepEqual(state.map((item) => item.position), storedItems.map((item) => item.position));
    assert.equal(writes, 2);
    editor.dispose();

    editor = createLayoutEditor({ scene, equipment: catalog, container: new EditorNode('div', document) });
    assert.ok(Math.abs(state[0].rotation - previousRotation) < 1e-12, 'reloading an imported old angle does not migrate it again');
    assert.equal(writes, 2, 'the current catalog marker avoids another persistence write');
    editor.dispose();

    const customItems = storedItems.map((item) => ({ ...item, rotation: previousRotation + Math.PI / 12 }));
    saved.set(key, JSON.stringify({ version: 1, items: customItems }));
    editor = createLayoutEditor({ scene, equipment: catalog, container: new EditorNode('div', document) });
    assert.ok(state.every((item) => Math.abs(item.rotation - customItems[0].rotation) < 1e-12));
    assert.equal(writes, 3, 'an old layout with only custom angles is still marked as migrated');
    assert.equal(JSON.parse(saved.get(key)).catalogRevision, 'preparation-tank-openings-20261112');
    editor.dispose();
    editor = createLayoutEditor({ scene, equipment: catalog, container: new EditorNode('div', document) });
    assert.equal(writes, 3, 'a custom-only layout is marked only once');
  } finally { editor?.dispose(); globalThis.window = originalWindow; }
});

test('a revised campus placement replaces only untouched defaults once and keeps custom edits, reviewed outdoor facing and explicit imports', async () => {
  const previousRotation = 0, rotation = Math.PI / 2;
  const catalog = [
    { id: 'unchanged', name: '기본 건물', floor: 'campus', previousPosition: [-45, 0, 15], position: [125, 0, 50], previousRotation, rotation },
    { id: 'moved', name: '이동한 건물', floor: 'campus', previousPosition: [20, 0, -18], position: [-120, 0, 38], previousRotation, rotation },
    { id: 'turned', name: '회전한 건물', floor: 'campus', previousPosition: [25, 0, 18], position: [80, 0, -115], previousRotation, rotation },
    { id: 'custom', name: '개별 편집 건물', floor: 'campus', previousPosition: [30, 0, -52], position: [-95, 0, -125], previousRotation, rotation },
    { id: 'outdoor-reviewed', name: '이미 방향 검토한 설비', floor: 'outdoor', position: [-10, 0, 3], previousRotation, rotation },
  ];
  const storedItems = [
    { id: 'unchanged', position: [-45, 0, 15], rotation: Math.PI * 2 },
    { id: 'moved', position: [25.25, 0, -18], rotation: 0 },
    { id: 'turned', position: [25, 0, 18], rotation: Math.PI / 12 },
    { id: 'custom', position: [30, 0, -51.75], rotation: Math.PI / 12 },
    { id: 'outdoor-reviewed', position: [-10, 0, 3], rotation: 0 },
  ];
  const expected = validateLayout({ version: 1, items: storedItems }, catalog, { migrateDefaults: true, migrateOutdoorDefaults: false });
  assert.deepEqual(expected.map((item) => item.position), [catalog[0].position, storedItems[1].position, catalog[2].position, storedItems[3].position, storedItems[4].position]);
  expected.forEach((item, index) => assert.ok(Math.abs(item.rotation - (index < 2 ? rotation : index < 4 ? Math.PI / 12 : 0)) < 1e-12));
  assert.deepEqual(validateLayout({ version: 1, items: storedItems }, catalog).map((item) => item.position), storedItems.map((item) => item.position), 'a direct import keeps every chosen horizontal position');

  const key = 'dryer-facility-layout-v1';
  const saved = new Map([[key, JSON.stringify({ version: 1, catalogRevision: 'outdoor-video-20261102', items: storedItems })]]);
  const originalWindow = globalThis.window;
  let writes = 0, state = [];
  globalThis.window = { localStorage: {
    getItem: (name) => saved.get(name), setItem(name, value) { writes++; saved.set(name, value); },
  } };
  const document = { createElement(tag) { return new EditorNode(tag, this); } };
  document.body = new EditorNode('body', document);
  const scene = {
    getLayout: () => structuredClone(state),
    setLayout(layout) { state = structuredClone(layout); return true; },
    setPlacementMode() {}, setView() {},
  };
  let editor;
  try {
    editor = createLayoutEditor({ scene, equipment: catalog, container: new EditorNode('div', document) });
    assert.deepEqual(state, expected, 'automatic restoration applies the corrected campus arrangement');
    assert.equal(writes, 1);
    assert.equal(JSON.parse(saved.get(key)).catalogRevision, 'preparation-tank-openings-20261112');
    editor.dispose();
    const container = new EditorNode('div', document);
    editor = createLayoutEditor({ scene, equipment: catalog, container });
    assert.deepEqual(state, expected);
    assert.equal(writes, 1, 'a current revision is not migrated or saved again');

    const nodes = [];
    const walk = (node) => { nodes.push(node); node.children.forEach(walk); }; walk(container);
    nodes.find((node) => node.textContent === '배치 편집').click();
    const file = nodes.find((node) => node.type === 'file');
    file.files = [{ size: 400, text: async () => JSON.stringify({ version: 1, items: storedItems }) }];
    await file.listeners.get('change')();
    assert.deepEqual(state.map((item) => item.position), storedItems.map((item) => item.position));
    assert.ok(Math.abs(state[0].rotation) < 1e-12, 'a manually imported previous facing remains intentional');
    assert.equal(writes, 2);
    editor.dispose();
    editor = createLayoutEditor({ scene, equipment: catalog, container: new EditorNode('div', document) });
    assert.deepEqual(state.map((item) => item.position), storedItems.map((item) => item.position), 'reopening a manual import does not reapply automatic migration');
    assert.equal(writes, 2);
  } finally { editor?.dispose(); globalThis.window = originalWindow; }
});

test('the larger campus accepts and reloads its outer buildings while indoor and outdoor imports keep their existing coordinate limits', () => {
  const campus = [{ id: 'campus', floor: 'campus', position: [125, 0, -150], rotation: 0 }];
  const catalog = [...campus, ...equipment];
  const layout = { version: 1, items: [
    { id: 'campus', position: [249.75, 999, -250], rotation: 0 },
    { id: 'dryer', position: [100, -999, -100], rotation: .5 },
  ] };
  const restored = validateLayout(layout, catalog);
  assert.deepEqual(restored[0].position, [249.75, 0, -250]);
  assert.deepEqual(restored[1].position, [100, 37.5, -100]);
  assert.deepEqual(validateLayout({ version: 1, items: restored }, catalog), restored, 'a persisted large-campus layout can be reopened');
  for (const position of [[250.01, 0, 0], [0, 0, -250.01], [NaN, 0, 0]]) {
    assert.throws(() => validateLayout([{ id: 'campus', position, rotation: 0 }], catalog));
  }
  for (const id of ['dryer', 'outdoor']) {
    assert.throws(() => validateLayout([{ id, position: [100.01, 0, 0], rotation: 0 }], catalog));
  }
});

test('removing the three surrounding buildings filters only their old records and preserves every remaining custom placement', () => {
  const catalog = [
    { id: 'campus-production', floor: 'campus', position: [27, 0, 6], previousPosition: [25, 0, 18], rotation: 0, previousRotation: 0 },
    { id: 'outdoor-live', floor: 'outdoor', position: [-10, 0, 3], rotation: Math.PI / 2, previousRotation: 0 },
  ];
  const live = [
    { id: 'campus-production', position: [30.25, 0, 8.5], rotation: Math.PI / 12 },
    { id: 'outdoor-live', position: [-11, 0, 4.25], rotation: 0 },
  ];
  const retired = ['campus-rear-warehouse', 'campus-front-warehouse', 'campus-front-office'].map((id) => ({ id, position: [0, 0, 0], rotation: 0 }));
  const payload = { version: 1, catalogRevision: 'stick-packaging-3f-20261109', items: [...live, ...retired] };
  const expected = validateLayout(payload, catalog);
  assert.deepEqual(expected.map((item) => item.position), live.map((item) => item.position), 'an old exported layout retains all live edits while dropping the retired buildings');
  assert.deepEqual(expected.map((item) => item.id), live.map((item) => item.id));
  assert.throws(() => validateLayout({ ...payload, items: [...payload.items, { id: 'unrecognized', position: [0, 0, 0], rotation: 0 }] }, catalog));
  assert.throws(() => validateLayout({ ...payload, items: [...payload.items, live[0]] }, catalog), 'live duplicate IDs remain ambiguous');

  const key = 'dryer-facility-layout-v1';
  const saved = new Map([[key, JSON.stringify(payload)]]);
  const originalWindow = globalThis.window;
  let writes = 0, state = [];
  globalThis.window = { localStorage: {
    getItem: (name) => saved.get(name), setItem(name, value) { writes++; saved.set(name, value); },
  } };
  const document = { createElement(tag) { return new EditorNode(tag, this); } };
  document.body = new EditorNode('body', document);
  const scene = {
    getLayout: () => structuredClone(state), setLayout(layout) { state = structuredClone(layout); return true; },
    setPlacementMode() {}, setView() {},
  };
  let editor;
  try {
    editor = createLayoutEditor({ scene, equipment: catalog, container: new EditorNode('div', document) });
    assert.deepEqual(state, expected);
    assert.ok(Math.abs(state[1].rotation) < 1e-12, 'removing buildings does not rerun a previous direction correction on an intentional outdoor facing');
    assert.deepEqual(JSON.parse(saved.get(key)).items, state, 'retired records are removed from storage even when the catalog revision already matches');
    assert.equal(writes, 1);
    editor.dispose();
    editor = createLayoutEditor({ scene, equipment: catalog, container: new EditorNode('div', document) });
    assert.deepEqual(state, expected);
    assert.equal(writes, 1, 'the cleaned saved layout is stable on the next launch');
  } finally { editor?.dispose(); globalThis.window = originalWindow; }
});

test('packaging integration updates both historical liquid-building defaults while preserving custom placement and already-reviewed outdoor facing', () => {
  const history = { floor: 'campus', position: [-47, 0, -42], rotation: 0, previousPosition: [-40, 0, -42], previousPositions: [[-43, 0, -24]] };
  const catalog = [
    { id: 'oldest-liquid', ...history }, { id: 'recent-liquid', ...history }, { id: 'custom-liquid', ...history },
    { id: 'outdoor-reviewed', floor: 'outdoor', position: [-10, 0, 3], rotation: Math.PI / 2, previousRotation: 0 },
  ];
  const stored = [
    { id: 'oldest-liquid', position: [-43, 0, -24], rotation: 0 },
    { id: 'recent-liquid', position: [-40, 0, -42], rotation: 0 },
    { id: 'custom-liquid', position: [-43.25, 0, -24], rotation: .25 },
    { id: 'outdoor-reviewed', position: [-10, 0, 3], rotation: 0 },
  ];
  const payload = { version: 1, catalogRevision: 'yusan-campus-20261109', items: stored };
  assert.deepEqual(validateLayout(payload, catalog).map((item) => item.position), stored.map((item) => item.position), 'manual imports keep historical coordinates intentional');
  const key = 'dryer-facility-layout-v1', saved = new Map([[key, JSON.stringify(payload)]]);
  const originalWindow = globalThis.window;
  let state = [], writes = 0;
  globalThis.window = { localStorage: {
    getItem: (name) => saved.get(name), setItem(name, value) { writes++; saved.set(name, value); },
  } };
  const document = { createElement(tag) { return new EditorNode(tag, this); } };
  document.body = new EditorNode('body', document);
  const scene = { getLayout: () => structuredClone(state), setLayout(layout) { state = structuredClone(layout); return true; }, setPlacementMode() {}, setView() {} };
  let editor;
  try {
    editor = createLayoutEditor({ scene, equipment: catalog, container: new EditorNode('div', document) });
    assert.deepEqual(state.map((item) => item.position), [[-47, 0, -42], [-47, 0, -42], stored[2].position, stored[3].position]);
    assert.ok(Math.abs(state[2].rotation - .25) < 1e-12);
    assert.ok(Math.abs(state[3].rotation) < 1e-12, 'the preceding campus release already reviewed the outdoor facing');
    assert.equal(JSON.parse(saved.get(key)).catalogRevision, 'preparation-tank-openings-20261112');
    assert.equal(writes, 1);
    editor.dispose();
    editor = createLayoutEditor({ scene, equipment: catalog, container: new EditorNode('div', document) });
    assert.equal(writes, 1, 'the historical defaults are migrated only once');
  } finally { editor?.dispose(); globalThis.window = originalWindow; }
});


test('the full-envelope revision migrates only untouched dryer defaults and retains reviewed outdoor/campus poses and explicit imports', async () => {
  const oldPose = { position: [-9, 0, -2.8], rotation: 0 };
  const catalog = ['untouched', 'moved', 'turned'].map((id) => ({
    id, name: id, floor: 1, position: [1.5, .3, 2], rotation: Math.PI / 2, previousPlacements: [oldPose],
  }));
  catalog.push({ id: 'reviewed-outdoor', name: 'outdoor', floor: 'outdoor', position: [35, 0, -1.25], rotation: Math.PI / 2,
    previousPlacements: [{ position: [36.75, 0, .5], rotation: 0 }], previousRotation: 0 });
  catalog.push({ id: 'reviewed-campus', name: 'campus', floor: 'campus', position: [-38.4, 0, -29.85], rotation: 0,
    previousPlacements: [{ position: [-47, 0, -42], rotation: 0 }] });
  const storedItems = [
    { id: 'untouched', ...structuredClone(oldPose) },
    { id: 'moved', position: [-8.75, 0, -2.8], rotation: 0 },
    { id: 'turned', position: [-9, 0, -2.8], rotation: Math.PI / 12 },
    { id: 'reviewed-outdoor', position: [36.75, 0, .5], rotation: 0 },
    { id: 'reviewed-campus', position: [-47, 0, -42], rotation: 0 },
  ];
  const key = 'dryer-facility-layout-v1';
  const saved = new Map([[key, JSON.stringify({ version: 1, catalogRevision: 'dryer-upper-roof-20261110', items: storedItems })]]);
  const priorWindow = globalThis.window;
  let state = [], writes = 0, editor;
  globalThis.window = { localStorage: { getItem: (name) => saved.get(name), setItem(name, value) { writes++; saved.set(name, value); } } };
  const doc = { createElement(tag) { return new EditorNode(tag, this); } }; doc.body = new EditorNode('body', doc);
  const scene = { getLayout: () => structuredClone(state), setLayout(layout) { state = structuredClone(layout); return true; }, setPlacementMode() {}, setView() {} };
  try {
    editor = createLayoutEditor({ scene, equipment: catalog, container: new EditorNode('div', doc) });
    assert.deepEqual(state[0].position, catalog[0].position, 'the complete former dryer default adopts the new architectural placement');
    assert.ok(Math.abs(state[0].rotation - catalog[0].rotation) < 1e-12);
    assert.deepEqual(state[1].position, [-8.75, .3, -2.8], 'a moved dryer keeps X/Z while the architectural datum owns Y');
    assert.equal(state[1].rotation, 0);
    assert.deepEqual(state[2].position, [-9, .3, -2.8], 'a turned dryer keeps the entire horizontal pose');
    assert.ok(Math.abs(state[2].rotation - Math.PI / 12) < 1e-12);
    for (const index of [3, 4]) {
      assert.deepEqual(state[index].position, storedItems[index].position, 'the previous upper-dryer revision already reviewed outdoor/campus poses');
      assert.equal(state[index].rotation, storedItems[index].rotation);
    }
    assert.equal(JSON.parse(saved.get(key)).catalogRevision, 'preparation-tank-openings-20261112');
    assert.equal(writes, 1);
    editor.dispose();
    const container = new EditorNode('div', doc);
    editor = createLayoutEditor({ scene, equipment: catalog, container });
    assert.equal(writes, 1, 'a second load cannot repeat the migration');
    const nodes = [], walk = (node) => { nodes.push(node); node.children.forEach(walk); }; walk(container);
    nodes.find((node) => node.textContent === '배치 편집').click();
    const file = nodes.find((node) => node.type === 'file');
    file.files = [{ size: 500, text: async () => JSON.stringify({ version: 1, catalogRevision: 'dryer-upper-roof-20261110', items: storedItems }) }];
    await file.listeners.get('change')();
    assert.deepEqual(state[0].position, [-9, .3, -2.8], 'an explicit import of the old pose is intentional and keeps X/Z');
    assert.equal(state[0].rotation, 0);
    assert.equal(JSON.parse(saved.get(key)).catalogRevision, 'preparation-tank-openings-20261112');
    assert.equal(writes, 2);
    editor.dispose();
    editor = createLayoutEditor({ scene, equipment: catalog, container: new EditorNode('div', doc) });
    assert.deepEqual(state[0].position, [-9, .3, -2.8], 'the intentional imported pose survives reopening under the current revision');
    assert.equal(state[0].rotation, 0);
    assert.equal(writes, 2);
  } finally { editor?.dispose(); globalThis.window = priorWindow; }
});


test('the final release repairs the exact automatically saved intermediate defaults once without repeating reviewed outside-area migrations', async () => {
  // Captured from the real interrupted QA release, with no drag/turn/edit input.
  const fixture = JSON.parse(await readFile(new URL('./fixtures/dryer-full-envelope-intermediate-layout.json', import.meta.url), 'utf8'));
  assert.equal(fixture.catalogRevision, 'dryer-full-envelope-20261110');
  assert.equal(fixture.items.length, 25);
  const catalog = [...BUILDING_EQUIPMENT,
    { id: 'interim-reviewed-outdoor', floor: 'outdoor', name: 'outdoor', position: [35, 0, -1.25], rotation: Math.PI / 2,
      previousPlacements: [{ position: [36.75, 0, .5], rotation: 0 }], previousRotation: 0 },
    { id: 'interim-reviewed-campus', floor: 'campus', name: 'campus', position: [-38.4, 0, -29.85], rotation: 0,
      previousPlacements: [{ position: [-47, 0, -42], rotation: 0 }] },
  ];
  const outside = [{ id: 'interim-reviewed-outdoor', position: [36.75, 0, .5], rotation: 0 },
    { id: 'interim-reviewed-campus', position: [-47, 0, -42], rotation: 0 }];
  const key = 'dryer-facility-layout-v1', saved = new Map([[key, JSON.stringify({ version: 1, ...fixture, items: [...fixture.items, ...outside] })]]);
  const priorWindow = globalThis.window;
  let state = [], writes = 0, editor;
  globalThis.window = { localStorage: { getItem: name => saved.get(name), setItem(name, value) { writes++; saved.set(name, value); } } };
  const doc = { createElement(tag) { return new EditorNode(tag, this); } }; doc.body = new EditorNode('body', doc);
  // Scene restoration applies its room grid after catalog migration. This
  // isolates the migration while retaining the observed grid-save sequence.
  const scene = { getLayout: () => structuredClone(state), setLayout(layout) {
    state = structuredClone(layout).map(value => Number.isFinite(catalog.find(item => item.id === value.id).floor)
      ? { ...value, position: [Math.round(value.position[0] / .25) * .25, value.position[1], Math.round(value.position[2] / .25) * .25] } : value);
    return true;
  }, setPlacementMode() {}, setView() {} };
  try {
    editor = createLayoutEditor({ scene, equipment: catalog, container: new EditorNode('div', doc) });
    for (const old of fixture.items) {
      const actual = state.find(item => item.id === old.id), current = BUILDING_EQUIPMENT.find(item => item.id === old.id);
      assert.deepEqual(actual.position, [Math.round(current.position[0] / .25) * .25, current.position[1], Math.round(current.position[2] / .25) * .25], `${old.id} must restore the registered process zone instead of the interrupted old/clamped default`);
    }
    for (const record of outside) assert.deepEqual(state.find(item => item.id === record.id), record, 'the interrupted dryer revision must retain already-reviewed outdoor/campus poses');
    assert.equal(JSON.parse(saved.get(key)).catalogRevision, 'preparation-tank-openings-20261112');
    assert.equal(writes, 1);
    const first = structuredClone(state);
    editor.dispose(); editor = createLayoutEditor({ scene, equipment: catalog, container: new EditorNode('div', doc) });
    assert.deepEqual(state, first);
    assert.equal(writes, 1, 'the corrected final revision must be stable on the next load');
  } finally { editor?.dispose(); globalThis.window = priorWindow; }
});

test('intermediate default repair is revision-scoped and exact, preserving nearby moves, custom turns and explicit imports', async () => {
  const fixture = JSON.parse(await readFile(new URL('./fixtures/dryer-full-envelope-intermediate-layout.json', import.meta.url), 'utf8'));
  const ids = ['f1-ica-1', 'f1-mix-a', 'f1-s1'];
  for (const id of ids) {
    const captured = fixture.items.find(item => item.id === id), current = BUILDING_EQUIPMENT.find(item => item.id === id);
    const payload = { version: 1, catalogRevision: fixture.catalogRevision, items: [captured] };
    assert.deepEqual(validateLayout(payload, BUILDING_EQUIPMENT, { migrateDefaults: true }).find(item => item.id === id).position, current.position);
    // MIX-1 and S-1 now hang in the preparation deck. Their captured clamps lie
    // outside it, so any earlier-release variant returns to the opening; the
    // exact-snapshot rule still governs ordinary floor equipment such as ICA 1.
    const hanging = !!current.hangingDeck;
    const expected = pose => hanging ? current.position : [pose.position[0], current.position[1], pose.position[2]];
    for (const delta of [1e-10, .25]) {
      const moved = { ...captured, position: [captured.position[0] + delta, captured.position[1], captured.position[2]] };
      const actual = validateLayout({ ...payload, items: [moved] }, BUILDING_EQUIPMENT, { migrateDefaults: true }).find(item => item.id === id);
      assert.deepEqual(actual.position, expected(moved), hanging ? `${id}: an off-deck hanging tank returns to its opening` : `${id}: a nearby user move is not an automatic default`);
    }
    for (const delta of [1e-10, Math.PI / 12]) {
      const turned = { ...captured, rotation: captured.rotation + delta };
      const actual = validateLayout({ ...payload, items: [turned] }, BUILDING_EQUIPMENT, { migrateDefaults: true }).find(item => item.id === id);
      assert.deepEqual(actual.position, expected(captured), `${id}: a user turn protects the whole horizontal pose unless the tank has no deck there`);
      assert.ok(Math.abs(actual.rotation - (hanging ? current.rotation : turned.rotation)) < 1e-12);
    }
    const differentRelease = validateLayout({ ...payload, catalogRevision: 'dryer-upper-roof-20261110' }, BUILDING_EQUIPMENT, { migrateDefaults: true }).find(item => item.id === id);
    assert.deepEqual(differentRelease.position, expected(captured), 'the new exact snapshots cannot become a general migration rule for older releases');
    const imported = validateLayout(payload, BUILDING_EQUIPMENT).find(item => item.id === id);
    assert.deepEqual(imported.position, [captured.position[0], current.position[1], captured.position[2]], 'an explicit import remains intentional even if its source revision and pose match the interrupted release');
  }
});

test('campus spacing accepts only the exact qualified raw or automatic-grid pose and leaves edits and explicit imports intentional', () => {
  const item = CAMPUS_EQUIPMENT.find(entry => entry.id === 'campus-outdoor-area');
  const previous = item.previousPlacements.filter(pose => pose.catalogRevision === 'dryer-full-envelope-final-20261110');
  assert.deepEqual(previous.map(pose => pose.position), [[-61.4, 0, -17.5], [-61.5, 0, -17.5]]);
  for (const pose of previous) {
    const value = { id: item.id, position: [...pose.position], rotation: pose.rotation };
    const payload = { version: 1, catalogRevision: pose.catalogRevision, items: [value] };
    const options = { migrateDefaults: true, migrateCampusDefaults: false, migrateOutdoorDefaults: false, migrateOutdoorPositions: false };
    assert.deepEqual(validateLayout(payload, [item], options)[0].position, item.position, 'a specifically qualified campus correction can bypass the reviewed-area gate');
    for (const delta of [1e-10, .25]) {
      const moved = { ...value, position: [value.position[0] + delta, value.position[1], value.position[2]] };
      const kept = validateLayout({ ...payload, items: [moved] }, [item], options)[0];
      assert.deepEqual(kept.position, moved.position, 'any user move protects the complete horizontal pose');
      const turned = { ...value, rotation: value.rotation + delta };
      const keptTurn = validateLayout({ ...payload, items: [turned] }, [item], options)[0];
      assert.deepEqual(keptTurn.position, value.position, 'any user turn protects the saved position');
      assert.ok(Math.abs(keptTurn.rotation - turned.rotation) < 1e-12);
    }
    const changedZ = { ...value, position: [value.position[0], value.position[1], value.position[2] + .25] };
    assert.deepEqual(validateLayout({ ...payload, items: [changedZ] }, [item], options)[0].position, changedZ.position);
    for (const revision of ['dryer-upper-roof-20261110', 'dryer-full-envelope-20261110', 'liquid-card-detail-spacing-20261110', undefined]) {
      assert.deepEqual(validateLayout({ ...payload, catalogRevision: revision }, [item], options)[0].position, value.position, 'a qualified correction is specific to its source release');
    }
    assert.deepEqual(validateLayout(payload, [item])[0].position, value.position, 'an explicit import never applies automatic correction');
    assert.equal(validateLayout(payload, [item])[0].rotation, value.rotation);
  }
});

test('automatic campus spacing persists once, preserves reviewed neighboring areas and does not undo a later explicit import', async () => {
  const item = CAMPUS_EQUIPMENT.find(entry => entry.id === 'campus-outdoor-area');
  const catalog = [item,
    { id: 'reviewed-campus', name: '액상', floor: 'campus', position: [-38.4, 0, -29.85], rotation: 0, previousPlacements: [{ position: [-47, 0, -42], rotation: 0 }] },
    { id: 'reviewed-outdoor', name: '유니트', floor: 'outdoor', position: [35, 0, -1.25], rotation: Math.PI / 2, previousRotation: 0, previousPlacements: [{ position: [36.75, 0, .5], rotation: 0 }] },
    BUILDING_EQUIPMENT.find(entry => entry.id === 'chamber'),
    BUILDING_EQUIPMENT.find(entry => entry.id === 'f1-ica-1'),
  ];
  const key = 'dryer-facility-layout-v1', priorWindow = globalThis.window;
  try {
    for (const oldX of [-61.4, -61.5]) {
      const stored = [{ id: item.id, position: [oldX, 0, -17.5], rotation: -Math.PI / 2 },
        { id: 'reviewed-campus', position: [-47, 0, -42], rotation: 0 },
        { id: 'reviewed-outdoor', position: [36.75, 0, .5], rotation: 0 },
        { id: 'chamber', position: [-6, 26.2, -3], rotation: 0 },
        { id: 'f1-ica-1', position: [-9, .3, -2.8], rotation: 0 }];
      const saved = new Map([[key, JSON.stringify({ version: 1, catalogRevision: 'dryer-full-envelope-final-20261110',
        placementRevisions: { 'f1-ica-1': catalog.find(value => value.id === 'f1-ica-1').placementRevision }, items: stored })]]);
      let writes = 0, state = [], editor;
      globalThis.window = { localStorage: { getItem: name => saved.get(name), setItem(name, value) { writes++; saved.set(name, value); } } };
      const doc = { createElement(tag) { return new EditorNode(tag, this); } }; doc.body = new EditorNode('body', doc);
      const scene = { getLayout: () => structuredClone(state), setLayout(layout) {
        state = structuredClone(layout).map(value => value.id === item.id ? { ...value, position: [Math.round(value.position[0] * 4) / 4, 0, Math.round(value.position[2] * 4) / 4] } : value);
        return true;
      }, setPlacementMode() {}, setView() {} };
      try {
        let container = new EditorNode('div', doc);
        editor = createLayoutEditor({ scene, equipment: catalog, container });
        assert.deepEqual(state[0].position, [-64.5, 0, -17.5], 'the corrected catalog location passes through the real room grid');
        assert.deepEqual(state.slice(1), stored.slice(1), 'previous campus/outdoor corrections and an explicitly reviewed numeric pose cannot replay');
        assert.equal(JSON.parse(saved.get(key)).catalogRevision, 'preparation-tank-openings-20261112');
        assert.equal(writes, 1);
        editor.dispose(); container = new EditorNode('div', doc);
        editor = createLayoutEditor({ scene, equipment: catalog, container });
        assert.equal(writes, 1, 'reopening a corrected grid pose is stable');
        const nodes = []; const walk = node => { nodes.push(node); node.children.forEach(walk); }; walk(container);
        nodes.find(node => node.textContent === '배치 편집').click();
        const file = nodes.find(node => node.type === 'file');
        file.files = [{ size: 400, text: async () => JSON.stringify({ version: 1, catalogRevision: 'dryer-full-envelope-final-20261110', items: stored }) }];
        await file.listeners.get('change')();
        assert.deepEqual(state[0].position, [-61.5, 0, -17.5], 'an explicit old import retains its chosen pose after normal grid snapping');
        assert.equal(writes, 2);
        editor.dispose(); editor = createLayoutEditor({ scene, equipment: catalog, container: new EditorNode('div', doc) });
        assert.deepEqual(state[0].position, [-61.5, 0, -17.5], 'reopening a saved explicit import cannot apply the older correction again');
        assert.deepEqual(state.slice(1), stored.slice(1)); assert.equal(writes, 2);
      } finally { editor?.dispose(); }
    }
  } finally { globalThis.window = priorWindow; }
});

test('the 11/11 rear re-placement moves untouched saved campus poses once and keeps user-moved ones', () => {
  const moved = {
    'campus-guardhouse': { old: [71, 0, 53], rotation: 0 },
    'campus-lpg-bank': { old: [25, 0, -74.5], rotation: 0 },
    'campus-process-tank-bank': { old: [60, 0, -88.5], rotation: 0 },
    'campus-maintenance-office': { old: [72.3, 0, -88.5], rotation: 0 },
  };
  const catalog = CAMPUS_EQUIPMENT;
  const key = 'dryer-facility-layout-v1', priorWindow = globalThis.window;
  const savedItems = (overrides = {}) => catalog.filter((item) => !['campus-recycling-room', 'campus-tank-valve-room'].includes(item.id)).map((item) => {
    const pose = overrides[item.id] || moved[item.id];
    return { id: item.id, position: [...(pose?.old || item.position)], rotation: pose ? pose.rotation : item.rotation || 0 };
  });
  const open = (revision, items) => {
    const saved = new Map([[key, JSON.stringify({ version: 1, catalogRevision: revision, items })]]);
    let state = [];
    globalThis.window = { localStorage: { getItem: (name) => saved.get(name), setItem: (name, value) => saved.set(name, value) } };
    const doc = { createElement(tag) { return new EditorNode(tag, this); } }; doc.body = new EditorNode('body', doc);
    const scene = { getLayout: () => structuredClone(state), setLayout(layout) { state = structuredClone(layout); return true; }, setPlacementMode() {}, setView() {} };
    const editor = createLayoutEditor({ scene, equipment: catalog, container: new EditorNode('div', doc) });
    editor.dispose();
    return { state: new Map(state.map((value) => [value.id, value])), saved: JSON.parse(saved.get(key)) };
  };
  try {
    for (const revision of ['liquid-card-detail-spacing-20261110', 'dryer-full-envelope-final-20261110']) {
      const { state, saved } = open(revision, savedItems());
      assert.equal(saved.catalogRevision, 'preparation-tank-openings-20261112');
      for (const id of Object.keys(moved)) {
        const item = catalog.find((entry) => entry.id === id);
        // Rear items did not exist before the liquid release; only the guardhouse is in older saves.
        if (revision !== 'liquid-card-detail-spacing-20261110' && id !== 'campus-guardhouse') continue;
        assert.deepEqual(state.get(id).position, item.position, `${id} leaves its old default after ${revision}`);
        assert.ok(Math.abs(state.get(id).rotation - (item.rotation || 0)) < 1e-12, `${id} takes the corrected facing`);
      }
      assert.deepEqual(state.get('campus-recycling-room').position, catalog.find((item) => item.id === 'campus-recycling-room').position, 'the new recycling room starts at its catalog pose');
    }
    const custom = { 'campus-process-tank-bank': { old: [52.25, 0, -70], rotation: 0 } };
    const { state } = open('liquid-card-detail-spacing-20261110', savedItems(custom));
    assert.deepEqual(state.get('campus-process-tank-bank').position, [52.25, 0, -70], 'a tank bank the user had moved is not overwritten');
    assert.deepEqual(state.get('campus-lpg-bank').position, catalog.find((item) => item.id === 'campus-lpg-bank').position);
    // A save from the first 11/11 release still holds the long office beside
    // the tanks; the identity fix moves it once to the green-roof building.
    const office = catalog.find((item) => item.id === 'campus-maintenance-office');
    const firstRelease = catalog.filter((item) => item.id !== 'campus-tank-valve-room').map((item) => ({ id: item.id, position: item.id === office.id ? [76.8, 0, -79.2] : [...item.position], rotation: item.rotation || 0 }));
    const reopened = open('campus-rear-video-placement-20261111', firstRelease).state;
    assert.deepEqual(reopened.get(office.id).position, office.position, 'the 공무사무실 moves to the green-roof building');
    assert.deepEqual(reopened.get('campus-tank-valve-room').position, catalog.find((item) => item.id === 'campus-tank-valve-room').position, 'the tank valve room appears at its catalog pose');
    for (const id of ['campus-lpg-bank', 'campus-process-tank-bank', 'campus-recycling-room', 'campus-guardhouse']) assert.deepEqual(reopened.get(id).position, catalog.find((item) => item.id === id).position, `${id} keeps the first-release pose`);
    const movedOffice = firstRelease.map((value) => value.id === office.id ? { ...value, position: [80, 0, -70] } : value);
    assert.deepEqual(open('campus-rear-video-placement-20261111', movedOffice).state.get(office.id).position, office.position, 'the new explicit office-restoration request overrides an older saved office move');
  } finally { globalThis.window = priorWindow; }
});

test('the valve-room revision moves only untouched qualified poses once and preserves edits, reviewed areas and explicit imports', async () => {
  const valve = CAMPUS_EQUIPMENT.find(item => item.id === 'campus-tank-valve-room');
  const sourceRevision = 'campus-rear-identities-20261111';
  const previous = valve.previousPlacements.filter(pose => pose.catalogRevision === sourceRevision);
  assert.deepEqual(previous.map(pose => pose.position), [[56.6, 0, -79.7], [56.5, 0, -79.75]], 'accept both the prior raw default and its automatic-grid pose');
  const neighbors = [
    { id: 'reviewed-campus', floor: 'campus', position: [-38, 0, -30], rotation: 1, previousPlacements: [{ position: [-47, 0, -42], rotation: 0 }] },
    { id: 'reviewed-outdoor', floor: 'outdoor', position: [35, 0, -1.25], rotation: Math.PI / 2, previousRotation: 0, previousPlacements: [{ position: [36.75, 0, .5], rotation: 0 }] },
    { id: 'reviewed-dryer', floor: 6, position: [-1, 26.2, 7], rotation: Math.PI / 2, previousPlacements: [{ position: [-6, 26.2, -3], rotation: 0 }] },
  ];
  const catalog = [valve, ...neighbors];
  const retained = [
    { id: neighbors[0].id, position: [-47, 0, -42], rotation: 0 },
    { id: neighbors[1].id, position: [36.75, 0, .5], rotation: 0 },
    { id: neighbors[2].id, position: [-6, 26.2, -3], rotation: 0 },
  ];
  const key = 'dryer-facility-layout-v1', priorWindow = globalThis.window;
  try {
    for (const pose of previous) {
      const old = { id: valve.id, position: [...pose.position], rotation: pose.rotation };
      const stored = [old, ...structuredClone(retained)];
      const saved = new Map([[key, JSON.stringify({ version: 1, catalogRevision: sourceRevision, items: stored })]]);
      let state = [], writes = 0, editor;
      globalThis.window = { localStorage: { getItem: name => saved.get(name), setItem(name, value) { writes++; saved.set(name, value); } } };
      const doc = { createElement(tag) { return new EditorNode(tag, this); } }; doc.body = new EditorNode('body', doc);
      const scene = { getLayout: () => structuredClone(state), setLayout(layout) { state = structuredClone(layout); return true; }, setPlacementMode() {}, setView() {} };
      try {
        let container = new EditorNode('div', doc);
        editor = createLayoutEditor({ scene, equipment: catalog, container });
        assert.deepEqual(state[0].position, valve.position, 'the untouched blue room adopts the corrected location');
        assert.deepEqual(state.slice(1), retained, 'already-reviewed campus, outdoor and dryer corrections cannot replay');
        assert.equal(JSON.parse(saved.get(key)).catalogRevision, 'preparation-tank-openings-20261112');
        assert.equal(writes, 1);
        editor.dispose(); container = new EditorNode('div', doc);
        editor = createLayoutEditor({ scene, equipment: catalog, container });
        assert.equal(writes, 1, 'reopening the new revision does not migrate again');

        const nodes = [], walk = node => { nodes.push(node); node.children.forEach(walk); }; walk(container);
        nodes.find(node => node.textContent === '배치 편집').click();
        const file = nodes.find(node => node.type === 'file');
        file.files = [{ size: 400, text: async () => JSON.stringify({ version: 1, catalogRevision: sourceRevision, items: stored }) }];
        await file.listeners.get('change')();
        assert.deepEqual(state, stored, 'an explicit import of the prior default remains intentional');
        assert.equal(writes, 2);
        editor.dispose(); editor = createLayoutEditor({ scene, equipment: catalog, container: new EditorNode('div', doc) });
        assert.deepEqual(state, stored, 'the imported old pose remains intentional after reopening');
        assert.equal(writes, 2);
      } finally { editor?.dispose(); }

      const options = { migrateDefaults: true, migrateCampusDefaults: false, sourceCatalogRevision: sourceRevision };
      for (const edited of [
        { ...old, position: [old.position[0] + .25, 0, old.position[2]] },
        { ...old, position: [old.position[0] + 1e-10, 0, old.position[2]] },
        { ...old, position: [old.position[0], 0, old.position[2] + .25] },
        { ...old, rotation: .25 },
        { ...old, rotation: 1e-10 },
      ]) {
        const kept = validateLayout([edited], [valve], options)[0];
        assert.deepEqual(kept.position, edited.position, 'any user move or turn protects the whole saved pose');
        assert.ok(Math.abs(kept.rotation - edited.rotation) < 1e-12);
      }
      const otherRelease = validateLayout([old], [valve], { ...options, sourceCatalogRevision: 'campus-rear-video-placement-20261111' });
      assert.deepEqual(otherRelease[0].position, old.position, 'the exact old pose is qualified to its source release');
    }
  } finally { globalThis.window = priorWindow; }
});

test('the requested office restoration repairs old saves once while preserving neighboring layouts, explicit imports and subsequent edits', async () => {
  const office = CAMPUS_EQUIPMENT.find(item => item.id === 'campus-maintenance-office');
  assert.deepEqual(office.position, [42.5, 0, -82.75], 'the established LPG-side office remains the canonical location');
  const oldPositions = [[72.3, 0, -88.5], [72.25, 0, -88.5], [76.8, 0, -79.2], [76.75, 0, -79.25]];
  const sourceCases = [
    ['liquid-card-detail-spacing-20261110', oldPositions.slice(0, 2)],
    ['campus-rear-video-placement-20261111', oldPositions.slice(2)],
    ['campus-rear-identities-20261111', oldPositions],
    ['campus-valve-interior-20261111', oldPositions],
  ];
  for (const [revision, positions] of sourceCases) {
    assert.deepEqual(office.previousPlacements.filter(pose => pose.catalogRevision === revision).map(pose => pose.position), positions);
  }
  const neighbors = CAMPUS_EQUIPMENT.filter(item => item.id !== office.id);
  const catalog = [office, ...neighbors,
    { id: 'reviewed-outdoor', floor: 'outdoor', position: [35, 0, -1.25], rotation: Math.PI / 2, previousRotation: 0, previousPlacements: [{ position: [36.75, 0, .5], rotation: 0 }] },
    { id: 'reviewed-dryer', floor: 6, position: [-1, 26.2, 7], rotation: Math.PI / 2, previousPlacements: [{ position: [-6, 26.2, -3], rotation: 0 }] },
  ];
  const retained = validateLayout(neighbors.map(item => ({ id: item.id, position: [...item.position], rotation: item.rotation || 0 })), neighbors);
  retained.find(item => item.id === 'campus-process-tank-bank').position[0] += .25;
  retained.find(item => item.id === 'campus-tank-valve-room').position[2] += .25;
  retained.push({ id: 'reviewed-outdoor', position: [36.75, 0, .5], rotation: 0 }, { id: 'reviewed-dryer', position: [-6, 26.2, -3], rotation: 0 });
  const key = 'dryer-facility-layout-v1', currentRevision = 'preparation-tank-openings-20261112', priorWindow = globalThis.window;
  const restoreCases = sourceCases.flatMap(([revision, positions]) => [
    ...positions.map(position => ({ revision, position, rotation: 0 })),
    { revision, position: [73.5, 0, -81.25], rotation: Math.PI / 2 },
    { revision, position: [55, 0, -77], rotation: -.4 },
  ]);
  try {
    for (const { revision, position, rotation } of restoreCases) {
      const old = validateLayout([{ id: office.id, position: [...position], rotation }], [office])[0];
      const stored = [old, ...structuredClone(retained)];
      const saved = new Map([[key, JSON.stringify({ version: 1, catalogRevision: revision, items: stored })]]);
      let state = [], writes = 0, editor;
      globalThis.window = { localStorage: { getItem: name => saved.get(name), setItem(name, value) { writes++; saved.set(name, value); } } };
      const doc = { createElement(tag) { return new EditorNode(tag, this); } }; doc.body = new EditorNode('body', doc);
      const scene = { getLayout: () => structuredClone(state), setLayout(layout) { state = structuredClone(layout); return true; }, setPlacementMode() {}, setView() {} };
      try {
        let container = new EditorNode('div', doc);
        editor = createLayoutEditor({ scene, equipment: catalog, container });
        assert.deepEqual(state[0].position, office.position, `${revision}: the exact old office returns beside LPG`);
        assert.equal(state[0].rotation, office.rotation, 'an older saved office rotation is restored with its position');
        assert.deepEqual(state.slice(1), retained, 'the eight-tank bank, blue room and every other campus/outdoor/dryer pose are preserved');
        assert.equal(JSON.parse(saved.get(key)).catalogRevision, currentRevision);
        assert.equal(writes, 1);
        editor.dispose(); container = new EditorNode('div', doc);
        editor = createLayoutEditor({ scene, equipment: catalog, container });
        assert.equal(writes, 1, 'the repaired office is saved once');
        assert.deepEqual(state[0].position, office.position);

        const nodes = [], walk = node => { nodes.push(node); node.children.forEach(walk); }; walk(container);
        nodes.find(node => node.textContent === '배치 편집').click();
        const file = nodes.find(node => node.type === 'file');
        file.files = [{ size: 1000, text: async () => JSON.stringify({ version: 1, catalogRevision: revision, items: stored }) }];
        await file.listeners.get('change')();
        assert.deepEqual(state, stored, 'an explicit later import remains intentional');
        assert.equal(writes, 2);
        editor.dispose(); editor = createLayoutEditor({ scene, equipment: catalog, container: new EditorNode('div', doc) });
        assert.deepEqual(state, stored, 'reopening cannot undo an explicit import saved by this release');
        assert.equal(writes, 2);

        editor.dispose();
        saved.set(key, JSON.stringify({ version: 1, catalogRevision: revision, items: [{ ...old, position: [...office.position] }, ...retained] }));
        editor = createLayoutEditor({ scene, equipment: catalog, container: new EditorNode('div', doc) });
        assert.deepEqual(state[0].position, office.position, 'an already correct office is unchanged');
        assert.deepEqual(state.slice(1), retained);
      } finally { editor?.dispose(); }

      for (const edited of [
        { ...old, position: [position[0] + .25, 0, position[2]] },
        { ...old, position: [position[0] + 1e-10, 0, position[2]] },
        { ...old, position: [position[0], 0, position[2] + .25] },
        { ...old, rotation: .25 },
        { ...old, rotation: 1e-10 },
      ]) {
        const restored = validateLayout([edited], [office], { migrateDefaults: true, migrateCampusDefaults: false, sourceCatalogRevision: revision })[0];
        assert.deepEqual(restored.position, office.position, 'the user requested restoring every previously saved office position beside LPG');
        assert.equal(restored.rotation, office.rotation);
        for (const options of [{}, { migrateDefaults: true, sourceCatalogRevision: currentRevision }]) {
          const kept = validateLayout([edited], [office], options)[0];
          assert.deepEqual(kept.position, edited.position, 'an explicit import or subsequent current-release office move remains intentional');
          assert.ok(Math.abs(kept.rotation - edited.rotation) < 1e-12);
        }
      }
    }
  } finally { globalThis.window = priorWindow; }
});
