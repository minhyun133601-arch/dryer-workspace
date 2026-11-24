import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { fileURLToPath } from 'node:url';
import { startServer, startWorkspaceServer, APPLICATION_ID, PROJECT_ROOT, workspaceId } from '../tooling/serve.mjs';
import { launchWorkspace, openBrowser } from '../tooling/launch.mjs';

function rawRequest(port, requestPath, method = 'GET') {
  return new Promise((resolve, reject) => {
    const request = http.request({ hostname: '127.0.0.1', port, path: requestPath, method }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks).toString() }));
    });
    request.on('error', reject);
    request.end();
  });
}

function launchAt(port, stateFile) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [fileURLToPath(new URL('../tooling/launch.mjs', import.meta.url)), '--no-browser'], {
      env: { ...process.env, PORT: String(port), WORKSPACE_STATE_FILE: stateFile }, windowsHide: true,
    });
    let output = '';
    const timeout = setTimeout(() => { child.kill(); reject(new Error('Launcher did not finish within five seconds.')); }, 5000);
    child.stdout.setEncoding('utf8').on('data', (chunk) => { output += chunk; });
    child.stderr.setEncoding('utf8').on('data', (chunk) => { output += chunk; });
    child.once('error', (error) => { clearTimeout(timeout); reject(error); });
    child.once('exit', (code) => { clearTimeout(timeout); resolve({ code, output }); });
  });
}

async function closeServer(server) {
  if (!server?.listening) return;
  await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); });
}

function startCliAt(script, port, stateFile) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [fileURLToPath(new URL(`../tooling/${script}`, import.meta.url)), '--no-browser'], {
      env: { ...process.env, PORT: String(port), WORKSPACE_STATE_FILE: stateFile }, windowsHide: true,
    });
    let output = '', settled = false;
    const timeout = setTimeout(() => { child.kill(); fail(new Error(`CLI server did not become ready: ${output}`)); }, 8000);
    const fail = (error) => { if (!settled) { settled = true; clearTimeout(timeout); reject(error); } };
    const consume = (chunk) => {
      output += chunk;
      const match = output.match(/http:\/\/127\.0\.0\.1:(\d+)/);
      if (!settled && match) {
        settled = true; clearTimeout(timeout);
        resolve({ child, port: Number(match[1]), output });
      }
    };
    child.stdout.setEncoding('utf8').on('data', consume);
    child.stderr.setEncoding('utf8').on('data', consume);
    child.once('error', fail);
    child.once('exit', (code) => fail(new Error(`CLI exited before starting (${code}): ${output}`)));
  });
}

