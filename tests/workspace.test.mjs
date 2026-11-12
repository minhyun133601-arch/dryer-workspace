import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { MODULES, resolveRoute, validateModules } from '../workspace/module-registry.js';

test('every registered space has a canonical entry and a stable route', async () => {
  assert.equal(validateModules(MODULES), MODULES);
  assert.deepEqual(MODULES.map(({ id }) => id), ['site', 'drawings']);
  assert.ok(MODULES.some((module) => module.id === 'site' && module.entry === 'apps/site/index.html'));
  assert.ok(MODULES.some((module) => module.id === 'drawings' && module.entry === 'apps/drawings/index.html'));
  for (const module of MODULES) {
    await access(new URL(`../${module.entry}`, import.meta.url));
    assert.equal(resolveRoute(`#/${module.id}`), module.id);
  }
});

test('unknown routes fall back to the overview, including malformed deep links', () => {
  for (const hash of ['', '#', '#/', '#/home', '#/unknown', '#/../site', '#/site%2Fdrawings', '#/motor', '#/panel', '#/heat-exchanger']) {
    assert.equal(resolveRoute(hash), 'home');
  }
  assert.equal(resolveRoute('#/site?view=top'), 'site');
  assert.equal(resolveRoute('#/drawings?view=review'), 'drawings');
});

test('the active home links only to modeling and drawing review', async () => {
  const home = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(home, /href="#\/drawings"/);
  assert.doesNotMatch(home, /references\/열교환기\/|apps\/(?:panel|motor|heat-exchanger)\/|#\/(?:panel|motor|heat-exchanger)/);
});

test('a new space can be registered without changing route logic', () => {
  const modules = [...MODULES, { id: 'simulator', name: '시뮬레이터', entry: 'apps/simulator/index.html' }];
  validateModules(modules);
  assert.equal(resolveRoute('#/simulator', modules), 'simulator');
  assert.throws(() => validateModules([...modules, modules[0]]), /ID/);
  assert.throws(() => validateModules([{ id: 'external', name: 'External', entry: 'https://example.com/' }]), /경로/);
});
