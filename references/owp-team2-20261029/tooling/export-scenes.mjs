/* Export archived monitoring JSX into inert, source-derived reference HTML.
   Dependencies: npm install --prefix <TEMP>/codex-owp-render-deps @babel/core @babel/plugin-transform-react-jsx
   No OWP network calls, browser session, or plant controls are used. */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const deps = process.env.OWP_RENDER_DEPS || path.join(os.tmpdir(), 'codex-owp-render-deps');
const require = createRequire(path.join(deps, 'package.json'));
const babel = require('@babel/core');
const jsx = require('@babel/plugin-transform-react-jsx');
const saved = JSON.parse(await fs.readFile(path.join(root, 'data/monitoring-snapshot.json'), 'utf8'));
const records = saved.resultData;
const snapshotDir = path.join(root, 'snapshots');
await fs.mkdir(snapshotDir, { recursive: true });
const sourceCss = await fs.readFile(path.join(root, 'originals/web/29.8d4f15ec.chunk.css'), 'utf8');
const css = sourceCss.replaceAll('/assets/', '../originals/assets/');
await fs.writeFile(path.join(snapshotDir, 'source-styles.css'), css, 'utf8');

const scenes = [
  ['team2', '2팀 전체', 'video1.js', 'Video0'],
  ['floor1', '2팀 1층', 'video2.js', 'Video1'],
  ['floor3', '2팀 3층', 'video3.js', 'Video3'],
  ['floor4', '2팀 4층', 'video34.js', 'Video34'],
  ['floor5-7', '2팀 5~7층', 'video57.js', 'Video57'],
];
const esc = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const hyphen = name => name.replace(/[A-Z]/g, c => '-' + c.toLowerCase());
const unitless = new Set(['zoom','opacity','zIndex','fontWeight','lineHeight','flexGrow','flexShrink','order']);
const styleString = obj => Object.entries(obj || {}).map(([key, value]) => `${hyphen(key)}:${typeof value === 'number' && value !== 0 && !unitless.has(key) ? value + 'px' : value}`).join(';');
const stub = name => Object.assign(() => {}, { archiveType: name });
const React = {
  Fragment: Symbol('Fragment'),
  Component: class {
    constructor(props) { this.props = props; this.state = {}; }
    setState(update, after) { Object.assign(this.state, typeof update === 'function' ? update(this.state, this.props) : update); after?.(); }
  },
  createElement(type, props, ...children) { return { type, props: props || {}, children: children.flat(Infinity) }; },
};
function serialize(node, slug) {
  if (node == null || typeof node === 'boolean') return '';
  if (Array.isArray(node)) return node.map(n => serialize(n, slug)).join('');
  if (typeof node !== 'object') return esc(String(node).replaceAll('NaN', '—'));
  const { type, props, children } = node;
  const content = () => children.map(c => serialize(c, slug)).join('');
  if (type === React.Fragment) return content();
  if (typeof type === 'function') {
    if (type.archiveType === 'Player') return `<img class="archive-video-frame" src="../images/${slug}.png" alt="원본 WebM 6초 프레임" width="1920" height="1080">`;
    if (type.archiveType === 'Animated') return props.isVisible === false ? '' : content();
    if (type.archiveType === 'GuageChart') {
      const data = props.data || {};
      return `<div class="archive-gauge-placeholder" id="${esc(props.id || '')}" title="원본 차트는 별도 JS 렌더링. 저장값=${esc(data.val ?? '미확보')} / 하한=${esc(data.lsl ?? '미확보')} / 상한=${esc(data.usl ?? '미확보')}" data-value="${esc(data.val ?? '')}" data-lsl="${esc(data.lsl ?? '')}" data-usl="${esc(data.usl ?? '')}"><span>게이지 영역</span></div>`;
    }
    return '';
  }
  if (typeof type !== 'string') return '';
  const attributes = [];
  for (const [key, value] of Object.entries(props)) {
    if (value == null || typeof value === 'function' || key === 'children' || key === 'key' || key === 'ref' || /^on[A-Z]/.test(key)) continue;
    if (key === 'style') { attributes.push(`style="${esc(styleString(value))}"`); continue; }
    const attr = key === 'className' ? 'class' : key === 'colSpan' ? 'colspan' : key === 'rowSpan' ? 'rowspan' : key;
    const rewritten = (key === 'src' || key === 'href') && typeof value === 'string' ? value.replace(/^\/assets\//, '../originals/assets/') : value;
    attributes.push(`${attr}="${esc(rewritten)}"`);
  }
  const voidElement = /^(img|source|input|br|hr|meta|link|area|base|col|embed|param|track|wbr)$/.test(type);
  return `<${type}${attributes.length ? ' ' + attributes.join(' ') : ''}>${voidElement ? '' : content() + `</${type}>`}`;
}

const exportInfo = [];
for (const [slug, title, sourceFile, className] of scenes) {
  let source = await fs.readFile(path.join(root, 'originals/source', sourceFile), 'utf8');
  source = source.replace(/^import[\s\S]*?;\s*$/gm, '').replace(/export default[\s\S]*?;\s*$/, `globalThis.ArchiveScene = ${className};`);
  const transformed = babel.transformSync(source, { configFile: false, babelrc: false, plugins: [[jsx, { runtime: 'classic' }]] }).code;
  const context = {
    React, withStyles: () => c => c,
    _: { includes: (value, sub) => String(value).includes(sub) },
    Animated: stub('Animated'), Player: stub('Player'),
    BigPlayButton: stub('BigPlayButton'), ControlBar: stub('ControlBar'),
    GuageChart: stub('GuageChart'), DonutChart: stub('DonutChart'),
    LiveChart: stub('LiveChart'), DialogList: stub('DialogList'),
    query: () => { throw new Error('Network APIs are disabled in this offline exporter'); },
    moment: () => ({ format: () => saved.saved_at.slice(0,10) }),
    makeNowHHmm: () => '', makeNowYYYYMMDD: () => '', console,
  };
  vm.createContext(context);
  vm.runInContext(transformed, context, { filename: sourceFile });
  const scene = new context.ArchiveScene({ play: true });
  scene.state.innerWidth = 1920;
  scene.state.zoomRatio = 100;
  scene.state.showlabel = true;
  // Every source-referenced reading without a captured record is unknown, including
  // production counters loaded by endpoints that were not part of this snapshot.
  const readingKeys = new Set([
    ...Array.from(source.matchAll(/this\.state\[['"]([A-Za-z0-9_]+_Value)['"]\]/g), match => match[1]),
    ...Array.from(source.matchAll(/this\.state\.([A-Za-z0-9_]+_Value)/g), match => match[1]),
    ...Object.keys(scene.state).filter(key => key.endsWith('_Value')),
  ]);
  const capturedTags = new Set(records.filter(item => item.VALUE != null && String(item.VALUE).trim() !== '').map(item => item.TID));
  const unknownReadings = [];
  for (const key of readingKeys) {
    if (!capturedTags.has(key.slice(0, -6))) {
      scene.state[key] = '—';
      unknownReadings.push(key);
    }
  }
  for (const item of records) {
    const tag = item.TID;
    if (!tag || !capturedTags.has(tag)) continue;
    let value = Number(item.VALUE);
    if (tag.startsWith('DRYER_')) value = Math.abs(value).toFixed(3);
    else if (tag.includes('_Count')) value = value.toFixed(0);
    else if (tag.includes('_Temp')) value = (value * 0.1).toFixed(1);
    value = String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    Object.assign(scene.state, {
      [tag + '_Value']: value, [tag + '_Name']: item.SENSORNM,
      [tag + '_TIDNM']: item.TID_NM, [tag + '_TIMESTAMP']: item.TIMESTAMP,
      [tag + '_TID']: tag, [tag + '_USL1']: Number(item.USL1), [tag + '_LSL1']: Number(item.LSL1),
    });
  }
  const tree = scene.render();
  const rendered = serialize(tree, slug);
  const note = '원본 JSX·CSS와 WebM 6초 프레임으로 만든 오프라인 참고 화면입니다. 실제 크롬 화면 캡처가 아닙니다. 숫자는 저장 시점의 조회값이며 게이지·팝업·시계 등은 생략했습니다.';
  const html = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} — OWP 저장 참고</title><link rel="stylesheet" href="source-styles.css"><style>html,body{margin:0;background:#111;color:#eee;font-family:"Malgun Gothic",sans-serif}*{box-sizing:border-box}header{padding:14px 20px;max-width:1920px;font-size:14px;line-height:1.6;background:#182330}header a{color:#91d3ff}#scene{position:relative;width:1920px;height:1080px;overflow:hidden;background:#000}.archive-video-frame{display:block;width:1920px;height:1080px}.archive-gauge-placeholder{width:100%;height:100%;border:1px dashed #61717b;border-radius:50%;display:grid;place-items:center;background:#10182099;color:#a8bcc7;font-size:11px}.archive-gauge-placeholder span{opacity:.8}body .clock{display:none}.archive-watermark{position:absolute;right:14px;bottom:14px;z-index:2147483647;padding:7px 12px;border-radius:5px;background:rgba(9,17,23,.78);color:#c7d3da;font-size:14px;line-height:1.4;pointer-events:none}</style><header><strong>${esc(title)}</strong> · <a href="../index.html">전체 자료</a><br>${esc(note)}<br>조회 저장 시각: ${esc(saved.saved_at)}</header><main id="scene">${rendered}<div class="archive-watermark">소스 기반 배치 참고 · 실제 크롬 캡처 아님 · 게이지 생략</div></main></html>`;
  await fs.writeFile(path.join(snapshotDir, slug + '.html'), html, 'utf8');
  const layout = [];
  function walk(n) {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(walk);
    if (n.props?.className) layout.push({ element: typeof n.type === 'string' ? n.type : (n.type?.archiveType || 'component'), className: n.props.className, style: n.props.style });
    n.children?.forEach(walk);
  }
  walk(tree);
  await fs.writeFile(path.join(snapshotDir, slug + '-layout.json'), JSON.stringify({ sourceFile, scene: title, snapshot_at: saved.saved_at, layout }, null, 2), 'utf8');
  exportInfo.push({ id: slug, title, html: `snapshots/${slug}.html`, source: `originals/source/${sourceFile}`, layout_nodes: layout.length, unobserved_value_fields: unknownReadings });
}
await fs.writeFile(path.join(snapshotDir, 'export-info.json'), JSON.stringify({ note: 'Source-derived offline exports; not live Chrome screenshots. Gauges are placeholders; missing readings remain blank.', snapshot_at: saved.saved_at, scenes: exportInfo }, null, 2), 'utf8');
console.log(JSON.stringify(exportInfo, null, 2));
