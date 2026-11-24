import * as THREE from '../shared/vendor/three.module.js';
import { COMPRESSOR_RECORDS } from './dryer-compressor-records.js';
import { COMPRESSOR_MANUALS } from './dryer-compressor-manuals.js';
import { COMPRESSOR_MEDIA, COMPRESSOR_PLAN_IMAGE, COMPRESSOR_WALK_FRAMES } from './dryer-compressor-media.js';

// Short labels stay legible at the equipment footprints on the floor plan.
const symbols = {
  'comp-unit-1-kaeser-csd125sfc':'1호', 'comp-unit-2-kaeser-bsd72':'2호', 'comp-unit-3-kaeser-csd125':'3호', 'comp-unit-4-k2power-k50':'4호',
  'comp-receiver-1':'R1', 'comp-receiver-2':'R2', 'comp-dryer-spx-blue':'D1', 'comp-dryer-ps600k':'D2',
  'comp-dryer-hx601k':'D3', 'comp-dryer-jemaco-dark':'D4', 'comp-aftercooler-jac100':'AC', 'comp-water-tank-pump':'WT',
  'comp-oil-water-separator':'OS', 'comp-chiller-bumyang':'CH',
};
const conveyor = {id:'f3-holding', title:'엘리베이터 앞 디스크 컨베이어', group:'3층 설비 홀', photoNumbers:[1,2,3,4],
  fields:[{label:'위치',value:'건조실 3층 엘리베이터 출입면 맞은편',source:'현장 확인',photo:3},
  {label:'구동측',value:'나란한 수직 구동부와 두 개의 적색 표시등',source:'구동측 사진',photo:2},
  {label:'이송로',value:'두 쌍의 평행 이송로 4열',source:'엘리베이터 방향에서 본 측면',photo:3},
  {label:'참고 카드',value:'15번(B)·16번(A). 카드의 장소 표기는 청정실(2층)이며, 현재 3층 위치는 영상과 현장 확인에 따릅니다. 각 열의 A/B 표지는 미확인입니다.',source:'설비이력카드 15·16'},
  {label:'호퍼측',value:'원추 호퍼 하부와 점검대 옆 계단',source:'호퍼측 사진',photo:4}], notes:[]};
const approach = {id:'roof-approach',title:'옥상 접근로와 집진기',group:'압축기실 출입구',photoNumbers:[5,6,7,8,9],
  fields:[{label:'출입 동선',value:'설비 홀 방화문 → 계단참 → 옥상문 → 압축기실 오른쪽 문짝',source:'11월 24일 왕복 영상'},
  {label:'옥상 송풍기',value:'GIHO FANTECH · 300 m³/min · 30 kW',source:'송풍기 명판',photo:9}],notes:[]};
const svgNS = 'http://www.w3.org/2000/svg';
function svgNode(tag, attr, label) {
  const el=document.createElementNS(svgNS,tag);
  for (const [key,value] of Object.entries(attr)) el.setAttribute(key,String(value));
  if (label) el.textContent=label;
  return el;
}
function element(tag,text,cls) {
  const el=document.createElement(tag); if (cls) el.className=cls; if (text) el.textContent=text; return el;
}
function action(label,handler,cls) {
  const el=element('button',label,cls); el.type='button'; el.addEventListener('click',handler); return el;
}
function imagePath(path) {
  return location.pathname.includes('/apps/site/share/') && path.startsWith('./assets/') ? '.'+path : path;
}
const mediaAt = number => COMPRESSOR_MEDIA[number-1];

// These meshes define the installed bodies in plan. Valves, labels, ducts
// and overhead headers are independent of the floor space a cabinet occupies.
const planBodyNames = new Set([
  'k50-base','chiller-skid-frame','wtank-stainless-body','wpump-stand','ows-tank',
  'jac100-body','dark-dryer-body','hx601-body','hx601-blue-front',
  'spx-blue-foot','spx-blue-tower','spx-center-console','ps600-vessel','ps600-ctrl-box',
]);
const roundBodies = new Set(['spx-blue-tower','ps600-vessel']);

