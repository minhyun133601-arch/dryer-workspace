import hashlib,json,os,zipfile
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

WORK=Path(__file__).resolve().parent
ROOT=next(p for p in WORK.parents if p.name=='근거 자료')
plan=json.loads((WORK/'action_plan.json').read_text(encoding='utf-8'))
audit=json.loads((WORK/'dedup_audit.json').read_text(encoding='utf-8'))
prefixes=sorted([(x['source'],x['target']) for x in plan['moves']],key=lambda p:len(p[0]),reverse=True)
def destination(rel):
    for a,b in prefixes:
        if rel==a:return ROOT/b
        if rel.startswith(a+'/'):return ROOT/b/rel[len(a)+1:]
    return ROOT/rel
def digest(p):
    h=hashlib.sha256()
    with p.open('rb') as f:
        for b in iter(lambda:f.read(2**20),b''):h.update(b)
    return h.hexdigest()
def check(x):
    p=destination(x['path'])
    return {'source':x['path'],'target':p.relative_to(ROOT).as_posix(),'ok':p.is_file() and p.stat().st_size==x['size'] and digest(p)==x['sha256']}
with ThreadPoolExecutor(max_workers=4) as pool:checked=list(pool.map(check,audit['canonicalHashIndex']))
failures=[x for x in checked if not x['ok']]
assert not failures,failures[:10]

review=json.loads((ROOT/'관리자료/수집·검토/_work_approvals/approval_review_data.json').read_text(encoding='utf-8'))
docs=review['documents']
assert len(docs)==len({str(d['docId']) for d in docs})==171
assert sum(d['attachmentCount'] for d in docs)==533
for d in docs:
    for k in ['captureFolder','bodyJpgPath','bodyPdfPath','zipPath','attachmentDir']:assert Path(d[k]).exists(),(d['docId'],k,d[k])

extra=[x for x in plan['moves'] if x['target'].startswith('관리자료/이전캡처/')]
extra_cleanup=[]
if extra:
    assert len(extra)==1
    old_folder=ROOT/extra[0]['target']
    d=next(x for x in docs if str(x['docId'])=='329459')
    old_zip=next(old_folder.glob('*.zip'))
    canonical_zip=Path(d['zipPath'])
    def payload(zpath):
        with zipfile.ZipFile(zpath) as z:
            assert z.testzip() is None
            return Counter(hashlib.sha256(z.read(i)).hexdigest() for i in z.infolist() if not i.is_dir())
    assert payload(old_zip)==payload(canonical_zip)
    for p in old_folder.rglob('*'):
        if p.is_file():extra_cleanup.append({'source':p.relative_to(ROOT).as_posix(),'size':p.stat().st_size,'sha256':digest(p),'reason':'같은 V-MIXER 문서의 이전 캡처. 두 ZIP의 모든 본문·첨부 payload SHA256 동일, 최신 캡처 보존.'})

# Temporary link-repair copies are no longer needed once every link and part passed.
for name in ['before-links.xlsx','rebased-links.xlsx']:
    p=WORK/name
    if p.is_file():extra_cleanup.append({'source':p.relative_to(ROOT).as_posix(),'size':p.stat().st_size,'sha256':digest(p),'reason':'원문 링크 수정 검증을 마친 임시 복사본'})
empty_candidates=[]
for top in ['2025년 자료','2026년 기안서 자료','보고서별 폴더','기안·보고 금액총괄','관리자료/수집·검토','관리자료/이전작업','관리자료/이전캡처']:
    start=ROOT/top
    if not start.is_dir():continue
    for current,dirs,files in os.walk(start):
        dirs[:]=[n for n in dirs if n not in ('node_modules','.git') and not os.path.islink(Path(current)/n) and not getattr(os.path,'isjunction',lambda p:False)(Path(current)/n)]
        empty_candidates.append(Path(current).relative_to(ROOT).as_posix())
(WORK/'finish_cleanup.json').write_text(json.dumps({'workspace':str(ROOT),'deleteFiles':extra_cleanup,'emptyCandidates':sorted(empty_candidates,key=len,reverse=True)},ensure_ascii=False,indent=2),encoding='utf-8')
receipt={'canonicalFilesVerified':len(checked),'canonicalBytesVerified':sum(x['size'] for x in audit['canonicalHashIndex']),'hashMismatches':failures,'documents':171,'attachments':533,'businessFolders':len(plan['projects']),'duplicatePriorCaptureFiles':len(extra_cleanup)-2,'extraCleanupBytes':sum(x['size'] for x in extra_cleanup)}
(WORK/'preservation_receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(receipt,ensure_ascii=False))
