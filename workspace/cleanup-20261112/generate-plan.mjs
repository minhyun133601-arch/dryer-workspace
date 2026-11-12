import path from 'node:path';
import { readdir, lstat, readFile, realpath, writeFile, access } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

// Read-only inventory generator. It never renames, moves, deletes or overwrites
// source material, and writes only its plan beside this script.
const projectRoot = await realpath(fileURLToPath(new URL('../../', import.meta.url)));
const planDirectory = path.join(projectRoot, 'workspace', 'cleanup-20261112');
const deletionStaging = path.join(path.dirname(projectRoot), '삭제 예정');
const argument = (name, fallback) => {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  if (!process.argv[index + 1] || process.argv[index + 1].startsWith('--')) throw new Error(`Missing ${name} value`);
  return path.resolve(process.argv[index + 1]);
};
const targetRoot = argument('--target-root', path.join(deletionStaging, '프로젝트_자료정리_20261112'));
const output = argument('--output', path.join(planDirectory, 'move-plan.json'));
const normalized = value => path.resolve(value).replaceAll('\\', '/').toLowerCase();
const within = (candidate, parent) => normalized(candidate) === normalized(parent) || normalized(candidate).startsWith(`${normalized(parent)}/`);
if (!within(targetRoot, deletionStaging) || normalized(targetRoot) === normalized(deletionStaging)) throw new Error('Target must be a named child of Desktop/삭제 예정');
if (within(targetRoot, projectRoot) || within(projectRoot, targetRoot)) throw new Error('Source and target roots overlap');
if (!within(output, planDirectory) || path.extname(output).toLowerCase() !== '.json') throw new Error('Plan output must be JSON inside workspace/cleanup-20261112');

const policyPath = path.join(projectRoot, 'apps', 'site', 'evidence-assets.js');
const { isRetainedEvidenceImage } = await import(pathToFileURL(policyPath).href);
const policySha256 = createHash('sha256').update(await readFile(policyPath)).digest('hex');
const relative = absolute => path.relative(projectRoot, absolute).replaceAll('\\', '/');
const starts = (value, prefix) => value === prefix || value.startsWith(`${prefix}/`);
const mediaExtensions = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tif', '.tiff', '.avif', '.mp4', '.mov', '.m4v', '.avi', '.mkv', '.webm', '.mpg', '.mpeg', '.mts', '.3gp']);
const videoExtensions = new Set(['.mp4', '.mov', '.m4v', '.avi', '.mkv', '.webm', '.mpg', '.mpeg', '.mts', '.3gp']);
const entries = new Map(), preserved = new Map(), held = new Map(), wholeDirectories = [];
const warnings = [];

const protectedRoots = [
  '근거 자료/건물3D 후보도면',
  '근거 자료/도면검토앱/cache',
  '근거 자료/도면검토앱/public',
  '근거 자료/도면검토앱/tools',
  '근거 자료/관리자료',
  'references/team3-liquid-20261110',
  'references/team3-outdoor-cards-20261110',
  'references/설비이력카드/3팀',
  'references/equipment-document-archive-20261110/documents',
  'references/화덕/도면',
  'references/생산팀 수집자료/01_DWG 도면',
  'references/생산팀 수집자료/02_도면 관련자료',
  'sites/.git',
];
const protectedExact = new Set(['Image_20261110_0001.pdf', '근거 자료/도면검토앱/data/review.sqlite3']);
const alwaysKeep = rel => protectedExact.has(rel) || protectedRoots.some(root => starts(rel, root)) || rel.split('/').includes('node_modules');
const specialPreparationPlan = rel => /(?:preparation-review|preparation-room)/i.test(rel) && /(?:clip-001-075p2s-plan|clip-001-076s|clip-001-078s|frame-076s|frame-078s)\.(?:jpe?g|png)$/i.test(rel);
const drawingName = rel => /(?:^|[-_. ])(?:plans?|drawings?|sheets?|elevations?|sections?)(?:[-_. ]|$)|rectified|도면|배치도|평면도|입면도|단면도|상세도|조명도|site-2019|entrance-parking-2019/i.test(path.basename(rel));
const screenshotName = rel => /(?:desktop|mobile|gallery|screenshot|screen|스크린샷|화면검토|preview|diagnostic-ui)/i.test(path.basename(rel)) || starts(rel, 'tmp/drawing-review-qa');
// Root visually reviewed floor1.png and yusan-surroundings.jpg, then checked
// the OWP README for the remaining frame sequences and unused web textures.
const reviewedReferenceMedia = new Set([
  ...['floor1', 'floor3', 'floor4', 'floor5-7', 'team2'].flatMap(name => [
    `references/owp-team2-20261029/images/${name}.png`,
    `references/owp-team2-20261029/images/${name}-sequence.jpg`,
  ]),
  ...['d.png', 'glassclock.png', 'ica1.png', 'ica2.png', 'pr/100.png'].map(name => `references/owp-team2-20261029/originals/assets/models/${name}`),
  'references/yusan-campus/yusan-surroundings.jpg',
]);

