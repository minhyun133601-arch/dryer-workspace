import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { MODULES, resolveRoute } from '../workspace/module-registry.js';

async function workspace(hash = '#/presentation') {
  const source = (await readFile(new URL('../workspace/app.js', import.meta.url), 'utf8')).replace("import { MODULES, resolveRoute } from './module-registry.js';", '');
  const nodes = new Map(), windowEvents = new Map(), documentEvents = new Map(), messages = [];
  const element = (id = '') => ({
    id, dataset: {}, attributes: {}, children: [], hidden: false, listeners: new Map(),
    append(...children) { this.children.push(...children); },
    setAttribute(name, value) { this.attributes[name] = value; },
    removeAttribute(name) { delete this.attributes[name]; },
    addEventListener(type, callback) { this.listeners.set(type, callback); },
    scrollIntoView() {}, focus() {}, remove() {},
  });
  const node = id => { if (!nodes.has(id)) nodes.set(id, element(id)); return nodes.get(id); };
  const homeLink = element('home'); homeLink.dataset.route = 'home';
  const document = {
    hidden: false, title: '', body: { dataset: {} },
    getElementById: node,
    createElement(tag) {
      const value = element();
      if (tag === 'iframe') {
        value.contentWindow = { postMessage(message, origin) { messages.push({ moduleId: value.dataset.module, message, origin }); } };
        value.contentDocument = { querySelector: () => ({ lang: 'ko' }) };
      }
      return value;
    },
    querySelector: selector => node(selector),
    querySelectorAll: () => [homeLink, ...node('workspace-nav').children],
    addEventListener: (type, callback) => documentEvents.set(type, callback),
  };
  const location = { hash, protocol: 'http:', origin: 'http://localhost:4173' };
  const window = { addEventListener: (type, callback) => windowEvents.set(type, callback) };
  const context = vm.createContext({ MODULES, resolveRoute, document, location, window,
    history: { replaceState(state, title, next) { location.hash = next; } }, setTimeout: () => 1, clearTimeout() {},
  });
  new vm.Script(`${source}\nglobalThis.state = () => ({ current, presentationActive, ids: [...instances.keys()] });`).runInContext(context);
  const frame = id => node('module-views').children.find(value => value.dataset.module === id);
  return {
    document, location, node, frame, messages, state: context.state,
    route(hash) { location.hash = hash; windowEvents.get('hashchange')(); },
    message(id, data, { origin = location.origin, source = frame(id)?.contentWindow } = {}) { windowEvents.get('message')({ origin, source, data }); },
  };
}

test('the active presentation hides workspace navigation and rejects other modules until it ends', async () => {
  const w = await workspace('#/site');
  w.route('#/presentation');
  w.message('presentation', { type: 'dryer-workspace:ready', moduleId: 'presentation' });
  assert.equal(w.node('module-loading').hidden, true);
  w.message('presentation', { type: 'dryer-workspace:presentation-active', active: true });
  assert.equal(w.node('.workspace-header').hidden, true);
  assert.equal(w.document.body.dataset.presentationActive, 'true');
  for (const sender of ['site', 'presentation']) w.message(sender, { type: 'dryer-workspace:navigate', moduleId: 'drawings' });
  assert.equal(w.location.hash, '#/presentation');
  w.route('#/drawings');
  assert.equal(w.location.hash, '#/presentation', 'direct hash changes cannot escape the running show');
  assert.equal(w.state().current, 'presentation');
  assert.equal(w.frame('drawings'), undefined, 'no unrelated iframe is created while presenting');
  assert.equal(w.frame('site').hidden, true);
  w.message('presentation', { type: 'dryer-workspace:presentation-active', active: false });
  assert.equal(w.node('.workspace-header').hidden, false);
  w.route('#/drawings');
  assert.equal(w.state().current, 'drawings');
  assert.ok(w.frame('drawings'));
});

test('presentation lock messages require the current presentation frame and the exact workspace origin', async () => {
  const w = await workspace('#/site');
  w.message('site', { type: 'dryer-workspace:presentation-active', active: true });
  assert.equal(w.state().presentationActive, false);
  w.route('#/presentation');
  for (const options of [{ origin: 'https://example.invalid' }, { source: {} }]) {
    w.message('presentation', { type: 'dryer-workspace:presentation-active', active: true }, options);
    assert.equal(w.state().presentationActive, false);
  }
  w.message('presentation', { type: 'dryer-workspace:presentation-active', active: 'true' });
  assert.equal(w.state().presentationActive, false);
  w.message('presentation', { type: 'dryer-workspace:presentation-active', active: true });
  w.message('site', { type: 'dryer-workspace:presentation-active', active: false });
  w.message('presentation', { type: 'dryer-workspace:presentation-active', active: false }, { origin: 'null' });
  assert.equal(w.state().presentationActive, true, 'a different module or origin cannot unlock the show');
  w.message('presentation', { type: 'dryer-workspace:presentation-active', active: false });
  w.route('#/site');
  w.message('presentation', { type: 'dryer-workspace:presentation-active', active: true });
  assert.equal(w.state().presentationActive, false, 'a hidden presentation cannot take over workspace navigation');
});

test('reloading the presentation restores the workspace header before another show starts', async () => {
  const w = await workspace();
  w.message('presentation', { type: 'dryer-workspace:presentation-active', active: true });
  w.frame('presentation').listeners.get('load')();
  assert.equal(w.state().presentationActive, false);
  assert.equal(w.node('.workspace-header').hidden, false);
});
