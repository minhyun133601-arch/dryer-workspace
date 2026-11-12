from pathlib import Path

PROJECT = Path(__file__).resolve().parents[2]
ROOT = PROJECT / 'references' / '열교환기'
builder = PROJECT / 'tooling' / 'build-evidence-index.py'
source = builder.read_text(encoding='utf-8')
source = source.replace('href="../프로젝트/index.html"', 'href="../../index.html"')
source = source.replace('<a class="folder" href="{group["href"]}">원본 폴더 열기 ↗</a>', '')
source = source.replace('프로젝트 작업물은 바탕화면의 「프로젝트」 폴더에서 관리합니다.<br>나머지 사업보고서는 휴지통으로 이동했습니다.',
                        '열교환기 보고서와 근거자료를 프로젝트 안에서 함께 관리합니다.')
builder.write_text(source, encoding='utf-8')
exec(compile(source, str(builder), 'exec'), {'__file__': str(builder)})

readme = PROJECT / 'README.md'
text = readme.read_text(encoding='utf-8')
text = text.replace('기존 `근거 자료`와 분리했으며, 바탕화면의 `KPI` 보고서 폴더는 그대로 유지했습니다.',
                    '열교환기 설치 보고서·도면·견적·계산 원본과 기존 시뮬레이터는 `references/열교환기/`에 통합했습니다.')
text = text.replace('이웃 폴더의 `../근거 자료/00_자료열기.html`에서도 시뮬레이터가 선택된 통합 공유본을 엽니다.',
                    '`references/열교환기/00_자료열기.html`에서 설치 보고서와 시뮬레이터가 선택된 통합 공유본을 엽니다. 프로젝트 홈의 「열교환기 설치 보고서·근거자료」 링크로도 연결됩니다.')
readme.write_text(text, encoding='utf-8')

doc = PROJECT / 'docs' / 'heat-exchanger.md'
text = doc.read_text(encoding='utf-8')
text = text.replace('`00_자료열기.html`의 첫 카드도 통합 공유본의 같은 메뉴로 연결됩니다.',
                    '`references/열교환기/00_자료열기.html`의 시뮬레이터 카드도 통합 공유본의 같은 메뉴로 연결됩니다. 설치 보고서와 원본 파일도 같은 화면에서 엽니다.')
text = text.replace('`최종자료/건조기 열교환기 시뮬레이터.html`의 기존 화면과 계산을 가져왔습니다.',
                    '`references/열교환기/최종자료/건조기 열교환기 시뮬레이터.html`의 기존 화면과 계산을 가져왔습니다.')
doc.write_text(text, encoding='utf-8')

(ROOT / '관리자료' / '자료관리 안내.txt').write_text('''열교환기 자료 보관 위치 — 2026-11-04

이 항목은 바탕화면의 「프로젝트/references/열교환기」로 통합했습니다.
프로젝트 실행.cmd를 열면 열교환기 시뮬레이터를 다른 정비 도구와 함께 사용합니다.
프로젝트 홈의 「열교환기 설치 보고서·근거자료」에서 보고서와 첨부 원본을 엽니다.
이 폴더의 00_자료열기.html도 서버 없이 설치 보고서·통합 시뮬레이터·백데이터를 엽니다.

사업자료: 설치 보고서와 도면·견적·일정·온도 산출 원본 11개
최종자료: 이전 시뮬레이터와 열교환기 백데이터
관리자료/수집·검토: 계산·도면 재현·검증을 재생성하는 원본 및 기술 코드
KPI 엑셀: 열교환기 효과 검토에 사용하는 전기·가스 실적 원장

전체 이동 171개 파일은 이동 직후 SHA256으로 대조했습니다.
관련 없는 사업 보고서는 휴지통으로 정리했습니다.
''', encoding='utf-8')
