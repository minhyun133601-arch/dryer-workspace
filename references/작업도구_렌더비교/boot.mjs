import path from 'node:path'; import fs from 'node:fs'; import { pathToFileURL } from 'node:url';
export async function boot({ storage = null, width = 1600, height = 1000 } = {}) {
  const PWDIR = process.env.PWDIR;
  const { chromium } = await import(pathToFileURL(path.join(PWDIR, 'index.mjs')).href);
  const { createServer } = await import(new URL('../../tooling/serve.mjs', import.meta.url).href);
  const server = await createServer(); await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const exe = path.join(process.env.LOCALAPPDATA, 'ms-playwright/chromium-1217/chrome-win64/chrome.exe');
  const browser = await chromium.launch({ headless: true, executablePath: fs.existsSync(exe) ? exe : undefined, args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width, height } });
  page.on('pageerror', e => console.log('PAGEERR', e.message)); page.on('console', m => { if (m.type()==='error') console.log('ERR', m.text()); });
  await page.route('**/apps/site/scene.js*', async route => { const r = await route.fetch(); let t = await r.text(); t = t.replace('return new FacilityScene(canvas, options);','globalThis.__THREE = THREE; return (globalThis.__scene = new FacilityScene(canvas, options));'); await route.fulfill({ response: r, body: t }); });
  if (storage) await page.addInitScript(v => localStorage.setItem('dryer-facility-layout-v1', v), storage);
  await page.goto(`http://127.0.0.1:${port}/apps/site/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => globalThis.__scene, null, { timeout: 60000 });
  await page.waitForTimeout(1200);
  return { page, close: async () => { await browser.close(); server.close(); } };
}
