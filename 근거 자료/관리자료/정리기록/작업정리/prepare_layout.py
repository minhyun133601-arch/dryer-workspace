"""Prepare an explicit, audited organization plan; perform no moves or deletions."""
import hashlib
import json
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORK = Path(__file__).resolve().parent
audit = json.loads((WORK / 'dedup_audit.json').read_text(encoding='utf-8'))

def files_under(folder):
    if not folder.exists():
        return
    for current, dirs, files in os.walk(folder):
        dirs[:] = [n for n in dirs if n not in ('.git', 'node_modules') and not os.path.islink(Path(current)/n) and not getattr(os.path,'isjunction',lambda p:False)(Path(current)/n)]
        for name in files:
            p = Path(current)/name
            if not p.is_symlink():
                yield p

def sha(p):
    h=hashlib.sha256()
    with p.open('rb') as f:
        for b in iter(lambda:f.read(2**20),b''):
            h.update(b)
    return h.hexdigest()

canonical = audit['canonicalHashIndex'] + audit.get('auxiliaryCanonicalHashIndex',[])
by_hash = {}
for x in canonical:
    by_hash.setdefault(x['sha256'], x['path'])
deletes = {}
duplicates = {}
preserved_unknown = []
def add(rel, reason, expected=None):
    p = (ROOT/rel).resolve()
    if not p.is_file():
        return
    p.relative_to(ROOT)
    # The three captured-original collections are never cleanup targets.
    assert p.parts[len(ROOT.parts)] not in ('2025년 자료','2026년 기안서 자료','보고서별 폴더')
    k = p.relative_to(ROOT).as_posix()
    h = expected or sha(p)
    deletes[k] = {'source':k,'size':p.stat().st_size,'sha256':h,'reason':reason}
    if h in by_hash:
        duplicates[k] = by_hash[h]
        deletes[k]['canonical'] = by_hash[h]

for x in audit['duplicates']:
    add(x['source'],'원본과 SHA256이 같은 중복 다운로드',x['sha256'])
    duplicates[x['source']] = x['canonical']
for x in audit['uniqueCandidates']:
    assert x['kind'].startswith('generated_'), x
    add(x['source'],'원본에서 생성한 OCR·미리보기·브라우저 임시기록',x['sha256'])
prev = audit.get('previousWorkAudit',{})
for x in prev.get('duplicates',[]):
    add(x['source'],'보존 자료와 동일한 이전 작업 복사본',x['sha256'])
    duplicates[x['source']] = x['canonical']
for x in prev.get('generatedCandidates',[]):
    add(x['source'],'이전 렌더·초안·런타임 검증 산출물',x['sha256'])
for x in audit['generatedReleaseArchives']:
    add(x['source'],'현재 최종본으로 대체된 과거 배포 패키지')

derived_folders = [
    '_work_approvals/audit_2026_b','_work_approvals/support_2025_sources',
    '_work_2025/audit_a_images','_work_2025/final_exports',
    '_work_2025/final_exports_build','_work_2025/fixture_verification',
    '_work_2025/stopped_final_rebuild','_work_heat_exchanger/qa_downloads',
]
original_ext = {'.pdf','.xls','.xlsx','.ppt','.pptx','.doc','.docx','.zip'}
for folder in derived_folders:
    for p in files_under(ROOT/folder):
        rel=p.relative_to(ROOT).as_posix()
        h=sha(p)
        if p.suffix.lower() in original_ext and h not in by_hash:
            # Draft-export directories are explicitly generated; raw extraction folders are not.
            if '/final_exports' not in folder and 'fixture_verification' not in folder:
                preserved_unknown.append(rel)
                continue
        add(rel,'재생성 가능한 추출·검증·이전 초안 산출물',h)
for folder in ['_work_2025','_work_approvals','_work_heat_exchanger']:
    for p in files_under(ROOT/folder):
        if '__pycache__' in p.parts or (p.parent.name=='xlsx_qa' and p.suffix in ('.png','.ndjson')):
            add(p.relative_to(ROOT).as_posix(),'검증 임시파일·파이썬 캐시')
for name in ['comparison-first-screen-desktop.png','comparison-first-screen-desktop-v2.png','열교환기 한눈에.html','열교환기 3D 한눈에.html']:
    add(name,'새 시뮬레이터로 대체된 화면·중간본')

review=json.loads((ROOT/'_work_approvals/approval_review_data.json').read_text(encoding='utf-8'))
docs={str(d['docId']):d for d in review['documents']}
def clean_title(value):
    value=re.sub(r'[<>:"/\\|?*]',' ',value)
    value=re.sub(r'\s*(?:완료\s*보고서|완료\s*보고|보고서|보고의\s*件|완료\s*의\s*件|의\s*件|의\s*건|件)$','',value).strip(' ._-')
    value=re.sub(r'\s+',' ',value)
    return value[:78].rstrip()
def date_of(d):
    restored={'311810':'2025-06-24','306011':'2025-05-19','329247':'2025-12-02'}
    if d['docId'] in restored:return restored[d['docId']]
    date=d.get('date','')
    if re.match(r'^20\d\d-\d\d-\d\d$',date):return date
    m=re.search(r'-(20\d\d)(\d\d)',d.get('docNo',''))
    return m.group(1)+'-'+m.group(2) if m else str(d.get('year','일자미상'))
