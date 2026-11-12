// One-time, reversible organization receipt for the 2026-11-12 asset cleanup.
// Historical evidence manifests are deliberately left byte-for-byte intact.
import { copyFile, mkdir, readFile, readdir, rename, rmdir, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LIQUID_EQUIPMENT } from '../../apps/site/liquid-data.js';
import { OUTDOOR_HISTORY_CARDS } from '../../apps/site/outdoor-card-data.js';
import { CHILLER_SHEETS } from '../../apps/site/chiller-data.js';
import { guardPath } from '../../references/material-archive-20261110/archive-materials.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const backup = '.backups/asset-organization-20261112';
const moves = [], assets = [];
const pad = n => String(n).padStart(3, '0');
const liquidNames = {
  42:'pet-filler-28mm',43:'pet-room-1',44:'pet-line',45:'labeler-38mm',46:'pasteurizer',47:'automatic-filler-88mm',
  48:'hipe-16-stick-filler-2',49:'hipe-16-stick-filler-1',50:'bottle-cap-assembler',51:'water-softener',52:'bottle-checkweigher',
  53:'cartoner',54:'case-erector-1',55:'ten-pack-packer',56:'pouch-post-pasteurization-bath',57:'pouch-cooling-bath',58:'post-pasteurizer',
  59:'cheerpack-unloader',60:'stick-cooler',61:'pouch-filler-3',62:'pouch-filler-2',63:'pouch-filler-1',64:'cheerpack-filler-3',
  65:'cheerpack-filler-2',66:'cheerpack-filler-1',67:'mixer-tank',68:'mixing-tank-10',69:'mixing-tank-7',70:'mixing-tank-9',71:'tank-3',
  77:'mixing-tank-4',78:'mixing-tank-3',79:'mixing-tank-2',80:'line-a-1-4',81:'line-a-1-3',82:'line-a-1-2',83:'line-a-1-1',
  93:'homo-mixer-tank',94:'pearl-vibrating-sieve',95:'sterilizer-1',96:'sterilizer-2',97:'sterilizer-3',98:'pearl-transfer-hopper',
  99:'hcpe-5-homogenizer',100:'line-b-hot-water-tank',101:'air-compressor',102:'hot-melt',103:'boiler-3',104:'boilers-1-2',105:'teaching-robot',106:'pill-former',107:'kneader',
};
const outdoorNames = {
  72:'air-handler-20rt-2',73:'air-handler-20rt-1',74:'mixing-room-cooling-unit-4',75:'mixing-room-cooling-unit-2',76:'mixing-room-cooling-unit-1',
  84:'cheerpack-stick-air-handler',85:'pet-pouch-air-handler',86:'cooling-tower-water-tank-100rt',87:'chiller-100rt',88:'water-tank-100rt',
  89:'chiller-40rt',90:'water-tank-40rt',91:'cooling-tower-water-tank-20rt',92:'cooling-tower-20rt',
};
const sheetNames = [null,'condenser-capacity-calculation','liquid-receiver-dimensions','receiver-pressure-vessel-certificate',
  'shell-and-tube-evaporator-detail','water-chiller-catalog','safety-valve-section','safety-valve-test-certificate-1',
  'safety-valve-test-certificate-2','electrical-control-circuit-1','electrical-control-circuit-2','electrical-control-circuit-3',
  'historical-refrigeration-location','chiller-pump-tank-layout','chiller-general-arrangement-and-bom','refrigerant-circuit',
  'compressor-50asc-dimensions','compressor-section-and-capacity-control','capacity-control-modification',
  'compressor-series-dimensions','compressor-performance','condenser-coil-detail','condenser-coil-specifications'];

function move(originalPath, currentPath, role) { moves.push({ originalPath, currentPath, role }); }
function image(oldName, newName, label, category, options = {}) {
  const entry = { id: options.id || newName.replace(/\.[^.]+$/, '').replaceAll('/', '-'), path: './assets/' + newName, label, category };
  move('apps/site/photos/' + oldName, 'apps/site/assets/' + newName, 'viewer-image');
  if (options.shareSource) {
    entry.sharePath = './assets/share/' + options.shareName;
    move(options.shareSource, 'apps/site/' + entry.sharePath.slice(2), 'share-image');
  }
  assets.push(entry);
}

