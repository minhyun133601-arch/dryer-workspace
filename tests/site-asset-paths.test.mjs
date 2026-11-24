import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { legacyAssetTarget } from '../apps/site/legacy-asset-paths.js';
import { startServer } from '../tooling/serve.mjs';

test('old image URLs serve the classified original, compact drawing or cropped equipment face', async t => {
  const server = await startServer({ port: 0 });
  t.after(() => new Promise(resolve => {
    server.close(resolve);
    server.closeAllConnections();
  }));
  const site = `http://127.0.0.1:${server.address().port}/apps/site/assets/`;
  const fileRoot = new URL('../apps/site/assets/', import.meta.url);
  for (const [old, current] of [
    ['compressor/field-001.jpg', 'photos/compressor/field-001.jpg'],
    ['drawings/chiller/page-003-receiver-pressure-vessel-certificate.jpg', 'documents/chiller/page-003-receiver-pressure-vessel-certificate.jpg'],
    ['share/chiller/page-003-receiver-pressure-vessel-certificate.jpg', 'documents/share/chiller/page-003-receiver-pressure-vessel-certificate.jpg'],
    ['share/chiller/page-014-chiller-general-arrangement-and-bom.jpg', 'drawings/chiller/page-014-chiller-general-arrangement-and-bom.jpg'],
  ]) {
    const response = await fetch(site + old);
    assert.equal(response.status, 200);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), await readFile(new URL(current, fileRoot)));
  }
  const oldPanel = 'equipment-cards/outdoor/072-air-handler-20rt-2/left.jpg';
  assert.equal(legacyAssetTarget('./assets/' + oldPanel), './assets/photos/equipment-cards/outdoor/072-air-handler-20rt-2/overview.jpg#left');
  const panel = await fetch(site + oldPanel);
  assert.equal(panel.status, 200);
  const body = Buffer.from(await panel.arrayBuffer());
  if (panel.headers.get('content-type') === 'image/svg+xml') {
    assert.match(body.toString(), /viewBox="400 0 400 500"/);
  } else {
    assert.equal(panel.headers.get('content-type'), 'image/jpeg');
    assert.equal(body.readUInt16BE(0), 0xffd8);
    const frame = body.indexOf(Buffer.from([0xff, 0xc0]));
    assert.ok(frame >= 0);
    assert.deepEqual([body.readUInt16BE(frame + 7), body.readUInt16BE(frame + 5)], [400, 500]);
  }
  assert.equal((await fetch(site + 'equipment-cards/outdoor/missing/left.jpg')).status, 404);
});
