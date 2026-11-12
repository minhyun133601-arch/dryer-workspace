"""Validate the user's dryer-only report retention and preserve the mixed PDF."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import stat

WORK = Path(__file__).resolve().parent
manifest = json.loads((WORK/'retention-manifest.json').read_text(encoding='utf-8'))
root = Path('C:/Users/user/Desktop/근거 자료').resolve()
project = Path('C:/Users/user/Desktop/프로젝트').resolve()

def sha(path):
    result = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(4*1024*1024), b''):
            result.update(block)
    return result.hexdigest()

def scoped(path):
    value = Path(path).resolve()
    if value == root or not value.is_relative_to(root) or value.is_relative_to(project):
        raise ValueError(f'Outside the explicitly authorized report scope: {path}')
    return value

preserved = []
for record in manifest['pre_recycle_copies']:
    source, destination = scoped(record['source']), scoped(record['destination'])
    if sha(source) != record['sha256']:
        raise ValueError('Mixed-folder dryer PDF changed; review required.')
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists():
        if sha(destination) != record['sha256']:
            raise ValueError('Different existing dryer PDF was preserved.')
    else:
        shutil.copy2(source, destination)
    if sha(destination) != record['sha256']:
        raise ValueError('Dryer PDF copy verification failed.')
    preserved.append(dict(record, verified=True))

keeps = [scoped(record['path']) for record in manifest['keep'] if Path(record['path']).exists()]
keeps += [scoped(record['destination']) for record in preserved]
targets = []
for record in [*manifest['delete_candidates'], *manifest['conditional_delete_candidates']]:
    path = scoped(record['path'])
    if any(path == keep or keep.is_relative_to(path) for keep in keeps):
        raise ValueError(f'Candidate contains protected dryer material: {path}')
    if not path.exists():
        continue
    if path.is_symlink() or os.path.isjunction(path):
        raise ValueError('Reparse point must not be recycled recursively.')
    if path.is_dir():
        for folder, dirs, files in os.walk(path, followlinks=False):
            for name in dirs+files:
                child = Path(folder)/name
                if child.is_symlink() or os.path.isjunction(child) or child.lstat().st_file_attributes & stat.FILE_ATTRIBUTE_REPARSE_POINT:
                    raise ValueError(f'Candidate contains a protected reparse point: {child}')
    targets.append({'path': str(path), 'is_directory': path.is_dir(), 'name': path.name})
result = {'scope': str(root), 'preserved_copies': preserved, 'keep_paths': [str(path) for path in keeps], 'targets': targets, 'project': str(project), 'project_checks': {str(path): sha(path) for path in [project/'index.html', project/'프로젝트 실행.cmd', project/'exports/건조기 7층 화덕.html']}}
(WORK/'validated-recycle-targets.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'validated_targets': len(targets), 'mixed_dryer_pdf_verified': len(preserved), 'protected_paths': len(keeps)}))