image('heechang-official-logo.svg','brand/heechang-official-logo.svg','희창유업 공식 로고','brand');
for (const [oldName,newName,label] of [
  ['yusan-site-plan.png','yusan-site-plan.png','유산공장 배치도'],
  ['yusan-site-plan-2019.png','yusan-site-plan-2019.png','2019 유산공장 배치도'],
  ['yusan-entrance-plan-2019.png','yusan-entrance-plan-2019.png','2019 정문·경비실 배치도'],
]) image(oldName,'drawings/campus/'+newName,label,'drawing-campus');
image('yusan-tower-section.png','drawings/dryer/dryer-tower-section.png','건조실 타워 단면도','drawing-dryer');
for (const floor of ['1f','2f','3f','4f5f']) image('dryer-building-plan-'+floor+'.png','drawings/dryer/dryer-floor-plan-'+floor+'.png','건조실 '+floor.toUpperCase()+' 평면도','drawing-dryer');
for (const [oldName,newName,label] of [
  ['sheetburner.jpg','burner-assembly-drawing.jpg','버너 조립도'],['sheetpiping.jpg','gas-piping-drawing.jpg','버너 가스 배관도'],
]) image('furnace/'+oldName,'drawings/furnace/'+newName,label,'drawing-furnace');
for (const [oldName,newName,label] of [
  ['2022-collector-detail.png','collector-detail-2022.png','2022 집진기 상세도'],['2022-equipment-plan.png','equipment-plan-2022.png','2022 실외기실 설비 배치도'],
  ['2022-outdoor-row.png','outdoor-equipment-row-2022.png','2022 실외 설비열 배치도'],['2022-utility-plan.png','utility-plan-2022.png','2022 유틸리티 배치도'],
  ['2025-installation-plan.png','installation-plan-2025.png','2025 설비 설치도'],['haccp-air-plan.png','haccp-airflow-plan.png','HACCP 공조 계획도'],
]) image('outdoor-drawings/'+oldName,'drawings/outdoor/'+newName,label,'drawing-outdoor');
for (const [oldName,newName,label] of [
  ['third-floor-plan.png','floor-3-reference-plan.png','스틱·소포장 3층 참고 배치도'],['third-floor-measured-plan.png','floor-3-measured-plan.png','스틱·소포장 3층 실측 근거 평면도'],
  ['stick-packer-reference-plan.png','stick-packer-plan.png','스틱 포장기 참고 평면도'],['stick-packer-reference-elevations.png','stick-packer-elevations.png','스틱 포장기 참고 입면도'],
  ...[1,2].map(n=>[`floor-${n}-architecture.png`,`floor-${n}-architecture.png`,`스틱·소포장 ${n}층 건축 평면도`]),
  ...[1,2,3].map(n=>[`floor-${n}-workplace-2025.png`,`floor-${n}-workplace-2025.png`,`2025 스틱·소포장 ${n}층 작업장 배치도`]),
  ['floor-2-auger-proposal.png','floor-2-auger-proposal.png','스틱·소포장 2층 오거 제안도'],
  ['floor-2-materials-route-20231018.png','floor-2-materials-route-20231018.png','2023-10-18 스틱·소포장 2층 물류 동선도'],
  ['floor-2-workers-route-20231018.png','floor-2-workers-route-20231018.png','2023-10-18 스틱·소포장 2층 작업자 동선도'],
]) image('packaging-3f/'+oldName,'drawings/packaging/'+newName,label,'drawing-packaging');
for (const [oldName,newName] of [
  ['clip-001-075p2s-plan.jpg','current-room-plan-clip01-075p2s.jpg'],
  ['clip-001-076s.jpg','current-room-plan-clip01-076s.jpg'],['clip-001-078s.jpg','current-room-plan-clip01-078s.jpg'],
  ['frame-076s.jpg','current-room-plan-frame-076s.jpg'],['frame-078s.jpg','current-room-plan-frame-078s.jpg'],
]) image('preparation-room/'+oldName,'drawings/preparation/'+newName,'조제실 현행 배치·조명 계획도 ('+oldName.replace('.jpg','')+')','drawing-preparation');
for (let page=1;page<=22;page++) {
  const oldName=`sheet-${pad(page)}.jpg`, newName=`page-${pad(page)}-${sheetNames[page]}.jpg`;
  image('chiller-20261110/'+oldName,'drawings/chiller/'+newName,CHILLER_SHEETS.find(s=>s.page===page).name,'drawing-chiller',{
    id:`chiller-sheet-${pad(page)}`,shareSource:'references/chiller-20261110/offline-assets/'+oldName,shareName:'chiller/'+newName,
  });
}
for (const [key,label] of [['cutaway','HITACHI 압축기 내부 참고도'],['dimensions','HITACHI 압축기 치수 참고도']]) {
  const name='hitachi-compressor-'+key+'.jpg';
  image('chiller-20261110/hitachi-'+key+'.jpg','drawings/chiller/'+name,label,'drawing-chiller',{
    id:'chiller-'+key,shareSource:'references/chiller-20261110/offline-assets/hitachi-'+key+'.jpg',shareName:'chiller/'+name,
  });
}
for (const item of LIQUID_EQUIPMENT) {
  const number=pad(item.cardNumber), folder=number+'-'+liquidNames[item.cardNumber];
  if(folder.includes('undefined')) throw new Error('Missing liquid equipment name: '+number);
  image('team3-liquid-cards/card-'+number+'-reflow.jpg','equipment-cards/liquid/'+folder+'/four-views.jpg',
    number+' '+item.name+' · 4방향 모음','card-liquid',{
      id:'liquid-card-'+number,shareSource:'references/team3-liquid-20261110/offline-assets/card-'+number+'.jpg',shareName:'liquid/'+folder+'/four-views.jpg',
    });
}
const viewLabels={overview:'대표',front:'정면',left:'좌측',right:'우측',rear:'후면'};
for (const item of OUTDOOR_HISTORY_CARDS) for (const view of Object.keys(viewLabels)) {
  const number=pad(item.number), folder=number+'-'+outdoorNames[item.number];
  image('team3-outdoor-cards/card-'+number+(view==='overview'?'':'-'+view)+'.jpg','equipment-cards/outdoor/'+folder+'/'+view+'.jpg',
    number+' '+item.name+' · '+viewLabels[view],'card-outdoor',{id:'outdoor-card-'+number+'-'+view});
}
for (const [oldName,newName] of [['team2','team2-overview'],['floor1','floor-1'],['floor3','floor-3'],['floor4','floor-4'],['floor5-7','floors-5-7']]) {
  move('apps/site/references/owp-'+oldName+'.jpg','references/owp-team2-20261029/derived-images/owp-'+newName+'.jpg','historical-process-reference');
}
move('Image_20261110_0001.pdf','references/chiller-20261110/source/chiller-technical-drawings-and-certificates-20261110.pdf','source-document');

