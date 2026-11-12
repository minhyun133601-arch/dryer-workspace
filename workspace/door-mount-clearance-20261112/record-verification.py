from pathlib import Path
import hashlib
import json
import re
import shutil

review = Path('workspace/door-mount-clearance-20261112')
dest = Path('references/door-mount-clearance-20261112')
backup = Path('.backups/door-mount-clearance-20261112')
share = Path('exports/\uac74\uc870\uae30-\ud1b5\ud569-\uacf5\uc720.html')

def read_log(name):
    data = (review / name).read_bytes()
    return data.decode('utf-16' if data.startswith((b'\xff\xfe', b'\xfe\xff')) else 'utf-8-sig')

tests = read_log('tests-final.log')
check = read_log('check-final.log')
passed = int(re.findall(r'pass (\d+)', tests)[-1])
failed = int(re.findall(r'fail (\d+)', tests)[-1])
assert failed == 0
javascript_count = int(re.search(r'JavaScript (\d+)', check).group(1))
reports = []
for area in ['campus', 'rear', 'indoor']:
    source = review / area / 'review.json'
    json.loads(source.read_text(encoding='utf-8'))
    output = dest / f'{area}-review.json'
    shutil.copy2(source, output)
    reports.append(output.as_posix())
shutil.copy2(review / 'liquid-outdoor-review.json', dest / 'liquid-outdoor-review.json')
reports.append((dest / 'liquid-outdoor-review.json').as_posix())
changed_sources = []
for original in sorted((backup / 'apps').rglob('*.js')):
    current = Path(original.relative_to(backup))
    if not current.exists() or current.read_bytes() == original.read_bytes():
        continue
    changed_sources.append({
        'path': current.as_posix(),
        'beforeSha256': hashlib.sha256(original.read_bytes()).hexdigest(),
        'afterSha256': hashlib.sha256(current.read_bytes()).hexdigest(),
    })

record = {
    'date': '2026-11-12',
    'scope': 'Door-head mounts, wall intersections and doorway approach obstructions',
    'basis': 'Existing metric drawings, supplied route footage and actual rendered/animated model geometry',
    'detailedReviews': reports,
    'keyCorrections': [
        'Canopies and roller housings align to actual wall faces, with connected mounts.',
        'All modified roller housings contain the gathered curtains on all three axes.',
        'Elevator air curtain and call controls align to their actual wall.',
        'Canopy condenser feet touch the roof; wall condensers have wall plates, arms and pads.',
        'Team-2 porch supports reach the canopy underside.',
        'Yellow-door insulated mains, housing and guards clear the doorway.',
        'Separate lower cover and upper hood preserve the upper window; opaque middle pier aligns in world space.',
        'Rain pipe clears projecting window frames and has connected clips.',
        'Preparation IBC, pallet, forklift mast/forks and footwear clear doorway approaches.',
        'Exit signs, insect traps and air units face indoors and mount beside clear openings.',
        'Boiler equipment opening is clear of service mains; existing route count is retained.',
        'Rapid-curtain crossing plane now matches its physical orientation and displaced curtain position.',
    ],
    'automated': {
        'npm test': {'passed': passed, 'failed': failed, 'log': (review / 'tests-final.log').as_posix()},
        'npm run check': {'javascriptFiles': javascript_count, 'status': 'passed', 'log': (review / 'check-final.log').as_posix()},
        'npm run export:share': {'status': 'passed', 'log': (review / 'export-final.log').as_posix()},
        'featureTests': [
            'Wall-face and bracket contact bounds',
            'Full 3D curtain containment and clear passage rays',
            'Door approach band using actual forklift/IBC/pallet bounds',
            'Actual instance-column and equipment interference checks',
            'World-space service-cover/opaque-pier alignment and glass rays',
            'Physical normal and threshold of both preparation curtain orientations',
            'Closed/open transverse threshold behavior and parallel walking',
            'Existing F, automatic mode and linked interior return behavior',
        ],
    },
    'browser': {
        'localRuntime': 'ready=true, no console errors',
        'sharedRuntime': 'ready=true, F/automatic controls retained, no console errors',
        'visuals': [
            (review / name).as_posix() for name in [
                'elevator-mount-after.png', 'yellow-door-clearance-after.png',
                'rear-hood-window-after.png', 'rear-entry-review.png',
                'preparation-door-after.png', 'packaging-exit-sign-after.png',
                'roller-face-mount.png',
            ]
        ],
    },
    'sources': changed_sources,
    'export': {
        'path': share.as_posix(), 'bytes': share.stat().st_size,
        'sha256': hashlib.sha256(share.read_bytes()).hexdigest(),
    },
    'backup': backup.as_posix(),
    'limits': 'Mounting offsets, support details, loose-object parking and pipe bypasses are plausible model corrections, not new surveyed installation or structural specifications. Existing metre scale and equipment identities are preserved.',
}
(dest / 'verification.json').write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'Saved {len(changed_sources)} source hashes and {passed} passed / {failed} failed checks.')
