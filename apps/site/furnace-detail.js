import * as THREE from '../shared/vendor/three.module.js';
import { buildFurnace } from './furnace-model.js';
import { createDrawingModel, DIMENSION_LINES, FLOW_TAG } from './furnace-drawing-model.js';
import { BASIS, DRAWING_GROUPS, DRAWING_INFO, DRAWING_PARTS, DRAWING_SHEETS, FIELD_STATUS, GAS_PATH, PART_BY_ID, PILOT_PATH } from './furnace-drawing-data.js';
import { createBurnerMaintenance } from './burner-maintenance.js';
import { createBurnerService } from './burner-service.js';

// Retain only the two technical drawings in the active viewer.
const furnacePhotos = {
  sheetburner: './assets/drawings/furnace/burner-assembly-drawing.jpg',
  sheetpiping: './assets/drawings/furnace/gas-piping-drawing.jpg',
};
// Resolve the same drawings in the workbench, shared viewer and presentation.
const assetUrl = (key) => {
  const source = furnacePhotos[key];
  if (!source || source.startsWith('data:')) return source;
  if (location.pathname.includes('/site/share/')) return `.${source}`;
  if (location.pathname.includes('/presentation/')) return `../site/${source.slice(2)}`;
  return source;
};
const sheetKey = (key) => `sheet${key}`;
const furnaceParts = [
  { name: '상부 덕트', short: '상부 덕트', text: '상부의 원통형 금속 덕트와 둘레 이음부를 재현했습니다.', photo: 'duct', source: '20261104_110627.jpg' },
  { name: '전이 후드', short: '전이 후드', text: '원통 덕트와 사각 본체 사이의 넓어지는 후드, 하단 차양을 표현했습니다.', photo: 'overview', source: '20261104_110523.jpg' },
  { name: '버너 본체·점검문', short: '본체·점검문', text: '사각 금속 외함, 측면 점검문과 손잡이, 둘레 체결구 및 하부 지지대를 반영했습니다.', photo: 'body', source: '20261104_110613.jpg' },
  { name: '전면 송풍부 2대', short: '송풍부 ×2', text: '전면의 주황색 원형 케이싱 2대와 각각의 하부 모터를 묶어 표시합니다.', photo: 'blowers', source: '20261104_110604.jpg' },
  { name: '배관·밸브', short: '배관·밸브', text: '노란 배관과 플랜지, 밸브, 압력계 및 조절장치의 외형을 반영했습니다.', photo: 'gas', source: '20261104_110650.jpg' },
  { name: '점화·검출부', short: '점화·검출부', text: '현장 표기의 UV SCANNER, SPARK PLUG와 연결 배선을 참고했습니다.', photo: 'ignition', source: '20261104_110727.jpg' },
];

const bomParts = DRAWING_PARTS.filter(({ basis }) => basis === 'bom');
const differing = DRAWING_PARTS.filter(({ field }) => field?.status === 'differs');
const SUBTITLES = {
  drawing: `${DRAWING_INFO.maker} ${DRAWING_INFO.model} 도면 치수로 만든 3D 분해도`,
  photo: '현장 사진으로 살펴보는 주요 구성과 조립 관계',
};
const FOOTERS = {
  drawing: ['도면 기반 3D 재구성 · 치수 단위 mm', '번호 부품의 위치와 길이는 도면 값을 따릅니다. 번호 없는 구성과 내부 공기 경로는 도면 외형을 해석한 개략입니다.', `${DRAWING_INFO.date} 원도면 2장`],
  photo: ['현장 사진 기반 구성 개념도', '외장 구성과 조립 관계를 설명합니다. 치수·내부 구조·실제 해체 순서는 포함하지 않습니다.', '2026.11.04 · 현장 사진 30장 검토'],
};
const VIEW_PRESETS = {
  iso: { azimuth: .5, elevation: .34 },
  front: { azimuth: 0, elevation: .02 },
  top: { azimuth: 0, elevation: 1.56 },
  side: { azimuth: Math.PI / 2, elevation: .02 },
};
const ORBIT_DEFAULTS = { drawing: { ...VIEW_PRESETS.iso, distance: 7.5 }, photo: { azimuth: .58, elevation: .22, distance: 17.5 } };
const ORBIT_LIMITS = { drawing: { top: 1.56, near: .35, far: 45 }, photo: { top: 1.56, near: .65, far: 70 } };
const DRAWING_TARGET = { assembled: new THREE.Vector3(-.42, .72, .3), exploded: new THREE.Vector3(-.98, 1.02, .62) };

