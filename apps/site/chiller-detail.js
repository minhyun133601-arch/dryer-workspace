import * as THREE from '../shared/vendor/three.module.js';
import { createChillerModel } from './chiller-model.js';
import { createDetailCamera } from './detail-camera.js';
import { CHILLER_INFO, CHILLER_PARTS, CHILLER_BOM, CHILLER_SHEETS, chillerAsset } from './chiller-data.js';

export function createChillerDetail() {
  const dialog = document.createElement('dialog');
  dialog.className = 'chiller-dialog'; dialog.setAttribute('aria-labelledby', 'chiller-title');
  dialog.innerHTML = `
    <header class="cd-header"><div><p>OUTDOOR / 100RT SCREW CHILLER</p><h2 id="chiller-title">냉동기 <span>구조·분해도</span></h2><small>${CHILLER_INFO.model} · ${CHILLER_INFO.dimensions}</small></div><button type="button" class="cd-close" aria-label="냉동기 분해도 닫기">닫기 ×</button></header>
    <nav class="cd-tabs" aria-label="냉동기 보기"><button type="button" data-cd-tab="model" aria-pressed="true">3D 구조·분해</button><button type="button" data-cd-tab="drawing" aria-pressed="false">원도면·냉매 회로</button><span>${CHILLER_INFO.drawing}</span></nav>
    <div class="cd-layout">
      <section class="cd-visual">
        <div class="cd-model-pane"><div class="cd-toolbar"><div><button type="button" data-cd-assembly="0" aria-pressed="false">조립</button><button type="button" data-cd-assembly="100" aria-pressed="true">분해</button></div><div>${[['iso','입체'],['front','정면'],['top','평면'],['side','측면']].map(([id,name]) => `<button type="button" data-cd-view="${id}">${name}</button>`).join('')}</div><button type="button" class="cd-reset">시점 초기화</button></div>
          <div class="cd-stage"><canvas tabindex="0" aria-label="냉동기 3D. 드래그 회전, 우클릭·가운데·Shift 드래그 이동, 휠로 커서 위치 확대. 더블클릭 또는 두 번 탭한 지점을 확대합니다. 두 손가락 이동·확대, R 초기화."></canvas><div class="cd-labels"></div><p class="cd-fallback" hidden>3D 화면을 사용할 수 없습니다. 원도면을 확인해 주세요.</p><span class="cd-gesture">두 번 눌러 확대 · 우클릭 이동 · 휠 줌</span></div>
          <div class="cd-spread"><label for="chiller-spread">구성 분리 <output id="chiller-percent">100%</output></label><input id="chiller-spread" type="range" min="0" max="100" value="100" aria-label="냉동기 분해 간격"><label class="cd-isolate"><input type="checkbox" id="chiller-isolate">선택 부품만</label><button type="button" class="cd-focus" disabled>선택 부품 확대</button></div>
        </div>
        <div class="cd-image-pane" hidden><div class="cd-imagebar"><select class="cd-sheet-select" aria-label="냉동기 원도면 선택">${CHILLER_SHEETS.map((s,i) => `<option value="${i}">${s.page}쪽 · ${s.name}</option>`).join('')}</select><div class="cd-photo-nav" hidden><button type="button" class="cd-prev" aria-label="이전 냉동기 도면">←</button><output class="cd-photo-count"></output><button type="button" class="cd-next" aria-label="다음 냉동기 도면">→</button></div><button type="button" data-cd-image-zoom="-1" aria-label="자료 축소">−</button><button type="button" data-cd-image-zoom="1" aria-label="자료 확대">＋</button><button type="button" data-cd-image-zoom="0">맞춤</button></div><div class="cd-image-scroll" tabindex="0" aria-label="냉동기 자료 확대 화면"><img class="cd-main-image" alt=""></div><div class="cd-image-caption"><strong></strong><p></p><small>＋ 또는 두 번 눌러 확대 · 확대 후 스크롤로 이동</small></div></div>
      </section>
      <aside class="cd-sidebar"><div class="cd-sidehead"><h3>구성 <span>13묶음</span></h3><p>묶음을 선택하면 대응 도면과 부품 정보를 봅니다.</p><small>아래 묶음 번호와 원도면 부품표 번호는 별도입니다.</small><button type="button" class="cd-all">전체 구성 보기</button></div><div class="cd-parts">${CHILLER_PARTS.map((p,i) => `<button type="button" data-cd-part="${p.id}" aria-pressed="false"><span>${String(i+1).padStart(2,'0')}</span><strong>${p.name}</strong></button>`).join('')}</div>
        <section class="cd-part-detail" aria-live="polite"><h3></h3><small class="cd-part-drawing"></small><p></p><button type="button" class="cd-part-photo" aria-label="선택 구성의 대응 도면 확대"><img alt=""></button><div class="cd-evidence-actions"><button type="button" class="cd-show-photo" hidden disabled>대응 도면</button><button type="button" class="cd-show-sheet">대응 도면</button></div></section>
        <details class="cd-bom"><summary>원도면 부품표 · 23종</summary><p>SC010606 부품표 수량입니다. 항목을 누르면 해당 3D 구성을 선택합니다.</p><table><thead><tr><th>도면 번호</th><th>품명·규격</th><th>수량</th></tr></thead><tbody>${CHILLER_BOM.map(([n,en,ko,q,spec,id]) => `<tr><td>${n}</td><td><button type="button" data-cd-bom="${id}"><strong>${ko}</strong><small>${en}<br>${spec}</small></button></td><td>${q}</td></tr>`).join('')}</tbody></table></details>
      </aside>
    </div><footer class="cd-footer"><strong>${CHILLER_INFO.basis}</strong><span>${CHILLER_INFO.note}</span></footer>`;
  document.body.append(dialog);
  const $ = (query) => dialog.querySelector(query);
  let renderer, camera, scene, model, controls, observer, selected = null, tab = 'model', amount = 1, sheetIndex = 0, imageZoom = 1, disposed = false;
  const markerButtons = new Map(), labelPosition = new THREE.Vector3();

  function draw() {
    if (!renderer || !model || !camera || !dialog.open || tab !== 'model') return;
    scene.updateMatrixWorld(true); renderer.render(scene, camera);
    for (const part of CHILLER_PARTS) {
      const marker = markerButtons.get(part.id), record = model.records.get(part.id);
      if (!record) { marker.hidden = true; continue; }
      const anchor = model.anchorOf(part.id, labelPosition) || labelPosition;
      const point = anchor.clone().project(camera);
      marker.hidden = !record.group.visible || point.z < -1 || point.z > 1 || Math.abs(point.x) > .96 || Math.abs(point.y) > .94;
      marker.style.left = `${(point.x * .5 + .5) * 100}%`; marker.style.top = `${(-point.y * .5 + .5) * 100}%`;
    }
  }
  function resize() {
    if (!renderer || !controls || !dialog.open || tab !== 'model') return;
    const rect = $('.cd-stage').getBoundingClientRect(); if (!rect.width || !rect.height) return;
    renderer.setSize(rect.width, rect.height, false); camera.aspect = rect.width / rect.height; controls.update();
  }
  function init() {
    if (renderer) return;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: $('canvas'), antialias: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.7)); renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
      scene = new THREE.Scene(); scene.background = new THREE.Color(0xeaf0f1);
      camera = new THREE.PerspectiveCamera(40, 1, .02, 300);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x65766b, 3.1));
      const light = new THREE.DirectionalLight(0xfff5e5, 3.4); light.position.set(-5, 10, 7); scene.add(light);
      const fill = new THREE.DirectionalLight(0xd7e7ff, 2); fill.position.set(6, 3, -5); scene.add(fill);
      model = createChillerModel({ detail: true }); scene.add(model.root); model.setExplode(amount);
      const grid = new THREE.GridHelper(16, 32, 0xbbc9c6, 0xdce4e1); grid.position.y = -.02; scene.add(grid);
      controls = createDetailCamera($('canvas'), camera, { objects: () => [model.root], draw, select: (hit) => {
        if (!hit) return;
        const record = model.records.get(hit.object.userData.chillerPart || hit.object.userData.partId);
        if (record) selectPart(record.id);
      } });
      CHILLER_PARTS.forEach((part, i) => {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = String(i + 1).padStart(2, '0'); button.title = part.name;
        button.setAttribute('aria-label', part.name); button.addEventListener('click', () => selectPart(part.id)); $('.cd-labels').append(button); markerButtons.set(part.id, button);
      });
      observer = new ResizeObserver(resize); observer.observe($('.cd-stage')); controls.reset(true);
    } catch (error) {
      console.error('냉동기 3D 초기화 실패', error); observer?.disconnect(); controls?.dispose(); model?.dispose(); renderer?.dispose();
      renderer = model = controls = null; $('.cd-fallback').hidden = false;
    }
  }
  function selectPart(id) {
    const part = CHILLER_PARTS.find((p) => p.id === id); if (!part) return;
    selected = id; model?.setHighlight(id); applyIsolation();
    dialog.querySelectorAll('[data-cd-part]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.cdPart === id)));
    for (const [key, button] of markerButtons) button.classList.toggle('is-selected', key === id);
    $('.cd-part-detail h3').textContent = part.name; $('.cd-part-drawing').textContent = part.drawing; $('.cd-part-detail p').textContent = part.text;
    const sheet = CHILLER_SHEETS.find(entry => entry.page === selectedSheetPage());
    $('.cd-part-photo img').src = chillerAsset(`sheet${String(sheet.page).padStart(3,'0')}`); $('.cd-part-photo img').alt = `${part.name} 대응 도면`;
    $('.cd-focus').disabled = false; draw();
  }
  function clearSelection() {
    selected = null; $('#chiller-isolate').checked = false; model?.setHighlight(null); model?.setIsolation(null);
    dialog.querySelectorAll('[data-cd-part]').forEach((button) => button.setAttribute('aria-pressed', 'false'));
    for (const button of markerButtons.values()) button.classList.remove('is-selected');
    $('.cd-part-detail h3').textContent = CHILLER_INFO.name; $('.cd-part-drawing').textContent = CHILLER_INFO.drawing;
    $('.cd-part-detail p').textContent = '제작도 치수와 압축기 2대·팬 8조·리시버 2기를 반영했습니다. 조립·분해를 전환하거나 묶음을 선택해 대응 도면을 확인하세요.';
    $('.cd-part-photo img').src = chillerAsset('sheet014'); $('.cd-part-photo img').alt = '냉동기 외형 도면'; $('.cd-focus').disabled = true; draw();
  }
  function applyIsolation() { model?.setIsolation($('#chiller-isolate').checked ? selected : null); draw(); }
  function spread(value) {
    amount = Number(value) / 100; model?.setExplode(amount); $('#chiller-spread').value = String(value); $('#chiller-percent').textContent = `${value}%`;
    dialog.querySelectorAll('[data-cd-assembly]').forEach((button) => button.setAttribute('aria-pressed', String(Number(button.dataset.cdAssembly) === Number(value)))); draw();
  }
  function setTab(next) {
    next = next === 'model' ? 'model' : 'drawing';
    tab = next; dialog.querySelectorAll('[data-cd-tab]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.cdTab === next)));
    $('.cd-model-pane').hidden = next !== 'model'; $('.cd-image-pane').hidden = next === 'model';
    $('.cd-sheet-select').hidden = next !== 'drawing'; $('.cd-photo-nav').hidden = next !== 'drawing';
    if (next === 'model') resize(); else { imageZoom = 1; showImage(); }
  }
  function showImage() {
    const sheet = CHILLER_SHEETS[sheetIndex];
    if (!sheet) return;
    const key = `sheet${String(sheet.page).padStart(3, '0')}`;
    $('.cd-main-image').src = chillerAsset(key);
    $('.cd-main-image').alt = sheet.name;
    $('.cd-main-image').style.width = `${imageZoom * 100}%`;
    $('.cd-image-caption strong').textContent = `${sheet.name} · ${sheet.code}`;
    $('.cd-image-caption p').textContent = sheet.text;
    $('.cd-photo-count').textContent = `${sheetIndex + 1} /${CHILLER_SHEETS.length}`; $('.cd-sheet-select').value = String(sheetIndex);
    $('.cd-image-scroll').scrollTo(0, 0);
  }
  function selectedSheetPage() { return selected?.startsWith('compressor') ? 16 : selected === 'copper-valves' || selected === 'insulated-pipes' ? 15 : selected === 'receiver' ? 2 : selected === 'coil-bank' ? 21 : selected === 'insulated-vessel' ? 4 : 14; }
  function selectedSheet() {
    const page = selectedSheetPage();
    sheetIndex = CHILLER_SHEETS.findIndex((s) => s.page === page); setTab('drawing');
  }
  $('.cd-close').addEventListener('click', () => dialog.close());
  $('.cd-all').addEventListener('click', clearSelection);
  dialog.querySelectorAll('[data-cd-tab]').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.cdTab)));
  dialog.querySelectorAll('[data-cd-part]').forEach((b) => b.addEventListener('click', () => selectPart(b.dataset.cdPart)));
  dialog.querySelectorAll('[data-cd-bom]').forEach((b) => b.addEventListener('click', () => { setTab('model'); selectPart(b.dataset.cdBom); }));
  dialog.querySelectorAll('[data-cd-assembly]').forEach((b) => b.addEventListener('click', () => { spread(b.dataset.cdAssembly); controls?.reset(amount > .5); }));
  dialog.querySelectorAll('[data-cd-view]').forEach((b) => b.addEventListener('click', () => controls?.view(b.dataset.cdView)));
  $('#chiller-spread').addEventListener('input', (e) => spread(e.target.value)); $('#chiller-isolate').addEventListener('change', applyIsolation);
  $('.cd-reset').addEventListener('click', () => controls?.reset(amount > .5));
  $('.cd-focus').addEventListener('click', () => { const point = model?.anchorOf(selected); if (point) controls.focus(point, selected === 'coil-bank' || selected === 'frame' ? 5 : 2); });
  $('.cd-part-photo').addEventListener('click', selectedSheet); $('.cd-show-photo').addEventListener('click', selectedSheet); $('.cd-show-sheet').addEventListener('click', selectedSheet);
  $('.cd-sheet-select').addEventListener('change', (event) => { sheetIndex = Number(event.target.value); imageZoom = 1; showImage(); });
  $('.cd-prev').addEventListener('click', () => { sheetIndex = (sheetIndex + CHILLER_SHEETS.length - 1) % CHILLER_SHEETS.length; showImage(); }); $('.cd-next').addEventListener('click', () => { sheetIndex = (sheetIndex + 1) % CHILLER_SHEETS.length; showImage(); });
  dialog.querySelectorAll('[data-cd-image-zoom]').forEach((b) => b.addEventListener('click', () => { const step = Number(b.dataset.cdImageZoom); imageZoom = step === 0 ? 1 : THREE.MathUtils.clamp(imageZoom * (step > 0 ? 1.5 : 1 / 1.5), .5, 5); $('.cd-main-image').style.width = `${imageZoom * 100}%`; }));
  $('.cd-main-image').addEventListener('dblclick', () => { imageZoom = imageZoom > 1 ? 1 : 2.5; $('.cd-main-image').style.width = `${imageZoom * 100}%`; });
  return {
    open() { if (disposed) return; if (!dialog.open) dialog.showModal(); init(); if (selected) selectPart(selected); else clearSelection(); setTab('model'); resize(); },
    close() { if (dialog.open) dialog.close(); },
    dispose() { if (disposed) return; disposed = true; observer?.disconnect(); controls?.dispose(); model?.dispose(); scene?.traverse((o) => { if (o.isGridHelper) { o.geometry.dispose(); o.material.dispose(); } }); renderer?.dispose(); dialog.remove(); },
  };
}
