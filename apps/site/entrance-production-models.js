import * as THREE from '../shared/vendor/three.module.js';
import { ENTRANCE_PRODUCTION_SURVEY as SURVEY } from './entrance-route-data.js';

const PI = Math.PI;
function tools(s, inherited) {
  const material = (color, roughness=.8, metalness=.05) => s._material(color,roughness,metalness);
  const m = s.entranceProductionMaterials ||= {
    wall: inherited.white || material(0xe2e5de), upper: material(0xc4cecb,.84,.16),
    concrete: inherited.concrete || material(0xc5c9bf,.97), steel: inherited.steel || material(0x99aba7,.44,.55),
    blueRoof: inherited.blueRoof || material(0x45a6d2,.61,.21), blueTrim: inherited.blueTrim || material(0x24769e,.6,.3),
    archRoof: inherited.archRoof || s._material(0x253840,.65,.2,{side:THREE.DoubleSide}),
    glass: inherited.glass || material(0x19353e,.29,.35), bronze: material(0x726e5f,.5,.35),
    plinth: material(0x343d3b,.95), dark: inherited.dark || material(0x25332e),
    yellow: inherited.yellow || material(0xd2b66c), roofLight: inherited.roofLight || material(0xd9d8b3),
    facadeTrim: inherited.facadeTrim || material(0x9aa5a1,.7,.22), drain: material(0xb9b5a2),
  };
  const geometries=s.entranceProductionGeometry ||= new Map();
  const geo=(key,create)=>{if(!geometries.has(key)){const g=create();geometries.set(key,g);s.geometries?.add(g);}return geometries.get(key);};
  const box=(parent,size,position,paint='wall')=>s._box(parent,size,position,m[paint]||paint);
  const boxes=(parent,entries,paint,name)=>{
    if(!entries.length)return;
    const geometry=geo('box',()=>new THREE.BoxGeometry(1,1,1)),mesh=new THREE.InstancedMesh(geometry,m[paint]||paint,entries.length),d=new THREE.Object3D();
    entries.forEach(([position,size,rotation=[0,0,0]],i)=>{d.position.set(...position);d.scale.set(...size);d.rotation.set(...rotation);d.updateMatrix();mesh.setMatrixAt(i,d.matrix);});
    mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=mesh.receiveShadow=true;mesh.name=name;mesh.computeBoundingBox();mesh.computeBoundingSphere();parent.add(mesh);return mesh;
  };
  const bar=(parent,a,b,r=.035,paint='steel')=>{
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);
    const geometry=geo('cylinder',()=>new THREE.CylinderGeometry(1,1,1,10));
    const mesh=s._mesh(geometry,m[paint],parent,start.add(end).multiplyScalar(.5).toArray());mesh.scale.set(r,delta.length(),r);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return mesh;
  };
  return {m,box,boxes,bar,geo};
}
function gable(s,parent,width,depth,rise,position,material,name) {
  const shape=new THREE.Shape();shape.moveTo(-width/2,0);shape.lineTo(width/2,0);shape.lineTo(0,rise);shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,steps:1});geometry.translate(0,0,-depth/2);
  const mesh=s._mesh(geometry,material,parent,position);mesh.name=name;return mesh;
}
function roofBank(s,roof,details,item,t) {
  const {width:w,depth:d,height:h}=item,sx=w/65,sy=h/10,sz=d/42,wallHeight=5.7*sy,roofRise=3.35*sy;
  const bays=[-25.4,-12.7,12.7,25.4].map(x=>x*sx);
  for(const x of bays)gable(s,roof,12.7*sx,d+.6,roofRise,[x,wallHeight,0],t.m.blueRoof,'campus-production-blue-gable');
  const geometry=new THREE.CylinderGeometry(6.35,6.35,d+.6,32,1,true,-PI/2,PI);geometry.rotateX(-PI/2);geometry.scale(sx,.55*sy,1);
  s._mesh(geometry,t.m.archRoof,roof,[0,wallHeight,0]).name='campus-production-central-arched-roof';
  for(const z of [-d/2,d/2]){const cap=new THREE.CircleGeometry(6.35,32,0,PI);cap.scale(sx,.55*sy,1);s._mesh(cap,t.m.archRoof,roof,[0,wallHeight,z]);}
  const pitch=Math.atan2(roofRise,6.35*sx),slopeWidth=Math.hypot(6.35*sx,roofRise),seams=[],lights=[],gutters=[],vents=[],caps=[];
  for(const x of bays)for(const side of [-1,1]){
    for(let index=-4;index<=4;index++)seams.push([[x+side*3.175*sx,wallHeight+roofRise/2+.055,index*d/8.4],[slopeWidth,.08,.1],[0,0,side*-pitch]]);
    for(const z of [-.29,.1,.38])lights.push([[x+side*3.175*sx,wallHeight+roofRise/2+.07,z*d],[slopeWidth*.91,.045,.68*sz],[0,0,side*-pitch]]);
  }
  for(const x of [-31.75,-19.05,-6.35,6.35,19.05,31.75])gutters.push([[x*sx,wallHeight+.1,0],[.22,.17,d+.9]]);
  for(const x of [...bays,0])for(const z of [-16,-8,0,8,16]){const y=x===0?9.25*sy:9.1*sy;vents.push([[x,y+.28,z*sz],[.7,.55,.7]]);caps.push([[x,y+.62,z*sz],[1.1,.18,1.1]]);}
  t.boxes(details,seams,'blueTrim','campus-production-roof-ribs');t.boxes(details,lights,'roofLight','campus-production-roof-translucent-strips');
  t.boxes(details,gutters,'steel','campus-production-gutters-downpipes');
  // Repeated roof ventilators retain the established outer envelope.
  const cylinder=t.geo('roof-vent-cylinder',()=>new THREE.CylinderGeometry(1,1,1,12));
  for(const [entries,paint,name] of [[vents,'steel','campus-roof-vent-bases'],[caps,'wall','campus-roof-vent-caps']]){
    const mesh=new THREE.InstancedMesh(cylinder,t.m[paint],entries.length),matrix=new THREE.Matrix4();
    entries.forEach(([position,scale],index)=>{matrix.compose(new THREE.Vector3(...position),new THREE.Quaternion(),new THREE.Vector3(...scale).multiply(new THREE.Vector3(.5,1,.5)));mesh.setMatrixAt(index,matrix);});
    mesh.instanceMatrix.needsUpdate=true;mesh.castShadow=mesh.receiveShadow=true;mesh.name=name;mesh.computeBoundingBox();mesh.computeBoundingSphere();details.add(mesh);
  }
}
function slidingBank(s,parent,{position,width,height=1.16,panes=2,yaw=0,id},t) {
  const group=s._group(parent,position);group.rotation.y=yaw;group.name=id;
  const face=.075,frames=[],mullions=[];
  t.box(group,[width,height,.055],[0,0,0],'glass').name='entrance-sliding-window-dark-recess';
  for(const side of [-1,1]){
    frames.push([[side*(width/2+.035),0,face],[.075,height+.14,.075]]);
    frames.push([[0,side*(height/2+.035),face],[width+.14,.075,.075]]);
  }
  for(let pane=1;pane<panes;pane++)mullions.push([[width*(pane/panes-.5),0,face+.025],[.06,height,.1]]);
  t.boxes(group,frames,'bronze','entrance-window-aluminium-perimeter');t.boxes(group,mullions,'steel','entrance-window-sliding-mullions');
  t.box(group,[width+.25,.07,.2],[0,-height/2-.08,.02],'wall').name='entrance-window-projecting-sill';
  return group;
}
function frontFacade(s,shell,details,item,t) {
  const {width:w,depth:d,height:h}=item,sx=w/65,sy=h/10,wallHeight=5.7*sy;
  const fronts=[-25.4,-12.7,0,12.7,25.4].map(x=>x*sx),doorW=5*sx,doorH=4.1*sy;
  const piers=[],lintels=[],plinths=[];
  // Real openings replace the former opaque block behind the shutters.
  let cursor=-w/2;
  for(const center of fronts){const left=center-doorW/2,right=center+doorW/2;if(left>cursor)piers.push([[(cursor+left)/2,wallHeight/2,d/2-.12],[left-cursor,wallHeight,.24]]);cursor=right;lintels.push([[center,(doorH+wallHeight)/2,d/2-.12],[doorW,wallHeight-doorH,.24]]);}
  if(cursor<w/2)piers.push([[(cursor+w/2)/2,wallHeight/2,d/2-.12],[w/2-cursor,wallHeight,.24]]);
  t.boxes(shell,piers,'wall','entrance-production-front-opening-piers');t.boxes(shell,lintels,'upper','entrance-production-front-opening-lintels');
  for(const [index,x] of fronts.entries()){
    const entry=s._group(details,[x,0,d/2+.04]);entry.name=`entrance-production-loading-bay-${index+1}`;entry.userData.sourceTimes=SURVEY.sourceTimes.frontage;
    t.box(entry,[doorW,doorH,.03],[0,doorH/2,-.7],'dark').name='entrance-loading-opening-unrecorded-interior';
    t.box(entry,[doorW+.2,.1,1.5],[0,.05,-.05],'concrete').name='entrance-loading-concrete-threshold';
    for(const sign of [-1,1]){
      t.box(entry,[.22,doorH+.25,.35],[sign*(doorW/2+.1),(doorH+.25)/2,.12],'facadeTrim');
      const guard=s._group(entry,[sign*(doorW/2+.25),0,.36]);guard.name='entrance-loading-yellow-black-jamb';
      t.box(guard,[.15,2,.15],[0,1,0],'dark');
      t.boxes(guard,[.3,.75,1.2,1.65].map(y=>[[0,y,0],[.17,.22,.17]]),'yellow','entrance-loading-jamb-yellow-stripes');
    }
    // Visible 3동 gables show a small metal canopy with diagonal tension rods.
    if(index!==2){
      const canopy=t.box(entry,[doorW+1.05,.13,1.5],[0,doorH+.55,.715],'facadeTrim');canopy.rotation.x=.07;canopy.name='entrance-production-supported-loading-canopy';
      for(const side of [-1,1]) {
        t.box(entry,[.12,.2,.025],[side*(doorW/2+.2),doorH+1.2,-.025],'steel').name='entrance-production-canopy-wall-anchor';
        t.bar(entry,[side*(doorW/2+.2),doorH+1.2,-.015],[side*(doorW/2+.2),doorH+.57,1.4],.026,'steel');
      }
    }
    if(index===0 || index===4){
      for(const side of [-1,1]){
        const xSide=side*(doorW/2+1.3);if(Math.abs(x+xSide)>w/2-1)continue;
        slidingBank(s,entry,{position:[xSide,1.67,.1],width:1.45,height:.88,panes:2,id:'entrance-loading-flanking-low-window'},t);
      }
    }
    // Lift shutters remain available as the established proximity-door action.
    const curtain=s._group(entry);curtain.name='campus-loading-moving-curtain';curtain.userData.proximityDoor={enterable:false,kind:'lift',axis:'y',closed:0,open:doorH+.015,retract:true,openScale:.025,trigger:[0,0,0],width:doorW,height:doorH};
    const panel=t.box(curtain,[doorW,doorH,.055],[0,doorH/2,-.055],'facadeTrim');panel.name='campus-loading-door-panel';
    plinths.push([[x,.16,d/2+.15],[doorW+.2,.25,.5]]);
  }
  t.boxes(details,plinths,'concrete','entrance-production-loading-thresholds');
}
function sideFacade(s,shell,details,item,t) {
  const {width:w,depth:d,height:h}=item,sy=h/10,sz=d/51,wallHeight=5.7*sy,sideX=w/2;
  const lower=SURVEY.sideWall.lowerWhiteBandHeight*sy,sill=SURVEY.sideWall.sillHeight*sy,winH=SURVEY.sideWall.windowHeight*sy;
  t.box(shell,[.24,wallHeight,d],[sideX-.12,wallHeight/2,0],'upper').name='entrance-production-corrugated-side-shell';
  t.box(details,[.07,lower,d],[sideX+.035,lower/2,0],'wall').name='entrance-production-white-lower-wall-band';
  t.box(details,[.09,.32*sy,d],[sideX+.045,.16*sy,0],'plinth').name='entrance-production-black-base-plinth';
  const ribs=[],seams=[];
  for(let z=-d/2+.1;z<d/2;z+=.24)ribs.push([[sideX+.045,(wallHeight+lower)/2,z],[.055,wallHeight-lower,.025]]);
  for(let z=-d/2;z<=d/2+.01;z+=4.25*sz)seams.push([[sideX+.08,wallHeight/2,z],[.08,wallHeight,.065]]);
  t.boxes(details,ribs,'upper','entrance-production-side-corrugation');t.boxes(details,seams,'facadeTrim','entrance-production-side-panel-seams');
  for(const [index,bank] of SURVEY.sideWindowBanks.entries()){
    const g=slidingBank(s,details,{position:[sideX+.11,sill+winH/2,bank.z*sz],width:bank.width*sz,height:winH,panes:bank.panes,yaw:PI/2,id:`entrance-production-side-window-bank-${index+1}`},t);
    g.userData.reconstructionOffsetApproximate=true;g.userData.sourceTimes=SURVEY.sourceTimes.sideWall;
  }
  const upperDrains=[],lowerDrains=[];
  for(const z0 of SURVEY.sideDrainZ){const z=z0*sz;upperDrains.push([[sideX+.19,(wallHeight+1.1)/2,z],[.14,wallHeight-1.1,.14]]);lowerDrains.push([[sideX+.19,.67,z],[.17,1.34,.17]],[[sideX+.34,.09,z],[.45,.17,.17]]);}
  t.boxes(details,upperDrains,'drain','entrance-production-beige-rain-downpipes');t.boxes(details,lowerDrains,'wall','entrance-production-white-drain-shoes');
  // The road-side asphalt edge follows the actual wall and does not cross it.
  t.box(details,[.1,.018,d+.35],[sideX+.8,.025,0],'yellow').name='entrance-production-wall-side-yellow-line';
}
function warehouseMark(s,parent,item,t) {
  if(typeof document==='undefined' || typeof document.createElement!=='function')return;
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;
  const ctx=canvas.getContext('2d');if(!ctx)return;
  ctx.clearRect(0,0,256,128);ctx.font='bold 84px "Malgun Gothic", sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.strokeStyle='#e6ece8';ctx.lineWidth=9;ctx.strokeText('3동',128,65);ctx.fillStyle='#283c45';ctx.fillText('3동',128,65);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;s.textures?.add(texture);
  const material=new THREE.MeshBasicMaterial({map:texture,transparent:true,alphaTest:.03,depthWrite:false,toneMapped:false});s.materials?.add(material);
  const geometry=t.geo('warehouse-number-plate',()=>new THREE.PlaneGeometry(2.7,1.35));
  for(const x of [-25.4,-12.7,0,12.7,25.4]){
    const mesh=s._mesh(geometry,material,parent,[x*item.width/65,6.65*item.height/10,item.depth/2+.08]);mesh.name='entrance-production-3dong-facade-mark';mesh.userData.sourceTimes=[2,20];
  }
}
export function buildEntranceProduction(s,root,item,{materials={}}={}) {
  if(item.type!=='campus-production')return false;
  const t=tools(s,materials),{width:w,depth:d,height:h}=item,wallHeight=5.7*h/10;
  const shell=s._part(root,item.parts[0],[-5,.5,0]);shell.name='campus-production-body';
  t.box(shell,[w+.7,.24,d+.7],[0,.12,0],'concrete');
  t.box(shell,[.24,wallHeight,d],[-w/2+.12,wallHeight/2,0],'wall');
  t.box(shell,[w,.24,d],[0,.12,0],'concrete');
  t.box(shell,[w,wallHeight,.24],[0,wallHeight/2,-d/2+.12],'wall');
  const roof=s._part(root,item.parts[1],[0,5,0]);roof.name='campus-production-roof-bank';
  const details=s._part(root,item.parts[2],[4,1,3]);details.name='entrance-production-detailed-facades';
  roofBank(s,roof,details,item,t);frontFacade(s,shell,details,item,t);sideFacade(s,shell,details,item,t);warehouseMark(s,details,item,t);
  root.userData.entranceRouteSource=SURVEY.source;root.userData.exteriorDimensionsMeasured=false;return true;
}
