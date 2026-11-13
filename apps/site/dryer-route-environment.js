import * as THREE from '../shared/vendor/three.module.js';

// Current 11/12 walk: topology and room use come from the video. These local
// coordinates register that sequence proportionally, never as surveyed sizes.
export function buildDryerRouteEnvironment(s, environment, spec) {
  const level=Number(spec?.id);
  if(![1,2,3].includes(level) || !environment?.architectureFixtures)return;
  if(environment.architectureFixtures.getObjectByName(`dryer-route-${level}-details`))return;
  const source='dryer-entrance-mezzanine-20261112',cache=s.dryerRouteGeometry ||=new Map();
  const geo=(key,make)=>{if(!cache.has(key)){const value=make();cache.set(key,value);s.geometries?.add(value);}return cache.get(key);};
  const colors={wall:0xe1e0d2,green:0x267858,corridorGreen:0x195a3f,skirting:0x124631,wornGreen:0x5b8066,trim:0xb5bfba,steel:0xa8b8b4,dark:0x263b39,black:0x1c2829,wood:0xb6945e,woodFloor:0xd0bb96,gray:0x9fa7a1,white:0xe5e8df,blue:0x507589,yellow:0xc6ad43,red:0xa84235,teal:0x2f706b,paper:0xd9dbce};
  const m=s.dryerRouteMaterials ||=Object.fromEntries(Object.entries(colors).map(([key,color])=>[key,s._material(color,key==='steel'?.35:.8,key==='steel'?.65:.04)]));
  m.ceilingPanel ||=s._material(0xdfe1d6,.94,0,{emissive:0xaeb1a2,emissiveIntensity:.16});
  m.glass ||=s._material(0x9abcb7,.24,.04,{transparent:true,opacity:.2,depthWrite:false,side:THREE.DoubleSide});
  m.yellowGlass ||=s._material(0xe1be39,.42,.03,{transparent:true,opacity:.58,depthWrite:false,side:THREE.DoubleSide});
  m.violet ||=s._material(0x9471c1,.45,.03,{emissive:0x522681,emissiveIntensity:.45});
  const group=(parent,name,p=[0,0,0])=>{const node=s._group(parent,p);node.name=`dryer-route-${level}-${name}`;Object.assign(node.userData,{currentVideoReference:true,source,architecturalFloor:level,dimensionsMeasured:false,positionBasis:'video-topology; approximate-local-registration'});return node;};
  const boxGeo=geo('unit-box',()=>new THREE.BoxGeometry(1,1,1));
  const box=(parent,name,size,p,paint='wall')=>{const node=s._mesh(boxGeo,m[paint],parent,p);node.scale.set(...size);node.name=`dryer-route-${name}`;return node;};
  const cylGeo=geo('unit-cylinder',()=>new THREE.CylinderGeometry(1,1,1,20));
  const cylinder=(parent,name,radius,height,p,paint='steel',axis='y')=>{const node=s._mesh(cylGeo,m[paint],parent,p);node.scale.set(radius,height,radius);if(axis==='x')node.rotation.z=Math.PI/2;if(axis==='z')node.rotation.x=Math.PI/2;node.name=`dryer-route-${name}`;return node;};
  const bar=(parent,name,a,b,r=.02,paint='steel')=>{const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);const node=cylinder(parent,name,r,delta.length(),start.add(end).multiplyScalar(.5).toArray(),paint);node.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());return node;};
  const repeats=(parent,name,size,positions,paint='steel')=>{if(!positions.length)return;const node=new THREE.InstancedMesh(boxGeo,m[paint],positions.length),dummy=new THREE.Object3D();positions.forEach((p,i)=>{dummy.position.set(...p);dummy.scale.set(...size);dummy.updateMatrix();node.setMatrixAt(i,dummy.matrix);});node.name=`dryer-route-${name}`;node.instanceMatrix.needsUpdate=true;node.computeBoundingBox();node.computeBoundingSphere();parent.add(node);return node;};
  const details=group(environment.architectureFixtures,'details');
  Object.assign(details.userData,{drawingPolicy:'reference-only',roomUsesFromCurrentVideo:true});
  const floorFinish=(name,bounds,paint='green',top=.018)=>{const node=box(environment.deck,name,[bounds.maxX-bounds.minX,.012,bounds.maxZ-bounds.minZ],[(bounds.minX+bounds.maxX)/2,top-.006,(bounds.minZ+bounds.maxZ)/2],paint);node.userData.floorFinish=true;return node;};
  const skirting=(parent,name,a,b,height=.16)=>{
    const length=Math.hypot(b[0]-a[0],b[1]-a[1]),root=group(parent,name,[a[0],0,a[1]]);root.rotation.y=-Math.atan2(b[1]-a[1],b[0]-a[0]);
    box(root,'green-wall-skirting',[length,height,.025],[length/2,height/2,0],'skirting');return root;
  };
  const suspendedCeiling=(name,bounds,{height=2.84,tileX=.6,tileZ=1.2}={})=>{
    const root=group(environment.facade,`${name}-suspended-ceiling`),width=bounds.maxX-bounds.minX,depth=bounds.maxZ-bounds.minZ;
    Object.assign(root.userData,{cutawayWithFacade:true,sourceTimesSeconds:[150,210,222,246,294,314,378,414],ceilingHeightMeasured:false});
    const panel=box(root,'off-white-acoustic-ceiling',[width,.035,depth],[(bounds.minX+bounds.maxX)/2,height+.0175,(bounds.minZ+bounds.maxZ)/2],'wall');panel.material=m.ceilingPanel;
    const alongX=[],alongZ=[];
    for(let x=bounds.minX+tileX;x<bounds.maxX-.01;x+=tileX)alongZ.push([x,height-.004,(bounds.minZ+bounds.maxZ)/2]);
    for(let z=bounds.minZ+tileZ;z<bounds.maxZ-.01;z+=tileZ)alongX.push([(bounds.minX+bounds.maxX)/2,height-.004,z]);
    repeats(root,'ceiling-long-tile-joints',[.012,.008,depth],alongZ,'gray');repeats(root,'ceiling-cross-tile-joints',[width,.008,.012],alongX,'gray');
    m.ceilingLight ||=s._material(0xf4f3e6,.55,0,{emissive:0xf4f0dc,emissiveIntensity:.65});
    const horizontal=width>depth,length=horizontal?width:depth,count=Math.max(1,Math.floor(length/3.4)),positions=[];
    for(let i=0;i<count;i++)positions.push([horizontal?bounds.minX+length*(i+.5)/count:(bounds.minX+bounds.maxX)/2,height-.035,horizontal?(bounds.minZ+bounds.maxZ)/2:bounds.minZ+length*(i+.5)/count]);
    const lights=repeats(root,'flush-fluorescent-ceiling-fixtures',horizontal?[1.12,.035,.3]:[.3,.035,1.12],positions,'white');if(lights)lights.material=m.ceilingLight;
    return root;
  };
  const sign=(parent,text,p,width=.8)=>{
    const node=group(parent,'room-sign',p);node.userData.text=text;
    box(node,'room-sign-back',[width,.18,.025],[0,0,0],'white');box(node,'room-sign-blue-rule',[width,.025,.028],[0,-.078,.003],'blue');
    if(typeof document!=='undefined' && typeof document.createElement==='function'){
      const canvas=document.createElement('canvas');canvas.width=768;canvas.height=160;const ctx=canvas.getContext?.('2d');
      if(ctx){ctx.fillStyle='#e5e8df';ctx.fillRect(0,0,768,160);ctx.fillStyle='#29433f';ctx.font='700 76px "Malgun Gothic",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,384,78,720);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;s.textures?.add(texture);const material=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide});s.materials?.add(material);const face=s._mesh(geo(`sign:${width}`,()=>new THREE.PlaneGeometry(width,.16)),material,node,[0,.005,.015]);face.castShadow=false;}
    }
    return node;
  };

  // Walls are authored around openings. The upper layer starts at the exact
  // cutaway top, so enabling full walls does not stack duplicate wall faces.
  const wallLine=(name,a,b,{height=2.9,openings=[],paint='wall'}={})=>{
    const length=Math.hypot(b[0]-a[0],b[1]-a[1]),rotation=-Math.atan2(b[1]-a[1],b[0]-a[0]);
    const lower=group(environment.structure,`${name}-low-wall`,[a[0],0,a[1]]),upper=group(environment.facade,`${name}-upper-wall`,[a[0],0,a[1]]);
    lower.rotation.y=upper.rotation.y=rotation;
    for(const node of [lower,upper])Object.assign(node.userData,{routeWall:true,wallLength:length,wallOpenings:openings.map(v=>({...v}))});
    const gaps=openings.map(o=>({...o,min:Math.max(0,o.offset-o.width/2),max:Math.min(length,o.offset+o.width/2),bottom:o.sill??0,top:(o.sill??0)+o.height}));
    const cuts=[0,length,...gaps.flatMap(o=>[o.min,o.max])].filter((v,i,all)=>all.indexOf(v)===i).sort((x,y)=>x-y);
    for(let i=1;i<cuts.length;i++){
      const l=cuts[i-1],r=cuts[i];if(r-l<.001)continue;
      const active=gaps.filter(o=>(l+r)/2>o.min-.0001&&(l+r)/2<o.max+.0001).sort((x,y)=>x.bottom-y.bottom);
      let cursor=0;const spans=[];for(const gap of active){if(gap.bottom>cursor)spans.push([cursor,Math.min(height,gap.bottom)]);cursor=Math.max(cursor,gap.top);}if(cursor<height)spans.push([cursor,height]);
      for(const [bottom,top]of spans)for(const [parent,y0,y1]of [[lower,bottom,Math.min(top,.85)],[upper,Math.max(bottom,.85),top]])if(y1-y0>.001)box(parent,'route-wall-panel',[r-l,y1-y0,.1],[(l+r)/2,(y0+y1)/2,0],paint);
    }
    return {lower,upper,length,rotation};
  };
  const glazedLine=(name,a,b,{sill=.85,top=2.65,pitch=1.18,paint='glass'}={})=>{
    const length=Math.hypot(b[0]-a[0],b[1]-a[1]),root=group(details,`${name}-glazing`,[a[0],0,a[1]]);root.rotation.y=-Math.atan2(b[1]-a[1],b[0]-a[0]);
    Object.assign(root.userData,{transparentObservationWindow:true,sill,top});
    const count=Math.max(1,Math.ceil(length/pitch));
    for(let i=0;i<count;i++){
      const left=i*length/count,right=(i+1)*length/count;
      const pane=box(root,'observation-window-glass',[right-left-.035,top-sill-.04,.018],[(left+right)/2,(sill+top)/2,0],paint);pane.userData.clearOpening=true;
    }
    for(const y of [sill,top])box(root,'window-horizontal-frame',[length,.04,.065],[length/2,y,0],'trim');
    for(let i=0;i<=count;i++)box(root,'window-mullion',[.035,top-sill,.065],[i*length/count,(sill+top)/2,0],'trim');
    return root;
  };
  const door=(name,point,width,{rotation=0,label=name,threshold=.02,height=2.3,paint='wall',glazed=true,glassPaint='glass',windowWidth,enterable=true,times=[]}={})=>{
    const root=group(details,`${name}-doorway`,[point[0],threshold,point[1]]);root.rotation.y=rotation;
    Object.assign(root.userData,{customArchitecturalDoor:true,doorId:name,openingWidth:width,openingHeight:height,sourceTimesSeconds:times});
    for(const x of [-width/2-.025,width/2+.025])box(root,'door-jamb',[.065,height+.08,.12],[x,height/2,0],'trim');
    box(root,'door-head',[width+.12,.08,.12],[0,height+.02,0],'trim');box(root,'door-threshold',[width+.1,.025,.14],[0,.0125,0],'steel');
    const pivot=group(root,`${name}-door-leaf`,[-width/2,0,0]);
    Object.assign(pivot.userData,{doorLeaf:true,proximityDoor:{enterable,kind:'hinge',axis:'y',closed:0,open:Math.PI*.48,trigger:[0,0,0],width,height,label,groupId:`dryer-route:${level}:${name}`,accessBasis:enterable?'current continuous walk enters the modelled room':'unconfirmed destination; closed exterior face only'}});
    const leafWidth=width-.045;
    box(pivot,'door-lower-panel',[leafWidth,glazed?1.06:height-.05,.04],[width/2,glazed?.53:height/2,0],paint);
    if(glazed){
      const paneWidth=Math.min(leafWidth-.1,windowWidth??leafWidth-.1);
      box(pivot,'door-upper-window',[paneWidth,.83,.022],[width/2,1.5,.005],glassPaint);box(pivot,'door-upper-panel',[leafWidth,.32,.04],[width/2,height-.17,0],paint);
      if(windowWidth!==undefined){
        const solidWidth=(leafWidth-paneWidth)/2;
        for(const side of [-1,1]){
          box(pivot,'door-window-opaque-side',[solidWidth,.89,.04],[width/2+side*(paneWidth+solidWidth)/2,1.495,0],paint);
          box(pivot,'door-narrow-window-frame',[.035,.89,.055],[width/2+side*paneWidth/2,1.495,.005],'trim');
        }
        pivot.userData.observedWindowWidthRatio=paneWidth/leafWidth;
      }
      for(const x of [.0375,width-.0375])box(pivot,'door-window-side-stile',[.075,height,.05],[x,height/2,0],paint);for(const y of [1.05,1.94])box(pivot,'door-window-rail',[leafWidth,.07,.055],[width/2,y,.005],'trim');
    }
    for(const y of [.25,height-.25])cylinder(pivot,'door-hinge',.019,.1,[0,y,.025],'steel');
    for(const z of [-.065,.065]){box(pivot,'door-latch-backplate',[.06,.2,.025],[width-.13,1.02,z],'steel');box(pivot,'door-lever',[.15,.028,.035],[width-.17,1.04,z*1.35],'dark');}
    sign(root,label,[0,height+.2,.07],Math.min(width+.1,1.15));
    return root;
  };

  if(level===1){
    const blueFloor=spec.routeSurvey?.overlookFactory?.blueFloor;
    if(blueFloor){
      const finish=floorFinish('observed-packing-blue-floor',blueFloor,'blue');Object.assign(finish.userData,{source,currentVideoReference:true,sourceTimesSeconds:[342,348,354],positionBasis:'video-observed floor color; approximate registration'});
      // The original-resolution overlook shows a closed clean-room ceiling,
      // six jet outlets and a separate lower cabinet. These belong to the room,
      // never to one movable packing-machine assembly.
      const context=group(details,'blue-packing-room-context');context.userData.sourceTimesSeconds=[344,348,354,390];
      wallLine('blue-room-back',[blueFloor.minX,-6.65],[blueFloor.maxX,-6.65],{height:6.15});
      const hvac=group(context,'six-jet-plenum-and-lower-cabinet',[5.25,0,-6.2]);
      Object.assign(hvac.userData,{observedJetOutlets:6,functionAndCapacityUnconfirmed:true,dimensionsMeasured:false});
      box(hvac,'wall-plenum',[4.0,.72,.38],[0,4.65,0],'gray');
      const boreGeo=geo('jet-open-flared-bore',()=>new THREE.CylinderGeometry(.265,.18,.24,24,1,true));
      for(let i=0;i<6;i++){
        const jet=group(hvac,'round-jet-outlet',[-1.62+i*.648,4.66,.3]);
        const throat=s._mesh(boreGeo,m.white,jet);throat.rotation.x=Math.PI/2;throat.name='dryer-route-open-jet-bore';
        const rim=s._mesh(geo('jet-front-rim',()=>new THREE.TorusGeometry(.267,.048,8,32)),m.white,jet,[0,0,.125]);rim.name='dryer-route-white-jet-rim';
        cylinder(jet,'jet-dark-plenum-depth',.174,.014,[0,0,-.13],'dark','z');
      }
      box(hvac,'lower-air-cabinet',[2.2,2.05,.68],[.84,1.045,.13],'white');
      box(hvac,'lower-cabinet-door-seam',[.014,1.93,.018],[.84,1.045,.48],'gray');
      for(const x of [.3,1.38])box(hvac,'air-cabinet-recess-handle',[.035,.2,.025],[x,1.15,.5],'dark');
      repeats(hvac,'cabinet-louver-blades',[.82,.014,.02],Array.from({length:9},(_,i)=>[1.37,.38+i*.043,.485]),'gray');
      box(hvac,'cabinet-upright-service-duct',[.3,2.65,.4],[2.6,3.1,.08],'white');
      box(hvac,'cabinet-duct-top-elbow',[.94,.35,.4],[2.28,4.27,.08],'white');
      // The OP overlook is into an enclosed clean room, not an open bay with
      // the elevator and green production floor continuing behind the machines.
      // Keep its south observation face open to the existing OP glazing, and
      // leave the unfilmed south-east approach free rather than inventing a door.
      const shell=group(details,'blue-clean-room-boundary');Object.assign(shell.userData,{sourceTimesSeconds:[338,344,348,354,390],southObservationFaceOpen:true,unseenDoorAdded:false});
      wallLine('blue-clean-room-rear',[-7.55,-6.5],[8.4,-6.5],{height:6.15});
      wallLine('blue-clean-room-east',[8.4,-6.5],[8.4,1.35],{height:6.15});
      wallLine('blue-clean-room-west-lower',[-8.4,3],[-8.4,-6.5],{height:3.5});
      wallLine('blue-clean-room-west',[-7.55,3],[-7.55,-6.5],{height:6.15,openings:[{offset:4.75,width:9.5,sill:0,height:3.5},{offset:4.75,width:9.1,sill:4.55,height:1.6}]});
      const observation=glazedLine('blue-clean-room-upper-observation',[-7.55,2.8],[-7.55,-6.3],{sill:4.55,top:6.15,pitch:1.3});
      observation.userData.sourceTimesSeconds=[378,384,390,396,402];
      for(const x of [-8.3,8.3])skirting(shell,'clean-room-side-skirting',[x,-6.4],[x,1.35],.12);
      skirting(shell,'clean-room-rear-skirting',[-8.3,-6.4],[8.3,-6.4],.12);
      const ceiling=group(environment.facade,'blue-room-ceiling');
      box(ceiling,'clean-room-ceiling',[15.95,.08,9.5],[.425,6.15,-1.75],'wall');
      repeats(ceiling,'clean-room-ceiling-panel-joints-long',[.015,.012,9.5],Array.from({length:13},(_,i)=>[-7.2+i*1.2,6.102,-1.75]),'trim');
      repeats(ceiling,'clean-room-ceiling-panel-joints-cross',[15.95,.012,.015],Array.from({length:7},(_,i)=>[.425,6.102,-5.3+i*1.2]),'trim');
      m.ceilingLight ||=s._material(0xf4f3e6,.55,0,{emissive:0xf4f0dc,emissiveIntensity:.25});
      const lightPositions=[];for(const x of [-5.8,-1.8,2.2,6.2])for(const z of [-5.0,-2.0,1.0])lightPositions.push([x,6.1,z]);
      const lights=repeats(ceiling,'recessed-ceiling-lights',[1.1,.025,.42],lightPositions,'white');lights.material=m.ceilingLight;
      ceiling.userData.lightingSpacingRepresentative=true;
      const fan=group(context,'observed-floor-fan',[2.65,0,1.75]);fan.userData.sourceTimesSeconds=[344,348];
      cylinder(fan,'pedestal-fan-foot',.3,.055,[0,.035,0],'white');cylinder(fan,'pedestal-fan-shaft',.026,1.15,[0,.63,0],'gray');
      cylinder(fan,'pedestal-fan-motor',.12,.23,[0,1.46,-.1],'gray','z');
      for(const r of [.12,.23,.34]){const ring=s._mesh(geo(`floor-fan-ring:${r}`,()=>new THREE.TorusGeometry(r,.008,5,40)),m.gray,fan,[0,1.46,.09]);ring.name='dryer-route-floor-fan-wire-ring';}
      for(let i=0;i<10;i++){const a=i*Math.PI/5;bar(fan,'fan-wire-spoke',[0,1.46,.1],[Math.cos(a)*.34,1.46+Math.sin(a)*.34,.1],.006,'gray');}
      cylinder(fan,'pedestal-fan-hub',.065,.06,[0,1.46,.09],'white','z');
      for(let i=0;i<3;i++){const a=i*Math.PI*2/3,blade=box(fan,'static-fan-blade',[.12,.25,.014],[Math.sin(a)*.15,1.46+Math.cos(a)*.15,.045],'white');blade.rotation.z=-a;}
      fan.userData.operatingAnimationAdded=false;
      const bins=group(context,'observed-blue-trays',[6.8,0,1.55]);bins.userData.movableContext=true;
      for(let i=0;i<4;i++){box(bins,'blue-tray-base',[.5,.025,.48],[0,.12+i*.13,0],'blue');for(const x of [-.24,.24])box(bins,'blue-tray-edge',[.025,.12,.48],[x,.18+i*.13,0],'blue');for(const z of [-.23,.23])box(bins,'blue-tray-edge',[.5,.12,.025],[0,.18+i*.13,z],'blue');}
      const wraps=group(details,'green-wrapped-corrugated-bundles');wraps.userData.sourceTimesSeconds=[234,252];wraps.userData.movableContext=true;
      m.wrappingFilm ||=s._material(0xe5d0b1,.4,0,{transparent:true,opacity:.16,depthWrite:false});
      for(const [x,z]of [[3.8,16.7],[5.2,17.0]]){
        box(wraps,'bundle-pallet',[1.18,.14,.85],[x,.075,z],'wood');
        box(wraps,'wrapped-cardboard-bundle',[1.1,1.55,.79],[x,.92,z],'woodFloor');
        repeats(wraps,'corrugated-sheet-edges',[1.115,.008,.8],Array.from({length:18},(_,i)=>[x,.18+i*.086,z]),'wood');
        for(const dx of [-.28,.28])box(wraps,'vertical-bundle-strap',[.025,1.57,.805],[x+dx,.92,z],'paper');
        const film=box(wraps,'clear-bundle-wrap',[1.125,1.57,.815],[x,.92,z],'white');film.material=m.wrappingFilm;
      }
      wraps.userData.observedMinimumTallBundles=2;
    }
    const opening=spec.openings?.find(o=>o.label==='계단 황색창');
    if(opening){
      const z=spec.bounds.minZ+opening.offset,x=spec.bounds.maxX,sill=opening.sill||0,top=sill+opening.height;
      const window=glazedLine('entrance-stair-yellow-window',[x,z-opening.width/2],[x,z+opening.width/2],{sill,top,pitch:opening.width+.1,paint:'yellowGlass'});
      window.userData.sourceTimesSeconds=[100,112,118,144];
      for(const y of [sill+.55,sill+1.05])bar(window,'yellow-window-safety-rail',[0,y,.11],[opening.width,y,.11],.022);
    }
    return details;
  }

  if(level===2 && spec.routeSurvey){
    const route=spec.routeSurvey;
    const corridorRuns=[
      ['south-observation-corridor',{minX:-5.3,maxX:28.2,minZ:18.4,maxZ:21.4}],
      ['west-observation-corridor',{minX:-8.45,maxX:-5.55,minZ:3,maxZ:18.35}],
      ['west-blue-hall-corridor',{minX:-8.45,maxX:-7.55,minZ:-6.7,maxZ:3}],
      ['north-observation-corridor',{minX:-5.4,maxX:13.4,minZ:-8.4,maxZ:-6.7}],
    ];
    for(const [name,bounds]of corridorRuns){floorFinish(`${name}-floor`,bounds,'corridorGreen');suspendedCeiling(name,name==='north-observation-corridor'?{...bounds,maxX:8.6}:bounds);}
    const corridorTrim=group(details,'corridor-wall-finishes');
    skirting(corridorTrim,'south-inner-skirting',[-5.3,18.425],[28.2,18.425]);
    skirting(corridorTrim,'south-outer-skirting',[-5.3,21.49],[28.2,21.49]);
    skirting(corridorTrim,'west-outer-skirting',[-8.49,3],[-8.49,18.35]);
    skirting(corridorTrim,'west-op-skirting',[-5.42,3],[-5.42,8.55]);
    skirting(corridorTrim,'west-op-skirting',[-5.42,9.65],[-5.42,13.4]);
    const wayfinding=group(details,'observed-corridor-wayfinding');wayfinding.userData.sourceTimesSeconds=[150,222,246,294,408];
    const arrowShape=new THREE.Shape();arrowShape.moveTo(-.09,-.4);arrowShape.lineTo(.09,-.4);arrowShape.lineTo(.09,.08);arrowShape.lineTo(.25,.08);arrowShape.lineTo(0,.4);arrowShape.lineTo(-.25,.08);arrowShape.lineTo(-.09,.08);arrowShape.closePath();
    const arrowGeometry=geo('corridor-yellow-direction-arrow',()=>{const geometry=new THREE.ShapeGeometry(arrowShape);geometry.rotateX(-Math.PI/2);return geometry;});
    for(const [x,z,angle]of [[26.5,19.7,Math.PI/2],[12,19.7,Math.PI/2],[-7,16.5,0],[-8,0,0],[-1,-7.5,-Math.PI/2]]){
      const arrow=s._mesh(arrowGeometry,m.yellow,wayfinding,[x,.027,z]);arrow.rotation.y=angle;arrow.name='dryer-route-yellow-floor-direction-arrow';
    }
    for(const x of [5.5,17.4]){
      const board=group(wayfinding,'corridor-noticeboard',[x,1.6,21.46]);box(board,'noticeboard-frame',[1.25,.85,.04],[0,0,0],'gray');box(board,'noticeboard-dark-backing',[1.16,.76,.015],[0,0,-.028],'dark');
      for(let row=0;row<2;row++)for(let col=0;col<3;col++)box(board,'anonymous-wall-notice',[.28,.27,.012],[-.37+col*.37,-.18+row*.35,-.042],'paper');
      board.userData.readablePersonalInformationAdded=false;
    }
    const upperStair=route.upperStair;
    if(upperStair){
      const b=upperStair.bounds,window=upperStair.window,height=6.35,room=group(details,'upper-stairwell-context');
      Object.assign(room.userData,{sourceTimesSeconds:upperStair.sourceTimes,compassOrientationConfirmed:false,topology:upperStair.topology,entryStairUnchanged:true});
      wallLine('upper-stairwell-west',[b.minX,b.minZ],[b.minX,b.maxZ],{height:3.5,openings:[{offset:upperStair.lowerDoor[1]-b.minZ,width:1.15,height:2.3}]});
      wallLine('upper-stairwell-east',[b.maxX,b.minZ],[b.maxX,b.maxZ],{height,openings:[{offset:window.position[1]-b.minZ,width:window.width,sill:window.sill,height:window.height}]});
      wallLine('upper-stairwell-south',[b.minX,b.maxZ],[b.maxX,b.maxZ],{height});
      wallLine('upper-stairwell-north',[b.minX,b.minZ],[b.maxX,b.minZ],{height});
      box(environment.facade,'upper-stairwell-ceiling',[b.maxX-b.minX,.06,b.maxZ-b.minZ],[(b.minX+b.maxX)/2,height+.03,(b.minZ+b.maxZ)/2],'wall');
      // 420–432s shows diffuse daylight through pale frosted panes, rather
      // than a clear view into the surrounding model's unmeasured low wing.
      m.stairFrostedGlass ||=s._material(0xe1e7df,.72,0,{transparent:true,opacity:.82,emissive:0xcbd9da,emissiveIntensity:.35,depthWrite:false,side:THREE.DoubleSide});
      const glazing=glazedLine('upper-stairwell-tall-landing-window',[b.maxX,window.position[1]-window.width/2],[b.maxX,window.position[1]+window.width/2],{sill:window.sill,top:window.sill+window.height,pitch:1.17,paint:'stairFrostedGlass'});
      Object.assign(glazing.userData,{sourceTimesSeconds:[420,424,428,432,443],landingFacingWindow:true});
      for(const y of [1.8,2.25,2.7])bar(room,'stair-window-safety-bar',[b.maxX-.13,y,window.position[1]-window.width/2],[b.maxX-.13,y,window.position[1]+window.width/2],.025,'steel');
      const lowerDoor=door('upper-stair-entrance',upperStair.lowerDoor,1.15,{rotation:Math.PI/2,label:'3층 연결 계단',glazed:false,paint:'gray',times:[414,418,420]});
      lowerDoor.userData.routeStairEntry=true;
      const approach={minX:7.55,maxX:8.6,minZ:-8.5,maxZ:-6.7};floorFinish('upper-stair-approach-floor',approach,'corridorGreen');suspendedCeiling('upper-stair-approach',approach);
      for(const [a,c]of [[[b.minX+.07,b.minZ+.07],[b.maxX-.07,b.minZ+.07]],[[b.maxX-.07,b.minZ+.07],[b.maxX-.07,b.maxZ-.07]],[[b.minX+.07,b.maxZ-.07],[b.maxX-.07,b.maxZ-.07]]]){
        const length=Math.hypot(c[0]-a[0],c[1]-a[1]),trim=group(room,'stairwell-black-skirting',[a[0],0,a[1]]);trim.rotation.y=-Math.atan2(c[1]-a[1],c[0]-a[0]);box(trim,'black-stairwell-skirting',[length,.14,.025],[length/2,.07,0],'black');
      }
    }
    wallLine('south-observation',[ -5.3,18.35],[28.2,18.35],{height:2.9,openings:[{offset:16.75,width:33.5,sill:.85,height:1.8}]});
    glazedLine('south-observation',[-5.3,18.35],[28.2,18.35]);
    wallLine('west-return-observation',[-5.35,13.7],[-5.35,18.35],{height:2.9,openings:[{offset:2.325,width:4.65,sill:.85,height:1.8}]});
    glazedLine('west-return-observation',[-5.35,13.7],[-5.35,18.35]);
    const dressing=route.dressingRoom,b=dressing.bounds;
    suspendedCeiling('dressing-room',b,{height:2.6,tileX:.6,tileZ:.6});
    floorFinish('dressing-raised-wood-floor',b,'woodFloor',.08);
    const dressingRoot=group(details,'dressing-room-furnishings',[0,.08,0]);Object.assign(dressingRoot.userData,{sourceTimesSeconds:dressing.sourceTimes,lockerCountBasis:'tan minimum six columns by two tiers observed; partly filmed gray bank represented proportionally'});
    const doorOffset=dressing.door[0]-b.minX;
    wallLine('dressing-south',[b.minX,b.maxZ],[b.maxX,b.maxZ],{openings:[{offset:doorOffset,width:dressing.width,height:2.38}]});
    for(const [name,a,c]of [['north',[b.minX,b.minZ],[b.maxX,b.minZ]],['west',[b.minX,b.minZ],[b.minX,b.maxZ]],['east',[b.maxX,b.minZ],[b.maxX,b.maxZ]]])wallLine(`dressing-${name}`,a,c);
    const dressingDoor=door('dressing',dressing.door,dressing.width,{label:'탈의실 · 탈의장',threshold:.08,times:dressing.sourceTimes});
    dressingDoor.userData.genderConfirmed=false;
    const reader=group(details,'dressing-access-reader',[dressing.door[0]+.67,1.45,b.maxZ+.075]);
    box(reader,'reader-case',[.13,.2,.045],[0,0,0],'gray');box(reader,'reader-dark-face',[.1,.13,.008],[0,.015,.027],'dark');box(reader,'reader-status-light',[.035,.02,.01],[.025,-.055,.028],'red');reader.userData.accessDigitsStored=false;
    const lockerWidth=(b.maxX-b.minX-.28)/6;
    for(let col=0;col<6;col++)for(let row=0;row<2;row++){
      const x=b.minX+.14+lockerWidth*(col+.5),y=.45+row*.92,z=b.minZ+.29;
      const locker=box(dressingRoot,'tan-dressing-locker',[lockerWidth-.018,.9,.5],[x,y,z],'wood');locker.userData.anonymousLocker=true;
      box(dressingRoot,'locker-label',[.13,.028,.012],[x,y+.33,z+.257],'white');cylinder(dressingRoot,'locker-knob',.018,.025,[x+lockerWidth*.3,y,z+.269],'steel','z');
    }
    for(let col=0;col<2;col++)for(let row=0;row<2;row++){
      const z=b.maxZ-1.1-col*.58,y=.45+row*.92;
      const locker=box(dressingRoot,'gray-dressing-locker',[.5,.9,.56],[b.maxX-.27,y,z],'gray');locker.userData.quantityRepresentative=true;box(dressingRoot,'gray-locker-label',[.013,.03,.13],[b.maxX-.526,y+.31,z],'white');
    }
    box(dressingRoot,'split-airconditioner',[.95,.34,.22],[b.maxX-.83,2.35,b.minZ+.18],'white');repeats(dressingRoot,'airconditioner-outlet',[.85,.014,.015],[0,1,2].map(i=>[b.maxX-.83,2.25+i*.025,b.minZ+.296]),'dark');
    box(dressingRoot,'recessed-stainless-service-cabinet',[.025,1.32,.62],[b.maxX-.07,1.08,b.minZ+1.65],'steel');box(dressingRoot,'service-cabinet-handle',[.03,.22,.035],[b.maxX-.09,1.08,b.minZ+1.45],'dark');
    const roller=cylinder(dressingRoot,'loose-floor-roller',.085,.26,[b.maxX-.95,.085,b.maxZ-1.35],'gray','z');roller.userData.movableContext=true;

    const op=route.opRoom,o=op.bounds,opRoot=group(details,'op-room-furnishings');opRoot.userData.sourceTimesSeconds=op.sourceTimes;
    suspendedCeiling('op-room',o,{height:2.84,tileX:.6,tileZ:1.2});
    floorFinish('op-room-green-floor',o);
    const windowSides=[['north',[o.minX,o.minZ],[o.maxX,o.minZ]],['south',[o.minX,o.maxZ],[o.maxX,o.maxZ]],['east',[o.maxX,o.minZ],[o.maxX,o.maxZ]]];
    for(const [name,a,c]of windowSides){const length=Math.hypot(c[0]-a[0],c[1]-a[1]);wallLine(`op-${name}`,a,c,{openings:[{offset:length/2,width:length-.32,sill:.85,height:1.8}]});const start=[a[0]+(c[0]-a[0])*.16/length,a[1]+(c[1]-a[1])*.16/length],end=[c[0]-(c[0]-a[0])*.16/length,c[1]-(c[1]-a[1])*.16/length];glazedLine(`op-${name}`,start,end);}
    wallLine('op-west',[o.minX,o.minZ],[o.minX,o.maxZ],{openings:[{offset:op.door[1]-o.minZ,width:op.width,height:2.32}]});
    door('op',op.door,op.width,{rotation:-Math.PI/2,label:'OP실',times:op.sourceTimes});
    const desk=(name,x,z,width=1.45,depth=.65,rotation=0)=>{const root=group(opRoot,name,[x,0,z]);root.rotation.y=rotation;box(root,'office-desktop',[width,.055,depth],[0,.77,0],'white');for(const xx of [-width*.43,width*.43])for(const zz of [-depth*.4,depth*.4])box(root,'desk-leg',[.04,.74,.04],[xx,.37,zz],'steel');for(const xx of [-.3,.3]){box(root,'anonymous-monitor',[.51,.32,.045],[xx,1.11,-.12],'black');box(root,'monitor-stand',[.04,.17,.04],[xx,.9,-.12],'dark');box(root,'monitor-foot',[.2,.02,.13],[xx,.81,-.08],'dark');}box(root,'keyboard',[.5,.025,.16],[0,.815,.15],'dark');return root;};
    desk('north-operator-desk',-2.1,o.minZ+.77,1.65,.72);
    desk('east-operator-desk',o.maxX-.53,o.maxZ-2.0,1.55,.7,Math.PI/2);
    const printer=group(opRoot,'office-printer-and-binders',[-3.9,0,o.minZ+.82]);
    box(printer,'printer-table',[1.1,.05,.55],[0,.72,0],'wood');for(const x of [-.46,.46])for(const z of [-.2,.2])box(printer,'printer-table-leg',[.035,.7,.035],[x,.35,z],'steel');box(printer,'desktop-printer',[.49,.24,.4],[.16,.865,0],'gray');box(printer,'printer-paper-tray',[.4,.035,.17],[.16,.87,.25],'white');repeats(printer,'anonymous-binders',[.05,.3,.25],Array.from({length:5},(_,i)=>[-.42+i*.055,.895,0]),'yellow');
    const panels=group(opRoot,'observed-control-cabinet-row',[o.minX+.4,0,o.minZ+2.05]);panels.userData.liveOperatingValuesAdded=false;
    for(let i=0;i<3;i++){
      const z=i*1.0;box(panels,'control-cabinet',[.64,2.45,.95],[0,1.245,z],'gray');box(panels,'anonymous-control-screen',[.015,.4,.39],[.331,1.48,z],'dark');box(panels,'unreadable-static-screen',[.012,.3,.29],[.342,1.48,z],'paper');cylinder(panels,'emergency-stop-yellow-ring',.07,.02,[.338,2.1,z],'yellow','x');cylinder(panels,'emergency-stop-red-button',.037,.033,[.355,2.1,z],'red','x');box(panels,'cabinet-door-handle',[.025,.19,.035],[.345,1.1,z-.35],'black');repeats(panels,'cabinet-low-vents',[.015,.012,.48],Array.from({length:7},(_,n)=>[.335,.29+n*.035,z]),'dark');
    }
    const table=group(opRoot,'small-round-office-table',[-2.2,0,7.0]);cylinder(table,'round-tabletop',.55,.045,[0,.76,0],'white');cylinder(table,'table-pedestal',.045,.71,[0,.375,0],'steel');cylinder(table,'table-foot',.3,.035,[0,.035,0],'dark');
    const chair=(x,z)=>{const root=group(opRoot,'office-chair',[x,0,z]);box(root,'chair-seat',[.48,.08,.46],[0,.48,0],'black');box(root,'chair-back',[.47,.48,.06],[0,.78,-.21],'black');cylinder(root,'chair-post',.025,.42,[0,.23,0],'steel');for(let i=0;i<5;i++){const a=i*Math.PI*2/5;bar(root,'chair-foot',[0,.08,0],[Math.sin(a)*.28,.08,Math.cos(a)*.28],.018,'dark');}};
    chair(-2.2,5.45);chair(-1.0,10.9);
    box(opRoot,'tall-office-refrigerator',[.67,1.82,.62],[o.maxX-.44,.93,o.maxZ-.44],'white');box(opRoot,'refrigerator-door-seam',[.61,.018,.012],[o.maxX-.44,1.35,o.maxZ-.121],'gray');
    const shelf=group(opRoot,'office-bookcase',[o.minX+.8,0,o.maxZ-.32]);box(shelf,'bookcase-back',[1.32,1.8,.035],[0,.92,.13],'wood');for(const x of [-.66,.66])box(shelf,'bookcase-side',[.035,1.8,.37],[x,.92,0],'wood');for(const y of [.05,.6,1.15,1.8])box(shelf,'bookcase-shelf',[1.35,.035,.37],[0,y,0],'wood');repeats(shelf,'anonymous-files',[.065,.36,.23],Array.from({length:24},(_,i)=>[-.56+(i%12)*.1,.8+Math.floor(i/12)*.55,-.02]),'paper');
    const fan=group(opRoot,'office-pedestal-fan',[-3.75,0,11.55]);cylinder(fan,'fan-base',.22,.04,[0,.04,0],'white');cylinder(fan,'fan-stand',.025,1.0,[0,.55,0],'gray');const ring=s._mesh(geo('fan-guard',()=>new THREE.TorusGeometry(.24,.012,6,36)),m.gray,fan,[0,1.22,0]);ring.name='dryer-route-fan-guard';cylinder(fan,'fan-hub',.055,.06,[0,1.22,0],'gray','z');
    // The ordinary corridor and room surfaces remain separate from the lower
    // production machinery visible through them. No extra intermediate slab.
    for(const opening of spec.openings||[]){if(opening.doorKind!=='none'||!(opening.sill>0))continue;const horizontal=['north','south'].includes(opening.side),at=horizontal?spec.bounds.minX+opening.offset:spec.bounds.minZ+opening.offset;const a=horizontal?[at-opening.width/2,opening.side==='south'?spec.bounds.maxZ:spec.bounds.minZ]:[opening.side==='east'?spec.bounds.maxX:spec.bounds.minX,at-opening.width/2],b=horizontal?[at+opening.width/2,a[1]]:[a[0],at+opening.width/2];const window=glazedLine('corridor-exterior-window',a,b,{sill:opening.sill,top:opening.sill+opening.height,pitch:opening.width+.1});Object.assign(window.userData,{representativeSpacing:true,registrationBasis:'observed window type; spacing proportionally registered'});}
    return details;
  }

  if(level===3 && spec.routeSurvey?.glazedEnclosure){
    // The filmed 3F is a worn epoxy workshop floor. Its scuffed grey patches
    // distinguish it from the clean blue packing room and the glossy corridor.
    if(!m.wornGreen.map && typeof document!=='undefined'){
      const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const ctx=canvas.getContext?.('2d');
      if(ctx){
        let seed=931;const random=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
        ctx.fillStyle='#49755c';ctx.fillRect(0,0,512,512);
        for(let i=0;i<140;i++){
          const x=random()*512,y=random()*512,r=10+random()*35;ctx.fillStyle=i%3===0?'rgba(142,147,131,.11)':'rgba(106,135,110,.08)';ctx.beginPath();
          for(let side=0;side<7;side++){const angle=side*Math.PI*2/7,length=r*(.45+random()*.55);const px=x+Math.cos(angle)*length,py=y+Math.sin(angle)*length;if(side===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);}
          ctx.closePath();ctx.fill();
        }
        for(let i=0;i<30;i++){ctx.strokeStyle='rgba(169,174,150,.06)';ctx.lineWidth=.5+random();ctx.beginPath();const x=random()*512,y=random()*512;ctx.moveTo(x,y);ctx.lineTo(x+(random()-.5)*35,y+random()*42);ctx.stroke();}
        const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(4,6);s.textures?.add(texture);m.wornGreen.map=texture;m.wornGreen.color.set(0xffffff);m.wornGreen.needsUpdate=true;
      }
    }
    const wornFloor=floorFinish('third-worn-green-epoxy-floor',spec.mainBounds,'wornGreen',.001);Object.assign(wornFloor.userData,{sourceTimesSeconds:[450,486,538,588,617,678],wearPatternRepresentative:true});
    const stairEntry=spec.routeSurvey.entryFromStair;
    if(stairEntry){
      const p=stairEntry.door,arrival=group(details,'third-stair-arrival-context');Object.assign(arrival.userData,{sourceTimesSeconds:stairEntry.sourceTimes,straightAheadOfUpperFlight:true});
      box(arrival,'brown-stair-door-mat',[.85,.018,1.05],[p[0]+.43,.009,p[1]],'wood');
      const marker=sign(arrival,'3F',[p[0]+.09,1.65,p[1]-1.0],.45);marker.rotation.y=Math.PI/2;
    }
    const b=spec.routeSurvey.glazedEnclosure,w=b.maxX-b.minX,d=b.maxZ-b.minZ,doorPosition=spec.routeSurvey.storageDoor?.position||[b.maxX,(b.minZ+b.maxZ)/2];
    const root=group(details,'yellow-glazed-storage-room');Object.assign(root.userData,{sourceTimesSeconds:[450,462,474,480],roomFunction:'storage-context',functionInferred:true,interiorObserved:true});
    floorFinish('yellow-room-green-floor',b);
    wallLine('yellow-room-east',[b.maxX,b.maxZ],[b.maxX,b.minZ],{openings:[{offset:d/2,width:2.05,sill:1.0,height:1.3}]});
    glazedLine('yellow-room-east-fixed',[b.maxX,b.minZ+d/2-1.025],[b.maxX,b.minZ+d/2+1.025],{sill:1.0,top:2.3,pitch:2.5,paint:'yellowGlass'});
    wallLine('yellow-room-south',[b.minX,b.maxZ],[b.maxX,b.maxZ],{openings:[{offset:w/2,width:2.05,sill:1.0,height:1.3}]});glazedLine('yellow-room-side',[b.minX+w/2-1.025,b.maxZ],[b.minX+w/2+1.025,b.maxZ],{sill:1.0,top:2.3,pitch:2.5,paint:'yellowGlass'});
    wallLine('yellow-room-west',[b.minX,b.minZ],[b.minX,b.maxZ]);
    wallLine('yellow-room-north',[b.minX,b.minZ],[b.maxX,b.minZ],{openings:[{offset:doorPosition[0]-b.minX,width:1.05,height:2.32},{offset:1.4,width:1.15,sill:1.0,height:1.3}]});
    glazedLine('yellow-room-entry-facing-window',[b.minX+.825,b.minZ],[b.minX+1.975,b.minZ],{sill:1.0,top:2.3,pitch:2,paint:'yellowGlass'});
    door('yellow-storage',doorPosition,1.05,{rotation:Math.PI,label:'3층 보관 구획',glassPaint:'yellowGlass',windowWidth:.6,times:[450,462,474,480]});
    const shelf=group(root,'observed-storage-shelving',[b.minX+.36,0,b.minZ+1.9]);
    for(const x of [-.26,.26])for(const z of [-1.15,1.15])box(shelf,'storage-shelf-upright',[.035,1.85,.035],[x,.945,z],'steel');for(const y of [.12,.65,1.18,1.75])box(shelf,'storage-shelf-deck',[.6,.035,2.4],[0,y,0],'steel');
    for(let i=0;i<3;i++){box(shelf,'yellow-storage-bin',[.48,.31,.61],[0,.82,-.8+i*.8],'yellow');box(shelf,'anonymous-tool-case',[.46,.18,.54],[0,.23,-.8+i*.8],'teal');box(shelf,'tool-case-handle',[.025,.07,.15],[.25,.24,-.8+i*.8],'dark');}
    const bench=group(root,'small-storage-workbench',[b.minX+w*.37,0,b.minZ+.37]);box(bench,'storage-bench-top',[1.45,.05,.62],[0,.8,0],'steel');for(const x of [-.62,.62])for(const z of [-.24,.24])box(bench,'storage-bench-leg',[.04,.77,.04],[x,.385,z],'steel');box(bench,'unlabelled-toolbox',[.6,.22,.36],[0,.935,0],'dark');
    const boundary=group(details,'closed-gray-service-door',[.8,0,spec.routeSurvey.entryFromStair?.door[1]??-9.235]);boundary.rotation.y=Math.PI/2;Object.assign(boundary.userData,{sourceTimesSeconds:[450,480],destinationUnconfirmed:true,unseenInteriorAdded:false,registrationBasis:'entry-relative room-and-end-door topology; approximate'});
    box(boundary,'closed-service-corridor-end-wall',[2.1,2.9,.08],[0,1.45,-.05],'wall');
    box(boundary,'fixed-gray-service-door',[.95,2.18,.025],[0,1.11,0],'gray');for(const x of [-.51,.51])box(boundary,'service-door-jamb',[.05,2.27,.05],[x,1.135,0],'trim');box(boundary,'service-door-handle',[.14,.025,.055],[.32,1.0,.055],'steel');box(boundary,'blank-door-notice',[.54,.24,.012],[0,1.72,.022],'paper');box(boundary,'exit-sign',[.45,.14,.045],[0,2.4,0],'green');
    const insect=group(boundary,'violet-wall-insect-trap',[-.9,1.95,.05]);box(insect,'insect-trap-case',[.46,.24,.09],[0,0,0],'dark');for(const y of [-.055,.055])box(insect,'insect-light-tube',[.39,.018,.015],[0,y,.054],'violet');

    // Only the registered, already-cut window bands receive glazing. The
    // observed facade type is current; bay spacing and wall registration are not measured.
    const perimeter=spec.mainBounds,windowBands=(spec.openings||[]).filter(opening=>opening.label==='3층 2단 황색창');
    const protectedRuns=new Map();
    for(const [index,opening]of windowBands.entries()){
      if(!['west','east'].includes(opening.side))continue;
      const side=opening.side==='west'?-1:1,x=(side<0?perimeter.minX:perimeter.maxX)-side*.045;
      const center=perimeter.minZ+opening.offset,from=center-opening.width/2,to=center+opening.width/2;
      const glazing=glazedLine(`third-exterior-${index}`,[x,from],[x,to],{sill:opening.sill,top:opening.sill+opening.height,pitch:1.18,paint:'yellowGlass'});
      Object.assign(glazing.userData,{sourceTimesSeconds:opening.sourceTimes||[502,590,593,617],registeredSide:opening.side,spacingMeasured:false,facadeOpeningLabel:opening.label});
      protectedRuns.set(`${opening.side}:${from}:${to}`,{side,from,to,x});
    }
    for(const [index,run]of [...protectedRuns.values()].entries()){
      const {side,from,to}=run,length=to-from,x=(side<0?perimeter.minX:perimeter.maxX)-side*.075;
      const protection=group(details,`third-window-lower-protection-${index}`);
      box(protection,'stainless-window-lower-protection',[.025,.9,length],[x,.5,(from+to)/2],'steel');
      box(protection,'stainless-protection-top-edge',[.035,.035,length],[x-side*.006,.97,(from+to)/2],'trim');
      repeats(protection,'stainless-protection-panel-joints',[.012,.88,.014],Array.from({length:Math.max(1,Math.floor(length/1.2))},(_,i)=>[x-side*.02,.5,from+(i+1)*length/(Math.floor(length/1.2)+1)]),'trim');
      const service=group(environment.ducts,`observed-yellow-wall-run-${index}`);Object.assign(service.userData,{sourceTimesSeconds:[502],utilityFunctionConfirmed:false,connectsToEquipment:false});
      cylinder(service,'yellow-wall-service-pipe',.06,length,[x-side*.25,3.22,(from+to)/2],'yellow','z');
      const bracketZs=Array.from({length:Math.max(2,Math.ceil(length/2.5)+1)},(_,i)=>from+i*length/Math.max(1,Math.ceil(length/2.5)));
      for(const z of bracketZs){bar(service,'yellow-run-wall-bracket',[x,3.05,z],[x-side*.25,3.2,z],.018,'white');box(service,'yellow-run-wall-anchor',[.035,.16,.1],[x,3.05,z],'white');}
    }

    const ibcs=group(details,'three-observed-ibc-containers');Object.assign(ibcs.userData,{sourceTimesSeconds:[617],observedMinimumContainerCount:3,contentsConfirmed:false,movableContext:true,catalogEquipmentAdded:false});
    for(const [index,position]of (spec.routeSurvey.ibcRow||[]).entries()){
      const ibc=group(ibcs,`ibc-${index+1}`,[position[0],0,position[1]]);ibc.userData.observedContainerIndex=index+1;
      box(ibc,'ibc-black-pallet-base',[1.2,.13,1.06],[0,.075,0],'black');
      repeats(ibc,'ibc-pallet-feet',[.18,.07,.92],[-.47,0,.47].map(x=>[x,.035,0]),'dark');
      box(ibc,'ibc-white-container',[1.08,1.02,.94],[0,.69,0],'white');
      const vertical=[];for(const x of [-.57,-.285,0,.285,.57])for(const z of [-.51,.51])vertical.push([x,.72,z]);for(const z of [-.255,0,.255])for(const x of [-.57,.57])vertical.push([x,.72,z]);
      repeats(ibc,'ibc-cage-vertical-rails',[.022,1.11,.022],vertical,'steel');
      repeats(ibc,'ibc-cage-front-back-rails',[1.16,.022,.022],[.19,.45,.73,1.01,1.25].flatMap(y=>[-.51,.51].map(z=>[0,y,z])),'steel');
      repeats(ibc,'ibc-cage-side-rails',[.022,.022,1.04],[.19,.45,.73,1.01,1.25].flatMap(y=>[-.57,.57].map(x=>[x,y,0])),'steel');
      cylinder(ibc,'ibc-red-fill-cap',.085,.035,[.14,1.217,0],'red');
      box(ibc,'ibc-anonymous-front-plate',[index===0?.53:.4,.36,.023],[.05,.7,.536],'gray');
      cylinder(ibc,'ibc-lower-outlet',.055,.1,[0,.2,.56],'black','z');box(ibc,'ibc-outlet-handle',[.16,.025,.025],[0,.28,.585],'gray');
    }

    const drains=group(details,'observed-flush-drain-channels');Object.assign(drains.userData,{sourceTimesSeconds:[450,502,516,520],fullNetworkConfirmed:false,topAboveFloor:.008});
    for(const [index,segment]of (spec.routeSurvey.drainSegments||[]).entries()){
      const length=Math.hypot(segment.b[0]-segment.a[0],segment.b[1]-segment.a[1]),width=segment.width||.18;
      const channel=group(drains,`drain-channel-${index}`,[segment.a[0],0,segment.a[1]]);channel.rotation.y=-Math.atan2(segment.b[1]-segment.a[1],segment.b[0]-segment.a[0]);
      box(channel,'drain-dark-recess',[length,.008,width],[length/2,-.001,0],'dark');
      for(const side of [-1,1])box(channel,'drain-flush-stainless-edge',[length,.012,.014],[length/2,.002,side*(width/2-.007)],'steel');
      const count=Math.max(2,Math.ceil(length/.09));repeats(channel,'drain-removable-cover-grates',[.021,.008,width-.035],Array.from({length:count},(_,i)=>[(i+.5)*length/count,.001,0]),'steel');
    }

    // Shared overhead services have their own visible supports. They are
    // portions observed in the hall, not invented process connections.
    const overhead=group(environment.ducts,'third-hall-overhead-services');Object.assign(overhead.userData,{sourceTimesSeconds:[590,617,648,720],utilityServiceConfirmed:false,connectsToEquipment:false,unseenConnectionsAdded:false,minimumClearHeight:4.81});
    const ceiling=group(environment.facade,'third-exposed-ceiling-context');ceiling.userData.cutawayWithFacade=true;
    repeats(ceiling,'third-white-ceiling-support-beams',[.16,.2,26.2],[-6,-2,2,6].map(x=>[x,5.86,0]),'white');
    repeats(ceiling,'third-white-ceiling-cross-beams',[16.8,.3,.23],[-10,-3.5,3.1,9.7].map(z=>[0,5.68,z]),'white');
    box(ceiling,'third-west-longitudinal-support',[1.3,.18,26.2],[-7.45,5.86,0],'white');
    const panels=repeats(ceiling,'third-gray-overhead-panel-strips',[1.025,.035,26.2],Array.from({length:16},(_,i)=>[-7.6875+i*1.025,5.9825,0]),'gray');panels.material=m.ceilingPanel;
    repeats(ceiling,'third-overhead-panel-seams',[.022,.016,26.2],Array.from({length:33},(_,i)=>[-8.2+i*.5125,5.958,0]),'trim');
    m.thirdCeilingLight ||=s._material(0xf1f1e7,.7,0,{emissive:0xeceee0,emissiveIntensity:.75});
    const hallLights=repeats(ceiling,'third-surface-ceiling-light-fixtures',[1.1,.07,.35],[-4,4].flatMap(x=>[-8,-1,6,11.5].map(z=>[x,5.68,z])),'white');hallLights.material=m.thirdCeilingLight;
    const duct=s._mesh(geo('third-open-spiral-duct',()=>new THREE.CylinderGeometry(1,1,1,32,1,true)),m.steel,overhead,[0,5.15,-11.95]);duct.scale.set(.28,15.5,.28);duct.rotation.z=Math.PI/2;duct.name='dryer-route-third-galvanized-open-spiral-duct';
    const turns=15.5/.28,pointCount=Math.ceil(turns*8)+1,points=Array.from({length:pointCount},(_,i)=>{const ratio=i/(pointCount-1),angle=ratio*turns*Math.PI*2;return new THREE.Vector3(-7.75+ratio*15.5,5.15+Math.cos(angle)*.285,-11.95+Math.sin(angle)*.285);});
    const seam=s._mesh(geo('third-spiral-duct-seam',()=>new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),Math.ceil(turns*16),.006,4,false)),m.trim,overhead);seam.name='dryer-route-third-helical-duct-seam';
    const ductHangers=[-6,-2,2,6];
    repeats(overhead,'third-duct-hanger-crossbars',[.065,.055,.84],ductHangers.map(x=>[x,4.8425,-11.95]),'steel');
    repeats(overhead,'third-duct-hanger-rods',[.018,.99,.018],ductHangers.flatMap(x=>[-.36,.36].map(z=>[x,5.335,-11.95+z])),'steel');
    for(const [index,x]of [-7.7,-7.45,-7.8,-7.2].entries())cylinder(overhead,'third-visible-blue-silver-run',index<2?.045:.055,23.4,[x,index<2?5.05:5.22,.3],index<2?'blue':'steel','z');
    const trayZs=[-9,-3,3,9];repeats(overhead,'third-pipe-tray-crossbars',[1.4,.065,.085],trayZs.map(z=>[-7.45,4.975,z]),'steel');
    repeats(overhead,'third-pipe-tray-hanger-rods',[.018,.825,.018],trayZs.flatMap(z=>[-8.0,-6.9].map(x=>[x,5.3875,z])),'steel');
    repeats(overhead,'third-raised-silver-pipe-supports',[.08,.16,.06],trayZs.flatMap(z=>[-7.8,-7.2].map(x=>[x,5.085,z])),'steel');
    cylinder(overhead,'third-visible-red-upper-riser',.065,2.2,[-8.1,4.6,10.8],'red');
    for(const y of [3.65,5.2])bar(overhead,'third-red-riser-wall-bracket',[-8.53,y,10.8],[-8.1,y,10.8],.018,'white');

    const shutter=spec.routeSurvey.shutter;
    if(shutter){
      const fixed=group(details,'closed-observed-gray-roller',[shutter.position[0],0,shutter.position[1]-.07]);Object.assign(fixed.userData,{sourceTimesSeconds:shutter.sourceTimes||[567],destinationUnconfirmed:true,enterable:false,unseenInteriorAdded:false,openingAnimationAdded:false});
      box(fixed,'gray-roller-closed-curtain',[shutter.width-.1,shutter.height-.045,.035],[0,shutter.height/2,.005],'gray');
      repeats(fixed,'gray-roller-static-slats',[shutter.width-.11,.018,.025],Array.from({length:Math.floor(shutter.height/.09)},(_,i)=>[0,.055+i*.09,-.025]),'trim');
      for(const side of [-1,1])box(fixed,'gray-roller-fixed-guide',[.085,shutter.height+.14,.1],[side*(shutter.width/2+.0125),shutter.height/2,0],'steel');
      box(fixed,'gray-roller-fixed-housing',[shutter.width+.2,.21,.24],[0,shutter.height+.115,-.12],'steel');
      const load=group(details,'observed-movable-bulkbag-pallet',[shutter.position[0],0,shutter.position[1]-1.5]);Object.assign(load.userData,{sourceTimesSeconds:[567],movableContext:true,quantityRepresentative:true,contentsConfirmed:false});
      repeats(load,'bulkbag-pallet-slats',[1.08,.055,.18],[-.36,-.12,.12,.36].map(z=>[0,.16,z]),'wood');repeats(load,'bulkbag-pallet-feet',[.18,.12,.9],[-.42,0,.42].map(x=>[x,.07,0]),'dark');
      const bag=s._mesh(geo('third-bulkbag-soft-body',()=>new THREE.CylinderGeometry(.47,.58,1.04,8)),m.white,load,[0,.71,0]);bag.rotation.y=Math.PI/8;bag.name='dryer-route-observed-white-bulkbag';
      cylinder(load,'bulkbag-gathered-top',.15,.12,[0,1.29,0],'white');
      repeats(load,'bulkbag-lift-loop-uprights',[.025,.19,.025],[-.3,.3].flatMap(x=>[-.3,.3].map(z=>[x,1.23,z])),'paper');
      repeats(load,'bulkbag-lift-loop-tops',[.2,.025,.025],[-.3,.3].flatMap(x=>[-.3,.3].map(z=>[x,1.3275,z])),'paper');
    }
    return details;
  }
  return details;
}