export function createFurnaceDetail({ documents = [], presentation = false, onClose = () => {} } = {}) {
  const maintenance = documents.length ? createBurnerMaintenance(documents) : null;
  const dialog = document.createElement('dialog');
  dialog.className = `furnace-dialog${presentation ? ' is-presentation' : ''}`;
  dialog.setAttribute('aria-labelledby', 'furnace-title');
  dialog.innerHTML = `
    <header class="furnace-header">
      <div><p class="furnace-eyebrow">DRYER / EQUIPMENT DETAIL</p><h2 id="furnace-title">건조실 <span>버너</span></h2><p class="furnace-subtitle">${SUBTITLES.drawing}</p></div>
      <div class="furnace-source" role="group" aria-label="버너 도면과 정비자료"><button type="button" data-furnace-source="drawing" aria-pressed="true">도면 분해도</button><button type="button" data-furnace-source="photo" aria-pressed="false" hidden disabled>현장 사진 구성</button>${documents.map(record => `<button type="button" data-furnace-document="${record.id}">${record.title} <span aria-hidden="true">↗</span></button>`).join('')}</div>
      <button type="button" class="furnace-close" aria-label="버너 분해도 닫기">닫기 <span aria-hidden="true">×</span></button>
    </header>
    <div class="furnace-layout">
      <section class="furnace-visual" aria-label="버너 3D 구성 분해도">
        <div class="furnace-viewbar"><div class="furnace-segments" role="group" aria-label="버너 조립 상태"><button type="button" data-furnace-mode="assembled">조립도</button><button type="button" data-furnace-mode="exploded" aria-pressed="true">분해도</button></div><div class="furnace-segments fd-only" role="group" aria-label="도면 시점">${[['iso', '입체'], ['front', '정면'], ['top', '평면'], ['side', '측면']].map(([key, name]) => `<button type="button" data-furnace-view="${key}" aria-pressed="${key === 'iso'}">${name}</button>`).join('')}</div><span class="furnace-viewbar-gap"></span><label class="fd-toggle fd-only"><input type="checkbox" data-furnace-toggle="numbers" checked>번호</label><label class="fd-toggle fd-only"><input type="checkbox" data-furnace-toggle="dimensions" checked>치수</label><button class="furnace-reset" type="button">시점 초기화 ↺</button></div>
        <div class="furnace-stage"><canvas tabindex="0" aria-label="버너 3D. 더블클릭 또는 두 번 탭한 지점 확대, 커서 위치에서 휠 확대·축소. 드래그로 회전하고 우클릭·가운데 버튼·Shift 드래그로 이동합니다. 평면은 드래그로 이동, 두 손가락은 이동·확대입니다. R 또는 시점 초기화로 복귀합니다. 오른쪽 구성 번호로 부위를 선택하세요."></canvas><div class="furnace-markers"></div><svg class="fd-lines" aria-hidden="true"></svg><div class="fd-balloons"></div><span class="fd-hover" hidden></span><p class="furnace-fallback" hidden>3D 화면을 사용할 수 없습니다. 오른쪽 구성과 원도면을 확인해 주세요.</p><div class="furnace-stage-note"><span class="furnace-status">EXPLODED VIEW</span><span class="furnace-hint">두 번 눌러 확대 · 우클릭 이동 · 휠 줌</span></div></div>
        <div class="furnace-slider"><label for="furnace-spread">구성 분리 <output id="furnace-percent">100%</output></label><input id="furnace-spread" type="range" min="0" max="100" value="100" aria-label="버너 분해 간격"><span>조립</span><span>분해</span></div>
      </section>
      <aside class="furnace-sidebar">
        <div class="fd-side">
          <div class="fd-head"><h3>도면 부품표 <span>번호 ${bomParts.length}종 · 문자 ${DRAWING_PARTS.length - bomParts.length}종</span></h3><p>숫자는 도면 풍선 번호, 문자는 도면에 번호가 없어 새로 붙인 표시입니다.</p><p class="fd-legend">${Object.values(FIELD_STATUS).map(({ label, tone }) => `<span><i class="fd-dot ${tone}"></i>${label}</span>`).join('')}</p>
            <div class="fd-chips" role="group" aria-label="부품 묶음"><button type="button" data-fd-filter="all" aria-pressed="true">전체</button>${DRAWING_GROUPS.map(({ id, name }) => `<button type="button" data-fd-filter="${id}" aria-pressed="false">${name}</button>`).join('')}<button type="button" class="is-warn" data-fd-filter="differs" aria-pressed="false">현장 다름 ${differing.length}</button></div></div>
          <div class="fd-list" role="group" aria-label="도면 부품 선택"></div>
          <section class="fd-detail" aria-live="polite" aria-label="선택 부품 정보"></section>
        </div>
        <div class="furnace-photo-side" hidden>
        <div class="furnace-sideheading"><h3>주요 구성 <span>06</span></h3><p>번호를 누르면 실제 사진과 함께 확인합니다.</p></div>
        <div class="furnace-parts" role="group" aria-label="버너 구성 선택">${furnaceParts.map((part, i) => `<button type="button" data-furnace-part="${i + 1}" aria-pressed="false"><span>${String(i + 1).padStart(2, '0')}</span><strong>${part.name}</strong><i aria-hidden="true">↗</i></button>`).join('')}</div>
        <section class="furnace-evidence" aria-label="선택 구성의 현장 사진"><div class="furnace-evidence-title"><span>현장 사진</span><button type="button" class="furnace-photo-reset">전체 보기</button></div><button type="button" class="furnace-photo-button" aria-label="현장 사진 확대"><img alt="버너 전면 현장 사진"></button><div class="furnace-photo-copy"><h4>버너 전면</h4><p>상부 덕트, 사각 본체와 전면 송풍부 2대의 전체 구성을 확인합니다.</p><small>2026.11.04 촬영 · 20261104_110523.jpg</small></div></section>
        <button type="button" class="furnace-control-photo">별도 사진 · 버너 제어함 <span>↗</span></button>
        </div>
      </aside>
    </div>
    <footer class="furnace-footer"><p><strong>${FOOTERS.drawing[0]}</strong><span>${FOOTERS.drawing[1]}</span></p><span class="furnace-photo-count">${FOOTERS.drawing[2]}</span></footer>
    <div class="furnace-lightbox" hidden><div class="fd-zoom" role="group" aria-label="도면 확대" hidden><button type="button" data-fd-zoom="-1" aria-label="축소">−</button><output>100%</output><button type="button" data-fd-zoom="1" aria-label="확대">+</button><button type="button" data-fd-zoom="0">맞춤</button></div><button type="button" class="furnace-lightbox-close">닫기 ×</button><div class="furnace-lightbox-view"><img alt="버너 현장 사진 확대"></div></div>`;
  document.body.append(dialog);
  const $ = (selector) => dialog.querySelector(selector);
  dialog.querySelectorAll('[data-furnace-document]').forEach(button => button.addEventListener('click', () => maintenance.open(button.dataset.furnaceDocument)));
  const canvas = $('canvas');
  let renderer, world, camera, modelRoot, observer, frame, previousFocus, plinth, grid, drawing;
  let spread = 1, amount = 1, dragging = null, disposed = false;
  let mode = 'drawing', selected = null, filter = 'all', orbitGoal = null, hoverFrame = null;
  let showNumbers = true, showDimensions = true, stageWidth = 0, stageHeight = 0, toolbarBottom = 72, zoom = 1, lastFrame = 0;
  const orbits = { drawing: { ...ORBIT_DEFAULTS.drawing }, photo: { ...ORBIT_DEFAULTS.photo } };
  const panOffsets = { drawing: new THREE.Vector3(), photo: new THREE.Vector3() };
  let orbit = orbits.drawing;
  const target = new THREE.Vector3();
  const PHOTO_TARGET = new THREE.Vector3(.5, 3.8, .3);
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2(), scratch = new THREE.Vector3();
  const svgNamespace = 'http://www.w3.org/2000/svg';
  const sheetImages = new Map(), balloons = new Map();
  const partRecords = [];
  const markers = [];
  const geometrySet = new Set(), materialSet = new Set();
  const service = presentation ? null : createBurnerService({
    dialog,
    onOpen: () => open(),
    onSelectPart: id => { setFilter('all'); selectDrawingPart(id); },
    onShowDrawing: () => { resize(); schedule(); },
  });

  function material(color, roughness = .48, metalness = .45, extras = {}) {
    const value = new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extras });
    materialSet.add(value); return value;
  }
  function initScene() {
    if (renderer) return;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    world = new THREE.Scene();
    world.background = new THREE.Color('#eef2f5');
    camera = new THREE.PerspectiveCamera(30, 1, .02, 300);
    world.add(new THREE.HemisphereLight(0xf2f8ff, 0x87929e, 2.6));
    const key = new THREE.DirectionalLight(0xfff8ec, 3.3); key.position.set(-7, 12, 10); world.add(key);
    const fill = new THREE.DirectionalLight(0xd9eaff, 2.2); fill.position.set(8, 6, -5); world.add(fill);
    modelRoot = new THREE.Group(); world.add(modelRoot);
    const adapter = {
      THREE,
      mat: { steel: material(0xb9c3cb, .38, .72), trim: material(0x78848e, .42, .7), dark: material(0x3c4956), yellow: material(0xe6bd35, .4, .35), red: material(0xe76f2f, .38, .35), motor: material(0x354859), white: material(0xf7fafb, .55, .1), black: material(0x202b35), mint: material(0x588476) },
      _material: material,
      _group(parent, position = [0, 0, 0]) { const g = new THREE.Group(); g.position.set(...position); parent.add(g); return g; },
      _mesh(geometry, mat, parent, position = [0, 0, 0]) { const mesh = new THREE.Mesh(geometry, mat); mesh.position.set(...position); parent.add(mesh); geometrySet.add(geometry); return mesh; },
      _box(parent, size, pos, mat = this.mat.steel) { return this._mesh(new THREE.BoxGeometry(...size), mat, parent, pos); },
      _cyl(parent, radius, height, pos, mat = this.mat.steel, bottom = radius, segments = 48) { return this._mesh(new THREE.CylinderGeometry(radius, bottom, height, segments), mat, parent, pos); },
      _bar(parent, start, end, radius = .045, mat = this.mat.trim) { const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end); const mesh = this._cyl(parent, radius, a.distanceTo(b), a.clone().add(b).multiplyScalar(.5).toArray(), mat, radius, 12); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize()); return mesh; },
      _ring(parent, radius, y, mat = this.mat.trim, thickness = .035) { const mesh = this._mesh(new THREE.TorusGeometry(radius, thickness, 8, 64), mat, parent, [0, y, 0]); mesh.rotation.x = Math.PI / 2; return mesh; },
      _part(root, name, offset, position = [0, 0, 0]) { const group = this._group(root, position); partRecords.push({ group, name, home: group.position.clone(), offset: new THREE.Vector3(...offset) }); return group; },
    };
    buildFurnace(adapter, modelRoot);
    plinth = adapter._box(world, [14, .08, 9], [.6, -.12, .5], material(0xe2e8ed, .95, .02));
    plinth.name = 'display-plinth';
    drawing = createDrawingModel();
    world.add(drawing.root);
    grid = new THREE.GridHelper(13, 26, 0xc4d0d8, 0xdbe3e9);
    grid.position.set(-.8, -.425, .4);
    world.add(grid);
    buildBalloons();
    for (let i = 0; i < 6; i++) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'furnace-marker'; button.textContent = String(i + 1).padStart(2, '0');
      button.setAttribute('aria-label', `${i + 1}. ${furnaceParts[i].name}`); button.addEventListener('click', () => selectPart(i + 1)); $('.furnace-markers').append(button); markers.push(button);
    }
    observer = new ResizeObserver(resize); observer.observe($('.furnace-stage'));
    resize();
  }
  function resize() {
    if (!renderer || !dialog.open) return;
    const rect = $('.furnace-stage').getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    stageWidth = rect.width; stageHeight = rect.height;
    const toolbar = $('.furnace-viewbar');
    toolbarBottom = toolbar.offsetTop + toolbar.offsetHeight + 16;
    renderer.setSize(rect.width, rect.height, false); camera.aspect = rect.width / rect.height; camera.updateProjectionMatrix();
    $('.fd-lines').setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`); draw();
  }
  function draw() {
    if (!renderer || !dialog.open) return;
    const narrow = camera.aspect < .85;
    const isDrawing = mode === 'drawing';
    if (isDrawing) target.lerpVectors(DRAWING_TARGET.assembled, DRAWING_TARGET.exploded, amount); else target.copy(PHOTO_TARGET);
    if (presentation && isDrawing) target.y += .2;
    target.add(panOffsets[mode]);
    // The drawing is wide: on a squarer stage the camera backs off to keep the inlet in view.
    const distance = isDrawing ? orbit.distance * Math.max(1, 1.62 / camera.aspect) * (.74 + amount * .26) : orbit.distance * (narrow ? 1.35 : 1);
    camera.position.set(target.x + Math.sin(orbit.azimuth) * Math.cos(orbit.elevation) * distance, target.y + Math.sin(orbit.elevation) * distance, target.z + Math.cos(orbit.azimuth) * Math.cos(orbit.elevation) * distance);
    camera.lookAt(target);
    const far = Math.max(300, distance * 3 + 30);
    if (camera.far !== far) { camera.far = far; camera.updateProjectionMatrix(); }
    camera.updateMatrixWorld(true);
    if (isDrawing) drawing.setExplode(amount, orbit.elevation > .9);
    else for (const part of partRecords) part.group.position.copy(part.home).addScaledVector(part.offset, amount);
    world.updateMatrixWorld(true);
    if (isDrawing) { layoutOverlay(); renderer.render(world, camera); return; }
    const rect = canvas.getBoundingClientRect();
    partRecords.forEach((part, index) => {
      const anchor = new THREE.Vector3(...(part.group.userData.labelAnchor || [0, 0, 0]));
      part.group.localToWorld(anchor); anchor.project(camera);
      const marker = markers[index]; if (!marker) return;
      marker.style.left = `${(anchor.x * .5 + .5) * rect.width}px`;
      marker.style.top = `${(-anchor.y * .5 + .5) * rect.height}px`;
      marker.hidden = anchor.z > 1 || anchor.z < -1;
    });
    renderer.render(world, camera);
  }
  function animate(now = performance.now()) {
    if (!dialog.open || disposed || document.hidden) { frame = null; lastFrame = 0; return; }
    const elapsed = Math.min(.25, (now - (lastFrame || now - 16)) / 1000);
    lastFrame = now;
    amount += (spread - amount) * (1 - Math.exp(-elapsed * 8));
    if (Math.abs(spread - amount) < .004) amount = spread;
    if (orbitGoal) {
      let turning = false;
      for (const key of ['azimuth', 'elevation']) {
        orbit[key] += (orbitGoal[key] - orbit[key]) * (1 - Math.exp(-elapsed * 11));
        if (Math.abs(orbitGoal[key] - orbit[key]) < .004) orbit[key] = orbitGoal[key]; else turning = true;
      }
      if (!turning) orbitGoal = null;
    }
    draw();
    const moving = amount !== spread || orbitGoal;
    frame = moving ? requestAnimationFrame(animate) : null;
    if (!moving) lastFrame = 0;
  }
  function schedule() { if (!frame && dialog.open && !document.hidden) frame = requestAnimationFrame(animate); }
  function setSpread(value) {
    spread = Math.max(0, Math.min(1, value));
    $('#furnace-spread').value = Math.round(spread * 100);
    $('#furnace-percent').textContent = `${Math.round(spread * 100)}%`;
    $('#furnace-spread').setAttribute('aria-valuetext', `${Math.round(spread * 100)}% 분해`);
    $('.furnace-status').textContent = spread ? 'EXPLODED VIEW' : 'ASSEMBLED VIEW';
    syncDimensionToggle();
    dialog.querySelectorAll('[data-furnace-mode]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.furnaceMode === 'exploded') === (spread > 0))));
    schedule();
  }
  function showPhoto(key, title, text, source) {
    if (!furnacePhotos[key]) { $('.furnace-photo-button').hidden = true; $('.furnace-photo-button img').removeAttribute?.('src'); return; }
    $('.furnace-photo-button img').src = assetUrl(key);
    $('.furnace-photo-button img').alt = `${title} 현장 사진`;
    $('.furnace-photo-copy h4').textContent = title;
    $('.furnace-photo-copy p').textContent = text;
    $('.furnace-photo-copy small').textContent = `2026.11.04 촬영 · ${source}`;
  }
  function selectPart(number) {
    dialog.querySelectorAll('[data-furnace-part]').forEach((button) => button.setAttribute('aria-pressed', String(Number(button.dataset.furnacePart) === number)));
    markers.forEach((marker, i) => marker.classList.toggle('active', i + 1 === number));
    const part = furnaceParts[number - 1];
    if (part) showPhoto(part.photo, part.name, part.text, part.source);
    else showPhoto('overview', '버너 전면', '상부 덕트, 사각 본체와 전면 송풍부 2대의 전체 구성을 확인합니다.', '20261104_110523.jpg');
    draw();
  }
  function reset() { cancelGesture(); orbitGoal = null; panOffsets[mode].set(0, 0, 0); Object.assign(orbit, ORBIT_DEFAULTS[mode]); markView('iso'); draw(); }
  function markView(key) { dialog.querySelectorAll('[data-furnace-view]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.furnaceView === key))); }
  function setMode(next) {
    cancelGesture();
    mode = 'drawing';
    const isDrawing = mode === 'drawing';
    dialog.classList.toggle('is-drawing', isDrawing);
    dialog.querySelectorAll('[data-furnace-source]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.furnaceSource === mode)));
    $('.furnace-subtitle').textContent = SUBTITLES[mode];
    const [title, note, count] = FOOTERS[mode];
    $('.furnace-footer strong').textContent = title;
    $('.furnace-footer p span').textContent = note;
    $('.furnace-photo-count').textContent = count;
    $('.fd-side').hidden = !isDrawing;
    $('.furnace-photo-side').hidden = isDrawing;
    $('.furnace-hint').textContent = '두 번 눌러 확대 · 우클릭 이동 · 휠 줌';
    orbit = orbits[mode]; orbitGoal = null;
    amount = spread;
    if (renderer) {
      modelRoot.visible = plinth.visible = !isDrawing;
      drawing.root.visible = grid.visible = isDrawing;
      camera.fov = isDrawing ? 30 : 36;
      camera.updateProjectionMatrix();
    }
    $('.fd-lines').style.display = $('.fd-balloons').style.display = isDrawing ? '' : 'none';
    $('.furnace-markers').style.display = isDrawing ? 'none' : '';
    hideHover();
    resize();
    draw();
  }

  // Drawing mode: balloons, leaders, printed dimensions and the parts list.
  function buildBalloons() {
    for (const part of DRAWING_PARTS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `fd-balloon${part.basis === 'bom' ? '' : ' is-extra'}${part.field?.status === 'differs' ? ' is-warn' : ''}`;
      button.textContent = part.id;
      button.setAttribute('aria-label', `${part.id}. ${part.name}`);
      button.title = part.name;
      button.addEventListener('click', () => selectDrawingPart(part.id));
      $('.fd-balloons').append(button);
      const leader = document.createElementNS(svgNamespace, 'line');
      leader.setAttribute('class', 'fd-leader');
      $('.fd-lines').append(leader);
      balloons.set(part.id, { part, button, leader, x: 0, y: 0, anchorX: 0, anchorY: 0 });
    }
    const tag = document.createElement('span');
    tag.className = 'fd-tag'; tag.textContent = `${FLOW_TAG.label} →`;
    $('.fd-balloons').append(tag);
    balloons.tag = tag;
    balloons.dimensions = DIMENSION_LINES.map(({ label }) => {
      const path = document.createElementNS(svgNamespace, 'path'), text = document.createElementNS(svgNamespace, 'text');
      path.setAttribute('class', 'fd-dimension'); text.setAttribute('class', 'fd-dimension-text'); text.textContent = label;
      $('.fd-lines').append(path, text);
      return { path, text };
    });
  }
  const inFilter = (part) => filter === 'all' || (filter === 'differs' ? part.field?.status === 'differs' : part.group === filter);
  function project(point, into) {
    scratch.copy(point).project(camera);
    into.x = (scratch.x * .5 + .5) * stageWidth;
    into.y = (-scratch.y * .5 + .5) * stageHeight;
    return scratch.z < 1;
  }
  const projected = { x: 0, y: 0 }, ends = [{ x: 0, y: 0 }, { x: 0, y: 0 }], sight = new THREE.Vector3();
  function layoutOverlay() {
    const items = [];
    const keepClear = 13;
    for (const item of balloons.values()) {
      const { part, button, leader } = item;
      const record = drawing.records.get(part.id);
      const shown = showNumbers && (inFilter(part) || selected === part.id) && !(part.id === 'X' && amount > .4);
      if (!shown) { button.style.display = 'none'; leader.style.display = 'none'; continue; }
      project(drawing.anchorOf(part.id, new THREE.Vector3()), projected);
      item.anchorX = projected.x; item.anchorY = projected.y;
      item.x = projected.x + record.lead[0]; item.y = projected.y + record.lead[1];
      items.push(item);
    }
    // Spread balloons apart so that close parts stay readable and clickable.
    for (let pass = 0; pass < 10; pass++) {
      for (let a = 0; a < items.length; a++) {
        for (let b = a + 1; b < items.length; b++) {
          const dx = items[b].x - items[a].x, dy = items[b].y - items[a].y;
          const distance = Math.hypot(dx, dy) || 1;
          if (distance >= 27) continue;
          const push = (27 - distance) / 2, ux = dx / distance, uy = dy / distance;
          items[a].x -= ux * push; items[a].y -= uy * push;
          items[b].x += ux * push; items[b].y += uy * push;
        }
      }
    }
    for (const item of items) {
      const x = Math.max(keepClear, Math.min(stageWidth - keepClear, item.x)), y = Math.max(toolbarBottom, Math.min(stageHeight - keepClear, item.y));
      item.button.style.display = '';
      item.button.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%)`;
      item.button.classList.toggle('active', selected === item.part.id);
      item.leader.style.display = '';
      item.leader.setAttribute('x1', item.anchorX); item.leader.setAttribute('y1', item.anchorY);
      item.leader.setAttribute('x2', x); item.leader.setAttribute('y2', y);
      item.leader.classList.toggle('active', selected === item.part.id);
    }
    const inlet = drawing.records.get('1').pieces[0].group;
    scratch.set(-70, 0, 0);
    inlet.localToWorld(scratch);
    project(scratch.clone(), projected);
    balloons.tag.style.transform = `translate(${Math.max(balloons.tag.offsetWidth + 6, projected.x)}px,${projected.y + 22}px) translate(-100%,-50%)`;
    const dimensionsOn = showDimensions && amount < .03;
    camera.getWorldDirection(sight);
    DIMENSION_LINES.forEach(({ from, to, at = .5 }, index) => {
      const { path, text } = balloons.dimensions[index];
      project(new THREE.Vector3(...from).multiplyScalar(.001), ends[0]);
      project(new THREE.Vector3(...to).multiplyScalar(.001), ends[1]);
      const [a, b] = ends, dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy);
      // A dimension seen nearly end-on says nothing, so it steps aside.
      const run = scratch.set(to[0] - from[0], to[1] - from[1], to[2] - from[2]).normalize();
      const visible = dimensionsOn && length > 34 && Math.abs(run.dot(sight)) < .8;
      path.style.display = text.style.display = visible ? '' : 'none';
      if (!visible) return;
      const tickX = -dy / length * 5, tickY = dx / length * 5;
      path.setAttribute('d', `M${a.x} ${a.y}L${b.x} ${b.y}M${a.x - tickX} ${a.y - tickY}L${a.x + tickX} ${a.y + tickY}M${b.x - tickX} ${b.y - tickY}L${b.x + tickX} ${b.y + tickY}`);
      text.setAttribute('x', a.x + dx * at); text.setAttribute('y', a.y + dy * at - 5);
    });
  }
  function syncDimensionToggle() {
    const control = $('[data-furnace-toggle="dimensions"]');
    control.disabled = spread > 0;
    control.closest('label').classList.toggle('is-off', spread > 0);
  }
  function renderList() {
    const list = $('.fd-list');
    const rows = (parts) => parts.map((part) => {
      const status = part.field && FIELD_STATUS[part.field.status];
      return `<button type="button" class="fd-row" data-fd-part="${part.id}" aria-pressed="${selected === part.id}"><span class="fd-no${part.basis === 'bom' ? '' : ' is-extra'}">${part.id}</span><span class="fd-name"><strong>${part.name}</strong><small>${part.size}${part.maker.includes('미기재') || part.maker.includes('도면') ? '' : ` · ${part.maker}`}</small></span>${status ? `<i class="fd-dot ${status.tone}" title="${status.label}"></i>` : ''}</button>`;
    }).join('');
    if (filter === 'differs') { list.innerHTML = `<p class="fd-group">도면과 현장 명판이 다른 부품</p>${rows(differing)}`; return; }
    list.innerHTML = DRAWING_GROUPS.filter(({ id }) => filter === 'all' || id === filter).map(({ id, name, hint }) => `<p class="fd-group">${name} <small>${hint}</small></p>${rows(DRAWING_PARTS.filter((part) => part.group === id))}`).join('');
  }
  const chip = (id) => `<button type="button" class="fd-chip" data-fd-part="${id}" aria-label="${PART_BY_ID[id].name}">${id}</button>`;
  function renderDetail() {
    const detail = $('.fd-detail'), part = PART_BY_ID[selected];
    detail.scrollTop = 0;
    if (!part) {
      detail.innerHTML = `<div class="fd-title"><div><h4>${DRAWING_INFO.model} · ${DRAWING_INFO.capacity}</h4><small>${DRAWING_INFO.project}</small></div></div>
        <p class="fd-meta">${DRAWING_INFO.maker} · ${DRAWING_INFO.customer} · ${DRAWING_INFO.date} · 축척 ${DRAWING_INFO.scale}</p>
        <div class="fd-path"><span>가스 흐름</span><p>${GAS_PATH.map(chip).join('<i>→</i>')}</p></div>
        <div class="fd-path"><span>파일럿</span><p>${PILOT_PATH.map(chip).join('<i>→</i>')}</p></div>
        <p class="fd-field warn"><strong>도면과 현장이 다른 부품 ${differing.length}건</strong>${differing.map(({ id, name }) => `${id}번 ${name}`).join(', ')}. 부품을 눌러 기록된 명판 정보를 확인하세요.</p>
        <div class="fd-sheets">${Object.entries(DRAWING_SHEETS).map(([key, { short }]) => `<button type="button" data-fd-sheet="${key}">${short} <span aria-hidden="true">↗</span></button>`).join('')}</div>`;
      return;
    }
    const status = part.field && FIELD_STATUS[part.field.status];
    detail.innerHTML = `<div class="fd-title"><span class="fd-no${part.basis === 'bom' ? '' : ' is-extra'}">${part.id}</span><div><h4>${part.name}</h4><small>${part.original}</small></div><button type="button" class="fd-clear" aria-label="선택 해제">×</button></div>
      <dl class="fd-spec"><div><dt>규격</dt><dd>${part.size}</dd></div><div><dt>제조사</dt><dd>${part.maker}</dd></div><div><dt>위치</dt><dd>${part.place}</dd></div></dl>
      <p class="fd-role">${part.role}</p>
      ${status ? `<p class="fd-field ${status.tone}"><strong>${status.label}</strong>${part.field.text}</p>` : ''}
      ${service ? `<button type="button" class="bs-part-link" data-service-part="${part.id}">교체 주기·업체 연락처 관리 <span aria-hidden="true">→</span></button>` : ''}
      <div class="fd-evidence">${part.sheet ? `<button type="button" class="fd-crop" data-fd-sheet="${part.sheet.key}" aria-label="${part.name} 도면 위치 크게 보기"><canvas width="340" height="230"></canvas><span>도면 위치 ↗</span></button>` : ''}</div>
      <p class="fd-basis">근거 · ${BASIS[part.basis].label}: ${BASIS[part.basis].note}</p>`;
    if (part.sheet) paintCrop(detail.querySelector('canvas'), part.sheet);
  }
  function loadSheet(key) {
    if (!sheetImages.has(key)) {
      const image = new Image();
      sheetImages.set(key, new Promise((resolve, reject) => { image.onload = () => resolve(image); image.onerror = reject; image.src = assetUrl(sheetKey(key)); }));
    }
    return sheetImages.get(key);
  }
  async function paintCrop(target, { key, x, y, w }) {
    const image = await loadSheet(key).catch(() => null);
    if (!image) return;
    const context = target.getContext('2d');
    const width = w * image.width, height = width * target.height / target.width;
    context.fillStyle = '#fff';
    context.fillRect(0, 0, target.width, target.height);
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, x * image.width - width / 2, y * image.height - height / 2, width, height, 0, 0, target.width, target.height);
  }
  function selectDrawingPart(id) {
    selected = id && PART_BY_ID[id] ? id : null;
    drawing?.setHighlight(selected);
    $('.fd-side').classList.toggle('has-selection', Boolean(selected));
    dialog.querySelectorAll('.fd-row').forEach((row) => {
      const active = row.dataset.fdPart === selected;
      row.setAttribute('aria-pressed', String(active));
      if (active) row.scrollIntoView({ block: 'nearest' });
    });
    renderDetail();
    service?.selectPart(selected);
    draw();
  }
  function setFilter(next) {
    filter = next;
    dialog.querySelectorAll('[data-fd-filter]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.fdFilter === filter)));
    renderList();
    draw();
  }
  function hideHover() { const hover = $('.fd-hover'); hover.hidden = true; canvas.style.cursor = ''; }
  function partAt(event) {
    const rect = canvas.getBoundingClientRect();
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    return drawing.pick(raycaster);
  }
  function updateHover(event) {
    const id = partAt(event), hover = $('.fd-hover');
    canvas.style.cursor = id ? 'pointer' : '';
    hover.hidden = !id;
    if (!id) return;
    const rect = canvas.getBoundingClientRect();
    hover.textContent = `${id} · ${PART_BY_ID[id].name}`;
    hover.style.transform = `translate(${event.clientX - rect.left + 14}px,${event.clientY - rect.top + 12}px)`;
  }
  function navigationPoint(event) {
    const rect = canvas.getBoundingClientRect();
    if (!camera || !(rect.width > 0 && rect.height > 0) || !Number.isFinite(event?.clientX) || !Number.isFinite(event?.clientY)) return null;
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    camera.updateMatrixWorld(true);
    raycaster.setFromCamera(pointer, camera);
    const root = mode === 'drawing' ? drawing.root : modelRoot, surfaces = [];
    root.updateMatrixWorld(true);
    root.traverseVisible((object) => {
      if (!object.isMesh) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      if (materials.every((mat) => mat?.visible === false || (mat?.transparent && mat.opacity < .15))) return;
      surfaces.push(object);
    });
    const hit = raycaster.intersectObjects(surfaces, false)[0];
    if (hit) return hit.point.clone();
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), target);
    return raycaster.ray.intersectPlane(plane, new THREE.Vector3());
  }
  function zoomCamera(factor, event, center = false) {
    if (!renderer || !Number.isFinite(factor) || factor <= 0 || factor === 1) return;
    const point = navigationPoint(event), { near, far } = ORBIT_LIMITS[mode];
    const next = Math.max(near, Math.min(far, orbit.distance / factor)), ratio = next / orbit.distance;
    if (point) panOffsets[mode].addScaledVector(point.sub(target), center ? 1 : 1 - ratio);
    orbit.distance = next; orbitGoal = null; hideHover(); draw();
  }
  function panCamera(dx, dy) {
    const rect = canvas.getBoundingClientRect();
    if (!renderer || !(rect.height > 0) || !Number.isFinite(dx) || !Number.isFinite(dy)) return;
    const scale = 2 * camera.position.distanceTo(target) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / rect.height;
    panOffsets[mode].addScaledVector(new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), -dx * scale);
    panOffsets[mode].addScaledVector(new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1), dy * scale);
    orbitGoal = null; hideHover(); draw();
  }
  function showLightbox(source, alt, sheet = null) {
    if (!source) return;
    const box = $('.furnace-lightbox'), image = $('.furnace-lightbox img'), view = $('.furnace-lightbox-view');
    box.classList.toggle('is-sheet', Boolean(sheet));
    $('.fd-zoom').hidden = !sheet;
    image.alt = alt;
    box.hidden = false;
    zoom = sheet?.w ? 2.4 : 1;
    image.onload = () => { applyZoom(); if (sheet?.w) { view.scrollLeft = sheet.x * image.offsetWidth - view.clientWidth / 2; view.scrollTop = sheet.y * image.offsetHeight - view.clientHeight / 2; } };
    image.src = source;
    $('.furnace-lightbox-close').focus();
  }
  function applyZoom() {
    const box = $('.furnace-lightbox'), image = $('.furnace-lightbox img');
    image.style.width = box.classList.contains('is-sheet') ? `${zoom * 100}%` : '';
    $('.fd-zoom output').textContent = `${Math.round(zoom * 100)}%`;
  }
  function changeZoom(factor, anchorX = .5, anchorY = .5) {
    const view = $('.furnace-lightbox-view');
    const centerX = (view.scrollLeft + view.clientWidth * anchorX) / view.scrollWidth, centerY = (view.scrollTop + view.clientHeight * anchorY) / view.scrollHeight;
    zoom = factor ? Math.max(1, Math.min(6, zoom * factor)) : 1;
    applyZoom();
    view.scrollLeft = centerX * view.scrollWidth - view.clientWidth * anchorX;
    view.scrollTop = centerY * view.scrollHeight - view.clientHeight * anchorY;
  }
  let notifyClose = true;
  function close({ notify = true } = {}) { maintenance?.close(); cancelGesture(); if (dialog.open) { notifyClose = notify; dialog.close(); } }
  function open({ spread: initialSpread = 1 } = {}) {
    if (disposed) return;
    if (dialog.open) return;
    previousFocus = document.activeElement;
    dialog.showModal();
    try { initScene(); $('.furnace-fallback').hidden = true; }
    catch (error) { console.error('Furnace view unavailable:', error); renderer?.dispose(); renderer = null; $('.furnace-fallback').hidden = false; }
    filter = 'all'; selected = null;
    dialog.querySelectorAll('[data-fd-filter]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.fdFilter === 'all')));
    Object.assign(orbits.drawing, ORBIT_DEFAULTS.drawing); Object.assign(orbits.photo, ORBIT_DEFAULTS.photo);
    if (presentation) orbits.drawing.distance = 9.5;
    panOffsets.drawing.set(0, 0, 0); panOffsets.photo.set(0, 0, 0);
    const initial = Number.isFinite(initialSpread) ? Math.max(0, Math.min(1, initialSpread)) : 1;
    selectPart(0); setSpread(initial); amount = initial;
    if (presentation) {
      showNumbers = false; showDimensions = false;
      dialog.querySelectorAll('[data-furnace-toggle]').forEach(input => { input.checked = false; });
    }
    renderList(); selectDrawingPart(null); setMode('drawing'); markView('iso'); schedule();
    service?.open();
    $('.furnace-close').focus();
  }
  $('.furnace-close').addEventListener('click', close);
  dialog.addEventListener('close', () => { service?.close(); cancelGesture(); cancelAnimationFrame(frame); frame = null; $('.furnace-lightbox').hidden = true; previousFocus?.focus?.(); const notify = notifyClose; notifyClose = true; if (notify) onClose(); });
  dialog.addEventListener('click', (event) => { if (event.target === dialog) close(); });
  dialog.addEventListener('cancel', (event) => { if (!$('.furnace-lightbox').hidden) { event.preventDefault(); $('.furnace-lightbox').hidden = true; $('.furnace-photo-button').focus(); } });
  $('#furnace-spread').addEventListener('input', (event) => setSpread(Number(event.target.value) / 100));
  dialog.querySelectorAll('[data-furnace-mode]').forEach((button) => button.addEventListener('click', () => setSpread(button.dataset.furnaceMode === 'exploded' ? 1 : 0)));
  dialog.querySelectorAll('[data-furnace-part]').forEach((button) => button.addEventListener('click', () => selectPart(Number(button.dataset.furnacePart))));
  $('.furnace-reset').addEventListener('click', reset);
  $('.furnace-photo-reset').addEventListener('click', () => selectPart(0));
  $('.furnace-control-photo').addEventListener('click', () => { selectPart(0); showPhoto('control', '버너 제어함', '사진 속 「버너컨트롤」 표기와 제어기·단자대를 확인합니다. 설치 위치는 별도 확인이 필요합니다.', '20261104_110809.jpg'); });
  $('.furnace-photo-button').addEventListener('click', () => { const source = $('.furnace-photo-button img'); showLightbox(source.src, source.alt); });
  dialog.querySelectorAll('[data-furnace-source]').forEach((button) => button.addEventListener('click', () => setMode(button.dataset.furnaceSource)));
  dialog.querySelectorAll('[data-furnace-view]').forEach((button) => button.addEventListener('click', () => { orbitGoal = VIEW_PRESETS[button.dataset.furnaceView]; markView(button.dataset.furnaceView); schedule(); }));
  dialog.querySelectorAll('[data-furnace-toggle]').forEach((input) => input.addEventListener('change', () => { if (input.dataset.furnaceToggle === 'numbers') showNumbers = input.checked; else showDimensions = input.checked; draw(); }));
  dialog.querySelectorAll('[data-fd-filter]').forEach((button) => button.addEventListener('click', () => setFilter(button.dataset.fdFilter)));
  $('.fd-side').addEventListener('click', (event) => {
    const control = event.target.closest('button');
    if (!control) return;
    if (control.classList.contains('fd-clear')) selectDrawingPart(null);
    else if (control.dataset.servicePart) service?.showEquipment(control.dataset.servicePart);
    else if (control.dataset.fdPart) selectDrawingPart(control.dataset.fdPart);
    else if (control.dataset.fdPhoto) showLightbox(assetUrl(control.dataset.fdPhoto), `${PART_BY_ID[selected]?.name ?? '버너'} 현장 사진`);
    else if (control.dataset.fdSheet) { const sheet = PART_BY_ID[selected]?.sheet; showLightbox(assetUrl(sheetKey(control.dataset.fdSheet)), `${DRAWING_SHEETS[control.dataset.fdSheet].title} 도면`, sheet?.key === control.dataset.fdSheet ? sheet : {}); }
  });
  dialog.querySelectorAll('[data-fd-zoom]').forEach((button) => button.addEventListener('click', () => changeZoom(Number(button.dataset.fdZoom) > 0 ? 1.35 : Number(button.dataset.fdZoom) < 0 ? 1 / 1.35 : 0)));
  const lightboxView = $('.furnace-lightbox-view');
  let panning = null;
  lightboxView.addEventListener('wheel', (event) => {
    if (!$('.furnace-lightbox').classList.contains('is-sheet')) return;
    event.preventDefault();
    const rect = lightboxView.getBoundingClientRect();
    changeZoom(Math.exp(-event.deltaY * .0016), (event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
  }, { passive: false });
  lightboxView.addEventListener('pointerdown', (event) => { if ($('.furnace-lightbox').classList.contains('is-sheet')) { panning = { x: event.clientX, y: event.clientY, left: lightboxView.scrollLeft, top: lightboxView.scrollTop }; lightboxView.setPointerCapture(event.pointerId); } });
  lightboxView.addEventListener('pointermove', (event) => { if (panning) { lightboxView.scrollLeft = panning.left - event.clientX + panning.x; lightboxView.scrollTop = panning.top - event.clientY + panning.y; } });
  for (const name of ['pointerup', 'pointercancel']) lightboxView.addEventListener(name, () => { panning = null; });
  $('.furnace-lightbox-close').addEventListener('click', () => { $('.furnace-lightbox').hidden = true; $('.furnace-photo-button').focus(); });
  const pointers = new Map();
  let multiTouch = false, lastTap = null, selectionTimer = null, lastTouchZoomAt = -Infinity;
  function cancelSelection() { if (selectionTimer !== null) clearTimeout(selectionTimer); selectionTimer = null; }
  function releasePointer(id) { if (canvas.hasPointerCapture?.(id)) canvas.releasePointerCapture(id); }
  function cancelGesture() {
    cancelSelection(); cancelAnimationFrame(hoverFrame); hoverFrame = null;
    const ids = [...pointers.keys()]; pointers.clear(); dragging = null; lastTap = null; multiTouch = false;
    ids.forEach(releasePointer);
  }
  canvas.style.touchAction = 'none';
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  canvas.addEventListener('pointerdown', (event) => {
    if (!renderer || (event.pointerType === 'mouse' && event.button > 2)) return;
    if (!pointers.size) multiTouch = false;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    canvas.setPointerCapture(event.pointerId); orbitGoal = null; hideHover();
    if (pointers.size > 1) { multiTouch = true; dragging = null; lastTap = null; cancelSelection(); return; }
    dragging = { x: event.clientX, y: event.clientY, travel: 0, button: event.button, shift: event.shiftKey, pan: mode === 'drawing' && orbit.elevation > 1.5 };
  });
  canvas.addEventListener('pointermove', (event) => {
    const previous = pointers.get(event.pointerId);
    if (previous) pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (previous && pointers.size === 2) {
      const other = [...pointers.entries()].find(([id]) => id !== event.pointerId)[1];
      const before = Math.hypot(previous.x - other.x, previous.y - other.y), after = Math.hypot(event.clientX - other.x, event.clientY - other.y);
      if (before && after) zoomCamera(after / before, { clientX: (previous.x + other.x) / 2, clientY: (previous.y + other.y) / 2 });
      panCamera((event.clientX - previous.x) / 2, (event.clientY - previous.y) / 2);
      return;
    }
    if (!dragging || !previous) {
      if (mode !== 'drawing' || !renderer || pointers.size || event.pointerType === 'touch' || hoverFrame) return;
      hoverFrame = requestAnimationFrame(() => { hoverFrame = null; if (dialog.open && !dragging) updateHover(event); });
      return;
    }
    const dx = event.clientX - dragging.x, dy = event.clientY - dragging.y;
    dragging.travel += Math.abs(dx) + Math.abs(dy);
    if (dragging.travel >= 6) { lastTap = null; cancelSelection(); }
    dragging.x = event.clientX; dragging.y = event.clientY;
    if (dragging.button === 2 || dragging.button === 1 || dragging.shift || event.shiftKey || dragging.pan) { panCamera(dx, dy); return; }
    orbit.azimuth -= dx * .008;
    orbit.elevation = Math.max(-.9, Math.min(ORBIT_LIMITS[mode].top, orbit.elevation + dy * .006));
    markView('');
    draw();
  });
  canvas.addEventListener('pointerleave', hideHover);
  function finishPointer(event, cancelled = false) {
    if (!pointers.has(event.pointerId)) return;
    const tap = !cancelled && !multiTouch && pointers.size === 1 && dragging?.button === 0 && dragging.travel < 6;
    pointers.delete(event.pointerId); releasePointer(event.pointerId);
    dragging = null;
    if (cancelled) { lastTap = null; cancelSelection(); return; }
    if (!tap) return;
    const now = event.timeStamp ?? performance.now();
    if (event.pointerType === 'touch' && lastTap && now - lastTap.time < 330 && Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) < 24) {
      cancelSelection(); lastTap = null; lastTouchZoomAt = now; zoomCamera(2.5, event, true);
    } else {
      lastTap = event.pointerType === 'touch' ? { time: now, x: event.clientX, y: event.clientY } : null;
      if (mode === 'drawing') {
        cancelSelection(); const id = partAt(event);
        selectionTimer = setTimeout(() => { selectionTimer = null; if (dialog.open && !disposed && mode === 'drawing') selectDrawingPart(id); }, 330);
      }
    }
  }
  canvas.addEventListener('pointerup', (event) => finishPointer(event));
  canvas.addEventListener('pointercancel', (event) => finishPointer(event, true));
  canvas.addEventListener('lostpointercapture', (event) => finishPointer(event, true));
  canvas.addEventListener('dblclick', (event) => {
    event.preventDefault(); cancelSelection();
    if ((event.timeStamp ?? performance.now()) - lastTouchZoomAt >= 400) zoomCamera(2.5, event, true);
  });
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault(); cancelSelection();
    const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? canvas.getBoundingClientRect().height : 1);
    zoomCamera(Math.exp(-Math.max(-600, Math.min(600, pixels)) * (event.ctrlKey ? .006 : .0015)), event);
  }, { passive: false });
  canvas.addEventListener('keydown', (event) => { if (presentation) return; if (event.key === 'ArrowLeft') orbit.azimuth -= .12; else if (event.key === 'ArrowRight') orbit.azimuth += .12; else if (event.key === 'ArrowUp') orbit.elevation = Math.min(ORBIT_LIMITS[mode].top, orbit.elevation + .1); else if (event.key === 'ArrowDown') orbit.elevation = Math.max(-.9, orbit.elevation - .1); else if (event.key.toLowerCase() === 'r') reset(); else return; event.preventDefault(); orbitGoal = null; draw(); });
  const resume = () => { if (dialog.open) schedule(); };
  document.addEventListener('visibilitychange', resume);
  function dispose() { service?.dispose(); maintenance?.dispose(); close(); disposed = true; cancelAnimationFrame(frame); cancelAnimationFrame(hoverFrame); observer?.disconnect(); document.removeEventListener('visibilitychange', resume); drawing?.dispose(); grid?.geometry.dispose(); grid?.material.dispose(); for (const geometry of geometrySet) geometry.dispose(); for (const mat of materialSet) mat.dispose(); renderer?.dispose(); dialog.remove(); }
  function setPresentationState({ spread: value = spread, partId = null, view = 'iso' } = {}) {
    if (!dialog.open || disposed) return false;
    if (Number.isFinite(value)) { setSpread(value); amount = spread; }
    if (VIEW_PRESETS[view]) { Object.assign(orbit, VIEW_PRESETS[view]); orbitGoal = null; markView(view); }
    const id = partId && PART_BY_ID[partId] ? partId : null;
    if (id !== selected) selectDrawingPart(id); else draw();
    return true;
  }
  return { open, close, dispose, setPresentationState };
}
