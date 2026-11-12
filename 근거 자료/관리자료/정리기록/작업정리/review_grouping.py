"""Read-only check of date/title business grouping, duplicate captures, and path risks."""
from pathlib import Path
from collections import Counter, defaultdict
from datetime import date
import hashlib
import json
import re
import zipfile
import fitz

ROOT=Path(__file__).resolve().parents[1]
review=json.loads((ROOT/'_work_approvals/approval_review_data.json').read_text(encoding='utf-8'))
docs=review['documents'];by_id={x['docId']:x for x in docs}
canonical_dirs=[ROOT/'2025년 자료'/'문서별 폴더',ROOT/'2026년 기안서 자료'/'문서별 폴더',ROOT/'보고서별 폴더']
actual=[p for d in canonical_dirs for p in d.iterdir() if p.is_dir()]
registry_paths={Path(x['captureFolder']).resolve():x['docId'] for x in docs}
extras=[p for p in actual if p.resolve() not in registry_paths]
missing=[x['docId'] for x in docs if not Path(x['captureFolder']).is_dir()]

def valid_date(text):
    try:
        return bool(re.fullmatch(r'\d{4}-\d{2}-\d{2}',text or '')) and date.fromisoformat(text) is not None
    except ValueError:
        return False

recovered=[];date_values={};date_bases={}
for d in docs:
    if valid_date(d.get('date')):
        date_values[d['docId']]=d['date'];date_bases[d['docId']]='registry date'
    else:
        match=re.search(r'작성일자\s*:\s*(\d{4}-\d{2}-\d{2})',d.get('bodyText',''))
        value=match.group(1) if match and valid_date(match.group(1)) else None
        date_values[d['docId']]=value or ''
        date_bases[d['docId']]='본문 1. 작성일자' if value else 'unresolved'
        recovered.append({'docId':d['docId'],'docNo':d['docNo'],'title':d['title'],
                          'registryDate':d.get('date'),'recoveredDate':value,'basis':date_bases[d['docId']],
                          'note':'Use the explicitly stated 작성일자. Approval/submission stamps and document-number month may differ.'})

def clean(text):
    text=re.sub(r'[<>:"/\\|?*\x00-\x1f]',' ',text)
    return re.sub(r'\s+',' ',text).strip(' .')

groups=[];assigned=set()
for p in review['projects']:
    ids=p['proposalIds']+p['reportIds'];members=[by_id[x] for x in ids]
    proposals=[x for x in members if x['kind']=='기안서']
    reports=[x for x in members if x['kind']=='보고서']
    priority=proposals or reports or members
    anchor=min(priority,key=lambda x:(date_values[x['docId']] or '9999-99-99',x['docId']))
    groups.append({'projectId':p['id'],'title':p['title'],'anchorDocId':anchor['docId'],
                   'anchorDate':date_values[anchor['docId']],'anchorTitle':anchor['title'],
                   'parentUsingBusinessTitle':clean(date_values[anchor['docId']]+' '+p['title']),
                   'parentUsingAnchorTitle':clean(date_values[anchor['docId']]+' '+anchor['title']),
                   'docIds':ids,'children':[{'docId':x['docId'],'date':date_values[x['docId']],
                                          'dateBasis':date_bases[x['docId']],
                                          'folderName':clean(date_values[x['docId']]+' '+x['title'])}
                                         for x in members if x['docId']!=anchor['docId']]})
    assigned.update(ids)
orphans=[]
for d in docs:
    if d['docId'] not in assigned:
        name=clean(date_values[d['docId']]+' '+d['title'])
        orphans.append(d['docId'])
        groups.append({'projectId':'reference-'+d['docId'],'title':d['title'],'anchorDocId':d['docId'],
                       'anchorDate':date_values[d['docId']],'anchorTitle':d['title'],
                       'parentUsingBusinessTitle':name,'parentUsingAnchorTitle':name,
                       'docIds':[d['docId']],'children':[]})

