import { readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const tests = readdirSync(path.join(root, 'tests'))
  .filter((name) => /\.test\.(?:cjs|mjs)$/.test(name))
  .sort()
  .map((name) => path.join(root, 'tests', name));
// Expand files here so npm test also works on Windows and Node 20 shells.
const result = spawnSync(process.execPath, ['--test', ...process.argv.slice(2), ...tests], {
  cwd: root, stdio: 'inherit', windowsHide: true,
});
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
