import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const appUrl = new URL('../tooling/drawing-review/public/app.js', import.meta.url);
const htmlUrl = new URL('../tooling/drawing-review/public/index.html', import.meta.url);

class Element {
  constructor(id='') {
    Object.assign(this, { id, hidden:false, value:'', innerHTML:'', textContent:'', style:{}, dataset:{}, attributes:{}, listeners:{}, disabled:false, checked:false });
    const names = new Set();
    this.classList = {
      add(...values) { values.forEach((value)=>names.add(value)); },
      remove(...values) { values.forEach((value)=>names.delete(value)); },
      contains(value) { return names.has(value); },
      toggle(value,force) { const enabled=force??!names.has(value); enabled?names.add(value):names.delete(value); return enabled; },
    };
  }
  setAttribute(key,value) { this.attributes[key]=value; }
  addEventListener(name,callback) { this.listeners[name]=callback; }
  querySelectorAll(selector) { return selector==='button' ? this.buttons||[] : []; }
  querySelector(selector) { return selector==='span' ? this.child??=new Element() : null; }
  get options() { return [...this.innerHTML.matchAll(/<option value="([^"]*)"/g)].map((entry)=>({value:entry[1]})); }
  getBoundingClientRect() { return {left:0,top:0,width:1000,height:700}; }
  focus() {}
  scrollIntoView() {}
  reportValidity() { return true; }
}

async function harness({storage=new Map(),db={}}={}) {
  const [source,html]=await Promise.all([readFile(appUrl,'utf8'),readFile(htmlUrl,'utf8')]);
  const elements=new Map([...html.matchAll(/id="([^"]+)"/g)].map((entry)=>[entry[1],new Element(entry[1])]));
  const get=(id)=>{assert.ok(elements.has(id),`known HTML element ${id}`);return elements.get(id);};
  for (const [id,key,values] of [['scopeOptions','scope',['ready','all']],['statusOptions','status',['unreviewed','discuss','hold','reviewed']]]) {
    get(id).buttons=values.map((value)=>{const button=new Element();button.dataset[key]=value;return button;});
  }
  get('accessGate').hidden=true;
  const fixtures=[
    ['b','.dwg','02_동별건축','북정',1,'ready'],
    ['d','.xlsx','04_검토필요','북정',1,'ready'],
    ['c','.jpg','03_층별·생산팀평면','유산',1,'ready'],
    ['e','.dwg','01_전체배치','북정',0,'failed'],
    ['a','.pdf','01_전체배치','북정',2,'ready'],
  ].map(([key,ext,category,site,pages,status])=>({id:key.repeat(64),name:`도면 ${key}${ext}`,ext,category,site,bytes:2048,thumbnailUrl:`/thumbnail/${key.repeat(64)}`,originalUrl:`/original/${key.repeat(64)}`,preview:{status,pages:Array.from({length:pages},(_,index)=>({src:`/cache/${key.repeat(64)}/page-${index+1}.png`,width:1000,height:700}))}}));
  const calls=[],posted=[],windowListeners={},documentListeners={};
  const location={href:'http://127.0.0.1:4174/drawing-review/',origin:'http://127.0.0.1:4174',pathname:'/drawing-review/',search:'',hash:''};
  const parent={postMessage:(message)=>posted.push(message)};
  const window={parent,addEventListener:(name,callback)=>{windowListeners[name]=callback;}};
  const document={hidden:false,getElementById:get,querySelectorAll:()=>[],querySelector:()=>null,addEventListener:(name,callback)=>{documentListeners[name]=callback;}};
  let clipboard='';
  const fetch=async (url,options={})=>{
    calls.push({url,options});
    assert.ok(url.startsWith('/drawing-review/'),`proxy prefix retained: ${url}`);
    const pathname=url.slice('/drawing-review'.length);
    let body;
    if(pathname==='/api/bootstrap') body={token:'fixture-token',remote:false};
    else if(pathname==='/api/catalog') body={items:structuredClone(fixtures),states:structuredClone(db)};
    else if(pathname==='/api/progress') body={ready:4,failed:1};
    else {
      const id=pathname.split('/')[3],item=fixtures.find((entry)=>entry.id===id);
      assert.ok(item,`fixture route ${pathname}`);
      if(pathname.endsWith('/state')) body=db[id]={status:'unreviewed',starred:false,...db[id],...JSON.parse(options.body)};
      else body={preview:structuredClone(item.preview),state:db[id]||{status:'unreviewed',starred:false},comments:[]};
    }
    return {ok:true,status:200,json:async()=>structuredClone(body)};
  };
  const context=vm.createContext({document,window,location,history:{replaceState(_a,_b,url){location.href=String(url);}},localStorage:{getItem:(key)=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value)},fetch,URL,URLSearchParams,Image:Element,HTMLImageElement:Element,innerWidth:1400,navigator:{clipboard:{writeText:async(value)=>{clipboard=value;}}},setTimeout:()=>1,clearTimeout(){},setInterval(){},console});
  const instrumented=source.replace(/  initialize\(\);\s*\}\)\(\);\s*$/,`  globalThis.review={initialize,selectDrawing,moveDrawing,movePage,updateState,applyFilters,renderOverview,copyCurrentInfo,poll,safeUrl,setDraftPin,rotateDrawing,rotatedSize,imageToStagePoint,stageToImagePoint,centerOnPoint,zoomBy,snapshot:()=>({ids:filtered.map(item=>item.id),current:current?.id,page:pageIndex,pin:pendingPin,scope,hostActive,quarterTurns,scale,imageX,imageY})};\n})();`);
  assert.notEqual(instrumented,source,'instrument only the initialization entry point');
  new vm.Script(instrumented,{filename:'drawing-review-app.js'}).runInContext(context);
  await context.review.initialize();
  return {app:context.review,get,fixtures,calls,posted,parent,windowListeners,documentListeners,location,storage,db,clipboard:()=>clipboard};
}

