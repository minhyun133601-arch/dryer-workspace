"""Build a small relative-link entry point for the reorganized evidence workspace."""
from pathlib import Path
from urllib.parse import quote
import json

WORK = Path(__file__).resolve().parent
ROOT = next(p for p in WORK.parents if (p/'사업자료').is_dir() and (p/'최종자료').is_dir())
PLAN = json.loads((WORK/'action_plan.json').read_text(encoding='utf-8'))
OUT = ROOT/'00_자료열기.html'
checked = {}

def url(path, directory=False):
    p = (ROOT/path).resolve()
    assert p.is_relative_to(ROOT), path
    assert p.exists(), path
    if directory:
        assert p.is_dir(), path
    else:
        assert p.is_file(), path
    relative = p.relative_to(ROOT).as_posix()
    checked[relative] = 'folder' if directory else 'file'
    return quote(relative, safe='/') + ('/' if directory else '')

entries = []
for group in PLAN['projects']:
    documents=[]
    for d in group['documents']:
        documents.append({
            'date':d['date'], 'title':d['title'], 'folder':url(d['path'], True),
            'file':url(d['pdf']),
            'fileLabel':'본문 보기' if Path(d['pdf']).suffix.lower()=='.pdf' else '파일 열기',
            'attachments':url(d['attachments'], True) if d.get('attachments') else '',
        })
    entries.append({'date':group['date'],'title':group['title'],'folder':url(group['path'],True),
                    'documents':sorted(documents,key=lambda d:(d['date'],d['title']))})
entries.sort(key=lambda d:(d['date'],d['title']))
assert len(entries)==102
assert sum(len(x['documents']) for x in entries)==174

def project_url(filename):
    project_exports = (ROOT.parent/'프로젝트'/'exports').resolve()
    target = (project_exports/filename).resolve()
    assert target.is_relative_to(project_exports) and target.is_file(), filename
    relative = '../프로젝트/exports/' + filename
    checked[relative] = 'file'
    return quote(relative, safe='/')

