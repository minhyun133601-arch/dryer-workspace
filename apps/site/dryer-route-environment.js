import * as THREE from '../shared/vendor/three.module.js';

// Current 11/12 walk: topology and room use come from the video. These local
// coordinates register that sequence proportionally, never as surveyed sizes.
export function buildDryerRouteEnvironment(s, environment, spec) {
  const level=Number(spec?.id);
  if(![1,2,3].includes(level) || !environment?.architectureFixtures)return;
  if(environment.architectureFixtures.getObjectByName(`dryer-route-${level}-details`))return;
  const source='dryer-entrance-mezzanine-20261112',cache=s.dryerRouteGeometry ||=new Map();
  const geo=(key,make)=>{if(!cache.has(key)){const value=make();cache.set(key,value);s.geometries?.add(value);}return cache.get(key);};
  const colors={wall:0xe1e0d2,green:0x267858,corridorGreen:0x195a3f,skirting:0x124631,wornGreen:0x5b8066,trim:0xb5bfba,steel:0xa8b8b4,dark:0x263b39,black:0x1c2829,wood:0xb6945e,woodFloor:0xd0bb96,gray:0x9fa7a1,white:0xe5e8df,blue:0x507589,yellow:0xc6ad43,red:0xa84235,teal:0x2f706b,paper:0xd9dbce,orange:0xcd8c38};
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
  const sign=(parent,text,p,width=.8,{restriction=false}={})=>{
    const node=group(parent,'room-sign',p);node.userData.text=text;
    box(node,'room-sign-back',[width,.18,.025],[0,0,0],'white');box(node,'room-sign-blue-rule',[width,.025,.028],[0,-.078,.003],'blue');
    if(typeof document!=='undefined' && typeof document.createElement==='function'){
      const canvas=document.createElement('canvas');canvas.width=768;canvas.height=160;const ctx=canvas.getContext?.('2d');
      if(ctx){
        ctx.fillStyle='#e5e8df';ctx.fillRect(0,0,768,160);ctx.fillStyle='#29433f';ctx.font='700 76px "Malgun Gothic",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
        if(restriction){
          ctx.strokeStyle='#233c62';ctx.lineWidth=10;ctx.strokeRect(5,5,758,150);
          ctx.fillText('관계자외',207,76,335);ctx.fillStyle='#ad2832';ctx.fillText('출입금지',558,76,337);
        }else ctx.fillText(text,384,78,720);
        const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;s.textures?.add(texture);
        const material=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide});s.materials?.add(material);
        const face=s._mesh(geo(`sign:${width}`,()=>new THREE.PlaneGeometry(width,.16)),material,node,[0,.005,.015]);face.castShadow=false;
      }
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
  const door=(name,point,width,{rotation=0,label=name,plaque=true,threshold=.02,height=2.3,paint='wall',glazed=true,glassPaint='glass',windowWidth,enterable=true,openAngle=Math.PI*.48,times=[],pairedStorage=false}={})=>{
    const root=group(details,`${name}-doorway`,[point[0],threshold,point[1]]);root.rotation.y=rotation;
    Object.assign(root.userData,{customArchitecturalDoor:true,doorId:name,openingWidth:width,openingHeight:height,sourceTimesSeconds:times});
    for(const x of pairedStorage?[-width/2-.025]:[-width/2-.025,width/2+.025])box(root,'door-jamb',[.065,height+.08,.12],[x,height/2,0],'trim');
    box(root,'door-head',[width+.12,.08,.12],[0,height+.02,0],'trim');box(root,'door-threshold',[width+.1,.025,.14],[0,.0125,0],'steel');
    const pivot=group(root,`${name}-door-leaf`,[-width/2,0,0]);
    Object.assign(pivot.userData,{doorLeaf:true,proximityDoor:{enterable,kind:'hinge',axis:'y',closed:0,open:openAngle,trigger:[0,0,0],width,height,label,groupId:`dryer-route:${level}:${name}`,accessBasis:enterable?'current continuous walk enters the modelled room':'unconfirmed destination; closed exterior face only'}});
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
    if(pairedStorage){
      if(enterable)for(const z of [-.06,.06])cylinder(pivot,'storage-round-latch',.048,.055,[width-.11,1.02,z],'steel','z');
    }else for(const z of [-.065,.065]){box(pivot,'door-latch-backplate',[.06,.2,.025],[width-.13,1.02,z],'steel');box(pivot,'door-lever',[.15,.028,.035],[width-.17,1.04,z*1.35],'dark');}
    if(plaque)sign(root,label,[0,height+.2,.07],Math.min(width+.1,1.15));
    return root;
  };

  if(level===1){
    const blueFloor=spec.routeSurvey?.overlookFactory?.blueFloor;
    if(blueFloor){
      m.cleanCeiling ||= s._material(0xe9e8e0,.8,.02,{emissive:0x8d8c84,emissiveIntensity:.42});
      m.cleanSkyFloor ||= s.mat?.cleanBlueFloor || s._material(0x9fc6d8,.28,.05);
      const finish=floorFinish('observed-packing-blue-floor',blueFloor,'cleanSkyFloor');Object.assign(finish.userData,{source,currentVideoReference:true,sourceTimesSeconds:[342,348,354],positionBasis:'video-observed floor color; approximate registration'});
      // The original-resolution overlook shows a closed clean-room ceiling,
      // six jet outlets and a separate lower cabinet. These belong to the room,
      // never to one movable packing-machine assembly.
      const context=group(details,'blue-packing-room-context');context.userData.sourceTimesSeconds=[344,348,354,390];
      // The clean-room shell is the A-013 wall plan; this keeps only the filmed fittings.
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



      wallLine('blue-clean-room-west',[-5.5,3],[-5.5,-6.5],{height:6.15,openings:[{offset:4.75,width:9.5,sill:0,height:3.5},{offset:4.75,width:9.1,sill:4.55,height:1.6}]});
      const observation=glazedLine('blue-clean-room-upper-observation',[-5.5,2.8],[-5.5,-6.3],{sill:4.55,top:6.15,pitch:1.3});
      observation.userData.sourceTimesSeconds=[378,384,390,396,402];
      for(const x of [-5.46,10.27])skirting(shell,'clean-room-side-skirting',[x,-6.4],[x,3],.12);
      skirting(shell,'clean-room-rear-skirting',[-5.4,-6.41],[10.2,-6.41],.12);
      const ceiling=group(environment.facade,'blue-room-ceiling');
      box(ceiling,'clean-room-ceiling',[15.8,.08,9.5],[2.4,6.15,-1.75],'cleanCeiling');
      repeats(ceiling,'clean-room-ceiling-panel-joints-long',[.015,.012,9.5],Array.from({length:13},(_,i)=>[-4.9+i*1.2,6.102,-1.75]),'trim');
      repeats(ceiling,'clean-room-ceiling-panel-joints-cross',[15.8,.012,.015],Array.from({length:7},(_,i)=>[2.4,6.102,-5.3+i*1.2]),'trim');
      m.ceilingLight ||=s._material(0xf4f3e6,.55,0,{emissive:0xf4f0dc,emissiveIntensity:.25});
      const lightPositions=[];for(const x of [-3.6,.4,4.4,8.4])for(const z of [-5.0,-2.0,1.0])lightPositions.push([x,6.1,z]);
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
      // 2026-11-26 사용자 요청: 홀 가운데 의미 없이 서 있던 래핑 골판지 묶음 2개는 뺐다.
    }
    if(spec.routeSurvey?.supplementalPackagingWalk){
      const supplementary=group(details,'clip2-outer-packaging-context');
      const evidence=(node,times,extra={})=>Object.assign(node.userData,{sourceReferences:[{clipId:'first-floor-20261113-clip2',times}],dimensionsMeasured:false,registration:'observed relative position; approximate existing-hall coordinates',...extra});
      evidence(supplementary,[10,42,48,64,108,138,141,144,162],{endStairId:'route-turn-down-stair',hiddenProcessConnectionsAdded:false});
      // Keep the wall-side return to the one registered elevator outside the
      // blue clean room; fittings sit on its east wall (A-013 X6 line).
      const helmets=group(supplementary,'clip2-wall-helmet-rack',[13.53,0,-1.2]);evidence(helmets,[62],{minimumVisibleHelmets:6,wearerIdentityAdded:false});
      box(helmets,'clip2-helmet-rack-board',[.035,.76,2.1],[0,1.58,0],'white');
      const cap=geo('clip2-hardhat-shell',()=>new THREE.SphereGeometry(.135,14,8,0,Math.PI*2,0,Math.PI/2));
      for(const [y,z]of [[1.76,-.75],[1.76,-.25],[1.76,.25],[1.76,.75],[1.4,-.5],[1.4,.5]]){
        const shell=s._mesh(cap,m.white,helmets,[.15,y,z]);shell.name='dryer-route-clip2-white-hardhat';
        cylinder(helmets,'clip2-hardhat-brim',.155,.018,[.15,y,z],'white');
        bar(helmets,'clip2-helmet-hook',[.02,y-.04,z],[.15,y-.04,z],.012,'steel');
      }
      const services=group(supplementary,'clip2-exposed-aisle-services');evidence(services,[78,96,102,114,120,138,162]);
      for(const [index,z]of [19.05,19.28,19.51,19.74].entries()){
        const paint=['red','blue','yellow','steel'][index];
        bar(services,'clip2-long-colored-pipe',[1.2,3.22+index*.025,z],[15.8,3.22+index*.025,z],index===0?.055:.035,paint);
      }
      for(const x of [2,5.2,8.4,11.6,14.8]){
        box(services,'clip2-overhead-pipe-hanger',[.045,.3,1.05],[x,3.42,19.4],'steel');
        box(services,'clip2-black-cable-tray',[2.9,.08,.28],[x,3.42,20.08],'dark');
        repeats(services,'clip2-tray-rungs',[.035,.045,.32],Array.from({length:14},(_,i)=>[x-1.3+i*.2,3.36,20.08]),'steel');
        const light=box(services,'clip2-twin-strip-light',[1.05,.04,.18],[x,3.48,18.7],'white');light.userData.staticObservedFixture=true;
      }
      // A low machine crossover is separate from the building stair. Both
      // short flights and the open checkerplate bridge remain explicit.
      const crossover=group(supplementary,'clip2-roller-crossover',[-3.4,0,14.5]);
      evidence(crossover,[138,141,144],{interFloorConnection:false,serves:'local machine access only',topHeight:1.1,representativeStepCount:5});
      box(crossover,'clip2-crossover-top',[.86,.065,1.2],[0,1.0675,0],'steel');
      for(const direction of [-1,1]){
        for(let step=0;step<5;step++){
          const z=direction*(2-(step+.5)*.28),y=(step+1)*.22;
          box(crossover,'clip2-crossover-tread',[.86,.055,.3],[0,y-.0275,z],'white');
          repeats(crossover,'clip2-crossover-antislip-bars',[.8,.006,.022],[-.08,0,.08].map(dz=>[0,y+.003,z+dz]),'gray');
        }
        for(const x of [-.47,.47]){
          bar(crossover,'clip2-crossover-yellow-rail',[x,1.0,direction*2],[x,2.1,direction*.6],.028,'yellow');
          for(let post=0;post<=2;post++){const t=post/2,y=1.1*t,z=direction*(2-1.4*t);bar(crossover,'clip2-crossover-yellow-post',[x,y,z],[x,y+1,z],.023,'yellow');}
        }
      }
      for(const x of [-.47,.47]){
        bar(crossover,'clip2-crossover-top-guard',[x,2.1,-.6],[x,2.1,.6],.028,'yellow');
        box(crossover,'clip2-crossover-toeboard',[.04,.12,1.2],[x,1.16,0],'yellow');
      }
      // Storage stays beside the aisle, never in the clear route to the
      // confirmed 1F-to-1.5F stair and its upper return landing.
      const rack=group(supplementary,'clip2-end-aisle-parts-rack',[2.7,0,21.05]);evidence(rack,[138,162],{contentsAndLabelTextConfirmed:false});
      for(const x of [-1.2,1.2])for(const z of [-.25,.25])box(rack,'clip2-parts-rack-upright',[.045,1.8,.045],[x,.92,z],'white');
      for(const y of [.2,.72,1.24,1.76])box(rack,'clip2-parts-shelf',[2.45,.035,.55],[0,y,0],'white');
      for(let row=0;row<3;row++)for(let col=0;col<6;col++){
        const x=-1+col*.4,y=.37+row*.52;
        box(rack,'clip2-orange-open-bin-base',[.34,.025,.38],[x,y-.12,0],'orange');
        for(const side of [-1,1])box(rack,'clip2-orange-bin-side',[.025,.25,.38],[x+side*.16,y,0],'orange');
        box(rack,'clip2-orange-bin-back',[.34,.25,.025],[x,y,.18],'orange');
      }
      const vacuum=group(supplementary,'clip2-end-aisle-vacuum',[4.3,0,20.55]);evidence(vacuum,[162],{functionBasis:'visible wheeled cleaning canister and hose'});
      cylinder(vacuum,'clip2-vacuum-stainless-canister',.23,.48,[0,.41,0],'steel');cylinder(vacuum,'clip2-vacuum-black-lid',.25,.12,[0,.72,0],'dark');
      for(const x of [-.24,.24])for(const z of [-.2,.2])cylinder(vacuum,'clip2-vacuum-wheel',.065,.06,[x,.08,z],'black','x');
      for(const side of [-1,1])bar(vacuum,'clip2-vacuum-handle',[side*.2,.28,.2],[side*.2,.95,.25],.018,'dark');
      bar(vacuum,'clip2-vacuum-handle',[.2,.95,.25],[-.2,.95,.25],.02,'dark');
      const hose=s._mesh(geo('clip2-vacuum-hose',()=>new THREE.TorusGeometry(.35,.025,8,30,Math.PI*1.5)),m.dark,vacuum,[.1,.35,-.12]);hose.name='dryer-route-clip2-vacuum-hose';
      const chair=group(supplementary,'clip2-end-aisle-chair',[1,0,20.6]);evidence(chair,[138,162]);
      box(chair,'clip2-chair-seat',[.42,.075,.42],[0,.46,0],'dark');box(chair,'clip2-chair-back',[.4,.43,.055],[0,.78,.19],'dark');cylinder(chair,'clip2-chair-pedestal',.035,.43,[0,.23,0],'steel');
      for(let i=0;i<5;i++){const a=i*Math.PI*2/5;bar(chair,'clip2-chair-base',[0,.08,0],[Math.cos(a)*.28,.06,Math.sin(a)*.28],.018,'dark');}
      const arrowShape=new THREE.Shape();arrowShape.moveTo(-.075,-.3);arrowShape.lineTo(-.075,-.15);arrowShape.lineTo(-.18,-.15);arrowShape.lineTo(0,-.45);arrowShape.lineTo(.18,-.15);arrowShape.lineTo(.075,-.15);arrowShape.lineTo(.075,.15);arrowShape.lineTo(.18,.15);arrowShape.lineTo(0,.45);arrowShape.lineTo(-.18,.15);arrowShape.lineTo(-.075,.15);arrowShape.closePath();
      const arrows=geo('clip2-double-ended-aisle-arrow',()=>{const g=new THREE.ShapeGeometry(arrowShape);g.rotateX(-Math.PI/2);return g;});
      for(const x of [12,6,-.5]){const arrow=s._mesh(arrows,m.yellow,supplementary,[x,.012,19.5]);arrow.rotation.y=Math.PI/2;arrow.name='dryer-route-clip2-yellow-two-way-aisle-arrow';}
      for(const [x,z,w,d]of [[2.7,21.05,2.6,.65],[4.3,20.55,.72,.72]])for(const [size,p]of [[[w,.006,.035],[x,.008,z-d/2]],[[w,.006,.035],[x,.008,z+d/2]],[[.035,.006,d],[x-w/2,.008,z]],[[.035,.006,d],[x+w/2,.008,z]]])box(supplementary,'clip2-yellow-storage-outline',size,p,'yellow');
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
      ['south-observation-corridor',{minX:-8.45,maxX:33.3,minZ:17.05,maxZ:18.4}],
      ['west-observation-corridor',{minX:-8.45,maxX:-5.55,minZ:3,maxZ:17.05}],
      ['west-blue-hall-corridor',{minX:-8.45,maxX:-5.55,minZ:-6.7,maxZ:3}],
      ['north-observation-corridor',{minX:-8.35,maxX:-5.65,minZ:-8.1,maxZ:-6.4}],
    ];
    for(const [name,bounds]of corridorRuns){floorFinish(`${name}-floor`,bounds,'corridorGreen');suspendedCeiling(name,name==='north-observation-corridor'?{...bounds,maxX:8.6}:bounds);}
    const corridorTrim=group(details,'corridor-wall-finishes');
    skirting(corridorTrim,'south-inner-skirting',[-5.3,17.065],[28.15,17.065]);
    skirting(corridorTrim,'south-outer-skirting',[-5.3,21.49],[28.2,21.49]);
    skirting(corridorTrim,'west-outer-skirting',[-8.49,3],[-8.49,18.35]);
    skirting(corridorTrim,'west-op-skirting',[-5.42,3],[-5.42,11.7]);
    skirting(corridorTrim,'west-op-skirting',[-5.42,12.8],[-5.42,13.4]);
    const wayfinding=group(details,'observed-corridor-wayfinding');wayfinding.userData.sourceTimesSeconds=[150,222,246,294,408];
    const arrowShape=new THREE.Shape();arrowShape.moveTo(-.09,-.4);arrowShape.lineTo(.09,-.4);arrowShape.lineTo(.09,.08);arrowShape.lineTo(.25,.08);arrowShape.lineTo(0,.4);arrowShape.lineTo(-.25,.08);arrowShape.lineTo(-.09,.08);arrowShape.closePath();
    const arrowGeometry=geo('corridor-yellow-direction-arrow',()=>{const geometry=new THREE.ShapeGeometry(arrowShape);geometry.rotateX(-Math.PI/2);return geometry;});
    for(const [x,z,angle]of [[26.5,17.8,Math.PI/2],[12,17.8,Math.PI/2],[-8,15,0],[-8,9.1,0],[-8,0,0],[-7,-5.6,0]]){
      const arrow=s._mesh(arrowGeometry,m.yellow,wayfinding,[x,.027,z]);arrow.rotation.y=angle;arrow.name='dryer-route-yellow-floor-direction-arrow';
    }
    for(const x of [5.5,17.4]){
      const board=group(wayfinding,'corridor-noticeboard',[x,1.6,21.46]);box(board,'noticeboard-frame',[1.25,.85,.04],[0,0,0],'gray');box(board,'noticeboard-dark-backing',[1.16,.76,.015],[0,0,-.028],'dark');
      for(let row=0;row<2;row++)for(let col=0;col<3;col++)box(board,'anonymous-wall-notice',[.28,.27,.012],[-.37+col*.37,-.18+row*.35,-.042],'paper');
      board.userData.readablePersonalInformationAdded=false;
    }
    const upperStair=route.upperStair;
    if(upperStair){
      const b=upperStair.bounds,window=upperStair.window,height=3.5,room=group(details,'upper-stairwell-context');
      Object.assign(room.userData,{sourceTimesSeconds:upperStair.sourceTimes,compassOrientationConfirmed:false,topology:upperStair.topology,routeEndBeyondOp:true});
      wallLine('upper-stairwell-west',[b.minX,b.minZ],[b.minX,b.maxZ],{height});
      wallLine('upper-stairwell-east',[b.maxX,b.minZ],[b.maxX,b.maxZ],{height});
      wallLine('upper-stairwell-south',[b.minX,b.maxZ],[b.maxX,b.maxZ],{height,openings:[{offset:upperStair.lowerDoor[0]-b.minX,width:1.15,height:2.3},{offset:upperStair.upperDoor[0]-b.minX,width:1.2,sill:3.5,height:2.3}]});
      wallLine('upper-stairwell-north',[b.minX,b.minZ],[b.maxX,b.minZ],{height,openings:[{offset:window.position[0]-b.minX,width:window.width,sill:window.sill,height:window.height}]});
      // A-014: the corridor keeps a wall beside the stair enclosure.
      wallLine('west-corridor-east-return',[b.maxX+.05,b.maxZ],[b.maxX+.05,-7]);
      // 420–432s shows diffuse daylight through pale frosted panes, rather
      // than a clear view into the surrounding model's unmeasured low wing.
      m.stairFrostedGlass ||=s._material(0xe1e7df,.72,0,{transparent:true,opacity:.82,emissive:0xcbd9da,emissiveIntensity:.35,depthWrite:false,side:THREE.DoubleSide});
      const glazing=glazedLine('upper-stairwell-tall-landing-window',[window.position[0]-window.width/2,b.minZ],[window.position[0]+window.width/2,b.minZ],{sill:window.sill,top:window.sill+window.height,pitch:1.17,paint:'stairFrostedGlass'});
      Object.assign(glazing.userData,{sourceTimesSeconds:[420,424,428,432,443],landingFacingWindow:true});
      for(const y of [1.8,2.25,2.7])bar(room,'stair-window-safety-bar',[window.position[0]-window.width/2,y,b.minZ+.13],[window.position[0]+window.width/2,y,b.minZ+.13],.025,'steel');
      const lowerDoor=door('upper-stair-entrance',upperStair.lowerDoor,1.15,{label:'통로 끝 상·하행 계단',glazed:false,paint:'gray',openAngle:-Math.PI*.48,times:[414,418,420]});
      lowerDoor.userData.routeStairEntry=true;
      const approach={minX:-8.35,maxX:-5.65,minZ:-8.1,maxZ:-6.4};floorFinish('upper-stair-approach-floor',approach,'corridorGreen');suspendedCeiling('upper-stair-approach',approach);
      for(const [a,c]of [[[b.minX+.07,b.minZ+.07],[b.maxX-.07,b.minZ+.07]],[[b.maxX-.07,b.minZ+.07],[b.maxX-.07,b.maxZ-.07]],[[b.minX+.07,b.maxZ-.07],[b.maxX-.07,b.maxZ-.07]]]){
        const length=Math.hypot(c[0]-a[0],c[1]-a[1]),trim=group(room,'stairwell-black-skirting',[a[0],0,a[1]]);trim.rotation.y=-Math.atan2(c[1]-a[1],c[0]-a[0]);box(trim,'black-stairwell-skirting',[length,.14,.025],[length/2,.07,0],'black');
      }
    }
    wallLine('south-observation',[-5.3,17],[28.2,17],{height:2.9,openings:[{offset:16.75,width:33.5,sill:.85,height:1.8}]});
    glazedLine('south-observation',[-5.3,17],[28.2,17]);
    wallLine('west-return-observation',[-5.35,13.7],[-5.35,17],{height:2.9,openings:[{offset:1.65,width:3.3,sill:.85,height:1.8}]});
    glazedLine('west-return-observation',[-5.35,13.7],[-5.35,17]);
    const dressing=route.dressingRoom,b=dressing.bounds;
    floorFinish('entry-stair-dressing-shared-landing',dressing.arrivalLanding,'corridorGreen');
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
    const fan=group(opRoot,'office-pedestal-fan',[-2.1,0,12.5]);cylinder(fan,'fan-base',.22,.04,[0,.04,0],'white');cylinder(fan,'fan-stand',.025,1.0,[0,.55,0],'gray');const ring=s._mesh(geo('fan-guard',()=>new THREE.TorusGeometry(.24,.012,6,36)),m.gray,fan,[0,1.22,0]);ring.name='dryer-route-fan-guard';cylinder(fan,'fan-hub',.055,.06,[0,1.22,0],'gray','z');
    // The ordinary corridor and room surfaces remain separate from the lower
    // production machinery visible through them. No extra intermediate slab.
    for(const opening of spec.openings||[]){if(opening.doorKind!=='none'||!(opening.sill>0))continue;const horizontal=['north','south'].includes(opening.side),at=horizontal?spec.bounds.minX+opening.offset:spec.bounds.minZ+opening.offset;const a=horizontal?[at-opening.width/2,opening.side==='south'?spec.bounds.maxZ:spec.bounds.minZ]:[opening.side==='east'?spec.bounds.maxX:spec.bounds.minX,at-opening.width/2],b=horizontal?[at+opening.width/2,a[1]]:[a[0],at+opening.width/2];const window=glazedLine('corridor-exterior-window',a,b,{sill:opening.sill,top:opening.sill+opening.height,pitch:opening.width+.1});Object.assign(window.userData,{representativeSpacing:true,registrationBasis:'observed window type; spacing proportionally registered'});}
    return details;
  }

  if(level===3 && spec.routeSurvey?.glazedEnclosure){
    const floorBounds=spec.mainBounds, floorWidth=floorBounds.maxX-floorBounds.minX, floorDepth=floorBounds.maxZ-floorBounds.minZ;
    if(!m.wornGreen.map)m.wornGreen.color.setHex(0x15432c);
    m.wornGreen.roughness=.57;
    m.thirdAmberGlass ||=s._material(0xe9ab0f,.36,.025,{transparent:true,opacity:.89,depthWrite:false,side:THREE.DoubleSide});
    if(!m.storageSafetyFilm){
      m.storageSafetyFilm=new THREE.MeshBasicMaterial({color:0xdebb08,transparent:true,opacity:.986,depthWrite:false,side:THREE.DoubleSide,toneMapped:false});
      s.materials?.add(m.storageSafetyFilm);
    }
    // Use one continuous floor map across the slab cuts. The concrete shows
    // through near the drives, hopper throats, lift and working side of the CIP deck.
    if(!m.wornGreen.map && typeof document!=='undefined'){
      const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=1536;const ctx=canvas.getContext?.('2d');
      if(ctx){
        let seed=931;const random=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
        const px=x=>(x-floorBounds.minX)*canvas.width/floorWidth,py=z=>(z-floorBounds.minZ)*canvas.height/floorDepth;
        function wornPatch(x,y,rx,ry,colour){
          ctx.fillStyle=colour;ctx.beginPath();
          for(let k=0;k<10;k++){
            const a=k*Math.PI/5,r=.38+.62*random(),u=x+r*rx*Math.cos(a),v=y+r*ry*Math.sin(a);
            if(k)ctx.lineTo(u,v);else ctx.moveTo(u,v);
          }
          ctx.closePath();ctx.fill();
        }
        ctx.fillStyle='#16492e';ctx.fillRect(0,0,canvas.width,canvas.height);
        for(let i=0;i<1700;i++)wornPatch(random()*canvas.width,random()*canvas.height,9+random()*45,6+random()*36,i%3?'rgba(22,56,38,.16)':'rgba(85,109,81,.16)');
        const pixels=ctx.getImageData?.(0,0,canvas.width,canvas.height);
        if(pixels?.data && ctx.putImageData){
          const rgb=pixels.data;
          const lattice=Float32Array.from({length:128*128},random);
          function noise(u,v){
            const x=Math.floor(u),y=Math.floor(v),ix=x&127,iy=y&127;
            let a=u-x,b=v-y;a*=a*(3-2*a);b*=b*(3-2*b);
            const top=lattice[iy*128+ix]*(1-a)+lattice[iy*128+((ix+1)&127)]*a;
            const bottom=lattice[((iy+1)&127)*128+ix]*(1-a)+lattice[((iy+1)&127)*128+((ix+1)&127)]*a;
            return top*(1-b)+bottom*b;
          }
          const saturate=v=>Math.min(1,Math.max(0,v));
          // Blend chipped islands into a wider grey scuff. No repeated decal
          // shapes; their edges break up at three distinct physical scales.
          for(const [x,z,rx,rz,strength]of [[1.6,-3,3.1,1.53,.89],[7,-3,1.2,1.04,.95],[6.5,-9.5,1.30,.72,.47],[-.4,-4.6,1.46,1.04,.59],
            [-4.1,3.2,2.6,2.2,.43],[2.7,5.9,2.8,1.75,.34],[-2.8,8.2,2.45,1.5,.40]]){
            const cx=px(x),cy=py(z),rw=rx*canvas.width/floorWidth,rh=rz*canvas.height/floorDepth;
            const left=Math.max(0,Math.floor(cx-rw*1.35)),right=Math.min(canvas.width,Math.ceil(cx+rw*1.35));
            const top=Math.max(0,Math.floor(cy-rh*1.35)),bottom=Math.min(canvas.height,Math.ceil(cy+rh*1.35));
            for(let v=top;v<bottom;v++)for(let u=left;u<right;u++){
              const dx=(u-cx)/rw,dy=(v-cy)/rh,coarse=noise(u/49,v/30),grain=noise(u/9,v/7);
              const mask=saturate((1-dx*dx-dy*dy)*1.13+(coarse-.53)*.98);
              if(!mask)continue;
              const chips=saturate((coarse*.39+grain*.38+noise(u/3,v/2)*.23-.47)*4.4);
              const alpha=mask*strength*(.18+chips*.81),concrete=96+grain*34+random()*13;
              let i=(v*canvas.width+u)*4;
              for(const tint of [0,1,-9]){rgb[i]=rgb[i]*(1-alpha)+(concrete+tint)*alpha;i++;}
            }
          }
          ctx.putImageData(pixels,0,0);
        }
        for(let i=0;i<470;i++){
          const x=random()*canvas.width,y=random()*canvas.height;
          ctx.strokeStyle='rgba(147,149,127,.18)';ctx.lineWidth=.5+random();ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(random()-.5)*13,y+random()*10);ctx.stroke();
        }
        const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;s.textures?.add(texture);m.wornGreen.map=texture;m.wornGreen.color.set(0xffffff);m.wornGreen.needsUpdate=true;
      }
    }
    const wornFloor=group(environment.deck,'third-worn-green-epoxy-floor');
    const floorHoles=(spec.slabOpenings||[]).flatMap(opening=>opening.holes||[]);
    const xs=[floorBounds.minX,floorBounds.maxX,...floorHoles.flatMap(hole=>[hole.minX,hole.maxX])].sort((a,b)=>a-b);
    const zs=[floorBounds.minZ,floorBounds.maxZ,...floorHoles.flatMap(hole=>[hole.minZ,hole.maxZ])].sort((a,b)=>a-b);
    for(let xi=1;xi<xs.length;xi++)for(let zi=1;zi<zs.length;zi++){
      const minX=xs[xi-1],maxX=xs[xi],minZ=zs[zi-1],maxZ=zs[zi],x=(minX+maxX)/2,z=(minZ+maxZ)/2;
      // A slab opening can reach past the tower; the hall finish stops at its walls.
      if(x<floorBounds.minX||x>floorBounds.maxX||z<floorBounds.minZ||z>floorBounds.maxZ)continue;
      if(maxX-minX<.001||maxZ-minZ<.001||floorHoles.some(hole=>x>hole.minX&&x<hole.maxX&&z>hole.minZ&&z<hole.maxZ))continue;
      const section=geo(`hall-epoxy-uv:${minX}:${maxX}:${minZ}:${maxZ}`,()=>{
        const geometry=new THREE.BoxGeometry(maxX-minX,.012,maxZ-minZ),{position,uv}=geometry.attributes;
        for(let i=0;i<position.count;i++)uv.setXY(i,(x+position.getX(i)-floorBounds.minX)/floorWidth,(floorBounds.maxZ-z-position.getZ(i))/floorDepth);
        return geometry;
      });
      const finish=s._mesh(section,m.wornGreen,wornFloor,[x,-.005,z]);finish.name='dryer-route-third-worn-green-epoxy-panel';finish.userData.floorFinish=true;
    }
    Object.assign(wornFloor.userData,{sourceTimesSeconds:[450,486,538,588,617,678],wearPatternRepresentative:true,slabOpeningsPreserved:true});
    const stairEntry=spec.routeSurvey.entryFromStair;
    if(stairEntry){
      const p=stairEntry.door,arrival=group(details,'third-stair-arrival-context');Object.assign(arrival.userData,{sourceTimesSeconds:stairEntry.sourceTimes,straightAheadOfUpperFlight:true});
      box(arrival,'brown-stair-door-mat',[.85,.018,1.05],[p[0],.009,p[1]+.43],'wood');
      sign(arrival,'3F',[p[0]+1,1.65,p[1]+.09],.45);
    }
    const b=spec.routeSurvey.glazedEnclosure,w=b.maxX-b.minX,d=b.maxZ-b.minZ;
    const {storageDoor:storageEntry,followupClip}=spec.routeSurvey;
    const [doorX,doorZ]=storageEntry.position,leafWidth=storageEntry.leafWidth;
    const root=group(details,'yellow-glazed-storage-room');Object.assign(root.userData,{sourceTimesSeconds:[450,462,474,480],sourcePhotoNumbers:[3],roomFunction:'storage-context',functionInferred:true,interiorObserved:true});
    root.userData.sourceReferences=[{clipId:followupClip,seconds:[165,169,173,177,180,184,189,194,198]}];
    floorFinish('yellow-room-green-floor',b);
    // The P.S wall closes the north end; only the stub beside the lift board shows.
    wallLine('yellow-room-east',[b.maxX,b.maxZ],[b.maxX,-10.5]);
    const sideWindow=[b.minX+w*.52-.8,b.minX+w*.52+.8];
    wallLine('yellow-room-south',[b.minX,b.maxZ],[b.maxX,b.maxZ],{openings:[{offset:w*.52,width:1.6,sill:.95,height:1.25}]});glazedLine('yellow-room-side',[sideWindow[0],b.maxZ],[sideWindow[1],b.maxZ],{sill:.95,top:2.2,pitch:2.5,paint:'thirdAmberGlass'});
    // The shutter and the yellow doors meet around a corner. The active leaf
    // is on the right from the hall. The red pallets partly cover the other leaf.
    wallLine('yellow-room-west',[b.minX,b.minZ],[b.minX,b.maxZ],{openings:[{offset:doorZ-leafWidth/2-b.minZ,width:2*leafWidth,height:2.32}]});
    const doorFinish={label:'3층 보관 구획',glassPaint:'storageSafetyFilm',pairedStorage:true,plaque:false,windowWidth:.54,times:storageEntry.sourceTimes};
    const entry=door('yellow-storage',storageEntry.position,leafWidth,{...doorFinish,rotation:Math.PI/2,openAngle:-Math.PI*.48});
    const inactive=door('yellow-storage-inactive',[doorX,doorZ-leafWidth],leafWidth,{...doorFinish,rotation:-Math.PI/2,enterable:false});
    for(const node of [entry,inactive])node.userData.source=followupClip;
    // 02:50 looks up at the sign on the active leaf and the twin wall socket.
    const activeLeaf=entry.getObjectByName('dryer-route-3-yellow-storage-door-leaf');
    const accessSign=sign(activeLeaf,'관계자외 출입금지',[leafWidth*.71,2.04,-.039],.37,{restriction:true});
    accessSign.rotation.y=Math.PI;accessSign.scale.y=.65;
    box(root,'storage-wall-double-socket',[.042,.078,.135],[doorX-.063,2.68,doorZ-.24],'wall');
    for(const dz of [-.032,.032])cylinder(root,'storage-wall-socket-recess',.018,.004,[doorX-.086,2.68,doorZ-.24+dz],'dark','x');
    const exterior=spec.openings.find(o=>o.id==='third-storage-exterior-window');
    const windowX=spec.mainBounds.minX+exterior.offset,span=exterior.width,windowZ=b.minZ+.085;
    const outside=glazedLine('storage-exterior-wired',[windowX-span/2,windowZ],[windowX+span/2,windowZ],{sill:exterior.sill,top:exterior.sill+exterior.height,pitch:span+.1});
    box(outside,'wired-window-midrail',[span,.045,.055],[span/2,exterior.sill+exterior.height*.5,.012],'trim');
    box(outside,'recessed-metal-window-sill',[span+.05,.035,.22],[span/2,exterior.sill,.07],'steel');
    // One texture serves both panes of the translucent wired exterior window.
    if(typeof document!=='undefined'){
      const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext?.('2d');
      if(ctx){
        ctx.fillStyle='#adbab5';ctx.fillRect(0,0,64,64);ctx.strokeStyle='#455754';ctx.lineWidth=1.35;
        ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(64,64);ctx.moveTo(64,0);ctx.lineTo(0,64);ctx.stroke();
        const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(32,26);s.textures?.add(texture);
        const material=m.glass.clone();material.map=texture;material.opacity=.46;s.materials?.add(material);
        const pane=outside.getObjectByName('dryer-route-observation-window-glass');pane.material=material;
      }
    }
    const shelf=group(root,'observed-storage-shelving',[(b.minX+b.maxX)/2,0,b.maxZ-.40]);
    for(const x of [-1.45,0,1.45])for(const z of [-.29,.29])box(shelf,'storage-shelf-upright',[.035,1.43,.035],[x,.725,z],'white');
    for(const y of [.13,.54,.94,1.42])box(shelf,'storage-shelf-deck',[2.95,.04,.64],[0,y,0],'white');
    for(const [i,x]of [-1.11,-.38,.40,1.11].entries()){
      box(shelf,'storage-upper-parts-bin',[.57,.27,.5],[x,1.575,0],i===2?'blue':'orange');
      box(shelf,'anonymous-tool-case',[.55,.17,.39],[x,.645,.02],i%2?'teal':'black');
      box(shelf,'handled-fluid-can',[.31,.34,.33],[x,.32,.04],i%2?'blue':'teal');
      box(shelf,'case-lifting-handle',[.14,.037,.044],[x,.745,-.07],'dark');
    }
    const bench=group(root,'small-storage-workbench',[b.minX+.98,0,b.minZ+.45]);
    box(bench,'green-tool-bench',[.91,.81,.59],[0,.41,0],'green');
    for(const y of [.28,.45,.63])box(bench,'tool-drawer-pull',[.73,.023,.028],[0,y,.312],'trim');
    box(bench,'green-pegboard',[.92,.62,.044],[0,1.14,-.26],'green');
    for(let i=0;i<8;i++)bar(bench,'hanging-tool',[-.36+i*.10,1.30,-.225],[-.36+i*.10,1.10-(i%3)*.041,-.225],.011,'steel');
    const film=group(root,'roll-storage',[b.maxX-.48,0,b.minZ+.89]);
    for(const [x,z,r,h]of [[0,0,.16,1.63],[-.35,.06,.105,1.1],[-.25,-.22,.09,.88]]){
      cylinder(film,'standing-light-film-roll',r,h,[x,h/2,z],'paper');
      cylinder(film,'roll-core',r*.26,.009,[x,h+.003,z],'dark');
    }
    const soffit=group(environment.facade,'storage-low-ceiling');
    box(soffit,'storage-ceiling-panel',[w,.06,d],[(b.minX+b.maxX)/2,2.94,(b.minZ+b.maxZ)/2],'wall');
    box(soffit,'storage-fluorescent-housing',[1.06,.045,.18],[windowX,2.87,doorZ],'white');
    // Only the registered, already-cut window bands receive glazing. The
    // observed facade type is current; bay spacing and wall registration are not measured.
    const perimeter=spec.mainBounds,windowBands=(spec.openings||[]).filter(opening=>opening.label==='3층 2단 황색창');
    const protectedRuns=new Map();
    for(const [index,opening]of windowBands.entries()){
      if(!['west','east'].includes(opening.side))continue;
      const side=opening.side==='west'?-1:1,x=(side<0?perimeter.minX:perimeter.maxX)-side*.045;
      const center=perimeter.minZ+opening.offset,from=center-opening.width/2,to=center+opening.width/2;
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

    const hoses=group(details,'disc-aisle-wall-hoses',[spec.mainBounds.maxX-.18,0,-5.9]);
    hoses.userData.sourceReferences=[{clipId:followupClip,seconds:[24,26,28,55]}];
    for(const z of [-.20,-.05]){
      cylinder(hoses,'galvanized-wall-riser',.034,2.57,[-.02,1.30,z],'steel');
      for(const y of [.33,1.79])box(hoses,'wall-pipe-clamp',[.10,.036,.085],[.01,y,z],'trim');
    }
    for(const y of [.98,1.41]){
      cylinder(hoses,'service-manifold-branch',.03,.69,[-.02,y,.25],'steel','z');
      cylinder(hoses,'manifold-coupling',.043,.06,[-.02,y,.42],'trim','z');
      box(hoses,'manifold-valve-handle',[.08,.035,.13],[-.057,y+.08,.48],'red');
    }
    m.airHose ||=s._material(0x327f9a,.69,.04);
    m.retractableHose ||=s._material(0xc86830,.69,.04);
    function hoseCurve(name, points, paint, radius, closed=false) {
      const path=geo(name,()=>new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)),closed),48,radius,6,closed));
      const mesh=s._mesh(path,paint,hoses);mesh.name='dryer-route-'+name;return mesh;
    }
    for(let i=0;i<6;i++){
      const coil=hoseCurve('looped-blue-service-hose',[[-.13,1.82,-.26],[-.22,1.72,-.43],[-.24,.94,-.46],[-.20,.86,-.34],[-.10,.93,-.23],[-.07,1.60,-.21]],m.airHose,.011,true);
      coil.position.z=i*.027;
    }
    cylinder(hoses,'yellow-hose-reel',.175,.106,[-.12,1.87,.47],'yellow','x');
    cylinder(hoses,'reel-spindle-cap',.044,.018,[-.19,1.87,.47],'paper','x');
    hoseCurve('orange-reel-hose',[[-.13,1.72,.50],[-.17,1.23,.51],[-.20,.52,.51],[-.23,.36,.29],[-.21,.44,.05],[-.11,.98,.11]],m.retractableHose,.012);

    const ibcs=group(details,'three-observed-ibc-containers');Object.assign(ibcs.userData,{sourceTimesSeconds:[617],sourceReferences:[{clipId:followupClip,seconds:[269,270]}],observedMinimumContainerCount:3,contentsConfirmed:false,movableContext:true,catalogEquipmentAdded:false});
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
      if(segment.clip)channel.userData.sourceReferences=[{clipId:segment.clip,seconds:segment.times}];
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
    m.thirdRoofDeck ||=s._material(0x747f81,.74,.36);
    const panels=repeats(ceiling,'third-gray-overhead-panel-strips',[1.025,.034,26.2],Array.from({length:16},(_,i)=>[-7.6875+i*1.025,5.982,0]),'gray');panels.material=m.thirdRoofDeck;
    const ribs=repeats(ceiling,'third-overhead-panel-seams',[.042,.029,26.2],Array.from({length:92},(_,i)=>[-8.10+i*.178,5.953,0]),'trim');ribs.material=m.thirdRoofDeck;
    // The round hall luminaires sit below the exposed roof and cream girders;
    // the lit disk is inset into the open bottom of the metal shade.
    m.thirdCeilingLight ||=s._material(0xf1f1e7,.62,0,{emissive:0xf4f5ee,emissiveIntensity:1.12});
    const shade=geo('third-hall-pendant-shade',()=>new THREE.CylinderGeometry(.105,.235,.16,24,1,true));
    for(const x of [-4,4])for(const z of [-8,-1,6,11.5]){
      cylinder(ceiling,'third-pendant-stem',.018,.24,[x,5.75,z],'trim');
      const hood=s._mesh(shade,m.steel,ceiling,[x,5.56,z]);hood.name='dryer-route-third-pendant-reflector';
      const light=cylinder(ceiling,'third-round-ceiling-light',.22,.014,[x,5.482,z],'white');light.material=m.thirdCeilingLight;
    }
    ceiling.userData.sourceReferences=[{clipId:followupClip,seconds:[4,16,64,144,166,265,272]}];
    const duct=s._mesh(geo('third-open-spiral-duct',()=>new THREE.CylinderGeometry(1,1,1,32,1,true)),m.steel,overhead,[0,5.15,4.2]);duct.scale.set(.28,15.5,.28);duct.rotation.z=Math.PI/2;duct.name='dryer-route-third-galvanized-open-spiral-duct';
    const turns=15.5/.28,pointCount=Math.ceil(turns*8)+1,points=Array.from({length:pointCount},(_,i)=>{const ratio=i/(pointCount-1),angle=ratio*turns*Math.PI*2;return new THREE.Vector3(-7.75+ratio*15.5,5.15+Math.cos(angle)*.285,4.2+Math.sin(angle)*.285);});
    const seam=s._mesh(geo('third-spiral-duct-seam',()=>new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),Math.ceil(turns*16),.006,4,false)),m.trim,overhead);seam.name='dryer-route-third-helical-duct-seam';
    const ductHangers=[-6,-2,2,6];
    repeats(overhead,'third-duct-hanger-crossbars',[.065,.055,.84],ductHangers.map(x=>[x,4.8425,4.2]),'steel');
    repeats(overhead,'third-duct-hanger-rods',[.018,.99,.018],ductHangers.flatMap(x=>[-.36,.36].map(z=>[x,5.335,4.2+z])),'steel');
    for(const [index,x]of [-7.7,-7.45,-7.8,-7.2].entries())cylinder(overhead,'third-visible-blue-silver-run',index<2?.045:.055,19.6,[x,index<2?5.05:5.22,2.2],index<2?'blue':'steel','z');
    const trayZs=[-7,-3,3,9];repeats(overhead,'third-pipe-tray-crossbars',[1.4,.065,.085],trayZs.map(z=>[-7.45,4.975,z]),'steel');
    repeats(overhead,'third-pipe-tray-hanger-rods',[.018,.825,.018],trayZs.flatMap(z=>[-8.0,-6.9].map(x=>[x,5.3875,z])),'steel');
    repeats(overhead,'third-raised-silver-pipe-supports',[.08,.16,.06],trayZs.flatMap(z=>[-7.8,-7.2].map(x=>[x,5.085,z])),'steel');
    cylinder(overhead,'third-visible-red-upper-riser',.065,2.2,[-8.1,4.6,10.8],'red');
    for(const y of [3.65,5.2])bar(overhead,'third-red-riser-wall-bracket',[-8.53,y,10.8],[-8.1,y,10.8],.018,'white');
    const service=group(environment.ducts,'lift-corner-red-pipe');
    service.userData.sourceReferences=[{clipId:followupClip,seconds:[4,11,16]}];
    // Only the overhead portion visible in the lift corner is registered.
    for(const [a,b]of [[[4.68,5.34,-8.78],[4.68,5.34,-6.15]],[[4.68,5.34,-6.15],[7.90,5.34,-6.15]],[[7.90,5.34,-6.15],[7.90,5.34,-5.78]]])bar(service,'red-corner-run',a,b,.073,'red');
    for(const x of [5.02,6.62,7.67]){
      cylinder(service,'red-pipe-strap',.083,.042,[x,5.34,-6.15],'trim','x');
      bar(service,'red-pipe-threaded-hanger',[x,5.41,-6.15],[x,5.88,-6.15],.009,'steel');
    }

    const shutter=spec.routeSurvey.shutter;
    if(shutter){
      const inward = shutter.side==='north' ? 1 : -1;
      const fixed=group(details,'closed-observed-gray-roller',[shutter.position[0],0,shutter.position[1]+inward*.14]);
      fixed.rotation.y = inward>0 ? Math.PI : 0;
      Object.assign(fixed.userData,{sourceTimesSeconds:shutter.sourceTimes||[567],sourcePhotoNumbers:shutter.photoNumbers,destinationUnconfirmed:true,enterable:false,unseenInteriorAdded:false,openingAnimationAdded:false});
      box(fixed,'gray-roller-closed-curtain',[shutter.width-.1,shutter.height-.045,.035],[0,shutter.height/2,.005],'gray');
      repeats(fixed,'gray-roller-static-slats',[shutter.width-.11,.018,.025],Array.from({length:Math.floor(shutter.height/.09)},(_,i)=>[0,.055+i*.09,-.025]),'trim');
      for(const side of [-1,1])box(fixed,'gray-roller-fixed-guide',[.085,shutter.height+.14,.1],[side*(shutter.width/2+.0125),shutter.height/2,0],'steel');
      box(fixed,'gray-roller-fixed-housing',[shutter.width+.2,.21,.24],[0,shutter.height+.115,-.12],'steel');
      const load=group(details,'observed-movable-bulkbag-pallet',[shutter.position[0],0,shutter.position[1]+inward*1.02]);
      Object.assign(load.userData,{sourceReferences:[{clipId:followupClip,seconds:[160,163,167,168]}],movableContext:true,contentsConfirmed:false});
      for(const x of [-.68,.68]){
        repeats(load,'plastic-pallet-runners',[.16,.15,.91],[-.44,0,.44].map(dx=>[x+dx,.09,0]),'green');
        box(load,'black-pallet-top',[1.20,.088,1.01],[x,.204,0],'dark');
      }
      const bag=s._mesh(geo('third-shutter-waste-sack',()=>new THREE.CylinderGeometry(.48,.49,.55,8,1,true)),m.wood,load,[-.68,.525,0]);bag.rotation.y=Math.PI/8;bag.name='dryer-route-open-waste-sack';
      for(let i=0;i<3;i++)box(load,'stacked-wrapped-sacks',[.95-i*.04,.081,.64],[.62+i*.021,.285+i*.083,.04],i===0?'woodFloor':'white').rotation.y=i*.044;
      for(const [x,label]of [[-.78,'폐기'],[.61,'사료']]){
        cylinder(load,'sorting-sign-floor-base',.12,.024,[x,.015,.71],'dark');
        cylinder(load,'sorting-sign-post',.016,.72,[x,.375,.71],'dark');
        sign(load,label,[x,.80,.70],.47);
      }
      for(const z of [-.58,.98])box(load,'pallet-parking-tape',[2.89,.005,.038],[0,.006,z],'yellow');
      for(const x of [-1.44,1.44])box(load,'pallet-parking-tape',[.038,.005,1.59],[x,.006,.2],'yellow');
      const spare=group(details,'upright-spare-pallets',[doorX-.20,0,doorZ-leafWidth-.06]);
      // The stacked red plastic pallets lean across the stationary leaf only.
      for(let i=0;i<3;i++){
        const layer=group(spare,'red-pallet-layer',[-i*.067,0,0]);
        repeats(layer,'red-pallet-slats',[.038,.060,.81],[.08,.27,.46,.65,.84].map(y=>[0,y,0]),'red');
        repeats(layer,'red-pallet-web',[.036,.87,.058],[-.37,-.19,0,.19,.37].map(z=>[0,.45,z]),'red');
      }
      box(spare,'folded-light-sheets',[.34,.047,.83],[-.08,.91,0],'paper');
    }
    const hallMap=group(environment.architectureFixtures,'hall-area-reference');
    Object.assign(hallMap.userData,{floorMapCaption:true,personCollision:false,approximateGuide:true});
    const registration = spec.routeSurvey.hallRegistration;
    const connection = registration.connectingDoor;
    const [cx,cz]=connection.position;
    const gateFrame=group(details,'process-link-overhead-track', [cx,0,cz]);
    gateFrame.rotation.y=Math.atan2(...connection.normal);
    const sourceReference={clip:connection.followupClip,seconds:connection.followupTimes};
    gateFrame.userData.sourceReference=sourceReference;
    // 04:50, from the process side: the small hinged door is near the
    // right-hand edge of the travelling panel. The window is in the fixed wall.
    const wicketHalf=connection.width/2, panelMin=-wicketHalf-.35, panelMax=panelMin+connection.panelSpan;
    const panelHeight=2.95, panelTravel=1.42;
    const windowWidth=.56, windowSill=1.24, windowHeight=.5;
    const planX=x=>cx+8.6-x, sightings=registration.windows.map(planX), sightX=sightings[0], fixedEnd=planX(17.12);
    const alongPanel=x=>[cx+connection.normal[1]*x,cz-connection.normal[0]*x];
    const panelWallHeight=5.9, stripEnd=planX(registration.partition.jog);
    const fixedWall=wallLine('process-area-panel',alongPanel(panelMin),alongPanel(fixedEnd),{
      height:panelWallHeight,paint:'white',openings:sightings.map(x=>({offset:panelMin-x,width:windowWidth,sill:windowSill,height:windowHeight})),
    });
    fixedWall.lower.userData.sourceReference=fixedWall.upper.userData.sourceReference=sourceReference;
    // The partition is closed from floor to roof deck across the whole hall and
    // steps north beside the sliding panel (03:24, 04:50).
    const west=registration.partition.west-13.4,jogX=registration.partition.jog-8.6;
    wallLine('process-area-strip',alongPanel(panelMax),alongPanel(stripEnd),{height:panelWallHeight,paint:'white'});
    wallLine('process-area-return',[jogX,cz+.05],[jogX,west],{height:panelWallHeight,paint:'white'});
    wallLine('process-area-west-panel',[jogX+.05,west],[-8.54,west],{height:panelWallHeight,paint:'white'});
    const joints=[];
    for(let x=planX(17.1)+1;x<stripEnd;x+=1)if(x<panelMin-.1)joints.push([...alongPanel(x)]);
    for(const side of [-1,1])repeats(environment.facade,'process-panel-joints',[.01,panelWallHeight-.9,.004],joints.map(([x,z])=>[x,(panelWallHeight+.9)/2,z+side*.052]),'trim');
    repeats(environment.structure,'process-panel-base-rail',[.06,.06,.13],[],'trim');
    for(const [a,c]of [[alongPanel(panelMin),alongPanel(fixedEnd)],[[jogX,west],[-8.54,west]]]){const length=Math.abs(c[0]-a[0]);box(environment.structure,'process-panel-base-rail',[length,.07,.13],[(a[0]+c[0])/2,.035,a[1]],'trim').userData.personCollision=false;}
    for(const x of sightings.slice(1)){const extra=glazedLine(`process-link-inspection-window-${Math.round(x*10)}`,alongPanel(x-windowWidth/2),alongPanel(x+windowWidth/2),{sill:windowSill,top:windowSill+windowHeight,pitch:windowWidth+.1});extra.userData.sourceReference=sourceReference;}
    const window=glazedLine('process-link-inspection-window',alongPanel(sightX-windowWidth/2),alongPanel(sightX+windowWidth/2),
      {sill:windowSill,top:windowSill+windowHeight,pitch:windowWidth+.1});
    window.userData.sourceReference=sourceReference;
    box(gateFrame,'process-room-posted-notice',[.17,.28,.014],[sightX-.48,1.58,-.06],'paper');
    // The leaf hangs on the process side, so it can run past the return wall.
    gateFrame.position.z=cz+.12;
    box(gateFrame,'process-link-overhead-track',[connection.panelSpan+.12,.12,.16],
      [(panelMin+panelMax)/2,panelHeight+.11,0],'trim');
    const aboveGate=group(environment.facade,'process-link-fixed-header',[cx,0,cz]);
    aboveGate.rotation.y=gateFrame.rotation.y;
    const headBase=panelHeight+.05;
    box(aboveGate,'process-opening-head-panel',[connection.panelSpan,panelWallHeight-headBase,.1],
      [(panelMin+panelMax)/2,(headBase+panelWallHeight)/2,0],'white');
    const carrier=group(gateFrame,'travelling-process-panel');
    Object.assign(carrier.userData,{sourceReference,travelMeasured:false,proximityDoor:{
      kind:'slide',enterable:true,axis:'x',closed:0,open:panelTravel,trigger:[1.32,0,0],width:panelTravel,height:panelHeight,
      groupId:'dryer-route:3:process-sliding-panel',label:'공정 홀 · 큰 미닫이문',openDistance:.95,closeDistance:3.3,
    }});
    const panelBottom=.045;
    for(const [left,right] of [[panelMin,-wicketHalf-.025],[wicketHalf+.025,panelMax]]){
      const x=(left+right)/2,span=right-left;
      box(carrier,'process-sliding-insulated-panel',[span,panelHeight-panelBottom,.095],[x,(panelHeight+panelBottom)/2,0],'white');
      cylinder(carrier,'process-side-horizontal-bar',.029,span-.075,[x,1.03,-.105],'trim','x');
      for(const bracketX of [left+.08,right-.08])box(carrier,'process-bar-standoff',[.03,.04,.074],[bracketX,1.03,-.075],'trim');
    }
    const head=connection.height+.085;
    box(carrier,'process-sliding-panel-header',[connection.width+.05,panelHeight-head,.095],[0,(panelHeight+head)/2,0],'white');
    for(const x of [panelMin+.15,panelMax-.15])box(carrier,'overhead-track-carriage',[.13,.105,.075],[x,panelHeight+.025,0],'trim');
    box(carrier,'process-link-recessed-pull',[.067,.20,.014],[panelMin+.14,1.06,.055],'dark');
    const gateway=door(connection.id,connection.position,connection.width,{
      rotation:Math.atan2(...connection.normal),label:'기존 설비 작업 구역 연결문',plaque:false,
      height:connection.height,glazed:false,paint:'white',openAngle:Math.PI*.5,times:connection.sourceTimes,
    });
    // Both jambs and the complete hinged leaf travel with the larger panel.
    carrier.add(gateway); gateway.position.set(0,.02,0); gateway.rotation.y=0;
    gateway.userData.sourceReference=sourceReference;
    const leaf=gateway.children.find(n=>n.userData.doorLeaf);
    for(const face of [-1,1]){
      const front=face*.027;
      for(const x of [.028,connection.width-.028])box(leaf,'process-link-aluminium-stile',[.021,connection.height-.07,.012],[x,connection.height/2,front],'trim');
      for(const y of [.052,connection.height-.052])box(leaf,'process-link-aluminium-rail',[connection.width-.05,.022,.012],[connection.width/2,y,front],'trim');
    }
    // The white dashes were a survey note before the wall was modelled.
    for(let i=1;i<0;i++){
      const [ax,az]=registration.boundaryGuide[i-1],[bx,bz]=registration.boundaryGuide[i];
      const length=Math.hypot(bx-ax,bz-az),count=Math.ceil(length/.65);
      for(let j=0;j<count;j++){
        const along=(j+.5)/count,x=ax+(bx-ax)*along,z=az+(bz-az)*along;
        const across=(x-cx)*connection.normal[1]-(z-cz)*connection.normal[0];
        if(Math.abs((x-cx)*connection.normal[0]+(z-cz)*connection.normal[1])<.1 && across>fixedEnd-.1 && across<panelMax+.1)continue;
        const stroke=box(hallMap,'survey-area-divider-dash',[.032,.008,length/count*.53],[x,.029,z],'paper');
        stroke.rotation.y=Math.atan2(bx-ax,bz-az);
      }
    }
    for(const area of registration.areas){
      s._groundText?.(area.name,[area.labelAt[0],.04,area.labelAt[1]],4.5,.52,hallMap,{fitText:true,color:'#27483e'});
    }
    return details;
  }
  return details;
}