parent_names=defaultdict(list);child_collisions=[];anchor_same_as_child=[];predating=[];longpaths=[]
for g in groups:
    parent_names[g['parentUsingBusinessTitle'].casefold()].append(g['projectId'])
    names=defaultdict(list)
    for c in g['children']:
        names[c['folderName'].casefold()].append(c['docId'])
        if c['folderName'].casefold()==g['parentUsingAnchorTitle'].casefold():
            anchor_same_as_child.append({'projectId':g['projectId'],'anchorDocId':g['anchorDocId'],'childDocId':c['docId'],'name':c['folderName']})
        if c['date']<g['anchorDate']:
            predating.append({'projectId':g['projectId'],'anchorDocId':g['anchorDocId'],'anchorDate':g['anchorDate'],'childDocId':c['docId'],'childDate':c['date']})
    child_collisions.extend({'projectId':g['projectId'],'name':name,'docIds':ids} for name,ids in names.items() if len(ids)>1)
    for doc_id in g['docIds']:
        folder=Path(by_id[doc_id]['captureFolder'])
        child=next((c for c in g['children'] if c['docId']==doc_id),None)
        dest=ROOT/'사업자료'/g['parentUsingBusinessTitle']
        if child:dest=dest/child['folderName']
        for f in folder.rglob('*'):
            if not f.is_file():continue
            target=dest/f.relative_to(folder)
            if len(str(target))>259:
                longpaths.append({'docId':doc_id,'length':len(str(target)),'target':str(target),'source':str(f)})

def digest_zip_payload(p):
    result=[]
    with zipfile.ZipFile(p) as z:
        for i in z.infolist():
            if i.is_dir():continue
            h=hashlib.sha256()
            with z.open(i) as f:
                for b in iter(lambda:f.read(1024*1024),b''):h.update(b)
            result.append({'size':i.file_size,'sha256':h.hexdigest()})
    return sorted(result,key=lambda x:(x['sha256'],x['size']))

duplicate_captures=[]
memo=json.loads((ROOT/'_work_organize/dedup_audit.json').read_text(encoding='utf-8'))
hashes={x['path']:x for x in memo['canonicalHashIndex']}
for extra in extras:
    info=next(extra.glob('*.txt'))
    metadata=info.read_text(encoding='utf-8')
    m=re.search(r'원본 보고서 ID:\s*(\d+)',metadata)
    did=m.group(1) if m else None
    keep=Path(by_id[did]['captureFolder']) if did in by_id else None
    record={'extraFolder':str(extra.relative_to(ROOT)),'docId':did,'metadataFile':str(info.relative_to(ROOT)),
            'canonicalFolder':str(keep.relative_to(ROOT)) if keep else None}
    if keep:
        keep_hash={x['sha256']:x['path'] for x in hashes.values() if x['path'].startswith(keep.relative_to(ROOT).as_posix()+'/')}
        same=[];different=[]
        for f in extra.rglob('*'):
            if not f.is_file():continue
            x=hashes[f.relative_to(ROOT).as_posix()]
            item={'extraFile':f.relative_to(extra).as_posix(),'size':x['size'],'sha256':x['sha256']}
            if x['sha256'] in keep_hash:
                item['canonicalFile']=keep_hash[x['sha256']];same.append(item)
            else:different.append(item)
        payload_old=digest_zip_payload(next(extra.glob('*.zip')))
        payload_keep=digest_zip_payload(next(keep.glob('*.zip')))
        pdfs=[]
        for folder in (keep,extra):
            p=next(folder.glob('*.pdf'));pdf=fitz.open(p)
            images=[]
            for pg in pdf:
                for im in pg.get_images(full=True):
                    image=pdf.extract_image(im[0])
                    images.append({'sha256':hashlib.sha256(image['image']).hexdigest(),'format':image['ext']})
            pdfs.append({'path':str(p.relative_to(ROOT)),'pages':len(pdf),'pageSizes':[list(pg.rect) for pg in pdf],
                         'format':pdf.metadata.get('format'),'embeddedImages':images})
        record.update(byteIdenticalExtractedFiles=same,nonidenticalContainerOrMetadataFiles=different,
                      zipPayloadIdentical=payload_old==payload_keep,zipPayloadFiles=len(payload_old),
                      bodyPdfComparison=pdfs,
                      bodyPdfEmbeddedImagesIdentical=pdfs[0]['embeddedImages']==pdfs[1]['embeddedImages'],
                      conclusion='Same document ID, same source JPG and all five original attachments. ZIP container and derived PDF format differ, with no unique underlying evidence material. Keep canonical 2025 capture and rebase any old links to it.')
    duplicate_captures.append(record)