test('modeling server serves site, drawing and shared assets while blocking private and escaping paths', async (t) => {
  const fixture = await mkdtemp(path.join(os.tmpdir(), 'dryer-runtime-'));
  for (const directory of ['apps/site/share', 'apps/site/documents', 'apps/drawings/references', 'apps/shared/vendor',
    'workspace', '.backups', 'tooling', 'assets', 'references/모델링 원본', 'exports']) {
    await mkdir(path.join(fixture, directory), { recursive: true });
  }
  for (const [file, body] of Object.entries({
    'index.html': '<title>희창유업 3D 모델링 작업실</title>',
    'apps/site/index.html': '<title>희창유업 현장 3D</title>',
    'apps/site/app.js': 'export const site = true;',
    'apps/site/share/index.html': '<title>3D 모델 공유</title>',
    'apps/drawings/index.html': '<title>모델링 도면</title>',
    'apps/drawings/app.js': 'export const drawings = true;',
    'apps/shared/vendor/three.module.js': 'export const shared = true;',
    'workspace/app.mjs': 'export const workspace = true;',
    'assets/photo.png': 'image',
    'package.json': '{}',
    '.backups/original.zip': 'private',
    'tooling/private.mjs': 'private',
    'control-panel-parts-map.html': '<title>기존 제어반 진입점</title>',
    'part-details.html': '<title>기존 상세 진입점</title>',
    'apps/site/documents/현장 도면.pdf': 'drawing-pdf',
    'apps/drawings/references/설비 수량.xls': 'equipment-counts',
    'apps/drawings/references/설비 목록.xlsx': 'equipment-list',
    'references/모델링 원본/private.py': 'private',
    'references/모델링 원본/미공개 설비.dwg': 'private',
    'references/모델링 원본/미공개 도면.pdf': 'private',
    'exports/건조기-통합-공유.html': '<title>희창유업 3D 모델링 공유</title>',
    'exports/private.zip': 'private',
  })) await writeFile(path.join(fixture, file), body);
  const server = await startServer({ root: fixture, port: 0 });
  const port = server.address().port;
  t.after(async () => {
    await new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); });
    await rm(fixture, { recursive: true, force: true });
  });
  const health = await rawRequest(port, '/__workspace');
  assert.equal(health.status, 200);
  assert.equal(JSON.parse(health.body).application, APPLICATION_ID);
  assert.equal(JSON.parse(health.body).workspace, workspaceId(fixture));
  for (const route of ['/', '/apps/site/?floor=outdoor', '/apps/site/share/', '/apps/drawings/']) {
    const response = await rawRequest(port, route);
    assert.equal(response.status, 200, route);
    assert.match(response.headers['content-type'], /text\/html/);
  }
  for (const route of ['/apps/shared/vendor/three.module.js', '/apps/drawings/app.js', '/apps/site/app.js', '/workspace/app.mjs']) {
    const response = await rawRequest(port, route);
    assert.equal(response.status, 200);
    assert.match(response.headers['content-type'], /text\/javascript/);
    assert.equal(response.headers['cross-origin-resource-policy'], 'same-origin');
  }
  const head = await rawRequest(port, '/assets/photo.png', 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(head.body, '');
  assert.equal(head.headers['content-length'], '5');
  assert.equal(head.headers['content-type'], 'image/png');
  for (const [route, mime] of [
    ['/apps/site/documents/현장 도면.pdf', 'application/pdf'],
    ['/apps/drawings/references/설비 수량.xls', 'application/vnd.ms-excel'],
    ['/apps/drawings/references/설비 목록.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    ['/exports/건조기-통합-공유.html?viewer=site', 'text/html'],
  ]) {
    const response = await rawRequest(port, encodeURI(route));
    assert.equal(response.status, 200, route);
    assert.ok(response.headers['content-type'].startsWith(mime), route);
  }
  assert.equal((await rawRequest(port, '/', 'POST')).status, 405);
  for (const route of ['/package.json', '/tooling/private.mjs', '/missing.html', '/control-panel-parts-map.html', '/part-details.html?part=plc-cpu', '/motor-lab/',
    '/apps/panel/', '/apps/motor/', '/apps/heat-exchanger/', '/references/열교환기/00_자료열기.html',
    '/references/모델링 원본/private.py', '/references/모델링 원본/미공개 설비.dwg', '/references/모델링 원본/미공개 도면.pdf', '/exports/private.zip']) {
    assert.equal((await rawRequest(port, encodeURI(route))).status, 404, route);
  }
  for (const route of ['/.backups/original.zip', '/apps/../package.json', '/apps/%2e%2e/package.json', '/apps/%2E%2E%2Fpackage.json']) {
    assert.equal((await rawRequest(port, route)).status, 403, route);
  }
  for (const route of ['/apps/%5c..%5cpackage.json', '/apps/%00', '/apps/%ZZ', '/apps/site/index.html:stream']) {
    assert.equal((await rawRequest(port, route)).status, 400, route);
  }
  const installed = async () => JSON.parse((await rawRequest(port, '/__workspace')).body).optionalModules;
  assert.deepEqual(await installed(), []);
  await mkdir(path.join(fixture, 'apps/motor'));
  const optionalEntry = path.join(fixture, 'apps/motor/index.html');
  await writeFile(optionalEntry, '<html lang="ko"><title>모터 분해도</title></html>');
  assert.deepEqual(await installed(), ['motor']);
  assert.equal((await rawRequest(port, '/apps/motor/index.html')).status, 200);
  await rm(optionalEntry);
  assert.deepEqual(await installed(), []);
});

test('launcher reuses only the same workspace server without changing storage origin', async (t) => {
  const stateDirectory = await mkdtemp(path.join(os.tmpdir(), 'dryer-launch-state-'));
  const server = await startServer({ root: PROJECT_ROOT, port: 0 });
  t.after(async () => { await closeServer(server); await rm(stateDirectory, { recursive: true, force: true }); });
  const result = await launchAt(server.address().port, path.join(stateDirectory, 'state.json'));
  assert.equal(result.code, 0, result.output);
  assert.match(result.output, /이미 실행 중인 건조기 통합 작업실/);
  const port = server.address().port;
  assert.equal((await rawRequest(port, '/__workspace')).status, 200);
  const modeling = await rawRequest(port, '/apps/site/?floor=outdoor');
  assert.equal(modeling.status, 200);
  assert.match(modeling.headers['content-type'], /text\/html/);
  assert.match(modeling.body, /<title>[^<]*희창[^<]*3D/);
  for (const route of ['/control-panel-parts-map.html', '/part-details.html', '/motor-lab/']) {
    assert.equal((await rawRequest(port, route)).status, 404, route);
  }
});

