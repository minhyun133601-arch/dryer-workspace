import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {Presentation,PresentationFile} from '@oai/artifact-tool';

const root=process.cwd();
const skill='C:/Users/user/.codex/plugins/cache/openai-primary-runtime/presentations/26.1026.10807/skills/presentations';
const runtime='C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies';
const tmp=path.join(root,'_work','year_bridge');
const renders=path.join(tmp,'renders');
const out=path.join(root,'outputs','2026_2027_투자실적_추진계획');
const candidate=path.join(tmp,'candidate.pptx');
const final=path.join(out,'2026실적_2027투자계획_통합근거.pptx');
process.env.RUNTIME_NODE_MODULES=path.join(runtime,'node','node_modules');
await fs.mkdir(renders,{recursive:true});await fs.mkdir(out,{recursive:true});
const F='Malgun Gothic';
const C={navy:'#18334E',teal:'#007F82',text:'#213747',muted:'#65798B',pale:'#EDF3F7',line:'#CFDCE4',amber:'#945B12'};
const nativeTables=[];
const p=Presentation.create({slideSize:{width:1280,height:720}});
const spec=JSON.parse(await fs.readFile(path.join(root,'_work','year_bridge_content.json'),'utf8'));
const items=JSON.parse(await fs.readFile(path.join(root,'_work','content.json'),'utf8')).items;
const total=items.reduce((a,x)=>a+x.budget_m,0);
if(total!==1795||items.length!==14)throw new Error('2027 budget reconciliation failed');

function tx(s,text,x,y,w,h,size=25,color=C.text,bold=false,align='left'){
 const q=s.shapes.add({geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});
 q.text=String(text??'');
 q.text.style={typeface:F,fontSize:size,color,bold,alignment:align,verticalAlignment:'top',insets:0,autoFit:'none',wrap:'square'};
 return q;
}
function line(s,x,y,w,color=C.line){s.shapes.add({geometry:'rect',position:{left:x,top:y,width:w,height:1.2},fill:color,line:{fill:'none',width:0}});}
async function pic(s,file,x,y,w,h,alt){
 const bytes=await fs.readFile(path.join(root,'_work',file));
 s.images.add({blob:bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),contentType:/\.png$/i.test(file)?'image/png':'image/jpeg',alt,fit:'contain',position:{left:x,top:y,width:w,height:h}});
}
function table(s,rows,x,y,w,h,widths,options={}){
 const t=s.tables.add({rows:rows.length,columns:rows[0].length,left:x,top:y,width:w,height:h,values:rows,columnWidths:widths});
 t.styleOptions={headerRow:true,bandedRows:false};t.borders.assign({style:'solid',fill:C.line,width:0.6});
 const hh=options.headerHeight??44;
 for(let r=0;r<rows.length;r++){
  t.rows[r].height=r===0?hh:(h-hh)/(rows.length-1);
  for(let c=0;c<rows[0].length;c++){
   const cell=t.getCell(r,c);cell.fill=r===0?C.navy:(r%2===0?'#F2F6F8':'#FFFFFF');
   cell.text.style={typeface:F,fontSize:r===0?(options.headerSize??21):(options.fontSize??22),color:r===0?'#FFFFFF':C.text,bold:r===0,alignment:r>0&&options.numericColumns?.includes(c)?'right':'left',verticalAlignment:'middle',insets:{top:options.padding??7,right:11,bottom:options.padding??7,left:12},autoFit:'none',wrap:'square'};
   if(options.totalRow&&r===rows.length-1){cell.fill='#E1EEF0';cell.text.style={typeface:F,fontSize:options.fontSize??22,color:C.navy,bold:true,alignment:options.numericColumns?.includes(c)?'right':'left',verticalAlignment:'middle',insets:{top:7,right:11,bottom:7,left:12},wrap:'square'};}
  }
 }
 return t;
}
function blocks(s,list,x,y,w,step=155){
 list.forEach((b,j)=>{const yy=y+j*step;tx(s,b.label,x,yy,w,58,23,C.teal,true);tx(s,b.text,x,yy+65,w,86,25);});
}
function points(s,list,x,y,w,h,size=25){
 const gap=18,each=(h-gap*(list.length-1))/list.length;
 list.forEach((b,j)=>{const yy=y+j*(each+gap);tx(s,b.label,x,yy,w,52,23,C.teal,true);tx(s,b.text,x,yy+58,w,each-58,size);});
}