moves=[]
projects=[]
used_destinations=set()
assigned=set()
def unique_path(value):
    result=value;n=2
    while result.casefold() in used_destinations:
        result=f'{value} ({n})';n+=1
    used_destinations.add(result.casefold())
    return result
for project in sorted(review['projects'],key=lambda p:p['id']):
    members=[docs[str(i)] for i in project['proposalIds']+project['reportIds']]
    members.sort(key=lambda d:(date_of(d),d['docId']))
    proposals=[d for d in members if d['kind']=='기안서']
    anchor=(proposals or members)[0]
    title=anchor['title'] if proposals else project['title']
    if project['id'] in ('P325285','P365099'):title=project['title']
    folder=unique_path('사업자료/'+date_of(anchor)+' '+clean_title(title))
    members=[anchor]+[d for d in members if d is not anchor]
    entry={'id':project['id'],'date':date_of(anchor),'title':clean_title(title),'path':folder,'documents':[]}
    for d in members:
        old=Path(d['captureFolder']).resolve().relative_to(ROOT).as_posix()
        target=folder if d is anchor else unique_path(folder+'/'+date_of(d)+' '+clean_title(d['title']))
        moves.append((old,target));assigned.add(d['docId'])
        entry['documents'].append({'docId':d['docId'],'date':date_of(d),'title':clean_title(d['title']),'path':target,'pdf':target+'/'+Path(d['bodyPdfPath']).name,'attachments':target+'/첨부파일'})
    projects.append(entry)
for d in docs.values():
    if d['docId'] in assigned:continue
    folder=unique_path('사업자료/'+date_of(d)+' '+clean_title(d['title']))
    moves.append((Path(d['captureFolder']).resolve().relative_to(ROOT).as_posix(),folder))
    projects.append({'id':'D'+d['docId'],'date':date_of(d),'title':clean_title(d['title']),'path':folder,'documents':[{'docId':d['docId'],'date':date_of(d),'title':clean_title(d['title']),'path':folder,'pdf':folder+'/'+Path(d['bodyPdfPath']).name,'attachments':folder+'/첨부파일'}]})

capture_roots={a for a,b in moves}
for collection in ('2025년 자료','2026년 기안서 자료','보고서별 폴더'):
    outer=ROOT/collection
    container=outer/'문서별 폴더' if (outer/'문서별 폴더').is_dir() else outer
    for sub in container.iterdir():
        rel=sub.relative_to(ROOT).as_posix()
        if sub.is_dir() and rel not in capture_roots:
            moves.append((rel,'관리자료/이전캡처/'+clean_title(sub.name)))
    for p in files_under(outer):
        rel=p.relative_to(ROOT).as_posix()
        if not any(rel.startswith(a+'/') for a,b in moves):
            moves.append((rel,'관리자료/정리기록/이전수집목록/'+rel))

moves += [
    ('기안·보고 금액총괄/2025-2026_기안·보고_사업별금액총괄.xlsx','최종자료/2025-2026 금액총괄.xlsx'),
    ('기안·보고 금액총괄/자료총괄.html','최종자료/자료총괄.html'),
    ('건조기 열교환기 백데이터.html','최종자료/열교환기 백데이터.html'),
    ('건조기 열교환기 시뮬레이터.html','최종자료/건조기 열교환기 시뮬레이터.html'),
    ('최종자료_열기.html','최종자료/2027 추진안건.html'),
    ('final-investment-hub','관리자료/웹소스/final-investment-hub'),
    ('_work_2025','관리자료/수집·검토/_work_2025'),
    ('_work_approvals','관리자료/수집·검토/_work_approvals'),
    ('_work_heat_exchanger','관리자료/수집·검토/_work_heat_exchanger'),
    ('이전작업_보관','관리자료/이전작업'),
]
for p in ROOT.glob('*.pptx'):
    if '20261102' in p.name: date,title='2026-11-02','공무환경팀 10월 KPI'
    elif '20261014' in p.name:date,title='2026-10-14','2027년 고정투자자산 계획'
    else:date,title='2026-11-03','2027년 KPI 및 중점추진과제'
    target=unique_path('사업자료/'+date+' '+title)
    moves.append((p.name,target+'/'+p.name))
    projects.append({'id':'PPT'+date,'date':date,'title':title,'path':target,'documents':[{'date':date,'title':p.name,'path':target,'pdf':target+'/'+p.name}]})
plan = {
    'workspace':str(ROOT), 'deleteFiles':list(deletes.values()),
    'duplicateCanonicalMap':duplicates,
    'moves':[{'source':a,'target':b} for a,b in moves],
    'cleanupDirectories':['.playwright-mcp']+derived_folders+audit['candidateFolders']+['2025년 자료','2026년 기안서 자료','보고서별 폴더','기안·보고 금액총괄'],
    'projects':sorted(projects,key=lambda p:(p['date'],p['title'])),
    'preservedUnknownFiles':preserved_unknown,
    'stats':{'deleteFiles':len(deletes),'deleteBytes':sum(x['size'] for x in deletes.values()),'duplicateMap':len(duplicates)},
}
(WORK/'action_plan.json').write_text(json.dumps(plan,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(plan['stats'],ensure_ascii=False))
print('PRESERVED_UNKNOWN',preserved_unknown)
