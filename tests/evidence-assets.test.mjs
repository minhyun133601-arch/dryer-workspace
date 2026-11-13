import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { isRetainedEvidenceImage } from '../apps/site/evidence-assets.js';
import { SITE_ASSETS } from '../apps/site/asset-catalog.js';
import { LIQUID_ASSETS } from '../apps/site/liquid-assets.js';
import { OUTDOOR_HISTORY_CARDS } from '../apps/site/outdoor-card-data.js';

test('runtime evidence accepts retained drawings and team 3 cards while rejecting ordinary photos and team 2 cards', () => {
  for (const reference of [
    './assets/equipment-cards/liquid/042-pet-filler-28mm/four-views.jpg', './assets/equipment-cards/outdoor/084-cheerpack-stick-air-handler/front.jpg',
    './assets/drawings/furnace/burner-assembly-drawing.jpg', './assets/drawings/chiller/page-014-chiller-general-arrangement-and-bom.jpg',
    './assets/drawings/chiller/hitachi-compressor-dimensions.jpg', './assets/drawings/outdoor/equipment-plan-2022.png',
    './assets/drawings/dryer/dryer-floor-plan-1f.png', './assets/drawings/campus/yusan-site-plan.png',
    './assets/drawings/preparation/current-room-plan-clip01-076s.jpg', './assets/drawings/preparation/current-room-plan-frame-078s.jpg',
    './assets/drawings/packaging/floor-2-workplace-2025.png', './assets/brand/heechang-official-logo.svg',
  ]) assert.equal(isRetainedEvidenceImage(reference), true, reference);
  for (const reference of [
    './photos/team2-cards/card-001-front.jpg', './photos/preparation-room/frame-267s.jpg',
    './photos/dryer-roof-7f/frame-012s.jpg', './photos/outdoor/20261030_131346-000.jpg',
    './photos/furnace/overview.jpg', './photos/chiller-20261110/photo-001.jpg',
    './photos/campus-entrance.png', './photos/packaging-3f/frame-033s.jpg', '', null, undefined,
  ]) assert.equal(isRetainedEvidenceImage(reference), false, String(reference));
});

test('the catalog permits every current viewer image and keeps compact share variants outside the runtime evidence gallery', () => {
  assert.ok(SITE_ASSETS.length > 100, 'the retained drawings and card imagery remain available');
  let shared = 0;
  for (const asset of SITE_ASSETS) {
    for (const reference of [asset.path, `.${asset.path}`, `/apps/site/${asset.path.slice(2)}`]) {
      assert.equal(isRetainedEvidenceImage(reference), true, reference);
    }
    if (asset.sharePath) {
      shared++;
      for (const reference of [asset.sharePath, `.${asset.sharePath}`, `/apps/site/${asset.sharePath.slice(2)}`]) {
        assert.equal(isRetainedEvidenceImage(reference), false, `share derivatives are export inputs: ${reference}`);
      }
    }
  }
  assert.ok(shared > 0, 'compact export inputs remain registered separately');
  assert.equal(isRetainedEvidenceImage('data:image/jpeg;base64,/9j/'), true);
  assert.equal(isRetainedEvidenceImage('./assets/drawings/unregistered.png'), false);
  assert.equal(isRetainedEvidenceImage('./photos/team3-liquid-cards/card-042-reflow.jpg'), false);
  assert.equal(isRetainedEvidenceImage('./photos/furnace/sheetburner.jpg'), false);
});

test('active asset folders contain exactly the registered viewer images and share derivatives', async () => {
  const assets = new URL('../apps/site/assets/', import.meta.url), files = await readdir(assets, { recursive: true, withFileTypes: true });
  const images = files.filter(entry => entry.isFile() && /\.(?:jpe?g|png|svg)$/i.test(entry.name));
  const expected = new Set(SITE_ASSETS.flatMap(asset => [asset.path, ...(asset.sharePath ? [asset.sharePath] : [])]));
  const actual = new Set();
  for (const entry of images) {
    const base = entry.parentPath || entry.path;
    const fullPath = path.join(base, entry.name).replaceAll('\\', '/');
    actual.add(`./assets/${fullPath.split('/assets/').at(-1)}`);
  }
  assert.deepEqual([...actual].sort(), [...expected].sort(), 'every image has an explicit catalog entry and role');
});

test('all 66 team 3 card groups retain accessible registered viewer images', async () => {
  const liquid = Object.values(LIQUID_ASSETS);
  assert.equal(liquid.length, 52); assert.equal(OUTDOOR_HISTORY_CARDS.length, 14);
  const outdoor = OUTDOOR_HISTORY_CARDS.flatMap(card => {
    assert.equal(card.views.length, 4, `card ${card.number} keeps all four views`);
    return [card.photo, ...card.views];
  });
  const references = [...liquid, ...outdoor];
  assert.equal(new Set(references).size, 122, '52 combined indoor images and five images for each of 14 outdoor cards');
  const registered = new Map(SITE_ASSETS.map(asset => [asset.path, asset.category]));
  for (const reference of references) {
    assert.ok(['card-liquid', 'card-outdoor'].includes(registered.get(reference)), reference);
    assert.equal(isRetainedEvidenceImage(reference), true, reference);
    const bytes = await readFile(new URL(`../apps/site/${reference.slice(2)}`, import.meta.url));
    assert.ok(bytes.length > 1000, reference); assert.equal(bytes.readUInt16BE(0), 0xffd8, reference);
  }
});