async function exists(absolute) { try { await access(absolute); return true; } catch { return false; } }
async function* walk(rel) {
  const absolute = path.resolve(projectRoot, rel);
  if (!within(absolute, projectRoot)) throw new Error(`Source path escaped project: ${rel}`);
  if (!await exists(absolute)) return;
  const info = await lstat(absolute);
  if (info.isSymbolicLink()) {
    held.set(rel.toLowerCase(), { relativePath: rel, bytes: 0, reason: 'Symbolic link/reparse target needs explicit review' });
    return;
  }
  if (info.isFile()) { yield { relativePath: rel, bytes: info.size }; return; }
  if (!info.isDirectory()) return;
  const children = (await readdir(absolute, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, 'en'));
  for (const child of children) {
    if (child.name === 'node_modules' || (child.name === '.git' && starts(rel, 'sites'))) continue;
    yield* walk(`${rel}/${child.name}`);
  }
}
function keep(file, reason) {
  const key = file.relativePath.toLowerCase();
  if (entries.has(key)) throw new Error(`Conflicting keep/move classification: ${file.relativePath}`);
  preserved.set(key, { ...file, reason });
}
async function propose(file, reason, category) {
  const rel = file.relativePath, key = rel.toLowerCase();
  if (alwaysKeep(rel)) { keep(file, 'Protected drawing, Team 3 source/card, or runtime resource'); return; }
  if (preserved.has(key)) throw new Error(`Conflicting move/keep classification: ${rel}`);
  const source = path.resolve(projectRoot, rel), destination = path.resolve(targetRoot, rel);
  if (!within(source, projectRoot) || normalized(source) === normalized(projectRoot)) throw new Error(`Unsafe source: ${source}`);
  if (!within(destination, targetRoot) || normalized(destination) === normalized(targetRoot)) throw new Error(`Unsafe destination: ${destination}`);
  const prior = entries.get(key);
  if (prior) return;
  if (await exists(destination)) warnings.push({ relativePath: rel, type: 'destination-exists', destination });
  entries.set(key, { ...file, reason, category, destinationRelativePath: rel });
}
async function proposeWholeDirectory(rel, reason, category) {
  if (!await exists(path.join(projectRoot, rel))) return;
  const files = [];
  for await (const file of walk(rel)) files.push(file);
  if ([...held.values()].some(file => starts(file.relativePath, rel))) throw new Error(`Whole directory contains an unreviewed symbolic link: ${rel}`);
  if (!files.length) return;
  if (files.some(file => alwaysKeep(file.relativePath))) throw new Error(`Whole directory contains protected material: ${rel}`);
  for (const file of files) await propose(file, reason, category);
  const directory = await realpath(path.join(projectRoot, rel));
  if (!within(directory, projectRoot) || normalized(directory) === normalized(projectRoot)) throw new Error(`Unsafe whole directory: ${rel}`);
  const destination = path.resolve(targetRoot, rel);
  if (!within(destination, targetRoot)) throw new Error(`Unsafe whole directory target: ${rel}`);
  wholeDirectories.push({ relativePath: rel, destinationRelativePath: rel, fileCount: files.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0), reason, category });
}

