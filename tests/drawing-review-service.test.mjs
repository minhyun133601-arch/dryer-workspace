import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { startServer, PROJECT_ROOT } from '../tooling/serve.mjs';

const prefix = '/drawing-review';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64');

function request(port, requestPath, { method = 'GET', headers = {}, body } = {}) {
  const payload = body === undefined ? null : Buffer.from(JSON.stringify(body));
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: requestPath, method,
      headers: { ...headers, ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': payload.length } : {}) },
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('error', reject);
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers,
        body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error('Drawing request timed out.')));
    req.end(payload);
  });
}

function json(response, expectedStatus = 200) {
  assert.equal(response.status, expectedStatus, response.body.toString());
  return JSON.parse(response.body.toString());
}

function alive(pid) {
  try { process.kill(pid, 0); return true; }
  catch (error) { if (error.code === 'ESRCH') return false; throw error; }
}

async function waitUntil(check, message) {
  const deadline = Date.now() + 4000;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail(message);
}

async function closeServer(server) {
  if (server?.listening) {
    await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); });
  }
}

async function makeFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'heechang-drawing-review-'));
  const app = path.join(root, '근거 자료', '도면검토앱');
  const drawings = path.join(root, '근거 자료', '건물3D 후보도면');
  const original = Buffer.concat([png, Buffer.alloc(300000)]);
  const id = createHash('sha256').update(original).digest('hex');
  const cache = path.join(app, 'cache', id);
  await Promise.all([mkdir(path.join(app, 'public'), { recursive: true }),
    mkdir(path.join(app, 'data'), { recursive: true }), mkdir(drawings, { recursive: true }),
    mkdir(cache, { recursive: true })]);
  const metadata = JSON.stringify({ status: 'ready', kind: 'png', pages: [
    { src: `/cache/${id}/page-001.png`, width: 1, height: 1, label: '1' },
  ], warnings: [] });
  const csv = [
    ['SHA256', '원본현재상대경로', '원본파일명', '확장자', '공장_경로단서', '동_공간_경로단서', '분류', '바이트', '원출처수'],
    [id, '전체 배치도.png', '전체 배치도.png', '.png', '희창유업', '본관', '01_전체배치', String(original.length), '1'],
  ].map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(',')).join('\r\n');
  await Promise.all([
    copyFile(path.join(PROJECT_ROOT, '근거 자료', '도면검토앱', 'server.py'), path.join(app, 'server.py')),
    writeFile(path.join(root, 'index.html'), '<title>작업실</title>'),
    writeFile(path.join(app, 'public', 'index.html'), '<title>도면 검토</title>'),
    writeFile(path.join(app, 'public', 'app.js'), 'window.drawingReview = true;'),
    writeFile(path.join(app, 'public', 'style.css'), 'body { color: black; }'),
    writeFile(path.join(app, 'data', 'private-notes.txt'), 'private fixture notes'),
    writeFile(path.join(app, 'build_previews.py'), "from pathlib import Path\nPath(__file__).with_name('unexpected-conversion.txt').write_text('started')\n"),
    writeFile(path.join(drawings, '00_도면목록.csv'), '\ufeff' + csv),
    writeFile(path.join(drawings, '전체 배치도.png'), original),
    writeFile(path.join(cache, 'page-001.png'), png),
    writeFile(path.join(cache, 'meta.json'), metadata),
  ]);
  return { root, app, drawings, id, original, metadata, cache };
}

