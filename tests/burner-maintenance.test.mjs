import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { BURNER_MAINTENANCE_DOCUMENTS } from '../apps/site/burner-maintenance-data.js';
import { SITE_ASSETS } from '../apps/site/asset-catalog.js';
import { isRetainedEvidenceImage } from '../apps/site/evidence-assets.js';

const root = new URL('../', import.meta.url);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const originalSources = {
  'combustion-fan-replacement': {
    bytes: 9809920, pages: 2,
    sha256: 'bbfb33821cdcc3d49b0853acaed31aebfe2d39056073c3a542141ddcb2fea076',
  },
  'motor-coil-damage': {
    bytes: 1066304, pages: 1,
    sha256: '8b33cd39947c6b75c17f8232159a5195bd4e08a7f8dd39a86b776577619daa72',
  },
};

function jpegDimensions(bytes) {
  assert.equal(bytes.readUInt16BE(0), 0xffd8, 'slide export is a JPEG');
  const frames = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  for (let offset = 2; offset + 9 < bytes.length;) {
    assert.equal(bytes[offset], 0xff, 'valid JPEG marker sequence');
    while (bytes[offset + 1] === 0xff) offset++;
    const marker = bytes[offset + 1];
    if (frames.has(marker)) return { width: bytes.readUInt16BE(offset + 7), height: bytes.readUInt16BE(offset + 5) };
    if (marker === 0xda || marker === 0xd9) break;
    offset += 2 + bytes.readUInt16BE(offset + 2);
  }
  assert.fail('JPEG has no supported frame dimensions');
}

test('both original burner decks and all three displayed pages preserve their source bytes, sequence and native aspect ratios', async () => {
  const manifest = JSON.parse(await readFile(new URL('references/dryer-burner-maintenance-20261112/manifest.json', root), 'utf8'));
  assert.deepEqual(BURNER_MAINTENANCE_DOCUMENTS.map(record => record.id), Object.keys(originalSources));
  assert.equal(manifest.decks.length, 2);
  const registered = new Set(SITE_ASSETS.map(asset => asset.path));
  let pageCount = 0;
  for (const record of BURNER_MAINTENANCE_DOCUMENTS) {
    const deck = manifest.decks.find(entry => entry.id === record.id), expected = originalSources[record.id];
    assert.ok(deck, record.id);
    const source = await readFile(new URL(deck.currentPath, root));
    assert.equal(source.length, expected.bytes, deck.originalName);
    assert.equal(digest(source), expected.sha256, deck.originalName);
    assert.equal(deck.sha256, expected.sha256);
    assert.equal(deck.bytes, expected.bytes);
    assert.equal(deck.pageCount, expected.pages);
    assert.equal(record.slides.length, expected.pages);
    assert.equal(record.date.replaceAll('.', '-'), deck.documentDate);
    for (const [index, slide] of record.slides.entries()) {
      const original = deck.slides[index];
      assert.equal(original.number, index + 1, 'original slide order is retained');
      assert.equal(`apps/site/${slide.image.slice(2)}`, original.imagePath);
      assert.ok(registered.has(slide.image), 'a displayed maintenance page belongs to the asset catalog');
      assert.equal(isRetainedEvidenceImage(slide.image), true);
      assert.ok(slide.caption.trim());
      const bytes = await readFile(new URL(original.imagePath, root));
      assert.equal(bytes.length, original.bytes);
      assert.equal(digest(bytes), original.sha256);
      assert.deepEqual(jpegDimensions(bytes), { width: original.width, height: original.height });
      assert.ok(Math.abs(original.width / original.height - deck.widthPt / deck.heightPt) < 1e-6, 'the page is not stretched');
      pageCount++;
    }
  }
  assert.equal(pageCount, 3);
  assert.match(BURNER_MAINTENANCE_DOCUMENTS[0].note, /건조실 5층/, 'the repair card location is preserved independently of the model floor');
});

