# 파일 정리 · 2026-11-12

현재 실행과 원본 근거를 유지하면서, 루트에 들어온 자료와 완료된 임시 산출물을 목적별로 모았습니다. 파일을 영구 삭제하거나 촬영·도면 원본을 변경하지 않았습니다. 이동한 검토 도구 8개는 달라진 폴더 깊이에 맞춰 실행 경로만 보정하고 별도 해시 기록을 남겼습니다.

| 찾는 것 | 현재 위치 |
| --- | --- |
| 실행 | 루트 `프로젝트 실행.cmd`, `index.html`, `package.json` |
| 화면·모델 소스 | `apps/`, 메뉴·화면 전환은 `workspace/app.js` 등 루트 JS/CSS |
| 화면의 이미지·도면 | `apps/site/assets/`, 기준 목록은 `asset-catalog.js`와 `docs/asset-index.csv` |
| 경비실→2팀 입구 촬영 MP4·GPS TXT | `references/guardhouse-team2-20261112/source/` |
| 폐수처리장 원본 PDF 3장 | `references/wastewater-20261112/source/` |
| 주제별 원본·판독 근거 | `references/<주제>/` |
| 도면 검토 앱·CAD 원본·미리보기·검토 DB | 기존 `근거 자료/` 유지 |
| 완료된 연락 시트·판독 이미지·검토 도구·캡처 | `workspace/reviews/<주제>/` |
| 과거 검사·내보내기 로그 | `workspace/verification-archive/<날짜>/<주제>/` |
| 현재 경비실→2팀 입구 판독 작업 | `workspace/entrance-route-20261112/` |
| 현재 실행·검사·내보내기 도구 | `tooling/` |
| 동작 검사 | `tests/` |
| 사용·유지보수 안내 | `README.md`, `docs/` |
| 오프라인 전체 공유·건조실 발표 HTML | `exports/` |
| 온라인 게시 소스·계정/체크아웃 상태 | 기존 `sites/` 유지 |
| 변경 전 복구용 파일 | 기존 `.backups/` 유지 |
| 브라우저 도구 세션 | 기존 `.playwright-mcp/` 유지 |
| 로컬 서버 상태 | `tmp/workspace-server.json` 유지 |

전체 파일을 역할별로 찾으려면 [경로·목적 목록](project-file-index.csv)을 검색하세요. 파일 수·용량은 [분류별 요약](project-file-summary.json)에 있습니다. 이 목록은 작성 시점 스냅샷이며, 검토 작업 중 생성되는 새 파일은 늘어날 수 있습니다. `python workspace/file-organization-20261112/index-files.py`로 목록만 다시 만들 수 있습니다.

## 이동 검증

`move-receipt.json`은 완료된 리뷰·로그·캡처·폐수 도면의 이동 156건, `route-source-move-receipt.json`은 새 촬영 원본 2건입니다. 합계 **158개 파일, 462,992,139바이트**를 옮겼고 각 이동 전후 SHA256이 일치했습니다. 빈 임시 디렉터리 39개와 비워진 원본 폴더 2개를 정리했으며 파일 삭제는 0건입니다. 전체 이동을 한 번에 검색하려면 `organization-manifest.json`을 사용하세요.

이전 경로로 기록된 역사 manifest는 당시 내용을 보존합니다. 해당 경로가 지금 없으면 두 이동 receipt의 `originalPath`로 검색하여 `currentPath`를 찾으세요. 사용자 촬영 파일의 긴 원본 이름·GPS·시각 정보와 원본 PDF 이름은 유지합니다.

이 폴더의 PowerShell 도구는 이번 정리의 작업 기록입니다. `organize.ps1`, `move-route-source.ps1`은 이미 처리한 일회 작업이므로 다시 실행하지 마세요. `complete-*.ps1`은 이동 후 해시를 재검증하고 receipt를 만드는 복구용 기록입니다. 현재 기능 실행에는 이 파일들이 필요하지 않습니다.

`script-path-repairs.json`에는 검토 도구의 이동 직후 SHA256과 경로 보정 후 SHA256, 수정한 import·프로젝트 루트 경로를 구분했습니다. 수정 전 바이트는 `original-scripts/` 아래의 `.original` 파일로 보존하여 실행·문법 검사 대상과 구분합니다. 원래 이동 receipt의 SHA256은 이동 당시 기록으로 그대로 유지합니다. `python workspace/file-organization-20261112/finalize-manifest.py`는 수정 전 사본과 수정 후 현재 도구를 각각의 해시로 재검증합니다.

예전 `tmp/`에 있던 단일 검증 HTML은 `workspace/reviews/wastewater-20261112/export-check/`의 당시 결과이며 현재 공유 파일은 `exports/건조기-통합-공유.html`입니다. 일회 수정 스크립트 역시 당시 기록으로 보관하며 현재 앱 수정에는 쓰지 않습니다.
