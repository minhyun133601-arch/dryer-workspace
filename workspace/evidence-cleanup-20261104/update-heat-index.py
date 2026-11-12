from pathlib import Path
import hashlib
import json
from html.parser import HTMLParser
from urllib.parse import unquote, urlsplit

PROJECT = Path(__file__).resolve().parents[2]
ROOT = PROJECT.parent / '근거 자료'
builder = PROJECT / 'tooling' / 'build-evidence-index.py'
source = builder.read_text(encoding='utf-8')
replacements = {
    '<title>건조기 근거자료</title>': '<title>열교환기 근거자료</title>',
    '<h1>건조기 근거자료</h1><p class="sub">건조기 관련 보고서와 원본 자료</p>': '<h1>열교환기 근거자료</h1><p class="sub">건조기 폐열회수 장치 설치 보고서와 검토 근거</p>',
    '<a href="최종자료/열교환기%20백데이터.html">열교환기 백데이터 ↗</a>': '<a href="../프로젝트/index.html">프로젝트 열기 ↗</a>',
    '<a href="https://drive.google.com/drive/folders/1Mz8dWqxT7sH2nqe36esr5LNqCPb0uRzb" target="_blank" rel="noopener">설비 도면·이력카드 수집 폴더 ↗</a>': '',
    'aria-label="건조기 보고서 검색"': 'aria-label="열교환기 보고서 검색"',
    '<details class="report"': '<details open class="report"',
}
for before, after in replacements.items():
    source = source.replace(before, after)
builder.write_text(source, encoding='utf-8')
exec(compile(source, str(builder), 'exec'), {'__file__': str(builder)})

(ROOT / '관리자료' / '자료관리 안내.txt').write_text('''자료 범위 — 2026-11-04 최종 변경

사업 보고서는 「2026-01-21 유산)건조기 열교환기(폐열회수 장치) 설치」 한 묶음만 보관합니다.
설치 보고서 본문과 설치도·정면도·평면도·견적·제작 일정·온도 산출 근거를 함께 남겼습니다.
그 밖의 건조기 보고서 24개 묶음은 추가로 휴지통에 옮겼습니다.

00_자료열기.html에서 설치 보고서, 열교환기 시뮬레이터, 백데이터를 바로 엽니다.
전기·가스 월별 KPI 원장은 열교환기 절감효과 검토의 직접 입력으로 보존합니다.
관리자료/수집·검토/_work_heat_exchanger 및 _work_approvals/approval_review_data.json은
열교환기 계산·화면을 재생성하는 데 필요한 원본입니다.

바탕화면의 「프로젝트」 폴더는 그대로 유지합니다.
진행 중인 「안전」 작업과 외부 런타임 junction은 보고서 포트폴리오 정리 범위 밖입니다.
정리 기록은 프로젝트/workspace/evidence-cleanup-20261104에 있습니다.
자료 첫 화면은 프로젝트/tooling/build-evidence-index.py로 재생성합니다.
''', encoding='utf-8')

plan_path = Path(__file__).parent / 'heat-only-recycle-plan.json'
plan = json.loads(plan_path.read_text(encoding='utf-8'))
receipt = json.loads((plan_path.parent / 'heat-only-recycle-receipt.json').read_text(encoding='utf-8-sig'))
assert len(receipt) == 24 and all(row['Status'] == 'recycled' for row in receipt)
assert all(not Path(path).exists() for path in plan['targets'])
assert list((ROOT / '사업자료').iterdir()) == [Path(plan['keep'])]
assert all(hashlib.sha256(Path(path).read_bytes()).hexdigest() == sha for path, sha in plan['preserved_report_sha256'].items())

class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            self.links.extend(value for name, value in attrs if name == 'href')

parser = Links()
parser.feed((ROOT / '00_자료열기.html').read_text(encoding='utf-8'))
local = [ROOT / unquote(urlsplit(href).path) for href in parser.links if not urlsplit(href).scheme]
missing = [str(path) for path in local if not path.exists()]
assert not missing, missing
verification = {'recycled_additional_report_folders': 24, 'retained_report_groups': 1,
                'retained_report_files_sha256_verified': len(plan['preserved_report_sha256']),
                'local_links_verified': len(local), 'missing_links': missing,
                'project_preserved': PROJECT.is_dir()}
(plan_path.parent / 'heat-only-final-verification.json').write_text(json.dumps(verification, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps(verification, ensure_ascii=False))
