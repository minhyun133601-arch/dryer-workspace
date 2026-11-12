"""Verify preserved CAD ZIPs and delete only the two authorized extraction trees."""
from pathlib import Path, PurePosixPath
from datetime import datetime, timezone
import argparse
import hashlib
import json
import os
import shutil
import stat
import zlib
import zipfile

WORK = Path(__file__).resolve().parent
BASE = Path(r'C:\Users\user\AppData\Local\Temp\motor-lab-research')
TARGET_NAMES = ('IEC_Small', '160M_FOOT_FRAME')
REPARSE = 0x400

def signature(path):
    details = path.stat()
    return details.st_size, details.st_mtime_ns

def normalized(value):
    value = str(value).replace('\\', '/')
    pure = PurePosixPath(value)
    if pure.is_absolute() or '..' in pure.parts or any(':' in part for part in pure.parts):
        raise ValueError('Unsafe archive or relative path')
    return pure.as_posix().casefold()

def inventory(target):
    files = []
    for folder, directories, names in os.walk(target, followlinks=False):
        for name in directories + names:
            path = Path(folder) / name
            details = path.stat(follow_symlinks=False)
            if getattr(details, 'st_file_attributes', 0) & REPARSE:
                raise ValueError(f'Reparse point preserved: {path}')
        files.extend(Path(folder) / name for name in names)
    return files

def verify_one(name):
    base = BASE.resolve(strict=True)
    target = (base / name).resolve(strict=True)
    archive = (base / (name + '.zip')).resolve(strict=True)
    if target.parent != base or target.name not in TARGET_NAMES or target.is_symlink() or target.is_junction():
        raise ValueError('Unexpected extraction target')
    before = signature(archive)
    entries = []
    empty_placeholders = []
    with zipfile.ZipFile(archive) as zipped:
        members = {}
        for info in zipped.infolist():
            if info.is_dir():
                continue
            if stat.S_IFMT(info.external_attr >> 16) not in (0, stat.S_IFREG):
                raise ValueError('Non-regular archive member')
            key = normalized(info.filename)
            if key in members:
                raise ValueError('Duplicate archive member')
            members[key] = info
        bad_member = zipped.testzip()
        if bad_member is not None:
            raise ValueError('Archive CRC failed: ' + bad_member)
        for path in inventory(target):
            relative = path.relative_to(target).as_posix()
            info = members.get(normalized(relative))
            if info is None:
                raise ValueError(f'Unarchived local file preserved: {relative}')
            local_before = signature(path)
            crc = 0
            with path.open('rb') as stream:
                for block in iter(lambda: stream.read(1024 * 1024), b''):
                    crc = zlib.crc32(block, crc)
            if signature(path) != local_before:
                raise ValueError('Local file changed during verification')
            if local_before[0] != info.file_size or crc & 0xffffffff != info.CRC:
                if local_before[0] == 0 and name == 'IEC_Small' and relative == 'ES1AS143610_0.1.dwg':
                    # Preserve the exact empty placeholder separately. The ZIP
                    # contains the complete, CRC-validated manufacturer drawing.
                    backup = WORK / 'motor-empty-placeholder' / relative
                    backup.parent.mkdir(parents=True, exist_ok=True)
                    if backup.exists() and backup.stat().st_size != 0:
                        raise ValueError('A nonempty placeholder backup was preserved')
                    backup.touch(exist_ok=True)
                    empty_placeholders.append({'relative': relative, 'backup': str(backup),
                                               'archive_original_bytes': info.file_size})
                else:
                    raise ValueError(f'Changed local file preserved: {relative}')
            entries.append({'relative': relative, 'bytes': local_before[0], 'mtime_ns': local_before[1],
                            'crc32': f'{crc & 0xffffffff:08x}'})
    if signature(archive) != before:
        raise ValueError('ZIP changed during verification')
    checksum = hashlib.sha256()
    with archive.open('rb') as stream:
        for block in iter(lambda: stream.read(4 * 1024 ** 2), b''):
            checksum.update(block)
    if signature(archive) != before:
        raise ValueError('ZIP changed during SHA verification')
    return {'target': str(target), 'archive': str(archive), 'archive_signature': before,
            'archive_sha256': checksum.hexdigest(), 'files': entries,
            'bytes': sum(row['bytes'] for row in entries), 'empty_placeholders': empty_placeholders}

def remove_readonly(function, path, info):
    if isinstance(info[1], PermissionError):
        os.chmod(path, stat.S_IREAD | stat.S_IWRITE)
        function(path)
    else:
        raise info[1]

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    records = [verify_one(name) for name in TARGET_NAMES]
    manifest = {'verified_at': datetime.now(timezone.utc).isoformat(), 'targets': records,
                'authorized_scope': 'Only extracted motor research copies; preserved ZIPs and project implementation'}
    (WORK / 'motor-cleanup-plan.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    receipt = []
    free_before = shutil.disk_usage(BASE).free
    if args.apply:
        for record in records:
            target = Path(record['target']).resolve(strict=True)
            if target.parent != BASE.resolve() or target.name not in TARGET_NAMES:
                raise ValueError('Target escaped the explicitly authorized extraction folders')
            if signature(Path(record['archive'])) != tuple(record['archive_signature']):
                raise ValueError('Preserved ZIP changed before deletion')
            current = inventory(target)
            expected = {row['relative']: (row['bytes'], row['mtime_ns']) for row in record['files']}
            if {path.relative_to(target).as_posix(): signature(path) for path in current} != expected:
                raise ValueError('Extraction tree changed; preserved')
            shutil.rmtree(target, onerror=remove_readonly)
            receipt.append({'target': str(target), 'status': 'deleted_verified_extracted_copy',
                            'bytes': record['bytes'], 'files': len(record['files']),
                            'preserved_zip': record['archive'], 'zip_sha256': record['archive_sha256']})
            (WORK / 'motor-cleanup-receipt.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2), encoding='utf-8')
        assert all(Path(record['archive']).is_file() for record in records)
    print(json.dumps({'applied': args.apply, 'verified_files': sum(len(row['files']) for row in records),
                      'bytes': sum(row['bytes'] for row in records), 'targets_deleted': len(receipt),
                      'preserved_zip_files': [row['archive'] for row in records],
                      'free_before': free_before, 'free_after': shutil.disk_usage(BASE).free}, ensure_ascii=False))