test('drawing review starts with ready drawings, ordered by modeling stage, and keeps URLs inside the common server',async()=>{
  const h=await harness();
  assert.deepEqual(Array.from(h.app.snapshot().ids),['a','b','c'].map((key)=>key.repeat(64)));
  assert.equal(h.get('readyCount').textContent,'3');
  assert.equal(h.get('allCount').textContent,'5');
  assert.equal(h.posted[0].moduleId,'drawings');
  assert.equal(h.get('originalLink').href,`/drawing-review/original/${'a'.repeat(64)}`);
  assert.match(h.get('drawingList').innerHTML,/loading="lazy"/);
  assert.match(h.get('drawingList').innerHTML,/\/drawing-review\/thumbnail\//);
  h.app.renderOverview();
  assert.equal((h.get('overviewGrid').innerHTML.match(/data-overview-id=/g)||[]).length,3);
  assert.equal(h.app.safeUrl('https://elsewhere.invalid/secret'),'#');
  h.get('scopeOptions').listeners.click({target:{closest:()=>({dataset:{scope:'all'}})}});
  assert.equal(h.app.snapshot().ids.length,5,'all originals remain reachable');
});

test('previous and next preserve per-drawing page, unsent pinned discussion, and saved usage candidates across reload',async()=>{
  const h=await harness();
  h.app.movePage(1);
  h.get('commentInput').value='통로 모델링에 이 도면을 사용하면 좋겠습니다.';
  h.app.setDraftPin({page:2,x:.25,y:.5});
  await h.app.moveDrawing(1);
  assert.equal(h.app.snapshot().current,'b'.repeat(64));
  assert.equal(h.get('commentInput').value,'');
  await h.app.moveDrawing(-1);
  assert.equal(h.app.snapshot().page,1);
  assert.match(h.get('commentInput').value,/통로 모델링/);
  assert.equal(h.app.snapshot().pin.page,2);
  await h.app.updateState({starred:true});
  assert.equal(h.db['a'.repeat(64)].starred,true);
  assert.equal(h.get('candidateCount').textContent,'1');
  h.get('starFilter').listeners.click();
  assert.equal(h.app.snapshot().ids.length,1);
  assert.equal(h.get('nextDrawing').disabled,true);
  await h.app.copyCurrentInfo();
  assert.match(h.clipboard(),/도면: 도면 a.pdf/);
  assert.match(h.clipboard(),/페이지: 2 \/ 2/);
  assert.match(h.clipboard(),/사용 후보: 선택/);
  const reopened=await harness({db:h.db,storage:h.storage});
  assert.equal(reopened.get('candidateCount').textContent,'1');
  assert.match(reopened.get('commentInput').value,/통로 모델링/);
});

test('inactive workspace modules pause polling and resume when selected again',async()=>{
  const h=await harness();
  const visibility=(active)=>h.windowListeners.message({source:h.parent,origin:h.location.origin,data:{type:'dryer-workspace:visibility',active}});
  visibility(false);
  const before=h.calls.length;
  await h.app.poll();
  assert.equal(h.calls.length,before);
  visibility(true);
  await new Promise((resolve)=>setImmediate(resolve));
  assert.ok(h.calls.length>before);
  assert.equal(h.app.snapshot().hostActive,true);
});

test('quarter-turn rotation fits a sideways sheet, maps clicked pins to original coordinates, and survives revisiting',async()=>{
  const h=await harness();
  const loadSheet=()=>{h.get('drawingImage').naturalWidth=5840;h.get('drawingImage').naturalHeight=8270;h.get('drawingImage').onload();};
  loadSheet();
  const portraitScale=h.app.snapshot().scale;
  h.get('rotateBtn').listeners.click();
  assert.equal(h.app.snapshot().quarterTurns,1);
  assert.ok(h.app.snapshot().scale>portraitScale,'landscape fit makes a sideways portrait drawing larger');
  assert.equal(h.app.rotatedSize().width,8270);
  assert.equal(h.app.rotatedSize().height,5840);
  assert.match(h.get('imagePlane').style.transform,/rotate\(90deg\)/);
  const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-9,`${actual} approximately ${expected}`);
  for(let turn=0;turn<4;turn++){
    for(const [x,y] of [[0,0],[1,1],[.27,.62]]){
      const stage=h.app.imageToStagePoint(x,y),original=h.app.stageToImagePoint(stage.x,stage.y);
      near(original.x,x);near(original.y,y);
      assert.ok(stage.x>=0 && stage.x<=1000 && stage.y>=0 && stage.y<=700,'fitted rotated corners stay in the viewport');
    }
    h.app.rotateDrawing();
  }
  assert.equal(h.app.snapshot().quarterTurns,1,'four rotations return to the same view');
  h.app.zoomBy(1.8,460,330);
  const clicked=h.app.imageToStagePoint(.27,.62);
  h.get('pinBtn').listeners.click();
  h.get('stage').listeners.pointerdown({button:0,target:{closest:()=>null},clientX:clicked.x,clientY:clicked.y});
  near(h.app.snapshot().pin.x,.27);near(h.app.snapshot().pin.y,.62);
  assert.match(h.get('pinLayer').innerHTML,/rotate\(-90deg\)/,'pin labels stay upright while the original image plane rotates');
  h.app.centerOnPoint(.27,.62);
  const focused=h.app.imageToStagePoint(.27,.62);near(focused.x,500);near(focused.y,350);
  await h.app.moveDrawing(1);
  assert.equal(h.app.snapshot().quarterTurns,0,'each drawing has its own orientation');
  await h.app.moveDrawing(-1);loadSheet();
  assert.equal(h.app.snapshot().quarterTurns,1);
  near(h.app.snapshot().pin.x,.27);near(h.app.snapshot().pin.y,.62);
  const reopened=await harness({storage:h.storage});
  assert.equal(reopened.app.snapshot().quarterTurns,1,'rotation persists in localStorage');
});

test('rotation shortcut leaves text entry unchanged',async()=>{
  const h=await harness();
  h.get('drawingImage').onload();
  let prevented=false;
  h.documentListeners.keydown({key:'r',target:{tagName:'TEXTAREA'},preventDefault(){prevented=true;}});
  assert.equal(h.app.snapshot().quarterTurns,0);
  assert.equal(prevented,false);
  h.documentListeners.keydown({key:'r',target:{tagName:'DIV'},preventDefault(){prevented=true;}});
  assert.equal(h.app.snapshot().quarterTurns,1);
  assert.equal(prevented,true);
});
