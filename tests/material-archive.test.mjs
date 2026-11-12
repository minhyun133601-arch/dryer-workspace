import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rename, rm, stat, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { ARCHIVE_ROOT, candidateReason, executePlan, guardPath, pruneEmptySourceDirectories, sha256 } from '../references/material-archive-20261110/archive-materials.mjs';
import { resolveArchivedPath } from '../references/material-archive-20261110/resolve-archived-path.mjs';

async function fixture(t) {
  const root=await mkdtemp(path.join(tmpdir(),'material-archive-test-'));
  t.after(async()=>{const target=path.resolve(root);assert.equal(path.dirname(target),path.resolve(tmpdir()));assert.ok(path.basename(target).startsWith('material-archive-test-'));await rm(target,{recursive:true,force:true});});
  return root;
}
async function planFor(root,source='tmp/finished-review/photo.jpg') {
  const absolute=path.join(root,...source.split('/'));await mkdir(path.dirname(absolute),{recursive:true});await writeFile(absolute,'verified fixture photo');
  return {version:1,archiveRoot:ARCHIVE_ROOT,files:[{source,destination:`${ARCHIVE_ROOT}/${source}`,bytes:(await stat(absolute)).size,sha256:await sha256(absolute)}]};
}
test('archive defaults to a read-only dry run, then moves exact bytes once and resolves the old path',async t=>{
  const root=await fixture(t),plan=await planFor(root),source=path.join(root,...plan.files[0].source.split('/'));
  assert.equal((await executePlan({root,plan})).mode,'dry-run');assert.equal(await readFile(source,'utf8'),'verified fixture photo');
  await assert.rejects(stat(path.join(root,...ARCHIVE_ROOT.split('/'))),{code:'ENOENT'});
  const result=await executePlan({root,plan,apply:true});assert.equal(result.files,1);assert.equal(result.deletions,0);assert.deepEqual(result.removedEmptyDirectoryPaths,['tmp/finished-review']);assert.equal(result.removedEmptyDirectories,1);assert.ok((await stat(path.join(root,'tmp'))).isDirectory());
  await assert.rejects(stat(source),{code:'ENOENT'});
  const resolved=await resolveArchivedPath(plan.files[0].source,{root});assert.equal(resolved.archived,true);assert.equal(await sha256(resolved.path),plan.files[0].sha256);
  assert.equal((await executePlan({root,plan,apply:true})).files,1);
  const records=(await readFile(path.join(root,...ARCHIVE_ROOT.split('/'),'이동목록.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);assert.deepEqual(records.map(r=>r.state),['prepared','moved','removed-empty-directory']);
});
test('archive refuses unknown destination collisions and changed source bytes before mutating',async t=>{
  const root=await fixture(t),plan=await planFor(root),destination=path.join(root,...plan.files[0].destination.split('/'));
  await mkdir(path.dirname(destination),{recursive:true});await writeFile(destination,'collision');
  await assert.rejects(executePlan({root,plan,apply:true}),/충돌/);
  assert.equal(await readFile(destination,'utf8'),'collision');
  const other=await fixture(t),changed=await planFor(other);await writeFile(path.join(other,...changed.files[0].source.split('/')),'altered');
  await assert.rejects(executePlan({root:other,plan:changed,apply:true}),/변경/);
});
test('archive recovers an interrupted rename recorded as prepared without moving twice',async t=>{
  const root=await fixture(t),plan=await planFor(root),entry=plan.files[0],archive=path.join(root,...ARCHIVE_ROOT.split('/')),destination=path.join(root,...entry.destination.split('/'));
  await mkdir(path.dirname(destination),{recursive:true});
  await writeFile(path.join(archive,'이동목록.jsonl'),JSON.stringify({...entry,state:'prepared'})+'\n');
  await rename(path.join(root,...entry.source.split('/')),destination);
  assert.equal((await executePlan({root,plan,apply:true})).files,1);
  const records=(await readFile(path.join(archive,'이동목록.jsonl'),'utf8')).trim().split('\n').map(JSON.parse);assert.deepEqual(records.map(r=>r.state),['prepared','recovered','removed-empty-directory']);
  assert.equal(await sha256(destination),entry.sha256);
});
test('archive policy protects official files, code, card sources and current photo registries',()=>{
  for(const source of ['tmp/formal.PDF','.backups/plan.dwg','workspace/old/plan.dxf','sites/dryer-map-share-20261030/formal.xlsx','apps/site/app.js','workspace/app.js','references/team3-liquid-20261110/source/3팀/card.jpg','references/chiller-20261110/offline-assets/photo-001.jpg','2팀 3팀 설비이력카드_2026-11-10-20261110T010039Z-1-001.zip','apps/site/photos/campus-rear-side/clip-001-008s.jpg','apps/site/assets/equipment-cards/liquid/042-pet-filler-28mm/four-views.jpg','workspace/outdoor-survey/metadata.json','tmp/workspace-server.json'])assert.equal(candidateReason(source),null,source);
  assert.ok(candidateReason('apps/site/photos/team3-liquid-cards/card-042-front.jpg'));
});
test('archive rejects path traversal and altered plan destinations',async t=>{
  const root=await fixture(t),plan=await planFor(root);
  for(const relative of ['../outside.jpg','tmp/../../outside.jpg','C:/outside.jpg','tmp\\file.jpg','/tmp/file.jpg'])await assert.rejects(guardPath(root,relative),/안전|밖/);
  plan.files[0].destination='보관자료/elsewhere/photo.jpg';await assert.rejects(executePlan({root,plan,apply:true}),/목적지/);
});
test('archive rejects source and destination directory junctions',async t=>{
  const root=await fixture(t),plan=await planFor(root),outside=await fixture(t);
  const alias=path.join(root,'tmp','linked');await symlink(outside,alias,process.platform==='win32'?'junction':'dir');
  await assert.rejects(guardPath(root,'tmp/linked/photo.jpg'),/링크|정션/);
  await mkdir(path.join(root,'보관자료'),{recursive:true});await symlink(outside,path.join(root,...ARCHIVE_ROOT.split('/')),process.platform==='win32'?'junction':'dir');
  await assert.rejects(executePlan({root,plan,apply:true}),/링크|정션/);
});
test('empty-directory cleanup only visits moved source ancestors and keeps nonempty folders and app anchors',async t=>{
  const root=await fixture(t);
  for(const relative of ['tmp/old/deep','tmp/untouched-empty','apps/site/photos','references/untouched-empty','보관자료/2026-11-10-정리'])await mkdir(path.join(root,...relative.split('/')),{recursive:true});
  await writeFile(path.join(root,'tmp','old','keep.txt'),'keep');
  const result=await pruneEmptySourceDirectories({root,sources:['tmp/old/deep/photo.jpg','apps/site/photos/20261028_161408.jpg']});
  assert.deepEqual(result.removedEmptyDirectoryPaths,['tmp/old/deep']);
  for(const relative of ['tmp/old','tmp/untouched-empty','apps/site/photos','references/untouched-empty','보관자료/2026-11-10-정리'])assert.ok((await stat(path.join(root,...relative.split('/')))).isDirectory(),relative);
});
test('empty-directory cleanup rejects traversal and source ancestor junctions',async t=>{
  const root=await fixture(t),outside=await fixture(t);await mkdir(path.join(root,'tmp'));await symlink(outside,path.join(root,'tmp','linked'),process.platform==='win32'?'junction':'dir');
  await assert.rejects(pruneEmptySourceDirectories({root,sources:['tmp/linked/photo.jpg']}),/링크|정션/);
  await assert.rejects(pruneEmptySourceDirectories({root,sources:['tmp/../../outside.jpg']}),/안전/);
  assert.ok((await stat(outside)).isDirectory());
});
