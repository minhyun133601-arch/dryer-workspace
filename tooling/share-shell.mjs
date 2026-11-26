import { spawnSync } from 'node:child_process';

const spaces = {
  site: { number: '01', kicker: 'HEECHANG MODELING', title: '희창유업 3D', copy: '공장 전경과 건조실·스틱소포장동·실외기실의 모델을 살펴보세요.', detail: '공장 전경 · 건물 · 설비 · 배치 편집', art: '<path d="M12 65V35l18 10V25l18 11V17h15v48H12M48 17V9h15M20 54h7m10 0h7m10-9h9m-9 10h9"/>' },
};

export function renderShareShell(viewers, bundled, { hosted = false } = {}) {
  const labels = Object.fromEntries(viewers.map(({ id, label }) => [id, label]));
  const tabs = [{ id: 'home', label: '메인' }, ...viewers].map(({ id, label }) => `<button id="tab-${id}" type="button" role="tab" aria-controls="${id === 'home' ? 'home-view' : `viewer-${id}`}" aria-selected="${id === 'home'}" data-viewer="${id}">${label}</button>`).join('');
  const cards = viewers.map(({ id, label }) => {
    const space = spaces[id];
    return `<button class="space-card" type="button" data-open-viewer="${id}" aria-label="${label} 열기"><span class="card-art" aria-hidden="true"><span class="card-number">${space.number}</span><svg viewBox="0 0 80 80">${space.art}</svg></span><span class="card-content"><span class="card-kicker">${space.kicker}</span><span class="card-title">${space.title}</span><span class="card-copy">${space.copy}</span><span class="card-detail">${space.detail}</span><span class="card-arrow" aria-hidden="true">↗</span></span></button>`;
  }).join('');
  const viewerDocuments = hosted ? Object.fromEntries(viewers.map(({ id }) => [id, `viewers/${id}.html`])) : bundled;
  const documents = JSON.stringify(viewerDocuments).replace(/</g, '\\u003c');
  const code = `
const documents = JSON.parse(document.getElementById('viewer-documents').textContent);
const hosted = ${hosted};
const tabs = [...document.querySelectorAll('[data-viewer]')];
const frames = new Map();
const labels = ${JSON.stringify(labels)};
let active = 'home';
function notify(frame) {
  frame.contentWindow?.postMessage({ type: 'dryer-workspace:visibility', active: !document.hidden && frame.dataset.viewer === active }, '*');
}
function show(viewer, focus = false) {
  if (viewer !== 'home' && !Object.hasOwn(documents, viewer)) return;
  active = viewer;
  document.getElementById('home-view').hidden = viewer !== 'home';
  document.getElementById('viewers').hidden = viewer === 'home';
  if (viewer !== 'home' && !frames.has(viewer)) {
    const frame = document.createElement('iframe');
    frame.dataset.viewer = viewer;
    frame.id = 'viewer-' + viewer;
    frame.title = labels[viewer];
    frame.setAttribute('role', 'tabpanel');
    frame.setAttribute('aria-labelledby', 'tab-' + viewer);
    frame.setAttribute('allow', 'fullscreen');
    frame.addEventListener('load', () => notify(frame));
    if (hosted) frame.src = documents[viewer];
    else frame.srcdoc = documents[viewer];
    frames.set(viewer, frame);
    document.getElementById('viewers').append(frame);
  }
  for (const [id, entry] of frames) { entry.hidden = id !== viewer; notify(entry); }
  for (const tab of tabs) {
    const selected = tab.dataset.viewer === viewer;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (focus && selected) tab.focus();
  }
  document.title = (viewer === 'home' ? '메인' : labels[viewer]) + ' · 희창유업 3D 작업실';
}
for (const tab of tabs) {
  tab.addEventListener('click', () => show(tab.dataset.viewer));
  tab.addEventListener('keydown', (event) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = tabs.indexOf(tab);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    show(tabs[next].dataset.viewer, true);
  });
}
for (const card of document.querySelectorAll('[data-open-viewer]')) card.addEventListener('click', () => show(card.dataset.openViewer, true));
window.addEventListener('message', (event) => {
  if (event.data?.type !== 'dryer-workspace:ready') return;
  for (const frame of frames.values()) if (event.source === frame.contentWindow) notify(frame);
});
document.addEventListener('visibilitychange', () => { for (const frame of frames.values()) notify(frame); });
document.getElementById('download-file').addEventListener('click', () => {
  const link = document.createElement('a');
  link.href = hosted ? new URL('downloads/dryer-workspace.zip', location.href).href : location.href;
  link.download = hosted ? '건조기-통합-공유.zip' : '건조기-통합-공유.html';
  link.click();
});
function selectedViewer() {
  const url = new URL(location.href);
  const requested = url.hash.replace(/^#\\/?/, '').split(/[/?]/)[0] || url.searchParams.get('viewer');
  return Object.hasOwn(documents, requested) ? requested : 'home';
}
window.addEventListener('hashchange', () => show(selectedViewer()));
show(selectedViewer());
`;
  const check = spawnSync(process.execPath, ['--check', '--input-type=module'], { input: code, encoding: 'utf8', windowsHide: true });
  if (check.status !== 0) throw new Error(check.stderr || 'Combined viewer syntax check failed.');
  return `<!doctype html>
<html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover"><meta name="theme-color" content="#f5f6f0"><meta name="robots" content="noindex,nofollow"><meta name="description" content="희창유업 공장 전경과 건조실·스틱소포장동·실외기실의 3D 모델을 살펴보세요."><title>메인 · 희창유업 3D 작업실</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Crect width='32' height='32' rx='8' fill='%23355f46'/%3E%3Cpath d='m6 11 10-5 10 5-10 5-10-5m0 6 10 5 10-5M6 23l10 5 10-5' fill='none' stroke='%23fff' stroke-width='2'/%3E%3C/svg%3E">
<style>
*{box-sizing:border-box}html,body{margin:0;height:100%;overflow:hidden}body{font-family:"Malgun Gothic","Apple SD Gothic Neo",system-ui,sans-serif;color:#345843;background:#f5f6f0}[hidden]{display:none!important}.shell{height:100vh;height:100dvh;display:flex;flex-direction:column}.share-header{display:flex;align-items:center;gap:24px;min-height:70px;padding:10px 26px;border-bottom:1px solid #dce4d6;background:#fafbf6;padding-top:calc(10px + env(safe-area-inset-top))}.brand{font-size:13px;font-weight:700;white-space:nowrap;letter-spacing:-.4px}.brand small{font-size:8px;font-weight:500;letter-spacing:1.6px;display:block;margin-top:5px;color:#879777}.tabs{display:flex;padding:3px;gap:3px;background:#eaf0e2;border-radius:8px;min-width:0;overflow-x:auto;scrollbar-width:none}.tabs button{border:0;background:transparent;border-radius:5px;padding:10px 17px;color:#6d8164;font-size:12px;white-space:nowrap}.tabs button[aria-selected=true]{background:#355f46;color:white}button{font:inherit;cursor:pointer;touch-action:manipulation}.download{margin-left:auto;border:1px solid #cbd8c1;background:#f5f8ee;border-radius:6px;padding:9px 12px;color:#43623d;font-size:11px;white-space:nowrap}button:focus-visible{outline:3px solid #7ca587;outline-offset:3px}#viewers{flex:1;min-height:0;position:relative}iframe{display:block;width:100%;height:100%;border:0}.no-script{padding:30px;text-align:center}
.home-view{flex:1;min-height:0;overflow-y:auto;padding:54px 30px 26px}.home-inner{max-width:1160px;margin:auto}.eyebrow{margin:0 0 20px;font-size:10px;letter-spacing:2.2px;font-weight:700;color:#819174}.home-intro{display:flex;align-items:flex-end;justify-content:space-between;gap:30px;margin-bottom:42px}.home-intro h1{font-size:clamp(30px,3.4vw,43px);line-height:1.45;letter-spacing:-1.7px;margin:0;font-weight:650;color:#263f36}.home-intro h1 span{color:#88a576}.home-intro p{font-size:12px;line-height:1.9;color:#7d8d7a;margin:0 0 5px}.home-section-heading{display:flex;justify-content:space-between;align-items:center;margin-bottom:15px}.home-section-heading h2{font-size:13px;font-weight:650;margin:0}.home-section-heading span{font-size:9px;letter-spacing:1.5px;color:#929e8c}.space-grid{display:grid;grid-template-columns:minmax(0,560px);gap:18px}.space-card{text-align:left;color:inherit;background:white;border:1px solid #dfe6d9;border-radius:12px;padding:0;overflow:hidden;display:flex;flex-direction:column;transition:transform .18s,border-color .18s,box-shadow .18s;min-width:0}.space-card:hover{transform:translateY(-3px);border-color:#9eb995;box-shadow:0 10px 24px #3458430b}.card-art{height:132px;position:relative;display:grid;place-items:center;width:100%;background:#eaf0e3;color:#739466;background-image:linear-gradient(#bfcfbc35 1px,transparent 1px),linear-gradient(90deg,#bfcfbc35 1px,transparent 1px);background-size:22px 22px}.space-card:nth-child(even) .card-art{background-color:#e8eff0;color:#648793}.card-art svg{height:83px;width:83px;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}.card-number{position:absolute;left:19px;top:17px;font-size:10px;letter-spacing:1px}.card-content{display:flex;flex-direction:column;position:relative;flex:1;padding:23px 20px 30px}.card-kicker{font-size:8px;letter-spacing:1.5px;color:#819475;font-weight:700}.card-title{font-size:23px;font-weight:700;letter-spacing:-.8px;margin:11px 0}.card-copy{font-size:11px;color:#7e8b7d;line-height:1.9;min-height:62px}.card-detail{font-size:9px;line-height:1.7;color:#7d8d76;margin-top:19px;padding-right:8px}.card-arrow{position:absolute;bottom:20px;right:16px;font-size:20px;color:#527648}.home-note{padding:18px 20px;margin:22px 0 30px;background:#ebefe5;color:#72856a;border-radius:8px;font-size:11px;line-height:1.8}.home-note strong{color:#456b43;font-weight:600}.home-footer{border-top:1px solid #dfe5d9;padding-top:18px;display:flex;justify-content:space-between;font-size:9px;letter-spacing:1px;color:#919e8a}
@media(max-width:1000px){.share-header{gap:16px;padding-left:18px;padding-right:18px}.tabs button{padding-left:12px;padding-right:12px}.home-view{padding:36px 24px 24px}.space-grid{grid-template-columns:minmax(0,560px);gap:16px}.space-card{flex-direction:row}.card-art{height:auto;width:105px;flex-shrink:0}.card-content{padding:22px 18px 29px}.card-copy{min-height:42px}.home-intro{margin-bottom:30px}}
@media(max-width:700px){.share-header{flex-wrap:wrap;gap:10px;min-height:96px;padding:12px 14px 9px;padding-top:calc(12px + env(safe-area-inset-top))}.brand{font-size:12px;flex:1}.brand small{font-size:7px}.tabs{order:3;width:100%;gap:2px;flex-shrink:0}.tabs button{flex:1;padding:9px 12px;font-size:11px}.download{font-size:10px;margin-left:0;padding:8px 10px}.download span{display:none}.home-view{padding:30px 20px 22px}.home-intro{display:block}.home-intro h1{font-size:31px}.home-intro p{margin-top:20px;font-size:11px}.eyebrow{font-size:8px;margin-bottom:15px}.space-grid{grid-template-columns:1fr;gap:14px}.card-art{width:98px}.card-art svg{width:70px;height:70px}.card-content{padding:23px 18px 27px}.card-title{font-size:21px}.card-copy{min-height:0}.card-detail{margin-top:15px}.home-note{margin-bottom:24px}.home-footer{font-size:8px;gap:12px;line-height:1.7}}
@media(max-height:500px) and (orientation:landscape){.share-header{min-height:46px;padding-top:5px;padding-bottom:5px}.brand small{display:none}.tabs button{padding-top:6px;padding-bottom:6px}.home-view{padding-top:22px}.download{padding-top:6px;padding-bottom:6px}}
@media(prefers-reduced-motion:reduce){.space-card{transition:none}}
</style></head><body><main class="shell"><header class="share-header"><div class="brand">희창유업 3D 작업실<small>EQUIPMENT WORKSPACE</small></div><nav class="tabs" role="tablist" aria-label="작업 공간 선택">${tabs}</nav><button id="download-file" type="button" class="download">${hosted ? '오프라인 ZIP 저장 ↓' : 'HTML<span> 파일</span> 저장 ↓'}</button></header>
<section id="home-view" class="home-view" role="tabpanel" aria-labelledby="tab-home"><div class="home-inner"><p class="eyebrow">HEECHANG MODELING · ${String(viewers.length).padStart(2, '0')} SPACE</p><div class="home-intro"><h1>희창유업의 현장을<br>3D 모델로<span>.</span></h1><p>공장 전경과 건물·설비의 배치를 확인하세요.<br>사진과 도면을 바탕으로 보완한 모델입니다.</p></div><div class="home-section-heading"><h2>현장 3D 모델</h2><span>SELECT YOUR SPACE</span></div><div class="space-grid">${cards}</div><p class="home-note"><strong>실외기실 보기</strong> 3D 지도를 연 뒤, 상단의 <strong>실외기실</strong>을 선택하세요.</p><footer class="home-footer"><span>희창유업 3D 모델링 프로젝트</span><span>공장 전경 · 건물 · 설비 · 배치</span></footer></div></section><div id="viewers" hidden></div></main><noscript><p class="no-script">작업 공간을 보려면 브라우저의 JavaScript를 켜 주세요.</p></noscript>
<script type="application/json" id="viewer-documents">${documents}</script>
<script type="module">${code.replace(/<\/script/gi, '<\\/script')}</script></body></html>`;
}
