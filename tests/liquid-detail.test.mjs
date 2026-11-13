import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from '../apps/shared/vendor/three.module.js';
import {LIQUID_ROOM,LIQUID_ROOMS,LIQUID_EQUIPMENT} from '../apps/site/liquid-data.js';
import {LIQUID_ASSETS} from '../apps/site/liquid-assets.js';
import {createLiquidModel} from '../apps/site/liquid-models.js';
import {createProximityDoorController} from '../apps/site/proximity-doors.js';

test('all 52 liquid cards retain their identities, eight indoor rooms and four-side references without duplicating outdoor or team 2 equipment',async()=>{
  const cards=JSON.parse(await readFile(new URL('./fixtures/evidence/liquid-cards.json',import.meta.url),'utf8'));
  assert.equal(LIQUID_EQUIPMENT.length,52);assert.equal(LIQUID_ROOMS.length,8);assert.equal(new Set(LIQUID_EQUIPMENT.map(e=>e.id)).size,52);
  assert.deepEqual(LIQUID_EQUIPMENT.map(e=>e.cardNumber).sort((a,b)=>a-b),cards.map(c=>c._archiveNumber).sort((a,b)=>a-b));
  const rooms=new Set(LIQUID_ROOMS.map(r=>r.id));
  for(const item of LIQUID_EQUIPMENT){
    const card=cards.find(c=>c._archiveNumber===item.cardNumber);assert.equal(item.name,card.name);assert.ok(rooms.has(item.roomId));
    assert.equal(item.id,`liquid-card-${String(item.cardNumber).padStart(3,'0')}`);assert.ok(item.position.every(Number.isFinite));assert.ok(item.confidence);
    const asset=LIQUID_ASSETS[item.cardNumber];assert.ok(asset);assert.ok((await stat(new URL(`../apps/site/${asset.slice(2)}`,import.meta.url))).size>1000);
  }
  assert.equal(Object.keys(LIQUID_ASSETS).length,52);
});

