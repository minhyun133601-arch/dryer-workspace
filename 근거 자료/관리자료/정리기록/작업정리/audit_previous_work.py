"""Additional read-only audit. Never follows node_modules junctions or other reparse links."""
from concurrent.futures import ThreadPoolExecutor
from collections import Counter, defaultdict
from pathlib import Path
import hashlib
import json
import os

ROOT = Path(__file__).resolve().parents[1]
AUDIT = Path(__file__).resolve().parent / 'dedup_audit.json'
OLD = ROOT/'이전작업_보관'/'_work'
skipped = []

def walk(folder):
    for e in os.scandir(folder):
        p = Path(e.path)
        if e.is_symlink() or (hasattr(p,'is_junction') and p.is_junction()):
            skipped.append(p.relative_to(ROOT).as_posix())
            continue
        if e.is_dir(follow_symlinks=False):
            yield from walk(p)
        elif e.is_file(follow_symlinks=False):
            yield p

def digest(p):
    h=hashlib.sha256()
    with p.open('rb') as f:
        for block in iter(lambda:f.read(4*1024*1024),b''):
            h.update(block)
    return {'path':p.relative_to(ROOT).as_posix(),'size':p.stat().st_size,'sha256':h.hexdigest()}

audit=json.loads(AUDIT.read_text(encoding='utf-8'))
aux=list(ROOT.glob('*.pptx'))
aux.extend(p for p in walk(ROOT/'final-investment-hub'/'dist') if p.is_file())
aux.extend(p for p in (ROOT/'이전작업_보관').iterdir() if p.is_file() and p.suffix.lower() in ('.xlsx','.pptx','.pdf'))
with ThreadPoolExecutor(max_workers=4) as pool:
    aux_index=list(pool.map(digest,sorted(set(aux))))
by_hash=defaultdict(list)
for x in audit['canonicalHashIndex']+aux_index:
    by_hash[(x['size'],x['sha256'])].append(x['path'])
files=list(walk(OLD))
with ThreadPoolExecutor(max_workers=4) as pool:
    index=list(pool.map(digest,sorted(files)))
duplicates=[];generated=[];preserve=[]
generated_dirs={'deck_assets','deck_build','early_ocr','hub_pdf_qa','late_ocr','plan_render','tessdata','xlsx_previews','year_bridge'}
for x in index:
    p=Path(x['path']);relative=p.relative_to(Path('이전작업_보관')/'_work')
    matches=by_hash.get((x['size'],x['sha256']),[])
    if matches:
        duplicates.append({'source':x['path'],'canonical':matches[0],'sha256':x['sha256'],'size':x['size'],
                           'otherCanonicalMatches':matches[1:],'reason':'Byte-identical to retained original, current web asset, or previous final deliverable. Retain at least one canonical target before removing this working copy.'})
        continue
    first=relative.parts[0]
    ext=p.suffix.lower()
    if first in generated_dirs:
        kind='downloaded_ocr_model' if first=='tessdata' else 'generated_render_extract_or_export'
        reason='OCR language model can be downloaded again; not company evidence.' if first=='tessdata' else 'Builder/QA output, document image extraction, draft export, or OCR/render prepared from preserved originals.'
        generated.append({'source':x['path'],'size':x['size'],'sha256':x['sha256'],'kind':kind,'reason':reason})
    elif p.name.startswith('runtime_'):
        generated.append({'source':x['path'],'size':x['size'],'sha256':x['sha256'],'kind':'runtime_smoke_test','reason':'Synthetic dependency/runtime verification fixture, not a company original.'})
    elif ext in ('.png','.jpg','.jpeg','.bmp','.ndjson'):
        generated.append({'source':x['path'],'size':x['size'],'sha256':x['sha256'],'kind':'generated_review_preview','reason':'Screen capture, OCR contact sheet, chart preview, or inspection dump. No unique source workbook/PDF is represented by this file.'})
    else:
        preserve.append({'source':x['path'],'size':x['size'],'sha256':x['sha256'],
                         'kind':'source_code_or_audit_data' if ext in ('.py','.mjs','.json','.md','.txt') else 'review_needed',
                         'reason':'Keep implementation and financial extraction/audit data for traceability.'})

stats={'realFilesExcludingJunctions':len(index),'realBytesExcludingJunctions':sum(x['size'] for x in index),
       'exactDuplicateFiles':len(duplicates),'exactDuplicateBytes':sum(x['size'] for x in duplicates),
       'generatedRemovableFiles':len(generated),'generatedRemovableBytes':sum(x['size'] for x in generated),
       'preserveAuditSourceFiles':len(preserve),'preserveAuditSourceBytes':sum(x['size'] for x in preserve),
       'unknownBinaryOriginalCandidates':[x for x in preserve if x['kind']=='review_needed'],
       'sourcePDFCount':sum(Path(x['path']).suffix.lower()=='.pdf' for x in index),
       'workbookCount':sum(Path(x['path']).suffix.lower() in ('.xlsx','.xls') for x in index),
       'presentationCount':sum(Path(x['path']).suffix.lower() in ('.pptx','.ppt') for x in index)}
audit['auxiliaryCanonicalHashIndex']=sorted(aux_index,key=lambda x:x['path'])
audit['previousWorkAudit']={'folder':str(OLD.relative_to(ROOT)),'noFilesChanged':True,'skippedReparseLinks':sorted(set(skipped)),
                            'stats':stats,'duplicates':duplicates,'generatedCandidates':generated,'preserveCandidates':preserve,
                            'deletionBoundary':'Do not recursively traverse node_modules junctions. Only remove the link object if desired, never the linked runtime directory. No deletion/moving occurred in this audit.'}
AUDIT.write_text(json.dumps(audit,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'auxiliaryCanonicalFiles':len(aux_index),'previousWork':stats,'skippedReparseLinks':sorted(set(skipped))},ensure_ascii=False))