// A small DOM fixture with native dialog, focus and disabled-button semantics.
// It parses the viewer markup so selectors must match elements actually emitted.
class Node {
  constructor(tagName, ownerDocument) {
    this.tagName = tagName.toLowerCase(); this.ownerDocument = ownerDocument;
    this.children = []; this.attributes = {}; this.listeners = new Map(); this.parentNode = null;
    this.hidden = false; this.disabled = false; this.open = false; this.scrollTop = 0; this.scrollLeft = 0;
    this._text = ''; this.modalShows = 0;
    this.classList = {
      contains: value => this.className.split(/\s+/).includes(value),
      toggle: (value, force) => {
        const classes = new Set(this.className.split(/\s+/).filter(Boolean));
        const enabled = force ?? !classes.has(value);
        if (enabled) classes.add(value); else classes.delete(value);
        this.className = [...classes].join(' '); return enabled;
      },
    };
  }
  set className(value) { this.attributes.class = value; }
  get className() { return this.attributes.class || ''; }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  set innerHTML(value) {
    this.children = []; this._text = ''; const stack = [this];
    for (const match of value.matchAll(/<\/(\w+)\s*>|<(\w+)([^>]*)>|([^<]+)/g)) {
      if (match[1]) { stack.pop(); continue; }
      if (!match[2]) { stack.at(-1)._text += match[4]; continue; }
      const child = new Node(match[2], this.ownerDocument);
      for (const attribute of match[3].matchAll(/([\w-]+)(?:\s*=\s*"([^"]*)")?/g)) child.setAttribute(attribute[1], attribute[2] ?? '');
      stack.at(-1).append(child);
      if (!['img', 'input', 'br', 'hr', 'meta', 'link'].includes(child.tagName)) stack.push(child);
    }
  }
  append(...children) { for (const child of children) { child.parentNode = this; this.children.push(child); } }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === 'hidden') this.hidden = true;
    if (name === 'disabled') this.disabled = true;
  }
  getAttribute(name) { return this.attributes[name] ?? null; }
  matches(selector) {
    if (selector.startsWith('#')) return this.attributes.id === selector.slice(1);
    if (selector.startsWith('.')) return this.classList.contains(selector.slice(1));
    if (selector.startsWith('[')) return Object.hasOwn(this.attributes, selector.slice(1, -1));
    return this.tagName === selector.toLowerCase();
  }
  querySelector(selector) {
    const parts = selector.trim().split(/\s+/), candidates = [];
    const walk = node => { for (const child of node.children) { candidates.push(child); walk(child); } }; walk(this);
    return candidates.find(node => {
      if (!node.matches(parts.at(-1))) return false;
      let ancestor = node.parentNode;
      for (let index = parts.length - 2; index >= 0; index--) {
        while (ancestor && !ancestor.matches(parts[index])) ancestor = ancestor.parentNode;
        if (!ancestor) return false;
        ancestor = ancestor.parentNode;
      }
      return true;
    }) || null;
  }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }
  dispatch(type, values = {}) {
    const event = { type, target: this, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...values };
    for (const listener of this.listeners.get(type) || []) listener(event);
    return event;
  }
  click() { if (!this.disabled) return this.dispatch('click'); }
  focus() { this.ownerDocument.activeElement = this; }
  showModal() { this.open = true; this.modalShows++; }
  close() { if (this.open) { this.open = false; this.dispatch('close'); } }
  remove() {
    if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this);
    this.parentNode = null; this.removed = true;
  }
}

async function harness({ pathname = '/apps/site/index.html', documents = BURNER_MAINTENANCE_DOCUMENTS } = {}) {
  const document = { createElement(tag) { return new Node(tag, this); } };
  document.body = document.createElement('body'); document.activeElement = document.body;
  const context = vm.createContext({ document, location: { pathname } });
  const source = (await readFile(new URL('../apps/site/burner-maintenance.js', import.meta.url), 'utf8')).replace(/^export /gm, '');
  new vm.Script(`${source}\nglobalThis.create = createBurnerMaintenance;`).runInContext(context);
  const viewer = context.create(documents), dialog = document.body.children[0];
  const node = selector => { const result = dialog.querySelector(selector); assert.ok(result, selector); return result; };
  return { viewer, dialog, document, node, context,
    tab(id) { const record = documents.find(record => record.id === id); return node('.burner-document-tabs').children.find(button => button.textContent === record.title); },
    key(key) { return dialog.dispatch('keydown', { key }); },
  };
}

test('maintenance pages open by document ID, retain original order and stop at both keyboard and button boundaries', async () => {
  const before = structuredClone(BURNER_MAINTENANCE_DOCUMENTS), h = await harness();
  try {
    h.viewer.open('combustion-fan-replacement');
    assert.equal(h.dialog.open, true);
    assert.equal(h.node('#burner-document-title').textContent, before[0].title);
    assert.equal(h.node('output').textContent, '1 / 2쪽');
    assert.equal(h.node('img').src, before[0].slides[0].image);
    assert.equal(h.node('[data-document-previous]').disabled, true);
    assert.equal(h.node('[data-document-next]').disabled, false);
    assert.equal(h.key('ArrowLeft').defaultPrevented, true);
    assert.equal(h.node('output').textContent, '1 / 2쪽');
    h.node('.burner-document-page').scrollTop = 200;
    h.node('.burner-document-page').scrollLeft = 80;
    h.node('[data-document-next]').click();
    assert.equal(h.node('output').textContent, '2 / 2쪽');
    assert.equal(h.node('img').src, before[0].slides[1].image);
    assert.match(h.node('img').alt, /2쪽/);
    assert.equal(h.node('.burner-document-footer strong').textContent, before[0].slides[1].caption);
    assert.equal(h.node('.burner-document-page').scrollTop, 0);
    assert.equal(h.node('.burner-document-page').scrollLeft, 0);
    assert.equal(h.node('[data-document-next]').disabled, true);
    h.key('ArrowRight'); h.node('[data-document-next]').click();
    assert.equal(h.node('output').textContent, '2 / 2쪽');
    assert.equal(h.key('ArrowLeft').defaultPrevented, true);
    assert.equal(h.node('output').textContent, '1 / 2쪽');
    assert.equal(h.key('Tab').defaultPrevented, false, 'unrelated keys keep their native behavior');

    h.tab('motor-coil-damage').click();
    assert.equal(h.node('#burner-document-title').textContent, before[1].title);
    assert.equal(h.node('output').textContent, '1 / 1쪽');
    assert.equal(h.node('img').src, before[1].slides[0].image);
    assert.equal(h.node('[data-document-previous]').disabled, true);
    assert.equal(h.node('[data-document-next]').disabled, true);
    assert.equal(h.tab('motor-coil-damage').getAttribute('aria-pressed'), 'true');
    assert.equal(h.tab('combustion-fan-replacement').getAttribute('aria-pressed'), 'false');
    h.key('ArrowRight'); h.key('ArrowLeft');
    assert.equal(h.node('output').textContent, '1 / 1쪽');
    assert.match(h.node('.burner-document-footer span').textContent, /2024\.12\.30.*B측/);
    h.tab('combustion-fan-replacement').click();
    assert.equal(h.node('output').textContent, '1 / 2쪽', 'switching documents starts at its first page');
    assert.match(h.node('.burner-document-footer span').textContent, /건조실 5층/);
    assert.deepEqual(BURNER_MAINTENANCE_DOCUMENTS, before, 'viewing cannot alter the source document data');
  } finally { h.viewer.dispose(); }
});

