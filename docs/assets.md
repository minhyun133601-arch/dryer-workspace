# 자산 관리

화면에 쓰는 이미지의 기준 목록은 `apps/site/asset-catalog.js`의 `SITE_ASSETS`입니다. 설비명·도면명으로 찾으려면 [자산 목록 CSV](asset-index.csv)를 검색하세요.

## 활성 자산 위치

| 경로 | 용도 |
| --- | --- |
| `apps/site/assets/brand/` | 공식 로고 |
| `apps/site/assets/branding/` | 사용자가 제공한 회사 로고 원본 사본·안내자 작업복과 안전모 |
| `apps/site/assets/drawings/` | 공장과 설비의 건축·배치·단면·회로·계통도. 현장에서 종이 도면을 촬영한 이미지도 도면으로 분류 |
| `apps/site/assets/photos/equipment-cards/` | 액상·실외기실 설비의 4면 사진, 2팀 028 질소발생기 4면 사진과 흡착탱크 명판 |
| `apps/site/assets/photos/compressor/` | 건조실 3층 설비 현장 사진과 촬영 영상에서 추출한 컷 |
| `apps/site/assets/photos/evidence/dryer-first-floor-20261113/` | 건조실 1층 조제실·외포장실 영상에서 선정한 현장 사진 |
| `apps/site/assets/documents/chiller/` | 냉동기 계산서, 시험성적서, 카탈로그와 치수·성능표 |
| `apps/site/assets/documents/dryer-burner/` | 버너에서 여는 정비자료 이미지 |
| `photos/share/`, `drawings/share/`, `documents/share/` | 각 분류에 해당하는 공유용 축소 이미지. 별도 축소본이 필요 없는 자료는 원본을 공유본에도 사용 |

각 폴더와 파일 이름은 영문 소문자·숫자·하이픈으로 작성합니다. 코드의 자산 경로는 `./assets/...` 형식입니다. 자산 ID는 고유하게 유지하고 기존 파일을 바꿀 때 경로·대소문자·이미지 형식을 확인합니다.

실외기실 설비마다 정면·좌측·우측·후면이 담긴 `overview.jpg` 한 장을 보관합니다. 앱과 사진첩의 방향별 보기는 이 사진의 해당 부분을 확대합니다. 기존 로컬 서버 주소의 `front.jpg`, `left.jpg`, `right.jpg`, `rear.jpg`도 같은 합본에서 해당 면을 잘라서 표시합니다.

## 추가·교체 절차

1. 사용할 파일을 해당 자산 폴더에 넣습니다.
2. `asset-catalog.js`에 ID·분류·표시명·경로를 등록하거나 기존 항목을 수정합니다. 도면은 `drawing-*`, 사진은 `card-*` 또는 현장 조사 분류, 문서는 `document-*`를 사용합니다. 공유용 축소본은 같은 종류의 `share/` 하위 폴더에 두고 `sharePath`로 연결합니다.
3. 해당 영역의 데이터 모듈에서 자산을 연결합니다. 어떤 모듈인지 [모델 수정 위치](site.md)에서 찾습니다.
4. `npm run assets:index`, `npm run assets:check`, `npm run check`를 실행합니다.
5. 실제 화면에서 이미지를 열어 확인하고 필요한 공유본을 다시 생성합니다.

`evidence-assets.js`가 화면에 허용하는 이미지 종류를 정합니다. 경로를 옮길 때는 기준 목록과 사용하는 데이터 모듈을 함께 수정하세요. 공유본에 자산을 넣는 코드는 `tooling/export-site.mjs`, `export-dryer-presentation.mjs`, `site-export-utils.mjs`에 있습니다.

1층 보완 영상의 선정 사진 12장은 `survey-dryer-first-floor` 분류로 등록합니다. 원본 MP4·TXT, 클립별 시점, 추출 경로·해시·구조 근거는 [1층 영상 근거 목록](first-floor-supplement-20261113.json)에서 확인합니다. 활성 JPEG는 높이 1600px·품질 90입니다. MP4·TXT는 프로젝트 밖 `../프로젝트_현장영상_보관/`으로 옮겼으며, 사용하지 않는 임시 검토 JPEG와 디코딩 PNG 100장은 삭제 상태를 기록한 뒤 정리했습니다. 재검토에는 보관한 원본 영상과 기록된 클립 시점을 사용합니다.

도면 원본·미리보기·검토 기록·변환 도구는 `../프로젝트_도면자료/`에 별도 보관합니다. [저장 경로 설정](drawing-storage.json)으로 도면 메뉴에 연결합니다. [정리 기록](material-storage-20261113.json)과 [추가 정리 기록](material-cleanup-followup-20261113.json)에 이동 전후 경로·파일 수·바이트·SHA256과 삭제한 생성 이미지 목록이 있습니다. `apps/site/assets/`의 활성 사진·도면·로고는 이 외부 원본과 별도로 필요하므로 유지합니다. 루트의 중복 `회사로고.jpg`는 제거했으며 앱에서 사용하는 로고는 `apps/site/assets/branding/company-logo.jpg`입니다.

이전 자료 정리 작업의 보관 경로와 이동 기록은 [과거 보관 위치 안내](archived-materials.json)에 남아 있습니다. 현재 도면·현장영상의 이동 전후 경로와 파일별 검증은 위의 자료 정리 기록을 기준으로 확인합니다.
