const fs = require('node:fs/promises');
const path = require('node:path');
const ROOT = __dirname;
const DESCRIPTOR = 'C:/Users/user/AppData/Local/ms-playwright/b/browser@b9ef7dd0c30954f569e2062e20dae89f';
const manifestPath = path.join(ROOT, 'download_manifest.json');

async function json(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (e) { if (e.code === 'ENOENT') return fallback; throw e; }
}
async function save(file, value) {
  const temp = file + '.pending';
  await fs.writeFile(temp, JSON.stringify(value, null, 2), 'utf8');
  for (let attempt = 0; ; attempt++) {
    try { await fs.rename(temp, file); break; }
    catch (e) {
      if (!['EPERM', 'EBUSY', 'EACCES'].includes(e.code) || attempt >= 19) throw e;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}
async function connect() {
  const descriptor = await json(DESCRIPTOR);
  const pw = require(descriptor.playwrightLib);
  const browser = await pw[descriptor.browser.browserName].connect(descriptor.endpoint, {timeout: 15000});
  const context = browser.contexts()[0];
  const page = context.pages().find(p => p.url().startsWith('https://gw.heechang.co.kr/'));
  if (!page) throw new Error('Logged-in groupware page not found.');
  const frame = page.frames().find(f => f.name() === 'frmContent');
  if (!frame) throw new Error('Document content frame not found.');
  return {browser, context, page, frame};
}
function documentUrl(template, id) {
  const u = new URL(template);
  const query = Buffer.from(u.searchParams.get('p'), 'base64').toString('utf8');
  if (!/documentID=\d+/.test(query)) throw new Error('Observed document URL has no documentID.');
  u.searchParams.set('p', Buffer.from(query.replace(/documentID=\d+/, 'documentID=' + id)).toString('base64'));
  return u.href;
}
async function collect(client, row, kind, manifest) {
  const {page, frame} = client;
  const template = manifest.find(r => r.sourceUrl?.includes('/Common/View.aspx'))?.sourceUrl;
  if (!template) throw new Error('Observed document URL template missing.');
  await frame.goto(documentUrl(template, row.docId), {waitUntil: 'domcontentloaded', timeout: 20000});
  await frame.waitForFunction(() => document.getElementById('ifrmForm')?.contentWindow?.document.body?.innerHTML.length > 100, undefined, {timeout: 15000});
  await frame.waitForFunction(() => {
    const match = document.body.innerText.match(/첨부파일\((\d+)건\)/);
    return match && document.querySelectorAll('a[onclick^="javascript:View.FileDownload"]').length === Number(match[1]);
  }, undefined, {timeout: 15000});
  const formFrame = frame.childFrames().find(f => f.name() === 'ifrmForm');
  const header = await formFrame.evaluate(() => ({
    docNo: document.getElementById('NO')?.value || '',
    date: document.getElementById('DATE')?.value || '',
    title: document.getElementById('SUBJ')?.value || '',
    department: document.getElementById('UPDPT')?.value || '',
  }));
  const record = {
    docId: row.docId,
    date: header.date || row.cells?.[7] || row.date || '',
    docNo: header.docNo || row.cells?.[2] || row.docNo || '',
    title: header.title || row.title,
    department: header.department,
    completedDate: row.cells?.[8] || row.completedDate || '',
    kind,
    relatedFrom: row.relatedFrom || [],
    sourceUrl: frame.url(),
    zipPath: 'downloads/' + row.docId + '.zip',
    attachments: await frame.locator('a[onclick^="javascript:View.FileDownload"]').evaluateAll(as => as.map(a => {
      const args = [...(a.getAttribute('onclick') || '').matchAll(/'([^']*)'/g)].map(m => m[1]);
      return {name: a.textContent.trim(), archiveName: args[2] || null};
    })),
    bodyText: await formFrame.locator('body').innerText(),
    pageText: await frame.locator('body').innerText(),
    relatedLinks: await frame.locator('a').evaluateAll(as => as.filter(a => /BaseDoc|ViewBase/.test(a.getAttribute('onclick') || '')).map(a => ({text: a.textContent.trim(), onclick: a.getAttribute('onclick'), href: a.getAttribute('href')}))),
  };
  await save(path.join(ROOT, 'current_document.json'), record);
  console.log(JSON.stringify({stage: 'backup', docId: record.docId, docNo: record.docNo, attachments: record.attachments.length}));
  const [download] = await Promise.all([
    page.waitForEvent('download', {timeout: 30000}),
    frame.locator('#cbtnZipFile').evaluate(el => el.click()),
  ]);
  await download.saveAs(path.join(ROOT, record.zipPath));
  const failure = await download.failure();
  if (failure) throw new Error(failure);
  record.originalZipName = download.suggestedFilename();
  manifest.push(record);
  await save(manifestPath, manifest);
  console.log(JSON.stringify({stage: 'saved', docId: record.docId, docNo: record.docNo, saved: manifest.length}));
  return record;
}
async function run(inventoryName, kind) {
  const inventory = await json(path.join(ROOT, inventoryName), []);
  const manifest = await json(manifestPath, []);
  const client = await connect();
  const failures = [];
  await fs.mkdir(path.join(ROOT, 'downloads'), {recursive: true});
  for (const row of inventory) {
    if (manifest.some(m => m.docId === row.docId)) continue;
    try { await collect(client, row, kind, manifest); }
    catch (e) {
      const error = {docId: row.docId, docNo: row.cells?.[2] || row.docNo, error: e.message};
      failures.push(error);
      await save(path.join(ROOT, 'download_failures.json'), failures);
      console.log(JSON.stringify({stage: 'error', ...error}));
    }
  }
  await save(path.join(ROOT, 'download_failures.json'), failures);
  return {inventory: inventory.length, saved: manifest.length, failures};
}
module.exports = {connect, collect, documentUrl, run, json, save};
if (require.main === module) {
  const args = process.argv.slice(2);
  run(args[0] || 'report_inventory.json', args[1] || '보고서').then(result => {
    console.log(JSON.stringify({stage: 'complete', ...result}));
    process.exit(result.failures.length ? 1 : 0);
  }).catch(e => { console.error(e.message); process.exit(1); });
}
