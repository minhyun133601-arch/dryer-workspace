import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[4]
readme = root / 'README.md'
text = readme.read_text(encoding='utf-8')
text = text.replace('공무사무실 외관은 사용자 사진을 받아 다시 맞출 예정이라 지금은 외곽·높이·초록 지붕만 표시합니다.', '공무환경팀실 외관은 11/11 추가 영상의 출입구·차양·상부 전기 가대를 반영했습니다.')
readme.write_text(text, encoding='utf-8')

older = root / 'references/campus-rear-side-20261110/README.md'
text = older.read_text(encoding='utf-8')
note = '> **후속 보강(11/11 추가 영상):** 아래의 외관 사진 대기와 저층동 뒷벽 Z=-49 차이는 [보일러실·주변 보강](../boiler-room-20261111/README.md)에서 갱신했습니다. 공무환경팀실 출입구·전기 가대와 수변전실을 추가하고 저층동 뒷벽을 약 Z=-66으로 보완했습니다. 탱크 계단은 사용자 정정대로 앞벽이 아닌 옆쪽 벽을 넘습니다. 아래 상세는 해당 보강 이전의 판단 이력입니다.\n\n'
if note not in text:
    text = text.replace('\n\n', '\n\n' + note, 1)
older.write_text(text, encoding='utf-8')

docs = root / 'docs/site.md'
text = docs.read_text(encoding='utf-8')
text += '\n\n## 11/11 추가 영상 · 보일러실·공무환경팀실·전기실\n\n전경 목록의 **보일러실 · 1팀 2파트**를 누르면 해당 실의 지붕과 벽을 열어 내부를 확인합니다. 문패에 적힌 **3ton/h 노통연관 1대·1.5ton/h 관류형 1대**와 촬영된 버너·제어반·펌프·급수 부속·상부 배관·반투명 채광 지붕을 재현했습니다. 건조실 저층동의 동쪽 회색 셔터 옆 공간이며, 기존 액상 3팀 카드의 보일러실과 별도입니다. 내부 보기를 끄거나 선택을 해제하면 주변 건물 외관도 함께 복원합니다.\n\n사용자가 확인한 **LPG 옆 공무환경팀실**은 기준 위치를 유지하고 새 영상의 출입구·차양·상부 전기 가대를 보강했습니다. 건조실 뒤 회색 문에는 영상에서 읽힌 **공무작업장**을 별도로 표시합니다. **전기실 · 수변전실**은 녹색 철문·표찰·콘크리트 출입 구조를 표현했으며, 영상에 없는 실내 변압기·배전반은 추가하지 않았습니다. 탱크 계단은 사용자 지시대로 **옆쪽 벽에 걸쳐진 방향**으로 수정했습니다. 탱크 8기와 2·3·3 배치는 유지합니다.\n\n건조실 저층동 뒷벽과 지대가온실·고속문·회색 셔터·휴게실 문 순서, 노란 배관과 밸브·경광등 제어함·세척조·보온 배관을 새 동선에 맞췄습니다. 실 치수·위치는 실측이 아닌 영상 비례 근사입니다. 원본·웹 사진 31장과 판단 범위는 `references/boiler-room-20261111/README.md`에 기록했습니다.\n'
docs.write_text(text, encoding='utf-8')

evidence = root / 'references/boiler-room-20261111'
location = evidence / 'location-evidence.json'
data = json.loads(location.read_text(encoding='utf-8'))
data['reviewMethod'] = '전체 182.66초를 4초 간격 접촉 시트 4장으로 검토한 뒤 핵심 장면을 원래 표시 해상도로 재확인했다. 접촉 시트는 필터의 프레임 선택 시각 차이가 있으므로 판단 시각은 별도 추출한 원본 프레임을 우선한다.'
location.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
source_records = []
for path in sorted((root / '보일러실, 추가 파일').iterdir()):
    if path.is_file():
        digest = hashlib.file_digest(path.open('rb'), 'sha256').hexdigest()
        source_records.append({'path': path.relative_to(root).as_posix(), 'bytes': path.stat().st_size, 'sha256': digest})
manifest = {'date': '2026-11-11', 'sourcesUnmodified': True, 'files': source_records, 'missingVideoForMetadata': '20261111_082857KST', 'appPhotoCount': 31, 'reviewNotes': ['location-evidence.json', 'interior-evidence.json', 'interior-photo-manifest.json'], 'implemented': ['campus-boiler-room', 'campus-electrical-room', 'campus-maintenance-office exterior', 'side-wall tank staircase', 'dryer annex rear correction', 'exterior services and door positions'], 'placementLimit': '영상·동선 기반 근사, 휴대폰 GPS는 촬영자 위치로만 사용'}
(evidence / 'source-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('Updated project documentation and source manifest; original videos and metadata unchanged.')
