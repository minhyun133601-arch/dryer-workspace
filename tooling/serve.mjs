import http from 'node:http';
import path from 'node:path';
import { mkdir, readFile, realpath, rename, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createDrawingReviewService } from './drawing-review-service.mjs';
import { OPTIONAL_MODULES } from '../workspace/module-registry.js';
import { legacyAssetTarget } from '../apps/site/legacy-asset-paths.js';
import { renderCardPanel } from './card-panel-image.mjs';

export const DEFAULT_PORT = 4173;
export const APPLICATION_ID = 'dryer-workspace';
export const PROJECT_ROOT = fileURLToPath(new URL('../', import.meta.url));
const entryFiles = new Set([
  'index.html',
  'exports/건조기-통합-공유.html',
]);
const publicFolders = new Set(['apps', 'workspace', 'assets']);
const isPublicPath = (relative) => entryFiles.has(relative)
  || publicFolders.has(relative.split('/')[0]);
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8', '.pdf': 'application/pdf',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.zip': 'application/zip',
};

export function workspaceId(root) {
  return createHash('sha256').update(path.resolve(root).toLowerCase()).digest('hex').slice(0, 24);
}

export function configuredPort(value = process.env.PORT ?? DEFAULT_PORT, { allowZero = false } = {}) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < (allowZero ? 0 : 1) || port > 65535) {
    throw new Error('PORT는 1~65535 사이의 정수여야 합니다.');
  }
  return port;
}

export function preferredPort(value = process.env.PORT ?? DEFAULT_PORT) {
  try { return configuredPort(value); }
  catch { return DEFAULT_PORT; }
}

export async function createServer({ root = PROJECT_ROOT } = {}) {
  const publicRoot = await realpath(root);
  const identity = { application: APPLICATION_ID, version: 1, workspace: workspaceId(publicRoot) };
  const withinRoot = (file) => file === publicRoot || file.startsWith(publicRoot + path.sep);
  const drawingReview = createDrawingReviewService({ root: publicRoot });
  const cardPanels = new Map();
  const server = http.createServer(async (req, res) => {
    const headers = {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Cross-Origin-Resource-Policy': 'same-origin',
    };
    function send(status, body, type = 'text/plain; charset=utf-8', extra = {}) {
      const data = Buffer.isBuffer(body) ? body : Buffer.from(body);
      res.writeHead(status, { ...headers, 'Content-Type': type, 'Content-Length': data.length, ...extra });
      res.end(req.method === 'HEAD' ? undefined : data);
    }
    try {
      // Decode before normalizing: encoded Windows separators and parent segments
      // must not be able to escape a public folder.
      const pathname = decodeURIComponent((req.url || '/').split('?')[0]);
      if (!pathname.startsWith('/') || /[\\\0:]/.test(pathname)) {
        send(400, 'Bad request'); return;
      }
      const segments = pathname.split('/').filter(Boolean);
      if (segments.some((segment) => segment === '..' || segment.startsWith('.'))) {
        send(403, 'Forbidden'); return;
      }
      if (pathname === '/drawing-review' || pathname.startsWith('/drawing-review/')) {
        await drawingReview.handle(req, res); return;
      }
      if (!['GET', 'HEAD'].includes(req.method)) {
        send(405, 'Method not allowed', undefined, { Allow: 'GET, HEAD' }); return;
      }
      if (pathname === '/__workspace') {
        const installed = await Promise.all(OPTIONAL_MODULES.map(async ({ id, entry }) => {
          try {
            const file = await realpath(path.join(publicRoot, entry));
            const relative = path.relative(publicRoot, file).split(path.sep).join('/');
            return withinRoot(file) && isPublicPath(relative) && (await stat(file)).isFile() ? id : null;
          } catch (error) {
            if (['ENOENT', 'ENOTDIR', 'EACCES'].includes(error.code)) return null;
            throw error;
          }
        }));
        send(200, JSON.stringify({ ...identity, optionalModules: installed.filter(Boolean) }), mimeTypes['.json']); return;
      }
      let relative = segments.join('/') || 'index.html';
      let cardFace;
      if (relative.startsWith('apps/site/assets/')) {
        const target = legacyAssetTarget('./' + relative.slice('apps/site/'.length));
        if (target) {
          const [canonical, face] = target.split('#');
          relative = 'apps/site/' + canonical.slice(2);
          cardFace = face;
        }
      }
      if (!isPublicPath(relative)) {
        send(404, 'Not found'); return;
      }
      let file = path.resolve(publicRoot, relative);
      if (!withinRoot(file)) { send(403, 'Forbidden'); return; }
      if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
      file = await realpath(file);
      if (!withinRoot(file)) { send(403, 'Forbidden'); return; }
      const canonicalRelative = path.relative(publicRoot, file).split(path.sep).join('/');
      if (!isPublicPath(canonicalRelative)) {
        send(403, 'Forbidden'); return;
      }
      const body = await readFile(file);
      if (cardFace) {
        const sourceHash = createHash('sha256').update(body).digest('hex');
        const key = canonicalRelative + '#' + cardFace;
        if (cardPanels.get(key)?.sourceHash !== sourceHash) {
          cardPanels.set(key, { sourceHash, image: renderCardPanel(body, cardFace) });
        }
        const image = await cardPanels.get(key).image;
        send(200, image.body, image.type); return;
      }
      send(200, body, mimeTypes[path.extname(file).toLowerCase()] || 'application/octet-stream');
    } catch (error) {
      if (error instanceof URIError) send(400, 'Bad request');
      else if (['ENOENT', 'ENOTDIR', 'EISDIR'].includes(error.code)) send(404, 'Not found');
      else if (error.code === 'EACCES') send(403, 'Forbidden');
      else { console.error(error.message); send(500, 'Internal server error'); }
    }
  });
  server.workspaceIdentity = identity;
  server.drawingReview = drawingReview;
  server.once('close', () => { void drawingReview.close(); });
  return server;
}