const receiptPath='docs/asset-organization-20261112.json';
const exists=async p=>{try{return await stat(p);}catch(e){if(e.code==='ENOENT')return null;throw e;}};
if(await exists(path.join(root,receiptPath))) throw new Error('Organization already recorded; do not rerun this migration.');
const targets=new Set();
for(const row of moves) {
  if(targets.has(row.currentPath.toLowerCase())) throw new Error('Duplicate destination: '+row.currentPath);
  targets.add(row.currentPath.toLowerCase());
  const source=await guardPath(root,row.originalPath), target=await guardPath(root,row.currentPath);
  if(await exists(target)) throw new Error('Destination exists: '+row.currentPath);
  const bytes=await readFile(source); row.bytes=bytes.length; row.sha256=createHash('sha256').update(bytes).digest('hex');
}
if(assets.length!==180||moves.length!==262) throw new Error(`Unexpected inventory: ${assets.length} assets, ${moves.length} moves`);

async function filesUnder(relative) {
  const result=[];
  for(const item of await readdir(path.join(root,relative),{withFileTypes:true})) {
    const child=relative+'/'+item.name;
    if(item.isDirectory())result.push(...await filesUnder(child)); else result.push(child);
  }
  return result;
}
const sources=[...(await filesUnder('apps/site')),...(await filesUnder('tests')),...(await filesUnder('tooling'))]
  .filter(p=>/\.(?:js|mjs|html|css)$/.test(p)&&!p.includes('vendor/')&&!p.endsWith('asset-catalog.js'));
for(const name of [...sources,'README.md','package.json']) {
  const target=path.join(root,backup,name); await mkdir(path.dirname(target),{recursive:true}); await copyFile(path.join(root,name),target);
}
await writeFile(path.join(root,'workspace/asset-organization-20261112/move-plan.json'),JSON.stringify({version:1,date:'2026-11-12',moves},null,2)+'\n');
for(const row of moves) {
  const source=await guardPath(root,row.originalPath), target=await guardPath(root,row.currentPath);
  await mkdir(path.dirname(target),{recursive:true}); await rename(source,target);
  if(createHash('sha256').update(await readFile(target)).digest('hex')!==row.sha256) throw new Error('Moved bytes differ: '+row.currentPath);
}

// Update literal current paths; source evidence manifests and older work logs stay intact.
for(const name of sources) {
  let text=await readFile(path.join(root,name),'utf8'), changed=text;
  for(const row of moves) {
    changed=changed.replaceAll(row.originalPath,row.currentPath);
    if(row.originalPath.startsWith('apps/site/')) {
      const before='./'+row.originalPath.slice('apps/site/'.length);
      const after=row.currentPath.startsWith('apps/site/')?'./'+row.currentPath.slice('apps/site/'.length):'../../'+row.currentPath;
      changed=changed.replaceAll(before,after);
    }
  }
  if(changed!==text)await writeFile(path.join(root,name),changed);
}

