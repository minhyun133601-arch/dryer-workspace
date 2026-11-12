import * as THREE from '../shared/vendor/three.module.js';
import { createDetailCamera } from './detail-camera.js';
import { createLiquidModel } from './liquid-models.js';
import { LIQUID_ROOM, LIQUID_ROOMS, LIQUID_EQUIPMENT } from './liquid-data.js';
import { liquidAsset } from './liquid-assets.js';
import { createProximityDoorController } from './proximity-doors.js';

export function createLiquidDetail({ host = null, onOpen = () => {}, onClose = () => {} } = {}) {
  const inline = !!host;
  const dialog = document.createElement(inline ? 'section' : 'dialog'); dialog.className = `chiller-dialog liquid-dialog${inline ? ' liquid-inline' : ''}`; dialog.setAttribute('aria-labelledby', 'liquid-title');
  if (inline) { dialog.hidden = true; dialog.setAttribute('role', 'region'); }
  dialog.innerHTML = `<header class="cd-header"><div><p>TEAM 3 / LIQUID PRODUCTION</p><h2 id="liquid-title">3팀 <span>액상 공장</span></h2><small>액상 장비배치도·설비이력카드 52건 · 실외기실은 별도 구역</small></div><button type="button" class="ld-close cd-close" aria-label="액상 공장 닫기">닫기 ×</button></header>
    <div class="ld-rooms" aria-label="액상 작업실 선택"><button type="button" data-liquid-room="all" aria-pressed="true">액상 전체</button>${LIQUID_ROOMS.map((r) => `<button type="button" data-liquid-room="${r.id}" aria-pressed="false">${r.name}</button>`).join('')}</div>
    <div class="cd-layout"><section class="cd-visual"><div class="cd-model-pane"><div class="cd-toolbar"><div>${[['iso','입체'],['top','평면'],['front','정면'],['side','측면']].map(([v,n])=>`<button type="button" data-liquid-view="${v}">${n}</button>`).join('')}</div><button type="button" class="ld-zoom-in" aria-label="액상 확대">＋</button><button type="button" class="ld-zoom-out" aria-label="액상 축소">−</button><button type="button" class="ld-reset">전체 보기</button><label><input type="checkbox" class="ld-structure" checked>벽·기둥</label><label><input type="checkbox" class="ld-names">전체 이름</label></div>
    <div class="cd-stage ld-stage"><canvas tabindex="0" aria-label="3팀 액상 3D. 클릭해 설비 선택, 더블클릭·두 번 탭 확대, 드래그 회전. 우클릭·가운데·Shift 드래그 이동, 두 손가락 이동·확대, R 초기화."></canvas><div class="ld-labels"></div><p class="cd-fallback" hidden>3D 화면을 사용할 수 없습니다. 설비 목록에서 실제 사진을 확인해 주세요.</p><span class="cd-gesture">두 번 눌러 확대 · 우클릭 이동 · 휠 줌</span></div>
    <div class="ld-selection"><strong class="ld-current">액상 전체 · 설비 52건</strong><button type="button" class="ld-focus" disabled>선택 설비 확대</button><label><input type="checkbox" class="ld-isolate">선택 설비만</label><button type="button" class="ld-clear">선택 해제</button></div></div></section>
    <aside class="cd-sidebar"><div class="cd-sidehead"><h3>3팀 액상 설비 <span class="ld-count">52</span></h3><input type="search" class="ld-search" aria-label="액상 설비 검색" placeholder="설비명·카드 번호 검색"><p class="ld-room-note"></p></div><div class="ld-list">${LIQUID_EQUIPMENT.map((e)=>`<button type="button" data-liquid-equipment="${e.id}" aria-pressed="false"><span>${String(e.cardNumber).padStart(3,'0')}</span><div><strong>${e.name}</strong><small>${LIQUID_ROOMS.find(r=>r.id===e.roomId)?.name || e.room || ''}</small></div></button>`).join('')}</div>
      <section class="cd-part-detail ld-detail" aria-live="polite"><h3>액상 공장 전체</h3><small class="ld-basis"></small><p class="ld-description"></p><button type="button" class="ld-photo" aria-label="액상 설비 4방향 사진 확대" hidden><img alt=""></button><small class="ld-photo-caption"></small><ul class="ld-notes"></ul></section>
    </aside></div><footer class="cd-footer"><strong>3팀 = 액상 · 2팀 스틱·소포장과 별도</strong><span>도면 구획·배치와 카드의 정면·좌측·우측·후면을 대조했습니다. 제작도·실측이 없는 높이와 가려진 연결부는 개략입니다. 카드에 기록된 가동률·상태를 실시간 상태로 표시하지 않습니다.</span></footer>`;
  const photoDialog = document.createElement('dialog'); photoDialog.className = 'ld-photo-dialog';
  photoDialog.innerHTML = '<header><strong></strong><button type="button">닫기 ×</button></header><div tabindex="0"><img alt=""></div><footer>정면·좌측면·우측면·후면 · 사진을 두 번 누르면 확대</footer>';
  (host || document.body).append(dialog); document.body.append(photoDialog);
  const $ = (s) => dialog.querySelector(s), items = new Map(LIQUID_EQUIPMENT.map(e=>[e.id,e]));
  const labels = new Map(), roomLabels = new Map(); let renderer, camera, scene, model, controls, observer, selected = null, roomId = 'all', disposed = false, framingWhole = true, opened = false;
  let doorController, doorFrame = null, doorLastTick = null;
  const isOpen = () => inline ? opened : !!dialog.open;
  function stopDoorAnimation() {
    if (doorFrame !== null) cancelAnimationFrame(doorFrame);
    doorFrame = null; doorLastTick = null; doorController?.reset();
  }
  function notifyClosed() {
    stopDoorAnimation();
    if (photoDialog.open) photoDialog.close();
    if (!opened) return;
    opened = false; onClose();
  }
  function closeView() {
    photoDialog.close();
    if (inline) dialog.hidden = true;
    else if (dialog.open) dialog.close();
    notifyClosed();
  }
  if (!inline) dialog.addEventListener('close', () => { if (!dialog.open) notifyClosed(); });
  else { dialog.querySelector('.ld-close').textContent = '이전 공간'; dialog.querySelector('.ld-close').setAttribute('aria-label', '액상 공간을 닫고 이전 공간으로'); }
  function visibleItem(item) { return roomId === 'all' || item.roomId === roomId; }
  function draw(timestamp) {
    if (!renderer || !model || !camera || !isOpen() || disposed || document.hidden || dialog.checkVisibility?.() === false) { stopDoorAnimation(); return; }
    const now = Number.isFinite(timestamp) ? timestamp : globalThis.performance?.now?.() ?? Date.now();
    const elapsed = doorLastTick === null ? 1 / 60 : Math.max(0, now - doorLastTick) / 1000;
    doorLastTick = now;
    // Orbit inspection is not a person standing at a threshold. Door motion
    // belongs to the walking view's explicit manual/automatic controls.
    const animating = doorController?.update(null, elapsed, { autoOpen: false, reducedMotion: globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches || false });
    scene.updateMatrixWorld(true); renderer.render(scene,camera);
    for (const room of LIQUID_ROOMS) {
      const label = roomLabels.get(room.id), b = room.bounds; if (!label || !b) continue;
      const point = new THREE.Vector3((b.minX+b.maxX)/2,.08,(b.minZ+b.maxZ)/2).project(camera);
      label.hidden = roomId !== 'all' || selected !== null || point.z < -1 || point.z > 1 || Math.abs(point.x) > .95 || Math.abs(point.y) > .94;
      label.style.left=`${(point.x*.5+.5)*100}%`; label.style.top=`${(-point.y*.5+.5)*100}%`;
    }
    for (const item of LIQUID_EQUIPMENT) {
      const label = labels.get(item.id), object = model.objects.get(item.id);
      if (!label) continue;
      if (!object?.visible || !visibleItem(item) || (!$('.ld-names').checked && item.id!==selected)) { label.hidden=true; continue; }
      const anchor = model.anchorOf(item.id) || new THREE.Vector3(...item.position); anchor.project(camera);
      label.hidden = anchor.z < -1 || anchor.z > 1 || Math.abs(anchor.x) > .97 || Math.abs(anchor.y) > .94;
      label.style.left=`${(anchor.x*.5+.5)*100}%`; label.style.top=`${(-anchor.y*.5+.5)*100}%`; label.classList.toggle('is-selected',item.id===selected);
    }
    if (animating && doorFrame === null) doorFrame = requestAnimationFrame(time => { doorFrame = null; draw(time); });
  }
  function documentVisibilityChanged() { if (document.hidden) stopDoorAnimation(); else if (isOpen()) draw(); }
  document.addEventListener?.('visibilitychange', documentVisibilityChanged);
  function fit() {
    if (!model || !controls) return;
    const box = new THREE.Box3();
    for (const item of LIQUID_EQUIPMENT.filter(visibleItem)) { const object=model.objects.get(item.id); if(object)box.expandByObject(object); }
    if (roomId === 'all') box.expandByObject(model.environment.root);
    else { const floor = model.environment.roomFloors.get(roomId); if (floor) box.expandByObject(floor); }
    if (box.isEmpty()) box.setFromCenterAndSize(new THREE.Vector3(),new THREE.Vector3(99.7,4,39.2));
    const center=box.getCenter(new THREE.Vector3()),a=.45,e=.88,tan=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));
    const right=new THREE.Vector3(Math.cos(a),0,-Math.sin(a)),up=new THREE.Vector3(-Math.sin(a)*Math.sin(e),Math.cos(e),-Math.cos(a)*Math.sin(e));
    const towardEye=new THREE.Vector3(Math.sin(a)*Math.cos(e),Math.sin(e),Math.cos(a)*Math.cos(e));
    let distance=5;
    for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
      const p=new THREE.Vector3(x,y,z).sub(center),depth=p.dot(towardEye);
      distance=Math.max(distance,depth+Math.abs(p.dot(right))/(tan*camera.aspect)*1.12,depth+Math.abs(p.dot(up))/tan*1.12);
    }
    framingWhole=true;controls.setHome(center,distance,a,e);
  }
  function resize() {
    if(!renderer || !controls || !isOpen())return;
    const rect=$('.ld-stage').getBoundingClientRect();if(!rect.width||!rect.height)return;
    renderer.setSize(rect.width,rect.height,false);const old=camera.aspect;camera.aspect=rect.width/rect.height;
    camera.updateProjectionMatrix();if(old!==camera.aspect && framingWhole) fit();else controls.update();
  }
  function init() {
    if(renderer)return;
    try {
      renderer=new THREE.WebGLRenderer({canvas:$('canvas'),antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
      renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.1;
      scene=new THREE.Scene();scene.background=new THREE.Color(0xe8efeb);camera=new THREE.PerspectiveCamera(42,1,.03,1400);
      scene.add(new THREE.HemisphereLight(0xffffff,0x758a75,3));const sun=new THREE.DirectionalLight(0xfff2de,3.2);sun.position.set(-30,70,35);scene.add(sun);
      const fill=new THREE.DirectionalLight(0xd9e9ff,1.5);fill.position.set(30,30,-25);scene.add(fill);
      model=createLiquidModel({equipment:LIQUID_EQUIPMENT,rooms:LIQUID_ROOMS,detail:true,columns:LIQUID_ROOM.columns||[],walls:LIQUID_ROOM.walls||[],routes:LIQUID_ROOM.routes||[]});scene.add(model.root);
      doorController=createProximityDoorController(scene);
      controls=createDetailCamera($('canvas'),camera,{objects:()=>[model.root],draw,select:(hit)=>{
        for(let object=hit?.object;object;object=object.parent){const id=object.userData.equipment||object.userData.equipmentId||object.userData.liquidId;if(items.has(id)){if(visibleItem(items.get(id))&&model.objects.get(id)?.visible)selectItem(id);return;}}
      }});
      for(const item of LIQUID_EQUIPMENT){const label=document.createElement('button');label.type='button';label.textContent=item.name;label.hidden=true;label.addEventListener('click',()=>selectItem(item.id));$('.ld-labels').append(label);labels.set(item.id,label);}
      for(const room of LIQUID_ROOMS){const label=document.createElement('button');label.type='button';label.className='ld-room-label';label.textContent=room.name;label.hidden=true;label.addEventListener('click',()=>setRoom(room.id));$('.ld-labels').append(label);roomLabels.set(room.id,label);}
      observer=new ResizeObserver(resize);observer.observe($('.ld-stage'));resize();fit();
    }catch(error){console.error('액상 3D 초기화 실패',error);stopDoorAnimation();doorController?.dispose();doorController=null;observer?.disconnect();controls?.dispose();model?.dispose();renderer?.dispose();renderer=model=controls=null;$('.cd-fallback').hidden=false;}
  }
  function selectItem(id) {
    const item=items.get(id);if(item&&!visibleItem(item))return;selected=item?.id||null;dialog.classList.toggle('has-liquid-selection',Boolean(item));model?.setHighlight(selected);model?.setIsolation($('.ld-isolate').checked?selected:null);
    dialog.querySelectorAll('[data-liquid-equipment]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.liquidEquipment===selected)));
    $('.ld-focus').disabled=!item;$('.ld-current').textContent=item?item.name:`${roomId==='all'?'액상 전체':LIQUID_ROOMS.find(r=>r.id===roomId)?.name} · 설비 ${LIQUID_EQUIPMENT.filter(visibleItem).length}건`;
    $('.ld-detail h3').textContent=item?.name||'3팀 액상 전체';$('.ld-basis').textContent=item?`카드 ${String(item.cardNumber).padStart(3,'0')} · ${item.confidence||'카드 사진 외형 / 도면 상대 배치'}`:LIQUID_ROOM.source||'액상 장비배치도 + 3팀 설비이력카드';
    $('.ld-description').textContent=item?.summary||LIQUID_ROOM.summary||'작업실이나 설비를 선택해 실제 4방향 사진과 함께 살펴보세요.';
    $('.ld-photo').hidden=!item;$('.ld-photo-caption').textContent=item?'설비이력카드 · 정면 / 좌측 / 우측 / 후면':'';
    if(item){$('.ld-photo img').src=liquidAsset(item.cardNumber);$('.ld-photo img').alt=`${item.name} 4방향 사진`;}
    $('.ld-notes').replaceChildren(...(item?.details||[]).map(text=>{const li=document.createElement('li');li.textContent=text;return li;})); draw();
  }
  function filterList(){const q=$('.ld-search').value.trim().toLowerCase();let count=0;
    dialog.querySelectorAll('[data-liquid-equipment]').forEach(b=>{const e=items.get(b.dataset.liquidEquipment);b.hidden=!visibleItem(e)||(q&&!`${e.name} ${e.cardNumber} ${e.room||''}`.toLowerCase().includes(q));if(!b.hidden)count++;});$('.ld-count').textContent=String(count);}
  function setRoom(id){roomId=LIQUID_ROOMS.some(r=>r.id===id)?id:'all';$('.ld-search').value='';$('.ld-isolate').checked=false;model?.setIsolation(null);model?.setRoom(roomId==='all'?null:roomId);$('.ld-structure').checked=roomId==='all';model?.setStructureVisible($('.ld-structure').checked);
    dialog.querySelectorAll('[data-liquid-room]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.liquidRoom===roomId)));
    $('.ld-room-note').textContent=LIQUID_ROOMS.find(r=>r.id===roomId)?.summary||'전체 8개 작업 구역 · 설비 52건';filterList();selectItem(null);fit();}
  $('.ld-close').addEventListener('click',closeView);$('.ld-clear').addEventListener('click',()=>{ $('.ld-isolate').checked=false;selectItem(null);});
  dialog.querySelectorAll('[data-liquid-room]').forEach(b=>b.addEventListener('click',()=>setRoom(b.dataset.liquidRoom)));
  dialog.querySelectorAll('[data-liquid-equipment]').forEach(b=>b.addEventListener('click',()=>selectItem(b.dataset.liquidEquipment)));
  dialog.querySelectorAll('[data-liquid-view]').forEach(b=>b.addEventListener('click',()=>b.dataset.liquidView==='iso'?fit():controls?.view(b.dataset.liquidView)));
  $('.ld-search').addEventListener('input',filterList);$('.ld-reset').addEventListener('click',()=>{$('.ld-isolate').checked=false;selectItem(null);fit();});
  $('canvas').addEventListener('pointerdown',()=>{framingWhole=false;});$('canvas').addEventListener('wheel',()=>{framingWhole=false;},{passive:true});
  $('.ld-zoom-in').addEventListener('click',()=>{framingWhole=false;controls?.zoom(.75);});$('.ld-zoom-out').addEventListener('click',()=>{framingWhole=false;controls?.zoom(1.333);});
  $('.ld-names').addEventListener('change',draw);$('.ld-structure').addEventListener('change',()=>{model?.setStructureVisible($('.ld-structure').checked);draw();});
  $('.ld-isolate').addEventListener('change',()=>{model?.setIsolation($('.ld-isolate').checked?selected:null);draw();});
  $('.ld-focus').addEventListener('click',()=>{const object=model?.objects.get(selected);if(!object)return;framingWhole=false;const box=new THREE.Box3().setFromObject(object);controls.focus(box.getCenter(new THREE.Vector3()),Math.max(2.5,box.getSize(new THREE.Vector3()).length()*1.8));});
  $('.ld-photo').addEventListener('click',()=>{const item=items.get(selected);if(!item)return;photoDialog.querySelector('strong').textContent=`${item.name} · 카드 ${item.cardNumber}`;photoDialog.querySelector('img').src=liquidAsset(item.cardNumber);photoDialog.querySelector('img').alt=`${item.name} 정면·좌측·우측·후면`;photoDialog.querySelector('img').style.width='';photoDialog.showModal();});
  photoDialog.querySelector('button').addEventListener('click',()=>photoDialog.close());photoDialog.querySelector('img').addEventListener('dblclick',e=>{e.target.style.width=e.target.style.width?'':'1600px';});
  return {open({equipmentId}={}){if(disposed)return;if(!isOpen()){if(inline)dialog.hidden=false;else dialog.showModal();opened=true;onOpen();}init();resize();setRoom('all');if(items.has(equipmentId))selectItem(equipmentId);},close:closeView,dispose(){if(disposed)return;closeView();disposed=true;document.removeEventListener?.('visibilitychange',documentVisibilityChanged);doorController?.dispose();doorController=null;observer?.disconnect();controls?.dispose();model?.dispose();renderer?.dispose();photoDialog.remove();dialog.remove();}};
}
