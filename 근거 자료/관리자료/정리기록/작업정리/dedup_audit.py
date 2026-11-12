"""Read-only byte-identity audit of evidence originals and disposable working copies."""
from concurrent.futures import ThreadPoolExecutor, as_completed
from collections import Counter, defaultdict
from pathlib import Path
import hashlib
import json
import re
import urllib.parse
import zipfile
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(__file__).resolve().parent / 'dedup_audit.json'
CANONICAL_DIRS = [ROOT/'2025년 자료', ROOT/'2026년 기안서 자료', ROOT/'보고서별 폴더']
CANDIDATE_DIRS = [ROOT/'.playwright-mcp', ROOT/'_work_2025/downloads',
                  ROOT/'_work_approvals/downloads', ROOT/'_work_approvals/proposal_a_attachments',
                  ROOT/'_work_approvals/proposal_a_sources']

def relative(path):
    return path.relative_to(ROOT).as_posix()

def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda: f.read(4*1024*1024), b''):
            h.update(block)
    st = path.stat()
    return {'path': relative(path), 'size': st.st_size, 'sha256': h.hexdigest()}

def digest_many(paths, phase):
    result = []
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(digest, p): p for p in paths}
        for f in as_completed(futures):
            p = futures[f]
            try:
                result.append(f.result())
            except Exception as e:
                errors.append({'phase':phase, 'path':relative(p), 'error':repr(e)})
    result.sort(key=lambda x:x['path'])
    return result

def classify_unique(path):
    s = path.as_posix()
    ext = path.suffix.lower()
    if path.parent.name == '.playwright-mcp' and ext in ('.log', '.yml', '.yaml', '.png'):
        return 'generated_browser_inspection', 'Browser console, accessibility snapshot, or screen capture; not a captured original document backup.'
    if 'proposal_a_sources/' in s and ext in ('.txt', '.png'):
        return 'generated_extraction_or_ocr', 'Text extraction or OCR render prepared from an already preserved document body.'
    if ext in ('.xlsx', '.xls', '.pptx', '.docx', '.pdf'):
        return 'unique_potential_original', 'No byte-identical file exists in the three canonical evidence folders. Preserve as an additional original pending document-level review.'
    if ext == '.zip':
        return 'unmatched_document_backup', 'No byte-identical canonical ZIP or other canonical file found. ZIP bytes may differ between captures; preserve pending a separate payload-level comparison.'
    if ext in ('.jpg', '.jpeg', '.png', '.tif', '.tiff', '.bmp'):
        return 'unique_potential_source_image', 'Not byte-identical to canonical evidence. Preserve unless proven to be a generated render.'
    return 'unique_review_needed', 'No byte-identical canonical evidence file found; do not infer disposability from its name.'

errors = []
canonical_paths = sorted({p.resolve() for folder in CANONICAL_DIRS if folder.is_dir() for p in folder.rglob('*') if p.is_file()})
print(json.dumps({'phase':'canonical_hash_started', 'files':len(canonical_paths), 'bytes':sum(p.stat().st_size for p in canonical_paths)}), flush=True)
canonical = digest_many(canonical_paths, 'canonical')
by_hash = defaultdict(list)
for x in canonical:
    by_hash[(x['size'],x['sha256'])].append(x['path'])
print(json.dumps({'phase':'canonical_hash_complete', 'files':len(canonical), 'uniqueHashes':len(by_hash)}), flush=True)

candidates = {p.resolve() for folder in CANDIDATE_DIRS if folder.is_dir() for p in folder.rglob('*') if p.is_file()}
workbook = next((ROOT/'기안·보고 금액총괄').glob('*.xlsx'))
linked_work_files = set()
with zipfile.ZipFile(workbook) as z:
    for name in z.namelist():
        if not name.startswith('xl/worksheets/') or not name.endswith('.rels'):
            continue
        for e in ET.fromstring(z.read(name)):
            if not e.attrib.get('Type','').endswith('/hyperlink'):
                continue
            target = e.attrib.get('Target','')
            if not target.startswith('file:'):
                continue
            path_text = urllib.parse.unquote(urllib.parse.urlsplit(target).path)
            if re.match(r'^/[A-Za-z]:/', path_text):
                path_text = path_text[1:]
            p = Path(path_text).resolve()
            if not p.is_file():
                continue
            try:
                local = p.relative_to(ROOT)
            except ValueError:
                continue
            if local.parts and local.parts[0].startswith('_work_'):
                candidates.add(p)
                linked_work_files.add(relative(p))
