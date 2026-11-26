import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { zipSingleFile } from './zip-single-file.mjs';
import { renderShareShell } from './share-shell.mjs';

const root = new URL('../', import.meta.url);
const args = process.argv.slice(2);
const hostedDirectory = args[0] === '--hosted' ? args[1] : null;
if (args[0] === '--hosted' && (args.length !== 2 || !hostedDirectory || !path.isAbsolute(hostedDirectory))) {
  throw new Error('Usage: node tooling/export-share.mjs --hosted <absolute-directory>');
}
// The portable model contains only the site viewer. Drawing review stays local
// because it uses the original files and its separate review server.
const viewers = [
  { id: 'site', label: '3D 지도', exporter: 'export-site.mjs' },
];
// Build intermediate viewers outside the workspace, retaining only the requested
// final HTML. Temporary data is removed even if a child exporter fails.
async function buildViewers() {
  const temporaryRoot = path.resolve(tmpdir());
  const staging = await mkdtemp(path.join(temporaryRoot, 'dryer-share-'));
  try {
    for (const { id, exporter } of viewers) {
      const result = spawnSync(process.execPath, [fileURLToPath(new URL(exporter, import.meta.url)), path.join(staging, `${id}.html`)], { encoding: 'utf8', windowsHide: true });
      if (result.status !== 0) throw new Error(result.stderr || result.stdout || `Export failed: ${exporter}`);
    }
    return Object.fromEntries(await Promise.all(viewers.map(async ({ id }) => [id, await readFile(path.join(staging, `${id}.html`), 'utf8')])));
  } finally {
    if (path.dirname(path.resolve(staging)) !== temporaryRoot || !path.basename(staging).startsWith('dryer-share-')) {
      throw new Error('Temporary export path is outside the expected directory.');
    }
    await rm(staging, { recursive: true, force: true });
  }
}
const bundled = await buildViewers();
bundled.site = bundled.site.replace('<head>', '<head><base href="about:srcdoc">').replace('</head>', '<style>.map-header{display:none!important}</style></head>');
for (const [name, html] of Object.entries(bundled)) {
  if (/<(?:script|link)\b[^>]+(?:src|href)=["'](?!data:|#)/i.test(html) || /dryer-workspace:navigate/.test(html)) {
    throw new Error(`Shared viewer contains an unexpected external module: ${name}`);
  }
}
const html = renderShareShell(viewers, bundled);
if (hostedDirectory) {
  const files = new Map([
    ['index.html', Buffer.from(renderShareShell(viewers, bundled, { hosted: true }))],
    // An empty href resolves hosted fragment links against this viewer's URL.
    ...viewers.map(({ id }) => [`viewers/${id}.html`, Buffer.from(bundled[id].replace(/<base\s+href=["']about:srcdoc["']\s*>/gi, '<base href="">'))]),
    ['downloads/dryer-workspace.zip', zipSingleFile('건조기-통합-공유.html', Buffer.from(html))],
  ]);
  for (const [filename, bytes] of files) {
    if (bytes.length >= 25 * 1024 * 1024) throw new Error(`Hosted file exceeds the 25 MiB asset limit: ${filename} (${bytes.length} bytes).`);
  }
  await Promise.all([...files].map(async ([filename, bytes]) => {
    const target = path.join(hostedDirectory, filename);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }));
  console.log(`Created hosted workspace in ${hostedDirectory}: ${[...files].map(([name, bytes]) => `${name} (${bytes.length.toLocaleString()} bytes)`).join(', ')}.`);
} else {
const output = args[0] ? pathToFileURL(path.resolve(args[0])) : new URL('exports/건조기-통합-공유.html', root);
const directory = new URL('./', output);
await mkdir(directory, { recursive: true });
await writeFile(output, html, 'utf8');
console.log(`Created ${fileURLToPath(output)} (${Buffer.byteLength(html).toLocaleString()} bytes).`);
console.log('Site model only. All scripts, styles and model data included. No server or installation required.');
}