test('drawing review works through the workspace with persistent discussion and an owned private helper', { timeout: 30000 }, async (t) => {
  const fixture = await makeFixture();
  let server, pid, token;
  t.after(async () => {
    await closeServer(server);
    await server?.drawingReview.close();
    assert.ok(path.basename(fixture.root).startsWith('heechang-drawing-review-'));
    await rm(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
  });
  server = await startServer({ root: fixture.root, port: 0 });
  const port = server.address().port;
  const origin = `http://127.0.0.1:${port}`;
  const infoFile = path.join(fixture.app, 'data', 'server.json');
  const auth = () => ({ 'X-Review-Token': token });

  await t.test('starts only on first drawing access and shares one helper across simultaneous requests', async () => {
    assert.equal((await request(port, '/')).status, 200);
    await assert.rejects(stat(infoFile), { code: 'ENOENT' });
    const redirect = await request(port, prefix);
    assert.equal(redirect.status, 302);
    assert.equal(redirect.headers.location, `${prefix}/`);
    await assert.rejects(stat(infoFile), { code: 'ENOENT' });
    const bootstraps = await Promise.all(Array.from({ length: 3 }, () => request(port, `${prefix}/api/bootstrap`)));
    const bootstrap = json(bootstraps[0]);
    token = bootstrap.token;
    assert.equal(bootstrap.application, 'heechang-drawing-review');
    assert.equal(bootstrap.catalogCount, 1);
    assert.equal(bootstrap.remote, false);
    assert.ok(token);
    for (const response of bootstraps) {
      assert.equal(json(response).token, token);
      assert.match(response.headers['set-cookie'][0], /; Path=\/drawing-review\//);
    }
    const info = JSON.parse(await readFile(infoFile, 'utf8'));
    pid = info.pid;
    assert.equal(info.application, bootstrap.application);
    assert.equal(info.host, '127.0.0.1');
    assert.equal(info.rootId, bootstrap.rootId);
    assert.equal(path.resolve(info.root), path.resolve(fixture.drawings));
    assert.ok(info.port > 0);
    assert.equal(alive(pid), true);
    assert.equal((await request(port, `${prefix}/`)).body.toString(), '<title>도면 검토</title>');
    assert.match((await request(port, `${prefix}/app.js`)).headers['content-type'], /javascript/);
    assert.match((await request(port, `${prefix}/style.css`)).headers['content-type'], /css/);
  });

  await t.test('loads catalog, page, thumbnail and exact original bytes through the common origin', async () => {
    assert.equal((await request(port, `${prefix}/api/catalog`)).status, 401);
    const response = await request(port, `${prefix}/api/catalog`, { headers: auth() });
    const catalog = json(response);
    assert.equal(catalog.items.length, 1);
    const item = catalog.items[0];
    assert.equal(item.id, fixture.id);
    assert.equal(item.name, '전체 배치도.png');
    const detail = json(await request(port, `${prefix}/api/drawings/${fixture.id}`, { headers: auth() }));
    assert.equal(detail.preview.status, 'ready');
    assert.equal(detail.preview.pages.length, 1);
    const page = await request(port, prefix + detail.preview.pages[0].src, { headers: auth() });
    assert.equal(page.status, 200);
    assert.deepEqual(page.body, png);
    const thumbnail = await request(port, prefix + item.thumbnailUrl, { headers: auth() });
    assert.equal(thumbnail.status, 200);
    assert.match(thumbnail.headers['content-type'], /^image\//);
    assert.ok(thumbnail.body.length > 0);
    const original = await request(port, prefix + item.originalUrl, { headers: auth() });
    assert.equal(original.status, 200);
    assert.equal(original.headers['content-length'], String(fixture.original.length));
    assert.match(original.headers['content-disposition'], /^inline;/);
    assert.deepEqual(original.body, fixture.original);
    const head = await request(port, prefix + item.originalUrl, { method: 'HEAD', headers: auth() });
    assert.equal(head.status, 200);
    assert.equal(head.body.length, 0);
    assert.equal(head.headers['content-length'], String(fixture.original.length));
    const cookie = response.headers['set-cookie'][0].split(';', 1)[0];
    assert.equal((await request(port, `${prefix}/api/catalog`, { headers: { Cookie: cookie } })).status, 200);
  });

  await t.test('stores use candidates and page discussions while rejecting foreign-origin writes and private paths', async () => {
    const stateUrl = `${prefix}/api/drawings/${fixture.id}/state`;
    assert.equal((await request(port, stateUrl, { method: 'POST', body: { starred: true } })).status, 401);
    const candidate = json(await request(port, stateUrl, { method: 'POST', headers: { ...auth(), Origin: origin },
      body: { starred: true, status: 'discuss' } }));
    assert.equal(candidate.starred, true);
    assert.equal(candidate.status, 'discuss');
    const comment = json(await request(port, `${prefix}/api/drawings/${fixture.id}/comments`, {
      method: 'POST', headers: { ...auth(), Origin: origin },
      body: { author: '검토자', text: '이 배치도를 3D 재현 근거로 검토', page: 1, x: 0.25, y: 0.5 },
    }), 201);
    assert.equal(comment.page, 1);
    assert.equal(comment.x, 0.25);
    assert.equal((await request(port, stateUrl, { method: 'POST', headers: { ...auth(), Origin: 'https://foreign.invalid' },
      body: { starred: false } })).status, 403);
    for (const route of ['/server.py', '/data/access.json', '/data/review.sqlite3', `/cache/${fixture.id}/meta.json`]) {
      assert.equal((await request(port, prefix + route, { headers: auth() })).status, 404, route);
    }
    for (const route of ['/cache/%2e%2e/data/access.json', '/%2e%2e/package.json']) {
      assert.equal((await request(port, prefix + route, { headers: auth() })).status, 403, route);
    }
    assert.equal((await request(port, `${prefix}/cache/%5c..%5cdata/access.json`, { headers: auth() })).status, 400);
    assert.equal((await request(port, `${prefix}/api/catalog`, { method: 'DELETE', headers: auth() })).status, 405);
    const detail = json(await request(port, `${prefix}/api/drawings/${fixture.id}`, { headers: auth() }));
    assert.equal(detail.state.starred, true, 'a rejected write must not alter the use candidate');
    assert.equal(detail.state.status, 'discuss');
    assert.equal(detail.comments.length, 1);
    assert.equal(detail.comments[0].id, comment.id);
    assert.equal(detail.comments[0].text, '이 배치도를 3D 재현 근거로 검토');
    const exported = await request(port, `${prefix}/api/export.csv`, { headers: auth() });
    assert.equal(exported.status, 200);
    assert.match(exported.body.toString(), /이 배치도를 3D 재현 근거로 검토/);
    assert.equal(JSON.parse(await readFile(infoFile, 'utf8')).pid, pid, 'page navigation and saves must reuse the private helper');
    assert.equal(await readFile(path.join(fixture.cache, 'meta.json'), 'utf8'), fixture.metadata);
    await assert.rejects(stat(path.join(fixture.app, 'unexpected-conversion.txt')), { code: 'ENOENT' });
  });

  await t.test('closing the common server stops its helper and preserves saved discussion for restart', async () => {
    await closeServer(server);
    await waitUntil(() => !alive(pid), 'The drawing helper remained alive after the workspace closed.');
    server = await startServer({ root: fixture.root, port: 0 });
    const nextPort = server.address().port;
    const bootstrap = json(await request(nextPort, `${prefix}/api/bootstrap`));
    assert.equal(bootstrap.token, token, 'reopening the workspace must retain its access state');
    const detail = json(await request(nextPort, `${prefix}/api/drawings/${fixture.id}`, { headers: auth() }));
    assert.equal(detail.state.starred, true);
    assert.equal(detail.state.status, 'discuss');
    assert.equal(detail.comments.length, 1);
    const nextPid = JSON.parse(await readFile(infoFile, 'utf8')).pid;
    assert.equal(alive(nextPid), true);
    await closeServer(server);
    await waitUntil(() => !alive(nextPid), 'The reopened drawing helper remained alive after close.');
  });
});

const windowsVenv = path.join(os.homedir(), 'venvs', 'workstation-tools', 'Scripts', 'python.exe');
const hasWindowsVenv = process.platform === 'win32' && await stat(windowsVenv).then((entry) => entry.isFile(), () => false);

test('Windows virtualenv launcher can publish a different service PID and both processes stop on close', {
  timeout: 30000,
  skip: hasWindowsVenv ? false : 'The Windows workstation Python virtualenv is unavailable.',
}, async (t) => {
  const fixture = await makeFixture();
  const previousPython = process.env.DRAWING_REVIEW_PYTHON;
  const observedFile = path.join(fixture.app, 'data', 'fixture-process.json');
  let server;
  t.after(async () => {
    await closeServer(server);
    await server?.drawingReview.close();
    // Also clean the fixture child when a readiness regression fails before the
    // bridge has learned its real PID. This never inspects production processes.
    const observed = await readFile(observedFile, 'utf8').then(JSON.parse, () => null);
    if (observed?.pid && observed.pid !== process.pid && alive(observed.pid)) {
      process.kill(observed.pid);
      await waitUntil(() => !alive(observed.pid), 'The isolated regression fixture could not be stopped.');
    }
    if (previousPython === undefined) delete process.env.DRAWING_REVIEW_PYTHON;
    else process.env.DRAWING_REVIEW_PYTHON = previousPython;
    assert.ok(path.basename(fixture.root).startsWith('heechang-drawing-review-'));
    await rm(fixture.root, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
  });
  // Record the real interpreter's parent in the isolated copy only. Windows
  // virtualenv redirectors may keep a launcher alive above that interpreter.
  const backend = path.join(fixture.app, 'server.py');
  const source = await readFile(backend, 'utf8');
  await writeFile(backend, source.replace('if __name__ == "__main__":',
    '(APP / "data" / "fixture-process.json").write_text(json.dumps({"pid": os.getpid(), "parentPid": os.getppid()}), encoding="utf-8")\n\nif __name__ == "__main__":'));
  process.env.DRAWING_REVIEW_PYTHON = windowsVenv;
  server = await startServer({ root: fixture.root, port: 0 });
  const port = server.address().port;
  const bootstrap = json(await request(port, `${prefix}/api/bootstrap`));
  assert.equal(bootstrap.catalogCount, 1);
  const observed = JSON.parse(await readFile(observedFile, 'utf8'));
  const metadata = JSON.parse(await readFile(path.join(fixture.app, 'data', 'server.json'), 'utf8'));
  assert.equal(metadata.pid, observed.pid);
  assert.equal(alive(observed.pid), true);
  const ownedPids = [observed.pid];
  if (observed.parentPid !== process.pid) {
    assert.equal(alive(observed.parentPid), true, 'the virtualenv redirector should remain alive while its service runs');
    assert.notEqual(observed.parentPid, observed.pid);
    ownedPids.push(observed.parentPid);
    t.diagnostic('Verified a Windows virtualenv redirector with a different service PID.');
  }
  const catalog = json(await request(port, `${prefix}/api/catalog`, { headers: { 'X-Review-Token': bootstrap.token } }));
  assert.equal(catalog.items[0].id, fixture.id);
  await closeServer(server);
  await waitUntil(() => ownedPids.every((pid) => !alive(pid)), 'The virtualenv launcher or its actual Python service survived workspace close.');
});