export function compressorPlanGeometry(station) {
  const shapes = [], extent = new THREE.Box2();
  station.updateWorldMatrix(true,true);
  station.traverseVisible(mesh => {
    const shell = mesh.name === station.name+'-shell';
    if (!mesh.isMesh || !(shell || mesh.name===station.name+'-base' || planBodyNames.has(mesh.name))) return;
    const geometry=mesh.geometry;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    const {min,max}=geometry.boundingBox;
    const cx=(min.x+max.x)/2, cz=(min.z+max.z)/2, cy=(min.y+max.y)/2;
    let corners;
    if (shell || roundBodies.has(mesh.name)) {
      corners=Array.from({length:32},(_,i)=>{
        const angle=i*Math.PI/16;
        return [cx+(max.x-cx)*Math.cos(angle),cz+(max.z-cz)*Math.sin(angle)];
      });
    } else {
      corners=[[min.x,min.z],[max.x,min.z],[max.x,max.z],[min.x,max.z]];
    }
    const points=corners.map(([lx,lz])=>{
      const world=new THREE.Vector3(lx,cy,lz).applyMatrix4(mesh.matrixWorld);
      const point=new THREE.Vector2(world.x,world.z);
      extent.expandByPoint(point);
      return point;
    });
    // Low runners and plinths sit beneath the vessel outlines in the top view.
    shapes.push({points, height: new THREE.Vector3(cx,cy,cz).applyMatrix4(mesh.matrixWorld).y});
  });
  const outlines=shapes.sort((a,b)=>a.height-b.height).map(shape=>shape.points);
  return {outlines,extent};
}

