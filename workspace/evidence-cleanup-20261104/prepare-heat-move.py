from pathlib import Path
import hashlib
import json
import os

WORK = Path(__file__).resolve().parent
PROJECT = WORK.parents[1]
SOURCE = PROJECT.parent / '근거 자료'
TARGET = PROJECT / 'references' / '열교환기'
relative = [
    '사업자료/2026-01-21 유산)건조기 열교환기(폐열회수 장치) 설치',
    '최종자료/건조기 열교환기 시뮬레이터.html',
    '최종자료/열교환기 백데이터.html',
    '관리자료/수집·검토/_work_heat_exchanger',
    '관리자료/수집·검토/_work_approvals/approval_review_data.json',
    'KPI-전기-가스-월별-2024-2026 (1).xlsx',
    '00_자료열기.html',
    '관리자료/자료관리 안내.txt',
]
entries = []
files = []
for name in relative:
    src = (SOURCE / name).resolve(strict=True)
    dst = (TARGET / name).resolve()
    assert src.is_relative_to(SOURCE.resolve()) and dst.is_relative_to(TARGET.resolve())
    assert not dst.exists(), f'An existing destination was preserved: {dst}'
    candidates = []
    if src.is_dir():
        for folder, directories, names in os.walk(src, followlinks=False):
            for entry in directories + names:
                item = Path(folder) / entry
                assert not item.is_symlink() and not item.is_junction(), f'Reparse point preserved: {item}'
            candidates.extend(Path(folder) / item for item in names)
    else:
        candidates = [src]
    for file in candidates:
        digest = hashlib.sha256()
        with file.open('rb') as stream:
            for block in iter(lambda: stream.read(4 * 1024 ** 2), b''):
                digest.update(block)
        files.append({'relative': file.relative_to(SOURCE).as_posix(), 'bytes': file.stat().st_size, 'sha256': digest.hexdigest()})
    entries.append({'source': str(src), 'destination': str(dst)})
data = {'source_root': str(SOURCE.resolve()), 'target_root': str(TARGET.resolve()), 'entries': entries, 'files': files}
(WORK / 'heat-move-plan.json').write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'move_targets': len(entries), 'files': len(files), 'bytes': sum(row['bytes'] for row in files), 'destination': str(TARGET)}, ensure_ascii=False))