test('fit and enlarged views, failed-image recovery and local, share and embedded page sources remain usable', async () => {
  const embedded = 'data:image/jpeg;base64,/9j/';
  const documents = structuredClone(BURNER_MAINTENANCE_DOCUMENTS);
  documents[1].slides[0].image = embedded;
  const h = await harness({ documents });
  try {
    h.viewer.open('combustion-fan-replacement');
    assert.equal(h.dialog.classList.contains('is-enlarged'), false);
    assert.equal(h.node('[data-document-zoom]').getAttribute('aria-pressed'), 'false');
    h.node('[data-document-zoom]').click();
    assert.equal(h.dialog.classList.contains('is-enlarged'), true);
    assert.equal(h.node('[data-document-zoom]').textContent, '화면에 맞춤');
    assert.equal(h.node('[data-document-zoom]').getAttribute('aria-pressed'), 'true');
    h.node('[data-document-zoom]').click();
    assert.equal(h.dialog.classList.contains('is-enlarged'), false);
    assert.equal(h.node('[data-document-zoom]').textContent, '크게 보기');
    h.node('img').dispatch('error');
    assert.equal(h.node('.burner-document-error').hidden, false);
    h.node('[data-document-next]').click();
    assert.equal(h.node('.burner-document-error').hidden, true, 'a new page clears the previous page failure');

    h.viewer.close();
    h.context.location.pathname = '/apps/site/share/index.html';
    h.viewer.open('combustion-fan-replacement');
    assert.equal(h.node('img').src, `.${documents[0].slides[0].image}`);
    h.tab('motor-coil-damage').click();
    assert.equal(h.node('img').src, embedded, 'an offline data URL never acquires a relative prefix');
    h.node('[data-document-zoom]').click();
    h.viewer.close(); h.viewer.open('motor-coil-damage');
    assert.equal(h.dialog.classList.contains('is-enlarged'), false, 'reopening starts with the full page fitted');
    assert.equal(h.node('output').textContent, '1 / 1쪽');
  } finally { h.viewer.dispose(); }
});

test('closing with its button or native dialog action restores focus and disposal removes the viewer', async () => {
  const h = await harness();
  const trigger = h.document.createElement('button'); h.document.body.append(trigger); trigger.focus();
  try {
    h.viewer.open('motor-coil-damage');
    assert.equal(h.node('#burner-document-title').textContent, BURNER_MAINTENANCE_DOCUMENTS[1].title);
    assert.equal(h.document.activeElement, h.node('[data-document-close]'));
    h.node('[data-document-close]').click();
    assert.equal(h.dialog.open, false);
    assert.equal(h.document.activeElement, trigger);
    h.viewer.close();
    assert.equal(h.document.activeElement, trigger, 'closing an already closed viewer leaves focus alone');

    h.viewer.open('unknown-document');
    assert.equal(h.node('#burner-document-title').textContent, BURNER_MAINTENANCE_DOCUMENTS[0].title, 'an unknown link safely falls back to the first document');
    h.dialog.close();
    assert.equal(h.document.activeElement, trigger, 'native Escape/dialog close uses the same focus restoration');
    h.viewer.open('combustion-fan-replacement');
    h.viewer.dispose();
    assert.equal(h.dialog.open, false);
    assert.equal(h.dialog.removed, true);
    assert.equal(h.document.body.children.includes(h.dialog), false);
    assert.equal(h.document.activeElement, trigger);
    assert.doesNotThrow(() => h.viewer.dispose());
  } finally { h.viewer.dispose(); }
});