targets={
    'simulator':project_url('건조기-통합-공유.html') + '#/heat-exchanger',
    'furnace':project_url('건조기 7층 화덕.html'),
    'workbook':url('최종자료/2025-2026 금액총괄.xlsx'),
    'plans':url('최종자료/2027 추진안건.html'),
    'detail':url('최종자료/열교환기 백데이터.html'),
}
template=r'''<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>근거자료</title><style>
:root{color-scheme:light;--ink:#172c3e;--muted:#697a88;--line:#dfe6eb;--blue:#176b8c;--paper:#f5f7f9}*{box-sizing:border-box}body{margin:0;color:var(--ink);background:var(--paper);font-family:"Malgun Gothic","맑은 고딕",system-ui,sans-serif;font-size:14px;line-height:1.6}main{max-width:1160px;margin:auto;padding:40px 30px 54px}h1{font-size:30px;letter-spacing:-1.2px;line-height:1.3;margin:0 0 24px}a{color:inherit;text-decoration:none}a:hover{text-decoration:underline;text-underline-offset:4px}button,input,select{font:inherit}a:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible{outline:3px solid #d69639;outline-offset:4px}.shortcuts{display:grid;grid-template-columns:1.35fr 1fr 1fr;gap:12px}.shortcut{display:flex;align-items:center;justify-content:space-between;gap:14px;background:white;border:1px solid var(--line);border-radius:10px;padding:24px 22px;min-height:94px;font-size:18px;font-weight:700;letter-spacing:-.4px;transition:transform .15s,border-color .15s}.shortcut:hover{transform:translateY(-2px);border-color:#8aabbc;text-decoration:none}.shortcut.primary{background:var(--ink);color:white;border-color:var(--ink)}.shortcut span:last-child{font-size:22px;font-weight:400;color:#92b2c3}.shortcut.primary span:last-child{color:#afdaea}.small-link{display:inline-block;margin:13px 0 30px;color:var(--muted);font-size:13px}.bar{display:flex;align-items:center;justify-content:space-between;gap:18px;margin-bottom:12px}.count{font-size:14px;color:var(--muted);white-space:nowrap}.count b{color:var(--ink);font-weight:700}.filters{display:flex;gap:8px;width:min(570px,60%)}input{min-width:0;width:100%;border:1px solid #ced9e1;border-radius:7px;background:white;padding:10px 13px;color:var(--ink);height:43px}input::placeholder{color:#81909c}select{max-width:124px;border:1px solid #ced9e1;border-radius:7px;background:white;padding:9px 10px;color:var(--muted);height:43px}.list{background:white;border:1px solid var(--line);border-radius:10px;overflow:hidden}.entry+ .entry{border-top:1px solid var(--line)}summary{display:grid;grid-template-columns:22px 100px minmax(0,1fr) auto;gap:13px;align-items:center;min-height:70px;padding:15px 20px;cursor:pointer;list-style:none}summary::-webkit-details-marker{display:none}summary:before{content:'›';display:block;color:#8b9dab;font-size:24px;line-height:1;transform-origin:center;text-align:center;transition:transform .15s}.entry[open]>summary:before{transform:rotate(90deg)}summary:hover{background:#f8fafb}.date{font-variant-numeric:tabular-nums;color:var(--muted);font-size:13px;white-space:nowrap}.title{font-size:15px;font-weight:600;line-height:1.5;word-break:keep-all;overflow-wrap:anywhere}.folder-link{font-size:12px;color:var(--blue);padding:4px 0 4px 12px;white-space:nowrap}.docs{margin:0;padding:0 20px 15px 55px;list-style:none}.doc{display:grid;grid-template-columns:100px minmax(0,1fr) auto;gap:13px;align-items:start;border-top:1px solid #edf1f4;padding:11px 0}.doc .title{font-size:13px;font-weight:400;color:#41576a}.doc-links{display:flex;gap:13px;white-space:nowrap;font-size:12px;color:var(--blue)}.doc-links a{padding:1px 0}.empty{padding:45px 20px;color:var(--muted);text-align:center;background:white;border:1px dashed #cad6df;border-radius:10px}[hidden]{display:none!important}footer{margin-top:16px;color:#85929c;font-size:12px}@media(max-width:760px){main{padding:25px 16px 35px}h1{font-size:27px;margin-bottom:20px}.shortcuts{grid-template-columns:1fr;gap:8px}.shortcut{min-height:70px;padding:16px 18px;font-size:17px}.small-link{margin-bottom:24px}.bar{display:flex;flex-direction:column;align-items:stretch;gap:10px}.filters{width:100%;max-width:none}.filters input{flex:1}.filters select{max-width:115px}.count{font-size:13px}summary{grid-template-columns:16px minmax(0,1fr) auto;gap:8px;padding:13px 12px;min-height:72px}summary .date{grid-column:2;grid-row:1;font-size:12px}summary .title{grid-column:2;grid-row:2;font-size:14px}summary:before{grid-row:1/3;font-size:22px}summary .folder-link{grid-column:3;grid-row:1/3;font-size:11px;padding-left:4px}.docs{padding:0 14px 11px 36px}.doc{grid-template-columns:1fr;gap:3px;padding:11px 0}.doc .date{font-size:11px}.doc .title{font-size:13px}.doc-links{margin-top:3px;gap:17px}.title{word-break:normal}}@media print{body{background:white}main{max-width:none;padding:12px}.shortcuts,.small-link,.filters,.folder-link,.doc-links{display:none}.list{border:0}.entry{break-inside:avoid}summary{min-height:0;padding:7px 0;grid-template-columns:90px 1fr}.entry summary:before{display:none}summary .date{grid-column:1}summary .title{grid-column:2}.entry:not([open])>.docs{display:none}.bar{margin-bottom:10px}}
</style></head><body><main>
<h1>근거자료</h1>
<nav class="shortcuts" aria-label="최종자료">
<a class="shortcut primary" href="__SIMULATOR__"><span>핵심 정비기술 내재화<br>프로젝트 열기</span><span aria-hidden="true">↗</span></a>
<a class="shortcut" href="__WORKBOOK__"><span>금액총괄.xlsx</span><span aria-hidden="true">↗</span></a>
<a class="shortcut" href="__PLANS__"><span>2027 추진안건</span><span aria-hidden="true">↗</span></a>
</nav>
<a class="small-link" style="margin-right:24px" href="__FURNACE__">건조기 7층 화덕 · 분해도 열기 ↗</a>
<a class="small-link" href="__DETAIL__">열교환기 상세 백데이터 ↗</a>
<section aria-label="사업자료">
<div class="bar"><div id="count" class="count" aria-live="polite"><b>102개 사업</b> · 174개 문서</div><div class="filters"><input id="search" type="search" aria-label="제목 또는 날짜 검색" placeholder="제목·날짜 검색"><select id="sort" aria-label="날짜 정렬"><option value="asc">날짜순</option><option value="desc">최신순</option></select></div></div>
<div id="list" class="list"></div><div id="empty" class="empty" hidden>검색 조건에 맞는 자료가 없습니다.</div>
</section><footer>제목을 누르면 연결된 문서를 볼 수 있습니다.</footer>
</main><script id="portal-data" type="application/json">__DATA__</script><script>
'use strict';(()=>{const items=JSON.parse(document.getElementById('portal-data').textContent),$=id=>document.getElementById(id),esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),norm=v=>String(v??'').toLowerCase().replace(/[\s.,/\-]/g,'');function render(){const q=norm($('search').value),desc=$('sort').value==='desc',rows=items.filter(p=>!q||norm(p.date+' '+p.title+' '+p.documents.map(d=>d.date+' '+d.title).join(' ')).includes(q));rows.sort((a,b)=>(desc?b.date.localeCompare(a.date):a.date.localeCompare(b.date))||a.title.localeCompare(b.title,'ko'));$('count').innerHTML=`<b>${rows.length}개 사업</b> · 연결 문서 ${rows.reduce((n,p)=>n+p.documents.length,0)}개`;$('list').hidden=!rows.length;$('empty').hidden=!!rows.length;$('list').innerHTML=rows.map(p=>`<details class="entry"${q?' open':''}><summary><time class="date" datetime="${esc(p.date)}">${esc(p.date)}</time><span class="title">${esc(p.title)}</span><a class="folder-link" href="${esc(p.folder)}" aria-label="${esc(p.title)} 폴더 열기">폴더 열기 ↗</a></summary><ul class="docs">${p.documents.map(d=>`<li class="doc"><time class="date" datetime="${esc(d.date)}">${esc(d.date)}</time><span class="title">${esc(d.title)}</span><div class="doc-links"><a href="${esc(d.file)}" target="_blank" rel="noopener">${esc(d.fileLabel)} ↗</a>${d.attachments?`<a href="${esc(d.attachments)}">첨부파일 ↗</a>`:''}</div></li>`).join('')}</ul></details>`).join('')} $('search').addEventListener('input',render);$('sort').addEventListener('change',render);document.addEventListener('click',e=>{if(e.target.closest('summary a'))e.stopPropagation()});render()})();
</script></body></html>'''
for token,key in [('__SIMULATOR__','simulator'),('__FURNACE__','furnace'),('__WORKBOOK__','workbook'),('__PLANS__','plans'),('__DETAIL__','detail')]:
    template=template.replace(token,targets[key])
serialized=json.dumps(entries,ensure_ascii=False,separators=(',',':')).replace('<','\\u003c')
template=template.replace('__DATA__',serialized)
OUT.write_text(template,encoding='utf-8')
receipt={'output':str(OUT),'projects':len(entries),'documents':sum(len(x['documents']) for x in entries),
         'uniqueLocalTargets':len(checked),'missingLocalTargets':0,'bytes':OUT.stat().st_size,
         'relativeLinks':True,'externalResources':0,'paths':checked}
(WORK/'portal_validation.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in receipt.items() if k!='paths'},ensure_ascii=False))
