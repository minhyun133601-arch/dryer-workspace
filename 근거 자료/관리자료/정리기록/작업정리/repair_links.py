"""Rebase file references after the date/title organization without changing finance."""
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import urllib.parse
import xml.etree.ElementTree as ET
import zipfile

ROOT=Path(__file__).resolve().parents[1]
WORK=Path(__file__).resolve().parent
plan=json.loads((WORK/'action_plan.json').read_text(encoding='utf-8'))
def normalized(p):
    return os.path.normpath(str(p).replace('/',os.sep)).casefold()
prefixes=sorted([(normalized(ROOT/x['source']),ROOT/x['target']) for x in plan['moves']],key=lambda p:len(p[0]),reverse=True)
dups={normalized(ROOT/a):ROOT/b for a,b in plan['duplicateCanonicalMap'].items()}
def map_path(p):
    current=Path(p)
    key=normalized(current)
    if key in dups:
        current=dups[key];key=normalized(current)
    for before,after in prefixes:
        if key==before:return after
        if key.startswith(before+os.sep):
            return after/str(current)[len(before)+1:]
    return current
def map_string(value):
    if value.lower().startswith('file:'):
        u=urllib.parse.urlsplit(value)
        raw=urllib.parse.unquote(u.path)
        if re.match(r'^/[A-Za-z]:',raw):raw=raw[1:]
        mapped=map_path(raw)
        result=mapped.resolve().as_uri()
        if u.fragment:result+='#'+u.fragment
        return result
    if re.match(r'^[A-Za-z]:[/\\]',value):
        return map_path(value).as_posix()
    for before in ['_work_2025/','_work_approvals/','_work_heat_exchanger/','2025년 자료/','2026년 기안서 자료/','보고서별 폴더/','final-investment-hub/']:
        if value.replace('\\','/').startswith(before):
            return map_path(ROOT/value).as_posix()
    return value
restored={'311810':'2025-06-24','306011':'2025-05-19','329247':'2025-12-02'}
ap=ROOT/'관리자료/수집·검토/_work_approvals'
review=json.loads((ap/'approval_review_data.json').read_text(encoding='utf-8'))
canonical_docs={str(d['docId']):d for d in review['documents']}
for d in canonical_docs.values():
    for key in ['captureFolder','bodyJpgPath','bodyPdfPath','attachmentDir','zipPath']:
        d[key]=map_string(d[key])

def transform(x):
    if isinstance(x,list):return [transform(y) for y in x]
    if isinstance(x,dict):
        y={k:transform(v) for k,v in x.items()}
        doc_id=str(y.get('docId',''))
        if doc_id in canonical_docs:
            original=canonical_docs[doc_id]
            for k in ['captureFolder','bodyJpgPath','bodyPdfPath','attachmentDir','zipPath']:
                if k in y:y[k]=original[k]
            if doc_id in restored and 'date' in y and not re.match(r'^20\d\d-\d\d-\d\d$',y.get('date') or ''):
                y['date']=restored[doc_id]
        return y
    if isinstance(x,str):return map_string(x)
    return x
changed_json=[]
for work in [ROOT/'관리자료/수집·검토/_work_2025',ap,ROOT/'관리자료/수집·검토/_work_heat_exchanger']:
    for current,dirs,files in os.walk(work):
        dirs[:]=[n for n in dirs if n not in ('node_modules','.git') and not os.path.islink(Path(current)/n) and not getattr(os.path,'isjunction',lambda p:False)(Path(current)/n)]
        for name in files:
            p=Path(current)/name
            if p.suffix!='.json':continue
            try:old=json.loads(p.read_text(encoding='utf-8-sig'))
            except (ValueError,UnicodeDecodeError):continue
            new=transform(old)
            if new!=old:
                p.write_text(json.dumps(new,ensure_ascii=False,indent=2),encoding='utf-8');changed_json.append(p.relative_to(ROOT).as_posix())

# Rebase only standard external link relationships. Worksheet values, formulas,
# styles, tables, and internal navigation retain their exact original bytes.
book=ROOT/'최종자료/2025-2026 금액총괄.xlsx'
backup=WORK/'before-links.xlsx'
shutil.copy2(book,backup)
temp=WORK/'rebased-links.xlsx'
ET.register_namespace('','http://schemas.openxmlformats.org/package/2006/relationships')
changed_rel=0;local_links=[];preserved_parts={};repaired_parts=[]
with zipfile.ZipFile(backup) as zin,zipfile.ZipFile(temp,'w') as zout:
    for info in zin.infolist():
        payload=zin.read(info.filename)
        if info.filename.startswith('xl/worksheets/_rels/') and info.filename.endswith('.rels'):
            doc=ET.fromstring(payload);changed=False
            for rel in doc:
                target=rel.get('Target','')
                if target.lower().startswith('file:'):
                    new=map_string(target)
                    if new!=target:rel.set('Target',new);changed=True;changed_rel+=1
                    raw=urllib.parse.unquote(urllib.parse.urlsplit(new).path)
                    if re.match(r'^/[A-Za-z]:',raw):raw=raw[1:]
                    local_links.append(raw)
            if changed:payload=ET.tostring(doc,encoding='utf-8',xml_declaration=True);repaired_parts.append(info.filename)
        else:preserved_parts[info.filename]=hashlib.sha256(payload).hexdigest()
        zout.writestr(info,payload)
missing=sorted({x for x in local_links if not Path(x).exists()})
assert not missing,missing[:10]
with zipfile.ZipFile(temp) as z:
    assert z.testzip() is None
    for name,digest in preserved_parts.items():assert hashlib.sha256(z.read(name)).hexdigest()==digest,name
    formula_count=sum(len(re.findall(rb'<(?:\w+:)?f(?:\s|>)',z.read(n))) for n in z.namelist() if re.match(r'xl/worksheets/sheet\d+\.xml$',n))
    sheet_count=len(ET.fromstring(z.read('xl/workbook.xml')).find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheets'))
assert formula_count==314,formula_count
assert sheet_count==8,sheet_count
shutil.copy2(temp,book)

# The local financial screen is rebuilt with its source paths, same amounts.
builder=ap/'build_review_html.py'
s=builder.read_text(encoding='utf-8')
s=s.replace('ROOT=WORK.parent',"ROOT=next(p for p in WORK.parents if p.name=='근거 자료')")
s=s.replace("DEST=ROOT/'기안·보고 금액총괄'","DEST=ROOT/'최종자료'")
s=s.replace("XLSX_NAME='2025-2026_기안·보고_사업별금액총괄.xlsx'","XLSX_NAME='2025-2026 금액총괄.xlsx'")
builder.write_text(s,encoding='utf-8')
launcher=ROOT/'최종자료/2027 추진안건.html'
s=launcher.read_text(encoding='utf-8').replace('final-investment-hub/dist/index.html','../관리자료/웹소스/final-investment-hub/dist/index.html')
launcher.write_text(s,encoding='utf-8')
repo=ROOT/'관리자료/웹소스/final-investment-hub'
shutil.copy2(book,repo/'dist/downloads/approval-reconciliation.xlsx')
receipt={'changedJsonFiles':changed_json,'rewrittenExternalLinks':changed_rel,'localLinks':len(local_links),'missingLocalLinks':missing,'preservedZipParts':len(preserved_parts),'rewrittenZipParts':repaired_parts,'formulaCount':formula_count,'sheetCount':sheet_count,'book':book.relative_to(ROOT).as_posix()}
(WORK/'link_repair_receipt.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in receipt.items() if k!='changedJsonFiles'},ensure_ascii=False))
