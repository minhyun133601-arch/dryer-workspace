"""Inventory only: freeze reversible cleanup targets and retained-file hashes."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
AUDIT = Path(__file__).resolve().parent

def sha(file):
    digest = hashlib.sha256()
    with file.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()

def files_in(file):
    if file.is_symlink():
        raise ValueError(f'Reparse point must be preserved: {file}')
    if file.is_file():
        return [file]
    result = []
    for child in file.iterdir():
        result.extend(files_in(child))
    return result

targets = []
def add(relative, reason, evidence=None):
    file = ROOT / relative
    if not file.exists():
        return
    absolute = file.resolve(strict=True)
    if absolute == ROOT or not absolute.is_relative_to(ROOT):
        raise ValueError('Cleanup target outside project')
    records = files_in(file)
    targets.append(dict(path=str(absolute), relative=relative, is_directory=file.is_dir(),
                        files=len(records), bytes=sum(p.stat().st_size for p in records),
                        reason=reason, evidence=evidence))

for file in (ROOT / 'tmp').iterdir():
    if file.suffix != '.json':
        add(file.relative_to(ROOT).as_posix(), 'Obsolete deployment archive or visual QA output')
for file in (ROOT / '.playwright-mcp').iterdir():
    if file.is_file():
        add(file.relative_to(ROOT).as_posix(), 'Browser inspection output; canonical PDF retained')
for file in (ROOT / 'workspace/furnace-review').iterdir():
    if file.name != 'photo-map.json':
        add(file.relative_to(ROOT).as_posix(), 'Derived burner review image or superseded deployment archive')
add('workspace/review/heat-workspace-desktop.png', 'Obsolete visual QA screenshot')
add('.backups/folder-separation-empty-tree-20261104', 'Empty historical folder tree')

for name in ['KakaoTalk_20261105_105315975.jpg', 'KakaoTalk_20261105_105315975_01.jpg']:
    original = ROOT / 'references/화덕/도면' / name
    duplicate = ROOT / name
    assert original.exists() and sha(original) == sha(duplicate)
    add(name, 'Exact duplicate of retained original drawing', dict(retained=str(original), sha256=sha(original)))

source_root = ROOT.parent / '근거 자료/건물3D 후보도면/원본 DWG/01_전체배치'
for short, expected in [
    ('16ca82299ae3', '16ca82299ae3ceeca64dda51209a5c2273e8b32167e3b0761dfa913497c9dc33'),
    ('67b3916ee636', '67b3916ee636ae1f79a3714854b90ca21bd87af88b4ff8f11ff89ff912e80e31'),
]:
    originals = [p for p in source_root.rglob(f'*{short}*.dwg') if sha(p) == expected]
    copy = ROOT / f'workspace/campus-3d-20261104/preview/{short}/input/drawing.dwg'
    assert originals and sha(copy) == expected
    add(f'workspace/campus-3d-20261104/preview/{short}', 'Derived DWG/DXF preview; exact original verified and retained',
        dict(retained=str(originals[0]), sha256=expected))

for relative in [
    'workspace/campus-3d-20261104/portal-fixture',
    'workspace/campus-3d-20261104/portal-pdf-fixture',
    'workspace/campus-3d-20261104/__pycache__',
    'workspace/campus-3d-20261104/pdf-conversion/__pycache__',
    'workspace/production-collection-20261104/archive-member-check-dacec216',
    'workspace/production-collection-20261104/archive-member-featurecheck',
    'workspace/production-collection-20261104/batch-runner-check-d04f0b8a',
    'workspace/production-collection-20261104/collection-copy-check-4h_qf641',
    'workspace/production-collection-20261104/collection-copy-check-q2lrn9j0',
    'workspace/production-collection-20261104/content-store-check-1ec26984',
    'workspace/production-collection-20261104/retry-io-check-e43266c3',
    'workspace/production-collection-20261104/__pycache__',
]:
    add(relative, 'Completed test fixture or rebuildable Python bytecode')

moves = []
for file in (ROOT / 'tmp').glob('*.json'):
    destination = ROOT / 'workspace/review/heat-audits' / file.name
    assert not destination.exists()
    moves.append(dict(source=str(file), destination=str(destination), sha256=sha(file)))

protected = set()
for relative in ['apps', 'assets', 'tooling', 'tests', 'docs', 'exports',
                 'sites/dryer-map-share-20261030/dist', 'references/화덕',
                 'workspace/furnace-drawing-review', 'workspace/outdoor-survey',
                 'workspace/outdoor-video-20261102', 'workspace/outdoor-video-20261102-additions']:
    protected.update(files_in(ROOT / relative))
for relative in ['index.html', 'package.json', 'README.md', '프로젝트 실행.cmd',
                 'workspace/app.js', 'workspace/styles.css', 'workspace/module-registry.js',
                 'workspace/furnace-review/photo-map.json',
                 'workspace/campus-3d-20261104/pdf-conversion/STOPPED-BY-USER.json',
                 '건조기.mp4', '건조기 버너 연소팬 모터코일 소손.pptx', '건조기 연소팬 교제 작업.ppt']:
    protected.add(ROOT / relative)
protected_records = [dict(path=str(file), bytes=file.stat().st_size, sha256=sha(file)) for file in sorted(protected)]
for target in targets:
    candidate = Path(target['path'])
    assert all(candidate != file and not file.is_relative_to(candidate) for file in protected)

plan = dict(root=str(ROOT), mode='recycle_bin_only', targets=targets, moves=moves,
            protected=protected_records, preserve_notes=[
                'All current code, app assets, burner originals, exports and hosted files',
                'Rollback backups except an empty historical tree',
                'Stopped DWG/PDF partial conversion results and source originals',
                'Collection/Drive receipts, original source media and GPS evidence'])
(AUDIT / 'plan.json').write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(dict(targets=len(targets), files=sum(t['files'] for t in targets),
                      bytes=sum(t['bytes'] for t in targets), protected_files=len(protected_records),
                      audit_moves=len(moves)), ensure_ascii=False))
