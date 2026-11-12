import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { inspectAssetIndex } from './index-assets.mjs';
import { inspectSiteAssets } from './check-assets.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const failures = [];
// These URLs are served by the common server rather than a same-named folder.
const serverRoutes = new Map([['/drawing-review/', '근거 자료/도면검토앱/public/index.html']]);
// production-pc-offload-before-metadata is a receipt: the catalog as it stood just
// before its 4,295 local files were moved to Drive. Its links are meant to be dead.
const skipped = new Set(['vendor', 'node_modules', '.sites-runtime', '.openai', '.backups', 'production-pc-offload-before-metadata']);
async function walk(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (skipped.has(entry.name)) continue;
    const file = path.join(directory, entry.name);
    files.push(...(entry.isDirectory() ? await walk(file) : [file]));
  }
  return files;
}
async function referenceExists(file, reference) {
  if (!reference || /^(?:[a-z][a-z\d+.-]*:|#|\/\/)/i.test(reference)) return;
  const pathname = decodeURIComponent(reference.split(/[?#]/)[0]);
  if (!pathname) return;
  const target = serverRoutes.has(pathname) ? path.join(root, serverRoutes.get(pathname)) :
    pathname.startsWith('/') ? path.join(root, pathname) : path.resolve(path.dirname(file), pathname);
  try { await access(target); }
  catch { failures.push(`${path.relative(root, file)} → 파일 없음: ${reference}`); }
}

for (const required of ['index.html', 'apps/site/index.html', 'apps/drawings/index.html', 'apps/shared/vendor/three.module.js', 'apps/shared/vendor/THREE-LICENSE.txt']) {
  try { await access(path.join(root, required)); }
  catch { failures.push(`필수 파일 없음: ${required}`); }
}
for (const launcher of ['프로젝트 실행.cmd']) {
  try {
    const source = await readFile(path.join(root, launcher), 'utf8');
    if (source.startsWith('\uFEFF') || /(?<!\r)\n/.test(source)) {
      failures.push(`${launcher}: Windows 실행기는 BOM 없는 UTF-8과 CRLF 줄바꿈을 사용해야 합니다.`);
    }
  } catch { failures.push(`실행 파일 없음: ${launcher}`); }
}
const files = [path.join(root, 'index.html')];
for (const directory of ['apps', 'workspace', 'tooling']) {
  try { files.push(...await walk(path.join(root, directory))); }
  catch (error) { failures.push(`${directory}: ${error.message}`); }
}
let scripts = 0;
for (const file of files) {
  const ext = path.extname(file);
  if (!['.html', '.js', '.mjs', '.css'].includes(ext)) continue;
  let source;
  try { source = await readFile(file, 'utf8'); }
  catch { continue; }
  if (['.js', '.mjs'].includes(ext)) {
    scripts++;
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8', windowsHide: true });
    if (result.status !== 0) failures.push(result.stderr || `JavaScript 문법 오류: ${file}`);
    // Build tools also contain quoted import statements for generated output.
    // Inspect source statements, excluding those literal template fragments.
    const imports = [
      ...source.matchAll(/^\s*(?:import|export)\s+(?:[^'";]+?\s+from\s*)?['"]([^'"]+)['"]/gm),
      ...source.matchAll(/^[^'"`\n]*?\bimport\s*\(\s*['"]([^'"]+)['"]/gm),
    ];
    for (const match of imports) {
      if (match[1].startsWith('.')) await referenceExists(file, match[1]);
    }
  } else if (ext === '.html') {
    for (const match of source.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/g)) await referenceExists(file, match[1]);
  } else {
    for (const match of source.matchAll(/(?:@import\s+(?:url\(\s*)?["']([^"']+)["']|url\(\s*["']?([^\s)'";]+))/g)) {
      await referenceExists(file, match[1] || match[2]);
    }
  }
}
failures.push(...await inspectSiteAssets({ root }));
failures.push(...await inspectAssetIndex());
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else console.log(`검사 완료: JavaScript ${scripts}개 문법, 로컬 모듈·HTML·CSS 경로, 자산 목록·이미지·참조 및 필수 파일.`);
