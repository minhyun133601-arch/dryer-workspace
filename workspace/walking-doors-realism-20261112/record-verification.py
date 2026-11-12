from pathlib import Path
import hashlib
import json
import re

review = Path('workspace/walking-doors-realism-20261112')
folder = Path('references/walking-realism-20261112')
share = Path('exports/\uac74\uc870\uae30-\ud1b5\ud569-\uacf5\uc720.html')
def read_log(name):
    data = (review / name).read_bytes()
    return data.decode('utf-16' if data.startswith((b'\xff\xfe', b'\xfe\xff')) else 'utf-8-sig')

tests = read_log('tests-final.log')
check = read_log('check-final.log')
passed = int(re.findall(r'pass (\d+)', tests)[-1])
failed = int(re.findall(r'fail (\d+)', tests)[-1])
assert failed == 0
assert '86' in check
verification = {
    'date': '2026-11-12',
    'scope': 'Faster inspection walking, enterable doors, manual/automatic controls and drawing-based person view',
    'behavior': {
        'speedMetresPerSecond': {'normal': 6, 'shift': 12, 'previous': [4, 8], 'factor': 1.5, 'purpose': 'fast model inspection'},
        'defaultAutomaticDoors': False,
        'manualControls': ['F toggles nearby faced eligible doorway', 'on-screen open/close button'],
        'automaticControls': 'Checkbox enables approach opening and delayed departure closing for enterable:true leaves only',
        'closedReviewedThreshold': 'Crossing waits until all leaves have opened',
        'connectedRoute': 'campus Team-2 rear entry <-> packaging first-floor entry; person view retained',
        'portalContinuity': 'One F operation; paired threshold stays open across transition; spawn 0.9m inside / 1.7m outside',
        'pairedLeaves': 'one interaction synchronizes leaves, elevator panels and curtain strips',
        'preferencesKey': 'dryer-person-navigation-v1',
        'metricScale': 1,
        'eyeHeightMetres': 1.65,
        'verticalFovDegrees': 70,
        'viewScaleRangePercent': [75, 125],
        'drawingDecision': 'Retain reviewed metric dimensions; view scale adjusts camera projection',
        'maximumGroundSampleSpacingMetres': 0.06,
    },
    'automated': {
        'npm test': {'passed': passed, 'failed': failed, 'log': str(review / 'tests-final.log').replace('\\', '/')},
        'npm run check': {'javascriptFiles': 86, 'status': 'passed', 'log': str(review / 'check-final.log').replace('\\', '/')},
        'npm run export:share': {'status': 'passed', 'log': str(review / 'export-final.log').replace('\\', '/')},
        'featureCoverage': ['F key repeat suppression', 'checkbox/button/settings in local and shared apps', 'paired panels', 'enterable-only model metadata', 'closed and partly-open threshold blocking', 'relocated/rotated portal return and re-entry', 'fast movement on narrow stairs', 'camera scale preserves drawing coordinates'],
    },
    'browser': {
        'local': 'ready=true; no console errors',
        'manualF': 'Actual Team-2 rear doorway opened after F; state carried to the first-floor doorway',
        'singleOperationRoundTrip': {'inside': [-4, 0, 14.3], 'returnedOutside': [9.625, 0.055, -65.85], 'bothThresholdsOpenOnArrival': True},
        'automatic': 'Checkbox hides manual button, updates hint and focuses canvas',
        'persistence': 'automatic=true and scale=.8 survived reload; review preferences reset to false/1',
        'mobile': {'viewport': [390, 844], 'horizontalOverflow': False, 'canvasSize': [353, 314.390625], 'controlsInsideCanvas': True, 'screenshot': str(review / 'mobile-person-canvas.png').replace('\\', '/')},
        'shared': 'Standalone iframe ready=true; person controls and checkbox respond; no console errors',
        'sharedScreenshot': str(review / 'shared-person-desktop.png').replace('\\', '/'),
    },
    'export': {'path': share.as_posix(), 'bytes': share.stat().st_size, 'sha256': hashlib.sha256(share.read_bytes()).hexdigest()},
    'limits': [
        'Existing wall pass-through navigation is retained; closed reviewed doorway thresholds require opening.',
        'Measured drawing values, video proportions and unmeasured geometry are distinguished in scale-audit.json.',
        'Liquid orbit inspection is not treated as a walking person and cannot trigger proximity doors.',
    ],
    'backup': '.backups/walking-doors-realism-20261112',
}
(folder / 'verification.json').write_text(json.dumps(verification, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
audit_path = folder / 'door-access-audit.json'
audit = json.loads(audit_path.read_text(encoding='utf-8'))
audit['returnPortal'] = {
    'model': 'packaging-environment-v2.js',
    'door': 'first-floor entry-door',
    'portal': {'area': 'campus', 'entry': 'team2-rear'},
    'basis': 'Matching current rear threshold pose; opening state carried both directions; no second F required',
}
audit_path.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'Saved verification: {passed} passed, {failed} failed; export {share.stat().st_size} bytes.')