const catalog='// Current viewer images and their optional compact offline variants.\n// Edit paths here together with the consuming data file; npm run assets:check validates both.\nexport const SITE_ASSETS = Object.freeze([\n'+assets.map(a=>'  '+JSON.stringify(a)+',').join('\n')+'\n]);\n';
await writeFile(path.join(root,'apps/site/asset-catalog.js'),catalog);
const csvCell=value=>'"'+String(value??'').replaceAll('"','""')+'"';
const csv=[['ID','분류','설명','앱 이미지 경로','공유용 경로'],...assets.map(a=>[a.id,a.category,a.label,'apps/site/'+a.path.slice(2),a.sharePath?'apps/site/'+a.sharePath.slice(2):''])]
  .map(row=>row.map(csvCell).join(',')).join('\r\n');
await writeFile(path.join(root,'docs/asset-index.csv'),'\uFEFF'+csv+'\r\n');

// Template-based registries now use explicit, meaningful names.
const chillerFile=path.join(root,'apps/site/chiller-data.js');
let chiller=await readFile(chillerFile,'utf8');
const chillerEntries=assets.filter(a=>a.category==='drawing-chiller').map(a=>[a.id.startsWith('chiller-sheet-')?'sheet'+a.id.slice(-3):a.id.slice('chiller-'.length),a.path]);
chiller=chiller.replace(/export const CHILLER_ASSETS = Object\.fromEntries\([\s\S]*?\n\]\);/, 'export const CHILLER_ASSETS = '+JSON.stringify(Object.fromEntries(chillerEntries),null,2)+';');
await writeFile(chillerFile,chiller);
await writeFile(path.join(root,'apps/site/liquid-assets.js'),
  '// One four-side image per registered indoor card; source originals stay in references/.\nexport const LIQUID_ASSETS = '+JSON.stringify(Object.fromEntries(assets.filter(a=>a.category==='card-liquid').map(a=>[Number(a.id.slice(-3)),a.path])),null,2)+';\nexport function liquidAsset(number) {\n  const asset = LIQUID_ASSETS[number];\n  return asset && !asset.startsWith(\'data:\') && location.pathname.includes(\'/site/share/\') ? `.${asset}` : asset;\n}\n');
const facilityFile=path.join(root,'apps/site/facility-data.js');
let facility=await readFile(facilityFile,'utf8');
facility=facility.replace('`./photos/dryer-building-plan-${id < 4 ? `${id}f` : \'4f5f\'}.png`','`./assets/drawings/dryer/dryer-floor-plan-${id < 4 ? `${id}f` : \'4f5f\'}.png`');
// OWP is an archived process reference, not an active viewer image. Keep it in
// the receipt and evidence archive, rather than leaving private URLs in the UI.
facility=facility.replace(/const REF = Object\.freeze\(\{[\s\S]*?\n\}\);/,'');
facility=facility.replace(/    reference: id === 2[^\n]+\n    photos: [^\n]+\n/, "    reference: `./assets/drawings/dryer/dryer-floor-plan-${id < 4 ? `${id}f` : '4f5f'}.png`,\n    photos: [...(id === 1 ? PREPARATION_PHOTOS : []), `./assets/drawings/dryer/dryer-floor-plan-${id < 4 ? `${id}f` : '4f5f'}.png`],\n");
await writeFile(facilityFile,facility);
const preparationFile=path.join(root,'apps/site/preparation-data.js');
let preparation=await readFile(preparationFile,'utf8');
preparation=preparation.replace("const frame = second => `./photos/preparation-room/frame-${String(second).padStart(3, '0')}s.jpg`;", "const frame = second => [76, 78].includes(second)\n  ? `./assets/drawings/preparation/current-room-plan-frame-${String(second).padStart(3, '0')}s.jpg`\n  : `./photos/preparation-room/frame-${String(second).padStart(3, '0')}s.jpg`;");
await writeFile(preparationFile,preparation);
const removed=[];
async function prune(relative) {
  const absolute=await guardPath(root,relative); if(!await exists(absolute))return;
  for(const entry of await readdir(absolute,{withFileTypes:true}))if(entry.isDirectory())await prune(relative+'/'+entry.name);
  if(!(await readdir(absolute)).length){await rmdir(absolute);removed.push(relative);}
}
await prune('apps/site/photos'); await prune('apps/site/references');
await writeFile(path.join(root,receiptPath),JSON.stringify({version:1,date:'2026-11-12',viewerImages:assets.length,shareImages:assets.filter(a=>a.sharePath).length,sourceBytesPreserved:true,backup,removedEmptyDirectories:removed,moves},null,2)+'\n');
console.log(`Organized ${assets.length} viewer images; preserved ${moves.length} moved files and their SHA256 receipts.`);
