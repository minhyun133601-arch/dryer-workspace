"""Read only the current user's Recycle Bin metadata and payload sizes."""
from pathlib import Path
import ctypes
from ctypes import wintypes
from datetime import datetime, timezone
import json
import os
import struct

WORK = Path(__file__).resolve().parent
REPARSE = 0x400

def long_path(path):
    value = os.path.abspath(path)
    return value if value.startswith('\\\\?\\') else '\\\\?\\' + value

def measure(path):
    stack = [path]
    size = 0
    errors = 0
    while stack:
        item = stack.pop()
        try:
            stat = os.stat(long_path(item), follow_symlinks=False)
            if getattr(stat, 'st_file_attributes', 0) & REPARSE:
                continue
            if item.is_dir():
                with os.scandir(long_path(item)) as entries:
                    stack.extend(item / entry.name for entry in entries)
            else:
                size += stat.st_size
        except OSError:
            errors += 1
    return size, errors

if __name__ == '__main__':
    import sys
    root = Path(sys.argv[1])
    assert root.parent == Path('C:/$Recycle.Bin') and root.name.startswith('S-1-5-21-')
    records = []
    for path in root.iterdir():
        if not path.name.startswith('$I') or not path.is_file():
            continue
        try:
            raw = path.read_bytes()
            if len(raw) < 24:
                continue
            version, original_size, filetime = struct.unpack_from('<QQQ', raw)
            offset = 28 if version == 2 else 24
            original = raw[offset:].decode('utf-16-le', errors='replace').split('\0', 1)[0]
            data = path.with_name('$R' + path.name[2:])
            size, errors = measure(data)
            records.append({'original': original, 'recycle_payload': str(data), 'bytes': size,
                            'original_metadata_bytes': original_size, 'measure_errors': errors})
        except OSError:
            pass
    result = {'bytes': sum(row['bytes'] for row in records), 'items': len(records),
              'records': sorted(records, key=lambda row: -row['bytes'])}
    (WORK / 'recycle-inventory.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'bytes': result['bytes'], 'items': result['items'], 'largest': result['records'][:10]}, ensure_ascii=False))
