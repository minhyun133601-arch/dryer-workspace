from pathlib import Path
from datetime import datetime, timezone
from html.parser import HTMLParser
from urllib.parse import unquote
import hashlib
import json

ROOT = next(p for p in Path(__file__).resolve().parents if p.name == '근거 자료')
RECORDS = Path(__file__).resolve().parent
WORK = ROOT / '관리자료/수집·검토/_work_heat_exchanger'
OUT = ROOT / '최종자료/건조기 열교환기 시뮬레이터.html'
digest = hashlib.sha256(OUT.read_bytes()).hexdigest()
qa = json.loads((WORK / 'full_reconstruction_qa.json').read_text('utf8'))
build = json.loads((WORK / '3d_receipt.json').read_text('utf8'))
source = json.loads((WORK / 'full_reconstruction/source_integrity.json').read_text('utf8'))
assert digest == qa['sha256'] == build['sha256']
assert len(qa['checks']) == 194 and all(c['passed'] for c in qa['checks'])
assert not qa['errors'] and not qa['outsideRequests']
assert source['status'] == 'passed'
for relative, record in source['sourceHashes'].items():
    assert hashlib.sha256((WORK / 'full_reconstruction' / relative).read_bytes()).hexdigest() == record['sha256']


class EntryLinks(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'a' and 'shortcut' in attrs.get('class', ''):
            self.links.append(unquote(attrs.get('href', '')))


entry = EntryLinks()
entry.feed((ROOT / '00_자료열기.html').read_text('utf8'))
assert any((ROOT / href).resolve() == OUT.resolve() for href in entry.links)
assert all((ROOT / href).exists() for href in entry.links)

receipt_path = RECORDS / 'final_receipt.json'
receipt = json.loads(receipt_path.read_text('utf8'))
receipt.update({
    'simulatorBytes': OUT.stat().st_size,
    'simulatorSHA256': digest,
    'simulatorVerificationChecks': len(qa['checks']),
    'simulatorSourceDataChecks': len(source['checks']),
    'simulatorFeatures': [
        'front_plan_relative_coordinate_3d', 'original_vector_comparison',
        'complete_traced_pid_inventory', 'selected_connection_highlight',
        'separate_auxiliary_concept_models', 'explicit_unknown_positions',
        'equipment_focus', 'executive_presentation',
        '30_second_guided_tour', 'steady_state_heat_balance',
        'seven_byte_preserved_original_downloads', 'offline_single_html'
    ],
    'surveyItems': 33,
    'surveyDuctRoutes': 7,
    'pidNodes': 213,
    'pidConnections': 175,
    'sourceLinkedPID': 16,
    'separateConceptEquipment': 49,
    'originalDownloads': 7,
    'sourceGeometryVisualReview': '관리자료/수집·검토/_work_heat_exchanger/full_reconstruction/view_qa/geometry_visual_review.json',
    'simulatorFinalQA': '관리자료/수집·검토/_work_heat_exchanger/full_reconstruction_qa.json',
    'finalizedUtc': datetime.now(timezone.utc).isoformat()
})
receipt_path.write_text(json.dumps(receipt, ensure_ascii=False, indent=2), 'utf8')

screens = []
for name in ('executive-desktop.png', 'executive-compact.png', 'executive-mobile.png',
             'executive-report.png', 'executive-heat-detail.png'):
    file = ROOT / '삭제자료/검토 화면' / name
    assert file.is_file()
    screens.append({'file': str(file.relative_to(ROOT)), 'bytes': file.stat().st_size})
(RECORDS / 'reconstruction_cleanup_receipt.json').write_text(json.dumps({
    'action': 'moved_to_delete_candidates',
    'reason': '이전 시뮬레이터의 검토 화면. 최종 재현본 검증 화면으로 대체됨.',
    'files': screens,
    'permanentlyDeletedThisStep': 0,
    'originalsModifiedThisStep': 0
}, ensure_ascii=False, indent=2), 'utf8')
print(json.dumps({'status': 'complete', 'bytes': OUT.stat().st_size, 'sha256': digest,
                  'featureChecks': len(qa['checks']), 'sourceChecks': len(source['checks']),
                  'entryShortcutsValid': len(entry.links)}, ensure_ascii=False))
