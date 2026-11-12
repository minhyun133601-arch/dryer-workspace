import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Presentation, PresentationFile } from '@oai/artifact-tool';

const workspaceDir = path.resolve('.');
const SKILL_DIR = 'C:/Users/user/.codex/plugins/cache/openai-primary-runtime/presentations/26.1026.10807/skills/presentations';
const RUNTIME_PYTHON = 'C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
process.env.RUNTIME_NODE_MODULES='C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const outDir = path.join(workspaceDir,'outputs','2027_KPI_투자근거');
const buildDir = path.join(workspaceDir,'_work','deck_build');
const renderDir = path.join(buildDir,'renders');
await fs.mkdir(outDir,{recursive:true});
await fs.mkdir(renderDir,{recursive:true});
const dataPath = path.resolve(process.argv[2] || '_work/deck_content.json');
const content = JSON.parse(await fs.readFile(dataPath,'utf8'));
const presentation = Presentation.create({slideSize:{width:1280,height:720}});
const F='Malgun Gothic';
const C={navy:'#18334E',teal:'#007F82',text:'#213747',muted:'#667888',pale:'#EDF3F7',line:'#CFDCE4',amber:'#9B5F00'};
const nativeTableSlides=[];

function tx(s,text,x,y,w,h,size=26,color=C.text,bold=false,align='left'){
 const t=s.shapes.add({geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});
 t.text=String(text??'');
 t.text.style={typeface:F,fontSize:size,color,bold,alignment:align,verticalAlignment:'top',insets:0,autoFit:'none',wrap:'square'};
 return t;
}
async function picture(s,file,x,y,w,h){
 const fp=path.isAbsolute(file)?file:path.resolve('_work',file);
 const bytes=await fs.readFile(fp);
 s.images.add({blob:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),contentType:/\.png$/i.test(fp)?'image/png':'image/jpeg',alt:'원본 보고자료의 설비 현장사진',fit:'contain',position:{left:x,top:y,width:w,height:h}});
}
function table(s,rows,x,y,w,h,colWidths,opts={}){
 const t=s.tables.add({rows:rows.length,columns:rows[0].length,left:x,top:y,width:w,height:h,values:rows,columnWidths:colWidths});
 t.styleOptions={headerRow:true,bandedRows:false};
 t.borders.assign({style:'solid',fill:C.line,width:0.65});
 for(let r=0;r<rows.length;r++){
  t.rows[r].height = r===0?(opts.headerHeight??48):((h-(opts.headerHeight??48))/(rows.length-1));
  for(let c=0;c<rows[0].length;c++){
   const cell=t.getCell(r,c);
   cell.fill=r===0?C.navy:(r%2===0?'#F3F6F8':'#FFFFFF');
   cell.text.style={typeface:F,fontSize:r===0?(opts.headerSize??22):(opts.fontSize??22),color:r===0?'#FFFFFF':C.text,bold:r===0,alignment:'left',verticalAlignment:'middle',insets:{top:8,right:10,bottom:8,left:12},autoFit:'none',wrap:'square'};
   if(opts.totalRow && r===rows.length-1){cell.fill='#E1EEF0';cell.text.style={typeface:F,fontSize:opts.fontSize??22,color:C.navy,bold:true,verticalAlignment:'middle',insets:{top:8,right:10,bottom:8,left:12}};}
  }
 }
 return t;
}
function points(s,arr,x,y,w,h,opts={}){
 const n=arr.length, gap=opts.gap??22;
 const each=(h-gap*(n-1))/n;
 arr.forEach((p,i)=>{
  const yy=y+i*(each+gap);
  if(typeof p==='string'){tx(s,p,x,yy,w,each,opts.fontSize??26);return;}
  tx(s,p.label??'',x,yy,w,34,opts.labelSize??23,C.teal,true);
  tx(s,p.text??'',x,yy+42,w,Math.max(40,each-42),opts.fontSize??26,C.text);
 });
}
for(const [i,d] of content.slides.entries()){
 const s=presentation.slides.add();s.background.fill='#FFFFFF';
 const slideNo=i+1;
 if(d.type==='cover'){
  tx(s,d.title,64,150,1144,200,60,C.navy,true);
  if(d.subtitle)tx(s,d.subtitle,68,380,1090,100,30,C.text);
  tx(s,d.date??'2026.11.03',68,575,900,34,22,C.muted);
  if(d.image)await picture(s,d.image,1080,40,135,48);
 }else{
  tx(s,d.title,62,46,1150,74,d.titleSize??42,C.navy,true);
  let contentY=146;
  if(d.subtitle){tx(s,d.subtitle,64,124,1150,54,24,C.muted);contentY=195;}
  const bottom=d.footnote?615:642;
  const available=bottom-contentY;
  if(d.type==='table'){
   table(s,d.rows,64,contentY,1152,d.tableHeight??available,d.columns,{fontSize:d.fontSize??22,headerSize:d.headerSize??22,totalRow:d.totalRow,headerHeight:d.headerHeight});
   nativeTableSlides.push(slideNo);
  }else if(d.type==='focus'){
   if(d.image){
    await picture(s,d.image,64,contentY,390,Math.min(390,available-36));
    if(d.imageCaption)tx(s,d.imageCaption,66,contentY+Math.min(390,available-36)+12,390,40,18,C.muted);
    points(s,d.points,500,contentY,708,available,{fontSize:d.fontSize??25,labelSize:23,gap:18});
   }else points(s,d.points,66,contentY,1140,available,{fontSize:d.fontSize??26});
  }else if(d.type==='numbers'){
   const metrics=d.metrics??[];const col=1152/metrics.length;
   metrics.forEach((m,j)=>{
    tx(s,m.value,64+j*col,contentY+10,col-32,100,m.size??64,m.color??C.teal,true);
    tx(s,m.label,64+j*col,contentY+120,col-32,68,26,C.navy,true);
    if(m.text)tx(s,m.text,64+j*col,contentY+204,col-32,120,24,C.text);
   });
   if(d.points)points(s,d.points,66,contentY+350,1142,Math.max(120,available-350),{fontSize:24,labelSize:22,gap:12});
  }else if(d.type==='mixed'){
   const topH=d.tableHeight??240;
   table(s,d.rows,64,contentY,1152,topH,d.columns,{fontSize:d.fontSize??24,headerSize:23,totalRow:d.totalRow});
   nativeTableSlides.push(slideNo);
   points(s,d.points,66,contentY+topH+30,1140,available-topH-30,{fontSize:d.pointsSize??25,labelSize:23,gap:18});
  }else{
   points(s,d.points??[],66,contentY,1140,available,{fontSize:d.fontSize??28,labelSize:d.labelSize??24,gap:d.gap??26});
  }
  if(d.footnote)tx(s,d.footnote,64,d.footnoteY??630,1130,d.footnoteHeight??42,d.footnoteSize??18,C.muted);
 }
 tx(s,String(slideNo).padStart(2,'0'),1193,675,48,24,16,C.muted,false,'right');
 const notes=[d.note??'',...(d.sources??[]).map(x=>'출처: '+x)];
 s.speakerNotes.text=notes.filter(Boolean).join('\n\n');
}
for(let i=0;i<presentation.slides.items.length;i++){
 const slide=presentation.slides.items[i];
 const png=await presentation.export({slide,format:'png',scale:1.25});
 await fs.writeFile(path.join(renderDir,`slide-${String(i+1).padStart(2,'0')}.png`),new Uint8Array(await png.arrayBuffer()));
 const lay=await slide.export({format:'layout'});
 await fs.writeFile(path.join(renderDir,`slide-${String(i+1).padStart(2,'0')}.layout.json`),await lay.text());
}
const candidatePath=path.join(buildDir,'candidate.pptx');
await(await PresentationFile.exportPptx(presentation)).save(candidatePath);
await fs.writeFile(path.join(buildDir,'spec.json'),JSON.stringify({nativeTableSlides,slideCount:content.slides.length},null,2));
const finalName=process.argv[3]??'2027_KPI_투자이행_근거보고서.pptx';
const finalPath=path.join(outDir,finalName);
const {finalizePresentation}=await import(pathToFileURL(path.join(SKILL_DIR,'container_tools','artifact_tool_utils.mjs')).href);
const result=await finalizePresentation({
 workspaceDir,candidatePath,finalPath,pythonExecutable:RUNTIME_PYTHON,
 integrityValidatorPath:path.join(SKILL_DIR,'container_tools','inspect_presentation_package_integrity.py'),
 layoutValidatorPath:path.join(SKILL_DIR,'container_tools','inspect_presentation_layout_geometry.py'),
 layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-bullet-geometry','--validate-heading-fit',...nativeTableSlides.flatMap(n=>['--require-native-table-slide',String(n)])],
 requiredNativeTableOwnerSlides:nativeTableSlides,
 requiredNativeChartOwnerSlides:[],
 fontPolicy:{basis:'design',families:[F]},
 verifyArtifactToolImport:true,
 receiptPath:path.join(buildDir,finalName+'.validation.json'),
});
console.log(JSON.stringify(result,null,2));
