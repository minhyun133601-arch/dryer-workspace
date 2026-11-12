import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE_ASSETS } from '../apps/site/asset-catalog.js';

const indexFile = new URL('../docs/asset-index.csv', import.meta.url);
const cell = value => '"' + String(value ?? '').replaceAll('"', '""') + '"';
export function renderAssetIndex(assets = SITE_ASSETS) {
  const rows = [
    ['ID', '분류', '설명', '앱 이미지 경로', '공유용 경로'],
    ...assets.map(asset => [asset.id, asset.category, asset.label,
      'apps/site/' + asset.path.slice(2), asset.sharePath ? 'apps/site/' + asset.sharePath.slice(2) : '']),
  ];
  // Excel opens the Korean labels correctly with a UTF-8 BOM.
  return '\uFEFF' + rows.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n';
}
export async function inspectAssetIndex() {
  try {
    return await readFile(indexFile, 'utf8') === renderAssetIndex() ? []
      : ['자산 목록 CSV가 최신이 아닙니다. npm run assets:index를 실행하세요.'];
  } catch (error) { return [`자산 목록 CSV를 읽을 수 없습니다: ${error.code || error.message}`]; }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) {
    const errors = await inspectAssetIndex();
    if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
    else console.log('자산 목록 CSV가 최신입니다.');
  } else {
    await writeFile(indexFile, renderAssetIndex());
    console.log(`자산 목록 갱신: docs/asset-index.csv (${SITE_ASSETS.length}건)`);
  }
}