print(json.dumps({'phase':'candidate_hash_started', 'files':len(candidates), 'bytes':sum(p.stat().st_size for p in candidates), 'xlsxLinkedWorkFiles':len(linked_work_files)}), flush=True)
candidate_hashes = digest_many(sorted(candidates), 'candidate')
duplicates, unique = [], []
for x in candidate_hashes:
    matches = by_hash.get((x['size'],x['sha256']), [])
    if matches:
        # Prefer an identical basename when there is one; never merge canonical records.
        name = Path(x['path']).name
        best = next((p for p in matches if Path(p).name == name), matches[0])
        duplicates.append({'source':x['path'], 'canonical':best, 'sha256':x['sha256'], 'size':x['size'],
                           'canonicalMatches':len(matches), 'linkedFromFinalWorkbook':x['path'] in linked_work_files,
                           'suggestion':'Rewrite active links to canonical, then the redundant working copy can be removed.'})
    else:
        kind, reason = classify_unique(Path(x['path']))
        unique.append({'source':x['path'],'size':x['size'],'sha256':x['sha256'],'kind':kind,'reason':reason,
                       'linkedFromFinalWorkbook':x['path'] in linked_work_files})

# Packaging archives are generated deploy/export artifacts, kept separate from source backup ZIPs.
archive_paths = set()
for folder in [ROOT/'이전작업_보관', ROOT/'_work_approvals', ROOT/'_work_2025', ROOT/'final-investment-hub']:
    if not folder.is_dir():
        continue
    for p in folder.glob('*.tar.gz'):
        archive_paths.add(p)
for p in ROOT.glob('*오프라인.zip'):
    archive_paths.add(p)
generated_archives = [{'source':relative(p), 'size':p.stat().st_size,
                       'kind':'generated_site_or_offline_release_archive',
                       'reason':'Build/export packaging, not an approval/report original. Latest deploy source and working dist remain available; an old release archive can be removed after selecting the retained final version.'}
                      for p in sorted(archive_paths)]
stats = {
    'canonicalFiles':len(canonical), 'canonicalBytes':sum(x['size'] for x in canonical), 'canonicalUniqueHashes':len(by_hash),
    'candidateFiles':len(candidate_hashes), 'candidateBytes':sum(x['size'] for x in candidate_hashes),
    'exactDuplicateFiles':len(duplicates), 'exactDuplicateBytes':sum(x['size'] for x in duplicates),
    'uniqueCandidateFiles':len(unique), 'uniqueCandidateBytes':sum(x['size'] for x in unique),
    'uniqueKinds':dict(Counter(x['kind'] for x in unique)),
    'uniqueKindBytes':dict((kind,sum(x['size'] for x in unique if x['kind']==kind)) for kind in sorted({x['kind'] for x in unique})),
    'xlsxLinkedWorkFileCount':len(linked_work_files),
    'xlsxLinkedWorkDuplicates':sum(x['linkedFromFinalWorkbook'] for x in duplicates),
    'xlsxLinkedWorkUnique':sum(x['linkedFromFinalWorkbook'] for x in unique),
    'generatedReleaseArchives':len(generated_archives), 'generatedReleaseArchiveBytes':sum(x['size'] for x in generated_archives),
    'hashErrors':len(errors),
}
result = {'workspace':str(ROOT),'readOnlyAudit':True,'sourceContentReadOnlyForHashing':True,
          'hashAlgorithm':'SHA256','workers':4,'canonicalFolders':[relative(p) for p in CANONICAL_DIRS],
          'candidateFolders':[relative(p) for p in CANDIDATE_DIRS],
          'canonicalHashIndex':canonical,'duplicates':duplicates,'uniqueCandidates':unique,
          'generatedReleaseArchives':generated_archives,'stats':stats,'errors':errors,
          'decisionBoundary':'Only byte-identical candidates are proven duplicates. Unmatched ZIP captures may contain equivalent content but are not classified as deletable originals by this audit. Never delete canonical evidence files based on repeated hashes across distinct document folders.'}
OUT.write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'phase':'complete','output':str(OUT),'stats':stats},ensure_ascii=False), flush=True)
