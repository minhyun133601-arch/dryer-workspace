import { readFile, readdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SITE_ASSETS } from '../apps/site/asset-catalog.js';

const repoRoot = fileURLToPath(new URL('../', import.meta.url));
const imageExtension = /\.(?:jpe?g|png|svg)$/i;
const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const safeAssetPath = /^\.\/assets\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)*[a-z0-9]+(?:-[a-z0-9]+)*\.(?:jpe?g|png|svg)$/;

function validSignature(bytes, extension) {
  if (extension === '.jpg' || extension === '.jpeg') return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (extension === '.png') return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return /^(?:\uFEFF)?\s*(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*(?:<!DOCTYPE[^>]*>\s*)?<svg(?:\s|>)/i.test(bytes.subarray(0, 8192).toString('utf8'));
}

// Only data modules are evaluated; browser controllers and their functions are
// never executed. Exported arrays include paths generated with template strings.
const isDataModule = name => name === 'data.js' || name.endsWith('-data.js') || name === 'liquid-assets.js';

export async function inspectSiteAssets({ root = repoRoot, assets = SITE_ASSETS, legacyMoves } = {}) {
  const errors = [];
  const siteRoot = path.resolve(root, 'apps/site');
  const assetsRoot = path.join(siteRoot, 'assets');
  const ids = new Set();
  const registered = new Set();
  const owners = new Map();
  if (legacyMoves === undefined) {
    try {
      const receipt = JSON.parse(await readFile(path.resolve(root, 'docs/asset-organization-20261112.json'), 'utf8'));
      legacyMoves = receipt.moves;
    } catch (error) {
      if (error.code !== 'ENOENT') errors.push(`자산 이동 기록 확인 실패: ${error.message}`);
      legacyMoves = [];
    }
  }
  const movedPhotos = new Map((Array.isArray(legacyMoves) ? legacyMoves : [])
    .filter(move => typeof move?.originalPath === 'string' && move.originalPath.startsWith('apps/site/photos/'))
    .map(move => [`./${move.originalPath.slice('apps/site/'.length)}`, move.currentPath]));
  const directoryCache = new Map();
  const directoryEntries = async directory => {
    if (!directoryCache.has(directory)) directoryCache.set(directory, await readdir(directory));
    return directoryCache.get(directory);
  };
  const registerPath = (reference, owner) => {
    if (typeof reference !== 'string' || !safeAssetPath.test(reference)) {
      errors.push(`${owner}: 잘못된 자산 경로(./assets/ 및 소문자 영문·숫자·하이픈 사용): ${String(reference)}`);
      return;
    }
    const folded = reference.toLowerCase();
    if (owners.has(folded)) errors.push(`${owner}: 중복 자산 경로 ${reference} (${owners.get(folded)})`);
    else owners.set(folded, owner);
    registered.add(reference);
  };
  if (!Array.isArray(assets)) return ['SITE_ASSETS는 배열이어야 합니다.'];
  for (const [index, asset] of assets.entries()) {
    const owner = `SITE_ASSETS[${index}]${asset?.id ? ` ${asset.id}` : ''}`;
    if (!asset || typeof asset !== 'object') { errors.push(`${owner}: 자산 항목은 객체여야 합니다.`); continue; }
    if (typeof asset.id !== 'string' || !slug.test(asset.id)) errors.push(`${owner}: 잘못된 자산 ID`);
    if (ids.has(asset.id)) errors.push(`${owner}: 중복 자산 ID ${asset.id}`);
    ids.add(asset.id);
    if (typeof asset.label !== 'string' || !asset.label.trim()) errors.push(`${owner}: 설명(label)이 없습니다.`);
    if (typeof asset.category !== 'string' || !asset.category.trim()) errors.push(`${owner}: 분류(category)가 없습니다.`);
    registerPath(asset.path, `${owner}.path`);
    if (asset.sharePath !== undefined) registerPath(asset.sharePath, `${owner}.sharePath`);
  }

  for (const reference of registered) {
    const relative = reference.slice(2);
    const file = path.join(siteRoot, ...relative.split('/'));
    try {
      let directory = siteRoot;
      let casingMatches = true;
      for (const segment of relative.split('/')) {
        const names = await directoryEntries(directory);
        if (!names.includes(segment)) {
          const actual = names.find(name => name.toLowerCase() === segment.toLowerCase());
          if (actual) errors.push(`자산 경로 대소문자 불일치: ${reference} (${segment} → ${actual})`);
          else errors.push(`자산 파일 없음: ${reference}`);
          casingMatches = false;
          break;
        }
        directory = path.join(directory, segment);
      }
      if (!casingMatches) continue;
      const resolved = await realpath(file);
      const relativeResolved = path.relative(assetsRoot, resolved);
      if (relativeResolved.startsWith(`..${path.sep}`) || relativeResolved === '..' || path.isAbsolute(relativeResolved)) {
        errors.push(`자산 파일이 assets 폴더 밖을 가리킵니다: ${reference}`);
        continue;
      }
      if (!(await stat(file)).isFile()) { errors.push(`자산 경로가 파일이 아닙니다: ${reference}`); continue; }
      const bytes = await readFile(file);
      if (!validSignature(bytes, path.extname(file))) errors.push(`자산 이미지 시그니처 불일치: ${reference}`);
    } catch (error) {
      errors.push(`자산 파일 확인 실패: ${reference} (${error.code || error.message})`);
    }
  }

  async function inspectDirectory(directory) {
    let entries;
    try { entries = await readdir(directory, { withFileTypes: true }); }
    catch (error) {
      if (error.code !== 'ENOENT') errors.push(`자산 폴더 확인 실패: ${directory} (${error.code || error.message})`);
      return;
    }
    for (const entry of entries) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) await inspectDirectory(file);
      else if (imageExtension.test(entry.name)) {
        const reference = `./${path.relative(siteRoot, file).split(path.sep).join('/')}`;
        if (!registered.has(reference)) errors.push(`등록되지 않은 자산 이미지: ${reference}`);
      }
    }
  }
  await inspectDirectory(assetsRoot);

  const reportedReferences = new Set();
  const inspectReference = (reference, origin) => {
    if (typeof reference !== 'string' || !imageExtension.test(reference)) return;
    if (movedPhotos.has(reference) && !reportedReferences.has(`${origin}:${reference}`)) {
      reportedReferences.add(`${origin}:${reference}`);
      errors.push(`${origin}: 이동 전 자산 참조 ${reference} → ${movedPhotos.get(reference)}`);
    } else if (reference.startsWith('./assets/') && !registered.has(reference) && !reportedReferences.has(`${origin}:${reference}`)) {
      reportedReferences.add(`${origin}:${reference}`);
      errors.push(`${origin}: 등록되지 않은 자산 참조 ${reference}`);
    }
  };
  let siteEntries;
  try { siteEntries = await readdir(siteRoot, { withFileTypes: true }); }
  catch (error) { errors.push(`현장 소스 폴더 확인 실패: ${error.code || error.message}`); return errors; }
  for (const entry of siteEntries) {
    if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
    const file = path.join(siteRoot, entry.name);
    const origin = `apps/site/${entry.name}`;
    const source = await readFile(file, 'utf8');
    // Deliberately exclude backtick literals and path prefixes used to build URLs.
    for (const match of source.matchAll(/(["'])(\.\/(?:assets|photos)\/[^"'`\r\n]+\.(?:jpe?g|png|svg))\1/g)) inspectReference(match[2], origin);
    if (!isDataModule(entry.name)) continue;
    try {
      const exports = await import(pathToFileURL(file).href);
      const seen = new WeakSet();
      function visit(value) {
        if (typeof value === 'string') { inspectReference(value, origin); return; }
        if (!value || typeof value !== 'object' || seen.has(value)) return;
        seen.add(value);
        for (const [key, child] of Object.entries(value)) { inspectReference(key, origin); visit(child); }
      }
      visit(exports);
    } catch (error) { errors.push(`${origin}: 데이터 자산 검사 실패 (${error.message})`); }
  }
  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = await inspectSiteAssets();
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
  else console.log(`자산 검사 완료: ${SITE_ASSETS.length}개 항목의 파일·명칭·시그니처·소스 참조.`);
}
