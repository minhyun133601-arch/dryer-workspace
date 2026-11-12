import { lstat, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARCHIVE_ROOT, candidateReason, guardPath, sha256 } from './archive-materials.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const journal=path.join(root,...ARCHIVE_ROOT.split('/'),'이동목록.jsonl');
try{if((await stat(journal)).size)throw new Error('이동 기록이 이미 있습니다. 진행 중 계획은 다시 생성하지 않습니다.');}catch(e){if(e.code!=='ENOENT')throw e;}
const files=[];
async function walk(directory) {
  for(const item of await readdir(directory,{withFileTypes:true})) {
    const absolute=path.join(directory,item.name),relative=path.relative(root,absolute).split(path.sep).join('/');
    if(relative===ARCHIVE_ROOT||relative.startsWith(ARCHIVE_ROOT+'/'))continue;
    if(item.isSymbolicLink()){if(candidateReason(relative))throw new Error(`후보에 심볼릭 링크가 있습니다: ${relative}`);continue;}
    if(item.isDirectory())await walk(absolute);
    else if(item.isFile()) { const reason=candidateReason(relative);if(!reason)continue;await guardPath(root,relative);const details=await lstat(absolute);files.push({source:relative,destination:`${ARCHIVE_ROOT}/${relative}`,bytes:details.size,sha256:await sha256(absolute),reason}); }
  }
}
await walk(root);
files.sort((a,b)=>a.source.localeCompare(b.source,'ko'));
const plan={version:1,createdAt:new Date().toISOString(),archiveRoot:ARCHIVE_ROOT,mode:'exact file plan; no deletion; all official documents remain at original paths',files};
await writeFile(new URL('./archive-plan.json',import.meta.url),JSON.stringify(plan,null,2),'utf8');
console.log(JSON.stringify({files:files.length,bytes:files.reduce((sum,f)=>sum+f.bytes,0),plan:'references/material-archive-20261110/archive-plan.json'}));
