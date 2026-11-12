import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, mkdtemp, realpath, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OUTDOOR_EQUIPMENT } from '../apps/site/outdoor-data.js';

test('document presentation is removed from both model viewers while its source evidence is preserved', async () => {
  for (const file of ['apps/site/index.html', 'apps/site/app.js', 'apps/site/share/index.html', 'apps/site/share/app.js', 'apps/site/scene.js']) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /equipment-document|equipment-documents|getEquipmentDocuments|renderEquipmentDocuments|openEquipmentDocument|has-documents|_documentMarkers/, file);
  }
  assert.ok(OUTDOOR_EQUIPMENT.every((item) => !item.documentIds));
  const ahu = OUTDOOR_EQUIPMENT.find((item) => item.id === 'outdoor-ahu');
  assert.equal(ahu.historyCardNumber, 84);
  assert.equal(ahu.photos[0], './assets/equipment-cards/outdoor/084-cheerpack-stick-air-handler/front.jpg');
  const source = await readFile(new URL('../references/equipment-document-archive-20261110/documents/cheerpack-ahu-history.pdf', import.meta.url));
  assert.equal(createHash('sha256').update(source).digest('hex'), 'fcbdcbd3e110100c32c6fbc99a41afc7b81872ec37b4a0b10818524fe2bc2cf3');
});

test('the offline model omits document controls, popup code and embedded equipment PDFs', async () => {
  const temporaryRoot = await realpath(tmpdir());
  const directory = await mkdtemp(path.join(temporaryRoot, 'dryer-no-documents-'));
  try {
    const output = path.join(directory, 'map.html');
    const result = spawnSync(process.execPath, [fileURLToPath(new URL('../tooling/export-site.mjs', import.meta.url)), output], { encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const html = await readFile(output, 'utf8');
    assert.doesNotMatch(html, /equipment-document|getEquipmentDocuments|renderEquipmentDocuments|openEquipmentDocument|data:application\/pdf;base64|documentIds/);
    const equipment = JSON.parse(html.match(/^const OUTDOOR_EQUIPMENT = (\[[^\n]+\]);$/m)[1]);
    assert.equal(equipment.length, 22);
    assert.equal(equipment.find((item) => item.id === 'outdoor-ahu').historyCardNumber, 84);
  } finally {
    const resolved = await realpath(directory);
    assert.equal(path.dirname(resolved), temporaryRoot);
    await rm(resolved, { recursive: true, force: true });
  }
});