if(!process.argv.includes('--finalize')){
 for(const [i,d] of spec.slides.entries()){
  const s=p.slides.add();s.background.fill='#FFFFFF';const n=i+1;
  if(d.type==='cover'){
   await pic(s,'deck_assets/plan_1_0.png',1080,42,140,51,'희창 회사 로고');
   tx(s,d.title,65,162,1135,190,57,C.navy,true);
   line(s,68,385,310,C.teal);
   tx(s,d.subtitle,68,424,1120,100,29);
   tx(s,d.date,68,606,900,32,22,C.muted);
  }else{
   tx(s,d.title,60,42,1157,92,d.titleSize??36,C.navy,true);
   let y=160;
   if(d.subtitle){tx(s,d.subtitle,64,132,1150,38,23,C.muted);y=195;}
   if(d.type==='overview'){
    [d.left,d.right].forEach((b,j)=>{
     const x=j===0?64:664;
     tx(s,b.year,x,166,548,42,28,j===0?C.navy:C.teal,true);
     tx(s,b.value,x,232,548,83,49,j===0?C.navy:C.teal,true);
     tx(s,b.label,x,326,548,62,24,C.navy,true);
     line(s,x,405,535);
     tx(s,b.text,x,433,542,153,26);
    });
   }else if(d.type==='years'){
    tx(s,d.leftTitle,64,166,548,39,28,C.navy,true);tx(s,d.rightTitle,664,166,548,39,28,C.teal,true);
    line(s,64,209,548);line(s,664,209,548);
    blocks(s,d.left,64,235,548,151);blocks(s,d.right,664,235,548,151);
    tx(s,d.bottom,64,563,1152,68,23,C.navy);
   }else if(d.type==='table'){
    table(s,d.rows,64,y,1152,d.tableHeight??440,d.columns,{fontSize:d.fontSize??22,totalRow:d.totalRow,numericColumns:d.rows[0].at(-1)==='예산'?[d.rows[0].length-1]:[]});
    nativeTables.push(n);
   }else if(d.type==='mixed'){
    table(s,d.rows,64,y,1152,d.tableHeight,d.columns,{fontSize:d.fontSize??22});nativeTables.push(n);
    points(s,d.points,66,y+d.tableHeight+28,1148,615-y-d.tableHeight-28,d.pointsSize??25);
   }else if(d.type==='focus'){
    await pic(s,d.image,64,y+15,390,325,'2027 투자계획의 폭기조 부식 현황사진');
    tx(s,d.imageCaption,66,y+365,390,64,19,C.muted);
    points(s,d.points,500,y,710,450,d.fontSize??25);
   }else if(d.type==='schedule'){
    const rows=[['투자항목','예산','1분기','2분기','3분기','4분기']];
    items.forEach(v=>{
     const names={1:'조제실 전기·자동화',2:'건조실 PLC',3:'승강기 교체',4:'폐수 집수조 증설',5:'압축공기 효율개선',6:'통신 인프라 확장',7:'SD 리턴브로와',8:'SD·MSD 송풍기 팬',9:'고압노즐밸브',10:'균질기 PLC·예비품',11:'무중력혼합기',12:'폭기조 덮개·지지대',13:'여과집진시설',14:'생산동 외벽 방수'};
     const dates=[];for(let q=0;q<4;q++){const lo=Math.max(v.start_month,q*3+1),hi=Math.min(v.end_month,q*3+3);dates.push(lo<=hi?(lo===hi?`${lo}월`:`${lo}~${hi}월`):'');}
     rows.push([names[Number(v.id)],String(v.budget_m),...dates]);
    });
    const t=table(s,rows,64,151,1152,468,[372,100,170,170,170,170],{fontSize:18,headerSize:20,headerHeight:34,padding:2,numericColumns:[1]});
    t.cells.block({row:0,column:0,rowCount:rows.length,columnCount:6}).assign({margins:{top:1,right:11,bottom:1,left:12}});
    for(let r=1;r<rows.length;r++)for(let c=2;c<6;c++)if(rows[r][c])t.getCell(r,c).fill='#DCEDEE';
    nativeTables.push(n);
   }else if(d.type==='assetAppendix'||d.type==='repairAppendix'){
    const subset=items.filter(x=>d.type==='assetAppendix'?x.category==='고정자산':x.category!=='고정자산');
    const rows=[['번호','투자항목','예산','일정','담당','계획서']];
    subset.forEach(x=>rows.push([x.id,x.name,String(x.budget_m),x.start_month===x.end_month?`${x.start_month}월`:`${x.start_month}~${x.end_month}월`,x.team,`p${x.source_slide}`]));
    rows.push(['합계',`${subset.length}건`,subset.reduce((a,x)=>a+x.budget_m,0).toLocaleString('en-US'),'','','']);
    table(s,rows,64,y,1152,440,[72,452,105,125,214,184],{fontSize:d.type==='assetAppendix'?22:20,headerSize:21,totalRow:true,numericColumns:[2]});nativeTables.push(n);
   }
   if(d.footnote)tx(s,d.footnote,64,641,1149,47,17,C.muted);
  }
  tx(s,String(n).padStart(2,'0'),1192,684,48,23,16,C.muted,false,'right');
  s.speakerNotes.text=[d.notes??'',...d.sources.map(x=>'출처: '+x),'공통 원본: 27년 고정투자자산관련 총합본 20261014 rev03.pptx; (공무환경팀) 10월 KPI 20261102.pptx; 보고서별 폴더 내 해당 보고서 본문·첨부'].filter(Boolean).join('\n\n');
 }
 for(let i=0;i<p.slides.items.length;i++){
  const s=p.slides.items[i];const blob=await p.export({slide:s,format:'png',scale:1.25});
  await fs.writeFile(path.join(renders,`slide-${String(i+1).padStart(2,'0')}.png`),new Uint8Array(await blob.arrayBuffer()));
  const lay=await s.export({format:'layout'});await fs.writeFile(path.join(renders,`slide-${String(i+1).padStart(2,'0')}.layout.json`),await lay.text());
 }
 await(await PresentationFile.exportPptx(p)).save(candidate);
 await fs.writeFile(path.join(tmp,'manifest.json'),JSON.stringify({slideCount:p.slides.items.length,nativeTables,sourceBudgets:items.map(x=>({id:x.id,budget:x.budget_m})),total},null,2));
 console.log(JSON.stringify({candidate,slideCount:p.slides.items.length,nativeTables,renders}));
}else{
 const manifest=JSON.parse(await fs.readFile(path.join(tmp,'manifest.json'),'utf8'));
 const {finalizePresentation}=await import(pathToFileURL(path.join(skill,'container_tools','artifact_tool_utils.mjs')).href);
 const result=await finalizePresentation({workspaceDir:root,candidatePath:candidate,finalPath:final,pythonExecutable:path.join(runtime,'python','python.exe'),integrityValidatorPath:path.join(skill,'container_tools','inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(skill,'container_tools','inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-bullet-geometry','--validate-heading-fit',...manifest.nativeTables.flatMap(n=>['--require-native-table-slide',String(n)])],explicitTotalSlideCount:manifest.slideCount,requiredNativeTableOwnerSlides:manifest.nativeTables,requiredNativeChartOwnerSlides:[],fontPolicy:{basis:'design',families:[F]},verifyArtifactToolImport:true,receiptPath:path.join(tmp,'final.validation.json')});
 console.log(JSON.stringify(result,null,2));
}
