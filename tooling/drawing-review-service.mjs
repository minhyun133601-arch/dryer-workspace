import http from 'node:http';
import path from 'node:path';
import { mkdir, readFile, realpath, unlink } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

const PREFIX = '/drawing-review';
const APPLICATION = 'heechang-drawing-review';

// The app source stays private in tooling. Drawings, previews, discussions and
// conversion tools may live in the external archive; this loopback helper is
// started on demand without launching a converter or another public port.
export function createDrawingReviewService({ root }) {
  let child = null, servicePid = null, opening = null, endpoint = null, closed = false, hasExitHook = false;
  const project = path.resolve(root);
  const app = path.join(project, 'tooling', 'drawing-review');
  const storageConfig = path.join(project, 'docs', 'drawing-storage.json');
  const storageOverrides = { originals: process.env.DRAWING_REVIEW_ROOT, cache: process.env.DRAWING_REVIEW_CACHE,
    data: process.env.DRAWING_REVIEW_DATA, tools: process.env.DRAWING_REVIEW_TOOLS };
  const readyFile = path.join(project, 'tmp', `drawing-review-${process.pid}-${randomUUID()}.json`);
  const removeReady = () => unlink(readyFile).catch(() => {});
  const stopServiceProcess = () => {
    if (servicePid && servicePid !== child?.pid) { try { process.kill(servicePid); } catch {} }
    child?.kill();
  };
  const onProcessExit = () => { stopServiceProcess(); };

  async function storagePaths() {
    let config;
    try { config = JSON.parse((await readFile(storageConfig, 'utf8')).replace(/^\uFEFF/, '')); }
    catch (error) {
      if (error.code !== 'ENOENT') throw new Error('도면 보관 설정을 읽지 못했습니다. docs/drawing-storage.json을 확인해 주세요.');
    }
    if (config !== undefined && (!config || typeof config !== 'object' || Array.isArray(config))) {
      throw new Error('도면 보관 설정 형식이 올바르지 않습니다. docs/drawing-storage.json을 확인해 주세요.');
    }
    const defaults = { originals: path.join(project, '근거 자료', '건물3D 후보도면'),
      cache: path.join(app, 'cache'), data: path.join(app, 'data'), tools: path.join(app, 'tools') };
    const paths = {};
    for (const field of ['originals', 'cache', 'data', 'tools']) {
      const required = field === 'originals' || field === 'cache';
      const configured = config !== undefined && (required || Object.hasOwn(config, field));
      const value = storageOverrides[field] !== undefined ? storageOverrides[field] : configured ? config[field] : defaults[field];
      if (typeof value !== 'string' || !value.trim() || value.includes('\0')) {
        throw new Error(`도면 보관 설정의 ${field} 경로를 확인해 주세요.`);
      }
      paths[field] = path.resolve(project, value);
    }
    try { paths.originals = await realpath(paths.originals); }
    catch { throw new Error('도면 원본 보관 폴더를 찾지 못했습니다. 보관 위치와 도면 경로 설정을 확인해 주세요.'); }
    return paths;
  }

  async function open() {
    if (closed) throw new Error('도면 검토실이 종료되었습니다.');
    if (endpoint && child && child.exitCode === null && child.signalCode === null) return endpoint;
    if (opening) return opening;
    opening = (async () => {
      const storage = await storagePaths(), actualRoot = storage.originals;
      await mkdir(path.dirname(readyFile), { recursive: true });
      if (!hasExitHook) { process.once('exit', onProcessExit); hasExitHook = true; }
      const executable = process.env.DRAWING_REVIEW_PYTHON || 'python';
      child = spawn(executable, [path.join(app, 'server.py'), '--root', actualRoot,
        '--data', storage.data, '--cache', storage.cache,
        '--host', '127.0.0.1', '--port', '0', '--ready-file', readyFile], {
        cwd: app, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, DRAWING_REVIEW_TOOLS: storage.tools },
      });
      let failure = null;
      child.once('error', (error) => { failure = error; });
      child.stdout.resume(); child.stderr.resume();
      const startedChild = child;
      for (let attempt = 0; attempt < 150; attempt++) {
        if (failure || startedChild.exitCode !== null || startedChild.signalCode !== null || closed) break;
        let ready;
        try { ready = JSON.parse(await readFile(readyFile, 'utf8')); } catch {}
        // Windows virtual-environment launchers can own a different PID from
        // the Python interpreter. The unique readiness file and exact root
        // identify this service; retain its reported PID for reliable cleanup.
        if (ready?.application === APPLICATION && Number.isInteger(ready.pid) && ready.pid > 0 && ready.pid !== process.pid &&
            Number.isInteger(ready.port) && ready.port > 0 && ready.port <= 65535 &&
            path.resolve(ready.root).toLowerCase() === actualRoot.toLowerCase()) {
          servicePid = ready.pid;
          endpoint = { hostname: '127.0.0.1', port: ready.port };
          await removeReady();
          return endpoint;
        }
        await new Promise((resolve) => setTimeout(resolve, 80));
      }
      startedChild.kill();
      await removeReady();
      throw new Error('도면 검토실을 준비하지 못했습니다. Python 실행 환경과 도면 보관 경로를 확인해 주세요.');
    })();
    try { return await opening; }
    finally { opening = null; }
  }

  function sendError(res, code, message) {
    if (res.headersSent) { res.destroy(); return; }
    const body = JSON.stringify({ error: message });
    res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(body);
  }

  async function handle(req, res) {
    const raw = req.url || '/';
    const pathname = decodeURIComponent(raw.split('?')[0]);
    if (pathname === PREFIX) {
      res.writeHead(302, { Location: `${PREFIX}/`, 'Cache-Control': 'no-store' }); res.end(); return;
    }
    if (!pathname.startsWith(`${PREFIX}/`) || /[\\\0]/.test(pathname) || pathname.split('/').some((part) => part === '.' || part === '..')) {
      sendError(res, 400, '도면 경로를 확인해 주세요.'); return;
    }
    if (!['GET', 'HEAD', 'POST'].includes(req.method)) {
      sendError(res, 405, '지원하지 않는 요청입니다.'); return;
    }
    const origin = req.headers.origin;
    if (req.method === 'POST' && origin && origin !== `http://${req.headers.host}`) {
      sendError(res, 403, '프로젝트 화면에서 다시 시도해 주세요.'); return;
    }
    try {
      const address = await open();
      const proxy = http.request({ ...address, method: req.method === 'HEAD' ? 'GET' : req.method,
        path: raw.slice(PREFIX.length), headers: { ...req.headers, connection: 'close' },
      }, (response) => {
        const headers = { ...response.headers };
        if (headers['set-cookie']) headers['set-cookie'] = headers['set-cookie'].map((cookie) => cookie.replace(/Path=\//i, `Path=${PREFIX}/`));
        if (response.statusCode === 200 && raw.slice(PREFIX.length).split('?')[0] === '/api/share') {
          const chunks = [];
          response.on('data', (chunk) => chunks.push(chunk));
          response.on('end', () => {
            try {
              const shared = JSON.parse(Buffer.concat(chunks).toString('utf8'));
              const url = `http://${req.headers.host}${PREFIX}/`;
              const body = Buffer.from(JSON.stringify({ ...shared, urls: [url], localUrl: url, remoteAvailable: false }));
              delete headers['transfer-encoding']; headers['content-length'] = String(body.length);
              res.writeHead(200, headers); res.end(req.method === 'HEAD' ? undefined : body);
            } catch { sendError(res, 502, '도면 접속 정보를 확인하지 못했습니다.'); }
          });
          return;
        }
        res.writeHead(response.statusCode || 502, headers);
        if (req.method === 'HEAD') { response.resume(); res.end(); }
        else response.pipe(res);
      });
      proxy.on('error', () => sendError(res, 503, '도면 연결이 잠시 끊겼습니다. 새로고침해 주세요.'));
      proxy.setTimeout(60000, () => { proxy.destroy(); });
      req.on('aborted', () => proxy.destroy());
      req.pipe(proxy);
    } catch (error) {
      sendError(res, 503, error.message);
    }
  }

  async function close() {
    closed = true; endpoint = null;
    process.removeListener('exit', onProcessExit); hasExitHook = false;
    const running = child;
    if (running && running.exitCode === null) {
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 1500); timer.unref();
        running.once('exit', () => { clearTimeout(timer); resolve(); });
        stopServiceProcess();
      });
    }
    else stopServiceProcess();
    await removeReady();
  }
  return { handle, close };
}
