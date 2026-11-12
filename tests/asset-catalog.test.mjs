import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { inspectSiteAssets } from '../tooling/check-assets.mjs';

const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0]);
const jpg = Buffer.from([255, 216, 255, 224, 0]);
const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>';
const asset = (id, reference, extra = {}) => ({ id, path: reference, label: id, category: 'drawing', ...extra });

async function fixture(t, files) {
  const parent = await realpath(tmpdir());
  const root = await mkdtemp(path.join(parent, 'site-assets-test-'));
  t.after(async () => {
    const resolved = await realpath(root);
    assert.equal(path.dirname(resolved), parent, 'fixture cleanup stays directly in the system temporary directory');
    await rm(resolved, { recursive: true, force: true });
  });
  await mkdir(path.join(root, 'apps/site/assets'), { recursive: true });
  await writeFile(path.join(root, 'package.json'), '{"type":"module"}\n');
  for (const [relative, content] of Object.entries(files)) {
    const file = path.join(root, 'apps/site', relative);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content);
  }
  return root;
}

test('the active asset catalog matches real files, names, image formats and generated data references', async () => {
  assert.deepEqual(await inspectSiteAssets(), []);
});

test('registered drawings, branding and share derivatives pass while historical photo metadata stays outside the catalog', async t => {
  const root = await fixture(t, {
    'assets/drawings/floor-1.png': png,
    'assets/brand/company-mark.svg': svg,
    'assets/share/floor-1.jpg': jpg,
    'example-data.js': 'export const photos = [1].map(n => `./assets/drawings/floor-${n}.png`);\nexport const historical = "./photos/retired.jpg";\n',
    'app.js': 'const brand = "./assets/brand/company-mark.svg";\n',
  });
  const assets = [asset('floor-1', './assets/drawings/floor-1.png', { sharePath: './assets/share/floor-1.jpg' }), asset('company-mark', './assets/brand/company-mark.svg')];
  assert.deepEqual(await inspectSiteAssets({ root, assets }), []);
});

test('missing files and unsafe or inconsistent names are reported without resolving outside assets', async t => {
  const root = await fixture(t, { 'assets/drawings/Floor-1.png': png });
  const errors = await inspectSiteAssets({ root, assets: [
    asset('missing', './assets/drawings/missing.png'),
    asset('wrong-case', './assets/drawings/floor-1.png'),
    asset('escape', './assets/../private.png'),
    asset('invalid-name', './assets/drawings/floor_2.png'),
  ] });
  assert.ok(errors.some(error => /파일 없음.*missing\.png/.test(error)), errors.join('\n'));
  assert.ok(errors.some(error => /대소문자 불일치.*floor-1\.png/.test(error)), errors.join('\n'));
  assert.equal(errors.filter(error => error.includes('잘못된 자산 경로')).length, 2);
});

test('catalog ID and physical file collisions include share paths', async t => {
  const root = await fixture(t, { 'assets/drawings/floor-1.png': png, 'assets/share/floor-1.jpg': jpg });
  const errors = await inspectSiteAssets({ root, assets: [
    asset('floor-1', './assets/drawings/floor-1.png', { sharePath: './assets/share/floor-1.jpg' }),
    asset('floor-1', './assets/drawings/floor-1.png', { sharePath: './assets/share/floor-1.jpg' }),
    asset('cross-collision', './assets/share/floor-1.jpg'),
  ] });
  assert.equal(errors.filter(error => error.includes('중복 자산 ID')).length, 1);
  assert.equal(errors.filter(error => error.includes('중복 자산 경로')).length, 3);
});

test('wrong image contents, unregistered files and both static and generated references fail the audit', async t => {
  const root = await fixture(t, {
    'assets/drawings/floor-1.png': jpg,
    'assets/share/unregistered.jpg': jpg,
    'app.js': 'const image = "./assets/drawings/static-missing.png"; const directory = "./assets/drawings/";\n',
    'example-data.js': 'export const photos = [2].map(n => `./assets/drawings/floor-${n}.png`);\n',
  });
  const errors = await inspectSiteAssets({ root, assets: [asset('floor-1', './assets/drawings/floor-1.png')] });
  for (const pattern of [/시그니처 불일치/, /등록되지 않은 자산 이미지.*unregistered\.jpg/, /app\.js: 등록되지 않은 자산 참조.*static-missing\.png/, /example-data\.js: 등록되지 않은 자산 참조.*floor-2\.png/]) {
    assert.ok(errors.some(error => pattern.test(error)), `${pattern}\n${errors.join('\n')}`);
  }
  assert.equal(errors.length, 4, 'template source and directory prefixes do not produce spurious file references');
});

test('moved photo references fail in literals and generated data while retired historical photos remain valid metadata', async t => {
  const root = await fixture(t, {
    'assets/drawings/floor-1.png': png,
    'app.js': 'const stale = "./photos/old-plan-1.jpg"; const historical = "./photos/retired-field-photo.jpg";\n',
    'example-data.js': 'export const photos = [1].map(n => `./photos/old-plan-${n}.jpg`); export const historical = "./photos/retired-field-photo.jpg";\n',
  });
  const errors = await inspectSiteAssets({ root, assets: [asset('floor-1', './assets/drawings/floor-1.png')], legacyMoves: [
    { originalPath: 'apps/site/photos/old-plan-1.jpg', currentPath: 'apps/site/assets/drawings/floor-1.png' },
  ] });
  assert.equal(errors.length, 2, errors.join('\n'));
  assert.ok(errors.some(error => /app\.js: 이동 전 자산 참조.*old-plan-1\.jpg/.test(error)), errors.join('\n'));
  assert.ok(errors.some(error => /example-data\.js: 이동 전 자산 참조.*old-plan-1\.jpg/.test(error)), errors.join('\n'));
  assert.ok(errors.every(error => !error.includes('retired-field-photo')));
});
