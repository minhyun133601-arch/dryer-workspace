import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

// A standalone presentation file opens directly to the furnace detail offline.
const output = process.argv[2] ? pathToFileURL(path.resolve(process.argv[2])) : new URL('../exports/건조기 7층 버너.html', import.meta.url);
const result = spawnSync(process.execPath, [fileURLToPath(new URL('./export-site.mjs', import.meta.url)), fileURLToPath(output)], { encoding: 'utf8', windowsHide: true });
if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'Furnace export failed.');
const html = await readFile(output, 'utf8');
if (!html.includes('<html lang="ko">')) throw new Error('Shared viewer document changed.');
await writeFile(output, html.replace('<html lang="ko">', '<html lang="ko" data-equipment="heater">').replace('<title>건조기 3D 지도</title>', '<title>건조기 7층 버너 · 구성 분해도</title>'), 'utf8');
console.log(`Created standalone furnace presentation: ${fileURLToPath(output)}`);