// Explicit whole folders: retain original structure, including paired GPS text
// and source-card HTML/JSON, so the later reversible move is self-contained.
for (const [rel, reason, category] of [
  ['보관자료', 'Previously archived evidence material', 'previously-archived'],
  ['건물 뒷편 세세하게 ~ 2팀 계단', 'Original field videos and paired capture files', 'original-field-media'],
  ['보일러실, 추가 파일', 'Original field videos and paired capture files', 'original-field-media'],
  ['조제실', 'Original field videos and paired capture files', 'original-field-media'],
  ['좌표', 'Original GPS field videos and paired coordinate text', 'original-field-media'],
  ['references/team2-equipment-cards-20261110/source', 'Team 2 equipment history card originals; Team 3 retained separately', 'non-team3-card-originals'],
  ['references/생산팀 수집자료/03_설비이력카드', 'Older non-Team-3 equipment card source archive', 'non-team3-card-originals'],
  ['근거 자료/도면검토앱/office-batch', 'Redundant conversion intermediates; live drawing cache retained', 'drawing-app-intermediates'],
  ['근거 자료/도면검토앱/office-images', 'Embedded-picture audit intermediates; live drawing cache retained', 'drawing-app-intermediates'],
  ['근거 자료/도면검토앱/data/browser-qa', 'Drawing interface QA artifacts', 'drawing-app-qa'],
  ['근거 자료/.playwright-mcp', 'Drawing interface screenshot artifacts', 'drawing-app-qa'],
]) await proposeWholeDirectory(rel, reason, category);

for (const rel of ['2팀 3팀 설비이력카드_2026-11-10-20261110T010039Z-1-001.zip', '스크린샷(261).png', 'valve-interior-preview.png']) {
  for await (const file of walk(rel)) await propose(file, rel.endsWith('.zip') ? 'Mixed Team 2/3 ZIP; all 200 Team 3 source files and standalone Team 3 PDF independently verified and retained' : 'User/implementation review screenshot', 'root-staged-evidence');
}
for await (const file of walk('exports/건조기-통합-공유.html')) await propose(file, 'Previous generated shared HTML embeds removed evidence photos; root will regenerate the cleaned viewer after staging it', 'embedded-current-share');

for await (const file of walk('apps/site/photos')) {
  if (!mediaExtensions.has(path.extname(file.relativePath).toLowerCase())) continue;
  const reference = `./photos/${file.relativePath.slice('apps/site/photos/'.length)}`;
  if (isRetainedEvidenceImage(reference)) keep(file, 'Active retained drawing or Team 3 equipment card image');
  else await propose(file, 'Reference photo/video excluded by active isRetainedEvidenceImage policy', 'app-reference-media');
}

for (const root of ['tmp', 'workspace']) for await (const file of walk(root)) {
  const rel = file.relativePath, extension = path.extname(rel).toLowerCase();
  if (starts(rel, 'workspace/cleanup-20261112') || !mediaExtensions.has(extension)) continue;
  if (specialPreparationPlan(rel) || (drawingName(rel) && !screenshotName(rel))) keep(file, 'Clearly named drawing/plan crop or rectified diagram');
  else await propose(file, 'Derived field-media/contact sheet or implementation screenshot', 'temporary-review-media');
}

const clearPhotoRole = rel => /\/(?:frames?|native|snapshots?|screenshots?|sequence|video-observations|재설계-기준장면)\//i.test(rel)
  || /(?:^|[-_. ])(?:frame|clip|contact|photo|thumb|preview|aerial|satellite|capture|screen|all-scenes)(?:[-_. \d]|$)|^\d{8}_\d{6}|^KakaoTalk_|사진|스크린샷/i.test(path.basename(rel))
  || starts(rel, 'references/camera-navigation-20261110');
