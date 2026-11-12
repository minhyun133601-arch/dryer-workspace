"""Read-only, no-reparse storage inventory for the local project and own recycle bin."""
from pathlib import Path
from collections import defaultdict
import ctypes
import heapq
import json
import os

WORK = Path(__file__).resolve().parent
PROJECT = WORK.parents[1]
REPARSE = 0x400

def long_path(path):
    value = os.path.abspath(path)
    return value if value.startswith('\\\\?\\') else '\\\\?\\' + value

def inventory(root):
    sizes = defaultdict(int)
    counts = defaultdict(int)
    top = []
    errors = []
    skipped = []
    stack = [Path(root)]
    while stack:
        directory = stack.pop()
        try:
            with os.scandir(long_path(directory)) as entries:
                for entry in entries:
                    path = directory / entry.name
                    details = entry.stat(follow_symlinks=False)
                    if getattr(details, 'st_file_attributes', 0) & REPARSE:
                        skipped.append(str(path))
                        continue
                    if entry.is_dir(follow_symlinks=False):
                        stack.append(path)
                        continue
                    if not entry.is_file(follow_symlinks=False):
                        continue
                    relative = path.relative_to(root)
                    key = '/'.join(relative.parts[:2]) if len(relative.parts) > 2 else relative.parts[0]
                    sizes[key] += details.st_size
                    counts[key] += 1
                    item = (details.st_size, str(path), details.st_mtime)
                    if len(top) < 25:
                        heapq.heappush(top, item)
                    elif item > top[0]:
                        heapq.heapreplace(top, item)
        except OSError as error:
            errors.append({'path': str(directory), 'error': str(error)})
    return {'root': str(root), 'bytes': sum(sizes.values()), 'files': sum(counts.values()),
            'groups': [{'path': key, 'bytes': size, 'files': counts[key]} for key, size in sorted(sizes.items(), key=lambda item: -item[1])],
            'largest': [{'path': path, 'bytes': size, 'modified': modified} for size, path, modified in sorted(top, reverse=True)],
            'skipped_reparse': skipped, 'errors': errors}

if __name__ == '__main__':
    result = inventory(PROJECT)
    (WORK / 'project-inventory.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'bytes': result['bytes'], 'files': result['files'], 'groups': result['groups'][:15],
                      'largest': result['largest'][:8], 'skipped_reparse': len(result['skipped_reparse']), 'errors': len(result['errors'])}, ensure_ascii=False))
