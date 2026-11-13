import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from '../apps/shared/vendor/three.module.js';
import * as walking from '../apps/site/person-walk.js';
import { createProximityDoorController } from '../apps/site/proximity-doors.js';
import { CAMPUS_ROOM } from '../apps/site/campus-data.js';
import { OUTDOOR_ROOM } from '../apps/site/outdoor-data.js';
import { PACKAGING_ROOM, PACKAGING_ROOMS, PACKAGING_OVERVIEW, PACKAGING_FLOOR_ELEVATIONS } from '../apps/site/packaging-data.js';
import { FLOORS, floorElevation } from '../apps/site/facility-data.js';
import { PLACEMENT_REGIONS, fromRoomPosition, toRoomPosition } from '../apps/site/placement-rules.js';

function target() {
  const listeners=new Map();
  return { addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},removeEventListener(type,fn){listeners.get(type)?.delete(fn);},
    dispatch(type,options={}){const event={target:this,preventDefault(){this.defaultPrevented=true;},...options};listeners.get(type)?.forEach(fn=>fn(event));return event;} };
}

async function harness({portal}={}) {
  const doc=target(),win=target();doc.hidden=false;doc.querySelector=()=>null;doc.defaultView=win;
  const canvas=Object.assign(target(),{ownerDocument:doc,dataset:{},style:{},checkVisibility:()=>true,getClientRects:()=>[{}],getBoundingClientRect:()=>({left:0,top:0,width:1000,height:700}),focus(){doc.activeElement=this;},setPointerCapture(){},hasPointerCapture:()=>false,releasePointerCapture(){}});
  const source=(await readFile(new URL('../apps/site/scene.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'').replace(/^export\s+(?=(?:function|class|const|let)\b)/gm,'');
  const context=vm.createContext({THREE,...walking,CAMPUS_ROOM,OUTDOOR_ROOM,PACKAGING_ROOM,PACKAGING_ROOMS,PACKAGING_OVERVIEW,PACKAGING_FLOOR_ELEVATIONS,FLOORS,floorElevation,PLACEMENT_REGIONS,fromRoomPosition,toRoomPosition,document:doc,window:win,requestAnimationFrame:()=>1,cancelAnimationFrame(){},setTimeout,clearTimeout});
  new vm.Script(`${source}\nglobalThis.FacilityScene=FacilityScene;`).runInContext(context);
  const scene=Object.create(context.FacilityScene.prototype),world=new THREE.Scene(),frame=new THREE.Group(),leaf=new THREE.Group();world.add(frame);frame.add(leaf);
  leaf.userData.proximityDoor={enterable:true,label:'검토 출입문',kind:'hinge',axis:'y',closed:0,open:Math.PI/2,width:1.4,height:2.3,trigger:[0,0,0],...(portal?{portal}:{})};
  const fixture=new THREE.Group();fixture.position.set(4,0,8);world.add(fixture);
  const changes=[];
  Object.assign(scene,{scene:world,canvas,enabledAreas:new Set(['campus','packaging']),equipment:[{id:'fixture',floor:'campus',position:[4,0,8],rotation:0}],objects:new Map([['fixture',fixture]]),pickables:[],parts:[],
    person:walking.createPersonState({position:[0,0,1]}),personArea:'campus:',personInputs:new Set(),personStates:new Map(),personCamera:new THREE.PerspectiveCamera(70,1000/700,.02,3000),personAvatar:new THREE.Group(),
    activeFloor:'campus',packagingLevel:'all',view:'person',personEnabled:true,personViewScale:1,autoOpenDoors:false,active:true,disposed:false,reducedMotion:false,placementMode:false,isolated:false,selected:null,
    floorDecks:new Map([['campus',new THREE.Group()],['packaging',new THREE.Group()]]),floorStructures:new Map(),placementFootprints:new Map(),placementDefaults:new Map(),placementResults:new Map(),
    personObstacleCache:null,locationDisks:new Map(),labels:[],selectionRing:new THREE.Group(),listeners:[],target:new THREE.Vector3(),goalTarget:new THREE.Vector3(),orbit:{},goalOrbit:{},amount:0,explosion:0,
    _invalidate(){},_clearHover(){},_cancelPendingPick(){},_placementGuide(){},_moveParts(){},_visibility(){},resize(){},_personSupportMeshes:()=>[],_personGroundHeight:()=>0,
    onSelect(){},onViewChange(){},onFloorChange(value){changes.push(value);},onPackagingLevelChange(){},onNavigationChange(){}});
  scene.proximityDoors=createProximityDoorController(world);
  return {scene,leaf,frame,fixture,canvas,doc,changes,dispose(){scene.proximityDoors.dispose();scene.listeners.forEach(remove=>remove());}};
}
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-7,`${actual} != ${expected}`);
const animate=scene=>{for(let i=0;i<90;i++)scene._updateProximityDoors(1/60);};
const walkDistance=(scene,distance)=>{
  let remaining=distance/walking.WALK_RULES.speed;
  const area=scene.activeFloor,level=scene.getPackagingLevel();
  while(remaining>1e-8){
    const delta=Math.min(remaining,walking.WALK_RULES.maxDelta);
    scene._advancePerson(delta);remaining-=delta;
    if(scene.activeFloor!==area||scene.getPackagingLevel()!==level)break;
  }
};

function addInteriorReturnDoor(h) {
  const {scene,frame}=h,entry=PACKAGING_ROOMS[1].layout.doors.find(door=>door.id==='entry-door');
  const innerFrame=new THREE.Group(),innerLeaf=new THREE.Group();
  innerFrame.position.set(entry.x,0,entry.z);innerFrame.rotation.y=entry.rotation;innerFrame.add(innerLeaf);scene.scene.add(innerFrame);
  innerLeaf.userData.proximityDoor={...h.leaf.userData.proximityDoor,groupId:'interior-entry',width:entry.width,portal:{area:'campus',entry:'team2-rear'}};
  // Rendering is outside this VM fixture. Mirror the production area visibility
  // so the actual controller can discover the matching exterior after a change.
  scene._visibility=()=>{frame.visible=scene.activeFloor==='campus';innerFrame.visible=scene.activeFloor==='packaging'&&scene.getPackagingLevel()===1;};
  scene._visibility();scene.proximityDoors.dispose();scene.proximityDoors=createProximityDoorController(scene.scene);
  return {entry,innerFrame,innerLeaf};
}

test('manual F opens one reviewed doorway, ignores held-key repeats and respects automatic mode and editing',async()=>{
  const h=await harness();
  try {
    const {scene,leaf,canvas,doc}=h;scene._controls();animate(scene);close(leaf.rotation.y,0);
    assert.equal(canvas.dispatch('keydown',{key:'f',code:'KeyF'}).defaultPrevented,true);
    canvas.dispatch('keydown',{key:'f',code:'KeyF',repeat:true});animate(scene);close(leaf.rotation.y,Math.PI/2);
    canvas.dispatch('keydown',{key:'f',code:'KeyF'});animate(scene);close(leaf.rotation.y,0);
    canvas.dispatch('keydown',{key:'f',code:'KeyF',ctrlKey:true});animate(scene);close(leaf.rotation.y,0);
    scene.placementMode=true;canvas.dispatch('keydown',{key:'f',code:'KeyF'});animate(scene);close(leaf.rotation.y,0);scene.placementMode=false;
    doc.querySelector=()=>({});canvas.dispatch('keydown',{key:'f',code:'KeyF'});animate(scene);close(leaf.rotation.y,0);doc.querySelector=()=>null;
    scene.setAutomaticDoors(true);animate(scene);close(leaf.rotation.y,Math.PI/2);assert.equal(scene.interactDoor(),false);
  } finally {h.dispose();}
});

test('walking stops at a closed reviewed door and crosses after the leaf has actually opened',async()=>{
  const h=await harness();
  try {
    const {scene}=h;scene.person=walking.createPersonState({position:[3,0,.2]});scene.personInputs.add('forward');
    walkDistance(scene,.6);assert.ok(scene.person.position[2]<0,'a closed doorway must not block movement outside its width');
    scene.person=walking.createPersonState({position:[0,0,.2]});
    walkDistance(scene,.6);assert.ok(scene.person.position[2]>0&&scene.person.position[2]<=.2,'holding forward can approach but never cross the closed door');
    assert.equal(scene.interactDoor(),true);animate(scene);
    walkDistance(scene,.6);assert.ok(scene.person.position[2]<0,'the open threshold allows entry');
  } finally {h.dispose();}
});

test('a curtain across the X axis blocks its own plane and leaves parallel walking unobstructed',async()=>{
  const h=await harness();
  try {
    const {scene,leaf}=h;leaf.userData.proximityDoor.normal=[-1,0,0];
    scene.person=walking.createPersonState({position:[.2,0,0],yaw:-Math.PI/2});scene.personInputs.add('forward');
    walkDistance(scene,.6);assert.ok(scene.person.position[0]>0&&scene.person.position[0]<=.2,'the closed curtain blocks its transverse plane');
    assert.equal(scene.interactDoor(),true);animate(scene);
    walkDistance(scene,.6);assert.ok(scene.person.position[0]<0,'opened transverse curtain can be crossed');
    scene.proximityDoors.setPassageOpen(scene.proximityDoors.getPassages({includeAll:true})[0].id,false,{immediate:true});
    scene.person=walking.createPersonState({position:[.5,0,.2],yaw:0});
    walkDistance(scene,.6);assert.ok(scene.person.position[2]<0,'closed curtain cannot create a perpendicular barrier beside its true plane');
  } finally {h.dispose();}
});

test('crossing the opened campus Team-2 entrance enters the real first-floor interior and retains person view',async()=>{
  const h=await harness({portal:{area:'packaging',level:1,entry:'team2-rear'}});
  try {
    const {scene}=h,{entry}=addInteriorReturnDoor(h);scene.person=walking.createPersonState({position:[0,0,.2]});scene.interactDoor();animate(scene);scene.personInputs.add('forward');
    walkDistance(scene,.6);
    assert.equal(scene.activeFloor,'packaging');assert.equal(scene.getPackagingLevel(),1);assert.equal(scene.view,'person');
    assert.deepEqual(h.changes,['packaging']);
    close(scene.person.position[0],entry.x);close(scene.person.position[2],entry.z-.9);
    assert.equal(scene.proximityDoors.getPassages().find(door=>door.portal?.area==='campus').open,true,'one exterior interaction also opens its linked interior leaf');
    close(scene.personCamera.position.y,walking.WALK_RULES.eyeHeight);
  } finally {h.dispose();}
});

test('Team-2 doors support a walking round trip and return outside the matching moved and rotated campus doorway',async()=>{
  const h=await harness({portal:{area:'packaging',level:1,entry:'team2-rear'}});
  try {
    const {scene,frame}=h,{entry}=addInteriorReturnDoor(h);
    frame.position.set(10,0,-20);frame.rotation.y=-Math.PI/2;
    scene.person=walking.createPersonState({position:[9.8,0,-20],yaw:Math.PI/2});
    assert.equal(scene.interactDoor(),true);animate(scene);scene.personInputs.add('forward');walkDistance(scene,.6);
    assert.equal(scene.activeFloor,'packaging');assert.equal(scene.getPackagingLevel(),1);animate(scene);

    // The linked leaf is already open and the person starts inside its plane.
    close(scene.person.position[0],entry.x);close(scene.person.position[2],entry.z-.9);
    assert.equal(scene.proximityDoors.getPassages().find(door=>door.portal?.area==='campus').open,true);
    scene.personInputs.add('forward');walkDistance(scene,.6);
    assert.ok(scene.person.position[2]<entry.z,'walking into the first-floor room must not trigger the outward portal');
    assert.equal(scene.activeFloor,'packaging');
    scene.person.yaw=Math.PI;walkDistance(scene,1.8);

    assert.equal(scene.activeFloor,'campus');assert.equal(scene.view,'person');
    assert.deepEqual(h.changes,['packaging','campus']);
    close(scene.person.position[0],8.3);close(scene.person.position[1],0);close(scene.person.position[2],-20);
    close(scene.person.yaw,-Math.PI/2);close(scene.personCamera.position.y,walking.WALK_RULES.eyeHeight);
    const facing=scene.personCamera.getWorldDirection(new THREE.Vector3());close(facing.x,-1);close(facing.z,0);

    // Returning carries the same open doorway state back to the exterior.
    assert.equal(scene.proximityDoors.getPassages().find(door=>door.portal?.area==='packaging').open,true);
    scene.person.yaw=Math.PI/2;animate(scene);
    scene.personInputs.add('forward');walkDistance(scene,1.8);
    assert.equal(scene.activeFloor,'packaging');assert.equal(scene.getPackagingLevel(),1);assert.equal(scene.view,'person');
    assert.deepEqual(h.changes,['packaging','campus','packaging']);
  } finally {h.dispose();}
});

test('a closed or still-opening first-floor entry blocks returning to campus until it is fully open',async()=>{
  const h=await harness({portal:{area:'packaging',level:1,entry:'team2-rear'}});
  try {
    const {scene}=h,{entry}=addInteriorReturnDoor(h);
    scene.person=walking.createPersonState({position:[0,0,.2]});scene.interactDoor();animate(scene);scene.personInputs.add('forward');walkDistance(scene,.6);
    const innerPassage=scene.proximityDoors.getPassages().find(door=>door.portal?.area==='campus');
    assert.equal(innerPassage.open,true);assert.equal(scene.proximityDoors.setPassageOpen(innerPassage.id,false,{immediate:true}),true);
    const start=[entry.x,0,entry.z-.2];scene.person=walking.createPersonState({position:start,yaw:Math.PI});
    scene.personInputs.add('forward');walkDistance(scene,.6);
    assert.equal(scene.activeFloor,'packaging');assert.ok(scene.person.position[2]<entry.z&&scene.person.position[2]>=start[2],'the closed door keeps a held return walk inside');assert.deepEqual(h.changes,['packaging']);
    const stopped=[...scene.person.position];
    assert.equal(scene.interactDoor(),true);scene._updateProximityDoors(.05);walkDistance(scene,.6);
    assert.equal(scene.activeFloor,'packaging');assert.deepEqual([...scene.person.position],stopped,'an opening animation still blocks the threshold');
    animate(scene);walkDistance(scene,.6);
    assert.equal(scene.activeFloor,'campus');assert.deepEqual(h.changes,['packaging','campus']);assert.equal(scene.view,'person');
  } finally {h.dispose();}
});

test('closed-door barriers do not catch motion that stays on one side or crosses outside the doorway width or floor',async()=>{
  const h=await harness();
  try {
    const {scene}=h;
    for(const [start,end] of [[[0,0,2],[0,0,1.5]],[[3,0,.2],[3,0,-.2]],[[0,4,.2],[0,4,-.2]]]) {
      const before=walking.createPersonState({position:start});scene.person=walking.createPersonState({position:end});
      assert.equal(scene._resolvePersonDoorCrossing(before),false);assert.deepEqual([...scene.person.position],end,'unrelated walking cannot snap back to its previous position');
    }
  } finally {h.dispose();}
});

test('presentation waits for an explicit door action and actual opening clearance while keeping proximity sensors off',async()=>{
  const h=await harness();
  try {
    const {scene,leaf}=h;
    Object.assign(scene,{activeFloor:1,personArea:'1:',controlledPresentation:true,presentationOnly:true,enabledAreas:new Set(['dryer'])});
    const pose={floor:1,position:[0,0,1.05],lookAt:[0,1.65,-2]};
    assert.equal(scene.setPresentationPose(pose),true);
    assert.equal(scene.autoOpenDoors,false);
    scene.setAutomaticDoors(true);assert.equal(scene.autoOpenDoors,false);
    animate(scene);close(leaf.rotation.y,0);
    const next={...pose,position:[0,0,.95]};
    let state=scene.getPresentationDoorState(next);
    assert.equal(state.blocked,true);assert.equal(state.action,'open');assert.equal(state.progress,0);
    assert.equal(scene.interactPresentationDoor('unreviewed-door'),false);
    assert.equal(scene.interactPresentationDoor(state.id),true);close(leaf.rotation.y,0);
    scene._updateProximityDoors(.1);state=scene.getPresentationDoorState(next);
    assert.equal(state.blocked,true);assert.equal(state.action,'close');assert.ok(state.progress>0&&state.progress<.85);
    animate(scene);state=scene.getPresentationDoorState(next);
    assert.equal(state.blocked,false);assert.equal(state.open,true);
    assert.equal(scene.interactPresentationDoor(state.id),true);
    animate(scene);assert.equal(scene.getPresentationDoorState(next).blocked,true);
    close(leaf.rotation.y,0);
    scene.autoOpenDoors=true;animate(scene);close(leaf.rotation.y,0,'even a stale flag cannot activate presentation sensors');
  } finally {h.dispose();}
});

test('presentation door prediction ignores lateral, parallel, behind, remote and other-floor thresholds',async()=>{
  const h=await harness();
  try {
    const {scene}=h;
    Object.assign(scene,{activeFloor:1,personArea:'1:',controlledPresentation:true,presentationOnly:true,enabledAreas:new Set(['dryer'])});
    for(const [position,lookAt,next] of [
      [[2,0,.7],[2,1.65,-2],[2,0,.6]],
      [[0,0,.7],[2,1.65,.7],[.1,0,.7]],
      [[0,0,.7],[0,1.65,3],[0,0,.8]],
      [[0,0,3],[0,1.65,-2],[0,0,2.9]],
      [[0,4,.7],[0,5.65,-2],[0,4,.6]],
    ]) {
      scene.setPresentationPose({floor:1,position,lookAt});
      assert.notEqual(scene.getPresentationDoorState({floor:1,position:next,lookAt})?.blocked,true);
    }
    scene.setPresentationPose({floor:1,position:[1.6,0,.7],lookAt:[-1.4,1.65,.7]});
    assert.equal(scene.getPresentationDoorState({floor:1,position:[1.5,0,.7],lookAt:[-1.4,1.65,.7]}),null,'walking past a side-room door does not trigger advance opening');
    scene.setPresentationPose({floor:1,position:[.55,0,.4],lookAt:[-2,1.65,.4]});
    assert.equal(scene.getPresentationDoorState({floor:1,position:[.5,0,.4],lookAt:[-2,1.65,.4]}),null,'parallel walking never waits at or opens the dressing-room doorway');
    scene.setPresentationPose({floor:1,position:[0,0,.2],lookAt:[0,1.65,-2]});
    assert.equal(scene.getPresentationDoorState({floor:2,position:[0,3.8,-.2],lookAt:[0,5,-2]}),null);
    assert.equal(scene.getPresentationDoorState({floor:1,position:[0,0,-.2],lookAt:[0,1.65,-2]}).blocked,true,'a predicted crossing waits before entering the closed threshold');
    const id=scene.getPresentationDoorState().id;
    scene.person=walking.createPersonState({position:[0,0,5]});
    assert.equal(scene.interactPresentationDoor(id),false,'a stale control cannot open a remote doorway');
  } finally {h.dispose();}
});

test('restarting a presentation restores closed doors for the next explicit demonstration without resetting ordinary exploration',async()=>{
  const h=await harness();
  try {
    const {scene,leaf}=h;
    scene.interactDoor();animate(scene);close(leaf.rotation.y,Math.PI/2);
    assert.equal(scene.resetPresentationDoors(),false);close(leaf.rotation.y,Math.PI/2);
    Object.assign(scene,{activeFloor:1,personArea:'1:',controlledPresentation:true,presentationOnly:true,enabledAreas:new Set(['dryer'])});
    for(let rehearsal=0;rehearsal<2;rehearsal++) {
      assert.equal(scene.resetPresentationDoors(),true);close(leaf.rotation.y,0);
      assert.equal(scene.autoOpenDoors,false);
      const state=scene.getPresentationDoorState({floor:1,position:[0,0,.9],lookAt:[0,1.65,-2]});
      assert.equal(state.action,'open');assert.equal(state.progress,0);assert.equal(state.blocked,true);
      assert.equal(scene.interactPresentationDoor(state.id),true);animate(scene);close(leaf.rotation.y,Math.PI/2);
    }
  } finally {h.dispose();}
});

test('view calibration changes field of view without resizing the person, drawing coordinates or equipment',async()=>{
  const h=await harness();
  try {
    const {scene,fixture}=h;scene._updatePersonCamera();const position=[...scene.person.position],pose=fixture.matrix.clone(),equipment=JSON.stringify(scene.equipment),eyeY=scene.personCamera.position.y;
    scene.setPersonViewScale(.75);const wide=scene.personCamera.fov;scene.setPersonViewScale(1.25);const narrow=scene.personCamera.fov;
    assert.ok(wide>70 && narrow<70);scene.setPersonViewScale(1);close(scene.personCamera.fov,70);
    assert.equal(scene.setPersonViewScale(NaN),false);scene.setPersonViewScale(3);close(scene.personViewScale,1.25);scene.setPersonViewScale(-1);close(scene.personViewScale,.75);
    scene._updatePersonCamera();close(scene.personCamera.position.y,eyeY);assert.deepEqual([...scene.person.position],position);assert.equal(JSON.stringify(scene.equipment),equipment);assert.ok(fixture.matrix.equals(pose));
  } finally {h.dispose();}
});

test('panoramic person views retain a human scale while narrow screens and optional view adjustment remain usable',async()=>{
  const h=await harness();
  try {
    const {scene}=h,position=[...scene.person.position],layout=JSON.stringify(scene.equipment);
    const horizontal=()=>2*Math.atan(Math.tan(scene.personCamera.fov*Math.PI/360)*scene.personCamera.aspect)*180/Math.PI;
    for(const aspect of [16/9,3,4]){
      scene.personCamera.aspect=aspect;scene.setPersonViewScale(1);
      assert.ok(horizontal()<=walking.WALK_RULES.horizontalFov+1e-7,'wide layouts do not exaggerate peripheral size');
      if(aspect>=3)close(horizontal(),110);
    }
    const baseline=horizontal();scene.setPersonViewScale(.75);assert.ok(horizontal()>baseline,'a wider inspection view remains available');
    scene.setPersonViewScale(1.25);assert.ok(horizontal()<baseline,'closer viewing does not change the model');
    scene.personCamera.aspect=.6;scene.setPersonViewScale(1);close(scene.personCamera.fov,70);
    assert.deepEqual([...scene.person.position],position);assert.equal(JSON.stringify(scene.equipment),layout);
  } finally {h.dispose();}
});