test('each repeated launch opens the browser while reusing the running workspace', async (t) => {
  const server = await startServer({ root: PROJECT_ROOT, port: 0 });
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  const port = server.address().port, opened = [];
  const options = { port, stateFile: null, argv: ['--module=site'], open: async (url) => opened.push(url) };
  for (let click = 0; click < 2; click++) {
    const result = await launchWorkspace(options);
    assert.equal(result.reused, true);
    assert.equal(result.server, null, 'a repeated click must not start another server');
    assert.equal((await rawRequest(port, '/__workspace')).status, 200);
  }
  assert.deepEqual(opened, [`http://127.0.0.1:${port}/#/site`, `http://127.0.0.1:${port}/#/site`]);
});

test('a foreign server and misleading saved identity are skipped without interrupting the other workspace', async (t) => {
  const fixture = await mkdtemp(path.join(os.tmpdir(), 'dryer-port-foreign-'));
  const foreign = await startServer({ root: fixture, port: 0 });
  let actual;
  t.after(async () => { await closeServer(actual?.server); await closeServer(foreign); await rm(fixture, { recursive: true, force: true }); });
  const preferred = foreign.address().port, stateFile = path.join(fixture, 'state.json');
  const before = JSON.parse((await rawRequest(preferred, '/__workspace')).body);
  await writeFile(stateFile, JSON.stringify({
    application: APPLICATION_ID, workspace: workspaceId(PROJECT_ROOT), requestedPort: preferred, port: preferred,
  }));
  actual = await startWorkspaceServer({ root: PROJECT_ROOT, port: preferred, stateFile });
  assert.notEqual(actual.port, preferred, 'the foreign listener must not be reused even when the cache claims this workspace');
  assert.ok(actual.server?.listening);
  assert.equal(actual.reused, false);
  assert.equal(actual.url, `http://127.0.0.1:${actual.port}`);
  assert.equal(actual.server.address().port, actual.port);
  assert.equal(JSON.parse((await rawRequest(actual.port, '/__workspace')).body).workspace, workspaceId(PROJECT_ROOT));
  assert.deepEqual(JSON.parse((await rawRequest(preferred, '/__workspace')).body), before, 'the original service must remain untouched');
});

test('fallback launches keep the same saved browser origin after the preferred port becomes free and after restart', async (t) => {
  const fixture = await mkdtemp(path.join(os.tmpdir(), 'dryer-port-origin-'));
  const foreign = await startServer({ root: fixture, port: 0 });
  const preferred = foreign.address().port, stateFile = path.join(fixture, 'nested', 'state.json'), opened = [];
  const owned = [];
  t.after(async () => {
    for (const server of owned) await closeServer(server);
    await closeServer(foreign); await rm(fixture, { recursive: true, force: true });
  });
  const options = { port: preferred, stateFile, argv: ['--module=site'], open: async (url) => opened.push(url) };
  const first = await launchWorkspace(options); owned.push(first.server);
  assert.equal(first.reused, false);
  assert.notEqual(first.port, preferred);
  assert.equal(first.url, `http://127.0.0.1:${first.port}`);
  await closeServer(foreign);
  const repeated = await launchWorkspace(options);
  assert.equal(repeated.reused, true, 'a free default port must not split browser storage from the existing fallback');
  assert.equal(repeated.server, null);
  assert.equal(repeated.port, first.port);
  const saved = JSON.parse(await readFile(stateFile, 'utf8'));
  assert.equal(saved.application, APPLICATION_ID);
  assert.equal(saved.workspace, workspaceId(PROJECT_ROOT));
  assert.equal(saved.requestedPort, preferred);
  assert.equal(saved.port, first.port);
  await closeServer(first.server);
  const restarted = await launchWorkspace(options); owned.push(restarted.server);
  assert.equal(restarted.reused, false);
  assert.equal(restarted.port, first.port, 'a stopped fallback server must restart at its saved origin');
  assert.deepEqual(opened, Array(3).fill(`${first.url}/#/site`), 'each launch must open the actual stable module URL');
});