for await (const file of walk('references')) {
  const rel = file.relativePath, extension = path.extname(rel).toLowerCase(), key = rel.toLowerCase();
  if (entries.has(key)) continue;
  if (alwaysKeep(rel)) { keep(file, 'Protected drawing collection or Team 3 source/card/offline data'); continue; }
  if (!mediaExtensions.has(extension)) continue;
  if (reviewedReferenceMedia.has(rel)) {
    await propose(file, 'Visually and documentarily reviewed old 3D render/video frame, unused OWP texture, or satellite photograph; not a drawing', 'reference-media');
    continue;
  }
  const appDrawingEquivalent = starts(rel, 'references/chiller-20261110/offline-assets')
    && isRetainedEvidenceImage(`./photos/chiller-20261110/${path.basename(rel)}`);
  if (appDrawingEquivalent || specialPreparationPlan(rel) || (drawingName(rel) && !screenshotName(rel)) || starts(rel, 'references/outdoor-drawings-20261110')) {
    keep(file, 'Technical drawing or recognizable plan derivative');
  } else if (videoExtensions.has(extension) || clearPhotoRole(rel)) {
    await propose(file, 'Clearly identified field photo/video, contact sheet, or render screenshot', 'reference-media');
  } else {
    held.set(key, { ...file, reason: 'Ambiguous reference image name/role; excluded from move candidates pending review' });
  }
}

for (const rel of ['근거 자료/drawing-review-desktop.png', '근거 자료/도면검토앱/test-node-overview.png', '근거 자료/도면검토앱/test-node.json', '근거 자료/도면검토앱/test-node.png', '근거 자료/도면검토앱/test-preview.bmp', '근거 자료/도면검토앱/test.dxf', '근거 자료/도면검토앱/test.svg']) {
  for await (const file of walk(rel)) await propose(file, 'Non-runtime drawing renderer QA fixture/output', 'drawing-app-qa');
}

for await (const file of walk('.backups')) {
  if (path.extname(file.relativePath).toLowerCase() === '.html' && file.bytes >= 1024 * 1024) await propose(file, 'Previous generated shared HTML with embedded evidence photos; small source templates remain', 'embedded-share-backups');
}

const sorted = values => [...values].sort((a, b) => a.relativePath.localeCompare(b.relativePath, 'en'));
const moveEntries = sorted(entries.values()), preservedFiles = sorted(preserved.values()), heldFiles = sorted(held.values());
for (const entry of moveEntries) if (alwaysKeep(entry.relativePath)) throw new Error(`Protected file slipped into plan: ${entry.relativePath}`);
for (const whole of wholeDirectories) {
  const children = moveEntries.filter(entry => starts(entry.relativePath, whole.relativePath));
  if (children.length !== whole.fileCount || children.reduce((sum, child) => sum + child.bytes, 0) !== whole.bytes) throw new Error(`Incomplete whole-directory coverage: ${whole.relativePath}`);
}
const categorySummary = Object.fromEntries([...new Set(moveEntries.map(entry => entry.category))].sort().map(category => {
  const files = moveEntries.filter(entry => entry.category === category);
  return [category, { fileCount: files.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0) }];
}));
const manifest = {
  version: 1, date: '2026-11-12', kind: 'read-only move plan; no source files moved', sourceRoot: projectRoot, targetRoot,
  destinationLayout: 'Each destinationRelativePath preserves the complete project-relative source path',
  sourceValidation: { sourceRootRealPathResolved: true, sourceAndTargetDoNotOverlap: true, targetIsUnderDesktopDeletionStaging: true, sourcePathsVerifiedUnderProject: true, destinationPathsVerifiedUnderTarget: true, symbolicLinksNotFollowed: true },
  policy: { file: 'apps/site/evidence-assets.js', sha256: policySha256 },
  protectedRoots, protectedExactFiles: [...protectedExact],
  summary: { moveFileCount: moveEntries.length, moveBytes: moveEntries.reduce((sum, file) => sum + file.bytes, 0), wholeDirectoryCount: wholeDirectories.length, preservedListedFileCount: preservedFiles.length, heldFileCount: heldFiles.length, heldBytes: heldFiles.reduce((sum, file) => sum + file.bytes, 0), warningCount: warnings.length },
  categorySummary, wholeDirectories: sorted(wholeDirectories), entries: moveEntries, heldFiles, preservedFiles, warnings,
};
await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ plan: relative(output), sourceRoot: projectRoot, targetRoot, ...manifest.summary, categorySummary, heldFiles: heldFiles.map(({ relativePath, bytes }) => ({ relativePath, bytes })) }, null, 2));