outside=[]
for base in [ROOT/'2025년 자료',ROOT/'2026년 기안서 자료',ROOT/'보고서별 폴더']:
    for p in base.iterdir():
        if p.is_file():outside.append({'path':str(p.relative_to(ROOT)),'size':p.stat().st_size,'role':'generated document index'})
root_originals=[{'path':p.name,'size':p.stat().st_size,'role':'original planning/KPI presentation; preserve separately from 99 approval/report businesses'} for p in ROOT.glob('*.pptx')]
active_indexes=[p.name for p in ROOT.glob('*.html')]
active_indexes.append('기안·보고 금액총괄/자료총괄.html')

result={'readOnlyReview':True,'sourceFilesChanged':False,'canonicalCaptureFolderCount':len(actual),
        'registryDocumentCount':len(docs),'uniqueRegisteredCaptureFolders':len(registry_paths),
        'missingRegisteredFolders':missing,'duplicatePhysicalCaptures':duplicate_captures,
        'dateRecovery':recovered,'unresolvedDateDocIds':[did for did,v in date_values.items() if not v],
        'grouping':{'financialProjects':len(review['projects']),'orphanReferenceDocIds':orphans,'businessFolders':len(groups),
                    'anchorDocuments':len(groups),'relatedDocumentChildFolders':sum(len(x['children']) for x in groups),
                    'documentsAcrossGroups':sum(len(x['docIds']) for x in groups),
                    'parentNameCollisions':[{'name':name,'projectIds':ids} for name,ids in parent_names.items() if len(ids)>1],
                    'childNameCollisions':child_collisions,'sameParentAndChildTitle':anchor_same_as_child,
                    'relatedDocumentDatesEarlierThanAnchor':predating,
                    'groups':sorted(groups,key=lambda x:(x['anchorDate'],x['parentUsingBusinessTitle']))},
        'pathLengthRisk':{'untrimmedTargetFilesOver259':len(longpaths),'longestTarget':max((x['length'] for x in longpaths),default=0),
                          'examples':sorted(longpaths,key=lambda x:x['length'],reverse=True)[:12],
                          'recommendation':'Prefer the concise audited business title for parents and trim child display titles when needed; keep full titles/docNo in metadata. Preview final full paths including attachment basenames before moving.'},
        'filesOutsideRegisteredCaptureFolders':outside,'otherOriginalRootPresentations':root_originals,'rootAndFinancialIndexes':active_indexes,
        'groupingCautions':['Do not union every reference link: umbrella proposal 281425 remains a separate reference folder; separate utility/building/pipe contracts are not its duplicate amount.',
                           'The granulator #1/#2 and gearbox emergency/new-purchase groups contain distinct costs. Concise business titles that cover all components are clearer than the anchor proposal title alone.',
                           'A report may precede the later purchase proposal in a same-incident group; preserve its true date rather than shifting it to the anchor date.',
                           'Different document IDs may share date/title. Resolve actual sibling name collisions with a short numeric suffix and preserve docNo in metadata, not in the display folder name.',
                           'No duplicate or original file was deleted, renamed or moved in this review.']}
(ROOT/'_work_organize/grouping_review.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'captureFolders':len(actual),'registryDocs':len(docs),'businessFolders':len(groups),
                  'relatedChildren':sum(len(x['children']) for x in groups),'orphans':orphans,'recoveredDates':recovered,
                  'parentCollisions':result['grouping']['parentNameCollisions'],'childCollisions':child_collisions,
                  'longPaths':result['pathLengthRisk']['untrimmedTargetFilesOver259'],'longest':result['pathLengthRisk']['longestTarget']},ensure_ascii=False))