async function harness({failRenderer=false,callbacks,inline=false}={}){
  let modalShows=0;
  class Node{
    constructor(){this.dataset={};this.style={};this.children=[];this.attributes={};this.listeners=new Map();this.classList={toggle(){},remove(){},add(){}};this.checked=false;this.value='';}
    append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this.children=[...nodes];}
    setAttribute(k,v){this.attributes[k]=v;}addEventListener(k,f){this.listeners.set(k,f);}click(){this.listeners.get('click')?.({target:this});}
    showModal(){modalShows++;this.open=true;}close(){const wasOpen=this.open;this.open=false;if(wasOpen)this.listeners.get('close')?.();}remove(){this.removed=true;}getBoundingClientRect(){return{width:960,height:650};}
  }
  const nodes=new Map(),groups=new Map(),dialogs=[],panels=[],errors=[],body=new Node(),host=new Node();
  const node=k=>{if(!nodes.has(k))nodes.set(k,new Node());return nodes.get(k);};
  for(const[sel,values,key]of[
    ['[data-liquid-room]',['all',...LIQUID_ROOMS.map(r=>r.id)],'liquidRoom'],
    ['[data-liquid-equipment]',LIQUID_EQUIPMENT.map(e=>e.id),'liquidEquipment'],
    ['[data-liquid-view]',['iso','top','front','side'],'liquidView']
  ])groups.set(sel,values.map(value=>{const n=new Node();n.dataset[key]=value;return n;}));
  let liveModel,currentCamera,options,renders=0,clock=0,nextFrame=0;
  const frames=new Map(),documentEvents=new Map();
  const document={body,hidden:false,
    addEventListener:(name,callback)=>documentEvents.set(name,callback),removeEventListener:name=>documentEvents.delete(name),
    createElement(tag){const el=new Node();if(tag==='dialog'||tag==='section'){(tag==='dialog'?dialogs:panels).push(el);el.querySelector=node;el.querySelectorAll=s=>groups.get(s)||[];}return el;}};
  class Renderer{constructor(){if(failRenderer)throw Error('No WebGL');}setPixelRatio(){}setSize(){}render(){renders++;}dispose(){}}
  const ctx=vm.createContext({THREE:{...THREE,WebGLRenderer:Renderer},LIQUID_ROOM,LIQUID_ROOMS,LIQUID_EQUIPMENT,devicePixelRatio:1,
    liquidAsset:n=>LIQUID_ASSETS[n],ResizeObserver:class{observe(){}disconnect(){}},console:{error:(...e)=>errors.push(e)},
    document,createProximityDoorController,performance:{now:()=>clock},
    requestAnimationFrame(callback){const id=++nextFrame;frames.set(id,callback);return id;},cancelAnimationFrame:id=>frames.delete(id),
    createLiquidModel(args){liveModel=createLiquidModel(args);return liveModel;},
    createDetailCamera(canvas,camera,o){currentCamera=camera;options=o;const update=()=>{camera.position.set(30,100,100);camera.lookAt(0,0,0);camera.updateMatrixWorld();o.draw();};return{setHome:update,update,focus:update,zoom:update,view:update,dispose(){}};}
  });
  const code=(await readFile(new URL('../apps/site/liquid-detail.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
  new vm.Script(`${code}\nglobalThis.create=createLiquidDetail;`).runInContext(ctx);const detail=ctx.create(inline?{...callbacks,host}:callbacks);
  return{detail,node,groups,dialogs,panels,host,errors,get modalShows(){return modalShows;},get model(){return liveModel;},get options(){return options;},get renders(){return renders;},get pendingFrames(){return frames.size;},
    eye(position){currentCamera.position.set(...position);currentCamera.updateMatrixWorld();options.draw();},
    hidden(value){document.hidden=value;documentEvents.get('visibilitychange')?.();},
    advance(duration){const target=clock+duration;while(clock<target){clock=Math.min(target,clock+1000/60);const ready=[...frames.values()];frames.clear();ready.forEach(callback=>callback(clock));}},
  };
}

test('liquid full-room dialog renders every registered machine, filters rooms, selects actual mesh owners and retains matching four-side photos',async()=>{
  const h=await harness();try{
    h.detail.open();assert.deepEqual(h.errors,[]);assert.ok(h.renders>0);assert.equal(h.model.objects.size,52);
    assert.equal(h.node('.ld-labels').children.length,60);assert.equal(h.node('.ld-count').textContent,'52');
    const item=LIQUID_EQUIPMENT[0],group=h.model.objects.get(item.id);let mesh;group.traverse(o=>{if(!mesh&&o.isMesh)mesh=o;});
    h.options.select({object:mesh});assert.equal(h.node('.ld-detail h3').textContent,item.name);assert.equal(h.node('.ld-photo img').src,LIQUID_ASSETS[item.cardNumber]);
    h.node('.ld-isolate').checked=true;h.node('.ld-isolate').listeners.get('change')();
    assert.deepEqual([...h.model.objects].filter(([,o])=>o.visible).map(([id])=>id),[item.id]);
    const room=LIQUID_ROOMS.find(r=>r.id!==item.roomId);h.groups.get('[data-liquid-room]').find(n=>n.dataset.liquidRoom===room.id).click();
    assert.equal(Number(h.node('.ld-count').textContent),LIQUID_EQUIPMENT.filter(e=>e.roomId===room.id).length);
    h.options.select({object:mesh});assert.equal(h.node('.ld-detail h3').textContent,'3팀 액상 전체','a delayed pick from the previous room cannot select its now-hidden equipment');
    assert.ok([...h.model.objects].filter(([,o])=>o.visible).every(([id])=>LIQUID_EQUIPMENT.find(e=>e.id===id).roomId===room.id));
    h.node('.ld-search').value='not-a-machine';h.node('.ld-search').listeners.get('input')();assert.equal(h.node('.ld-count').textContent,'0');
    h.detail.open({equipmentId:item.id});assert.equal(h.node('.ld-detail h3').textContent,item.name);
    h.node('.ld-photo').click();assert.equal(h.dialogs[1].open,true);assert.equal(h.node('img').src,LIQUID_ASSETS[item.cardNumber]);
    h.detail.close();assert.equal(h.dialogs[0].open,false);
  }finally{h.detail.dispose();assert.ok(h.dialogs.every(d=>d.removed));}
});

test('a liquid WebGL failure preserves accessible card selection and photo viewing',async()=>{
  const h=await harness({failRenderer:true});try{
    assert.doesNotThrow(()=>h.detail.open());assert.equal(h.errors.length,1);assert.equal(h.node('.cd-fallback').hidden,false);
    h.groups.get('[data-liquid-equipment]')[0].click();assert.ok(h.node('.ld-photo img').src);h.node('.ld-photo').click();assert.equal(h.dialogs[1].open,true);
  }finally{h.detail.dispose();}
});

test('liquid orbit-camera movement leaves manual doors closed and keeps the viewer demand-rendered',async()=>{
  const h=await harness();
  try{
    h.detail.open();assert.deepEqual(h.errors,[]);assert.equal(h.pendingFrames,0,'the high overview remains demand-rendered');
    let door,leaf;h.model.environment.structure.traverse(node=>{if(!door&&node.name==='liquid-plan-door')door=node;});
    door.traverse(node=>{if(!leaf&&node.userData.proximityDoor?.kind==='hinge')leaf=node;});
    assert(leaf);const data=leaf.userData.proximityDoor;
    const visitor=door.localToWorld(new THREE.Vector3(0,0,.7));visitor.y+=1.65;
    h.eye(visitor.toArray());assert.equal(h.pendingFrames,0,'an orbit camera is not a walking person or a manual door action');
    h.advance(800);assert.equal(leaf.rotation.y,data.closed);assert.equal(h.pendingFrames,0,'manual doors stay closed without an interaction');
    const idleRenders=h.renders;h.advance(2000);assert.equal(h.renders,idleRenders);
    h.eye([30,100,100]);h.advance(1400);assert.equal(leaf.rotation.y,data.closed);assert.equal(h.pendingFrames,0,'moving the orbit camera away remains idle');
    h.eye(visitor.toArray());h.advance(150);assert.equal(h.pendingFrames,0);
    h.hidden(true);assert.equal(leaf.rotation.y,data.closed);assert.equal(h.pendingFrames,0);
    const hiddenRenders=h.renders;h.advance(1500);assert.equal(h.renders,hiddenRenders,'hidden documents stay idle');
    h.hidden(false);h.advance(800);assert.equal(leaf.rotation.y,data.closed);
    h.detail.close();assert.equal(leaf.rotation.y,data.closed);assert.equal(h.pendingFrames,0);
    h.detail.open();h.eye(visitor.toArray());h.advance(150);assert.equal(h.pendingFrames,0);
    h.detail.dispose();assert.equal(leaf.rotation.y,data.closed);assert.equal(h.pendingFrames,0);
    const disposedRenders=h.renders;h.advance(1500);assert.equal(h.renders,disposedRenders);
  }finally{h.detail.dispose();}
});

test('optional liquid lifecycle callbacks track real open/close transitions including native dialog close and leave the default API intact',async()=>{
  const events=[],h=await harness({callbacks:{onOpen:()=>events.push('open'),onClose:()=>events.push('close')}});
  try{
    h.detail.open({equipmentId:LIQUID_EQUIPMENT[0].id});h.detail.open();
    assert.deepEqual(events,['open'],'reselecting the open viewer does not announce a second transition');
    h.node('.ld-close').click();assert.deepEqual(events,['open','close']);
    h.detail.close();assert.deepEqual(events,['open','close'],'API/native close notifications cannot duplicate');
    h.detail.open({equipmentId:LIQUID_EQUIPMENT[0].id});h.node('.ld-photo').click();
    assert.equal(h.dialogs[1].open,true);
    h.dialogs[0].open=false;h.dialogs[0].listeners.get('close')();
    assert.deepEqual(events,['open','close','open','close'],'Escape/native close restores the parent selection indicator');
    assert.equal(h.dialogs[1].open,false,'closing the main viewer also closes its photo dialog');
    h.detail.open();h.dialogs[0].listeners.get('close')();
    assert.deepEqual(events,['open','close','open','close','open'],'a delayed previous close event cannot clear a reopened viewer');
    h.detail.dispose();assert.deepEqual(events,['open','close','open','close','open','close']);
    h.detail.dispose();h.detail.open();assert.equal(events.length,6);
  }finally{h.detail.dispose();}
});

test('inline liquid mounts the same 52-machine viewer in its supplied workspace and uses a modal only for reference photos',async()=>{
  const events=[],h=await harness({inline:true,callbacks:{onOpen:()=>events.push('open'),onClose:()=>events.push('close')}});
  try{
    assert.equal(h.panels.length,1);assert.equal(h.dialogs.length,1,'only the photo viewer is a native dialog');
    assert.equal(h.host.children[0],h.panels[0]);assert.equal(h.panels[0].hidden,true);
    h.detail.open({equipmentId:LIQUID_EQUIPMENT[0].id});
    assert.deepEqual(h.errors,[]);assert.equal(h.model.objects.size,52);assert.equal(h.panels[0].hidden,false);
    assert.equal(h.modalShows,0,'opening the liquid area never calls showModal');assert.ok(h.renders>0);
    assert.equal(h.node('.ld-detail h3').textContent,LIQUID_EQUIPMENT[0].name);
    h.node('.ld-photo').click();assert.equal(h.modalShows,1);assert.equal(h.dialogs[0].open,true);
    h.detail.close();assert.equal(h.panels[0].hidden,true);assert.equal(h.dialogs[0].open,false);
    h.detail.open({equipmentId:LIQUID_EQUIPMENT[1].id});assert.equal(h.modalShows,1);
    assert.equal(h.node('.ld-detail h3').textContent,LIQUID_EQUIPMENT[1].name);
    h.node('.ld-close').click();assert.equal(h.panels[0].hidden,true);
    assert.deepEqual(events,['open','close','open','close']);
  }finally{h.detail.dispose();assert.equal(h.panels[0].removed,true);}
});