export async function startServer({ root = PROJECT_ROOT, port = configuredPort() } = {}) {
  configuredPort(port, { allowZero: true });
  const server = await createServer({ root });
  await new Promise((resolve, reject) => {
    const onError = (error) => { error.workspaceListenFailure = true; reject(error); };
    server.once('error', onError);
    server.listen(port, '127.0.0.1', () => {
      server.removeListener('error', onError);
      resolve();
    });
  });
  return server;
}

// Keep the last working browser origin stable, including when the default port
// becomes available again. This is only a hint; server identity is checked live.
export async function startWorkspaceServer({
  root = PROJECT_ROOT, port = preferredPort(),
  stateFile = process.env.WORKSPACE_STATE_FILE || path.join(root, 'tmp', 'workspace-server.json'),
} = {}) {
  const requestedPort = configuredPort(port);
  const canonicalRoot = await realpath(root);
  const identity = { application: APPLICATION_ID, workspace: workspaceId(canonicalRoot) };
  let saved;
  if (stateFile) {
    try { saved = JSON.parse(await readFile(stateFile, 'utf8')); } catch {}
  }
  const cachedPort = saved?.application === identity.application && saved.workspace === identity.workspace &&
    saved.requestedPort === requestedPort && Number.isInteger(saved.port) && saved.port > 0 && saved.port <= 65535
    ? saved.port : null;
  const candidates = [...new Set([
    ...(cachedPort ? [cachedPort] : []),
    ...Array.from({ length: Math.min(12, 65536 - requestedPort) }, (_, index) => requestedPort + index),
    0,
  ])];
  const remember = async (actualPort) => {
    if (!stateFile) return;
    const temporary = `${stateFile}.${process.pid}.tmp`;
    try {
      await mkdir(path.dirname(stateFile), { recursive: true });
      await writeFile(temporary, JSON.stringify({ ...identity, requestedPort, port: actualPort }), 'utf8');
      await rename(temporary, stateFile);
    } catch {
      // A read-only cache must never stop an otherwise working local server.
    }
  };
  for (const candidate of candidates) {
    let server;
    try { server = await startServer({ root: canonicalRoot, port: candidate }); }
    catch (error) {
      if (!error.workspaceListenFailure || !['EADDRINUSE', 'EACCES'].includes(error.code) || candidate === 0) throw error;
      let running;
      try {
        const response = await fetch(`http://127.0.0.1:${candidate}/__workspace`, {
          signal: AbortSignal.timeout(600), redirect: 'error',
        });
        if (response.ok) running = await response.json();
      } catch {}
      if (running?.application !== identity.application || running.workspace !== identity.workspace) continue;
      await remember(candidate);
      return { server: null, reused: true, port: candidate, url: `http://127.0.0.1:${candidate}` };
    }
    const actualPort = server.address().port;
    await remember(actualPort);
    return { server, reused: false, port: actualPort, url: `http://127.0.0.1:${actualPort}` };
  }
}

export function installShutdown(server) {
  const handlers = [];
  for (const signal of ['SIGINT', 'SIGTERM']) {
    const handler = () => {
      server.close(() => process.exit(0));
      server.closeIdleConnections();
    };
    handlers.push([signal, handler]); process.once(signal, handler);
  }
  server.once('close', () => { for (const [signal, handler] of handlers) process.removeListener(signal, handler); });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { server, reused, url } = await startWorkspaceServer();
    if (server) installShutdown(server);
    console.log(`${reused ? '이미 실행 중인 ' : ''}건조기 통합 작업실: ${url}`);
    if (server) console.log('종료하려면 Ctrl+C를 누르세요.');
  } catch (error) {
    console.error(`통합 작업실을 시작하지 못했습니다: ${error.message}`);
    process.exitCode = 1;
  }
}
