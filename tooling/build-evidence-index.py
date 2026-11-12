"""Build the heat-exchanger-only evidence index from existing report files."""
from pathlib import Path
from html import escape
from urllib.parse import quote
import json

PROJECT = Path(__file__).resolve().parent.parent
ROOT = PROJECT/'references'/'열교환기'
business = ROOT/'사업자료'
extensions = {'.pdf', '.ppt', '.pptx', '.xls', '.xlsx', '.xlsb', '.xlsm', '.doc', '.docx', '.hwp', '.hwpx', '.dwg', '.zip'}
groups = []
for folder in sorted(business.iterdir(), key=lambda p: p.name):
    if not folder.is_dir():
        continue
    if '열교환기' not in folder.name:
        raise ValueError('An unrelated report folder remains; review it before rebuilding.')
    documents = []
    for file in sorted(folder.rglob('*')):
        if file.is_file() and file.suffix.casefold() in extensions:
            documents.append({'name': file.relative_to(folder).as_posix(), 'href': quote(file.relative_to(ROOT).as_posix(), safe='/'), 'type': file.suffix.upper().lstrip('.')})
    groups.append({'name': folder.name, 'href': quote(folder.relative_to(ROOT).as_posix(), safe='/')+'/', 'documents': documents})

cards = [
    ('열교환기 설치 보고서', '사업자료/2026-01-21 유산)건조기 열교환기(폐열회수 장치) 설치/문서 본문.pdf'),
    ('열교환기 시뮬레이터', '../../exports/건조기-통합-공유.html?viewer=heat-exchanger'),
    ('열교환기 백데이터', '최종자료/열교환기 백데이터.html'),
]
top = ''.join(f'<a class="card" href="{escape(quote(href, safe="/?=&"), quote=True)}"><strong>{escape(name)}</strong><span>↗</span></a>' for name, href in cards)
rows = []
for group in groups:
    files = ''.join(f'<li><a href="{escape(doc["href"], quote=True)}" target="_blank" rel="noopener"><span class="type">{doc["type"]}</span>{escape(doc["name"])}</a></li>' for doc in group['documents'])
    rows.append(f'<details open class="report" data-name="{escape(group["name"].casefold(), quote=True)}"><summary><time>{escape(group["name"][:10])}</time><strong>{escape(group["name"][11:])}</strong><span>{len(group["documents"])}개 파일</span></summary><div class="docs"><ul>{files}</ul></div></details>')
html = '''<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>열교환기 근거자료</title><style>
:root{font-family:"Malgun Gothic",system-ui,sans-serif;color:#23394b;background:#f5f7f9}*{box-sizing:border-box}body{margin:0}main{max-width:1120px;margin:auto;padding:38px 26px 55px}h1{font-size:28px;letter-spacing:-1px;margin:0 0 9px}.sub{font-size:13px;color:#82919c;margin:0 0 24px}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:11px;margin-bottom:16px}a{color:inherit;text-decoration:none}a:hover{text-decoration:underline}.card{display:flex;align-items:center;justify-content:space-between;gap:16px;border:1px solid #d9e3e9;border-radius:9px;background:#fff;padding:23px 20px;font-size:15px}.card:first-child{background:#233e50;color:#fff;border-color:#233e50}.card span{color:#7d9db2}.links{display:flex;gap:22px;flex-wrap:wrap;font-size:12px;color:#678597;margin:18px 0 28px}.bar{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:11px}.bar p{font-size:13px;color:#788b98}.bar input{width:min(410px,55%);border:1px solid #cedce5;border-radius:7px;background:#fff;padding:11px 13px;font:inherit;font-size:12px}.list{border:1px solid #dae3e8;border-radius:9px;overflow:hidden;background:#fff}.report+.report{border-top:1px solid #e2e9ee}summary{display:flex;align-items:center;gap:16px;padding:17px 19px;cursor:pointer;list-style:none}summary:before{content:'›';font-size:22px;color:#91a4b1}.report[open] summary:before{transform:rotate(90deg)}summary time{font-size:11px;color:#8396a2;white-space:nowrap}summary strong{font-size:13px;font-weight:600;line-height:1.6;flex:1}summary>span{font-size:10px;color:#95a5b0;white-space:nowrap}.docs{padding:0 23px 17px 43px}.folder{display:inline-block;margin:0 0 10px;font-size:11px;color:#7493a6}ul{list-style:none;padding:0;margin:0}li{border-top:1px solid #edf1f4}li a{display:block;padding:9px 0;font-size:11px;line-height:1.65;color:#647f90;overflow-wrap:anywhere}.type{font-size:8px;display:inline-block;min-width:35px;color:#9aabb7;margin-right:8px}footer{font-size:10px;color:#95a5af;margin-top:17px;line-height:1.8}[hidden]{display:none!important}@media(max-width:720px){main{padding:25px 15px}.cards{grid-template-columns:1fr}.card{padding:17px}summary{gap:9px;flex-wrap:wrap;padding:14px}summary time{font-size:10px}summary strong{flex-basis:75%;font-size:12px}summary>span{margin-left:auto}.docs{padding:0 17px 15px 24px}.links{gap:13px}.bar{align-items:flex-start;flex-direction:column;gap:5px}.bar input{width:100%}}a:focus-visible,input:focus-visible,summary:focus-visible{outline:3px solid #d7a353;outline-offset:3px}
</style></head><body><main><h1>열교환기 근거자료</h1><p class="sub">건조기 폐열회수 장치 설치 보고서와 검토 근거</p><nav class="cards">__CARDS__</nav><div class="links"><a href="../../index.html">프로젝트 열기 ↗</a><a href="KPI-전기-가스-월별-2024-2026%20(1).xlsx">전기·가스 원장 ↗</a></div><div class="bar"><p id="count">__COUNT__개 보고서 묶음</p><input id="search" type="search" placeholder="날짜·설비·작업명 검색" aria-label="열교환기 보고서 검색"></div><section class="list">__ROWS__</section><footer>열교환기 보고서와 근거자료를 프로젝트 안에서 함께 관리합니다.</footer></main><script>
const search=document.getElementById('search'),reports=[...document.querySelectorAll('.report')];search.addEventListener('input',()=>{const text=search.value.toLocaleLowerCase().replace(/\\s/g,'');let count=0;for(const report of reports){report.hidden=!report.textContent.toLocaleLowerCase().replace(/\\s/g,'').includes(text);if(!report.hidden)count++}document.getElementById('count').textContent=count+'개 보고서 묶음'});
</script></body></html>'''.replace('__CARDS__',top).replace('__COUNT__',str(len(groups))).replace('__ROWS__',''.join(rows))
(ROOT/'00_자료열기.html').write_text(html, encoding='utf-8')
print(json.dumps({'groups': len(groups), 'document_links': sum(len(group['documents']) for group in groups), 'index': str(ROOT/'00_자료열기.html')}, ensure_ascii=False))
