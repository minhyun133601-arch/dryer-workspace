import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARCHIVE_ROOT, guardPath, validRelative } from './archive-materials.mjs';
const ROOT=fileURLToPath(new URL('../../',import.meta.url));
export async function resolveArchivedPath(relative,{root=ROOT}={}) {
  validRelative(relative);
  const original=await guardPath(root,relative);
  try{await access(original);return {original:relative,current:relative,archived:false,path:original};}catch(e){if(e.code!=='ENOENT')throw e;}
  const ledger=await readFile(path.join(root,...ARCHIVE_ROOT.split('/'),'이동목록.jsonl'),'utf8');
  const entries=ledger.split(/\r?\n/).filter(Boolean).map(line=>JSON.parse(line));
  const entry=entries.reverse().find(row=>row.source===relative&&['moved','recovered','prepared'].includes(row.state));
  if(!entry)throw new Error(`보관 목록에서 찾을 수 없습니다: ${relative}`);
  const expected=`${ARCHIVE_ROOT}/${relative}`;
  if(entry.destination!==expected)throw new Error('보관 경로 기록이 일치하지 않습니다.');
  const current=await guardPath(root,entry.destination);await access(current);
  return {original:relative,current:entry.destination,archived:true,path:current,bytes:entry.bytes,sha256:entry.sha256};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(JSON.stringify(await resolveArchivedPath(process.argv[2]||''),null,2));