export function createCompressorSurvey({getScene, floorSpec}) {
  let dialog, photoDialog, selector, plan, info, tabs, stageTitle, figure, caption, pager;
  let record, mode='layout', photoIndex=0, bindings=[], previousFocus, returnButton, helpButton, angleButton, viewportObserver;
  const stations=new Map();
  const records=[...COMPRESSOR_RECORDS,conveyor,approach];
  const room=floorSpec.rooms.find(r=>r.id==='compressor-room');
  const roomDoor=floorSpec.partitions.flatMap(wall=>(wall.openings||[]).map(o=>({wall,o}))).find(entry=>entry.o.id==='compressor-room-south');

  function attach(scene) {
    const root=scene.buildingEnvironments?.get(3)?.architectureFixtures?.getObjectByName('dryer-compressor-3-room');
    if (!root || stations.size) return;
    for (const row of COMPRESSOR_RECORDS) {
      const station=root.getObjectByName(row.id);
      if (!station) continue;
      const center=station.getWorldPosition(new THREE.Vector3());
      stations.set(row.id,{center,plan:compressorPlanGeometry(station)});
      station.traverse(node=>{ if (node.isMesh) node.userData.compressorRecord=row.id; });
      if (!/^\d호$/.test(symbols[row.id] || '')) continue;
      const canvas=document.createElement('canvas'); canvas.width=224; canvas.height=84;
      const ctx=canvas.getContext('2d');
      if (!ctx) continue;
      ctx.fillStyle='#123e45';ctx.fillRect(0,0,224,84);ctx.fillStyle='#c7dfdb';ctx.fillRect(0,0,7,84);
      ctx.fillStyle='#fff';ctx.font='bold 48px "Malgun Gothic",sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(symbols[row.id]+'기',114,42);
      const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
      const material=new THREE.SpriteMaterial({map,depthTest:true,depthWrite:false,toneMapped:false});
      const marker=new THREE.Sprite(material);marker.scale.set(.72,.27,1);
      const depth=station.userData.cabinetDimensions?.depth;
      if (row.id==='comp-unit-4-k2power-k50') marker.position.set(-.72,1.39,-.30);
      else marker.position.set(0,1.52,(depth || 1.85)/2+.08);
      marker.userData.compressorRecord=row.id;marker.userData.personCollision=false;
      marker.name='inspection-marker-'+row.id;
      station.add(marker); scene.textures.add(map); scene.materials.add(material);bindings.push(marker);
    }
    scene.compressorSurveyPick = (raycaster) => {
      if (scene.view!=='person' || scene.activeFloor!==3 || scene.placementMode || !scene.person) return;
      const [x,,z]=scene.person.position, b=room.bounds;
      if (x<b.minX || x>b.maxX || z<b.minZ || z>b.maxZ+.15) return;
      for (const hit of raycaster.intersectObject(root,true)) {
        let obj=hit.object;
        while(obj && obj.visible) obj=obj.parent;
        if (obj || !hit.object.isMesh && !hit.object.isSprite) continue;
        if (hit.object.userData.compressorRecord) return hit.object;
        return;
      }
    };
    scene.onCompressorSurvey=id=>open(id);
  }

  function visit(row,lookAlongConveyor=false) {
    const scene=getScene(); if (!scene || scene.placementMode) return false;
    let origin, target;
    if (row===conveyor) {
      const door=scene.buildingEnvironments.get(3).architectureFixtures.getObjectByName('dryer-building-3-elevator-landing-doors');
      if (!door) return false;
      const at=door.getWorldPosition(new THREE.Vector3());
      origin=[at.x,at.z+.65];
      target=lookAlongConveyor ? [at.x-1.90,at.y+1.25,at.z+3.23] : [at.x,at.y+1.12,at.z+3.9];
    } else if (row===approach) {
      origin=[15,-1.95]; target=[16.95,floorSpec.elevation+1.4,-3.4];
    } else if (row.id==='comp-water-tank-pump') {
      const site=stations.get(row.id); if(!site) return false;
      const {x,y,z}=site.center;
      // Photo 033 looks past the circulation pump towards the near tank end.
      origin=[x-1.54,z-2.38]; target=[x-.07,y+.98,z-.72];
    } else {
      const site=stations.get(row.id); if (!site) return false;
      const {x,y,z}=site.center;
      origin=[x>=20 ? 19.95 : 16.65, Math.min(-4.15, z+.4)];
      target=[x,y+1.15,z];
    }
    if (!scene.visitDryerInspectionPoint(origin,target)) return false;
    if(dialog.open)dialog.close();
    if(!returnButton) {
      const viewport=scene.canvas.parentElement;
      returnButton=action('',()=>open(returnButton.dataset.station),'air-reopen');
      helpButton=action('보행 안내 펼치기',()=>{
        const expanded=viewport.dataset.airInspection==='compact';
        viewport.dataset.airInspection=expanded?'expanded':'compact';
        helpButton.textContent=expanded?'보행 안내 접기':'보행 안내 펼치기';
        helpButton.setAttribute('aria-expanded',String(expanded));
      },'air-help-toggle');
      angleButton=action('',()=>visit(conveyor,angleButton.dataset.next==='hopper'),'air-conveyor-angle');
      viewport.append(returnButton,helpButton,angleButton);
      viewportObserver=new MutationObserver(()=>{
        if(scene.canvas.dataset.view!=='person'||scene.canvas.dataset.floor!=='3')delete viewport.dataset.airInspection;
      });
      viewportObserver.observe(scene.canvas,{attributes:true,attributeFilter:['data-floor','data-view']});
    }
    scene.canvas.parentElement.dataset.airInspection='compact';
    helpButton.textContent='보행 안내 펼치기';helpButton.setAttribute('aria-expanded','false');
    returnButton.dataset.station=row.id;
    returnButton.textContent=row===conveyor?'디스크 컨베이어 · 4면 사진':row.title+' · 자료 보기';
    angleButton.hidden=row!==conveyor;
    angleButton.dataset.next=lookAlongConveyor?'straight':'hopper';
    angleButton.textContent=lookAlongConveyor?'엘리베이터 정면 보기':'호퍼 방향 보기';
    scene.canvas.focus({preventScroll:true}); return true;
  }

  function build() {
    dialog=element('dialog',null,'air-survey'); dialog.id='air-survey';dialog.setAttribute('aria-labelledby','air-survey-heading');
    dialog.innerHTML='<header class="air-heading"><div><span>1팀 2파트 · 건조실 3층</span><h2 id="air-survey-heading">에어컴프레셔실</h2></div></header><div class="air-layout"><section class="air-plan"><div class="air-tabs"></div><div class="air-sheet"></div><p class="air-sheet-note"></p></section><section class="air-info"><label for="air-station">설비 선택</label><select id="air-station"></select><div class="air-record" aria-live="polite"></div></section></div>';
    const close=action('닫기',()=>dialog.close(),'air-close');dialog.querySelector('header').append(close);
    selector=dialog.querySelector('select'); plan=dialog.querySelector('.air-sheet');stageTitle=dialog.querySelector('.air-sheet-note');info=dialog.querySelector('.air-record');tabs=dialog.querySelector('.air-tabs');
    for (const [key,title] of [['layout','압축기실 배치'],['floor','3층 두 구역과 동선'],['drawing','건축도면 A-015']]) {
      const button=action(title,()=>{mode=key;drawPlan();});button.dataset.mode=key;tabs.append(button);
    }
    for (const row of records) {
      const opt=element('option',row.title); opt.value=row.id; selector.append(opt);
    }
    selector.addEventListener('change',()=>choose(selector.value));
    dialog.addEventListener('close',()=>previousFocus?.focus?.({preventScroll:true}));
    document.body.append(dialog);
    photoDialog=element('dialog',null,'air-lightbox');photoDialog.setAttribute('aria-label','현장 자료 확대');
    const closePhoto=action('닫기',()=>photoDialog.close(),'air-close');
    figure=element('img');caption=element('p');pager=element('div',null,'air-pager');photoDialog.append(closePhoto,figure,caption,pager);
    document.body.append(photoDialog);
    photoDialog.addEventListener('keydown',e=>{
      if(pager.hidden)return;
      if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();stepPhoto(e.key==='ArrowRight'?1:-1);}
    });
  }

  function floorOverview() {
    const x=v=>33+(v+8.6)*10.8, y=v=>39+(v+13.4)*10.8;
    const svg=svgNode('svg',{viewBox:'0 0 422 386',role:'img','aria-label':'3층 설비 홀 두 구역, 엘리베이터와 옥상 압축기실 사이의 현장 동선'});
    const rect=(b,fill,stroke)=>svg.append(svgNode('rect',{x:x(b.minX),y:y(b.minZ),width:(b.maxX-b.minX)*10.8,height:(b.maxZ-b.minZ)*10.8,fill,stroke}));
    const label=(at,text,cls='air-floor-label')=>svg.append(svgNode('text',{x:x(at[0]),y:y(at[1]),class:cls},text));
    rect(floorSpec.mainBounds,'#edf2ed','#6b817a');
    rect(floorSpec.northEastBay,'#e4e9e3','#6b817a');
    rect(room.bounds,'#e1efeb','#55746c');
    const cores=floorSpec.cores.elevator;
    rect(cores.bounds,'#abb9b6','#596e69');
    const survey=floorSpec.routeSurvey, registration=survey.hallRegistration;
    rect(survey.glazedEnclosure,'#f4e5a5','#ad9358');
    const border=registration.boundaryGuide.map(p=>x(p[0])+','+y(p[1])).join(' ');
    svg.append(svgNode('polyline',{points:border,fill:'none',stroke:'#68887a','stroke-width':1.4,'stroke-dasharray':'4 3'}));
    if(registration.connectingDoor){
      const [px,pz]=registration.connectingDoor.position;
      svg.append(svgNode('circle',{cx:x(px),cy:y(pz),r:4,fill:'white',stroke:'#354c4a','stroke-width':2}));
      label([px-4.8,pz-1.0],'흰 연결문','air-floor-sub');
    }
    label([-8.6,-15],'↑ 북');
    label([room.bounds.minX+.65,room.bounds.minZ+2.2],'에어컴프레셔실');
    const route=floorSpec.routeSurvey.compressorWalk.route;
    svg.append(svgNode('polyline',{points:route.map(p=>x(p[0])+','+y(p[1])).join(' '),fill:'none',stroke:'#b46c31','stroke-width':2.6}));
    const features=getScene()?.objects;
    for(const id of ['f3-feed-tank','f3-balance-tank','f3-sterilizer','f3-homogenizer','f3-holding']) {
      const obj=features?.get(id);if(!obj)continue;
      const pos=obj.getWorldPosition(new THREE.Vector3()),selected=id===conveyor.id;
      svg.append(svgNode('circle',{cx:x(pos.x),cy:y(pos.z),r:selected?4.6:3.3,fill:selected?'#b27529':'#438079'}));
    }
    label([2.55,-13.9],'엘리베이터');
    label([-1.7,-4.0],'엘리베이터 앞');
    label([-1.7,-2.6],'디스크 컨베이어');
    label([-7.9,8.4],'기존 설비 작업구역');
    label([-7.9,9.9],'CIP · 탱크 · 판형·펌프','air-floor-sub');
    label([10.2,1.9],'옥상 통로','air-floor-sub');
    label([9.4,-8.9],'계단참','air-floor-sub');
    label([-8.6,16.6],'● 설비   ○ 흰 연결문   ━ 옥상 동선   ┄ 잠정 구역 경계','air-floor-sub');
    plan.append(svg);
    const strip=element('div',null,'air-filmstrip');
    for(const frame of COMPRESSOR_WALK_FRAMES){
      const btn=action('',()=>{
        figure.src=imagePath(frame.path); figure.alt=frame.caption;pager.hidden=true;
        caption.textContent=frame.date+' · '+frame.time+' · '+frame.caption;photoDialog.showModal();
      });
      const img=element('img');img.loading='lazy';img.alt='';img.src=imagePath(frame.path);
      btn.append(img,element('span',frame.date+' '+frame.time),element('strong',frame.short));strip.append(btn);
    }
    plan.append(strip);
    stageTitle.textContent='11월 12일 영상에서 디스크 컨베이어 반환부 옆 흰 문을 열면 기존 설비 작업구역의 바닥 펌프가 보입니다. 문 위치는 영상 비례로 잡았으며, 점선은 전체 벽선이 추가 촬영으로 확인될 때까지의 잠정 경계입니다.';
  }

  function drawPlan() {
    for (const btn of tabs.children) btn.setAttribute('aria-pressed',String(btn.dataset.mode===mode));
    plan.replaceChildren();
    if(mode==='floor'){floorOverview();return;}
    if (mode==='drawing') {
      const button=action('',()=>openImage());button.className='air-drawing';button.setAttribute('aria-label','A-015 도면 확대');
      const img=element('img');img.src=imagePath(COMPRESSOR_PLAN_IMAGE);img.alt='4동 3층 원 도면 A-015. 엘리베이터 동쪽에 콤프레샤실과 옥상 출입구가 표기되어 있다.';button.append(img);plan.append(button);
      stageTitle.textContent='4동 3층 건축 평면도 · A-015. 도면을 누르면 확대할 수 있습니다.';return;
    }
    const b=room.bounds, scale=40, x0=28, y0=31;
    const x=v=>x0+(v-b.minX)*scale, z=v=>y0+(v-b.minZ)*scale;
    const w=x(b.maxX)-x0,h=z(b.maxZ)-y0,doorX=roomDoor.wall.a[0]+roomDoor.o.offset, half=roomDoor.o.width/2;
    const svg=svgNode('svg',{viewBox:'0 0 '+(w+2*x0)+' '+(h+75),role:'group','aria-label':'압축기실 실내 설비 배치. 기호를 선택해 설비를 조회할 수 있습니다.'});
    const line=(x1,y1,x2,y2,cls)=>svg.append(svgNode('line',{x1,y1,x2,y2,class:cls}));
    svg.append(svgNode('rect',{x:x0,y:y0,width:w,height:h,class:'air-deck'}));
    for(let i=1;i<w/scale;i++)line(x0+i*scale,y0,x0+i*scale,y0+h,'air-grid');
    for(let i=1;i<h/scale;i++)line(x0,y0+i*scale,x0+w,y0+i*scale,'air-grid');
    line(x0,y0,x0+w,y0,'air-wall');line(x0,y0,x0,y0+h,'air-wall');line(x0+w,y0,x0+w,y0+h,'air-wall');
    line(x0,y0+h,x(doorX-half),y0+h,'air-wall');line(x(doorX+half),y0+h,x0+w,y0+h,'air-wall');
    line(x(doorX-half),y0+h,x(doorX),y0+h,'air-fixed');line(x(doorX+half),y0+h,x(doorX+half),y0+h+half*scale,'air-leaf');
    svg.append(svgNode('path',{d:'M '+x(doorX)+' '+(y0+h)+' A '+half*scale+' '+half*scale+' 0 0 0 '+x(doorX+half)+' '+(y0+h+half*scale),class:'air-swing'}));
    svg.append(svgNode('text',{x:x0,y:18,class:'air-orient'},'↑ 북'),svgNode('text',{x:x(doorX)-3,y:y0+h+25,'text-anchor':'end',class:'air-orient'},'옥상 출입구'));
    const scaleEnd=x0+w, scaleStart=scaleEnd-scale;
    line(scaleStart,17,scaleEnd,17,'air-scale');
    line(scaleStart,14,scaleStart,20,'air-scale');line(scaleEnd,14,scaleEnd,20,'air-scale');
    svg.append(svgNode('text',{x:scaleStart-5,y:20,'text-anchor':'end',class:'air-orient'},'1 m'));
    for (const row of COMPRESSOR_RECORDS) {
      const s=stations.get(row.id); if(!s)continue;
      const {outlines,extent}=s.plan;
      if (!outlines.length) continue;
      const code=symbols[row.id] || row.title, middle=extent.getCenter(new THREE.Vector2());
      const group=svgNode('g',{role:'button',tabindex:0,'aria-label':row.title,'aria-pressed':String(row===record),class:'air-unit'+(code.endsWith('호')?' is-compressor':''),'data-station':row.id});
      group.append(svgNode('title',{},row.title));
      for (const points of outlines) {
        group.append(svgNode('polygon',{points:points.map(p=>x(p.x)+','+z(p.y)).join(' ')}));
      }
      group.append(svgNode('text',{x:x(middle.x),y:z(middle.y)+1,'text-anchor':'middle','dominant-baseline':'central'},code));
      group.addEventListener('click',()=>choose(row.id));
      group.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(row.id);plan.querySelector('[data-station="'+row.id+'"]')?.focus();}});
      svg.append(group);
    }
    plan.append(svg);stageTitle.textContent='격자 한 칸은 1 m입니다. 윤곽은 모델에 반영된 설비 본체 크기이며, 기호를 누르면 해당 설비의 명판과 사진이 열립니다.';
  }

  function stepPhoto(step) {
    const total=record.photoNumbers.length;
    photoIndex=(photoIndex+step+total)%total;showPhoto();
  }
  function showPhoto() {
    const num=record.photoNumbers[photoIndex], media=mediaAt(num);
    if(!media)return;
    figure.src=imagePath(media.path);
    const fields=record.fields.filter(field=>field.photo===num);
    const label=fields.length ? fields[0].source : (record===conveyor ? ['측면 전체','구동측','엘리베이터 방향','호퍼측'][photoIndex] : '현장 사진');
    figure.alt=record.title+' · '+label+' · 사진 '+num;
    caption.textContent=figure.alt+' · '+media.original;
    pager.hidden=false;pager.replaceChildren(action('← 이전',()=>stepPhoto(-1)),element('span',(photoIndex+1)+' / '+record.photoNumbers.length),action('다음 →',()=>stepPhoto(1)));
  }
  function openImage(number) {
    if(number==null){
      pager.hidden=true;figure.src=imagePath(COMPRESSOR_PLAN_IMAGE);figure.alt='4동 3층 평면도 A-015';caption.textContent=figure.alt;
    } else {photoIndex=Math.max(0,record.photoNumbers.indexOf(number));showPhoto();}
    photoDialog.showModal();
  }

  function choose(id) {
    record=records.find(row=>row.id===id)||records[0];selector.value=record.id;
    info.replaceChildren();drawPlan();
    const heading=element('h3',record.title), meta=element('p',[record.maker,record.model].filter(Boolean).join(' · ') || record.group,'air-meta');
    info.append(heading,meta);
    const go=action(record===conveyor?'엘리베이터 앞에서 보기':'3D에서 위치 보기',()=>{
      if(!visit(record)) {status.textContent='배치 편집을 마친 뒤 3D 위치를 열 수 있습니다.';}
    },'air-go');
    const status=element('span',null,'air-status');status.setAttribute('role','status');info.append(go,status);
    const preview=element('div',null,'air-preview');
    const plate=record.fields.find(field=>field.photo && /명판|검사표|관리표/.test(field.source));
    const previewNumbers=[...new Set([record.photoNumbers[0],plate?.photo || record.photoNumbers[1]])].filter(Boolean);
    for (const [index,number] of previewNumbers.entries()) {
      const button=action('',()=>openImage(number));
      const img=element('img'); img.alt='';img.src=imagePath(mediaAt(number).path);
      button.append(img,element('span',index===0?'외관 확대':plate ? '명판·표찰 확대' : '다른 방향'));preview.append(button);
    }
    info.append(preview);
    const list=element('dl',null,'air-fields');
    for (const field of record.fields) {
      const dt=element('dt',field.label),dd=element('dd',field.value);
      const source=field.photo && record.photoNumbers.includes(field.photo) ? action(field.source+' · #'+field.photo,()=>openImage(field.photo),'air-cite') : element('small',field.source);
      dd.append(source);list.append(dt,dd);
    }
    info.append(list);
    const photos=element('div',null,'air-thumbs');
    for(const n of record.photoNumbers){
      const photo=mediaAt(n);if(!photo)continue;
      const thumb=action('',()=>openImage(n));thumb.setAttribute('aria-label',record.title+' 사진 #'+n+' 확대');
      const img=element('img');img.src=imagePath(photo.path);img.loading='lazy';img.alt='';
      thumb.append(img,element('span','#'+String(n).padStart(3,'0')));photos.append(thumb);
    }
    info.append(element('h4','현장 사진 · 명판'),photos);
    for(const note of record.notes || [])info.append(element('p',note,'air-note'));
    const manuals=COMPRESSOR_MANUALS[record.id]||[];
    if(manuals.length) info.append(element('h4','제조사 기술자료'));
    for(const manual of manuals){
      const link=element('a',manual.title+' ↗','air-manual');link.href=manual.url;link.rel='noopener noreferrer';link.target='_blank';
      info.append(link,element('p',manual.note,'air-note'));
    }
    info.parentElement.scrollTop=0;
  }
  function open(id,{enter=false}={}) {
    if(!dialog)build();
    const s=getScene();if(s)attach(s);
    previousFocus=document.activeElement;
    if(enter && id===conveyor.id && visit(conveyor))return true;
    if(!dialog.open)dialog.showModal();
    choose(id || records[0]?.id);return true;
  }
  return {open,attach,dispose(){
    for(const marker of bindings)marker.removeFromParent();
    const s=getScene();if(s){s.compressorSurveyPick=null;s.onCompressorSurvey=null;}
    viewportObserver?.disconnect();returnButton?.remove();helpButton?.remove();angleButton?.remove();dialog?.remove();photoDialog?.remove();bindings=[];stations.clear();
  }};
}
