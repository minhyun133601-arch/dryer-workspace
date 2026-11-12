import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, mkdir, open, readFile, readdir, realpath, rename, rmdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ARCHIVE_ROOT = '보관자료/2026-11-10-정리';
const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const PLAN_FILE = fileURLToPath(new URL('./archive-plan.json', import.meta.url));
const formalExtensions = new Set(['.pdf','.dwg','.dxf','.bak','.xls','.xlsx','.xlsm','.doc','.docx','.ppt','.pptx','.hwp','.hwpx']);
const roofUnused = new Set(['054','135','153','171','207','252','312','362','370','372','375','380','387','390','396','402','438','450','468','492'].map(n=>`frame-${n}s.jpg`).concat('water-tank-label-crop.jpg'));
const slash = p => p.split(path.sep).join('/');
const inside = (parent, candidate) => { const rel = path.relative(parent,candidate); return rel === '' || (!rel.startsWith('..'+path.sep) && rel !== '..' && !path.isAbsolute(rel)); };
export function validRelative(value) {
  if(typeof value!=='string'||!value||value.includes('\\')||/[\0:]/.test(value)||path.posix.isAbsolute(value)||value.split('/').some(s=>!s||s==='.'||s==='..'))throw new Error(`안전하지 않은 상대 경로: ${value}`);
  return value;
}
export function candidateReason(relative) {
  validRelative(relative);
  if(formalExtensions.has(path.extname(relative).toLowerCase()))return null;
  if(/^(?:좌표|건조기실 옥상 ~ 7층|경비실 공무사무실 탱크|냉동기)\//.test(relative)&&/\.(?:mp4|txt|jpe?g|png)$/i.test(relative))return '검토 완료 현장 원본 영상·GPS·사진';
  if(/^20261109_[^/]+\.(?:mp4|txt)$/i.test(relative))return '검토 완료 실외기실 원본 영상·GPS';
  if(relative==='입구.png'||relative==='스틱소포장 3층 재설계 프롬프트.txt')return '앱 선별 사본/구현으로 대체된 원본';
  if(/^(?:references\/화덕\/[^/]+\.jpe?g|references\/희창유업 홍보영상\/[^/]+\.(?:mp4|jpe?g))$/i.test(relative))return '검토 완료 원본 사진·홍보 영상';
  if(relative.startsWith('.backups/'))return '변경 전 소스·공유본 보관';
  if(relative.startsWith('.playwright-mcp/')||relative.startsWith('근거 자료/.playwright-mcp/'))return '이전 브라우저 검토 결과';
  if(relative.startsWith('tmp/')&&!/^tmp\/(?:workspace-server\.json(?:\..*)?|drawing-review-[^/]+\.json)$/.test(relative))return '임시 추출 프레임·검토/검증 결과';
  if(/^workspace\/[^/]+\//.test(relative)&&!relative.startsWith('workspace/outdoor-survey/'))return '이전 검토·변환 작업 결과';
  if(relative.startsWith('sites/dryer-map-share-20261030/'))return '과거 공유 사이트 빌드·저장소 사본';
  if(/^apps\/site\/photos\/team3-liquid-cards\/card-\d{3}(?:-(?:front|left|rear|right))?\.jpg$/.test(relative))return '액상 4면 reflow로 대체된 중복 합성·크롭';
  if(relative.startsWith('apps/site/photos/dryer-roof-7f/')&&roofUnused.has(path.posix.basename(relative)))return '현재 데이터에서 사용하지 않는 옥상 검토 이미지';
  if(/^apps\/site\/photos\/20261028_(?:161408|161435)\.jpg$/.test(relative))return '현재 데이터에서 사용하지 않는 건조실 사진';
  return null;
}
export async function sha256(file) { const hash=createHash('sha256'); for await(const chunk of createReadStream(file))hash.update(chunk); return hash.digest('hex'); }
async function exists(file) { try{return await lstat(file);}catch(e){if(e.code==='ENOENT')return null;throw e;} }
export async function guardPath(root, relative) {
  validRelative(relative);
  const absolute=path.resolve(root,...relative.split('/'));
  if(!inside(root,absolute)||absolute===root)throw new Error('프로젝트 밖 경로를 사용할 수 없습니다.');
  let at=root;
  for(const segment of relative.split('/')) { at=path.join(at,segment); const entry=await exists(at); if(entry?.isSymbolicLink())throw new Error(`심볼릭 링크/정션은 이동하지 않습니다: ${slash(path.relative(root,at))}`); }
  return absolute;
}
async function durableAppend(file, record) { const handle=await open(file,'a'); try{await handle.writeFile(JSON.stringify(record)+'\n','utf8');await handle.sync();}finally{await handle.close();} }
async function durableJson(file, value) { const temporary=file+'.writing'; const handle=await open(temporary,'w');try{await handle.writeFile(JSON.stringify(value,null,2),'utf8');await handle.sync();}finally{await handle.close();}await rename(temporary,file); }
async function readJournal(file) { try{return (await readFile(file,'utf8')).split(/\r?\n/).filter(Boolean).map((line,i)=>{try{return JSON.parse(line);}catch{throw new Error(`이동 기록 ${i+1}행을 확인해야 합니다. 자동 덮어쓰기를 중단합니다.`);}});}catch(e){if(e.code==='ENOENT')return [];throw e;} }
const directoryAnchors=new Set(['apps','workspace','workspace/outdoor-survey','tmp','references','references/material-archive-20261110','tooling','tests','tests/fixtures','docs','exports','근거 자료','근거 자료/건물3D 후보도면','근거 자료/도면검토앱','보관자료',ARCHIVE_ROOT]);
function protectedDirectory(relative) { return directoryAnchors.has(relative)||relative.startsWith('apps/')||relative.startsWith('보관자료/'); }
export async function pruneEmptySourceDirectories({root,sources,onRemoved=async()=>{}}) {
  root=await realpath(root);
  const candidates=new Set(),removedEmptyDirectoryPaths=[],emptyDirectoryCleanupSkipped=[];
  for(const source of sources) {
    if(!candidateReason(source))throw new Error(`빈 폴더 정리의 원본 경로가 허용되지 않습니다: ${source}`);
    for(let parent=path.posix.dirname(source);parent!=='.';parent=path.posix.dirname(parent)) {
      if(protectedDirectory(parent))break;
      candidates.add(parent);
    }
  }
  const ordered=[...candidates].sort((a,b)=>b.split('/').length-a.split('/').length||a.localeCompare(b,'ko'));
  for(const relative of ordered) {
    const absolute=await guardPath(root,relative),entry=await exists(absolute);
    if(!entry)continue;
    if(!entry.isDirectory()||entry.isSymbolicLink())throw new Error(`빈 폴더 정리 대상이 일반 디렉터리가 아닙니다: ${relative}`);
    const canonical=await realpath(absolute);
    if(canonical===root||!inside(root,canonical))throw new Error(`빈 폴더가 프로젝트 밖으로 연결됩니다: ${relative}`);
    if((await readdir(absolute)).length)continue;
    // Check every ancestor again immediately before the non-recursive rmdir.
    // If a new entry appeared, rmdir fails rather than deleting that entry.
    await guardPath(root,relative);
    try { await rmdir(absolute); }
    catch(error) {
      if(error.code==='ENOENT')continue;
      emptyDirectoryCleanupSkipped.push({path:relative,reason:error.code||String(error)});continue;
    }
    removedEmptyDirectoryPaths.push(relative);
    await onRemoved(relative);
  }
  return {removedEmptyDirectories:removedEmptyDirectoryPaths.length,removedEmptyDirectoryPaths,emptyDirectoryCleanupSkipped};
}
export async function executePlan({root=ROOT,plan,apply=false,onProgress=()=>{}}) {
  root=await realpath(root);
  if(plan.version!==1||plan.archiveRoot!==ARCHIVE_ROOT||!Array.isArray(plan.files))throw new Error('정리 계획 형식이 일치하지 않습니다.');
  const archive=await guardPath(root,ARCHIVE_ROOT);
  const journalFile=path.join(archive,'이동목록.jsonl');
  const journal=await readJournal(journalFile);
  const known=new Map();
  for(const row of journal)if(['prepared','moved','recovered'].includes(row.state))known.set(row.source,row);
  const seen=new Set(),validated=[];
  for(const entry of plan.files) {
    if(!candidateReason(entry.source)||!Number.isSafeInteger(entry.bytes)||entry.bytes<0||!/^[a-f0-9]{64}$/.test(entry.sha256))throw new Error(`보호 대상 또는 잘못된 항목: ${entry.source}`);
    if(seen.has(entry.source.toLowerCase()))throw new Error(`중복 이동 계획: ${entry.source}`);seen.add(entry.source.toLowerCase());
    const destination=`${ARCHIVE_ROOT}/${entry.source}`;
    if(entry.destination!==destination)throw new Error(`보관 목적지가 일치하지 않습니다: ${entry.source}`);
    const sourceFile=await guardPath(root,entry.source),destinationFile=await guardPath(root,destination);
    if(!inside(archive,destinationFile))throw new Error('보관 폴더 밖으로 이동할 수 없습니다.');
    const source=await exists(sourceFile),target=await exists(destinationFile),previous=known.get(entry.source);
    if(target) {
      if(source||!previous||previous.destination!==destination||previous.sha256!==entry.sha256||previous.bytes!==entry.bytes)throw new Error(`기존 파일 충돌: ${destination}`);
      if(!target.isFile()||target.size!==entry.bytes||await sha256(destinationFile)!==entry.sha256)throw new Error(`기존 보관 파일이 기록과 다릅니다: ${destination}`);
      validated.push({...entry,sourceFile,destinationFile,alreadyMoved:true});continue;
    }
    if(!source?.isFile()||source.size!==entry.bytes)throw new Error(`원본이 없거나 크기가 변경되었습니다: ${entry.source}`);
    if(await sha256(sourceFile)!==entry.sha256)throw new Error(`계획 이후 원본 내용이 변경되었습니다: ${entry.source}`);
    validated.push({...entry,sourceFile,destinationFile});
  }
  onProgress({stage:'validated',files:validated.length,bytes:validated.reduce((sum,e)=>sum+e.bytes,0),apply});
  if(!apply)return {mode:'dry-run',files:validated.length,bytes:validated.reduce((sum,e)=>sum+e.bytes,0),alreadyMoved:validated.filter(e=>e.alreadyMoved).length};
  await mkdir(archive,{recursive:true});
  const completed=[];
  for(const entry of validated) {
    const base={source:entry.source,destination:entry.destination,bytes:entry.bytes,sha256:entry.sha256};
    if(entry.alreadyMoved) { const prior=known.get(entry.source);if(prior?.state==='prepared')await durableAppend(journalFile,{...base,state:'recovered',time:new Date().toISOString()});completed.push(base);continue; }
    // Re-check immediately before each mutation; no other shell or wildcard is used.
    await guardPath(root,entry.source);await guardPath(root,entry.destination);
    if(await exists(entry.destinationFile))throw new Error(`이동 직전 보관 파일이 생겼습니다: ${entry.destination}`);
    const source=await lstat(entry.sourceFile);
    if(!source.isFile()||source.size!==entry.bytes||await sha256(entry.sourceFile)!==entry.sha256)throw new Error(`이동 직전 원본이 변경되었습니다: ${entry.source}`);
    await mkdir(path.dirname(entry.destinationFile),{recursive:true});
    await durableAppend(journalFile,{...base,state:'prepared',time:new Date().toISOString()});
    await rename(entry.sourceFile,entry.destinationFile);
    const target=await lstat(entry.destinationFile);
    if(!target.isFile()||target.size!==entry.bytes||await sha256(entry.destinationFile)!==entry.sha256)throw new Error(`이동 후 무결성 검증에 실패했습니다: ${entry.destination}`);
    await durableAppend(journalFile,{...base,state:'moved',time:new Date().toISOString()});
    completed.push(base);
    if(completed.length%100===0)onProgress({stage:'moving',completed:completed.length,total:validated.length});
  }
  const cleanup=await pruneEmptySourceDirectories({root,sources:completed.map(entry=>entry.source),onRemoved:source=>durableAppend(journalFile,{state:'removed-empty-directory',source,time:new Date().toISOString()})});
  const removedEmptyDirectoryPaths=[...new Set([...journal.filter(row=>row.state==='removed-empty-directory').map(row=>row.source),...cleanup.removedEmptyDirectoryPaths])].sort();
  const report={version:1,createdAt:new Date().toISOString(),archiveRoot:ARCHIVE_ROOT,files:completed.length,bytes:completed.reduce((sum,e)=>sum+e.bytes,0),deletions:0,removedEmptyDirectories:removedEmptyDirectoryPaths.length,removedEmptyDirectoryPaths,emptyDirectoryCleanupSkipped:cleanup.emptyDirectoryCleanupSkipped,entries:completed};
  await durableJson(path.join(archive,'archive-map.json'),report);
  const csvCell=value=>'"'+String(value).replaceAll('"','""')+'"';
  await writeFile(path.join(archive,'이동목록.csv'),'\ufeff원래 경로,보관 경로,바이트,SHA256\r\n'+completed.map(e=>[e.source,e.destination,e.bytes,e.sha256].map(csvCell).join(',')).join('\r\n')+'\r\n','utf8');
  await writeFile(path.join(archive,'보관안내.txt'),`검토가 끝난 원본 영상·사진, 중복 이미지와 임시 결과를 한 곳으로 옮긴 보관함입니다.\r\n파일을 삭제하지 않았으며, 하위 폴더는 원래 상대 경로를 그대로 따릅니다.\r\n이동한 원본 경로의 상위 폴더 중 비어 있는 폴더만 ${report.removedEmptyDirectories}개 정리했습니다. 필수 앱 폴더와 보관함은 유지합니다.\r\n공식 도면·설비이력카드와 현재 앱/내보내기에 필요한 파일은 원래 위치에 유지했습니다.\r\n이동목록.csv 또는 archive-map.json으로 원래 경로와 SHA256을 확인할 수 있습니다.\r\n`,'utf8');
  return {mode:'applied',files:report.files,bytes:report.bytes,deletions:0,removedEmptyDirectories:report.removedEmptyDirectories,removedEmptyDirectoryPaths:report.removedEmptyDirectoryPaths,emptyDirectoryCleanupSkipped:report.emptyDirectoryCleanupSkipped};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const flags=process.argv.slice(2);
  if(flags.some(flag=>!['--apply','--dry-run'].includes(flag))||flags.includes('--apply')&&flags.includes('--dry-run'))throw new Error('사용법: node references/material-archive-20261110/archive-materials.mjs [--dry-run | --apply]');
  const plan=JSON.parse(await readFile(PLAN_FILE,'utf8'));
  console.log(JSON.stringify(await executePlan({plan,apply:flags.includes('--apply'),onProgress:value=>console.log(JSON.stringify(value))})));
}