test('serve CLI automatically starts on a free port when its requested port belongs to another workspace', async (t) => {
  const fixture = await mkdtemp(path.join(os.tmpdir(), 'dryer-port-cli-'));
  const foreign = await startServer({ root: fixture, port: 0 });
  let cli;
  t.after(async () => {
    if (cli?.child.exitCode === null) {
      const exited = new Promise((resolve) => cli.child.once('exit', resolve));
      cli.child.kill(); await exited;
    }
    await closeServer(foreign); await rm(fixture, { recursive: true, force: true });
  });
  const preferred = foreign.address().port;
  cli = await startCliAt('serve.mjs', preferred, path.join(fixture, 'cli-state.json'));
  assert.notEqual(cli.port, preferred);
  assert.doesNotMatch(cli.output, /포트를 사용 중입니다|다른 프로그램.*종료/);
  assert.equal(JSON.parse((await rawRequest(cli.port, '/__workspace')).body).workspace, workspaceId(PROJECT_ROOT));
  assert.equal(JSON.parse((await rawRequest(preferred, '/__workspace')).body).workspace, workspaceId(fixture));
});

test('when all nearby ports are occupied the operating system assigns a usable address', async (t) => {
  const fixture = await mkdtemp(path.join(os.tmpdir(), 'dryer-port-range-'));
  const first = await startServer({ root: fixture, port: 0 });
  const preferred = first.address().port, foreignServers = [first];
  let actual;
  t.after(async () => {
    await closeServer(actual?.server);
    for (const server of foreignServers) await closeServer(server);
    await rm(fixture, { recursive: true, force: true });
  });
  const candidates = Array.from({ length: Math.min(12, 65536 - preferred) }, (_, index) => preferred + index);
  for (const port of candidates.slice(1)) {
    try { foreignServers.push(await startServer({ root: fixture, port })); }
    catch (error) { if (!['EADDRINUSE', 'EACCES'].includes(error.code)) throw error; }
  }
  actual = await startWorkspaceServer({ port: preferred, stateFile: null });
  assert.equal(actual.reused, false);
  assert.ok(actual.server?.listening);
  assert.equal(candidates.includes(actual.port), false, 'the final automatic allocation must bypass the occupied nearby range');
  assert.ok(actual.port > 0 && actual.port <= 65535);
  assert.equal(actual.url, `http://127.0.0.1:${actual.port}`);
  assert.equal(JSON.parse((await rawRequest(actual.port, '/__workspace')).body).workspace, workspaceId(PROJECT_ROOT));
});

test('simultaneous launches bind once and reuse the same workspace rather than racing into an error', async (t) => {
  const reservation = await startServer({ port: 0 });
  const preferred = reservation.address().port;
  await closeServer(reservation);
  const results = [];
  t.after(async () => { for (const result of results) await closeServer(result.server); });
  const outcomes = await Promise.allSettled([
    startWorkspaceServer({ port: preferred, stateFile: null }),
    startWorkspaceServer({ port: preferred, stateFile: null }),
  ]);
  for (const outcome of outcomes) if (outcome.status === 'fulfilled') results.push(outcome.value);
  assert.ok(outcomes.every(({ status }) => status === 'fulfilled'), 'both launch attempts must finish without an address error');
  assert.equal(results.filter(({ server }) => server).length, 1, 'only one launch should own a newly created server');
  assert.equal(results.filter(({ reused }) => reused).length, 1);
  assert.equal(results[0].port, results[1].port);
  assert.equal(results[0].url, results[1].url);
});

test('Windows browser requests wait for the default-browser handoff and respect no-browser mode', async () => {
  const children = [], requests = [];
  const spawnBrowser = (command, args, options) => {
    const child = new EventEmitter(); children.push(child); requests.push({ command, args, options }); return child;
  };
  const url = 'http://127.0.0.1:4173/#/site';
  let handedOff = false;
  const opening = openBrowser(url, { argv: [], platform: 'win32', spawnBrowser }).then(() => { handedOff = true; });
  await Promise.resolve();
  assert.equal(handedOff, false, 'the launcher must not exit before Windows has opened the URL');
  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0].args, ['/d', '/s', '/c', `start "" "${url}"`]);
  assert.equal(requests[0].options.windowsHide, true);
  assert.equal(requests[0].options.windowsVerbatimArguments, true);
  children[0].emit('exit', 0);
  await opening;
  assert.equal(handedOff, true);
  assert.equal(await openBrowser(url, { argv: ['--no-browser'], platform: 'win32', spawnBrowser }), false);
  assert.equal(requests.length, 1);
});
